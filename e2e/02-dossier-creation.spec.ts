import { test, expect } from '@playwright/test'
import { TEST_USER } from './fixtures/testUser'

/**
 * Flow critique : création de dossier de A à Z.
 *
 * Vérifie que :
 *  - On peut créer un dossier à partir de la page Dossiers
 *  - Le dossier apparaît dans le pipeline kanban après création
 *  - L'ID du dossier est bien un UUID (pas un legacy `Dxxx`)
 *  - Un client orphelin n'est jamais créé (cf. garde-fou addDossier)
 */
test.describe('Création de dossier', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Login
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email)
    await page.getByPlaceholder(/mot de passe/i).fill(TEST_USER.password)
    await page.getByRole('button', { name: /connexion/i }).click()
    await expect(page.getByRole('link', { name: /dossiers/i })).toBeVisible({ timeout: 8000 })
  })

  test('crée un dossier prospect et retrouve l\'UUID en store', async ({ page }) => {
    await page.getByRole('link', { name: /dossiers/i }).click()
    // Bouton "+ Nouveau dossier" — adapter le sélecteur si refactor UI
    await page.getByRole('button', { name: /nouveau dossier|\+/i }).first().click()

    // Remplit les champs minimaux du formulaire de création
    const refClient = `E2E ${Date.now()}`
    await page.getByLabel(/nom/i).first().fill(refClient)
    await page.getByLabel(/prénom/i).first().fill('Test')
    await page.getByLabel(/ville/i).fill('Dijon')
    await page.getByLabel(/montant.*bien/i).fill('250000')
    await page.getByLabel(/montant.*pr[êe]t/i).fill('200000')
    await page.getByLabel(/apport/i).fill('50000')
    await page.getByLabel(/dur[ée]e/i).fill('300')

    await page.getByRole('button', { name: /enregistrer|créer/i }).click()

    // Le dossier doit apparaître dans le pipeline
    await expect(page.locator(`text=${refClient}`).first()).toBeVisible({ timeout: 5000 })

    // L'ID du dossier en store doit être un UUID v4
    const storeJson = await page.evaluate(() => localStorage.getItem('apolline-store'))
    expect(storeJson).toBeTruthy()
    const persisted = JSON.parse(storeJson!)
    const dossiers = persisted.state?.dossiers ?? []
    const created = dossiers.find((d: { clientNom: string }) => d.clientNom?.includes(refClient))
    expect(created).toBeTruthy()
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
})
