/**
 * Éditeur complet de dossier — équivalent Cifacil "Prospect" + "Fiche personnelle".
 * Modale plein-écran avec navigation latérale en 6 sections.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Save, User2, Briefcase, Wallet, Banknote, Building2, Bookmark,
  Plus, Trash2, AlertCircle, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  emptyEmprunteur,
  type Dossier, type Emprunteur, type Civilite, type SituationFamiliale, type RegimeMatrimonial,
  type StatutOccupation, type TypeContrat, type TypeAchat, type Destination, type TypeLogement,
  type CreditExistant, type BienPatrimoine, type DroitEpargneLogement, type DevenirCredit,
  type Client, type Banque, type Collaborateur,
} from '@/data/mock'
import { cn, eur } from '@/lib/utils'
import { calcFraisNotaireDetail, type NatureBienNotaire } from '@/lib/finance'

type EditorState = {
  // Emprunteurs
  emprunteur1: Emprunteur
  emprunteur2: Emprunteur | null
  hasCoEmprunteur: boolean
  // Revenus & charges ménage
  rfMenage: number
  allocFamiliales: number
  aplAlActuelle: number
  epargneMenage: number
  loyerMenage: number
  autresDepensesMenage: number
  empruntsLocatifsMenage: number
  empruntsNonLocatifsMenage: number
  ponderationRF: number
  rfReferenceN1: number
  rfReferenceN2: number
  dateReleveEndettement: string
  // Tableaux
  creditsExistants: CreditExistant[]
  patrimoine: BienPatrimoine[]
  droitsEL: DroitEpargneLogement[]
  // Projet
  typeAchat: TypeAchat
  destination: Destination
  typeLogement: TypeLogement
  compromisSigne: boolean
  actePrevuLe: string
  villeBien: string
  ptzZone: 'A_bis' | 'A' | 'B1' | 'B2' | 'C' | ''
  // Coûts
  coutTerrain: number
  coutLogement: number
  coutTravaux: number
  coutViabilisation: number
  coutMobilier: number
  fraisEtablissement: number
  fraisExpertise: number
  fraisAgence: number
  fraisNotaire: number
  rachatCreditCout: number
  apport: number
  montantPret: number
  dureeMois: number
  // Métadonnées
  commercialId: string
  backOfficeId: string
  apporteurNom: string
  apporteurReference: string
  notaireNom: string
  venteADistance: boolean
  archive: boolean
  archiveRaison: string
  identifiantEmprunteur: string
  identifiantCoEmprunteur: string
}

function dossierToState(dossier: Dossier, client: Client): EditorState {
  // Si emprunteur1 non défini, on l'initialise depuis le client
  const e1: Emprunteur = dossier.emprunteur1 ?? {
    ...emptyEmprunteur(),
    prenom: client.prenom,
    nom: client.nom,
    naissance: client.naissance,
    email: client.email,
    telMobile: client.tel,
    ville: client.ville,
    profession: client.profession,
    salaireNet: client.revenuMensuelNet,
  }
  const hasCoEmp = !!dossier.emprunteur2 || !!client.conjoint
  let e2: Emprunteur | null = dossier.emprunteur2 ?? null
  if (!e2 && client.conjoint) {
    const [prenom, ...rest] = client.conjoint.split(' ')
    e2 = { ...emptyEmprunteur(), prenom: prenom ?? '', nom: rest.join(' ') }
  }

  return {
    emprunteur1: e1,
    emprunteur2: e2,
    hasCoEmprunteur: hasCoEmp,
    rfMenage: dossier.rfMenage ?? 0,
    allocFamiliales: dossier.allocFamiliales ?? 0,
    aplAlActuelle: dossier.aplAlActuelle ?? 0,
    epargneMenage: dossier.epargneMenage ?? 0,
    loyerMenage: dossier.loyerMenage ?? 0,
    autresDepensesMenage: dossier.autresDepensesMenage ?? 0,
    empruntsLocatifsMenage: dossier.empruntsLocatifsMenage ?? 0,
    empruntsNonLocatifsMenage: dossier.empruntsNonLocatifsMenage ?? 0,
    ponderationRF: dossier.ponderationRF ?? 1,
    rfReferenceN1: dossier.rfReferenceN1 ?? 0,
    rfReferenceN2: dossier.rfReferenceN2 ?? 0,
    dateReleveEndettement: dossier.dateReleveEndettement ?? '',
    creditsExistants: dossier.creditsExistants ?? [],
    patrimoine: dossier.patrimoine ?? [],
    droitsEL: dossier.droitsEL ?? [],
    typeAchat: dossier.typeAchat ?? 'Ancien',
    destination: dossier.destination ?? 'Résidence principale',
    typeLogement: dossier.typeLogement ?? 'Maison',
    compromisSigne: dossier.compromisSigne ?? false,
    actePrevuLe: dossier.actePrevuLe ?? '',
    villeBien: dossier.villeBien,
    ptzZone: dossier.ptzZone ?? '',
    coutTerrain: dossier.coutTerrain ?? 0,
    coutLogement: dossier.coutLogement ?? dossier.montantBien,
    coutTravaux: dossier.coutTravaux ?? 0,
    coutViabilisation: dossier.coutViabilisation ?? 0,
    coutMobilier: dossier.coutMobilier ?? 0,
    fraisEtablissement: dossier.fraisEtablissement ?? 0,
    fraisExpertise: dossier.fraisExpertise ?? 0,
    fraisAgence: dossier.fraisAgence ?? 0,
    // Si non renseigné, le useEffect autoFraisNotaire calculera la valeur exacte
    // via calcFraisNotaireDetail() au 1er render (barème dégressif + DMTO + CSI).
    fraisNotaire: dossier.fraisNotaire ?? 0,
    rachatCreditCout: dossier.rachatCreditCout ?? 0,
    apport: dossier.apport,
    montantPret: dossier.montantPret,
    dureeMois: dossier.dureeMois,
    commercialId: dossier.commercialId ?? '',
    backOfficeId: dossier.backOfficeId ?? '',
    apporteurNom: dossier.apporteurNom ?? '',
    apporteurReference: dossier.apporteurReference ?? '',
    notaireNom: dossier.notaireNom ?? '',
    venteADistance: dossier.venteADistance ?? false,
    archive: dossier.archive ?? false,
    archiveRaison: dossier.archiveRaison ?? '',
    identifiantEmprunteur: dossier.identifiantEmprunteur ?? '',
    identifiantCoEmprunteur: dossier.identifiantCoEmprunteur ?? '',
  }
}

type Section = 'identite' | 'revenus' | 'charges' | 'patrimoine' | 'projet' | 'meta'

const SECTIONS: { key: Section; label: string; icon: any; eyebrow: string }[] = [
  { key: 'identite', label: 'Identité & contacts', icon: User2, eyebrow: 'Section 1/6' },
  { key: 'revenus', label: 'Profession & revenus', icon: Briefcase, eyebrow: 'Section 2/6' },
  { key: 'charges', label: 'Charges & logement', icon: Wallet, eyebrow: 'Section 3/6' },
  { key: 'patrimoine', label: 'Crédits, patrimoine, ÉL', icon: Banknote, eyebrow: 'Section 4/6' },
  { key: 'projet', label: 'Projet & coûts', icon: Building2, eyebrow: 'Section 5/6' },
  { key: 'meta', label: 'Apporteur & méta', icon: Bookmark, eyebrow: 'Section 6/6' },
]

export type DossierEditorProps = {
  dossier: Dossier
  client: Client
  banques: Banque[]
  collaborateurs: Collaborateur[]
  onClose: () => void
  onSave: (dossierPatch: Partial<Dossier>, clientPatch: Partial<Client>) => void
  /** 'edit' (par défaut) modifie un dossier existant, 'create' en crée un nouveau */
  mode?: 'edit' | 'create'
}

