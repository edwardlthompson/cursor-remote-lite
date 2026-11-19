using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;

internal static class Program
{
    [DllImport("kernel32.dll")]
    private static extern bool AllocConsole();

    private static int Main(string[] args)
    {
        AllocConsole();
        Console.Title = "Cursor Remote";

        var target = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CursorRemoteLite");
        Directory.CreateDirectory(target);
        var stamp = Path.Combine(target, ".version");
        const string want = "1.7.0";
        var needExtract = !File.Exists(Path.Combine(target, "win-run.mjs"))
            || !File.Exists(stamp)
            || File.ReadAllText(stamp).Trim() != want;

        if (needExtract)
        {
            Console.WriteLine("Extracting Cursor Remote 1.7.0…");
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

        var node = Path.Combine(target, "node", "node.exe");
        var entry = Path.Combine(target, "win-run.mjs");
        if (!File.Exists(node) || !File.Exists(entry))
        {
            Console.Error.WriteLine("Install payload incomplete under " + target);
            Console.WriteLine("Press Enter to close…");
            Console.ReadLine();
            return 1;
        }

        var psi = new ProcessStartInfo
        {
            FileName = node,
            Arguments = "\"" + entry.Replace("\"", "\\\"") + "\"",
            WorkingDirectory = target,
            UseShellExecute = false,
        };
        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        psi.Environment["PATH"] = Path.Combine(target, "node") + Path.PathSeparator
            + Path.Combine(target, "tools") + Path.PathSeparator
            + pathEnv;

        using var p = Process.Start(psi);
        if (p is null) return 1;
        p.WaitForExit();
        return p.ExitCode;
    }
}
