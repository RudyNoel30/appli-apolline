/**
 * ExtractionPreview — UI de validation des données extraites par OCR Claude.
 *
 * Affiche en plein écran :
 *  - À gauche : preview du document (PDF/image)
 *  - À droite : champs extraits avec leur confidence et leur cible d'application
 *
 * L'utilisateur peut :
 *  - Voir d'un coup d'œil les champs à vérifier (rouge < 70 %, gold 70-90 %, vert > 90 %)
 *  - Corriger inline n'importe quel champ
 *  - Décocher les champs qu'il ne veut pas appliquer
 *  - Cliquer "Appliquer au dossier" → patch envoyé au backend
 *
 * Types supportés Phase 1 : bulletin_salaire, avis_imposition.
 * Phase 2 (à venir) : rib, cni, justif_domicile.
 */
import { useMemo, useState } from 'react'
import { Sparkles, CheckCircle2, AlertCircle, XCircle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import FullScreenSheet from './FullScreenSheet'
import { pieces, type ExtractionType, type PieceMeta } from '@/db/api'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  piece: PieceMeta
  /** Callback après application réussie (pour rafraîchir Pieces + Dossier) */
  onApplied?: () => void
}

/** Description d'un champ à afficher + cible d'application */
type FieldSpec = {
  /** Libellé affiché au courtier */
  label: string
  /** Chemin dans extracted_data (dot-notation) */
  path: string
  /** Type d'input HTML */
  inputType?: 'text' | 'number' | 'date'
  /** Formatte la valeur pour l'affichage (ex: euros, dates) */
  format?: (v: unknown) => string
  /** Cible : 'client.emprunteur1.salaireNet' ou 'dossier.rfn' etc. */
  applyTo?: { entity: 'client' | 'dossier'; field: string }
  /** Confidence path (fallback sur global si absent) */
  confidencePath?: string
}

/** Lecture sécurisée d'une valeur dans un objet via dot-notation. */
function getPath(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  if (!obj) return undefined
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k]
    }
    return undefined
  }, obj)
}

