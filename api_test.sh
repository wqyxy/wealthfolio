#!/bin/bash

# Wealthfolio External API Test Script
# 测试所有External API endpoints

# 配置
API_PORT=3333
API_URL="http://127.0.0.1:$API_PORT"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 解析命令行参数
STARTUP_MODE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --desktop)
            STARTUP_MODE="desktop"
            shift
            ;;
        --server)
            STARTUP_MODE="server"
            shift
            ;;
        --help)
            echo "Usage: $0 [--desktop|--server|--help]"
            echo ""
            echo "Options:"
            echo "  --desktop  Test after starting with 'pnpm tauri dev'"
            echo "  --server   Test after starting with 'cargo run --manifest-path src-server/Cargo.toml'"
            echo "  --help     Show this help message"
            echo ""
            echo "If no option specified, test the API at port $API_PORT"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

print_header() {
    echo "🧪 Testing Wealthfolio External API"
    echo "======================================================"
    echo ""
}

print_mode_info() {
    local mode=$1
    local url=$2
    echo "🎯 Testing $mode mode at $url"
    echo ""
}

print_startup_instructions() {
    echo "⚠️  Make sure Wealthfolio is running with one of:"
    case $STARTUP_MODE in
        "desktop")
            echo "   pnpm tauri dev"
            ;;
        "server")
            echo "   cargo run --manifest-path src-server/Cargo.toml"
            ;;
        *)
            echo "   pnpm tauri dev"
            echo "   OR"
            echo "   cargo run --manifest-path src-server/Cargo.toml"
            ;;
    esac
    echo ""
}

# 检查API是否可达
check_api_server() {
    local health_url="$API_URL/api/health"

    echo "🔍 Checking Wealthfolio API at $health_url..."
    health_check=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "$health_url" 2>/dev/null)
    if [ "$health_check" = "200" ]; then
        echo -e "${GREEN}✅ API server is responding!${NC}"
        return 0
    else
        echo -e "${YELLOW}❌ API server not responding (HTTP $health_check)${NC}"
        return 1
    fi
}

# 初始化
print_header
echo "⏳ Waiting for API server to be ready..."
sleep 3

# 检查API服务器
if ! check_api_server; then
    print_startup_instructions
    exit 1
fi

echo ""
echo "======================================================"

# 函数：测试单个endpoint
test_endpoint() {
    local base_url=$1
    local mode=$2
    local endpoint=$3
    local description=$4
    local url="$base_url$endpoint"

    echo ""
    echo -e "${BLUE}Testing: $description${NC}"
    echo "Mode: $mode | URL: $url"
    echo "--------------------------------------------------"

    # 使用临时文件分离响应体和状态码，避免换行符问题
    temp_file=$(mktemp)
    status=$(curl -s --max-time 10 -w "%{http_code}" -o "$temp_file" "$url" 2>/dev/null)
    body=$(cat "$temp_file")
    rm -f "$temp_file"

    if [ -z "$status" ]; then
        echo -e "${RED}❌ No response received (connection timeout)${NC}"
        return 1
    fi

    echo "📊 Raw response body:"
    echo "$body"
    echo ""

    if [ "$status" -eq 200 ]; then
        echo -e "${GREEN}✅ Status: $status (Success)${NC}"

        # 验证JSON格式 - 使用python代替jq
        clean_body="$body"
        if python3 -c "import json, sys; json.loads('$clean_body'); print('valid')" 2>/dev/null; then
            echo -e "${GREEN}✅ Valid JSON response${NC}"

            # 检查是否有error字段
            if python3 -c "import json, sys; data=json.loads('$clean_body'); sys.exit(0 if 'error' in data else 1)" 2>/dev/null; then
                error_msg=$(python3 -c "import json, sys; data=json.loads('$clean_body'); print(data.get('error', 'Unknown error'))" 2>/dev/null)
                echo -e "${YELLOW}⚠️  Response contains error: $error_msg${NC}"
            else
                echo "📄 Response preview:"
                # 对于大型响应，只显示结构预览
                body_length=$(python3 -c "import json; print(len(json.dumps(json.loads('$clean_body'))))" 2>/dev/null || echo "0")
                if [ "$body_length" -gt 500 ] 2>/dev/null; then
                    python3 -c "
import json
data = json.loads('$clean_body')
if isinstance(data, dict):
    print(json.dumps(dict(list(data.items())[:3]), indent=2))
elif isinstance(data, list) and len(data) > 0:
    print(json.dumps(data[:3], indent=2))
else:
    print(json.dumps(data, indent=2))
" 2>/dev/null | head -10
                    echo -e "${YELLOW}... (truncated)${NC}"
                else
                    python3 -c "import json; print(json.dumps(json.loads('$clean_body'), indent=2))" 2>/dev/null || echo "$clean_body"
                fi
            fi
        else
            echo -e "${RED}❌ Invalid JSON response${NC}"
            echo "📄 Raw response: '$body'"
            # 检查是否是HTML错误页面或其他
            if [[ "$body" == *"<!DOCTYPE html>"* ]] || [[ "$body" == *"<html>"* ]]; then
                echo -e "${YELLOW}🔍 Detected HTML response - server may not be running or wrong port${NC}"
            fi
            return 1
        fi
    else
        echo -e "${RED}❌ Status: $status (Failed)${NC}"
        echo "📄 Response: $body"
        return 1
    fi
    return 0
}

