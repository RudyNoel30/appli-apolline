/**
 * Routes d'authentification — login (email + mot de passe) et /me.
 * Le mot de passe est vérifié contre le hash stocké en BDD.
 */
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { signToken, verifyPassword, authMiddleware, getUser, hashPassword } from '../middleware/auth.js'
import { notifyChange } from '../realtime/notify.js'
import { sql } from 'drizzle-orm'
import { audit, ctxMeta } from '../lib/audit.js'

export const authRoute = new Hono()

authRoute.post('/login', async (c) => {
  const { email, password } = await c.req.json() as { email?: string; password?: string }
  const meta = ctxMeta(c)
  if (!email || !password) {
    return c.json({ error: 'email + password requis' }, 400)
  }
  const [user] = await db.select().from(schema.collaborateurs).where(eq(schema.collaborateurs.email, email.toLowerCase()))
  if (!user || !user.actif) {
    audit({ action: 'login_failed', userEmail: email.toLowerCase(), details: 'compte inconnu ou inactif', ...meta })
    return c.json({ error: 'Identifiants invalides' }, 401)
  }
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    audit({ action: 'login_failed', userId: user.id, userEmail: user.email, details: 'mauvais mot de passe', ...meta })
    return c.json({ error: 'Identifiants invalides' }, 401)
  }
  // Met à jour le timestamp de dernier accès
  await db.update(schema.collaborateurs)
    .set({ dernierAcces: sql`NOW()` })
    .where(eq(schema.collaborateurs.id, user.id))

  const token = await signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    prenom: user.prenom,
    nom: user.nom,
  })
  audit({ action: 'login', userId: user.id, userEmail: user.email, ...meta })
  // Pas de retour du passwordHash
  const { passwordHash: _ph, ...safeUser } = user
  return c.json({ token, user: safeUser })
})

/**
 * Changement de mot de passe par l'utilisateur lui-même.
 * Vérifie l'ancien mot de passe avant d'accepter le nouveau (≥ 8 chars).
 */
authRoute.post('/change-password', authMiddleware, async (c) => {
  const u = getUser(c)
  const { current, next } = await c.req.json() as { current?: string; next?: string }
  const meta = ctxMeta(c)
  if (!current || !next) return c.json({ error: 'mot de passe actuel et nouveau requis' }, 400)
  if (next.length < 8) return c.json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères' }, 400)

  const [user] = await db.select().from(schema.collaborateurs).where(eq(schema.collaborateurs.id, u.sub))
  if (!user) return c.json({ error: 'user not found' }, 404)
  const ok = await verifyPassword(current, user.passwordHash)
  if (!ok) {
    audit({ action: 'login_failed', userId: u.sub, userEmail: user.email, details: 'change-password : mauvais mot de passe actuel', ...meta })
    return c.json({ error: 'Mot de passe actuel incorrect' }, 401)
  }
  const newHash = await hashPassword(next)
  await db.update(schema.collaborateurs)
    .set({ passwordHash: newHash, updatedAt: sql`NOW()` })
    .where(eq(schema.collaborateurs.id, u.sub))
  audit({ action: 'password_changed', userId: u.sub, userEmail: user.email, ...meta })
  return c.json({ ok: true })
})

authRoute.get('/me', authMiddleware, async (c) => {
  const u = getUser(c)
  const [user] = await db.select().from(schema.collaborateurs).where(eq(schema.collaborateurs.id, u.sub))
  if (!user) return c.json({ error: 'user not found' }, 404)
  const { passwordHash: _ph, ...safeUser } = user
  return c.json(safeUser)
})

/** Permet à l'utilisateur courant de mettre à jour son profil (signature, bio, etc.) */
authRoute.patch('/me', authMiddleware, async (c) => {
  const u = getUser(c)
  const body = await c.req.json() as Record<string, unknown>
  // Whitelist des champs auto-modifiables
  const allowed = ['prenom', 'nom', 'telephone', 'bio', 'signatureHtml', 'signatureAutoInsert', 'avatarGradient', 'avatarAccent']
  const patch: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) patch[k] = body[k]
  patch.updatedAt = sql`NOW()`
  const [updated] = await db.update(schema.collaborateurs).set(patch as never).where(eq(schema.collaborateurs.id, u.sub)).returning()
  if (!updated) return c.json({ error: 'user not found' }, 404)
  await notifyChange({ table: 'collaborateurs', action: 'update', id: u.sub })
  const { passwordHash: _ph, ...safe } = updated
  return c.json(safe)
})
