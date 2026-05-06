/**
 * FactureFormModal — modale en 2 étapes :
 *  1) Choix du type de facture (4 émissions + 4 avoirs, façon Cifacil)
 *  2) Formulaire détaillé (montants, dates, partenaire, prestation, etc.)
 *
 * Si `dossier` est fourni, le client/banque/apporteur sont préremplis depuis le dossier.
 * Si `mode = 'edit'`, le formulaire est ouvert directement à l'étape 2 avec les valeurs existantes.
 */
import { useEffect, useMemo, useState } from 'react'
import { X, FileText, Receipt, Banknote, Briefcase, RefreshCw, ArrowLeft, Printer, Mail } from 'lucide-react'
import { printFacture, buildFactureHtml } from '@/templates/facture'
import { sendMail } from '@/o365/mail'
import { toast } from 'sonner'
import { factures, type Facture, type FactureType, type FactureCreate, type FactureModeReglement } from '@/db/api'
import { useStore } from '@/stores/useStore'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  /** Si fourni, prérempli avec les données du dossier */
  dossierId?: string
  /** Mode édition : la facture existante */
  edit?: Facture | null
  onSaved?: (f: Facture) => void
}

const TYPE_OPTIONS: Array<{ value: FactureType; label: string; description: string; group: 'emission' | 'avoir'; Icon: typeof FileText }> = [
  { value: 'honoraires', label: 'Honoraires', description: 'Note d\'honoraires Apolline au client', group: 'emission', Icon: Receipt },
  { value: 'comm_banque', label: 'Commission bancaire', description: 'Refacturation de la commission de la banque', group: 'emission', Icon: Banknote },
  { value: 'comm_autre', label: 'Commission autre', description: 'Apporteur indépendant, partenaire, …', group: 'emission', Icon: Briefcase },
  { value: 'ristourne', label: 'Ristourne apporteur', description: 'Rétrocession à un apporteur', group: 'emission', Icon: FileText },
  { value: 'avoir_honoraires', label: 'Avoir sur honoraires', description: 'Annulation / remboursement', group: 'avoir', Icon: RefreshCw },
  { value: 'avoir_comm_banque', label: 'Avoir sur commission bancaire', description: '', group: 'avoir', Icon: RefreshCw },
  { value: 'avoir_comm_autre', label: 'Avoir sur commission autre', description: '', group: 'avoir', Icon: RefreshCw },
  { value: 'avoir_ristourne', label: 'Avoir sur ristourne', description: '', group: 'avoir', Icon: RefreshCw },
]

const TVA_DEFAULT_BY_TYPE: Record<FactureType, number> = {
  honoraires: 0.20,
  comm_banque: 0,
  comm_autre: 0.20,
  ristourne: 0,
  avoir_honoraires: 0.20,
  avoir_comm_banque: 0,
  avoir_comm_autre: 0.20,
  avoir_ristourne: 0,
}

const MODE_REGLEMENT_LABEL: Record<FactureModeReglement, string> = {
  virement: 'Virement', cheque: 'Chèque', prelevement: 'Prélèvement', cb: 'CB',
  numeraire: 'Numéraire', via_notaire: 'Via notaire', via_banque: 'Via banque', autre: 'Autre',
}

