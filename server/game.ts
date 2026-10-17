// Reglas del juego: sala, roles, suministros, decisiones, acciones y emergencias.
import { C } from '../shared/ciencia.js'
import {
  CUENTA_REGRESIVA_S,
  ESCALAS,
  ESCALA_MAXIMA,
  PASOS_CONTEXTO,
  PERFIL_BY_ID,
  ROLE_BY_ID,
  SISTEMA_BY_ID,
  SITE_BY_ID,
  SUPPLIES,
  TAREAS_ENSAMBLAJE,
  PEINADOS,
  TRAJE_COLORES,
  TRAJE_PELOS,
  TRAJE_PIELES,
  TRAJE_VISORES,
  TRANSITO_INICIO_S,
  TRAYECTORIA_BY_ID,
  capacidadCarga,
  masaTotal,
  nombreSistema,
  trajePorDefecto,
  tripulantesPlan,
  type Actividad,
  type DecisionMode,
  type Emergency,
  type Loadout,
  type PerfilId,
  type Player,
  type Proposal,
  type ProposalType,
  type RacionAgua,
  type RacionComida,
  type Role,
  type RoomState,
  type SistemaId,
  type Traje,
  type TrayectoriaId,
  type Zona,
} from '../shared/types.js'
import { conRol, conectados, jugador, limitar, log, presentes, puedeActuar, rid, rolPresente, sis, tripulacion } from './base.js'
import { UMBRAL_AVERIA, aplicarAlternativa } from './emergencies.js'
import { CIUDAD_BY_ID, ESCENARIOS, ESCENARIO_BY_ID, escenarioDe, fechaDeMision, type EscenarioId } from '../shared/escenarios.js'
import { lsMarte } from '../shared/astronomia.js'
import { ALTERNATIVAS, cargaRecomendada, minimoDe } from '../shared/plan.js'
import { ahora, azar, fijarAhora, semilla } from './reloj.js'
import { enSuperficie, indiceClimaParaLs, iniciarClimaEspacial } from './sim/ambiente.js'
import { iniciarDescenso, pasoSimulacion, refrescar } from './sim/paso.js'
import { pasoTripulantes } from './tripulantes.js'

export { jugador } from './base.js'

/** Sin consultas de nadie durante este tiempo, la misión se detiene sola. */
const AUSENCIA_MS = 90_000
const PASO_MS = 1000

// ---------- Sala ----------

export function crearSala(codigo: string, hostId: string, modoDecision: DecisionMode): RoomState {
  const rng = semilla(codigo)
  return {
    codigo,
    version: 0,
    reloj: 0,
    rng,
    desfase: 0,
    pausa: false,
    hostId,
    modoDecision,
    fase: 'lobby',
    subfase: '',
    jugadores: [],
    t: 0,
    escala: 0,
    escalaDeseada: 1,
    tAterrizaje: 0,
    tFase: 0,
    diaLanzamiento: 1 + (Math.abs(rng) % 80),
    indiceClima: Math.abs(rng >> 3) % 669,
    escenario: 'primeraBase',
    escenarioElegido: 'azar',
    nombreMision: '',
    guion: [],
    perfil: 'estandar',
    trayectoria: 'estandar',
    mision: { objetivo: '', solesObjetivo: 20, muestrasObjetivo: 5, muestrasAnalizadas: 0, diasTransito: 210, aguaExtraida: 0, aguaObjetivo: 0 },
    cargamento: Object.fromEntries(SUPPLIES.map((s) => [s.id, s.min])) as Loadout,
    masa: 0,
    capacidad: 0,
    sitio: null,
    vuelo: { altitud: 0, velocidad: 0, g: 1, etapa: 'On the ground', progreso: 0, distTierra: 0, distMarte: 220, distSol: 1, retardo: 0 },
    ambiente: { sol: 0, hora: 8, tempExt: 20, presion: 0, tau: 0, uv: 1, flujoSolar: 1361, tormentaPolvo: false, polvoSoles: 0, solCuriosity: 0, radiacion: 0, tormentaSolar: null },
    cabina: { ppO2: C.PPO2_NOMINAL_KPA, ppCO2: 0.3, temp: C.TEMP_CABINA_C, fuga: 0 },
    rec: { agua: 0, aguaResidual: 0, o2: 0, comida: 0, repuestos: 0, botiquines: 0, lioh: 0, liohActivo: 0, propelente: 100 },
    energia: { bateria: 0, capacidad: 0, generacion: 0, consumo: 0, usada: 0, polvo: 0, cortes: [] },
    sistemas: (Object.keys(SISTEMA_BY_ID) as SistemaId[]).map((id) => ({
      id,
      integridad: 100,
      activo: true,
      operativo: id !== 'huerto' && id !== 'isru',
      instalado: id !== 'huerto' && id !== 'isru',
    })),
    ajustes: { racionComida: 'normal', racionAgua: 'normal', ejercicio: C.EJERCICIO_ISS_H, prioridad: 'vida' },
    blindaje: 0,
    refugioHasta: 0,
    huerto: { progreso: 0, establecido: false, diasCultivo: 0, cosechas: 0 },
    ensamblaje: { paso: 0, hechas: {} },
    muestreos: [],
    autonomia: { agua: 999, aire: 999, comida: 999 },
    climaEspacial: { fulguracion: 0, particulas: 0 },
    avisos: {},
    cola: [],
    propuestas: [],
    emergencias: [],
    registro: [],
    chat: [],
    puntosCriticos: [],
    resultado: null,
  }
}

export function nuevoJugador(id: string, nombre: string): Player {
  return {
    id,
    nombre,
    rol: null,
    conectado: true,
    traje: trajePorDefecto(),
    zona: 'nave',
    actividad: 'reposo',
    manual: null,
    manualHasta: 0,
    vit: { fc: 64, fr: 13, spo2: 97.5, hidratacion: 100, reservas: 100, fatiga: 10, dosis: 0, dosisTasa: 0, condicion: 100, salud: 100 },
    deficitAgua: 0,
    deficitKcal: 0,
    trajeO2: C.TRAJE_O2_KG,
    trajeBateria: 1,
    enRefugio: false,
    incapacitado: 0,
    dolencia: null,
    dolenciaHasta: 0,
    ayuda: null,
    paso: 0,
    listo: false,
    aportes: 0,
    hogar: null,
    muestras: 0,
  }
}

