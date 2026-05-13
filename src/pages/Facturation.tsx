/**
 * Page Facturation — vue globale Cifacil-style.
 *
 * 4 KPIs en haut + 3 onglets (Factures / Ristournes / Avoirs) + tableau filtrable.
 * Bouton "+ Nouvelle facture" ouvre la modale FactureFormModal.
 *
 * Filtres : type, statut, période, recherche, mode règlement.
 * Actions par ligne : voir détail, marquer réglée, créer avoir, annuler.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Receipt, Search, RefreshCw, Eye, CheckCircle2, RefreshCw as RefreshIcon, Trash2, Clock, AlertTriangle, Download, Filter } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import FactureFormModal from '@/components/FactureFormModal'
import { factures as facturesApi, type Facture, type FactureType, type FactureStatut, type FactureStats } from '@/db/api'
import { useStore } from '@/stores/useStore'
import { cn, dateFr } from '@/lib/utils'
import { confirmDialog } from '@/lib/dialog'

const eur = (cents: number): string =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

const TYPE_GROUPS: Record<'factures' | 'ristournes' | 'avoirs', FactureType[]> = {
  factures: ['honoraires', 'comm_banque', 'comm_autre'],
  ristournes: ['ristourne'],
  avoirs: ['avoir_honoraires', 'avoir_comm_banque', 'avoir_comm_autre', 'avoir_ristourne'],
}

const STATUT_OPTIONS: { value: FactureStatut; label: string }[] = [
  { value: 'prevue', label: 'Prévue' },
  { value: 'emise', label: 'Émise' },
  { value: 'reglee_partiel', label: 'Partiel' },
  { value: 'reglee', label: 'Réglée' },
  { value: 'avoir_emis', label: 'Avoir émis' },
  { value: 'annulee', label: 'Annulée' },
]

export default function Facturation() {
  const navigate = useNavigate()
  const dossiers = useStore((s) => s.dossiers)
  const [tab, setTab] = useState<'factures' | 'ristournes' | 'avoirs'>('factures')
  const [list, setList] = useState<Facture[]>([])
  const [stats, setStats] = useState<FactureStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Facture | null>(null)

  // Filtres
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState<FactureStatut | ''>('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')

  const dossierByRef = useMemo(() => Object.fromEntries(dossiers.map((d) => [d.id, d])), [dossiers])

  const load = async () => {
    setLoading(true)
    try {
      const filters = {
        types: TYPE_GROUPS[tab],
        statuts: statut ? [statut] : undefined,
        since: since || undefined,
        until: until || undefined,
        dateField: (since || until) ? ('emise_le' as const) : undefined,
        search: search || undefined,
      }
      const [data, kpis] = await Promise.all([
        facturesApi.list(filters),
        facturesApi.stats(90),
      ])
      setList(data.factures)
      setStats(kpis)
    } catch (e) {
      toast.error('Erreur chargement', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [tab, statut, since, until])

  // Recherche debounced
  useEffect(() => {
    const t = setTimeout(() => void load(), 350)
    return () => clearTimeout(t)
  }, [search])

  const onRegler = async (f: Facture) => {
    if (!await confirmDialog(`Marquer ${f.ref} comme réglée pour ${eur(f.montantTtc)} ?`, { title: 'Régler la facture', kind: 'info' })) return
    try {
      await facturesApi.regler(f.id, { regleeLe: new Date().toISOString() })
      toast.success(`${f.ref} marquée réglée`)
      void load()
    } catch (e) {
      toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  const onAvoir = async (f: Facture) => {
    // TODO : remplacer prompt() (cassé Tauri) par une vraie modale input avec motif.
    if (!await confirmDialog(`Créer un avoir sur ${f.ref} pour ${eur(f.montantTtc)} ?`, { title: 'Avoir', kind: 'warning' })) return
    try {
      const { avoir } = await facturesApi.avoir(f.id, { motif: 'À préciser' })
      toast.success(`Avoir ${avoir.ref} créé`, { description: 'Modifier le motif en ouvrant l\'avoir' })
      void load()
    } catch (e) {
      toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  const onAnnuler = async (f: Facture) => {
    if (!await confirmDialog(`Annuler la facture ${f.ref} ? (statut → annulée)`, { title: 'Annuler la facture', kind: 'warning' })) return
    try {
      await facturesApi.cancel(f.id)
      toast.success(`${f.ref} annulée`)
      void load()
    } catch (e) {
      toast.error('Erreur', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  const exportCsv = () => {
    if (list.length === 0) {
      toast.info('Aucune ligne à exporter')
      return
    }
    const headers = ['Ref', 'Type', 'Dossier', 'Client/Partenaire', 'Date émission', 'Échéance', 'Date règlement', 'Montant HT', 'TVA', 'Montant TTC', 'Montant réglé', 'Statut', 'Mode', 'N° pièce']
    const escape = (s: string | null | undefined): string => {
      const str = s == null ? '' : String(s)
      return /[,;"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
    }
    const rows = list.map((f) => [
      f.ref, f.type, dossierByRef[f.dossierId]?.ref ?? '', f.partenaireNom ?? '',
      f.emiseLe?.slice(0, 10) ?? '', f.echeanceLe?.slice(0, 10) ?? '', f.regleeLe?.slice(0, 10) ?? '',
      (f.montantHt / 100).toFixed(2), (f.tvaTaux * 100).toFixed(0) + '%', (f.montantTtc / 100).toFixed(2),
      (f.montantRegle / 100).toFixed(2), f.statut, f.modeReglement ?? '', f.numeroPiece ?? '',
    ].map(escape).join(';'))
    const csv = [headers.join(';'), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `apolline-${tab}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)
    toast.success(`${list.length} ligne(s) exportée(s)`)
  }

  return (
    <>
      <PageHeader
        eyebrow="Finances"
        title="Facturation"
        description="Honoraires, commissions bancaires, ristournes apporteurs et avoirs"
        actions={
          <>
            <button className="btn-outline" onClick={exportCsv} disabled={list.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button className="btn-gold" onClick={() => { setEditing(null); setShowForm(true) }}>
              <Plus className="h-4 w-4" /> Nouvelle facture
            </button>
          </>
        }
      />

      <div className="page-body">
        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            <Kpi icon={Clock} label="Prévues" value={eur(stats.mtPrevu)} hint={`${stats.nbPrevues} facture${stats.nbPrevues > 1 ? 's' : ''}`} accent="navy" />
            <Kpi icon={Receipt} label="Émises en attente" value={eur(stats.mtEmisAttente)} hint={`${stats.nbEmises} facture${stats.nbEmises > 1 ? 's' : ''}`} accent="sky" />
            <Kpi icon={CheckCircle2} label="Encaissé (90 j)" value={eur(stats.mtEncaissePeriode)} hint={`${stats.nbReglees} règlement${stats.nbReglees > 1 ? 's' : ''}`} accent="emerald" />
            <Kpi icon={AlertTriangle} label="En retard" value={eur(stats.mtRetard)} hint="Échéance dépassée" accent={stats.mtRetard > 0 ? 'rose' : 'navy'} />
          </div>
        )}

        {/* Tabs */}
        <div className="card p-0 overflow-hidden">
          <div className="border-b border-navy-100 bg-ivory/50 px-4">
            <div className="flex gap-1 -mb-px">
              {(['factures', 'ristournes', 'avoirs'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'px-4 py-2.5 text-sm font-medium border-b-2 transition',
                    tab === t
                      ? 'border-gold-500 text-navy-900'
                      : 'border-transparent text-navy-500 hover:text-navy-800',
                  )}
                >
                  {t === 'factures' ? 'Factures' : t === 'ristournes' ? 'Ristournes' : 'Avoirs'}
                </button>
              ))}
            </div>
          </div>

          {/* Filtres */}
          <div className="px-4 py-3 border-b border-navy-100 bg-ivory/30 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par n° ou nom"
                className="input pl-9"
              />
            </div>
            <select className="input max-w-[180px]" value={statut} onChange={(e) => setStatut(e.target.value as FactureStatut | '')}>
              <option value="">Tous statuts</option>
              {STATUT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input type="date" className="input max-w-[150px]" value={since} onChange={(e) => setSince(e.target.value)} title="Depuis" />
            <input type="date" className="input max-w-[150px]" value={until} onChange={(e) => setUntil(e.target.value)} title="Jusqu'au" />
            <button onClick={() => { setSearch(''); setStatut(''); setSince(''); setUntil('') }}
              className="btn-ghost text-xs" title="Réinitialiser les filtres">
              <Filter className="h-3.5 w-3.5" /> Reset
            </button>
            <button onClick={() => void load()} className="btn-icon ml-auto" title="Rafraîchir">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Tableau — key={tab} pour rejouer le stagger d'entrée à chaque
              changement d'onglet (factures / ristournes / avoirs) */}
          <div key={tab} className="overflow-x-auto tab-content">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">N°</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Dossier</th>
                  <th className="table-th">Partenaire</th>
                  <th className="table-th">Émise</th>
                  <th className="table-th">Échéance</th>
                  <th className="table-th text-right">TTC</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="list-fast stagger-fast">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-navy-400 italic">
                      {loading ? 'Chargement…' : 'Aucune facture sur la période / les filtres choisis.'}
                    </td>
                  </tr>
                ) : list.map((f) => {
                  const dossier = dossierByRef[f.dossierId]
                  return (
                    <tr key={f.id} className="hover:bg-navy-50/40 group">
                      <td className="table-td font-mono text-xs">{f.ref}</td>
                      <td className="table-td"><StatusBadge variant="facture-type" type={f.type} size="sm" /></td>
                      <td className="table-td font-mono text-xs">
                        {dossier ? (
                          <button onClick={() => navigate(`/dossiers/${dossier.id}`)} className="text-navy-700 hover:text-gold-700 hover:underline">
                            {dossier.ref}
                          </button>
                        ) : '—'}
                      </td>
                      <td className="table-td truncate max-w-[200px]">{f.partenaireNom ?? '—'}</td>
                      <td className="table-td text-xs text-navy-600">{f.emiseLe ? dateFr(f.emiseLe) : '—'}</td>
                      <td className="table-td text-xs text-navy-600">{f.echeanceLe ? dateFr(f.echeanceLe) : '—'}</td>
                      <td className="table-td text-right font-semibold tabular-nums">{eur(f.montantTtc)}</td>
                      <td className="table-td"><StatusBadge variant="facture" statut={f.statut} size="sm" /></td>
                      <td className="table-td text-right">
                        <div className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditing(f); setShowForm(true) }} className="btn-icon" title="Voir / modifier"><Eye className="h-3.5 w-3.5" /></button>
                          {f.statut === 'emise' || f.statut === 'reglee_partiel' ? (
                            <button onClick={() => void onRegler(f)} className="btn-icon text-emerald-600 hover:bg-emerald-50" title="Marquer réglée"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                          ) : null}
                          {!f.type.startsWith('avoir_') && f.statut !== 'avoir_emis' && f.statut !== 'annulee' ? (
                            <button onClick={() => void onAvoir(f)} className="btn-icon text-violet-600 hover:bg-violet-50" title="Créer un avoir"><RefreshIcon className="h-3.5 w-3.5" /></button>
                          ) : null}
                          {f.statut !== 'annulee' && (
                            <button onClick={() => void onAnnuler(f)} className="btn-icon-danger" title="Annuler"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-navy-100 text-xs text-navy-500 bg-ivory/30">
            {list.length} facture{list.length > 1 ? 's' : ''} affichée{list.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <FactureFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        edit={editing}
        onSaved={() => void load()}
      />
    </>
  )
}

function Kpi({ icon: Icon, label, value, hint, accent = 'navy' }: {
  icon: typeof Receipt
  label: string
  value: string
  hint?: string
  accent?: 'navy' | 'gold' | 'emerald' | 'rose' | 'sky'
}) {
  const colorMap: Record<string, { bg: string; icon: string }> = {
    navy: { bg: 'from-navy-50 to-white', icon: 'text-navy-700' },
    gold: { bg: 'from-gold-50 to-white', icon: 'text-gold-700' },
    emerald: { bg: 'from-emerald-50 to-white', icon: 'text-emerald-700' },
    rose: { bg: 'from-rose-50 to-white', icon: 'text-rose-700' },
    sky: { bg: 'from-sky-50 to-white', icon: 'text-sky-700' },
  }
  const c = colorMap[accent]!
  return (
    <div className={cn('rounded-xl border border-navy-100 bg-gradient-to-br p-3', c.bg)}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn('h-3.5 w-3.5', c.icon)} />
        <div className="kicker">{label}</div>
      </div>
      <div className="font-serif text-xl text-navy-900 tabular-nums leading-tight">{value}</div>
      {hint && <div className="text-[11px] text-navy-500 mt-0.5">{hint}</div>}
    </div>
  )
}
