use anyhow::Context;
use rocket::fs::{relative, FileServer};
use rocket::serde::json::Json;
use rocket::{delete, get, post, put, routes, Build, Rocket, State};
use serde::Serialize;
use std::path::PathBuf;

mod indexing;
mod projects;
use indexing::{IndexManager, IndexStatus};
use projects::{CreateProjectRequest, Project, ProjectStore, UpdateProjectRequest};

#[derive(Clone)]
struct AppConfig {
    base_url: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Serialize)]
struct HealthResponse {
    ok: bool,
    server_time: String,
}

#[get("/api/health")]
fn health() -> Json<HealthResponse> {
    let now = chrono::Local::now().to_rfc3339();
    Json(HealthResponse {
        ok: true,
        server_time: now,
    })
}

#[get("/api/config")]
fn config(cfg: &State<AppConfig>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "base_url": cfg.base_url
    }))
}

#[get("/api/projects")]
async fn list_projects(store: &State<ProjectStore>) -> Json<Vec<Project>> {
    Json(store.list().await)
}

#[post("/api/projects", data = "<req>")]
async fn create_project(
    store: &State<ProjectStore>,
    req: Json<CreateProjectRequest>,
) -> Result<Json<Project>, Json<ErrorResponse>> {
    let created = store
        .create(req.into_inner())
        .await
        .map_err(|e| Json(ErrorResponse {
            error: e.to_string(),
        }))?;

    Ok(Json(created))
}

#[get("/api/projects/<id>")]
async fn get_project(store: &State<ProjectStore>, id: &str) -> Option<Json<Project>> {
    store.get(id).await.map(Json)
}

#[put("/api/projects/<id>", data = "<req>")]
async fn update_project(
    store: &State<ProjectStore>,
    id: &str,
    req: Json<UpdateProjectRequest>,
) -> Result<Option<Json<Project>>, Json<ErrorResponse>> {
    let updated = store
        .update(id, req.into_inner())
        .await
        .map_err(|e| Json(ErrorResponse {
            error: e.to_string(),
        }))?;

    Ok(updated.map(Json))
}

#[delete("/api/projects/<id>")]
async fn delete_project(
    store: &State<ProjectStore>,
    id: &str,
) -> Result<Json<serde_json::Value>, Json<ErrorResponse>> {
    let removed = store
        .delete(id)
        .await
        .map_err(|e| Json(ErrorResponse {
            error: e.to_string(),
        }))?;

    Ok(Json(serde_json::json!({ "removed": removed })))
}

#[get("/api/projects/<id>/index/status")]
async fn get_index_status(manager: &State<IndexManager>, id: &str) -> Json<IndexStatus> {
    Json(manager.get_status(id).await)
}

#[post("/api/projects/<id>/index/rebuild")]
async fn rebuild_index(
    store: &State<ProjectStore>,
    manager: &State<IndexManager>,
    id: &str,
) -> Result<Json<serde_json::Value>, Json<ErrorResponse>> {
    manager
        .start_rebuild(store.inner().clone(), id.to_string())
        .await
        .map_err(|e| Json(ErrorResponse {
            error: e.to_string(),
        }))?;

    Ok(Json(serde_json::json!({ "started": true })))
}

async fn build_rocket() -> anyhow::Result<Rocket<Build>> {
    let port = portpicker::pick_unused_port().context("pick unused port")?;
    let base_url = format!("http://127.0.0.1:{}", port);

    println!("LogSeeker: {}", base_url);

    let data_dir = PathBuf::from(relative!("../data"));
    let store = ProjectStore::load(&data_dir).await?;
    let index_manager = IndexManager::new(data_dir.clone());

    let figment = rocket::Config::figment()
        .merge(("address", "127.0.0.1"))
        .merge(("port", port));

    let rocket = rocket::custom(figment)
        .manage(AppConfig { base_url })
        .manage(store)
        .manage(index_manager)
        .mount("/", FileServer::from(relative!("../web/dist")).rank(10))
        .mount("/", FileServer::from(relative!("static")).rank(20))
        .mount(
            "/",
            routes![
                health,
                config,
                list_projects,
                create_project,
                get_project,
                update_project,
                delete_project,
                get_index_status,
                rebuild_index
            ],
        );

    Ok(rocket)
}

#[rocket::main]
async fn main() -> anyhow::Result<()> {
    let rocket = build_rocket().await?;
    rocket.launch().await?;
    Ok(())
}
