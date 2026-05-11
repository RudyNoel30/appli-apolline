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
      className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          // h-[90vh] + max-h impose une hauteur stable ; flex-col + min-h-0
          // permet à la zone scrollable de bien se rétracter et le footer
          // d'être toujours visible. On force aussi overflow-hidden au
          // container pour que rien ne dépasse les rounded corners.
          'relative bg-white rounded-xl2 shadow-raised w-full max-h-[90vh] flex flex-col animate-scale-in overflow-hidden',
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
