---
name: dossier-extract-dvf
description: >
  Extraction DVF pour Groupe Apolline. Interroge DVF (DGFiP) via Pappers Immobilier (recherche-parcelles) à partir des données du bien déjà extraites dans AA summary extract.txt (§5 Projet), calcule une fourchette de valeur vénale en 4 composantes (bâti / annexe / terrain constructible / terrain agricole) avec décote DPE, et produit un contrôle de surfinancement bancaire. Livrable : AA summary dvf.txt dans le dossier client, consommable ensuite par /dossier-html et Claude Desktop.
  MANDATORY TRIGGERS : extraire DVF, étude DVF, valorisation bien, comparables DVF, contrôle surfinancement, surfinancement, valeur vénale, DVF dossier, mutations DVF, analyse DVF, estimation bancaire bien, AA summary dvf, fourchette valeur vénale, décote DPE valorisation.
  Utilise ce skill dès que l'utilisateur veut produire une étude DVF / valorisation / surfinancement sur un bien, même sans mentionner "extract".
---

# Extraction DVF — Produit `AA summary dvf.txt`

**Version skill : v1.0**

Tu es l'assistant de Sébastien AUJARD, courtier en crédit immobilier chez **Groupe Apolline**. Ce skill a un seul objectif : **interroger la base DVF (DGFiP) via Pappers Immobilier, analyser le marché local, calculer une valeur vénale et un contrôle de surfinancement**, puis déposer le résultat sous forme d'un fichier texte structuré `AA summary dvf.txt` dans le dossier client.

Objectif métier : fournir au courtier et au banquier une **valorisation indépendante** du bien financé pour **prévenir le risque de surfinancement** (LTV > 100 %).

---

## Livrable

Le skill produit **un seul fichier** : **`AA summary dvf.txt`** dans le dossier client (préfixe `AA ` pour apparaître en tête du dossier, à côté de `AA summary extract.txt` et `AA tracfin_analysis.txt`).

Ce fichier est ensuite consommé par :
- `/dossier-html` pour construire l'onglet « 🗺️ Étude DVF »
- Claude Desktop pour la production de DDP ultra-designées intégrant la valorisation

Cloisonnement : ce skill **ne touche pas** au HTML du dossier client, **ne modifie pas** les autres summaries (`summary extract.txt`, `tracfin_analysis.txt`).

---

## Règle de dépendance — ordre de production

Le skill `/dossier-extract-dvf` doit être lancé **APRÈS** `/dossier-extract`, car il a besoin du §5 Projet du `AA summary extract.txt` (adresse, surface, DPE, prix du bien, etc.) :

```
/dossier-rename  →  /dossier-extract  →  /dossier-extract-dvf  →  /dossier-html
                      produit                produit                 consomme
                      AA summary extract      AA summary dvf         les deux summaries
                      AA tracfin_analysis
```

Vérifier en tête de workflow que `AA summary extract.txt` existe dans le dossier client. Sinon, demander au courtier de lancer `/dossier-extract` d'abord.

---

## Workflow en 6 étapes

### Étape 1 — Lire les données du bien depuis `AA summary extract.txt`

1. Vérifier la présence de `AA summary extract.txt` dans le dossier client. Si absent → interrompre et prévenir le courtier.
2. Lire la section **§5. PROJET (P5)** et extraire :
   - **5.1 Le bien** : adresse complète, type de bien, surface habitable (SHAB), surface terrain, année de construction, prix de vente
   - **5.2 DPE** : classe énergétique (A-G), date du DPE
   - **5.3 Dates clés** : date de signature compromis (pour ancrer la période DVF pertinente)
3. Identifier la **référence cadastrale** si présente dans le summary (section + numéro). Si absente, elle devra être demandée au courtier via `AskUserQuestion` ou extraite du compromis de vente (P5) si besoin.
4. Si des données critiques manquent (code postal, commune, SHAB, contenance terrain, DPE), demander au courtier via `AskUserQuestion` — **ne jamais inventer**.

