import { Hono } from 'hono'
import { logger } from 'hono/logger'

export interface ExternalApiConfig {
  port: number
  host: string
}

export function createExternalApiApp(config: ExternalApiConfig) {
  const app = new Hono()

  // Add logger middleware
  app.use(logger())

  // Health check endpoint
  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      port: config.port
    })
  })

  // Root endpoint
  app.get('/', (c) => {
    return c.json({
      message: 'Wealthfolio External API',
      status: 'running',
      port: config.port
    })
  })

  return app
}
