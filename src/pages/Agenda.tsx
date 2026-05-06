import { useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus, Video, MapPin, Home, Clock, Pencil, Trash2, Download, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import { useStore, getO365EmailFor } from '@/stores/useStore'
import { useAuth } from '@/auth/AuthContext'
import type { Rdv } from '@/data/mock'
import { cn, dateTimeFr } from '@/lib/utils'
import * as o365 from '@/o365/msal'
import { O365_CLIENT_ID, O365_TENANT_ID } from '@/o365/config'
import { saveFile, FILTERS } from '@/lib/saveFile'

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

import type { AgendaView as View } from '@/stores/useStore'
const VIEWS: { key: View; label: string }[] = [
  { key: 'day', label: 'Jour' },
  { key: 'workweek', label: 'Semaine ouvrée' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
]

// Plage horaire de la grille temporelle (vues Jour/Semaine)
const HOUR_START = 7
const HOUR_END = 21
const HOUR_HEIGHT = 56 // px par heure

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function startOfWeek(d: Date, mondayFirst = true): Date {
  const x = startOfDay(d)
  const offset = mondayFirst ? (x.getDay() + 6) % 7 : x.getDay()
  x.setDate(x.getDate() - offset)
  return x
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function rdvColor(r: Rdv): string {
  // Invitation refusée → gris barré
  if (r.responseStatus === 'declined') return 'bg-slate-100 text-slate-500 line-through border-l-2 border-slate-300'
  // Invitation pas encore répondue → bordure pointillée pour signaler "à traiter"
  const isPending = r.responseStatus === 'notResponded'
  // Invitation tentative → atténuée
  const isTentative = r.responseStatus === 'tentative'
  const base =
    r.type === 'R1' ? 'bg-navy-100 text-navy-800 border-navy-500' :
    r.type === 'R2' ? 'bg-emerald-100 text-emerald-800 border-emerald-500' :
    r.type === 'R0' ? 'bg-indigo-100 text-indigo-800 border-indigo-500' :
    r.type === 'Signature' ? 'bg-gold-100 text-gold-800 border-gold-500' :
    'bg-slate-100 text-slate-800 border-slate-400'
  const borderStyle = isPending ? 'border-l-2 border-dashed' : 'border-l-2'
  const opacity = isTentative ? 'opacity-60' : ''
  return `${base} ${borderStyle} ${opacity}`.trim()
}

export default function Agenda() {
  const rdvs = useStore((s) => s.rdvs)
  const addRdv = useStore((s) => s.addRdv)
  const updateRdv = useStore((s) => s.updateRdv)
  const deleteRdv = useStore((s) => s.deleteRdv)
  const clients = useStore((s) => s.clients)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const replaceO365Rdvs = useStore((s) => s.replaceO365Rdvs)
  const { currentUser } = useAuth()
  const o365Email = getO365EmailFor(settings, currentUser?.id)

  const view: View = settings.agendaView ?? 'month'
  const setView = (v: View) => updateSettings({ agendaView: v })
  const [refDate, setRefDate] = useState<Date>(() => startOfDay(new Date()))
  const [modal, setModal] = useState<{ rdv?: Rdv; defaultDate?: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

  const today = startOfDay(new Date())

  // Plage de jours visibles selon la vue
  const visibleDays: Date[] = useMemo(() => {
    if (view === 'day') return [refDate]
    if (view === 'workweek') {
      const start = startOfWeek(refDate)
      return [0, 1, 2, 3, 4].map((i) => addDays(start, i))
    }
    if (view === 'week') {
      const start = startOfWeek(refDate)
      return Array.from({ length: 7 }, (_, i) => addDays(start, i))
    }
    // month — grille calendaire 6×7
    const monthStart = startOfMonth(refDate)
    const gridStart = startOfWeek(monthStart)
    const cells = Math.ceil(((monthStart.getDay() + 6) % 7 + new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()) / 7) * 7
    return Array.from({ length: cells }, (_, i) => addDays(gridStart, i))
  }, [view, refDate])

  // Index RDV par jour (clé YYYY-MM-DD)
  const rdvsByDay = useMemo(() => {
    const map: Record<string, Rdv[]> = {}
    rdvs.forEach((r) => {
      const d = new Date(r.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!map[key]) map[key] = []
      map[key].push(r)
    })
    return map
  }, [rdvs])

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // Navigation prev/next adaptée à la vue
  const navigate = (dir: -1 | 1) => {
    if (view === 'day') setRefDate((d) => addDays(d, dir))
    else if (view === 'workweek' || view === 'week') setRefDate((d) => addDays(d, dir * 7))
    else setRefDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1))
  }
  const goToday = () => setRefDate(startOfDay(new Date()))

  // Titre du header selon la vue
  const headerLabel = useMemo(() => {
    if (view === 'day') {
      return `${DAYS_LONG[(refDate.getDay() + 6) % 7]} ${refDate.getDate()} ${MONTHS_FR[refDate.getMonth()].toLowerCase()} ${refDate.getFullYear()}`
    }
    if (view === 'workweek' || view === 'week') {
      const start = visibleDays[0]
      const end = visibleDays[visibleDays.length - 1]
      const sameMonth = start.getMonth() === end.getMonth()
      const sameYear = start.getFullYear() === end.getFullYear()
      const startLabel = sameMonth ? `${start.getDate()}` : `${start.getDate()} ${MONTHS_FR[start.getMonth()].toLowerCase()}`
      const endLabel = `${end.getDate()} ${MONTHS_FR[end.getMonth()].toLowerCase()} ${end.getFullYear()}`
      return sameYear ? `${startLabel} – ${endLabel}` : `${start.getDate()} ${MONTHS_FR[start.getMonth()].toLowerCase()} ${start.getFullYear()} – ${endLabel}`
    }
    return `${MONTHS_FR[refDate.getMonth()]} ${refDate.getFullYear()}`
  }, [view, refDate, visibleDays])

  const exportIcal = async () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const toIcsDate = (iso: string) => {
      const d = new Date(iso)
      return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
    }
    const events = rdvs.map((r) => {
      const start = new Date(r.date)
      const end = new Date(start.getTime() + r.duree * 60000)
      const desc = [r.type, r.lieu, r.clientNom].filter(Boolean).join(' · ').replace(/\n/g, '\\n')
      return [
        'BEGIN:VEVENT',
        `UID:${r.id}@apolline.fr`,
        `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
        `DTSTART:${toIcsDate(r.date)}`,
        `DTEND:${toIcsDate(end.toISOString())}`,
        `SUMMARY:${(r.title || r.clientNom || '').replace(/\n/g, '\\n')}`,
        `DESCRIPTION:${desc}`,
        `LOCATION:${r.lieu}`,
        'END:VEVENT',
      ].join('\r\n')
    })
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Groupe Apolline//Plateforme de courtage//FR',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n')
    const path = await saveFile({
      defaultFilename: `apolline-agenda-${new Date().toISOString().slice(0, 10)}.ics`,
      content: ics,
      filters: FILTERS.ics,
      mimeType: 'text/calendar',
    })
    if (path === null) return
    toast.success(`${rdvs.length} RDV exportés au format iCal`, { description: path !== 'download' ? path : 'Téléchargé' })
  }

  const syncO365 = async () => {
    if (!o365Email) {
      toast.error('Connectez-vous d\'abord à O365 dans Paramètres → Intégrations')
      return
    }
    setSyncing(true)
    const t = toast.loading('Synchronisation O365…')
    try {
      const now = new Date()
      const start = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString()
      const end = new Date(now.getFullYear() + 1, now.getMonth() + 1, 0).toISOString()
      const events = await o365.fetchCalendarEvents(O365_CLIENT_ID, O365_TENANT_ID, start, end)
      const newRdvs = events.map(o365.graphToRdv)
      if (newRdvs.length === 0) {
        toast.warning('Aucun RDV trouvé dans Outlook', { id: t, description: 'La synchronisation est restée sans effet pour préserver les RDV en cache.' })
      } else {
        replaceO365Rdvs(newRdvs)
        toast.success(`${newRdvs.length} événement${newRdvs.length > 1 ? 's' : ''} O365 synchronisé${newRdvs.length > 1 ? 's' : ''}`, { id: t })
      }
    } catch (e: any) {
      toast.error('Échec synchronisation O365', { id: t, description: e?.message })
    } finally {
      setSyncing(false)
    }
  }

  const proches = [...rdvs].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)

  const openNew = (date?: Date, hour?: number) => {
    let defaultDate: string | undefined
    if (date) {
      const h = hour ?? 10
      defaultDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(h).padStart(2, '0')}:00`
    }
    setModal({ defaultDate })
  }

  return (
    <>
      <PageHeader
        eyebrow="Calendrier"
        title="Agenda"
        description="Rendez-vous clients, visites, signatures notaires"
        actions={
          <>
            {o365Email && (
              <button className="btn-outline" onClick={syncO365} disabled={syncing}>
                <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
                {syncing ? 'Sync…' : 'Sync O365'}
              </button>
            )}
            <button className="btn-outline" onClick={exportIcal}><Download className="h-4 w-4" /> Export .ics</button>
            <button className="btn-gold" onClick={() => openNew()}><Plus className="h-4 w-4" /> Nouveau RDV</button>
          </>
        }
      />

      <div className="page-body">
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-3 card p-5">
            {/* Toolbar : titre + nav + switcher de vue */}
            <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
              <h3 className="font-serif text-xl text-navy-900">{headerLabel}</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigate(-1)}
                    className="h-8 w-8 rounded-md border border-navy-200 hover:bg-navy-50 flex items-center justify-center"
                    title="Précédent"
                  >
                    <ChevronLeft className="h-4 w-4 text-navy-700" />
                  </button>
                  <button onClick={goToday} className="btn-outline h-8 px-3 text-xs">
                    Aujourd'hui
                  </button>
                  <button
                    onClick={() => navigate(1)}
                    className="h-8 w-8 rounded-md border border-navy-200 hover:bg-navy-50 flex items-center justify-center"
                    title="Suivant"
                  >
                    <ChevronRight className="h-4 w-4 text-navy-700" />
                  </button>
                </div>
                {/* Segmented control */}
                <div className="inline-flex rounded-md border border-navy-200 overflow-hidden">
                  {VIEWS.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => setView(v.key)}
                      className={cn(
                        'h-8 px-3 text-xs font-medium transition border-l border-navy-200 first:border-l-0',
                        view === v.key ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 hover:bg-navy-50',
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {view === 'month' ? (
              <MonthGrid
                visibleDays={visibleDays}
                refDate={refDate}
                today={today}
                rdvsByDay={rdvsByDay}
                dayKey={dayKey}
                onSelectDay={(d) => openNew(d)}
                onSelectRdv={(r) => setModal({ rdv: r })}
              />
            ) : (
              <TimeGrid
                visibleDays={visibleDays}
                today={today}
                rdvsByDay={rdvsByDay}
                dayKey={dayKey}
                onSelectSlot={(d, h) => openNew(d, h)}
                onSelectRdv={(r) => setModal({ rdv: r })}
              />
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-serif text-lg text-navy-900 mb-1">Prochains RDV</h3>
            <div className="divider-gold mb-4" />
            <div className="space-y-3">
              {proches.length === 0 && (
                <div className="text-xs text-navy-400 italic">Aucun RDV programmé.</div>
              )}
              {proches.map((r) => (
                <div
                  key={r.id}
                  className="group p-3 rounded-lg border border-navy-100 hover:border-gold-300 hover:bg-gold-50/30 transition cursor-pointer"
                  onClick={() => setModal({ rdv: r })}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn(
                      'badge',
                      r.type === 'R1' ? 'badge-navy' :
                      r.type === 'Signature' ? 'badge-gold' :
                      r.type === 'R0' ? 'badge-navy' : 'badge-success',
                    )}>{r.type}</span>
                    <span className="text-[10px] font-mono text-navy-400">{r.duree} min</span>
                  </div>
                  <div className="text-sm font-semibold text-navy-900 truncate">{r.clientNom ?? r.title}</div>
                  <div className="text-xs text-navy-500 truncate">{r.title}</div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-navy-600">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {dateTimeFr(r.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      {r.lieu === 'Visio' ? <Video className="h-3 w-3" /> :
                       r.lieu === 'Bureau' ? <MapPin className="h-3 w-3" /> :
                       <Home className="h-3 w-3" />}
                      {r.lieu}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <RdvModal
          rdv={modal.rdv}
          defaultDate={modal.defaultDate}
          clients={clients}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            const isConnected = !!o365Email
            if (modal.rdv) {
              updateRdv(modal.rdv.id, data)
              const merged: Rdv = { ...modal.rdv, ...data }
              const graphId = merged.graphId ?? (merged.id.startsWith('O365-') ? merged.id.slice(5) : undefined)
              if (isConnected && graphId) {
                try {
                  await o365.updateCalendarEvent(O365_CLIENT_ID, O365_TENANT_ID, graphId, o365.rdvToGraphInput(merged))
                  toast.success('RDV mis à jour · Outlook synchronisé')
                } catch (e: any) {
                  toast.error('RDV mis à jour localement', { description: 'Échec sync Outlook : ' + (e?.message ?? '') })
                }
              } else if (isConnected) {
                try {
                  const ev = await o365.createCalendarEvent(O365_CLIENT_ID, O365_TENANT_ID, o365.rdvToGraphInput(merged))
                  updateRdv(modal.rdv.id, { graphId: ev.id })
                  toast.success('RDV mis à jour · ajouté à Outlook')
                } catch (e: any) {
                  toast.error('RDV mis à jour localement', { description: 'Échec ajout Outlook : ' + (e?.message ?? '') })
                }
              } else {
                toast.success('RDV mis à jour')
              }
            } else {
              const newRdv = addRdv(data)
              if (isConnected) {
                try {
                  const ev = await o365.createCalendarEvent(O365_CLIENT_ID, O365_TENANT_ID, o365.rdvToGraphInput(newRdv))
                  updateRdv(newRdv.id, { graphId: ev.id })
                  toast.success('RDV créé · ajouté à Outlook')
                } catch (e: any) {
                  toast.error('RDV créé localement', { description: 'Échec ajout Outlook : ' + (e?.message ?? '') })
                }
              } else {
                toast.success('RDV créé', { description: 'Connecte-toi à Microsoft 365 pour synchroniser avec Outlook' })
              }
            }
            setModal(null)
          }}
          onDelete={async () => {
            if (!modal.rdv) return
            const rdv = modal.rdv
            const graphId = rdv.graphId ?? (rdv.id.startsWith('O365-') ? rdv.id.slice(5) : undefined)
            deleteRdv(rdv.id)
            if (o365Email && graphId) {
              try {
                await o365.deleteCalendarEvent(O365_CLIENT_ID, O365_TENANT_ID, graphId)
                toast.success('RDV supprimé · retiré d\'Outlook')
              } catch (e: any) {
                toast.error('RDV supprimé localement', { description: 'Échec suppression Outlook : ' + (e?.message ?? '') })
              }
            } else {
              toast.success('RDV supprimé')
            }
            setModal(null)
          }}
          onRespond={async (action) => {
            if (!modal.rdv) return
            const rdv = modal.rdv
            const graphId = rdv.graphId ?? (rdv.id.startsWith('O365-') ? rdv.id.slice(5) : undefined)
            if (!graphId) {
              toast.error('Impossible de répondre — événement non synchronisé avec Outlook')
              return
            }
            const labelByAction = { accept: 'acceptée', tentativelyAccept: 'mise en provisoire', decline: 'refusée' } as const
            const t = toast.loading(`Réponse en cours…`)
            try {
              await o365.respondToEvent(O365_CLIENT_ID, O365_TENANT_ID, graphId, action)
              // Re-sync immédiat pour récupérer le nouveau statut depuis Outlook
              const now = new Date()
              const start = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString()
              const end = new Date(now.getFullYear() + 1, now.getMonth() + 1, 0).toISOString()
              const events = await o365.fetchCalendarEvents(O365_CLIENT_ID, O365_TENANT_ID, start, end)
              replaceO365Rdvs(events.map(o365.graphToRdv))
              toast.success(`Invitation ${labelByAction[action]}`, { id: t })
              setModal(null)
            } catch (e: any) {
              toast.error('Échec de la réponse', { id: t, description: e?.message ?? 'Erreur Graph API' })
            }
          }}
        />
      )}
    </>
  )
}

/* ─────────────────────── Vue Mois ─────────────────────── */
function MonthGrid({
  visibleDays, refDate, today, rdvsByDay, dayKey, onSelectDay, onSelectRdv,
}: {
  visibleDays: Date[]
  refDate: Date
  today: Date
  rdvsByDay: Record<string, Rdv[]>
  dayKey: (d: Date) => string
  onSelectDay: (d: Date) => void
  onSelectRdv: (r: Rdv) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-px bg-navy-100 rounded-lg overflow-hidden border border-navy-100">
      {DAYS_SHORT.map((d) => (
        <div key={d} className="bg-ivory py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-navy-500">
          {d}
        </div>
      ))}
      {visibleDays.map((d) => {
        const inMonth = d.getMonth() === refDate.getMonth()
        const isToday = isSameDay(d, today)
        const items = rdvsByDay[dayKey(d)]
        return (
          <div
            key={d.toISOString()}
            onClick={() => onSelectDay(d)}
            className={cn(
              'bg-white min-h-[88px] p-1.5 text-xs relative cursor-pointer hover:bg-gold-50/40 transition',
              !inMonth && 'bg-ivory/40 text-navy-400',
              isToday && 'ring-2 ring-inset ring-gold-500 bg-gold-50/30',
            )}
          >
            <div className={cn('font-semibold mb-1', isToday ? 'text-gold-700' : inMonth ? 'text-navy-700' : 'text-navy-400')}>
              {d.getDate()}
            </div>
            <div className="space-y-0.5">
              {items?.slice(0, 2).map((r) => {
                const isInvit = r.isOrganizer === false
                return (
                  <div
                    key={r.id}
                    onClick={(e) => { e.stopPropagation(); onSelectRdv(r) }}
                    className={cn('truncate px-1.5 py-0.5 rounded text-[10px] font-medium hover:ring-1 hover:ring-gold-400 flex items-center gap-1', rdvColor(r))}
                  >
                    {isInvit && <span className="shrink-0" title="Invitation reçue">📨</span>}
                    <span className="truncate">{r.clientNom?.split(' ')[0] ?? r.title}</span>
                  </div>
                )
              })}
              {items && items.length > 2 && (
                <div className="text-[10px] text-navy-400 px-1.5">+{items.length - 2}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────── Vues Jour / Semaine ─────────────────────── */
function TimeGrid({
  visibleDays, today, rdvsByDay, dayKey, onSelectSlot, onSelectRdv,
}: {
  visibleDays: Date[]
  today: Date
  rdvsByDay: Record<string, Rdv[]>
  dayKey: (d: Date) => string
  onSelectSlot: (d: Date, hour: number) => void
  onSelectRdv: (r: Rdv) => void
}) {
  const totalHours = HOUR_END - HOUR_START
  const totalHeight = totalHours * HOUR_HEIGHT
  const hours = Array.from({ length: totalHours }, (_, i) => HOUR_START + i)

  return (
    <div className="border border-navy-100 rounded-lg overflow-hidden bg-white">
      {/* En-tête : libellés des jours */}
      <div className="grid border-b border-navy-100 bg-ivory" style={{ gridTemplateColumns: `60px repeat(${visibleDays.length}, 1fr)` }}>
        <div className="py-2" />
        {visibleDays.map((d) => {
          const isToday = isSameDay(d, today)
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'py-2 text-center border-l border-navy-100',
                isToday && 'bg-gold-50',
              )}
            >
              <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">
                {DAYS_SHORT[(d.getDay() + 6) % 7]}
              </div>
              <div className={cn('text-lg font-serif font-semibold', isToday ? 'text-gold-700' : 'text-navy-800')}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Grille horaire */}
      <div className="relative overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${visibleDays.length}, 1fr)`, height: totalHeight }}>
          {/* Colonne d'heures */}
          <div className="border-r border-navy-100">
            {hours.map((h) => (
              <div
                key={h}
                className="border-b border-navy-50 text-[10px] text-navy-400 text-right pr-2 pt-0.5"
                style={{ height: HOUR_HEIGHT }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Une colonne par jour */}
          {visibleDays.map((d) => {
            const items = (rdvsByDay[dayKey(d)] ?? []).filter((r) => {
              const start = new Date(r.date)
              return start.getHours() >= HOUR_START && start.getHours() < HOUR_END
            })
            const isToday = isSameDay(d, today)
            return (
              <div
                key={d.toISOString()}
                className={cn('relative border-l border-navy-100', isToday && 'bg-gold-50/20')}
              >
                {/* Slots cliquables (1 par heure) */}
                {hours.map((h) => (
                  <div
                    key={h}
                    onClick={() => onSelectSlot(d, h)}
                    className="border-b border-navy-50 hover:bg-gold-50/40 transition cursor-pointer"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}
                {/* RDV positionnés en absolu */}
                {items.map((r) => {
                  const start = new Date(r.date)
                  const startMin = (start.getHours() - HOUR_START) * 60 + start.getMinutes()
                  const top = (startMin / 60) * HOUR_HEIGHT
                  const height = Math.max(20, (r.duree / 60) * HOUR_HEIGHT - 2)
                  const isInvit = r.isOrganizer === false
                  return (
                    <button
                      key={r.id}
                      onClick={(e) => { e.stopPropagation(); onSelectRdv(r) }}
                      className={cn(
                        'absolute left-1 right-1 rounded px-1.5 py-1 text-left overflow-hidden hover:ring-1 hover:ring-gold-400 transition',
                        rdvColor(r),
                      )}
                      style={{ top, height }}
                      title={`${r.title} — ${dateTimeFr(r.date)}${isInvit ? ` · invitation de ${r.organizerName ?? r.organizerEmail ?? '?'}` : ''}`}
                    >
                      <div className="text-[10px] font-mono opacity-70 flex items-center gap-1">
                        {isInvit && <span title="Invitation reçue">📨</span>}
                        {String(start.getHours()).padStart(2, '0')}:{String(start.getMinutes()).padStart(2, '0')}
                      </div>
                      <div className="text-[11px] font-semibold truncate leading-tight">
                        {r.clientNom ?? r.title}
                      </div>
                      {height > 36 && r.clientNom && (
                        <div className="text-[10px] opacity-80 truncate">{r.title}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RdvModal({
  rdv,
  defaultDate,
  clients,
  onClose,
  onSave,
  onDelete,
  onRespond,
}: {
  rdv?: Rdv
  defaultDate?: string
  clients: any[]
  onClose: () => void
  onSave: (data: Omit<Rdv, 'id'>) => void
  onDelete: () => void
  onRespond?: (action: 'accept' | 'tentativelyAccept' | 'decline') => Promise<void>
}) {
  const isInvitation = rdv?.isOrganizer === false
  const responseLabel = (s: Rdv['responseStatus']) =>
    s === 'accepted' ? 'Acceptée' :
    s === 'declined' ? 'Refusée' :
    s === 'tentative' ? 'Provisoire' :
    s === 'notResponded' ? 'En attente' :
    s === 'organizer' ? 'Vous êtes l\'organisateur' :
    '—'
  const toLocalInput = (iso?: string) => {
    if (!iso) return defaultDate ?? ''
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [f, setF] = useState({
    title: rdv?.title ?? '',
    clientId: rdv?.clientId ?? '',
    type: (rdv?.type ?? 'R1') as Rdv['type'],
    date: toLocalInput(rdv?.date),
    duree: rdv?.duree ?? 45,
    lieu: (rdv?.lieu ?? 'Visio') as Rdv['lieu'],
    rappel: rdv?.rappel ?? '',
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.title.trim() || !f.date) {
      toast.error('Intitulé et date obligatoires')
      return
    }
    const client = clients.find((c) => c.id === f.clientId)
    onSave({
      title: f.title,
      clientId: f.clientId || undefined,
      clientNom: client ? `${client.nom} ${client.prenom}` : undefined,
      type: f.type,
      date: new Date(f.date).toISOString(),
      duree: f.duree,
      lieu: f.lieu,
      rappel: f.rappel || undefined,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        isInvitation ? 'Invitation Microsoft 365' :
        rdv ? 'Modifier le rendez-vous' :
        'Nouveau rendez-vous'
      }
      description={
        isInvitation
          ? 'Vous n\'êtes pas l\'organisateur — utilisez les boutons de réponse ci-dessous'
          : rdv
            ? rdv.id.startsWith('O365-')
              ? 'Importé depuis Microsoft 365 · synchronisé'
              : 'Modifier les informations ci-dessous'
            : 'Planifier un rendez-vous client'
      }
      size="md"
      actions={
        isInvitation ? (
          <button className="btn-outline" onClick={onClose}>Fermer</button>
        ) : (
          <>
            {rdv && (
              <button className="btn text-rose-700 hover:bg-rose-50 mr-auto" onClick={onDelete}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>
            )}
            <button className="btn-outline" onClick={onClose}>Annuler</button>
            <button className="btn-gold" onClick={submit}>
              {rdv ? <><Pencil className="h-4 w-4" /> Enregistrer</> : <><Plus className="h-4 w-4" /> Créer</>}
            </button>
          </>
        )
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {isInvitation && rdv && (
          <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3">
            <div className="flex items-center gap-2 text-xs text-indigo-700 font-semibold mb-2">
              <span>📨</span> Invitation reçue
            </div>
            <div className="text-xs text-navy-700 space-y-1">
              <div>De : <strong>{rdv.organizerName ?? rdv.organizerEmail ?? '—'}</strong></div>
              <div>Votre réponse : <strong>{responseLabel(rdv.responseStatus)}</strong></div>
              {rdv.attendees && rdv.attendees.length > 1 && (
                <div className="pt-1">
                  Participants ({rdv.attendees.length}) :
                  <ul className="mt-0.5 text-[11px] text-navy-600 list-disc list-inside">
                    {rdv.attendees.slice(0, 6).map((a, i) => (
                      <li key={i} className={a.status === 'declined' ? 'line-through opacity-60' : ''}>
                        {a.name ?? a.email} {a.status && a.status !== 'none' && a.status !== 'organizer' ? `· ${responseLabel(a.status)}` : ''}
                      </li>
                    ))}
                    {rdv.attendees.length > 6 && <li>+{rdv.attendees.length - 6} autres</li>}
                  </ul>
                </div>
              )}
              {rdv.bodyPreview && (
                <div className="pt-1 text-[11px] text-navy-500 italic line-clamp-3 whitespace-pre-line">
                  {rdv.bodyPreview}
                </div>
              )}
            </div>
            {onRespond && (
              <div className="flex items-center gap-2 mt-3">
                <button type="button" onClick={() => void onRespond('accept')} className="btn-outline text-xs px-3 py-1.5 text-emerald-700 hover:bg-emerald-50">
                  ✓ Accepter
                </button>
                <button type="button" onClick={() => void onRespond('tentativelyAccept')} className="btn-outline text-xs px-3 py-1.5 text-amber-700 hover:bg-amber-50">
                  ? Provisoire
                </button>
                <button type="button" onClick={() => void onRespond('decline')} className="btn-outline text-xs px-3 py-1.5 text-rose-700 hover:bg-rose-50">
                  ✗ Refuser
                </button>
              </div>
            )}
          </div>
        )}
        <div>
          <label className="label">Intitulé *</label>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="R1 qualification" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Type</label>
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Rdv['type'] })}>
              <option value="R0">R0 — Découverte</option>
              <option value="R1">R1 — Qualification</option>
              <option value="R2">R2 — Point dossier</option>
              <option value="Signature">Signature</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="label">Client (optionnel)</label>
            <select className="input" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}>
              <option value="">— Aucun client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="label">Date & heure *</label>
            <input type="datetime-local" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </div>
          <div>
            <label className="label">Durée (min)</label>
            <input type="number" className="input" value={f.duree} onChange={(e) => setF({ ...f, duree: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Lieu</label>
            <select className="input" value={f.lieu} onChange={(e) => setF({ ...f, lieu: e.target.value as Rdv['lieu'] })}>
              <option value="Visio">Visio</option>
              <option value="Bureau">Bureau</option>
              <option value="Chez le client">Chez le client</option>
            </select>
          </div>
          <div>
            <label className="label">Rappel (optionnel)</label>
            <input className="input" value={f.rappel} onChange={(e) => setF({ ...f, rappel: e.target.value })} placeholder="24h avant" />
          </div>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
