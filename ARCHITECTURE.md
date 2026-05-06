# Architecture Extr'Apol

Référentiel technique de l'application courtage **Extr'Apol** (Groupe Apolline).
À tenir à jour à chaque refactor structurant. Tout changement de chaîne sync,
de schéma BDD ou de stockage local doit être documenté ici.

---

## 1. Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       POSTE COURTIER (1 par utilisateur)                 │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                       Tauri 2 (shell Rust)                         │  │
│  │  • WebView2 (HTML/JS rendu)                                        │  │
│  │  • Stronghold plugin (vault chiffré argon2 par utilisateur)        │  │
│  │  • Updater plugin (MSI signé minisign)                             │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                  │                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    React 18 + TypeScript + Vite                    │  │
│  │                                                                    │  │
│  │  ┌──────────────────┐    ┌──────────────────────────────────────┐  │  │
│  │  │ AuthContext      │───▶│ useStore (Zustand + persist v7)      │  │  │
│  │  │ (online forced)  │    │ • clients/dossiers/prets/rdvs/...    │  │  │
│  │  └──────────────────┘    │ • notes/notifications/templates      │  │  │
│  │           │              │ • settings/societe                   │  │  │
│  │           │              └─────────────┬────────────────────────┘  │  │
│  │           │                            │                           │  │
│  │           ▼                            ▼ (mirror.* sur chaque CUD) │  │
│  │  ┌──────────────────┐    ┌──────────────────────────────────────┐  │  │
│  │  │ MSAL.js v5       │    │ db/api.ts                            │  │  │
│  │  │ (Microsoft 365)  │    │ • auth.login/logout                  │  │  │
│  │  └────────┬─────────┘    │ • mirror.{create,update,remove}      │  │  │
│  │           │              │ • sync.pullAll / sync.start (SSE)    │  │  │
│  │           │              └─────────────┬────────────────────────┘  │  │
│  └───────────┼────────────────────────────┼───────────────────────────┘  │
│              │                            │                              │
│   localStorage + Stronghold      JWT bearer + SSE                        │
└──────────────┼────────────────────────────┼──────────────────────────────┘
               │                            │
               ▼                            ▼
       ┌───────────────┐           ┌──────────────────────┐
       │ Microsoft     │           │ VPS Hostinger        │
       │ Graph API     │           │ • Hono (API REST)    │
       │ • Mail        │           │ • PostgreSQL         │
       │ • Calendar    │           │ • PG LISTEN/NOTIFY   │
       │ • OneDrive    │           │ • Drizzle ORM        │
       │ • Contacts    │           └──────────────────────┘
       └───────────────┘
