use anyhow::Context;
use chrono::{DateTime, FixedOffset, Utc};
use rocket::serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct SourceConfig {
    pub path: String,
    #[serde(default)]
    pub include_globs: Vec<String>,
    #[serde(default)]
    pub exclude_globs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub default_timezone: String,
    pub multiline_enabled: bool,
    pub timestamp_regex: String,
    pub sources: Vec<SourceConfig>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct CreateProjectRequest {
    pub name: String,
    #[serde(default)]
    pub sources: Vec<SourceConfig>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub default_timezone: Option<String>,
    pub multiline_enabled: Option<bool>,
    pub timestamp_regex: Option<String>,
    pub sources: Option<Vec<SourceConfig>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(crate = "rocket::serde")]
struct ProjectsFile {
    projects: Vec<Project>,
}

#[derive(Clone)]
pub struct ProjectStore {
    data_file: PathBuf,
    inner: std::sync::Arc<RwLock<HashMap<String, Project>>>,
}

impl ProjectStore {
    pub async fn load(data_dir: &Path) -> anyhow::Result<Self> {
        tokio::fs::create_dir_all(data_dir)
            .await
            .with_context(|| format!("create data dir: {}", data_dir.display()))?;

        let data_file = data_dir.join("projects.json");

        let mut map = HashMap::<String, Project>::new();
        if tokio::fs::try_exists(&data_file).await.unwrap_or(false) {
            let raw = tokio::fs::read_to_string(&data_file)
                .await
                .with_context(|| format!("read projects file: {}", data_file.display()))?;
            if !raw.trim().is_empty() {
                let parsed: ProjectsFile = serde_json::from_str(&raw)
                    .with_context(|| format!("parse projects file: {}", data_file.display()))?;
                for p in parsed.projects {
                    map.insert(p.id.clone(), p);
                }
            }
        }

        Ok(Self {
            data_file,
            inner: std::sync::Arc::new(RwLock::new(map)),
        })
    }

    pub async fn list(&self) -> Vec<Project> {
        let guard = self.inner.read().await;
        let mut items: Vec<Project> = guard.values().cloned().collect();
        items.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        items
    }

    pub async fn get(&self, id: &str) -> Option<Project> {
        let guard = self.inner.read().await;
        guard.get(id).cloned()
    }

    pub async fn create(&self, req: CreateProjectRequest) -> anyhow::Result<Project> {
        let now = now_rfc3339();
        let project = Project {
            id: Uuid::new_v4().to_string(),
            name: req.name,
            default_timezone: "+08:00".to_string(),
            multiline_enabled: true,
            timestamp_regex: r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:\s?[+-]\d{2}:\d{2})?".to_string(),
            sources: req.sources,
            created_at: now.clone(),
            updated_at: now,
        };

        {
            let mut guard = self.inner.write().await;
            guard.insert(project.id.clone(), project.clone());
        }
        self.flush().await?;

        Ok(project)
    }

    pub async fn update(&self, id: &str, req: UpdateProjectRequest) -> anyhow::Result<Option<Project>> {
        let updated = {
            let mut guard = self.inner.write().await;
            let Some(existing) = guard.get_mut(id) else {
                return Ok(None);
            };

            if let Some(name) = req.name {
                existing.name = name;
            }
            if let Some(tz) = req.default_timezone {
                existing.default_timezone = tz;
            }
            if let Some(enabled) = req.multiline_enabled {
                existing.multiline_enabled = enabled;
            }
            if let Some(re) = req.timestamp_regex {
                existing.timestamp_regex = re;
            }
            if let Some(sources) = req.sources {
                existing.sources = sources;
            }

            existing.updated_at = now_rfc3339();
            Some(existing.clone())
        };

        self.flush().await?;
        Ok(updated)
    }

    pub async fn delete(&self, id: &str) -> anyhow::Result<bool> {
        let removed = {
            let mut guard = self.inner.write().await;
            guard.remove(id).is_some()
        };

        if removed {
            self.flush().await?;
        }

        Ok(removed)
    }

    async fn flush(&self) -> anyhow::Result<()> {
        let guard = self.inner.read().await;
        let file = ProjectsFile {
            projects: guard.values().cloned().collect(),
        };
        let raw = serde_json::to_string_pretty(&file).context("serialize projects")?;

        let tmp = self.data_file.with_extension("json.tmp");
        tokio::fs::write(&tmp, raw)
            .await
            .with_context(|| format!("write tmp projects file: {}", tmp.display()))?;
        tokio::fs::rename(&tmp, &self.data_file)
            .await
            .with_context(|| format!("rename tmp to projects file: {}", self.data_file.display()))?;
        Ok(())
    }
}

fn now_rfc3339() -> String {
    // Use a fixed-offset string so we remain consistent with your default +08:00 preference.
    // We store RFC3339 strings (sortable) rather than millis for config metadata.
    let offset = FixedOffset::east_opt(8 * 3600).unwrap_or(FixedOffset::east_opt(0).unwrap());
    let local: DateTime<FixedOffset> = Utc::now().with_timezone(&offset);
    local.to_rfc3339()
}
