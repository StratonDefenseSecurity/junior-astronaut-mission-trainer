// Utilidades comunes de la lógica del juego.
import type { LogEntry, Player, Role, RoomState, SistemaEstado, SistemaId } from '../shared/types.js'
import { azar } from './reloj.js'

export const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
/** Acerca `actual` a `objetivo` con una constante de tiempo `tau` (mismas unidades que dt). */
export const hacia = (actual: number, objetivo: number, dt: number, tau: number) =>
  actual + (objetivo - actual) * (1 - Math.exp(-dt / tau))

export const rid = (room: RoomState) =>
  Math.floor(azar(room) * 0xffffffff).toString(36) + Math.floor(azar(room) * 0xffffffff).toString(36)

export function log(room: RoomState, texto: string, tipo: LogEntry['tipo'] = 'info') {
  room.registro.push({ t: Math.round(room.t), fase: room.fase, texto, tipo })
  if (room.registro.length > 60) room.registro.shift()
}

export const jugador = (room: RoomState, id: string): Player | undefined => room.jugadores.find((j) => j.id === id)
/** Tripulación: quienes tienen rol, estén o no conectados (el cuerpo sigue a bordo). */
export const tripulacion = (room: RoomState) => room.jugadores.filter((j) => j.rol)
export const conRol = (room: RoomState, rol: Role) => room.jugadores.filter((j) => j.rol === rol && j.conectado)
export const rolPresente = (room: RoomState, rol: Role) => conRol(room, rol).length > 0
export const conectados = (room: RoomState) => room.jugadores.filter((j) => j.conectado && j.rol)
/** Quienes están en la sala ahora, tengan rol o no (antes del lanzamiento). */
export const presentes = (room: RoomState) => room.jugadores.filter((j) => j.conectado)
export const sis = (room: RoomState, id: SistemaId): SistemaEstado => room.sistemas.find((s) => s.id === id)!

/**
 * ¿Puede este jugador hacer algo reservado a ciertos roles? Sí, si tiene uno de ellos, o si
 * ninguno de esos roles está conectado (para que las tripulaciones pequeñas puedan jugar).
 */
export function puedeActuar(room: RoomState, j: Player, roles: Role[]): boolean {
  if (!j.rol) return false
  return roles.includes(j.rol) || !roles.some((r) => rolPresente(room, r))
}

/** Rendimiento de un equipo según su integridad: pleno hasta el 50% y decreciente por debajo. */
export const rendimiento = (integridad: number) => (integridad >= 50 ? 1 : Math.max(0, integridad) / 50)

export const hayEmergencia = (room: RoomState) => room.emergencias.some((e) => e.estado === 'activa')
export const nombreRoles = (roles: Role[], abreviado: Record<Role, { corto: string }>) => roles.map((r) => abreviado[r].corto).join(' + ')
