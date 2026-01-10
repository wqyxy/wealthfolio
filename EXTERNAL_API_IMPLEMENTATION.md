# Wealthfolio External API Implementation

## 任务目标

实现一个External API，作为附属服务随Wealthfolio主程序启动，并能通过本地端口访问。

### 核心要求
- 在Wealthfolio主程序启动后，可以通过 `GET http://127.0.0.1:3333/api/health` 稳定返回JSON
- 不修改数据库、不访问sqlite、不调用任何services/repositories
- 不影响现有桌面/Web/Docker/Tauri行为
- 不引入UI、session、auth、中间件
- 仅监听127.0.0.1，不暴露公网
- 新增代码量越少越好

## 实现方案

### 1. 创建External API模块结构

在 `packages/server/src/external-api/` 目录下创建：
- `app.ts` - Hono应用配置
- `index.ts` - 启动入口

### 2. 技术选型
- **框架**: Hono (轻量级Web框架)
- **语言**: TypeScript
- **监听地址**: 127.0.0.1:3333
- **API路径**: `/api/health`

### 3. 核心功能实现

#### External API应用 (`packages/server/src/external-api/app.ts`)
```typescript
import { Hono } from 'hono'
import { logger } from 'hono/logger'

export interface ExternalApiConfig {
  port: number
  host: string
}

export function createExternalApiApp(config: ExternalApiConfig) {
  const app = new Hono()

  // 添加日志中间件
  app.use(logger())

  // 健康检查端点
  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      port: config.port
    })
  })

  // 根端点
  app.get('/', (c) => {
    return c.json({
      message: 'Wealthfolio External API',
      status: 'running',
      port: config.port
    })
  })

  return app
}
```

#### 启动入口 (`packages/server/src/external-api/index.ts`)
```typescript
import { serve } from '@hono/node-server'
import { createExternalApiApp, type ExternalApiConfig } from './app'

export interface ExternalApiServer {
  close: () => Promise<void>
}

export async function startExternalApi(config: ExternalApiConfig): Promise<ExternalApiServer> {
  const app = createExternalApiApp(config)

  // 启动服务器
  const server = serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  })

  console.log(`🚀 External API Server ready at http://${config.host}:${config.port}`)
  console.log(`📊 Health endpoint: http://${config.host}:${config.port}/api/health`)

  return {
    close: async () => {
      return new Promise((resolve) => {
        server.close(() => {
          console.log('External API server closed')
          resolve()
        })
      })
    }
  }
}
```

### 4. 集成到主服务启动流程

#### 修改Tauri启动流程 (`src-tauri/src/lib.rs`)
在desktop模块的setup函数中添加External API启动逻辑：

```rust
// Start External API server if addon dev mode is enabled
if std::env::var("VITE_ENABLE_ADDON_DEV_MODE").is_ok() {
    log::info!("VITE_ENABLE_ADDON_DEV_MODE is set, attempting to start External API");
    // Spawn a thread to start the External API server
    std::thread::spawn(|| {
        log::info!("Spawning thread to start External API");

        // 获取当前目录并构建绝对路径
        let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        let script_path = current_dir.join("packages").join("server").join("dist").join("index.js");
        let script_path_str = script_path.to_string_lossy();

        log::info!("Current directory: {:?}", current_dir);
        log::info!("Script path: {}", script_path_str);

        // 检查脚本是否存在
        if !script_path.exists() {
            log::error!("External API script not found at: {}", script_path_str);
            return;
        }

        // 使用绝对路径调用Node.js启动External API
        let import_code = format!("import('{}').then(m => {{ console.log('Module loaded:', m); return m.startExternalApi({{host: '127.0.0.1', port: 3333}}); }}).then(() => console.log('External API started')).catch(console.error)", script_path_str);

        log::info!("Executing Node.js command: node -e \"{}\"", import_code);

        match std::process::Command::new("node")
            .args(&["-e", &import_code])
            .env("VITE_ENABLE_ADDON_DEV_MODE", "true")
            .current_dir(&current_dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
        {
            Ok(child) => {
                log::info!("External API process spawned with PID: {:?}", child.id());
            }
            Err(e) => {
                log::error!("Failed to start External API: {}", e);
                log::error!("Current directory: {:?}", current_dir);
                log::error!("Script path: {}", script_path_str);
            }
        }
    });
}
```

### 5. 启动方式

External API会在以下命令执行时自动启动：
```bash
VITE_ENABLE_ADDON_DEV_MODE=true pnpm tauri dev
```

## 测试验证

### 成功标准
1. 启动Wealthfolio主程序后，External API自动启动
2. 执行 `curl http://127.0.0.1:3333/api/health` 能成功连接
3. 返回HTTP 200状态码
4. 返回JSON格式数据，可被Python requests.get().json()直接解析

### 预期响应
```json
{
  "status": "ok",
  "timestamp": "2026-01-10T10:00:00.000Z",
  "port": 3333
}
```

## 项目结构

```
packages/
  server/
    src/
      external-api/
        app.ts          # Hono应用配置
        index.ts        # 启动入口
      index.ts           # 主入口点
    package.json        # 依赖配置
    tsconfig.json       # TypeScript配置
```

## 依赖项

在 `packages/server/package.json` 中添加：
```json
{
  "dependencies": {
    "hono": "^4.6.12"
  }
}
```

## 注意事项

1. **路径问题**: 使用绝对路径确保Node.js脚本能正确加载
2. **环境变量**: 通过 `VITE_ENABLE_ADDON_DEV_MODE` 环境变量控制启动
3. **进程管理**: External API作为独立进程运行，不影响主程序
4. **日志输出**: 详细的日志帮助调试启动问题
5. **错误处理**: 完善的错误处理确保问题能被及时发现

## 验证步骤

1. 编译TypeScript代码：`cd packages/server && pnpm build`
2. 启动Wealthfolio：`VITE_ENABLE_ADDON_DEV_MODE=true pnpm tauri dev`
3. 测试API：`curl http://127.0.0.1:3333/api/health`
4. 验证响应格式和内容
