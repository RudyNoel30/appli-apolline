import { useEffect, useMemo, useState } from 'react'
import { Folder, FileText, CheckCircle2, XCircle, Clock, AlertTriangle, ExternalLink, Download, Loader2, RefreshCw, Upload, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import PiecePreviewModal from '@/components/PiecePreviewModal'
import { piecesAttendues, piecesByCategorie, type PieceAttendue } from '@/data/mock'
import { useStore } from '@/stores/useStore'
import { cn, dateFr } from '@/lib/utils'
import { saveFile, FILTERS } from '@/lib/saveFile'
import { pieces as piecesApi, type PieceMeta } from '@/db/api'

export default function Pieces() {
  const dossiers = useStore((s) => s.dossiers)
  const clients = useStore((s) => s.clients)

  const [selectedDossier, setSelectedDossier] = useState(dossiers[0]?.id ?? '')
  const dossier = dossiers.find((d) => d.id === selectedDossier) ?? dossiers[0]
  const client = dossier ? clients.find((c) => c.id === dossier.clientId) : null
  const [categorie, setCategorie] = useState<'all' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5'>('all')

  // Pièces uploadées en local (filesystem VPS)
  const [list, setList] = useState<PieceMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(0)
  const [previewing, setPreviewing] = useState<PieceMeta | null>(null)

  const reload = async () => {
    if (!dossier) return
    setLoading(true); setError(null)
    try {
      const rows = await piecesApi.list(dossier.id)
      setList(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedDossier])

  if (!dossier) {
    return (
      <>
        <PageHeader eyebrow="Pièces & classement" title="Pièces" />
        <div className="card p-8 text-center text-navy-500">
          Aucun dossier disponible. Créez-en un depuis la page Nouveau dossier.
        </div>
      </>
    )
  }

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setUploading((n) => n + arr.length)
    const t = arr.length > 1
      ? toast.loading(`Upload 0 / ${arr.length} pièce${arr.length > 1 ? 's' : ''}…`)
      : toast.loading(`Upload "${arr[0]!.name}"…`)
    try {
      const result = await piecesApi.upload(dossier.id, arr, {
        onProgress: (done, total) => {
          if (total > 1) toast.loading(`Upload ${done} / ${total} pièces…`, { id: t })
        },
      })
      if (result.errors.length > 0) {
        for (const err of result.errors) toast.error(err.filename, { description: err.error })
      }
      if (result.inserted > 0) {
        toast.success(`${result.inserted} pièce${result.inserted > 1 ? 's' : ''} uploadée${result.inserted > 1 ? 's' : ''}`, { id: t })
        await reload()
      } else {
        toast.dismiss(t)
      }
    } catch (e) {
      toast.error('Échec upload', { id: t, description: e instanceof Error ? e.message : String(e) })
    } finally {
      setUploading((n) => Math.max(0, n - arr.length))
    }
  }

  const handleDownload = async (p: PieceMeta) => {
    try { await piecesApi.download(p.id, p.filename) }
    catch (e) { toast.error('Échec téléchargement', { description: e instanceof Error ? e.message : String(e) }) }
  }

  // ── Matching référentiel ↔ fichiers réels ──────────────────────────────
  const safe = (s: unknown): string => (typeof s === 'string' ? s : '')
  const normalize = (s: string): string =>
    s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[_\-./'()\[\],]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const tokens = (s: string): Set<string> => {
    const out = new Set<string>()
    for (const raw of normalize(s).split(' ')) {
      // ≥ 2 chars pour conserver les abréviations courantes (BS, CC, EP, AV, IR, PC, TH, TF, MRH…)
      if (raw.length < 2) continue
      // Exclure tokens purement numériques (dates, montants, n° page)
      if (/^\d+$/.test(raw)) continue
      // Extensions de fichier
      if (/^(pdf|png|jpe?g|docx?|xlsx?|odt|odp|ods|zip)$/.test(raw)) continue
      // Stop-words FR (articles, prépositions, abréviations civiles courantes)
      if (/^(les?|des?|une?|aux?|sur|par|pour|avec|sans|dans|chez|que|qui|nos|vos|du|la|le|et|ou|en|au|mr|mme|mlle|me|mes|ses|sa|son)$/.test(raw)) continue
      out.add(raw)
      if (raw.endsWith('s') || raw.endsWith('x')) out.add(raw.slice(0, -1))
    }
    return out
  }
  // Synonymes / abréviations courantes de l'apport courtage
  const SYNONYMES: Array<{ pattern: RegExp; aliases: string[] }> = [
    { pattern: /cni|passeport|identit/i, aliases: ['cni', 'passeport', 'identite', 'piece', 'cin'] },
    { pattern: /livret\s*de\s*famille/i, aliases: ['livret', 'famille', 'lf'] },
    { pattern: /domicile/i, aliases: ['domicile', 'edf', 'engie', 'orange', 'sfr', 'free', 'facture', 'justif', 'dom'] },
    { pattern: /mariage|pacs/i, aliases: ['mariage', 'pacs', 'union'] },
    { pattern: /divorce/i, aliases: ['divorce', 'jugement'] },
    { pattern: /contrat\s*de\s*travail/i, aliases: ['contrat', 'travail', 'cdi', 'cdd', 'embauche'] },
    // Bulletin de salaire : couvre BS, CIBTP, fiche de paie, paie, etc.
    { pattern: /bulletin|salaire|paie/i, aliases: ['bulletin', 'paie', 'salaire', 'fiche', 'bs', 'cibtp', 'fdp'] },
    // Avis d'imposition : couvre IRPP (impôt sur le revenu personnes physiques)
    { pattern: /avis\s*d?\s*imposition|imposition|imp[oô]ts?/i, aliases: ['avis', 'imposition', 'impot', 'avi', 'irpp', 'ir'] },
    { pattern: /bilan/i, aliases: ['bilan', 'liasse', 'fiscal'] },
    // Relevés bancaires : couvre Rdc, RIB, CC, CA (compte courant), Cheq
    { pattern: /relev[ée]\s*de\s*compte|relev[ée]\s*bancaire|relev[ée]/i, aliases: ['releve', 'compte', 'rib', 'banque', 'rdc', 'cc', 'cheq'] },
    // Épargne : couvre Ep, AV (assurance vie), LDD, PEL, PEA, Livret, etc.
    { pattern: /[ée]pargne|livret|av\b|pel|pea|ldd/i, aliases: ['epargne', 'livret', 'ldd', 'pel', 'cel', 'pea', 'av', 'assurancevie', 'ep'] },
    { pattern: /titre.*propri/i, aliases: ['titre', 'propriete', 'acte', 'notarie'] },
    { pattern: /tableau.*amort|[ée]ch[ée]ancier/i, aliases: ['tableau', 'amortissement', 'echeancier'] },
    { pattern: /quittance.*loyer|loyer|bail/i, aliases: ['quittance', 'loyer', 'bail', 'location'] },
    { pattern: /taxe\s*fonci|taxe\s*habit/i, aliases: ['taxe', 'fonciere', 'habitation', 'th', 'tf'] },
    { pattern: /assurance.*habit|mrh/i, aliases: ['assurance', 'habitation', 'mrh', 'multirisque'] },
    { pattern: /cr[ée]dit/i, aliases: ['credit', 'pret', 'echeancier'] },
    { pattern: /compromis|promesse.*vente/i, aliases: ['compromis', 'promesse', 'vente'] },
    { pattern: /diagnostic|dpe/i, aliases: ['diagnostic', 'dpe', 'amiante', 'plomb', 'ddt'] },
    { pattern: /devis|travaux/i, aliases: ['devis', 'travaux', 'artisan', 'plan'] },
    { pattern: /permis.*construire/i, aliases: ['permis', 'construire', 'pc'] },
    { pattern: /apport/i, aliases: ['apport', 'donation'] },
    // Allocations et aides sociales
    { pattern: /caf|allocation|paje|cmg|asf/i, aliases: ['caf', 'allocation', 'allocs', 'paje', 'cmg', 'asf', 'attestation'] },
  ]

  type Ligne = PieceAttendue & {
    statut: 'valide' | 'a_fournir' | 'manquant' | 'partiel'
    /** Tous les fichiers qui matchent cette pièce (par ordre de score décroissant). */
    fichiers: PieceMeta[]
    /** Nombre attendu (utile pour afficher "2/3"). */
    quantiteAttendue: number
  }

  // Matching : on calcule d'abord pour chaque (pièce attendue, fichier) un
  // score sémantique. On ne filtre PAS par catégorie (la convention de
  // nommage P1-P5 du courtier peut différer de la convention référentiel).
  // Ensuite on alloue chaque fichier à la pièce attendue qui matche le mieux,
  // pour qu'un même fichier ne soit pas assigné à 2 pièces différentes.
  //
  // On distingue 2 niveaux de tokens attendus :
  //  - `direct`  : issus du libellé même (ex: "bail" depuis "Bail de location")
  //  - `aliases` : issus des synonymes (ex: "bail" comme alias de "loyer")
  // Un match direct vaut 3 points, un match via alias 2 points.
  // Comme ça "Bail de location" l'emporte sur "Quittance de loyer" pour un
  // fichier nommé "Bail de location.pdf" (les 2 ont "bail" en alias mais
  // seul le 1er l'a en libellé direct).
  type AttenduTokenSet = { idx: number; direct: Set<string>; aliases: Set<string> }

  const lignes: Ligne[] = useMemo(() => {
    const attendusTokens: AttenduTokenSet[] = piecesAttendues.map((p, idx) => {
      const direct = tokens(p.libelle)
      const aliases = new Set<string>()
      for (const { pattern, aliases: aliasList } of SYNONYMES) {
        if (pattern.test(p.libelle)) {
          for (const a of aliasList) {
            const norm = normalize(a)
            if (!direct.has(norm)) aliases.add(norm)
            if (a.endsWith('s')) {
              const stem = norm.slice(0, -1)
              if (!direct.has(stem)) aliases.add(stem)
            }
          }
        }
      }
      return { idx, direct, aliases }
    })

    // Score : direct = +3, alias = +2, includes long approximatif = +1.
    // Bonus catégorie = +1 si score initial déjà >= 2.
    // Seuil de validation = 2 (un alias seul suffit, mais pas un includes seul).
    type FileScore = { fileIdx: number; bestAttenduIdx: number; bestScore: number }
    const fileScores: FileScore[] = []
    list.forEach((f, fileIdx) => {
      const cleanName = safe(f.filename).replace(/^P\s*[_\-.\s]?\s*[1-5][_\-\s.]?/i, '')
      const fileTokens = tokens(cleanName)
      let bestAttenduIdx = -1
      let bestScore = 0
      for (const { idx, direct, aliases } of attendusTokens) {
        let score = 0
        for (const t of fileTokens) {
          if (direct.has(t)) {
            score += 3 // Match sur le libellé direct (le plus fort)
          } else if (aliases.has(t)) {
            score += 2 // Match sur un alias (synonyme)
          } else if (t.length >= 5) {
            // Match approximatif via includes() — token long (≥ 5 chars).
            // On vérifie d'abord direct puis aliases (priorité au libellé natif).
            let matched = false
            for (const e of direct) {
              if (e.length >= 5 && (t.includes(e) || e.includes(t))) {
                score += 2; matched = true; break
              }
            }
            if (!matched) for (const e of aliases) {
              if (e.length >= 5 && (t.includes(e) || e.includes(t))) {
                score += 1; break
              }
            }
          }
        }
        // Bonus +1 catégorie si match déjà solide (score >= 2)
        if (score >= 2 && piecesAttendues[idx].categorie === f.categorie) score += 1
        if (score > bestScore) {
          bestScore = score
          bestAttenduIdx = idx
        }
      }
      // Seuil minimum 2 : exclut les "matchs" sur un seul includes() partiel
      if (bestScore >= 2) {
        fileScores.push({ fileIdx, bestAttenduIdx, bestScore })
      }
    })

    // Allocation : pour chaque pièce attendue, on récupère ses fichiers triés par score
    const filesByAttendu = new Map<number, PieceMeta[]>()
    fileScores.sort((a, b) => b.bestScore - a.bestScore)
    for (const fs of fileScores) {
      const arr = filesByAttendu.get(fs.bestAttenduIdx) ?? []
      arr.push(list[fs.fileIdx])
      filesByAttendu.set(fs.bestAttenduIdx, arr)
    }

    return piecesAttendues.map((p, idx) => {
      const quantiteAttendue = p.quantiteMin ?? 1
      const fichiers = filesByAttendu.get(idx) ?? []
      let statut: Ligne['statut']
      if (fichiers.length === 0) {
        statut = p.optionnelle ? 'a_fournir' : 'manquant'
      } else if (fichiers.length >= quantiteAttendue) {
        statut = 'valide'
      } else {
        statut = 'partiel'
      }
      return { ...p, statut, fichiers, quantiteAttendue } as Ligne
    })
  }, [list])

  const filtered = categorie === 'all' ? lignes : lignes.filter((l) => l.categorie === categorie)
  const byStatut = {
    valide: lignes.filter((p) => p.statut === 'valide').length,
    partiel: lignes.filter((p) => p.statut === 'partiel').length,
    a_fournir: lignes.filter((p) => p.statut === 'a_fournir').length,
    manquant: lignes.filter((p) => p.statut === 'manquant').length,
    expire: 0,
  }

  // Compteurs sur fichiers EFFECTIVEMENT matchés au référentiel par catégorie
  // (pas juste ceux préfixés Pn — la convention de nommage du courtier peut différer)
  const countByCat = (cat: 'P1' | 'P2' | 'P3' | 'P4' | 'P5') => {
    const linesInCat = lignes.filter((l) => l.categorie === cat)
    return linesInCat.reduce((s, l) => s + Math.min(l.fichiers.length, l.quantiteAttendue), 0)
  }
  const totalByCat = (cat: 'P1' | 'P2' | 'P3' | 'P4' | 'P5') =>
    piecesAttendues.filter((p) => p.categorie === cat)
      .reduce((s, p) => s + (p.quantiteMin ?? 1), 0)

  return (
    <>
      <PageHeader
        eyebrow="Pièces & classement"
        title="Pièces du dossier"
        description="Référentiel P1-P5 vs fichiers réellement déposés. Drag & drop pour ajouter."
        actions={
          <>
            <button
              className="btn-outline"
              onClick={async () => {
                const header = ['categorie', 'libelle', 'statut', 'fournis', 'attendus', 'fichiers', 'optionnelle']
                const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
                const rows = lignes.map((p) =>
                  [
                    p.categorie,
                    p.libelle,
                    p.statut,
                    p.fichiers.length,
                    p.quantiteAttendue,
                    p.fichiers.map((f) => f.filename).join(' ; '),
                    p.optionnelle ? 'oui' : 'non',
                  ].map(esc).join(','),
                )
                const csv = [header.join(','), ...rows].join('\n')
                const path = await saveFile({
                  defaultFilename: `apolline-pieces-${dossier.ref}-${new Date().toISOString().slice(0, 10)}.csv`,
                  content: csv, filters: FILTERS.csv, mimeType: 'text/csv', addBom: true,
                })
                if (path === null) return
                toast.success(`${lignes.length} pièces exportées`, { description: path !== 'download' ? path : 'Téléchargé' })
              }}
            >
              <Download className="h-4 w-4" /> Exporter liste
            </button>
            <button className="btn-outline" onClick={reload} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              {loading ? 'Sync…' : 'Actualiser'}
            </button>
            <label className="btn-gold cursor-pointer">
              <Upload className="h-4 w-4" /> Ajouter pièces
              <input type="file" multiple className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            </label>
          </>
        }
      />

      <div className="page-body">
        <div className="card p-4 mb-6 flex items-center gap-4 flex-wrap">
          <label className="label mb-0">Dossier :</label>
          <select
            value={selectedDossier}
            onChange={(e) => setSelectedDossier(e.target.value)}
            className="input max-w-xs"
          >
            {dossiers.map((d) => (
              <option key={d.id} value={d.id}>{d.ref} — {d.clientNom}</option>
            ))}
          </select>
          {client && (
            <Link
              to={`/dossiers/${dossier.id}`}
              className="text-xs font-semibold text-gold-700 hover:text-gold-800 inline-flex items-center gap-1"
            >
              Ouvrir le dossier <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          <span className="ml-auto text-[11px] text-navy-500">
            {list.length} fichier{list.length > 1 ? 's' : ''} déposé{list.length > 1 ? 's' : ''}
            {uploading > 0 && (
              <span className="ml-2 text-gold-700 inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> upload {uploading}…
              </span>
            )}
          </span>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 mb-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Impossible de charger les pièces</div>
              <div className="mt-0.5">{error}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-5 gap-3 mb-6">
          <StatCard label="Validées" value={byStatut.valide} total={piecesAttendues.length} color="emerald" icon={CheckCircle2} />
          <StatCard label="Partielles" value={byStatut.partiel} total={piecesAttendues.length} color="amber" icon={AlertTriangle} />
          <StatCard label="À fournir" value={byStatut.a_fournir} total={piecesAttendues.length} color="navy" icon={Clock} />
          <StatCard label="Manquantes" value={byStatut.manquant} total={piecesAttendues.length} color="rose" icon={XCircle} />
          <StatCard label="Fichiers déposés" value={list.length} total={list.length} color="navy" icon={FileText} />
        </div>

        <div className="grid grid-cols-4 gap-6">
          {/* Sidebar catégories */}
          <div className="col-span-1">
            <div className="card p-4">
              <div className="text-xs uppercase font-semibold tracking-wider text-navy-500 mb-3">Catégories</div>
              <nav className="space-y-1">
                <CatButton
                  active={categorie === 'all'}
                  onClick={() => setCategorie('all')}
                  label={`Toutes (${piecesAttendues.length})`}
                  code=""
                />
                {(['P1', 'P2', 'P3', 'P4', 'P5'] as const).map((c) => {
                  const fournis = countByCat(c)
                  const attendus = totalByCat(c)
                  return (
                    <CatButton
                      key={c}
                      active={categorie === c}
                      onClick={() => setCategorie(c)}
                      label={`${piecesByCategorie[c]} (${fournis}/${attendus})`}
                      code={c}
                    />
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Référentiel */}
          <div className="col-span-3 space-y-4">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-navy-100">
                <h3 className="font-serif text-sm font-semibold text-navy-900">
                  Pièces attendues (référentiel P1-P5)
                </h3>
                <div className="text-[11px] text-navy-500 mt-0.5">
                  Le statut est calculé en croisant le référentiel avec les fichiers réellement déposés sur ce dossier.
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th w-16">Cat.</th>
                    <th className="table-th w-[36%]">Libellé</th>
                    <th className="table-th w-32">Statut</th>
                    <th className="table-th" colSpan={2}>Fichier(s) détecté(s)</th>
                  </tr>
                </thead>
                <tbody className="list-fast stagger-fast">
                  {filtered.map((p, i) => (
                    <tr key={i} className="hover:bg-navy-50/60 transition-colors duration-150 align-top">
                      <td className="table-td">
                        <span className="font-mono text-xs font-bold text-gold-700">{p.categorie}</span>
                      </td>
                      <td className="table-td font-medium">
                        {p.libelle}
                        {p.optionnelle && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-navy-400">optionnelle</span>
                        )}
                        {(p.quantiteAttendue > 1 || p.multi) && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-navy-500 bg-navy-50 rounded px-1.5">
                            {p.quantiteAttendue > 1 ? `${p.quantiteAttendue} requis` : 'multi'}
                          </span>
                        )}
                      </td>
                      <td className="table-td">
                        <StatutPill
                          statut={p.statut}
                          fournis={p.fichiers.length}
                          attendus={p.quantiteAttendue}
                        />
                      </td>
                      <td className="table-td" colSpan={2}>
                        {p.fichiers.length === 0 ? (
                          <span className="text-xs text-navy-300">—</span>
                        ) : (
                          <div className="space-y-1">
                            {p.fichiers.map((f) => (
                              <div key={f.id} className="flex items-center gap-3 text-xs">
                                <FileText className="h-3.5 w-3.5 text-gold-600 shrink-0" />
                                <span className="flex-1 min-w-0 font-mono text-navy-700 truncate" title={f.filename}>
                                  {f.filename}
                                </span>
                                <span className="text-[10px] text-navy-400 tabular-nums shrink-0 w-16 text-right">
                                  {Math.round(f.sizeBytes / 1024)} Ko
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => setPreviewing(f)}
                                    className="h-7 w-7 rounded-md hover:bg-navy-100 flex items-center justify-center text-navy-400 hover:text-navy-900"
                                    title={`Aperçu : ${f.filename}`}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDownload(f)}
                                    className="h-7 w-7 rounded-md hover:bg-navy-100 flex items-center justify-center text-navy-400 hover:text-navy-900"
                                    title="Télécharger"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fichiers non rattachés au référentiel */}
            {(() => {
              const matchedIds = new Set<string>()
              for (const l of lignes) for (const f of l.fichiers) matchedIds.add(f.id)
              const orphans = list.filter((f) => !matchedIds.has(f.id))
              if (orphans.length === 0) return null
              return (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-navy-100">
                    <h3 className="font-serif text-sm font-semibold text-navy-900">
                      Fichiers déposés non rattachés au référentiel ({orphans.length})
                    </h3>
                    <div className="text-[11px] text-navy-500 mt-0.5">
                      Renomme ces fichiers (ex. <code>P3_Releve_Janvier.pdf</code>) ou ils correspondent à des pièces hors référentiel.
                    </div>
                  </div>
                  <div className="divide-y divide-navy-50">
                    {orphans.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-navy-50/40">
                        <span className="font-mono text-xs font-bold text-gold-700 bg-gold-50 border border-gold-200 rounded px-1.5 py-0.5 shrink-0 w-9 text-center">
                          {f.categorie}
                        </span>
                        <FileText className="h-4 w-4 text-gold-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-navy-900 truncate font-mono" title={f.filename}>
                            {f.filename}
                          </div>
                          <div className="text-[11px] text-navy-500">{dateFr(f.uploadedAt)}</div>
                        </div>
                        <span className="text-[11px] text-navy-400 tabular-nums shrink-0 w-16 text-right">
                          {Math.round(f.sizeBytes / 1024)} Ko
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setPreviewing(f)} className="h-7 w-7 rounded-md hover:bg-navy-100 flex items-center justify-center text-navy-400 hover:text-navy-900" title="Aperçu">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDownload(f)} className="h-7 w-7 rounded-md hover:bg-navy-100 flex items-center justify-center text-navy-400 hover:text-navy-900" title="Télécharger">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      <PiecePreviewModal piece={previewing} onClose={() => setPreviewing(null)} />
    </>
  )
}

function CatButton({ active, label, code, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition',
        active ? 'bg-navy-900 text-white' : 'text-navy-700 hover:bg-navy-50',
      )}
    >
      {code ? <span className={cn('font-mono text-xs font-bold w-5', active ? 'text-gold-400' : 'text-gold-700')}>{code}</span> : <Folder className="h-4 w-4" />}
      <span className="truncate">{label}</span>
    </button>
  )
}

function StatCard({ label, value, total, color, icon: Icon }: any) {
  const colorMap: any = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    navy: 'bg-navy-50 text-navy-700 ring-navy-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  }
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center ring-1', colorMap[color])}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-navy-500 font-semibold">{label}</div>
          <div className="font-serif text-xl text-navy-900 font-semibold">{value}<span className="text-navy-400 text-sm"> / {total}</span></div>
        </div>
      </div>
    </div>
  )
}

function StatutPill({ statut, fournis, attendus }: { statut: 'valide' | 'a_fournir' | 'manquant' | 'partiel' | 'expire'; fournis?: number; attendus?: number }) {
  const counter = fournis != null && attendus != null && attendus > 1 ? ` (${fournis}/${attendus})` : ''
  if (statut === 'valide') return <span className="badge-success"><CheckCircle2 className="h-3 w-3" /> Validée{counter}</span>
  if (statut === 'partiel') return <span className="badge-warning"><AlertTriangle className="h-3 w-3" /> Partielle{counter}</span>
  if (statut === 'a_fournir') return <span className="badge-navy"><Clock className="h-3 w-3" /> À fournir</span>
  if (statut === 'manquant') return <span className="badge-danger"><XCircle className="h-3 w-3" /> Manquante</span>
  return <span className="badge-warning"><AlertTriangle className="h-3 w-3" /> Expirée</span>
}