function aplicarPerfil(room: RoomState) {
  const p = PERFIL_BY_ID[room.perfil]
  const esc = escenarioDe(room.escenario)
  const sitio = room.sitio ?? esc.sitio ?? null
  const bono = sitio ? SITE_BY_ID[sitio].bonoCiencia : 0
  room.mision.solesObjetivo = p.soles
  room.mision.muestrasObjetivo = Math.max(1, p.muestras + (esc.objetivo?.muestrasExtra ?? 0) - bono)
  room.mision.aguaObjetivo = (esc.objetivo?.aguaPorSol ?? 0) * p.soles
  room.mision.diasTransito = TRAYECTORIA_BY_ID[room.trayectoria].dias
  const donde = esc.sitio ? `land at ${SITE_BY_ID[esc.sitio].nombre}, ` : ''
  const agua = room.mision.aguaObjetivo ? ` and extracting ${room.mision.aguaObjetivo} kg of water from the ice` : ''
  room.mision.objetivo = `Reach Mars, ${donde}build the base and keep the crew alive for ${p.soles} sols, analyzing ${room.mision.muestrasObjetivo} soil samples${agua}.`
  room.capacidad = capacidadCarga(tripulantesPlan(room), room.trayectoria)
}

// ---------- Sala ----------

/**
 * El rol se asigna dentro de la contextualización, después de que a cada integrante se le
 * da la situación que tiene que afrontar. En la sala de espera todavía no hay roles.
 */
export function elegirRol(room: RoomState, id: string, rol: Role | null): string | null {
  if (room.fase === 'lobby') return 'Roles are assigned in the Mission Briefing, after you learn the situation.'
  if (room.fase !== 'contexto') return 'You can no longer change your role. The mission has launched.'
  const j = jugador(room, id)
  if (!j) return 'Player not found.'
  if (rol && !ROLE_BY_ID[rol]) return 'Invalid role.'
  const ocupante = rol ? room.jugadores.find((o) => o.id !== id && o.rol === rol) : undefined
  if (ocupante && (!ocupante.bot || j.bot)) return 'That role is already taken.'
  if (j.rol === rol) return null
  if (ocupante) {
    // Modo de un jugador: la persona elige primero, así que el bot le cede el rol y toma el suyo.
    ocupante.rol = j.rol
    ocupante.listo = false
    if (!ocupante.rol) ocupante.paso = Math.min(ocupante.paso, 1)
  }
  j.rol = rol
  j.listo = false
  if (!rol) j.paso = Math.min(j.paso, 1)
  return null
}

export function elegirTraje(room: RoomState, id: string, traje: Partial<Traje>): string | null {
  const j = jugador(room, id)
  if (!j) return 'Player not found.'
  if (room.fase !== 'lobby' && room.fase !== 'contexto') return 'You choose your suit before launch.'
  const color = (v: unknown, lista: readonly string[], actual: string) => (typeof v === 'string' && lista.includes(v) ? v : actual)
  const previo = { ...trajePorDefecto(), ...j.traje }
  j.traje = {
    color: color(traje.color, TRAJE_COLORES, previo.color),
    acento: color(traje.acento, TRAJE_COLORES, previo.acento),
    visor: color(traje.visor, TRAJE_VISORES, previo.visor),
    piel: color(traje.piel, TRAJE_PIELES, previo.piel),
    pelo: color(traje.pelo, TRAJE_PELOS, previo.pelo),
    peinado: color(traje.peinado, PEINADOS.map((x) => x.id), previo.peinado) as Traje['peinado'],
  }
  return null
}

/** Quien creó la sala elige la situación, o la deja al azar. */
export function elegirEscenario(room: RoomState, id: string, valor: string): string | null {
  if (room.fase !== 'lobby') return 'The situation is chosen before the mission starts.'
  if (id !== room.hostId) return 'Only the host chooses the situation.'
  if (valor !== 'azar' && !ESCENARIO_BY_ID[valor as EscenarioId]) return 'Unknown situation.'
  room.escenarioElegido = valor
  return null
}

/** Ciudad de origen de cada tripulante: se marca en la Tierra y recibe mensajes de casa. */
export function elegirHogar(room: RoomState, id: string, ciudad: string | null): string | null {
  const j = jugador(room, id)
  if (!j) return 'Player not found.'
  if (room.fase !== 'lobby' && room.fase !== 'contexto') return 'You choose your hometown before launch.'
  if (ciudad !== null && !CIUDAD_BY_ID[ciudad as keyof typeof CIUDAD_BY_ID]) return 'Unknown city.'
  j.hogar = ciudad
  return null
}

/** El comandante bautiza la misión. */
export function nombrarMision(room: RoomState, id: string, nombre: string): string | null {
  if (room.fase !== 'contexto') return 'The mission is named before launch.'
  const j = jugador(room, id)
  if (!j || !puedeActuar(room, j, ['comandante'])) return 'Only the Mission Commander names the mission.'
  room.nombreMision = nombre.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 28)
  return null
}

