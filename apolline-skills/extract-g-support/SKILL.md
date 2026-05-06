---
name: extract-g-support
description: >
  Skill d'extraction et de génération du tableau de suivi G Support pour Groupe Apolline.
  À partir des événements du calendrier GSupport et du fichier d'encaissements,
  génère un fichier Excel structuré avec toutes les colonnes de suivi financier,
  commissions, salaires, charges et rémunérations MIOB.
  MANDATORY TRIGGERS : Extract G Support, tableau G Support, extraction gsupport, suivi GSupport,
  tableau de suivi honoraires, extraction calendrier GSupport, tableau commissions GSupport,
  générer tableau gsupport, colonnes gsupport, suivi AA gsupport, extraction invitations GSupport,
  mettre à jour gsupport, enrichir gsupport, intégrer encaissements gsupport.
  Utiliser dès que l'utilisateur demande de générer ou mettre à jour le tableau de suivi GSupport.
version: "2.7"
---

# Extract G Support — Skill de suivi des événements GSupport

## Version
**v2.7** — 2026-04-30

### Historique des versions

- **v2.7 (2026-04-30)** — Deux correctifs après run DELTA 30/04 :
  (a) **Suffixe AA prioritaire sur préfixe RDV** : TYPE_RULES enrichi avec `\bAA\s*$` (AA en fin de sujet) évalué entre les suffixes métier (CONF, Banca, R3, Mandat, Expertise, Visite) et le filet RDV. Corrige les libellés `RDV / DXXXXX:... AA` (ex. 45801 LE FORESTIER, 45704 PALLAUD) précédemment classés à tort en RDV — désormais classés AA, ce qui permet de récupérer la date de signature en col L (M+P+X J+3/J+10/J+20 calculées correctement).
  (b) **Ajout `pierre@groupe-apolline.com` → Pierre-Alexandre Péchard** dans EMAIL_TO_AGENT (alias court de `p.alexandre@`). Évite le fallback "pierre" + warning sur les invitations de Pierre-Alexandre.
- **v2.6 (2026-04-27)** — **Livrable incrémental = DELTA STRICT** : la livraison incrémentale ne contient QUE les nouvelles lignes (pas de re-livraison des dossiers déjà livrés en v6/SharePoint). **Suppression du surlignage** : les nouvelles lignes ne sont plus colorées en jaune (`NEW_ROW_FILL` retiré) — elles suivent le bandage neutre standard pour copier-coller propre dans le tableau maître.
- **v2.5 (2026-04-24 soir)** — Suffixe CONF prioritaire sur préfixe RDV : TYPE_RULES réordonné pour que les mots-clés métier (CONF, Banca, R3, Mandat, Expertise, Visite) soient évalués AVANT les préfixes génériques. Corrige le bug sur `RDV / D46010:CARDOT / SIMONET CONF` (classé RDV au lieu de Conf).
- **v2.4 (2026-04-24 soir)** — Redirection d'attribution Madison → Gilles : quand `madison@groupe-apolline.com` envoie une invitation, col G (Expéditeur) reste "Madison" mais col AI (Responsable) bascule sur "Gilles RICHARD" (société, rémunération = Gilles, pas de MIOB, pas de salaire).
- **v2.3 (2026-04-24 soir)** — Nouvelle colonne AI (35) "Responsable" + colonne A "Date import" = date du run. Schéma passe de 34 à 35 colonnes.
- **v2.2 (2026-04-24)** — Règle anti-sur-correction dédoublonnage (§17.0) : ne retirer QUE le CIFACIL explicitement signalé doublon, jamais par analogie.
- **v2.1 (2026-04-23)** — Acte étendu par objet d'invitation : mots-clés `Banca` / `Bancarisation`, `R3`, `Mandat`, `Expertise`, `Visite` peuplent la colonne Acte. **La Filière reste calculée normalement** — on ne force PAS la Filière sur "Banca".
- **v2 (2026-04)** — nom frontmatter kebab-case, mapping email→agent explicite, regex CIFACIL canonique, clé et règles de dédoublonnage, méthode de parsing du fichier encaissements distant, ordre de tri de référence, résolution de la contradiction Cagnotte, gestion des événements annulés et des tests, pagination Outlook, mode mise à jour incrémentale, rapport d'extraction.

## Objectif

Générer un fichier Excel `Suivi_GSupport_[MOIS]_[ANNEE].xlsx` consolidant :
1. Les **invitations GSupport** (calendrier + emails envoyés à `GSupport@groupe-apolline.com`)
2. Les **données du fichier encaissements** (`Etat des encaissements 2026.xlsx` sur SharePoint)

---

## 1. Sources de données — Récupération exhaustive

### Source 1 — Calendrier via attendee (méthode principale)
```
outlook_calendar_search(
    attendee="GSupport@groupe-apolline.com",
    afterDateTime="<MOIS>-01T00:00:00Z",
    beforeDateTime="<MOIS>-<last>T23:59:59Z",
    limit=50
)
```
Retourne les événements avec organisateur identifié. Lire chaque URI via `read_resource` si détails manquants.

