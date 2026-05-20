import { useState, useEffect, useRef } from 'react'
import { Search, Plus, Command, FileText, UserPlus, Calendar, Calculator, Map as MapIcon, FolderOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import UserMenu from './UserMenu'
import NotificationCenter from './NotificationCenter'
import { useStore } from '@/stores/useStore'
import { cn, initials } from '@/lib/utils'

export default function Topbar() {
  const navigate = useNavigate()
  const clients = useStore((s) => s.clients)
  const dossiers = useStore((s) => s.dossiers)

  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ref.current?.querySelector('input')?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const qLower = q.toLowerCase()
  const clientsMatch = q.length >= 1 ? clients
    .filter((c) => `${c.prenom} ${c.nom} ${c.email} ${c.ville}`.toLowerCase().includes(qLower))
    .slice(0, 5) : []
  const dossiersMatch = q.length >= 1 ? dossiers
    .filter((d) => `${d.ref} ${d.clientNom} ${d.villeBien}`.toLowerCase().includes(qLower))
    .slice(0, 5) : []

  const quickActions = [
    { icon: UserPlus, label: 'Nouveau client', action: () => navigate('/clients'), hint: 'Clients' },
    { icon: FileText, label: 'Nouveau dossier', action: () => navigate('/saisie'), hint: 'Saisie' },
    { icon: Calendar, label: 'Nouveau RDV', action: () => navigate('/agenda'), hint: 'Agenda' },
    { icon: Calculator, label: 'Nouvelle simulation', action: () => navigate('/simulation'), hint: 'Simulation' },
    { icon: MapIcon, label: 'Étude DVF', action: () => navigate('/dvf'), hint: 'DVF' },
    { icon: FolderOpen, label: 'Voir pièces', action: () => navigate('/pieces'), hint: 'Pièces' },
  ]

  return (
    <header className="h-16 shrink-0 bg-white border-b border-navy-100 px-6 flex items-center gap-4 animate-fade-in-down relative z-40">
      <div ref={ref} className="relative flex-1 max-w-xl group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400 transition-colors duration-200 group-focus-within:text-gold-600" />
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher client, dossier, pièce…"
          className="w-full pl-10 pr-16 py-2 rounded-lg border border-navy-100 bg-ivory/60 text-sm placeholder:text-navy-400 focus:border-gold-500 focus:ring-2 focus:ring-gold-200 focus:bg-white outline-none transition-all duration-200"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-navy-400 font-mono transition-opacity duration-200 group-focus-within:opacity-0">
          <Command className="h-3 w-3" /> K
        </span>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-2 card shadow-raised max-h-[480px] overflow-y-auto animate-fade-in-down">
            {q.length === 0 ? (
              <>
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Actions rapides</div>
                {quickActions.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => { a.action(); setOpen(false); setQ('') }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-navy-50 transition text-left"
                  >
                    <a.icon className="h-4 w-4 text-navy-500" />
                    <div className="flex-1">
                      <div className="text-sm text-navy-900">{a.label}</div>
                    </div>
                    <span className="text-[10px] text-navy-400">{a.hint}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                {clientsMatch.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-navy-500 font-semibold">
                      Clients ({clientsMatch.length})
                    </div>
                    {clientsMatch.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          if (c.dossierIds?.[0]) navigate(`/dossiers/${c.dossierIds[0]}`)
                          else navigate('/clients')
                          setOpen(false); setQ('')
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-navy-50 transition text-left"
                      >
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-navy-800 to-navy-900 text-gold-400 flex items-center justify-center font-semibold text-[11px]">
                          {initials(c.prenom + ' ' + c.nom)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-navy-900 truncate">{c.prenom} {c.nom}</div>
                          <div className="text-[11px] text-navy-500 truncate">{c.email} · {c.ville}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {dossiersMatch.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-navy-500 font-semibold">
                      Dossiers ({dossiersMatch.length})
                    </div>
                    {dossiersMatch.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => { navigate(`/dossiers/${d.id}`); setOpen(false); setQ('') }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-navy-50 transition text-left"
                      >
                        <span className="font-mono text-xs text-gold-700 w-20 shrink-0">{d.ref}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-navy-900 truncate">{d.clientNom}</div>
                          <div className="text-[11px] text-navy-500 truncate">{d.typeProjet} · {d.villeBien}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {clientsMatch.length === 0 && dossiersMatch.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-navy-400">
                    Aucun résultat pour <strong>"{q}"</strong>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          className="btn-gold press group"
          onClick={() => navigate('/saisie')}
        >
          <Plus className={cn('h-4 w-4 transition-transform duration-300 group-hover:rotate-90')} />
          Nouveau dossier
        </button>
        <NotificationCenter />

        <div className="border-l border-navy-100 ml-1 pl-1">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
