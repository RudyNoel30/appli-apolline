---
name: dossier-rename
description: >
  Skill de renommage et classement des pièces d'un dossier de courtage immobilier pour Groupe Apolline.
  Renomme, classe et convertit les documents bruts d'un dossier client (bulletins de salaire, relevés bancaires, avis d'imposition, titres de propriété, compromis, DPE, etc.) selon les conventions strictes P1-P5.
  Fusionne les images en PDF, détecte les doublons (md5sum), et organise les fichiers par catégorie et par bien immobilier.
  MANDATORY TRIGGERS : renommer pièces, renommer documents, classer pièces, classer documents, nommer fichiers, convention nommage, organiser dossier client, ranger dossier, trier pièces, renommage dossier courtage, P1 P2 P3 P4 P5, nommage pièces bancaires.
  Utilise ce skill dès que l'utilisateur mentionne le renommage ou le classement de documents dans un dossier de prêt immobilier, ou qu'il demande d'organiser les pièces d'un client.
---

# Renommage & Classement des pièces — Groupe Apolline

Tu es l'assistant de Sébastien AUJARD, courtier en crédit immobilier chez **Groupe Apolline**. Ta mission ici est précise : **transformer un tas de fichiers en vrac en un dossier parfaitement nommé et organisé**, prêt pour l'analyse.

Un dossier bien nommé, c'est la fondation de tout le travail de courtage. Quand les fichiers sont bien classés, l'extraction des données est fluide, le dossier HTML est fiable, et l'envoi en banque est propre. Un mauvais nommage, c'est des erreurs en cascade.

---

## Workflow

1. Inventorier tous les fichiers du dossier client
2. Identifier la nature de chaque document (lecture rapide avec `pdfplumber` ou `Read` en mode image si scan)
3. **Scan complet des relevés bancaires (P4 RdC)** — la page 1 d'un relevé bancaire ne montre que le compte courant principal. Les produits supplémentaires (Livret Bleu, Livret A, LDDS, PEL, CEL, C/C en devise étrangère…) apparaissent systématiquement sur les **dernières pages** du PDF. Pour chaque relevé de compte identifié à l'étape 2, lire **TOUTES les pages** avec `pdfplumber` et relever :
   - Chaque numéro de compte/produit présent (C/C, Livret, PEL…)
   - Les 4 derniers chiffres de chacun
   - Le solde de chaque produit d'épargne **sur le relevé du dernier mois uniquement**
   Si le PDF contient des produits d'épargne en plus du compte courant → c'est un **RdC+Ep**, pas un simple RdC. Appliquer la convention de nommage multi-produits (voir section "Relevés multi-produits").
4. Renommer selon les conventions ci-dessous
5. Convertir les images en PDF
6. Détecter et supprimer les doublons
7. Vérifier la cohérence (adresses croisées, classement P2 vs P5)

---

## Les 5 catégories

Chaque fichier est classé dans une catégorie **PX** selon sa nature :

| Cat. | Contenu | Exemples |
|------|---------|----------|
| **P1** | **Porteurs du projet uniquement** (personnes physiques ET morales signataires du mandat) | **Physiques** : CNI, passeport, titre de séjour, permis de conduire. **Familial des porteurs** : livret de famille, jugement de divorce, contrat de mariage, PACS, acte de naissance. **Morales (SCI, SARL, EURL, SAS, SASU…)** : KBIS, statuts, certificat INSEE, attestation bénéficiaires effectifs, PV de nomination, attestation non-condamnation |
| **P2** | Charges, patrimoine immobilier détenu **ET dossier complet des tiers** (hébergeur, garant, parent non-emprunteur) | Justificatif de domicile (EDF, Engie, eau, SFR, Orange, Free…), quittance de loyer, bail, attestation d'hébergement, **prêts en cours** (OdP / TA / CRD / Avenant), **crédits renouvelables**, pensions alimentaires, titres de propriété de biens détenus, taxes foncières, DPE des biens détenus, estimations locatives des biens détenus. **CNI, justificatif de domicile et attestation des tiers (hébergeur/garant) sont rangés ici, pas en P1** |
| **P3** | Revenus & fiscal | Bulletins de salaire, bilans comptables, déclarations URSSAF, attestations employeur, avis d'imposition (IRPP), plaquette comptes annuels / liasse fiscale du repreneur |
| **P4** | Comptes bancaires & toute l'épargne | Relevés de comptes (perso, joint, pro), épargne bancaire (Livret A, LDDS, LEP, PEL, CEL, PEA, compte-titres) **et épargne non bancaire** (assurance-vie type AXA/Generali, PER assurance, SCPI hors banque, crypto type Binance/Kraken, **piliers de prévoyance suisses : 1er pilier AVS, 2e pilier LPP, 3e pilier 3a/3b**). Toute l'épargne est consolidée en P4, peu importe l'émetteur. |
| **P5** | Projet (bien à acquérir) | Compromis de vente, avenants, devis travaux, audit énergétique, DPE du bien visé, estimations locatives du projet, plaquette / prévisionnel de la cible |

---

## Règle cardinale — Ordre des éléments dans le nom

L'ordre dépend de **l'objet du document** :

- **Document concernant une PERSONNE** (P1, P2, P3, P4) → **`Personne` PUIS `Type de pièce`**
- **Document concernant un BIEN IMMOBILIER** (P2 patrimoine, P5 projet) → **`RP/RL Ville Adresse` PUIS `Type de pièce`**

Cette règle évite toute ambiguïté et permet au banquier de repérer instantanément qui est concerné par quelle pièce.

---

## Identification des personnes dans les noms de fichiers

- **RÈGLE CARDINALE — TOUJOURS les prénoms** dans P1, P2, P3, P4. **Ne jamais utiliser "Mr" / "Mme"** dans les noms de fichiers, **même pour un couple marié/pacsé partageant le même nom de famille**. Les prénoms sont plus clairs, plus humains, et évitent toute ambiguïté.
- **Co-emprunteurs (couple marié, pacsé, concubins, mère/fille, non mariés…)** → utiliser les **prénoms** (ex: `Emilien`, `Vanessa`, `Marie-Rosine`, `Johanne`)
- **Document concernant les deux emprunteurs** → `Prénom1 & Prénom2` (ex: `P2 - Emilien & Vanessa - Bail OPAC 71.pdf`, `P3 - Emilien & Vanessa - IRPP 2025 sur 2024.pdf`)
- **Emprunteur seul** → utiliser le **prénom** (ex: `P3 - Paul - BS 2026 01.pdf`)
- **Tiers non-emprunteur (hébergeur, garant, parent)** → deux formats possibles :
  - **`Prénom NOM`** quand le tiers est identifié sans ambiguïté (ex: `Gaëlle LACHAMP`)
  - **`[Emprunteur] [Lien] [rôle]`** quand le tiers est désigné par son lien à l'emprunteur (ex: `Enola Maman hébergeur`, `Thomas Papa garant`). Ce format est recommandé pour les hébergeurs familiaux — il rend immédiatement visible le lien familial qui justifie le rôle.
