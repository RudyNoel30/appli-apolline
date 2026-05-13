/**
 * Helpers de dialogue confirmation/info compatibles Tauri 2 + navigateur web.
 *
 * ⚠ Tauri 2 WebView2 désactive `window.confirm()` / `window.alert()` /
 * `window.prompt()` par défaut pour éviter de freezer le process renderer.
 * Du coup tous nos `if (!confirm('…'))` ne marchent pas en MSI → le bouton
 * paraît inerte alors que ça appelait bien le confirm, mais celui-ci renvoie
 * `undefined` au lieu de booléen.
 *
 * Ce helper détecte le runtime et utilise :
 *   - `@tauri-apps/plugin-dialog.ask()` dans Tauri (dialog système natif)
 *   - `window.confirm()` en mode dev navigateur (npm run dev)
 *
 * Usage:
 *   if (await confirmDialog('Supprimer ce prêt ?')) {
 *     ...
 *   }
 */

export type ConfirmOptions = {
  title?: string
  okLabel?: string
  cancelLabel?: string
  /** 'info' | 'warning' | 'error' — change l'icône du dialog Tauri */
  kind?: 'info' | 'warning' | 'error'
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Demande une confirmation à l'utilisateur via un dialog modal système.
 * Retourne true si confirmé, false sinon.
 */
export async function confirmDialog(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  if (isTauri()) {
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog')
      const result = await ask(message, {
        title: opts.title ?? 'Confirmer',
        kind: opts.kind ?? 'warning',
        okLabel: opts.okLabel ?? 'Confirmer',
        cancelLabel: opts.cancelLabel ?? 'Annuler',
      })
      return Boolean(result)
    } catch (e) {
      // Si plugin-dialog plante (rare), fallback strict
      console.warn('[dialog] plugin-dialog.ask failed, fallback to window.confirm:', e)
    }
  }
  // Mode navigateur (npm run dev) ou fallback
  return window.confirm(message)
}

/**
 * Affiche un message d'information bloquant. Préfère toast.info() pour de
 * l'info non-bloquante.
 */
export async function messageDialog(
  message: string,
  opts: { title?: string; kind?: 'info' | 'warning' | 'error' } = {},
): Promise<void> {
  if (isTauri()) {
    try {
      const { message: msg } = await import('@tauri-apps/plugin-dialog')
      await msg(message, {
        title: opts.title ?? 'Information',
        kind: opts.kind ?? 'info',
      })
      return
    } catch (e) {
      console.warn('[dialog] plugin-dialog.message failed:', e)
    }
  }
  window.alert(message)
}
