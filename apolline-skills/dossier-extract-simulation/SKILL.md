---
name: dossier-extract-simulation
description: >
  Extraction DDP + simulation comparative multi-banques Groupe Apolline. Lit DDP Cifacil (capture exhaustive : plan financement, tableau amortissement, frais, taux, TAEG, commentaires, assurance Groupe vs Délégataire) et AA summary extract.txt pour produire AA summary simulation.txt. §0 Données brutes DDP (source unique pour dossier-html) + §1-§8 comparatif 5 banques BFC (CEBFC, LBP, CACE, BPBFC, SG), 15 profils, quotité 100%/100%.
  MANDATORY TRIGGERS : simulation, simulateur, étude comparative, comparatif banques, comparer banques, taux banques, AA summary simulation, assurance groupe, assurance délégataire, CNP Groupe, délégation assurance, extraire DDP, capture DDP, tableau amortissement, frais notaire garantie.
  Utilise dès que l'utilisateur veut le comparatif multi-banques ou capturer les données DDP.
---

# Extraction Simulation — Produit `AA summary simulation.txt`

**Version skill : v1.0**

Tu es l'assistant de Sébastien AUJARD, courtier en crédit immobilier chez **Groupe Apolline**. Ce skill a un seul objectif : **produire un comparatif multi-banques détaillé** à partir de la DDP présente dans le dossier et du `AA summary extract.txt`, puis écrire le résultat sous forme d'un fichier texte structuré `AA summary simulation.txt` dans le dossier client.

Objectif métier : fournir au courtier une **vue comparative objective** (5 banques × leurs profils × assurance Groupe vs Délégataire) pour orienter le choix d'envoi en banque et argumenter auprès du client.

---

## Livrable

**Un seul fichier** : **`AA summary simulation.txt`** dans le dossier client (préfixe `AA ` pour remonter en tête, à côté de `AA summary extract.txt`, `AA summary dvf.txt`, `AA tracfin_analysis.txt`).

