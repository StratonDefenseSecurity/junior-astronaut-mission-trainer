// Ambiente exterior: clima de Marte (datos de Curiosity), polvo (modelo propio) y clima
// espacial (eventos reales de 2024 según DONKI).
import { C } from '../../shared/ciencia.js'
import { escenarioDe } from '../../shared/escenarios.js'
import { HORA_ATERRIZAJE, SITE_BY_ID, type RoomState, type Zona } from '../../shared/types.js'
import { CLIMA_ESPACIAL } from '../datos/climaEspacial.js'
import { CLIMA_MARTE } from '../datos/climaMarte.js'
import { azar } from '../reloj.js'

const SOLES = CLIMA_MARTE.soles as number[][]
const FULGURACIONES = CLIMA_ESPACIAL.fulguraciones as [number, string, number, string][]
const PARTICULAS = CLIMA_ESPACIAL.particulas as [number, number, boolean, string, string][]
const DIAS_ANIO = 366

export const enSuperficie = (room: RoomState) => room.tAterrizaje > 0 && room.t >= room.tAterrizaje

/** Índice del registro de Curiosity cuya estación (Ls) es la más parecida a `ls`. */
export function indiceClimaParaLs(ls: number): number {
  let mejor = 0
  let distancia = 999
  for (let i = 0; i < SOLES.length; i++) {
    const d = Math.abs(((SOLES[i][4] - ls + 540) % 360) - 180)
    if (d < distancia) {
      distancia = d
      mejor = i
    }
  }
  return mejor
}

/** Segundos desde la medianoche local del sol del aterrizaje. */
const segundosLocales = (room: RoomState) => room.t - room.tAterrizaje + (HORA_ATERRIZAJE / 24) * C.SOL_S

/** Registro de Curiosity que corresponde al sol indicado (1 = día del aterrizaje). */
export function registroDelSol(room: RoomState, sol: number): number[] {
  return SOLES[(room.indiceClima + Math.max(0, sol - 1)) % SOLES.length]
}

/** Fracción de la potencia nominal que dan los paneles: sol sobre el horizonte y polvo. */
function factorSolar(horaMin: number, amanecer: number, atardecer: number): number {
  if (horaMin <= amanecer || horaMin >= atardecer) return 0
  return Math.sin((Math.PI * (horaMin - amanecer)) / (atardecer - amanecer))
}

/** La luz difusa hace que el polvo quite menos energía de la que quitaría solo el haz directo. */
export const transmisionPolvo = (tau: number) => Math.exp(-0.35 * tau)

/** Opacidad habitual según la estación: de Ls 180 a 360 es la temporada de polvo. */
const tauBase = (ls: number) => 0.45 + (ls >= 180 ? 0.35 * Math.sin(((ls - 180) / 180) * Math.PI) : 0)

/** Calcula el ambiente para el instante actual de la misión. */
export function actualizarAmbiente(room: RoomState): { nuevoSol: boolean } {
  const a = room.ambiente
  if (!enSuperficie(room)) {
    a.sol = 0
    a.hora = ((Math.max(0, room.t) / 3600 + 8) % 24 + 24) % 24
    a.tempExt = -270
    a.presion = 0
    a.tau = 0
    a.uv = 3
    a.flujoSolar = Math.round(C.IRRADIANCIA_TIERRA / (room.vuelo.distSol * room.vuelo.distSol))
    a.tormentaPolvo = false
    a.radiacion = room.fase === 'lanzamiento' ? 0.3 : C.GCR_CRUCERO_MSV_DIA
    return { nuevoSol: false }
  }
  const s = segundosLocales(room)
  const sol = Math.floor(s / C.SOL_S) + 1
  const nuevoSol = sol !== a.sol
  a.sol = sol
  a.hora = ((s % C.SOL_S) / C.SOL_S) * 24
  const [tmin, tmax, presion, uv, ls, amanecer, atardecer] = registroDelSol(room, sol)
  const sitio = SITE_BY_ID[room.sitio ?? 'gale'] ?? SITE_BY_ID.gale
  // La máxima llega hacia las 14 h y la mínima poco antes del amanecer.
  const fase = Math.cos(((a.hora - 14) / 24) * 2 * Math.PI)
  const curva = Math.pow((fase + 1) / 2, 1.6)
  a.tempExt = Math.round((tmin + (tmax - tmin) * curva + sitio.ajusteTemp) * 10) / 10
  a.presion = presion
  a.uv = uv
  a.solCuriosity = CLIMA_MARTE.primerSol + ((room.indiceClima + sol - 1) % SOLES.length)
  const base = tauBase(ls)
  if (a.tau <= 0) a.tau = Math.round(base * 100) / 100
  if (nuevoSol) {
    if (a.polvoSoles > 0) {
      a.polvoSoles -= 1
      if (a.polvoSoles === 0) a.tormentaPolvo = false
    }
    // El polvo en suspensión se disipa despacio cuando la tormenta termina.
    if (!a.tormentaPolvo) a.tau = Math.round((a.tau + (base - a.tau) * 0.45) * 100) / 100
  }
  const horaMin = a.hora * 60
  a.flujoSolar = Math.round(C.IRRADIANCIA_MARTE * factorSolar(horaMin, amanecer, atardecer) * transmisionPolvo(a.tau) * sitio.solar)
  a.radiacion = C.GCR_SUPERFICIE_MSV_DIA
  return { nuevoSol }
}

