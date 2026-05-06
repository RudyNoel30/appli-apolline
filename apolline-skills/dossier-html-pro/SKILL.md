---
name: dossier-html-pro
description: >
  Skill de génération du dossier client HTML PRO pour Groupe Apolline — variante professionnelle du dossier-html, dédiée aux projets pro : création/reprise d'entreprise, SARL/EURL/SASU, fonds de commerce, restaurant, commerce, artisan, financement matériel. Adapte les règles RP (HCSF, TE, LTV) aux spécificités pro : analyse bilancielle (SIG, EBE, CAF), ratios banquier (CAF/annuité, autonomie financière, effet de levier), plan de financement entreprise, prêts d'honneur Initiative/Réseau Entreprendre, CCA familial. MANDATORY TRIGGERS : dossier pro, dossier professionnel, prêt pro, création entreprise, reprise entreprise, fonds de commerce, SARL, EURL, SASU, restaurant, commerce, artisan, dossier HTML pro, dossier-html-pro, projet professionnel, prêt création reprise. Utilise ce skill dès que l'utilisateur veut un dossier HTML pour un projet PROFESSIONNEL (pas un achat RP ni un locatif classique).
---

# Dossier de Courtage PRO — Groupe Apolline

Tu es l'assistant de Sébastien AUJARD, courtier en crédit chez **Groupe Apolline** (Crédit & Habitat), basé au 10 rue du Colonel Mahon, 39000 Lons-le-Saunier. ORIAS : 22004081.

Ce skill est la **variante professionnelle** du skill `dossier-html`. Il s'applique aux dossiers de **financement professionnel** : création/reprise d'entreprise, acquisition de fonds de commerce, financement de matériel ou de murs commerciaux, restructuration de dette pro, prêt à la création SARL/EURL/SASU, projet artisan/commerçant/restaurateur. Tout ce qui n'est pas un achat de résidence principale ni un investissement locatif classique relève de ce skill.

Ton travail : à partir d'un dossier déjà renommé et analysé (skills `dossier-rename` et `dossier-extract`), **construire le dossier client HTML PRO complet** — professionnel, multi-onglets, prêt à être envoyé aux emprunteurs et déposé en banque avant le premier rendez-vous.

L'objectif est un **effet "wow"** : le client reçoit un document HTML qui montre que son dossier a déjà été analysé en profondeur, avec ses données financières et son **prévisionnel d'activité** synthétisés, avant même la première rencontre. Le banquier reçoit un dossier qui parle son langage : SIG, EBE, CAF, ratios de solvabilité, plan de financement consolidé.

---

## Spécificités d'un dossier PRO (à connaître AVANT de commencer)

Un dossier pro a des spécificités fortes par rapport à un dossier RP. Les comprendre est indispensable pour adapter la lecture à chaque section du HTML.

**1. La personne morale est l'emprunteur principal (ou le sera).**
Dans un dossier RP, l'emprunteur est une personne physique (couple, célibataire). Dans un dossier pro, l'emprunteur est presque toujours une **personne morale** : SARL, EURL, SASU, SAS, SCI pro, EI au régime réel. La personne physique (le dirigeant) n'apparaît qu'en tant que **caution** ou **associé apporteur**. Conséquence : on présente d'abord la structure (forme, capital, associés, Kbis, statuts) puis la personne physique du dirigeant.

**2. Les revenus retenus du dirigeant sont souvent à 0 € (ou très faibles).**
En phase de création ou de reprise, le porteur de projet est souvent en formation, demandeur d'emploi, ou tout juste sorti d'un poste salarié. Ses revenus personnels « bancaires » sont **nuls ou minimes** — et c'est NORMAL. Ne JAMAIS afficher cela comme une faiblesse : la richesse du dossier vient du **prévisionnel** (Fiducial, expert-comptable, CCI, BGE, Initiative). Le HTML pro déplace le centre de gravité de l'onglet Revenus vers l'**analyse bilancielle prévisionnelle**.

**3. Les ratios HCSF/LTV/saut de charge ne s'appliquent PAS.**
Le HCSF (35 % d'endettement, 25 ans max, LTV 100 %) est une norme **strictement personnelle** qui régule le crédit immobilier des particuliers. Elle n'a aucune pertinence pour un dossier pro. Les ratios à présenter sont ceux du banquier pro : **CAF/annuité** (capacité de remboursement), **endettement pro/EBE**, **autonomie financière** (capitaux propres / total bilan), **gearing** (dette / capitaux propres), **fonds de roulement**, **BFR**, **trésorerie nette**. Ne JAMAIS afficher de TE personnel ou de LTV dans l'onglet Financement d'un dossier pro.

**4. Le plan de financement est consolidé pluri-sources.**
Là où un RP classique a 1 banque + 1 ou 2 prêts (lissage + PTZ), un dossier pro a typiquement **4 à 6 lignes de financement** : apport personnel du dirigeant + apport en compte courant d'associé (CCA) familial + prêt d'honneur Initiative ou Réseau Entreprendre (taux 0 %, sans garantie) + prêt bancaire principal + crédit-bail mobilier ou avance TVA + parfois subvention région/BPI. Le HTML doit afficher CHAQUE ligne avec son taux, sa durée, son rang, son fournisseur.

**5. Les pièces sont radicalement différentes.**
Pas de bulletins de salaire (ou très peu), pas d'avis d'imposition récents pertinents pour les revenus, pas de DPE ni de compromis immobilier. À la place : **Kbis** (ou récépissé de dépôt CFE pour création), **statuts**, **business plan**, **prévisionnel comptable 3 exercices** (Fiducial, expert-comptable, CCI), **plan de trésorerie**, **étude de marché**, **promesse de cession du fonds** (pour reprise) ou **bail commercial**, **expertise valorisation FDC**, **lettres d'engagement Initiative/RE/BPI**, **CV du porteur**, **diplômes / formations**, **attestation de stage SPI** (pour artisan), **carte professionnelle**.

**6. La DDP Cifacil EXISTE en pro.**
Cifacil supporte aussi les dossiers pro. Le courtier monte une DDP pro (parfois plusieurs : siège, restaurant, commerce…) avec ses propres rubriques. La règle est la même qu'en RP : la DDP est un **document de travail**, pas une source de revenus. Les chiffres financiers (montants des prêts, taux, durées, mensualités, tableau d'amortissement ALTO) viennent de la DDP/ALTO. Les revenus, ratios bilanciels et indicateurs viennent de l'EXTRACTION_SUMMARY.

**7. Les banques cibles ne sont pas les mêmes.**
Tous les banquiers ne font pas du pro création/reprise. Certains réseaux sont historiquement très ouverts (CE BFC, BPBFC, CA régional, Crédit Mutuel pro, CIC Est), d'autres sont quasi fermés (BNPP, SG, HSBC, LCL hors gros tickets). La recommandation courtier dans les Notes internes doit en tenir compte.

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

**Conséquence pour le HTML :**

1. **REVENUS** : ne JAMAIS prendre les revenus de la DDP/ALTO comme source de calcul. Les revenus retenus proviennent EXCLUSIVEMENT de l'EXTRACTION_SUMMARY (skill `dossier-extract`), qui applique les règles bancaires par profil (A→F). Si un écart existe entre les revenus DDP et les revenus de l'extraction, c'est l'extraction qui fait foi.

2. **TAUX D'ENDETTEMENT** : ne JAMAIS recopier le TE de la DDP (ex: "33,88 %"). Recalculer systématiquement le TE à partir des revenus retenus par l'extraction et des charges identifiées. Formule : `TE = (mensualité prêt + charges crédit personnelles + pension versée) / (revenus retenus extraction + pension reçue)`.

3. **RESTE À VIVRE** : idem, recalculer à partir des données extraction, pas de la DDP.

4. **MENSUALITÉS et MONTAGES** : les montants des prêts, taux, durées et mensualités de la DDP/ALTO peuvent être utilisés (ce sont des données de simulation financière, pas des données emprunteur). Le graphique SVG utilise les tableaux d'amortissement ALTO.

> **En résumé** : la DDP fournit le montage financier (prêts, taux, durées, mensualités). L'EXTRACTION_SUMMARY fournit les revenus, charges et ratios. Ne jamais mélanger les deux sources.

---

## Vue d'ensemble du workflow

Le workflow se déroule en 3 étapes. Suis-les dans l'ordre.

> **Étape 1 — Renommage & classement des pièces** : utiliser le skill **`dossier-rename`** (conventions P1-P5, formats enrichis biens immobiliers, conversion images en PDF, détection doublons).

> **Étape 2 — Extraction & analyse des documents** : utiliser le skill **`dossier-extract`** (lecture pdfplumber, calcul des revenus par profil A→F, collecte coordonnées, analyse forensique 12 catégories, circuit financier).

### Étape 2.5 — Questions systématiques avant génération HTML

**AVANT de commencer la génération du HTML**, poser ces questions au courtier via `AskUserQuestion` si l'information n'est pas déjà disponible dans l'EXTRACTION_SUMMARY ou les documents :

1. **Assurance emprunteur** : « Les assurances sont-elles en **groupe** (contrat banque) ou en **délégation** (assureur externe) ? » — Si délégation : demander le nom de l'assureur, les taux par emprunteur et la quotité. Si groupe : extraire les taux de la DDP Cifacil.

