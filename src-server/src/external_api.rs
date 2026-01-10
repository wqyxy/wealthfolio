use axum::{
    extract::{Query, State},
    routing::get,
    Router,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;

// Import from local
use crate::main_lib::AppState;

// Import traits
use wealthfolio_core::accounts::AccountServiceTrait;
use wealthfolio_core::settings::SettingsServiceTrait;

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
    Json(json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "port": 3333
    }))
}

/// Root handler
async fn root_handler() -> Json<serde_json::Value> {
    Json(json!({
        "message": "Wealthfolio External API",
        "status": "running",
        "port": 3333
    }))
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
            // Convert holdings to serializable format
            let holdings_data: Vec<serde_json::Value> = holdings.into_iter()
                .map(|h| json!({
                    "id": h.id,
                    "accountId": h.account_id,
                    "holdingType": h.holding_type,
                    "instrument": h.instrument.map(|inst| json!({
                        "id": inst.id,
                        "symbol": inst.symbol,
                        "name": inst.name,
                        "currency": inst.currency,
                        "assetClass": inst.asset_class,
                        "assetSubclass": inst.asset_subclass
                    })),
                    "quantity": h.quantity,
                    "openDate": h.open_date.map(|dt| dt.to_rfc3339()),
                    "localCurrency": h.local_currency,
                    "baseCurrency": h.base_currency,
                    "fxRate": h.fx_rate,
                    "marketValue": {
                        "local": h.market_value.local,
                        "base": h.market_value.base
                    },
                    "costBasis": h.cost_basis.map(|cb| json!({
                        "local": cb.local,
                        "base": cb.base
                    })),
                    "price": h.price,
                    "unrealizedGain": h.unrealized_gain.map(|ug| json!({
                        "local": ug.local,
                        "base": ug.base
                    })),
                    "unrealizedGainPct": h.unrealized_gain_pct,
                    "realizedGain": h.realized_gain.map(|rg| json!({
                        "local": rg.local,
                        "base": rg.base
                    })),
                    "realizedGainPct": h.realized_gain_pct,
                    "totalGain": h.total_gain.map(|tg| json!({
                        "local": tg.local,
                        "base": tg.base
                    })),
                    "totalGainPct": h.total_gain_pct,
                    "dayChange": h.day_change.map(|dc| json!({
                        "local": dc.local,
                        "base": dc.base
                    })),
                    "dayChangePct": h.day_change_pct,
                    "weight": h.weight,
                    "asOfDate": h.as_of_date.to_string()
                }))
                .collect();

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

    let accounts_data: Vec<serde_json::Value> = accounts.into_iter()
        .map(|a| json!({
            "id": a.id,
            "name": a.name,
            "accountType": a.account_type,
            "currency": a.currency,
            "isActive": a.is_active
        }))
        .collect();

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

    let rates_data: Vec<serde_json::Value> = rates.into_iter()
        .map(|r| json!({
            "from": r.from_currency,
            "to": r.to_currency,
            "rate": r.rate,
            "timestamp": r.timestamp.to_rfc3339()
        }))
        .collect();

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
