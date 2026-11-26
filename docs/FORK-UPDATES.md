# IspooferMotion pm — installation, updates, and backups

This fork adds a maximize/restore button and a resizable main window (minimum 800 x 500). The displayed name is `IspooferMotion pm`. The app identifier and installer identity stay compatible with V2.

This version uses **manual updates only**. There is no startup update check, automatic update download, updater signing-key requirement, or contact with upstream update releases. Developer heartbeat, crash uploads, remote maintenance requests, community-cache uploads from startup, remote font loads, and Discord release announcements have been removed. Roblox operations, optional user-configured proxies, API health checks, and local diagnostic logs remain. V2 still uses cookies for its existing job workflow.

## What is saved

Normal settings and saved replacement/place-ID mappings already live in app data, separately from the EXE. Installing a newer build over the same V2 installation normally preserves these. Deleting the downloaded installer or a shortcut does not delete app data.

For a separate file you control, use **Settings > Backups > Export backup**. Save `IspooferMotion-pm-data.json` in Documents, a backup drive, or another folder outside the installation directory. This is a readable JSON file, so give it the same privacy as your settings and account names.

The backup contains:

- App settings and account names/IDs/roles.
- Saved original-to-replacement asset ID mappings and per-asset place IDs.
- Theme, accent color, and language.

The backup excludes cookies, API keys, proxy addresses, downloaded assets, place files, logs, live Studio scans, and in-progress jobs. Credentials remain in the OS credential store on Windows/macOS. A JSON backup does not preserve login access. After a full uninstall, credential cleanup, or moving to a different computer, enter credentials again as needed. Keep your downloaded assets and place files separately.

Export again whenever you want to update your backup. The external JSON is a manual snapshot, not an automatically synchronized file. Replacing or deleting the EXE cannot delete a separately saved backup. Uninstalling with data removal or using Reset/Clear app data can erase the app's own saved data, so export first.

## Installing the first customized V2 build

1. Keep V1 installed until you have tested V2 if you want. V1 and V2 are separate apps; this patch does not migrate V1 data automatically.
2. Close V1 and Roblox Studio. Disable/remove the V1 Studio plugin so only the V2 plugin is active.
3. Download the Windows x64 `.exe` from this fork's Releases page after its build succeeds. An upstream installer does not contain these changes.
4. Run the installer. If original V2 is already installed, install over it using the same location.
5. Open the app and reopen Studio. The app syncs its bundled V2 Studio plugin at startup. Confirm only one tool plugin is active.
6. Test on a copy of a place, then export your first JSON backup. Keep V1 data separately until you no longer need it.

## Updating or reinstalling later

1. In the old V2 build, open **Settings > Backups > Export backup** and save the JSON outside the app folder.
2. Finish active jobs and close the app and Studio.
3. Download the newer EXE from **franxxplant13/ISpooferMotion-V2-test > Releases** and run it over the existing V2 installation. You normally do not uninstall first.
4. Open the new version. Your settings should still be present. If they are missing, or this is a fresh installation, use **Settings > Backups > Restore backup** and choose your JSON file.
5. Restore asks for confirmation, replaces the backed-up settings/mappings/account list, and reloads the interface. Finish jobs first. The file is validated before any data is written. Existing secure credentials are not imported from the file; re-enter them if needed.

If you choose to uninstall the old version first, make sure the external JSON backup exists before doing so. V1 does not gain this new V2 backup feature.

## Building and publishing the EXE

No updater keys or signing secrets are needed for this version. Enable GitHub Actions for your fork if GitHub displays an enable-workflows notice. The PR runs source checks when Actions is enabled. Merging into main starts the Windows release build. After all checks and the build succeed, the workflow publishes the installer, bundled Studio plugin, and SHA256SUMS.txt to Releases. The bundled plugin is already included in the installer.

For later updates, increase the versions together, merge the changes, and wait for the new release. You can also run **CI & Release** manually from Actions using the tag matching package.json (initially `v2.8.1`). Merely editing repository files does not update an installed app. This installer can still show Windows SmartScreen's Unknown publisher warning because it does not have a Windows publisher certificate.
