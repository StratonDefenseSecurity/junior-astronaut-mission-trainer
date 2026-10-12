import { io, type Socket } from 'socket.io-client'
import { useStore } from './store'
import type { RoomState } from '@shared/types'

let socket: Socket | null = null

export function conectar(token: string) {
  if (socket) socket.disconnect()
  socket = io({ auth: { token }, autoConnect: true })
  socket.on('connect', () => useStore.getState().setConectado(true))
  socket.on('disconnect', () => useStore.getState().setConectado(false))
  socket.on('connect_error', (e) => {
    useStore.getState().setConectado(false)
    if (e.message === 'no autorizado') useStore.getState().setAuth(null, null)
  })
  socket.on('sala:estado', (sala: RoomState | null) => useStore.getState().setSala(sala))
  socket.on('error:accion', (msg: string) => useStore.getState().toast(msg, 'error'))
  return socket
}

export function desconectar() {
  socket?.disconnect()
  socket = null
}

export function emit(evento: string, datos?: unknown) {
  if (!socket) return
  socket.emit(evento, datos)
}

export const api = {
  crearSala: (modo: 'comandante' | 'votacion') => emit('sala:crear', { modo }),
  unirse: (codigo: string) => emit('sala:unirse', { codigo }),
  salir: () => emit('sala:salir'),
  elegirRol: (rol: string | null) => emit('lobby:rol', { rol }),
  iniciar: () => emit('lobby:iniciar'),
  cargamento: (patch: Record<string, number>) => emit('contexto:cargamento', patch),
  lanzar: () => emit('contexto:lanzar'),
  confirmarPaso: (paso: number) => emit('ensamblaje:confirmar', { paso }),
  proponerUbicacion: (sitioId: string) => emit('ensamblaje:ubicacion', { sitioId }),
  accion: (id: string, payload?: Record<string, unknown>) => emit('accion', { id, payload }),
  votar: (id: string, aprueba: boolean) => emit('propuesta:votar', { id, aprueba }),
  elegirAlternativa: (id: string, altId: string) => emit('emergencia:elegir', { id, altId }),
  pedirAyuda: (paraRol: string, motivo: string) => emit('ayuda:pedir', { paraRol, motivo }),
  irAyudar: (jugadorId: string) => emit('ayuda:ir', { jugadorId }),
  chat: (texto: string) => emit('chat:enviar', { texto }),
  bot: (texto: string) => emit('bot:preguntar', { texto }),
}

export async function httpAuth(ruta: 'registro' | 'ingresar', usuario: string, clave: string) {
  const r = await fetch(`/api/${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, clave }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error ?? 'Error')
  return data as { token: string; usuario: { id: string; nombre: string } }
}
