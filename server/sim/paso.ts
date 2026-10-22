// Un paso de simulación: avanza el tiempo de misión y recalcula energía, aire, agua, comida,
// el cuerpo de cada tripulante, el desgaste de los equipos y los sucesos.
import { C } from '../../shared/ciencia.js'
import { CIUDAD_BY_ID, escenarioDe } from '../../shared/escenarios.js'
import {
  DESCENSO_S,
  ESCALA_ALERTA,
  ESCALA_MAXIMA,
  SISTEMA_BY_ID,
  SITE_BY_ID,
  TRANSITO_INICIO_S,
  nombreSistema,
  type Actividad,
  type Player,
  type RoomState,
  type SistemaId,
} from '../../shared/types.js'
import { procPorId } from '../../shared/procedimientos.js'
import { hacia, hayEmergencia, limitar, log, rendimiento, sis, tripulacion } from '../base.js'
import { DOLENCIAS, UMBRAL_AVERIA, despacharCola, lanzarEmergencia } from '../emergencies.js'
import { desgasteDeber, dosisDeber, pasoDeberes, riesgoMedicoDeber } from '../deberes.js'
import { ahora, azar, movidos } from '../reloj.js'
import { actualizarAmbiente, enSuperficie, eventosSolaresPendientes, fraccionSolar, registroDelSol, sorteoTormentaPolvo, tasaDeDosis } from './ambiente.js'
import { pasoTripulante } from './fisiologia.js'
import { pasoHuerto } from './huerto.js'
import { gActual, telemetriaAscenso, telemetriaCrucero, telemetriaDescenso } from './vuelo.js'

const FACTOR_RACION = { normal: 1, ahorro: 0.8, estricto: 0.6 } as const
/** Desgaste por día de uso, en puntos de integridad. */
const DESGASTE: Record<SistemaId, number> = { oga: 0.25, cdra: 0.3, wrs: 0.35, termico: 0.15, energia: 0.12, esclusa: 0.05, huerto: 0.1, isru: 0.5 }
/** Qué se apaga primero cuando falta energía, según la prioridad elegida. */
const ORDEN_CORTE: Record<RoomState['ajustes']['prioridad'], SistemaId[]> = {
  vida: ['huerto', 'isru', 'esclusa', 'wrs', 'termico', 'oga', 'cdra'],
  calor: ['huerto', 'isru', 'esclusa', 'wrs', 'oga', 'termico', 'cdra'],
  ciencia: ['isru', 'esclusa', 'wrs', 'termico', 'huerto', 'oga', 'cdra'],
}
const CARGA_BASE_KW = 1.2
/** kg de O2 al día a los que se ajustó el generador (al montar la base), sin pasar de su máximo. */
const ogaMaximo = (room: RoomState) => Math.min(C.OGA_KG_DIA, room.efectos?.ogaKgDia ?? C.OGA_KG_DIA)
const KG_AIRE_CABINA = 180

/** Hasta este segundo tras el despegue, el lanzamiento va en tiempo real: se ve dejar la torre. */
const DESPEGUE_TIEMPO_REAL_S = 15

const enMicrogravedad = (room: RoomState) => room.fase === 'transito' || (room.fase === 'llegada' && room.subfase !== 'descenso')

/** Escala máxima mientras alguien está en mitad de un trabajo por pasos. */
export const ESCALA_TRABAJO = 600
/** Cuánto se sigue contando como «trabajando» desde el último paso, ms reales. */
const TRABAJO_MS = 60_000

function trabajando(room: RoomState): boolean {
  for (const [id, e] of Object.entries(room.procedimientos ?? {})) {
    if (e.terminado || e.paso <= 0 || ahora() - (e.datos?.ultimo ?? -Infinity) > TRABAJO_MS) continue
    // Los deberes de rutina no frenan el reloj: son cortos y vuelven cada pocos minutos.
    if (procPorId(id)?.aDemanda && !id.startsWith('deber:')) return true
  }
  return false
}

/** Escala real a la que corre la misión ahora (la del comandante, limitada por la situación). */
export function escalaEfectiva(room: RoomState): number {
  if (room.fase === 'lobby' || room.fase === 'contexto' || room.fase === 'fin') return 0
  // La cuenta regresiva y los primeros segundos del despegue van en tiempo real, como se viven;
  // el resto del ascenso, a ×10.
  if (room.fase === 'lanzamiento') return room.t < DESPEGUE_TIEMPO_REAL_S ? 1 : 10
  if (room.fase === 'llegada' && room.subfase === 'descenso') return 10
  let e = Math.min(room.escalaDeseada, ESCALA_MAXIMA[room.fase])
  if (hayEmergencia(room)) e = Math.min(e, ESCALA_ALERTA)
  // Con alguien fuera, el tiempo no puede correr tan rápido que el traje se agote en segundos.
  if (room.jugadores.some((j) => j.rol && j.zona === 'exterior')) e = Math.min(e, 60)
  // Mientras alguien hace un trabajo paso a paso (reparar, curar, ponerse el traje), el tiempo va
  // como mucho a ×600: si no, un viaje entero pasaría mientras se cambia una pieza.
  if (trabajando(room)) e = Math.min(e, ESCALA_TRABAJO)
  return Math.max(1, e)
}

export function terminar(room: RoomState, victoria: boolean, titulo: string, motivo: string) {
  if (room.resultado) return
  room.resultado = { victoria, titulo, motivo }
  room.fase = 'fin'
  room.registro.push({ t: Math.round(room.t), fase: 'fin', texto: motivo, tipo: victoria ? 'ok' : 'alerta' })
}

// ---------- Cambios de fase ----------

