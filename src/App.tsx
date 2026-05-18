import { useCallback, useEffect, useRef, useState } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import UpdateRequiredModal, { type UpdateState } from './components/UpdateRequiredModal'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Dossiers from './pages/Dossiers'
import DossierDetail from './pages/DossierDetail'
import Saisie from './pages/Saisie'
import Simulation from './pages/Simulation'
import DVF from './pages/DVF'
import Pieces from './pages/Pieces'
import Agenda from './pages/Agenda'
import Commissions from './pages/Commissions'
import Facturation from './pages/Facturation'
import Apporteurs from './pages/Apporteurs'
import Messagerie from './pages/Messagerie'
import Parametres from './pages/Parametres'
import ImportOneDrive from './pages/ImportOneDrive'
import Login from './pages/Login'
import ErrorBoundary from './components/ErrorBoundary'
import CommandPalette from './components/CommandPalette'
import QuickProspectModal from './components/QuickProspectModal'
import CoworkerPanel from './components/CoworkerPanel'
import PoletteOnboarding from './components/PoletteOnboarding'
import RgpdConsent from './components/RgpdConsent'
import { Sparkles } from 'lucide-react'
import { initTelemetry, setTelemetryUser } from './lib/telemetry'
import { useAuth } from './auth/AuthContext'
import { useStore, getO365EmailFor } from './stores/useStore'
import * as o365 from './o365/msal'
import { O365_CLIENT_ID, O365_TENANT_ID } from './o365/config'
import { sync, getToken } from './db/api'
import { cn } from './lib/utils'

/**
 * Traite le retour d'une redirection MSAL au démarrage de l'app.
 * 1) Appelle handleRedirectPromise() pour traiter un redirect fraîchement revenu
 * 2) Sinon, vérifie si un compte est déjà en cache (reprise de session)
 */
function useO365RedirectHandler() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const { currentUser } = useAuth()
  const processedRef = useRef(false)
  const userEmail = getO365EmailFor(settings, currentUser?.id)

  useEffect(() => {
    if (!currentUser) return
    if (processedRef.current) return
    processedRef.current = true

    const run = async () => {
      const hash = window.location.hash || ''
      const hasFreshAuthHash = hash.includes('code=') || hash.includes('error=') || hash.includes('id_token=')
      const hadPendingFlag = sessionStorage.getItem('apolline.o365_redirect_pending') === '1'

      if (hadPendingFlag && !hasFreshAuthHash) {
        sessionStorage.removeItem('apolline.o365_redirect_pending')
      }

      const persistConnection = (email: string) => {
        const now = new Date().toISOString()
        const byUser = { ...(settings.o365ByUser ?? {}) }
        byUser[currentUser.id] = { email, connectedAt: now }
        updateSettings({
          o365ByUser: byUser,
          o365UserEmail: email,
          o365ConnectedAt: now,
        })
      }

      try {
        const result = await o365.handleRedirectResult(O365_CLIENT_ID, O365_TENANT_ID)
        if (result?.account) {
          persistConnection(result.account.username)
          sessionStorage.removeItem('apolline.o365_redirect_pending')
          toast.success('Connecté à Microsoft 365', { description: result.account.username })
          return
        }

        const account = await o365.getCurrentAccount(O365_CLIENT_ID, O365_TENANT_ID)
        if (account && !userEmail) {
          persistConnection(account.username)
          toast.success('Session Microsoft 365 restaurée', { description: account.username })
        } else if (!account && userEmail) {
          // Cas critique : email O365 mémorisé mais aucun account MSAL.
          // C'est ici qu'on perdait la session "à chaque session". Tentons un
          // ssoSilent avec loginHint pour récupérer la session sans interaction.
          console.warn('[O365] o365UserEmail set but no MSAL account — attempting ssoSilent recovery…')
          try {
            const recovered = await o365.refreshTokenIfNeeded(O365_CLIENT_ID, O365_TENANT_ID, userEmail)
            if (recovered) {
              const recoveredAccount = await o365.getCurrentAccount(O365_CLIENT_ID, O365_TENANT_ID)
              if (recoveredAccount) {
                persistConnection(recoveredAccount.username)
                toast.success('Session Microsoft 365 restaurée automatiquement', { description: recoveredAccount.username })
              }
            } else {
              console.warn('[O365] Recovery failed — user must reconnect manually')
            }
          } catch (e) {
            console.warn('[O365] Recovery error', e)
          }
        } else if (!account && hasFreshAuthHash) {
          toast.error('Connexion O365 non finalisée', {
            description: 'Le retour Microsoft n\'a pas pu être validé. Réessayez depuis Paramètres → Intégrations.',
            duration: 12_000,
          })
          console.error('[O365] Hash present but no result from handleRedirectPromise. Hash =', hash)
        }
      } catch (e: any) {
        console.error('O365 redirect handler error', e)
        if (hasFreshAuthHash) {
          toast.error('Échec de la connexion O365', { description: e?.message ?? 'Voir la console pour les détails' })
        }
      }
    }
    run()
  }, [currentUser, userEmail, settings.o365ByUser, updateSettings])
}

