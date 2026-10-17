// Tripulantes bot del modo de un jugador. El servidor llena los roles que la persona no eligió
// y cada bot hace solo el trabajo de su rol, con las mismas funciones que usan las personas:
// decide las emergencias que le tocan, propone, vota, repara, cura, recoge muestras y monta la
// base. La política sale de scripts/simular.ts, que gana las seis situaciones.
//
// Todo lo que deciden sale del estado de la sala, de su reloj virtual (`ahora`) y de su azar
// (`azar`): cualquier instancia que avance la misma copia guardada llega al mismo resultado.
// Lo único que no es determinista es dónde se dibuja cada bot (`posicionesBots`), que vive en
// memoria como las posiciones de las personas.
import { C } from '../shared/ciencia.js'
import { CIUDADES, escenarioDe } from '../shared/escenarios.js'
import { analizarCarga } from '../shared/plan.js'
import {
  PEINADOS,
  ROLE_BY_ID,
  SITE_BY_ID,
  TAREAS_ENSAMBLAJE,
  TRAJE_COLORES,
  TRAJE_PELOS,
  TRAJE_PIELES,
  TRAJE_VISORES,
  masaTotal,
  nombreSistema,
  type EtapaBot,
  type Emergency,
  type EmergencyAlternative,
  type Loadout,
  type MemoriaBot,
  type Player,
  type Proposal,
  type RacionComida,
  type Role,
  type RoomState,
  type SistemaId,
  type Zona,
} from '../shared/types.js'
import { conRol, limitar, rid, sis, tripulacion } from './base.js'
import { UMBRAL_AVERIA } from './emergencies.js'
import {
  accion,
  ajustarCargamento,
  aplicarPreset,
  cambiarZona,
  elegirAlternativa,
  elegirRol,
  fijarActividad,
  fijarEscala,
  fijarPaso,
  hacerTarea,
  irAyudar,
  lanzar,
  marcarListo,
  nombrarMision,
  nuevoJugador,
  proponerUbicacion,
  votar,
} from './game.js'
import { pasoProcedimiento, procedimientosPendientes, valorExperto, type Pendiente } from './procedimientos.js'
import { ahora, azar } from './reloj.js'
import { enSuperficie } from './sim/ambiente.js'
import { diasRestantes } from './sim/paso.js'

// ---------- Datos ----------

const NOMBRES = ['Valeria', 'Mateo', 'Camila', 'Joaquín', 'Lucía', 'Andrés', 'Ximena', 'Rodrigo', 'Daniela', 'Tomás', 'Renata', 'Santiago', 'Isabel', 'Gabriel', 'Mariana', 'Emilio', 'Paola', 'Nicolás']
/** Nombres en quechua para la misión: viento, sol, luna, mensajero, cóndor, rayo. */
const NOMBRES_MISION = ['Wayra 1', 'Inti 1', 'Killa 1', 'Chaski 1', 'Kuntur 1', 'Illapa 1']
/** Orden en que los bots toman los roles que quedan libres. */
const ORDEN_ROLES: Role[] = ['comandante', 'piloto', 'sistemas', 'medico', 'logistica', 'cientifico']
const FRASE_ROL: Record<Role, string> = {
  comandante: 'I will take command. I authorize the launch.',
  piloto: 'I will take navigation.',
  medico: 'I will look after everyone\'s health.',
  logistica: 'I will handle the supplies and the rations.',
  cientifico: 'I will take care of the samples and the garden.',
  sistemas: 'I will look after the equipment.',
}
const FACTOR_RACION: Record<RacionComida, number> = { normal: 1, ahorro: 0.8, estricto: 0.6 }
const NOMBRE_RECURSO = { comida: 'food', agua: 'water', aire: 'air' } as const
/** Inicial en minúscula, para mitad de frase (respeta los nombres propios que siguen). */
const minus = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
/** Quién hace cada tarea de ensamblaje cuando la comparten dos roles. */
const PREFERIDO: Record<string, Role> = { paneles: 'piloto', carga: 'logistica', energia: 'sistemas', soporte: 'comandante', revisionInt: 'sistemas', revisionExt: 'sistemas' }

/** Velocidad a la que camina un bot, m/s. */
const VELOCIDAD = 1.4
/** Lo que se espera a que la persona haga una tarea compartida antes de que la haga un bot. */
const ESPERA_HUMANO_MS = 90_000
/** Margen antes del vencimiento de una emergencia en que un bot decide si la persona no lo hizo. */
const MARGEN_EMERGENCIA_MS = 12_000

/**
 * Copia de las estaciones de src/mundo/mapa.ts (el servidor no importa código del cliente).
 * Si cambian allí, hay que cambiarlas aquí.
 */
const ESTACIONES: Record<string, { zona: Zona; nombre: string; x: number; z: number; radio: number }> = {
  puente: { zona: 'nave', nombre: 'the Bridge', x: -7.6, z: 0, radio: 0.85 },
  soporte: { zona: 'nave', nombre: 'Life Support', x: -4.6, z: -2.6, radio: 0 },
  energia: { zona: 'nave', nombre: 'the Power station', x: -1.5, z: -2.6, radio: 0 },
  almacen: { zona: 'nave', nombre: 'Storage', x: 1.6, z: -2.6, radio: 0 },
  laboratorio: { zona: 'nave', nombre: 'the Lab & Garden', x: 4.7, z: -2.6, radio: 0 },
  enfermeria: { zona: 'nave', nombre: 'the Medical Bay', x: -4.6, z: 2.6, radio: 0 },
  ejercicio: { zona: 'nave', nombre: 'the Gym', x: -1.5, z: 2.6, radio: 0 },
  literas: { zona: 'nave', nombre: 'the Bunks', x: 1.6, z: 2.6, radio: 0 },
  refugio: { zona: 'nave', nombre: 'the Storm Shelter', x: 4.7, z: 2.6, radio: 0 },
  esclusa: { zona: 'nave', nombre: 'the Airlock', x: 8.4, z: 0, radio: 0 },
  comedor: { zona: 'nave', nombre: 'the Galley Table', x: 0.05, z: 0, radio: 0.62 },
  esclusaExt: { zona: 'exterior', nombre: 'the Airlock', x: 10.6, z: 0, radio: 0 },
  plantaExt: { zona: 'exterior', nombre: 'the Power Plant', x: 14.5, z: -8, radio: 1.1 },
  campoSolar: { zona: 'exterior', nombre: 'the Solar Arrays', x: 21, z: -15, radio: 0 },
  carga: { zona: 'exterior', nombre: 'the Cargo Area', x: 17, z: 10, radio: 1.6 },
  antena: { zona: 'exterior', nombre: 'the Antenna & Hull', x: -12.5, z: -7, radio: 0.7 },
  isruExt: { zona: 'exterior', nombre: 'the Ice Extractor', x: -17, z: 12, radio: 1.3 },
  muestra1: { zona: 'exterior', nombre: 'Sample Site 1', x: 25, z: 5, radio: 0 },
  muestra2: { zona: 'exterior', nombre: 'Sample Site 2', x: -23, z: -5, radio: 0 },
  muestra3: { zona: 'exterior', nombre: 'Sample Site 3', x: 7, z: 27, radio: 0 },
  muestra4: { zona: 'exterior', nombre: 'Sample Site 4', x: -9, z: -25, radio: 0 },
  muestra5: { zona: 'exterior', nombre: 'Sample Site 5', x: 32, z: -20, radio: 0 },
  muestra6: { zona: 'exterior', nombre: 'Sample Site 6', x: -29, z: 15, radio: 0 },
  muestra7: { zona: 'exterior', nombre: 'Sample Site 7', x: 21, z: 31, radio: 0 },
  muestra8: { zona: 'exterior', nombre: 'Sample Site 8', x: -31, z: -27, radio: 0 },
}
/** Puesto habitual de cada rol y punto de aparición al cruzar la esclusa (como en mapa.ts). */
const PUESTO: Record<Role, { x: number; z: number }> = {
  comandante: { x: -6.2, z: 0.9 },
  piloto: { x: -6.2, z: -0.9 },
  medico: { x: -4.6, z: 1.5 },
  logistica: { x: 1.6, z: -1.5 },
  cientifico: { x: 4.7, z: -1.5 },
  sistemas: { x: -1.5, z: -1.5 },
}
const ENTRADA: Record<Zona, { x: number; z: number }> = { nave: { x: 6.9, z: 0 }, exterior: { x: 12.4, z: 0 } }
/** Bloque del hábitat visto desde fuera: no se puede atravesar. */
const HABITAT = { x: 9.7, z: 3.9 }

