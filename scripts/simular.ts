// Simula una misión completa sin navegador, con una tripulación que juega "razonablemente".
//   npx tsx scripts/simular.ts [tripulantes=6] [preset=equilibrado] [politica=buena|pasiva] [trayectoria] [perfil]
// Sirve para comprobar la lógica y el equilibrio del juego.
import { C, REMS_RESUMEN } from '../shared/ciencia.js'
import { CLIMA_MARTE } from '../server/datos/climaMarte.js'
import { formatoMET, masaTotal, type Player, type Role, type RoomState, type Zona } from '../shared/types.js'
import { CONDICIONES, DCS, disponible, evaluarPaso, pasoActual, procPorId, type PasoElegir } from '../shared/procedimientos.js'
import { tripulacion } from '../server/base.js'
import {
  accion,
  aplicarPreset,
  avanzar,
  crearSala,
  elegirAlternativa,
  elegirEscenario,
  elegirPerfil,
  elegirRol,
  elegirTrayectoria,
  fijarEscala,
  fijarPaso,
  iniciarMision,
  lanzar,
  marcarListo,
  nuevoJugador,
  proponerUbicacion,
  votar,
} from '../server/game.js'
import { responderBot } from '../server/bot.js'
import { pasoProcedimiento, procedimientosPendientes, valorExperto } from '../server/procedimientos.js'
import { escenarioDe } from '../shared/escenarios.js'

const N = Math.min(6, Math.max(2, Number(process.argv[2] ?? 6)))
const PRESET = process.argv[3] ?? 'equilibrado'
const POLITICA = process.argv[4] ?? 'buena'
const TRAYECTORIA = process.argv[5] ?? 'estandar'
const PERFIL = process.argv[6] ?? 'estandar'
const ESCENARIO = process.argv[7] ?? 'primeraBase'

const exigir = (cond: unknown, msg: string) => {
  if (!cond) {
    console.error('FALLO:', msg)
    process.exit(1)
  }
}
const sinError = (e: string | null, msg: string) => exigir(e === null, `${msg}: ${e}`)

// El resumen del clima que se muestra en la contextualización tiene que salir de los datos.
{
  const soles = CLIMA_MARTE.soles as number[][]
  const r = REMS_RESUMEN
  exigir(
    soles.length === r.soles &&
      Math.min(...soles.map((x) => x[0])) === r.tMin &&
      Math.max(...soles.map((x) => x[1])) === r.tMax &&
      Math.min(...soles.map((x) => x[2])) === r.pMin &&
      Math.max(...soles.map((x) => x[2])) === r.pMax,
    'REMS_RESUMEN no coincide con los datos de Curiosity: actualiza shared/ciencia.ts',
  )
}

const room: RoomState = crearSala('SIMULA', 'u0', 'comandante')
const orden: Role[] = ['comandante', 'sistemas', 'medico', 'logistica', 'cientifico', 'piloto']
const nombres = ['Luna', 'Marco', 'Sofía', 'Diego', 'Ana', 'Raúl']
for (let i = 0; i < N; i++) room.jugadores.push(nuevoJugador(`u${i}`, nombres[i]))
const de = (rol: Role) => room.jugadores.find((j) => j.rol === rol) ?? room.jugadores[0]

let real = 1_800_000_000_000
let visto = real
const tic = () => {
  real += 1000
  avanzar(room, real, visto)
  visto = real
}

