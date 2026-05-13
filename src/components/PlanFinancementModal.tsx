/**
 * PlanFinancementModal — modal full-screen "Construire le plan" (Cifacil-style).
 *
 * Permet de :
 *  - Voir tous les prêts du dossier en un coup d'œil
 *  - Lancer l'optimisation du lissage (algorithme calcule les paliers du prêt lisseur)
 *  - Visualiser la mensualité totale en barres empilées (idéalement plate après lissage)
 *  - Voir les KPIs (coût total, TAEG plan, reste à financer)
 *  - Régénérer le plan (reset des paliers)
 *  - Éditer manuellement chaque palier (V2 — pour l'instant: lecture seule)
 */
import { useMemo, useState, useRef, useEffect } from 'react'
import { X, Sparkles, RefreshCw, FileText, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Pret, Dossier } from '@/data/mock'
import { PRET_TYPE_LABEL } from '@/data/mock'
import { useStore } from '@/stores/useStore'
import {
  effectiveMensualite,
  calcTAEG,
  fraisInitiauxTAEG,
  findPretLisseur,
  optimiserLissage,
  mensualiteTotaleAt,
} from '@/lib/finance'
import PretsChart from './PretsChart'
import { cn } from '@/lib/utils'
import { confirmDialog } from '@/lib/dialog'

const eur = (n: number, dec = 0) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec })
const pct = (n: number, dec = 2) => `${n.toFixed(dec)} %`

type Props = {
  open: boolean
  onClose: () => void
  dossier: Dossier
  onAddPret?: () => void
  onEditPret?: (p: Pret) => void
}