function entrarTransito(room: RoomState) {
  room.fase = 'transito'
  room.subfase = ''
  room.tFase = room.t
  room.escalaDeseada = 3600
  room.rec.propelente = 100
  log(room, `Orbit reached: the core stage engines cut off 8 min 20 s after liftoff, as on Artemis I, using ${(room.energia.usada ?? 0).toFixed(1)} kWh of power. Engine burn toward Mars: ${room.mision.diasTransito} days of travel ahead.`, 'ok')
}

function entrarOrbita(room: RoomState) {
  room.fase = 'llegada'
  room.subfase = 'orbita'
  room.tFase = room.t
  room.escalaDeseada = 60
  log(room, `Mars orbit after ${room.mision.diasTransito} days in space. ${Math.round(room.rec.propelente)}% of the fuel is left and ${Math.round(room.energia.usada ?? 0)} kWh of power were used. Time to choose where to land.`, 'ok')
}

/** Empieza la entrada en la atmósfera hacia el sitio ya elegido. */
export function iniciarDescenso(room: RoomState) {
  room.subfase = 'descenso'
  room.tFase = room.t
  for (const j of tripulacion(room)) {
    j.zona = 'nave'
    j.enRefugio = false
    j.manual = null
  }
  log(room, `Atmospheric entry toward ${SITE_BY_ID[room.sitio ?? 'gale'].nombre}. Seven minutes with no contact with Earth.`, 'alerta')
}

function aterrizar(room: RoomState) {
  const sitio = SITE_BY_ID[room.sitio ?? 'gale']
  room.fase = 'ensamblaje'
  room.subfase = ''
  room.tAterrizaje = room.t
  room.tFase = room.t
  room.escalaDeseada = 60
  room.ensamblaje.paso = 1
  room.rec.propelente = Math.max(0, room.rec.propelente - 30)
  room.energia.polvo = 0
  room.ambiente.tau = 0
  const duro = (room.avisos.desvio ?? 0) > 0 || room.rec.propelente <= 0
  if (duro) {
    for (const id of ['energia', 'esclusa', 'termico'] as SistemaId[]) sis(room, id).integridad = Math.max(20, sis(room, id).integridad - 25)
    log(room, 'Hard landing because the trajectory was off course. Several pieces of equipment were damaged.', 'alerta')
  }
  log(room, `Touchdown at ${sitio.nombre}. The base runs on batteries until surface power is deployed and connected.`, 'ok')
}

function alNuevoSol(room: RoomState) {
  const a = room.ambiente
  const e = room.energia
  e.polvo = limitar(e.polvo + C.POLVO_POR_SOL * (a.tormentaPolvo ? 8 : 1), 0, 0.85)
  const [tmin, tmax, presion] = registroDelSol(room, a.sol)
  const ajuste = SITE_BY_ID[room.sitio ?? 'gale'].ajusteTemp
  log(room, `Sol ${a.sol}: from ${tmin + ajuste} to ${tmax + ajuste} °C and ${presion} Pa (data from Curiosity's sol ${a.solCuriosity}).`)
  if (room.avisos.polvo && !a.tormentaPolvo) {
    delete room.avisos.polvo
    log(room, 'The dust storm is over. The sky will take a few sols to clear.', 'ok')
  }
  const tormenta = sorteoTormentaPolvo(room)
  if (tormenta) {
    room.avisos.polvo = room.t
    lanzarEmergencia(room, 'polvo', tormenta)
  }
}

// ---------- Tripulación ----------

function actividadDe(room: RoomState, j: Player, alerta: boolean): Actividad {
  if (j.zona === 'exterior') return 'eva'
  if (j.incapacitado > 0) return 'sueno'
  if (j.enRefugio) return 'reposo'
  if (room.fase === 'lanzamiento' || (room.fase === 'llegada' && room.subfase === 'descenso')) return 'trabajo'
  if (j.manual) return j.manual
  const h = room.ambiente.hora
  const activo = room.escala <= 60 && movidos().has(j.id)
  if ((h >= 22 || h < 6) && !alerta && !activo) return 'sueno'
  if (h >= 8 && h < 18) return 'trabajo'
  return activo ? 'trabajo' : 'reposo'
}

function rescatar(room: RoomState, j: Player, motivo: string) {
  j.zona = 'nave'
  j.manual = null
  // La tripulación lo mete por la esclusa: el procedimiento de entrada que tuviera a medias ya no sigue.
  delete j.trajeFuga
  if (room.procedimientos) delete room.procedimientos[`entrada:${j.id}`]
  j.vit.salud = limitar(j.vit.salud - 20, 0, 100)
  j.vit.spo2 = Math.min(j.vit.spo2, 84)
  j.incapacitado = Math.max(j.incapacitado, 2 * 3600)
  log(room, `Rescue through the Airlock: ${j.nombre} ${motivo}.`, 'alerta')
}

// ---------- Energía y temperatura ----------

