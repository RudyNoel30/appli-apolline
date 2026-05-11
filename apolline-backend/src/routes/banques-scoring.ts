/**
 * Route /api/banques/scoring — stats d'accord par banque sur 12 mois glissants.
 *
 * Pour chaque banque ayant reçu au moins 2 prêts envoyés sur les 12 derniers
 * mois, calcule :
 *   - envois     : nombre de prêts envoyés (statuts propose / accorde / refuse / signe / offre_editee)
 *   - accords    : nombre de prêts acceptés (accorde / offre_editee / signe)
 *   - tauxAccordPct : ratio en %
 *   - derniereActivite : date du dernier prêt traité avec cette banque
 *
 * Utilisé par :
 *   - Badge dans PretEditor (sélecteur de banque)
 *   - Page stats dans Paramètres → Performances banques
 */
import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

export const banquesScoringRoute = new Hono()

banquesScoringRoute.get('/scoring', authMiddleware, async (c) => {
  const rows = await db.execute(sql`
    SELECT
      COALESCE(banque, 'Inconnue') AS banque,
      COUNT(*) FILTER (WHERE statut IN ('propose', 'accorde', 'offre_editee', 'signe', 'refuse')) AS envois,
      COUNT(*) FILTER (WHERE statut IN ('accorde', 'offre_editee', 'signe')) AS accords,
      MAX(updated_at) AS derniere_activite
    FROM prets
    WHERE created_at >= NOW() - INTERVAL '12 months'
      AND banque IS NOT NULL
      AND banque <> ''
    GROUP BY banque
    HAVING COUNT(*) >= 2
    ORDER BY accords DESC, envois DESC
  `)

  type Row = {
    banque: string
    envois: number | string
    accords: number | string
    derniere_activite: string | null
  }

  const result = (rows.rows as unknown as Row[]).map((r) => {
    const envois = Number(r.envois) || 0
    const accords = Number(r.accords) || 0
    return {
      banque: r.banque,
      envois,
      accords,
      tauxAccordPct: envois > 0 ? Math.round((accords / envois) * 100) : 0,
      derniereActivite: r.derniere_activite,
    }
  })

  return c.json(result)
})