export function iniciarMision(room: RoomState, id: string): string | null {
  if (room.fase !== 'lobby') return 'The mission has already started.'
  if (id !== room.hostId) return 'Only the host can start.'
  const solo = room.modoJuego === 'solo'
  if (!solo && presentes(room).length < 2) return 'You need at least 2 crew members in the room.'
  room.jugadores = presentes(room)
  for (const j of room.jugadores) {
    j.rol = null
    j.paso = 0
    j.listo = false
  }
  room.fase = 'contexto'
  // Los bots avanzan por la contextualización con el reloj de la sala.
  if (solo) {
    room.bots = {}
    room.reloj = ahora()
  }
  // La situación: la elegida o una al azar, con la semilla de la sala.
  room.escenario = room.escenarioElegido !== 'azar' && ESCENARIO_BY_ID[room.escenarioElegido as EscenarioId]
    ? room.escenarioElegido
    : ESCENARIOS[Math.floor(azar(room) * ESCENARIOS.length)].id
  aplicarPerfil(room)
  room.cargamento = cargaRecomendada(room, 1.15)
  room.masa = masaTotal(room.cargamento)
  log(room, 'Mission Briefing: first the situation is presented. Then each crew member gets a role, the objective is set and the supplies are chosen.')
  return null
}

// ---------- Contextualización ----------

const enContexto = (room: RoomState) => (room.fase === 'contexto' ? null : 'This is decided before launch.')

/** Antes del lanzamiento la capacidad sigue a quienes están en la sala. */
export function ajustarPlan(room: RoomState) {
  if (room.fase === 'contexto') room.capacidad = capacidadCarga(tripulantesPlan(room), room.trayectoria)
}

/** Cada integrante avanza por los pasos de la contextualización a su ritmo. */
export function fijarPaso(room: RoomState, id: string, paso: number): string | null {
  const error = enContexto(room)
  if (error) return error
  const j = jugador(room, id)
  if (!j) return 'Player not found.'
  if (!Number.isInteger(paso) || paso < 0 || paso >= PASOS_CONTEXTO.length) return 'Invalid step.'
  if (paso >= 2 && !j.rol) return 'Choose your role first.'
  j.paso = paso
  return null
}

export function ajustarCargamento(room: RoomState, cambios: Partial<Loadout>): string | null {
  const error = enContexto(room)
  if (error) return error
  for (const s of SUPPLIES) {
    const v = cambios[s.id]
    if (typeof v === 'number' && Number.isFinite(v)) room.cargamento[s.id] = limitar(Math.round(v), Math.max(s.min, minimoDe(room, s.id)), s.max)
  }
  room.masa = masaTotal(room.cargamento)
  return null
}

export function aplicarPreset(room: RoomState, preset: string): string | null {
  const error = enContexto(room)
  if (error) return error
  const alternativa = ALTERNATIVAS.find((x) => x.id === preset)
  if (!alternativa) return 'Invalid option.'
  room.cargamento = cargaRecomendada(room, alternativa.margen)
  room.masa = masaTotal(room.cargamento)
  return null
}

export function elegirPerfil(room: RoomState, id: string, perfil: PerfilId): string | null {
  const error = enContexto(room)
  if (error) return error
  const j = jugador(room, id)
  if (!j || !puedeActuar(room, j, ['comandante'])) return 'Only the Mission Commander sets the mission objective.'
  if (!PERFIL_BY_ID[perfil]) return 'Invalid profile.'
  room.perfil = perfil
  aplicarPerfil(room)
  return null
}

export function elegirTrayectoria(room: RoomState, id: string, trayectoria: TrayectoriaId): string | null {
  const error = enContexto(room)
  if (error) return error
  const j = jugador(room, id)
  if (!j || !puedeActuar(room, j, ['piloto', 'comandante'])) return 'Only the Pilot & Navigator or the Mission Commander chooses the trajectory.'
  if (!TRAYECTORIA_BY_ID[trayectoria]) return 'Invalid trajectory.'
  room.trayectoria = trayectoria
  aplicarPerfil(room)
  return null
}

export function marcarListo(room: RoomState, id: string, listo: boolean): string | null {
  const error = enContexto(room)
  if (error) return error
  const j = jugador(room, id)
  if (!j) return 'Player not found.'
  if (listo && !j.rol) return 'Choose your role first.'
  j.listo = listo
  if (listo) j.paso = PASOS_CONTEXTO.length - 1
  return null
}

export function lanzar(room: RoomState, id: string): string | null {
  const error = enContexto(room)
  if (error) return error
  const j = jugador(room, id)
  if (!j || !puedeActuar(room, j, ['comandante'])) return 'Only the Mission Commander can authorize launch.'
  if (!room.jugadores.some((o) => o.rol === 'comandante')) return 'There is no Mission Commander. Someone has to take that role.'
  const sinRol = presentes(room).filter((o) => !o.rol)
  if (sinRol.length) return `Still need to choose a role: ${sinRol.map((o) => o.nombre).join(', ')}.`
  const viajan = room.jugadores.filter((o) => o.rol)
  if (viajan.length < 2) return 'You need at least 2 crew members with a role.'
  const capacidad = capacidadCarga(viajan.length, room.trayectoria)
  if (room.masa > capacidad) return `The cargo weighs ${room.masa.toFixed(1)} t and the ship can carry ${capacidad.toFixed(1)} t.`
  const faltan = conectados(room).filter((o) => o.id !== id && !o.listo)
  if (faltan.length) return `Still need to confirm: ${faltan.map((o) => o.nombre).join(', ')}.`
  const esc = escenarioDe(room.escenario)
  for (const [k, v] of Object.entries(esc.cargaMinima ?? {})) {
    const sup = SUPPLIES.find((x) => x.id === k)
    if (sup && room.cargamento[sup.id] < (v ?? 0)) return `This mission must carry: ${sup.nombre}.`
  }
  // Quien se fue sin elegir rol no viaja.
  room.jugadores = viajan
  room.capacidad = capacidad

  const c = room.cargamento
  room.rec = { agua: c.agua * 100, aguaResidual: 0, o2: c.oxigeno * 100, comida: c.alimentos * 100, repuestos: c.repuestos, botiquines: c.botiquin, lioh: c.lioh, liohActivo: 0, propelente: 100 }
  room.energia = { bateria: c.baterias * C.BATERIA_KWH, capacidad: c.baterias * C.BATERIA_KWH, generacion: 0, consumo: 0, usada: 0, polvo: 0, cortes: [] }
  room.blindaje = c.blindaje
  sis(room, 'huerto').instalado = c.huerto > 0
  for (const o of room.jugadores) {
    o.zona = 'nave'
    o.listo = false
  }
  room.fase = 'lanzamiento'
  room.subfase = ''
  room.t = -CUENTA_REGRESIVA_S
  room.tFase = room.t
  room.escalaDeseada = 10
  room.reloj = ahora()
  // La fecha real de la situación decide la estación de Marte al llegar y, con ella, qué parte
  // del año medido por Curiosity se usa como clima.
  const llegada = fechaDeMision(esc, TRANSITO_INICIO_S + room.mision.diasTransito * 86400)
  room.indiceClima = indiceClimaParaLs(lsMarte(llegada))
  if (esc.diaClimaEspacial) room.diaLanzamiento = esc.diaClimaEspacial
  room.guion = prepararGuion(room)
  iniciarClimaEspacial(room)
  log(room, `Launch authorized by ${j.nombre}. Cargo of ${room.masa.toFixed(1)} t, a ${room.mision.diasTransito}-day cruise.`, 'ok')
  refrescar(room)
  return null
}

