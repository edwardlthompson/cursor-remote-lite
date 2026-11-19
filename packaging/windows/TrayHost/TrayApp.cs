using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32;

/// <summary>
/// System-tray host for Cursor Remote on Windows: keeps win-run/relay alive without a console,
/// manages HKCU autostart and optional sleep-inhibit.
/// </summary>
internal sealed class TrayApp : ApplicationContext
{
    private const string MutexName = @"Local\CursorRemoteLiteTray";
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string RunValueName = "CursorRemoteLite";
    private const string PrefsName = "tray.json";

    private readonly string _payloadDir;
    private readonly string _dataDir;
    private readonly NotifyIcon _icon;
    private readonly ToolStripMenuItem _autostartItem;
    private readonly ToolStripMenuItem _keepAwakeItem;
    private readonly ToolStripMenuItem _statusItem;
    private Process? _launcher;
    private bool _keepAwake;
    private bool _exiting;
    private readonly System.Windows.Forms.Timer _statusTimer;

    [DllImport("kernel32.dll")]
    private static extern uint SetThreadExecutionState(uint esFlags);

    private const uint ES_CONTINUOUS = 0x80000000;
    private const uint ES_SYSTEM_REQUIRED = 0x00000001;
    private const uint ES_AWAYMODE_REQUIRED = 0x00000040;

