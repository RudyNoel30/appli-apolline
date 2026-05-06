# Skills IA Apolline — Claude API

L'app Extr'Apol invoque les skills Claude que tu as construits dans Claude Apps,
en utilisant l'API Anthropic Messages avec prompt caching.

## Architecture

```
apolline-skills/                    ← TES SKILL.md (copiés depuis Claude Apps)
├── ddp-pdf/SKILL.md
├── dossier-html/SKILL.md
├── dossier-html-pro/SKILL.md
├── ...

apolline-backend/src/lib/skills/
├── loader.ts        → lit les SKILL.md au démarrage
└── mapping.ts       → skill → modèle (Sonnet/Haiku/Opus)

Frontend boutons :  
DossierDetail → "Générer DDP"  →  POST /api/ai/dossier/:id/ddp-pdf
                "Dossier banquier" → POST /api/ai/dossier/:id/dossier-html
                ...
```

## Configuration backend

Dans `/opt/apolline-backend/.env` :

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
# Optionnel : override par skill
ANTHROPIC_MODEL_DDP_PDF=claude-opus-4-x...   # Si tu veux Opus pour le DDP
ANTHROPIC_MODEL_SONNET=claude-sonnet-4-5-...  # Override modèle Sonnet
ANTHROPIC_MODEL_HAIKU=claude-haiku-4-5-...    # Override modèle Haiku
ANTHROPIC_MAX_TOKENS=16000

# Si tu places les skills ailleurs que ./apolline-skills/
APOLLINE_SKILLS_DIR=/opt/apolline-skills
```

## Mapping skill → modèle (par défaut)

| Skill | Tier | Coût/gen approximatif |
|---|---|---|
| `ddp-pdf` | Sonnet | ~0,18 € |
| `dossier-html` | Sonnet | ~0,15 € |
| `dossier-html-pro` | Sonnet | ~0,18 € |
| `dossier-html-dvf` | Sonnet | ~0,12 € |
| `dossier-extract` | Sonnet | ~0,20 € |
| `dossier-extract-dvf` | Sonnet | ~0,15 € |
| `dossier-extract-simulation` | Sonnet | ~0,20 € |
| `dossier-r1-etude-client` | Haiku | ~0,05 € |
| `dossier-html-simulation` | Haiku | ~0,04 € |
| `dossier-rename` | Haiku | ~0,03 € |
| `extract-g-support` | Haiku | ~0,04 € |

Avec **prompt caching** activé : -90 % dès le 2e appel du même skill dans les 5 min.

## Comment ajouter / mettre à jour un skill

1. Copie le SKILL.md depuis Claude Apps (ou édite-le directement) :
   ```
   apolline-skills/<nom-du-skill>/SKILL.md
   ```

2. Si le skill change le mapping de modèle souhaité :
   ```typescript
   // apolline-backend/src/lib/skills/mapping.ts
   const DEFAULT_MAPPING: Record<string, SkillTier> = {
     'mon-skill': 'sonnet', // ou 'haiku' / 'opus'
     // ...
   }
   ```

3. Recharge les skills (admin uniquement) :
   ```bash
   curl -X POST -H "Authorization: Bearer <token>" http://localhost:3000/api/ai/skills/refresh
   ```
   OU redémarre le service : `systemctl restart apolline-api`

## Endpoints API

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/ai/health` | Clé API configurée + skills chargés |
| GET | `/api/ai/skills` | Liste des skills avec leur modèle attribué |
| POST | `/api/ai/skills/refresh` | Recharge les SKILL.md (admin) |
| POST | `/api/ai/generate/:skillName` | Invoque un skill avec contexte JSON arbitraire |
| POST | `/api/ai/dossier/:id/:skillName` | Charge le dossier en BDD + invoque skill |
| GET | `/api/ai/usage?days=30` | Conso agrégée depuis audit_log |

## Limites actuelles (phase 1)

L'intégration utilise les SKILL.md en **mode system prompt** (pas l'API Skills officielle d'Anthropic). Ça veut dire :

- ✅ Génération HTML / texte / JSON
- ❌ Pas de code execution Python (donc pas de PDF natif via reportlab, ni PNG via Playwright)
- ❌ Pas de lecture de PDF entrant via pdfplumber

Pour les skills qui ont besoin d'exécuter du Python (ex: `ddp-pdf` génère un vrai PDF, `dossier-r1-etude-client` génère un PNG via Chromium headless), tu obtiens en phase 1 le **HTML équivalent** que tu peux ensuite imprimer en PDF via le bouton "Imprimer / PDF" de la modale.

**Phase 2 future** : passer aux Skills via API officielle (`POST /v1/skills` + `container.skills[]`) pour activer le code execution. ~1 j de dev en plus, ~+0,05 € par appel.

## Sécurité & RGPD

- Clé API uniquement côté backend (jamais front)
- Données envoyées : extrait du dossier (identité, projet, revenus globaux). **Filtrage** : passwordHash retiré, RIB et n° sécu non transmis
- Anthropic conserve les données 30 j max (politique standard, pas d'apprentissage modèle)
- Désactivable globalement : `ANTHROPIC_API_KEY=` vide → 503
- Chaque appel tracé dans `audit_log` (action='create', entity='ai_generation') avec coût en €
- Voir `docs/RGPD-politique.md` section sous-traitants
