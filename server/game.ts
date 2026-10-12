// Reglas del juego: sala, roles, suministros, decisiones, acciones y emergencias.
import { C } from '../shared/ciencia.js'
import {
  CUENTA_REGRESIVA_S,
  ESCALAS,
  ESCALA_MAXIMA,
  PERFIL_BY_ID,
  ROLE_BY_ID,
  SISTEMA_BY_ID,
  SITE_BY_ID,
  SUPPLIES,
  TAREAS_ENSAMBLAJE,
  TRAJE_COLORES,
  TRAJE_VISORES,
  TRAYECTORIA_BY_ID,
  capacidadCarga,
  masaTotal,
  nombreSistema,
  trajePorDefecto,
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
import { conRol, conectados, jugador, limitar, log, puedeActuar, rid, rolPresente, sis, tripulacion } from './base.js'
import { UMBRAL_AVERIA, aplicarAlternativa } from './emergencies.js'
import { ahora, fijarAhora, semilla } from './reloj.js'
import { enSuperficie, iniciarClimaEspacial } from './sim/ambiente.js'
import { iniciarDescenso, pasoSimulacion, refrescar } from './sim/paso.js'

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
    perfil: 'estandar',
    trayectoria: 'estandar',
    mision: { objetivo: '', solesObjetivo: 20, muestrasObjetivo: 5, muestrasAnalizadas: 0, diasTransito: 210 },
    cargamento: Object.fromEntries(SUPPLIES.map((s) => [s.id, s.min])) as Loadout,
    masa: 0,
    capacidad: 0,
    sitio: null,
    vuelo: { altitud: 0, velocidad: 0, g: 1, etapa: 'En tierra', progreso: 0, distTierra: 0, distMarte: 220, distSol: 1, retardo: 0 },
    ambiente: { sol: 0, hora: 8, tempExt: 20, presion: 0, tau: 0, uv: 1, flujoSolar: 1361, tormentaPolvo: false, polvoSoles: 0, solCuriosity: 0, radiacion: 0, tormentaSolar: null },
    cabina: { ppO2: C.PPO2_NOMINAL_KPA, ppCO2: 0.3, temp: C.TEMP_CABINA_C, fuga: 0 },
    rec: { agua: 0, aguaResidual: 0, o2: 0, comida: 0, repuestos: 0, botiquines: 0, lioh: 0, liohActivo: 0, propelente: 100 },
    energia: { bateria: 0, capacidad: 0, generacion: 0, consumo: 0, polvo: 0, cortes: [] },
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
    listo: false,
    muestras: 0,
  }
}

function aplicarPerfil(room: RoomState) {
  const p = PERFIL_BY_ID[room.perfil]
  const bono = room.sitio ? SITE_BY_ID[room.sitio].bonoCiencia : 0
  room.mision.solesObjetivo = p.soles
  room.mision.muestrasObjetivo = Math.max(1, p.muestras - bono)
  room.mision.diasTransito = TRAYECTORIA_BY_ID[room.trayectoria].dias
  room.mision.objetivo = `Llegar a Marte, montar la base y mantener viva a la tripulación durante ${p.soles} soles, analizando ${room.mision.muestrasObjetivo} muestras del terreno.`
  room.capacidad = capacidadCarga(tripulacion(room).length, room.trayectoria)
}

/** Carga sugerida para la tripulación y el plan actuales. `margen` 1 = lo justo. */
export function cargaRecomendada(room: RoomState, margen: number): Loadout {
  const n = Math.max(1, tripulacion(room).length)
  const dias = room.mision.diasTransito + (room.mision.solesObjetivo * C.SOL_S) / 86400 + 2
  // Con reciclaje, el agua se va sobre todo en fabricar oxígeno.
  const aguaKg = (n * (3.2 * 0.07 + 0.84 * C.OGA_AGUA_POR_O2) * dias + 60 + 20 * n) * margen
  const comidaKg = n * C.COMIDA_KG_DIA * dias * margen
  const seguro = margen >= 1.25
  const justo = margen <= 1.02
  const carga: Loadout = {
    agua: Math.ceil(aguaKg / 100),
    oxigeno: justo ? 1 : seguro ? 3 : 2,
    alimentos: Math.ceil(comidaKg / 100),
    lioh: Math.ceil(n * 3 * margen),
    repuestos: Math.ceil((7 + dias / 25) * margen),
    paneles: justo ? 4 : seguro ? 6 : 5,
    baterias: justo ? 1 : 2,
    reactor: 0,
    blindaje: justo ? 0 : seguro ? 2 : 1,
    botiquin: Math.ceil(n * 0.8 * margen),
    huerto: justo ? 0 : 1,
    isru: 0,
  }
  for (const s of SUPPLIES) carga[s.id] = limitar(carga[s.id], s.min, s.max)
  return carga
}

