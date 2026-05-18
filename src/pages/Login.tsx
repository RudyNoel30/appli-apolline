import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, Shield } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import Logo from '@/components/Logo'
import { cn, initials } from '@/lib/utils'
import pkg from '../../package.json'

export default function Login() {
  const { login, collaborateurs } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Focus programmatique sur l'email UNIQUEMENT au 1er mount (jamais après).
  // L'attribut React `autoFocus` peut se re-déclencher sur certains re-mounts
  // et faire sauter le curseur du password vers l'email pendant la frappe.
  const emailRef = useRef<HTMLInputElement>(null)
  const focusedOnceRef = useRef(false)
  useEffect(() => {
    if (focusedOnceRef.current) return
    focusedOnceRef.current = true
    emailRef.current?.focus()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !motDePasse) {
      setError('Veuillez renseigner l\'identifiant et le mot de passe.')
      return
    }
    setLoading(true)
    setError(null)
    // Pas de délai artificiel — Sébastien (retour beta 2026-05) trouvait que
    // le timer fake faisait perdre du temps à chaque connexion.
    try {
      const res = await login(email, motDePasse)
      if (!res.ok) {
        setError(res.error ?? 'Erreur de connexion')
        setLoading(false)
        return
      }
      setSuccess(true)
      setTimeout(() => navigate('/', { replace: true }), 600)
    } catch (err: any) {
      setError(err?.message ?? 'Erreur inattendue')
      setLoading(false)
    }
  }

  const prefillAccount = (emailAddr: string) => {
    setEmail(emailAddr)
    setMotDePasse('')
    setError(null)
  }

  return (
    <div className="min-h-screen w-full bg-navy-900 flex items-center justify-center relative overflow-hidden">
      {/* Halos décoratifs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-gold-500/10 blur-3xl animate-pulse-soft" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-navy-600/30 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold-500 to-transparent" />

      <div className="relative z-10 w-full max-w-md px-8">
        {/* Logo hero */}
        <div className="flex flex-col items-center mb-8 animate-fade-in-down">
          <div className="scale-[1.8] mb-6">
            <Logo animated />
          </div>
          <div className="h-px w-14 bg-gold-500 mt-3 mb-2.5" />
          <div className="text-[11px] uppercase tracking-[0.3em] text-gold-300 font-semibold">
            Plateforme de courtage
          </div>
        </div>

        {/* Carte de login */}
        <form
          onSubmit={submit}
          className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 backdrop-blur-md shadow-raised animate-fade-in-up"
        >
          <h2 className="font-serif text-xl text-white mb-1">Connexion</h2>
          <p className="text-sm text-navy-300 mb-6">Accédez à votre espace courtier.</p>

          {/* Identifiant */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-wider text-navy-200 mb-2">
              Identifiant
            </label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400 group-focus-within:text-gold-400 transition-colors" />
              <input
                id="email"
                ref={emailRef}
                name="apolline-identifiant"
                type="email"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                placeholder="prenom@groupe-apolline.fr"
                disabled={loading || success}
                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder:text-navy-400 focus:border-gold-500 focus:bg-white/[0.07] focus:ring-2 focus:ring-gold-500/30 outline-none transition-all duration-200 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-wider text-navy-200">
                Mot de passe
              </label>
              <button
                type="button"
                className="text-[11px] text-navy-300 hover:text-gold-400 transition"
                onClick={(e) => { e.preventDefault(); alert('Contactez votre administrateur pour réinitialiser votre mot de passe.') }}
              >
                Oublié ?
              </button>
            </div>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400 group-focus-within:text-gold-400 transition-colors" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => { setMotDePasse(e.target.value); setError(null) }}
                placeholder="••••••••••••"
                disabled={loading || success}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder:text-navy-400 focus:border-gold-500 focus:bg-white/[0.07] focus:ring-2 focus:ring-gold-500/30 outline-none transition-all duration-200 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-gold-400 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Se souvenir */}
          <label className="flex items-center gap-2 text-xs text-navy-300 cursor-pointer mb-5 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-gold-500"
            />
            Rester connecté sur ce poste
          </label>

          {/* Erreur */}
          {error && (
            <div className="mb-4 flex items-start gap-2 text-xs text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 animate-fade-in">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Bouton submit */}
          <button
            type="submit"
            disabled={loading || success}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all duration-200 press',
              success
                ? 'bg-emerald-500 text-white'
                : 'bg-gold-500 hover:bg-gold-400 text-navy-900 shadow-gold disabled:opacity-60',
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Connexion en cours…
              </>
            ) : success ? (
              <>
                <Shield className="h-4 w-4" /> Connecté · redirection…
              </>
            ) : (
              <>
                Se connecter <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {/* Accès rapide (pré-remplissage de l'email) — DEV uniquement, retiré en prod
              pour éviter l'énumération des collaborateurs depuis la page de login. */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="text-[10px] uppercase tracking-wider text-navy-400 font-semibold mb-2.5 text-center">
                Accès rapide (dev)
              </div>
              <div className="flex items-center justify-center gap-2">
                {collaborateurs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => prefillAccount(c.email)}
                    title={`${c.prenom} ${c.nom} · ${c.roleLabel}`}
                    className={cn(
                      'h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center font-serif text-xs font-semibold transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-gold-500/50',
                      c.avatarGradient,
                      c.avatarAccent,
                      email === c.email && 'ring-2 ring-gold-500 scale-110',
                    )}
                  >
                    {initials(c.prenom + ' ' + c.nom)}
                  </button>
                ))}
              </div>
            </div>
          )}

        </form>

        <div className="flex items-center justify-center gap-2 mt-6 text-[11px] text-navy-400">
          <Shield className="h-3 w-3 text-gold-500" />
          Connexion sécurisée
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] text-navy-500">
        © {new Date().getFullYear()} Groupe Apolline · v{pkg.version}
      </div>
    </div>
  )
}
