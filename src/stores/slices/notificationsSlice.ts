import type { StateCreator } from 'zustand'
import { mirror } from '@/db/api'
import { type Store, type Notification, genId } from '../types'

export type NotificationsSlice = {
  notifications: Notification[]
  notify: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => Notification
  markNotifRead: (id: string) => void
  markAllNotifsRead: () => void
  deleteNotif: (id: string) => void
  clearNotifs: () => void
}

export const createNotificationsSlice: StateCreator<Store, [], [], NotificationsSlice> = (set, get) => ({
  notifications: [],

  notify: (n) => {
    const newN: Notification = {
      ...n,
      id: genId('NOT'),
      createdAt: new Date().toISOString(),
      read: false,
    }
    set((s) => ({ notifications: [newN, ...s.notifications] }))
    mirror.create('notifications', newN as unknown as Record<string, unknown>)
    return newN
  },

  markNotifRead: (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }))
    mirror.update('notifications', id, { read: true })
  },

  markAllNotifsRead: () => {
    const ids = get().notifications.filter((n) => !n.read).map((n) => n.id)
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }))
    ids.forEach((id) => mirror.update('notifications', id, { read: true }))
  },

  deleteNotif: (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }))
    mirror.remove('notifications', id)
  },

  clearNotifs: () => {
    const ids = get().notifications.map((n) => n.id)
    set({ notifications: [] })
    ids.forEach((id) => mirror.remove('notifications', id))
  },
})
