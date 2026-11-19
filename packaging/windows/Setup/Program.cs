using System.IO.Compression;
using System.Reflection;

// Self-extracting CursorRemote.exe: unpack payload to LocalAppData, then run the tray host.
internal static class Program
{
    private static int Main()
    {
        var target = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CursorRemoteLite");
        Directory.CreateDirectory(target);
        var stamp = Path.Combine(target, ".version");
        const string want = "1.8.0";
        var needExtract = !File.Exists(Path.Combine(target, "win-run.mjs"))
            || !File.Exists(stamp)
            || File.ReadAllText(stamp).Trim() != want;

        if (needExtract)
        {
            // Brief console only while extracting so first-run isn't silent forever.
            AllocConsoleSafe();
            Console.WriteLine("Extracting Cursor Remote 1.8.0…");
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip")
                ?? throw new InvalidOperationException("Embedded payload.zip missing");
            var tmp = Path.Combine(Path.GetTempPath(), "CursorRemote-" + Guid.NewGuid().ToString("N") + ".zip");
            using (var fs = File.Create(tmp)) stream.CopyTo(fs);

            foreach (var path in Directory.GetFileSystemEntries(target))
            {
                try
                {
                    if (File.Exists(path)) File.Delete(path);
                    else Directory.Delete(path, true);
                }
                catch { /* in use */ }
            }
            Directory.CreateDirectory(target);
            ZipFile.ExtractToDirectory(tmp, target, true);
            File.WriteAllText(stamp, want + Environment.NewLine);
            try { File.Delete(tmp); } catch { }
        }

        var exeDir = Path.GetDirectoryName(Environment.ProcessPath) ?? AppContext.BaseDirectory;
        var sibling = Path.Combine(exeDir, "CursorRemote.apk");
        if (File.Exists(sibling))
            Environment.SetEnvironmentVariable("CURSOR_REMOTE_APK", sibling);
        else
        {
            var bundled = Path.Combine(target, "CursorRemote.apk");
            if (File.Exists(bundled))
                Environment.SetEnvironmentVariable("CURSOR_REMOTE_APK", bundled);
        }

        return TrayApp.Run(target);
    }

    [System.Runtime.InteropServices.DllImport("kernel32.dll")]
    private static extern bool AllocConsole();

    private static void AllocConsoleSafe()
    {
        try { AllocConsole(); } catch { /* */ }
    }
}
