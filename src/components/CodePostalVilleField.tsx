/**
 * Champ composé "Code postal + Ville" avec autocomplete via geo.api.gouv.fr.
 *
 * Comportement :
 *  - L'utilisateur tape 5 chiffres dans le CP → fetch des communes correspondantes.
 *  - Si UNE seule commune → ville auto-remplie (silencieusement, sauf si déjà saisie).
 *  - Si PLUSIEURS communes (Bourg-de-Péage 26300, Sambin 41120…) → le champ Ville
 *    devient un <select> pour que le courtier choisisse explicitement.
 *  - Si aucune ou code invalide → input texte libre standard.
 *
 * Utilisable partout où il y a un CP + Ville séparés. Pour les cas "single field"
 * type "39570 Conliège", voir le hook `useCommunesByCodePostal` exporté à part.
 */
import { useEffect, useState } from 'react'
import { communesByCodePostal } from '@/lib/geo'

type Props = {
  codePostal: string
  ville: string
  onCodePostalChange: (cp: string) => void
  onVilleChange: (v: string) => void
  /** Largeurs colonne (grid Tailwind) — défaut "1" CP + "1" Ville */
  cpSpan?: 1 | 2 | 3
  villeSpan?: 1 | 2 | 3
  /** Label custom (défaut "Code postal" / "Ville") */
  cpLabel?: string
  villeLabel?: string
  /** Désactive les inputs (lecture seule) */
  disabled?: boolean
  /** Marquer la ville comme champ obligatoire */
  required?: boolean
  placeholder?: { cp?: string; ville?: string }
}

export default function CodePostalVilleField({
  codePostal, ville, onCodePostalChange, onVilleChange,
  cpSpan = 1, villeSpan = 1,
  cpLabel = 'Code postal', villeLabel = 'Ville',
  disabled, required, placeholder,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!/^\d{5}$/.test(codePostal)) { setSuggestions([]); return }
    let cancelled = false
    setLoading(true)
    void communesByCodePostal(codePostal).then((rows) => {
      if (cancelled) return
      const names = rows.map((r) => r.nom)
      setSuggestions(names)
      setLoading(false)
      // Auto-remplit la ville si une seule commune correspond et que ville vide
      if (names.length === 1 && !ville) onVilleChange(names[0] ?? '')
    })
    return () => { cancelled = true; setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codePostal])

  return (
    <>
      <div className={`col-span-${cpSpan}`}>
        <label className="label">{cpLabel}{required && <span className="text-rose-700 ml-0.5">*</span>}</label>
        <input
          className="input"
          value={codePostal}
          placeholder={placeholder?.cp ?? '39570'}
          maxLength={5}
          disabled={disabled}
          onChange={(e) => onCodePostalChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
        />
      </div>
      <div className={`col-span-${villeSpan}`}>
        <label className="label">
          {villeLabel}{required && <span className="text-rose-700 ml-0.5">*</span>}
          {loading && <span className="ml-2 text-[10px] text-navy-400 font-normal italic">(recherche…)</span>}
          {suggestions.length > 1 && <span className="ml-2 text-[10px] text-navy-500 font-normal">({suggestions.length} communes)</span>}
        </label>
        {suggestions.length > 1 ? (
          <select className="input" value={ville} disabled={disabled} onChange={(e) => onVilleChange(e.target.value)}>
            <option value="">— Choisir une commune —</option>
            {suggestions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <input
            className="input"
            value={ville}
            disabled={disabled}
            placeholder={placeholder?.ville ?? 'Ville'}
            onChange={(e) => onVilleChange(e.target.value)}
          />
        )}
      </div>
    </>
  )
}

/**
 * Variante "single field" — pour les cas où le code postal + ville sont stockés
 * dans une seule string format "CP Ville" (ex: dossier.villeBien = "39570 Conliège").
 *
 * Affiche un input unique. Quand l'utilisateur tape 5 chiffres suivis d'un
 * espace, on auto-suggère la complétion via une dropdown sous le champ.
 */
export function CodePostalVilleSingleField({
  value, onChange, label = 'Code postal + Ville', required, span = 2, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
  required?: boolean
  span?: 1 | 2 | 3 | 4
  placeholder?: string
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  // Extrait les 5 premiers chiffres → fetch communes
  useEffect(() => {
    const cpMatch = (value ?? '').match(/^\d{5}/)
    if (!cpMatch) { setSuggestions([]); return }
    let cancelled = false
    void communesByCodePostal(cpMatch[0]).then((rows) => {
      if (cancelled) return
      setSuggestions(rows.map((r) => r.nom))
    })
    return () => { cancelled = true }
  }, [value])

  // Si l'utilisateur tape juste le CP sans la ville et qu'il n'y a qu'une commune,
  // on suggère la complétion automatique au blur (sans forcer pour ne pas
  // surprendre s'il avait l'intention de saisir un truc différent).
  const cpOnly = /^\d{5}\s*$/.test(value ?? '')
  const autoComplete = cpOnly && suggestions.length === 1 ? `${value.trim()} ${suggestions[0]}` : null

  return (
    <div className={`col-span-${span} relative`}>
      <label className="label">{label}{required && <span className="text-rose-700 ml-0.5">*</span>}</label>
      <input
        className="input"
        value={value}
        placeholder={placeholder ?? '39570 Conliège'}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        onChange={(e) => onChange(e.target.value)}
      />
      {/* Dropdown des suggestions quand multiples communes pour le CP saisi */}
      {showDropdown && suggestions.length > 0 && cpOnly && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-navy-200 rounded-md shadow-raised max-h-56 overflow-y-auto">
          {suggestions.map((c) => (
            <button
              type="button"
              key={c}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gold-50 transition"
              onMouseDown={(e) => { e.preventDefault(); onChange(`${value.trim()} ${c}`); setShowDropdown(false) }}>
              {value.trim()} <strong>{c}</strong>
            </button>
          ))}
        </div>
      )}
      {autoComplete && !showDropdown && (
        <button
          type="button"
          onClick={() => onChange(autoComplete)}
          className="absolute right-2 top-[34px] text-[10px] text-gold-700 hover:text-gold-800 font-semibold"
          title={`Auto-compléter en "${autoComplete}"`}>
          ↳ {suggestions[0]}
        </button>
      )}
    </div>
  )
}
