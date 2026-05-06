# Roadmap Extr'Apol — chantiers lourds restants

État au 2026-04-30. Les chantiers ci-dessous nécessitent chacun une session
dédiée (1 j de dev + tests + déploiement progressif).

## Item 17 — PDF natif (pdf-lib)

**Objectif** : remplacer `exportToHtml()` par `exportToPdf()` qui produit un
vrai PDF (pas un HTML imprimable).

**Plan** :
1. `npm install pdf-lib pdfkit` côté front
2. Créer `src/lib/pdfExport.ts` qui prend les mêmes `sections` que `htmlExport.ts`
   et génère un Uint8Array via pdf-lib
3. Refactorer les 3 utilisations actuelles :
   - `Dashboard.tsx → exportHtml()` → option PDF
   - `DossierDetail.tsx → exportHtmlReport()` → option PDF
   - `Simulation.tsx → exportHtml()` → option PDF
4. Ajouter le téléchargement via `saveFile()` + `mimeType: 'application/pdf'`

**Effort** : 1 j

## Item 18 — Virtualisation listes (react-window)

**Objectif** : la page `/dossiers` mode liste rame à partir de 200 lignes.
Virtualiser avec react-window pour ne rendre que les ~20 visibles.

**Plan** :
1. `npm install react-window @types/react-window`
2. Wrapper `<FixedSizeList itemSize={56} height={...}>` autour du `<tbody>`
   de `Dossiers.tsx → ListView()`
3. Idem sur `Clients.tsx` et `pages/Pieces.tsx → tableau Documents OneDrive`
4. Vérifier que le tri / filtre marchent toujours (recompute du dataset → reset scroll)

**Effort** : 3 h

## Item 19 — Pagination backend

**Objectif** : aujourd'hui `pullAll()` retélécharge tout au boot. Avec >1000
dossiers historiques, ça va ramer.

**Plan** :
1. Ajouter `?limit=200&offset=0&order=createdAt:desc` à `crudRoute.GET /`
2. Côté front, `sync.pullAll()` boucle jusqu'à recevoir < limit
3. Ajouter `?since=<iso>` pour incrémental (ne récupère que les modifications
   depuis le dernier sync)
4. Persister `lastSyncAt` par entité dans le store

**Effort** : 1 j

## Item 20 — 2FA TOTP

**Objectif** : ajouter un second facteur (Google Authenticator / Microsoft
Authenticator) sur le login Apolline.

**Plan** :
1. Backend : `npm install otplib qrcode`
2. Migration : ajouter colonnes `totp_secret`, `totp_enabled` sur `collaborateurs`
3. Endpoint `POST /api/auth/2fa/setup` → génère un secret + retourne QR code data URL
4. Endpoint `POST /api/auth/2fa/verify` → vérifie le code initial et active
5. Modifier `POST /api/auth/login` :
   - Si `totp_enabled` → retour `{requires_2fa: true, ticket: <jwt court>}`
   - Endpoint `POST /api/auth/login/2fa` qui consume le ticket + le code TOTP
6. Front : Modal de saisie code 6 chiffres après login OK
7. Page Paramètres → Sécurité → bouton "Activer 2FA" avec QR code

**Effort** : 1.5 j (implémentation + tests + doc onboarding)

## Item 21 — RGPD : rétention + droit à l'effacement

**Objectif** :
1. Auto-purge des dossiers archivés > 5 ans (loi)
2. Bouton "Exporter toutes les données d'un client" (article 20 RGPD)
3. Bouton "Effacer toutes les données d'un client" (article 17)

**Plan** :
1. Backend : ajouter au cron du `realtime/cron.ts` un check quotidien
   ```ts
   await db.update(dossiers).set({ archive: true })
     .where(and(eq(statut, 'Encaisse'), lt(signatureDate, fiveYearsAgo)))
   await db.delete(dossiers).where(and(eq(archive, true), lt(updatedAt, sixYearsAgo)))
   ```
2. Endpoint `GET /api/clients/:id/export-rgpd` → ZIP avec JSON de toutes les
   tables filtrées par `clientId` (dossiers, prêts, notes, RDV, commissions, pièces OneDrive listing)
3. Endpoint `POST /api/clients/:id/erase-rgpd` (admin uniquement) → cascade delete + audit
4. Page Paramètres → Données → onglet RGPD avec ces 2 boutons
5. Bandeau de consentement RGPD au login si pas accepté (cookie `apolline.rgpd.accepted`)

**Effort** : 1.5 j

## Item 22 — Templates DDP via Claude API + Skills

**Objectif** : remplacer les templates statiques par génération IA depuis
les données du dossier + skill Apolline.

**Plan** :
1. Sur le VPS : `npm install @anthropic-ai/sdk` côté backend
2. Stocker `ANTHROPIC_API_KEY` dans `.env` (jamais côté front !)
3. Créer un dossier `apolline-skills/ddp-apolline/` avec :
   - `SKILL.md` (instructions + structure attendue)
   - `generate_ddp.py` (script Python qui prend dossier JSON + sort HTML)
   - `templates/` (fragments HTML réutilisables)
4. Endpoint `POST /api/ai/generate-ddp` côté backend qui :
   - Charge le dossier complet (clients, prêts, notes)
   - Appelle l'API Anthropic avec le skill + le contexte
   - Retourne le HTML généré
5. Côté front, dans `DossierDetail.tsx`, ajouter bouton "🪄 Générer DDP IA"
   à côté du bouton "Rapport HTML"
6. RGPD : afficher un bandeau de consentement avant le 1er appel
   ("Les données du dossier seront envoyées à Anthropic pour génération.
    Aucun stockage > 30 j côté Anthropic.")

**Effort** : 2 j

---

## Plan de release suggéré

| Version | Contenu | Date cible |
|---|---|---|
| **0.1.42** (cette session) | ErrorBoundary, audit log, perms, Cmd+K, saisie rapide, Ma journée, télémétrie, cron, calendar, drag&drop | maintenant |
| 0.1.43 | PDF natif + virtualisation listes | +1 semaine |
| 0.1.44 | Pagination backend incrémentale | +2 semaines |
| 0.1.45 | 2FA TOTP | +3 semaines |
| 0.1.46 | RGPD rétention + droit effacement | +5 semaines |
| 0.1.50 | Templates Claude API + Skills | +8 semaines |

Pour chaque release : commencer par `npm run test` (vitest) + `npm run lint` +
audit manuel des permissions sur un compte gestionnaire/assistante.
