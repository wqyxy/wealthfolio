use crate::accounts::{Account, AccountServiceTrait};
use crate::fx::{ExchangeRate, FxServiceTrait};
use crate::portfolio::holdings::{Holding, HoldingsServiceTrait};
use crate::settings::SettingsServiceTrait;
use crate::errors::Result;
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

#[async_trait]
pub trait ExternalApiServiceTrait: Send + Sync {
    async fn get_holdings(&self, account_id: Option<String>) -> Result<Value>;
    fn get_accounts(&self) -> Result<Value>;
    fn get_exchange_rates(&self) -> Result<Value>;
    fn get_base_currency(&self) -> Result<Value>;
}

#[derive(Clone)]
pub struct ExternalApiService {
    account_service: Arc<dyn AccountServiceTrait>,
    holdings_service: Arc<dyn HoldingsServiceTrait>,
    fx_service: Arc<dyn FxServiceTrait>,
    settings_service: Arc<dyn SettingsServiceTrait>,
}

impl ExternalApiService {
    pub fn new(
        account_service: Arc<dyn AccountServiceTrait>,
        holdings_service: Arc<dyn HoldingsServiceTrait>,
        fx_service: Arc<dyn FxServiceTrait>,
        settings_service: Arc<dyn SettingsServiceTrait>,
    ) -> Self {
        Self {
            account_service,
            holdings_service,
            fx_service,
            settings_service,
        }
    }
}

#[async_trait]
impl ExternalApiServiceTrait for ExternalApiService {
    async fn get_holdings(&self, account_id: Option<String>) -> Result<Value> {
        // Get base currency
        let base_currency = match self.settings_service.get_base_currency()? {
            Some(currency) => currency,
            None => return Ok(json!({"error": "Base currency not set"})),
        };

        let holdings_result: Result<Vec<crate::portfolio::holdings::Holding>> = if let Some(account_id) = account_id {
            // Get holdings for specific account
            self.holdings_service.get_holdings(&account_id, &base_currency).await
        } else {
            // Get holdings for all accounts
            let accounts = self.account_service.get_all_accounts()?;

            let mut all_holdings = Vec::new();
            for account in accounts {
                match self.holdings_service.get_holdings(&account.id, &base_currency).await {
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
                Ok(json!({
                    "holdings": holdings_data,
                    "baseCurrency": base_currency
                }))
            }
            Err(error) => Ok(json!({"error": error.to_string()})),
        }
    }

    fn get_accounts(&self) -> Result<Value> {
        let accounts = self.account_service.get_all_accounts()?;
        let accounts_data = accounts_to_json(accounts);
        Ok(json!({
            "accounts": accounts_data
        }))
    }

    fn get_exchange_rates(&self) -> Result<Value> {
        let rates = self.fx_service.get_latest_exchange_rates()?;
        let rates_data = exchange_rates_to_json(rates);
        Ok(json!({
            "exchangeRates": rates_data
        }))
    }

    fn get_base_currency(&self) -> Result<Value> {
        match self.settings_service.get_base_currency()? {
            Some(currency) => Ok(json!({
                "baseCurrency": currency
            })),
            None => Ok(json!({
                "error": "Base currency not set"
            })),
        }
    }
}

/// Convert holdings to JSON format for external API
pub fn holdings_to_json(holdings: Vec<Holding>) -> Vec<Value> {
    holdings.into_iter()
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
                "assetSubclass": inst.asset_subclass,
                "countries": inst.countries,
                "sectors": inst.sectors
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
        .collect()
}

/// Convert accounts to JSON format for external API
pub fn accounts_to_json(accounts: Vec<Account>) -> Vec<Value> {
    accounts.into_iter()
        .map(|a| json!({
            "id": a.id,
            "name": a.name,
            "accountType": a.account_type,
            "currency": a.currency,
            "isActive": a.is_active
        }))
        .collect()
}

/// Convert exchange rates to JSON format for external API
pub fn exchange_rates_to_json(rates: Vec<ExchangeRate>) -> Vec<Value> {
    rates.into_iter()
        .map(|r| json!({
            "from": r.from_currency,
            "to": r.to_currency,
            "rate": r.rate,
            "timestamp": r.timestamp.to_rfc3339()
        }))
        .collect()
}

/// Create health response JSON
pub fn create_health_response(port: u16) -> Value {
    json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "port": port
    })
}

/// Create root response JSON
pub fn create_root_response(port: u16) -> Value {
    json!({
        "message": "Wealthfolio External API",
        "status": "running",
        "port": port
    })
}

#[derive(Deserialize)]
pub struct HoldingsQuery {
    account_id: Option<String>,
}

/// Health check handler
pub async fn health_handler(port: u16) -> Value {
    create_health_response(port)
}

/// Root handler
pub async fn root_handler(port: u16) -> Value {
    create_root_response(port)
}

/// Portfolio holdings handler
pub async fn portfolio_holdings_handler(
    service: &dyn ExternalApiServiceTrait,
    query: HoldingsQuery,
) -> Value {
    match service.get_holdings(query.account_id).await {
        Ok(result) => result,
        Err(e) => json!({
            "error": format!("Internal server error: {}", e)
        }),
    }
}

/// Portfolio accounts handler
pub async fn portfolio_accounts_handler(service: &dyn ExternalApiServiceTrait) -> Value {
    match service.get_accounts() {
        Ok(result) => result,
        Err(e) => json!({
            "error": format!("Failed to get accounts: {}", e)
        }),
    }
}

/// Exchange rates handler
pub async fn exchange_rates_handler(service: &dyn ExternalApiServiceTrait) -> Value {
    match service.get_exchange_rates() {
        Ok(result) => result,
        Err(e) => json!({
            "error": format!("Failed to get exchange rates: {}", e)
        }),
    }
}

/// Base currency handler
pub async fn base_currency_handler(service: &dyn ExternalApiServiceTrait) -> Value {
    match service.get_base_currency() {
        Ok(result) => result,
        Err(e) => json!({
            "error": format!("Failed to get base currency: {}", e)
        }),
    }
}