// ---------- Lobby ----------

export function elegirRol(room: RoomState, id: string, rol: Role | null): string | null {
  if (room.fase !== 'lobby') return 'Solo se puede cambiar de rol en el lobby.'
  const j = jugador(room, id)
  if (!j) return 'Jugador no encontrado.'
  if (rol && !ROLE_BY_ID[rol]) return 'Rol inválido.'
  if (rol && room.jugadores.some((o) => o.id !== id && o.rol === rol)) return 'Ese rol ya fue tomado.'
  j.rol = rol
  return null
}

export function elegirTraje(room: RoomState, id: string, traje: Partial<Traje>): string | null {
  const j = jugador(room, id)
  if (!j) return 'Jugador no encontrado.'
  if (room.fase !== 'lobby' && room.fase !== 'contexto') return 'El traje se elige antes del lanzamiento.'
  const color = (v: unknown, lista: string[], actual: string) => (typeof v === 'string' && lista.includes(v) ? v : actual)
  j.traje = {
    color: color(traje.color, TRAJE_COLORES, j.traje.color),
    acento: color(traje.acento, TRAJE_COLORES, j.traje.acento),
    visor: color(traje.visor, TRAJE_VISORES, j.traje.visor),
  }
  return null
}

export function iniciarMision(room: RoomState, id: string): string | null {
  if (room.fase !== 'lobby') return 'La misión ya empezó.'
  if (id !== room.hostId) return 'Solo quien creó la sala puede iniciar.'
  if (!rolPresente(room, 'comandante')) return 'Falta un comandante para iniciar.'
  if (conectados(room).length < 2) return 'Se necesitan al menos 2 jugadores con rol.'
  if (room.jugadores.some((j) => j.conectado && !j.rol)) return 'Todos los conectados deben elegir rol.'
  room.jugadores = room.jugadores.filter((j) => j.rol)
  room.fase = 'contexto'
  aplicarPerfil(room)
  room.cargamento = cargaRecomendada(room, 1.15)
  room.masa = masaTotal(room.cargamento)
  log(room, 'Contextualización: cada integrante conoce su rol, la misión y elige los suministros.')
  return null
}

// ---------- Contextualización ----------

const enContexto = (room: RoomState) => (room.fase === 'contexto' ? null : 'Esto se decide antes del lanzamiento.')

export function ajustarCargamento(room: RoomState, cambios: Partial<Loadout>): string | null {
  const error = enContexto(room)
  if (error) return error
  for (const s of SUPPLIES) {
    const v = cambios[s.id]
    if (typeof v === 'number' && Number.isFinite(v)) room.cargamento[s.id] = limitar(Math.round(v), s.min, s.max)
  }
  room.masa = masaTotal(room.cargamento)
  return null
}

export function aplicarPreset(room: RoomState, preset: string): string | null {
  const error = enContexto(room)
  if (error) return error
  const margen = ({ minimo: 1, equilibrado: 1.15, seguro: 1.3 } as Record<string, number>)[preset]
  if (!margen) return 'Alternativa inválida.'
  room.cargamento = cargaRecomendada(room, margen)
  room.masa = masaTotal(room.cargamento)
  return null
}

export function elegirPerfil(room: RoomState, id: string, perfil: PerfilId): string | null {
  const error = enContexto(room)
  if (error) return error
  const j = jugador(room, id)
  if (!j || !puedeActuar(room, j, ['comandante'])) return 'El objetivo de la misión lo fija el comandante.'
  if (!PERFIL_BY_ID[perfil]) return 'Perfil inválido.'
  room.perfil = perfil
  aplicarPerfil(room)
  return null
}

