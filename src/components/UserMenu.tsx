import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, UserCog, Users, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { cn, initials } from '@/lib/utils'

export default function UserMenu() {
  const { currentUser, logout, switchUser } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!currentUser) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 pl-3 pr-2 py-1 rounded-lg hover:bg-navy-50 transition group"
      >
        <div className="text-right leading-tight">
          <div className="text-sm font-semibold text-navy-900">
            {currentUser.prenom} {currentUser.nom}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-navy-500">
            {currentUser.roleLabel}
          </div>
        </div>
        <div className={cn(
          'h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center font-serif font-semibold shadow-soft group-hover:shadow-raised transition-all duration-200 group-hover:scale-105',
          currentUser.avatarGradient,
          currentUser.avatarAccent,
        )}>
          {initials(currentUser.prenom + ' ' + currentUser.nom)}
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-navy-400 transition-transform duration-200',
          open && 'rotate-180',
        )} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 card shadow-raised z-50 overflow-hidden animate-fade-in-down origin-top-right">
          <div className={cn(
            'p-4 bg-gradient-to-br text-white relative overflow-hidden',
            currentUser.avatarGradient,
          )}>
            <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className={cn(
                'h-14 w-14 rounded-full bg-white/10 backdrop-blur border-2 border-white/20 flex items-center justify-center font-serif text-xl font-semibold',
                currentUser.avatarAccent,
              )}>
                {initials(currentUser.prenom + ' ' + currentUser.nom)}
              </div>
              <div>
                <div className="font-serif text-base">{currentUser.prenom} {currentUser.nom}</div>
                <div className="text-[11px] text-white/80">{currentUser.email}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider opacity-80">
                  {currentUser.roleLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="p-2 space-y-0.5">
            <button
              onClick={() => { setOpen(false); navigate('/parametres') }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-navy-700 hover:bg-navy-50 transition group"
            >
              <UserCog className="h-4 w-4 text-navy-400 group-hover:text-gold-600 transition" />
              Mon profil
            </button>
            <button
              onClick={() => { setOpen(false); navigate('/parametres') }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-navy-700 hover:bg-navy-50 transition group"
            >
              <Settings className="h-4 w-4 text-navy-400 group-hover:text-gold-600 group-hover:rotate-45 transition duration-300" />
              Paramètres
            </button>
            <button
              onClick={() => { setOpen(false); switchUser() }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-navy-700 hover:bg-navy-50 transition group"
            >
              <Users className="h-4 w-4 text-navy-400 group-hover:text-gold-600 transition" />
              Changer de compte
            </button>
          </div>

          <div className="border-t border-navy-100 p-2">
            <button
              onClick={() => { setOpen(false); logout() }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-rose-700 hover:bg-rose-50 transition"
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
