import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

/**
 * ErrorBoundary global — capture les exceptions React qui crashent un sous-arbre
 * et affiche une UI de secours plutôt qu'un écran blanc. Le boundary est posé
 * dans App.tsx autour des routes : un crash sur la page Pieces n'ennuie pas
 * la page Dashboard.
 *
 * On envoie aussi l'erreur au plugin télémétrie (Sentry) si configuré.
 */
type Props = {
  children: ReactNode
  /** Identifiant logique pour distinguer dans les logs (ex: "route:/dossiers"). */
  scope?: string
  /** UI de secours custom (sinon UI par défaut). */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.scope ?? 'unknown'}`, error, info.componentStack)
    // Hook télémétrie : si window.__sentryCaptureException existe (cf. télémétrie.ts), on l'appelle
    const captureFn = (window as unknown as { __sentryCaptureException?: (e: Error, ctx: unknown) => void }).__sentryCaptureException
    if (typeof captureFn === 'function') {
      try {
        captureFn(error, { scope: this.props.scope ?? 'unknown', componentStack: info.componentStack })
      } catch { /* swallow */ }
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className="card p-8 max-w-2xl mx-auto my-12 border-l-4 border-rose-500">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-6 w-6 text-rose-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-xl text-navy-900 mb-1">Une erreur est survenue</h2>
            <p className="text-sm text-navy-600 mb-3">
              Cette section de l'application a planté. Le reste de l'app continue de fonctionner.
              Tu peux réessayer ou revenir au tableau de bord.
            </p>
            <details className="text-xs text-navy-500 mb-4 bg-navy-50 rounded p-3 font-mono break-all">
              <summary className="cursor-pointer font-semibold text-navy-700 mb-1">Détail technique</summary>
              <div className="mt-2">{error.name}: {error.message}</div>
              {error.stack && (
                <pre className="mt-2 text-[10px] whitespace-pre-wrap leading-relaxed">{error.stack.split('\n').slice(0, 8).join('\n')}</pre>
              )}
            </details>
            <div className="flex gap-2">
              <button onClick={this.reset} className="btn-gold">
                <RefreshCw className="h-4 w-4" /> Réessayer
              </button>
              <a href="/" onClick={this.reset} className="btn-outline inline-flex items-center gap-2">
                <Home className="h-4 w-4" /> Retour au tableau de bord
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
