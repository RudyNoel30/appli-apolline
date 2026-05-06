import { PublicClientApplication, EventType, type Configuration, type AccountInfo, type AuthenticationResult, type EventMessage } from '@azure/msal-browser'
import { restoreMsalCache, persistMsalCache, clearMsalCache, bindStrongholdUser } from './stronghold'

const SCOPES = [
  'User.Read',
  'Calendars.Read',
  'Calendars.ReadWrite',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Contacts.Read',
  // Files.Read.All > Files.Read : nécessaire pour accéder aux fichiers dans
  // les dossiers PARTAGÉS (autres OneDrive, bibliothèques SharePoint), pas
  // seulement le drive personnel.
  'Files.Read.All',
]

let pca: PublicClientApplication | null = null
let currentClientId: string | null = null
let boundApollineUserId: string | null = null

const ENCRYPTION_COOKIE = 'msal.cache.encryption'

function isAppKey(k: string): boolean {
  return k === 'apolline-store' || k.startsWith('apolline.')
}

function clearAllMsalLocalStorage(): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || isAppKey(k)) continue
    toRemove.push(k)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
  // Efface aussi le cookie d'encryption pour repartir propre lors du restore
  document.cookie = `${ENCRYPTION_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

/**
 * Lie le module MSAL à un utilisateur Apolline.
 *
 * - Au PREMIER bind d'une session (reload, ouverture d'app), on ne touche PAS
 *   au cache localStorage : il contient soit le state MSAL persisté par la
 *   session précédente (à laisser intact pour que MSAL le retrouve), soit le
 *   PKCE verifier déposé juste avant un redirect Microsoft (à NE PAS détruire,
 *   sinon `handleRedirectPromise()` ne peut pas valider le retour).
 *
 * - Au CHANGEMENT d'un user à un autre (switch user), on persiste l'ancien
 *   dans son vault Stronghold, on vide localStorage MSAL + cookie d'encryption,
 *   on bind Stronghold sur le nouveau user, et on reset le PCA.
 */
export async function bindApollineUser(userId: string | null): Promise<void> {
  if (userId === boundApollineUserId) return
  console.log('[MSAL] bindApollineUser', boundApollineUserId, '→', userId)

  // Premier bind de la session : on bind juste le tracking, sans wipe.
  // Le cache MSAL en localStorage est préservé (utile pour reprise de session
  // ET pour ne pas casser un retour de redirect Microsoft en cours).
  if (boundApollineUserId === null) {
    bindStrongholdUser(userId)
    boundApollineUserId = userId
    return
  }

  // Vrai switch user : persist + wipe + bind nouveau
  if (pca) {
    try { await persistMsalCache() } catch (e) { console.warn('[MSAL] persist on bind failed', e) }
  }
  clearAllMsalLocalStorage()
  bindStrongholdUser(userId)
  pca = null
  currentClientId = null
  boundApollineUserId = userId
}

export async function getMsal(clientId: string, tenantId: string = 'common'): Promise<PublicClientApplication | null> {
  if (!clientId) return null
  if (pca && currentClientId === clientId) return pca

  // Restaure le cache MSAL depuis Stronghold AVANT d'initialiser MSAL.
  // Couvre les clés localStorage (account, tokens) + le cookie msal.cache.encryption
  // qui contient la clé de déchiffrement du cache. Sans ce cookie, MSAL.js v5
  // purge tout le cache au démarrage car il ne peut pas valider l'intégrité.
  await restoreMsalCache()

  const config: Configuration = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: window.location.origin,
      postLogoutRedirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: 'localStorage',
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message) => {
          if (level <= 1) console.log(`[MSAL ${level === 0 ? 'ERR' : 'WARN'}]`, message.slice(0, 300))
        },
        piiLoggingEnabled: false,
        logLevel: 1,
      },
    },
  }
  pca = new PublicClientApplication(config)
  await pca.initialize()
  currentClientId = clientId

  pca.addEventCallback((evt: EventMessage) => {
    if (evt.error) {
      // Logging enrichi : code, message, scopes attendus
      const err = evt.error as { errorCode?: string; errorMessage?: string; message?: string; subError?: string }
      console.error('[MSAL]', evt.eventType, {
        code: err.errorCode ?? 'no_code',
        sub: err.subError,
        message: (err.errorMessage ?? err.message ?? '').slice(0, 300),
      })
      return
    }
    // Persiste le cache MSAL dans Stronghold après chaque succès auth.
    // Élargi à tous les events qui peuvent générer un nouveau token / refresh.
    // ACQUIRE_TOKEN_SUCCESS couvre déjà ssoSilent et acquireTokenSilent
    // dans MSAL.js v5, donc pas besoin d'event dédié pour ssoSilent.
    if (
      evt.eventType === EventType.LOGIN_SUCCESS ||
      evt.eventType === EventType.ACQUIRE_TOKEN_SUCCESS ||
      evt.eventType === EventType.HANDLE_REDIRECT_END
    ) {
      void persistMsalCache()
    }
  })

  return pca
}

/**
 * À appeler au démarrage de l'app pour traiter le retour d'une redirection Microsoft.
 * Retourne le compte connecté si une redirection vient de se compléter, sinon null.
 */
export async function handleRedirectResult(
  clientId: string,
  tenantId: string,
): Promise<AuthenticationResult | null> {
  if (!clientId) return null
  const msal = await getMsal(clientId, tenantId)
  if (!msal) return null

  return msal.handleRedirectPromise()
}

/**
 * Lance la connexion via redirect (popup bloquée dans Tauri).
 * La fonction NE RETOURNE PAS — l'app est redirigée vers login.microsoftonline.com,
 * puis revient sur redirectUri où handleRedirectResult() doit être appelé.
 */
export async function signIn(clientId: string, tenantId: string): Promise<void> {
  const msal = await getMsal(clientId, tenantId)
  if (!msal) throw new Error('MSAL non initialisé — Client ID manquant')

  // Marque qu'on attend un retour de redirect (pour la toast de succès)
  sessionStorage.setItem('apolline.o365_redirect_pending', '1')

  await msal.loginRedirect({
    scopes: SCOPES,
    prompt: 'select_account',
  })
  // Le code après cette ligne ne s'exécute pas — navigation vers Microsoft.
}

export async function signOut(clientId: string, tenantId: string): Promise<void> {
  const msal = await getMsal(clientId, tenantId)
  if (!msal) return
  const accounts = msal.getAllAccounts()
  if (accounts.length > 0) {
    // logoutPopup fonctionne mieux que logoutRedirect en dev (ne recharge pas l'app inutilement)
    try {
      await msal.logoutPopup({ account: accounts[0] })
    } catch {
      // Fallback : clear cache local seulement
      await msal.clearCache()
    }
  }
  await clearMsalCache()
}

/**
 * Récupère un token. Tente d'abord `acquireTokenSilent` (cache local MSAL),
 * puis fallback sur `ssoSilent` qui utilise le cookie de session Microsoft
 * (sur login.microsoftonline.com) pour récupérer un nouveau token sans
 * interaction si l'utilisateur est encore loggé côté Microsoft.
 *
 * Ce fallback résout le cas typique "ça saute d'un jour à l'autre" :
 *  - acquireTokenSilent échoue car le cache local a expiré pendant la nuit
 *  - ssoSilent récupère un nouveau token automatiquement car la session
 *    Microsoft (cookie .microsoft.com) est encore valide pendant ~24h-90j
 *
 * En cas de double échec, retourne null → l'appelant doit demander
 * une reconnexion explicite via signIn.
 */
export async function getAccessToken(clientId: string, tenantId: string): Promise<string | null> {
  const msal = await getMsal(clientId, tenantId)
  if (!msal) return null
  const accounts = msal.getAllAccounts()
  if (accounts.length === 0) return null
  const account = accounts[0]!

  // Tentative 1 : cache local MSAL
  try {
    const res = await msal.acquireTokenSilent({ scopes: SCOPES, account })
    return res.accessToken
  } catch (e: unknown) {
    const errorCode = (e as { errorCode?: string })?.errorCode ?? 'unknown'
    console.warn('[MSAL] acquireTokenSilent failed, trying ssoSilent fallback…', errorCode)

    // Tentative 2 : ssoSilent (utilise le cookie de session Microsoft)
    try {
      const res = await msal.ssoSilent({
        scopes: SCOPES,
        loginHint: account.username,
      })
      // ssoSilent peut renvoyer un account différent — on persiste le cache
      void persistMsalCache()
      console.log('[MSAL] ssoSilent recovery successful')
      return res.accessToken
    } catch (e2: unknown) {
      const errorCode2 = (e2 as { errorCode?: string })?.errorCode ?? 'unknown'
      console.warn('[MSAL] ssoSilent also failed, user must reconnect manually', errorCode2)
      return null
    }
  }
}

/**
 * Tente une reconnexion silencieuse au démarrage de l'app. À appeler une fois
 * après initialisation. Si le silent échoue ET que ssoSilent échoue, déclenche
 * `onReconnectRequired` pour qu'on puisse prévenir l'utilisateur.
 *
 * Retourne true si la session est OK (silent ou sso a réussi), false sinon.
 */
export async function refreshTokenIfNeeded(clientId: string, tenantId: string): Promise<boolean> {
  const token = await getAccessToken(clientId, tenantId)
  return token !== null
}

export async function getCurrentAccount(clientId: string, tenantId: string): Promise<AccountInfo | null> {
  const msal = await getMsal(clientId, tenantId)
  if (!msal) return null
  const accounts = msal.getAllAccounts()
  return accounts[0] ?? null
}

export async function getAllAccounts(clientId: string, tenantId: string): Promise<AccountInfo[]> {
  const msal = await getMsal(clientId, tenantId)
  if (!msal) return []
  return msal.getAllAccounts()
}

/**
 * Debug : récupère toutes les clés MSAL en localStorage pour diagnostic.
 */
export function debugSnapshot(): Record<string, string> {
  const snap: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!
    if (k.startsWith('msal.') || k.includes('login.microsoftonline') || k.includes('authority')) {
      snap[k] = localStorage.getItem(k)!
    }
  }
  snap['__window_location_hash'] = window.location.hash
  snap['__window_location_href'] = window.location.href
  return snap
}

type GraphResponseStatus = 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded'

export type GraphEvent = {
  id: string
  subject: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  location?: { displayName?: string }
  bodyPreview?: string
  isOnlineMeeting?: boolean
  isOrganizer?: boolean
  responseRequested?: boolean
  responseStatus?: { response: GraphResponseStatus; time?: string }
  organizer?: { emailAddress?: { name?: string; address?: string } }
  attendees?: {
    type?: 'required' | 'optional' | 'resource'
    status?: { response: GraphResponseStatus; time?: string }
    emailAddress: { name?: string; address?: string }
  }[]
}

export async function fetchCalendarEvents(
  clientId: string,
  tenantId: string,
  startIso: string,
  endIso: string,
): Promise<GraphEvent[]> {
  const token = await getAccessToken(clientId, tenantId)
  if (!token) throw new Error('Non connecté à O365 — reconnectez-vous depuis Paramètres → Intégrations')

  // calendarView retourne les occurrences de récurrences dépliées dans la fenêtre.
  // $top=999 = max Graph par page ; on suit @odata.nextLink jusqu'à épuisement.
  // $select garantit qu'on récupère bien organizer/responseStatus/attendees pour gérer les invitations.
  const select = [
    'id', 'subject', 'bodyPreview', 'start', 'end', 'location',
    'isOnlineMeeting', 'isOrganizer', 'responseRequested', 'responseStatus',
    'organizer', 'attendees',
  ].join(',')
  const events: GraphEvent[] = []
  let nextUrl: string | undefined =
    `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(startIso)}&endDateTime=${encodeURIComponent(endIso)}&$orderby=start/dateTime&$top=999&$select=${select}`

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="Europe/Paris"',
      },
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Graph API ${res.status}: ${err.slice(0, 200)}`)
    }
    const json = (await res.json()) as { value: GraphEvent[]; '@odata.nextLink'?: string }
    events.push(...json.value)
    nextUrl = json['@odata.nextLink']
  }
  return events
}

