/**
 * Zone de drop pour upload de pièces vers OneDrive.
 *
 * - Détecte les fichiers déposés depuis l'explorateur
 * - Tente de pré-classer chaque fichier P1-P5 via `categoryFromFilename`
 * - Si pas de préfixe, propose de renommer avant upload
 * - Upload vers le folder OneDrive lié au dossier (Graph PUT /content)
 *
 * Utilisé dans TabPieces (DossierDetail) et Pieces.tsx.
 */
import { useCallback, useState } from 'react'
import { Upload, FileText, Loader2, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import * as drive from '@/o365/onedrive'

type Props = {
  /** ID du folder OneDrive cible. */
  folderId: string
  /** Si le folder est sur un drive tiers (partagé), son driveId. */
  driveId?: string
  /** Callback appelé après chaque upload réussi (pour rafraîchir la liste). */
  onUploaded?: (filename: string) => void
  /** Désactive complètement la zone (ex: pas connecté à O365). */
  disabled?: boolean
  /** Classe CSS supplémentaire pour le wrapper. */
  className?: string
  /** Texte de l'invite. */
  label?: string
}

type PendingFile = {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  cat?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | null
  error?: string
}

export default function DropZone({ folderId, driveId, onUploaded, disabled, className, label }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [pending, setPending] = useState<PendingFile[]>([])

  const upload = useCallback(async (file: File) => {
    const cat = drive.categoryFromFilename(file.name)
    setPending((prev) => prev.map((p) => p.file === file ? { ...p, status: 'uploading', cat } : p))
    try {
      // Graph permet PUT direct pour les fichiers < 4 Mo (au-delà : upload session non implémenté).
      if (file.size > 4 * 1024 * 1024) {
        throw new Error('Fichier trop volumineux (> 4 Mo). Compressez le PDF ou uploadez-le directement depuis OneDrive.')
      }
      const buffer = await file.arrayBuffer()
      const { uploadFile } = await import('@/o365/onedrive-upload')
      await uploadFile(folderId, file.name, buffer, driveId)
      setPending((prev) => prev.map((p) => p.file === file ? { ...p, status: 'done' } : p))
      onUploaded?.(file.name)
      toast.success(`${file.name} uploadé`, { description: cat ? `Classé ${cat}` : 'Sans préfixe P1-P5' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setPending((prev) => prev.map((p) => p.file === file ? { ...p, status: 'error', error: msg } : p))
      toast.error(`Échec ${file.name}`, { description: msg.slice(0, 200) })
    }
  }, [folderId, driveId, onUploaded])

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    setPending((prev) => [...prev, ...arr.map((file) => ({ file, status: 'pending' as const }))])
    arr.forEach((f) => void upload(f))
  }, [upload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [disabled, handleFiles])

  return (
    <div className={className}>
      <label
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'relative block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition',
          dragOver ? 'border-gold-500 bg-gold-50' : 'border-navy-200 hover:border-navy-400 hover:bg-navy-50/40',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        )}
      >
        <input
          type="file"
          multiple
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          disabled={disabled}
        />
        <Upload className={cn('h-8 w-8 mx-auto mb-2', dragOver ? 'text-gold-700' : 'text-navy-400')} />
        <div className="text-sm font-medium text-navy-900">
          {label ?? 'Glisse des fichiers ici ou clique pour parcourir'}
        </div>
        <div className="text-[11px] text-navy-500 mt-1">
          Préfixe les fichiers <code>P1_</code>, <code>P2_</code>… pour le classement automatique
        </div>
      </label>

      {pending.length > 0 && (
        <div className="mt-3 space-y-1">
          {pending.map((p, i) => (
            <div key={i} className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs',
              p.status === 'done' ? 'bg-emerald-50 text-emerald-800' :
              p.status === 'error' ? 'bg-rose-50 text-rose-800' :
              p.status === 'uploading' ? 'bg-navy-50 text-navy-700' : 'bg-navy-50 text-navy-500',
            )}>
              {p.status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
              {p.status === 'error' && <AlertCircle className="h-3 w-3 shrink-0" />}
              {p.status === 'done' && <FileText className="h-3 w-3 shrink-0" />}
              {p.status === 'pending' && <FileText className="h-3 w-3 shrink-0 text-navy-300" />}
              <span className="flex-1 truncate font-mono">{p.file.name}</span>
              {p.cat && <span className="font-mono font-bold text-gold-700">{p.cat}</span>}
              {!p.cat && p.status !== 'pending' && <span className="text-amber-700 text-[10px]">sans préfixe</span>}
              {p.status === 'done' && (
                <button onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))} className="text-navy-400 hover:text-navy-700">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
