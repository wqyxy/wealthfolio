# Wealthfolio External API 使用指南

## 📖 概述

Wealthfolio External API 是一个专为量化分析设计的REST API，提供对投资组合数据的实时访问。API随Wealthfolio主程序自动启动，无需额外配置。

### 🎯 主要特性
- **实时数据访问**: 获取最新的投资组合数据和市场信息
- **量化分析就绪**: 结构化JSON响应，适合算法处理
- **多币种支持**: 自动汇率转换和基础货币统一
- **完整财务指标**: 市值、收益、权重等专业指标
- **高性能**: 直接访问核心业务逻辑，无UI开销

### 🔧 技术规格
- **协议**: HTTP/1.1
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证**: 无（本地API，不暴露公网）
- **限流**: 无
- **缓存**: 实时数据，无缓存

## 🚀 快速开始

### 启动API
```bash
# 桌面版本
pnpm tauri dev

# 或服务器版本
cargo run --manifest-path src-server/Cargo.toml
```

### 检查API状态
```bash
curl http://127.0.0.1:3333/api/health
```

成功响应：
```json
{
  "status": "ok",
  "timestamp": "2026-01-11T05:09:25.183011752+00:00",
  "port": 3333
}
```

### Python快速示例
```python
import requests

# 获取账户列表
response = requests.get('http://127.0.0.1:3333/api/portfolio/accounts')
accounts = response.json()['accounts']

# 获取所有持仓
response = requests.get('http://127.0.0.1:3333/api/portfolio/holdings')
holdings = response.json()

print(f"总市值: {holdings['baseCurrency']} {sum(h['marketValue']['base'] for h in holdings['holdings']):.2f}")
```

## 📋 API端点

### 基础信息

#### `GET /api/health`
健康检查端点。

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-11T05:09:25.183011752+00:00",
  "port": 3333
}
```

#### `GET /api/settings/base-currency`
获取基础货币设置。

**响应示例**:
```json
{
  "baseCurrency": "CNY"
}
```

### 账户管理

#### `GET /api/portfolio/accounts`
获取所有账户列表。

**响应示例**:
```json
{
  "accounts": [
    {
      "id": "55ccaf62-6602-489c-91f7-ce3467e1b55e",
      "name": "Guotou",
      "accountType": "SECURITIES",
      "currency": "CNY",
      "isActive": true
    },
    {
      "id": "42129ef0-ecab-4803-b3e9-9e7b10af5f6c",
      "name": "Schwab",
      "accountType": "SECURITIES",
      "currency": "USD",
      "isActive": true
    }
  ]
}
```

### 市场数据

#### `GET /api/exchange-rates`
获取最新的汇率数据。

**响应示例**:
```json
{
  "exchangeRates": [
    {
      "from": "HKD",
      "to": "CNY",
      "rate": 0.894599974155426,
      "timestamp": "2026-01-09T23:07:01+00:00"
    },
    {
      "from": "USD",
      "to": "CNY",
      "rate": 6.983099937438966,
      "timestamp": "2026-01-10T03:30:38+00:00"
    }
  ]
}
```

### 持仓数据

#### `GET /api/portfolio/holdings`
获取所有账户的持仓数据。

#### `GET /api/portfolio/holdings?account_id={account_id}`
获取特定账户的持仓数据。

**查询参数**:
- `account_id` (可选): 账户ID，用于筛选特定账户的持仓

**响应示例**:
```json
{
  "holdings": [
    {
      "id": "SEC-42129ef0-ecab-4803-b3e9-9e7b10af5f6c-BABA",
      "accountId": "42129ef0-ecab-4803-b3e9-9e7b10af5f6c",
      "holdingType": "security",
      "instrument": {
        "id": "BABA",
        "symbol": "BABA",
        "name": "Alibaba Group Holding Limited",
        "currency": "USD",
        "assetClass": "Equity",
        "assetSubclass": "Stock",
        "countries": [{"name": "China", "weight": 1.0}],
        "sectors": [{"name": "Consumer Cyclical", "weight": 1.0}]
      },
      "quantity": 225.0,
      "openDate": "2024-12-31T16:00:00+00:00",
      "localCurrency": "USD",
      "baseCurrency": "CNY",
      "fxRate": 6.983099937438966,
      "marketValue": {
        "local": 33966.00151062012,
        "base": 237187.9830238631
      },
      "costBasis": {
        "local": 27613.319,
        "base": 192826.5661813822
      },
      "price": 150.9600067138672,
      "unrealizedGain": {
        "local": 6352.682510620117,
        "base": 44361.41684248095
      },
      "unrealizedGainPct": 0.2301,
      "totalGain": {
        "local": 6352.682510620117,
        "base": 44361.41684248095
      },
      "totalGainPct": 0.2301,
      "dayChange": {
        "local": -789.7487640380859,
        "base": -5514.894544746858
      },
      "dayChangePct": -0.0227,
      "weight": 0.2766,
      "asOfDate": "2026-01-09"
    }
  ],
  "baseCurrency": "CNY"
}
```

## 📊 数据格式说明

### 货币和汇率
- **基础货币**: 所有金额自动转换为用户设置的基础货币
- **原始币种**: `localCurrency` 字段保留原始交易货币
- **汇率**: `fxRate` 字段显示转换汇率
- **双重表示**: `local` 和 `base` 字段同时提供原始和转换后的金额

### 资产分类
- **holdingType**: "security" | "cash"
- **assetClass**: "Equity" | "Fixed Income" | 等
- **assetSubclass**: "Stock" | "ETF" | "Bond" | 等

### 时间格式
- 所有时间戳使用 **RFC3339** 格式
- 示例: `2026-01-11T05:09:25.183011752+00:00`

### 数值精度
- **Decimal**: 使用高精度小数，无浮点误差
- **百分比**: 小数形式，如 0.2301 表示 23.01%

## 💻 使用示例

### Python - 获取投资组合概览

```python
import requests
import pandas as pd
from datetime import datetime