export type CalendarEventInput = {
  subject: string
  start: string
  end: string
  location?: string
  body?: string
  attendees?: string[]
  isOnlineMeeting?: boolean
}

function buildEventPayload(event: Partial<CalendarEventInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (event.subject !== undefined) payload.subject = event.subject
  if (event.body !== undefined) payload.body = { contentType: 'text', content: event.body }
  if (event.start !== undefined) payload.start = { dateTime: event.start, timeZone: 'Europe/Paris' }
  if (event.end !== undefined) payload.end = { dateTime: event.end, timeZone: 'Europe/Paris' }
  if (event.location !== undefined) payload.location = event.location ? { displayName: event.location } : { displayName: '' }
  if (event.attendees !== undefined) {
    payload.attendees = event.attendees.map((a) => ({ emailAddress: { address: a }, type: 'required' }))
  }
  if (event.isOnlineMeeting !== undefined) {
    payload.isOnlineMeeting = event.isOnlineMeeting
    if (event.isOnlineMeeting) {
      payload.onlineMeetingProvider = 'teamsForBusiness'
    }
  }
  return payload
}

export async function createCalendarEvent(
  clientId: string,
  tenantId: string,
  event: CalendarEventInput,
): Promise<GraphEvent> {
  const token = await getAccessToken(clientId, tenantId)
  if (!token) throw new Error('Non connecté à O365')

  const payload = buildEventPayload(event)

  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Graph create event ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

/** Met à jour un événement existant via PATCH partiel. */
export async function updateCalendarEvent(
  clientId: string,
  tenantId: string,
  eventId: string,
  patch: Partial<CalendarEventInput>,
): Promise<GraphEvent> {
  const token = await getAccessToken(clientId, tenantId)
  if (!token) throw new Error('Non connecté à O365')

  const payload = buildEventPayload(patch)

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Graph update event ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

/** Supprime un événement Outlook (déplacé dans la corbeille du calendrier). */
export async function deleteCalendarEvent(
  clientId: string,
  tenantId: string,
  eventId: string,
): Promise<void> {
  const token = await getAccessToken(clientId, tenantId)
  if (!token) throw new Error('Non connecté à O365')

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  // 204 No Content = succès
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '')
    throw new Error(`Graph delete event ${res.status}: ${text.slice(0, 200)}`)
  }
}