export default function DossierEditor({
  dossier, client, banques, collaborateurs, onClose, onSave,
  mode = 'edit',
}: DossierEditorProps) {
  const [section, setSection] = useState<Section>('identite')
  const [s, setS] = useState<EditorState>(() => dossierToState(dossier, client))

  // ─── Auto-calc des frais de notaire ────────────────────────────────────
  // Tant que `autoFraisNotaire = true`, le champ se recalcule automatiquement
  // quand le coût du logement, le type d'achat ou la ville (département)
  // changent. Dès que l'utilisateur saisit manuellement une valeur, le flag
  // passe à false et le champ devient "figé" sur la saisie manuelle.
  // Un bouton ↻ "Recalculer" permet de revenir au mode auto.
  const [autoFraisNotaire, setAutoFraisNotaire] = useState(() => {
    // Mode AUTO seulement si le dossier n'a pas encore de frais notaire stockés
    // (nouveau dossier ou champ vidé). Sinon mode MANUEL pour préserver ce que
    // l'utilisateur avait saisi — sinon le useEffect plus bas écraserait la
    // valeur à chaque réouverture du dossier (bug reporté).
    // L'utilisateur peut toujours cliquer sur "↻ Recalculer" pour repasser en auto.
    return (dossier.fraisNotaire ?? 0) === 0
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const update = <K extends keyof EditorState>(k: K, v: EditorState[K]) => setS((p) => ({ ...p, [k]: v }))

  // Recalcule les frais notaire automatiquement (basé sur barème officiel)
  // quand : coutLogement, typeAchat, ou villeBien change ET mode auto activé
  useEffect(() => {
    if (!autoFraisNotaire) return

    // Mapping TypeAchat (libellé FR) → nature notaire + assiette à utiliser.
    // RÈGLES :
    //   - Rachat de crédit / Travaux pur     → 0 € (pas d'acquisition)
    //   - Construction (terrain + travaux)   → DMTO sur le TERRAIN seulement
    //   - VEFA / Neuf                        → TVA déjà payée, DMTO 0,715 %
    //   - Ancien / Terrain                   → DMTO 5,80 % (4,91 % en 36/976)
    const t = (s.typeAchat ?? '').toLowerCase()
    let nature: NatureBienNotaire | null = null
    let assiette = s.coutLogement || 0

    if (t === 'rachat' || t === 'travaux') {
      // Pas d'acquisition immobilière → frais notaire = 0
      if (s.fraisNotaire !== 0) setS((p) => ({ ...p, fraisNotaire: 0 }))
      return
    }
    if (t === 'neuf') nature = 'neuf'
    else if (t === 'vefa') nature = 'vefa'
    else if (t === 'terrain') nature = 'terrain'
    else if (t === 'construction') {
      // Construction = achat terrain + travaux. DMTO uniquement sur le terrain.
      // Fallback : si coutTerrain n'est pas renseigné, on ne calcule pas (l'user
      // devra saisir manuellement) pour éviter de surévaluer en appliquant 5,80 %
      // sur le coût total.
      if ((s.coutTerrain ?? 0) <= 0) return
      nature = 'terrain'
      assiette = s.coutTerrain
    }
    else if (t === 'ancien') nature = 'ancien'
    if (!nature || assiette <= 0) return

    // Détecte le département via le code postal dans villeBien (ex: "21000 DIJON")
    const cpMatch = (s.villeBien ?? '').match(/\b(\d{5})\b/)
    const departement = cpMatch ? (cpMatch[1]!.startsWith('976') ? '976' : cpMatch[1]!.slice(0, 2)) : undefined

    const fn = calcFraisNotaireDetail(assiette, nature, { departement }).total
    if (fn !== s.fraisNotaire) {
      setS((p) => ({ ...p, fraisNotaire: fn }))
    }
  }, [autoFraisNotaire, s.coutLogement, s.coutTerrain, s.typeAchat, s.villeBien, s.fraisNotaire])
  const updateE1 = <K extends keyof Emprunteur>(k: K, v: Emprunteur[K]) =>
    setS((p) => ({ ...p, emprunteur1: { ...p.emprunteur1, [k]: v } }))
  const updateE2 = <K extends keyof Emprunteur>(k: K, v: Emprunteur[K]) =>
    setS((p) => p.emprunteur2 ? { ...p, emprunteur2: { ...p.emprunteur2, [k]: v } } : p)

  // Calculs dérivés
  const coutTotal = useMemo(() =>
    s.coutTerrain + s.coutLogement + s.coutTravaux + s.coutViabilisation + s.coutMobilier
    + s.fraisEtablissement + s.fraisExpertise + s.fraisAgence + s.fraisNotaire + s.rachatCreditCout,
    [s.coutTerrain, s.coutLogement, s.coutTravaux, s.coutViabilisation, s.coutMobilier,
     s.fraisEtablissement, s.fraisExpertise, s.fraisAgence, s.fraisNotaire, s.rachatCreditCout])

  const revenuMensuelTotal = useMemo(() => {
    const e1 = revenuMensuelEmp(s.emprunteur1)
    const e2 = s.hasCoEmprunteur && s.emprunteur2 ? revenuMensuelEmp(s.emprunteur2) : 0
    const menage = s.rfMenage + s.allocFamiliales + s.aplAlActuelle
    return e1 + e2 + menage
  }, [s.emprunteur1, s.emprunteur2, s.hasCoEmprunteur, s.rfMenage, s.allocFamiliales, s.aplAlActuelle])

  const mensualitesExistantes = useMemo(() => {
    const e1 = s.emprunteur1.empruntsLocatifs + s.emprunteur1.empruntsNonLocatifs + s.emprunteur1.loyerPersistant
    const e2 = s.hasCoEmprunteur && s.emprunteur2
      ? s.emprunteur2.empruntsLocatifs + s.emprunteur2.empruntsNonLocatifs + s.emprunteur2.loyerPersistant
      : 0
    const credits = s.creditsExistants.reduce((sum, c) => sum + c.mensualite, 0)
    const menage = s.empruntsLocatifsMenage + s.empruntsNonLocatifsMenage + s.loyerMenage
    return e1 + e2 + credits + menage
  }, [s.emprunteur1, s.emprunteur2, s.hasCoEmprunteur, s.creditsExistants, s.empruntsLocatifsMenage, s.empruntsNonLocatifsMenage, s.loyerMenage])

  const endettementAvant = revenuMensuelTotal > 0 ? (mensualitesExistantes / revenuMensuelTotal) * 100 : 0

  const submit = () => {
    if (!s.emprunteur1.prenom.trim() || !s.emprunteur1.nom.trim()) {
      toast.error('Prénom et nom de l\'emprunteur principal obligatoires')
      setSection('identite')
      return
    }
    const ltv = s.coutLogement > 0 ? s.montantPret / s.coutLogement : 0
    const dossierPatch: Partial<Dossier> = {
      emprunteur1: s.emprunteur1,
      emprunteur2: s.hasCoEmprunteur ? s.emprunteur2 ?? undefined : undefined,
      rfMenage: s.rfMenage,
      allocFamiliales: s.allocFamiliales,
      aplAlActuelle: s.aplAlActuelle,
      epargneMenage: s.epargneMenage,
      loyerMenage: s.loyerMenage,
      autresDepensesMenage: s.autresDepensesMenage,
      empruntsLocatifsMenage: s.empruntsLocatifsMenage,
      empruntsNonLocatifsMenage: s.empruntsNonLocatifsMenage,
      ponderationRF: s.ponderationRF,
      rfReferenceN1: s.rfReferenceN1,
      rfReferenceN2: s.rfReferenceN2,
      dateReleveEndettement: s.dateReleveEndettement,
      creditsExistants: s.creditsExistants,
      patrimoine: s.patrimoine,
      droitsEL: s.droitsEL,
      typeAchat: s.typeAchat,
      destination: s.destination,
      typeLogement: s.typeLogement,
      compromisSigne: s.compromisSigne,
      actePrevuLe: s.actePrevuLe,
      villeBien: s.villeBien,
      ptzZone: s.ptzZone || undefined,
      coutTerrain: s.coutTerrain,
      coutLogement: s.coutLogement,
      coutTravaux: s.coutTravaux,
      coutViabilisation: s.coutViabilisation,
      coutMobilier: s.coutMobilier,
      fraisEtablissement: s.fraisEtablissement,
      fraisExpertise: s.fraisExpertise,
      fraisAgence: s.fraisAgence,
      fraisNotaire: s.fraisNotaire,
      rachatCreditCout: s.rachatCreditCout,
      apport: s.apport,
      montantPret: s.montantPret,
      montantBien: s.coutLogement,
      dureeMois: s.dureeMois,
      ltv,
      hcsfOk: ltv <= 1.0 && s.dureeMois <= 300 && endettementAvant <= 35,
      commercialId: s.commercialId || undefined,
      backOfficeId: s.backOfficeId || undefined,
      apporteurNom: s.apporteurNom || undefined,
      apporteurReference: s.apporteurReference || undefined,
      notaireNom: s.notaireNom || undefined,
      venteADistance: s.venteADistance,
      archive: s.archive,
      archiveRaison: s.archiveRaison || undefined,
      identifiantEmprunteur: s.identifiantEmprunteur || undefined,
      identifiantCoEmprunteur: s.identifiantCoEmprunteur || undefined,
      clientNom: `${s.emprunteur1.nom} ${s.emprunteur1.prenom}`,
    }
    const clientPatch: Partial<Client> = {
      prenom: s.emprunteur1.prenom,
      nom: s.emprunteur1.nom,
      email: s.emprunteur1.email,
      tel: s.emprunteur1.telMobile || s.emprunteur1.telDom,
      naissance: s.emprunteur1.naissance,
      ville: s.emprunteur1.ville,
      profession: s.emprunteur1.profession,
      conjoint: s.hasCoEmprunteur && s.emprunteur2 ? `${s.emprunteur2.prenom} ${s.emprunteur2.nom}`.trim() : undefined,
      revenuMensuelNet: revenuMensuelEmp(s.emprunteur1),
    }
    onSave(dossierPatch, clientPatch)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch animate-fade-in">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-ivory w-full m-6 rounded-xl2 shadow-raised flex overflow-hidden animate-scale-in">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 bg-navy-900 text-navy-100 flex flex-col">
          <div className="px-5 py-5 border-b border-navy-800">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-300 font-semibold">
              {mode === 'create' ? 'Création prospect' : 'Édition prospect'}
            </div>
            <h2 className="font-serif text-xl text-white mt-1">
              {mode === 'create' ? 'Nouveau dossier' : `Dossier ${dossier.ref}`}
            </h2>
            <div className="text-xs text-navy-200 mt-1">
              {mode === 'create'
                ? (s.emprunteur1.prenom || s.emprunteur1.nom
                    ? `${s.emprunteur1.prenom} ${s.emprunteur1.nom}`.trim()
                    : 'Saisir l\'identité de l\'emprunteur')
                : `${client.prenom} ${client.nom}`}
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {SECTIONS.map((sec) => (
              <button
                key={sec.key}
                onClick={() => setSection(sec.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition',
                  section === sec.key
                    ? 'bg-navy-700 text-white ring-1 ring-gold-500/30'
                    : 'text-navy-200 hover:bg-navy-800 hover:text-white',
                )}
              >
                <sec.icon className={cn('h-4 w-4', section === sec.key ? 'text-gold-400' : 'text-navy-300')} />
                <div className="flex-1">
                  <div>{sec.label}</div>
                  <div className="text-[10px] text-navy-400">{sec.eyebrow}</div>
                </div>
                {section === sec.key && <span className="h-1.5 w-1.5 rounded-full bg-gold-500 animate-pulse-soft" />}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-navy-800 space-y-2">
            <div className="bg-navy-800/60 rounded-lg p-3 text-xs space-y-1">
              <Row k="Revenus mensuels" v={eur(revenuMensuelTotal)} />
              <Row k="Mensualités exist." v={eur(mensualitesExistantes)} />
              <Row k="Endettement" v={`${endettementAvant.toFixed(1)}%`}
                color={endettementAvant <= 35 ? 'text-emerald-300' : 'text-rose-300'} />
              <Row k="Coût total opé." v={eur(coutTotal)} />
            </div>
          </div>
        </aside>

        {/* Body */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 shrink-0 bg-white border-b border-navy-100 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {SECTIONS.find((x) => x.key === section)!.icon &&
                (() => {
                  const Ico = SECTIONS.find((x) => x.key === section)!.icon
                  return <Ico className="h-4 w-4 text-gold-600" />
                })()
              }
              <h3 className="font-serif text-lg text-navy-900">
                {SECTIONS.find((x) => x.key === section)!.label}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-md hover:bg-navy-50 flex items-center justify-center text-navy-400 hover:text-navy-900 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            {section === 'identite' && (
              <SectionIdentite s={s} update={update} updateE1={updateE1} updateE2={updateE2} />
            )}
            {section === 'revenus' && (
              <SectionRevenus s={s} update={update} updateE1={updateE1} updateE2={updateE2} />
            )}
            {section === 'charges' && (
              <SectionCharges s={s} update={update} updateE1={updateE1} updateE2={updateE2} />
            )}
            {section === 'patrimoine' && (
              <SectionPatrimoine s={s} update={update} />
            )}
            {section === 'projet' && (
              <SectionProjet
                s={s} update={update} coutTotal={coutTotal}
                autoFraisNotaire={autoFraisNotaire}
                setAutoFraisNotaire={setAutoFraisNotaire}
              />
            )}
            {section === 'meta' && (
              <SectionMeta s={s} update={update} collaborateurs={collaborateurs} />
            )}
          </div>

          <footer className="h-16 shrink-0 bg-white border-t border-navy-100 px-6 flex items-center justify-between">
            <div className="text-xs text-navy-500">
              Champs marqués <span className="text-rose-700">*</span> obligatoires
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-outline" onClick={onClose}>Annuler</button>
              <button className="btn-gold" onClick={submit}>
                <Save className="h-4 w-4" />
                {mode === 'create' ? 'Créer le dossier' : 'Enregistrer toutes les modifications'}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function revenuMensuelEmp(e: Emprunteur): number {
  return e.salaireNet
    + (e.baBicBnc * (e.baBicBncMois || 12)) / 12
    + e.rfBrutsExistants
    + e.autresRevenusNonSociaux
    + e.revenusSociaux
    + e.pensionAlimentaireRecue
}

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-navy-300">{k}</span>
      <span className={cn('font-semibold', color ?? 'text-white')}>{v}</span>
    </div>
  )
}

/* ─────────────────────────── Champs réutilisables ─────────────────────────── */

function Field({ label, value, onChange, type = 'text', placeholder, required, step, span = 1 }: {
  label: string
  value: any
  onChange: (v: any) => void
  type?: string
  placeholder?: string
  required?: boolean
  step?: string
  span?: 1 | 2 | 3 | 4 | 6
}) {
  return (
    <div className={`col-span-${span}`}>
      <label className="label">
        {label} {required && <span className="text-rose-700">*</span>}
      </label>
      <input
        type={type}
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value || 0) : e.target.value)}
        className="input"
      />
    </div>
  )
}

function Select<T extends string>({ label, value, onChange, options, optionLabels, span = 1 }: {
  label: string
  value: T
  onChange: (v: T) => void
  options: readonly T[] | T[]
  /** Mapping optionnel value → label affiché (sinon affiche la value brute). */
  optionLabels?: Record<string, string>
  span?: 1 | 2 | 3 | 4 | 6
}) {
  return (
    <div className={`col-span-${span}`}>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o} value={o}>{optionLabels?.[o] ?? o}</option>)}
      </select>
    </div>
  )
}