class WealthfolioAPI:
    def __init__(self, base_url="http://127.0.0.1:3333"):
        self.base_url = base_url

    def get_portfolio_summary(self):
        """获取投资组合汇总信息"""
        # 获取基础货币
        base_currency = requests.get(f"{self.base_url}/api/settings/base-currency").json()['baseCurrency']

        # 获取所有持仓
        holdings_response = requests.get(f"{self.base_url}/api/portfolio/holdings").json()

        total_value = sum(h['marketValue']['base'] for h in holdings_response['holdings'])

        # 按资产类别分组
        by_asset_class = {}
        for holding in holdings_response['holdings']:
            asset_class = holding['instrument']['assetClass'] if holding['instrument'] else 'Cash'
            value = holding['marketValue']['base']
            by_asset_class[asset_class] = by_asset_class.get(asset_class, 0) + value

        return {
            'base_currency': base_currency,
            'total_value': total_value,
            'asset_allocation': by_asset_class,
            'timestamp': datetime.now().isoformat()
        }

# 使用示例
api = WealthfolioAPI()
summary = api.get_portfolio_summary()
print(f"总市值: {summary['base_currency']} {summary['total_value']:,.2f}")
print("资产配置:")
for asset_class, value in summary['asset_allocation'].items():
    pct = value / summary['total_value'] * 100
    print(".1f")
```

### JavaScript/Node.js - 实时监控

```javascript
const axios = require('axios');

class WealthfolioMonitor {
    constructor(baseURL = 'http://127.0.0.1:3333') {
        this.baseURL = baseURL;
        this.client = axios.create({ baseURL });
    }

    async getTopHoldings(limit = 10) {
        const response = await this.client.get('/api/portfolio/holdings');
        const holdings = response.data.holdings;

        return holdings
            .sort((a, b) => b.marketValue.base - a.marketValue.base)
            .slice(0, limit)
            .map(h => ({
                symbol: h.instrument?.symbol || 'CASH',
                name: h.instrument?.name || 'Cash',
                value: h.marketValue.base,
                weight: h.weight,
                gainPct: h.totalGainPct
            }));
    }

    async getAccountPerformance() {
        const accounts = await this.client.get('/api/portfolio/accounts').then(r => r.data.accounts);
        const allHoldings = await this.client.get('/api/portfolio/holdings').then(r => r.data.holdings);

        return accounts.map(account => {
            const accountHoldings = allHoldings.filter(h => h.accountId === account.id);
            const totalValue = accountHoldings.reduce((sum, h) => sum + h.marketValue.base, 0);
            const totalCost = accountHoldings.reduce((sum, h) => sum + (h.costBasis?.base || 0), 0);
            const totalGain = totalValue - totalCost;
            const gainPct = totalCost > 0 ? totalGain / totalCost : 0;

            return {
                name: account.name,
                currency: account.currency,
                value: totalValue,
                gain: totalGain,
                gainPct: gainPct
            };
        });
    }
}

// 使用示例
const monitor = new WealthfolioMonitor();

monitor.getTopHoldings(5).then(holdings => {
    console.log('Top 5 Holdings:');
    holdings.forEach((h, i) => {
        console.log(`${i+1}. ${h.symbol}: ${h.value.toFixed(2)} (${(h.weight*100).toFixed(1)}%)`);
    });
});

