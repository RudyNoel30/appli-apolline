/**
 * Module DVF — interroge les APIs Etalab/IGN pour récupérer les mutations
 * immobilières (Demandes de Valeurs Foncières / DGFiP) autour d'une adresse.
 *
 * Stack après le décès de cquest.org en 2026 :
 *   1. API BAN (api-adresse.data.gouv.fr) → adresse → lat/lon + code INSEE
 *   2. API IGN ApiCarto (apicarto.ign.fr) → parcelles dans rayon → sections
 *      cadastrales (un dossier DVF est indexé par INSEE + section, pas par
 *      lat/lon)
 *   3. API DVF Etalab (app.dvf.etalab.gouv.fr) → mutations par section
 *   4. Filtre haversine côté client pour ne garder que celles dans le rayon
 *
 * Toutes les APIs sont gouvernementales (.gouv.fr), publiques, CORS-enabled,
 * sans authentification.
 */

export type Geocoded = {
  lat: number
  lon: number
  /** Adresse normalisée renvoyée par la BAN. */
  label: string
  cityCode: string
  postcode: string
  city: string
  /** Score 0-1 de la qualité du géocodage (>0.8 = très fiable). */
  score: number
}

export type Mutation = {
  id: string
  date: string                    // YYYY-MM-DD
  adresse: string
  codePostal: string
  ville: string
  typeLocal: 'Maison' | 'Appartement' | 'Terrain' | 'Local' | string
  surfaceBati?: number             // m²
  surfaceTerrain?: number          // m²
  nbPieces?: number
  prix: number                     // €
  prixM2?: number                  // €/m²
  /** Distance en m depuis le point de référence. */
  distance?: number
}

export type DvfStats = {
  count: number
  prixM2Median: number
  prixM2Min: number
  prixM2Max: number
  prixM2P25: number
  prixM2P75: number
}

/* ─── 1. Géocodage via BAN ─────────────────────────────────────────────── */

export async function geocode(adresse: string, codePostal?: string, ville?: string): Promise<Geocoded | null> {
  const q = [adresse, codePostal, ville].filter(Boolean).join(' ').trim()
  if (!q) return null

  const url = new URL('https://api-adresse.data.gouv.fr/search/')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '1')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`BAN ${res.status}: géocodage impossible`)
  const json = await res.json() as {
    features: Array<{
      geometry: { coordinates: [number, number] }
      properties: { label: string; citycode: string; postcode: string; city: string; score: number }
    }>
  }
  const f = json.features[0]
  if (!f) return null
  const [lon, lat] = f.geometry.coordinates
  return {
    lat, lon,
    label: f.properties.label,
    cityCode: f.properties.citycode,
    postcode: f.properties.postcode,
    city: f.properties.city,
    score: f.properties.score,
  }
}

/* ─── 2. Parcelles dans un rayon via IGN ApiCarto ─────────────────────── */

/**
 * Construit un polygone GeoJSON cercle (32 segments) autour d'un point.
 * Utilisé pour la requête `?geom=...` de l'ApiCarto IGN.
 */
function bufferPolygon(lat: number, lon: number, radiusMeters: number, segments = 32): { type: 'Polygon'; coordinates: Array<Array<[number, number]>> } {
  const coords: Array<[number, number]> = []
  // Approximation pour la France métropolitaine : 1° lat ≈ 111 km, 1° lon ≈ 111 × cos(lat) km
  const latStep = radiusMeters / 111000
  const lonStep = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    coords.push([lon + lonStep * Math.cos(angle), lat + latStep * Math.sin(angle)])
  }
  return { type: 'Polygon', coordinates: [coords] }
}

type Parcelle = { codeInsee: string; sectionPrefixe: string }

async function fetchParcelles(geo: Geocoded, rayon: number): Promise<Parcelle[]> {
  const polygon = bufferPolygon(geo.lat, geo.lon, rayon)
  const url = new URL('https://apicarto.ign.fr/api/cadastre/parcelle')
  url.searchParams.set('geom', JSON.stringify(polygon))
  // Limite raisonnable pour rester rapide ; un rayon 800m couvre ~4-8 sections en ville dense
  url.searchParams.set('_limit', '500')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`IGN ${res.status}: parcelles cadastrales indisponibles`)
  const json = await res.json() as {
    features: Array<{ properties: { code_insee?: string; section?: string } }>
  }

  // Dédup par (insee + section) — l'API DVF Etalab attend `000XX` (5 chars)
  // alors que l'IGN renvoie `XX` (2 chars), donc on padd.
  const dedup = new Map<string, Parcelle>()
  for (const f of json.features) {
    const insee = f.properties.code_insee
    const section = f.properties.section
    if (!insee || !section) continue
    const sectionPrefixe = ('000' + section).slice(-5)
    dedup.set(`${insee}_${sectionPrefixe}`, { codeInsee: insee, sectionPrefixe })
  }
  return [...dedup.values()]
}

/* ─── 3. Mutations DVF par section via Etalab ─────────────────────────── */

type EtalabMutation = {
  id_mutation?: string
  date_mutation?: string
  nature_mutation?: string
  valeur_fonciere?: string | number
  code_commune?: string
  nom_commune?: string
  adresse_numero?: string | number
  adresse_nom_voie?: string
  code_postal?: string | number
  type_local?: string
  surface_reelle_bati?: string | number
  surface_terrain?: string | number
  nombre_pieces_principales?: string | number
  longitude?: string | number
  latitude?: string | number
}

