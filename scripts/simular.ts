// Simulación de una misión completa sin navegador: npx tsx scripts/simular.ts
import {
  accion,
  confirmarPaso,
  crearSala,
  elegirAlternativa,
  elegirRol,
  horaDeMision,
  iniciarMision,
  irAyudar,
  lanzar,
  nuevoJugador,
  pedirAyuda,
  proponerUbicacion,
  avanzar,
  votar,
} from '../server/game.js'
import { responderBot } from '../server/bot.js'
import { ASSEMBLY_STEPS, type Role } from '../shared/types.js'

const assert = (cond: unknown, msg: string) => {
  if (!cond) {
    console.error('FALLO:', msg)
    process.exit(1)
  }
}
const ok = (msg: string) => console.log('  ok', msg)

const room = crearSala('TEST01', 'u1', 'comandante')
const tripulantes: [string, string, Role][] = [
  ['u1', 'Luna', 'comandante'],
  ['u2', 'Marco', 'sistemas'],
  ['u3', 'Sofía', 'medico'],
  ['u4', 'Diego', 'logistica'],
  ['u5', 'Ana', 'cientifico'],
  ['u6', 'Raúl', 'piloto'],
]
for (const [id, nombre, rol] of tripulantes) {
  room.jugadores.push(nuevoJugador(id, nombre))
  assert(elegirRol(room, id, rol) === null, `rol ${rol}`)
}
assert(elegirRol(room, 'u2', 'comandante') !== null, 'no se puede duplicar rol')
ok('lobby: 6 roles únicos')

assert(iniciarMision(room, 'u2') !== null, 'solo el host inicia')
assert(iniciarMision(room, 'u1') === null, 'host inicia')
assert(room.fase === 'contexto', 'fase contexto')
assert(lanzar(room, 'u2') !== null, 'solo comandante lanza')
assert(lanzar(room, 'u1') === null, 'comandante lanza')
assert(room.fase === 'lanzamiento' && room.recursos.agua === 500, 'recursos cargados')
ok(`lanzamiento: combustible ${room.mision.combustible}%`)

// tránsito instantáneo
room.transito = { inicio: Date.now() - 999_999, duracion: 1000 }
avanzar(room, Date.now())
assert(room.fase === 'ensamblaje', 'llegada a ensamblaje')

// paso 0: piloto propone, comandante aprueba
assert(proponerUbicacion(room, 'u6', 'jezero') === null, 'piloto propone')
assert(room.propuestas[0].estado === 'pendiente', 'propuesta pendiente')
assert(votar(room, 'u3', room.propuestas[0].id, true) !== null, 'medico no decide en modo comandante')
assert(votar(room, 'u1', room.propuestas[0].id, true) === null, 'comandante aprueba')
assert(room.ensamblaje.paso === 1 && room.recursos.agua === 650, 'sitio aplicado (+150 agua)')
ok('ensamblaje: ubicación por propuesta')

// paso 1: logística + piloto
assert(confirmarPaso(room, 'u1', 1) !== null, 'comandante no confirma paso 1')
confirmarPaso(room, 'u4', 1)
assert(room.ensamblaje.paso === 1, 'falta piloto')
confirmarPaso(room, 'u6', 1)
assert(room.ensamblaje.paso === 2, 'paso 1 completo')
confirmarPaso(room, 'u2', 2)
confirmarPaso(room, 'u1', 2)
confirmarPaso(room, 'u2', 3)
assert(room.fase === 'base', 'fase base')
assert(room.sistemas.every((s) => s.online || s.id === 'invernadero'), 'módulos encendidos')
ok(`ensamblaje: ${ASSEMBLY_STEPS.length} pasos completados`)

