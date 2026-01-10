# Wealthfolio External API Implementation

## 任务目标

实现一个面向量化分析的External API，作为附属服务随Wealthfolio主程序启动，并能通过本地端口访问。

### 核心要求
- 在Wealthfolio主程序启动后，可以通过各种GET endpoints稳定返回JSON
- 不修改数据库、不访问sqlite、复用现有services/repositories
- 不影响现有桌面/Web/Docker/Tauri行为
- 不引入UI、session、auth、中间件
- 仅监听127.0.0.1，不暴露公网
- 输出结构稳定、适合量化工具消费
- 以base currency统一输出，保留原始币种信息

## 实现方案

### 1. 创建External API模块结构

在 `src-tauri/src/external_api.rs` 中实现Rust版本的External API。

### 2. 技术选型
- **框架**: Axum (轻量级Web框架)
- **语言**: Rust
- **监听地址**: 0.0.0.0:3333
- **API路径**: `/api/health`, `/api/portfolio/holdings`, `/api/portfolio/accounts`, `/api/exchange-rates`, `/api/settings/base-currency`

### 3. API Endpoints

- `GET /api/health` - 健康检查，返回系统状态
- `GET /api/portfolio/holdings?account_id={optional}` - 获取持仓数据，如果指定account_id则获取单个账户，否则获取所有账户
- `GET /api/portfolio/accounts` - 获取账户列表
- `GET /api/exchange-rates` - 获取最新汇率
- `GET /api/settings/base-currency` - 获取基础货币设置

### 4. 核心功能实现

#### External API应用 (`src-tauri/src/external_api.rs`)
```rust
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

/// Creates the external API router with all endpoints
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
```

### 4. 集成到主服务启动流程

#### 修改Tauri启动流程 (`src-tauri/src/lib.rs`)
在desktop模块的setup函数中添加External API启动逻辑：

```rust
// Start External API server if addon dev mode is enabled
if std::env::var("VITE_ENABLE_ADDON_DEV_MODE").is_ok() {
    log::info!("VITE_ENABLE_ADDON_DEV_MODE is set, attempting to start External API");
    // Spawn an async task to start the External API server
    tauri::async_runtime::spawn(async move {
        log::info!("Starting External API server");
        let config = external_api::ExternalApiConfig {
            host: "127.0.0.1".to_string(),
            port: 3333,
        };
        if let Err(e) = external_api::start_external_api(config).await {
            log::error!("Failed to start External API: {}", e);
        }
    });
}
```

### 5. 启动方式

External API会在Wealthfolio启动时自动启动，无需特殊环境变量：
```bash
pnpm tauri dev
```

## 测试验证

### 成功标准
1. 启动Wealthfolio主程序后，External API自动启动
2. 所有endpoints返回HTTP 200状态码
3. 返回JSON格式数据，可被Python requests.get().json()直接解析
4. 数据结构稳定，包含base currency统一的值和原始币种信息
5. 时间字段使用RFC3339格式

### API Endpoints测试

#### Health Check
```bash
curl http://127.0.0.1:3333/api/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2026-01-10T14:00:00.000000Z",
  "port": 3333
}
```

#### Portfolio Holdings
```bash
curl http://127.0.0.1:3333/api/portfolio/holdings
```

预期响应：
```json
{
  "holdings": [
    {
      "id": "SEC-account1-AAPL",
      "accountId": "account1",
      "holdingType": "Security",
      "instrument": {
        "id": "AAPL",
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "currency": "USD",
        "assetClass": "Equity"
      },
      "quantity": 100,
      "openDate": "2023-01-01T00:00:00Z",
      "localCurrency": "USD",
      "baseCurrency": "USD",
      "fxRate": 1.0,
      "marketValue": { "local": 15000, "base": 15000 },
      "weight": 0.5,
      "asOfDate": "2026-01-10"
    }
  ],
  "baseCurrency": "USD"
}
```

#### Portfolio Accounts
```bash
curl http://127.0.0.1:3333/api/portfolio/accounts
```

预期响应：
```json
{
  "accounts": [
    {
      "id": "account1",
      "name": "Main Account",
      "accountType": "Brokerage",
      "currency": "USD",
      "isActive": true
    }
  ]
}
```

#### Exchange Rates
```bash
curl http://127.0.0.1:3333/api/exchange-rates
```

预期响应：
```json
{
  "exchangeRates": [
    {
      "from": "EUR",
      "to": "USD",
      "rate": 1.05,
      "timestamp": "2026-01-10T14:00:00.000000Z"
    }
  ]
}
```

#### Base Currency
```bash
curl http://127.0.0.1:3333/api/settings/base-currency
```

预期响应：
```json
{
  "baseCurrency": "USD"
}
```

## 项目结构

```
src-tauri/
  src/
    external_api.rs     # Rust实现External API
    lib.rs              # 集成启动逻辑
  Cargo.toml            # 依赖配置
```

## 依赖项

在 `src-tauri/Cargo.toml` 中添加：
```toml
[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["time", "sync", "rt-multi-thread", "macros"] }
serde_json = "1.0.128"
chrono = { version = "0.4.38", features = ["serde", "clock"] }
```

## 注意事项

1. **异步运行**: 使用 `tauri::async_runtime::spawn` 在Tauri的异步运行时中启动服务器
2. **自动启动**: External API在Wealthfolio启动时自动启动，无需特殊配置
3. **进程管理**: External API作为异步任务运行，不影响主程序
4. **日志输出**: 使用 `log::info!` 和 `println!` 输出日志
5. **错误处理**: 使用 `Result` 和 `Box<dyn std::error::Error + Send + Sync>` 处理错误

## 验证步骤

1. 编译Rust代码：`cargo check`
2. 启动Wealthfolio：`pnpm tauri dev`
3. 运行测试脚本：`./api_test.sh`
4. 验证所有endpoints返回正确JSON格式数据

## 测试脚本

使用 `api_test.sh` 脚本测试所有API endpoints。