/** Los sucesos de la situación más uno al azar en el viaje y otro en la superficie. */
function prepararGuion(room: RoomState): RoomState['guion'] {
  const guion: RoomState['guion'] = escenarioDe(room.escenario).guion.map((g) => ({ ...g, hecho: false }))
  const viaje = 0.2 + azar(room) * 0.6
  const tipo = (['fuga', 'fallo', 'medico'] as const)[Math.floor(azar(room) * 3)]
  const sistema = (['oga', 'cdra', 'wrs', 'termico'] as const)[Math.floor(azar(room) * 4)]
  guion.push({ viaje, tipo, datos: tipo === 'fallo' ? { sistema } : undefined, hecho: false })
  const sol = 2 + Math.floor(azar(room) * Math.max(1, room.mision.solesObjetivo - 3))
  guion.push({ sol, tipo: 'fallo', datos: { sistema: azar(room) < 0.5 ? 'esclusa' : 'energia' }, hecho: false })
  return guion
}

// ---------- Tiempo ----------

export function fijarEscala(room: RoomState, id: string, valor: number): string | null {
  const j = jugador(room, id)
  if (!j || !puedeActuar(room, j, ['comandante'])) return 'Only the Mission Commander controls the time scale.'
  if (!ESCALAS.some((e) => e.valor === valor)) return 'Invalid time scale.'
  if (['lobby', 'contexto', 'lanzamiento', 'fin'].includes(room.fase)) return 'You cannot change the time scale right now.'
  const maxima = ESCALA_MAXIMA[room.fase]
  if (valor > maxima) return `In this phase the maximum time scale is ×${maxima}.`
  room.escalaDeseada = valor
  refrescar(room)
  return null
}

export function pausar(room: RoomState, id: string, pausa: boolean): string | null {
  const j = jugador(room, id)
  if (!j || !(puedeActuar(room, j, ['comandante']) || id === room.hostId)) return 'Only the Mission Commander can pause the mission.'
  if (room.pausa === pausa) return null
  room.pausa = pausa
  log(room, pausa ? `${j.nombre} paused the mission.` : `${j.nombre} resumed the mission.`)
  return null
}

// ---------- Propuestas ----------

function crearPropuesta(
  room: RoomState,
  p: { tipo: ProposalType; titulo: string; descripcion: string; payload: Record<string, unknown>; proponente: string; rolesResponsables: Role[] },
) {
  const prop: Proposal = { id: rid(room), ...p, votos: { [p.proponente]: true }, estado: 'pendiente', creada: ahora(), vence: ahora() + 90_000 }
  room.propuestas.unshift(prop)
  if (room.propuestas.length > 10) room.propuestas.length = 10
  const quien = jugador(room, p.proponente)?.nombre ?? 'Someone'
  log(room, `${quien} proposes: ${p.titulo}.`)
  resolverPropuesta(room, prop)
}

export function votar(room: RoomState, id: string, propId: string, aprueba: boolean): string | null {
  const prop = room.propuestas.find((p) => p.id === propId)
  if (!prop || prop.estado !== 'pendiente') return 'That proposal is no longer open.'
  const j = jugador(room, id)
  if (!j || !j.rol) return 'You need a role to vote.'
  if (room.modoDecision === 'comandante' && rolPresente(room, 'comandante') && j.rol !== 'comandante' && id !== prop.proponente) {
    return 'In this mode only the Mission Commander decides.'
  }
  prop.votos[id] = aprueba
  resolverPropuesta(room, prop)
  return null
}

function resolverPropuesta(room: RoomState, prop: Proposal) {
  if (prop.estado !== 'pendiente') return
  const votantes = conectados(room)
  const cmd = conRol(room, 'comandante')[0]
  let decision: boolean | null = null
  if (room.modoDecision === 'comandante' && cmd) {
    const v = prop.votos[cmd.id]
    if (typeof v === 'boolean') decision = v
  } else {
    const si = votantes.filter((j) => prop.votos[j.id] === true).length
    const no = votantes.filter((j) => prop.votos[j.id] === false).length
    if (si > votantes.length / 2 || votantes.length <= 1) decision = true
    else if (no >= votantes.length / 2) decision = false
  }
  if (decision === null) return
  prop.estado = decision ? 'aprobada' : 'rechazada'
  log(room, `Proposal "${prop.titulo}" ${decision ? 'approved' : 'rejected'}.`, decision ? 'ok' : 'alerta')
  if (decision) aplicarPropuesta(room, prop)
}

function ordenarRefugio(room: RoomState, horas: number) {
  for (const j of tripulacion(room)) {
    j.zona = 'nave'
    j.enRefugio = true
    j.manual = null
  }
  room.refugioHasta = Math.max(room.refugioHasta, room.t + horas * 3600)
}

