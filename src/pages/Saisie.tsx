import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, UserPlus, Search, User2, Phone, Mail, MapPin } from 'lucide-react'
import DossierEditor from '@/components/DossierEditor'
import { useStore } from '@/stores/useStore'
import type { Client, Dossier } from '@/data/mock'
import { cn, dateFr } from '@/lib/utils'

/**
 * Page "Nouveau dossier" — 2 modes d'entrée :
 *  1) `new` : crée un nouveau prospect ET un dossier (workflow historique)
 *  2) `existing` : rattache un nouveau dossier à un client/prospect déjà connu
 *     (pratique pour un 2ème projet d'un même emprunteur, ou si la fiche
 *     prospect a été créée en amont via l'import apporteur)
 */
const stubClient = (): Client => ({
  id: 'NEW',
  prenom: '',
  nom: '',
  email: '',
  tel: '',
  naissance: '',
  ville: '',
  profession: '',
  conjoint: undefined,
  revenuMensuelNet: 0,
  dossierIds: [],
  createdAt: '',
  lastActivity: '',
  apporteur: '',
  statutCommercial: 'prospect',
})

const stubDossier = (): Dossier => ({
  id: 'NEW',
  ref: '',
  clientId: 'NEW',
  clientNom: '',
  statut: 'R0',
  typeProjet: 'Achat RP',
  villeBien: '',
  montantBien: 0,
  montantPret: 0,
  apport: 0,
  dureeMois: 300,
  hcsfOk: true,
  ltv: 0,
  createdAt: '',
  scoreConfiance: 75,
  piecesFournies: 0,
  piecesTotal: 24,
  alertes: [],
})

type Mode = 'choice' | 'new' | 'existing'

