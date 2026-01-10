mod api;
mod auth;
mod config;
mod error;
mod events;
mod external_api;
mod main_lib;
mod models;
mod secrets;

use api::app_router;
use config::Config;
use main_lib::{build_state, init_tracing};
use tower_http::services::{ServeDir, ServeFile};
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env();
    init_tracing();
    let state = build_state(&config).await?;

    // Start External API server
    let external_api_state = Arc::clone(&state);
    tokio::spawn(async move {
        let external_api_config = external_api::ExternalApiConfig {
            host: "0.0.0.0".to_string(),
            port: 3333,
            state: external_api_state,
        };
        if let Err(e) = external_api::start_external_api(external_api_config).await {
            tracing::error!("Failed to start External API: {}", e);
        }
    });

    let static_dir = std::path::PathBuf::from(&config.static_dir);
    let index_file = static_dir.join("index.html");
    let static_service = ServeDir::new(static_dir).fallback(ServeFile::new(index_file));
    let router = app_router(state, &config).fallback_service(static_service);
    tracing::info!("Web server listening on {}", config.listen_addr);
    let listener = tokio::net::TcpListener::bind(config.listen_addr).await?;
    axum::serve(listener, router).await?;
    Ok(())
}
