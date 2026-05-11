/**
 * AuditDossierModal — affichage du rapport d'audit IA d'un dossier.
 *
 * Sections affichées :
 *   1. Synthèse (verdict + score global + phrase courte)
 *   2. Points forts / Points faibles (cartes colorées)
 *   3. HCSF (gauge endettement + alertes)
 *   4. Cohérence des données (alertes si détectées)
 *   5. Banques recommandées / à éviter (ranking par score)
 *   6. Suggestion DDP (corps pré-rédigé, copiable)
 *
 * UX : tout dans un FullScreenSheet, sections empilées verticalement avec
 * indicateurs visuels par couleur (vert / gold / rose) pour focaliser
 * l'attention du courtier sur ce qui demande sa vigilance.
 */
import { useState } from 'react'
import {
  Sparkles, CheckCircle2, AlertTriangle, XCircle, Copy, Check, ShieldCheck,
  TrendingUp, Building2, AlertCircle, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import FullScreenSheet from './FullScreenSheet'
import type { AuditDossierResult } from '@/db/api'
import { cn, eur } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  audit: AuditDossierResult | null
  loading: boolean
  dossierRef: string
  /** Coût estimé en € (affiché en footer pour transparence) */
  estimatedCostEur?: number
}

const VERDICT_LABEL: Record<AuditDossierResult['synthese']['verdict'], string> = {
  tres_favorable: 'Très favorable',
  favorable: 'Favorable',
  mitige: 'Mitigé',
  defavorable: 'Défavorable',
  tres_defavorable: 'Très défavorable',
}

const VERDICT_COLOR: Record<AuditDossierResult['synthese']['verdict'], string> = {
  tres_favorable: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  favorable: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  mitige: 'bg-gold-50 text-gold-700 border-gold-200',
  defavorable: 'bg-rose-50 text-rose-700 border-rose-200',
  tres_defavorable: 'bg-rose-100 text-rose-800 border-rose-300',
}

const GRAVITE_COLOR = {
  haute: 'border-rose-300 bg-rose-50/40',
  moyenne: 'border-gold-300 bg-gold-50/40',
  basse: 'border-navy-200 bg-navy-50/40',
} as const