/** Dónde se para un bot para usar una estación y hacia dónde mira. */
export function puntoDe(id: string): { x: number; z: number; zona: Zona; cx: number; cz: number } | null {
  const e = ESTACIONES[id]
  if (!e) return null
  let x = e.x
  let z = e.z
  if (e.zona === 'nave') {
    if (Math.abs(e.z) > 1.9) z = Math.sign(e.z) * 1.85
    else if (id === 'comedor') z = -1.05
    else x -= Math.sign(e.x) * (e.radio + 0.6)
    x = limitar(x, -8, 8.1)
  } else {
    // A un paso del equipo, del lado del hábitat.
    const dx = 11 - e.x
    const dz = -e.z
    const d = Math.hypot(dx, dz) || 1
    const sep = e.radio + 0.7
    if (d > sep) {
      x += (dx / d) * sep
      z += (dz / d) * sep
    }
  }
  return { x, z, zona: e.zona, cx: e.x, cz: e.z }
}

const elegir = <T>(room: RoomState, lista: readonly T[]): T => lista[Math.floor(azar(room) * lista.length)]

// ---------- Crear la tripulación ----------

/** Añade cinco tripulantes bot a una sala recién creada en modo de un jugador. */
export function agregarBots(room: RoomState) {
  const usados = new Set(room.jugadores.map((j) => j.nombre.toLowerCase()))
  const colores = TRAJE_COLORES.filter((c) => !room.jugadores.some((o) => o.traje.color === c))
  const ciudades = CIUDADES.map((c) => c.id as string)
  for (let i = 0; room.jugadores.length < 6 && i < 20; i++) {
    const nombre = elegir(room, NOMBRES)
    if (usados.has(nombre.toLowerCase())) continue
    usados.add(nombre.toLowerCase())
    const j = nuevoJugador(`bot-${room.jugadores.length}`, nombre)
    // Cada uno con su traje: el color no se repite y la franja contrasta con él.
    const color = colores.splice(Math.floor(azar(room) * colores.length), 1)[0] ?? TRAJE_COLORES[0]
    j.traje = {
      color,
      acento: elegir(room, TRAJE_COLORES.filter((c) => c !== color)),
      visor: elegir(room, TRAJE_VISORES),
      piel: elegir(room, TRAJE_PIELES),
      pelo: elegir(room, TRAJE_PELOS),
      peinado: elegir(room, PEINADOS).id,
    }
    j.hogar = ciudades.splice(Math.floor(azar(room) * ciudades.length), 1)[0] ?? null
    j.bot = true
    j.estacion = null
    room.jugadores.push(j)
  }
}

// ---------- Memoria, chat y esperas ----------

function mem(room: RoomState, j: Player): MemoriaBot {
  room.bots ??= {}
  let m = room.bots[j.id]
  if (!m) {
    const p = PUESTO[j.rol ?? 'comandante']
    m = room.bots[j.id] = { libre: ahora() + 2500 + azar(room) * 4000, habla: 0, x: p.x, z: p.z, trabajo: null, marcas: {} }
  }
  return m
}

/** Devuelve true cuando ya pasó un rato desde que el bot notó `clave` (se lo pensó). */
function madura(room: RoomState, m: MemoriaBot, clave: string, minMs: number, maxMs: number): boolean {
  const k = `~${clave}`
  if (m.marcas[k] === undefined) {
    m.marcas[k] = ahora() + minMs + azar(room) * (maxMs - minMs)
    return false
  }
  return ahora() >= m.marcas[k]
}

/** Cuánto lleva esperando algo (ms) desde la primera vez que se preguntó. */
function esperando(m: MemoriaBot, clave: string): number {
  const k = `~espera:${clave}`
  m.marcas[k] ??= ahora()
  return ahora() - m.marcas[k]
}

/** Olvida las marcas pasajeras viejas para que la memoria no crezca sin límite. */
function podar(m: MemoriaBot) {
  const limite = ahora() - 600_000
  for (const k of Object.keys(m.marcas)) {
    if (k.includes('~') && m.marcas[k] < (k.startsWith('~espera:') ? limite - 3_000_000 : limite)) delete m.marcas[k]
  }
}

/**
 * Un mensaje del bot en el chat de la tripulación. Cada bot habla como mucho una vez cada 8
 * segundos y nunca encima de otro bot; `clave` evita repetir lo mismo antes de `cadaMs`.
 */
function decir(room: RoomState, j: Player, texto: string, clave?: string, cadaMs = Infinity, forzar = false): boolean {
  const m = mem(room, j)
  const t = ahora()
  if (!forzar) {
    if (t - m.habla < 8000) return false
    const ultimo = room.chat[room.chat.length - 1]
    if (ultimo && t - ultimo.t < 3000 && room.jugadores.some((o) => o.bot && o.nombre === ultimo.de)) return false
  }
  if (clave) {
    const k = `dicho:${clave}`
    const antes = m.marcas[k]
    if (antes !== undefined && t - antes < cadaMs) return false
    m.marcas[k] = t
  }
  room.chat.push({ id: rid(room), de: j.nombre, texto, t, bot: false })
  if (room.chat.length > 40) room.chat.splice(0, room.chat.length - 40)
  m.habla = t
  return true
}

const humano = (room: RoomState) => room.jugadores.find((j) => !j.bot) ?? null
const deRol = (room: RoomState, rol: Role) => room.jugadores.find((j) => j.rol === rol) ?? null
const botDeRol = (room: RoomState, rol: Role) => room.jugadores.find((j) => j.bot && j.rol === rol) ?? null
/** El bot que habla por la tripulación: el de ese rol, el comandante o el primero. */
const portavoz = (room: RoomState, bots: Player[], rol?: Role) => (rol && botDeRol(room, rol)) || botDeRol(room, 'comandante') || bots[0]
const r0 = (v: number) => Math.round(Math.min(999, v))
/** El nombre del equipo con su artículo: «the CO2 Scrubber», «the Airlock». */
const elSistema = (id: SistemaId) => `the ${nombreSistema(id)}`
const decideComandante = (room: RoomState) => room.modoDecision === 'comandante' && conRol(room, 'comandante').length > 0

// ---------- Entrada desde la simulación ----------

/** Un segundo de reloj de la sala para los bots. Lo llama `avanzar` en las salas con bots. */
export function pasoTripulantes(room: RoomState) {
  const bots = room.jugadores.filter((j) => j.bot)
  if (!bots.length || room.fase === 'lobby') return
  try {
    if (room.fase === 'contexto') contexto(room, bots)
    else mision(room, bots)
    for (const j of bots) podar(mem(room, j))
  } catch (e) {
    // Un fallo de un bot nunca debe tumbar la sala.
    console.error('[tripulantes]', e)
  }
}

// ---------- Contextualización ----------

function contexto(room: RoomState, bots: Player[]) {
  const persona = humano(room)
  let actuo = false
  for (const j of bots) {
    const m = mem(room, j)
    // Si la persona le pidió su rol, el bot lo cede y lo dice.
    const rolPrevio = m.marcas.rol === undefined ? null : ORDEN_ROLES[m.marcas.rol]
    if (j.rol && rolPrevio && j.rol !== rolPrevio) decir(room, j, `You can have ${ROLE_BY_ID[rolPrevio].nombre}. I will take ${ROLE_BY_ID[j.rol].nombre}.`, undefined, Infinity, true)
    if (j.rol) m.marcas.rol = ORDEN_ROLES.indexOf(j.rol)
    else delete m.marcas.rol
    if (actuo || ahora() < m.libre) continue
    const hecho = actuarContexto(room, j, m, persona)
    if (hecho) {
      actuo = true // uno por segundo, para que se vea a la gente avanzar de a poco
      m.libre = ahora() + 2500 + azar(room) * 4000
    }
  }
}

