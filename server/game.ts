import {
  ACTIONS,
  ASSEMBLY_STEPS,
  HORA_MS,
  MASA_MAXIMA,
  MODULE_BY_ID,
  ROLE_BY_ID,
  SITES,
  SUPPLIES,
  TRANSITO_MS,
  defaultLoadout,
  masaTotal,
  type DecisionMode,
  type Emergency,
  type Loadout,
  type ModuleId,
  type Player,
  type Proposal,
  type ProposalType,
  type RacionLevel,
  type Role,
  type RoomState,
} from '../shared/types.js'
import { EMERGENCIAS, aplicarAlternativa } from './emergencies.js'

const rid = () => Math.random().toString(36).slice(2, 10)

export function log(room: RoomState, texto: string, tipo: 'info' | 'alerta' | 'ok' | 'bot' = 'info') {
  room.registro.push({ t: Date.now(), texto, tipo })
  if (room.registro.length > 80) room.registro.shift()
}

export function crearSala(codigo: string, hostId: string, modoDecision: DecisionMode): RoomState {
  return {
    codigo,
    hostId,
    modoDecision,
    fase: 'lobby',
    jugadores: [],
    mision: {
      objetivo: 'Establecer una base en Marte, mantener viva a la tripulación durante 6 soles y completar 3 experimentos científicos.',
      solesObjetivo: 6,
      experimentosObjetivo: 3,
      sol: 1,
      hora: 8,
      combustible: 100,
      diasTransito: 0,
      experimentos: 0,
    },
    cargamento: defaultLoadout(),
    masa: masaTotal(defaultLoadout()),
    transito: null,
    ensamblaje: { paso: 0, sitio: null, confirmaciones: {} },
    recursos: { agua: 0, oxigeno: 0, alimentos: 0, energia: 0, repuestos: 0, botiquines: 0 },
    capacidad: { agua: 1000, oxigeno: 1000, alimentos: 1000, energia: 100, repuestos: 60, botiquines: 6 },
    sistemas: ['habitat', 'soporteVital', 'energia', 'invernadero', 'almacen', 'taller', 'refugio'].map((id) => ({
      id: id as ModuleId,
      integridad: 100,
      online: false,
    })),
    racion: 'normal',
    reciclajeActivo: false,
    enRefugio: false,
    refugioHasta: 0,
    radiacion: 0.2,
    blindaje: 0,
    tormenta: false,
    tormentaHasta: 0,
    huerto: { establecido: false, progreso: 0 },
    prioridadEnergia: 'soporteVital',
    propuestas: [],
    emergencias: [],
    registro: [],
    chat: [],
    resultado: null,
    puntosCriticos: [],
  }
}

export function nuevoJugador(id: string, nombre: string): Player {
  return {
    id,
    nombre,
    rol: null,
    conectado: true,
    salud: 100,
    oxigeno: 100,
    pulso: 72,
    ubicacion: 'habitat',
    ayuda: null,
    ayudando: null,
    fueraDeServicio: 0,
  }
}

export const jugador = (room: RoomState, id: string) => room.jugadores.find((j) => j.id === id)
export const conRol = (room: RoomState, rol: Role) => room.jugadores.filter((j) => j.rol === rol && j.conectado)
export const rolPresente = (room: RoomState, rol: Role) => conRol(room, rol).length > 0
export const activos = (room: RoomState) => room.jugadores.filter((j) => j.conectado && j.rol)

// ---------- Lobby ----------

export function elegirRol(room: RoomState, playerId: string, rol: Role | null): string | null {
  if (room.fase !== 'lobby') return 'Solo se puede cambiar de rol en el lobby.'
  const j = jugador(room, playerId)
  if (!j) return 'Jugador no encontrado.'
  if (rol && room.jugadores.some((o) => o.id !== playerId && o.rol === rol)) return 'Ese rol ya fue tomado.'
  j.rol = rol
  return null
}

