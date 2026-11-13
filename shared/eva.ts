// Salidas al exterior como en la ISS y en Apollo: un plan con compañero, objetivos y horario, la
// lista de comprobación en el puño del traje, la cuenta atrás de los consumibles (oxígeno,
// batería y absorbente de CO2) y la regla de volver con reserva. Fuentes en shared/ciencia.ts.
import { C } from './ciencia.js'
import { cargaTraje } from './noche.js'
import type { Player, RoomState } from './types.js'

/** Minutos que le quedan al traje de cada consumible, y el que se acaba antes. Con la sala, la batería cuenta luces y calefacción. */
export function consumiblesTraje(j: Player, room?: RoomState) {
  const o2KgH = C.METABOLISMO_W.eva * C.O2_KG_POR_J * 3600 + 0.004 + (j.trajeFuga ?? 0)
  const o2 = (j.trajeO2 / o2KgH) * 60
  const bateria = (j.trajeBateria * C.TRAJE_BATERIA_H * 60) / (room ? cargaTraje(room, j).total : 1)
  const co2 = (j.trajeCO2 ?? 1) * C.TRAJE_CO2_H * 60
  const min = Math.min(o2, bateria, co2)
  const limitante = min === o2 ? 'oxygen' : min === bateria ? 'battery' : 'CO2 absorbent'
  return { o2, bateria, co2, min, limitante }
}

/** Minutos de consumibles con los que hay que darse la vuelta: el camino de vuelta más la reserva. */
export const MIN_VUELTA = C.EVA_REGRESO_MIN + C.EVA_RESERVA_MIN

/** Minutos que lleva fuera en esta salida. */
export const minutosFuera = (room: RoomState, j: Player) => (j.eva ? Math.max(0, (room.t - j.eva.inicio) / 60) : 0)

/**
 * Minutos hasta la hora de volver: lo que antes llegue, el fin de la ventana planificada de
 * 6.5 h o los consumibles justos para volver con la reserva.
 */
export function minutosHastaVolver(room: RoomState, j: Player): number {
  const ventana = C.EVA_VENTANA_H * 60 - minutosFuera(room, j)
  return Math.min(ventana, consumiblesTraje(j, room).min - MIN_VUELTA)
}

/** Compañero para una salida: alguien que ya esté fuera o saliendo, o si no quien quede dentro al radio. */
export function companeroEva(room: RoomState, pid: string): Player | null {
  const otros = room.jugadores.filter((o) => o.id !== pid && o.rol && o.incapacitado <= 0)
  return (
    otros.find((o) => o.zona === 'exterior') ??
    otros.find((o) => {
      const e = room.procedimientos?.[`salida:${o.id}`]
      return e && !e.terminado && e.paso > 0
    }) ??
    otros[0] ??
    null
  )
}

/** Objetivo principal de la salida según lo que pide la misión ahora. */
export function objetivoEva(room: RoomState): string {
  if (room.fase === 'ensamblaje') return 'Base assembly tasks outside'
  if (room.mision.muestrasAnalizadas < room.mision.muestrasObjetivo) return 'Collect rock samples at the sample sites'
  return 'Inspect the hull, the panels and the antenna'
}
