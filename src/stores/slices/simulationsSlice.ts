import type { StateCreator } from 'zustand'
import { mirror } from '@/db/api'
import { type Store, type Simulation, genId } from '../types'

export type SimulationsSlice = {
  simulations: Simulation[]
  saveSimulation: (s: Omit<Simulation, 'id' | 'createdAt'>) => Simulation
  deleteSimulation: (id: string) => void
}

export const createSimulationsSlice: StateCreator<Store, [], [], SimulationsSlice> = (set) => ({
  simulations: [],

  saveSimulation: (s) => {
    const newS: Simulation = {
      ...s,
      id: genId('S'),
      createdAt: new Date().toISOString(),
    }
    set((st) => ({ simulations: [newS, ...st.simulations] }))
    mirror.create('simulations', newS as unknown as Record<string, unknown>)
    return newS
  },

  deleteSimulation: (id) => {
    set((s) => ({ simulations: s.simulations.filter((sim) => sim.id !== id) }))
    mirror.remove('simulations', id)
  },
})
