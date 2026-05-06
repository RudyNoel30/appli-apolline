import { test, expect } from '@playwright/test'
import { TEST_USER } from './fixtures/testUser'

/**
 * Vérifie la sync avec le backend Postgres.
 *
 * Hypothèse : le backend de test a au moins UN dossier en BDD (créé par le test
 * précédent ou un seed manuel). Le test refresh la page et s'assure que le
 * dossier est rechargé depuis le serveur (= pullAll au boot fonctionne).
 *
 * Si tu ne veux pas dépendre d'un état pré-existant, exécute ce fichier APRÈS
 * `02-dossier-creation.spec.ts` (Playwright respecte l'ordre alphabétique).
 */
test.describe('Synchronisation backend', () => {
  test('pullAll au boot recharge les dossiers depuis le backend', async ({ page }) => {
    // Login normal
    await page.goto('/')
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email)
    await page.getByPlaceholder(/mot de passe/i).fill(TEST_USER.password)
    await page.getByRole('button', { name: /connexion/i }).click()
    await expect(page.getByRole('link', { name: /dossiers/i })).toBeVisible({ timeout: 8000 })

    // Va sur Dossiers et compte les éléments visibles
    await page.getByRole('link', { name: /dossiers/i }).click()
    await page.waitForTimeout(2000) // laisse le pullAll initial se terminer

    // Wipe le cache localStorage MAIS garde le token (= simule une session
    // online sans cache, comme un nouvel utilisateur sur un nouveau poste).
    const dossiersBeforeReload = await page.evaluate(() => {
      const raw = localStorage.getItem('apolline-store')
      const dossiers = JSON.parse(raw ?? '{}').state?.dossiers ?? []
      // Wipe le cache mais garde le token
      localStorage.removeItem('apolline-store')
      return dossiers.length as number
    })

    // Reload — l'app doit redémarrer, sync.pullAll() doit retélécharger
    // les dossiers depuis le backend → on retrouve au moins le même nombre.
    await page.reload()
    await expect(page.getByRole('link', { name: /dossiers/i })).toBeVisible({ timeout: 8000 })
    await page.waitForTimeout(3000) // laisse le pullAll restaurer

    const dossiersAfterReload = await page.evaluate(() => {
      const raw = localStorage.getItem('apolline-store')
      return (JSON.parse(raw ?? '{}').state?.dossiers ?? []).length as number
    })

    expect(dossiersAfterReload).toBeGreaterThanOrEqual(dossiersBeforeReload)
  })
})