function Toggle({ label, value, onChange, span = 1 }: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  span?: 1 | 2 | 3 | 4 | 6
}) {
  return (
    <label className={`col-span-${span} flex items-center gap-2 text-sm cursor-pointer pt-6`}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-gold-500 h-4 w-4" />
      <span className="text-navy-700">{label}</span>
    </label>
  )
}

function Group({ title, eyebrow, children }: { title: string; eyebrow?: string; children: any }) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-baseline gap-2 mb-3">
        <h4 className="font-serif text-base font-semibold text-navy-900">{title}</h4>
        {eyebrow && <span className="text-[10px] uppercase tracking-wider text-gold-700 font-semibold">{eyebrow}</span>}
        <div className="flex-1 h-px bg-navy-100" />
      </div>
      {children}
    </div>
  )
}

/* ─────────────────────────── Section 1 — Identité ─────────────────────────── */

type UpdState = <K extends keyof EditorState>(k: K, v: EditorState[K]) => void
type UpdEmp = <K extends keyof Emprunteur>(k: K, v: Emprunteur[K]) => void

function SectionIdentite({ s, update, updateE1, updateE2 }: {
  s: EditorState; update: UpdState; updateE1: UpdEmp; updateE2: UpdEmp
}) {
  return (
    <>
      <EmprunteurIdentite e={s.emprunteur1} updateE={updateE1} title="Emprunteur principal" />

      <div className="my-6 flex items-center gap-3">
        <h4 className="font-serif text-base font-semibold text-navy-900">Co-emprunteur</h4>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={s.hasCoEmprunteur}
            onChange={(e) => {
              update('hasCoEmprunteur', e.target.checked)
              if (e.target.checked && !s.emprunteur2) update('emprunteur2', emptyEmprunteur())
            }}
            className="accent-gold-500"
          />
          <span className="text-navy-700">Ajouter un co-emprunteur</span>
        </label>
        <div className="flex-1 h-px bg-navy-100" />
      </div>

      {s.hasCoEmprunteur && s.emprunteur2 && (
        <EmprunteurIdentite e={s.emprunteur2} updateE={updateE2} title="" hideHeader />
      )}
    </>
  )
}

