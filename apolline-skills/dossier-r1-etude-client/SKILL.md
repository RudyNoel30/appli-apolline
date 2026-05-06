---
name: dossier-r1-etude-client
description: >
  Génère l'étude de faisabilité PNG premium post-R1 pour le client de Groupe Apolline. Lit les PDF Cifacil (P0 DDP + V1) avec pdfplumber, construit un HTML navy/gold (hero, KPI, conformité HCSF, timeline 8 étapes) en interne, puis le rend en PNG haute définition (Playwright + Chromium headless, scale ×2) prêt à partager par WhatsApp, SMS ou email. Le PNG remplace entièrement le HTML — c'est le livrable final. MANDATORY TRIGGERS : étude client, étude faisabilité, étude post R1, étude suite rendez-vous, document client à envoyer, présentation financement client, P0 étude client, générer étude post-R1, dossier R1 étude, PNG client post rendez-vous, image étude faisabilité, livrable WhatsApp client, fiche financement à envoyer au client. Utilise ce skill dès qu'on veut le livrable commercial destiné au client après un R1, à partir des P0 Cifacil, même si l'utilisateur dit "HTML" par habitude. Ce n'est PAS le dossier interne multi-onglets (dossier-html) ni la préparation R1 (dossier-html-r1).
---

# Dossier R1 Étude Client — PNG Premium Post-Rendez-Vous

Tu es l'assistant de Sébastien AUJARD, courtier en crédit immobilier chez **Groupe Apolline**, basé au 10 rue du Colonel Mahon, 39000 Lons-le-Saunier. ORIAS : 17002647.

## Objectif

Générer une **image PNG premium en haute définition** destinée au client après le premier rendez-vous (R1). Ce livrable présente l'étude de faisabilité de son projet immobilier sous forme d'une image longue et lisible, qui peut être envoyée directement par WhatsApp, SMS ou email. Le client la consulte comme une capture d'écran : il fait défiler avec le pouce et voit l'intégralité du contenu, sans avoir à ouvrir de pièce jointe ni à cliquer sur un lien.

**Pourquoi cette forme.** Un PNG est instantanément visible dans n'importe quelle messagerie, ne nécessite ni hébergement (plus de OneDrive) ni connexion internet pour être consulté, et garantit un rendu identique sur tous les appareils. C'est la forme la plus directe et la plus moderne pour un livrable post-R1.

**Effet wahou.** Le client reçoit un message et découvre une carte longue, premium, navy/gold, avec ses propres chiffres, sa conformité réglementaire, et le parcours complet jusqu'à la remise des clés. Pas de friction, pas de "cliquez ici", juste l'image qui s'affiche.

**Le HTML reste un intermédiaire technique** — c'est le moteur de rendu (parce qu'il offre un contrôle CSS pixel-perfect sur le design navy/gold), mais il n'est jamais livré au client et est supprimé après génération du PNG.

---

## Données d'entrée

Le skill lit **deux fichiers PDF Cifacil** dans le dossier client :

1. **P0 - Etude DDP.pdf** (ou nom similaire contenant "DDP") — Demande de Prêt
2. **P0 - Etude V1.pdf** (ou nom similaire contenant "V1" ou "ALTO") — Étude de Financement

### Extraction avec pdfplumber

Utiliser `pdfplumber` pour lire chaque page des deux PDF. Les données clés à extraire :

**Depuis le DDP :**
- Identité : nom, prénom, date de naissance, adresse, situation matrimoniale, profession
- Emploi : type de contrat, employeur, date d'embauche, salaire net
- Projet : nature (ancien, neuf, VEFA, construction), destination (RP, RS, investissement), prix du bien
- Frais : notaire, garantie, dossier bancaire, courtage
- Coût total du projet
- **Tableau des prêts** : pour chaque prêt → montant, durée, taux nominal, mensualité hors assurance, TAEG
- **Tableau des assurances** : pour chaque prêt → taux ADI. RÈGLE CRITIQUE : toujours prendre le taux **entre parenthèses** qui correspond au taux sur capital initial (KI), PAS le TAEA. Exemple : si on voit "0.35 (0.14 sur KI)", le taux à retenir est **0.14**.
- Apport personnel
- Taux d'endettement
- Mensualité totale (assurance comprise)
- Garantie (type — ne jamais afficher le nom de la caisse dans le document client, toujours écrire "Caisse de garantie")