export function iniciarMision(room: RoomState, playerId: string): string | null {
  if (room.fase !== 'lobby') return 'La misión ya empezó.'
  if (playerId !== room.hostId) return 'Solo quien creó la sala puede iniciar.'
  if (!rolPresente(room, 'comandante')) return 'Falta un comandante para iniciar.'
  if (activos(room).length < 2) return 'Se necesitan al menos 2 jugadores con rol.'
  if (room.jugadores.some((j) => j.conectado && !j.rol)) return 'Todos los conectados deben elegir rol.'
  room.fase = 'contexto'
  log(room, 'Contextualización: cada rol recibe la situación y se elige el cargamento.', 'info')
  return null
}

// ---------- Contextualización ----------

export function ajustarCargamento(room: RoomState, patch: Partial<Loadout>): string | null {
  if (room.fase !== 'contexto') return 'El cargamento solo se ajusta antes del lanzamiento.'
  for (const s of SUPPLIES) {
    const v = patch[s.id]
    if (typeof v === 'number' && Number.isFinite(v)) {
      room.cargamento[s.id] = Math.max(s.min, Math.min(s.max, Math.round(v)))
    }
  }
  room.masa = masaTotal(room.cargamento)
  return null
}

export function lanzar(room: RoomState, playerId: string): string | null {
  if (room.fase !== 'contexto') return 'No estamos en contextualización.'
  const j = jugador(room, playerId)
  if (!j || j.rol !== 'comandante') return 'Solo el comandante autoriza el lanzamiento.'
  if (room.masa > MASA_MAXIMA) return `La masa supera el máximo (${room.masa.toFixed(1)} t de ${MASA_MAXIMA} t).`
  // combustible: más masa, más consumo
  room.mision.combustible = Math.max(5, Math.round(100 - room.masa * 1.6))
  room.mision.diasTransito = 0
  room.transito = { inicio: Date.now(), duracion: TRANSITO_MS }
  room.fase = 'lanzamiento'
  const c = room.cargamento
  room.recursos = {
    agua: c.agua * 50,
    oxigeno: c.oxigeno * 50,
    alimentos: c.alimentos * 50,
    energia: 100,
    repuestos: c.repuestos * 5,
    botiquines: c.botiquin,
  }
  room.capacidad = { agua: 1200, oxigeno: 1200, alimentos: 1200, energia: 60 + c.paneles * 15, repuestos: 80, botiquines: 8 }
  room.blindaje = c.blindaje
  log(room, `Lanzamiento autorizado por ${j.nombre}. Masa ${room.masa.toFixed(1)} t, combustible restante ${room.mision.combustible}%.`, 'ok')
  return null
}

function actualizarTransito(room: RoomState) {
  if (room.fase !== 'lanzamiento' || !room.transito) return
  const p = Math.min(1, (Date.now() - room.transito.inicio) / room.transito.duracion)
  room.mision.diasTransito = Math.round(p * 210)
  if (p >= 1) {
    room.fase = 'ensamblaje'
    room.transito = null
    log(room, 'Llegada a la órbita de Marte. Comienza la misión de ensamblaje de la base.', 'ok')
  }
}

// ---------- Ensamblaje ----------

export function confirmarPaso(room: RoomState, playerId: string, paso: number): string | null {
  if (room.fase !== 'ensamblaje') return 'No estamos en ensamblaje.'
  if (paso !== room.ensamblaje.paso) return 'Ese paso no está activo.'
  const j = jugador(room, playerId)
  const step = ASSEMBLY_STEPS[paso]
  if (!j || !j.rol || !step.roles.includes(j.rol)) return 'Tu rol no es responsable de este paso.'
  if (paso === 0) return 'La ubicación se decide por propuesta.'
  const lista = (room.ensamblaje.confirmaciones[paso] ??= [])
  if (!lista.includes(playerId)) lista.push(playerId)
  log(room, `${j.nombre} (${ROLE_BY_ID[j.rol].corto}) confirmó: ${step.titulo}.`, 'ok')
  revisarPaso(room)
  return null
}

