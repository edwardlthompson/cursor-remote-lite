# Build CursorRemote.exe (self-extracting) and CursorRemote.msi, optionally bundling the companion APK.
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\packaging\windows\build.ps1 [-ApkPath path] [-Version 1.6.0]
param(
  [string]$ApkPath = '',
  [string]$Version = '1.8.0',
  [switch]$SkipMsi
)

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Out = Join-Path $Root 'packaging\out'
$Payload = Join-Path $Out 'payload'
$Stage = Join-Path $Out 'stage'

Write-Host "== Building Cursor Remote Windows packages v$Version =="
Write-Host "Repo: $Root"

# Preserve companion APK across the clean of packaging/out.
$apkStash = $null
if ($ApkPath -and (Test-Path $ApkPath)) {
  $apkStash = Join-Path $env:TEMP ("CursorRemote-stash-" + [Guid]::NewGuid().ToString('N') + '.apk')
  Copy-Item -Force $ApkPath $apkStash
  $ApkPath = $apkStash
} elseif (Test-Path (Join-Path $Out 'CursorRemote.apk')) {
  $apkStash = Join-Path $env:TEMP ("CursorRemote-stash-" + [Guid]::NewGuid().ToString('N') + '.apk')
  Copy-Item -Force (Join-Path $Out 'CursorRemote.apk') $apkStash
  $ApkPath = $apkStash
}

Remove-Item -Recurse -Force $Out -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Payload, $Stage | Out-Null

# --- Portable Node.js ---
$NodeVer = 'v22.14.0'
$NodeZip = Join-Path $Out "node-$NodeVer-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/$NodeVer/node-$NodeVer-win-x64.zip"
Write-Host "Downloading Node $NodeVer…"
Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
Expand-Archive -Path $NodeZip -DestinationPath $Out -Force
$NodeExtracted = Join-Path $Out "node-$NodeVer-win-x64"
New-Item -ItemType Directory -Force -Path (Join-Path $Payload 'node') | Out-Null
Copy-Item -Recurse -Force (Join-Path $NodeExtracted '*') (Join-Path $Payload 'node')

# --- App files ---
$copyFiles = @(
  'server.mjs', 'auth.mjs', 'devices.mjs', 'files.mjs', 'notify.mjs', 'setup.mjs', 'twofa.mjs',
  'adb-pair.mjs', 'win-run.mjs', 'headless.mjs', 'telegram.mjs', 'presence.mjs', 'sync-app.mjs',
  'package.json', 'package-lock.json',
  'start-cursor.ps1', 'setup-windows.ps1', 'LICENSE', 'README.md', 'README.en.md'
)
foreach ($f in $copyFiles) {
  $src = Join-Path $Root $f
  if (Test-Path $src) { Copy-Item -Force $src (Join-Path $Payload $f) }
}
Copy-Item -Recurse -Force (Join-Path $Root 'app') (Join-Path $Payload 'app')

# --- npm install with portable node ---
$NpmCmd = Join-Path $Payload 'node\npm.cmd'
Write-Host 'npm install (payload)…'
Push-Location $Payload
try {
  & $NpmCmd install --omit=dev
  if ($LASTEXITCODE -ne 0) { throw "npm install failed ($LASTEXITCODE)" }
} finally { Pop-Location }

# --- cloudflared ---
$Tools = Join-Path $Payload 'tools'
New-Item -ItemType Directory -Force -Path $Tools | Out-Null
Write-Host 'Downloading cloudflared…'
Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' `
  -OutFile (Join-Path $Tools 'cloudflared.exe')

# --- Companion APK ---
if (-not $ApkPath) {
  foreach ($c in @(
    (Join-Path $Root 'CursorRemote.apk'),
    (Join-Path $Root 'packaging\out\CursorRemote.apk'),
    (Join-Path $Root 'android\app\build\outputs\apk\release\app-release-unsigned.apk')
  )) {
    if (Test-Path $c) { $ApkPath = $c; break }
  }
}
if ($ApkPath -and (Test-Path $ApkPath)) {
  Copy-Item -Force $ApkPath (Join-Path $Payload 'CursorRemote.apk')
  $outApk = Join-Path $Out 'CursorRemote.apk'
  $srcFull = (Resolve-Path $ApkPath).Path
  if (-not (Test-Path $outApk) -or (Resolve-Path $outApk).Path -ne $srcFull) {
    Copy-Item -Force $ApkPath $outApk
  }
  Write-Host "Bundled APK: $ApkPath"
} else {
  Write-Host 'No APK bundled (pass -ApkPath). Drop CursorRemote.apk next to the EXE for auto ADB install.'
}

# Portable zip: flat payload (win-run.mjs at root)
$PortableZip = Join-Path $Out "CursorRemote-$Version-win-x64.zip"
if (Test-Path $PortableZip) { Remove-Item $PortableZip -Force }
Compress-Archive -Path (Join-Path $Payload '*') -DestinationPath $PortableZip
Write-Host "Wrote $PortableZip"

# --- Self-extracting CursorRemote.exe (tray host) ---
$SetupDir = Join-Path $PSScriptRoot 'Setup'
$TrayDir = Join-Path $PSScriptRoot 'TrayHost'
New-Item -ItemType Directory -Force -Path $SetupDir | Out-Null

