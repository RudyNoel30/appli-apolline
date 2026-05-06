import { describe, it, expect } from 'vitest'
import { computeEncaissementsMensuels, computeEncaissementsMois, computeAlertes, computeTachesJour } from '../dashboard'
import type { Commission, Dossier, Rdv } from '@/data/mock'

describe('computeEncaissementsMensuels', () => {
  it('retourne 6 mois à zéro si commissions vides', () => {
    const result = computeEncaissementsMensuels([], new Date('2026-04-15'))
    expect(result).toHaveLength(6)
    expect(result.every((m) => m.brut === 0 && m.net === 0)).toBe(true)
  })

  it('agrège les commissions par mois', () => {
    const commissions = [
      { mois: '2026-04', montantBrut: 1500, montantNet: 1200 } as unknown as Commission,
      { mois: '2026-04', montantBrut: 800, montantNet: 700 } as unknown as Commission,
      { mois: '2026-03', montantBrut: 2000, montantNet: 1700 } as unknown as Commission,
    ]
    const result = computeEncaissementsMensuels(commissions, new Date('2026-04-15'))
    const avril = result.find((m) => m.mois === 'Avr')
    expect(avril?.brut).toBe(2300)
    expect(avril?.net).toBe(1900)
  })

  it('ignore les mois hors fenêtre 6 mois', () => {
    const commissions = [
      { mois: '2025-01', montantBrut: 99999, montantNet: 99999 } as unknown as Commission,
    ]
    const result = computeEncaissementsMensuels(commissions, new Date('2026-04-15'))
    expect(result.every((m) => m.brut === 0)).toBe(true)
  })
})

describe('computeEncaissementsMois', () => {
  it('somme les commissions du mois courant', () => {
    const commissions = [
      { mois: '2026-04', montantBrut: 500 } as unknown as Commission,
      { mois: '2026-04', montantBrut: 300 } as unknown as Commission,
      { mois: '2026-03', montantBrut: 1000 } as unknown as Commission,
    ]
    expect(computeEncaissementsMois(commissions, new Date('2026-04-15'))).toBe(800)
  })
})

describe('computeAlertes', () => {
  it('génère une alerte HCSF haute si hcsfOk = false', () => {
    const dossiers = [
      { id: 'd1', clientNom: 'Bernard', ref: '2026-0001', archive: false, hcsfOk: false, ltv: 1.05, dureeMois: 300, piecesFournies: 24, piecesTotal: 24, alertes: [] } as unknown as Dossier,
    ]
    const alertes = computeAlertes(dossiers, [], new Date('2026-04-15'))
    expect(alertes.find((a) => a.type === 'hcsf')).toBeDefined()
    expect(alertes.find((a) => a.type === 'hcsf')?.priorite).toBe('haute')
  })

  it('génère une alerte pièces si < 50 % fournies', () => {
    const dossiers = [
      { id: 'd1', clientNom: 'Durand', ref: '2026-0002', archive: false, hcsfOk: true, ltv: 0.8, dureeMois: 240, piecesFournies: 10, piecesTotal: 24, alertes: [] } as unknown as Dossier,
    ]
    const alertes = computeAlertes(dossiers, [], new Date('2026-04-15'))
    expect(alertes.find((a) => a.type === 'piece')).toBeDefined()
  })

  it('ignore les dossiers archivés', () => {
    const dossiers = [
      { id: 'd1', clientNom: 'Archive', ref: '2026-0003', archive: true, hcsfOk: false, ltv: 2, dureeMois: 300, piecesFournies: 0, piecesTotal: 24, alertes: [] } as unknown as Dossier,
    ]
    expect(computeAlertes(dossiers, [], new Date('2026-04-15'))).toHaveLength(0)
  })
})

describe('computeTachesJour', () => {
  it('liste les RDV du jour avec heure et priorité haute', () => {
    const today = new Date('2026-04-15T14:30:00')
    const rdvs = [
      { id: 'r1', date: '2026-04-15T10:30:00', clientNom: 'Bernard', type: 'R1', lieu: 'Bureau' } as unknown as Rdv,
    ]
    const taches = computeTachesJour([], rdvs, today)
    expect(taches).toHaveLength(1)
    expect(taches[0].type).toBe('rdv')
    expect(taches[0].priorite).toBe('haute')
    expect(taches[0].heure).toBe('10:30')
  })

  it('génère une relance si dossier en envoi banque > 7 jours', () => {
    const today = new Date('2026-04-15')
    const old = new Date('2026-04-01').toISOString()
    const dossiers = [
      { id: 'd1', clientNom: 'X', ref: '0001', archive: false, hcsfOk: true, ltv: 0.8, dureeMois: 300, piecesFournies: 24, piecesTotal: 24, statut: 'Envoi_banque', createdAt: old, alertes: [] } as unknown as Dossier,
    ]
    const taches = computeTachesJour(dossiers, [], today)
    expect(taches.find((t) => t.type === 'relance')).toBeDefined()
  })

  it('trie par priorité (haute > moyenne > basse)', () => {
    const today = new Date('2026-04-15')
    const dossiers = [
      // basse : stagnation
      { id: 'd1', clientNom: 'Stag', ref: '0001', archive: false, hcsfOk: true, ltv: 0.8, dureeMois: 300, piecesFournies: 24, piecesTotal: 24, statut: 'R1_fait', createdAt: '2025-01-01', alertes: [] } as unknown as Dossier,
      // haute : HCSF KO
      { id: 'd2', clientNom: 'Hcsf', ref: '0002', archive: false, hcsfOk: false, ltv: 1.1, dureeMois: 300, piecesFournies: 24, piecesTotal: 24, statut: 'R0', createdAt: '2026-04-10', alertes: [] } as unknown as Dossier,
    ]
    const taches = computeTachesJour(dossiers, [], today)
    expect(taches[0].priorite).toBe('haute')
  })
})
