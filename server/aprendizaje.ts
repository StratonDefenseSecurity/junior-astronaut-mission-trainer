// Aprendizaje: dificultad, misión de demostración, pistas del centro de control y el informe
// final ("qué aprendimos") que se calcula al terminar y se guarda en la sala.
import { C } from '../shared/ciencia.js'
import { DEMO, DIFICULTAD_BY_ID, bitacoraVacia, dificultadDe, habilidadDe, type Bitacora, type Dificultad, type Informe, type ParteInforme } from '../shared/informe.js'
import { DEBERES } from '../shared/procedimientos.js'
import { ESCALA_MAXIMA, type Nota, type Player, type RoomState } from '../shared/types.js'
import { log, tripulacion } from './base.js'
import { ahora } from './reloj.js'

const bit = (room: RoomState): Bitacora => (room.bitacora ??= bitacoraVacia())

// ---------- Sala de espera ----------

export function fijarDificultad(room: RoomState, id: string, dificultad: string, demo: boolean): string | null {
  if (room.fase !== 'lobby') return 'The difficulty is chosen before the mission starts.'
  if (id !== room.hostId) return 'Only the host chooses the difficulty.'
  if (!DIFICULTAD_BY_ID[dificultad as Dificultad]) return 'Invalid difficulty.'
  room.dificultad = dificultad as Dificultad
  room.demo = demo
  return null
}

/** Al empezar: la demostración usa el viaje rápido (real) y una estancia corta. */
export function prepararDemo(room: RoomState) {
  if (room.demo) room.trayectoria = DEMO.trayectoria
}

// ---------- Efectos de la dificultad ----------

export const factorAverias = (room: RoomState) => dificultadDe(room).averias
export const factorPlazo = (room: RoomState) => dificultadDe(room).plazo
export const factorEscasez = (room: RoomState) => dificultadDe(room).escasez

// ---------- Anotaciones ----------

/** Un paso de procedimiento hecho por `j` con calidad 0 a 1. */
export function anotarPaso(room: RoomState, j: Player, procId: string, calidad: number) {
  const b = bit(room)
  b.pasos++
  b.calidad += calidad
  const p = (b.porJugador[j.id] ??= { p: 0, c: 0, h: [] })
  p.p++
  p.c += calidad
  const h = habilidadDe(procId)
  if (!p.h.includes(h)) p.h.push(h)
}

/** Una decisión valorada (emergencia o propuesta). */
export function anotarDecision(room: RoomState, tipo: string, titulo: string, nota: Nota, porque: string, decisores: string[]) {
  const b = bit(room)
  b.notas[nota]++
  if (tipo === 'escasez') b.escaseces++
  for (const id of decisores) {
    const p = (b.porJugador[id] ??= { p: 0, c: 0, h: [] })
    if (!p.h.includes('decision')) p.h.push('decision')
  }
  const d = { t: Math.round(room.t), tipo, titulo, nota, porque: porque.slice(0, 160) }
  if (b.decisiones.length < 16) b.decisiones.push(d)
  else if (nota !== 'aceptable') {
    // Lleno: deja sitio quitando la decisión aceptable más antigua.
    const k = b.decisiones.findIndex((x) => x.nota === 'aceptable')
    if (k >= 0) {
      b.decisiones.splice(k, 1)
      b.decisiones.push(d)
    }
  }
}

// ---------- Cada paso de simulación ----------

/** Pistas que da el centro de control para cada punto crítico, según la dificultad. */
const PISTAS: [RegExp, string][] = [
  [/CO2/, 'High CO2. Swap a LiOH cartridge or repair the CO2 Scrubber at Life Support.'],
  [/oxygen: .*kPa|^Air for/, 'Oxygen is short. Check the Oxygen Generator and the O2 tanks.'],
  [/^Water for/, 'Water is short. Propose saving water and keep the Water Recycler working.'],
  [/^Food for/, 'Food is short. Resources & Logistics can propose a smaller ration.'],
  [/broken| at \d+%$/, 'A system is failing. Repair it with a spare part at its station.'],
  [/Pressure leak/, 'There is a pressure leak. Seal it step by step at Life Support.'],
  [/No power|Batteries/, 'Power is low. Set the power priority to life support and turn off what is not needed.'],
  [/Dust on the panels/, 'Dust covers the panels. Someone can go out and clean them.'],
  [/Solar storm/, 'A solar storm is on. The commander can order the crew into the Storm Shelter.'],
  [/dehydrated/, 'Someone is dehydrated. The Flight Surgeon can check them in the Medical Bay.'],
  [/exhausted/, 'Someone is exhausted. Let them sleep.'],
]

