// Telemetría de vuelo: ascenso, crucero Tierra–Marte y descenso.
// Son perfiles aproximados con órdenes de magnitud reales, no una integración orbital.
import { C, distanciaTierraAlLlegar } from '../../shared/ciencia.js'
import { DESCENSO_S, TRANSITO_INICIO_S, type RoomState } from '../../shared/types.js'

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

/** Entrada, descenso y aterrizaje: los "siete minutos de terror". */
export function telemetriaDescenso(room: RoomState) {
  const v = room.vuelo
  const td = Math.max(0, room.t - room.tFase)
  if (td < 255) {
    const x = td / 255
    v.etapa = td > 60 && td < 130 ? 'Escudo térmico al máximo' : 'Entrada atmosférica'
    v.altitud = mezcla(125, 11, Math.pow(x, 0.8))
    v.velocidad = mezcla(5.8, 0.45, Math.pow(x, 1.6))
    // La frenada más fuerte llega hacia el minuto y medio.
    v.g = 0.4 + 4.3 * Math.exp(-Math.pow((td - 95) / 45, 2))
  } else if (td < 360) {
    const x = (td - 255) / 105
    v.etapa = 'Paracaídas supersónico'
    v.altitud = mezcla(11, 1.6, x)
    v.velocidad = mezcla(0.45, 0.08, Math.pow(x, 0.6))
    v.g = 1.1
  } else if (td < DESCENSO_S) {
    const x = (td - 360) / (DESCENSO_S - 360)
    v.etapa = 'Descenso propulsado'
    v.altitud = mezcla(1.6, 0, x)
    v.velocidad = mezcla(0.08, 0, x)
    v.g = 0.7
    room.rec.propelente = Math.max(0, Math.round(room.rec.propelente - 0.6))
  } else {
    v.etapa = 'Contacto'
    v.altitud = 0
    v.velocidad = 0
    v.g = C.GRAVEDAD_MARTE / C.GRAVEDAD_TIERRA
  }
  v.altitud = Math.round(v.altitud * 100) / 100
  v.velocidad = Math.round(v.velocidad * 100) / 100
  v.g = Math.round(v.g * 100) / 100
}

/** Aceleración que siente la tripulación ahora, en g. */
export function gActual(room: RoomState): number {
  if (room.fase === 'lanzamiento' || (room.fase === 'llegada' && room.subfase === 'descenso')) return room.vuelo.g
  if (room.fase === 'transito' || room.fase === 'llegada') return 0
  if (room.fase === 'ensamblaje' || room.fase === 'base' || room.fase === 'fin') return C.GRAVEDAD_MARTE / C.GRAVEDAD_TIERRA
  return 1
}