function actuarContexto(room: RoomState, j: Player, m: MemoriaBot, persona: Player | null): boolean {
  if (j.paso === 0) return fijarPaso(room, j.id, 1) === null
  if (!j.rol) {
    // La persona elige primero; los bots se reparten lo que queda.
    if (persona && !persona.rol) return false
    const libre = ORDEN_ROLES.find((r) => !room.jugadores.some((o) => o.rol === r))
    if (!libre || elegirRol(room, j.id, libre) !== null) return false
    m.marcas.rol = ORDEN_ROLES.indexOf(libre)
    decir(room, j, FRASE_ROL[libre], undefined, Infinity, true)
    return true
  }
  if (j.paso < 2) return fijarPaso(room, j.id, 2) === null
  if (j.rol === 'comandante' && !m.marcas.objetivo) {
    m.marcas.objetivo = ahora()
    if (!room.nombreMision) nombrarMision(room, j.id, elegir(room, NOMBRES_MISION))
    decir(room, j, `Our mission is called ${room.nombreMision}. We are going for ${room.mision.solesObjetivo} sols on Mars and ${room.mision.diasTransito} days of travel.`, undefined, Infinity, true)
    return true
  }
  if (j.paso < 3) return fijarPaso(room, j.id, 3) === null
  if (j.rol === 'comandante' && !m.marcas.carga) {
    m.marcas.carga = ahora()
    cargar(room, j)
    return true
  }
  if (j.rol === 'logistica' && !m.marcas.revisa && room.masa > 0) {
    m.marcas.revisa = ahora()
    const a = analizarCarga(room)
    const justo = a.comida < a.total || a.agua < a.total
    decir(
      room,
      j,
      justo
        ? `I checked the cargo. Food lasts ${r0(a.comida)} days and water ${r0(a.agua)}, but the mission lasts ${r0(a.total)}. We need to add some.`
        : `I checked the cargo. Food for ${r0(a.comida)} days and the mission lasts ${r0(a.total)}. We are good.`,
      undefined,
      Infinity,
      true,
    )
    return true
  }
  if (!j.listo) return marcarListo(room, j.id, true) === null
  if (j.rol !== 'comandante') {
    if (persona?.rol === 'comandante' && room.jugadores.every((o) => o.listo || !o.bot)) {
      decir(room, j, 'Everyone is ready here. Whenever you are, Commander.', 'listos')
    }
    return false
  }
  // El comandante bot autoriza el despegue cuando la persona está lista.
  if (persona && !persona.listo) {
    decir(room, j, 'When you are ready, mark it and I will authorize the launch.', 'esperaListo', 90_000)
    return false
  }
  if (room.jugadores.some((o) => o.bot && !o.listo)) return false
  if (room.masa > room.capacidad) cargar(room, j)
  if (!madura(room, m, 'lanzar', 2000, 4000)) return false
  decir(room, j, 'Everyone is ready. I authorize the launch.', undefined, Infinity, true)
  const error = lanzar(room, j.id)
  if (error) decir(room, j, `I cannot authorize it yet. ${error}`, 'errorLanzar', 60_000, true)
  return true
}

/** El comandante bot elige la alternativa equilibrada y recorta lo menos vital si no cabe. */
function cargar(room: RoomState, j: Player) {
  aplicarPreset(room, 'equilibrado')
  const carga: Loadout = { ...room.cargamento }
  if (room.escenario === 'tormentaPolvo') carga.reactor = 1
  const recortes: [keyof Loadout, number][] = [['blindaje', 0], ['huerto', 0], ['oxigeno', 1], ['paneles', 3], ['baterias', 1], ['repuestos', 8]]
  for (const [id, minimo] of recortes) {
    while (masaTotal(carga) > room.capacidad && carga[id] > minimo) carga[id] -= 1
  }
  ajustarCargamento(room, carga)
  const consejo = escenarioDe(room.escenario).consejo
  decir(room, j, `I chose the Balanced cargo: ${room.masa.toFixed(1)} of ${room.capacidad.toFixed(1)} tons.${consejo && room.escenario === 'tormentaPolvo' ? ' We are taking the reactor because of the storms.' : ''}`, undefined, Infinity, true)
}

// ---------- Misión ----------

function mision(room: RoomState, bots: Player[]) {
  sucesos(room, bots)
  const quietos = room.fase === 'fin' || room.fase === 'lanzamiento' || (room.fase === 'llegada' && room.subfase === 'descenso')
  if (quietos) {
    for (const j of bots) {
      mem(room, j).trabajo = null
      j.estacion = null
    }
    return
  }
  for (const j of bots) {
    const m = mem(room, j)
    votarPropuestas(room, j, m)
    emergencia(room, j, m)
    if (j.rol === 'comandante') mando(room, j, m)
  }
  pedidos(room, bots)
  for (const j of bots) trabajar(room, j, mem(room, j))
}

/** Lo que dice la tripulación en los momentos clave del viaje. */
function sucesos(room: RoomState, bots: Player[]) {
  const piloto = portavoz(room, bots, 'piloto')
  const cmd = portavoz(room, bots, 'comandante')
  if (room.fase === 'lanzamiento' && room.t > 20) decir(room, piloto, 'Clean liftoff. All engines in the green.', 'despegue')
  if (room.fase === 'transito' && room.vuelo.progreso < 0.05) decir(room, cmd, `Orbit reached. Heading for Mars, ${room.mision.diasTransito} days ahead.`, 'transito')
  if (room.fase === 'llegada' && room.subfase === 'orbita') decir(room, piloto, 'We are in Mars orbit. We need to choose where to land.', 'orbita')
  if (room.fase === 'llegada' && room.subfase === 'descenso') decir(room, piloto, 'Entering the atmosphere. Hold on tight.', 'descenso')
  if (room.fase === 'ensamblaje') decir(room, piloto, 'Touchdown confirmed. We are on Mars.', 'aterrizaje')
  if (room.fase === 'base') decir(room, cmd, 'The base is up and running. Everyone to your stations.', 'base')
  if (room.fase === 'fin' && room.resultado) {
    decir(room, cmd, room.resultado.victoria ? 'Mission accomplished. Thank you, crew.' : 'We did not make it this time. Next time will go better.', 'fin', Infinity, true)
  }
}

// ---------- Votos ----------

function votarPropuestas(room: RoomState, j: Player, m: MemoriaBot) {
  const manda = decideComandante(room)
  if (manda && j.rol !== 'comandante') return
  for (const p of room.propuestas) {
    if (p.estado !== 'pendiente' || typeof p.votos[j.id] === 'boolean') continue
    if (!madura(room, m, `voto:${p.id}`, 2000, 4500)) return
    const juicio = juzgar(room, p)
    votar(room, j.id, p.id, juicio.si)
    const deHumano = !jugadorBot(room, p.proponente)
    if (!juicio.si) decir(room, j, `${manda ? 'I reject' : 'I vote no on'} "${p.titulo}". ${juicio.motivo}`, `~voto:${p.id}`, Infinity, deHumano)
    else if (deHumano && manda) decir(room, j, `Approved: ${minus(p.titulo)}.`, `~voto:${p.id}`)
    return // un voto por segundo
  }
}

const jugadorBot = (room: RoomState, id: string) => Boolean(room.jugadores.find((o) => o.id === id)?.bot)

/** Lo que piensa un bot sensato de una propuesta: aprueba lo razonable y rechaza lo dañino. */
function juzgar(room: RoomState, p: Proposal): { si: boolean; motivo: string } {
  const si = { si: true, motivo: '' }
  const no = (motivo: string) => ({ si: false, motivo })
  const d = p.payload
  const faltan = diasRestantes(room)
  const a = room.autonomia
  switch (p.tipo) {
    case 'racionComida': {
      const nivel = d.nivel as RacionComida
      const completa = a.comida * FACTOR_RACION[room.ajustes.racionComida]
      const conNivel = completa / FACTOR_RACION[nivel]
      if (conNivel < faltan * 0.95) return no(`With that ration the food lasts ${r0(conNivel)} days and there are ${r0(faltan)} days left.`)
      if (nivel === 'estricto' && completa / 0.8 >= faltan) return no('The saver ration is already enough. The strict one weakens us for no reason.')
      if (nivel !== 'normal' && completa >= faltan * 1.15) return no(`There is food for ${r0(completa)} days on the full ration and there are ${r0(faltan)} days left.`)
      return si
    }
    case 'racionAgua':
      return d.nivel === 'normal' && a.agua < faltan * 1.3 ? no('Water is tight. Better to keep saving.') : si
    case 'prioridad':
      return d.valor === 'ciencia' && room.energia.capacidad > 0 && room.energia.bateria < room.energia.capacidad * 0.3 && room.energia.generacion < room.energia.consumo
        ? no('With so little power, the garden cannot come before the heating.')
        : si
    case 'equipo': {
      if (d.activo) return si
      const id = d.sistema as SistemaId
      if (id === 'oga' || id === 'cdra') return no(`Without ${elSistema(id)} the cabin air is at risk.`)
      if (id === 'wrs') return no('Without the recycler we lose almost all the water we use.')
      if (id === 'termico') return no('Without Thermal Control the cabin gets too cold or too hot.')
      if (id === 'isru' && room.mision.aguaObjetivo > room.mision.aguaExtraida) return no('We need the water from the ice to meet the objective.')
      return si
    }
    case 'ejercicio':
      return Number(d.horas) === 0 && a.aire >= faltan && a.agua >= faltan ? no('Without exercise we lose muscle and bone, and we have enough air and water.') : si
    case 'refugio':
      if (d.salir) return room.ambiente.tormentaSolar ? no('The solar storm is still going. Better to wait in the Storm Shelter.') : si
      return room.ambiente.tormentaSolar ? si : no('There is no solar storm. Nobody can work in the Storm Shelter.')
    case 'emergencia': {
      const em = room.emergencias.find((e) => e.id === d.emergenciaId)
      if (!em) return si
      const alt = String(d.altId)
      const mejor = opcion(room, em)
      if (em.tipo === 'fallo' && alt === 'reparar' && mejor.id === 'reinicio') return no(room.rec.repuestos < 2 ? 'There are not enough spare parts. The restart is better.' : 'We have few spare parts left. Let us save them for air and water.')
      if (em.tipo === 'fuga' && alt === 'sellar' && room.rec.repuestos < 1) return no('No spare parts left. Better to close off the section.')
      if ((em.tipo === 'medico' || em.tipo === 'mareo') && alt === 'tratar' && room.rec.botiquines < 1) return no('No medical kits left. Rest is better.')
      const pasiva = em.alternativas[em.alternativas.length - 1].id
      if (alt === pasiva && mejor.id !== pasiva) return no(`Better to ${minus(mejor.etiqueta)}.`)
      return si
    }
    default:
      return si
  }
}