function revisarPaso(room: RoomState) {
  const paso = room.ensamblaje.paso
  const step = ASSEMBLY_STEPS[paso]
  if (!step || paso === 0) return
  const confirmados = room.ensamblaje.confirmaciones[paso] ?? []
  const faltan = step.roles.filter((r) => rolPresente(room, r) && !conRol(room, r).some((j) => confirmados.includes(j.id)))
  if (faltan.length === 0) avanzarPaso(room)
}

function avanzarPaso(room: RoomState) {
  const paso = room.ensamblaje.paso
  if (paso === 1) {
    for (const s of room.sistemas) if (['habitat', 'almacen', 'taller', 'refugio'].includes(s.id)) s.online = true
  }
  if (paso === 2) {
    for (const s of room.sistemas) if (['soporteVital', 'energia'].includes(s.id)) s.online = true
  }
  room.ensamblaje.paso = paso + 1
  if (room.ensamblaje.paso >= ASSEMBLY_STEPS.length) {
    room.fase = 'base'
    room.mision.sol = 1
    room.mision.hora = 8
    log(room, 'Instalaciones comprobadas. Empieza la gestión diaria de la base.', 'ok')
    return
  }
  const siguiente = ASSEMBLY_STEPS[room.ensamblaje.paso]
  log(room, `Paso completado. Siguiente: ${siguiente.titulo}.`, 'info')
  // Si ningún rol responsable del siguiente paso está en la sala, el sistema lo da por hecho.
  if (!siguiente.roles.some((r) => rolPresente(room, r))) {
    log(room, `Nadie con rol ${siguiente.roles.map((r) => ROLE_BY_ID[r].corto).join('/')} en la sala: el sistema completa "${siguiente.titulo}".`, 'info')
    avanzarPaso(room)
  }
}

export function proponerUbicacion(room: RoomState, playerId: string, sitioId: string): string | null {
  if (room.fase !== 'ensamblaje' || room.ensamblaje.paso !== 0) return 'La ubicación ya fue decidida.'
  const j = jugador(room, playerId)
  if (!j || !j.rol || !['piloto', 'comandante'].includes(j.rol)) return 'Solo piloto o comandante proponen la ubicación.'
  const sitio = SITES.find((s) => s.id === sitioId)
  if (!sitio) return 'Sitio inválido.'
  if (room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === 'ubicacion')) return 'Ya hay una propuesta de ubicación pendiente.'
  crearPropuesta(room, {
    tipo: 'ubicacion',
    titulo: `Aterrizar en ${sitio.nombre}`,
    descripcion: sitio.descripcion,
    payload: { sitioId },
    proponente: playerId,
    rolesResponsables: ['piloto', 'comandante'],
  })
  return null
}

// ---------- Propuestas ----------

export function crearPropuesta(
  room: RoomState,
  p: { tipo: ProposalType; titulo: string; descripcion: string; payload: Record<string, unknown>; proponente: string; rolesResponsables: Role[] },
) {
  const prop: Proposal = {
    id: rid(),
    ...p,
    votos: { [p.proponente]: true },
    estado: 'pendiente',
    creada: Date.now(),
    vence: Date.now() + 90_000,
  }
  room.propuestas.unshift(prop)
  const quien = jugador(room, p.proponente)?.nombre ?? 'Alguien'
  log(room, `${quien} propone: ${p.titulo}. ${room.modoDecision === 'comandante' ? 'Espera aprobación del comandante.' : 'Se vota por mayoría.'}`, 'info')
  resolverPropuesta(room, prop)
  if (room.propuestas.length > 20) room.propuestas.length = 20
}

export function votar(room: RoomState, playerId: string, propId: string, aprueba: boolean): string | null {
  const prop = room.propuestas.find((p) => p.id === propId)
  if (!prop || prop.estado !== 'pendiente') return 'Propuesta no disponible.'
  const j = jugador(room, playerId)
  if (!j || !j.rol) return 'Necesitas un rol para votar.'
  if (room.modoDecision === 'comandante' && rolPresente(room, 'comandante') && j.rol !== 'comandante' && playerId !== prop.proponente) {
    return 'En este modo solo decide el comandante.'
  }
  prop.votos[playerId] = aprueba
  resolverPropuesta(room, prop)
  return null
}

