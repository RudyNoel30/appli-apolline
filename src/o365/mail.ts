/**
 * Service Microsoft Graph — mail (Outlook M365)
 * Lecture inbox, lecture message, envoi, réponse.
 */
import { getAccessToken } from './msal'
import { O365_CLIENT_ID, O365_TENANT_ID } from './config'

const GRAPH = 'https://graph.microsoft.com/v1.0'

/** Email tel que renvoyé par /me/messages (forme légère) */
export type GraphMail = {
  id: string
  subject: string
  bodyPreview: string
  importance: 'low' | 'normal' | 'high'
  isRead: boolean
  isDraft: boolean
  hasAttachments: boolean
  receivedDateTime: string
  sentDateTime?: string
  from?: { emailAddress: { name?: string; address: string } }
  toRecipients?: { emailAddress: { name?: string; address: string } }[]
  ccRecipients?: { emailAddress: { name?: string; address: string } }[]
  conversationId?: string
  webLink?: string
  flag?: { flagStatus: 'notFlagged' | 'flagged' | 'complete' }
  categories?: string[]
}

/** Email avec corps complet */
export type GraphMailFull = GraphMail & {
  body: { contentType: 'text' | 'html'; content: string }
  internetMessageHeaders?: { name: string; value: string }[]
  attachments?: GraphAttachment[]
}

export type GraphAttachment = {
  id: string
  name: string
  contentType: string
  size: number
  isInline: boolean
  /** Référence CID utilisée dans le HTML : <img src="cid:XXX">. Présent uniquement pour les inline. */
  contentId?: string
  /** Contenu base64 (présent quand on demande $expand=attachments sans $select restrictif). */
  contentBytes?: string
}

export type MailFolder = {
  id: string
  displayName: string
  unreadItemCount: number
  totalItemCount: number
  parentFolderId?: string
  childFolderCount: number
  /** Profondeur dans l'arborescence (0 = racine). Rempli par listMailFolders. */
  depth?: number
}

async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken(O365_CLIENT_ID, O365_TENANT_ID)
  if (!token) throw new Error('Non connecté à Microsoft 365')
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Graph ${res.status}: ${text.slice(0, 200)}`)
  }
  return res
}

/**
 * Liste TOUS les dossiers Outlook récursivement (inbox, sent, drafts, sous-dossiers personnalisés…).
 * Aplatit l'arborescence en ordre profondeur-d'abord avec un champ `depth` pour l'affichage indenté.
 * Préserve l'ordre canonique Outlook au top-level (Inbox, Drafts, Sent, etc.) et place les
 * dossiers "Archive" / "Archives" à la fin de la liste racine.
 */
export async function listMailFolders(): Promise<MailFolder[]> {
  // Niveau racine — pas d'$orderby pour garder l'ordre canonique Outlook
  const res = await authedFetch(`${GRAPH}/me/mailFolders?$top=100`)
  const json = await res.json()
  const roots = (json.value as MailFolder[]).map((f) => ({ ...f, depth: 0 }))

  // Sépare Archive(s) du reste pour le mettre à la fin
  const isArchive = (f: MailFolder) => /^archives?$/i.test(f.displayName.trim())
  const normal = roots.filter((r) => !isArchive(r))
  const archives = roots.filter((r) => isArchive(r))

  const result: MailFolder[] = []
  for (const root of [...normal, ...archives]) {
    result.push(root)
    if (root.childFolderCount > 0) {
      await appendChildren(root.id, 1, result)
    }
  }
  return result
}

/** Récupère récursivement les sous-dossiers d'un dossier parent et les ajoute à `out`. */
async function appendChildren(parentId: string, depth: number, out: MailFolder[]): Promise<void> {
  const res = await authedFetch(
    `${GRAPH}/me/mailFolders/${parentId}/childFolders?$top=100&$orderby=displayName`,
  )
  const json = await res.json()
  const children = (json.value as MailFolder[]).map((f) => ({ ...f, depth }))
  for (const child of children) {
    out.push(child)
    if (child.childFolderCount > 0) {
      await appendChildren(child.id, depth + 1, out)
    }
  }
}

/**
 * Liste les messages d'un dossier (par défaut Inbox).
 * Tri par date desc, top 50 par défaut.
 */
export async function listMessages(opts: {
  folderId?: string
  top?: number
  search?: string
  filter?: string
} = {}): Promise<GraphMail[]> {
  const top = opts.top ?? 50
  const folderPath = opts.folderId ? `mailFolders/${opts.folderId}/messages` : 'messages'
  const params = new URLSearchParams()
  params.set('$top', String(top))
  params.set('$select', 'id,subject,bodyPreview,importance,isRead,isDraft,hasAttachments,receivedDateTime,sentDateTime,from,toRecipients,ccRecipients,conversationId,webLink,flag,categories')

  if (opts.search) {
    params.set('$search', `"${opts.search.replace(/"/g, '\\"')}"`)
  } else {
    // $orderby ne fonctionne pas avec $search
    params.set('$orderby', 'receivedDateTime desc')
    if (opts.filter) params.set('$filter', opts.filter)
  }

  const res = await authedFetch(`${GRAPH}/me/${folderPath}?${params.toString()}`)
  const json = await res.json()
  return json.value as GraphMail[]
}

