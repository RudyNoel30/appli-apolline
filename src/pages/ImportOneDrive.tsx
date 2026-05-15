/**
 * Page « Importer depuis OneDrive » — scanne le filesystem local pour trouver
 * les fichiers `AA summary extract.txt` produits par le skill /dossier-extract,
 * et permet d'importer chaque dossier en BDD Apolline en 1 clic.
 *
 * Workflow utilisateur :
 *   1. Sebastien continue son workflow OneDrive (drop pièces, lance dossier-extract)
 *   2. Le fichier AA summary extract.txt est créé sur sa machine (OneDrive synchronisé)
 *   3. Il ouvre cette page Apolline → scan auto, liste tous les dossiers détectés
 *   4. Il clique "Importer" → Apolline crée client + dossier complet via Claude
 *   5. Redirection vers le dossier créé pour vérification / R1
 *
 * Sécurité Tauri : on lit uniquement les fichiers nommés exactement
 * `AA summary extract.txt` sous les chemins autorisés par fs:scope ($HOME/**).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderSearch, FileText, RefreshCw, Sparkles, CheckCircle2, AlertCircle,
  ArrowRight, Search, Folder, Filter, Files,
} from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import { importExtractApi, importSimulationApi, pieces as piecesApi } from '@/db/api'
import { useStore } from '@/stores/useStore'
import { sync } from '@/db/api'
import { cn } from '@/lib/utils'

const TARGET_FILENAME = 'AA summary extract.txt'

/** Extensions considérées comme des pièces à importer (PDF, images, Office). */
const PIECE_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif',
  '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv',
])

/** Mapping extension → MIME pour les File objects construits depuis le fs Tauri */
const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
}

/** Fichiers techniques produits par dossier-extract — on les exclut de l'import en tant que pièces */
const TECHNICAL_FILES = new Set([
  'AA summary extract.txt',
  'AA tracfin_analysis.txt',
  'AA summary dvf.txt',
  'AA summary simulation.txt',
])

type DetectedExtract = {
  filePath: string        // chemin absolu du AA summary extract.txt
  folderPath: string      // dossier parent (= dossier client OneDrive)
  folderName: string      // nom du dossier client (ex: "ZZ BESANA AMA 46 478")
  hint: string            // 1ère ligne descriptive du fichier
  cible?: string          // cible immobilière si extractible
  piecesPaths: string[]   // chemins de toutes les pièces (PDFs, images, etc.) du dossier
  simulationPath?: string // chemin AA summary simulation.txt si présent (texte pré-extrait)
  cifacilPdfPath?: string // chemin direct vers la DDP Cifacil (PDF) — préféré si présent
  existing?: { id: string; ref: string }  // dossier déjà importé (matche par client nom)
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Scan récursif simple — limite à 5 niveaux pour éviter de noyer le user en cas de mauvais chemin */
async function scanForExtracts(
  rootPath: string,
  maxDepth = 5,
  onProgress?: (path: string) => void,
): Promise<string[]> {
  const { readDir, exists } = await import('@tauri-apps/plugin-fs')
  const found: string[] = []
  if (!(await exists(rootPath).catch(() => false))) return []

  type Entry = { name?: string; isDirectory?: boolean; isFile?: boolean }
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return
    let entries: Entry[]
    try {
      entries = await readDir(dir) as Entry[]
    } catch {
      return  // permission refusée ou dossier illisible
    }
    for (const e of entries) {
      if (!e.name) continue
      const fullPath = `${dir}\\${e.name}`
      if (e.isFile && e.name === TARGET_FILENAME) {
        found.push(fullPath)
        onProgress?.(fullPath)
      } else if (e.isDirectory) {
        await walk(fullPath, depth + 1)
      }
    }
  }

  await walk(rootPath, 0)
  return found
}

