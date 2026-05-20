import { Download, TrendingUp, Euro, Percent, ChartPie } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import { commissions, encaissementsMensuels } from '@/data/mock'
import { eur, cn } from '@/lib/utils'
import { exportToXlsx } from '@/lib/excelExport'
import { useChartTheme } from '@/theme/useChartTheme'

export default function Commissions() {
  const chart = useChartTheme()
  const totalBrut = commissions.reduce((s, c) => s + c.brut, 0)
  const totalNet = commissions.reduce((s, c) => s + c.net, 0)
  const totalGsupport = commissions.reduce((s, c) => s + c.gsupport, 0)
  const tauxMoyen = commissions.reduce((s, c) => s + c.tauxCom, 0) / commissions.length

  const parBanque = commissions.reduce<Record<string, number>>((acc, c) => {
    acc[c.banque] = (acc[c.banque] || 0) + c.net
    return acc
  }, {})
  const pieData = Object.entries(parBanque).map(([name, value]) => ({ name, value }))
  const colors = chart.series

  return (
    <>
      <PageHeader
        eyebrow="Finances"
        title="Commissions & encaissements"
        description="Suivi G Support · commissions brut/net · répartition banques & encaissement mensuel"
        actions={
          <>
            <button
              className="btn-outline"
              onClick={async () => {
                const path = await exportToXlsx({
                  filename: `apolline-commissions-${new Date().toISOString().slice(0, 10)}.xlsx`,
                  sheets: [{
                    name: 'Commissions',
                    title: 'Apolline — Suivi des commissions',
                    subtitle: `${commissions.length} dossiers encaissés · ${new Date().toLocaleDateString('fr-FR')}`,
                    columns: [
                      { key: 'mois', header: 'Mois', width: 10, align: 'center' },
                      { key: 'dossier', header: 'Dossier', width: 12 },
                      { key: 'client', header: 'Client', width: 24 },
                      { key: 'banque', header: 'Banque', width: 22 },
                      { key: 'montantPret', header: 'Montant prêt', width: 16, format: 'currency', align: 'right' },
                      { key: 'tauxCom', header: 'Taux com.', width: 12, format: 'percent', align: 'right' },
                      { key: 'brut', header: 'Com. brute', width: 14, format: 'currency', align: 'right' },
                      { key: 'gsupport', header: 'G Support', width: 12, format: 'currency', align: 'right',
                        conditionalColor: () => 'FF8498BC' },
                      { key: 'net', header: 'Net encaissé', width: 14, format: 'currency', align: 'right',
                        conditionalColor: () => 'FF5E4820' },
                      { key: 'encaisse', header: 'Statut', width: 12, align: 'center',
                        conditionalBg: (v) => v === 'Encaissé' ? 'FFD1FAE5' : 'FFFEF3C7' },
                    ],
                    rows: commissions.map((c) => ({
                      mois: c.mois,
                      dossier: c.dossierId,
                      client: c.clientNom,
                      banque: c.banque,
                      montantPret: c.montantPret,
                      tauxCom: c.tauxCom,
                      brut: c.brut,
                      gsupport: -c.gsupport,
                      net: c.net,
                      encaisse: c.encaisse ? 'Encaissé' : 'En attente',
                    })),
                    totals: { label: 'Totaux', sumKeys: ['montantPret', 'brut', 'gsupport', 'net'] },
                  }],
                })
                if (path === null) return
                toast.success(`${commissions.length} commissions exportées en Excel`, { description: path !== 'download' ? path : 'Téléchargé' })
              }}
            >
              <Download className="h-4 w-4" /> Export Excel
            </button>
          </>
        }
      />

      <div className="page-body">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={Euro} label="Commissions brutes (6 mois)" value={eur(totalBrut)} hint="+14% vs. sem 1" color="gold" />
        <StatCard icon={TrendingUp} label="Commissions nettes" value={eur(totalNet)} hint="après G Support" color="emerald" />
        <StatCard icon={ChartPie} label="Frais G Support" value={eur(totalGsupport)} hint={`${((totalGsupport/totalBrut)*100).toFixed(1)}% du brut`} color="navy" />
        <StatCard icon={Percent} label="Taux commission moyen" value={`${(tauxMoyen * 100).toFixed(2)}%`} hint="sur 6 dossiers" color="navy" />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="card p-5 col-span-2">
          <h3 className="font-serif text-lg text-navy-900 mb-1">Encaissements mensuels</h3>
          <div className="divider-gold mb-4" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={encaissementsMensuels} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mois" tick={{ fill: chart.text, fontSize: 12 }} axisLine={{ stroke: chart.grid }} />
              <YAxis tick={{ fill: chart.text, fontSize: 12 }} axisLine={{ stroke: chart.grid }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip contentStyle={{ backgroundColor: chart.tooltip.bg, border: `1px solid ${chart.tooltip.border}`, borderRadius: 8, color: chart.tooltip.text }} formatter={(v: number) => eur(v)} />
              <Legend wrapperStyle={{ fontSize: 12, color: chart.text }} />
              <Bar dataKey="brut" fill={chart.series[2]} radius={[6, 6, 0, 0]} name="Brut" />
              <Bar dataKey="net" fill={chart.secondary} radius={[6, 6, 0, 0]} name="Net" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-serif text-lg text-navy-900 mb-1">Répartition par banque</h3>
          <div className="divider-gold mb-4" />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: chart.tooltip.bg, border: `1px solid ${chart.tooltip.border}`, borderRadius: 8, color: chart.tooltip.text }} formatter={(v: number) => eur(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {pieData.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                  <span className="text-navy-700 truncate">{p.name}</span>
                </div>
                <span className="font-semibold text-navy-900">{eur(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-navy-100 flex items-center justify-between">
          <h3 className="font-serif text-lg text-navy-900">Détail des commissions</h3>
          <div className="text-xs text-navy-500">{commissions.length} lignes</div>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Mois</th>
              <th className="table-th">Dossier</th>
              <th className="table-th">Client</th>
              <th className="table-th">Banque</th>
              <th className="table-th text-right">Montant prêt</th>
              <th className="table-th text-right">Taux com.</th>
              <th className="table-th text-right">Brut</th>
              <th className="table-th text-right">G Support</th>
              <th className="table-th text-right">Net</th>
              <th className="table-th text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="list-fast stagger-fast">
            {commissions.map((c) => (
              <tr key={c.dossierId} className="hover:bg-navy-50/60 transition-colors duration-150">
                <td className="table-td">
                  <span className="badge-navy font-mono">{c.mois}</span>
                </td>
                <td className="table-td font-mono text-xs text-gold-700">{c.dossierId}</td>
                <td className="table-td font-medium">{c.clientNom}</td>
                <td className="table-td">{c.banque}</td>
                <td className="table-td text-right">{eur(c.montantPret)}</td>
                <td className="table-td text-right font-mono">{(c.tauxCom * 100).toFixed(1)}%</td>
                <td className="table-td text-right font-semibold">{eur(c.brut)}</td>
                <td className="table-td text-right text-navy-500">−{eur(c.gsupport)}</td>
                <td className="table-td text-right font-semibold text-navy-900">{eur(c.net)}</td>
                <td className="table-td text-center">
                  {c.encaisse ? <span className="badge-success">Encaissé</span> : <span className="badge-warning">En attente</span>}
                </td>
              </tr>
            ))}
            <tr className="bg-gold-50/60 font-semibold border-t-2 border-gold-300">
              <td className="table-td" colSpan={6}>Total</td>
              <td className="table-td text-right">{eur(totalBrut)}</td>
              <td className="table-td text-right">−{eur(totalGsupport)}</td>
              <td className="table-td text-right text-gold-800">{eur(totalNet)}</td>
              <td className="table-td"></td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </>
  )
}

function StatCard({ icon: Icon, label, value, hint, color }: any) {
  const map: any = {
    gold: 'bg-gold-50 text-gold-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    navy: 'bg-navy-50 text-navy-700',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">{label}</div>
          <div className="kpi-value mt-2">{value}</div>
          {hint && <div className="text-xs text-navy-400 mt-1">{hint}</div>}
        </div>
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', map[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
