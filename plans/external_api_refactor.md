# External API 重构计划 (Phase 2 - 进一步简化)

## 当前状态
✅ 已完成第一阶段重构：
- 创建了共享的 `src-core/src/external_api.rs` 模块
- 提取了所有数据转换逻辑
- 两个平台的代码已大大简化

## 进一步简化方案

### 方案A：保持当前架构 (推荐)
- 保留两个 `external_api.rs` 文件作为平台适配器
- 每个文件只包含平台特定的配置和最小路由逻辑
- 优势：清晰的关注点分离，易于维护

### 方案B：完全删除重复文件 (更激进)
1. **将所有 handler 逻辑移到 `src-core`**
   - 创建 `ExternalApiService` trait 定义服务接口
   - 实现通用 handlers 使用 trait 对象

2. **创建最小适配器文件**
   - `src-server/src/external_api.rs`: 只包含配置和路由 (20行代码)
   - `src-tauri/src/external_api.rs`: 只包含配置和路由 (20行代码)

3. **优势**
   - 几乎完全消除重复
   - 单一的业务逻辑实现

4. **挑战**
   - 需要使用 trait 对象处理不同上下文类型
   - 可能增加复杂性

## 实施步骤 (如果选择方案B)

1. 在 `src-core` 中定义 `ExternalApiService` trait
2. 将所有 handler 逻辑移到 `src-core/src/external_api.rs`
3. 将两个平台文件简化为纯配置和路由
4. 测试功能

## 推荐方案
建议选择**方案A**（当前实现），因为：
- 代码复用目标已达成 (减少了200+行重复代码)
- 架构清晰，易于理解和维护
- 性能开销最小
- 与现有代码风格一致
