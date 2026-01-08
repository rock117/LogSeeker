use crate::projects::ProjectStore;
use anyhow::Context;
use chrono::{DateTime, FixedOffset};
use regex::Regex;
use rocket::serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tantivy::collector::TopDocs;
use tantivy::directory::MmapDirectory;
use tantivy::schema::{Schema, FAST, INDEXED, STORED, TEXT};
use tantivy::{doc, Index, IndexSettings, IndexWriter};
use tokio::sync::RwLock;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct IndexStatus {
    pub state: String,
    pub message: Option<String>,
    pub files_scanned: u64,
    pub events_indexed: u64,
}

#[derive(Clone)]
pub struct IndexManager {
    data_dir: PathBuf,
    statuses: Arc<RwLock<HashMap<String, IndexStatus>>>,
}

impl IndexManager {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            data_dir,
            statuses: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_status(&self, project_id: &str) -> IndexStatus {
        let guard = self.statuses.read().await;
        guard
            .get(project_id)
            .cloned()
            .unwrap_or(IndexStatus {
                state: "idle".to_string(),
                message: None,
                files_scanned: 0,
                events_indexed: 0,
            })
    }

    pub async fn start_rebuild(&self, store: ProjectStore, project_id: String) -> anyhow::Result<()> {
        {
            let mut guard = self.statuses.write().await;
            guard.insert(
                project_id.clone(),
                IndexStatus {
                    state: "running".to_string(),
                    message: None,
                    files_scanned: 0,
                    events_indexed: 0,
                },
            );
        }

        let data_dir = self.data_dir.clone();
        let statuses = self.statuses.clone();

        tokio::spawn(async move {
            let result = rebuild_index_for_project(&store, &data_dir, &project_id, &statuses).await;
            if let Err(e) = result {
                let mut guard = statuses.write().await;
                let (files_scanned, events_indexed) = guard
                    .get(&project_id)
                    .map(|s| (s.files_scanned, s.events_indexed))
                    .unwrap_or((0, 0));
                guard.insert(
                    project_id.clone(),
                    IndexStatus {
                        state: "error".to_string(),
                        message: Some(e.to_string()),
                        files_scanned,
                        events_indexed,
                    },
                );
            }
        });

        Ok(())
    }
}

async fn rebuild_index_for_project(
    store: &ProjectStore,
    data_dir: &Path,
    project_id: &str,
    statuses: &Arc<RwLock<HashMap<String, IndexStatus>>>,
) -> anyhow::Result<()> {
    let project = store
        .get(project_id)
        .await
        .ok_or_else(|| anyhow::anyhow!("project not found: {}", project_id))?;

    let ts_regex = Regex::new(&project.timestamp_regex).context("compile timestamp regex")?;

    let tz = parse_fixed_offset(&project.default_timezone).unwrap_or_else(|| FixedOffset::east_opt(8 * 3600).unwrap());

    let project_dir = data_dir.join("projects").join(project_id);
    let index_dir = project_dir.join("index");

    tokio::fs::create_dir_all(&project_dir)
        .await
        .with_context(|| format!("create project dir: {}", project_dir.display()))?;

    // Recreate the index directory (MVP approach)
    if tokio::fs::try_exists(&index_dir).await.unwrap_or(false) {
        let _ = tokio::fs::remove_dir_all(&index_dir).await;
    }
    tokio::fs::create_dir_all(&index_dir)
        .await
        .with_context(|| format!("create index dir: {}", index_dir.display()))?;

    let schema = build_schema();
    let directory = MmapDirectory::open(&index_dir).context("open index directory")?;
    let index = Index::create(directory, schema.clone(), IndexSettings::default())
        .context("create tantivy index")?;
    let mut writer = index.writer(50_000_000).context("create index writer")?;

    let ts_field = schema.get_field("timestamp").context("timestamp field")?;
    let msg_field = schema.get_field("message").context("message field")?;
    let file_field = schema.get_field("file_path").context("file_path field")?;
    let start_line_field = schema.get_field("start_line").context("start_line field")?;
    let end_line_field = schema.get_field("end_line").context("end_line field")?;

    let mut files_scanned: u64 = 0;
    let mut events_indexed: u64 = 0;

    for src in &project.sources {
        let src_path = PathBuf::from(&src.path);
        if !src_path.exists() {
            continue;
        }

        for entry in WalkDir::new(&src_path).follow_links(false) {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            if !entry.file_type().is_file() {
                continue;
            }

            let path = entry.path();
            if !is_supported_log_file(path) {
                continue;
            }

            files_scanned += 1;
            update_status(statuses, project_id, "running", None, files_scanned, events_indexed).await;

            let (added, err) = index_file(&mut writer, path, &ts_regex, tz, ts_field, msg_field, file_field, start_line_field, end_line_field).await;
            events_indexed += added;

            if let Some(e) = err {
                update_status(statuses, project_id, "error", Some(e), files_scanned, events_indexed).await;
                return Err(anyhow::anyhow!("index file failed: {}", path.display()));
            }

            update_status(statuses, project_id, "running", None, files_scanned, events_indexed).await;
        }
    }

    writer.commit().context("tantivy commit")?;

    // Quick self-check: open reader and count docs
    let reader = index.reader().context("open index reader")?;
    let searcher = reader.searcher();
    let top_docs = searcher
        .search(&tantivy::query::AllQuery, &TopDocs::with_limit(1))
        .context("search self-check")?;
    let _ = top_docs;

    update_status(
        statuses,
        project_id,
        "idle",
        Some(format!("indexed {} events", events_indexed)),
        files_scanned,
        events_indexed,
    )
    .await;

    Ok(())
}

