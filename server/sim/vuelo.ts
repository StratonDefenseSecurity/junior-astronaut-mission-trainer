// Telemetría de vuelo: ascenso, crucero Tierra–Marte y descenso.
// Son perfiles aproximados con órdenes de magnitud reales, no una integración orbital.
import { C, distanciaTierraAlLlegar } from '../../shared/ciencia.js'
import { EDL, estadoEDL } from '../../shared/edl.js'
import { TRANSITO_INICIO_S, type RoomState } from '../../shared/types.js'

const mezcla = (a: number, b: number, x: number) => a + (b - a) * Math.min(1, Math.max(0, x))

/** Ascenso hasta la órbita en unos 8 minutos y medio. */
export function telemetriaAscenso(room: RoomState) {
  const v = room.vuelo
  const t = room.t
  if (t < 0) {
    Object.assign(v, { altitud: 0, velocidad: 0, g: 1, etapa: 'Cuenta regresiva' })
    return
  }
  if (t < 150) {
    const x = t / 150
    v.etapa = t > 60 && t < 85 ? 'Máxima presión dinámica' : 'Primera etapa'
    v.g = 1.2 + 2.3 * Math.pow(x, 1.4)
    v.velocidad = 2.4 * Math.pow(x, 1.7)
    v.altitud = 65 * Math.pow(x, 2)
    room.rec.propelente = Math.round(100 - 100 * x)
  } else if (t < 160) {
    v.etapa = 'Separación de etapas'
    v.g = 0.1
    v.velocidad = 2.4
    v.altitud = mezcla(65, 78, (t - 150) / 10)
    room.rec.propelente = 100
  } else {
    const x = (t - 160) / (TRANSITO_INICIO_S - 160)
    v.etapa = 'Segunda etapa'
    v.g = 0.8 + 2.6 * Math.pow(x, 1.2)
    v.velocidad = mezcla(2.4, 7.8, Math.pow(x, 1.15))
    v.altitud = mezcla(78, 200, Math.pow(x, 0.7))
    room.rec.propelente = Math.round(100 - 88 * x)
  }
  v.velocidad = Math.round(v.velocidad * 100) / 100
  v.altitud = Math.round(v.altitud * 10) / 10
  v.g = Math.round(v.g * 100) / 100
}

/** Crucero: distancias y retardo de las comunicaciones. */
export function telemetriaCrucero(room: RoomState) {
  const v = room.vuelo
  const duracion = room.mision.diasTransito * 86400
  const p = Math.min(1, Math.max(0, (room.t - TRANSITO_INICIO_S) / duracion))
  v.progreso = p
  v.etapa = p < 0.02 ? 'Inyección hacia Marte' : p > 0.97 ? 'Aproximación a Marte' : 'Crucero'
  v.g = 0
  v.altitud = 0
  v.distSol = Math.round((1 + (C.DISTANCIA_SOL_MARTE_UA - 1) * p) * 1000) / 1000
  // Al llegar, la Tierra ya se ha adelantado en su órbita: quedan unos 250 millones de km.
  const finalTierra = distanciaTierraAlLlegar(room.mision.diasTransito)
  v.distTierra = Math.round(finalTierra * Math.pow(p, 1.5) * 100) / 100
  v.distMarte = Math.round(220 * Math.pow(1 - p, 1.25) * 100) / 100
  v.velocidad = Math.round((32.7 - 10.5 * p) * 10) / 10
  v.retardo = Math.round((v.distTierra * 1e6) / C.VELOCIDAD_LUZ_KM_S)
}

/**
 * Entrada, descenso y aterrizaje: los "siete minutos de terror", con la trayectoria reconstruida
 * de Perseverance (shared/edl.ts). El descenso empieza en la entrada atmosférica.
 */
export function telemetriaDescenso(room: RoomState) {
  const v = room.vuelo
  const td = Math.max(0, room.t - room.tFase)
  const e = estadoEDL(td)
  v.etapa = e.etapa
  v.altitud = Math.round(e.altitud * 100) / 100
  // Con cuatro decimales en km/s se ve la velocidad final de la grúa celeste, menos de 3 km/h.
  v.velocidad = Math.round(e.velocidad * 10000) / 10000
  v.g = Math.round(e.g * 100) / 100
  if (td >= EDL.cubierta && td < EDL.contacto) room.rec.propelente = Math.max(0, Math.round(room.rec.propelente - 0.6))
}

/** Aceleración que siente la tripulación ahora, en g. */
export function gActual(room: RoomState): number {
  if (room.fase === 'lanzamiento' || (room.fase === 'llegada' && room.subfase === 'descenso')) return room.vuelo.g
  if (room.fase === 'transito' || room.fase === 'llegada') return 0
  if (room.fase === 'ensamblaje' || room.fase === 'base' || room.fase === 'fin') return C.GRAVEDAD_MARTE / C.GRAVEDAD_TIERRA
  return 1
}