export function elegirTrayectoria(room: RoomState, id: string, trayectoria: TrayectoriaId): string | null {
  const error = enContexto(room)
  if (error) return error
  const j = jugador(room, id)
  if (!j || !puedeActuar(room, j, ['piloto', 'comandante'])) return 'La trayectoria la eligen el piloto o el comandante.'
  if (!TRAYECTORIA_BY_ID[trayectoria]) return 'Trayectoria inválida.'
  room.trayectoria = trayectoria
  aplicarPerfil(room)
  return null
}

export function marcarListo(room: RoomState, id: string, listo: boolean): string | null {
  const error = enContexto(room)
  if (error) return error
  const j = jugador(room, id)
  if (!j) return 'Jugador no encontrado.'
  j.listo = listo
  return null
}

export function lanzar(room: RoomState, id: string): string | null {
  const error = enContexto(room)
  if (error) return error
  const j = jugador(room, id)
  if (!j || !puedeActuar(room, j, ['comandante'])) return 'Solo el comandante autoriza el lanzamiento.'
  if (room.masa > room.capacidad) return `La carga pesa ${room.masa.toFixed(1)} t y la nave admite ${room.capacidad.toFixed(1)} t.`
  const faltan = conectados(room).filter((o) => o.id !== id && !o.listo)
  if (faltan.length) return `Faltan por confirmar: ${faltan.map((o) => o.nombre).join(', ')}.`

  const c = room.cargamento
  room.rec = { agua: c.agua * 100, aguaResidual: 0, o2: c.oxigeno * 100, comida: c.alimentos * 100, repuestos: c.repuestos, botiquines: c.botiquin, lioh: c.lioh, liohActivo: 0, propelente: 100 }
  room.energia = { bateria: c.baterias * C.BATERIA_KWH, capacidad: c.baterias * C.BATERIA_KWH, generacion: 0, consumo: 0, polvo: 0, cortes: [] }
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
  iniciarClimaEspacial(room)
  log(room, `Lanzamiento autorizado por ${j.nombre}. Carga de ${room.masa.toFixed(1)} t, viaje de ${room.mision.diasTransito} días.`, 'ok')
  refrescar(room)
  return null
}

// ---------- Tiempo ----------

export function fijarEscala(room: RoomState, id: string, valor: number): string | null {
  const j = jugador(room, id)
  if (!j || !puedeActuar(room, j, ['comandante'])) return 'La escala de tiempo la controla el comandante.'
  if (!ESCALAS.some((e) => e.valor === valor)) return 'Escala inválida.'
  if (['lobby', 'contexto', 'lanzamiento', 'fin'].includes(room.fase)) return 'Ahora no se puede cambiar la escala.'
  const maxima = ESCALA_MAXIMA[room.fase]
  if (valor > maxima) return `En esta fase la escala máxima es ×${maxima}.`
  room.escalaDeseada = valor
  refrescar(room)
  return null
}

export function pausar(room: RoomState, id: string, pausa: boolean): string | null {
  const j = jugador(room, id)
  if (!j || !(puedeActuar(room, j, ['comandante']) || id === room.hostId)) return 'Solo el comandante puede pausar la misión.'
  if (room.pausa === pausa) return null
  room.pausa = pausa
  log(room, pausa ? `${j.nombre} pausó la misión.` : `${j.nombre} reanudó la misión.`)
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
  const quien = jugador(room, p.proponente)?.nombre ?? 'Alguien'
  log(room, `${quien} propone: ${p.titulo}.`)
  resolverPropuesta(room, prop)
}

export function votar(room: RoomState, id: string, propId: string, aprueba: boolean): string | null {
  const prop = room.propuestas.find((p) => p.id === propId)
  if (!prop || prop.estado !== 'pendiente') return 'Propuesta no disponible.'
  const j = jugador(room, id)
  if (!j || !j.rol) return 'Necesitas un rol para votar.'
  if (room.modoDecision === 'comandante' && rolPresente(room, 'comandante') && j.rol !== 'comandante' && id !== prop.proponente) {
    return 'En este modo solo decide el comandante.'
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
  log(room, `Propuesta "${prop.titulo}" ${decision ? 'aprobada' : 'rechazada'}.`, decision ? 'ok' : 'alerta')
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
  if (room.fase !== 'llegada' || room.subfase !== 'orbita') return 'El sitio se elige desde la órbita de Marte.'
  const j = jugador(room, id)
  if (!j || !puedeActuar(room, j, ['piloto', 'comandante'])) return 'El sitio lo proponen el piloto o el comandante.'
  const sitio = SITE_BY_ID[sitioId]
  if (!sitio) return 'Sitio inválido.'
  if (room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === 'ubicacion')) return 'Ya hay un sitio propuesto. Revisa las propuestas.'
  crearPropuesta(room, { tipo: 'ubicacion', titulo: `Aterrizar en ${sitio.nombre}`, descripcion: sitio.descripcion, payload: { sitioId }, proponente: id, rolesResponsables: ['piloto', 'comandante'] })
  return null
}

