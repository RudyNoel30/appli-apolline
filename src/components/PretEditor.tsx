/**
 * PretEditor — fenêtre full-screen d'édition d'un prêt.
 *
 * Layout type "fenêtre d'application" (cohérent avec DossierEditor) :
 *  - Sidebar navy à gauche : navigation entre sections + KPIs synthèse live
 *  - Body au centre : section active
 *  - Footer plein largeur en bas : Supprimer / Annuler / Enregistrer
 *
 * Sections logiques :
 *  1. Identité           → libellé, type, profil, statut, flags
 *  2. Banque             → sélecteur banque + scoring + n° prêt + rang
 *  3. Montants & taux    → montant, durée, taux nominal, taux assurance
 *  4. Différés           → différé amortissement / total
 *  5. Garanties & frais  → type garantie, coûts, commission
 *  6. PTZ (conditionnel) → validation, montants max, durée, différé
 *  7. Dates & notes      → date offre, signature, notes
 *
 * KPIs live dans sidebar bas : mensualité HA, mensualité totale, TAEG, coût total.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  Trash2, Save, Plus, X, Tag, Building2, Coins, CalendarClock, ShieldCheck,
  FileSignature, StickyNote, TrendingUp, Award,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  type Pret, type PretType, type PretStatut, type GarantieType, type PretProfilAmortissement,
  PRET_TYPE_LABEL, PRET_STATUT_LABEL, GARANTIE_LABEL, PRET_PROFIL_LABEL,
  type Banque,
} from '@/data/mock'
import { calcMensualite, calcMensualiteAssurance, calcTAEG, calcTAEA } from '@/lib/finance'
import { validatePtz, type PtzValidationInput, type PtzValidation } from '@/lib/ptz'
import type { Dossier, Client } from '@/data/mock'
import { banquesScoring, type BanqueScoring } from '@/db/api'
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

const TYPES_ORDER: PretType[] = ['amortissable', 'ptz', 'action_logement', 'epargne_logement', 'relais', 'in_fine', 'lissage']
const PROFILS_ORDER: PretProfilAmortissement[] = ['standard', 'paliers_lissage', 'in_fine', 'differe']
const STATUTS_ORDER: PretStatut[] = ['propose', 'accorde', 'offre_editee', 'signe', 'refuse', 'abandonne']
const GARANTIES_ORDER: GarantieType[] = ['credit_logement', 'saccef', 'casden', 'hypotheque', 'ppd', 'caution_autre', 'nantissement', 'autre']

type SectionKey =
  | 'identite'
  | 'banque'
  | 'montants'
  | 'differes'
  | 'garanties'
  | 'ptz'
  | 'dates'

type SectionDef = {
  key: SectionKey
  label: string
  eyebrow: string
  icon: typeof Tag
}

const SECTIONS_BASE: SectionDef[] = [
  { key: 'identite',  label: 'Identité',          eyebrow: 'Type, profil, statut',      icon: Tag },
  { key: 'banque',    label: 'Banque',            eyebrow: 'Organisme & référence',     icon: Building2 },
  { key: 'montants',  label: 'Montants & taux',   eyebrow: 'Capital, durée, taux',      icon: Coins },
  { key: 'differes',  label: 'Différés',          eyebrow: 'Amortissement, total',      icon: CalendarClock },
  { key: 'garanties', label: 'Garanties & frais', eyebrow: 'Caution, dossier, agence',  icon: ShieldCheck },
  { key: 'dates',     label: 'Dates & notes',     eyebrow: 'Offre, signature, notes',   icon: StickyNote },
]

export default function PretEditor({ open, pret, dossierId, defaultRang = 0, banques, dossier, onClose, onSave, onDelete }: Props) {
  const isEdit = !!pret
  const [section, setSection] = useState<SectionKey>('identite')

  const buildState = () => {
    const montant = pret?.montant ?? 0
    const tx = pret?.tauxNominal ?? 0
    const txA = pret?.tauxAssurance ?? 0
    const dur = pret?.dureeMois ?? 240
    const calcHA = calcMensualite(montant, tx, dur)
    const calcAss = calcMensualiteAssurance(montant, txA, dur)
    const storedHA = pret?.mensualiteHorsAssurance
    const storedAss = pret?.mensualiteAssurance
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
      .catch(() => { /* silencieux */ })
    return () => { cancelled = true }
  }, [open])

  const currentBanqueScoring = useMemo(() => {
    const name = (f.banque ?? '').trim().toLowerCase()
    if (!name) return null
    return scoring[name] ?? null
  }, [f.banque, scoring])

  // Réinit du form quand on ouvre ou qu'on change de prêt
  useEffect(() => {
    if (!open) return
    setF(buildState())
    setSection('identite')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pret?.id])

  // Echap → ferme
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Calcul auto des mensualités
  const mensualiteHA = useMemo(() => {
    if (f.mensualiteHorsAssuranceManuelle != null) return f.mensualiteHorsAssuranceManuelle
    return calcMensualite(f.montant, f.tauxNominal, f.dureeMois)
  }, [f.montant, f.tauxNominal, f.dureeMois, f.mensualiteHorsAssuranceManuelle])

  const mensualiteAss = useMemo(() => {
    if (f.mensualiteAssuranceManuelle != null) return f.mensualiteAssuranceManuelle
    return calcMensualiteAssurance(f.montant, f.tauxAssurance, f.dureeMois)
  }, [f.montant, f.tauxAssurance, f.dureeMois, f.mensualiteAssuranceManuelle])

  const mensualiteTot = mensualiteHA + mensualiteAss

  const fraisInit = (f.fraisDossier ?? 0) + (f.fraisBanque ?? 0) + (f.garantieMontant ?? 0)

  const taeg = useMemo(
    () => calcTAEG(f.montant, mensualiteHA, f.dureeMois, fraisInit),
    [f.montant, f.dureeMois, mensualiteHA, fraisInit],
  )
  const taea = useMemo(
    () => calcTAEA(f.montant, mensualiteHA, mensualiteAss, f.dureeMois, fraisInit),
    [f.montant, f.dureeMois, mensualiteHA, mensualiteAss, fraisInit],
  )

  // Coût total du crédit (mensualité × durée − capital, hors frais initiaux pour rester comparable)
  const coutTotal = useMemo(() => {
    if (f.dureeMois <= 0 || mensualiteHA <= 0) return 0
    return Math.max(0, mensualiteHA * f.dureeMois - f.montant) + fraisInit
  }, [mensualiteHA, f.dureeMois, f.montant, fraisInit])

  // Validation PTZ
  const ptzValidation: PtzValidation | null = useMemo(() => {
    if (f.type !== 'ptz') return null
    if (!dossier) return null

    const zone = (dossier as unknown as { ptzZone?: 'A_bis' | 'A' | 'B1' | 'B2' | 'C' }).ptzZone ?? null
    const isNeufCollectif = dossier.typeAchat === 'Neuf' || dossier.typeAchat === 'VEFA'
    const isAncienAvecTravaux = (dossier.typeAchat === 'Ancien' || dossier.typeAchat === 'Travaux')
    const nature: PtzValidationInput['nature'] = isNeufCollectif ? 'neuf_collectif' : isAncienAvecTravaux ? 'ancien_avec_travaux' : null

    const e1 = dossier.emprunteur1 as { enfantsACharge?: number; primoAccedant?: boolean } | undefined
    const enfants = e1?.enfantsACharge ?? 0
    const nbAdultes = dossier.emprunteur2 ? 2 : 1
    const nbOccupants = nbAdultes + enfants
    const primo = e1?.primoAccedant === true

    const rfr = dossier.rfReferenceN2 ?? dossier.rfReferenceN1 ?? dossier.rfMenage ?? 0
    const coutOp = (dossier.coutLogement ?? dossier.montantBien ?? 0)
      + (dossier.coutTerrain ?? 0)
      + (dossier.coutTravaux ?? 0)
      + (dossier.fraisNotaire ?? 0)
      + (dossier.fraisAgence ?? 0)
    const coutTrav = dossier.coutTravaux ?? 0

    return validatePtz({
      zone, nature,
      destination: dossier.destination ?? null,
      primoAccedant: primo,
      rfrFoyer: rfr, nbOccupants,
      coutOperation: coutOp, coutTravaux: coutTrav,
      ville: dossier.villeBien ?? null,
    })
  }, [f.type, dossier])

  const ptzAutoFilled = useMemo(() => Boolean(f.type === 'ptz' && ptzValidation?.tranche != null), [f.type, ptzValidation])

  // Sections affichées (on injecte PTZ uniquement si type=ptz)
  const sections: SectionDef[] = useMemo(() => {
    if (f.type !== 'ptz') return SECTIONS_BASE
    // On insère PTZ juste après "Différés"
    const idx = SECTIONS_BASE.findIndex((s) => s.key === 'differes')
    return [
      ...SECTIONS_BASE.slice(0, idx + 1),
      { key: 'ptz' as SectionKey, label: 'PTZ', eyebrow: 'Éligibilité réglementaire', icon: Award },
      ...SECTIONS_BASE.slice(idx + 1),
    ]
  }, [f.type])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (f.montant <= 0) {
      toast.error('Le montant doit être > 0 €')
      setSection('montants')
      return
    }
    if (f.dureeMois <= 0) {
      toast.error('La durée doit être > 0 mois')
      setSection('montants')
      return
    }
    if (f.type === 'ptz' && ptzValidation && !ptzValidation.eligible) {
      toast.error('PTZ non éligible', {
        description: ptzValidation.blocages[0] ?? 'Conditions non remplies',
        duration: 8000,
      })
      setSection('ptz')
      return
    }
    if (f.type === 'ptz' && ptzValidation && ptzValidation.eligible && f.montant > ptzValidation.montantMax) {
      toast.error('Montant PTZ trop élevé', {
        description: `Maximum autorisé : ${ptzValidation.montantMax.toLocaleString('fr-FR')} €`,
        duration: 8000,
      })
      setSection('ptz')
      return
    }

    const base: Omit<Pret, 'id' | 'createdAt' | 'updatedAt'> = {
      dossierId, rang: f.rang,
      libelle: f.libelle || undefined,
      type: f.type, profilAmortissement: f.profilAmortissement,
      banque: f.banque || undefined, banqueId: f.banqueId || undefined,
      sollicite: f.sollicite, commissionnable: f.commissionnable,
      montant: f.montant, montantDebloque: f.montantDebloque || undefined,
      dureeMois: f.dureeMois,
      tauxNominal: f.tauxNominal || undefined,
      tauxAssurance: f.tauxAssurance || undefined,
      mensualiteHorsAssurance: mensualiteHA || undefined,
      mensualiteAssurance: mensualiteAss || undefined,
      mensualiteTotale: mensualiteTot || undefined,
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

  if (!open) return null

  // Portal vers document.body : la modale s'échappe de la hiérarchie React et
  // n'est donc plus containée par les transforms des ancêtres (.page, .page > *,
  // .tab-content, etc.). Garantie d'occuper TOUT le viewport en plein écran,
  // peu importe le contexte de rendu.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch animate-fade-in">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-ivory w-full m-6 rounded-xl2 shadow-raised flex overflow-hidden animate-scale-in">
        {/* ─── Sidebar gauche navy ─────────────────────────────────────── */}
        <aside className="w-72 shrink-0 bg-navy-900 text-navy-100 flex flex-col">
          <div className="px-5 py-5 border-b border-navy-800">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-300 font-semibold">
              {isEdit ? 'Édition prêt' : 'Nouveau prêt'}
            </div>
            <h2 className="font-serif text-xl text-white mt-1 truncate" title={f.libelle || PRET_TYPE_LABEL[f.type]}>
              {f.libelle || PRET_TYPE_LABEL[f.type]}
            </h2>
            <div className="text-xs text-navy-200 mt-1 truncate" title={f.banque || ''}>
              {f.banque || 'Banque non précisée'}
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {sections.map((sec) => (
              <button
                key={sec.key}
                type="button"
                onClick={() => setSection(sec.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition',
                  section === sec.key
                    ? 'bg-navy-700 text-white ring-1 ring-gold-500/30'
                    : 'text-navy-200 hover:bg-navy-800 hover:text-white',
                )}
              >
                <sec.icon className={cn('h-4 w-4', section === sec.key ? 'text-gold-400' : 'text-navy-300')} />
                <div className="flex-1 min-w-0">
                  <div>{sec.label}</div>
                  <div className="text-[10px] text-navy-400 truncate">{sec.eyebrow}</div>
                </div>
                {section === sec.key && <span className="h-1.5 w-1.5 rounded-full bg-gold-500 animate-pulse-soft" />}
              </button>
            ))}
          </nav>

          {/* KPIs synthèse live */}
          <div className="p-4 border-t border-navy-800">
            <div className="bg-navy-800/60 rounded-lg p-3 text-xs space-y-1.5">
              <KpiRow k="Mensualité HA" v={`${mensualiteHA.toLocaleString('fr-FR')} €`} />
              <KpiRow k="Mens. totale" v={`${mensualiteTot.toLocaleString('fr-FR')} €`} highlight />
              <KpiRow k="TAEG" v={taeg > 0 ? `${taeg.toFixed(2)} %` : '—'} />
              <KpiRow k="Coût crédit" v={`${Math.round(coutTotal).toLocaleString('fr-FR')} €`} />
            </div>
          </div>
        </aside>

        {/* ─── Body central + Footer ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="px-6 py-3 border-b border-navy-100 bg-white flex items-center gap-3 shrink-0">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">
                {sections.find((s) => s.key === section)?.eyebrow}
              </div>
              <h3 className="font-serif text-lg text-navy-900">
                {sections.find((s) => s.key === section)?.label}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-md hover:bg-navy-50 flex items-center justify-center text-navy-400 hover:text-navy-900 transition"
              title="Fermer (Échap)"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Body scrollable */}
          <form onSubmit={submit} className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto" key={section}>
              {section === 'identite' && (
                <SectionIdentite f={f} setF={setF} />
              )}

              {section === 'banque' && (
                <SectionBanque f={f} setF={setF} banques={banques} scoring={scoring} currentBanqueScoring={currentBanqueScoring} />
              )}

              {section === 'montants' && (
                <SectionMontants f={f} setF={setF} mensualiteHA={mensualiteHA} mensualiteAss={mensualiteAss} mensualiteTot={mensualiteTot} taeg={taeg} taea={taea} fraisInit={fraisInit} />
              )}

              {section === 'differes' && (
                <SectionDifferes f={f} setF={setF} />
              )}

              {section === 'garanties' && (
                <SectionGaranties f={f} setF={setF} />
              )}

              {section === 'ptz' && (
                <SectionPtz f={f} setF={setF} ptzValidation={ptzValidation} ptzAutoFilled={ptzAutoFilled} />
              )}

              {section === 'dates' && (
                <SectionDates f={f} setF={setF} />
              )}
            </div>
            <button type="submit" className="hidden" />
          </form>

          {/* Footer */}
          <footer className="px-6 py-3 border-t border-navy-100 bg-white flex items-center gap-2 shrink-0">
            {isEdit && onDelete && (
              <button type="button" className="btn text-rose-700 hover:bg-rose-50 mr-auto" onClick={onDelete}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>
            )}
            {!isEdit && <div className="flex-1" />}
            <button type="button" className="btn-outline" onClick={onClose}>Annuler</button>
            <button type="button" className="btn-gold" onClick={() => submit()}>
              {isEdit ? <><Save className="h-4 w-4" /> Enregistrer</> : <><Plus className="h-4 w-4" /> Ajouter</>}
            </button>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Sous-composants par section ──────────────────────────────────────────

type State = ReturnType<typeof initialState>
function initialState() {
  // Helper type-only — pas appelé à l'exec, juste pour inférer le type State du `f`
  return {
    libelle: '', type: 'amortissable' as PretType, profilAmortissement: 'standard' as PretProfilAmortissement,
    rang: 0, banque: '', banqueId: '', sollicite: true, commissionnable: true,
    montant: 0, montantDebloque: 0, dureeMois: 240, tauxNominal: 0, tauxAssurance: 0,
    differeAmortissement: 0, differeTotal: 0, revisable: false, modulable: false,
    garantieType: '' as '' | GarantieType, garantieMontant: 0, fraisBanque: 0, fraisDossier: 0,
    commission: 0, statut: 'propose' as PretStatut, numeroPretBanque: '',
    dateOffre: '', dateSignature: '', notes: '', couleur: '',
    mensualiteHorsAssuranceManuelle: undefined as number | undefined,
    mensualiteAssuranceManuelle: undefined as number | undefined,
  }
}
type SetF = React.Dispatch<React.SetStateAction<State>>

function SectionIdentite({ f, setF }: { f: State; setF: SetF }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="label">Libellé du prêt</label>
        <input
          className="input"
          value={f.libelle}
          onChange={(e) => setF({ ...f, libelle: e.target.value })}
          placeholder='Ex: "Prêt lissage TF - 25 ans"'
        />
        <div className="text-[11px] text-navy-400 mt-1">Optionnel — sert d'identifiant visuel dans les listes et graphiques.</div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Type réglementaire *</label>
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as PretType })}>
            {TYPES_ORDER.map((t) => <option key={t} value={t}>{PRET_TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Profil d'amortissement</label>
          <select className="input" value={f.profilAmortissement} onChange={(e) => setF({ ...f, profilAmortissement: e.target.value as PretProfilAmortissement })}>
            {PROFILS_ORDER.map((p) => <option key={p} value={p}>{PRET_PROFIL_LABEL[p]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Statut</label>
          <select className="input" value={f.statut} onChange={(e) => setF({ ...f, statut: e.target.value as PretStatut })}>
            {STATUTS_ORDER.map((s) => <option key={s} value={s}>{PRET_STATUT_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="label mb-2">Caractéristiques</div>
        <div className="grid grid-cols-2 gap-3">
          <FlagToggle label="Sollicité auprès de la banque" checked={f.sollicite} onChange={(v) => setF({ ...f, sollicite: v })} />
          <FlagToggle label="Commissionnable" checked={f.commissionnable} onChange={(v) => setF({ ...f, commissionnable: v })} />
          <FlagToggle label="Taux révisable" checked={f.revisable} onChange={(v) => setF({ ...f, revisable: v })} />
          <FlagToggle label="Modulable" checked={f.modulable} onChange={(v) => setF({ ...f, modulable: v })} />
        </div>
      </div>
    </div>
  )
}

function SectionBanque({ f, setF, banques, scoring, currentBanqueScoring }: {
  f: State; setF: SetF; banques: Banque[]
  scoring: Record<string, BanqueScoring>
  currentBanqueScoring: BanqueScoring | null
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Banque (catalogue)</label>
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
              return <option key={b.id} value={b.id}>{b.nom}{suffix}</option>
            })}
          </select>
        </div>
        <div>
          <label className="label">Nom banque (libre)</label>
          <input className="input" value={f.banque} onChange={(e) => setF({ ...f, banque: e.target.value })} placeholder="Ex: État (PTZ)" />
        </div>
      </div>

      {currentBanqueScoring && (
        <div className={cn(
          'rounded-lg border p-3 text-xs flex items-center gap-2',
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">N° prêt banque</label>
          <input className="input" value={f.numeroPretBanque} onChange={(e) => setF({ ...f, numeroPretBanque: e.target.value })} placeholder="Référence côté banque" />
        </div>
        <div>
          <label className="label">Rang d'affichage</label>
          <input type="number" className="input" value={f.rang} onChange={(e) => setF({ ...f, rang: Number(e.target.value) })} />
          <div className="text-[11px] text-navy-400 mt-1">Position dans le plan de financement (0 = premier).</div>
        </div>
      </div>
    </div>
  )
}

function SectionMontants({ f, setF, mensualiteHA, mensualiteAss, mensualiteTot, taeg, taea, fraisInit }: {
  f: State; setF: SetF
  mensualiteHA: number; mensualiteAss: number; mensualiteTot: number
  taeg: number; taea: number; fraisInit: number
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Montant financé € *</label>
          <input type="number" className="input" value={f.montant} onChange={(e) => setF({ ...f, montant: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Montant débloqué € <span className="text-[10px] text-navy-400">(si ≠)</span></label>
          <input type="number" className="input" value={f.montantDebloque} onChange={(e) => setF({ ...f, montantDebloque: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Durée (mois) *</label>
          <input type="number" className="input" value={f.dureeMois} onChange={(e) => setF({ ...f, dureeMois: Number(e.target.value) })} />
          {f.dureeMois > 0 && (
            <div className="text-[11px] text-navy-400 mt-1">≈ {(f.dureeMois / 12).toFixed(1)} ans</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Taux nominal % {f.type === 'ptz' && <span className="text-[10px] text-navy-400">(0% pour PTZ)</span>}</label>
          <input type="number" step="0.01" className="input" value={f.tauxNominal} onChange={(e) => setF({ ...f, tauxNominal: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Taux assurance %</label>
          <input type="number" step="0.01" className="input" value={f.tauxAssurance} onChange={(e) => setF({ ...f, tauxAssurance: Number(e.target.value) })} />
        </div>
      </div>

      <div className="rounded-lg bg-navy-50/50 border border-navy-100 p-4">
        <div className="text-[11px] text-navy-500 uppercase tracking-wider font-semibold mb-2">Mensualités</div>
        <div className="grid grid-cols-3 gap-4">
          <ReadField label="Hors assurance" value={`${mensualiteHA.toLocaleString('fr-FR')} €`} />
          <ReadField label="Assurance" value={`${mensualiteAss.toLocaleString('fr-FR')} €`} />
          <ReadField label="Total" value={`${mensualiteTot.toLocaleString('fr-FR')} €`} highlight />
        </div>
        <div className="text-[10px] text-navy-400 mt-2 italic">
          Calcul auto à partir du montant, du taux et de la durée. Une saisie manuelle dans un prêt édité écrase ce calcul.
        </div>
      </div>

      <div className="rounded-lg bg-gradient-to-br from-gold-50/40 to-white border border-gold-200 p-4">
        <div className="text-[11px] text-gold-700 uppercase tracking-wider font-semibold mb-2">TAEG / TAEA — Coût total réel</div>
        <div className="grid grid-cols-3 gap-4">
          <ReadField label="TAEG" value={taeg > 0 ? `${taeg.toFixed(3)} %` : '—'} highlight />
          <ReadField label="TAEA" value={taea > 0 ? `${taea.toFixed(3)} %` : '—'} />
          <ReadField label="Frais initiaux" value={`${fraisInit.toLocaleString('fr-FR')} €`} />
        </div>
        <div className="text-[10px] text-navy-500 mt-2">
          <strong>TAEG</strong> = taux + frais (dossier, garantie, banque) — hors assurance facultative.
          <strong> TAEA</strong> = coût annuel de l'ADI ramené en taux équivalent.
        </div>
      </div>
    </div>
  )
}

function SectionDifferes({ f, setF }: { f: State; setF: SetF }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-navy-50/40 border border-navy-100 p-3 text-xs text-navy-700">
        <strong>Différé partiel</strong> : pendant le différé, seuls les intérêts (et éventuellement l'assurance) sont payés.
        <strong className="ml-2">Différé total</strong> : aucune mensualité pendant la période (typique du PTZ).
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Différé d'amortissement (mois)</label>
          <input type="number" className="input" value={f.differeAmortissement} onChange={(e) => setF({ ...f, differeAmortissement: Number(e.target.value) })} />
          {f.differeAmortissement > 0 && (
            <div className="text-[11px] text-navy-400 mt-1">≈ {(f.differeAmortissement / 12).toFixed(1)} ans de différé partiel</div>
          )}
        </div>
        <div>
          <label className="label">Différé total (mois)</label>
          <input type="number" className="input" value={f.differeTotal} onChange={(e) => setF({ ...f, differeTotal: Number(e.target.value) })} />
          {f.differeTotal > 0 && (
            <div className="text-[11px] text-navy-400 mt-1">≈ {(f.differeTotal / 12).toFixed(1)} ans de différé total</div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionGaranties({ f, setF }: { f: State; setF: SetF }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Type de garantie</label>
          <select className="input" value={f.garantieType} onChange={(e) => setF({ ...f, garantieType: e.target.value as '' | GarantieType })}>
            <option value="">—</option>
            {GARANTIES_ORDER.map((g) => <option key={g} value={g}>{GARANTIE_LABEL[g]}</option>)}
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Frais banque €</label>
          <input type="number" className="input" value={f.fraisBanque} onChange={(e) => setF({ ...f, fraisBanque: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Commission courtier €</label>
          <input type="number" className="input" value={f.commission} onChange={(e) => setF({ ...f, commission: Number(e.target.value) })} />
          <div className="text-[11px] text-navy-400 mt-1">Honoraires perçus sur ce prêt — utilisé dans Commissions/Facturation.</div>
        </div>
      </div>
    </div>
  )
}

function SectionPtz({ f, setF, ptzValidation, ptzAutoFilled }: {
  f: State; setF: SetF
  ptzValidation: PtzValidation | null
  ptzAutoFilled: boolean
}) {
  if (!ptzValidation) {
    return (
      <div className="rounded-lg bg-navy-50 border border-navy-100 p-4 text-sm text-navy-700">
        Le dossier doit avoir une zone PTZ + une nature (neuf collectif / ancien avec travaux) renseignée pour activer la validation PTZ.
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-lg border p-4',
      ptzValidation.eligible ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-300',
    )}>
      <div className={cn(
        'text-[11px] uppercase tracking-wider font-semibold mb-3',
        ptzValidation.eligible ? 'text-emerald-700' : 'text-rose-700',
      )}>
        {ptzValidation.eligible ? '✓ PTZ éligible' : '✗ PTZ non éligible'}
      </div>

      {ptzValidation.eligible && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <ReadField label="Tranche" value={ptzValidation.tranche ? `Tranche ${ptzValidation.tranche}` : '—'} />
            <ReadField label="Quotité" value={`${(ptzValidation.quotite * 100).toFixed(0)} %`} />
            <ReadField label="Montant max" value={`${ptzValidation.montantMax.toLocaleString('fr-FR')} €`} highlight />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Durée totale" value={`${ptzValidation.dureeMois / 12} ans`} />
            <ReadField label="Différé d'amortissement" value={ptzValidation.differeMois > 0 ? `${ptzValidation.differeMois / 12} ans` : 'Aucun'} />
          </div>

          {/* Bouton de pré-remplissage complet : montant + durée + différé + taux 0 % */}
          {(f.montant !== ptzValidation.montantMax || f.dureeMois !== ptzValidation.dureeMois
            || f.differeAmortissement !== ptzValidation.differeMois || f.tauxNominal !== 0) && ptzAutoFilled && (
            <button
              type="button"
              onClick={() => setF({
                ...f,
                montant: ptzValidation.montantMax,
                dureeMois: ptzValidation.dureeMois,
                differeAmortissement: ptzValidation.differeMois,
                tauxNominal: 0,
              })}
              className="mt-4 w-full btn-gold text-sm justify-center"
            >
              <Award className="h-4 w-4" />
              Calculer le PTZ optimal — {ptzValidation.montantMax.toLocaleString('fr-FR')} € sur {ptzValidation.dureeMois / 12} ans (différé {ptzValidation.differeMois / 12} ans)
            </button>
          )}

          {f.montant > 0 && f.montant > ptzValidation.montantMax && (
            <div className="mt-3 text-xs text-rose-700 bg-rose-100 rounded p-2">
              ⚠️ Montant saisi ({f.montant.toLocaleString('fr-FR')} €) supérieur au max PTZ ({ptzValidation.montantMax.toLocaleString('fr-FR')} €).
            </div>
          )}
        </>
      )}

      {ptzValidation.blocages.length > 0 && (
        <div className="mt-3 text-xs text-rose-700">
          <div className="font-semibold mb-1">Blocages :</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {ptzValidation.blocages.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}
      {ptzValidation.warnings.length > 0 && (
        <div className="mt-3 text-xs text-amber-800">
          <div className="font-semibold mb-1">⚠️ Avertissements :</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {ptzValidation.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
      <div className="text-[10px] text-navy-500 mt-3 italic">
        Réglementation : arrêté du 28 décembre 2023, modifié 1er avril 2024.
        <a href="https://www.service-public.fr/particuliers/vosdroits/F10871" target="_blank" rel="noopener" className="ml-1 text-gold-700 hover:underline">
          Détails ↗
        </a>
      </div>
    </div>
  )
}

function SectionDates({ f, setF }: { f: State; setF: SetF }) {
  return (
    <div className="space-y-5">
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
        <label className="label">Notes <FileSignature className="inline h-3 w-3 text-navy-400 ml-1" /></label>
        <textarea className="input min-h-[120px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Remarques internes sur ce prêt…" />
      </div>
    </div>
  )
}

// ─── Helpers UI ──────────────────────────────────────────────────────────

function ReadField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">{label}</div>
      <div className={cn(
        'mt-1 font-mono tabular-nums',
        highlight ? 'text-gold-700 font-bold text-base' : 'text-navy-900 text-sm',
      )}>
        {value}
      </div>
    </div>
  )
}

function FlagToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg border border-navy-100 bg-white hover:border-gold-300 transition">
      <input type="checkbox" className="accent-gold-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function KpiRow({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-navy-300">{k}</span>
      <span className={cn(
        'font-mono tabular-nums',
        highlight ? 'text-gold-400 font-bold' : 'text-navy-100',
      )}>{v}</span>
    </div>
  )
}