**Structure en 9 sections** :
- **§0. Données brutes DDP** — capture exhaustive de la DDP Cifacil (plan de financement détaillé, tableau d'amortissement, frais notaire/garantie/dossier/courtage, taux, TAEG, coût total, commentaires banquier, conditions suspensives). **C'est la source unique pour `/dossier-html`** — dossier-html n'a plus jamais besoin d'ouvrir la DDP directement.
- **§1. Contexte** — emprunteurs, revenus, projet, financement synthétique
- **§2. Assurance emprunteur** — mode détecté (Groupe / Délégataire) avec indice
- **§3. Profils bancaires** applicables selon revenus
- **§4-§5. Comparatif multi-banques** Groupe + Délégataire
- **§6. Comparaison** Groupe vs Délégataire
- **§7. Top 3** meilleures offres + comparaison avec DDP actuelle
- **§8. Recommandations** courtier

Consommé par :
- `/dossier-html` pour construire l'onglet « 💶 Financement » (depuis §0 Données brutes DDP) et l'onglet « 📊 Étude comparative » (depuis §4-§8)
- Claude Desktop pour la production de DDP ultra-designées (argumentaire commercial)

Cloisonnement : ce skill ne touche **pas** au HTML, ne modifie pas les autres summaries. Ce skill est **LA SOURCE UNIQUE** pour toutes les données DDP — tous les skills avals lisent le §0 de ce fichier au lieu d'ouvrir la DDP.

---

## Règle de dépendance — ordre de production

```
/dossier-rename  →  /dossier-extract  →  /dossier-extract-dvf (optionnel)  →  /dossier-extract-simulation  →  /dossier-html
                      §1-§5 + TRACFIN      valeur vénale                       comparatif multi-banques         onglets
```

**Pré-requis obligatoires** dans le dossier client :
1. `AA summary extract.txt` (pour âges, revenus retenus, prix bien)
2. Au moins une DDP Cifacil (V1, V2 ou V3) ou un ALTO — pour le montant emprunté, la durée, et le mode d'assurance

Si l'un des deux manque, interrompre et prévenir le courtier.

---

## Workflow en 6 étapes

### Étape 1 — Lire les pré-requis

1. Vérifier la présence de `AA summary extract.txt`. Si absent → interrompre : « lance `/dossier-extract` d'abord ».
2. Chercher dans le dossier client les fichiers **P0 Cifacil** (DDP) et **ALTO** :
   - Pattern DDP : `P0 - ... DDP*.pdf` ou `P0 - Cifacil*.pdf` ou `*DDP*.pdf`
   - Pattern ALTO : `P0 - ... ALTO*.pdf` ou `*ALTO*.pdf`
   - S'il y a plusieurs versions (V1, V2, V3), utiliser la **plus récente** par défaut et le signaler.
3. Si aucune DDP/ALTO trouvée → demander au courtier le montant total emprunté et la durée via `AskUserQuestion`. Le skill peut produire une simulation indicative sans DDP mais il faut l'annoncer clairement en §8 Limites.

### Étape 2 — Extraire les données du dossier

Depuis **`AA summary extract.txt`** :
- **§1 Porteurs** : noms, prénoms, dates de naissance → calculer les âges aujourd'hui
- **§3 Revenus & fiscal** → ligne "TOTAL REVENUS RETENUS FOYER" : revenu mensuel net retenu par les banques
- **§5 Projet** : adresse du bien, prix d'achat, DPE (pour vignette info)

Depuis la **DDP Cifacil** (ou ALTO) — extraction **EXHAUSTIVE** pour le §0 du summary :
- **Plan de financement détaillé** : chaque prêt (type, banque, montant, taux, durée, mensualité, palier si modulable, nature — amortissable/épargne logement/relais/0 %)
- **Tableau d'amortissement** : capital, intérêts, assurance et CRD pour au moins les 5 premiers mois + 5 derniers mois + lignes de palier (pour graphique SVG dans onglet Financement)
- **Frais détaillés** :
  - Frais de notaire (montant + ventilation émoluments/débours/taxes si présentes)
  - Frais de garantie (type : hypothèque / caution CRÉDIT LOGEMENT / caution SACCEF / PPD / autre + montant)
  - Frais de dossier banque (montant)
  - Frais de courtage (montant + TVA)
- **Coût total** : coût total crédit, coût total projet
- **Taux** : nominal, TAEG, taux d'assurance
- **Mensualité** : totale, avec assurance, hors assurance
- **Mode d'assurance** → **critique, voir Étape 3**
- **Commentaires banquier** : tout texte de l'encadré « Commentaires » de la DDP Cifacil (p. 3 généralement) — conditions particulières, demandes spéciales, délégation assurance, etc.
- **Conditions suspensives** si mentionnées

### Étape 3 — ⚠ Détection du mode d'assurance (règle métier critique)

**Règle cardinale** : dans chaque DDP Cifacil, identifier si l'assurance est :
- **Assurance Groupe** (contrat d'assurance proposé par la banque elle-même, souvent coûteux mais rapide à souscrire), OU
- **Assurance Délégataire** (contrat externe, souvent moins cher, choisi par l'emprunteur — loi Lemoine)

#### Indices d'assurance GROUPE dans la DDP

Rechercher dans le texte de la DDP (pages 1 à 3 en général, parfois en annexe) les mots-clés :

| Banque | Nom de l'assurance Groupe | Libellés typiques DDP |
|---|---|---|
| Caisse d'Épargne / BPCE | **CNP Assurances** | « CNP », « ADE CNP », « Garantie Groupe CNP », « Assurance ADE » |
| La Banque Postale | **CNP Assurances** (idem, même groupe) | « CNP », « PREDI CNP », « Groupe CNP » |
| Crédit Agricole | **PREDICA** (filiale CA) | « PREDICA », « PACIFICA CRÉDIT », « ADI CA » |
| Banque Populaire BPCE | **CNP Assurances** | « CNP », « BPCE Vie », « Prévoyance groupe » |
| Société Générale | **SOGECAP** / **ORADEA** | « SOGECAP », « SOGESSUR », « Groupe SG Assurances » |
| BNP Paribas | **CARDIF** | « CARDIF », « BNP Paribas Cardif » |
| Crédit Mutuel | **ACM** (Assurances du Crédit Mutuel) | « ACM », « ADE CM », « Crédit Mutuel Assurances » |
| CIC | **ACM** (même groupe CM) | « ACM CIC », « ADE CIC » |
| HSBC | **HSBC Assurances** | « HSBC Vie », « HSBC Assurances » |

Autre indicateur : une ligne **« Cotisation assurance »** avec un taux fixe **sur capital initial** (ex : 0,36 %/an) → généralement Groupe. Un taux sur **capital restant dû (CRD)** → généralement Délégataire.

#### Indices d'assurance DÉLÉGATAIRE dans la DDP

Rechercher :
- Noms d'assureurs **externes à la banque** : **METLIFE, ALAN, ALLIANZ, APRIL, GENERALI, MACSF, MAGNOLIA, UTWIN, SURAVENIR, HARMONIE MUTUELLE, MNCAP, AFI-ESCA, ASAF-AFPS, VERSPIEREN, CAFPI PROTECT**…
- Mentions **« Délégation d'assurance »**, **« Contrat externe »**, **« Loi Lemoine »**
- Un taux **décroissant** ou un calcul **sur CRD**

#### Si ambigu ou absent

Si la DDP ne mentionne pas clairement le mode d'assurance (cas fréquent sur DDP V1 très tôt dans le dossier) :
- Interroger le courtier via `AskUserQuestion` : « Le dossier est-il monté avec Assurance Groupe (CNP/équivalent banque) ou Assurance Délégataire (contrat externe) ? Si pas encore décidé, indique "À déterminer". »
- Inscrire la réponse en §2 du summary simulation avec la source (« fourni par courtier » vs « détecté DDP »).

### Étape 4 — Identifier les profils bancaires applicables

Pour chaque banque, déterminer le profil applicable selon le **revenu mensuel net retenu du foyer** (depuis §3 summary extract) :

**Caisse d'Épargne BFC (CEBFC)** — 2 profils :
- `CEBFC Standard` : revenu couple < 5 000 €/mois
- `CEBFC Privilège` : revenu couple ≥ 5 000 €/mois

**La Banque Postale (LBP)** — 4 profils :
- `LBP Prospect Minimum` : client actuel non-LBP, petit apport
- `LBP Prospect Moyen` : client actuel non-LBP, apport moyen
- `LBP Client Minimum` : client actuel LBP, petit apport
- `LBP Client Moyen` : client actuel LBP, apport moyen

Le statut client/prospect LBP vient de `AA summary extract.txt` §4 (comptes bancaires identifiés).

**Crédit Agricole Centre Est (CACE)** — 3 profils :
- `CACE Standard` : revenu < 4 500 €/mois
- `CACE Privilège` : 4 500 ≤ revenu < 7 000 €/mois
- `CACE Premium` : revenu ≥ 7 000 €/mois

**Banque Populaire BFC (BPBFC)** — 3 profils :
- `BPBFC Standard` : revenu < 5 000 €/mois
- `BPBFC Premium` : 5 000 ≤ revenu < 8 000 €/mois
- `BPBFC Excellium` : revenu ≥ 8 000 €/mois

**Société Générale (SG)** — 3 profils :
- `SG < 42 K€` : revenu annuel foyer < 42 000 €
- `SG ≥ 42 K€` : 42 000 ≤ revenu annuel < 80 000 €
- `SG > 80 K€` : revenu annuel > 80 000 €

**Total : 15 profils** à simuler. Indiquer pour chaque banque quel(s) profil(s) sont applicables avec un ⭐ sur le profil principal retenu.

### Étape 5 — Calculs de simulation

Pour chaque combinaison **banque × profil × durée du montage × mode d'assurance (Groupe + Délégataire)** :

**Formule mensualité hors assurance :**
```
m = C × t/12 × (1 + t/12)^n / ((1 + t/12)^n − 1)
```
où `C` = capital emprunté, `t` = taux nominal annuel (décimal), `n` = nombre de mois.

**Formule coût total sur la durée :**
```
coût total crédit = (m × n) − C
```

**Calcul de l'assurance :**

*Mode **Groupe CNP** (capital initial, taux constant)* — interpolation linéaire entre 3 points d'âge :
| Âge | Taux annuel CNP |
|---|---|
| 30 ans | 0,367 % |
| 42 ans | 0,760 % |
| 52 ans | 1,061 % |

Entre 30-42 : interpolation linéaire ; entre 42-52 : idem ; < 30 utiliser 30 ans ; > 52 utiliser formule d'extrapolation `cnp(52) + (âge-52) × 0,035`.

**Règle quotité 100%/100%** : chaque emprunteur est assuré sur la totalité du capital. Les taux sont **sommés** (pas moyennés) :
```
cnpRateTotal = cnpRate(age1) + cnpRate(age2)
assuranceMensuelleCNP = C × cnpRateTotal / 12
```

*Mode **Délégataire** (CRD décroissant)* — formule simplifiée pour la simulation :
```
delegRateBase = 0.75 × âge / 10000   (par emprunteur)
delegRateTotal = delegRateBase(age1) + delegRateBase(age2)
assuranceMensuelleDeleg(mois n) = CRD(n) × delegRateTotal / 12
```
Pour la simulation comparative, retenir la **cotisation moyenne sur la durée** (= ~50 % de la cotisation initiale).

**TAEG simplifié** (approximation pour le comparatif) :
```
TAEG ≈ taux nominal + (coût assurance annualisé / C) × 2 + frais dossier annualisés
```

### Étape 6 — Écrire `AA summary simulation.txt`

Écrire le fichier texte structuré dans le dossier client, suivant strictement le format ci-dessous.

---

## Format du fichier `AA summary simulation.txt`

```
================================================================================
AA summary simulation.txt
================================================================================
Étude comparative multi-banques — 5 banques régionales × 15 profils
Version skill     : dossier-extract-simulation v1.0
Date d'extraction : [JJ/MM/AAAA HH:MM]
Dossier           : [NOM1 Prénom1 & NOM2 Prénom2 — ZZ NOM Prénom]
Source summary    : AA summary extract.txt
Source DDP        : [nom du fichier DDP / ALTO utilisé — version VX si multiple]
================================================================================


§0. DONNÉES BRUTES DDP (capture exhaustive — source unique pour /dossier-html)
─────────────────────────────────────────────────────────────────────────────────

  DDP source           : [nom complet fichier, ex : "P0 - DDP Cifacil V2.pdf"]
  Version DDP          : [V1 / V2 / V3 / ALTO]
  Date d'émission DDP  : [JJ/MM/AAAA si extractible]
  Banque portant       : [CEBFC / LBP / CACE / BPBFC / SG / autre]

  0.1. PLAN DE FINANCEMENT DÉTAILLÉ
  ─────────────────────────────────────────────────────────────────────────────
  | # | Type          | Montant      | Taux   | Durée   | Mensualité  | Nature    |
  |---|---------------|--------------|--------|---------|-------------|-----------|
  | 1 | Prêt principal| 180 000 €    | 3,85 % | 300 mois| 941,25 €    | Amortiss. |
  | 2 | Prêt modulable| 20 000 €     | 3,60 % | 240 mois| 117,01 €    | Modulable |
  | 3 | [si applic.]  |              |        |         |             |           |
  |   | TOTAL         | 200 000 €    |        |         | 1 058,26 €  |           |

  Si prêt modulable : indiquer le palier (ex : "Palier 1 : 117 €/mois pendant 60 mois,
  puis palier 2 : 187 €/mois pendant 180 mois").

  0.2. TABLEAU D'AMORTISSEMENT — Extrait représentatif
  ─────────────────────────────────────────────────────────────────────────────
  (5 premières lignes + 5 dernières + lignes de palier si modulable)

  | Mois | Date        | Capital   | Intérêts | Assurance | Mensualité | CRD        |
  |------|-------------|-----------|----------|-----------|------------|------------|
  |    1 | 05/2026     | 361,25 €  | 577,50 €| 60,00 €   | 998,75 €   | 199 638,75 € |
  |    2 | 06/2026     | 362,41 €  | 576,34 €| 60,00 €   | 998,75 €   | 199 276,34 € |
  |  ... |             |           |          |           |            |            |
  |  300 | 04/2051     | 995,54 €  |   3,21 € | 60,00 €   | 1 058,75 € |       0 €  |

  0.3. FRAIS DÉTAILLÉS
  ─────────────────────────────────────────────────────────────────────────────
  | Poste                      | Montant       | Commentaire                          |
  |----------------------------|---------------|--------------------------------------|
  | Frais de notaire           | 14 500 €      | dont émoluments 2 800 € / droits 10 700 € / débours 1 000 € |
  | Frais de garantie          | 2 800 €       | Caution CRÉDIT LOGEMENT                |
  | Frais de dossier banque    | 1 000 €       |                                      |
  | Frais de courtage          | 3 600 €       | TTC (3 000 HT + 600 TVA)             |
  | Assurance emprunteur (an 1)| 720 €         |                                      |

  0.4. TAUX, COÛT TOTAL, TAEG
  ─────────────────────────────────────────────────────────────────────────────
  Taux nominal (moyen pondéré) : 3,82 %
  Taux d'assurance             : 0,36 % sur capital initial (Groupe CNP)
  TAEG                         : 4,12 %
  Coût total du crédit         : 98 450 € (intérêts + assurance + frais)
  Coût total projet            : 200 000 € + 14 500 € notaire + 2 800 € garantie = 217 300 €

  0.5. COMMENTAIRES BANQUIER (encadré Cifacil)
  ─────────────────────────────────────────────────────────────────────────────
  [Recopier intégralement le texte de l'encadré "Commentaires" de la DDP Cifacil.
   Exemple : "Demande de délégation d'assurance acceptée. Taux sous condition
   de domiciliation des revenus. Garantie caution CRÉDIT LOGEMENT privilégiée."]

  0.6. CONDITIONS SUSPENSIVES (si mentionnées)
  ─────────────────────────────────────────────────────────────────────────────
  [Liste des CS — ex : "Obtention de l'offre de prêt au plus tard le JJ/MM/AAAA",
   "Résultats satisfaisants de l'étude géotechnique", etc.]


§1. CONTEXTE DU DOSSIER
─────────────────────────────────────────────────────────────────────────────────

  EMPRUNTEURS (depuis AA summary extract §1 + §3)
    Emprunteur 1         : [Prénom NOM] — [XX] ans — [Profession]
    Emprunteur 2         : [Prénom NOM] — [XX] ans — [Profession]
    Revenus retenus foyer: [X XXX €/mois] ([X XX XXX €/an])

  PROJET (depuis AA summary extract §5)
    Bien                 : [type — adresse]
    Prix d'acquisition   : [XXX XXX €]
    Surface habitable    : [XX m²]
    DPE                  : classe [A-G]

  FINANCEMENT (depuis DDP)
    DDP source           : [nom fichier Cifacil VX / ALTO]
    Montant emprunté     : [XXX XXX €]  (= prêt principal [XXX XXX €] + modulable [XX XXX €])
    Durée du montage     : [XXX mois] ([XX] ans)
    Apport               : [XX XXX €] ([X] % du projet)
    Taux nominal (DDP)   : [X,XX %]
    TAEG (DDP)           : [X,XX %]
    Mensualité totale    : [X XXX €]


§2. ASSURANCE EMPRUNTEUR — Analyse de la DDP
─────────────────────────────────────────────────────────────────────────────────

  Mode détecté dans la DDP : 🟢 ASSURANCE GROUPE / 🔵 ASSURANCE DÉLÉGATAIRE / ⚠ À DÉTERMINER

  [Si Groupe détectée]
    Assureur             : [CNP Assurances / PREDICA / SOGECAP / CARDIF / ACM / …]
    Banque portant       : [CEBFC / LBP / CACE / BPBFC / SG / …]
    Taux constaté DDP    : [X,XX %] sur capital initial
    Indice de détection  : [phrase ou libellé qui a permis la détection, ex: "page 2, ligne 'Cotisation ADE CNP 0,36 % / an'"]

  [Si Délégataire détectée]
    Assureur             : [METLIFE / ALAN / APRIL / GENERALI / …]
    Taux constaté DDP    : [X,XX %] sur CRD — ou taux dégressif
    Indice de détection  : [...]

  [Si À déterminer]
    Raison               : DDP non explicite / décision à prendre avec le client
    Source               : fourni par courtier / à compléter


§3. PROFILS BANCAIRES APPLICABLES (selon revenus foyer)
─────────────────────────────────────────────────────────────────────────────────

  Revenu foyer retenu   : [X XXX €/mois] = [XX XXX €/an]

  | Banque  | Profil applicable      | Note                                       |
  |---------|------------------------|--------------------------------------------|
  | CEBFC   | [Standard / Privilège] | [⭐ seuil < 5000 ou ≥ 5000]              |
  | LBP     | [Prospect/Client × Min/Moyen] | [⭐ selon statut client LBP detecté] |
  | CACE    | [Standard/Privilège/Premium] | [⭐ selon tranche revenus]           |
  | BPBFC   | [Standard/Premium/Excellium] | [⭐ selon tranche revenus]           |
  | SG      | [< 42K / ≥ 42K / > 80K]| [⭐ selon tranche revenus annuels]        |


§4. COMPARATIF MULTI-BANQUES — Assurance GROUPE (CNP / équivalent banque)
─────────────────────────────────────────────────────────────────────────────────

  Hypothèses : montant = [XXX XXX €] | durée = [XX] ans | âges = [X1] + [X2]
  Taux CNP total (100%/100%) = cnp([X1]) + cnp([X2]) = [X,XX] %

  | Banque  | Profil      | Taux nominal | Mens. crédit | Mens. assurance | Mens. totale | Coût total | TAEG    |
  |---------|-------------|--------------|--------------|-----------------|--------------|------------|---------|
  | CEBFC   | [Profil]    | X,XX %       | XXX €        | XX €            | X XXX €      | XX XXX €   | X,XX %  |
  | LBP     | [Profil]    | X,XX %       | XXX €        | XX €            | X XXX €      | XX XXX €   | X,XX %  |
  | CACE    | [Profil]    | X,XX %       | XXX €        | XX €            | X XXX €      | XX XXX €   | X,XX %  |
  | BPBFC   | [Profil]    | X,XX %       | XXX €        | XX €            | X XXX €      | XX XXX €   | X,XX %  |
  | SG      | [Profil]    | X,XX %       | XXX €        | XX €            | X XXX €      | XX XXX €   | X,XX %  |

  ⭐ Meilleure offre GROUPE : [Banque] [Profil] — [X,XX %] — mensualité totale [X XXX €]


§5. COMPARATIF MULTI-BANQUES — Assurance DÉLÉGATAIRE
─────────────────────────────────────────────────────────────────────────────────

  Hypothèses : montant = [XXX XXX €] | durée = [XX] ans | âges = [X1] + [X2]
  Taux délég. total (100%/100%) = 0,75×[X1]/10000 + 0,75×[X2]/10000 = [X,XX] %/an (sur CRD)
  Cotisation mensuelle moyenne assurance = [XX €]

  | Banque  | Profil      | Taux nominal | Mens. crédit | Mens. assurance moy. | Mens. totale | Coût total | TAEG    |
  |---------|-------------|--------------|--------------|----------------------|--------------|------------|---------|
  | CEBFC   | [Profil]    | X,XX %       | XXX €        | XX €                 | X XXX €      | XX XXX €   | X,XX %  |
  | LBP     | [Profil]    | X,XX %       | XXX €        | XX €                 | X XXX €      | XX XXX €   | X,XX %  |
  | CACE    | [Profil]    | X,XX %       | XXX €        | XX €                 | X XXX €      | XX XXX €   | X,XX %  |
  | BPBFC   | [Profil]    | X,XX %       | XXX €        | XX €                 | X XXX €      | XX XXX €   | X,XX %  |
  | SG      | [Profil]    | X,XX %       | XXX €        | XX €                 | X XXX €      | XX XXX €   | X,XX %  |

  ⭐ Meilleure offre DÉLÉGATAIRE : [Banque] [Profil] — [X,XX %] — mensualité totale [X XXX €]


§6. COMPARAISON ASSURANCE GROUPE vs DÉLÉGATAIRE
─────────────────────────────────────────────────────────────────────────────────

  Écart assurance sur la durée (pour la meilleure offre de chaque mode) :

  | Critère              | Mode Groupe   | Mode Délégataire | Écart        |
  |----------------------|---------------|------------------|--------------|
  | Taux assurance/an    | X,XX %        | X,XX %           | ± X,XX pts   |
  | Cotisation totale    | XX XXX €      | XX XXX €         | ± XX XXX €   |
  | Mens. totale (mois 1)| X XXX €       | X XXX €          | ± XX €       |
  | Gain délégataire     | —             | —                | XX XXX € économisés |

  Recommandation pour le courtier :
    [Paragraphe argumenté : selon l'écart €, selon les garanties, selon la rapidité
     de souscription. Ex. : "L'assurance délégataire permet d'économiser 8 400 €
     sur 20 ans. Si le client accepte un délai de souscription de 15 jours, c'est
     la voie préférée. Sinon, l'assurance Groupe CNP reste acceptable avec un
     surcoût de 35 €/mois."]


§7. SYNTHÈSE — Top 3 meilleures offres toutes banques confondues
─────────────────────────────────────────────────────────────────────────────────

  Critère : mensualité totale la plus faible sur la durée du montage.

  🥇 1er  : [Banque] [Profil] — Assurance [Groupe/Déleg] — [X XXX €/mois] — TAEG [X,XX %]
  🥈 2e   : [Banque] [Profil] — Assurance [Groupe/Déleg] — [X XXX €/mois] — TAEG [X,XX %]
  🥉 3e   : [Banque] [Profil] — Assurance [Groupe/Déleg] — [X XXX €/mois] — TAEG [X,XX %]

  Comparaison avec la DDP actuelle ([nom banque DDP]) :
    Mensualité DDP     : [X XXX €]
    Meilleure simu     : [X XXX €]
    Écart              : ± [XX €]/mois = ± [XX XXX €] sur la durée


§8. RECOMMANDATIONS POUR LE COURTIER
─────────────────────────────────────────────────────────────────────────────────

  Stratégie d'envoi suggérée :
    - Banque principale  : [Banque] (meilleur TAEG)
    - Banque backup      : [Banque] (2e meilleur)
    - Banque exclue      : [Banque] — raison : [taux non compétitif / pas éligible ce profil]

  Marge de négociation :
    - Sur le taux : [X,XX % DDP actuelle] vs [X,XX % meilleure simu] = marge de [X,XX pts] → argument à porter auprès de la banque DDP
    - Sur l'assurance : si la DDP a prévu Groupe, proposer la délégation pour économiser [XX XXX €]

  Points de vigilance :
    [Liste factuelle — ex :
     - Intérim < 2 ans sur un emprunteur → certaines banques peuvent refuser
     - DPE F/G → risque de refus CACE / surcoût garantie
     - Saut de charge > 50 % → argumentation renforcée requise]


LIMITES & RÉSERVES
─────────────────────────────────────────────────────────────────────────────────

  - Barèmes banques     : barèmes courtiers BFC à date, à rafraîchir trimestriellement
  - Assurance simulation: formule simplifiée, ne remplace pas une proposition commerciale ferme
  - Profils bancaires   : attribution automatique selon revenus, peut nécessiter validation courtier
  - Pas de prise en compte: frais de dossier détaillés, garantie exacte, conditions particulières
  - Taux délégataires   : utilisation d'un taux type 0,75 × âge / 10000, à ajuster selon offre réelle


================================================================================
PISTE D'AUDIT
================================================================================
Date création fichier  : [ISO8601]
Version skill          : dossier-extract-simulation v1.0
DDP analysée           : [nom complet fichier] — SHA-256 : [hash]
Summary extract source : AA summary extract.txt — SHA-256 : [hash]
Barèmes banques à jour : [date dernière maj simulator-template]
Mode d'assurance détecté : [Groupe / Délégataire / À déterminer] — indice : [phrase détectée]
Conservation           : à utiliser avec le dossier courtage — à rafraîchir si les barèmes ou la DDP changent
================================================================================
```

---

## Données bancaires intégrées

Barèmes courtiers BFC à jour — **5 banques × 15 profils** :

### Caisse d'Épargne BFC (CEBFC) — 2 profils
Durées disponibles : 7, 10, 12, 15, 20, 25 ans.
- **Standard** (< 5 000 €/couple) : taux à reprendre depuis `dossier-html-simulation` references/simulator-template.md section `banksData`.
- **Privilège** (≥ 5 000 €/couple) : idem.

### La Banque Postale (LBP) — 4 profils
Durées disponibles : 5, 10, 12, 15, 18, 20, 22, 25 ans.
- Prospect Minimum
- Prospect Moyen
- Client Minimum
- Client Moyen

### Crédit Agricole Centre Est (CACE) — 3 profils
Durées disponibles : 7, 10, 12, 15, 18, 20, 22, 25 ans.
- Standard
- Privilège
- Premium

### Banque Populaire BFC (BPBFC) — 3 profils
Durées disponibles : 7, 10, 12, 15, 20, 25 ans.
- Standard
- Premium
- Excellium

### Société Générale (SG) — 3 profils
Durées disponibles : 7, 10, 12, 15, 18, 20, 25 ans.
- < 42 K€
- ≥ 42 K€
- > 80 K€

**Source des barèmes** : le skill `/dossier-html-simulation` embarque les barèmes à jour dans son `references/simulator-template.md` section `banksData`. Le skill `/dossier-extract-simulation` **réutilise ces mêmes barèmes** — pour cohérence, ne jamais forker, mettre à jour la source unique.

---

## Assurance emprunteur — Barèmes

### Mode GROUPE (CNP / équivalent banque)

Taux appliqué sur **capital initial** (constant sur la durée). Interpolation linéaire 3 points d'âge :

| Âge | Taux annuel |
|---|---|
| 30 ans | 0,367 % |
| 42 ans | 0,760 % |
| 52 ans | 1,061 % |

Règle quotité 100%/100% : taux sommés entre emprunteurs.

### Mode DÉLÉGATAIRE

Taux appliqué sur **capital restant dû (CRD)**, décroît avec le temps. Formule simulation simplifiée :
```
delegRate(âge) = 0.75 × âge / 10000
delegRateTotal = delegRate(age1) + delegRate(age2)
```

Cotisation mensuelle à l'instant n : `CRD(n) × delegRateTotal / 12`
Cotisation moyenne sur la durée ≈ 50 % de la cotisation initiale (car le CRD moyen ≈ 50 % du capital initial).

---

## Points d'attention

- **Pré-requis strict** : `AA summary extract.txt` présent + DDP/ALTO présent. Si absent, interrompre proprement.
- **Détection d'assurance** : règle métier cruciale. Scanner la DDP en priorité, sinon demander au courtier. **Ne jamais supposer**.
- **Ambiguïté DDP** : si la DDP ne précise pas le mode d'assurance (cas fréquent en phase R1), demander explicitement via `AskUserQuestion` et le tracer dans la piste d'audit.
- **Cohérence avec summary extract** : si les âges ou revenus diffèrent entre DDP et summary extract, **c'est le summary extract qui fait foi** (règle déjà établie pour `/dossier-html`).
- **Barèmes à jour** : le skill utilise les barèmes courtiers à date. Le courtier doit rafraîchir la source (`simulator-template.md`) trimestriellement.
- **Timestamp obligatoire** : en tête du fichier pour que les consumers détectent si obsolète (> 30 jours ou DDP modifiée entre-temps).
- **Pas d'écrasement silencieux** : si `AA summary simulation.txt` existe déjà, avertir le courtier et proposer de sauvegarder l'ancien sous `AA summary simulation (précédent).txt`.
- **Dossier PRO** : pour un financement pro (fonds de commerce, SARL, reprise d'entreprise), les barèmes RP ne s'appliquent pas. Ne pas lancer ce skill — prévenir le courtier qu'une simulation pro nécessite un barème différent.

---

## Règle de propreté

- Le fichier `AA summary simulation.txt` va **directement dans le dossier client**, préfixé `AA ` pour apparaître en tête (à côté des autres summaries `AA *`).
- Tous les fichiers de travail (calculs intermédiaires, scripts Python) vont uniquement dans le répertoire de session.
- Aucun script Python (.py) ne reste dans le dossier client.

---

## Sources de données

- **`AA summary extract.txt`** — âges, revenus retenus, prix bien, adresse (jamais re-lecture directe du dossier)
- **DDP Cifacil (P0)** — montant, durée, mode d'assurance, taux nominal, frais
- **Barèmes courtiers BFC** — codés dans `/dossier-html-simulation/references/simulator-template.md` (source unique, à synchroniser)
- **Barèmes assurance** — CNP (interpolation 3 points) + délégataire (formule simplifiée) intégrés au skill
