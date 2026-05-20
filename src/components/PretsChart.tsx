import { useMemo, type CSSProperties } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts'
import { type Pret, pretCouleur, PRET_TYPE_LABEL } from '@/data/mock'
import { useChartTheme } from '@/theme/useChartTheme'

type Props = {
  prets: Pret[]
  /**
   * Mode visuel :
   *  - 'krd' : capital restant dû par prêt (areachart empilé qui descend vers 0)
   *  - 'mensualites' : mensualités par palier en lignes séparées (LineChart)
   *  - 'mensualites_stacked' : mensualités empilées (cible plate si lissage actif) — vue Cifacil-style
   *  - 'amortissement' : décomposition mensuelle capital/intérêts
   */
  mode?: 'krd' | 'mensualites' | 'mensualites_stacked' | 'amortissement'
  /** Hauteur du chart : nombre = px fixe, string = CSS (ex '100%' pour s'adapter au parent). */
  height?: number | string
}

/** Convertit un hex (#RRGGBB) en {r,g,b}. Retourne null si format invalide. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const c = hex.replace('#', '').trim()
  if (c.length !== 6) return null
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return { r, g, b }
}
const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

/** Assombrit une couleur hex en multipliant chaque canal par (1 - amount). */
function darken(hex: string, amount = 0.25): string {
  const c = hexToRgb(hex); if (!c) return hex
  return rgbToHex(c.r * (1 - amount), c.g * (1 - amount), c.b * (1 - amount))
}

/** Éclaircit une couleur hex en interpolant vers blanc. */
function lighten(hex: string, amount = 0.2): string {
  const c = hexToRgb(hex); if (!c) return hex
  return rgbToHex(c.r + (255 - c.r) * amount, c.g + (255 - c.g) * amount, c.b + (255 - c.b) * amount)
}

/**
 * Capital restant dû à la fin du mois t.
 *
 * Trois cas selon le profil du prêt :
 *
 *   1. PALIERS (lisseur) : récurrence segment par segment. La formule
 *      classique ne marche PAS car la mensualité change. On applique :
 *        KRD_n = KRD_0 * (1+i)^n - mens_palier * ((1+i)^n - 1) / i
 *      sur chaque palier successif.
 *
 *   2. PRÊT STANDARD à mensualités constantes :
 *        KRD(t) = M * ((1+i)^N - (1+i)^t) / ((1+i)^N - 1)
 *
 *   3. DIFFÉRÉ TOTAL (PTZ phase 1) : KRD inchangé pendant le différé,
 *      puis amortissement classique sur la durée restante.
 */
function krdAt(p: Pret, mois: number): number {
  if (mois <= 0) return p.montant
  if (mois >= p.dureeMois) return 0

  const taux = (p.tauxNominal ?? 0) / 100
  const i = taux / 12

  // Différé total : pendant le différé, KRD reste = montant
  const differeT = p.differeTotal ?? 0
  if (mois < differeT) return p.montant

  // ─── CAS PALIERS (lisseur) ───────────────────────────────────────────
  // La mensualité change à chaque palier → on intègre par récurrence
  // segment par segment. Cf. formule de récurrence sur capital remboursé :
  //   KRD_{après n mens} = KRD * (1+i)^n - M * [(1+i)^n - 1] / i
  if (p.paliers && p.paliers.length > 0) {
    const sortedPaliers = [...p.paliers].sort((a, b) => a.rang - b.rang)
    let krd = p.montant
    let cur = differeT  // début de la phase d'amortissement
    for (const palier of sortedPaliers) {
      if (mois <= cur) break
      const segEnd = cur + palier.nombreMois
      const monthsInSeg = Math.min(mois, segEnd) - cur
      // Mensualité d'amortissement = uniquement la part hors assurance
      // (l'assurance n'amortit pas le capital).
      const mens = palier.echeanceHorsAssurance ?? 0
      if (i === 0) {
        krd = krd - mens * monthsInSeg
      } else {
        const pow = Math.pow(1 + i, monthsInSeg)
        krd = krd * pow - mens * (pow - 1) / i
      }
      cur = segEnd
      if (mois <= cur) break
    }
    return Math.max(0, krd)
  }

  // ─── CAS STANDARD : annuités constantes ──────────────────────────────
  const moisAmort = p.dureeMois - differeT
  const t = mois - differeT

  if (i === 0) {
    // Taux 0 (PTZ) → linéaire
    return Math.max(0, p.montant * (1 - t / moisAmort))
  }

  const factor = Math.pow(1 + i, moisAmort)
  return Math.max(0, p.montant * (factor - Math.pow(1 + i, t)) / (factor - 1))
}