tic()
// El orden del esquema: primero la situación, después los roles, el objetivo y los suministros.
exigir(elegirRol(room, 'u0', 'comandante') !== null, 'en la sala de espera aún no hay roles')
exigir(elegirEscenario(room, 'u1', ESCENARIO) !== null, 'solo quien creó la sala elige la situación')
sinError(elegirEscenario(room, 'u0', ESCENARIO), 'situación')
sinError(iniciarMision(room, 'u0'), 'iniciar')
exigir(room.jugadores.every((j) => j.paso === 0 && !j.rol), 'la contextualización empieza por la situación, sin roles')
exigir(fijarPaso(room, 'u1', 2) !== null, 'no se pasa al objetivo sin rol')
exigir(marcarListo(room, 'u1', true) !== null, 'no se marca listo sin rol')
for (let i = 0; i < N; i++) {
  sinError(fijarPaso(room, `u${i}`, 1), 'paso a roles')
  sinError(elegirRol(room, `u${i}`, orden[i]), 'rol')
}
exigir(elegirRol(room, 'u1', 'comandante') !== null, 'un rol no se repite')
const cmd = de('comandante')
for (const j of room.jugadores) sinError(fijarPaso(room, j.id, 2), 'paso a objetivo')
sinError(elegirPerfil(room, cmd.id, PERFIL as never), 'perfil')
sinError(elegirTrayectoria(room, cmd.id, TRAYECTORIA as never), 'trayectoria')
sinError(aplicarPreset(room, PRESET), 'preset')
console.log(`Situación: ${escenarioDe(room.escenario).nombre} (${room.escenario}) · clima desde el sol ${room.indiceClima} de Curiosity`)
console.log(`Tripulación ${N} · preset ${PRESET} · política ${POLITICA} · trayectoria ${TRAYECTORIA} (${room.mision.diasTransito} d) · ${room.mision.solesObjetivo} soles`)
console.log(`Carga ${room.masa} t de ${room.capacidad} t:`, JSON.stringify(room.cargamento))
// Lo que aconseja la situación, como haría una tripulación que lee la contextualización.
if (room.escenario === 'tormentaPolvo') {
  room.cargamento.reactor = 1
  room.masa = masaTotal(room.cargamento)
}
if (room.masa > room.capacidad) {
  // Recorta lo menos vital hasta que quepa, como haría una tripulación.
  const recortes: [keyof typeof room.cargamento, number][] = [['blindaje', 0], ['huerto', 0], ['oxigeno', 1], ['paneles', 3], ['baterias', 1], ['repuestos', 8]]
  for (const [id, minimo] of recortes) {
    while (room.masa > room.capacidad && room.cargamento[id] > minimo) {
      room.cargamento[id] -= 1
      room.masa = masaTotal(room.cargamento)
    }
  }
  console.log(`  recortada a ${room.masa} t:`, JSON.stringify(room.cargamento))
}
for (const j of room.jugadores) sinError(marcarListo(room, j.id, true), 'listo')
exigir(lanzar(room, de('sistemas').id) !== null, 'solo el comandante lanza')
sinError(lanzar(room, cmd.id), 'lanzar')

const cuenta: Record<string, number> = {}
let segundos = 0
let faseAnterior = ''
let solImpreso = 0
const buena = POLITICA === 'buena'

function resumen(titulo: string) {
  const r = room.rec
  const c = room.cabina
  const e = room.energia
  const v = tripulacion(room).map((j) => `${j.nombre[0]}:${Math.round(j.vit.salud)}/${Math.round(j.vit.fc)}lpm/${Math.round(j.vit.dosis)}mSv/c${Math.round(j.vit.condicion)}/f${Math.round(j.vit.fatiga)}`)
  console.log(
    `[${titulo}] ${formatoMET(room.t)} · real ${Math.round(segundos / 60)} min · O2 ${c.ppO2.toFixed(1)} kPa · CO2 ${(c.ppCO2 * 7.5).toFixed(1)} mmHg · ${c.temp.toFixed(0)} °C` +
      ` · agua ${Math.round(r.agua)}+${Math.round(r.aguaResidual)} kg · O2 tanq ${Math.round(r.o2)} · comida ${Math.round(r.comida)} · rep ${r.repuestos} · bat ${Math.round(e.bateria)}/${e.capacidad} (${e.generacion}/${e.consumo} kW) · auton ${JSON.stringify(room.autonomia)}`,
  )
  console.log(`      ${v.join('  ')}`)
}

