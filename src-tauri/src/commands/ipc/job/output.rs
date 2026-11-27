use std::io;
use std::path::{Path, PathBuf};

pub(super) fn component(label: &str) -> String {
    let clean: String = label.trim().chars().take(60).map(|c| {
        if c.is_alphanumeric() || matches!(c, ' ' | '-' | '_') { c } else { '_' }
    }).collect();
    let clean = clean.trim();
    if clean.is_empty() { "Unnamed".into() } else { clean.into() }
}

pub(super) fn create_session(root: &Path, place: &str) -> io::Result<PathBuf> {
    std::fs::create_dir_all(root)?;
    let name = component(place);
    for number in 1_u64.. {
        let dir = root.join(format!("{name} - Session {number:03}"));
        match std::fs::create_dir(&dir) {
            Ok(()) => return Ok(dir),
            Err(err) if err.kind() == io::ErrorKind::AlreadyExists => {}
            Err(err) => return Err(err),
        }
    }
    Err(io::Error::other("No available session number"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sessions_are_distinct_and_confined_to_the_chosen_directory() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let first = create_session(&root, "../Example").expect("first session");
        let second = create_session(&root, "../Example").expect("second session");
        assert_ne!(first, second);
        assert_eq!(second.parent(), Some(root.as_path()));
        assert!(second.ends_with("___Example - Session 002"));
        std::fs::remove_dir_all(root).expect("remove fixture");
    }
}