/**
 * Décomposition mensuelle : pour le mois `mois` (1..N), retourne la part
 * d'intérêts et la part de capital dans l'échéance versée.
 *
 * Logique amortissement :
 *   intérêts du mois = i × KRD(mois - 1)
 *   capital du mois  = mensualité - intérêts du mois
 *
 * Pendant un différé total (ex. PTZ) : 0 sur les deux composantes.
 * Pour les paliers : la mensualité utilisée est celle du palier en cours.
 */
function decomposeMois(p: Pret, mois: number): { interet: number; capital: number } {
  if (mois <= 0 || mois > p.dureeMois) return { interet: 0, capital: 0 }

  const differeT = p.differeTotal ?? 0
  if (mois <= differeT) return { interet: 0, capital: 0 }

  const taux = (p.tauxNominal ?? 0) / 100
  const i = taux / 12
  const krdAvant = krdAt(p, mois - 1)
  const interet = krdAvant * i

  // Mensualité du mois courant — gère paliers. CRUCIAL : on utilise
  // UNIQUEMENT echeanceHorsAssurance (pas avec assurance) car l'assurance
  // n'amortit pas le capital (c'est un service séparé).
  let mens: number
  if (p.paliers && p.paliers.length > 0) {
    let cumul = 0
    let found: number | null = null
    for (const palier of [...p.paliers].sort((a, b) => a.rang - b.rang)) {
      cumul += palier.nombreMois
      if (mois - differeT <= cumul) {
        found = palier.echeanceHorsAssurance ?? 0
        break
      }
    }
    mens = found ?? 0
  } else {
    // Pour décomposition capital/intérêts, on prend explicitement HA (jamais totale)
    mens = p.mensualiteHorsAssurance ?? 0
    // Si pas stocké, on calculera à la volée plus bas via le bloc fallback
  }

  // Si la mensualité n'est pas renseignée mais qu'on a tout ce qu'il faut,
  // on la calcule à la volée (annuités constantes).
  if (mens === 0 && i > 0 && p.dureeMois > 0) {
    const moisAmort = Math.max(1, p.dureeMois - differeT)
    mens = (p.montant * i) / (1 - Math.pow(1 + i, -moisAmort))
  } else if (mens === 0 && i === 0 && p.dureeMois > 0) {
    mens = p.montant / Math.max(1, p.dureeMois - differeT)
  }

  const capital = Math.max(0, mens - interet)
  return { interet: Math.max(0, interet), capital }
}

/**
 * Mensualité du prêt à un instant t (en HORS ASSURANCE).
 * Pour un prêt à mensualités constantes, retourne la mensualité fixe HA.
 * Pour un prêt à paliers, retourne la mensualité HA du palier en cours.
 *
 * ⚠ On reste TOUJOURS en hors assurance pour rester cohérent avec
 *   `optimiserLissage` (qui calcule la cible en HA) et avec le KRD calculé
 *   par `krdAt` (qui amortit avec la mens HA).
 */