/**
 * Auto-sync O365 toutes les 15 min si activé.
 *
 * Note : on ne met PAS `replaceO365Rdvs` dans les deps de useEffect car Zustand
 * peut renvoyer une nouvelle référence à chaque rendu, ce qui ferait re-monter
 * le useEffect en boucle (et causer des syncs en boucle parfois foireuses).
 * On le récupère via getState() à l'intérieur du timer pour avoir toujours
 * la version courante sans déclencher de re-render.
 */
/**
 * Au démarrage de l'app : vérifie la conformité IOBSP du collaborateur
 * connecté. Si des certifs sont expirées ou expirent dans < 60 jours,
 * affiche une bannière toast persistante avec lien vers Paramètres.
 *
 * Une fois par session uniquement (pas de spam à chaque navigation).
 */
function useConformiteAlertOnLogin() {
  const { currentUser } = useAuth()
  const shownRef = useRef(false)

  useEffect(() => {
    if (!currentUser || shownRef.current) return
    shownRef.current = true

    void (async () => {
      try {
        // Import dynamique pour éviter le coût au boot si pas connecté
        const { conformite } = await import('@/db/api')
        const status = await conformite.status()
        if (status.global === 'ko') {
          const expirees = status.alertes.filter((a) => a.statut === 'expire')
          const description = expirees.length > 0
            ? `${expirees.length} document(s) expiré(s) — risque de contrôle ACPR.`
            : `${status.typesManquants.length} document(s) obligatoire(s) manquant(s).`
          toast.error('⚠️ Conformité IOBSP non conforme', {
            description,
            duration: 15_000,
            action: {
              label: 'Voir Paramètres',
              onClick: () => { window.location.hash = '#/parametres' },
            },
          })
        } else if (status.global === 'warn') {
          const proches = status.alertes.filter((a) => a.statut === 'alerte')
          if (proches.length > 0) {
            toast.warning('Conformité IOBSP : alertes', {
              description: `${proches.length} document(s) à renouveler bientôt.`,
              duration: 8000,
              action: {
                label: 'Voir',
                onClick: () => { window.location.hash = '#/parametres' },
              },
            })
          }
        }
      } catch (e) {
        // Silencieux — l'API peut être indisponible, on ne bloque pas
        console.warn('[conformite] alert check failed', e)
      }
    })()
  }, [currentUser])
}

function useO365AutoSync() {
  const settings = useStore((s) => s.settings)
  const { currentUser } = useAuth()
  const userEmail = getO365EmailFor(settings, currentUser?.id)

  useEffect(() => {
    if (!settings.o365AutoSync || !userEmail) return

    let cancelled = false
    const sync = async () => {
      if (cancelled) return
      try {
        const now = new Date()
        // Fenêtre 24 mois (M-12 → M+12) pour couvrir l'historique complet
        // d'un courtier (rétro 1 an pour stats) et la planification long terme.
        const start = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString()
        const end = new Date(now.getFullYear() + 1, now.getMonth() + 1, 0).toISOString()
        const events = await o365.fetchCalendarEvents(O365_CLIENT_ID, O365_TENANT_ID, start, end)
        if (cancelled) return
        const rdvs = events.map(o365.graphToRdv)
        if (rdvs.length === 0) {
          console.warn('[O365 auto-sync] 0 events received — skipping replace to avoid wiping cache')
          return
        }
        useStore.getState().replaceO365Rdvs(rdvs)
      } catch (e) {
        console.warn('[O365 auto-sync] failed (silent)', e)
      }
    }

    const initial = setTimeout(sync, 3000)
    const interval = setInterval(sync, 15 * 60 * 1000)
    return () => { cancelled = true; clearTimeout(initial); clearInterval(interval) }
  }, [settings.o365AutoSync, userEmail])
}

