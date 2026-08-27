use clap::{Args, Parser, Subcommand};
use notes_preflight::{compare, human_compare, human_scan, scan_path, Limits};
use std::path::PathBuf;
use std::process::ExitCode;

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
    /// Inventory a directory, ZIP, ENEX, or saved JSON report
    Scan(ScanArgs),
    /// Compare a source export/report with a destination export
    Compare(CompareArgs),
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
