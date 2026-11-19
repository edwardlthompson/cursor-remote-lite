// Thin Windows entrypoint for MSI / portable installs: finds the payload and runs the tray host.
internal static class Program
{
    private static int Main()
    {
        var exeDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var payload = ResolvePayload(exeDir);
        if (payload is null)
        {
            MessageBox.Show(
                $"Could not find the Cursor Remote payload (win-run.mjs + node).\nLooked next to: {exeDir}",
                "Cursor Remote",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }

        var siblingApk = Path.Combine(exeDir, "CursorRemote.apk");
        if (File.Exists(siblingApk))
            Environment.SetEnvironmentVariable("CURSOR_REMOTE_APK", siblingApk);
        else
        {
            var bundledApk = Path.Combine(payload, "CursorRemote.apk");
            if (File.Exists(bundledApk))
                Environment.SetEnvironmentVariable("CURSOR_REMOTE_APK", bundledApk);
        }

        return TrayApp.Run(payload);
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
}