function energiaYCalor(room: RoomState, dt: number, crew: Player[], superficie: boolean) {
  const e = room.energia
  const a = room.ambiente
  const hechas = room.ensamblaje.hechas
  const planta = sis(room, 'energia')
  const salida = planta.integridad > UMBRAL_AVERIA ? rendimiento(planta.integridad) : 0.08
  const dentro = crew.filter((j) => j.zona === 'nave').length

  let generacion: number
  if (!superficie) {
    // Paneles de crucero: más luz cerca de la Tierra, menos al acercarse a Marte.
    generacion = (9 + 5 / (room.vuelo.distSol * room.vuelo.distSol)) * salida
  } else {
    const conectada = Boolean(hechas.energia)
    // La orientación y la inclinación con que se montaron los paneles cuentan toda la misión.
    const solar = hechas.paneles && conectada ? room.cargamento.paneles * C.PANEL_KW * fraccionSolar(room) * (1 - e.polvo) * (room.efectos?.solar ?? 1) : 0
    const reactor = hechas.carga && conectada ? room.cargamento.reactor * C.REACTOR_KW : 0
    generacion = (solar + reactor) * salida
  }

  const funcional = (id: SistemaId) => {
    const s = sis(room, id)
    return s.instalado && s.activo && s.integridad > UMBRAL_AVERIA
  }
  const kw: Partial<Record<SistemaId, number>> = {}
  if (funcional('oga') && room.rec.agua > 1) kw.oga = Math.min(ogaMaximo(room), dentro * 0.9) * C.OGA_KW_POR_KG_DIA
  if (funcional('cdra')) kw.cdra = C.CDRA_KW * C.CDRA_UNIDADES * 0.6
  if (funcional('wrs')) kw.wrs = room.rec.aguaResidual > 0.5 ? C.WRS_KW : 0.1
  if (funcional('esclusa')) {
    const cargando = crew.filter((j) => j.zona === 'nave' && (j.trajeO2 < C.TRAJE_O2_KG - 0.01 || j.trajeBateria < 0.99)).length
    kw.esclusa = 0.1 + 0.3 * cargando
  }
  if (funcional('huerto') && room.huerto.progreso > 0) kw.huerto = a.hora >= 6 && a.hora < 20 ? 2 : 0.3
  if (superficie && funcional('isru')) kw.isru = 3
  const sinCalor = CARGA_BASE_KW + Object.values(kw).reduce((x, y) => x + (y ?? 0), 0)
  if (funcional('termico')) {
    // El calor que desprenden los equipos y las personas ya calienta la cabina.
    const pasivo = 0.6 * sinCalor + 0.1 * dentro
    kw.termico = superficie ? Math.max(0, (C.PERDIDA_TERMICA_W_K * (C.TEMP_CABINA_C - a.tempExt)) / 1000 - pasivo) : 0.4
  }

  // Con la tensión del bus por debajo de lo debido, los equipos piden más corriente y se pierde más en calor.
  let consumo = (CARGA_BASE_KW + Object.values(kw).reduce((x, y) => x + (y ?? 0), 0)) * (superficie ? (room.efectos?.perdidaBus ?? 1) : 1)
  const cortes: SistemaId[] = []
  if (e.bateria <= 0.001 && generacion < consumo) {
    for (const id of ORDEN_CORTE[room.ajustes.prioridad]) {
      if (consumo <= generacion) break
      const carga = kw[id]
      if (carga === undefined) continue
      consumo -= carga
      delete kw[id]
      cortes.push(id)
    }
  }
  for (const s of room.sistemas) {
    s.operativo = s.id === 'energia' ? s.integridad > UMBRAL_AVERIA : funcional(s.id) && !cortes.includes(s.id)
  }
  e.bateria = limitar(e.bateria + ((generacion - consumo) * dt) / 3600, 0, e.capacidad)
  e.generacion = generacion
  e.consumo = consumo
  e.usada = (e.usada ?? 0) + (consumo * dt) / 3600
  e.cortes = cortes

  const termico = sis(room, 'termico').operativo
  if (!superficie) {
    // En el espacio el problema es deshacerse del calor: sin control térmico la cabina se calienta.
    room.cabina.temp = hacia(room.cabina.temp, termico ? C.TEMP_CABINA_C : 36, dt, 12 * 3600)
  } else {
    const calefaccion = termico ? (kw.termico ?? 0) : 0
    const pasivo = 0.6 * (consumo - calefaccion) + 0.1 * dentro
    const equilibrio = a.tempExt + ((pasivo + calefaccion) * 1000) / C.PERDIDA_TERMICA_W_K
    // Un hábitat grande tarda muchas horas en enfriarse.
    room.cabina.temp = hacia(room.cabina.temp, Math.min(C.TEMP_CABINA_C, equilibrio), dt, 40 * 3600)
  }
}

// ---------- Cuerpos, aire, agua y comida ----------