### Source 2 — Emails envoyés à GSupport
```
outlook_email_search(
    recipient="GSupport@groupe-apolline.com",
    afterDateTime=..., beforeDateTime=...,
    limit=50
)
```

### Source 3 — Email recap GSupport
```
outlook_email_search(
    sender="GSupport@groupe-apolline.com",
    query="Add upcoming group events"
)
```
Parser le body HTML : extraire lignes d'événements (subject + date).

### Pagination — obligatoire
Si une source retourne exactement `limit` résultats, relancer avec `offset += 50` tant que la réponse est saturée. Ne JAMAIS faire un seul appel avec `limit=50` sans vérifier.

### Limitation API connue
Le calendrier de groupe GSupport est inaccessible via `/users/` → erreur `ErrorGroupIsUsedInNonGroupURI`. Les Sources 1 et 2 couvrent uniquement les événements **où GSupport est en attendee/recipient**. Quand `Group.Read.All` + `Calendars.Read` seront actifs dans Azure AD, ajouter Source 4 via endpoint `/groups/{id}/events`.

---

## 2. Dédoublonnage — règle canonique

### Clé de dédoublonnage
```python
dedup_key = (cifacil, event_date.date())
```
Une invitation calendrier + son email de notification ont **le même CIFACIL et la même date d'événement**.

### Priorité de fusion
Quand deux entrées matchent la clé :
1. Libellé, organisateur, date événement → priorité **calendrier**
2. Date d'envoi (colonne B) → priorité **email** (sentDateTime plus précis)
3. Si pas de calendrier → tout de l'email

### Exclusions systématiques
| Condition | Action |
|-----------|--------|
| `isCancelled: true` | Exclu + consigné dans rapport |
| Libellé contient `TEST` ou organisateur = `rudy@` sans CIFACIL | Exclu (test) + consigné |
| Pas de CIFACIL extractible | Exclu + warning dans rapport |

---

## 3. Extraction CIFACIL — regex canonique

```python
import re
CIFACIL_REGEX = re.compile(r"D?(\d{2})\s?(\d{3})")

def extract_cifacil(subject: str) -> str | None:
    m = CIFACIL_REGEX.search(subject)
    if not m:
        return None
    return m.group(1) + m.group(2)  # 5 chiffres sans espace
```

Patterns rencontrés (validation) :
| Subject | CIFACIL extrait |
|---------|-----------------|
| `AA - 45 864 Laurent Immobilier Chalon` | `45864` |
| `44 746 - SCI Place de la liberté` | `44746` |
| `Conf / D46195:DUCHEMIN TRAVAUX` | `46195` |
| `LE COCAGNE cONF 46263` | `46263` |
| `AA / D41827:SAIDANI` | `41827` |
| `RDV / D46010:CARDOT / SIMONET CONF` | `46010` |

Si pas de match → ligne écartée + entrée dans rapport.

---

## 4. Extraction CLIENT — règle canonique

```python
def extract_client(subject: str, cifacil: str) -> str:
    s = subject
    # retirer préfixe type
    s = re.sub(r"^(AA|Conf|Metrage|Métrage|RDV)\s*/?\s*", "", s, flags=re.I)
    # retirer CIFACIL sous toutes ses formes
    s = re.sub(r"D?\d{2}\s?\d{3}\s*:?\s*", "", s)
    # retirer suffixe cONF/CONF éventuel
    s = re.sub(r"\s+c?ONF\s*$", "", s, flags=re.I)
    # nettoyer séparateurs résiduels
    s = re.sub(r"^\s*[-/:]\s*", "", s)
    return s.strip()
```

---

## 5. Mapping email → agent (table de référence unique)

```python
EMAIL_TO_AGENT = {
    # ---- Salariés (% variable net = 10 %, sauf JA = 5 %) ----
    "apolline@groupe-apolline.com":   "Apolline AUJARD",
    "madison@groupe-apolline.com":    "Madison",
    "marion@groupe-apolline.com":     "Marion",
    "f.bienvenu@groupe-apolline.com": "Florian BIENVENU",
    "adeline@groupe-apolline.com":    "Adeline",
    "john@groupe-apolline.com":       "John-Arthur AUJARD",

    # ---- Gérants (pas de rémunération calculée) ----
    "gilles@groupe-apolline.com":     "Gilles RICHARD",
    "s.aujard@groupe-apolline.com":   "Sébastien AUJARD",

    # ---- MIOB Apolline ----
    "jeremie@groupe-apolline.com":      "Jérémie HUMBERT",
    "m.chalumeau@groupe-apolline.com":  "Maxime CHALUMEAU",
    "v.szarzynski@groupe-apolline.com": "Vanessa SZARZYNSKI",
    "p.alexandre@groupe-apolline.com":  "Pierre-Alexandre Péchard",
    "pierre@groupe-apolline.com":       "Pierre-Alexandre Péchard",
    "r.rosain@groupe-apolline.com":     "Raphaël ROSAIN",
    "melanie@groupe-apolline.com":      "Mélanie KURZ",
    "damien@groupe-apolline.com":       "Damien BRULET",
    "deborah@groupe-apolline.com":      "Deborah",
    "etienne@groupe-apolline.com":      "Etienne",
    "harun@groupe-apolline.com":        "Harun HERGIC",
    "thomas@groupe-apolline.com":       "Thomas PYANET",
    "alexandra@groupe-apolline.com":    "Alexandra",
    "antonio@groupe-apolline.com":      "Antonio MARQUES",
    "arnaud@groupe-apolline.com":       "Arnaud",
    "fanny@groupe-apolline.com":        "Fanny",
    "francois@groupe-apolline.com":     "François",
    "julien@groupe-apolline.com":       "Julien",
    "kiliam@groupe-apolline.com":       "Kiliam Courtier",
    "mateo@groupe-apolline.com":        "Matéo",
    "michael@groupe-apolline.com":      "Michaël",
    "quentin@groupe-apolline.com":      "Quentin",
    "sandra@groupe-apolline.com":       "Sandra",
    "stephane@groupe-apolline.com":     "Stéphane",
    "stephanie@groupe-apolline.com":    "Stéphanie",
    "xavier@groupe-apolline.com":       "Xavier",

    # ---- GR2SA2 (société rose) ----
    "b.gerbod@groupe-apolline.com":   "Benoit GERBOD",
    "angelique@groupe-apolline.com":  "Angélique",
    "jc.bourset@groupe-apolline.com": "Jean-Christophe Bourset",
    "jb.bourset@groupe-apolline.com": "Jean-Baptiste Bourset",
    "b.herve@groupe-apolline.com":    "Bruno HERVÉ",
    "aurelie@angel.immo":             "Aurélie (Angel Immo)",
}
```

