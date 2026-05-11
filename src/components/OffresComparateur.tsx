/**
 * OffresComparateur — compare les offres bancaires reçues sur un dossier.
 *
 * Une "offre" = l'ensemble des prêts d'une même banque sur le dossier.
 * Si la banque propose plusieurs prêts (ex: amortissable + lisseur + PTZ),
 * on les agrège pour un total comparable : montant emprunté, mensualité
 * totale, TAEG moyen pondéré, coût crédit, frais initiaux, etc.
 *
 * UI : tableau visuel side-by-side, surligne automatiquement la meilleure
 * offre par critère (mensualité la plus basse, TAEG le plus bas, coût total
 * le plus faible). Aide à présenter le devoir de conseil ACPR.
 */
import { useMemo } from 'react'
import { Trophy, Building2, AlertCircle, Award } from 'lucide-react'
import type { Pret } from '@/data/mock'
import { effectiveMensualite, calcTAEG, fraisInitiauxTAEG } from '@/lib/finance'
import { eur, pct, cn } from '@/lib/utils'

type Props = {
  prets: Pret[]
}

type OffreAgregee = {
  banque: string
  prets: Pret[]
  // Métriques agrégées
  totalMontant: number
  mensualiteTotaleHA: number
  mensualiteTotaleAvecAss: number
  fraisInitiauxTotal: number
  coutCreditTotal: number
  tauxMoyenPondere: number
  taegMoyenPondere: number
  dureeMaxMois: number
  // Caractéristiques
  hasPaliers: boolean
  hasPtz: boolean
  hasDifferé: boolean
  statutMixte: string  // ex: "Proposé · 1 accordé"
}

function aggregateByBanque(prets: Pret[]): OffreAgregee[] {
  const groups = new Map<string, Pret[]>()
  for (const p of prets) {
    const key = (p.banque ?? 'Sans banque').trim() || 'Sans banque'
    const list = groups.get(key) ?? []
    list.push(p)
    groups.set(key, list)
  }

  const result: OffreAgregee[] = []
  for (const [banque, list] of groups) {
    const totalMontant = list.reduce((s, p) => s + (p.montant ?? 0), 0)
    let mensHA = 0
    let mensAvec = 0
    let coutCredit = 0
    let fraisInit = 0
    let taegPondere = 0
    let tauxPondere = 0
    let dureeMax = 0
    for (const p of list) {
      const eff = effectiveMensualite(p)
      mensHA += eff.horsAssurance
      mensAvec += eff.totale
      const fi = fraisInitiauxTAEG(p)
      fraisInit += fi
      const totalPaye = eff.totale * p.dureeMois
      const interets = Math.max(0, totalPaye - p.montant)
      coutCredit += interets + fi
      const taeg = eff.horsAssurance > 0
        ? calcTAEG(p.montant, eff.horsAssurance, p.dureeMois, fi)
        : 0
      taegPondere += taeg * p.montant
      tauxPondere += (p.tauxNominal ?? 0) * p.montant
      if (p.dureeMois > dureeMax) dureeMax = p.dureeMois
    }
    const taegMoyenPondere = totalMontant > 0 ? taegPondere / totalMontant : 0
    const tauxMoyenPondere = totalMontant > 0 ? tauxPondere / totalMontant : 0

    const statuts = list.map((p) => p.statut)
    const statutMixte = statuts.length === 1
      ? statuts[0]!
      : `${statuts[0]} +${statuts.length - 1}`

    result.push({
      banque,
      prets: list,
      totalMontant,
      mensualiteTotaleHA: mensHA,
      mensualiteTotaleAvecAss: mensAvec,
      fraisInitiauxTotal: fraisInit,
      coutCreditTotal: coutCredit,
      tauxMoyenPondere,
      taegMoyenPondere,
      dureeMaxMois: dureeMax,
      hasPaliers: list.some((p) => p.paliers && p.paliers.length > 0),
      hasPtz: list.some((p) => p.type === 'ptz'),
      hasDifferé: list.some((p) => (p.differeTotal ?? 0) > 0),
      statutMixte,
    })
  }

  return result.sort((a, b) => a.banque.localeCompare(b.banque))
}

