import { create } from 'zustand'
import type { ChatMsg, ModuleId, RoomState } from '@shared/types'

export interface Usuario { id: string; nombre: string }
export interface Toast { id: number; texto: string; tipo: 'error' | 'info' }

const leer = (clave: string) => {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}
const guardar = (clave: string, valor: string | null) => {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, valor)
  } catch {
    // almacenamiento no disponible (modo privado): la sesión dura lo que dure la pestaña
  }
}

interface Store {
  token: string | null
  usuario: Usuario | null
  sala: RoomState | null
  /** Código de la sala actual; se recuerda para volver a ella al recargar la página. */
  codigo: string | null
  reanudando: boolean
  conectado: boolean
  /** Diferencia entre el reloj del servidor y el de este navegador, en ms. */
  desfase: number
  toasts: Toast[]
  botMsgs: ChatMsg[]
  moduloSeleccionado: ModuleId | null
  panel: 'rol' | 'propuestas' | 'bot' | 'registro' | null
  setAuth: (token: string | null, usuario: Usuario | null) => void
  setSala: (sala: RoomState | null) => void
  setConectado: (v: boolean) => void
  setDesfase: (ms: number) => void
  agregarBot: (m: ChatMsg) => void
  toast: (texto: string, tipo?: 'error' | 'info') => void
  seleccionarModulo: (m: ModuleId | null) => void
  setPanel: (p: Store['panel']) => void
}

let toastId = 0
const codigoInicial = leer('mt_sala')

export const useStore = create<Store>((set) => ({
  token: leer('mt_token'),
  usuario: JSON.parse(leer('mt_usuario') ?? 'null'),
  sala: null,
  codigo: codigoInicial,
  reanudando: Boolean(codigoInicial),
  conectado: true,
  desfase: 0,
  toasts: [],
  botMsgs: [],
  moduloSeleccionado: null,
  panel: 'rol',
  setAuth: (token, usuario) => {
    guardar('mt_token', token)
    guardar('mt_usuario', usuario ? JSON.stringify(usuario) : null)
    if (!token) guardar('mt_sala', null)
    set(token ? { token, usuario } : { token, usuario, sala: null, codigo: null, reanudando: false, botMsgs: [] })
  },
  setSala: (sala) => {
    guardar('mt_sala', sala ? sala.codigo : null)
    set(
      sala
        ? { sala, codigo: sala.codigo, reanudando: false }
        : { sala: null, codigo: null, reanudando: false, botMsgs: [], moduloSeleccionado: null },
    )
  },
  setConectado: (conectado) => set({ conectado }),
  setDesfase: (desfase) => set({ desfase }),
  agregarBot: (m) => set((s) => ({ botMsgs: [...s.botMsgs.slice(-40), m] })),
  toast: (texto, tipo = 'error') => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, texto, tipo }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500)
  },
  seleccionarModulo: (moduloSeleccionado) => set({ moduloSeleccionado }),
  setPanel: (panel) => set({ panel }),
}))

export const useYo = () => {
  const sala = useStore((s) => s.sala)
  const usuario = useStore((s) => s.usuario)
  return sala?.jugadores.find((j) => j.id === usuario?.id) ?? null
}

/** Hora actual según el reloj del servidor (los vencimientos de la sala usan ese reloj). */
export const ahoraServidor = () => Date.now() + useStore.getState().desfase