export default function FactureFormModal({ open, onClose, dossierId, edit, onSaved }: Props) {
  const dossiers = useStore((s) => s.dossiers)
  const clients = useStore((s) => s.clients)
  const banques = useStore((s) => s.banques)
  const apporteurs = useStore((s) => s.apporteurs)

  const [step, setStep] = useState<1 | 2>(edit ? 2 : 1)
  const [type, setType] = useState<FactureType>(edit?.type ?? 'honoraires')
  const [saving, setSaving] = useState(false)
  // Si la modale est ouverte sans dossier (mode global), l'utilisateur le choisit ici.
  const [pickedDossierId, setPickedDossierId] = useState<string>(edit?.dossierId ?? dossierId ?? '')
  const [dossierSearch, setDossierSearch] = useState('')

  const effectiveDossierId = edit?.dossierId ?? dossierId ?? pickedDossierId

  const selectedDossier = useMemo(
    () => dossiers.find((d) => d.id === effectiveDossierId),
    [dossiers, effectiveDossierId],
  )
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedDossier?.clientId),
    [clients, selectedDossier],
  )

  // Form state
  const [montantHt, setMontantHt] = useState<string>(edit ? String(edit.montantHt / 100) : '')
  const [tvaTaux, setTvaTaux] = useState<number>(edit?.tvaTaux ?? TVA_DEFAULT_BY_TYPE[edit?.type ?? 'honoraires'])
  const [partenaireNom, setPartenaireNom] = useState(edit?.partenaireNom ?? '')
  const [partenaireEmail, setPartenaireEmail] = useState(edit?.partenaireEmail ?? '')
  const [partenaireId, setPartenaireId] = useState<string>(edit?.partenaireId ?? '')
  const [emiseLe, setEmiseLe] = useState(edit?.emiseLe?.slice(0, 10) ?? '')
  const [echeanceLe, setEcheanceLe] = useState(edit?.echeanceLe?.slice(0, 10) ?? '')
  const [acteLe, setActeLe] = useState(edit?.acteLe?.slice(0, 10) ?? '')
  const [modeReglement, setModeReglement] = useState<FactureModeReglement | ''>(edit?.modeReglement ?? '')
  const [prestation, setPrestation] = useState(edit?.prestation ?? '')
  const [commentaire, setCommentaire] = useState(edit?.commentaire ?? '')

  // Reset quand on ouvre une nouvelle modale
  useEffect(() => {
    if (!open) return
    if (edit) {
      setStep(2)
      setType(edit.type)
      setMontantHt(String(edit.montantHt / 100))
      setTvaTaux(edit.tvaTaux)
      setPartenaireNom(edit.partenaireNom ?? '')
      setPartenaireEmail(edit.partenaireEmail ?? '')
      setPartenaireId(edit.partenaireId ?? '')
      setEmiseLe(edit.emiseLe?.slice(0, 10) ?? '')
      setEcheanceLe(edit.echeanceLe?.slice(0, 10) ?? '')
      setActeLe(edit.acteLe?.slice(0, 10) ?? '')
      setModeReglement(edit.modeReglement ?? '')
      setPrestation(edit.prestation ?? '')
      setCommentaire(edit.commentaire ?? '')
    } else {
      setStep(1)
      setType('honoraires')
      setTvaTaux(TVA_DEFAULT_BY_TYPE.honoraires)
      setMontantHt('')
      setPartenaireNom('')
      setPartenaireEmail('')
      setPartenaireId('')
      setEmiseLe(new Date().toISOString().slice(0, 10))
      const echeance = new Date()
      echeance.setDate(echeance.getDate() + 30)
      setEcheanceLe(echeance.toISOString().slice(0, 10))
      setActeLe('')
      setModeReglement('')
      setPrestation('')
      setCommentaire('')
      setPickedDossierId(dossierId ?? '')
      setDossierSearch('')
    }
  }, [open, edit, dossierId])

  // À chaque changement de type : reset TVA + auto-prefill partenaire
  useEffect(() => {
    if (edit) return
    setTvaTaux(TVA_DEFAULT_BY_TYPE[type])
    if (!selectedClient || !selectedDossier) return
    if (type === 'honoraires' || type === 'avoir_honoraires') {
      setPartenaireNom(`${selectedClient.prenom} ${selectedClient.nom}`)
      setPartenaireEmail(selectedClient.email ?? '')
      setPartenaireId(selectedClient.id)
    } else if (type === 'comm_banque' || type === 'avoir_comm_banque') {
      // Banque : depuis les prêts du dossier (premier prêt avec banque)
      setPartenaireNom('')
      setPartenaireEmail('')
      setPartenaireId('')
    } else if (type === 'ristourne' || type === 'avoir_ristourne') {
      const apporteur = apporteurs.find((a) => a.id === selectedClient.apporteurId)
      if (apporteur) {
        setPartenaireNom(apporteur.nom)
        setPartenaireEmail(apporteur.email ?? '')
        setPartenaireId(apporteur.id)
      }
    } else {
      setPartenaireNom('')
      setPartenaireEmail('')
      setPartenaireId('')
    }
  }, [type, edit, selectedClient, selectedDossier, apporteurs])

  if (!open) return null

  const partenaireType: FactureCreate['partenaireType'] =
    type === 'honoraires' || type === 'avoir_honoraires' ? 'client' :
    type === 'comm_banque' || type === 'avoir_comm_banque' ? 'banque' :
    type === 'ristourne' || type === 'avoir_ristourne' ? 'apporteur' :
    'autre'

  const montantHtNum = Number(montantHt.replace(',', '.')) || 0
  const montantTvaNum = Math.round(montantHtNum * tvaTaux * 100) / 100
  const montantTtcNum = Math.round((montantHtNum + montantTvaNum) * 100) / 100

  const save = async () => {
    if (!selectedDossier) {
      toast.error('Aucun dossier sélectionné')
      return
    }
    if (montantHtNum <= 0) {
      toast.error('Montant HT requis')
      return
    }
    setSaving(true)
    try {
      const payload: FactureCreate & { statut?: 'prevue' | 'emise' } = {
        type,
        dossierId: selectedDossier.id,
        clientId: selectedDossier.clientId,
        partenaireType,
        partenaireId: partenaireId || null,
        partenaireNom: partenaireNom || null,
        partenaireEmail: partenaireEmail || null,
        montantHt: montantHtNum,
        tvaTaux,
        emiseLe: emiseLe || null,
        echeanceLe: echeanceLe || null,
        acteLe: acteLe || null,
        modeReglement: (modeReglement || null) as FactureCreate['modeReglement'],
        statut: emiseLe ? 'emise' : 'prevue',
        prestation: prestation || null,
        commentaire: commentaire || null,
      }
      const res = edit
        ? await factures.update(edit.id, payload)
        : await factures.create(payload)
      const f = ('facture' in res ? res.facture : null) as Facture | null
      if (f) {
        toast.success(edit ? `Facture ${f.ref} modifiée` : `Facture ${f.ref} créée`, {
          description: `${(f.montantTtc / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} TTC`,
        })
        onSaved?.(f)
        onClose()
      }
    } catch (e) {
      toast.error('Échec', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-white rounded-xl2 shadow-raised overflow-hidden animate-scale-in flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 px-5 py-3 border-b border-navy-100">
          <Receipt className="h-5 w-5 text-gold-700" />
          <h2 className="font-serif text-lg text-navy-900 flex-1">
            {edit ? `Modifier ${edit.ref}` : step === 1 ? 'Nouvelle facture' : 'Détails de la facture'}
          </h2>
          {step === 2 && !edit && (
            <button onClick={() => setStep(1)} className="btn-ghost text-xs">
              <ArrowLeft className="h-3.5 w-3.5" /> Retour
            </button>
          )}
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-navy-50 flex items-center justify-center text-navy-400">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 ? (
            <>
              <div className="mb-3">
                <div className="kicker mb-2">Émissions</div>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_OPTIONS.filter((o) => o.group === 'emission').map((o) => (
                    <TypeButton key={o.value} option={o} selected={type === o.value} onClick={() => setType(o.value)} />
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <div className="kicker mb-2">Avoirs (annulation)</div>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_OPTIONS.filter((o) => o.group === 'avoir').map((o) => (
                    <TypeButton key={o.value} option={o} selected={type === o.value} onClick={() => setType(o.value)} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Sélecteur dossier — visible quand on lance la modale en global (sans dossierId/edit) */}
              {!edit && !dossierId && (
                <div>
                  <div className="kicker mb-1.5">Dossier *</div>
                  {selectedDossier ? (
                    <div className="rounded-lg border border-gold-300 bg-gold-50/60 p-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-navy-900">{selectedDossier.ref}</div>
                        <div className="text-xs text-navy-700 truncate">{selectedDossier.clientNom} · {selectedDossier.typeProjet}{selectedDossier.villeBien ? ` · ${selectedDossier.villeBien}` : ''}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPickedDossierId(''); setDossierSearch('') }}
                        className="text-xs text-navy-500 hover:text-rose-600"
                      >
                        Changer
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        className="input"
                        value={dossierSearch}
                        onChange={(e) => setDossierSearch(e.target.value)}
                        placeholder="Rechercher un dossier (ref, client, ville)…"
                        autoFocus
                      />
                      {dossierSearch.trim().length >= 1 && (
                        <div className="mt-1 max-h-48 overflow-y-auto border border-navy-100 rounded-lg bg-white divide-y divide-navy-50">
                          {(() => {
                            const q = dossierSearch.trim().toLowerCase()
                            const filtered = dossiers
                              .filter((d) => !d.archive)
                              .filter((d) =>
                                d.ref.toLowerCase().includes(q) ||
                                d.clientNom.toLowerCase().includes(q) ||
                                (d.villeBien ?? '').toLowerCase().includes(q),
                              )
                              .slice(0, 30)
                            if (filtered.length === 0) {
                              return <div className="px-3 py-2 text-xs text-navy-400 italic">Aucun dossier ne correspond.</div>
                            }
                            return filtered.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => { setPickedDossierId(d.id); setDossierSearch('') }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gold-50 transition-colors flex items-center gap-2"
                              >
                                <span className="font-mono text-navy-800 shrink-0">{d.ref}</span>
                                <span className="text-navy-600 truncate">{d.clientNom}</span>
                                <span className="text-navy-400 ml-auto shrink-0">{d.typeProjet}</span>
                              </button>
                            ))
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Récap dossier en haut (mode édition / lancée depuis un dossier) */}
              {selectedDossier && (edit || dossierId) && (
                <div className="card-hover rounded-lg border border-navy-100 bg-navy-50/40 p-3 text-xs flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Dossier</div>
                    <div className="font-mono text-navy-800">{selectedDossier.ref}</div>
                    <div className="text-navy-700">{selectedDossier.clientNom} · {selectedDossier.typeProjet}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Type</div>
                    <div className="font-medium text-navy-800">{TYPE_OPTIONS.find((o) => o.value === type)?.label}</div>
                  </div>
                </div>
              )}

              {/* Partenaire */}
              <div>
                <div className="kicker mb-1.5">Partenaire / Bénéficiaire</div>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" value={partenaireNom} onChange={(e) => setPartenaireNom(e.target.value)} placeholder="Nom du partenaire" />
                  <input className="input" type="email" value={partenaireEmail} onChange={(e) => setPartenaireEmail(e.target.value)} placeholder="email@partenaire.com" />
                </div>
                {/* Sélecteur banque pour comm_banque */}
                {(type === 'comm_banque' || type === 'avoir_comm_banque') && banques.length > 0 && (
                  <select
                    className="input mt-2"
                    value={partenaireId}
                    onChange={(e) => {
                      const b = banques.find((x) => x.id === e.target.value)
                      setPartenaireId(e.target.value)
                      if (b) setPartenaireNom(b.nom)
                    }}
                  >
                    <option value="">— Choisir une banque —</option>
                    {banques.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
                  </select>
                )}
                {/* Sélecteur apporteur pour ristourne */}
                {(type === 'ristourne' || type === 'avoir_ristourne') && apporteurs.length > 0 && (
                  <select
                    className="input mt-2"
                    value={partenaireId}
                    onChange={(e) => {
                      const a = apporteurs.find((x) => x.id === e.target.value)
                      setPartenaireId(e.target.value)
                      if (a) {
                        setPartenaireNom(a.nom)
                        setPartenaireEmail(a.email ?? '')
                      }
                    }}
                  >
                    <option value="">— Choisir un apporteur —</option>
                    {apporteurs.map((a) => <option key={a.id} value={a.id}>{a.nom} · {a.type}</option>)}
                  </select>
                )}
              </div>

              {/* Montants */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="kicker mb-1.5 block">Montant HT (€)</label>
                  <input
                    className="input text-right tabular-nums"
                    type="text"
                    inputMode="decimal"
                    value={montantHt}
                    onChange={(e) => setMontantHt(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="kicker mb-1.5 block">TVA</label>
                  <select className="input" value={String(tvaTaux)} onChange={(e) => setTvaTaux(Number(e.target.value))}>
                    <option value="0">0% (exonéré)</option>
                    <option value="0.055">5,5%</option>
                    <option value="0.1">10%</option>
                    <option value="0.2">20%</option>
                  </select>
                </div>
                <div>
                  <label className="kicker mb-1.5 block">Montant TTC (€)</label>
                  <div className="input bg-navy-50/60 text-right tabular-nums font-semibold cursor-not-allowed select-none">
                    {montantTtcNum.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </div>
                </div>
              </div>
              {tvaTaux > 0 && (
                <div className="text-[11px] text-navy-500 -mt-1.5">
                  TVA collectée : {montantTvaNum.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="kicker mb-1.5 block">Émise le</label>
                  <input className="input" type="date" value={emiseLe} onChange={(e) => setEmiseLe(e.target.value)} />
                </div>
                <div>
                  <label className="kicker mb-1.5 block">Échéance</label>
                  <input className="input" type="date" value={echeanceLe} onChange={(e) => setEcheanceLe(e.target.value)} />
                </div>
                <div>
                  <label className="kicker mb-1.5 block">Date acte (notaire)</label>
                  <input className="input" type="date" value={acteLe} onChange={(e) => setActeLe(e.target.value)} />
                </div>
              </div>

              {/* Mode règlement */}
              <div>
                <label className="kicker mb-1.5 block">Mode de règlement (prévu)</label>
                <select className="input" value={modeReglement} onChange={(e) => setModeReglement(e.target.value as FactureModeReglement | '')}>
                  <option value="">— À définir —</option>
                  {Object.entries(MODE_REGLEMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              {/* Prestation */}
              <div>
                <label className="kicker mb-1.5 block">Prestation</label>
                <input
                  className="input"
                  value={prestation}
                  onChange={(e) => setPrestation(e.target.value)}
                  placeholder={
                    type === 'honoraires' ? 'Ex: Montage du dossier de prêt immobilier — courtage IOBSP' :
                    type === 'comm_banque' ? 'Ex: Commission sur prêt n° XXX' :
                    'Description de la prestation facturée'
                  }
                />
              </div>

              {/* Commentaire */}
              <div>
                <label className="kicker mb-1.5 block">Commentaire interne</label>
                <textarea
                  className="input"
                  rows={2}
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Visible uniquement en interne"
                />
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-navy-100 bg-ivory/40">
          {edit && step === 2 && (
            <>
              <button
                onClick={() => {
                  if (!selectedDossier) return
                  printFacture({
                    facture: edit,
                    dossier: selectedDossier as never,
                    client: (selectedClient ?? null) as never,
                  })
                }}
                className="btn-outline mr-auto"
                title="Ouvre dans une nouvelle fenêtre, puis Ctrl+P → Enregistrer en PDF"
              >
                <Printer className="h-4 w-4" /> Imprimer / PDF
              </button>
              {edit.partenaireEmail && (
                <button
                  onClick={async () => {
                    if (!selectedDossier || !edit.partenaireEmail) return
                    if (!confirm(`Envoyer la facture ${edit.ref} par email à ${edit.partenaireEmail} via Outlook ?`)) return
                    try {
                      const html = buildFactureHtml({
                        facture: edit,
                        dossier: selectedDossier as never,
                        client: (selectedClient ?? null) as never,
                      })
                      const isAvoir = edit.type.startsWith('avoir_')
                      const subject = `${isAvoir ? 'Avoir' : 'Facture'} ${edit.ref} — ${selectedDossier.ref}`
                      const body = `
<p>Bonjour,</p>
<p>Vous trouverez ci-joint ${isAvoir ? 'l\'avoir' : 'la facture'} <strong>${edit.ref}</strong>
${edit.echeanceLe ? ` à régler avant le ${new Date(edit.echeanceLe).toLocaleDateString('fr-FR')}` : ''}.</p>
${edit.prestation ? `<p><em>${edit.prestation}</em></p>` : ''}
<p>Bien cordialement,<br>Groupe Apolline</p>`
                      // Encode le HTML facture en base64 pour PJ
                      const encoder = new TextEncoder()
                      const bytes = encoder.encode(html)
                      const b64 = btoa(String.fromCharCode(...bytes))
                      await sendMail({
                        to: [edit.partenaireEmail],
                        subject,
                        body,
                        isHtml: true,
                        apollineDossierRef: selectedDossier.ref,
                        attachments: [{
                          name: `${edit.ref}.html`,
                          contentBytes: b64,
                          contentType: 'text/html',
                        }],
                      })
                      toast.success(`Email envoyé à ${edit.partenaireEmail}`)
                    } catch (e) {
                      toast.error('Échec envoi', { description: e instanceof Error ? e.message : String(e) })
                    }
                  }}
                  className="btn-outline"
                  title={`Envoyer à ${edit.partenaireEmail} via Outlook`}
                >
                  <Mail className="h-4 w-4" /> Envoyer
                </button>
              )}
            </>
          )}
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          {step === 1 ? (
            <button onClick={() => setStep(2)} className="btn-gold">Continuer</button>
          ) : (
            <button
              onClick={save}
              disabled={saving || !selectedDossier}
              className="btn-gold"
              title={!selectedDossier ? 'Sélectionnez un dossier' : undefined}
            >
              {saving ? 'Enregistrement…' : edit ? 'Mettre à jour' : 'Créer la facture'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function TypeButton({ option, selected, onClick }: {
  option: typeof TYPE_OPTIONS[number]
  selected: boolean
  onClick: () => void
}) {
  const { Icon } = option
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all',
        selected
          ? 'border-gold-500 bg-gold-50 ring-2 ring-gold-500/30'
          : 'border-navy-100 hover:border-navy-300 hover:bg-navy-50/40',
      )}
    >
      <div className={cn(
        'h-8 w-8 rounded-md flex items-center justify-center shrink-0',
        selected ? 'bg-gold-200 text-gold-800' : 'bg-navy-100 text-navy-600',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-navy-900">{option.label}</div>
        {option.description && <div className="text-[11px] text-navy-500 mt-0.5">{option.description}</div>}
      </div>
    </button>
  )
}
