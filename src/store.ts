import { create } from 'zustand'
import type { ChatMsg, RoomState } from '@shared/types'

export interface Usuario { id: string; nombre: string }
export interface Toast { id: number; texto: string; tipo: 'error' | 'info' }
export type Pestana = 'mision' | 'propuestas' | 'asistente'

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
  /** Diferencia entre el reloj de la misión en el servidor y el de este navegador, en ms. */
  desfase: number
  toasts: Toast[]
  botMsgs: ChatMsg[]
  pestana: Pestana
  /** Estación del mapa cuyo panel está abierto. 'principal' es la página principal de la base. */
  estacion: string | null
  /** El panel se abrió desde la página principal, sin estar junto a la estación. */
  remoto: boolean
  /** Estación más cercana con la que se puede interactuar. */
  cerca: string | null
  fuentes: boolean
  panelesOcultos: boolean
  setAuth: (token: string | null, usuario: Usuario | null) => void
  setSala: (sala: RoomState | null) => void
  setConectado: (v: boolean) => void
  setDesfase: (ms: number) => void
  agregarBot: (m: ChatMsg) => void
  toast: (texto: string, tipo?: 'error' | 'info') => void
  setPestana: (p: Pestana) => void
  abrirEstacion: (id: string | null, remoto?: boolean) => void
  setCerca: (id: string | null) => void
  setFuentes: (v: boolean) => void
  alternarPaneles: () => void
}

let toastId = 0
const codigoInicial = leer('mt_sala')

export const useStore = create<Store>((set, get) => ({
  token: leer('mt_token'),
  usuario: JSON.parse(leer('mt_usuario') ?? 'null'),
  sala: null,
  codigo: codigoInicial,
  reanudando: Boolean(codigoInicial),
  conectado: true,
  desfase: 0,
  toasts: [],
  botMsgs: [],
  pestana: 'mision',
  estacion: null,
  remoto: false,
  cerca: null,
  fuentes: false,
  panelesOcultos: false,
  setAuth: (token, usuario) => {
    guardar('mt_token', token)
    guardar('mt_usuario', usuario ? JSON.stringify(usuario) : null)
    if (!token) guardar('mt_sala', null)
    set(token ? { token, usuario } : { token, usuario, sala: null, codigo: null, reanudando: false, botMsgs: [], estacion: null })
  },
  setSala: (sala) => {
    guardar('mt_sala', sala ? sala.codigo : null)
    set(sala ? { sala, codigo: sala.codigo, reanudando: false } : { sala: null, codigo: null, reanudando: false, botMsgs: [], estacion: null, cerca: null })
  },
  setConectado: (conectado) => set({ conectado }),
  setDesfase: (desfase) => set({ desfase }),
  agregarBot: (m) => set((s) => ({ botMsgs: [...s.botMsgs.slice(-40), m] })),
  toast: (texto, tipo = 'error') => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, texto, tipo }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000)
  },
  setPestana: (pestana) => set({ pestana }),
  abrirEstacion: (estacion, remoto = false) => set({ estacion, remoto: Boolean(estacion) && remoto }),
  setCerca: (cerca) => {
    if (get().cerca !== cerca) set({ cerca })
  },
  setFuentes: (fuentes) => set({ fuentes }),
  alternarPaneles: () => set((s) => ({ panelesOcultos: !s.panelesOcultos })),
}))

export const useYo = () => {
  const sala = useStore((s) => s.sala)
  const usuario = useStore((s) => s.usuario)
  return sala?.jugadores.find((j) => j.id === usuario?.id) ?? null
}

/** Hora actual según el reloj de la misión en el servidor (los vencimientos usan ese reloj). */
export const ahoraServidor = () => Date.now() + useStore.getState().desfase
