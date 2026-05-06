import { useMemo, useState } from 'react'
import { Map, Search, Home, Ruler, Leaf, AlertCircle, CheckCircle2, Loader2, Download, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import { eur, pct, dateFr, cn } from '@/lib/utils'
import { exportToHtml } from '@/lib/htmlExport'
import { geocode, fetchMutations, computeStats, decoteDpe, type Mutation, type DvfStats, type Geocoded } from '@/lib/dvf'

type TypeLocal = 'Maison' | 'Appartement' | 'Terrain'
type DpeNote = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

/** Nettoie un n° de voirie DVF : "740.0" → "740", "12 BIS" → "12 bis". */
function cleanAdresse(adresse: string): string {
  if (!adresse) return ''
  // Capitalisation : RUE DU DOCTEUR → Rue du Docteur
  const titleCase = (s: string) =>
    s.toLowerCase().replace(/\b([a-zà-ÿ])/g, (c) => c.toUpperCase())
  // Retire les ".0" sur les n° (ex: "740.0 RUE..." → "740 Rue...")
  return adresse
    .replace(/^(\d+)\.0+(\s|$)/, '$1$2')          // "740.0 " → "740 "
    .replace(/\b(BIS|TER|QUATER)\b/gi, (m) => m.toLowerCase())
    .split(' ')
    .map((w) => /^[A-Z]+$/.test(w) && w.length > 2 ? titleCase(w) : w)
    .join(' ')
}

/** Date courte type "24 juin 2025" en une ligne (pas de wrap vertical). */
function dateCourte(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace('.', '') // janv. → janv (compact)
}

export default function DVF() {
  // ── État du formulaire (controlled) ─────────────────────────────────────
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [typeLocal, setTypeLocal] = useState<TypeLocal>('Maison')
  const [surfaceBatie, setSurfaceBatie] = useState<number>(0)
  const [surfaceAnnexes, setSurfaceAnnexes] = useState<number>(0)
  const [surfaceTerrain, setSurfaceTerrain] = useState<number>(0)
  const [dpe, setDpe] = useState<DpeNote>('D')
  const [prixAcquisition, setPrixAcquisition] = useState<number>(0)
  const [montantEmprunte, setMontantEmprunte] = useState<number>(0)

  // ── État de la requête DVF ──────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [geo, setGeo] = useState<Geocoded | null>(null)
  const [mutations, setMutations] = useState<Mutation[] | null>(null)
  const [stats, setStats] = useState<DvfStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Calculs dérivés ─────────────────────────────────────────────────────
  const valeurs = useMemo(() => {
    if (!stats || stats.count === 0 || surfaceBatie <= 0) return null
    const valeurMediane = stats.prixM2Median * surfaceBatie + (surfaceAnnexes * (stats.prixM2Median * 0.3))
    const valeurBasse = stats.prixM2P25 * surfaceBatie
    const valeurHaute = stats.prixM2P75 * surfaceBatie + (surfaceAnnexes * (stats.prixM2P75 * 0.3))
    const decote = decoteDpe(dpe)
    const valeurRetenue = Math.round(valeurMediane * (1 + decote))
    return {
      mediane: Math.round(valeurMediane),
      basse: Math.round(valeurBasse),
      haute: Math.round(valeurHaute),
      decotePct: decote,
      decoteEur: Math.round(valeurMediane * decote),
      retenue: valeurRetenue,
      bati: Math.round(stats.prixM2Median * surfaceBatie),
      annexes: Math.round(surfaceAnnexes * (stats.prixM2Median * 0.3)),
    }
  }, [stats, surfaceBatie, surfaceAnnexes, dpe])

  const surfinancement = useMemo(() => {
    if (!valeurs || prixAcquisition <= 0) return null
    const ecart = (prixAcquisition - valeurs.retenue) / valeurs.retenue
    const ltv = montantEmprunte > 0 ? montantEmprunte / valeurs.retenue : null
    return {
      ecartPct: ecart,
      ltv,
      // Surfinancement = prix d'achat > 5 % au-dessus de la valeur vénale ET/OU LTV > 100 %
      surfinance: ecart > 0.05 || (ltv != null && ltv > 1.0),
    }
  }, [valeurs, prixAcquisition, montantEmprunte])

  // ── Action : interroger DVF ─────────────────────────────────────────────
  const lancer = async () => {
    if (!adresse.trim()) {
      toast.error('Saisis au moins une adresse pour lancer l\'étude')
      return
    }
    setLoading(true)
    setError(null)
    setMutations(null)
    setStats(null)
    setGeo(null)

    const t = toast.loading('Géocodage de l\'adresse…')
    try {
      const g = await geocode(adresse, codePostal, ville)
      if (!g) {
        toast.error('Adresse introuvable', { id: t, description: 'Vérifie l\'orthographe et le code postal.' })
        setError('Adresse non trouvée par la BAN.')
        setLoading(false)
        return
      }
      setGeo(g)
      // Si l'utilisateur n'a pas saisi le CP/ville, on les déduit de la BAN
      if (!codePostal) setCodePostal(g.postcode)
      if (!ville) setVille(g.city)

      toast.loading('Recherche des mutations DVF dans un rayon de 800 m…', { id: t })
      const muts = await fetchMutations(g, {
        rayon: 800,
        typeLocal: typeLocal !== 'Terrain' ? typeLocal : undefined,
        maxResults: 30,
      })
      setMutations(muts)
      const s = computeStats(muts)
      setStats(s)
      if (s.count === 0) {
        toast.warning('Aucune mutation comparable trouvée dans le rayon', { id: t, description: 'Élargis la recherche manuellement ou utilise les outils notariaux.' })
      } else {
        toast.success(`${s.count} mutation${s.count > 1 ? 's' : ''} trouvée${s.count > 1 ? 's' : ''}`, {
          id: t,
          description: `Médiane : ${eur(s.prixM2Median)}/m² · fourchette ${eur(s.prixM2P25)}–${eur(s.prixM2P75)}/m²`,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[DVF] erreur', msg)
      setError(msg)
      toast.error('Échec de l\'interrogation DVF', { id: t, description: msg.slice(0, 200) })
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setAdresse(''); setCodePostal(''); setVille('')
    setTypeLocal('Maison'); setSurfaceBatie(0); setSurfaceAnnexes(0); setSurfaceTerrain(0)
    setDpe('D'); setPrixAcquisition(0); setMontantEmprunte(0)
    setMutations(null); setStats(null); setGeo(null); setError(null)
    toast.info('Formulaire réinitialisé')
  }

  // ── Export HTML ─────────────────────────────────────────────────────────
  const exportReport = async () => {
    if (!geo || !valeurs) {
      toast.error('Lance d\'abord l\'étude DVF avant d\'exporter')
      return
    }
    const path = await exportToHtml({
      filename: `etude-dvf-${(geo.city || 'bien').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.html`,
      title: 'Étude DVF & contrôle surfinancement',
      subtitle: `${geo.label} · ${new Date().toLocaleDateString('fr-FR')}`,
      eyebrow: 'Valorisation immobilière',
      sections: [
        { kind: 'definition', title: 'Bien valorisé', items: [
          { label: 'Adresse', value: geo.label },
          { label: 'Type', value: typeLocal },
          { label: 'Surface habitable', value: `${surfaceBatie} m²` },
          { label: 'Surface annexes', value: `${surfaceAnnexes} m²` },
          { label: 'Surface terrain', value: `${surfaceTerrain} m²` },
          { label: 'DPE', value: dpe },
          { label: 'Prix d\'acquisition', value: eur(prixAcquisition) },
        ]},
        { kind: 'kpis', items: [
          { label: 'Valeur vénale basse', value: eur(valeurs.basse) },
          { label: 'Valeur vénale médiane', value: eur(valeurs.mediane) },
          { label: 'Valeur vénale haute', value: eur(valeurs.haute) },
          { label: 'Valeur retenue', value: eur(valeurs.retenue), hint: `après décote DPE ${pct(valeurs.decotePct, 1)}` },
        ]},
        ...(mutations && mutations.length > 0 ? [{
          kind: 'table' as const,
          title: `Comparables récents — rayon 800 m (${mutations.length} mutations)`,
          headers: ['Adresse', 'Type', 'Surface', 'Prix', 'Prix /m²', 'Date'],
          rows: mutations.slice(0, 15).map((m) => [
            `${m.adresse}, ${m.codePostal} ${m.ville}`,
            m.typeLocal,
            m.surfaceBati ? `${m.surfaceBati} m²` : '—',
            eur(m.prix),
            m.prixM2 ? eur(m.prixM2) : '—',
            dateFr(m.date),
          ]),
        }] : []),
      ],
    })
    if (path === null) return
    toast.success('Étude DVF exportée en HTML', { description: path !== 'download' ? path : 'Téléchargé' })
  }

  return (
    <>
      <PageHeader
        eyebrow="Valorisation"
        title="Étude DVF"
        description="Interrogation BAN + DVF (Etalab) — fourchette de valeur vénale & contrôle surfinancement."
        actions={
          <>
            <button className="btn-outline" onClick={exportReport} disabled={!valeurs}>
              <Download className="h-4 w-4" /> Exporter l'étude
            </button>
            <button className="btn-gold" onClick={lancer} disabled={loading || !adresse.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Map className="h-4 w-4" />}
              {loading ? 'Analyse…' : 'Lancer l\'étude'}
            </button>
          </>
        }
      />

      <div className="page-body">
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="card p-5">
            <h3 className="font-serif text-lg text-navy-900 mb-1">Bien à valoriser</h3>
            <div className="divider-gold mb-4" />
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Adresse</label>
                <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="input" placeholder="Ex: 14 rue Jeanne d'Arc" />
              </div>
              <div>
                <label className="label">Code postal</label>
                <input value={codePostal} onChange={(e) => setCodePostal(e.target.value)} className="input" placeholder="21000" />
              </div>
              <div>
                <label className="label">Ville</label>
                <input value={ville} onChange={(e) => setVille(e.target.value)} className="input" placeholder="Dijon" />
              </div>
              <div>
                <label className="label">Type</label>
                <select value={typeLocal} onChange={(e) => setTypeLocal(e.target.value as TypeLocal)} className="input">
                  <option>Maison</option>
                  <option>Appartement</option>
                  <option>Terrain</option>
                </select>
              </div>
              <div>
                <label className="label">Surface bâtie (m²)</label>
                <input value={surfaceBatie || ''} onChange={(e) => setSurfaceBatie(Number(e.target.value) || 0)} type="number" className="input" />
              </div>
              <div>
                <label className="label">Surface annexes (m²)</label>
                <input value={surfaceAnnexes || ''} onChange={(e) => setSurfaceAnnexes(Number(e.target.value) || 0)} type="number" className="input" />
              </div>
              <div>
                <label className="label">Surface terrain (m²)</label>
                <input value={surfaceTerrain || ''} onChange={(e) => setSurfaceTerrain(Number(e.target.value) || 0)} type="number" className="input" />
              </div>
              <div>
                <label className="label">DPE</label>
                <select value={dpe} onChange={(e) => setDpe(e.target.value as DpeNote)} className="input">
                  {(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as DpeNote[]).map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Prix d'acquisition (€)</label>
                <input value={prixAcquisition || ''} onChange={(e) => setPrixAcquisition(Number(e.target.value) || 0)} type="number" className="input" placeholder="285000" />
              </div>
              <div>
                <label className="label">Montant emprunté (€)</label>
                <input value={montantEmprunte || ''} onChange={(e) => setMontantEmprunte(Number(e.target.value) || 0)} type="number" className="input" placeholder="245000" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn-primary" onClick={lancer} disabled={loading || !adresse.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Interroger DVF
              </button>
              <button className="btn-outline" onClick={reset}>Réinitialiser</button>
              {geo && (
                <span className="ml-auto text-[11px] text-navy-500 inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {geo.label} (score {(geo.score * 100).toFixed(0)}%)
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="card p-4 border-l-4 border-rose-500 bg-rose-50">
              <div className="text-sm font-semibold text-rose-800">Erreur</div>
              <div className="text-xs text-rose-700">{error}</div>
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-serif text-lg text-navy-900">
                {geo ? `Comparables récents — ${geo.city} (rayon 800 m)` : 'Comparables récents'}
              </h3>
              {mutations && (
                <span className="badge-navy">{mutations.length} mutation{mutations.length > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="divider-gold mb-4" />
            {!mutations ? (
              <div className="py-12 text-center text-sm text-navy-400 italic">
                Saisis l'adresse du bien et clique « Interroger DVF » pour lancer la recherche.
              </div>
            ) : mutations.length === 0 ? (
              <div className="py-12 text-center text-sm text-navy-400 italic">
                Aucune mutation comparable dans un rayon de 800 m sur les 5 dernières années.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '32%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '11%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="table-th">Adresse</th>
                      <th className="table-th text-center">Type</th>
                      <th className="table-th text-right">Surface</th>
                      <th className="table-th text-right">Prix</th>
                      <th className="table-th text-right">€ / m²</th>
                      <th className="table-th text-right">Dist.</th>
                      <th className="table-th text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="list-fast">
                    {mutations.map((m) => {
                      const adresseCourte = cleanAdresse(m.adresse)
                      return (
                        <tr key={m.id} className="hover:bg-navy-50/60 transition-colors duration-150">
                          <td className="table-td font-medium">
                            <div className="truncate" title={`${m.adresse}, ${m.codePostal} ${m.ville}`}>
                              {adresseCourte || <em className="text-navy-300 font-normal">Adresse non géocodée</em>}
                            </div>
                            <div className="text-[10px] text-navy-400 truncate">
                              {m.codePostal} {m.ville}
                            </div>
                          </td>
                          <td className="table-td text-center">
                            <span className="text-[10px] uppercase tracking-wider text-navy-600 bg-navy-50 rounded px-1.5 py-0.5">
                              {m.typeLocal}
                            </span>
                          </td>
                          <td className="table-td text-right tabular-nums">
                            {m.surfaceBati ? `${m.surfaceBati} m²` : '—'}
                          </td>
                          <td className="table-td text-right font-semibold tabular-nums whitespace-nowrap">
                            {eur(m.prix)}
                          </td>
                          <td className="table-td text-right tabular-nums whitespace-nowrap">
                            {m.prixM2 ? eur(m.prixM2) : '—'}
                          </td>
                          <td className="table-td text-right text-xs text-navy-500 tabular-nums">
                            {m.distance != null ? `${Math.round(m.distance)} m` : '—'}
                          </td>
                          <td className="table-td text-right text-xs text-navy-500 whitespace-nowrap">
                            {dateCourte(m.date)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {valeurs ? (
            <>
              <div className="card p-5 bg-gradient-to-br from-navy-900 to-navy-800 text-white">
                <div className="text-[10px] uppercase tracking-wider text-gold-300 font-semibold mb-2">Fourchette valeur vénale</div>
                <div className="font-serif text-3xl font-semibold text-gold-400">
                  {Math.round(valeurs.basse / 1000)} — {Math.round(valeurs.haute / 1000)} k€
                </div>
                <div className="text-xs text-navy-200 mt-1">
                  valeur médiane : <strong className="text-white">{eur(valeurs.mediane)}</strong>
                </div>
                <div className="mt-5 space-y-2 text-xs">
                  <Bar label={`Bâti (${surfaceBatie} m² × ${stats ? eur(stats.prixM2Median) : '—'}/m²)`} value={eur(valeurs.bati)} />
                  {valeurs.annexes > 0 && <Bar label={`Annexes (${surfaceAnnexes} m² × ${eur(Math.round((stats?.prixM2Median ?? 0) * 0.3))}/m²)`} value={eur(valeurs.annexes)} />}
                  <Bar label={`Décote DPE ${dpe} (${pct(valeurs.decotePct, 1)})`} value={`${valeurs.decoteEur >= 0 ? '+' : ''}${eur(valeurs.decoteEur)}`} negative={valeurs.decoteEur < 0} />
                </div>
                <div className="mt-4 pt-4 border-t border-navy-700 flex items-center justify-between">
                  <span className="text-xs text-navy-200">Valeur retenue</span>
                  <span className="font-serif text-xl text-gold-400">{eur(valeurs.retenue)}</span>
                </div>
              </div>

              {surfinancement && prixAcquisition > 0 && (
                <div className="card p-5">
                  <h3 className="font-serif text-base text-navy-900 mb-1">Contrôle surfinancement</h3>
                  <div className="divider-gold mb-4" />
                  <div className="space-y-3">
                    <Metric label="Prix acquisition" value={eur(prixAcquisition)} />
                    <Metric label="Valeur vénale retenue" value={eur(valeurs.retenue)} />
                    <Metric label="Écart (surcote acquéreur)" value={`${surfinancement.ecartPct >= 0 ? '+' : ''}${pct(surfinancement.ecartPct, 1)}`} neutral />
                    {montantEmprunte > 0 && surfinancement.ltv != null && (
                      <>
                        <Metric label="Montant emprunté" value={eur(montantEmprunte)} />
                        <Metric label="LTV sur valeur vénale" value={pct(surfinancement.ltv, 0)} neutral />
                      </>
                    )}
                  </div>
                  <div className={cn(
                    'mt-4 pt-4 border-t border-navy-100 flex items-center gap-2 p-3 rounded-lg',
                    surfinancement.surfinance ? 'bg-rose-50' : 'bg-emerald-50',
                  )}>
                    {surfinancement.surfinance
                      ? <AlertCircle className="h-4 w-4 text-rose-700" />
                      : <CheckCircle2 className="h-4 w-4 text-emerald-700" />}
                    <span className={cn(
                      'text-xs font-semibold',
                      surfinancement.surfinance ? 'text-rose-800' : 'text-emerald-800',
                    )}>
                      {surfinancement.surfinance
                        ? 'Risque de surfinancement bancaire — à valider avec le banquier'
                        : 'Pas de surfinancement bancaire · acceptable'}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card p-5 bg-navy-50 border border-navy-100">
              <div className="text-sm text-navy-600">
                <Map className="h-5 w-5 text-navy-400 mb-2" />
                Lance l'étude pour voir la fourchette de valeur vénale et le contrôle surfinancement.
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-serif text-base text-navy-900 mb-1">À propos de cette étude</h3>
            <div className="divider-gold mb-4" />
            <ul className="space-y-3 text-xs text-navy-700 leading-relaxed">
              <li className="flex gap-2">
                <Home className="h-4 w-4 text-gold-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Données :</strong> DVF Etalab (DGFiP), à jour ~6 mois.
                </span>
              </li>
              <li className="flex gap-2">
                <Ruler className="h-4 w-4 text-gold-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Géocodage :</strong> API BAN (Base Adresse Nationale). Score à vérifier ≥ 80 %.
                </span>
              </li>
              <li className="flex gap-2">
                <Leaf className="h-4 w-4 text-gold-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Décote DPE :</strong> barème SeLoger 2024 — A:+4 % · C:0 · D:−4 % · E:−8 % · F:−13 % · G:−18 %.
                </span>
              </li>
              <li className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Étude indicative — croiser avec un avis de notaire pour les biens atypiques.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}

function Bar({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-navy-200">{label}</span>
      <span className={negative ? 'text-rose-300 font-semibold' : 'text-white font-semibold'}>{value}</span>
    </div>
  )
}

function Metric({ label, value, neutral }: { label: string; value: string; neutral?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-navy-500">{label}</span>
      <span className={neutral ? 'text-navy-700 font-semibold' : 'text-navy-900 font-semibold'}>{value}</span>
    </div>
  )
}