export default function OffresComparateur({ prets }: Props) {
  const offres = useMemo(() => aggregateByBanque(prets), [prets])

  // Pour highlight : on identifie le "winner" sur chaque métrique
  const winners = useMemo(() => {
    if (offres.length < 2) return null
    const minMens = Math.min(...offres.map((o) => o.mensualiteTotaleAvecAss))
    const minTAEG = Math.min(...offres.filter((o) => o.taegMoyenPondere > 0).map((o) => o.taegMoyenPondere))
    const minCout = Math.min(...offres.map((o) => o.coutCreditTotal))
    const minFrais = Math.min(...offres.map((o) => o.fraisInitiauxTotal))
    return { minMens, minTAEG, minCout, minFrais }
  }, [offres])

  if (offres.length === 0) {
    return null
  }
  if (offres.length === 1) {
    return (
      <div className="card p-4 border-l-4 border-navy-200">
        <div className="flex items-center gap-2 text-navy-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">
            Une seule banque dans le plan (<strong>{offres[0]!.banque}</strong>). Ajoute d'autres prêts depuis d'autres banques pour activer la comparaison.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-5 w-5 text-gold-700" />
        <h3 className="font-serif text-base font-semibold">Comparateur d'offres bancaires</h3>
        <span className="ml-auto text-xs text-navy-500">
          {offres.length} banque{offres.length > 1 ? 's' : ''} en lice
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="table-th text-left sticky left-0 bg-navy-50/50 z-10">Critère</th>
              {offres.map((o) => (
                <th key={o.banque} className="table-th text-center min-w-[180px]">
                  <div className="flex items-center justify-center gap-1.5 text-navy-900">
                    <Building2 className="h-3.5 w-3.5 text-gold-600" />
                    <span className="font-serif text-sm font-semibold normal-case tracking-normal">
                      {o.banque}
                    </span>
                  </div>
                  <div className="text-[10px] text-navy-500 font-normal mt-0.5">
                    {o.prets.length} prêt{o.prets.length > 1 ? 's' : ''} · {o.statutMixte}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-50">
            <Row label="Montant total emprunté">
              {offres.map((o) => (
                <Cell key={o.banque}>{eur(o.totalMontant)}</Cell>
              ))}
            </Row>
            <Row label="Mensualité (HA)">
              {offres.map((o) => (
                <Cell key={o.banque}>{eur(Math.round(o.mensualiteTotaleHA))}</Cell>
              ))}
            </Row>
            <Row label="Mensualité (avec assurance)" highlight>
              {offres.map((o) => {
                const isBest = !!(winners && o.mensualiteTotaleAvecAss === winners.minMens)
                return (
                  <Cell key={o.banque} isWinner={isBest}>
                    {eur(Math.round(o.mensualiteTotaleAvecAss))}/mois
                  </Cell>
                )
              })}
            </Row>
            <Row label="Taux nominal moyen">
              {offres.map((o) => (
                <Cell key={o.banque}>{pct(o.tauxMoyenPondere)}</Cell>
              ))}
            </Row>
            <Row label="TAEG moyen pondéré" highlight>
              {offres.map((o) => {
                const isBest = !!(winners && o.taegMoyenPondere > 0 && o.taegMoyenPondere === winners.minTAEG)
                return (
                  <Cell key={o.banque} isWinner={isBest}>
                    {o.taegMoyenPondere > 0 ? pct(o.taegMoyenPondere) : '—'}
                  </Cell>
                )
              })}
            </Row>
            <Row label="Frais initiaux (dossier+garantie)">
              {offres.map((o) => {
                const isBest = !!(winners && o.fraisInitiauxTotal === winners.minFrais && o.fraisInitiauxTotal > 0)
                return (
                  <Cell key={o.banque} isWinner={isBest}>
                    {eur(Math.round(o.fraisInitiauxTotal))}
                  </Cell>
                )
              })}
            </Row>
            <Row label="Coût crédit total" highlight>
              {offres.map((o) => {
                const isBest = !!(winners && o.coutCreditTotal === winners.minCout)
                return (
                  <Cell key={o.banque} isWinner={isBest}>
                    {eur(Math.round(o.coutCreditTotal))}
                  </Cell>
                )
              })}
            </Row>
            <Row label="Durée max">
              {offres.map((o) => (
                <Cell key={o.banque}>{(o.dureeMaxMois / 12).toFixed(0)} ans</Cell>
              ))}
            </Row>
            <Row label="Caractéristiques">
              {offres.map((o) => (
                <Cell key={o.banque}>
                  <div className="flex flex-wrap justify-center gap-1">
                    {o.hasPaliers && <span className="badge badge-gold text-[10px]">Lissage</span>}
                    {o.hasPtz && <span className="badge badge-navy text-[10px]">PTZ</span>}
                    {o.hasDifferé && <span className="badge badge-warning text-[10px]">Différé</span>}
                    {!o.hasPaliers && !o.hasPtz && !o.hasDifferé && (
                      <span className="text-xs text-navy-300">Standard</span>
                    )}
                  </div>
                </Cell>
              ))}
            </Row>
          </tbody>
        </table>
      </div>

      {/* Synthèse : meilleure offre globale */}
      {winners && offres.length >= 2 && (
        <div className="mt-4 p-3 rounded-lg bg-gold-50/40 border border-gold-200 text-xs">
          <div className="flex items-center gap-2 text-gold-800 font-semibold mb-1">
            <Award className="h-4 w-4" />
            Synthèse
          </div>
          <ul className="space-y-0.5 text-navy-700 ml-6 list-disc">
            <li>Meilleure mensualité : <strong>{offres.find((o) => o.mensualiteTotaleAvecAss === winners.minMens)?.banque}</strong> ({eur(Math.round(winners.minMens))}/mois)</li>
            <li>Meilleur TAEG : <strong>{offres.find((o) => o.taegMoyenPondere === winners.minTAEG)?.banque}</strong> ({pct(winners.minTAEG)})</li>
            <li>Coût crédit le plus bas : <strong>{offres.find((o) => o.coutCreditTotal === winners.minCout)?.banque}</strong> ({eur(Math.round(winners.minCout))})</li>
            <li>Frais initiaux les plus bas : <strong>{offres.find((o) => o.fraisInitiauxTotal === winners.minFrais)?.banque}</strong> ({eur(Math.round(winners.minFrais))})</li>
          </ul>
          <div className="mt-2 text-navy-600 italic">
            Penser à présenter cette comparaison au client (devoir de conseil ACPR).
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, highlight, children }: { label: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <tr className={cn(highlight && 'bg-gold-50/20')}>
      <td className={cn(
        'py-2.5 px-3 text-xs font-semibold text-navy-700 sticky left-0 z-10',
        highlight ? 'bg-gold-50/30' : 'bg-white',
      )}>
        {label}
      </td>
      {children}
    </tr>
  )
}

function Cell({ children, isWinner }: { children: React.ReactNode; isWinner?: boolean }) {
  return (
    <td className={cn(
      'py-2.5 px-3 text-center text-sm tabular-nums',
      isWinner ? 'font-bold text-gold-800 bg-gold-100/40 relative' : 'text-navy-800',
    )}>
      {isWinner && (
        <span className="absolute top-0.5 right-0.5 text-gold-600" title="Meilleure offre sur ce critère">
          <Trophy className="h-3 w-3" />
        </span>
      )}
      {children}
    </td>
  )
}