function soporteVital(room: RoomState, dt: number, crew: Player[], superficie: boolean, alerta: boolean) {
  const c = room.cabina
  const r = room.rec
  const g = gActual(room)
  const micro = enMicrogravedad(room)
  const racion = FACTOR_RACION[room.ajustes.racionComida]
  const esclusa = sis(room, 'esclusa').operativo
  let o2 = 0
  let co2 = 0
  let bebida = 0

  crew.forEach((j, i) => {
    const quedan = crew.length - i
    // Un traje que salió con una fuga sin arreglar pierde oxígeno de más.
    if (j.zona === 'exterior' && j.trajeFuga) j.trajeO2 = Math.max(0, j.trajeO2 - (j.trajeFuga * dt) / 3600)
    const cons = pasoTripulante(j, {
      dt,
      g,
      superficie,
      microgravedad: micro,
      ppO2: c.ppO2,
      ppCO2: c.ppCO2,
      presion: C.PRESION_KPA,
      temp: c.temp,
      aguaDisponible: r.agua / quedan,
      comidaDisponible: r.comida / quedan,
      racionComida: racion,
      ejercicio: room.ajustes.ejercicio,
      // El reactor, si quedó cerca del hábitat, suma su radiación a la del ambiente.
      dosisTasa: tasaDeDosis(room, j.zona, j.enRefugio) * dosisDeber(room) + (superficie ? (room.efectos?.reactorDosis ?? 0) : 0),
      alerta,
    })
    o2 += cons.o2
    co2 += cons.co2
    bebida += cons.agua
    r.agua = Math.max(0, r.agua - cons.agua)
    r.comida = Math.max(0, r.comida - cons.comida)
    if (cons.trajeAgotado) rescatar(room, j, 'ran out of life support in the suit')

    // Dentro, la esclusa recarga el traje.
    if (j.zona === 'nave' && esclusa) {
      if (j.trajeO2 < C.TRAJE_O2_KG) {
        const carga = Math.min(C.TRAJE_O2_KG - j.trajeO2, (1.2 * dt) / 3600)
        if (r.o2 >= carga) r.o2 -= carga
        else c.ppO2 -= carga / C.KG_O2_POR_KPA
        j.trajeO2 += carga
      }
      j.trajeBateria = Math.min(1, j.trajeBateria + dt / (2 * 3600))
    }

    if (j.incapacitado <= 0 && j.vit.salud > 0) {
      const motivo = j.vit.spo2 < 78 ? 'passed out from lack of oxygen' : j.vit.salud < 12 ? 'collapsed' : j.vit.fatiga >= 99 ? 'ran out of strength from exhaustion' : null
      if (motivo) {
        if (j.zona === 'exterior') rescatar(room, j, motivo)
        else {
          j.incapacitado = 4 * 3600
          j.manual = null
          log(room, `${j.nombre} ${motivo}.`, 'alerta')
        }
      }
    }
  })

  // Aire de la cabina
  c.ppO2 -= o2 / C.KG_O2_POR_KPA
  c.ppCO2 += co2 / C.KG_CO2_POR_KPA
  if (c.fuga > 0) {
    const perdida = Math.min(0.5, (c.fuga * dt) / 3600 / KG_AIRE_CABINA)
    c.ppO2 *= 1 - perdida
    c.ppCO2 *= 1 - perdida
  }

  // Huerto: cada almohadilla se seca, crece o enferma según cómo se cuide (server/sim/huerto.ts).
  pasoHuerto(room, dt)

  // Reponer oxígeno: primero el generador, luego los tanques
  let falta = (C.PPO2_NOMINAL_KPA - c.ppO2) * C.KG_O2_POR_KPA
  const oga = sis(room, 'oga')
  if (falta > 0 && oga.operativo && r.agua > 1) {
    const prod = Math.min(falta, (ogaMaximo(room) * rendimiento(oga.integridad) * dt) / 86400, (r.agua - 1) / C.OGA_AGUA_POR_O2)
    c.ppO2 += prod / C.KG_O2_POR_KPA
    r.agua -= prod * C.OGA_AGUA_POR_O2
    falta -= prod
  }
  if (falta > 0 && r.o2 > 0) {
    const usa = Math.min(falta, r.o2, (60 * dt) / 86400)
    r.o2 -= usa
    c.ppO2 += usa / C.KG_O2_POR_KPA
  }
  c.ppO2 = Math.max(0.5, c.ppO2)

  // Retirar CO2: depurador y cartuchos de LiOH
  const cdra = sis(room, 'cdra')
  if (cdra.operativo) {
    // Cuanto más CO2 hay en el aire, más retira cada depurador (ley medida en la ISS).
    const porUnidad = Math.max(0, C.CDRA_PENDIENTE * c.ppCO2 * 7.50062 - C.CDRA_ORIGEN)
    const q = (C.CDRA_UNIDADES * porUnidad * rendimiento(cdra.integridad) * dt) / 86400
    c.ppCO2 = Math.max(0.02, c.ppCO2 - q / C.KG_CO2_POR_KPA)
  }
  if (r.liohActivo > 0) {
    const q = Math.min(r.liohActivo, (9 * limitar(c.ppCO2 / 0.4, 0, 2) * dt) / 86400)
    r.liohActivo -= q
    c.ppCO2 = Math.max(0.02, c.ppCO2 - q / C.KG_CO2_POR_KPA)
  }

  // Agua: higiene, reciclaje y extracción de hielo
  const higiene = Math.min(r.agua, (C.AGUA_HIGIENE_KG_DIA * (room.ajustes.racionAgua === 'ahorro' ? 0.4 : 1) * crew.length * dt) / 86400)
  r.agua -= higiene
  r.aguaResidual = Math.min(400, r.aguaResidual + (bebida + higiene) * 0.95)
  const wrs = sis(room, 'wrs')
  if (wrs.operativo && r.aguaResidual > 0) {
    const proc = Math.min(r.aguaResidual, (C.WRS_KG_DIA * dt) / 86400)
    const eficiencia = 0.9 + (C.WRS_EFICIENCIA - 0.9) * rendimiento(wrs.integridad)
    r.agua += proc * eficiencia
    r.aguaResidual -= proc
  }
  const isru = sis(room, 'isru')
  if (superficie && isru.operativo) {
    const agua = (45 * rendimiento(isru.integridad) * dt) / 86400
    r.agua += agua
    room.mision.aguaExtraida = (room.mision.aguaExtraida ?? 0) + agua
  }
}

// ---------- Desgaste, averías y sucesos ----------

function desgaste(room: RoomState, dt: number, superficie: boolean) {
  const dias = dt / 86400
  for (const s of room.sistemas) {
    if (!s.instalado || !s.operativo) continue
    let tasa = DESGASTE[s.id] * escenarioDe(room.escenario).mod.desgaste * desgasteDeber(room, s.id)
    if (superficie && room.ambiente.tormentaPolvo && (s.id === 'energia' || s.id === 'isru')) tasa *= 3
    s.integridad = Math.max(0, s.integridad - tasa * dias)
    // Además del desgaste, una avería al azar cada unos 670 días por equipo (valor del juego).
    const riesgo = (0.0015 + (s.integridad < 50 ? (50 - s.integridad) * 0.002 : 0)) * dias
    if (s.integridad <= UMBRAL_AVERIA || azar(room) < riesgo) lanzarEmergencia(room, 'fallo', { sistema: s.id })
  }
}

