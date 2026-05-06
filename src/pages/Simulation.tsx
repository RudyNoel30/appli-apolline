import { useState, useMemo } from 'react'
import { Calculator, Download, TrendingDown, Award, Save, Trash2, History } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import { useStore } from '@/stores/useStore'
import { eur, pct, cn, dateTimeFr } from '@/lib/utils'
import { exportToXlsx } from '@/lib/excelExport'
import { exportToHtml } from '@/lib/htmlExport'
import { tauxPourDuree } from '@/data/mock'

function mensualite(capital: number, tauxAnnuel: number, dureeMois: number) {
  const t = tauxAnnuel / 12
  if (t === 0) return capital / dureeMois
  return (capital * t) / (1 - Math.pow(1 + t, -dureeMois))
}

export default function Simulation() {
  const banques = useStore((s) => s.banques)
  const simulations = useStore((s) => s.simulations)
  const saveSimulation = useStore((s) => s.saveSimulation)
  const deleteSimulation = useStore((s) => s.deleteSimulation)

  const [montant, setMontant] = useState(245000)
  const [duree, setDuree] = useState(300)
  const [apport, setApport] = useState(45000)
  const [revenu, setRevenu] = useState(4850)
  const [assurance, setAssurance] = useState<'groupe' | 'delegataire'>('groupe')
  const [showHistory, setShowHistory] = useState(false)
  const [saveModal, setSaveModal] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')

  const tauxAssuranceDelegataire = 0.00110

  const lignes = useMemo(() => {
    return banques.map((b) => {
      const taux = tauxPourDuree(b, duree)
      const men = mensualite(montant, taux, duree)
      const tauxAss = assurance === 'groupe' ? b.assuranceGroupePct : tauxAssuranceDelegataire
      const coutAssuranceMensuel = (montant * tauxAss) / 12
      const mensualiteTotale = men + coutAssuranceMensuel
      const coutCredit = men * duree - montant
      const coutAssuranceTotal = coutAssuranceMensuel * duree
      const taeg = b.taegMoyen
      const tauxEndettement = mensualiteTotale / revenu
      return {
        banque: b,
        taux,
        taeg,
        mensualite: men,
        coutAssuranceMensuel,
        mensualiteTotale,
        coutCredit,
        coutAssuranceTotal,
        coutTotal: coutCredit + coutAssuranceTotal + b.fraisDossier,
        tauxEndettement,
      }
    }).sort((a, b) => a.coutTotal - b.coutTotal)
  }, [banques, montant, duree, revenu, assurance])

  const meilleur = lignes[0]

  const handleSave = () => {
    const label = saveLabel.trim() || `Simu ${new Date().toLocaleDateString('fr-FR')} — ${eur(montant)}/${duree / 12}ans`
    saveSimulation({
      label,
      montant,
      duree,
      apport,
      revenu,
      assurance,
      meilleureBanque: meilleur.banque.nom,
      meilleureMensualite: Math.round(meilleur.mensualiteTotale),
    })
    setSaveModal(false)
    setSaveLabel('')
    toast.success('Simulation enregistrée', { description: label })
  }

  const exportXlsx = async () => {
    const path = await exportToXlsx({
      filename: `apolline-simulation-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [{
        name: 'Simulation',
        title: "Extr'Apol — Comparatif multi-banques",
        subtitle: `Montant ${eur(montant)} · Durée ${duree / 12} ans · Assurance ${assurance === 'groupe' ? 'CNP Groupe' : 'Délégataire'} · ${new Date().toLocaleDateString('fr-FR')}`,
        columns: [
          { key: 'banque', header: 'Banque', width: 28 },
          { key: 'taux', header: 'Taux nominal', width: 14, format: 'percent', align: 'right' },
          { key: 'taeg', header: 'TAEG', width: 12, format: 'percent', align: 'right' },
          { key: 'mensualite', header: 'Mensualité hors ass.', width: 18, format: 'currency', align: 'right' },
          { key: 'assurance', header: 'Assurance / mois', width: 16, format: 'currency', align: 'right' },
          { key: 'mensualiteTot', header: 'Mensualité totale', width: 18, format: 'currency', align: 'right' },
          { key: 'coutCredit', header: 'Coût crédit', width: 16, format: 'currency', align: 'right' },
          { key: 'coutTotal', header: 'Coût total', width: 16, format: 'currency', align: 'right',
            conditionalBg: (_v, row) => row.banque === meilleur.banque.nom ? 'FFF6EED3' : null },
          { key: 'endettement', header: 'Endettement', width: 14, format: 'percent', align: 'right',
            conditionalColor: (v) => Number(v) > 0.35 ? 'FFB91C1C' : 'FF047857' },
        ],
        rows: lignes.map((l) => ({
          banque: l.banque.nom,
          taux: l.taux,
          taeg: l.taeg,
          mensualite: Math.round(l.mensualite),
          assurance: Math.round(l.coutAssuranceMensuel),
          mensualiteTot: Math.round(l.mensualiteTotale),
          coutCredit: Math.round(l.coutCredit),
          coutTotal: Math.round(l.coutTotal),
          endettement: l.tauxEndettement,
        })),
      }],
    })
    if (path === null) return
    toast.success('Comparatif exporté en Excel', { description: path !== 'download' ? path : 'Téléchargé' })
  }

  const exportHtml = async () => {
    const path = await exportToHtml({
      filename: `apolline-simulation-${new Date().toISOString().slice(0, 10)}.html`,
      title: 'Comparatif de financement',
      subtitle: `Étude multi-banques · ${new Date().toLocaleDateString('fr-FR')}`,
      eyebrow: 'Simulation',
      sections: [
        { kind: 'definition', title: 'Paramètres de la simulation', items: [
          { label: 'Montant emprunté', value: eur(montant) },
          { label: 'Durée', value: `${duree / 12} ans` },
          { label: 'Apport personnel', value: eur(apport) },
          { label: 'Revenu net mensuel', value: eur(revenu) },
          { label: 'Type d\'assurance', value: assurance === 'groupe' ? 'CNP Groupe' : 'Délégataire' },
          { label: 'Quotité', value: '100% / 100%' },
        ]},
        { kind: 'kpis', items: [
          { label: 'Meilleur choix', value: meilleur.banque.nom, hint: `Coût total : ${eur(meilleur.coutTotal)}` },
          { label: 'Mensualité', value: eur(Math.round(meilleur.mensualiteTotale)), hint: `hors ass. ${eur(Math.round(meilleur.mensualite))}` },
          { label: 'Taux endettement', value: pct(meilleur.tauxEndettement, 1), hint: meilleur.tauxEndettement <= 0.35 ? 'Conforme HCSF' : 'Hors norme HCSF' },
          { label: 'Écart min/max', value: eur(lignes[lignes.length - 1].coutTotal - lignes[0].coutTotal), hint: 'économie potentielle' },
        ]},
        { kind: 'table', title: 'Détail par banque',
          headers: ['Banque', 'Taux', 'TAEG', 'Mensualité', 'Assurance/mois', 'Total /mois', 'Coût total', 'Endettement'],
          rows: lignes.map((l) => [
            l.banque.nom,
            pct(l.taux, 3),
            pct(l.taeg, 3),
            eur(Math.round(l.mensualite)),
            eur(Math.round(l.coutAssuranceMensuel)),
            eur(Math.round(l.mensualiteTotale)),
            eur(Math.round(l.coutTotal)),
            pct(l.tauxEndettement, 1),
          ]),
          highlight: (_, i) => i === 0 ? 'gold' : null,
        },
        { kind: 'text', title: 'Notes',
          paragraphs: [
            'Barèmes indicatifs fournis par les partenaires bancaires, sujet à évolution.',
            'Une simulation personnalisée par banque reste nécessaire avant envoi du dossier.',
            'Le taux d\'endettement intègre la mensualité totale (crédit + assurance) rapportée au revenu net mensuel retenu.',
          ],
        },
      ],
    })
    if (path === null) return
    toast.success('Rapport HTML généré', { description: path !== 'download' ? path : 'Téléchargé' })
  }

  const loadSim = (id: string) => {
    const s = simulations.find((x) => x.id === id)
    if (!s) return
    setMontant(s.montant)
    setDuree(s.duree)
    setApport(s.apport)
    setRevenu(s.revenu)
    setAssurance(s.assurance)
    setShowHistory(false)
    toast.success('Simulation chargée', { description: s.label })
  }

  return (
    <>
      <PageHeader
        eyebrow="Outil"
        title="Simulation multi-banques"
        description="Comparez en temps réel les 5 banques régionales BFC · assurance CNP Groupe vs Délégataire (quotité 100/100)."
        actions={
          <>
            <button className="btn-outline" onClick={() => setShowHistory(true)}>
              <History className="h-4 w-4" /> Historique · {simulations.length}
            </button>
            <button className="btn-outline" onClick={exportHtml}><Download className="h-4 w-4" /> Rapport HTML</button>
            <button className="btn-outline" onClick={exportXlsx}><Download className="h-4 w-4" /> Export Excel</button>
            <button className="btn-gold" onClick={() => setSaveModal(true)}>
              <Save className="h-4 w-4" /> Enregistrer
            </button>
          </>
        }
      />

      <div className="page-body">
        <div className="card p-6 mb-6">
          <div className="grid grid-cols-5 gap-4 items-end">
            <div>
              <label className="label">Montant emprunté</label>
              <div className="relative">
                <input
                  type="number"
                  value={montant}
                  onChange={(e) => setMontant(Number(e.target.value))}
                  className="input pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-navy-500">€</span>
              </div>
            </div>
            <div>
              <label className="label">Durée</label>
              <select value={duree} onChange={(e) => setDuree(Number(e.target.value))} className="input">
                <option value={180}>15 ans</option>
                <option value={240}>20 ans</option>
                <option value={300}>25 ans</option>
              </select>
            </div>
            <div>
              <label className="label">Apport</label>
              <div className="relative">
                <input
                  type="number"
                  value={apport}
                  onChange={(e) => setApport(Number(e.target.value))}
                  className="input pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-navy-500">€</span>
              </div>
            </div>
            <div>
              <label className="label">Revenu net / mois</label>
              <div className="relative">
                <input
                  type="number"
                  value={revenu}
                  onChange={(e) => setRevenu(Number(e.target.value))}
                  className="input pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-navy-500">€</span>
              </div>
            </div>
            <div>
              <label className="label">Assurance</label>
              <div className="flex rounded-lg border border-navy-200 bg-white p-0.5">
                <button
                  onClick={() => setAssurance('groupe')}
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition',
                    assurance === 'groupe' ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50',
                  )}
                >CNP Groupe</button>
                <button
                  onClick={() => setAssurance('delegataire')}
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition',
                    assurance === 'delegataire' ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50',
                  )}
                >Délégataire</button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card p-5 bg-gradient-to-br from-navy-900 to-navy-800 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-gold-400" />
              <span className="text-[10px] uppercase tracking-wider text-gold-300 font-semibold">Meilleur choix</span>
            </div>
            <div className="font-serif text-lg">{meilleur.banque.nom}</div>
            <div className="mt-3 text-xs text-navy-200">Coût total</div>
            <div className="font-serif text-2xl font-semibold text-gold-400">{eur(meilleur.coutTotal)}</div>
          </div>
          <div className="card p-5">
            <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold mb-2">Mensualité meilleure</div>
            <div className="font-serif text-2xl font-semibold text-navy-900">{eur(Math.round(meilleur.mensualiteTotale))}</div>
            <div className="text-[11px] text-navy-500 mt-1">hors ass. : {eur(Math.round(meilleur.mensualite))}</div>
          </div>
          <div className="card p-5">
            <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold mb-2">Taux endettement</div>
            <div className={cn(
              'font-serif text-2xl font-semibold',
              meilleur.tauxEndettement <= 0.35 ? 'text-emerald-700' : 'text-rose-700',
            )}>{pct(meilleur.tauxEndettement, 1)}</div>
            <div className="text-[11px] text-navy-500 mt-1">{meilleur.tauxEndettement <= 0.35 ? 'Conforme HCSF' : 'Hors norme HCSF'}</div>
          </div>
          <div className="card p-5">
            <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold mb-2">Écart min/max</div>
            <div className="font-serif text-2xl font-semibold text-navy-900">
              {eur(lignes[lignes.length - 1].coutTotal - lignes[0].coutTotal)}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> économie potentielle
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Banque</th>
                <th className="table-th text-right">Taux nominal</th>
                <th className="table-th text-right">TAEG</th>
                <th className="table-th text-right">Mensualité hors ass.</th>
                <th className="table-th text-right">Assurance / mois</th>
                <th className="table-th text-right">Mensualité totale</th>
                <th className="table-th text-right">Coût crédit</th>
                <th className="table-th text-right">Coût total</th>
                <th className="table-th text-right">Endettement</th>
              </tr>
            </thead>
            <tbody className="list-fast">
              {lignes.map((l, i) => (
                <tr key={l.banque.id} className={cn('transition-colors duration-150', i === 0 ? 'bg-gold-50/60' : 'hover:bg-navy-50/60')}>
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-1 rounded-full" style={{ backgroundColor: l.banque.couleur }} />
                      <span className="font-semibold">{l.banque.nom}</span>
                      {i === 0 && <span className="badge-gold ml-1">Meilleur</span>}
                    </div>
                  </td>
                  <td className="table-td text-right font-mono">{pct(l.taux, 3)}</td>
                  <td className="table-td text-right font-mono text-navy-500">{pct(l.taeg, 3)}</td>
                  <td className="table-td text-right">{eur(Math.round(l.mensualite))}</td>
                  <td className="table-td text-right text-navy-500">{eur(Math.round(l.coutAssuranceMensuel))}</td>
                  <td className="table-td text-right font-semibold">{eur(Math.round(l.mensualiteTotale))}</td>
                  <td className="table-td text-right">{eur(Math.round(l.coutCredit))}</td>
                  <td className="table-td text-right font-semibold text-navy-900">{eur(Math.round(l.coutTotal))}</td>
                  <td className="table-td text-right">
                    <span className={cn(l.tauxEndettement <= 0.35 ? 'text-emerald-700' : 'text-rose-700', 'font-semibold')}>
                      {pct(l.tauxEndettement, 1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-navy-400 mt-3">
          Barèmes indicatifs · avril 2026 · taux moyen toutes durées confondues. Une simulation personnalisée par banque reste nécessaire.
        </div>
      </div>

      {saveModal && (
        <Modal
          open
          onClose={() => setSaveModal(false)}
          title="Enregistrer cette simulation"
          description="Pour retrouver rapidement les paramètres et le résultat"
          size="sm"
          actions={
            <>
              <button className="btn-outline" onClick={() => setSaveModal(false)}>Annuler</button>
              <button className="btn-gold" onClick={handleSave}><Save className="h-4 w-4" /> Enregistrer</button>
            </>
          }
        >
          <label className="label">Libellé</label>
          <input
            className="input"
            placeholder={`Simu ${new Date().toLocaleDateString('fr-FR')} — ${eur(montant)}/${duree / 12}ans`}
            value={saveLabel}
            onChange={(e) => setSaveLabel(e.target.value)}
            autoFocus
          />
          <div className="mt-4 rounded-lg bg-ivory p-3 text-xs text-navy-600 space-y-1">
            <div>Montant : <strong>{eur(montant)}</strong></div>
            <div>Durée : <strong>{duree / 12} ans</strong></div>
            <div>Meilleure banque : <strong>{meilleur.banque.nom}</strong></div>
            <div>Mensualité totale : <strong>{eur(Math.round(meilleur.mensualiteTotale))}</strong></div>
          </div>
        </Modal>
      )}

      {showHistory && (
        <Modal
          open
          onClose={() => setShowHistory(false)}
          title={`Simulations enregistrées — ${simulations.length}`}
          description="Cliquez pour recharger une simulation"
          size="lg"
          actions={<button className="btn-outline" onClick={() => setShowHistory(false)}>Fermer</button>}
        >
          {simulations.length === 0 && (
            <div className="text-center text-sm text-navy-400 italic py-8">
              Aucune simulation enregistrée pour l'instant.
            </div>
          )}
          <div className="space-y-2">
            {simulations.map((s) => (
              <div key={s.id} className="group flex items-center gap-4 p-3 rounded-lg border border-navy-100 hover:border-gold-300 transition">
                <div className="flex-1 cursor-pointer" onClick={() => loadSim(s.id)}>
                  <div className="font-semibold text-sm text-navy-900">{s.label}</div>
                  <div className="text-[11px] text-navy-500">
                    {eur(s.montant)} · {s.duree / 12} ans · assurance {s.assurance}
                    <span className="mx-2">·</span>
                    <span className="text-gold-700 font-semibold">{s.meilleureBanque}</span>
                    <span className="mx-1">·</span>
                    mensualité {eur(s.meilleureMensualite)}
                  </div>
                  <div className="text-[10px] text-navy-400 mt-0.5">{dateTimeFr(s.createdAt)}</div>
                </div>
                <button
                  onClick={() => {
                    deleteSimulation(s.id)
                    toast.success('Simulation supprimée')
                  }}
                  className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-md hover:bg-rose-50 flex items-center justify-center text-navy-400 hover:text-rose-700 transition"
                  title="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
