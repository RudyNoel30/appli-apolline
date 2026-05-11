import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export default function Modal({ open, onClose, title, description, children, actions, size = 'md' }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }

  return (
    <div
      className="fixed inset-0 z-50 animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop plein écran, derrière la modale */}
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" />

      {/*
        Positionnement EXPLICITE par top/bottom au lieu d'un flex centré +
        max-h-[90vh]. C'est BEAUCOUP plus robuste dans WebView2 / Tauri où
        le calcul des max-h en vh peut être pris en défaut par certains
        zooms et chromes système. Avec top:24px / bottom:24px on garantit
        que la modale tient TOUJOURS dans la viewport, et son footer en
        bas est physiquement à 24 px du bord de l'écran.
      */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'absolute left-1/2 -translate-x-1/2 top-6 bottom-6',
          'bg-white rounded-xl2 shadow-raised flex flex-col animate-scale-in overflow-hidden',
          'w-[calc(100%-3rem)]', // largeur = 100% - 24px à gauche - 24px à droite
          widths[size],
        )}
      >
        <div className="flex items-start justify-between p-5 border-b border-navy-100 shrink-0">
          <div>
            <h2 className="font-serif text-xl font-semibold text-navy-900">{title}</h2>
            {description && <p className="text-xs text-navy-500 mt-1">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-md hover:bg-navy-50 flex items-center justify-center text-navy-400 hover:text-navy-900 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* min-h-0 CRITIQUE : sans lui le flex-1 hérite de min-height:auto
            (= hauteur du contenu) et empêche le scroll de s'enclencher,
            poussant le footer en dehors de la viewport. */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {children}
        </div>
        {actions && (
          <div className="flex items-center justify-end gap-2 p-5 border-t border-navy-100 bg-ivory/50 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