function atenderEmergencias() {
  const em = room.emergencias.find((x) => x.estado === 'activa')
  if (!em) return
  cuenta[em.tipo] = (cuenta[em.tipo] ?? 0) + (em.datos._contada ? 0 : 1)
  em.datos._contada = true
  if (!buena) return // la tripulación pasiva deja vencer todo
  const quien = room.jugadores.find((j) => j.rol && em.rolesResponsables.includes(j.rol)) ?? cmd
  // Elige la primera alternativa viable (la más protectora).
  let alt = em.alternativas[0].id
  if (em.tipo === 'fallo' && room.rec.repuestos < 2) alt = em.alternativas[1].id
  const err = elegirAlternativa(room, quien.id, em.id, alt)
  if (err && !/Ya hay una alternativa/.test(err)) exigir(false, `emergencia ${em.tipo}: ${err}`)
  for (const p of room.propuestas.filter((x) => x.estado === 'pendiente')) votar(room, cmd.id, p.id, true)
}

/** Pasos de los trabajos (salir, reparar, curar, muestras...) hechos, por familia. */
const trabajos: Record<string, number> = {}
const listo = (j: Player) => j.incapacitado <= 0 && !j.enRefugio

/**
 * Hace entero, paso a paso y como un experto, un trabajo por pasos: cruza la esclusa con su
 * procedimiento si el paso es en la otra zona. Devuelve el error si no se pudo hacer.
 */
function hacer(j: Player, procId: string): string | null {
  for (let guarda = 0; guarda < 40; guarda++) {
    const p = procPorId(procId, room)
    if (!p) return `no existe ${procId}`
    if (!disponible(room, p)) return guarda > 0 ? null : `${procId} no está disponible: ${p.motivo?.(room) ?? ''}`
    const i = pasoActual(room, p)
    const def = p.pasos[i]
    const cruce = procId.startsWith('salida:') || procId.startsWith('entrada:')
    if (!cruce && j.zona !== def.zona) {
      const e = zona(j, def.zona)
      if (e) return e
    }
    const valor = valorExperto(room, procId, i)
    const ev = evaluarPaso(room, p, i, valor)
    const error = pasoProcedimiento(room, j.id, procId, i, valor)
    if (error) return `${procId} paso ${i}: ${error}`
    calidades.push(ev.ok ? ev.calidad : -1)
    const familia = procId.split(':')[0]
    trabajos[familia] = (trabajos[familia] ?? 0) + 1
    const e = room.procedimientos?.[procId]
    if (!e || e.terminado) return null
  }
  return `${procId} no terminó`
}

/** Sale o entra por la esclusa con el procedimiento de ponerse o quitarse el traje. */
function zona(j: Player, z: Zona): string | null {
  if (j.zona === z) return null
  const e = hacer(j, `${z === 'exterior' ? 'salida' : 'entrada'}:${j.id}`)
  return e ?? (j.zona === z ? null : `${j.nombre} no cruzó la esclusa`)
}

function mantenimiento() {
  if (!buena) return
  const s = de('sistemas')
  if (listo(s)) {
    for (const x of room.sistemas) {
      if (!x.instalado || x.integridad >= 55 || room.rec.repuestos < 2) continue
      hacer(s, `reparar:${x.id}`)
    }
    if (room.cabina.fuga > 0 && room.rec.repuestos > 0) hacer(s, 'sellar')
    const cdra = room.sistemas.find((x) => x.id === 'cdra')!
    if (!cdra.operativo && room.cabina.ppCO2 > C.PPCO2_LIMITE_KPA && room.rec.lioh > 0 && room.rec.liohActivo < 1) hacer(s, 'lioh')
    if (s.zona === 'exterior') zona(s, 'nave')
  }
  const m = de('medico')
  if (listo(m)) for (const j of tripulacion(room)) if ((j.dolencia || j.vit.salud < 60) && room.rec.botiquines > 0 && j.zona === 'nave') hacer(m, `tratar:${j.id}`)
  for (const p of room.propuestas.filter((x) => x.estado === 'pendiente')) votar(room, cmd.id, p.id, true)
}