function impedimento(j: Player): string | null {
  if (j.incapacitado > 0) return 'Estás fuera de servicio. Necesitas descanso o al médico.'
  if (j.enRefugio) return 'Estás en el refugio. No puedes trabajar hasta salir.'
  return null
}

export function hacerTarea(room: RoomState, id: string, tareaId: string): string | null {
  if (room.fase !== 'ensamblaje') return 'No estamos montando la base.'
  const j = jugador(room, id)
  const tarea = TAREAS_ENSAMBLAJE.find((t) => t.id === tareaId)
  if (!j || !tarea) return 'Tarea inválida.'
  if (tarea.paso !== room.ensamblaje.paso) return tarea.paso < room.ensamblaje.paso ? 'Esa tarea ya está hecha.' : 'Aún no toca esa tarea.'
  if (room.ensamblaje.hechas[tareaId]) return 'Esa tarea ya está hecha.'
  const impedido = impedimento(j)
  if (impedido) return impedido
  if (!puedeActuar(room, j, tarea.roles)) return `Esa tarea es de ${tarea.roles.map((r) => ROLE_BY_ID[r].nombre).join(' o ')}.`
  if (j.zona !== tarea.zona) return tarea.zona === 'exterior' ? 'Hay que salir con el traje para hacerla.' : 'Se hace dentro del hábitat.'

  room.ensamblaje.hechas[tareaId] = id
  j.vit.fatiga = limitar(j.vit.fatiga + (tarea.zona === 'exterior' ? 6 : 2), 0, 100)
  log(room, `${j.nombre} completó: ${tarea.titulo.toLowerCase()}.`, 'ok')
  if (tareaId === 'soporte') {
    const hielo = SITE_BY_ID[room.sitio ?? 'gale'].hielo
    sis(room, 'isru').instalado = hielo && room.cargamento.isru > 0
    if (room.cargamento.isru > 0 && !hielo) log(room, 'El extractor de hielo no sirve aquí: en este sitio no hay hielo accesible.', 'alerta')
  }
  const pendientes = TAREAS_ENSAMBLAJE.filter((t) => t.paso === room.ensamblaje.paso && !room.ensamblaje.hechas[t.id])
  if (pendientes.length === 0) {
    room.ensamblaje.paso += 1
    if (room.ensamblaje.paso > 3) {
      room.fase = 'base'
      room.tFase = room.t
      room.escalaDeseada = 600
      log(room, 'Instalaciones comprobadas. Empiezan las operaciones de la base.', 'ok')
    }
  }
  refrescar(room)
  return null
}

// ---------- Movimiento entre zonas y actividades ----------

export function cambiarZona(room: RoomState, id: string, zona: Zona): string | null {
  const j = jugador(room, id)
  if (!j || !j.rol) return 'Jugador no encontrado.'
  if (zona !== 'nave' && zona !== 'exterior') return 'Zona inválida.'
  if (j.zona === zona) return null
  if (zona === 'nave') {
    j.zona = 'nave'
    log(room, `${j.nombre} volvió al hábitat.`)
    refrescar(room)
    return null
  }
  if (!enSuperficie(room) || (room.fase !== 'ensamblaje' && room.fase !== 'base')) return 'Solo se puede salir cuando la nave está en Marte.'
  const impedido = impedimento(j)
  if (impedido) return impedido
  const esclusa = sis(room, 'esclusa')
  if (esclusa.integridad <= UMBRAL_AVERIA) return 'La esclusa está averiada. Sistemas debe repararla.'
  if (j.trajeO2 < C.TRAJE_O2_KG * 0.3 || j.trajeBateria < 0.3) return 'El traje no está cargado. Espera a que la esclusa lo recargue.'
  j.zona = 'exterior'
  j.manual = null
  esclusa.integridad = Math.max(0, esclusa.integridad - 0.4)
  log(room, `${j.nombre} salió al exterior. Fuera hay ${room.ambiente.tempExt} °C.`)
  refrescar(room)
  return null
}

