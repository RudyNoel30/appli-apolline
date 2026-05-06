---
name: dossier-html-simulation
description: >
  Injecte l'onglet "📊 Étude comparative" (simulateur de financement multi-banques) dans un dossier HTML déjà généré par le skill dossier-html. Ne reconstruit pas le dossier — greffe chirurgicale de l'onglet simulateur dans le HTML existant. Compare 5 banques régionales (CEBFC, LBP, CACE, BPBFC, SG) avec 15 profils de revenus, assurance CNP Groupe vs Délégataire en quotité 100%/100%. MANDATORY TRIGGERS : simulation, simulateur, étude comparative, comparatif banques, comparatif taux, onglet simulation, ajouter simulateur, injecter simulateur, dossier-html-simulation, comparer les banques, taux banques, simulation financement, barèmes courtiers. Utilise ce skill dès que l'utilisateur veut ajouter le simulateur de comparaison bancaire dans un dossier HTML existant, même en disant simplement "ajoute le simulateur" ou "comparatif banques".
---

# Simulateur de financement — Onglet "Étude comparative"

Tu es l'assistant de Sébastien AUJARD, courtier chez **Groupe Apolline**. Ce skill a un seul objectif : **injecter l'onglet "📊 Étude comparative"** dans un fichier HTML de dossier client déjà généré par le skill `dossier-html`.

Le dossier HTML existe déjà avec ses 7 onglets (État civil, Revenus, Patrimoine, Projet, Financement, Pièces, Notes internes). Tu ne touches pas au contenu existant — tu ajoutes un 8e onglet entre "Pièces à fournir" et "Notes internes".

---

## Workflow en 4 étapes

### Étape 1 — Localiser le HTML et identifier les données du dossier