function sucesos(room: RoomState, dt: number, crew: Player[], superficie: boolean) {
  const dias = dt / 86400
  const micro = enMicrogravedad(room)

  // Clima espacial: eventos reales de 2024, más o menos frecuentes según la situación.
  const actividad = escenarioDe(room.escenario).mod.particulas
  for (const ev of eventosSolaresPendientes(room)) {
    if (actividad < 1 && azar(room) > actividad) continue
    if (actividad > 1 && ev.tasa) ev.tasa *= actividad
    if (ev.tipo === 'fulguracion') {
      log(room, `Class ${ev.clase} solar flare${ev.region ? ` in active region ${ev.region}` : ''}, like the one on ${ev.fecha}. Possible radio blackout.`, 'alerta')
    } else if (ev.fuerte) {
      lanzarEmergencia(room, 'particulas', { id: ev.id, fecha: ev.fecha, tasa: ev.tasa, horas: ev.horas })
    } else {
      room.ambiente.tormentaSolar = { id: ev.id, fecha: ev.fecha, tasa: ev.tasa ?? 10, hasta: room.t + (ev.horas ?? 20) * 3600 }
      log(room, `Minor solar particle storm, like the one on ${ev.fecha}. The dose rises a little for ${ev.horas} hours.`, 'alerta')
    }
  }
  const ts = room.ambiente.tormentaSolar
  if (ts && room.t >= ts.hasta) {
    room.ambiente.tormentaSolar = null
    log(room, 'The solar radiation storm is over.', 'ok')
  }
  if (room.refugioHasta > 0 && room.t >= room.refugioHasta) {
    room.refugioHasta = 0
    for (const j of crew) j.enRefugio = false
    log(room, 'The crew leaves the Storm Shelter.')
  }

  if (crew.length === 0) return
  sucesosDelGuion(room, crew, superficie)
  transmisiones(room, crew)

  // Mareo espacial en los primeros días sin gravedad
  if (micro && !room.avisos.mareo && room.t > 1.2 * 86400) {
    room.avisos.mareo = room.t
    const j = crew[Math.floor(azar(room) * crew.length)]
    lanzarEmergencia(room, 'mareo', { jugadorId: j.id, nombre: j.nombre })
  }
  // Correcciones de trayectoria
  if (room.fase === 'transito') {
    if (room.vuelo.progreso > 0.1 && !room.avisos.tcm1) {
      room.avisos.tcm1 = room.t
      lanzarEmergencia(room, 'correccion')
    }
    if (room.vuelo.progreso > 0.7 && !room.avisos.tcm2) {
      room.avisos.tcm2 = room.t
      lanzarEmergencia(room, 'correccion')
    }
    // Impacto de micrometeoroide
    if (room.cabina.fuga === 0 && azar(room) < 0.0012 * dias) lanzarEmergencia(room, 'fuga')
  }
  // Problemas médicos
  for (const j of crew) {
    if (j.dolencia && room.t >= j.dolenciaHasta) {
      log(room, `${j.nombre} recovered from ${j.dolencia}.`, 'ok')
      j.dolencia = null
    }
    const riesgo = 0.0016 * (j.vit.fatiga > 70 ? 2 : 1) * riesgoMedicoDeber(room) * dias
    if (!j.dolencia && j.incapacitado <= 0 && azar(room) < riesgo) {
      const dolencia = DOLENCIAS[Math.floor(azar(room) * DOLENCIAS.length)]
      // Sin controles médicos, el problema pasa días sin notarse y empieza peor.
      if (riesgoMedicoDeber(room) > 1) j.vit.salud = limitar(j.vit.salud - 5, 0, 100)
      lanzarEmergencia(room, 'medico', { jugadorId: j.id, nombre: j.nombre, dolencia })
    }
  }
  // Escasez: avisa cuando las reservas no alcanzan para lo que queda de misión
  const necesarios = diasRestantes(room)
  for (const recurso of ['agua', 'aire', 'comida'] as const) {
    const alcanza = room.autonomia[recurso]
    const clave = `escasez_${recurso}`
    if (alcanza < necesarios * 0.9 && room.t - (room.avisos[clave] ?? -1e9) > 20 * 86400 && room.t > 3600) {
      room.avisos[clave] = room.t
      lanzarEmergencia(room, 'escasez', { recurso, dias: Math.round(alcanza), necesarios: Math.round(necesarios) })
    }
  }
  void superficie
}

/** Días de misión que faltan, contando el viaje y la estancia. */
export function diasRestantes(room: RoomState): number {
  const estancia = (room.mision.solesObjetivo * C.SOL_S) / 86400
  if (enSuperficie(room)) return Math.max(0, estancia - (room.t - room.tAterrizaje) / 86400)
  const viaje = Math.max(0, room.mision.diasTransito - Math.max(0, room.t - TRANSITO_INICIO_S) / 86400)
  return viaje + estancia
}