**Fallback** : email absent de la table → `agent = email.split("@")[0]`, warning col U "Agent inconnu — compléter EMAIL_TO_AGENT".

### 5 bis — Redirection d'attribution (v2.4)

Quand l'organisateur de l'événement est une **assistante** qui agit pour le
compte d'un autre agent, l'Expéditeur (col G) reste l'assistante (traçabilité)
mais tout le traitement métier (Société, Responsable, rémunération) bascule
sur l'agent attributaire.

```python
EMAIL_REDIRECT = {
    "madison@groupe-apolline.com": "gilles@groupe-apolline.com",
    # Extension future : autres paires assistante → responsable
    # "adeline@groupe-apolline.com": "s.aujard@groupe-apolline.com",  # ex.
}
```

**Impact par colonne** :

| Colonne | Valeur |
|---------|--------|
| G Expéditeur | nom RÉEL de l'émetteur (ex: "Madison") |
| E Société | société du **responsable** (ex: Apolline pour Gilles) |
| AI Responsable | **responsable effectif** (ex: "Gilles RICHARD") |
| AE %MIOB, AF Montant MIOB, AG Date MIOB | 0 / vide si le responsable n'est pas MIOB |
| AC Date salaires, AD Date charges, Z–AB Variable/charges/salaire | 0 / vide si le responsable n'est pas salarié |

**Pseudo-code** :
```python
expediteur_fullname = EMAIL_TO_AGENT.get(org_email, org_email.split("@")[0])
effective_email     = EMAIL_REDIRECT.get(org_email, org_email)
fullname            = EMAIL_TO_AGENT.get(effective_email, effective_email.split("@")[0])
societe             = societe_of(fullname, effective_email)
is_salarie          = fullname in SALARIES    # False pour Gilles
is_miob             = fullname in MIOB_RATES  # False pour Gilles
```

---

## 6. Parsing du fichier encaissements

### Étape A — Localisation SharePoint
```python
sharepoint_search(query="Etat des encaissements 2026", fileType="xlsx", limit=1)
```
Retenir l'URI `file:///{driveId}/{id}`.

### Étape B — Lecture directe (méthode A, recommandée)
Télécharger le xlsx via Graph API (`driveId + itemId → /content`) et parser avec openpyxl :
```python
import openpyxl
wb = openpyxl.load_workbook(local_path, data_only=True)
ws = wb.active
```

### Étape C — Lecture via read_resource (méthode B, fallback)
```python
read_resource(uri=<sharepoint_uri>)
```
Retourne texte semi-structuré. Parser ligne par ligne avec split tabulé — fragile, à éviter si méthode A est disponible.

### Étape D — Schéma de colonnes attendu
Après la pivot table initiale, ligne d'en-tête :
```
Jour encaiss | Jour ACTE | Nom | N° (CIFACIL) | MIOB (nom agent) |
HONO prêt | HONO travaux | Com Banque | Apporteur | Cagnotte |
Vari salariale nette | Charges SAL/PAT | %age MIOB | Montant MIOB | Net
```

Indexation : dictionnaire `{cifacil: {hono, com_banque, apporteur, cagnotte, vari_nette, pct_miob, mt_miob, net}}`.

---

## 7. Colonnes du tableau (ordre fixe — 35 colonnes, v2.3)