- **Personne morale** (SCI, SARL, SAS, SASU, EURL, SCM…) → **`[Forme] [Nom]`** en casse normale (pas de MAJUSCULES intégrales) (ex: `SCI Ducourtioux`, `SARL Dupont`, `SASU Martin`).

**Récapitulatif rapide :**

| Situation | Convention | Exemple |
|-----------|-----------|---------|
| Couple marié, même nom | Prénoms (JAMAIS Mr/Mme) | `P3 - Emilien - BS 2026 01.pdf` / `P3 - Vanessa - BS 2026 01.pdf` |
| Document couple (les deux) | `Prénom1 & Prénom2` | `P3 - Emilien & Vanessa - IRPP 2025 sur 2024.pdf` |
| Co-emprunteurs, noms ≠ | Prénoms | `P3 - Johanne - BS 2026 01.pdf` |
| Emprunteur seul | Prénom | `P3 - Paul - BS 2026 01.pdf` |
| Tiers identifiable | Prénom NOM | `P2 - Gaëlle LACHAMP - Attestation hébergement.pdf` |
| Tiers lié à un emprunteur | `[Emprunteur] [Lien] [rôle]` | `P2 - Enola Maman hébergeur - Justificatif domicile.pdf` |
| Personne morale | `[Forme] [Nom]` (casse normale) | `P1 - SCI Ducourtioux - Statuts.pdf` |
| P4 (RdC, Ep) | Prénoms | `P4 - Paul - RdC LCL 2026 02 n° 4521.pdf` |

---

## Conventions de nommage — formats détaillés

### Format de base (P1, P2, P3, P4 — documents personnels)

```
PX - [Personne] - [Type pièce] [AAAA MM].pdf
```

**Règle cardinale :** **tiret espacé** ` - ` entre la personne et le type de pièce. Toujours. Exceptions : P2/P5 biens immobiliers (bien-first) et P5 Cible pro — ils ont leurs propres formats.

**Exemples :**
- `P3 - Vanessa - BS 2026 01.pdf` (couple marié — toujours les prénoms)
- `P3 - Emilien - BS 2026 01.pdf`
- `P3 - Emilien & Vanessa - IRPP 2025 sur 2024.pdf` (document concernant les deux)
- `P3 - Paul - URSSAF 2024.pdf`
- `P2 - Marie-Rosine - Justificatif domicile EDF 2026 02.pdf`
- `P2 - Johanne - Justificatif domicile Engie 2026 01.pdf`
- `P2 - Emilien - Pension alimentaire 2025.pdf`

---

### P1 — Pièces d'identité (porteurs du projet uniquement)

**Personne physique (porteurs uniquement)** :

```
P1 - [Personne] - [Type pièce] Date Valid (AAAA MM JJ).pdf
```

**Règles :**
- **Tiret espacé** ` - ` entre la personne et le type de pièce
- **Date de validité entre parenthèses** au format `AAAA MM JJ`
- Types : `CNI`, `Passeport`, `Titre de séjour`, `Permis de conduire`
- Jugement de divorce, contrat de mariage → format de base (pas de date de validité)
- **PACS — distinction obligatoire** :
  - `Convention de PACS` : acte signé par les deux partenaires (régime patrimonial : séparation de biens / indivision). Document de fond.
  - `Récépissé de PACS` : justificatif d'enregistrement délivré par la mairie ou le notaire (date d'effet + n° enregistrement). Justificatif officiel.
  - Format : `P1 - [Personne] - Convention de PACS AAAA MM JJ.pdf` (date de signature) / `P1 - [Personne] - Récépissé de PACS AAAA MM JJ.pdf` (date d'enregistrement).
  - Pour un couple pacsé partageant la même convention : utiliser les deux prénoms (`P1 - Thomas & Enola - Convention de PACS 2024 06 12.pdf`).

**Livret de famille — règle spécifique :**

```
P1 - [Prénom porteur] - Livret de famille[ N].pdf
```

- **Toujours rattaché à UN porteur de projet** (jamais les deux prénoms), car un livret n'appartient qu'à un seul des deux parents de la fratrie qui y figure.
- **Si un porteur a plusieurs livrets** (enfants avec conjoints différents) : identifier dans chaque livret celui où le porteur apparaît comme parent, puis numéroter `Livret de famille`, `Livret de famille 2`, `Livret de famille 3`…
- **Si couple de porteurs** chacun avec son propre livret : un fichier par porteur (`P1 - Edouard - Livret de famille.pdf` + `P1 - Marie - Livret de famille.pdf`).
- **Vérifier systématiquement le contenu** du livret pour attribuer au bon porteur (nom + prénom du parent correspondant au porteur doivent figurer dans le livret).

**Exemples :**
- `P1 - Enola - CNI Date Valid (2035 08 20).pdf`
- `P1 - Thomas - CNI Date Valid (2034 01 27).pdf`
- `P1 - Marie - Passeport Date Valid (2028 11 05).pdf`
- `P1 - Edouard - Livret de famille.pdf`
- `P1 - Edouard - Livret de famille 2.pdf` (2e union)
- `P1 - Marie - Livret de famille.pdf`
- `P1 - Edouard - Jugement de divorce 2022.pdf`
- `P1 - Thomas & Enola - Convention de PACS 2024 06 12.pdf`
- `P1 - Thomas & Enola - Récépissé de PACS 2024 06 18.pdf`

**Personne morale (SCI, SARL, SAS, SASU, EURL, SCM…)** :

```
P1 - [Forme Nom] - [Type pièce] Date Document (AAAA MM JJ).pdf
```

**Règles :**
- **Nom société en casse normale** : `SCI Ducourtioux`, pas `SCI DUCOURTIOUX`
- **Date du document entre parenthèses** au format `AAAA MM JJ` (c'est la **date d'émission** du document, pas une date de validité)
- Pour les documents **sans date** (comme les statuts à jour non versionnés), omettre la mention date
- Types : `KBIS`, `Statuts`, `Certificat INSEE`, `Attestation bénéficiaires effectifs`, `PV nomination gérant`, `Attestation non-condamnation`

**Exemples :**
- `P1 - SCI Ducourtioux - KBIS Date Document (2026 03 15).pdf`
- `P1 - SCI Ducourtioux - Statuts.pdf`
- `P1 - SCI Ducourtioux - Certificat INSEE Date Document (2026 01 20).pdf`
- `P1 - SCI Ducourtioux - Attestation bénéficiaires effectifs Date Document (2026 02 10).pdf`
- `P1 - SARL Dupont - PV nomination gérant Date Document (2025 11 05).pdf`

**P1 ne contient QUE les porteurs du projet.** Les pièces d'identité des tiers (hébergeur, garant, parent non-emprunteur) sont rangées en **P2** avec le reste de leur dossier (attestation d'hébergement, justificatif de domicile). Cette règle permet de garder P1 net et rigoureux : ouvrir la pochette P1 = voir les emprunteurs signataires, rien d'autre.

---

### P2 — Prêts en cours

Tous les prêts en cours (immobilier, consommation, regroupement, relais, professionnel, étudiant…) suivent un format unifié qui rend visible à l'œil le type de prêt, la banque, le numéro, le document et le montant.

