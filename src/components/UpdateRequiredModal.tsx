import { Download, AlertCircle, Loader2 } from 'lucide-react'

export type UpdateState =
  | { phase: 'available'; version: string; notes?: string }
  | { phase: 'downloading'; downloaded: number; total: number | null }
  | { phase: 'installing' }
  | { phase: 'error'; message: string }

type Props = {
  state: UpdateState
  onInstall: () => void
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

export default function UpdateRequiredModal({ state, onInstall }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" />
      <div className="relative bg-white rounded-xl2 shadow-raised w-full max-w-md flex flex-col animate-scale-in">
        <div className="p-6 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gold-100 flex items-center justify-center">
            {state.phase === 'error' ? (
              <AlertCircle className="h-6 w-6 text-red-600" />
            ) : state.phase === 'available' ? (
              <Download className="h-6 w-6 text-gold-700" />
            ) : (
              <Loader2 className="h-6 w-6 text-gold-700 animate-spin" />
            )}
          </div>
          <h2 className="font-serif text-xl font-semibold text-navy-900">
            {state.phase === 'error' ? 'Échec de la mise à jour' : 'Mise à jour requise'}
          </h2>

          {state.phase === 'available' && (
            <>
              <p className="text-sm text-navy-600">
                Une nouvelle version d'Extr'Apol est disponible (<span className="font-medium text-navy-900">v{state.version}</span>).
                <br />
                L'installation est obligatoire pour continuer à utiliser le logiciel.
              </p>
              {state.notes && (
                <div className="w-full mt-2 p-3 bg-ivory rounded-lg text-xs text-navy-700 text-left whitespace-pre-line">
                  {state.notes}
                </div>
              )}
            </>
          )}

          {state.phase === 'downloading' && (
            <>
              <p className="text-sm text-navy-600">Téléchargement en cours…</p>
              <div className="w-full mt-2">
                <div className="h-2 w-full bg-navy-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold-600 transition-all"
                    style={{
                      width: state.total
                        ? `${Math.min(100, Math.round((state.downloaded / state.total) * 100))}%`
                        : '50%',
                    }}
                  />
                </div>
                <p className="text-xs text-navy-500 mt-2">
                  {formatBytes(state.downloaded)}
                  {state.total ? ` / ${formatBytes(state.total)}` : ''}
                </p>
              </div>
            </>
          )}

          {state.phase === 'installing' && (
            <p className="text-sm text-navy-600">
              Installation en cours, redémarrage automatique…
            </p>
          )}

          {state.phase === 'error' && (
            <>
              <p className="text-sm text-navy-600">
                Impossible de finaliser la mise à jour.
              </p>
              <p className="text-xs text-red-600 mt-1 break-words">{state.message}</p>
            </>
          )}
        </div>

        {(state.phase === 'available' || state.phase === 'error') && (
          <div className="border-t border-navy-100 bg-ivory/50 p-4">
            <button
              onClick={onInstall}
              className="w-full h-11 rounded-lg bg-gold-600 hover:bg-gold-700 text-white font-medium transition flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              {state.phase === 'error' ? 'Réessayer' : 'Installer maintenant'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
