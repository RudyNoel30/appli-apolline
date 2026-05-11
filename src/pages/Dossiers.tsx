import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Plus, Download, LayoutGrid, List, AlertTriangle, MapPin, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import { STATUTS, type Statut } from '@/data/mock'
import { useStore } from '@/stores/useStore'
import { eur, dateFr, cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { exportToXlsx } from '@/lib/excelExport'

const KANBAN_STATUTS: Statut[] = [
  'R0', 'R1_prevu', 'R1_fait', 'Montage', 'Envoi_banque', 'Accord', 'Offre_editee', 'Signe',
]

export default function Dossiers() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const navigate = useNavigate()
  const dossiers = useStore((s) => s.dossiers)
  const prets = useStore((s) => s.prets)
  // Index banques par dossierId (sources de vérité depuis le refactor Cifacil).
  const banquesByDossier = new Map<string, string>()
  for (const d of dossiers) {
    const banques = Array.from(new Set(prets.filter((p) => p.dossierId === d.id).map((p) => p.banque).filter(Boolean) as string[]))
    if (banques.length) banquesByDossier.set(d.id, banques.join(' · '))
  }

  const exportXlsx = async () => {
    const path = await exportToXlsx({
      filename: `apolline-dossiers-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [{
        name: 'Pipeline',
        title: "Extr'Apol — Pipeline dossiers",
        subtitle: `${dossiers.length} dossiers · généré le ${new Date().toLocaleDateString('fr-FR')}`,
        columns: [
          { key: 'ref', header: 'Référence', width: 14 },
          { key: 'client', header: 'Client', width: 28 },
          { key: 'projet', header: 'Projet', width: 14 },
          { key: 'ville', header: 'Ville', width: 18 },
          { key: 'montant', header: 'Montant prêt', width: 16, format: 'currency', align: 'right' },
          { key: 'ltv', header: 'LTV', width: 10, format: 'percent', align: 'right',
            conditionalColor: (v) => (Number(v) > 0.9 ? 'FFB45309' : null) },
          { key: 'banque', header: 'Banque', width: 22 },
          { key: 'statut', header: 'Statut', width: 16,
            conditionalBg: (v) => v === 'Signe' ? 'FFD1FAE5' : v === 'Abandonne' ? 'FFFEE2E2' : null },
          { key: 'score', header: 'Score', width: 10, format: 'integer', align: 'center',
            conditionalColor: (v) => Number(v) >= 85 ? 'FF047857' : Number(v) < 70 ? 'FFB91C1C' : 'FF8A6B2E' },
          { key: 'created', header: 'Créé le', width: 14 },
        ],
        rows: dossiers.map((d) => ({
          ref: d.ref,
          client: d.clientNom,
          projet: d.typeProjet,
          ville: d.villeBien,
          montant: d.montantPret,
          ltv: d.ltv,
          banque: banquesByDossier.get(d.id) ?? '—',
          statut: STATUTS.find((s) => s.key === d.statut)?.label ?? d.statut,
          score: d.scoreConfiance,
          created: d.createdAt,
        })),
        totals: { label: 'Totaux', sumKeys: ['montant'] },
      }],
    })
    if (path === null) return
    toast.success(`${dossiers.length} dossiers exportés en Excel`, { description: path !== 'download' ? path : 'Téléchargé' })
  }

  return (
    <>
      <PageHeader
        eyebrow="Pipeline"
        title="Dossiers"
        description={`${dossiers.length} dossiers au portefeuille · pipeline actif`}
        actions={
          <>
            <div className="flex rounded-lg border border-navy-200 bg-white p-0.5">
              <button
                onClick={() => setView('kanban')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition',
                  view === 'kanban' ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50',
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition',
                  view === 'list' ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50',
                )}
              >
                <List className="h-3.5 w-3.5" /> Liste
              </button>
            </div>
            <button className="btn-outline" onClick={exportXlsx}><Download className="h-4 w-4" /> Exporter Excel</button>
            <button className="btn-gold" onClick={() => navigate('/saisie')}><Plus className="h-4 w-4" /> Nouveau dossier</button>
          </>
        }
      />

      <div className="page-body">
        {view === 'kanban' ? <Kanban /> : <ListView />}
      </div>
    </>
  )
}

function Kanban() {
  const dossiers = useStore((s) => s.dossiers)
  const prets = useStore((s) => s.prets)
  const moveDossier = useStore((s) => s.moveDossier)
  const [dragOver, setDragOver] = useState<Statut | null>(null)
  const banquesByDossier = new Map<string, string>()
  for (const d of dossiers) {
    const b = Array.from(new Set(prets.filter((p) => p.dossierId === d.id).map((p) => p.banque).filter(Boolean) as string[]))
    if (b.length) banquesByDossier.set(d.id, b.join(' · '))
  }

  const onDragStart = (e: React.DragEvent, dossierId: string) => {
    e.dataTransfer.setData('text/plain', dossierId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e: React.DragEvent, statut: Statut) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(statut)
  }
  const onDrop = (e: React.DragEvent, statut: Statut) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    const d = dossiers.find((dd) => dd.id === id)
    setDragOver(null)
    if (!d || d.statut === statut) return
    moveDossier(id, statut)
    const stat = STATUTS.find((s) => s.key === statut)!
    toast.success(`${d.clientNom} → ${stat.label}`)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scroll-isolated">
      {KANBAN_STATUTS.map((st) => {
        const stat = STATUTS.find((s) => s.key === st)!
        const items = dossiers.filter((d) => d.statut === st)
        const totalMontant = items.reduce((s, d) => s + d.montantPret, 0)
        const isOver = dragOver === st
        return (
          <div
            key={st}
            className="shrink-0 w-[300px]"
            onDragOver={(e) => onDragOver(e, st)}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDrop(e, st)}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', stat.color.replace('bg-', 'bg-').split(' ')[0])} />
                <span className="text-sm font-semibold text-navy-900">{stat.label}</span>
                <span className="text-xs text-navy-400">{items.length}</span>
              </div>
              <span className="text-[10px] text-navy-400 font-medium">{totalMontant > 0 ? eur(totalMontant) : '—'}</span>
            </div>
            <div
              className={cn(
                'rounded-xl2 p-2 space-y-2 min-h-[400px] border transition-colors list-fast-lg',
                isOver
                  ? 'bg-gold-50/80 border-gold-400 ring-2 ring-gold-300/60'
                  : 'bg-navy-50/40 border-navy-100/60',
              )}
            >
              {items.map((d) => (
                <Link
                  to={`/dossiers/${d.id}`}
                  key={d.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, d.id)}
                  className="block bg-white rounded-lg border border-navy-100 p-3 hover:border-gold-300 hover:shadow-card transition-colors duration-150 cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-semibold text-sm text-navy-900 truncate">{d.clientNom}</div>
                    <span className="text-[10px] text-navy-400 font-mono">{d.ref}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-navy-500 mb-2">
                    <MapPin className="h-3 w-3" /> {d.villeBien} · {d.typeProjet}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-navy-900">{eur(d.montantPret)}</div>
                    {banquesByDossier.get(d.id) && (
                      <div className="flex items-center gap-1 text-[10px] text-navy-500">
                        <Building2 className="h-3 w-3" /> {banquesByDossier.get(d.id)!.slice(0, 14)}
                      </div>
                    )}
                  </div>
                  {d.alertes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-navy-50 flex items-center gap-1 text-[10px] text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      {d.alertes.length} alerte{d.alertes.length > 1 ? 's' : ''}
                    </div>
                  )}
                  <div className="mt-2 h-1 rounded-full bg-navy-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold-500 to-gold-300"
                      style={{ width: `${(d.piecesFournies / d.piecesTotal) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-navy-400">
                    Pièces {d.piecesFournies}/{d.piecesTotal}
                  </div>
                </Link>
              ))}
              {items.length === 0 && (
                <div className="text-center text-xs text-navy-300 py-8">
                  {isOver ? 'Déposer ici…' : 'Aucun dossier'}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ListView() {
  const dossiers = useStore((s) => s.dossiers)
  const prets = useStore((s) => s.prets)
  const banquesByDossier = new Map<string, string>()
  for (const d of dossiers) {
    const b = Array.from(new Set(prets.filter((p) => p.dossierId === d.id).map((p) => p.banque).filter(Boolean) as string[]))
    if (b.length) banquesByDossier.set(d.id, b.join(' · '))
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr>
            <th className="table-th">Réf.</th>
            <th className="table-th">Client</th>
            <th className="table-th">Projet</th>
            <th className="table-th text-right">Montant prêt</th>
            <th className="table-th text-right">LTV</th>
            <th className="table-th">Banque</th>
            <th className="table-th">Statut</th>
            <th className="table-th text-center">Score</th>
            <th className="table-th">Créé</th>
          </tr>
        </thead>
        <tbody className="list-fast stagger-fast">
          {dossiers.map((d) => {
            const stat = STATUTS.find((s) => s.key === d.statut)!
            return (
              <tr key={d.id} className="hover:bg-navy-50/60 transition-colors duration-150">
                <td className="table-td">
                  <Link to={`/dossiers/${d.id}`} className="font-mono text-xs text-gold-700 hover:underline">
                    {d.ref}
                  </Link>
                </td>
                <td className="table-td font-semibold">{d.clientNom}</td>
                <td className="table-td text-xs">
                  {d.typeProjet} <span className="text-navy-400">·</span> {d.villeBien}
                </td>
                <td className="table-td text-right font-semibold">{eur(d.montantPret)}</td>
                <td className="table-td text-right">
                  <span className={d.ltv > 0.9 ? 'text-amber-700 font-semibold' : 'text-navy-700'}>
                    {(d.ltv * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="table-td text-xs">{banquesByDossier.get(d.id) || <span className="text-navy-300">—</span>}</td>
                <td className="table-td">
                  <span className={cn('badge', stat.color)}>{stat.label}</span>
                </td>
                <td className="table-td text-center">
                  <span className={cn(
                    'font-semibold',
                    d.scoreConfiance >= 85 ? 'text-emerald-700' :
                    d.scoreConfiance >= 70 ? 'text-gold-700' : 'text-rose-700',
                  )}>
                    {d.scoreConfiance}
                  </span>
                </td>
                <td className="table-td text-xs text-navy-500">{dateFr(d.createdAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
