use axum::{
    extract::{Path, Query},
    routing::get,
    Router,
    Json,
};
use std::net::SocketAddr;
use std::sync::Arc;

// Import from local crate
use crate::context::ServiceContext;

// Import core modules
use wealthfolio_core::{ExternalApiService, ExternalApiServiceTrait};

#[derive(Clone)]
pub struct ExternalApiConfig {
    pub port: u16,
    pub host: String,
    pub service: Arc<dyn ExternalApiServiceTrait>,
}

pub fn create_external_api_router(config: ExternalApiConfig) -> Router {
    let port = config.port;
    let service_clone = config.service.clone();

    Router::new()
        .route("/api/health", get(move || async move { Json(wealthfolio_core::external_api::health_handler(port).await) }))
        .route("/", get(move || async move { Json(wealthfolio_core::external_api::root_handler(port).await) }))
        .route("/api/portfolio/holdings", get({
            let service = service_clone.clone();
            move |Query(query): Query<wealthfolio_core::external_api::HoldingsQuery>| async move {
                Json(wealthfolio_core::external_api::portfolio_holdings_handler(service.as_ref(), query).await)
            }
        }))
        .route("/api/portfolio/accounts", get({
            let service = service_clone.clone();
            move || async move {
                Json(wealthfolio_core::external_api::portfolio_accounts_handler(service.as_ref()).await)
            }
        }))
        .route("/api/exchange-rates", get({
            let service = service_clone.clone();
            move || async move {
                Json(wealthfolio_core::external_api::exchange_rates_handler(service.as_ref()).await)
            }
        }))
        .route("/api/settings/base-currency", get({
            let service = service_clone.clone();
            move || async move {
                Json(wealthfolio_core::external_api::base_currency_handler(service.as_ref()).await)
            }
        }))
        // Market data routes
        .route("/api/market-data/search", get({
            let service = service_clone.clone();
            move |Query(query): Query<wealthfolio_core::external_api::MarketDataSearchQuery>| async move {
                Json(wealthfolio_core::external_api::market_data_search_handler(service.as_ref(), query).await)
            }
        }))
        .route("/api/market-data/quotes/{symbol}", get({
            let service = service_clone.clone();
            move |Path(symbol): Path<String>| async move {
                Json(wealthfolio_core::external_api::quote_handler(service.as_ref(), &symbol).await)
            }
        }))
        .route("/api/market-data/historical/{symbol}", get({
            let service = service_clone.clone();
            move |Path(symbol): Path<String>| async move {
                Json(wealthfolio_core::external_api::historical_quotes_handler(service.as_ref(), &symbol).await)
            }
        }))
        // Performance routes
        .route("/api/portfolio/performance/{account_id}", get({
            let service = service_clone.clone();
            move |Path(account_id): Path<String>| async move {
                Json(wealthfolio_core::external_api::account_performance_handler(service.as_ref(), &account_id).await)
            }
        }))
        .route("/api/portfolio/performance/summary", get({
            let service = service_clone.clone();
            move || async move {
                Json(wealthfolio_core::external_api::portfolio_performance_summary_handler(service.as_ref()).await)
            }
        }))
        // Activities routes
        .route("/api/portfolio/activities", get({
            let service = service_clone.clone();
            move |Query(query): Query<wealthfolio_core::external_api::ActivitiesQuery>| async move {
                Json(wealthfolio_core::external_api::activities_handler(service.as_ref(), query).await)
            }
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

/// Creates external API config from ServiceContext
pub fn create_external_api_config(
    port: u16,
    host: String,
    context: Arc<ServiceContext>
) -> ExternalApiConfig {
    let service = Arc::new(ExternalApiService::new(
        context.account_service(),
        context.holdings_service(),
        context.fx_service(),
        context.settings_service(),
        context.market_data_service(),
        context.performance_service(),
        context.activity_service(),
    ));

    ExternalApiConfig {
        port,
        host,
        service,
    }
}
