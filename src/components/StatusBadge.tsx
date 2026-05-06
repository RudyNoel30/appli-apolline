/**
 * StatusBadge — composant unifié pour afficher un statut métier.
 *
 * Centralise les patterns dispersés dans Dossiers, Pipeline, RGPD, Commissions.
 * Variants supportés :
 *  - 'dossier'    : R0 / R1_prevu / R1_fait / Montage / Envoi_banque / Accord / Offre_editee / Signe / Encaisse / Abandonne
 *  - 'commercial' : 'prospect' | 'client'
 *  - 'hcsf'       : conforme | hors-norme  (boolean)
 *  - 'encaisse'   : encaisse | en-attente  (boolean)
 *  - 'piece'      : valide | a_fournir | manquant | expire
 *  - 'commercial-pret' : statut métier d'un prêt (propose / accord / signe / debloque / refuse)
 */
import { cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle, XCircle, Clock, UserMinus, UserCheck } from 'lucide-react'
import { STATUTS, type Statut } from '@/data/mock'

type IconType = typeof CheckCircle2

type Spec = { label: string; classes: string; Icon?: IconType }

// ─── Pipeline dossier ───
const DOSSIER_LABELS: Record<Statut, string> = Object.fromEntries(STATUTS.map(s => [s.key, s.label])) as Record<Statut, string>
const DOSSIER_CLASSES: Record<Statut, string> = {
  R0: 'bg-navy-50 text-navy-700 border-navy-200',
  R1_prevu: 'bg-sky-50 text-sky-700 border-sky-200',
  R1_fait: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Montage: 'bg-violet-50 text-violet-700 border-violet-200',
  Envoi_banque: 'bg-amber-50 text-amber-700 border-amber-200',
  Accord: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Offre_editee: 'bg-teal-50 text-teal-700 border-teal-200',
  Signe: 'bg-lime-50 text-lime-700 border-lime-200',
  Encaisse: 'bg-gold-50 text-gold-800 border-gold-200',
  Abandonne: 'bg-rose-50 text-rose-700 border-rose-200',
}

function dossierSpec(statut: Statut): Spec {
  return { label: DOSSIER_LABELS[statut] ?? statut, classes: DOSSIER_CLASSES[statut] ?? 'bg-navy-50 text-navy-700 border-navy-200' }
}

// ─── Statut commercial ───
function commercialSpec(statut: 'prospect' | 'client'): Spec {
  return statut === 'client'
    ? { label: 'Client', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: UserCheck }
    : { label: 'Prospect', classes: 'bg-amber-50 text-amber-700 border-amber-200', Icon: UserMinus }
}

// ─── HCSF ───
function hcsfSpec(ok: boolean): Spec {
  return ok
    ? { label: 'HCSF OK', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 }
    : { label: 'Hors norme', classes: 'bg-rose-50 text-rose-700 border-rose-200', Icon: XCircle }
}

// ─── Encaissement ───
function encaisseSpec(ok: boolean): Spec {
  return ok
    ? { label: 'Encaissé', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 }
    : { label: 'En attente', classes: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock }
}