function aplicarPropuesta(room: RoomState, prop: Proposal) {
  const d = prop.payload
  switch (prop.tipo) {
    case 'ubicacion':
      room.sitio = String(d.sitioId)
      aplicarPerfil(room)
      iniciarDescenso(room)
      break
    case 'racionComida':
      room.ajustes.racionComida = d.nivel as RacionComida
      break
    case 'racionAgua':
      room.ajustes.racionAgua = d.nivel as RacionAgua
      break
    case 'equipo':
      sis(room, d.sistema as SistemaId).activo = Boolean(d.activo)
      break
    case 'prioridad':
      room.ajustes.prioridad = d.valor as RoomState['ajustes']['prioridad']
      break
    case 'ejercicio':
      room.ajustes.ejercicio = Number(d.horas)
      break
    case 'refugio':
      if (d.salir) {
        room.refugioHasta = 0
        for (const j of tripulacion(room)) j.enRefugio = false
      } else ordenarRefugio(room, Number(d.horas))
      break
    case 'emergencia': {
      const em = room.emergencias.find((e) => e.id === d.emergenciaId)
      if (em && em.estado === 'activa') resolverEmergencia(room, em, String(d.altId))
      break
    }
  }
  refrescar(room)
}

// ---------- Llegada y ensamblaje ----------

export function proponerUbicacion(room: RoomState, id: string, sitioId: string): string | null {
  if (room.fase !== 'llegada' || room.subfase !== 'orbita') return 'The landing site is chosen from Mars orbit.'
  const j = jugador(room, id)
  if (!j || !puedeActuar(room, j, ['piloto', 'comandante'])) return 'Only the Pilot & Navigator or the Mission Commander proposes the site.'
  const sitio = SITE_BY_ID[sitioId]
  if (!sitio) return 'Invalid site.'
  const obligado = escenarioDe(room.escenario).sitio
  if (obligado && obligado !== sitioId) return `This mission has to land at ${SITE_BY_ID[obligado].nombre}.`
  if (room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === 'ubicacion')) return 'A site has already been proposed. Check the Proposals.'
  crearPropuesta(room, { tipo: 'ubicacion', titulo: `Land at ${sitio.nombre}`, descripcion: sitio.descripcion, payload: { sitioId }, proponente: id, rolesResponsables: ['piloto', 'comandante'] })
  return null
}

function impedimento(j: Player): string | null {
  if (j.incapacitado > 0) return 'You are out of action. You need rest or the Flight Surgeon.'
  if (j.enRefugio) return 'You are in the Storm Shelter. You cannot work until you leave.'
  return null
}

/** Ya no se hace de un solo golpe: queda para quien todavía la llame. Ver server/procedimientos.ts. */
export function hacerTarea(room: RoomState, id: string, tareaId: string): string | null {
  void room
  void id
  void tareaId
  return 'Base tasks are done step by step with their procedure, at their station.'
}

/**
 * Marca hecha una tarea del montaje y, si era la última de su paso, avanza el montaje. Las tareas
 * se hacen paso a paso con su procedimiento (server/procedimientos.ts), que llama aquí al terminar.
 */
export function completarTarea(room: RoomState, j: Player, tareaId: string) {
  const tarea = TAREAS_ENSAMBLAJE.find((t) => t.id === tareaId)
  if (!tarea || room.ensamblaje.hechas[tareaId]) return
  room.ensamblaje.hechas[tareaId] = j.id
  log(room, `${j.nombre} completed: ${tarea.titulo.charAt(0).toLowerCase() + tarea.titulo.slice(1)}.`, 'ok')
  if (tareaId === 'soporte') {
    const hielo = SITE_BY_ID[room.sitio ?? 'gale'].hielo
    sis(room, 'isru').instalado = hielo && room.cargamento.isru > 0
    if (room.cargamento.isru > 0 && !hielo) log(room, 'The Ice Extractor is no use here. This site has no ice within reach.', 'alerta')
  }
  const pendientes = TAREAS_ENSAMBLAJE.filter((t) => t.paso === room.ensamblaje.paso && !room.ensamblaje.hechas[t.id])
  if (pendientes.length === 0) {
    room.ensamblaje.paso += 1
    if (room.ensamblaje.paso > 3) {
      room.fase = 'base'
      room.tFase = room.t
      room.escalaDeseada = 600
      log(room, 'Facilities checked. Base operations begin.', 'ok')
    }
  }
}

// ---------- Movimiento entre zonas y actividades ----------

export function cambiarZona(room: RoomState, id: string, zona: Zona): string | null {
  const j = jugador(room, id)
  if (!j || !j.rol) return 'Player not found.'
  if (zona !== 'nave' && zona !== 'exterior') return 'Invalid zone.'
  if (j.zona === zona) return null
  if (zona === 'nave') {
    j.zona = 'nave'
    log(room, `${j.nombre} went back into the habitat.`)
    refrescar(room)
    return null
  }
  if (!enSuperficie(room) || (room.fase !== 'ensamblaje' && room.fase !== 'base')) return 'You can only go outside once the ship is on Mars.'
  const impedido = impedimento(j)
  if (impedido) return impedido
  const esclusa = sis(room, 'esclusa')
  if (esclusa.integridad <= UMBRAL_AVERIA) return 'The Airlock is broken. The Systems Engineer must repair it.'
  if (j.trajeO2 < C.TRAJE_O2_KG * 0.3 || j.trajeBateria < 0.3) return 'Your suit is not charged. Wait for the Airlock to recharge it.'
  j.zona = 'exterior'
  j.manual = null
  esclusa.integridad = Math.max(0, esclusa.integridad - 0.4)
  log(room, `${j.nombre} went outside. It is ${room.ambiente.tempExt} °C out there.`)
  refrescar(room)
  return null
}