export function pasoAprendizaje(room: RoomState) {
  const b = bit(room)
  b.retardoMax = Math.max(b.retardoMax, Math.round(room.vuelo.retardo || 0))
  // Demostración: cada fase empieza a la escala más alta permitida. El comandante puede bajarla.
  if (room.demo && b.faseDemo !== room.fase && ['transito', 'ensamblaje', 'base'].includes(room.fase)) {
    b.faseDemo = room.fase
    room.escalaDeseada = ESCALA_MAXIMA[room.fase]
  }
  const cada = dificultadDe(room).pistaMs
  if (cada === null || !room.puntosCriticos.length) return
  if (ahora() - (b.pistaMs ?? -Infinity) < cada) return
  for (const punto of room.puntosCriticos) {
    const pista = PISTAS.find(([re]) => re.test(punto))
    if (!pista) continue
    b.pistaMs = ahora()
    log(room, `Mission Control hint: ${pista[1]}`, 'info')
    return
  }
}

// ---------- Informe final ----------

const r = (v: number) => Math.round(v)
const limitar = (v: number, a: number, z: number) => Math.min(z, Math.max(a, v))

export function calcularInforme(room: RoomState) {
  const b = bit(room)
  const crew = tripulacion(room)
  const m = room.mision
  const muerto = crew.some((j) => j.vit.salud <= 0)
  const bajoLimite = crew.every((j) => j.vit.dosis < C.LIMITE_CARRERA_MSV)
  const saludMedia = crew.length ? crew.reduce((s, j) => s + Math.max(0, j.vit.salud), 0) / crew.length : 0

  const partes: ParteInforme[] = []
  // 1. Supervivencia y salud (25)
  const sup = muerto ? 0 : (saludMedia / 100) * 20 + (bajoLimite ? 5 : 0)
  partes.push({ id: 'salud', nombre: 'Survival and health', puntos: r(sup), max: 25, detalle: muerto ? 'A crew member died.' : `Average health ${r(saludMedia)}. ${bajoLimite ? 'Everyone stayed under' : 'Someone went over'} the ${C.LIMITE_CARRERA_MSV} mSv limit.` })
  // 2. Objetivo (20): muestras y, si la misión lo pide, agua
  const fm = m.muestrasObjetivo ? Math.min(1, m.muestrasAnalizadas / m.muestrasObjetivo) : 0
  const fa = m.aguaObjetivo ? Math.min(1, (m.aguaExtraida ?? 0) / m.aguaObjetivo) : null
  const obj = fa === null ? fm * 20 : fm * 10 + fa * 10
  partes.push({ id: 'objetivo', nombre: 'Objective', puntos: r(obj), max: 20, detalle: `${m.muestrasAnalizadas} of ${m.muestrasObjetivo} samples${fa === null ? '' : `, ${r(m.aguaExtraida ?? 0)} of ${m.aguaObjetivo} kg of water`}.` })
  // 3. Recursos (15)
  const agotado = room.rec.o2 <= 0 || room.rec.agua <= 0 || room.rec.comida <= 0
  const rec = limitar(15 - b.escaseces * 4 - (agotado ? 5 : 0) - (room.energia.cortes.length ? 3 : 0), 0, 15)
  partes.push({ id: 'recursos', nombre: 'Resource management', puntos: r(rec), max: 15, detalle: `${b.escaseces} shortage alert${b.escaseces === 1 ? '' : 's'}.${agotado ? ' A reserve ran out.' : ''}${room.energia.cortes.length ? ' Power cuts at the end.' : ''}` })
  // 4. Decisiones (15)
  const n = b.notas.buena + b.notas.aceptable + b.notas.riesgosa
  const dec = n ? ((b.notas.buena + b.notas.aceptable * 0.6) / n) * 15 : 9
  partes.push({ id: 'decisiones', nombre: 'Decision quality', puntos: r(dec), max: 15, detalle: n ? `${b.notas.buena} good, ${b.notas.aceptable} acceptable, ${b.notas.riesgosa} risky.` : 'No rated decisions.' })
  // 5. Procedimientos (15)
  const calidad = b.pasos ? b.calidad / b.pasos : 0
  partes.push({ id: 'procedimientos', nombre: 'Procedure quality', puntos: r(calidad * 15), max: 15, detalle: b.pasos ? `${b.pasos} steps, ${r(calidad * 100)}% done as an expert would.` : 'No procedure steps.' })
  // 6. Trabajo en equipo y deberes (10)
  const deberes = Object.values(room.deberes ?? {})
  const hechos = deberes.reduce((s, d) => s + d.hechos, 0)
  const saltados = deberes.reduce((s, d) => s + d.saltados, 0)
  const conAporte = crew.filter((j) => (j.aportes ?? 0) > 0).length
  const equipo = (hechos + saltados ? (hechos / (hechos + saltados)) * 6 : 3) + (crew.length ? (conAporte / crew.length) * 4 : 0)
  partes.push({ id: 'equipo', nombre: 'Teamwork and duties', puntos: r(equipo), max: 10, detalle: `${hechos} duties done, ${saltados} skipped. ${conAporte} of ${crew.length} crew members contributed.` })
  const puntos = limitar(partes.reduce((s, p) => s + p.puntos, 0), 0, 100)

  // Decisiones clave: las arriesgadas y las buenas primero, como mucho 8, en orden de tiempo.
  const peso: Record<Nota, number> = { riesgosa: 0, buena: 1, aceptable: 2 }
  const decisiones = [...b.decisiones]
    .sort((x, y) => peso[x.nota] - peso[y.nota] || x.t - y.t)
    .slice(0, 8)
    .sort((x, y) => x.t - y.t)

  const personas = crew.map((j) => {
    const p = b.porJugador[j.id] ?? { p: 0, c: 0, h: [] }
    return { id: j.id, nombre: j.nombre, rol: j.rol, aportes: j.aportes ?? 0, pasos: p.p, calidad: p.p ? r((p.c / p.p) * 100) : null, deberes: deberesDe(room, j), habilidades: p.h.slice(0, 8) }
  })

  const llego = room.tAterrizaje > 0
  const soles = llego ? Math.max(0, room.ambiente.sol - 1) : 0
  const salieron = Object.values(b.porJugador).some((p) => p.h.includes('eva'))
  const radiacionMal = b.decisiones.some((d) => (d.tipo === 'particulas' || d.tipo === 'refugio') && d.nota === 'riesgosa')
  const objetivos = [
    { id: 'soporte', nombre: 'Life support balance', logrado: !muerto && !agotado && room.cabina.ppCO2 <= C.PPCO2_LIMITE_KPA, detalle: !muerto && !agotado ? `Oxygen, water and food lasted. Cabin CO2 ended at ${(room.cabina.ppCO2 * 7.5).toFixed(1)} mmHg.` : 'A reserve ran out or someone died.' },
    { id: 'radiacion', nombre: 'Radiation protection', logrado: bajoLimite && !radiacionMal, detalle: `Highest dose ${r(Math.max(0, ...crew.map((j) => j.vit.dosis)))} mSv of ${C.LIMITE_CARRERA_MSV}.${radiacionMal ? ' A storm decision exposed the crew.' : ''}` },
    { id: 'marte', nombre: 'The Mars environment', logrado: llego && soles >= 1 && salieron, detalle: llego ? `${soles} sol${soles === 1 ? '' : 's'} on the surface${salieron ? ', with walks outside in real Curiosity weather' : ', but nobody went outside'}.` : 'The crew did not reach the surface.' },
    { id: 'ciencia', nombre: 'The scientific method', logrado: m.muestrasAnalizadas >= 1, detalle: `${m.muestrasAnalizadas} sample${m.muestrasAnalizadas === 1 ? '' : 's'} collected, analyzed and read in the lab.` },
    { id: 'retardo', nombre: 'Communication delay', logrado: b.retardoMax >= 60, detalle: b.retardoMax >= 60 ? `Signals took up to ${r(b.retardoMax / 60)} min each way, so the crew decided on its own.` : 'The ship never got far enough for a long delay.' },
    { id: 'equipo', nombre: 'Teamwork', logrado: crew.length > 0 && conAporte === crew.length && hechos >= saltados, detalle: `${conAporte} of ${crew.length} contributed. ${hechos} duties done, ${saltados} skipped.` },
  ]
  const informe: Informe = { puntos, partes, decisiones, personas, objetivos }
  room.informe = informe
  // El informe ya resume las decisiones: no hace falta guardarlas dos veces.
  b.decisiones = []
}

/** Deberes de rutina del rol de `j` que se hicieron. */
function deberesDe(room: RoomState, j: Player): number {
  let n = 0
  for (const d of DEBERES) if (d.rol === j.rol) n += room.deberes?.[d.id]?.hechos ?? 0
  return n
}