function graphResponseToRdv(s?: GraphResponseStatus): import('@/data/mock').RdvResponseStatus {
  if (!s) return 'none'
  if (s === 'tentativelyAccepted') return 'tentative'
  return s
}

export function graphToRdv(g: GraphEvent): import('@/data/mock').Rdv {
  const lieuRaw = g.location?.displayName?.toLowerCase() ?? ''
  const lieu: 'Visio' | 'Bureau' | 'Chez le client' =
    g.isOnlineMeeting || lieuRaw.includes('teams') || lieuRaw.includes('visio') || lieuRaw.includes('meet')
      ? 'Visio'
      : lieuRaw.includes('bureau') || lieuRaw.includes('cabinet')
        ? 'Bureau'
        : lieuRaw
          ? 'Chez le client'
          : 'Visio'

  const subjectLower = g.subject.toLowerCase()
  const type: import('@/data/mock').Rdv['type'] =
    subjectLower.includes('r0') || subjectLower.includes('découverte') ? 'R0' :
    subjectLower.includes('r1') || subjectLower.includes('qualification') ? 'R1' :
    subjectLower.includes('r2') || subjectLower.includes('point') ? 'R2' :
    subjectLower.includes('signature') || subjectLower.includes('notaire') ? 'Signature' :
    'Autre'

  const start = new Date(g.start.dateTime + (g.start.timeZone === 'UTC' ? 'Z' : ''))
  const end = new Date(g.end.dateTime + (g.end.timeZone === 'UTC' ? 'Z' : ''))
  const duree = Math.round((end.getTime() - start.getTime()) / 60000)

  // Pour le clientNom on préfère un participant qui n'est ni l'organizer ni l'utilisateur
  // (ie. l'invité externe, qui est presque toujours le client). Fallback sur le 1er attendee.
  const organizerEmail = g.organizer?.emailAddress?.address?.toLowerCase()
  const externalAttendee = g.attendees?.find((a) => {
    const addr = a.emailAddress.address?.toLowerCase()
    return addr && addr !== organizerEmail
  })
  const clientNom = externalAttendee?.emailAddress.name ?? g.attendees?.[0]?.emailAddress?.name

  return {
    id: `O365-${g.id}`,
    graphId: g.id,
    title: g.subject || '(Sans titre)',
    type,
    date: start.toISOString(),
    duree,
    lieu,
    rappel: undefined,
    clientNom,
    organizerEmail: g.organizer?.emailAddress?.address,
    organizerName: g.organizer?.emailAddress?.name,
    isOrganizer: g.isOrganizer ?? (g.responseStatus?.response === 'organizer'),
    responseStatus: graphResponseToRdv(g.responseStatus?.response),
    attendees: g.attendees?.map((a) => ({
      email: a.emailAddress.address,
      name: a.emailAddress.name,
      status: graphResponseToRdv(a.status?.response),
      isRequired: a.type === 'required',
    })),
    bodyPreview: g.bodyPreview,
  }
}

