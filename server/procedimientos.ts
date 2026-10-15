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
  PROC_BY_ID,
  activos,
  cultivoDe,
  disponible,
  evaluarPaso,
  factorPanel,
  secas,
  siguienteAplicable,
  valorDeExperto,
  type Procedimiento,
} from '../shared/procedimientos.js'
import { ROLE_BY_ID, TAREAS_ENSAMBLAJE, type CultivoId, type EstadoProcedimiento, type Player, type Role, type RoomState, type SistemaId, type Zona } from '../shared/types.js'
import { jugador, limitar, log, puedeActuar, sis, tripulacion } from './base.js'
import { completarTarea } from './game.js'
import { azar } from './reloj.js'
import { refrescar } from './sim/paso.js'

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
}

const r2 = (v: number) => Math.round(v * 100) / 100

/** Por qué no se puede hacer ahora un procedimiento. */
function noDisponible(room: RoomState, p: Procedimiento): string {
  if (p.tarea) {
    const t = TAREAS_ENSAMBLAJE.find((x) => x.id === p.tarea)!
    if (room.fase !== 'ensamblaje') return 'No estamos montando la base.'
    if (room.ensamblaje.hechas[t.id] || t.paso < room.ensamblaje.paso) return 'Esa tarea ya está hecha.'
    return 'Aún no toca esa tarea.'
  }
  if (p.id === 'huerto') {
    if (room.cargamento.huerto < 1) return 'No trajeron el kit de huerto.'
    if (room.huerto.establecido) return 'El huerto ya está montado.'
  }
  return 'Ahora no hace falta.'
}

