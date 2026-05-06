/**
 * Template HTML unifié pour les factures Apolline.
 *
 * Génère un document HTML autonome (CSS inline) prêt à imprimer en PDF
 * via le navigateur (Ctrl+P → "Enregistrer au format PDF").
 *
 * S'adapte aux 4 types d'émission + 4 d'avoir. Mentions IOBSP + ORIAS
 * automatiques. RIB Apolline pour règlement par virement.
 */
import type { Facture } from '@/db/api'

type Dossier = {
  ref: string
  clientNom?: string | null
  villeBien?: string | null
  typeProjet?: string | null
}

type Client = {
  prenom?: string | null
  nom?: string | null
  email?: string | null
  tel?: string | null
  ville?: string | null
}

export type FactureContext = {
  facture: Facture
  dossier: Dossier
  client: Client | null
}

const TYPE_TITLE: Record<string, string> = {
  honoraires: 'NOTE D\'HONORAIRES',
  comm_banque: 'FACTURE — COMMISSION BANCAIRE',
  comm_autre: 'FACTURE — COMMISSION',
  ristourne: 'NOTE DE RISTOURNE APPORTEUR',
  avoir_honoraires: 'AVOIR SUR HONORAIRES',
  avoir_comm_banque: 'AVOIR SUR COMMISSION BANCAIRE',
  avoir_comm_autre: 'AVOIR SUR COMMISSION',
  avoir_ristourne: 'AVOIR SUR RISTOURNE',
}

const MODE_LABEL: Record<string, string> = {
  virement: 'Virement bancaire',
  cheque: 'Chèque',
  prelevement: 'Prélèvement',
  cb: 'Carte bancaire',
  numeraire: 'Espèces',
  via_notaire: 'Via le notaire',
  via_banque: 'Via la banque',
  autre: 'Autre',
}

// Coordonnées Apolline (à terme : à charger depuis Paramètres / settings).
// Pour le moment, valeurs par défaut Groupe Apolline Lons-le-Saunier.
const APOLLINE = {
  raisonSociale: 'GROUPE APOLLINE',
  adresse: '10 rue du Colonel Mahon',
  cpVille: '39000 Lons-le-Saunier',
  tel: '03 84 24 34 64',
  email: 'contact@groupe-apolline.com',
  siret: '——',
  rcs: 'RCS Lons-le-Saunier',
  orias: '17002647',
  tva: '——',
  iban: '——',
  bic: '——',
  banque: '——',
}

const eur = (cents: number): string =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

