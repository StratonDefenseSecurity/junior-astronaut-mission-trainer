// Simula una misión completa sin navegador, con una tripulación que juega "razonablemente".
//   npx tsx scripts/simular.ts [tripulantes=6] [preset=equilibrado] [politica=buena|pasiva] [trayectoria] [perfil]
// Sirve para comprobar la lógica y el equilibrio del juego.
import { C, REMS_RESUMEN } from '../shared/ciencia.js'
import { CLIMA_MARTE } from '../server/datos/climaMarte.js'
import { TAREAS_ENSAMBLAJE, formatoMET, masaTotal, type Role, type RoomState } from '../shared/types.js'
import { tripulacion } from '../server/base.js'
import {
  accion,
  aplicarPreset,
  avanzar,
  cambiarZona,
  crearSala,
  elegirAlternativa,
  elegirPerfil,
  elegirRol,
  elegirTrayectoria,
  fijarEscala,
  fijarPaso,
  hacerTarea,
  iniciarMision,
  lanzar,
  marcarListo,
  nuevoJugador,
  proponerUbicacion,
  votar,
} from '../server/game.js'
import { responderBot } from '../server/bot.js'

const N = Math.min(6, Math.max(2, Number(process.argv[2] ?? 6)))
const PRESET = process.argv[3] ?? 'equilibrado'
const POLITICA = process.argv[4] ?? 'buena'
const TRAYECTORIA = process.argv[5] ?? 'estandar'
const PERFIL = process.argv[6] ?? 'estandar'

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
console.log(`Tripulación ${N} · preset ${PRESET} · política ${POLITICA} · trayectoria ${TRAYECTORIA} (${room.mision.diasTransito} d) · ${room.mision.solesObjetivo} soles`)
console.log(`Carga ${room.masa} t de ${room.capacidad} t:`, JSON.stringify(room.cargamento))
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

function mantenimiento() {
  if (!buena) return
  const s = de('sistemas')
  const superficie = room.tAterrizaje > 0
  for (const x of room.sistemas) {
    if (!x.instalado || x.integridad >= 55 || room.rec.repuestos < 2) continue
    const exterior = superficie && (x.id === 'energia' || x.id === 'isru')
    if (exterior && cambiarZona(room, s.id, 'exterior') !== null) continue
    accion(room, s.id, 'reparar', { sistema: x.id })
    if (exterior) cambiarZona(room, s.id, 'nave')
  }
  if (room.cabina.fuga > 0) accion(room, s.id, 'sellar', {})
  const m = de('medico')
  for (const j of tripulacion(room)) if ((j.dolencia || j.vit.salud < 60) && room.rec.botiquines > 0) accion(room, m.id, 'tratar', { jugadorId: j.id })
  for (const p of room.propuestas.filter((x) => x.estado === 'pendiente')) votar(room, cmd.id, p.id, true)
}

function base() {
  if (!buena) return
  const cie = de('cientifico')
  const m = room.mision
  if (room.fase === 'base' && m.muestrasAnalizadas + cie.muestras < m.muestrasObjetivo && room.ambiente.hora > 9 && room.ambiente.hora < 15 && cie.vit.fatiga < 60) {
    if (cambiarZona(room, cie.id, 'exterior') === null) {
      for (let k = 1; k <= 8 && cie.muestras < 3; k++) accion(room, cie.id, 'muestra', { sitio: `muestra${k}` })
      cambiarZona(room, cie.id, 'nave')
    }
  }
  if (cie.muestras > 0) accion(room, cie.id, 'analizar', {})
  if (room.cargamento.huerto && !room.huerto.establecido) accion(room, cie.id, 'huerto', {})
  if (room.energia.polvo > 0.08 && room.ambiente.hora > 9 && room.ambiente.hora < 16) {
    const p = de('piloto')
    if (cambiarZona(room, p.id, 'exterior') === null) {
      accion(room, p.id, 'limpiar', {})
      cambiarZona(room, p.id, 'nave')
    }
  }
}

function ensamblar() {
  for (const t of TAREAS_ENSAMBLAJE.filter((x) => x.paso === room.ensamblaje.paso && !room.ensamblaje.hechas[x.id])) {
    const quien = room.jugadores.find((j) => j.rol && t.roles.includes(j.rol)) ?? cmd
    if (t.zona === 'exterior') sinError(cambiarZona(room, quien.id, 'exterior'), `salir (${t.id})`)
    sinError(hacerTarea(room, quien.id, t.id), `tarea ${t.id}`)
    if (t.zona === 'exterior') cambiarZona(room, quien.id, 'nave')
  }
}

while (!room.resultado && segundos < 6 * 3600) {
  tic()
  segundos += 1
  if (room.fase !== faseAnterior) {
    resumen(`→ ${room.fase}`)
    faseAnterior = room.fase
    if (room.fase === 'transito') sinError(fijarEscala(room, cmd.id, 86400), 'escala tránsito')
    if (room.fase === 'base') sinError(fijarEscala(room, cmd.id, 3600), 'escala base')
    if (room.fase === 'ensamblaje') sinError(fijarEscala(room, cmd.id, 600), 'escala ensamblaje')
  }
  atenderEmergencias()
  if (room.fase === 'llegada' && room.subfase === 'orbita' && !room.propuestas.some((p) => p.estado === 'pendiente')) {
    sinError(proponerUbicacion(room, de('piloto').id, 'gale'), 'ubicación')
    for (const p of room.propuestas.filter((x) => x.estado === 'pendiente')) votar(room, cmd.id, p.id, true)
  }
  if (room.fase === 'ensamblaje' && segundos % 5 === 0) ensamblar()
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
console.log(`\n${room.resultado!.titulo}: ${room.resultado!.motivo}`)
console.log(`Tiempo real de juego a máxima escala: ${Math.round(segundos / 60)} min. Emergencias:`, JSON.stringify(cuenta))
console.log(`Equipos: ${room.sistemas.filter((s) => s.instalado).map((s) => `${s.id} ${Math.round(s.integridad)}`).join(', ')}`)
console.log(`Huerto: ${room.huerto.establecido ? `sí, ${room.huerto.cosechas} cosechas` : 'no'} · muestras ${room.mision.muestrasAnalizadas}/${room.mision.muestrasObjetivo} · límite de dosis ${C.LIMITE_CARRERA_MSV} mSv`)
console.log('Últimos registros:')
for (const l of room.registro.slice(-12)) console.log(`   ${l.tipo === 'alerta' ? '!' : ' '} ${l.texto}`)
console.log('\nAsistente:', responderBot(room, cmd, '¿cómo vamos?').slice(0, 200))
console.log('SIMULACIÓN TERMINADA')
