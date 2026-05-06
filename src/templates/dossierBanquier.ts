/**
 * Template HTML "Dossier banquier" Apolline — basé sur le modèle DURANDIN.
 * Génère un fichier HTML autonome (CSS embarqué, navigation par onglets en JS pur)
 * à partir des données du store : dossier, client, emprunteurs, notes, courtier.
 */
import type { Dossier, Client, Collaborateur, Emprunteur, Apporteur, Pret } from '@/data/mock'
import type { Note } from '@/stores/useStore'

const eur = (n?: number | null): string => {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
const eurExact = (n?: number | null): string => {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
const pct = (n?: number | null, digits = 1): string => {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
}
const dateFr = (iso?: string): string => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
const ageFromBirth = (iso?: string): string => {
  if (!iso) return '—'
  const birth = new Date(iso)
  const now = new Date()
  const a = now.getFullYear() - birth.getFullYear()
  const adjusted = (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) ? a - 1 : a
  return `${adjusted} ans`
}
const escape = (s: any): string => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c])
const incomplete = '<span class="incomplete">À compléter</span>'

// ────────────────────────────────────────────────────────────
// CSS embarqué (issu du modèle DURANDIN, conservé tel quel)
// ────────────────────────────────────────────────────────────
const CSS = `
:root {
  --navy: #1B3B6F; --gold: #E8A020; --cream: #F7F8FC; --green: #1A7A3F;
  --green-bg: #EDFAF3; --red: #C0392B; --red-bg: #FDF2F2; --orange: #B07010;
  --orange-bg: #FFF4E0; --gray: #6B7A8D; --text: #1A2A3A; --border: #E4E8F0;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: var(--cream); color: var(--text); line-height: 1.6; }
.header { background: white; padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid var(--gold); box-shadow: 0 2px 8px rgba(27,59,111,0.08); }
.logo { font-size: 24px; font-weight: 700; color: var(--navy); }
.logo span { display: block; font-size: 11px; color: var(--gray); font-weight: 400; letter-spacing: 0.3px; }
.header-info { text-align: right; font-size: 12px; color: var(--gray); line-height: 1.5; }
.tabs { display: flex; background: var(--navy); padding: 0 40px; gap: 0; overflow-x: auto; }
.tab { padding: 14px 22px; cursor: pointer; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.65); border-bottom: 3px solid transparent; transition: all 0.2s; white-space: nowrap; }
.tab:hover { color: white; background: rgba(255,255,255,0.08); }
.tab.active { color: white; font-weight: 600; border-bottom-color: var(--gold); background: rgba(255,255,255,0.05); }
.content { max-width: 960px; margin: 0 auto; padding: 30px 20px; }
.tab-content { display: none; }
.tab-content.active { display: block; }
.date-badge { display: inline-block; background: var(--gold); color: white; font-size: 13px; font-weight: 600; padding: 8px 20px; border-radius: 6px; margin-bottom: 24px; }
.card { background: white; border-radius: 12px; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(27,59,111,0.06); border: 1px solid var(--border); }
.card h2 { font-size: 17px; color: var(--navy); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid var(--gold); }
.card h3 { font-size: 15px; color: var(--navy); margin: 18px 0 10px; }
.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 28px; }
.kpi { background: white; border-radius: 12px; padding: 20px 14px; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 6px rgba(27,59,111,0.06); }
.kpi .value { font-size: 26px; font-weight: 700; color: var(--navy); line-height: 1.2; margin-bottom: 6px; }
.kpi .label { font-size: 10px; font-weight: 700; color: var(--gray); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; }
.kpi .detail { font-size: 11px; color: var(--gray); font-weight: 400; line-height: 1.4; }
.kpi.green .value { color: var(--green); }
.kpi.gold .value { color: var(--gold); }
.kpi.red .value { color: var(--red); }
.kpi.orange .value { color: var(--orange); }
.revenue-card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border-left: 4px solid var(--navy); box-shadow: 0 1px 4px rgba(27,59,111,0.06); }
.revenue-card .name { font-size: 16px; font-weight: 700; color: var(--navy); margin-bottom: 4px; }
.revenue-card .role { font-size: 13px; color: var(--gray); margin-bottom: 14px; }
.revenue-card table { width: 100%; border-collapse: collapse; }
.revenue-card td { padding: 6px 10px; font-size: 13px; border-bottom: 1px solid #e8ecf4; }
.revenue-card td:first-child { color: var(--gray); }
.revenue-card td:last-child { font-weight: 600; text-align: right; }
.note-positive { background: var(--green-bg); color: var(--green); padding: 10px 16px; border-radius: 8px; font-size: 13px; margin-top: 12px; border-left: 3px solid var(--green); }
table.pieces { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.pieces th { background: var(--navy); color: white; padding: 10px 14px; font-size: 12px; text-align: left; font-weight: 600; }
table.pieces td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid var(--border); }
table.pieces tr:nth-child(even) { background: var(--cream); }
.status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.status.ok { background: var(--green-bg); color: var(--green); }
.status.partiel { background: var(--orange-bg); color: var(--orange); }
.status.manquant { background: var(--red-bg); color: var(--red); }
.signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border); }
.signature .name { font-weight: 700; color: var(--navy); font-size: 15px; }
.signature .title { color: var(--gray); font-size: 13px; }
.alert { padding: 14px 18px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; line-height: 1.7; }
.alert.high { background: var(--red-bg); border-left: 4px solid var(--red); color: #7A1F1F; }
.alert.medium { background: var(--orange-bg); border-left: 4px solid var(--orange); color: #7A4F10; }
.alert.low { background: var(--green-bg); border-left: 4px solid var(--green); color: #145A2E; }
.alert.info { background: #EBF5FF; border-left: 4px solid #2C7BE5; color: #1A3A5C; }
.badge-internal { display: inline-block; background: var(--orange-bg); color: var(--orange); font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px; }
.fiche-table { width: 100%; border-collapse: collapse; }
.fiche-table td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: top; }
.fiche-table td:first-child { font-weight: 600; color: var(--navy); width: 200px; white-space: nowrap; }
.compte-list { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.compte-item { background: var(--cream); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
.compte-item .banque { font-weight: 700; color: var(--navy); font-size: 13px; }
.compte-item .type { font-size: 12px; color: var(--gray); }
.badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 700; margin: 2px; }
.badge-green { background: var(--green-bg); color: var(--green); }
.badge-navy { background: var(--navy); color: white; }
.badge-gold { background: var(--orange-bg); color: var(--orange); }
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-gray { background: var(--cream); color: var(--gray); border: 1px solid var(--border); }
.incomplete { color: var(--gold); font-style: italic; }
.dpe-A { background: #2D8E2D; color: white; padding: 4px 14px; border-radius: 4px; font-weight: 800; font-size: 22px; display: inline-block; }
.dpe-B { background: #69B349; color: white; padding: 4px 14px; border-radius: 4px; font-weight: 800; font-size: 22px; display: inline-block; }
.dpe-C { background: #C2D44E; color: white; padding: 4px 14px; border-radius: 4px; font-weight: 800; font-size: 22px; display: inline-block; }
.dpe-D { background: #FFEB3B; color: #333; padding: 4px 14px; border-radius: 4px; font-weight: 800; font-size: 22px; display: inline-block; }
.dpe-E { background: #FAB432; color: white; padding: 4px 14px; border-radius: 4px; font-weight: 800; font-size: 22px; display: inline-block; }
.dpe-F { background: #ED8B36; color: white; padding: 4px 14px; border-radius: 4px; font-weight: 800; font-size: 22px; display: inline-block; }
.dpe-G { background: #FF0000; color: white; padding: 4px 14px; border-radius: 4px; font-weight: 800; font-size: 22px; display: inline-block; }
@media (max-width: 768px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .content { padding: 0 12px; margin: 16px auto; }
  .header { flex-direction: column; text-align: center; gap: 10px; padding: 16px 20px; }
}
@media print {
  body { background: white; }
  .tabs { display: none; }
  .tab-content { display: block !important; page-break-after: always; }
  .card { box-shadow: none; }
}
`

