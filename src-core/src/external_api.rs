use crate::accounts::Account;
use crate::fx::ExchangeRate;
use crate::portfolio::holdings::Holding;
use serde_json::{json, Value};

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
