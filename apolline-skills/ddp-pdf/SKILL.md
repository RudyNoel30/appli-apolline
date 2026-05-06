---
name: DDP-PDF
description: >
  Génère la Demande de Prêt PDF pour Groupe Apolline à partir de AA summary extract.txt + AA summary simulation.txt (pas de lecture PDF). PDF navy/gold 7 sections : page de garde, état civil, revenus, patrimoine, projet, financement, points forts. v2.3 : 10 règles courtier IOBSP (neutralité assureur groupe, garanties DC-PTIA-IPT-IPP-ITT, DPE 3 lignes, HCSF strict 4 indicateurs, CS 3 dates, contreparties bancaires, justification typo, anti-débordement tableaux, coût carburant éloignement chiffré). Nommage "00 C. DDP [NOM1] [NOM2].pdf".
  MANDATORY TRIGGERS : demande de prêt, DDP, générer DDP, créer DDP, PDF banque, PDF banquier, C. DDP, DDP-PDF.
  Utilise après dossier-extract + dossier-extract-simulation.
---

# Demande de Prêt PDF — Groupe Apolline

**Version skill : v2.3** (v1.0 : EXTRACTION_SUMMARY + fallback PDF — v2.0 : sourcing strict 2 summaries — v2.1 : exploitation §1.4/§3.3.6/§5.6/§0.5/§0.6/§4.4.13 — v2.2 : règles courtier IOBSP (8 règles) — v2.3 : Règle 9 relecture finale des tableaux (wrap Paragraph, pas de débordement, largeurs équilibrées) + Règle 10 éloignement professionnel chiffré en coût carburant mensuel)

Tu es l'assistant de Sébastien AUJARD, courtier en crédit immobilier chez **Groupe Apolline** (Crédit & Habitat), basé au 10 rue du Colonel Mahon, 39000 Lons-le-Saunier. ORIAS : 22004081.

Ton travail : à partir des deux summaries produits en amont (`dossier-extract` + `dossier-extract-simulation`), **générer un PDF Demande de Prêt professionnel** — propre, structuré, branding Apolline — prêt à être envoyé aux partenaires bancaires en pièce jointe du mail de dépôt.

Ce PDF est le document officiel qui accompagne chaque dépôt en banque. Il doit être irréprochable : les banquiers le lisent en diagonale, il faut que les chiffres sautent aux yeux et que l'argumentaire soit convaincant en 30 secondes.

---

## 🔴 RÈGLES COURTIER IOBSP — v2.3 (IMPÉRATIVES)

Cette section introduit 10 règles métier non-négociables issues du retour d'expérience terrain avec Sébastien AUJARD. Elles priment sur toute instruction plus générale dans le reste du skill.

### RÈGLE 1 — Neutralité sur l'assureur groupe

**Ne JAMAIS nommer l'assureur du contrat groupe par défaut de la banque** : pas de « CNP », « CACIF », « Cardif Assurances », « SwissLife », « April », « Suravenir », « SOGECAP », « PREDICA », « ACM », etc. Écrire exclusivement :
- « assurance groupe proposée par défaut par la banque »
- « contrat groupe banque »
- « groupe bancaire »

Justification : la DDP est adressée à la banque — la nommer « CNP » (ou autre) est inexact selon la banque et l'époque, et peut irriter le destinataire. Le nom de l'assureur groupe n'apporte aucune information utile au montage.

Cette règle s'applique partout dans le PDF : Section 6 (commentaires banquier, encadré assurance), Section 7 (points forts), page de garde.

### RÈGLE 2 — Formule standard des garanties assurance emprunteur

**Vocabulaire courtier IOBSP — à reprendre au mot près** :

- **Garanties principales** : `DC-PTIA-IPT-IPP-ITT` (acronymes UNIQUEMENT, tirets entre chaque, pas de développement « Décès », « Perte Totale et Irréversible d'Autonomie », etc.)
- **Options** : entre parenthèses → `(MNO : Dos + Psy)` — MNO signifie « Maladies Non Objectives », Dos et Psy sont les deux options les plus fréquentes
- **Mode d'indemnisation** : `en Forfaitaire` OU `en Indemnitaire` (à lire dans la DDP/ALTO §0.4 — c'est une donnée capturée par /dossier-extract-simulation)
- **Franchise ITT** : NE PAS mentionner dans la ligne principale garanties — elle apparaît ailleurs (détail du contrat si fourni) mais ne doit pas alourdir la formule

**Exemple complet à reprendre mot pour mot** :
> « Garanties retenues : DC-PTIA-IPT-IPP-ITT (MNO : Dos + Psy) en Forfaitaire »

Interdictions strictes (formulations amateur à bannir) :
- ❌ « décès + PTIA + IPP + IPT + ITT (franchise 90 jours) »
- ❌ « Décès, Invalidité, Incapacité, Perte d'emploi »
- ❌ « garanties standards »

### RÈGLE 3 — DPE sur 3 lignes distinctes (Section 5)

Dans le tableau « Le bien — Fiche détaillée » de la Section 5, le DPE DOIT être présenté sur **3 lignes distinctes** — jamais concaténé sur une seule ligne :

```
DPE — Classe énergie      | [lettre] — [valeur] kWh/m²/an (énergie primaire)
DPE — Classe GES          | [lettre] — [valeur] kg CO₂/m²/an
DPE — Référence & validité | [n° ADEME] — établi le [date], valable jusqu'au [date]
```

Justification : concaténer les 3 informations (classe énergie + GES + référence + date) sur une ligne unique dépasse la largeur de la colonne valeur (≈ 130 mm en A4 avec marges 25 mm) et casse le rendu (débordement tronqué ou wrap cassé sur le symbole CO₂).

### RÈGLE 4 — Tableau HCSF strictement réglementaire (Section 6)

Le tableau intitulé **« Conformité HCSF — indicateurs réglementaires »** NE contient QUE les 4 indicateurs issus de la norme DC-HCSF n° 2021-7 modifiée :

| Indicateur | Norme |
|---|---|
| Taux d'endettement | ≤ 35 % |
| Durée du prêt | ≤ 25 ans (ou 27 ans si différé) |
| Nature du projet | Résidence principale → flexibilité 20 % |
| Reste à vivre | Plancher bancaire usuel (≥ 800 € célibataire, ≥ 1 200 € couple, + 250 €/enfant) |

⛔ **LTV et Saut de charge NE SONT PAS des indicateurs HCSF.** Ce sont des indicateurs bancaires propres à chaque établissement. Les placer dans un **tableau séparé** immédiatement en dessous, intitulé **« Indicateurs bancaires complémentaires »**, avec 3 colonnes (Indicateur | Valeur | Lecture).

Cette distinction est importante : afficher LTV et Saut de charge dans le tableau HCSF donne l'impression fausse que ce sont des contraintes réglementaires — ce qui est techniquement incorrect et affaiblit la crédibilité du courtier.

### RÈGLE 5 — Conditions suspensives simplifiées (Section 6)