function resolverPropuesta(room: RoomState, prop: Proposal) {
  if (prop.estado !== 'pendiente') return
  const votantes = activos(room)
  const cmd = conRol(room, 'comandante')[0]
  let decision: boolean | null = null

  if (room.modoDecision === 'comandante' && cmd) {
    const v = prop.votos[cmd.id]
    if (typeof v === 'boolean') decision = v
  } else {
    const si = votantes.filter((j) => prop.votos[j.id] === true).length
    const no = votantes.filter((j) => prop.votos[j.id] === false).length
    const mitad = votantes.length / 2
    if (si > mitad) decision = true
    else if (no >= mitad && votantes.length > 1) decision = false
    else if (votantes.length === 1) decision = true
  }
  if (decision === null) return
  prop.estado = decision ? 'aprobada' : 'rechazada'
  log(room, `Propuesta "${prop.titulo}" ${decision ? 'aprobada' : 'rechazada'}.`, decision ? 'ok' : 'alerta')
  if (decision) aplicarPropuesta(room, prop)
}

function aplicarPropuesta(room: RoomState, prop: Proposal) {
  switch (prop.tipo) {
    case 'ubicacion': {
      const sitio = SITES.find((s) => s.id === prop.payload.sitioId)!
      room.ensamblaje.sitio = sitio.id
      room.recursos.agua = Math.min(room.capacidad.agua, room.recursos.agua + sitio.aguaExtra)
      room.blindaje += sitio.blindajeExtra
      avanzarPaso(room)
      break
    }
    case 'racionar':
      room.racion = prop.payload.nivel as RacionLevel
      break
    case 'reciclaje':
      room.reciclajeActivo = Boolean(prop.payload.activo)
      break
    case 'refugio':
      irAlRefugio(room, 6)
      break
    case 'emergencia': {
      const em = room.emergencias.find((e) => e.id === prop.payload.emergenciaId)
      if (em && em.estado === 'activa') resolverEmergencia(room, em, String(prop.payload.altId))
      break
    }
  }
}

function irAlRefugio(room: RoomState, horas: number) {
  room.enRefugio = true
  room.refugioHasta = room.mision.sol * 24 + room.mision.hora + horas
  for (const j of room.jugadores) j.ubicacion = 'refugio'
  log(room, `Tripulación en el refugio durante ${horas} horas. La producción se detiene.`, 'alerta')
}

// ---------- Acciones directas ----------