// ---------- Emergencias ----------

/** La alternativa que elegiría alguien que sabe: la más protectora que se puede pagar. */
function opcion(room: RoomState, em: Emergency): EmergencyAlternative {
  let id = em.alternativas[0].id
  switch (em.tipo) {
    case 'fallo':
      // Con pocos repuestos no se gastan en lo que no mantiene viva a la tripulación.
      id = room.rec.repuestos >= (prescindible(room, em.datos.sistema as SistemaId) ? 8 : 2) ? 'reparar' : 'reinicio'
      break
    case 'fuga':
      id = room.rec.repuestos >= 1 ? 'sellar' : 'aislar'
      break
    case 'medico':
    case 'mareo':
      id = room.rec.botiquines >= 1 ? 'tratar' : 'reposo'
      break
    case 'escasez':
      if (em.datos.recurso === 'aire' && sis(room, 'oga').integridad <= UMBRAL_AVERIA) id = 'ejercicio'
      break
  }
  return em.alternativas.find((a) => a.id === id) ?? em.alternativas[0]
}

/** Equipos sin los que se sobrevive: el huerto y el extractor si el agua del hielo no es el objetivo. */
const prescindible = (room: RoomState, id: SistemaId) => id === 'huerto' || (id === 'isru' && room.mision.aguaExtraida >= room.mision.aguaObjetivo)

function porQue(room: RoomState, em: Emergency, alt: EmergencyAlternative): string {
  if (alt.id === 'reparar') return `We have ${room.rec.repuestos} spare part kits left.`
  if (alt.id === 'reinicio') return room.rec.repuestos >= 2 ? `We have ${room.rec.repuestos} kits left, and it is better to save them for air and water.` : 'There are no spare parts to repair it.'
  if (alt.id === 'tratar') return `We have ${room.rec.botiquines} medical kits left.`
  if (alt.id === 'refugio') return 'That way the dose drops a lot.'
  if (alt.id === 'ahora') return 'The sooner, the less propellant.'
  if (alt.id === 'sellar') return 'One kit and the air loss stops.'
  return alt.consecuencia
}

function emergencia(room: RoomState, j: Player, m: MemoriaBot) {
  const em = room.emergencias.find((e) => e.estado === 'activa')
  if (!em || !j.rol) return
  if (room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === 'emergencia' && p.payload.emergenciaId === em.id)) return
  const persona = humano(room)
  // El comandante aprueba; quien sabe del tema decide. Si eso le toca a la persona, se la espera.
  const especialistas = em.rolesResponsables.filter((r) => r !== 'comandante')
  const tecnicos = especialistas.length ? especialistas : em.rolesResponsables
  const deLaPersona = Boolean(persona?.rol && persona.conectado && tecnicos.includes(persona.rol))
  const decide = tecnicos.map((r) => botDeRol(room, r)).find(Boolean) ?? em.rolesResponsables.map((r) => botDeRol(room, r)).find(Boolean) ?? null
  const alt = opcion(room, em)
  if (deLaPersona) {
    // Solo aconseja: el bot que comparte la responsabilidad, o el comandante, o quien sepa más.
    const consejero = decide ?? botDeRol(room, 'comandante') ?? room.jugadores.find((o) => o.bot)
    if (consejero?.id === j.id && madura(room, m, `consejo:${em.id}`, 3000, 6000)) {
      decir(room, j, `${ROLE_BY_ID[persona!.rol!].nombre}, we have this: ${em.titulo}. I would choose: ${minus(alt.etiqueta)}. ${porQue(room, em, alt)}`, `~em:${em.id}`)
    }
    if (decide?.id !== j.id || em.vence - ahora() > MARGEN_EMERGENCIA_MS) return
    decir(room, j, `Time is running out. I will decide: ${minus(alt.etiqueta)}.`, `~emYa:${em.id}`, Infinity, true)
  } else {
    if (decide?.id !== j.id || !madura(room, m, `em:${em.id}`, 2500, 5500)) return
  }
  const error = elegirAlternativa(room, j.id, em.id, alt.id)
  if (error) return
  const propuesta = room.propuestas.find((p) => p.estado === 'pendiente' && p.tipo === 'emergencia' && p.payload.emergenciaId === em.id)
  if (propuesta) {
    if (decideComandante(room) && persona?.rol === 'comandante') decir(room, j, `Commander, we have this: ${em.titulo}. I propose: ${minus(alt.etiqueta)}. ${porQue(room, em, alt)} Approve it in Proposals.`, undefined, Infinity, true)
    else if (!decideComandante(room)) decir(room, j, `For ${em.titulo}, I propose: ${minus(alt.etiqueta)}. Vote in Proposals.`, undefined, Infinity, true)
  } else if (!deLaPersona) {
    decir(room, j, `${em.titulo}. I choose: ${minus(alt.etiqueta)}. ${porQue(room, em, alt)}`)
  }
  // Va hasta el equipo afectado, aunque la decisión ya esté tomada.
  const sistema = em.datos.sistema as SistemaId | undefined
  if (em.tipo === 'fallo' && sistema && !m.trabajo && j.rol === 'sistemas') {
    const estacion = estacionDe(room, sistema)
    if (ESTACIONES[estacion].zona === j.zona) empezar(room, j, m, { que: `ver:${sistema}`, etapas: [etapa(estacion, 4)] })
  }
}

// ---------- Comandante ----------

const ESCALA_FASE: Partial<Record<RoomState['fase'], { valor: number; texto: string }>> = {
  transito: { valor: 86400, texto: 'Speeding up the clock: one day of travel per second.' },
  ensamblaje: { valor: 600, texto: 'Ten minutes per second while we build the base.' },
  base: { valor: 3600, texto: 'Setting the clock to one hour per second.' },
}

/** Con un huerto que cuida una persona, el viaje va a seis horas por segundo: a un día por segundo no da tiempo a regarlo. */
const ESCALA_HUERTO = { valor: 21600, texto: 'Setting the clock to six hours per second so the garden can be looked after.' }

function mando(room: RoomState, j: Player, m: MemoriaBot) {
  const huertoDePersona = room.fase === 'transito' && room.cargamento.huerto > 0 && (deRol(room, 'cientifico') ?? { bot: true }).bot !== true
  const objetivo = huertoDePersona && room.huerto.establecido ? ESCALA_HUERTO : ESCALA_FASE[room.fase]
  const marca = `escala:${room.fase}:${objetivo?.valor}`
  if (objetivo && !m.marcas[marca] && madura(room, m, marca, 3000, 6000)) {
    m.marcas[marca] = ahora()
    if (room.escalaDeseada > objetivo.valor || (room.escalaDeseada !== objetivo.valor && !m.marcas[`escala:${room.fase}`])) {
      if (fijarEscala(room, j.id, objetivo.valor) === null) decir(room, j, objetivo.texto)
    }
    m.marcas[`escala:${room.fase}`] = ahora()
  }
  // Si la persona pilota y no propone sitio, el comandante lo propone tras un buen rato.
  if (room.fase === 'llegada' && room.subfase === 'orbita' && !room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === 'ubicacion')) {
    const piloto = deRol(room, 'piloto')
    if (piloto && !piloto.bot && esperando(m, 'orbita') > 90_000) {
      const sitio = sitioSensato(room)
      if (proponerUbicacion(room, j.id, sitio) === null) decir(room, j, `I will propose ${SITE_BY_ID[sitio].nombre} so we do not lose time.`, undefined, Infinity, true)
    }
  }
}

function sitioSensato(room: RoomState): string {
  return escenarioDe(room.escenario).sitio ?? (room.cargamento.isru > 0 ? 'utopia' : 'gale')
}

// ---------- Pedidos a la persona ----------

