import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { type Pret, pretCouleur, PRET_TYPE_LABEL } from '@/data/mock'

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
  height?: number
}

/**
 * Capital restant dû à la fin du mois t pour un prêt amortissable classique.
 * Formule : KRD(t) = M * ((1+i)^N - (1+i)^t) / ((1+i)^N - 1)
 * où i = taux périodique, N = durée totale, t = mois écoulés.
 *
 * Pour le PTZ avec différé total : 0 € de remboursement pendant la phase de
 * différé puis amortissement linéaire sur la durée restante.
 */
function krdAt(p: Pret, mois: number): number {
  if (mois <= 0) return p.montant
  if (mois >= p.dureeMois) return 0

  const taux = (p.tauxNominal ?? 0) / 100
  const i = taux / 12

  // Différé total : pendant le différé, KRD reste = montant
  const differeT = p.differeTotal ?? 0
  if (mois < differeT) return p.montant

  // Phase d'amortissement : durée effective = total - différé
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

  // Mensualité du mois courant — gère paliers (on regarde le mois - 1 pour
  // être cohérent avec l'index "fin de mois" utilisé partout)
  let mens: number
  if (p.paliers && p.paliers.length > 0) {
    let cumul = 0
    let found: number | null = null
    for (const palier of [...p.paliers].sort((a, b) => a.rang - b.rang)) {
      cumul += palier.nombreMois
      if (mois - differeT <= cumul) {
        found = palier.echeanceAvecAssurance ?? palier.echeanceHorsAssurance ?? 0
        break
      }
    }
    mens = found ?? 0
  } else {
    mens = p.mensualiteHorsAssurance ?? p.mensualiteTotale ?? 0
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
 * Mensualité du prêt à un instant t (utile pour les paliers).
 * Pour un prêt à mensualités constantes, retourne la mensualité totale cumulée.
 * Pour un prêt à paliers, retourne la mensualité du palier en cours.
 */
function mensualiteAt(p: Pret, mois: number): number {
  if (mois >= p.dureeMois) return 0

  // Différé total → 0 mensualité pendant le différé
  const differeT = p.differeTotal ?? 0
  if (mois < differeT) return 0

  // Si paliers définis, on suit les paliers
  if (p.paliers && p.paliers.length > 0) {
    let cumul = 0
    for (const palier of [...p.paliers].sort((a, b) => a.rang - b.rang)) {
      if (mois < cumul + palier.nombreMois) {
        return palier.echeanceAvecAssurance ?? palier.echeanceHorsAssurance ?? 0
      }
      cumul += palier.nombreMois
    }
    return 0
  }

  return p.mensualiteTotale ?? p.mensualiteHorsAssurance ?? 0
}

export default function PretsChart({ prets, mode = 'krd', height = 320 }: Props) {
  const sorted = useMemo(() => [...prets].sort((a, b) => a.rang - b.rang), [prets])

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

  if (mode === 'krd') {
    // AreaChart empilé pour visualiser la composition de la dette dans le temps
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="mois"
              tickFormatter={formatYears}
              tick={{ fontSize: 11, fill: '#64748B' }}
              label={{ value: 'Années', position: 'insideBottom', offset: -2, style: { fontSize: 10, fill: '#94A3B8' } }}
            />
            <YAxis
              tickFormatter={formatEuro}
              tick={{ fontSize: 11, fill: '#64748B' }}
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
    // Tableau d'amortissement visualisé : pour chaque mois, on empile la part
    // capital (en bas, navy) et la part intérêts (au-dessus, gold). La hauteur
    // totale = mensualité du mois. Au début, intérêts dominent ; en fin de
    // prêt, c'est l'inverse — c'est exactement la signature visuelle d'un
    // tableau d'amortissement classique.
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="mois"
              type="number"
              domain={[0, dureeMax]}
              tickFormatter={formatYears}
              tick={{ fontSize: 11, fill: '#64748B' }}
              label={{ value: 'Années', position: 'insideBottom', offset: -2, style: { fontSize: 10, fill: '#94A3B8' } }}
              ticks={Array.from({ length: Math.ceil(dureeMax / 12) + 1 }, (_, i) => i * 12).filter((m) => m <= dureeMax)}
            />
            <YAxis
              tickFormatter={formatEuro}
              tick={{ fontSize: 11, fill: '#64748B' }}
              label={{ value: 'Échéance / mois', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94A3B8' } }}
            />
            <Tooltip
              labelFormatter={(m) => `Mois ${m} (~${(m / 12).toFixed(1)} ans)`}
              formatter={(value: number, name: string) => {
                if (name === 'totalCapital') return [formatEuro(value), 'Part capital']
                if (name === 'totalInteret') return [formatEuro(value), 'Part intérêts']
                if (name === 'total') return [formatEuro(value), 'Échéance totale']
                return [formatEuro(value), name]
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
            />
            <Legend
              verticalAlign="top"
              height={32}
              iconType="square"
              payload={[
                { value: 'Part intérêts', type: 'square', color: '#C9A961' },
                { value: 'Part capital', type: 'square', color: '#0A1F3D' },
              ]}
            />
            {/* Intérêts en bas (gold) — dominent au début, diminuent dans le temps */}
            <Area
              type="monotone"
              dataKey="totalInteret"
              stackId="ech"
              stroke="#C9A961"
              fill="#C9A961"
              fillOpacity={0.85}
              strokeWidth={1}
              name="totalInteret"
            />
            {/* Capital au-dessus (navy plein) — croît à mesure que la dette se réduit */}
            <Area
              type="monotone"
              dataKey="totalCapital"
              stackId="ech"
              stroke="#0A1F3D"
              fill="#0A1F3D"
              fillOpacity={0.85}
              strokeWidth={1}
              name="totalCapital"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (mode === 'mensualites_stacked') {
    // AreaChart empilé pour visualiser le lissage : chaque prêt occupe une
    // bande de hauteur = sa mensualité du moment. Le sommet de la stack = la
    // mensualité totale (idéalement plate si plan lissé).
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="mois"
              type="number"
              domain={[0, dureeMax]}
              tickFormatter={formatYears}
              tick={{ fontSize: 11, fill: '#64748B' }}
              ticks={Array.from({ length: Math.ceil(dureeMax / 12) + 1 }, (_, i) => i * 12).filter((m) => m <= dureeMax)}
              label={{ value: 'Années', position: 'insideBottom', offset: -2, style: { fontSize: 10, fill: '#94A3B8' } }}
            />
            <YAxis
              tickFormatter={formatEuro}
              tick={{ fontSize: 11, fill: '#64748B' }}
              label={{ value: 'Échéance / mois', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94A3B8' } }}
            />
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
            <Legend
              verticalAlign="top"
              height={32}
              iconType="square"
              formatter={(value: string) => {
                if (value === 'total') return null  // on cache le "total" de la légende
                const id = value.replace('pret_', '')
                const p = sorted.find((x) => x.id === id)
                if (!p) return value
                return p.libelle ?? PRET_TYPE_LABEL[p.type]
              }}
            />
            {/* Stack par prêt — type "step" pour bien marquer les paliers */}
            {sorted.map((p) => (
              <Area
                key={p.id}
                type="stepAfter"
                dataKey={`pret_${p.id}`}
                stackId="mens"
                stroke={colorByPret[p.id]}
                fill={colorByPret[p.id]}
                fillOpacity={0.85}
                strokeWidth={1}
              />
            ))}
            {/* Ligne du total en pointillés gold pour bien voir si c'est plat */}
            <Line
              type="stepAfter"
              dataKey="total"
              stroke="#C9A961"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Mode mensualités → LineChart
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
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
          <Line type="stepAfter" dataKey="total" stroke="#0A1F3D" strokeWidth={2.5} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
