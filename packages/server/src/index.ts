#!/usr/bin/env node

import { startExternalApi } from './external-api'

async function main() {
  try {
    // Check if we should start External API based on environment variable
    const enableAddonDevMode = process.env.VITE_ENABLE_ADDON_DEV_MODE === 'true'

    if (enableAddonDevMode) {
      console.log('🚀 Starting External API Server in addon dev mode...')

      // Start External API on port 3333
      const externalApi = await startExternalApi({
        host: '127.0.0.1',
        port: 3333
      })

      // Keep the process alive
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down External API...')
        await externalApi.close()
        process.exit(0)
      })

      process.on('SIGTERM', async () => {
        console.log('\n🛑 Shutting down External API...')
        await externalApi.close()
        process.exit(0)
      })
    } else {
      console.log('External API not started - VITE_ENABLE_ADDON_DEV_MODE not set to true')
    }
  } catch (error) {
    console.error('Failed to start External API:', error)
    process.exit(1)
  }
}

// Only run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main()
}

export { startExternalApi }
