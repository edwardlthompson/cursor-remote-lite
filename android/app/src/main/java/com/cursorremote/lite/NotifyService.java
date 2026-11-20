package com.cursorremote.lite;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.util.Base64;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

// Keeps one event stream open to the relay and turns its events into notifications.
// Android WebView has no Web Push, and Google's push service is missing on Huawei phones, so the app listens itself.
public class NotifyService extends Service {
    static final String PREF = "notify";
    private static final String TAG = "CursorRemoteNotify";
    // Bump ids whenever OEMs lock an old channel to Silent — apps cannot raise locked channel importance.
    private static final String CH_DONE = "agent_done_v4";
    private static final String CH_WAIT = "agent_wait_v4";
    private static final String CH_LISTEN = "listen_v4";
    private static final int LISTEN_ID = 1;

    private volatile boolean running;
    private volatile HttpURLConnection conn;
    private Thread worker;
    /** Fresh id per alert so OpenShouter sees a new timed post, not an ongoing FGS update. */
    private static final AtomicInteger alertSeq = new AtomicInteger(1000);
    private static final ConcurrentHashMap<String, Integer> lastAlertByWin = new ConcurrentHashMap<>();

    // Native text follows the phone's language; the web app has its own setting.
    static String tr(String zh, String en) {
        return "zh".equals(Locale.getDefault().getLanguage()) ? zh : en;
    }

    static boolean enabled(Context c) {
        return prefs(c).getString(PREF, null) != null;
    }

    static void start(Context c) {
        start(c, true);
    }

    /** @param restartListener false keeps an existing SSE stream (avoid dropping in-flight test/done alerts). */
    static void start(Context c, boolean restartListener) {
        // Always start: even without push config this keeps the process (and WebView socket) alive.
        Intent i = new Intent(c, NotifyService.class).putExtra("restart", restartListener);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
        else c.startService(i);
    }

    /** Immediate shade alert (and OpenShouter shout) — does not wait for the relay SSE round-trip. */
    static void postTestAlert(Context c) {
        postAlert(c, "Cursor Remote",
                tr("测试通知：能看到这条，说明通知已经通了 ✅",
                        "Test notification: if you see this, notifications are working ✅"),
                "test", "");
    }

