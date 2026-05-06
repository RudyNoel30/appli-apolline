import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, UserPlus, Plus } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { cn } from '@/lib/utils'
import type { Apporteur } from '@/data/mock'

type Props = {
  /** Valeur courante (texte libre, peut correspondre à un Apporteur en base ou pas) */
  value: string
  onChange: (value: string, apporteurId?: string) => void
  placeholder?: string
  className?: string
}

/**
 * Combobox apporteur :
 *   - Champ texte libre, l'utilisateur peut taper n'importe quoi
 *   - Dropdown autocomplete suggérant les apporteurs existants en base
 *   - Si la valeur saisie ne correspond à aucun apporteur, l'utilisateur peut
 *     l'ajouter à la base via un raccourci dans le dropdown
 */
export default function ApporteurCombobox({ value, onChange, placeholder, className }: Props) {
  const apporteurs = useStore((s) => s.apporteurs)
  const addApporteur = useStore((s) => s.addApporteur)

  const [open, setOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Suggestions filtrées par la saisie
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) {
      // Si vide : montrer les 8 plus récents
      return [...apporteurs]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8)
    }
    return apporteurs
      .filter((a) =>
        a.nom.toLowerCase().includes(q) ||
        a.societe?.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        a.ville?.toLowerCase().includes(q),
      )
      .slice(0, 10)
  }, [apporteurs, value])

  // Existe déjà en base ?
  const exactMatch = useMemo(
    () => apporteurs.find((a) => a.nom.toLowerCase() === value.trim().toLowerCase()),
    [apporteurs, value],
  )
  const canCreateNew = value.trim().length >= 2 && !exactMatch

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const select = (a: Apporteur) => {
    onChange(a.nom, a.id)
    setOpen(false)
    inputRef.current?.blur()
  }

  const createAndSelect = () => {
    const trimmed = value.trim()
    if (trimmed.length < 2) return
    const newA = addApporteur({
      nom: trimmed,
      type: 'Autre',
    })
    onChange(newA.nom, newA.id)
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, suggestions.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIdx < suggestions.length) {
        select(suggestions[highlightIdx])
      } else if (canCreateNew) {
        createAndSelect()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="text"
        className="input pr-9"
        value={value}
        onChange={(e) => { onChange(e.target.value, undefined); setOpen(true); setHighlightIdx(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder ?? 'Tapez le nom de l\'apporteur…'}
      />
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); inputRef.current?.focus() }}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md hover:bg-navy-50 flex items-center justify-center text-navy-400 hover:text-navy-700 transition"
        title="Voir la liste des apporteurs"
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 card shadow-raised max-h-72 overflow-y-auto scroll-isolated animate-fade-in-down">
          {suggestions.length === 0 && !canCreateNew && (
            <div className="px-3 py-3 text-xs text-navy-400 italic">
              Aucun apporteur correspondant. Tapez au moins 2 caractères pour pouvoir en ajouter un.
            </div>
          )}

          {suggestions.length > 0 && (
            <>
              <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-navy-500 font-semibold border-b border-navy-50">
                Apporteurs existants ({suggestions.length})
              </div>
              {suggestions.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => select(a)}
                  onMouseEnter={() => setHighlightIdx(i)}
                  className={cn(
                    'w-full text-left px-3 py-2 hover:bg-navy-50 flex items-center gap-3 transition-colors duration-150',
                    highlightIdx === i && 'bg-gold-50',
                  )}
                >
                  <UserPlus className="h-4 w-4 text-navy-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-navy-900 truncate">{a.nom}</div>
                    <div className="text-[11px] text-navy-500 truncate">
                      {a.type}
                      {a.societe ? ` · ${a.societe}` : ''}
                      {a.ville ? ` · ${a.ville}` : ''}
                      {a.retrocession ? ` · rétro ${(a.retrocession * 100).toFixed(0)}%` : ''}
                    </div>
                  </div>
                  {a.importeDeCifacil && (
                    <span className="text-[9px] uppercase tracking-wider text-gold-700 font-semibold shrink-0">Cifacil</span>
                  )}
                </button>
              ))}
            </>
          )}

          {canCreateNew && (
            <>
              {suggestions.length > 0 && <div className="border-t border-navy-50" />}
              <button
                type="button"
                onClick={createAndSelect}
                onMouseEnter={() => setHighlightIdx(suggestions.length)}
                className={cn(
                  'w-full text-left px-3 py-2.5 hover:bg-emerald-50 flex items-center gap-3 transition',
                  highlightIdx === suggestions.length && 'bg-emerald-50',
                )}
              >
                <div className="h-7 w-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-emerald-900">
                    Créer « {value.trim()} »
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Ajouter à la base d'apporteurs (vous pourrez compléter sa fiche après)
                  </div>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
