/**
 * Routes Coworker — assistant Claude conversationnel.
 *
 *   POST   /api/coworker/conversations              → crée une nouvelle conversation
 *   GET    /api/coworker/conversations              → liste les convos de l'utilisateur
 *   GET    /api/coworker/conversations/:id          → récupère les messages d'une conversation
 *   DELETE /api/coworker/conversations/:id          → archive (soft delete)
 *   POST   /api/coworker/conversations/:id/messages → envoie un message + boucle tool_use
 *
 * Le tool loop fonctionne ainsi :
 *  1. On charge l'historique de la conversation
 *  2. On ajoute le nouveau message user
 *  3. On appelle Claude avec system + messages + tools
 *  4. Si la réponse contient des tool_use, on les exécute côté backend, on persist
 *     le tool_result, puis on rappelle Claude avec les résultats
 *  5. Boucle jusqu'à stop_reason ≠ 'tool_use' (max 10 itérations)
 *  6. Persiste le message assistant final
 */
import { Hono } from 'hono'
import Anthropic from '@anthropic-ai/sdk'
import { eq, and, desc, max } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { authMiddleware, getUser } from '../middleware/auth.js'
import { ctxMeta } from '../lib/audit.js'
import { findTool, toolsForLevels, toAnthropicTools, type ToolContext, type ToolLevel } from '../lib/coworker/tools.js'

export const coworkerRoute = new Hono()

const apiKey = process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic({ apiKey }) : null
const COWORKER_MODEL = process.env.ANTHROPIC_MODEL_COWORKER ?? process.env.ANTHROPIC_MODEL_SONNET ?? 'claude-sonnet-4-6'
const COWORKER_MAX_TOKENS = Number(process.env.ANTHROPIC_COWORKER_MAX_TOKENS ?? '4096')
const MAX_TOOL_ITERATIONS = 10

// Tarifs Sonnet 4.6 estimés (USD/1M, conversion ~0.95)
const PRICE = { input: 2.85, output: 14.25, cacheW: 3.55, cacheR: 0.28 }

function estimateCost(usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }): number {
  return (usage.input_tokens / 1e6) * PRICE.input
    + (usage.output_tokens / 1e6) * PRICE.output
    + ((usage.cache_creation_input_tokens ?? 0) / 1e6) * PRICE.cacheW
    + ((usage.cache_read_input_tokens ?? 0) / 1e6) * PRICE.cacheR
}

