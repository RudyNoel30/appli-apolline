/**
 * Configuration Playwright pour tests E2E Extr'Apol.
 *
 * Cible le bundle Vite servi en local (pas Tauri) — l'idée est de couvrir
 * la couche UI/store/sync sans avoir à booter le shell Rust à chaque CI.
 * Les tests Tauri-spécifiques (updater, Stronghold, IPC) restent manuels.
 *
 * Pré-requis (1 fois) :
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *
 * Lancer :
 *   npm run test:e2e          # mode headless
 *   npm run test:e2e:ui       # mode UI (debug interactif)
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // sync backend = état partagé entre tests, on sérialise
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
