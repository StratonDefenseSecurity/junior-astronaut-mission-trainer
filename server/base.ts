// Utilidades comunes de la lógica del juego.
import type { LogEntry, Player, Role, RoomState, SistemaEstado, SistemaId } from '../shared/types.js'
import { ahora, azar } from './reloj.js'

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

/** Tiempo real que alguien despierto no vuelve a dormirse solo (game value, ver SUPUESTOS). */
export const DESPIERTO_MS = 90_000

/** Despierta a `j` (se levantó, lo despertaron o empezó a trabajar). No sirve si está fuera de servicio. */
export function despertarJugador(room: RoomState, j: Player, ahoraMs: number) {
  if (j.manual === 'sueno') j.manual = null
  if (j.actividad === 'sueno' && j.incapacitado <= 0) j.actividad = room.ambiente.hora >= 8 && room.ambiente.hora < 18 ? 'trabajo' : 'reposo'
  delete j.suenoAvisoMs
  delete j.suenoAvisoT
  j.despiertoMs = ahoraMs + DESPIERTO_MS
  j.despiertoT = room.t
}

/**
 * Lleva a `j` al refugio de tormentas. Si estaba fuera, la tripulación lo mete por la esclusa:
 * su salida o entrada a medias se cancela, así no queda en un paso sin salida.
 */
export function meterEnRefugio(room: RoomState, j: Player) {
  if (j.zona === 'exterior') {
    j.zona = 'nave'
    log(room, `${j.nombre} came back in through the Airlock for the shelter order.`)
  }
  if (room.procedimientos) {
    delete room.procedimientos[`entrada:${j.id}`]
    delete room.procedimientos[`salida:${j.id}`]
  }
  j.enRefugio = true
  // En el refugio se puede dormir; el ejercicio no.
  if (j.manual !== 'sueno') j.manual = null
}

/**
 * Un mensaje por radio desde la Tierra: llega cuando la luz ha recorrido la distancia (el retardo
 * del momento, o `demora` segundos si es una respuesta de ida y vuelta). `chat` = quién firma en el chat.
 */
export function enviarRadio(room: RoomState, texto: string, demora?: number, chat?: string) {
  const llega = room.t + Math.max(0, Math.round(demora ?? room.vuelo.retardo ?? 0))
  ;(room.radio ??= []).push({ llega, texto, ...(chat ? { chat } : {}) })
  entregarRadio(room)
}

/** Entrega los mensajes que ya llegaron. En conjunción solar esperan a que vuelva el enlace. */
export function entregarRadio(room: RoomState) {
  if (!room.radio?.length || room.vuelo.enlace === 'conjuncion') return
  const quedan: NonNullable<RoomState['radio']> = []
  for (const m of room.radio) {
    if (room.t < m.llega) {
      quedan.push(m)
      continue
    }
    log(room, m.texto, 'radio')
    if (m.chat) {
      room.chat.push({ id: rid(room), de: m.chat, texto: m.texto.replace(/^Mission Control: /, ''), t: ahora(), bot: false })
      if (room.chat.length > 40) room.chat.splice(0, room.chat.length - 40)
    }
  }
  room.radio = quedan
}