const SYSTEM_PROMPT = `Tu es **Jarvis**, l'assistant IA intégré au logiciel Extr'Apol — Groupe Apolline (courtage en crédit immobilier IOBSP, Bourgogne-Franche-Comté).

Tu te présentes toujours sous le nom de Jarvis. Quand on te demande qui tu es, tu réponds que tu es Jarvis, l'assistant du logiciel Apolline.

Tu agis aux côtés du courtier comme un majordome expert : efficace, précis, légèrement formel, jamais bavard. Tu peux :
- Répondre à des questions métier (HCSF, taux, conformité IOBSP, fiscalité immobilière, calculs financiers)
- Consulter et modifier les données de l'application via les tools mis à ta disposition
- Lancer des skills Apolline (génération DDP, dossier banquier, étude client R1…) via le tool \`run_skill\`

Règles :
- Français professionnel, concis (pas de blabla, va droit au but)
- Quand l'utilisateur fait référence à "ce dossier", "ce client", "le dossier en cours" : appelle \`get_current_context\` pour savoir ce qu'il regarde dans l'UI
- Avant toute mutation (modifier statut, créer note, lancer skill payant) : pas besoin de demander confirmation pour les actions de niveau 1-2 — agis directement, mais informe brièvement de ce que tu as fait
- Utilise les tools EN PARALLÈLE quand c'est possible (Claude API supporte plusieurs tool_use par tour)
- Si tu manques d'info : appelle un tool de lecture (get_dossier, list_dossiers, etc.), ne demande pas à l'utilisateur si l'info est accessible
- Format de réponse final : Markdown (titres, listes, gras autorisés)
- Pas de PII sensible exposée (pas de RIB, pas de n° sécu, pas de mot de passe)
- Charte visuelle Apolline : navy #0A1F3D + gold #C9A961

Tu connais les statuts du pipeline : R0, R1_prevu, R1_fait, montage, depot_banque, accord, signature, archive.
Tu connais les conditions HCSF : endettement ≤ 35%, durée ≤ 25 ans.
Tu connais les 11 skills Apolline (utilise list_skills si besoin).

────────── FACTURATION ──────────
Tu peux gérer la facturation : honoraires (au client), commissions bancaires (refacturation banque),
commissions autres (apporteurs), ristournes (rétrocession à un apporteur), et avoirs (annulations).
- Pour lister : \`list_factures\` avec dossier_id et/ou statut
- Pour détailler : \`get_facture\` avec ref (ex: F26-0042) ou UUID
- Pour créer : \`create_facture\` (Niveau 3 — confirmation)
- Pour marquer réglée : \`mark_facture_reglee\` (Niveau 2 — direct)
TVA : honoraires 20%, commissions bancaires 0%, autres selon contexte.
Numérotation auto F<yy>-NNNN ou R<yy>-NNNN — ne JAMAIS la deviner.

Quand un dossier passe en statut "Accord", propose proactivement à l'utilisateur d'émettre la facture d'honoraires (sauf si elle existe déjà — vérifie d'abord avec list_factures).

────────── ACTIONS SENSIBLES (Niveau 3 — création) ──────────
Certains tools (\`create_dossier\`, \`create_client\`) nécessitent une confirmation utilisateur.
- Au 1er appel sans \`confirmed: true\`, le tool renvoie \`{ needs_confirmation: true, summary: ..., params: ... }\`.
- Tu DOIS alors arrêter ton tour immédiatement et répondre brièvement : "Cette action nécessite votre confirmation. Validez ou annulez avec les boutons ci-dessous." (1 phrase max)
- L'utilisateur cliquera "Confirmer" ou "Annuler" → un nouveau message t'arrivera.
- Si confirmé : relance le MÊME tool avec les MÊMES params + \`confirmed: true\`.
- Si annulé : confirme simplement avoir annulé et propose une alternative si pertinent.`

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

// ────────────────────────────────────────────────────────────────────
// CRUD conversations
// ────────────────────────────────────────────────────────────────────

coworkerRoute.get('/conversations', authMiddleware, async (c) => {
  const u = getUser(c)
  const archived = c.req.query('archived') === '1'
  const rows = await db.select({
    id: schema.coworkerConversations.id,
    title: schema.coworkerConversations.title,
    cumulativeCostEur: schema.coworkerConversations.cumulativeCostEur,
    cumulativeTokensIn: schema.coworkerConversations.cumulativeTokensIn,
    cumulativeTokensOut: schema.coworkerConversations.cumulativeTokensOut,
    model: schema.coworkerConversations.model,
    createdAt: schema.coworkerConversations.createdAt,
    updatedAt: schema.coworkerConversations.updatedAt,
  }).from(schema.coworkerConversations)
    .where(and(eq(schema.coworkerConversations.userId, u.sub), eq(schema.coworkerConversations.archived, archived)))
    .orderBy(desc(schema.coworkerConversations.updatedAt))
    .limit(100)
  return c.json({ conversations: rows })
})

coworkerRoute.post('/conversations', authMiddleware, async (c) => {
  const u = getUser(c)
  const body = await c.req.json().catch(() => ({})) as { title?: string; contextSnapshot?: Record<string, unknown> }
  const [conv] = await db.insert(schema.coworkerConversations).values({
    userId: u.sub,
    title: body.title?.slice(0, 80) ?? 'Nouvelle conversation',
    contextSnapshot: body.contextSnapshot ?? {},
  }).returning()
  return c.json({ conversation: conv })
})

