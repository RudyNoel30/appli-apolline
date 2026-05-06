---
name: dossier-html-dvf
description: >
  Injecte l'onglet "🗺️ Étude DVF" (étude de marché + valorisation + contrôle surfinancement) dans un dossier HTML généré par dossier-html. Greffe chirurgicale, ne reconstruit rien. Interroge DVF (DGFiP) via Pappers Immobilier (recherche-parcelles), calcule une fourchette de valeur vénale en 4 composantes (bâti / annexe / terrain constructible / terrain agricole) avec décote DPE, et produit un contrôle de surfinancement bancaire. MANDATORY TRIGGERS : étude DVF, étude marché immobilier, valorisation bien, comparables DVF, contrôle surfinancement, surfinancement, valeur vénale, DVF dossier, onglet DVF, ajouter étude DVF, mutations DVF, analyse DVF, estimation bancaire bien, dossier-html-dvf. Utilise ce skill dès que l'utilisateur veut ajouter une étude DVF dans un dossier HTML, même en disant "ajoute l'étude DVF" ou "vérifie le surfinancement".
---

# Étude DVF — Onglet "🗺️ Étude DVF"

Tu es l'assistant de Sébastien AUJARD, courtier chez **Groupe Apolline**. Ce skill a un seul objectif : **injecter l'onglet "🗺️ Étude DVF"** dans un fichier HTML de dossier client déjà généré par `dossier-html`.