# 函数：测试服务器的所有endpoints
test_server_endpoints() {
    local base_url=$1
    local mode=$2

    echo ""
    echo -e "${BLUE}🎯 Testing $mode mode at $base_url${NC}"
    echo "======================================================"

    local success_count=0
    local total_count=0

    # 测试健康检查
    ((total_count++))
    if test_endpoint "$base_url" "$mode" "/api/health" "Health Check Endpoint"; then
        ((success_count++))
    fi

    # 测试基础货币
    ((total_count++))
    if test_endpoint "$base_url" "$mode" "/api/settings/base-currency" "Base Currency Settings"; then
        ((success_count++))
    fi

    # 测试账户列表
    ((total_count++))
    if test_endpoint "$base_url" "$mode" "/api/portfolio/accounts" "Portfolio Accounts"; then
        ((success_count++))
    fi

    # 测试汇率
    ((total_count++))
    if test_endpoint "$base_url" "$mode" "/api/exchange-rates" "Exchange Rates"; then
        ((success_count++))
    fi

    # 测试持仓（所有账户）
    ((total_count++))
    if test_endpoint "$base_url" "$mode" "/api/portfolio/holdings" "Portfolio Holdings (All Accounts)"; then
        ((success_count++))
    fi

    echo ""
    echo -e "${BLUE}📊 $mode Test Results: $success_count/$total_count endpoints passed${NC}"

    if [ $success_count -eq $total_count ]; then
        echo -e "${GREEN}🎉 All endpoints working correctly!${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Some endpoints failed. Check output above.${NC}"
        return 1
    fi
}

# 测试API的所有端点
if test_server_endpoints "$API_URL" "API"; then
    echo -e "${GREEN}✅ All API endpoint tests completed successfully${NC}"
    overall_success=true
else
    echo -e "${RED}❌ Some API endpoint tests failed${NC}"
    overall_success=false
fi

# 测试特定账户的持仓（可选测试）
echo ""
echo "======================================================"
echo -e "${BLUE}🔍 Optional: Testing specific account holdings${NC}"
echo ""

# 获取账户列表
accounts_response=$(curl -s "$API_URL/api/portfolio/accounts" 2>/dev/null)
if python3 -c "import json; data=json.loads('$accounts_response'); print(data['accounts'][0]['id'] if data.get('accounts') and len(data['accounts']) > 0 else '')" 2>/dev/null | grep -q .; then
    account_id=$(python3 -c "import json; data=json.loads('$accounts_response'); print(data['accounts'][0]['id'])" 2>/dev/null)
    echo "Found account: $account_id"

    # 测试特定账户的持仓
    test_endpoint "$API_URL" "API" "/api/portfolio/holdings?account_id=$account_id" "Portfolio Holdings (Account: $account_id)"
else
    echo -e "${YELLOW}No accounts found or unable to parse account list${NC}"
fi

# 总结
echo ""
echo "======================================================"
if [ "$overall_success" = true ]; then
    echo -e "${GREEN}🎉 All API tests completed successfully!${NC}"
else
    echo -e "${RED}❌ Some API tests failed. Check output above.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📝 Notes:${NC}"
echo "  - All endpoints should return HTTP 200 and valid JSON"
echo "  - Data structures are designed for quantitative analysis"
echo "  - Values are in base currency with original currency preserved"
echo "  - Timestamps use RFC3339 format"
echo "  - API runs on port $API_PORT for both desktop and server modes"
echo "======================================================"
