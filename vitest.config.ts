/**
 * Configuration Vitest — tests unitaires sur les calculs métier critiques.
 *
 * Pré-requis : `npm install -D vitest @vitest/ui jsdom`
 * Lancer : `npm run test` ou `npm run test:ui`
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
