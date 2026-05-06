/**
 * Utilitaire universel de sauvegarde de fichier.
 *
 * - Dans Tauri : ouvre la boîte de dialogue "Enregistrer sous" native de l'OS,
 *   puis écrit le fichier à l'emplacement choisi via @tauri-apps/plugin-fs.
 * - Dans un navigateur standard : fallback sur le téléchargement via Blob
 *   (fichier envoyé automatiquement dans le dossier Téléchargements).
 */

type Filter = { name: string; extensions: string[] }

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export type SaveFileOptions = {
  /** Nom de fichier suggéré (ex: "apolline-clients-2026-04-23.csv") */
  defaultFilename: string
  /** Contenu à écrire (string ou Uint8Array) */
  content: string | Uint8Array
  /** Filtres pour la boîte de dialogue (ex: [{ name: "CSV", extensions: ["csv"] }]) */
  filters?: Filter[]
  /** MIME type pour le fallback navigateur (ex: "text/csv") */
  mimeType?: string
  /** Si true, préfixe le BOM UTF-8 (utile pour CSV ouvert par Excel FR) */
  addBom?: boolean
}

/**
 * Sauvegarde un fichier à l'emplacement choisi par l'utilisateur.
 * Retourne le chemin final si Tauri, ou la string "download" si fallback navigateur.
 * Retourne null si l'utilisateur a annulé le dialogue.
 */
export async function saveFile({
  defaultFilename,
  content,
  filters,
  mimeType = 'application/octet-stream',
  addBom = false,
}: SaveFileOptions): Promise<string | null> {
  const finalContent = addBom && typeof content === 'string'
    ? '\uFEFF' + content
    : content

  if (isTauri()) {
    // Boîte de dialogue native Windows "Enregistrer sous"
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile, writeFile } = await import('@tauri-apps/plugin-fs')

    const path = await save({
      defaultPath: defaultFilename,
      filters: filters ?? [{ name: 'Tous les fichiers', extensions: ['*'] }],
    })

    if (!path) return null // Utilisateur a annulé

    if (typeof finalContent === 'string') {
      await writeTextFile(path, finalContent)
    } else {
      await writeFile(path, finalContent)
    }
    return path
  }

  // Fallback navigateur
  const blob = typeof finalContent === 'string'
    ? new Blob([finalContent], { type: mimeType + ';charset=utf-8' })
    : new Blob([new Uint8Array(finalContent).buffer as ArrayBuffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = defaultFilename
  a.click()
  URL.revokeObjectURL(url)
  return 'download'
}

/** Filtres pré-construits les plus courants */
export const FILTERS = {
  csv: [{ name: 'Fichier CSV', extensions: ['csv'] }],
  json: [{ name: 'Fichier JSON', extensions: ['json'] }],
  ics: [{ name: 'Calendrier iCal', extensions: ['ics'] }],
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
  txt: [{ name: 'Texte brut', extensions: ['txt'] }],
  excel: [
    { name: 'Excel (CSV compatible)', extensions: ['csv'] },
    { name: 'Tous les fichiers', extensions: ['*'] },
  ],
}