coworkerRoute.get('/conversations/:id', authMiddleware, async (c) => {
  const u = getUser(c)
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)
  const [conv] = await db.select().from(schema.coworkerConversations)
    .where(and(eq(schema.coworkerConversations.id, id), eq(schema.coworkerConversations.userId, u.sub)))
  if (!conv) return c.json({ error: 'Conversation introuvable' }, 404)
  const messages = await db.select().from(schema.coworkerMessages)
    .where(eq(schema.coworkerMessages.conversationId, id))
    .orderBy(schema.coworkerMessages.seq)
  return c.json({ conversation: conv, messages })
})

coworkerRoute.delete('/conversations/:id', authMiddleware, async (c) => {
  const u = getUser(c)
  const id = c.req.param('id') ?? ''
  if (!id) return c.json({ error: 'id manquant' }, 400)
  await db.update(schema.coworkerConversations)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.coworkerConversations.id, id), eq(schema.coworkerConversations.userId, u.sub)))
  return c.json({ ok: true })
})

// ────────────────────────────────────────────────────────────────────
// Envoi d'un message + tool loop
// ────────────────────────────────────────────────────────────────────

coworkerRoute.post('/conversations/:id/messages', authMiddleware, async (c) => {
  if (!client) return c.json({ error: 'ANTHROPIC_API_KEY non configurée' }, 503)

  const u = getUser(c)
  const meta = ctxMeta(c)
  const convId = c.req.param('id') ?? ''
  if (!convId) return c.json({ error: 'id manquant' }, 400)

  const body = await c.req.json().catch(() => ({})) as {
    text?: string
    uiContext?: Record<string, unknown>
    maxLevel?: ToolLevel
  }

  const userText = (body.text ?? '').trim()
  if (!userText) return c.json({ error: 'text manquant' }, 400)
  const maxLevel: ToolLevel = ((body.maxLevel === 1 || body.maxLevel === 2 || body.maxLevel === 3) ? body.maxLevel : 2)
  const uiContext = body.uiContext ?? {}

  const [conv] = await db.select().from(schema.coworkerConversations)
    .where(and(eq(schema.coworkerConversations.id, convId), eq(schema.coworkerConversations.userId, u.sub)))
  if (!conv) return c.json({ error: 'Conversation introuvable' }, 404)

  // Récupère la collab pour compléter le contexte tool
  const [collab] = await db.select().from(schema.collaborateurs).where(eq(schema.collaborateurs.id, u.sub))
  const toolCtx: ToolContext = {
    userId: u.sub,
    userEmail: u.email,
    userRole: collab?.role ?? 'courtier',
    uiContext,
    ip: meta.ip,
    userAgent: meta.userAgent,
  }

  // Charge l'historique existant (max 50 derniers messages pour rester dans le budget tokens)
  const history = await db.select().from(schema.coworkerMessages)
    .where(eq(schema.coworkerMessages.conversationId, convId))
    .orderBy(schema.coworkerMessages.seq)

  // seq du prochain message
  const seqRows = await db.select({ maxSeq: max(schema.coworkerMessages.seq) })
    .from(schema.coworkerMessages)
    .where(eq(schema.coworkerMessages.conversationId, convId))
  let nextSeq = (seqRows[0]?.maxSeq ?? -1) + 1

  // Persiste le message user d'entrée
  await db.insert(schema.coworkerMessages).values({
    conversationId: convId, seq: nextSeq++, role: 'user', content: userText,
  })

  // Reconstruit l'historique au format Anthropic
  const messages: Array<{ role: 'user' | 'assistant'; content: string | AnthropicContentBlock[] }> = []
  for (const m of history) {
    if (m.role === 'tool') continue // les tool_results sont rattachés au message user qui suit, déjà reflétés dans le content
    messages.push({ role: m.role as 'user' | 'assistant', content: m.content as string | AnthropicContentBlock[] })
  }
  messages.push({ role: 'user', content: userText })

  const toolDefs = toolsForLevels(maxLevel)
  const anthropicTools = toAnthropicTools(toolDefs)

  let cumulInputTokens = 0
  let cumulOutputTokens = 0
  let cumulCacheR = 0
  let cumulCacheW = 0
  let cumulCost = 0
  let lastModel = COWORKER_MODEL
  let lastStopReason: string | null = null
  let finalAssistantBlocks: AnthropicContentBlock[] = []

  try {
    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const res = await client.messages.create({
        model: COWORKER_MODEL,
        max_tokens: COWORKER_MAX_TOKENS,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: anthropicTools,
        messages,
      })

      lastModel = res.model
      lastStopReason = res.stop_reason
      cumulInputTokens += res.usage.input_tokens
      cumulOutputTokens += res.usage.output_tokens
      cumulCacheR += res.usage.cache_read_input_tokens ?? 0
      cumulCacheW += res.usage.cache_creation_input_tokens ?? 0
      cumulCost += estimateCost(res.usage)

      const blocks = res.content as AnthropicContentBlock[]

      // Stocke le message assistant tel quel (sera persisté en BDD à la fin)
      finalAssistantBlocks = blocks

      // Pas de tool_use → on a la réponse finale, on sort
      if (res.stop_reason !== 'tool_use') break

      // Sinon : exécute chaque tool_use, prépare un message user avec les tool_results
      const toolUses = blocks.filter((b): b is Extract<AnthropicContentBlock, { type: 'tool_use' }> => b.type === 'tool_use')
      const toolResults: AnthropicContentBlock[] = []

      // Persiste le message assistant intermédiaire (avec ses tool_use)
      await db.insert(schema.coworkerMessages).values({
        conversationId: convId, seq: nextSeq++, role: 'assistant', content: blocks,
        meta: { model: res.model, stopReason: res.stop_reason, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
      })

      // Exécute en parallèle
      const results = await Promise.all(toolUses.map(async (tu) => {
        const tool = findTool(tu.name)
        if (!tool) {
          return { tool_use_id: tu.id, content: JSON.stringify({ error: `Tool "${tu.name}" inconnu` }), is_error: true }
        }
        if (tool.level > maxLevel) {
          return { tool_use_id: tu.id, content: JSON.stringify({ error: `Tool "${tu.name}" niveau ${tool.level} non autorisé (max ${maxLevel})` }), is_error: true }
        }
        try {
          const out = await tool.handler(tu.input ?? {}, toolCtx)
          return { tool_use_id: tu.id, content: JSON.stringify(out), is_error: false }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { tool_use_id: tu.id, content: JSON.stringify({ error: msg }), is_error: true }
        }
      }))

      for (const r of results) {
        toolResults.push({ type: 'tool_result', tool_use_id: r.tool_use_id, content: r.content, is_error: r.is_error })
        // Persiste un message 'tool' par résultat (pour replay/reprise)
        await db.insert(schema.coworkerMessages).values({
          conversationId: convId, seq: nextSeq++, role: 'tool', content: r,
        })
      }

      // Ajoute au contexte messages pour la prochaine itération
      messages.push({ role: 'assistant', content: blocks })
      messages.push({ role: 'user', content: toolResults })
    }

    // Persiste le message assistant FINAL (réponse en clair, plus de tool_use)
    await db.insert(schema.coworkerMessages).values({
      conversationId: convId, seq: nextSeq++, role: 'assistant', content: finalAssistantBlocks,
      meta: {
        model: lastModel, stopReason: lastStopReason,
        inputTokens: cumulInputTokens, outputTokens: cumulOutputTokens,
        cacheReadTokens: cumulCacheR, cacheCreationTokens: cumulCacheW,
        costEur: Number(cumulCost.toFixed(4)),
      },
    })

    // Met à jour les compteurs de la conversation + date
    await db.update(schema.coworkerConversations).set({
      cumulativeCostEur: (conv.cumulativeCostEur ?? 0) + cumulCost,
      cumulativeTokensIn: (conv.cumulativeTokensIn ?? 0) + cumulInputTokens,
      cumulativeTokensOut: (conv.cumulativeTokensOut ?? 0) + cumulOutputTokens,
      model: lastModel,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.coworkerConversations.id, convId))

    // Auto-titre si c'est le 1er échange (heuristique : title encore défaut + on a maintenant ≥2 messages user)
    if (conv.title === 'Nouvelle conversation') {
      const proposedTitle = userText.slice(0, 60).split('\n')[0]
      await db.update(schema.coworkerConversations).set({ title: proposedTitle })
        .where(eq(schema.coworkerConversations.id, convId))
    }

    // Extrait le texte final pour la réponse HTTP
    const finalText = finalAssistantBlocks.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n\n')

    return c.json({
      ok: true,
      reply: finalText,
      blocks: finalAssistantBlocks,
      usage: {
        inputTokens: cumulInputTokens,
        outputTokens: cumulOutputTokens,
        cacheReadTokens: cumulCacheR,
        cacheCreationTokens: cumulCacheW,
        costEur: Number(cumulCost.toFixed(4)),
      },
      model: lastModel,
      stopReason: lastStopReason,
    })
  } catch (e) {
    console.error('[coworker] error:', e)
    return c.json({
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split('\n').slice(0, 5).join('\n') : undefined,
    }, 500)
  }
})

