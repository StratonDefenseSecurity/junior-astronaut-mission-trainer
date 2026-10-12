import { create } from 'zustand'
import type { ModuleId, RoomState } from '@shared/types'

export interface Usuario { id: string; nombre: string }
export interface Toast { id: number; texto: string; tipo: 'error' | 'info' }

interface Store {
  token: string | null
  usuario: Usuario | null
  sala: RoomState | null
  conectado: boolean
  toasts: Toast[]
  moduloSeleccionado: ModuleId | null
  panel: 'rol' | 'propuestas' | 'bot' | 'registro' | null
  setAuth: (token: string | null, usuario: Usuario | null) => void
  setSala: (sala: RoomState | null) => void
  setConectado: (v: boolean) => void
  toast: (texto: string, tipo?: 'error' | 'info') => void
  quitarToast: (id: number) => void
  seleccionarModulo: (m: ModuleId | null) => void
  setPanel: (p: Store['panel']) => void
}

let toastId = 0

export const useStore = create<Store>((set) => ({
  token: localStorage.getItem('mt_token'),
  usuario: JSON.parse(localStorage.getItem('mt_usuario') ?? 'null'),
  sala: null,
  conectado: false,
  toasts: [],
  moduloSeleccionado: null,
  panel: 'rol',
  setAuth: (token, usuario) => {
    if (token) localStorage.setItem('mt_token', token)
    else localStorage.removeItem('mt_token')
    if (usuario) localStorage.setItem('mt_usuario', JSON.stringify(usuario))
    else localStorage.removeItem('mt_usuario')
    set({ token, usuario })
  },
  setSala: (sala) => set({ sala }),
  setConectado: (conectado) => set({ conectado }),
  toast: (texto, tipo = 'error') => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, texto, tipo }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500)
  },
  quitarToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  seleccionarModulo: (moduloSeleccionado) => set({ moduloSeleccionado }),
  setPanel: (panel) => set({ panel }),
}))

export const useYo = () => {
  const sala = useStore((s) => s.sala)
  const usuario = useStore((s) => s.usuario)
  return sala?.jugadores.find((j) => j.id === usuario?.id) ?? null
}
