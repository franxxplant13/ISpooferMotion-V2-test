//! Headless uninstall support. Must run before Tauri, logging, or WebView starts.
use std::path::Path;

fn remove_owned_path(path: &Path) -> std::io::Result<()> {
    match std::fs::symlink_metadata(path) {
        Ok(metadata) => {
            // Do not traverse redirected directories (including Windows junctions).
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 {
                return Err(std::io::Error::other("Refusing to follow a redirected cleanup path"));
            }
            if metadata.is_dir() {
                let mut result = std::fs::remove_dir_all(path);
                for _ in 0..20 {
                    if result.is_ok() || !path.exists() { return Ok(()); }
                    std::thread::sleep(std::time::Duration::from_millis(250));
                    result = std::fs::remove_dir_all(path);
                }
                result
            } else {
                std::fs::remove_file(path)
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

fn is_cookie_temp_name(name: &str) -> bool {
    name.strip_prefix("ispoofermotion-cookie-").is_some_and(|suffix| {
        suffix.len() == 16 && suffix.bytes().all(|byte| byte.is_ascii_hexdigit())
    })
}

/// Called only by the full-data-removal uninstaller path, never by normal startup.
pub fn uninstall_cleanup() -> Result<(), String> {
    let mut errors = Vec::new();
    if let Err(error) = crate::commands::ipc::secrets::clear_all_stored_credentials() {
        errors.push(error.to_string());
    }
    for dir in crate::commands::startup::roblox_plugins_dirs() {
        match std::fs::read_dir(&dir) {
            Ok(entries) => {
                for entry in entries {
                    match entry {
                        Ok(entry) => {
                            if entry.file_name().to_str().is_some_and(crate::commands::startup::is_owned_plugin_file_name) {
                                if let Err(error) = std::fs::remove_file(entry.path()) {
                                    errors.push(format!("Plugin cleanup failed: {error}"));
                                }
                            }
                        }
                        Err(error) => errors.push(error.to_string()),
                    }
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => errors.push(error.to_string()),
        }
    }
    let temp = std::env::temp_dir();
    if let Err(error) = remove_owned_path(&temp.join("ispoofer_api_dump_v2.json")) {
        errors.push(error.to_string());
    }
    match std::fs::read_dir(temp) {
        Ok(entries) => {
            for entry in entries {
                match entry {
                    Ok(entry) => {
                        if entry.file_name().to_str().is_some_and(is_cookie_temp_name) {
                            if let Err(error) = remove_owned_path(&entry.path()) {
                                errors.push(format!("Temporary file cleanup failed: {error}"));
                            }
                        }
                    }
                    Err(error) => errors.push(error.to_string()),
                }
            }
        }
        Err(error) => errors.push(error.to_string()),
    }
    // These are the same known-folder resolvers Tauri uses on Windows. The runtime
    // is never initialized here, so it cannot recreate logs or locked WebView data.
    for root in [dirs::data_dir(), dirs::data_local_dir()] {
        match root {
            Some(root) => {
                if let Err(error) = remove_owned_path(&root.join("ISpooferMotion-V2")) {
                    errors.push(format!("App data cleanup failed: {error}"));
                }
            }
            None => errors.push("Could not resolve this user's app data directory".to_string()),
        }
    }
    if errors.is_empty() { Ok(()) } else { Err(errors.join("\n")) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn temporary_cookie_match_is_narrow() {
        assert!(is_cookie_temp_name("ispoofermotion-cookie-0123456789abcdef"));
        assert!(!is_cookie_temp_name("ispoofermotion-cookie-backup"));
        assert!(!is_cookie_temp_name("roblox-cookie-0123456789abcdef"));
        assert!(!is_cookie_temp_name("ispoofermotion-cookie-0123456789abcdef-extra"));
    }
}
