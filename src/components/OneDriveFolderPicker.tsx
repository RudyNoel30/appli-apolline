import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Folder, Search, Loader2, ArrowLeft, Check, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import Modal from './Modal'
import * as drive from '@/o365/onedrive'
import { cn } from '@/lib/utils'

/**
 * Crumb : on garde la trace du driveId à chaque niveau parce qu'on peut
 * naviguer dans des dossiers partagés qui appartiennent à des drives tiers
 * (autre OneDrive ou bibliothèque SharePoint).
 */
type Crumb = { id: string | 'shared'; driveId?: string; name: string }

export type OneDriveSelection = {
  id: string
  driveId?: string
  name: string
  path: string
  webUrl?: string
}

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (selection: OneDriveSelection) => void
}

/**
 * Modale de sélection d'un dossier OneDrive.
 * Démarre sur la liste des dossiers partagés AVEC l'utilisateur (typiquement
 * les dossiers clients que l'équipe partage), pas son OneDrive personnel.
 * Navigation arborescente + recherche fulltext.
 */
export default function OneDriveFolderPicker({ open, onClose, onSelect }: Props) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: 'shared', name: 'Partagés avec moi' }])
  const [items, setItems] = useState<drive.DriveItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // selectedDriveId tracking conservé pour potentiel besoin futur (différencier
  // drive personnel vs partagé). Pour l'instant la valeur n'est pas lue —
  // setter conservé via préfixe _ pour ne pas casser les callsites existants.
  const [, setSelectedDriveId] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<drive.DriveItem[] | null>(null)
  const [searching, setSearching] = useState(false)

  const currentCrumb = crumbs[crumbs.length - 1]

  const loadFolder = async (folder: { id: 'shared' | string; driveId?: string }) => {
    setLoading(true)
    setError(null)
    setSelectedId(null)
    setSelectedDriveId(undefined)
    try {
      const list = folder.id === 'shared'
        ? await drive.listSharedWithMe()
        : await drive.listChildren(folder.id, folder.driveId)
      setItems(list)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[onedrive] load failed', msg)
      const needsReauth =
        msg.includes('consent') || msg.includes('Files.Read') ||
        msg.includes('403') || msg.includes('401') || msg.includes('Non connecté')
      setError(needsReauth
        ? 'Reconnectez votre compte Microsoft (Paramètres → Intégrations) pour autoriser l\'accès aux fichiers.'
        : msg.slice(0, 200))
    } finally {
      setLoading(false)
    }
  }

  // Charge la liste des partages à l'ouverture
  useEffect(() => {
    if (!open) return
    setCrumbs([{ id: 'shared', name: 'Partagés avec moi' }])
    setSearch('')
    setSearchResults(null)
    void loadFolder({ id: 'shared' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Recherche debouncée (300ms)
  useEffect(() => {
    if (!open) return
    const q = search.trim()
    if (!q) { setSearchResults(null); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const list = await drive.search(q)
        setSearchResults(list.filter((i) => drive.isFolder(i)))
      } catch (e) {
        console.warn('[onedrive] search failed', e)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [search, open])

  const enterFolder = (folder: drive.DriveItem) => {
    const ref = drive.effectiveRef(folder)
    setCrumbs((cs) => [...cs, { id: ref.id, driveId: ref.driveId, name: folder.name }])
    setSearch('')
    setSearchResults(null)
    void loadFolder({ id: ref.id, driveId: ref.driveId })
  }

  const goToCrumb = (idx: number) => {
    const target = crumbs[idx]
    setCrumbs(crumbs.slice(0, idx + 1))
    setSearch('')
    setSearchResults(null)
    void loadFolder({ id: target.id, driveId: target.driveId })
  }

  const goUp = () => {
    if (crumbs.length <= 1) return
    goToCrumb(crumbs.length - 2)
  }

  // Sélection : on prend l'item sélectionné dans la liste ou bien le dossier courant
  // (sauf si on est à la racine "Partagés avec moi" → impossible de sélectionner ce niveau).
  const selectableItems = useMemo(() => {
    const source = searchResults ?? items
    return source.filter(drive.isFolder)
  }, [items, searchResults])

  const confirmSelection = async () => {
    let target: drive.DriveItem | null = null
    if (selectedId) {
      target = selectableItems.find((i) => drive.effectiveRef(i).id === selectedId) ?? null
    } else if (currentCrumb.id !== 'shared') {
      // Pas de sous-dossier sélectionné : on prend le dossier courant
      try {
        target = await drive.getItem(currentCrumb.id, currentCrumb.driveId)
      } catch (e) {
        toast.error('Impossible de récupérer le dossier courant', { description: String(e) })
        return
      }
    }
    if (!target) {
      toast.error('Sélectionnez un dossier (ou naviguez à l\'intérieur)')
      return
    }
    const ref = drive.effectiveRef(target)
    onSelect({
      id: ref.id,
      driveId: ref.driveId,
      name: target.name,
      path: drive.pathOf(target),
      webUrl: drive.webUrlOf(target),
    })
    onClose()
  }

  const showingSearch = !!searchResults

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Associer un dossier OneDrive"
      description="Dossiers partagés avec vous · naviguez ou recherchez par nom"
      size="lg"
      actions={
        <>
          <button className="btn-outline" onClick={onClose}>Annuler</button>
          <button
            className="btn-gold"
            onClick={confirmSelection}
            disabled={!selectedId && currentCrumb.id === 'shared'}
          >
            <Check className="h-4 w-4" /> Sélectionner ce dossier
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un dossier (nom du client, référence…)"
            className="input pl-10"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400 animate-spin" />
          )}
        </div>

        {/* Fil d'Ariane (caché en mode recherche) */}
        {!showingSearch && (
          <div className="flex items-center gap-1 text-xs text-navy-600 flex-wrap">
            {crumbs.length > 1 && (
              <button
                onClick={goUp}
                className="h-7 w-7 rounded-md hover:bg-navy-50 flex items-center justify-center"
                title="Dossier parent"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {crumbs.map((c, i) => (
              <div key={`${c.id}-${i}`} className="flex items-center gap-1">
                <button
                  onClick={() => goToCrumb(i)}
                  className={cn(
                    'px-2 py-1 rounded hover:bg-navy-50 flex items-center gap-1',
                    i === crumbs.length - 1 ? 'text-navy-900 font-medium' : 'text-navy-500',
                  )}
                >
                  {i === 0 ? <Share2 className="h-3.5 w-3.5" /> : null}
                  {c.name}
                </button>
                {i < crumbs.length - 1 && <ChevronRight className="h-3 w-3 text-navy-300" />}
              </div>
            ))}
          </div>
        )}

        {/* Liste */}
        {error && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <div className="font-semibold">Impossible de charger</div>
            <div className="mt-0.5">{error}</div>
          </div>
        )}
        {loading ? (
          <div className="py-12 flex items-center justify-center text-navy-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : selectableItems.length === 0 ? (
          <div className="py-12 text-center text-sm text-navy-400 italic">
            {showingSearch
              ? 'Aucun dossier ne correspond à la recherche.'
              : currentCrumb.id === 'shared'
                ? 'Aucun dossier ne vous a été partagé. Demandez à vos collaborateurs de partager le dossier client avec votre adresse.'
                : 'Ce dossier ne contient aucun sous-dossier.'}
          </div>
        ) : (
          <div className="border border-navy-100 rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto scroll-isolated">
            {selectableItems.map((item) => {
              const ref = drive.effectiveRef(item)
              const isSelected = selectedId === ref.id
              const childCount = drive.childCountOf(item)
              return (
                <div
                  key={item.id}
                  onClick={() => { setSelectedId(ref.id); setSelectedDriveId(ref.driveId) }}
                  onDoubleClick={() => enterFolder(item)}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-navy-50 last:border-0 transition',
                    isSelected ? 'bg-gold-50' : 'hover:bg-navy-50',
                  )}
                >
                  <Folder className={cn('h-4 w-4 shrink-0', isSelected ? 'text-gold-600' : 'text-navy-500')} />
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-sm truncate', isSelected ? 'font-semibold text-navy-900' : 'text-navy-800')}>
                      {item.name}
                    </div>
                    {showingSearch && (
                      <div className="text-[11px] text-navy-400 truncate">{drive.pathOf(item)}</div>
                    )}
                    {!showingSearch && childCount != null && (
                      <div className="text-[11px] text-navy-400">
                        {childCount} élément{childCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); enterFolder(item) }}
                    className="opacity-0 group-hover:opacity-100 text-xs text-navy-500 hover:text-navy-900 transition"
                  >
                    Ouvrir →
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-[11px] text-navy-400">
          Astuce : double-clic pour entrer dans un dossier, simple-clic pour le sélectionner.
        </p>
      </div>
    </Modal>
  )
}
