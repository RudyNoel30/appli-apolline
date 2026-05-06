# Template d'injection — Onglet "🗺️ Étude DVF"

Ce fichier contient les 3 blocs à injecter dans le HTML du dossier client. Tous les placeholders `{{...}}` doivent être remplacés par les valeurs calculées avant injection. Les montants en € sont formatés avec espaces fines (`145 000 €`).

---

## BLOC 1 — CSS (à insérer juste avant `</style>`)

```css
/* ===== ONGLET DVF ===== */
.dvf-hero { background:linear-gradient(135deg, var(--navy,#0B1E3F) 0%, #14305c 100%); color:#fff; padding:26px 30px; border-radius:8px; margin-bottom:18px; border-left:5px solid var(--gold,#C9A24A); }
.dvf-hero h3 { margin:0 0 6px 0; color:var(--gold,#C9A24A); font-size:.85em; text-transform:uppercase; letter-spacing:1.5px; }
.dvf-hero .range { font-size:2.2em; font-weight:800; letter-spacing:-.5px; margin:6px 0; }
.dvf-hero .note { opacity:.85; font-size:.88em; }
.dvf-kpi-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin:14px 0; }
.dvf-kpi { background:linear-gradient(135deg, #fff 0%, #f2f4f8 100%); border:1px solid #e1e4ec; border-left:4px solid var(--gold,#C9A24A); border-radius:6px; padding:14px 18px; }
.dvf-kpi .lbl { font-size:.72em; color:#666; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; }
.dvf-kpi .val { font-size:1.5em; font-weight:700; color:var(--navy,#0B1E3F); }
.dvf-kpi .xtra { font-size:.78em; color:#888; margin-top:2px; }
.dvf-table { width:100%; border-collapse:collapse; font-size:.88em; margin-top:10px; }
.dvf-table th { background:var(--navy,#0B1E3F); color:#fff; text-align:left; padding:9px 10px; font-weight:600; font-size:.82em; }
.dvf-table td { padding:7px 10px; border-bottom:1px solid #e1e4ec; }
.dvf-table tr:hover td { background:#fafbfd; }
.dvf-valo-table td:first-child { font-weight:600; color:var(--navy,#0B1E3F); }
.dvf-valo-table td:last-child, .dvf-valo-table td:nth-last-child(2) { text-align:right; font-variant-numeric:tabular-nums; }
.dvf-valo-table .total-row { background:var(--navy,#0B1E3F); color:#fff; font-weight:700; }
.dvf-valo-table .total-row td:last-child, .dvf-valo-table .total-row td:nth-last-child(2) { color:var(--gold,#C9A24A); }
.dvf-verdict { padding:18px 22px; border-radius:6px; margin:14px 0; border-left:5px solid; }
.dvf-verdict.ok { background:#eef7ef; border-color:#2e7d32; color:#1e4d22; }
.dvf-verdict.warn { background:#fff7e6; border-color:#c77700; color:#7a4a00; }
.dvf-verdict.ko { background:#fdecef; border-color:#b00020; color:#7a0015; }
.dvf-verdict h4 { margin:0 0 6px 0; font-size:1.05em; }
.dvf-hint { background:#f0f4fa; border-left:3px solid var(--navy,#0B1E3F); padding:10px 14px; font-size:.88em; border-radius:4px; margin:10px 0; }
.dvf-chip { display:inline-block; padding:3px 10px; border-radius:3px; font-size:.72em; font-weight:700; margin-right:6px; color:#fff; }
.dvf-chip.a,.dvf-chip.b { background:#2e7d32; }
.dvf-chip.c { background:#8bc34a; color:#1a1a1a; }
.dvf-chip.d { background:#ffb400; color:#1a1a1a; }
.dvf-chip.e { background:#f08c00; }
.dvf-chip.f { background:#dd4e00; }
.dvf-chip.g { background:#b00020; }
.dvf-section { margin-bottom:22px; }
.dvf-section h3 { color:var(--navy,#0B1E3F); font-size:1.1em; border-bottom:2px solid var(--gold,#C9A24A); padding-bottom:6px; margin-top:24px; }
.dvf-foot { text-align:center; color:#888; font-size:.78em; margin-top:24px; font-style:italic; }
```

