use crate::accounts::{Account, AccountServiceTrait};
use crate::activities::{Activity, ActivityServiceTrait};
use crate::fx::{ExchangeRate, FxServiceTrait};
use crate::market_data::market_data_model::{Quote, QuoteSummary};
use crate::market_data::MarketDataServiceTrait;
use crate::portfolio::holdings::{Holding, HoldingsServiceTrait};
use crate::portfolio::performance::{PerformanceMetrics, PerformanceServiceTrait, SimplePerformanceMetrics};
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

    // Market data methods
    async fn search_market_data(&self, query: &str) -> Result<Value>;
    fn get_quote(&self, symbol: &str) -> Result<Value>;
    fn get_historical_quotes(&self, symbol: &str) -> Result<Value>;

    // Performance methods
    async fn get_account_performance(&self, account_id: &str) -> Result<Value>;
    fn get_portfolio_performance_summary(&self) -> Result<Value>;

    // Activities methods
    fn get_activities(&self, account_id: Option<String>) -> Result<Value>;
}

#[derive(Clone)]
pub struct ExternalApiService {
    account_service: Arc<dyn AccountServiceTrait>,
    holdings_service: Arc<dyn HoldingsServiceTrait>,
    fx_service: Arc<dyn FxServiceTrait>,
    settings_service: Arc<dyn SettingsServiceTrait>,
    market_data_service: Arc<dyn MarketDataServiceTrait>,
    performance_service: Arc<dyn PerformanceServiceTrait>,
    activity_service: Arc<dyn ActivityServiceTrait>,
}

