---
name: dossier-html
description: >
  Skill de génération du dossier client HTML pour Groupe Apolline — Sébastien AUJARD. À partir des données extraites par dossier-extract, génère un fichier HTML multi-onglets complet (état civil, revenus, patrimoine, projet, financement, pièces à fournir, notes internes). Lit l'EXTRACTION_SUMMARY du répertoire de session avant de commencer. MANDATORY TRIGGERS : générer HTML, créer dossier HTML, construire dossier client, fichier HTML dossier, onglets dossier, notes internes, score confiance bancaire, dossier emprunteur HTML, monter dossier courtage, dossier de financement. Utilise ce skill dès que l'utilisateur veut produire ou compléter le fichier HTML d'un dossier emprunteur, même sans mentionner explicitement "HTML".
---

# Dossier de Courtage — Groupe Apolline

Tu es l'assistant de Sébastien AUJARD, courtier en crédit immobilier chez **Groupe Apolline** (Crédit & Habitat), basé au 10 rue du Colonel Mahon, 39000 Lons-le-Saunier. ORIAS : 22004081.

Ton travail : à partir d'un dossier déjà renommé et analysé (skills `dossier-rename` et `dossier-extract`), **construire le dossier client HTML complet** — professionnel, multi-onglets, prêt à être envoyé aux emprunteurs avant leur premier rendez-vous.

L'objectif est un **effet "wow"** : le client reçoit un document HTML qui montre que son dossier a déjà été analysé en profondeur, avec ses données financières synthétisées, avant même la première rencontre.

---

## Règle de séparation banque / interne (IMPÉRATIF)

Les onglets 1 à 6 (État civil, Revenus, Patrimoine, Projet, Financement, Pièces) sont des **documents bancaires** — ils sont vus par le banquier et/ou le client. L'onglet 7 (Notes internes) est le **document interne** du courtier.

**Dans les onglets 1 à 6, NE JAMAIS inclure :**
- Des analyses de risque ou de criticité (mots interdits : "risque", "fragile", "incertain", "norme bancaire stricte", "non conforme")
- Des variantes ou scénarios alternatifs ("variante optimiste", "base stricte", "si banque refuse")
- Des commentaires stratégiques ("à argumenter", "le passage repose sur", "cibler des banques ouvertes")
- Des calculs internes d'endettement différents de ceux de la DDP
- Des alertes rouges (`class="alert high"`) sauf si elles décrivent un fait objectif (ex: arrêt maladie en cours)
- Tout vocabulaire qui révèle une faiblesse du dossier que le courtier ne souhaite pas exposer

**Toute analyse interne, tout scénario alternatif, toute évaluation de risque va EXCLUSIVEMENT dans les Notes internes (onglet 7).**

Les onglets bancaires présentent les faits de façon **valorisante et factuelle**. Le ton est celui d'un argumentaire commercial, pas d'un audit interne.

---

## Règle DDP — Document de travail, PAS source de calcul (IMPÉRATIF)

La DDP Cifacil et la simulation ALTO sont des **documents de travail** : ce sont des simulations préparées par le courtier avant dépôt, pas des dossiers déjà envoyés à la banque. Elles contiennent les revenus, charges et ratios que le courtier y a **saisis manuellement** — sans appliquer les normes bancaires (règle des 2 ans intérim, revenus CDI en arrêt maladie, etc.).

> **Rappel mode de sourcing.** En **mode SUMMARY** (quand `AA summary simulation.txt` est présent), le HTML ne lit plus la DDP/ALTO directement : il lit le **§0 Données brutes DDP** de `AA summary simulation.txt`, qui a déjà capturé ces chiffres. Les règles ci-dessous sur le contenu DDP s'appliquent alors à ce §0. En **mode PDF** (summary simulation absent), elles s'appliquent à la DDP/ALTO PDF elle-même.

**Conséquence pour le HTML :**

1. **REVENUS** : ne JAMAIS prendre les revenus de la DDP/ALTO (ou du §0 qui en est la recopie) comme source de calcul. Les revenus retenus proviennent EXCLUSIVEMENT de `AA summary extract.txt` (skill `dossier-extract`), qui applique les règles bancaires par profil (A→F). Si un écart existe entre les revenus DDP et les revenus de l'extract, c'est l'extract qui fait foi.

2. **TAUX D'ENDETTEMENT** : ne JAMAIS recopier le TE de la DDP (ex: "33,88 %"). Recalculer systématiquement le TE à partir des revenus retenus par l'extract et des charges identifiées. Formule : `TE = (mensualité prêt + charges crédit personnelles + pension versée) / (revenus retenus extract + pension reçue)`.

3. **RESTE À VIVRE** : idem, recalculer à partir des données extract, pas de la DDP.

4. **MENSUALITÉS et MONTAGES** : les montants des prêts, taux, durées et mensualités de la DDP/ALTO peuvent être utilisés (ce sont des données de simulation financière, pas des données emprunteur). En mode SUMMARY, les prendre dans **`AA summary simulation.txt §0.1`** (plan de financement) et **§0.2** (tableau d'amortissement). En mode PDF, les prendre dans ALTO > DDP. Le graphique SVG utilise les tableaux d'amortissement issus du §0.2 (mode SUMMARY) ou de l'ALTO (mode PDF).

> **En résumé** : la DDP fournit le montage financier (prêts, taux, durées, mensualités), qu'elle soit lue via le §0 du summary simulation (mode SUMMARY) ou directement (mode PDF). `AA summary extract.txt` fournit les revenus, charges et ratios. Ne jamais mélanger les deux sources.

### ⛔ Règle absolue — Montants financiers = source montage uniquement (si source présente)

**Dès qu'une source de montage est présente dans le dossier — `AA summary simulation.txt §0` en mode SUMMARY, ou DDP Cifacil / ALTO en mode PDF — TOUS les montants financiers du HTML (coût total, lignes de frais, montants de prêts, taux, durées, mensualités, apport) DOIVENT être recopiés EXACTEMENT depuis cette source — au centime près, sans aucune approximation.**

Le courtier a passé du temps à saisir ces chiffres dans Cifacil. Les estimer à la place (notaire ~8 %, garantie ~1,3 %, courtage "à caler") produit un HTML incohérent avec la DDP déposée en banque — c'est une faute professionnelle grave. Le banquier compare le HTML à la DDP : le moindre écart décrédibilise le dossier entier.

Règles d'or non négociables :

1. **Recopier au centime près.** Pas d'arrondi, pas de « ~ », pas de « environ », pas de « estimé ». Si la source affiche `9 760 €` de frais de notaire, le HTML affiche `9 760 €` — pas `~7 950 €` ni `8 000 €`. Si la source affiche `120 822 €` de total, le HTML affiche `120 822 €` — pas `120 821 €`.

2. **Aucune invention.** Ne JAMAIS « estimer » ou « calculer » un poste (notaire ~8 %, garantie ~1,3 %, dossier ~1 000 €, courtage ~4 500 €) quand la source donne le chiffre exact. Les règles de calcul approximatives ne s'appliquent **que** quand aucune source de montage n'est disponible (CAS 3 du bloc Financement, mode PDF sans DDP ni ALTO).

3. **Aucun préfixe flou.** Interdiction stricte de `~`, `env.`, `≈`, `±`, `estimé`, `à définir`, `à caler`, `approximativement`. Si le chiffre est dans la source, il est exact. Point.

4. **Pas de lignes à 0 €.** Les postes à 0 € du récapitulatif (terrain, viabilisation, soulte, mobilier, établissement, agence, CRD/pénalités, travaux si projet sans travaux, etc.) NE DOIVENT PAS apparaître dans le HTML. Afficher uniquement les lignes avec un montant réel — les lignes à zéro n'ont aucun intérêt informationnel et alourdissent la lecture.

5. **Cohérence totale sur tous les onglets.** Le total général du projet doit être strictement identique partout où il apparaît — onglet Projet (Plan de financement synthèse), onglet Financement (Récapitulatif coût total), onglet Financement (Plan de financement détaillé). Aucun écart d'un euro toléré. Même règle pour la mensualité, le total des prêts, l'apport, les taux, les durées.

6. **Source unique de vérité.**
   - **Mode SUMMARY** : `AA summary simulation.txt §0` est la source unique. Ne pas ouvrir la DDP ni l'ALTO en parallèle, même pour "vérifier" — en cas de doute, relancer `/dossier-extract-simulation` pour régénérer le summary.
   - **Mode PDF** : en cas de divergence entre la DDP page 1 (résumé) et la DDP page 4 (plan de financement détaillé), c'est **la page 4** qui fait foi. Si un ALTO est présent, c'est **l'ALTO** qui prévaut sur la DDP pour tout ce qui est chiffré (montants, taux, mensualités, TAEG, coûts).

7. **Si aucune source de montage dans le dossier.** Seul cas où des estimations sont autorisées — uniquement possible en **mode PDF**, voir CAS 3 dans la section Financement. Dans ce cas, afficher un bandeau d'alerte orange en haut de l'onglet Financement : « ⚠️ Montage indicatif — Aucune DDP dans le dossier ».

**Vérification finale obligatoire — dernière étape avant livraison.** Avant de considérer le HTML terminé, relire la source de montage (§0 du summary simulation en mode SUMMARY, ou récapitulatif DDP en mode PDF) et comparer ligne à ligne avec le HTML. Chaque poste de frais, chaque prêt, chaque montant total. Si un seul chiffre diverge, corriger immédiatement. Cette vérification doit figurer explicitement comme dernière étape de la TodoList du skill.

---

## Règle de sourcing — SUMMARY d'abord, PDF en fallback (IMPÉRATIF)

Le HTML se construit à partir de **deux summaries produits en amont** — un **obligatoire**, l'autre **conditionnel avec fallback PDF** :

### 1. `AA summary extract.txt` — TOUJOURS lu (source unique pour le fond client)

Produit par `dossier-extract`, structuré en **5 sections miroir du classement P1-P5 de `/dossier-rename`** :

- **§1 (P1 Porteurs)** — état civil, coordonnées emprunteurs (1.1-1.2), entités morales signataires
- **§2 (P2 Charges & patrimoine détenu)** — adresse & logement (2.1), crédits en cours personnels (2.2), charges récurrentes foyer (2.3), patrimoine immobilier détenu (2.4), tiers (2.5)
- **§3 (P3 Revenus & fiscal)** — revenus par emprunteur (3.1), synthèse foyer (3.2), analyse bilancielle si pro (3.3)
- **§4 (P4 Comptes & épargne)** — comptes (4.1), épargne (4.2), circuit financier (4.3), analyse forensique 13 catégories dont PNB (4.4.1-4.4.13)
- **§5 (P5 Projet)** — bien (5.1), DPE (5.2), dates clés (5.3), travaux (5.4), estimations locatives (5.5), éloignement professionnel (5.6)

**Le HTML ne lit JAMAIS directement les PDF du fond client** (bulletins, relevés, IRPP, CNI, compromis, DPE, devis, titres de propriété, avis d'imposition…). Ces documents ont déjà été lus et structurés par `dossier-extract`. Si une donnée manque dans le summary, la reporter comme "À compléter" — ne pas aller la chercher dans les PDF.

### 2. `AA summary simulation.txt` — lu SI PRÉSENT (source unique pour le montage financier)

Produit par `dossier-extract-simulation`, il contient en **§0 Données brutes DDP** la capture exhaustive de la DDP Cifacil / ALTO : plan de financement détaillé (§0.1), tableau d'amortissement (§0.2), frais détaillés (§0.3), taux/TAEG/coût total (§0.4), commentaires banquier (§0.5), conditions suspensives (§0.6). C'est **la source unique** pour tout ce qui est montage financier dans le HTML dès qu'il existe.

### ⚖ Règle du switch — décision au démarrage du skill

**Première chose à faire** en entrant dans le skill : vérifier la présence de `AA summary simulation.txt` dans le dossier client.

- **Si présent** → **mode SUMMARY (100%)** : le HTML est construit exclusivement à partir de `AA summary extract.txt` + `AA summary simulation.txt §0`. **Aucune lecture directe** de DDP Cifacil, ALTO, ni de tout autre PDF du dossier. Les CAS 1 / 2 / 3 de l'onglet Financement ci-dessous sont **inactifs**.
- **Si absent** → **mode PDF (fallback)** : comportement historique. Le HTML lit `AA summary extract.txt` pour le fond client, puis va chercher DDP Cifacil et/ou ALTO directement dans le dossier pour le montage financier, en suivant les CAS 1 / 2 / 3 de l'onglet Financement. Tracer ce choix en tête de la TodoList : « Mode PDF — `AA summary simulation.txt` absent ».

Cette séparation garantit : pas de double lecture (performance), pas d'incohérence entre extract et HTML (fiabilité), et un summary qui sert de source de vérité unique dès qu'il a été produit.

---

## Vue d'ensemble du workflow

Le workflow se déroule en 4 étapes. Suis-les dans l'ordre.

> **Étape 1 — Renommage & classement des pièces** : utiliser le skill **`dossier-rename`** (conventions P1-P5, formats enrichis biens immobiliers, conversion images en PDF, détection doublons).

> **Étape 2 — Extraction & analyse des documents** : utiliser le skill **`dossier-extract`** (lecture pdfplumber, calcul des revenus par profil A→F, collecte coordonnées, analyse forensique 13 catégories, circuit financier). Produit `AA summary extract.txt`.

> **Étape 2 bis (recommandée dès qu'une DDP/ALTO est dispo) — Capture du montage** : utiliser le skill **`dossier-extract-simulation`**. Produit `AA summary simulation.txt` avec le §0 "Données brutes DDP" que ce skill consommera. C'est cette étape qui bascule `/dossier-html` en **mode SUMMARY** (plus propre, plus rapide, plus sûr). Si elle est sautée, `/dossier-html` tombe en **mode PDF fallback** (lecture directe DDP/ALTO).

### Étape 2.5 — Questions systématiques avant génération HTML

**AVANT de commencer la génération du HTML**, poser ces questions au courtier via `AskUserQuestion` si l'information n'est pas déjà disponible dans l'EXTRACTION_SUMMARY ou les documents :

1. **Assurance emprunteur** : « Les assurances sont-elles en **groupe** (contrat banque) ou en **délégation** (assureur externe) ? » — Si délégation : demander le nom de l'assureur, les taux par emprunteur et la quotité. Si groupe : reprendre les taux depuis `AA summary simulation.txt §0.4` (mode SUMMARY) ou depuis la DDP Cifacil directement (mode PDF).

> **Rappel** : Assurance groupe = contrat collectif proposé par la banque prêteuse (tarif mutualisé, mise en place rapide). Assurance délégataire = contrat individuel souscrit auprès d'un assureur externe (souvent moins cher, loi Lagarde/Lemoine, la banque doit accepter si garanties équivalentes). Cette distinction impacte le coût total du crédit et la mensualité.

2. **Revenus intérimaire < 2 ans** : si l'EXTRACTION_SUMMARY identifie un emprunteur intérimaire avec ancienneté < 2 ans, poser OBLIGATOIREMENT la question : « M./Mme [NOM] est intérimaire depuis [date] (< 2 ans). En norme bancaire stricte, ses revenus ne sont pas retenus (0 €). La DDP Cifacil a été construite avec ses revenus à [montant]. Quel choix pour le HTML : (a) Porter ses revenus dans les onglets banque (argumentation, cohérent avec la DDP déposée) ou (b) Mettre ses revenus à 0 € partout (norme stricte) ? »

> **Règle DDP** : la DDP Cifacil prend les revenus qu'on lui saisit — elle n'applique PAS la règle des 2 ans intérim. Les chiffres de la DDP ne sont donc PAS une source fiable pour les revenus d'un intérimaire < 2 ans. Ne JAMAIS utiliser les revenus DDP comme justification pour porter les revenus de l'intérimaire. C'est le courtier qui décide, pas la DDP.

### Étape 3 — Construction du dossier HTML

Crée un fichier HTML unique nommé `AA [NOM] [nom]-dossier AAAA-MM-JJ.html` (avec la date du jour de génération, ex: `AA PERRAIS perrais-dossier 2026-04-10.html`) en utilisant le **template CSS/JS intégré** ci-dessous. Remplis les placeholders `{{...}}` avec les données extraites. La date en suffixe permet d'identifier instantanément la version la plus récente du dossier quand plusieurs générations coexistent dans le même répertoire.

#### Template HTML — Structure obligatoire

Le squelette HTML DOIT respecter cette structure exacte. **Ne pas inventer de classes CSS, ne pas modifier la hiérarchie des divs.**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dossier {{NOM1}} / {{NOM2}} — Groupe Apolline</title>
<style>
:root {
  --navy: #1B3B6F;
  --gold: #E8A020;
  --cream: #F7F8FC;
  --green: #1A7A3F;
  --green-bg: #EDFAF3;
  --red: #C0392B;
  --red-bg: #FDF2F2;
  --orange: #B07010;
  --orange-bg: #FFF4E0;
  --gray: #6B7A8D;
  --text: #1A2A3A;
  --border: #E4E8F0;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: var(--cream); color: var(--text); line-height: 1.6; }

/* Header */
.header { background: white; padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid var(--gold); box-shadow: 0 2px 8px rgba(27,59,111,0.08); }
.logo { font-size: 24px; font-weight: 700; color: var(--navy); }
.logo span { display: block; font-size: 11px; color: var(--gray); font-weight: 400; letter-spacing: 0.3px; }
.header-info { text-align: right; font-size: 12px; color: var(--gray); line-height: 1.5; }

/* Tabs — fond navy */
.tabs { display: flex; background: var(--navy); padding: 0 40px; gap: 0; }
.tab { padding: 14px 28px; cursor: pointer; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.65); border-bottom: 3px solid transparent; transition: all 0.2s; white-space: nowrap; }
.tab:hover { color: white; background: rgba(255,255,255,0.08); }
.tab.active { color: white; font-weight: 600; border-bottom-color: var(--gold); background: rgba(255,255,255,0.05); }

/* Content */
.content { max-width: 960px; margin: 0 auto; padding: 30px 20px; }
.tab-content { display: none; }
.tab-content.active { display: block; }

/* Badge date */
.date-badge { display: inline-block; background: var(--gold); color: white; font-size: 13px; font-weight: 600; padding: 8px 20px; border-radius: 6px; margin-bottom: 24px; }

/* Cards */
.card { background: white; border-radius: 12px; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(27,59,111,0.06); border: 1px solid var(--border); }
.card h2 { font-size: 17px; color: var(--navy); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid var(--gold); }
.card h3 { font-size: 15px; color: var(--navy); margin: 18px 0 10px; }

/* KPI Row — flexible grid */
.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 28px; }
.kpi { background: white; border-radius: 12px; padding: 24px 16px; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 6px rgba(27,59,111,0.06); transition: box-shadow 0.2s; }
.kpi:hover { box-shadow: 0 4px 12px rgba(27,59,111,0.12); }
.kpi .value { font-size: 30px; font-weight: 700; color: var(--navy); line-height: 1.2; margin-bottom: 6px; }
.kpi .label { font-size: 11px; font-weight: 700; color: var(--gray); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; }
.kpi .detail { font-size: 11px; color: var(--gray); font-weight: 400; line-height: 1.4; }
.kpi.green .value { color: var(--green); }
.kpi.gold .value { color: var(--gold); }
.kpi.red .value { color: var(--red); }

/* Revenue cards */
.revenue-card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border-left: 4px solid var(--navy); box-shadow: 0 1px 4px rgba(27,59,111,0.06); }
.revenue-card .name { font-size: 16px; font-weight: 700; color: var(--navy); margin-bottom: 4px; }
.revenue-card .role { font-size: 13px; color: var(--gray); margin-bottom: 14px; }
.revenue-card table { width: 100%; border-collapse: collapse; }
.revenue-card td { padding: 6px 10px; font-size: 13px; border-bottom: 1px solid #e8ecf4; }
.revenue-card td:first-child { color: var(--gray); }
.revenue-card td:last-child { font-weight: 600; text-align: right; }
.note-positive { background: var(--green-bg); color: var(--green); padding: 10px 16px; border-radius: 8px; font-size: 13px; margin-top: 12px; border-left: 3px solid var(--green); }

/* Tables */
table.pieces { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.pieces th { background: var(--navy); color: white; padding: 10px 14px; font-size: 12px; text-align: left; font-weight: 600; }
table.pieces td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid var(--border); }
table.pieces tr:nth-child(even) { background: var(--cream); }
.status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.status.ok { background: var(--green-bg); color: var(--green); }
.status.partiel { background: var(--orange-bg); color: var(--orange); }
.status.manquant { background: var(--red-bg); color: var(--red); }

/* Signature (réservée aux notes internes / contenus signés) */
.signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border); }
.signature .name { font-weight: 700; color: var(--navy); font-size: 15px; }
.signature .title { color: var(--gray); font-size: 13px; }