---

## BLOC 2 — Bouton d'onglet (à insérer dans `.tabs`)

Insérer juste avant `<div class="tab" onclick="switchTab('notes')">` (ou avant `<div class="tab" onclick="switchTab('simulateur')">` si l'onglet simulateur est déjà présent) :

```html
<div class="tab" onclick="switchTab('dvf')">🗺️ Étude DVF</div>
```

---

## BLOC 3 — Contenu HTML (à insérer juste avant `<div id="notes">` ou `<div id="simulateur">`)

```html
<div id="dvf" class="tab-content">
<h2>🗺️ Étude DVF — Valorisation & contrôle surfinancement</h2>

<!-- SYNTHÈSE -->
<div class="dvf-hero">
  <h3>Fourchette de valeur vénale</h3>
  <div class="range">{{VAL_LO}} — {{VAL_HI}}</div>
  <div class="note">Valeur centrale ≈ {{VAL_MED}} · Décote DPE {{DPE_CLASSE}} appliquée ({{DPE_DECOTE}} %)</div>
</div>

<div class="dvf-kpi-grid">
  <div class="dvf-kpi"><div class="lbl">Bien</div><div class="val">Maison {{ANNEE}}</div><div class="xtra">SHAB {{SHAB}} m² · bâti {{BATI_SOL}} m² + annexe {{ANNEXE}} m²</div></div>
  <div class="dvf-kpi"><div class="lbl">Terrain</div><div class="val">{{TERRAIN}} m²</div><div class="xtra">≈ {{CONSTR}} m² constructibles + {{AGRI}} m² agricoles</div></div>
  <div class="dvf-kpi"><div class="lbl">DPE</div><div class="val"><span class="dvf-chip {{DPE_CLASSE_LOWER}}">{{DPE_CLASSE}}</span> · <span class="dvf-chip {{GES_CLASSE_LOWER}}">{{GES_CLASSE}}</span></div><div class="xtra">{{DPE_DATE}}</div></div>
  <div class="dvf-kpi"><div class="lbl">Échantillon DVF</div><div class="val">{{N_VENTES}} ventes</div><div class="xtra">{{COMMUNE}} {{PERIODE}} · {{N_COMPS}} comparables</div></div>
</div>

<!-- SECTION 1 — LE BIEN -->
<div class="dvf-section">
<h3>1 · Le bien</h3>
<table class="dvf-table dvf-valo-table">
<tr><td>Adresse</td><td>{{ADRESSE}}</td></tr>
<tr><td>Parcelle</td><td>Section {{SECTION}} n° {{NUM_PARCELLE}} ({{PARCELLE_ID}})</td></tr>
<tr><td>Contenance</td><td>{{TERRAIN}} m²</td></tr>
<tr><td>Surface habitable (DPE)</td><td>{{SHAB}} m²</td></tr>
<tr><td>Année de construction</td><td>{{ANNEE}}</td></tr>
<tr><td>Matériaux</td><td>{{MATERIAUX}}</td></tr>
<tr><td>DPE / GES</td><td><span class="dvf-chip {{DPE_CLASSE_LOWER}}">{{DPE_CLASSE}}</span> {{DPE_CONSO}} kWh EP/m²/an · <span class="dvf-chip {{GES_CLASSE_LOWER}}">{{GES_CLASSE}}</span></td></tr>
<tr><td>Chauffage</td><td>{{CHAUFFAGE}}</td></tr>
<tr><td>Date DPE</td><td>{{DPE_DATE}}</td></tr>
<tr><td>Historique DVF parcelle</td><td>{{HISTO_PARCELLE}}</td></tr>
</table>
</div>

<!-- SECTION 2 — MARCHÉ LOCAL -->
<div class="dvf-section">
<h3>2 · Marché local — {{COMMUNE}}</h3>
<div class="dvf-kpi-grid">
  <div class="dvf-kpi"><div class="lbl">Transactions {{PERIODE}}</div><div class="val">{{N_VENTES}}</div></div>
  <div class="dvf-kpi"><div class="lbl">Prix médian</div><div class="val">{{PRIX_MEDIAN}}</div><div class="xtra">Moyenne : {{PRIX_MOY}}</div></div>
  <div class="dvf-kpi"><div class="lbl">€/m² médian</div><div class="val">{{PM2_MEDIAN}} €</div><div class="xtra">Moyenne : {{PM2_MOY}} €/m²</div></div>
  <div class="dvf-kpi"><div class="lbl">Bâti médian</div><div class="val">{{BATI_MEDIAN}} m²</div></div>
</div>
<h4 style="margin-top:14px;">Évolution annuelle</h4>
<table class="dvf-table">
<thead><tr><th>Année</th><th>N ventes</th><th>Prix médian</th><th>€/m² médian</th></tr></thead>
<tbody>{{YEAR_ROWS}}</tbody>
</table>
<p style="margin-top:10px; color:#777; font-size:.88em;">{{TENDANCE_COMMENTAIRE}}</p>
</div>

<!-- SECTION 3 — COMPARABLES -->
<div class="dvf-section">
<h3>3 · Comparables retenus</h3>
<p>Sélection : bâti {{BATI_LO}}-{{BATI_HI}} m² et terrain ≥ {{TERRAIN_MIN_COMP}} m². <b>N = {{N_COMPS}}</b>.</p>
<div class="dvf-kpi-grid">
  <div class="dvf-kpi"><div class="lbl">Prix médian comparables</div><div class="val">{{COMP_PRIX_MEDIAN}}</div></div>
  <div class="dvf-kpi"><div class="lbl">€/m² médian comparables</div><div class="val">{{COMP_PM2_MEDIAN}} €</div><div class="xtra">Fourchette retenue : {{COMP_PM2_LO}} – {{COMP_PM2_HI}} €/m²</div></div>
</div>
<table class="dvf-table">
<thead><tr><th>Date</th><th>Prix</th><th>Bâti</th><th>Terrain</th><th>Pièces</th><th>€/m²</th><th>Adresse</th></tr></thead>
<tbody>{{COMP_ROWS}}</tbody>
</table>
</div>

<!-- SECTION 4 — VALORISATION -->
<div class="dvf-section">
<h3>4 · Valorisation — approche par composantes</h3>
<table class="dvf-table dvf-valo-table">
<thead><tr><th>Composante</th><th>Hypothèse</th><th style="text-align:right;">Borne basse</th><th style="text-align:right;">Borne haute</th></tr></thead>
<tbody>
<tr><td>Maison principale</td><td>{{SHAB}} m² × {{COMP_PM2_LO}} à {{COMP_PM2_HI}} €/m²</td><td>{{V_BATI_LO}}</td><td>{{V_BATI_HI}}</td></tr>
<tr><td>Annexe / dépendance</td><td>{{ANNEXE}} m² × 200 à 400 €/m²</td><td>{{V_ANNEXE_LO}}</td><td>{{V_ANNEXE_HI}}</td></tr>
<tr><td>Terrain constructible</td><td>≈ {{CONSTR}} m² × 25 à 40 €/m²</td><td>{{V_CONSTR_LO}}</td><td>{{V_CONSTR_HI}}</td></tr>
<tr><td>Terrain agricole / naturel</td><td>≈ {{AGRI}} m² × 0,80 à 2,00 €/m²</td><td>{{V_AGRI_LO}}</td><td>{{V_AGRI_HI}}</td></tr>
<tr style="background:#f0f4fa; font-weight:600;"><td colspan="2">Sous-total avant DPE</td><td>{{V_SOUS_LO}}</td><td>{{V_SOUS_HI}}</td></tr>
<tr><td>Décote DPE {{DPE_CLASSE}}</td><td>{{DPE_DECOTE}} %</td><td>{{V_DECOTE_LO}}</td><td>{{V_DECOTE_HI}}</td></tr>
<tr class="total-row"><td colspan="2">VALEUR VÉNALE RETENUE</td><td>{{VAL_LO}}</td><td>{{VAL_HI}}</td></tr>
</tbody>
</table>
<div class="dvf-kpi-grid" style="margin-top:14px;">
  <div class="dvf-kpi"><div class="lbl">Scénario prudent</div><div class="val">{{VAL_LO}}</div><div class="xtra">Base contrôle banque (LTV ≤ 95 %)</div></div>
  <div class="dvf-kpi"><div class="lbl">Valeur centrale</div><div class="val">{{VAL_MED}}</div><div class="xtra">Estimation d'expertise indicative</div></div>
  <div class="dvf-kpi"><div class="lbl">Scénario favorable</div><div class="val">{{VAL_HI}}</div><div class="xtra">Si zonage majoritairement constructible</div></div>
</div>
</div>

<!-- SECTION 5 — CONTRÔLE SURFINANCEMENT -->
<div class="dvf-section">
<h3>5 · Contrôle de surfinancement</h3>
<div class="dvf-verdict {{VERDICT_CLASS}}">
<h4>{{VERDICT_EMOJI}} {{VERDICT_LABEL}}</h4>
Prix d'achat annoncé : <b>{{PRIX_ACHAT}}</b> · Valeur vénale prudente : <b>{{VAL_LO}}</b> · Seuil d'alerte surfinancement : <b>{{SEUIL_ALERTE}}</b>
<br>{{VERDICT_DETAIL}}
</div>
<table class="dvf-table dvf-valo-table">
<tr><td>LTV max recommandée (95 %)</td><td style="text-align:right;">{{PRET_MAX_95}}</td></tr>
<tr><td>LTV 100 % (plafond absolu valeur prudente)</td><td style="text-align:right;">{{PRET_MAX_100}}</td></tr>
<tr><td>Frais de notaire ancien (~7,5 %)</td><td style="text-align:right;">{{FRAIS_NOT}}</td></tr>
<tr><td>Enveloppe totale si prix d'achat retenu</td><td style="text-align:right;">{{ENVELOPPE}}</td></tr>
</table>
<div class="dvf-hint"><b>À croiser en RDV :</b> DPE fourni par vendeur, rapport d'expertise éventuel, zonage PLU exact de la parcelle (U / A / N), état réel du bien (visite), servitudes et baux ruraux éventuels.</div>
</div>

<!-- SECTION 6 — VENTES DÉTAILLÉES -->
<div class="dvf-section">
<h3>6 · Ventes détaillées {{COMMUNE}} ({{N_VENTES_AFFICHEES}} dernières)</h3>
<table class="dvf-table">
<thead><tr><th>Date</th><th>Prix</th><th>Bâti</th><th>Terrain</th><th>Pièces</th><th>€/m²</th><th>Adresse</th></tr></thead>
<tbody>{{SALES_ROWS}}</tbody>
</table>
</div>

<!-- SECTION 7 — LIMITES -->
<div class="dvf-section">
<h3>7 · Limites & réserves</h3>
<ul>
<li>{{LIMITE_HISTO_PARCELLE}}</li>
<li>Zonage PLU non récupérable via API — hypothèse {{CONSTR}} m² constructible à confirmer en mairie de {{COMMUNE}}.</li>
<li>DVF ne qualifie ni l'état du bien ni la présence de dépendances valorisantes.</li>
<li>{{LIMITE_OCCUPATION}}</li>
<li>Étude à actualiser par une expertise terrain si enjeu de financement > 300 000 €.</li>
</ul>
</div>

<div class="dvf-foot">Étude générée le {{DATE_EXTRACTION}} · Source : DVF DGFiP via Pappers Immobilier ({{N_VENTES}} transactions analysées).</div>
</div>
```

---

## Règles de remplissage des placeholders

### Placeholders numériques formatés
- `{{VAL_LO}}`, `{{VAL_HI}}`, `{{VAL_MED}}`, tous les `{{V_*}}`, `{{PRIX_*}}`, `{{COMP_PRIX_*}}`, `{{SEUIL_ALERTE}}`, `{{PRET_MAX_*}}`, `{{FRAIS_NOT}}`, `{{ENVELOPPE}}`, `{{PRIX_ACHAT}}` → format `"145 000 €"` (espace fine, €, zéro décimale).
- `{{PM2_*}}`, `{{COMP_PM2_*}}` → entier sans décimale, unité `€` apposée dans le template.
- `{{BATI_*}}`, `{{SHAB}}`, `{{ANNEXE}}`, `{{TERRAIN}}`, `{{CONSTR}}`, `{{AGRI}}` → entier, m² dans le template.

### Placeholders calculés

**Décote DPE** (`{{DPE_DECOTE}}`) :

| DPE_CLASSE | DPE_DECOTE |
|---|---|
| A, B | 0 |
| C | -1 |
| D | -2 |
| E | -3 |
| F | -7 |
| G | -12 |

**Verdict surfinancement** :

| Condition | VERDICT_CLASS | VERDICT_EMOJI | VERDICT_LABEL |
|---|---|---|---|
| PRIX_ACHAT ≤ VAL_MED | `ok` | 🟢 | Conforme — financement sécurisé |
| VAL_MED < PRIX_ACHAT ≤ VAL_HI × 1,05 | `warn` | 🟡 | À surveiller — négociation souhaitable |
| PRIX_ACHAT > VAL_HI × 1,05 | `ko` | 🔴 | Surfinancement — risque de refus banque |

**VERDICT_DETAIL** : phrase contextuelle en fonction de l'écart (ex : « Le prix d'achat excède la valeur centrale de X €, soit +Y %. Cible de négociation : Z €. »).