    public static int Run(string payloadDir)
    {
        using var mutex = new Mutex(true, MutexName, out var created);
        if (!created)
        {
            MessageBox.Show(
                "Cursor Remote is already running in the system tray.",
                "Cursor Remote",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return 0;
        }

        ApplicationConfiguration.Initialize();
        Application.Run(new TrayApp(payloadDir));
        return 0;
    }

    private TrayApp(string payloadDir)
    {
        _payloadDir = payloadDir;
        _dataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".cursor-remote-lite");
        Directory.CreateDirectory(_dataDir);

        var prefs = LoadPrefs();
        _keepAwake = prefs.KeepAwake;

        _statusItem = new ToolStripMenuItem("Starting…") { Enabled = false };
        _autostartItem = new ToolStripMenuItem("Start with Windows")
        {
            CheckOnClick = true,
            Checked = prefs.Autostart || !prefs.Initialized,
        };
        _autostartItem.CheckedChanged += (_, _) =>
        {
            SetAutostart(_autostartItem.Checked);
            SavePrefs();
        };
        _keepAwakeItem = new ToolStripMenuItem("Keep PC awake while running")
        {
            CheckOnClick = true,
            Checked = _keepAwake,
        };
        _keepAwakeItem.CheckedChanged += (_, _) =>
        {
            _keepAwake = _keepAwakeItem.Checked;
            ApplyKeepAwake();
            SavePrefs();
        };

        var menu = new ContextMenuStrip();
        menu.Items.Add(_statusItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Open relay log", null, (_, _) => OpenLog());
        menu.Items.Add("Pair over ADB", null, (_, _) => PairAdb());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(_autostartItem);
        menu.Items.Add(_keepAwakeItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit", null, (_, _) => Quit());

        _icon = new NotifyIcon
        {
            Icon = SystemIcons.Application,
            Text = "Cursor Remote",
            Visible = true,
            ContextMenuStrip = menu,
        };
        _icon.DoubleClick += (_, _) => OpenLog();

        if (!prefs.Initialized)
        {
            SetAutostart(true);
            prefs = prefs with { Initialized = true, Autostart = true };
            SavePrefs(prefs);
            _icon.ShowBalloonTip(
                5000,
                "Cursor Remote",
                "Running in the tray. Start with Windows is on — change it from the tray menu anytime.",
                ToolTipIcon.Info);
        }
        else if (prefs.Autostart != IsAutostartEnabled())
        {
            SetAutostart(prefs.Autostart);
            _autostartItem.Checked = prefs.Autostart;
        }

        ApplyKeepAwake();
        StartLauncher();

        _statusTimer = new System.Windows.Forms.Timer { Interval = 4000 };
        _statusTimer.Tick += (_, _) => RefreshStatus();
        _statusTimer.Start();
        RefreshStatus();
    }

    private void StartLauncher()
    {
        var node = Path.Combine(_payloadDir, "node", "node.exe");
        var entry = Path.Combine(_payloadDir, "win-run.mjs");
        if (!File.Exists(node) || !File.Exists(entry))
        {
            _statusItem.Text = "Payload incomplete";
            _icon.ShowBalloonTip(8000, "Cursor Remote", "Install payload incomplete.", ToolTipIcon.Error);
            return;
        }

        StopLauncher();

        var psi = new ProcessStartInfo
        {
            FileName = node,
            Arguments = Quote(entry) + " --hidden",
            WorkingDirectory = _payloadDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        psi.Environment["PATH"] = Path.Combine(_payloadDir, "node") + Path.PathSeparator
            + Path.Combine(_payloadDir, "tools") + Path.PathSeparator
            + pathEnv;
        psi.Environment["CURSOR_REMOTE_TRAY"] = "1";

        try
        {
            _launcher = Process.Start(psi);
            if (_launcher is not null)
                File.WriteAllText(Path.Combine(_dataDir, "tray-launcher.pid"), _launcher.Id.ToString());
        }
        catch (Exception ex)
        {
            _statusItem.Text = "Failed to start";
            _icon.ShowBalloonTip(8000, "Cursor Remote", ex.Message, ToolTipIcon.Error);
        }
    }

    private void RefreshStatus()
    {
        if (_exiting) return;
        var relayUp = PortOpen(3939);
        var cdpUp = PortOpen(9222);
        var alive = _launcher is { HasExited: false };
        _statusItem.Text = alive
            ? (relayUp ? "Relay running" : "Starting relay…")
              + (cdpUp ? " · CDP ok" : " · Cursor CDP?")
            : "Stopped";
        _icon.Text = "Cursor Remote — " + _statusItem.Text;
        if (!alive && !_exiting)
        {
            // Unexpected exit — restart once quietly.
            StartLauncher();
        }
    }

    private static bool PortOpen(int port)
    {
        try
        {
            using var c = new System.Net.Sockets.TcpClient();
            var ar = c.BeginConnect("127.0.0.1", port, null, null);
            var ok = ar.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(200));
            if (!ok) return false;
            c.EndConnect(ar);
            return true;
        }
        catch { return false; }
    }

    private void OpenLog()
    {
        var log = Path.Combine(_dataDir, "relay.log");
        if (!File.Exists(log)) File.WriteAllText(log, "");
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "notepad.exe",
                Arguments = Quote(log),
                UseShellExecute = true,
            });
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Cursor Remote");
        }
    }

    private void PairAdb()
    {
        var node = Path.Combine(_payloadDir, "node", "node.exe");
        var entry = Path.Combine(_payloadDir, "adb-pair.mjs");
        if (!File.Exists(node) || !File.Exists(entry))
        {
            MessageBox.Show("adb-pair.mjs missing from payload.", "Cursor Remote");
            return;
        }
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = node,
                Arguments = Quote(entry),
                WorkingDirectory = _payloadDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            psi.Environment["PATH"] = Path.Combine(_payloadDir, "node") + Path.PathSeparator
                + Path.Combine(_payloadDir, "tools") + Path.PathSeparator
                + (Environment.GetEnvironmentVariable("PATH") ?? "");
            var p = Process.Start(psi);
            if (p is null) return;
            var output = p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd();
            p.WaitForExit(120000);
            var clip = output.Length > 500 ? output[^500..] : output;
            _icon.ShowBalloonTip(8000, "ADB pair", string.IsNullOrWhiteSpace(clip) ? "Finished." : clip.Trim(), ToolTipIcon.Info);
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Cursor Remote");
        }
    }

    private void ApplyKeepAwake()
    {
        if (_keepAwake)
            SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED);
        else
            SetThreadExecutionState(ES_CONTINUOUS);
    }

    private void SetAutostart(bool enabled)
    {
        var exe = Environment.ProcessPath;
        if (string.IsNullOrEmpty(exe)) return;
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true)
            ?? Registry.CurrentUser.CreateSubKey(RunKeyPath);
        if (enabled)
            key.SetValue(RunValueName, Quote(exe));
        else
            key.DeleteValue(RunValueName, throwOnMissingValue: false);
    }

    private static bool IsAutostartEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: false);
        return key?.GetValue(RunValueName) is string;
    }

    private Prefs LoadPrefs()
    {
        var path = Path.Combine(_dataDir, PrefsName);
        try
        {
            var json = File.ReadAllText(path);
            var autostart = json.Contains("\"autostart\": true", StringComparison.OrdinalIgnoreCase)
                || json.Contains("\"autostart\":true", StringComparison.OrdinalIgnoreCase);
            var keep = !json.Contains("\"keepAwake\": false", StringComparison.OrdinalIgnoreCase)
                && !json.Contains("\"keepAwake\":false", StringComparison.OrdinalIgnoreCase);
            var init = json.Contains("\"initialized\": true", StringComparison.OrdinalIgnoreCase)
                || json.Contains("\"initialized\":true", StringComparison.OrdinalIgnoreCase);
            return new Prefs(init, autostart || !init, keep);
        }
        catch
        {
            return new Prefs(false, true, true);
        }
    }

    private void SavePrefs() => SavePrefs(new Prefs(true, _autostartItem.Checked, _keepAwake));

    private void SavePrefs(Prefs p)
    {
        var path = Path.Combine(_dataDir, PrefsName);
        File.WriteAllText(path,
            "{\n  \"initialized\": true,\n  \"autostart\": " + (p.Autostart ? "true" : "false")
            + ",\n  \"keepAwake\": " + (p.KeepAwake ? "true" : "false") + "\n}\n");
    }

    private void Quit()
    {
        _exiting = true;
        _statusTimer.Stop();
        StopLauncher();
        KillPidFile("relay.pid");
        KillPidFile("tray-launcher.pid");
        SetThreadExecutionState(ES_CONTINUOUS);
        _icon.Visible = false;
        _icon.Dispose();
        ExitThread();
    }

    private void StopLauncher()
    {
        try
        {
            if (_launcher is { HasExited: false })
            {
                _launcher.Kill(entireProcessTree: true);
                _launcher.WaitForExit(5000);
            }
        }
        catch { /* already gone */ }
        _launcher = null;
    }

    private void KillPidFile(string name)
    {
        var path = Path.Combine(_dataDir, name);
        try
        {
            if (!File.Exists(path)) return;
            if (!int.TryParse(File.ReadAllText(path).Trim(), out var pid)) return;
            using var p = Process.GetProcessById(pid);
            p.Kill(entireProcessTree: true);
        }
        catch { /* missing / access */ }
        try { File.Delete(path); } catch { }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _exiting = true;
            _statusTimer.Dispose();
            StopLauncher();
            SetThreadExecutionState(ES_CONTINUOUS);
            _icon.Dispose();
        }
        base.Dispose(disposing);
    }

    private static string Quote(string path) => "\"" + path.Replace("\"", "\\\"") + "\"";

    private readonly record struct Prefs(bool Initialized, bool Autostart, bool KeepAwake);
}
