use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::fs::File;
use std::io::{self, Read};
use std::path::{Component, Path};
use walkdir::WalkDir;
use zip::ZipArchive;

/// Schema 2 adds source-relative paths. They make collision diagnostics useful
/// without exposing note bodies or attachment bytes.
pub const SCHEMA_VERSION: u8 = 2;
const MAX_SAMPLE_COUNT: usize = 8;

#[derive(Debug, Clone, Copy)]
pub struct Limits {
    pub max_entries: usize,
    pub max_entry_bytes: u64,
    pub max_total_bytes: u64,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            max_entries: 50_000,
            max_entry_bytes: 64 * 1024 * 1024,
            max_total_bytes: 2 * 1024 * 1024 * 1024,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct Totals {
    pub notebooks: usize,
    pub notes: usize,
    pub attachments: usize,
    pub attachment_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct NoteEntry {
    pub key: String,
    pub title: String,
    #[serde(default)]
    pub path: String,
    pub format: String,
    pub bytes: u64,
    pub fingerprint: String,
    pub has_created: bool,
    pub has_updated: bool,
    pub tag_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct AttachmentEntry {
    pub key: String,
    pub name: String,
    #[serde(default)]
    pub path: String,
    pub media_type: String,
    pub bytes: u64,
    pub fingerprint: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct LinkSummary {
    pub external: usize,
    pub internal: usize,
    pub local_file: usize,
    pub unresolved: usize,
    pub unresolved_samples: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RiskFinding {
    pub code: String,
    pub label: String,
    pub severity: String,
    pub count: usize,
    pub samples: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct MetadataSummary {
    pub notes_with_created: usize,
    pub notes_with_updated: usize,
    pub notes_with_tags: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ScanReport {
    pub schema_version: u8,
    pub source: String,
    pub source_kind: String,
    pub totals: Totals,
    pub notebooks: Vec<String>,
    pub attachment_types: BTreeMap<String, usize>,
    pub links: LinkSummary,
    pub metadata: MetadataSummary,
    pub risks: Vec<RiskFinding>,
    pub warnings: Vec<String>,
    pub notes: Vec<NoteEntry>,
    pub attachments: Vec<AttachmentEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CompareReport {
    pub schema_version: u8,
    pub source: Totals,
    pub destination: Totals,
    pub missing_notes: Vec<String>,
    pub changed_notes: Vec<String>,
    pub missing_attachments: Vec<String>,
    pub added_notes: usize,
    pub added_attachments: usize,
    pub verdict: String,
}

#[derive(Debug, Default)]
struct RiskAccumulator(BTreeMap<String, RiskFinding>);

impl RiskAccumulator {
    fn add(&mut self, code: &str, label: &str, severity: &str, sample: &str) {
        let finding = self
            .0
            .entry(code.to_string())
            .or_insert_with(|| RiskFinding {
                code: code.to_string(),
                label: label.to_string(),
                severity: severity.to_string(),
                count: 0,
                samples: Vec::new(),
            });
        finding.count += 1;
        if finding.samples.len() < MAX_SAMPLE_COUNT && !finding.samples.iter().any(|v| v == sample)
        {
            finding.samples.push(sample.to_string());
        }
    }
}

#[derive(Debug)]
struct RawFile {
    path: String,
    bytes: Vec<u8>,
}

/// Scan a notes export directory or ZIP without extracting it.
pub fn scan_path(path: &Path, limits: Limits) -> Result<ScanReport, String> {
    if !path.exists() {
        return Err(format!("input does not exist: {}", path.display()));
    }
    if path.is_file()
        && path
            .extension()
            .and_then(|v| v.to_str())
            .is_some_and(|v| v.eq_ignore_ascii_case("json"))
    {
        if let Ok(report) = read_report(path) {
            return Ok(report);
        }
    }

    let (files, source_kind, warnings) = if path.is_dir() {
        (
            read_directory(path, limits)?,
            "directory".to_string(),
            Vec::new(),
        )
    } else if path
        .extension()
        .and_then(|v| v.to_str())
        .is_some_and(|v| v.eq_ignore_ascii_case("zip"))
    {
        (read_zip(path, limits)?, "zip".to_string(), Vec::new())
    } else {
        let size = path.metadata().map_err(|e| e.to_string())?.len();
        if size > limits.max_entry_bytes {
            return Err(format!(
                "file exceeds the {} MiB entry limit",
                limits.max_entry_bytes / 1024 / 1024
            ));
        }
        let bytes = read_bounded(path, limits.max_entry_bytes)?;
        let name = path
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("export")
            .to_string();
        (
            vec![RawFile { path: name, bytes }],
            "file".to_string(),
            Vec::new(),
        )
    };

    build_report(path.display().to_string(), source_kind, files, warnings)
}

pub fn read_report(path: &Path) -> Result<ScanReport, String> {
    let file = File::open(path).map_err(|e| format!("cannot open report: {e}"))?;
    let report: ScanReport = serde_json::from_reader(io::BufReader::new(file))
        .map_err(|e| format!("not a Notes Import Preflight report: {e}"))?;
    if !(1..=SCHEMA_VERSION).contains(&report.schema_version) {
        return Err(format!(
            "unsupported report schema {}",
            report.schema_version
        ));
    }
    Ok(report)
}

fn read_directory(root: &Path, limits: Limits) -> Result<Vec<RawFile>, String> {
    let mut files = Vec::new();
    let mut total = 0u64;
    for item in WalkDir::new(root).follow_links(false).into_iter() {
        let item = item.map_err(|e| format!("cannot walk export: {e}"))?;
        if item.file_type().is_symlink() || !item.file_type().is_file() {
            continue;
        }
        if files.len() >= limits.max_entries {
            return Err(format!(
                "export exceeds the {} file limit",
                limits.max_entries
            ));
        }
        let size = item.metadata().map_err(|e| e.to_string())?.len();
        enforce_size_limits(size, &mut total, limits)?;
        let relative = item.path().strip_prefix(root).map_err(|e| e.to_string())?;
        let safe = normalize_path(relative)?;
        let bytes = read_bounded(item.path(), limits.max_entry_bytes)?;
        if bytes.len() as u64 > size {
            enforce_size_limits(bytes.len() as u64 - size, &mut total, limits)?;
        }
        files.push(RawFile { path: safe, bytes });
    }
    Ok(files)
}

fn read_zip(path: &Path, limits: Limits) -> Result<Vec<RawFile>, String> {
    let file = File::open(path).map_err(|e| format!("cannot open ZIP: {e}"))?;
    let mut zip = ZipArchive::new(file).map_err(|e| format!("invalid or unsupported ZIP: {e}"))?;
    if zip.len() > limits.max_entries {
        return Err(format!(
            "archive exceeds the {} entry limit",
            limits.max_entries
        ));
    }
    let mut total = 0u64;
    let mut files = Vec::new();
    for index in 0..zip.len() {
        let entry = zip
            .by_index(index)
            .map_err(|e| format!("cannot inspect ZIP entry {index}: {e}"))?;
        if entry.is_dir() {
            continue;
        }
        let enclosed = entry
            .enclosed_name()
            .ok_or_else(|| format!("unsafe ZIP path rejected: {}", entry.name()))?;
        let safe = normalize_path(&enclosed)?;
        let entry_size = entry.size();
        enforce_size_limits(entry_size, &mut total, limits)?;
        if entry.compressed_size() > 0
            && entry.size() > 10 * 1024 * 1024
            && entry.size() / entry.compressed_size().max(1) > 200
        {
            return Err(format!("suspicious compression ratio in {safe}"));
        }
        let mut bytes = Vec::with_capacity(entry.size().min(4 * 1024 * 1024) as usize);
        entry
            .take(limits.max_entry_bytes + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| format!("cannot read ZIP entry {safe}: {e}"))?;
        if bytes.len() as u64 > limits.max_entry_bytes {
            return Err(format!(
                "ZIP entry {safe} expanded beyond the configured entry limit"
            ));
        }
        if bytes.len() as u64 > entry_size {
            enforce_size_limits(bytes.len() as u64 - entry_size, &mut total, limits)?;
        }
        files.push(RawFile { path: safe, bytes });
    }
    Ok(files)
}

fn read_bounded(path: &Path, limit: u64) -> Result<Vec<u8>, String> {
    let file = File::open(path).map_err(|e| format!("cannot read {}: {e}", path.display()))?;
    let mut bytes = Vec::new();
    file.take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("cannot read {}: {e}", path.display()))?;
    if bytes.len() as u64 > limit {
        return Err(format!(
            "{} grew beyond the configured entry limit while being read",
            path.display()
        ));
    }
    Ok(bytes)
}

fn enforce_size_limits(size: u64, total: &mut u64, limits: Limits) -> Result<(), String> {
    if size > limits.max_entry_bytes {
        return Err(format!(
            "entry exceeds the {} MiB limit",
            limits.max_entry_bytes / 1024 / 1024
        ));
    }
    *total = total.checked_add(size).ok_or("export size overflow")?;
    if *total > limits.max_total_bytes {
        return Err(format!(
            "export exceeds the {} MiB total limit",
            limits.max_total_bytes / 1024 / 1024
        ));
    }
    Ok(())
}

fn normalize_path(path: &Path) -> Result<String, String> {
    let mut parts = Vec::new();
    for part in path.components() {
        match part {
            Component::Normal(value) => parts.push(value.to_string_lossy().to_string()),
            Component::CurDir => {}
            _ => return Err(format!("unsafe path rejected: {}", path.display())),
        }
    }
    if parts.is_empty() {
        return Err("empty archive path rejected".to_string());
    }
    Ok(parts.join("/"))
}

fn build_report(
    source: String,
    source_kind: String,
    files: Vec<RawFile>,
    mut warnings: Vec<String>,
) -> Result<ScanReport, String> {
    if files.is_empty() {
        warnings.push(
            "No files were found. Confirm that the export completed and selected the correct path."
                .to_string(),
        );
    }
    let known_paths: HashSet<String> = files.iter().map(|f| f.path.to_lowercase()).collect();
    let mut notes = Vec::new();
    let mut attachments = Vec::new();
    let mut notebooks = BTreeSet::new();
    let mut types = BTreeMap::new();
    let mut links = LinkSummary::default();
    let mut risks = RiskAccumulator::default();

    for file in files {
        let ext = extension(&file.path);
        if matches!(ext.as_str(), "one" | "sqlite" | "db" | "notestore") {
            risks.add(
                "proprietary-database",
                "Proprietary database export cannot be inspected",
                "danger",
                &file.path,
            );
            let warning = "A proprietary notes database was found. Export through the source app first; Preflight does not bypass encryption or decode private databases.".to_string();
            if !warnings.contains(&warning) {
                warnings.push(warning);
            }
        } else if ext == "enex" {
            parse_enex(
                &file,
                &mut notes,
                &mut attachments,
                &mut notebooks,
                &mut types,
                &mut links,
                &mut risks,
            )?;
        } else if is_note_extension(&ext) {
            let text = String::from_utf8_lossy(&file.bytes);
            let title = extract_title(&text, &file.path, &ext);
            let (created, updated, tags) = detect_metadata(&text, &ext);
            inspect_text(&text, &file.path, &known_paths, &mut links, &mut risks);
            notebooks.insert(notebook_for(&file.path));
            notes.push(NoteEntry {
                key: normalize_key(&title),
                title,
                path: file.path.clone(),
                format: ext,
                bytes: file.bytes.len() as u64,
                fingerprint: digest(&file.bytes),
                has_created: created,
                has_updated: updated,
                tag_count: tags,
            });
        } else if !is_ignored(&file.path, &ext) {
            let media_type = media_type_for(&ext);
            *types.entry(media_type.clone()).or_insert(0) += 1;
            if file.bytes.len() > 25 * 1024 * 1024 {
                risks.add(
                    "large-attachment",
                    "Large attachment may exhaust importer memory",
                    "warning",
                    &file.path,
                );
            }
            if matches!(ext.as_str(), "m4a" | "mp3" | "wav" | "aac") {
                risks.add(
                    "audio",
                    "Audio recordings are often unsupported",
                    "warning",
                    &file.path,
                );
            }
            if matches!(ext.as_str(), "mov" | "mp4" | "mkv" | "avi") {
                risks.add(
                    "video",
                    "Video attachments may not be preserved",
                    "warning",
                    &file.path,
                );
            }
            attachments.push(AttachmentEntry {
                key: normalize_key(file.path.rsplit('/').next().unwrap_or(&file.path)),
                name: file
                    .path
                    .rsplit('/')
                    .next()
                    .unwrap_or(&file.path)
                    .to_string(),
                path: file.path.clone(),
                media_type,
                bytes: file.bytes.len() as u64,
                fingerprint: digest(&file.bytes),
            });
        }
    }

    notes.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    attachments.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    let metadata = MetadataSummary {
        notes_with_created: notes.iter().filter(|n| n.has_created).count(),
        notes_with_updated: notes.iter().filter(|n| n.has_updated).count(),
        notes_with_tags: notes.iter().filter(|n| n.tag_count > 0).count(),
    };
    let totals = Totals {
        notebooks: notebooks.len(),
        notes: notes.len(),
        attachments: attachments.len(),
        attachment_bytes: attachments.iter().map(|a| a.bytes).sum(),
    };
    if totals.notes == 0 && !files_is_only_report(&source) {
        warnings.push("No supported notes were detected. Use Markdown, HTML, text, ENEX, or a supported JSON export.".to_string());
    }
    Ok(ScanReport {
        schema_version: SCHEMA_VERSION,
        source,
        source_kind,
        totals,
        notebooks: notebooks.into_iter().collect(),
        attachment_types: types,
        links,
        metadata,
        risks: risks.0.into_values().collect(),
        warnings,
        notes,
        attachments,
    })
}

fn files_is_only_report(source: &str) -> bool {
    source.ends_with(".json")
}

fn parse_enex(
    file: &RawFile,
    notes: &mut Vec<NoteEntry>,
    attachments: &mut Vec<AttachmentEntry>,
    notebooks: &mut BTreeSet<String>,
    types: &mut BTreeMap<String, usize>,
    links: &mut LinkSummary,
    risks: &mut RiskAccumulator,
) -> Result<(), String> {
    let text = String::from_utf8(file.bytes.clone())
        .map_err(|_| format!("{} is not UTF-8 ENEX", file.path))?;
    let note_re = Regex::new(r"(?is)<note>(.*?)</note>").unwrap();
    let resource_re = Regex::new(r"(?is)<resource>(.*?)</resource>").unwrap();
    let mut found = 0;
    for (index, capture) in note_re.captures_iter(&text).enumerate() {
        found += 1;
        let block = capture.get(1).unwrap().as_str();
        let title = xml_value(block, "title").unwrap_or_else(|| format!("Untitled {}", index + 1));
        let content = xml_value(block, "content").unwrap_or_default();
        let key = normalize_key(&title);
        inspect_text(
            &content,
            &format!("{}#{key}", file.path),
            &HashSet::new(),
            links,
            risks,
        );
        notes.push(NoteEntry {
            key,
            title: title.clone(),
            path: format!("{}#note-{}", file.path, index + 1),
            format: "enex".to_string(),
            bytes: block.len() as u64,
            fingerprint: digest(content.as_bytes()),
            has_created: xml_value(block, "created").is_some(),
            has_updated: xml_value(block, "updated").is_some(),
            tag_count: Regex::new(r"(?i)<tag>").unwrap().find_iter(block).count(),
        });
        for (resource_index, resource) in resource_re.captures_iter(block).enumerate() {
            let resource = resource.get(1).unwrap().as_str();
            let media = xml_attr_or_value(resource, "data", "type")
                .unwrap_or_else(|| "application/octet-stream".to_string());
            let name = xml_value(resource, "file-name").unwrap_or_else(|| {
                format!(
                    "{}-attachment-{}",
                    normalize_key(&title),
                    resource_index + 1
                )
            });
            let encoded = xml_value(resource, "data")
                .unwrap_or_default()
                .chars()
                .filter(|c| !c.is_whitespace())
                .collect::<String>();
            let decoded = BASE64.decode(encoded.as_bytes()).unwrap_or_default();
            *types.entry(media.clone()).or_insert(0) += 1;
            attachments.push(AttachmentEntry {
                key: normalize_key(&name),
                name,
                path: format!(
                    "{}#note-{}/resource-{}",
                    file.path,
                    index + 1,
                    resource_index + 1
                ),
                media_type: media,
                bytes: decoded.len() as u64,
                fingerprint: digest(&decoded),
            });
        }
    }
    if found == 0 {
        return Err(format!(
            "{} does not contain any ENEX <note> records",
            file.path
        ));
    }
    notebooks.insert(
        Path::new(&file.path)
            .file_stem()
            .and_then(|v| v.to_str())
            .unwrap_or("Evernote export")
            .to_string(),
    );
    Ok(())
}

fn xml_value(text: &str, tag: &str) -> Option<String> {
    let re = Regex::new(&format!(r"(?is)<{tag}(?:\s[^>]*)?>(.*?)</{tag}>")).ok()?;
    let value = re.captures(text)?.get(1)?.as_str();
    Some(strip_cdata(value).trim().to_string())
}

fn xml_attr_or_value(text: &str, tag: &str, attr: &str) -> Option<String> {
    let re = Regex::new(&format!(
        r#"(?is)<{tag}[^>]*\s{attr}=[\"']([^\"']+)[\"'][^>]*>"#
    ))
    .ok()?;
    re.captures(text)
        .and_then(|c| c.get(1))
        .map(|v| v.as_str().to_string())
}

fn strip_cdata(value: &str) -> &str {
    value
        .strip_prefix("<![CDATA[")
        .and_then(|v| v.strip_suffix("]]>"))
        .unwrap_or(value)
}

fn inspect_text(
    text: &str,
    path: &str,
    known_paths: &HashSet<String>,
    links: &mut LinkSummary,
    risks: &mut RiskAccumulator,
) {
    let lower = text.to_lowercase();
    let checks = [
        (
            "table",
            "Tables may change layout",
            "notice",
            lower.contains("<table")
                || text
                    .lines()
                    .any(|l| l.contains('|') && l.matches('|').count() >= 2),
        ),
        (
            "task",
            "Tasks and check states may flatten",
            "notice",
            lower.contains("type=\"checkbox\"")
                || lower.contains("- [x]")
                || lower.contains("- [ ]"),
        ),
        (
            "wiki-link",
            "Wiki links require target resolution",
            "warning",
            text.contains("[[") && text.contains("]]"),
        ),
        (
            "embed",
            "Embedded content may not survive",
            "warning",
            lower.contains("<iframe") || lower.contains("![["),
        ),
        (
            "data-url",
            "Inline data URLs can be dropped",
            "warning",
            lower.contains("data:"),
        ),
        (
            "math",
            "Math notation may not render",
            "notice",
            lower.contains("<math") || text.contains("$$"),
        ),
        (
            "code",
            "Code formatting may change",
            "notice",
            text.contains("```") || lower.contains("<pre"),
        ),
    ];
    for (code, label, severity, matched) in checks {
        if matched {
            risks.add(code, label, severity, path);
        }
    }

    let url_re =
        Regex::new(r#"(?i)(?:href|src)\s*=\s*[\"']([^\"']+)[\"']|\[[^\]]*\]\(([^)]+)\)"#).unwrap();
    for capture in url_re.captures_iter(text) {
        let target = capture
            .get(1)
            .or_else(|| capture.get(2))
            .map(|m| m.as_str())
            .unwrap_or("")
            .trim();
        if target.starts_with("http://")
            || target.starts_with("https://")
            || target.starts_with("mailto:")
        {
            links.external += 1;
        } else if target.starts_with('#') {
            links.internal += 1;
        } else if target.starts_with("file:") {
            links.local_file += 1;
        } else if !target.is_empty() && !target.starts_with("data:") {
            links.internal += 1;
            let clean = target
                .split(['#', '?'])
                .next()
                .unwrap_or(target)
                .replace("%20", " ");
            let parent = Path::new(path).parent().unwrap_or(Path::new(""));
            let candidate = parent.join(clean);
            if normalize_path(&candidate)
                .ok()
                .is_some_and(|p| !known_paths.contains(&p.to_lowercase()))
                && !known_paths.is_empty()
            {
                links.unresolved += 1;
                if links.unresolved_samples.len() < MAX_SAMPLE_COUNT {
                    links.unresolved_samples.push(format!("{path} → {target}"));
                }
            }
        }
    }
}

fn extract_title(text: &str, path: &str, ext: &str) -> String {
    if matches!(ext, "md" | "markdown") {
        if let Some(line) = text.lines().find(|line| line.starts_with("# ")) {
            return line.trim_start_matches("# ").trim().to_string();
        }
    }
    if matches!(ext, "html" | "htm") {
        if let Some(value) = xml_value(text, "title") {
            return decode_entities(&value);
        }
    }
    if ext == "json" {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(text) {
            if let Some(title) = value.get("title").and_then(|v| v.as_str()) {
                return title.to_string();
            }
        }
    }
    Path::new(path)
        .file_stem()
        .and_then(|v| v.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

fn detect_metadata(text: &str, ext: &str) -> (bool, bool, usize) {
    let lower = text.to_lowercase();
    let created =
        lower.contains("created:") || lower.contains("created_at") || lower.contains("createdate");
    let updated =
        lower.contains("updated:") || lower.contains("updated_at") || lower.contains("modifydate");
    let tags = if ext == "json" {
        serde_json::from_str::<serde_json::Value>(text)
            .ok()
            .and_then(|v| v.get("labels").and_then(|a| a.as_array()).map(|a| a.len()))
            .unwrap_or(0)
    } else {
        text.lines()
            .find(|l| l.to_lowercase().starts_with("tags:"))
            .map(|l| l.split(',').count())
            .unwrap_or(0)
    };
    (created, updated, tags)
}

fn is_note_extension(ext: &str) -> bool {
    matches!(
        ext,
        "md" | "markdown" | "html" | "htm" | "txt" | "rtf" | "json"
    )
}
fn is_ignored(path: &str, ext: &str) -> bool {
    let name = path.rsplit('/').next().unwrap_or(path).to_lowercase();
    name == ".ds_store"
        || name == "thumbs.db"
        || matches!(ext, "ini" | "lock")
        || name.starts_with('.')
}
fn extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_lowercase()
}
fn notebook_for(path: &str) -> String {
    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() > 1 {
        parts[0].to_string()
    } else {
        "Unfiled".to_string()
    }
}
fn normalize_key(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn decode_entities(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
}
fn media_type_for(ext: &str) -> String {
    match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        _ => "application/octet-stream",
    }
    .to_string()
}

/// Compare inventories without collapsing duplicate titles or filenames.
///
/// Exact fingerprints are matched first (as a multiset), then same-title notes
/// are paired as changed. That order means a destination export cannot make one
/// duplicate source note stand in for another. Attachments are intentionally
/// matched only by their SHA-256 fingerprint and occurrence count: a filename
/// and byte count are descriptive metadata, not proof that the bytes survived.
pub fn compare(source: &ScanReport, destination: &ScanReport) -> CompareReport {
    let mut unmatched_destination_notes = vec![true; destination.notes.len()];
    let mut unmatched_source_notes = Vec::new();

    // A note whose body survives exactly is accounted for even if an export
    // changes its notebook path or title formatting.
    for (source_index, note) in source.notes.iter().enumerate() {
        if let Some(destination_index) =
            destination
                .notes
                .iter()
                .enumerate()
                .find_map(|(index, candidate)| {
                    (unmatched_destination_notes[index]
                        && candidate.fingerprint == note.fingerprint)
                        .then_some(index)
                })
        {
            unmatched_destination_notes[destination_index] = false;
        } else {
            unmatched_source_notes.push(source_index);
        }
    }

    let duplicate_note_keys = duplicate_keys(source.notes.iter().map(|note| note.key.as_str()));
    let mut missing_notes = Vec::new();
    let mut changed_notes = Vec::new();
    for source_index in unmatched_source_notes {
        let note = &source.notes[source_index];
        if let Some(destination_index) =
            destination
                .notes
                .iter()
                .enumerate()
                .find_map(|(index, candidate)| {
                    (unmatched_destination_notes[index] && candidate.key == note.key)
                        .then_some(index)
                })
        {
            unmatched_destination_notes[destination_index] = false;
            changed_notes.push(entry_label(
                &note.title,
                &note.path,
                duplicate_note_keys.contains(note.key.as_str()),
            ));
        } else {
            missing_notes.push(entry_label(
                &note.title,
                &note.path,
                duplicate_note_keys.contains(note.key.as_str()),
            ));
        }
    }

    let duplicate_attachment_keys = duplicate_keys(
        source
            .attachments
            .iter()
            .map(|attachment| attachment.key.as_str()),
    );
    let mut destination_attachment_fingerprints = fingerprint_counts(&destination.attachments);
    let mut missing_attachments = Vec::new();
    for asset in &source.attachments {
        match destination_attachment_fingerprints.get_mut(asset.fingerprint.as_str()) {
            Some(count) if *count > 0 => *count -= 1,
            _ => missing_attachments.push(entry_label(
                &asset.name,
                &asset.path,
                duplicate_attachment_keys.contains(asset.key.as_str()),
            )),
        }
    }
    let added_attachments = destination_attachment_fingerprints.values().sum();
    let verdict =
        if missing_notes.is_empty() && changed_notes.is_empty() && missing_attachments.is_empty() {
            "pass"
        } else {
            "loss-detected"
        }
        .to_string();
    CompareReport {
        schema_version: SCHEMA_VERSION,
        source: source.totals.clone(),
        destination: destination.totals.clone(),
        missing_notes,
        changed_notes,
        missing_attachments,
        added_notes: unmatched_destination_notes
            .into_iter()
            .filter(|matched| *matched)
            .count(),
        added_attachments,
        verdict,
    }
}

fn duplicate_keys<'a>(keys: impl Iterator<Item = &'a str>) -> HashSet<&'a str> {
    let mut counts = BTreeMap::new();
    for key in keys {
        *counts.entry(key).or_insert(0usize) += 1;
    }
    counts
        .into_iter()
        .filter_map(|(key, count)| (count > 1).then_some(key))
        .collect()
}

fn fingerprint_counts(attachments: &[AttachmentEntry]) -> BTreeMap<&str, usize> {
    let mut counts = BTreeMap::new();
    for attachment in attachments {
        *counts
            .entry(attachment.fingerprint.as_str())
            .or_insert(0usize) += 1;
    }
    counts
}

fn entry_label(name: &str, path: &str, has_collision: bool) -> String {
    if has_collision && !path.is_empty() {
        format!("{name} [{path}]")
    } else {
        name.to_string()
    }
}

pub fn human_scan(report: &ScanReport) -> String {
    let mut out = format!(
        "PREFLIGHT MANIFEST\n{}\n\nNotebooks {:>8}\nNotes     {:>8}\nAttachments{:>7}  ({})\nLinks      {:>7}  ({} unresolved)\n\n",
        report.source,
        report.totals.notebooks,
        report.totals.notes,
        report.totals.attachments,
        human_bytes(report.totals.attachment_bytes),
        report.links.external + report.links.internal + report.links.local_file,
        report.links.unresolved,
    );
    if report.risks.is_empty() {
        out.push_str("RISKS\nNo sampled conversion risks found.\n");
    } else {
        out.push_str("RISKS\n");
        for risk in &report.risks {
            out.push_str(&format!(
                "[{}] {} ×{}\n",
                risk.severity.to_uppercase(),
                risk.label,
                risk.count
            ));
        }
    }
    for warning in &report.warnings {
        out.push_str(&format!("\nWARNING: {warning}\n"));
    }
    out
}

pub fn human_compare(report: &CompareReport) -> String {
    let mark = if report.verdict == "pass" {
        "PASS"
    } else {
        "LOSS DETECTED"
    };
    let mut out = format!("MIGRATION CHECK: {mark}\n\nSource:      {} notes / {} attachments\nDestination: {} notes / {} attachments\n", report.source.notes, report.source.attachments, report.destination.notes, report.destination.attachments);
    if !report.missing_notes.is_empty() {
        out.push_str(&format!(
            "\nMissing notes ({}):\n",
            report.missing_notes.len()
        ));
        for name in &report.missing_notes {
            out.push_str(&format!("  - {name}\n"));
        }
    }
    if !report.missing_attachments.is_empty() {
        out.push_str(&format!(
            "\nMissing attachments ({}):\n",
            report.missing_attachments.len()
        ));
        for name in &report.missing_attachments {
            out.push_str(&format!("  - {name}\n"));
        }
    }
    if !report.changed_notes.is_empty() {
        out.push_str(&format!(
            "\nChanged note bodies: {} (review samples after conversion)\n",
            report.changed_notes.len()
        ));
    }
    out
}

fn human_bytes(value: u64) -> String {
    if value >= 1024 * 1024 * 1024 {
        format!("{:.1} GiB", value as f64 / 1024.0 / 1024.0 / 1024.0)
    } else if value >= 1024 * 1024 {
        format!("{:.1} MiB", value as f64 / 1024.0 / 1024.0)
    } else if value >= 1024 {
        format!("{:.1} KiB", value as f64 / 1024.0)
    } else {
        format!("{value} B")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    #[test]
    fn scans_documented_directory_and_finds_risks() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("Work")).unwrap();
        fs::write(root.path().join("Work/plan.md"), "---\ncreated: 20260101\ntags: work, move\n---\n# Migration plan\n- [ ] Keep [[Links]]\n![receipt](receipt.png)").unwrap();
        fs::write(root.path().join("Work/receipt.png"), b"fake-png").unwrap();
        let report = scan_path(root.path(), Limits::default()).unwrap();
        assert_eq!(report.totals.notes, 1);
        assert_eq!(report.totals.notebooks, 1);
        assert_eq!(report.totals.attachments, 1);
        assert_eq!(report.links.unresolved, 0);
        assert!(report.risks.iter().any(|r| r.code == "task"));
        assert!(report.risks.iter().any(|r| r.code == "wiki-link"));
    }

    #[test]
    fn compare_finds_every_intentionally_missing_attachment() {
        let source_root = tempfile::tempdir().unwrap();
        let dest_root = tempfile::tempdir().unwrap();
        fs::write(source_root.path().join("one.md"), "# One").unwrap();
        fs::write(source_root.path().join("photo.jpg"), b"photo").unwrap();
        fs::write(source_root.path().join("voice.m4a"), b"voice").unwrap();
        fs::write(dest_root.path().join("one.md"), "# One").unwrap();
        let source = scan_path(source_root.path(), Limits::default()).unwrap();
        let destination = scan_path(dest_root.path(), Limits::default()).unwrap();
        let result = compare(&source, &destination);
        assert_eq!(result.missing_attachments, vec!["photo.jpg", "voice.m4a"]);
        assert_eq!(result.verdict, "loss-detected");
    }

    #[test]
    fn compare_keeps_duplicate_titles_and_same_sized_attachment_bytes_distinct() {
        let source_root = tempfile::tempdir().unwrap();
        let destination_root = tempfile::tempdir().unwrap();
        fs::create_dir_all(source_root.path().join("A")).unwrap();
        fs::create_dir_all(source_root.path().join("B")).unwrap();
        fs::create_dir_all(destination_root.path().join("C")).unwrap();
        fs::write(source_root.path().join("A/note.md"), "# Same\nAlpha").unwrap();
        fs::write(source_root.path().join("A/receipt.jpg"), b"aaa").unwrap();
        fs::write(source_root.path().join("B/note.md"), "# Same\nBravo").unwrap();
        fs::write(source_root.path().join("B/receipt.jpg"), b"bbb").unwrap();
        fs::write(destination_root.path().join("C/note.md"), "# Same\nBravo").unwrap();
        fs::write(destination_root.path().join("C/receipt.jpg"), b"aaa").unwrap();

        let source = scan_path(source_root.path(), Limits::default()).unwrap();
        let destination = scan_path(destination_root.path(), Limits::default()).unwrap();
        let result = compare(&source, &destination);

        assert_eq!(result.missing_notes, vec!["Same [A/note.md]"]);
        assert_eq!(
            result.missing_attachments,
            vec!["receipt.jpg [B/receipt.jpg]"]
        );
        assert!(result.changed_notes.is_empty());
        assert_eq!(result.verdict, "loss-detected");
    }

    #[test]
    fn changed_note_is_a_loss_for_automation() {
        let source_root = tempfile::tempdir().unwrap();
        let destination_root = tempfile::tempdir().unwrap();
        fs::write(source_root.path().join("one.md"), "# One\nSource").unwrap();
        fs::write(destination_root.path().join("one.md"), "# One\nChanged").unwrap();
        let source = scan_path(source_root.path(), Limits::default()).unwrap();
        let destination = scan_path(destination_root.path(), Limits::default()).unwrap();
        let result = compare(&source, &destination);

        assert_eq!(result.changed_notes, vec!["One"]);
        assert_eq!(result.verdict, "loss-detected");
    }

    #[test]
    fn scans_zip_without_extracting_and_rejects_traversal() {
        let root = tempfile::tempdir().unwrap();
        let zip_path = root.path().join("notes.zip");
        let file = File::create(&zip_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        zip.start_file("Personal/note.md", zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"# A note").unwrap();
        zip.finish().unwrap();
        let report = scan_path(&zip_path, Limits::default()).unwrap();
        assert_eq!(report.totals.notes, 1);
        assert_eq!(report.source_kind, "zip");

        let unsafe_path = root.path().join("unsafe.zip");
        let file = File::create(&unsafe_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        zip.start_file("../outside.md", zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"# Must not escape").unwrap();
        zip.finish().unwrap();
        let error = scan_path(&unsafe_path, Limits::default()).unwrap_err();
        assert!(error.contains("unsafe ZIP path"));
    }

    #[test]
    fn parses_enex_notes_and_embedded_resources() {
        let root = tempfile::tempdir().unwrap();
        fs::write(root.path().join("archive.enex"), r#"<en-export><note><title>Trip</title><created>20260101</created><content><![CDATA[<en-note>Map</en-note>]]></content><resource><data type="image/png">aW1hZ2U=</data><resource-attributes><file-name>map.png</file-name></resource-attributes></resource></note></en-export>"#).unwrap();
        let report = scan_path(root.path(), Limits::default()).unwrap();
        assert_eq!(report.totals.notes, 1);
        assert_eq!(report.totals.attachments, 1);
        assert_eq!(report.attachments[0].bytes, 5);
    }
}
