/**
 * Auth JWT — sign + verify avec jose (JWS HS256).
 * Le secret vient de l'env. Le payload contient : { sub, email, role }.
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { Context, Next } from 'hono'

const SECRET_TEXT = process.env.JWT_SECRET ?? ''
const TTL_HOURS = Number(process.env.JWT_TTL_HOURS ?? 12)

// Refus de démarrer si le secret JWT est manquant, trop court, ou égal à
// la valeur par défaut historique. Sans un vrai secret, n'importe qui peut
// forger un JWT et impersonifier n'importe quel collaborateur.
if (!SECRET_TEXT || SECRET_TEXT === 'CHANGE_ME' || SECRET_TEXT.length < 32) {
  console.error('[auth] FATAL — JWT_SECRET manquant, trop court (<32 chars) ou laissé à CHANGE_ME.')
  console.error('[auth] Génère-en un avec : openssl rand -hex 32')
  console.error('[auth] Puis ajoute JWT_SECRET=<valeur> dans /opt/apolline-api/.env et redémarre le service.')
  process.exit(1)
}

const SECRET = new TextEncoder().encode(SECRET_TEXT)

export type ApollineJwt = JWTPayload & {
  sub: string                                            // collaborateur.id
  email: string
  role: 'admin' | 'courtier' | 'gestionnaire' | 'assistante'
  prenom: string
  nom: string
}

export async function signToken(payload: Omit<ApollineJwt, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL_HOURS}h`)
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<ApollineJwt | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as ApollineJwt
  } catch {
    return null
  }
}

/** Hash mot de passe — version SHA-256 stretching simple, suffisant pour 4 utilisateurs internes.
 *  Pour production sérieuse, remplacer par bcrypt/argon2. */
export async function hashPassword(plain: string, salt = 'apolline'): Promise<string> {
  const data = new TextEncoder().encode(salt + ':' + plain + ':' + salt)
  let buf = data
  for (let i = 0; i < 10_000; i++) {
    buf = new Uint8Array(await crypto.subtle.digest('SHA-256', buf))
  }
  return Buffer.from(buf).toString('hex')
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const recomputed = await hashPassword(plain)
  return recomputed === hash
}

/**
 * Middleware Hono : exige un Bearer JWT valide. Pose `c.set('user', payload)`.
 *
 * Accepte aussi `?_t=<token>` en query string pour les contextes où le header
 * Authorization n'est pas portable (iframe preview, lien direct cliquable…).
 */
export const authMiddleware = async (c: Context, next: Next) => {
  let token: string | null = null
  const auth = c.req.header('Authorization')
  if (auth?.startsWith('Bearer ')) {
    token = auth.slice(7)
  } else {
    const qs = c.req.query('_t')
    if (qs) token = qs
  }
  if (!token) {
    return c.json({ error: 'Token manquant' }, 401)
  }
  const payload = await verifyToken(token)
  if (!payload) {
    return c.json({ error: 'Token invalide ou expiré' }, 401)
  }
  c.set('user', payload)
  await next()
}

/** Helper pour récupérer l'user depuis Hono context (typé). */
export const getUser = (c: Context): ApollineJwt => c.get('user') as ApollineJwt