/** Un bot le recuerda a la persona lo que su rol tiene pendiente, sin insistir demasiado. */
function pedidos(room: RoomState, bots: Player[]) {
  const persona = humano(room)
  if (!persona?.rol || !persona.conectado || persona.incapacitado > 0) return
  const rol = persona.rol
  const nombreRol = ROLE_BY_ID[rol].nombre
  const habla = (texto: string, clave: string, cadaMs: number, quien = portavoz(room, bots, 'comandante')) => decir(room, quien, texto, clave, cadaMs)
  const faltan = diasRestantes(room)

  // Propuestas que esperan su voto.
  for (const p of room.propuestas) {
    if (p.estado !== 'pendiente' || typeof p.votos[persona.id] === 'boolean' || ahora() - p.creada < 15_000) continue
    if (decideComandante(room) && rol !== 'comandante') continue
    const quien = room.jugadores.find((o) => o.id === p.proponente && o.bot) ?? portavoz(room, bots)
    habla(`We still need your decision on "${p.titulo}".`, `~pv:${p.id}`, Infinity, quien)
  }
  // Tareas de montaje y procedimientos que le tocan.
  const tarea = tareasDeLaPersona(room, persona)[0]
  if (tarea) habla(`${nombreRol}, up next for you: ${tarea.titulo}, at ${ESTACIONES[tarea.estacion]?.nombre ?? 'its station'}.`, 'tarea', 75_000)

  switch (rol) {
    case 'sistemas': {
      const peor = room.sistemas.filter((s) => s.instalado && s.integridad < 50).sort((a, b) => a.integridad - b.integridad)[0]
      if (peor && room.rec.repuestos >= 1) habla(`${nombreRol}, ${elSistema(peor.id)} is at ${Math.round(peor.integridad)}%. It is a good idea to repair it.`, `rep:${peor.id}`, 90_000, portavoz(room, bots, 'logistica'))
      if (room.cabina.fuga > 0 && !room.emergencias.some((e) => e.estado === 'activa' && e.tipo === 'fuga')) habla(`${nombreRol}, the pressure leak is still going. It needs to be sealed.`, 'fuga', 60_000)
      break
    }
    case 'medico':
      for (const o of tripulacion(room)) {
        if (!o.bot || !(o.dolencia || o.vit.salud < 60)) continue
        if (room.emergencias.some((e) => e.estado === 'activa' && e.datos.jugadorId === o.id)) continue
        habla(o.dolencia ? `${nombreRol}, I have ${o.dolencia}. Can you treat me in the Medical Bay?` : `${nombreRol}, I do not feel well. Can you check me in the Medical Bay?`, `paciente:${o.id}`, 120_000, o)
      }
      break
    case 'cientifico': {
      const mis = room.mision
      const hora = room.ambiente.hora
      if (room.fase === 'base' && persona.muestras > 0 && persona.zona === 'nave') habla('You already have samples. Analyze them in the lab.', 'analiza', 120_000)
      else if (room.fase === 'base' && mis.muestrasAnalizadas + persona.muestras < mis.muestrasObjetivo && hora > 9 && hora < 15 && persona.zona === 'nave') {
        habla(`There is good light outside. We still need ${mis.muestrasObjetivo - mis.muestrasAnalizadas} samples for the objective.`, 'muestras', 180_000)
      }
      if (room.cargamento.huerto > 0 && !room.huerto.establecido && (room.fase === 'transito' || room.fase === 'base')) habla('When you can, set up the garden in the lab.', 'huerto', 240_000)
      break
    }
    case 'piloto':
      if (room.fase === 'llegada' && room.subfase === 'orbita' && !room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === 'ubicacion')) {
        habla(`${nombreRol}, choose the landing site from the Bridge.`, 'sitio', 40_000)
      }
      if (room.fase === 'base' && room.energia.polvo > 0.1 && room.ambiente.hora > 9 && room.ambiente.hora < 16) {
        habla(`The panels are losing ${Math.round(room.energia.polvo * 100)}% to dust. Can you go out and clean them?`, 'polvo', 150_000, portavoz(room, bots, 'logistica'))
      }
      break
    case 'logistica':
      for (const recurso of ['comida', 'agua', 'aire'] as const) {
        if (room.autonomia[recurso] < faltan * 0.95) habla(`${nombreRol}, ${NOMBRE_RECURSO[recurso]} lasts ${r0(room.autonomia[recurso])} days and there are ${r0(faltan)} days left.`, `escasez:${recurso}`, 150_000)
      }
      break
    case 'comandante': {
      const calma = !room.emergencias.some((e) => e.estado === 'activa') && room.jugadores.every((o) => o.zona === 'nave')
      const sugerida = ESCALA_FASE[room.fase]?.valor
      if (calma && sugerida && room.escalaDeseada < sugerida / 4 && room.t - room.tFase > 60) {
        habla('Commander, everything is stable. We can speed up time.', `acelera:${room.fase}`, 180_000, portavoz(room, bots, 'piloto'))
      }
      break
    }
  }
}

/** Tareas de montaje y pasos de procedimiento que esperan a la persona. */
function tareasDeLaPersona(room: RoomState, persona: Player): { clave: string; titulo: string; estacion: string }[] {
  const lista: { clave: string; titulo: string; estacion: string }[] = []
  for (const p of pendientes(room)) {
    if (titularDe(room, p.roles)?.id === persona.id) lista.push({ clave: `${p.procId}:${p.paso}`, titulo: 'the next step of the procedure', estacion: p.estacion })
  }
  if (usarTareasSimples(room)) {
    for (const t of tareasAbiertas(room)) {
      if (titularDe(room, t.roles, PREFERIDO[t.id])?.id === persona.id) lista.push({ clave: t.id, titulo: t.titulo.charAt(0).toLowerCase() + t.titulo.slice(1), estacion: t.estacion })
    }
  }
  return lista
}

// ---------- Trabajo físico ----------

type Plan = { que: string; etapas: EtapaBot[] }

const etapa = (estacion: string, segundos: number, hacer: Record<string, unknown> | null = null): EtapaBot => ({ estacion, zona: ESTACIONES[estacion].zona, segundos, hacer })

function estacionDe(room: RoomState, id: SistemaId): string {
  switch (id) {
    case 'energia':
      return enSuperficie(room) ? 'plantaExt' : 'energia'
    case 'isru':
      return 'isruExt'
    case 'esclusa':
      return 'esclusa'
    case 'huerto':
      return 'laboratorio'
    default:
      return 'soporte'
  }
}

function puedeSalir(room: RoomState, j: Player): boolean {
  return (
    enSuperficie(room) &&
    (room.fase === 'ensamblaje' || room.fase === 'base') &&
    sis(room, 'esclusa').integridad > UMBRAL_AVERIA &&
    j.trajeO2 >= C.TRAJE_O2_KG * 0.35 &&
    j.trajeBateria >= 0.35
  )
}

/**
 * Las etapas en orden, cruzando la esclusa cada vez que cambia de zona. Si `volver`, al final
 * entra al hábitat; si no, se queda fuera por si el siguiente paso también es fuera.
 */
function ruta(room: RoomState, j: Player, pasos: EtapaBot[], volver = true): EtapaBot[] | null {
  const res: EtapaBot[] = []
  let zona = j.zona
  for (const p of pasos) {
    if (p.zona !== zona) {
      if (p.zona === 'exterior') {
        if (!puedeSalir(room, j)) return null
        res.push(etapa('esclusa', 2, { op: 'zona', zona: 'exterior' }))
      } else res.push(etapa('esclusaExt', 2, { op: 'zona', zona: 'nave' }))
      zona = p.zona
    }
    res.push(p)
  }
  if (zona === 'exterior' && volver) res.push(etapa('esclusaExt', 2, { op: 'zona', zona: 'nave' }))
  return res
}

const caminarMs = (m: MemoriaBot, p: { x: number; z: number; zona: Zona }) =>
  Math.round((Math.hypot(p.x - m.x, p.z - m.z) / VELOCIDAD) * 1000 * (p.zona === 'exterior' ? 1.25 : 1))

function iniciarEtapa(j: Player, m: MemoriaBot) {
  const tr = m.trabajo!
  const et = tr.etapas[0]
  const p = puntoDe(et.estacion)!
  tr.hasta = ahora() + caminarMs(m, p) + et.segundos * 1000
  j.estacion = et.estacion
}

function empezar(room: RoomState, j: Player, m: MemoriaBot, plan: Plan) {
  if (!plan.etapas.length) return
  if (j.manual) fijarActividad(room, j.id, null)
  // Quien lleva un rato sin trabajar ya volvió a su puesto.
  if (j.zona === 'nave' && j.rol && ahora() - (m.marcas.fin ?? 0) > 8000) {
    m.x = PUESTO[j.rol].x
    m.z = PUESTO[j.rol].z
  }
  m.trabajo = { que: plan.que, etapas: plan.etapas, hasta: 0 }
  iniciarEtapa(j, m)
}

