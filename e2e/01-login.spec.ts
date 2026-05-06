import { test, expect } from '@playwright/test'
import { TEST_USER } from './fixtures/testUser'

/**
 * Vérifie que :
 *  - L'écran de login s'affiche
 *  - Un mauvais mot de passe → message d'erreur explicite (pas de fallback offline silencieux)
 *  - Un bon mot de passe → redirection sur la page Tableau de bord et badge "online"
 */
test.describe('Authentification', () => {
  test.beforeEach(async ({ context }) => {
    // Force un état clean : pas de token, pas de cache user
    await context.clearCookies()
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('apolline.auth_token')
        localStorage.removeItem('apolline.currentUserId')
        localStorage.removeItem('apolline.authMode')
        localStorage.removeItem('apolline-store')
      } catch {}
    })
  })

  test('affiche le formulaire de login au boot', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Extr.?Apol/i })).toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
  })

  test('rejette un mot de passe invalide avec un message clair', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email)
    await page.getByPlaceholder(/mot de passe/i).fill('wrong-password-xyz')
    await page.getByRole('button', { name: /connexion/i }).click()

    // L'app doit refuser explicitement (pas de fallback offline silencieux).
    await expect(page.getByText(/incorrect|erreur|injoignable/i)).toBeVisible({ timeout: 8000 })
    // Toujours sur la page login
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
  })

  test('connexion réussie redirige vers le dashboard', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email)
    await page.getByPlaceholder(/mot de passe/i).fill(TEST_USER.password)
    await page.getByRole('button', { name: /connexion/i }).click()

    // Le sidebar/dashboard doit apparaître (= login validé)
    await expect(page.getByRole('link', { name: /dossiers/i })).toBeVisible({ timeout: 8000 })
    // Badge online attendu (sync backend OK)
    await expect(page.locator('text=/online/i').first()).toBeVisible({ timeout: 5000 })
  })
})