| Col | Lettre | Intitulé | Source / Règle |
|-----|--------|----------|----------------|
| 1 | A | **Date import** | `date(aujourd'hui)` — date du run d'extraction (v2.3) |
| 2 | B | Date d'envoi | `sentDateTime` email OR `createdDateTime` calendar event |
| 3 | C | Libellé événement | `subject` exact |
| 4 | D | Type | Déduit (voir §9) |
| 5 | E | Société | GR2SA2 (rose) ou Apolline (vert) — basée sur **responsable** (v2.4) |
| 6 | F | CIFACIL | Regex §3 |
| 7 | G | Expéditeur | `organizer.email` OR `sender.email` — nom RÉEL (v2.4) |
| 8 | H | CLIENT | Extraction §4 |
| 9 | I | Banque | ⛔ SAISIE MANUELLE |
| 10 | J | Filière | Règles §9 |
| 11 | K | Acte | Règles §9 |
| 12 | L | Date de signature | Date événement **si Type ∈ {Métrage, AA, Signature}** sinon vide |
| 13 | M | Encaissement honos prévu (J+3) | L + 3 jours calendaires |
| 14 | N | Encaissement Hono réel | ⛔ SAISIE MANUELLE |
| 15 | O | Montant des honoraires | Encaissements.HONO prêt |
| 16 | P | Encaissement com. Banque prévu (J+10) | L + 10 jours |
| 17 | Q | Encaissement com. Banque réel | ⛔ SAISIE MANUELLE |
| 18 | R | Montant com. bancaire | Encaissements.Com Banque |
| 19 | S | Pointage CIC | ⛔ SAISIE MANUELLE |
| 20 | T | Pointage BP | ⛔ SAISIE MANUELLE |
| 21 | U | Commentaires | Anomalies + warnings ⚠️ |
| 22 | V | Qualité Expéditeur | ⛔ SAISIE MANUELLE |
| 23 | W | Apporteur | Encaissements.Apporteur (**négatif**) |
| 24 | X | Date paiement apporteur (J+20) | L + 20 jours |
| 25 | Y | Cagnotte | Voir §8 (**négatif**) |
| 26 | Z | Variable salariale nette | Encaissements.Vari nette (**négatif**) |
| 27 | AA | Charges SAL-PAT | Z × 0.7 (**négatif**) |
| 28 | AB | Salaire total | Z + AA (**négatif**) |
| 29 | AC | Date paiement salaires (3/mois) | 3 du mois suivant — **salarié uniquement** |
| 30 | AD | Date paiement charges (15/mois) | 15 du mois suivant — **salarié uniquement** |
| 31 | AE | %age MIOB | Barème S2 2025 (§10) — basé sur **responsable** |
| 32 | AF | Montant MIOB | Encaissements.Montant MIOB (**négatif**) |
| 33 | AG | Date paiement MIOB (05/mois) | 5 du mois suivant — **MIOB uniquement** |
| 34 | AH | Net | Encaissements.Net (**négatif**) |
| 35 | AI | **Responsable** | `fullname` après redirection `EMAIL_REDIRECT` (v2.4) |

### Règles critiques générales
- Colonnes numériques : `0` (pas `None`/`""`), format `0,00 €`
- Colonnes W, Y, Z, AA, AB, AF, AH : `-abs(valeur)` systématique
- AE : `0` si le **responsable** (après redirection) n'est pas MIOB
- AC, AD : vides si le **responsable** n'est pas salarié
- AG : vide si le **responsable** n'est pas MIOB

---

## 8. Colonne Y Cagnotte — règle unique (lève l'ambiguïté)

**Priorité encaissements** :
```python
if cifacil in ENC and ENC[cifacil].get("cagnotte") is not None:
    cagnotte = -abs(ENC[cifacil]["cagnotte"])
else:
    # fallback calcul sur O+R
    total = hono + com_banque
    if total == 0:          cagnotte = 0
    elif total < 500:       cagnotte = 0
    elif total < 1000:      cagnotte = -50
    else:                   cagnotte = -100
```

La règle de calcul sert uniquement pour les événements **sans ligne encaissements** correspondante.

---

## 9. Détection Société / Type / Filière / Acte

### Société (col E)
```python
GR2SA2_AGENTS = {"Benoit GERBOD", "Angélique", "Jean-Christophe Bourset",
                 "Jean-Baptiste Bourset", "Bruno HERVÉ", "Aurélie (Angel Immo)"}

def societe_of(agent: str, email: str) -> str:
    if agent in GR2SA2_AGENTS:
        return "GR2SA2"
    if "angel.immo" in email.lower() or "aurelie" in email.lower():
        return "GR2SA2"
    return "Apolline"
```

La société est calculée à partir du **responsable effectif** (après `EMAIL_REDIRECT`),
pas de l'expéditeur réel. Une invitation envoyée par Madison pour Gilles
donne Société = Apolline (société de Gilles).

### Type (col D) — regex séquentielle, ordre v2.7

**Règle d'or v2.7** : les mots-clés **métier** (préfixes explicites + suffixes
CONF / Banca / R3 / Mandat / Expertise / Visite + **suffixe AA**) sont évalués
AVANT les préfixes génériques (RDV en particulier). Un libellé type
`RDV / D46010:CARDOT / SIMONET CONF` doit être classé **Conf** et un libellé
`RDV / D45801:LE FORESTIER DE LESMADEC AA` doit être classé **AA** (et non RDV)
afin de récupérer la date de signature en col L.