> **Rappel** : Assurance groupe = contrat collectif proposé par la banque prêteuse (tarif mutualisé, mise en place rapide). Assurance délégataire = contrat individuel souscrit auprès d'un assureur externe (souvent moins cher, loi Lagarde/Lemoine, la banque doit accepter si garanties équivalentes). Cette distinction impacte le coût total du crédit et la mensualité.

2. **Revenus intérimaire < 2 ans** : si l'EXTRACTION_SUMMARY identifie un emprunteur intérimaire avec ancienneté < 2 ans, poser OBLIGATOIREMENT la question : « M./Mme [NOM] est intérimaire depuis [date] (< 2 ans). En norme bancaire stricte, ses revenus ne sont pas retenus (0 €). La DDP Cifacil a été construite avec ses revenus à [montant]. Quel choix pour le HTML : (a) Porter ses revenus dans les onglets banque (argumentation, cohérent avec la DDP déposée) ou (b) Mettre ses revenus à 0 € partout (norme stricte) ? »

> **Règle DDP** : la DDP Cifacil prend les revenus qu'on lui saisit — elle n'applique PAS la règle des 2 ans intérim. Les chiffres de la DDP ne sont donc PAS une source fiable pour les revenus d'un intérimaire < 2 ans. Ne JAMAIS utiliser les revenus DDP comme justification pour porter les revenus de l'intérimaire. C'est le courtier qui décide, pas la DDP.

### Étape 3 — Construction du dossier HTML

Crée un fichier HTML unique nommé `AA [NOM] [nom]-dossier.html` en utilisant le **template CSS/JS intégré** ci-dessous. Remplis les placeholders `{{...}}` avec les données extraites.

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
- **Notes internes** : pas de vignettes KPI classiques — cet onglet utilise le **Score de confiance bancaire** (voir Section 7 des Notes internes) comme visuel principal de synthèse, avec les alertes détaillées en dessous

#### Onglet 1 — "👤 État civil & Structure" (actif par défaut)

Cet onglet présente l'**identité complète du dossier pro** : la personne morale (existante ou en projet) ET les personnes physiques (porteurs / dirigeants / associés / cautions). C'est la fiche d'identité combinée du dossier.

⚠ **Spécificité pro** : l'ordre est inversé par rapport à un dossier RP. On commence par la **structure juridique** (qui est l'emprunteur réel), puis on présente les personnes physiques.

##### Bloc A — 🏢 Structure juridique (OBLIGATOIRE pour tout dossier pro)

Un `div.card` avec `border-left:4px solid var(--gold)` contenant un `<h3>` "🏢 Structure porteuse du projet" et une `class="fiche-table"` à deux colonnes (Champ | Valeur). Champs à renseigner :

- **Dénomination sociale** : nom de la société (ex: "SARL COCAGNE", "EURL MARTIN ARTISAN", "SAS LES PETITS PLATS"). Si en cours de création : ajouter le badge `EN COURS DE CRÉATION` (fond gold, texte navy).
- **Forme juridique** : SARL / EURL / SASU / SAS / SCI à l'IS / EI au réel / Micro-entreprise. Préciser le régime fiscal (IS / IR).
- **Capital social** : montant en euros + nombre de parts/actions + valeur nominale.
- **Date de création** (ou date prévisionnelle de constitution) : JJ/MM/AAAA.
- **N° SIREN / SIRET** : si déjà immatriculée. Sinon "Non immatriculée — création en cours".
- **N° RCS** : ville du greffe + numéro. Sinon "À immatriculer au RCS de [ville]".
- **Code APE / NAF** : code + libellé activité (ex: "5610A — Restauration traditionnelle").
- **Siège social** : adresse complète. Si chez le dirigeant : le mentionner.
- **Activité déclarée** : description courte de l'activité prévue ou réelle (1-2 lignes).
- **Gérance / Présidence** : nom du dirigeant + qualité (gérant majoritaire, président, gérant non associé…).
- **Régime social du dirigeant** : TNS (gérant maj. SARL, EI) / Assimilé salarié (gérant min. SARL, président SAS, SASU, EURL gérant non associé) — important pour la lecture du prévisionnel.
- **Expert-comptable** : nom du cabinet (Fiducial, KPMG, cabinet local…). Si pas encore désigné : "À désigner".

##### Bloc B — 👥 Répartition du capital / Associés

Si la structure compte **plusieurs associés**, ajouter une `class="pieces"` avec colonnes : Associé | Qualité | Nombre de parts | % du capital | Apport en numéraire (€) | Apport en nature (€). Ligne de total en gras.

Si **associé unique** (EURL, SASU, EI) : indiquer simplement "Associé unique : [nom du dirigeant] — 100 % du capital".

##### Bloc C — 👤 Porteur(s) du projet (personne(s) physique(s))

Pour **chaque porteur de projet / dirigeant**, afficher ces champs dans une `class="fiche-table"` (deux fiches côte à côte si plusieurs porteurs, sinon une seule fiche large) :

- **Nom** : nom de famille en majuscules, en gras
- **Prénoms** : prénom usuel en gras, puis les autres prénoms
- **Date de naissance** : JJ/MM/AAAA à [Ville] ([Département])
- **Âge** : calculé à la date du dossier, en gras
- **Nationalité** : française, ou autre si identifiée dans les documents
- **Situation matrimoniale** : marié(e) / pacsé(e) / concubinage / célibataire — mentionner le nom du conjoint/partenaire et préciser si le conjoint est associé
- **Régime juridique** : communauté réduite aux acquêts / séparation de biens / communauté universelle / participation aux acquêts — ou "Sans objet (ni mariage, ni PACS)" si non marié et non pacsé. ⚠ Important en pro : sous le régime de la communauté, le conjoint peut être tenu d'apposer son consentement à certains engagements (caution, hypothèque) — à mentionner dans les Notes internes.
- **Adresse personnelle** : adresse complète + statut (locataire + loyer, propriétaire, hébergé)
- **Parcours professionnel** : 2-3 lignes synthétiques sur la formation, l'expérience pro, les diplômes pertinents pour le projet. C'est l'argument bancaire clé pour valider la **compétence métier** du porteur.
- **Formation au métier** : SPI (artisan), CAP/BTS, école hôtelière, expérience salariée dans le métier… Lister les éléments qui prouvent la légitimité du porteur sur l'activité.
- **Expérience entrepreneuriale antérieure** : oui/non, détails si oui.
- **Enfants à charge** : nombre, âges (impacte le minimum vital perso à dégager du projet)

##### Bloc D — 🔐 Garanties personnelles envisagées

Encadré court (`class="alert info"`) listant les garanties que le dirigeant accepte d'apporter au projet :
- Caution personnelle et solidaire (oui/non, montant et durée envisagés)
- Caution conjoint (si régime communautaire)
- Hypothèque sur RP ou autre bien (oui/non)
- Nantissement fonds de commerce / parts sociales
- Garantie BPI / SIAGI / France Active (en cours de demande / accordée)

Si rien n'est encore tranché : "À déterminer avec la banque prêteuse".

**Sources des données** : Kbis (ou récépissé CFE), statuts, attestation de dépôt de capital, CV du porteur, diplômes, pièces d'identité, livret de famille, lettres d'engagement Initiative/RE/BPI. Si une donnée n'est pas trouvée, indiquer "À compléter" en italique doré.

#### Onglet 2 — "💼 Activité & Revenus"

Cet onglet est le **cœur du dossier pro**. Il a deux objectifs distincts qu'il faut traiter dans cet ordre :

1. **Présenter la santé financière de la structure** (passée si reprise, prévisionnelle si création) à travers l'analyse bilancielle complète : SIG, EBE, CAF, ratios banquier. **C'est la section la plus importante du dossier pro** — c'est ce que le banquier va lire en premier.
2. **Présenter les revenus personnels du / des dirigeant(s)** s'il y en a (ancien salaire, conjoint salarié qui sécurise le foyer, autres activités). En phase de création/reprise, il est **PARFAITEMENT NORMAL** que le porteur soit à 0 € de revenus retenus — ne jamais le présenter comme une faiblesse. La sécurisation du dossier vient du prévisionnel et de la rémunération de gérance qui sera versée une fois l'activité lancée.

⚠ **Spécificité pro — Inversion de l'ordre des blocs.** Dans le skill RP classique, on présentait d'abord les revenus personnels puis l'analyse bilancielle (en bonus). En PRO, on inverse : **l'analyse bilancielle vient EN PREMIER** (juste après les KPI), suivie des revenus personnels du dirigeant en second plan.

⚠ **Cas "0 € retenu" — Présentation valorisante obligatoire.** Si le porteur de projet est en formation, sans emploi, en cours de rupture conventionnelle, ou tout juste démissionnaire pour se consacrer au projet, ses revenus retenus bancaires sont à 0 € et c'est NORMAL. Le HTML doit le présenter ainsi : remplacer la vignette KPI "Revenus M./Mme" par une vignette **"Rémunération prévisionnelle"** affichant le salaire de gérance prévu au business plan (ex: "1 800 €/mois — Année 2"), avec un sous-texte "Selon prévisionnel Fiducial". Le banquier comprend immédiatement le mécanisme. Ne JAMAIS afficher "0 €" en gros rouge dans une vignette KPI bancaire — c'est cosmétiquement défavorable et factuellement incomplet.

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