export default function Saisie() {
  const navigate = useNavigate()
  const banques = useStore((s) => s.banques)
  const collaborateurs = useStore((s) => s.collaborateurs)
  const clients = useStore((s) => s.clients)
  const addClient = useStore((s) => s.addClient)
  const updateClient = useStore((s) => s.updateClient)
  const addDossier = useStore((s) => s.addDossier)

  const [mode, setMode] = useState<Mode>('choice')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const newDossierStub = useMemo(() => stubDossier(), [])
  const newClientStub = useMemo(() => stubClient(), [])

  // ── Pré-remplissage si mode 'existing' ───────────────────────────────────
  const selectedClient = selectedClientId ? clients.find((c) => c.id === selectedClientId) ?? null : null
  const dossierForEditor = selectedClient
    ? { ...newDossierStub, clientId: selectedClient.id, clientNom: `${selectedClient.nom} ${selectedClient.prenom}` }
    : newDossierStub
  const clientForEditor = selectedClient ?? newClientStub

  // ── Sauvegarde ────────────────────────────────────────────────────────────
  const onSave = (dossierPatch: Partial<Dossier>, clientPatch: Partial<Client>) => {
    if (!clientPatch.prenom?.trim() || !clientPatch.nom?.trim()) {
      toast.error('Prénom et nom de l\'emprunteur principal requis')
      return
    }

    let clientId: string
    let clientNom: string
    let clientPrenom: string

    if (selectedClient) {
      // Mode existing : on met à jour le client existant avec les éventuelles
      // modifications saisies dans le formulaire, puis on crée le dossier.
      const patch: Partial<Client> = {
        prenom: clientPatch.prenom,
        nom: clientPatch.nom,
        email: clientPatch.email ?? selectedClient.email,
        tel: clientPatch.tel ?? selectedClient.tel,
        naissance: clientPatch.naissance ?? selectedClient.naissance,
        ville: clientPatch.ville ?? selectedClient.ville,
        profession: clientPatch.profession ?? selectedClient.profession,
        conjoint: clientPatch.conjoint ?? selectedClient.conjoint,
        revenuMensuelNet: clientPatch.revenuMensuelNet ?? selectedClient.revenuMensuelNet,
        apporteur: clientPatch.apporteur ?? selectedClient.apporteur,
        apporteurId: clientPatch.apporteurId ?? selectedClient.apporteurId,
      }
      updateClient(selectedClient.id, patch)
      clientId = selectedClient.id
      clientNom = clientPatch.nom
      clientPrenom = clientPatch.prenom
    } else {
      // Mode new : on crée un nouveau client (prospect par défaut).
      const newClient = addClient({
        prenom: clientPatch.prenom,
        nom: clientPatch.nom,
        email: clientPatch.email ?? '',
        tel: clientPatch.tel ?? '',
        naissance: clientPatch.naissance ?? '',
        ville: clientPatch.ville ?? '',
        profession: clientPatch.profession ?? '',
        conjoint: clientPatch.conjoint,
        revenuMensuelNet: clientPatch.revenuMensuelNet ?? 0,
        apporteur: clientPatch.apporteur ?? '',
        apporteurId: clientPatch.apporteurId,
      })
      clientId = newClient.id
      clientNom = newClient.nom
      clientPrenom = newClient.prenom
    }

    const newDossier = addDossier({
      clientId,
      clientNom: dossierPatch.clientNom ?? `${clientNom} ${clientPrenom}`,
      statut: 'R0',
      typeProjet: dossierPatch.typeProjet ?? 'Achat RP',
      villeBien: dossierPatch.villeBien ?? '',
      montantBien: dossierPatch.montantBien ?? 0,
      montantPret: dossierPatch.montantPret ?? 0,
      apport: dossierPatch.apport ?? 0,
      dureeMois: dossierPatch.dureeMois ?? 300,
      // ⚠️ banque/tauxNominal/mensualite migrent désormais sur la table `prets`.
      ltv: dossierPatch.ltv,
      hcsfOk: dossierPatch.hcsfOk,
      emprunteur1: dossierPatch.emprunteur1,
      emprunteur2: dossierPatch.emprunteur2,
      rfMenage: dossierPatch.rfMenage,
      allocFamiliales: dossierPatch.allocFamiliales,
      aplAlActuelle: dossierPatch.aplAlActuelle,
      epargneMenage: dossierPatch.epargneMenage,
      loyerMenage: dossierPatch.loyerMenage,
      autresDepensesMenage: dossierPatch.autresDepensesMenage,
      empruntsLocatifsMenage: dossierPatch.empruntsLocatifsMenage,
      empruntsNonLocatifsMenage: dossierPatch.empruntsNonLocatifsMenage,
      ponderationRF: dossierPatch.ponderationRF,
      rfReferenceN1: dossierPatch.rfReferenceN1,
      rfReferenceN2: dossierPatch.rfReferenceN2,
      dateReleveEndettement: dossierPatch.dateReleveEndettement,
      creditsExistants: dossierPatch.creditsExistants,
      patrimoine: dossierPatch.patrimoine,
      droitsEL: dossierPatch.droitsEL,
      typeAchat: dossierPatch.typeAchat,
      destination: dossierPatch.destination,
      typeLogement: dossierPatch.typeLogement,
      compromisSigne: dossierPatch.compromisSigne,
      actePrevuLe: dossierPatch.actePrevuLe,
      coutTerrain: dossierPatch.coutTerrain,
      coutLogement: dossierPatch.coutLogement,
      coutTravaux: dossierPatch.coutTravaux,
      coutViabilisation: dossierPatch.coutViabilisation,
      coutMobilier: dossierPatch.coutMobilier,
      fraisEtablissement: dossierPatch.fraisEtablissement,
      fraisExpertise: dossierPatch.fraisExpertise,
      fraisAgence: dossierPatch.fraisAgence,
      fraisNotaire: dossierPatch.fraisNotaire,
      rachatCreditCout: dossierPatch.rachatCreditCout,
      commercialId: dossierPatch.commercialId,
      backOfficeId: dossierPatch.backOfficeId,
      apporteurNom: dossierPatch.apporteurNom,
      apporteurReference: dossierPatch.apporteurReference,
      notaireNom: dossierPatch.notaireNom,
      venteADistance: dossierPatch.venteADistance,
      archive: dossierPatch.archive,
      archiveRaison: dossierPatch.archiveRaison,
      identifiantEmprunteur: dossierPatch.identifiantEmprunteur,
      identifiantCoEmprunteur: dossierPatch.identifiantCoEmprunteur,
    })

    toast.success(`Dossier ${newDossier.ref} créé`, {
      description: selectedClient
        ? `Rattaché à ${selectedClient.prenom} ${selectedClient.nom} (déjà ${selectedClient.dossierIds.length + 1} dossier(s))`
        : `${clientPrenom} ${clientNom} — vous pouvez l'enrichir depuis sa fiche`,
      action: { label: 'Ouvrir', onClick: () => navigate(`/dossiers/${newDossier.id}`) },
    })
    navigate(`/dossiers/${newDossier.id}`)
  }

  // ── Étape 1 : choix du mode ─────────────────────────────────────────────
  if (mode === 'choice') {
    return <SaisieChoice
      onNew={() => setMode('new')}
      onExisting={() => setMode('existing')}
      onCancel={() => navigate('/dossiers')}
    />
  }

  // ── Étape 2a : sélection du client existant ─────────────────────────────
  if (mode === 'existing' && !selectedClient) {
    return <ClientPicker
      clients={clients}
      onSelect={(c) => setSelectedClientId(c.id)}
      onBack={() => setMode('choice')}
    />
  }

  // ── Étape 3 : DossierEditor (avec ou sans pré-remplissage) ──────────────
  return (
    <DossierEditor
      dossier={dossierForEditor}
      client={clientForEditor}
      banques={banques}
      collaborateurs={collaborateurs}
      onClose={() => {
        // Retour étape précédente : si on avait sélectionné un client, on
        // revient à la liste de prospects ; sinon on quitte la page.
        if (selectedClient) { setSelectedClientId(null); return }
        if (mode === 'new') { setMode('choice'); return }
        navigate('/dossiers')
      }}
      onSave={onSave}
      mode="create"
    />
  )
}