function base() {
  if (!buena) return
  const cie = de('cientifico')
  const m = room.mision
  if (room.fase === 'base' && listo(cie) && m.muestrasAnalizadas + cie.muestras < m.muestrasObjetivo && room.ambiente.hora > 9 && room.ambiente.hora < 15 && cie.vit.fatiga < 60) {
    if (zona(cie, 'exterior') === null) {
      for (let k = 1; k <= 8 && cie.muestras < 3; k++) if (!room.muestreos.includes(`muestra${k}`)) sinError(hacer(cie, `muestra:muestra${k}`), 'muestra')
      sinError(zona(cie, 'nave'), 'volver con las muestras')
    }
  }
  if (cie.muestras > 0 && listo(cie)) {
    sinError(hacer(cie, `analizar:${cie.id}`), 'analizar')
  }
  // Tras una tormenta, vuelve a encender lo que se apagó para ahorrar.
  if (!room.ambiente.tormentaPolvo && room.energia.bateria > room.energia.capacidad * 0.5) {
    for (const id of ['isru', 'huerto'] as const) {
      const x = room.sistemas.find((y) => y.id === id)!
      if (x.instalado && !x.activo && !room.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === 'equipo')) {
        accion(room, de('logistica').id, 'equipo', { sistema: id })
        for (const p of room.propuestas.filter((y) => y.estado === 'pendiente')) votar(room, cmd.id, p.id, true)
      }
    }
  }
  if (room.energia.polvo > 0.08 && room.ambiente.hora > 9 && room.ambiente.hora < 16) {
    const p = de('piloto')
    if (listo(p) && zona(p, 'exterior') === null) {
      sinError(hacer(p, 'limpiar'), 'limpiar')
      sinError(zona(p, 'nave'), 'volver de limpiar')
    }
  }
}

/** Hace, paso a paso y como un experto, los procedimientos pendientes: el montaje y el huerto. */
const calidades: number[] = []
function procedimientos(soloMontaje: boolean) {
  for (let guarda = 0; guarda < 30; guarda++) {
    // Los trabajos a demanda (reparar, curar, salir...) los hace cada rol cuando hacen falta.
    const p = procedimientosPendientes(room).find((x) => !x.aDemanda && (!soloMontaje || !['huerto', 'regar', 'ralear', 'moho', 'amarillas', 'cosechar'].includes(x.procId)))
    if (!p) return
    const quien = room.jugadores.find((j) => j.rol && p.roles.includes(j.rol)) ?? cmd
    // Quien está fuera de servicio o en el refugio espera a poder hacerlo.
    if (quien.incapacitado > 0 || quien.enRefugio) return
    if (p.zona === 'exterior') sinError(zona(quien, 'exterior'), `salir (${p.procId})`)
    sinError(pasoProcedimiento(room, quien.id, p.procId, p.paso, valorExperto(room, p.procId, p.paso)), `procedimiento ${p.procId} paso ${p.paso}`)
    const e = room.procedimientos?.[p.procId]
    if (e) calidades.push(e.calidad[p.paso] ?? 1)
    if (quien.zona === 'exterior') sinError(zona(quien, 'nave'), `entrar (${p.procId})`)
  }
}

/** Copia de la sala al empezar la base, para probar los trabajos y sus consecuencias aparte. */
let copia: RoomState | null = null

