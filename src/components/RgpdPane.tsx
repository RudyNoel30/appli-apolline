/**
 * Onglet RGPD dans Paramètres → Données.
 * - Export article 15 d'un client (JSON téléchargeable)
 * - Effacement article 17 d'un client (admin uniquement, double confirmation)
 * - Lecture du registre des traitements
 */
import { useState } from 'react'
import { Search, Download, Trash2, AlertTriangle, BookOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Modal from './Modal'
import { useStore } from '@/stores/useStore'
import { useAuth, usePermissions } from '@/auth/AuthContext'
import { saveFile, FILTERS } from '@/lib/saveFile'
import { rgpd } from '@/db/api'
import { cn, dateFr } from '@/lib/utils'
import { confirmDialog } from '@/lib/dialog'
import type { Client } from '@/data/mock'

const safe = (s: unknown): string => (typeof s === 'string' ? s : '')

export default function RgpdPane() {
  const clients = useStore((s) => s.clients)
  const { isAdmin } = usePermissions()
  const { currentUser } = useAuth()

  const [query, setQuery] = useState('')
  const [eraseModal, setEraseModal] = useState<Client | null>(null)
  const [eraseReason, setEraseReason] = useState('')
  const [erasing, setErasing] = useState(false)
  const [registryModal, setRegistryModal] = useState(false)
  const [registry, setRegistry] = useState<Record<string, unknown> | null>(null)

  const filtered = (() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients.slice(0, 20)
    return clients.filter((c) => {
      const t = `${safe(c.nom)} ${safe(c.prenom)} ${safe(c.email)} ${safe(c.tel)}`.toLowerCase()
      return t.includes(q)
    }).slice(0, 30)
  })()

  const handleExport = async (c: Client) => {
    const t = toast.loading(`Export RGPD de ${c.prenom} ${c.nom}…`)
    try {
      const data = await rgpd.exportClient(c.id)
      const json = JSON.stringify(data, null, 2)
      const filename = `rgpd-export-${c.nom.toLowerCase()}-${c.prenom.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`
      const path = await saveFile({
        defaultFilename: filename, content: json,
        filters: FILTERS.json, mimeType: 'application/json',
      })
      if (path === null) { toast.dismiss(t); return }
      toast.success('Export RGPD prêt', { id: t, description: `Article 15 — à transmettre au client` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Échec export', { id: t, description: msg.slice(0, 200) })
    }
  }

  const handleErase = async () => {
    if (!eraseModal) return
    if (eraseReason.trim().length < 10) {
      toast.error('La raison doit faire au moins 10 caractères')
      return
    }

    const confirmed = await confirmDialog(
      `⚠️ ATTENTION — IRRÉVERSIBLE\n\n` +
      `Tu vas effacer définitivement :\n` +
      `• ${eraseModal.prenom} ${eraseModal.nom}\n` +
      `• ${eraseModal.dossierIds?.length ?? 0} dossier(s) associé(s)\n` +
      `• Tous les prêts, notes, RDV, commissions liés\n\n` +
      `Cela ne peut PAS être annulé.\n\nConfirmer la suppression ?`,
      {
        title: 'Effacement RGPD (Article 17)',
        kind: 'warning',
        okLabel: 'Effacer définitivement',
        cancelLabel: 'Annuler',
      },
    )
    if (!confirmed) return

    setErasing(true)
    try {
      const res = await rgpd.eraseClient(eraseModal.id, eraseReason.trim())
      toast.success('Effacement RGPD effectué', {
        description: `${res.erased.dossiers} dossier(s) supprimé(s) · trace conservée dans l'audit_log`,
        duration: 8000,
      })
      setEraseModal(null)
      setEraseReason('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Échec effacement', { description: msg.slice(0, 200) })
    } finally {
      setErasing(false)
    }
  }

  const showRegistry = async () => {
    setRegistryModal(true)
    if (!registry) {
      try {
        const r = await rgpd.registry()
        setRegistry(r)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        toast.error('Impossible de charger le registre', { description: msg.slice(0, 200) })
      }
    }
  }

  return (
    <>
      <div className="card p-6 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-navy-50 flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5 text-navy-700" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-lg text-navy-900">Conformité RGPD</h3>
            <p className="text-sm text-navy-500 mt-0.5">
              Permet d'exercer les droits RGPD des clients (articles 15 — accès, 17 — effacement, 30 — registre).
              Toutes les actions sont tracées dans l'audit log.
            </p>
          </div>
          <button onClick={showRegistry} className="btn-outline text-xs shrink-0">
            <BookOpen className="h-3.5 w-3.5" /> Registre des traitements
          </button>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 mb-4">
          <div className="font-semibold mb-0.5">Auto-purge active</div>
          Les dossiers Encaissés depuis &gt; 5 ans sont archivés automatiquement, ceux archivés &gt; 6 ans sont supprimés (article L223-1 Code de la consommation). L'audit_log conserve la trace.
        </div>
      </div>

      <div className="card p-6 mb-4">
        <h3 className="font-serif text-base text-navy-900 mb-1">Recherche client</h3>
        <div className="divider-gold mb-4" />
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
          <input
            type="text" value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, prénom, email…"
            className="input pl-10"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-navy-400 italic">Aucun client trouvé</div>
        ) : (
          <div className="border border-navy-100 rounded-lg overflow-hidden divide-y divide-navy-50">
            {filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-navy-50/40">
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                  c.statutCommercial === 'client' ? 'bg-gold-100 text-gold-800' : 'bg-navy-100 text-navy-700',
                )}>
                  {(safe(c.prenom)[0] ?? '').toUpperCase()}{(safe(c.nom)[0] ?? '').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-navy-900 truncate">{c.prenom} {c.nom}</div>
                  <div className="text-[11px] text-navy-500 truncate">{c.email} · {c.tel}</div>
                </div>
                <div className="text-[11px] text-navy-400 shrink-0">
                  {c.dossierIds?.length ?? 0} dossier(s)
                  {c.lastActivity && <div>{dateFr(c.lastActivity)}</div>}
                </div>
                <button
                  onClick={() => handleExport(c)}
                  className="btn-outline text-xs"
                  title="Exporter toutes les données du client (article 15)"
                >
                  <Download className="h-3.5 w-3.5" /> Exporter
                </button>
                <button
                  onClick={() => { setEraseModal(c); setEraseReason('') }}
                  disabled={!isAdmin}
                  title={isAdmin ? 'Effacer définitivement (article 17)' : 'Réservé aux administrateurs'}
                  className="btn text-xs bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Effacer
                </button>
              </div>
            ))}
          </div>
        )}

        {!isAdmin && (
          <div className="mt-3 text-[11px] text-navy-500 italic">
            Connecté en tant que <strong>{currentUser?.role ?? 'inconnu'}</strong> — l'effacement RGPD est réservé aux administrateurs.
          </div>
        )}
      </div>

      {/* Modal effacement */}
      {eraseModal && (
        <Modal open onClose={() => setEraseModal(null)} size="md"
          title="Effacement RGPD — article 17"
          description="Suppression définitive et irréversible des données personnelles du client"
          actions={<>
            <button className="btn-outline" onClick={() => setEraseModal(null)} disabled={erasing}>Annuler</button>
            <button
              className="btn bg-rose-600 text-white hover:bg-rose-700"
              onClick={handleErase}
              disabled={erasing || eraseReason.trim().length < 10}
            >
              {erasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {erasing ? 'Effacement…' : 'Effacer définitivement'}
            </button>
          </>}>
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-900 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1">Action irréversible</div>
                <div className="text-xs">
                  Vas effacer <strong>{eraseModal.prenom} {eraseModal.nom}</strong> et <strong>{eraseModal.dossierIds?.length ?? 0} dossier(s)</strong> associé(s) avec leurs prêts, notes, RDV, commissions.
                  L'audit_log conserve la trace de cet effacement (preuve de traitement RGPD obligatoire).
                </div>
              </div>
            </div>
            <div>
              <label className="label">Raison de l'effacement (≥ 10 caractères) *</label>
              <textarea
                className="input min-h-[80px]"
                value={eraseReason}
                onChange={(e) => setEraseReason(e.target.value)}
                placeholder="Demande client par email du 30/04/2026"
                autoFocus
              />
              <div className="text-[10px] text-navy-400 mt-1">
                Cette raison sera conservée dans l'audit_log pour justifier l'effacement en cas de contrôle CNIL.
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal registre */}
      {registryModal && (
        <Modal open onClose={() => setRegistryModal(false)} size="lg"
          title="Registre des traitements — article 30"
          description="Document de conformité RGPD à fournir en cas de contrôle CNIL"
          actions={<button className="btn-outline" onClick={() => setRegistryModal(false)}>Fermer</button>}>
          {!registry ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-navy-400" /></div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <pre className="bg-ivory border border-navy-100 rounded-lg p-3 text-[11px] font-mono whitespace-pre-wrap text-navy-700">
                {JSON.stringify(registry, null, 2)}
              </pre>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