```python
TYPE_RULES = [
    # 1. Préfixes explicites métiers (priorité maximale)
    (r"^\s*(Metrage|Métrage)\b",        "Métrage"),
    (r"^\s*(Conf|Confirmation)\b",       "Conf"),

    # 2. Objets spécifiques v2.1 (mots-clés métier, n'importe où)
    (r"\bBanca(risation)?\b",            "Banca"),      # Banca TERRIER…, Bancarisation X
    (r"\bR3\b",                          "R3"),         # Rendez-vous 3 (validation finale)
    (r"\bMandat\b",                      "Mandat"),     # Mandat exclusif, Mandat de recherche
    (r"\bExpertise\b",                   "Expertise"),  # Expertise bien, Expertise énergétique
    (r"\bVisite\b",                      "Visite"),     # Visite bien, Visite contre-expertise

    # 3. Suffixe CONF (peut apparaître en fin derrière un préfixe RDV)
    (r"\bc?ONF\b",                       "Conf"),       # ex: "RDV / D46010:... CONF", "LE COCAGNE cONF 46263"

    # 4. AA — préfixe, mot-clé Signature, OU suffixe (v2.7)
    (r"^\s*AA\b",                        "AA"),         # ex: "AA / D45175:STEFANI"
    (r"\bSignature\b",                   "AA"),
    (r"\bAA\s*$",                        "AA"),         # v2.7 — ex: "RDV / D45801:LE FORESTIER... AA", "RDV / D45704:PALLAUD AA"

    # 5. RDV — filet de sécurité, UNIQUEMENT si rien d'autre n'a matché
    (r"^\s*RDV\b",                       "RDV"),
]
# Si aucun match → "RDV" + warning col U "Type non explicite"
```

#### Cas de test (ordre = priorité v2.7)

| Libellé | Type | Pourquoi |
|---------|------|----------|
| `RDV / D46010:CARDOT / SIMONET CONF` | **Conf** | Suffixe `CONF` matche avant le préfixe `RDV` |
| `LE COCAGNE cONF 46263` | Conf | `c?ONF` matche |
| `RDV Banca TERRIER 45850` | **Banca** | `Banca` matche avant `RDV` |
| `RDV / D45801:LE FORESTIER DE LESMADEC AA` | **AA** | v2.7 — suffixe `AA` en fin matche avant `RDV` |
| `RDV / D45704:PALLAUD AA` | **AA** | v2.7 — idem |
| `RDV découverte 12345` | RDV | Aucun suffixe métier → filet RDV |
| `AA / D45175:STEFANI` | AA | Préfixe AA |
| `Metrage / D45014:BOUZIGON` | Métrage | Préfixe Métrage |

### Suffixes sous-dossiers → GSUB/Métrage forcé (override)
| Suffixe (case-insensitive) | Exemple |
|----------------------------|---------|
| `BATIEEXPERTISE` ou `BATIE EXPERTISE` | ROUSSE BATIEEXPERTISE |
| `BIRET` | ROUSSE BIRET |
| `JBH` | ROUSSE JBH |

### Filière (col J) — séquentielle, première règle qui match
```python
if "travaux" in subject.lower() or type == "Métrage":            filiere = "GSUB"
elif any(suffix in subject.upper() for suffix in GSUB_SUFFIXES): filiere = "GSUB"
elif type == "Conf":                                             filiere = "GIMMO"
elif type == "AA" and societe == "GR2SA2":                       filiere = "GAI"
elif type == "AA" and societe == "Apolline":                     filiere = "GIMMO"
elif type == "RDV":                                              filiere = "CONSEIL"
elif "grac" in subject.lower():                                  filiere = "GRAC"
elif "gass" in subject.lower() or "assur" in subject.lower():    filiere = "GASS"
else:                                                            filiere = "DIV"
```

> **v2.1 rappel — la Filière NE CHANGE PAS** avec le nouvel objet d'invitation.
> Un RDV dont le libellé contient "Banca" reste en **Filière = CONSEIL**.
> Seule la colonne Acte (K) reçoit la valeur "Banca".

### Acte (col K) — table étendue v2.1 + règle pivot v2.5

Acte suit directement Type (après résolution de TYPE_RULES v2.5) :

```python
ACTE_FROM_TYPE = {
    "Banca":     "Banca",
    "R3":        "R3",
    "Mandat":    "Mandat",
    "Expertise": "Expertise",
    "Visite":    "Visite",
    "Métrage":   "Métrage",
    "AA":        "AA",
    "Conf":      "Conf",
    "RDV":       "",   # reste vide — RDV générique
}
acte = ACTE_FROM_TYPE.get(type, "")
```

Override "travaux" : si "travaux" apparaît dans le libellé, Acte = "Métrage"
et Filière = "GSUB" même si le Type a été détecté autrement.

---

## 10. Barème MIOB — S2 2025 (référence active)