/** Potencia solar disponible ahora, en fracción de la nominal de los paneles (0 a ~1). */
export function fraccionSolar(room: RoomState): number {
  if (!enSuperficie(room)) return 1
  const [, , , , , amanecer, atardecer] = registroDelSol(room, room.ambiente.sol)
  const sitio = SITE_BY_ID[room.sitio ?? 'gale'] ?? SITE_BY_ID.gale
  // PANEL_KW está definido para cielo limpio (tau 0.5).
  const polvo = Math.min(1.05, transmisionPolvo(room.ambiente.tau) / transmisionPolvo(0.5))
  return factorSolar(room.ambiente.hora * 60, amanecer, atardecer) * polvo * sitio.solar
}

/** ¿Empieza hoy una tormenta de polvo? Se evalúa una vez por sol. */
export function sorteoTormentaPolvo(room: RoomState): { soles: number; tau: number } | null {
  const a = room.ambiente
  if (a.tormentaPolvo || a.sol < 2) return null
  const ls = registroDelSol(room, a.sol)[4]
  const prob = Math.min(0.5, (ls >= 180 ? 0.07 : 0.02) * escenarioDe(room.escenario).mod.polvo)
  if (azar(room) >= prob) return null
  const soles = 2 + Math.floor(azar(room) * 4)
  const tau = Math.round((2 + azar(room) * 2) * 10) / 10
  a.tormentaPolvo = true
  a.polvoSoles = soles
  a.tau = tau
  return { soles, tau }
}

// ---------- Clima espacial ----------

const diaMision = (room: RoomState) => room.diaLanzamiento + Math.max(0, room.t) / 86400
/** Día (contado desde el 1 de enero de 2024) del evento k, repitiendo el año si la misión lo supera. */
const diaEvento = (lista: { 0: number }[], k: number) => lista[k % lista.length][0] + DIAS_ANIO * Math.floor(k / lista.length)

export function iniciarClimaEspacial(room: RoomState) {
  const d = room.diaLanzamiento
  room.climaEspacial.fulguracion = Math.max(0, FULGURACIONES.findIndex((f) => f[0] >= d))
  room.climaEspacial.particulas = Math.max(0, PARTICULAS.findIndex((p) => p[0] >= d))
}

const fechaLegible = (iso: string) => {
  const [a, m, d] = iso.split('-')
  const meses = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${meses[Number(m) - 1]} ${Number(d)}, ${a}`
}

export interface EventoSolar {
  tipo: 'fulguracion' | 'particulas'
  id: string
  fecha: string
  clase?: string
  region?: number
  /** mSv por día en espacio abierto sin blindaje (estimación del juego). */
  tasa?: number
  horas?: number
  fuerte?: boolean
}

/** Devuelve los eventos reales de 2024 que tocan desde el último paso. */
export function eventosSolaresPendientes(room: RoomState): EventoSolar[] {
  if (room.t < 0) return []
  const hoy = diaMision(room)
  const salida: EventoSolar[] = []
  const ce = room.climaEspacial
  for (let guarda = 0; guarda < 20 && diaEvento(FULGURACIONES, ce.fulguracion) <= hoy; guarda++) {
    const f = FULGURACIONES[ce.fulguracion % FULGURACIONES.length]
    ce.fulguracion += 1
    const dia = Math.floor(f[0]) - 1
    const fecha = new Date(Date.UTC(CLIMA_ESPACIAL.anio, 0, 1 + dia)).toISOString().slice(0, 10)
    salida.push({ tipo: 'fulguracion', id: f[3], fecha: fechaLegible(fecha), clase: f[1], region: f[2] })
  }
  for (let guarda = 0; guarda < 20 && diaEvento(PARTICULAS, ce.particulas) <= hoy; guarda++) {
    const p = PARTICULAS[ce.particulas % PARTICULAS.length]
    ce.particulas += 1
    const registros = Math.min(9, p[1])
    salida.push({
      tipo: 'particulas',
      id: p[3],
      fecha: fechaLegible(p[4]),
      tasa: (p[2] ? 8 : 3) + 2.5 * registros,
      horas: 12 + 2 * registros,
      fuerte: registros >= 6,
    })
  }
  return salida
}

/** Dosis que recibe un tripulante ahora mismo, en mSv por día. */
export function tasaDeDosis(room: RoomState, zona: Zona, enRefugio: boolean): number {
  const superficie = enSuperficie(room)
  const capas = room.blindaje
  let gcr = superficie ? C.GCR_SUPERFICIE_MSV_DIA : room.fase === 'lanzamiento' ? 0.3 : C.GCR_CRUCERO_MSV_DIA
  // Los rayos cósmicos casi no se frenan con blindaje; una pared gruesa quita un poco.
  if (zona === 'nave') gcr *= superficie ? 0.85 : 1
  if (enRefugio) gcr *= 1 - 0.1 * capas
  gcr *= escenarioDe(room.escenario).mod.gcr
  let total = gcr
  const ts = room.ambiente.tormentaSolar
  if (ts) {
    // La atmósfera de Marte frena buena parte de las partículas solares.
    const atmosfera = superficie ? 0.15 : 1
    const factor = zona === 'exterior' ? 1 : enRefugio ? Math.max(0.07, 0.25 - 0.06 * capas) : 0.5
    total += ts.tasa * atmosfera * factor
  }
  return total
}
