package com.cursorremote.lite;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.widget.Toast;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;

// A thin WebView shell around the user's GitHub Pages app, so it installs without Google Play services or PWA support.
public class MainActivity extends Activity {
    private static final String SETUP = "file:///android_asset/setup.html";
    private static final String APK_MIME = "application/vnd.android.package-archive";
    private static final String UPDATE_FILE = "CursorRemote-update.apk";
    private static final int VOICE = 7;
    private static final int PICK = 8;
    private WebView web;
    private ValueCallback<Uri[]> pickFile;
    private SharedPreferences prefs;

    private final BroadcastReceiver downloaded = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            long id = i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id != -1 && id == prefs.getLong("updateId", -2)) installUpdate(id);
        }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("cursor-remote", MODE_PRIVATE);
        web = new WebView(this);
        web.setBackgroundColor(0xFF1E1E1E);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " CursorRemoteApp/" + BuildConfigVersion.name(this));

        web.addJavascriptInterface(new Bridge(), "CursorRemoteApp");
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pickFile != null) pickFile.onReceiveValue(null);
                pickFile = callback;
                try {
                    startActivityForResult(params.createIntent(), PICK);
                } catch (Exception e) {
                    pickFile = null;
                    return false;
                }
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("file".equals(u.getScheme()) || sameOrigin(u, appUrl())) return false;
                // Donate links etc. open in the system browser; the bridge is only exposed to the app's own pages.
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!prefs.getBoolean("pendingUiClear", false)) return;
                if (url == null || url.startsWith(SETUP) || url.startsWith("about:")) return;
                prefs.edit().putBoolean("pendingUiClear", false).apply();
                // Now that Pages origin is loaded, drop Cache Storage + SW, then hard-reload.
                view.evaluateJavascript(
                    "(async()=>{try{const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));"
                        + "const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()));}"
                        + "catch(e){} true;})()",
                    ignored -> runOnUiThread(() -> {
                        String base = appUrl();
                        if (base == null || base.isEmpty()) return;
                        String bust = base.split("#")[0] + (base.contains("?") ? "&" : "?") + "crbust=" + System.currentTimeMillis();
                        view.loadUrl(bust);
                    }));
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) view.loadUrl(SETUP + "?offline=1");
            }
        });

        IntentFilter done = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        // The broadcast comes from the system download provider, a separate app.
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(downloaded, done, Context.RECEIVER_EXPORTED);
        else registerReceiver(downloaded, done);

        // Drop stale WebView / service-worker shells after an APK upgrade so Pages UI (e.g. Files tab) loads.
        String ver = BuildConfigVersion.name(this);
        boolean versionCleared = !ver.equals(prefs.getString("clearedCacheFor", ""));
        if (versionCleared) {
            prefs.edit().putString("clearedCacheFor", ver).apply();
        }

        boolean clearUi = getIntent() != null && getIntent().getBooleanExtra("clearUi", false);
        if (!openPairLink(getIntent())) {
            String win = getIntent().getStringExtra("win");
            String action = getIntent().getStringExtra("notifAction");
            if (win != null) prefs.edit().putString("openWin", win).apply();
            if (action != null) prefs.edit().putString("notifAction", action).apply();
            if (clearUi || versionCleared) {
                // Must unregister the service worker — HTTP clearCache alone leaves a stuck shell (e.g. UI 24).
                clearUiCacheAndReload();
            } else if (state != null) {
                web.restoreState(state);
            } else {
                load();
            }
        }
        maybePostTestFromIntent(getIntent());
        // Migrate silent/DND-stuck channels once after APK upgrade.
        if (!prefs.getBoolean("channelsV4", false)) {
            NotifyService.resetChannels(this);
            prefs.edit().putBoolean("channelsV4", true).putBoolean("channelsV3", true).apply();
        }
        // Always keep a foreground service so the process (and WebSocket) survive Home / app switch.
        NotifyService.start(this);
        // Android 13+: if the user already turned notifications on, re-prompt when permission is missing.
        if (NotifyService.enabled(this) && !notificationsAllowed()) requestNotifyPermission();
    }

    // Do NOT call web.onPause() — that freezes JS timers and drops the relay WebSocket when the
    // app is backgrounded. Stay connected until the user Unpairs / force-stops.
    @Override
    protected void onPause() {
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        NotifyService.start(this);
        // Resume a download that waited for “install unknown apps” permission.
        String pending = prefs.getString("pendingUpdateUrl", null);
        if (pending != null && canInstallPackages()) {
            prefs.edit().remove("pendingUpdateUrl").apply();
            downloadUpdate(pending);
        }
    }

    @Override
    protected void onDestroy() {
        unregisterReceiver(downloaded);
        super.onDestroy();
    }

    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls();
    }

    private void downloadUpdate(String url) {
        if (!canInstallPackages()) {
            prefs.edit().putString("pendingUpdateUrl", url).apply();
            try {
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())));
            } catch (Exception ignored) {}
            Toast.makeText(this, NotifyService.tr(
                    "请允许安装未知应用，返回后会继续下载更新",
                    "Allow installing unknown apps; the download continues when you return"), Toast.LENGTH_LONG).show();
            return;
        }
        DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        long previous = prefs.getLong("updateId", -1);
        if (previous != -1) dm.remove(previous);
        File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir != null) new File(dir, UPDATE_FILE).delete();
        DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url))
                .setTitle(NotifyService.tr("Cursor Remote 更新", "Cursor Remote update"))
                .setMimeType(APK_MIME)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, UPDATE_FILE);
        prefs.edit().putLong("updateId", dm.enqueue(r)).apply();
        Toast.makeText(this, NotifyService.tr("正在下载新版本，下载完会弹出安装界面", "Downloading the update; the installer opens when done"), Toast.LENGTH_LONG).show();
    }

    private void installUpdate(long id) {
        Uri apk = ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).getUriForDownloadedFile(id);
        if (apk == null) {
            Toast.makeText(this, NotifyService.tr("下载失败，请稍后在菜单里重试", "Download failed; retry from the menu later"), Toast.LENGTH_LONG).show();
            return;
        }
        Intent install = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(apk, APK_MIME)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(install);
        } catch (Exception e) {
            Toast.makeText(this, NotifyService.tr("无法打开安装界面，请到浏览器下载安装", "Cannot open the installer; download it in a browser"), Toast.LENGTH_LONG).show();
        }
    }

    private boolean onSetupPage() {
        String url = web.getUrl();
        return url != null && (url.startsWith(SETUP) || url.contains("android_asset/setup.html"));
    }

    private void returnToApp() {
        String url = appUrl();
        if (url.isEmpty()) return;
        web.clearHistory();
        web.loadUrl(url);
    }

    private void handleNativeBack() {
        // Change-address / offline setup: return to the paired app instead of exiting.
        if (onSetupPage() && !appUrl().isEmpty()) {
            returnToApp();
            return;
        }
        if (web.canGoBack()) {
            web.goBack();
            return;
        }
        // Main UI: send to background rather than finishing (killing) the activity.
        if (!appUrl().isEmpty()) {
            moveTaskToBack(true);
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (openPairLink(intent)) return;
        maybePostTestFromIntent(intent);
        if (intent != null && intent.getBooleanExtra("clearUi", false)) {
            clearUiCacheAndReload();
            return;
        }
        String win = intent.getStringExtra("win");
        String action = intent.getStringExtra("notifAction");
        if (win != null) web.evaluateJavascript("window.openWin && openWin(" + JSONObject.quote(win) + ")", null);
        if (action != null) {
            web.evaluateJavascript(
                "window.handleNotifAction && handleNotifAction(" + JSONObject.quote(action) + "," + JSONObject.quote(win == null ? "" : win) + ")",
                null);
        }
    }

    /** adb: am start -n com.cursorremote.lite/.MainActivity --ez postTest true */
    private void maybePostTestFromIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra("postTest", false)) {
            NotifyService.postTestAlert(this);
            Toast.makeText(this, NotifyService.tr("已发送测试通知", "Test notification posted"), Toast.LENGTH_SHORT).show();
        }
    }

    /**
     * Clear HTTP cache + unregister service workers, then hard-reload Pages.
     * Do NOT wipe WebStorage — that deletes localStorage pair token/key and drops devices
     * back to the pairing screen (also triggered by WS reloadUi / APK upgrade clear).
     * adb: am start -n com.cursorremote.lite/.MainActivity --ez clearUi true
     */
    private void clearUiCacheAndReload() {
        web.clearCache(true);
        web.clearHistory();
        prefs.edit().putBoolean("pendingUiClear", true).apply();
        String url = appUrl();
        if (url == null || url.isEmpty()) load();
        else web.loadUrl(url.split("#")[0] + (url.contains("?") ? "&" : "?") + "crbust=" + System.currentTimeMillis());
    }

    private boolean notificationsAllowed() {
        return Build.VERSION.SDK_INT < 33
                || checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestNotifyPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !notificationsAllowed()) {
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }

    private void openAppNotificationSettings() {
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            startActivity(i);
        } catch (Exception ignored) {
            try {
                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + getPackageName())));
            } catch (Exception ignored2) {}
        }
    }

    private void enableNotify(String config) {
        String prev = prefs.getString(NotifyService.PREF, null);
        prefs.edit().putString(NotifyService.PREF, config).apply();
        requestNotifyPermission();
        // Recreate alert channels so OEMs can't keep an old channel locked on Silent.
        if (!prefs.getBoolean("channelsV4", false)) {
            NotifyService.resetChannels(this);
            prefs.edit().putBoolean("channelsV4", true).putBoolean("channelsV3", true).apply();
        }
        // Without this, stock Android may stop the listener after the phone has been idle for a while.
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (!pm.isIgnoringBatteryOptimizations(getPackageName()) && !prefs.getBoolean("askedBattery", false)) {
            prefs.edit().putBoolean("askedBattery", true).apply();
            try {
                startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
            } catch (Exception ignored) {}
        }
        // Same config → keep the existing SSE stream. Restarting on every menu/test drops in-flight alerts.
        NotifyService.start(this, prev == null || !prev.equals(config));
        if (!notificationsAllowed()) {
            Toast.makeText(this, NotifyService.tr(
                    "请允许通知权限，否则收不到 Agent 完成提醒",
                    "Allow notifications — otherwise Agent finished alerts will not appear"), Toast.LENGTH_LONG).show();
        }
    }

    private void disableNotify() {
        prefs.edit().remove(NotifyService.PREF).apply();
        // Restart as keepalive-only (no Agent event stream) so the WebSocket process stays alive.
        stopService(new Intent(this, NotifyService.class));
        NotifyService.start(this);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != 1) return;
        boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (ok) {
            NotifyService.start(this);
            Toast.makeText(this, NotifyService.tr("通知已开启", "Notifications enabled"), Toast.LENGTH_SHORT).show();
        } else {
            Toast.makeText(this, NotifyService.tr(
                    "未授予通知权限，正在打开系统设置",
                    "Notification permission denied — opening system settings"), Toast.LENGTH_LONG).show();
            openAppNotificationSettings();
        }
    }

    // cursorremote://pair?app=<https app address>&d=<url key>.<one-time code>, handed over by the web app in a browser.
    private boolean openPairLink(Intent intent) {
        Uri u = intent == null ? null : intent.getData();
        if (u == null || !"cursorremote".equals(u.getScheme())) return false;
        String app = u.getQueryParameter("app");
        String d = u.getQueryParameter("d");
        if (app == null || d == null || !app.startsWith("https://") || !d.matches("[\\w-]+\\.[\\w-]+")) return false;
        prefs.edit().putString("url", app).apply();
        web.loadUrl(app + "#pair=" + d);
        return true;
    }

    private String appUrl() {
        String saved = prefs.getString("url", null);
        return saved != null ? saved : getString(R.string.default_url);
    }

    private void load() {
        String url = appUrl();
        web.loadUrl(url.isEmpty() ? SETUP : url);
    }

    private static boolean sameOrigin(Uri u, String base) {
        if (base == null || base.isEmpty()) return false;
        Uri b = Uri.parse(base);
        return u.getScheme() != null && u.getScheme().equals(b.getScheme()) && u.getHost() != null && u.getHost().equals(b.getHost());
    }

    private static Intent voiceIntent(String lang) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        if (lang != null && !lang.isEmpty()) i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        return i;
    }

    private void voiceResult(String text) {
        web.evaluateJavascript("window.onVoice && onVoice(" + JSONObject.quote(text) + ")", null);
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK) {
            if (pickFile != null) pickFile.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            pickFile = null;
            return;
        }
        if (request != VOICE) return;
        ArrayList<String> heard = result == RESULT_OK && data != null ? data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS) : null;
        voiceResult(heard == null || heard.isEmpty() ? "" : heard.get(0));
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        // Let the page close sheets / viewers first so Back from the menu does not exit.
        web.evaluateJavascript(
                "(function(){try{return !!(window.handleAppBack&&window.handleAppBack());}catch(e){return false;}})()",
                value -> {
                    if ("true".equals(value)) return;
                    runOnUiThread(this::handleNativeBack);
                });
    }

    private class Bridge {
        @JavascriptInterface
        public String getUrl() {
            return appUrl();
        }

        @JavascriptInterface
        public void setUrl(String url) {
            if (url == null || !url.startsWith("https://")) return;
            // A pasted pairing link keeps its #pair fragment for this load, but only the address is remembered.
            prefs.edit().putString("url", url.split("#")[0]).apply();
            runOnUiThread(() -> { web.clearHistory(); web.loadUrl(url); });
        }

        @JavascriptInterface
        public void retry() {
            runOnUiThread(MainActivity.this::load);
        }

        @JavascriptInterface
        public void goHome() {
            runOnUiThread(MainActivity.this::returnToApp);
        }

        @JavascriptInterface
        public void changeUrl() {
            runOnUiThread(() -> web.loadUrl(SETUP + "?change=1"));
        }

        // config: {"app","key","token"} from the paired page, or "" to turn notifications off.
        @JavascriptInterface
        public void setNotify(String config) {
            runOnUiThread(() -> {
                if (config == null || config.isEmpty()) disableNotify();
                else enableNotify(config);
            });
        }

        @JavascriptInterface
        public boolean notifyEnabled() {
            return NotifyService.enabled(MainActivity.this);
        }

        @JavascriptInterface
        public boolean notificationsAllowed() {
            return MainActivity.this.notificationsAllowed();
        }

        @JavascriptInterface
        public void requestNotifyPermission() {
            runOnUiThread(MainActivity.this::requestNotifyPermission);
        }

        @JavascriptInterface
        public void openNotificationSettings() {
            runOnUiThread(MainActivity.this::openAppNotificationSettings);
        }

        @JavascriptInterface
        public void resetNotificationChannels() {
            runOnUiThread(() -> {
                NotifyService.resetChannels(MainActivity.this);
                prefs.edit().putBoolean("channelsV4", true).putBoolean("channelsV3", true).apply();
                NotifyService.start(MainActivity.this, false);
                Toast.makeText(MainActivity.this, NotifyService.tr(
                        "已重建通知渠道，请再发一条测试通知",
                        "Notification channels reset — send a test notification"), Toast.LENGTH_LONG).show();
                openAppNotificationSettings();
            });
        }

        /** Posts a timestamped alert locally so OpenShouter can shout without waiting on SSE. */
        @JavascriptInterface
        public void postTestAlert() {
            runOnUiThread(() -> NotifyService.postTestAlert(MainActivity.this));
        }

        /** JSON: {title,body,kind,win} — used when the relay pushes Agent-finished over the live WebSocket. */
        @JavascriptInterface
        public void postAlert(String json) {
            runOnUiThread(() -> {
                try {
                    JSONObject e = new JSONObject(json == null ? "{}" : json);
                    NotifyService.postAlert(MainActivity.this,
                            e.optString("title", "Cursor Remote"),
                            e.optString("body", ""),
                            e.optString("kind", "done"),
                            e.optString("win", ""));
                } catch (Exception ignored) {
                    NotifyService.postTestAlert(MainActivity.this);
                }
            });
        }

        // A notification tapped while the app was closed: the page asks for its window once it has connected.
        @JavascriptInterface
        public String takeOpenWin() {
            String win = prefs.getString("openWin", "");
            prefs.edit().remove("openWin").apply();
            return win;
        }

        @JavascriptInterface
        public String takeNotifAction() {
            String action = prefs.getString("notifAction", "");
            prefs.edit().remove("notifAction").apply();
            return action;
        }

        @JavascriptInterface
        public boolean canVoice() {
            return voiceIntent("").resolveActivity(getPackageManager()) != null;
        }

        // The result comes back through onActivityResult as window.onVoice(text).
        @JavascriptInterface
        public boolean voice(String lang) {
            Intent i = voiceIntent(lang);
            if (i.resolveActivity(getPackageManager()) == null) return false;
            runOnUiThread(() -> {
                try { startActivityForResult(i, VOICE); } catch (Exception e) { voiceResult(""); }
            });
            return true;
        }

        @JavascriptInterface
        public void update(String url) {
            if (url == null || !url.startsWith("https://")) return;
            runOnUiThread(() -> downloadUpdate(url));
        }

        // Wipe WebView HTTP + SW caches then reload Pages (fixes stuck old UI shells).
        @JavascriptInterface
        public void clearCacheAndReload() {
            runOnUiThread(() -> MainActivity.this.clearUiCacheAndReload());
        }
    }
}
