/**
 * Identifiants de test E2E — surchargeable par variables d'environnement.
 *
 * En local : crée un compte dédié `e2e@apolline-test.eu` côté backend
 * (table `collaborateurs` en mode `actif=true`, role `admin`) avant de lancer
 * les tests. **Ne jamais** commiter de vraies credentials ici.
 */
export const TEST_USER = {
  email: process.env.E2E_USER_EMAIL ?? 'e2e@apolline-test.eu',
  password: process.env.E2E_USER_PASSWORD ?? 'TestE2E_2026!',
}
