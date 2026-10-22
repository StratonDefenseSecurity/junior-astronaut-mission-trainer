// Deberes de rutina de cada rol (conferencia de planificación, navegación, control médico,
// inventario, experimento, filtros, trajes). Los pasos están en shared/procedimientos.ts
// (instancias `deber:<id>`); aquí se decide cuándo tocan, qué pasa al hacerlos y qué pasa si se
// saltan. server/trabajos.ts llama aquí, y la simulación lee los factores de abajo.
import { DEBERES, DEBER_BY_ID, DEBER_CADA_MS, DEBER_PLAZO_MS, deberAtrasado, enCurso, type InfoDeber, type Procedimiento } from '../shared/procedimientos.js'
import type { EstadoDeber, Player, RoomState, SistemaId } from '../shared/types.js'
import { hayEmergencia, limitar, log, sis, tripulacion } from './base.js'
import { ahora, azar } from './reloj.js'

const r2 = (v: number) => Math.round(v * 100) / 100
/** Un deber empezado y abandonado más de este tiempo real ya no impide darlo por saltado. */
const ABANDONO_MS = 300_000

function programar(room: RoomState, d: InfoDeber, e: EstadoDeber) {
  e.pendiente = false
  e.proximo = room.t + d.cadaDias * 86400
  e.proximoMs = ahora() + DEBER_CADA_MS
}

/** Lo que pasa cuando nadie hizo el deber a tiempo. */
function saltar(room: RoomState, d: InfoDeber, e: EstadoDeber) {
  e.saltados += 1
  e.atrasado = true
  e.bueno = false
  programar(room, d, e)
  delete room.procedimientos?.[`deber:${d.id}`]
  switch (d.id) {
    case 'planificacion':
      for (const j of tripulacion(room)) j.vit.fatiga = limitar(j.vit.fatiga + 3, 0, 100)
      break
    case 'navegacion':
      room.rec.propelente = Math.max(0, room.rec.propelente - 1)
      break
    case 'inventario':
      room.rec.comida = Math.max(0, room.rec.comida - 1.5)
      break
  }
  log(room, `A routine duty was skipped. ${d.penalizacion}`, 'alerta')
}

/** Cada segundo real: qué deberes empiezan a tocar y cuáles se dejaron pasar. */
export function pasoDeberes(room: RoomState) {
  if (room.resultado) return
  const est = (room.deberes ??= {})
  DEBERES.forEach((d, k) => {
    const id = `deber:${d.id}`
    const activo = d.fases.includes(room.fase) && room.jugadores.some((j) => j.rol === d.rol)
    let e = est[d.id]
    if (!activo) {
      if (e?.pendiente && !enCurso(room, id)) e.pendiente = false
      return
    }
    if (!e) {
      // Escalonados, para que no aparezcan todos a la vez al empezar la fase.
      est[d.id] = { proximo: room.t + (0.5 + k * 0.4) * 86400, proximoMs: ahora() + 40_000 + k * 15_000, pendiente: false, vence: 0, venceMs: 0, atrasado: false, hechos: 0, saltados: 0 }
      return
    }
    if (!e.pendiente) {
      if (room.t >= e.proximo && ahora() >= e.proximoMs) {
        e = Object.assign(e, { pendiente: true, vence: room.t + d.plazoDias * 86400, venceMs: ahora() + DEBER_PLAZO_MS })
      }
      return
    }
    // Se da por saltado solo cuando pasaron el plazo de misión y el de tiempo real, y nunca
    // durante una emergencia o mientras alguien lo está haciendo.
    if (room.t <= e.vence || ahora() <= e.venceMs || hayEmergencia(room)) return
    const ultimo = room.procedimientos?.[id]?.datos?.ultimo ?? 0
    if (enCurso(room, id) && ahora() - ultimo < ABANDONO_MS) return
    saltar(room, d, e)
  })
}

/** Prepara la lectura del instrumento de un deber. */
export function prepararDeber(room: RoomState, p: Procedimiento, i: number) {
  const e = room.procedimientos?.[p.id]
  if (!e) return
  const d = (e.datos ??= {})
  const errores = (k: number) => (typeof e.valores?.[k] === 'number' ? Number(e.valores[k]) : 0)
  switch (p.pasos[i]?.id) {
    case 'rumbo':
      d.deriva = azar(room) < 0.35 ? 1 : 0
      break
    case 'guante':
      d.corte = azar(room) < 0.25 ? Math.floor(azar(room) * 5) : -1
      break
    case 'cuenta':
      d.perdido = azar(room) < 0.35 ? 1 : 0
      break
    case 'dosis':
      d.alta = room.ambiente.tormentaSolar ? 1 : 0
      break
    case 'flujo':
      // Un filtro limpiado con el ventilador encendido queda más sucio (modelo del juego).
      d.tapado = azar(room) < 0.2 + 0.15 * errores(0) ? 1 : 0
      break
  }
}