/** Schéma de présentation par type de document */
const FIELDS_BY_TYPE: Record<ExtractionType, FieldSpec[]> = {
  bulletin_salaire: [
    { label: 'Période début', path: 'periode_debut', inputType: 'date', confidencePath: 'confidence.periode' },
    { label: 'Période fin', path: 'periode_fin', inputType: 'date', confidencePath: 'confidence.periode' },
    { label: 'Employeur', path: 'employeur.raison_sociale', applyTo: { entity: 'client', field: 'emprunteur1.employeur' }, confidencePath: 'confidence.employeur' },
    { label: 'SIRET', path: 'employeur.siret', confidencePath: 'confidence.employeur' },
    { label: 'Nom salarié', path: 'salarie.nom', applyTo: { entity: 'client', field: 'emprunteur1.nom' }, confidencePath: 'confidence.salarie' },
    { label: 'Prénom salarié', path: 'salarie.prenom', applyTo: { entity: 'client', field: 'emprunteur1.prenom' }, confidencePath: 'confidence.salarie' },
    { label: 'Date entrée', path: 'salarie.date_entree', inputType: 'date', applyTo: { entity: 'client', field: 'emprunteur1.dateEmbauche' }, confidencePath: 'confidence.salarie' },
    { label: 'Type contrat', path: 'salarie.contrat', applyTo: { entity: 'client', field: 'emprunteur1.typeContrat' }, confidencePath: 'confidence.salarie' },
    { label: 'Salaire brut', path: 'remuneration.salaire_brut', inputType: 'number', format: (v) => `${v} €`, confidencePath: 'confidence.remuneration' },
    { label: 'Net imposable', path: 'remuneration.net_imposable', inputType: 'number', format: (v) => `${v} €`, applyTo: { entity: 'client', field: 'emprunteur1.salaireNet' }, confidencePath: 'confidence.remuneration' },
    { label: 'Net à payer', path: 'remuneration.net_a_payer', inputType: 'number', format: (v) => `${v} €`, confidencePath: 'confidence.remuneration' },
  ],
  avis_imposition: [
    { label: 'Année des revenus', path: 'annee_revenus', inputType: 'number', confidencePath: 'confidence.global' },
    { label: 'Année avis', path: 'annee_avis', inputType: 'number', confidencePath: 'confidence.global' },
    { label: 'Référence avis', path: 'reference_avis', confidencePath: 'confidence.global' },
    { label: 'Numéro fiscal', path: 'numero_fiscal', confidencePath: 'confidence.global' },
    { label: 'Situation', path: 'foyer.situation', confidencePath: 'confidence.foyer' },
    { label: 'Parts', path: 'foyer.parts', inputType: 'number', confidencePath: 'confidence.foyer' },
    { label: 'Personnes à charge', path: 'foyer.nb_personnes_charge', inputType: 'number', confidencePath: 'confidence.foyer' },
    { label: 'RFR (Revenu Fiscal de Référence)', path: 'revenus.rfr', inputType: 'number', format: (v) => `${v} €`, applyTo: { entity: 'client', field: 'emprunteur1.rfPersonnelN1' }, confidencePath: 'confidence.rfr' },
    { label: 'Revenu brut global', path: 'revenus.revenu_brut_global', inputType: 'number', format: (v) => `${v} €`, confidencePath: 'confidence.revenus' },
    { label: 'Salaires/pensions', path: 'revenus.revenus_categoriels.salaires_pensions', inputType: 'number', format: (v) => `${v} €`, confidencePath: 'confidence.revenus' },
    { label: 'BIC', path: 'revenus.revenus_categoriels.bic', inputType: 'number', format: (v) => `${v} €`, confidencePath: 'confidence.revenus' },
    { label: 'BNC', path: 'revenus.revenus_categoriels.bnc', inputType: 'number', format: (v) => `${v} €`, confidencePath: 'confidence.revenus' },
    { label: 'Fonciers', path: 'revenus.revenus_categoriels.fonciers', inputType: 'number', format: (v) => `${v} €`, confidencePath: 'confidence.revenus' },
  ],
  rib: [
    { label: 'IBAN', path: 'iban', confidencePath: 'confidence.iban' },
    { label: 'BIC', path: 'bic', confidencePath: 'confidence.iban' },
    { label: 'Banque', path: 'banque', confidencePath: 'confidence.iban' },
    { label: 'Titulaire (nom)', path: 'titulaire.nom', confidencePath: 'confidence.titulaire' },
    { label: 'Titulaire (prénom)', path: 'titulaire.prenom', confidencePath: 'confidence.titulaire' },
  ],
  cni: [
    { label: 'Nom', path: 'nom', applyTo: { entity: 'client', field: 'emprunteur1.nom' }, confidencePath: 'confidence.identite' },
    { label: 'Prénom', path: 'prenom', applyTo: { entity: 'client', field: 'emprunteur1.prenom' }, confidencePath: 'confidence.identite' },
    { label: 'Date naissance', path: 'date_naissance', inputType: 'date', applyTo: { entity: 'client', field: 'emprunteur1.dateNaissance' }, confidencePath: 'confidence.identite' },
    { label: 'Lieu naissance', path: 'lieu_naissance', confidencePath: 'confidence.identite' },
    { label: 'Nationalité', path: 'nationalite', confidencePath: 'confidence.identite' },
    { label: 'Date expiration', path: 'date_expiration', inputType: 'date', confidencePath: 'confidence.validite' },
  ],
  justif_domicile: [
    { label: 'Type', path: 'type_justif', confidencePath: 'confidence.global' },
    { label: 'Titulaire (nom)', path: 'titulaire.nom', confidencePath: 'confidence.titulaire' },
    { label: 'Adresse', path: 'adresse.ligne1', applyTo: { entity: 'client', field: 'adresse' }, confidencePath: 'confidence.adresse' },
    { label: 'Code postal', path: 'adresse.code_postal', applyTo: { entity: 'client', field: 'codePostal' }, confidencePath: 'confidence.adresse' },
    { label: 'Ville', path: 'adresse.ville', applyTo: { entity: 'client', field: 'ville' }, confidencePath: 'confidence.adresse' },
    { label: 'Date émission', path: 'date_emission', inputType: 'date', confidencePath: 'confidence.global' },
  ],
  compromis: [],
  dpe: [],
  autre: [],
}

