import { useState, useEffect, type FormEvent } from 'react'
import {
  User2, Landmark, FileText, Database, ShieldCheck, Palette, UsersRound,
  Plus, Trash2, Pencil, KeyRound, Save, Download, RefreshCw, Plug, Check,
  LinkIcon, Calendar, Mail, Scale, Sparkles, Shield,
} from 'lucide-react'
import ConformitePane from '@/components/ConformitePane'
import RgpdPane from '@/components/RgpdPane'
import AiUsagePane from '@/components/AiUsagePane'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import { ROLE_BADGE, type Collaborateur, type Role, type Banque } from '@/data/mock'
import { useAuth } from '@/auth/AuthContext'
import { useStore, getO365EmailFor, type Template, type Theme } from '@/stores/useStore'
import { pct, cn, initials, dateFr, eur } from '@/lib/utils'
import { confirmDialog } from '@/lib/dialog'
import * as o365 from '@/o365/msal'
import { O365_CLIENT_ID, O365_TENANT_ID } from '@/o365/config'
import { saveFile, FILTERS } from '@/lib/saveFile'
import { exportToXlsx } from '@/lib/excelExport'
import { sync, auth } from '@/db/api'

type Tab = 'profil' | 'collaborateurs' | 'banques' | 'templates' | 'integrations' | 'donnees' | 'rgpd' | 'conformite' | 'ai' | 'securite' | 'apparence'

export default function Parametres() {
  const [tab, setTab] = useState<Tab>('profil')

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'profil', label: 'Mon profil', icon: User2 },
    { key: 'collaborateurs', label: 'Collaborateurs', icon: UsersRound },
    { key: 'banques', label: 'Banques & barèmes', icon: Landmark },
    { key: 'templates', label: 'Modèles DDP / HTML', icon: FileText },
    { key: 'integrations', label: 'Intégrations', icon: Plug },
    { key: 'donnees', label: 'Données & sauvegarde', icon: Database },
    { key: 'rgpd', label: 'RGPD & conformité', icon: Scale },
    { key: 'conformite', label: 'Conformité IOBSP', icon: Shield },
    { key: 'ai', label: 'Conso IA', icon: Sparkles },
    { key: 'securite', label: 'Sécurité', icon: ShieldCheck },
    { key: 'apparence', label: 'Apparence', icon: Palette },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Paramètres"
        description="Profil, équipe, banques, modèles, intégrations, sauvegardes et préférences"
      />

      <div className="grid grid-cols-4 gap-6 flex-1 min-h-0">
        <nav className="col-span-1 card p-2 self-start">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-left transition',
                tab === t.key ? 'bg-navy-900 text-white' : 'text-navy-700 hover:bg-navy-50',
              )}
            >
              <t.icon className={cn('h-4 w-4', tab === t.key ? 'text-gold-400' : 'text-navy-500')} />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="col-span-3 overflow-y-auto -mr-2 pr-2">
          {tab === 'profil' && <ProfilPane />}
          {tab === 'collaborateurs' && <CollaborateursPane />}
          {tab === 'banques' && <BanquesPane />}
          {tab === 'templates' && <TemplatesPane />}
          {tab === 'integrations' && <IntegrationsPane />}
          {tab === 'donnees' && <DonneesPane />}
          {tab === 'rgpd' && <RgpdPane />}
          {tab === 'conformite' && <ConformitePane />}
          {tab === 'ai' && <AiUsagePane />}
          {tab === 'securite' && <SecuritePane />}
          {tab === 'apparence' && <AppearancePane />}
        </div>
      </div>
    </>
  )
}

function Section({ title, children, action }: { title: string; children: any; action?: React.ReactNode }) {
  return (
    <div className="card p-6 mb-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-navy-900">{title}</h3>
        {action}
      </div>
      <div className="divider-gold my-3" />
      {children}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={!onChange}
        className={cn('input', !onChange && 'bg-ivory cursor-default')}
      />
    </div>
  )
}

/* ─────────────────────── PROFIL ─────────────────────── */
function ProfilPane() {
  const { currentUser } = useAuth()
  const updateCollaborateur = useStore((s) => s.updateCollaborateur)
  const societe = useStore((s) => s.settings.societe)
  const updateSettings = useStore((s) => s.updateSettings)
  const [f, setF] = useState(() => ({
    prenom: currentUser?.prenom ?? '',
    nom: currentUser?.nom ?? '',
    email: currentUser?.email ?? '',
    telephone: currentUser?.telephone ?? '',
    bio: currentUser?.bio ?? '',
    signatureHtml: currentUser?.signatureHtml ?? '',
    signatureAutoInsert: currentUser?.signatureAutoInsert ?? true,
    societe: { ...societe },
  }))

  if (!currentUser) return null

  const save = () => {
    const { societe: societeForm, ...userFields } = f
    updateCollaborateur(currentUser.id, userFields)
    updateSettings({ societe: societeForm })
    toast.success('Profil mis à jour')
  }

  const generateDefaultSignature = () => {
    const html = `<div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1f3a7a;">
  <p style="margin: 0;"><strong>${f.prenom} ${f.nom.toUpperCase()}</strong> | Groupe APOLLINE</p>
  <p style="margin: 0; color: #666;">${currentUser.roleLabel}</p>
  <p style="margin: 8px 0 0 0; font-size: 10pt;">
    📞 ${f.telephone || ''}<br/>
    ✉️ <a href="mailto:${f.email}" style="color: #b8860b;">${f.email}</a><br/>
    🌐 <a href="https://groupe-apolline.com" style="color: #b8860b;">groupe-apolline.com</a>
  </p>
  <p style="margin: 8px 0 0 0; font-size: 9pt; color: #999;">Groupe Apolline — Cabinet de courtage en crédit immobilier · ORIAS 22 000 000</p>
</div>`
    setF((prev) => ({ ...prev, signatureHtml: html }))
    toast.success('Signature générée — vous pouvez la personnaliser')
  }

  return (
    <>
      <div className={cn(
        'card p-6 mb-4 bg-gradient-to-br text-white relative overflow-hidden',
        currentUser.avatarGradient,
      )}>
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <div className={cn(
            'h-20 w-20 rounded-full bg-white/10 backdrop-blur border-2 border-white/20 flex items-center justify-center font-serif text-2xl font-semibold',
            currentUser.avatarAccent,
          )}>
            {initials(currentUser.prenom + ' ' + currentUser.nom)}
          </div>
          <div>
            <h2 className="font-serif text-2xl">{currentUser.prenom} {currentUser.nom}</h2>
            <div className="text-sm opacity-90">{currentUser.email}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={cn('badge', ROLE_BADGE[currentUser.role], '!bg-white/10 !text-white !border-white/20')}>
                {currentUser.roleLabel}
              </span>
              <span className="text-[11px] opacity-70">· {currentUser.dossiersAssignes} dossier(s) assigné(s)</span>
            </div>
          </div>
        </div>
      </div>

      <Section title="Identité">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénom" value={f.prenom} onChange={(v: string) => setF({ ...f, prenom: v })} />
          <Field label="Nom" value={f.nom} onChange={(v: string) => setF({ ...f, nom: v })} />
          <Field label="Email pro" value={f.email} onChange={(v: string) => setF({ ...f, email: v })} type="email" />
          <Field label="Téléphone" value={f.telephone} onChange={(v: string) => setF({ ...f, telephone: v })} />
        </div>
        <div className="mt-4">
          <label className="label">Bio</label>
          <textarea className="input min-h-[80px]" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
        </div>
      </Section>

      <Section title="Société">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Raison sociale"
            value={f.societe.raisonSociale}
            onChange={(v: string) => setF({ ...f, societe: { ...f.societe, raisonSociale: v } })}
          />
          <Field
            label="SIREN"
            value={f.societe.siren}
            onChange={(v: string) => setF({ ...f, societe: { ...f.societe, siren: v } })}
          />
          <Field
            label="ORIAS"
            value={f.societe.orias}
            onChange={(v: string) => setF({ ...f, societe: { ...f.societe, orias: v } })}
          />
          <Field
            label="RCS"
            value={f.societe.rcs}
            onChange={(v: string) => setF({ ...f, societe: { ...f.societe, rcs: v } })}
          />
        </div>
        <p className="text-xs text-navy-500 mt-3">
          Ces informations sont utilisées dans les exports PDF (mentions légales bas de page) et les signatures email.
        </p>
      </Section>

      <Section title="Signature email"
        action={
          <label className="flex items-center gap-1.5 text-xs text-navy-700">
            <input
              type="checkbox"
              checked={f.signatureAutoInsert}
              onChange={(e) => setF({ ...f, signatureAutoInsert: e.target.checked })}
              className="accent-gold-500"
            />
            Insérer automatiquement
          </label>
        }
      >
        <p className="text-xs text-navy-500 mb-3">
          Cette signature sera ajoutée au bas de chaque mail envoyé depuis Extr'Apol (nouveau message, réponse, transfert).
          Vous pouvez coller ici la signature HTML de votre Outlook (clic droit dans Outlook → Voir source du message)
          ou laisser Extr'Apol en générer une à partir de votre profil.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <button className="btn-outline text-xs" onClick={generateDefaultSignature}>
            <Mail className="h-3.5 w-3.5" /> Générer depuis mon profil
          </button>
          <button className="btn-ghost text-xs text-rose-700 hover:bg-rose-50" onClick={() => setF({ ...f, signatureHtml: '' })}>
            <Trash2 className="h-3.5 w-3.5" /> Effacer
          </button>
        </div>
        <label className="label">Signature (HTML accepté)</label>
        <textarea
          value={f.signatureHtml}
          onChange={(e) => setF({ ...f, signatureHtml: e.target.value })}
          className="input min-h-[140px] font-mono text-xs"
          placeholder="<div>Cordialement,<br/>Sébastien Aujard</div>"
        />
        {f.signatureHtml && (
          <>
            <div className="text-[11px] text-navy-500 mt-3 mb-1 font-semibold uppercase tracking-wider">Aperçu</div>
            <div
              className="rounded-lg border border-navy-100 p-3 bg-ivory text-sm"
              dangerouslySetInnerHTML={{ __html: f.signatureHtml }}
            />
          </>
        )}
      </Section>

      <div className="flex justify-end gap-2">
        <button className="btn-outline" onClick={() => setF({
          prenom: currentUser.prenom, nom: currentUser.nom, email: currentUser.email,
          telephone: currentUser.telephone, bio: currentUser.bio ?? '',
          signatureHtml: currentUser.signatureHtml ?? '',
          signatureAutoInsert: currentUser.signatureAutoInsert ?? true,
          societe: { ...societe },
        })}>Réinitialiser</button>
        <button className="btn-gold" onClick={save}><Save className="h-4 w-4" /> Enregistrer</button>
      </div>
    </>
  )
}