// ────────────────────────────────────────────────────────────────────
// Liste des tools disponibles (pour debug / UI inspection)
// ────────────────────────────────────────────────────────────────────

coworkerRoute.get('/tools', authMiddleware, (c) => {
  const tools = toolsForLevels(3).map(t => ({
    name: t.name, description: t.description, level: t.level,
    input_schema: t.input_schema,
  }))
  return c.json({ count: tools.length, tools })
})

coworkerRoute.get('/health', authMiddleware, (c) => {
  return c.json({
    configured: client !== null,
    model: COWORKER_MODEL,
    maxTokens: COWORKER_MAX_TOKENS,
    toolCount: toolsForLevels(3).length,
  })
})

// ────────────────────────────────────────────────────────────────────
// Streaming SSE — réponse en direct + events de tool exécutés
// ────────────────────────────────────────────────────────────────────
//
// Format SSE : chaque évènement est `event: <type>\ndata: <json>\n\n`
//
// Types d'évènement émis :
//   ready          { convId } — au démarrage
//   text_delta     { text }   — un fragment de texte (à concaténer côté front)
//   tool_start     { name, input, id } — Claude lance un tool
//   tool_result    { name, ok, summary } — résultat (résumé court)
//   usage          { inputTokens, outputTokens, costEur } — final
//   done           { messageId, stopReason } — message persisté en BDD
//   error          { message } — erreur fatale (Claude API, BDD, etc.)
//
// Le client (EventSource côté navigateur ne supporte pas POST + headers,
// donc on passe par fetch + ReadableStream pour parser le SSE manuellement).
//
// Auth : token JWT en Bearer header (déjà géré par authMiddleware).
//
coworkerRoute.post('/conversations/:id/messages/stream', authMiddleware, async (c) => {
  if (!client) return c.json({ error: 'ANTHROPIC_API_KEY non configurée' }, 503)

  const u = getUser(c)
  const meta = ctxMeta(c)
  const convId = c.req.param('id') ?? ''
  if (!convId) return c.json({ error: 'id manquant' }, 400)

  const body = await c.req.json().catch(() => ({})) as {
    text?: string
    uiContext?: Record<string, unknown>
    maxLevel?: ToolLevel
  }

  const userText = (body.text ?? '').trim()
  if (!userText) return c.json({ error: 'text manquant' }, 400)
  const maxLevel: ToolLevel = ((body.maxLevel === 1 || body.maxLevel === 2 || body.maxLevel === 3) ? body.maxLevel : 2)
  const uiContext = body.uiContext ?? {}

  const [conv] = await db.select().from(schema.coworkerConversations)
    .where(and(eq(schema.coworkerConversations.id, convId), eq(schema.coworkerConversations.userId, u.sub)))
  if (!conv) return c.json({ error: 'Conversation introuvable' }, 404)

  const [collab] = await db.select().from(schema.collaborateurs).where(eq(schema.collaborateurs.id, u.sub))
  const toolCtx: ToolContext = {
    userId: u.sub,
    userEmail: u.email,
    userRole: collab?.role ?? 'courtier',
    uiContext,
    ip: meta.ip,
    userAgent: meta.userAgent,
  }

  // Charge l'historique
  const history = await db.select().from(schema.coworkerMessages)
    .where(eq(schema.coworkerMessages.conversationId, convId))
    .orderBy(schema.coworkerMessages.seq)
  const seqRows = await db.select({ maxSeq: max(schema.coworkerMessages.seq) })
    .from(schema.coworkerMessages)
    .where(eq(schema.coworkerMessages.conversationId, convId))
  let nextSeq = (seqRows[0]?.maxSeq ?? -1) + 1

  // Persiste le user message
  await db.insert(schema.coworkerMessages).values({
    conversationId: convId, seq: nextSeq++, role: 'user', content: userText,
  })

  const messages: Array<{ role: 'user' | 'assistant'; content: string | AnthropicContentBlock[] }> = []
  for (const m of history) {
    if (m.role === 'tool') continue
    messages.push({ role: m.role as 'user' | 'assistant', content: m.content as string | AnthropicContentBlock[] })
  }
  messages.push({ role: 'user', content: userText })

  const toolDefs = toolsForLevels(maxLevel)
  const anthropicTools = toAnthropicTools(toolDefs)

  // Stream SSE
  return new Response(new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // controller closed
        }
      }

      send('ready', { convId })

      let cumulInputTokens = 0
      let cumulOutputTokens = 0
      let cumulCacheR = 0
      let cumulCacheW = 0
      let cumulCost = 0
      let lastModel = COWORKER_MODEL
      let lastStopReason: string | null = null
      let finalAssistantBlocks: AnthropicContentBlock[] = []

      try {
        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          // Stream Anthropic
          const stream = await client!.messages.stream({
            model: COWORKER_MODEL,
            max_tokens: COWORKER_MAX_TOKENS,
            system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
            tools: anthropicTools,
            messages,
          })

          // Accumulateurs pour reconstruire les blocks à la fin de l'itération
          const blocks: AnthropicContentBlock[] = []
          // Buffer pour les input_json deltas (les tool_use input arrivent en chunks)
          const toolInputBuffers = new Map<number, string>()

          for await (const event of stream) {
            if (event.type === 'content_block_start') {
              const cb = event.content_block
              if (cb.type === 'text') {
                blocks[event.index] = { type: 'text', text: '' }
              } else if (cb.type === 'tool_use') {
                blocks[event.index] = { type: 'tool_use', id: cb.id, name: cb.name, input: {} }
                toolInputBuffers.set(event.index, '')
              }
            } else if (event.type === 'content_block_delta') {
              const d = event.delta
              if (d.type === 'text_delta') {
                const blk = blocks[event.index]
                if (blk && blk.type === 'text') {
                  blk.text += d.text
                  send('text_delta', { text: d.text })
                }
              } else if (d.type === 'input_json_delta') {
                const buf = toolInputBuffers.get(event.index) ?? ''
                toolInputBuffers.set(event.index, buf + d.partial_json)
              }
            } else if (event.type === 'content_block_stop') {
              const blk = blocks[event.index]
              if (blk && blk.type === 'tool_use') {
                // Parse l'input JSON accumulé
                try {
                  const raw = toolInputBuffers.get(event.index) ?? '{}'
                  blk.input = raw ? JSON.parse(raw) : {}
                } catch {
                  blk.input = {}
                }
                send('tool_start', { id: blk.id, name: blk.name, input: blk.input })
              }
            }
          }

          const finalRes = await stream.finalMessage()
          lastModel = finalRes.model
          lastStopReason = finalRes.stop_reason
          cumulInputTokens += finalRes.usage.input_tokens
          cumulOutputTokens += finalRes.usage.output_tokens
          cumulCacheR += finalRes.usage.cache_read_input_tokens ?? 0
          cumulCacheW += finalRes.usage.cache_creation_input_tokens ?? 0
          cumulCost += estimateCost(finalRes.usage)

          finalAssistantBlocks = blocks.filter(Boolean)

          if (finalRes.stop_reason !== 'tool_use') break

          // Persiste le message assistant intermédiaire
          await db.insert(schema.coworkerMessages).values({
            conversationId: convId, seq: nextSeq++, role: 'assistant', content: finalAssistantBlocks,
            meta: { model: finalRes.model, stopReason: finalRes.stop_reason },
          })

          // Exécute les tool_use
          const toolUses = finalAssistantBlocks.filter((b): b is Extract<AnthropicContentBlock, { type: 'tool_use' }> => b.type === 'tool_use')
          const toolResults: AnthropicContentBlock[] = []

          const results = await Promise.all(toolUses.map(async (tu) => {
            const tool = findTool(tu.name)
            if (!tool) {
              return { tool_use_id: tu.id, name: tu.name, content: JSON.stringify({ error: `Tool "${tu.name}" inconnu` }), is_error: true }
            }
            if (tool.level > maxLevel) {
              return { tool_use_id: tu.id, name: tu.name, content: JSON.stringify({ error: `Niveau ${tool.level} non autorisé` }), is_error: true }
            }
            try {
              const out = await tool.handler(tu.input ?? {}, toolCtx)
              return { tool_use_id: tu.id, name: tu.name, content: JSON.stringify(out), is_error: false }
            } catch (e) {
              return { tool_use_id: tu.id, name: tu.name, content: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), is_error: true }
            }
          }))

          for (const r of results) {
            // Émet l'event tool_result au front (résumé court)
            const summary = (() => {
              try {
                const obj = JSON.parse(r.content)
                if (obj && typeof obj === 'object') {
                  if ('error' in obj) return String((obj as { error: string }).error).slice(0, 120)
                  if ('count' in obj) return `${(obj as { count: number }).count} item(s)`
                  if ('ok' in obj) return 'OK'
                  return Object.keys(obj).slice(0, 3).join(', ')
                }
              } catch { /* noop */ }
              return ''
            })()
            send('tool_result', { name: r.name, ok: !r.is_error, summary })

            toolResults.push({ type: 'tool_result', tool_use_id: r.tool_use_id, content: r.content, is_error: r.is_error })
            await db.insert(schema.coworkerMessages).values({
              conversationId: convId, seq: nextSeq++, role: 'tool',
              content: { tool_use_id: r.tool_use_id, content: r.content, is_error: r.is_error },
            })
          }

          messages.push({ role: 'assistant', content: finalAssistantBlocks })
          messages.push({ role: 'user', content: toolResults })
        }

        // Persiste le message assistant FINAL
        const finalRow = await db.insert(schema.coworkerMessages).values({
          conversationId: convId, seq: nextSeq++, role: 'assistant', content: finalAssistantBlocks,
          meta: {
            model: lastModel, stopReason: lastStopReason,
            inputTokens: cumulInputTokens, outputTokens: cumulOutputTokens,
            cacheReadTokens: cumulCacheR, cacheCreationTokens: cumulCacheW,
            costEur: Number(cumulCost.toFixed(4)),
          },
        }).returning({ id: schema.coworkerMessages.id })

        await db.update(schema.coworkerConversations).set({
          cumulativeCostEur: (conv.cumulativeCostEur ?? 0) + cumulCost,
          cumulativeTokensIn: (conv.cumulativeTokensIn ?? 0) + cumulInputTokens,
          cumulativeTokensOut: (conv.cumulativeTokensOut ?? 0) + cumulOutputTokens,
          model: lastModel,
          updatedAt: new Date().toISOString(),
        }).where(eq(schema.coworkerConversations.id, convId))

        if (conv.title === 'Nouvelle conversation') {
          const proposedTitle = userText.slice(0, 60).split('\n')[0]
          await db.update(schema.coworkerConversations).set({ title: proposedTitle })
            .where(eq(schema.coworkerConversations.id, convId))
        }

        send('usage', {
          inputTokens: cumulInputTokens, outputTokens: cumulOutputTokens,
          costEur: Number(cumulCost.toFixed(4)),
        })
        send('done', { messageId: finalRow[0]?.id, stopReason: lastStopReason })
      } catch (e) {
        console.error('[coworker/stream] error:', e)
        send('error', { message: e instanceof Error ? e.message : String(e) })
      } finally {
        try { controller.close() } catch { /* already closed */ }
      }
    },
  }), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // désactive le buffering nginx/Caddy pour streaming
    },
  })
})