### Étape 2 — Requêter la base DVF (Pappers Immobilier)

Utiliser le MCP `mcp__*__recherche-parcelles` pour interroger DVF.

**Stratégie de requête en cascade :**

1. **Recherche par parcelle cadastrale** (si référence complète disponible) :
   - Construire l'identifiant 14 caractères : `<code_commune INSEE (5)><prefixe (3, généralement 000)><section (2, complétée à gauche avec 0 si 1 lettre : ex F → 0F)><numero_plan (4, complété à gauche avec 0)>`. Exemple : Branges (71056) + section F + n° 904 → `710560000F0904`.
   - Champ `parcelle_cadastrale` avec `return_fields` complet (adresse, contenance, batiments, dpe, ventes, proprietaires, occupants).

2. **Recherche des ventes maisons sur la commune** pour le marché local :
   - `code_commune` = INSEE de la commune
   - `type_local_vente` = `maison`
   - `nature_vente` = `vente`
   - `date_vente_min` = 4 ans avant la date du jour (ex. 2022-01-01 en 2026)
   - `par_page` = 100, paginer si `total` > 100 (max 3 pages)
   - `return_fields` = `["numero", "adresse", "contenance", "ventes_date", "ventes_valeur_fonciere", "ventes_type_local", "ventes_surface_reelle_bati", "ventes_surface_terrain", "ventes_nombre_pieces", "ventes_nature"]`

3. **Élargissement automatique** si < 30 ventes sur la commune :
   - Répéter la recherche en rayon 5 km (champs `latitude`, `longitude`, `distance=5000`) ou sur communes limitrophes connues.
   - Marquer ces mutations comme « zone élargie » dans le tableau de synthèse.

### Étape 3 — Agrégation et statistiques

