/**
 * PoletteOnboarding — modale de bienvenue qui présente Polette au 1er login
 * après la mise à jour qui l'introduit (v0.1.61).
 *
 * Affichée 1 fois par utilisateur (flag localStorage `apolline.polette_onboarded`).
 * 2 écrans : présentation + 4 exemples cliquables qui pré-remplissent un message
 * dans le panneau Polette.
 */
import { useEffect, useState } from 'react'
import { Sparkles, X, ArrowRight, MessageSquareText, FileText, BarChart3, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const ONBOARD_KEY = 'apolline.polette_onboarded'

type Suggestion = { icon: typeof Sparkles; text: string; example: string }

const SUGGESTIONS: Suggestion[] = [
  { icon: Search, text: 'Trouve un dossier', example: 'Liste mes 5 derniers dossiers en montage' },
  { icon: FileText, text: 'Lance un skill', example: 'Génère le DDP du dossier en cours' },
  { icon: MessageSquareText, text: 'Note rapide', example: 'Crée une note "RDV reporté à mardi"' },
  { icon: BarChart3, text: 'Calcul HCSF', example: 'Calcule l\'endettement pour 350k€ sur 25 ans à 3,4% avec 4500€/mois' },
]

export default function PoletteOnboarding() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = localStorage.getItem(ONBOARD_KEY)
    if (!seen) {
      // Petit délai pour ne pas s'afficher avant que l'app soit montée
      const t = setTimeout(() => setOpen(true), 1500)
      return () => clearTimeout(t)
    }
  }, [])

  const close = () => {
    localStorage.setItem(ONBOARD_KEY, new Date().toISOString())
    setOpen(false)
  }

  const tryExample = (example: string) => {
    close()
    // Ouvre Polette et pré-remplit le textarea
    window.dispatchEvent(new CustomEvent('apolline:coworker-toggle'))
    setTimeout(() => {
      const ta = document.querySelector<HTMLTextAreaElement>('aside textarea')
      if (ta) {
        ta.value = example
        ta.focus()
        ta.dispatchEvent(new Event('input', { bubbles: true }))
        // Re-set la valeur via React state via un événement input simulé
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
        setter?.call(ta, example)
        ta.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, 300)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" onClick={close} />

      <div
        className={cn(
          'relative w-full max-w-lg rounded-2xl text-navy-100 polette-slide-in polette-corners overflow-hidden',
          'bg-gradient-to-b from-navy-950 via-[#0d1c3a] to-navy-950',
          'border border-gold-500/30',
          'shadow-[0_0_60px_-12px_rgba(201,169,97,0.4)]'
        )}
        style={{
          backgroundImage: `
            linear-gradient(to bottom, rgba(10,20,45,0.97), rgba(13,28,58,0.97), rgba(10,20,45,0.97)),
            radial-gradient(circle at 1px 1px, rgba(201,169,97,0.06) 1px, transparent 0)
          `,
          backgroundSize: 'auto, 24px 24px',
        }}
      >
        {/* Liseré gold haut */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/70 to-transparent pointer-events-none" />

        <button
          onClick={close}
          className="absolute top-3 right-3 h-8 w-8 rounded-md hover:bg-gold-500/10 flex items-center justify-center text-navy-300 hover:text-gold-300 transition-colors z-10"
          title="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        {step === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex relative h-16 w-16 rounded-2xl items-center justify-center mb-5 bg-gradient-to-br from-gold-500/30 to-gold-700/10 border border-gold-500/40 shadow-[0_0_30px_-6px_rgba(201,169,97,0.6)]">
              <Sparkles className="h-7 w-7 text-gold-400" />
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 polette-pulse" />
            </div>
            <div className="kicker text-gold-400/70 mb-2">Nouveauté · v0.1.61</div>
            <h2 className="font-serif text-2xl text-white mb-2">Bonjour, je suis Polette</h2>
            <p className="text-sm text-navy-200/90 mb-6 max-w-md mx-auto leading-relaxed">
              Votre nouvel assistant IA intégré à Extr'Apol. Je peux <strong className="text-gold-300">consulter et modifier vos dossiers</strong>, <strong className="text-gold-300">lancer vos skills Apolline</strong> (DDP, dossier banquier, étude client R1…) et <strong className="text-gold-300">répondre à vos questions métier</strong> (HCSF, taux, calculs).
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: '13 tools', sub: 'lecture + modif' },
                { label: '11 skills', sub: 'IA Apolline' },
                { label: 'Sonnet 4.6', sub: '~0,10 € / chat' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-navy-900/60 border border-gold-500/15 p-2.5">
                  <div className="font-serif text-base text-gold-300">{s.label}</div>
                  <div className="text-[10px] text-navy-300/70 polette-mono uppercase tracking-[0.1em]">{s.sub}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 font-medium shadow-[0_0_18px_-4px_rgba(201,169,97,0.7)] transition-all"
            >
              Voir des exemples <ArrowRight className="h-4 w-4" />
            </button>
            <div className="mt-4 text-[10px] polette-mono text-navy-400/70 uppercase tracking-[0.12em]">
              <span className="text-gold-400/60">›</span> Ouvrez Polette à tout moment avec <kbd className="px-1.5 py-0.5 rounded bg-navy-800/80 border border-gold-500/20 text-gold-300">Ctrl+I</kbd>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <div className="text-center mb-5">
              <div className="kicker text-gold-400/70 mb-1">Cliquez pour essayer</div>
              <h3 className="font-serif text-lg text-white">Quelques exemples</h3>
            </div>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => tryExample(s.example)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg text-left bg-navy-900/40 border border-gold-500/15 hover:bg-gold-500/[0.06] hover:border-gold-500/40 transition-all group"
                >
                  <div className="h-8 w-8 rounded-md bg-gold-500/15 border border-gold-500/30 flex items-center justify-center shrink-0 group-hover:bg-gold-500/25 transition-colors">
                    <s.icon className="h-4 w-4 text-gold-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{s.text}</div>
                    <div className="text-[11px] text-navy-300/80 mt-0.5 polette-mono"><span className="text-gold-400/60">› </span>{s.example}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gold-400/40 group-hover:text-gold-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button onClick={() => setStep(0)} className="text-xs text-navy-300 hover:text-gold-300 transition-colors">
                ← Retour
              </button>
              <button
                onClick={close}
                className="text-xs polette-mono text-navy-400 hover:text-gold-300 uppercase tracking-[0.12em] transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* Liseré gold bas */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent pointer-events-none" />
      </div>
    </div>
  )
}