/**
 * Répond à une invitation Outlook (accept / tentativelyAccept / decline).
 * Endpoint Graph : POST /me/events/{id}/{action}
 */
export async function respondToEvent(
  clientId: string,
  tenantId: string,
  eventId: string,
  action: 'accept' | 'tentativelyAccept' | 'decline',
  options?: { comment?: string; sendResponse?: boolean },
): Promise<void> {
  const token = await getAccessToken(clientId, tenantId)
  if (!token) throw new Error('Non connecté à O365')

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}/${action}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      comment: options?.comment ?? '',
      sendResponse: options?.sendResponse ?? true,
    }),
  })
  if (!res.ok && res.status !== 202) {
    const text = await res.text().catch(() => '')
    throw new Error(`Graph respond ${res.status}: ${text.slice(0, 200)}`)
  }
}

/**
 * Mappe un Rdv Apolline → payload Graph CalendarEventInput.
 * Convertit lieu et type en métadonnées Outlook utiles.
 */
export function rdvToGraphInput(rdv: import('@/data/mock').Rdv): CalendarEventInput {
  const startIso = new Date(rdv.date).toISOString().slice(0, 19) // local format sans Z (timeZone Europe/Paris)
  const endDate = new Date(new Date(rdv.date).getTime() + rdv.duree * 60_000)
  const endIso = endDate.toISOString().slice(0, 19)
  const subject = rdv.type !== 'Autre' ? `${rdv.type} — ${rdv.title}` : rdv.title

  let location: string | undefined
  let isOnline = false
  if (rdv.lieu === 'Visio') {
    location = 'Visio (Teams)'
    isOnline = true
  } else if (rdv.lieu === 'Bureau') {
    location = 'Bureau Apolline'
  } else if (rdv.lieu === 'Chez le client') {
    location = `Chez ${rdv.clientNom ?? 'le client'}`
  }

  return {
    subject,
    start: startIso,
    end: endIso,
    location,
    isOnlineMeeting: isOnline,
    body: rdv.clientNom ? `Rendez-vous avec ${rdv.clientNom}\nGénéré depuis Extr'Apol.` : "Rendez-vous généré depuis Extr'Apol.",
  }
}