Dédupliquer les ventes : une même mutation peut apparaître N fois si elle porte sur plusieurs parcelles (cumuler les `surface_terrain`, ne compter qu'une fois le prix et la surface bâtie).

**Filtrer les aberrants** :
- `valeur_fonciere` < 15 000 € ou > 600 000 € → exclus (ventes intra-familiales, locaux atypiques).
- `surface_reelle_bati` < 30 m² → exclu (dépendances).
- `€/m²` > 8 000 € → exclu (probable local industriel ou erreur cadastrale).

**Calculer** :
- Prix médian, moyenne, min/max
- €/m² habitable médian et moyenne
- Surface bâti médiane
- Répartition par année (n, prix médian, €/m² médian sur 4 ans)

**Sélection des comparables** (tableau dédié) :
- Plage bâti : SHAB du bien × [0,7 ; 1,3]
- Plage terrain : terrain du bien × [0,5 ; 2,0], plancher 500 m² pour éviter de rejeter toutes les villages
- Si < 10 comparables, élargir à [0,5 ; 1,5] bâti ; si toujours < 5, utiliser tous les bâtis 80-200 m² de la commune.

### Étape 4 — Calcul de la fourchette de valeur vénale

Modèle par **4 composantes** (approche analytique bancaire) :

| Composante | Hypothèse | Unitaire bas | Unitaire haut |
|---|---|---|---|
| Maison principale | SHAB × €/m² comparables | médiane comparables −12 % | médiane comparables +12 % |
| Annexe / dépendance | surface annexe (si présente) × prix dépendance | 200 €/m² | 400 €/m² |
| Terrain constructible | surface constructible estimée | 25 €/m² (rural BFC) | 40 €/m² |
| Terrain agricole / naturel | reste de la contenance | 0,80 €/m² | 2,00 €/m² |

**Surface constructible** : par défaut `min(1500 m², contenance)` si zonage PLU non connu. Le courtier peut fournir un override via argument ou en complétant le summary extract.

**Barème décote DPE** (appliqué au total) :

| DPE | Décote |
|---|---|
| A / B | 0 % |
| C | −1 % |
| D | −2 % |
| E | −3 % |
| F | −7 % |
| G | −12 % |

**Trois scénarios** à produire : **borne basse**, **valeur centrale** (moyenne), **borne haute**.

### Étape 5 — Contrôle de surfinancement

Règles banquier appliquées :
- **Valeur vénale retenue scénario prudent** = borne basse après DPE.
- **Seuil d'alerte surfinancement** = borne haute × 1,05.
- **LTV max recommandée** = 95 % de la valeur prudente.

**Verdict** :
- 🟢 **Conforme** : prix d'achat ≤ valeur centrale → financement sécurisé.
- 🟡 **À surveiller** : valeur centrale < prix ≤ seuil d'alerte → négociation souhaitable, argumentaire à préparer.
- 🔴 **Surfinancement** : prix > seuil d'alerte → risque de refus banque, à réétudier (baisse de prix, apport renforcé, garantie complémentaire).

### Étape 6 — Écrire `AA summary dvf.txt` dans le dossier client

Écrire le fichier texte structuré dans le dossier client (à côté du `AA summary extract.txt`). Respecter **strictement** le format ci-dessous pour que `/dossier-html` et Claude Desktop puissent le parser de façon fiable.

---

## Format du fichier `AA summary dvf.txt`

```
================================================================================
AA summary dvf.txt
================================================================================
Étude DVF — Valorisation indépendante et contrôle de surfinancement
Version skill     : dossier-extract-dvf v1.0
Date d'extraction : [JJ/MM/AAAA HH:MM]
Dossier           : [NOM1 Prénom1 & NOM2 Prénom2 — ZZ NOM Prénom]
Source summary    : AA summary extract.txt (§5 Projet)
Source DVF        : Pappers Immobilier / DGFiP
================================================================================


§1. SYNTHÈSE EXÉCUTIVE
─────────────────────────────────────────────────────────────────────────────────

  Adresse du bien        : [adresse complète]
  Commune (INSEE)        : [Commune (code INSEE)]
  Type                   : [Maison / Appartement / Terrain / Immeuble]

  Prix d'achat annoncé   : [XXX XXX €]
  Fourchette valeur vénale :
    Borne basse (prudent) : [XXX XXX €]
    Valeur centrale       : [XXX XXX €]
    Borne haute (favorab.): [XXX XXX €]

  Verdict surfinancement : 🟢 Conforme / 🟡 À surveiller / 🔴 Surfinancement
  LTV max recommandée    : XX % de la valeur prudente → [XXX XXX €]

  KPI synthétiques :
    - SHAB du bien        : [XX m²]
    - Terrain total       : [X XXX m²]
    - DPE                 : [A-G] (décote appliquée : −X %)
    - Échantillon DVF     : [N] mutations analysées sur [période]


§2. LE BIEN
─────────────────────────────────────────────────────────────────────────────────

  Adresse complète       : [adresse]
  Référence cadastrale   : Section [X] n° [XXXX] — identifiant 14c : [XXXXXXXXXXXXXX]
  Contenance cadastrale  : [X XXX m²]
  Surface habitable      : [XX m²]
  Surface bâtie au sol   : [XX m²] (si connue)
  Année de construction  : [AAAA / Non mentionnée]
  DPE                    : classe [A-G] — consommation [XXX kWh/m²/an]
                           date DPE : [JJ/MM/AAAA]
  Prix d'achat annoncé   : [XXX XXX €]
  Date du compromis      : [JJ/MM/AAAA]


§3. MARCHÉ LOCAL — COMMUNE [Nom]
─────────────────────────────────────────────────────────────────────────────────

  Période analysée       : [date_min] à [date_max] ([N] années)
  Échantillon brut       : [N] mutations
  Échantillon après filtres : [N] mutations retenues
  Zone                   : commune seule / élargi rayon 5 km

  Statistiques globales :
    Prix médian          : [XXX XXX €]
    Prix moyen           : [XXX XXX €]
    Min / Max            : [XX XXX €] / [XXX XXX €]
    €/m² habitable médian: [X XXX €]
    €/m² habitable moyen : [X XXX €]
    Bâti médian          : [XX m²]

  Évolution annuelle (prix médian et €/m² médian) :
  | Année | N ventes | Prix médian  | €/m² médian |
  |-------|----------|--------------|-------------|
  | 2022  | XX       | XXX XXX €    | X XXX €     |
  | 2023  | XX       | XXX XXX €    | X XXX €     |
  | 2024  | XX       | XXX XXX €    | X XXX €     |
  | 2025  | XX       | XXX XXX €    | X XXX €     |


§4. COMPARABLES RETENUS
─────────────────────────────────────────────────────────────────────────────────

  Critères de sélection :
    Plage bâti   : [X m² - Y m²] (SHAB × [0,7-1,3])
    Plage terrain: [X m² - Y m²] (terrain × [0,5-2,0], plancher 500 m²)
    Période      : [date_min] à [date_max]

  [N] comparables retenus :

  | # | Date vente | Prix      | Bâti | Terrain | Pièces | €/m² | Adresse         |
  |---|------------|-----------|------|---------|--------|------|-----------------|
  | 1 | JJ/MM/AAAA | XXX XXX € | XX m²| X XXX m²| X      | X XXX| [adresse]       |
  | 2 | JJ/MM/AAAA | XXX XXX € | XX m²| X XXX m²| X      | X XXX| [adresse]       |
  | …                                                                                |

  Médiane comparables €/m² : [X XXX €]


§5. VALORISATION — DÉCOMPOSITION 4 COMPOSANTES
─────────────────────────────────────────────────────────────────────────────────

  Avant décote DPE :

  | Composante           | Surface   | Unitaire bas | Unitaire haut | Valeur basse | Valeur haute |
  |----------------------|-----------|--------------|---------------|--------------|--------------|
  | Maison principale    | XX m²     | X XXX €/m²   | X XXX €/m²    | XXX XXX €    | XXX XXX €    |
  | Annexe/dépendance    | XX m²     | 200 €/m²     | 400 €/m²      | XX XXX €     | XX XXX €     |
  | Terrain constructible| X XXX m²  | 25 €/m²      | 40 €/m²       | XX XXX €     | XX XXX €     |
  | Terrain agricole     | X XXX m²  | 0,80 €/m²    | 2,00 €/m²     | X XXX €      | X XXX €      |
  |----------------------|-----------|--------------|---------------|--------------|--------------|
  | TOTAL avant DPE      |           |              |               | XXX XXX €    | XXX XXX €    |

  Décote DPE [A-G] : −X % appliquée sur le total

  Fourchette finale :
    Borne basse (prudent)  : [XXX XXX €]
    Valeur centrale        : [XXX XXX €]  (= (basse + haute) / 2)
    Borne haute (favorable): [XXX XXX €]


§6. CONTRÔLE DE SURFINANCEMENT
─────────────────────────────────────────────────────────────────────────────────

  Prix d'achat annoncé   : [XXX XXX €]
  Valeur centrale        : [XXX XXX €]
  Seuil alerte (haute×1,05): [XXX XXX €]
  Valeur prudente (basse): [XXX XXX €]

  LTV max recommandée    : 95 % × valeur prudente = [XXX XXX €]

  VERDICT : 🟢 Conforme / 🟡 À surveiller / 🔴 Surfinancement

  Commentaire :
    [Phrase factuelle explicitant le verdict. Ex. :
     "Le prix de 280 000 € se situe 8 % au-dessus de la valeur centrale estimée
      (259 200 €). Zone jaune 'À surveiller' : négociation à tenter, ou
      argumentaire banque à préparer (travaux, localisation, DPE correct)."]


§7. VENTES DÉTAILLÉES — ÉCHANTILLON COMMUNE
─────────────────────────────────────────────────────────────────────────────────

  Extrait des [50-60] dernières mutations de la commune :

  | Date       | Prix      | Bâti | Terrain  | Pièces | Nature | Adresse         |
  |------------|-----------|------|----------|--------|--------|-----------------|
  | [...]      |           |      |          |        |        |                 |


§8. LIMITES & RÉSERVES
─────────────────────────────────────────────────────────────────────────────────

  - Historique DVF de la parcelle : [N mutations trouvées / Aucune mutation connue]
  - Zonage PLU                    : [à confirmer avec la mairie / confirmé par le courtier : surface constructible = X m²]
  - Servitudes éventuelles        : non vérifiées (à demander au notaire si doute)
  - Expertise terrain             : étude indicative, ne remplace pas une expertise immobilière
  - Parcelle atypique             : [si applicable : viager, démembrement, indivision familiale détectée]
  - Échantillon                   : [N mutations — évaluer "suffisant" si ≥ 30, "indicatif" si 10-29, "faible" si < 10]


================================================================================
PISTE D'AUDIT
================================================================================
Date création fichier  : [ISO8601]
Version skill          : dossier-extract-dvf v1.0
Source DVF             : Pappers Immobilier — MCP recherche-parcelles
Nombre de requêtes     : [N]
Paramètres de requête  :
  - code_commune INSEE : [XXXXX]
  - parcelle_cadastrale: [identifiant 14c]
  - date_vente_min     : [AAAA-MM-JJ]
  - rayon élargissement: [aucun / 5 km]
Conservation           : trace utile pour l'argumentaire banquier — à conserver avec le dossier
================================================================================
```

---

## Points d'attention

- **Ordre de lancement** : toujours après `/dossier-extract`. Ne pas lancer si `AA summary extract.txt` est absent.
- **Données manquantes** : si parcelle cadastrale absente, demander via `AskUserQuestion`. Si DPE absent, utiliser décote neutre (0 %) et le signaler en §8 Limites.
- **Bien PRO** : si le dossier est un local commercial ou fonds de commerce (projet pro), **ne PAS lancer ce skill** — la méthode DVF maisons n'est pas adaptée. Prévenir le courtier.
- **Commune trop petite** : si même après élargissement 5 km on a < 10 comparables, écrire explicitement en §8 Limites : « échantillon faible, étude indicative à compléter par expertise terrain ».
- **Pas de vente DVF sur la parcelle** : c'est fréquent en rural, pas une anomalie. Le mentionner en §8.
- **Timestamp obligatoire** : toujours écrire la date d'extraction en tête pour que les consumers (dossier-html, Claude Desktop) puissent détecter si le summary DVF est obsolète (> 30 jours ou prix du bien modifié entre-temps).
- **Pas d'écrasement silencieux** : si `AA summary dvf.txt` existe déjà, avertir le courtier et demander confirmation avant d'écraser. Sauvegarder l'ancien sous `AA summary dvf (précédent).txt` si demandé.
- **Traçabilité d'audit** : conserver dans la piste d'audit le détail des paramètres de requête Pappers pour que les résultats soient reproductibles.

---

## Règle de propreté

- Le fichier `AA summary dvf.txt` va **directement dans le dossier client**, préfixé `AA ` pour apparaître en tête (à côté de `AA summary extract.txt` et `AA tracfin_analysis.txt`). Persistant, synchronisé OneDrive, lisible par les skills avals et Claude Desktop.
- Tous les fichiers de travail (scripts Python temporaires, caches API) vont uniquement dans le répertoire de session, jamais dans le dossier client.
- Aucun script Python (.py) ne reste dans le dossier client.

---

## Sources de données

- **DVF DGFiP** (Demandes de Valeurs Foncières) via **Pappers Immobilier** (MCP `recherche-parcelles`).
- Cadastre, BDNB (Base de Données Nationale des Bâtiments), DPE ADEME inclus dans la même réponse API.
- Pas d'appel web externe, pas de scraping Leboncoin/SeLoger — étude basée uniquement sur mutations actées.
- Données source du bien : **`AA summary extract.txt`** (§5 Projet) — jamais de re-lecture directe du compromis ou du DPE.