$Csproj = Join-Path $SetupDir 'CursorRemote.Setup.csproj'
$TrayAppSrc = (Join-Path $TrayDir 'TrayApp.cs').Replace('\', '\\')
$ZipLiteral = $PortableZip.Replace('\', '\\')
@"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>CursorRemote</AssemblyName>
    <Version>$Version</Version>
    <PublishSingleFile>true</PublishSingleFile>
    <SelfContained>true</SelfContained>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
    <EnableCompressionInSingleFile>true</EnableCompressionInSingleFile>
    <DebugType>none</DebugType>
  </PropertyGroup>
  <ItemGroup>
    <EmbeddedResource Include="$ZipLiteral" LogicalName="payload.zip" />
    <Compile Include="$TrayAppSrc" Link="TrayApp.cs" />
  </ItemGroup>
</Project>
"@ | Set-Content -Encoding UTF8 $Csproj

@"
using System.IO.Compression;
using System.Reflection;

internal static class Program
{
    private static int Main()
    {
        var target = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CursorRemoteLite");
        Directory.CreateDirectory(target);
        var stamp = Path.Combine(target, ".version");
        const string want = "$Version";
        var needExtract = !File.Exists(Path.Combine(target, "win-run.mjs"))
            || !File.Exists(stamp)
            || File.ReadAllText(stamp).Trim() != want;

        if (needExtract)
        {
            AllocConsoleSafe();
            Console.WriteLine("Extracting Cursor Remote $Version…");
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
        try { AllocConsole(); } catch { }
    }
}
"@ | Set-Content -Encoding UTF8 (Join-Path $SetupDir 'Program.cs')

$SetupOut = Join-Path $Out 'setup-build'
Write-Host 'Publishing self-extracting CursorRemote.exe (tray)…'
dotnet publish $Csproj -c Release -r win-x64 --self-contained true -p:Version=$Version -o $SetupOut
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed' }
$ExePath = Join-Path $Out 'CursorRemote.exe'
Copy-Item -Force (Join-Path $SetupOut 'CursorRemote.exe') $ExePath
Write-Host "Wrote $ExePath"

# --- MSI wraps the EXE into Program Files ---
if (-not $SkipMsi) {
  Write-Host 'Ensuring WiX 5…'
  # Pin v5: WiX 7 requires an OSMF EULA accept step that breaks non-interactive CI.
  dotnet tool uninstall --global wix 2>$null | Out-Null
  dotnet tool install --global wix --version 5.0.2
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [System.Environment]::GetEnvironmentVariable('Path', 'User')

  $WixDir = Join-Path $PSScriptRoot 'Wix'
  New-Item -ItemType Directory -Force -Path $WixDir | Out-Null
  $Wxs = Join-Path $WixDir 'Product.wxs'

  @"
<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <Package Name="Cursor Remote Lite" Manufacturer="Cursor Remote" Version="$Version"
           UpgradeCode="A7C3E9F1-4B2D-4E8A-9C1F-8D6E5B4A3210" Scope="perMachine">
    <MajorUpgrade DowngradeErrorMessage="A newer version is already installed." />
    <MediaTemplate EmbedCab="yes" />
    <Feature Id="Main" Title="Cursor Remote" Level="1">
      <ComponentRef Id="MainExe" />
      <ComponentRef Id="AppShortcut" />
      <ComponentRef Id="AutostartHint" />
    </Feature>
    <StandardDirectory Id="ProgramFiles64Folder">
      <Directory Id="INSTALLFOLDER" Name="Cursor Remote Lite" />
    </StandardDirectory>
    <StandardDirectory Id="ProgramMenuFolder">
      <Directory Id="AppMenu" Name="Cursor Remote Lite" />
    </StandardDirectory>
    <DirectoryRef Id="INSTALLFOLDER">
      <Component Id="MainExe" Guid="C0FFEE00-1234-4ABC-9DEF-0123456789AB">
        <File Id="CursorRemoteExe" Source="$ExePath" Name="CursorRemote.exe" KeyPath="yes" />
      </Component>
    </DirectoryRef>
    <DirectoryRef Id="AppMenu">
      <Component Id="AppShortcut" Guid="B1C2D3E4-F5A6-7890-ABCD-EF1234567890">
        <Shortcut Id="StartMenuShortcut" Name="Cursor Remote" Description="Control desktop Cursor from your phone"
                  Target="[INSTALLFOLDER]CursorRemote.exe" WorkingDirectory="INSTALLFOLDER" />
        <RemoveFolder Id="RemoveAppMenu" Directory="AppMenu" On="uninstall" />
        <RegistryValue Root="HKCU" Key="Software\CursorRemoteLite" Name="installed" Type="integer" Value="1" KeyPath="yes" />
      </Component>
    </DirectoryRef>
    <!-- First-run tray also writes this; MSI seeds Start-with-Windows so reboot keeps the relay. -->
    <DirectoryRef Id="INSTALLFOLDER">
      <Component Id="AutostartHint" Guid="A1B2C3D4-E5F6-7890-ABCD-EF1234567891">
        <RegistryValue Root="HKCU" Key="Software\Microsoft\Windows\CurrentVersion\Run"
                       Name="CursorRemoteLite" Type="string" Value="&quot;[INSTALLFOLDER]CursorRemote.exe&quot;" KeyPath="yes" />
      </Component>
    </DirectoryRef>
  </Package>
</Wix>
"@ | Set-Content -Encoding UTF8 $Wxs

  $MsiPath = Join-Path $Out 'CursorRemote.msi'
  Write-Host 'Building MSI…'
  wix build $Wxs -o $MsiPath
  if ($LASTEXITCODE -ne 0) { throw 'wix build failed' }
  Write-Host "Wrote $MsiPath"
}

Write-Host ''
Write-Host 'Artifacts:'
Get-ChildItem $Out -File | Where-Object { $_.Extension -match '\.(exe|msi|apk|zip)$' } | ForEach-Object {
  Write-Host ("  {0,14:N0}  {1}" -f $_.Length, $_.Name)
}
Write-Host 'Done.'