| Nom (clé EMAIL_TO_AGENT) | Fact S2 2025 | Niveau | %age |
|--------------------------|--------------|--------|------|
| Alexandra | — | Talent | 50 % |
| Antonio MARQUES | 2 546 € | Talent | 50 % |
| Arnaud | — | Talent | 50 % |
| Damien BRULET | 55 444 € | Sénior | **58 %** |
| Deborah | 48 005 € | Confirmé | **52 %** |
| Etienne | 9 224 € | Talent | 50 % |
| Fanny | — | Talent | 50 % |
| François | — | Talent | 50 % |
| Harun HERGIC | 95 637 € | Elite | **70 %** |
| Jérémie HUMBERT | 58 938 € | Sénior | **58 %** |
| Julien | — | Talent | 50 % |
| Kiliam Courtier | — | Talent | 50 % |
| Matéo | — | Talent | 50 % |
| Maxime CHALUMEAU | 38 156 € | Confirmé | **52 %** |
| Mélanie KURZ | 28 400 € | Confirmé | **52 %** |
| Michaël | — | Talent | 50 % |
| Pierre-Alexandre | 86 138 € | Expert | **63 %** |
| Quentin | — | Talent | 50 % |
| Raphaël ROSAIN | 57 917 € | Sénior | **58 %** |
| Sandra | — | Talent | 50 % |
| Stéphane | — | Talent | 50 % |
| Stéphanie | — | Talent | 50 % |
| Thomas PYANET | — | Talent | 50 % |
| Vanessa SZARZYNSKI | 40 272 € | Confirmé | **52 %** |
| Xavier | — | Talent | 50 % |

### Échelle des niveaux
| Niveau | Min | Max | %age |
|--------|-----|-----|------|
| Talent | 0 € | 25 000 € | 50 % |
| Confirmé | 25 001 € | 49 999 € | 52 % |
| Sénior | 50 000 € | 64 999 € | 58 % |
| Expert | 65 000 € | 74 999 € | 63 % |
| Elite | 75 000 €+ | — | 70 % |

---

## 11. Salariés (non MIOB)

| Nom | % Variable net | Coeff brut+patronal |
|-----|----------------|---------------------|
| Apolline AUJARD | 10 % | × 1.7 |
| Madison | 10 % | × 1.7 |
| Marion | 10 % | × 1.7 |
| Florian BIENVENU | 10 % | × 1.7 |
| Adeline | 10 % | × 1.7 |
| John-Arthur AUJARD | 5 % | × 1.7 |

> John-Arthur est UNIQUEMENT salarié — ne figure PAS dans la liste MIOB.

## 12. Gérants (ni MIOB ni salarié)

**Gilles RICHARD** et **Sébastien AUJARD** — perçoivent le Net, aucun calcul
de rémunération. Quand Madison envoie pour le compte de Gilles (v2.4), la
ligne hérite du profil Gilles = aucun calcul de variable / charges / salaire / MIOB.

---

## 13. Formules colonnes calculées

- **M** = Date signature (L) + 3 jours calendaires
- **P** = Date signature (L) + 10 jours calendaires
- **X** = Date signature (L) + 20 jours calendaires
- **AA** = Z × 0.7 (valeur Python directe, pas formule Excel)
- **AB** = Z + AA (valeur Python directe)
- **AC** = 3 du mois suivant — salarié uniquement, `None` sinon
- **AD** = 15 du mois suivant — salarié uniquement
- **AG** = 5 du mois suivant — MIOB uniquement

---

## 14. Ligne TOTAL

Formules `=SUBTOTAL(9,<COL>2:<COL>{last})` sur colonnes **O, R, Y, AB, AF, AH**.

### Pièges techniques à respecter
- Utiliser **`SUBTOTAL`** (notation openpyxl anglaise). Excel convertit en `SOUS.TOTAL` à l'ouverture.
- **Ne PAS utiliser** `=SOUS.TOTAL(9;...)` — openpyxl ajoute un `@` qui fait planter Excel.
- **Ne PAS passer par** `recalc.py` / LibreOffice — corrompt le fichier si erreurs présentes.
- Toutes les cellules des plages doivent être numériques (mettre `0` au lieu de `""` pour les vides).
- Fond noir de la ligne TOTAL étendu jusqu'à la **colonne 35 (AI)**.

---

## 15. Tri des lignes (référence canonique)

**Tri** : `ORDER BY date_envoi ASC, cifacil ASC` (colonne B puis F)

Deux runs successifs produisent le même tableau.

---

## 16. Format du fichier de sortie

- **En-tête ligne 1** : fond noir `#1F1F1F`, texte blanc gras Arial 10, hauteur 45 px
- **Données** à partir de la ligne 2 (pas de ligne vide)
- **Filtres automatiques** sur ligne 1 : `ws.auto_filter.ref = "A1:AI{last_data_row}"` (v2.3)
- **Pas de volets figés** : `freeze_panes = None`
- **Colonne E (Société)** : vert Apolline `#C6EFCE` / rose GR2SA2 `#FADADD`
- **Lignes alternées** : blanc `#FFFFFF` / gris clair `#F5F5F5`
- **Pas de surlignage particulier** sur les nouvelles lignes (v2.6) : les
  dossiers ajoutés en delta héritent du bandage standard (alternance gris).
  Aucune couleur "nouveau" (jaune/vert/etc.) — copie-collable proprement
  dans le tableau maître sans avoir à reformater.