```

Tous les postes sont connectés au **même** backend (`appli.apolline.groupe-apolline.eu`).
La base Postgres est la source de vérité partagée. Le store Zustand local est un
**cache** synchronisé en temps réel via SSE et reconstruit au boot via `pullAll()`.

---

## 2. Authentification

### 2.1 Login Apolline (utilisateur métier)

- **Online OBLIGATOIRE pour la première connexion** (`AuthContext.login`).
  - Si le backend est joignable → JWT signé HS256, persisté dans `localStorage` (`apolline.auth_token`).
  - Si rejet 401 → message d'erreur explicite, pas de fallback offline.
  - Si réseau down → fallback offline **uniquement si** un token précédent existe.
- Le mode (`online` / `offline`) est exposé dans `AuthContext.authMode` et affiché
  dans le badge en haut à droite de la sidebar.

### 2.2 Comptes Microsoft 365

- MSAL.js v5 + plugin Stronghold pour persister :
  - Le cache MSAL (localStorage clé `msal.cache`).
  - Le **cookie de session** `msal.cache.encryption` (clé de chiffrement, requis pour relire le cache après redémarrage MSAL v5).
- **1 vault Stronghold par utilisateur Apolline** : `msal-vault-${userId}.stronghold`.
  - `bindApollineUser(userId)` dans `o365/msal.ts` est appelé au mount d'AuthProvider et à chaque login/logout.
  - Le wipe du cache est **skippé** sur le 1er bind d'une session (sinon le verifier PKCE est détruit pendant le redirect → login échoue).

---

## 3. Synchronisation backend

### 3.1 Cascade de sync

| Trigger | Action |
|---|---|
| Boot online | `sync.pullAll()` puis `sync.start()` (SSE) |
| Reconnect (SSE redémarre) | `sync.pullAll()` + flag `hasConnectedOnce` |
| `window.focus` | `sync.pullAll()` (rattrape les modifs faites sur d'autres postes) |
| Intervalle 2 min | `sync.pullAll()` (filet de sécurité si SSE/focus loupent) |

`pullAll()` retourne `{counts, errors}` → toast de feedback dans `App.tsx`.

### 3.2 Mirror CUD

Toutes les actions CRUD du store appellent `mirror.{create,update,remove}(entity, payload)`
de manière **fire-and-forget** : la mutation locale est immédiate (UX réactive),
le push backend est asynchrone. Si une erreur survient :
- 401/403 → logout automatique (token invalide / utilisateur désactivé).
- Autre erreur → log console, retentative au prochain `pullAll()`.

Entités mirror-isées (`EntityName`) :
`clients`, `dossiers`, `prets`, `rdvs`, `notes`, `commissions`,
`banques`, `apporteurs`, `simulations`, `templates`, `notifications`.

### 3.3 SSE (PG LISTEN/NOTIFY)

Le backend `Hono` écoute `LISTEN entity_changed` sur Postgres et relaie
les events au client via `fetch`+`ReadableStream` (pas de WebSocket).
Le client réinjecte les events dans le store via `mirror.applyRemote(...)`.

---

## 4. Stockage local

| Emplacement | Contenu | Cycle de vie |
|---|---|---|
| `localStorage` | • `apolline.auth_token` (JWT) <br> • `apolline.currentUserId` <br> • `apolline.authMode` <br> • `apolline-store-v7` (cache Zustand) <br> • `msal.cache` (MSAL local cache) | Effacé à `logout()` ou `switchUser()` |
| Stronghold vault `msal-vault-${userId}.stronghold` | Cache MSAL chiffré + cookie de session encryption | Persisté entre redémarrages, scoped par user Apolline |
| `localStorage.lastUpdateCheck` | Timestamp dernière vérif update Tauri | Pour throttling |

---

## 5. Modèle de données — règles d'or

### 5.1 IDs

- **Tous** les IDs sont des `crypto.randomUUID()` côté front.
- Le backend rejette les IDs non-UUID via `sanitizeForInsert` (sauf exceptions explicites :
  `graphId`, `legacyId`, `oneDriveFolderId`, `oneDriveDriveId`).
- ⚠️ **Ne jamais** réintroduire `${prefix}${Date.now().toString(36)}` (legacy avant migration v7).

### 5.2 Dossier ↔ Prêts (Cifacil-style)

Depuis le refactor Cifacil, **un dossier peut héberger plusieurs prêts** :
- Logement principal + Relais + In Fine + PTZ + Lissage…
- Potentiellement chez **des banques différentes**.

Conséquences :
- Le `Dossier` ne porte plus `banque`, `tauxNominal`, `mensualite`, `commission` (champs supprimés).
- La `banque` (au sens "banque cible / banque retenue") se déduit côté front
  par agrégation des prêts (cf. `Dossiers.tsx` : `banquesByDossier`).
- La mensualité totale, le coût total, le TAEG estimatif sont **toujours** des
  agrégats calculés à partir de `prets`. Voir `tabFinancement` dans
  `templates/dossierBanquier.ts` et `TabFinancement` dans `pages/DossierDetail.tsx`.

### 5.3 Migration BDD associée

`apolline-backend/drizzle/0001_drop_dossier_legacy_loan_fields.sql` retire les
colonnes deprecated. À appliquer en prod après backup `pg_dump`.

---

## 6. Pièges connus

### 6.1 PowerShell `Set-Content -Encoding utf8`

PS5.1 lit le fichier dans l'encoding **système** (CP1252 sur Windows FR) et
ré-encode en UTF-8 → mojibake (`Ã©`, `â•`, `â€`). Toujours utiliser :
- l'outil `Edit` de Claude Code (lit/écrit en UTF-8 strict), ou
- `[System.IO.File]::WriteAllText(path, content, [System.Text.UTF8Encoding]::new($false))` pour scripter.

Recovery (cf. ce repo, conv. d'avril 2026) : Python char-by-char,
encode chaque code-point cp1252 → UTF-8.

### 6.2 MSAL v5 + cookie de session

MSAL v5 chiffre son cache localStorage avec une clé stockée dans un cookie
de **session** (perdu au restart). Sans persistance de ce cookie, l'utilisateur
est déloggé de Microsoft 365 à chaque redémarrage. Le code dans `o365/stronghold.ts`
persiste à la fois `msal.cache` ET `msal.cache.encryption` cookie.

### 6.3 Variables d'env Vite bakées au build

`VITE_API_BASE` (et toutes les `VITE_*`) sont **inlinées** dans le bundle au
moment du `npm run build`. **Modifier `.env` ne suffit pas** : il faut rebuild
le MSI. Le fallback prod est codé en dur dans `db/api.ts` :
`PROD_API_BASE = 'https://appli.apolline.groupe-apolline.eu'`.

### 6.4 Tauri `productName`

`src-tauri/tauri.conf.json` → `productName: "Extrapol"` (sans apostrophe).
La version "Extr'Apol" (avec apostrophe) est purement affichée dans le titre
de fenêtre et le branding UI. **Ne pas remettre l'apostrophe dans `productName`** :
elle casse les noms de fichiers MSI sur certains systèmes de fichiers.

### 6.5 OneDrive — partagés vs personnel

Les dossiers de courtage sont **partagés** par l'admin avec chaque collaborateur
(pas dans le OneDrive personnel). Toute opération Graph doit utiliser
`listSharedWithMe()` puis `effectiveRef(item)` pour extraire le `driveId`
quand l'item provient d'un drive tiers.

### 6.6 Sanitizer backend & nouveaux champs

Si on ajoute un nouveau champ `xxxId` au schéma Drizzle, il faut **aussi**
l'ajouter à la liste d'exceptions de `sanitizeForInsert` dans
`apolline-backend/src/lib/crud.ts`. Sinon le champ est strippé silencieusement
au push (= disparition fantôme côté serveur).

---

## 7. Conventions de code

- TypeScript strict (`tsc --noEmit` doit passer).
- Pas d'apostrophes courbes (`'`) dans le code TS / TSX (utiliser `\'`).
- Commentaires en français (cohérence avec le métier).
- Toute nouvelle entité métier doit :
  1. Être déclarée dans `src/data/mock.ts` (type) **et** `apolline-backend/src/db/schema.ts` (table).
  2. Être ajoutée à `EntityName` dans `db/api.ts`.
  3. Avoir un `mirror.*` câblé dans le store CRUD.
  4. Être incluse dans `pullAll()`.
  5. Être testée par un E2E Playwright (cf. `e2e/`).

---

Dernière mise à jour : 2026-04-29
