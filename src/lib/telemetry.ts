/**
 * Télémétrie / report d'erreurs léger (sans dépendance Sentry).
 *
 * Capture les erreurs JS non-handled + les rejets de promesses, et les envoie
 * au backend Apolline via POST /api/telemetry. Le backend les loggue dans
 * audit_log (action="js_error") pour qu'on puisse les consulter dans
 * Paramètres → Audit.
 *
 * Si tu veux Sentry plus tard : remplace `sendToBackend()` par
 * `Sentry.captureException()` après `Sentry.init({dsn: ...})`.
 *
 * Init dans App.tsx au boot :
 *    import { initTelemetry } from '@/lib/telemetry'
 *    initTelemetry({ release: __APP_VERSION__, userId: currentUser?.id })
 */

import { getToken } from '@/db/api'

let initialized = false
let context: { release?: string; userId?: string; userEmail?: string } = {}

const RING_BUFFER: Array<{ ts: number; type: string; msg: string }> = []
const RING_MAX = 50
function pushBreadcrumb(type: string, msg: string) {
  RING_BUFFER.push({ ts: Date.now(), type, msg: msg.slice(0, 500) })
  if (RING_BUFFER.length > RING_MAX) RING_BUFFER.shift()
}

async function sendToBackend(payload: Record<string, unknown>): Promise<void> {
  const base = (import.meta.env.VITE_API_BASE as string | undefined) || 'https://appli.apolline.groupe-apolline.eu'
  const token = getToken()
  if (!token) return // Pas connecté → on ne pollue pas le serveur (la prod n'est interrogeable que par un user authentifié)
  try {
    await fetch(`${base}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, breadcrumbs: RING_BUFFER.slice(-20) }),
      keepalive: true,
    })
  } catch { /* swallow — la télémétrie ne doit JAMAIS bloquer ou impacter l'UX */ }
}

export function initTelemetry(opts: { release?: string; userId?: string; userEmail?: string } = {}): void {
  if (initialized) return
  initialized = true
  context = { ...context, ...opts }

  // 1. Erreurs JS non-handled
  window.addEventListener('error', (e) => {
    pushBreadcrumb('error', e.message)
    void sendToBackend({
      kind: 'window.error',
      message: e.message,
      filename: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error?.stack,
      context,
      url: window.location.pathname,
    })
  })

  // 2. Rejets de promesses non capturés
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    pushBreadcrumb('rejection', msg)
    void sendToBackend({
      kind: 'unhandledrejection',
      message: msg,
      stack: e.reason?.stack,
      context,
      url: window.location.pathname,
    })
  })

  // 3. Hook ErrorBoundary : on expose une fonction globale que le boundary appelle
  ;(window as unknown as { __sentryCaptureException?: (e: Error, ctx: unknown) => void }).__sentryCaptureException = (error, ctx) => {
    pushBreadcrumb('boundary', error.message)
    void sendToBackend({
      kind: 'react.boundary',
      message: error.message,
      stack: error.stack,
      context: { ...context, ...(ctx as Record<string, unknown>) },
      url: window.location.pathname,
    })
  }

  console.info('[telemetry] initialisée', context)
}

/** Met à jour le contexte (typiquement au login). */
export function setTelemetryUser(userId?: string, userEmail?: string): void {
  context = { ...context, userId, userEmail }
}

/** Trace une étape utilisateur (utile pour reproduire un bug). */
export function trackBreadcrumb(category: string, message: string): void {
  pushBreadcrumb(category, message)
}