/** Lit les 20 premières lignes pour extraire un descriptif rapide */
async function previewExtract(filePath: string): Promise<{ hint: string; cible?: string }> {
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  try {
    const text = await readTextFile(filePath)
    const lines = text.split('\n').slice(0, 30)
    const dossierLine = lines.find((l) => /DOSSIER\s+.*SUMMARY EXTRACT/i.test(l))
    const cibleLine = lines.find((l) => /Cible immobilière/i.test(l))
    const hint = dossierLine
      ? dossierLine.replace(/^DOSSIER\s+/i, '').replace(/\s*—\s*SUMMARY EXTRACT.*$/i, '').trim()
      : ''
    const cible = cibleLine
      ? cibleLine.replace(/^Cible immobilière\s*:\s*/i, '').trim()
      : undefined
    return { hint, cible }
  } catch {
    return { hint: '' }
  }
}

async function readFullExtract(filePath: string): Promise<string> {
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  return readTextFile(filePath)
}

/**
 * Cherche un fichier AA summary simulation.txt à côté du AA summary extract.txt
 * (même dossier OneDrive). C'est le plan de financement Cifacil produit par
 * /dossier-extract-simulation. Retourne le chemin absolu si trouvé, sinon undefined.
 */
async function findSimulationFile(folderPath: string): Promise<string | undefined> {
  const { exists } = await import('@tauri-apps/plugin-fs')
  const candidate = `${folderPath}\\AA summary simulation.txt`
  try {
    if (await exists(candidate)) return candidate
  } catch {
    /* ignore */
  }
  return undefined
}

/**
 * Cherche la DDP Cifacil PDF dans le dossier (récursivement). Pattern attendu :
 * "P0 - CIFACIL R0.pdf", "P0 - CIFACIL R1.pdf" ou tout autre fichier dont le
 * nom contient "cifacil" et l'extension .pdf. Préféré au .txt car analysé
 * directement par Claude Vision sans skill préalable.
 */
async function findCifacilPdf(folderPath: string, maxDepth = 3): Promise<string | undefined> {
  const { readDir } = await import('@tauri-apps/plugin-fs')
  type Entry = { name?: string; isDirectory?: boolean; isFile?: boolean }
  // Priorité aux R1 > R0 > tout autre Cifacil
  const candidates: { path: string; score: number }[] = []
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return
    let entries: Entry[]
    try { entries = await readDir(dir) as Entry[] } catch { return }
    for (const e of entries) {
      if (!e.name) continue
      const full = `${dir}\\${e.name}`
      if (e.isFile) {
        const lower = e.name.toLowerCase()
        if (lower.endsWith('.pdf') && lower.includes('cifacil')) {
          // R1 (rdv 1, plan finalisé) > R0 (premier appel) > autre
          const score = lower.includes('r1') ? 3 : lower.includes('r0') ? 2 : 1
          candidates.push({ path: full, score })
        }
      } else if (e.isDirectory) {
        await walk(full, depth + 1)
      }
    }
  }
  await walk(folderPath, 0)
  if (candidates.length === 0) return undefined
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.path
}

/**
 * Liste récursivement tous les fichiers candidats à l'import dans un dossier
 * (PDFs, images, Office). Exclut les fichiers techniques de dossier-extract
 * (AA summary extract.txt, AA tracfin_analysis.txt, etc.) qui ne sont pas
 * des pièces à classer mais des sous-produits du skill.
 */
async function listPiecesInFolder(folderPath: string, maxDepth = 4): Promise<string[]> {
  const { readDir } = await import('@tauri-apps/plugin-fs')
  const found: string[] = []
  type Entry = { name?: string; isDirectory?: boolean; isFile?: boolean }

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return
    let entries: Entry[]
    try {
      entries = await readDir(dir) as Entry[]
    } catch {
      return
    }
    for (const e of entries) {
      if (!e.name) continue
      const fullPath = `${dir}\\${e.name}`
      if (e.isFile) {
        // Skip fichiers techniques + tout ce qui ne matche pas une extension supportée
        if (TECHNICAL_FILES.has(e.name)) continue
        const dot = e.name.lastIndexOf('.')
        if (dot < 0) continue
        const ext = e.name.slice(dot).toLowerCase()
        if (PIECE_EXTENSIONS.has(ext)) {
          found.push(fullPath)
        }
      } else if (e.isDirectory) {
        await walk(fullPath, depth + 1)
      }
    }
  }

  await walk(folderPath, 0)
  return found
}

/**
 * Lit un fichier local (Tauri fs) et construit un File browser-compatible
 * exploitable par notre endpoint multipart `pieces.upload()`.
 */
