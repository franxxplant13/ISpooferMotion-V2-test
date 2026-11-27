use rbx_dom_weak::{InstanceBuilder, WeakDom};
use serde_json::Value;
use std::{fs::File, io::{BufRead, BufReader}, path::Path};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

fn add_clip(pack: &mut WeakDom, path: &Path, name: &str) -> Result<(), String> {
    let mut reader = BufReader::new(File::open(path).map_err(|e| e.to_string())?);
    let source = if reader.fill_buf().map_err(|e| e.to_string())?.starts_with(b"<roblox!") {
        rbx_binary::from_reader(reader).map_err(|e| e.to_string())?
    } else {
        rbx_xml::from_reader_default(reader).map_err(|e| e.to_string())?
    };
    let [clip] = source.root().children() else { return Err("Expected one animation clip in this file".into()); };
    let clip = *clip;
    let instance = source.get_by_ref(clip).ok_or("Missing animation")?;
    if !matches!(instance.class.as_str(), "KeyframeSequence" | "CurveAnimation") {
        return Err(format!("Expected an animation clip, found {}", instance.class));
    }
    for item in source.descendants_of(clip) {
        if matches!(item.class.as_str(), "Script" | "LocalScript" | "ModuleScript") {
            return Err("Unexpected script inside animation".into());
        }
    }
    let copy = source.clone_into_external(clip, pack);
    pack.get_by_ref_mut(copy).ok_or("Could not copy animation into pack")?.name = name.into();
    pack.transfer_within(copy, pack.root_ref());
    Ok(())
}

pub(super) fn assemble(app: &tauri::AppHandle, dir: &Path, name: &str, rows: &mut [Value], incomplete: bool) -> Result<Option<tempfile::NamedTempFile>, String> {
    let mut pack = WeakDom::new(InstanceBuilder::new("Folder").with_name(name));
    let mut missing = Vec::new();
    for row in rows {
        let label = row["name"].as_str().unwrap_or("Animation").to_owned();
        let result = row.as_object_mut().and_then(|r| r.remove("filePath"));
        if let Some(path) = result.as_ref().and_then(Value::as_str) {
            if let Err(error) = add_clip(&mut pack, Path::new(path), &label) {
                row["success"] = false.into();
                row["errorReason"] = error.clone().into();
                missing.push(format!("{label}: {error}"));
            }
        } else {
            missing.push(format!("{label}: {}", row["errorReason"].as_str().unwrap_or("skipped or unavailable")));
        }
    }
    let count = pack.root().children().len();
    if count == 0 { return Err(format!("No animation clips to save. {}", missing.join("; "))); }
    if incomplete || !missing.is_empty() {
        let message = format!("{count} animation(s) are ready. Save a partial pack?\n{}", missing.iter().take(8).cloned().collect::<Vec<_>>().join("\n"));
        if !app.dialog().message(message).title("PM SPOOFER").buttons(MessageDialogButtons::OkCancelCustom("Save partial pack".into(), "Discard pack".into())).blocking_show() {
            return Ok(None);
        }
    }
    let mut file = tempfile::NamedTempFile::new_in(dir).map_err(|e| e.to_string())?;
    rbx_binary::to_writer(file.as_file_mut(), &pack, &[pack.root_ref()]).map_err(|e| e.to_string())?;
    Ok(Some(file))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn binary_pack_round_trips_ten_named_clips_with_shared_source() {
        let input = tempfile::NamedTempFile::new().unwrap();
        let clip = WeakDom::new(InstanceBuilder::new("KeyframeSequence").with_child(InstanceBuilder::new("Keyframe")));
        rbx_binary::to_writer(input.as_file(), &clip, &[clip.root_ref()]).unwrap();
        let mut pack = WeakDom::new(InstanceBuilder::new("Folder").with_name("Movement"));
        for n in 0..10 { add_clip(&mut pack, input.path(), &format!("Move {n}")).unwrap(); }
        let mut bytes = Vec::new();
        rbx_binary::to_writer(&mut bytes, &pack, &[pack.root_ref()]).unwrap();
        let check = rbx_binary::from_reader(&bytes[..]).unwrap();
        let folder = check.get_by_ref(check.root().children()[0]).unwrap();
        assert_eq!(folder.name, "Movement");
        assert_eq!(folder.children().len(), 10);
        for (i, child) in folder.children().iter().enumerate() {
            let clip = check.get_by_ref(*child).unwrap();
            assert_eq!(clip.name, format!("Move {i}"));
            assert_eq!(clip.children().len(), 1);
        }
    }
}
