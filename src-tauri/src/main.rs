#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(windows)]
    if std::env::args_os().nth(1).as_deref() == Some(std::ffi::OsStr::new("--cleanup-for-uninstall")) {
        match app_lib::cleanup::uninstall_cleanup() {
            Ok(()) => std::process::exit(0),
            Err(error) => {
                eprintln!("Cleanup failed: {error}");
                std::process::exit(1);
            }
        }
    }
    app_lib::run();
}
