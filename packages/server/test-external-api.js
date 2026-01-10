#!/usr/bin/env node

// Test script for External API
import { startExternalApi } from './dist/index.js'

async function test() {
  console.log('🚀 Starting External API test...')

  try {
    const externalApi = await startExternalApi({
      host: '127.0.0.1',
      port: 3334
    })

    console.log('✅ External API started successfully!')
    console.log('📊 Testing health endpoint...')

    // Wait a moment for server to start
    setTimeout(async () => {
      try {
        const response = await fetch('http://127.0.0.1:3334/api/health')
        const data = await response.json()
        console.log('✅ Health check response:', data)

        console.log('📊 Testing root endpoint...')
        const rootResponse = await fetch('http://127.0.0.1:3334/')
        const rootData = await rootResponse.json()
        console.log('✅ Root endpoint response:', rootData)

        console.log('✅ All tests passed!')

        // Close the server
        await externalApi.close()
        console.log('🛑 External API server closed')
        process.exit(0)
      } catch (error) {
        console.error('❌ Test failed:', error)
        await externalApi.close()
        process.exit(1)
      }
    }, 1000)

  } catch (error) {
    console.error('❌ Failed to start External API:', error)
    process.exit(1)
  }
}

// Run test
test()