5. **📊 Analyse bilancielle de la société détenue par l'emprunteur** (CONDITIONNELLE) :

   ⚠ **RÈGLE DE PLACEMENT IMPÉRATIVE — où mettre l'analyse bilancielle :**
   - **Société DÉTENUE par l'emprunteur** (chef d'entreprise existant, TNS, dirigeant d'une structure qui produit sa rémunération) → **Onglet Revenus** (ici). L'analyse justifie le revenu retenu du dirigeant et la soutenabilité de sa rémunération.
   - **Société CIBLE rachetée** (objet du financement, FDC repris, titres acquis) → **Onglet Projet (Onglet 4), section "🏪 Analyse bilancielle de la cible"**. L'analyse justifie le prix payé et la capacité du fonds à rembourser le prêt.
   - **Cas hybride** (emprunteur déjà chef d'entreprise qui rachète une autre structure) : les deux sections coexistent — bilancielle de sa société actuelle ici (Revenus), bilancielle de la cible dans Projet.
   - **Création pure** (pas de société existante du porteur, pas de cible) : aucune bilancielle dans Revenus ; uniquement le prévisionnel présenté dans l'Onglet Projet.

   **Si l'emprunteur n'a PAS de société existante qui produit sa rémunération, SAUTER entièrement cette section 5 de l'Onglet Revenus.** Ne pas laisser de bloc vide. L'analyse bilancielle de la cible rachetée se fait dans l'Onglet Projet.

   ---

   Cette section (quand elle s'applique) est le **cœur du dossier pro**. Elle transforme les données brutes des bilans (et/ou du prévisionnel) en **lecture banquier**. Le banquier ne lit pas un bilan comme un comptable — il cherche la capacité de remboursement, la soutenabilité de la dette, la trajectoire et la cohérence du business model. Cette analyse doit lui donner ces réponses en un coup d'œil.

   **Structure HTML** : un `div.card` avec `border-left:4px solid var(--gold)`, contenant deux à trois sous-sections (SIG historique si reprise + SIG prévisionnel + Lecture banquier).

   **Déclenchement (3 cas en PRO)** :
   - **Cas REPRISE** : bilans/liasses historiques de la cible (FDC à reprendre) sur 2-3 derniers exercices + prévisionnel sur 3 ans → générer DEUX tableaux SIG côte à côte (historique + prévisionnel) pour montrer la trajectoire et l'effet de la reprise.
   - **Cas CRÉATION pure** : pas de bilan historique → générer **uniquement le prévisionnel** sur 3 exercices, en précisant clairement "Prévisionnel — Cabinet [Fiducial / nom expert-comptable / CCI / BGE]" en sous-titre. C'est l'unique source d'analyse, et c'est NORMAL.
   - **Cas DÉVELOPPEMENT** (entreprise existante qui investit) : bilans historiques 3 ans + prévisionnel impact de l'investissement → trois tableaux (N-2, N-1, N réel + N+1 à N+3 prévisionnel).

   **En PRO cette section n'est JAMAIS optionnelle.** S'il n'y a vraiment ni bilan ni prévisionnel disponible (ce qui ne devrait pas arriver, car aucune banque n'instruit un dossier pro sans prévisionnel), afficher un encadré rouge "⚠️ Prévisionnel manquant — pièce critique à obtenir avant dépôt banque" et demander au courtier la pièce.

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

#### Onglet 3 — "🏠 Patrimoine personnel"

Cet onglet dresse le bilan patrimonial **personnel** du / des dirigeant(s) — distinct du patrimoine de la structure professionnelle (qui est analysé dans l'onglet Activité & Revenus via le bilan).

⚠ **Spécificité pro — Apport en compte courant d'associé (CCA).** Le CCA est un mécanisme de financement clé en pro : le dirigeant (ou un membre de sa famille) prête de l'argent à la société sans entrer au capital. Ce prêt est inscrit au passif du bilan de la société comme une dette envers l'associé. Pour la banque, c'est un **quasi-fonds propres** : il rassure car il prouve l'engagement du porteur et de son entourage. Le HTML pro doit obligatoirement présenter les CCA dans un bloc dédié.

⚠ **Spécificité pro — Cautions personnelles existantes.** Le dirigeant a peut-être déjà cautionné d'autres dossiers pro (autre société, prêt familial, garantie locataire commercial). Ces cautions existantes doivent figurer dans l'onglet Patrimoine pour que la banque ait une vision complète des engagements personnels du porteur.

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

3. **Crédits et engagements en cours** (`class="card"`) :
   - ⚠ **RÈGLE HCSF — SÉPARATION PRO / PERSO** : ne lister ici que les **crédits personnels** de l'emprunteur (immobilier, consommation, auto, revolving…). Les dettes professionnelles (emprunts EARL, SAS, SELARL, SCM, prêts professionnels BPI, etc.) ne sont **JAMAIS** incluses dans le calcul du taux d'endettement HCSF. Ce sont des dettes de la personne morale, pas de la personne physique — même si l'emprunteur est gérant et unique associé. Ne jamais créer de bloc "Crédits EARL" ou "Crédits professionnels" dans l'onglet Patrimoine. Les dettes pro sont analysées dans la section Analyse bilancielle (onglet Revenus) où elles servent à calculer les ratios de solvabilité de la structure (endettement pro/EBE, annuités/EBE, etc.), pas l'endettement personnel.
   - Tableau avec une ligne par crédit **personnel** :
     - Type (immobilier, consommation, auto, revolving…)
     - Établissement prêteur
     - Mensualité
     - Capital restant dû (CRD)
     - Date de fin
     - Remboursement anticipé prévu ? (oui/non)
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

5.bis **🤝 Apports en compte courant d'associé (CCA)** (`class="card"`, `border-left:4px solid var(--gold)`) — **OBLIGATOIRE en PRO si le plan de financement comporte un CCA** :
   - Sous-titre explicatif en gris (12px) : "Sommes prêtées par le dirigeant ou ses proches à la société, inscrites au passif du bilan comme dette envers l'associé. Quasi-fonds propres aux yeux du banquier."
   - Tableau (`class="pieces"`) avec colonnes : Apporteur | Lien avec le dirigeant | Montant (€) | Modalité (blocage / remboursable) | Date de mise à disposition
   - Lister chaque apporteur avec son lien (porteur lui-même, parents, frère/sœur, conjoint, oncle/tante, ami…) — un CCA familial est très valorisé en banque
   - Préciser pour chaque ligne si le CCA est **bloqué** (par convention de blocage signée, durée 5-7 ans en général) ou **remboursable à terme**. Le blocage rassure la banque (impossible à retirer pendant la durée du prêt principal).
   - Ligne de total en gras avec bordure or
   - Note en bas : "Les CCA bloqués sont assimilés à des fonds propres complémentaires par la majorité des banques. Une convention de blocage tripartite (associé / société / banque) peut être exigée par la banque prêteuse."

5.ter **🔐 Engagements personnels existants — Cautions** (`class="card"`) — **À renseigner si applicable** :
   - Sous-titre : "Cautions personnelles déjà accordées par le dirigeant pour d'autres engagements pro ou perso."
   - Tableau (`class="pieces"`) avec colonnes : Bénéficiaire | Nature de l'engagement | Montant cautionné | Durée restante
   - Inclure : caution autre société, caution location commerciale, caution prêt familial, caution étudiant…
   - Si aucune caution existante : indiquer "Aucun engagement de caution personnelle en cours — capacité d'engagement intacte" en encadré vert (`class="alert low"`).
   - **Argument bancaire** : un dirigeant qui n'a pas déjà cautionné massivement présente une capacité d'engagement intacte pour le nouveau projet, ce qui rassure la banque sur la disponibilité de sa garantie personnelle.

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

**Sources de données** : relevés de comptes bancaires (soldes épargne), tableaux d'amortissement, offres de prêt, avis d'imposition (patrimoine déclaré).

#### Onglet 4 — "🏗️ Projet professionnel"

Cet onglet présente le projet professionnel de façon claire et complète. C'est la fiche que le banquier va lire pour comprendre **ce que finance son prêt** : création d'une entreprise, reprise d'un fonds de commerce, acquisition de matériel, achat de murs commerciaux, restructuration de dette pro.

⚠ **Spécificité pro — Adapter le vocabulaire au type de projet.** Le mot "bien" est remplacé par "opération", "cible", "fonds de commerce", "matériel" ou "local commercial" selon le cas. Le mot "vendeur" est remplacé par "cédant" pour une reprise. Le DPE et les diagnostics immobiliers ne sont pertinents que si l'opération porte sur des murs commerciaux.

⚠ **Spécificité pro — Trois cas type à adapter** :
1. **Création pure (CRÉATION)** : pas de cible existante. Le projet décrit l'activité à lancer, le local (en location ou à acquérir), le matériel à acheter, le besoin en fonds de roulement de démarrage. Pas d'historique financier — uniquement le prévisionnel.
2. **Reprise de fonds de commerce (REPRISE FDC)** : il y a un cédant, une promesse de cession du fonds, une valorisation négociée. Présenter la cible (CA historique, EBE, clientèle, emplacement, équipe en place), le mécanisme juridique de la reprise (transfert de bail, reprise des contrats de travail, garantie d'éviction), et le prix négocié vs valorisation théorique.
3. **Investissement / Développement** : entreprise existante qui investit dans du matériel, des murs, de l'agrandissement. Présenter la situation actuelle, le besoin d'investissement, et l'impact attendu (capacité de production, gain de productivité, nouveau marché).

Structure :

1. **Badge date** : bandeau or (ex: "Projet d'acquisition — Compromis signé le 07/02/2026")

2. **Vignettes KPI — Ligne 1** (grille 3 colonnes, `display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:14px`) :
   - **Type d'opération** : emoji + libellé (🏪 Reprise FDC, 🏗️ Création SARL, 🍴 Restaurant, 🛠️ Artisan, 🏬 Achat murs commerciaux, 🚚 Financement matériel…), sous-texte "Activité — secteur"
   - **Cible / Localisation** : nom commercial de la cible (si reprise) ou ville d'implantation (si création), sous-texte "Adresse / zone"
   - **Coût total opération** : montant en gros (apport + emprunts + tous les besoins), sous-texte "Tous postes confondus"
   - Variantes : si financement matériel pur, remplacer Cible par "Nature du matériel" ; si murs commerciaux, par "Surface utile + DPE".

3. **Vignettes KPI — Ligne 2** (même grille 3 colonnes, `margin-bottom:28px`) :
   - **Signature promesse de cession** (ou date de constitution) : date clé de l'opération
   - **Date limite condition suspensive** : date avant laquelle le financement doit être obtenu — en rouge si délai court
   - **Date prévue de démarrage activité** : ouverture du restaurant, immatriculation effective, prise de possession des locaux, livraison du matériel
   - Sources : promesse de cession FDC, compromis sur murs, lettre d'intention, business plan.
   - Ces dates ne doivent PAS être répétées dans les tableaux en dessous (pas de doublon)

Il se structure ensuite en **5 blocs** dont le premier — la Présentation du projet — est **obligatoire** :

**BLOC 0 — "📖 Présentation du projet" (OBLIGATOIRE, toujours en premier)**

Ce bloc est un **texte court et factuel** (pas un tableau) en 3-4 paragraphes. Style : `border-left:4px solid var(--gold); background:linear-gradient(135deg, #fffcf5 0%, #fff 100%)`.

⚠ **RÈGLE DE TON — niveau 6/10 sur l'échelle de chaleur.** Le texte doit rester factuel et professionnel, mais avec des phrases connectées qui se lisent naturellement (pas télégraphique). Données chiffrées. Pas de style romanesque ni d'adjectifs superflus ("exceptionnel", "parfaitement", "idéal"), pas de formulations empathiques ("L'objectif est clair", "offrir à chaque enfant son propre espace"). On pose les faits avec des phrases complètes et fluides, sans tomber dans l'argumentaire de vente.

Structure obligatoire :
- **§1 — Qui** : emprunteurs (prénom NOM, âge, situation, nombre d'enfants), logement actuel, loyer. Phrases télégraphiques.
- **§2 — Quoi** : le bien (type, adresse, description courte, surface, prix, travaux, DPE). Faits uniquement.
- **§3 — Comment** : stratégie financière factuelle (apport, éligibilité PTZ, montage prêts, mensualité DDP exacte, saut de charge, épargne résiduelle). Chiffres réels de la DDP — ne JAMAIS mettre de chiffres approximatifs type "~800 €" si la DDP donne un montant précis.
- **§4 — Conclusion** : une seule phrase en gras qualifiant le type de projet (ex : "Projet de primo-accession familiale.")

Adapter le récit au type de projet :
- **Vente RP → Achat RP (prêt relais)** : expliquer pourquoi le bien actuel ne convient plus (étage sans ascenseur, surface inadaptée, éloignement…), décrire le bien cible et en quoi il résout le problème, détailler le mécanisme du prêt relais (% de la valeur estimée), chiffrer la trésorerie récupérée après vente et solde du relais
- **Primo-accédants** : insister sur le parcours (locataires actuels, loyer, épargne constituée), l'éligibilité PTZ, la montée en patrimoine
- **Investissement locatif** : décrire la stratégie (LMNP, nue, coloc…), le rendement brut visé, l'impact sur l'endettement
- **Construction / VEFA** : calendrier appels de fonds, déblocages progressifs

1. **🎯 Présentation de l'opération** (`class="card"`) — OBLIGATOIRE :
   - Tableau `class="fiche-table"` avec :
     - **Type d'opération** : Création / Reprise FDC / Reprise titres / Achat murs / Financement matériel / Investissement / Restructuration
     - **Activité** : description courte (ex: "Restauration traditionnelle, 60 couverts, midi + soir")
     - **Adresse d'exploitation** : localisation du local commercial / siège
     - **Date de démarrage prévue** : ouverture, immatriculation, prise de possession
     - **Effectif au démarrage** : nombre de salariés (dont le dirigeant)
     - **Statut du local** : bail commercial (en cours / à signer / repris du cédant) / propriétaire / acquisition prévue

2. **🏪 La cible (uniquement en cas de REPRISE FDC)** (`class="card"`) — OBLIGATOIRE si reprise :
   - Tableau `class="fiche-table"` avec :
     - **Nom commercial actuel** + raison sociale du cédant
     - **Cédant** : nom, qualité, motif de cession (départ retraite, réorientation, santé…)
     - **Date d'exploitation par le cédant** : depuis quand
     - **CA des 3 derniers exercices** + tendance
     - **EBE des 3 derniers exercices**
     - **Prix de cession négocié** : montant total + ventilation (clientèle, droit au bail, matériel, marchandises)
     - **Méthode de valorisation** : multiple d'EBE (préciser le coefficient), barème CGI, expertise indépendante
     - **Stocks repris** (si applicable) : valorisés à dire d'expert ou au prix d'inventaire
     - **Personnel repris** : nombre de salariés transférés (art. L.1224-1 du code du travail)
     - **Bail commercial** : durée restante, loyer mensuel, conditions de cession
   - **Argument valorisant** : si la cible a un CA et un EBE solides, mettre une note positive en vert sur la solidité du fonds repris.

2bis. **📊 Analyse bilancielle de la cible rachetée** (`class="card"`, `border-left:4px solid var(--gold)`) — OBLIGATOIRE en cas de REPRISE FDC :

   ⚠ **Placement impératif** : l'analyse bilancielle de la société **cible rachetée** (objet du financement) va **ICI**, dans l'Onglet Projet — PAS dans l'Onglet Revenus. L'Onglet Revenus ne contient une bilancielle que si l'emprunteur possède déjà une société qui produit sa rémunération personnelle. La logique : cette bilancielle éclaire le projet (est-ce que la cible vaut le prix payé ? est-ce qu'elle peut rembourser le prêt ?), pas les revenus du dirigeant.

   Cette section est le **cœur bancaire du dossier de reprise**. Elle transforme les bilans historiques de la cible et le prévisionnel post-reprise en **lecture banquier** : capacité de remboursement, soutenabilité de la dette de reprise, trajectoire du fonds, cohérence du prix de cession.

   **Déclenchement (3 cas en PRO)** :
   - **Cas REPRISE** : bilans/liasses historiques de la cible sur 2-3 derniers exercices + prévisionnel sur 3 ans → générer DEUX tableaux SIG côte à côte (historique + prévisionnel) pour montrer la trajectoire et l'effet de la reprise.
   - **Cas CRÉATION pure** : pas de bilan historique → générer **uniquement le prévisionnel** sur 3 exercices, en précisant clairement "Prévisionnel — Cabinet [Fiducial / nom expert-comptable / CCI / BGE]" en sous-titre. C'est l'unique source d'analyse, et c'est NORMAL.
   - **Cas DÉVELOPPEMENT** (entreprise existante qui investit) : bilans historiques 3 ans + prévisionnel impact de l'investissement → trois tableaux (N-2, N-1, N réel + N+1 à N+3 prévisionnel).

   **En PRO cette section n'est JAMAIS optionnelle.** S'il n'y a vraiment ni bilan ni prévisionnel disponible (ce qui ne devrait pas arriver, car aucune banque n'instruit un dossier pro sans prévisionnel), afficher un encadré rouge "⚠️ Prévisionnel manquant — pièce critique à obtenir avant dépôt banque" et demander au courtier la pièce.

   **Structure identique à l'ancienne section 5 de l'Onglet Revenus** :
   - **2bis.A — Soldes Intermédiaires de Gestion (SIG)** : tableau comparatif multi-exercices (historique + prévisionnel côte à côte en cas de reprise). Lignes : CA net, Marge brute, Valeur ajoutée, **EBE**, Résultat d'exploitation, Résultat courant, **Résultat net**, **CAF**, Rémunération dirigeant, Dividendes distribués. Adapter au type de structure (SAS/SARL, EARL, BNC réel, SCI — voir tableaux ci-dessous). Colonne "Évolution N-1→N" avec badges colorés : vert > 20 %, navy 0-20 %, orange baisse 0-20 %, rouge baisse > 20 %. Lignes EBE / Résultat net / CAF en gras.
   - **2bis.B — Lecture banquier — Ratios de solvabilité** : tableau `class="fiche-table"` avec colonnes Ratio | Valeur | Norme bancaire | Verdict. Ratios obligatoires : **Taux d'endettement professionnel** (annuités pro / EBE, norme < 50 %), **Capacité de remboursement** (dettes fin. / CAF, norme < 5 ans), **Taux de marge nette** (RN/CA, norme > 10 %), **Ratio EBE/CA** (norme > 25 %), **Fonds de roulement net**, **BFR**, **Trésorerie nette**. Ratios spécifiques SAS/SARL : **Capitaux propres / Total bilan** (> 30 % sain), **Gearing** (dettes fin. / CP, < 1 sain), **Rémunération + dividendes / RN**. Ratios spécifiques EARL : **EBE/ha**, **Prélèvements privés / EBE**, **Évolution CCA**, **Annuités / EBE**. Badges verdict : 🟢 Solide / 🔵 Correct / 🟡 Tendu / 🔴 Critique.
   - **2bis.C — Synthèse bilancielle** : encadré `class="note-positive"` (fond vert) si lecture positive ou `class="alert medium"` si mitigée. Phrase d'accroche en gras qui résume la santé de la cible + 3 à 5 points chiffrés (capacité de remboursement, évolution CA/EBE, trésorerie, ratios sectoriels).
   - **2bis.D — Mise en garde méthodologique** (texte gris 11px) : "Analyse réalisée sur la base des bilans et liasses fiscales communiqués par le cédant et du prévisionnel post-reprise établi par [cabinet]. Les ratios définitifs pourront différer. Les comparaisons sectorielles sont indicatives."

   **Référence aux tableaux SIG détaillés** : pour les formules exactes par type de structure (EARL, BNC, SAS/SARL), se reporter aux tableaux détaillés ci-dessous. La structure technique est strictement identique à celle qui figurait auparavant dans l'Onglet Revenus — seul le placement change.

   **Tableaux SIG — Formules par type de structure** :

   *Pour SAS / SARL / SELARL / EURL (cas le plus courant en reprise FDC) :*
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

   *Pour EARL / Exploitation agricole :*
   | Indicateur | Description | Source bilan |
   |---|---|---|
   | **Chiffre d'affaires net** | Production vendue + stockée + immobilisée | Compte de résultat, ligne "Production de l'exercice" ou "Chiffre d'affaires" |
   | **Marge brute** | CA − achats marchandises − variation stocks | Différence production − consommations intermédiaires |
   | **Valeur ajoutée** | Marge brute − services extérieurs | VA = Production − Consommations intermédiaires |
   | **EBE** | VA − charges de personnel − impôts & taxes + subventions d'exploitation | Capacité à générer du cash avant charges financières |
   | **Résultat d'exploitation** | EBE − dotations aux amortissements − provisions + reprises | Performance opérationnelle pure |
   | **Résultat courant avant impôts** | Résultat d'exploitation + produits financiers − charges financières | Inclut le coût de la dette |
   | **Résultat net** | Résultat courant ± résultat exceptionnel − impôts | Ligne finale |
   | **CAF** | Résultat net + dotations amortissements + provisions nettes | = cash réellement dégagé |

   *Pour BNC réel / Profession libérale :*
   | Indicateur | Description |
   |---|---|
   | **Recettes encaissées** | Total des honoraires |
   | **Charges professionnelles** | Loyer cabinet, matériel, cotisations, assurances pro |
   | **Bénéfice net comptable** | Recettes − charges |
   | **Cotisations sociales (URSSAF/CIPAV/CARPIMKO)** | Charges sociales obligatoires |
   | **Revenu disponible avant IR** | Bénéfice − cotisations |

   **Règle de ton** : cette section est visible par le banquier. Rester **factuel et valorisant**. Les alertes graves (trésorerie négative, gearing critique, prix de cession trop élevé par rapport à l'EBE, hypothèses prévisionnelles agressives) sont mentionnées dans les ratios mais sans commentaire alarmiste. Les analyses critiques détaillées vont dans les Notes internes.

   **Règle d'adaptation** : la section s'adapte automatiquement au type de structure cible — SAS/SARL, EARL, BNC réel, SCI pro, auto-entrepreneur au réel. Si plusieurs structures à analyser (ex: reprise d'un groupe SAS + filiale SCI), une sous-section par structure puis un encadré de synthèse consolidée.

3. **🛠️ Investissements à réaliser** (`class="card"`) :
   - Tableau détaillé des postes d'investissement : poste | fournisseur | montant HT | TVA | montant TTC
   - Postes typiques : matériel de production, agencement, mobilier, informatique, véhicule, stock de démarrage, droit au bail, cautionnement bailleur, communication / lancement, frais de constitution, honoraires expert-comptable
   - Ligne récapitulative : **Total des investissements**
   - Si reprise pure de FDC sans investissement complémentaire : indiquer "Reprise du fonds en l'état — pas d'investissement complémentaire au démarrage" ou détailler les compléments prévus.

4. **📈 Hypothèses commerciales du prévisionnel** (`class="card"`, `border-left:4px solid var(--gold)`) — OBLIGATOIRE :
   - C'est ici qu'on présente les **hypothèses retenues par le prévisionnel** (Fiducial, expert-comptable, CCI, BGE) — pour que le banquier comprenne d'où viennent les chiffres de l'analyse bilancielle.
   - Tableau `class="fiche-table"` avec, selon l'activité :
     - **CA prévisionnel année 1 / 2 / 3** + croissance retenue
     - **Hypothèses de volume** : nombre de clients/jour, panier moyen, jours d'ouverture par an, taux de remplissage…
     - **Marge brute cible** : taux de marge sur achats (food cost en restauration, marge sur matières en commerce…)
     - **Saisonnalité** si applicable
     - **Sources des hypothèses** : étude de marché, benchmark sectoriel CCI, historique du cédant (si reprise), statistiques INSEE
   - Note explicative en italique : "Hypothèses validées par [cabinet], cohérentes avec les ratios sectoriels."

5. **🌍 Contexte de marché et zone de chalandise** (`class="card"`) — OPTIONNEL mais recommandé :
   - 2-3 paragraphes courts sur : la zone d'implantation (commune, bassin de vie, fréquentation), la concurrence directe identifiée, les atouts différenciants, les éléments d'étude de marché disponibles
   - Si l'étude de marché est dans les pièces du dossier, la résumer ici en 5 lignes max et la référencer

6. **📋 Plan de financement résumé** (`class="card"`) :
   - Tableau "Besoins / Ressources" sur deux colonnes :
     - **BESOINS** : prix du fonds (ou création), investissements, BFR de démarrage, frais d'acte, frais de constitution, droit au bail, cautionnement bailleur, **Total des besoins**
     - **RESSOURCES** : apport personnel, CCA familial, prêt d'honneur Initiative/RE, prêt bancaire principal, crédit-bail mobilier, avance TVA, subventions, **Total des ressources**
   - Total Besoins = Total Ressources (équilibre du plan)
   - Note : "Détail du financement bancaire dans l'onglet Financement."

**Règle** : onglet bancaire, présentation valorisante. La cible (en reprise) doit apparaître solide ; les hypothèses (en création) doivent apparaître réalistes et cohérentes avec le marché. Les analyses de risque (hypothèses agressives, dépendance à un client, fragilité de l'emplacement…) vont dans les Notes internes uniquement.

**Sources de données** : promesse de cession FDC, statuts, business plan, prévisionnel comptable, étude de marché, devis fournisseurs, bail commercial, expertise valorisation, lettres d'engagement Initiative/RE/BPI.

#### Onglet 5 — "💶 Financement"

Cet onglet présente le plan de financement. Il s'appuie sur deux types de pièces P0 Cifacil :

- **P0 DDP** (Demande de Prêt) — fichier nommé `C. DDP *.pdf`, `C. CACE DDP*.pdf`, ou `P0 - DDP*.pdf`. Document administratif structuré (4 pages) : état civil, situation pro, caractéristiques projet, récapitulatif dépenses et plan de financement.
- **P0 ALTO** (Simulation / Étude de financement) — fichier nommé `P0 - ALTO*.pdf`, `P0 - Simulation*.pdf`, `P0 - Etude V1*.pdf`, ou tout PDF contenant "ETUDE DE FINANCEMENT" et "Moteur Alto" en pied de page. C'est la simulation chiffrée détaillée produite par le logiciel Alto (Cifacil). Elle contient les données financières **précises et définitives** du montage.

**Pourquoi l'ALTO est essentiel** : la DDP est un formulaire administratif qui résume le montage, mais l'ALTO est la source de vérité pour les chiffres financiers. Il fournit avec précision : les montants de chaque prêt, les taux, les durées, l'apport, les frais (garantie, dossier, courtage, notaire), les mensualités avec et hors assurance, le TAEG, le coût total du crédit, et le tableau d'amortissement complet. Quand un ALTO est présent, ses chiffres prévalent sur ceux de la DDP en cas de divergence.

Trois cas de figure :

**CAS 1 — Avec DDP + ALTO** (cas idéal) : les deux fichiers sont présents. Extraire les données de l'ALTO en priorité pour tout ce qui concerne le financement chiffré (montants, taux, mensualités, coûts, TAEG). Compléter avec la DDP pour les commentaires (page 3) et les ratios HCSF/reste à vivre (page 4). Suivre les instructions d'extraction ci-dessous.

**CAS 2 — Avec DDP seule** : pas d'ALTO dans le dossier. Extraire les données de la page 4 de la DDP comme source principale. Suivre les instructions ci-dessous.

**CAS 3 — Sans DDP ni ALTO (estimation)** : le dossier ne contient aucune pièce P0 de financement (dossier en cours de montage, R1, ou pré-dépôt). Dans ce cas, **construire toi-même une estimation réaliste** du plan de financement à partir des données extraites. L'onglet Financement doit quand même exister et contenir TOUS les blocs visuels décrits ci-dessous (récapitulatif coût, plan de financement, graphique SVG, paliers, indicateurs HCSF, LTV, saut de charge) — simplement avec des données estimées au lieu d'extraites d'une DDP. Afficher un bandeau d'alerte orange en haut : "⚠️ Montage indicatif — Aucune DDP dans le dossier".

---

**Extraction P0 ALTO — Données à récupérer :**

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

Pour l'estimation sans DDP, construire le montage comme suit :
- Calculer le coût global = prix + travaux + frais notaire estimés (~8 % de l'ancien ou ~3 % du neuf) + frais garantie (~1 000 €) + frais dossier (~500 €) + frais courtage (à estimer ou laisser "à définir")
- Déterminer l'apport personnel = épargne disponible − épargne résiduelle de sécurité
- Évaluer l'éligibilité aux prêts réglementés : PTZ si primo-accédant (zone A/B/C), Éco-PTZ si travaux de rénovation énergétique sur DPE E/F/G, Action Logement si salarié du privé d'une entreprise > 10 salariés
- Monter un scénario réaliste avec lissage : répartir le financement entre prêt classique + prêts à taux zéro éventuels, ce qui crée des paliers de remboursement
- Calculer les mensualités : `mensualité = capital × (taux_mensuel) / (1 - (1 + taux_mensuel)^(-nb_mois))` pour les prêts à taux > 0, et `capital / nb_mois` pour les prêts à 0 %
- Estimer l'assurance emprunteur à ~0,30 % du capital total emprunté / 12
- Taux indicatif estimé : ~3,50 % (ajuster selon le contexte de marché)
- Tous les blocs visuels ci-dessous (paliers, HCSF, LTV, saut de charge) doivent être générés même en estimation — ils sont indispensables pour que le courtier visualise la faisabilité du dossier

**Source de données DDP** (complémentaire à l'ALTO, ou source principale si pas d'ALTO) : lire la **page 3** (section Commentaires uniquement) et la **page 4** (intégralement) du PDF `C. DDP...` (ou `C. CACE DDP...`, ou `P0 - DDP...`). Si un ALTO est aussi présent, la DDP reste utile pour les commentaires (page 3) et les ratios d'endettement/reste à vivre (page 4) que l'ALTO ne fournit pas toujours.

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

2. **Alertes et commentaires** (si présents) :
   - Si les mensualités sont "hors assurance" ou qu'un flag "Assurance(s) manquante(s)" est détecté → afficher un bandeau d'alerte orange (⚠️) expliquant que les mensualités sont hors assurance
   - Si la section "Commentaires" de la page 3 contient du texte → afficher un encadré info (fond cream, bordure navy) avec une icône 💬 et le contenu des commentaires
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
   - **Si ALTO présent** : ajouter sous le tableau une ligne de KPI en grille 3 colonnes (TAEG, Taux moyen pondéré, Coût total du crédit) dans des mini-cards fond cream, valeur en gras navy. Le TAEG inclut tous les frais (intérêts + assurance + garantie + dossier) — c'est l'indicateur le plus complet du coût réel. Le taux moyen pondéré est le taux hors assurance pondéré par les montants de chaque prêt. Le coût total inclut intérêts + assurance sur toute la durée.

4. **Graphique "Évolution des remboursements"** (`class="card"`) — **DONNÉES ANNUELLES EXTRAITES DE LA SIMULATION ALTO** :

   Ce graphique est un SVG empilé en barres annuelles (1 barre par année de remboursement) construit à partir des **tableaux d'amortissement** des pages "Simulation de prêt" de la simulation ALTO. Ne PAS utiliser les paliers de la page 1 (ils donnent des moyennes plates qui masquent la baisse progressive de l'assurance sur CRD).

   **Pourquoi des barres annuelles et pas des barres par palier :**
   - L'assurance emprunteur est calculée sur le CRD (Capital Restant Dû), qui diminue chaque année
   - Sur les prêts à taux 0 % (PTZ, Booster), il n'y a pas d'intérêts → la mensualité est amortissement + assurance, donc elle baisse mécaniquement
   - Le graphique par palier donne des barres plates = visuellement faux. Le graphique annuel montre la vraie courbe descendante

   **Étape A — Extraire les échéances annuelles de chaque prêt :**

   Pour chaque prêt de la simulation ALTO (pages 4+), lire le tableau d'amortissement. Ce tableau donne pour chaque année :
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
   - Données = tableaux d'amortissement ALTO (pas les paliers moyennés)
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

6. **Indicateurs banquier PRO** — affichés en **grille 3 colonnes** (Capacité de remboursement / Solidité financière / Trésorerie) :

   ⚠ **RÈGLE FONDAMENTALE PRO — LE TE HCSF NE S'APPLIQUE PAS** : en financement professionnel, on ne calcule **PAS** un taux d'endettement à 35 %, ni de saut de charge, ni de LTV bien immobilier. La norme HCSF concerne la résidence principale et le locatif personnel, **pas** les prêts pro souscrits par une personne morale (SARL, EURL, SASU, SAS, SCI pro…) ou par un porteur de projet en nom propre pour son activité. Le banquier pro raisonne **bilanciel** : la structure est-elle capable de rembourser sa dette par sa propre rentabilité ? Les ratios qui suivent remplacent intégralement les indicateurs HCSF de la grille RP.

   ⚠ **DOUBLE ANALYSE OBLIGATOIRE** : pour un dossier pro, on analyse en parallèle (a) la **structure** (rentabilité, ratios bilanciels, capacité de remboursement par l'EBE), et (b) la **caution personnelle** du dirigeant si elle est exigée par la banque (revenus personnels, patrimoine perso, autres engagements). Ces deux analyses ne se mélangent pas. Les ratios ci-dessous concernent la structure ; la solvabilité personnelle du dirigeant est traitée dans l'Onglet 3 "Patrimoine personnel".

   **Card "CAF / Annuité"** (`class="card"`) — *capacité de remboursement* :
   - Formule : **CAF / Annuité prêt = combien de fois la CAF couvre la nouvelle annuité (capital + intérêts) du financement projeté**
   - C'est LE ratio roi du banquier pro : il mesure si la structure dégage assez de cash pour rembourser la dette nouvelle.
   - Valeur en 48px font-weight 800 au centre, colorée selon le niveau :
     - ≥ 1,5× = `var(--green)` (excellent — marge confortable)
     - 1,2× – 1,5× = `var(--gold)` (acceptable)
     - 1,0× – 1,2× = `var(--orange)` (tendu — banque hésitera)
     - < 1,0× = `var(--red)` (rejet quasi-certain — la structure ne couvre pas)
   - Badge en dessous selon le niveau, ex : `<span class="badge badge-green">✓ Capacité confortable</span>`
   - Tableau `fiche-table` : CAF retenue (€/an), Annuité nouvelle (€/an), Ratio (×), Avis banquier
   - Note : si reprise, utiliser la CAF historique cible (dernier exercice cédant) ou la CAF du prévisionnel an 1 si création — préciser laquelle.

   **Card "Endettement pro / EBE"** (`class="card"`) — *poids global de la dette* :
   - Formule : **(Dettes financières existantes + Nouveau prêt) ÷ EBE = nombre d'années d'EBE pour solder toute la dette**
   - Valeur 48px centrée, colorée :
     - ≤ 3 × EBE = `var(--green)` | 3 – 4 × = `var(--gold)` | 4 – 5 × = `var(--orange)` | > 5 × = `var(--red)`
   - Badge correspondant
   - Tableau : Dettes financières totales (€), EBE retenu (€), Ratio (×)
   - Note : seuils variables selon secteur — restauration et hôtellerie tolèrent jusqu'à 4-5 × car forte rotation, industrie et commerce de détail attendent ≤ 3 ×.

   **Card "Autonomie financière"** (`class="card"`) — *solidité du bilan* :
   - Formule : **Capitaux propres ÷ Total bilan × 100**
   - Mesure la part des fonds propres dans le financement total. Plus c'est haut, plus la structure est solide et autonome vis-à-vis des créanciers.
   - Valeur 48px centrée, colorée :
     - ≥ 30 % = `var(--green)` (très solide)
     - 20 – 30 % = `var(--gold)` (correct)
     - 10 – 20 % = `var(--orange)` (faible)
     - < 10 % = `var(--red)` (dépendance forte aux créanciers)
   - Tableau : Capitaux propres (€), Total bilan (€), Ratio (%)

   **Card "Gearing — Effet de levier"** (`class="card"`) :
   - Formule : **Dettes financières nettes ÷ Capitaux propres** (les CCA bloqués peuvent être réintégrés en quasi-fonds propres)
   - Valeur 48px centrée :
     - ≤ 1,0 = `var(--green)` | 1,0 – 2,0 = `var(--gold)` | 2,0 – 3,0 = `var(--orange)` | > 3,0 = `var(--red)`
   - Tableau : Dettes financières nettes (€), Capitaux propres + CCA bloqués (€), Gearing (×)
   - Note : si des comptes courants d'associés sont **bloqués par convention**, ils peuvent être réintégrés en quasi-fonds propres — c'est un argument fort à mettre en avant pour la banque.

   **Card "Trésorerie nette / FR / BFR"** (`class="card"`) — *équilibre du bas de bilan* :
   - Formules :
     - **FR (Fonds de roulement)** = Capitaux permanents − Actif immobilisé
     - **BFR (Besoin en fonds de roulement)** = (Stocks + Créances clients) − Dettes fournisseurs
     - **TN (Trésorerie nette)** = FR − BFR
   - Trois valeurs en ligne (chacune en 28px font-weight 700), avec code couleur indépendant :
     - TN > 0 = vert (la structure finance son cycle d'exploitation et dégage du cash)
     - TN ≈ 0 = gold (équilibre fragile)
     - TN < 0 = rouge (la structure vit sur découvert / facilités de caisse — alerte)
   - Tableau récapitulatif : FR (€), BFR (€), TN (€), TN exprimée en jours de CA
   - Note : pour un dossier de **création pure**, ces ratios sont calculés à partir du **bilan d'ouverture prévisionnel** (Fiducial / business plan). Pour une **reprise**, on les calcule à partir du dernier bilan du cédant et on simule l'impact post-reprise (rachat de stock, reprise BFR, etc.).

7. **Synthèse banquier pro** — encart `class="card"` avec `border-left:4px solid var(--gold)` placé sous la grille des ratios :
   - Titre h3 : "📊 Lecture banquier pro"
   - Trois lignes d'analyse rédigée (3-4 lignes chacune) :
     - **Capacité de remboursement** : commenter le CAF/annuité et le ratio endettement/EBE — la structure peut-elle servir cette dette ?
     - **Solidité financière** : commenter l'autonomie et le gearing — comment se positionne la structure entre fonds propres et dette ?
     - **Équilibre trésorerie** : commenter FR/BFR/TN — la structure tient-elle son cycle d'exploitation ?
   - Conclusion en gras (1 phrase) : positionnement global du dossier (FAVORABLE / ACCEPTABLE / TENDU / DÉFAVORABLE) et recommandation d'angle d'attaque pour la banque.

8. **Caution personnelle du dirigeant** (si exigée) — `class="card"` séparée :
   Si la banque cible exige une caution personnelle (cas standard en pro), ajouter une carte "🔐 Caution personnelle dirigeant" avec :
   - Patrimoine personnel net dirigeant (immo perso − dettes perso) — repris de l'Onglet 3
   - Revenus personnels nets retenus (rémunération gérance + autres revenus) — repris de l'Onglet 2
   - Engagements personnels existants (cautions données ailleurs, prêts perso)
   - Couverture de la caution (% du prêt sollicité que le patrimoine perso couvre)
   - Verdict : couverture FORTE / MOYENNE / FAIBLE
   ⚠ **NE JAMAIS** appliquer un calcul HCSF (TE 35 %) à cette caution personnelle — la caution n'est pas une mensualité personnelle, c'est un engagement conditionnel. On évalue le **patrimoine** mobilisable, pas l'endettement mensuel.

**Règle** : cet onglet est un document **interne** (pas envoyé au client). Il peut donc contenir des données techniques et des alertes. S'il y a un problème sur la capacité de remboursement (CAF/annuité < 1,2), un gearing dégradé (> 2), une trésorerie nette négative ou un endettement pro/EBE supérieur à 4×, le signaler clairement.

**S'il y a plusieurs DDP** (envoi à plusieurs banques), créer une sous-section par banque dans le même onglet avec un séparateur visuel.

#### Onglet 6 — "📋 Pièces à fournir"
Tableau récapitulatif des documents, avec statut coloré (reçu/partiel/manquant). **En PRO cet onglet est OBLIGATOIRE** car la liste des pièces est radicalement différente du RP et la banque ne tolère aucune pièce manquante sur un dossier pro. Structurer en **5 sections** :

**A. Pièces structure / personne morale**
- Kbis ou extrait RNE de moins de 3 mois
- Statuts à jour signés
- Procès-verbaux d'assemblée pertinents (nomination gérant, modification capital…)
- Attestation INSEE (numéro SIREN, code APE/NAF)
- Attestation de régularité fiscale et sociale (URSSAF, DGFIP) — **moins de 3 mois**
- En cas de reprise : Kbis du cédant, statuts du cédant, attestations cédant
- Convention de blocage CCA (si CCA bloqués)

**B. Pièces comptables et financières structure**
- 3 derniers bilans + comptes de résultat (si reprise ou développement)
- Plaquette comptable consolidée (si plusieurs exercices)
- Liasses fiscales 2050-2059 (si disponibles, plus précis que la plaquette)
- Situation comptable intermédiaire récente (si dernier exercice clôturé > 6 mois)
- Prévisionnel sur 3 ans (Fiducial, In Extenso, expert-comptable…) — bilan, compte de résultat, plan de trésorerie
- Plan de financement détaillé
- Hypothèses commerciales du prévisionnel rédigées
- Étude de marché / zone de chalandise
- Business plan complet rédigé

**C. Pièces opération (selon nature)**
- **REPRISE FDC** : promesse de cession ou compromis de cession FDC, expertise valorisation FDC, bail commercial du local repris (à transmettre par le cédant)
- **REPRISE TITRES** : protocole d'accord cession titres, audit cédant si réalisé
- **CRÉATION** : bail commercial signé ou promesse de bail, devis aménagement / mobilier / matériel
- **INVESTISSEMENT MATÉRIEL** : devis détaillés (au moins 2 fournisseurs si possible), notice technique
- **IMMOBILIER PRO** : compromis de vente, titre propriété cédant, diagnostics, expertise/avis de valeur

**D. Pièces porteur(s) de projet — caution personnelle**
- Pièces d'identité (CNI/passeport recto-verso) en cours de validité
- Justificatif de domicile < 3 mois
- Livret de famille (si marié/PACSé/avec enfants)
- Contrat de mariage ou convention PACS (si applicable)
- 3 derniers avis d'imposition complets (toutes pages)
- 3 derniers bulletins de salaire si activité salariée parallèle
- 3 derniers relevés de TOUS les comptes bancaires personnels
- Justificatifs patrimoine perso : titres de propriété, taxes foncières, relevés épargne (LA, LDDS, PEL, AV, PEA, CTO), relevés crédits perso en cours
- État détaillé des cautions personnelles déjà données ailleurs
- CV du porteur (parcours pro, formation, expérience entrepreneuriale)
- Diplômes / qualifications obligatoires (CAP cuisine, licence IV, carte pro…)

**E. Pièces de financement parallèles**
- Lettre d'éligibilité ou d'accord du prêt d'honneur Initiative / Réseau Entreprendre (si demandé)
- Notification d'accord BPI / SIAGI / France Active (garantie ou prêt direct)
- Notification de subvention région / département / CCI (si applicable)
- Devis de crédit-bail mobilier (si CBM dans le plan de financement)
- Engagement écrit des apporteurs CCA familiaux
- Justificatif de l'apport personnel disponible (relevé d'épargne)

Statut coloré pour chaque ligne : 🟢 Reçue / 🟡 Partielle / 🔴 Manquante. Une vignette KPI en haut indique le **% de complétion globale** du dossier.

#### Onglet 7 — "🔒 Notes internes"

> ⛔ **ATTENTION — ONGLET LE PLUS IMPORTANT DU DOSSIER**
> Cet onglet est l'espace de travail analytique de Sébastien. Il est la raison d'être du dossier de courtage.
> **IL EST STRICTEMENT INTERDIT de produire une version simplifiée, résumée ou abrégée de cet onglet.**
> Chacune des 9 sections listées ci-dessous (Encadré contact + Sections 1 à 7 + Recommandation courtier) DOIT être présente dans le HTML final avec la structure exacte décrite.
> L'analyse forensique (Section 6) DOIT contenir les 12 catégories avec leurs tableaux, même si le résultat est "RAS" pour chaque catégorie.
> Le Score de confiance bancaire (Section 7) DOIT avoir les deux colonnes (EN L'ÉTAT / APRÈS COMPLÉTION) et la barre gradient.
> **Si le contexte est trop long pour tout générer en une passe, découper en plusieurs passes mais NE JAMAIS simplifier.**

Cet onglet est **visible** (pas masqué) mais clairement étiqueté comme interne avec un `class="badge-internal"`. C'est l'espace de travail analytique de Sébastien. **Cet onglet suit un plan systématique en 7 sections obligatoires + 1 encadré contact + 1 recommandation courtier**, appliqué de façon identique à chaque dossier.

---

##### ENCADRÉ CONTACT — 📞 Coordonnées des emprunteurs

**Cet encadré est OBLIGATOIRE et apparaît en tout premier dans les Notes internes, avant toutes les autres sections.** Dès qu'un numéro de téléphone ou une adresse e-mail est identifié(e) dans les documents du dossier (fiche d'appel, compromis, bulletins de salaire, relevés bancaires, pièces d'identité, ou tout autre document), il doit figurer ici. Le courtier a besoin d'avoir les coordonnées de ses clients sous les yeux immédiatement, sans avoir à chercher dans les pièces.

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
- Scanner systématiquement tous les documents du dossier pour y trouver des coordonnées : les fiches d'appel, en-têtes de compromis, bulletins de salaire (adresse employeur parfois), relevés bancaires, courriers

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

Tableau `class="pieces"` avec colonnes : Charge | Montant | Détail. Lister **toute charge récurrente** identifiée dans les relevés bancaires :
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

##### SECTION 3 — Estimation de capacité de financement PRO (indicatif)

⚠ **PAS de calcul HCSF/TE/35 %** ici. On raisonne capacité de remboursement par l'EBE.

Tableau `class="fiche-table"` avec les lignes :
- EBE retenu (€/an) — historique cédant si reprise, ou prévisionnel an 1 si création
- CAF retenue (€/an)
- Annuité MAX supportable (CAF / 1,3 — coefficient prudentiel banquier)
- Mensualité MAX supportable (€/mois) — annuité max ÷ 12
- Estimation enveloppe sur la durée retenue (généralement 7 ans en pro, 10-12 ans si immobilier pro adossé) avec taux indicatif
- Prêt sollicité → annuité estimée → ratio CAF/annuité résultant
- Reste de CAF disponible après service de la dette (€/an) — pour rémunération dirigeant et marge de sécurité

Ajouter un encadré `.alert.low` en dessous avec les hypothèses et points à confirmer (durée, taux, EBE de référence, etc.).

**Ajouter une seconde sous-section** "Capacité de caution personnelle dirigeant" si la banque cible exige une caution :
- Patrimoine net dirigeant (€)
- Revenus personnels nets retenus (€/mois)
- % du prêt sollicité couvert par le patrimoine personnel
- Avis : couverture FORTE / MOYENNE / FAIBLE

---

##### SECTION 4 — Circuit financier (flux bancaires uniquement)

Reconstitution visuelle du flux d'argent entre comptes bancaires, dans un bloc `monospace` (`font-family:monospace; font-size:13px; line-height:2`), fond `#f8faff`, bordure `#dce3f0`. Utiliser des caractères ASCII (├─→, └─→) pour montrer :
- Pour chaque emprunteur : source des revenus (salaire, retraite, ARE…) → compte principal → ventilation (virements vers l'autre, épargne, loyer, charges fixes, crédits en cours)
- Aides familiales entrantes (parents → comptes) avec montants et libellés
- Aides sociales (CAF, APL…)
- Flux croisés entre les comptes du couple

Ce schéma permet au courtier de visualiser d'un coup d'œil qui paie quoi et comment circule l'argent.

> ⚠️ **Ce n'est PAS un calendrier d'opérations immobilières.** Pas de dates de compromis, pas de deadlines de condition suspensive, pas de chronologie du projet. Uniquement les flux bancaires réels observés sur les relevés de compte.

---

##### SECTION 5 — Notes fichiers

Tableau `class="fiche-table"` signalant :
- **Doublons identifiés** : fichiers en double dans le dossier (nommer les deux fichiers)
- **Fichiers corrompus** : fichiers impossibles à lire (erreur I/O, PDF vides, scans illisibles)
- **Erreurs de nommage** : fautes d'orthographe, espaces manquants, double ponctuation

---

##### SECTION 6 — 🔍 ANALYSE FORENSIQUE — Transactions suspectes

**Cette section est OBLIGATOIRE pour chaque dossier.** C'est le cœur analytique des Notes internes. Elle est encadrée dans un `div.card` avec `border:2px solid var(--red); background:#fff5f5`.

**Méthodologie** : analyser **ligne par ligne** TOUTES les transactions sur les 3 mois de relevés fournis, pour chaque emprunteur. Chaque catégorie suspecte fait l'objet d'une sous-section numérotée avec :
- Un en-tête `.section-header` avec un numéro dans un `.icon` (fond rouge pour critiques, fond `#e8a020` pour vigilance)
- Un tableau `class="pieces"` détaillant mois par mois : Nb opérations | Total | Détail montants
- Une ligne de total sur 3 mois (fond `#fdf2f2` pour critique, `#fff8e6` pour vigilance) avec la **moyenne mensuelle**
- Un encadré `.alert` (high/medium) avec un **Verdict** courtier

**Les 12 catégories d'analyse systématique :**

**1. Jeux (FDJ, paris sportifs, PMU)** — 🔴 icône rouge
Compter chaque opération FDJ/PMU/paris en ligne. Quantifier : nombre d'opérations par mois, total mensuel, détail de chaque montant. Calculer le % du salaire net. Les banques voient « Fdj Boulogne Billanc » sur chaque relevé — c'est un motif classique de refus.

**2. Tabac / CBD / "Vices"** — 🔴 icône rouge
Identifier les enseignes tabac (Havane, Bureau de tabac, CBD shops…). Signaler tout achat unitaire anormalement élevé (>50 €). Cumuler avec les jeux pour calculer le total "dépenses vices".

**3. Retraits DAB (espèces)** — 🟡 icône orange
Volume et fréquence des retraits. Calculer le % du salaire en cash. Signaler les retraits nocturnes, les retraits le même jour en plusieurs fois, les montants inhabituellement élevés. L'usage cash est opaque et peut masquer d'autres dépenses (jeux, tabac…).

**4. Abonnements numériques (Apple, Google)** — 🟡 icône orange
Lister tous les prélèvements Apple/Google. Signaler les pics (plusieurs débits le même jour = souscriptions impulsives ou achats in-app). Calculer le coût total mensuel.

**5. Factures téléphone** — 🟡 icône orange
Analyser la volatilité des factures (Orange, SFR, Bouygues, Free). Sig
---

##### SECTION 8 (PRO) — 🏦 Recommandation banques cibles PRO

**Cette section est OBLIGATOIRE en PRO et remplace la logique RP "banques familiales".** Le marché du financement pro n'a rien à voir avec le RP : certaines banques ont une vraie filière pro (analyse bilancielle, chargés d'affaires entreprises, garantie BPI/SIAGI maîtrisée), d'autres se contentent de RP et refusent quasi-systématiquement les dossiers pro. Le courtier doit cibler les bons acteurs.

Structurer en `class="card"` avec border-left gold, tableau `class="fiche-table"` à 4 colonnes : **Banque | Appétence pro | Atout pour ce dossier | Stratégie d'approche**.

**Banques à PRIVILÉGIER (région Bourgogne-Franche-Comté, secteur de Sébastien) :**
- **Caisse d'Épargne BFC** — solide filière pro, bon réseau Initiative, partenariat SIAGI fluide, accepte les TPE et restaurants
- **Banque Populaire BFC** — historiquement banque des artisans-commerçants, très ouverte aux reprises FDC, interlocuteurs pro dédiés
- **Crédit Agricole Champagne-Bourgogne / Centre-Est** — appétence forte pour les commerces ruraux, restauration, agritourisme, hôtellerie indépendante
- **Crédit Mutuel Centre-Est Europe — pôle Pro** — réactif, garantie CMCEE possible en plus de SIAGI/BPI, bonne acceptation des projets de reprise familiale
- **CIC Lyonnaise de Banque — pôle Entreprises** — sélectif mais excellent quand le dossier est solide bilanciel

**Banques à ÉVITER ou à NE PAS CIBLER en première intention pour un PRO TPE :**
- **BNP Paribas** — exige des dossiers >500 K€ structurés, peu d'appétence TPE de proximité
- **Société Générale** — filière pro centralisée Paris, refuse souvent les TPE locales
- **HSBC** — non pertinent sur le tissu TPE régional
- **LCL** — appétence pro très faible en région, agences peu équipées
- **Banque en ligne** (Boursorama, Fortuneo, Hello Bank) — pas de financement pro

**Argumentaire à construire pour la banque cible** (encart `.alert.low` à la fin de la section) :
1. **Angle de présentation** : quel est l'élément le plus fort du dossier (rentabilité historique, expérience porteur, garantie BPI obtenue, apport élevé, CCA bloqué…) ? On entre par cet angle.
2. **Banques pressenties** : 2 à 3 banques classées par ordre de priorité avec justification.
3. **Garanties à proposer** : SIAGI (commerce/services), BPI Création (création/reprise), France Active (ESS, transmission), nantissement FDC, hypothèque sur immo pro, caution personnelle gérant.
4. **Co-financements parallèles** : prêt d'honneur Initiative ou Réseau Entreprendre, subvention région, BPI Création.
5. **Points de vigilance à anticiper** (objections probables de la banque) et réponses préparées.
