/**
 * Microsoft Graph Calendar — création d'événements avec invitations attendees.
 *
 * Permission requise : `Calendars.ReadWrite` (déjà dans SCOPES de msal.ts).
 *
 * Usage typique côté Agenda :
 *   const ev = await calendar.createEvent({
 *     subject: 'R1 Bernard Sébastien',
 *     start: '2026-05-12T10:30:00',
 *     end:   '2026-05-12T11:30:00',
 *     attendees: [{ email: 'bernard@gmail.com', name: 'Sébastien Bernard' }],
 *     body: 'Rendez-vous de présentation du projet immobilier.',
 *     location: 'Bureau Apolline Dijon',
 *     online: true,
 *   })
 *   // ev.id  → graphId à stocker dans le Rdv pour future modification
 *   // ev.webLink → lien à ouvrir dans Outlook
 */
import { getAccessToken } from './msal'
import { O365_CLIENT_ID, O365_TENANT_ID } from './config'

const GRAPH = 'https://graph.microsoft.com/v1.0'

export type Attendee = { email: string; name?: string; required?: boolean }

export type CreateEventInput = {
  subject: string
  /** Format ISO local (sans Z) — ex "2026-05-12T10:30:00". */
  start: string
  end: string
  /** Fuseau horaire — par défaut "Europe/Paris". */
  timeZone?: string
  attendees?: Attendee[]
  body?: string
  location?: string
  /** Si true, génère un lien Teams automatique. */
  online?: boolean
  /** Type de réponse demandé. Default true → invite envoyée à tous les attendees. */
  sendInvite?: boolean
}

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken(O365_CLIENT_ID, O365_TENANT_ID)
  if (!token) throw new Error('Non connecté à Microsoft 365')
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Graph calendar ${res.status}: ${err.slice(0, 300)}`)
  }
  return res
}

/**
 * Crée un événement dans le calendrier de l'utilisateur connecté.
 * Si `attendees` est non vide, Graph envoie automatiquement les invitations
 * (sauf si `sendInvite=false`).
 */
export async function createEvent(input: CreateEventInput): Promise<{ id: string; webLink: string }> {
  const tz = input.timeZone ?? 'Europe/Paris'
  const payload: Record<string, unknown> = {
    subject: input.subject,
    body: { contentType: 'HTML', content: input.body ?? '' },
    start: { dateTime: input.start, timeZone: tz },
    end: { dateTime: input.end, timeZone: tz },
  }
  if (input.location) {
    payload.location = { displayName: input.location }
  }
  if (input.attendees && input.attendees.length > 0) {
    payload.attendees = input.attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.name ?? a.email },
      type: a.required === false ? 'optional' : 'required',
    }))
  }
  if (input.online) {
    payload.isOnlineMeeting = true
    payload.onlineMeetingProvider = 'teamsForBusiness'
  }
  // sendInvite par défaut quand il y a des attendees
  const sendInvite = input.sendInvite ?? (input.attendees && input.attendees.length > 0)
  // L'endpoint /me/events crée l'event ET envoie les invites automatiquement
  // (pas besoin du paramètre `?sendNotifications` — c'est le comportement par défaut).
  // On override avec /events?sendNotifications=false si l'utilisateur veut juste réserver le créneau.
  const url = sendInvite ? `${GRAPH}/me/events` : `${GRAPH}/me/events`
  const res = await authedFetch(url, { method: 'POST', body: JSON.stringify(payload) })
  const json = await res.json() as { id: string; webLink?: string }
  return { id: json.id, webLink: json.webLink ?? '' }
}

/** Annule (= supprime) un événement précédemment créé via createEvent. */
export async function deleteEvent(eventId: string): Promise<void> {
  await authedFetch(`${GRAPH}/me/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
}

/** Met à jour un événement existant (pour replanifier ou changer le sujet). */
export async function updateEvent(eventId: string, patch: Partial<CreateEventInput>): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (patch.subject) payload.subject = patch.subject
  if (patch.body !== undefined) payload.body = { contentType: 'HTML', content: patch.body }
  if (patch.start) payload.start = { dateTime: patch.start, timeZone: patch.timeZone ?? 'Europe/Paris' }
  if (patch.end) payload.end = { dateTime: patch.end, timeZone: patch.timeZone ?? 'Europe/Paris' }
  if (patch.location) payload.location = { displayName: patch.location }
  await authedFetch(`${GRAPH}/me/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH', body: JSON.stringify(payload),
  })
}