export default function AuditDossierModal({ open, onClose, audit, loading, dossierRef, estimatedCostEur }: Props) {
  const [ddpCopied, setDdpCopied] = useState(false)

  const onCopyDDP = async () => {
    if (!audit) return
    try {
      await navigator.clipboard.writeText(audit.suggestion_ddp.corps)
      setDdpCopied(true)
      toast.success('Suggestion DDP copiée dans le presse-papier')
      setTimeout(() => setDdpCopied(false), 2500)
    } catch {
      toast.error('Impossible de copier — copie manuellement')
    }
  }

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={`Audit IA — Dossier ${dossierRef}`}
      description={audit ? audit.synthese.phrase_synthese : 'Analyse en cours par Polette…'}
      headerRight={audit && (
        <span className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border',
          VERDICT_COLOR[audit.synthese.verdict],
        )}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {VERDICT_LABEL[audit.synthese.verdict]} · {audit.synthese.score_global_pct}/100
        </span>
      )}
      actions={
        <>
          {estimatedCostEur != null && (
            <span className="text-[11px] text-navy-400 mr-auto">
              Coût IA : {estimatedCostEur.toFixed(4)} €
            </span>
          )}
          <button onClick={onClose} className="btn-ghost">Fermer</button>
        </>
      }
    >
      {loading && (
        <div className="max-w-3xl mx-auto py-12 text-center">
          <div className="inline-flex items-center gap-3 text-navy-700">
            <Sparkles className="h-6 w-6 animate-pulse text-gold-500" />
            <span className="font-serif text-lg">Polette analyse le dossier…</span>
          </div>
          <div className="text-xs text-navy-500 mt-3">~10 secondes — vérifie l'historique cabinet, calcule le HCSF, croise les profils…</div>
          <div className="mt-8 space-y-3 max-w-xl mx-auto">
            <div className="skeleton h-16 rounded-lg" />
            <div className="skeleton h-32 rounded-lg" />
            <div className="skeleton h-24 rounded-lg" />
          </div>
        </div>
      )}

      {!loading && audit && (
        <div className="max-w-5xl mx-auto space-y-5">
          {/* ─── Synthèse en hero ────────────────────────────────────────── */}
          <div className={cn(
            'rounded-xl2 p-5 border-2',
            VERDICT_COLOR[audit.synthese.verdict],
          )}>
            <div className="flex items-start gap-4">
              <div className="text-5xl font-serif font-bold leading-none tabular-nums">
                {audit.synthese.score_global_pct}
                <span className="text-2xl text-current/60">/100</span>
              </div>
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider opacity-70 font-semibold mb-1">
                  Verdict global
                </div>
                <div className="font-serif text-xl font-semibold mb-1">
                  {VERDICT_LABEL[audit.synthese.verdict]}
                </div>
                <div className="text-sm opacity-90">
                  {audit.synthese.phrase_synthese}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Points forts / Points faibles ───────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="font-serif text-base font-semibold">Points forts</h3>
                <span className="ml-auto text-xs text-navy-400">{audit.points_forts.length}</span>
              </div>
              <div className="space-y-2">
                {audit.points_forts.length === 0 ? (
                  <div className="text-sm text-navy-400 italic">Aucun point fort identifié.</div>
                ) : audit.points_forts.map((p, i) => (
                  <div key={i} className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                    <div className="text-sm font-semibold text-emerald-900">{p.libelle}</div>
                    <div className="text-xs text-navy-700 mt-1">{p.details}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3 text-rose-700">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-serif text-base font-semibold">Points faibles</h3>
                <span className="ml-auto text-xs text-navy-400">{audit.points_faibles.length}</span>
              </div>
              <div className="space-y-2">
                {audit.points_faibles.length === 0 ? (
                  <div className="text-sm text-emerald-700 italic">Aucun point faible majeur identifié 🎉</div>
                ) : audit.points_faibles.map((p, i) => (
                  <div key={i} className={cn('rounded-lg border p-3', GRAVITE_COLOR[p.gravite] ?? GRAVITE_COLOR.basse)}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-sm font-semibold text-navy-900">{p.libelle}</div>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold',
                        p.gravite === 'haute' ? 'bg-rose-200 text-rose-900' :
                        p.gravite === 'moyenne' ? 'bg-gold-200 text-gold-900' :
                        'bg-navy-100 text-navy-700',
                      )}>{p.gravite}</span>
                    </div>
                    <div className="text-xs text-navy-700 mb-2">{p.details}</div>
                    <div className="text-xs text-navy-600 italic">
                      <strong className="not-italic text-navy-800">Mitigation :</strong> {p.mitigation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── HCSF ────────────────────────────────────────────────────── */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className={cn('h-5 w-5', audit.hcsf.conforme ? 'text-emerald-700' : 'text-rose-700')} />
              <h3 className="font-serif text-base font-semibold">Conformité HCSF</h3>
              <span className={cn(
                'ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
                audit.hcsf.conforme
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200',
              )}>
                {audit.hcsf.conforme ? 'Conforme' : 'Non conforme'}
                {audit.hcsf.derogation_necessaire && ' · Dérogation requise'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Metric
                label="Taux d'endettement"
                value={`${audit.hcsf.taux_endettement_pct.toFixed(1)} %`}
                accent={audit.hcsf.taux_endettement_pct > 35 ? 'rose' : 'emerald'}
              />
              <Metric
                label="Durée"
                value={`${(audit.hcsf.duree_mois / 12).toFixed(0)} ans`}
                accent={audit.hcsf.duree_mois > 300 ? 'rose' : 'navy'}
              />
              <Metric
                label="Reste à vivre"
                value={eur(audit.hcsf.reste_a_vivre_mensuel)}
                accent="gold"
              />
            </div>
            {audit.hcsf.motif_derogation && (
              <div className="text-xs text-navy-700 bg-gold-50 border border-gold-200 rounded p-2 mb-2">
                <strong className="text-gold-800">Motif dérogation :</strong> {audit.hcsf.motif_derogation}
              </div>
            )}
            {audit.hcsf.alertes.length > 0 && (
              <ul className="text-xs text-rose-800 list-disc list-inside space-y-1">
                {audit.hcsf.alertes.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
          </div>

          {/* ─── Cohérence ────────────────────────────────────────────── */}
          {audit.coherence.alertes.length > 0 && (
            <div className="card p-4 border-l-4 border-amber-400">
              <div className="flex items-center gap-2 mb-3 text-amber-800">
                <AlertCircle className="h-5 w-5" />
                <h3 className="font-serif text-base font-semibold">Incohérences détectées</h3>
                <span className="ml-auto text-xs text-navy-400">
                  Score cohérence : {(audit.coherence.score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="space-y-2">
                {audit.coherence.alertes.map((a, i) => (
                  <div key={i} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-xs">
                    <div className="font-mono text-amber-900 mb-0.5">{a.champ}</div>
                    <div className="text-navy-800"><strong>Problème :</strong> {a.probleme}</div>
                    <div className="text-navy-700"><strong>Valeur actuelle :</strong> {String(a.valeur_actuelle ?? '∅')}</div>
                    <div className="text-navy-700"><strong>Suggestion :</strong> {a.suggestion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Banques recommandées ──────────────────────────────────── */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-5 w-5 text-gold-700" />
              <h3 className="font-serif text-base font-semibold">Banques recommandées</h3>
            </div>
            <div className="space-y-2">
              {audit.banques.recommandees.map((b, i) => (
                <div key={i} className="rounded-lg border border-gold-200 bg-gold-50/30 p-3 flex items-start gap-3">
                  <div className="shrink-0 text-center min-w-[60px]">
                    <div className="font-serif text-2xl font-bold text-gold-700 tabular-nums">
                      {b.score_estime_pct}<span className="text-xs">%</span>
                    </div>
                    <div className="text-[10px] text-navy-500 uppercase tracking-wider">accord estimé</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-navy-900 text-sm">{b.nom}</div>
                    <div className="text-xs text-gold-800 mb-1 font-medium italic">
                      <TrendingUp className="h-3 w-3 inline mr-0.5" /> {b.argument_cle}
                    </div>
                    <ul className="text-xs text-navy-700 list-disc list-inside space-y-0.5">
                      {b.raisons.map((r, j) => <li key={j}>{r}</li>)}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            {audit.banques.a_eviter.length > 0 && (
              <>
                <div className="text-xs uppercase tracking-wider text-navy-500 font-semibold mt-4 mb-2">
                  À éviter pour ce profil
                </div>
                <div className="space-y-1">
                  {audit.banques.a_eviter.map((b, i) => (
                    <div key={i} className="text-xs text-rose-800 flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium">{b.nom}</span>
                      <span className="text-rose-600">·</span>
                      <span>{b.raison}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ─── Suggestion DDP ───────────────────────────────────────── */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5 text-navy-700" />
              <h3 className="font-serif text-base font-semibold">Commentaire DDP suggéré</h3>
              <span className="text-xs text-navy-400 ml-1">({audit.suggestion_ddp.corps.length} chars)</span>
              <button onClick={onCopyDDP} className="ml-auto btn-outline text-xs">
                {ddpCopied ? <><Check className="h-3.5 w-3.5" /> Copié</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
              </button>
            </div>
            <div className="font-semibold text-navy-900 mb-2 text-sm">{audit.suggestion_ddp.titre}</div>
            <div className="rounded-lg bg-ivory border border-navy-100 p-3 text-sm text-navy-800 leading-relaxed whitespace-pre-wrap font-serif italic">
              {audit.suggestion_ddp.corps}
            </div>
          </div>
        </div>
      )}
    </FullScreenSheet>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent: 'navy' | 'gold' | 'emerald' | 'rose' }) {
  const colors: Record<string, string> = {
    navy: 'text-navy-900',
    gold: 'text-gold-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  }
  return (
    <div className="rounded-lg border border-navy-100 bg-white p-3">
      <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">{label}</div>
      <div className={cn('font-serif text-xl font-bold tabular-nums mt-1', colors[accent])}>{value}</div>
    </div>
  )
}
