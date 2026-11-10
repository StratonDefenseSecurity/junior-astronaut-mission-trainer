// Deberes de rutina de cada rol (conferencia de planificación, navegación, control médico,
// inventario, experimento, filtros, trajes). Los pasos están en shared/procedimientos.ts
// (instancias `deber:<id>`); aquí se decide cuándo tocan, qué pasa al hacerlos y qué pasa si se
// saltan. server/trabajos.ts llama aquí, y la simulación lee los factores de abajo.
import { C } from '../shared/ciencia.js'
import { duracionDia, proximoDiaSemana } from '../shared/horario.js'
import { DEBERES, DEBER_BY_ID, DEBER_CADA_MS, DEBER_PLAZO_MS, DIAS_AVISO_COMIDA, deberAtrasado, enCurso, limiteBasura, lotesComida, type InfoDeber, type Procedimiento } from '../shared/procedimientos.js'
import type { EstadoDeber, Player, RoomState, SistemaId } from '../shared/types.js'
import { hayEmergencia, limitar, log, sis, tripulacion } from './base.js'
import { ahora, azar } from './reloj.js'

const r2 = (v: number) => Math.round(v * 100) / 100
/** Un deber empezado y abandonado más de este tiempo real ya no impide darlo por saltado. */
const ABANDONO_MS = 300_000

function programar(room: RoomState, d: InfoDeber, e: EstadoDeber) {
  e.pendiente = false
  e.proximo = room.t + d.cadaDias * 86400
  if (d.semanal !== undefined) {
    // Los semanales vuelven el próximo día que toca (el sábado), no a los 7 días justos.
    let p = proximoDiaSemana(room, d.semanal)
    if (p <= room.t) p += 7 * duracionDia(room)
    e.proximo = p
  }
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
    case 'menu':
      tirarComida(room, 2)
      break
  }
  log(room, `A routine duty was skipped. ${d.penalizacion}`, 'alerta')
}

/** Tira hasta `kg` del lote más próximo a su fecha si está cerca de ella. Devuelve los kg tirados. */
function tirarComida(room: RoomState, kg: number): number {
  const lote = lotesComida(room).find((l) => l.dias < DIAS_AVISO_COMIDA)
  if (!lote || !room.logistica) return 0
  const n = r2(Math.min(kg, lote.kg, room.rec.comida))
  room.rec.comida = Math.max(0, room.rec.comida - n)
  room.logistica.caducada = r2(room.logistica.caducada + n)
  if (n > 0) log(room, `${n} kg of food from ${lote.nombre} passed its date at the back of the galley and was thrown away.`, 'alerta')
  return n
}

/** Basura que se acumula y lotes de comida que pasan su fecha. */
function pasoLogistica(room: RoomState) {
  if (room.fase !== 'transito' && room.fase !== 'ensamblaje' && room.fase !== 'base' && room.fase !== 'llegada') return
  const L = (room.logistica ??= { basura: 0, comidaInicial: room.rec.comida, caducada: 0, t: room.t })
  const dt = Math.max(0, room.t - L.t)
  L.t = room.t
  const n = tripulacion(room).length
  const antes = L.basura
  L.basura = r2(L.basura + (C.BASURA_KG_DIA * n * dt) / 86400)
  const lim = limiteBasura(room)
  if (antes <= lim && L.basura > lim) log(room, `There are ${Math.round(L.basura)} kg of loose trash in the cabin. It smells and microbes grow. Bag it.`, 'alerta')
  // Un lote que llega a su fecha con comida dentro se tira entero.
  for (const l of lotesComida(room)) {
    if (l.dias > 0) continue
    const kg = r2(Math.min(l.kg, room.rec.comida))
    room.rec.comida = Math.max(0, room.rec.comida - kg)
    L.caducada = r2(L.caducada + kg)
    if (kg > 0) log(room, `${l.nombre} passed its shelf life. ${kg} kg of food were thrown away.`, 'alerta')
  }
}

