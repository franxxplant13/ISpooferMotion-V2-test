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

/// Publish each reference under its Studio name, including references sharing the same ID.
pub(super) async fn save_reference(source: &Path, dir: &Path, label: &str, ext: &str) -> io::Result<PathBuf> {
    let mut input = tokio::fs::File::open(source).await?;
    let expected = input.metadata().await?.len();
    if expected == 0 {
        return Err(io::Error::other("Downloaded file is empty"));
    }
    let (file, mut staged) = tempfile::NamedTempFile::new_in(dir)?.into_parts();
    let mut output = tokio::fs::File::from_std(file);
    let written = tokio::io::copy(&mut input, &mut output).await?;
    tokio::io::AsyncWriteExt::flush(&mut output).await?;
    drop(output);
    if written != expected {
        return Err(io::Error::other("Incomplete file copy"));
    }
    let clean: String = label.chars().take(100).map(|c| {
        if c.is_control() || r#"<>:"/\|?*"#.contains(c) { '_' } else { c }
    }).collect();
    let trimmed = clean.trim().trim_end_matches(['.', ' ']);
    let mut stem = if trimmed.is_empty() { "Unnamed".to_owned() } else { trimmed.to_owned() };
    let device = stem.split('.').next().unwrap_or("").trim_end().to_uppercase();
    if matches!(device.as_str(), "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$") ||
        device.strip_prefix("COM").or_else(|| device.strip_prefix("LPT"))
            .is_some_and(|n| matches!(n, "1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"¹"|"²"|"³")) {
        stem.insert(0, '_');
    }
    for number in 1_u64.. {
        let name = if number == 1 { format!("{stem}.{ext}") } else { format!("{stem} ({number}).{ext}") };
        let path = dir.join(name);
        match staged.persist_noclobber(&path) {
            Ok(()) => return Ok(path),
            Err(err) if err.error.kind() == io::ErrorKind::AlreadyExists => staged = err.path,
            Err(err) => return Err(err.error),
        }
    }
    Err(io::Error::other("No available filename"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn ten_references_to_nine_sources_keep_their_names_and_contents() {
        let session = tempfile::tempdir().unwrap();
        let root = session.path();
        for i in 0..9 {
            let input = root.join(format!(".partial-{i}"));
            std::fs::write(&input, format!("asset {i}")).unwrap();
            let label = format!("Move {i}");
            let path = save_reference(&input, root, &label, "rbxm").await.unwrap();
            assert_eq!(path, root.join(format!("{label}.rbxm")));
            if i == 0 {
                let alias = save_reference(&input, root, "Other move", "rbxm").await.unwrap();
                assert_eq!(std::fs::read(alias).unwrap(), std::fs::read(path).unwrap());
            }
        }
        let count = std::fs::read_dir(root).unwrap().flatten()
            .filter(|entry| entry.path().extension().is_some_and(|e| e == "rbxm")).count();
        assert_eq!(count, 10);
        let duplicate = save_reference(&root.join(".partial-1"), root, "Move 0", "rbxm").await.unwrap();
        assert_eq!(duplicate, root.join("Move 0 (2).rbxm"));
        assert_eq!(std::fs::read(root.join("Move 0.rbxm")).unwrap(), b"asset 0");
    }

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