/**
 * Récupère le contenu complet d'un message (body HTML + attachments).
 * Note : on ne fait PAS $select sur les attachments → contentBytes est inclus,
 * ce qui permet d'inliner les images CID directement dans le viewer.
 */
export async function getMessage(id: string): Promise<GraphMailFull> {
  const res = await authedFetch(`${GRAPH}/me/messages/${id}?$expand=attachments`)
  return res.json()
}

/**
 * Remplace les références <img src="cid:XXX"> dans un HTML par des data:URI
 * en utilisant les attachments inline (signatures Outlook, logos, etc.).
 * Retourne le HTML modifié.
 */
export function inlineCidImages(html: string, attachments: GraphAttachment[] | undefined): string {
  if (!attachments?.length) return html
  let result = html
  for (const att of attachments) {
    if (!att.isInline || !att.contentBytes || !att.contentId) continue
    const dataUrl = `data:${att.contentType};base64,${att.contentBytes}`
    // Échappe le contentId pour la regex (peut contenir des caractères spéciaux)
    const cidEscaped = att.contentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match src="cid:..." et src='cid:...' (insensitive case)
    const re = new RegExp(`src=(["'])cid:${cidEscaped}\\1`, 'gi')
    result = result.replace(re, `src="${dataUrl}"`)
  }
  return result
}

/** Marque un message comme lu/non-lu. */
export async function setMessageRead(id: string, isRead: boolean): Promise<void> {
  await authedFetch(`${GRAPH}/me/messages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isRead }),
  })
}

/** Catégorise un message (Apolline utilise les catégories Outlook pour tagger par dossier) */
export async function setMessageCategories(id: string, categories: string[]): Promise<void> {
  await authedFetch(`${GRAPH}/me/messages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ categories }),
  })
}

/** Supprime un message (le déplace dans Éléments supprimés). */
export async function deleteMessage(id: string): Promise<void> {
  await authedFetch(`${GRAPH}/me/messages/${id}`, { method: 'DELETE' })
}

export type SendMailInput = {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  isHtml?: boolean
  /** Référence Apolline tagguée dans les headers internet (suivi dossier) */
  apollineDossierRef?: string
  /** Catégorie Outlook à appliquer (suivi par dossier) */
  category?: string
  /** PJ : { name, contentBytes (base64), contentType } */
  attachments?: { name: string; contentBytes: string; contentType: string }[]
}

/** Envoie un nouveau message. */
export async function sendMail(input: SendMailInput): Promise<void> {
  const message: any = {
    subject: input.subject,
    body: {
      contentType: input.isHtml ? 'html' : 'text',
      content: input.body,
    },
    toRecipients: input.to.map((address) => ({ emailAddress: { address } })),
  }
  if (input.cc?.length) message.ccRecipients = input.cc.map((address) => ({ emailAddress: { address } }))
  if (input.bcc?.length) message.bccRecipients = input.bcc.map((address) => ({ emailAddress: { address } }))
  if (input.category) message.categories = [input.category]
  if (input.apollineDossierRef) {
    message.singleValueExtendedProperties = [
      // Header X-Apolline-Dossier custom — suivi dossier
      { id: 'String 0x7D', value: input.apollineDossierRef },
    ]
  }
  if (input.attachments?.length) {
    message.attachments = input.attachments.map((a) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.name,
      contentType: a.contentType,
      contentBytes: a.contentBytes,
    }))
  }

  await authedFetch(`${GRAPH}/me/sendMail`, {
    method: 'POST',
    body: JSON.stringify({ message, saveToSentItems: true }),
  })
}

/** Répondre à un message. */
export async function replyMail(messageId: string, body: string, replyAll = false): Promise<void> {
  const path = replyAll ? 'replyAll' : 'reply'
  await authedFetch(`${GRAPH}/me/messages/${messageId}/${path}`, {
    method: 'POST',
    body: JSON.stringify({
      message: { body: { contentType: 'html', content: body } },
    }),
  })
}

/** Transférer un message. */
export async function forwardMail(messageId: string, to: string[], comment?: string): Promise<void> {
  await authedFetch(`${GRAPH}/me/messages/${messageId}/forward`, {
    method: 'POST',
    body: JSON.stringify({
      comment: comment ?? '',
      toRecipients: to.map((address) => ({ emailAddress: { address } })),
    }),
  })
}

/** Récupère le contenu base64 d'une pièce jointe. */
export async function getAttachmentContent(messageId: string, attachmentId: string): Promise<string> {
  const res = await authedFetch(`${GRAPH}/me/messages/${messageId}/attachments/${attachmentId}`)
  const json = await res.json()
  return json.contentBytes as string
}

/** Helper : extrait l'adresse email d'un destinataire/expéditeur. */
export function extractAddresses(mail: GraphMail): string[] {
  const addrs: string[] = []
  if (mail.from?.emailAddress.address) addrs.push(mail.from.emailAddress.address.toLowerCase())
  mail.toRecipients?.forEach((r) => addrs.push(r.emailAddress.address.toLowerCase()))
  mail.ccRecipients?.forEach((r) => addrs.push(r.emailAddress.address.toLowerCase()))
  return Array.from(new Set(addrs))
}
