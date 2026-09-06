use clap::{Args, Parser, Subcommand};
use notes_preflight::{compare, human_compare, human_scan, scan_path, Limits};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::process::ExitCode;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Parser)]
#[command(
    name = "notes-preflight",
    version,
    about = "Inspect a notes export before migration",
    long_about = "Inventory note exports locally, flag conversion risks, and compare a destination export for missing notes or attachments. Files are read-only and never uploaded."
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Run a complete scan and comparison on bundled sample data
    Demo(DemoArgs),
    /// Inventory a directory, ZIP, ENEX, or saved JSON report
    Scan(ScanArgs),
    /// Compare a source export/report with a destination export
    Compare(CompareArgs),
}

#[derive(Args)]
struct DemoArgs {
    /// Print the sample scan, comparison, and output directory as JSON
    #[arg(long)]
    json: bool,
}

#[derive(Args)]
struct ScanArgs {
    /// Export directory, ZIP archive, ENEX file, or saved report
    path: PathBuf,
    /// Print versioned JSON for scripts or a future comparison
    #[arg(long)]
    json: bool,
    #[command(flatten)]
    limits: LimitArgs,
}

#[derive(Args)]
struct CompareArgs {
    /// Original export or JSON report from `scan --json`
    source: PathBuf,
    /// Export made from the destination notes app
    destination: PathBuf,
    /// Print versioned JSON for scripts
    #[arg(long)]
    json: bool,
    /// Exit with code 2 when notes are missing or changed, or attachments are missing
    #[arg(long)]
    fail_on_loss: bool,
    #[command(flatten)]
    limits: LimitArgs,
}

#[derive(Args, Clone)]
struct LimitArgs {
    /// Maximum uncompressed size of one file
    #[arg(long, default_value_t = 64)]
    max_entry_mb: u64,
    /// Maximum total uncompressed size read
    #[arg(long, default_value_t = 2048)]
    max_total_mb: u64,
    /// Maximum number of files or ZIP entries
    #[arg(long, default_value_t = 50_000)]
    max_entries: usize,
}

impl LimitArgs {
    fn values(&self) -> Result<Limits, String> {
        if self.max_entry_mb == 0 || self.max_total_mb == 0 || self.max_entries == 0 {
            return Err("scan limits must be greater than zero".to_string());
        }
        Ok(Limits {
            max_entries: self.max_entries,
            max_entry_bytes: self
                .max_entry_mb
                .checked_mul(1024 * 1024)
                .ok_or("entry limit is too large")?,
            max_total_bytes: self
                .max_total_mb
                .checked_mul(1024 * 1024)
                .ok_or("total limit is too large")?,
        })
    }
}

fn main() -> ExitCode {
    match run(Cli::parse()) {
        Ok(code) => ExitCode::from(code),
        Err(message) => {
            eprintln!("error: {message}");
            ExitCode::FAILURE
        }
    }
}

fn run(cli: Cli) -> Result<u8, String> {
    match cli.command {
        Command::Demo(args) => run_demo(args),
        Command::Scan(args) => {
            let report = scan_path(&args.path, args.limits.values()?)?;
            if args.json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?
                );
            } else {
                print!("{}", human_scan(&report));
            }
            Ok(0)
        }
        Command::Compare(args) => {
            let limits = args.limits.values()?;
            let source = scan_path(&args.source, limits)?;
            let destination = scan_path(&args.destination, limits)?;
            let report = compare(&source, &destination);
            if args.json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?
                );
            } else {
                print!("{}", human_compare(&report));
            }
            Ok(if args.fail_on_loss && report.verdict != "pass" {
                2
            } else {
                0
            })
        }
    }
}

const DEMO_FILES: &[(&str, &[u8], bool)] = &[
    (
        "Work/Project Atlas.md",
        include_bytes!("../examples/sample-export/Work/Project Atlas.md"),
        true,
    ),
    (
        "Work/Decision log.md",
        include_bytes!("../examples/sample-export/Work/Decision log.md"),
        true,
    ),
    (
        "Personal/Travel plan.html",
        include_bytes!("../examples/sample-export/Personal/Travel plan.html"),
        true,
    ),
    (
        "Personal/Voice memo.txt",
        include_bytes!("../examples/sample-export/Personal/Voice memo.txt"),
        true,
    ),
    (
        "Reference/Recipe.md",
        include_bytes!("../examples/sample-export/Reference/Recipe.md"),
        true,
    ),
    (
        "Work/receipt.jpg",
        include_bytes!("../examples/sample-export/Work/receipt.jpg"),
        true,
    ),
    (
        "Work/interview.m4a",
        include_bytes!("../examples/sample-export/Work/interview.m4a"),
        false,
    ),
    (
        "Reference/menu.pdf",
        include_bytes!("../examples/sample-export/Reference/menu.pdf"),
        true,
    ),
];

fn run_demo(args: DemoArgs) -> Result<u8, String> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let root = std::env::temp_dir().join(format!(
        "notes-preflight-demo-{}-{nonce}",
        std::process::id()
    ));
    let source = root.join("source-export");
    let destination = root.join("destination-export");
    fs::create_dir_all(&source).map_err(|error| format!("cannot create demo: {error}"))?;
    fs::create_dir_all(&destination).map_err(|error| format!("cannot create demo: {error}"))?;
    for (relative, contents, keep_in_destination) in DEMO_FILES {
        write_demo_file(&source, relative, contents)?;
        if *keep_in_destination {
            let destination_contents: &[u8] = if *relative == "Work/Decision log.md" {
                b"# Decision log\n\nThe importer flattened the decision table.\n"
            } else {
                contents
            };
            write_demo_file(&destination, relative, destination_contents)?;
        }
    }

    let source_report = scan_path(&source, Limits::default())?;
    let destination_report = scan_path(&destination, Limits::default())?;
    let comparison = compare(&source_report, &destination_report);
    let scan_path = root.join("source-report.json");
    let compare_path = root.join("comparison-report.json");
    fs::write(
        &scan_path,
        serde_json::to_vec_pretty(&source_report).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("cannot save demo report: {error}"))?;
    fs::write(
        &compare_path,
        serde_json::to_vec_pretty(&comparison).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("cannot save demo comparison: {error}"))?;

    if args.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&json!({
                "demo": true,
                "output_directory": root,
                "source_report": source_report,
                "comparison": comparison
            }))
            .map_err(|error| error.to_string())?
        );
    } else {
        println!("DEMO — BUNDLED SAMPLE DATA\n");
        print!("{}", human_scan(&source_report));
        println!();
        print!("{}", human_compare(&comparison));
        println!("\nSample files and JSON reports: {}", root.display());
        println!("Nothing outside this temporary directory was read or changed.");
    }
    Ok(0)
}

fn write_demo_file(root: &std::path::Path, relative: &str, contents: &[u8]) -> Result<(), String> {
    let path = root.join(relative);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("cannot create demo: {error}"))?;
    }
    fs::write(path, contents).map_err(|error| format!("cannot write demo: {error}"))
}