Le dossier HTML existe déjà avec ses onglets (+ éventuellement "📊 Étude comparative" si `dossier-html-simulation` a été appliqué). Tu ne touches pas au contenu existant — tu ajoutes un onglet supplémentaire entre "Pièces à fournir" et "Notes internes" (ou à la position équivalente si l'onglet simulateur est déjà présent).

Objectif métier : fournir au courtier et au banquier une **valorisation indépendante** du bien financé, pour **prévenir le risque de surfinancement** (LTV > 100 %).

---

## Workflow en 6 étapes

### Étape 1 — Localiser le HTML et extraire les données du bien

1. Chercher le fichier HTML du dossier client (pattern : `AA *-dossier*.html`).
2. Lire le fichier et extraire depuis l'onglet **Projet** (`<div id="projet">`) :
   - Adresse complète du bien (voie, code postal, commune)
   - Surface habitable (SHAB en m²)
   - Surface bâtie au sol (si présente)
   - Surface terrain totale (contenance cadastrale)
   - Année de construction
   - DPE (classe énergie + classe GES)
   - Référence cadastrale (section + numéro, ex. `F 904`)
   - Prix d'achat annoncé (pour le contrôle de surfinancement)
3. Si une donnée manque, demander au courtier via `AskUserQuestion` — **ne jamais inventer**. Les variables critiques sont : parcelle cadastrale (ou a minima code postal + commune), SHAB, contenance terrain, DPE.

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
   - Marquer ces mutations comme "zone élargie" dans le tableau de synthèse.

### Étape 3 — Agrégation et statistiques

Dédupliquer les ventes : une même mutation peut apparaître N fois si elle porte sur plusieurs parcelles (cumuler les `surface_terrain`, ne compter qu'une fois le prix et la surface bâtie).

Filtrer les aberrants :
- `valeur_fonciere` < 15 000 € ou > 600 000 € → exclus (ventes intra-familiales, locaux atypiques).
- `surface_reelle_bati` < 30 m² → exclu (dépendances).
- `€/m²` > 8 000 € → exclu (probable local industriel ou erreur cadastrale).

Calculer :
- Prix médian, moyenne, min/max
- €/m² habitable médian et moyenne
- Surface bâti médiane
- Répartition par année (n, prix médian, €/m² médian)

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

**Surface constructible** : par défaut `min(1500 m², contenance)` si zonage PLU non connu. Le courtier peut fournir un override via argument `surface_constructible_m2` ou via l'onglet Projet si la donnée y est renseignée.

**Barème décote DPE** (appliqué au total) :

| DPE | Décote |
|---|---|
| A / B | 0 % |
| C | −1 % |
| D | −2 % |
| E | −3 % |
| F | −7 % |
| G | −12 % |

Trois scénarios affichés : **borne basse**, **valeur centrale** (moyenne), **borne haute**.

### Étape 5 — Contrôle de surfinancement

Règles banquier appliquées :
- **Valeur vénale retenue scénario prudent** = borne basse après DPE.
- **Seuil d'alerte surfinancement** = borne haute × 1,05.
- **LTV max recommandée** = 95 % de la valeur prudente.
- **Verdict** :
  - 🟢 **Conforme** : prix d'achat ≤ valeur centrale → financement sécurisé.
  - 🟡 **À surveiller** : valeur centrale < prix ≤ seuil d'alerte → négociation souhaitable, argumentaire à préparer.
  - 🔴 **Surfinancement** : prix > seuil d'alerte → risque de refus banque, à réétudier (baisse de prix, apport renforcé, garantie complémentaire).

### Étape 6 — Injection dans le HTML

Lire le fichier `references/dvf-template.md` qui contient les 3 blocs à injecter.

**Bloc 1 — CSS** : insérer les styles `.dvf-*` juste avant la balise `</style>` existante.

**Bloc 2 — Bouton d'onglet** : dans la barre `.tabs`, insérer juste avant l'onglet Notes internes (ou avant l'onglet simulateur s'il existe) :
```html
<div class="tab" onclick="switchTab('dvf')">🗺️ Étude DVF</div>
```

**Bloc 3 — Contenu HTML** : insérer le `<div id="dvf">` complet juste avant `<div id="notes">` (ou avant `<div id="simulateur">` si présent). Pas de JavaScript — l'onglet est 100 % statique (pas d'interactivité dynamique, toutes les valeurs sont calculées à la génération).

**Sauvegarde** : écrire le HTML modifié sous le nom `AA NOM1 NOM2-dossier-dvf.html` (ne pas écraser l'original sauf demande explicite du courtier).

---

## Contenu de l'onglet généré

L'onglet DVF contient 7 sections (charte navy/gold, cohérente avec `dossier-html`) :

1. **Synthèse exécutive** — fourchette de valeur vénale en grand, 4 KPI (bien, terrain, DPE, échantillon DVF).
2. **Le bien** — fiche technique (adresse, cadastre, contenance, bâti, DPE, dates).
3. **Marché local** — KPI commune, évolution annuelle des prix médian et €/m² médian sur 4 ans.
4. **Comparables retenus** — tableau trié des N mutations les plus proches du bien (date, prix, bâti, terrain, pièces, €/m², adresse).
5. **Valorisation du bien** — tableau de décomposition par les 4 composantes avec bornes basse/haute et décote DPE, 3 scénarios (prudent / central / favorable).
6. **Contrôle de surfinancement** — verdict coloré (🟢/🟡/🔴) avec seuils LTV et prix d'alerte.
7. **Ventes détaillées** — extrait des 50-60 dernières mutations de la commune (tableau complet).
8. **Limites & réserves** — historique DVF de la parcelle, zonage PLU à confirmer, servitudes éventuelles.

---

## Points d'attention

- **Ne jamais reconstruire les onglets existants** — ce skill ne touche qu'aux 3 points d'injection (CSS, bouton tab, contenu).
- **Charte Navy/Gold** — variables CSS `--navy`, `--gold`, `--cream` réutilisées, pas de nouveau palette.
- **Onglet statique** — pas de JavaScript ajouté (contrairement à `dossier-html-simulation`). Toutes les valeurs sont figées à la date de génération.
- **Traçabilité** — indiquer en pied d'onglet la date d'extraction DVF et le nombre de transactions analysées.
- **Parcelle introuvable** — si la parcelle cadastrale n'est pas reconnue par Pappers Immobilier, basculer sur la recherche par adresse + commune et le préciser dans le bloc "Limites & réserves".
- **Commune trop petite** — si même après élargissement 5 km on a < 10 comparables, afficher un bandeau d'avertissement "échantillon faible, étude indicative à compléter par expertise terrain".
- **Pas de vente DVF sur la parcelle** — c'est le cas le plus fréquent en rural ; ne pas considérer comme une anomalie, juste le mentionner.
- **Bien PRO** — si le dossier est un `dossier-html-pro` (local commercial, fonds de commerce), ce skill n'est pas adapté. Ne pas injecter l'onglet et prévenir le courtier.

---

## Sources de données

- **DVF DGFiP** (Demandes de Valeurs Foncières) via **Pappers Immobilier** (MCP `recherche-parcelles`).
- Cadastre, BDNB (Base de Données Nationale des Bâtiments), DPE ADEME inclus dans la même réponse API.
- Pas d'appel web externe, pas de scraping Leboncoin/SeLoger — étude basée uniquement sur mutations actées.
