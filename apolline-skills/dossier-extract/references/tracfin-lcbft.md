# Références `/dossier-extract` v2.3 — Volet TRACFIN / LCB-FT (confidentiel L.561-18 CMF)

> Fichier annexe lu par `/dossier-extract` v2.3+ depuis le dossier `references/`. Contient le volet LCB-FT complet qui produit le fichier `AA tracfin_analysis.txt` (classification client, 8 signaux d'alerte, PPE, GAFI, mesures de vigilance, recommandation du skill). Strictement cloisonné du reste des livrables — voir section Confidentialité en fin de fichier. Le SKILL.md principal pointe vers ce fichier pour la section "VOLET TRACFIN".

---

# VOLET TRACFIN — Production de `AA tracfin_analysis.txt`

## Cadre réglementaire

Groupe Apolline, courtier IOBSP, est **assujetti à la LCB-FT** (Lutte contre le Blanchiment de Capitaux et le Financement du Terrorisme) en application des articles **L.561-1 et suivants du Code Monétaire et Financier**.

- **Déclarant TRACFIN désigné** : Sébastien AUJARD (sebastien@groupe-apolline.com)
- **Inscription ERMES** : en cours de finalisation
- **Obligation de confidentialité absolue** (art. L.561-18 CMF) : le volet TRACFIN ne doit **JAMAIS** être divulgué au client, ni à la banque, ni à tout tiers non autorisé. L'infraction constitue un **délit pénal** puni de **22 500 €** (art. L.574-1 CMF).

## Règle cardinale — Cloisonnement physique

Le fichier `AA tracfin_analysis.txt` est produit **en plus** de `AA summary extract.txt`, dans le même répertoire (dossier client). **AUCUN skill aval** (`dossier-html`, `dossier-html-pro`, `dossier-html-r1`, `dossier-r1-etude-client`, `ddp-pdf`, `conformite-fiche-conseil`, `conformite-fiche-solvabilite`, `conformite-mise-en-garde`) ne doit être modifié pour lire ce fichier. Les skills avals continuent à ne lire que `AA summary extract.txt`.

Cette séparation physique garantit l'absence de **tipping-off** (divulgation involontaire au client via un livrable dérivé).

## Règle de dépendance — ordre de production

Le fichier TRACFIN est produit **APRÈS** que les §1 à §5 de `AA summary extract.txt` ont été générés. Il **réutilise les données déjà en mémoire** — pas de nouveau parsing PDF. Si l'analyse forensique §4 (13 catégories + PNB) a déjà été produite, elle est directement exploitée pour les signaux §3 de TRACFIN.

## En-tête obligatoire du fichier

```
================================================================================
AA tracfin_analysis.txt
================================================================================
DOCUMENT CONFIDENTIEL — LCB-FT / TRACFIN
Réglementation    : art. L.561-1 et s. du Code Monétaire et Financier
Interdict. divulg.: art. L.561-18 CMF (infraction pénale : L.574-1)
Dossier           : [NOM Prénom — ZZ NOM Prénom]
Date d'analyse    : [JJ/MM/AAAA HH:MM]
Version skill     : dossier-extract v2.0
Déclarant désigné : Sébastien AUJARD (sebastien@groupe-apolline.com)
ERMES             : inscription en cours
================================================================================
```

---

## §1 — IDENTIFICATION CLIENT

Recopier depuis §1 du summary pour que le fichier TRACFIN soit **auto-portant** (lisible sans devoir ouvrir un autre fichier).

Pour **chaque emprunteur** :
- NOM, Prénom(s)
- Date et lieu de naissance
- Nationalité
- Adresse actuelle complète
- Profession, employeur
- Lien avec co-emprunteur (conjoint, PACS, indivision, concubin, co-acquéreur, aucun…)

Source : §1 du summary déjà extrait.

### Format

```
§1 — IDENTIFICATION CLIENT
────────────────────────────────────────────────────────────

EMPRUNTEUR 1
  NOM, Prénom          : [NOM Prénom]
  Naissance            : JJ/MM/AAAA à [Ville] ([Pays])
  Nationalité          : [Française / Belge / autre]
  Adresse              : [adresse complète]
  Profession           : [profession]
  Employeur            : [employeur]
  Lien co-emprunteur   : [conjoint / PACS / concubin / indivision / aucun]

EMPRUNTEUR 2
  [même structure]
```

---

## §2 — CLASSIFICATION DU RISQUE

Niveau à attribuer : **🟢 FAIBLE / 🟡 STANDARD / 🔴 ÉLEVÉ-SUSPICION**

### Grille (procédure interne Apolline §3.2)

- **🟢 FAIBLE** — client stable, projet cohérent, financement standard, revenus traçables, aucun signal §3 déclenché.
- **🟡 STANDARD** — premières incohérences mineures, apport d'origine incertaine mais explicable, PPE entourage, opération atypique, 1 à 2 signaux §3 détectés (non confirmés).
- **🔴 ÉLEVÉ-SUSPICION** — client pressé, fonds non justifiés, incohérence patrimoniale importante, production de faux documents, opération d'un montant inhabituellement élevé, ≥ 1 signal §3 confirmé.

### Format

```
§2 — CLASSIFICATION DU RISQUE
────────────────────────────────────────────────────────────

Niveau retenu : 🟢 FAIBLE / 🟡 STANDARD / 🔴 ÉLEVÉ-SUSPICION

Justification (3 à 5 lignes factuelles) :
  [Paragraphe argumentant le choix, avec renvoi aux pièces sources
   et aux signaux §3 déclenchés si applicable.]
```

---

## §3 — MATRICE DES 8 SIGNAUX D'ALERTE

Pour chaque signal, coter **Absent / Détecté / Confirmé** avec preuve documentaire (fichier source + page + montant).

Signaux issus de la procédure interne Apolline §4 :

| # | Signal | Source de détection dans le summary |
|---|---|---|
| 1 | Apport personnel dont l'origine ne peut être justifiée (donation informelle, fonds espèces, virement tiers non identifié) | §4 Comptes & épargne + forensique cat. 3 (retraits DAB), 7 (aides familiales), 9 (comptes miroirs), 10 (activités parallèles) |
| 2 | Incohérence manifeste entre revenus déclarés et train de vie ou valeur du bien | §3 Revenus + §4 forensique cat. 11 (dépenses discrétionnaires) + §5 prix du bien |
| 3 | Client pressé, refusant de répondre, ou fournissant des justificatifs de mauvaise qualité / suspects | Notes de rendez-vous + qualité des pièces scannées (renseignement manuel si indisponible) |
| 4 | Projet immobilier avec plusieurs changements d'acquéreur ou de vendeur en peu de temps | §5 Projet — compromis + avenants + historique mutations DVF si `/dossier-html-dvf` a tourné |
| 5 | Prix de vente manifestement sous-évalué ou surévalué sans justification économique | §5 Projet (prix compromis) croisé avec comparables DVF |
| 6 | Intervention de multiples tiers dans le financement sans lien apparent avec le client | §4 forensique cat. 9 (comptes miroirs) + §2 Tiers (hébergeur, garant) |
| 7 | Client résidant à l'étranger ou ayant des liens avec pays tiers à risque élevé (liste GAFI) | §1 Porteurs (nationalité, adresse, lieu de naissance) + §4 relevés bancaires (virements internationaux) |
| 8 | Renoncement soudain au financement après collecte des documents | Statut du dossier (abandonné post-collecte) — renseignement manuel si applicable |

### Format

```
§3 — MATRICE DES 8 SIGNAUX D'ALERTE
────────────────────────────────────────────────────────────

| # | Signal                                        | État     | Preuve documentaire                              |
|---|-----------------------------------------------|----------|--------------------------------------------------|
| 1 | Apport non justifié                           | Absent / Détecté / Confirmé | [fichier, page, montant] |
| 2 | Incohérence revenus / train de vie            | …        | …                                                |
| 3 | Client pressé / justificatifs suspects         | …        | …                                                |
| 4 | Mutations multiples acquéreur/vendeur          | …        | …                                                |
| 5 | Prix sous ou sur-évalué sans justification     | …        | …                                                |
| 6 | Tiers multiples sans lien                      | …        | …                                                |
| 7 | Lien pays GAFI                                 | …        | …                                                |
| 8 | Renoncement post-collecte                      | …        | …                                                |
```

---

## §4 — CHECK PPE (Personne Politiquement Exposée)

Recherche nominative sur :
- Chaque **emprunteur**
- **Conjoint / partenaire PACS** (si non co-emprunteur)
- **Ascendants directs** (parents) — si mentionnés (donation, caution)

### Sources à interroger

Utiliser en priorité les **connecteurs MCP déjà branchés** :
- `recherche-acteurs-politiques` (base HATVP / Pappers Politique)
- `recherche-dirigeants` (Pappers)
- **Listes de sanctions UE** publiées (gel des avoirs)

### Résultats possibles

- **PPE Confirmée** — l'emprunteur ou un proche exerce / a exercé une fonction politique exposée
- **Entourage PPE** — un parent, conjoint ou associé proche est PPE
- **Pas de match** — aucun résultat

Si match, **détailler** la fonction politique identifiée et la date d'exercice.

### Format

```
§4 — CHECK PPE
────────────────────────────────────────────────────────────

EMPRUNTEUR 1
  Recherche            : [NOM Prénom]
  Résultat             : PPE Confirmée / Entourage PPE / Pas de match
  Détail               : [fonction politique, date, source — si match]

EMPRUNTEUR 2
  [idem]

CONJOINT / PACS (si non co-emprunteur)
  [idem]

ASCENDANTS (si mentionnés — donation, caution)
  [idem]

Sources interrogées   : HATVP (via recherche-acteurs-politiques),
                        Pappers dirigeants (via recherche-dirigeants),
                        listes de sanctions UE
Date du check         : [JJ/MM/AAAA HH:MM]
```

---

## §5 — CHECK GAFI (Juridictions à haut risque / sous surveillance)

Croiser avec la **liste GAFI** (Groupe d'Action Financière) en vigueur :
- Adresse de résidence de chaque emprunteur
- Lieu de naissance de chaque emprunteur
- Pays d'origine des virements bancaires entrants (§4 forensique)
- Pays de destination des virements bancaires sortants

### Liste GAFI intégrée au skill

⚠ **Liste à date de révision : février 2025** — à mettre à jour trimestriellement (révisions GAFI : février, juin, octobre).

**Juridictions à haut risque — « liste noire » (contre-mesures / vigilance renforcée obligatoire)** :
- Corée du Nord (RPDC)
- Iran
- Myanmar (Birmanie)

**Juridictions sous surveillance renforcée — « liste grise »** :
- Algérie, Angola, Bulgarie, Burkina Faso, Cameroun, Côte d'Ivoire, Croatie
- République démocratique du Congo, Haïti, Kenya, Laos, Liban, Mali
- Monaco, Mozambique, Namibie, Népal, Nigeria, Afrique du Sud
- Soudan du Sud, Syrie, Tanzanie, Venezuela, Vietnam, Yémen

### Format

```
§5 — CHECK GAFI
────────────────────────────────────────────────────────────

Adresse emp. 1        : [pays] → [Aucun / Haut risque / Surveillance]
Lieu naissance emp. 1 : [pays] → [Aucun / Haut risque / Surveillance]
Adresse emp. 2        : [pays] → [idem]
Lieu naissance emp. 2 : [pays] → [idem]

Virements entrants (pays d'origine identifiés)  : [liste pays] → [catégorie]
Virements sortants (pays de destination)        : [liste pays] → [catégorie]

Résultat global       : Aucun lien / Lien avec [pays] catégorie [haut risque / surveillance]

Liste GAFI utilisée   : révision février 2025 (à actualiser trimestriellement)
```

---

## §6 — MESURES DE VIGILANCE APPLIQUÉES

Selon la classification §2, appliquer les mesures correspondantes :

### 🟢 FAIBLE — Vigilance simplifiée

- Vérification d'identité standard (CNI/passeport + justif domicile récent)
- Collecte des justificatifs habituels (revenus, patrimoine, projet)
- Pas d'enquête étendue sur l'origine des fonds

### 🟡 STANDARD — Vigilance renforcée

- **Attestation écrite d'origine des fonds** signée par l'emprunteur
- **Relevés bancaires étendus** : 6 mois au lieu de 3
- **Questions écrites** documentées sur l'historique patrimonial et les apports
- **Croisement systématique** URSSAF / IRPP / bulletins pour cohérence des revenus
- **Déclaration des liens PPE entourage** si applicable
- Traçabilité renforcée des échanges (e-mails archivés)

### 🔴 ÉLEVÉ-SUSPICION — Vigilance ultra-renforcée + préparation déclaration

- **Demande écrite signée** d'origine des fonds avec justificatifs bancaires complets
- **Relevés bancaires 12 mois minimum** (tous comptes, y compris comptes miroirs détectés)
- **Enquête sur les bénéficiaires effectifs** si société signataire du mandat (P1)
- **Évaluation indépendante** de la valeur vénale du bien si surévaluation suspectée (§5 + DVF)
- **Préparation du dossier de déclaration de soupçon** en vue d'un dépôt ERMES
- **Suspension temporaire** du dossier jusqu'à levée de doute, à la discrétion du déclarant désigné
- Documentation exhaustive de toute la piste d'audit

### Format

```
§6 — MESURES DE VIGILANCE APPLIQUÉES
────────────────────────────────────────────────────────────

Niveau appliqué       : 🟢 Simplifiée / 🟡 Renforcée / 🔴 Ultra-renforcée

Mesures cochées :
  [X] Vérification identité standard
  [X] Collecte justificatifs habituels
  [ ] Attestation écrite d'origine des fonds
  [ ] Relevés étendus 6 mois
  [ ] Relevés étendus 12 mois
  [ ] Croisement URSSAF/IRPP/bulletins
  [ ] Déclaration PPE entourage
  [ ] Enquête bénéficiaires effectifs
  [ ] Évaluation indépendante du bien
  [ ] Préparation dossier ERMES
  [ ] Suspension temporaire du dossier

Commentaire libre     : [notes complémentaires du déclarant]
```

---

## §7 — RECOMMANDATION DU SKILL (aide à la décision, PAS une décision)

> **La décision finale reste humaine et appartient au déclarant désigné** (Sébastien AUJARD). Le skill se contente de proposer une orientation automatique basée sur §2 à §6.

### Trois issues possibles

**➤ PAS DE SUITE**
Critères cumulés : §2 = FAIBLE **ET** aucun signal §3 Confirmé **ET** §4 PPE « Pas de match » **ET** §5 « Aucun lien GAFI ».

**➤ NOTE INTERNE AU DÉCLARANT DÉSIGNÉ**
Critères (au moins un) : §2 = STANDARD, **OU** ≥ 1 signal §3 « Détecté » (non confirmé), **OU** PPE « Entourage », **OU** élément nécessitant un suivi interne sans atteindre le seuil de déclaration.

**➤ DÉCLARATION DE SOUPÇON TRACFIN À ENVISAGER**
Critères (au moins un) : §2 = ÉLEVÉ-SUSPICION, **OU** ≥ 1 signal §3 « Confirmé », **OU** PPE « Confirmée » couplée à une opération atypique, **OU** lien pays GAFI haut risque + incohérence financière §3.

### Format obligatoire

```
§7 — RECOMMANDATION AUTOMATIQUE
────────────────────────────────────────────────────────────

Classification retenue : [FAIBLE / STANDARD / ÉLEVÉ-SUSPICION]
Signaux confirmés      : [liste # — ex: #1, #5]
Signaux détectés       : [liste # — ex: #2]
PPE                    : [Aucune / Entourage / Confirmée]
Lien GAFI              : [Aucun / Pays X — catégorie]

→ Recommandation       : [PAS DE SUITE / NOTE INTERNE /
                          DÉCLARATION DE SOUPÇON À ENVISAGER]
→ Déclarant désigné    : Sébastien AUJARD
                         (sebastien@groupe-apolline.com)
→ ERMES                : inscription en cours
→ Motivation           : [3 à 5 lignes factuelles argumentant la reco]

⚠ CETTE RECOMMANDATION EST UNE AIDE À LA DÉCISION.
⚠ LA DÉCISION FINALE RESTE HUMAINE.
⚠ CE FICHIER EST CONFIDENTIEL (L.561-18 CMF).
⚠ NE JAMAIS COMMUNIQUER AU CLIENT, À LA BANQUE, OU À TOUT TIERS.
```

---

## Pied de fichier obligatoire — Piste d'audit ACPR

À la fin du fichier `AA tracfin_analysis.txt`, ajouter **systématiquement** :

```
================================================================================
PISTE D'AUDIT
================================================================================
Date création fichier  : [ISO8601 — ex: 2026-04-21T10:42:00+02:00]
Dernière modification  : [ISO8601]
Version skill utilisée : dossier-extract v2.0
Pièces analysées       :
  - [fichier1.pdf] — SHA-256 : [hash hex 64 caractères]
  - [fichier2.pdf] — SHA-256 : [hash hex 64 caractères]
  - …
Conservation           : 5 ans minimum (art. L.561-12 CMF)
================================================================================
```

**Calcul des SHA-256** (à faire avec Python dans le skill) :
```python
import hashlib
for pdf in pieces_analysees:
    with open(pdf, 'rb') as f:
        h = hashlib.sha256(f.read()).hexdigest()
    # Ajouter {pdf} — SHA-256 : {h} dans le pied d'audit
```

---

## Confidentialité et diffusion

- Le fichier `AA tracfin_analysis.txt` est rangé **dans le dossier client**, accessible aux collaborateurs Apolline formés à la LCB-FT. La circulation interne maîtrisée est assumée au titre de l'art. **L.561-34 CMF** (communication d'informations au sein d'un groupe).
- **NE JAMAIS** recopier tout ou partie du contenu TRACFIN dans un autre livrable : dossier HTML client, PDF banque, fiche signée par le client, mail au client ou à la banque, simulation locative, etc. **Cloisonnement physique absolu**.
- Les autres skills (`dossier-html`, `dossier-html-pro`, `dossier-html-r1`, `dossier-r1-etude-client`, `ddp-pdf`, `conformite-*`) **ne lisent PAS** ce fichier. Ne pas les modifier pour qu'ils y aient accès.
- En cas d'export du dossier client vers un tiers (banque, client, notaire), **retirer systématiquement** `AA tracfin_analysis.txt` de l'export.
- En cas d'erreur de production (publication accidentelle), informer immédiatement le déclarant désigné (Sébastien AUJARD).

---

## Règle de propreté

- Les **deux livrables** `AA summary extract.txt` et `AA tracfin_analysis.txt` vont directement **dans le dossier client**, préfixés `AA ` pour apparaître en tête du dossier. Ce sont les seuls fichiers du skill qui y sont déposés — persistants, synchronisés OneDrive.
- Tous les autres fichiers de travail (scripts Python .py, fichiers temporaires d'analyse, logs) vont **uniquement dans le répertoire de session**, jamais dans le dossier client.
- Aucun script Python (.py) ne reste dans le dossier client.
