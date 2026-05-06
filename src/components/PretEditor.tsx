import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Trash2, Save, Plus } from 'lucide-react'
import { toast } from 'sonner'
import Modal from './Modal'
import {
  type Pret, type PretType, type PretStatut, type GarantieType, type PretProfilAmortissement,
  PRET_TYPE_LABEL, PRET_STATUT_LABEL, GARANTIE_LABEL, PRET_PROFIL_LABEL,
  type Banque,
} from '@/data/mock'
import { calcMensualite, calcMensualiteAssurance } from '@/lib/finance'

type Props = {
  open: boolean
  /** Si fourni : édition. Sinon : création. */
  pret?: Pret
  /** Pour pré-remplir et brancher au dossier. */
  dossierId: string
  /** Pour le rang de tri à la création (= prets.length actuels). */
  defaultRang?: number
  banques: Banque[]
  onClose: () => void
  onSave: (data: Pret | Omit<Pret, 'id' | 'createdAt' | 'updatedAt'>) => void
  onDelete?: () => void
}

/**
 * Mensualité d'un amortissement classique (formule annuités constantes).
 * tauxAnnuelPct = taux nominal en %, ex 3.20.
 * Retourne en € entiers (arrondi).
 */
// calcMensualite + calcMensualiteAssurance sont maintenant dans @/lib/finance
// pour être réutilisés dans TabFinancement, skills IA, etc.
// Re-export local pour ne rien casser.

const TYPES_ORDER: PretType[] = ['amortissable', 'ptz', 'action_logement', 'epargne_logement', 'relais', 'in_fine', 'lissage']
const PROFILS_ORDER: PretProfilAmortissement[] = ['standard', 'paliers_lissage', 'in_fine', 'differe']
const STATUTS_ORDER: PretStatut[] = ['propose', 'accorde', 'offre_editee', 'signe', 'refuse', 'abandonne']
const GARANTIES_ORDER: GarantieType[] = ['credit_logement', 'hypotheque', 'ppd', 'caution_autre', 'nantissement', 'autre']