export function fijarActividad(room: RoomState, id: string, actividad: Actividad | null): string | null {
  const j = jugador(room, id)
  if (!j) return 'Player not found.'
  if (actividad !== null && actividad !== 'ejercicio' && actividad !== 'sueno') return 'Invalid activity.'
  if (actividad && j.zona !== 'nave') return 'That is done inside the habitat.'
  if (actividad === 'ejercicio') {
    const impedido = impedimento(j)
    if (impedido) return impedido
  }
  j.manual = actividad
  // Una sesión de ejercicio dura una hora; el sueño, hasta nueve.
  j.manualHasta = room.t + (actividad === 'ejercicio' ? 3600 : 9 * 3600)
  return null
}

export function usarRefugio(room: RoomState, id: string, entrar: boolean): string | null {
  const j = jugador(room, id)
  if (!j) return 'Player not found.'
  if (j.zona !== 'nave') return 'The Storm Shelter is inside the habitat.'
  j.enRefugio = entrar
  if (entrar) j.manual = null
  return null
}

// ---------- Acciones de los roles ----------

const NIVELES_COMIDA: Record<RacionComida, string> = {
  normal: 'Full ration. The crew keeps its body reserves.',
  ahorro: 'Ration at 80%. Food lasts 25% longer and body reserves drop little by little.',
  estricto: 'Ration at 60%. Food lasts 67% longer. Within a few weeks health suffers.',
}
const NOMBRE_RACION: Record<RacionComida, string> = { normal: 'full', ahorro: 'saver (80%)', estricto: 'strict (60%)' }
const PRIORIDADES: Record<string, string> = {
  vida: 'If power runs short, the air is the last thing to shut down. Heat is sacrificed first.',
  calor: 'If power runs short, heating is protected and oxygen comes from the tanks.',
  ciencia: 'If power runs short, the garden is protected before heating.',
}
const NOMBRE_PRIORIDAD: Record<string, string> = { vida: 'air', calor: 'heat', ciencia: 'garden' }