const TYPE_LABELS: Record<ExtractionType, string> = {
  bulletin_salaire: 'Bulletin de salaire',
  avis_imposition: 'Avis d\'imposition',
  rib: 'RIB',
  cni: 'CNI / passeport',
  justif_domicile: 'Justificatif de domicile',
  compromis: 'Compromis de vente',
  dpe: 'DPE',
  autre: 'Autre',
}

function confidenceColor(c: number): string {
  if (c >= 0.9) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (c >= 0.7) return 'text-gold-700 bg-gold-50 border-gold-200'
  return 'text-rose-700 bg-rose-50 border-rose-200'
}

function confidenceIcon(c: number) {
  if (c >= 0.9) return <CheckCircle2 className="h-3.5 w-3.5" />
  if (c >= 0.7) return <AlertCircle className="h-3.5 w-3.5" />
  return <XCircle className="h-3.5 w-3.5" />
}

export default function ExtractionPreview({ open, onClose, piece, onApplied }: Props) {
  const extractedType = (piece.extractionType ?? 'autre') as ExtractionType
  const extractedData = (piece.extractedData ?? null) as Record<string, unknown> | null
  const globalConfidence = piece.extractionConfidence ?? 0
  const fields = FIELDS_BY_TYPE[extractedType] ?? []

  // État local : valeurs éditables + sélection à appliquer
  const initial = useMemo(() => {
    const values: Record<string, unknown> = {}
    const selected: Record<string, boolean> = {}
    for (const f of fields) {
      const v = getPath(extractedData, f.path)
      values[f.path] = v ?? ''
      // Cocher par défaut si applyTo existe ET valeur non nulle
      selected[f.path] = !!f.applyTo && v !== null && v !== undefined && v !== ''
    }
    return { values, selected }
  }, [fields, extractedData])

  const [values, setValues] = useState<Record<string, unknown>>(initial.values)
  const [selected, setSelected] = useState<Record<string, boolean>>(initial.selected)
  const [applying, setApplying] = useState(false)

  const previewUrl = pieces.previewUrl(piece.id)

  const onApply = async () => {
    setApplying(true)
    try {
      // Construit les patches (dossier + client) en fusionnant les fields sélectionnés
      const dossierPatch: Record<string, unknown> = {}
      const clientPatch: Record<string, unknown> = {}

      for (const f of fields) {
        if (!selected[f.path] || !f.applyTo) continue
        const value = values[f.path]
        if (value === '' || value === null || value === undefined) continue

        const [root, sub] = f.applyTo.field.split('.')
        const targetObj = f.applyTo.entity === 'dossier' ? dossierPatch : clientPatch
        if (sub) {
          // Nested (ex: emprunteur1.salaireNet) — merge sur objet existant
          if (!targetObj[root!]) targetObj[root!] = {}
          ;(targetObj[root!] as Record<string, unknown>)[sub] = value
        } else if (root) {
          targetObj[root] = value
        }
      }

      await pieces.applyExtraction(piece.id, { dossierPatch, clientPatch })
      toast.success('Extraction appliquée au dossier', {
        description: `${Object.keys(dossierPatch).length + Object.keys(clientPatch).length} champ(s) mis à jour`,
      })
      onApplied?.()
      onClose()
    } catch (e) {
      toast.error('Échec de l\'application', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setApplying(false)
    }
  }

  const onReject = async () => {
    try {
      await pieces.rejectExtraction(piece.id)
      toast.info('Extraction rejetée')
      onApplied?.()
      onClose()
    } catch (e) {
      toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  if (!open) return null

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={`Extraction — ${TYPE_LABELS[extractedType]}`}
      description={`${piece.filename} · Confidence globale ${(globalConfidence * 100).toFixed(0)}%`}
      headerRight={
        <div className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border',
          confidenceColor(globalConfidence),
        )}>
          {confidenceIcon(globalConfidence)}
          {(globalConfidence * 100).toFixed(0)}%
        </div>
      }
      actions={
        <>
          <button onClick={onReject} className="btn-outline mr-auto" disabled={applying}>
            <XCircle className="h-4 w-4" /> Rejeter
          </button>
          <button onClick={onClose} className="btn-ghost" disabled={applying}>
            Annuler
          </button>
          <button onClick={onApply} className="btn-gold" disabled={applying || fields.filter((f) => selected[f.path] && f.applyTo).length === 0}>
            <Sparkles className="h-4 w-4" />
            {applying ? 'Application…' : `Appliquer (${fields.filter((f) => selected[f.path] && f.applyTo).length} champs)`}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Preview du document ─────────────────────────────────────── */}
        <div className="card p-2 h-[70vh] sticky top-0">
          {piece.mimeType.startsWith('image/') ? (
            <img
              src={previewUrl}
              alt={piece.filename}
              className="w-full h-full object-contain bg-navy-50/30 rounded"
            />
          ) : (
            <iframe
              src={previewUrl}
              title={piece.filename}
              className="w-full h-full rounded bg-navy-50/30"
            />
          )}
        </div>

        {/* ─── Champs extraits ─────────────────────────────────────────── */}
        <div className="space-y-2">
          {fields.length === 0 ? (
            <div className="card p-6 text-center text-sm text-navy-500 italic">
              Type "{TYPE_LABELS[extractedType]}" non géré dans cette version.
              <div className="text-xs text-navy-400 mt-2">
                Bientôt disponible : compromis de vente, DPE, …
              </div>
            </div>
          ) : fields.map((f) => {
            const value = values[f.path]
            const confValue = f.confidencePath ? getPath(extractedData, f.confidencePath) : globalConfidence
            const conf = typeof confValue === 'number' ? confValue : globalConfidence
            const isSelected = !!selected[f.path]
            const canApply = !!f.applyTo

            return (
              <div
                key={f.path}
                className={cn(
                  'card p-3 transition-all',
                  isSelected && canApply && 'ring-2 ring-gold-400/40',
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox apply */}
                  {canApply ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => setSelected({ ...selected, [f.path]: e.target.checked })}
                      className="mt-1.5 h-4 w-4 rounded border-navy-300 text-gold-500 focus:ring-gold-500 cursor-pointer"
                      title="Appliquer ce champ au dossier"
                    />
                  ) : (
                    <div className="w-4" /> /* spacer */
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs uppercase tracking-wider text-navy-500 font-semibold">
                        {f.label}
                      </label>
                      <div className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border',
                        confidenceColor(conf),
                      )}>
                        {confidenceIcon(conf)}
                        {(conf * 100).toFixed(0)}%
                      </div>
                    </div>

                    <input
                      type={f.inputType ?? 'text'}
                      value={value as string | number ?? ''}
                      onChange={(e) => {
                        const v = f.inputType === 'number'
                          ? (e.target.value === '' ? '' : Number(e.target.value))
                          : e.target.value
                        setValues({ ...values, [f.path]: v })
                      }}
                      className="input text-sm"
                      placeholder={value === null || value === undefined ? '— non détecté —' : ''}
                    />

                    {canApply && f.applyTo && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-navy-400">
                        <ArrowRight className="h-3 w-3" />
                        <span className="font-mono">{f.applyTo.entity}.{f.applyTo.field}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Note pédagogique */}
          {fields.length > 0 && (
            <div className="text-xs text-navy-400 px-2 pt-3 border-t border-navy-100">
              <strong className="text-navy-600">Légende :</strong> les indicateurs de confiance reflètent la fiabilité estimée par l'IA pour chaque champ.
              Vert &gt; 90 % (validé), gold 70-90 % (vérifie), rose &lt; 70 % (à corriger manuellement).
              Décoche les champs que tu ne veux pas appliquer.
            </div>
          )}
        </div>
      </div>
    </FullScreenSheet>
  )
}
