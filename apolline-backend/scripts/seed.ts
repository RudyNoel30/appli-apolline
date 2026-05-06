/**
 * Seed Postgres avec les données mock initiales d'Apolline.
 * Idempotent : si une ligne existe déjà (par legacyId / id), elle est mise à jour.
 *
 * Usage :
 *   cp .env.example .env  &&  édite DATABASE_URL
 *   npm run db:push        # crée les tables depuis le schéma
 *   npm run seed           # importe les données initiales
 *
 * Le mot de passe par défaut de tous les collaborateurs est `apolline2026`
 * (cf. AuthContext côté front). À changer après le premier login.
 */
import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db, schema, pool } from '../src/db/index.js'
import { hashPassword } from '../src/middleware/auth.js'

// ─── COLLABORATEURS ───
const COLLABS = [
  { id: 'U001', prenom: 'Sébastien', nom: 'Aujard', email: 'sebastien@groupe-apolline.fr', role: 'admin', roleLabel: 'Courtier · Fondateur', telephone: '06 12 34 56 78', avatarGradient: 'from-navy-700 to-navy-900', avatarAccent: 'text-gold-400', dossiersAssignes: 0 },
  { id: 'U002', prenom: 'Marine', nom: 'Lefèvre', email: 'marine@groupe-apolline.fr', role: 'gestionnaire', roleLabel: 'Gestionnaire de dossiers', telephone: '06 23 45 67 89', avatarGradient: 'from-emerald-600 to-emerald-800', avatarAccent: 'text-white', dossiersAssignes: 0 },
  { id: 'U003', prenom: 'Thomas', nom: 'Bertrand', email: 'thomas@groupe-apolline.fr', role: 'courtier', roleLabel: 'Courtier', telephone: '06 34 56 78 90', avatarGradient: 'from-indigo-600 to-purple-700', avatarAccent: 'text-white', dossiersAssignes: 0 },
  { id: 'U004', prenom: 'Julie', nom: 'Moreau', email: 'julie@groupe-apolline.fr', role: 'assistante', roleLabel: 'Assistante administrative', telephone: '06 45 67 89 01', avatarGradient: 'from-rose-500 to-pink-700', avatarAccent: 'text-white', dossiersAssignes: 0 },
] as const

// ─── BANQUES ───
// Barèmes initiaux indicatifs avril 2026 — à remplacer par les vraies valeurs
// reçues du flash bancaire hebdo via Paramètres → Banques & barèmes.
const BANQUES = [
  { id: 'CEBFC', nom: "Caisse d'Épargne BFC", couleur: '#E60028',
    tauxMoyen: 0.0325, taux15: 0.0305, taux20: 0.0325, taux25: 0.0345,
    taegMoyen: 0.0378, assuranceGroupePct: 0.00340, fraisDossier: 800, dureesMax: 300, dateMaj: '2026-04-01' },
  { id: 'LBP', nom: 'La Banque Postale', couleur: '#FFCC00',
    tauxMoyen: 0.0298, taux15: 0.0278, taux20: 0.0298, taux25: 0.0318,
    taegMoyen: 0.0352, assuranceGroupePct: 0.00315, fraisDossier: 600, dureesMax: 300, dateMaj: '2026-04-01' },
  { id: 'CACE', nom: 'Crédit Agricole CE', couleur: '#009C48',
    tauxMoyen: 0.0315, taux15: 0.0295, taux20: 0.0315, taux25: 0.0335,
    taegMoyen: 0.0368, assuranceGroupePct: 0.00360, fraisDossier: 750, dureesMax: 300, dateMaj: '2026-04-01' },
  { id: 'BPBFC', nom: 'Banque Populaire BFC', couleur: '#0055A4',
    tauxMoyen: 0.0320, taux15: 0.0300, taux20: 0.0320, taux25: 0.0340,
    taegMoyen: 0.0372, assuranceGroupePct: 0.00345, fraisDossier: 700, dureesMax: 300, dateMaj: '2026-04-01' },
  { id: 'SG', nom: 'Société Générale', couleur: '#E30613',
    tauxMoyen: 0.0340, taux15: 0.0320, taux20: 0.0340, taux25: 0.0360,
    taegMoyen: 0.0395, assuranceGroupePct: 0.00370, fraisDossier: 900, dureesMax: 300, dateMaj: '2026-04-01' },
]

async function main() {
  console.log('[seed] Start')
  const defaultHash = await hashPassword('apolline2026')

  // ─── Collaborateurs ───
  for (const c of COLLABS) {
    await db.insert(schema.collaborateurs).values({
      ...c,
      passwordHash: defaultHash,
    }).onConflictDoUpdate({
      target: schema.collaborateurs.id,
      set: {
        prenom: c.prenom,
        nom: c.nom,
        email: c.email,
        role: c.role,
        roleLabel: c.roleLabel,
        telephone: c.telephone,
        avatarGradient: c.avatarGradient,
        avatarAccent: c.avatarAccent,
        updatedAt: sql`NOW()`,
      },
    })
  }
  console.log(`[seed] ${COLLABS.length} collaborateurs`)

  // ─── Banques ───
  for (const b of BANQUES) {
    await db.insert(schema.banques).values(b).onConflictDoUpdate({
      target: schema.banques.id,
      set: { ...b, updatedAt: sql`NOW()` },
    })
  }
  console.log(`[seed] ${BANQUES.length} banques`)

  console.log('[seed] Done. Mot de passe par défaut : apolline2026 (à changer immédiatement)')
  await pool.end()
}

main().catch((err) => {
  console.error('[seed] ERREUR', err)
  process.exit(1)
})