/* ───────────────── Étape 1 : choix nouveau / existant ───────────────── */

function SaisieChoice({ onNew, onExisting, onCancel }: {
  onNew: () => void; onExisting: () => void; onCancel: () => void
}) {
  return (
    <>
      <div className="page-body max-w-4xl mx-auto">
        <button onClick={onCancel} className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-500 hover:text-navy-900 mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au pipeline
        </button>

        <div className="text-[10px] uppercase tracking-wider text-gold-700 font-semibold mb-2">Nouveau dossier</div>
        <h1 className="font-serif text-3xl text-navy-900 mb-2">À qui ce nouveau dossier appartient-il ?</h1>
        <p className="text-sm text-navy-500 mb-8">
          Choisis le mode de création selon le contexte commercial — un nouveau prospect ou un client/prospect déjà au portefeuille.
        </p>

        <div className="grid grid-cols-2 gap-5">
          <button
            onClick={onNew}
            className="card p-6 text-left hover:border-gold-400 hover:shadow-raised transition-all duration-200 group"
          >
            <div className="h-12 w-12 rounded-xl bg-gold-50 group-hover:bg-gold-100 flex items-center justify-center mb-4 transition">
              <UserPlus className="h-6 w-6 text-gold-700" />
            </div>
            <div className="font-serif text-lg text-navy-900 mb-1">Nouveau prospect</div>
            <div className="text-xs text-navy-500 leading-relaxed">
              Crée à la fois la fiche prospect <strong>et</strong> le dossier de prêt. À utiliser pour un nouveau contact qui n'est pas encore dans la base.
            </div>
            <div className="mt-4 text-[11px] font-semibold text-gold-700 group-hover:translate-x-1 transition">
              Continuer →
            </div>
          </button>

          <button
            onClick={onExisting}
            className="card p-6 text-left hover:border-navy-400 hover:shadow-raised transition-all duration-200 group"
          >
            <div className="h-12 w-12 rounded-xl bg-navy-50 group-hover:bg-navy-100 flex items-center justify-center mb-4 transition">
              <Search className="h-6 w-6 text-navy-700" />
            </div>
            <div className="font-serif text-lg text-navy-900 mb-1">Prospect / client existant</div>
            <div className="text-xs text-navy-500 leading-relaxed">
              Rattache le dossier à un prospect/client déjà au portefeuille. Pratique pour un 2<sup>ème</sup> projet ou une fiche créée en amont par un apporteur.
            </div>
            <div className="mt-4 text-[11px] font-semibold text-navy-700 group-hover:translate-x-1 transition">
              Choisir le prospect →
            </div>
          </button>
        </div>
      </div>
    </>
  )
}