/** Cada segundo real: qué deberes empiezan a tocar y cuáles se dejaron pasar. */
export function pasoDeberes(room: RoomState) {
  if (room.resultado) return
  pasoLogistica(room)
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
      const proximo = d.semanal !== undefined ? Math.max(room.t + 0.5 * 86400, proximoDiaSemana(room, d.semanal)) : room.t + (0.5 + k * 0.4) * 86400
      est[d.id] = { proximo, proximoMs: ahora() + 40_000 + k * 15_000, pendiente: false, vence: 0, venceMs: 0, atrasado: false, hechos: 0, saltados: 0 }
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
    case 'limpieza': {
      const todos = v[0] === 'todos'
      atrasado = v[0] === 'saltar'
      if (atrasado) {
        log(room, 'The cleaning was skipped. Dust and microbes keep building up in the vents.', 'alerta')
        break
      }
      for (const o of tripulacion(room)) {
        if (todos) o.vit.salud = limitar(o.vit.salud + 1, 0, 100)
      }
      if (!todos) j.vit.fatiga = limitar(j.vit.fatiga + 8, 0, 100)
      const s = sis(room, 'cdra')
      if (s.instalado) s.integridad = Math.min(100, s.integridad + 1)
      log(room, todos ? `The crew cleaned the habitat together on Saturday morning. ${j.nombre} reported the lost items found on the vent screens.` : `${j.nombre} cleaned the habitat alone and is tired.`, 'ok')
      break
    }
    case 'menu': {
      const variado = v[0] === 'variado'
      if (!variado) for (const o of tripulacion(room)) o.vit.fatiga = limitar(o.vit.fatiga + 1, 0, 100)
      const cerca = lotesComida(room).find((l) => l.dias < DIAS_AVISO_COMIDA)
      const rotado = q[1] === 1 && v[2] === 'adelante'
      if (cerca && !rotado) {
        tirarComida(room, 2)
        atrasado = true
      }
      const lote = lotesComida(room)[0]
      log(room, `${j.nombre} planned the menu.${variado ? ' Meals stay varied.' : ' Meals are getting repetitive.'}${lote ? ` The oldest food, ${lote.nombre}, has ${Math.round(lote.dias)} days left.` : ''}`, variado ? 'ok' : 'alerta')
      bueno = variado && !atrasado
      break
    }
    case 'basura': {
      const L = room.logistica
      const kgB = Math.round(L?.basura ?? 0)
      const bien = q[0] === 1
      if (L) L.basura = bien ? 0 : r2(L.basura * 0.3)
      log(room, bien ? `${j.nombre} bagged, compacted and stowed ${kgB} kg of trash.` : `${j.nombre} bagged the trash, but some wet trash went in an open bag and still smells.`, bien ? 'ok' : 'alerta')
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
export const desgasteDeber = (room: RoomState, id: SistemaId) =>
  ((id === 'cdra' || id === 'termico') && deberAtrasado(room, 'filtros') ? 1.5 : 1) * (id === 'cdra' && deberAtrasado(room, 'limpieza') ? 1.25 : 1)
/** Riesgo extra de enfermar sin controles médicos, sin limpieza o con basura suelta. */
export const riesgoMedicoDeber = (room: RoomState) =>
  (deberAtrasado(room, 'chequeo') ? 1.5 : 1) * (deberAtrasado(room, 'limpieza') ? 1.25 : 1) * ((room.logistica?.basura ?? 0) > limiteBasura(room) ? 1.25 : 1)
/** Dosis con la tripulación durmiendo donde marca el mapa de dosímetros. */
export const dosisDeber = (room: RoomState) => (room.deberes?.experimento?.bueno && !deberAtrasado(room, 'experimento') ? 0.95 : 1)
/** Probabilidad extra de fuga en el traje si no se revisaron. */
export const fugaTrajeDeber = (room: RoomState) => (deberAtrasado(room, 'trajes') ? 0.1 : 0)
