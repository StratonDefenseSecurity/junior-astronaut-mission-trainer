// Reloj y azar de la simulación.
//
// El servidor no tiene un proceso siempre encendido (corre como función en Vercel), así que
// el estado de una sala debe poder reconstruirse igual en cualquier instancia a partir de la
// última copia guardada. Para eso todo el juego lee la hora de aquí (no de Date.now) y el azar
// sale de una semilla guardada en la propia sala.
import type { RoomState } from '../shared/types.js'

let instante = Date.now()
export const ahora = () => instante
export const fijarAhora = (t: number) => {
  instante = t
}

/** Número pseudoaleatorio en [0, 1) que avanza la semilla de la sala (mulberry32). */
export function azar(room: RoomState): number {
  room.rng = (room.rng + 0x6d2b79f5) | 0
  let t = room.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function semilla(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619)
  return (h ^ Date.now()) | 0
}

// Jugadores que se han movido hace poco. Lo informa la capa de red antes de avanzar la
// simulación; sirve para no dar por dormido a quien está caminando por la nave de noche.
let enMovimiento: ReadonlySet<string> = new Set()
export const movidos = () => enMovimiento
export const fijarMovidos = (ids: ReadonlySet<string>) => {
  enMovimiento = ids
}
