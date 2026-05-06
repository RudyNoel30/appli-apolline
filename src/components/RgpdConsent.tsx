/**
 * Bandeau de consentement RGPD pour les collaborateurs Apolline.
 *
 * Affiché au 1er login (et à chaque mise à jour de la politique). Stocke
 * la version acceptée + la date dans localStorage pour ne pas réafficher.
 *
 * Le bandeau rappelle :
 *  - Quelles données traitées (clients, dossiers)
 *  - Pour quoi (mise en relation IOBSP)
 *  - Combien de temps (5 ans)
 *  - Droits clients (accès, effacement)
 *  - Lien vers la politique complète
 */
import { useEffect, useState } from 'react'
import { Scale, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'

const POLICY_VERSION = '2026-04-30'
const STORAGE_KEY = 'apolline.rgpd.accepted'

export default function RgpdConsent() {
  const { currentUser } = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!currentUser) { setShow(false); return }
    try {
      const accepted = localStorage.getItem(`${STORAGE_KEY}.${currentUser.id}`)
      // Affiche si pas accepté OU si la version a évolué
      setShow(!accepted || accepted !== POLICY_VERSION)
    } catch {
      setShow(true)
    }
  }, [currentUser])

  const accept = () => {
    if (!currentUser) return
    try { localStorage.setItem(`${STORAGE_KEY}.${currentUser.id}`, POLICY_VERSION) } catch { /* swallow */ }
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-md animate-fade-in-up">
      <div className="card p-5 shadow-raised border-l-4 border-gold-500">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-gold-50 flex items-center justify-center shrink-0">
            <Scale className="h-5 w-5 text-gold-700" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-base text-navy-900 mb-1">Conformité RGPD — rappel</h3>
            <p className="text-xs text-navy-600 leading-relaxed">
              En tant que collaborateur Apolline, tu manipules des données personnelles sensibles
              (bulletins de salaire, RIB, identité…). Tu t'engages à :
            </p>
            <ul className="text-xs text-navy-700 mt-2 space-y-1 list-disc pl-4">
              <li>Ne pas extraire / partager ces données hors du cadre du mandat IOBSP</li>
              <li>Verrouiller ton poste à chaque pause</li>
              <li>Signaler immédiatement toute fuite ou perte de matériel</li>
              <li>Utiliser un mot de passe fort et ne jamais le partager</li>
            </ul>
            <p className="text-[11px] text-navy-500 mt-3">
              Politique du <strong>{new Date(POLICY_VERSION).toLocaleDateString('fr-FR')}</strong> · Registre des traitements consultable dans Paramètres → RGPD.
            </p>
          </div>
          <button
            onClick={accept}
            className="text-navy-400 hover:text-navy-700 shrink-0"
            title="Plus tard"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-end">
          <button onClick={accept} className="btn-gold text-xs">
            J'ai compris et j'accepte
          </button>
        </div>
      </div>
    </div>
  )
}
