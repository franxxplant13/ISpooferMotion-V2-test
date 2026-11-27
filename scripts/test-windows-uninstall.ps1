$ErrorActionPreference = 'Stop'
$installer = (Get-ChildItem 'src-tauri/target/release/bundle/nsis/*.exe' | Select-Object -First 1).FullName
$installDir = Join-Path $env:RUNNER_TEMP 'ISpooferMotion-Pm-Uninstall-Test'
$roaming = Join-Path $env:APPDATA 'ISpooferMotion-V2'
$local = Join-Path $env:LOCALAPPDATA 'ISpooferMotion-V2'
$plugins = Join-Path $env:LOCALAPPDATA 'Roblox/Plugins'
$cookieTemp = Join-Path ([IO.Path]::GetTempPath()) 'ispoofermotion-cookie-0123456789abcdef'
$apiTemp = Join-Path ([IO.Path]::GetTempPath()) 'ispoofer_api_dump_v2.json'
$externalBackup = Join-Path $env:RUNNER_TEMP 'pm-external-backup.json'

function Install-App {
  $process = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
  if (!(Test-Path (Join-Path $installDir 'app.exe'))) { throw 'Installed app.exe is missing.' }
}
function Uninstall-App([string[]]$Options) {
  $process = Start-Process -FilePath (Join-Path $installDir 'uninstall.exe') -ArgumentList $Options -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Uninstaller failed: $($process.ExitCode)" }
  for ($i = 0; $i -lt 40; $i++) {
    if (!(Test-Path (Join-Path $installDir 'app.exe'))) { return }
    Start-Sleep -Milliseconds 250
  }
  throw 'Uninstaller did not remove app.exe.'
}

# This script runs only on a disposable GitHub-hosted Windows runner, never on the user's PC.
if (!$env:GITHUB_ACTIONS -or !$env:RUNNER_TEMP) { throw 'This smoke test is restricted to GitHub Actions.' }
Install-App
New-Item -ItemType Directory -Force $roaming, $local, $plugins, $cookieTemp | Out-Null
Set-Content (Join-Path $roaming 'settings-test.json') 'test-only-settings'
Set-Content (Join-Path $local 'cache-test.txt') 'test-only-cache'
Set-Content (Join-Path $plugins 'ISpooferMotion.rbxmx') 'test-only-plugin'
Set-Content (Join-Path $plugins 'KeepOtherPlugin.rbxmx') 'keep'
Set-Content (Join-Path $cookieTemp 'Cookies.sqlite') 'test-only-placeholder'
Set-Content $apiTemp 'test-only-cache'
Set-Content $externalBackup 'keep'

# Both an upgrade and a normal keep-data uninstall must preserve user data.
Uninstall-App @('/S', '/UPDATE', '/CLEAN')
if (!(Test-Path (Join-Path $roaming 'settings-test.json'))) { throw 'Update erased saved data.' }
Install-App
Uninstall-App @('/S')
if (!(Test-Path (Join-Path $roaming 'settings-test.json'))) { throw 'Keep-data uninstall erased settings.' }
Install-App
Uninstall-App @('/S', '/CLEAN')
foreach ($path in @($roaming, $local, (Join-Path $plugins 'ISpooferMotion.rbxmx'), $cookieTemp, $apiTemp)) {
  if (Test-Path $path) { throw "Full cleanup left an owned path: $path" }
}
if (!(Test-Path (Join-Path $plugins 'KeepOtherPlugin.rbxmx'))) { throw 'Unrelated plugin was deleted.' }
if (!(Test-Path $externalBackup)) { throw 'External backup was deleted.' }
Write-Output 'Windows install/update/keep-data/full-cleanup smoke tests passed.'