/** Sucesos preparados de la situación (y los que se sortearon al despegar). */
function sucesosDelGuion(room: RoomState, crew: Player[], superficie: boolean) {
  for (const g of room.guion ?? []) {
    if (g.hecho) continue
    const toca =
      (g.viaje !== undefined && room.fase === 'transito' && room.vuelo.progreso >= g.viaje) ||
      (g.sol !== undefined && superficie && room.fase === 'base' && room.ambiente.sol >= g.sol)
    if (!toca) continue
    g.hecho = true
    if (g.tipo === 'fuga' && room.cabina.fuga === 0) lanzarEmergencia(room, 'fuga')
    else if (g.tipo === 'fallo') {
      const id = String(g.datos?.sistema ?? 'oga') as SistemaId
      const s = sis(room, id)
      if (s.instalado && s.integridad > UMBRAL_AVERIA) lanzarEmergencia(room, 'fallo', { sistema: id })
    } else if (g.tipo === 'medico') {
      const j = crew[Math.floor(azar(room) * crew.length)]
      if (j && !j.dolencia) lanzarEmergencia(room, 'medico', { jugadorId: j.id, nombre: j.nombre, dolencia: DOLENCIAS[Math.floor(azar(room) * DOLENCIAS.length)] })
    } else if (g.tipo === 'polvo' && !room.ambiente.tormentaPolvo) {
      const soles = Number(g.datos?.soles ?? 6)
      const tau = Number(g.datos?.tau ?? 4)
      room.ambiente.tormentaPolvo = true
      room.ambiente.polvoSoles = soles
      room.ambiente.tau = tau
      room.avisos.polvo = room.t
      lanzarEmergencia(room, 'polvo', { soles, tau })
    }
  }
}

