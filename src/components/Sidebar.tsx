import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, UserPlus, Users, FolderKanban, Calculator,
  MapPin, FolderOpen, CalendarDays, Coins, Mail, Settings,
  Pin, PinOff, Sparkles, Receipt,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/stores/useStore'
import Logo from './Logo'

const POLETTE_SEEN_KEY = 'apolline.polette_seen_v1'

const nav = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/prospects', label: 'Prospects', icon: UserPlus },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/dossiers', label: 'Dossiers', icon: FolderKanban },
  { to: '/simulation', label: 'Simulation', icon: Calculator },
  { to: '/dvf', label: 'Étude DVF', icon: MapPin },
  { to: '/pieces', label: 'Pièces', icon: FolderOpen },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/messagerie', label: 'Messagerie', icon: Mail },
  { to: '/commissions', label: 'Commissions', icon: Coins },
  { to: '/facturation', label: 'Facturation', icon: Receipt },
]

const HIDE_DELAY_MS = 250 // délai avant masquage pour éviter les disparitions accidentelles

export default function Sidebar() {
  const pinned = useStore((s) => s.settings.sidebarPinned ?? false)
  const updateSettings = useStore((s) => s.updateSettings)
  const [open, setOpen] = useState(false)
  const [poletteNew, setPoletteNew] = useState(() => typeof window !== 'undefined' && !localStorage.getItem(POLETTE_SEEN_KEY))
  const hideTimerRef = useRef<number | null>(null)
  const location = useLocation()

  const openPolette = () => {
    window.dispatchEvent(new CustomEvent('apolline:coworker-toggle'))
    if (poletteNew) {
      localStorage.setItem(POLETTE_SEEN_KEY, new Date().toISOString())
      setPoletteNew(false)
    }
  }

  // Quand épinglée, la sidebar est toujours visible
  const visible = pinned || open

  const show = () => {
    if (pinned) return // pas besoin de "show", déjà permanent
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    setOpen(true)
  }

  const scheduleHide = () => {
    if (pinned) return // pas de masquage si épinglée
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => setOpen(false), HIDE_DELAY_MS)
  }

  const togglePin = () => {
    updateSettings({ sidebarPinned: !pinned })
  }

  // Ferme la sidebar à chaque navigation (sinon elle reste ouverte si on clique vite)
  // Sauf si épinglée
  useEffect(() => {
    if (!pinned) setOpen(false)
  }, [location.pathname, pinned])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  return (
    <>
      {/* Zone de détection — bande de 8px à gauche de l'écran (désactivée si épinglée) */}
      {!pinned && (
        <div
          onMouseEnter={show}
          className="fixed top-0 left-0 h-full w-2 z-40"
          aria-hidden
        />
      )}

      {/* Indice visuel discret quand la sidebar est masquée — fine bande gold */}
      <div
        className={cn(
          'pointer-events-none fixed top-0 left-0 h-full w-1 z-30 transition-opacity duration-300',
          'bg-gradient-to-b from-gold-500/0 via-gold-500/40 to-gold-500/0',
          visible ? 'opacity-0' : 'opacity-100',
        )}
        aria-hidden
      />

      <aside
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-navy-900 text-navy-100 flex flex-col z-50',
          'transition-transform duration-300 ease-out-expo',
          'shadow-2xl shadow-navy-950/40',
          visible ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* halos décoratifs */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 -right-16 h-48 w-48 rounded-full bg-navy-600/30 blur-3xl" />

        <div className="px-5 py-5 border-b border-navy-800/60 relative z-10 animate-fade-in-down flex items-start justify-between gap-2">
          <Logo animated />
          <button
            type="button"
            onClick={togglePin}
            title={pinned ? 'Détacher la barre latérale' : 'Épingler la barre latérale'}
            className={cn(
              'shrink-0 h-7 w-7 rounded-md flex items-center justify-center transition-all',
              pinned
                ? 'bg-gold-500/20 text-gold-300 ring-1 ring-gold-500/40'
                : 'text-navy-400 hover:text-gold-300 hover:bg-navy-800/60',
            )}
          >
            {pinned ? <Pin className="h-3.5 w-3.5 rotate-45" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto relative z-10">
          {nav.map((item, i) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={{ animationDelay: `${60 + i * 30}ms` }}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-300 ease-out-expo animate-fade-in-up',
                  isActive
                    ? 'bg-navy-700/70 text-white shadow-inner ring-1 ring-gold-500/30'
                    : 'text-navy-200 hover:bg-navy-800/70 hover:text-white hover:translate-x-0.5',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gold-500" />
                  )}
                  <item.icon
                    className={cn(
                      'h-4 w-4 transition-all duration-300',
                      isActive
                        ? 'text-gold-400 scale-110'
                        : 'text-navy-300 group-hover:text-gold-300 group-hover:scale-110',
                    )}
                  />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold-500 animate-pulse-soft" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-navy-800/60 space-y-0.5 relative z-10">
          {/* Polette — assistant IA conversationnel (Ctrl+I) */}
          <button
            type="button"
            onClick={openPolette}
            title="Polette · assistant IA (Ctrl+I)"
            className="group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 text-navy-200 hover:bg-gold-500/10 hover:text-gold-300 hover:translate-x-0.5"
          >
            <Sparkles className="h-4 w-4 text-gold-400 group-hover:text-gold-300 group-hover:scale-110 transition-all" />
            <span className="font-medium">Polette</span>
            {poletteNew ? (
              <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.12em] font-bold bg-gold-500/20 text-gold-300 border border-gold-500/40 polette-pulse">
                Nouveau
              </span>
            ) : (
              <span className="ml-auto polette-mono text-[9px] text-navy-400 group-hover:text-gold-400/70 transition-colors">
                Ctrl+I
              </span>
            )}
          </button>

          <NavLink
            to="/parametres"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                isActive
                  ? 'bg-navy-800 text-white'
                  : 'text-navy-200 hover:bg-navy-800/70 hover:text-white hover:translate-x-0.5',
              )
            }
          >
            <Settings className="h-4 w-4 transition-transform duration-500 hover:rotate-45" /> Paramètres
          </NavLink>
        </div>
      </aside>
    </>
  )
}