impl ExternalApiService {
    pub fn new(
        account_service: Arc<dyn AccountServiceTrait>,
        holdings_service: Arc<dyn HoldingsServiceTrait>,
        fx_service: Arc<dyn FxServiceTrait>,
        settings_service: Arc<dyn SettingsServiceTrait>,
        market_data_service: Arc<dyn MarketDataServiceTrait>,
        performance_service: Arc<dyn PerformanceServiceTrait>,
        activity_service: Arc<dyn ActivityServiceTrait>,
    ) -> Self {
        Self {
            account_service,
            holdings_service,
            fx_service,
            settings_service,
            market_data_service,
            performance_service,
            activity_service,
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

    // Market data methods
    async fn search_market_data(&self, query: &str) -> Result<Value> {
        let results = self.market_data_service.search_symbol(query).await?;
        let results_data = quote_summaries_to_json(results);
        Ok(json!({
            "results": results_data
        }))
    }

    fn get_quote(&self, symbol: &str) -> Result<Value> {
        let quote = self.market_data_service.get_latest_quote_for_symbol(symbol)?;
        let quote_data = quote_to_json(quote);
        Ok(json!({
            "quote": quote_data
        }))
    }

    fn get_historical_quotes(&self, symbol: &str) -> Result<Value> {
        let quotes = self.market_data_service.get_historical_quotes_for_symbol(symbol)?;
        let quotes_data = quotes_to_json(quotes);
        Ok(json!({
            "symbol": symbol,
            "quotes": quotes_data
        }))
    }

    // Performance methods
    async fn get_account_performance(&self, account_id: &str) -> Result<Value> {
        let performance = self.performance_service.calculate_performance_summary(
            "account",
            account_id,
            None,
            None,
        ).await?;
        let performance_data = performance_to_json(performance);
        Ok(json!({
            "accountId": account_id,
            "performance": performance_data
        }))
    }

    fn get_portfolio_performance_summary(&self) -> Result<Value> {
        let accounts = self.account_service.get_all_accounts()?;
        let account_ids: Vec<String> = accounts.iter().map(|a| a.id.clone()).collect();
        let performances = self.performance_service.calculate_accounts_simple_performance(&account_ids)?;
        let performances_data = simple_performances_to_json(performances);
        Ok(json!({
            "performances": performances_data
        }))
    }

    // Activities methods
    fn get_activities(&self, account_id: Option<String>) -> Result<Value> {
        let activities = match account_id {
            Some(account_id) => self.activity_service.get_activities_by_account_id(&account_id)?,
            None => self.activity_service.get_activities()?,
        };
        let activities_data = activities_to_json(activities);
        Ok(json!({
            "activities": activities_data
        }))
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

/// Convert quote summaries to JSON format for external API
pub fn quote_summaries_to_json(summaries: Vec<QuoteSummary>) -> Vec<Value> {
    summaries.into_iter()
        .map(|s| json!({
            "symbol": s.symbol,
            "exchange": s.exchange,
            "name": s.short_name,
            "type": s.quote_type
        }))
        .collect()
}

/// Convert quote to JSON format for external API
pub fn quote_to_json(quote: Quote) -> Value {
    json!({
        "id": quote.id,
        "symbol": quote.symbol,
        "timestamp": quote.timestamp.to_rfc3339(),
        "open": quote.open,
        "high": quote.high,
        "low": quote.low,
        "close": quote.close,
        "volume": quote.volume,
        "currency": quote.currency,
        "dataSource": quote.data_source
    })
}

/// Convert quotes to JSON format for external API
pub fn quotes_to_json(quotes: Vec<Quote>) -> Vec<Value> {
    quotes.into_iter()
        .map(|q| quote_to_json(q))
        .collect()
}

/// Convert performance metrics to JSON format for external API
pub fn performance_to_json(performance: PerformanceMetrics) -> Value {
    json!({
        "id": performance.id,
        "currency": performance.currency,
        "periodStartDate": performance.period_start_date.map(|d| d.to_string()),
        "periodEndDate": performance.period_end_date.map(|d| d.to_string()),
        "cumulativeTWR": performance.cumulative_twr,
        "gainLossAmount": performance.gain_loss_amount,
        "annualizedTWR": performance.annualized_twr,
        "simpleReturn": performance.simple_return,
        "annualizedSimpleReturn": performance.annualized_simple_return,
        "volatility": performance.volatility,
        "maxDrawdown": performance.max_drawdown
    })
}

/// Convert simple performance metrics to JSON format for external API
pub fn simple_performances_to_json(performances: Vec<SimplePerformanceMetrics>) -> Vec<Value> {
    performances.into_iter()
        .map(|p| json!({
            "accountId": p.account_id,
            "totalValue": p.total_value,
            "accountCurrency": p.account_currency,
            "baseCurrency": p.base_currency,
            "fxRateToBase": p.fx_rate_to_base,
            "totalGainLossAmount": p.total_gain_loss_amount,
            "cumulativeReturnPercent": p.cumulative_return_percent,
            "dayGainLossAmount": p.day_gain_loss_amount,
            "dayReturnPercentModDietz": p.day_return_percent_mod_dietz,
            "portfolioWeight": p.portfolio_weight
        }))
        .collect()
}

/// Convert activities to JSON format for external API
pub fn activities_to_json(activities: Vec<Activity>) -> Vec<Value> {
    activities.into_iter()
        .map(|a| json!({
            "id": a.id,
            "accountId": a.account_id,
            "activityType": a.activity_type,
            "date": a.activity_date.to_rfc3339(),
            "assetId": a.asset_id,
            "quantity": a.quantity,
            "price": a.unit_price,
            "currency": a.currency,
            "fee": a.fee,
            "totalAmount": a.amount
        }))
        .collect()
}

/// Market data search query
#[derive(Deserialize)]
pub struct MarketDataSearchQuery {
    q: String,
}

/// Quote symbol parameter
#[derive(Deserialize)]
pub struct QuoteSymbolParam {
    symbol: String,
}

/// Performance account parameter
#[derive(Deserialize)]
pub struct PerformanceAccountParam {
    account_id: String,
}

/// Activities query
#[derive(Deserialize)]
pub struct ActivitiesQuery {
    account_id: Option<String>,
}

/// Market data search handler
pub async fn market_data_search_handler(
    service: &dyn ExternalApiServiceTrait,
    query: MarketDataSearchQuery,
) -> Value {
    match service.search_market_data(&query.q).await {
        Ok(result) => result,
        Err(e) => json!({
            "error": format!("Failed to search market data: {}", e)
        }),
    }
}

/// Quote handler
pub async fn quote_handler(
    service: &dyn ExternalApiServiceTrait,
    symbol: &str,
) -> Value {
    match service.get_quote(symbol) {
        Ok(result) => result,
        Err(e) => json!({
            "error": format!("Failed to get quote for {}: {}", symbol, e)
        }),
    }
}

/// Historical quotes handler
pub async fn historical_quotes_handler(
    service: &dyn ExternalApiServiceTrait,
    symbol: &str,
) -> Value {
    match service.get_historical_quotes(symbol) {
        Ok(result) => result,
        Err(e) => json!({
            "error": format!("Failed to get historical quotes for {}: {}", symbol, e)
        }),
    }
}

/// Account performance handler
pub async fn account_performance_handler(
    service: &dyn ExternalApiServiceTrait,
    account_id: &str,
) -> Value {
    match service.get_account_performance(account_id).await {
        Ok(result) => result,
        Err(e) => json!({
            "error": format!("Failed to get performance for account {}: {}", account_id, e)
        }),
    }
}

/// Portfolio performance summary handler
pub async fn portfolio_performance_summary_handler(service: &dyn ExternalApiServiceTrait) -> Value {
    match service.get_portfolio_performance_summary() {
        Ok(result) => result,
        Err(e) => json!({
            "error": format!("Failed to get portfolio performance summary: {}", e)
        }),
    }
}

/// Activities handler
pub async fn activities_handler(
    service: &dyn ExternalApiServiceTrait,
    query: ActivitiesQuery,
) -> Value {
    match service.get_activities(query.account_id) {
        Ok(result) => result,
        Err(e) => json!({
            "error": format!("Failed to get activities: {}", e)
        }),
    }
}
