import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // Every int file boots Payload against the SAME SQLite file, and SQLite has a
    // single writer: parallel workers race each other's schema push and writes
    // and fail with SQLITE_BUSY. Run files one at a time.
    fileParallelism: false,
  },
})
