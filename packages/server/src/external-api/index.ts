import { serve } from '@hono/node-server'
import { createExternalApiApp, type ExternalApiConfig } from './app.js'

export interface ExternalApiServer {
  close: () => Promise<void>
}

export async function startExternalApi(config: ExternalApiConfig): Promise<ExternalApiServer> {
  const app = createExternalApiApp(config)

  // Start the server
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