**Depuis l'Étude V1 / ALTO :**
- Taux moyen pondéré (dans le résumé P0, en haut) — c'est le taux hors assurance pondéré par les montants de chaque prêt
- Coût total du crédit (intérêts + assurance)
- Tableaux d'amortissement (pour référence si besoin)
- Reste à vivre

### Calculs dérivés

- **LTV** (Loan-To-Value) = montant total emprunté / prix du bien × 100
- Si le taux moyen pondéré n'est pas trouvé dans les PDF, le calculer : somme(montant_i × taux_i) / somme(montant_i)

---

## Règles métier impératives

1. **Jamais inventer de données** — si une info n'est pas dans les PDF, l'omettre ou marquer "Non renseigné"
2. **Caisse de garantie** — ne jamais afficher le nom de la caisse (SACCEF, Crédit Logement, etc.) dans le document client. Toujours écrire "Caisse de garantie"
3. **Taux assurance** — toujours le taux entre parenthèses du tableau DDP (KI = capital initial), jamais le TAEA
4. **Ce n'est pas une offre de prêt** — le document est une étude de faisabilité indicative. Le disclaimer en footer le précise
5. **Conformité HCSF** — vérifier et afficher : endettement ≤ 35%, durée ≤ 25 ans. Référence légale : D-HCSF-2021-7 du 29 septembre 2021
6. **Nombre de prêts variable** — le montage peut contenir 1, 2, 3 prêts ou plus (principal, modulable, PTZ, Action Logement, etc.). Adapter le détail du montage en conséquence
7. **Attestation de faisabilité** — mentionner dans l'info-box que si le projet est conforme HCSF, Apolline peut délivrer un certificat de faisabilité financière à joindre à l'offre d'achat

---

## Structure du HTML

