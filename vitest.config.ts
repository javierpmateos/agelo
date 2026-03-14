import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals:     true,
    testTimeout: 30000,   // 30s para tests que llaman onchain
    include:     ['src/tests/**/*.test.ts'],
  },
})
