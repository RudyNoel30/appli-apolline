import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User2, Coins, Landmark, Home, Banknote, FolderOpen, StickyNote, Sparkles,
  FileDown, FileText, Map, Calculator, CheckCircle2, AlertTriangle, XCircle, Clock,
  Trash2, Pencil, Save, UserCheck, UserMinus, Mail, MailOpen, Reply, Paperclip, RefreshCw, ExternalLink,
  Link as LinkIcon, Download, Plus, Receipt, Eye, Upload,
} from 'lucide-react'
import FactureFormModal from '@/components/FactureFormModal'
import StatusBadge from '@/components/StatusBadge'
import { factures as facturesApi, type Facture, pieces as piecesApi, auditDossier as auditDossierApi, type AuditDossierResult, importSimulationApi } from '@/db/api'
import AuditDossierModal from '@/components/AuditDossierModal'
import { effectiveMensualite, calcTAEG, calcTAEA, calcFraisNotaireDetail } from '@/lib/finance'
import type { NatureBienNotaire } from '@/lib/finance'
import PlanFinancementModal from '@/components/PlanFinancementModal'
import OffresComparateur from '@/components/OffresComparateur'
import PiecesParCategorie from '@/components/PiecesParCategorie'
import Modal from '@/components/Modal'
import AiPreviewModal from '@/components/AiPreviewModal'
import DossierEditor from '@/components/DossierEditor'
import TabPiecesLocal from '@/components/TabPiecesLocal'
import OneDriveFolderPicker, { type OneDriveSelection } from '@/components/OneDriveFolderPicker'
import PretEditor from '@/components/PretEditor'
import { toast } from 'sonner'
import { STATUTS, piecesByCategorie, piecesAttendues, pretCouleur, type Dossier } from '@/data/mock'
import { useStore, getO365EmailFor } from '@/stores/useStore'
import { useAuth, usePermissions } from '@/auth/AuthContext'
import { eur, pct, dateFr, dateTimeFr, cn, initials } from '@/lib/utils'
import { confirmDialog } from '@/lib/dialog'
import { computeScoreConfiance } from '@/lib/score'
import { saveFile, FILTERS } from '@/lib/saveFile'
import * as mailGraph from '@/o365/mail'
import type { GraphMail } from '@/o365/mail'
import * as drive from '@/o365/onedrive'
import { ai, type AiGenerateResult } from '@/db/api'

type Tab = 'etatcivil' | 'revenus' | 'patrimoine' | 'projet' | 'financement' | 'pieces' | 'notes' | 'messages' | 'factures'