function EmprunteurIdentite({ e, updateE, title, hideHeader }: {
  e: Emprunteur; updateE: UpdEmp; title: string; hideHeader?: boolean
}) {
  return (
    <Group title={hideHeader ? '' : title} eyebrow={hideHeader ? '' : 'État civil'}>
      <div className="grid grid-cols-6 gap-3">
        <Select label="Civilité" value={e.civilite} onChange={(v) => updateE('civilite', v as Civilite)} options={['M.', 'Mme', 'Mlle']} />
        <Field label="Prénom" value={e.prenom} onChange={(v) => updateE('prenom', v)} required span={2} />
        <Field label="Nom" value={e.nom} onChange={(v) => updateE('nom', v)} required span={2} />
        <Field label="Né(e) le" type="date" value={e.naissance} onChange={(v) => updateE('naissance', v)} />
        <Field label="Lieu de naissance" value={e.lieuNaissance} onChange={(v) => updateE('lieuNaissance', v)} span={3} />
        <Field label="Nationalité" value={e.nationalite} onChange={(v) => updateE('nationalite', v)} span={3} />
        <Select label="Situation familiale" value={e.situationFamiliale} onChange={(v) => updateE('situationFamiliale', v as SituationFamiliale)}
          options={['Célibataire', 'Marié(e)', 'Pacsé(e)', 'Divorcé(e)', 'Veuf(ve)', 'Concubinage']} span={2} />
        <Select label="Régime matrimonial" value={e.regimeMatrimonial} onChange={(v) => updateE('regimeMatrimonial', v as RegimeMatrimonial)}
          options={['Communauté légale', 'Séparation de biens', 'Communauté universelle', 'Participation aux acquêts', 'N/A']} span={3} />
        <Field label="Enfants à charge" type="number" value={e.enfantsACharge} onChange={(v) => updateE('enfantsACharge', v)} />
      </div>
      <div className="grid grid-cols-6 gap-3 mt-4">
        <Field label="Adresse" value={e.adresse} onChange={(v) => updateE('adresse', v)} span={4} placeholder="12 rue des Forges" />
        <Field label="Code postal" value={e.codePostal} onChange={(v) => updateE('codePostal', v)} />
        <Field label="Ville" value={e.ville} onChange={(v) => updateE('ville', v)} />
        <Field label="Adresse (suite)" value={e.adresseSuite} onChange={(v) => updateE('adresseSuite', v)} span={6} />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <Field label="Email" type="email" value={e.email} onChange={(v) => updateE('email', v)} placeholder="prenom.nom@email.fr" />
        <Field label="Tél. domicile" value={e.telDom} onChange={(v) => updateE('telDom', v)} placeholder="03 80 ..." />
        <Field label="Tél. mobile" value={e.telMobile} onChange={(v) => updateE('telMobile', v)} placeholder="06 ..." />
      </div>
      <Toggle label="Accord de recueil des données personnelles obtenu (RGPD)"
        value={e.rgpdAccord} onChange={(v) => updateE('rgpdAccord', v)} span={6} />
      <Toggle
        label="Primo-accédant (n'a pas été propriétaire de sa résidence principale les 2 dernières années)"
        value={e.primoAccedant ?? false}
        onChange={(v) => updateE('primoAccedant', v)}
        span={6}
      />
    </Group>
  )
}

