import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export default function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="flex items-end justify-between gap-6 mb-6">
      <div>
        {eyebrow && (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-px w-8 bg-gold-500" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-700">
              {eyebrow}
            </span>
          </div>
        )}
        <h1 className="font-serif text-3xl font-semibold text-navy-900 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-navy-500 mt-1.5 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