/* ───────────────── Étape 2a : recherche d'un prospect ───────────────── */

function ClientPicker({ clients, onSelect, onBack }: {
  clients: Client[]; onSelect: (c: Client) => void; onBack: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Garde-fous : certains clients legacy ont des champs undefined.
    const safe = (s: unknown): string => (typeof s === 'string' ? s : '')
    if (!q) return clients.slice(0, 50)
    return clients.filter((c) => {
      const nomComplet = `${safe(c.nom)} ${safe(c.prenom)}`.toLowerCase()
      const email = safe(c.email).toLowerCase()
      const tel = safe(c.tel).replace(/\s/g, '')
      const ville = safe(c.ville).toLowerCase()
      const cleanQ = q.replace(/\s/g, '')
      return nomComplet.includes(q)
        || email.includes(q)
        || tel.includes(cleanQ)
        || ville.includes(q)
    }).slice(0, 50)
  }, [clients, query])

  return (
    <div className="page-body max-w-4xl mx-auto">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-500 hover:text-navy-900 mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Retour
      </button>

      <div className="text-[10px] uppercase tracking-wider text-gold-700 font-semibold mb-2">Nouveau dossier · prospect existant</div>
      <h1 className="font-serif text-3xl text-navy-900 mb-2">Choisis le prospect ou client</h1>
      <p className="text-sm text-navy-500 mb-6">
        Tape un nom, un email, un téléphone ou une ville pour filtrer.
      </p>

      <div className="card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bernard, john@example.com, 06 12, Dijon…"
            className="input pl-10"
            autoFocus
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <User2 className="h-10 w-10 text-navy-200 mx-auto mb-3" />
          <div className="text-sm font-semibold text-navy-700">Aucun résultat</div>
          <div className="text-xs text-navy-500 mt-1">
            {clients.length === 0
              ? 'Aucun prospect au portefeuille pour l\'instant. Reviens en arrière et choisis « Nouveau prospect ».'
              : 'Affine ta recherche ou crée un nouveau prospect.'}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-navy-100 text-[11px] uppercase tracking-wider text-navy-500 font-semibold">
            {filtered.length} {filtered.length === clients.length ? 'fiches' : `sur ${clients.length}`}
          </div>
          <div className="divide-y divide-navy-50 list-fast">
            {filtered.map((c) => {
              const prenom = c.prenom ?? ''
              const nom = c.nom ?? ''
              const initials = `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase() || '?'
              const dossierCount = (c.dossierIds ?? []).length
              const isClient = c.statutCommercial === 'client'
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-navy-50/60 transition text-left group"
                >
                  <div className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0',
                    isClient ? 'bg-gold-100 text-gold-800' : 'bg-navy-100 text-navy-700',
                  )}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-navy-900 truncate">
                      {prenom} {nom || <em className="text-navy-300 font-normal">Sans nom</em>}
                      <span className={cn(
                        'ml-2 text-[10px] uppercase tracking-wider',
                        isClient ? 'text-gold-700' : 'text-navy-500',
                      )}>
                        {c.statutCommercial ?? 'prospect'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-navy-500 mt-0.5 truncate">
                      {c.email && <span className="inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" /> {c.email}</span>}
                      {c.tel && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" /> {c.tel}</span>}
                      {c.ville && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /> {c.ville}</span>}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-navy-400 shrink-0">
                    {dossierCount > 0 && (
                      <div>{dossierCount} dossier{dossierCount > 1 ? 's' : ''}</div>
                    )}
                    {c.lastActivity && <div>{dateFr(c.lastActivity)}</div>}
                  </div>
                  <span className="text-[11px] font-semibold text-gold-700 group-hover:translate-x-1 transition shrink-0">
                    Continuer →
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