// ─── Pièce (P1-P5) ───
type StatutPiece = 'valide' | 'a_fournir' | 'manquant' | 'expire'
const PIECE: Record<StatutPiece, Spec> = {
  valide: { label: 'Validée', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  a_fournir: { label: 'À fournir', classes: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  manquant: { label: 'Manquant', classes: 'bg-rose-50 text-rose-700 border-rose-200', Icon: AlertTriangle },
  expire: { label: 'Expiré', classes: 'bg-rose-50 text-rose-700 border-rose-200', Icon: XCircle },
}

// ─── Statut prêt ───
const PRET_LABELS: Record<string, Spec> = {
  propose: { label: 'Proposé', classes: 'bg-navy-50 text-navy-700 border-navy-200' },
  envoye: { label: 'Envoyé', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  accord: { label: 'Accord', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  signe: { label: 'Signé', classes: 'bg-lime-50 text-lime-700 border-lime-200' },
  debloque: { label: 'Débloqué', classes: 'bg-gold-50 text-gold-800 border-gold-200', Icon: CheckCircle2 },
  refuse: { label: 'Refusé', classes: 'bg-rose-50 text-rose-700 border-rose-200', Icon: XCircle },
}

// ─── Statut facture ───
type StatutFacture = 'prevue' | 'emise' | 'reglee_partiel' | 'reglee' | 'avoir_emis' | 'annulee'
const FACTURE: Record<StatutFacture, Spec> = {
  prevue: { label: 'Prévue', classes: 'bg-navy-50 text-navy-700 border-navy-200', Icon: Clock },
  emise: { label: 'Émise', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  reglee_partiel: { label: 'Partiel', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  reglee: { label: 'Réglée', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  avoir_emis: { label: 'Avoir émis', classes: 'bg-violet-50 text-violet-700 border-violet-200' },
  annulee: { label: 'Annulée', classes: 'bg-rose-50 text-rose-700 border-rose-200', Icon: XCircle },
}

// ─── Type facture ───
type TypeFacture = 'honoraires' | 'comm_banque' | 'comm_autre' | 'ristourne' | 'avoir_honoraires' | 'avoir_comm_banque' | 'avoir_comm_autre' | 'avoir_ristourne'
const TYPE_FACTURE: Record<TypeFacture, Spec> = {
  honoraires: { label: 'Honoraires', classes: 'bg-gold-50 text-gold-800 border-gold-200' },
  comm_banque: { label: 'Comm. banque', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  comm_autre: { label: 'Comm. autre', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  ristourne: { label: 'Ristourne', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  avoir_honoraires: { label: 'Avoir hono.', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  avoir_comm_banque: { label: 'Avoir CB', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  avoir_comm_autre: { label: 'Avoir CA', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  avoir_ristourne: { label: 'Avoir ristourne', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
}

// ─────────────────────────────────────────────────────────────────────────────

type Props =
  | { variant: 'dossier'; statut: Statut; size?: 'sm' | 'md'; className?: string }
  | { variant: 'commercial'; statut: 'prospect' | 'client'; size?: 'sm' | 'md'; className?: string }
  | { variant: 'hcsf'; ok: boolean; size?: 'sm' | 'md'; className?: string }
  | { variant: 'encaisse'; ok: boolean; size?: 'sm' | 'md'; className?: string }
  | { variant: 'piece'; statut: StatutPiece; size?: 'sm' | 'md'; className?: string }
  | { variant: 'pret'; statut: string; size?: 'sm' | 'md'; className?: string }
  | { variant: 'facture'; statut: StatutFacture; size?: 'sm' | 'md'; className?: string }
  | { variant: 'facture-type'; type: TypeFacture; size?: 'sm' | 'md'; className?: string }

export default function StatusBadge(props: Props) {
  const spec = (() => {
    if (props.variant === 'dossier') return dossierSpec(props.statut)
    if (props.variant === 'commercial') return commercialSpec(props.statut)
    if (props.variant === 'hcsf') return hcsfSpec(props.ok)
    if (props.variant === 'encaisse') return encaisseSpec(props.ok)
    if (props.variant === 'piece') return PIECE[props.statut] ?? { label: props.statut, classes: 'bg-navy-50 text-navy-700 border-navy-200' }
    if (props.variant === 'facture') return FACTURE[props.statut] ?? { label: props.statut, classes: 'bg-navy-50 text-navy-700 border-navy-200' }
    if (props.variant === 'facture-type') return TYPE_FACTURE[props.type] ?? { label: props.type, classes: 'bg-navy-50 text-navy-700 border-navy-200' }
    return PRET_LABELS[props.statut] ?? { label: props.statut, classes: 'bg-navy-50 text-navy-700 border-navy-200' }
  })()
  const size = props.size ?? 'md'
  const Icon = spec.Icon
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-md font-medium border',
      size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      spec.classes,
      props.className,
    )}>
      {Icon && <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />}
      {spec.label}
    </span>
  )
}