/**
 * Keep-alive du token O365 :
 *  - 1 fois après login (boot rapide pour valider la session)
 *  - puis toutes les 30 min en background
 *  - + un check au focus retour de l'app (Tauri minimisé puis ré-ouvert)
 *
 * Si le silent échoue ET ssoSilent échoue → bannière "Reconnectez-vous".
 * Sinon le token reste chaud, plus de "ça saute d'un jour à l'autre".
 */
function useO365KeepAlive() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const { currentUser } = useAuth()
  const userEmail = getO365EmailFor(settings, currentUser?.id)
  const reconnectShownRef = useRef(false)

  useEffect(() => {
    if (!userEmail || !currentUser) return

    let cancelled = false

    const tick = async () => {
      try {
        // userEmail = loginHint pour permettre la récupération même sans account MSAL en cache
        const ok = await o365.refreshTokenIfNeeded(O365_CLIENT_ID, O365_TENANT_ID, userEmail)
        if (cancelled) return
        if (ok) {
          if (reconnectShownRef.current) {
            // Récupération auto après une perte temporaire — on note la nouvelle date
            const now = new Date().toISOString()
            const byUser = { ...(settings.o365ByUser ?? {}) }
            byUser[currentUser.id] = { ...(byUser[currentUser.id] ?? { email: userEmail }), email: userEmail, connectedAt: now }
            updateSettings({ o365ByUser: byUser, o365ConnectedAt: now })
            reconnectShownRef.current = false
            toast.success('Session Microsoft 365 restaurée automatiquement')
          }
          return
        }
        // Token vraiment expiré — on prévient une fois (pas en boucle)
        if (!reconnectShownRef.current) {
          reconnectShownRef.current = true
          toast.error('Connexion Microsoft 365 expirée', {
            description: 'Cliquez sur "Reconnecter" dans Paramètres → Intégrations.',
            duration: 12_000,
            action: {
              label: 'Reconnecter',
              onClick: () => { window.location.hash = '#/parametres' },
            },
          })
        }
      } catch (e) {
        console.warn('[O365 keep-alive] error', e)
      }
    }

    // Premier check 5s après le login (laisse l'init MSAL se faire)
    const initial = setTimeout(tick, 5000)
    // Renouvellement toutes les 30 min
    const interval = setInterval(tick, 30 * 60 * 1000)
    // Check au focus retour (utilisateur revient sur l'app après l'avoir mise de côté)
    const onFocus = () => { void tick() }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      clearTimeout(initial)
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [userEmail, currentUser, settings.o365ByUser, updateSettings])
}

/**
 * Vérifie au démarrage si une mise à jour de l'app Tauri est disponible.
 * Si oui, expose un état `available` que App utilise pour afficher
 * UpdateRequiredModal — un dialogue bloquant qui force l'installation.
 * Silencieux si pas de mise à jour ou si l'API updater n'est pas disponible
 * (par ex. en mode npm run dev navigateur).
 */
function useTauriUpdater(): { state: UpdateState | null; install: () => Promise<void> } {
  const [state, setState] = useState<UpdateState | null>(null)
  const updateRef = useRef<{ version: string; body?: string; downloadAndInstall: (cb?: (e: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => Promise<void> } | null>(null)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true
    const run = async () => {
      console.log('[updater] starting check…')
      try {
        const { check: checkUpdate } = await import('@tauri-apps/plugin-updater')
        const update = await checkUpdate()
        if (!update) {
          console.log('[updater] no update available — already on latest version')
          return
        }
        console.log('[updater] update available:', update.version, 'currentVersion:', (update as unknown as { currentVersion?: string }).currentVersion)
        updateRef.current = update as unknown as typeof updateRef.current
        setState({ phase: 'available', version: update.version, notes: update.body })
      } catch (e) {
        // Erreur visible : signature pubkey mismatch, endpoint injoignable, etc.
        // L'utilisateur voit un toast + log console pour qu'on puisse diagnostiquer.
        const message = e instanceof Error ? e.message : String(e)
        console.warn('[updater] check failed:', message, e)
        toast.error('Vérification de mise à jour impossible', {
          description: message.slice(0, 200),
          duration: 10_000,
        })
      }
    }
    setTimeout(run, 5000)
  }, [])

  const install = useCallback(async () => {
    const update = updateRef.current
    if (!update) return
    setState({ phase: 'downloading', downloaded: 0, total: null })
    try {
      let downloadedAcc = 0
      await update.downloadAndInstall((evt) => {
        if (evt.event === 'Started') {
          setState({ phase: 'downloading', downloaded: 0, total: evt.data?.contentLength ?? null })
        } else if (evt.event === 'Progress') {
          downloadedAcc += evt.data?.chunkLength ?? 0
          setState((prev) => (prev?.phase === 'downloading' ? { ...prev, downloaded: downloadedAcc } : prev))
        } else if (evt.event === 'Finished') {
          setState({ phase: 'installing' })
        }
      })
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setState({ phase: 'error', message })
    }
  }, [])

  return { state, install }
}

