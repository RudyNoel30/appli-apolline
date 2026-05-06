import { cn } from '@/lib/utils'

type Props = {
  className?: string
  animated?: boolean
}

export default function Logo({ className, animated = true }: Props) {
  return (
    <div className={cn('flex items-center', className)}>
      <img
        src="/extrapol-logo.png"
        alt="Extr'Apol"
        width={88}
        height={56}
        className={cn(
          'block drop-shadow-sm transition-transform duration-500 select-none',
          animated && 'hover:scale-105 hover:-rotate-2',
        )}
        draggable={false}
      />
    </div>
  )
}
