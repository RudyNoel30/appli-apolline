/**
 * Helper code postal → ville via l'API publique geo.api.gouv.fr.
 *
 * Aucun token requis, taux gracieux pour usage métier (pas de quota par IP
 * sur des cabinets de quelques centaines de requêtes/jour). Format réponse :
 *   [{ nom: "Conliège", code: "39167", codesPostaux: ["39570"], ... }, ...]
 *
 * Cas particuliers :
 *   - Paris (75001-75020), Lyon (69001-69009), Marseille (13001-13016) : un
 *     même CP peut renvoyer une seule "commune" (ex: Paris) sans détail par
 *     arrondissement. Pour la simulation Apolline (frais notaire, HCSF), ça
 *     suffit largement.
 *   - DOM-TOM : 5 chiffres aussi (97150, 97400, 97615, etc.).
 *   - CP cedex : pas indexés → renvoient un tableau vide. L'utilisateur saisira
 *     manuellement.
 */
export type GeoCommune = {
  nom: string
  code: string  // code INSEE
  codesPostaux: string[]
  codeDepartement: string
}

const cache = new Map<string, GeoCommune[]>()

/**
 * Recherche les communes correspondant à un code postal français (5 chiffres).
 * Retourne [] si vide / mal formé / pas trouvé. Mise en cache en mémoire pour
 * éviter de rappeler l'API à chaque keystroke.
 */
export async function communesByCodePostal(codePostal: string): Promise<GeoCommune[]> {
  const cp = (codePostal ?? '').trim()
  if (!/^\d{5}$/.test(cp)) return []
  if (cache.has(cp)) return cache.get(cp)!
  try {
    const res = await fetch(
      `https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom,code,codesPostaux,codeDepartement&format=json`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) return []
    const data = (await res.json()) as GeoCommune[]
    cache.set(cp, data)
    return data
  } catch {
    return []  // offline ou DNS down → on laisse l'utilisateur saisir manuellement
  }
}
