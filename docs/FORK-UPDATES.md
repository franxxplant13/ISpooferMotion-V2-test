# IspooferMotion pm fork

This fork adds a maximize/restore titlebar button and an 800 x 500 minimum window size. The main window can be resized by dragging its borders after restoring it. Maximize fills the available desktop area and keeps normal Windows taskbar behavior. The sidebar and window display `IspooferMotion pm`. App identifiers, credential storage names, and installer product names stay compatible with V2.

The current V2 interface has no active Discord invitation button. No server link was added. The release workflow's upstream Discord announcement job has been removed.

Developer heartbeat, crash uploads, remote maintenance configuration, and community-cache uploads are disabled/removed from the app startup paths. Fonts are bundled locally. Roblox requests, Roblox API health checks, optional user-configured proxies, local diagnostic logs, and GitHub update requests remain. This is not an offline application. V2's cookie requirements have not been converted to API-key-only mode by this change.

## First installation from V1 or original V2

1. Back up any profiles and replacement mappings you need. Do not share credentials in exports.
2. Close V1 and Roblox Studio. Disable/remove the old V1 Studio plugin so only the V2 plugin is active. Keep V1 installed until you have tested the fork if desired. The V1 uninstaller may remove its saved app data.
3. Once a successful fork release exists, download its Windows x64 `.exe` from this fork's Releases page. Do not use an upstream installer to obtain these changes.
4. Run the installer. V1 and V2 have separate app identifiers, so V1 does not automatically upgrade into V2. An original V2 installation requires this manual fork installer once to switch update sources.
5. Open the app, then reopen Studio. The app syncs its bundled V2 plugin to the local Roblox plugin directory at startup. Confirm only one tool plugin is active. Credentials/profiles from V1 are not automatically migrated by this patch.
6. Test on a copy of a place before removing V1. Review account settings before entering credentials. This fork still uses the V2 cookie-based job workflow.

## One-time setup for the repository owner

Tauri update signatures require a private key owned by this fork and its matching public key. Upstream's verification key cannot verify your fork's newly signed updates. Never paste your private key or its password into chat, code, issues, or a pull request.

On your own Windows computer, install Git, Bun and Node.js, clone this fork, check out the change branch, and run these commands in PowerShell from the repository directory:

```powershell
bun install --frozen-lockfile
New-Item -ItemType Directory -Force "$env:USERPROFILE\.tauri" | Out-Null
bun run tauri signer generate -w "$env:USERPROFILE\.tauri\ispoofermotion-pm.key"
```

Keep a secure backup of the generated private key, public key, and chosen password. Do not regenerate the signing key for each release.

In GitHub, open this repository's **Settings > Secrets and variables > Actions**:

- Under **Secrets**, create `TAURI_PRIVATE_KEY` with the complete contents of `ispoofermotion-pm.key`.
- Under **Secrets**, create `TAURI_KEY_PASSWORD` with the password you chose (omit it if the key has no password).
- Under **Variables**, create `TAURI_PUBLIC_KEY` with the complete contents of `ispoofermotion-pm.key.pub`.

The public key can be shared; the private key cannot. This connector cannot configure repository secrets for you.

After configuration, merge the PR. The CI & Release workflow checks the source and builds version 2.8.1 for the fork. It stops before creating a release if signing configuration is missing. Wait for successful build and updater-artifact verification jobs before installing. If necessary, run CI & Release manually with tag `v2.8.1` after fixing setup.

For a manual local release build, run `node scripts/configure-updater.mjs` with `TAURI_PUBLIC_KEY` in the environment and export the standard Tauri `TAURI_SIGNING_PRIVATE_KEY` and optional `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` environment variables before `bun run tauri:build`. The checked-in empty public key deliberately does not trust upstream signatures.

## Future updates

The fork checks only `franxxplant13/ISpooferMotion-V2-test/releases/latest/download/latest.json` when it starts. The splash screen offers Download or Skip. Download installs the matching signed update and requests a restart; failures fall back to the current version. There is no background silent-update timer. The bundled Studio plugin is refreshed on app startup.

For each subsequent release, increase the app versions together, push/merge the changes, and keep the same signing key. CI generates the installers, signatures, and `latest.json`. Merely changing repository files does not update an already installed program.

You can also close the app and run a newer fork installer manually over the same V2 installation. Avoid uninstalling first if you want to keep its data. Backups are still recommended. Tauri updater signatures do not provide a Windows publisher certificate, so SmartScreen may still show Unknown publisher.
