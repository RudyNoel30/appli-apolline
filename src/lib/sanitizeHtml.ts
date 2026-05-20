/**
 * Sanitization HTML basée sur DOMParser — robuste contre XSS.
 *
 * Pourquoi pas une RegEx : impossible de parser correctement du HTML avec une
 * RegEx, et toutes les variantes (entités hex, breaks malformés, attributs sans
 * quotes…) créent des vecteurs d'évasion. L'API native DOMParser parse le HTML
 * dans un document inerte (pas d'exécution de scripts ni de requêtes réseau),
 * puis on walk l'arbre pour appliquer une whitelist stricte.
 *
 * Usage :
 *   - Mails entrants (Outlook Graph) avant affichage dans l'iframe srcdoc
 *   - HTML collé dans l'éditeur d'email (Word/Outlook/web)
 *   - Signature courtier (Paramètres) avant aperçu via dangerouslySetInnerHTML
 *
 * Politique :
 *   - Tags : whitelist stricte (texte, mise en forme basique, tables, liens, images)
 *   - Tags hors whitelist : supprimés MAIS contenu (texte enfants) préservé
 *   - Attributs : whitelist + handlers on* interdits + URL schemes validés
 *   - Style inline : retiré si contient expression(), @import ou url(javascript:)
 *   - Liens : target=_blank rel=noopener noreferrer forcés
 *   - Commentaires : supprimés (conditional comments Outlook = vecteur d'évasion)
 */

const ALLOWED_TAGS = new Set([
  // Texte
  'p', 'br', 'div', 'span', 'hr',
  // Mise en forme
  'b', 'i', 'u', 'strong', 'em', 'strike', 's', 'sub', 'sup', 'font', 'mark', 'small',
  // Titres
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Listes
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // Media + liens
  'img', 'a',
  // Code / quote
  'blockquote', 'pre', 'code',
])

const ALLOWED_ATTRS = new Set([
  // Standards
  'href', 'src', 'alt', 'title', 'target', 'rel',
  'style', 'class',
  // Mise en page table / image
  'width', 'height', 'align', 'valign',
  'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing', 'bgcolor',
  // <font> legacy mais toléré dans les mails Outlook
  'color', 'face', 'size',
])

/** Schèmes d'URL autorisés pour href/src (préfixes minuscules). */
const SAFE_URL_PREFIXES = ['http:', 'https:', 'mailto:', 'tel:', 'cid:', 'data:image/']

function isSafeUrl(raw: string): boolean {
  const trimmed = (raw ?? '').trim().toLowerCase()
  if (!trimmed) return true
  // URL relatives, ancres, paths
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('./') || trimmed.startsWith('../')) return true
  return SAFE_URL_PREFIXES.some((p) => trimmed.startsWith(p))
}

/** Retourne true si le style contient une expression dangereuse à supprimer */
function styleIsDangerous(styleValue: string): boolean {
  const v = (styleValue ?? '').toLowerCase()
  return v.includes('expression(') || v.includes('javascript:') || v.includes('@import') || v.includes('behavior:')
}

/**
 * Désinfecte une chaîne HTML — retourne du HTML sûr pour innerHTML / srcdoc.
 *
 * Si l'entrée est vide ou null → retourne ''.
 * Performance : un seul parse + un walk DOM. ~ms pour des mails Outlook de
 * 100 Ko. Pour les très gros HTML (> 1 Mo, rare), le coût est linéaire.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return ''

  const parser = new DOMParser()
  const doc = parser.parseFromString(input, 'text/html')

  const walk = (parent: Node): void => {
    // On capture les enfants AVANT la mutation pour éviter de skipper des nodes
    // (les enfants insérés par replaceWith ne doivent pas être visités en boucle).
    const children = Array.from(parent.childNodes)
    for (const node of children) {
      // Commentaires : supprimés systématiquement (les "conditional comments"
      // Office <!--[if mso]>…<![endif]--> sont un vecteur classique d'évasion).
      if (node.nodeType === Node.COMMENT_NODE) {
        node.remove()
        continue
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue
      const el = node as HTMLElement
      const tag = el.tagName.toLowerCase()

      // Tags namespacés Office (o:p, w:WordDocument, v:shape…) : on déballe
      // (= remplace par enfants), pas de suppression brutale pour préserver le texte.
      if (tag.includes(':')) {
        const kids = Array.from(el.childNodes)
        el.replaceWith(...kids)
        kids.forEach(walk)
        continue
      }

      // Tag hors whitelist : pareil, on déballe (préserve le contenu textuel).
      // Spécial : <script>, <style>, <iframe>, <object>, <embed>, <link>, <meta>
      // sont absents de la whitelist → ils tombent ici et leur contenu n'est
      // PAS exécuté car il n'a jamais été inséré dans le document live.
      if (!ALLOWED_TAGS.has(tag)) {
        // Pour <script> et <style>, on supprime carrément (pas de "contenu utile")
        if (tag === 'script' || tag === 'style' || tag === 'iframe'
            || tag === 'object' || tag === 'embed' || tag === 'link' || tag === 'meta'
            || tag === 'noscript' || tag === 'base') {
          el.remove()
        } else {
          const kids = Array.from(el.childNodes)
          el.replaceWith(...kids)
          kids.forEach(walk)
        }
        continue
      }

      // Tag autorisé → on nettoie ses attributs
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase()
        const value = attr.value

        // Tout handler on* (onload, onclick, onerror, onmouseover…) : kill
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name)
          continue
        }

        // xmlns:* / xml:* : pollution Office
        if (name.startsWith('xmlns') || name.startsWith('xml:')) {
          el.removeAttribute(attr.name)
          continue
        }

        // Hors whitelist
        if (!ALLOWED_ATTRS.has(name)) {
          el.removeAttribute(attr.name)
          continue
        }

        // href / src : vérifier le schéma
        if ((name === 'href' || name === 'src') && !isSafeUrl(value)) {
          el.removeAttribute(attr.name)
          continue
        }

        // style : retirer si expression() / @import / javascript: / behavior:
        if (name === 'style' && styleIsDangerous(value)) {
          el.removeAttribute(attr.name)
          continue
        }
      }

      // Sécurité forcée sur les liens : pas de window.opener / pas de same-tab
      if (tag === 'a' && el.hasAttribute('href')) {
        el.setAttribute('target', '_blank')
        el.setAttribute('rel', 'noopener noreferrer')
      }

      // Récursion dans les enfants (qui peuvent eux-mêmes contenir des tags
      // hors whitelist à nettoyer).
      walk(el)
    }
  }

  walk(doc.body)
  return doc.body.innerHTML
}

/**
 * Variante "strict text only" — supprime TOUT le HTML et retourne le texte brut.
 * Pour les previews qui ne doivent jamais rendre de mise en forme.
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return ''
  const tmp = document.createElement('div')
  // Bypass : on utilise innerHTML mais en ne lisant que textContent après —
  // les scripts inline ne s'exécutent pas dans un node détaché.
  tmp.innerHTML = sanitizeHtml(input)
  return tmp.textContent || ''
}
