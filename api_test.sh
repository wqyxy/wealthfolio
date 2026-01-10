#!/bin/bash

# Wealthfolio External API Test Script
# 测试所有External API endpoints

BASE_URL="http://127.0.0.1:3333"
echo "🧪 Testing Wealthfolio External API at $BASE_URL"
echo "======================================================"
echo ""
echo "⚠️  Make sure Wealthfolio is running with:"
echo "   pnpm tauri dev"
echo ""
echo "⏳ Waiting for server to be ready..."
sleep 3

# 检查服务器是否可达
echo "🔍 Checking if server is responding..."
health_check=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [ "$health_check" != "200" ]; then
    echo "❌ Server not responding (HTTP $health_check)"
    echo "💡 Make sure to start Wealthfolio first:"
    echo "   pnpm tauri dev"
    exit 1
fi

echo "✅ Server is responding!"
echo "======================================================"

# 函数：测试endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2
    local url="$BASE_URL$endpoint"

    echo ""
    echo "Testing: $description"
    echo "URL: $url"
    echo "--------------------------------------------------"

    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$url")

    # 分离响应体和状态码
    body=$(echo "$response" | sed '$d')
    status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)

    echo "📊 Raw response body:"
    echo "'$body'"
    echo ""

    if [ "$status" -eq 200 ]; then
        echo "✅ Status: $status (Success)"

        # 验证JSON格式
        if echo "$body" | jq . >/dev/null 2>&1; then
            echo "✅ Valid JSON response"
            echo "📄 Response preview:"
            echo "$body" | jq '. | if type == "object" and has("error") then .error else "Success response" end' 2>/dev/null || echo "$body"
        else
            echo "❌ Invalid JSON response"
            echo "📄 Full raw response: '$body'"
            # 检查是否是HTML错误页面或其他
            if [[ "$body" == *"<!DOCTYPE html>"* ]] || [[ "$body" == *"<html>"* ]]; then
                echo "🔍 Detected HTML response - server may not be running or wrong port"
            fi
        fi
    else
        echo "❌ Status: $status (Failed)"
        echo "📄 Response: $body"
    fi
}

# 测试健康检查
test_endpoint "/api/health" "Health Check Endpoint"

# 测试基础货币
test_endpoint "/api/settings/base-currency" "Base Currency Settings"

# 测试账户列表
test_endpoint "/api/portfolio/accounts" "Portfolio Accounts"

# 测试汇率
test_endpoint "/api/exchange-rates" "Exchange Rates"

# 测试持仓（所有账户）
test_endpoint "/api/portfolio/holdings" "Portfolio Holdings (All Accounts)"

# 测试持仓（特定账户，如果有的话）
# 注意：这里假设可能有account，需要根据实际情况调整
echo ""
echo "Testing: Portfolio Holdings (Specific Account)"
echo "Note: This test assumes you have accounts. Adjust account_id as needed."
echo "URL: $BASE_URL/api/portfolio/holdings?account_id=example"
echo "--------------------------------------------------"

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/api/portfolio/holdings?account_id=example")
body=$(echo "$response" | sed '$d')
status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$status" -eq 200 ]; then
    echo "✅ Status: $status (Success)"
    if echo "$body" | jq . >/dev/null 2>&1; then
        echo "✅ Valid JSON response"
        echo "📄 Response contains holdings data"
    else
        echo "❌ Invalid JSON response"
    fi
else
    echo "ℹ️  Status: $status (May be expected if account doesn't exist)"
fi

echo ""
echo "======================================================"
echo "🎉 API Testing Complete!"
echo ""
echo "📝 Notes:"
echo "  - All endpoints should return HTTP 200 and valid JSON"
echo "  - Data structures are designed for quantitative analysis"
echo "  - Values are in base currency with original currency preserved"
echo "  - Timestamps use RFC3339 format"
echo "======================================================"
