import { useState, useEffect, useCallback, useMemo, useRef, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, Plus, Search, Mail, MailOpen, Star, Trash2, Reply, ReplyAll, Forward,
  Send, X, Paperclip, Inbox, Archive, FileText as FileTextIcon, Tag, ExternalLink, Link as LinkIcon,
  AlertCircle, Loader2, ChevronRight, Folder, Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, Image as ImageIcon, Eraser, Palette, AlignLeft, AlignCenter, AlignRight,
  Smile,
} from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import { useStore, getO365EmailFor } from '@/stores/useStore'
import { useAuth } from '@/auth/AuthContext'
import * as mail from '@/o365/mail'
import * as contacts from '@/o365/contacts'
import type { GraphMail, GraphMailFull, MailFolder } from '@/o365/mail'
import { cn, dateTimeFr } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return 'à l\'instant'
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  if (j < 7) return `il y a ${j} j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')
}

const FOLDER_ICONS: Record<string, any> = {
  Inbox: Inbox,
  'Boîte de réception': Inbox,
  'Sent Items': Send,
  'Éléments envoyés': Send,
  Drafts: FileTextIcon,
  Brouillons: FileTextIcon,
  'Deleted Items': Trash2,
  'Éléments supprimés': Trash2,
  Archive,
}

export default function Messagerie() {
  const navigate = useNavigate()
  const settings = useStore((s) => s.settings)
  const clients = useStore((s) => s.clients)
  const dossiers = useStore((s) => s.dossiers)
  const { currentUser } = useAuth()
  const o365Email = getO365EmailFor(settings, currentUser?.id)
  const [folders, setFolders] = useState<MailFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(() => new Set())
  const [messages, setMessages] = useState<GraphMail[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [currentMessage, setCurrentMessage] = useState<GraphMailFull | null>(null)
  const [search, setSearch] = useState('')
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerInitial, setComposerInitial] = useState<Partial<ComposerState> | null>(null)

  // Map email → client pour auto-lien
  const emailToClient = useMemo(() => {
    const map = new Map<string, typeof clients[number]>()
    clients.forEach((c) => {
      if (c.email) map.set(c.email.toLowerCase(), c)
    })
    return map
  }, [clients])

  const findClientFor = useCallback((m: GraphMail) => {
    const addrs = mail.extractAddresses(m)
    for (const a of addrs) {
      const c = emailToClient.get(a)
      if (c) return c
    }
    return undefined
  }, [emailToClient])

  const findDossierFor = useCallback((clientId: string) => {
    return dossiers.find((d) => d.clientId === clientId && !['Encaisse', 'Abandonne'].includes(d.statut))
      ?? dossiers.find((d) => d.clientId === clientId)
  }, [dossiers])

  const isConnected = !!o365Email

  const loadFolders = useCallback(async () => {
    if (!isConnected) return
    setLoadingFolders(true)
    try {
      const data = await mail.listMailFolders()
      setFolders(data)
      if (!selectedFolderId) {
        // Sélectionne Inbox par défaut
        const inbox = data.find((f) => f.displayName === 'Inbox' || f.displayName === 'Boîte de réception')
        if (inbox) setSelectedFolderId(inbox.id)
      }
    } catch (e: any) {
      toast.error('Impossible de charger les dossiers email', { description: e?.message })
    } finally {
      setLoadingFolders(false)
    }
  }, [isConnected, selectedFolderId])

  const loadMessages = useCallback(async () => {
    if (!isConnected || !selectedFolderId) return
    setLoadingMessages(true)
    try {
      const data = await mail.listMessages({
        folderId: selectedFolderId,
        top: 50,
        search: search.trim() || undefined,
      })
      setMessages(data)
    } catch (e: any) {
      toast.error('Impossible de charger les messages', { description: e?.message })
    } finally {
      setLoadingMessages(false)
    }
  }, [isConnected, selectedFolderId, search])

  const loadMessage = useCallback(async (id: string) => {
    setLoadingMessage(true)
    setCurrentMessage(null)
    try {
      const data = await mail.getMessage(id)
      setCurrentMessage(data)
      // Marque automatiquement comme lu
      if (!data.isRead) {
        await mail.setMessageRead(id, true)
        setMessages((ms) => ms.map((m) => m.id === id ? { ...m, isRead: true } : m))
      }
    } catch (e: any) {
      toast.error('Impossible d\'ouvrir le message', { description: e?.message })
    } finally {
      setLoadingMessage(false)
    }
  }, [])

  useEffect(() => { loadFolders() }, [loadFolders])
  useEffect(() => { loadMessages() }, [loadMessages])
  useEffect(() => {
    if (selectedMessageId) loadMessage(selectedMessageId)
  }, [selectedMessageId, loadMessage])

  // Auto-refresh toutes les 3 min
  useEffect(() => {
    if (!isConnected || !selectedFolderId) return
    const interval = setInterval(loadMessages, 3 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadMessages, isConnected, selectedFolderId])

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    loadMessages()
  }

  // Document complet (srcDoc) pour l'iframe du viewer.
  // Mémoïsé sur l'ID du message + contenu du body : recalculé uniquement quand on change de mail,
  // pas à chaque rendu du parent (sinon scroll laggué sur signatures avec gros logos base64).
  const messageSrcDoc = useMemo(() => {
    if (!currentMessage) return ''
    if (currentMessage.body.contentType !== 'html') return ''
    const inlined = mail.inlineCidImages(currentMessage.body.content, currentMessage.attachments)
    const sanitized = sanitizeHtml(inlined)
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<base target="_blank" />
<style>
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
    font-size: 14px;
    line-height: 1.55;
    color: #1a2540;
    padding: 18px 22px;
    background: #ffffff;
  }
  img { max-width: 100%; height: auto; }
  a { color: #b8860b; }
  blockquote { border-left: 3px solid #cbd5e1; padding-left: 12px; color: #475569; margin: 8px 0; }
  table { border-collapse: collapse; max-width: 100%; }
  td, th { border: 1px solid #e2e8f0; padding: 4px 8px; }
  pre { white-space: pre-wrap; word-wrap: break-word; }
  /* Scrollbars discrètes */
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 5px; }
  ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>
</head>
<body>${sanitized}</body>
</html>`
  }, [currentMessage?.id, currentMessage?.body?.content, currentMessage?.body?.contentType, currentMessage?.attachments])

  const onDelete = async (id: string) => {
    try {
      await mail.deleteMessage(id)
      setMessages((ms) => ms.filter((m) => m.id !== id))
      if (selectedMessageId === id) {
        setSelectedMessageId(null)
        setCurrentMessage(null)
      }
      toast.success('Message déplacé dans Éléments supprimés')
    } catch (e: any) {
      toast.error('Suppression échouée', { description: e?.message })
    }
  }

  const openReply = (replyAll = false) => {
    if (!currentMessage) return
    const fromAddr = currentMessage.from?.emailAddress.address
    const myEmail = o365Email?.toLowerCase()
    // Reply All : Cc = (toRecipients + ccRecipients) du message original,
    // moins moi-même et l'expéditeur (déjà en To)
    let ccAddrs: string[] = []
    if (replyAll) {
      const tos = currentMessage.toRecipients?.map((r) => r.emailAddress.address) ?? []
      const ccs = currentMessage.ccRecipients?.map((r) => r.emailAddress.address) ?? []
      const all = [...tos, ...ccs]
      const seen = new Set<string>()
      ccAddrs = all
        .map((a) => a.toLowerCase())
        .filter((a) => {
          if (!a) return false
          if (a === myEmail) return false
          if (a === fromAddr?.toLowerCase()) return false
          if (seen.has(a)) return false
          seen.add(a)
          return true
        })
    }
    setComposerInitial({
      to: fromAddr ? [fromAddr] : [],
      cc: ccAddrs,
      subject: currentMessage.subject.startsWith('Re:') ? currentMessage.subject : `Re: ${currentMessage.subject}`,
      body: buildReplyBody({
        fromName: currentMessage.from?.emailAddress.name,
        fromAddr,
        date: currentMessage.receivedDateTime,
        subject: currentMessage.subject,
        originalHtml: currentMessage.body.content,
        originalContentType: currentMessage.body.contentType,
        intro: '',
      }),
    })
    setComposerOpen(true)
  }

  if (!isConnected) {
    return (
      <>
        <PageHeader eyebrow="Communication" title="Messagerie" description="Connexion Microsoft 365 requise" />
        <div className="card p-8 text-center">
          <Mail className="h-12 w-12 text-navy-300 mx-auto mb-4" />
          <h3 className="font-serif text-lg text-navy-900 mb-2">Connectez votre compte Microsoft 365</h3>
          <p className="text-sm text-navy-500 mb-6">
            La messagerie utilise la même connexion Outlook que l'agenda.<br />
            Connectez-vous depuis Paramètres → Intégrations.
          </p>
          <button className="btn-gold" onClick={() => navigate('/parametres')}>
            <ExternalLink className="h-4 w-4" /> Aller aux paramètres
          </button>
        </div>
      </>
    )
  }

  const inboxFolder = folders.find((f) => f.displayName === 'Inbox' || f.displayName === 'Boîte de réception')
  const totalUnread = inboxFolder?.unreadItemCount ?? 0

  // Filtre les dossiers cachés sous un ancêtre replié (parcours de la chaîne parentFolderId).
  const folderById = useMemo(
    () => Object.fromEntries(folders.map((f) => [f.id, f])) as Record<string, MailFolder>,
    [folders],
  )
  const isFolderHidden = (f: MailFolder): boolean => {
    let pid = f.parentFolderId
    while (pid) {
      if (collapsedFolderIds.has(pid)) return true
      pid = folderById[pid]?.parentFolderId
    }
    return false
  }
  const toggleCollapse = (id: string) => {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const visibleFolders = folders.filter((f) => !isFolderHidden(f))

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Messagerie"
        description={`${o365Email} · ${totalUnread} non lu${totalUnread > 1 ? 's' : ''}`}
        actions={
          <>
            <button className="btn-outline" onClick={() => { loadFolders(); loadMessages() }}>
              <RefreshCw className={cn('h-4 w-4', (loadingMessages || loadingFolders) && 'animate-spin')} /> Actualiser
            </button>
            <button className="btn-gold" onClick={() => { setComposerInitial(null); setComposerOpen(true) }}>
              <Plus className="h-4 w-4" /> Nouveau message
            </button>
          </>
        }
      />

      <div className="page-body grid grid-cols-12 gap-4">
        {/* Col 1 — Dossiers Outlook */}
        <div className="col-span-2 card p-2 self-start max-h-[calc(100vh-180px)] overflow-y-auto scroll-isolated">
          <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold px-3 py-2">Dossiers</div>
          <nav className="space-y-0.5 list-fast-sm">
            {loadingFolders && <div className="px-3 py-2 text-xs text-navy-400">Chargement…</div>}
            {visibleFolders.map((f) => {
              const depth = f.depth ?? 0
              const Icon = depth === 0 ? (FOLDER_ICONS[f.displayName] ?? Mail) : Folder
              const isActive = f.id === selectedFolderId
              const hasChildren = f.childFolderCount > 0
              const isCollapsed = collapsedFolderIds.has(f.id)
              return (
                <button
                  key={f.id}
                  onClick={() => { setSelectedFolderId(f.id); setSelectedMessageId(null) }}
                  style={{ paddingLeft: `${4 + depth * 14}px` }}
                  className={cn(
                    'w-full flex items-center gap-1.5 pr-3 py-2 rounded-md text-sm text-left transition',
                    isActive ? 'bg-navy-900 text-white' : 'text-navy-700 hover:bg-navy-50',
                    depth > 0 && !isActive && 'text-navy-600',
                  )}
                  title={f.displayName}
                >
                  {hasChildren ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); toggleCollapse(f.id) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); toggleCollapse(f.id) } }}
                      className={cn(
                        'shrink-0 h-5 w-5 -ml-0.5 rounded flex items-center justify-center transition-colors',
                        isActive ? 'hover:bg-white/10' : 'hover:bg-navy-100',
                      )}
                      aria-label={isCollapsed ? 'Déplier' : 'Replier'}
                    >
                      <ChevronRight
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          !isCollapsed && 'rotate-90',
                          isActive ? 'text-white/80' : 'text-navy-400',
                        )}
                      />
                    </span>
                  ) : (
                    <span className="shrink-0 w-5" />
                  )}
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-gold-400' : depth === 0 ? 'text-navy-500' : 'text-navy-400')} />
                  <span className={cn('flex-1 truncate', depth > 0 && 'text-[13px]')}>{f.displayName}</span>
                  {f.unreadItemCount > 0 && (
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0',
                      isActive ? 'bg-gold-500 text-navy-900' : 'bg-gold-100 text-gold-800',
                    )}>{f.unreadItemCount}</span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Col 2 — Liste messages */}
        <div className="col-span-4 card p-0 overflow-hidden flex flex-col">
          <form onSubmit={onSearchSubmit} className="p-3 border-b border-navy-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher dans les messages…"
                className="input pl-10 py-2"
              />
            </div>
          </form>
          <div className="flex-1 overflow-y-auto scroll-isolated">
            {loadingMessages && messages.length === 0 && (
              <div className="p-8 text-center text-sm text-navy-400">
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" /> Chargement…
              </div>
            )}
            {!loadingMessages && messages.length === 0 && (
              <div className="p-8 text-center text-sm text-navy-400 italic">Aucun message</div>
            )}
            <div className="list-fast">
            {messages.map((m) => {
              const linkedClient = findClientFor(m)
              const isSelected = m.id === selectedMessageId
              const fromName = m.from?.emailAddress.name || m.from?.emailAddress.address || '—'
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMessageId(m.id)}
                  className={cn(
                    'w-full text-left px-3 py-3 border-b border-navy-50 transition-colors duration-150 relative',
                    isSelected ? 'bg-gold-50 border-l-4 border-l-gold-500' : 'hover:bg-navy-50/60',
                    !m.isRead && !isSelected && 'bg-white',
                  )}
                >
                  {!m.isRead && <span className="absolute left-1 top-4 h-2 w-2 rounded-full bg-gold-500" />}
                  <div className="flex items-start gap-2 mb-1">
                    <div className="h-8 w-8 rounded-full bg-navy-100 text-navy-700 flex items-center justify-center font-semibold text-[10px] shrink-0">
                      {initials(fromName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('text-sm truncate', m.isRead ? 'font-medium text-navy-700' : 'font-bold text-navy-900')}>
                          {fromName}
                        </span>
                        <span className="text-[10px] text-navy-400 shrink-0">{relativeTime(m.receivedDateTime)}</span>
                      </div>
                      <div className={cn('text-xs truncate mt-0.5', m.isRead ? 'text-navy-600' : 'text-navy-900 font-semibold')}>
                        {m.subject || '(sans objet)'}
                      </div>
                      <div className="text-[11px] text-navy-400 truncate mt-0.5">{m.bodyPreview}</div>
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {linkedClient && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <LinkIcon className="h-2.5 w-2.5" />
                            {linkedClient.prenom} {linkedClient.nom}
                          </span>
                        )}
                        {m.hasAttachments && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-navy-500">
                            <Paperclip className="h-2.5 w-2.5" /> PJ
                          </span>
                        )}
                        {m.flag?.flagStatus === 'flagged' && (
                          <Star className="h-3 w-3 text-amber-500 fill-amber-400" />
                        )}
                        {m.importance === 'high' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-700 bg-rose-50 px-1 py-0.5 rounded">
                            <AlertCircle className="h-2.5 w-2.5" /> Important
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
            </div>
          </div>
        </div>

        {/* Col 3 — Viewer message */}
        <div className="col-span-6 card p-0 overflow-hidden flex flex-col">
          {!selectedMessageId && (
            <div className="flex-1 flex items-center justify-center text-center text-sm text-navy-400 p-8">
              <div>
                <MailOpen className="h-12 w-12 mx-auto mb-3 text-navy-300" />
                Sélectionnez un message pour le lire
              </div>
            </div>
          )}
          {loadingMessage && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-navy-400" />
            </div>
          )}
          {currentMessage && !loadingMessage && (() => {
            const linkedClient = findClientFor(currentMessage)
            const linkedDossier = linkedClient ? findDossierFor(linkedClient.id) : undefined
            return (
              <>
                <div className="p-5 border-b border-navy-100">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h2 className="font-serif text-lg text-navy-900 flex-1">{currentMessage.subject || '(sans objet)'}</h2>
                    <button onClick={() => onDelete(currentMessage.id)} className="h-8 w-8 rounded-md hover:bg-rose-50 flex items-center justify-center text-navy-400 hover:text-rose-700 transition" title="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-navy-100 text-navy-700 flex items-center justify-center font-semibold text-sm shrink-0">
                      {initials(currentMessage.from?.emailAddress.name || '—')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-navy-900">
                        {currentMessage.from?.emailAddress.name || ''}
                      </div>
                      <div className="text-xs text-navy-500">
                        {currentMessage.from?.emailAddress.address}
                      </div>
                      <div className="text-xs text-navy-500 mt-1">
                        Pour : {currentMessage.toRecipients?.map((r) => r.emailAddress.name || r.emailAddress.address).join(', ')}
                      </div>
                      {currentMessage.ccRecipients && currentMessage.ccRecipients.length > 0 && (
                        <div className="text-xs text-navy-500">
                          Cc : {currentMessage.ccRecipients.map((r) => r.emailAddress.name || r.emailAddress.address).join(', ')}
                        </div>
                      )}
                      <div className="text-[11px] text-navy-400 mt-1">{dateTimeFr(currentMessage.receivedDateTime)}</div>
                    </div>
                  </div>
                  {linkedClient && (
                    <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <LinkIcon className="h-4 w-4 text-emerald-700 shrink-0" />
                      <div className="flex-1 text-xs">
                        <strong className="text-emerald-900">Lié à {linkedClient.prenom} {linkedClient.nom}</strong>
                        {linkedDossier && <span className="text-emerald-700"> · Dossier {linkedDossier.ref}</span>}
                      </div>
                      {linkedDossier && (
                        <button
                          onClick={() => navigate(`/dossiers/${linkedDossier.id}`)}
                          className="btn-outline text-xs h-7 px-2"
                        >
                          Ouvrir le dossier <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                  {currentMessage.attachments && currentMessage.attachments.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {currentMessage.attachments.filter((a) => !a.isInline).map((a) => (
                        <button
                          key={a.id}
                          onClick={async () => {
                            try {
                              const b64 = await mail.getAttachmentContent(currentMessage.id, a.id)
                              const blob = b64ToBlob(b64, a.contentType)
                              const url = URL.createObjectURL(blob)
                              const link = document.createElement('a')
                              link.href = url
                              link.download = a.name
                              link.click()
                              URL.revokeObjectURL(url)
                              toast.success(`${a.name} téléchargé`)
                            } catch (e: any) {
                              toast.error('Téléchargement PJ échoué', { description: e?.message })
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-navy-200 hover:bg-navy-50 text-xs"
                        >
                          <Paperclip className="h-3 w-3" />
                          {a.name}
                          <span className="text-navy-400">({Math.round(a.size / 1024)} ko)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden bg-white">
                  {currentMessage.body.contentType === 'html' ? (
                    <iframe
                      key={currentMessage.id}
                      title="Corps du message"
                      srcDoc={messageSrcDoc}
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                      referrerPolicy="no-referrer"
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-navy-800 font-sans p-5 h-full overflow-y-auto">{currentMessage.body.content}</pre>
                  )}
                </div>
                <div className="p-4 border-t border-navy-100 flex items-center gap-2">
                  <button onClick={() => openReply(false)} className="btn-primary"><Reply className="h-4 w-4" /> Répondre</button>
                  <button onClick={() => openReply(true)} className="btn-outline"><ReplyAll className="h-4 w-4" /> Répondre à tous</button>
                  <button
                    onClick={() => {
                      setComposerInitial({
                        to: [],
                        subject: `Tr: ${currentMessage.subject}`,
                        body: buildReplyBody({
                          fromName: currentMessage.from?.emailAddress.name,
                          fromAddr: currentMessage.from?.emailAddress.address,
                          date: currentMessage.receivedDateTime,
                          subject: currentMessage.subject,
                          originalHtml: currentMessage.body.content,
                          originalContentType: currentMessage.body.contentType,
                          intro: 'Message transféré',
                        }),
                      })
                      setComposerOpen(true)
                    }}
                    className="btn-outline"
                  >
                    <Forward className="h-4 w-4" /> Transférer
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {composerOpen && (
        <Composer
          initial={composerInitial}
          onClose={() => { setComposerOpen(false); setComposerInitial(null) }}
          onSent={() => {
            setComposerOpen(false)
            setComposerInitial(null)
            // Recharge la liste pour récupérer le mail dans Sent
            setTimeout(loadMessages, 1500)
          }}
        />
      )}
    </>
  )
}

/* ───────────────────── Composer ───────────────────── */

type AttachmentDraft = {
  name: string
  contentBytes: string // base64 sans préfixe data:
  contentType: string
  size: number
}

type ComposerState = {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  body: string // HTML
  apollineDossierRef?: string
  attachments: AttachmentDraft[]
}

type Suggestion = { email: string; name?: string; source: 'client' | 'outlook' }

function Composer({
  initial,
  onClose,
  onSent,
}: {
  initial?: Partial<ComposerState> | null
  onClose: () => void
  onSent: () => void
}) {
  const clients = useStore((s) => s.clients)
  const dossiers = useStore((s) => s.dossiers)
  const settings = useStore((s) => s.settings)
  const { currentUser } = useAuth()
  const o365Email = getO365EmailFor(settings, currentUser?.id)

  const [outlookContacts, setOutlookContacts] = useState<contacts.Contact[]>([])
  const [contactsError, setContactsError] = useState<string | null>(null)
  useEffect(() => {
    if (!o365Email) return
    let cancelled = false
    setContactsError(null)
    contacts.listContacts()
      .then((list) => list.map(contacts.graphToContact).filter((c) => !!c.email))
      .then((mapped) => {
        if (cancelled) return
        setOutlookContacts(mapped)
        console.log('[contacts] loaded', mapped.length, 'Outlook contacts')
      })
      .catch((e) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        console.warn('[contacts] load failed', msg)
        // Cause classique : permission Contacts.Read absente (ajoutée récemment
        // au scope MSAL, le token actuel ne l'a pas → Graph répond 401/403 ou
        // acquireTokenSilent échoue avec consent_required).
        const needsReauth =
          msg.includes('consent') ||
          msg.includes('Contacts.Read') ||
          msg.includes('403') ||
          msg.includes('401') ||
          msg.includes('Non connecté')
        setContactsError(needsReauth
          ? 'Reconnectez votre compte Microsoft (Paramètres → Intégrations) pour autoriser l\'accès aux contacts.'
          : `Contacts Outlook indisponibles : ${msg.slice(0, 120)}`)
      })
    return () => { cancelled = true }
  }, [o365Email])

  const recipientSuggestions = useMemo<Suggestion[]>(() => {
    const seen = new Set<string>()
    const out: Suggestion[] = []
    for (const c of clients) {
      if (!c.email) continue
      const key = c.email.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ email: c.email, name: `${c.prenom} ${c.nom}`.trim(), source: 'client' })
    }
    for (const c of outlookContacts) {
      if (!c.email) continue
      const key = c.email.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const name = `${c.prenom} ${c.nom}`.trim() || undefined
      out.push({ email: c.email, name, source: 'outlook' })
    }
    return out
  }, [clients, outlookContacts])

  // Construit le corps initial avec injection automatique de la signature.
  // - Nouveau mail (initial.body vide) : <p><br/></p> + signature
  // - Réponse / Transfert (body = quote) : on insère la signature ENTRE l'espace de saisie et la citation
  const buildInitialBody = (): string => {
    const sigEnabled = currentUser?.signatureAutoInsert !== false
    const sig = sigEnabled && currentUser?.signatureHtml
      ? `<div class="apolline-signature" style="margin-top:12px;">${currentUser.signatureHtml}</div>`
      : ''
    if (!initial?.body) {
      // Nouveau message : zone de saisie + signature
      return `<p><br/></p>${sig}`
    }
    // Reply/Forward : initial.body commence déjà par <p><br/></p> (cf. buildReplyBody)
    // On injecte la signature juste après cette ligne vide, avant la citation
    const cursorBlock = '<p><br/></p>'
    if (initial.body.startsWith(cursorBlock)) {
      return cursorBlock + sig + initial.body.slice(cursorBlock.length)
    }
    return sig + initial.body
  }

  const [s, setS] = useState<ComposerState>({
    to: initial?.to ?? [],
    cc: initial?.cc ?? [],
    bcc: initial?.bcc ?? [],
    subject: initial?.subject ?? '',
    body: buildInitialBody(),
    apollineDossierRef: initial?.apollineDossierRef,
    attachments: initial?.attachments ?? [],
  })
  const [showCc, setShowCc] = useState((initial?.cc?.length ?? 0) > 0)
  const [showBcc, setShowBcc] = useState((initial?.bcc?.length ?? 0) > 0)
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const send = async () => {
    if (s.to.length === 0) {
      toast.error('Renseignez au moins un destinataire')
      return
    }
    if (!s.subject.trim()) {
      toast.error('Renseignez un sujet')
      return
    }
    setSending(true)
    try {
      await mail.sendMail({
        to: s.to,
        cc: s.cc.length ? s.cc : undefined,
        bcc: s.bcc.length ? s.bcc : undefined,
        subject: s.subject,
        body: s.body || '<br/>',
        isHtml: true,
        apollineDossierRef: s.apollineDossierRef,
        category: s.apollineDossierRef ? `Apolline · ${s.apollineDossierRef}` : undefined,
        attachments: s.attachments.length ? s.attachments.map((a) => ({
          name: a.name,
          contentBytes: a.contentBytes,
          contentType: a.contentType,
        })) : undefined,
      })
      toast.success('Message envoyé')
      onSent()
    } catch (e: any) {
      toast.error('Envoi échoué', { description: e?.message })
    } finally {
      setSending(false)
    }
  }

  // Suggestion de dossier basé sur le destinataire
  const suggestedDossier = useMemo(() => {
    for (const addr of s.to) {
      const client = clients.find((c) => c.email.toLowerCase() === addr.toLowerCase())
      if (client) {
        const d = dossiers.find((dd) => dd.clientId === client.id && !['Encaisse', 'Abandonne'].includes(dd.statut))
        if (d) return d
      }
    }
    return undefined
  }, [clients, dossiers, s.to])

  useEffect(() => {
    if (suggestedDossier && !s.apollineDossierRef) {
      setS((prev) => ({ ...prev, apollineDossierRef: suggestedDossier.ref }))
    }
  }, [suggestedDossier, s.apollineDossierRef])

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files)
    const MAX_SIZE = 25 * 1024 * 1024 // 25 MB par PJ (limite Outlook ~ 35 MB total)
    const newOnes: AttachmentDraft[] = []
    for (const f of arr) {
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} dépasse 25 Mo`, { description: 'Limite Outlook atteinte.' })
        continue
      }
      const b64 = await fileToBase64(f)
      newOnes.push({ name: f.name, contentBytes: b64, contentType: f.type || 'application/octet-stream', size: f.size })
    }
    if (newOnes.length) {
      setS((prev) => ({ ...prev, attachments: [...prev.attachments, ...newOnes] }))
      toast.success(`${newOnes.length} pièce${newOnes.length > 1 ? 's' : ''} jointe${newOnes.length > 1 ? 's' : ''} ajoutée${newOnes.length > 1 ? 's' : ''}`)
    }
  }

  const removeAttachment = (idx: number) => {
    setS((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))
  }

  const totalAttachmentsSize = s.attachments.reduce((sum, a) => sum + a.size, 0)

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouveau message"
      description={s.apollineDossierRef ? `Lié au dossier ${s.apollineDossierRef}` : undefined}
      size="xl"
      actions={
        <>
          <button className="btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn-gold" onClick={send} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {contactsError && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
            <div className="flex-1">
              <div className="font-semibold">Contacts Outlook indisponibles</div>
              <div className="mt-0.5">{contactsError}</div>
              <div className="mt-1 text-amber-700">
                {outlookContacts.length === 0 && clients.length > 0 ? `Suggestions limitées aux ${clients.length} clients Apolline.` : ''}
              </div>
            </div>
          </div>
        )}
        <RecipientField label="À" value={s.to} onChange={(v) => setS({ ...s, to: v })} suggestions={recipientSuggestions} />
        {showCc ? (
          <RecipientField label="Cc" value={s.cc} onChange={(v) => setS({ ...s, cc: v })} suggestions={recipientSuggestions} />
        ) : (
          <button onClick={() => setShowCc(true)} className="text-xs text-gold-700 hover:text-gold-800">+ Ajouter Cc</button>
        )}
        {showBcc ? (
          <RecipientField label="Cci" value={s.bcc} onChange={(v) => setS({ ...s, bcc: v })} suggestions={recipientSuggestions} />
        ) : !showCc ? null : (
          <button onClick={() => setShowBcc(true)} className="text-xs text-gold-700 hover:text-gold-800">+ Ajouter Cci</button>
        )}
        <div>
          <label className="label">Sujet</label>
          <input
            type="text"
            value={s.subject}
            onChange={(e) => setS({ ...s, subject: e.target.value })}
            className="input"
          />
        </div>

        <div>
          <label className="label">Message</label>
          <RichEditor
            value={s.body}
            onChange={(html) => setS((prev) => ({ ...prev, body: html }))}
            onAttachFile={() => fileInputRef.current?.click()}
            onPasteFiles={handleFiles}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {/* Liste des PJ (hors images inline) */}
        {s.attachments.length > 0 && (
          <div className="rounded-lg bg-ivory border border-navy-100 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-navy-700 inline-flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                {s.attachments.length} pièce{s.attachments.length > 1 ? 's' : ''} jointe{s.attachments.length > 1 ? 's' : ''}
                <span className="text-navy-400 font-normal">· {formatBytes(totalAttachmentsSize)}</span>
              </span>
              {totalAttachmentsSize > 30 * 1024 * 1024 && (
                <span className="text-[10px] text-amber-700 font-semibold">⚠ Limite Outlook (~35 Mo)</span>
              )}
            </div>
            <div className="space-y-1">
              {s.attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded border border-navy-50 text-sm">
                  <FileTextIcon className="h-4 w-4 text-navy-400 shrink-0" />
                  <span className="flex-1 truncate text-navy-800">{a.name}</span>
                  <span className="text-[11px] text-navy-400 shrink-0">{formatBytes(a.size)}</span>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="h-6 w-6 rounded hover:bg-rose-50 text-navy-400 hover:text-rose-700 flex items-center justify-center"
                    title="Retirer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {suggestedDossier && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs flex items-center gap-2">
            <Tag className="h-4 w-4 text-emerald-700 shrink-0" />
            <div className="flex-1">
              <span className="text-emerald-900">Ce message sera tagué <strong>Apolline · {suggestedDossier.ref}</strong> dans Outlook (catégorie + en-tête X-Apolline-Dossier) — visible dans le dossier Apolline.</span>
            </div>
            <label className="flex items-center gap-1 text-emerald-800">
              <input
                type="checkbox"
                checked={!!s.apollineDossierRef}
                onChange={(e) => setS({ ...s, apollineDossierRef: e.target.checked ? suggestedDossier.ref : undefined })}
                className="accent-emerald-600"
              />
              Activer
            </label>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ───────────────────── Rich text editor (style Outlook) ───────────────────── */

const PALETTE_COLORS = [
  '#0a1f3d', '#1f3a7a', '#3a5fbe', '#0e7c66', '#0a8a4f',
  '#b8860b', '#c47511', '#b54708', '#9b1c1c', '#86198f',
  '#000000', '#525252', '#a3a3a3', '#d4d4d4', '#ffffff',
]

/** Catalogue emojis (sélection pertinente courtage / business / réactions courantes) */
const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: 'Visages', emojis: ['😀', '😃', '😄', '😁', '😊', '🙂', '😉', '😎', '🤩', '🥳', '😇', '🤗', '🤔', '🧐', '🙃', '😅', '😂', '🤣', '😢', '😟', '😕', '😬', '😱', '😡', '🤯', '😴'] },
  { label: 'Mains & gestes', emojis: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '👌', '✌️', '👋', '💪', '🤞', '👉', '👈', '☝️', '✍️', '🤙'] },
  { label: 'Cœurs', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💝', '💘', '💕', '💞', '💔'] },
  { label: 'Drapeaux & symboles', emojis: ['✅', '❌', '⭐', '🌟', '✨', '⚡', '🔥', '💯', '🎉', '🎊', '🎁', '🏆', '🥇', '🥈', '🥉', '🚀', '💡', '⚠️', '🚫', '🆗'] },
  { label: 'Business', emojis: ['💼', '📁', '📂', '📊', '📈', '📉', '📅', '📆', '🗓️', '📋', '📌', '📍', '✏️', '🖊️', '🖋️', '📎', '🔗', '📞', '☎️', '📱', '💻', '🖥️', '⌨️', '🖱️', '💰', '💵', '💴', '💶', '💷', '🏦', '🏠', '🏡', '🏢', '🏛️', '🔑', '🗝️'] },
  { label: 'Heure & flèches', emojis: ['⏰', '⏱️', '⏳', '🕐', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '🔄', '🔃', '✔️', '✖️'] },
]

function RichEditor({
  value,
  onChange,
  onAttachFile,
  onPasteFiles,
}: {
  value: string
  onChange: (html: string) => void
  onAttachFile: () => void
  onPasteFiles: (files: File[]) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileImageRef = useRef<HTMLInputElement>(null)
  const [colorOpen, setColorOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const savedRangeRef = useRef<Range | null>(null)

  // Sauvegarde la position du curseur dans l'éditeur (pour le picker emoji)
  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }
  const restoreSelection = () => {
    if (!editorRef.current) return
    editorRef.current.focus()
    if (savedRangeRef.current) {
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(savedRangeRef.current)
    }
  }
  const insertEmoji = (emoji: string) => {
    restoreSelection()
    document.execCommand('insertText', false, emoji)
    if (editorRef.current) onChange(editorRef.current.innerHTML)
    saveSelection()
  }

  // Initialise le contenu seulement au montage (sinon on perd le curseur à chaque keystroke)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, arg)
    if (editorRef.current) onChange(editorRef.current.innerHTML)
  }

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML)
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    // 1) Détecte les images dans le presse-papier (capture d'écran, copie d'image, etc.)
    const imageFiles: File[] = []
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) imageFiles.push(f)
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault()
      // Insère les images en base64 inline dans le corps (data:URL)
      for (const file of imageFiles) {
        const dataUrl = await fileToDataUrl(file)
        // Limite à 1 Mo par image inline pour éviter les body trop lourds
        if (file.size > 1024 * 1024) {
          // Au-delà de 1 Mo on bascule en pièce jointe (passe au handler parent)
          onPasteFiles([file])
        } else {
          insertHtmlAtCursor(`<img src="${dataUrl}" style="max-width:100%;height:auto;" />`)
        }
      }
      if (editorRef.current) onChange(editorRef.current.innerHTML)
      return
    }

    // 2) Détecte les fichiers non-image (PDF, Word, etc.) → pièces jointes
    const otherFiles: File[] = []
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && !item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) otherFiles.push(f)
      }
    }
    if (otherFiles.length > 0) {
      e.preventDefault()
      onPasteFiles(otherFiles)
      return
    }

    // 3) Sinon, paste texte normal — on intercepte pour nettoyer le HTML
    const html = e.clipboardData?.getData('text/html')
    const text = e.clipboardData?.getData('text/plain')
    if (html) {
      e.preventDefault()
      // Sanitization basique du HTML collé (supprime scripts, styles dangereux)
      const cleaned = sanitizePastedHtml(html)
      insertHtmlAtCursor(cleaned)
      if (editorRef.current) onChange(editorRef.current.innerHTML)
    } else if (text) {
      // Laisse le navigateur gérer le texte brut
    }
  }

  const handleImagePicker = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      if (file.size > 1024 * 1024) {
        // Trop gros pour inline → pièce jointe
        onPasteFiles([file])
      } else {
        const dataUrl = await fileToDataUrl(file)
        insertHtmlAtCursor(`<img src="${dataUrl}" style="max-width:100%;height:auto;" />`)
      }
    }
    if (editorRef.current) onChange(editorRef.current.innerHTML)
  }

  const insertLink = () => {
    const url = window.prompt('Adresse du lien (https://…)')
    if (!url) return
    exec('createLink', url)
  }

  return (
    <div className="rounded-lg border border-navy-200 focus-within:border-gold-400 focus-within:ring-2 focus-within:ring-gold-200 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-navy-100 bg-ivory/60">
        <ToolBtn onClick={() => exec('bold')} title="Gras (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('italic')} title="Italique (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('underline')} title="Souligné (Ctrl+U)"><Underline className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('strikeThrough')} title="Barré"><Strikethrough className="h-3.5 w-3.5" /></ToolBtn>
        <Sep />
        <ToolBtn onClick={() => exec('insertUnorderedList')} title="Liste à puces"><List className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('insertOrderedList')} title="Liste numérotée"><ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
        <Sep />
        <ToolBtn onClick={() => exec('justifyLeft')} title="Aligner à gauche"><AlignLeft className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('justifyCenter')} title="Centrer"><AlignCenter className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('justifyRight')} title="Aligner à droite"><AlignRight className="h-3.5 w-3.5" /></ToolBtn>
        <Sep />
        <select
          onChange={(e) => { exec('fontSize', e.target.value); e.target.value = '' }}
          className="h-7 text-xs rounded border border-navy-200 bg-white px-1 hover:border-gold-400"
          title="Taille"
          defaultValue=""
        >
          <option value="" disabled>Taille</option>
          <option value="2">Petit</option>
          <option value="3">Normal</option>
          <option value="4">Moyen</option>
          <option value="5">Grand</option>
          <option value="6">Très grand</option>
        </select>
        <div className="relative">
          <ToolBtn onClick={() => setColorOpen((v) => !v)} title="Couleur du texte">
            <Palette className="h-3.5 w-3.5" />
          </ToolBtn>
          {colorOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 card shadow-raised p-2 grid grid-cols-5 gap-1">
              {PALETTE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { exec('foreColor', c); setColorOpen(false) }}
                  className="h-5 w-5 rounded border border-navy-200 hover:scale-110 transition"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          )}
        </div>
        <Sep />
        <div className="relative">
          <ToolBtn onClick={() => { saveSelection(); setEmojiOpen((v) => !v) }} title="Emojis">
            <Smile className="h-3.5 w-3.5" />
          </ToolBtn>
          {emojiOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 card shadow-raised p-2 w-[320px] max-h-[300px] overflow-y-auto scroll-isolated">
              {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.label} className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold mb-1 px-1">{cat.label}</div>
                  <div className="grid grid-cols-10 gap-0.5">
                    {cat.emojis.map((emo) => (
                      <button
                        key={emo}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); insertEmoji(emo) }}
                        className="h-7 w-7 flex items-center justify-center text-lg rounded hover:bg-gold-100 transition"
                        title={emo}
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-1 border-t border-navy-100">
                <button onClick={() => setEmojiOpen(false)} className="text-[11px] text-navy-500 hover:text-navy-900 px-2 py-0.5">Fermer</button>
              </div>
            </div>
          )}
        </div>
        <ToolBtn onClick={insertLink} title="Insérer un lien"><LinkIcon className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => fileImageRef.current?.click()} title="Insérer une image">
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <input
          ref={fileImageRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleImagePicker(e.target.files); e.target.value = '' }}
        />
        <Sep />
        <ToolBtn onClick={() => exec('removeFormat')} title="Effacer la mise en forme"><Eraser className="h-3.5 w-3.5" /></ToolBtn>
        <div className="flex-1" />
        <ToolBtn onClick={onAttachFile} title="Joindre un fichier">
          <Paperclip className="h-3.5 w-3.5" />
          <span className="text-[11px] ml-1">PJ</span>
        </ToolBtn>
      </div>

      {/* Zone éditable */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
        className="rich-editor min-h-[280px] max-h-[420px] overflow-y-auto p-3 text-sm text-navy-900 outline-none"
        data-placeholder="Bonjour, …"
        style={{ lineHeight: 1.5 }}
      />
    </div>
  )
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className="h-7 px-1.5 rounded hover:bg-navy-100 text-navy-700 hover:text-navy-900 inline-flex items-center justify-center transition"
      title={title}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <span className="h-5 w-px bg-navy-200 mx-1" />
}

function RecipientField({
  label, value, onChange, suggestions,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  suggestions: Suggestion[]
}) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Filtre par nom OU email, exclut ce qui est déjà sélectionné, max 8 résultats.
  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase()
    const selected = new Set(value.map((v) => v.toLowerCase()))
    const pool = suggestions.filter((s) => !selected.has(s.email.toLowerCase()))
    if (!q) return pool.slice(0, 8)
    return pool.filter((s) =>
      s.email.toLowerCase().includes(q) || (s.name?.toLowerCase().includes(q))
    ).slice(0, 8)
  }, [input, suggestions, value])

  const add = (email: string) => {
    const e = email.trim().toLowerCase()
    if (e && !value.includes(e)) onChange([...value, e])
    setInput('')
    setShowSuggestions(false)
  }

  const remove = (email: string) => onChange(value.filter((v) => v !== email))

  // Affichage chip : on cherche le nom dans les suggestions (si disponible) pour
  // afficher "Prénom Nom" plutôt qu'un email brut.
  const labelFor = (email: string): string => {
    const found = suggestions.find((s) => s.email.toLowerCase() === email.toLowerCase())
    return found?.name ? `${found.name} <${email}>` : email
  }

  return (
    <div className="relative">
      <label className="label">{label}</label>
      <div className="input flex flex-wrap items-center gap-1.5 min-h-[40px]">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 bg-navy-50 border border-navy-100 rounded-md px-2 py-0.5 text-xs">
            {labelFor(v)}
            <button onClick={() => remove(v)} className="text-navy-400 hover:text-rose-700">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',' || e.key === ';') && input) {
              e.preventDefault()
              add(input)
            }
            if (e.key === 'Backspace' && !input && value.length > 0) {
              remove(value[value.length - 1])
            }
          }}
          className="flex-1 min-w-[160px] outline-none border-0 text-sm bg-transparent"
          placeholder={value.length === 0 ? 'Nom ou email…' : ''}
        />
      </div>
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 card shadow-raised max-h-64 overflow-y-auto scroll-isolated">
          {filtered.map((s) => (
            <button
              key={s.email}
              onMouseDown={(e) => { e.preventDefault(); add(s.email) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-navy-50 transition flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                {s.name ? (
                  <>
                    <div className="font-medium text-navy-900 truncate">{s.name}</div>
                    <div className="text-[11px] text-navy-500 truncate">{s.email}</div>
                  </>
                ) : (
                  <div className="text-navy-700 truncate">{s.email}</div>
                )}
              </div>
              <span className={cn(
                'shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold',
                s.source === 'outlook' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700',
              )}>
                {s.source === 'outlook' ? 'Outlook' : 'Client'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────────────────── Helpers ───────────────────── */

// stripHtml + sanitizeHtml sont importés depuis @/lib/sanitizeHtml — pas de
// fonction locale qui ferait doublon (et serait moins safe car ancienne version
// regex-only).
//
// La sanitization HTML est centralisée dans @/lib/sanitizeHtml
// (DOMParser + whitelist tags/attrs/URL schemes). Voir ce fichier pour la
// politique. L'ancien code regex-only (script + on*) était trop permissif :
// passaient <img src=x onerror=…>, <iframe src=javascript:…>, <style>@import…</style>,
// commentaires conditionnels Outlook utilisés comme vecteur d'évasion, etc.
// Refonte suite à un audit Gemini de Rudy (2026-05).

function b64ToBlob(b64: string, contentType: string): Blob {
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: contentType })
}

/** Construit le corps HTML d'une réponse / transfert avec citation du message original */
function buildReplyBody(opts: {
  fromName?: string
  fromAddr?: string
  date: string
  subject: string
  originalHtml: string
  originalContentType: 'text' | 'html'
  intro: string
}): string {
  const headerLabel = opts.intro || 'Message original'
  const dateStr = dateTimeFr(opts.date)
  const fromLabel = opts.fromName ? `${opts.fromName} &lt;${opts.fromAddr ?? ''}&gt;` : (opts.fromAddr ?? '')
  // Si le mail original est en texte, on le convertit en HTML basique
  const originalBody = opts.originalContentType === 'html'
    ? sanitizePastedHtml(opts.originalHtml)
    : `<pre style="font-family: inherit; white-space: pre-wrap; margin:0;">${escapeHtml(opts.originalHtml)}</pre>`

  return `<p><br/></p>
<div style="border-left:3px solid #cbd5e1; padding-left:12px; margin-top:12px; color:#475569;">
  <p style="margin:0 0 8px 0; font-size:12px; color:#64748b;"><strong>${headerLabel}</strong></p>
  <p style="margin:0; font-size:12px;"><strong>De :</strong> ${fromLabel}</p>
  <p style="margin:0; font-size:12px;"><strong>Date :</strong> ${dateStr}</p>
  <p style="margin:0 0 8px 0; font-size:12px;"><strong>Objet :</strong> ${escapeHtml(opts.subject)}</p>
  <div>${originalBody}</div>
</div>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Lit un fichier en base64 sans le préfixe data:…;base64, */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Lit un fichier en data:URL complète (utilisable direct dans <img src="…">) */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}

/** Insère du HTML à la position du curseur dans la zone contentEditable active */
function insertHtmlAtCursor(html: string) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    // Pas de sélection — append à la fin de l'éditeur actif
    document.execCommand('insertHTML', false, html)
    return
  }
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  const frag = tpl.content
  const lastNode = frag.lastChild
  range.insertNode(frag)
  if (lastNode) {
    const newRange = document.createRange()
    newRange.setStartAfter(lastNode)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
  }
}

// sanitizePastedHtml = même politique de désinfection que pour les mails
// reçus (le helper @/lib/sanitizeHtml retire déjà o:*, w:*, style, link, meta,
// class, lang, scripts et handlers). On garde un nom alias pour la lisibilité
// — quand un jour on voudrait une politique différente entre "mail entrant"
// et "presse-papier", on saura déjà où ajouter une variante.
const sanitizePastedHtml = sanitizeHtml