Le HTML est une **page unique verticale** (pas d'onglets), avec les sections suivantes dans cet ordre :

### 1. Hero Header (fond navy dégradé)
- Marque "GROUPE APOLLINE" en lettrage espacé doré
- Titre "Votre étude de faisabilité" en Playfair Display
- Séparateur doré
- Sous-titre "Courtage & Patrimoine — Lons-le-Saunier"
- Badge date du rendez-vous

### 2. Vignettes KPI (grille 4 colonnes)
- 🏠 Prix du bien (vignette primary = fond navy)
- 💳 Mensualité totale (fond blanc)
- 📊 Taux d'endettement (fond blanc)
- 🏦 LTV (fond blanc)

### 3. Message d'accueil (card)
- Formule de politesse : "Cher Monsieur [Nom]," ou "Chère Madame [Nom]," (sans le prénom)
- Remerciement pour le rendez-vous
- Présentation de l'étude de faisabilité
- Paragraphe clé : "Si nous vous accompagnons, nous lancerons la mise en concurrence bancaire sur ces bases."

### 4. Votre projet (card avec icône navy)
- Nature, destination, prix du bien
- Frais : notaire, garantie, dossier bancaire, courtage
- Ligne total : coût total du projet

### 5. Plan de financement — info-box bleue
- Rappel que c'est une simulation indicative
- Mention de la mise en concurrence
- Mention de l'attestation de faisabilité HCSF (réf D-HCSF-2021-7)

### 6. Mensualité mise en valeur (card dorée centrée)
- Montant en gros (Playfair Display 36px)
- Mention "/ mois"
- Détail : "sur X ans — taux d'endettement de X%"

### 7. Détail du montage (card avec icône navy)
- Apport personnel
- Pour CHAQUE prêt :
  - Ligne principale : "Prêt [type] — taux fixe X%" → "montant € sur X ans"
  - Sous-ligne : "→ Mensualité assurance comprise" → "X €/mois"
  - Sous-ligne : "→ TAEG" → "X%"
- Taux moyen pondéré (hors assurance)
- Garantie : "Caisse de garantie"
- Assurance emprunteur (ADI) : "X% sur le capital — quotité 100%"
- Ligne total (fond navy) : Coût total du crédit

### 8. Conformité réglementaire (card avec icône verte)
- Endettement : critère HCSF 35% → afficher valeur + ✅ conforme (ou ⚠️)
- Durée : critère HCSF 25 ans → afficher valeur + ✅ conforme (ou ⚠️)
- Reste à vivre → valeur
- LTV → valeur + ✅

### 9. Pièces à fournir (card avec checklist)
- Items ✅ (done, fond vert clair) : pièces déjà transmises
- Items 📌 (pending, fond orange clair) : pièces manquantes
- Adapter la liste au profil du client (CDI, TNS, fonctionnaire, etc.)

### 10. Parcours de A à Z — Timeline 8 étapes
Timeline verticale avec barre dégradée (gold → navy → green) et dots numérotés.

**Code couleur des étapes :**
- **Gold (dot plein)** = action du client : compléter dossier, signer offre d'achat/compromis
- **Gold-outline (dot cerclé)** = délai légal passif : rétractation, réflexion offre de prêt
- **Navy (dot plein)** = action Apolline : mise en concurrence, accord de principe, déblocage
- **Green (dot plein)** = étape finale : signature notaire, remise des clés

Les 8 étapes standard :
1. **Compléter votre dossier** (gold) — "Dès maintenant"
2. **Offre d'achat & compromis** (gold) — "2 à 3 semaines" — Mention : chez Apolline on lance le travail dès l'offre d'achat, pas au compromis
3. **Délai de rétractation** (gold-outline, card legal) — "10 jours légaux"
4. **Mise en concurrence bancaire** (navy, card apolline) — "~1 mois"
5. **Accord de principe & RDV banque** (navy, card apolline) — "~1 mois" — Mention : déblocage des fonds
6. **Offre de prêt & délai de réflexion** (gold-outline, card legal) — "11 jours obligatoires"
7. **Appel de fonds & déblocage** (navy, card apolline) — "~1 mois" — "Nous demandons l'appel de fonds au notaire et réalisons le déblocage des fonds"
8. **Signature chez le notaire** (green, card final) — "~3 mois après le compromis"

### 11. CTA (call to action)
- Texte d'invitation à contacter
- Bouton doré "Nous contacter" → mailto:sebastien@groupe-apolline.com

### 12. Footer (fond navy arrondi)
- Nom : Sébastien AUJARD
- Rôle : Courtier en crédit immobilier — Groupe Apolline
- Adresse : 10 rue du Colonel Mahon — 39000 Lons-le-Saunier
- Tél : 03 84 24 34 64 — email
- ORIAS n° 17002647
- Disclaimer légal en petit

---

## Design System — CSS obligatoire

Le design est fixe et constitue l'identité visuelle d'Apolline pour ce type de document. Utiliser exactement ces spécifications :

### Fonts
```
Google Fonts : Playfair Display (400, 600, 700) + Inter (300, 400, 500, 600, 700)
```
- Titres de sections : Playfair Display
- Corps de texte : Inter
- KPI values : Playfair Display bold

### Palette
```css
:root {
  --navy: #1B2A4A;
  --navy-light: #2d4a7a;
  --gold: #C5A55A;
  --gold-light: #d4b76a;
  --gold-bg: #FFF8E7;
  --blue: #2C7BE5;
  --blue-bg: #EBF5FF;
  --green: #28a745;
  --green-bg: #E8F5E9;
  --text: #2d3436;
  --text-light: #6c757d;
  --bg: #f7f8fa;
  --white: #ffffff;
  --border: #e9ecef;
}
```

### Effets visuels
- Hero : `linear-gradient(160deg, #0f1a2e 0%, var(--navy) 40%, var(--navy-light) 100%)` + radial glow gold et bleu en pseudo-éléments
- Cards (sections) : `border-radius: 16px`, `box-shadow: 0 2px 20px rgba(0,0,0,0.04)`, hover lift `-4px`
- KPI vignettes : `border-radius: 14px`, hover effect, primary = fond navy dégradé
- Timeline dots : gradient fills avec box-shadow coloré
- Animations : `fadeUp` (opacity 0→1 + translateY 20px→0) avec delays échelonnés
- Mensualité card : fond doré dégradé + border dorée
- CTA button : gradient doré avec hover lift
- Responsive : breakpoint 640px, KPI passe en 2 colonnes

---

## Workflow d'exécution

1. **Identifier les fichiers** — chercher dans le dossier client les PDF P0 (DDP et V1/ALTO)
2. **Installer les dépendances** si nécessaire :
   - `pip install pdfplumber playwright --break-system-packages`
   - `playwright install chromium` (télécharge le navigateur headless utilisé pour le rendu)
3. **Extraire les données** — script Python avec pdfplumber sur chaque PDF
4. **Vérifier les données critiques** — s'assurer qu'on a : montant projet, mensualité, endettement, LTV, détail de chaque prêt, TAEG, taux assurance (KI), taux moyen, coût total crédit
5. **Adapter les pièces à fournir** — lister ce qui a été transmis (P1-P5 présents dans le dossier) vs ce qui manque
6. **Générer le HTML intermédiaire** — appliquer le template avec les données extraites, l'écrire dans un fichier temporaire (par exemple dans le répertoire de session, pas dans le dossier client). Ce HTML n'est jamais livré.
7. **Rendre le HTML en PNG** via Playwright + Chromium headless (voir section "Rendu PNG" ci-dessous pour le code de référence et les paramètres). Le PNG produit est le livrable final.
8. **Nommer le fichier final** : `P0 - Etude suite rendez-vous JJ-MM-AAAA.png` (date du jour, extension `.png`)
9. **Déposer dans le dossier client** (même dossier que les P0)
10. **Supprimer le HTML intermédiaire** une fois le PNG généré avec succès — le client ne doit jamais voir ce fichier, et il n'a pas vocation à être conservé.

---

## Rendu PNG — section technique

C'est l'étape qui transforme le HTML interne en image livrable. Elle est centrale au skill : si elle échoue, il n'y a pas de livrable.

### Pourquoi Playwright + Chromium

On a besoin d'un moteur capable de :
- Charger les Google Fonts (Playfair Display + Inter) et attendre qu'elles soient prêtes avant de capturer (sinon le rendu retombe sur des polices génériques et le résultat est moche)
- Gérer les dégradés CSS, les box-shadows, les border-radius — toutes les subtilités visuelles du design navy/gold
- Capturer la page entière (full_page=True) sans tronquer
- Doubler la résolution (device_scale_factor=2) pour un rendu net type Retina

Chromium headless via Playwright coche toutes ces cases. C'est l'outil standard pour ce besoin.

### Désactiver les animations avant la capture

Le HTML contient des animations `fadeUp` (opacity 0 → 1, translateY 20px → 0). Si on capture pendant que les animations sont en cours, certains éléments seront invisibles ou décalés sur l'image finale. Il faut donc **forcer tous les éléments à leur état final avant de prendre la capture**, en injectant une feuille de style qui annule les animations et les transitions.

### Code de référence

```python
from playwright.sync_api import sync_playwright
from pathlib import Path

def render_html_to_png(html_path: Path, png_path: Path) -> None:
    """Rend un fichier HTML local en PNG haute définition."""
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": 1200, "height": 800},
            device_scale_factor=2,  # rendu Retina, ~×2 plus net
        )
        page = context.new_page()

        # Charger le HTML local
        page.goto(f"file://{html_path.resolve()}")

        # Attendre que le réseau soit calme (Google Fonts chargées)
        page.wait_for_load_state("networkidle")

        # Forcer les polices à être prêtes (sécurité supplémentaire)
        page.evaluate("document.fonts.ready")

        # Neutraliser animations et transitions pour la capture
        page.add_style_tag(content="""
            *, *::before, *::after {
                animation: none !important;
                transition: none !important;
                opacity: 1 !important;
                transform: none !important;
            }
        """)

        # Petit délai de sécurité pour laisser le rendu se stabiliser
        page.wait_for_timeout(500)

        # Capture pleine page
        page.screenshot(
            path=str(png_path),
            full_page=True,
            type="png",
            omit_background=False,
        )

        browser.close()
```

### Paramètres importants à ne pas changer sans raison

- **viewport width = 1200 px** : c'est la largeur de référence du design Apolline. Elle correspond au max-width du conteneur principal du HTML. Si on la change, on casse la mise en page.
- **device_scale_factor = 2** : double la densité de pixels. Le PNG final fait donc 2400 px de large à hauteur native double. C'est ce qui donne le rendu net sur écrans Retina et lors du zoom.
- **full_page = True** : sans ça, on ne capture que la zone visible (le viewport) et on perd 90 % du contenu. Toujours True.
- **wait_for_load_state("networkidle")** : sans ça, les Google Fonts ne sont pas encore chargées au moment de la capture et le PNG retombe sur des polices système. Toujours attendre.

### Vérifications post-rendu

Après génération, vérifier que :
- Le fichier PNG existe et fait au moins 200 Ko (sous cette taille c'est probablement vide ou tronqué)
- Sa hauteur est supérieure à 3000 px (le contenu complet d'une étude fait au minimum cette hauteur). On peut le vérifier rapidement avec PIL :
  ```python
  from PIL import Image
  with Image.open(png_path) as img:
      width, height = img.size
      assert height > 3000, f"PNG suspicieusement court : {height}px"
  ```
- Si une de ces vérifications échoue, ne pas livrer le PNG : alerter et investiguer (Chromium pas installé ? HTML cassé ? polices non chargées ?)

---

## Exemple de données extraites → HTML

Voici un mapping pour illustrer comment les données Cifacil deviennent le HTML :

| Source Cifacil | Section HTML | Champ |
|---|---|---|
| DDP > Objet du financement | Votre projet | Nature, destination |
| DDP > Coût de l'opération | Votre projet | Prix, frais |
| DDP > Tableau des prêts > ligne 1 | Détail du montage | Prêt principal |
| DDP > Tableau des prêts > ligne 2 | Détail du montage | Prêt secondaire |
| DDP > Tableau assurances > (0.14 sur KI) | Détail du montage | Assurance ADI |
| DDP > Endettement | KPI + Conformité | 25,46% |
| V1 > Résumé > Taux moyen | Détail du montage | Taux moyen pondéré |
| V1 > Coût total | Détail du montage | Coût total crédit |
| Calcul : emprunt / prix bien × 100 | KPI + Conformité | LTV |

---

## Points d'attention

- Le template CSS complet est volumineux (~450 lignes). Il est intégralement défini dans les spécifications ci-dessus. Reproduire fidèlement les classes, couleurs, espacements et effets décrits.
- Si le dossier contient un PTZ (Prêt à Taux Zéro) : l'ajouter comme prêt supplémentaire avec taux 0%, mentionner "PTZ" dans le type.
- Si le client est en couple : adapter la salutation ("Madame, Monsieur [Nom]"), les pièces à fournir (×2 pour certaines), et les revenus pris en compte.
- Pour les TNS (travailleurs non salariés) : les pièces à fournir sont différentes (pas de bulletins de salaire mais bilans, URSSAF, etc.)
