// Telemetría de vuelo: ascenso, crucero Tierra–Marte y descenso.
// El ascenso sigue el de Artemis I y el descenso el de Perseverance; el crucero es un perfil
// aproximado con órdenes de magnitud reales, no una integración orbital.
import { C, distanciaTierraAlLlegar } from '../../shared/ciencia.js'
import { ASCENSO, altitudAscenso, etapaAscenso, gAscenso, propelenteCentral, velocidadAscenso } from '../../shared/ascenso.js'
import { EDL, estadoEDL } from '../../shared/edl.js'
import { TRANSITO_INICIO_S, type RoomState } from '../../shared/types.js'

/**
 * Ascenso: el perfil real de Artemis I (shared/ascenso.ts), con su altitud, su velocidad respecto
 * de la Tierra, la aceleración que se siente y el nombre de cada etapa. El combustible en pantalla
 * es el de la etapa central hasta que se separa; después, el de la etapa superior (ICPS), aún llena.
 */
export function telemetriaAscenso(room: RoomState) {
  const v = room.vuelo
  const t = room.t
  v.etapa = etapaAscenso(t)
  v.altitud = Math.round(altitudAscenso(t) * 10) / 10
  v.velocidad = Math.round(velocidadAscenso(t) * 100) / 100
  v.g = Math.round(gAscenso(t) * 100) / 100
  room.rec.propelente = t >= ASCENSO.separacionCentral ? 100 : Math.round(100 * propelenteCentral(t))
}

/** Crucero: distancias y retardo de las comunicaciones. */
export function telemetriaCrucero(room: RoomState) {
  const v = room.vuelo
  const duracion = room.mision.diasTransito * 86400
  const p = Math.min(1, Math.max(0, (room.t - TRANSITO_INICIO_S) / duracion))
  v.progreso = p
  v.etapa = p < 0.02 ? 'Trans-Mars injection' : p > 0.97 ? 'Mars approach' : 'Cruise'
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