    /** Post a timed, non-ongoing Agent alert that OpenShouter will treat like a messaging notification. */
    static void postAlert(Context c, String title, String body, String kind, String win) {
        createChannelsStatic(c);
        boolean done = "done".equals(kind) || "test".equals(kind);
        String channel = done ? CH_DONE : CH_WAIT;
        long when = System.currentTimeMillis();
        int id = alertSeq.incrementAndGet();
        String winKey = (win == null || win.isEmpty()) ? "_" : win;
        NotificationManager nm = (NotificationManager) c.getSystemService(NOTIFICATION_SERVICE);
        Integer prev = lastAlertByWin.put(winKey, id);
        if (prev != null) {
            try { nm.cancel(prev); } catch (Exception ignored) {}
        }
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        Notification.Builder b = (Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(c, channel)
                : new Notification.Builder(c))
                .setSmallIcon(R.drawable.ic_notify)
                .setContentTitle(title != null && !title.isEmpty() ? title : "Cursor Remote")
                .setContentText(body != null ? body : "")
                .setStyle(new Notification.BigTextStyle().bigText(body != null ? body : ""))
                .setContentIntent(openAppPending(c, win, null, id))
                .setAutoCancel(true)
                .setOngoing(false)
                .setWhen(when)
                .setShowWhen(true)
                .setCategory(Notification.CATEGORY_MESSAGE)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(false);
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_MAX);
            b.setDefaults(Notification.DEFAULT_ALL);
            b.setSound(sound);
            b.setVibrate(new long[]{0, 160, 80, 160});
        } else {
            b.setSound(sound);
        }
        if ("waiting".equals(kind)) {
            b.addAction(0, tr("批准", "Approve"), openAppPending(c, win, "approve", id + 100000));
            b.addAction(0, tr("跳过", "Skip"), openAppPending(c, win, "skip", id + 200000));
            b.addAction(0, tr("停止", "Stop"), openAppPending(c, win, "stop", id + 300000));
        } else if (done) {
            b.addAction(0, tr("继续", "Continue"), openAppPending(c, win, "continue", id + 400000));
            b.addAction(0, tr("回复", "Reply"), openAppPending(c, win, "reply", id + 500000));
        }
        nm.notify(id, b.build());
        Log.i(TAG, "posted alert kind=" + kind + " id=" + id + " channel=" + channel + " when=" + when);
    }

    /** Delete legacy/silent-stuck channels and recreate loud alert channels. */
    static void resetChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(NOTIFICATION_SERVICE);
        String[] legacy = {
                "events", "listen", "listen_v2", "listen_v3", "listen_v4",
                "agent_done", "agent_done_v2", "agent_done_v3", "agent_done_v4",
                "agent_wait", "agent_wait_v2", "agent_wait_v3", "agent_wait_v4",
        };
        for (String id : legacy) {
            try { nm.deleteNotificationChannel(id); } catch (Exception ignored) {}
        }
        // Recreate immediately so the next notify uses fresh HIGH channels.
        createChannelsStatic(c);
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("cursor-remote", MODE_PRIVATE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannels();
        // Listening channel is quiet — keepalive only; no clock (OpenShouter ignores ongoing / untimed FGS).
        Notification.Builder listenBuilder = builder(CH_LISTEN)
                .setContentTitle(tr("Cursor Remote 正在等待 Agent 的消息", "Cursor Remote is listening for the Agent"))
                .setContentText(tr("Agent 完成或需要你确认时会提醒你", "You'll be alerted when the Agent finishes or needs your OK"))
                .setContentIntent(openAppPending(this, null, null, 0))
                .setOngoing(true)
                .setWhen(0)
                .setShowWhen(false)
                .setCategory(Notification.CATEGORY_SERVICE);
        // Do not call Builder.setSilent — compileSdk 24 lacks it; quietness comes from CH_LISTEN.
        Notification listening = listenBuilder.build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(LISTEN_ID, listening, ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING);
        else startForeground(LISTEN_ID, listening);

        // Keepalive-only: stay sticky in memory; event stream starts when notifications are configured.
        if (!enabled(this)) {
            stopWorker();
            return START_STICKY;
        }
        boolean restart = intent == null || intent.getBooleanExtra("restart", true);
        // Reuse the open SSE stream unless config changed — menu/test setNotify used to kill every alert mid-flight.
        if (restart || worker == null || !running) {
            stopWorker();
            running = true;
            worker = new Thread(this::loop, "cursor-remote-notify");
            worker.start();
        }
        return START_STICKY;
    }

    private void stopWorker() {
        running = false;
        HttpURLConnection c = conn;
        if (c != null) {
            try { c.disconnect(); } catch (Exception ignored) {}
            conn = null;
        }
        if (worker != null) {
            worker.interrupt();
            worker = null;
        }
    }

    @Override
    public void onDestroy() {
        stopWorker();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void loop() {
        long backoff = 2000;
        while (running) {
            try {
                JSONObject cfg = new JSONObject(prefs(this).getString(PREF, "{}"));
                listen(resolveRelay(cfg.getString("app"), cfg.optString("key")), cfg.getString("token"));
                backoff = 2000;
            } catch (Unauthorized e) {
                // Device was removed or needs 2FA again; the app turns this back on after re-pairing.
                prefs(this).edit().remove(PREF).apply();
                stopSelf();
                return;
            } catch (Exception e) {
                if (!running) return;
                try { Thread.sleep(backoff); } catch (InterruptedException ie) { return; }
                backoff = Math.min(backoff * 2, 60000);
            }
        }
    }

    // Same lookup as the web app: url.json on GitHub Pages holds the relay address, AES-GCM encrypted with the paired key.
    private String resolveRelay(String app, String key) throws Exception {
        JSONObject info = new JSONObject(get(app + (app.endsWith("/") ? "" : "/") + "url.json?t=" + System.currentTimeMillis()));
        if (info.optBoolean("self")) {
            Uri u = Uri.parse(app);
            return u.getScheme() + "://" + u.getAuthority();
        }
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        byte[] k = Base64.decode(key, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(k, "AES"), new GCMParameterSpec(128, Base64.decode(info.getString("iv"), Base64.DEFAULT)));
        byte[] plain = c.doFinal(Base64.decode(info.getString("data"), Base64.DEFAULT));
        return new JSONObject(new String(plain, StandardCharsets.UTF_8)).getString("url");
    }

    private static String get(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
        try (InputStream in = c.getInputStream()) {
            return new String(readAll(in), StandardCharsets.UTF_8);
        } finally {
            c.disconnect();
        }
    }

    private static byte[] readAll(InputStream in) throws Exception {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
        return out.toByteArray();
    }

    private void listen(String relay, String token) throws Exception {
        Log.i(TAG, "SSE connecting " + relay + "/api/events");
        HttpURLConnection c = (HttpURLConnection) new URL(relay + "/api/events").openConnection();
        conn = c;
        c.setConnectTimeout(15000);
        // The relay pings every 25 s; silence longer than this means the connection is dead.
        c.setReadTimeout(70000);
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Accept", "text/event-stream");
        try {
            int code = c.getResponseCode();
            if (code == 401) throw new Unauthorized();
            if (code != 200) throw new Exception("HTTP " + code);
            Log.i(TAG, "SSE connected");
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8));
            for (String line; running && (line = r.readLine()) != null; ) {
                if (line.startsWith("data:")) {
                    String raw = line.substring(5).trim();
                    if (raw.isEmpty()) continue;
                    try {
                        show(new JSONObject(raw));
                    } catch (Exception e) {
                        Log.w(TAG, "bad SSE payload: " + e.getMessage());
                    }
                }
            }
        } finally {
            Log.i(TAG, "SSE disconnected");
            c.disconnect();
            conn = null;
        }
    }

    private void show(JSONObject e) {
        postAlert(this,
                e.optString("title", "Cursor Remote"),
                e.optString("body", ""),
                e.optString("kind", ""),
                e.optString("win", ""));
    }

    private static PendingIntent openAppPending(Context c, String win, String action, int requestCode) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (win != null && !win.isEmpty()) i.putExtra("win", win);
        if (action != null && !action.isEmpty()) i.putExtra("notifAction", action);
        return PendingIntent.getActivity(c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification.Builder builder(String channel) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, channel) : new Notification.Builder(this);
        return b.setSmallIcon(R.drawable.ic_notify);
    }

    private void createChannels() {
        createChannelsStatic(this);
    }

    private static void createChannelsStatic(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(NOTIFICATION_SERVICE);
        // Drop silent legacy channels so users aren't stuck with a muted channel from older installs.
        for (String id : new String[]{
                "events", "listen", "listen_v2", "listen_v3",
                "agent_done", "agent_done_v2", "agent_done_v3",
                "agent_wait", "agent_wait_v2", "agent_wait_v3",
        }) {
            try { nm.deleteNotificationChannel(id); } catch (Exception ignored) {}
        }

        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes audio = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        NotificationChannel done = new NotificationChannel(
                CH_DONE,
                tr("Agent 已完成", "Agent finished"),
                NotificationManager.IMPORTANCE_HIGH);
        done.setDescription(tr("Agent 跑完一轮时提醒（带提示音）", "Alert with sound when the Agent finishes a turn"));
        done.enableVibration(true);
        done.setVibrationPattern(new long[]{0, 160, 80, 160});
        done.enableLights(true);
        done.setSound(sound, audio);
        done.setShowBadge(true);
        // Priority/DND on tablets was swallowing Agent alerts (shade + OpenShouter).
        done.setBypassDnd(true);
        nm.createNotificationChannel(done);

        NotificationChannel wait = new NotificationChannel(
                CH_WAIT,
                tr("Agent 等你确认", "Agent needs your OK"),
                NotificationManager.IMPORTANCE_HIGH);
        wait.setDescription(tr("Agent 停在 Run / Allow 时提醒", "Alert when the Agent waits for Run / Allow"));
        wait.enableVibration(true);
        wait.setVibrationPattern(new long[]{0, 220, 100, 220});
        wait.enableLights(true);
        wait.setSound(sound, audio);
        wait.setShowBadge(true);
        wait.setBypassDnd(true);
        nm.createNotificationChannel(wait);

        // LOW (not MIN) — ColorOS/OnePlus put MIN into Aggregate_SilentSection and can demote the whole app.
        NotificationChannel listen = new NotificationChannel(CH_LISTEN, tr("后台连接", "Background connection"), NotificationManager.IMPORTANCE_LOW);
        listen.setShowBadge(false);
        listen.setSound(null, null);
        listen.enableVibration(false);
        nm.createNotificationChannel(listen);
    }

    private static class Unauthorized extends Exception {}
}