function trabajar(room: RoomState, j: Player, m: MemoriaBot) {
  if (!j.rol) return
  if (j.incapacitado > 0 || j.enRefugio) {
    m.trabajo = null
    j.estacion = null
    return
  }
  if (m.trabajo) return avanzarTrabajo(room, j, m)
  if (ahora() < m.libre) return
  let plan = decidir(room, j, m)
  if (!plan && j.zona === 'exterior') plan = { que: 'volver', etapas: [etapa('esclusaExt', 1, { op: 'zona', zona: 'nave' })] }
  if (plan) empezar(room, j, m, plan)
  else {
    j.estacion = null
    m.libre = ahora() + 2000 + azar(room) * 2500
    vida(room, j, m)
  }
}

function avanzarTrabajo(room: RoomState, j: Player, m: MemoriaBot) {
  const tr = m.trabajo!
  const et = tr.etapas[0]
  if (et.zona !== j.zona) {
    // Lo movieron (un rescate, el refugio): deja lo que hacía.
    m.trabajo = null
    j.estacion = null
    return
  }
  if (ahora() < tr.hasta) return
  const error = et.hacer ? ejecutar(room, j, et.hacer) : null
  const cruzo = !error && et.hacer?.op === 'zona'
  const p = cruzo ? ENTRADA[j.zona] : puntoDe(et.estacion)!
  m.x = p.x
  m.z = p.z
  if (error) {
    m.marcas[`~error:${tr.que}`] = ahora()
    // Si estaba fuera, al menos vuelve a entrar.
    const vuelta = tr.etapas.slice(1).filter((e) => e.hacer?.op === 'zona' && e.hacer.zona === 'nave')
    tr.etapas = j.zona === 'exterior' && vuelta.length ? [vuelta[vuelta.length - 1]] : []
  } else {
    if (et.hacer) relatar(room, j, et.hacer)
    tr.etapas.shift()
  }
  if (!tr.etapas.length) {
    m.trabajo = null
    j.estacion = null
    m.marcas.fin = ahora()
    m.libre = ahora() + 1500 + azar(room) * 2500
    return
  }
  iniciarEtapa(j, m)
}

/** Hace lo que la etapa pide, con las mismas funciones que usan las personas. */
function ejecutar(room: RoomState, j: Player, h: Record<string, unknown>): string | null {
  switch (h.op) {
    case 'zona':
      return cambiarZona(room, j.id, h.zona as Zona)
    case 'tarea':
      return hacerTarea(room, j.id, String(h.tarea))
    case 'proc': {
      const procId = String(h.procId)
      const paso = Number(h.paso)
      return pasoProcedimiento(room, j.id, procId, paso, valorExperto(room, procId, paso))
    }
    case 'ubicacion':
      return proponerUbicacion(room, j.id, String(h.sitio))
    case 'accion':
      return accion(room, j.id, String(h.tipo), (h.datos as Record<string, unknown>) ?? {})
  }
  return null
}

/** Cuenta en el chat lo que acaba de hacer, si vale la pena. */
function relatar(room: RoomState, j: Player, h: Record<string, unknown>) {
  if (h.op === 'tarea') {
    const t = TAREAS_ENSAMBLAJE.find((x) => x.id === h.tarea)
    if (t) decir(room, j, `Done: ${minus(t.titulo)}.`)
    return
  }
  if (h.op === 'ubicacion') {
    const sitio = SITE_BY_ID[String(h.sitio)]
    pedirAprobacion(room, j, `landing at ${sitio.nombre}`)
    return
  }
  if (h.op !== 'accion') return
  const d = (h.datos as Record<string, unknown>) ?? {}
  switch (h.tipo) {
    case 'reparar': {
      const s = sis(room, d.sistema as SistemaId)
      decir(room, j, `I repaired ${elSistema(s.id)}. It is at ${Math.round(s.integridad)}% and we have ${room.rec.repuestos} kits left.`)
      break
    }
    case 'sellar':
      decir(room, j, 'Leak sealed. The cabin is no longer losing air.')
      break
    case 'lioh':
      decir(room, j, `I installed a lithium hydroxide cartridge. ${room.rec.lioh} left.`)
      break
    case 'tratar': {
      const paciente = room.jugadores.find((o) => o.id === d.jugadorId)
      if (paciente) decir(room, j, paciente.id === j.id ? 'I treated myself in the Medical Bay. I am fine now.' : `I treated ${paciente.nombre}.`)
      break
    }
    case 'analizar':
      decir(room, j, `Samples analyzed. We have ${room.mision.muestrasAnalizadas} of ${room.mision.muestrasObjetivo}.`)
      break
    case 'limpiar':
      decir(room, j, 'Panels clean. They are back to full power.')
      break
    case 'huerto':
      decir(room, j, room.huerto.establecido ? 'The garden is ready. The first harvest comes in 28 days.' : `The garden is ${room.huerto.progreso}% done.`)
      break
    case 'racionComida':
    case 'racionAgua':
    case 'equipo':
    case 'ejercicio':
    case 'refugio':
    case 'prioridad': {
      const p = room.propuestas.find((x) => x.proponente === j.id)
      if (p?.estado === 'pendiente') pedirAprobacion(room, j, minus(p.titulo))
      break
    }
  }
}

function pedirAprobacion(room: RoomState, j: Player, que: string) {
  const persona = humano(room)
  if (decideComandante(room) && persona?.rol === 'comandante') decir(room, j, `Commander, I propose: ${que}. Check it in Proposals.`, undefined, Infinity, true)
  else if (!decideComandante(room)) decir(room, j, `I propose: ${que}. Vote in Proposals.`, undefined, Infinity, true)
}

// ---------- Qué hacer ahora ----------

function pendientes(room: RoomState): Pendiente[] {
  try {
    return procedimientosPendientes(room)
  } catch {
    return []
  }
}

/** Mientras los procedimientos no existan, el montaje se hace con las tareas de un paso. */
const usarTareasSimples = (room: RoomState) =>
  room.fase === 'ensamblaje' && pendientes(room).length === 0 && Object.keys(room.procedimientos ?? {}).length === 0

const tareasAbiertas = (room: RoomState) =>
  room.fase === 'ensamblaje' ? TAREAS_ENSAMBLAJE.filter((t) => t.paso === room.ensamblaje.paso && !room.ensamblaje.hechas[t.id]) : []

/** Quién hace algo que comparten varios roles: el preferido, o el primero de la lista que exista. */
function titularDe(room: RoomState, roles: Role[], preferido?: Role): Player | null {
  const orden = preferido ? [preferido, ...roles.filter((r) => r !== preferido)] : roles
  for (const r of orden) {
    const o = deRol(room, r)
    if (o) return o
  }
  return null
}

/**
 * ¿Le toca a este bot? Si el titular es la persona, se la espera; si tarda mucho, lo hace un bot
 * que comparte la tarea, para no detener la base.
 */
function meToca(room: RoomState, j: Player, m: MemoriaBot, roles: Role[], clave: string, preferido?: Role): boolean {
  const titular = titularDe(room, roles, preferido)
  if (!titular || !j.rol) return false
  if (titular.id === j.id) return true
  if (titular.bot || !roles.includes(j.rol) || !titular.conectado) return false
  if (esperando(m, clave) < ESPERA_HUMANO_MS) return false
  decir(room, j, 'I will do it so the base is not delayed.', `~relevo:${clave}`)
  return true
}

const bloqueado = (m: MemoriaBot, que: string) => ahora() - (m.marcas[`~error:${que}`] ?? -1e15) < 20_000