/** Consecuencias de un deber terminado. */
export function alTerminarDeber(room: RoomState, p: Procedimiento, j: Player) {
  const d = DEBER_BY_ID[String(p.objetivo)]
  const e = room.procedimientos?.[p.id]
  if (!d || !e) return
  const q = e.calidad
  const v = e.valores ?? []
  const datos = e.datos ?? {}
  const media = q.length ? q.reduce((a, b) => a + b, 0) / q.length : 1
  let atrasado = false
  let bueno = media >= 0.99
  switch (d.id) {
    case 'planificacion': {
      const alivio = r2(4 * media)
      for (const o of tripulacion(room)) o.vit.fatiga = limitar(o.vit.fatiga - alivio, 0, 100)
      log(room, `${j.nombre} held the Daily Planning Conference.${media < 0.8 ? ' The plan arrived late and part of the day was lost.' : ' The day is well organized.'}`, media < 0.8 ? 'alerta' : 'ok')
      break
    }
    case 'navegacion': {
      if ((datos.deriva ?? 0) > 0 && q[1] === 1) {
        room.rec.propelente = Math.max(0, room.rec.propelente - 0.2)
        log(room, `${j.nombre} found a small drift and fixed it with a tiny trim burn. ${Math.round(room.rec.propelente)}% propellant left.`, 'ok')
      } else if ((datos.deriva ?? 0) > 0) {
        room.rec.propelente = Math.max(0, room.rec.propelente - 1)
        atrasado = true
        log(room, 'The drift was marked as on course. It kept growing and fixing it cost 1% of the propellant.', 'alerta')
      } else log(room, `${j.nombre} did the navigation fix. The ship is on course.`, 'ok')
      break
    }
    case 'trajes': {
      const corte = (datos.corte ?? -1) >= 0
      if (corte && q[1] === 1) {
        if (room.rec.repuestos >= 1) {
          room.rec.repuestos -= 1
          log(room, `${j.nombre} found a worn glove and replaced it with a spare parts kit.`, 'ok')
        } else log(room, `${j.nombre} found a worn glove. There are no spare parts, so it was patched as well as possible.`, 'alerta')
      }
      atrasado = (corte && q[1] === 0) || v[0] === 'nada'
      if (atrasado) log(room, 'The suits were not checked properly. The next walk outside has a higher chance of a suit leak.', 'alerta')
      else if (!corte) log(room, `${j.nombre} checked the suits. They are ready to go outside.`, 'ok')
      break
    }
    case 'chequeo': {
      const privada = v[1] === 'privada'
      let atendidos = 0
      for (const o of tripulacion(room)) {
        if (q[0] === 1 && 100 - o.vit.salud > 15 && !o.dolencia) {
          o.vit.salud = limitar(o.vit.salud + 6, 0, 100)
          atendidos += 1
        }
        if (privada && !o.dolencia) o.vit.salud = limitar(o.vit.salud + 2, 0, 100)
      }
      atrasado = v[1] === 'saltar'
      log(room, `${j.nombre} examined the crew${atendidos ? ` and gave early care to ${atendidos}` : ''}.${privada ? ' The private conferences went well.' : ' Some symptoms may stay hidden.'}`, privada ? 'ok' : 'alerta')
      break
    }
    case 'inventario': {
      if ((datos.perdido ?? 0) > 0 && q[2] === 1) {
        room.rec.comida += 1.5
        log(room, `${j.nombre} found 1.5 kg of food stowed in the wrong bag and logged it.`, 'ok')
      }
      const caduca = v[1] === 'nueva' ? 0.5 : v[1] === 'arriba' ? 0.2 : 0
      if (caduca) {
        room.rec.comida = Math.max(0, room.rec.comida - caduca)
        log(room, `${caduca} kg of old food passed its shelf life at the back of a bag.`, 'alerta')
      } else if (!((datos.perdido ?? 0) > 0)) log(room, `${j.nombre} audited the stowage. The count matches the log.`, 'ok')
      break
    }
    case 'experimento': {
      bueno = v[2] === 'agua'
      if ((datos.alta ?? 0) > 0 && q[1] === 1) log(room, `${j.nombre} sees a dose spike on the dosimeters. A solar storm is going on. Stay near the shelter.`, 'alerta')
      log(room, `${j.nombre} read the dosimeters.${bueno ? ' The crew now sleeps behind the water and food stowage and gets a bit less radiation.' : ''}`, 'ok')
      break
    }
    case 'filtros': {
      const sube = (id: SistemaId, n: number) => {
        const s = sis(room, id)
        if (s.instalado) s.integridad = Math.min(100, s.integridad + n)
      }
      if ((datos.tapado ?? 0) > 0 && q[1] === 0) {
        atrasado = true
        log(room, 'A filter is still clogged. The CO2 Scrubber and Thermal Control keep wearing out faster.', 'alerta')
      } else {
        sube('cdra', 2)
        sube('termico', 1)
        log(room, `${j.nombre} cleaned the air filters. The CO2 Scrubber is at ${Math.round(sis(room, 'cdra').integridad)}%.`, 'ok')
      }
      break
    }
  }
  const est = (room.deberes ??= {})
  const s = (est[d.id] ??= { proximo: 0, proximoMs: 0, pendiente: false, vence: 0, venceMs: 0, atrasado: false, hechos: 0, saltados: 0 })
  s.hechos += 1
  s.atrasado = atrasado
  s.bueno = bueno && !atrasado
  programar(room, d, s)
}

// ---------- Lo que la simulación lee ----------

/** Desgaste extra de un equipo por filtros sin limpiar. */
export const desgasteDeber = (room: RoomState, id: SistemaId) => ((id === 'cdra' || id === 'termico') && deberAtrasado(room, 'filtros') ? 1.5 : 1)
/** Riesgo extra de enfermar sin controles médicos. */
export const riesgoMedicoDeber = (room: RoomState) => (deberAtrasado(room, 'chequeo') ? 1.5 : 1)
/** Dosis con la tripulación durmiendo donde marca el mapa de dosímetros. */
export const dosisDeber = (room: RoomState) => (room.deberes?.experimento?.bueno && !deberAtrasado(room, 'experimento') ? 0.95 : 1)
/** Probabilidad extra de fuga en el traje si no se revisaron. */
export const fugaTrajeDeber = (room: RoomState) => (deberAtrasado(room, 'trajes') ? 0.1 : 0)