export default function PretEditor({ open, pret, dossierId, defaultRang = 0, banques, onClose, onSave, onDelete }: Props) {
  const isEdit = !!pret

  const buildState = () => {
    // Détecte si la mensualité stockée correspond au calcul auto avec les
    // paramètres actuels (à 2€ près pour absorber le rounding). Si oui : on
    // l'efface pour rester en mode auto (recalcul live). Sinon, on garde la
    // valeur (override manuel).
    const montant = pret?.montant ?? 0
    const tx = pret?.tauxNominal ?? 0
    const txA = pret?.tauxAssurance ?? 0
    const dur = pret?.dureeMois ?? 240
    const calcHA = calcMensualite(montant, tx, dur)
    const calcAss = calcMensualiteAssurance(montant, txA, dur)
    const storedHA = pret?.mensualiteHorsAssurance
    const storedAss = pret?.mensualiteAssurance
    // Considère "manuel" SEULEMENT si la valeur stockée diverge du calcul auto
    // ET que les paramètres montant/taux/durée sont positifs (cas valide).
    const isManualHA = storedHA != null && montant > 0 && Math.abs(storedHA - calcHA) > 2
    const isManualAss = storedAss != null && montant > 0 && Math.abs(storedAss - calcAss) > 2

    return {
      libelle: pret?.libelle ?? '',
      type: (pret?.type ?? 'amortissable') as PretType,
      profilAmortissement: (pret?.profilAmortissement ?? 'standard') as PretProfilAmortissement,
      rang: pret?.rang ?? defaultRang,
      banque: pret?.banque ?? '',
      banqueId: pret?.banqueId ?? '',
      sollicite: pret?.sollicite ?? true,
      commissionnable: pret?.commissionnable ?? true,
      montant,
      montantDebloque: pret?.montantDebloque ?? 0,
      dureeMois: dur,
      tauxNominal: tx,
      tauxAssurance: txA,
      differeAmortissement: pret?.differeAmortissement ?? 0,
      differeTotal: pret?.differeTotal ?? 0,
      revisable: pret?.revisable ?? false,
      modulable: pret?.modulable ?? false,
      garantieType: (pret?.garantieType ?? '') as '' | GarantieType,
      garantieMontant: pret?.garantieMontant ?? 0,
      fraisBanque: pret?.fraisBanque ?? 0,
      fraisDossier: pret?.fraisDossier ?? 0,
      commission: pret?.commission ?? 0,
      statut: (pret?.statut ?? 'propose') as PretStatut,
      numeroPretBanque: pret?.numeroPretBanque ?? '',
      dateOffre: pret?.dateOffre ?? '',
      dateSignature: pret?.dateSignature ?? '',
      notes: pret?.notes ?? '',
      couleur: pret?.couleur ?? '',
      // Reste en mode auto sauf si une vraie override manuelle est détectée
      mensualiteHorsAssuranceManuelle: isManualHA ? storedHA : undefined,
      mensualiteAssuranceManuelle: isManualAss ? storedAss : undefined,
    }
  }

  const [f, setF] = useState(buildState)

  useEffect(() => {
    if (!open) return
    setF(buildState())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pret, defaultRang])

  // Calcul auto des mensualités si pas saisi manuellement.
  // Le PTZ a souvent un différé total + mensualité 0 sur la phase de différé.
  const mensualiteHA = useMemo(() => {
    if (f.mensualiteHorsAssuranceManuelle != null) return f.mensualiteHorsAssuranceManuelle
    return calcMensualite(f.montant, f.tauxNominal, f.dureeMois)
  }, [f.montant, f.tauxNominal, f.dureeMois, f.mensualiteHorsAssuranceManuelle])

  const mensualiteAss = useMemo(() => {
    if (f.mensualiteAssuranceManuelle != null) return f.mensualiteAssuranceManuelle
    return calcMensualiteAssurance(f.montant, f.tauxAssurance, f.dureeMois)
  }, [f.montant, f.tauxAssurance, f.dureeMois, f.mensualiteAssuranceManuelle])

  const mensualiteTot = mensualiteHA + mensualiteAss

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (f.montant <= 0) {
      toast.error('Le montant doit être > 0 €')
      return
    }
    if (f.dureeMois <= 0) {
      toast.error('La durée doit être > 0 mois')
      return
    }

    const base: Omit<Pret, 'id' | 'createdAt' | 'updatedAt'> = {
      dossierId,
      rang: f.rang,
      libelle: f.libelle || undefined,
      type: f.type,
      profilAmortissement: f.profilAmortissement,
      banque: f.banque || undefined,
      banqueId: f.banqueId || undefined,
      sollicite: f.sollicite,
      commissionnable: f.commissionnable,
      montant: f.montant,
      montantDebloque: f.montantDebloque || undefined,
      dureeMois: f.dureeMois,
      tauxNominal: f.tauxNominal || undefined,
      tauxAssurance: f.tauxAssurance || undefined,
      mensualiteHorsAssurance: mensualiteHA || undefined,
      mensualiteAssurance: mensualiteAss || undefined,
      mensualiteTotale: mensualiteTot || undefined,
      differeAmortissement: f.differeAmortissement || undefined,
      differeTotal: f.differeTotal || undefined,
      revisable: f.revisable || undefined,
      modulable: f.modulable || undefined,
      garantieType: f.garantieType || undefined,
      garantieMontant: f.garantieMontant || undefined,
      fraisBanque: f.fraisBanque || undefined,
      fraisDossier: f.fraisDossier || undefined,
      commission: f.commission || undefined,
      statut: f.statut,
      numeroPretBanque: f.numeroPretBanque || undefined,
      dateOffre: f.dateOffre || undefined,
      dateSignature: f.dateSignature || undefined,
      notes: f.notes || undefined,
      couleur: f.couleur || undefined,
    }

    if (isEdit && pret) {
      onSave({ ...pret, ...base, updatedAt: new Date().toISOString() })
    } else {
      onSave(base)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifier le prêt' : 'Nouveau prêt'}
      description={isEdit ? 'Édition d\'une composante du plan de financement' : 'Ajouter une composante au plan de financement'}
      size="lg"
      actions={
        <>
          {isEdit && onDelete && (
            <button className="btn text-rose-700 hover:bg-rose-50 mr-auto" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </button>
          )}
          <button className="btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn-gold" onClick={() => submit()}>
            {isEdit ? <><Save className="h-4 w-4" /> Enregistrer</> : <><Plus className="h-4 w-4" /> Ajouter</>}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Libellé</label>
          <input
            className="input"
            value={f.libelle}
            onChange={(e) => setF({ ...f, libelle: e.target.value })}
            placeholder='Ex: "Prêt lissage TF - 25 ans"'
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Type réglementaire *</label>
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as PretType })}>
              {TYPES_ORDER.map((t) => (
                <option key={t} value={t}>{PRET_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Profil d'amortissement</label>
            <select className="input" value={f.profilAmortissement} onChange={(e) => setF({ ...f, profilAmortissement: e.target.value as PretProfilAmortissement })}>
              {PROFILS_ORDER.map((p) => (
                <option key={p} value={p}>{PRET_PROFIL_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={f.statut} onChange={(e) => setF({ ...f, statut: e.target.value as PretStatut })}>
              {STATUTS_ORDER.map((s) => (
                <option key={s} value={s}>{PRET_STATUT_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-gold-500" checked={f.sollicite}
              onChange={(e) => setF({ ...f, sollicite: e.target.checked })} />
            <span>Sollicité auprès de la banque</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-gold-500" checked={f.commissionnable}
              onChange={(e) => setF({ ...f, commissionnable: e.target.checked })} />
            <span>Commissionnable</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-gold-500" checked={f.revisable}
              onChange={(e) => setF({ ...f, revisable: e.target.checked })} />
            <span>Révisable</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-gold-500" checked={f.modulable}
              onChange={(e) => setF({ ...f, modulable: e.target.checked })} />
            <span>Modulable</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Banque</label>
            <select
              className="input"
              value={f.banqueId}
              onChange={(e) => {
                const b = banques.find((x) => x.id === e.target.value)
                setF({ ...f, banqueId: e.target.value, banque: b?.nom ?? f.banque })
              }}
            >
              <option value="">— Hors liste —</option>
              {banques.map((b) => (
                <option key={b.id} value={b.id}>{b.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nom banque (libre)</label>
            <input className="input" value={f.banque} onChange={(e) => setF({ ...f, banque: e.target.value })} placeholder="Ex: État (PTZ)" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Montant financé € *</label>
            <input type="number" className="input" value={f.montant} onChange={(e) => setF({ ...f, montant: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Montant débloqué € <span className="text-[10px] text-navy-400">(si différent)</span></label>
            <input type="number" className="input" value={f.montantDebloque} onChange={(e) => setF({ ...f, montantDebloque: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Durée (mois) *</label>
            <input type="number" className="input" value={f.dureeMois} onChange={(e) => setF({ ...f, dureeMois: Number(e.target.value) })} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Taux nominal % {f.type === 'ptz' && <span className="text-[10px] text-navy-400">(0% pour PTZ)</span>}</label>
            <input type="number" step="0.01" className="input" value={f.tauxNominal} onChange={(e) => setF({ ...f, tauxNominal: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Taux assurance %</label>
            <input type="number" step="0.01" className="input" value={f.tauxAssurance} onChange={(e) => setF({ ...f, tauxAssurance: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Frais banque €</label>
            <input type="number" className="input" value={f.fraisBanque} onChange={(e) => setF({ ...f, fraisBanque: Number(e.target.value) })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Différé d'amortissement (mois) <span className="text-[10px] text-navy-400">(partiel)</span></label>
            <input type="number" className="input" value={f.differeAmortissement} onChange={(e) => setF({ ...f, differeAmortissement: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Différé total (mois)</label>
            <input type="number" className="input" value={f.differeTotal} onChange={(e) => setF({ ...f, differeTotal: Number(e.target.value) })} />
          </div>
        </div>

        <div className="rounded-lg bg-navy-50/50 border border-navy-100 p-3">
          <div className="text-[11px] text-navy-500 uppercase tracking-wider font-semibold mb-2">Mensualités</div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Hors assurance (auto)" value={`${mensualiteHA} €`} />
            <Field label="Assurance (auto)" value={`${mensualiteAss} €`} />
            <Field label="Total" value={`${mensualiteTot} €`} highlight />
          </div>
          <div className="text-[10px] text-navy-400 mt-2 italic">
            Calcul auto à partir du montant, du taux et de la durée. Les mensualités saisies manuellement écrasent le calcul.
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Garantie</label>
            <select className="input" value={f.garantieType} onChange={(e) => setF({ ...f, garantieType: e.target.value as '' | GarantieType })}>
              <option value="">—</option>
              {GARANTIES_ORDER.map((g) => (
                <option key={g} value={g}>{GARANTIE_LABEL[g]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Coût garantie €</label>
            <input type="number" className="input" value={f.garantieMontant} onChange={(e) => setF({ ...f, garantieMontant: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Frais de dossier €</label>
            <input type="number" className="input" value={f.fraisDossier} onChange={(e) => setF({ ...f, fraisDossier: Number(e.target.value) })} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Commission courtier €</label>
            <input type="number" className="input" value={f.commission} onChange={(e) => setF({ ...f, commission: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">N° prêt banque</label>
            <input className="input" value={f.numeroPretBanque} onChange={(e) => setF({ ...f, numeroPretBanque: e.target.value })} placeholder="Référence côté banque" />
          </div>
          <div>
            <label className="label">Rang d'affichage</label>
            <input type="number" className="input" value={f.rang} onChange={(e) => setF({ ...f, rang: Number(e.target.value) })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date offre</label>
            <input type="date" className="input" value={f.dateOffre} onChange={(e) => setF({ ...f, dateOffre: e.target.value })} />
          </div>
          <div>
            <label className="label">Date signature</label>
            <input type="date" className="input" value={f.dateSignature} onChange={(e) => setF({ ...f, dateSignature: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[60px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>

        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className={`input bg-white cursor-default ${highlight ? 'font-semibold text-gold-700' : ''}`}>{value}</div>
    </div>
  )
}