function decidir(room: RoomState, j: Player, m: MemoriaBot): Plan | null {
  const plan = (que: string, pasos: EtapaBot[], volver = true): Plan | null => {
    if (bloqueado(m, que)) return null
    const etapas = ruta(room, j, pasos, volver)
    return etapas ? { que, etapas } : null
  }
  const persona = humano(room)
  // Con el traje bajo, primero vuelve a entrar.
  if (j.zona === 'exterior' && (j.trajeO2 < C.TRAJE_O2_KG * 0.35 || j.trajeBateria < 0.35)) return null

  // Alguien pidió ayuda a su rol.
  if (persona?.ayuda && (persona.ayuda.paraRol === j.rol || (j.rol === 'comandante' && !botDeRol(room, persona.ayuda.paraRol))) && madura(room, m, `ayuda:${persona.ayuda.desde}`, 2000, 4000)) {
    if (irAyudar(room, j.id, persona.id) === null) {
      decir(room, j, j.rol === 'medico' ? 'On my way. I will wait for you in the Medical Bay.' : 'On my way.', undefined, Infinity, true)
      if (j.rol === 'medico' && (persona.dolencia || persona.vit.salud < 60) && room.rec.botiquines > 0) {
        return plan('tratar', [etapa('enfermeria', 5, { op: 'accion', tipo: 'tratar', datos: { jugadorId: persona.id } })])
      }
    }
  }

  // Procedimientos por pasos (montaje, huerto) que le tocan a su rol.
  for (const p of pendientes(room)) {
    // Si un bot ya relevó a la persona en un procedimiento, lo termina él.
    if (!ESTACIONES[p.estacion] || !meToca(room, j, m, p.roles, `proc:${p.procId}`)) continue
    const hecho = plan(`proc:${p.procId}:${p.paso}`, [{ estacion: p.estacion, zona: p.zona, segundos: Math.max(1, p.segundos), hacer: { op: 'proc', procId: p.procId, paso: p.paso } }], false)
    if (hecho) return hecho
  }
  if (usarTareasSimples(room)) {
    for (const t of tareasAbiertas(room)) {
      if (!meToca(room, j, m, t.roles, `tarea:${t.id}`, PREFERIDO[t.id])) continue
      const hecho = plan(`tarea:${t.id}`, [etapa(t.estacion, 5, { op: 'tarea', tarea: t.id })], false)
      if (hecho) return hecho
    }
  }

  switch (j.rol) {
    case 'sistemas':
      return sistemas(room, j, plan)
    case 'medico':
      return medico(room, j, m, plan)
    case 'logistica':
      return logistica(room, j, plan)
    case 'cientifico':
      return cientifico(room, j, m, plan)
    case 'piloto':
      return piloto(room, j, plan) ?? paseo(room, j, plan)
    default:
      return paseo(room, j, plan)
  }
}

type Planificar = (que: string, pasos: EtapaBot[], volver?: boolean) => Plan | null
const hayPendiente = (room: RoomState, tipo: Proposal['tipo'], filtro?: (p: Proposal) => boolean) =>
  room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === tipo && (!filtro || filtro(p)))
const emergenciaActiva = (room: RoomState, filtro: (e: Emergency) => boolean) => room.emergencias.some((e) => e.estado === 'activa' && filtro(e))

function sistemas(room: RoomState, j: Player, plan: Planificar): Plan | null {
  if (room.cabina.fuga > 0 && room.rec.repuestos >= 1 && !emergenciaActiva(room, (e) => e.tipo === 'fuga')) {
    const p = plan('sellar', [etapa('soporte', 5, { op: 'accion', tipo: 'sellar', datos: {} })])
    if (p) return p
  }
  if (!sis(room, 'cdra').operativo && room.cabina.ppCO2 > C.PPCO2_LIMITE_KPA && room.rec.lioh > 0 && room.rec.liohActivo < 1) {
    const p = plan('lioh', [etapa('soporte', 3, { op: 'accion', tipo: 'lioh', datos: {} })])
    if (p) return p
  }
  // Repara antes de que el equipo baje del 50%, el más gastado primero.
  const gastados = room.sistemas
    .filter((s) => s.instalado && s.integridad < 55 && room.rec.repuestos >= (prescindible(room, s.id) ? 8 : 2) && !emergenciaActiva(room, (e) => e.tipo === 'fallo' && e.datos.sistema === s.id))
    .sort((a, b) => a.integridad - b.integridad)
  for (const s of gastados) {
    const p = plan(`reparar:${s.id}`, [etapa(estacionDe(room, s.id), 6, { op: 'accion', tipo: 'reparar', datos: { sistema: s.id } })])
    if (p) return p
  }
  return paseo(room, j, plan)
}

function medico(room: RoomState, j: Player, m: MemoriaBot, plan: Planificar): Plan | null {
  if (room.rec.botiquines > 0) {
    for (const o of tripulacion(room)) {
      if (!(o.dolencia || o.vit.salud < 60)) continue
      if (emergenciaActiva(room, (e) => e.datos.jugadorId === o.id)) continue
      const p = plan(`tratar:${o.id}`, [etapa('enfermeria', 5, { op: 'accion', tipo: 'tratar', datos: { jugadorId: o.id } })])
      if (p) return p
    }
  }
  const faltan = diasRestantes(room)
  if (room.ajustes.ejercicio === 0 && room.autonomia.aire >= faltan && room.autonomia.agua >= faltan * 1.1 && !hayPendiente(room, 'ejercicio') && !emergenciaActiva(room, (e) => e.tipo === 'escasez')) {
    const p = plan('ejercicio', [etapa('enfermeria', 3, { op: 'accion', tipo: 'ejercicio', datos: { horas: 2.5 } })])
    if (p) return p
  }
  // Avisa de la dosis de uno en uno y sin prisa: de quien más lleva entre los que pasan de 500 mSv.
  const expuesto = [...tripulacion(room)].sort((a, b) => b.vit.dosis - a.vit.dosis).find((o) => o.vit.dosis > 500 && m.marcas[`dicho:dosis:${o.id}`] === undefined)
  if (expuesto && ahora() - (m.marcas.avisoDosis ?? -1e15) > 300_000) {
    if (decir(room, j, `${expuesto.nombre} has ${Math.round(expuesto.vit.dosis)} mSv, close to the limit of ${C.LIMITE_CARRERA_MSV}. Let us watch their dose.`, `dosis:${expuesto.id}`)) m.marcas.avisoDosis = ahora()
  }
  return paseo(room, j, plan)
}

function logistica(room: RoomState, j: Player, plan: Planificar): Plan | null {
  const faltan = diasRestantes(room)
  const a = room.autonomia
  const escasez = emergenciaActiva(room, (e) => e.tipo === 'escasez')
  const almacen = (que: string, tipo: string, datos: Record<string, unknown>) => plan(que, [etapa('almacen', 3, { op: 'accion', tipo, datos })])
  // Con el sistemas en manos de la persona, logística cubre los cartuchos si el CO2 se dispara.
  if (!botDeRol(room, 'sistemas') && !sis(room, 'cdra').operativo && room.cabina.ppCO2 > C.PPCO2_LIMITE_KPA && room.rec.lioh > 0 && room.rec.liohActivo < 1) {
    const p = plan('lioh', [etapa('soporte', 3, { op: 'accion', tipo: 'lioh', datos: {} })])
    if (p) return p
  }
  if (!escasez && !hayPendiente(room, 'racionComida') && faltan > 1) {
    const completa = a.comida * FACTOR_RACION[room.ajustes.racionComida]
    if (room.ajustes.racionComida === 'normal' && a.comida < faltan * 0.97) {
      const p = almacen('racion', 'racionComida', { nivel: 'ahorro' })
      if (p) return p
    } else if (room.ajustes.racionComida !== 'normal' && completa >= faltan * 1.2) {
      const p = almacen('racion', 'racionComida', { nivel: 'normal' })
      if (p) return p
    }
  }
  if (!escasez && !hayPendiente(room, 'racionAgua') && faltan > 1) {
    if (room.ajustes.racionAgua === 'normal' && a.agua < faltan * 0.97) {
      const p = almacen('agua', 'racionAgua', { nivel: 'ahorro' })
      if (p) return p
    } else if (room.ajustes.racionAgua === 'ahorro' && a.agua >= faltan * 1.5) {
      const p = almacen('agua', 'racionAgua', { nivel: 'normal' })
      if (p) return p
    }
  }
  // Tras una tormenta de polvo vuelve a encender lo que se apagó para ahorrar.
  if (!room.ambiente.tormentaPolvo && room.energia.bateria > room.energia.capacidad * 0.5 && !hayPendiente(room, 'equipo')) {
    for (const id of ['isru', 'huerto'] as const) {
      const s = sis(room, id)
      if (s.instalado && !s.activo) {
        const p = plan(`encender:${id}`, [etapa('energia', 3, { op: 'accion', tipo: 'equipo', datos: { sistema: id } })])
        if (p) return p
      }
    }
  }
  for (const recurso of ['comida', 'agua', 'aire'] as const) {
    if (a[recurso] < faltan * 0.9) decir(room, j, `Heads up: ${NOMBRE_RECURSO[recurso]} lasts ${r0(a[recurso])} days and there are ${r0(faltan)} days left.`, `aviso:${recurso}`, 180_000)
  }
  return paseo(room, j, plan)
}