// ────────────────────────────────────────────────────────────
// Builder principal
// ────────────────────────────────────────────────────────────
export type DossierBanquierData = {
  dossier: Dossier
  client: Client
  /** Prêts du dossier — source de vérité pour banque(s), taux et mensualités. */
  prets: Pret[]
  notes: Note[]
  courtier?: Collaborateur
  apporteur?: Apporteur
}

export function buildDossierBanquierHtml(data: DossierBanquierData): string {
  const { dossier, client, prets, notes, courtier, apporteur } = data
  const e1: Emprunteur | undefined = dossier.emprunteur1
  const e2: Emprunteur | undefined = dossier.emprunteur2
  const today = new Date().toLocaleDateString('fr-FR')
  const dureeAns = dossier.dureeMois / 12
  const coutTotal =
    (dossier.coutLogement ?? dossier.montantBien) +
    (dossier.coutTerrain ?? 0) +
    (dossier.coutTravaux ?? 0) +
    (dossier.coutViabilisation ?? 0) +
    (dossier.coutMobilier ?? 0) +
    (dossier.fraisEtablissement ?? 0) +
    (dossier.fraisExpertise ?? 0) +
    (dossier.fraisAgence ?? 0) +
    (dossier.fraisNotaire ?? 0) +
    (dossier.rachatCreditCout ?? 0)

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dossier ${escape(client.nom)} — Groupe Apolline</title>
<style>${CSS}</style>
</head>
<body>

${headerSection(dossier, client)}

<div class="tabs">
  <div class="tab active" onclick="switchTab('etatcivil')">👤 État civil</div>
  <div class="tab" onclick="switchTab('revenus')">💰 Revenus</div>
  <div class="tab" onclick="switchTab('patrimoine')">🏠 Patrimoine</div>
  <div class="tab" onclick="switchTab('projet')">🏗️ Projet</div>
  <div class="tab" onclick="switchTab('financement')">💶 Financement</div>
  <div class="tab" onclick="switchTab('pieces')">📋 Pièces à fournir</div>
  <div class="tab" onclick="switchTab('notes')">🔒 Notes internes</div>
</div>

${tabEtatCivil(dossier, client, e1, e2, today)}
${tabRevenus(dossier, e1, e2, today)}
${tabPatrimoine(dossier, today)}
${tabProjet(dossier, today)}
${tabFinancement(dossier, prets, dureeAns, coutTotal, today)}
${tabPieces(dossier, today)}
${tabNotes(dossier, client, prets, notes, courtier, apporteur, today)}

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
</html>`
}

// ────────────────────────────────────────────────────────────
// Sections
// ────────────────────────────────────────────────────────────

function headerSection(dossier: Dossier, client: Client): string {
  const conjointLine = client.conjoint ? `<br>${escape(client.conjoint)}` : ''
  return `<div class="header">
  <div class="logo">Extr&apos;Apol <span>Crédit &amp; Habitat</span></div>
  <div class="header-info">
    Dossier ${escape(client.nom.toUpperCase())} — ${escape(dossier.ref)}<br>
    ${escape(client.prenom)} ${escape(client.nom)}${conjointLine}<br>
    ${escape(dossier.typeProjet)} — ${escape(dossier.villeBien)}
  </div>
</div>`
}

function tabEtatCivil(dossier: Dossier, client: Client, e1: Emprunteur | undefined, e2: Emprunteur | undefined, today: string): string {
  const age = e1?.naissance ? ageFromBirth(e1.naissance) : ageFromBirth(client.naissance)
  const profession = e1?.profession || client.profession || incomplete
  const situation = e1?.situationFamiliale ?? (client.conjoint ? 'Marié(e)' : 'Célibataire')
  const enfants = e1?.enfantsACharge ?? 0

  return `
<div id="etatcivil" class="tab-content active">
<div class="content">
  <span class="date-badge">État civil — Dossier constitué le ${escape(today)}</span>

  <div class="kpi-row" style="grid-template-columns:repeat(4,1fr);">
    <div class="kpi">
      <div class="label">Emprunteur</div>
      <div class="value" style="font-size:18px;">${escape(client.prenom)} ${escape(client.nom)}</div>
      <div class="detail">${escape(age)} — ${escape(profession)}</div>
    </div>
    <div class="kpi">
      <div class="label">Situation</div>
      <div class="value" style="font-size:16px;">${escape(situation)}</div>
      ${e2 ? `<div class="detail">avec ${escape(e2.prenom)} ${escape(e2.nom)}</div>` : ''}
    </div>
    <div class="kpi">
      <div class="label">Régime</div>
      <div class="value" style="font-size:14px;">${escape(e1?.regimeMatrimonial ?? 'À préciser')}</div>
    </div>
    <div class="kpi">
      <div class="label">Foyer</div>
      <div class="value" style="font-size:18px;">${1 + (e2 ? 1 : 0) + enfants}</div>
      <div class="detail">${e2 ? '2 emprunteurs' : '1 emprunteur'}${enfants > 0 ? ` · ${enfants} enfant${enfants > 1 ? 's' : ''}` : ''}</div>
    </div>
  </div>

  ${ficheEmprunteur(client, e1, 'principal')}
  ${e2 ? ficheEmprunteurFromE(e2, 'co-emprunteur') : ''}

  <div class="card">
    <h2>🏠 Adresse &amp; situation au logement</h2>
    <table class="fiche-table">
      <tr><td>Adresse actuelle</td><td><strong>${escape(e1?.adresse || incomplete)}${e1?.codePostal ? `, ${escape(e1.codePostal)}` : ''} ${escape(e1?.ville || client.ville || '')}</strong></td></tr>
      <tr><td>Statut d'occupation</td><td>${escape(e1?.statutOccupation ?? 'À préciser')}</td></tr>
      <tr><td>Depuis</td><td>${e1?.logementDepuis ? dateFr(e1.logementDepuis) : incomplete}</td></tr>
      <tr><td>Loyer actuel</td><td>${e1?.loyerActuel ? eur(e1.loyerActuel) : '—'}${e1?.hlm ? ' (HLM)' : ''}</td></tr>
    </table>
  </div>

  <div class="card">
    <h2>👨‍👩‍👧 Foyer fiscal</h2>
    <table class="fiche-table">
      <tr><td>Composition foyer</td><td>${e2 ? `Couple — ${escape(e1?.situationFamiliale ?? '')}` : 'Personne seule'}</td></tr>
      <tr><td>Enfants à charge</td><td>${enfants > 0 ? `${enfants} enfant${enfants > 1 ? 's' : ''} fiscalement à charge` : 'Aucun enfant fiscalement à charge'}</td></tr>
      <tr><td>Régime matrimonial</td><td>${escape(e1?.regimeMatrimonial ?? 'N/A')}</td></tr>
    </table>
  </div>
</div>
</div>`
}

function ficheEmprunteur(client: Client, e: Emprunteur | undefined, role: 'principal' | 'co-emprunteur'): string {
  const titre = role === 'principal' ? '👤 Emprunteur principal' : '👥 Co-emprunteur'
  const civilite = e?.civilite ?? ''
  return `<div class="card">
    <h2>${titre} — ${escape(client.nom.toUpperCase())} ${escape(client.prenom)}</h2>
    <table class="fiche-table">
      <tr><td>Civilité</td><td>${escape(civilite)}</td></tr>
      <tr><td>Nom</td><td><strong>${escape(client.nom.toUpperCase())}</strong></td></tr>
      <tr><td>Prénom(s)</td><td><strong>${escape(client.prenom)}</strong></td></tr>
      <tr><td>Date de naissance</td><td>${dateFr(e?.naissance ?? client.naissance)}${e?.lieuNaissance ? ` à ${escape(e.lieuNaissance)}` : ''}</td></tr>
      <tr><td>Âge</td><td><strong>${ageFromBirth(e?.naissance ?? client.naissance)}</strong></td></tr>
      <tr><td>Nationalité</td><td>${escape(e?.nationalite ?? 'Française')}</td></tr>
      <tr><td>Situation matrimoniale</td><td>${escape(e?.situationFamiliale ?? '')}</td></tr>
      <tr><td>Régime matrimonial</td><td>${escape(e?.regimeMatrimonial ?? 'N/A')}</td></tr>
      <tr><td>Téléphone</td><td>${escape(e?.telMobile || e?.telDom || client.tel || '') || incomplete}</td></tr>
      <tr><td>E-mail</td><td>${escape(e?.email || client.email || '') || incomplete}</td></tr>
      <tr><td>Profession</td><td>${escape(e?.profession || client.profession || '')}${e?.typeContrat ? ` (${escape(e.typeContrat)})` : ''}</td></tr>
      <tr><td>Employeur</td><td>${escape(e?.employeur ?? '') || incomplete}</td></tr>
      <tr><td>Ancienneté</td><td>${e?.anciennete ? `${e.anciennete} ans` : incomplete}</td></tr>
      <tr><td>Consentement RGPD</td><td>${e?.rgpdAccord ? '<span class="status ok">✓ Accordé</span>' : '<span class="status manquant">À recueillir</span>'}</td></tr>
    </table>
  </div>`
}

function ficheEmprunteurFromE(e: Emprunteur, role: 'principal' | 'co-emprunteur'): string {
  const titre = role === 'principal' ? '👤 Emprunteur principal' : '👥 Co-emprunteur'
  return `<div class="card">
    <h2>${titre} — ${escape(e.nom.toUpperCase())} ${escape(e.prenom)}</h2>
    <table class="fiche-table">
      <tr><td>Civilité</td><td>${escape(e.civilite)}</td></tr>
      <tr><td>Nom</td><td><strong>${escape(e.nom.toUpperCase())}</strong></td></tr>
      <tr><td>Prénom(s)</td><td><strong>${escape(e.prenom)}</strong></td></tr>
      <tr><td>Date de naissance</td><td>${dateFr(e.naissance)}${e.lieuNaissance ? ` à ${escape(e.lieuNaissance)}` : ''}</td></tr>
      <tr><td>Âge</td><td><strong>${ageFromBirth(e.naissance)}</strong></td></tr>
      <tr><td>Nationalité</td><td>${escape(e.nationalite)}</td></tr>
      <tr><td>Téléphone</td><td>${escape(e.telMobile || e.telDom || '') || incomplete}</td></tr>
      <tr><td>E-mail</td><td>${escape(e.email) || incomplete}</td></tr>
      <tr><td>Profession</td><td>${escape(e.profession)}${e.typeContrat ? ` (${escape(e.typeContrat)})` : ''}</td></tr>
      <tr><td>Employeur</td><td>${escape(e.employeur) || incomplete}</td></tr>
      <tr><td>Ancienneté</td><td>${e.anciennete ? `${e.anciennete} ans` : incomplete}</td></tr>
    </table>
  </div>`
}

function revenuMensuelEmp(e: Emprunteur): number {
  return e.salaireNet
    + (e.baBicBnc * (e.baBicBncMois || 12)) / 12
    + e.rfBrutsExistants
    + e.autresRevenusNonSociaux
    + e.revenusSociaux
    + e.pensionAlimentaireRecue
}

function tabRevenus(dossier: Dossier, e1: Emprunteur | undefined, e2: Emprunteur | undefined, today: string): string {
  const revE1 = e1 ? revenuMensuelEmp(e1) : 0
  const revE2 = e2 ? revenuMensuelEmp(e2) : 0
  const revMenage = (dossier.rfMenage ?? 0) + (dossier.allocFamiliales ?? 0) + (dossier.aplAlActuelle ?? 0)
  const revTotal = revE1 + revE2 + revMenage
  const rfN1 = dossier.rfReferenceN1 ?? 0
  const rfN2 = dossier.rfReferenceN2 ?? 0

  return `
<div id="revenus" class="tab-content">
<div class="content">
  <span class="date-badge">Analyse des revenus — Extraction du ${escape(today)}</span>

  <div class="kpi-row" style="grid-template-columns:repeat(4,1fr);">
    <div class="kpi green">
      <div class="label">Revenus retenus</div>
      <div class="value">${eur(revTotal)}</div>
      <div class="detail">Net mensuel total foyer</div>
    </div>
    <div class="kpi">
      <div class="label">Emprunteur principal</div>
      <div class="value" style="font-size:20px;">${eur(revE1)}</div>
      <div class="detail">Net mensuel</div>
    </div>
    ${e2 ? `<div class="kpi">
      <div class="label">Co-emprunteur</div>
      <div class="value" style="font-size:20px;">${eur(revE2)}</div>
      <div class="detail">Net mensuel</div>
    </div>` : `<div class="kpi"><div class="label">RFR ${new Date().getFullYear() - 1}</div><div class="value" style="font-size:20px;">${eur(rfN1)}</div><div class="detail">N-1</div></div>`}
    <div class="kpi">
      <div class="label">RFR ${new Date().getFullYear() - 2}</div>
      <div class="value" style="font-size:20px;">${eur(rfN2)}</div>
      <div class="detail">N-2</div>
    </div>
  </div>

  ${e1 ? revenusEmpCard(e1, 'Emprunteur principal') : '<div class="card"><p>Aucun emprunteur principal détaillé. Saisir la fiche complète depuis l\'éditeur dossier.</p></div>'}
  ${e2 ? revenusEmpCard(e2, 'Co-emprunteur') : ''}

  ${revMenage > 0 ? `<div class="card">
    <h2>👪 Revenus communs au ménage</h2>
    <table class="pieces">
      <tr><th>Source</th><th>Montant mensuel</th></tr>
      ${dossier.rfMenage ? `<tr><td>Revenus fonciers bruts ménage</td><td>${eur(dossier.rfMenage)}</td></tr>` : ''}
      ${dossier.allocFamiliales ? `<tr><td>Allocations familiales</td><td>${eur(dossier.allocFamiliales)}</td></tr>` : ''}
      ${dossier.aplAlActuelle ? `<tr><td>APL / AL actuelle</td><td>${eur(dossier.aplAlActuelle)}</td></tr>` : ''}
      <tr style="background:var(--green-bg);"><td><strong>TOTAL ménage</strong></td><td><strong>${eur(revMenage)}</strong></td></tr>
    </table>
  </div>` : ''}

  <div class="card">
    <h2>💳 Tableau récapitulatif — Total revenus retenus</h2>
    <table class="pieces">
      <tr><th>Emprunteur</th><th>Profil</th><th>Revenus retenus</th></tr>
      ${e1 ? `<tr><td><strong>${escape(e1.nom)} ${escape(e1.prenom)}</strong></td><td>${escape(e1.typeContrat)}</td><td style="font-weight:700; color:var(--green);">${eur(revE1)}/mois</td></tr>` : ''}
      ${e2 ? `<tr><td><strong>${escape(e2.nom)} ${escape(e2.prenom)}</strong></td><td>${escape(e2.typeContrat)}</td><td style="font-weight:700; color:var(--green);">${eur(revE2)}/mois</td></tr>` : ''}
      ${revMenage > 0 ? `<tr><td><strong>Ménage</strong></td><td>Allocations / RF / APL</td><td style="font-weight:700; color:var(--green);">${eur(revMenage)}/mois</td></tr>` : ''}
      <tr style="background:var(--navy); color:white;"><td colspan="2" style="font-weight:700; color:white;">TOTAL FOYER</td><td style="font-weight:800; color:var(--gold); font-size:15px;">${eur(revTotal)}/mois</td></tr>
    </table>
  </div>
</div>
</div>`
}

function revenusEmpCard(e: Emprunteur, role: string): string {
  const rev = revenuMensuelEmp(e)
  return `<div class="revenue-card">
    <div class="name">${escape(e.nom)} ${escape(e.prenom)} — ${escape(role)}</div>
    <div class="role">${escape(e.profession || '')} ${escape(e.typeContrat || '')}</div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
      <span class="badge badge-navy">${escape(e.typeContrat)}</span>
      ${e.employeur ? `<span class="badge badge-gray">${escape(e.employeur)}</span>` : ''}
    </div>
    <table>
      ${e.salaireNet ? `<tr><td>Salaire net mensuel</td><td>${eur(e.salaireNet)}</td></tr>` : ''}
      ${e.baBicBnc ? `<tr><td>BA / BIC / BNC (sur ${e.baBicBncMois} mois)</td><td>${eur(e.baBicBnc)}/mois</td></tr>` : ''}
      ${e.rfBrutsExistants ? `<tr><td>Revenus fonciers bruts</td><td>${eur(e.rfBrutsExistants)}/mois</td></tr>` : ''}
      ${e.autresRevenusNonSociaux ? `<tr><td>Autres revenus non sociaux</td><td>${eur(e.autresRevenusNonSociaux)}/mois</td></tr>` : ''}
      ${e.revenusSociaux ? `<tr><td>Revenus sociaux</td><td>${eur(e.revenusSociaux)}/mois</td></tr>` : ''}
      ${e.pensionAlimentaireRecue ? `<tr><td>Pension alimentaire reçue</td><td>${eur(e.pensionAlimentaireRecue)}/mois</td></tr>` : ''}
      <tr style="background:var(--green-bg);"><td><strong>Revenu mensuel total</strong></td><td style="color:var(--green); font-weight:700;">${eur(rev)}</td></tr>
      ${e.rfPersonnelN1 ? `<tr><td>Revenu fiscal N-1</td><td>${eur(e.rfPersonnelN1)}/an</td></tr>` : ''}
      ${e.rfPersonnelN2 ? `<tr><td>Revenu fiscal N-2</td><td>${eur(e.rfPersonnelN2)}/an</td></tr>` : ''}
    </table>
    ${e.dateEmbauche ? `<div class="note-positive">Embauché(e) depuis ${dateFr(e.dateEmbauche)} — ${e.anciennete || 0} ans d'ancienneté.</div>` : ''}
  </div>`
}

function tabPatrimoine(dossier: Dossier, today: string): string {
  const patrimoine = dossier.patrimoine ?? []
  const credits = dossier.creditsExistants ?? []
  const droitsEL = dossier.droitsEL ?? []
  const totalMensCredits = credits.reduce((s, c) => s + c.mensualite, 0)
  const totalApresRA = credits.filter((c) => c.devenir === 'À conserver' || c.devenir === 'En cours').reduce((s, c) => s + c.mensualite, 0)
  const epargneTotal = (dossier.emprunteur1?.salaireNet ?? 0) // placeholder

  return `
<div id="patrimoine" class="tab-content">
<div class="content">
  <span class="date-badge">Bilan patrimonial — ${escape(today)}</span>

  <div class="kpi-row" style="grid-template-columns:repeat(4,1fr);">
    <div class="kpi orange">
      <div class="label">Apport personnel</div>
      <div class="value">${eur(dossier.apport)}</div>
      <div class="detail">Apport déclaré au montage</div>
    </div>
    <div class="kpi green">
      <div class="label">Patrimoine immo</div>
      <div class="value" style="font-size:18px;">${eur(patrimoine.reduce((s, b) => s + b.valeur, 0))}</div>
      <div class="detail">${patrimoine.length} bien${patrimoine.length > 1 ? 's' : ''}</div>
    </div>
    <div class="kpi">
      <div class="label">CRD total</div>
      <div class="value" style="font-size:18px;">${eur(credits.reduce((s, c) => s + c.crd, 0) + patrimoine.reduce((s, b) => s + b.crd, 0))}</div>
      <div class="detail">Capital restant dû tous prêts</div>
    </div>
    <div class="kpi">
      <div class="label">Mensualités</div>
      <div class="value" style="font-size:18px;">${eur(totalMensCredits)}</div>
      <div class="detail">Total prêts en cours</div>
    </div>
  </div>

  ${patrimoine.length > 0 ? `<div class="card">
    <h2>🏠 Patrimoine immobilier</h2>
    <table class="pieces">
      <tr><th>Bien</th><th>Type</th><th>Valeur</th><th>CRD</th><th>Revenu</th><th>Statut</th></tr>
      ${patrimoine.map((b) => `<tr>
        <td>${escape(b.libelle)}</td>
        <td>${escape(b.type)}</td>
        <td>${eur(b.valeur)}</td>
        <td>${eur(b.crd)}</td>
        <td>${b.revenu ? `${eur(b.revenu)}/mois` : '—'}</td>
        <td>${b.venteEnvisagee ? '<span class="status partiel">En cession</span>' : (b.hypotheque ? '<span class="status partiel">Hypothèque</span>' : '<span class="status ok">Pleine propriété</span>')}</td>
      </tr>`).join('')}
    </table>
  </div>` : '<div class="card"><h2>🏠 Patrimoine immobilier</h2><p style="color:var(--gray);">Aucun bien immobilier renseigné. Saisir depuis l\'éditeur dossier.</p></div>'}

  ${credits.length > 0 ? `<div class="card">
    <h2>💳 Crédits en cours</h2>
    <table class="pieces">
      <tr><th>Type</th><th>Organisme</th><th>Mensualité</th><th>CRD</th><th>Devenir</th></tr>
      ${credits.map((c) => `<tr>
        <td>${escape(c.libelle)}<br><small>${escape(c.type)}</small></td>
        <td>${escape(c.organisme ?? '—')}</td>
        <td>${eur(c.mensualite)}</td>
        <td>${eur(c.crd)}</td>
        <td><span class="badge ${c.devenir === 'À solder' ? 'badge-gold' : c.devenir === 'À conserver' ? 'badge-navy' : 'badge-green'}">${escape(c.devenir)}</span></td>
      </tr>`).join('')}
      <tr style="background:#f0f4ff;"><td colspan="2"><strong>TOTAL mensualités actuelles</strong></td><td><strong>${eur(totalMensCredits)}</strong></td><td colspan="2"></td></tr>
      <tr style="background:var(--green-bg);"><td colspan="2"><strong>Après opération</strong></td><td><strong>${eur(totalApresRA)}</strong></td><td colspan="2"><small>Crédits maintenus</small></td></tr>
    </table>
  </div>` : ''}

  ${droitsEL.length > 0 ? `<div class="card">
    <h2>💰 Droits Épargne Logement</h2>
    <table class="pieces">
      <tr><th>Type</th><th>Droits</th><th>Cédés ?</th><th>Titulaire</th></tr>
      ${droitsEL.map((d) => `<tr>
        <td>${escape(d.type)}</td>
        <td>${eur(d.droits)}</td>
        <td>${d.cedes ? '<span class="status partiel">Cédés</span>' : '<span class="status ok">Disponibles</span>'}</td>
        <td>${escape(d.titulaire)}</td>
      </tr>`).join('')}
    </table>
  </div>` : ''}

  <div class="card">
    <h2>📋 Charges récurrentes identifiées</h2>
    <p style="color:var(--gray); font-size:13px;">À détailler à partir des relevés bancaires (extraction Extr&apos;Apol).</p>
    <table class="pieces">
      <tr><th>Charge</th><th>Montant/mois</th></tr>
      ${(dossier.emprunteur1?.loyerActuel ?? 0) ? `<tr><td>Loyer actuel</td><td>${eur(dossier.emprunteur1!.loyerActuel)}</td></tr>` : ''}
      ${(dossier.emprunteur1?.empruntsLocatifs ?? 0) ? `<tr><td>Emprunts locatifs (perso)</td><td>${eur(dossier.emprunteur1!.empruntsLocatifs)}</td></tr>` : ''}
      ${(dossier.emprunteur1?.empruntsNonLocatifs ?? 0) ? `<tr><td>Emprunts non locatifs (perso)</td><td>${eur(dossier.emprunteur1!.empruntsNonLocatifs)}</td></tr>` : ''}
      ${(dossier.empruntsLocatifsMenage ?? 0) ? `<tr><td>Emprunts locatifs (ménage)</td><td>${eur(dossier.empruntsLocatifsMenage)}</td></tr>` : ''}
      ${(dossier.empruntsNonLocatifsMenage ?? 0) ? `<tr><td>Emprunts non locatifs (ménage)</td><td>${eur(dossier.empruntsNonLocatifsMenage)}</td></tr>` : ''}
      ${(dossier.autresDepensesMenage ?? 0) ? `<tr><td>Autres dépenses ménage</td><td>${eur(dossier.autresDepensesMenage)}</td></tr>` : ''}
    </table>
  </div>
</div>
</div>`
}

function tabProjet(dossier: Dossier, today: string): string {
  const dpe = (dossier.emprunteur1 as any)?.dpe ?? 'D' // Pas dans le modèle, fallback
  const dpeClass = `dpe-${dpe.toUpperCase()}`
  const coutLogement = dossier.coutLogement ?? dossier.montantBien
  const coutTotal =
    coutLogement +
    (dossier.coutTerrain ?? 0) +
    (dossier.coutTravaux ?? 0) +
    (dossier.coutViabilisation ?? 0) +
    (dossier.coutMobilier ?? 0) +
    (dossier.fraisEtablissement ?? 0) +
    (dossier.fraisExpertise ?? 0) +
    (dossier.fraisAgence ?? 0) +
    (dossier.fraisNotaire ?? 0) +
    (dossier.rachatCreditCout ?? 0)

  return `
<div id="projet" class="tab-content">
<div class="content">
  <span class="date-badge">Projet d'acquisition — ${escape(today)}</span>

  <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:14px;">
    <div class="kpi"><div class="label">Type de bien</div><div class="value" style="font-size:18px;">🏠 ${escape(dossier.typeLogement ?? 'Maison')}</div><div class="detail">${escape(dossier.typeAchat ?? 'Ancien')}</div></div>
    <div class="kpi"><div class="label">Classe énergétique</div><div class="value" style="font-size:40px;"><span class="${dpeClass}">${escape(dpe)}</span></div><div class="detail">DPE</div></div>
    <div class="kpi gold"><div class="label">Travaux</div><div class="value">${eur(dossier.coutTravaux ?? 0)}</div><div class="detail">Devis travaux prévus</div></div>
  </div>

  <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:28px;">
    <div class="kpi"><div class="label">Compromis</div><div class="value" style="font-size:14px;">${dossier.compromisSigne ? '<span style="color:var(--green);">Signé</span>' : '<span style="color:var(--orange);">À signer</span>'}</div></div>
    <div class="kpi"><div class="label">Acte prévu le</div><div class="value" style="font-size:14px;">${dossier.actePrevuLe ? dateFr(dossier.actePrevuLe) : '—'}</div></div>
    <div class="kpi"><div class="label">HCSF</div><div class="value" style="font-size:14px; color:${dossier.hcsfOk ? 'var(--green)' : 'var(--red)'};">${dossier.hcsfOk ? 'Conforme' : 'Hors norme'}</div></div>
  </div>

  <div class="card">
    <h2>🏠 Le bien à acquérir</h2>
    <table class="fiche-table">
      <tr><td>Adresse</td><td><strong>${escape(dossier.villeBien)}</strong></td></tr>
      <tr><td>Type</td><td>${escape(dossier.typeLogement ?? 'Maison')} · ${escape(dossier.typeAchat ?? 'Ancien')}</td></tr>
      <tr><td>Destination</td><td>${escape(dossier.destination ?? 'Résidence principale')}</td></tr>
      <tr><td>Prix d'achat</td><td><strong>${eur(coutLogement)}</strong></td></tr>
      <tr><td>Compromis signé</td><td>${dossier.compromisSigne ? '<span class="status ok">Oui</span>' : '<span class="status partiel">Non</span>'}</td></tr>
      <tr><td>Acte authentique</td><td>${dossier.actePrevuLe ? dateFr(dossier.actePrevuLe) : incomplete}</td></tr>
    </table>
  </div>

  <div class="card">
    <h2>💶 Plan de financement — Synthèse</h2>
    <table class="fiche-table">
      <tr><td>Coût total opération</td><td><strong>${eur(coutTotal)}</strong></td></tr>
      <tr><td>dont logement</td><td>${eur(coutLogement)}</td></tr>
      ${(dossier.coutTerrain ?? 0) > 0 ? `<tr><td>dont terrain</td><td>${eur(dossier.coutTerrain)}</td></tr>` : ''}
      ${(dossier.coutTravaux ?? 0) > 0 ? `<tr><td>dont travaux</td><td>${eur(dossier.coutTravaux)}</td></tr>` : ''}
      ${(dossier.fraisNotaire ?? 0) > 0 ? `<tr><td>dont frais notaire</td><td>${eur(dossier.fraisNotaire)}</td></tr>` : ''}
      ${(dossier.fraisAgence ?? 0) > 0 ? `<tr><td>dont frais agence</td><td>${eur(dossier.fraisAgence)}</td></tr>` : ''}
      ${(dossier.fraisExpertise ?? 0) > 0 ? `<tr><td>dont frais expertise</td><td>${eur(dossier.fraisExpertise)}</td></tr>` : ''}
      ${(dossier.fraisEtablissement ?? 0) > 0 ? `<tr><td>dont frais établissement</td><td>${eur(dossier.fraisEtablissement)}</td></tr>` : ''}
      ${(dossier.coutMobilier ?? 0) > 0 ? `<tr><td>dont mobilier</td><td>${eur(dossier.coutMobilier)}</td></tr>` : ''}
      ${(dossier.rachatCreditCout ?? 0) > 0 ? `<tr><td>dont rachat de crédit</td><td>${eur(dossier.rachatCreditCout)}</td></tr>` : ''}
      <tr style="background:var(--green-bg);"><td><strong>Apport personnel</strong></td><td><strong>${eur(dossier.apport)}</strong></td></tr>
      <tr style="background:var(--navy); color:white;"><td><strong>Prêt sollicité</strong></td><td style="color:var(--gold);"><strong>${eur(dossier.montantPret)}</strong></td></tr>
    </table>
  </div>

  <div class="card">
    <h2>📅 Dates clés</h2>
    <table class="fiche-table">
      <tr><td>Compromis signé le</td><td>${dossier.compromisSigne ? '<span class="status ok">Signé</span>' : incomplete}</td></tr>
      <tr><td>Acte authentique prévu</td><td>${dossier.actePrevuLe ? dateFr(dossier.actePrevuLe) : incomplete}</td></tr>
      <tr><td>Dossier créé le</td><td>${dateFr(dossier.createdAt)}</td></tr>
      ${dossier.r1Date ? `<tr><td>R1 réalisé le</td><td>${dateFr(dossier.r1Date)}</td></tr>` : ''}
      ${dossier.signatureDate ? `<tr><td>Signature offre le</td><td>${dateFr(dossier.signatureDate)}</td></tr>` : ''}
    </table>
  </div>
</div>
</div>`
}

function tabFinancement(dossier: Dossier, prets: Pret[], dureeAns: number, coutTotal: number, today: string): string {
  // Agrégats calculés depuis les prêts (source de vérité depuis le refactor Cifacil).
  const pretsActifs = prets.filter((p) => p.dossierId === dossier.id)
  const totalCapital = pretsActifs.reduce((s, p) => s + (p.montant ?? 0), 0) || dossier.montantPret
  const totalMensualite = pretsActifs.reduce((s, p) => s + (p.mensualiteHorsAssurance ?? 0), 0)
  const dureeMaxMois = pretsActifs.reduce((m, p) => Math.max(m, p.dureeMois ?? 0), 0) || dossier.dureeMois
  // Taux moyen pondéré par capital (utile pour TAEG estimatif et affichage).
  const tauxPondere = totalCapital > 0
    ? pretsActifs.reduce((s, p) => s + (p.tauxNominal ?? 0) * (p.montant ?? 0), 0) / totalCapital
    : 0
  const taux = tauxPondere > 0 ? tauxPondere : 0.032
  const mensualite = totalMensualite > 0 ? totalMensualite : computeMensualite(totalCapital, taux, dureeMaxMois)
  const coutCredit = mensualite * dureeMaxMois - totalCapital
  const taeg = taux + 0.005 // approximatif
  const ltv = dossier.ltv
  // Liste de banques distinctes (pour le sous-titre).
  const banques = Array.from(new Set(pretsActifs.map((p) => p.banque).filter(Boolean) as string[]))
  const banquesLabel = banques.length > 0 ? banques.join(' · ') : ''

  return `
<div id="financement" class="tab-content">
<div class="content">
  <span class="date-badge">Financement — Estimation indicative · ${escape(today)}</span>

  <div class="kpi-row" style="grid-template-columns:repeat(3,1fr); margin-bottom:14px;">
    <div class="kpi gold"><div class="label">Mensualité estimée</div><div class="value">${eur(Math.round(mensualite))}</div><div class="detail">Hors assurance · ${dureeAns} ans</div></div>
    <div class="kpi ${dossier.hcsfOk ? 'green' : 'red'}"><div class="label">HCSF</div><div class="value" style="font-size:18px;">${dossier.hcsfOk ? '✓ Conforme' : 'Hors norme'}</div><div class="detail">Endettement, durée, LTV</div></div>
    <div class="kpi"><div class="label">Score confiance</div><div class="value">${dossier.scoreConfiance}/100</div><div class="detail">Estimation interne</div></div>
  </div>

  <div class="kpi-row" style="grid-template-columns:repeat(3,1fr); margin-bottom:28px;">
    <div class="kpi"><div class="label">Durée</div><div class="value">${dureeAns} ans</div><div class="detail">${dossier.dureeMois} mois</div></div>
    <div class="kpi ${ltv <= 0.8 ? 'green' : ltv <= 0.95 ? '' : 'orange'}"><div class="label">LTV</div><div class="value">${pct(ltv, 1)}</div><div class="detail">Prêt ÷ valeur bien</div></div>
    <div class="kpi"><div class="label">Taux nominal</div><div class="value">${pct(taux, 3)}</div><div class="detail">Estimatif</div></div>
  </div>

  <div class="card">
    <h2>💰 Récapitulatif coût total</h2>
    <table class="pieces">
      <tr><th>Poste</th><th>Montant</th></tr>
      <tr><td>Prix d'achat du bien</td><td>${eur(dossier.coutLogement ?? dossier.montantBien)}</td></tr>
      ${(dossier.coutTerrain ?? 0) > 0 ? `<tr><td>Terrain</td><td>${eur(dossier.coutTerrain)}</td></tr>` : ''}
      ${(dossier.coutTravaux ?? 0) > 0 ? `<tr><td>Travaux</td><td>${eur(dossier.coutTravaux)}</td></tr>` : ''}
      ${(dossier.fraisNotaire ?? 0) > 0 ? `<tr><td>Frais notaire</td><td>${eur(dossier.fraisNotaire)}</td></tr>` : ''}
      ${(dossier.fraisAgence ?? 0) > 0 ? `<tr><td>Frais agence</td><td>${eur(dossier.fraisAgence)}</td></tr>` : ''}
      ${(dossier.fraisExpertise ?? 0) > 0 ? `<tr><td>Frais expertise</td><td>${eur(dossier.fraisExpertise)}</td></tr>` : ''}
      ${(dossier.fraisEtablissement ?? 0) > 0 ? `<tr><td>Frais dossier bancaire</td><td>${eur(dossier.fraisEtablissement)}</td></tr>` : ''}
      ${(dossier.coutMobilier ?? 0) > 0 ? `<tr><td>Mobilier</td><td>${eur(dossier.coutMobilier)}</td></tr>` : ''}
      ${(dossier.rachatCreditCout ?? 0) > 0 ? `<tr><td>Rachat de crédit</td><td>${eur(dossier.rachatCreditCout)}</td></tr>` : ''}
      <tr style="background:var(--navy);"><td colspan="1" style="color:white; font-weight:700;">TOTAL PROJET</td><td style="color:var(--gold); font-weight:800; font-size:15px;">${eur(coutTotal)}</td></tr>
    </table>
  </div>

  <div class="card">
    <h2>🏦 Plan de financement</h2>
    <table class="pieces">
      <tr><th>Source</th><th>Montant</th><th>Taux</th><th>Durée</th><th>Mensualité</th></tr>
      <tr style="background:var(--green-bg);"><td><strong>Apport personnel</strong></td><td><strong>${eur(dossier.apport)}</strong></td><td>—</td><td>—</td><td>—</td></tr>
      ${pretsActifs.length > 0
        ? pretsActifs.map((p) => `<tr><td><strong>${escape(p.libelle ?? 'Prêt immobilier')}</strong>${p.banque ? `<br><small>${escape(p.banque)}</small>` : ''}</td><td>${eur(p.montant ?? 0)}</td><td><span class="badge badge-navy">${pct(p.tauxNominal ?? 0, 3)}</span></td><td>${p.dureeMois ?? 0} mois</td><td>${eur(Math.round(p.mensualiteHorsAssurance ?? p.mensualiteTotale ?? 0))}</td></tr>`).join('')
        : `<tr><td><strong>Prêt immobilier</strong>${banquesLabel ? `<br><small>${escape(banquesLabel)}</small>` : ''}</td><td>${eur(totalCapital)}</td><td><span class="badge badge-navy">Fixe ${pct(taux, 3)}</span></td><td>${dureeMaxMois} mois (${dureeAns} ans)</td><td>${eur(Math.round(mensualite))}</td></tr>`}
      <tr style="background:var(--navy);"><td colspan="4" style="color:white; font-weight:700;">TOTAL</td><td style="color:var(--gold); font-weight:800; font-size:14px;">${eur(Math.round(mensualite))}/mois</td></tr>
    </table>
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:14px;">
      <div style="background:var(--cream); border-radius:8px; padding:14px; text-align:center;">
        <div style="font-size:10px; color:var(--gray); text-transform:uppercase; font-weight:700;">TAEG estimé</div>
        <div style="font-size:20px; font-weight:700; color:var(--navy); margin:4px 0;">${pct(taeg, 3)}</div>
        <div style="font-size:11px; color:var(--gray);">Hors DDP exacte</div>
      </div>
      <div style="background:var(--cream); border-radius:8px; padding:14px; text-align:center;">
        <div style="font-size:10px; color:var(--gray); text-transform:uppercase; font-weight:700;">Taux nominal</div>
        <div style="font-size:20px; font-weight:700; color:var(--navy); margin:4px 0;">${pct(taux, 3)}</div>
        <div style="font-size:11px; color:var(--gray);">${banquesLabel || 'Indicatif marché'}</div>
      </div>
      <div style="background:var(--cream); border-radius:8px; padding:14px; text-align:center;">
        <div style="font-size:10px; color:var(--gray); text-transform:uppercase; font-weight:700;">Coût total crédit</div>
        <div style="font-size:20px; font-weight:700; color:var(--navy); margin:4px 0;">${eur(Math.round(coutCredit))}</div>
        <div style="font-size:11px; color:var(--gray);">Intérêts</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>✅ Conformité HCSF</h2>
    <table class="fiche-table">
      <tr><td>LTV</td><td><strong>${pct(ltv, 1)}</strong> ${ltv <= 1 ? '<span class="status ok">✓ ≤ 100 %</span>' : '<span class="status manquant">✗ Dépasse</span>'}</td></tr>
      <tr><td>Durée du prêt</td><td><strong>${dureeAns} ans</strong> ${dureeAns <= 25 ? '<span class="status ok">✓ ≤ 25 ans HCSF</span>' : '<span class="status manquant">✗ Dépasse</span>'}</td></tr>
      <tr><td>Nature du projet</td><td>${escape(dossier.destination ?? 'Résidence principale')} <span class="status ok">✓ Conforme</span></td></tr>
      <tr><td>Conformité globale</td><td>${dossier.hcsfOk ? '<span class="status ok">✓ Conforme HCSF</span>' : '<span class="status manquant">✗ Hors norme</span>'}</td></tr>
    </table>
  </div>
</div>
</div>`
}

function computeMensualite(capital: number, tauxAnnuel: number, dureeMois: number): number {
  const t = tauxAnnuel / 12
  if (t === 0 || dureeMois === 0) return capital / Math.max(dureeMois, 1)
  return (capital * t) / (1 - Math.pow(1 + t, -dureeMois))
}

function tabPieces(dossier: Dossier, today: string): string {
  const fournies = dossier.piecesFournies
  const total = dossier.piecesTotal
  const manquantes = total - fournies
  const completion = total > 0 ? Math.round((fournies / total) * 100) : 0

  return `
<div id="pieces" class="tab-content">
<div class="content">
  <span class="date-badge">Pièces à fournir — État au ${escape(today)}</span>

  <div class="kpi-row" style="grid-template-columns:repeat(4,1fr);">
    <div class="kpi green"><div class="label">Fournies</div><div class="value">${fournies}</div><div class="detail">Pièces validées</div></div>
    <div class="kpi red"><div class="label">Manquantes</div><div class="value">${manquantes}</div><div class="detail">À obtenir</div></div>
    <div class="kpi"><div class="label">Total requis</div><div class="value">${total}</div><div class="detail">Pièces P1-P5</div></div>
    <div class="kpi gold"><div class="label">Complétion</div><div class="value">${completion} %</div><div class="detail">Avant dépôt banque</div></div>
  </div>

  <div class="card">
    <h2>📁 Catégories de pièces (P1-P5)</h2>
    <table class="pieces">
      <tr><th>Catégorie</th><th>Description</th><th>Statut</th></tr>
      <tr><td><strong>P1</strong></td><td>Identité &amp; situation familiale (CNI, livret de famille, justif domicile)</td><td><span class="status ok">À vérifier</span></td></tr>
      <tr><td><strong>P2</strong></td><td>Charges &amp; patrimoine (TA crédits, taxe foncière, relevés)</td><td><span class="status ok">À vérifier</span></td></tr>
      <tr><td><strong>P3</strong></td><td>Revenus &amp; fiscal (bulletins, IRPP, attestations)</td><td><span class="status ok">À vérifier</span></td></tr>
      <tr><td><strong>P4</strong></td><td>Comptes &amp; épargne (relevés bancaires, livrets)</td><td><span class="status ok">À vérifier</span></td></tr>
      <tr><td><strong>P5</strong></td><td>Projet (compromis, DPE, plans, devis travaux)</td><td><span class="status ok">À vérifier</span></td></tr>
    </table>
    <div class="alert info" style="margin-top:14px;">ℹ️ Le détail pièce par pièce sera enrichi par l&apos;extraction Extr&apos;Apol (skill <code>dossier-extract</code>) — chemin OneDrive lié au dossier.</div>
  </div>

  ${dossier.alertes.length > 0 ? `<div class="card">
    <h2>⚠️ Alertes pièces actives (${dossier.alertes.length})</h2>
    ${dossier.alertes.map((a) => `<div class="alert medium">${escape(a)}</div>`).join('')}
  </div>` : ''}
</div>
</div>`
}

function tabNotes(dossier: Dossier, client: Client, prets: Pret[], notes: Note[], courtier: Collaborateur | undefined, apporteur: Apporteur | undefined, today: string): string {
  const banquesLabel = Array.from(new Set(prets.filter((p) => p.dossierId === dossier.id).map((p) => p.banque).filter(Boolean) as string[])).join(' · ')
  const notesDuDossier = notes.filter((n) => n.dossierId === dossier.id)
  const courtierLine = courtier
    ? `${escape(courtier.prenom)} ${escape(courtier.nom)}`
    : 'Sébastien AUJARD'
  const courtierTitre = courtier?.roleLabel ?? 'Courtier en crédit immobilier'

  return `
<div id="notes" class="tab-content">
<div class="content">
  <div style="display:flex; align-items:center; gap:14px; margin-bottom:24px;">
    <span class="badge-internal">🔒 Document interne — Ne pas diffuser</span>
    <span style="font-size:12px; color:var(--gray);">Réservé à Groupe Apolline</span>
  </div>

  <div class="kpi-row" style="grid-template-columns:repeat(4,1fr);">
    <div class="kpi ${dossier.alertes.length === 0 ? 'green' : 'red'}"><div class="label">Alertes pièces</div><div class="value">${dossier.alertes.length}</div><div class="detail">Points d'attention</div></div>
    <div class="kpi"><div class="label">Notes équipe</div><div class="value">${notesDuDossier.length}</div><div class="detail">Notes internes saisies</div></div>
    <div class="kpi ${dossier.hcsfOk ? 'green' : 'red'}"><div class="label">HCSF</div><div class="value" style="font-size:16px;">${dossier.hcsfOk ? 'Conforme' : 'Hors norme'}</div><div class="detail">Conformité globale</div></div>
    <div class="kpi gold"><div class="label">Score confiance</div><div class="value">${dossier.scoreConfiance} / 100</div><div class="detail">Estimation Extr&apos;Apol</div></div>
  </div>

  <div class="card" style="border-left:4px solid var(--gold);">
    <h2>📞 Coordonnées de l'emprunteur</h2>
    <table class="fiche-table">
      <tr><td>Emprunteur principal</td><td><strong>${escape(client.prenom)} ${escape(client.nom)}</strong></td></tr>
      <tr><td>Téléphone</td><td>${escape(client.tel) || incomplete}</td></tr>
      <tr><td>E-mail</td><td>${escape(client.email) || incomplete}</td></tr>
      ${client.conjoint ? `<tr><td>Co-emprunteur</td><td>${escape(client.conjoint)}</td></tr>` : ''}
      ${apporteur ? `<tr><td>Apporteur</td><td>${escape(apporteur.nom)} (${escape(apporteur.type)})</td></tr>` : `<tr><td>Apporteur</td><td>${escape(client.apporteur || incomplete)}</td></tr>`}
    </table>
  </div>

  ${dossier.alertes.length > 0 ? `<div class="card">
    <h2>⚠️ Section 1 — Alertes &amp; Points d'attention</h2>
    ${dossier.alertes.map((a) => `<div class="alert medium">🟡 ${escape(a)}</div>`).join('')}
  </div>` : `<div class="card">
    <h2>⚠️ Section 1 — Alertes &amp; Points d'attention</h2>
    <div class="alert low">✅ Aucune alerte active sur ce dossier.</div>
  </div>`}

  ${notesDuDossier.length > 0 ? `<div class="card">
    <h2>📝 Section 2 — Notes équipe</h2>
    ${notesDuDossier.map((n) => `<div style="background:var(--cream); border-radius:8px; padding:14px; margin-bottom:10px;">
      <div style="font-size:12px; color:var(--gray); margin-bottom:6px;"><strong>${escape(n.auteurNom)}</strong> · ${dateFr(n.date)}</div>
      <div style="font-size:13px; line-height:1.6; white-space:pre-wrap;">${escape(n.contenu)}</div>
    </div>`).join('')}
  </div>` : ''}

  <div class="card" style="border:2px solid var(--navy);">
    <h2>🎯 Section 3 — Score de confiance bancaire</h2>
    <div style="text-align:center; padding:20px;">
      <div style="font-size:48px; font-weight:800; color:${dossier.scoreConfiance >= 85 ? 'var(--green)' : dossier.scoreConfiance >= 70 ? 'var(--gold)' : 'var(--red)'};">
        ${dossier.scoreConfiance} / 100
      </div>
      <div style="font-size:13px; color:var(--gray); margin-top:8px;">
        ${dossier.scoreConfiance >= 85 ? 'Excellent — dossier solide pour dépôt' : dossier.scoreConfiance >= 70 ? 'Correct — quelques points à travailler' : 'Fragile — révision nécessaire'}
      </div>
    </div>
    <div style="background:linear-gradient(to right, var(--red), var(--orange), var(--gold), var(--green)); height:10px; border-radius:5px; margin:16px 0 8px;"></div>
    <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--gray);">
      <span>0 — Bloquant</span><span>50 — Passable</span><span>75 — Bon</span><span>100 — Excellent</span>
    </div>
  </div>

  <div class="card" style="border-left:4px solid var(--gold);">
    <h2>🎯 Recommandation courtier</h2>
    <p style="font-size:13px; line-height:1.9; margin-bottom:16px;">
      Dossier <strong>${escape(client.prenom)} ${escape(client.nom)}</strong>, ${escape(dossier.typeProjet)} à ${escape(dossier.villeBien)}.
      Montant prêt sollicité : <strong>${eur(dossier.montantPret)}</strong> sur <strong>${dossier.dureeMois / 12} ans</strong>.
      LTV : <strong>${pct(dossier.ltv, 0)}</strong>. Score : <strong>${dossier.scoreConfiance}/100</strong>.
      ${banquesLabel ? `Banque(s) cible(s) : <strong>${escape(banquesLabel)}</strong>.` : ''}
    </p>

    <div class="signature">
      <div class="name">${courtierLine}</div>
      <div class="title">${escape(courtierTitre)} — Groupe Apolline</div>
      <div class="title">10 rue du Colonel Mahon — 39000 Lons-le-Saunier — ORIAS 22004081</div>
      <div class="title">Analyse du ${escape(today)}</div>
    </div>
  </div>
</div>
</div>`
}
