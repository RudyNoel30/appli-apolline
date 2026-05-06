import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Trash2, AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/stores/useStore'
import { cn } from '@/lib/utils'

function relativeTime(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'à l\'instant'
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.round(h / 24)
  if (j < 7) return `il y a ${j} j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const ICONS = {
  info: { Icon: Info, cls: 'text-sky-600 bg-sky-50' },
  success: { Icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' },
  warning: { Icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50' },
  danger: { Icon: AlertCircle, cls: 'text-rose-600 bg-rose-50' },
}

export default function NotificationCenter() {
  const notifications = useStore((s) => s.notifications)
  const markNotifRead = useStore((s) => s.markNotifRead)
  const markAllNotifsRead = useStore((s) => s.markAllNotifsRead)
  const deleteNotif = useStore((s) => s.deleteNotif)
  const clearNotifs = useStore((s) => s.clearNotifs)

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'nonlu' | 'tous'>('nonlu')
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const unread = notifications.filter((n) => !n.read).length
  const list = tab === 'nonlu' ? notifications.filter((n) => !n.read) : notifications

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const onClickNotif = (id: string, link?: string) => {
    markNotifRead(id)
    if (link) {
      navigate(link)
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        className="relative h-10 w-10 rounded-lg border border-navy-100 bg-white flex items-center justify-center text-navy-700 hover:bg-navy-50 transition-all duration-200 press group"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className={cn(
          'h-4 w-4 transition-transform duration-300',
          unread > 0 ? 'group-hover:rotate-12' : 'group-hover:rotate-6',
        )} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-pulse-soft">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[400px] max-h-[560px] card shadow-raised z-50 overflow-hidden animate-fade-in-down origin-top-right flex flex-col">
          <div className="p-4 border-b border-navy-100 bg-gradient-to-br from-navy-900 to-navy-800 text-white relative overflow-hidden">
            <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gold-500/20 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg">Notifications</h3>
                <p className="text-xs text-navy-200">
                  {unread === 0 ? 'Tout est à jour' : `${unread} non lue${unread > 1 ? 's' : ''}`}
                </p>
              </div>
              {notifications.length > 0 && (
                <div className="flex items-center gap-1">
                  {unread > 0 && (
                    <button
                      onClick={markAllNotifsRead}
                      className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition"
                      title="Tout marquer comme lu"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      clearNotifs()
                      toast.success('Toutes les notifications effacées')
                      setOpen(false)
                    }}
                    className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-rose-300 transition"
                    title="Tout effacer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex border-b border-navy-100 bg-ivory/50">
            <button
              onClick={() => setTab('nonlu')}
              className={cn(
                'flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2',
                tab === 'nonlu' ? 'border-gold-500 text-navy-900' : 'border-transparent text-navy-500 hover:text-navy-800',
              )}
            >
              Non lues {unread > 0 && <span className="ml-1 text-gold-700">({unread})</span>}
            </button>
            <button
              onClick={() => setTab('tous')}
              className={cn(
                'flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2',
                tab === 'tous' ? 'border-gold-500 text-navy-900' : 'border-transparent text-navy-500 hover:text-navy-800',
              )}
            >
              Toutes ({notifications.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scroll-isolated">
            {list.length === 0 ? (
              <div className="p-8 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold text-navy-900 mb-1">Tout est à jour</div>
                <div className="text-xs text-navy-500">
                  {tab === 'nonlu' ? 'Aucune notification non lue' : 'Aucune notification'}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-navy-50 list-fast">
                {list.map((n) => {
                  const { Icon, cls } = ICONS[n.type]
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        'group p-3 hover:bg-navy-50/50 transition-colors duration-150 cursor-pointer flex items-start gap-3 relative',
                        !n.read && 'bg-gold-50/30',
                      )}
                      onClick={() => onClickNotif(n.id, n.link)}
                    >
                      {!n.read && (
                        <span className="absolute left-1 top-4 h-1.5 w-1.5 rounded-full bg-gold-500" />
                      )}
                      <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', cls)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-navy-900">{n.title}</div>
                        {n.description && (
                          <div className="text-xs text-navy-600 mt-0.5">{n.description}</div>
                        )}
                        <div className="text-[10px] text-navy-400 mt-1">{relativeTime(n.createdAt)}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNotif(n.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-md hover:bg-rose-50 flex items-center justify-center text-navy-400 hover:text-rose-700 transition shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
