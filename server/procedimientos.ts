// Procedimientos por pasos: montar la base, el huerto y su cuidado se hacen como en la vida real,
// paso a paso, en vez de con un solo botón. Los datos de cada procedimiento están en
// shared/procedimientos.ts; aquí se validan los pasos y se aplican sus consecuencias.
//
// CONTRATO (lo usan los bots en server/tripulantes.ts; no cambiar las firmas):
// - pasoProcedimiento: un jugador (persona o bot) completa el paso `paso` del procedimiento
//   `procId` con el valor que eligió. Devuelve un error en texto o null.
// - procedimientosPendientes: lo que se puede hacer ahora mismo, con quién y dónde.
// - valorExperto: el valor que daría alguien que sabe hacerlo (los bots lo usan).
import {
  ALMOHADILLAS,
  CULTIVO_BY_ID,
  DOSIS_REACTOR,
  HUMEDAD_IDEAL,
  HUMEDAD_POR_ML,
  LUZ_HUERTO,
  activos,
  cultivoDe,
  disponible,
  evaluarPaso,
  enCurso,
  factorPanel,
  procPorId,
  secas,
  siguienteAplicable,
  valorDeExperto,
  type Procedimiento,
} from '../shared/procedimientos.js'
import { ROLE_BY_ID, TAREAS_ENSAMBLAJE, type CultivoId, type EstadoProcedimiento, type Player, type Role, type RoomState, type SistemaId, type Zona } from '../shared/types.js'
import { jugador, limitar, log, puedeActuar, sis, tripulacion } from './base.js'
import { completarTarea } from './game.js'
import { ahora, azar } from './reloj.js'
import { refrescar } from './sim/paso.js'
import { alHacerPasoTrabajo, alTerminarTrabajo, antesDePasoTrabajo, prepararTrabajo } from './trabajos.js'

export interface Pendiente {
  procId: string
  /** Índice del paso que toca. */
  paso: number
  roles: Role[]
  zona: Zona
  /** Estación del mapa (src/mundo/mapa.ts) donde se hace el paso. */
  estacion: string
  /** Segundos reales que lleva hacerlo con calma. */
  segundos: number
  /** Trabajo que se empieza a mano cuando hace falta (reparar, curar, salir...), no una tarea anunciada. */
  aDemanda?: boolean
  /** Solo lo hace este jugador (su traje, sus muestras). */
  jugador?: string
  /** Ya tiene algún paso hecho. */
  enCurso?: boolean
  /** Quién hizo el primer paso, si está a medias. */
  por?: string
}

const r2 = (v: number) => Math.round(v * 100) / 100
/** Nombre en inglés de cada orientación (los valores internos siguen en español). */
const RUMBO: Record<string, string> = { norte: 'north', sur: 'south', este: 'east', oeste: 'west' }

/** Por qué no se puede hacer ahora un procedimiento. */
function noDisponible(room: RoomState, p: Procedimiento): string {
  if (p.aDemanda) return p.motivo?.(room) ?? 'That is not needed right now.'
  if (p.tarea) {
    const t = TAREAS_ENSAMBLAJE.find((x) => x.id === p.tarea)!
    if (room.fase !== 'ensamblaje') return 'We are not building the base right now.'
    if (room.ensamblaje.hechas[t.id] || t.paso < room.ensamblaje.paso) return 'That task is already done.'
    return 'It is not time for that task yet.'
  }
  if (p.id === 'huerto') {
    if (room.cargamento.huerto < 1) return 'The crew did not bring the garden kit.'
    if (room.huerto.establecido) return 'The garden is already set up.'
  }
  return 'That is not needed right now.'
}

