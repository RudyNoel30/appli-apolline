import { Client, Stronghold } from '@tauri-apps/plugin-stronghold'
import { appLocalDataDir, join } from '@tauri-apps/api/path'

const VAULT_BASENAME = 'msal-vault'
const LEGACY_VAULT_FILE = 'msal-vault.stronghold'
const VAULT_PASSPHRASE = 'apolline-msal-v1-29f3b1c0'
const CLIENT_NAME = 'apolline-msal'
const STORE_KEY = 'localStorage-snapshot'

// MSAL.js v5 chiffre le contenu du localStorage avec une clé stockée dans
// ce cookie. Par défaut MSAL le crée en cookie de session (perdu à la fermeture
// de WebView2) → au reload, le cache est purgé. On le persiste donc nous-même.
const ENCRYPTION_COOKIE = 'msal.cache.encryption'
const COOKIE_LIFE_DAYS = 30

// Le vault est scopé par utilisateur Apolline : chaque collaborateur a son
// propre fichier `msal-vault-<userId>.stronghold` → permet à plusieurs collabs
// sur le même poste de connecter chacun leur propre compte Microsoft sans
// interférence. `bindUser(userId)` est appelé depuis AuthContext au login.
let currentUserId: string | null = null
let stronghold: Stronghold | null = null
let client: Client | null = null
let available: boolean | null = null

function vaultFileFor(userId: string | null): string {
  return userId ? `${VAULT_BASENAME}-${userId}.stronghold` : LEGACY_VAULT_FILE
}

/**
 * Lie le module Stronghold à un utilisateur Apolline.
 * Reset le client en mémoire pour forcer un nouveau load avec le bon vault.
 * Doit être appelé au login/logout/switchUser.
 */
export function bindStrongholdUser(userId: string | null): void {
  if (userId === currentUserId) return
  console.log('[stronghold] bind user', currentUserId, '→', userId)
  stronghold = null
  client = null
  available = null
  currentUserId = userId
}

function isAppKey(k: string): boolean {
  return k === 'apolline-store' || k.startsWith('apolline.')
}

function listMsalKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || isAppKey(k)) continue
    keys.push(k)
  }
  return keys
}

function readCookie(name: string): string | null {
  const all = document.cookie.split('; ')
  for (const c of all) {
    const eq = c.indexOf('=')
    if (eq < 0) continue
    if (c.slice(0, eq) === name) {
      return decodeURIComponent(c.slice(eq + 1))
    }
  }
  return null
}

function writePersistentCookie(name: string, value: string): void {
  const expires = new Date(Date.now() + COOKIE_LIFE_DAYS * 86400_000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; secure; samesite=none`
}

type Snapshot = {
  v: 2
  localStorage: Record<string, string>
  cookies: Record<string, string>
}

async function getClient(): Promise<Client | null> {
  if (client) return client
  if (available === false) return null

  try {
    const dir = await appLocalDataDir()
    const path = await join(dir, vaultFileFor(currentUserId))
    console.log('[stronghold] loading vault for user', currentUserId, 'from', path)
    stronghold = await Stronghold.load(path, VAULT_PASSPHRASE)
    try {
      client = await stronghold.loadClient(CLIENT_NAME)
      console.log('[stronghold] loaded existing client')
    } catch (loadErr) {
      console.log('[stronghold] loadClient failed, creating new client', loadErr)
      client = await stronghold.createClient(CLIENT_NAME)
      await stronghold.save()
      console.log('[stronghold] new client created and saved')
    }
    available = true
    return client
  } catch (e) {
    available = false
    console.warn('[stronghold] unavailable', e)
    return null
  }
}

export async function restoreMsalCache(): Promise<void> {
  const before = listMsalKeys()
  console.log('[stronghold] restore start — localStorage has', before.length, 'non-app keys before')

  const c = await getClient()
  if (!c) {
    console.warn('[stronghold] restore skipped — client unavailable')
    return
  }

  let raw: Uint8Array | null = null
  try {
    raw = await c.getStore().get(STORE_KEY)
  } catch (e) {
    console.warn('[stronghold] restore — store.get threw', e)
    return
  }

  if (!raw || raw.length === 0) {
    console.log('[stronghold] restore — no snapshot in store')
    return
  }

  console.log('[stronghold] restore — got', raw.length, 'bytes from store')

  try {
    const json = new TextDecoder().decode(new Uint8Array(raw))
    const parsed = JSON.parse(json) as Snapshot | Record<string, string>

    // v1 : flat record. v2 : { v, localStorage, cookies }
    const localStore: Record<string, string> =
      'v' in parsed && parsed.v === 2 ? (parsed as Snapshot).localStorage : (parsed as Record<string, string>)
    const cookies: Record<string, string> =
      'v' in parsed && parsed.v === 2 ? (parsed as Snapshot).cookies : {}

    // 1) Restaurer le cookie d'encryption AVANT le localStorage. MSAL.js le lit
    //    pendant pca.initialize() pour déchiffrer les entries.
    let cookiesWritten = 0
    for (const [name, value] of Object.entries(cookies)) {
      writePersistentCookie(name, value)
      cookiesWritten++
    }

    // 2) Restaurer les clés localStorage
    let lsWritten = 0
    for (const [k, v] of Object.entries(localStore)) {
      localStorage.setItem(k, v)
      lsWritten++
    }

    console.log('[stronghold] restore — wrote', lsWritten, 'localStorage keys +', cookiesWritten, 'cookies')
  } catch (e) {
    console.warn('[stronghold] snapshot corrompu, ignoré', e)
  }
}

export async function persistMsalCache(): Promise<void> {
  const c = await getClient()
  if (!c) return

  const snapshot: Snapshot = {
    v: 2,
    localStorage: {},
    cookies: {},
  }

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || isAppKey(k)) continue
    snapshot.localStorage[k] = localStorage.getItem(k) ?? ''
  }

  const enc = readCookie(ENCRYPTION_COOKIE)
  if (enc) snapshot.cookies[ENCRYPTION_COOKIE] = enc

  const lsCount = Object.keys(snapshot.localStorage).length
  const cookieCount = Object.keys(snapshot.cookies).length
  if (lsCount === 0 && cookieCount === 0) {
    console.log('[stronghold] persist — nothing to save, skipping')
    return
  }

  try {
    const json = JSON.stringify(snapshot)
    const bytes = Array.from(new TextEncoder().encode(json))
    await c.getStore().insert(STORE_KEY, bytes)
    await stronghold!.save()
    console.log('[stronghold] persisted', lsCount, 'localStorage keys +', cookieCount, 'cookies (', bytes.length, 'bytes)')
  } catch (e) {
    console.warn('[stronghold] persist failed', e)
  }
}

export async function clearMsalCache(): Promise<void> {
  const c = await getClient()
  if (!c) return
  try {
    await c.getStore().remove(STORE_KEY)
    await stronghold!.save()
    // Efface aussi le cookie d'encryption pour partir propre
    document.cookie = `${ENCRYPTION_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    console.log('[stronghold] cleared')
  } catch (e) {
    console.warn('[stronghold] clear failed', e)
  }
}
