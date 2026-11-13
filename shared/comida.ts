// Plan de comidas con energía real: lo que pide el estándar de NASA por persona y día, lo que da
// cada ración, el extra para quien sale con traje o está enfermo, y lo que la ración le hace al
// cuerpo (peso, fatiga y ánimo). Lo usan la simulación y la pantalla. Fuentes en shared/ciencia.ts.
import { C } from './ciencia.js'
import type { Player, RacionComida, RoomState } from './types.js'

export const FACTOR_RACION: Record<RacionComida, number> = { normal: 1, ahorro: 0.8, estricto: 0.6 }

/** Juego: quien está enfermo o lesionado necesita un 10% más. */
export const EXTRA_ENFERMO = 0.1

/** El plan incluye el extra para salidas y enfermos (por defecto sí, como pide NASA para las salidas). */
export const conExtras = (room: RoomState) => room.ajustes.comidaExtra !== false

export const enfermo = (j: Player) => Boolean(j.dolencia) || j.incapacitado > 0

/** kcal por día que necesita: el promedio del estándar de NASA, más si está enfermo. Cada hora de salida suma 200 aparte. */
export const necesidadKcal = (j: Player) => Math.round(C.MENU_KCAL_DIA * (1 + (enfermo(j) ? EXTRA_ENFERMO : 0)))

/** kcal por día que le da el plan, sin contar el extra por hora de salida. */
export function planKcal(room: RoomState, j: Player, nivel: RacionComida = room.ajustes.racionComida, extras = conExtras(room)): number {
  return Math.round(C.MENU_KCAL_DIA * (FACTOR_RACION[nivel] + (extras && enfermo(j) ? EXTRA_ENFERMO : 0)))
}

/** kcal de más al día que come ahora mismo por estar fuera o enfermo (ritmo para la simulación). */
export function extraKcalDia(room: RoomState, j: Player): number {
  if (!conExtras(room)) return 0
  return (j.zona === 'exterior' ? C.EVA_KCAL_H * 24 : 0) + (enfermo(j) ? C.MENU_KCAL_DIA * EXTRA_ENFERMO : 0)
}

/** kg de peso perdidos: la energía que le falta al cuerpo a 7 700 kcal por kg. */
export const kgPerdidos = (j: Player) => j.deficitKcal / C.KCAL_POR_KG_PESO
export const pesoKg = (j: Player) => C.MASA_CORPORAL_KG - kgPerdidos(j)
export const pctPerdido = (j: Player) => (kgPerdidos(j) / C.MASA_CORPORAL_KG) * 100

/** kg por semana al ritmo de un plan (negativo = adelgaza). */
export const kgSemana = (room: RoomState, j: Player, nivel?: RacionComida, extras?: boolean) =>
  ((planKcal(room, j, nivel, extras) - necesidadKcal(j)) * 7) / C.KCAL_POR_KG_PESO

/** Juego: la fatiga sube un 6% más rápido por cada 1% de peso perdido, hasta un 60%. */
export const factorFatigaComida = (j: Player) => 1 + Math.min(0.6, 0.06 * pctPerdido(j))

/** Ánimo según el peso perdido y la ración (juego, a partir del estudio de Minnesota). */
export function animo(room: RoomState, j: Player): { texto: string; tono: '' | 'warn' | 'bad' } {
  const p = pctPerdido(j)
  if (p >= 10) return { texto: 'Low mood', tono: 'bad' }
  if (p >= 5) return { texto: 'Withdrawn', tono: 'warn' }
  if (p >= 2 || FACTOR_RACION[room.ajustes.racionComida] < 1) return { texto: 'Thinks about food a lot', tono: 'warn' }
  return { texto: 'Good', tono: '' }
}
