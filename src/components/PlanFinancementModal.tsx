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
import { useMemo, useState } from 'react'
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

  const onRegenerer = () => {
    if (!lisseur) return
    if (!confirm(`Réinitialiser les paliers du prêt "${lisseur.libelle ?? lisseur.type}" ?`)) return
    updatePret(lisseur.id, { paliers: [], profilAmortissement: 'standard' })
    toast.success('Paliers réinitialisés')
  }

  const onDeletePret = (p: Pret) => {
    if (!confirm(`Supprimer le prêt "${p.libelle ?? PRET_TYPE_LABEL[p.type]}" ?`)) return
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

        {/* Contenu : 2 colonnes (gauche = plan + graph, droite = KPIs) */}
        <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden p-4">
          {/* Colonne principale (2/3) */}
          <div className="col-span-2 flex flex-col gap-3 overflow-hidden">
            {/* Tableau des prêts */}
            <div className="card p-4 shrink-0">
              <div className="text-xs uppercase tracking-wider text-navy-500 font-semibold mb-2">Contenu du plan ({prets.length} prêt{prets.length > 1 ? 's' : ''})</div>
              <div className="rounded-lg border border-navy-100 overflow-hidden">
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
            </div>

            {/* Vue graphique / Mensualités / Amortissement (onglets) */}
            <div className="card p-0 flex-1 flex flex-col overflow-hidden">
              <div className="border-b border-navy-100 bg-ivory/50 px-4 shrink-0">
                <div className="flex gap-1 -mb-px">
                  <TabButton active={view === 'graphique'} onClick={() => setView('graphique')}>Vue graphique</TabButton>
                  <TabButton active={view === 'mensualites'} onClick={() => setView('mensualites')}>Mensualités</TabButton>
                  <TabButton active={view === 'amortissement'} onClick={() => setView('amortissement')}>Amortissement</TabButton>
                </div>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                {view === 'graphique' && (
                  <PretsChart prets={prets} mode="mensualites_stacked" height={400} />
                )}
                {view === 'mensualites' && (
                  <PretsChart prets={prets} mode="mensualites" height={400} />
                )}
                {view === 'amortissement' && (
                  <PretsChart prets={prets} mode="amortissement" height={400} />
                )}
              </div>
            </div>
          </div>

          {/* Colonne KPIs (1/3) */}
          <div className="col-span-1 flex flex-col gap-3 overflow-y-auto">
            <KpiBlock title="Détail du projet">
              <KpiRow label="Projet hors FN" value={eur(projetHFN)} />
              <KpiRow label="Frais de notaire" value={eur(fraisNotaire)} />
              <KpiRow label="Frais de garantie" value={eur(fraisGarantie)} />
              <KpiRow label="Frais de dossier" value={eur(fraisDossier)} />
              <KpiRow label="Subvention(s)" value={eur(subventions)} muted />
              <hr className="border-navy-100 my-2" />
              <KpiRow label="Apport numéraire" value={eur(apport)} accent="navy" />
              <KpiRow label="Total des prêts" value={eur(totalEmprunte)} accent="navy" />
              <hr className="border-navy-100 my-2" />
              <KpiRow
                label="Reste à financer"
                value={eur(resteAFinancer)}
                accent={Math.abs(resteAFinancer) <= 1 ? 'emerald' : 'rose'}
                bold
              />
            </KpiBlock>

            <KpiBlock title="Indicateurs du plan">
              <KpiRow label="Coût du crédit" value={eur(Math.round(coutCredit))} />
              <KpiRow label="TAEG du plan" value={pct(taegPlan)} accent="gold" bold />
              <KpiRow label="Taux PPal+autre" value={pct(tauxPpalAutre)} muted />
              <KpiRow label="Mensualité totale" value={eur(Math.round(mensCourante))} accent="gold" bold />
            </KpiBlock>

            {!lisseur && prets.length >= 2 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                <strong>⚠️ Aucun prêt lisseur identifié.</strong> Ajoutez un prêt amortissable de longue durée ou marquez un prêt existant comme « profil paliers_lissage » pour activer l'optimisation.
              </div>
            )}
            {lisseur && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
                <strong>Prêt lisseur :</strong> {lisseur.libelle ?? PRET_TYPE_LABEL[lisseur.type]} ({lisseur.dureeMois} mois)
                {lisseur.paliers && lisseur.paliers.length > 0
                  ? ` · ${lisseur.paliers.length} palier(s) configuré(s)`
                  : ' · Pas encore optimisé'}
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

function KpiBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-navy-500 font-semibold mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
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
    <div className="flex items-baseline justify-between text-sm">
      <span className={cn('text-navy-600', muted && 'text-navy-400')}>{label}</span>
      <span className={cn(
        'font-mono tabular-nums',
        accent ? colorMap[accent] : 'text-navy-900',
        bold && 'font-bold',
        muted && 'text-navy-400',
      )}>
        {value}
      </span>
    </div>
  )
}
