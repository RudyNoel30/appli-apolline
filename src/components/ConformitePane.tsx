/**
 * Pane Conformité IOBSP — affiche les certifs (ORIAS, RC pro, garantie financière, …),
 * le compteur des 15h de formation continue obligatoires, et les alertes
 * d'expiration imminente. Édition complète via 2 modales.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Clock, Plus, Trash2, Pencil, GraduationCap,
  FileText, RefreshCw, ExternalLink, Award,
} from 'lucide-react'
import { toast } from 'sonner'
import { conformite, type ConformiteCertif, type ConformiteCertifType, type ConformiteFormation, type ConformiteStatus } from '@/db/api'
import { useAuth, usePermissions } from '@/auth/AuthContext'
import { useStore } from '@/stores/useStore'
import { cn, dateFr } from '@/lib/utils'
import { confirmDialog } from '@/lib/dialog'

const CERTIF_TYPES: { value: ConformiteCertifType; label: string; description: string; icon: typeof Shield }[] = [
  { value: 'orias', label: 'Immatriculation ORIAS', description: 'À renouveler chaque 15 février (~30€/an)', icon: Award },
  { value: 'carte_pro', label: 'Carte professionnelle IOBSP', description: 'Délivrée par l\'ORIAS', icon: Shield },
  { value: 'rc_pro', label: 'RC Pro (Responsabilité Civile)', description: 'Min. 1,5 M€ par sinistre — art. L.519-3-4 CMF', icon: Shield },
  { value: 'garantie_financiere', label: 'Garantie financière', description: 'Min. 115 000 € pour catégorie 1', icon: Shield },
  { value: 'capacite_pro', label: 'Capacité professionnelle', description: 'Diplôme, expérience 3 ans, ou stage 150h', icon: GraduationCap },
  { value: 'autre', label: 'Autre certificat', description: 'Tout autre justificatif IOBSP', icon: FileText },
]

const FORMATION_THEMES = [
  'Crédit immobilier — réglementation',
  'Crédit conso — réglementation',
  'LCB-FT (Lutte anti-blanchiment)',
  'Conformité IOBSP',
  'Prévention des risques',
  'Protection du consommateur',
  'RGPD / protection des données',
  'Assurance emprunteur',
  'Autre',
]

const eur = (cents: number) => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })

export default function ConformitePane() {
  const { isAdmin } = usePermissions()
  const { currentUser } = useAuth()
  const collaborateurs = useStore((s) => s.collaborateurs)

  const [collabId, setCollabId] = useState<string>(currentUser?.id ?? '')
  const [status, setStatus] = useState<ConformiteStatus | null>(null)
  const [certifs, setCertifs] = useState<ConformiteCertif[]>([])
  const [formations, setFormations] = useState<ConformiteFormation[]>([])
  const [loading, setLoading] = useState(false)

  // Modales
  const [certifModal, setCertifModal] = useState<{ edit?: ConformiteCertif; type?: ConformiteCertifType } | null>(null)
  const [formationModal, setFormationModal] = useState<boolean>(false)

  const load = async () => {
    if (!collabId) return
    setLoading(true)
    try {
      const [s, c, f] = await Promise.all([
        conformite.status(collabId),
        conformite.listCertifs(collabId),
        conformite.listFormations(collabId),
      ])
      setStatus(s)
      setCertifs(c.certifs)
      setFormations(f.formations)
    } catch (e) {
      toast.error('Erreur chargement', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [collabId])

  const certifByType = useMemo(() => {
    const map: Record<string, ConformiteCertif | undefined> = {}
    for (const c of certifs) map[c.type] = c
    return map
  }, [certifs])

  const onDeleteCertif = async (c: ConformiteCertif) => {
    if (!await confirmDialog(`Supprimer "${c.libelle}" ?`, { title: 'Supprimer certificat', kind: 'warning' })) return
    try { await conformite.deleteCertif(c.id); toast.success('Supprimé'); void load() }
    catch (e) { toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) }) }
  }

  const onDeleteFormation = async (f: ConformiteFormation) => {
    if (!await confirmDialog(`Supprimer "${f.titre}" ?`, { title: 'Supprimer formation', kind: 'warning' })) return
    try { await conformite.deleteFormation(f.id); toast.success('Supprimé'); void load() }
    catch (e) { toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) }) }
  }

  return (
    <>
      <Section>
        <div className="flex items-start gap-3 mb-4">
          <div className={cn(
            'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
            !status ? 'bg-navy-50' :
            status.global === 'ok' ? 'bg-emerald-50' :
            status.global === 'warn' ? 'bg-amber-50' :
            'bg-rose-50',
          )}>
            <Shield className={cn(
              'h-5 w-5',
              !status ? 'text-navy-700' :
              status.global === 'ok' ? 'text-emerald-700' :
              status.global === 'warn' ? 'text-amber-700' :
              'text-rose-700',
            )} />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-lg text-navy-900">Conformité IOBSP</h3>
            <p className="text-sm text-navy-500 mt-0.5">
              Suivi des certifications obligatoires courtier (ORIAS, RC pro, garantie financière) et des
              <strong> 15 heures de formation continue annuelles</strong> imposées par l'arrêté du 9 juin 2016 (art. R.519-15 CMF).
            </p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="btn-icon" title="Actualiser">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Sélecteur collaborateur (admin uniquement) */}
        {isAdmin && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="kicker">Collaborateur :</span>
            <select className="input max-w-xs" value={collabId} onChange={(e) => setCollabId(e.target.value)}>
              {collaborateurs.map((c) => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom} · {c.roleLabel}</option>
              ))}
            </select>
          </div>
        )}

        {/* KPIs synthèse */}
        {status && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            <ScoreCard score={status.score} global={status.global} />
            <Kpi
              icon={GraduationCap}
              label="Formation continue (cette année)"
              value={`${status.formation.heuresAnnee.toFixed(1)} / ${status.formation.heuresObligatoires} h`}
              hint={status.formation.anneeOk ? 'Quota atteint ✓' : `Reste ${(status.formation.heuresObligatoires - status.formation.heuresAnnee).toFixed(1)} h`}
              accent={status.formation.anneeOk ? 'emerald' : (new Date().getMonth() >= 9 ? 'rose' : 'navy')}
              progress={status.formation.pourcentage}
            />
            <Kpi
              icon={AlertTriangle}
              label="Alertes actives"
              value={String(status.alertes.length)}
              hint={status.alertes.length === 0 ? 'Aucune' : `${status.alertes.filter((a) => a.statut === 'expire').length} expirée(s)`}
              accent={status.alertes.length === 0 ? 'emerald' : 'rose'}
            />
            <Kpi
              icon={CheckCircle2}
              label="Documents enregistrés"
              value={`${certifs.length} certif. + ${formations.length} form.`}
              hint={status.typesManquants.length > 0 ? `${status.typesManquants.length} type(s) manquant(s)` : 'Tout présent'}
              accent={status.typesManquants.length > 0 ? 'amber' : 'emerald'}
            />
          </div>
        )}

        {/* Alertes — bannière en haut si critiques */}
        {status && status.alertes.length > 0 && (
          <div className={cn(
            'rounded-lg border p-3 mb-4',
            status.alertes.some((a) => a.statut === 'expire') ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200',
          )}>
            <div className="font-semibold text-sm mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Alertes de conformité ({status.alertes.length})
            </div>
            <ul className="text-xs space-y-1">
              {status.alertes.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  {a.statut === 'expire' ? <XCircle className="h-3 w-3 text-rose-700 shrink-0" /> : <Clock className="h-3 w-3 text-amber-700 shrink-0" />}
                  <span className="font-medium">{a.libelle}</span>
                  {a.daysUntilExpire != null && (
                    <span className={a.statut === 'expire' ? 'text-rose-700' : 'text-amber-700'}>
                      · {a.statut === 'expire' ? `expirée depuis ${Math.abs(a.daysUntilExpire)} j` : `expire dans ${a.daysUntilExpire} j`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* Cartes par type de certif */}
      <Section title="Certifications & documents officiels" action={
        <button onClick={() => setCertifModal({})} className="btn-gold text-xs">
          <Plus className="h-3.5 w-3.5" /> Ajouter un certificat
        </button>
      }>
        <div className="grid grid-cols-2 gap-3">
          {CERTIF_TYPES.map((t) => {
            const c = certifByType[t.value]
            const Icon = t.icon
            const isExpired = c?.expireLe && new Date(c.expireLe).getTime() < Date.now()
            const days = c?.expireLe ? Math.floor((new Date(c.expireLe).getTime() - Date.now()) / 86400000) : null
            const isAlerte = days != null && days >= 0 && days <= (c?.alerteJoursAvant ?? 60)

            return (
              <div
                key={t.value}
                className={cn(
                  'rounded-lg border p-3 transition-colors',
                  !c ? 'border-dashed border-navy-200 bg-navy-50/30' :
                  isExpired ? 'border-rose-300 bg-rose-50/40' :
                  isAlerte ? 'border-amber-300 bg-amber-50/40' :
                  'border-navy-100 bg-white',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'h-8 w-8 rounded-md flex items-center justify-center shrink-0',
                    !c ? 'bg-navy-100 text-navy-500' :
                    isExpired ? 'bg-rose-100 text-rose-700' :
                    isAlerte ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700',
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-navy-900">{t.label}</div>
                    <div className="text-[11px] text-navy-500 mb-1.5">{t.description}</div>

                    {!c ? (
                      <button
                        onClick={() => setCertifModal({ type: t.value })}
                        className="text-xs text-gold-700 hover:text-gold-800 hover:underline"
                      >
                        + Renseigner ce document
                      </button>
                    ) : (
                      <div className="space-y-1 text-xs">
                        {c.numero && <div><span className="text-navy-500">N°</span> <span className="font-mono">{c.numero}</span></div>}
                        {c.organismeEmetteur && <div className="text-navy-700">{c.organismeEmetteur}</div>}
                        {c.montantGarantie != null && <div><span className="text-navy-500">Garantie :</span> <strong>{eur(c.montantGarantie)}</strong></div>}
                        {c.expireLe && (
                          <div className={isExpired ? 'text-rose-700 font-semibold' : isAlerte ? 'text-amber-700 font-semibold' : 'text-navy-700'}>
                            Expire le <strong>{dateFr(c.expireLe)}</strong>
                            {days != null && (
                              <span className="ml-1 text-[11px]">
                                ({isExpired ? `il y a ${Math.abs(days)} j` : `dans ${days} j`})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {c && (
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button onClick={() => setCertifModal({ edit: c })} className="btn-icon" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => void onDeleteCertif(c)} className="btn-icon-danger" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-[11px] text-navy-400 mt-3 flex items-center gap-1.5">
          <ExternalLink className="h-3 w-3" />
          <a href="https://www.orias.fr" target="_blank" rel="noopener" className="hover:text-gold-700 hover:underline">
            Vérifier votre immatriculation sur orias.fr
          </a>
        </div>
      </Section>

      {/* Formations continues */}
      <Section title={`Formations continues (${formations.length})`} action={
        <button onClick={() => setFormationModal(true)} className="btn-gold text-xs">
          <Plus className="h-3.5 w-3.5" /> Ajouter une session
        </button>
      }>
        {/* Barre de progression annuelle */}
        {status && (
          <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-navy-50/40 to-white border border-navy-100">
            <div className="flex items-baseline justify-between mb-1.5">
              <div className="text-sm font-semibold text-navy-900">
                Quota année {new Date().getFullYear()} : {status.formation.heuresAnnee.toFixed(1)} / {status.formation.heuresObligatoires} h
              </div>
              <div className="text-xs text-navy-500">
                {status.formation.anneeOk ? '✓ atteint' : `${(status.formation.heuresObligatoires - status.formation.heuresAnnee).toFixed(1)} h restantes`}
              </div>
            </div>
            <div className="h-2 rounded-full bg-navy-100 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  status.formation.anneeOk ? 'bg-emerald-500' : 'bg-gold-500',
                )}
                style={{ width: `${Math.min(100, status.formation.pourcentage)}%` }}
              />
            </div>
            <div className="text-[11px] text-navy-500 mt-1.5">
              Année précédente : {status.formation.heuresAnneePrev.toFixed(1)} h
            </div>
          </div>
        )}

        {formations.length === 0 ? (
          <div className="text-sm text-navy-400 italic border border-dashed border-navy-200 rounded-lg p-6 text-center">
            Aucune formation enregistrée. Cliquez sur « Ajouter une session » pour commencer le suivi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Date</th>
                  <th className="table-th">Titre</th>
                  <th className="table-th">Thème</th>
                  <th className="table-th">Organisme</th>
                  <th className="table-th text-right">Heures</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {formations.map((f) => (
                  <tr key={f.id} className="hover:bg-navy-50/40 group">
                    <td className="table-td text-xs text-navy-600">{dateFr(f.dateDebut)}</td>
                    <td className="table-td font-medium">{f.titre}</td>
                    <td className="table-td text-xs">{f.theme ?? '—'}</td>
                    <td className="table-td text-xs text-navy-600">{f.organismeFormateur ?? '—'}</td>
                    <td className="table-td text-right font-semibold tabular-nums">{f.dureeHeures.toFixed(1)} h</td>
                    <td className="table-td text-right">
                      <button onClick={() => void onDeleteFormation(f)} className="btn-icon-danger opacity-0 group-hover:opacity-100" title="Supprimer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Modales */}
      {certifModal && (
        <CertifModal
          open
          edit={certifModal.edit}
          defaultType={certifModal.type}
          collaborateurId={collabId}
          onClose={() => setCertifModal(null)}
          onSaved={() => { setCertifModal(null); void load() }}
        />
      )}
      {formationModal && (
        <FormationModal
          open
          collaborateurId={collabId}
          onClose={() => setFormationModal(false)}
          onSaved={() => { setFormationModal(false); void load() }}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ScoreCard({ score, global }: { score: number; global: 'ok' | 'warn' | 'ko' }) {
  const colorMap = {
    ok: { bg: 'from-emerald-50 to-white', text: 'text-emerald-700', label: 'Conforme' },
    warn: { bg: 'from-amber-50 to-white', text: 'text-amber-700', label: 'À surveiller' },
    ko: { bg: 'from-rose-50 to-white', text: 'text-rose-700', label: 'Non conforme' },
  }
  const c = colorMap[global]
  return (
    <div className={cn('rounded-xl border border-navy-100 bg-gradient-to-br p-3', c.bg)}>
      <div className="flex items-center gap-2 mb-1.5">
        <Shield className={cn('h-3.5 w-3.5', c.text)} />
        <div className="kicker">Score conformité</div>
      </div>
      <div className="font-serif text-2xl text-navy-900 tabular-nums leading-tight">{score} / 100</div>
      <div className={cn('text-[11px] mt-0.5 font-medium', c.text)}>{c.label}</div>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, hint, accent = 'navy', progress }: {
  icon: typeof Shield
  label: string
  value: string
  hint?: string
  accent?: 'navy' | 'emerald' | 'rose' | 'amber'
  progress?: number
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    navy: { bg: 'from-navy-50 to-white', text: 'text-navy-700' },
    emerald: { bg: 'from-emerald-50 to-white', text: 'text-emerald-700' },
    rose: { bg: 'from-rose-50 to-white', text: 'text-rose-700' },
    amber: { bg: 'from-amber-50 to-white', text: 'text-amber-700' },
  }
  const c = colorMap[accent]!
  return (
    <div className={cn('rounded-xl border border-navy-100 bg-gradient-to-br p-3', c.bg)}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn('h-3.5 w-3.5', c.text)} />
        <div className="kicker">{label}</div>
      </div>
      <div className="font-serif text-lg text-navy-900 tabular-nums leading-tight">{value}</div>
      {hint && <div className="text-[11px] text-navy-500 mt-0.5">{hint}</div>}
      {progress != null && (
        <div className="h-1 rounded-full bg-navy-100 overflow-hidden mt-1.5">
          <div className={cn('h-full', accent === 'emerald' ? 'bg-emerald-500' : accent === 'rose' ? 'bg-rose-500' : 'bg-gold-500')} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

function Section({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-5 mb-4">
      {(title || action) && (
        <div className="flex items-center gap-3 mb-3">
          {title && <h3 className="font-serif text-base font-semibold text-navy-900">{title}</h3>}
          <div className="flex-1 h-px bg-navy-100" />
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Certif
// ─────────────────────────────────────────────────────────────────────────────

function CertifModal({ open, edit, defaultType, collaborateurId, onClose, onSaved }: {
  open: boolean
  edit?: ConformiteCertif
  defaultType?: ConformiteCertifType
  collaborateurId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<ConformiteCertifType>(edit?.type ?? defaultType ?? 'orias')
  const [libelle, setLibelle] = useState(edit?.libelle ?? '')
  const [organisme, setOrganisme] = useState(edit?.organismeEmetteur ?? '')
  const [numero, setNumero] = useState(edit?.numero ?? '')
  const [emiseLe, setEmiseLe] = useState(edit?.emiseLe?.slice(0, 10) ?? '')
  const [expireLe, setExpireLe] = useState(edit?.expireLe?.slice(0, 10) ?? '')
  const [montant, setMontant] = useState(edit?.montantGarantie != null ? String(edit.montantGarantie / 100) : '')
  const [alerteJ, setAlerteJ] = useState(edit?.alerteJoursAvant ?? 60)
  const [notes, setNotes] = useState(edit?.notes ?? '')
  const [saving, setSaving] = useState(false)

  // Auto-libelle si vide à la sélection du type
  useEffect(() => {
    if (!libelle) {
      const def = CERTIF_TYPES.find((t) => t.value === type)
      if (def) setLibelle(def.label)
    }
  }, [type])

  if (!open) return null

  const showMontant = type === 'rc_pro' || type === 'garantie_financiere'

  const save = async () => {
    if (!libelle.trim()) { toast.error('Libellé requis'); return }
    setSaving(true)
    try {
      const data = {
        collaborateurId,
        type,
        libelle: libelle.trim(),
        organismeEmetteur: organisme.trim() || null,
        numero: numero.trim() || null,
        emiseLe: emiseLe || null,
        expireLe: expireLe || null,
        montantGarantie: showMontant && montant ? Number(montant.replace(',', '.')) : null,
        alerteJoursAvant: alerteJ,
        notes: notes.trim() || null,
      }
      if (edit) await conformite.updateCertif(edit.id, data)
      else await conformite.createCertif(data)
      toast.success(edit ? 'Certificat mis à jour' : 'Certificat créé')
      onSaved()
    } catch (e) {
      toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white rounded-xl2 shadow-raised overflow-hidden animate-scale-in flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 px-5 py-3 border-b border-navy-100">
          <Shield className="h-5 w-5 text-gold-700" />
          <h2 className="font-serif text-lg text-navy-900 flex-1">{edit ? `Modifier ${edit.libelle}` : 'Nouveau certificat'}</h2>
          <button onClick={onClose} className="btn-icon">✕</button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div>
            <label className="kicker mb-1 block">Type *</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as ConformiteCertifType)} disabled={!!edit}>
              {CERTIF_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="kicker mb-1 block">Libellé *</label>
            <input className="input" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex: ORIAS Apolline 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="kicker mb-1 block">Organisme émetteur</label>
              <input className="input" value={organisme} onChange={(e) => setOrganisme(e.target.value)} placeholder="ORIAS, AXA, BPCE…" />
            </div>
            <div>
              <label className="kicker mb-1 block">Numéro</label>
              <input className="input" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="N° 17002647" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="kicker mb-1 block">Émis le</label>
              <input type="date" className="input" value={emiseLe} onChange={(e) => setEmiseLe(e.target.value)} />
            </div>
            <div>
              <label className="kicker mb-1 block">Expire le</label>
              <input type="date" className="input" value={expireLe} onChange={(e) => setExpireLe(e.target.value)} />
            </div>
          </div>
          {showMontant && (
            <div>
              <label className="kicker mb-1 block">Montant garanti (€)</label>
              <input className="input" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="1500000" />
            </div>
          )}
          <div>
            <label className="kicker mb-1 block">Alerter combien de jours avant expiration ?</label>
            <select className="input" value={alerteJ} onChange={(e) => setAlerteJ(Number(e.target.value))}>
              <option value={30}>30 jours</option>
              <option value={60}>60 jours</option>
              <option value={90}>90 jours</option>
              <option value={180}>180 jours</option>
            </select>
          </div>
          <div>
            <label className="kicker mb-1 block">Notes</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-navy-100 bg-ivory/40">
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-gold">{saving ? 'Enregistrement…' : edit ? 'Mettre à jour' : 'Créer'}</button>
        </footer>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Formation
// ─────────────────────────────────────────────────────────────────────────────

function FormationModal({ open, collaborateurId, onClose, onSaved }: {
  open: boolean
  collaborateurId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [titre, setTitre] = useState('')
  const [organisme, setOrganisme] = useState('')
  const [theme, setTheme] = useState(FORMATION_THEMES[0]!)
  const [type, setType] = useState<'continue' | 'initiale' | 'thematique'>('continue')
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().slice(0, 10))
  const [dateFin, setDateFin] = useState('')
  const [duree, setDuree] = useState('1')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const save = async () => {
    if (!titre.trim() || !dateDebut || !duree) { toast.error('Titre, date et durée requis'); return }
    setSaving(true)
    try {
      await conformite.createFormation({
        collaborateurId,
        titre: titre.trim(),
        organismeFormateur: organisme.trim() || null,
        type,
        theme: theme || null,
        dateDebut,
        dateFin: dateFin || null,
        dureeHeures: Number(duree.replace(',', '.')),
        notes: notes.trim() || null,
      })
      toast.success('Formation enregistrée')
      onSaved()
    } catch (e) {
      toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white rounded-xl2 shadow-raised overflow-hidden animate-scale-in flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 px-5 py-3 border-b border-navy-100">
          <GraduationCap className="h-5 w-5 text-gold-700" />
          <h2 className="font-serif text-lg text-navy-900 flex-1">Nouvelle session de formation</h2>
          <button onClick={onClose} className="btn-icon">✕</button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div>
            <label className="kicker mb-1 block">Titre *</label>
            <input className="input" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex: Webinaire LCB-FT 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="kicker mb-1 block">Type</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value as 'continue' | 'initiale' | 'thematique')}>
                <option value="continue">Continue (compte pour les 15h)</option>
                <option value="initiale">Initiale (avant immatriculation)</option>
                <option value="thematique">Thématique (hors quota)</option>
              </select>
            </div>
            <div>
              <label className="kicker mb-1 block">Thème</label>
              <select className="input" value={theme} onChange={(e) => setTheme(e.target.value)}>
                {FORMATION_THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="kicker mb-1 block">Organisme formateur</label>
            <input className="input" value={organisme} onChange={(e) => setOrganisme(e.target.value)} placeholder="Ex: Académie IOBSP" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="kicker mb-1 block">Date début *</label>
              <input type="date" className="input" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
            </div>
            <div>
              <label className="kicker mb-1 block">Date fin</label>
              <input type="date" className="input" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
            </div>
            <div>
              <label className="kicker mb-1 block">Durée (h) *</label>
              <input className="input" inputMode="decimal" value={duree} onChange={(e) => setDuree(e.target.value)} placeholder="2" />
            </div>
          </div>
          <div>
            <label className="kicker mb-1 block">Notes</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="N° d'attestation, formateur, notes…" />
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-navy-100 bg-ivory/40">
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-gold">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </footer>
      </div>
    </div>
  )
}