export default function DossierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dossiers = useStore((s) => s.dossiers)
  const clients = useStore((s) => s.clients)
  const updateDossier = useStore((s) => s.updateDossier)
  const deleteDossier = useStore((s) => s.deleteDossier)

  const dossier = dossiers.find((d) => d.id === id)
  const realClient = clients.find((c) => c.id === dossier?.clientId)
  const materializeProspectFor = useStore((s) => s.materializeProspectFor)
  const allNotes = useStore((s) => s.notes)
  const notes = allNotes.filter((n) => n.dossierId === dossier?.id)

  // Si le dossier référence un clientId qui n'est pas (encore) dans le store
  // local — typiquement après une création online sans pull complet, ou un
  // dossier importé sans son client — on construit un fallback minimal pour
  // que la page reste consultable. Un bandeau le signale clairement.
  const fallbackClient: import('@/data/mock').Client | null = !realClient && dossier ? (() => {
    const parts = (dossier.clientNom ?? '').trim().split(/\s+/)
    const nom = parts[0] ?? ''
    const prenom = parts.slice(1).join(' ')
    return {
      id: dossier.clientId,
      prenom, nom,
      email: '', tel: '', naissance: '', ville: '', profession: '',
      revenuMensuelNet: 0,
      dossierIds: [dossier.id],
      createdAt: dossier.createdAt,
      lastActivity: dossier.createdAt,
      apporteur: '',
      statutCommercial: 'client',
    }
  })() : null
  const client = realClient ?? fallbackClient
  const clientMissing = !realClient && !!dossier

  const [tab, setTab] = useState<Tab>('etatcivil')
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Audit IA
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditResult, setAuditResult] = useState<AuditDossierResult | null>(null)
  const [auditCost, setAuditCost] = useState<number | undefined>(undefined)
  const [auditReleves, setAuditReleves] = useState<number | undefined>(undefined)
  const [editModal, setEditModal] = useState(false)
  const [aiModal, setAiModal] = useState<{ title: string } | null>(null)
  const [aiResult, setAiResult] = useState<AiGenerateResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const updateClient = useStore((s) => s.updateClient)
  const convertirEnClient = useStore((s) => s.convertirEnClient)
  const repasserEnProspect = useStore((s) => s.repasserEnProspect)
  const banques = useStore((s) => s.banques)
  const collaborateurs = useStore((s) => s.collaborateurs)
  const apporteurs = useStore((s) => s.apporteurs)
  const allPrets = useStore((s) => s.prets)
  const dossierPrets = allPrets.filter((p) => p.dossierId === (dossier?.id ?? ''))
  const { currentUser } = useAuth()
  const { can } = usePermissions()

  // ─── Calculs live LTV / HCSF / Score (NE PAS utiliser les valeurs stockées
  // qui sont des snapshots à la création — elles ne suivent pas l'ajout
  // de prêts ou de pièces dans le détail).
  const [livePiecesCount, setLivePiecesCount] = useState<number | null>(null)
  useEffect(() => {
    if (!dossier?.id) return
    let cancelled = false
    void piecesApi.list(dossier.id)
      .then((rows) => { if (!cancelled) setLivePiecesCount(rows.length) })
      .catch(() => { /* silencieux — fallback sur dossier.piecesFournies */ })
    // Réagit aux events d'upload/delete émis par TabPiecesLocal
    const onChange = () => {
      void piecesApi.list(dossier.id).then((rows) => {
        if (!cancelled) setLivePiecesCount(rows.length)
      }).catch(() => { /* swallow */ })
    }
    window.addEventListener('apolline:pieces-changed', onChange)
    return () => {
      cancelled = true
      window.removeEventListener('apolline:pieces-changed', onChange)
    }
  }, [dossier?.id])

  // Toutes les valeurs LIVE dérivent de dossierPrets + dossier (revenus) + pieces
  const liveTotalEmprunte = dossierPrets.reduce((s, p) => s + (p.montant ?? 0), 0)
  const liveMensualiteTotale = dossierPrets.reduce((s, p) => s + effectiveMensualite(p).totale, 0)
  const liveDureeMaxMois = dossierPrets.reduce((m, p) => Math.max(m, p.dureeMois ?? 0), 0)
  const liveLtv = (dossier?.montantBien ?? 0) > 0
    ? liveTotalEmprunte / (dossier?.montantBien ?? 1)
    : 0

  // Revenus mensuels nets du foyer (rfMenage est annuel)
  const liveRevenusMensuels = ((dossier?.rfMenage ?? 0) / 12)
    + (dossier?.allocFamiliales ?? 0)
    + (dossier?.aplAlActuelle ?? 0)
  const liveRatioEndettement = liveRevenusMensuels > 0
    ? liveMensualiteTotale / liveRevenusMensuels
    : 0

  // HCSF en temps réel : taux endettement ≤ 35 %, durée ≤ 25 ans (300 mois), LTV ≤ 100 %
  const liveHcsfOk = liveRatioEndettement > 0
    && liveRatioEndettement <= 0.35
    && liveDureeMaxMois <= 300
    && liveLtv <= 1.0

  // Pièces attendues : on compte les pièces NON optionnelles dans la convention
  const livePiecesTotal = useMemo(
    () => piecesAttendues.filter((p) => !p.optionnelle).length,
    [],
  )

  if (!dossier || !client) {
    return (
      <>
        <Link to="/dossiers" className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-500 hover:text-navy-900 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au pipeline
        </Link>
        <div className="card p-8 text-center text-navy-500">
          {!dossier ? (
            <>
              <div className="font-semibold mb-1">Dossier introuvable</div>
              <div className="text-xs">L'identifiant <code className="font-mono">{id}</code> ne correspond à aucun dossier connu localement.</div>
            </>
          ) : (
            <div className="font-semibold">Données du dossier indisponibles</div>
          )}
        </div>
      </>
    )
  }

  const stat = STATUTS.find((s) => s.key === dossier.statut)!

  /** Audit IA du dossier : analyse Claude des forces / faiblesses / HCSF / banques. */
  const runAudit = async () => {
    setAuditOpen(true)
    setAuditLoading(true)
    setAuditResult(null)
    setAuditCost(undefined)
    setAuditReleves(undefined)
    try {
      const res = await auditDossierApi.run(dossier.id)
      setAuditResult(res.data)
      setAuditCost(res.usage.estimatedCostEur)
      setAuditReleves(res.relevesAttaches)
      const relevSuffix = res.relevesAttaches > 0
        ? ` · ${res.relevesAttaches} relevé(s) bancaire(s) analysé(s)`
        : ''
      toast.success('Audit terminé', {
        description: `${res.data.synthese.score_global_pct}/100 · ${res.data.synthese.phrase_synthese}${relevSuffix}`,
        duration: 6000,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Échec audit IA', { description: msg.slice(0, 200) })
      setAuditOpen(false)
    } finally {
      setAuditLoading(false)
    }
  }

  /** Génération IA via Claude API en utilisant un skill Apolline. */
  const generateAi = async (skillName: string, title: string) => {
    setAiModal({ title })
    setAiLoading(true)
    setAiResult(null)
    try {
      const result = await ai.generateForDossier(dossier.id, skillName)
      setAiResult(result)
      toast.success('Génération IA terminée', {
        description: `${result.usage.outputTokens.toLocaleString('fr-FR')} tokens · ~${result.usage.estimatedCostEur} € · ${result.tier}`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Échec génération IA', { description: msg.slice(0, 200) })
      setAiModal(null)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <>
      {clientMissing && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
          <div className="flex-1">
            <div className="font-semibold">Fiche client incomplète</div>
            <div className="mt-0.5">
              Ce dossier (<code className="font-mono">{dossier.ref}</code>) référence le client <strong>{dossier.clientNom}</strong> mais sa fiche n'est pas dans la base locale.
            </div>
            <button
              onClick={() => {
                const created = materializeProspectFor(dossier.id)
                if (created) {
                  toast.success(`Fiche prospect créée pour ${created.prenom} ${created.nom}`, {
                    description: 'Vous pouvez maintenant l\'enrichir depuis l\'onglet État civil ou la page Prospects.',
                  })
                }
              }}
              className="mt-2 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-md px-3 py-1.5 transition"
            >
              Créer la fiche prospect maintenant
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between shrink-0 mb-4">
        <Link to="/dossiers" className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-500 hover:text-navy-900">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au pipeline
        </Link>
        <div className="flex items-center gap-2">
          {client.statutCommercial === 'prospect' ? (
            <button
              onClick={() => {
                convertirEnClient(client.id)
                toast.success(`${client.prenom} ${client.nom} converti en client`, {
                  description: 'Mandat envoyé · daté à aujourd\'hui',
                })
              }}
              className="btn bg-emerald-600 text-white hover:bg-emerald-700 text-xs"
            >
              <UserCheck className="h-3.5 w-3.5" /> Convertir en client (mandat envoyé)
            </button>
          ) : (
            <button
              onClick={() => {
                repasserEnProspect(client.id)
                toast.success(`${client.prenom} ${client.nom} repassé en prospect`)
              }}
              className="btn-ghost text-amber-700 hover:bg-amber-50 text-xs"
            >
              <UserMinus className="h-3.5 w-3.5" /> Repasser en prospect
            </button>
          )}
          <button
            onClick={() => setEditModal(true)}
            className="btn-outline text-xs"
          >
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={!can('dossier:delete')}
            title={!can('dossier:delete') ? 'Action réservée aux courtiers/admins' : undefined}
            className="btn-ghost text-rose-700 hover:bg-rose-50 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-navy-800 to-navy-900 text-gold-400 flex items-center justify-center font-serif text-lg font-semibold shadow-soft">
                {initials(client.prenom + ' ' + client.nom)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-navy-400">Dossier {dossier.ref}</span>
                  <StatutSelect value={dossier.statut} onChange={(s) => {
                    updateDossier(dossier.id, { statut: s })
                    const label = STATUTS.find((st) => st.key === s)!.label
                    toast.success(`Statut mis à jour : ${label}`)
                    // Suggestion proactive : si on passe en "Accord", proposer la facturation
                    if (s === 'Accord') {
                      setTimeout(() => {
                        toast(`💡 Le dossier est accordé — voulez-vous émettre la facture d'honoraires ?`, {
                          duration: 8000,
                          action: {
                            label: 'Demander à Polette',
                            onClick: () => {
                              window.dispatchEvent(new CustomEvent('apolline:coworker-toggle'))
                              setTimeout(() => {
                                const ta = document.querySelector<HTMLTextAreaElement>('aside textarea')
                                if (ta) {
                                  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
                                  setter?.call(ta, `Le dossier ${dossier.ref} est accordé. Émets la facture d'honoraires.`)
                                  ta.dispatchEvent(new Event('input', { bubbles: true }))
                                  ta.focus()
                                }
                              }, 300)
                            },
                          },
                        })
                      }, 600)
                    }
                  }} currentColor={stat.color} />
                  {dossier.hcsfOk ? (
                    <span className="badge-success"><CheckCircle2 className="h-3 w-3" /> HCSF OK</span>
                  ) : (
                    <span className="badge-danger"><XCircle className="h-3 w-3" /> HCSF hors norme</span>
                  )}
                  {client.statutCommercial === 'client' ? (
                    <span className="badge-success" title={client.mandatEnvoyeLe ? `Mandat envoyé le ${dateFr(client.mandatEnvoyeLe)}` : 'Client sous mandat'}>
                      <UserCheck className="h-3 w-3" /> Client
                    </span>
                  ) : (
                    <span className="badge-warning"><UserMinus className="h-3 w-3" /> Prospect</span>
                  )}
                </div>
                <h1 className="font-serif text-2xl font-semibold text-navy-900">{client.prenom} {client.nom}</h1>
                {client.conjoint && <div className="text-sm text-navy-500">Co-emprunteur : {client.conjoint}</div>}
                <div className="flex items-center gap-3 mt-2 text-xs text-navy-500">
                  <span>{dossier.typeProjet}</span>
                  <span>·</span>
                  <span>{dossier.villeBien}</span>
                  <span>·</span>
                  <span>Créé le {dateFr(dossier.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 text-right">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Montant prêt</div>
                <div className="font-serif text-xl font-semibold text-navy-900">{eur(dossier.montantPret)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">LTV</div>
                <div className={cn(
                  'font-serif text-xl font-semibold',
                  liveLtv > 0.9 ? 'text-amber-700' : liveLtv === 0 ? 'text-navy-300' : 'text-navy-900',
                )}
                title={`Total emprunté ${eur(liveTotalEmprunte)} / Valeur bien ${eur(dossier.montantBien ?? 0)}`}>
                  {liveLtv > 0 ? pct(liveLtv, 0) : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Score</div>
                {(() => {
                  const score = computeScoreConfiance(dossier, {
                    ltv: liveLtv,
                    piecesFournies: livePiecesCount ?? undefined,
                    piecesTotal: livePiecesTotal,
                    hcsfOk: liveHcsfOk,
                    ratioMensualiteRevenus: liveRatioEndettement > 0 ? liveRatioEndettement : undefined,
                  })
                  return (
                    <div className={cn(
                      'font-serif text-xl font-semibold',
                      score >= 85 ? 'text-emerald-700' :
                      score >= 70 ? 'text-gold-700' : 'text-rose-700',
                    )}
                    title={`LTV ${pct(liveLtv, 0)} · HCSF ${liveHcsfOk ? '✓' : '✗'} · Endettement ${pct(liveRatioEndettement, 0)} · Pièces ${livePiecesCount ?? '?'} / ${livePiecesTotal}`}>
                      {score}/100
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-navy-100 space-y-2.5">
            {/* Ligne 1 — Générations IA via skills Apolline */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="kicker pr-1 select-none">
                Génération IA
              </span>
              <button className="btn-gold" onClick={() => void runAudit()} title="Audit IA du dossier — analyse points forts/faibles, HCSF, banques recommandées">
                <Sparkles className="h-4 w-4" /> Auditer ce dossier
              </button>
              <button className="btn-outline" onClick={() => generateAi('ddp-pdf', 'DDP — Demande de Prêt')}>
                <Sparkles className="h-4 w-4" /> Générer DDP
              </button>
              <button className="btn-outline" onClick={() => generateAi('dossier-html', 'Dossier banquier HTML')}>
                <Sparkles className="h-4 w-4" /> Dossier banquier
              </button>
              <button className="btn-outline" onClick={() => generateAi('dossier-html-pro', 'Dossier banquier PRO')}>
                <Sparkles className="h-4 w-4" /> Dossier banquier PRO
              </button>
              <button className="btn-outline" onClick={() => generateAi('dossier-r1-etude-client', 'Étude client R1')}>
                <Sparkles className="h-4 w-4" /> Étude client R1
              </button>
              <button className="btn-outline" onClick={() => generateAi('dossier-html-simulation', 'Comparatif multi-banques IA')}>
                <Sparkles className="h-4 w-4" /> Comparatif IA
              </button>
              <button className="btn-outline" onClick={() => generateAi('dossier-html-dvf', 'Étude DVF IA')}>
                <Sparkles className="h-4 w-4" /> Étude DVF IA
              </button>
            </div>

            {/* Ligne 2 — Outils & navigation */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="kicker pr-1 select-none">
                Outils
              </span>
              <button className="btn-outline" onClick={() => navigate('/dvf')}>
                <Map className="h-4 w-4" /> Lancer étude DVF
              </button>
              <button className="btn-outline" onClick={() => navigate('/simulation')}>
                <Calculator className="h-4 w-4" /> Simulation multi-banques
              </button>
              <div className="flex-1" />
              <button
                className="btn-ghost"
                onClick={async () => {
                  const data = JSON.stringify({ dossier, client }, null, 2)
                  const path = await saveFile({
                    defaultFilename: `dossier-${dossier.ref}.json`,
                    content: data,
                    filters: FILTERS.json,
                    mimeType: 'application/json',
                  })
                  if (path === null) return
                  toast.success('Export JSON enregistré', { description: path !== 'download' ? path : 'Téléchargé' })
                }}
              >
                <FileDown className="h-4 w-4" /> Export JSON
              </button>
            </div>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="border-b border-navy-100 bg-ivory/50 px-4">
            <div className="flex gap-1 -mb-px">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition',
                    tab === t.key
                      ? 'border-gold-500 text-navy-900'
                      : 'border-transparent text-navy-500 hover:text-navy-800',
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* key={tab} sur le wrapper → React remonte le contenu à chaque
              changement d'onglet, ce qui rejoue l'animation tab-content. */}
          <div key={tab} className="p-6 tab-content">
            {tab === 'etatcivil' && <TabEtatCivil client={client} dossier={dossier} onEdit={() => setEditModal(true)} dossierId={dossier.id} />}
            {tab === 'revenus' && <TabRevenus client={client} dossier={dossier} onEdit={() => setEditModal(true)} dossierId={dossier.id} />}
            {tab === 'patrimoine' && <TabPatrimoine dossier={dossier} client={client} onEdit={() => setEditModal(true)} />}
            {tab === 'projet' && <TabProjet dossier={dossier} onEdit={() => setEditModal(true)} dossierId={dossier.id} />}
            {tab === 'financement' && <TabFinancement dossier={dossier} />}
            {tab === 'pieces' && <TabPiecesLocal dossier={dossier} />}
            {tab === 'factures' && <TabFactures dossierId={dossier.id} />}
            {tab === 'notes' && <TabNotes dossierId={dossier.id} />}
            {tab === 'messages' && <TabMessages clientEmail={client.email} clientNom={`${client.prenom} ${client.nom}`} dossierRef={dossier.ref} />}
          </div>
        </div>
      </div>

      {editModal && (
        <DossierEditor
          dossier={dossier}
          client={client}
          banques={banques}
          collaborateurs={collaborateurs}
          onClose={() => setEditModal(false)}
          onSave={(dossierPatch, clientPatch) => {
            updateDossier(dossier.id, dossierPatch)
            updateClient(client.id, clientPatch)
            toast.success('Dossier mis à jour avec succès')
            setEditModal(false)
          }}
        />
      )}

      <AiPreviewModal
        open={!!aiModal}
        onClose={() => { setAiModal(null); setAiResult(null) }}
        title={aiModal?.title ?? ''}
        result={aiResult}
        loading={aiLoading}
        filenamePrefix={`apolline-${dossier.ref}-${(client.nom ?? '').toLowerCase()}`}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in" onClick={() => setConfirmDelete(false)}>
          <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-xl2 shadow-raised p-6 max-w-md animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-xl font-semibold text-navy-900 mb-2">Supprimer ce dossier ?</h3>
            <p className="text-sm text-navy-600 mb-5">
              Le dossier <strong>{dossier.ref}</strong> de <strong>{client.prenom} {client.nom}</strong> et toutes ses notes seront perdus. Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setConfirmDelete(false)}>Annuler</button>
              <button
                className="btn bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => {
                  deleteDossier(dossier.id)
                  toast.success(`Dossier ${dossier.ref} supprimé`)
                  navigate('/dossiers')
                }}
              >
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit IA — modale plein écran, dispo depuis n'importe quel onglet */}
      <AuditDossierModal
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        audit={auditResult}
        loading={auditLoading}
        dossierRef={dossier.ref}
        estimatedCostEur={auditCost}
        relevesAttaches={auditReleves}
      />
    </>
  )
}

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'etatcivil', label: 'État civil', icon: User2 },
  { key: 'revenus', label: 'Revenus', icon: Coins },
  { key: 'patrimoine', label: 'Patrimoine', icon: Landmark },
  { key: 'projet', label: 'Projet', icon: Home },
  { key: 'financement', label: 'Financement', icon: Banknote },
  { key: 'pieces', label: 'Pièces', icon: FolderOpen },
  { key: 'factures', label: 'Factures', icon: Receipt },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'messages', label: 'Messages', icon: Mail },
]

function StatutSelect({ value, onChange, currentColor }: { value: Dossier['statut']; onChange: (s: Dossier['statut']) => void; currentColor: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Dossier['statut'])}
      className={cn('badge cursor-pointer border-0 pr-6 appearance-none bg-[length:12px] bg-no-repeat bg-[right_4px_center]', currentColor)}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='%231f3a7a'%3E%3Cpath d='M6 9L1 4h10z'/%3E%3C/svg%3E")` }}
    >
      {STATUTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
    </select>
  )
}

function Section({ title, children, action }: { title: string; children: any; action?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-serif text-base font-semibold text-navy-900">{title}</h3>
        <div className="flex-1 h-px bg-navy-100" />
        {action}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold mb-0.5">{label}</div>
      <div className="text-sm text-navy-900">{value}</div>
    </div>
  )
}

/** Libellés français pour les valeurs canoniques stockées en BDD */
const SITUATION_LABELS: Record<string, string> = {
  marie: 'Marié(e)',
  pacse: 'Pacsé(e)',
  celibataire: 'Célibataire',
  divorce: 'Divorcé(e)',
  veuf: 'Veuf/Veuve',
  union_libre: 'Union libre',
}

const CONTRAT_LABELS: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  interim: 'Intérim',
  stage: 'Stage',
  alternance: 'Alternance',
  fonctionnaire: 'Fonctionnaire',
  TNS: 'TNS (indépendant)',
  profession_liberale: 'Profession libérale',
  sans_emploi: 'Sans emploi',
  retraite: 'Retraité',
  autre: 'Autre',
}

/** Lit un champ depuis le jsonb emprunteur (peut être null/undefined) */
function emp<T = string>(emp: unknown, key: string): T | undefined {
  if (!emp || typeof emp !== 'object') return undefined
  return (emp as Record<string, unknown>)[key] as T | undefined
}

function TabEtatCivil({ client, dossier, onEdit, dossierId }: { client: any; dossier: Dossier; onEdit?: () => void; dossierId: string }) {
  const e1 = dossier.emprunteur1 as Record<string, unknown> | undefined
  const e2 = dossier.emprunteur2 as Record<string, unknown> | undefined | null

  // Pour l'emprunteur principal, on privilégie les données enrichies du dossier
  // (emprunteur1 jsonb) qui sont plus complètes que le client de base.
  const emp1Prenom = emp<string>(e1, 'prenom') || client.prenom
  const emp1Nom = emp<string>(e1, 'nom') || client.nom
  // Le type Emprunteur du frontend utilise "naissance" (pas "dateNaissance").
  // On lit "naissance" en priorité, mais on tombe sur "dateNaissance" en
  // fallback pour rétrocompat avec les anciens imports qui ont stocké la clé
  // sous l'autre nom.
  const emp1Naissance = emp<string>(e1, 'naissance')
    || emp<string>(e1, 'dateNaissance')
    || client.naissance
  const emp1Profession = emp<string>(e1, 'profession') || client.profession || '—'
  const emp1Contrat = emp<string>(e1, 'typeContrat')
  const emp1Employeur = emp<string>(e1, 'employeur')
  const emp1Situation = emp<string>(e1, 'situationFamiliale')
  const situationLabel = emp1Situation
    ? (SITUATION_LABELS[emp1Situation] ?? emp1Situation)
    : (client.conjoint ? 'En couple' : 'Célibataire')

  return (
    <>
      {onEdit && (
        <div className="flex justify-end mb-3">
          <button onClick={onEdit} className="btn-outline text-sm">
            <Pencil className="h-3.5 w-3.5" /> Modifier l'état civil
          </button>
        </div>
      )}
      <Section title="Emprunteur principal">
        <div className="grid grid-cols-4 gap-5">
          <Field label="Prénom" value={emp1Prenom} />
          <Field label="Nom" value={emp1Nom} />
          <Field label="Date de naissance" value={emp1Naissance ? dateFr(emp1Naissance) : '—'} />
          <Field label="Ville" value={client.ville} />
          <Field label="Email" value={client.email || '—'} />
          <Field label="Téléphone" value={client.tel || '—'} />
          <Field label="Profession" value={emp1Profession} />
          <Field label="Situation" value={situationLabel} />
          {emp1Employeur && <Field label="Employeur" value={emp1Employeur} />}
          {emp1Contrat && <Field label="Contrat" value={CONTRAT_LABELS[emp1Contrat] ?? emp1Contrat} />}
        </div>
      </Section>

      {/* Co-emprunteur : on l'affiche si on a un jsonb emprunteur2 OU au minimum un client.conjoint */}
      {(e2 || client.conjoint) && (
        <Section title="Co-emprunteur">
          <div className="grid grid-cols-4 gap-5">
            <Field label="Prénom" value={emp<string>(e2, 'prenom') ?? (client.conjoint ? client.conjoint.split(' ')[0] : '—')} />
            <Field label="Nom" value={emp<string>(e2, 'nom') ?? (client.conjoint ? client.conjoint.split(' ').slice(1).join(' ') : '—')} />
            <Field label="Date de naissance" value={(() => {
              const d = emp<string>(e2, 'naissance') ?? emp<string>(e2, 'dateNaissance')
              return d ? dateFr(d) : '—'
            })()} />
            <Field label="Nationalité" value={emp<string>(e2, 'nationalite') || '—'} />
            <Field label="Profession" value={emp<string>(e2, 'profession') || '—'} />
            <Field label="Contrat" value={(() => {
              const c = emp<string>(e2, 'typeContrat')
              return c ? (CONTRAT_LABELS[c] ?? c) : '—'
            })()} />
            <Field label="Employeur" value={emp<string>(e2, 'employeur') || '—'} />
            <Field label="Ancienneté" value={(() => {
              const a = emp<number>(e2, 'anciennete')
              return a ? `${Math.floor(a / 12)} an${a >= 24 ? 's' : ''}${a % 12 > 0 ? ` ${a % 12} mois` : ''}` : '—'
            })()} />
          </div>
        </Section>
      )}

      {/* Pièces P1 — identité, situation familiale */}
      <PiecesParCategorie dossierId={dossierId} categorie="P1" />
    </>
  )
}

function TabRevenus({ client, dossier, onEdit, dossierId }: { client: any; dossier: Dossier; onEdit?: () => void; dossierId: string }) {
  const e1 = dossier.emprunteur1 as Record<string, unknown> | undefined
  const e2 = dossier.emprunteur2 as Record<string, unknown> | undefined | null

  const buildBlock = (titre: string, emprunteur: Record<string, unknown> | undefined | null, fallbackRevenu?: number) => {
    const salaire = (emp<number>(emprunteur, 'salaireNet') ?? fallbackRevenu) || 0
    const baBicBnc = emp<number>(emprunteur, 'baBicBnc') || 0
    const baBicBncMois = emp<number>(emprunteur, 'baBicBncMois') || 12
    const rfBruts = emp<number>(emprunteur, 'rfBrutsExistants') || 0
    const autresRev = emp<number>(emprunteur, 'autresRevenusNonSociaux') || 0
    const revSoc = emp<number>(emprunteur, 'revenusSociaux') || 0
    const pensionRecue = emp<number>(emprunteur, 'pensionAlimentaireRecue') || 0
    const rfrN1 = emp<number>(emprunteur, 'rfPersonnelN1') || 0
    const rfrN2 = emp<number>(emprunteur, 'rfPersonnelN2') || 0

    // Données professionnelles (employeur, contrat, dates)
    const profession = emp<string>(emprunteur, 'profession') || ''
    const employeur = emp<string>(emprunteur, 'employeur') || ''
    const typeContrat = emp<string>(emprunteur, 'typeContrat') || ''
    const dateEmbauche = emp<string>(emprunteur, 'dateEmbauche') || ''
    const anciennete = emp<number>(emprunteur, 'anciennete') || 0
    const secteur = emp<string>(emprunteur, 'secteur') || ''
    // Adresse employeur (peut être dans bienDetails / emprunteur.adresseEmployeur si extraite)
    const adresseEmployeur = emp<string>(emprunteur, 'adresseEmployeur')
      ?? emp<string>(emprunteur, 'adresseProfessionnelle')
      ?? ''

    const baBicBncMensuel = baBicBncMois > 0 ? baBicBnc / baBicBncMois : 0
    const totalMensuel = salaire + baBicBncMensuel + rfBruts + autresRev + revSoc + pensionRecue

    return (
      <div className="bg-ivory rounded-lg p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider font-semibold text-navy-500">{titre}</div>

        {/* ─── Bloc Situation professionnelle ─── */}
        {(employeur || profession || typeContrat) && (
          <div className="rounded-lg bg-white border border-navy-100 p-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-gold-700 mb-1">Situation professionnelle</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {profession && <div><span className="text-navy-500">Profession :</span> <span className="text-navy-900 font-medium">{profession}</span></div>}
              {typeContrat && <div><span className="text-navy-500">Contrat :</span> <span className="text-navy-900 font-medium">{typeContrat}</span></div>}
              {employeur && <div className="col-span-2"><span className="text-navy-500">Employeur :</span> <span className="text-navy-900 font-medium">{employeur}</span></div>}
              {adresseEmployeur && <div className="col-span-2"><span className="text-navy-500">Adresse :</span> <span className="text-navy-700">{adresseEmployeur}</span></div>}
              {dateEmbauche && (
                <div><span className="text-navy-500">Date d'embauche :</span> <span className="text-navy-900 font-medium">{dateFr(dateEmbauche)}</span></div>
              )}
              {anciennete > 0 && (
                <div>
                  <span className="text-navy-500">Ancienneté :</span>{' '}
                  <span className="text-navy-900 font-medium">
                    {Math.floor(anciennete / 12)} an{anciennete >= 24 ? 's' : ''}
                    {anciennete % 12 > 0 ? ` ${anciennete % 12} mois` : ''}
                  </span>
                </div>
              )}
              {secteur && <div className="col-span-2"><span className="text-navy-500">Secteur :</span> <span className="text-navy-700">{secteur}</span></div>}
            </div>
          </div>
        )}

        {/* ─── Bloc Revenus ─── */}
        <table className="w-full text-sm">
          <tbody className="divide-y divide-navy-100">
            <tr><td className="py-2">Salaire net mensuel</td><td className="py-2 text-right font-mono">{eur(salaire)}</td></tr>
            {baBicBnc > 0 && (
              <tr><td className="py-2">BIC / BNC / BA</td><td className="py-2 text-right font-mono">{eur(baBicBnc)} / {baBicBncMois}m</td></tr>
            )}
            {rfBruts > 0 && (
              <tr><td className="py-2">Revenus fonciers bruts</td><td className="py-2 text-right font-mono">{eur(rfBruts)}</td></tr>
            )}
            {autresRev > 0 && (
              <tr><td className="py-2">Autres revenus</td><td className="py-2 text-right font-mono">{eur(autresRev)}</td></tr>
            )}
            {revSoc > 0 && (
              <tr><td className="py-2">Revenus sociaux</td><td className="py-2 text-right font-mono">{eur(revSoc)}</td></tr>
            )}
            {pensionRecue > 0 && (
              <tr><td className="py-2">Pension reçue</td><td className="py-2 text-right font-mono">{eur(pensionRecue)}</td></tr>
            )}
            <tr className="border-t-2 border-navy-200">
              <td className="py-2 font-semibold">Total mensuel</td>
              <td className="py-2 text-right font-serif font-semibold text-gold-700">{eur(Math.round(totalMensuel))}</td>
            </tr>
            {rfrN1 > 0 && (
              <tr><td className="py-2 text-navy-500">RFR N-1</td><td className="py-2 text-right font-mono text-xs text-navy-500">{eur(rfrN1)}</td></tr>
            )}
            {rfrN2 > 0 && (
              <tr><td className="py-2 text-navy-500">RFR N-2</td><td className="py-2 text-right font-mono text-xs text-navy-500">{eur(rfrN2)}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      {onEdit && (
        <div className="flex justify-end mb-3">
          <button onClick={onEdit} className="btn-outline text-sm">
            <Pencil className="h-3.5 w-3.5" /> Modifier les revenus
          </button>
        </div>
      )}
      <Section title="Revenus mensuels nets retenus">
        <div className="grid grid-cols-2 gap-6">
          {buildBlock('Emprunteur principal', e1, client.revenuMensuelNet)}
          {(e2 || client.conjoint) && buildBlock('Co-emprunteur', e2, 0)}
        </div>

        {/* Total foyer si on a les 2 emprunteurs */}
        {e2 && (
          <div className="mt-4 p-3 rounded-lg bg-gold-50/40 border border-gold-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-navy-900">Total revenus foyer (mensuel)</span>
            <span className="font-serif text-lg font-bold text-gold-700">
              {(() => {
                const s1 = (emp<number>(e1, 'salaireNet') || client.revenuMensuelNet || 0)
                const s2 = (emp<number>(e2, 'salaireNet') || 0)
                return eur(s1 + s2)
              })()}
            </span>
          </div>
        )}
      </Section>

      {/* Pièces P2 — profession & revenus (bulletins, contrats, avis IRPP) */}
      <PiecesParCategorie dossierId={dossierId} categorie="P2" />
    </>
  )
}

function TabPatrimoine({ dossier, client, onEdit }: { dossier: Dossier; client: import('@/data/mock').Client; onEdit: () => void }) {
  const [pieces, setPieces] = useState<import('@/db/api').PieceMeta[]>([])
  const [loadingPieces, setLoadingPieces] = useState(false)

  const reloadPieces = useCallback(async () => {
    setLoadingPieces(true)
    try {
      const rows = await piecesApi.list(dossier.id)
      setPieces(rows)
    } catch (e) {
      console.warn('[patrimoine] échec chargement pièces', e)
    } finally {
      setLoadingPieces(false)
    }
  }, [dossier.id])

  // Recharge à chaque ouverture de l'onglet + écoute les events de changement de pièces
  useEffect(() => {
    void reloadPieces()
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { dossierId?: string } | undefined
      if (!detail || detail.dossierId === dossier.id) void reloadPieces()
    }
    window.addEventListener('apolline:pieces-changed', onChange)
    return () => window.removeEventListener('apolline:pieces-changed', onChange)
  }, [dossier.id, reloadPieces])

  const piecesP3 = useMemo(() => pieces.filter((p) => p.categorie === 'P3'), [pieces])
  const biens = dossier.patrimoine ?? []
  const droitsEL = dossier.droitsEL ?? []
  const credits = dossier.creditsExistants ?? []

  const totalValeurBiens = biens.reduce((s, b) => s + (b.valeur ?? 0), 0)
  const totalCrdBiens = biens.reduce((s, b) => s + (b.crd ?? 0), 0)
  const totalRevenuBiens = biens.reduce((s, b) => s + (b.revenu ?? 0), 0)
  const totalDroitsEL = droitsEL.reduce((s, d) => s + (d.droits ?? 0), 0)
  const totalCreditsCrd = credits.reduce((s, c) => s + (c.crd ?? 0), 0)
  const totalCreditsMens = credits.reduce((s, c) => s + (c.mensualite ?? 0), 0)

  // Épargne mensuelle : programmée du ménage + chacun des emprunteurs
  const e1Epargne = (dossier.emprunteur1 as { epargneProgrammee?: number } | undefined)?.epargneProgrammee ?? 0
  const e2Epargne = (dossier.emprunteur2 as { epargneProgrammee?: number } | undefined)?.epargneProgrammee ?? 0
  const epargneMensuelle = (dossier.epargneMenage ?? 0) + e1Epargne + e2Epargne

  const patrimoineNet = totalValeurBiens - totalCrdBiens

  const TYPE_LABEL: Record<string, string> = {
    'Résidence principale': 'RP',
    'Résidence secondaire': 'RS',
    'Locatif': 'Locatif',
    'Terrain': 'Terrain',
    'Local pro': 'Pro',
    'Autre': 'Autre',
  }

  return (
    <>
      {/* KPIs synthèse */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <PatrimoineKpi label="Patrimoine net" value={eur(patrimoineNet)} hint={`${biens.length} bien${biens.length > 1 ? 's' : ''} · CRD ${eur(totalCrdBiens)}`} accent="gold" />
        <PatrimoineKpi label="Apport prévu" value={eur(dossier.apport)} hint="Sur ce projet" />
        <PatrimoineKpi label="Épargne /mois" value={eur(epargneMensuelle)} hint="Capacité d'épargne" accent="emerald" />
        <PatrimoineKpi label="Droits Épargne Logement" value={eur(totalDroitsEL)} hint={`${droitsEL.length} compte${droitsEL.length > 1 ? 's' : ''}`} />
      </div>

      <Section title="Biens immobiliers détenus" action={
        <button onClick={onEdit} className="btn-outline text-xs"><Pencil className="h-3.5 w-3.5" /> Modifier</button>
      }>
        {biens.length === 0 ? (
          <div className="text-sm text-navy-400 italic border border-dashed border-navy-200 rounded-lg p-6 text-center">
            Aucun bien immobilier saisi. Cliquez sur Modifier pour ajouter une résidence, un locatif, un terrain…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Libellé</th>
                  <th className="table-th">Type</th>
                  <th className="table-th text-right">Valeur</th>
                  <th className="table-th text-right">CRD</th>
                  <th className="table-th text-right">Net</th>
                  <th className="table-th text-right">Revenu /mois</th>
                  <th className="table-th text-center">Hyp.</th>
                  <th className="table-th text-center">Vente envisagée</th>
                </tr>
              </thead>
              <tbody>
                {biens.map((b) => (
                  <tr key={b.id} className="hover:bg-navy-50/40">
                    <td className="table-td font-medium">{b.libelle || '—'}</td>
                    <td className="table-td"><span className="badge-navy">{TYPE_LABEL[b.type] ?? b.type}</span></td>
                    <td className="table-td text-right tabular-nums">{eur(b.valeur ?? 0)}</td>
                    <td className="table-td text-right tabular-nums text-rose-700">{eur(b.crd ?? 0)}</td>
                    <td className="table-td text-right tabular-nums font-semibold">{eur((b.valeur ?? 0) - (b.crd ?? 0))}</td>
                    <td className="table-td text-right tabular-nums">{b.revenu ? eur(b.revenu) : '—'}</td>
                    <td className="table-td text-center">{b.hypotheque ? <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 inline" /> : '—'}</td>
                    <td className="table-td text-center">{b.venteEnvisagee ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 inline" /> : '—'}</td>
                  </tr>
                ))}
                <tr className="bg-navy-50/40 font-semibold">
                  <td className="table-td" colSpan={2}>Total</td>
                  <td className="table-td text-right tabular-nums">{eur(totalValeurBiens)}</td>
                  <td className="table-td text-right tabular-nums text-rose-700">{eur(totalCrdBiens)}</td>
                  <td className="table-td text-right tabular-nums">{eur(patrimoineNet)}</td>
                  <td className="table-td text-right tabular-nums">{eur(totalRevenuBiens)}</td>
                  <td className="table-td" colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Droits Épargne Logement (PEL / CEL)" action={
        <button onClick={onEdit} className="btn-outline text-xs"><Pencil className="h-3.5 w-3.5" /> Modifier</button>
      }>
        {droitsEL.length === 0 ? (
          <div className="text-sm text-navy-400 italic border border-dashed border-navy-200 rounded-lg p-4 text-center">
            Aucun droit ÉL saisi.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-th">Type</th>
                <th className="table-th">Titulaire</th>
                <th className="table-th text-right">Droits acquis</th>
                <th className="table-th text-center">Cédés</th>
              </tr>
            </thead>
            <tbody>
              {droitsEL.map((d) => (
                <tr key={d.id} className="hover:bg-navy-50/40">
                  <td className="table-td"><span className="badge-gold">{d.type}</span></td>
                  <td className="table-td">{d.titulaire || '—'}</td>
                  <td className="table-td text-right tabular-nums">{eur(d.droits ?? 0)}</td>
                  <td className="table-td text-center">{d.cedes ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 inline" /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Crédits en cours (${credits.length})`} action={
        <button onClick={onEdit} className="btn-outline text-xs"><Pencil className="h-3.5 w-3.5" /> Modifier</button>
      }>
        {credits.length === 0 ? (
          <div className="text-sm text-navy-400 italic border border-dashed border-navy-200 rounded-lg p-4 text-center">
            Aucun crédit en cours saisi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Libellé</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Organisme</th>
                  <th className="table-th text-right">CRD</th>
                  <th className="table-th text-right">Mensualité</th>
                  <th className="table-th">Devenir</th>
                </tr>
              </thead>
              <tbody>
                {credits.map((c) => (
                  <tr key={c.id} className="hover:bg-navy-50/40">
                    <td className="table-td">{c.libelle || '—'}</td>
                    <td className="table-td text-xs text-navy-600">{c.type}</td>
                    <td className="table-td text-xs text-navy-600">{c.organisme ?? '—'}</td>
                    <td className="table-td text-right tabular-nums">{eur(c.crd ?? 0)}</td>
                    <td className="table-td text-right tabular-nums">{eur(c.mensualite ?? 0)}</td>
                    <td className="table-td text-xs">{c.devenir ?? '—'}</td>
                  </tr>
                ))}
                <tr className="bg-navy-50/40 font-semibold">
                  <td className="table-td" colSpan={3}>Total</td>
                  <td className="table-td text-right tabular-nums">{eur(totalCreditsCrd)}</td>
                  <td className="table-td text-right tabular-nums">{eur(totalCreditsMens)}</td>
                  <td className="table-td"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Pièces P3 — Patrimoine (${piecesP3.length})`} action={
        <button onClick={() => void reloadPieces()} className="btn-outline text-xs">
          <RefreshCw className={cn('h-3.5 w-3.5', loadingPieces && 'animate-spin')} /> Recharger
        </button>
      }>
        <div className="text-[11px] text-navy-400 mb-2">
          Justificatifs patrimoine : relevés bancaires, livrets, PEL/CEL, titres de propriété, taxe foncière, baux locatifs…
        </div>
        {piecesP3.length === 0 ? (
          <div className="text-sm text-navy-400 italic border border-dashed border-navy-200 rounded-lg p-4 text-center">
            Aucune pièce P3 fournie. Ajoutez-les depuis l'onglet Pièces.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {piecesP3.map((p) => (
              <div key={p.id} className="flex items-center gap-2 p-2 rounded-md border border-navy-100 bg-white hover:bg-navy-50/40 transition-colors text-xs">
                <FileText className="h-4 w-4 text-gold-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-navy-900 truncate">{p.libelle || p.filename}</div>
                  <div className="text-[10px] text-navy-500 truncate">{p.filename} · {(p.sizeBytes / 1024).toFixed(0)} ko</div>
                </div>
                <button
                  onClick={() => void piecesApi.download(p.id, p.filename)}
                  className="btn-icon"
                  title="Télécharger"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Hint client legacy fallback */}
      {client.revenuMensuelNet > 0 && biens.length === 0 && (
        <div className="text-[11px] text-navy-400 italic mt-2">
          Données patrimoine vides ? Vérifiez la saisie via le bouton "Modifier le dossier" en haut.
        </div>
      )}
    </>
  )
}

function PatrimoineKpi({ label, value, hint, accent = 'navy' }: {
  label: string
  value: string
  hint?: string
  accent?: 'navy' | 'gold' | 'emerald' | 'rose'
}) {
  const colorMap: Record<string, string> = {
    navy: 'from-navy-50 to-white text-navy-700',
    gold: 'from-gold-50 to-white text-gold-700',
    emerald: 'from-emerald-50 to-white text-emerald-700',
    rose: 'from-rose-50 to-white text-rose-700',
  }
  return (
    <div className={cn('rounded-xl border border-navy-100 bg-gradient-to-br p-3', colorMap[accent])}>
      <div className="kicker mb-1.5">{label}</div>
      <div className="font-serif text-xl text-navy-900 tabular-nums leading-tight">{value}</div>
      {hint && <div className="text-[11px] text-navy-500 mt-0.5">{hint}</div>}
    </div>
  )
}

/** Affiche un montant ou "Non renseigné" en italique si à 0 */
function MontantField({ label, value }: { label: string; value: number }) {
  const isEmpty = !value || value === 0
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">{label}</span>
      {isEmpty ? (
        <span className="text-sm italic text-navy-300">Non renseigné</span>
      ) : (
        <span className="text-sm font-mono text-navy-900">{eur(value)}</span>
      )}
    </div>
  )
}

/** Mini-badge pour la classe DPE/GES (couleur officielle) */
function DpeBadge({ classe, kind }: { classe?: string; kind: 'dpe' | 'ges' }) {
  if (!classe) return <span className="text-xs italic text-navy-300">—</span>
  const colors: Record<string, string> = {
    A: 'bg-emerald-600 text-white',
    B: 'bg-lime-500 text-white',
    C: 'bg-yellow-400 text-navy-900',
    D: 'bg-amber-500 text-white',
    E: 'bg-orange-500 text-white',
    F: 'bg-red-600 text-white',
    G: 'bg-red-800 text-white',
  }
  return (
    <span className={cn(
      'inline-flex items-center justify-center h-7 w-7 rounded font-bold text-sm shadow-sm',
      colors[classe] ?? 'bg-navy-200 text-navy-700',
    )} title={`Classe ${kind.toUpperCase()} : ${classe}`}>
      {classe}
    </span>
  )
}

function TabProjet({ dossier, onEdit, dossierId }: { dossier: Dossier; onEdit?: () => void; dossierId: string }) {
  const bien = dossier.bienDetails ?? {}

  // Prix retenu pour l'assiette des frais de notaire = coût logement OU montant bien
  const prixBien = dossier.coutLogement || dossier.montantBien || 0

  // Mapping TypeAchat (libellé FR) → NatureBienNotaire (slug interne)
  const natureForNotaire: NatureBienNotaire | null = (() => {
    const t = (dossier.typeAchat ?? '').toLowerCase()
    if (t === 'neuf') return 'neuf'
    if (t === 'vefa') return 'vefa'
    if (t === 'terrain') return 'terrain'
    if (t === 'ancien' || t === 'rachat' || t === 'travaux' || t === 'construction') return 'ancien'
    return null
  })()

  // Détection du département depuis le code postal (5 premiers chiffres du villeBien
  // si format "21000 DIJON", ou via dossier.codePostal si disponible)
  const departement = (() => {
    const ville = dossier.villeBien ?? ''
    const m = ville.match(/\b(\d{5})\b/)
    if (!m) return undefined
    const cp = m[1]!
    // Mayotte = "976xx", Métropole = "XXXxx" → on retourne le département
    if (cp.startsWith('976')) return '976'
    return cp.slice(0, 2)
  })()

  // Calcul des frais notaire détaillés (si possible)
  const notaireDetail = (prixBien > 0 && natureForNotaire)
    ? calcFraisNotaireDetail(prixBien, natureForNotaire, { departement })
    : null

  // Frais notaire — si pas renseignés mais prix+type connus, on estime
  const fraisNotaireStored = dossier.fraisNotaire ?? 0
  const fraisNotaireEstime = fraisNotaireStored === 0 && notaireDetail ? notaireDetail.total : null
  const fraisNotaireEffectif = fraisNotaireStored || fraisNotaireEstime || 0

  const coutTotal =
    (dossier.coutLogement ?? dossier.montantBien ?? 0)
    + (dossier.coutTerrain ?? 0)
    + (dossier.coutTravaux ?? 0)
    + (dossier.coutMobilier ?? 0)
    + (dossier.coutViabilisation ?? 0)
    + fraisNotaireEffectif
    + (dossier.fraisAgence ?? 0)
    + (dossier.fraisEtablissement ?? 0)
    + (dossier.fraisExpertise ?? 0)
    + (dossier.rachatCreditCout ?? 0)

  const isPrixManquant = (dossier.montantBien ?? 0) === 0 && (dossier.coutLogement ?? 0) === 0

  return (
    <>
      {/* Toolbar avec bouton Modifier — visible direct depuis l'onglet */}
      {onEdit && (
        <div className="flex justify-end mb-3">
          <button onClick={onEdit} className="btn-gold text-sm">
            <Pencil className="h-3.5 w-3.5" /> Modifier le projet (prix, apport, travaux, frais…)
          </button>
        </div>
      )}

      {/* Bandeau d'alerte si prix manquant — fréquent en R0 */}
      {isPrixManquant && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-5 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
          <div>
            <strong className="text-amber-950">Prix de vente non renseigné</strong>
            <div className="mt-0.5">L'extract n'a pas pu déterminer le prix du bien (généralement non communiqué avant R1 ou compromis). Clique sur <strong>« Modifier le projet »</strong> ci-dessus pour saisir le prix, l'apport, le coût des travaux, etc.</div>
          </div>
        </div>
      )}

      <Section title="Caractéristiques du projet">
        <div className="grid grid-cols-4 gap-5">
          <Field label="Type de projet" value={dossier.typeProjet || '—'} />
          <Field label="Type d'achat" value={dossier.typeAchat || '—'} />
          <Field label="Destination" value={dossier.destination || '—'} />
          <Field label="Type de logement" value={dossier.typeLogement || '—'} />
          <Field label="Ville" value={dossier.villeBien || '—'} />
          <Field label="Zone PTZ" value={dossier.ptzZone ? `Zone ${dossier.ptzZone}` : '—'} />
          <Field label="Compromis signé" value={dossier.compromisSigne ? 'Oui' : 'Non'} />
          <Field label="Acte prévu le" value={dossier.actePrevuLe ? dateFr(dossier.actePrevuLe) : '—'} />
        </div>
      </Section>

      {/* ─── Bien immobilier détaillé (depuis §5.1 de l'extract) ─── */}
      {(bien.adresseBien || bien.surfaceHabitable || bien.anneeConstruction || bien.vendeur) && (
        <Section title="Le bien">
          <div className="grid grid-cols-4 gap-5 mb-4">
            <Field label="Adresse" value={bien.adresseBien || '—'} />
            <Field label="Type" value={bien.typeBien || '—'} />
            <Field label="Surface habitable" value={bien.surfaceHabitable ? `${bien.surfaceHabitable} m²` : '—'} />
            <Field label="Surface terrain" value={bien.surfaceTerrain ? `${bien.surfaceTerrain} m²` : '—'} />
            <Field label="Nb pièces" value={bien.nbPieces ? String(bien.nbPieces) : '—'} />
            <Field label="Année construction" value={bien.anneeConstruction ? String(bien.anneeConstruction) : '—'} />
            <Field label="Vendeur" value={bien.vendeur || '—'} />
            <Field label="Agence / Apporteur" value={bien.agenceVente || '—'} />
            {bien.notaire && <Field label="Notaire" value={bien.notaire} />}
            {bien.originePropriete && <Field label="Origine de propriété" value={bien.originePropriete} />}
          </div>
        </Section>
      )}

      {/* ─── Performance énergétique (depuis §5.2 et §5.3 de l'extract) ─── */}
      {(bien.dpeClasse || bien.gesClasse || bien.auditEnergetiqueDispo) && (
        <Section title="Performance énergétique">
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-lg bg-ivory border border-navy-100 p-4">
              <div className="text-xs uppercase tracking-wider text-navy-500 font-semibold mb-3">DPE — Étiquette énergie</div>
              <div className="flex items-center gap-3">
                <DpeBadge classe={bien.dpeClasse} kind="dpe" />
                <div>
                  <div className="text-sm font-medium text-navy-900">
                    {bien.dpeConsoKwhM2An ? `${bien.dpeConsoKwhM2An} kWh/m²/an` : 'Conso non renseignée'}
                  </div>
                  {(bien.coutEnergieAnnuelMin || bien.coutEnergieAnnuelMax) && (
                    <div className="text-[11px] text-navy-500 mt-0.5">
                      Coût énergie : {eur(bien.coutEnergieAnnuelMin ?? 0)} à {eur(bien.coutEnergieAnnuelMax ?? 0)} /an
                    </div>
                  )}
                </div>
              </div>
              {bien.dpeClasse === 'F' || bien.dpeClasse === 'G' ? (
                <div className="mt-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  ⚠ Passoire thermique — interdiction location {bien.dpeClasse === 'G' ? '01/01/2025' : '01/01/2028'}
                </div>
              ) : null}
            </div>

            <div className="rounded-lg bg-ivory border border-navy-100 p-4">
              <div className="text-xs uppercase tracking-wider text-navy-500 font-semibold mb-3">GES — Émissions CO₂</div>
              <div className="flex items-center gap-3">
                <DpeBadge classe={bien.gesClasse} kind="ges" />
                <div className="text-sm font-medium text-navy-900">
                  {bien.gesCo2kgM2An ? `${bien.gesCo2kgM2An} kg CO₂/m²/an` : 'GES non renseigné'}
                </div>
              </div>
            </div>
          </div>

          {bien.auditEnergetiqueDispo && (
            <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
              <strong>✓ Audit énergétique disponible</strong>
              {bien.scenarioRenovation && <div className="mt-1">{bien.scenarioRenovation}</div>}
            </div>
          )}

          {bien.diagsManquants && bien.diagsManquants.length > 0 && (
            <div className="mt-3 text-xs text-navy-700">
              <strong className="text-amber-800">Diagnostics manquants :</strong>{' '}
              {bien.diagsManquants.join(', ')}
            </div>
          )}
        </Section>
      )}

      <Section title="Coûts de l'opération">
        <div className="grid grid-cols-4 gap-5">
          <MontantField label="Prix FAI / bien" value={dossier.montantBien ?? 0} />
          <MontantField label="Coût logement" value={dossier.coutLogement ?? 0} />
          <MontantField label="Coût terrain" value={dossier.coutTerrain ?? 0} />
          <MontantField label="Coût travaux" value={dossier.coutTravaux ?? 0} />
          <MontantField label="Coût mobilier" value={dossier.coutMobilier ?? 0} />
          <MontantField label="Viabilisation" value={dossier.coutViabilisation ?? 0} />
          <MontantField label="Rachat crédit" value={dossier.rachatCreditCout ?? 0} />
        </div>
      </Section>

      <Section title="Frais annexes">
        <div className="grid grid-cols-4 gap-5">
          {/* Frais notaire — affiche l'estimation auto si pas renseigné mais prix+type connus */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Frais notaire</span>
            {fraisNotaireStored > 0 ? (
              <span className="text-sm font-mono text-navy-900">{eur(fraisNotaireStored)}</span>
            ) : fraisNotaireEstime != null ? (
              <span className="text-sm font-mono text-gold-700">
                {eur(fraisNotaireEstime)} <span className="text-[10px] italic text-navy-500">(estimé)</span>
              </span>
            ) : (
              <span className="text-sm italic text-navy-300">Non renseigné</span>
            )}
          </div>
          <MontantField label="Frais agence" value={dossier.fraisAgence ?? 0} />
          <MontantField label="Frais établissement" value={dossier.fraisEtablissement ?? 0} />
          <MontantField label="Frais expertise" value={dossier.fraisExpertise ?? 0} />
        </div>

        {/* Décomposition détaillée des frais notaire estimés */}
        {notaireDetail && fraisNotaireStored === 0 && (
          <div className="mt-4 rounded-lg bg-gold-50/40 border border-gold-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] uppercase tracking-wider text-gold-800 font-semibold">
                Détail estimation frais d'acquisition
              </span>
              <span className="text-[10px] text-navy-500 italic">
                ({(notaireDetail.ratioPrix * 100).toFixed(1)} % du prix)
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="rounded bg-white border border-gold-100 p-2">
                <div className="text-[9px] uppercase tracking-wider text-navy-500 font-semibold">Émoluments notaire</div>
                <div className="font-mono font-semibold text-navy-900 mt-0.5">{eur(notaireDetail.emoluments)}</div>
                <div className="text-[9px] text-navy-400 mt-0.5">Barème dégressif + TVA 20 %</div>
              </div>
              <div className="rounded bg-white border border-gold-100 p-2">
                <div className="text-[9px] uppercase tracking-wider text-navy-500 font-semibold">
                  Droits mutation ({(notaireDetail.tauxDmtoAppli * 100).toFixed(3)} %)
                </div>
                <div className="font-mono font-semibold text-navy-900 mt-0.5">{eur(notaireDetail.dmto)}</div>
                <div className="text-[9px] text-navy-400 mt-0.5">
                  {notaireDetail.tauxDmtoAppli === 0.00715 ? 'Neuf / VEFA' :
                   notaireDetail.tauxDmtoAppli === 0.0450 ? `Ancien dépt ${departement} (réduit)` :
                   'Ancien standard'}
                </div>
              </div>
              <div className="rounded bg-white border border-gold-100 p-2">
                <div className="text-[9px] uppercase tracking-wider text-navy-500 font-semibold">CSI (0,10 %)</div>
                <div className="font-mono font-semibold text-navy-900 mt-0.5">{eur(notaireDetail.csi)}</div>
                <div className="text-[9px] text-navy-400 mt-0.5">Sécurité immobilière</div>
              </div>
              <div className="rounded bg-white border border-gold-100 p-2">
                <div className="text-[9px] uppercase tracking-wider text-navy-500 font-semibold">Débours / formalités</div>
                <div className="font-mono font-semibold text-navy-900 mt-0.5">{eur(notaireDetail.debours)}</div>
                <div className="text-[9px] text-navy-400 mt-0.5">Cadastre, urba, état civil</div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-navy-600 italic">
              ℹ️ Estimation conforme barème officiel français (Code de commerce R 444 + DMTO art. 1594D CGI). Valeur indicative à ±2 % — peut varier selon le département (taxes additionnelles), la présence d'une part de mobilier déductible, ou la remise loi Macron (-20 % au-delà de 100 k€, faculté du notaire).
            </div>
          </div>
        )}
      </Section>

      <Section title="Synthèse">
        <div className="grid grid-cols-3 gap-5">
          <div className="rounded-lg bg-ivory border border-navy-100 p-3">
            <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Coût total opération</div>
            {coutTotal > 0 ? (
              <div className="font-serif text-2xl font-bold text-navy-900 tabular-nums mt-1">{eur(coutTotal)}</div>
            ) : (
              <div className="font-serif text-base italic text-navy-300 mt-1">Non calculable</div>
            )}
          </div>
          <div className="rounded-lg bg-ivory border border-navy-100 p-3">
            <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Apport personnel</div>
            <div className="font-serif text-2xl font-bold text-gold-700 tabular-nums mt-1">{eur(dossier.apport ?? 0)}</div>
          </div>
          <div className="rounded-lg bg-ivory border border-navy-100 p-3">
            <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Reste à financer</div>
            {coutTotal > 0 ? (
              <div className="font-serif text-2xl font-bold text-navy-900 tabular-nums mt-1">{eur(Math.max(0, coutTotal - (dossier.apport ?? 0)))}</div>
            ) : (
              <div className="font-serif text-base italic text-navy-300 mt-1">À calculer</div>
            )}
          </div>
        </div>
      </Section>

      {/* Pièces P4 — projet (compromis, DPE, devis travaux, mandat de vente) */}
      <PiecesParCategorie dossierId={dossierId} categorie="P4" />
    </>
  )
}

function TabFinancement({ dossier }: { dossier: Dossier }) {
  const allPrets = useStore((s) => s.prets)
  const banques = useStore((s) => s.banques)
  const addPret = useStore((s) => s.addPret)
  const updatePret = useStore((s) => s.updatePret)
  const deletePret = useStore((s) => s.deletePret)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPret, setEditingPret] = useState<import('@/data/mock').Pret | undefined>(undefined)
  const [planOpen, setPlanOpen] = useState(false)
  const [importSimOpen, setImportSimOpen] = useState(false)
  const [importSimText, setImportSimText] = useState('')
  const [importSimPdf, setImportSimPdf] = useState<File | null>(null)
  const [importSimMode, setImportSimMode] = useState<'pdf' | 'text'>('pdf')
  const [importingSim, setImportingSim] = useState(false)

  const handleImportSimulation = async () => {
    setImportingSim(true)
    const t = toast.loading(importSimMode === 'pdf'
      ? `Analyse de ${importSimPdf?.name ?? 'la DDP'} par Claude Opus…`
      : 'Analyse du plan de financement Cifacil…')
    try {
      let res: import('@/db/api').ImportSimulationResult
      if (importSimMode === 'pdf') {
        if (!importSimPdf) {
          toast.error('Sélectionne d\'abord un PDF Cifacil', { id: t })
          return
        }
        res = await importSimulationApi.runPdf(dossier.id, importSimPdf)
      } else {
        const txt = importSimText.trim()
        if (txt.length < 50) {
          toast.error('Texte trop court — colle le contenu intégral du AA summary simulation.txt', { id: t })
          return
        }
        res = await importSimulationApi.run(dossier.id, txt)
      }
      toast.success(`${res.pretsCrees.length} prêt(s) importé(s)`, {
        id: t,
        description: `${res.banquePortante || 'banque inconnue'} · ${res.usage.estimatedCostEur.toFixed(3)} €`,
      })
      // Re-pull pour récupérer les nouveaux prêts dans le store
      const { sync } = await import('@/db/api')
      await sync.pullAll().catch(() => { /* silencieux */ })
      setImportSimText('')
      setImportSimPdf(null)
      setImportSimOpen(false)
    } catch (e) {
      toast.error('Échec de l\'import', { id: t, description: e instanceof Error ? e.message : String(e) })
    } finally {
      setImportingSim(false)
    }
  }

  const prets = useMemo(
    () => allPrets.filter((p) => p.dossierId === dossier.id).sort((a, b) => a.rang - b.rang),
    [allPrets, dossier.id],
  )

  // Mensualités effectives (recalculées si stockage obsolète) — clé pour fixer
  // le bug "la mensualité totale ne change pas quand on modifie le montant".
  const pretsWithMens = useMemo(
    () => prets.map((p) => ({ ...p, _eff: effectiveMensualite(p) })),
    [prets],
  )

  // Agrégats
  const totalEmprunte = prets.reduce((s, p) => s + (p.montant ?? 0), 0)
  const mensualiteTotale = pretsWithMens.reduce((s, p) => s + p._eff.totale, 0)
  const dureeMaxMois = prets.reduce((m, p) => Math.max(m, p.dureeMois), 0)
  // Coût total approximatif : somme(mensualités * durée) - capital total
  const coutTotalCredit = pretsWithMens.reduce((s, p) => {
    const m = p._eff.totale
    const cout = m * p.dureeMois - p.montant
    return s + Math.max(0, cout)
  }, 0)

  const coutOperation =
    (dossier.coutLogement ?? dossier.montantBien) +
    (dossier.coutTerrain ?? 0) +
    (dossier.coutTravaux ?? 0) +
    (dossier.fraisNotaire ?? 0) +
    (dossier.fraisAgence ?? 0)
  const ressources = totalEmprunte + (dossier.apport ?? 0)
  const ecart = ressources - coutOperation

  const openNew = () => { setEditingPret(undefined); setEditorOpen(true) }
  const openEdit = (p: import('@/data/mock').Pret) => { setEditingPret(p); setEditorOpen(true) }

  const handleSave = (data: import('@/data/mock').Pret | Omit<import('@/data/mock').Pret, 'id' | 'createdAt' | 'updatedAt'>) => {
    if ('id' in data) {
      updatePret(data.id, data)
      toast.success('Prêt mis à jour')
    } else {
      addPret(data)
      toast.success('Prêt ajouté')
    }
    setEditorOpen(false)
    setEditingPret(undefined)
  }

  const handleDelete = () => {
    if (!editingPret) return
    deletePret(editingPret.id)
    toast.success('Prêt supprimé')
    setEditorOpen(false)
    setEditingPret(undefined)
  }

  return (
    <>
      <Section title="Plan de financement">
        <div className="grid grid-cols-4 gap-5">
          <Field label="Coût opération" value={eur(coutOperation)} />
          <Field label="Apport personnel" value={eur(dossier.apport)} />
          <Field label="Total emprunté" value={eur(totalEmprunte)} />
          <Field label="LTV" value={dossier.montantBien > 0 ? pct(totalEmprunte / dossier.montantBien, 0) : '—'} />
          <Field label="Mensualité totale (av. ass.)" value={eur(mensualiteTotale)} />
          <Field label="Durée max" value={dureeMaxMois > 0 ? `${(dureeMaxMois / 12).toFixed(1)} ans` : '—'} />
          <Field
            label={ecart === 0 ? 'Équilibre' : ecart > 0 ? 'Surplus' : 'Manque'}
            value={eur(Math.abs(ecart))}
          />
          <Field label="Coût total crédit" value={eur(coutTotalCredit)} />
        </div>
      </Section>

      <Section
        title={`Prêts (${prets.length})`}
        action={
          <div className="flex gap-2">
            <button className="btn-outline text-xs" onClick={() => setImportSimOpen(true)}
              title="Coller le contenu d'un AA summary simulation.txt pour importer les prêts Cifacil">
              <Upload className="h-3.5 w-3.5" /> Importer Cifacil
            </button>
            <button className="btn-outline text-xs" onClick={() => setPlanOpen(true)} disabled={prets.length === 0}>
              <Sparkles className="h-3.5 w-3.5" /> Construire le plan
            </button>
            <button className="btn-gold text-xs" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> Ajouter un prêt
            </button>
          </div>
        }
      >
        {prets.length === 0 ? (
          <div className="py-8 text-center text-sm text-navy-400 italic">
            Aucun prêt dans ce dossier — cliquez sur « Ajouter un prêt » pour composer le plan de financement.
          </div>
        ) : (
          <div className="rounded-lg border border-navy-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th w-32">Type</th>
                  <th className="table-th">Banque</th>
                  <th className="table-th text-right">Montant</th>
                  <th className="table-th text-center">Durée</th>
                  <th className="table-th text-right">Taux</th>
                  <th className="table-th text-right">TAEG</th>
                  <th className="table-th text-right">TAEA</th>
                  <th className="table-th text-right">Mens. tot.</th>
                  <th className="table-th text-center">Statut</th>
                  <th className="table-th w-10"></th>
                </tr>
              </thead>
              <tbody className="list-fast">
                {prets.map((p) => {
                  const couleur = pretCouleur(p)
                  return (
                  <tr
                    key={p.id}
                    onClick={() => openEdit(p)}
                    className="hover:bg-navy-50/60 transition-colors duration-150 cursor-pointer"
                  >
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0 ring-1 ring-black/5"
                          style={{ backgroundColor: couleur }}
                          title="Couleur dans le graphique"
                        />
                        <span className="badge-navy text-[10px]">
                          {pretTypeShort(p.type)}
                        </span>
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="font-medium">{p.banque ?? '—'}</div>
                      {p.libelle && <div className="text-[11px] text-navy-500 truncate">{p.libelle}</div>}
                    </td>
                    <td className="table-td text-right font-mono">{eur(p.montant)}</td>
                    <td className="table-td text-center text-xs text-navy-600">{(p.dureeMois / 12).toFixed(1)} ans</td>
                    <td className="table-td text-right font-mono text-xs">
                      {p.tauxNominal != null ? pct(p.tauxNominal / 100, 2) : '—'}
                    </td>
                    <td className="table-td text-right font-mono text-xs">
                      {(() => {
                        const eff = effectiveMensualite(p)
                        const fraisInit = (p.fraisDossier ?? 0) + (p.fraisBanque ?? 0) + (p.garantieMontant ?? 0)
                        const taeg = eff.horsAssurance > 0 ? calcTAEG(p.montant, eff.horsAssurance, p.dureeMois, fraisInit) : 0
                        return taeg > 0 ? `${taeg.toFixed(2)} %` : '—'
                      })()}
                    </td>
                    <td className="table-td text-right font-mono text-xs text-navy-500">
                      {(() => {
                        const eff = effectiveMensualite(p)
                        const fraisInit = (p.fraisDossier ?? 0) + (p.fraisBanque ?? 0) + (p.garantieMontant ?? 0)
                        const taea = eff.assurance > 0 ? calcTAEA(p.montant, eff.horsAssurance, eff.assurance, p.dureeMois, fraisInit) : 0
                        return taea > 0 ? `${taea.toFixed(2)} %` : '—'
                      })()}
                    </td>
                    <td className="table-td text-right font-mono text-xs text-gold-700">
                      {effectiveMensualite(p).totale > 0 ? eur(effectiveMensualite(p).totale) : '—'}
                    </td>
                    <td className="table-td text-center text-[11px]">
                      <PretStatutPill statut={p.statut} />
                    </td>
                    <td className="table-td text-navy-300">
                      <Pencil className="h-3.5 w-3.5" />
                    </td>
                  </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-ivory border-t-2 border-navy-200">
                  <td className="table-td font-semibold text-navy-900" colSpan={2}>Total</td>
                  <td className="table-td text-right font-mono font-bold">{eur(totalEmprunte)}</td>
                  <td className="table-td"></td>
                  <td className="table-td"></td>
                  <td className="table-td"></td>
                  <td className="table-td"></td>
                  <td className="table-td text-right font-mono font-bold text-gold-700">{eur(mensualiteTotale)}</td>
                  <td className="table-td"></td>
                  <td className="table-td"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>

      {/* ─── Comparateur d'offres bancaires (visible si ≥ 2 banques) ─── */}
      {prets.length >= 2 && (
        <div className="mt-5">
          <OffresComparateur prets={prets} />
        </div>
      )}

      <PretEditor
        open={editorOpen}
        pret={editingPret}
        dossierId={dossier.id}
        defaultRang={prets.length}
        banques={banques}
        dossier={dossier}
        onClose={() => { setEditorOpen(false); setEditingPret(undefined) }}
        onSave={handleSave}
        onDelete={editingPret ? handleDelete : undefined}
      />

      <PlanFinancementModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        dossier={dossier}
        onAddPret={() => { setPlanOpen(false); openNew() }}
        onEditPret={(p) => { setPlanOpen(false); openEdit(p) }}
      />

      {/* Modal d'import du plan de financement Cifacil */}
      <Modal
        open={importSimOpen}
        onClose={() => !importingSim && setImportSimOpen(false)}
        title="Importer un plan de financement Cifacil"
        size="lg"
      >
        <div className="space-y-4">
          {/* Toggle mode */}
          <div className="inline-flex rounded-lg border border-navy-200 p-0.5 bg-navy-50">
            <button type="button"
              onClick={() => setImportSimMode('pdf')}
              disabled={importingSim}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition',
                importSimMode === 'pdf' ? 'bg-white shadow-sm text-navy-900' : 'text-navy-500 hover:text-navy-700',
              )}>
              <FileText className="h-3.5 w-3.5 inline mr-1" /> DDP Cifacil (PDF) — recommandé
            </button>
            <button type="button"
              onClick={() => setImportSimMode('text')}
              disabled={importingSim}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition',
                importSimMode === 'text' ? 'bg-white shadow-sm text-navy-900' : 'text-navy-500 hover:text-navy-700',
              )}>
              Texte (AA summary simulation.txt)
            </button>
          </div>

          {importSimMode === 'pdf' ? (
            <>
              <div className="text-sm text-navy-700">
                Sélectionne directement la DDP Cifacil au format PDF (ex.
                <code className="mx-1 px-1.5 py-0.5 bg-navy-50 rounded text-xs font-mono">P0 - CIFACIL R1.pdf</code>
                ). Claude Opus 4.7 va la lire et extraire automatiquement les prêts, frais et garanties.
              </div>
              <label className="block">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setImportSimPdf(e.target.files?.[0] ?? null)}
                  disabled={importingSim}
                  className="block w-full text-sm text-navy-700
                    file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                    file:bg-gold-100 file:text-gold-800 file:font-medium
                    hover:file:bg-gold-200 file:cursor-pointer
                    disabled:opacity-50"
                />
              </label>
              {importSimPdf && (
                <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">{importSimPdf.name}</span>
                  <span className="text-emerald-600">· {(importSimPdf.size / 1024).toFixed(0)} Ko</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm text-navy-700">
                Colle ci-dessous le contenu intégral du fichier
                <code className="mx-1 px-1.5 py-0.5 bg-navy-50 rounded text-xs font-mono">AA summary simulation.txt</code>
                produit par le skill <code className="text-xs font-mono">/dossier-extract-simulation</code> sur OneDrive.
              </div>
              <textarea
                className="w-full rounded-md border border-navy-200 px-3 py-2 font-mono text-xs text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-500 disabled:opacity-50 disabled:cursor-not-allowed"
                rows={12}
                placeholder="§0 BANQUE PORTANT LE DOSSIER : CEBFC&#10;§0.1 PLAN DE FINANCEMENT DÉTAILLÉ&#10;| # | Type | Montant | Taux | Durée | Mensualité | Nature |&#10;..."
                value={importSimText}
                onChange={(e) => setImportSimText(e.target.value)}
                disabled={importingSim}
              />
              <div className="text-xs text-navy-500">{importSimText.length} caractères</div>
            </>
          )}

          {prets.length > 0 && (
            <div className="text-xs text-amber-700 inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {prets.length} prêt(s) déjà présent(s) — les nouveaux seront ajoutés à la suite
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-navy-100">
            <button className="btn-outline text-sm" onClick={() => setImportSimOpen(false)} disabled={importingSim}>
              Annuler
            </button>
            <button className="btn-gold text-sm" onClick={handleImportSimulation}
              disabled={importingSim
                || (importSimMode === 'pdf' && !importSimPdf)
                || (importSimMode === 'text' && importSimText.trim().length < 50)}>
              {importingSim ? (
                <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Analyse en cours…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Analyser et importer</>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function pretTypeShort(t: import('@/data/mock').PretType): string {
  const map: Record<import('@/data/mock').PretType, string> = {
    amortissable: 'Amort.',
    ptz: 'PTZ',
    action_logement: 'Action Log.',
    epargne_logement: 'PEL/CEL',
    relais: 'Relais',
    in_fine: 'In Fine',
    lissage: 'Lissage',
  }
  return map[t]
}

function PretStatutPill({ statut }: { statut: import('@/data/mock').PretStatut }) {
  const map: Record<import('@/data/mock').PretStatut, string> = {
    propose: 'badge-navy',
    accorde: 'badge-success',
    offre_editee: 'badge-gold',
    signe: 'badge-success',
    refuse: 'badge-danger',
    abandonne: 'badge-warning',
  }
  const labels: Record<import('@/data/mock').PretStatut, string> = {
    propose: 'Proposé',
    accorde: 'Accordé',
    offre_editee: 'Offre éditée',
    signe: 'Signé',
    refuse: 'Refusé',
    abandonne: 'Abandonné',
  }
  return <span className={`badge ${map[statut]}`}>{labels[statut]}</span>
}

function TabPieces({ dossier }: { dossier: Dossier }) {
  const updateDossier = useStore((s) => s.updateDossier)
  const allDossiers = useStore((s) => s.dossiers)
  const settings = useStore((s) => s.settings)
  const { currentUser } = useAuth()
  const o365Email = getO365EmailFor(settings, currentUser?.id)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [items, setItems] = useState<drive.DriveItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (folderId: string, driveId?: string) => {
    console.log('[TabPieces] load', { folderId, driveId })
    setLoading(true)
    setError(null)
    try {
      const list = await drive.listChildren(folderId, driveId)
      console.log('[TabPieces] loaded', list.length, 'items')
      setItems(list)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[TabPieces] load failed', msg)
      const needsReauth = msg.includes('consent') || msg.includes('Files.Read') ||
        msg.includes('403') || msg.includes('401') || msg.includes('Non connecté')
      setError(needsReauth
        ? 'Reconnectez votre compte Microsoft (Paramètres → Intégrations) pour autoriser l\'accès aux fichiers partagés.'
        : msg.slice(0, 200))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!dossier.oneDriveFolderId) {
      setItems([])
      return
    }
    if (!o365Email) {
      // Lié mais pas de session O365 active — on n'efface pas pour ne pas masquer
      // l'état précédent, mais on ne tente pas le fetch.
      return
    }
    void load(dossier.oneDriveFolderId, dossier.oneDriveDriveId)
  }, [dossier.oneDriveFolderId, dossier.oneDriveDriveId, o365Email, load])

  const handleSelectFolder = async (sel: OneDriveSelection) => {
    // Garde-fou : avertir si le même folder OneDrive est déjà lié à un autre
    // dossier de courtage — sinon on voit les pièces d'autres clients dans
    // l'onglet Pièces (cause classique de confusion).
    const conflict = allDossiers.find((d) => d.id !== dossier.id && d.oneDriveFolderId === sel.id)
    if (conflict) {
      const ok = await confirmDialog(
        `⚠️ Ce dossier OneDrive est déjà lié au dossier ${conflict.ref} (${conflict.clientNom}).\n\n` +
        `Si tu confirmes, les pièces apparaîtront dans les DEUX dossiers Apolline.\n\n` +
        `Continuer quand même ?`,
        { title: 'Conflit OneDrive', kind: 'warning' },
      )
      if (!ok) return
    }
    updateDossier(dossier.id, {
      oneDriveFolderId: sel.id,
      oneDriveDriveId: sel.driveId,
      oneDriveFolderName: sel.name,
      oneDriveFolderPath: sel.path,
      oneDriveFolderWebUrl: sel.webUrl,
    })
    toast.success('Dossier OneDrive associé', { description: sel.path })
  }

  const handleDetach = () => {
    // null (pas undefined) pour que le patch soit envoyé au backend et que la
    // colonne soit bien clear-ée — les undefined sont strippés par JSON.stringify.
    updateDossier(dossier.id, {
      oneDriveFolderId: null as unknown as undefined,
      oneDriveDriveId: null as unknown as undefined,
      oneDriveFolderName: null as unknown as undefined,
      oneDriveFolderPath: null as unknown as undefined,
      oneDriveFolderWebUrl: null as unknown as undefined,
    })
    setItems([])
    setError(null)
    toast.success('Dossier OneDrive détaché')
  }

  const handleDownload = async (item: drive.DriveItem) => {
    const t = toast.loading(`Téléchargement de ${item.name}…`)
    try {
      const ref = drive.effectiveRef(item)
      const url = await drive.getDownloadUrl(ref.id, ref.driveId)
      if (!url) throw new Error('URL indisponible')
      window.open(url, '_blank')
      toast.success(`${item.name} prêt`, { id: t })
    } catch (e: any) {
      toast.error('Échec téléchargement', { id: t, description: e?.message })
    }
  }

  const isLinked = !!dossier.oneDriveFolderId
  const allFiles = items.filter((i) => !drive.isFolder(i))
  const subfolders = items.filter((i) => drive.isFolder(i))
  const filesByCat: Record<'P1' | 'P2' | 'P3' | 'P4' | 'P5', drive.DriveItem[]> = {
    P1: [], P2: [], P3: [], P4: [], P5: [],
  }
  const unclassified: drive.DriveItem[] = []
  for (const f of allFiles) {
    const cat = drive.categoryFromFilename(f.name)
    if (cat) filesByCat[cat].push(f)
    else unclassified.push(f)
  }

  if (!isLinked) {
    return (
      <>
        <div className="card p-8 text-center space-y-3">
          <FolderOpen className="h-12 w-12 mx-auto text-navy-300" />
          <div>
            <div className="font-semibold text-navy-900">Aucun dossier OneDrive associé</div>
            <div className="text-xs text-navy-500 mt-1">
              Associez le dossier OneDrive du client pour voir ses pièces ici automatiquement.
            </div>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            disabled={!o365Email}
            className="btn-gold inline-flex"
            title={!o365Email ? 'Connectez d\'abord Microsoft 365 (Paramètres → Intégrations)' : ''}
          >
            <LinkIcon className="h-4 w-4" /> Associer un dossier OneDrive
          </button>
          {!o365Email && (
            <div className="text-[11px] text-amber-700">
              Connectez d'abord Microsoft 365 dans Paramètres → Intégrations.
            </div>
          )}
        </div>
        <OneDriveFolderPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleSelectFolder} />
      </>
    )
  }

  return (
    <>
      {/* En-tête lien OneDrive */}
      <div className="card p-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FolderOpen className="h-4 w-4 text-gold-600 shrink-0" />
          <span className="text-xs text-navy-500 shrink-0">Lié à :</span>
          <span className="text-xs font-medium text-navy-900 truncate" title={dossier.oneDriveFolderPath}>
            {dossier.oneDriveFolderName ?? dossier.oneDriveFolderId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {dossier.oneDriveFolderWebUrl && (
            <a href={dossier.oneDriveFolderWebUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold text-gold-700 hover:text-gold-800 inline-flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5" /> Ouvrir
            </a>
          )}
          <button onClick={() => dossier.oneDriveFolderId && load(dossier.oneDriveFolderId, dossier.oneDriveDriveId)}
            className="text-xs text-navy-600 hover:text-navy-900 inline-flex items-center gap-1">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {loading ? 'Sync…' : 'Actualiser'}
          </button>
          <button onClick={() => setPickerOpen(true)}
            className="text-xs text-navy-500 hover:text-navy-900 inline-flex items-center gap-1">
            Modifier
          </button>
          <button onClick={handleDetach}
            className="text-xs text-rose-700 hover:text-rose-900 inline-flex items-center gap-1"
            title="Détacher le dossier OneDrive">
            Détacher
          </button>
        </div>
      </div>

      {!o365Email && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 mb-4">
          <div className="font-semibold">Microsoft 365 non connecté</div>
          <div className="mt-0.5">Connectez votre compte Microsoft depuis Paramètres → Intégrations pour voir les pièces de ce dossier.</div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 mb-4">
          <div className="font-semibold">Impossible de charger</div>
          <div className="mt-0.5">{error}</div>
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="card p-6 mb-4 text-center text-sm text-navy-500 flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Chargement des pièces depuis OneDrive…
        </div>
      )}

      {!loading && !error && o365Email && items.length === 0 && (
        <div className="card p-6 mb-4 text-center text-sm text-navy-500">
          <FolderOpen className="h-8 w-8 mx-auto text-navy-300 mb-2" />
          Le dossier OneDrive est vide.
          <div className="text-[11px] text-navy-400 mt-1">
            Ajoutez les pièces du client directement dans OneDrive (préfixées <code>P1_</code>, <code>P2_</code>…) puis cliquez sur « Actualiser ».
          </div>
        </div>
      )}

      <div className="space-y-4">
        {(['P1', 'P2', 'P3', 'P4', 'P5'] as const).map((cat) => {
          const catItems = filesByCat[cat]
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs font-bold text-gold-700">{cat}</span>
                <span className="text-sm font-semibold text-navy-900">{piecesByCategorie[cat]}</span>
                <span className="text-xs text-navy-400">· {catItems.length}</span>
              </div>
              <div className="rounded-lg border border-navy-100 divide-y divide-navy-50 overflow-hidden">
                {catItems.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-navy-400 italic">Aucune pièce dans cette catégorie</div>
                ) : (
                  catItems.map((item) => {
                    const modified = drive.lastModifiedOf(item)
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-navy-50/50">
                        <FileText className="h-4 w-4 text-gold-600" />
                        <div className="flex-1 text-sm text-navy-800 truncate" title={item.name}>{item.name}</div>
                        <span className="text-[11px] text-navy-400 shrink-0">{drive.formatSize(drive.sizeOf(item))}</span>
                        {modified && <span className="text-[11px] text-navy-400 shrink-0">{dateFr(modified)}</span>}
                        <button onClick={() => void handleDownload(item)} className="text-navy-400 hover:text-navy-900"
                          title="Télécharger">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}

        {unclassified.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">?</span>
              <span className="text-sm font-semibold text-navy-900">Sans préfixe P1-P5</span>
              <span className="text-xs text-navy-400">· {unclassified.length}</span>
            </div>
            <div className="rounded-lg border border-amber-200 divide-y divide-amber-50 overflow-hidden">
              {unclassified.map((item) => {
                const modified = drive.lastModifiedOf(item)
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/50">
                    <FileText className="h-4 w-4 text-amber-600" />
                    <div className="flex-1 text-sm text-navy-800 truncate" title={item.name}>{item.name}</div>
                    <span className="text-[11px] text-navy-400 shrink-0">{drive.formatSize(drive.sizeOf(item))}</span>
                    {modified && <span className="text-[11px] text-navy-400 shrink-0">{dateFr(modified)}</span>}
                    <button onClick={() => void handleDownload(item)} className="text-navy-400 hover:text-navy-900"
                      title="Télécharger">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {subfolders.length > 0 && (
          <div className="text-[11px] text-navy-400 italic px-1">
            Note : {subfolders.length} sous-dossier{subfolders.length > 1 ? 's' : ''} ignoré{subfolders.length > 1 ? 's' : ''} dans le listing — naviguez sur OneDrive directement pour les voir.
          </div>
        )}
      </div>

      <OneDriveFolderPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleSelectFolder} />
    </>
  )
}

function TabNotes({ dossierId }: { dossierId: string }) {
  const allNotes = useStore((s) => s.notes)
  const notes = useMemo(() => allNotes.filter((n) => n.dossierId === dossierId), [allNotes, dossierId])
  const addNote = useStore((s) => s.addNote)
  const deleteNote = useStore((s) => s.deleteNote)
  const { currentUser } = useAuth()
  const [content, setContent] = useState('')

  const save = () => {
    if (!content.trim() || !currentUser) return
    addNote(dossierId, currentUser.id, `${currentUser.prenom} ${currentUser.nom}`, content.trim())
    setContent('')
    toast.success('Note enregistrée')
  }

  return (
    <Section title={`Notes internes — ${notes.length}`}>
      <div className="space-y-3 mb-4">
        {notes.length === 0 && (
          <div className="text-sm text-navy-400 italic">Aucune note pour ce dossier.</div>
        )}
        {notes.map((n) => (
          <div key={n.id} className="group rounded-lg bg-ivory border border-navy-100 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-navy-900">{dateTimeFr(n.date)}</div>
                <div className="text-[11px] text-navy-500">{n.auteurNom}</div>
              </div>
              <button
                onClick={() => {
                  deleteNote(n.id)
                  toast.success('Note supprimée')
                }}
                className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-md hover:bg-rose-50 flex items-center justify-center text-navy-400 hover:text-rose-700 transition"
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-sm text-navy-700 whitespace-pre-wrap">{n.contenu}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-navy-100 pt-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ajouter une note…"
          className="input min-h-[90px]"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-navy-400">Visible par toute l'équipe · {content.length} caractères</span>
          <button className="btn-primary" onClick={save} disabled={!content.trim()}>
            Enregistrer la note
          </button>
        </div>
      </div>
    </Section>
  )
}

function TabMessages({ clientEmail, clientNom, dossierRef }: { clientEmail: string; clientNom: string; dossierRef: string }) {
  const navigate = useNavigate()
  const settings = useStore((s) => s.settings)
  const { currentUser } = useAuth()
  const o365Email = getO365EmailFor(settings, currentUser?.id)
  const [messages, setMessages] = useState<GraphMail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isConnected = !!o365Email
  const hasEmail = !!clientEmail && clientEmail.includes('@')

  const load = useCallback(async () => {
    if (!isConnected || !hasEmail) return
    setLoading(true)
    setError(null)
    try {
      // Recherche tous les messages échangés avec cet email (boîte entière, pas seulement Inbox)
      const data = await mailGraph.listMessages({ search: clientEmail, top: 100 })
      // Tri par date desc côté client (Graph $search ne supporte pas $orderby)
      data.sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime())
      setMessages(data)
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [isConnected, hasEmail, clientEmail])

  useEffect(() => { load() }, [load])

  if (!isConnected) {
    return (
      <div className="text-sm text-navy-500 p-6 text-center">
        <Mail className="h-8 w-8 mx-auto mb-3 text-navy-300" />
        Connectez-vous à Microsoft 365 dans <button className="text-gold-700 underline" onClick={() => navigate('/parametres')}>Paramètres → Intégrations</button> pour voir les emails liés à ce dossier.
      </div>
    )
  }

  if (!hasEmail) {
    return (
      <div className="text-sm text-navy-500 p-6 text-center">
        Aucune adresse email renseignée pour ce client. Renseignez son email dans l'onglet État civil pour activer le suivi des emails.
      </div>
    )
  }

  return (
    <Section title={`Échanges avec ${clientEmail} — ${messages.length} message${messages.length > 1 ? 's' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-navy-500">
          Affiche tous les emails (reçus &amp; envoyés) qui mentionnent <span className="font-mono">{clientEmail}</span>.
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-xs" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Rafraîchir
          </button>
          <button
            className="btn-outline text-xs"
            onClick={() => navigate(`/messagerie?compose=1&to=${encodeURIComponent(clientEmail)}&dossier=${encodeURIComponent(dossierRef)}`)}
          >
            <Reply className="h-3.5 w-3.5" /> Écrire à {clientNom.split(' ')[0]}
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 bg-rose-50 border border-rose-200 text-sm text-rose-700 mb-3">
          {error}
        </div>
      )}

      {!loading && !error && messages.length === 0 && (
        <div className="text-sm text-navy-500 p-6 text-center italic">
          Aucun email échangé avec {clientEmail} pour le moment.
        </div>
      )}

      <div className="space-y-2">
        {messages.map((m) => {
          const fromName = m.from?.emailAddress.name || m.from?.emailAddress.address || '—'
          const isOutgoing = m.from?.emailAddress.address?.toLowerCase() === o365Email?.toLowerCase()
          return (
            <div key={m.id} className="rounded-lg border border-navy-100 hover:border-gold-300 hover:bg-gold-50/30 p-3 transition group">
              <div className="flex items-start gap-3">
                <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                  isOutgoing ? 'bg-gold-100 text-gold-800' : 'bg-navy-100 text-navy-700')}>
                  {m.isRead ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-navy-900 truncate">
                      {isOutgoing ? `Vous → ${m.toRecipients?.[0]?.emailAddress.name || m.toRecipients?.[0]?.emailAddress.address}` : fromName}
                    </span>
                    {m.hasAttachments && <Paperclip className="h-3 w-3 text-navy-400" />}
                    {m.importance === 'high' && <span className="badge-danger text-[9px]">Important</span>}
                    <span className="ml-auto text-[11px] text-navy-400">{dateTimeFr(m.receivedDateTime)}</span>
                  </div>
                  <div className="text-sm text-navy-800 truncate font-medium">{m.subject || '(Sans objet)'}</div>
                  <div className="text-xs text-navy-500 truncate mt-0.5">{m.bodyPreview}</div>
                </div>
                <button
                  onClick={() => navigate(`/messagerie?msg=${encodeURIComponent(m.id)}`)}
                  className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-md hover:bg-white flex items-center justify-center text-navy-400 hover:text-gold-700 transition"
                  title="Ouvrir dans la messagerie"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

/* ─────────────────────── Onglet Factures ─────────────────────── */
function TabFactures({ dossierId }: { dossierId: string }) {
  const navigate = useNavigate()
  const [list, setList] = useState<Facture[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Facture | null>(null)

  const eur2 = (cents: number) => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const { factures } = await facturesApi.byDossier(dossierId)
      setList(factures)
    } catch (e) {
      toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }, [dossierId])

  useEffect(() => { void reload() }, [reload])

  // Stats locales : ventilation par type
  const totals = useMemo(() => {
    const t = { honoraires: 0, comm_banque: 0, comm_autre: 0, ristourne: 0, regle: 0 }
    for (const f of list) {
      if (f.statut === 'annulee') continue
      const sign = f.type.startsWith('avoir_') ? -1 : 1
      const baseType = f.type.replace('avoir_', '') as 'honoraires' | 'comm_banque' | 'comm_autre' | 'ristourne'
      if (baseType in t) t[baseType] += sign * f.montantTtc
      t.regle += sign * f.montantRegle
    }
    return t
  }, [list])

  const onRegler = async (f: Facture) => {
    if (!await confirmDialog(`Marquer ${f.ref} comme réglée pour ${eur2(f.montantTtc)} ?`, { title: 'Régler la facture', kind: 'info' })) return
    try {
      await facturesApi.regler(f.id, { regleeLe: new Date().toISOString() })
      toast.success(`${f.ref} réglée`)
      void reload()
    } catch (e) { toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) }) }
  }

  const onAvoir = async (f: Facture) => {
    // TODO: remplacer prompt() (cassé dans Tauri) par une vraie modale input.
    // Pour l'instant on demande confirmation simple — le motif sera géré manuel.
    if (!await confirmDialog(`Créer un avoir sur la facture ${f.ref} ?`, { title: 'Avoir', kind: 'warning' })) return
    try {
      await facturesApi.avoir(f.id, { motif: 'À préciser' })
      toast.success(`Avoir créé`, { description: 'Tu peux modifier le motif en ouvrant l\'avoir' })
      void reload()
    } catch (e) { toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) }) }
  }

  const onAnnuler = async (f: Facture) => {
    if (!await confirmDialog(`Annuler ${f.ref} ? (statut → annulée)`, { title: 'Annuler la facture', kind: 'warning' })) return
    try {
      await facturesApi.cancel(f.id)
      toast.success(`${f.ref} annulée`)
      void reload()
    } catch (e) { toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) }) }
  }

  return (
    <Section title="Factures et avoirs" action={
      <button className="btn-gold" onClick={() => { setEditing(null); setShowForm(true) }}>
        <Plus className="h-4 w-4" /> Ajouter une facture
      </button>
    }>
      {/* Mini-récap des totaux */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <MiniTotal label="Honoraires" value={eur2(totals.honoraires)} />
        <MiniTotal label="Comm. banque" value={eur2(totals.comm_banque)} />
        <MiniTotal label="Comm. autres" value={eur2(totals.comm_autre)} />
        <MiniTotal label="Ristournes" value={eur2(totals.ristourne)} accent="navy" />
      </div>

      {list.length === 0 ? (
        <div className="text-center py-10 text-sm text-navy-400 italic border border-dashed border-navy-200 rounded-lg">
          {loading ? 'Chargement…' : 'Aucune facture sur ce dossier. Cliquez sur "+ Ajouter une facture" pour démarrer.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-th">N°</th>
                <th className="table-th">Type</th>
                <th className="table-th">Partenaire</th>
                <th className="table-th">Émise</th>
                <th className="table-th">Échéance</th>
                <th className="table-th text-right">TTC</th>
                <th className="table-th">Statut</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <tr key={f.id} className="hover:bg-navy-50/40 group">
                  <td className="table-td font-mono text-xs">{f.ref}</td>
                  <td className="table-td"><StatusBadge variant="facture-type" type={f.type} size="sm" /></td>
                  <td className="table-td truncate max-w-[180px]">{f.partenaireNom ?? '—'}</td>
                  <td className="table-td text-xs text-navy-600">{f.emiseLe ? dateFr(f.emiseLe) : '—'}</td>
                  <td className="table-td text-xs text-navy-600">{f.echeanceLe ? dateFr(f.echeanceLe) : '—'}</td>
                  <td className="table-td text-right font-semibold tabular-nums">{eur2(f.montantTtc)}</td>
                  <td className="table-td"><StatusBadge variant="facture" statut={f.statut} size="sm" /></td>
                  <td className="table-td text-right">
                    <div className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(f); setShowForm(true) }} className="btn-icon" title="Voir / modifier"><Eye className="h-3.5 w-3.5" /></button>
                      {(f.statut === 'emise' || f.statut === 'reglee_partiel') && (
                        <button onClick={() => void onRegler(f)} className="btn-icon text-emerald-600 hover:bg-emerald-50" title="Marquer réglée"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                      )}
                      {!f.type.startsWith('avoir_') && f.statut !== 'avoir_emis' && f.statut !== 'annulee' && (
                        <button onClick={() => void onAvoir(f)} className="btn-icon text-violet-600 hover:bg-violet-50" title="Avoir"><RefreshCw className="h-3.5 w-3.5" /></button>
                      )}
                      {f.statut !== 'annulee' && (
                        <button onClick={() => void onAnnuler(f)} className="btn-icon-danger" title="Annuler"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-[11px] text-navy-400 flex items-center gap-2">
        <span>{list.length} facture{list.length > 1 ? 's' : ''} · {eur2(totals.regle)} encaissé</span>
        <span className="ml-auto"></span>
        <button onClick={() => navigate('/facturation')} className="text-gold-700 hover:underline">
          Voir toutes les factures →
        </button>
      </div>

      <FactureFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        dossierId={dossierId}
        edit={editing}
        onSaved={() => void reload()}
      />
    </Section>
  )
}

function MiniTotal({ label, value, accent }: { label: string; value: string; accent?: 'navy' | 'gold' }) {
  return (
    <div className={cn('rounded-lg p-2.5 border', accent === 'navy' ? 'border-navy-200 bg-navy-50/50' : 'border-navy-100 bg-white')}>
      <div className="kicker mb-0.5">{label}</div>
      <div className="text-sm font-serif text-navy-900 tabular-nums">{value}</div>
    </div>
  )
}
