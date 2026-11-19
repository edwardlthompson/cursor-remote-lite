using System.Diagnostics;
using System.Runtime.InteropServices;

// Thin Windows entrypoint: finds the install / portable payload and runs win-run.mjs with the bundled Node.
internal static class Program
{
    [DllImport("kernel32.dll")]
    private static extern bool AllocConsole();

    private static int Main(string[] args)
    {
        AllocConsole();
        Console.Title = "Cursor Remote";

        var exeDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var payload = ResolvePayload(exeDir);
        if (payload is null)
        {
            Console.Error.WriteLine("Could not find the Cursor Remote payload (win-run.mjs + node).");
            Console.Error.WriteLine($"Looked next to: {exeDir}");
            Console.WriteLine("Press Enter to close…");
            Console.ReadLine();
            return 1;
        }

        var node = Path.Combine(payload, "node", "node.exe");
        var entry = Path.Combine(payload, "win-run.mjs");
        if (!File.Exists(node) || !File.Exists(entry))
        {
            Console.Error.WriteLine($"Incomplete install under {payload}");
            Console.WriteLine("Press Enter to close…");
            Console.ReadLine();
            return 1;
        }

        // Prefer an APK sitting next to the downloaded EXE (same folder the user dropped both into).
        var siblingApk = Path.Combine(exeDir, "CursorRemote.apk");
        if (File.Exists(siblingApk))
            Environment.SetEnvironmentVariable("CURSOR_REMOTE_APK", siblingApk);
        else
        {
            var bundledApk = Path.Combine(payload, "CursorRemote.apk");
            if (File.Exists(bundledApk))
                Environment.SetEnvironmentVariable("CURSOR_REMOTE_APK", bundledApk);
        }

        var psi = new ProcessStartInfo
        {
            FileName = node,
            Arguments = Quote(entry),
            WorkingDirectory = payload,
            UseShellExecute = false,
        };
        psi.Environment["PATH"] = Path.Combine(payload, "node") + Path.PathSeparator
            + Path.Combine(payload, "tools") + Path.PathSeparator
            + Environment.GetEnvironmentVariable("PATH");

        try
        {
            using var p = Process.Start(psi);
            if (p is null) return 1;
            p.WaitForExit();
            return p.ExitCode;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            Console.WriteLine("Press Enter to close…");
            Console.ReadLine();
            return 1;
        }
    }

    private static string? ResolvePayload(string exeDir)
    {
        foreach (var candidate in new[]
        {
            exeDir,
            Path.Combine(exeDir, "payload"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CursorRemoteLite"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Cursor Remote Lite"),
        })
        {
            if (File.Exists(Path.Combine(candidate, "win-run.mjs")))
                return candidate;
        }
        return null;
    }

    private static string Quote(string path) => "\"" + path.Replace("\"", "\\\"") + "\"";
}