export function fijarActividad(room: RoomState, id: string, actividad: Actividad | null): string | null {
  const j = jugador(room, id)
  if (!j) return 'Jugador no encontrado.'
  if (actividad !== null && actividad !== 'ejercicio' && actividad !== 'sueno') return 'Actividad inválida.'
  if (actividad && j.zona !== 'nave') return 'Eso se hace dentro del hábitat.'
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
  if (!j) return 'Jugador no encontrado.'
  if (j.zona !== 'nave') return 'El refugio está dentro del hábitat.'
  j.enRefugio = entrar
  if (entrar) j.manual = null
  return null
}

// ---------- Acciones de los roles ----------

const NIVELES_COMIDA: Record<RacionComida, string> = {
  normal: 'Ración completa. La tripulación mantiene sus reservas.',
  ahorro: 'Ración al 80%. La comida dura un 25% más y las reservas del cuerpo bajan poco a poco.',
  estricto: 'Ración al 60%. La comida dura un 67% más; en unas semanas la salud se resiente.',
}
const PRIORIDADES: Record<string, string> = {
  vida: 'Si falta energía, lo último en apagarse es el aire: primero se sacrifica el calor.',
  calor: 'Si falta energía, se protege la calefacción y el oxígeno sale de los tanques.',
  ciencia: 'Si falta energía, se protege el huerto antes que la calefacción.',
}