export function accion(room: RoomState, id: string, tipo: string, d: Record<string, unknown>): string | null {
  if (!['transito', 'llegada', 'ensamblaje', 'base'].includes(room.fase)) return 'You cannot take actions right now.'
  const j = jugador(room, id)
  if (!j || !j.rol) return 'Player not found.'
  // Desde el refugio se puede decidir, pero no hacer trabajo físico.
  const esDecision = ['racionComida', 'racionAgua', 'prioridad', 'equipo', 'ejercicio', 'refugio'].includes(tipo)
  if (!esDecision || j.incapacitado > 0) {
    const impedido = impedimento(j)
    if (impedido) return impedido
  }
  const superficie = enSuperficie(room)
  const pendiente = (t: ProposalType, filtro?: (p: Proposal) => boolean) =>
    room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === t && (!filtro || filtro(p)))
  const proponer = (t: ProposalType, roles: Role[], titulo: string, descripcion: string, payload: Record<string, unknown>) => {
    if (!puedeActuar(room, j, roles)) return `Only these roles can propose that: ${roles.map((r) => ROLE_BY_ID[r].nombre).join(', ')}.`
    crearPropuesta(room, { tipo: t, titulo, descripcion, payload, proponente: id, rolesResponsables: roles })
    return null
  }

  switch (tipo) {
    // --- Decisiones que pasan por el comandante o por votación ---
    case 'racionComida': {
      const nivel = String(d.nivel) as RacionComida
      if (!NIVELES_COMIDA[nivel]) return 'Invalid level.'
      if (nivel === room.ajustes.racionComida) return 'That is already the current ration.'
      if (pendiente('racionComida')) return 'There is already a pending ration proposal.'
      return proponer('racionComida', ['logistica', 'comandante'], `Food ration: ${NOMBRE_RACION[nivel]}`, NIVELES_COMIDA[nivel], { nivel })
    }
    case 'racionAgua': {
      const nivel = d.nivel === 'ahorro' ? 'ahorro' : 'normal'
      if (nivel === room.ajustes.racionAgua) return 'That is already the current water use.'
      if (pendiente('racionAgua')) return 'There is already a pending water proposal.'
      return proponer(
        'racionAgua',
        ['logistica', 'comandante'],
        nivel === 'ahorro' ? 'Save water' : 'Normal water use',
        nivel === 'ahorro' ? 'Hygiene is cut to the minimum. Drinking water does not change.' : 'Normal hygiene comes back.',
        { nivel },
      )
    }
    case 'prioridad': {
      const valor = String(d.valor)
      if (!PRIORIDADES[valor]) return 'Invalid priority.'
      if (valor === room.ajustes.prioridad) return 'That is already the current priority.'
      if (pendiente('prioridad')) return 'There is already a pending priority proposal.'
      return proponer('prioridad', ['logistica', 'comandante'], `Power priority: ${NOMBRE_PRIORIDAD[valor]}`, PRIORIDADES[valor], { valor })
    }
    case 'equipo': {
      const s = room.sistemas.find((x) => x.id === d.sistema)
      if (!s || !s.instalado || s.id === 'energia' || s.id === 'esclusa') return 'That equipment cannot be turned off or on.'
      const activo = !s.activo
      if (pendiente('equipo', (p) => p.payload.sistema === s.id)) return 'There is already a proposal for that equipment.'
      const nombre = SISTEMA_BY_ID[s.id].nombre
      return proponer(
        'equipo',
        ['logistica', 'comandante', 'medico'],
        `${activo ? 'Start up' : 'Shut down'} ${nombreSistema(s.id)}`,
        activo ? `The ${nombre} works again and uses power again.` : `The ${nombre} stops working and stops using power.`,
        { sistema: s.id, activo },
      )
    }
    case 'ejercicio': {
      const horas = Number(d.horas)
      if (![0, 1, 2.5].includes(horas)) return 'Invalid plan.'
      if (horas === room.ajustes.ejercicio) return 'That is already the current plan.'
      if (pendiente('ejercicio')) return 'There is already a pending exercise proposal.'
      return proponer(
        'ejercicio',
        ['medico', 'comandante'],
        `Exercise: ${horas} h per day`,
        horas === 0
          ? 'It saves oxygen, water and food, but muscle and bone are lost every day.'
          : horas === 1
            ? 'It slows muscle and bone loss by about half.'
            : 'What the Space Station crew does. It keeps the body almost as it was at launch.',
        { horas },
      )
    }
    case 'refugio': {
      if (pendiente('refugio')) return 'There is already a pending shelter order.'
      if (d.salir) return proponer('refugio', ['medico', 'comandante'], 'Leave the Storm Shelter', 'The crew goes back to their stations.', { salir: true })
      const horas = limitar(Number(d.horas) || 12, 1, 72)
      return proponer('refugio', ['medico', 'comandante'], `Go to the Storm Shelter for ${horas} hours`, 'The whole crew takes cover. Nobody works, repairs or goes outside while it lasts.', { horas })
    }

    // --- Acciones directas ---
    case 'reparar': {
      if (!puedeActuar(room, j, ['sistemas'])) return 'Repairs are done by the Systems Engineer.'
      const s = room.sistemas.find((x) => x.id === d.sistema)
      if (!s || !s.instalado) return 'Invalid equipment.'
      if (superficie && SISTEMA_BY_ID[s.id].exterior !== (j.zona === 'exterior')) {
        return SISTEMA_BY_ID[s.id].exterior ? 'That equipment is outside. You have to suit up and go out.' : 'That equipment is inside the habitat.'
      }
      if (s.integridad >= 95) return 'That equipment is in good shape.'
      const kits = s.integridad <= 30 ? 2 : 1
      if (room.rec.repuestos < kits) return `You need ${kits} spare part kits and ${room.rec.repuestos} are left.`
      room.rec.repuestos -= kits
      s.integridad = Math.min(100, s.integridad + 45)
      s.activo = true
      j.vit.fatiga = limitar(j.vit.fatiga + 3, 0, 100)
      log(room, `${j.nombre} repaired the ${nombreSistema(s.id)} (${Math.round(s.integridad)}%).`, 'ok')
      break
    }
    case 'sellar': {
      if (!puedeActuar(room, j, ['sistemas'])) return 'The Systems Engineer seals the leak.'
      if (room.cabina.fuga <= 0) return 'There is no leak.'
      if (room.rec.repuestos < 1) return 'No spare parts left.'
      room.rec.repuestos -= 1
      room.cabina.fuga = 0
      log(room, `${j.nombre} sealed the pressure leak.`, 'ok')
      break
    }
    case 'lioh': {
      if (!puedeActuar(room, j, ['logistica', 'sistemas'])) return 'Cartridges are installed by Resources & Logistics or the Systems Engineer.'
      if (room.rec.lioh < 1) return 'No cartridges left.'
      room.rec.lioh -= 1
      room.rec.liohActivo += C.LIOH_KG_CO2
      log(room, `${j.nombre} installed a lithium hydroxide cartridge.`, 'ok')
      break
    }
    case 'limpiar': {
      if (!superficie) return 'The surface panels do not exist yet.'
      if (j.zona !== 'exterior') return 'You have to suit up and go outside to clean the panels.'
      if (!room.ensamblaje.hechas.paneles) return 'The panels are not deployed yet.'
      if (room.energia.polvo < 0.03) return 'The panels are clean.'
      const antes = Math.round(room.energia.polvo * 100)
      room.energia.polvo = 0.01
      j.vit.fatiga = limitar(j.vit.fatiga + 5, 0, 100)
      log(room, `${j.nombre} cleaned the solar panels (they get back ${antes}% of their power).`, 'ok')
      break
    }
    case 'huerto':
      return 'The garden is set up step by step in the lab.'
    case 'muestra': {
      if (!puedeActuar(room, j, ['cientifico'])) return 'Samples are collected by the Science Specialist.'
      if (room.fase !== 'base') return 'Samples are collected once the base is up and running.'
      if (j.zona !== 'exterior') return 'You have to suit up and go outside.'
      const sitio = String(d.sitio ?? '')
      if (!/^muestra\d$/.test(sitio)) return 'Invalid sample site.'
      if (room.muestreos.includes(sitio)) return 'That site has already been sampled.'
      if (j.muestras >= 3) return 'You are already carrying 3 samples. Analyze them in the lab.'
      room.muestreos.push(sitio)
      j.muestras += 1
      j.vit.fatiga = limitar(j.vit.fatiga + 3, 0, 100)
      log(room, `${j.nombre} collected a soil sample.`, 'ok')
      break
    }
    case 'analizar': {
      if (j.muestras < 1) return 'You are not carrying any samples to analyze.'
      if (j.zona !== 'nave') return 'The lab is inside the habitat.'
      const energia = 1.5 * j.muestras
      if (room.energia.bateria < energia + 2 && room.energia.generacion <= room.energia.consumo) return 'There is not enough power for the lab.'
      room.energia.bateria = Math.max(0, room.energia.bateria - energia)
      room.mision.muestrasAnalizadas += j.muestras
      log(room, `${j.nombre} analyzed ${j.muestras} sample${j.muestras === 1 ? '' : 's'}. ${room.mision.muestrasAnalizadas} of ${room.mision.muestrasObjetivo} done.`, 'ok')
      j.muestras = 0
      break
    }
    case 'tratar': {
      if (!puedeActuar(room, j, ['medico'])) return 'Treatments are given by the Flight Surgeon.'
      const paciente = jugador(room, String(d.jugadorId))
      if (!paciente) return 'Invalid patient.'
      if (room.rec.botiquines < 1) return 'No medical kits left.'
      if (!paciente.dolencia && paciente.incapacitado <= 0 && paciente.vit.salud > 90) return `${paciente.nombre} does not need treatment.`
      room.rec.botiquines -= 1
      paciente.dolencia = null
      paciente.incapacitado = 0
      paciente.vit.salud = limitar(paciente.vit.salud + 20, 0, 100)
      if (paciente.ayuda?.paraRol === 'medico') paciente.ayuda = null
      log(room, `${j.nombre} treated ${paciente.nombre}.`, 'ok')
      break
    }
    default:
      return 'Unknown action.'
  }
  j.aportes = (j.aportes ?? 0) + 1
  refrescar(room)
  return null
}