/* ─────────────────────── COLLABORATEURS ─────────────────────── */
function CollaborateursPane() {
  const { currentUser } = useAuth()
  const collaborateurs = useStore((s) => s.collaborateurs)
  const addCollaborateur = useStore((s) => s.addCollaborateur)
  const updateCollaborateur = useStore((s) => s.updateCollaborateur)
  const deleteCollaborateur = useStore((s) => s.deleteCollaborateur)

  const [modal, setModal] = useState<{ type: 'new' | 'edit' | 'delete' | 'reset'; user?: Collaborateur } | null>(null)

  const exportJson = async () => {
    const data = JSON.stringify(collaborateurs.map((c) => ({ ...c, motDePasse: '***' })), null, 2)
    const path = await saveFile({
      defaultFilename: `apolline-collaborateurs-${new Date().toISOString().slice(0, 10)}.json`,
      content: data,
      filters: FILTERS.json,
      mimeType: 'application/json',
    })
    if (path === null) return
    toast.success('Liste des collaborateurs exportée', { description: path !== 'download' ? path : 'Téléchargé' })
  }

  return (
    <>
      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-navy-900">Équipe — {collaborateurs.length} collaborateurs</h3>
          <div className="flex gap-2">
            <button className="btn-outline" onClick={exportJson}><Download className="h-4 w-4" /> Export JSON</button>
            <button className="btn-gold" onClick={() => setModal({ type: 'new' })}><Plus className="h-4 w-4" /> Ajouter</button>
          </div>
        </div>
        <div className="divider-gold my-3" />

        <div className="space-y-2 list-fast-lg">
          {collaborateurs.map((c) => {
            const isMe = c.id === currentUser?.id
            return (
              <div
                key={c.id}
                className={cn(
                  'flex items-center gap-4 p-3 rounded-lg border transition-colors duration-200 group',
                  isMe ? 'border-gold-300 bg-gold-50/40 ring-1 ring-gold-200' : 'border-navy-100 hover:border-navy-200 hover:bg-navy-50/40',
                )}
              >
                <div className={cn(
                  'h-12 w-12 rounded-full bg-gradient-to-br flex items-center justify-center font-serif text-base font-semibold shadow-soft transition-transform duration-200 group-hover:scale-105',
                  c.avatarGradient, c.avatarAccent,
                )}>
                  {initials(c.prenom + ' ' + c.nom)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-navy-900">{c.prenom} {c.nom}</div>
                    {isMe && <span className="badge-gold text-[10px]">C'est vous</span>}
                    {!c.actif && <span className="badge-danger text-[10px]">Désactivé</span>}
                  </div>
                  <div className="text-xs text-navy-500">{c.email} · {c.telephone}</div>
                </div>
                <div className="text-center min-w-[120px]">
                  <span className={cn('badge', ROLE_BADGE[c.role])}>{c.roleLabel}</span>
                  <div className="text-[10px] text-navy-400 mt-1">{c.dossiersAssignes} dossier{c.dossiersAssignes !== 1 ? 's' : ''}</div>
                </div>
                <div className="text-right min-w-[130px]">
                  <div className="text-[10px] uppercase tracking-wider text-navy-400 font-semibold">Dernier accès</div>
                  <div className="text-xs text-navy-700">{dateFr(c.dernierAcces)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button title="Réinitialiser mot de passe" onClick={() => setModal({ type: 'reset', user: c })}
                    className="h-8 w-8 rounded-md hover:bg-white flex items-center justify-center text-navy-400 hover:text-gold-700 transition">
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                  <button title="Modifier" onClick={() => setModal({ type: 'edit', user: c })}
                    className="h-8 w-8 rounded-md hover:bg-white flex items-center justify-center text-navy-400 hover:text-navy-900 transition">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {!isMe && (
                    <button title="Supprimer" onClick={() => setModal({ type: 'delete', user: c })}
                      className="h-8 w-8 rounded-md hover:bg-rose-50 flex items-center justify-center text-navy-400 hover:text-rose-700 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 text-[11px] text-navy-400">
          Les rôles contrôlent l'accès : <strong>Admin</strong> = tout · <strong>Courtier</strong> = ses dossiers · <strong>Gestionnaire</strong> = tous dossiers en saisie · <strong>Assistante</strong> = agenda + pièces.
        </div>
      </div>

      {(modal?.type === 'new' || modal?.type === 'edit') && (
        <CollaborateurModal
          initial={modal.user}
          onClose={() => setModal(null)}
          onSave={(data) => {
            if (modal.type === 'edit' && modal.user) {
              updateCollaborateur(modal.user.id, data)
              toast.success(`Fiche ${data.prenom} ${data.nom} mise à jour`)
            } else {
              addCollaborateur(data)
              toast.success(`Collaborateur ${data.prenom} ${data.nom} ajouté`)
            }
            setModal(null)
          }}
        />
      )}

      {modal?.type === 'delete' && modal.user && (
        <Modal open onClose={() => setModal(null)} title="Supprimer ce collaborateur"
          description="Cette action est irréversible" size="sm"
          actions={<>
            <button className="btn-outline" onClick={() => setModal(null)}>Annuler</button>
            <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={() => {
              deleteCollaborateur(modal.user!.id)
              toast.success(`${modal.user!.prenom} ${modal.user!.nom} retiré de l'équipe`)
              setModal(null)
            }}><Trash2 className="h-4 w-4" /> Supprimer</button>
          </>}>
          <p className="text-sm text-navy-700">
            <strong>{modal.user.prenom} {modal.user.nom}</strong> ne pourra plus se connecter au logiciel.
          </p>
        </Modal>
      )}

      {modal?.type === 'reset' && modal.user && (
        <PasswordResetModal user={modal.user} onClose={() => setModal(null)}
          onReset={(newPwd) => {
            updateCollaborateur(modal.user!.id, { motDePasse: newPwd })
            toast.success(`Mot de passe de ${modal.user!.prenom} réinitialisé`)
            setModal(null)
          }} />
      )}
    </>
  )
}

function CollaborateurModal({ initial, onClose, onSave }: {
  initial?: Collaborateur
  onClose: () => void
  onSave: (data: Omit<Collaborateur, 'id' | 'creeLe' | 'dernierAcces' | 'dossiersAssignes'>) => void
}) {
  const GRADIENTS = [
    { value: 'from-navy-800 to-navy-900', accent: 'text-gold-400', label: 'Navy' },
    { value: 'from-emerald-700 to-emerald-900', accent: 'text-emerald-100', label: 'Émeraude' },
    { value: 'from-indigo-700 to-indigo-900', accent: 'text-indigo-100', label: 'Indigo' },
    { value: 'from-rose-700 to-rose-900', accent: 'text-rose-100', label: 'Rose' },
    { value: 'from-amber-700 to-amber-900', accent: 'text-amber-100', label: 'Ambre' },
    { value: 'from-slate-700 to-slate-900', accent: 'text-slate-100', label: 'Graphite' },
  ]
  const [f, setF] = useState(() => ({
    prenom: initial?.prenom ?? '', nom: initial?.nom ?? '', email: initial?.email ?? '',
    telephone: initial?.telephone ?? '', role: initial?.role ?? 'courtier' as Role,
    roleLabel: initial?.roleLabel ?? 'Courtier', motDePasse: initial?.motDePasse ?? 'apolline2026',
    avatarGradient: initial?.avatarGradient ?? GRADIENTS[0].value,
    avatarAccent: initial?.avatarAccent ?? GRADIENTS[0].accent,
    actif: initial?.actif ?? true, bio: initial?.bio ?? '',
  }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.prenom.trim() || !f.nom.trim() || !f.email.trim()) {
      toast.error('Prénom, nom et email sont obligatoires'); return
    }
    onSave(f)
  }

  return (
    <Modal open onClose={onClose}
      title={initial ? `Modifier ${initial.prenom} ${initial.nom}` : 'Nouveau collaborateur'}
      description="Ajout à l'équipe Extr'Apol" size="lg"
      actions={<>
        <button className="btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn-gold" onClick={submit}>{initial ? 'Enregistrer' : 'Créer le compte'}</button>
      </>}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <div><label className="label">Prénom *</label><input className="input" value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} /></div>
        <div><label className="label">Nom *</label><input className="input" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></div>
        <div><label className="label">Email *</label><input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label className="label">Téléphone</label><input className="input" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} /></div>
        <div>
          <label className="label">Rôle</label>
          <select className="input" value={f.role} onChange={(e) => {
            const role = e.target.value as Role
            const labels: Record<Role, string> = { admin: 'Administrateur', courtier: 'Courtier', gestionnaire: 'Gestionnaire', assistante: 'Assistante' }
            setF({ ...f, role, roleLabel: labels[role] })
          }}>
            <option value="admin">Administrateur</option>
            <option value="courtier">Courtier</option>
            <option value="gestionnaire">Gestionnaire</option>
            <option value="assistante">Assistante</option>
          </select>
        </div>
        <div><label className="label">Libellé affiché</label><input className="input" value={f.roleLabel} onChange={(e) => setF({ ...f, roleLabel: e.target.value })} /></div>
        <div>
          <label className="label">{initial ? 'Nouveau mot de passe' : 'Mot de passe initial'}</label>
          <input type="text" className="input" value={f.motDePasse} onChange={(e) => setF({ ...f, motDePasse: e.target.value })} />
        </div>
        <div>
          <label className="label">Statut</label>
          <select className="input" value={f.actif ? '1' : '0'} onChange={(e) => setF({ ...f, actif: e.target.value === '1' })}>
            <option value="1">Actif</option><option value="0">Désactivé</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Couleur avatar</label>
          <div className="flex gap-2 flex-wrap">
            {GRADIENTS.map((g) => (
              <button key={g.value} type="button"
                onClick={() => setF({ ...f, avatarGradient: g.value, avatarAccent: g.accent })}
                className={cn(
                  'h-12 w-12 rounded-full bg-gradient-to-br flex items-center justify-center font-serif font-semibold transition',
                  g.value, g.accent,
                  f.avatarGradient === g.value ? 'ring-2 ring-offset-2 ring-gold-500 scale-110' : 'hover:scale-105',
                )} title={g.label}>
                {initials(f.prenom + ' ' + f.nom) || 'A'}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2"><label className="label">Bio</label><textarea className="input min-h-[70px]" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

function PasswordResetModal({ user, onClose, onReset }: { user: Collaborateur; onClose: () => void; onReset: (p: string) => void }) {
  const [pwd, setPwd] = useState('')
  return (
    <Modal open onClose={onClose} title={`Réinitialiser le mot de passe de ${user.prenom}`}
      description="Le nouveau mot de passe remplacera immédiatement l'ancien" size="sm"
      actions={<>
        <button className="btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn-gold" disabled={pwd.length < 6} onClick={() => onReset(pwd)}>
          <KeyRound className="h-4 w-4" /> Réinitialiser
        </button>
      </>}>
      <label className="label">Nouveau mot de passe (6 caractères min)</label>
      <input type="text" className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus />
      <button className="btn-ghost text-xs mt-2" onClick={() => setPwd('apolline' + new Date().getFullYear())}>
        Générer par défaut
      </button>
    </Modal>
  )
}

/* ─────────────────────── BANQUES ─────────────────────── */
function BanquesPane() {
  const banques = useStore((s) => s.banques)
  const addBanque = useStore((s) => s.addBanque)
  const updateBanque = useStore((s) => s.updateBanque)
  const deleteBanque = useStore((s) => s.deleteBanque)

  const [modal, setModal] = useState<{ type: 'new' | 'edit' | 'delete'; banque?: Banque } | null>(null)

  const exportCsv = async () => {
    const path = await exportToXlsx({
      filename: `apolline-banques-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [{
        name: 'Barèmes',
        title: "Extr'Apol — Partenaires bancaires",
        subtitle: `${banques.length} banques · barèmes au ${new Date().toLocaleDateString('fr-FR')}`,
        columns: [
          { key: 'id', header: 'Code', width: 10, align: 'center' },
          { key: 'nom', header: 'Banque', width: 32 },
          { key: 'tauxMoyen', header: 'Taux nominal moyen', width: 20, format: 'percent', align: 'right' },
          { key: 'taegMoyen', header: 'TAEG moyen', width: 16, format: 'percent', align: 'right' },
          { key: 'assuranceGroupePct', header: 'Assurance groupe', width: 18, format: 'percent', align: 'right' },
          { key: 'fraisDossier', header: 'Frais de dossier', width: 16, format: 'currency', align: 'right' },
          { key: 'dureesMax', header: 'Durée max', width: 14, align: 'right' },
        ],
        rows: banques.map((b) => ({
          id: b.id,
          nom: b.nom,
          tauxMoyen: b.tauxMoyen,
          taegMoyen: b.taegMoyen,
          assuranceGroupePct: b.assuranceGroupePct,
          fraisDossier: b.fraisDossier,
          dureesMax: `${b.dureesMax / 12} ans`,
        })),
      }],
    })
    if (path === null) return
    toast.success('Barèmes bancaires exportés en Excel', { description: path !== 'download' ? path : 'Téléchargé' })
  }

  return (
    <>
      <Section title={`Partenaires bancaires — ${banques.length}`}
        action={<div className="flex gap-2">
          <button className="btn-outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</button>
          <button className="btn-gold" onClick={() => setModal({ type: 'new' })}><Plus className="h-4 w-4" /> Nouvelle banque</button>
        </div>}>
        <div className="space-y-3 list-fast">
          {banques.map((b) => {
            const t15 = b.taux15 || b.tauxMoyen
            const t20 = b.taux20 || b.tauxMoyen
            const t25 = b.taux25 || b.tauxMoyen
            const ageMaj = b.dateMaj ? Math.floor((Date.now() - new Date(b.dateMaj).getTime()) / (1000 * 3600 * 24)) : null
            const stale = ageMaj != null && ageMaj > 14
            return (
              <div key={b.id} className="flex items-center gap-4 p-3 rounded-lg border border-navy-100 hover:border-gold-300 transition-colors duration-150 group">
                <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: b.couleur }} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy-900 truncate">{b.nom}</div>
                  <div className="flex items-center gap-2 text-[11px] text-navy-500 font-mono">
                    <span>{b.id}</span>
                    {b.dateMaj && (
                      <span className={cn('inline-flex items-center gap-1', stale ? 'text-amber-700' : 'text-navy-400')}>
                        · MAJ {ageMaj === 0 ? 'aujourd\'hui' : `il y a ${ageMaj} j`}
                        {stale && ' ⚠️'}
                      </span>
                    )}
                  </div>
                  {b.notes && (
                    <div className="text-[11px] text-navy-500 italic truncate mt-0.5" title={b.notes}>{b.notes}</div>
                  )}
                </div>
                <div className="grid grid-cols-7 gap-4 text-xs text-right tabular-nums">
                  <div>
                    <div className="text-navy-400 uppercase tracking-wider text-[10px]">15 ans</div>
                    <div className="font-semibold text-navy-900">{pct(t15, 3)}</div>
                  </div>
                  <div>
                    <div className="text-navy-400 uppercase tracking-wider text-[10px]">20 ans</div>
                    <div className="font-semibold text-navy-900">{pct(t20, 3)}</div>
                  </div>
                  <div>
                    <div className="text-navy-400 uppercase tracking-wider text-[10px]">25 ans</div>
                    <div className="font-semibold text-navy-900">{pct(t25, 3)}</div>
                  </div>
                  <div>
                    <div className="text-navy-400 uppercase tracking-wider text-[10px]">TAEG</div>
                    <div className="font-semibold text-navy-900">{pct(b.taegMoyen, 3)}</div>
                  </div>
                  <div>
                    <div className="text-navy-400 uppercase tracking-wider text-[10px]">Ass. grp</div>
                    <div className="font-semibold text-navy-900">{pct(b.assuranceGroupePct, 3)}</div>
                  </div>
                  <div>
                    <div className="text-navy-400 uppercase tracking-wider text-[10px]">Frais</div>
                    <div className="font-semibold text-navy-900">{eur(b.fraisDossier)}</div>
                  </div>
                  <div>
                    <div className="text-navy-400 uppercase tracking-wider text-[10px]">Max</div>
                    <div className="font-semibold text-navy-900">{b.dureesMax / 12}a</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button title="Modifier" onClick={() => setModal({ type: 'edit', banque: b })}
                    className="h-8 w-8 rounded-md hover:bg-white flex items-center justify-center text-navy-400 hover:text-navy-900 transition">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button title="Supprimer" onClick={() => setModal({ type: 'delete', banque: b })}
                    className="h-8 w-8 rounded-md hover:bg-rose-50 flex items-center justify-center text-navy-400 hover:text-rose-700 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {(modal?.type === 'new' || modal?.type === 'edit') && (
        <BanqueModal initial={modal.banque} onClose={() => setModal(null)}
          onSave={(data) => {
            if (modal.type === 'edit' && modal.banque) {
              updateBanque(modal.banque.id, data)
              toast.success(`${data.nom} mis à jour`)
            } else {
              addBanque(data)
              toast.success(`${data.nom} ajouté aux partenaires`)
            }
            setModal(null)
          }} />
      )}

      {modal?.type === 'delete' && modal.banque && (
        <Modal open onClose={() => setModal(null)} title="Supprimer cette banque" size="sm"
          actions={<>
            <button className="btn-outline" onClick={() => setModal(null)}>Annuler</button>
            <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={() => {
              deleteBanque(modal.banque!.id)
              toast.success(`${modal.banque!.nom} retirée`)
              setModal(null)
            }}><Trash2 className="h-4 w-4" /> Supprimer</button>
          </>}>
          <p className="text-sm text-navy-700">
            <strong>{modal.banque.nom}</strong> ne figurera plus dans la simulation multi-banques.
            Les dossiers déjà affectés à cette banque restent inchangés.
          </p>
        </Modal>
      )}
    </>
  )
}

function BanqueModal({ initial, onClose, onSave }: {
  initial?: Banque; onClose: () => void;
  onSave: (data: Omit<Banque, 'id'> & { id?: string }) => void
}) {
  const [f, setF] = useState(() => ({
    id: initial?.id ?? '',
    nom: initial?.nom ?? '',
    couleur: initial?.couleur ?? '#0A1F3D',
    tauxMoyen: initial?.tauxMoyen ?? 0.032,
    taux15: initial?.taux15 ?? initial?.tauxMoyen ?? 0.030,
    taux20: initial?.taux20 ?? initial?.tauxMoyen ?? 0.032,
    taux25: initial?.taux25 ?? initial?.tauxMoyen ?? 0.034,
    taegMoyen: initial?.taegMoyen ?? 0.037,
    assuranceGroupePct: initial?.assuranceGroupePct ?? 0.0034,
    fraisDossier: initial?.fraisDossier ?? 800,
    dureesMax: initial?.dureesMax ?? 300,
    dateMaj: initial?.dateMaj ?? new Date().toISOString().slice(0, 10),
    notes: initial?.notes ?? '',
  }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.nom.trim()) { toast.error('Le nom de la banque est obligatoire'); return }
    // tauxMoyen recalculé automatiquement comme la moyenne des 3 durées
    // (sert encore de fallback dans le code non encore migré).
    const tauxMoyenRecalc = (f.taux15 + f.taux20 + f.taux25) / 3
    onSave({
      ...f,
      tauxMoyen: tauxMoyenRecalc,
      id: f.id.trim() || undefined,
      // Touche dateMaj automatiquement à aujourd'hui si l'utilisateur a modifié un taux
      dateMaj: f.dateMaj || new Date().toISOString().slice(0, 10),
    })
  }
  return (
    <Modal open onClose={onClose}
      title={initial ? `Modifier ${initial.nom}` : 'Nouvelle banque partenaire'}
      description="Barèmes indicatifs utilisés dans la simulation multi-banques" size="lg"
      actions={<>
        <button className="btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn-gold" onClick={submit}>{initial ? 'Enregistrer' : 'Ajouter'}</button>
      </>}>
      <form onSubmit={submit} className="space-y-5">
        {/* En-tête identité */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="label">Nom complet *</label>
            <input className="input" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="Crédit Mutuel Grand Est" />
          </div>
          <div>
            <label className="label">Identifiant court</label>
            <input className="input font-mono" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="CMGE" disabled={!!initial} />
          </div>
        </div>

        {/* Grille de taux par durée — la valeur métier centrale */}
        <div className="rounded-lg bg-ivory border border-navy-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs font-semibold text-navy-900 uppercase tracking-wider">Grille de taux nominaux</div>
              <div className="text-[11px] text-navy-500">Saisis les taux du flash bancaire — la simulation utilise la durée du dossier (interpolation linéaire entre 15-25 ans)</div>
            </div>
            <div>
              <label className="label text-[10px]">Date du barème</label>
              <input type="date" className="input" value={f.dateMaj} onChange={(e) => setF({ ...f, dateMaj: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">15 ans (%)</label>
              <input type="number" step="0.001" className="input font-mono" value={(f.taux15 * 100).toFixed(3)}
                onChange={(e) => setF({ ...f, taux15: Number(e.target.value) / 100 })} />
            </div>
            <div>
              <label className="label">20 ans (%)</label>
              <input type="number" step="0.001" className="input font-mono" value={(f.taux20 * 100).toFixed(3)}
                onChange={(e) => setF({ ...f, taux20: Number(e.target.value) / 100 })} />
            </div>
            <div>
              <label className="label">25 ans (%)</label>
              <input type="number" step="0.001" className="input font-mono" value={(f.taux25 * 100).toFixed(3)}
                onChange={(e) => setF({ ...f, taux25: Number(e.target.value) / 100 })} />
            </div>
          </div>
          <div className="text-[11px] text-navy-400 mt-2">
            Taux moyen calculé : <strong className="text-navy-700">{((f.taux15 + f.taux20 + f.taux25) / 3 * 100).toFixed(3)} %</strong>
          </div>
        </div>

        {/* Coûts annexes */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="label">TAEG moyen (%)</label>
            <input type="number" step="0.001" className="input" value={(f.taegMoyen * 100).toFixed(3)}
              onChange={(e) => setF({ ...f, taegMoyen: Number(e.target.value) / 100 })} />
          </div>
          <div>
            <label className="label">Ass. groupe (%)</label>
            <input type="number" step="0.001" className="input" value={(f.assuranceGroupePct * 100).toFixed(3)}
              onChange={(e) => setF({ ...f, assuranceGroupePct: Number(e.target.value) / 100 })} />
          </div>
          <div>
            <label className="label">Frais dossier (€)</label>
            <input type="number" className="input" value={f.fraisDossier}
              onChange={(e) => setF({ ...f, fraisDossier: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Durée max</label>
            <select className="input" value={f.dureesMax} onChange={(e) => setF({ ...f, dureesMax: Number(e.target.value) })}>
              <option value={180}>15 ans</option>
              <option value={240}>20 ans</option>
              <option value={300}>25 ans</option>
            </select>
          </div>
        </div>

        {/* Branding + notes */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Couleur (branding)</label>
            <div className="flex gap-2 items-center">
              <input type="color" className="h-10 w-14 rounded border border-navy-200 cursor-pointer"
                value={f.couleur} onChange={(e) => setF({ ...f, couleur: e.target.value })} />
              <input className="input font-mono" value={f.couleur}
                onChange={(e) => setF({ ...f, couleur: e.target.value })} />
            </div>
          </div>
          <div className="col-span-2">
            <label className="label">Notes (optionnel)</label>
            <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })}
              placeholder="Ex: Retire temporairement le 25 ans · Décote primo-accédants 0.10 pts" />
          </div>
        </div>

        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

/* ─────────────────────── TEMPLATES ─────────────────────── */
function TemplatesPane() {
  const templates = useStore((s) => s.templates)
  const addTemplate = useStore((s) => s.addTemplate)
  const updateTemplate = useStore((s) => s.updateTemplate)
  const deleteTemplate = useStore((s) => s.deleteTemplate)

  const [modal, setModal] = useState<{ type: 'new' | 'edit' | 'delete'; tpl?: Template } | null>(null)

  return (
    <>
      <Section title={`Modèles de documents — ${templates.length}`}
        action={<button className="btn-gold" onClick={() => setModal({ type: 'new' })}>
          <Plus className="h-4 w-4" /> Nouveau modèle
        </button>}>
        <div className="rounded-lg border border-navy-100 divide-y divide-navy-50 overflow-hidden list-fast">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-navy-50/60 transition-colors duration-150 group">
              <span className="badge-navy font-mono">{t.type}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-navy-900">{t.nom}</div>
                {t.description && <div className="text-[11px] text-navy-500">{t.description}</div>}
                <div className="text-[10px] text-navy-400 mt-0.5">Modifié {dateFr(t.updatedAt)}</div>
              </div>
              <label className="flex items-center gap-2 text-xs text-navy-600 cursor-pointer">
                <input type="checkbox" checked={t.actif} onChange={(e) => {
                  updateTemplate(t.id, { actif: e.target.checked })
                  toast.success(e.target.checked ? `"${t.nom}" activé` : `"${t.nom}" désactivé`)
                }} className="accent-gold-500" />
                Actif
              </label>
              <button onClick={() => setModal({ type: 'edit', tpl: t })} className="btn-ghost text-xs">
                <Pencil className="h-3.5 w-3.5" /> Éditer
              </button>
              <button onClick={() => setModal({ type: 'delete', tpl: t })}
                className="h-8 w-8 rounded-md hover:bg-rose-50 flex items-center justify-center text-navy-400 hover:text-rose-700 transition opacity-0 group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[11px] text-navy-400">
          Les variables utilisables : <code className="font-mono text-gold-700">{'{{client.prenom}}'}</code>, <code className="font-mono text-gold-700">{'{{client.nom}}'}</code>, <code className="font-mono text-gold-700">{'{{dossier.ref}}'}</code>, <code className="font-mono text-gold-700">{'{{dossier.montantPret}}'}</code>, <code className="font-mono text-gold-700">{'{{courtier.nom}}'}</code>, <code className="font-mono text-gold-700">{'{{today}}'}</code>.
        </div>
      </Section>

      {(modal?.type === 'new' || modal?.type === 'edit') && (
        <TemplateModal initial={modal.tpl} onClose={() => setModal(null)}
          onSave={(data) => {
            if (modal.type === 'edit' && modal.tpl) {
              updateTemplate(modal.tpl.id, data); toast.success(`Modèle "${data.nom}" mis à jour`)
            } else {
              addTemplate(data); toast.success(`Modèle "${data.nom}" créé`)
            }
            setModal(null)
          }} />
      )}

      {modal?.type === 'delete' && modal.tpl && (
        <Modal open onClose={() => setModal(null)} title="Supprimer ce modèle" size="sm"
          actions={<>
            <button className="btn-outline" onClick={() => setModal(null)}>Annuler</button>
            <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={() => {
              deleteTemplate(modal.tpl!.id); toast.success('Modèle supprimé'); setModal(null)
            }}><Trash2 className="h-4 w-4" /> Supprimer</button>
          </>}>
          <p className="text-sm text-navy-700">
            Le modèle <strong>{modal.tpl.nom}</strong> sera supprimé. Les documents déjà générés ne seront pas affectés.
          </p>
        </Modal>
      )}
    </>
  )
}

function TemplateModal({ initial, onClose, onSave }: {
  initial?: Template; onClose: () => void;
  onSave: (data: Omit<Template, 'id' | 'updatedAt'>) => void
}) {
  const [f, setF] = useState(() => ({
    nom: initial?.nom ?? '',
    type: (initial?.type ?? 'PDF') as Template['type'],
    contenu: initial?.contenu ?? '',
    description: initial?.description ?? '',
    actif: initial?.actif ?? true,
  }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!f.nom.trim()) { toast.error('Nom du modèle requis'); return }
    onSave(f)
  }
  return (
    <Modal open onClose={onClose}
      title={initial ? `Éditer "${initial.nom}"` : 'Nouveau modèle'}
      description="Variables entre double-accolades : {{client.nom}}, {{dossier.ref}}…" size="xl"
      actions={<>
        <button className="btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn-gold" onClick={submit}><Save className="h-4 w-4" /> Enregistrer</button>
      </>}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="label">Nom *</label>
            <input className="input" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Template['type'] })}>
              <option>PDF</option><option>HTML</option><option>PNG</option><option>Email</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="À quoi sert ce modèle ?" />
        </div>
        <div>
          <label className="label">Contenu du modèle</label>
          <textarea className="input font-mono text-xs min-h-[280px]" value={f.contenu} onChange={(e) => setF({ ...f, contenu: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.actif} onChange={(e) => setF({ ...f, actif: e.target.checked })} className="accent-gold-500" />
          Modèle actif (proposé à la génération)
        </label>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

/* ─────────────────────── INTÉGRATIONS (O365) ─────────────────────── */
function IntegrationsPane() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const replaceO365Rdvs = useStore((s) => s.replaceO365Rdvs)
  const clearO365Rdvs = useStore((s) => s.clearO365Rdvs)
  const { currentUser } = useAuth()
  const o365Email = getO365EmailFor(settings, currentUser?.id)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const isConnected = !!o365Email

  const connect = async () => {
    setConnecting(true)
    try {
      toast.info('Redirection vers Microsoft…', { duration: 2500 })
      await o365.signIn(O365_CLIENT_ID, O365_TENANT_ID)
    } catch (e: any) {
      setConnecting(false)
      console.error('O365 signIn error', e)
      toast.error('Impossible de lancer la connexion', { description: e?.message })
    }
  }

  const disconnect = async () => {
    try {
      await o365.signOut(O365_CLIENT_ID, O365_TENANT_ID)
    } finally {
      // Retire l'entrée pour l'utilisateur courant uniquement (les autres collabs
      // gardent leur connexion). Vide aussi le legacy o365UserEmail global au cas où.
      const byUser = { ...(settings.o365ByUser ?? {}) }
      if (currentUser) delete byUser[currentUser.id]
      updateSettings({
        o365ByUser: byUser,
        o365UserEmail: undefined,
        o365ConnectedAt: undefined,
      })
      // Déconnexion volontaire → on vide explicitement les RDV O365.
      clearO365Rdvs()
      toast.success('Déconnecté de Microsoft 365')
    }
  }

  const syncCalendar = async () => {
    if (!isConnected) { toast.error('Connectez-vous d\'abord'); return }
    setSyncing(true)
    const t = toast.loading('Synchronisation calendrier O365…')
    try {
      const now = new Date()
      const start = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString()
      const end = new Date(now.getFullYear() + 1, now.getMonth() + 1, 0).toISOString()
      const events = await o365.fetchCalendarEvents(O365_CLIENT_ID, O365_TENANT_ID, start, end)
      const rdvs = events.map(o365.graphToRdv)
      replaceO365Rdvs(rdvs)
      toast.success(`${rdvs.length} événement${rdvs.length > 1 ? 's' : ''} synchronisé${rdvs.length > 1 ? 's' : ''}`, {
        id: t,
        description: 'Les RDV O365 apparaissent dans l\'agenda avec un préfixe O365-.',
      })
    } catch (e: any) {
      toast.error('Échec synchronisation', { id: t, description: e?.message ?? 'Erreur Graph API' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <Section title="Microsoft 365 — Calendrier, mails & identité"
        action={isConnected
          ? <span className="badge-success"><Check className="h-3 w-3" /> Connecté</span>
          : <span className="badge-warning">Non connecté</span>
        }>
        <p className="text-sm text-navy-600 mb-3">
          Connectez votre compte Microsoft 365 / Outlook pour synchroniser votre calendrier avec l'agenda
          d'Extr'Apol et accéder à votre boîte mail Outlook directement depuis l'application
          (lecture, envoi, réponse, auto-lien des emails aux dossiers clients).
        </p>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4 text-xs text-amber-900">
          <strong>Permissions requises côté Azure :</strong>
          <span className="font-mono"> User.Read · Calendars.Read · Calendars.ReadWrite · Mail.Read · Mail.ReadWrite · Mail.Send</span>.
          Si vous voyez une erreur après login, demandez à un administrateur Azure de votre tenant Microsoft 365 d'accorder
          le <em>consentement administrateur</em> pour ces scopes (portail Azure → App registrations → API permissions → <em>Grant admin consent</em>).
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Application (Client) ID</label>
            <div className="input bg-ivory cursor-default font-mono text-xs">{O365_CLIENT_ID}</div>
          </div>
          <div>
            <label className="label">Directory (Tenant) ID</label>
            <div className="input bg-ivory cursor-default font-mono text-xs">{O365_TENANT_ID}</div>
          </div>
        </div>
        <div className="text-[11px] text-navy-400 mb-4">
          IDs Azure pré-configurés pour le tenant <strong>Groupe Apolline</strong> — partagés par tous les collaborateurs.
        </div>

        <div className="flex justify-end gap-2">
          {!isConnected ? (
            <button className="btn-gold" disabled={connecting} onClick={connect}>
              <LinkIcon className="h-4 w-4" /> {connecting ? 'Connexion…' : 'Connecter Microsoft 365'}
            </button>
          ) : (
            <>
              <button
                className="btn-outline"
                onClick={async () => {
                  const t = toast.loading('Test de la connexion Microsoft 365…')
                  try {
                    const ok = await o365.refreshTokenIfNeeded(O365_CLIENT_ID, O365_TENANT_ID, o365Email ?? undefined)
                    if (ok) {
                      toast.success('Connexion Microsoft 365 OK', { id: t, description: 'Token rafraîchi automatiquement.' })
                    } else {
                      toast.error('Connexion expirée', {
                        id: t,
                        description: 'La session Microsoft a expiré. Cliquez sur "Reconnecter" pour rétablir.',
                        duration: 10_000,
                      })
                    }
                  } catch (e) {
                    toast.error('Erreur test connexion', { id: t, description: e instanceof Error ? e.message : String(e) })
                  }
                }}
              >
                Tester la connexion
              </button>
              <button className="btn-primary" disabled={syncing} onClick={syncCalendar}>
                <Calendar className="h-4 w-4" /> {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
              </button>
              <button className="btn-outline text-rose-700 hover:bg-rose-50" onClick={disconnect}>
                Se déconnecter
              </button>
            </>
          )}
        </div>

        {isConnected && (
          <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <Check className="h-5 w-5 text-emerald-700" />
              <div>
                <div className="font-semibold text-emerald-900">Connecté à Microsoft 365</div>
                <div className="text-xs text-emerald-800">
                  {o365Email} · depuis le {(currentUser && settings.o365ByUser?.[currentUser.id]?.connectedAt) ? dateFr(settings.o365ByUser[currentUser.id].connectedAt) : settings.o365ConnectedAt ? dateFr(settings.o365ConnectedAt) : '—'}
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-emerald-900 mt-2">
              <input type="checkbox" checked={settings.o365AutoSync}
                onChange={(e) => updateSettings({ o365AutoSync: e.target.checked })}
                className="accent-emerald-600" />
              Synchroniser automatiquement toutes les 15 minutes
            </label>
          </div>
        )}
      </Section>

      <BackendStatusSection />
    </>
  )
}

/* ─────────────────────── DONNÉES ─────────────────────── */
function DonneesPane() {
  const resetStore = useStore((s) => s.resetStore)
  const state = useStore((s) => s)
  const { authMode } = useAuth()
  const [resyncing, setResyncing] = useState(false)
  const [lastSyncCounts, setLastSyncCounts] = useState<{ ts: string; total: number } | null>(null)

  const isOnlineMode = authMode === 'online'
  const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://api.apolline.groupe-apolline.com'

  const download = async () => {
    const data = {
      version: 2, exportedAt: new Date().toISOString(),
      clients: state.clients, dossiers: state.dossiers, prets: state.prets, rdvs: state.rdvs,
      notes: state.notes, simulations: state.simulations,
      collaborateurs: state.collaborateurs, commissions: state.commissions,
      banques: state.banques, templates: state.templates,
      notifications: state.notifications, settings: state.settings,
    }
    const path = await saveFile({
      defaultFilename: `apolline-backup-${new Date().toISOString().slice(0, 10)}.json`,
      content: JSON.stringify(data, null, 2),
      filters: FILTERS.json,
      mimeType: 'application/json',
    })
    if (path === null) return
    toast.success('Sauvegarde enregistrée', { description: path !== 'download' ? path : 'Téléchargé' })
  }

  const forceResync = async () => {
    if (!isOnlineMode) {
      toast.error('Mode hors-ligne — reconnectez-vous pour synchroniser')
      return
    }
    setResyncing(true)
    const t = toast.loading('Synchronisation en cours…')
    try {
      const { counts, errors } = await sync.pullAll()
      const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0)
      if (errors.length > 0) {
        toast.error('Synchronisation partielle', {
          id: t,
          description: `${errors.length} table(s) en échec — ${total} entités récupérées`,
        })
      } else {
        toast.success('Synchronisé', { id: t, description: `${total} entités récupérées du serveur` })
      }
      setLastSyncCounts({ ts: new Date().toISOString(), total })
    } catch (e: any) {
      toast.error('Échec sync', { id: t, description: e?.message })
    } finally {
      setResyncing(false)
    }
  }

  return (
    <>
      <Section title="Base de données">
        <div className="space-y-3 text-sm text-navy-700">
          <Row
            label="Source"
            value={
              isOnlineMode
                ? <span className="badge-success font-mono text-[11px]"><Check className="h-3 w-3" /> Postgres (synchronisé temps réel)</span>
                : <span className="badge-warning font-mono text-[11px]">Cache local — hors-ligne</span>
            }
          />
          <Row label="API backend" value={<span className="font-mono text-[11px] text-navy-500 truncate">{apiBase}</span>} />
          <Row label="Clients · Dossiers · Prêts" value={<span className="font-mono text-xs">{state.clients.length} · {state.dossiers.length} · {state.prets.length}</span>} />
          <Row label="RDV · Notes · Apporteurs" value={<span className="font-mono text-xs">{state.rdvs.length} · {state.notes.length} · {state.apporteurs.length}</span>} />
          <Row label="Simulations · Templates · Banques" value={<span className="font-mono text-xs">{state.simulations.length} · {state.templates.length} · {state.banques.length}</span>} />
          <Row label="Notifications" value={<span className="font-mono text-xs">{state.notifications.length} ({state.notifications.filter((n) => !n.read).length} non lues)</span>} />
          {lastSyncCounts && (
            <Row label="Dernière sync forcée" value={<span className="font-mono text-[11px] text-navy-500">{lastSyncCounts.total} entités · {dateFr(lastSyncCounts.ts)}</span>} />
          )}
        </div>
        <p className="text-[11px] text-navy-400 mt-3">
          {isOnlineMode
            ? 'La synchronisation est automatique : au démarrage, à chaque changement (SSE temps réel), au retour de focus, et toutes les 2 min en filet de sécurité.'
            : 'Vous travaillez sur le cache local. Reconnectez-vous au backend pour partager vos données avec l\'équipe.'}
        </p>
      </Section>
      <Section title="Actions">
        <div className="flex gap-2 mb-3 flex-wrap">
          <button className="btn-gold" onClick={forceResync} disabled={resyncing || !isOnlineMode}>
            <RefreshCw className={cn('h-4 w-4', resyncing && 'animate-spin')} />
            {resyncing ? 'Sync…' : 'Forcer la synchronisation'}
          </button>
          <button className="btn-outline" onClick={download}><Download className="h-4 w-4" /> Exporter en JSON</button>
          <button className="btn text-rose-700 hover:bg-rose-50" onClick={async () => {
            const ok = await confirmDialog(
              'Réinitialiser le cache local aux données de démo ?\n\n(n\'affecte pas la BDD partagée — vous récupérerez l\'état Postgres au prochain démarrage)',
              { title: 'Réinitialiser cache local', kind: 'warning' },
            )
            if (ok) {
              resetStore(); toast.success('Cache local réinitialisé')
            }
          }}>
            <Trash2 className="h-4 w-4" /> Réinitialiser cache local
          </button>
        </div>
        <p className="text-[11px] text-navy-400">
          La sauvegarde JSON sert d'archive locale. La source de vérité reste la base Postgres partagée par tous les collaborateurs.
        </p>
      </Section>
    </>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-ivory">
      <span>{label}</span>{value}
    </div>
  )
}

/* ─────────────────────── Backend Apolline (cloud) ─────────────────────── */
function BackendStatusSection() {
  const { authMode } = useAuth()
  const [status, setStatus] = useState<'unknown' | 'ok' | 'error' | 'checking'>('unknown')
  const [lastCheck, setLastCheck] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)
    ?? 'https://api.apolline.groupe-apolline.com'

  const test = async () => {
    setStatus('checking')
    setErrorMsg(null)
    try {
      const res = await fetch(`${apiBase}/healthz`, { method: 'GET' })
      if (res.ok) {
        setStatus('ok')
        setLastCheck(new Date().toISOString())
      } else {
        setStatus('error')
        setErrorMsg(`HTTP ${res.status}`)
      }
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e?.message ?? 'Backend injoignable')
    }
  }

  return (
    <Section
      title="Backend Extr'Apol (cloud)"
      action={
        authMode === 'online'
          ? <span className="badge-success"><Check className="h-3 w-3" /> Synchronisé</span>
          : authMode === 'offline'
            ? <span className="badge-warning">Mode local</span>
            : <span className="badge-warning">Non connecté</span>
      }
    >
      <p className="text-sm text-navy-600 mb-3">
        Données partagées en temps réel entre tous les collaborateurs via le serveur Extr'Apol (PostgreSQL).
        En mode <em>local</em>, les modifications restent sur ce poste — utile en déplacement sans connexion.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="label">URL du backend</label>
          <div className="input bg-ivory cursor-default font-mono text-xs">{apiBase}</div>
        </div>
        <div>
          <label className="label">Mode actuel</label>
          <div className="input bg-ivory cursor-default text-xs">
            {authMode === 'online' && '✓ Synchronisé avec le serveur'}
            {authMode === 'offline' && 'Mode local (pas de sync serveur)'}
            {!authMode && 'Non authentifié'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button className="btn-outline text-xs" onClick={test} disabled={status === 'checking'}>
          {status === 'checking' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {status === 'checking' ? 'Test en cours…' : 'Tester la connexion'}
        </button>
        {status === 'ok' && (
          <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
            <Check className="h-3 w-3" /> Backend joignable
            {lastCheck && <span className="text-emerald-600/70 ml-1">(à {new Date(lastCheck).toLocaleTimeString('fr-FR')})</span>}
          </span>
        )}
        {status === 'error' && (
          <span className="text-xs text-rose-700">⚠ {errorMsg}</span>
        )}
      </div>

      <div className="text-[11px] text-navy-400">
        Pour pointer vers un autre serveur, modifie <code className="font-mono bg-ivory px-1 rounded">VITE_API_BASE</code> dans <code className="font-mono bg-ivory px-1 rounded">.env.local</code>
        à la racine du projet, puis rebuild l'app.
      </div>
    </Section>
  )
}

/* ─────────────────────── SÉCURITÉ ─────────────────────── */
function SecuritePane() {
  const { currentUser } = useAuth()
  const updateCollaborateur = useStore((s) => s.updateCollaborateur)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const [current, setCurrent] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!currentUser) return
    if (nouveau.length < 8) { toast.error('Le nouveau mot de passe doit faire 8 caractères minimum'); return }
    if (nouveau !== confirmation) { toast.error('La confirmation ne correspond pas'); return }
    setSubmitting(true)
    try {
      await auth.changePassword(current, nouveau)
      setCurrent(''); setNouveau(''); setConfirmation('')
      toast.success('Mot de passe modifié')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Échec', { description: msg.slice(0, 200) })
    } finally {
      setSubmitting(false)
    }
  }
  // updateCollaborateur n'est plus utilisé pour le mdp (passe désormais par le
  // backend qui hash) — on garde la ref pour ne rien casser des autres appels.
  void updateCollaborateur

  return (
    <>
      <Section title="Changer mon mot de passe">
        <div className="grid grid-cols-3 gap-4">
          <div><label className="label">Mot de passe actuel</label><input type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          <div><label className="label">Nouveau mot de passe</label><input type="password" className="input" value={nouveau} onChange={(e) => setNouveau(e.target.value)} /></div>
          <div><label className="label">Confirmation</label><input type="password" className="input" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-gold" onClick={submit} disabled={submitting}>
            <KeyRound className="h-4 w-4" /> {submitting ? 'Mise à jour…' : 'Modifier le mot de passe'}
          </button>
        </div>
        <div className="mt-2 text-[11px] text-navy-400">
          Le mot de passe est haché côté serveur (argon2). Aucun mot de passe n'est jamais stocké en clair, ni sur ton poste, ni en BDD.
        </div>
      </Section>
      <Section title="Verrouillage automatique">
        <label className="flex items-center gap-3 text-sm">
          Inactif pendant
          <select className="input w-32"
            value={settings.verrouillageAutoMin}
            onChange={(e) => {
              updateSettings({ verrouillageAutoMin: Number(e.target.value) })
              toast.success('Durée de verrouillage mise à jour')
            }}>
            <option value={5}>5 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 h</option>
            <option value={0}>Jamais</option>
          </select>
        </label>
      </Section>
    </>
  )
}

/* ─────────────────────── APPARENCE ─────────────────────── */
function AppearancePane() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)

  const themes: { key: Theme; label: string; sub: string; colors: [string, string, string] }[] = [
    { key: 'apolline', label: "Extr'Apol — Navy & Or", sub: 'Identité Groupe Apolline', colors: ['#0A1F3D', '#C9A961', '#F8F7F3'] },
    { key: 'graphite', label: 'Graphite sobre', sub: 'Palette neutre, sans accent doré', colors: ['#0A1F3D', '#64748B', '#F1F5F9'] },
    { key: 'sombre', label: 'Mode sombre', sub: 'Interface nuit, or conservé', colors: ['#1A1F33', '#C9A961', '#0A0E1A'] },
  ]

  return (
    <>
      <Section title="Thème">
        <div className="grid grid-cols-3 gap-4">
          {themes.map((t) => {
            const active = settings.theme === t.key
            return (
              <button
                key={t.key}
                onClick={() => {
                  updateSettings({ theme: t.key })
                  toast.success(`Thème "${t.label}" activé`)
                }}
                className={cn(
                  'text-left rounded-xl2 p-4 transition-all duration-200 relative',
                  active ? 'border-2 border-gold-500 shadow-gold' : 'border border-navy-200 hover:border-navy-300 hover:shadow-soft',
                )}
              >
                <div className="flex gap-2 mb-3">
                  {t.colors.map((c, i) => (
                    <span key={i} className="h-6 w-6 rounded-md border border-navy-100" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="font-serif text-sm font-semibold text-navy-900">{t.label}</div>
                <div className="text-xs text-navy-500 mt-1">{t.sub}</div>
                {active && <span className="absolute top-2 right-2 badge-gold">Actif</span>}
              </button>
            )
          })}
        </div>
      </Section>
      <Section title="Densité">
        <div className="grid grid-cols-2 gap-4">
          {(['confort', 'compact'] as const).map((d) => (
            <button
              key={d}
              onClick={() => {
                updateSettings({ densite: d })
                toast.success(`Densité "${d}" activée`)
              }}
              className={cn(
                'p-4 rounded-lg text-left transition',
                settings.densite === d ? 'border-2 border-gold-500 bg-gold-50/30' : 'border border-navy-200 hover:bg-navy-50',
              )}
            >
              <div className="font-semibold text-navy-900 capitalize">{d}</div>
              <div className="text-xs text-navy-500 mt-1">
                {d === 'confort' ? 'Espacements généreux, plus lisible' : 'Plus d\'informations à l\'écran'}
              </div>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Notifications">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={settings.notifSon}
            onChange={(e) => {
              updateSettings({ notifSon: e.target.checked })
              toast.success(e.target.checked ? 'Sons activés' : 'Sons désactivés')
            }}
            className="accent-gold-500" />
          Son d'alerte pour les nouvelles notifications importantes
        </label>
      </Section>
    </>
  )
}
