import {
  Users, FileCheck2, Coins, AlertCircle, ArrowUpRight, CalendarDays,
  ChevronRight, Download, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportToXlsx } from '@/lib/excelExport'
import { exportToHtml } from '@/lib/htmlExport'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import { cn, eur, dateTimeFr } from '@/lib/utils'
import { STATUTS } from '@/data/mock'
import { useStore } from '@/stores/useStore'
import { useAuth } from '@/auth/AuthContext'
import { computeAlertes, computeEncaissementsMensuels, computeEncaissementsMois, computeTachesJour, type Tache } from '@/lib/dashboard'
import type { Statut } from '@/data/mock'

function Kpi({ icon: Icon, label, value, trend, hint, color = 'navy', delay = 0 }: {
  icon: any; label: string; value: string; trend?: string; hint?: string;
  color?: 'navy' | 'gold' | 'emerald' | 'amber'; delay?: number
}) {
  const colorMap = {
    navy: 'bg-navy-50 text-navy-700 group-hover:bg-navy-100',
    gold: 'bg-gold-50 text-gold-700 group-hover:bg-gold-100',
    emerald: 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100',
    amber: 'bg-amber-50 text-amber-700 group-hover:bg-amber-100',
  }
  return (
    <div
      className="card card-hover p-5 group animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">{label}</div>
          <div className="kpi-value mt-2 animate-count-up" style={{ animationDelay: `${delay + 200}ms` }}>{value}</div>
          {hint && <div className="text-xs text-navy-400 mt-1">{hint}</div>}
        </div>
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6', colorMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          {trend} vs. mois dernier
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const dossiers = useStore((s) => s.dossiers)
  const rdvs = useStore((s) => s.rdvs)
  const clients = useStore((s) => s.clients)
  const commissions = useStore((s) => s.commissions)
  // prets nécessaire pour recalculer la LTV bancaire live (vs le snapshot stocké
  // dans dossier.ltv qui peut être stale après ajout/modification de prêts).
  const prets = useStore((s) => s.prets)
  const { currentUser } = useAuth()
  const greetingName = currentUser?.prenom?.trim() || currentUser?.nom?.trim() || 'collaborateur'

  const today = new Date()
  const todayLabel = today.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const counts: Record<Statut, number> = {
    R0: 0, R1_prevu: 0, R1_fait: 0, Montage: 0, Envoi_banque: 0,
    Accord: 0, Offre_editee: 0, Signe: 0, Encaisse: 0, Abandonne: 0,
  }
  dossiers.forEach((d) => { counts[d.statut]++ })

  const totalActifs = dossiers.filter((d) => !['Encaisse', 'Abandonne'].includes(d.statut)).length
  const enAttente = dossiers.filter((d) => ['Envoi_banque', 'Montage'].includes(d.statut)).length
  const signesMois = dossiers.filter((d) => d.statut === 'Signe' || d.statut === 'Encaisse').length
  // Encaissements / commissions calculés depuis le store (table commissions)
  const encaissementsMensuels = computeEncaissementsMensuels(commissions, today)
  const commissionsMois = computeEncaissementsMois(commissions, today)
  const moisCourantLabel = today.toLocaleDateString('fr-FR', { month: 'long' })
  // Alertes calculées depuis l'état des dossiers / RDV (LTV recalculée live depuis les prêts)
  const alertesGlobales = computeAlertes(dossiers, rdvs, prets, today)
  // Tâches actionnables du jour (RDV + relances + pièces + HCSF + stagnation)
  const tachesJour = computeTachesJour(dossiers, rdvs, prets, today)
  const nbProspects = clients.filter((c) => c.statutCommercial === 'prospect').length
  const nbClients = clients.filter((c) => c.statutCommercial === 'client').length
  const prochainsRdv = [...rdvs]
    .filter((r) => new Date(r.date).getTime() >= today.getTime())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)

  const pipelineChart = STATUTS
    .filter((s) => !['Encaisse', 'Abandonne'].includes(s.key))
    .map((s) => ({ name: s.label, dossiers: counts[s.key] }))

  const exportXlsx = async () => {
    const path = await exportToXlsx({
      filename: `apolline-tableau-bord-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [
        {
          name: 'KPIs',
          title: "Extr'Apol — Indicateurs clés",
          subtitle: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
          columns: [
            { key: 'indic', header: 'Indicateur', width: 28 },
            { key: 'value', header: 'Valeur', width: 18, align: 'right' },
          ],
          rows: [
            { indic: 'Dossiers actifs', value: totalActifs },
            { indic: 'En attente banque', value: enAttente },
            { indic: 'Signatures du mois', value: signesMois },
            { indic: 'Encaissements du mois', value: `${commissionsMois.toLocaleString('fr-FR')} €` },
          ],
        },
        {
          name: 'Pipeline',
          title: 'Pipeline par statut',
          columns: [
            { key: 'statut', header: 'Statut', width: 22 },
            { key: 'count', header: 'Dossiers', width: 12, format: 'integer', align: 'right' },
          ],
          rows: pipelineChart.map((p) => ({ statut: p.name, count: p.dossiers })),
          totals: { label: 'Total actifs', sumKeys: ['count'] },
        },
        {
          name: 'Encaissements',
          title: 'Encaissements (6 derniers mois)',
          columns: [
            { key: 'mois', header: 'Mois', width: 14 },
            { key: 'brut', header: 'Brut', width: 14, format: 'currency', align: 'right' },
            { key: 'net', header: 'Net', width: 14, format: 'currency', align: 'right' },
          ],
          rows: encaissementsMensuels,
          totals: { label: 'Total 6 mois', sumKeys: ['brut', 'net'] },
        },
        {
          name: 'Alertes',
          title: 'Alertes actives',
          columns: [
            { key: 'priorite', header: 'Priorité', width: 12, align: 'center',
              conditionalBg: (v) => v === 'haute' ? 'FFFEE2E2' : v === 'moyenne' ? 'FFFEF3C7' : 'FFF3F5FA' },
            { key: 'titre', header: 'Titre', width: 36 },
            { key: 'detail', header: 'Détail', width: 60 },
          ],
          rows: alertesGlobales,
        },
      ],
    })
    if (path === null) return
    toast.success('Tableau de bord exporté en Excel', { description: path !== 'download' ? path : 'Téléchargé' })
  }

  const exportHtml = async () => {
    const path = await exportToHtml({
      filename: `apolline-tableau-bord-${new Date().toISOString().slice(0, 10)}.html`,
      title: 'Tableau de bord',
      subtitle: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
      eyebrow: 'Snapshot cabinet',
      sections: [
        { kind: 'kpis', items: [
          { label: 'Dossiers actifs', value: String(totalActifs), hint: 'Tous statuts hors signés/abandon' },
          { label: 'En attente banque', value: String(enAttente), hint: 'Montage + envoi' },
          { label: 'Signatures du mois', value: String(signesMois) },
          { label: 'Encaissements du mois', value: `${commissionsMois.toLocaleString('fr-FR')} €` },
        ]},
        { kind: 'table', title: 'Pipeline',
          headers: ['Statut', 'Dossiers'],
          rows: pipelineChart.map((p) => [p.name, p.dossiers]),
        },
        { kind: 'table', title: 'Encaissements — 6 derniers mois',
          headers: ['Mois', 'Brut', 'Net'],
          rows: encaissementsMensuels.map((e) => [
            e.mois,
            `${e.brut.toLocaleString('fr-FR')} €`,
            `${e.net.toLocaleString('fr-FR')} €`,
          ]),
        },
        { kind: 'table', title: 'Alertes en cours',
          headers: ['Priorité', 'Titre', 'Détail'],
          rows: alertesGlobales.map((a) => [a.priorite, a.titre, a.detail]),
          highlight: (r) => r[0] === 'haute' ? 'danger' : r[0] === 'moyenne' ? 'warning' : null,
        },
      ],
    })
    if (path === null) return
    toast.success('Rapport HTML généré', { description: path !== 'download' ? path : 'Téléchargé' })
  }

  return (
    <>
      <PageHeader
        eyebrow="Tableau de bord"
        title={`Bonjour ${greetingName}`}
        description={`Voici l'activité de votre cabinet aujourd'hui — ${todayLabel}.`}
        actions={
          <>
            <button className="btn-outline" onClick={exportHtml}>
              <Download className="h-4 w-4" /> Rapport HTML
            </button>
            <button className="btn-outline" onClick={exportXlsx}>
              <Download className="h-4 w-4" /> Export Excel
            </button>
            <Link to="/saisie" className="btn-gold">Nouveau dossier</Link>
          </>
        }
      />

      <div className="page-body">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Kpi icon={Users} label="Prospects / Clients" value={`${nbProspects} / ${nbClients}`} hint={`${nbProspects + nbClients} fiches au portefeuille`} color="navy" delay={0} />
        <Kpi icon={FileCheck2} label="Dossiers actifs" value={String(totalActifs)} hint={`${enAttente} en attente banque`} color="amber" delay={80} />
        <Kpi icon={CheckCircle2} label="Signatures du mois" value={String(signesMois)} color="emerald" delay={160} />
        <Kpi icon={Coins} label={`Encaissements ${moisCourantLabel}`} value={eur(commissionsMois)} color="gold" delay={240} />
      </div>

      {/* Ma journée — tâches actionnables */}
      {tachesJour.length > 0 && (
        <div className="card p-5 mb-6 border-l-4 border-gold-500">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-serif text-lg text-navy-900">Ma journée</h3>
              <div className="text-xs text-navy-500">
                {tachesJour.filter((t) => t.priorite === 'haute').length} action{tachesJour.filter((t) => t.priorite === 'haute').length > 1 ? 's' : ''} prioritaire{tachesJour.filter((t) => t.priorite === 'haute').length > 1 ? 's' : ''} · {tachesJour.length} au total
              </div>
            </div>
          </div>
          <div className="divider-gold mb-3" />
          <div className="grid gap-2 max-h-[280px] overflow-y-auto pr-1">
            {tachesJour.slice(0, 12).map((t: Tache) => (
              <Link
                key={t.id}
                to={t.link ?? '#'}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-navy-50 border border-transparent hover:border-navy-100 transition group"
              >
                <span className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  t.priorite === 'haute' ? 'bg-rose-500' : t.priorite === 'moyenne' ? 'bg-gold-500' : 'bg-navy-300',
                )} />
                {t.heure && (
                  <span className="text-[11px] font-mono font-semibold text-navy-700 bg-navy-50 px-1.5 py-0.5 rounded shrink-0">
                    {t.heure}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-navy-900 truncate">{t.titre}</div>
                  <div className="text-[11px] text-navy-500 truncate">{t.detail}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-navy-400 group-hover:text-gold-700 shrink-0">
                  {t.type}
                </span>
                <ChevronRight className="h-4 w-4 text-navy-300 group-hover:text-gold-700 group-hover:translate-x-0.5 transition shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg text-navy-900">Encaissements — 6 derniers mois</h3>
              <div className="divider-gold mt-1" />
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-navy-700" />Brut</div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold-500" />Net</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={encaissementsMensuels} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#E3E8F2" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mois" tick={{ fill: '#4F6696', fontSize: 12 }} axisLine={{ stroke: '#BEC9DF' }} />
              <YAxis tick={{ fill: '#4F6696', fontSize: 12 }} axisLine={{ stroke: '#BEC9DF' }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0A1F3D', border: 'none', borderRadius: 8, color: '#fff' }}
                formatter={(v: number) => eur(v)}
              />
              <Line type="monotone" dataKey="brut" stroke="#142B5C" strokeWidth={2.5} dot={{ r: 4, fill: '#142B5C' }} />
              <Line type="monotone" dataKey="net" stroke="#C9A961" strokeWidth={2.5} dot={{ r: 4, fill: '#C9A961' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg text-navy-900">Pipeline</h3>
              <div className="divider-gold mt-1" />
            </div>
            <Link to="/dossiers" className="text-xs font-semibold text-gold-700 hover:text-gold-800 inline-flex items-center">
              Voir tout <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pipelineChart} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E3E8F2" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: '#4F6696', fontSize: 11 }} width={110} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0A1F3D', border: 'none', borderRadius: 8, color: '#fff' }} />
              <Bar dataKey="dossiers" fill="#C9A961" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg text-navy-900">Alertes & relances</h3>
              <div className="divider-gold mt-1" />
            </div>
            <span className="badge-warning"><AlertCircle className="h-3 w-3" /> {alertesGlobales.length} actives</span>
          </div>
          <div className="space-y-2">
            {alertesGlobales.map((a, i) => (
              <Link
                key={i}
                to={`/dossiers/${a.dossierId}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-navy-50 transition border border-transparent hover:border-navy-100"
              >
                <div className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  a.priorite === 'haute' ? 'bg-rose-500' : a.priorite === 'moyenne' ? 'bg-gold-500' : 'bg-navy-300',
                )} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-navy-900">{a.titre}</div>
                  <div className="text-xs text-navy-500 truncate">{a.detail}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-navy-300" />
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg text-navy-900">Prochains RDV</h3>
              <div className="divider-gold mt-1" />
            </div>
            <Link to="/agenda" className="text-xs font-semibold text-gold-700 hover:text-gold-800 inline-flex items-center">
              Agenda <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {prochainsRdv.map((r) => (
              <div key={r.id} className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-navy-50 border border-navy-100 flex flex-col items-center justify-center shrink-0">
                  <CalendarDays className="h-3.5 w-3.5 text-gold-600" />
                  <span className="text-[9px] font-semibold text-navy-600 uppercase">{r.type}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-navy-900 truncate">{r.clientNom}</div>
                  <div className="text-xs text-navy-500">{dateTimeFr(r.date)} · {r.lieu}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