/**
 * Sync backend automatique. Garantit qu'aucun changement fait par un autre
 * collaborateur ne peut être loupé sur ce poste, même si :
 *   - l'app était déjà ouverte au moment du changement (pull périodique)
 *   - le SSE s'est déconnecté (pull au reconnect — cf. SyncManager)
 *   - l'utilisateur est revenu sur l'app après une absence (pull au focus)
 */
function useBackendSyncResume() {
  const { currentUser, authMode, logout } = useAuth()
  const startedRef = useRef(false)

  useEffect(() => {
    if (!currentUser || authMode !== 'online') return
    if (!getToken()) return

    // Pull avec feedback visible. Si 401/403 → token mort, logout forcé.
    const pullWithFeedback = async (initial: boolean) => {
      try {
        const { counts, errors } = await sync.pullAll()
        const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0)

        // Si tout a échoué avec 401/403 → token mort → on logout
        const authFailed = errors.length > 0 && errors.every((e) => e.status === 401 || e.status === 403)
        if (authFailed) {
          toast.error('Session expirée — reconnexion nécessaire', {
            description: 'Votre session backend a expiré. Reconnectez-vous pour synchroniser.',
            duration: 8000,
          })
          logout()
          return
        }

        if (errors.length > 0 && total === 0) {
          // Aucune donnée pull, des erreurs partout
          toast.error('Synchronisation impossible', {
            description: `${errors.length} table(s) en échec. Vérifiez votre connexion.`,
            duration: 8000,
          })
          return
        }

        // Au boot uniquement, on confirme la sync à l'utilisateur (toast 3s)
        if (initial && total > 0) {
          const summary = `${counts.dossiers ?? 0} dossier${(counts.dossiers ?? 0) > 1 ? 's' : ''} · ${counts.clients ?? 0} client${(counts.clients ?? 0) > 1 ? 's' : ''} · ${counts.prets ?? 0} prêt${(counts.prets ?? 0) > 1 ? 's' : ''}`
          toast.success('Synchronisé avec le serveur', { description: summary, duration: 3500 })
        }
        if (errors.length > 0) {
          console.warn('[sync] partial errors:', errors)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn('[sync] pullAll threw', msg)
        if (initial) {
          // Niveau warning (jaune) au lieu d'error (rouge) : la sync échoue
          // souvent transitoirement au boot (DNS lent, WiFi pas encore prêt
          // au lancement Windows) et se rétablit toute seule au prochain pull.
          // Pas la peine de paniquer Sébastien avec une alerte rouge.
          toast.warning('Synchronisation indisponible', {
            description: `${msg.slice(0, 160)} — un nouvel essai a lieu automatiquement.`,
            duration: 6000,
          })
        }
      }
    }

    // 1) Pull initial + démarrage SSE (1 seule fois)
    if (!startedRef.current) {
      startedRef.current = true
      void pullWithFeedback(true)
      sync.start()
    }

    // 2) Pull silencieux au retour de focus
    let pullPending = false
    const pullSilent = () => {
      if (pullPending) return
      if (document.visibilityState !== 'visible') return
      if (!getToken()) return
      pullPending = true
      void pullWithFeedback(false).finally(() => { pullPending = false })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') pullSilent()
    }
    const onFocus = () => pullSilent()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)

    // 3) Pull périodique toutes les 2 minutes — filet ultime.
    const intervalId = window.setInterval(pullSilent, 2 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(intervalId)
    }
  }, [currentUser, authMode, logout])
}