/* ─────────────────────────── Section 2 — Revenus ─────────────────────────── */

function SectionRevenus({ s, update, updateE1, updateE2 }: {
  s: EditorState; update: UpdState; updateE1: UpdEmp; updateE2: UpdEmp
}) {
  return (
    <>
      <EmprunteurProfRevenus e={s.emprunteur1} updateE={updateE1} title="Emprunteur principal" />
      {s.hasCoEmprunteur && s.emprunteur2 && (
        <EmprunteurProfRevenus e={s.emprunteur2} updateE={updateE2} title="Co-emprunteur" />
      )}

      <Group title="Revenus mensuels communs au ménage" eyebrow="Ménage">
        <div className="grid grid-cols-3 gap-3">
          <Field label="RF bruts existants ménage (€/mois)" type="number" value={s.rfMenage} onChange={(v) => update('rfMenage', v)} />
          <Field label="Allocations familiales (€/mois)" type="number" value={s.allocFamiliales} onChange={(v) => update('allocFamiliales', v)} />
          <Field label="APL / AL actuelle (€/mois)" type="number" value={s.aplAlActuelle} onChange={(v) => update('aplAlActuelle', v)} />
        </div>
      </Group>

      <Group title="Revenus fiscaux du ménage" eyebrow="Avis d'imposition">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Revenu fiscal de référence N-1 (€)" type="number" value={s.rfReferenceN1} onChange={(v) => update('rfReferenceN1', v)} />
          <Field label="Revenu fiscal de référence N-2 (€)" type="number" value={s.rfReferenceN2} onChange={(v) => update('rfReferenceN2', v)} />
          <Field label="Pondération RF" type="number" step="0.01" value={s.ponderationRF} onChange={(v) => update('ponderationRF', v)} />
        </div>
      </Group>
    </>
  )
}

