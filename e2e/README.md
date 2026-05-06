# Tests E2E Extr'Apol

Tests bout-en-bout avec Playwright. Couvre le **flow critique** :

1. **`01-login.spec.ts`** — Login Apolline (rejet password invalide, succès online)
2. **`02-dossier-creation.spec.ts`** — Création de dossier + vérification UUID
3. **`03-sync-backend.spec.ts`** — Sync Postgres (pullAll au boot)

## Installation

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Ajoute ensuite dans `package.json` :

```json
"scripts": {
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:headed": "playwright test --headed"
}
```

## Compte de test

Crée côté backend un compte dédié `e2e@apolline-test.eu` (pas un vrai
utilisateur Apolline). En local :

```bash
# depuis apolline-backend/
npx tsx scripts/seed.ts        # ou créer manuellement via SQL
```

Puis exporte les credentials avant de lancer les tests :

```powershell
$env:E2E_USER_EMAIL="e2e@apolline-test.eu"
$env:E2E_USER_PASSWORD="TestE2E_2026!"
npm run test:e2e
```

## Pourquoi pas de tests Tauri ?

Les tests E2E ciblent **le bundle Vite servi sur localhost:5173** — pas le shell
Tauri. Raisons :

- Booter Tauri à chaque CI multiplie le temps de test par ~10
- Les bouts spécifiques Tauri (updater, Stronghold, IPC) sont testables
  manuellement et changent peu
- La logique métier (auth, store, sync) est dans le bundle web → couverte par
  ces tests même sans Tauri

Pour un test de bout en bout incluant l'updater MSI, voir `scripts/release.ps1`
qui simule un cycle complet de release.

## CI

Sur CI, `webServer.reuseExistingServer = false` → Playwright spawn `npm run dev`
lui-même. Il faut juste s'assurer que `VITE_API_BASE` pointe vers une instance
backend de test joignable.