async fn index_file(
    writer: &mut IndexWriter,
    path: &Path,
    ts_regex: &Regex,
    tz: FixedOffset,
    ts_field: tantivy::schema::Field,
    msg_field: tantivy::schema::Field,
    file_field: tantivy::schema::Field,
    start_line_field: tantivy::schema::Field,
    end_line_field: tantivy::schema::Field,
) -> (u64, Option<String>) {
    let file_path = path.to_string_lossy().to_string();

    let file = match tokio::fs::File::open(path).await {
        Ok(f) => f,
        Err(e) => return (0, Some(e.to_string())),
    };

    let mut reader = tokio::io::BufReader::new(file);
    let mut line = String::new();

    let mut cur_lines: Vec<String> = Vec::new();
    let mut cur_start_line: u64 = 0;
    let mut cur_end_line: u64 = 0;
    let mut cur_ts_millis: Option<i64> = None;

    let mut added: u64 = 0;
    let mut line_no: u64 = 0;

    loop {
        line.clear();
        let read = match tokio::io::AsyncBufReadExt::read_line(&mut reader, &mut line).await {
            Ok(n) => n,
            Err(e) => return (added, Some(e.to_string())),
        };
        if read == 0 {
            break;
        }

        line_no += 1;
        let l = line.trim_end_matches(['\r', '\n']).to_string();

        let is_new = ts_regex.is_match(l.trim_start());
        if is_new {
            if !cur_lines.is_empty() {
                if let Some(ts_millis) = cur_ts_millis {
                    let message = cur_lines.join("\n");
                    if let Err(e) = writer.add_document(doc!(
                        ts_field => ts_millis,
                        msg_field => message,
                        file_field => file_path.clone(),
                        start_line_field => cur_start_line as u64,
                        end_line_field => cur_end_line as u64,
                    )) {
                        return (added, Some(e.to_string()));
                    }
                    added += 1;
                }
            }

            cur_lines.clear();
            cur_start_line = line_no;
            cur_end_line = line_no;
            cur_ts_millis = parse_timestamp_millis(l.trim_start(), ts_regex, tz);
            cur_lines.push(l);
        } else {
            if cur_lines.is_empty() {
                // No timestamped line yet. Skip leading noise for MVP.
                continue;
            }
            cur_end_line = line_no;
            cur_lines.push(l);
        }
    }

    if !cur_lines.is_empty() {
        if let Some(ts_millis) = cur_ts_millis {
            let message = cur_lines.join("\n");
            if let Err(e) = writer.add_document(doc!(
                ts_field => ts_millis,
                msg_field => message,
                file_field => file_path.clone(),
                start_line_field => cur_start_line as u64,
                end_line_field => cur_end_line as u64,
            )) {
                return (added, Some(e.to_string()));
            }
            added += 1;
        }
    }

    (added, None)
}

fn build_schema() -> Schema {
    let mut builder = Schema::builder();
    builder.add_i64_field("timestamp", FAST | STORED | INDEXED);
    builder.add_text_field("message", TEXT | STORED);
    builder.add_text_field("file_path", STORED);
    builder.add_u64_field("start_line", STORED);
    builder.add_u64_field("end_line", STORED);
    builder.build()
}

fn is_supported_log_file(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
        return false;
    };
    matches!(ext.to_ascii_lowercase().as_str(), "log" | "txt")
}

fn parse_fixed_offset(tz: &str) -> Option<FixedOffset> {
    // tz should be like +08:00
    let tz = tz.trim();
    if tz.len() != 6 {
        return None;
    }
    let sign = if &tz[0..1] == "+" { 1 } else if &tz[0..1] == "-" { -1 } else { return None };
    let hours: i32 = tz[1..3].parse().ok()?;
    let mins: i32 = tz[4..6].parse().ok()?;
    let total = sign * (hours * 3600 + mins * 60);
    FixedOffset::east_opt(total)
}

fn parse_timestamp_millis(line: &str, ts_regex: &Regex, default_tz: FixedOffset) -> Option<i64> {
    let m = ts_regex.find(line)?;
    let mut raw = line[m.start()..m.end()].trim().to_string();

    // Normalize optional space before timezone
    if let Some(idx) = raw.rfind(' ') {
        let (left, right) = raw.split_at(idx);
        if right.trim_start().starts_with('+') || right.trim_start().starts_with('-') {
            raw = format!("{}{}", left, right.trim());
        }
    }

    // If no explicit timezone suffix, append default.
    // We intentionally only check for a timezone at the END to avoid confusing '-' in the date.
    let has_tz_suffix = raw.ends_with("Z")
        || raw
            .chars()
            .rev()
            .take(6)
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>()
            .as_str()
            .starts_with('+')
        || raw
            .chars()
            .rev()
            .take(6)
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>()
            .as_str()
            .starts_with('-');

    if !has_tz_suffix {
        raw = format!("{}{}", raw, default_tz.to_string());
    }

    let dt: DateTime<FixedOffset> = DateTime::parse_from_rfc3339(&raw).ok()?;
    Some(dt.timestamp_millis())
}

async fn update_status(
    statuses: &Arc<RwLock<HashMap<String, IndexStatus>>>,
    project_id: &str,
    state: &str,
    message: Option<String>,
    files_scanned: u64,
    events_indexed: u64,
) {
    let mut guard = statuses.write().await;
    guard.insert(
        project_id.to_string(),
        IndexStatus {
            state: state.to_string(),
            message,
            files_scanned,
            events_indexed,
        },
    );
}