/* Alerts */
.alert { padding: 14px 18px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; line-height: 1.7; }
.alert.high { background: var(--red-bg); border-left: 4px solid var(--red); color: #7A1F1F; }
.alert.medium { background: var(--orange-bg); border-left: 4px solid var(--orange); color: #7A4F10; }
.alert.low { background: var(--green-bg); border-left: 4px solid var(--green); color: #145A2E; }
.alert.info { background: #EBF5FF; border-left: 4px solid #2C7BE5; color: #1A3A5C; }

/* Internal notes */
.badge-internal { display: inline-block; background: var(--orange-bg); color: var(--orange); font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px; }
.fiche-table { width: 100%; border-collapse: collapse; }
.fiche-table td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: top; }
.fiche-table td:first-child { font-weight: 600; color: var(--navy); width: 200px; white-space: nowrap; }

/* Section headers (forensic) */
.section-header { display: flex; align-items: center; gap: 8px; margin: 24px 0 12px; }
.section-header .icon { width: 28px; height: 28px; background: var(--navy); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.section-header h3 { color: var(--navy); font-size: 15px; margin: 0; }

/* Comptes bancaires */
.compte-list { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.compte-item { background: var(--cream); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
.compte-item .banque { font-weight: 700; color: var(--navy); font-size: 13px; }
.compte-item .type { font-size: 12px; color: var(--gray); }
.compte-item .titulaire { font-size: 12px; color: var(--text); margin-top: 4px; }

/* Responsive */
@media (max-width: 768px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .tabs { overflow-x: auto; padding: 0 16px; }
  .content { padding: 0 12px; margin: 16px auto; }
  .header { flex-direction: column; text-align: center; gap: 10px; padding: 16px 20px; }
  .header-info { text-align: center; }
}
@media print {
  .tabs { display: none; }
  .tab-content { display: block !important; page-break-inside: avoid; }
}
</style>
</head>
<body>

<!-- EN-TÊTE -->
<div class="header">
  <div class="logo">Apolline <span>Crédit & Habitat</span></div>
  <div class="header-info">
    Dossier {{NOM1}} / {{NOM2}}<br>
    {{Prénom1}} {{NOM1}} & {{Prénom2}} {{NOM2}}<br>
    {{Type projet}} — {{Adresse du bien}}
  </div>
</div>

<!-- ONGLETS -->
<div class="tabs">
  <div class="tab active" onclick="switchTab('etatcivil')">👤 État civil</div>
  <div class="tab" onclick="switchTab('revenus')">💰 Revenus</div>
  <div class="tab" onclick="switchTab('patrimoine')">🏠 Patrimoine</div>
  <div class="tab" onclick="switchTab('projet')">🏗️ Projet</div>
  <div class="tab" onclick="switchTab('financement')">💶 Financement</div>
  <div class="tab" onclick="switchTab('pieces')">📋 Pièces à fournir</div>
  <div class="tab" onclick="switchTab('notes')">🔒 Notes internes</div>
</div>

<!-- CONTENU DES ONGLETS -->
<!-- RÈGLE CRITIQUE : chaque onglet suit ce pattern exact : -->
<!-- <div id="xxx" class="tab-content"> -->
<!-- <div class="content"> -->
<!--   ... contenu de l'onglet ... -->
<!-- </div> -->
<!-- </div> -->
<!-- Le <div class="content"> est TOUJOURS à l'intérieur de chaque tab-content -->
<!-- Il n'y a PAS de wrapper .content global autour de tous les onglets -->

<!-- ... chaque onglet : etatcivil, revenus, patrimoine, projet, financement, pieces, notes ... -->

<script>
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('.tab').forEach(t => {
    if (t.getAttribute('onclick') === "switchTab('" + tabId + "')") t.classList.add('active');
  });
}
</script>

</body>
</html>
```

#### Règles structurelles IMPÉRATIVES

1. Chaque `<div class="tab-content">` contient son propre `<div class="content">` wrapper — il n'y a PAS de wrapper `.content` global autour de tous les onglets
2. Les onglets `.tab-content` sont au niveau racine du `<body>`, juste après `<div class="tabs">`
3. Les KPI utilisent des styles inline dans une grille (`display:grid; grid-template-columns:repeat(N,1fr); gap:14px`)
4. NE PAS inventer de classes CSS non listées dans le template. Utiliser UNIQUEMENT les classes définies ci-dessus

Ce fichier contient **7 onglets** dans cet ordre précis :

**Règle importante sur les vignettes KPI :** les onglets de données (État civil, Revenus, Patrimoine, Pièces à fournir, Notes internes) doivent TOUS commencer par un bandeau de vignettes KPI (4 vignettes en grille `kpi-grid`) pour donner un résumé visuel immédiat.

Contenu des vignettes KPI par onglet :
- **État civil** : Emprunteur 1 (prénom + NOM, âge), Emprunteur 2 (idem), Régime matrimonial, Enfants à charge (nombre + âges). ⚠ Les vignettes affichent le **premier prénom + NOM** (pas "Mme" / "M."). Si le prénom comporte un trait d'union (ex: Jean-Pierre), le garder entier. Ne PAS afficher les 2e/3e prénoms. Ne PAS afficher la profession — c'est l'état civil, pas les revenus.
- **Revenus** : Revenus M. (+ badges CDI/CDD, PRIVÉ/PUBLIC, %), Revenus Mme (idem), RFR N-1, RFR N-2
- **Patrimoine** : Épargne identifiée, Apport personnel, Épargne résiduelle, Patrimoine net. Le **Patrimoine net** = valeur du patrimoine mobilier (épargne) + immobilier (estimation bien si propriétaire) − CRD total (prêts immo + conso + dettes). Couleur : vert si positif, orange si faiblement négatif, rouge si fortement négatif. Détail en sous-texte (ex: "Épargne 5 157 € − CRD 6 424 €").
- **Projet** : 2 lignes de 3 vignettes chacune.
  - Ligne 1 : Type de bien (🏠 + description), Classe énergétique (lettre DPE colorée), Travaux (montant devis)
  - Ligne 2 : Signature promesse/compromis (date), Date limite CS (date, rouge si proche), Expiration promesse / Réalisation vente (date)
  - Sources des dates : promesse de vente, compromis, avenant. Utiliser "CS" (condition suspensive), pas "CSF".
- **Pièces à fournir** : Reçues (vert), Partielles (orange), Manquantes (rouge), Taux de complétion (or)
- **Notes internes** : pas de vignettes KPI classiques — cet onglet utilise le **Score de confiance bancaire** (voir Section 6 des Notes internes) comme visuel principal de synthèse, avec les alertes détaillées en dessous

#### Onglet 1 — "👤 État civil" (actif par défaut)

Cet onglet présente les **données personnelles et d'identité** des emprunteurs. C'est une fiche d'état civil claire et lisible.

Structure (deux fiches côte à côte dans une grille 2 colonnes) :

Pour **chaque emprunteur**, afficher ces champs dans une `class="fiche-table"` :
- **Nom** : nom de famille en majuscules, en gras
- **Prénoms** : prénom usuel en gras, puis les autres prénoms
- **Date de naissance** : JJ/MM/AAAA à [Ville] ([Département])
- **Âge** : calculé à la date du dossier, en gras
- **Nationalité** : française, ou autre si identifiée dans les documents (CNI, passeport)
- **Situation matrimoniale** : marié(e) / pacsé(e) / concubinage / célibataire — mentionner le nom du conjoint/partenaire
- **Régime juridique** : communauté réduite aux acquêts / séparation de biens / communauté universelle / participation aux acquêts — ou "Sans objet (ni mariage, ni PACS)" si non marié et non pacsé
- **Divorce / union précédente** : détailler si divorcé(e) (date, pension alimentaire éventuelle). Si aucun : "Aucun". Si l'info n'est pas dans les documents : "À compléter"
- **Déclarations fiscales** : séparées ou communes, nombre de parts fiscales. Si rattaché aux parents : le mentionner

Puis en dessous des deux fiches :
- **Adresse(s)** : si adresse commune → une seule ligne. Si adresses séparées → une ligne par emprunteur. Mentionner le statut (locataire + loyer, propriétaire, hébergé(e) chez parents)
- **Enfant(s) à charge** : pour chaque enfant → prénom, âge (si connu), rattachement fiscal (parts). Si aucun enfant → "Aucun enfant à charge"

**Source des données** : EXTRACTION_SUMMARY, **§1 — PORTEURS DU PROJET (P1)** (sous-sections 1.1 Emprunteur 1, 1.2 Emprunteur 2, 1.3 Foyer, 1.4 Entités morales). Toutes les données d'identité (nom, prénoms, date de naissance, nationalité, situation matrimoniale, régime, enfants) ainsi que les coordonnées (tél/mail) ont été extraites par `dossier-extract` depuis les pièces d'identité, IRPP, compromis et bulletins. L'adresse actuelle et le statut logement sont en **§2.1 (P2)**. Ne PAS relire les PDF — utiliser exclusivement le summary. Si une donnée est marquée "À compléter" dans le summary, la reporter telle quelle en italique doré dans le HTML.

#### Onglet 2 — "💰 Revenus"

Cet onglet est **dédié exclusivement aux revenus** des emprunteurs. Il présente le détail des sources de revenus de chaque emprunteur, les calculs appliqués, et le total retenu par les banques.

Structure :

1. **Badge date** : bandeau or (ex: "Analyse des revenus — 25 mars 2026")

2. **Vignettes KPI** (grille 4 colonnes, `display:grid; grid-template-columns:repeat(4,1fr); gap:14px`) :
   - **Revenus M.** : revenu net mensuel retenu en gros (ex: "1 507 €"), sous-texte "Net mensuel retenu", puis **badges de statut** en dessous (margin-top:8px, flex row centré, gap 4px) :
     - Type de contrat : `CDI` = fond vert-bg texte vert | `CDD` = fond orange-bg texte orange
     - Secteur : `PRIVÉ` = fond vert-bg texte vert | `PUBLIC` = fond bleu clair (#EBF5FF) texte bleu (#2C7BE5)
     - Temps de travail : `100%`, `80%` etc. = fond cream, texte gris, bordure
     - Badges en 10px font-weight 700, padding 2px 8px, border-radius 3px
   - **Revenus Mme** : idem avec ses propres badges de statut
   - **RFR N-1** (revenus année précédente) : montant par emprunteur (M. et Mme sur deux lignes), sous-texte "Foyers fiscaux parents" si rattachés, ou "Foyer fiscal" sinon
   - **RFR N-2** (revenus année N-2) : idem
   Les RFR se trouvent sur les avis d'imposition (pièces P2 - IRPP). Si les emprunteurs sont rattachés au foyer fiscal de leurs parents (cas fréquent pour les jeunes primo-accédants), afficher le RFR du foyer parental et le mentionner. Chaque vignette : fond blanc, border-radius 10px, bordure `var(--border)`, ombre légère, texte centré. Titre en 11px uppercase gris, valeur en 26px navy bold (ou 16px si deux lignes M./Mme), sous-texte 11px gris.

3. **Une fiche revenus par emprunteur** (class `revenue-card`, bordure gauche navy) :
   - Nom de l'emprunteur en titre (`<h4>`)
   - **Badges de statut** (immédiatement sous le nom, dans un div flex row avec gap 8px) — ces badges doivent être visibles au premier coup d'oeil :
     - **Salarié(e) / Indépendant(e)** : fond navy, texte blanc (ex: `SALARIÉE`, `INDÉPENDANT`)
     - **Type de contrat** : CDI = fond vert-bg texte vert | CDD/Contractuel = fond orange-bg texte orange | Auto-entrepreneur = fond gold texte navy
     - **Secteur** : Public = fond bleu clair (#EBF5FF) texte bleu (#2C7BE5) | Privé = fond vert-bg texte vert
     - **Temps de travail** : fond cream, texte gris, bordure (ex: "100%", "80%")
   - Tableau détaillé selon le profil (voir les **Règles de calcul des revenus** ci-dessous) :
     - **Salarié CDI** : employeur, poste, temps de travail, ancienneté, net imposable des 3 derniers mois, moyenne retenue
     - **Profession libérale / BNC** : montants déclarés IRPP sur 2 ou 3 ans, moyenne annuelle ÷ 12
     - **Auto-entrepreneur (micro-BNC / micro-BIC)** : CA déclaré IRPP sur 2 ou 3 ans, abattement applicable, moyenne annuelle ÷ 12
     - **SELARL / exercice en société** : cumul BNC professionnels + rémunération gérant (art. 62) + éventuels salaires, issus des IRPP
     - **Intérimaire** : norme bancaire stricte — si intérim ≥ 2 ans continu : total revenus ÷ 36 mois ; si intérim < 2 ans : **revenus = 0 € retenu** (aléatoires). Afficher en rouge si < 2 ans.
     - **CDD avec diplôme élevé** : salaires déclarés IRPP sur 2 ou 3 ans, moyenne annuelle ÷ 12, justifié par le niveau d'études (ne s'applique PAS à l'intérim)
     - **Cumul salarié + indépendant** : détailler chaque source séparément puis total
   - **Tableau de méthodologie** (obligatoire) : pour chaque emprunteur dont le revenu est calculé sur la base des IRPP, afficher un tableau détaillé montrant le calcul année par année. Ce tableau rend le calcul transparent pour la banque. Structure :
     - Colonnes : Année fiscale | Régime | Montant déclaré | Source
     - Ligne de total : Somme ÷ nombre d'années ÷ 12 = revenu mensuel retenu
     - Indiquer clairement le régime fiscal (micro-BNC, BNC réel, micro-BIC, salaires…)
   - Note positive en vert (class `note-positive`) expliquant pourquoi le profil est intéressant pour les banques

   > **GARDE-FOU HTML — Intérim < 2 ans** : si l'EXTRACTION_SUMMARY indique un emprunteur intérimaire avec ancienneté < 2 ans :
   > 1. **Question obligatoire** (Étape 2.5) : demander au courtier s'il veut porter les revenus ou les mettre à 0 €. Ne JAMAIS décider seul. La DDP Cifacil n'est PAS une source fiable pour cette décision (elle prend ce qu'on lui donne).
   > 2. **Si le courtier choisit de porter les revenus** : onglets bancaires = revenus IRPP, badge `INTÉRIM` orange, alerte `class="alert info"` factuelle. Notes internes = vérité bancaire (0 € norme stricte, endettement recalculé, risque).
   > 3. **Si le courtier choisit 0 €** : onglets bancaires = 0 €, badge `INTÉRIM < 2 ANS` rouge, KPI rouge. Notes internes = même analyse + argumentation possible.
   > 4. Dans les deux cas, les Notes internes DOIVENT contenir l'analyse complète avec les deux scénarios.

---

> **Règles de calcul des revenus par profil (A→F)** : voir le skill **`dossier-extract`** pour le détail des méthodologies CDI, BNC, SELARL, auto-entrepreneur, **intérimaire (règle des 2 ans)**, CDD diplômé, foncier/LMNP, et les tableaux de méthodologie IRPP obligatoires.

---

3. **Autres revenus du foyer** (optionnel — uniquement si pertinent) :
   Tableau (`class="pieces"`) avec colonnes : Source, Montant/mois, Retenu banque (badge coloré).

   Sources à rechercher systématiquement dans les pièces du dossier :
   - **Pension alimentaire reçue** : jugement → montant, payeur, date jugement. Badge "Oui si régulière"
   - **Allocations CAF** : relevé CAF → AF, CF, ASF, prime d'activité, AAH… Chaque ligne séparée. Badge "Variable selon banques" (sauf AL/APL = "Non, supprimée si achat")
   - **Revenus fonciers** : rechercher dans :
     - IRPP (déclaration 2044 ou micro-foncier 4BE) → loyers déclarés, charges déduites, résultat foncier
     - Bail de location → loyer mensuel, adresse du bien, locataire
     - Bien en RL (résidence locative) détecté dans le patrimoine → se poser la question : sera-t-il loué ? Si oui, estimer le loyer potentiel
     - Badge "Oui (70 % du loyer brut)" — c'est la norme bancaire courante (abattement 30 % pour charges)
   - **Revenus LMNP** : rechercher dans les IRPP (BIC non professionnel, régime micro ou réel). Badge "Variable selon banques"
   - **Revenus mobiliers** : dividendes, intérêts, revenus de capitaux mobiliers visibles sur IRPP (2DC, 2TR). Badge "Non (sauf montant significatif récurrent)"
   - Ne PAS inclure les ARE (France Travail) dans ce tableau — revenus temporaires non retenus.

4. **Tableau récapitulatif "Total revenus retenus"** : une ligne par emprunteur + ligne total foyer en gras avec bordure or. Ajouter une note explicative sur la méthode de calcul utilisée pour chaque emprunteur (référence au profil A/B/C/D/E ci-dessus).

5. **📊 Analyse bilancielle** (OBLIGATOIRE si le dossier contient des bilans comptables — EARL, SELARL, SAS, BNC réel, EURL, auto-entrepreneur au réel, SCI…) :

   Cette section transforme les données brutes des bilans en **lecture banquier**. Le banquier ne lit pas un bilan comme un comptable — il cherche la capacité de remboursement, la soutenabilité de la dette, et la trajectoire. Cette analyse doit lui donner ces réponses en un coup d'œil.

   **Structure HTML** : un `div.card` avec `border-left:4px solid var(--gold)`, contenant deux sous-sections (SIG puis Lecture banquier).

   **Déclenchement** : dès qu'au moins un bilan ou une liasse fiscale (2031, 2035, 2033, 2050-2059, plaquette comptable) est disponible dans le dossier. Si seuls les IRPP sont disponibles (pas de bilan), NE PAS générer cette section — se limiter au tableau de méthodologie IRPP standard.

   ---

   **5.A — Soldes Intermédiaires de Gestion (SIG) — Tableau comparatif multi-exercices**

   Tableau `class="pieces"` avec colonnes : Indicateur | Exercice N-2 | Exercice N-1 | Exercice N | Évolution N-1→N

   Lignes du tableau (adapter au type de structure) :

   **Pour EARL / Exploitation agricole :**
   | Indicateur | Description | Source bilan |
   |---|---|---|
   | **Chiffre d'affaires net** | Production vendue + stockée + immobilisée | Compte de résultat, ligne "Production de l'exercice" ou "Chiffre d'affaires" |
   | **Marge brute** | CA − achats marchandises − variation stocks | Différence production − consommations intermédiaires |
   | **Valeur ajoutée** | Marge brute − services extérieurs (sous-traitance, locations, assurances, honoraires) | VA = Production − Consommations intermédiaires |
   | **EBE (Excédent Brut d'Exploitation)** | VA − charges de personnel − impôts & taxes + subventions d'exploitation | Ligne clé : capacité à générer du cash avant charges financières |
   | **Résultat d'exploitation** | EBE − dotations aux amortissements − provisions + reprises | Performance opérationnelle pure |
   | **Résultat courant avant impôts** | Résultat d'exploitation + produits financiers − charges financières | Inclut le coût de la dette |
   | **Résultat net** | Résultat courant ± résultat exceptionnel − impôts | Ligne finale du compte de résultat |
   | **CAF (Capacité d'Autofinancement)** | Résultat net + dotations amortissements + provisions nettes | = cash réellement dégagé par l'activité |

   **Pour BNC réel / Profession libérale :**
   | Indicateur | Description |
   |---|---|
   | **Recettes encaissées** | Total des honoraires |
   | **Charges professionnelles** | Loyer cabinet, matériel, cotisations, assurances pro |
   | **Bénéfice net comptable** | Recettes − charges |
   | **Cotisations sociales (URSSAF/CIPAV/CARPIMKO…)** | Charges sociales obligatoires |
   | **Revenu disponible avant IR** | Bénéfice − cotisations |

   **Pour SAS / SARL / SELARL / EURL :**
   | Indicateur | Description |
   |---|---|
   | **Chiffre d'affaires net** | Ventes + prestations |
   | **Marge brute** | CA − coût des achats |
   | **EBE** | VA − personnel − impôts + subventions |
   | **Résultat d'exploitation** | EBE − amortissements |
   | **Résultat net** | Après charges financières et IS |
   | **CAF** | Résultat net + amortissements |
   | **Rémunération dirigeant** | Ligne spécifique (art. 62 ou salaires selon statut) |
   | **Dividendes distribués** | Si IS : montant des dividendes versés |

   **Colonne "Évolution N-1→N"** : calculer le % d'évolution et afficher avec un badge coloré :
   - Hausse > 20 % = badge vert `var(--green)` avec flèche ↑
   - Hausse 0–20 % = badge navy avec flèche ↗
   - Baisse 0–20 % = badge orange avec flèche ↘
   - Baisse > 20 % = badge rouge avec flèche ↓

   **Règle de présentation** : arrondir tous les montants à l'euro (pas de centimes). Afficher en gras les lignes EBE, Résultat net et CAF — ce sont les 3 indicateurs que le banquier regarde en premier.

   ---

   **5.B — Lecture banquier — Ratios de solvabilité et capacité de remboursement**

   Tableau `class="fiche-table"` avec colonnes : Ratio | Valeur | Norme bancaire | Verdict

   **Ratios obligatoires (tous types de structures) :**

   | Ratio | Formule | Norme | Code couleur |
   |---|---|---|---|
   | **Taux d'endettement professionnel** | Annuités emprunts pro ÷ EBE × 100 | < 50 % = sain, 50-70 % = tendu, > 70 % = critique | Vert / Orange / Rouge |
   | **Capacité de remboursement (en années)** | Dettes financières totales ÷ CAF | < 5 ans = sain, 5-7 ans = acceptable, > 7 ans = tendu | Vert / Orange / Rouge |
   | **Taux de marge nette** | Résultat net ÷ CA × 100 | > 10 % = bon, 5-10 % = correct, < 5 % = fragile | Vert / Navy / Orange |
   | **Ratio EBE / CA** | EBE ÷ CA × 100 | > 25 % = solide, 15-25 % = correct, < 15 % = fragile | Vert / Navy / Orange |
   | **Fonds de roulement net** | Capitaux permanents − Actif immobilisé net | Positif = sain, négatif = alerte | Vert / Rouge |
   | **BFR (Besoin en Fonds de Roulement)** | Stocks + Créances − Dettes fournisseurs | Comparer à N-1, forte hausse = tension trésorerie | Navy / Orange |
   | **Trésorerie nette** | FR − BFR | Positif = confortable, négatif = dépendance bancaire | Vert / Rouge |

   **Ratios spécifiques EARL / Exploitation agricole :**

   | Ratio | Formule | Utilité banquier |
   |---|---|---|
   | **EBE / ha** | EBE ÷ surface exploitée | Benchmark sectoriel (comparer aux moyennes CERFRANCE) |
   | **Prélèvements privés / EBE** | (Compte courant N-1 − Compte courant N + Résultat net) ÷ EBE | < 70 % = soutenable, > 100 % = l'exploitant vit au-dessus de ses moyens |
   | **Évolution du CCA (Compte Courant d'Associé)** | CCA N vs CCA N-1 | Baisse forte = prélèvements excessifs, hausse = capitalisation |
   | **Annuités / EBE** | Total annuités emprunts ÷ EBE × 100 | < 50 % = capacité de remboursement OK |

   **Ratios spécifiques SAS / SARL :**

   | Ratio | Formule | Utilité banquier |
   |---|---|---|
   | **Rémunération + dividendes / Résultat net** | (Rémun. dirigeant + dividendes) ÷ Résultat net | > 100 % = la société ne capitalise pas |
   | **Capitaux propres / Total bilan** | Capitaux propres ÷ Total bilan × 100 | > 30 % = sain, < 20 % = sous-capitalisée |
   | **Gearing (levier financier)** | Dettes financières ÷ Capitaux propres | < 1 = sain, > 2 = très endetté |

   **Colonne "Verdict"** : pour chaque ratio, un badge coloré avec un mot-clé :
   - 🟢 **Solide** / **Sain** / **Confortable** = vert
   - 🔵 **Correct** / **Acceptable** = navy
   - 🟡 **Tendu** / **À surveiller** = orange
   - 🔴 **Critique** / **Alerte** = rouge

   ---

   **5.C — Synthèse bilancielle — Encadré argumentaire**

   Encadré `class="note-positive"` (fond vert) si la lecture est globalement positive, ou `class="alert medium"` (fond orange) si mitigée. Contenu :

   - **Phrase d'accroche** en gras : résumer en 1 ligne la santé financière de la structure (ex: "L'EARL K. Worobeck affiche une trajectoire de croissance exceptionnelle avec un EBE en hausse de 139 % sur le dernier exercice.")
   - **3 à 5 points clés** à retenir pour le banquier, chiffrés, avec le contexte :
     - Capacité de remboursement (en années)
     - Évolution du CA et de l'EBE
     - Niveau de prélèvements vs capacité
     - Trésorerie nette
     - Points spécifiques au secteur (rendement/ha, saisonnalité, aides PAC…)
   - **Mention de l'abattement fiscal** si applicable (JA 50 %, ZRR, etc.) avec impact sur le revenu imposable futur

   ---

   **5.D — Mise en garde méthodologique** (petit texte gris 11px en bas de section)

   Texte standard : "Analyse réalisée sur la base des bilans et liasses fiscales communiqués. Les bilans provisoires (projets) sont signalés — les ratios définitifs peuvent différer. Les comparaisons sectorielles sont indicatives (source : moyennes CERFRANCE / MSA publiées)."

   ---

   **Règle d'adaptation** : la section s'adapte automatiquement au type de structure :
   - Si **EARL / exploitation agricole** : SIG agricoles + ratios EARL (EBE/ha, CCA, annuités/EBE)
   - Si **BNC réel** : SIG simplifiés (recettes/charges/bénéfice) + ratios basiques (marge nette, évolution recettes)
   - Si **SAS / SARL / SELARL** : SIG complets + ratios société (gearing, capitaux propres, rémunération/résultat)
   - Si **auto-entrepreneur au réel** : même traitement que BNC
   - Si **SCI** : focus sur les revenus fonciers, le CRD, et le cash-flow net après charges
   - Si **plusieurs structures** (ex: EARL + SAS) : une sous-section par structure, puis un encadré de synthèse consolidée

   **Règle de ton** : cette section est visible par le banquier. Rester **factuel et valorisant**. Les alertes graves (prélèvements excessifs, trésorerie négative, gearing critique) sont mentionnées dans les ratios mais sans commentaire alarmiste — le banquier lira les chiffres lui-même. Les analyses critiques détaillées vont dans les Notes internes.

**Règle importante** : cet onglet est un document CLIENT (visible par le banquier). Les revenus doivent être présentés de façon **valorisante**. Les signaux d'alerte (baisse de CA, ARE, irrégularité) ne figurent PAS ici — ils vont dans les notes internes. ⚠ NE JAMAIS afficher d'alerte de type "Intérim < 2 ans = 0 € retenu" ou toute explication de règle bancaire défavorable dans cet onglet. C'est donner au banquier la cartouche pour refuser. Les règles de calcul défavorables sont expliquées dans les notes internes uniquement.

#### Onglet 3 — "🏠 Patrimoine"

Cet onglet dresse le bilan patrimonial complet du foyer.

Structure :

1. **Badge date** : bandeau or (ex: "Bilan patrimonial — 26 mars 2026")

2. **Vignettes KPI** (grille 4 colonnes, `display:grid; grid-template-columns:repeat(4,1fr); gap:14px`) :
   - **Épargne identifiée** : total de l'épargne repérée (Livret A, PEL, Livret Jeune…), sous-texte détaillant les supports
   - **Apport personnel** : montant inscrit au plan de financement, en vert si > 10 % du projet
   - **Épargne résiduelle** : solde estimé post-apport (en orange si incertain / "À préciser")
   - **Patrimoine net** : valeur du patrimoine mobilier (épargne) + immobilier (estimation bien si propriétaire) − CRD total (prêts immo + conso + dettes). Couleur : vert si positif, orange si faiblement négatif, rouge si fortement négatif. Détail en sous-texte (ex: "Épargne 5 157 € + Immo 120 000 € − CRD 93 605 €"). Si des valeurs sont inconnues (titres de propriété non fournis, estimation en cours), afficher "À calculer" en gris avec le détail des CRD connus en sous-texte.

Il se structure ensuite en 5 blocs :

1. **Patrimoine immobilier** (`class="card"`) :
   - Tableau `class="fiche-table"` avec une ligne par bien détenu :
     - Description du bien (type, localisation)
     - Date d'acquisition
     - Valeur estimée actuelle
     - Mode de détention (pleine propriété, indivision, SCI…)
     - Encours de crédit restant (si applicable)
   - Si aucun bien : mentionner "Primo-accédants — aucun patrimoine immobilier existant"
   - Note positive si primo-accédant : "Primo-accédants : éligibles aux dispositifs PTZ et aux aides primo (selon conditions de ressources)"

2. **Patrimoine financier** (`class="card"`) :
   - Tableau avec une ligne par support d'épargne :
     - Type de compte (Livret A, LDDS, LEP, PEL, CEL, Assurance-vie, PEA, Compte-titres, Crypto…)
     - Banque / Établissement
     - Titulaire
     - Solde constaté (date du relevé)
   - Ligne récapitulative en gras : **Épargne totale du foyer**
   - Note positive valorisant la capacité d'épargne (ex : "L'épargne constituée témoigne d'une gestion budgétaire saine et d'une capacité à mettre de côté chaque mois")

   **Sous-règle — Épargne dormante sur compte courant :**
   Par défaut, un compte courant (C/C) n'est PAS de l'épargne et son solde n'est pas comptabilisé dans le patrimoine financier. **Exception** : si le solde de fin de mois d'un C/C reste significatif et stable sur les 3 mois de relevés analysés — c'est-à-dire que le client ne le consomme pas d'un mois sur l'autre malgré les flux entrants/sortants — alors ce **plancher récurrent** constitue de l'épargne dormante de fait (trésorerie disponible structurelle que le client laisse "dormir" sur son C/C au lieu de la placer sur un livret).
   - **Critères d'intégration** : (1) le solde fin de mois est récurrent et stable sur 3 mois (pas de tendance fortement baissière), (2) le montant est significatif (pas un simple float de transit de quelques centaines d'euros), (3) le solde persiste APRÈS les virements de consommation et d'épargne du mois.
   - **Si les critères sont remplis** : ajouter une ligne dans le tableau d'épargne avec le type "Épargne dormante C/C" + le numéro du compte, le plancher récurrent constaté (= le minimum des 3 soldes fin de mois), et une **note explicative obligatoire** en italique sous le tableau : *"Ce montant correspond au solde résiduel récurrent constaté en fin de mois sur le C/C N°XXXX sur les 3 derniers relevés (jan : X €, fév : X €, mars : X €). Le client maintient structurellement cette trésorerie disponible sans la consommer, ce qui justifie son intégration comme épargne de fait."*
   - **Si les critères ne sont PAS remplis** (solde faible, volatile, ou en baisse marquée) : ne rien ajouter — le C/C reste un pur compte de transit.
   - **Cas fréquent** : comptes courants en devise étrangère (CHF, GBP…) de frontaliers où le salaire arrive et repart en grande partie. Vérifier si un matelas résiduel stable subsiste après les changes et virements.

3. **Crédits et engagements en cours** (`class="card"`) :
   - ⚠ **RÈGLE HCSF — SÉPARATION PRO / PERSO** : ne lister ici que les **crédits personnels** de l'emprunteur (immobilier, consommation, auto, revolving…). Les dettes professionnelles (emprunts EARL, SAS, SELARL, SCM, prêts professionnels BPI, etc.) ne sont **JAMAIS** incluses dans le calcul du taux d'endettement HCSF. Ce sont des dettes de la personne morale, pas de la personne physique — même si l'emprunteur est gérant et unique associé. Ne jamais créer de bloc "Crédits EARL" ou "Crédits professionnels" dans l'onglet Patrimoine. Les dettes pro sont analysées dans la section Analyse bilancielle (onglet Revenus) où elles servent à calculer les ratios de solvabilité de la structure (endettement pro/EBE, annuités/EBE, etc.), pas l'endettement personnel.
   - Tableau avec une ligne par crédit **personnel** :
     - Type (immobilier, consommation, auto, revolving…)
     - Établissement prêteur
     - Mensualité
     - Capital restant dû (CRD) — voir règle ci-dessous
     - Date de fin
     - Remboursement anticipé prévu ? (oui/non)

   - ⛔ **RÈGLE CRD** : reprendre le CRD depuis `AA summary extract.txt` **§2.2 (Crédits en cours)**, qui indique pour chaque crédit la source utilisée (TA exact, ou CRD estimé ≈). Le HTML ne relit PAS les tableaux d'amortissement des crédits existants — c'est `dossier-extract` qui a déjà appliqué la règle de priorité (TA > estimation). Si une source de montage (§0 du summary simulation en mode SUMMARY, ou DDP Cifacil page 2 en mode PDF) contient un CRD qui diffère du summary extract, le signaler dans les notes internes.
   - Ligne récapitulative : **Total mensualités en cours**
   - Si aucun crédit : "Aucun crédit en cours — situation idéale pour l'obtention d'un financement"
   - Si crédits en cours : note neutre indiquant qu'ils seront pris en compte dans le calcul de la capacité d'emprunt

4. **Comptes bancaires identifiés** (`class="card"`) :
   - ⚠ Affichage **vertical** (flex-direction: column), **groupé par emprunteur** : d'abord tous les comptes de l'emprunteur 1, puis tous les comptes de l'emprunteur 2
   - Un sous-titre en gras navy (prénom NOM) sépare chaque groupe
   - Chaque compte dans un `class="compte-item"` :
     - Banque / Établissement
     - Type de compte + numéro (masqué, ex: ...1660)
   - Le titulaire n'est plus répété dans chaque item puisqu'il est dans le sous-titre du groupe
   - Inclure comptes courants, épargne, PEL, etc.

5. **Charges du foyer** (`class="card"`) :
   - Tableau simple (`class="pieces"`) avec colonnes : Type de charge, Montant mensuel, Commentaire
   - Charges typiques : loyer, assurances, énergie, téléphonie, épargne programmée
   - Pour le loyer : ajouter une note en italique "sera remplacé par la mensualité du prêt"

6. **Équipement bancaire transférable — PNB** (`class="card"`, `border-left:4px solid var(--gold)`) :
   - Placé juste après les charges du foyer
   - Sous-titre explicatif en gris : "Produits et flux captifs actuellement domiciliés dans les banques du foyer, transférables à la banque prêteuse."
   - Tableau (`class="pieces"`) avec colonnes : Produit / Flux, Emprunteur, Banque, Prélèvement constaté
   - ⚠ RÈGLE MONTANTS : afficher uniquement les **montants mensuels constatés sur les relevés bancaires** (ex: "58,81 €/mois"). Ne JAMAIS extrapoler en coût annuel — c'est une donnée que nous n'avons pas vérifiée sur 12 mois. On affiche ce qu'on constate, point.
   - Ajouter en note de bas : "Montants constatés sur les relevés bancaires (X mois)." avec la période réelle d'observation
   - ⚠ RÈGLE CRITIQUE : ne lister que les produits **prélevés par un établissement bancaire** (banque ou filiale assurance de la banque). Le PNB représente ce que la banque prêteuse peut récupérer en cas de domiciliation — seuls les flux bancaires sont transférables.
   - Inclure : assurances souscrites via la banque (auto, MRH, GAV, prévoyance bancaire), frais bancaires (CB, moyens de paiement), cotisations compte, épargne captive (PEL, assurance-vie bancaire)
   - Exclure : mutuelles professionnelles (PRO BTP, etc.), assurances souscrites hors réseau bancaire (THELEM, MAIF, MACIF sauf si filiale bancaire), prévoyance employeur — la banque ne sait pas récupérer ces flux
   - ⚠ NE PAS afficher de ligne TOTAL — ne pas estimer un PNB global chiffré. Laisser le détail ligne par ligne, le banquier fera son propre calcul
   - Note en bas en gris (11px) : "En cas de domiciliation complète, la banque prêteuse récupère l'intégralité de ces flux — argument de négociation pour obtenir des conditions préférentielles (taux, frais de dossier)."

**Règle** : comme les autres onglets client, présenter les données de façon **valorisante**. Les alertes (épargne insuffisante, crédits revolving, découverts…) vont dans les notes internes uniquement.

**Source des données** : EXTRACTION_SUMMARY, **§4.1-§4.2 (Comptes & épargne P4)** pour les comptes bancaires et soldes d'épargne, **§2.2 (Crédits en cours P2)** pour les crédits personnels (avec CRD sourcé TA ou estimé), **§2.3 (Charges récurrentes P2)** pour les charges du foyer, **§2.4 (Patrimoine immobilier détenu P2)** pour les biens déjà détenus. Ces données ont été extraites par `dossier-extract`. Ne PAS relire les relevés bancaires ni les tableaux d'amortissement — utiliser exclusivement le summary. La **sous-section 4.4.13 (PNB)** alimente le bloc "Équipement bancaire transférable".

#### Onglet 4 — "🏗️ Projet"

Cet onglet présente le projet immobilier de façon claire et complète. C'est la fiche que le client montre à sa famille en disant "voilà ce qu'on achète".

Structure :

1. **Badge date** : bandeau or (ex: "Projet d'acquisition — Compromis signé le 07/02/2026")

2. **Vignettes KPI — Ligne 1** (grille 3 colonnes, `display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:14px`) :
   - **Type de bien** : emoji + type (🏠 Maison, 🏢 Appartement…), sous-texte "Mitoyenne — 111,9 m²" ou description courte
   - **Classe énergétique** : lettre DPE en très gros (32px), colorée selon la classe (A/B = vert, C/D = gold, E = orange, F/G = rouge), sous-texte "322 kWh/m²/an — Passoire thermique" ou description
   - **Travaux** : montant total devis en orange si élevé, sous-texte "Devis totaux"
   - Variantes possibles : si pas de travaux, remplacer par **Prix du bien** ou **Terrain** selon pertinence

3. **Vignettes KPI — Ligne 2** (même grille 3 colonnes, `margin-bottom:28px`) :
   - **Signature promesse** (ou compromis) : date de signature (ex: "20/03/2026")
   - **Date limite CS** : date limite de la condition suspensive de financement — en rouge (`color:var(--red)`) si le délai est court
   - **Expiration promesse** (ou date de réalisation) : date de fin de validité de la promesse ou date prévue de réalisation de la vente
   - Sources : promesse de vente, compromis, avenant. ⚠ Utiliser "CS" (condition suspensive), pas "CSF".
   - Ces dates ne doivent PAS être répétées dans les tableaux en dessous (pas de doublon)

Il se structure ensuite en **5 blocs** dont le premier — la Présentation du projet — est **obligatoire** :

**BLOC 0 — "📖 Présentation du projet" (OBLIGATOIRE, toujours en premier)**

Ce bloc est un **texte court et factuel** (pas un tableau) en 3-4 paragraphes. Style : `border-left:4px solid var(--gold); background:linear-gradient(135deg, #fffcf5 0%, #fff 100%)`.

⚠ **RÈGLE DE TON — niveau 6/10 sur l'échelle de chaleur.** Le texte doit rester factuel et professionnel, mais avec des phrases connectées qui se lisent naturellement (pas télégraphique). Données chiffrées. Pas de style romanesque ni d'adjectifs superflus ("exceptionnel", "parfaitement", "idéal"), pas de formulations empathiques ("L'objectif est clair", "offrir à chaque enfant son propre espace"). On pose les faits avec des phrases complètes et fluides, sans tomber dans l'argumentaire de vente.

Structure obligatoire :
- **§1 — Qui** : emprunteurs (prénom NOM, âge, situation, nombre d'enfants), logement actuel, loyer. Phrases télégraphiques.
- **§2 — Quoi** : le bien (type, adresse, description courte, surface, prix, travaux, DPE). Faits uniquement.
- **§3 — Comment** : stratégie financière factuelle (apport, éligibilité PTZ, montage prêts, mensualité exacte, saut de charge, épargne résiduelle). Chiffres réels issus de la source de montage (§0 summary simulation en mode SUMMARY, ou DDP/ALTO en mode PDF) — ne JAMAIS mettre de chiffres approximatifs type "~800 €" si la source donne un montant précis.
- **§4 — Conclusion** : une seule phrase en gras qualifiant le type de projet (ex : "Projet de primo-accession familiale.")

Adapter le récit au type de projet :
- **Vente RP → Achat RP (prêt relais)** : expliquer pourquoi le bien actuel ne convient plus (étage sans ascenseur, surface inadaptée, éloignement…), décrire le bien cible et en quoi il résout le problème, détailler le mécanisme du prêt relais (% de la valeur estimée), chiffrer la trésorerie récupérée après vente et solde du relais
- **Primo-accédants** : insister sur le parcours (locataires actuels, loyer, épargne constituée), l'éligibilité PTZ, la montée en patrimoine
- **Investissement locatif** : décrire la stratégie (LMNP, nue, coloc…), le rendement brut visé, l'impact sur l'endettement
- **Construction / VEFA** : calendrier appels de fonds, déblocages progressifs

1. **Le bien** (`class="card"`) :
   - Adresse complète
   - Type de bien (maison, appartement, terrain…)
   - Description : nombre de pièces, étages, dépendances, terrain
   - Surface habitable (DPE) et surface terrain (cadastre)
   - Année de construction
   - DPE : classe énergétique + consommation (kWh/m²/an) + émissions CO₂. Utiliser un badge coloré :
     - A/B = vert | C/D = gold | E = orange | F/G = rouge
   - Vendeur (nom)
   - Notaire ou mandataire (si connu)
   - Origine de propriété (succession, achat…)

2. **Les travaux prévus** (`class="card"`) — si applicable :
   - Tableau détaillé des devis : poste, entreprise, montant TTC
   - Ligne récapitulative : **Total travaux**
   - Note sur l'enveloppe travaux prévue au compromis vs total devis réel
   - Si rénovation énergétique : mentionner les aides potentielles (MaPrimeRénov', CEE, Éco-PTZ…) sans s'engager sur les montants

3. **Plan de financement** (`class="card"`) :
   - Tableau récapitulatif :
     - Prix du bien
     - Enveloppe travaux (compromis)
     - Frais de notaire (estimés)
     - **Coût global de l'opération**
     - Apport personnel
     - **Montant du prêt sollicité**
   - Durée souhaitée
   - Taux maximum (si mentionné au compromis)
   - Date signature compromis
   - Date limite condition suspensive de financement

4. **Dates clés** (`class="card"`) :
   - Frise ou tableau chronologique : signature compromis → fin rétractation → date limite financement → signature acte authentique prévue
   - Mettre en évidence la date limite de financement avec un badge rouge si < 30 jours

**Règle** : onglet client, présentation valorisante. Le bien doit donner envie. Les travaux sont présentés comme un investissement qui va transformer le bien. Les problèmes (DPE catastrophique, travaux excessifs, ratio prix/surface…) vont dans les notes internes.

**Règle anti-remplissage** : chaque section du HTML doit servir une décision (du client, du banquier ou du courtier). Si une information est déjà dans les pièces jointes du dossier (diagnostics, plans, documents techniques) ou n'influence pas la décision de prêt, elle n'a pas sa place dans le HTML. Ne pas générer de sections "pour faire complet". Exemples de sections interdites : diagnostics techniques (CREP, gaz, amiante, électricité, assainissement…), descriptif du quartier/environnement, historique du bien.

5. **Éloignement professionnel** (`class="card"`) :
   Cette section est **OBLIGATOIRE**. Elle compare la distance domicile-travail actuelle avec la distance future (nouveau bien → lieu de travail) pour chaque emprunteur.
   - Tableau `class="fiche-table"` avec colonnes : Emprunteur | Employeur & lieu | Distance actuelle (domicile actuel → travail) | Distance future (nouveau bien → travail) | Écart
   - Reprendre les adresses et distances depuis l'EXTRACTION_SUMMARY **§5.6 (Éloignement professionnel)**. Ne PAS recalculer les distances — elles ont déjà été estimées par `dossier-extract`.
   - Colorer l'écart : vert si rapprochement, rouge si éloignement, gris si neutre (< 5 km de différence)
   - Si l'information n'est pas disponible (adresse employeur inconnue), indiquer "À compléter" en italique doré
   - **Argument bancaire** : un rapprochement professionnel renforce le dossier (économie de transport, meilleure qualité de vie, projet cohérent). Un éloignement significatif peut être un point d'attention — dans ce cas, le mentionner factuellement sans commentaire négatif (c'est un onglet bancaire).

**Source des données** : `AA summary extract.txt`, **§5 (Projet P5)** avec sous-sections 5.1 Le bien, 5.2 DPE, 5.3 Dates clés, 5.4 Travaux, 5.5 Estimations locatives, 5.6 Éloignement professionnel. La sous-section **§5.6 Éloignement professionnel** alimente le bloc 5 (distances). Ne PAS relire le compromis, le DPE ni les devis — utiliser exclusivement le summary. Seule exception : si la source de montage (§0 du summary simulation en mode SUMMARY, ou DDP/ALTO en mode PDF) contient des montants de frais ou travaux différents du compromis, c'est cette source qui prime pour l'onglet Financement.

#### Onglet 5 — "💶 Financement"

Cet onglet présente le plan de financement. Sa source dépend du **mode de sourcing** (voir § "Règle de sourcing" plus haut).

##### Mode SUMMARY (préféré) — `AA summary simulation.txt` présent

**C'est la voie normale et recommandée.** Le §0 de `AA summary simulation.txt` contient tout ce dont cet onglet a besoin :

| Donnée | Source §0 |
|--------|-----------|
| Plan de financement détaillé (prêt par prêt : type, montant, taux, durée, mensualité, nature, palier) | §0.1 |
| Tableau d'amortissement (5 premiers + 5 derniers mois + paliers) | §0.2 |
| Frais détaillés (notaire, garantie, dossier, courtage, assurance an 1) | §0.3 |
| Taux nominal pondéré, taux d'assurance, TAEG, coût total du crédit, coût total projet | §0.4 |
| Commentaires banquier (encadré Cifacil page 3) | §0.5 |
| Conditions suspensives | §0.6 |
| Banque portant, version DDP (V1/V2/V3/ALTO), date d'émission | §0 en-tête |

En mode SUMMARY, **ne JAMAIS ouvrir la DDP ni l'ALTO PDF**, même pour "vérifier" ou "compléter". Si une donnée manque dans le §0, c'est que `/dossier-extract-simulation` doit être relancé pour régénérer le summary. Les CAS 1 / 2 / 3 ci-dessous et toutes les instructions « Extraction P0 ALTO », « Extraction page 3 », « Extraction page 4 » sont **inactifs** en mode SUMMARY.

Pour le graphique SVG (Étape 4 ci-dessous) : les données annuelles se construisent à partir du tableau d'amortissement du §0.2. Si le §0.2 ne contient que 5 premiers + 5 derniers mois (extrait représentatif), reconstituer les années intermédiaires par interpolation linéaire du CRD entre ces points, ou recalculer l'échéance année par année à partir des caractéristiques de chaque prêt du §0.1. Ne PAS aller ouvrir l'ALTO pour récupérer le tableau complet.

##### Mode PDF (fallback) — `AA summary simulation.txt` absent

Le skill s'appuie sur deux types de pièces P0 Cifacil, directement dans le dossier :

- **P0 DDP** (Demande de Prêt) — fichier nommé `C. DDP *.pdf`, `C. CACE DDP*.pdf`, ou `P0 - DDP*.pdf`. Document administratif structuré (4 pages) : état civil, situation pro, caractéristiques projet, récapitulatif dépenses et plan de financement.
- **P0 ALTO** (Simulation / Étude de financement) — fichier nommé `P0 - ALTO*.pdf`, `P0 - Simulation*.pdf`, `P0 - Etude V1*.pdf`, ou tout PDF contenant "ETUDE DE FINANCEMENT" et "Moteur Alto" en pied de page. C'est la simulation chiffrée détaillée produite par le logiciel Alto (Cifacil). Elle contient les données financières **précises et définitives** du montage.

**Pourquoi l'ALTO est essentiel** : la DDP est un formulaire administratif qui résume le montage, mais l'ALTO est la source de vérité pour les chiffres financiers. Il fournit avec précision : les montants de chaque prêt, les taux, les durées, l'apport, les frais (garantie, dossier, courtage, notaire), les mensualités avec et hors assurance, le TAEG, le coût total du crédit, et le tableau d'amortissement complet. Quand un ALTO est présent, ses chiffres prévalent sur ceux de la DDP en cas de divergence.

Trois cas de figure (en mode PDF uniquement) :

**CAS 1 — Avec DDP + ALTO** (cas idéal) : les deux fichiers sont présents. Extraire les données de l'ALTO en priorité pour tout ce qui concerne le financement chiffré (montants, taux, mensualités, coûts, TAEG). Compléter avec la DDP pour les commentaires (page 3) et les ratios HCSF/reste à vivre (page 4). Suivre les instructions d'extraction ci-dessous.

**CAS 2 — Avec DDP seule** : pas d'ALTO dans le dossier. Extraire les données de la page 4 de la DDP comme source principale. Suivre les instructions ci-dessous.

**CAS 3 — Sans DDP ni ALTO (estimation)** : le dossier ne contient aucune pièce P0 de financement (dossier en cours de montage, R1, ou pré-dépôt). Dans ce cas, **construire toi-même une estimation réaliste** du plan de financement à partir des données extraites. L'onglet Financement doit quand même exister et contenir TOUS les blocs visuels décrits ci-dessous (récapitulatif coût, plan de financement, graphique SVG, paliers, indicateurs HCSF, LTV, saut de charge) — simplement avec des données estimées au lieu d'extraites d'une DDP. Afficher un bandeau d'alerte orange en haut : "⚠️ Montage indicatif — Aucune DDP dans le dossier".

> **Astuce workflow** : si le dossier contient une DDP ou un ALTO, le réflexe est de lancer `/dossier-extract-simulation` **avant** `/dossier-html` pour basculer en mode SUMMARY, plus propre et plus rapide. Le mode PDF reste utile pour les dossiers R1 / pré-dépôt ou quand la capture n'a pas été lancée.

---

**Extraction P0 ALTO — Données à récupérer (mode PDF uniquement) :**

> ⚠ Cette section ne s'applique qu'en **mode PDF** (summary simulation absent). En mode SUMMARY, les mêmes données proviennent du §0 de `AA summary simulation.txt` — ne pas ouvrir l'ALTO.

L'ALTO est structuré en plusieurs pages. Lire avec pdfplumber et extraire :

**Page 1 — "SIMULATION DE FINANCEMENT" (résumé)** :
1. **Dépenses** : Logement, Travaux, Sous-total, Frais de notaire, Frais de garantie, Frais de dossier, Autre dépense (= honoraires courtage), Total des dépenses
2. **Plan de financement** : Apport personnel (montant), chaque prêt (nom, montant, taux, durée en mois), Total
3. **Mensualités** : mensualité par prêt (avec assurance), mensualité totale, % du revenu

**Page 2 — "SIMULATION DE FINANCEMENT" (détail)** :
1. **Résumé du plan** : Apport, Montant total des prêts, Durée totale, Taux moyen des prêts hors ADI, Coût total du financement
2. **Mensualité** : mensualité avec assurance, mensualité crédits en cours, mensualité totale, durée de remboursement

**Pages suivantes — "SIMULATION DE PRET" (un bloc par prêt)** :
Pour chaque prêt du montage, une section détaillée donne :
1. **Caractéristiques** : nature du prêt, montant, taux nominal, type de taux (fixe/variable), durée nominale
2. **Assurances et garanties** : type ADI (groupe/délégation), taux ADI, quotité, type de garantie (SACCEF, Crédit Logement, hypothèque…)
3. **Coûts** : coût total, dont intérêts, dont assurance, TAEG, TAEA, frais de dossier
4. **Tableau d'amortissement** : date, capital restant dû, amortissement, intérêts, assurance, échéance hors/avec assurance. Extraire au minimum la première ligne (pour vérifier la mensualité) et la dernière ligne (pour vérifier la date de fin).

**Données ALTO prioritaires pour l'onglet Financement :**

| Donnée | Source ALTO | Usage dans l'onglet |
|--------|------------|---------------------|
| Montant de chaque prêt | Page 1 plan de financement | Tableau plan de financement |
| Taux nominal par prêt | Pages "Simulation de prêt" | Tableau + badges taux |
| Durée par prêt (mois) | Pages "Simulation de prêt" | Tableau + graphique SVG |
| Mensualité hors assurance | Pages "Simulation de prêt" | Référence |
| Mensualité avec assurance | Page 1 mensualités | **Valeur affichée dans paliers et graphique** |
| Apport personnel | Page 1 plan de financement | Tableau plan de financement |
| Frais de notaire | Page 1 dépenses | Récapitulatif coût |
| Frais de garantie | Page 1 dépenses | Récapitulatif coût |
| Frais de dossier | Pages "Simulation de prêt" | Récapitulatif coût |
| Honoraires courtage | Page 1 "Autre dépense" | Récapitulatif coût |
| TAEG | Pages "Simulation de prêt" | Affiché en indicateur |
| Coût total du crédit | Page 2 résumé | Affiché en indicateur |
| Taux moyen pondéré | Page 2 résumé | Affiché en indicateur |
| Type de garantie | Pages "Simulation de prêt" | Mentionné dans le plan |
| Type ADI + taux | Pages "Simulation de prêt" | Mentionné dans assurance |

---

Pour l'estimation sans DDP (CAS 3, mode PDF uniquement — en mode SUMMARY cette situation n'existe pas puisque `AA summary simulation.txt` suppose qu'une DDP/ALTO a été capturée), construire le montage comme suit :
- Calculer le coût global = prix + travaux + frais notaire estimés (~8 % de l'ancien ou ~3 % du neuf) + frais garantie (~1 000 €) + frais dossier (~500 €) + frais courtage (à estimer ou laisser "à définir")
- Déterminer l'apport personnel = épargne disponible − épargne résiduelle de sécurité
- Évaluer l'éligibilité aux prêts réglementés : PTZ si primo-accédant (zone A/B/C), Éco-PTZ si travaux de rénovation énergétique sur DPE E/F/G, Action Logement si salarié du privé d'une entreprise > 10 salariés
- Monter un scénario réaliste avec lissage : répartir le financement entre prêt classique + prêts à taux zéro éventuels, ce qui crée des paliers de remboursement
- Calculer les mensualités : `mensualité = capital × (taux_mensuel) / (1 - (1 + taux_mensuel)^(-nb_mois))` pour les prêts à taux > 0, et `capital / nb_mois` pour les prêts à 0 %
- Estimer l'assurance emprunteur à ~0,30 % du capital total emprunté / 12
- Taux indicatif estimé : ~3,50 % (ajuster selon le contexte de marché)
- Tous les blocs visuels ci-dessous (paliers, HCSF, LTV, saut de charge) doivent être générés même en estimation — ils sont indispensables pour que le courtier visualise la faisabilité du dossier

**Source de données DDP** (mode PDF uniquement — complémentaire à l'ALTO, ou source principale si pas d'ALTO) :

> ⚠ En **mode SUMMARY**, ne PAS ouvrir la DDP. Les commentaires banquier sont dans `AA summary simulation.txt §0.5`, les conditions suspensives dans §0.6, le plan de financement dans §0.1, les frais dans §0.3, les taux/TAEG/coûts dans §0.4. Les ratios HCSF/reste à vivre sont **recalculés** par ce skill (voir section Indicateurs HCSF), ils ne sont pas repris tels quels de la DDP.

En mode PDF, lire la **page 3** (section Commentaires uniquement) et la **page 4** (intégralement) du PDF `C. DDP...` (ou `C. CACE DDP...`, ou `P0 - DDP...`). Si un ALTO est aussi présent, la DDP reste utile pour les commentaires (page 3) et les ratios d'endettement/reste à vivre (page 4) que l'ALTO ne fournit pas toujours.

**Extraction — données à récupérer de la page 3 (section Commentaires uniquement) :**

En bas de la page 3, il y a un encadré **"Commentaires"**. Extraire tout le texte de cet encadré. Il contient des notes importantes du montage (ex : demande de délégation d'assurance, conditions particulières, remarques sur le dossier). Ces commentaires doivent être affichés dans l'onglet Financement sous forme d'un encadré d'information.

**Ne pas extraire** les autres sections de la page 3 (caractéristiques du projet, description du logement, normes réglementaires, etc.) — ces informations sont déjà traitées dans l'onglet Projet.

**Extraction — données à récupérer de la page 4 :**

1. **Récapitulatif des dépenses** :
   - Logement, Travaux, Frais de notaire, Frais de garantie, Frais de dossier, Frais de courtage
   - Total hors frais / Total des frais / Total général

2. **Plan de financement** :
   - Apport personnel
   - Liste de chaque prêt : nom, montant, taux (fixe/variable), durée en mois, mensualité
   - Total des prêts

3. **Mensualités** :
   - Par palier (ex: 120 premiers mois, 120 suivants, 60 derniers)
   - Mensualité totale nette par palier
   - Vérifier si les mensualités sont "avec assurance" ou "hors assurance" — le mentionner clairement

4. **Ratios** :
   - Taux d'endettement cumulé sans APL
   - Reste à vivre sans APL
   - Critères HCSF (durée max / endettement max)
   - Si un flag d'alerte est présent (ex : "Assurance(s) manquante(s)"), le relever

**Structure HTML de l'onglet :**

1. **Badge date** avec la date de la DDP et le nom de la banque destinataire

1bis. **Bandeau de vignettes KPI en haut de l'onglet** — OBLIGATOIRE.

   Afficher les **6 indicateurs clés** du montage en **2 lignes × 3 colonnes** (`<div class="kpi-row" style="grid-template-columns:repeat(3,1fr);">` × 2 blocs consécutifs) :

   **Ligne 1 :**
   - **Mensualité lissée** (`kpi gold`) — valeur = mensualité palier 1 assurance incluse. Détail : « Assurance incluse — X ans ».
   - **Taux d'endettement** (`kpi green` si < 33 %, sinon couleur adaptée) — valeur en %. Détail : « Conforme HCSF » / « Dépassement HCSF ».
   - **Reste à vivre** (`kpi`) — valeur en €/pers. Détail : « par personne (N = X) ».

   **Ligne 2 :**
   - **Durée** (`kpi`) — valeur en années. Détail : « X mois — PTZ aligné » ou équivalent.
   - **LTV** (`kpi`, couleur selon barème — vert ≤80, navy 80-100, orange 100-110, rouge >110) — valeur en %. **Détail OBLIGATOIRE** : afficher le calcul avec les deux opérandes, ex : « `198 028,50 € ÷ 186 757 €` » suivi de « (Prêts amort. ÷ bien + travaux) ». Le courtier doit pouvoir reconstituer le calcul d'un coup d'œil sans dérouler d'autre bloc.
   - **Saut de charge** (`kpi`, couleur selon barème — vert économie, navy ≤20 %, orange > 20 %, rouge > 50 %) — valeur en €/mois avec signe +/−. Détail : ancienne charge → nouvelle mensualité (ex : « 650,51 → 912,86 €/mois »).

   > **Règle** : ces 6 KPI remplacent les anciennes **cards détaillées** LTV / Saut de charge. Ne plus générer de blocs détaillés de 48px de LTV et Saut de charge plus bas dans l'onglet. Les informations (formule, surface de calcul, règle prêt relais exclu) doivent être **condensées** dans le détail de la vignette ; si une note complémentaire est indispensable (ex : règle prêt relais exclu), l'ajouter dans la card Conformité HCSF.

2. **Alertes et commentaires** (si présents) :
   - Si les mensualités sont "hors assurance" ou qu'un flag "Assurance(s) manquante(s)" est détecté → afficher un bandeau d'alerte orange (⚠️) expliquant que les mensualités sont hors assurance
   - Si les commentaires banquier sont présents (en mode SUMMARY : §0.5 de `AA summary simulation.txt` ; en mode PDF : section "Commentaires" de la page 3 de la DDP) → afficher un encadré info (fond cream, bordure navy) avec une icône 💬 et le contenu des commentaires
   - Format :
     ```html
     <div style="background:var(--red-bg);border:1px solid var(--red);border-radius:8px;padding:14px 20px;margin-bottom:20px;display:flex;align-items:flex-start;gap:10px;">
       <span style="font-size:18px;">💬</span>
       <div>
         <div style="font-weight:700;color:var(--red);font-size:13px;">Commentaires DDP</div>
         <div style="font-size:12px;color:var(--text);">{contenu des commentaires}</div>
       </div>
     </div>
     ```

3. **Récapitulatif coût total** (`class="card"`) :
   - Tableau simple avec chaque poste de dépense et son montant
   - Ligne récapitulative : Total hors frais + Total frais = **Total général**

3. **Plan de financement** (`class="card"`) :
   - Tableau avec colonnes : Prêt, Montant, Taux, Durée, Mensualité
   - Ligne apport en haut
   - Ligne total en bas en gras
   - Utiliser des badges colorés pour les taux :
     - 0 % (PTZ, Éco-PTZ) = badge vert
     - Taux fixe > 0 = badge navy
   - **Si TAEG + coût total disponibles** (toujours le cas en mode SUMMARY via §0.4 ; en mode PDF uniquement si ALTO présent) : ajouter sous le tableau une ligne de KPI en grille 3 colonnes (TAEG, Taux moyen pondéré, Coût total du crédit) dans des mini-cards fond cream, valeur en gras navy. Le TAEG inclut tous les frais (intérêts + assurance + garantie + dossier) — c'est l'indicateur le plus complet du coût réel. Le taux moyen pondéré est le taux hors assurance pondéré par les montants de chaque prêt. Le coût total inclut intérêts + assurance sur toute la durée.

4. **Graphique "Évolution des remboursements"** (`class="card"`) — **DONNÉES ANNUELLES ISSUES DU TABLEAU D'AMORTISSEMENT** :

   Ce graphique est un SVG empilé en barres annuelles (1 barre par année de remboursement). Source :
   - **Mode SUMMARY** : tableau d'amortissement du **§0.2** de `AA summary simulation.txt`. Si le §0.2 ne fournit qu'un extrait représentatif (5 premiers + 5 derniers mois + lignes de palier), reconstituer les années intermédiaires en recalculant l'échéance année par année à partir des caractéristiques de chaque prêt du §0.1 (capital, taux, durée, mensualité) — ne PAS aller ouvrir l'ALTO.
   - **Mode PDF** : tableaux d'amortissement des pages "Simulation de prêt" de la simulation ALTO. Ne PAS utiliser les paliers de la page 1 (ils donnent des moyennes plates qui masquent la baisse progressive de l'assurance sur CRD).

   **Pourquoi des barres annuelles et pas des barres par palier :**
   - L'assurance emprunteur est calculée sur le CRD (Capital Restant Dû), qui diminue chaque année
   - Sur les prêts à taux 0 % (PTZ, Booster), il n'y a pas d'intérêts → la mensualité est amortissement + assurance, donc elle baisse mécaniquement
   - Le graphique par palier donne des barres plates = visuellement faux. Le graphique annuel montre la vraie courbe descendante

   **Étape A — Extraire les échéances annuelles de chaque prêt :**

   Pour chaque prêt, lire le tableau d'amortissement (§0.2 du summary simulation en mode SUMMARY, pages 4+ de l'ALTO en mode PDF). Ce tableau donne pour chaque année :
   - N° (numéro d'échéance) + Date
   - Capital restant dû
   - Amortissement + Intérêts
   - Assurance(s)
   - **Échéance avec assurance** ← c'est la colonne à extraire

   Construire un tableau Python : pour chaque année (1 à durée_max), noter l'échéance avec assurance de chaque prêt. Si un prêt n'est pas actif cette année-là → 0.

   Ajouter les crédits en cours (endettement existant) pour les années concernées (ex: prêt conso 97 € sur 21 mois = années 1-2, dette familiale 100 € sur 41 mois = années 1-3).

   **Étape B — Couleurs fixes par type de prêt :**

   ```
   Prêt lissage / prêt amortissable (taux > 0)  →  #4A90D9  (bleu)
   PTZ (Prêt à Taux Zéro)                        →  #E8C840  (jaune)
   Éco-PTZ                                        →  #5DA9E9  (bleu clair)
   Booster 0% / Prêt Action Logement              →  #2E8B57  (vert)
   Prêt relais                                    →  #C0392B  (rouge)
   Crédits existants (prêt conso, dettes)         →  #8B7355  (marron)
   Autre prêt                                     →  #6B7A8D  (gris)
   ```

   **Étape C — Générer le SVG empilé :**

   Constantes :
   ```
   SVG viewBox = "0 0 700 320"
   pad_l=60, pad_r=20, pad_t=20, pad_b=55
   chart_w = 620, chart_h = 245
   y_max = 1200 (adapter selon la mensualité max + 20 % de marge)
   bar_width = chart_w / nb_années - 2
   ```

   Pour chaque année (1 barre empilée) :
   ```
   x = pad_l + (année - 0.5) / nb_années × chart_w - bar_width/2
   Empiler du bas vers le haut : crédits → booster → PTZ → lissage
   Pour chaque couche :
     hauteur = valeur / y_max × chart_h
     y_top = pad_t + chart_h - cumul / y_max × chart_h
     <rect x y_top width=bar_width height fill=couleur opacity=0.85 rx=1/>
   ```

   Annotations (labels de montant) : afficher le total au-dessus de la barre pour les années clés (année 1, année du changement de palier, dernière année). Ne pas surcharger.

   Axe X : labels en années (tous les 2 ans + année 1 + dernière année).
   Axe Y : grille horizontale tous les 200 €.
   Légende : rectangles colorés + noms des prêts en bas du SVG.

   **Ordre d'empilage (bas → haut) :** les prêts qui courent le plus longtemps vont en bas (bande continue). Les prêts courts vont en haut.

   **Règles impératives du graphique :**
   - Données = tableau d'amortissement §0.2 (mode SUMMARY) ou ALTO (mode PDF) — pas les paliers moyennés
   - 1 barre par année (pas par palier)
   - Empilage serré, pas de gap vertical
   - La baisse de l'assurance sur CRD DOIT être visible dans les dernières années
   - Labels montant uniquement sur les années de transition
   - `rx=1` autorisé pour adoucir légèrement les coins

5. **Paliers de mensualités** (`class="card"`) :
   Afficher les paliers côte à côte dans une grille (`display:grid; grid-template-columns:repeat(N,1fr); gap:16px` où N = nombre de paliers, 2 ou 3 typiquement) :
   - **Palier 1** (mensualité maximale) : fond `var(--navy)`, texte blanc, border-radius 10px, padding 20px. En haut : période en 11px uppercase (ex: "MOIS 1 → 180 (15 ANS)"). Au centre : montant en 36px font-weight 800. En bas : "Mensualité maximale" en 12px.
   - **Paliers suivants** : fond `var(--cream)`, bordure `var(--gold)`, texte navy. Même structure. Note explicative (ex: "Après fin Éco-PTZ", "Après fin prêt lissage").
   - Préciser "(hors assurance)" ou "(avec assurance)" dans le titre de la card selon les données.

6. **Indicateurs HCSF** — synthèse/conformité (les 4 valeurs clés TE, Durée, LTV, Saut de charge sont déjà exposées dans le bandeau KPI 1bis — ne pas les dupliquer en grandes cards de 48px). Prévoir ici uniquement une **card "Conformité HCSF"** (`fiche-table` avec badges `status ok/partiel/manquant` sur TE, Durée, Nature du projet, Reste à vivre) + rappel règles de calcul ci-dessous :

   **RÈGLE IMPÉRATIVE — Calcul du taux d'endettement :**
   ```
   R = revenus nets retenus (EXTRACTION_SUMMARY) + pensions alimentaires REÇUES
   C = mensualité prêt + charges crédit PERSONNELLES existantes (prêt conso, LOA…) + pensions alimentaires VERSÉES
   TE = C / R
   RàV = R - C
   ```
   ⚠ **SOURCE DES REVENUS** : R provient EXCLUSIVEMENT de l'EXTRACTION_SUMMARY **§3.2 (Synthèse foyer)**, ligne "TOTAL REVENUS RETENUS FOYER". Ne JAMAIS utiliser le "Revenu mensuel net" de la DDP Cifacil ni le "Revenu mensuel net" de l'ALTO — ces chiffres sont saisis manuellement par le courtier et n'appliquent pas les normes bancaires. Si le TE de la DDP diffère du TE calculé ici, c'est **ce calcul** qui fait foi.

   ⚠ La pension alimentaire reçue est un **REVENU** (entre dans R). La pension alimentaire versée est une **CHARGE** (entre dans C). Ne JAMAIS soustraire la pension versée de R — elle s'ajoute aux charges dans C. Cette distinction est fondamentale pour le calcul HCSF.

   ⚠ **RÈGLE HCSF — LES DETTES PROFESSIONNELLES N'ENTRENT JAMAIS DANS LE TE** : les emprunts souscrits par une personne morale (EARL, SAS, SARL, SELARL, SCM, SCI pro, auto-entreprise…) sont des dettes de la **structure**, pas de la **personne physique**. Elles ne rentrent pas dans le calcul du taux d'endettement HCSF, même si l'emprunteur est gérant, associé unique ou caution. C'est la norme HCSF : le TE ne prend en compte que les charges de crédit **personnelles** de l'emprunteur (prêt immobilier perso, conso, LOA, revolving…). Les dettes pro sont analysées séparément dans la section Analyse bilancielle (ratios endettement pro/EBE, annuités/EBE) pour évaluer la solidité de la structure — mais elles ne se mélangent jamais avec l'endettement personnel.

   **Card "Taux d'endettement"** (`class="card"`) :
   - Titre h3 avec bordure bottom gold
   - Valeur en très gros (48px, font-weight 800) au centre, colorée selon le niveau :
     - < 33 % = `var(--green)` | 33-35 % = `var(--orange)` | ≥ 35 % = `var(--red)`
   - Badge de validation en dessous : `<span class="badge badge-green">✓ < 35 % HCSF</span>` (ou badge-red si ≥ 35 %)
   - Tableau `fiche-table` sous le badge avec : Reste à vivre (€/mois), Composition foyer (X adulte(s), Y enfant(s))

   **Card "Durée maximale"** (`class="card"`) :
   - Même structure visuelle que le taux d'endettement
   - Valeur en gros : "25 ans" (ou la durée réelle)
   - Badge : `<span class="badge badge-green">✓ ≤ 25 ans HCSF</span>` (ou badge-red si > 25 ans)
   - Tableau sous le badge : Durée totale (mois), Norme HCSF (Maximale 25 ans)

7. **Règles de calcul LTV et Saut de charge** — à appliquer pour alimenter correctement le bandeau KPI 1bis (les grandes cards détaillées sont supprimées).

   **Calcul de la LTV :**
   - Formule : **LTV = Prêts amortissables uniquement ÷ (Valeur du bien + Travaux) × 100**
   - **Règle bancaire** : le prêt relais est **exclu** du numérateur (assimilé à un apport — adossé à la vente d'un bien existant). Seuls les prêts amortissables (lissage, PTZ, Éco-PTZ, Action Logement…) entrent dans le calcul.
   - Toujours calculer sur `bien + travaux` au dénominateur (valeur après travaux).
   - Barème couleur de la vignette KPI : ≤ 80 % vert / 80-100 % gold / 100-110 % orange / > 110 % rouge.
   - Le détail de la vignette DOIT afficher les deux opérandes du calcul (ex : « 198 028,50 € ÷ 186 757 € — Prêts amort. ÷ bien + travaux »).

   **Calcul du Saut de charge :**
   - Saut de charge = mensualité palier 1 (assurance incluse) − charge de logement actuelle.
   - Charge actuelle = loyer si locataire, participation si hébergé, mensualité de prêt en cours si propriétaire. Si hébergé gratuitement sans participation : 0 € et mention « toute mensualité est une charge nouvelle ».
   - Barème couleur : négatif (économie) vert / 0-20 % navy / > 20 % orange / > 50 % rouge.
   - Détail de la vignette KPI : afficher `charge actuelle → nouvelle mensualité` (ex : « 650,51 → 912,86 €/mois »).
   - Si plusieurs paliers ultérieurs : préciser dans la card Conformité HCSF les mensualités des paliers suivants.

**Règle** : cet onglet est un document **interne** (pas envoyé au client). Il peut donc contenir des données techniques et des alertes. S'il y a un problème sur le taux d'endettement, le reste à vivre ou le LTV, le signaler clairement.

**S'il y a plusieurs DDP** (envoi à plusieurs banques — peu fréquent puisque le §0 du summary simulation capture une seule DDP de référence ; cas possible surtout en mode PDF), créer une sous-section par banque dans le même onglet avec un séparateur visuel.

#### Onglet 6 (optionnel) — "📋 Pièces à fournir"
Tableau récapitulatif des documents, avec statut coloré (reçu/partiel/manquant). Ajoute cet onglet uniquement si pertinent (beaucoup de pièces manquantes par ex.). Sinon, le PDF état des pièces suffit.

#### Onglet 7 — "🔒 Notes internes"

> ⛔ **ATTENTION — ONGLET LE PLUS IMPORTANT DU DOSSIER**
> Cet onglet est l'espace de travail analytique de Sébastien. Il est la raison d'être du dossier de courtage.
> **IL EST STRICTEMENT INTERDIT de produire une version simplifiée, résumée ou abrégée de cet onglet.**
> Chacune des 9 sections listées ci-dessous (Encadré contact + Sections 1 à 6 + Recommandation courtier) DOIT être présente dans le HTML final avec la structure exacte décrite.
> L'analyse forensique (Section 5) DOIT contenir les 13 catégories avec leurs tableaux, même si le résultat est "RAS" pour chaque catégorie.
> Le Score de confiance bancaire (Section 6) DOIT avoir les deux colonnes (EN L'ÉTAT / APRÈS COMPLÉTION) et la barre gradient.
> **Si le contexte est trop long pour tout générer en une passe, découper en plusieurs passes mais NE JAMAIS simplifier.**

Cet onglet est **visible** (pas masqué) mais clairement étiqueté comme interne avec un `class="badge-internal"`. C'est l'espace de travail analytique de Sébastien. **Cet onglet suit un plan systématique en 7 sections obligatoires + 1 encadré contact + 1 recommandation courtier**, appliqué de façon identique à chaque dossier.

---

##### ENCADRÉ CONTACT — 📞 Coordonnées des emprunteurs

**Cet encadré est OBLIGATOIRE et apparaît en tout premier dans les Notes internes, avant toutes les autres sections.** Reprendre les coordonnées depuis l'EXTRACTION_SUMMARY **§1 (Porteurs P1)**, sous-sections 1.1 / 1.2 (bloc "Coordonnées" de chaque emprunteur). Le courtier a besoin d'avoir les coordonnées de ses clients sous les yeux immédiatement, sans avoir à chercher dans les pièces.

Structure HTML : un `div.card` avec `border-left:4px solid var(--gold); margin-bottom:24px;`, contenant un titre `<h3>` avec emoji 📞 et un tableau `class="fiche-table"` avec les colonnes suivantes :

| Emprunteur | Téléphone | E-mail | Source |
|------------|-----------|--------|--------|
| Nom PRÉNOM | +33 6 XX XX XX XX | exemple@mail.com | Fiche d'appel du JJ/MM/AAAA |
| Nom PRÉNOM | *À compléter* | *À compléter* | — |

Règles :
- Lister **chaque emprunteur** sur une ligne séparée
- Colonne **Source** : indiquer d'où provient l'information (nom du document, date)
- Si un numéro ou un e-mail n'est pas encore connu, indiquer *À compléter* en italique doré (`class="incomplete"`)
- Si plusieurs numéros/e-mails existent pour un même emprunteur (perso + pro), les lister tous sur des lignes distinctes avec une mention du type (perso / pro)
- Ne PAS rescanner les documents — les coordonnées ont été collectées par `dossier-extract` dans le **§1 (Porteurs P1)** du summary, bloc "Coordonnées" de chaque emprunteur

---

##### SECTION 1 — ⚠️ Alertes & Points d'attention

Utilise les classes `.alert.high`, `.alert.medium`, `.alert.low`. **Ordonne TOUJOURS les alertes par sévérité** :
1. 🔴 **Rouges** (`.alert.high`) — Bloquants / Critiques (en premier)
2. 🟡 **Oranges** (`.alert.medium`) — Points de vigilance
3. 🟢 **Verts** (`.alert.low`) — Points positifs / confirmés OK

Chaque alerte doit contenir : un titre en **gras** avec l'emoji couleur, le nom de l'emprunteur concerné, une description factuelle avec **montants et dates précis**, et une action courtier en gras. Catégories à scanner systématiquement :
- Jeux en ligne (FDJ, Paris Sportifs, PMU) — quantifier par mois
- Découverts et dépassements — montants, TAEG, commissions d'intervention
- Crédits non déclarés (LOA, LLD, crédits conso, Klarna, Oney, Floa, Cofidis…)
- Inscription France Travail / ARE
- Baisse de CA significative (indépendants)
- Paiements fractionnés (3x-4x) récurrents
- Comptes miroirs non communiqués
- Dépendance financière familiale
- Ancienneté CDI insuffisante
- Toute anomalie détectée dans les relevés

---

##### SECTION 2 — Détail des charges (calcul reste-à-vivre)

Tableau `class="pieces"` avec colonnes : Charge | Montant | Détail. Reprendre les charges depuis l'EXTRACTION_SUMMARY **§2.3 (Charges récurrentes du foyer)** :
- Loyer / charges locatives
- Assurances (auto, habitation, mobile)
- Énergie (gaz, élec)
- Téléphone (fixe, mobile)
- Abonnements (streaming, salle de sport, presse…)
- Cotisations bancaires
- Épargne programmée (PEL, etc.)
- Crédits en cours (LOA, conso, etc.)

Ajouter une ligne de total avec fond `#f0f4ff` et font-weight 600. Séparer le total avec et sans loyer (puisque le loyer sera remplacé par le prêt).

---

##### SECTION 3 — Circuit financier (flux bancaires uniquement)

Reconstitution visuelle du flux d'argent entre comptes bancaires, dans un bloc `monospace` (`font-family:monospace; font-size:13px; line-height:2`), fond `#f8faff`, bordure `#dce3f0`. Utiliser des caractères ASCII (├─→, └─→) pour montrer :
- Pour chaque emprunteur : source des revenus (salaire, retraite, ARE…) → compte principal → ventilation (virements vers l'autre, épargne, loyer, charges fixes, crédits en cours)
- Aides familiales entrantes (parents → comptes) avec montants et libellés
- Aides sociales (CAF, APL…)
- Flux croisés entre les comptes du couple

Ce schéma permet au courtier de visualiser d'un coup d'œil qui paie quoi et comment circule l'argent.

> ⚠️ **Ce n'est PAS un calendrier d'opérations immobilières.** Pas de dates de compromis, pas de deadlines de condition suspensive, pas de chronologie du projet. Uniquement les flux bancaires réels observés sur les relevés de compte.

---

##### SECTION 4 — Notes fichiers

Tableau `class="fiche-table"` signalant :
- **Doublons identifiés** : fichiers en double dans le dossier (nommer les deux fichiers)
- **Fichiers corrompus** : fichiers impossibles à lire (erreur I/O, PDF vides, scans illisibles)
- **Erreurs de nommage** : fautes d'orthographe, espaces manquants, double ponctuation

---

##### SECTION 5 — 🔍 ANALYSE FORENSIQUE — Transactions suspectes

**Cette section est OBLIGATOIRE pour chaque dossier.** C'est le cœur analytique des Notes internes. Elle est encadrée dans un `div.card` avec `border:2px solid var(--red); background:#fff5f5`.

**Méthodologie** : reprendre les résultats de l'analyse forensique depuis l'EXTRACTION_SUMMARY **§4.4 (Analyse forensique — 13 catégories)**, sous-sections 4.4.1 à 4.4.13 (dont 4.4.13 PNB). L'analyse ligne par ligne des relevés a été réalisée par `dossier-extract` — le HTML ne relit PAS les relevés bancaires. Chaque catégorie suspecte fait l'objet d'une sous-section numérotée avec :
- Un en-tête `.section-header` avec un numéro dans un `.icon` (fond rouge pour critiques, fond `#e8a020` pour vigilance)
- Un tableau `class="pieces"` détaillant mois par mois : Nb opérations | Total | Détail montants
- Une ligne de total sur 3 mois (fond `#fdf2f2` pour critique, `#fff8e6` pour vigilance) avec la **moyenne mensuelle**
- Un encadré `.alert` (high/medium) avec un **Verdict** courtier

**Les 13 catégories d'analyse systématique :**

**1. Anomalies bancaires (incidents de compte)** — 🔴 icône rouge — **BLOQUANT**
C'est la catégorie la plus critique de l'analyse : la présence d'incidents de compte sur la période examinée **suffit à bloquer l'accord du prêt**, indépendamment du reste du dossier. Les banques tirent automatiquement ces libellés des relevés et les remontent dans leur moteur de scoring — aucun argumentaire commercial ne les efface.

Repérer ligne par ligne sur les 3 mois de relevés :
- **Commissions d'intervention** (libellés : « Commission d'intervention », « Commissions d'intervention », « Frais pour opérations particulières », « Forfait intervention », « Frais de forçage »). Chaque ligne = une opération refusée ou autorisée en dépassement → preuve d'un découvert non autorisé ou d'un solde tendu. Plafond réglementaire : 8 €/opération, 80 €/mois. Mentionner le montant + la date.
- **Rejets de prélèvement / rejets de chèque** (libellés : « Rejet prélèvement », « Rejet chèque », « Frais de rejet », « Rejet d'effet »). Chaque rejet = créancier impayé → fichage potentiel + perte de confiance (bailleur, énergéticien, opérateur télécom, Trésor public…). Donner le créancier rejeté et le montant.
- **Frais de rejet / frais d'incident** (libellés : « Frais de rejet », « Frais de lettre d'information », « Frais pour compte débiteur non autorisé »).
- **ATD — Avis à tiers détenteur / SATD — Saisie administrative à tiers détenteur** (libellés : « ATD », « SATD », « Saisie administrative », « Avis à tiers détenteur Trésor Public », « DGFiP », « URSSAF saisie »). C'est un **bloqueur absolu** : créance fiscale ou sociale impayée → impossibilité d'obtenir un prêt tant que la dette n'est pas apurée et justifiée.
- **Saisies-attribution / saisies judiciaires** (libellés : « Saisie-attribution », « Saisie huissier », « Opposition administrative »). Créance judiciaire exécutoire.
- **Blocages FCC / FICP** : repérer tout courrier Banque de France, toute mention « Fichage FCC », « Inscription FICP », « Incident de paiement caractérisé ». Bloqueur absolu tant que le fichage est actif.
- **Compte débiteur** : si le solde passe en négatif sur un ou plusieurs jours du mois, le noter (date d'entrée en débit, date de sortie, amplitude maximale). Un découvert non autorisé = commissions d'intervention + dégradation scoring. Un découvert autorisé utilisé en permanence = signal de tension.
- **Lettres d'information pour compte débiteur** : prélèvement « Frais LI » ou « Lettre d'information » = avertissement bancaire formalisé.

Tableau `class="pieces"` mois par mois : `Date | Libellé | Montant | Type` + encadré `.alert.high` avec **Verdict** explicite indiquant « BLOQUANT — dossier à sécuriser avant dépôt » + actions correctives (justifier l'incident, apurer la dette, attendre délai de purge, changer de banque de domiciliation si pertinent, produire une attestation Banque de France -FICP/-FCC). Si aucune anomalie détectée sur les 3 mois : afficher `.alert.low` « ✅ Aucun incident de compte sur la période — comportement bancaire sain, argument fort pour la banque. »

**2. Jeux (FDJ, paris sportifs, PMU)** — 🔴 icône rouge
Compter chaque opération FDJ/PMU/paris en ligne. Quantifier : nombre d'opérations par mois, total mensuel, détail de chaque montant. Calculer le % du salaire net. Les banques voient « Fdj Boulogne Billanc » sur chaque relevé — c'est un motif classique de refus.

**3. Tabac / CBD / "Vices"** — 🔴 icône rouge
Identifier les enseignes tabac (Havane, Bureau de tabac, CBD shops…). Signaler tout achat unitaire anormalement élevé (>50 €). Cumuler avec les jeux pour calculer le total "dépenses vices".

**4. Retraits DAB (espèces)** — 🟡 icône orange
Volume et fréquence des retraits. Calculer le % du salaire en cash. Signaler les retraits nocturnes, les retraits le même jour en plusieurs fois, les montants inhabituellement élevés. L'usage cash est opaque et peut masquer d'autres dépenses (jeux, tabac…).

**5. Abonnements numériques (Apple, Google)** — 🟡 icône orange
Lister tous les prélèvements Apple---

## ✅ CHECKLIST DE LIVRAISON — OBLIGATOIRE AVANT FIN DE SKILL

> **Règle absolue** : avant de considérer le HTML terminé et de le livrer au workspace, Claude DOIT créer une TodoList dédiée "Checklist livraison dossier-html" et cocher **un par un** chaque bloc obligatoire ci-dessous contre le fichier HTML produit. Si un bloc manque, corriger AVANT de livrer. Cette checklist n'est pas optionnelle — elle est la dernière étape du skill.
>
> **Méthode** : ouvrir le HTML généré, faire Ctrl-F sur chaque intitulé de bloc, vérifier la présence ET la conformité à la spec. Ne PAS se fier à sa mémoire de ce qu'on vient d'écrire — toujours vérifier dans le fichier.

### Onglet 1 — État civil
- [ ] Badge date de génération
- [ ] Grille KPI 4 vignettes (Emprunteur 1, Emprunteur 2, Régime matrimonial, Foyer)
- [ ] Card Emprunteur 1 (fiche-table complète : état civil + coordonnées)
- [ ] Card Emprunteur 2 (idem)
- [ ] Card Foyer fiscal (enfants + parts IRPP + statut)
- [ ] Card Situation professionnelle (Emprunteur 1 + Emprunteur 2)
- [ ] Card Banque principale (compte-list)

### Onglet 2 — Revenus
- [ ] Grille KPI 4 vignettes (Total foyer + revenus par emprunteur + CAF/pensions)
- [ ] Une revenue-card par source de revenu (chaque emprunteur + CAF + pensions le cas échéant)
- [ ] Card Synthèse revenus foyer
- [ ] Card Cohérence fiscale (RFR N-1, N-2, statut imposable)

### Onglet 3 — Patrimoine
- [ ] Grille KPI 4 vignettes
- [ ] Card Épargne & apport (détail livrets, PEL, AV, titres)
- [ ] Card Patrimoine immobilier (biens détenus OU statut primo-accédant + logement actuel)
- [ ] Card Crédits en cours (tableau avec devenir : conservé / soldé)
- [ ] Card Charges récurrentes principales

### Onglet 4 — Projet
- [ ] Grille KPI 4 vignettes (Prix, Travaux/Frais, Coût total, Surface ou Type)
- [ ] Card Bien acquis (fiche-table complète : adresse, type, année, DPE, parcelle, vendeur, destination, zone)
- [ ] Card Calendrier opérationnel (compromis, acte, travaux, livraison)
- [ ] Card Travaux (si projet avec travaux — devis détaillés)
- [ ] Card Plan de financement — Synthèse (cohérent au centime près avec onglet Financement)

### Onglet 5 — Financement ⚠ ONGLET LE PLUS CONTRÔLÉ
- [ ] **Bandeau KPI 6 vignettes en 2 lignes × 3 colonnes** (Mensualité lissée, TE, RAV — puis Durée, LTV, Saut de charge)
- [ ] Vignette LTV : détail affichant le calcul avec les deux opérandes (numérateur ÷ dénominateur)
- [ ] Vignette Saut de charge : détail affichant « charge actuelle → nouvelle mensualité »
- [ ] Pas de card détaillée LTV ni Saut de charge en 48px plus bas (supprimées — infos condensées dans les KPI)
- [ ] Card **Récapitulatif coût total** (lignes au centime près depuis §0.3 du summary simulation si mode SUMMARY, sinon DDP page 4 / ALTO — pas de ligne à 0 €)
- [ ] Card **Plan de financement détaillé** (une sous-section h3 par prêt + apport)
- [ ] Card **Assurance emprunteur** (type groupe/délégation + taux + quotités)
- [ ] **Graphique SVG d'amortissement** (empilé capital / intérêts / assurance)
- [ ] Card **Paliers de mensualités** (grille N colonnes si lissage / multi-paliers)
- [ ] Card **Conformité HCSF** (récap badges conformes TE / Durée / Nature / RAV)

### Onglet 6 — Pièces à fournir
- [ ] Grille KPI 4 vignettes
- [ ] Sections P1 à P5 (une card par famille) avec tableau pieces + statuts colorés

### Onglet 7 — Notes internes 🔒
- [ ] Badge "Document interne"
- [ ] Grille KPI 4 vignettes (Alertes critiques / modérées / favorables / Score confiance)
- [ ] Encadré contact (coordonnées emprunteurs)
- [ ] Section 1 — Synthèse stratégique courtier
- [ ] Section 2 — Alertes critiques (🔴)
- [ ] Section 3 — Alertes modérées (🟡)
- [ ] Section 4 — Points favorables (🟢) / Circuit financier
- [ ] Section 5 — Notes fichiers (doublons, corrompus, nommage)
- [ ] Section 6 — **Analyse forensique 13 catégories** (chaque catégorie même si RAS)
- [ ] Section 7 — **Score de confiance bancaire** (2 colonnes EN L'ÉTAT / APRÈS COMPLÉTION + barre gradient)
- [ ] Recommandation courtier (actions + banques cibles)
- [ ] Bloc signature Sébastien AUJARD

### Cohérence financière transversale
- [ ] Total projet identique dans Projet (synthèse) ET Financement (récap coût) ET Financement (plan détaillé)
- [ ] Mensualité identique partout
- [ ] Montants de prêts identiques partout
- [ ] Apport identique partout
- [ ] **Aucune ligne à 0 €** dans les tableaux financiers
- [ ] **Aucun préfixe flou** (~, env., ≈, estimé, à caler, à définir) si une source de montage est présente (summary simulation ou DDP/ALTO)
- [ ] Tous les montants recopiés **au centime près** depuis `AA summary simulation.txt §0` (mode SUMMARY) OU, à défaut, depuis la DDP page 4 / ALTO (mode PDF)
- [ ] **Mode de sourcing tracé** en tête de TodoList : « Mode SUMMARY » si `AA summary simulation.txt` présent, sinon « Mode PDF — summary simulation absent »
- [ ] En mode SUMMARY : aucune lecture directe de DDP / ALTO / PDF du dossier client

### Livraison
- [ ] Nom de fichier : `AA [NOM1] [nom2]-dossier AAAA-MM-JJ.html`
- [ ] Fichier copié dans le workspace utilisateur (pas seulement dans /sessions)
- [ ] Lien computer:// fourni à l'utilisateur

---

**Si l'une des cases reste décochée après vérification, le HTML N'EST PAS livrable — corriger d'abord.**
