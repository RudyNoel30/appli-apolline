/**
 * Page Apporteurs — référentiel CRUD des apporteurs d'affaires Apolline.
 *
 * Sébastien (retour beta 2026-05) avait demandé :
 *   - Saisir manuellement SES apporteurs (Jean-Luc Moissonnier déjà seedé)
 *   - Différentes catégories (Agent immobilier, Notaire, Promoteur…) avec
 *     RCS + adresse pro obligatoires pour pouvoir faire des chèques de
 *     rétrocession.
 *
 * Cette page expose toute la fiche apporteur :
 *  - Identification : nom, type, société, ville
 *  - Coordonnées : email, téléphone
 *  - Business (pour chèques) : RCS, adresse pro complète, carte T, IBAN
 *  - Commercial : rétrocession % par défaut, notes
 */
import { useState, useMemo, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Search, Mail, Phone, MapPin, AlertCircle, FileText, Hash } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import CodePostalVilleField from '@/components/CodePostalVilleField'
import { useStore } from '@/stores/useStore'
import type { Apporteur } from '@/data/mock'
import { confirmDialog } from '@/lib/dialog'
import { cn } from '@/lib/utils'

const TYPES: Apporteur['type'][] = [
  'Agent immobilier', 'Notaire', 'Promoteur', 'CGP / Conseiller',
  'Réseau / Partenaire', 'Site web', 'Recommandation', 'Interne', 'Autre',
]

const PRO_TYPES = new Set<Apporteur['type']>(['Agent immobilier', 'Notaire', 'Promoteur', 'CGP / Conseiller'])

/** Apporteurs "pro" qui nécessitent RCS + adresse pro pour les chèques. */
function isProType(type: Apporteur['type']): boolean {
  return PRO_TYPES.has(type)
}

/** Retourne true si l'apporteur est PRO mais manque le RCS ou l'adresse pro. */
function isIncomplete(a: Apporteur): boolean {
  if (!isProType(a.type)) return false
  return !a.rcs || !a.adressePro || !a.codePostalPro || !a.villePro
}

