import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Trash2, Save, Plus } from 'lucide-react'
import { toast } from 'sonner'
import FullScreenSheet from './FullScreenSheet'
import {
  type Pret, type PretType, type PretStatut, type GarantieType, type PretProfilAmortissement,
  PRET_TYPE_LABEL, PRET_STATUT_LABEL, GARANTIE_LABEL, PRET_PROFIL_LABEL,
  type Banque,
} from '@/data/mock'
import { calcMensualite, calcMensualiteAssurance, calcTAEG, calcTAEA } from '@/lib/finance'
import { validatePtz, type PtzValidationInput, type PtzValidation } from '@/lib/ptz'
import type { Dossier, Client } from '@/data/mock'
import { banquesScoring, type BanqueScoring } from '@/db/api'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  /** Si fourni : édition. Sinon : création. */
  pret?: Pret
  /** Pour pré-remplir et brancher au dossier. */
  dossierId: string
  /** Pour le rang de tri à la création (= prets.length actuels). */
  defaultRang?: number
  banques: Banque[]
  /** Dossier pour les règles métier (PTZ, TAEG…). */
  dossier?: Dossier
  /** Client pour la composition foyer (PTZ). */
  client?: Client
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

export default function PretEditor({ open, pret, dossierId, defaultRang = 0, banques, dossier, client, onClose, onSave, onDelete }: Props) {
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

  // Score d'accord historique par banque (cabinet, 12 derniers mois)
  const [scoring, setScoring] = useState<Record<string, BanqueScoring>>({})
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void banquesScoring.list()
      .then((rows) => {
        if (cancelled) return
        const map: Record<string, BanqueScoring> = {}
        for (const r of rows) map[r.banque.toLowerCase()] = r
        setScoring(map)
      })
      .catch(() => { /* silencieux : le badge est juste informatif, pas critique */ })
    return () => { cancelled = true }
  }, [open])

  const currentBanqueScoring = useMemo(() => {
    const name = (f.banque ?? '').trim().toLowerCase()
    if (!name) return null
    return scoring[name] ?? null
  }, [f.banque, scoring])

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

  // Frais initiaux pris en compte dans le TAEG (article R.314-4 CCons.)
  const fraisInit = (f.fraisDossier ?? 0) + (f.fraisBanque ?? 0) + (f.garantieMontant ?? 0)

  const taeg = useMemo(
    () => calcTAEG(f.montant, mensualiteHA, f.dureeMois, fraisInit),
    [f.montant, f.dureeMois, mensualiteHA, fraisInit],
  )
  const taea = useMemo(
    () => calcTAEA(f.montant, mensualiteHA, mensualiteAss, f.dureeMois, fraisInit),
    [f.montant, f.dureeMois, mensualiteHA, mensualiteAss, fraisInit],
  )

  // Validation PTZ — calculée en live quand le type est PTZ et que le dossier est dispo
  const ptzValidation: PtzValidation | null = useMemo(() => {
    if (f.type !== 'ptz') return null
    if (!dossier) return null

    // Données extraites du dossier (zone, RFR, etc.)
    const zone = (dossier as unknown as { ptzZone?: 'A_bis' | 'A' | 'B1' | 'B2' | 'C' }).ptzZone ?? null
    const isNeufCollectif = dossier.typeAchat === 'Neuf' || dossier.typeAchat === 'VEFA'
    const isAncienAvecTravaux = (dossier.typeAchat === 'Ancien' || dossier.typeAchat === 'Travaux')
    const nature: PtzValidationInput['nature'] = isNeufCollectif ? 'neuf_collectif' : isAncienAvecTravaux ? 'ancien_avec_travaux' : null

    // Composition foyer : emprunteur + co-emprunteur + enfants
    const e1 = dossier.emprunteur1 as { enfantsACharge?: number; primoAccedant?: boolean } | undefined
    const enfants = e1?.enfantsACharge ?? 0
    const nbAdultes = dossier.emprunteur2 ? 2 : 1
    const nbOccupants = nbAdultes + enfants

    // Primo-accédant : champ explicite emprunteur1.primoAccedant (à ajouter)
    const primo = e1?.primoAccedant === true

    // RFR-N-2 : on prend le rfReferenceN2 du dossier, fallback rfMenage / rfReferenceN1
    const rfr = dossier.rfReferenceN2 ?? dossier.rfReferenceN1 ?? dossier.rfMenage ?? 0

    // Coût opération
    const coutOp = (dossier.coutLogement ?? dossier.montantBien ?? 0)
      + (dossier.coutTerrain ?? 0)
      + (dossier.coutTravaux ?? 0)
      + (dossier.fraisNotaire ?? 0)
      + (dossier.fraisAgence ?? 0)
    const coutTrav = dossier.coutTravaux ?? 0

    return validatePtz({
      zone,
      nature,
      destination: dossier.destination ?? null,
      primoAccedant: primo,
      rfrFoyer: rfr,
      nbOccupants,
      coutOperation: coutOp,
      coutTravaux: coutTrav,
      ville: dossier.villeBien ?? null,
    })
  }, [f.type, dossier])

  // Auto-fill durée + différé pour PTZ si tranche déterminée
  const ptzAutoFilled = useMemo(() => Boolean(f.type === 'ptz' && ptzValidation?.tranche != null), [f.type, ptzValidation])

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

    // Validation PTZ : bloque la création si non éligible (sauf override admin futur)
    if (f.type === 'ptz' && ptzValidation && !ptzValidation.eligible) {
      toast.error('PTZ non éligible', {
        description: ptzValidation.blocages[0] ?? 'Conditions non remplies',
        duration: 8000,
      })
      return
    }
    // Vérifie que le montant PTZ ne dépasse pas le max calculé
    if (f.type === 'ptz' && ptzValidation && ptzValidation.eligible && f.montant > ptzValidation.montantMax) {
      toast.error(`Montant PTZ trop élevé`, {
        description: `Maximum autorisé : ${ptzValidation.montantMax.toLocaleString('fr-FR')} €`,
        duration: 8000,
      })
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
      // TAEG/TAEA calculés à la sauvegarde (recalculés à l'affichage si paramètres changent)
      taeg: taeg > 0 ? Number(taeg.toFixed(3)) : undefined,
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
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifier le prêt' : 'Nouveau prêt'}
      description={isEdit ? 'Édition d\'une composante du plan de financement' : 'Ajouter une composante au plan de financement'}
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
      <form onSubmit={submit} className="space-y-4 max-w-5xl mx-auto">
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
              {banques.map((b) => {
                const sc = scoring[b.nom.toLowerCase()]
                const suffix = sc ? ` · ${sc.tauxAccordPct}% accord (${sc.envois})` : ''
                return (
                  <option key={b.id} value={b.id}>{b.nom}{suffix}</option>
                )
              })}
            </select>
          </div>
          <div>
            <label className="label">Nom banque (libre)</label>
            <input className="input" value={f.banque} onChange={(e) => setF({ ...f, banque: e.target.value })} placeholder="Ex: État (PTZ)" />
          </div>
        </div>

        {/* Score historique de la banque sélectionnée (cabinet, 12 mois) */}
        {currentBanqueScoring && (
          <div className={cn(
            'rounded-lg border p-2.5 text-xs flex items-center gap-2',
            currentBanqueScoring.tauxAccordPct >= 70 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
            currentBanqueScoring.tauxAccordPct >= 40 ? 'bg-gold-50 border-gold-200 text-gold-900' :
            'bg-rose-50 border-rose-200 text-rose-900',
          )}>
            <TrendingUp className="h-4 w-4 shrink-0" />
            <span>
              <strong>Historique cabinet 12 mois :</strong>{' '}
              {currentBanqueScoring.accords} accord{currentBanqueScoring.accords > 1 ? 's' : ''} sur {currentBanqueScoring.envois} envoi{currentBanqueScoring.envois > 1 ? 's' : ''} → <strong>{currentBanqueScoring.tauxAccordPct} % d'acceptation</strong> avec cette banque.
              {currentBanqueScoring.tauxAccordPct < 40 && ' Taux faible — vérifie que le profil colle bien à leur cible.'}
            </span>
          </div>
        )}

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

        {/* TAEG / TAEA — calcul actuariel conforme art. R.314-3 CCons. */}
        <div className="rounded-lg bg-gradient-to-br from-gold-50/40 to-white border border-gold-200 p-3">
          <div className="text-[11px] text-gold-700 uppercase tracking-wider font-semibold mb-2">
            TAEG / TAEA — Coût total réel
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field
              label="TAEG"
              value={taeg > 0 ? `${taeg.toFixed(3)} %` : '—'}
              highlight
            />
            <Field
              label="TAEA"
              value={taea > 0 ? `${taea.toFixed(3)} %` : '—'}
            />
            <Field
              label="Frais initiaux"
              value={`${fraisInit.toLocaleString('fr-FR')} €`}
            />
          </div>
          <div className="text-[10px] text-navy-500 mt-2">
            <strong>TAEG</strong> = taux + frais (dossier, garantie, banque) — hors assurance facultative.
            <strong> TAEA</strong> = coût annuel de l'ADI ramené en taux équivalent.
          </div>
        </div>

        {/* Validation PTZ — bandeau coloré selon éligibilité */}
        {ptzValidation && (
          <div className={`rounded-lg border p-3 ${
            ptzValidation.eligible
              ? 'bg-emerald-50/40 border-emerald-200'
              : 'bg-rose-50/40 border-rose-300'
          }`}>
            <div className={`text-[11px] uppercase tracking-wider font-semibold mb-2 ${
              ptzValidation.eligible ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {ptzValidation.eligible ? '✓ PTZ éligible' : '✗ PTZ non éligible'}
            </div>

            {ptzValidation.eligible && (
              <>
                <div className="grid grid-cols-3 gap-4 mb-2">
                  <Field label="Tranche" value={ptzValidation.tranche ? `Tranche ${ptzValidation.tranche}` : '—'} />
                  <Field label="Quotité" value={`${(ptzValidation.quotite * 100).toFixed(0)} %`} />
                  <Field label="Montant max" value={`${ptzValidation.montantMax.toLocaleString('fr-FR')} €`} highlight />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Durée totale" value={`${ptzValidation.dureeMois / 12} ans`} />
                  <Field label="Différé d'amortissement" value={ptzValidation.differeMois > 0 ? `${ptzValidation.differeMois / 12} ans` : 'Aucun'} />
                </div>
                {f.montant > 0 && f.montant > ptzValidation.montantMax && (
                  <div className="mt-2 text-xs text-rose-700 bg-rose-100 rounded p-2">
                    ⚠️ Montant saisi ({f.montant.toLocaleString('fr-FR')} €) supérieur au montant PTZ max autorisé ({ptzValidation.montantMax.toLocaleString('fr-FR')} €).
                  </div>
                )}
                {f.dureeMois !== ptzValidation.dureeMois && ptzAutoFilled && (
                  <button
                    type="button"
                    onClick={() => setF({ ...f, dureeMois: ptzValidation.dureeMois, differeAmortissement: ptzValidation.differeMois, tauxNominal: 0 })}
                    className="mt-2 text-xs text-gold-700 hover:underline"
                  >
                    → Pré-remplir durée {ptzValidation.dureeMois / 12} ans + différé {ptzValidation.differeMois / 12} ans + taux 0 %
                  </button>
                )}
              </>
            )}

            {ptzValidation.blocages.length > 0 && (
              <div className="mt-2 text-xs text-rose-700 space-y-1">
                <div className="font-semibold">Blocages :</div>
                <ul className="list-disc pl-4">
                  {ptzValidation.blocages.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}

            {ptzValidation.warnings.length > 0 && (
              <div className="mt-2 text-xs text-amber-800 space-y-1">
                <div className="font-semibold">⚠️ Avertissements :</div>
                <ul className="list-disc pl-4">
                  {ptzValidation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div className="text-[10px] text-navy-500 mt-2 italic">
              Réglementation : arrêté du 28 décembre 2023, modifié 1er avril 2024.
              <a href="https://www.service-public.fr/particuliers/vosdroits/F10871" target="_blank" rel="noopener" className="ml-1 text-gold-700 hover:underline">
                Détails ↗
              </a>
            </div>
          </div>
        )}

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
    </FullScreenSheet>
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