export function accion(room: RoomState, playerId: string, id: string, payload: Record<string, unknown>): string | null {
  if (room.fase !== 'base') return 'Las acciones de base solo están disponibles en la gestión diaria.'
  const j = jugador(room, playerId)
  const def = ACTIONS.find((a) => a.id === id)
  if (!j || !def) return 'Acción inválida.'
  if (!j.rol || !def.roles.includes(j.rol)) return 'Tu rol no es responsable de esta acción.'
  if (j.fueraDeServicio > 0) return 'Estás fuera de servicio. Pide ayuda al médico.'

  if (def.requierePropuesta) {
    if (room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === id)) return 'Ya hay una propuesta igual pendiente.'
    let titulo = def.nombre
    let descripcion = def.descripcion
    if (id === 'racionar') {
      const nivel = String(payload.nivel ?? 'normal') as RacionLevel
      titulo = `Ración ${nivel}`
      descripcion = { normal: 'Consumo completo, salud estable.', ahorro: 'Consumo al 80%. Salud baja 0.1 por hora.', estricto: 'Consumo al 60%. Salud baja 0.4 por hora.' }[nivel]
      payload = { nivel }
    }
    if (id === 'reciclaje') {
      const activo = !room.reciclajeActivo
      titulo = activo ? 'Activar reciclaje' : 'Desactivar reciclaje'
      descripcion = activo ? 'Recupera 60% del agua y 50% del oxígeno. Consume 2 de energía por hora.' : 'Ahorra energía pero el agua y el oxígeno bajan más rápido.'
      payload = { activo }
    }
    if (id === 'refugio') {
      titulo = 'Ir al refugio 6 horas'
      descripcion = 'Dosis de radiación -90%. Sin producción de alimentos ni experimentos.'
    }
    crearPropuesta(room, { tipo: id as ProposalType, titulo, descripcion, payload, proponente: playerId, rolesResponsables: def.roles })
    return null
  }

  switch (id) {
    case 'reparar': {
      const mod = room.sistemas.find((s) => s.id === payload.modulo)
      if (!mod) return 'Módulo inválido.'
      if (room.recursos.repuestos < 2) return 'No quedan repuestos suficientes.'
      room.recursos.repuestos -= 2
      mod.integridad = Math.min(100, mod.integridad + 40)
      mod.online = true
      j.ubicacion = mod.id
      log(room, `${j.nombre} reparó ${MODULE_BY_ID[mod.id].nombre} (integridad ${Math.round(mod.integridad)}%).`, 'ok')
      return null
    }
    case 'prioridad': {
      const mod = room.sistemas.find((s) => s.id === payload.modulo)
      if (!mod) return 'Módulo inválido.'
      room.prioridadEnergia = mod.id
      log(room, `Prioridad de energía: ${MODULE_BY_ID[mod.id].nombre}.`, 'info')
      return null
    }
    case 'huerto': {
      if (room.huerto.establecido) return 'El huerto ya está establecido.'
      if (room.cargamento.semillas <= 0) return 'No trajeron kits de semillas.'
      if (room.enRefugio) return 'No se puede trabajar en el huerto desde el refugio.'
      if (room.recursos.agua < 10) return 'Se necesitan 10 L de agua para avanzar el huerto.'
      room.recursos.agua -= 10
      room.huerto.progreso = Math.min(100, room.huerto.progreso + 20 + room.cargamento.semillas * 5)
      j.ubicacion = 'invernadero'
      if (room.huerto.progreso >= 100) {
        room.huerto.establecido = true
        const inv = room.sistemas.find((s) => s.id === 'invernadero')!
        inv.online = true
        log(room, 'Huerto artificial establecido. El invernadero produce alimentos.', 'ok')
      } else {
        log(room, `${j.nombre} avanzó el huerto (${room.huerto.progreso}%).`, 'info')
      }
      return null
    }
    case 'experimento': {
      if (room.enRefugio) return 'No se pueden hacer experimentos desde el refugio.'
      if (room.recursos.energia < 6) return 'No hay energía suficiente (6).'
      room.recursos.energia -= 6
      room.mision.experimentos += 1
      j.ubicacion = 'taller'
      log(room, `Experimento ${room.mision.experimentos}/${room.mision.experimentosObjetivo} completado.`, 'ok')
      return null
    }
    case 'revision': {
      const obj = jugador(room, String(payload.jugadorId))
      if (!obj) return 'Tripulante inválido.'
      if (room.recursos.botiquines < 1) return 'No quedan botiquines.'
      room.recursos.botiquines -= 1
      obj.salud = Math.min(100, obj.salud + 15)
      obj.fueraDeServicio = 0
      j.ubicacion = obj.ubicacion
      log(room, `${j.nombre} atendió a ${obj.nombre} (salud ${Math.round(obj.salud)}).`, 'ok')
      return null
    }
  }
  return 'Acción no implementada.'
}

// ---------- Ayuda entre integrantes ----------

export function pedirAyuda(room: RoomState, playerId: string, paraRol: Role, motivo: string): string | null {
  const j = jugador(room, playerId)
  if (!j) return 'Jugador no encontrado.'
  j.ayuda = { paraRol, motivo: motivo.slice(0, 120), desde: Date.now() }
  log(room, `${j.nombre} necesita ayuda de ${ROLE_BY_ID[paraRol].nombre}: ${j.ayuda.motivo}`, 'alerta')
  return null
}

