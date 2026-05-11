/**
 * FullScreenSheet — overlay plein écran pour les formulaires longs.
 *
 * Remplace `<Modal>` pour les cas où le contenu peut être très haut (PretEditor,
 * DossierEditor, etc.). Au lieu d'un dialogue centré avec un max-height qui
 * peut être pris en défaut par les calculs de viewport, on occupe TOUT
 * l'écran : header sticky en haut, contenu scrollable au milieu, footer
 * sticky en bas. Le footer avec les actions est TOUJOURS visible, garanti.
 *
 * Structure DOM :
 *   <div fixed inset-0 grid-rows-[auto_1fr_auto]>
 *     <header />            // shrink-0, hauteur intrinsèque
 *     <main overflow-y-auto />  // 1fr, prend tout l'espace restant
 *     <footer />            // shrink-0, hauteur intrinsèque
 *   </div>
 *
 * Avec grid-rows, on garantit que header + footer prennent leur taille
 * intrinsèque et que main prend EXACTEMENT le reste — pas de débordement
 * possible, peu importe le DPI scaling ou la taille de viewport.
 */
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  /** Titre principal (en haut à gauche, font-serif) */
  title: string
  /** Sous-titre optionnel sous le titre */
  description?: string
  /** Slot droit du header — pour boutons / badges contextuels */
  headerRight?: ReactNode
  /** Slot principal — le formulaire long */
  children: ReactNode
  /** Slot footer — boutons d'action (Annuler / Enregistrer / etc.) */
  actions?: ReactNode
}

export default function FullScreenSheet({
  open, onClose, title, description, headerRight, children, actions,
}: Props) {
  // Esc → close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Bloque le scroll du body quand la sheet est ouverte
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 grid grid-rows-[auto_1fr_auto] bg-ivory animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fullscreen-sheet-title"
    >
      {/* ─── HEADER (sticky, hauteur intrinsèque) ─── */}
      <header className="bg-white border-b border-navy-100 shadow-soft animate-fade-in-down">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 id="fullscreen-sheet-title" className="font-serif text-xl font-semibold text-navy-900 truncate">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-navy-500 mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-md hover:bg-navy-50 flex items-center justify-center text-navy-400 hover:text-navy-900 transition focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1"
              title="Fermer (Échap)"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── CONTENU (scrollable, prend tout l'espace restant) ─── */}
      <main className="overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-6 py-6 animate-fade-in-up">
          {children}
        </div>
      </main>

      {/* ─── FOOTER (sticky, hauteur intrinsèque, toujours visible) ─── */}
      {actions && (
        <footer className="bg-white border-t border-navy-100 shadow-[0_-2px_8px_-2px_rgba(10,31,61,0.06)]">
          <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-end gap-2">
            {actions}
          </div>
        </footer>
      )}
    </div>
  )
}
