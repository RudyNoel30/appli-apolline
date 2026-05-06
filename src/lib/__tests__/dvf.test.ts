import { describe, it, expect } from 'vitest'
import { computeStats, decoteDpe } from '../dvf'
import type { Mutation } from '../dvf'

describe('computeStats', () => {
  it('retourne 0 partout si aucune mutation', () => {
    const s = computeStats([])
    expect(s.count).toBe(0)
    expect(s.prixM2Median).toBe(0)
  })

  it('calcule la médiane et les quartiles', () => {
    const muts: Mutation[] = [
      { id: '1', date: '2025-01', adresse: 'A', codePostal: '21000', ville: 'Dijon', typeLocal: 'Maison', prix: 100000, prixM2: 1000 },
      { id: '2', date: '2025-02', adresse: 'B', codePostal: '21000', ville: 'Dijon', typeLocal: 'Maison', prix: 200000, prixM2: 2000 },
      { id: '3', date: '2025-03', adresse: 'C', codePostal: '21000', ville: 'Dijon', typeLocal: 'Maison', prix: 300000, prixM2: 3000 },
      { id: '4', date: '2025-04', adresse: 'D', codePostal: '21000', ville: 'Dijon', typeLocal: 'Maison', prix: 400000, prixM2: 4000 },
      { id: '5', date: '2025-05', adresse: 'E', codePostal: '21000', ville: 'Dijon', typeLocal: 'Maison', prix: 500000, prixM2: 5000 },
    ]
    const s = computeStats(muts)
    expect(s.count).toBe(5)
    expect(s.prixM2Min).toBe(1000)
    expect(s.prixM2Max).toBe(5000)
    expect(s.prixM2Median).toBe(3000)
  })

  it('exclut les mutations sans prix/m²', () => {
    const muts: Mutation[] = [
      { id: '1', date: '2025-01', adresse: 'A', codePostal: '21000', ville: 'Dijon', typeLocal: 'Maison', prix: 100000, prixM2: 1000 },
      { id: '2', date: '2025-02', adresse: 'B', codePostal: '21000', ville: 'Dijon', typeLocal: 'Maison', prix: 200000 } as Mutation,
    ]
    expect(computeStats(muts).count).toBe(1)
  })
})

describe('decoteDpe', () => {
  it('renvoie une décote négative pour les mauvaises notes', () => {
    expect(decoteDpe('G')).toBeLessThan(0)
    expect(decoteDpe('F')).toBeLessThan(0)
    expect(decoteDpe('E')).toBeLessThan(0)
  })
  it('renvoie une bonification positive pour A et B', () => {
    expect(decoteDpe('A')).toBeGreaterThan(0)
    expect(decoteDpe('B')).toBeGreaterThan(0)
  })
  it('renvoie 0 pour C', () => {
    expect(decoteDpe('C')).toBe(0)
  })
  it('insensible à la casse', () => {
    expect(decoteDpe('g')).toBe(decoteDpe('G'))
  })
})
