import { describe, it, expect } from 'vitest'
import { tauxPourDuree } from '../mock'
import type { Banque } from '../mock'

const cebfc: Banque = {
  id: 'CEBFC', nom: 'CEBFC', couleur: '#000',
  tauxMoyen: 0.032,
  taux15: 0.030, taux20: 0.032, taux25: 0.034,
  taegMoyen: 0.037, assuranceGroupePct: 0.0034,
  fraisDossier: 800, dureesMax: 300,
}

describe('tauxPourDuree', () => {
  it('retourne taux15 pour 15 ans', () => {
    expect(tauxPourDuree(cebfc, 180)).toBe(0.030)
  })

  it('retourne taux20 pour 20 ans', () => {
    expect(tauxPourDuree(cebfc, 240)).toBe(0.032)
  })

  it('retourne taux25 pour 25 ans', () => {
    expect(tauxPourDuree(cebfc, 300)).toBe(0.034)
  })

  it('interpole linéairement entre 15 et 20 ans', () => {
    // 17.5 ans = 210 mois → milieu de [15, 20] → milieu de [taux15, taux20]
    const r = tauxPourDuree(cebfc, 210)
    expect(r).toBeCloseTo(0.031, 4)
  })

  it('interpole linéairement entre 20 et 25 ans', () => {
    // 22.5 ans = 270 mois → milieu de [20, 25] → milieu de [taux20, taux25]
    const r = tauxPourDuree(cebfc, 270)
    expect(r).toBeCloseTo(0.033, 4)
  })

  it('clamp à taux15 pour durée < 15 ans', () => {
    expect(tauxPourDuree(cebfc, 120)).toBe(0.030)
  })

  it('clamp à taux25 pour durée > 25 ans', () => {
    expect(tauxPourDuree(cebfc, 360)).toBe(0.034)
  })

  it('fallback sur tauxMoyen si grille pas renseignée', () => {
    const sans: Banque = { ...cebfc, taux15: 0, taux20: 0, taux25: 0 }
    expect(tauxPourDuree(sans, 240)).toBe(0.032)
  })
})