async function readAsBrowserFile(filePath: string): Promise<File> {
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const bytes = await readFile(filePath)
  const filename = filePath.split(/[\\/]/).pop() ?? 'piece'
  const dot = filename.lastIndexOf('.')
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : ''
  const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'
  // Note : on cast en BlobPart car le typage Tauri retourne Uint8Array
  const blob = new Blob([bytes as BlobPart], { type: mime })
  return new File([blob], filename, { type: mime })
}

export default function ImportOneDrive() {
  const navigate = useNavigate()
  const dossiers = useStore((s) => s.dossiers)
  const [scanRoot, setScanRoot] = useState<string>('')
  const [scanning, setScanning] = useState(false)
  const [extracts, setExtracts] = useState<DetectedExtract[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState<Set<string>>(new Set())

  // Détecte le chemin OneDrive par défaut au montage : $HOME/APOLLINE
  useEffect(() => {
    if (!isTauri()) return
    void (async () => {
      try {
        const { homeDir } = await import('@tauri-apps/api/path')
        const home = await homeDir()
        // Normalise et propose le chemin OneDrive habituel
        setScanRoot(`${home.replace(/[\\/]+$/, '')}\\APOLLINE`)
      } catch {
        setScanRoot('C:\\Users\\Rudy NOEL\\APOLLINE')
      }
    })()
  }, [])

  /** Lance le scan */
  const onScan = async () => {
    if (!isTauri()) {
      toast.error('Disponible uniquement dans l\'app Tauri (pas le mode web dev)')
      return
    }
    if (!scanRoot) {
      toast.error('Choisis un dossier OneDrive à scanner')
      return
    }
    setScanning(true)
    setExtracts([])
    const t = toast.loading(`Scan de ${scanRoot}…`)
    try {
      const paths = await scanForExtracts(scanRoot)
      if (paths.length === 0) {
        toast.warning('Aucun "AA summary extract.txt" trouvé', { id: t, description: `Sous ${scanRoot} (max 5 niveaux)` })
        return
      }
      toast.loading(`${paths.length} extrait(s) trouvé(s), analyse…`, { id: t })

      // Pour chaque fichier : extrait preview + match dossier existant + liste pièces
      const detected: DetectedExtract[] = []
      for (const filePath of paths) {
        const folderPath = filePath.replace(/\\[^\\]+$/, '')
        const folderName = folderPath.replace(/^.*\\/, '')
        const { hint, cible } = await previewExtract(filePath)

        // Liste les pièces présentes dans le dossier (parent de AA summary extract.txt)
        // — récursif jusqu'à 4 niveaux, exclut les fichiers techniques.
        const piecesPaths = await listPiecesInFolder(folderPath)

        // Détecte un plan de financement Cifacil :
        //   1. PDF direct (P0 - CIFACIL R1.pdf, recommandé) ← préféré
        //   2. sinon fichier texte AA summary simulation.txt (déjà extrait)
        const cifacilPdfPath = await findCifacilPdf(folderPath)
        const simulationPath = cifacilPdfPath ? undefined : await findSimulationFile(folderPath)

        // Match dossier existant : par nom client extrait du folderName
        const existing = matchExistingDossier(folderName, hint, dossiers)
        detected.push({ filePath, folderPath, folderName, hint, cible, piecesPaths, simulationPath, cifacilPdfPath, existing })
      }

      setExtracts(detected)
      toast.success(`${detected.length} dossier(s) détecté(s)`, { id: t })
    } catch (e) {
      toast.error('Erreur de scan', { id: t, description: e instanceof Error ? e.message : String(e) })
    } finally {
      setScanning(false)
    }
  }

  /** Importe les dossiers sélectionnés */
  const onImportSelected = async () => {
    const toImport = extracts.filter((e) => selected.has(e.filePath) && !e.existing)
    if (toImport.length === 0) {
      toast.info('Aucun dossier nouveau à importer (les autres sont déjà connus)')
      return
    }

    setImporting(new Set(toImport.map((e) => e.filePath)))
    let success = 0
    let firstDossierId: string | null = null

    for (const ex of toImport) {
      try {
        // 1. Crée le dossier + prospect en BDD via parsing Claude
        const text = await readFullExtract(ex.filePath)
        const res = await importExtractApi.run(text, ex.folderPath)
        success++
        if (!firstDossierId) firstDossierId = res.dossierId
        toast.success(`${ex.folderName} importé`, {
          description: `${res.ref}${res.legacyId ? ` · legacy ${res.legacyId}` : ''} · ${res.fieldsImported} champs · ${res.usage.estimatedCostEur.toFixed(3)} €`,
        })

        // 2bis. Import du plan de financement Cifacil → crée les prêts en BDD.
        // Préférence : PDF direct > AA summary simulation.txt (skill déjà passé).
        if (ex.cifacilPdfPath || ex.simulationPath) {
          const isPdf = !!ex.cifacilPdfPath
          const sourceLabel = isPdf
            ? ex.cifacilPdfPath!.split(/[\\/]/).pop() ?? 'CIFACIL.pdf'
            : 'AA summary simulation.txt'
          const simToast = toast.loading(`Import Cifacil ${sourceLabel} (${ex.folderName})…`)
          try {
            let simRes: import('@/db/api').ImportSimulationResult
            if (isPdf) {
              const pdfFile = await readAsBrowserFile(ex.cifacilPdfPath!)
              simRes = await importSimulationApi.runPdf(res.dossierId, pdfFile, ex.folderPath)
            } else {
              const { readTextFile } = await import('@tauri-apps/plugin-fs')
              const simText = await readTextFile(ex.simulationPath!)
              simRes = await importSimulationApi.run(res.dossierId, simText, ex.folderPath)
            }
            toast.success(`${simRes.pretsCrees.length} prêt(s) Cifacil importé(s)`, {
              id: simToast,
              description: `${simRes.banquePortante || 'banque inconnue'} · ${simRes.usage.estimatedCostEur.toFixed(3)} €`,
            })
          } catch (e) {
            toast.warning(`Échec import plan financement ${ex.folderName}`, {
              id: simToast,
              description: e instanceof Error ? e.message : String(e),
            })
          }
        }

        // 3. Upload les pièces du dossier OneDrive vers Apolline (en parallèle au toast principal)
        if (ex.piecesPaths.length > 0) {
          const pieceToast = toast.loading(`Upload des ${ex.piecesPaths.length} pièces de ${ex.folderName}…`)
          try {
            // Lit chaque fichier local et le transforme en File browser-compatible
            const files: File[] = []
            for (const p of ex.piecesPaths) {
              try {
                files.push(await readAsBrowserFile(p))
              } catch (e) {
                console.warn(`[import] échec lecture ${p}`, e)
              }
            }
            if (files.length > 0) {
              const uploadRes = await piecesApi.upload(res.dossierId, files, {
                onProgress: (done, total) => {
                  toast.loading(`Upload pièces ${done}/${total}…`, { id: pieceToast })
                },
              })
              if (uploadRes.errors.length > 0) {
                toast.warning(`${uploadRes.inserted}/${files.length} pièces uploadées (${uploadRes.errors.length} échecs)`, {
                  id: pieceToast,
                  description: uploadRes.errors.slice(0, 3).map((e) => e.filename).join(', '),
                })
              } else {
                toast.success(`${uploadRes.inserted} pièces uploadées`, { id: pieceToast })
              }
            } else {
              toast.dismiss(pieceToast)
            }
          } catch (e) {
            toast.error(`Échec upload pièces ${ex.folderName}`, {
              id: pieceToast,
              description: e instanceof Error ? e.message : String(e),
            })
          }
        }
      } catch (e) {
        toast.error(`Échec ${ex.folderName}`, { description: e instanceof Error ? e.message : String(e) })
      }
      setImporting((prev) => {
        const next = new Set(prev)
        next.delete(ex.filePath)
        return next
      })
    }

    if (success > 0) {
      // Re-pull pour récupérer les nouveaux dossiers dans le store
      await sync.pullAll().catch(() => { /* silencieux */ })
      // Si 1 seul import → redirige vers le dossier ; sinon vers la page Dossiers
      if (success === 1 && firstDossierId) {
        navigate(`/dossiers/${firstDossierId}`)
      } else {
        navigate('/dossiers')
      }
    }

    setSelected(new Set())
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return extracts
    const q = search.toLowerCase()
    return extracts.filter((e) =>
      e.folderName.toLowerCase().includes(q)
      || (e.hint?.toLowerCase().includes(q))
      || (e.cible?.toLowerCase().includes(q)),
    )
  }, [extracts, search])

  const newCount = extracts.filter((e) => !e.existing).length
  const existingCount = extracts.length - newCount

  return (
    <>
      <PageHeader
        eyebrow="OneDrive"
        title="Importer un dossier"
        description="Scan automatique des AA summary extract.txt générés par /dossier-extract dans ton OneDrive. Création prospect + dossier en 1 clic."
      />

      {/* Barre scan */}
      <div className="card p-4 mb-5">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="label">Dossier OneDrive à scanner</label>
            <input
              className="input font-mono text-sm"
              value={scanRoot}
              onChange={(e) => setScanRoot(e.target.value)}
              placeholder="C:\Users\...\APOLLINE"
            />
            <div className="text-[11px] text-navy-400 mt-1">
              Scan récursif (max 5 niveaux) à la recherche de fichiers nommés exactement « {TARGET_FILENAME} »
            </div>
          </div>
          <button onClick={onScan} disabled={scanning} className="btn-gold">
            {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FolderSearch className="h-4 w-4" />}
            {scanning ? 'Scan…' : 'Scanner'}
          </button>
        </div>
      </div>

      {/* Résultats */}
      {extracts.length === 0 && !scanning && (
        <div className="card p-8 text-center">
          <Folder className="h-12 w-12 text-navy-200 mx-auto mb-3" />
          <div className="text-sm text-navy-500">
            Clique sur « Scanner » pour détecter les dossiers OneDrive contenant un <code className="text-xs">AA summary extract.txt</code>.
          </div>
        </div>
      )}

      {extracts.length > 0 && (
        <div className="card p-0 overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-navy-100 bg-ivory/50 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrer par nom, cible…"
                className="input pl-9 text-sm"
              />
            </div>
            <div className="text-xs text-navy-500 flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" />
                {filtered.length} sur {extracts.length}
              </span>
              <span className="badge-success text-[10px]">{newCount} nouveau{newCount > 1 ? 'x' : ''}</span>
              {existingCount > 0 && (
                <span className="badge-navy text-[10px]">{existingCount} déjà connu{existingCount > 1 ? 's' : ''}</span>
              )}
            </div>
            <button
              onClick={() => setSelected(new Set(filtered.filter((e) => !e.existing).map((e) => e.filePath)))}
              className="btn-ghost text-xs"
            >
              Tout cocher (nouveaux)
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="btn-ghost text-xs"
              disabled={selected.size === 0}
            >
              Décocher
            </button>
            <button
              onClick={() => void onImportSelected()}
              disabled={selected.size === 0 || importing.size > 0}
              className="btn-gold"
            >
              <Sparkles className="h-4 w-4" />
              Importer ({selected.size})
            </button>
          </div>

          {/* Liste */}
          <div className="divide-y divide-navy-50">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-navy-400 italic">
                Aucun résultat pour ce filtre
              </div>
            ) : filtered.map((e) => {
              const isNew = !e.existing
              const isSelected = selected.has(e.filePath)
              const isImporting = importing.has(e.filePath)
              return (
                <div
                  key={e.filePath}
                  className={cn(
                    'p-3 flex items-start gap-3 hover:bg-navy-50/40 transition-colors',
                    isSelected && isNew && 'bg-gold-50/30 ring-1 ring-gold-200',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!isNew || isImporting}
                    onChange={(ev) => {
                      const next = new Set(selected)
                      if (ev.target.checked) next.add(e.filePath)
                      else next.delete(e.filePath)
                      setSelected(next)
                    }}
                    className="mt-1 h-4 w-4 rounded border-navy-300 text-gold-500 focus:ring-gold-500"
                  />
                  <FileText className="h-5 w-5 text-gold-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-navy-900 truncate" title={e.folderName}>
                        {e.folderName}
                      </span>
                      {isNew ? (
                        <span className="badge-success text-[10px]">Nouveau</span>
                      ) : (
                        <button
                          onClick={() => navigate(`/dossiers/${e.existing!.id}`)}
                          className="badge-navy text-[10px] hover:bg-navy-200"
                        >
                          {e.existing!.ref} — Existe
                          <ArrowRight className="h-3 w-3 ml-0.5" />
                        </button>
                      )}
                    </div>
                    {e.hint && <div className="text-xs text-navy-600 mt-0.5">{e.hint}</div>}
                    {e.cible && <div className="text-[11px] text-navy-500 mt-0.5">🏠 {e.cible}</div>}
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {e.piecesPaths.length > 0 && (
                        <span className="text-[11px] text-emerald-700 inline-flex items-center gap-1">
                          <Files className="h-3 w-3" />
                          {e.piecesPaths.length} pièce{e.piecesPaths.length > 1 ? 's' : ''} à importer
                        </span>
                      )}
                      {(e.cifacilPdfPath || e.simulationPath) && (
                        <span className="text-[11px] text-gold-700 inline-flex items-center gap-1 bg-gold-50 border border-gold-200 rounded px-1.5 py-0.5"
                          title={e.cifacilPdfPath
                            ? `DDP Cifacil PDF détectée (${e.cifacilPdfPath.split(/[\\/]/).pop()}) — les prêts seront importés automatiquement`
                            : 'AA summary simulation.txt détecté — les prêts seront importés automatiquement'}>
                          <Sparkles className="h-3 w-3" />
                          {e.cifacilPdfPath ? 'DDP Cifacil PDF' : 'Plan financement Cifacil'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-navy-400 mt-1 font-mono truncate" title={e.filePath}>
                      {e.filePath}
                    </div>
                  </div>
                  {isImporting && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-gold-700">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Import…
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="mt-6 text-xs text-navy-500 px-1 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-navy-400" />
        <div>
          <div className="font-semibold text-navy-700 mb-0.5">Comment ça marche</div>
          Le scan cherche tous les fichiers nommés exactement <code className="text-[11px]">AA summary extract.txt</code> sous le chemin choisi.
          Pour chaque dossier nouveau, Polette parse le fichier via Claude (~5 s · ~0,05 €) et crée le prospect + dossier complet en BDD (état civil, revenus avec scénario médian, projet, alertes).
          La référence Apolline est générée automatiquement (format <code className="text-[11px]">2026-NNNN</code>), et la référence OneDrive d'origine est conservée en <code className="text-[11px]">legacyId</code> pour traçabilité.
        </div>
      </div>
    </>
  )
}

/**
 * Tente de matcher un dossier existant en base à partir du nom du dossier
 * OneDrive (ex: "ZZ BESANA AMA 46 478") ou de la première ligne de l'extract.
 *
 * Heuristique simple : split du folderName en mots, on cherche un dossier dont
 * le clientNom contient le 1er mot majuscule (= probable patronyme).
 */
function matchExistingDossier(
  folderName: string,
  hint: string,
  dossiers: Array<{ id: string; ref: string; clientNom?: string; legacyId?: string | null }>,
): { id: string; ref: string } | undefined {
  // 1. Match exact sur legacyId (si l'extract a déjà été importé une fois)
  const legacyMatch = /\b(\d{2,5}[\s_-]?\d{3,5})\b/.exec(folderName)
  if (legacyMatch) {
    const legacy = legacyMatch[1]?.replace(/[\s_-]+/g, ' ').trim()
    if (legacy) {
      const found = dossiers.find((d) => d.legacyId === legacy || d.legacyId === legacyMatch[1])
      if (found) return { id: found.id, ref: found.ref }
    }
  }

  // 2. Match par patronyme majuscule détecté dans folderName ou hint
  const text = `${folderName} ${hint}`
  const nameTokens = text.split(/[\s/_\-,]+/).filter((t) => /^[A-ZÉÈÀÂÊÎÔÛÇ]{3,}/.test(t) && !/^ZZ$|^DIVERS$|^SUMMARY$|^EXTRACT$/i.test(t))
  if (nameTokens.length > 0) {
    const first = nameTokens[0]!.toUpperCase()
    const found = dossiers.find((d) => (d.clientNom ?? '').toUpperCase().includes(first))
    if (found) return { id: found.id, ref: found.ref }
  }

  return undefined
}