while (!room.resultado && segundos < 6 * 3600) {
  tic()
  segundos += 1
  if (room.fase === 'base' && !copia) copia = structuredClone(room)
  if (room.fase !== faseAnterior) {
    resumen(`→ ${room.fase}`)
    faseAnterior = room.fase
    if (room.fase === 'transito') sinError(fijarEscala(room, cmd.id, 86400), 'escala tránsito')
    if (room.fase === 'base') sinError(fijarEscala(room, cmd.id, 3600), 'escala base')
    if (room.fase === 'ensamblaje') sinError(fijarEscala(room, cmd.id, 600), 'escala ensamblaje')
  }
  atenderEmergencias()
  if (room.fase === 'llegada' && room.subfase === 'orbita' && !room.propuestas.some((p) => p.estado === 'pendiente')) {
    sinError(proponerUbicacion(room, de('piloto').id, escenarioDe(room.escenario).sitio ?? 'gale'), 'ubicación')
    for (const p of room.propuestas.filter((x) => x.estado === 'pendiente')) votar(room, cmd.id, p.id, true)
  }
  if (room.fase === 'ensamblaje' && segundos % 5 === 0) procedimientos(true)
  if (buena && segundos % 3 === 0) procedimientos(false)
  if (segundos % 3 === 0) {
    mantenimiento()
    base()
  }
  if (room.fase === 'transito' && Math.floor(room.t / 86400) % 50 === 0 && Math.floor(room.t / 86400) !== solImpreso) {
    solImpreso = Math.floor(room.t / 86400)
    resumen(`día ${solImpreso}`)
  }
  if (room.fase === 'base' && room.ambiente.sol % 5 === 0 && room.ambiente.sol !== solImpreso) {
    solImpreso = room.ambiente.sol
    resumen(`sol ${solImpreso}`)
  }
}

resumen('FIN')
exigir(room.resultado, 'la misión debe terminar')
exigir(copia, 'la base llegó a funcionar')
probarTrabajos(copia!)
console.log(`\n${room.resultado!.titulo}: ${room.resultado!.motivo}`)
console.log(`Tiempo real de juego a máxima escala: ${Math.round(segundos / 60)} min. Emergencias:`, JSON.stringify(cuenta))
console.log(`Equipos: ${room.sistemas.filter((s) => s.instalado).map((s) => `${s.id} ${Math.round(s.integridad)}`).join(', ')}`)
exigir(calidades.every((q) => q === 1), `los valores de experto dan calidad 1: ${calidades.filter((q) => q !== 1).join(', ')}`)
const plantas = room.huerto.almohadillas ?? []
console.log(`Procedimientos: ${calidades.length} pasos hechos como un experto · trabajos ${JSON.stringify(trabajos)} · efectos ${JSON.stringify(room.efectos ?? {})}`)
exigir((trabajos.salida ?? 0) > 0 && (trabajos.entrada ?? 0) > 0 && (trabajos.muestra ?? 0) > 0 && (trabajos.analizar ?? 0) > 0, 'salir, entrar, tomar y analizar muestras se hacen por pasos')
console.log(`Huerto: ${room.huerto.establecido ? `sí, ${room.huerto.cultivo}, ${room.huerto.cosechas} cosechas, ${room.huerto.comidaFresca ?? 0} kg frescos, ${plantas.filter((a) => !a.muerta).length}/${plantas.length} plantas vivas` : 'no'} · muestras ${room.mision.muestrasAnalizadas}/${room.mision.muestrasObjetivo} · límite de dosis ${C.LIMITE_CARRERA_MSV} mSv`)
console.log('Últimos registros:')
for (const l of room.registro.slice(-12)) console.log(`   ${l.tipo === 'alerta' ? '!' : ' '} ${l.texto}`)
console.log('\nAsistente:', responderBot(room, cmd, '¿cómo vamos?').slice(0, 200))
console.log('SIMULACIÓN TERMINADA')

/**
 * Prueba los trabajos por pasos sobre una copia de la sala, sin tocar la misión: que como experto
 * salgan bien, y que las malas decisiones tengan su consecuencia.
 * `elegir` cambia el valor de algunos pasos (por su id); `datos` fuerza la lectura que preparó el servidor.
 */