1. Chercher le fichier HTML du dossier client dans le répertoire du dossier (pattern : `AA *-dossier*.html`)
2. Lire le fichier et extraire :
   - Les noms et prénoms des emprunteurs (dans le header `.header-info`)
   - Leurs âges (dans les KPI de l'onglet état civil)
   - Le type de projet et l'adresse (dans le header)
   - **Le montant total emprunté** et **la durée** depuis l'onglet Financement (`<div id="financement">`) : lire le tableau "Plan de financement", sommer les prêts amortissables (ex: prêt principal + prêt modulable), et extraire la durée en mois à convertir en années
3. Confirmer avec le courtier si besoin via `AskUserQuestion`

### Étape 2 — Injecter les 3 blocs dans le HTML

L'injection se fait dans cet ordre précis. Lire le fichier `references/simulator-template.md` qui contient les blocs exacts à injecter.

**Bloc 1 — CSS** : Insérer les styles `.sim-*` juste avant la balise `</style>` existante.

**Bloc 2 — Bouton d'onglet** : Dans la barre `.tabs`, remplacer :
```html
<div class="tab" onclick="switchTab('notes')">🔒 Notes internes</div>
```
par :
```html
<div class="tab" onclick="switchTab('simulateur')">📊 Étude comparative</div>
<div class="tab" onclick="switchTab('notes')">🔒 Notes internes</div>
```

**Bloc 3 — Contenu HTML + JavaScript** : Insérer le `<div id="simulateur">` et le bloc `<script>` complet. Le contenu du simulateur se place juste avant le commentaire `<!-- ONGLET ... NOTES INTERNES -->` (ou juste avant le `<div id="notes">`). Le bloc `<script>` remplace le script `switchTab` existant (car il inclut le même code + le simulateur).

### Étape 3 — Personnaliser les données pré-remplies

Dans le HTML injecté, remplacer les placeholders par les données réelles du dossier :
- `{{PRENOM1}} {{NOM1}}` → nom complet emprunteur 1
- `{{AGE1}}` → âge emprunteur 1
- `{{PRENOM2}} {{NOM2}}` → nom complet emprunteur 2 (vide si emprunteur seul)
- `{{AGE2}}` → âge emprunteur 2 (vide si emprunteur seul)
- `{{MONTANT}}` → montant total emprunté extrait de l'onglet Financement (somme des prêts amortissables, ex: prêt principal + prêt modulable). **Lire le tableau "Plan de financement"** dans `<div id="financement">` pour trouver le total des prêts.
- `{{DUREE}}` → durée en années extraite de l'onglet Financement (convertir les mois en années : 300 mois → 25). Ajouter l'attribut `selected` sur l'`<option>` correspondante dans le `<select id="sim-duree">`.

**Important** : le montant et la durée sont pré-remplis mais restent **éditables** par le courtier. Le champ montant est un `<input type="number">` standard, le courtier peut cliquer et modifier la valeur librement. Le comparatif se recalcule en temps réel.

### Étape 4 — Sauvegarder

Sauvegarder le fichier modifié. **Ne pas écraser l'original** — créer une copie avec un suffixe distinctif (ex: `AA NOM nom-dossier-simulateur.html`) ou écraser si le courtier le demande explicitement.

---

## Données bancaires intégrées

Le simulateur embarque les barèmes courtiers de 5 banques régionales BFC :

| Banque | Profils | Couleur header | Durées disponibles |
|--------|---------|----------------|-------------------|
| Caisse d'Épargne BFC | 2 (< ou ≥ 5 000 €/couple) | `#e3001b` (rouge vif) | 7, 10, 12, 15, 20, 25 |
| La Banque Postale | 4 (Client/Prospect × min/moyen) | `#003d82` (bleu) | 5, 10, 12, 15, 18, 20, 22, 25 |
| Crédit Agricole Centre Est | 3 (Standard/Privilège/Premium) | `#006633` (vert) | 7, 10, 12, 15, 18, 20, 22, 25 |
| Banque Populaire BFC | 3 (Standard/Premium/Excellium) | `#0054a6` (bleu) | 7, 10, 12, 15, 20, 25 |
| Société Générale | 3 (< 42K€ / ≥ 42K€ / > 80K€) | `#6b1d2a` (bordeaux) | 7, 10, 12, 15, 18, 20, 25 |

### Assurance emprunteur

Deux modes comparés automatiquement :

1. **CNP Groupe** — Taux constant sur capital initial. Interpolation linéaire entre 3 points d'âge : 30 ans → 0,367 %, 42 ans → 0,76 %, 52 ans → 1,061 %.
2. **Délégataire** — Taux dégressif sur CRD (capital restant dû). Formule : `0.75 × âge / 10000` par emprunteur.

**Règle quotité 100%/100%** : chaque emprunteur est assuré sur la totalité du capital. Les taux sont donc **sommés** (pas moyennés). C'est la correction critique par rapport aux versions antérieures.

```
cnpRateTotal = cnpRate(age1) + cnpRate(age2)   // PAS (rate1 + rate2) / 2
delegRate    = 0.75×age1/10000 + 0.75×age2/10000
```

---

## Mise à jour des barèmes

Les barèmes sont codés en dur dans le template JavaScript (`banksData`). Quand Sébastien fournit de nouveaux barèmes, mettre à jour le fichier `references/simulator-template.md` section "BANK DATA". Les taux sont en décimal (3,50 % = `0.035`).

---

## Points d'attention

- **Ne jamais reconstruire les onglets existants** — ce skill ne touche qu'aux 3 points d'injection (CSS, bouton tab, contenu + JS)
- **Le fichier doit rester un seul HTML** — pas de fichiers JS ou CSS séparés
- **Charte Navy/Gold** — les styles du simulateur utilisent les mêmes variables CSS que le dossier-html (`--navy`, `--gold`, `--cream`, etc.)
- **Responsive** — les cards du simulateur passent de 4 colonnes à 3, 2, puis 1 selon la largeur d'écran
- **Emprunteur seul** — si pas d'emprunteur 2, laisser les champs emprunteur 2 vides (le JS gère le cas `age2 = null`)
- **Pré-remplissage du montant et de la durée** — toujours extraire ces données de l'onglet Financement existant pour que le comparatif s'affiche immédiatement. Le courtier peut ensuite modifier librement les valeurs.