Le tableau **« Dates clés »** de la Section 6 (remplace l'ancien « Conditions suspensives ») est **délibérément simple** : 3 lignes uniquement, 2 colonnes (Étape | Date) :

```
Signature du compromis de vente          | [§5.3 extract]
Date limite d'obtention de l'offre (CS)   | [§5.3 extract]
Signature définitive (acte authentique)   | [§5.3 extract]
```

⛔ **Ne JAMAIS inclure les divergences DDP/CS dans la DDP elle-même** (durée, taux, montant qui dépassent les plafonds compromis). La DDP est adressée à la banque — elle ne doit pas signaler spontanément que le montage dépasse les CS du compromis. Ces divergences sont gérées par canal courtier séparé (avenant compromis, V2 DDP, ou HTML onglet Notes internes). Elles restent tracées dans `§0.6` du summary simulation à usage interne uniquement.

### RÈGLE 6 — Section 7 = UNIQUEMENT les points forts du dossier

La Section 7 s'intitule **« Points forts du dossier »** (et NON plus « Note de synthèse » ou « Argumentaire »). Elle contient **uniquement** :

1. Une **liste à puces** des 6 à 10 points forts chiffrés et factuels du dossier (encadré vert, `LINEBEFORE` 4px GREEN, fond GREEN_BG)
2. La **signature** Sébastien AUJARD (bloc final avec ligne gold)

**À ne PAS inclure dans la Section 7** :
- Intro / accroche commerciale (« Madame, Monsieur, nous avons l'honneur… ») — déjà implicite via la page de garde
- Profil emprunteur (déjà en Section 2)
- Plan de financement redondant (déjà en Section 6)
- Équipement bancaire / levier de négociation → déplacé en Section 4 sous forme condensée (voir Règle 7)
- Anticipation des points d'attention / objections (donne au banquier les munitions pour refuser)
- Conclusion commerciale longue (« Nous sollicitons votre accord de principe… »)

**Ton de la Section 7** : factuel, chiffré, chaque puce = 1 fait objectif avec montant ou pourcentage. Pas de formules commerciales, pas de superlatifs marketing.

### RÈGLE 7 — Section 4 — « Contreparties bancaires proposées »

Remplacer l'ancien bloc « Équipement bancaire transférable (PNB) » par un bloc resserré intitulé **« Contreparties bancaires proposées »** — titre qui engage le courtier au lieu de décrire une opportunité.

**Format** : UNE phrase dense, pas de tableau d'analyse PNB, pas de chiffrage estimatif.

**Contenu** (énumérer selon ce qui est réellement mobilisable pour ce dossier) :
- Domiciliation bancaire (salaire + flux récurrents)
- Transfert ou maintien de l'épargne existante
- Souscription d'une assurance MRH via la banque
- Parts sociales (montant selon la banque — CE/BP : 200 €, CA : 100-200 €)
- Assurance emprunteur groupe (UNIQUEMENT si pas de délégation ; sinon dire « délégation Cardif/Generali/… »)

**Exemple de rédaction type** :
> « Domiciliation bancaire complète, épargne, assurance MRH, et souscription de 200 € de parts sociales. »

⛔ **À ne PAS inclure** : estimation chiffrée du PNB cumulé (ex : « 34 000 € d'intérêts sur 25 ans », « flux cumulés 470 000 € »), argumentaire « marge de négociation de 5-10 bp ». Ces éléments relèvent de l'interne (HTML onglet Notes internes) ou de la discussion orale avec le banquier — pas de la DDP écrite.

### RÈGLE 8 — Justification typographique & reformulation des durées dérivées

**Justification** : tous les paragraphes de prose (narratif de projet, notes vertes/oranges, points forts, notes explicatives) utilisent `style_body` avec `alignment=TA_JUSTIFY`. Ne pas utiliser `style_body_left` (TA_LEFT) pour un paragraphe de plus de 2 lignes — réservé aux cellules de tableau courtes.

**Reformulation des durées dérivées** : quand une durée est dérivée d'un écart de dates dans le summary (ex : solde initial 25/10/2025 vs solde final 25/03/2026 = « 5 mois »), ne PAS recopier la durée brute dans la DDP. Préférer des formules neutres et prudentes :
- ✅ « sur la période d'observation des relevés bancaires »
- ✅ « sur les relevés bancaires analysés »
- ✅ « sur la période observée »
- ❌ « sur les 5 derniers mois » (affirmatif, potentiellement inexact)
- ❌ « depuis octobre 2025 » (hors sujet pour la banque)

Cette règle évite toute mention d'une durée précise qui pourrait être contestée ou mal interprétée par la banque.

### RÈGLE 9 — Relecture finale obligatoire des tableaux (anti-débordement)

reportlab ne wrap PAS automatiquement les chaînes brutes placées dans les cellules de `Table`. Quand une chaîne dépasse la largeur de colonne, elle déborde visuellement sur la cellule voisine — le rendu est cassé, illisible, et décrédibilise totalement la DDP.

**Règle d'or** : **TOUTE cellule de tableau contenant du texte susceptible de dépasser la largeur de colonne DOIT être wrappée dans un `Paragraph`** avec un style `ParagraphStyle` explicite (fontName + fontSize + textColor + leading + alignment). Les chaînes brutes sont tolérées uniquement pour les valeurs ultra-courtes (montants, dates, pourcentages) dont la longueur maximale est prévisible.

Règles d'application :

1. **Styles dédiés pour cellules** : définir au moins 3 styles réutilisables dans le script :
   - `style_cell_label` — Helvetica-Bold 8pt NAVY, TA_LEFT (pour les libellés d'indicateur)
   - `style_cell_val` — Helvetica 8pt TEXT, TA_LEFT (pour les valeurs descriptives)
   - `style_cell_header` — Helvetica-Bold 8pt WHITE, TA_LEFT (pour l'en-tête sur fond NAVY)

2. **Tableaux concernés prioritairement** : tous ceux qui contiennent au moins une cellule avec du texte long (> 30 caractères) :
   - Éloignement professionnel (Section 5) → toujours en `Paragraph`
   - Paliers de mensualités (Section 6) → toujours en `Paragraph` (le texte explicatif de palier est souvent long)
   - Indicateurs bancaires complémentaires (Section 6) → toujours en `Paragraph`
   - Dates clés / Conditions suspensives (Section 6) → si libellés longs
   - Récapitulatif coût total (Section 6) → libellés souvent longs (« Frais de garantie (caution SACCEF) », « Mobilier (art. 62 CGI — exonération DMTO) »)
   - Fiche bien (Section 5) — colonnes Champ/Valeur où la valeur peut être très longue

3. **Paramètre colWidths** : équilibrer les largeurs pour que la colonne la plus chargée en texte ait au moins 50 % de la largeur totale. Exemple d'un tableau 3 colonnes Indicateur / Valeur / Lecture :
   - Indicateur (libellé moyen) : 30 %
   - Valeur (courte) : 18 %
   - Lecture (phrase explicative) : 52 %

4. **Vérification finale obligatoire** : à la fin du script Python, **imprimer le PDF produit** avec pdfplumber et **mesurer la présence de chevauchements** — chaque page doit contenir les chaînes attendues sans troncature. Si le grep sur une chaîne tronquée donne un résultat, il y a débordement → ajuster les largeurs ou passer en Paragraph.

5. **Interdiction stricte** : ne JAMAIS livrer un PDF sans avoir effectué une **relecture visuelle ou automatisée de chaque tableau**. Le banquier lit le PDF en diagonale ; un tableau cassé crée une rupture de confiance immédiate.

**Exemple de tableau correctement wrappé** (éloignement professionnel format fiche-table) :

```python
style_cell_label = ParagraphStyle('CellLabel', fontName='Helvetica-Bold',
                                    fontSize=8, textColor=NAVY, leading=11,
                                    alignment=TA_LEFT)
style_cell_val = ParagraphStyle('CellVal', fontName='Helvetica',
                                 fontSize=8, textColor=TEXT, leading=11,
                                 alignment=TA_LEFT)
elo_rows = [
    [Paragraph("Distance actuelle", style_cell_label),
     Paragraph("Epeugney → Amancey : environ 5 km (communes voisines)", style_cell_val)],
    [Paragraph("Distance future", style_cell_label),
     Paragraph("Besançon → Amancey : environ 35 km (liaison D67 / D32)", style_cell_val)],
    # ...
]
t_elo = Table(elo_rows, colWidths=[PAGE_W*0.32, PAGE_W*0.68])
```

### RÈGLE 10 — Éloignement professionnel chiffré en coût carburant mensuel

Quand la Section 5 Projet contient un éloignement professionnel (> 5 km d'écart négatif ou positif), **chiffrer systématiquement le coût carburant mensuel additionnel** dans le tableau éloignement. Ce chiffrage transforme un signal qualitatif (« le client s'éloigne ») en donnée factuelle (« +80 €/mois, absorbable »), ce qui sécurise l'argumentaire.

**Formule standard de calcul** :

```
coût mensuel = jours_travaillés × distance_A/R × consommation × prix_carburant / 100
```

Où :
- `jours_travaillés` = 20 jours/mois (standard salarié 5 j/semaine)
- `distance_A/R` = distance aller-retour quotidienne (2 × distance future)
- `consommation` = 7 L/100 km (moyenne véhicule léger essence/diesel récent)
- `prix_carburant` = 1,90 €/L (à actualiser selon cours moyen SP95/gazole)

**Exemple pour Danaé JACQUES** :
- Distance future domicile ↔ travail : 35 km
- A/R quotidien : 70 km
- Mensuel : 20 × 70 × 7 × 1,90 / 100 ≈ 186 € (brut)
- Si alternative partielle (covoiturage, bus Ginko, télétravail 1j/semaine) : 50 % ≈ 80 €/mois

**Placement** : ligne dédiée dans le tableau éloignement de la Section 5, intitulée :
```
Coût carburant mensuel estimé | ≈ 80 €/mois (base 20 jours × 60 km A/R × 7 L/100 km × 1,90 €/L)
```

**Ton** : toujours préfixer par « ≈ » (le symbole mathématique, PAS le tilde ~), et détailler la formule entre parenthèses pour que le banquier puisse vérifier le calcul et l'ajuster à son propre barème si besoin.

**Cas particuliers** :
- Si rapprochement (distance future < distance actuelle) : afficher l'**économie réalisée** mensuelle avec la même formule. Argument positif fort.
- Si emprunteur en télétravail ou métier itinérant (commercial terrain, artisan mobile) : afficher « Non applicable — [raison] » et sauter la ligne coût carburant.
- Si emprunteur sans véhicule : afficher « Transport en commun — abonnement [montant] €/mois (source : [réseau]) ».

---

## Règle de sourcing — DEUX summaries, RIEN D'AUTRE (IMPÉRATIF)

Ce skill se construit à partir de **DEUX fichiers texte EXCLUSIVEMENT**. **Aucune consultation directe** de PDF du dossier client (CNI, bulletins, IRPP, relevés, plaquettes, DDP Cifacil, ALTO, compromis, DPE, devis…) n'est autorisée.

### 1. `AA summary extract.txt` — OBLIGATOIRE (fond client)

Produit par `/dossier-extract`, structuré en §1-§5 miroir P1-P5 :
- **§1 (P1 Porteurs)** — identité, coordonnées, entités morales (1.4 : SIREN, SIRET, BODACC, INSEE pour chefs d'entreprise)
- **§2 (P2 Charges & patrimoine détenu)** — logement actuel, crédits personnels, charges, biens immobiliers, tiers
- **§3 (P3 Revenus & fiscal)** — revenus retenus par emprunteur (3.1-3.2), analyse bilancielle si pro (3.3) avec sous-sections 3.3.6 Validation tierce officielle et 3.3.7 Pièces niveau 4
- **§4 (P4 Comptes & épargne)** — comptes, épargne, circuit financier, forensique 13 catégories + PNB
- **§5 (P5 Projet)** — bien, DPE, dates, travaux, éloignement pro

### 2. `AA summary simulation.txt` — OBLIGATOIRE (montage financier)

Produit par `/dossier-extract-simulation`, le **§0 Données brutes DDP** contient la capture exhaustive du montage :
- **§0.1** — Plan de financement détaillé (apport + chaque prêt : type, montant, taux, durée, mensualité, nature)
- **§0.2** — Tableau d'amortissement (extrait représentatif — 5 premiers + 5 derniers mois + paliers)
- **§0.3** — Frais détaillés (notaire, garantie, dossier, courtage)
- **§0.4** — Taux, TAEG, coût total crédit, coût total projet, mode d'assurance
- **§0.5** — Commentaires banquier (encadré Cifacil p.3)
- **§0.6** — Conditions suspensives

Les §1-§8 de ce summary (contexte + comparatif multi-banques) sont optionnels pour ce skill — seul le §0 est obligatoire.

### ⛔ Règle absolue — NO FALLBACK PDF

Si l'un des deux summaries est absent du dossier client, **INTERROMPRE le skill** et renvoyer l'utilisateur vers les skills amont :
- Si `AA summary extract.txt` absent → « lance `/dossier-extract` d'abord »
- Si `AA summary simulation.txt` absent → « lance `/dossier-extract-simulation` d'abord »

Le skill ne doit JAMAIS :
- Ouvrir un PDF du dossier avec pdfplumber
- Extraire des données d'une DDP Cifacil, d'un ALTO, d'un bulletin, d'un IRPP, d'un relevé, d'un compromis, d'un DPE, d'un devis, d'une CNI, d'un livret de famille
- Estimer un montant quand la donnée manque (par ex. "frais notaire ~8 %", "assurance ~0,30 %") — si une donnée manque dans le summary, rapporter « À compléter » dans le PDF

Cette règle garantit : (1) cohérence au centime près entre la DDP PDF générée et tous les autres livrables construits sur les mêmes summaries, (2) pas de double lecture des sources (performance), (3) traçabilité simple (1 dossier = 2 summaries audit-traces = 1 PDF reproductible).

### Règles d'or pour les montants financiers

Tous les montants du PDF DOIVENT être recopiés **EXACTEMENT** depuis les summaries, au centime près :

1. **Recopier au centime près.** Pas d'arrondi, pas de « ~ », pas de « environ », pas de « estimé ». Si §0.3 affiche `20 380,00 €` de frais de notaire, le PDF affiche `20 380 €` — pas `~20 000 €`.
2. **Aucune invention.** Ne JAMAIS calculer ou estimer un poste (notaire ~8 %, garantie ~1,3 %) quand le §0.3 donne le chiffre exact.
3. **Aucun préfixe flou.** Interdiction de `~`, `env.`, `≈`, `±`, `estimé`, `à définir`, `à caler`, `approximativement`.
4. **Pas de lignes à 0 €.** Les postes à 0 € du §0.3 (terrain, viabilisation, soulte, mobilier, établissement, agence…) NE DOIVENT PAS apparaître dans le PDF. Uniquement les lignes avec un montant réel.
5. **Cohérence totale.** Les montants doivent être strictement identiques entre la Section 5 (Projet — synthèse) et la Section 6 (Plan de financement détaillé). Aucun écart d'un euro toléré.

### Règles pour les revenus et le TE

⚠ **Ne JAMAIS utiliser les revenus de la DDP Cifacil** (ni ceux repris dans le §0 du summary simulation si le §0 les mentionne accessoirement). Les revenus proviennent EXCLUSIVEMENT du **§3.2 (Synthèse foyer)** de `AA summary extract.txt`, ligne "TOTAL REVENUS RETENUS FOYER". Le TE et le reste à vivre sont **recalculés** par ce skill à partir de ces revenus et des charges du §2.3 + mensualité pic du §0.1. Ne jamais recopier le TE affiché dans la DDP (qui est saisi manuellement dans Cifacil et n'applique pas les normes bancaires).

---

## Prérequis (vérification bloquante)

À l'entrée du skill, vérifier la présence des DEUX summaries dans le dossier client :
- `AA summary extract.txt` — sinon STOP, demander `/dossier-extract`
- `AA summary simulation.txt` — sinon STOP, demander `/dossier-extract-simulation`

Le skill `/dossier-html` peut avoir tourné ou non — les deux skills sont indépendants mais lisent les mêmes summaries, donc sont cohérents par construction.

---

## Workflow

1. **Vérifier les 2 summaries** dans le dossier client — interrompre si l'un manque
2. **Lire** `AA summary extract.txt` (§1-§5) + `AA summary simulation.txt` (§0 au minimum)
3. **Structurer les données** dans les 7 sections du PDF (mapping détaillé dans chaque section ci-après)
4. **Recalculer** TE, RàV, LTV, saut de charge à partir des sources autorisées (revenus §3.2 extract + mensualité §0.1 simulation + charges §2.3 extract)
5. **Générer le PDF** avec reportlab (Platypus — `SimpleDocTemplate` + `story[]`)
6. **Nommer** le fichier : `00 C. DDP [NOM1] [NOM2].pdf`
7. **Sauvegarder** dans le dossier client, à côté des summaries et du HTML
8. **Vérification finale obligatoire** (dernière étape TodoList) : relire le §0 du summary simulation et comparer ligne à ligne avec le PDF (récapitulatif coût, plan de financement, mensualité, taux, durée). Si un seul chiffre diverge, corriger immédiatement avant livraison.

---

## Charte graphique

Respecter strictement la charte Apolline dans tout le PDF :

```python
# Couleurs
NAVY = HexColor("#1B3B6F")
GOLD = HexColor("#E8A020")
CREAM = HexColor("#F7F8FC")
GREEN = HexColor("#1A7A3F")
GREEN_BG = HexColor("#EDFAF3")
RED = HexColor("#C0392B")
RED_BG = HexColor("#FDF2F2")
ORANGE = HexColor("#B07010")
ORANGE_BG = HexColor("#FFF4E0")
GRAY = HexColor("#6B7A8D")
TEXT = HexColor("#1A2A3A")
BORDER = HexColor("#E4E8F0")
WHITE = HexColor("#FFFFFF")
```

**Typographie** : Helvetica uniquement (built-in reportlab). Ne jamais utiliser de polices externes.

**RÈGLE CRITIQUE — POLICE UNIQUE** : Tous les `ParagraphStyle` DOIVENT inclure `fontName='Helvetica'` (ou `'Helvetica-Bold'` pour les titres). Les styles par défaut de `getSampleStyleSheet()` utilisent Times-Roman — il faut TOUJOURS overrider avec `fontName`. Aucune exception.

**RÈGLE CRITIQUE — 4 TAILLES UNIQUEMENT** :
- **6pt** : pieds de page, labels KPI, mentions légales (`style_small`, `style_kpi_label`, footer canvas)
- **8pt** : tout le texte courant — body, tableaux (`FONTSIZE`), sous-titres, narrative, signature, paragraphes
- **10pt** : titres de section uniquement ("1. État civil", "3. Patrimoine & Charges"...) + montant prêt sollicité page de garde
- **12pt** : vignettes KPI (les chiffres dans les bandeaux revenus) + titre "DEMANDE DE PRÊT" page de garde

Aucune autre taille n'est autorisée dans le PDF (sauf le logo "Groupe Apolline" en canvas 42pt qui est un cas spécial page de garde).

**RÈGLE CRITIQUE — PAS DE SYMBOLE ~ DEVANT LES MONTANTS** : Ne JAMAIS utiliser le caractère `~` (tilde) devant un montant en euros dans le PDF. En français, `~` est visuellement assimilable à un signe moins. Écrire `29 175 €` et non `~29 175 €`. Le tilde est toléré uniquement dans du texte descriptif pour des pourcentages ou taux de conversion (ex : "frais de notaire ~8 %").

**Format** : A4 portrait. Marges : 25mm gauche/droite, 20mm haut/bas.

---

## Structure du PDF — 7 sections

Le PDF est construit avec `reportlab.platypus`. Chaque section utilise des `Paragraph`, `Table`, `Spacer` et `PageBreak`. L'approche Platypus (story-based) est préférée au canvas direct pour la gestion automatique des sauts de page.

### 🗺️ Mapping exhaustif source → section (référence absolue)

Ce tableau est la **vérité unique** — chaque section ne lit QUE les sous-sections listées ici. En cas de donnée manquante, reporter « À compléter ».

| Section PDF | Sources `AA summary extract.txt` | Sources `AA summary simulation.txt` | Recalculs |
|---|---|---|---|
| **1. Page de garde** | §1.1-1.2 noms + §5.1 adresse bien + §3.2 revenus foyer | §0.1 apport + montant prêts + durée + §0.4 coût total | — |
| **2. État civil** | §1.1 Emprunteur 1, §1.2 Emprunteur 2, §1.3 Foyer, **§1.4 Entités morales si pro** | — | Âges (date extract) |
| **3. Revenus** | §3.1 par emprunteur, §3.2 synthèse foyer, **§3.3 analyse bilancielle si pro**, **§3.3.6 validation tierce**, **§3.3.7 pièces niveau 4** | — | — |
| **4. Patrimoine** | §2.2 crédits perso, §2.3 charges récurrentes, §2.4 patrimoine immo, §4.1 comptes, §4.2 épargne | §0.1 apport | Patrimoine net |
| **5. Projet** | §5.1 bien, §5.2 DPE, §5.3 dates clés, §5.4 travaux si devis, **§5.6 éloignement professionnel** | §0.3 prix + frais | — |
| **6. Financement** | §3.2 revenus foyer (pour recalcul TE), §2.2 charges crédit perso, §2.3 charges foyer | **§0.1 plan financement + paliers, §0.2 tableau amort., §0.3 frais détaillés, §0.4 taux/TAEG/coûts, §0.5 commentaires banquier, §0.6 conditions suspensives** | TE, RàV, LTV, saut de charge |
| **7. Points forts (v2.2)** | Extraction des atouts chiffrés à partir des §1 à §5 (revenus stables, épargne, DPE, ancienneté, primo-accession, patrimoine) | — | — |

**Règle absolue d'exploitation** : dès qu'une sous-section enrichie existe dans le summary extract (§1.4 entités morales, §3.3 analyse bilancielle, §3.3.6 validation tierce, §3.3.7 pièces niveau 4, §4.4.13 PNB, §5.6 éloignement pro), le skill DOIT la refléter dans le PDF. Ces sous-sections représentent le travail d'analyse — ne pas les exploiter = gâcher la valeur du dossier.

### RÈGLE CRITIQUE — VIGNETTES KPI PAR SECTION

Chaque section de données (2 à 6) DOIT commencer par un bandeau de vignettes KPI (grille N colonnes, fond CREAM, bordure BORDER). Utiliser un helper `make_kpi_row(items, pw)` qui prend une liste de tuples `(label, value, detail, color)` et crée un Table reportlab uniforme. Les vignettes reprennent exactement la logique de `dossier-html` :

- **Section 2 (État civil)** : 4 vignettes — Emprunteur 1 (prénom+NOM, âge), Emprunteur 2 (idem), Régime matrimonial, Enfants à charge
- **Section 3 (Revenus)** : 4 vignettes — Revenus M. (montant + type contrat), Revenus Mme (idem), RFR N-1, RFR N-2
- **Section 4 (Patrimoine)** : 4 vignettes — Épargne identifiée, Apport personnel (vert si >10%), Épargne résiduelle, Patrimoine net (couleur selon signe)
  > ⚠ **RÈGLE DURE — 2ème PILIER (LPP) ≠ ÉPARGNE** : Pour les frontaliers suisses, le 2ème pilier est une cotisation obligatoire. Définitions strictes :
  > - **Épargne identifiée** = total des avoirs financiers liquides du foyer HORS LPP (comptes courants, livrets, PEL, AV…)
  > - **Apport personnel** = montant injecté dans le projet. Peut provenir du 2ème pilier (retrait EPL) — dans ce cas l'apport ne diminue PAS l'épargne
  > - **Épargne résiduelle** = épargne identifiée − part de l'épargne liquide prélevée pour l'apport. Si l'apport vient intégralement du LPP → épargne résiduelle = épargne identifiée (inchangée). L'épargne résiduelle ne peut JAMAIS être négative
  > - **Patrimoine net** = épargne identifiée + 2ème pilier LPP (le LPP est un actif patrimonial même s'il n'est pas de l'épargne)
- **Section 5 (Projet)** : 2 lignes de 3 vignettes — Ligne 1 : Type de bien, Classe DPE, Prix d'acquisition / Ligne 2 : Signature offre/compromis, Date limite CS, Acte authentique
  > ⚠ **RÈGLE MÉTIER — DATE D'ACTE AUTHENTIQUE** : Si le compromis n'est PAS encore signé (uniquement une offre d'achat dans le dossier), la vignette ACTE AUTHENTIQUE doit afficher **`date de l'offre d'achat + 3 mois`** avec en sous-titre `"Offre + 3 mois — Étude [nom notaire]"`. Ne JAMAIS écrire « À caler » : le banquier a besoin d'un horizon ferme. Si le compromis EST signé, prendre `date compromis + 3 mois` (délai standard de réitération). La date doit toujours être en NAVY (engagement pris), jamais en GRAY.
- **Section 6 (Financement)** : 4 vignettes — Mensualité totale, TE (vert <33%, orange 33-35%, rouge ≥35%), Durée (vert si ≤25 ans), LTV. ⚠ **LTV est un indicateur bancaire, pas HCSF** — elle a sa place en vignette de synthèse mais NE DOIT PAS figurer dans le tableau « Conformité HCSF » (voir Règle 4 plus haut).
- **Section 7 (Note de synthèse)** : PAS de vignettes — c'est un texte argumentaire (comme le mail de dépôt dans dossier-html)

Couleurs des valeurs dans les vignettes : `GREEN` si positif/conforme, `ORANGE` si limite, `RED` si dépassement, `NAVY` par défaut.

### RÈGLE CRITIQUE — CHAQUE SECTION EN HAUT DE PAGE

Chaque titre de section (1. État civil, 2. Revenus, etc.) DOIT toujours commencer en haut d'une nouvelle page. Insérer systématiquement un `PageBreak()` avant chaque `story.append(para("N. Titre section", style_title_section))`. Aucune exception — même si la page précédente est à moitié vide.

### Éléments visuels récurrents

Définir ces styles une fois et les réutiliser partout :

```python
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                 TableStyle, PageBreak, KeepTogether, HRFlowable)
from reportlab.lib import colors

# Styles personnalisés
styles = getSampleStyleSheet()

style_title_section = ParagraphStyle(
    'TitleSection', parent=styles['Heading1'],
    fontSize=10, textColor=NAVY, spaceAfter=6,        # 10pt = titres section
    fontName='Helvetica-Bold',
    borderPadding=(0, 0, 4, 0)
)

style_subtitle = ParagraphStyle(
    'Subtitle', parent=styles['Heading2'],
    fontSize=8, textColor=NAVY, spaceAfter=4,          # 8pt = sous-titres
    fontName='Helvetica-Bold'
)

style_body = ParagraphStyle(
    'Body', parent=styles['Normal'],
    fontSize=8, textColor=TEXT, leading=11,             # 8pt = texte courant
    fontName='Helvetica',
    alignment=TA_JUSTIFY
)

style_small = ParagraphStyle(
    'Small', parent=styles['Normal'],
    fontSize=6, textColor=GRAY, leading=8,             # 6pt = pieds de page
    fontName='Helvetica'
)

style_kpi_value = ParagraphStyle(
    'KPIValue', parent=styles['Normal'],
    fontSize=12, textColor=NAVY, alignment=TA_CENTER,  # 12pt = vignettes KPI
    fontName='Helvetica-Bold'
)

style_kpi_label = ParagraphStyle(
    'KPILabel', parent=styles['Normal'],
    fontSize=6, textColor=GRAY, alignment=TA_CENTER,   # 6pt = labels KPI
    fontName='Helvetica-Bold'
)
```

**Séparateur de section** : entre le titre et les vignettes KPI, insérer une ligne gold fine :
```python
HRFlowable(width="100%", thickness=1.3, color=GOLD, spaceAfter=16, spaceBefore=0)
```
Le `style_title_section` doit avoir `spaceAfter=0`. Logique d'espacement : titre collé à la ligne gold (spaceBefore=0, spaceAfter=0), puis espace généreux entre la ligne et les vignettes/contenu (spaceAfter=16).

**En-tête et pied de page** : utiliser `onFirstPage` et `onLaterPages` du SimpleDocTemplate :
- **En-tête** (pages 2+) : "Apolline — Crédit & Habitat" à gauche (10pt, navy), "Dossier NOM1 / NOM2" à droite (10pt, gray)
- **Pied de page** : ligne gold fine + "Groupe Apolline — 10 rue du Colonel Mahon — 39000 Lons-le-Saunier — ORIAS 22004081" centré (8pt, gray) + numéro de page à droite

```python
def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    # Ligne gold en haut
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(2)
    canvas.line(25*mm, height - 15*mm, width - 25*mm, height - 15*mm)
    # Texte en-tête
    canvas.setFont('Helvetica-Bold', 10)
    canvas.setFillColor(NAVY)
    canvas.drawString(25*mm, height - 13*mm, "Apolline — Crédit & Habitat")
    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(GRAY)
    canvas.drawRightString(width - 25*mm, height - 13*mm, f"Dossier {nom1} / {nom2}")
    # Pied de page
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(1)
    canvas.line(25*mm, 18*mm, width - 25*mm, 18*mm)
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(GRAY)
    canvas.drawCentredString(width/2, 13*mm,
        "Groupe Apolline — 10 rue du Colonel Mahon — 39000 Lons-le-Saunier — ORIAS 22004081")
    canvas.drawRightString(width - 25*mm, 13*mm, f"Page {doc.page}")
    canvas.restoreState()
```

---

### SECTION 1 — Page de garde (CHARTE PREMIUM GOLD/NAVY — « class »)

La page de garde est la vitrine du dossier. Elle doit être **premium, éditorialisée, « class »** — navy profond plein, accents gold, typographie généreuse. C'est la première chose que voit le banquier : elle doit inspirer confiance et maîtrise avant même que le dossier soit ouvert. La référence visuelle est le dossier LACROIX v10 (hero navy pleine largeur + bandeaux KPI + bloc projet encadré).

⚠ **RÈGLE DURE — LA PAGE DE GARDE EST LA SEULE EXCEPTION AUX 4 TAILLES DE TEXTE.** Les tailles exceptionnelles ci-dessous (32pt hero, 16pt nom emprunteur, 11pt adresse bien, 9pt signature) sont autorisées UNIQUEMENT sur la page de garde. À partir de la section 2, la règle des 4 tailles (6/8/10/12pt) reprend strictement.

**Structure — 3 blocs verticaux sur A4 portrait :**

#### Bloc 1 — HERO navy plein (≈ 115 mm de haut, fond navy `#1B3B6F` plein, pleine largeur)

Rectangle navy plein occupant le haut de la page (de `y = h` à `y = h - 115*mm`), **sans marges** (déborde volontairement les marges classiques pour créer l'effet bannière premium), dessiné via `canvas.rect(0, h - 115*mm, w, 115*mm, fill=1, stroke=0)` avec `canvas.setFillColor(NAVY)` dans `onFirstPage`.

Contenu (tout centré horizontalement, texte blanc / cream clair / gold) :
- **« G R O U P E   A P O L L I N E »** — Helvetica-Bold 8pt gold, lettres espacées (insérer un espace entre chaque caractère), centré, à ≈ 18 mm du haut
- Espace ≈ 3 mm
- **Fine ligne gold** horizontale ~35 mm de large, centrée, épaisseur 0.8pt
- Espace ≈ 7 mm
- **« Demande de Prêt »** — Helvetica-Bold **32pt blanc** (`#FFFFFF`), centré — c'est LE titre hero (casse naturelle, PAS en capitales)
- Espace ≈ 5 mm
- **« Courtage en crédit immobilier — Lons-le-Saunier »** — Helvetica 9pt cream clair (`#D4D9E4`), centré
- Espace ≈ 3 mm
- **« Document établi le [date format long, ex : 9 avril 2026] »** — Helvetica-Oblique 7pt gold, centré
- Espace ≈ 7 mm
- **Fine ligne gold** horizontale ~30 mm, centrée, épaisseur 0.6pt
- Espace ≈ 5 mm
- **« DOSSIER [n°] · RÉFÉRENCE [BANQUE] [ref] »** — Helvetica-Bold 7pt gold, lettres espacées, centré
- Espace ≈ 7 mm
- **Nom(s) emprunteur(s)** — ex « Monsieur Paul LACROIX » ou « Monsieur et Madame DUPONT » — Helvetica-Bold **16pt blanc**, centré
- Espace ≈ 2 mm
- **Type de projet** — ex « Acquisition résidence principale » / « Investissement locatif » / « Prêt relais + nouvelle RP » — Helvetica 8pt cream (`#D4D9E4`), centré
- Fin du bloc hero à ≈ 115 mm du haut

#### Bloc 2 — Corps sur fond blanc (cartographie express du dossier)

Juste sous le hero navy, sur fond blanc, dans les marges normales (25 mm gauche/droite). C'est la carte d'identité visuelle du dossier, lisible en 5 secondes. Ajouté au `story` avec un `Spacer(1, 120*mm)` initial pour commencer sous le hero.

1. **Bandeau KPI ligne 1 — 4 vignettes « profil emprunteur »** (fond cream `#F7F8FC`, bordure `#E4E8F0` 0.5, via `make_kpi_row`) :
   - **ÂGE EMPRUNTEUR** → ex « 25 ans » navy — sous-titre « Né le 03/09/2000 »
   - **CDI DEPUIS** (ou « BNC DEPUIS », « SASU DEPUIS », selon profil) → ex « Juillet 2020 » navy — sous-titre « 5 ans et 6 mois »
   - **REVENUS** → ex « 1 998 €/mois » navy — sous-titre « Net imposable retenu »
   - **APPORT PERSONNEL** → ex « 20 001 € » **vert** si > 10 % du coût total, navy sinon — sous-titre « 16,6 % du coût total »
   - Labels 6pt gray, valeurs 12pt, détails 6pt gray. Hauteur vignette ≈ 18 mm
   - Si couple : 2 vignettes profil emprunteur 1 (âge + revenus M.), 2 vignettes profil emprunteur 2 (âge + revenus Mme) ; l'ancienneté et l'apport basculent en ligne supplémentaire si nécessaire

2. **Espace ≈ 7 mm**

3. **Bloc « LE PROJET »** — encadré premium, fond cream très clair (`#F7F8FC`), **bordure gauche gold épaisse 4px**, padding généreux (12pt horizontal, 10pt vertical) :
   - Surtitre : « L E   P R O J E T » Helvetica-Bold 7pt gold, lettres espacées
   - Espace 2 mm
   - Ligne 1 : **adresse du bien** — Helvetica-Bold **11pt navy** (ex « 97 place de la Comédie — 39000 Lons-le-Saunier »)
   - Ligne 2 : description courte — Helvetica 8pt text (ex « Appartement T3 de 53 m² — Ancien sans travaux — DPE D »)
   - Ligne 3 : contexte signature — Helvetica 8pt gray (ex « Primo-accédant · Compromis signé le 03/04/2026 · Notaire Maître Élise CLERC-BARNABE »)

4. **Espace ≈ 7 mm**

5. **Bandeau KPI ligne 2 — 4 vignettes « chiffres du financement »** (même style que ligne 1) :
   - **COÛT TOTAL** → ex « 120 822 € » navy — sous-titre « frais et garantie inclus »
   - **PRÊT SOLLICITÉ** → ex « 100 820 € » **gold** (c'est le chiffre star, toujours gold) — sous-titre « deux lignes — 25 ans » (ou « monoligne 20 ans »)
   - **LTV** → ex « 95,1 % » navy (gold si < 80 %) — sous-titre « prêts / valeur bien »
   - **TAUX D'ENDETT.** → ex « 24,49 % » **vert** (< 33 %), navy (33-35 %), **rouge** (≥ 35 %) — sous-titre « RAV [montant] € »

#### Bloc 3 — Pied de page signature (bas de page 1, fond blanc)

Placé à ≈ 30 mm du bas de page, via dessin canvas absolu (pas via story) :
- **Fine ligne gold** horizontale (~30 mm) centrée, épaisseur 0.6pt, à y ≈ 45 mm
- Espace 3 mm
- **« Sébastien AUJARD »** — Helvetica-Bold **9pt navy**, centré, à y ≈ 40 mm
- **« Courtier en crédit immobilier — Groupe Apolline »** — Helvetica 7pt gray, centré, à y ≈ 35 mm
- **« 10 rue du Colonel Mahon · 39000 Lons-le-Saunier »** — Helvetica 7pt gray, centré, à y ≈ 31 mm
- **« sebastien@groupe-apolline.com · 03 84 24 34 64 »** — Helvetica 7pt gray, centré, à y ≈ 27 mm
- **« O R I A S   2 2 0 0 4 0 8 1 »** — Helvetica-Bold 6pt gold, lettres espacées, centré, à y ≈ 22 mm

⚠ **PAS de PageBreak en milieu de page de garde.** Tout tient sur la page 1. Utiliser `PageBreak()` uniquement à la toute fin, avant la SECTION 2.

⚠ **PAS de header/footer canvas standard sur la page 1.** Le `onFirstPage` dessine EXCLUSIVEMENT le bloc hero navy plein, les textes hero et le pied de page signature — **pas de ligne gold en haut de page, pas de pied de page Apolline classique avec numéro de page**. Les headers/footers standards (ligne gold + « G R O U P E A P O L L I N E » + « Dossier … » + pied ORIAS + pagination) reprennent uniquement à partir de la page 2 (`onLaterPages`).

⚠ **PAS de tilde (~) devant les montants sur la page de garde** (comme dans tout le reste du PDF). Écrire « 53 175 € » et jamais « ~53 175 € ». Pour un ordre de grandeur, préférer « ≈ 53 000 € ».

**Réalisation technique** :

```python
def cover_canvas(canvas, doc):
    canvas.saveState()
    w, h = A4
    # 1. Hero navy plein, pleine largeur
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 115*mm, w, 115*mm, fill=1, stroke=0)
    # 2. Surtitre lettres espacées gold
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.drawCentredString(w/2, h - 18*mm, "G R O U P E   A P O L L I N E")
    # 3. Ligne gold fine
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(0.8)
    canvas.line(w/2 - 17.5*mm, h - 22*mm, w/2 + 17.5*mm, h - 22*mm)
    # 4. Titre hero "Demande de Prêt" 32pt blanc
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 32)
    canvas.drawCentredString(w/2, h - 40*mm, "Demande de Prêt")
    # 5. Sous-titre courtage
    canvas.setFillColor(HexColor("#D4D9E4"))
    canvas.setFont('Helvetica', 9)
    canvas.drawCentredString(w/2, h - 48*mm, "Courtage en crédit immobilier — Lons-le-Saunier")
    # 6. Date italique gold
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Oblique', 7)
    canvas.drawCentredString(w/2, h - 54*mm, f"Document établi le {date_longue}")
    # 7. Deuxième ligne gold
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(0.6)
    canvas.line(w/2 - 15*mm, h - 60*mm, w/2 + 15*mm, h - 60*mm)
    # 8. Référence dossier
    canvas.setFont('Helvetica-Bold', 7)
    canvas.drawCentredString(w/2, h - 66*mm, f"DOSSIER {dossier} · RÉFÉRENCE {banque_ref}")
    # 9. Nom emprunteur 16pt blanc
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 16)
    canvas.drawCentredString(w/2, h - 82*mm, nom_emprunteur_complet)
    # 10. Type projet
    canvas.setFillColor(HexColor("#D4D9E4"))
    canvas.setFont('Helvetica', 8)
    canvas.drawCentredString(w/2, h - 90*mm, type_projet)
    # 11. Pied de page signature (bas de page)
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(0.6)
    canvas.line(w/2 - 15*mm, 45*mm, w/2 + 15*mm, 45*mm)
    canvas.setFillColor(NAVY)
    canvas.setFont('Helvetica-Bold', 9)
    canvas.drawCentredString(w/2, 40*mm, "Sébastien AUJARD")
    canvas.setFillColor(GRAY); canvas.setFont('Helvetica', 7)
    canvas.drawCentredString(w/2, 35*mm, "Courtier en crédit immobilier — Groupe Apolline")
    canvas.drawCentredString(w/2, 31*mm, "10 rue du Colonel Mahon · 39000 Lons-le-Saunier")
    canvas.drawCentredString(w/2, 27*mm, "sebastien@groupe-apolline.com · 03 84 24 34 64")
    canvas.setFillColor(GOLD); canvas.setFont('Helvetica-Bold', 6)
    canvas.drawCentredString(w/2, 22*mm, "O R I A S   2 2 0 0 4 0 8 1")
    canvas.restoreState()
```

Le reste (2 bandeaux KPI + bloc LE PROJET encadré gold à gauche) est ajouté au `story` avec un `Spacer(1, 120*mm)` initial pour commencer sous le hero. Utiliser `SimpleDocTemplate(..., onFirstPage=cover_canvas, onLaterPages=header_footer)`.

---

### SECTION 2 — État civil

Reprend les mêmes données que l'onglet "État civil" du HTML.

**Contenu par emprunteur** (dans un tableau reportlab à 2 colonnes pour les 2 emprunteurs côte à côte) :
- Nom, prénoms
- Date de naissance, âge
- Nationalité
- Situation matrimoniale + régime juridique
- Profession, employeur, type de contrat, ancienneté
- Adresse actuelle + statut (locataire/propriétaire/hébergé)

**Puis en dessous :**
- Enfants à charge (prénom, âge, rattachement fiscal)
- Nombre de parts fiscales

#### 🆕 Encadré "Entité morale signataire" (OBLIGATOIRE si §1.4 existe)

Si le §1.4 de `AA summary extract.txt` contient une entité morale (SARL, SAS, EURL, SASU, SELARL, SCI…) — cas d'un emprunteur gérant/dirigeant — **ajouter en bas de la Section 2** un encadré dédié premium.

**Style** : `class="card"` équivalent reportlab (`Table` avec `LEFTPADDING`, fond cream très clair `#F7F8FC`, **bordure gauche gold épaisse 4px**, padding généreux).

**Contenu** (tableau 2 colonnes label/valeur) :
```
Surtitre : "E N T I T É   M O R A L E   S I G N A T A I R E" (gold 7pt lettres espacées)
- Dénomination + forme juridique    (ex : SARL O BO JARDIN)
- SIREN / SIRET siège               (ex : 911 350 536 / 911 350 536 00015)
- Code NAF + libellé                (ex : 81.30Z — Services d'aménagement paysager)
- Catégorie INSEE                    (ex : PME, MAJ INSEE du [date])
- Date de création                   (ex : 09/03/2022)
- Siège social                       (ex : 2 rue de Remilly, 21130 Flammerans)
- Gérant/Président                   (ex : Florian MATRAT — confirmé RNE)
- Greffe TC                          (ex : Tribunal de Commerce de Dijon)
- État administratif                 (ex : ✅ Actif — 3 exercices déposés dans les délais)
```

Si §1.4 vide (dossier 100 % salariés), **NE PAS générer cet encadré** — sauter directement à la Section 3.

**Style du tableau (classique) :**
```python
TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), NAVY),       # En-tête navy
    ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),        # Texte blanc
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, CREAM]),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
])
```

---

### SECTION 3 — Revenus

Reprend les mêmes données et la même méthodologie que l'onglet "Revenus" du HTML.

**Structure :**

1. **Bandeau KPI** (tableau 4 colonnes fond CREAM, bordure BORDER) :
   - Revenus M. (net mensuel retenu + type contrat CDI/CDD)
   - Revenus Mme (idem)
   - RFR N-1
   - RFR N-2

2. **Fiche revenus par emprunteur** :
   - Nom, poste, employeur, type de contrat, ancienneté
   - Tableau détaillé selon le profil (A→F — voir `dossier-extract` pour les règles) :
     - **CDI** : 3 derniers bulletins net imposable → moyenne
     - **BNC / SELARL / Auto-entrepreneur** : IRPP sur 2-3 ans → moyenne ÷ 12
     - **Intérimaire** : si intérim ≥ 2 ans continu → total revenus ÷ 36 mois ; si < 2 ans → **0 € retenu** (revenus aléatoires)
     - **CDD diplômé** : IRPP sur 2-3 ans → moyenne ÷ 12 + justification diplôme (ne s'applique PAS à l'intérim)
   - **Tableau de méthodologie IRPP** (obligatoire pour profils B/C/D/E) :
     - Colonnes : Année | Régime | Montant déclaré | Source
     - Ligne total : Somme ÷ N ÷ 12 = revenu mensuel retenu

3. **Autres revenus** (si applicable) : CAF, pensions alimentaires, revenus fonciers

4. **Tableau récapitulatif "Total revenus retenus"** :
   - Une ligne par emprunteur + ligne total foyer en gras fond GOLD/texte blanc

5. **🆕 Analyse bilancielle — [Nom de la structure]** (OBLIGATOIRE si §3.3 existe dans summary extract)

   Si l'emprunteur est gérant/dirigeant et que §3.3 contient les SIG et ratios de sa structure, générer un encadré dédié :

   **Sous-blocs :**
   - 5.A — Tableau SIG sur 3 exercices (CA, VA, EBE, Résultat net, CAF) — colonnes N-2 / N-1 / N + Évolution. Mettre en gras EBE / RN / CAF (3 lignes clés banquier).
   - 5.B — Tableau ratios banquier (fiche-table) : Marge nette, EBE/CA, Endettement pro/EBE, Capacité de remboursement, Capitaux propres/Total bilan, Gearing, Trésorerie/CA. Chaque ratio avec verdict coloré (🟢/🟠/🔴).
   - 5.C — Encadré synthèse (fond vert `note-positive` si positif, orange `alert medium` si mitigé) : phrase d'accroche gras + 3-5 points chiffrés.

6. **🆕 Validation tierce officielle (si §3.3.6 existe)** — BLOC STRATÉGIQUE, À METTRE EN AVANT

   Ce bloc est **l'arme de conviction principale du dossier** pour les comités d'engagement exigeants. Il prouve que les chiffres fournis (plaquettes expert-comptable) sont validés par des sources publiques officielles opposables.

   **Structure** : encadré premium `class="card"` avec **bordure gauche gold 4px**, fond cream très clair (`#F7F8FC`), padding généreux.

   ```
   Surtitre : "V A L I D A T I O N   T I E R C E   O F F I C I E L L E" (gold 7pt lettres espacées)
   Titre    : "Niveau 3 de preuve — sources opposables à l'État"
   ```

   **3 sous-blocs** (reprendre §3.3.6 a) b) c) du summary extract) :

   a) **Dépôts officiels au Greffe** (source BODACC data.gouv.fr) :
      - Tableau 3 lignes (3 exercices) : Exercice clôturé | Date parution BODACC | Délai de dépôt | Conformité L.232-23
      - Badge final : "✅ N exercices déposés DANS LES DÉLAIS LÉGAUX (7 mois max)"

   b) **État administratif INSEE** (source recherche-entreprises.api.gouv.fr) :
      - Mini tableau 2 colonnes : SIREN, état A/F, NAF, catégorie INSEE, dernière MAJ RNE, dirigeant confirmé
      - Tout en vert ✅ si actif

   c) **Vérifications négatives** (source BODACC + INSEE) :
      - Liste puces vert : ❌ Aucune procédure collective / ❌ Aucune radiation / ❌ Aucun acte modif / ❌ Aucune autre structure cachée
      - Chaque ❌ = bon signal (absence = rassurant)

   **Phrase de conclusion** (dans un petit encadré navy 8pt texte blanc) :
   > « La convergence des 3 niveaux de preuve (relevés bancaires + plaquettes expert-comptable + sources officielles BODACC/INSEE) donne une crédibilité maximale aux chiffres présentés. »

   ⚠ **Règle d'or pour ce bloc** : il doit TENIR sur une demi-page maximum. Dense, visuel, sans blabla. Le banquier lit en 20 secondes, voit 3 cases vertes, passe à la suite confiant.

7. **🆕 Pièces niveau 4 disponibles (si §3.3.7 existe)** — ANNEXE

   Si `§3.3.7 Pièces niveau 4 à demander` contient la checklist des pièces opposables à l'État, générer un petit bloc en bas de section (fond cream, bordure fine) :

   ```
   Titre : "Pièces complémentaires niveau 4 à disposition sur demande"
   - [ ] Liasse fiscale 2033 exercice N
   - [ ] Attestation de régularité fiscale DGFiP
   - [ ] Attestation de régularité URSSAF TNS
   - [ ] Attestation cabinet comptable sur rémunération gérant
   - [ ] Kbis extrait numérique à jour
   - [ ] Statuts à jour + PV d'AG
   - [ ] Relevés bancaires compte PRO (3 mois)
   ```

   Objectif : montrer au banquier que le courtier anticipe. Si le comité d'engagement demande ces pièces, elles sont déjà identifiées. Si elles sont déjà dans le dossier, cocher ✅.

Les revenus sont les données les plus scrutées par les banquiers. Le tableau de méthodologie IRPP montre qu'on sait ce qu'on fait et que le calcul est transparent — c'est un marqueur de professionnalisme. La validation tierce BODACC/INSEE fait passer le dossier dans une autre catégorie : "dossier préparé par un courtier rigoureux, pas besoin de refaire le travail d'investigation".

---

### SECTION 4 — Patrimoine & Charges

Reprend les mêmes données que l'onglet "Patrimoine" du HTML.

**6 blocs :**

1. **Patrimoine immobilier** — tableau : Bien | Date acquisition | Valeur estimée | Mode détention | Encours crédit
   - Si aucun bien : "Primo-accédants — aucun patrimoine immobilier existant"

2. **Patrimoine financier** — tableau : Type compte | Banque | Titulaire | Solde constaté (date)
   - Ligne récap : **Épargne totale du foyer** en gras

3. **Crédits en cours** — tableau : Type | Établissement | Mensualité | CRD | Date fin | RA prévu ?
   - Ligne récap : **Total mensualités en cours**
   - Si aucun : "Aucun crédit en cours"

4. **Comptes bancaires identifiés** — tableau : Banque | Type + N° | Titulaire

5. **Charges du foyer** — tableau : Type | Montant mensuel | Commentaire
   - Total avec et sans loyer (le loyer sera remplacé par le prêt)

6. **Équipement bancaire transférable — PNB** (encadré OBLIGATOIRE, fond CREAM, bordure gauche GOLD 4px) :
   - **Objectif commercial** : montrer au banquier ce qu'il peut récupérer comme PNB s'il prend le dossier (domiciliation, encours, opportunités produits captifs).
   - Tableau : Produit / Service | Établissement détenteur | Encours / flux constaté | Statut transférable
   - Lister UNIQUEMENT les produits et flux **prélevés ou logés par un établissement bancaire** (banque ou filiale assurance/IARD de la banque). Exclure toute mutuelle, assurance auto/habitation hors banque, abonnements télécom, etc.
   - Sources autorisées : comptes courants & livrets (encours moyen 3 mois), AV/PER bancaires, IARD filiale banque (ex : ACM = Crédit Mutuel, Pacifica = Crédit Agricole, BPCE Assurances = BP/CE), cartes bancaires, packages (Cristal, Esprit Libre…).
   - **⚠ RÈGLE DURE — PAS DE TOTAL CHIFFRÉ** : ne JAMAIS afficher de ligne "TOTAL PNB estimé". Le banquier fait son propre calcul. On se contente de lister fidèlement les flux.
   - Conclure par 1 à 2 phrases d'**opportunité ADI / domiciliation** : si la banque destinataire est déjà la banque principale → souligner l'ancrage ; sinon → lister ce qui basculerait en cas de domiciliation du nouveau prêt.
   - Si aucune relation bancaire identifiée (cas rarissime) : indiquer "Pas d'équipement bancaire significatif identifié à date".

---

### SECTION 5 — Projet immobilier

Reprend les mêmes données que l'onglet "Projet" du HTML.

**Structure :**

1. **Présentation narrative du projet** (OBLIGATOIRE, en premier) :
   - Texte en paragraphes (pas de tableau), style justifié, encadré avec bordure gauche gold (4px)
   - §1 — Qui : présenter les emprunteurs et le besoin
   - §2 — Quoi : décrire le bien
   - §3 — Comment : stratégie financière
   - §4 — Conclusion : qualifier le projet en une phrase
   - Adapter au type de projet (prêt relais, primo, investissement, VEFA…)

   C'est le texte qui fait que le banquier comprend le "pourquoi" en 30 secondes. Sans ce bloc narratif, le dossier n'est qu'une suite de tableaux sans âme.

2. **Le bien** — tableau fiche :
   - Adresse, type, description, surface habitable, surface terrain
   - DPE : classe + consommation + émissions (badge coloré en texte : A/B=vert, C/D=gold, E=orange, F/G=rouge)
   - Vendeur, notaire

3. **Travaux prévus** (si applicable) — tableau : Poste | Entreprise | Montant TTC
   - Ligne récap total

4. **Plan de financement** — tableau :
   - Prix du bien, travaux, frais notaire, frais garantie, frais dossier, frais courtage
   - **Coût global**
   - Apport personnel
   - **Montant du prêt sollicité**

5. **Dates clés** — tableau chronologique :
   - Signature compromis → fin rétractation → date limite financement → acte authentique
   - Mettre en rouge la CSF si < 30 jours

6. **🆕 Éloignement professionnel** (OBLIGATOIRE — upgrade v2.1 : en KPI ET en tableau) :

   **a) Nouvelle vignette KPI "ÉLOIGNEMENT PRO"** à AJOUTER au bandeau KPI de la Section 5.

   Modifier le bandeau KPI de la Section 5 qui passe de **2 lignes × 3 vignettes à 2 lignes × 3 vignettes + 1 ligne × 1 vignette élargie OU 3 lignes × 3 vignettes** pour accueillir l'éloignement pro. Recommandé : passer à **3 lignes × 3 vignettes = 9 KPI** :
   - Ligne 1 : Type bien / Classe DPE / Prix
   - Ligne 2 : Signature compromis / Date limite CS / Acte authentique
   - Ligne 3 : **Éloignement Emp. 1** / **Éloignement Emp. 2** / **Verdict global**

   Chaque vignette éloignement emprunteur :
   - Valeur principale : écart en km + signe (ex « −7 km » vert si rapprochement, « +12 km » rouge si éloignement, « 0 km » gray si neutre)
   - Sous-titre : « Domicile → Travail : 25 km → 18 km »
   - Si emprunteur indépendant itinérant (ex gérant paysagiste) : vignette avec « NEUTRE » gray + sous-titre « Activité itinérante »

   Verdict global : « RAPPROCHEMENT » vert / « NEUTRE » gray / « ÉLOIGNEMENT » rouge — selon majorité des emprunteurs.

   **b) Tableau détaillé en fin de section** (inchangé par rapport à v2.0) :
   - Colonnes : Emprunteur | Employeur & lieu de travail | Distance actuelle (domicile → travail) | Distance future (bien → travail) | Écart
   - Colorer l'écart : vert si rapprochement, rouge si éloignement, gris si neutre (< 5 km)
   - Source : `AA summary extract.txt` §5.6 (Éloignement professionnel)
   - Si données manquantes (adresse employeur inconnue) : indiquer "À compléter" en italique
   - **Argument bancaire** : ajouter une courte ligne sous le tableau. Un rapprochement professionnel renforce le dossier (économie de transport, cohérence du projet). Un éloignement significatif doit être mentionné factuellement sans commentaire négatif.

---

### SECTION 6 — Plan de financement détaillé

Reprend les mêmes données que l'onglet "Financement" du HTML.

**Structure :**

1. **Récapitulatif coût total** — tableau postes de dépense

2. **Plan de financement** — tableau : Prêt | Montant | Taux | Durée | Mensualité
   - Ligne apport en haut
   - Badges textuels pour les taux : "[PTZ 0%]" en vert, "[FIXE X%]" en navy

3. **Paliers de mensualités** — tableau : Palier | Période | Mensualité | Détail
   - Palier 1 en fond navy texte blanc (mensualité max)
   - Paliers suivants en fond cream

4. **Indicateurs HCSF** (tableau 2 colonnes) :
   - **Taux d'endettement** : valeur en gros, colorée (< 33% vert, 33-35% orange, ≥ 35% rouge), badge validation, reste à vivre
   - **Durée maximale** : valeur, badge validation HCSF ≤ 25 ans

5. **LTV et Saut de charge** (tableau 2 colonnes) :
   - **LTV** = Prêts amortissables ÷ (Valeur bien + Travaux) × 100. Le prêt relais est EXCLU (assimilé à un apport)
   - **Saut de charge** = Mensualité future − Charge actuelle. Coloré selon le niveau (négatif=vert, 0-20%=navy, >20%=orange, >50%=rouge)

6. **🆕 Commentaires du banquier (§0.5)** — OBLIGATOIRE si `§0.5 Commentaires banquier` de `AA summary simulation.txt` n'est pas vide

   **Placement** : immédiatement après le tableau Plan de financement, avant les paliers.

   **Style** : encadré navy — fond cream très clair `#F7F8FC`, **bordure gauche navy épaisse 4px**, icône 💬 au début, padding généreux.

   ```
   💬 Commentaires banquier (Cifacil)
   ────────────────────────────────
   [Texte intégral du §0.5, reformatté sans bullet points mais avec retour ligne si plusieurs phrases]
   ```

   Exemples de commentaires typiques :
   - « Demande de délégation d'assurance acceptée »
   - « Taux sous condition de domiciliation des revenus »
   - « Garantie caution CRÉDIT LOGEMENT privilégiée »
   - « Dossier à passer en comité engagement régional »

   Si §0.5 est vide dans le summary (aucun commentaire Cifacil), **NE PAS générer cet encadré** — sauter.

7. **🆕 Conditions suspensives (§0.6)** — OBLIGATOIRE si `§0.6 Conditions suspensives` n'est pas vide

   **Placement** : en fin de Section 6, après les indicateurs HCSF.

   **Style** : tableau simple `class="pieces"` (en-tête navy, lignes alternées cream) :
   - Colonnes : Condition | Date butoir | Statut
   - Exemples : « Obtention offre de prêt | JJ/MM/AAAA | ✓ CMCEE s'engage », « Étude géotechnique satisfaisante | … | ⏳ En cours »

   Si §0.6 est vide (aucune CS explicite en plus de la CS financement standard), générer une ligne unique : « Obtention du prêt auprès de [banque] | Date limite CS compromis | à cadrer ».

**Source unique du montage — §0 de `AA summary simulation.txt`** :
- **Récapitulatif coût total** ← §0.3 (frais) + §0.1 (apport + prêts)
- **Plan de financement détaillé** ← §0.1 (un prêt par ligne)
- **Paliers de mensualités** ← §0.1 "Mensualités AVEC assurance par palier" (palier 1 / palier 2 / …)
- **Taux, TAEG, coût total du crédit, type d'assurance (Groupe / Délégataire), type de garantie** ← §0.4
- **Commentaires banquier** (si présents) ← §0.5 — à intégrer dans un encadré info sous le tableau Plan de financement
- **Conditions suspensives** (si présentes) ← §0.6
- **LTV / Saut de charge** → recalculés par ce skill :
  - LTV = somme des prêts amortissables §0.1 ÷ (prix bien + travaux §0.3) — prêt relais EXCLU
  - Saut de charge = mensualité pic §0.1 (palier 1 AA) − charge logement actuelle §2.3 extract (loyer, ou mensualité prêts actuels si propriétaire)

⛔ **Aucun fallback PDF autorisé.** Si une donnée manque dans le §0, elle manque dans le summary — relancer `/dossier-extract-simulation` pour régénérer, ne PAS ouvrir la DDP Cifacil ni l'ALTO.

---

### SECTION 7 — Points forts du dossier (v2.2 — voir Règle 6)

⚠ **En v2.2, cette section a été radicalement simplifiée.** Reportez-vous à la RÈGLE 6 du bloc « RÈGLES COURTIER IOBSP » en tête de skill pour le périmètre autorisé. Le paragraphe historique ci-dessous reste pour référence mais est **obsolète** — seule la Règle 6 fait foi.

<details>
<summary>📜 Ancienne description (v2.1) — pour référence historique uniquement</summary>

### SECTION 7 — Note de synthèse (argumentaire banque — OBSOLÈTE v2.1)

C'est la version PDF du mail de dépôt (onglet 2 du HTML). Le ton est **commercial et persuasif** — on vend le dossier au banquier.

**Structure :**

1. **Accroche** (2-3 lignes) : salutation + résumé ultra-court du projet + montant/durée

2. **Profil emprunteur** : situation pro de chaque emprunteur, revenus retenus, RFR, situation familiale

3. **Le projet** : nature du bien, localisation, prix, travaux, coût global

4. **Plan de financement sollicité** : apport (montant + % du projet), épargne résiduelle, montant prêt, durée, éligibilité PTZ/Éco-PTZ/Action Logement

5. **Points forts du dossier** (section "Points forts") :
   - Lister tous les éléments positifs, **chiffrés et contextualisés**
   - Transformer les neutres en positifs (ex: "jeune couple dynamique" plutôt que "sans patrimoine")
   - Chaque point fort : une puce avec montant/pourcentage/date

6. **🆕 Validation tierce officielle** — BLOC STRATÉGIQUE (si §3.3.6 existe)

   Cette mention est **déterminante pour les comités d'engagement** — elle change le niveau de confiance accordé au dossier sans même que le banquier ait à instruire.

   Ajouter un court paragraphe en mise en avant (fond cream, **bordure gauche gold 4px**, puces) :

   > **Validation tierce officielle de la structure signataire**
   > • SARL [Nom] — SIREN [XXX XXX XXX] — État INSEE actif, dernière MAJ [date]
   > • N exercices déposés au Greffe TC [Ville] dans les délais légaux (source BODACC) — le dernier le [date]
   > • Aucune procédure collective, aucune radiation, aucun acte modificatif significatif
   > • Dirigeant unique confirmé RNE : [Nom] depuis [date création]
   > Pièces complémentaires (liasse fiscale 2033, attestations DGFiP/URSSAF, PV d'AG) à disposition sur demande.

   Objectif : faire passer le dossier du statut « à instruire » au statut « validé en amont ». Sans cette mention, le comité va refaire tout le travail de vérification — avec, il prend acte.

7. **🆕 Équipement bancaire transférable (PNB)** — LEVIER DE NÉGOCIATION (si §4.4.13 existe)

   C'est **l'argument commercial** pour négocier taux, frais de dossier, exonérations. La règle : le banquier doit voir combien de PNB il risque de perdre (banque actuelle) ou gagner (banque cible).

   Structure (paragraphe argumenté, PAS de tableau — on reste narratif) :

   > **Équipement bancaire transférable**
   > Le foyer génère actuellement chez [banque actuelle] un PNB annuel estimé à **X €** (assurances [MRH/auto/santé/ADI] + frais bancaires + épargne captive [AV, PEL, PER]). L'encours d'épargne captée s'élève à **Y €**. En cas de domiciliation complète de ce dossier chez [nouvelle banque cible], c'est l'intégralité de ces flux qui bascule — y compris l'ADI du présent financement (≈ Z €/mois).
   >
   > **Argument de négociation** : en contrepartie de cette domiciliation complète, le dossier appelle légitimement une condition préférentielle (baisse de taux nominale, exonération frais de dossier, ou conditions particulières sur les cartes/packages).

   Chiffres à puiser dans `§4.4.13` du summary extract — ne JAMAIS inventer un PNB.

8. **Anticipation des objections** (section "Points d'attention" — seulement si nécessaire) :
   - Format : "[Objection] → [Réponse argumentée]"
   - Ne mentionner que les vraies objections bancaires (revenus, stabilité, endettement, apport)
   - Ne JAMAIS attirer l'attention sur des signaux que la banque ne verrait pas d'elle-même (jeux, tabac…)

9. **Conclusion** : phrase de clôture professionnelle invitant la banque à une réunion de présentation. Signature Sébastien AUJARD, Groupe Apolline, ORIAS 22004081.

</details>

---

## ✅ CHECKLIST DE LIVRAISON — OBLIGATOIRE AVANT FIN DE SKILL

> **Règle absolue** : avant de considérer le PDF terminé et de le livrer au workspace, Claude DOIT créer une TodoList dédiée "Checklist livraison ddp-pdf" et cocher **un par un** chaque point ci-dessous contre le PDF produit. Si un point est KO, corriger AVANT de livrer.

### Sourcing
- [ ] Le skill a vérifié la présence de `AA summary extract.txt` ET `AA summary simulation.txt` dans le dossier client AVANT toute action
- [ ] Aucun appel à `pdfplumber` ou à l'outil `Read` sur un fichier `*.pdf` du dossier client pendant toute la génération
- [ ] Les 7 sections du PDF sont alimentées exclusivement par les deux summaries

### Structure du PDF
- [ ] Section 1 — Page de garde navy/gold (hero + KPI + pied signature)
- [ ] Section 2 — État civil (deux fiches emprunteurs + foyer + pro + **encadré Entité morale si §1.4 extract existe**)
- [ ] Section 3 — Revenus (cards par emprunteur + tableau IRPP + analyse bilancielle + **Validation tierce BODACC si §3.3.6 existe** + **Pièces niveau 4 si §3.3.7 existe**)
- [ ] Section 4 — Patrimoine & charges
- [ ] Section 5 — Projet immobilier (bien + travaux + plan financement synthèse + **éloignement pro en KPI ET tableau**)
- [ ] Section 6 — Plan de financement détaillé (coût total + prêts + paliers + HCSF/LTV/saut de charge + **Commentaires banquier §0.5** + **Conditions suspensives §0.6**)
- [ ] Section 7 — Note de synthèse argumentaire (+ **Validation tierce BODACC** + **PNB levier négociation**)

### Exploitation v2.1 des sous-sections enrichies
- [ ] Si §1.4 (entités morales) présent dans extract → encadré dédié en fin de Section 2
- [ ] Si §3.3 (analyse bilancielle) présent → bloc SIG + ratios banquier en Section 3
- [ ] Si §3.3.6 (validation tierce) présent → encadré stratégique en Section 3 ET paragraphe en Section 7
- [ ] Si §3.3.7 (pièces niveau 4) présent → annexe checklist en fin de Section 3
- [ ] Si §4.4.13 (PNB) présent → paragraphe levier négociation en Section 7
- [ ] Si §5.6 (éloignement pro) présent → vignettes KPI ligne 3 en Section 5 + tableau détaillé
- [ ] Si §0.5 (commentaires banquier) non vide → encadré 💬 en Section 6
- [ ] Si §0.6 (conditions suspensives) non vide → tableau CS en Section 6

### Cohérence financière transversale (règle d'or — tolérance 0 €)
- [ ] Total projet identique entre Section 5 (synthèse) et Section 6 (détail)
- [ ] Mensualité palier 1 identique Section 6 "Paliers" et "LTV/Saut de charge"
- [ ] Montants des prêts identiques partout
- [ ] Apport identique partout
- [ ] Taux nominaux identiques partout
- [ ] Durée identique partout
- [ ] **Aucune ligne à 0 €** dans les tableaux financiers
- [ ] **Aucun préfixe flou** (~, env., ≈, estimé, à caler, à définir)
- [ ] Tous les montants recopiés **au centime près** depuis `AA summary simulation.txt §0`

### TE / RàV / LTV
- [ ] TE recalculé à partir des revenus §3.2 de `AA summary extract.txt` (PAS ceux de la DDP ou du §0 du summary simulation)
- [ ] RàV recalculé (pas recopié de la DDP)
- [ ] LTV calculé avec prêts amortissables ÷ (prix + travaux), prêt relais EXCLU

### Livraison
- [ ] Nom de fichier : `00 C. DDP [NOM1] [NOM2].pdf`
- [ ] PDF enregistré dans le dossier client (pas seulement dans /sessions)
- [ ] Lien computer:// fourni à l'utilisateur

### Vérification finale ligne à ligne
- [ ] Relecture du §0 de `AA summary simulation.txt` vs PDF produit : chaque poste de frais, chaque prêt, chaque montant, chaque taux, chaque durée, chaque mensualité — tout doit matcher au centime

---

### 🆕 Contrôles spécifiques v2.2-v2.3 (Règles Courtier IOBSP)
- [ ] Aucune mention d'un nom d'assureur groupe (CNP, CACIF, Cardif, etc.) — Règle 1
- [ ] Formule garanties exactement « DC-PTIA-IPT-IPP-ITT (MNO : Dos + Psy) en Forfaitaire/Indemnitaire » — Règle 2
- [ ] DPE sur 3 lignes distinctes dans la fiche bien (Classe énergie / Classe GES / Référence) — Règle 3
- [ ] Tableau « Conformité HCSF » = 4 indicateurs (TE, Durée, Nature, RàV) — LTV et Saut de charge dans tableau séparé — Règle 4
- [ ] Tableau « Dates clés » = 3 dates uniquement (compromis, CS, acte authentique) — Règle 5
- [ ] Section 7 = uniquement les points forts + signature (pas d'intro, pas de profil, pas de plan, pas de PNB, pas d'objections, pas de conclusion commerciale) — Règle 6
- [ ] Section 4 contient « Contreparties bancaires proposées » (1 phrase dense) et PAS d'analyse PNB chiffrée — Règle 7
- [ ] Tous les paragraphes de prose utilisent `style_body` (TA_JUSTIFY) — Règle 8
- [ ] Aucune mention « X derniers mois » recopiée brute du summary — reformulée en « période d'observation des relevés » — Règle 8
- [ ] 🆕 Tous les tableaux avec du texte long utilisent `Paragraph` + styles dédiés, PAS de chaînes brutes — Règle 9
- [ ] 🆕 Relecture automatisée finale (pdfplumber) de chaque tableau : aucune chaîne tronquée, aucun débordement — Règle 9
- [ ] 🆕 Tableau Éloignement professionnel contient une ligne « Coût carburant mensuel estimé » chiffrée avec la formule (20 j × A/R × 7 L/100 km × 1,90 €/L) — Règle 10

---

**Si l'une des cases reste décochée après vérification, le PDF N'EST PAS livrable — corriger d'abord.** 