/** Prepara lo que necesita un paso antes de hacerlo, como la lectura de un instrumento. */
function prepararPaso(room: RoomState, p: Procedimiento, i: number) {
  const def = p.pasos[i]
  const e = room.procedimientos?.[p.id]
  if (!def || def.tipo !== 'comprobar' || !e) return
  const d = (e.datos ??= {})
  if (d.semilla !== undefined) return
  d.semilla = Math.floor(azar(room) * 1000)
  if (p.id === 'revisionInt') {
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
  const e = room.procedimientos![p.id]
  const id = p.pasos[i].id
  // Cada error de orden al energizar o arrancar equipos les hace daño.
  const errores = p.pasos[i].tipo === 'secuencia' ? Number(valor) || 0 : 0
  if (errores > 0 && (p.id === 'energia' || p.id === 'soporte')) {
    const s = sis(room, p.id === 'energia' ? 'energia' : 'oga')
    s.integridad = Math.max(20, s.integridad - 4 * errores)
    log(room, p.id === 'energia' ? `Hubo picos de tensión al energizar fuera de orden: la planta de energía queda al ${Math.round(s.integridad)}%.` : `El generador de oxígeno arrancó sin agua: queda al ${Math.round(s.integridad)}%.`, 'alerta')
  }
  if (p.id === 'huerto') room.huerto.progreso = Math.round(((i + 1) / p.pasos.length) * 100)
  if (p.id === 'revisionInt' && id === 'caida' && valor === 'falla') {
    // Fuga encontrada: se busca, se limpia el sello y se repite la prueba.
    room.procedimientos![p.id] = { paso: 0, calidad: [], por: [], valores: [], inicio: e.inicio, terminado: false, datos: { reintento: 1 } }
    log(room, `${j.nombre} detectó una fuga en la esclusa. Hay que revisar y limpiar el sello y repetir la prueba.`, 'alerta')
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
  switch (p.id) {
    case 'paneles': {
      ef.solar = factorPanel(room.sitio, String(v[0]), Number(v[3]))
      log(room, `Campos solares orientados al ${v[0]} con ${v[3]}° de inclinación: aprovechan el ${pct(ef.solar)} de la luz del mediodía.`, ef.solar < 0.9 ? 'alerta' : 'ok')
      break
    }
    case 'carga': {
      if (typeof v[2] === 'string') {
        ef.reactorDosis = DOSIS_REACTOR[v[2]] ?? 0
        if (ef.reactorDosis > 0.5) log(room, `El reactor quedó junto al hábitat: la tripulación recibe ${ef.reactorDosis} mSv más al día.`, 'alerta')
      }
      break
    }
    case 'energia': {
      const tension = Number(v[2])
      if (tension > 130) {
        const dano = Math.min(30, (tension - 124.5) * 1.2)
        for (const id of ['oga', 'cdra', 'wrs', 'termico'] as SistemaId[]) sis(room, id).integridad = Math.max(20, sis(room, id).integridad - dano)
        log(room, `La sobretensión de ${tension} V dañó los equipos de soporte vital.`, 'alerta')
      }
      ef.perdidaBus = tension < 119 ? r2(124.5 / tension) : 1
      if (ef.perdidaBus > 1) log(room, `Con ${tension} V el hábitat consume un ${Math.round((ef.perdidaBus - 1) * 100)}% más de energía por las pérdidas.`, 'alerta')
      break
    }
    case 'soporte':
      ef.ogaKgDia = Number(v[1])
      ef.alarmaCO2 = r2(Number(v[2]) / 7.50062)
      break
    case 'revisionInt':
      if ((e.datos?.fuga ?? 0) > 0 && e.calidad[2] === 0) {
        room.cabina.fuga = Math.max(room.cabina.fuga, 0.05)
        log(room, 'La prueba se dio por buena, pero la esclusa pierde aire poco a poco: hay una fuga lenta.', 'alerta')
      }
      break
    case 'revisionExt':
      if ((e.datos?.dano ?? 0) > 0) {
        if (e.calidad[1] === 1 && room.rec.repuestos >= 1) {
          room.rec.repuestos -= 1
          log(room, `${j.nombre} parcheó la marca del casco con un kit de repuestos.`, 'ok')
        } else {
          const t = sis(room, 'termico')
          t.integridad = Math.max(20, t.integridad - (e.calidad[1] === 1 ? 8 : 15))
          log(room, e.calidad[1] === 1 ? 'No quedan repuestos para parchear el casco: el aislamiento dañado hace trabajar más al control térmico.' : 'Una marca del casco pasó del límite sin repararse: el aislamiento dañado hace trabajar más al control térmico.', 'alerta')
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
      log(room, `Huerto montado con ${enFrase(CULTIVO_BY_ID[cultivo].nombre)}. Cosecha prevista en ${CULTIVO_BY_ID[cultivo].dias} días si se cuida bien.`, 'ok')
      break
    }
    case 'regar': {
      const ml = Number(v[1])
      for (const a of secas(room)) a.humedad = Math.min(100, a.humedad + ml * HUMEDAD_POR_ML)
      log(room, `${j.nombre} regó el huerto con ${ml} mL por almohadilla.`, e.calidad[1] < 0.7 ? 'alerta' : 'info')
      break
    }
    case 'ralear':
      for (const a of h.almohadillas ?? []) {
        if (a.muerta || a.raleada || a.plantulas <= 1) continue
        a.raleada = true
        if (v[0] !== 'dejar') a.plantulas = 1
        if (v[0] === 'arrancar') a.salud = Math.max(0, a.salud - 15)
      }
      log(room, `${j.nombre} raleó las plántulas del huerto.`)
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
      log(room, v[1] === 'retirar' ? `${j.nombre} retiró las hojas con moho y subió el ventilador del huerto.` : 'El moho sigue en el huerto.', v[1] === 'retirar' ? 'ok' : 'alerta')
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
      log(room, v[1] === 'regar' ? `${j.nombre} regó las almohadillas secas y bajó el ventilador.` : 'Las hojas siguen caídas: las raíces siguen sin agua.', v[1] === 'regar' ? 'ok' : 'alerta')
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
      log(room, `Cosecha del huerto: ${r2(kg)} kg de ${enFrase(cultivo.nombre)}. La tripulación come ${r2(comida)} kg${v[1] === 'mitad' ? ' y congela el resto para analizarlo' : ''}.`, 'ok')
      break
    }
  }
  if (p.tarea) completarTarea(room, j, p.tarea)
  const media = e.calidad.length ? e.calidad.reduce((a, b) => a + b, 0) / e.calidad.length : 1
  if (p.tarea || p.id === 'huerto') log(room, `${p.titulo}: hecho al ${pct(media)} de como lo haría un experto.`, media < 0.8 ? 'alerta' : 'ok')
  e.terminado = true
  // Los que se repiten vuelven a empezar de cero la próxima vez.
  if (p.recurrente) delete room.procedimientos![p.id]
}

export function pasoProcedimiento(room: RoomState, jugadorId: string, procId: string, paso: number, valor: unknown): string | null {
  const p = PROC_BY_ID[procId]
  if (!p) return 'Procedimiento desconocido.'
  const j = jugador(room, jugadorId)
  if (!j || !j.rol) return 'Jugador no encontrado.'
  if (!disponible(room, p)) return noDisponible(room, p)
  const procs = (room.procedimientos ??= {})
  if (procs[procId]?.terminado) delete procs[procId]
  const actual = siguienteAplicable(room, p, procs[procId]?.paso ?? 0)
  if (!Number.isInteger(paso) || paso !== actual) return paso < actual ? 'Ese paso ya está hecho.' : `Primero hay que hacer: ${p.pasos[actual]?.titulo.toLowerCase() ?? 'el paso anterior'}.`
  const def = p.pasos[actual]
  if (j.incapacitado > 0) return 'Estás fuera de servicio. Necesitas descanso o al médico.'
  if (j.enRefugio) return 'Estás en el refugio. No puedes trabajar hasta salir.'
  if (!puedeActuar(room, j, def.roles)) return `Ese paso lo hace: ${def.roles.map((r) => ROLE_BY_ID[r].nombre).join(' o ')}.`
  if (j.zona !== def.zona) return def.zona === 'exterior' ? 'Hay que salir con el traje para hacerlo.' : 'Se hace dentro del hábitat.'

  const e: EstadoProcedimiento = (procs[procId] ??= { paso: 0, calidad: [], por: [], valores: [], inicio: room.t, terminado: false })
  prepararPaso(room, p, actual)
  const ev = evaluarPaso(room, p, actual, valor)
  if (!ev.ok) return ev.mensaje
  const agua = aguaDelPaso(room, p, actual, ev.valor)
  if (agua > 0 && room.rec.agua < agua + 2) return 'No queda agua potable suficiente para regar.'
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
  j.aportes = (j.aportes ?? 0) + 1
  j.vit.fatiga = limitar(j.vit.fatiga + (def.zona === 'exterior' ? 1.5 : 0.5), 0, 100)
  if (ev.calidad < 0.7) log(room, `${p.titulo}, ${def.titulo.toLowerCase()}: ${ev.mensaje}`, 'alerta')

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
    return { procId: proc.id, paso, roles: def.roles, zona: def.zona, estacion: def.estacion, segundos: def.segundos }
  })
}

export function valorExperto(room: RoomState, procId: string, paso: number): unknown {
  const p = PROC_BY_ID[procId]
  return p ? valorDeExperto(room, p, paso) : null
}
