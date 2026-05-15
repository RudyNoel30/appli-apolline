import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

  // Portal vers document.body : la modale s'échappe de la hiérarchie React et
  // n'est donc plus containée par les transforms persistants des ancêtres
  // (.page, .page > *, etc.). Garantit l'affichage en plein écran partout.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop plein écran, derrière la modale */}
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" />

      {/*
        Centrage par flexbox du parent (items-center justify-center) →
        AUCUN transform sur la modale elle-même (l'animation animate-scale-in
        utilise transform:scale et écraserait un translate-x).

        On découple le wrapper de positionnement (relative, max-h, flex-col)
        de la couche d'animation (un enfant intérieur). Comme ça scale-in
        ne touche jamais le positionnement.
      */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          // max-h-[calc(...)] : en Tailwind arbitrary values, le `-` à
          // l'intérieur de calc() doit être entouré d'underscores qui sont
          // convertis en espaces, sinon Tailwind sort `calc(100vh-3rem)`
          // qui est invalide en CSS → ignoré → modale sans max-h.
          'relative w-full max-h-[calc(100vh_-_3rem)] flex flex-col overflow-hidden',
          'bg-white rounded-xl2 shadow-raised animate-scale-in',
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
    </div>,
    document.body,
  )
}
