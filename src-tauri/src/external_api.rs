use axum::{
    routing::get,
    Router,
    Json,
};
use serde_json::json;
use std::net::SocketAddr;

/// Configuration for the external API server
#[derive(Clone)]
pub struct ExternalApiConfig {
    pub port: u16,
    pub host: String,
}

/// Creates the external API router with health and root endpoints
pub fn create_external_api_router(config: ExternalApiConfig) -> Router {
    Router::new()
        .route("/api/health", get(health_handler))
        .route("/", get(root_handler))
        .with_state(config)
}

/// Health check handler
async fn health_handler(
    axum::extract::State(config): axum::extract::State<ExternalApiConfig>,
) -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "port": config.port
    }))
}

/// Root handler
async fn root_handler(
    axum::extract::State(config): axum::extract::State<ExternalApiConfig>,
) -> Json<serde_json::Value> {
    Json(json!({
        "message": "Wealthfolio External API",
        "status": "running",
        "port": config.port
    }))
}

/// Starts the external API server
pub async fn start_external_api(config: ExternalApiConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let app = create_external_api_router(config.clone());

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    println!("🚀 External API Server ready at http://{}:{}", config.host, config.port);
    println!("📊 Health endpoint: http://{}:{}/api/health", config.host, config.port);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
