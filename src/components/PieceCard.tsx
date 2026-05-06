/**
 * Carte d'une pièce uploadée localement (avec actions : preview, télécharger, supprimer).
 */
import { FileText, Image as ImageIcon, FileQuestion, Eye, Download, Trash2, FileSpreadsheet, FileType } from 'lucide-react'
import { dateTimeFr, cn } from '@/lib/utils'
import type { PieceMeta } from '@/db/api'

type Props = {
  piece: PieceMeta
  onPreview: (p: PieceMeta) => void
  onDownload: (p: PieceMeta) => void
  onDelete: (p: PieceMeta) => void
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

export default function PieceCard({ piece, onPreview, onDownload, onDelete }: Props) {
  const Icon = iconFor(piece.mimeType)
  const canPreview = piece.mimeType === 'application/pdf' || piece.mimeType.startsWith('image/')

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-navy-100 hover:border-gold-300 hover:bg-navy-50/40 transition group">
      <Icon className="h-5 w-5 text-gold-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-navy-900 truncate" title={piece.filename}>
          {piece.filename}
        </div>
        <div className="text-[11px] text-navy-500 flex items-center gap-2 mt-0.5">
          <span className="font-mono font-bold text-gold-700 bg-gold-50 border border-gold-200 rounded px-1.5">{piece.categorie}</span>
          <span>{formatSize(piece.sizeBytes)}</span>
          <span>·</span>
          <span>{dateTimeFr(piece.uploadedAt)}</span>
        </div>
      </div>
      <div className={cn('flex items-center gap-1', !canPreview && 'opacity-50')}>
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