const minutosSenal = (room: RoomState) => {
  const s = Math.round(room.vuelo.retardo)
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`
}

/** Mensajes del centro de control y de casa en momentos del viaje. Llegan con el retraso real de la señal. */
function transmisiones(room: RoomState, crew: Player[]) {
  const una = (clave: string, texto: string) => {
    if (room.avisos[clave]) return
    room.avisos[clave] = room.t
    log(room, texto, 'radio')
  }
  const mision = room.nombreMision || 'the crew'
  const v = room.vuelo
  if (room.fase === 'transito') {
    if (v.distTierra >= 0.3844) una('msgLuna', `Mission Control to ${mision}: you just passed the distance of the Moon, 384,400 km. From here on, everything is farther than anyone has ever gone in this ship.`)
    if (v.progreso >= 0.25) {
      // Un mensaje de casa para alguien de la tripulación, si eligió su ciudad.
      const j = crew.find((x) => x.hogar) ?? crew[0]
      const ciudad = j?.hogar ? CIUDAD_BY_ID[j.hogar as keyof typeof CIUDAD_BY_ID] : null
      if (j) una('msgCasa1', `Message from home for ${j.nombre}${ciudad ? `, from ${ciudad.nombre}` : ''}: "We watch you every night on the trip map. Take care of yourself and your crew." It took ${minutosSenal(room)} to arrive.`)
    }
    if (v.progreso >= 0.5) una('msgMitad', `Mission Control: you are halfway there. Each message now takes ${minutosSenal(room)} to arrive, so urgent decisions are yours. We trust you.`)
    if (v.progreso >= 0.75) {
      const j = crew.filter((x) => x.hogar)[1] ?? crew[1]
      const ciudad = j?.hogar ? CIUDAD_BY_ID[j.hogar as keyof typeof CIUDAD_BY_ID] : null
      if (j) una('msgCasa2', `Message from home for ${j.nombre}${ciudad ? `, from ${ciudad.nombre}` : ''}: "Today we went outside to look at the sky. They told us Mars is that red dot. That is where you are." It took ${minutosSenal(room)} to arrive.`)
    }
  }
  if (room.fase === 'llegada' && room.subfase === 'orbita') una('msgOrbita', `Mission Control: we confirm you are in Mars orbit. Choose your landing site well. We will see the result ${minutosSenal(room)} after you do.`)
  if (room.tAterrizaje > 0 && room.t > room.tAterrizaje + 3600) una('msgAterrizaje', `Mission Control: we received the landing signal from ${mision}. By the time we heard it, you had already been on the ground of Mars for ${minutosSenal(room)}.`)
}

function evaluar(room: RoomState, crew: Player[]) {
  const muerto = crew.find((j) => j.vit.salud <= 0)
  if (muerto) {
    const causa =
      muerto.vit.spo2 < 85 ? 'from lack of oxygen'
      : room.cabina.ppCO2 > C.PPCO2_PELIGRO_KPA ? 'from CO2 buildup in the cabin'
      : muerto.deficitAgua > 4 ? 'from dehydration'
      : room.cabina.temp < 5 ? 'from the cold in the cabin'
      : muerto.vit.dosis > 1000 ? 'from accumulated radiation'
      : 'after their condition got worse'
    terminar(room, false, 'Mission Lost', `${muerto.nombre} did not survive. They died ${causa}. The mission is canceled.`)
    return
  }
  if (room.fase === 'base' && room.ambiente.sol > room.mision.solesObjetivo) {
    const m = room.mision
    const sobre = crew.filter((j) => j.vit.dosis > C.LIMITE_CARRERA_MSV)
    const dosis = sobre.length
      ? ` ${sobre.length === crew.length ? 'The whole crew' : sobre.map((j) => j.nombre).join(', ')} went over the radiation limit of ${C.LIMITE_CARRERA_MSV} mSv. They will not be able to fly again.`
      : ` Nobody went over the radiation limit of ${C.LIMITE_CARRERA_MSV} mSv.`
    const aguaOk = !m.aguaObjetivo || (m.aguaExtraida ?? 0) >= m.aguaObjetivo
    const agua = m.aguaObjetivo ? ` and extracted ${Math.round(m.aguaExtraida ?? 0)} kg of water from the ice` : ''
    if (m.muestrasAnalizadas >= m.muestrasObjetivo && aguaOk) {
      terminar(room, true, 'Mission Accomplished', `The crew completed ${m.solesObjetivo} sols on Mars, analyzed ${m.muestrasAnalizadas} samples${agua}.${dosis}`)
    } else if (!aguaOk) {
      terminar(room, false, 'Objective Incomplete', `Everyone survived the ${m.solesObjetivo} sols, but only ${Math.round(m.aguaExtraida ?? 0)} of ${m.aguaObjetivo} kg of water was extracted from the ice.${dosis}`)
    } else {
      terminar(room, false, 'Objective Incomplete', `Everyone survived the ${m.solesObjetivo} sols, but only ${m.muestrasAnalizadas} of ${m.muestrasObjetivo} samples were analyzed.${dosis}`)
    }
  }
}

// ---------- Resumen para la interfaz ----------

function calcularAutonomia(room: RoomState, crew: Player[]) {
  const n = Math.max(1, crew.length)
  const r = room.rec
  const oga = sis(room, 'oga').operativo
  const wrs = sis(room, 'wrs')
  const isru = sis(room, 'isru')
  // Gasto medio de un día normal (8 h de sueño, 8 de trabajo, 8 de descanso) más el ejercicio.
  const m = C.METABOLISMO_W
  const gastoMedio = (m.sueno + m.trabajo + m.reposo) / 3 + ((m.ejercicio - m.reposo) * room.ajustes.ejercicio) / 24
  const consumoO2 = n * gastoMedio * C.O2_KG_POR_J * 86400
  const usoAgua = n * (C.AGUA_BEBIDA_KG_DIA + C.AGUA_HIGIENE_KG_DIA * (room.ajustes.racionAgua === 'ahorro' ? 0.4 : 1))
  const recupera = wrs.operativo ? 0.95 * (0.9 + (C.WRS_EFICIENCIA - 0.9) * rendimiento(wrs.integridad)) : 0
  let perdidaAgua = usoAgua * (1 - recupera) + (oga ? consumoO2 * C.OGA_AGUA_POR_O2 : 0) + (room.huerto.establecido ? 0.15 : 0)
  if (enSuperficie(room) && isru.operativo) perdidaAgua -= 45 * rendimiento(isru.integridad)
  const aguaUtil = r.agua + (wrs.operativo ? r.aguaResidual * 0.9 : 0)
  const agua = perdidaAgua > 0.05 ? Math.min(999, aguaUtil / perdidaAgua) : 999
  const reservaAire = r.o2 + Math.max(0, room.cabina.ppO2 - C.PPO2_MINIMA_KPA) * C.KG_O2_POR_KPA
  const aire = Math.min(999, reservaAire / consumoO2 + (oga ? agua : 0))
  const comida = Math.min(999, r.comida / (n * C.COMIDA_KG_DIA * FACTOR_RACION[room.ajustes.racionComida]))
  room.autonomia = { agua: Math.round(agua * 10) / 10, aire: Math.round(aire * 10) / 10, comida: Math.round(comida * 10) / 10 }
}

function puntosCriticos(room: RoomState, crew: Player[]): string[] {
  const p: string[] = []
  const c = room.cabina
  const e = room.energia
  const necesarios = diasRestantes(room)
  if (c.ppO2 < 19.5) p.push(`Low cabin oxygen: ${c.ppO2.toFixed(1)} kPa`)
  // La alarma salta donde se ajustó al montar el soporte vital.
  if (c.ppCO2 > (room.efectos?.alarmaCO2 ?? C.PPCO2_LIMITE_KPA)) p.push(`High CO2: ${(c.ppCO2 * 7.5).toFixed(1)} mmHg (limit 3)`)
  if (c.temp < 15 || c.temp > 28) p.push(`Cabin at ${c.temp.toFixed(0)} °C`)
  if (c.fuga > 0) p.push('Pressure leak')
  if (e.cortes.length) p.push(`No power: ${e.cortes.map((id) => nombreSistema(id)).join(', ')}`)
  else if (e.capacidad > 0 && e.bateria / e.capacidad < 0.25 && e.generacion < e.consumo) p.push(`Batteries at ${Math.round((e.bateria / e.capacidad) * 100)}%`)
  if (e.polvo > 0.2) p.push(`Dust on the panels: −${Math.round(e.polvo * 100)}%`)
  const a = room.autonomia
  if (a.aire < necesarios) p.push(`Air for ${Math.round(a.aire)} days (${Math.round(necesarios)} needed)`)
  if (a.agua < necesarios) p.push(`Water for ${Math.round(a.agua)} days (${Math.round(necesarios)} needed)`)
  if (a.comida < necesarios) p.push(`Food for ${Math.round(a.comida)} days (${Math.round(necesarios)} needed)`)
  for (const s of room.sistemas) {
    if (!s.instalado || s.id === 'isru' || s.id === 'huerto') continue
    if (s.integridad <= UMBRAL_AVERIA) p.push(`${SISTEMA_BY_ID[s.id].nombre} broken`)
    else if (s.integridad < 35) p.push(`${SISTEMA_BY_ID[s.id].nombre} at ${Math.round(s.integridad)}%`)
  }
  if (room.ambiente.tormentaSolar) p.push(`Solar storm: ${Math.round(tasaDeDosis(room, 'nave', false))} mSv per day in the cabin`)
  if (room.ambiente.tormentaPolvo) p.push(`Dust storm (opacity ${room.ambiente.tau})`)
  for (const j of crew) {
    if (j.zona === 'exterior' && j.trajeO2 / C.TRAJE_O2_KG < 0.25) p.push(`${j.nombre}: suit at ${Math.round((j.trajeO2 / C.TRAJE_O2_KG) * 100)}% oxygen`)
    if (j.vit.spo2 < 92) p.push(`${j.nombre}: blood oxygen ${Math.round(j.vit.spo2)}%`)
    else if (j.vit.salud < 50) p.push(`${j.nombre}: health ${Math.round(j.vit.salud)}`)
    if (j.vit.hidratacion < 70) p.push(`${j.nombre}: dehydrated`)
    if (j.vit.fatiga > 85) p.push(`${j.nombre}: exhausted`)
    if (j.vit.dosis > 500) p.push(`${j.nombre}: ${Math.round(j.vit.dosis)} mSv (limit ${C.LIMITE_CARRERA_MSV})`)
  }
  return p.slice(0, 10)
}

const r2 = (v: number) => Math.round(v * 100) / 100
const r5 = (v: number) => Math.round(v * 1e5) / 1e5

function redondear(room: RoomState) {
  const c = room.cabina
  c.ppO2 = r5(c.ppO2)
  c.ppCO2 = r5(c.ppCO2)
  c.temp = r5(c.temp)
  const r = room.rec
  r.agua = r5(r.agua)
  r.aguaResidual = r5(r.aguaResidual)
  r.o2 = r5(r.o2)
  r.comida = r5(r.comida)
  r.liohActivo = r5(r.liohActivo)
  const e = room.energia
  e.bateria = r5(e.bateria)
  e.generacion = r2(e.generacion)
  e.consumo = r2(e.consumo)
  e.usada = r2(e.usada ?? 0)
  e.polvo = r5(e.polvo)
  room.ambiente.hora = r5(room.ambiente.hora)
  for (const s of room.sistemas) s.integridad = r5(s.integridad)
  for (const j of room.jugadores) {
    const v = j.vit
    v.fc = r2(v.fc)
    v.fr = r2(v.fr)
    v.spo2 = r2(v.spo2)
    v.hidratacion = r2(v.hidratacion)
    v.reservas = r2(v.reservas)
    v.fatiga = r5(v.fatiga)
    v.dosis = r5(v.dosis)
    v.dosisTasa = r2(v.dosisTasa)
    v.condicion = r5(v.condicion)
    v.salud = r5(v.salud)
    j.deficitAgua = r5(j.deficitAgua)
    j.deficitKcal = r2(j.deficitKcal)
    j.trajeO2 = r5(j.trajeO2)
    j.trajeBateria = r5(j.trajeBateria)
  }
}

// ---------- Paso ----------

function subpaso(room: RoomState, dt: number) {
  room.t += dt
  if (room.fase === 'lanzamiento') {
    telemetriaAscenso(room)
    if (room.t >= TRANSITO_INICIO_S) entrarTransito(room)
  } else if (room.fase === 'transito') {
    telemetriaCrucero(room)
    // Bitácora: cada 30 días se registra el tiempo en el espacio y lo gastado hasta entonces.
    const marca = Math.floor((room.t - TRANSITO_INICIO_S) / 86400 / 30)
    if (marca > (room.avisos.bitacora ?? 0)) {
      room.avisos.bitacora = marca
      log(room, `Logbook: ${marca * 30} days in space. Fuel at ${Math.round(room.rec.propelente)}% and ${Math.round(room.energia.usada ?? 0)} kWh of power used.`)
    }
    if (room.vuelo.progreso >= 1) entrarOrbita(room)
  } else if (room.fase === 'llegada' && room.subfase === 'descenso') {
    telemetriaDescenso(room)
    if (room.t - room.tFase >= DESCENSO_S) aterrizar(room)
  }
  const superficie = enSuperficie(room)
  const { nuevoSol } = actualizarAmbiente(room)
  if (nuevoSol && superficie) alNuevoSol(room)

  const crew = tripulacion(room)
  const alerta = hayEmergencia(room)
  for (const j of crew) {
    if (j.manual && (room.t >= j.manualHasta || (j.manual === 'sueno' && j.vit.fatiga <= 2))) j.manual = null
    j.actividad = actividadDe(room, j, alerta)
  }
  energiaYCalor(room, dt, crew, superficie)
  soporteVital(room, dt, crew, superficie, alerta)
  desgaste(room, dt, superficie)
  sucesos(room, dt, crew, superficie)
  evaluar(room, crew)
}

/** Avanza la misión el equivalente a un segundo real. */
export function pasoSimulacion(room: RoomState) {
  const escala = escalaEfectiva(room)
  room.escala = escala
  if (escala <= 0 || room.resultado) return
  // Pasos internos de 10 minutos de misión como máximo, para que la simulación sea estable.
  const n = escala <= 10 ? 2 : Math.ceil(escala / 600)
  const dt = escala / n
  const fase = room.fase + room.subfase
  const alerta = hayEmergencia(room)
  for (let i = 0; i < n && !room.resultado; i++) {
    subpaso(room, dt)
    // Si salta una emergencia o cambia la fase, el tiempo frena ya: el resto del paso no corre a
    // la escala anterior (a ×86 400 un paso es un día entero sin poder reaccionar ni dormir).
    if (room.fase + room.subfase !== fase || (!alerta && (hayEmergencia(room) || room.cola.length > 0))) break
  }
  const crew = tripulacion(room)
  calcularAutonomia(room, crew)
  room.puntosCriticos = puntosCriticos(room, crew)
  pasoDeberes(room)
  despacharCola(room)
  redondear(room)
  room.escala = escalaEfectiva(room)
}

/** Recalcula los resúmenes sin avanzar el tiempo (por ejemplo, tras una acción). */
export function refrescar(room: RoomState) {
  const crew = tripulacion(room)
  calcularAutonomia(room, crew)
  room.puntosCriticos = room.fase === 'lobby' || room.fase === 'contexto' ? [] : puntosCriticos(room, crew)
  room.escala = escalaEfectiva(room)
}