/** Prepara lo que necesita un paso antes de hacerlo, como la lectura de un instrumento. */
function prepararPaso(room: RoomState, p: Procedimiento, i: number) {
  const def = p.pasos[i]
  const e = room.procedimientos?.[p.id]
  if (!def || def.tipo !== 'comprobar' || !e) return
  const d = (e.datos ??= {})
  if (d.semilla !== undefined) return
  d.semilla = Math.floor(azar(room) * 1000)
  if (p.aDemanda) prepararTrabajo(room, p, i)
  else if (p.id === 'revisionInt') {
    // Un sello mal preparado deja más posibilidades de fuga (modelo del juego).
    const sello = e.calidad[0] ?? 1
    const prob = limitar(0.3 + (1 - sello) * 1.5, 0, 0.9)
    d.fuga = d.reintento ? 0 : azar(room) < prob ? 1 : 0
  } else if (p.id === 'revisionExt') {
    const duro = (room.avisos.desvio ?? 0) > 0
    d.dano = duro || azar(room) < 0.25 ? 1 : 0
  }
}

/** Lo que pasa justo al hacer un paso. Devuelve true si el procedimiento vuelve a empezar. */
function alHacerPaso(room: RoomState, p: Procedimiento, i: number, j: Player, valor: number | string | null): boolean {
  if (p.aDemanda) return alHacerPasoTrabajo(room, p, i, j, valor)
  const e = room.procedimientos![p.id]
  const id = p.pasos[i].id
  // Cada error de orden al energizar o arrancar equipos les hace daño.
  const errores = p.pasos[i].tipo === 'secuencia' ? Number(valor) || 0 : 0
  if (errores > 0 && (p.id === 'energia' || p.id === 'soporte')) {
    const s = sis(room, p.id === 'energia' ? 'energia' : 'oga')
    s.integridad = Math.max(20, s.integridad - 4 * errores)
    log(room, p.id === 'energia' ? `There were voltage spikes from powering up out of order. The Power Plant is now at ${Math.round(s.integridad)}%.` : `The Oxygen Generator started without water. It is now at ${Math.round(s.integridad)}%.`, 'alerta')
  }
  if (p.id === 'huerto') room.huerto.progreso = Math.round(((i + 1) / p.pasos.length) * 100)
  if (p.id === 'revisionInt' && id === 'caida' && valor === 'falla') {
    // Fuga encontrada: se busca, se limpia el sello y se repite la prueba.
    room.procedimientos![p.id] = { paso: 0, calidad: [], por: [], valores: [], inicio: e.inicio, terminado: false, datos: { reintento: 1 } }
    log(room, `${j.nombre} found a leak in the Airlock. The seal must be checked and cleaned, and the test repeated.`, 'alerta')
    return true
  }
  return false
}

/** Agua que gasta un paso de riego, en kg. */
function aguaDelPaso(room: RoomState, p: Procedimiento, i: number, valor: unknown): number {
  const id = p.pasos[i]?.id
  if (p.id === 'huerto' && id === 'cebado') return (Number(valor) * ALMOHADILLAS) / 1000
  if (p.id === 'regar' && id === 'agua') return (Number(valor) * secas(room).length) / 1000
  return 0
}

const pct = (v: number) => `${Math.round(v * 100)}%`
/** Nombre para mitad de frase: inicial en minúscula, sin tocar los nombres propios. */
const enFrase = (n: string) => n.charAt(0).toLowerCase() + n.slice(1)