- **Bordure fine grise** `#CCCCCC` en bas de chaque ligne
- **Montants** : format `#,##0.00 €`, alignés à droite
- **Dates** (A, B, L, M, P, X, AC, AD, AG) : format `DD/MM/YYYY`, centrées
- **%age MIOB (AE)** : format `0%` centré
- **Montants issus encaissements** : police verte `#276221`
- **Dates calculées J+3/J+10/J+20** : police bleue `#0070C0`
- **Commentaires warning** : police orange italique `#E67E00`
- **Agents inconnus / fallback** : police grise italique `#AAAAAA`
- **Ligne TOTAL** : fond noir `#1F1F1F`, texte blanc gras, `SUBTOTAL(9,…)` sur O, R, Y, AB, AF, AH, fill étendu col 1..35

---

## 17. Mise à jour incrémentale d'un fichier existant

Quand un `Suivi_GSupport_[MOIS]_[ANNEE].xlsx` existe déjà (vérifier via `sharepoint_search`) → mode **update** :

1. Charger le fichier existant via `openpyxl.load_workbook(..., data_only=False)` (préserver formules)
2. Indexer les lignes par `(CIFACIL, date_événement)`
3. Pour chaque nouvel événement :
   - Si présent → **ne rien changer** (préserver saisies manuelles I, N, Q, S, T, V)
   - Si absent → insérer **avant la ligne TOTAL**, appliquer styles
4. Re-calculer les formules SUBTOTAL avec nouveau `last_row`
5. Sauvegarde avec suffixe jour pour historique : `Suivi_GSupport_Avril_2026_24.xlsx` (où `24` = jour du run)

Sinon → mode **full** : nouveau fichier `Suivi_GSupport_[MOIS]_[ANNEE].xlsx`.

---

## 17.1 LIVRABLE INCRÉMENTAL = DELTA STRICT (v2.6)

**Règle d'or** : quand l'utilisateur demande une extraction incrémentale
(ex : "lance extract g support en évitant les doublons"), le fichier livré
ne doit contenir **QUE les nouvelles lignes** par rapport à la dernière
livraison connue (v6 local OU SharePoint).

### Pourquoi

Les colonnes manuelles (I Banque, N/Q encaissements réels, S/T pointages,
V Qualité Expéditeur) sont déjà saisies dans le tableau maître. Re-livrer
les anciennes lignes :
- détruit potentiellement les saisies manuelles ;
- impose à l'utilisateur de filtrer manuellement le delta ;
- crée un risque de doublon physique en collant le fichier dans le maître.

### Procédure

```python
# 1. Construire l'index des CIFACIL déjà livrés
already = set()
already |= read_cifacil(v6_xlsx_path)            # livraison locale précédente
already |= read_cifacil(sharepoint_current_xlsx) # tableau maître mois en cours

# 2. Extraire tous les événements Outlook du mois
all_events = outlook_events_for_month(...)

# 3. Filtrer : ne garder QUE les CIFACIL absents de `already`
delta = [e for e in all_events
         if e.cifacil not in already
         and not e.is_test
         and not e.is_cancelled]

# 4. Générer le xlsx avec UNIQUEMENT le delta
write_xlsx(delta, "Suivi_GSupport_[MOIS]_[ANNEE]_DELTA.xlsx")
```

### Nommage

| Cas | Nom de fichier |
|-----|----------------|
| Livraison full mensuelle | `Suivi_GSupport_Avril_2026.xlsx` |
| Run incrémental — DELTA strict | `Suivi_GSupport_Avril_2026_DELTA_[JJ-MM].xlsx` |
| Snapshot d'historique (référence) | `Suivi_GSupport_Avril_2026_v[N].xlsx` |

### Ligne TOTAL

Le delta conserve la ligne TOTAL en bas avec `SUBTOTAL(9,…)` : utile pour
contrôler rapidement le montant cumulé des honoraires/com/MIOB à reporter.

### Rapport associé

Le `rapport_extract_gsupport_v[N].txt` doit lister :
- les CIFACIL retenus (delta) ;
- les CIFACIL exclus avec leur source de preuve (v6 local / SharePoint /
  test / annulé) ;
- les redirections EMAIL_REDIRECT appliquées ;
- la synthèse par filière et par responsable.

---

## 17.0 RÈGLE CRITIQUE DE DÉDOUBLONNAGE — NE PAS SUR-CORRIGER (v2.2)

**Contexte** : en mode incrémental, on livre un delta (nouveaux dossiers
depuis la dernière livraison). Quand l'utilisateur signale UN dossier déjà
livré la veille, la tentation est d'extrapoler et d'en retirer plusieurs
autres "potentiellement suspects". **C'est une ERREUR.**

### Règle d'or

1. N'exclure un dossier QUE si sa présence dans la livraison précédente est
   **prouvée** (contenu du xlsx de la veille ouvert et indexé par CIFACIL).

2. Si l'utilisateur signale 1 doublon, retirer UNIQUEMENT ce CIFACIL —
   **ne jamais retirer d'autres dossiers "par analogie"** (même agent, même
   tranche horaire, même plage de CIFACIL, etc.).

