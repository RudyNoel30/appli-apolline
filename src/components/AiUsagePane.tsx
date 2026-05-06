/**
 * Pane "Conso IA" — agrège la consommation Claude API depuis l'audit_log.
 */
import { useEffect, useMemo, useState } from 'react'
import { Sparkles, RefreshCw, AlertCircle, Loader2, Zap } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ai, type AiUsageStats, type AiSkillInfo } from '@/db/api'
import { useAuth, usePermissions } from '@/auth/AuthContext'
import { dateTimeFr } from '@/lib/utils'

const eur4 = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n)

export default function AiUsagePane() {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<AiUsageStats | null>(null)
  const [skills, setSkills] = useState<AiSkillInfo[]>([])
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isAdmin } = usePermissions()
  const { currentUser } = useAuth()

  const skillLabel = (name: string): string => skills.find((s) => s.name === name)?.title ?? name

  const load = async (d: number) => {
    setLoading(true); setError(null)
    try {
      const [u, s, h] = await Promise.all([ai.usage(d), ai.skills(), ai.health()])
      setStats(u)
      setSkills(s.skills)
      setConfigured(h.configured)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load(days) }, [days])

  const projection = useMemo(() => {
    if (!stats || stats.byDay.length === 0) return null
    const dailyAvg = stats.total.cost / Math.max(stats.byDay.length, 1)
    return dailyAvg * 30
  }, [stats])

  return (
    <>
      <div className="card p-6 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-gold-100 to-gold-50 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-gold-700" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-lg text-navy-900">Consommation IA — Claude API</h3>
            <p className="text-sm text-navy-500 mt-0.5">
              Détail des appels skills Apolline (DDP, dossier banquier, étude client, simulation, DVF).
              Source : audit_log local — fiable même si la console Anthropic est inaccessible.
            </p>
            {configured === false && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
                <strong>Clé API non configurée.</strong> Ajoute <code>ANTHROPIC_API_KEY=sk-ant-...</code> dans le .env du backend pour activer les skills IA.
              </div>
            )}
          </div>
          <div className="flex gap-1 items-center">
            {[7, 30, 90, 365].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`text-xs px-2.5 py-1 rounded-md transition ${days === d ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50'}`}>
                {d === 365 ? '1 an' : `${d} j`}
              </button>
            ))}
            <button onClick={() => load(days)} disabled={loading}
              className="ml-1 h-7 w-7 rounded-md hover:bg-navy-50 flex items-center justify-center text-navy-500">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Erreur de chargement</div>
              <div className="mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {loading && !stats && (
          <div className="py-12 text-center text-sm text-navy-400">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Chargement…
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <Kpi label="Coût total" value={eur4(stats.total.cost)} hint={`${stats.period.days} derniers jours`} accent="gold" />
              <Kpi label="Générations" value={String(stats.total.count)} hint={`Moy. ${(stats.total.count / Math.max(stats.byDay.length, 1)).toFixed(1)}/jour`} />
              <Kpi label="Coût moyen / appel" value={stats.total.count > 0 ? eur4(stats.total.cost / stats.total.count) : '—'} hint="Inclut cache hit" />
              <Kpi label="Projection 30 j" value={projection != null ? eur4(projection) : '—'} hint="Au rythme actuel" accent={(projection ?? 0) > 30 ? 'rose' : 'navy'} />
            </div>

            {/* Split Skills classiques vs Polette (Coworker) + Top tools Polette */}
            {stats.split && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="rounded-xl border border-navy-100 bg-gradient-to-br from-navy-50/60 to-white p-3">
                  <div className="kicker mb-1.5">Skills classiques</div>
                  <div className="font-serif text-2xl text-navy-900 tabular-nums">{eur4(stats.split.skills.cost)}</div>
                  <div className="text-[11px] text-navy-500 mt-0.5">
                    {stats.split.skills.count} génération{stats.split.skills.count > 1 ? 's' : ''} · Boutons IA dossier
                  </div>
                </div>
                <div className="rounded-xl border border-gold-200 bg-gradient-to-br from-gold-50 to-white p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500 to-transparent" />
                  <div className="kicker text-gold-700 mb-1.5 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" /> Polette (Coworker)
                  </div>
                  <div className="font-serif text-2xl text-gold-900 tabular-nums">{eur4(stats.split.coworker.cost)}</div>
                  <div className="text-[11px] text-navy-600 mt-0.5">
                    {stats.split.coworker.count} échange{stats.split.coworker.count > 1 ? 's' : ''} · Conversations IA
                  </div>
                </div>
                {stats.topTools && stats.topTools.length > 0 ? (
                  <div className="rounded-xl border border-navy-100 bg-white p-3">
                    <div className="kicker mb-1.5">Top tools Polette</div>
                    <div className="space-y-1 mt-1">
                      {stats.topTools.slice(0, 4).map((t) => (
                        <div key={t.name} className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-navy-700 truncate">{t.name}</span>
                          <span className="text-gold-700 tabular-nums shrink-0 ml-2">×{t.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-navy-100 bg-white p-3 flex items-center justify-center">
                    <div className="text-[11px] text-navy-400 italic text-center">
                      Aucun tool Polette<br />utilisé sur la période
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Alerte si projection > seuil mensuel */}
            {projection != null && projection > 50 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
                <div className="text-xs text-amber-900">
                  <strong>Projection {eur4(projection)} / mois</strong> au rythme actuel.
                  Pense à activer le prompt caching ou à privilégier Haiku pour les skills simples si tu veux réduire la facture.
                </div>
              </div>
            )}

            {stats.byDay.length > 1 && (
              <div className="mb-6">
                <div className="text-[11px] uppercase tracking-wider text-navy-500 font-semibold mb-2">Coût par jour (€)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={stats.byDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#E3E8F2" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: '#4F6696', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fill: '#4F6696', fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(2)} €`} />
                    <Tooltip contentStyle={{ backgroundColor: '#0A1F3D', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }}
                      formatter={(v: number, name: string) => [name === 'cost' ? eur4(v) : v, name === 'cost' ? 'Coût' : 'Nb gen']} />
                    <Line type="monotone" dataKey="cost" stroke="#C9A961" strokeWidth={2.5} dot={{ r: 3, fill: '#C9A961' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {stats.bySkill.length > 0 && (
              <div className="mb-6">
                <div className="text-[11px] uppercase tracking-wider text-navy-500 font-semibold mb-2">Par skill</div>
                <ResponsiveContainer width="100%" height={Math.max(80, stats.bySkill.length * 28)}>
                  <BarChart data={stats.bySkill.map((s) => ({ ...s, label: skillLabel(s.skill) }))} layout="vertical" margin={{ top: 0, right: 10, left: 130, bottom: 0 }}>
                    <CartesianGrid stroke="#E3E8F2" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#4F6696', fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(2)} €`} />
                    <YAxis type="category" dataKey="label" tick={{ fill: '#4F6696', fontSize: 11 }} width={120} />
                    <Tooltip contentStyle={{ backgroundColor: '#0A1F3D', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }}
                      formatter={(v: number, name: string) => [name === 'cost' ? eur4(v) : v, name === 'cost' ? 'Coût' : 'Nb']} />
                    <Bar dataKey="cost" fill="#C9A961" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {isAdmin && stats.byUser.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] uppercase tracking-wider text-navy-500 font-semibold mb-2">Par utilisateur (admin)</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="table-th">Email</th>
                      <th className="table-th text-right">Gens</th>
                      <th className="table-th text-right">Coût</th>
                      <th className="table-th text-right">Moy.</th>
                    </tr>
                  </thead>
                  <tbody className="list-fast">
                    {stats.byUser.map((u) => (
                      <tr key={u.userId} className="hover:bg-navy-50/40">
                        <td className="table-td truncate max-w-[260px]">{u.userEmail}</td>
                        <td className="table-td text-right tabular-nums">{u.count}</td>
                        <td className="table-td text-right font-semibold tabular-nums">{eur4(u.cost)}</td>
                        <td className="table-td text-right text-xs text-navy-500 tabular-nums">{eur4(u.cost / Math.max(u.count, 1))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <div className="text-[11px] uppercase tracking-wider text-navy-500 font-semibold mb-2">
                Dernières générations ({stats.recent.length})
              </div>
              <div className="border border-navy-100 rounded-lg overflow-hidden divide-y divide-navy-50 max-h-[280px] overflow-y-auto">
                {stats.recent.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-navy-400 italic">Aucune génération sur la période.</div>
                ) : stats.recent.slice(0, 25).map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-navy-50/40">
                    {r.via === 'coworker' ? (
                      <Sparkles className="h-3 w-3 text-gold-600 shrink-0" />
                    ) : (
                      <Zap className="h-3 w-3 text-gold-600 shrink-0" />
                    )}
                    <div className="font-mono text-navy-500 shrink-0">{dateTimeFr(r.ts)}</div>
                    <div className="font-medium text-navy-800 shrink-0 w-44 truncate flex items-center gap-1.5">
                      {skillLabel(r.skill)}
                      {r.via === 'coworker' && (
                        <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-gold-100 text-gold-800 font-bold">J</span>
                      )}
                    </div>
                    <div className="flex-1 text-navy-500 truncate">{r.userEmail ?? '—'}</div>
                    <div className="text-right text-navy-500 tabular-nums shrink-0">
                      {r.tokensIn > 0 && <span>{r.tokensIn.toLocaleString('fr-FR')} ↓ · {r.tokensOut.toLocaleString('fr-FR')} ↑</span>}
                    </div>
                    <div className="font-semibold text-gold-700 tabular-nums shrink-0 w-20 text-right">{eur4(r.cost)}</div>
                  </div>
                ))}
              </div>
            </div>

            {skills.length > 0 && (
              <div className="mt-4 pt-4 border-t border-navy-100">
                <div className="text-[11px] uppercase tracking-wider text-navy-500 font-semibold mb-2">
                  Skills disponibles ({skills.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s.name} className={`text-[10px] px-2 py-0.5 rounded-md ${
                      s.tier === 'sonnet' ? 'bg-navy-100 text-navy-800' :
                      s.tier === 'haiku' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`} title={`${s.model}\n${s.description}`}>
                      {s.title} · {s.tier}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 text-[11px] text-navy-400 italic">
              Coûts estimés depuis les barèmes Anthropic (~ €1 = $1.05). Pour le détail exact, console Anthropic.
              {!isAdmin && currentUser && ' · Tableau "par utilisateur" réservé aux administrateurs.'}
            </div>
          </>
        )}
      </div>
    </>
  )
}

function Kpi({ label, value, hint, accent = 'navy' }: { label: string; value: string; hint?: string; accent?: 'navy' | 'gold' | 'rose' }) {
  const accentClass = accent === 'gold' ? 'text-gold-700' : accent === 'rose' ? 'text-rose-700' : 'text-navy-900'
  return (
    <div className="rounded-lg bg-ivory border border-navy-100 p-3">
      <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold mb-1">{label}</div>
      <div className={`font-serif text-xl font-semibold tabular-nums ${accentClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-navy-400 mt-0.5">{hint}</div>}
    </div>
  )
}