export default function PlanFinancementModal({ open, onClose, dossier, onAddPret, onEditPret }: Props) {
  const allPrets = useStore((s) => s.prets)
  const updatePret = useStore((s) => s.updatePret)
  const deletePret = useStore((s) => s.deletePret)
  const [view, setView] = useState<'graphique' | 'mensualites' | 'amortissement'>('graphique')

  const prets = useMemo(
    () => allPrets.filter((p) => p.dossierId === dossier.id).sort((a, b) => a.rang - b.rang),
    [allPrets, dossier.id],
  )

  // KPIs ─────────────────────────────────────────────────
  const lisseur = useMemo(() => findPretLisseur(prets), [prets])
  const totalEmprunte = prets.reduce((s, p) => s + p.montant, 0)
  const apport = dossier.apport ?? 0
  const totalRessources = totalEmprunte + apport

  const projetHFN = (dossier.coutLogement ?? dossier.montantBien ?? 0)
    + (dossier.coutTerrain ?? 0)
    + (dossier.coutTravaux ?? 0)
    + (dossier.coutViabilisation ?? 0)
    + (dossier.coutMobilier ?? 0)
  const fraisNotaire = dossier.fraisNotaire ?? 0
  const fraisGarantie = prets.reduce((s, p) => s + (p.garantieMontant ?? 0), 0)
  const fraisDossier = prets.reduce((s, p) => s + (p.fraisDossier ?? 0), 0)
  const subventions = 0 // À étendre plus tard
  const totalProjet = projetHFN + fraisNotaire + fraisGarantie + fraisDossier - subventions
  const resteAFinancer = totalProjet - totalRessources

  // TAEG global du plan = moyenne pondérée par capital
  const taegPlan = useMemo(() => {
    if (prets.length === 0 || totalEmprunte === 0) return 0
    const sumWeighted = prets.reduce((s, p) => {
      const eff = effectiveMensualite(p)
      const fi = fraisInitiauxTAEG(p)
      const taeg = eff.horsAssurance > 0 ? calcTAEG(p.montant, eff.horsAssurance, p.dureeMois, fi) : 0
      return s + taeg * p.montant
    }, 0)
    return sumWeighted / totalEmprunte
  }, [prets, totalEmprunte])

  // Taux principal+autre = moyenne pondérée des taux nominaux (hors PTZ/AL)
  const tauxPpalAutre = useMemo(() => {
    const filtered = prets.filter((p) => p.type !== 'ptz' && p.type !== 'action_logement')
    const cap = filtered.reduce((s, p) => s + p.montant, 0)
    if (cap === 0) return 0
    return filtered.reduce((s, p) => s + (p.tauxNominal ?? 0) * p.montant, 0) / cap
  }, [prets])

  // Coût du crédit total (intérêts + frais)
  const coutCredit = useMemo(() => {
    return prets.reduce((s, p) => {
      const eff = effectiveMensualite(p)
      const total = eff.totale * p.dureeMois
      const interets = Math.max(0, total - p.montant)
      const frais = fraisInitiauxTAEG(p)
      return s + interets + frais
    }, 0)
  }, [prets])

  // Mensualité totale courante (mois 0) et après chaque cassure
  const mensCourante = useMemo(() => mensualiteTotaleAt(prets, 0), [prets])

  // Calcule l'écart entre mensualité totale min et max sur toute la durée — sert
  // à détecter si le lissage est effectif (écart faible) ou pas (gros saut).
  const dureeMaxPlan = useMemo(() => prets.reduce((m, p) => Math.max(m, p.dureeMois), 0), [prets])
  const lissageStats = useMemo(() => {
    if (dureeMaxPlan === 0) return null
    let min = Infinity
    let max = 0
    for (let m = 0; m <= dureeMaxPlan; m += 6) {
      const total = mensualiteTotaleAt(prets, m)
      if (total > 0) {
        if (total < min) min = total
        if (total > max) max = total
      }
    }
    if (min === Infinity) return null
    const ecart = max - min
    const ratio = max > 0 ? ecart / max : 0
    return { min: Math.round(min), max: Math.round(max), ecart: Math.round(ecart), ratio }
  }, [prets, dureeMaxPlan])

  // ─── Actions ────────────────────────────────────────────
  const onOptimiser = () => {
    if (!lisseur) {
      toast.error('Aucun prêt lisseur identifié', {
        description: 'Le lissage requiert au moins 2 prêts dont un amortissable de longue durée.',
      })
      return
    }
    const autres = prets.filter((p) => p.id !== lisseur.id)
    if (autres.length === 0) {
      toast.error('Aucun autre prêt à compenser')
      return
    }
    const result = optimiserLissage(lisseur, autres)
    if (!result) {
      toast.error('Lissage impossible avec les paramètres actuels')
      return
    }
    updatePret(lisseur.id, { paliers: result.paliers, profilAmortissement: 'paliers_lissage' })
    if (result.warning) {
      toast.warning('Lissage appliqué (avec avertissement)', { description: result.warning })
    } else {
      toast.success('Plan optimisé', {
        description: `Mensualité cible totale : ${eur(result.mensualiteCible)} • ${result.paliers.length} palier(s) sur "${lisseur.libelle ?? lisseur.type}"`,
      })
    }
  }

  const onRegenerer = async () => {
    if (!lisseur) return
    if (!await confirmDialog(`Réinitialiser les paliers du prêt "${lisseur.libelle ?? lisseur.type}" ?`, { title: 'Régénérer le plan', kind: 'warning' })) return
    updatePret(lisseur.id, { paliers: [], profilAmortissement: 'standard' })
    toast.success('Paliers réinitialisés')
  }

  const onDeletePret = async (p: Pret) => {
    if (!await confirmDialog(`Supprimer le prêt "${p.libelle ?? PRET_TYPE_LABEL[p.type]}" ?`, { title: 'Supprimer prêt', kind: 'warning' })) return
    deletePret(p.id)
    toast.success('Prêt supprimé')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in">
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full h-full flex flex-col bg-ivory animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center gap-3 px-6 py-3 border-b border-navy-100 bg-white shrink-0">
          <Pencil className="h-5 w-5 text-gold-700" />
          <h2 className="font-serif text-lg text-navy-900 flex-1">
            Construire le plan — Dossier <span className="font-mono text-sm">{dossier.ref}</span>
          </h2>
          <button onClick={onClose} className="btn-icon" title="Fermer (Échap)">
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Contenu : 2 colonnes (gauche = plan + graph, droite = KPIs).
            overflow-y-auto sur la grille → si le contenu dépasse, on scrolle
            la modale plutôt que d'écraser le graphique. */}
        <div className="flex-1 grid grid-cols-3 gap-4 overflow-y-auto p-4">
          {/* Colonne principale (2/3) */}
          <div className="col-span-2 flex flex-col gap-3">
            {/* Tableau des prêts — compact + scrollable si > 4 lignes */}
            <div className="card p-3 shrink-0">
              <div className="text-xs uppercase tracking-wider text-navy-500 font-semibold mb-2">Contenu du plan ({prets.length} prêt{prets.length > 1 ? 's' : ''})</div>
              <div className="rounded-lg border border-navy-100 overflow-hidden max-h-[180px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-navy-50 text-[11px] uppercase tracking-wider text-navy-600">
                      <th className="text-left px-3 py-2 font-semibold">Contenu du plan</th>
                      <th className="text-right px-3 py-2 font-semibold">Montant</th>
                      <th className="text-right px-3 py-2 font-semibold">Taux</th>
                      <th className="text-right px-3 py-2 font-semibold">Durée</th>
                      <th className="text-right px-3 py-2 font-semibold">Mensualité HA</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {prets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-navy-400 italic">
                          Aucun prêt. Cliquez sur « Ajouter un prêt » pour commencer.
                        </td>
                      </tr>
                    ) : (
                      prets.map((p) => {
                        const eff = effectiveMensualite(p)
                        const isLisseur = lisseur?.id === p.id
                        return (
                          <tr key={p.id} className="hover:bg-navy-50/40 group">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-navy-900">
                                  {p.libelle ?? PRET_TYPE_LABEL[p.type]}
                                </span>
                                {isLisseur && (
                                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold-100 text-gold-800 font-bold">
                                    Lisseur
                                  </span>
                                )}
                                {p.paliers && p.paliers.length > 0 && (
                                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                    {p.paliers.length} palier{p.paliers.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              {p.banque && <div className="text-[11px] text-navy-500">{p.banque}</div>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-navy-900">{eur(p.montant)}</td>
                            <td className="px-3 py-2 text-right font-mono text-navy-700">
                              {p.tauxNominal != null && p.tauxNominal > 0 ? pct(p.tauxNominal) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-navy-700">{p.dureeMois} mois</td>
                            <td className="px-3 py-2 text-right font-mono text-gold-700">{eur(eff.horsAssurance, 2)}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="inline-flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onEditPret?.(p)} className="btn-icon" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button>
                                <button onClick={() => onDeletePret(p)} className="btn-icon-danger" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={onAddPret} className="mt-2 text-sm text-gold-700 hover:text-gold-800 hover:underline flex items-center gap-1">
                <Plus className="h-4 w-4" /> Ajouter un prêt
              </button>

              {/* Détail des paliers du lisseur */}
              {lisseur && lisseur.paliers && lisseur.paliers.length > 0 && (
                <div className="mt-3 p-2.5 rounded-lg bg-gold-50/40 border border-gold-200">
                  <div className="text-[10px] uppercase tracking-wider text-gold-700 font-semibold mb-1.5">
                    Paliers du lisseur — {lisseur.libelle ?? PRET_TYPE_LABEL[lisseur.type]}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[...lisseur.paliers].sort((a, b) => a.rang - b.rang).map((pal, i) => {
                      const start = lisseur.paliers!.slice(0, i).reduce((s, p) => s + p.nombreMois, 0)
                      const end = start + pal.nombreMois
                      return (
                        <div key={pal.rang} className="rounded bg-white border border-gold-100 p-1.5">
                          <div className="text-[10px] text-navy-500 uppercase tracking-wider">Palier {pal.rang}</div>
                          <div className="font-mono text-navy-900 font-semibold">{eur(pal.echeanceHorsAssurance ?? 0, 2)}/mois</div>
                          <div className="text-[10px] text-navy-500">
                            mois {start + 1}–{end} ({(pal.nombreMois / 12).toFixed(1)} ans)
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Vue graphique / Mensualités / Amortissement (onglets).
                Hauteur explicite ~60% de la viewport, plancher 520 px : le
                chart est toujours assez grand pour être lu intégralement. */}
            <div className="card p-0 flex flex-col" style={{ height: 'max(520px, 60vh)' }}>
              <div className="border-b border-navy-100 bg-ivory/50 px-4 shrink-0">
                <div className="flex gap-1 -mb-px">
                  <TabButton active={view === 'graphique'} onClick={() => setView('graphique')}>Vue graphique</TabButton>
                  <TabButton active={view === 'mensualites'} onClick={() => setView('mensualites')}>Mensualités</TabButton>
                  <TabButton active={view === 'amortissement'} onClick={() => setView('amortissement')}>Amortissement</TabButton>
                </div>
              </div>
              {/* Bannière de diagnostic du lissage (uniquement pour vue graphique) */}
              {view === 'graphique' && lissageStats && prets.length >= 2 && (
                <div className={cn(
                  'px-3 py-2 text-xs border-b shrink-0 flex items-center gap-2',
                  lissageStats.ratio < 0.05
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900',
                )}>
                  {lissageStats.ratio < 0.05 ? (
                    <>
                      <span className="text-base">✓</span>
                      <span>
                        <strong>Plan lissé</strong> — mensualité totale stable autour de {eur(lissageStats.max)}/mois
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-base">⚠️</span>
                      <span className="flex-1">
                        <strong>Plan non lissé</strong> — mensualité totale varie de {eur(lissageStats.min)} à {eur(lissageStats.max)}
                        {' '}(écart {eur(lissageStats.ecart)}, soit {(lissageStats.ratio * 100).toFixed(0)}%)
                      </span>
                      <button onClick={onOptimiser} disabled={!lisseur} className="text-xs underline hover:text-amber-700 font-semibold">
                        Optimiser le plan →
                      </button>
                    </>
                  )}
                </div>
              )}
              {/* Slot mesuré explicitement en pixels (ResizeObserver) — Recharts
                  refuse de rendre quand height='100%' dans certains contextes flex */}
              <ChartSlot>
                {(h) => (
                  <div key={view} className="tab-content h-full">
                    {view === 'graphique' && <PretsChart prets={prets} mode="mensualites_stacked" height={h} />}
                    {view === 'mensualites' && <PretsChart prets={prets} mode="mensualites" height={h} />}
                    {view === 'amortissement' && <PretsChart prets={prets} mode="amortissement" height={h} />}
                  </div>
                )}
              </ChartSlot>
            </div>
          </div>

          {/* Colonne KPIs (1/3) — sticky en haut pendant le scroll de la modale */}
          <div className="col-span-1 flex flex-col gap-2 text-sm self-start sticky top-0">
            <KpiBlock title="Détail du projet" compact>
              <KpiRow label="Projet hors FN" value={eur(projetHFN)} />
              <KpiRow label="Frais de notaire" value={eur(fraisNotaire)} />
              <KpiRow label="Frais de garantie" value={eur(fraisGarantie)} />
              <KpiRow label="Frais de dossier" value={eur(fraisDossier)} />
              {subventions > 0 && <KpiRow label="Subvention(s)" value={eur(subventions)} muted />}
              <hr className="border-navy-100 my-1" />
              <KpiRow label="Apport" value={eur(apport)} accent="navy" />
              <KpiRow label="Total prêts" value={eur(totalEmprunte)} accent="navy" />
              <hr className="border-navy-100 my-1" />
              <KpiRow
                label="Reste à financer"
                value={eur(resteAFinancer)}
                accent={Math.abs(resteAFinancer) <= 1 ? 'emerald' : 'rose'}
                bold
              />
            </KpiBlock>

            <KpiBlock title="Indicateurs du plan" compact>
              <KpiRow label="Coût crédit" value={eur(Math.round(coutCredit))} />
              <KpiRow label="TAEG plan" value={pct(taegPlan)} accent="gold" bold />
              <KpiRow label="Taux PPal+autre" value={pct(tauxPpalAutre)} muted />
              <KpiRow label="Mens. totale" value={eur(Math.round(mensCourante))} accent="gold" bold />
            </KpiBlock>

            {!lisseur && prets.length >= 2 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-900">
                <strong>⚠️ Aucun lisseur.</strong> Ajoutez un prêt amortissable long ou marquez un prêt en « profil paliers_lissage ».
              </div>
            )}
            {lisseur && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-[11px] text-emerald-900">
                <strong>Lisseur :</strong> {lisseur.libelle ?? PRET_TYPE_LABEL[lisseur.type]}
                {lisseur.paliers && lisseur.paliers.length > 0
                  ? ` · ${lisseur.paliers.length} palier(s) ✓`
                  : ' · Non optimisé'}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <footer className="flex items-center gap-2 px-6 py-3 border-t border-navy-100 bg-white shrink-0">
          <button onClick={onOptimiser} className="btn-gold" disabled={!lisseur || prets.length < 2}>
            <Sparkles className="h-4 w-4" /> Optimiser le plan
          </button>
          <button onClick={onRegenerer} className="btn-outline" disabled={!lisseur || !lisseur.paliers || lisseur.paliers.length === 0}>
            <RefreshCw className="h-4 w-4" /> Régénérer
          </button>
          <button onClick={() => toast.info('Sortie client : à brancher avec le skill IA dossier-r1-etude-client', { description: 'Phase prochaine.' })} className="btn-outline">
            <FileText className="h-4 w-4" /> Sorties client
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="btn-ghost">Fermer</button>
        </footer>
      </div>
    </div>
  )
}

// ─── Composants utilitaires ──────────────────────────────────────────────────

/**
 * ChartSlot — wrapper qui mesure sa propre hauteur via ResizeObserver et passe
 * un nombre de pixels (jamais une string) à son enfant. Évite le bug Recharts
 * où ResponsiveContainer mesure son parent à 0 dans un layout flex pas encore
 * stabilisé. Tant que la mesure n'est pas faite, on garde une hauteur de
 * réserve (320 px) pour que le chart rende quand même quelque chose.
 */
function ChartSlot({ children }: { children: (h: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  // Initial = 460px : assez grand dès le 1er paint pour que le chart ait l'air
  // bien dimensionné avant que le ResizeObserver mesure le slot réel.
  const [h, setH] = useState(460)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      // contentRect.height = hauteur intérieure (sans padding) du slot.
      // Plancher 360 px pour garantir un graphique toujours lisible.
      const next = Math.max(360, Math.floor(entry.contentRect.height))
      setH((prev) => (Math.abs(prev - next) > 1 ? next : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} className="flex-1 p-3 min-h-0 overflow-hidden">
      {children(h)}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 text-sm font-medium border-b-2 transition',
        active ? 'border-gold-500 text-navy-900' : 'border-transparent text-navy-500 hover:text-navy-800',
      )}
    >
      {children}
    </button>
  )
}

function KpiBlock({ title, children, compact }: { title: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={cn('card', compact ? 'p-2.5' : 'p-4')}>
      <div className={cn('text-[10px] uppercase tracking-wider text-navy-500 font-semibold', compact ? 'mb-1.5' : 'mb-2')}>{title}</div>
      <div className={compact ? 'space-y-0.5' : 'space-y-1'}>{children}</div>
    </div>
  )
}

function KpiRow({ label, value, accent, bold, muted }: {
  label: string
  value: string
  accent?: 'navy' | 'gold' | 'emerald' | 'rose'
  bold?: boolean
  muted?: boolean
}) {
  const colorMap: Record<string, string> = {
    navy: 'text-navy-900',
    gold: 'text-gold-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  }
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className={cn('text-navy-600', muted && 'text-navy-400')}>{label}</span>
      <span className={cn(
        'font-mono tabular-nums text-[13px]',
        accent ? colorMap[accent] : 'text-navy-900',
        bold && 'font-bold',
        muted && 'text-navy-400',
      )}>
        {value}
      </span>
    </div>
  )
}