export function accion(room: RoomState, id: string, tipo: string, d: Record<string, unknown>): string | null {
  if (!['transito', 'llegada', 'ensamblaje', 'base'].includes(room.fase)) return 'Ahora no se pueden hacer acciones.'
  const j = jugador(room, id)
  if (!j || !j.rol) return 'Jugador no encontrado.'
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
    if (!puedeActuar(room, j, roles)) return `Eso lo proponen: ${roles.map((r) => ROLE_BY_ID[r].nombre).join(', ')}.`
    crearPropuesta(room, { tipo: t, titulo, descripcion, payload, proponente: id, rolesResponsables: roles })
    return null
  }

  switch (tipo) {
    // --- Decisiones que pasan por el comandante o por votación ---
    case 'racionComida': {
      const nivel = String(d.nivel) as RacionComida
      if (!NIVELES_COMIDA[nivel]) return 'Nivel inválido.'
      if (nivel === room.ajustes.racionComida) return 'Esa ya es la ración actual.'
      if (pendiente('racionComida')) return 'Ya hay una propuesta de ración pendiente.'
      return proponer('racionComida', ['logistica', 'comandante'], `Ración de comida: ${nivel}`, NIVELES_COMIDA[nivel], { nivel })
    }
    case 'racionAgua': {
      const nivel = d.nivel === 'ahorro' ? 'ahorro' : 'normal'
      if (nivel === room.ajustes.racionAgua) return 'Ese ya es el uso de agua actual.'
      if (pendiente('racionAgua')) return 'Ya hay una propuesta de agua pendiente.'
      return proponer(
        'racionAgua',
        ['logistica', 'comandante'],
        nivel === 'ahorro' ? 'Ahorro de agua' : 'Uso normal de agua',
        nivel === 'ahorro' ? 'La higiene se recorta al mínimo. Lo que se bebe no cambia.' : 'Se recupera la higiene normal.',
        { nivel },
      )
    }
    case 'prioridad': {
      const valor = String(d.valor)
      if (!PRIORIDADES[valor]) return 'Prioridad inválida.'
      if (valor === room.ajustes.prioridad) return 'Esa ya es la prioridad actual.'
      if (pendiente('prioridad')) return 'Ya hay una propuesta de prioridad pendiente.'
      return proponer('prioridad', ['logistica', 'comandante'], `Prioridad de energía: ${valor}`, PRIORIDADES[valor], { valor })
    }
    case 'equipo': {
      const s = room.sistemas.find((x) => x.id === d.sistema)
      if (!s || !s.instalado || s.id === 'energia' || s.id === 'esclusa') return 'Ese equipo no se puede apagar ni encender.'
      const activo = !s.activo
      if (pendiente('equipo', (p) => p.payload.sistema === s.id)) return 'Ya hay una propuesta para ese equipo.'
      const nombre = SISTEMA_BY_ID[s.id].nombre
      return proponer(
        'equipo',
        ['logistica', 'comandante', 'medico'],
        `${activo ? 'Encender' : 'Apagar'} ${nombreSistema(s.id)}`,
        activo ? `${nombre} vuelve a funcionar y a consumir energía.` : `${nombre} deja de funcionar y de consumir energía.`,
        { sistema: s.id, activo },
      )
    }
    case 'ejercicio': {
      const horas = Number(d.horas)
      if (![0, 1, 2.5].includes(horas)) return 'Plan inválido.'
      if (horas === room.ajustes.ejercicio) return 'Ese ya es el plan actual.'
      if (pendiente('ejercicio')) return 'Ya hay una propuesta de ejercicio pendiente.'
      return proponer(
        'ejercicio',
        ['medico', 'comandante'],
        `Ejercicio: ${horas} h al día`,
        horas === 0
          ? 'Se ahorra oxígeno, agua y comida, pero se pierde músculo y hueso cada día.'
          : horas === 1
            ? 'Frena a medias la pérdida de músculo y hueso.'
            : 'Lo que hace la tripulación de la Estación Espacial. Mantiene el cuerpo casi como al salir.',
        { horas },
      )
    }
    case 'refugio': {
      if (pendiente('refugio')) return 'Ya hay una orden de refugio pendiente.'
      if (d.salir) return proponer('refugio', ['medico', 'comandante'], 'Salir del refugio', 'La tripulación vuelve a sus puestos.', { salir: true })
      const horas = limitar(Number(d.horas) || 12, 1, 72)
      return proponer('refugio', ['medico', 'comandante'], `Ir al refugio ${horas} horas`, 'Toda la tripulación se protege. Nadie trabaja, repara ni sale mientras dure.', { horas })
    }

    // --- Acciones directas ---
    case 'reparar': {
      if (!puedeActuar(room, j, ['sistemas'])) return 'Las reparaciones las hace el responsable de sistemas.'
      const s = room.sistemas.find((x) => x.id === d.sistema)
      if (!s || !s.instalado) return 'Equipo inválido.'
      if (superficie && SISTEMA_BY_ID[s.id].exterior !== (j.zona === 'exterior')) {
        return SISTEMA_BY_ID[s.id].exterior ? 'Ese equipo está fuera: hay que salir con el traje.' : 'Ese equipo está dentro del hábitat.'
      }
      if (s.integridad >= 95) return 'Ese equipo está en buen estado.'
      const kits = s.integridad <= 30 ? 2 : 1
      if (room.rec.repuestos < kits) return `Hacen falta ${kits} kits de repuestos y quedan ${room.rec.repuestos}.`
      room.rec.repuestos -= kits
      s.integridad = Math.min(100, s.integridad + 45)
      s.activo = true
      j.vit.fatiga = limitar(j.vit.fatiga + 3, 0, 100)
      log(room, `${j.nombre} reparó ${nombreSistema(s.id)} (${Math.round(s.integridad)}%).`, 'ok')
      break
    }
    case 'sellar': {
      if (!puedeActuar(room, j, ['sistemas'])) return 'La fuga la sella el responsable de sistemas.'
      if (room.cabina.fuga <= 0) return 'No hay ninguna fuga.'
      if (room.rec.repuestos < 1) return 'No quedan repuestos.'
      room.rec.repuestos -= 1
      room.cabina.fuga = 0
      log(room, `${j.nombre} selló la fuga de presión.`, 'ok')
      break
    }
    case 'lioh': {
      if (!puedeActuar(room, j, ['logistica', 'sistemas'])) return 'Los cartuchos los instalan logística o sistemas.'
      if (room.rec.lioh < 1) return 'No quedan cartuchos.'
      room.rec.lioh -= 1
      room.rec.liohActivo += C.LIOH_KG_CO2
      log(room, `${j.nombre} instaló un cartucho de hidróxido de litio.`, 'ok')
      break
    }
    case 'limpiar': {
      if (!superficie) return 'Los paneles de superficie aún no existen.'
      if (j.zona !== 'exterior') return 'Hay que salir con el traje para limpiar los paneles.'
      if (!room.ensamblaje.hechas.paneles) return 'Los paneles aún no están desplegados.'
      if (room.energia.polvo < 0.03) return 'Los paneles están limpios.'
      const antes = Math.round(room.energia.polvo * 100)
      room.energia.polvo = 0.01
      j.vit.fatiga = limitar(j.vit.fatiga + 5, 0, 100)
      log(room, `${j.nombre} limpió los paneles solares (recuperan un ${antes}% de potencia).`, 'ok')
      break
    }
    case 'huerto': {
      if (!puedeActuar(room, j, ['cientifico'])) return 'El huerto lo establece el especialista científico.'
      if (room.cargamento.huerto < 1) return 'No trajeron el kit de huerto.'
      if (room.huerto.establecido) return 'El huerto ya está establecido.'
      if (j.zona !== 'nave') return 'El huerto se monta dentro del hábitat.'
      if (room.rec.agua < 8) return 'Hacen falta 5 kg de agua para avanzar el huerto.'
      room.rec.agua -= 5
      room.huerto.progreso = Math.min(100, room.huerto.progreso + 25)
      j.vit.fatiga = limitar(j.vit.fatiga + 2, 0, 100)
      if (room.huerto.progreso >= 100) {
        room.huerto.establecido = true
        log(room, 'Huerto artificial establecido. Dará oxígeno y la primera cosecha en 28 días.', 'ok')
      } else log(room, `${j.nombre} avanzó el huerto (${room.huerto.progreso}%).`)
      break
    }
    case 'muestra': {
      if (!puedeActuar(room, j, ['cientifico'])) return 'Las muestras las recoge el especialista científico.'
      if (room.fase !== 'base') return 'Las muestras se recogen cuando la base está operativa.'
      if (j.zona !== 'exterior') return 'Hay que salir con el traje.'
      const sitio = String(d.sitio ?? '')
      if (!/^muestra\d$/.test(sitio)) return 'Punto de muestreo inválido.'
      if (room.muestreos.includes(sitio)) return 'Ese punto ya fue muestreado.'
      if (j.muestras >= 3) return 'Ya llevas 3 muestras. Analízalas en el laboratorio.'
      room.muestreos.push(sitio)
      j.muestras += 1
      j.vit.fatiga = limitar(j.vit.fatiga + 3, 0, 100)
      log(room, `${j.nombre} recogió una muestra del terreno.`, 'ok')
      break
    }
    case 'analizar': {
      if (j.muestras < 1) return 'No llevas muestras sin analizar.'
      if (j.zona !== 'nave') return 'El laboratorio está dentro del hábitat.'
      const energia = 1.5 * j.muestras
      if (room.energia.bateria < energia + 2 && room.energia.generacion <= room.energia.consumo) return 'No hay energía suficiente para el laboratorio.'
      room.energia.bateria = Math.max(0, room.energia.bateria - energia)
      room.mision.muestrasAnalizadas += j.muestras
      log(room, `${j.nombre} analizó ${j.muestras} muestra(s). Van ${room.mision.muestrasAnalizadas} de ${room.mision.muestrasObjetivo}.`, 'ok')
      j.muestras = 0
      break
    }
    case 'tratar': {
      if (!puedeActuar(room, j, ['medico'])) return 'Los tratamientos los hace el médico.'
      const paciente = jugador(room, String(d.jugadorId))
      if (!paciente) return 'Paciente inválido.'
      if (room.rec.botiquines < 1) return 'No quedan botiquines.'
      if (!paciente.dolencia && paciente.incapacitado <= 0 && paciente.vit.salud > 90) return `${paciente.nombre} no necesita tratamiento.`
      room.rec.botiquines -= 1
      paciente.dolencia = null
      paciente.incapacitado = 0
      paciente.vit.salud = limitar(paciente.vit.salud + 20, 0, 100)
      if (paciente.ayuda?.paraRol === 'medico') paciente.ayuda = null
      log(room, `${j.nombre} atendió a ${paciente.nombre}.`, 'ok')
      break
    }
    default:
      return 'Acción desconocida.'
  }
  refrescar(room)
  return null
}