export default function App() {
  const location = useLocation()
  const { currentUser } = useAuth()
  const sidebarPinned = useStore((s) => s.settings.sidebarPinned ?? false)
  const [quickProspectOpen, setQuickProspectOpen] = useState(false)
  const [coworkerOpen, setCoworkerOpen] = useState(false)

  useO365RedirectHandler()
  useO365AutoSync()
  useO365KeepAlive()
  useConformiteAlertOnLogin()
  useBackendSyncResume()
  const { state: updateState, install: installUpdate } = useTauriUpdater()

  // Init télémétrie une seule fois au boot, puis met à jour le user au login
  useEffect(() => { initTelemetry() }, [])
  useEffect(() => {
    if (currentUser) setTelemetryUser(currentUser.id, currentUser.email)
  }, [currentUser])

  // Raccourci global Ctrl+Shift+N → ouvre la saisie rapide
  // Raccourci global Ctrl+I (ou Cmd+I) → ouvre/ferme le Coworker
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setQuickProspectOpen(true)
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        setCoworkerOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    // Aussi exposé via event custom 'apolline:quick-prospect' (déclenché depuis Sidebar)
    const onCustom = () => setQuickProspectOpen(true)
    const onCoworker = () => setCoworkerOpen((v) => !v)
    window.addEventListener('apolline:quick-prospect', onCustom)
    window.addEventListener('apolline:coworker-toggle', onCoworker)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('apolline:quick-prospect', onCustom)
      window.removeEventListener('apolline:coworker-toggle', onCoworker)
    }
  }, [])

  const updateModal = updateState && <UpdateRequiredModal state={updateState} onInstall={installUpdate} />

  if (!currentUser) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        {updateModal}
      </>
    )
  }

  return (
    <>
      <div className="flex h-screen w-screen overflow-hidden bg-ivory">
        <Sidebar />
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-out-expo',
            sidebarPinned && 'pl-64',
          )}
        >
          <Topbar />
          <main className="flex-1 overflow-hidden relative flex">
            <div key={'nav-' + location.pathname} className="nav-progress" />

            <div
              key={location.pathname}
              className="page flex-1 min-w-0 overflow-hidden flex flex-col px-8 py-6 max-w-[1600px] mx-auto w-full"
            >
              <ErrorBoundary scope={`route:${location.pathname}`}>
                <Routes location={location}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/prospects" element={<Clients mode="prospect" />} />
                  <Route path="/clients" element={<Clients mode="client" />} />
                  <Route path="/dossiers" element={<Dossiers />} />
                  <Route path="/dossiers/:id" element={<DossierDetail />} />
                  <Route path="/saisie" element={<Saisie />} />
                  <Route path="/simulation" element={<Simulation />} />
                  <Route path="/dvf" element={<DVF />} />
                  <Route path="/pieces" element={<Pieces />} />
                  <Route path="/agenda" element={<Agenda />} />
                  <Route path="/messagerie" element={<Messagerie />} />
                  <Route path="/commissions" element={<Commissions />} />
                  <Route path="/facturation" element={<Facturation />} />
                  <Route path="/apporteurs" element={<Apporteurs />} />
                  <Route path="/parametres" element={<Parametres />} />
                  <Route path="/import-onedrive" element={<ImportOneDrive />} />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ErrorBoundary>
            </div>
          </main>
          <CommandPalette />
          <QuickProspectModal open={quickProspectOpen} onClose={() => setQuickProspectOpen(false)} />
          <RgpdConsent />
        </div>

        {/* Bouton flottant Polette (en bas à droite, masqué quand le panneau est ouvert) */}
        {!coworkerOpen && (
          <button
            onClick={() => setCoworkerOpen(true)}
            className="fixed bottom-6 right-6 z-30 h-12 w-12 rounded-full bg-gradient-to-br from-navy-900 to-navy-950 border border-gold-500/40 text-gold-400 hover:text-gold-300 hover:border-gold-500/70 shadow-[0_0_24px_-4px_rgba(201,169,97,0.5)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center group polette-pulse"
            title="Polette (Ctrl+I)"
          >
            <Sparkles className="h-5 w-5" />
            <span className="absolute right-full mr-3 bg-navy-950 border border-gold-500/30 text-gold-300 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none polette-mono uppercase tracking-[0.12em]">
              Polette · Ctrl+I
            </span>
          </button>
        )}
        <CoworkerPanel open={coworkerOpen} onClose={() => setCoworkerOpen(false)} />
        <PoletteOnboarding />
      </div>
      {updateModal}
    </>
  )
}
