/**
 * PiecesParCategorie — affiche les pièces uploadées d'une catégorie donnée
 * (P1, P2, P3, P4, P5) en bas d'un onglet. Permet :
 *   - Visualiser/télécharger les pièces existantes
 *   - Voir la liste des pièces attendues (depuis la convention métier)
 *   - Identifier les pièces manquantes
 *   - Aperçu rapide
 *
 * Utilisé dans :
 *   - TabEtatCivil → P1 (identité, situation familiale)
 *   - TabRevenus → P2 (profession, bulletins, avis IRPP)
 *   - TabPatrimoine → P3 (relevés bancaires, épargne, biens détenus)
 *   - TabProjet → P4 (compromis, DPE, devis travaux)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Image as ImageIcon, FileQuestion, Eye, Download, FileSpreadsheet, FileType, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { pieces as piecesApi, type PieceMeta } from '@/db/api'
import { piecesAttendues } from '@/data/mock'
import { cn, dateTimeFr } from '@/lib/utils'
import PiecePreviewModal from './PiecePreviewModal'

type Categorie = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'

type Props = {
  dossierId: string
  categorie: Categorie
  /** Libellé du bloc (ex: "Pièces État civil P1"). Si omis, libellé auto. */
  title?: string
}

const CATEGORIE_LABEL: Record<Categorie, string> = {
  P1: 'Identité & situation familiale',
  P2: 'Profession & revenus',
  P3: 'Patrimoine & comptes bancaires',
  P4: 'Projet & bien immobilier',
  P5: 'Autres',
}

function iconFor(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon
  if (mime === 'application/pdf') return FileText
  if (mime.includes('spreadsheet') || mime.includes('excel')) return FileSpreadsheet
  if (mime.includes('word') || mime.includes('document')) return FileType
  return FileQuestion
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default function PiecesParCategorie({ dossierId, categorie, title }: Props) {
  const [pieces, setPieces] = useState<PieceMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [previewing, setPreviewing] = useState<PieceMeta | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await piecesApi.list(dossierId)
      setPieces(rows.filter((p) => p.categorie === categorie))
    } catch (e) {
      console.warn(`[pieces-${categorie}] load failed`, e)
    } finally {
      setLoading(false)
    }
  }, [dossierId, categorie])

  useEffect(() => {
    void reload()
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { dossierId?: string } | undefined
      if (!detail || detail.dossierId === dossierId) void reload()
    }
    window.addEventListener('apolline:pieces-changed', onChange)
    return () => window.removeEventListener('apolline:pieces-changed', onChange)
  }, [dossierId, reload])

  // Liste des pièces attendues pour cette catégorie (non optionnelles d'abord)
  const attendues = useMemo(
    () => piecesAttendues.filter((p) => p.categorie === categorie),
    [categorie],
  )

  // Match : pour chaque attendue, vérifie si on a au moins une pièce uploadée
  // dont le libellé contient un mot-clé du libellé attendu (heuristique simple).
  const matchAttendue = useCallback((libelleAttendu: string) => {
    const kw = libelleAttendu.toLowerCase().split(/[^a-zàâéèêëîïôûüç0-9]+/).filter((w) => w.length > 3)
    return pieces.find((p) => {
      const target = `${p.libelle} ${p.filename}`.toLowerCase()
      return kw.some((w) => target.includes(w))
    })
  }, [pieces])

  const onDownload = async (p: PieceMeta) => {
    try { await piecesApi.download(p.id, p.filename) }
    catch (e) { toast.error('Échec téléchargement', { description: e instanceof Error ? e.message : String(e) }) }
  }

  const titreEffectif = title ?? `Pièces ${categorie} — ${CATEGORIE_LABEL[categorie]}`

  if (loading && pieces.length === 0) {
    return (
      <div className="card p-4 mt-5">
        <div className="text-xs text-navy-400 italic">Chargement des pièces…</div>
      </div>
    )
  }

  return (
    <div className="card p-4 mt-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-[10px] font-bold text-gold-700 bg-gold-50 border border-gold-200 rounded px-1.5 py-0.5">{categorie}</span>
        <h3 className="font-serif text-base font-semibold text-navy-900">{titreEffectif}</h3>
        <span className="ml-auto text-xs text-navy-500">
          {pieces.length} pièce{pieces.length > 1 ? 's' : ''} uploadée{pieces.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Pièces uploadées */}
      {pieces.length > 0 ? (
        <div className="space-y-1 mb-4">
          {pieces.map((p) => {
            const Icon = iconFor(p.mimeType)
            const canPreview = p.mimeType === 'application/pdf' || p.mimeType.startsWith('image/')
            return (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-navy-100 hover:border-gold-300 hover:bg-navy-50/40 transition group">
                <Icon className="h-4 w-4 text-gold-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-navy-900 truncate" title={p.filename}>{p.filename}</div>
                  <div className="text-[10px] text-navy-500 flex items-center gap-2">
                    <span>{formatSize(p.sizeBytes)}</span>
                    <span>·</span>
                    <span>{dateTimeFr(p.uploadedAt)}</span>
                  </div>
                </div>
                <button onClick={() => setPreviewing(p)} disabled={!canPreview}
                  className="h-7 w-7 rounded hover:bg-white flex items-center justify-center text-navy-500 hover:text-navy-900 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title={canPreview ? 'Aperçu' : 'Aperçu non disponible'}>
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onDownload(p)}
                  className="h-7 w-7 rounded hover:bg-white flex items-center justify-center text-navy-500 hover:text-navy-900 transition"
                  title="Télécharger">
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-sm text-navy-400 italic mb-4 border border-dashed border-navy-200 rounded p-3 text-center">
          Aucune pièce {categorie} uploadée pour ce dossier
        </div>
      )}

      {/* Checklist des pièces attendues */}
      {attendues.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-navy-600 hover:text-navy-900 font-medium mb-2">
            📋 Liste des pièces {categorie} attendues ({attendues.length})
          </summary>
          <ul className="mt-2 space-y-1 pl-2">
            {attendues.map((a, i) => {
              const matched = matchAttendue(a.libelle)
              return (
                <li key={i} className={cn(
                  'flex items-start gap-2 text-xs',
                  matched ? 'text-emerald-700' : a.optionnelle ? 'text-navy-400' : 'text-rose-700',
                )}>
                  {matched ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <Circle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  <span>
                    {a.libelle}
                    {a.optionnelle && <span className="ml-1 text-[10px] italic text-navy-400">(optionnelle)</span>}
                    {a.quantiteMin && a.quantiteMin > 1 && <span className="ml-1 text-[10px] text-navy-500">× {a.quantiteMin}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </details>
      )}

      <PiecePreviewModal piece={previewing} onClose={() => setPreviewing(null)} />
    </div>
  )
}