export function irAyudar(room: RoomState, playerId: string, objetivoId: string): string | null {
  const yo = jugador(room, playerId)
  const obj = jugador(room, objetivoId)
  if (!yo || !obj || !obj.ayuda) return 'Esa solicitud ya no existe.'
  if (yo.rol !== obj.ayuda.paraRol && yo.rol !== 'comandante') return 'Esa solicitud era para otro rol.'
  yo.ayudando = obj.id
  yo.ubicacion = obj.ubicacion
  obj.salud = Math.min(100, obj.salud + 8)
  obj.fueraDeServicio = Math.max(0, obj.fueraDeServicio - 6)
  obj.ayuda = null
  log(room, `${yo.nombre} fue a ayudar a ${obj.nombre}.`, 'ok')
  return null
}

// ---------- Emergencias ----------

export function elegirAlternativa(room: RoomState, playerId: string, emId: string, altId: string): string | null {
  const em = room.emergencias.find((e) => e.id === emId)
  if (!em || em.estado !== 'activa') return 'Emergencia no activa.'
  const j = jugador(room, playerId)
  if (!j || !j.rol) return 'Necesitas un rol.'
  const alt = em.alternativas.find((a) => a.id === altId)
  if (!alt) return 'Alternativa inválida.'
  const responsablesPresentes = em.rolesResponsables.filter((r) => rolPresente(room, r))
  const esResponsable = em.rolesResponsables.includes(j.rol) || (responsablesPresentes.length === 0 && j.rol === 'comandante')
  if (!esResponsable) return 'Tu rol no decide esta emergencia.'
  if (responsablesPresentes.length > 1) {
    if (room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === 'emergencia' && p.payload.emergenciaId === emId)) {
      return 'Ya hay una alternativa propuesta para esta emergencia.'
    }
    crearPropuesta(room, {
      tipo: 'emergencia',
      titulo: `${em.titulo}: ${alt.etiqueta}`,
      descripcion: alt.consecuencia,
      payload: { emergenciaId: emId, altId },
      proponente: playerId,
      rolesResponsables: em.rolesResponsables,
    })
    return null
  }
  resolverEmergencia(room, em, altId)
  return null
}

function resolverEmergencia(room: RoomState, em: Emergency, altId: string) {
  const alt = em.alternativas.find((a) => a.id === altId)
  if (!alt) return
  em.estado = 'resuelta'
  em.elegida = altId
  em.resultado = aplicarAlternativa(room, em, altId)
  log(room, `${em.titulo}: ${alt.etiqueta}. ${em.resultado}`, 'info')
}

function generarEmergencia(room: RoomState) {
  if (room.emergencias.some((e) => e.estado === 'activa')) return
  const candidatas = EMERGENCIAS.filter((e) => e.condicion(room))
  if (candidatas.length === 0) return
  const def = candidatas[Math.floor(Math.random() * candidatas.length)]
  const em: Emergency = {
    id: rid(),
    tipo: def.tipo,
    titulo: def.titulo,
    descripcion: def.descripcion(room),
    rolesResponsables: def.roles,
    alternativas: def.alternativas,
    creada: Date.now(),
    vence: Date.now() + 75_000,
    estado: 'activa',
    elegida: null,
    resultado: null,
  }
  room.emergencias.unshift(em)
  if (room.emergencias.length > 12) room.emergencias.length = 12
  def.alIniciar?.(room)
  log(room, `ALERTA: ${em.titulo}. Deciden: ${def.roles.map((r) => ROLE_BY_ID[r].corto).join(' + ')}.`, 'alerta')
}

// ---------- Tick de simulación ----------

const ultimaHora = new Map<string, number>()