3. Toujours maintenir la liste exhaustive des CIFACIL exclus dans le rapport
   avec la source de chaque exclusion :
   - SharePoint (fichier courant du mois)
   - Livraison veille (signalement explicite utilisateur)
   - Annulé (isCancelled=true)
   - Test (TEST dans libellé, organisateur suspect)

4. Avant de retirer un dossier, vérifier dans Outlook que l'email/invitation
   n'est **pas plus récent** que la dernière livraison — un dossier reçu après
   le cut-off de la veille doit toujours être intégré.

### Procédure en cas de doublon signalé

```
SIGNAL utilisateur : "X est déjà dans la livraison d'hier"
  → retirer UNIQUEMENT le CIFACIL X
  → consigner dans rapport : "Exclu : X — doublon livraison veille
    (signalement user)"
  → NE PAS retirer d'autres dossiers sans vérification explicite
  → si doute sur d'autres dossiers, DEMANDER à l'utilisateur plutôt
    que supposer
```

### Anti-pattern interdit

```
❌ "L'utilisateur a signalé 45864 comme doublon veille → je retire aussi
    46263, 45014, 46217, 41827, 45850 parce qu'ils semblent dans la
    même batch"
```

C'est ainsi qu'on supprime par erreur SAIDANI (41827) et LAURENT CC (46217)
qui étaient des dossiers légitimement nouveaux.

### Check-list avant retrait incrémental

Pour CHAQUE dossier candidat au retrait :

- [ ] CIFACIL présent dans le xlsx SharePoint du mois courant ?
      (lecture openpyxl + indexation par colonne F)
- [ ] CIFACIL présent dans le dernier xlsx livré en local ?
      (historique outputs/)
- [ ] Date d'envoi email/invitation ANTÉRIEURE au cut-off de la veille ?
- [ ] Signalement explicite utilisateur pour CE CIFACIL ?

Si au moins UNE de ces 4 cases n'est pas cochée avec certitude → **GARDER**
le dossier et laisser l'utilisateur arbitrer.

---

## 18. Rapport d'extraction (à côté du xlsx)

Écrire `Suivi_GSupport_[MOIS]_[ANNEE]_rapport.txt` contenant :

```
=== Rapport extraction G Support — [MOIS] [ANNEE] ===
Date du run       : 2026-04-24 14:30
Mode              : full | update
Période           : 01/04/2026 → 30/04/2026

--- Sources ---
Calendrier (attendee)  : 8 événements bruts
Emails (recipient)     : 7 emails bruts
Email recap            : 0 événements bruts
TOTAL brut             : 15 entrées

--- Dédoublonnage ---
Doublons éliminés      : 4 (cal↔email)
Annulés exclus         : 1 ["Annulé: GSUPPORT TEST RUDY"]
Tests exclus           : 1 ["GSUPPORT TEST RUDY"]
Sans CIFACIL exclus    : 0
Doublons livraison veille (user) : 1 [45864]
TOTAL net              : 13 invitations uniques

--- Redirections EMAIL_REDIRECT (v2.4) ---
Madison → Gilles RICHARD : 1 [41827 SAIDANI]

--- Croisement encaissements ---
Lignes avec match      : 2 [44746, 43960]
Lignes sans match      : 11
Encaissements orphelins (CIFACIL présent, pas d'invitation) : 23

--- Synthèse par filière ---
GIMMO  : 7 dossiers
GSUB   : 2 dossiers
CONSEIL: 2 dossiers
GAI    : 2 dossiers

--- Synthèse par responsable (après redirection) ---
Gilles RICHARD : 3 | JA : 4 | Harun : 1 | Jérémie HUMBERT : 1
Apolline : 4 | Florian : 1 | Antonio : 1
```

---

## 19. Processus d'extraction complet — checklist d'exécution

1. **Paramètres** : mois, année, mode (full/update) → à demander si ambigu
2. **Extraction Outlook** paginée : Source 1, 2, 3 avec `offset` incrémenté tant que plein
3. **Dédoublonnage** : appliquer clé `(CIFACIL, date_événement)` + exclusions (cancelled, TEST, sans CIFACIL)
4. **Dédoublonnage incrémental** : respecter §17.0 — ne retirer QUE les CIFACIL explicitement signalés comme doublons veille
5. **Localisation encaissements** : `sharepoint_search`
6. **Lecture encaissements** : méthode A (load_workbook) ou B (read_resource)
7. **Croisement par CIFACIL** : enrichir événements avec lignes encaissements
8. **Résolution TYPE_RULES v2.5** : mots-clés métier avant RDV préfixe
9. **Redirection EMAIL_REDIRECT v2.4** : Expéditeur réel (G) vs Responsable effectif (AI)
10. **Génération Excel** : 35 colonnes (v2.3), styles, formules `SUBTOTAL` sur O/R/Y/AB/AF/AH, tri date_envoi ASC
11. **Rapport d'extraction** : écrire `_rapport.txt` à côté, inclure section Redirections
12. **Upload SharePoint** (optionnel) : remplacer `Suivi_GSupport_[MOIS]_[ANNEE].xlsx` sur le share
