/**
 * Modale d'aperçu d'une pièce.
 *
 * Stratégie : fetch authentifié → blob URL → iframe local. Évite les
 * blocages CSP / X-Frame-Options / cross-origin que rencontrerait une
 * iframe pointant directement vers le backend.
 */
import { useEffect, useState } from 'react'
import { X, Download, Loader2, AlertCircle } from 'lucide-react'
import { pieces, getToken, type PieceMeta } from '@/db/api'
import { toast } from 'sonner'

type Props = {
  piece: PieceMeta | null
  onClose: () => void
}

export default function PiecePreviewModal({ piece, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Charge le blob quand la pièce change
  useEffect(() => {
    if (!piece) {
      setBlobUrl(null); setError(null); return
    }
    let cancelled = false
    let urlToCleanup: string | null = null

    const load = async () => {
      setLoading(true); setError(null); setBlobUrl(null)
      try {
        const token = getToken()
        const base = (import.meta.env.VITE_API_BASE as string | undefined) || 'https://appli.apolline.groupe-apolline.eu'
        const res = await fetch(`${base}/api/pieces/${encodeURIComponent(piece.id)}/preview`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) {
          // Tente de lire le message d'erreur JSON du backend
          let detail = ''
          try {
            const txt = await res.text()
            try {
              const j = JSON.parse(txt)
              detail = j?.error ?? txt
            } catch { detail = txt }
          } catch { /* swallow */ }
          if (res.status === 404 && /absent du stockage/i.test(detail)) {
            throw new Error('Le fichier n\'est pas présent sur le serveur. Il a probablement été supprimé manuellement, ou son upload initial a échoué. Re-uploade-le depuis l\'onglet Pièces du dossier.')
          }
          throw new Error(detail || `HTTP ${res.status} ${res.statusText}`)
        }
        const blob = await res.blob()
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        urlToCleanup = url
        setBlobUrl(url)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()

    return () => {
      cancelled = true
      // Cleanup du blob URL pour ne pas leak la mémoire
      if (urlToCleanup) URL.revokeObjectURL(urlToCleanup)
    }
  }, [piece])

  if (!piece) return null

  const canPreviewPdf = piece.mimeType === 'application/pdf'
  const canPreviewImage = piece.mimeType.startsWith('image/')
  const canPreview = canPreviewPdf || canPreviewImage

  const download = async () => {
    try { await pieces.download(piece.id, piece.filename) }
    catch (e) { toast.error('Échec téléchargement', { description: e instanceof Error ? e.message : String(e) }) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-5xl h-[88vh] bg-white rounded-xl2 shadow-raised flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-3 border-b border-navy-100">
          <div className="font-mono text-xs font-bold text-gold-700 bg-gold-50 border border-gold-200 rounded px-2 py-0.5 shrink-0">
            {piece.categorie}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-serif text-base text-navy-900 truncate">{piece.filename}</div>
            <div className="text-[11px] text-navy-500">
              {piece.mimeType} · {Math.round(piece.sizeBytes / 1024)} Ko
            </div>
          </div>
          <button onClick={download} className="btn-outline text-xs">
            <Download className="h-3.5 w-3.5" /> Télécharger
          </button>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-navy-50 flex items-center justify-center text-navy-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden bg-navy-50">
          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gold-600 mb-2" />
                <div className="text-sm text-navy-500">Chargement de l'aperçu…</div>
              </div>
            </div>
          )}
          {!loading && error && (
            <div className="h-full flex items-center justify-center text-center px-8">
              <div className="max-w-md">
                <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
                <div className="text-sm font-semibold text-navy-700 mb-1">Impossible de charger l'aperçu</div>
                <div className="text-xs text-navy-500 mb-4 break-words">{error}</div>
                <button onClick={download} className="btn-gold">
                  <Download className="h-4 w-4" /> Télécharger pour l'ouvrir
                </button>
              </div>
            </div>
          )}
          {!loading && !error && blobUrl && canPreviewPdf && (
            <iframe
              src={blobUrl}
              title={piece.filename}
              className="w-full h-full border-0 bg-white"
            />
          )}
          {!loading && !error && blobUrl && canPreviewImage && (
            <div className="h-full overflow-auto flex items-center justify-center p-4">
              <img src={blobUrl} alt={piece.filename} className="max-w-full max-h-full object-contain" />
            </div>
          )}
          {!loading && !error && !canPreview && (
            <div className="h-full flex items-center justify-center text-center px-8">
              <div>
                <div className="text-sm font-semibold text-navy-700 mb-2">Aperçu non disponible</div>
                <div className="text-xs text-navy-500 mb-4">Type ({piece.mimeType}) non prévisualisable.</div>
                <button onClick={download} className="btn-gold">
                  <Download className="h-4 w-4" /> Télécharger
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