export function tick(room: RoomState) {
  const ahora = Date.now()
  if (room.fase === 'lanzamiento') actualizarTransito(room)

  // expirar propuestas y emergencias
  for (const p of room.propuestas) {
    if (p.estado === 'pendiente' && ahora > p.vence) {
      p.estado = 'rechazada'
      log(room, `Propuesta "${p.titulo}" venció sin decisión.`, 'alerta')
    }
  }
  for (const e of room.emergencias) {
    if (e.estado === 'activa' && ahora > e.vence) {
      e.estado = 'vencida'
      const peor = e.alternativas[e.alternativas.length - 1]
      e.elegida = peor.id
      e.resultado = aplicarAlternativa(room, e, peor.id)
      log(room, `Nadie decidió a tiempo: ${e.titulo}. ${e.resultado}`, 'alerta')
    }
  }

  if (room.fase !== 'base' || room.resultado) return
  const last = ultimaHora.get(room.codigo)
  if (last === undefined) {
    ultimaHora.set(room.codigo, ahora)
    return
  }
  if (ahora - last < HORA_MS) return
  ultimaHora.set(room.codigo, ahora)
  horaDeMision(room)
}

export function horaDeMision(room: RoomState) {
  const m = room.mision
  m.hora += 1
  if (m.hora >= 24) {
    m.hora = 0
    m.sol += 1
    log(room, `Sol ${m.sol} en Marte.`, 'info')
  }
  const tripulacion = room.jugadores.filter((j) => j.rol)
  const n = Math.max(1, tripulacion.length)
  const sis = (id: ModuleId) => room.sistemas.find((s) => s.id === id)!
  const sitio = SITES.find((s) => s.id === room.ensamblaje.sitio) ?? SITES[1]
  const r = room.recursos

  // refugio
  const horaAbs = m.sol * 24 + m.hora
  if (room.enRefugio && horaAbs >= room.refugioHasta) {
    room.enRefugio = false
    for (const j of room.jugadores) j.ubicacion = 'habitat'
    log(room, 'La tripulación sale del refugio.', 'info')
  }
  if (room.tormenta && horaAbs >= room.tormentaHasta) {
    room.tormenta = false
    log(room, 'La tormenta solar terminó.', 'ok')
  }

  // energía
  const esDia = m.hora >= 6 && m.hora < 18
  const planta = sis('energia')
  const produccion = esDia && planta.online ? room.cargamento.paneles * 3.2 * sitio.solar * (planta.integridad / 100) : 0
  let consumoE = 1 + n * 0.2
  if (room.reciclajeActivo && sis('soporteVital').online) consumoE += 1.5
  if (room.huerto.establecido && sis('invernadero').online) consumoE += 1
  if (room.enRefugio) consumoE += 1
  r.energia = Math.max(0, Math.min(room.capacidad.energia, r.energia + produccion - consumoE))
  const sinEnergia = r.energia <= 0

  // consumo humano
  const factor = { normal: 1, ahorro: 0.8, estricto: 0.6 }[room.racion]
  const soporte = sis('soporteVital').online && !sinEnergia
  let consumoAgua = 0.4 * n * factor
  let consumoO2 = 0.5 * n * factor
  const consumoComida = 0.25 * n * factor
  if (room.reciclajeActivo && soporte) {
    consumoAgua *= 0.4
    consumoO2 *= 0.5
  }
  if (!soporte) consumoO2 *= 2
  r.agua = Math.max(0, r.agua - consumoAgua)
  r.oxigeno = Math.max(0, r.oxigeno - consumoO2)
  r.alimentos = Math.max(0, r.alimentos - consumoComida)

  // producción huerto
  if (room.huerto.establecido && sis('invernadero').online && !sinEnergia && !room.enRefugio && r.agua > 0.2) {
    r.alimentos = Math.min(room.capacidad.alimentos, r.alimentos + 0.25 * n)
    r.agua = Math.max(0, r.agua - 0.2)
  }

  // desgaste de equipos
  for (const s of room.sistemas) {
    if (!s.online) continue
    s.integridad = Math.max(0, s.integridad - (0.2 + Math.random() * 0.3))
    if (s.integridad < 25 && Math.random() < 0.08) {
      s.online = false
      log(room, `FALLO: ${MODULE_BY_ID[s.id].nombre} se apagó por falta de mantenimiento.`, 'alerta')
    }
  }
  if (sinEnergia) {
    for (const s of room.sistemas) if (s.id !== room.prioridadEnergia && s.id !== 'habitat' && s.id !== 'refugio') s.online = false
  }

  // radiación
  const base = room.tormenta ? 2.4 : 0.2
  const reduccion = Math.min(0.9, room.blindaje * 0.3) + (room.enRefugio ? 0.9 : 0)
  room.radiacion = Math.max(0.02, base * (1 - Math.min(0.95, reduccion)))

  // salud de la tripulación
  for (const j of tripulacion) {
    let delta = 0
    if (r.oxigeno <= 0) delta -= 6
    if (r.agua <= 0) delta -= 2
    if (r.alimentos <= 0) delta -= 1
    if (room.racion === 'ahorro') delta -= 0.1
    if (room.racion === 'estricto') delta -= 0.4
    if (room.radiacion > 0.5) delta -= (room.radiacion - 0.5) * 1.2
    if (delta === 0 && r.oxigeno > 0 && r.agua > 0 && r.alimentos > 0) delta += 0.3
    j.salud = Math.max(0, Math.min(100, j.salud + delta))
    j.oxigeno = Math.round(Math.max(0, Math.min(100, (r.oxigeno / Math.max(1, room.capacidad.oxigeno * 0.3)) * 100)))
    j.pulso = Math.round(64 + (100 - j.salud) * 0.5 + (room.tormenta ? 12 : 0) + (r.oxigeno <= 0 ? 25 : 0))
    if (j.fueraDeServicio > 0) j.fueraDeServicio -= 1
    if (j.salud < 35 && !j.ayuda && Math.random() < 0.15) {
      j.ayuda = { paraRol: 'medico', motivo: 'Salud crítica, necesito revisión médica.', desde: Date.now() }
      log(room, `${j.nombre} pide ayuda al médico: salud crítica.`, 'alerta')
    }
    if (j.ayudando && !jugador(room, j.ayudando)?.ayuda) j.ayudando = null
  }

  // emergencias aleatorias
  if (m.hora % 6 === 3 && Math.random() < 0.4) generarEmergencia(room)

  // puntos críticos
  const pc: string[] = []
  if (r.oxigeno < 60) pc.push(`Oxígeno bajo (${Math.round(r.oxigeno)})`)
  if (r.agua < 60) pc.push(`Agua baja (${Math.round(r.agua)} L)`)
  if (r.alimentos < 40) pc.push(`Alimentos bajos (${Math.round(r.alimentos)})`)
  if (r.energia < 15) pc.push(`Energía crítica (${Math.round(r.energia)})`)
  for (const s of room.sistemas) {
    if (!s.online && ['soporteVital', 'energia'].includes(s.id)) pc.push(`${MODULE_BY_ID[s.id].nombre} apagado`)
    else if (s.integridad < 30) pc.push(`${MODULE_BY_ID[s.id].nombre} al ${Math.round(s.integridad)}%`)
  }
  if (room.tormenta) pc.push('Tormenta solar en curso')
  if (room.radiacion > 0.8) pc.push(`Radiación alta (${room.radiacion.toFixed(1)})`)
  for (const j of tripulacion) if (j.salud < 40) pc.push(`${j.nombre}: salud ${Math.round(j.salud)}`)
  room.puntosCriticos = pc

  // fin de misión
  const muerto = tripulacion.find((j) => j.salud <= 0)
  if (muerto) {
    room.resultado = { victoria: false, motivo: `${muerto.nombre} no sobrevivió. La misión se cancela.` }
    room.fase = 'fin'
    log(room, room.resultado.motivo, 'alerta')
    return
  }
  if (m.sol > m.solesObjetivo) {
    const ok = m.experimentos >= m.experimentosObjetivo
    room.resultado = ok
      ? { victoria: true, motivo: `Sobrevivieron ${m.solesObjetivo} soles y completaron ${m.experimentos} experimentos. Misión cumplida.` }
      : { victoria: false, motivo: `Sobrevivieron, pero solo completaron ${m.experimentos} de ${m.experimentosObjetivo} experimentos. Objetivo científico incompleto.` }
    room.fase = 'fin'
    log(room, room.resultado.motivo, ok ? 'ok' : 'alerta')
  }
}
