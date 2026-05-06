/**
 * Palette de recherche globale Cmd+K (Ctrl+K sous Windows).
 *
 * Cherche en simultané dans :
 *  - Clients / prospects (nom, prénom, email, tél, ville)
 *  - Dossiers (réf, clientNom, ville bien, statut)
 *  - RDV à venir (clientNom, lieu)
 *  - Pages de l'app (raccourcis vers Dashboard, Simulation, DVF, Pièces, …)
 *
 * Navigation au clavier : ↑ / ↓ pour parcourir, Entrée pour valider, Échap pour fermer.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, User2, CalendarDays, ArrowRight, Home, Calculator, Map, FolderOpen, MailOpen, Coins, Settings } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { cn } from '@/lib/utils'

type ResultKind = 'client' | 'dossier' | 'rdv' | 'page'
type Result = {
  id: string
  kind: ResultKind
  label: string
  hint?: string
  badge?: string
  icon: typeof Search
  to: string
}

const PAGES: Result[] = [
  { id: 'page:dashboard', kind: 'page', label: 'Tableau de bord', icon: Home, to: '/' },
  { id: 'page:dossiers', kind: 'page', label: 'Dossiers (pipeline)', icon: FolderOpen, to: '/dossiers' },
  { id: 'page:prospects', kind: 'page', label: 'Prospects', icon: User2, to: '/prospects' },
  { id: 'page:clients', kind: 'page', label: 'Clients', icon: User2, to: '/clients' },
  { id: 'page:saisie', kind: 'page', label: 'Nouveau dossier', icon: ArrowRight, to: '/saisie' },
  { id: 'page:simulation', kind: 'page', label: 'Simulation multi-banques', icon: Calculator, to: '/simulation' },
  { id: 'page:dvf', kind: 'page', label: 'Étude DVF', icon: Map, to: '/dvf' },
  { id: 'page:pieces', kind: 'page', label: 'Pièces', icon: FolderOpen, to: '/pieces' },
  { id: 'page:agenda', kind: 'page', label: 'Agenda', icon: CalendarDays, to: '/agenda' },
  { id: 'page:messagerie', kind: 'page', label: 'Messagerie', icon: MailOpen, to: '/messagerie' },
  { id: 'page:commissions', kind: 'page', label: 'Commissions', icon: Coins, to: '/commissions' },
  { id: 'page:parametres', kind: 'page', label: 'Paramètres', icon: Settings, to: '/parametres' },
]

const safe = (s: unknown): string => (typeof s === 'string' ? s : '')

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const clients = useStore((s) => s.clients)
  const dossiers = useStore((s) => s.dossiers)
  const rdvs = useStore((s) => s.rdvs)

  // Toggle Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery(''); setHi(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const results: Result[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out: Result[] = []
    if (!q) {
      // Suggestions par défaut : pages + 5 derniers dossiers
      out.push(...PAGES)
      for (const d of dossiers.slice(0, 5)) {
        out.push({
          id: `dossier:${d.id}`, kind: 'dossier', icon: FileText,
          label: `${d.ref} — ${d.clientNom}`,
          hint: `${d.typeProjet} · ${d.villeBien}`,
          badge: d.statut,
          to: `/dossiers/${d.id}`,
        })
      }
      return out.slice(0, 12)
    }
    for (const p of PAGES) {
      if (p.label.toLowerCase().includes(q)) out.push(p)
    }
    for (const c of clients) {
      const tag = `${safe(c.prenom)} ${safe(c.nom)} ${safe(c.email)} ${safe(c.tel)} ${safe(c.ville)}`.toLowerCase()
      if (tag.includes(q)) {
        const path = c.statutCommercial === 'client' ? '/clients' : '/prospects'
        out.push({
          id: `client:${c.id}`, kind: 'client', icon: User2,
          label: `${safe(c.prenom)} ${safe(c.nom)}`,
          hint: [safe(c.email), safe(c.ville)].filter(Boolean).join(' · '),
          badge: c.statutCommercial,
          to: path,
        })
        if (out.length > 30) break
      }
    }
    for (const d of dossiers) {
      const tag = `${safe(d.ref)} ${safe(d.clientNom)} ${safe(d.villeBien)} ${safe(d.typeProjet)} ${safe(d.statut)}`.toLowerCase()
      if (tag.includes(q)) {
        out.push({
          id: `dossier:${d.id}`, kind: 'dossier', icon: FileText,
          label: `${d.ref} — ${d.clientNom}`,
          hint: `${d.typeProjet} · ${d.villeBien}`,
          badge: d.statut,
          to: `/dossiers/${d.id}`,
        })
        if (out.length > 50) break
      }
    }
    const now = Date.now()
    for (const r of rdvs) {
      const ts = new Date(r.date).getTime()
      if (ts < now) continue
      const tag = `${safe(r.clientNom)} ${safe(r.lieu)} ${safe(r.type)}`.toLowerCase()
      if (tag.includes(q)) {
        out.push({
          id: `rdv:${r.id}`, kind: 'rdv', icon: CalendarDays,
          label: `${r.clientNom ?? '—'} · ${new Date(r.date).toLocaleDateString('fr-FR')}`,
          hint: `${r.type ?? 'RDV'} · ${r.lieu ?? ''}`,
          to: '/agenda',
        })
        if (out.length > 60) break
      }
    }
    return out.slice(0, 30)
  }, [query, clients, dossiers, rdvs])

  // Reset highlight quand la liste change
  useEffect(() => { setHi(0) }, [query, results.length])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[hi]
      if (r) {
        navigate(r.to)
        setOpen(false)
      }
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4 animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl bg-white rounded-xl2 shadow-raised overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-navy-100">
          <Search className="h-4 w-4 text-navy-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Cherche un client, un dossier, un RDV, une page…"
            className="flex-1 bg-transparent outline-none text-sm text-navy-900 placeholder:text-navy-400"
          />
          <kbd className="text-[10px] font-mono bg-navy-50 border border-navy-200 rounded px-1.5 py-0.5 text-navy-600">Esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-navy-400">
              Aucun résultat pour <strong>"{query}"</strong>
              <div className="text-[11px] mt-1">Essayez de demander à Jarvis ↓</div>
            </div>
          ) : (
            results.map((r, i) => {
              const Icon = r.icon
              const active = i === hi
              return (
                <button
                  key={r.id}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => { navigate(r.to); setOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition',
                    active ? 'bg-gold-50 text-navy-900' : 'text-navy-700 hover:bg-navy-50',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-gold-700' : 'text-navy-400')} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.label}</div>
                    {r.hint && <div className="text-[11px] text-navy-500 truncate">{r.hint}</div>}
                  </div>
                  {r.badge && (
                    <span className="text-[10px] uppercase tracking-wider text-navy-500 bg-navy-50 rounded px-1.5 py-0.5">
                      {r.badge}
                    </span>
                  )}
                  {active && <ArrowRight className="h-3.5 w-3.5 text-gold-700 shrink-0" />}
                </button>
              )
            })
          )}

          {/* Toujours afficher l'option "Demander à Jarvis" — utile pour les requêtes
              en langage naturel ("dossiers en montage", "calcule HCSF pour 350k€", etc.)
              que la recherche fulltext ne sait pas gérer. */}
          {query.trim() && (
            <button
              onClick={() => {
                const q = query.trim()
                setOpen(false)
                window.dispatchEvent(new CustomEvent('apolline:coworker-toggle'))
                // Pré-remplit le textarea Jarvis et déclenche l'envoi
                setTimeout(() => {
                  const ta = document.querySelector<HTMLTextAreaElement>('aside textarea')
                  if (ta) {
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
                    setter?.call(ta, q)
                    ta.dispatchEvent(new Event('input', { bubbles: true }))
                    ta.focus()
                  }
                }, 250)
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition border-t border-navy-100 mt-1 hover:bg-gradient-to-r hover:from-gold-50 hover:to-transparent group"
            >
              <span className="h-4 w-4 shrink-0 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white">
                  <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5Z" fill="currentColor" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-navy-900">
                  Demander à Jarvis : <span className="font-normal italic text-navy-700">"{query.trim()}"</span>
                </div>
                <div className="text-[11px] text-navy-500">Recherche en langage naturel · ouvre Jarvis</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider bg-gold-100 text-gold-800 rounded px-1.5 py-0.5 group-hover:bg-gold-200 transition-colors">
                IA
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-gold-700 shrink-0" />
            </button>
          )}
        </div>
        <div className="px-4 py-2 border-t border-navy-100 text-[10px] text-navy-400 flex items-center gap-3">
          <span><kbd className="bg-navy-50 border border-navy-200 rounded px-1 font-mono">↑↓</kbd> naviguer</span>
          <span><kbd className="bg-navy-50 border border-navy-200 rounded px-1 font-mono">↵</kbd> ouvrir</span>
          <span><kbd className="bg-navy-50 border border-navy-200 rounded px-1 font-mono">Ctrl+I</kbd> Jarvis</span>
          <span className="ml-auto">{results.length} résultats</span>
        </div>
      </div>
    </div>
  )
}
