/**
 * Polette — panneau latéral d'assistant Claude conversationnel.
 *
 * - Ouvert / fermé via Ctrl+I (ou ⌘+I sur Mac), ou via le bouton flottant en bas à droite
 * - Affiche la conversation courante (messages user/assistant + résumés des tools appelés)
 * - Envoie un message → backend boucle tool_use → renvoie la réponse finale
 * - Sauvegarde automatique en BDD (1 conversation persistante par utilisateur)
 *
 * Note interne : les routes/tables s'appellent encore `coworker_*` côté backend
 * (techniquement plus simple à laisser en l'état). C'est juste l'identité affichée
 * et le nom utilisé par Claude qui est "Polette".
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Sparkles, Send, X, Loader2, Plus, History, ChevronLeft, Wrench, Square, HelpCircle } from 'lucide-react'
import { coworker, type CoworkerConversation, type CoworkerMessage, type CoworkerContentBlock } from '@/db/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type LiveTool = { name: string; status: 'running' | 'ok' | 'error'; summary?: string }

type PendingConfirmation = {
  needs_confirmation: true
  action: string
  summary: string
  params: Record<string, unknown>
}

type Props = {
  open: boolean
  onClose: () => void
}

type View = 'chat' | 'history'

export default function CoworkerPanel({ open, onClose }: Props) {
  const location = useLocation()
  const params = useParams()
  const [view, setView] = useState<View>('chat')
  const [conv, setConv] = useState<CoworkerConversation | null>(null)
  const [messages, setMessages] = useState<CoworkerMessage[]>([])
  const [history, setHistory] = useState<CoworkerConversation[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConv, setLoadingConv] = useState(false)
  // Streaming state : texte en direct + tools en cours d'exécution
  const [liveText, setLiveText] = useState('')
  const [liveTools, setLiveTools] = useState<LiveTool[]>([])
  // Set des messages déjà résolus (confirmé/annulé) pour ne pas réafficher la carte
  const [resolvedConfirmations, setResolvedConfirmations] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll au bas de la conversation à chaque message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // Focus textarea à l'ouverture
  useEffect(() => {
    if (open && view === 'chat') {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open, view])

  // Crée une conversation à la 1re ouverture si aucune n'existe
  useEffect(() => {
    if (!open || conv) return
    let cancelled = false
    void (async () => {
      setLoadingConv(true)
      try {
        const list = await coworker.listConversations()
        if (cancelled) return
        if (list.conversations.length > 0) {
          // Reprend la conversation la plus récente
          const last = list.conversations[0]!
          const detail = await coworker.getConversation(last.id)
          if (cancelled) return
          setConv(detail.conversation)
          setMessages(detail.messages)
        } else {
          const created = await coworker.createConversation()
          if (cancelled) return
          setConv(created.conversation)
          setMessages([])
        }
      } catch (e) {
        toast.error('Impossible de charger Polette', { description: e instanceof Error ? e.message : String(e) })
      } finally {
        if (!cancelled) setLoadingConv(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, conv])

  const newConversation = async () => {
    try {
      const created = await coworker.createConversation()
      setConv(created.conversation)
      setMessages([])
      setView('chat')
    } catch (e) {
      toast.error('Erreur création', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  const openHistory = async () => {
    try {
      const list = await coworker.listConversations()
      setHistory(list.conversations)
      setView('history')
    } catch (e) {
      toast.error('Impossible de charger l\'historique', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  const switchTo = async (id: string) => {
    try {
      const detail = await coworker.getConversation(id)
      setConv(detail.conversation)
      setMessages(detail.messages)
      setView('chat')
    } catch (e) {
      toast.error('Impossible de charger la conversation', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  const send = async () => {
    if (!conv || !input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    setLiveText('')
    setLiveTools([])

    // Capture le contexte UI courant
    const uiContext: Record<string, unknown> = {
      page: location.pathname,
      dossierId: typeof params.id === 'string' && location.pathname.startsWith('/dossiers/') ? params.id : null,
    }

    // Ajout optimiste du message user
    const optimisticUser: CoworkerMessage = {
      id: 'optimistic-' + Date.now(),
      conversationId: conv.id,
      seq: messages.length,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      await coworker.streamMessage(conv.id, text, {
        uiContext,
        maxLevel: 3,
        signal: ctrl.signal,
        onEvent: (e) => {
          if (e.event === 'text_delta') {
            setLiveText((prev) => prev + e.data.text)
          } else if (e.event === 'tool_start') {
            setLiveTools((prev) => [...prev, { name: e.data.name, status: 'running' }])
          } else if (e.event === 'tool_result') {
            setLiveTools((prev) => {
              const next = [...prev]
              // marque le dernier tool de ce nom en cours comme terminé
              for (let i = next.length - 1; i >= 0; i--) {
                if (next[i]!.name === e.data.name && next[i]!.status === 'running') {
                  next[i] = { name: e.data.name, status: e.data.ok ? 'ok' : 'error', summary: e.data.summary }
                  break
                }
              }
              return next
            })
            // Reset texte intermédiaire car Claude va probablement reprendre la parole
            setLiveText('')
          } else if (e.event === 'error') {
            toast.error('Erreur Polette', { description: e.data.message.slice(0, 200) })
          }
          // 'usage' et 'done' : on attend la fin du stream pour reload BDD
        },
      })

      // Recharge depuis la BDD pour avoir l'historique propre
      const detail = await coworker.getConversation(conv.id)
      setMessages(detail.messages)
      setConv(detail.conversation)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        toast.info('Génération interrompue')
        // On garde le message user mais retire l'optimiste si pas encore confirmé
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        toast.error('Échec Polette', { description: msg.slice(0, 200) })
      }
      // Recharge l'état BDD (peut contenir le user message mais pas la réponse)
      try {
        const detail = await coworker.getConversation(conv.id)
        setMessages(detail.messages)
      } catch { /* keep optimistic */ }
    } finally {
      setSending(false)
      setLiveText('')
      setLiveTools([])
      abortRef.current = null
    }
  }

  const stop = () => {
    abortRef.current?.abort()
  }

  const confirmAction = async (messageId: string, pending: PendingConfirmation) => {
    if (resolvedConfirmations.has(messageId)) return
    setResolvedConfirmations((prev) => new Set(prev).add(messageId))
    const text = `Confirmé. Relance ${pending.action} avec ces paramètres exactement, en ajoutant confirmed: true :\n\n\`\`\`json\n${JSON.stringify({ ...pending.params, confirmed: true }, null, 2)}\n\`\`\``
    setInput(text)
    // Petite pause pour que setInput soit appliqué, puis send
    setTimeout(() => void sendWithText(text), 50)
  }

  const cancelAction = (messageId: string) => {
    if (resolvedConfirmations.has(messageId)) return
    setResolvedConfirmations((prev) => new Set(prev).add(messageId))
    void sendWithText('Annule cette action.')
  }

  // Variante de send() qui prend le texte en paramètre (utilisée pour confirm/cancel)
  const sendWithText = async (text: string) => {
    if (!conv || !text.trim() || sending) return
    setInput('')
    setSending(true)
    setLiveText('')
    setLiveTools([])
    const uiContext: Record<string, unknown> = {
      page: location.pathname,
      dossierId: typeof params.id === 'string' && location.pathname.startsWith('/dossiers/') ? params.id : null,
    }
    const optimisticUser: CoworkerMessage = {
      id: 'optimistic-' + Date.now(),
      conversationId: conv.id,
      seq: messages.length,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await coworker.streamMessage(conv.id, text, {
        uiContext, maxLevel: 3, signal: ctrl.signal,
        onEvent: (e) => {
          if (e.event === 'text_delta') setLiveText((prev) => prev + e.data.text)
          else if (e.event === 'tool_start') setLiveTools((prev) => [...prev, { name: e.data.name, status: 'running' }])
          else if (e.event === 'tool_result') {
            setLiveTools((prev) => {
              const next = [...prev]
              for (let i = next.length - 1; i >= 0; i--) {
                if (next[i]!.name === e.data.name && next[i]!.status === 'running') {
                  next[i] = { name: e.data.name, status: e.data.ok ? 'ok' : 'error', summary: e.data.summary }
                  break
                }
              }
              return next
            })
            setLiveText('')
          } else if (e.event === 'error') {
            toast.error('Erreur Polette', { description: e.data.message.slice(0, 200) })
          }
        },
      })
      const detail = await coworker.getConversation(conv.id)
      setMessages(detail.messages)
      setConv(detail.conversation)
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        toast.error('Échec Polette', { description: e instanceof Error ? e.message.slice(0, 200) : String(e) })
      }
      try {
        const detail = await coworker.getConversation(conv.id)
        setMessages(detail.messages)
      } catch { /* keep optimistic */ }
    } finally {
      setSending(false)
      setLiveText('')
      setLiveTools([])
      abortRef.current = null
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop transparent — sert uniquement à intercepter le clic pour
          fermer Polette. Pas d'assombrissement ni flou : Sébastien (retour
          beta 2026-05) doit garder visible le dossier en arrière-plan pendant
          qu'il discute avec Polette pour pouvoir s'y référer en parallèle. */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panneau latéral droit — thème HUD navy/gold */}
      <aside
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[480px] md:w-[560px]',
          'flex flex-col text-navy-100',
          'bg-gradient-to-b from-navy-950 via-[#0d1c3a] to-navy-950',
          'border-l border-gold-500/25',
          'shadow-[-12px_0_60px_-20px_rgba(0,0,0,0.6),_inset_1px_0_0_rgba(201,169,97,0.08)]',
          'polette-slide-in'
        )}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundImage: `
            linear-gradient(to bottom, rgba(10,20,45,0.97), rgba(13,28,58,0.97), rgba(10,20,45,0.97)),
            radial-gradient(circle at 1px 1px, rgba(201,169,97,0.06) 1px, transparent 0)
          `,
          backgroundSize: 'auto, 24px 24px',
        }}
      >
        {/* Liseré gold haut */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/70 to-transparent pointer-events-none" />

        {/* Header */}
        <header className="relative flex items-center gap-2.5 px-4 py-3 border-b border-gold-500/15 bg-navy-950/40 polette-scan overflow-hidden">
          <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center shadow-[0_0_14px_-2px_rgba(201,169,97,0.6)]">
            <Sparkles className="h-4 w-4 text-navy-950" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-navy-950 polette-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-serif text-[15px] text-white leading-none tracking-wide">Polette</span>
              <span className="polette-mono text-[9px] text-gold-400/80 uppercase tracking-[0.18em]">v1 · online</span>
            </div>
            <div className="text-[10px] text-navy-300/70 truncate polette-mono mt-0.5">
              <span className="text-gold-400/60">›</span>{' '}
              {view === 'history' ? 'historique' : conv?.title || 'nouvelle session'}
              {conv && view === 'chat' && (
                <span className="ml-2 text-navy-400/70">· {(conv.cumulativeCostEur || 0).toFixed(3)} €</span>
              )}
            </div>
          </div>
          {view === 'chat' ? (
            <>
              <button
                onClick={() => void sendWithText('Explique-moi en quelques lignes ce que je suis en train de regarder dans cette page. Utilise get_current_context et get_dossier/get_client si pertinent. Sois concis (max 5 lignes).')}
                disabled={sending || !conv}
                className="h-8 w-8 rounded-md hover:bg-gold-500/10 flex items-center justify-center text-navy-300 hover:text-gold-300 transition-colors disabled:opacity-50"
                title="Explique-moi cet écran"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              <button onClick={openHistory} className="h-8 w-8 rounded-md hover:bg-gold-500/10 flex items-center justify-center text-navy-300 hover:text-gold-300 transition-colors" title="Historique">
                <History className="h-4 w-4" />
              </button>
              <button onClick={newConversation} className="h-8 w-8 rounded-md hover:bg-gold-500/10 flex items-center justify-center text-navy-300 hover:text-gold-300 transition-colors" title="Nouvelle session">
                <Plus className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button onClick={() => setView('chat')} className="h-8 w-8 rounded-md hover:bg-gold-500/10 flex items-center justify-center text-navy-300 hover:text-gold-300 transition-colors" title="Retour">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-rose-500/15 flex items-center justify-center text-navy-300 hover:text-rose-300 transition-colors" title="Fermer Polette (Ctrl+I)">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        {view === 'history' ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {history.length === 0 ? (
              <div className="text-sm text-navy-300/60 text-center py-8 polette-mono">— aucune session —</div>
            ) : (
              history.map((c) => (
                <button
                  key={c.id}
                  onClick={() => switchTo(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md border transition-colors',
                    'border-gold-500/10 hover:border-gold-500/30 hover:bg-gold-500/[0.04]',
                    conv?.id === c.id && 'bg-gold-500/[0.07] border-gold-500/40'
                  )}
                >
                  <div className="text-sm font-medium text-white truncate">{c.title}</div>
                  <div className="text-[10px] text-navy-300/70 flex items-center gap-2 polette-mono mt-0.5">
                    <span>{new Date(c.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-gold-400/40">|</span>
                    <span className="text-gold-400/80">{(c.cumulativeCostEur || 0).toFixed(3)} €</span>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 relative">
              {loadingConv ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 text-gold-400 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <EmptyState />
              ) : (
                messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    resolved={resolvedConfirmations.has(m.id)}
                    onConfirm={(p) => void confirmAction(m.id, p)}
                    onCancel={() => cancelAction(m.id)}
                  />
                ))
              )}
              {/* Streaming en direct : tools en cours + texte qui s'écrit */}
              {sending && (liveTools.length > 0 || liveText) && (
                <div className="polette-slide-in flex justify-start">
                  <div className="max-w-[85%] rounded-lg px-3.5 py-2 text-sm leading-relaxed border bg-navy-900/70 text-navy-100 border-gold-500/15 rounded-bl-sm backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 mb-1.5 polette-mono text-[9px] text-gold-400/70 uppercase tracking-[0.12em]">
                      <Sparkles className="h-2.5 w-2.5" />
                      <span>polette</span>
                      <span className="text-gold-400/30">›</span>
                      <span className="polette-dots inline-flex"><span /><span /><span /></span>
                    </div>
                    {liveTools.map((t, i) => (
                      <div key={i} className="flex items-center gap-1.5 my-1 text-[10px] polette-mono">
                        {t.status === 'running' ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin text-gold-400" />
                        ) : t.status === 'ok' ? (
                          <span className="text-emerald-400">✓</span>
                        ) : (
                          <span className="text-rose-400">✗</span>
                        )}
                        <span className="text-gold-400/60">[</span>
                        <span className={cn(t.status === 'running' ? 'text-gold-300' : t.status === 'ok' ? 'text-emerald-300' : 'text-rose-300')}>
                          {t.name}
                        </span>
                        <span className="text-gold-400/60">]</span>
                        {t.summary && <span className="text-navy-300/70 ml-1">{t.summary}</span>}
                      </div>
                    ))}
                    {liveText && <MarkdownText text={liveText} />}
                  </div>
                </div>
              )}
              {sending && liveTools.length === 0 && !liveText && (
                <div className="flex items-center gap-2 text-xs px-2 polette-mono text-gold-400/80">
                  <span>Polette traite</span>
                  <span className="polette-dots inline-flex"><span /><span /><span /></span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer / input */}
            <footer className="relative border-t border-gold-500/15 p-3 bg-navy-950/40">
              {/* Liseré gold bas */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent pointer-events-none" />

              <div className={cn(
                'flex items-end gap-2 rounded-lg border bg-navy-900/60 transition-all p-2 polette-corners',
                'border-gold-500/20 focus-within:border-gold-500/60',
                'focus-within:shadow-[0_0_18px_-4px_rgba(201,169,97,0.4)]'
              )}>
                <span className="polette-mono text-gold-400/80 text-sm pt-1.5 pl-1 select-none">›</span>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="demande à Polette…"
                  rows={1}
                  className="flex-1 bg-transparent border-0 outline-none resize-none text-sm text-white placeholder:text-navy-300/40 placeholder:polette-mono max-h-32 py-1"
                  disabled={sending || !conv}
                />
                {sending ? (
                  <button
                    onClick={stop}
                    className="h-8 w-8 rounded-md flex items-center justify-center transition-all shrink-0 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 shadow-[0_0_12px_-3px_rgba(244,63,94,0.5)]"
                    title="Arrêter la génération"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => void send()}
                    disabled={!input.trim() || !conv}
                    className={cn(
                      'h-8 w-8 rounded-md flex items-center justify-center transition-all shrink-0',
                      input.trim()
                        ? 'bg-gold-500 text-navy-950 hover:bg-gold-400 shadow-[0_0_14px_-2px_rgba(201,169,97,0.7)]'
                        : 'bg-navy-800/60 text-navy-400 border border-gold-500/10'
                    )}
                    title="Envoyer (Entrée)"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="text-[9px] mt-1.5 px-1 flex items-center justify-between polette-mono uppercase tracking-[0.12em]">
                <span className="text-navy-300/60">sonnet 4.6 · ~0,05–0,30 € / session</span>
                <span className="text-gold-400/60">tools · lvl 3</span>
              </div>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  const suggestions = [
    'Liste mes 5 derniers dossiers',
    'Quel est le statut HCSF du dossier en cours ?',
    'Crée une note "RDV reporté au 15 mai"',
    'Lance le DDP sur ce dossier',
  ]
  return (
    <div className="text-center py-8 px-4">
      <div className="inline-flex relative h-14 w-14 rounded-xl items-center justify-center mb-4 bg-gradient-to-br from-gold-500/20 to-gold-700/5 border border-gold-500/30 shadow-[0_0_30px_-8px_rgba(201,169,97,0.5)]">
        <Sparkles className="h-6 w-6 text-gold-400" />
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 polette-pulse" />
      </div>
      <h3 className="font-serif text-lg text-white mb-1">Bonjour, je suis Polette</h3>
      <p className="text-xs text-navy-300/70 mb-1 polette-mono uppercase tracking-[0.12em]">— votre assistante Apolline —</p>
      <p className="text-xs text-navy-200/80 mb-6 max-w-xs mx-auto">Je vois vos dossiers, je peux les modifier, lancer les skills Apolline et répondre à vos questions métier.</p>
      <div className="space-y-1.5 text-left max-w-sm mx-auto">
        <div className="kicker pl-1 text-gold-400/70">Suggestions</div>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => {
              const ta = document.querySelector<HTMLTextAreaElement>('aside textarea')
              if (ta) { ta.value = s; ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true })) }
            }}
            className="block w-full text-left text-sm px-3 py-2 rounded-md text-navy-100 border border-gold-500/15 bg-navy-900/40 hover:bg-gold-500/[0.06] hover:border-gold-500/40 transition-all"
          >
            <span className="polette-mono text-gold-400/60 mr-2">›</span>{s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type MessageBubbleProps = {
  message: CoworkerMessage
  resolved?: boolean
  onConfirm?: (pending: PendingConfirmation) => void
  onCancel?: () => void
}

function MessageBubble({ message, resolved, onConfirm, onCancel }: MessageBubbleProps) {
  if (message.role === 'tool') {
    // Affichage compact d'un tool_result — ligne mono avec bracket gold
    const c = message.content as { tool_use_id: string; content: string; is_error?: boolean }
    let parsed: unknown = null
    try { parsed = JSON.parse(c.content) } catch { /* keep as string */ }

    // ⚠️ Action de niveau 3 nécessitant confirmation utilisateur
    if (parsed && typeof parsed === 'object' && parsed !== null && 'needs_confirmation' in parsed && (parsed as { needs_confirmation: boolean }).needs_confirmation) {
      const pending = parsed as PendingConfirmation
      return (
        <div className="polette-slide-in flex justify-start">
          <div className="max-w-[90%] rounded-lg p-3.5 border bg-gradient-to-br from-gold-500/10 to-amber-500/5 border-gold-500/40 shadow-[0_0_18px_-4px_rgba(201,169,97,0.5)] polette-corners">
            <div className="flex items-center gap-1.5 mb-2 polette-mono text-[9px] text-gold-400 uppercase tracking-[0.14em]">
              <Sparkles className="h-2.5 w-2.5" />
              <span>action sensible · confirmation requise</span>
            </div>
            <div className="text-sm text-white mb-1 leading-relaxed">{pending.summary}</div>
            <div className="text-[10px] polette-mono text-gold-400/70 uppercase tracking-[0.12em] mb-3">
              <span className="text-gold-400/50">›</span> tool : {pending.action}
            </div>
            {resolved ? (
              <div className="text-[11px] polette-mono text-navy-300/70 uppercase tracking-[0.12em] flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> traité
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => onConfirm?.(pending)}
                  className="flex-1 px-3 py-1.5 rounded-md bg-gold-500 text-navy-950 hover:bg-gold-400 text-xs font-medium shadow-[0_0_14px_-3px_rgba(201,169,97,0.7)] transition-all"
                >
                  Confirmer
                </button>
                <button
                  onClick={() => onCancel?.()}
                  className="px-3 py-1.5 rounded-md bg-navy-900/60 border border-navy-700 text-navy-200 hover:bg-rose-500/15 hover:border-rose-500/40 hover:text-rose-300 text-xs font-medium transition-all"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="ml-3 text-[10px] flex items-start gap-1.5 polette-mono">
        <span className={cn('mt-0.5 shrink-0', c.is_error ? 'text-rose-400' : 'text-emerald-400')}>
          {c.is_error ? '✗' : '✓'}
        </span>
        <details className="flex-1 min-w-0 group">
          <summary className={cn('cursor-pointer truncate hover:text-gold-300 transition-colors', c.is_error ? 'text-rose-300/80' : 'text-navy-300/70')}>
            <span className="text-gold-400/60">[</span>
            {c.is_error ? 'tool_error' : 'tool_ok'}
            <span className="text-gold-400/60">]</span>
            {parsed && typeof parsed === 'object' && parsed !== null && 'count' in parsed
              ? <span className="ml-1 text-gold-400/80">{(parsed as { count: number }).count} item(s)</span>
              : ''}
          </summary>
          <pre className="mt-1.5 text-[9px] bg-navy-950/60 border border-gold-500/20 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words text-navy-100/80">
            {parsed ? JSON.stringify(parsed, null, 2).slice(0, 800) : String(c.content).slice(0, 800)}
          </pre>
        </details>
      </div>
    )
  }

  const isUser = message.role === 'user'
  const blocks: CoworkerContentBlock[] = typeof message.content === 'string'
    ? [{ type: 'text', text: message.content }]
    : Array.isArray(message.content)
      ? message.content as CoworkerContentBlock[]
      : []

  return (
    <div className={cn('flex polette-slide-in', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[85%] rounded-lg px-3.5 py-2 text-sm leading-relaxed border',
        isUser
          ? 'bg-gradient-to-br from-gold-500/15 to-gold-700/5 text-white border-gold-500/30 rounded-br-sm shadow-[0_0_18px_-6px_rgba(201,169,97,0.4)]'
          : 'bg-navy-900/70 text-navy-100 border-gold-500/15 rounded-bl-sm backdrop-blur-sm'
      )}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1 polette-mono text-[9px] text-gold-400/70 uppercase tracking-[0.12em]">
            <Sparkles className="h-2.5 w-2.5" />
            <span>polette</span>
            <span className="text-gold-400/30">›</span>
          </div>
        )}
        {blocks.map((b, i) => {
          if (b.type === 'text') return <MarkdownText key={i} text={b.text} dark />
          if (b.type === 'tool_use') {
            return (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded mr-1 my-0.5 bg-gold-500/10 text-gold-300 border border-gold-500/30 polette-mono">
                <Wrench className="h-2.5 w-2.5" />
                {b.name}
              </span>
            )
          }
          return null
        })}
        {!isUser && message.meta?.costEur ? (
          <div className="mt-2 text-[9px] text-navy-400/70 border-t border-gold-500/10 pt-1.5 polette-mono uppercase tracking-[0.1em] flex items-center gap-1.5">
            <span className="text-gold-400/50">›</span>
            <span>{message.meta.inputTokens?.toLocaleString('fr-FR')}/{message.meta.outputTokens?.toLocaleString('fr-FR')} tk</span>
            <span className="text-gold-400/30">|</span>
            <span className="text-gold-400/80">{message.meta.costEur.toFixed(4)} €</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

/** Mini renderer Markdown — gère #, ##, **, *, `, listes -, paragraphes. */
function MarkdownText({ text }: { text: string; dark?: boolean }) {
  const html = renderMarkdown(text)
  return (
    <div
      className="text-navy-100"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderMarkdown(md: string): string {
  // Code blocks
  const codeBlocks: string[] = []
  let body = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, _lang, code) => {
    codeBlocks.push(`<pre class="bg-navy-950/80 border border-gold-500/20 text-navy-100 text-xs p-2 rounded overflow-x-auto my-1.5 polette-mono"><code>${escapeHtml(code)}</code></pre>`)
    return `CB${codeBlocks.length - 1}`
  })
  body = escapeHtml(body)
  body = body.replace(/^### (.+)$/gm, '<h3 class="font-serif text-base mt-2 mb-1 text-gold-300">$1</h3>')
  body = body.replace(/^## (.+)$/gm, '<h2 class="font-serif text-lg mt-2 mb-1 text-gold-300">$1</h2>')
  body = body.replace(/^# (.+)$/gm, '<h1 class="font-serif text-xl mt-2 mb-1 text-gold-300">$1</h1>')
  body = body.replace(/\*\*([^*\n]+)\*\*/g, '<strong class="text-white">$1</strong>')
  body = body.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em class="text-gold-200">$2</em>')
  body = body.replace(/`([^`\n]+)`/g, '<code class="bg-gold-500/10 text-gold-300 border border-gold-500/20 px-1 py-0.5 rounded text-[12px] polette-mono">$1</code>')
  body = body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-gold-400 underline hover:text-gold-300">$1</a>')
  body = body.replace(/(^(?:[-*] .+(?:\n|$))+)/gm, (block) => {
    const items = block.trim().split(/\n/).map(l => `<li class="ml-1">${l.replace(/^[-*] /, '')}</li>`).join('')
    return `<ul class="list-disc pl-4 my-1 marker:text-gold-400/60">${items}</ul>`
  })
  body = body.split(/\n{2,}/).map(p => {
    const trimmed = p.trim()
    if (!trimmed) return ''
    if (/^<(h[1-6]|ul|ol|pre)/.test(trimmed)) return trimmed
    if (trimmed.includes('CB')) return trimmed
    return `<p class="my-1">${trimmed.replace(/\n/g, '<br>')}</p>`
  }).join('\n')
  body = body.replace(/CB(\d+)/g, (_, i) => codeBlocks[parseInt(i, 10)] ?? '')
  return body
}
