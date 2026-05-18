import { useState, useMemo, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Download, Plus, Mail, Phone, MapPin, Pencil, Trash2, UserCheck, UserMinus, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import { useStore } from '@/stores/useStore'
import type { Client } from '@/data/mock'
import { dateFr, eur, initials, cn } from '@/lib/utils'
import ApporteurCombobox from '@/components/ApporteurCombobox'
import { exportToXlsx } from '@/lib/excelExport'
import { communesByCodePostal } from '@/lib/geo'
import { ageFromBirthdate } from '@/lib/age'


type Mode = 'prospect' | 'client'

export default function Clients({ mode = 'client' }: { mode?: Mode }) {
  const navigate = useNavigate()
  const clients = useStore((s) => s.clients)
  const dossiers = useStore((s) => s.dossiers)
  const addClient = useStore((s) => s.addClient)
  const updateClient = useStore((s) => s.updateClient)
  const deleteClient = useStore((s) => s.deleteClient)
  const convertirEnClient = useStore((s) => s.convertirEnClient)
  const repasserEnProspect = useStore((s) => s.repasserEnProspect)

  const [q, setQ] = useState('')
  const [apporteurFilter, setApporteurFilter] = useState<string>('Tous')
  const [modal, setModal] = useState<{ type: 'new' | 'edit' | 'delete' | 'convertir'; client?: Client } | null>(null)

  // Liste distincte des apporteurs utilisés (pour le filtre)
  const apporteursUtilises = useMemo(() => {
    const set = new Set<string>()
    clients.forEach((c) => { if (c.apporteur) set.add(c.apporteur) })
    return Array.from(set).sort()
  }, [clients])

  const list = useMemo(() => {
    return clients.filter((c) => {
      const okMode = c.statutCommercial === mode
      const okQ = !q || `${c.prenom} ${c.nom} ${c.email} ${c.ville} ${c.profession} ${c.apporteur}`.toLowerCase().includes(q.toLowerCase())
      const okA = apporteurFilter === 'Tous' || c.apporteur === apporteurFilter
      return okMode && okQ && okA
    })
  }, [clients, mode, q, apporteurFilter])

  // Pour chaque client, trouver le dossier "en cours" (le plus récent non finalisé)
  const dossierEnCours = (clientId: string): string | null => {
    const matched = dossiers.filter((d) => d.clientId === clientId)
    if (matched.length === 0) return null
    // Priorité aux dossiers actifs (pas signés/abandonnés), sinon le plus récent
    const actifs = matched.filter((d) => !['Encaisse', 'Abandonne'].includes(d.statut))
    const target = actifs.length > 0 ? actifs[0] : matched[0]
    return target.id
  }

  const goToDossier = (clientId: string) => {
    const id = dossierEnCours(clientId)
    if (id) navigate(`/dossiers/${id}`)
  }

  const isProspect = mode === 'prospect'
  const labelSingulier = isProspect ? 'prospect' : 'client'
  const labelPluriel = isProspect ? 'prospects' : 'clients'

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title={isProspect ? 'Prospects' : 'Clients'}
        description={
          isProspect
            ? `${list.length} prospect${list.length > 1 ? 's' : ''} en attente de mandat`
            : `${list.length} client${list.length > 1 ? 's' : ''} sous mandat`
        }
        actions={
          <>
            <button
              className="btn-outline"
              onClick={async () => {
                const path = await exportToXlsx({
                  filename: `apolline-${labelPluriel}-${new Date().toISOString().slice(0, 10)}.xlsx`,
                  sheets: [{
                    name: isProspect ? 'Prospects' : 'Clients',
                    title: `Apolline — Portefeuille ${labelPluriel}`,
                    subtitle: `${list.length} fiches · généré le ${new Date().toLocaleDateString('fr-FR')}`,
                    columns: [
                      { key: 'nom', header: 'Nom complet', width: 28 },
                      { key: 'email', header: 'Email', width: 32 },
                      { key: 'tel', header: 'Téléphone', width: 16 },
                      { key: 'ville', header: 'Ville', width: 18 },
                      { key: 'profession', header: 'Profession', width: 24 },
                      { key: 'revenu', header: 'Revenu net /mois', width: 18, format: 'currency', align: 'right' },
                      { key: 'dossiers', header: 'Dossiers', width: 10, format: 'integer', align: 'center' },
                      { key: 'apporteur', header: 'Apporteur', width: 28 },
                      { key: 'activite', header: 'Dernière activité', width: 16 },
                    ],
                    rows: list.map((c) => ({
                      nom: `${c.prenom} ${c.nom}${c.conjoint ? ' & ' + c.conjoint : ''}`,
                      email: c.email,
                      tel: c.tel,
                      ville: c.ville,
                      profession: c.profession,
                      revenu: c.revenuMensuelNet,
                      dossiers: c.dossierIds?.length ?? 0,
                      apporteur: c.apporteur,
                      activite: c.lastActivity,
                    })),
                    totals: { label: 'Totaux', sumKeys: ['revenu', 'dossiers'] },
                  }],
                })
                if (path === null) return
                toast.success(`${list.length} ${labelSingulier}${list.length > 1 ? 's' : ''} exporté${list.length > 1 ? 's' : ''} en Excel`, {
                  description: path !== 'download' ? path : 'Téléchargé',
                })
              }}
            >
              <Download className="h-4 w-4" /> Exporter Excel
            </button>
            <button className="btn-gold" onClick={() => setModal({ type: 'new' })}>
              <Plus className="h-4 w-4" /> Nouveau {labelSingulier}
            </button>
          </>
        }
      />

      <div className="page-body">
        <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher par nom, email, ville, profession…"
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-navy-500">
            <Filter className="h-3.5 w-3.5" /> Apporteur :
          </div>
          <select
            className="input max-w-[260px] py-1.5 text-xs"
            value={apporteurFilter}
            onChange={(e) => setApporteurFilter(e.target.value)}
          >
            <option value="Tous">Tous ({list.length === clients.filter((c) => c.statutCommercial === mode).length ? clients.filter((c) => c.statutCommercial === mode).length : `${list.length} / ${clients.filter((c) => c.statutCommercial === mode).length}`})</option>
            {apporteursUtilises.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="card overflow-hidden scroll-isolated">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Nom</th>
                <th className="table-th">Contact</th>
                <th className="table-th">Ville</th>
                <th className="table-th">Profession</th>
                <th className="table-th text-right">Revenu net / mois</th>
                <th className="table-th text-center">Dossier en cours</th>
                <th className="table-th">Apporteur</th>
                <th className="table-th">Dernière activité</th>
                <th className="table-th w-28"></th>
              </tr>
            </thead>
            <tbody className="list-fast stagger-fast">
              {list.map((c) => {
                const dossierTargetId = dossierEnCours(c.id)
                return (
                <tr
                  key={c.id}
                  onClick={() => goToDossier(c.id)}
                  className={cn(
                    'group transition-colors duration-150',
                    dossierTargetId
                      ? 'hover:bg-gold-50/60 cursor-pointer'
                      : 'hover:bg-navy-50/60',
                  )}
                  title={dossierTargetId ? 'Cliquez pour ouvrir le dossier en cours' : undefined}
                >
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-navy-800 to-navy-900 text-gold-400 flex items-center justify-center font-semibold text-xs shadow-soft">
                        {initials(c.prenom + ' ' + c.nom)}
                      </div>
                      <div>
                        <div className="font-semibold text-navy-900">{c.prenom} {c.nom}</div>
                        {c.conjoint && <div className="text-[11px] text-navy-500">+ {c.conjoint}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1 text-xs text-navy-600">
                      <Mail className="h-3 w-3 text-navy-400" /> {c.email}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-navy-600 mt-0.5">
                      <Phone className="h-3 w-3 text-navy-400" /> {c.tel}
                    </div>
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1 text-navy-700">
                      <MapPin className="h-3.5 w-3.5 text-navy-400" /> {c.ville}
                    </div>
                  </td>
                  <td className="table-td text-navy-700">{c.profession}</td>
                  <td className="table-td text-right font-semibold text-navy-900">{eur(c.revenuMensuelNet)}</td>
                  <td className="table-td text-center">
                    {dossierTargetId ? (
                      <span className="inline-flex items-center gap-1 badge-gold">
                        Ouvrir <ArrowRight className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="text-xs text-navy-400 italic">Aucun dossier</span>
                    )}
                  </td>
                  <td className="table-td">
                    {c.apporteur ? (
                      <span className="text-sm text-navy-700">{c.apporteur}</span>
                    ) : (
                      <span className="text-xs text-navy-400 italic">—</span>
                    )}
                  </td>
                  <td className="table-td text-xs text-navy-500">{dateFr(c.lastActivity)}</td>
                  <td className="table-td" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      {c.statutCommercial === 'prospect' ? (
                        <button
                          onClick={() => setModal({ type: 'convertir', client: c })}
                          className="h-7 w-7 rounded-md hover:bg-emerald-50 flex items-center justify-center text-navy-400 hover:text-emerald-700 transition"
                          title="Convertir en client (mandat envoyé)"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            repasserEnProspect(c.id)
                            toast.success(`${c.prenom} ${c.nom} repassé en prospect`)
                          }}
                          className="h-7 w-7 rounded-md hover:bg-amber-50 flex items-center justify-center text-navy-400 hover:text-amber-700 transition"
                          title="Repasser en prospect"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setModal({ type: 'edit', client: c })}
                        className="h-7 w-7 rounded-md hover:bg-white flex items-center justify-center text-navy-400 hover:text-navy-900 transition"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setModal({ type: 'delete', client: c })}
                        className="h-7 w-7 rounded-md hover:bg-rose-50 flex items-center justify-center text-navy-400 hover:text-rose-700 transition"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={9} className="table-td text-center text-navy-400 py-12">
                    Aucun {labelSingulier} {q || apporteurFilter !== 'Tous' ? 'ne correspond à votre recherche' : `${isProspect ? 'en attente' : 'sous mandat'}`}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(modal?.type === 'new' || modal?.type === 'edit') && (
        <ClientFormModal
          initial={modal.client}
          mode={mode}
          onClose={() => setModal(null)}
          onSave={(data) => {
            if (modal.type === 'edit' && modal.client) {
              updateClient(modal.client.id, data)
              toast.success(`Fiche ${data.prenom} ${data.nom} mise à jour`)
            } else {
              const c = addClient({ ...data, statutCommercial: mode })
              toast.success(`${isProspect ? 'Prospect' : 'Client'} ${c.prenom} ${c.nom} créé`)
            }
            setModal(null)
          }}
        />
      )}

      {modal?.type === 'convertir' && modal.client && (
        <Modal
          open
          onClose={() => setModal(null)}
          title="Convertir en client"
          description={`${modal.client.prenom} ${modal.client.nom} passera de Prospect à Client (mandat envoyé)`}
          size="sm"
          actions={
            <>
              <button className="btn-outline" onClick={() => setModal(null)}>Annuler</button>
              <button
                className="btn-gold"
                onClick={() => {
                  const client = modal.client!
                  convertirEnClient(client.id)
                  toast.success(`${client.prenom} ${client.nom} converti en client`, {
                    description: 'Mandat envoyé · daté à aujourd\'hui',
                    action: {
                      label: 'Voir',
                      onClick: () => navigate('/clients'),
                    },
                  })
                  setModal(null)
                  navigate('/clients')
                }}
              >
                <UserCheck className="h-4 w-4" /> Confirmer la conversion
              </button>
            </>
          }
        >
          <p className="text-sm text-navy-700">
            Cette opération marque l'envoi du mandat à <strong>{modal.client.prenom} {modal.client.nom}</strong>.
            La date du jour sera enregistrée comme date de bascule.
          </p>
        </Modal>
      )}

      {modal?.type === 'delete' && modal.client && (
        <Modal
          open
          onClose={() => setModal(null)}
          title="Supprimer le client"
          description={`Cette action est irréversible. Les dossiers et notes associés seront également supprimés.`}
          size="sm"
          actions={
            <>
              <button className="btn-outline" onClick={() => setModal(null)}>Annuler</button>
              <button
                className="btn bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => {
                  deleteClient(modal.client!.id)
                  toast.success(`Client ${modal.client!.prenom} ${modal.client!.nom} supprimé`)
                  setModal(null)
                }}
              >
                <Trash2 className="h-4 w-4" /> Supprimer définitivement
              </button>
            </>
          }
        >
          <p className="text-sm text-navy-700">
            Vous êtes sur le point de supprimer <strong>{modal.client.prenom} {modal.client.nom}</strong>
            {(modal.client.dossierIds?.length ?? 0) > 0 && (
              <> et ses <strong>{modal.client.dossierIds?.length ?? 0} dossier(s)</strong> associé(s)</>
            )}.
          </p>
        </Modal>
      )}
    </>
  )
}

function ClientFormModal({
  initial,
  mode,
  onClose,
  onSave,
}: {
  initial?: Client
  mode: 'prospect' | 'client'
  onClose: () => void
  onSave: (data: Omit<Client, 'id' | 'createdAt' | 'lastActivity' | 'dossierIds' | 'statutCommercial'>) => void
}) {
  // Fiche prospect/client. Suite au retour Sébastien 05/2026, on a séparé :
  //  - Ville d'adresse (≠ lieu de naissance, qui causait la confusion)
  //  - Conjoint structuré (prenom/nom/naissance séparés) au lieu d'un champ
  //    texte ambigu qui rangeait "AUJARD" dans prenom du co-emprunteur.
  const [f, setF] = useState({
    prenom: initial?.prenom ?? '',
    nom: initial?.nom ?? '',
    email: initial?.email ?? '',
    tel: initial?.tel ?? '',
    naissance: initial?.naissance ?? '',
    lieuNaissance: initial?.lieuNaissance ?? '',
    adresse: initial?.adresse ?? '',
    codePostal: initial?.codePostal ?? '',
    ville: initial?.ville ?? '',
    profession: initial?.profession ?? '',
    revenuMensuelNet: initial?.revenuMensuelNet ?? 0,
    apporteur: initial?.apporteur ?? '',
    apporteurId: initial?.apporteurId,
    notes: initial?.notes ?? '',
    // Bloc conjoint structuré (révélé par la coche)
    hasConjoint: !!(initial?.conjointPrenom || initial?.conjointNom || initial?.conjoint),
    conjointPrenom: initial?.conjointPrenom
      ?? (initial?.conjoint?.split(' ')[0] ?? ''),
    conjointNom: initial?.conjointNom
      ?? (initial?.conjoint?.split(' ').slice(1).join(' ') ?? ''),
    conjointNaissance: initial?.conjointNaissance ?? '',
    conjointLieuNaissance: initial?.conjointLieuNaissance ?? '',
    conjointTel: initial?.conjointTel ?? '',
    conjointEmail: initial?.conjointEmail ?? '',
    conjointProfession: initial?.conjointProfession ?? '',
  })

  // Suggestions code postal → ville (geo.api.gouv.fr)
  const [cpSuggestions, setCpSuggestions] = useState<string[]>([])
  useEffect(() => {
    if (!/^\d{5}$/.test(f.codePostal)) { setCpSuggestions([]); return }
    let cancelled = false
    void communesByCodePostal(f.codePostal).then((rows) => {
      if (cancelled) return
      const names = rows.map((r) => r.nom)
      setCpSuggestions(names)
      // Auto-fill si une seule commune correspond au CP et que ville vide
      if (names.length === 1 && !f.ville) {
        setF((p) => ({ ...p, ville: names[0] ?? '' }))
      }
    })
    return () => { cancelled = true }
  }, [f.codePostal, f.ville])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.prenom.trim() || !f.nom.trim() || !f.email.trim()) {
      toast.error('Prénom, nom et email sont obligatoires')
      return
    }
    // Reconstruit le champ legacy "conjoint" (string) à partir des champs
    // structurés pour préserver la compat avec les vues qui n'ont pas encore
    // migré (liste clients, recherche, etc.).
    const conjointLegacy = f.hasConjoint
      ? `${f.conjointPrenom} ${f.conjointNom}`.trim() || undefined
      : undefined
    onSave({
      prenom: f.prenom, nom: f.nom, email: f.email, tel: f.tel,
      naissance: f.naissance,
      lieuNaissance: f.lieuNaissance.trim() || undefined,
      adresse: f.adresse.trim() || undefined,
      codePostal: f.codePostal.trim() || undefined,
      ville: f.ville,
      profession: f.profession,
      revenuMensuelNet: f.revenuMensuelNet,
      apporteur: f.apporteur,
      apporteurId: f.apporteurId,
      notes: f.notes.trim() || undefined,
      conjoint: conjointLegacy,
      conjointPrenom: f.hasConjoint ? (f.conjointPrenom.trim() || undefined) : undefined,
      conjointNom: f.hasConjoint ? (f.conjointNom.trim() || undefined) : undefined,
      conjointNaissance: f.hasConjoint ? (f.conjointNaissance || undefined) : undefined,
      conjointLieuNaissance: f.hasConjoint ? (f.conjointLieuNaissance.trim() || undefined) : undefined,
      conjointTel: f.hasConjoint ? (f.conjointTel.trim() || undefined) : undefined,
      conjointEmail: f.hasConjoint ? (f.conjointEmail.trim() || undefined) : undefined,
      conjointProfession: f.hasConjoint ? (f.conjointProfession.trim() || undefined) : undefined,
    })
  }

  const age = ageFromBirthdate(f.naissance)
  const ageConjoint = ageFromBirthdate(f.conjointNaissance)

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `Modifier ${initial.prenom} ${initial.nom}` : `Nouveau ${mode === 'prospect' ? 'prospect' : 'client'}`}
      description="Fiche d'identité complète — vous pourrez créer un dossier ensuite"
      size="lg"
      actions={
        <>
          <button className="btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn-gold" onClick={submit}>
            {initial ? 'Enregistrer' : `Créer le ${mode === 'prospect' ? 'prospect' : 'client'}`}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        {/* ─── Identité principal ─── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gold-700 mb-2">Identité</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prénom *</label>
              <input className="input" value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} />
            </div>
            <div>
              <label className="label">Nom *</label>
              <input className="input" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} />
            </div>
            <div>
              <label className="label">
                Date de naissance
                {age !== null && <span className="ml-2 text-[10px] text-navy-500 font-normal">({age} ans)</span>}
              </label>
              <input type="date" className="input" value={f.naissance} onChange={(e) => setF({ ...f, naissance: e.target.value })} />
            </div>
            <div>
              <label className="label">Lieu de naissance</label>
              <input className="input" value={f.lieuNaissance} onChange={(e) => setF({ ...f, lieuNaissance: e.target.value })} placeholder="Ville de naissance" />
            </div>
            <div>
              <label className="label">Profession</label>
              <input className="input" value={f.profession} onChange={(e) => setF({ ...f, profession: e.target.value })} />
            </div>
            <div>
              <label className="label">Revenu net mensuel (€)</label>
              <input type="number" className="input"
                value={f.revenuMensuelNet === 0 ? '' : f.revenuMensuelNet}
                placeholder="0"
                onChange={(e) => setF({ ...f, revenuMensuelNet: Number(e.target.value || 0) })} />
            </div>
          </div>
        </div>

        {/* ─── Adresse postale ─── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gold-700 mb-2">Adresse</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Adresse</label>
              <input className="input" value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} placeholder="12 rue des Forges" />
            </div>
            <div>
              <label className="label">Code postal</label>
              <input className="input" value={f.codePostal}
                onChange={(e) => setF({ ...f, codePostal: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                placeholder="39570" maxLength={5} />
            </div>
            <div className="col-span-2">
              <label className="label">
                Ville d'adresse
                {cpSuggestions.length > 1 && <span className="ml-2 text-[10px] text-navy-500 font-normal">({cpSuggestions.length} communes pour ce CP)</span>}
              </label>
              {cpSuggestions.length > 1 ? (
                <select className="input" value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })}>
                  <option value="">— Choisir une commune —</option>
                  {cpSuggestions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input className="input" value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} placeholder="Ville d'habitation" />
              )}
            </div>
          </div>
        </div>

        {/* ─── Conjoint (coché → bloc complet) ─── */}
        <div>
          <label className="inline-flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" className="accent-gold-500" checked={f.hasConjoint}
              onChange={(e) => setF({ ...f, hasConjoint: e.target.checked })} />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gold-700">Conjoint présent</span>
          </label>
          {f.hasConjoint && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-navy-100 bg-navy-50/30 p-3">
              <div>
                <label className="label">Prénom</label>
                <input className="input" value={f.conjointPrenom} onChange={(e) => setF({ ...f, conjointPrenom: e.target.value })} />
              </div>
              <div>
                <label className="label">Nom</label>
                <input className="input" value={f.conjointNom} onChange={(e) => setF({ ...f, conjointNom: e.target.value })} />
              </div>
              <div>
                <label className="label">
                  Date de naissance
                  {ageConjoint !== null && <span className="ml-2 text-[10px] text-navy-500 font-normal">({ageConjoint} ans)</span>}
                </label>
                <input type="date" className="input" value={f.conjointNaissance} onChange={(e) => setF({ ...f, conjointNaissance: e.target.value })} />
              </div>
              <div>
                <label className="label">Lieu de naissance</label>
                <input className="input" value={f.conjointLieuNaissance} onChange={(e) => setF({ ...f, conjointLieuNaissance: e.target.value })} />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={f.conjointTel} onChange={(e) => setF({ ...f, conjointTel: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={f.conjointEmail} onChange={(e) => setF({ ...f, conjointEmail: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Profession</label>
                <input className="input" value={f.conjointProfession} onChange={(e) => setF({ ...f, conjointProfession: e.target.value })} />
              </div>
            </div>
          )}
        </div>

        {/* ─── Notes ─── */}
        {/* Note 2026-05 : champ "Apporteur" déplacé sur le dossier (section Meta).
            L'apporteur est rattaché au dossier, pas au prospect — un même prospect
            peut avoir 2 dossiers via 2 apporteurs différents. */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gold-700 mb-2">Notes internes</div>
          <textarea className="input min-h-[80px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })}
            placeholder="Remarques internes : contexte, attentes du prospect, suivi commercial…" />
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