// ---------- Ayuda entre integrantes ----------

export function pedirAyuda(room: RoomState, id: string, paraRol: Role, motivo: string): string | null {
  const j = jugador(room, id)
  if (!j) return 'Jugador no encontrado.'
  if (!ROLE_BY_ID[paraRol]) return 'Rol inválido.'
  j.ayuda = { paraRol, motivo: motivo.slice(0, 120), desde: ahora() }
  log(room, `${j.nombre} pide ayuda a ${ROLE_BY_ID[paraRol].nombre}: ${j.ayuda.motivo}`, 'alerta')
  return null
}

export function irAyudar(room: RoomState, id: string, objetivoId: string): string | null {
  const yo = jugador(room, id)
  const obj = jugador(room, objetivoId)
  if (!yo || !obj || !obj.ayuda) return 'Esa solicitud ya no existe.'
  if (yo.rol !== obj.ayuda.paraRol && yo.rol !== 'comandante') return 'Esa solicitud era para otro rol.'
  obj.ayuda = null
  log(room, `${yo.nombre} acude a ayudar a ${obj.nombre}.`, 'ok')
  return null
}

// ---------- Emergencias ----------

export function elegirAlternativa(room: RoomState, id: string, emId: string, altId: string): string | null {
  const em = room.emergencias.find((e) => e.id === emId)
  if (!em || em.estado !== 'activa') return 'Esa emergencia ya no está activa.'
  const j = jugador(room, id)
  if (!j || !j.rol) return 'Necesitas un rol.'
  const alt = em.alternativas.find((a) => a.id === altId)
  if (!alt) return 'Alternativa inválida.'
  if (!puedeActuar(room, j, em.rolesResponsables)) return 'Tu rol no decide esta emergencia.'
  const presentes = em.rolesResponsables.filter((r) => rolPresente(room, r))
  if (presentes.length > 1) {
    if (room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === 'emergencia' && p.payload.emergenciaId === emId)) {
      return 'Ya hay una alternativa propuesta para esta emergencia.'
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
  log(room, `${em.titulo}: ${alt.etiqueta.toLowerCase()}. ${em.resultado}`)
}

// ---------- Paso del tiempo ----------

function vencer(room: RoomState, t: number) {
  for (const p of room.propuestas) {
    if (p.estado === 'pendiente' && p.vence <= t) {
      p.estado = 'rechazada'
      log(room, `La propuesta "${p.titulo}" venció sin decisión.`, 'alerta')
    }
  }
  for (const e of room.emergencias) {
    if (e.estado === 'activa' && e.vence <= t) {
      e.estado = 'vencida'
      if (room.resultado) continue
      const peor = e.alternativas[e.alternativas.length - 1]
      e.elegida = peor.id
      e.resultado = aplicarAlternativa(room, e, peor.id)
      log(room, `Nadie decidió a tiempo. ${e.titulo}: ${e.resultado}`, 'alerta')
    }
  }
}

const enMarcha = (room: RoomState) => !['lobby', 'contexto', 'fin'].includes(room.fase) && !room.resultado

/**
 * Lleva la sala hasta el instante real `real`, procesando en orden todo lo que debió ocurrir:
 * cada segundo de simulación y cada vencimiento. `ultimoVisto` es la última vez que alguien
 * consultó la sala; si pasó demasiado tiempo (o la misión está en pausa) ese hueco no cuenta.
 * Partiendo de la misma copia guardada, cualquier instancia llega al mismo estado.
 */
export function avanzar(room: RoomState, real: number, ultimoVisto: number) {
  const hueco = Math.max(0, real - ultimoVisto)
  if (room.pausa || hueco > AUSENCIA_MS) room.desfase += hueco
  const hasta = real - room.desfase
  for (let guarda = 0; guarda < 400; guarda++) {
    let t = Infinity
    let esPaso = false
    for (const p of room.propuestas) if (p.estado === 'pendiente' && p.vence < t) t = p.vence
    for (const e of room.emergencias) if (e.estado === 'activa' && e.vence < t) t = e.vence
    if (enMarcha(room) && room.reloj + PASO_MS < t) {
      t = room.reloj + PASO_MS
      esPaso = true
    }
    if (t > hasta) break
    fijarAhora(t)
    if (esPaso) {
      room.reloj = t
      pasoSimulacion(room)
    } else vencer(room, t)
  }
  // Si quedó muy atrás (no debería), se pone al día sin simular el hueco.
  if (enMarcha(room) && hasta - room.reloj > 2 * AUSENCIA_MS) room.reloj = hasta
  fijarAhora(hasta)
}
