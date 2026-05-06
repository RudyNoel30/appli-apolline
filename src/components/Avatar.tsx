/**
 * Avatar — composant unifié pour afficher initiales + couleur d'un utilisateur.
 *
 * Centralise les patterns dispersés dans Topbar, Login, Clients, RgpdPane.
 * Génère automatiquement un gradient stable basé sur la chaîne d'entrée si
 * `gradient` n'est pas fourni — ça permet de l'utiliser même pour des entités
 * sans avatar custom (clients, apporteurs, etc.).
 */
import { cn, initials } from '@/lib/utils'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
  xl: 'h-14 w-14 text-base',
}

// Palette de gradients préd-définis (Tailwind compatibles).
// L'index est pris depuis un hash stable de la chaîne d'entrée.
const GRADIENTS = [
  'from-navy-600 to-navy-800',
  'from-gold-400 to-gold-600',
  'from-emerald-500 to-emerald-700',
  'from-sky-500 to-sky-700',
  'from-violet-500 to-violet-700',
  'from-rose-500 to-rose-700',
  'from-amber-500 to-amber-700',
  'from-teal-500 to-teal-700',
  'from-indigo-500 to-indigo-700',
  'from-lime-500 to-lime-700',
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function gradientFor(name: string): string {
  const idx = hashString(name) % GRADIENTS.length
  return GRADIENTS[idx]!
}

type Props = {
  /** Nom complet — utilisé pour les initiales et la couleur stable. */
  name: string
  /** Surcharge le gradient auto (ex: pour les collaborateurs avec leur couleur perso). */
  gradient?: string
  /** Surcharge supplémentaire de classes (text-white par défaut). */
  accent?: string
  size?: Size
  /** Affiche un dot de statut (vert/rouge) sur le coin bas-droite. */
  online?: boolean
  /** Tooltip natif. */
  title?: string
  className?: string
  /** Anneau gold autour quand l'avatar est sélectionné/actif. */
  active?: boolean
  /** Action au clic — rend l'avatar focusable. */
  onClick?: () => void
}

export default function Avatar({ name, gradient, accent, size = 'md', online, title, className, active, onClick }: Props) {
  const grad = gradient ?? gradientFor(name || '?')
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title ?? name}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full bg-gradient-to-br font-serif font-semibold shrink-0',
        'ring-2 ring-white/0 transition-all',
        SIZE_CLASSES[size],
        grad,
        accent ?? 'text-white',
        active && 'ring-gold-500 scale-105',
        onClick && 'cursor-pointer hover:scale-105 hover:ring-gold-500/50',
        className,
      )}
    >
      {initials(name) || '?'}
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white',
            online ? 'bg-emerald-500' : 'bg-navy-300',
            size === 'xs' || size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5',
          )}
          aria-hidden
        />
      )}
    </Tag>
  )
}