function cientifico(room: RoomState, j: Player, m: MemoriaBot, plan: Planificar): Plan | null {
  const mis = room.mision
  if (j.muestras > 0 && j.zona === 'nave') {
    const p = plan('analizar', [etapa('laboratorio', 6, { op: 'accion', tipo: 'analizar', datos: {} })])
    if (p) return p
  }
  // El huerto, si los procedimientos aún no lo llevan.
  const huertoPorPasos = Object.keys(room.procedimientos ?? {}).some((k) => k.includes('huerto'))
  if (room.cargamento.huerto > 0 && !room.huerto.establecido && !huertoPorPasos && room.rec.agua >= 8 && ['transito', 'ensamblaje', 'base'].includes(room.fase)) {
    const p = plan('huerto', [etapa('laboratorio', 5, { op: 'accion', tipo: 'huerto', datos: {} })])
    if (p) return p
  }
  const faltan = mis.muestrasObjetivo - mis.muestrasAnalizadas - j.muestras
  const hora = room.ambiente.hora
  if (room.fase === 'base' && faltan > 0 && hora > 9 && hora < 15 && j.vit.fatiga < 60 && !room.ambiente.tormentaSolar) {
    // Los puntos más cercanos, uno detrás de otro, hasta 3 por salida.
    const libres = Object.keys(ESTACIONES).filter((id) => id.startsWith('muestra') && !room.muestreos.includes(id))
    const ruta: string[] = []
    let x = ESTACIONES.esclusaExt.x
    let z = ESTACIONES.esclusaExt.z
    while (ruta.length < Math.min(3, faltan) && libres.length) {
      libres.sort((a, b) => Math.hypot(ESTACIONES[a].x - x, ESTACIONES[a].z - z) - Math.hypot(ESTACIONES[b].x - x, ESTACIONES[b].z - z))
      const id = libres.shift()!
      ruta.push(id)
      x = ESTACIONES[id].x
      z = ESTACIONES[id].z
    }
    if (ruta.length) {
      const p = plan('muestras', [...ruta.map((id) => etapa(id, 5, { op: 'accion', tipo: 'muestra', datos: { sitio: id } })), etapa('laboratorio', 6, { op: 'accion', tipo: 'analizar', datos: {} })])
      if (p) {
        decir(room, j, `Going out to collect ${ruta.length} ${ruta.length === 1 ? 'sample' : 'samples'}.`)
        return p
      }
    }
  }
  void m
  return paseo(room, j, plan)
}

function piloto(room: RoomState, j: Player, plan: Planificar): Plan | null {
  if (room.fase === 'llegada' && room.subfase === 'orbita' && !hayPendiente(room, 'ubicacion')) {
    const sitio = sitioSensato(room)
    const p = plan('ubicacion', [etapa('puente', 4, { op: 'ubicacion', sitio })])
    if (p) return p
  }
  const hora = room.ambiente.hora
  if (room.fase === 'base' && room.ensamblaje.hechas.paneles && room.energia.polvo > 0.08 && hora > 9 && hora < 16 && !room.ambiente.tormentaSolar) {
    const p = plan('limpiar', [etapa('campoSolar', 6, { op: 'accion', tipo: 'limpiar', datos: {} })])
    if (p) return p
  }
  void j
  return null
}

/** Sin nada urgente, a veces se acerca a la consola de su rol o a la mesa común. */
function paseo(room: RoomState, j: Player, plan: Planificar): Plan | null {
  if (!j.rol || j.zona !== 'nave' || j.manual || azar(room) > 0.12) return null
  const sitios: Record<Role, string[]> = {
    comandante: ['puente', 'comedor'],
    piloto: ['puente', 'comedor'],
    medico: ['enfermeria', 'comedor'],
    logistica: ['almacen', 'energia'],
    cientifico: ['laboratorio', 'comedor'],
    sistemas: ['soporte', 'energia'],
  }
  return plan('paseo', [etapa(elegir(room, sitios[j.rol]), 5 + Math.round(azar(room) * 5))])
}

/** Dormir de noche y hacer el ejercicio del plan, cuando el reloj va lo bastante lento para verlo. */
function vida(room: RoomState, j: Player, m: MemoriaBot) {
  if (j.zona !== 'nave' || j.enRefugio || j.incapacitado > 0 || j.manual) return
  if (room.escala > 3600 || room.fase === 'llegada') return
  const h = room.ambiente.hora
  if ((h >= 22.5 || h < 5.5) && j.vit.fatiga > 12) {
    fijarActividad(room, j.id, 'sueno')
    return
  }
  // Mientras se monta la base no hay rato para el gimnasio.
  if (room.fase === 'ensamblaje' || room.ajustes.ejercicio <= 0 || h < 9 || h >= 19 || j.vit.fatiga > 70) return
  const dia = enSuperficie(room) ? room.ambiente.sol : Math.floor(room.t / 86400)
  const turno = room.jugadores.filter((o) => o.bot).findIndex((o) => o.id === j.id)
  if (m.marcas.ejercicio === dia || h < 9 + turno * 1.6) return
  if (room.jugadores.filter((o) => o.manual === 'ejercicio').length >= 2) return
  if (fijarActividad(room, j.id, 'ejercicio') === null) m.marcas.ejercicio = dia
}

// ---------- Posiciones para el mundo 3D ----------

/** Dónde se dibuja cada bot. Vive en memoria (no en la sala) y no necesita ser determinista. */
export interface Andar {
  x: number
  z: number
  zona: Zona
  giro: number
  t: number
}

const FASES_CON_MUNDO = ['transito', 'llegada', 'ensamblaje', 'base']

function dentroDelHabitat(x: number, z: number) {
  return Math.abs(x) < HABITAT.x + 0.4 && Math.abs(z) < HABITAT.z + 0.4
}

function cruza(x: number, z: number, tx: number, tz: number) {
  for (let k = 1; k < 20; k++) if (dentroDelHabitat(x + ((tx - x) * k) / 20, z + ((tz - z) * k) / 20)) return true
  return false
}

/** Fuera, si el camino recto atraviesa el hábitat, se va primero a la esquina visible más conveniente. */
function rodeo(x: number, z: number, tx: number, tz: number): [number, number] {
  if (!cruza(x, z, tx, tz)) return [tx, tz]
  let mejor: [number, number] = [tx, tz]
  let largo = Infinity
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * (HABITAT.x + 0.9)
      const cz = sz * (HABITAT.z + 0.9)
      if (cruza(x, z, cx, cz)) continue
      const l = Math.hypot(cx - x, cz - z) + Math.hypot(tx - cx, tz - cz)
      if (l < largo) {
        largo = l
        mejor = [cx, cz]
      }
    }
  }
  return mejor
}

/**
 * Posición de cada bot [x, z, giro, animación] para enviarla como la de una persona: camina a
 * 1.4 m/s hasta la estación donde trabaja y se queda mirándola (animación 2); sin trabajo vuelve
 * a su puesto.
 */
export function posicionesBots(room: RoomState, estados: Map<string, Andar>, t: number): Record<string, number[]> {
  const salida: Record<string, number[]> = {}
  if (!FASES_CON_MUNDO.includes(room.fase)) return salida
  for (const j of room.jugadores) {
    if (!j.bot || !j.rol) continue
    let s = estados.get(j.id)
    if (!s || s.zona !== j.zona) {
      const inicio = s ? ENTRADA[j.zona] : j.zona === 'nave' ? PUESTO[j.rol] : ENTRADA.exterior
      s = { x: inicio.x, z: inicio.z, zona: j.zona, giro: 0, t }
      estados.set(j.id, s)
    }
    const dt = limitar((t - s.t) / 1000, 0, 1.5)
    s.t = t
    const p = j.estacion ? puntoDe(j.estacion) : null
    let tx: number
    let tz: number
    let mira: [number, number] | null = null
    if (p && p.zona === j.zona) {
      tx = p.x
      tz = p.z
      mira = [p.cx, p.cz]
    } else if (j.zona === 'nave') {
      tx = PUESTO[j.rol].x
      tz = PUESTO[j.rol].z
    } else {
      tx = ENTRADA.exterior.x + 1
      tz = ENTRADA.exterior.z + 2.5
    }
    const [wx, wz] = j.zona === 'exterior' ? rodeo(s.x, s.z, tx, tz) : [tx, tz]
    const dx = wx - s.x
    const dz = wz - s.z
    const d = Math.hypot(dx, dz)
    let anim = 0
    if (d > 0.05) {
      const avance = Math.min(d, VELOCIDAD * dt)
      s.x += (dx / d) * avance
      s.z += (dz / d) * avance
      s.giro = Math.atan2(dx, dz)
      anim = 1
    }
    // No atraviesa la mesa común.
    if (j.zona === 'nave') {
      const cx = s.x - 0.05
      const dm = Math.hypot(cx, s.z)
      if (dm < 1 && dm > 0.001) {
        s.x = 0.05 + (cx / dm) * 1
        s.z = (s.z / dm) * 1
      }
    }
    if (Math.hypot(tx - s.x, tz - s.z) < 0.1) {
      anim = mira ? 2 : 0
      s.giro = mira ? Math.atan2(mira[0] - s.x, mira[1] - s.z) : PUESTO[j.rol].z < 0 ? Math.PI : 0
    }
    salida[j.id] = [Math.round(s.x * 100) / 100, Math.round(s.z * 100) / 100, Math.round(s.giro * 100) / 100, anim]
  }
  return salida
}
