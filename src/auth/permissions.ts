/**
 * Permissions par rôle Apolline.
 *
 * Modèle simple à 4 rôles :
 *  - admin       : tout (Sébastien)
 *  - courtier    : tout sauf admin BDD/audit/users (Thomas, Damien)
 *  - gestionnaire : peut éditer, pas supprimer (Marine)
 *  - assistante  : lecture seule sur l'essentiel + édition limitée (Julie)
 *
 * Centralisé ici pour pouvoir auditer et durcir d'un seul endroit.
 */
import type { Collaborateur } from '@/data/mock'

export type Role = 'admin' | 'courtier' | 'gestionnaire' | 'assistante'

/** Toutes les permissions possibles dans l'app, listées explicitement. */
export type Permission =
  // Dossiers
  | 'dossier:create'
  | 'dossier:edit'
  | 'dossier:delete'
  | 'dossier:archive'
  | 'dossier:export'
  // Clients / prospects
  | 'client:create'
  | 'client:edit'
  | 'client:delete'
  | 'client:export'
  // Prêts
  | 'pret:create'
  | 'pret:edit'
  | 'pret:delete'
  // Banques & barèmes
  | 'banque:edit'
  | 'banque:delete'
  // Apporteurs
  | 'apporteur:create'
  | 'apporteur:edit'
  | 'apporteur:delete'
  | 'apporteur:import'
  // Collaborateurs (admin)
  | 'collaborateur:create'
  | 'collaborateur:edit'
  | 'collaborateur:delete'
  // Système
  | 'audit:read'
  | 'system:reset'
  | 'system:export_all'

/** Matrice rôle → permissions. Source unique de vérité. */
const ROLE_PERMS: Record<Role, Set<Permission>> = {
  admin: new Set([
    'dossier:create', 'dossier:edit', 'dossier:delete', 'dossier:archive', 'dossier:export',
    'client:create', 'client:edit', 'client:delete', 'client:export',
    'pret:create', 'pret:edit', 'pret:delete',
    'banque:edit', 'banque:delete',
    'apporteur:create', 'apporteur:edit', 'apporteur:delete', 'apporteur:import',
    'collaborateur:create', 'collaborateur:edit', 'collaborateur:delete',
    'audit:read', 'system:reset', 'system:export_all',
  ]),
  courtier: new Set([
    'dossier:create', 'dossier:edit', 'dossier:delete', 'dossier:archive', 'dossier:export',
    'client:create', 'client:edit', 'client:delete', 'client:export',
    'pret:create', 'pret:edit', 'pret:delete',
    'banque:edit',
    'apporteur:create', 'apporteur:edit', 'apporteur:import',
  ]),
  gestionnaire: new Set([
    'dossier:create', 'dossier:edit', 'dossier:archive', 'dossier:export',
    'client:create', 'client:edit', 'client:export',
    'pret:create', 'pret:edit',
    'apporteur:create', 'apporteur:edit',
  ]),
  assistante: new Set([
    'dossier:edit',
    'client:edit',
    'apporteur:create', 'apporteur:edit',
  ]),
}

/** True si le rôle donné a la permission demandée. */
export function hasPermission(role: Role | string | undefined, perm: Permission): boolean {
  if (!role) return false
  const set = ROLE_PERMS[role as Role]
  if (!set) return false
  return set.has(perm)
}

/** Liste lisible des permissions accordées à un rôle (pour Paramètres → Mon profil). */
export function listPermissions(role: Role): Permission[] {
  return Array.from(ROLE_PERMS[role] ?? new Set())
}

/**
 * Hook React (utilisé dans les composants) — wrapper autour du AuthContext.
 * Retourne `can(perm)` + le rôle courant, et la liste des permissions.
 */
export function buildCan(currentUser: Collaborateur | null): {
  can: (perm: Permission) => boolean
  role: Role | null
  isAdmin: boolean
} {
  const role = (currentUser?.role as Role | undefined) ?? null
  return {
    can: (perm: Permission) => hasPermission(role ?? undefined, perm),
    role,
    isAdmin: role === 'admin',
  }
}