/** Consecuencias de un procedimiento terminado. */
function alTerminar(room: RoomState, p: Procedimiento, j: Player) {
  const e = room.procedimientos![p.id]
  const v = e.valores ?? []
  const ef = (room.efectos ??= {})
  const h = room.huerto
  if (p.aDemanda) alTerminarTrabajo(room, p, j)
  switch (p.id) {
    case 'paneles': {
      ef.solar = factorPanel(room.sitio, String(v[0]), Number(v[3]))
      log(room, `Solar arrays facing ${RUMBO[String(v[0])] ?? v[0]} with a ${v[3]}° tilt. They capture ${pct(ef.solar)} of the noon sunlight.`, ef.solar < 0.9 ? 'alerta' : 'ok')
      break
    }
    case 'carga': {
      if (typeof v[2] === 'string') {
        ef.reactorDosis = DOSIS_REACTOR[v[2]] ?? 0
        if (ef.reactorDosis > 0.5) log(room, `The reactor ended up next to the habitat. The crew gets ${ef.reactorDosis} mSv more per day.`, 'alerta')
      }
      break
    }
    case 'energia': {
      const tension = Number(v[2])
      if (tension > 130) {
        const dano = Math.min(30, (tension - 124.5) * 1.2)
        for (const id of ['oga', 'cdra', 'wrs', 'termico'] as SistemaId[]) sis(room, id).integridad = Math.max(20, sis(room, id).integridad - dano)
        log(room, `The overvoltage of ${tension} V damaged the life support equipment.`, 'alerta')
      }
      ef.perdidaBus = tension < 119 ? r2(124.5 / tension) : 1
      if (ef.perdidaBus > 1) log(room, `At ${tension} V the habitat uses ${Math.round((ef.perdidaBus - 1) * 100)}% more power because of losses.`, 'alerta')
      break
    }
    case 'soporte':
      ef.ogaKgDia = Number(v[1])
      ef.alarmaCO2 = r2(Number(v[2]) / 7.50062)
      break
    case 'revisionInt':
      if ((e.datos?.fuga ?? 0) > 0 && e.calidad[2] === 0) {
        room.cabina.fuga = Math.max(room.cabina.fuga, 0.05)
        log(room, 'The test was marked as passed, but the Airlock is slowly losing air. There is a slow leak.', 'alerta')
      }
      break
    case 'revisionExt':
      if ((e.datos?.dano ?? 0) > 0) {
        if (e.calidad[1] === 1 && room.rec.repuestos >= 1) {
          room.rec.repuestos -= 1
          log(room, `${j.nombre} patched the mark on the hull with a spare parts kit.`, 'ok')
        } else {
          const t = sis(room, 'termico')
          t.integridad = Math.max(20, t.integridad - (e.calidad[1] === 1 ? 8 : 15))
          log(room, e.calidad[1] === 1 ? 'There are no spare parts left to patch the hull. The damaged insulation makes Thermal Control work harder.' : 'A mark on the hull was over the limit and was not repaired. The damaged insulation makes Thermal Control work harder.', 'alerta')
        }
      }
      break
    case 'huerto': {
      const cultivo = (CULTIVO_BY_ID[v[0] as CultivoId] ? v[0] : 'lechuga') as CultivoId
      const humedad = Math.min(100, Number(v[4]) * HUMEDAD_POR_ML)
      h.cultivo = cultivo
      h.luz = LUZ_HUERTO[String(v[2])] ?? 1
      h.ventilador = 'normal'
      h.almohadillas = Array.from({ length: ALMOHADILLAS }, () => ({ humedad, salud: 100, crecimiento: 0, moho: 0, plantulas: 3, raleada: false, muerta: false }))
      h.establecido = true
      h.progreso = 100
      h.diasCultivo = 0
      log(room, `Garden set up with ${enFrase(CULTIVO_BY_ID[cultivo].nombre)}. Harvest expected in ${CULTIVO_BY_ID[cultivo].dias} days if it is well cared for.`, 'ok')
      break
    }
    case 'regar': {
      const ml = Number(v[1])
      for (const a of secas(room)) a.humedad = Math.min(100, a.humedad + ml * HUMEDAD_POR_ML)
      log(room, `${j.nombre} watered the garden with ${ml} mL per pad.`, e.calidad[1] < 0.7 ? 'alerta' : 'info')
      break
    }
    case 'ralear':
      for (const a of h.almohadillas ?? []) {
        if (a.muerta || a.raleada || a.plantulas <= 1) continue
        a.raleada = true
        if (v[0] !== 'dejar') a.plantulas = 1
        if (v[0] === 'arrancar') a.salud = Math.max(0, a.salud - 15)
      }
      log(room, `${j.nombre} thinned the seedlings in the garden.`)
      break
    case 'moho':
      for (const a of h.almohadillas ?? []) {
        if (a.muerta) continue
        if (v[1] === 'retirar' && a.moho > 0.05) {
          a.moho = 0
          a.salud = Math.max(0, a.salud - 5)
        } else if (v[1] === 'regar') {
          a.humedad = Math.min(100, a.humedad + 20)
          a.moho = Math.min(1, a.moho + 0.15)
        }
      }
      if (v[1] === 'retirar') h.ventilador = 'alto'
      h.revisado = room.t
      log(room, v[1] === 'retirar' ? `${j.nombre} removed the moldy leaves and turned up the garden fan.` : 'The mold is still in the garden.', v[1] === 'retirar' ? 'ok' : 'alerta')
      break
    case 'amarillas': {
      if (v[1] === 'regar') {
        const s = secas(room)
        const kg = (s.reduce((x, a) => x + (HUMEDAD_IDEAL - a.humedad) / HUMEDAD_POR_ML, 0)) / 1000
        if (room.rec.agua > kg + 2) {
          for (const a of s) a.humedad = HUMEDAD_IDEAL
          room.rec.agua -= kg
        }
        h.ventilador = 'normal'
      } else if (v[1] === 'cortar') {
        for (const a of h.almohadillas ?? []) if (!a.muerta) a.salud = Math.min(100, a.salud + 3)
      } else h.ventilador = 'alto'
      h.revisado = room.t
      log(room, v[1] === 'regar' ? `${j.nombre} watered the dry pads and turned down the fan.` : 'The leaves are still drooping. The roots still have no water.', v[1] === 'regar' ? 'ok' : 'alerta')
      break
    }
    case 'cosechar': {
      const cultivo = cultivoDe(room)
      const corte = cultivo.cortes.find((c) => c.id === v[0]) ?? cultivo.cortes[0]
      const listas = (h.almohadillas ?? []).filter((a) => !a.muerta && a.crecimiento >= 1)
      const kg = listas.reduce((x, a) => x + cultivo.kg * (a.salud / 100) * corte.factor, 0)
      const comida = v[1] === 'mitad' ? kg / 2 : kg
      room.rec.comida += comida
      h.comidaFresca = r2((h.comidaFresca ?? 0) + comida)
      h.cosechas += 1
      for (const a of listas) {
        if (corte.rebrota) a.crecimiento = cultivo.rebrote
        else Object.assign(a, { crecimiento: 0, plantulas: 1, raleada: true, moho: 0 })
      }
      // La verdura fresca levanta el ánimo: la tripulación descansa mejor.
      for (const x of tripulacion(room)) x.vit.fatiga = limitar(x.vit.fatiga - 8, 0, 100)
      log(room, `Garden harvest: ${r2(kg)} kg of ${enFrase(cultivo.nombre)}. The crew eats ${r2(comida)} kg${v[1] === 'mitad' ? ' and freezes the rest to analyze it' : ''}.`, 'ok')
      break
    }
  }
  if (p.tarea) completarTarea(room, j, p.tarea)
  const media = e.calidad.length ? e.calidad.reduce((a, b) => a + b, 0) / e.calidad.length : 1
  if (p.tarea || p.id === 'huerto') log(room, `${p.titulo}: done at ${pct(media)} of how an expert would do it.`, media < 0.8 ? 'alerta' : 'ok')
  e.terminado = true
  // Los que se repiten vuelven a empezar de cero la próxima vez.
  if (p.recurrente) delete room.procedimientos![p.id]
}

