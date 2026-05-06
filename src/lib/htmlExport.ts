import { saveFile, FILTERS } from './saveFile'

export type HtmlSection =
  | { kind: 'kpis'; items: { label: string; value: string; hint?: string }[] }
  | { kind: 'table'; title?: string; headers: string[]; rows: (string | number)[][]; highlight?: (row: (string | number)[], idx: number) => string | null }
  | { kind: 'text'; title?: string; paragraphs: string[] }
  | { kind: 'definition'; title?: string; items: { label: string; value: string }[] }
  | { kind: 'divider' }

export type HtmlReport = {
  filename: string
  title: string
  subtitle?: string
  eyebrow?: string
  sections: HtmlSection[]
}

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    background: #F8F7F3;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: #1A1A1A;
    line-height: 1.5;
  }
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 48px 56px;
    background: white;
    min-height: 100vh;
    box-shadow: 0 1px 3px rgba(10,31,61,0.06);
  }
  .hero {
    background: linear-gradient(135deg, #0A1F3D 0%, #142B5C 100%);
    color: white;
    padding: 40px 48px;
    margin: -48px -56px 32px;
    position: relative;
    overflow: hidden;
  }
  .hero::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, #C9A961 20%, #E5C875 50%, #C9A961 80%, transparent);
  }
  .hero .logo {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }
  .hero .logo-mark {
    width: 40px;
    height: 26px;
    background: #C9A961;
    clip-path: polygon(5% 100%, 95% 100%, 100% 0%, 0% 0%);
    position: relative;
  }
  .hero .logo-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .hero .logo-subtitle {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3em;
    color: #E5C875;
    font-weight: 600;
    margin-top: 2px;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-weight: 600;
    color: #E5C875;
  }
  .eyebrow::before {
    content: '';
    display: block;
    width: 32px;
    height: 1px;
    background: #E5C875;
  }
  h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 36px;
    font-weight: 600;
    margin: 0 0 8px;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }
  .subtitle { color: #BEC9DF; font-size: 14px; margin-top: 6px; }
  h2 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 20px;
    color: #0A1F3D;
    margin: 32px 0 8px;
    font-weight: 600;
  }
  h2::after {
    content: '';
    display: block;
    width: 40px;
    height: 2px;
    background: linear-gradient(90deg, #C9A961, transparent);
    margin-top: 6px;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin: 20px 0;
  }
  .kpi {
    background: #F8F7F3;
    border: 1px solid #E3E8F2;
    border-radius: 12px;
    padding: 16px 18px;
  }
  .kpi-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #4F6696;
    font-weight: 600;
  }
  .kpi-value {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 26px;
    color: #0A1F3D;
    font-weight: 600;
    margin-top: 6px;
    letter-spacing: -0.02em;
  }
  .kpi-hint { font-size: 11px; color: #8498BC; margin-top: 4px; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0 24px;
    font-size: 13px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(10,31,61,0.04);
  }
  thead tr {
    background: #0A1F3D;
    color: #C9A961;
  }
  thead th {
    padding: 12px 14px;
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    border-bottom: 2px solid #C9A961;
  }
  tbody td {
    padding: 10px 14px;
    border-bottom: 1px solid #F3F5FA;
    color: #1F2937;
  }
  tbody tr:nth-child(even) { background: #FAFBFD; }
  tbody tr:hover { background: #F6EED3; }
  .row-highlight-success { background: #D1FAE5 !important; }
  .row-highlight-warning { background: #FEF3C7 !important; }
  .row-highlight-danger { background: #FEE2E2 !important; }
  .row-highlight-gold { background: #F6EED3 !important; font-weight: 600; }
  .definition {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px 32px;
    padding: 16px 0;
  }
  .definition .item { }
  .definition .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #4F6696;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .definition .value { color: #0A1F3D; font-size: 14px; }
  .text p { color: #4B5563; margin: 8px 0; }
  hr.divider {
    border: none;
    height: 1px;
    background: linear-gradient(90deg, transparent, #BEC9DF 20%, #BEC9DF 80%, transparent);
    margin: 32px 0;
  }
  footer {
    margin-top: 56px;
    padding-top: 20px;
    border-top: 1px solid #E3E8F2;
    color: #8498BC;
    font-size: 11px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  @media print {
    body { background: white; }
    .page { box-shadow: none; padding: 32px; max-width: none; }
    .hero { margin: -32px -32px 24px; }
    thead { display: table-header-group; }
  }
`

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c])
}

function renderSection(s: HtmlSection): string {
  if (s.kind === 'kpis') {
    return `<div class="kpis">${s.items.map((k) => `
      <div class="kpi">
        <div class="kpi-label">${esc(k.label)}</div>
        <div class="kpi-value">${esc(k.value)}</div>
        ${k.hint ? `<div class="kpi-hint">${esc(k.hint)}</div>` : ''}
      </div>`).join('')}</div>`
  }
  if (s.kind === 'table') {
    return `
      ${s.title ? `<h2>${esc(s.title)}</h2>` : ''}
      <table>
        <thead><tr>${s.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${s.rows.map((r, i) => {
          const hl = s.highlight?.(r, i)
          const cls = hl ? ` class="row-highlight-${hl}"` : ''
          return `<tr${cls}>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`
        }).join('')}</tbody>
      </table>`
  }
  if (s.kind === 'definition') {
    return `
      ${s.title ? `<h2>${esc(s.title)}</h2>` : ''}
      <div class="definition">${s.items.map((it) => `
        <div class="item">
          <div class="label">${esc(it.label)}</div>
          <div class="value">${esc(it.value)}</div>
        </div>`).join('')}
      </div>`
  }
  if (s.kind === 'text') {
    return `
      ${s.title ? `<h2>${esc(s.title)}</h2>` : ''}
      <div class="text">${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}</div>`
  }
  if (s.kind === 'divider') {
    return `<hr class="divider" />`
  }
  return ''
}

export async function exportToHtml(report: HtmlReport): Promise<string | null> {
  const now = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(report.title)} — Extr&apos;Apol</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet" />
  <style>${STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="hero">
      <div class="logo">
        <div class="logo-mark"></div>
        <div>
          <div class="logo-name">Extr&apos;Apol</div>
          <div class="logo-subtitle">Groupe · Courtage</div>
        </div>
      </div>
      ${report.eyebrow ? `<div class="eyebrow">${esc(report.eyebrow)}</div>` : ''}
      <h1>${esc(report.title)}</h1>
      ${report.subtitle ? `<div class="subtitle">${esc(report.subtitle)}</div>` : ''}
    </div>

    ${report.sections.map(renderSection).join('\n')}

    <footer>
      <div>© ${new Date().getFullYear()} Groupe Apolline · ORIAS 22000000</div>
      <div>${esc(now)}</div>
    </footer>
  </div>
</body>
</html>`

  return saveFile({
    defaultFilename: report.filename,
    content: html,
    filters: [{ name: 'Document HTML', extensions: ['html', 'htm'] }],
    mimeType: 'text/html',
  })
}