export default function Apporteurs() {
  const apporteurs = useStore((s) => s.apporteurs)
  const clients = useStore((s) => s.clients)
  const addApporteur = useStore((s) => s.addApporteur)
  const updateApporteur = useStore((s) => s.updateApporteur)
  const deleteApporteur = useStore((s) => s.deleteApporteur)

  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<Apporteur['type'] | 'Tous'>('Tous')
  const [editing, setEditing] = useState<Apporteur | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Nombre de prospects rattachés à chaque apporteur (compteur affiché en liste)
  const countByApporteur = useMemo(() => {
    const map = new Map<string, number>()
    clients.forEach((c) => {
      if (c.apporteurId) map.set(c.apporteurId, (map.get(c.apporteurId) ?? 0) + 1)
    })
    return map
  }, [clients])

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase()
    return apporteurs.filter((a) => {
      if (typeFilter !== 'Tous' && a.type !== typeFilter) return false
      if (!search) return true
      return `${a.nom} ${a.societe ?? ''} ${a.ville ?? ''} ${a.email ?? ''}`.toLowerCase().includes(search)
    })
  }, [apporteurs, q, typeFilter])

  const onNew = () => { setEditing(null); setShowForm(true) }
  const onEdit = (a: Apporteur) => { setEditing(a); setShowForm(true) }

  const onDelete = async (a: Apporteur) => {
    const count = countByApporteur.get(a.id) ?? 0
    const warning = count > 0 ? ` (${count} prospect(s) rattaché(s) seront déliés)` : ''
    if (!await confirmDialog(
      `Supprimer l'apporteur "${a.nom}"${warning} ?`,
      { title: 'Supprimer apporteur', kind: 'warning' },
    )) return
    deleteApporteur(a.id)
    toast.success(`Apporteur ${a.nom} supprimé`)
  }

  return (
    <>
      <PageHeader
        eyebrow="Référentiel métier"
        title="Apporteurs"
        description="Gérer les apporteurs d'affaires — agents immobiliers, notaires, CGP, partenaires. RCS et adresse pro obligatoires pour les chèques de rétrocession."
        actions={
          <button className="btn-gold" onClick={onNew}>
            <Plus className="h-4 w-4" /> Nouvel apporteur
          </button>
        }
      />

      <div className="page-body">
        {/* Filtres */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-navy-400" />
            <input className="input pl-9" placeholder="Rechercher par nom, société, ville, email…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input max-w-[200px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as Apporteur['type'] | 'Tous')}>
            <option value="Tous">Tous les types</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-xs text-navy-500 ml-auto">{filtered.length} apporteur(s)</span>
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="card p-8 text-center text-navy-400 italic">
            {q || typeFilter !== 'Tous'
              ? 'Aucun apporteur ne correspond aux critères.'
              : 'Aucun apporteur dans le référentiel — clique sur "Nouvel apporteur" pour démarrer.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((a) => {
              const incomplete = isIncomplete(a)
              const count = countByApporteur.get(a.id) ?? 0
              return (
                <div key={a.id} className="card p-4 hover:border-gold-300 hover:shadow-raised transition-all group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-serif text-base font-semibold text-navy-900 truncate">{a.nom}</span>
                        {incomplete && (
                          <span className="badge-warning text-[10px]" title="RCS ou adresse pro manquant — bloquant pour les chèques">
                            <AlertCircle className="h-3 w-3" /> À compléter
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gold-700 font-medium">{a.type}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => onEdit(a)} className="h-7 w-7 rounded-md hover:bg-navy-50 text-navy-400 hover:text-navy-900 flex items-center justify-center" title="Modifier">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => void onDelete(a)} className="h-7 w-7 rounded-md hover:bg-rose-50 text-navy-400 hover:text-rose-700 flex items-center justify-center" title="Supprimer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Société + ville en sous-ligne */}
                  {(a.societe || a.ville) && (
                    <div className="text-xs text-navy-600 mb-2">
                      {a.societe && <span>{a.societe}</span>}
                      {a.societe && a.ville && <span className="mx-1 text-navy-300">·</span>}
                      {a.ville && <span>{a.ville}</span>}
                    </div>
                  )}

                  <div className="space-y-1 text-xs text-navy-500 mb-3">
                    {a.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{a.email}</span></div>}
                    {a.telephone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" /> {a.telephone}</div>}
                    {a.rcs && <div className="flex items-center gap-1.5"><Hash className="h-3 w-3 shrink-0" /> RCS {a.rcs}</div>}
                    {a.adressePro && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="truncate">{a.adressePro}{a.codePostalPro || a.villePro ? `, ${a.codePostalPro ?? ''} ${a.villePro ?? ''}` : ''}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-navy-100 pt-2">
                    {typeof a.retrocession === 'number' && a.retrocession > 0 && (
                      <span className="text-emerald-700 font-semibold">Rétro {(a.retrocession * 100).toFixed(0)}%</span>
                    )}
                    <span className="text-navy-400 ml-auto">{count} prospect{count > 1 ? 's' : ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && (
        <ApporteurFormModal
          initial={editing ?? undefined}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSave={(data) => {
            if (editing) {
              updateApporteur(editing.id, data)
              toast.success(`${data.nom} mis à jour`)
            } else {
              addApporteur(data)
              toast.success(`${data.nom} ajouté`)
            }
            setShowForm(false)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

/* ────────────────────────────────────────────────────────────────── */

function ApporteurFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Apporteur
  onClose: () => void
  onSave: (data: Omit<Apporteur, 'id' | 'createdAt'>) => void
}) {
  const [f, setF] = useState({
    nom: initial?.nom ?? '',
    type: initial?.type ?? ('Agent immobilier' as Apporteur['type']),
    email: initial?.email ?? '',
    telephone: initial?.telephone ?? '',
    societe: initial?.societe ?? '',
    ville: initial?.ville ?? '',
    reference: initial?.reference ?? '',
    retrocessionPct: initial?.retrocession != null ? initial.retrocession * 100 : 0,
    notes: initial?.notes ?? '',
    rcs: initial?.rcs ?? '',
    adressePro: initial?.adressePro ?? '',
    codePostalPro: initial?.codePostalPro ?? '',
    villePro: initial?.villePro ?? '',
    carteT: initial?.carteT ?? '',
    iban: initial?.iban ?? '',
  })

  const isPro = isProType(f.type)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.nom.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    if (isPro && !f.rcs.trim()) {
      // Soft warning — on laisse passer mais on prévient
      toast.warning('RCS recommandé pour ce type d\'apporteur (chèques)', {
        description: 'Tu pourras le compléter plus tard.',
      })
    }
    onSave({
      nom: f.nom.trim(),
      type: f.type,
      email: f.email.trim() || undefined,
      telephone: f.telephone.trim() || undefined,
      societe: f.societe.trim() || undefined,
      ville: f.ville.trim() || undefined,
      reference: f.reference.trim() || undefined,
      retrocession: f.retrocessionPct > 0 ? f.retrocessionPct / 100 : undefined,
      notes: f.notes.trim() || undefined,
      rcs: f.rcs.trim() || undefined,
      adressePro: f.adressePro.trim() || undefined,
      codePostalPro: f.codePostalPro.trim() || undefined,
      villePro: f.villePro.trim() || undefined,
      carteT: f.carteT.trim() || undefined,
      iban: f.iban.trim().replace(/\s+/g, '').toUpperCase() || undefined,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `Modifier ${initial.nom}` : 'Nouvel apporteur'}
      description="Référentiel apporteurs — données utilisées pour le suivi commercial et les chèques de rétrocession."
      size="lg"
      actions={
        <>
          <button className="btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn-gold" onClick={submit}>{initial ? 'Enregistrer' : 'Créer'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        {/* ─── Identification ─── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gold-700 mb-2">Identification</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Nom *</label>
              <input className="input" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })}
                placeholder="Nom complet (prénom + nom, ou raison sociale)" />
            </div>
            <div>
              <label className="label">Type *</label>
              <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Apporteur['type'] })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Société</label>
              <input className="input" value={f.societe} onChange={(e) => setF({ ...f, societe: e.target.value })}
                placeholder="Raison sociale / nom de l'agence" />
            </div>
            <div>
              <label className="label">Ville (siège)</label>
              <input className="input" value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} />
            </div>
          </div>
        </div>

        {/* ─── Coordonnées ─── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gold-700 mb-2">Coordonnées</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} />
            </div>
          </div>
        </div>

        {/* ─── Business : chèques de rétrocession ─── */}
        <div className={cn('rounded-lg border p-4', isPro ? 'border-gold-200 bg-gold-50/40' : 'border-navy-100 bg-navy-50/30')}>
          <div className="flex items-start gap-2 mb-3">
            <FileText className="h-4 w-4 text-gold-700 mt-0.5" />
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-gold-700">
                Informations business {isPro && <span className="text-rose-700 normal-case">*</span>}
              </div>
              <div className="text-[11px] text-navy-500 mt-0.5">
                {isPro
                  ? 'RCS + adresse pro nécessaires pour émettre des chèques de rétrocession.'
                  : 'Optionnel selon le type d\'apporteur.'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">N° RCS / SIREN {isPro && <span className="text-rose-700">*</span>}</label>
              <input className="input" value={f.rcs} onChange={(e) => setF({ ...f, rcs: e.target.value })}
                placeholder="ex: 123 456 789" />
            </div>
            {f.type === 'Agent immobilier' && (
              <div>
                <label className="label">N° carte T</label>
                <input className="input" value={f.carteT} onChange={(e) => setF({ ...f, carteT: e.target.value })}
                  placeholder="CPI 3901 2023 ..." />
              </div>
            )}
            <div className={cn(f.type === 'Agent immobilier' ? '' : 'col-span-2')}>
              <label className="label">IBAN (pour virement)</label>
              <input className="input font-mono text-xs" value={f.iban}
                onChange={(e) => setF({ ...f, iban: e.target.value })}
                placeholder="FR76 ..." />
            </div>
            <div className="col-span-3">
              <label className="label">Adresse pro {isPro && <span className="text-rose-700">*</span>}</label>
              <input className="input" value={f.adressePro} onChange={(e) => setF({ ...f, adressePro: e.target.value })}
                placeholder="12 rue des Forges" />
            </div>
            <CodePostalVilleField
              codePostal={f.codePostalPro}
              ville={f.villePro}
              onCodePostalChange={(v) => setF({ ...f, codePostalPro: v })}
              onVilleChange={(v) => setF({ ...f, villePro: v })}
              cpSpan={1}
              villeSpan={2}
              villeLabel="Ville pro"
              required={isPro}
            />
          </div>
        </div>

        {/* ─── Commercial ─── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gold-700 mb-2">Commercial</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Rétrocession (%)</label>
              <div className="relative">
                <input type="number" min={0} max={100} step={1} className="input pr-8"
                  value={f.retrocessionPct === 0 ? '' : f.retrocessionPct} placeholder="0"
                  onChange={(e) => setF({ ...f, retrocessionPct: Number(e.target.value || 0) })} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-navy-400 pointer-events-none">%</span>
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">Référence interne</label>
              <input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })}
                placeholder="ex: APP-0042 (compatible Cifacil)" />
            </div>
            <div className="col-span-3">
              <label className="label">Notes</label>
              <textarea className="input min-h-[60px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })}
                placeholder="Spécificités commerciales, accord particulier…" />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}