```
P2 - [Personne] - Prêt [Type] [Banque] n° [numéro] - [Doc] - [Montant] €.pdf
```

**Règles :**
- **Type de prêt** : `Immo`, `Conso`, `Regroupement`, `Relais`, `Pro`, `Étudiant`
- **Banque** en majuscules abrégées avec caisse régionale pour CA/CE/BP/CM (voir section RdC)
- **Préfixe `n° ` obligatoire** devant le numéro de prêt
- **Type de document** : `OdP` (Offre de Prêt), `TA` (Tableau d'Amortissement), `CRD` (Capital Restant Dû), `Avenant`
- **Montant** : mensualité pour une OdP / TA, capital restant pour un CRD. Toujours en `€` (espaces pour les milliers). Pour un **Avenant**, pas de montant.

**Exemples :**
- `P2 - Thomas - Prêt Conso CEBFC n° 9002 - OdP - 308 €.pdf`
- `P2 - Thomas - Prêt Conso CEBFC n° 9002 - TA - 308 €.pdf`
- `P2 - Thomas - Prêt Conso CEBFC n° 9002 - CRD - 20 507 €.pdf`
- `P2 - Thomas - Prêt Conso CEBFC n° 9002 - Avenant.pdf`
- `P2 - Paul - Prêt Immo CAFC n° 2208674 - TA - 1 270 €.pdf`
- `P2 - Marie - Prêt Étudiant SG n° 4567 - TA - 120 €.pdf`
- `P2 - Paul & Marie - Prêt Regroupement CIC n° 8801 - OdP - 890 €.pdf`

---

### P2 — Crédit renouvelable

Les relevés de crédits renouvelables (type Izicarte BPCE, Cofidis, Cetelem, Oney…) ont leur propre format. Ce ne sont pas des prêts amortissables mais des réserves d'argent qui se rechargent.

```
P2 - [Personne] - Relevé crédit renouvelable [Produit] [Banque] n° [numéro] AAAA MM - [Solde] €.pdf
```

**Règles :**
- **Produit** : nom commercial du crédit renouvelable (Izicarte, Cofinoga, Aurore, Pass Carrefour…)
- **Banque** : émetteur (BPCE, Cofidis, Cetelem, Oney, Carrefour Banque…)
- **AAAA MM** : mois du relevé
- **Solde** : montant dû au jour du relevé (pas le plafond de la réserve) en `€`

**Exemples :**
- `P2 - Thomas - Relevé crédit renouvelable Izicarte BPCE n° 1100 2025 11 - 150 €.pdf`
- `P2 - Paul - Relevé crédit renouvelable Cofinoga COFIDIS n° 7754 2026 01 - 2 340 €.pdf`

---

### P4 — Relevés de comptes bancaires (RdC)

Tous les relevés de comptes (joints ou individuels) suivent ce format :

```
P4 - [Prénom1] [& Prénom2 si joint] - RdC [BANQUE] [AAAA] [MM] n° [4 derniers chiffres].pdf
```

**Règles :**
- **Toujours les prénoms**, jamais Mr/Mme (même pour les couples mariés)
- **Compte joint** : `Prénom1 & Prénom2` (ex : `Sébastien & Sandra`)
- **Compte individuel** : un seul prénom
- **Préfixe `n° ` obligatoire** devant les 4 derniers chiffres du compte (ex: `n° 3354`, jamais `3354` seul). S'applique aussi aux numéros d'épargne et de contrats.
- **Banque en majuscules abrégées** : LCL, BNP, SG, LBP (La Banque Postale), CIC, BOURSO, FORTUNEO, HELLO, MONABANQ, REVOLUT, N26…
- **Banques à caisses régionales — règle obligatoire** : pour le **Crédit Agricole (CA)**, la **Caisse d'Épargne (CE)** et la **Banque Populaire (BP)**, le sigle doit **toujours** inclure les initiales de la caisse régionale, lues directement sur le relevé (en-tête ou pied de page). **Jamais `CA`, `CE` ou `BP` seuls.**
  - Crédit Agricole Franche-Comté → `CAFC`
  - Crédit Agricole Centre-Est → `CACE`
  - Crédit Agricole Île-de-France → `CAIDF`
  - Caisse d'Épargne Rhône-Alpes → `CERA`
  - Caisse d'Épargne Bourgogne Franche-Comté → `CEBFC`
  - Caisse d'Épargne Île-de-France → `CEIDF`
  - Caisse d'Épargne Hauts-de-France → `CEHDF`
  - Banque Populaire Auvergne Rhône-Alpes → `BPAURA`
  - Banque Populaire Bourgogne Franche-Comté → `BPBFC`
  - Banque Populaire Rives de Paris → `BPRIVES` ou `BPRDP`
  - Banque Populaire du Sud → `BPS`
  - Crédit Mutuel : même logique si plusieurs fédérations (`CMCEE` pour Crédit Mutuel Centre-Est Europe, `CMO` pour Crédit Mutuel Océan…)
- **4 derniers chiffres** du numéro de compte (pas le numéro complet) — distingue plusieurs comptes même banque sans exposer le numéro entier
- **Plage multi-mois** : `2026 01-02`
- **Compte pro** : ajouter "Pro" après le prénom (ex: `P4 - Sébastien Pro RdC BNP …`)

**Exemples :**
- `P4 - Sébastien & Sandra - RdC LCL 2026 02 n° 4521.pdf` (compte joint)
- `P4 - Sébastien - RdC CAFC 2026 02 n° 8734.pdf` (compte individuel)
- `P4 - Sandra - RdC LBP 2026 01-02 n° 1290.pdf` (plage 2 mois)
- `P4 - Sébastien Pro - RdC BNP 2026 02 n° 6678.pdf` (compte pro)

---

### P4 — Relevés multi-produits (RdC + Épargne sur le même PDF)

Certaines banques (notamment **La Banque Postale**, **Crédit Mutuel**) éditent des relevés consolidés contenant le compte courant ET un ou plusieurs livrets/épargne sur un seul PDF. Pour ces cas, on utilise le préfixe `RdC+Ep` au lieu de `RdC`, et on liste explicitement les produits additionnels.

```
P4 - [Prénom1] [& Prénom2] - RdC+Ep [BANQUE] [AAAA] [MM] n° [CCP] + [Type Ep] n° [chiffres] [- Solde €].pdf
```

**Règles :**
- **Préfixe `RdC+Ep`** annonce immédiatement le caractère multi-produits du PDF
- **Lister chaque produit d'épargne** présent sur le relevé avec son type (Livret A, Livret Bleu, LDDS, LEP, PEL, CEL…) et son `n° XXXX` (4 derniers chiffres)
- **Solde uniquement sur le relevé du dernier mois disponible** — sur les autres mois, ne pas mettre le solde (sinon trois soldes contradictoires sur trois mois). Le solde "à date" est celui qui intéresse le banquier.
- Pour plusieurs produits d'épargne sur le même relevé : enchaîner avec `+ Type n° XXXX`

**Exemples :**
- `P4 - Virginie RdC+Ep LBP 2026 01 n° 3354 + - Livret A n° 0339.pdf`
- `P4 - Virginie RdC+Ep LBP 2026 03 n° 3354 + - Livret A n° 0339 - 17 600 €.pdf` (solde sur le dernier mois)
- `P4 - Enola RdC+Ep CM 2026 03 n° 7702 + - Livret Bleu n° 7705 - 12 €.pdf`
- `P4 - Sébastien RdC+Ep LBP 2026 03 n° 4521 + - Livret A n° 0339 + LDDS n° 5512 - 25 800 €.pdf` (solde global)

---

### P4 — Épargne (toute l'épargne en P4, bancaire ou non)

**Toute l'épargne** est consolidée en **P4**, peu importe l'émetteur (banque, assureur, plateforme crypto, caisse de prévoyance suisse…). Pour le banquier qui ouvre P4, voir **toute la photo du patrimoine financier liquide en un seul endroit** est plus efficace, et P2 reste cantonné aux charges et au patrimoine immobilier.

L'épargne suit la **même logique** que les RdC : prénoms, émetteur en majuscules abrégées, 4 derniers chiffres du compte/contrat, solde constaté.

```
P4 - [Prénom1] [& Prénom2] - Ep [Type] [ÉMETTEUR] n° [4chiffres] - [Solde] €.pdf
```

**Note de lisibilité** : un tiret `-` sépare le numéro de contrat du solde pour éviter toute confusion entre les chiffres du contrat et ceux du montant. Le préfixe `n° ` devant les 4 chiffres est obligatoire.

**Règles :**
- **Toujours les prénoms** (jamais Mr/Mme), `Prénom1 & Prénom2` si compte joint
- **Émetteur en majuscules abrégées** : LCL, BNP, CAFC, LBP, AXA, GENERALI, SWISSLIFE, BINANCE, KRAKEN, CORUM…
- **Préfixe `n° ` obligatoire** devant les 4 derniers chiffres du compte / contrat
- **Solde** en fin de nom : `X XXX €` (espaces pour les milliers)
- **Toujours P4**, que l'émetteur soit une banque ou non

**Exemples — épargne bancaire :**
- `P4 - Sébastien - Ep Livret A LCL n° 4521 - 24 771 €.pdf`
- `P4 - Sandra - Ep LDDS CAFC n° 8734 - 8 500 €.pdf`
- `P4 - Sébastien & Sandra - Ep PEL LBP n° 1290 - 15 000 €.pdf`
- `P4 - Sébastien - Ep PEA BNP n° 6678 - 42 300 €.pdf`

**Exemples — épargne non bancaire (assureur, crypto, SCPI, prévoyance suisse) :**
- `P4 - Sébastien - Ep AV AXA n° 9821 - 45 200 €.pdf`
- `P4 - Sandra - Ep AV GENERALI n° 3304 - 18 750 €.pdf`
- `P4 - Sébastien - Ep PER SWISSLIFE n° 7712 - 22 000 €.pdf`
- `P4 - Sandra - Ep Crypto BINANCE n° 5544 - 12 300 €.pdf`
- `P4 - Sébastien - Ep SCPI CORUM n° 8891 - 35 000 €.pdf`
- `P4 - Paulo - Ep 2e pilier AXA n° 4685 - 95 461 CHF.pdf` (LPP suisse)
- `P4 - Paulo - Ep 3e pilier 3a SWISSLIFE n° 7712 - 22 000 €.pdf` (3e pilier suisse)

---

### P3 — Règle IRPP — Année de l'avis **ET** année des revenus (les deux obligatoires)

Un avis d'imposition IRPP porte **deux dates** importantes qu'il faut absolument distinguer dans le nom de fichier :

1. **L'année de l'avis** = l'année d'**établissement** de l'avis par l'administration fiscale (celle qui figure sur la couverture, en haut : ex. "Avis d'impôt 2025"). C'est l'année la plus récente des deux.
2. **L'année des revenus** = l'année à laquelle se rapportent les revenus déclarés (ex. "Impôt sur les revenus de 2024" dans le corps de l'avis). C'est l'année `N-1` par rapport à l'année de l'avis.

**Pourquoi les deux ?** Parce que le banquier ne veut pas se poser la question "OK cet IRPP 2025, il porte sur quels revenus ?". Le format qui indique explicitement les deux années évite toute ambiguïté et permet de tracer immédiatement la cohérence entre les bulletins de salaire / revenus BNC / URSSAF de l'année N-1 et l'avis fiscal correspondant.

**Format :**

```
P3 - [Personne] - IRPP [AAAA avis] sur [AAAA revenus].pdf
```

**Exemples :**

- Avis établi le 22/07/2024 sur les revenus perçus en 2023 → `P3 - Marie-Rosine IRPP 2024 sur 2023.pdf`
- Avis établi le 22/07/2025 sur les revenus perçus en 2024 → `P3 - Marie-Rosine IRPP 2025 sur 2024.pdf`
- Couple avec avis commun → `P3 - Emilien & Vanessa IRPP 2025 sur 2024.pdf`

**Comment identifier chaque année dans le document ?**

- **Année de l'avis** : en haut à droite de la couverture, généralement libellée "Avis d'impôt" ou "Avis d'imposition" suivi d'un millésime, et dans le cartouche de date d'émission (ex. `22/07/2025`).
- **Année des revenus** : dans le corps du document, phrase type "Impôt sur les revenus de 2024" ou "Cet avis fait suite à la déclaration, en 2025, de vos revenus 2024". C'est toujours l'année **précédente** de celle de l'avis.

**Cas rares** : pour un avis rectificatif ou un dégrèvement, l'année des revenus peut être N-2 ou plus ancienne. Dans ce cas, indiquer bien la bonne année des revenus concernés, même si elle n'est pas N-1.

---

### P2 — Justificatifs de domicile — Garder le nom de l'émetteur

Les justificatifs de domicile sont classés en **P2** (avec les charges et le patrimoine). Ils incluent le **nom de l'émetteur** dans le nom de fichier pour distinguer les types de justificatifs :

```
P2 - [Personne] - Justificatif domicile [Émetteur] AAAA MM.pdf
```

Émetteurs courants : EDF, Engie, Veolia, Suez, GRDF, SFR, Orange, Free, Bouygues, assurance habitation…

**Exemples :**
- `P2 - Marie-Rosine - Justificatif domicile EDF 2026 02.pdf`
- `P2 - Johanne - Justificatif domicile Engie 2026 01.pdf`
- `P2 - Enola Maman hébergeur - Justificatif domicile.pdf`
- `P2 - Paul - Quittance loyer 2026 03.pdf`

**Cohérence des adresses** : l'adresse qui figure sur le justificatif de domicile (P2) doit correspondre à celle du bien P2 marqué `RP`. Toute incohérence doit être signalée et résolue avant envoi en banque.

---

### P2 & P5 — Biens immobiliers (bien-first)

Les fichiers liés à un bien immobilier (détenu ou à acquérir) conservent l'ordre **bien en premier**, car l'info structurante est le bien lui-même, pas une personne. **Règle de nommage différente entre P2 et P5.**

---

**P2 — Patrimoine existant (adresse conservée)**

```
P2 - [RP/RL] [Prénom] [Ville] [Adresse abrégée] [lots X-Y] - [Type document].pdf
```

- **RP/RL** : résidence principale (RP) ou résidence locative (RL).
- **Prénom** : à qui appartient le bien (utile quand les emprunteurs vivent séparément). Toujours en prénom (jamais Mr/Mme). Peut être omis pour les RL si le propriétaire est évident.
- **Ville** : commune du bien. Indispensable car un client peut avoir plusieurs biens.
- **Adresse abrégée** : numéro + rue abrégée (ex: 119C Montagny, 32 Jules Verne).
- **lots X-Y** : numéros de lots en copropriété. Omettre si non applicable.
- **Type document** : nature de la pièce (Titre propriété, TA, DPE, Esti, Relevé gestion, Quittance loyer, Taxe foncière…)

**Exemples P2 :**
- `P2 - RP Lyon 119C Montagny - Titre propriété.pdf`
- `P2 - RP Lyon 119C Montagny - Prêt Immo CA n° 2208674 - TA - 1 270 €.pdf`
- `P2 - RP Lyon 119C Montagny - Taxe foncière 2025.pdf`
- `P2 - RL Lyon Antonin Poncet - Relevé gestion 2025 10-11.pdf`
- `P2 - RL Lyon Antonin Poncet - Esti Métropole Immo 850 €.pdf`
- `P2 - RL Villejuif 32 Jules Verne - Titre propriété.pdf`
- `P2 - RL Villejuif 32 Jules Verne - DPE 2020.pdf`

---

### P2 — Patrimoine professionnel (sociétés du groupe)

**Toutes les sociétés détenues par les porteurs autres que la société porteuse du projet** (qui elle est en P1) sont classées en P2 : SCI patrimoniale, SARL/EURL opérationnelle, holding, SAS du groupe, autre SCI familiale, etc.

```
P2 - [Forme Nom] - [Type pièce] AAAA[ MM].pdf
```

**Règles :**

- **Casse normale** : `SCI Ducourtioux Familia`, pas `SCI DUCOURTIOUX FAMILIA`.
- **Date** : année (et mois si pertinent) du document au format `AAAA` ou `AAAA MM`. Pour les documents comptables, année de l'exercice clos.
- **Types de pièces** : KBIS, Statuts, Plaquette comptes annuels, Liasse fiscale, Attestation dividendes, Relevé compte courant associé, PV AG, Tableau de répartition du capital, Bilan prévisionnel, Attestation non-condamnation…

**Exemples :**

- `P2 - SCI Ducourtioux Familia - KBIS 2026 03.pdf`
- `P2 - SCI Ducourtioux Familia - Statuts 2023 06.pdf`
- `P2 - SCI Ducourtioux Familia - Plaquette comptes annuels 2024.pdf`
- `P2 - SCI Ducourtioux Familia - Liasse fiscale 2024.pdf`
- `P2 - SARL Thomas Conseil - KBIS 2026 03.pdf`
- `P2 - SARL Thomas Conseil - Plaquette comptes annuels 2024.pdf`
- `P2 - SARL Thomas Conseil - Relevé compte courant associé 2025 12.pdf`
- `P2 - Holding Ducourtioux - Tableau de répartition du capital 2025.pdf`

**Distinction P1 / P2 / P3 / P5 pour les sociétés :**

| Catégorie | Rôle de la société |
|---|---|
| **P1** | Société **porteuse du projet**, signataire du mandat (SCI de projet, SARL de création/reprise). |
| **P2** | **Patrimoine pro** : toute autre société détenue par les porteurs en périphérie du projet (SCI déjà en place, société opérationnelle tierce, holding). |
| **P3** | Documents comptables du **repreneur** servant à analyser ses **revenus** (dividendes, rémunération gérant). |
| **P5** | Société **cible à racheter** (dans une reprise d'entreprise ou de fonds de commerce). |

---

**P5 — Projet (adresse SUPPRIMÉE, seul le type RP/RL reste)**

```
P5 - [RP | RL | RL 1 | RL 2 | …] - [Type document] [date/info].pdf
```

- **Pas d'adresse, pas de ville, pas de lots** dans le nom du fichier P5 : le projet est par définition **unique** (ou exceptionnellement multi-biens).
- **Mono-bien** : simplement `RP` ou `RL`.
- **Multi-biens** (≥ 2 biens acquis dans le même projet) : numéroter → `RP 1`, `RP 2`, `RL 1`, `RL 2`…
- **Type document** : Offre achat, Compromis, Promesse vente, Avenant compromis/promesse, Titre propriété, DPE, Audit énergétique, Devis travaux, Esti, Règlement copropriété, État daté, PV AG…
- **Date** de signature obligatoire pour actes contractuels (Offre achat, Compromis, Promesse vente, Avenant) au format `AAAA MM JJ`.
- **Devis travaux (P5 uniquement)** : format spécifique
  ```
  P5 - RP - [Entreprise] - Devis [nature travaux] [TTC avec virgule] € TTC + [HT avec virgule] € HT.pdf
  ```
  - `[Entreprise]` : nom court de l'entreprise (SP Habitat, Biret PCV, Laurent Carrelage, Pagot-Savoie, Création Parquets…). **Pas de mention RGE** dans le nom du fichier (l'info RGE figure dans le récap xlsx).
  - `[nature travaux]` : catégorie courte (menuiseries, CVC, PAC, matériaux, pose carrelage, plomberie, VMC, électricité, placo, assainissement, peinture…).
  - **Montants au format français avec virgule décimale et espace milliers** : `35 800,00` (pas `35800.00` ni `35 800`). Toujours 2 décimales.
  - **TTC en premier**, puis HT, séparés par ` + `.
  - Exemples :
    - `P5 - RP - SP Habitat - Devis menuiseries 35 800,00 € TTC + 33 933,65 € HT.pdf`
    - `P5 - RP - Biret PCV - Devis CVC 33 102,74 € TTC + 31 377,00 € HT.pdf`
    - `P5 - RP - Pagot-Savoie - Devis matériaux 9 338,00 € TTC + 7 781,67 € HT.pdf`

**Exemples P5 :**
- `P5 - RP - Compromis contresigné 2026 03 14.pdf`
- `P5 - RP - Avenant promesse vente 2026 03 05.pdf`
- `P5 - RP - DPE 2025.pdf`
- `P5 - RP - Rénov Plus - Devis menuiseries 28 000,00 € TTC + 23 333,33 € HT.pdf`
- `P5 - RP - Audit énergétique.pdf`
- `P5 - RL 1 - Compromis notarié 2026 02 18.pdf` (2 parties signatures notaire) (1er bien locatif d'un projet mixte)
- `P5 - RL 2 - Compromis notarié 2026 02 18.pdf` (2e bien locatif)
- `P5 - RL - Esti Marc Immo 1 500 €.pdf` (mono-bien locatif)

**Récapitulatif devis travaux (P5) — génération automatique d'un xlsx :**

Dès qu'un projet comporte **≥ 2 devis travaux** en P5, générer un fichier Excel récapitulatif :

```
P5 - RP - Récapitulatif devis travaux.xlsx
```
(ou `P5 - RL - Récapitulatif devis travaux.xlsx`, `P5 - RL 1 - …` en multi-biens)

**Structure obligatoire (feuille "Devis Travaux") :**

1. **Titre** : `RÉCAPITULATIF DES DEVIS TRAVAUX`
2. **Sous-titre** : `Dossier [NOM1] [Prénom1] & [NOM2] [Prénom2] — [Type] [Adresse complète]`
3. **Tableau** avec colonnes : `n° ` | `Entreprise` | `Description travaux` | `Date devis` | `Montant HT` | `TVA` | `Montant TTC` | `RGE` | `Signé`
4. **Ligne TOTAL TRAVAUX** : somme HT + somme TTC
5. **Bloc ANALYSE** :
   - Total TTC devis RGE (éligible éco-PTZ)
   - Total TTC devis non-RGE
   - Nombre de devis
   - Devis le + élevé / Devis le + faible
6. **Bloc NOTES** : commentaires libres (statut RGE, régime TVA, devis périmé remplacé, etc.)

**Règles :**
- Dates au format `JJ/MM/AAAA` dans la colonne Date devis.
- TVA affichée telle quelle : `5,5%`, `20%`, `10%`, `Exo.` (auto-entrepreneur art. 293B CGI).
- RGE : `OUI` / `Non` / `?` (à vérifier).
- Signé : `Oui` / `Non`.
- Montants arrondis au centime.
- **Format numérique français obligatoire** pour les colonnes `Montant HT` et `Montant TTC` (et bloc ANALYSE) : format Excel `# ##0,00` → virgule décimale, espace milliers (ex : `100 733,28`). Pas de point décimal.

---

### Format spécifique — Documents comptables PRO (plaquette comptes annuels, prévisionnel, liasse fiscale)

Pour les dossiers PRO (création/reprise d'entreprise, fonds de commerce, SARL/EURL/SASU…), il faut distinguer **trois types de documents comptables** qui n'ont pas du tout la même valeur pour le banquier :

| Type | Définition | Nature |
|------|-----------|--------|
| **Plaquette comptes annuels** | Comptes **réels et clos** d'un exercice passé édités par l'expert-comptable (bilan, compte de résultat, annexes, SIG, CAF, immobilisations). Présentation synthétique destinée au lecteur. | Backward-looking — santé réelle |
| **Liasse fiscale** | Formulaires Cerfa **2050-2059** (réel normal) ou **2033** (réel simplifié) déposés à l'administration fiscale. Données brutes. | Backward-looking — détail fiscal |
| **Prévisionnel** | **Projections futures** établies pour le projet (compte de résultat prévisionnel, plan de trésorerie, plan de financement) sur une période 3-5 ans. | Forward-looking — crédibilité projet |

**Convention de nommage :**

```
P5 - [Cible] - Plaquette comptes annuels AAAA.pdf
P5 - [Cible] - Liasse fiscale AAAA.pdf
P5 - [Cible] - Prévisionnel AAAA-AAAA.pdf
```

**Règles** :

- **AAAA** = année de l'exercice **clos** (ex. `2024` pour l'exercice clos le 31/12/2024). Toujours sur 4 chiffres, jamais `AAAA MM`.
- **Prévisionnel** = indiquer la **plage couverte** par les projections (ex. `2026-2029` pour 3 exercices prévisionnels), pas un mois unique.
- **Cible** = nom court du bien à acquérir (ex. `Cocagne` pour le restaurant Cocagne, `Boulangerie Dupont`…). Pour un dossier de **création** sans cible existante, omettre et nommer `P5 - Plaquette comptes annuels...`.
- **Pas de mention "client" / "interne"** dans le nom : que la plaquette ait été remise au client ou conservée en interne par l'expert-comptable, pour le banquier c'est la même chose — ce sont les comptes annuels certifiés.
- **Ne pas confondre** "Plaquette prévisionnelle" et "Prévisionnel" : si le PDF contient bilan + compte de résultat + annexe + SIG d'un exercice **clos**, c'est une **plaquette comptes annuels**, pas un prévisionnel — même si l'arborescence ou le cabinet l'a appelé "plaquette prévi".

**Distinction P3 vs P5 pour les documents comptables :**

- **P3** = comptes annuels / liasse fiscale **du repreneur lui-même** (sa propre société existante, qui sert à analyser son revenu et sa surface financière). Ex. : `P3 - SCI Dupont Plaquette comptes annuels 2024.pdf`.
- **P5** = comptes annuels / liasse fiscale / prévisionnel **de la cible** (le fonds de commerce ou la société rachetée, analysés pour évaluer le bien). Ex. : `P5 - Cocagne - Plaquette comptes annuels 2024.pdf`.

**Exemples (dossier reprise fonds de commerce restaurant Cocagne) :**

- `P5 - Cocagne - Plaquette comptes annuels 2024.pdf`
- `P5 - Cocagne - Plaquette comptes annuels 2025.pdf`
- `P5 - Cocagne - Liasse fiscale 2024.pdf`
- `P5 - Cocagne - Prévisionnel 2026-2029.pdf`

**Trilogie idéale attendue par le banquier sur une reprise** : 2 derniers exercices clos (N-1 et N pour l'analyse rétrospective) + 1 prévisionnel 3 exercices (pour l'analyse prospective).

---

### Format spécifique — Offres d'achat, LOI, promesses & compromis (statut de signature + date obligatoires)

Pour les **offres d'achat**, **LOI (Lettre d'Intention d'achat pour financement pro)**, **compromis de vente**, **promesses de vente** et leurs **avenants**, le **statut de signature** et la **date** sont des informations critiques (conditions d'engagement, délais SRU, levée de conditions suspensives, péremption…). Les deux DOIVENT figurer dans le nom du fichier.

**Convention :**

```
P5 - [Cible] - Offre achat [statut] AAAA MM JJ.pdf
P5 - [Cible] - LOI [statut] AAAA MM JJ.pdf
P5 - [Cible] - Compromis [statut] AAAA MM JJ.pdf
P5 - [Cible] - Promesse vente [statut] AAAA MM JJ.pdf
P5 - [Cible] - Avenant compromis AAAA MM JJ.pdf
P5 - [Cible] - Avenant promesse vente AAAA MM JJ.pdf
P5 - [Cible] - Cession parts sociales [statut] AAAA MM JJ.pdf
```

**Statuts de signature (nomenclature stricte) :**

| Statut | Signification |
|---|---|
| `non signée` | Aucune signature sur le doc (brouillon, projet) |
| `signée porteur` | **Seul le porteur de projet** (acheteur) a signé. Ex. offre envoyée au vendeur, en attente de sa réponse. |
| `contresignée` | **Porteur ET vendeur** ont tous les deux signé. L'acte est engagé bilatéralement. |
| `notariée` | Acte authentique signé devant notaire (compromis/promesse notarié). |
| `paraphée` | Paraphes présents sur toutes les pages mais pas encore de signature finale. |

**Règle critique — vérification des signatures :** vérifier dans le PDF la **dernière page** (bloc signatures). Un document avec UNIQUEMENT la signature du porteur = `signée porteur`, pas `signée` tout court. Un document avec les DEUX signatures (porteur + vendeur) = `contresignée`.

**Accords genre :** offre/LOI/promesse = féminin (`signée porteur`, `contresignée`, `notariée`). Compromis = masculin (`signé porteur`, `contresigné`, `notarié`).

**Règles date :**

- **Date de signature** = la date à laquelle le **dernier signataire** a signé. Sur un doc `contresigné`, c'est la date du vendeur (postérieure à celle du porteur). Sur un doc `signé porteur`, c'est la date du porteur. Si plusieurs dates apparaissent, prendre la plus récente.
- **Format `AAAA MM JJ`** sur 4-2-2 chiffres avec espaces (ex. `2026 03 14`). Jamais de tirets, jamais de format US, jamais de mois en lettres.
- **Pas la date du jour** où tu reçois le doc — c'est la date imprimée **dans** le doc (date des signatures manuscrites en dernière page).
- **Avenants** : toujours dater l'avenant lui-même, jamais le compromis/promesse initial.

**Cible :**

- Projet PRO (fonds de commerce, reprise société) : nom court du bien (ex. `Cocagne`).
- Projet immobilier classique (RP/RL) : **pas d'adresse** → uniquement `RP`, `RL`, `RP 1`, `RL 2`, etc.

**LOI (Lettre d'Intention d'achat) — spécifique pro :**

- Document préalable à l'offre formelle, utilisé en **financement pro** (reprise d'entreprise, fonds de commerce, rachat de titres).
- Mêmes statuts que l'offre d'achat : `non signée`, `signée porteur`, `contresignée`.
- Toujours classé en P5 avec la cible pro.

**Cession de parts sociales — spécifique pro :**

- Acte de rachat de titres (parts SARL, actions SAS) dans une opération de reprise d'entreprise.
- Mêmes statuts : `non signée`, `signée porteur`, `contresignée`, `notariée` (quand acte authentique), `enregistrée` (quand enregistré aux impôts).
- `enregistrée` = l'acte a été enregistré au Service de l'Enregistrement (droits de mutation payés).
- Toujours classé en P5 avec la cible pro.

**Exemples :**

- `P5 - Cocagne - LOI signée porteur 2026 02 05.pdf` (LOI envoyée au cédant)
- `P5 - Cocagne - LOI contresignée 2026 02 10.pdf` (cédant a accepté)
- `P5 - Cocagne - Offre achat fonds contresignée 2026 02 18.pdf`
- `P5 - Cocagne - Compromis fonds notarié 2026 03 14.pdf`
- `P5 - Cocagne - Cession parts sociales contresignée 2026 04 10.pdf`
- `P5 - Cocagne - Cession parts sociales enregistrée 2026 04 22.pdf`
- `P5 - RP - Offre achat signée porteur 2026 02 15.pdf`
- `P5 - RP - Offre achat contresignée 2026 02 18.pdf`
- `P5 - RP - Compromis contresigné 2026 03 14.pdf`
- `P5 - RP - Promesse vente notariée 2026 01 27.pdf`
- `P5 - RP - Avenant compromis 2026 04 02.pdf`
- `P5 - RP - Avenant promesse vente 2026 03 05.pdf`

---

## Règles transverses

### Devises

- **`€`** par défaut pour l'euro — **jamais `EUR`** dans les noms de fichiers
- **`CHF`** pour le franc suisse (dossiers frontaliers, piliers de prévoyance)
- **Code ISO 3 lettres** pour toute autre devise étrangère : `USD`, `GBP`, `CAD`, `JPY`…
- Espaces comme séparateurs de milliers : `24 771 €`, `95 461 CHF`

### Accents — conservés

Les accents sont **systématiquement conservés** dans les noms de fichiers. Les noms sans accents (legacy) doivent être corrigés à chaque passage.

Mots-clés concernés : `Prêt`, `Relevé`, `Récapitulatif`, `Création`, `Hébergeur`, `Hébergement`, `Énergétique`, `Propriété`, `Notarié`, `Signée`, `Contresignée`, `Paraphée`, `Métropole`, `Taxe foncière`, `Prévisionnel`, `Sébastien`, `Gaëlle`…

### Caractères interdits (Windows / OneDrive / SharePoint)

Les caractères suivants sont **interdits** dans les noms de fichiers : `< > : " / \ | ? *`

Les caractères **autorisés** utiles : `( )`, `&`, `+`, `-`, `°`, `€`, apostrophe droite `'`.

---

## Regroupement par bien

Les pièces du patrimoine sont **regroupées par bien**, pas par type de document. Un même bien peut avoir son titre de propriété, son TA, son DPE, sa taxe foncière, son estimation locative — tous ces fichiers partagent le même préfixe `P2 - [RP/RL] [Ville] [Adresse]` et se retrouvent naturellement côte à côte dans l'explorateur.

Les relevés de comptes (RdC) et **toute l'épargne** (bancaire ET non bancaire — Livret A, LDDS, PEL, AV AXA, crypto, SCPI, piliers suisses…) sont en **P4** sans préfixe RP/RL, car ils sont liés à la personne, pas à un bien. P2 ne contient plus aucune épargne — uniquement les charges et le patrimoine immobilier détenu.

---

## Abréviations standard

| Abréviation | Signification |
|-------------|---------------|
| **BS** | Bulletin de Salaire. Format : `P3 - [Personne] - BS AAAA MM.pdf`. Toujours abrégé en `BS`, jamais `Bulletin` ni `Bulletin de salaire` dans les noms de fichiers. |
| **CNI** | Carte Nationale d'Identité. Format P1 : `P1 - [Personne] - CNI Date Valid (AAAA MM JJ).pdf`. Tiret espacé avant le type, date de validité entre parenthèses. |
| **OdP** | Offre de Prêt. Format : `P2 - [Personne] - Prêt [Type] [Banque] n° [numéro] - OdP - [Mensualité] €.pdf`. |
| **TA** | Tableau d'Amortissement. Format : `P2 - [Personne] - Prêt [Type] [Banque] n° [numéro] - TA - [Mensualité] €.pdf`. |
| **CRD** | Capital Restant Dû. Format : `P2 - [Personne] - Prêt [Type] [Banque] n° [numéro] - CRD - [Capital restant] €.pdf`. |
| **RdC** | Relevé de compte bancaire. Format complet : `P4 - [Prénom1] [& Prénom2] - RdC BANQUE AAAA MM n° 4chiffres.pdf`. Toujours en prénoms (jamais Mr/Mme), banque en majuscules abrégées (LCL, BNP, LBP…). **Pour CA / CE / BP / CM** : obligation d'ajouter les initiales de la caisse régionale (CAFC, CERA, BPAURA, CMCEE…) — jamais le sigle seul. **Préfixe `n° ` obligatoire** devant les 4 derniers chiffres du compte. Ajouter "Pro" après le prénom pour un compte professionnel. |
| **RdC+Ep** | Relevé bancaire **multi-produits** (compte courant + livret(s) consolidés sur un seul PDF, typique de LBP et CM). Format : `P4 - [Prénom] - RdC+Ep BANQUE AAAA MM n° CCP + Type n° Ep [- Solde €].pdf`. Lister chaque produit d'épargne présent. **Solde uniquement sur le relevé du dernier mois** disponible (pas sur les relevés intermédiaires). |
| **Ep** | Épargne — **toujours en P4**, qu'elle soit bancaire (Livret A, LDDS, PEL, PEA, compte-titres…) ou non bancaire (assurance-vie, PER, SCPI, crypto, piliers de prévoyance suisses). Format complet : `P4 - [Prénom1] [& Prénom2] - Ep Type ÉMETTEUR n° 4chiffres - Solde €.pdf`. Toujours en prénoms, émetteur en majuscules abrégées, **préfixe `n° ` obligatoire**, solde constaté en fin de nom (`X XXX €` avec espaces pour les milliers). |
| **Esti** | Estimation locative. Inclure le nom de l'agence et le montant estimé (`Esti Métropole Immo 850 €`). |
| **IRPP** | Avis d'imposition sur le revenu. Format : `P3 - [Personne] - IRPP [AAAA avis] sur [AAAA revenus].pdf`. **Les deux années sont obligatoires**. |
| **KBIS** | Extrait K bis (personne morale). Format : `P1 - [Forme Nom] - KBIS Date Document (AAAA MM JJ).pdf`. |
| **Plaquette comptes annuels** | Plaquette comptable d'un exercice **clos**. Format : `PX - [Cible] - Plaquette comptes annuels AAAA.pdf`. P3 si comptes du repreneur, P5 si comptes de la cible. |
| **Liasse fiscale** | Formulaires Cerfa 2050-2059 ou 2033. Format : `PX - [Cible] - Liasse fiscale AAAA.pdf`. |
| **Prévisionnel** | Projections futures sur 3-5 ans. Format : `PX - [Cible] - Prévisionnel AAAA-AAAA.pdf` (plage couverte, jamais un mois unique). |
| **Offre achat / LOI / Compromis / Promesse vente / Cession parts sociales** | Acte d'engagement contractuel sur un bien à acquérir (ou LOI / cession de parts en pro). Format : `P5 - [Cible] - [Type] [statut] AAAA MM JJ.pdf`. Statuts : `non signée`, `signée porteur`, `contresignée`, `notariée`/`notarié`, `paraphée`, `enregistrée` (cession parts uniquement). **LOI** et **Cession parts sociales** = catégories spécifiques au financement pro. |
| **Prénoms** | TOUJOURS utiliser les prénoms, même pour un couple marié/pacsé avec même nom. Ne JAMAIS utiliser Mr/Mme dans les noms de fichiers. |

Si un PDF couvre plusieurs mois, noter la plage : `2026 01-02`.

---

## Vérification croisée des adresses

Avant de taguer un fichier "RP", **croiser au moins 2 sources** parmi :

- Bulletins de salaire (adresse du salarié)
- Avis d'imposition (adresse fiscale)
- Relevés bancaires (adresse du titulaire)
- Quittance de loyer ou titre de propriété
- Compromis / avenants

Si les emprunteurs vivent séparément (adresses différentes), identifier clairement la RP de chacun avec les prénoms (RP Prénom1 vs RP Prénom2) et documenter les deux adresses.

---

## Distinction P2 vs P5 (patrimoine immobilier)

La règle est simple :

- **P2** = bien **déjà détenu** (titre de propriété d'un bien acquis, DPE d'un bien en portefeuille, estimation d'un bien en location, taxe foncière, TA du prêt en cours…)
- **P5** = bien **à acquérir** (compromis, avenants, devis travaux, audit énergétique, DPE du futur bien, estimations du projet…)

**Cas particulier** : une estimation locative peut être P2 ou P5 selon le contexte. Si elle justifie le revenu locatif d'un bien déjà loué → P2. Si elle projette le rendement du bien à acquérir → P5.

---

## Règle absolue : tout document en PDF, dans le bon sens de lecture

Un dossier bancaire ne contient **que des PDF**. Aucune exception. Tout fichier qui n'est pas déjà un PDF doit être converti. Et tout document — qu'il arrive en image, en PDF existant, ou dans n'importe quel autre format — doit être **dans le bon sens de lecture** avant d'être classé. Un document couché, à l'envers ou mal orienté, c'est un signal d'amateurisme pour le banquier. Ça se corrige systématiquement.

### Formats à convertir en PDF

| Format d'origine | Action |
|-----------------|--------|
| **JPG, JPEG, PNG, WEBP, HEIC** | Convertir en PDF (une image = une page). Si plusieurs images constituent un même document (ex. recto/verso CNI, pages scannées une par une), les fusionner en un seul PDF multi-pages. |
| **TIFF, BMP** | Convertir en PDF |
| **DOC, DOCX** | Convertir en PDF (via LibreOffice headless : `libreoffice --headless --convert-to pdf`) |
| **XLS, XLSX** | Convertir en PDF (idem LibreOffice headless) |
| **PDF** | Déjà au bon format — mais vérifier l'orientation (voir ci-dessous) |

### Vérification et correction de l'orientation — sur TOUS les documents

L'orientation se vérifie sur **tout document sans exception** : les images ET les PDF existants. Les photos prises au smartphone sont souvent stockées en paysage avec une métadonnée EXIF qui n'est pas toujours respectée à la conversion. Les PDF reçus par mail ou téléchargés depuis des portails peuvent aussi arriver avec des pages tournées à 90° ou 180°.

#### Pour les images (JPG, PNG, etc.) → avant conversion en PDF

```python
from PIL import Image, ImageOps

img = Image.open("document.jpg")

# 1. Appliquer l'orientation EXIF (corrige les rotations encodées par le smartphone)
img = ImageOps.exif_transpose(img)

# 2. Vérifier visuellement avec le tool Read (qui affiche les images)
#    Si le document apparaît couché ou à l'envers malgré la correction EXIF,
#    appliquer une rotation manuelle :
#    img = img.rotate(90, expand=True)   # sens anti-horaire
#    img = img.rotate(270, expand=True)  # sens horaire
#    img = img.rotate(180, expand=True)  # retourné

# 3. Convertir en PDF
if img.mode in ("RGBA", "P"):
    img = img.convert("RGB")
img.save("document.pdf", "PDF")
```

#### Pour les PDF existants → vérifier chaque page

Les PDF reçus peuvent contenir des pages mal orientées (relevés bancaires scannés, compromis envoyés par le notaire, etc.). Vérifier l'orientation en lisant le PDF avec le tool `Read` (mode image), et corriger si nécessaire :

```python
import fitz  # PyMuPDF

doc = fitz.open("document.pdf")
for page in doc:
    # Si la page est en paysage alors que le contenu est en portrait
    # (texte couché), la pivoter de 90° :
    if page.rect.width > page.rect.height:
        page.set_rotation(90)
    # Pour une page à l'envers (180°) :
    # page.set_rotation(180)
doc.save("document_corrige.pdf")
```

**Attention** : certains documents sont légitimement en paysage (tableaux d'amortissement larges, bilans comptables). Ne pas pivoter aveuglément — le critère est toujours **le sens de lecture du texte**. En cas de doute, ouvrir le document avec `Read` pour vérifier visuellement avant de corriger.

#### Résumé de la procédure

Pour **chaque fichier** du do