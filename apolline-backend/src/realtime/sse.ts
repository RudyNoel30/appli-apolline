/**
 * Endpoint SSE — diffuse les events `apolline_changes` reçus de PostgreSQL via LISTEN.
 *
 * Le bus est unique (un seul client PG en LISTEN), démultiplié vers N clients SSE via un
 * EventEmitter local. Économise des connexions PG et évite les fuites.
 */
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { EventEmitter } from 'node:events'
import { createListenClient } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import type { ChangeEvent } from './notify.js'

const bus = new EventEmitter()
bus.setMaxListeners(100)

const CHANNEL = 'apolline_changes'

let listenClient: ReturnType<typeof createListenClient> | null = null
let connectPromise: Promise<void> | null = null

async function ensureListener(): Promise<void> {
  if (connectPromise) return connectPromise
  connectPromise = (async () => {
    listenClient = createListenClient()
    listenClient.on('error', (err) => {
      console.error('[realtime] LISTEN client error', err)
    })
    listenClient.on('notification', (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return
      try {
        const event = JSON.parse(msg.payload) as ChangeEvent
        bus.emit('change', event)
      } catch (e) {
        console.warn('[realtime] payload illisible', msg.payload, e)
      }
    })
    await listenClient.connect()
    await listenClient.query(`LISTEN ${CHANNEL}`)
    console.log('[realtime] LISTEN', CHANNEL, 'actif')
  })()
  return connectPromise
}

export const sseRoute = new Hono()

sseRoute.get('/events', authMiddleware, async (c) => {
  await ensureListener()
  return streamSSE(c, async (stream) => {
    const onChange = (event: ChangeEvent) => {
      stream.writeSSE({ event: 'change', data: JSON.stringify(event) })
    }
    bus.on('change', onChange)

    // Heartbeat pour éviter que les proxies/timeouts coupent la connexion
    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: 'ping', data: String(Date.now()) }).catch(() => {})
    }, 25_000)

    // Initial connected event
    await stream.writeSSE({ event: 'connected', data: JSON.stringify({ ts: Date.now() }) })

    // Maintient le stream vivant tant que le client ne se déconnecte pas
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(heartbeat)
        bus.off('change', onChange)
        resolve()
      })
    })
  })
})