monitor.getAccountPerformance().then(accounts => {
    console.log('\nAccount Performance:');
    accounts.forEach(acc => {
        console.log(`${acc.name}: ${(acc.gainPct*100).toFixed(2)}% (${acc.gain.toFixed(2)})`);
    });
});
```

### Bash/cURL - 简单监控脚本

```bash
#!/bin/bash

API_URL="http://127.0.0.1:3333"

echo "=== Wealthfolio Portfolio Monitor ==="

# 获取总市值
TOTAL_VALUE=$(curl -s "$API_URL/api/portfolio/holdings" | jq '.holdings | map(.marketValue.base) | add')

# 获取基础货币
BASE_CURRENCY=$(curl -s "$API_URL/api/settings/base-currency" | jq -r '.baseCurrency')

echo "Total Portfolio Value: $BASE_CURRENCY $(printf "%.2f" $TOTAL_VALUE)"

# 获取账户数量
ACCOUNT_COUNT=$(curl -s "$API_URL/api/portfolio/accounts" | jq '.accounts | length')
echo "Active Accounts: $ACCOUNT_COUNT"

# 获取前3大持仓
echo -e "\nTop 3 Holdings:"
curl -s "$API_URL/api/portfolio/holdings" | jq -r '.holdings | sort_by(.marketValue.base) | reverse | .[0:3][] | "\(.instrument.symbol // "CASH"): \(.marketValue.base)"' | nl

echo -e "\nLast updated: $(date)"
```

## ⚠️ 错误处理

### HTTP状态码
- **200**: 成功
- **500**: 服务器内部错误（通常是数据处理错误）

### 错误响应格式
```json
{
  "error": "Human readable error message"
}
```

### 常见错误场景
1. **数据库连接问题**: 检查Wealthfolio是否正在运行
2. **无效账户ID**: 检查account_id参数是否正确
3. **市场数据不可用**: 某些资产可能缺少实时报价
4. **汇率数据缺失**: 新货币对可能需要等待汇率更新

### 重试策略
```python
import time
import requests
from requests.exceptions import RequestException

def robust_request(url, max_retries=3, delay=1):
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except RequestException as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(delay * (2 ** attempt))  # 指数退避
```

## 🔒 安全和最佳实践

### 安全注意事项
- **本地访问**: API仅监听127.0.0.1，不暴露到公网
- **无认证**: 不需要API密钥，依赖本地访问控制
- **进程隔离**: API作为独立异步任务运行

### 性能优化
- **批量请求**: 避免频繁的小请求
- **数据缓存**: 在客户端缓存不变的数据
- **增量更新**: 只请求变更的数据

### 监控和日志
```python
import logging
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def monitored_request(url):
    try:
        logger.info(f"Requesting: {url}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        logger.info(f"Success: {url}")
        return response.json()
    except Exception as e:
        logger.error(f"Failed: {url} - {e}")
        raise
```

## 🛠️ 故障排除

### API无响应
```bash
# 检查端口是否监听
netstat -tlnp | grep 3333

# 检查进程是否运行
ps aux | grep wealthfolio

# 查看日志
tail -f ~/.config/wealthfolio/logs/
```

### 数据异常
- **负数权重**: 检查总市值计算
- **缺失汇率**: 等待市场数据更新
- **旧时间戳**: 检查系统时钟同步

### 性能问题
- **响应慢**: 检查数据库性能
- **内存使用高**: 重启Wealthfolio应用
- **大量数据**: 考虑分页或筛选

## 📚 进阶用法

### 时间序列分析
```python
def get_historical_comparison(api_client, days=30):
    """获取多日投资组合对比"""
    # 注意：当前API只提供最新数据
    # 扩展API可支持历史数据查询
    pass
```

### 风险指标计算
```python
def calculate_risk_metrics(holdings):
    """计算投资组合风险指标"""
    # 基于当前持仓计算波动率、VaR等
    # 需要扩展API支持历史价格数据
    pass
```

### 自动化交易集成
```python
def sync_with_broker(api_client, broker_api):
    """与券商API同步持仓"""
    # 比较Wealthfolio数据与券商数据
    # 自动检测差异并报告
    pass
```

## 📞 支持

### 问题反馈
- 检查 [EXTERNAL_API_IMPLEMENTATION.md](./EXTERNAL_API_IMPLEMENTATION.md) 获取技术细节
- 使用 `api_test.sh` 脚本诊断问题
- 查看应用程序日志获取详细错误信息

### 版本兼容性
- API响应格式在主要版本间保持稳定
- 新字段会添加到现有响应中，不会破坏现有集成
- 废弃字段会提前通知并逐步移除

---

**最后更新**: 2026-01-11
**API版本**: v2.1.0
