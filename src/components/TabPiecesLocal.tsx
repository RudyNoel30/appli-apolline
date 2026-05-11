/**
 * Onglet Pièces du dossier — version stockage local backend.
 * Remplace l'ancien TabPieces (qui utilisait OneDrive).
 *
 * Features :
 *  - Drop zone (drag & drop ou click pour parcourir)
 *  - Liste des pièces groupées par catégorie P1-P5
 *  - Aperçu PDF/image dans une iframe modale
 *  - Téléchargement
 *  - Suppression (avec confirmation)
 *  - Détection auto de la catégorie depuis le préfixe du nom
 *
 * Backend : POST /api/dossiers/:id/pieces/upload (multipart)
 *           GET /api/dossiers/:id/pieces (liste)
 *           GET /api/pieces/:id/preview (inline)
 *           GET /api/pieces/:id/download (attachment)
 *           DELETE /api/pieces/:id
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Upload, RefreshCw, AlertCircle, Loader2, Folder } from 'lucide-react'
import { toast } from 'sonner'
import PieceCard from './PieceCard'
import PiecePreviewModal from './PiecePreviewModal'
import ExtractionPreview from './ExtractionPreview'
import Modal from './Modal'
import { pieces as piecesApi, type PieceMeta } from '@/db/api'
import { piecesByCategorie } from '@/data/mock'
import { cn } from '@/lib/utils'
import type { Dossier } from '@/data/mock'

type Cat = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'

type Props = {
  dossier: Dossier
}

export default function TabPiecesLocal({ dossier }: Props) {
  const [list, setList] = useState<PieceMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [previewing, setPreviewing] = useState<PieceMeta | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<PieceMeta | null>(null)
  const [extractionPreview, setExtractionPreview] = useState<PieceMeta | null>(null)
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set())

  // Charge la liste
  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const rows = await piecesApi.list(dossier.id)
      setList(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [dossier.id])

  useEffect(() => { void reload() }, [reload])

  // Upload
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setUploading((n) => n + arr.length)
    const t = arr.length > 1
      ? toast.loading(`Upload 0 / ${arr.length} pièce${arr.length > 1 ? 's' : ''}…`)
      : toast.loading(`Upload "${arr[0]!.name}"…`)
    try {
      const result = await piecesApi.upload(dossier.id, arr, {
        onProgress: (done, total) => {
          if (total > 1) toast.loading(`Upload ${done} / ${total} pièces…`, { id: t })
        },
      })
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          toast.error(err.filename, { description: err.error })
        }
      }
      if (result.inserted > 0) {
        toast.success(`${result.inserted} pièce${result.inserted > 1 ? 's' : ''} uploadée${result.inserted > 1 ? 's' : ''}`, { id: t })
        await reload()
        // Notifie les autres onglets (Patrimoine, Revenus...) qu'il y a du nouveau
        window.dispatchEvent(new CustomEvent('apolline:pieces-changed', { detail: { dossierId: dossier.id } }))
      } else {
        toast.dismiss(t)
      }
    } catch (e) {
      toast.error('Échec upload', { id: t, description: e instanceof Error ? e.message : String(e) })
    } finally {
      setUploading((n) => Math.max(0, n - arr.length))
    }
  }, [dossier.id, reload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  // Actions
  const onPreview = useCallback((p: PieceMeta) => setPreviewing(p), [])
  const onDownload = useCallback(async (p: PieceMeta) => {
    try {
      await piecesApi.download(p.id, p.filename)
    } catch (e) {
      toast.error('Échec téléchargement', { description: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  // Extraction OCR : lance l'analyse Claude Vision et ouvre la modale de validation
  const onAnalyze = useCallback(async (p: PieceMeta) => {
    setAnalyzingIds((prev) => new Set(prev).add(p.id))
    const t = toast.loading(`Analyse IA de "${p.filename}"…`)
    try {
      const res = await piecesApi.extract(p.id)
      if (!res.ok) {
        toast.error('Échec extraction', { id: t, description: res.error ?? 'Document non reconnu' })
        await reload()
        return
      }
      toast.success('Extraction terminée', {
        id: t,
        description: `Type détecté : ${res.type} · confiance ${((res.confidence ?? 0) * 100).toFixed(0)}%`,
      })
      // Recharge la pièce avec les données extraites et ouvre la modale
      const updated = await piecesApi.list(dossier.id)
      setList(updated)
      const fresh = updated.find((x) => x.id === p.id)
      if (fresh) setExtractionPreview(fresh)
    } catch (e) {
      toast.error('Erreur extraction', { id: t, description: e instanceof Error ? e.message : String(e) })
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev)
        next.delete(p.id)
        return next
      })
    }
  }, [dossier.id, reload])

  const onShowExtraction = useCallback((p: PieceMeta) => setExtractionPreview(p), [])
  const doDelete = useCallback(async () => {
    if (!confirmDelete) return
    try {
      await piecesApi.remove(confirmDelete.id)
      toast.success(`${confirmDelete.filename} supprimée`)
      setConfirmDelete(null)
      await reload()
      window.dispatchEvent(new CustomEvent('apolline:pieces-changed', { detail: { dossierId: dossier.id } }))
    } catch (e) {
      toast.error('Échec suppression', { description: e instanceof Error ? e.message : String(e) })
    }
  }, [confirmDelete, reload])

  // Groupement par catégorie
  const groupes = useMemo(() => {
    const out: Record<Cat, PieceMeta[]> = { P1: [], P2: [], P3: [], P4: [], P5: [] }
    for (const p of list) out[p.categorie as Cat]?.push(p)
    return out
  }, [list])

  return (
    <>
      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition mb-4',
          dragOver ? 'border-gold-500 bg-gold-50' : 'border-navy-200 hover:border-navy-400 hover:bg-navy-50/40',
        )}
      >
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <Upload className={cn('h-8 w-8 mx-auto mb-2', dragOver ? 'text-gold-700' : 'text-navy-400')} />
        <div className="text-sm font-medium text-navy-900">
          Glisse des fichiers ici ou clique pour parcourir
        </div>
        <div className="text-[11px] text-navy-500 mt-1">
          PDF, images, Word, Excel… max 50 Mo par fichier · préfixe <code>P1_</code>, <code>P2_</code>… pour le classement automatique
        </div>
        {uploading > 0 && (
          <div className="mt-3 text-xs text-gold-700 inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Upload en cours ({uploading})…
          </div>
        )}
      </label>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-navy-500">
          {list.length} pièce{list.length > 1 ? 's' : ''} uploadée{list.length > 1 ? 's' : ''}
        </div>
        <button onClick={reload} disabled={loading}
          className="text-xs text-navy-500 hover:text-navy-900 inline-flex items-center gap-1">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          {loading ? 'Sync…' : 'Actualiser'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 mb-4 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Impossible de charger</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Liste groupée par catégorie */}
      {list.length === 0 && !loading && !error ? (
        <div className="card p-8 text-center text-sm text-navy-400 italic">
          <Folder className="h-10 w-10 text-navy-200 mx-auto mb-2" />
          Aucune pièce uploadée pour ce dossier.
        </div>
      ) : (
        <div className="space-y-5">
          {(['P1', 'P2', 'P3', 'P4', 'P5'] as const).map((cat) => {
            const items = groupes[cat]
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-gold-700">{cat}</span>
                  <span className="text-sm font-semibold text-navy-900">{piecesByCategorie[cat]}</span>
                  <span className="text-xs text-navy-400">· {items.length}</span>
                </div>
                {items.length === 0 ? (
                  <div className="text-xs text-navy-300 italic px-3 py-2">Aucune pièce dans cette catégorie</div>
                ) : (
                  <div className="space-y-1">
                    {items.map((p) => (
                      <PieceCard key={p.id} piece={p}
                        onPreview={onPreview}
                        onDownload={onDownload}
                        onDelete={(p) => setConfirmDelete(p)}
                        onAnalyze={onAnalyze}
                        onShowExtraction={onShowExtraction}
                        analyzing={analyzingIds.has(p.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modale aperçu */}
      <PiecePreviewModal piece={previewing} onClose={() => setPreviewing(null)} />

      {/* Modale extraction OCR (plein écran) */}
      {extractionPreview && (
        <ExtractionPreview
          open
          onClose={() => setExtractionPreview(null)}
          piece={extractionPreview}
          onApplied={() => {
            void reload()
            // Propage aux autres onglets (Revenus etc.) pour rafraîchir les chiffres
            window.dispatchEvent(new CustomEvent('apolline:pieces-changed', { detail: { dossierId: dossier.id } }))
            window.dispatchEvent(new CustomEvent('apolline:dossier-changed', { detail: { dossierId: dossier.id } }))
          }}
        />
      )}

      {/* Modale confirmation suppression */}
      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} size="sm"
          title="Supprimer cette pièce ?"
          description="Cette action est irréversible — le fichier sera retiré du serveur Apolline."
          actions={<>
            <button className="btn-outline" onClick={() => setConfirmDelete(null)}>Annuler</button>
            <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={doDelete}>
              Supprimer définitivement
            </button>
          </>}>
          <div className="text-sm text-navy-700">
            <strong>{confirmDelete.filename}</strong>
            <div className="text-xs text-navy-500 mt-1">{confirmDelete.categorie} · {Math.round(confirmDelete.sizeBytes / 1024)} Ko</div>
          </div>
        </Modal>
      )}
    </>
  )
}
