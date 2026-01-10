#!/usr/bin/env node

import { startExternalApi } from './external-api/index.js'

async function main() {
  try {
    console.log('🚀 Starting External API Server...')

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