// acciones directas
assert(accion(room, 'u1', 'reparar', { modulo: 'habitat' }) !== null, 'comandante no repara')
assert(accion(room, 'u2', 'reparar', { modulo: 'habitat' }) === null, 'sistemas repara')
assert(room.recursos.repuestos === 23, 'repuestos descontados')
for (let i = 0; i < 6; i++) accion(room, 'u5', 'huerto', {})
assert(room.huerto.establecido, 'huerto establecido')
assert(accion(room, 'u5', 'experimento', {}) === null, 'experimento')
assert(room.mision.experimentos === 1, 'experimento contado')
ok('acciones directas: reparar, huerto, experimento')

// propuesta de ración (logística propone, comandante aprueba)
assert(accion(room, 'u4', 'racionar', { nivel: 'ahorro' }) === null, 'logística propone ración')
const prop = room.propuestas.find((p) => p.tipo === 'racionar')!
assert(prop.estado === 'pendiente', 'pendiente')
votar(room, 'u1', prop.id, true)
assert(room.racion === 'ahorro', 'ración aplicada')
assert(accion(room, 'u4', 'reciclaje', {}) === null, 'propone reciclaje')
votar(room, 'u1', room.propuestas.find((p) => p.tipo === 'reciclaje')!.id, false)
assert(!room.reciclajeActivo, 'reciclaje rechazado')
ok('propuestas: aprobar y rechazar')

// ayuda
pedirAyuda(room, 'u2', 'medico', 'mareos')
assert(irAyudar(room, 'u4', 'u2') !== null, 'logística no puede atender pedido al médico')
assert(irAyudar(room, 'u3', 'u2') === null, 'médico ayuda')
assert(room.jugadores[1].ayuda === null, 'ayuda resuelta')
ok('ayuda entre integrantes')

// bot
const bot = responderBot(room, room.jugadores[3], '¿cuánta agua queda?')
assert(bot.includes('Agua:'), 'bot responde agua')
ok(`bot: "${bot.slice(0, 70)}…"`)

// simular horas hasta el final, resolviendo emergencias con la primera alternativa
let emergenciasVistas = 0
let horas = 0
while (!room.resultado && horas < 400) {
  horaDeMision(room)
  horas++
  const em = room.emergencias.find((e) => e.estado === 'activa')
  if (em) {
    emergenciasVistas++
    const rol = em.rolesResponsables[0]
    const quien = room.jugadores.find((j) => j.rol === rol)!
    const err = elegirAlternativa(room, quien.id, em.id, em.alternativas[0].id)
    assert(err === null, `elegir alternativa: ${err}`)
    const pend = room.propuestas.find((p) => p.estado === 'pendiente' && p.tipo === 'emergencia')
    if (pend) votar(room, 'u1', pend.id, true)
    assert(em.estado === 'resuelta', `emergencia resuelta (${em.tipo})`)
  }
  // mantenimiento básico de sistemas y experimentos
  const peor = [...room.sistemas].filter((s) => s.id !== 'invernadero' || s.online).sort((a, b) => a.integridad - b.integridad)[0]
  if (peor && (peor.integridad < 50 || !peor.online) && room.recursos.repuestos >= 2) accion(room, 'u2', 'reparar', { modulo: peor.id })
  if (room.mision.experimentos < 3 && room.recursos.energia > 40) accion(room, 'u5', 'experimento', {})
}
assert(room.resultado, 'la misión termina')
console.log(`  fin tras ${horas} h: ${room.resultado!.victoria ? 'VICTORIA' : 'DERROTA'} — ${room.resultado!.motivo}`)
console.log(`  emergencias: ${emergenciasVistas}, agua ${Math.round(room.recursos.agua)}, O2 ${Math.round(room.recursos.oxigeno)}, comida ${Math.round(room.recursos.alimentos)}, energía ${Math.round(room.recursos.energia)}`)
console.log('  salud:', room.jugadores.map((j) => `${j.nombre} ${Math.round(j.salud)}`).join(', '))
assert(emergenciasVistas > 0, 'hubo emergencias')
console.log('SIMULACIÓN OK')
