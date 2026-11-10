// Horario del día, como el Onboard Short-Term Plan de la Estación Espacial: despertar, aseo y
// desayuno, conferencia de planificación, trabajo, comida, ejercicio, conferencia de la tarde,
// cena, llamada con la familia, rato libre y 8.5 h de sueño. Las duraciones salen de la ESA y la
// NASA (FUENTES en shared/ciencia.ts); las horas exactas de cada bloque son del juego (SUPUESTOS).
// En Marte el mismo horario se reparte en las 24 «horas marcianas» del sol de 24 h 39 min.
import { C } from './ciencia.js'
import { escenarioDe } from './escenarios.js'
import type { RoomState } from './types.js'

export type TipoBloque = 'sueno' | 'aseo' | 'conferencia' | 'comida' | 'trabajo' | 'ejercicio' | 'familia' | 'libre'

export interface Bloque {
  id: string
  /** Hora local de inicio y fin (0 a 24). */
  desde: number
  hasta: number
  nombre: string
  tipo: TipoBloque
}

export const HORARIO: Bloque[] = [
  { id: 'despertar', desde: 6, hasta: 7, nombre: 'Wake up, post-sleep: hygiene and breakfast', tipo: 'aseo' },
  { id: 'dpc', desde: 7, hasta: 7.25, nombre: 'Morning Daily Planning Conference', tipo: 'conferencia' },
  { id: 'trabajo1', desde: 7.25, hasta: 12, nombre: 'Work block', tipo: 'trabajo' },
  { id: 'almuerzo', desde: 12, hasta: 13, nombre: 'Lunch', tipo: 'comida' },
  { id: 'ejercicio', desde: 13, hasta: 15.5, nombre: 'Exercise, 2.5 h', tipo: 'ejercicio' },
  { id: 'trabajo2', desde: 15.5, hasta: 17.25, nombre: 'Work block', tipo: 'trabajo' },
  { id: 'edpc', desde: 17.25, hasta: 17.5, nombre: 'Evening Daily Planning Conference', tipo: 'conferencia' },
  { id: 'cena', desde: 17.5, hasta: 18.5, nombre: 'Dinner', tipo: 'comida' },
  { id: 'familia', desde: 18.5, hasta: 19, nombre: 'Family or private conference', tipo: 'familia' },
  { id: 'presueno', desde: 19, hasta: 21.5, nombre: 'Pre-sleep: hygiene and free time', tipo: 'libre' },
  { id: 'sueno', desde: 21.5, hasta: 30, nombre: 'Sleep, 8.5 h', tipo: 'sueno' },
]

/** Hora de acostarse y de levantarse. */
export const HORA_DORMIR = 21.5
export const HORA_DESPERTAR = 6
export const esHoraDeDormir = (h: number) => h >= HORA_DORMIR || h < HORA_DESPERTAR

/** Bloque del horario en la hora local `h`. */
export function bloqueDe(h: number): Bloque {
  const x = h < HORA_DESPERTAR ? h + 24 : h
  return HORARIO.find((b) => x >= b.desde && x < b.hasta) ?? HORARIO[HORARIO.length - 1]
}

export const enMarte = (room: RoomState) => room.tAterrizaje > 0 && room.t >= room.tAterrizaje
/** Segundos reales de un día de la misión: 24 h en el viaje, un sol en Marte. */
export const duracionDia = (room: RoomState) => (enMarte(room) ? C.SOL_S : 86400)

export const DIAS_SEMANA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const SABADO = 6

/**
 * Día de la semana (0 = domingo). En el viaje sale de la fecha real del despegue; en Marte la
 * tripulación sigue contando una semana de 7 soles desde el día del aterrizaje.
 */
export function diaSemana(room: RoomState): number {
  const base = new Date(Date.parse(escenarioDe(room.escenario).lanzamiento)).getUTCDay()
  // A bordo el día empieza a las 8:00 del despegue (ver server/sim/ambiente.ts).
  const diaViaje = (t: number) => Math.floor((Math.max(0, t) / 3600 + 8) / 24)
  if (!enMarte(room)) return (base + diaViaje(room.t)) % 7
  const sol = Math.max(1, room.ambiente.sol)
  return (base + diaViaje(room.tAterrizaje) + sol - 1) % 7
}

/** Segundo de misión en que empieza (a medianoche local) el próximo día `dia` de la semana; hoy si ya lo es. */
export function proximoDiaSemana(room: RoomState, dia: number): number {
  const largo = duracionDia(room)
  const inicioHoy = room.t - (room.ambiente.hora / 24) * largo
  const faltan = (dia - diaSemana(room) + 7) % 7
  return inicioHoy + faltan * largo
}

/** Texto corto de la hora local, «13:05». */
export const horaTexto = (h: number) => {
  const m = Math.floor((((h % 24) + 24) % 24) * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
