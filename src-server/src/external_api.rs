use axum::{
    extract::{Query, State},
    routing::get,
    Router,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;

// Import from local
use crate::main_lib::AppState;

// Import core modules
use wealthfolio_core::accounts::AccountServiceTrait;
use wealthfolio_core::settings::SettingsServiceTrait;
use wealthfolio_core::external_api::{holdings_to_json, accounts_to_json, exchange_rates_to_json, create_health_response, create_root_response};

#[derive(Clone)]
pub struct ExternalApiConfig {
    pub port: u16,
    pub host: String,
    pub state: Arc<AppState>,
}

pub fn create_external_api_router(config: ExternalApiConfig) -> Router {
    Router::new()
        .route("/api/health", get(health_handler))
        .route("/", get(root_handler))
        .route("/api/portfolio/holdings", get(portfolio_holdings_handler))
        .route("/api/portfolio/accounts", get(portfolio_accounts_handler))
        .route("/api/exchange-rates", get(exchange_rates_handler))
        .route("/api/settings/base-currency", get(base_currency_handler))
        .with_state(config)
}

/// Health check handler
async fn health_handler() -> Json<serde_json::Value> {
    Json(create_health_response(3333))
}

/// Root handler
async fn root_handler() -> Json<serde_json::Value> {
    Json(create_root_response(3333))
}

#[derive(Deserialize)]
struct HoldingsQuery {
    account_id: Option<String>,
}

/// Portfolio holdings handler
async fn portfolio_holdings_handler(
    State(config): State<ExternalApiConfig>,
    Query(query): Query<HoldingsQuery>,
) -> Json<serde_json::Value> {
    let state = &config.state;

    // Get base currency
    let base_currency = match state.settings_service.get_base_currency() {
        Ok(Some(currency)) => currency,
        Ok(None) => return Json(json!({
            "error": "Base currency not set"
        })),
        Err(e) => {
            return Json(json!({
                "error": format!("Failed to get base currency: {}", e)
            }));
        }
    };

    let holdings_result = if let Some(account_id) = query.account_id {
        // Get holdings for specific account
        match state.holdings_service.get_holdings(&account_id, &base_currency).await {
            Ok(holdings) => Ok(holdings),
            Err(e) => Err(format!("Failed to get holdings for account {}: {}", account_id, e)),
        }
    } else {
        // Get holdings for all accounts
        let accounts: Vec<wealthfolio_core::accounts::Account> = match state.account_service.get_all_accounts() {
            Ok(accs) => accs,
            Err(e) => return Json(json!({
                "error": format!("Failed to get accounts: {}", e)
            })),
        };

        let mut all_holdings = Vec::new();
        for account in accounts {
            match state.holdings_service.get_holdings(&account.id, &base_currency).await {
                Ok(mut holdings) => all_holdings.append(&mut holdings),
                Err(e) => {
                    eprintln!("Failed to get holdings for account {}: {}", account.id, e);
                }
            }
        }
        Ok(all_holdings)
    };

    match holdings_result {
        Ok(holdings) => {
            let holdings_data = holdings_to_json(holdings);
            Json(json!({
                "holdings": holdings_data,
                "baseCurrency": base_currency
            }))
        }
        Err(error) => Json(json!({
            "error": error
        })),
    }
}

/// Portfolio accounts handler
async fn portfolio_accounts_handler(
    State(config): State<ExternalApiConfig>,
) -> Json<serde_json::Value> {
    let accounts: Vec<wealthfolio_core::accounts::Account> = match config.state.account_service.get_all_accounts() {
        Ok(accs) => accs,
        Err(e) => return Json(json!({
            "error": format!("Failed to get accounts: {}", e)
        })),
    };

    let accounts_data = accounts_to_json(accounts);
    Json(json!({
        "accounts": accounts_data
    }))
}

/// Exchange rates handler
async fn exchange_rates_handler(
    State(config): State<ExternalApiConfig>,
) -> Json<serde_json::Value> {
    let rates = match config.state.fx_service.get_latest_exchange_rates() {
        Ok(r) => r,
        Err(e) => return Json(json!({
            "error": format!("Failed to get exchange rates: {}", e)
        })),
    };

    let rates_data = exchange_rates_to_json(rates);
    Json(json!({
        "exchangeRates": rates_data
    }))
}

/// Base currency handler
async fn base_currency_handler(
    State(config): State<ExternalApiConfig>,
) -> Json<serde_json::Value> {
    match config.state.settings_service.get_base_currency() {
        Ok(Some(currency)) => Json(json!({
            "baseCurrency": currency
        })),
        Ok(None) => Json(json!({
            "error": "Base currency not set"
        })),
        Err(e) => Json(json!({
            "error": format!("Failed to get base currency: {}", e)
        })),
    }
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
