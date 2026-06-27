use axum::{Json, http::StatusCode, response::IntoResponse};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::Path;

#[derive(Deserialize)]
pub struct PrepareSourceRequest {
    pub repo: String,
    pub branch: String,
}

#[derive(Serialize)]
pub struct PrepareSourceResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<SourceInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recoverable: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceInfo {
    pub kind: String,
    pub repo: String,
    pub branch: String,
    pub clone_path: String,
    pub target_path: String,
    pub validated: bool,
}

pub async fn prepare_github_source(
    Json(req): Json<PrepareSourceRequest>,
) -> impl IntoResponse {
    // 1. Security Check: Allowlist
    let allowed_repo = "https://github.com/RAGton/Kryonixos.git";
    if req.repo != allowed_repo {
        return (
            StatusCode::BAD_REQUEST,
            Json(PrepareSourceResponse {
                ok: false,
                source: None,
                code: Some("SOURCE_GITHUB_FORBIDDEN".into()),
                message: Some("Repositório não autorizado.".into()),
                details: Some(serde_json::json!({
                    "repo": req.repo,
                    "allowed": allowed_repo,
                    "stage": "security_check"
                })),
                recoverable: Some(true),
            })
        ).into_response();
    }

    let clone_path = "/run/kryonix-installer/sources/kryonixos";

    // 2. Prepare directory
    let path = Path::new(clone_path);
    if path.exists() {
        let _ = tokio::fs::remove_dir_all(path).await;
    }

    // Ensure parent directories exist
    if let Some(parent) = path.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(PrepareSourceResponse {
                    ok: false,
                    source: None,
                    code: Some("SOURCE_GITHUB_FS_ERROR".into()),
                    message: Some("Não foi possível criar o diretório temporário.".into()),
                    details: Some(serde_json::json!({
                        "path": parent.to_string_lossy(),
                        "error": e.to_string(),
                        "stage": "fs_prepare"
                    })),
                    recoverable: Some(true),
                })
            ).into_response();
        }
    }

    // 3. Git Clone (Safe, without shell interpolation)
    let output = match tokio::process::Command::new("git")
        .arg("clone")
        .arg("--depth")
        .arg("1")
        .arg("--branch")
        .arg(&req.branch)
        .arg(&req.repo)
        .arg(clone_path)
        .output()
        .await
    {
        Ok(out) => out,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(PrepareSourceResponse {
                    ok: false,
                    source: None,
                    code: Some("SOURCE_GITHUB_CLONE_FAILED".into()),
                    message: Some("Falha ao executar o comando git.".into()),
                    details: Some(serde_json::json!({
                        "repo": req.repo,
                        "error": e.to_string(),
                        "stage": "git_clone_spawn"
                    })),
                    recoverable: Some(true),
                })
            ).into_response();
        }
    };

    if !output.status.success() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(PrepareSourceResponse {
                ok: false,
                source: None,
                code: Some("SOURCE_GITHUB_CLONE_FAILED".into()),
                message: Some("Não foi possível clonar o repositório KryonixOS.".into()),
                details: Some(serde_json::json!({
                    "repo": req.repo,
                    "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
                    "stage": "git_clone"
                })),
                recoverable: Some(true),
            })
        ).into_response();
    }

    // 4. Validate flake.nix
    let flake_path = path.join("flake.nix");
    if !flake_path.exists() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(PrepareSourceResponse {
                ok: false,
                source: None,
                code: Some("SOURCE_GITHUB_INVALID_FLAKE".into()),
                message: Some("O repositório clonado não possui um flake.nix válido.".into()),
                details: Some(serde_json::json!({
                    "repo": req.repo,
                    "stage": "flake_check"
                })),
                recoverable: Some(true),
            })
        ).into_response();
    }

    // Success response
    (
        StatusCode::OK,
        Json(PrepareSourceResponse {
            ok: true,
            source: Some(SourceInfo {
                kind: "github".into(),
                repo: req.repo,
                branch: req.branch,
                clone_path: clone_path.into(),
                target_path: "/etc/kryonixos".into(),
                validated: true,
            }),
            code: None,
            message: None,
            details: None,
            recoverable: None,
        })
    ).into_response()
}