function EmprunteurProfRevenus({ e, updateE, title }: { e: Emprunteur; updateE: UpdEmp; title: string }) {
  const revMensuel = revenuMensuelEmp(e)
  return (
    <Group title={title} eyebrow="Profession & revenus">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Select label="Type de contrat" value={e.typeContrat} onChange={(v) => updateE('typeContrat', v as TypeContrat)}
          options={['CDI', 'CDD', 'Période d\'essai', 'Fonctionnaire', 'Indépendant', 'Gérant majoritaire', 'Profession libérale', 'Retraité', 'Sans emploi', 'Étudiant']} />
        <Field label="Profession" value={e.profession} onChange={(v) => updateE('profession', v)} />
        <Field label="Employeur" value={e.employeur} onChange={(v) => updateE('employeur', v)} />
        <Field label="Date d'embauche" type="date" value={e.dateEmbauche} onChange={(v) => updateE('dateEmbauche', v)} />
        <Field label="Ancienneté (années)" type="number" value={e.anciennete} onChange={(v) => updateE('anciennete', v)} />
        <Field label="Secteur" value={e.secteur} onChange={(v) => updateE('secteur', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Field label="Salaire net mensuel (€)" type="number" value={e.salaireNet} onChange={(v) => updateE('salaireNet', v)} />
        <Field label="BA / BIC / BNC (€/mois)" type="number" value={e.baBicBnc} onChange={(v) => updateE('baBicBnc', v)} />
        <Field label="Sur combien de mois" type="number" value={e.baBicBncMois} onChange={(v) => updateE('baBicBncMois', v)} />
        <Field label="Revenus fonciers bruts (€/mois)" type="number" value={e.rfBrutsExistants} onChange={(v) => updateE('rfBrutsExistants', v)} />
        <Field label="Autres revenus non sociaux (€/mois)" type="number" value={e.autresRevenusNonSociaux} onChange={(v) => updateE('autresRevenusNonSociaux', v)} />
        <Field label="Revenus sociaux (€/mois)" type="number" value={e.revenusSociaux} onChange={(v) => updateE('revenusSociaux', v)} />
        <Field label="Pension alimentaire reçue (€/mois)" type="number" value={e.pensionAlimentaireRecue} onChange={(v) => updateE('pensionAlimentaireRecue', v)} />
        <div className="col-span-2 flex items-end">
          <div className="w-full bg-gold-50 border border-gold-200 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-gold-800">Revenu mensuel total personnel</div>
            <div className="font-serif text-xl font-semibold text-navy-900">{eur(revMensuel)}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Revenu fiscal personnel N-1 (€)" type="number" value={e.rfPersonnelN1} onChange={(v) => updateE('rfPersonnelN1', v)} />
        <Field label="Revenu fiscal personnel N-2 (€)" type="number" value={e.rfPersonnelN2} onChange={(v) => updateE('rfPersonnelN2', v)} />
      </div>
    </Group>
  )
}

/* ─────────────────────────── Section 3 — Charges ─────────────────────────── */

function SectionCharges({ s, update, updateE1, updateE2 }: {
  s: EditorState; update: UpdState; updateE1: UpdEmp; updateE2: UpdEmp
}) {
  return (
    <>
      <EmprunteurCharges e={s.emprunteur1} updateE={updateE1} title="Emprunteur principal" />
      {s.hasCoEmprunteur && s.emprunteur2 && (
        <EmprunteurCharges e={s.emprunteur2} updateE={updateE2} title="Co-emprunteur" />
      )}

      <Group title="Dépenses communes au ménage" eyebrow="Ménage">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Épargne programmée (€/mois)" type="number" value={s.epargneMenage} onChange={(v) => update('epargneMenage', v)} />
          <Field label="Loyer persistant (€/mois)" type="number" value={s.loyerMenage} onChange={(v) => update('loyerMenage', v)} />
          <Field label="Autres dépenses (€/mois)" type="number" value={s.autresDepensesMenage} onChange={(v) => update('autresDepensesMenage', v)} />
          <Field label="Emprunts locatifs (€/mois)" type="number" value={s.empruntsLocatifsMenage} onChange={(v) => update('empruntsLocatifsMenage', v)} />
          <Field label="Emprunts non locatifs (€/mois)" type="number" value={s.empruntsNonLocatifsMenage} onChange={(v) => update('empruntsNonLocatifsMenage', v)} />
          <Field label="Date relevé endettement" type="date" value={s.dateReleveEndettement} onChange={(v) => update('dateReleveEndettement', v)} />
        </div>
      </Group>
    </>
  )
}

function EmprunteurCharges({ e, updateE, title }: { e: Emprunteur; updateE: UpdEmp; title: string }) {
  return (
    <Group title={title} eyebrow="Charges & logement">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Field label="Épargne programmée (€/mois)" type="number" value={e.epargneProgrammee} onChange={(v) => updateE('epargneProgrammee', v)} />
        <Field label="Loyer persistant (€/mois)" type="number" value={e.loyerPersistant} onChange={(v) => updateE('loyerPersistant', v)} />
        <Field label="Pension alimentaire versée (€/mois)" type="number" value={e.pensionAlimentaireVersee} onChange={(v) => updateE('pensionAlimentaireVersee', v)} />
        <Field label="Emprunts locatifs (€/mois)" type="number" value={e.empruntsLocatifs} onChange={(v) => updateE('empruntsLocatifs', v)} />
        <Field label="Emprunts non locatifs (€/mois)" type="number" value={e.empruntsNonLocatifs} onChange={(v) => updateE('empruntsNonLocatifs', v)} />
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Select label="Statut d'occupation" value={e.statutOccupation} onChange={(v) => updateE('statutOccupation', v as StatutOccupation)}
          options={['Locataire', 'Propriétaire', 'Hébergé', 'Logement de fonction', 'HLM', 'Logé à titre gratuit']} />
        <Field label="Depuis le" type="date" value={e.logementDepuis} onChange={(v) => updateE('logementDepuis', v)} />
        <Field label="Loyer actuel (€)" type="number" value={e.loyerActuel} onChange={(v) => updateE('loyerActuel', v)} />
        <Toggle label="HLM" value={e.hlm} onChange={(v) => updateE('hlm', v)} />
      </div>
    </Group>
  )
}

/* ─────────────────────────── Section 4 — Patrimoine ─────────────────────────── */

function SectionPatrimoine({ s, update }: { s: EditorState; update: UpdState }) {
  const genId = (p: string) => `${p}${Date.now().toString(36).toUpperCase()}`

  return (
    <>
      <Group title="Crédits existants" eyebrow={`${s.creditsExistants.length} ligne(s)`}>
        <div className="rounded-lg border border-navy-100 overflow-hidden mb-2">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-th">Libellé</th>
                <th className="table-th">Type</th>
                <th className="table-th">Organisme</th>
                <th className="table-th text-right">CRD</th>
                <th className="table-th text-right">Mensualité</th>
                <th className="table-th">Terme</th>
                <th className="table-th">Devenir</th>
                <th className="table-th w-10"></th>
              </tr>
            </thead>
            <tbody>
              {s.creditsExistants.length === 0 && (
                <tr><td colSpan={8} className="table-td text-center text-navy-400 italic py-4">Aucun crédit en cours</td></tr>
              )}
              {s.creditsExistants.map((c, i) => (
                <tr key={c.id}>
                  <td className="table-td"><input className="input py-1 text-sm" value={c.libelle} onChange={(e) => {
                    const arr = [...s.creditsExistants]; arr[i] = { ...c, libelle: e.target.value }; update('creditsExistants', arr)
                  }} /></td>
                  <td className="table-td"><select className="input py-1 text-sm" value={c.type} onChange={(e) => {
                    const arr = [...s.creditsExistants]; arr[i] = { ...c, type: e.target.value as CreditExistant['type'] }; update('creditsExistants', arr)
                  }}>
                    {['Immobilier', 'Conso', 'Auto', 'Travaux', 'Étudiant', 'Autre'].map((t) => <option key={t}>{t}</option>)}
                  </select></td>
                  <td className="table-td"><input className="input py-1 text-sm" value={c.organisme ?? ''} onChange={(e) => {
                    const arr = [...s.creditsExistants]; arr[i] = { ...c, organisme: e.target.value }; update('creditsExistants', arr)
                  }} /></td>
                  <td className="table-td"><input type="number" className="input py-1 text-sm text-right" value={c.crd} onChange={(e) => {
                    const arr = [...s.creditsExistants]; arr[i] = { ...c, crd: Number(e.target.value) }; update('creditsExistants', arr)
                  }} /></td>
                  <td className="table-td"><input type="number" className="input py-1 text-sm text-right" value={c.mensualite} onChange={(e) => {
                    const arr = [...s.creditsExistants]; arr[i] = { ...c, mensualite: Number(e.target.value) }; update('creditsExistants', arr)
                  }} /></td>
                  <td className="table-td"><input type="date" className="input py-1 text-sm" value={c.terme} onChange={(e) => {
                    const arr = [...s.creditsExistants]; arr[i] = { ...c, terme: e.target.value }; update('creditsExistants', arr)
                  }} /></td>
                  <td className="table-td"><select className="input py-1 text-sm" value={c.devenir} onChange={(e) => {
                    const arr = [...s.creditsExistants]; arr[i] = { ...c, devenir: e.target.value as DevenirCredit }; update('creditsExistants', arr)
                  }}>
                    {['À solder', 'À conserver', 'À reprendre', 'En cours'].map((t) => <option key={t}>{t}</option>)}
                  </select></td>
                  <td className="table-td">
                    <button onClick={() => update('creditsExistants', s.creditsExistants.filter((_, j) => j !== i))}
                      className="h-7 w-7 rounded-md hover:bg-rose-50 text-navy-400 hover:text-rose-700 flex items-center justify-center transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-outline text-xs" onClick={() => update('creditsExistants', [...s.creditsExistants, {
          id: genId('CR'), libelle: '', type: 'Conso', organisme: '', crd: 0, mensualite: 0, terme: '', devenir: 'À conserver',
        }])}>
          <Plus className="h-3.5 w-3.5" /> Ajouter un crédit
        </button>
      </Group>

      <Group title="Patrimoine" eyebrow={`${s.patrimoine.length} bien(s)`}>
        <div className="rounded-lg border border-navy-100 overflow-hidden mb-2">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-th">Libellé</th>
                <th className="table-th">Type</th>
                <th className="table-th text-right">Valeur</th>
                <th className="table-th text-right">CRD</th>
                <th className="table-th text-right">Revenu /mois</th>
                <th className="table-th text-center">Hypo</th>
                <th className="table-th text-center">Vente</th>
                <th className="table-th w-10"></th>
              </tr>
            </thead>
            <tbody>
              {s.patrimoine.length === 0 && (
                <tr><td colSpan={8} className="table-td text-center text-navy-400 italic py-4">Aucun bien</td></tr>
              )}
              {s.patrimoine.map((b, i) => (
                <tr key={b.id}>
                  <td className="table-td"><input className="input py-1 text-sm" value={b.libelle} onChange={(e) => {
                    const arr = [...s.patrimoine]; arr[i] = { ...b, libelle: e.target.value }; update('patrimoine', arr)
                  }} /></td>
                  <td className="table-td"><select className="input py-1 text-sm" value={b.type} onChange={(e) => {
                    const arr = [...s.patrimoine]; arr[i] = { ...b, type: e.target.value as BienPatrimoine['type'] }; update('patrimoine', arr)
                  }}>
                    {['Résidence principale', 'Résidence secondaire', 'Locatif', 'Terrain', 'Local pro', 'Autre'].map((t) => <option key={t}>{t}</option>)}
                  </select></td>
                  <td className="table-td"><input type="number" className="input py-1 text-sm text-right" value={b.valeur} onChange={(e) => {
                    const arr = [...s.patrimoine]; arr[i] = { ...b, valeur: Number(e.target.value) }; update('patrimoine', arr)
                  }} /></td>
                  <td className="table-td"><input type="number" className="input py-1 text-sm text-right" value={b.crd} onChange={(e) => {
                    const arr = [...s.patrimoine]; arr[i] = { ...b, crd: Number(e.target.value) }; update('patrimoine', arr)
                  }} /></td>
                  <td className="table-td"><input type="number" className="input py-1 text-sm text-right" value={b.revenu} onChange={(e) => {
                    const arr = [...s.patrimoine]; arr[i] = { ...b, revenu: Number(e.target.value) }; update('patrimoine', arr)
                  }} /></td>
                  <td className="table-td text-center"><input type="checkbox" checked={b.hypotheque} onChange={(e) => {
                    const arr = [...s.patrimoine]; arr[i] = { ...b, hypotheque: e.target.checked }; update('patrimoine', arr)
                  }} className="accent-gold-500" /></td>
                  <td className="table-td text-center"><input type="checkbox" checked={b.venteEnvisagee} onChange={(e) => {
                    const arr = [...s.patrimoine]; arr[i] = { ...b, venteEnvisagee: e.target.checked }; update('patrimoine', arr)
                  }} className="accent-gold-500" /></td>
                  <td className="table-td">
                    <button onClick={() => update('patrimoine', s.patrimoine.filter((_, j) => j !== i))}
                      className="h-7 w-7 rounded-md hover:bg-rose-50 text-navy-400 hover:text-rose-700 flex items-center justify-center transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-outline text-xs" onClick={() => update('patrimoine', [...s.patrimoine, {
          id: genId('PT'), libelle: '', type: 'Locatif', valeur: 0, crd: 0, revenu: 0, hypotheque: false, venteEnvisagee: false,
        }])}>
          <Plus className="h-3.5 w-3.5" /> Ajouter un bien
        </button>
      </Group>

      <Group title="Droits Épargne Logement" eyebrow={`${s.droitsEL.length} compte(s)`}>
        <div className="rounded-lg border border-navy-100 overflow-hidden mb-2">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-th">Type</th>
                <th className="table-th text-right">Droits acquis</th>
                <th className="table-th text-center">Cédés ?</th>
                <th className="table-th">Titulaire</th>
                <th className="table-th w-10"></th>
              </tr>
            </thead>
            <tbody>
              {s.droitsEL.length === 0 && (
                <tr><td colSpan={5} className="table-td text-center text-navy-400 italic py-4">Aucun droit</td></tr>
              )}
              {s.droitsEL.map((d, i) => (
                <tr key={d.id}>
                  <td className="table-td"><select className="input py-1 text-sm" value={d.type} onChange={(e) => {
                    const arr = [...s.droitsEL]; arr[i] = { ...d, type: e.target.value as DroitEpargneLogement['type'] }; update('droitsEL', arr)
                  }}>
                    {['PEL', 'CEL', 'Plan d\'épargne'].map((t) => <option key={t}>{t}</option>)}
                  </select></td>
                  <td className="table-td"><input type="number" className="input py-1 text-sm text-right" value={d.droits} onChange={(e) => {
                    const arr = [...s.droitsEL]; arr[i] = { ...d, droits: Number(e.target.value) }; update('droitsEL', arr)
                  }} /></td>
                  <td className="table-td text-center"><input type="checkbox" checked={d.cedes} onChange={(e) => {
                    const arr = [...s.droitsEL]; arr[i] = { ...d, cedes: e.target.checked }; update('droitsEL', arr)
                  }} className="accent-gold-500" /></td>
                  <td className="table-td"><input className="input py-1 text-sm" value={d.titulaire} onChange={(e) => {
                    const arr = [...s.droitsEL]; arr[i] = { ...d, titulaire: e.target.value }; update('droitsEL', arr)
                  }} /></td>
                  <td className="table-td">
                    <button onClick={() => update('droitsEL', s.droitsEL.filter((_, j) => j !== i))}
                      className="h-7 w-7 rounded-md hover:bg-rose-50 text-navy-400 hover:text-rose-700 flex items-center justify-center transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-outline text-xs" onClick={() => update('droitsEL', [...s.droitsEL, {
          id: genId('EL'), type: 'PEL', droits: 0, cedes: false, titulaire: '',
        }])}>
          <Plus className="h-3.5 w-3.5" /> Ajouter un compte
        </button>
      </Group>
    </>
  )
}

/* ─────────────────────────── Section 5 — Projet & coûts ─────────────────────────── */

function SectionProjet({ s, update, coutTotal, autoFraisNotaire, setAutoFraisNotaire }: {
  s: EditorState; update: UpdState; coutTotal: number
  autoFraisNotaire: boolean
  setAutoFraisNotaire: (v: boolean) => void
}) {
  // LTV "live" affichée dans la modale "Construire le plan" (onglet Financement)
  // — c'est la valeur authentique calculée depuis les prêts effectifs du dossier.
  return (
    <>
      <Group title="Nature du projet" eyebrow="Caractéristiques">
        <div className="grid grid-cols-3 gap-3">
          <Select label="Type d'achat" value={s.typeAchat} onChange={(v) => update('typeAchat', v as TypeAchat)}
            options={['Ancien', 'Neuf', 'VEFA', 'Construction', 'Terrain', 'Rachat', 'Travaux']} />
          <Select label="Destination" value={s.destination} onChange={(v) => update('destination', v as Destination)}
            options={['Résidence principale', 'Résidence secondaire', 'Locatif', 'Mixte', 'Pro']} />
          <Select label="Type de logement" value={s.typeLogement} onChange={(v) => update('typeLogement', v as TypeLogement)}
            options={['Maison', 'Appartement', 'Terrain', 'Local commercial', 'Immeuble', 'Studio']} />
          <Field label="Ville du bien" value={s.villeBien} onChange={(v) => update('villeBien', v)} required span={2} />
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={s.compromisSigne} onChange={(e) => update('compromisSigne', e.target.checked)} className="accent-gold-500 h-4 w-4" />
              <span className="text-navy-700">Compromis signé</span>
            </label>
          </div>
          <Field label="Acte prévu le" type="date" value={s.actePrevuLe} onChange={(v) => update('actePrevuLe', v)} />
          <Select
            label="Zone PTZ (géographique)"
            value={s.ptzZone ?? ''}
            onChange={(v) => update('ptzZone', v as 'A_bis' | 'A' | 'B1' | 'B2' | 'C' | '')}
            options={['', 'A_bis', 'A', 'B1', 'B2', 'C']}
            optionLabels={{ '': '— À renseigner', 'A_bis': 'A bis (Paris+)', 'A': 'A (IDF, Côte d\'Azur…)', 'B1': 'B1 (>250k hab)', 'B2': 'B2 (50-250k hab)', 'C': 'C (zones détendues)' }}
          />
        </div>
      </Group>

      <Group title="Coût d'acquisition" eyebrow="Décomposition">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Terrain (€)" type="number" value={s.coutTerrain} onChange={(v) => update('coutTerrain', v)} />
          <Field label="Logement (€)" type="number" value={s.coutLogement} onChange={(v) => update('coutLogement', v)} />
          <Field label="Travaux (€)" type="number" value={s.coutTravaux} onChange={(v) => update('coutTravaux', v)} />
          <Field label="Viabilisation (€)" type="number" value={s.coutViabilisation} onChange={(v) => update('coutViabilisation', v)} />
          <Field label="Mobilier (€)" type="number" value={s.coutMobilier} onChange={(v) => update('coutMobilier', v)} />
          <Field label="Frais d'établissement (€)" type="number" value={s.fraisEtablissement} onChange={(v) => update('fraisEtablissement', v)} />
          <Field label="Frais d'expertise (€)" type="number" value={s.fraisExpertise} onChange={(v) => update('fraisExpertise', v)} />
          <Field label="Frais d'agence (€)" type="number" value={s.fraisAgence} onChange={(v) => update('fraisAgence', v)} />
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-navy-700">
                Frais notaire (€)
              </span>
              {autoFraisNotaire ? (
                <span
                  className="text-[9px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
                  title="Calculé automatiquement via le barème officiel français (émoluments dégressifs + DMTO + CSI + débours). Le champ se met à jour à chaque modification du coût du logement, du type d'achat ou de la ville."
                >
                  Auto
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAutoFraisNotaire(true)}
                  className="text-[9px] uppercase tracking-wider font-bold text-gold-700 hover:text-gold-800 bg-gold-50 hover:bg-gold-100 border border-gold-200 px-1.5 py-0.5 rounded cursor-pointer transition"
                  title="Revenir au calcul automatique (barème officiel)"
                >
                  ↻ Manuel · cliquer pour auto
                </button>
              )}
            </div>
            <input
              type="number"
              value={s.fraisNotaire}
              onChange={(e) => {
                setAutoFraisNotaire(false)  // saisie manuelle = on désactive l'auto
                update('fraisNotaire', Number(e.target.value))
              }}
              className="input"
            />
          </div>
          <Field label="Rachat de crédit (€)" type="number" value={s.rachatCreditCout} onChange={(v) => update('rachatCreditCout', v)} />
          <div className="col-span-2 flex items-end">
            <div className="w-full bg-gold-50 border border-gold-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-gold-800">Coût total opération</div>
              <div className="font-serif text-2xl font-semibold text-navy-900">{eur(coutTotal)}</div>
            </div>
          </div>
        </div>
      </Group>

      <Group title="Apport personnel" eyebrow="Financement">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Apport personnel (€)" type="number" value={s.apport} onChange={(v) => update('apport', v)} />
          <div className="col-span-2 rounded-lg bg-navy-50 border border-navy-100 p-3 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-navy-600 shrink-0" />
            <span className="text-navy-700">
              Le montant emprunté, la durée, les taux et mensualités sont définis directement sur chaque <strong>prêt</strong> dans l'onglet <strong>Financement</strong> du dossier. Coût total opération : <strong>{eur(coutTotal)}</strong>.
            </span>
          </div>
        </div>
      </Group>
    </>
  )
}

/* ─────────────────────────── Section 6 — Métadonnées ─────────────────────────── */

function SectionMeta({ s, update, collaborateurs }: {
  s: EditorState; update: UpdState; collaborateurs: Collaborateur[]
}) {
  return (
    <>
      <Group title="Affectation interne" eyebrow="Équipe Extr'Apol">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Commercial assigné</label>
            <select className="input" value={s.commercialId} onChange={(e) => update('commercialId', e.target.value)}>
              <option value="">— Aucun —</option>
              {collaborateurs.filter((c) => c.role === 'courtier' || c.role === 'admin').map((c) => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Back office</label>
            <select className="input" value={s.backOfficeId} onChange={(e) => update('backOfficeId', e.target.value)}>
              <option value="">— Aucun —</option>
              {collaborateurs.filter((c) => c.role === 'gestionnaire' || c.role === 'assistante' || c.role === 'admin').map((c) => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
          </div>
        </div>
      </Group>

      <Group title="Apporteur d'affaires & notaire">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Nom de l'apporteur" value={s.apporteurNom} onChange={(v) => update('apporteurNom', v)} placeholder="ex : Agence ABC, M. Dupont…" span={2} />
          <Field label="Référence apporteur" value={s.apporteurReference} onChange={(v) => update('apporteurReference', v)} />
          <Field label="Notaire" value={s.notaireNom} onChange={(v) => update('notaireNom', v)} span={3} placeholder="ex : Me Dubois — Étude de Dijon" />
        </div>
      </Group>

      <Group title="Identifiants internes & options">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Identifiant emprunteur" value={s.identifiantEmprunteur} onChange={(v) => update('identifiantEmprunteur', v)} />
          <Field label="Identifiant co-emprunteur" value={s.identifiantCoEmprunteur} onChange={(v) => update('identifiantCoEmprunteur', v)} />
        </div>
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={s.venteADistance} onChange={(e) => update('venteADistance', e.target.checked)} className="accent-gold-500" />
            <span className="text-navy-700">Dossier traité en vente à distance</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={s.archive} onChange={(e) => update('archive', e.target.checked)} className="accent-gold-500" />
            <span className="text-navy-700">Archiver ce dossier</span>
          </label>
          {s.archive && (
            <Field label="Raison de l'archivage" value={s.archiveRaison} onChange={(v) => update('archiveRaison', v)} placeholder="Abandon, refus banque, …" span={2} />
          )}
        </div>
      </Group>

      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
        <Check className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-emerald-900">Prêt à enregistrer</div>
          <div className="text-xs text-emerald-800 mt-1">
            Toutes les sections sont indépendantes. Cliquez sur <strong>"Enregistrer toutes les modifications"</strong> en bas pour persister l'ensemble du dossier dans la base locale.
          </div>
        </div>
      </div>
    </>
  )
}
