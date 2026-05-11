/**
 * Carte d'une pièce uploadée localement (avec actions : preview, télécharger, supprimer).
 * Affiche aussi le badge d'extraction OCR si présent (Phase 1).
 */
import { FileText, Image as ImageIcon, FileQuestion, Eye, Download, Trash2, FileSpreadsheet, FileType, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { dateTimeFr, cn } from '@/lib/utils'
import type { PieceMeta } from '@/db/api'

type Props = {
  piece: PieceMeta
  onPreview: (p: PieceMeta) => void
  onDownload: (p: PieceMeta) => void
  onDelete: (p: PieceMeta) => void
  /** Si fourni : affiche un bouton "Analyser" pour lancer l'OCR. */
  onAnalyze?: (p: PieceMeta) => void
  /** Si fourni : affiche un bouton "Voir extraction" si l'extraction est dispo. */
  onShowExtraction?: (p: PieceMeta) => void
  /** True pendant l'appel API d'extraction. */
  analyzing?: boolean
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

export default function PieceCard({ piece, onPreview, onDownload, onDelete, onAnalyze, onShowExtraction, analyzing }: Props) {
  const Icon = iconFor(piece.mimeType)
  const canPreview = piece.mimeType === 'application/pdf' || piece.mimeType.startsWith('image/')
  const canAnalyze = canPreview  // OCR ne marche que sur PDF + images

  const status = piece.extractionStatus
  const hasExtraction = status === 'completed' || status === 'applied'
  const conf = piece.extractionConfidence ?? 0

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-navy-100 hover:border-gold-300 hover:bg-navy-50/40 transition group">
      <Icon className="h-5 w-5 text-gold-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-navy-900 truncate" title={piece.filename}>
          {piece.filename}
        </div>
        <div className="text-[11px] text-navy-500 flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="font-mono font-bold text-gold-700 bg-gold-50 border border-gold-200 rounded px-1.5">{piece.categorie}</span>
          <span>{formatSize(piece.sizeBytes)}</span>
          <span>·</span>
          <span>{dateTimeFr(piece.uploadedAt)}</span>
          {status === 'applied' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="h-3 w-3" />
              Extraction appliquée
            </span>
          )}
          {status === 'completed' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-gold-700 bg-gold-50 border border-gold-200">
              <Sparkles className="h-3 w-3" />
              Extrait · {(conf * 100).toFixed(0)}%
            </span>
          )}
          {status === 'failed' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200">
              <AlertCircle className="h-3 w-3" />
              Échec extraction
            </span>
          )}
          {status === 'processing' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-navy-700 bg-navy-50 border border-navy-200">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyse en cours
            </span>
          )}
        </div>
      </div>
      <div className={cn('flex items-center gap-1', !canPreview && 'opacity-50')}>
        {/* Analyser / Voir extraction */}
        {onAnalyze && canAnalyze && !hasExtraction && status !== 'processing' && (
          <button
            onClick={() => onAnalyze(piece)}
            disabled={analyzing}
            className="h-8 px-2 rounded-md hover:bg-gold-50 flex items-center gap-1 text-xs font-medium text-gold-700 hover:text-gold-800 transition"
            title="Analyser avec IA — extraction automatique des données"
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {analyzing ? 'Analyse…' : 'Analyser'}
          </button>
        )}
        {onShowExtraction && hasExtraction && (
          <button
            onClick={() => onShowExtraction(piece)}
            className="h-8 px-2 rounded-md hover:bg-gold-50 flex items-center gap-1 text-xs font-medium text-gold-700 hover:text-gold-800 transition"
            title="Voir et appliquer les données extraites"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Voir
          </button>
        )}
        <button
          onClick={() => onPreview(piece)}
          disabled={!canPreview}
          className="h-8 w-8 rounded-md hover:bg-white flex items-center justify-center text-navy-500 hover:text-navy-900 transition disabled:cursor-not-allowed"
          title={canPreview ? 'Aperçu' : 'Aperçu non disponible pour ce type'}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDownload(piece)}
          className="h-8 w-8 rounded-md hover:bg-white flex items-center justify-center text-navy-500 hover:text-navy-900 transition"
          title="Télécharger"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(piece)}
          className="h-8 w-8 rounded-md hover:bg-rose-50 flex items-center justify-center text-navy-400 hover:text-rose-700 transition"
          title="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
