import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useStore } from '@/stores/useStore'
import type { Collaborateur } from '@/data/mock'
import { auth, sync, ApiError } from '@/db/api'
import { bindApollineUser } from '@/o365/msal'
import { buildCan, type Permission, type Role } from './permissions'

type LoginResult = { ok: boolean; error?: string; mode?: 'online' | 'offline' }

type AuthContextValue = {
  currentUser: Collaborateur | null
  /** Mode actuel d'authentification : 'online' = backend, 'offline' = seed local */
  authMode: 'online' | 'offline' | null
  login: (email: string, motDePasse: string) => Promise<LoginResult>
  logout: () => void
  switchUser: () => void
  collaborateurs: Collaborateur[]
}

const AuthContext = createContext<AuthContextValue | null>(null)
const STORAGE_KEY = 'apolline.currentUserId'
const STORAGE_MODE = 'apolline.authMode'

export function AuthProvider({ children }: { children: ReactNode }) {
  const collaborateurs = useStore((s) => s.collaborateurs)
  const markLogin = useStore((s) => s.markLogin)

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
  })
  const [authMode, setAuthMode] = useState<'online' | 'offline' | null>(() => {
    try { return (localStorage.getItem(STORAGE_MODE) as 'online' | 'offline' | null) } catch { return null }
  })

  const currentUser = currentUserId
    ? collaborateurs.find((c) => c.id === currentUserId) ?? null
    : null

  // Re-bind MSAL/Stronghold sur l'utilisateur Apolline courant. Effectif au mount
  // (reprise de session) et à chaque login/logout/switch.
  useEffect(() => {
    void bindApollineUser(currentUserId)
  }, [currentUserId])

  const login = async (email: string, motDePasse: string): Promise<LoginResult> => {
    const normalized = email.trim().toLowerCase()

    // STRATÉGIE : Online OBLIGATOIRE pour l'écriture en BDD partagée.
    // Le mode offline silencieux a causé des dossiers fantômes (créés en
    // local sans push backend). On REFUSE désormais le login si le backend
    // n'est pas joignable ou rejette le mot de passe.
    try {
      const res = await auth.login(normalized, motDePasse)
      const userId = String((res.user as { id: string }).id)
      localStorage.setItem(STORAGE_KEY, userId)
      localStorage.setItem(STORAGE_MODE, 'online')
      setCurrentUserId(userId)
      setAuthMode('online')
      markLogin(userId)
      try {
        await sync.pullAll()
        sync.start()
      } catch (e) {
        console.warn('[auth] sync init failed', e)
      }
      return { ok: true, mode: 'online' }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          return { ok: false, error: 'Identifiant ou mot de passe incorrect' }
        }
        return { ok: false, error: `Erreur serveur (${e.status}). Réessayez ou contactez l'administrateur.` }
      }
      // Network / DNS / timeout : on AUTORISE le mode offline UNIQUEMENT si
      // l'utilisateur a déjà un token valide (= il s'était déjà connecté online).
      // Sinon on refuse — sans backend, pas d'écriture en BDD = pas de partage
      // entre collabs = données fantômes.
      const hadPreviousToken = !!localStorage.getItem('apolline.auth_token')
      if (!hadPreviousToken) {
        return {
          ok: false,
          error: 'Backend injoignable. Vérifiez votre connexion Internet — le mode hors-ligne nécessite une 1ère connexion en ligne.',
        }
      }
      // Reprise de session offline (cache local d'une session online précédente)
      const user = collaborateurs.find((c) => c.email.toLowerCase() === normalized)
      if (!user) return { ok: false, error: 'Identifiant inconnu' }
      if (!user.actif) return { ok: false, error: 'Compte désactivé' }
      if (user.motDePasse && user.motDePasse !== motDePasse) {
        return { ok: false, error: 'Mot de passe incorrect' }
      }
      localStorage.setItem(STORAGE_KEY, user.id)
      localStorage.setItem(STORAGE_MODE, 'offline')
      setCurrentUserId(user.id)
      setAuthMode('offline')
      markLogin(user.id)
      console.warn('[auth] backend unreachable, fallback offline temporaire')
      return { ok: true, mode: 'offline' }
    }
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_MODE)
    auth.logout()
    sync.stop()
    setCurrentUserId(null)
    setAuthMode(null)
  }

  const switchUser = () => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_MODE)
    auth.logout()
    sync.stop()
    setCurrentUserId(null)
    setAuthMode(null)
  }

  return (
    <AuthContext.Provider value={{ currentUser, authMode, login, logout, switchUser, collaborateurs }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/**
 * Hook permissions : `const { can, isAdmin } = usePermissions()` puis
 * `{can('dossier:delete') && <button>Supprimer</button>}`.
 *
 * Le check côté front est un confort UX — le backend doit AUSSI vérifier
 * (pour qu'un user ne puisse pas contourner via curl).
 */
export function usePermissions(): {
  can: (p: Permission) => boolean
  role: Role | null
  isAdmin: boolean
} {
  const { currentUser } = useAuth()
  return buildCan(currentUser)
}