function probarTrabajos(r: RoomState) {
  // Si el rol no viaja, lo hace cualquiera (como en el juego).
  const quien = (rol: Role) => r.jugadores.find((j) => j.rol === rol) ?? r.jugadores[0]
  const pasos = (j: Player, procId: string, elegir: Record<string, unknown> = {}, datos: Record<string, Record<string, number>> = {}): string | null => {
    for (let guarda = 0; guarda < 40; guarda++) {
      const p = procPorId(procId, r)
      if (!p) return `no existe ${procId}`
      if (!disponible(r, p)) return guarda > 0 ? null : `${procId} no está disponible: ${p.motivo?.(r) ?? ''}`
      const i = pasoActual(r, p)
      const def = p.pasos[i]
      const cruce = procId.startsWith('salida:') || procId.startsWith('entrada:')
      if (!cruce && j.zona !== def.zona) {
        const e = pasos(j, `${def.zona === 'exterior' ? 'salida' : 'entrada'}:${j.id}`)
        if (e) return e
      }
      const forzar = datos[def.id]
      if (forzar) {
        Object.assign((r.procedimientos![procId].datos ??= {}), forzar)
        delete datos[def.id] // solo la primera vez
      }
      const valor = def.id in elegir ? elegir[def.id] : valorExperto(r, procId, i)
      const error = pasoProcedimiento(r, j.id, procId, i, valor)
      if (error) return `${procId} paso ${def.id}: ${error}`
      const e = r.procedimientos?.[procId]
      if (!e || e.terminado) return null
    }
    return `${procId} no terminó`
  }
  const ok = (e: string | null, msg: string) => exigir(e === null, `${msg}: ${e}`)
  const sis = quien('sistemas')
  const med = quien('medico')
  const cie = quien('cientifico')
  for (const j of r.jugadores) {
    j.incapacitado = 0
    j.enRefugio = false
    j.vit.fatiga = 10
    j.trajeO2 = C.TRAJE_O2_KG
    j.trajeBateria = 1
  }
  r.refugioHasta = 0
  r.rec.repuestos = 20
  r.rec.botiquines = 20
  r.rec.lioh = 3
  r.energia.bateria = r.energia.capacidad

  // Sellar una fuga: se encuentra, se parcha y la presión aguanta.
  r.cabina.fuga = 1.5
  ok(pasos(sis, 'sellar'), 'sellar')
  exigir(r.cabina.fuga === 0, 'la fuga queda sellada')
  // Cartucho de LiOH.
  const activo = r.rec.liohActivo
  ok(pasos(sis, 'lioh'), 'lioh')
  exigir(r.rec.lioh === 2 && r.rec.liohActivo > activo + 2, 'el cartucho nuevo absorbe CO2')
  // Reparar cambiando la unidad.
  const wrs = r.sistemas.find((x) => x.id === 'wrs')!
  wrs.integridad = 40
  ok(pasos(sis, 'reparar:wrs'), 'reparar')
  exigir(wrs.integridad === 85, `la reparación devuelve el reciclador al 85%: ${wrs.integridad}`)
  // Curar cada dolencia con su diagnóstico y su tratamiento.
  const paciente = quien('piloto')
  for (const c of CONDICIONES) {
    paciente.dolencia = c.dolencia
    paciente.vit.salud = 70
    ok(pasos(med, `tratar:${paciente.id}`), `tratar ${c.id}`)
    exigir(!paciente.dolencia && paciente.vit.salud > 70, `${c.id} curado`)
  }
  // Un tratamiento equivocado gasta el botiquín y no cura.
  paciente.dolencia = 'a skin rash'
  const kits = r.rec.botiquines
  const mal = (procPorId(`tratar:${paciente.id}`, r)!.pasos[4] as PasoElegir).opciones(r).find((o) => o.id !== 'piel')!.id
  ok(pasos(med, `tratar:${paciente.id}`, { tratamiento: mal }), 'tratar mal')
  exigir(paciente.dolencia === 'a skin rash' && r.rec.botiquines === kits - 1, 'un tratamiento equivocado no cura y gasta el botiquín')
  paciente.dolencia = null
  // Saltarse la prerrespiración: riesgo de enfermedad por descompresión.
  let bends = 0
  for (const j of r.jugadores.filter((x) => x.rol !== 'medico')) {
    ok(pasos(j, `salida:${j.id}`, { protocolo: 'nada' }), `salir sin prerrespirar (${j.nombre})`)
    if (j.dolencia === DCS || r.emergencias.some((e) => e.datos.dolencia === DCS && e.datos.jugadorId === j.id) || r.cola.some((c) => c.datos.dolencia === DCS && c.datos.jugadorId === j.id)) bends += 1
    ok(pasos(j, `entrada:${j.id}`), `volver a entrar (${j.nombre})`)
  }
  exigir(bends > 0, 'salir sin prerrespirar da la enfermedad por descompresión a alguien')
  // Dar por buena una fuga del traje: el traje pierde oxígeno de más fuera.
  ok(pasos(sis, `salida:${sis.id}`, {}, { fugas: { fuga: 1 } }), 'salir tras encontrar una fuga')
  exigir(sis.zona === 'exterior' && !sis.trajeFuga && r.registro.some((l) => /found a leak in the suit/.test(l.texto)), 'con la fuga a la vista se revisa el traje, se repite la prueba y se sale bien')
  ok(pasos(sis, `entrada:${sis.id}`), 'volver tras la fuga')
  ok(pasos(sis, `salida:${sis.id}`, { fugas: 'pasa' }, { fugas: { fuga: 1 } }), 'salir ignorando la fuga')
  exigir(sis.zona === 'exterior' && (sis.trajeFuga ?? 0) > 0, 'ignorar la fuga del traje la deja perdiendo oxígeno')
  // Meter el polvo en el hábitat tapa los filtros.
  const cdra = r.sistemas.find((x) => x.id === 'cdra')!
  const antes = cdra.integridad
  ok(pasos(sis, `entrada:${sis.id}`, { polvo: 'dentro' }), 'entrar con polvo')
  exigir(cdra.integridad < antes && !sis.trajeFuga, 'el polvo dentro desgasta el depurador y la fuga del traje se repara al entrar')
  // Limpiar con un cepillo duro raya los paneles.
  r.energia.polvo = 0.3
  const solar = r.efectos?.solar ?? 1
  ok(pasos(quien('piloto'), 'limpiar', { herramienta: 'duro' }), 'limpiar con cepillo duro')
  exigir((r.efectos?.solar ?? 1) < solar && r.energia.polvo < 0.3, 'el cepillo duro limpia pero raya los paneles')
  ok(pasos(quien('piloto'), `entrada:${quien('piloto').id}`), 'piloto vuelve')
  // Una roca mala no cuenta y el sitio se puede volver a muestrear; una buena sí cuenta.
  const libres = ['muestra1', 'muestra2', 'muestra3', 'muestra4', 'muestra5', 'muestra6', 'muestra7', 'muestra8'].filter((x) => !r.muestreos.includes(x))
  exigir(libres.length >= 2, 'quedan sitios para probar las muestras')
  cie.muestras = 0
  cie.muestrasTomadas = []
  const analizadas = r.mision.muestrasAnalizadas
  ok(pasos(cie, `muestra:${libres[0]}`, { roca: 'polvo' }), 'muestra de una roca polvorienta')
  ok(pasos(cie, `muestra:${libres[1]}`), 'muestra de una roca en capas')
  ok(pasos(cie, `analizar:${cie.id}`), 'analizar')
  exigir(r.mision.muestrasAnalizadas === analizadas + 1 && !r.muestreos.includes(libres[0]) && r.muestreos.includes(libres[1]), 'la muestra mala no cuenta y su sitio queda libre')
  console.log('Trabajos probados: sellar, LiOH, reparar, curar las 9 condiciones, prerrespiración, fuga del traje, polvo, paneles rayados y valor de las muestras.')
}