const dateFr = (s: string | null): string => {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('fr-FR') } catch { return s.slice(0, 10) }
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildFactureHtml(ctx: FactureContext): string {
  const { facture: f, dossier: d, client: c } = ctx
  const isAvoir = f.type.startsWith('avoir_')
  const title = TYPE_TITLE[f.type] ?? 'FACTURE'

  // Bénéficiaire / destinataire
  const destNom = f.partenaireNom ?? (c ? `${c.prenom ?? ''} ${c.nom ?? ''}`.trim() : '—')
  const destEmail = f.partenaireEmail ?? c?.email ?? ''
  const destLine2 = f.partenaireType === 'client' && c?.ville ? c.ville : ''

  // Pour les ristournes : Apolline est le payeur, pas le bénéficiaire
  const isRistourne = f.type === 'ristourne' || f.type === 'avoir_ristourne'

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(f.ref)} — ${escapeHtml(title)}</title>
<style>
  :root {
    --navy: #0A1F3D;
    --navy-light: #2d4a7a;
    --gold: #C9A961;
    --gold-light: #d4b76a;
    --gold-bg: #FFF8E7;
    --bg: #f7f8fa;
    --text: #2d3436;
    --text-light: #6c757d;
    --border: #e2e8f0;
  }
  @page { size: A4; margin: 1.6cm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color: var(--text);
    margin: 0;
    padding: 0;
    line-height: 1.5;
    font-size: 11pt;
  }
  .doc { max-width: 18cm; margin: 0 auto; padding: 1.2cm 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--gold); }
  .head .brand { }
  .head .brand h1 { font-family: Georgia, serif; font-size: 22pt; color: var(--navy); margin: 0; letter-spacing: 0.04em; }
  .head .brand .subtitle { font-size: 9pt; color: var(--gold); text-transform: uppercase; letter-spacing: 0.18em; margin-top: 0.2rem; font-weight: 600; }
  .head .brand .address { font-size: 9pt; color: var(--text-light); margin-top: 0.6rem; line-height: 1.4; }
  .head .meta { text-align: right; }
  .head .meta .ref { font-family: "Courier New", monospace; font-size: 16pt; color: var(--navy); font-weight: 700; }
  .head .meta .label { font-size: 9pt; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.12em; }
  .head .meta .date { font-size: 10pt; color: var(--text); margin-top: 0.4rem; }

  .title-banner {
    background: var(--navy);
    color: white;
    padding: 0.8rem 1.2rem;
    margin: 1rem 0;
    border-left: 4px solid var(--gold);
    text-align: center;
  }
  .title-banner h2 { margin: 0; font-family: Georgia, serif; font-size: 14pt; letter-spacing: 0.06em; }
  .title-banner.avoir { background: #7c2d3d; }

  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin: 1.5rem 0; }
  .party { padding: 0.9rem 1rem; border: 1px solid var(--border); border-radius: 6px; background: white; }
  .party .role { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.12em; color: var(--gold); font-weight: 600; margin-bottom: 0.4rem; }
  .party .name { font-weight: 600; color: var(--navy); font-size: 11pt; }
  .party .line { font-size: 10pt; color: var(--text); margin-top: 0.15rem; }

  .ref-info { font-size: 10pt; color: var(--text-light); margin: 1rem 0; padding: 0.6rem 1rem; background: var(--bg); border-radius: 4px; }
  .ref-info strong { color: var(--navy); }

  table.amounts { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  table.amounts th { background: var(--navy); color: white; padding: 0.6rem 0.8rem; text-align: left; font-size: 9pt; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; }
  table.amounts th.right { text-align: right; }
  table.amounts td { padding: 0.7rem 0.8rem; border-bottom: 1px solid var(--border); font-size: 10pt; }
  table.amounts td.right { text-align: right; font-variant-numeric: tabular-nums; }
  table.amounts tr.total td { background: var(--gold-bg); font-weight: 700; font-size: 12pt; color: var(--navy); border-top: 2px solid var(--gold); border-bottom: 2px solid var(--gold); }
  table.amounts tr.total td.right { color: var(--navy); }

  .reglement { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; padding: 0.8rem 1rem; background: var(--bg); border-radius: 6px; font-size: 10pt; }
  .reglement .lbl { color: var(--text-light); font-size: 9pt; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.2rem; }
  .reglement .val { color: var(--navy); font-weight: 600; }

  .rib { margin: 1rem 0; padding: 1rem; border: 1px dashed var(--gold); border-radius: 6px; background: var(--gold-bg); }
  .rib .title { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.12em; color: var(--gold); font-weight: 700; margin-bottom: 0.5rem; }
  .rib .row { display: flex; justify-content: space-between; font-size: 10pt; padding: 0.15rem 0; }
  .rib .row .lbl { color: var(--text-light); }
  .rib .row .val { font-family: "Courier New", monospace; color: var(--navy); font-weight: 600; }

  .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); font-size: 8pt; color: var(--text-light); line-height: 1.4; }
  .footer strong { color: var(--navy); }
  .mentions { margin-top: 0.6rem; font-size: 7.5pt; }

  @media print {
    body { background: white; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="doc">

  <header class="head">
    <div class="brand">
      <h1>${escapeHtml(APOLLINE.raisonSociale)}</h1>
      <div class="subtitle">Crédit & Habitat</div>
      <div class="address">
        ${escapeHtml(APOLLINE.adresse)}<br>
        ${escapeHtml(APOLLINE.cpVille)}<br>
        ${escapeHtml(APOLLINE.tel)} · ${escapeHtml(APOLLINE.email)}
      </div>
    </div>
    <div class="meta">
      <div class="label">${isAvoir ? 'Avoir' : 'Facture'} N°</div>
      <div class="ref">${escapeHtml(f.ref)}</div>
      <div class="date">Émise le ${dateFr(f.emiseLe ?? f.createdAt)}</div>
      ${f.echeanceLe ? `<div class="date">Échéance : <strong>${dateFr(f.echeanceLe)}</strong></div>` : ''}
    </div>
  </header>

  <div class="title-banner ${isAvoir ? 'avoir' : ''}">
    <h2>${escapeHtml(title)}</h2>
  </div>

  <div class="parties">
    <div class="party">
      <div class="role">${isRistourne ? 'Versée par' : 'Émetteur'}</div>
      <div class="name">${escapeHtml(APOLLINE.raisonSociale)}</div>
      <div class="line">${escapeHtml(APOLLINE.adresse)}</div>
      <div class="line">${escapeHtml(APOLLINE.cpVille)}</div>
      <div class="line" style="margin-top: 0.3rem; font-size: 9pt; color: var(--text-light);">
        ORIAS n° ${escapeHtml(APOLLINE.orias)}
      </div>
    </div>
    <div class="party">
      <div class="role">${isRistourne ? 'Bénéficiaire' : 'Destinataire'}</div>
      <div class="name">${escapeHtml(destNom)}</div>
      ${destLine2 ? `<div class="line">${escapeHtml(destLine2)}</div>` : ''}
      ${destEmail ? `<div class="line" style="font-size: 9pt; color: var(--text-light);">${escapeHtml(destEmail)}</div>` : ''}
    </div>
  </div>

  <div class="ref-info">
    <strong>Dossier :</strong> ${escapeHtml(d.ref)}
    ${d.typeProjet ? ` · ${escapeHtml(d.typeProjet)}` : ''}
    ${d.villeBien ? ` à ${escapeHtml(d.villeBien)}` : ''}
    ${f.acteLe ? ` · Date d'acte : ${dateFr(f.acteLe)}` : ''}
  </div>

  <table class="amounts">
    <thead>
      <tr>
        <th>Désignation</th>
        <th class="right" style="width: 4cm;">Montant HT</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${escapeHtml(f.prestation ?? defaultPrestation(f.type))}</td>
        <td class="right">${eur(f.montantHt)}</td>
      </tr>
      ${f.tvaTaux > 0 ? `
        <tr>
          <td style="color: var(--text-light); font-size: 9pt;">TVA ${(f.tvaTaux * 100).toFixed(1).replace('.0', '')}%</td>
          <td class="right" style="color: var(--text-light);">${eur(f.montantTva)}</td>
        </tr>
      ` : `
        <tr>
          <td style="color: var(--text-light); font-size: 9pt;">TVA non applicable — art. 293 B du CGI ou opération exonérée</td>
          <td class="right" style="color: var(--text-light);">—</td>
        </tr>
      `}
      <tr class="total">
        <td>TOTAL ${isAvoir ? '(à rembourser)' : 'TTC'}</td>
        <td class="right">${eur(f.montantTtc)}</td>
      </tr>
    </tbody>
  </table>

  <div class="reglement">
    <div>
      <div class="lbl">Mode de règlement</div>
      <div class="val">${f.modeReglement ? escapeHtml(MODE_LABEL[f.modeReglement] ?? f.modeReglement) : 'À définir'}</div>
    </div>
    <div>
      <div class="lbl">Conditions</div>
      <div class="val">Paiement ${f.echeanceLe ? `au plus tard le ${dateFr(f.echeanceLe)}` : 'à réception'}</div>
    </div>
  </div>

  ${(f.modeReglement === 'virement' || !f.modeReglement) && !isAvoir && !isRistourne ? `
    <div class="rib">
      <div class="title">Coordonnées bancaires Apolline (pour règlement par virement)</div>
      <div class="row"><span class="lbl">Banque</span><span class="val">${escapeHtml(APOLLINE.banque)}</span></div>
      <div class="row"><span class="lbl">IBAN</span><span class="val">${escapeHtml(APOLLINE.iban)}</span></div>
      <div class="row"><span class="lbl">BIC</span><span class="val">${escapeHtml(APOLLINE.bic)}</span></div>
      <div class="row"><span class="lbl">Référence à indiquer</span><span class="val">${escapeHtml(f.ref)} — ${escapeHtml(d.ref)}</span></div>
    </div>
  ` : ''}

  ${f.commentaire ? `
    <div style="margin: 1rem 0; padding: 0.6rem 1rem; background: var(--bg); border-radius: 4px; font-size: 9.5pt; color: var(--text);">
      <strong style="color: var(--navy);">Note :</strong> ${escapeHtml(f.commentaire)}
    </div>
  ` : ''}

  <footer class="footer">
    <strong>${escapeHtml(APOLLINE.raisonSociale)}</strong> · ${escapeHtml(APOLLINE.cpVille)} · ${escapeHtml(APOLLINE.rcs)} · SIRET ${escapeHtml(APOLLINE.siret)} · TVA intracommunautaire ${escapeHtml(APOLLINE.tva)}
    <div class="mentions">
      Intermédiaire en Opérations de Banque et en Services de Paiement (IOBSP) · ORIAS n° ${escapeHtml(APOLLINE.orias)} · Garantie financière et assurance Responsabilité Civile Professionnelle conformes aux articles L.519-3-4 et L.519-4 du Code monétaire et financier.
      ${f.tvaTaux === 0 ? ' TVA non applicable, art. 293 B du CGI.' : ''}
    </div>
  </footer>

</div>
</body>
</html>`
}

function defaultPrestation(type: string): string {
  switch (type) {
    case 'honoraires':
    case 'avoir_honoraires':
      return 'Honoraires de courtage en crédit immobilier — montage et placement bancaire du dossier'
    case 'comm_banque':
    case 'avoir_comm_banque':
      return 'Commission de courtage versée par la banque sur le prêt accordé'
    case 'comm_autre':
    case 'avoir_comm_autre':
      return 'Commission d\'apport / partenariat'
    case 'ristourne':
    case 'avoir_ristourne':
      return 'Rétrocession de commission sur dossier apporté'
    default:
      return 'Prestation de courtage'
  }
}

/** Ouvre une nouvelle fenêtre avec le HTML de la facture, prête à imprimer. */
export function printFacture(ctx: FactureContext): void {
  const html = buildFactureHtml(ctx)
  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  // Attendre le rendu avant d'imprimer
  w.addEventListener('load', () => {
    setTimeout(() => w.print(), 200)
  })
}