// ---------- Ayuda entre integrantes ----------

export function pedirAyuda(room: RoomState, id: string, paraRol: Role, motivo: string): string | null {
  const j = jugador(room, id)
  if (!j) return 'Player not found.'
  if (!ROLE_BY_ID[paraRol]) return 'Invalid role.'
  j.ayuda = { paraRol, motivo: motivo.slice(0, 120), desde: ahora() }
  log(room, `${j.nombre} asks the ${ROLE_BY_ID[paraRol].nombre} for help: ${j.ayuda.motivo}`, 'alerta')
  return null
}

export function irAyudar(room: RoomState, id: string, objetivoId: string): string | null {
  const yo = jugador(room, id)
  const obj = jugador(room, objetivoId)
  if (!yo || !obj || !obj.ayuda) return 'That request no longer exists.'
  if (yo.rol !== obj.ayuda.paraRol && yo.rol !== 'comandante') return 'That request was for another role.'
  obj.ayuda = null
  yo.aportes = (yo.aportes ?? 0) + 1
  log(room, `${yo.nombre} is on the way to help ${obj.nombre}.`, 'ok')
  return null
}

// ---------- Emergencias ----------

export function elegirAlternativa(room: RoomState, id: string, emId: string, altId: string): string | null {
  const em = room.emergencias.find((e) => e.id === emId)
  if (!em || em.estado !== 'activa') return 'That emergency is no longer active.'
  const j = jugador(room, id)
  if (!j || !j.rol) return 'You need a role.'
  const alt = em.alternativas.find((a) => a.id === altId)
  if (!alt) return 'Invalid option.'
  if (!puedeActuar(room, j, em.rolesResponsables)) return 'Your role does not decide this emergency.'
  const presentes = em.rolesResponsables.filter((r) => rolPresente(room, r))
  if (presentes.length > 1) {
    if (room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === 'emergencia' && p.payload.emergenciaId === emId)) {
      return 'An option has already been proposed for this emergency.'
    }
    crearPropuesta(room, {
      tipo: 'emergencia',
      titulo: `${em.titulo}: ${alt.etiqueta}`,
      descripcion: alt.consecuencia,
      payload: { emergenciaId: emId, altId },
      proponente: id,
      rolesResponsables: em.rolesResponsables,
    })
    return null
  }
  j.aportes = (j.aportes ?? 0) + 1
  resolverEmergencia(room, em, altId)
  refrescar(room)
  return null
}

function resolverEmergencia(room: RoomState, em: Emergency, altId: string) {
  const alt = em.alternativas.find((a) => a.id === altId)
  if (!alt) return
  em.estado = 'resuelta'
  em.elegida = altId
  em.resultado = aplicarAlternativa(room, em, altId)
  log(room, `${em.titulo}: ${alt.etiqueta.charAt(0).toLowerCase() + alt.etiqueta.slice(1)}. ${em.resultado}`)
}

// ---------- Paso del tiempo ----------

function vencer(room: RoomState, t: number) {
  for (const p of room.propuestas) {
    if (p.estado === 'pendiente' && p.vence <= t) {
      p.estado = 'rechazada'
      log(room, `The proposal "${p.titulo}" expired without a decision.`, 'alerta')
    }
  }
  for (const e of room.emergencias) {
    if (e.estado === 'activa' && e.vence <= t) {
      e.estado = 'vencida'
      if (room.resultado) continue
      const peor = e.alternativas[e.alternativas.length - 1]
      e.elegida = peor.id
      e.resultado = aplicarAlternativa(room, e, peor.id)
      log(room, `Nobody decided in time. ${e.titulo}: ${e.resultado}`, 'alerta')
    }
  }
}

const enMarcha = (room: RoomState) => !['lobby', 'contexto', 'fin'].includes(room.fase) && !room.resultado
const conBots = (room: RoomState) => room.jugadores.some((j) => j.bot)
/** En las salas con bots el reloj también corre en la contextualización: ahí ellos avanzan. */
const corre = (room: RoomState) => enMarcha(room) || (room.fase === 'contexto' && conBots(room))

/**
 * Lleva la sala hasta el instante real `real`, procesando en orden todo lo que debió ocurrir:
 * cada segundo de simulación y cada vencimiento. `ultimoVisto` es la última vez que alguien
 * consultó la sala; si pasó demasiado tiempo (o la misión está en pausa) ese hueco no cuenta.
 * Partiendo de la misma copia guardada, cualquier instancia llega al mismo estado.
 */
export function avanzar(room: RoomState, real: number, ultimoVisto: number) {
  const hueco = Math.max(0, real - ultimoVisto)
  ajustarPlan(room)
  if (room.pausa || hueco > AUSENCIA_MS) room.desfase += hueco
  const hasta = real - room.desfase
  for (let guarda = 0; guarda < 400; guarda++) {
    let t = Infinity
    let esPaso = false
    for (const p of room.propuestas) if (p.estado === 'pendiente' && p.vence < t) t = p.vence
    for (const e of room.emergencias) if (e.estado === 'activa' && e.vence < t) t = e.vence
    if (corre(room) && room.reloj + PASO_MS < t) {
      t = room.reloj + PASO_MS
      esPaso = true
    }
    if (t > hasta) break
    fijarAhora(t)
    if (esPaso) {
      room.reloj = t
      if (enMarcha(room)) pasoSimulacion(room)
      if (conBots(room)) pasoTripulantes(room)
    } else vencer(room, t)
  }
  // Si quedó muy atrás (no debería), se pone al día sin simular el hueco.
  if (corre(room) && hasta - room.reloj > 2 * AUSENCIA_MS) room.reloj = hasta
  fijarAhora(hasta)
}