**Tendance commentaire** : phrase en fonction des variations annuelles (ex : « Progression régulière du €/m² de X € (2021) à Y € (2024), soit +Z % sur 4 ans. »).

**LIMITE_HISTO_PARCELLE** : si aucune vente DVF sur la parcelle, écrire « Pas d'historique de vente DVF sur la parcelle {{PARCELLE_ID}} elle-même (aucun point d'ancrage direct). » ; sinon résumer les dernières mutations.

**LIMITE_OCCUPATION** : si un occupant entreprise est remonté par l'API, mentionner sa date de sortie et d'éventuelles servitudes ; sinon « Aucun occupant professionnel détecté dans la base ».

### Sous-balises CSS pour les chips DPE/GES

`{{DPE_CLASSE_LOWER}}` et `{{GES_CLASSE_LOWER}}` = la lettre DPE en minuscule (`a`, `b`, ..., `g`) pour appliquer la bonne couleur de fond du chip.

---

## Fonction helper à utiliser côté Python

```python
def eur(x: float) -> str:
    return f"{x:,.0f} €".replace(",", " ")

def decote_dpe(classe: str) -> float:
    return {"A": 0, "B": 0, "C": -0.01, "D": -0.02, "E": -0.03, "F": -0.07, "G": -0.12}.get(classe.upper(), 0)

def verdict(prix_achat, val_med, val_hi):
    seuil = val_hi * 1.05
    if prix_achat <= val_med:
        return "ok", "🟢", "Conforme — financement sécurisé"
    if prix_achat <= seuil:
        return "warn", "🟡", "À surveiller — négociation souhaitable"
    return "ko", "🔴", "Surfinancement — risque de refus banque"
```