export function pasoProcedimiento(room: RoomState, jugadorId: string, procId: string, paso: number, valor: unknown): string | null {
  const p = procPorId(procId, room)
  if (!p) return 'Unknown procedure.'
  const j = jugador(room, jugadorId)
  if (!j || !j.rol) return 'Player not found.'
  if (p.jugador && p.jugador !== j.id) return `Only ${jugador(room, p.jugador)?.nombre ?? 'that crew member'} can do this.`
  if (!disponible(room, p)) return noDisponible(room, p)
  const procs = (room.procedimientos ??= {})
  if (procs[procId]?.terminado || (p.sigue && procs[procId] && !p.sigue(room))) delete procs[procId]
  const actual = siguienteAplicable(room, p, procs[procId]?.paso ?? 0)
  if (!Number.isInteger(paso) || paso !== actual) return paso < actual ? 'That step is already done.' : `First you have to: ${p.pasos[actual] ? enFrase(p.pasos[actual].titulo) : 'do the previous step'}.`
  const def = p.pasos[actual]
  if (j.incapacitado > 0) return 'You are out of action. You need rest or the Flight Surgeon.'
  if (j.enRefugio) return 'You are in the Storm Shelter. You cannot work until you leave.'
  if (!puedeActuar(room, j, def.roles)) return `This step is done by: ${def.roles.map((r) => ROLE_BY_ID[r].nombre).join(' or ')}.`
  if (j.zona !== def.zona) return def.zona === 'exterior' ? 'You have to suit up and go outside to do it.' : 'This is done inside the habitat.'
  if (p.aDemanda) {
    const impide = antesDePasoTrabajo(room, p, actual, j)
    if (impide) return impide
  }

  const e: EstadoProcedimiento = (procs[procId] ??= { paso: 0, calidad: [], por: [], valores: [], inicio: room.t, terminado: false })
  prepararPaso(room, p, actual)
  const ev = evaluarPaso(room, p, actual, valor)
  if (!ev.ok) return ev.mensaje
  const agua = aguaDelPaso(room, p, actual, ev.valor)
  if (agua > 0 && room.rec.agua < agua + 2) return 'There is not enough drinking water left to water the plants.'
  room.rec.agua -= agua

  const valores = (e.valores ??= [])
  // Los pasos que no aplican (por ejemplo, sin reactor) cuentan como hechos.
  for (let k = e.paso; k < actual; k++) {
    e.calidad[k] = 1
    e.por[k] = ''
    valores[k] = null
  }
  e.calidad[actual] = ev.calidad
  e.por[actual] = j.id
  valores[actual] = ev.valor
  e.paso = actual + 1
  // Cuándo se hizo el último paso: mientras alguien trabaja, el tiempo no corre tan rápido.
  ;(e.datos ??= {}).ultimo = ahora()
  j.aportes = (j.aportes ?? 0) + 1
  // Los trabajos largos (muestras, reparaciones) suman su cansancio al terminar; cada paso, poco.
  j.vit.fatiga = limitar(j.vit.fatiga + (def.zona === 'exterior' ? (p.aDemanda ? 0.6 : 1.5) : p.aDemanda ? 0.2 : 0.5), 0, 100)
  if (ev.calidad < 0.7) log(room, `${p.titulo}, ${enFrase(def.titulo)}: ${ev.mensaje}`, 'alerta')

  if (!alHacerPaso(room, p, actual, j, ev.valor)) {
    e.paso = siguienteAplicable(room, p, e.paso)
    if (e.paso >= p.pasos.length) alTerminar(room, p, j)
    else prepararPaso(room, p, e.paso)
  }
  refrescar(room)
  return null
}

export function procedimientosPendientes(room: RoomState): Pendiente[] {
  return activos(room).map(({ proc, paso }) => {
    const def = proc.pasos[paso]
    const e = room.procedimientos?.[proc.id]
    return {
      procId: proc.id,
      paso,
      roles: def.roles,
      zona: def.zona,
      estacion: def.estacion,
      segundos: def.segundos,
      ...(proc.aDemanda ? { aDemanda: true, enCurso: enCurso(room, proc.id), por: e?.por.find(Boolean) } : {}),
      ...(proc.jugador ? { jugador: proc.jugador } : {}),
    }
  })
}

export function valorExperto(room: RoomState, procId: string, paso: number): unknown {
  const p = procPorId(procId, room)
  return p ? valorDeExperto(room, p, paso) : null
}