const TYPE_MAP: Record<string, Mutation['typeLocal']> = {
  'Maison': 'Maison',
  'Appartement': 'Appartement',
  'Local industriel. commercial ou assimilé': 'Local',
}

function num(v: unknown): number | undefined {
  if (v == null) return undefined
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isFinite(n) ? n : undefined
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchMutationsBySection(insee: string, section: string): Promise<EtalabMutation[]> {
  const res = await fetch(`https://app.dvf.etalab.gouv.fr/api/mutations3/${insee}/${section}`)
  if (!res.ok) {
    // Pas toutes les sections ont des mutations → 404 toléré
    if (res.status === 404) return []
    throw new Error(`Etalab DVF ${res.status} (${insee}/${section})`)
  }
  const json = await res.json() as { mutations?: EtalabMutation[] }
  return json.mutations ?? []
}

/**
 * Récupère les mutations DVF dans un rayon autour d'un point géocodé.
 *
 * Pipeline :
 *  1) IGN ApiCarto → parcelles dans le rayon → sections cadastrales uniques
 *  2) Etalab → mutations par section (en parallèle)
 *  3) Filtre haversine pour ne garder que celles dans le rayon (les sections
 *     peuvent dépasser le cercle)
 *  4) Filtre type_local + prix/m² aberrant
 */
export async function fetchMutations(
  geo: Geocoded,
  opts: { rayon?: number; typeLocal?: string; maxResults?: number } = {},
): Promise<Mutation[]> {
  const rayon = opts.rayon ?? 800

  const parcelles = await fetchParcelles(geo, rayon)
  if (parcelles.length === 0) return []

  // Limiter à 20 sections max pour éviter de spammer si rayon urbain dense
  const sections = parcelles.slice(0, 20)

  const results = await Promise.all(
    sections.map((p) =>
      fetchMutationsBySection(p.codeInsee, p.sectionPrefixe).catch((e) => {
        console.warn('[DVF] section échec', p, e)
        return [] as EtalabMutation[]
      }),
    ),
  )
  const allMutations = results.flat()

  // Dédup par id_mutation
  const seen = new Set<string>()
  const dedup: EtalabMutation[] = []
  for (const m of allMutations) {
    const id = m.id_mutation ? String(m.id_mutation) : `${m.date_mutation}_${m.adresse_numero}_${m.adresse_nom_voie}`
    if (seen.has(id)) continue
    seen.add(id)
    dedup.push(m)
  }

  // Mapping + filtre rayon (haversine) + filtre type
  const wantType = opts.typeLocal && opts.typeLocal !== 'Terrain' ? opts.typeLocal : null
  const out: Mutation[] = []
  for (const m of dedup) {
    const lat = num(m.latitude)
    const lon = num(m.longitude)
    const distance = lat != null && lon != null ? haversine(geo.lat, geo.lon, lat, lon) : undefined
    if (distance != null && distance > rayon) continue

    const type = TYPE_MAP[m.type_local ?? ''] ?? m.type_local ?? 'Local'
    if (wantType && type !== wantType) continue

    const prix = num(m.valeur_fonciere)
    if (!prix || prix < 1000) continue

    const surfaceBati = num(m.surface_reelle_bati)
    const prixM2 = surfaceBati && surfaceBati > 0 ? Math.round(prix / surfaceBati) : undefined

    // Filtre aberrants : prix/m² < 200 (terrain) ou > 30 000 (lots, données erronées)
    if (prixM2 != null && (prixM2 < 200 || prixM2 > 30_000)) continue

    const adresse = [m.adresse_numero, m.adresse_nom_voie].filter(Boolean).join(' ').trim()
    out.push({
      id: String(m.id_mutation ?? `${m.date_mutation}_${adresse}_${prix}`),
      date: m.date_mutation ?? '',
      adresse,
      codePostal: String(m.code_postal ?? ''),
      ville: m.nom_commune ?? '',
      typeLocal: type as Mutation['typeLocal'],
      surfaceBati,
      surfaceTerrain: num(m.surface_terrain),
      nbPieces: num(m.nombre_pieces_principales),
      prix,
      prixM2,
      distance,
    })
  }

  // Tri : date desc puis distance
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return (a.distance ?? 0) - (b.distance ?? 0)
  })
  return out.slice(0, opts.maxResults ?? 50)
}

/* ─── 4. Stats agrégées ────────────────────────────────────────────────── */

export function computeStats(mutations: Mutation[]): DvfStats {
  const prixM2 = mutations.map((m) => m.prixM2).filter((v): v is number => v != null).sort((a, b) => a - b)
  if (prixM2.length === 0) {
    return { count: 0, prixM2Median: 0, prixM2Min: 0, prixM2Max: 0, prixM2P25: 0, prixM2P75: 0 }
  }
  const q = (p: number) => {
    const idx = Math.floor((prixM2.length - 1) * p)
    return prixM2[idx]
  }
  return {
    count: prixM2.length,
    prixM2Median: q(0.5),
    prixM2P25: q(0.25),
    prixM2P75: q(0.75),
    prixM2Min: prixM2[0],
    prixM2Max: prixM2[prixM2.length - 1],
  }
}

/**
 * Décote DPE simplifiée (barème courtage usuel — ajustable).
 * Source : étude SeLoger 2024 + référentiel DGEC.
 */
const DPE_DECOTE: Record<string, number> = {
  A: 0.04, B: 0.02, C: 0.0, D: -0.04, E: -0.08, F: -0.13, G: -0.18,
}
export function decoteDpe(dpe: string): number {
  return DPE_DECOTE[dpe.toUpperCase()] ?? 0
}