function mensualiteAt(p: Pret, mois: number): number {
  if (mois >= p.dureeMois) return 0

  // Différé total → 0 mensualité pendant le différé
  const differeT = p.differeTotal ?? 0
  if (mois < differeT) return 0

  // Si paliers définis, on suit les paliers (HA uniquement)
  if (p.paliers && p.paliers.length > 0) {
    let cumul = 0
    for (const palier of [...p.paliers].sort((a, b) => a.rang - b.rang)) {
      if (mois < cumul + palier.nombreMois) {
        return palier.echeanceHorsAssurance ?? 0
      }
      cumul += palier.nombreMois
    }
    return 0
  }

  // Mensualité fixe HA (jamais totale qui inclurait l'assurance)
  return p.mensualiteHorsAssurance ?? 0
}

export default function PretsChart({ prets, mode = 'krd', height = 320 }: Props) {
  const sorted = useMemo(() => [...prets].sort((a, b) => a.rang - b.rang), [prets])
  // Palette des axes/grid/tooltip suit le thème (Apolline/Graphite/Sombre).
  // Les couleurs PAR PRÊT (colorByPret via pretCouleur) restent inchangées —
  // c'est l'identité visuelle de chaque prêt à travers l'app.
  const chart = useChartTheme()

  // Échantillonnage : 1 point par mois pour une durée < 24 mois, sinon par trimestre
  const dureeMax = useMemo(() => sorted.reduce((m, p) => Math.max(m, p.dureeMois), 0), [sorted])
  const step = dureeMax > 60 ? 3 : 1
  const data = useMemo(() => {
    const out: Array<Record<string, number>> = []
    // On itère de 0 à dureeMax. Pour le mois 0 en mode amortissement, on
    // utilise les valeurs du mois 1 (1ère échéance réelle) pour éviter le
    // "creux à zéro" visuel sur l'AreaChart.
    for (let m = 0; m <= dureeMax; m += step) {
      const point: Record<string, number> = { mois: m }
      // Mois utilisé pour le calcul : en amortissement on remplace 0 par 1
      // pour démarrer la courbe direct sur la 1ère échéance réelle.
      const mForCalc = mode === 'amortissement' && m === 0 ? 1 : m
      for (const p of sorted) {
        if (mode === 'krd') {
          point[`pret_${p.id}`] = Math.round(krdAt(p, m))
        } else if (mode === 'mensualites' || mode === 'mensualites_stacked') {
          point[`pret_${p.id}`] = Math.round(mensualiteAt(p, m))
        } else {
          const { capital, interet } = decomposeMois(p, mForCalc)
          point[`capital_${p.id}`] = Math.round(capital)
          point[`interet_${p.id}`] = Math.round(interet)
        }
      }
      if (mode === 'amortissement') {
        point.totalCapital = sorted.reduce((s, p) => s + (point[`capital_${p.id}`] ?? 0), 0)
        point.totalInteret = sorted.reduce((s, p) => s + (point[`interet_${p.id}`] ?? 0), 0)
        point.total = point.totalCapital + point.totalInteret
      } else {
        point.total = sorted.reduce((s, p) => s + (point[`pret_${p.id}`] ?? 0), 0)
      }
      out.push(point)
    }
    // Garde-fou : si dureeMax ne tombe pas pile sur un multiple de step
    // (ex. 240 avec step=3 → dernier loop à 240 OK, mais 241 raterait), on
    // s'assure que la dernière échéance EST bien dans le dataset.
    const lastPoint = out[out.length - 1]
    if (lastPoint && lastPoint.mois !== dureeMax && dureeMax > 0) {
      const point: Record<string, number> = { mois: dureeMax }
      for (const p of sorted) {
        if (mode === 'krd') {
          point[`pret_${p.id}`] = Math.round(krdAt(p, dureeMax))
        } else if (mode === 'mensualites') {
          point[`pret_${p.id}`] = Math.round(mensualiteAt(p, dureeMax))
        } else {
          const { capital, interet } = decomposeMois(p, dureeMax)
          point[`capital_${p.id}`] = Math.round(capital)
          point[`interet_${p.id}`] = Math.round(interet)
        }
      }
      if (mode === 'amortissement') {
        point.totalCapital = sorted.reduce((s, p) => s + (point[`capital_${p.id}`] ?? 0), 0)
        point.totalInteret = sorted.reduce((s, p) => s + (point[`interet_${p.id}`] ?? 0), 0)
        point.total = point.totalCapital + point.totalInteret
      } else {
        point.total = sorted.reduce((s, p) => s + (point[`pret_${p.id}`] ?? 0), 0)
      }
      out.push(point)
    }
    return out
  }, [sorted, dureeMax, step, mode])

  if (sorted.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-navy-400 italic border border-navy-100 rounded-lg bg-ivory/40">
        Ajoutez un prêt pour voir le graphique
      </div>
    )
  }

  const formatYears = (m: number) => `${(m / 12).toFixed(0)}a`
  const formatEuro = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} M€`
    : n >= 1_000 ? `${Math.round(n / 1_000)} k€`
    : `${Math.round(n)} €`

  // Couleurs
  const colorByPret: Record<string, string> = {}
  for (const p of sorted) {
    colorByPret[p.id] = pretCouleur(p)
  }

  const isPercentH = typeof height === 'string' && height.includes('%')
  const wrapperStyle: CSSProperties = { width: '100%', height, minHeight: 240 }
  if (isPercentH) wrapperStyle.position = 'relative'

  if (mode === 'krd') {
    // AreaChart empilé pour visualiser la composition de la dette dans le temps
    return (
      <div style={wrapperStyle}>
        <ResponsiveContainer width="100%" height="100%" debounce={1}>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
            <XAxis
              dataKey="mois"
              tickFormatter={formatYears}
              tick={{ fontSize: 11, fill: chart.text }}
              label={{ value: 'Années', position: 'insideBottom', offset: -2, style: { fontSize: 10, fill: chart.text } }}
            />
            <YAxis
              tickFormatter={formatEuro}
              tick={{ fontSize: 11, fill: chart.text }}
            />
            <Tooltip
              labelFormatter={(m) => `Mois ${m} (~${(m / 12).toFixed(1)} ans)`}
              formatter={(value: number, name: string) => {
                if (name === 'total') return [formatEuro(value), 'Total restant dû']
                const id = name.replace('pret_', '')
                const p = sorted.find((x) => x.id === id)
                if (!p) return [formatEuro(value), name]
                const label = p.libelle ?? PRET_TYPE_LABEL[p.type]
                return [formatEuro(value), label]
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
            />
            <Legend
              verticalAlign="top"
              height={32}
              iconType="circle"
              formatter={(value: string) => {
                const id = value.replace('pret_', '')
                const p = sorted.find((x) => x.id === id)
                if (!p) return value
                return p.libelle ?? PRET_TYPE_LABEL[p.type]
              }}
            />
            {sorted.map((p) => (
              <Area
                key={p.id}
                type="monotone"
                dataKey={`pret_${p.id}`}
                stackId="krd"
                stroke={colorByPret[p.id]}
                fill={colorByPret[p.id]}
                fillOpacity={0.55}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (mode === 'amortissement') {
    // Tableau d'amortissement visualisé du foyer : pour chaque mois, on empile
    // la part capital de CHAQUE prêt (une couleur par prêt, comme dans la vue
    // KRD) + une couche d'intérêts agrégés au sommet en gold. Hauteur totale =
    // mensualité totale du mois. Au début, intérêts dominent ; en fin de plan,
    // c'est le capital qui domine — signature visuelle d'un tableau classique.
    return (
      <div style={wrapperStyle}>
        <ResponsiveContainer width="100%" height="100%" debounce={1}>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <defs>
              {/* Gradient gold pour les intérêts (visuellement distinct des capitaux) */}
              <linearGradient id="amortInteretGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E5C77B" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#A4823F" stopOpacity={0.95} />
              </linearGradient>
              {/* Un gradient par prêt — clair en haut, sombre en bas */}
              {sorted.map((p) => {
                const c = colorByPret[p.id]
                return (
                  <linearGradient key={p.id} id={`amortCapGrad_${p.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lighten(c, 0.12)} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={darken(c, 0.18)} stopOpacity={1} />
                  </linearGradient>
                )
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
            <XAxis
              dataKey="mois"
              type="number"
              domain={[0, dureeMax]}
              tickFormatter={formatYears}
              tick={{ fontSize: 11, fill: chart.text }}
              label={{ value: 'Années', position: 'insideBottom', offset: -2, style: { fontSize: 10, fill: chart.text } }}
              ticks={Array.from({ length: Math.ceil(dureeMax / 12) + 1 }, (_, i) => i * 12).filter((m) => m <= dureeMax)}
            />
            <YAxis
              tickFormatter={formatEuro}
              tick={{ fontSize: 11, fill: chart.text }}
              label={{ value: 'Échéance / mois', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: chart.text } }}
            />
            <Tooltip
              labelFormatter={(m) => `Mois ${m} (~${(m / 12).toFixed(1)} ans)`}
              formatter={(value: number, name: string) => {
                if (name === 'totalInteret') return [formatEuro(value), 'Intérêts (tous prêts)']
                if (name === 'total') return [formatEuro(value), 'Échéance totale']
                if (name.startsWith('capital_')) {
                  const id = name.replace('capital_', '')
                  const p = sorted.find((x) => x.id === id)
                  if (p) return [formatEuro(value), `Capital ${p.libelle ?? PRET_TYPE_LABEL[p.type]}`]
                }
                return [formatEuro(value), name]
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
            />
            <Legend
              verticalAlign="top"
              height={32}
              iconType="square"
              payload={[
                ...sorted.map((p) => ({
                  value: `Capital ${p.libelle ?? PRET_TYPE_LABEL[p.type]}`,
                  type: 'square' as const,
                  color: colorByPret[p.id] ?? chart.primary,
                })),
                { value: 'Intérêts', type: 'square' as const, color: chart.secondary },
              ]}
            />
            {/* Capital par prêt — un Area stacké par prêt (couleur prêt) */}
            {sorted.map((p) => (
              <Area
                key={p.id}
                type="monotone"
                dataKey={`capital_${p.id}`}
                stackId="ech"
                stroke={darken(colorByPret[p.id] ?? chart.primary, 0.25)}
                fill={`url(#amortCapGrad_${p.id})`}
                fillOpacity={1}
                strokeWidth={1}
                name={`capital_${p.id}`}
              />
            ))}
            {/* Intérêts agrégés au sommet (gold) — dominent au début, fondent ensuite */}
            <Area
              type="monotone"
              dataKey="totalInteret"
              stackId="ech"
              stroke={chart.series[3]}
              fill="url(#amortInteretGrad)"
              fillOpacity={1}
              strokeWidth={1}
              name="totalInteret"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (mode === 'mensualites_stacked') {
    // ─────────────────────────────────────────────────────────────────────
    // Vue plan de financement : chaque prêt occupe une bande de hauteur =
    // sa mensualité du moment. Sommet de la stack = mensualité totale du
    // foyer. Plan lissé ⇒ sommet plat.
    //
    // Traitement visuel premium :
    //  • Gradients verticaux par prêt (clair en haut, foncé en bas) → profondeur
    //  • Stroke = teinte foncée de la couleur du prêt → contour cohérent
    //  • Fond panel ivoire dégradé (de blanc à gris très clair)
    //  • Glyph dot subtil au niveau de la cible si plan lissé
    //  • Tooltip premium avec accent gold + total mis en avant
    //  • Reference line gold pointillée au niveau de la mensualité cible
    //  • Ombre portée discrète sous la stack (filter SVG)
    // ─────────────────────────────────────────────────────────────────────
    const totals = data.map((d) => Number(d.total) || 0).filter((t) => t > 0)
    const maxTotal = totals.length ? Math.max(...totals) : 0
    const minTotal = totals.length ? Math.min(...totals) : 0
    const cible = totals.length ? totals.reduce((s, v) => s + v, 0) / totals.length : 0
    const isLisse = totals.length > 0 && (maxTotal - minTotal) / Math.max(1, maxTotal) < 0.05

    // Snap Y au pas adapté
    const ySnap = maxTotal > 4000 ? 500 : maxTotal > 1500 ? 250 : 100
    const yMax = maxTotal > 0
      ? Math.ceil((maxTotal * 1.12) / ySnap) * ySnap
      : 1000

    const yTicks: number[] = []
    for (let v = 0; v <= yMax; v += ySnap) yTicks.push(v)

    const dureeYears = Math.ceil(dureeMax / 12)
    const xStep = dureeYears > 20 ? 2 : 1
    const xTicks: number[] = []
    for (let y = 0; y <= dureeYears; y += xStep) xTicks.push(y * 12)
    if (xTicks[xTicks.length - 1] !== dureeMax) xTicks.push(dureeMax)

    const formatYearsClean = (m: number) => `${Math.round(m / 12)}`

    return (
      <div style={{ ...wrapperStyle, minHeight: 280 }}>
        <ResponsiveContainer width="100%" height="100%" debounce={1}>
          <AreaChart
            data={data}
            margin={{ top: 16, right: 28, left: 8, bottom: 28 }}
          >
            <defs>
              {/* Fond du panel : dégradé blanc cassé → bleuté très clair */}
              <linearGradient id="panelBg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#EEF2F7" />
              </linearGradient>
              {/* Un gradient par prêt — clair en haut, sombre en bas */}
              {sorted.map((p) => {
                const c = colorByPret[p.id]
                return (
                  <linearGradient key={p.id} id={`pretGrad_${p.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lighten(c, 0.12)} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={darken(c, 0.18)} stopOpacity={1} />
                  </linearGradient>
                )
              })}
            </defs>

            {/* Panel de fond + grille */}
            <CartesianGrid
              strokeDasharray="2 4"
              stroke={chart.grid}
              fill="url(#panelBg)"
              fillOpacity={1}
              vertical
              horizontal
            />

            <XAxis
              dataKey="mois"
              type="number"
              domain={[0, dureeMax]}
              ticks={xTicks}
              tickFormatter={formatYearsClean}
              tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }}
              axisLine={{ stroke: '#64748B', strokeWidth: 1 }}
              tickLine={{ stroke: chart.text }}
              label={{
                value: 'Années',
                position: 'insideBottom',
                offset: -10,
                style: { fontSize: 11, fill: '#475569', fontWeight: 600, letterSpacing: '0.05em' },
              }}
            />
            <YAxis
              domain={[0, yMax]}
              ticks={yTicks}
              tickFormatter={(v) => `${Math.round(v).toLocaleString('fr-FR')} €`}
              tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }}
              axisLine={{ stroke: '#64748B', strokeWidth: 1 }}
              tickLine={{ stroke: chart.text }}
              width={72}
            />

            {/* Reference line à la mensualité cible (moyenne sur la durée).
                Label en insideTopRight = toujours visible dans la zone du chart,
                jamais coupé par la marge droite. */}
            {cible > 0 && (
              <ReferenceLine
                y={Math.round(cible)}
                stroke={chart.secondary}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Cible ${formatEuro(Math.round(cible))}`,
                  position: 'insideTopRight',
                  fill: chart.secondary,
                  fontSize: 10,
                  fontWeight: 700,
                  offset: 6,
                }}
                ifOverflow="extendDomain"
              />
            )}

            <Tooltip
              content={<StackedTooltip prets={sorted} colorByPret={colorByPret} formatEuro={formatEuro} />}
              cursor={{ fill: 'rgba(201,169,97,0.10)' }}
            />

            {/* Stack par prêt — bandes en gradient avec contour foncé cohérent */}
            {sorted.map((p) => (
              <Area
                key={p.id}
                type="stepAfter"
                dataKey={`pret_${p.id}`}
                stackId="mens"
                stroke={darken(colorByPret[p.id], 0.35)}
                strokeWidth={1.25}
                strokeLinejoin="round"
                fill={`url(#pretGrad_${p.id})`}
                fillOpacity={1}
                isAnimationActive={false}
              />
            ))}

            {/* Si lissé : trait fin gold sur le sommet pour souligner la stabilité */}
            {isLisse && (
              <Line
                type="stepAfter"
                dataKey="total"
                stroke={chart.secondary}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Mode mensualités → LineChart
  return (
    <div style={wrapperStyle}>
      <ResponsiveContainer width="100%" height="100%" debounce={1}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="mois" tickFormatter={formatYears} tick={{ fontSize: 11, fill: '#64748B' }} />
          <YAxis tickFormatter={formatEuro} tick={{ fontSize: 11, fill: '#64748B' }} />
          <Tooltip
            labelFormatter={(m) => `Mois ${m} (~${(m / 12).toFixed(1)} ans)`}
            formatter={(value: number, name: string) => {
              if (name === 'total') return [formatEuro(value), 'Mensualité totale']
              const id = name.replace('pret_', '')
              const p = sorted.find((x) => x.id === id)
              if (!p) return [formatEuro(value), name]
              return [formatEuro(value), p.libelle ?? PRET_TYPE_LABEL[p.type]]
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
          />
          <Legend verticalAlign="top" height={32} iconType="circle"
            formatter={(value: string) => {
              if (value === 'total') return 'Total'
              const id = value.replace('pret_', '')
              const p = sorted.find((x) => x.id === id)
              return p ? (p.libelle ?? PRET_TYPE_LABEL[p.type]) : value
            }}
          />
          {sorted.map((p) => (
            <Line
              key={p.id}
              type="stepAfter"
              dataKey={`pret_${p.id}`}
              stroke={colorByPret[p.id]}
              strokeWidth={2}
              dot={false}
            />
          ))}
          <Line type="stepAfter" dataKey="total" stroke={chart.primary} strokeWidth={2.5} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Tooltip premium pour le mode mensualites_stacked ───────────────────────
type StackedTooltipProps = {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; payload?: Record<string, number> }>
  label?: number
  prets: Pret[]
  colorByPret: Record<string, string>
  formatEuro: (n: number) => string
}

function StackedTooltip({ active, payload, label, prets, colorByPret, formatEuro }: StackedTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const mois = typeof label === 'number' ? label : 0
  const annees = (mois / 12).toFixed(1)
  const total = payload.reduce((s, item) => s + (Number(item.value) || 0), 0)

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFBFC 100%)',
        border: '1px solid #CBD5E1',
        borderRadius: 8,
        boxShadow: '0 6px 24px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.06)',
        padding: '10px 12px',
        fontSize: 12,
        fontFamily: 'inherit',
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Mois {mois} · {annees} ans
      </div>
      {/* Total mis en avant en haut */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '6px 0', borderBottom: '1px dashed #CBD5E1', marginBottom: 6,
      }}>
        <span style={{ fontWeight: 700, color: '#0A1F3D' }}>Mensualité totale</span>
        <span style={{ fontWeight: 800, fontSize: 14, color: '#92704A', fontVariantNumeric: 'tabular-nums' }}>
          {formatEuro(total)}
        </span>
      </div>
      {/* Détail par prêt (filtré pour les prêts qui contribuent à ce mois) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {payload.map((item) => {
          const value = Number(item.value) || 0
          if (value <= 0) return null
          const id = (item.name ?? '').replace('pret_', '')
          const p = prets.find((x) => x.id === id)
          if (!p) return null
          const color = colorByPret[id] ?? '#0A1F3D'
          return (
            <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#475569' }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                  background: color, boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.15)',
                }} />
                {p.libelle ?? PRET_TYPE_LABEL[p.type]}
              </span>
              <span style={{ fontWeight: 600, color: '#0A1F3D', fontVariantNumeric: 'tabular-nums' }}>
                {formatEuro(value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
