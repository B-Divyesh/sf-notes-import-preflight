use serde_json::Value;
use std::fs;
use std::process::Command;

#[test]
fn duplicate_titles_and_same_sized_different_attachments_fail_the_cli_gate() {
    let root = tempfile::tempdir().unwrap();
    let source = root.path().join("source");
    let destination = root.path().join("destination");
    fs::create_dir_all(source.join("A")).unwrap();
    fs::create_dir_all(source.join("B")).unwrap();
    fs::create_dir_all(destination.join("C")).unwrap();
    fs::write(source.join("A/note.md"), "# Same\nAlpha").unwrap();
    fs::write(source.join("A/receipt.jpg"), b"aaa").unwrap();
    fs::write(source.join("B/note.md"), "# Same\nBravo").unwrap();
    fs::write(source.join("B/receipt.jpg"), b"bbb").unwrap();
    fs::write(destination.join("C/note.md"), "# Same\nBravo").unwrap();
    fs::write(destination.join("C/receipt.jpg"), b"aaa").unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_notes-preflight"))
        .args(["compare"])
        .arg(&source)
        .arg(&destination)
        .args(["--json", "--fail-on-loss"])
        .output()
        .unwrap();

    assert_eq!(output.status.code(), Some(2));
    let report: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["verdict"], "loss-detected");
    assert_eq!(
        report["missing_notes"],
        serde_json::json!(["Same [A/note.md]"])
    );
    assert_eq!(
        report["missing_attachments"],
        serde_json::json!(["receipt.jpg [B/receipt.jpg]"])
    );
}
