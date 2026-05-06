/**
 * Modal "Saisie rapide" — création d'un prospect minimaliste en 3 champs.
 * Utilisé pour le téléphone à chaud : le courtier reçoit un appel, il saisit
 * juste nom + tel + projet en 10 secondes, et enrichit la fiche plus tard.
 *
 * Déclenché par le bouton flottant `+` dans la sidebar.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { UserPlus, X } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { usePermissions } from '@/auth/AuthContext'

type Props = {
  open: boolean
  onClose: () => void
}

const TYPES_PROJET = ['Achat RP', 'Achat RS', 'Locatif', 'Construction', 'Rachat', 'Pro'] as const
type TypeProjet = typeof TYPES_PROJET[number]

export default function QuickProspectModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const addClient = useStore((s) => s.addClient)
  const addDossier = useStore((s) => s.addDossier)
  const { can } = usePermissions()

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [tel, setTel] = useState('')
  const [email, setEmail] = useState('')
  const [typeProjet, setTypeProjet] = useState<TypeProjet>('Achat RP')
  const [montantPret, setMontantPret] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)

  const firstInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) {
      setNom(''); setPrenom(''); setTel(''); setEmail('')
      setTypeProjet('Achat RP'); setMontantPret(0); setSubmitting(false)
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const submit = async () => {
    if (!nom.trim() || !prenom.trim()) {
      toast.error('Nom et prénom requis')
      return
    }
    if (!can('client:create') || !can('dossier:create')) {
      toast.error('Tu n\'as pas la permission de créer un dossier')
      return
    }
    setSubmitting(true)
    try {
      const client = addClient({
        prenom: prenom.trim(),
        nom: nom.trim(),
        email: email.trim(),
        tel: tel.trim(),
        naissance: '',
        ville: '',
        profession: '',
        revenuMensuelNet: 0,
        apporteur: '',
      })
      const dossier = addDossier({
        clientId: client.id,
        clientNom: `${client.nom} ${client.prenom}`,
        statut: 'R0',
        typeProjet,
        villeBien: '',
        montantBien: 0,
        montantPret,
        apport: 0,
        dureeMois: 300,
      })
      toast.success(`Prospect ${client.prenom} ${client.nom} créé`, {
        description: `Dossier ${dossier.ref} — ouvre-le pour enrichir la fiche`,
        action: { label: 'Ouvrir', onClick: () => navigate(`/dossiers/${dossier.id}`) },
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void submit()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl bg-white rounded-xl2 shadow-raised animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-navy-100">
          <div className="h-10 w-10 rounded-lg bg-gold-50 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-gold-700" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-lg text-navy-900">Saisie rapide</h2>
            <div className="text-xs text-navy-500">3 champs minimum — tu enrichiras depuis la fiche</div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-navy-50 flex items-center justify-center text-navy-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-4">
          <div>
            <label className="label">Nom *</label>
            <input ref={firstInputRef} className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="DUMAS" />
          </div>
          <div>
            <label className="label">Prénom *</label>
            <input className="input" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Marie" />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="06 12 34 56 78" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="marie.dumas@..." />
          </div>
          <div>
            <label className="label">Type de projet</label>
            <select className="input" value={typeProjet} onChange={(e) => setTypeProjet(e.target.value as TypeProjet)}>
              {TYPES_PROJET.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Montant prêt envisagé (€)</label>
            <input type="number" className="input" value={montantPret || ''} onChange={(e) => setMontantPret(Number(e.target.value) || 0)} placeholder="250000" />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-navy-100 flex items-center justify-between bg-ivory">
          <div className="text-[10px] text-navy-400 inline-flex items-center gap-2">
            <kbd className="bg-white border border-navy-200 rounded px-1 py-0.5 font-mono">Ctrl+↵</kbd> pour valider
          </div>
          <div className="flex gap-2">
            <button className="btn-outline" onClick={onClose}>Annuler</button>
            <button className="btn-gold" onClick={submit} disabled={submitting || !nom.trim() || !prenom.trim()}>
              {submitting ? 'Création…' : 'Créer le prospect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
