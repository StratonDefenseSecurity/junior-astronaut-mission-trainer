// Prueba de punta a punta contra un servidor en marcha (local o Vercel):
//   node scripts/e2e.mjs http://localhost:3001
//   node scripts/e2e.mjs https://mi-proyecto.vercel.app
// Crea dos cuentas de prueba, una sala, y recorre lobby → contexto → lanzamiento → ensamblaje.
const base = (process.argv[2] ?? 'http://localhost:3001').replace(/\/$/, '')
const sufijo = Math.random().toString(36).slice(2, 7)
let fallos = 0

async function llamar(op, datos = {}, token) {
  const t0 = Date.now()
  const r = await fetch(`${base}/api/juego`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ op, ...datos }),
  })
  const d = await r.json().catch(() => ({ error: `respuesta no JSON (${r.status})` }))
  return { status: r.status, d, ms: Date.now() - t0 }
}
function comprobar(cond, msg, detalle = '') {
  if (cond) console.log('  ok  ', msg)
  else {
    fallos++
    console.log('  FALLA', msg, detalle)
  }
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

console.log(`Servidor: ${base}`)
const clave = `prueba-${sufijo}`
const a = await llamar('registro', { usuario: `e2e_cmd_${sufijo}`, clave })
comprobar(a.status === 200 && a.d.token, `registro A (${a.ms} ms)`, JSON.stringify(a.d))
const b = await llamar('registro', { usuario: `e2e_sis_${sufijo}`, clave })
comprobar(b.status === 200 && b.d.token, `registro B (${b.ms} ms)`, JSON.stringify(b.d))
const dup = await llamar('registro', { usuario: `e2e_cmd_${sufijo}`, clave })
comprobar(dup.status === 409, 'registro duplicado rechazado', JSON.stringify(dup.d))
const mal = await llamar('ingresar', { usuario: `e2e_cmd_${sufijo}`, clave: 'otra' })
comprobar(mal.status === 401, 'clave incorrecta rechazada')
const ing = await llamar('ingresar', { usuario: `e2e_cmd_${sufijo}`, clave })
comprobar(ing.status === 200 && ing.d.usuario?.id === a.d.usuario?.id, 'ingreso correcto')
const sinToken = await llamar('crear', { modo: 'comandante' })
comprobar(sinToken.status === 401, 'sin sesión no se crean salas')

const A = a.d.token
const B = b.d.token
const sala = await llamar('crear', { modo: 'comandante' }, A)
const codigo = sala.d.sala?.codigo
comprobar(sala.status === 200 && /^[A-Z0-9]{6}$/.test(codigo ?? ''), `sala creada ${codigo} (${sala.ms} ms)`, JSON.stringify(sala.d).slice(0, 200))
const noExiste = await llamar('unirse', { codigo: 'ZZZZZ9' }, B)
comprobar(noExiste.status === 404, 'código inexistente rechazado')
const une = await llamar('unirse', { codigo }, B)
comprobar(une.status === 200 && une.d.sala.jugadores.length === 2, `B se une (${une.ms} ms)`)

let v = une.d.sala.version
const paso = async (quien, op, datos, msg, esperado = 200) => {
  const r = await llamar(op, { codigo, v, ...datos }, quien)
  if (r.d.sala) v = r.d.sala.version
  comprobar(r.status === esperado, `${msg} (${r.ms} ms)`, JSON.stringify(r.d).slice(0, 200))
  return r
}
await paso(A, 'rol', { rol: 'comandante' }, 'A elige comandante')
await paso(B, 'rol', { rol: 'comandante' }, 'B no puede repetir rol', 400)
await paso(B, 'rol', { rol: 'sistemas' }, 'B elige sistemas')
await paso(B, 'iniciar', {}, 'solo el anfitrión inicia', 400)
const ini = await paso(A, 'iniciar', {}, 'A inicia la misión')
comprobar(ini.d.sala?.fase === 'contexto', 'fase contexto')
const carga = await paso(B, 'cargamento', { cambios: { agua: 12 } }, 'B ajusta suministros')
comprobar(carga.d.sala?.cargamento.agua === 12, 'A y B comparten el cargamento')

// consulta sin cambios: debe responder "igual"
const e1 = await llamar('estado', { codigo, v, h: '' }, A)
const e2 = await llamar('estado', { codigo, v, h: e1.d.h }, A)
comprobar(e1.d.sala && e2.d.igual === true, `consulta repetida responde "igual" (${e2.ms} ms)`, JSON.stringify(e2.d).slice(0, 120))

const lan = await paso(A, 'lanzar', {}, 'A autoriza el lanzamiento')
comprobar(lan.d.sala?.fase === 'lanzamiento', 'fase lanzamiento')
console.log('  ... esperando el tránsito')
let est
for (let i = 0; i < 40; i++) {
  await esperar(1000)
  est = await llamar('estado', { codigo, v, h: '' }, B)
  if (est.d.sala?.fase === 'ensamblaje') break
}
comprobar(est.d.sala?.fase === 'ensamblaje', 'el tiempo avanza solo: llegada a Marte')
const ubi = await paso(A, 'ubicacion', { sitioId: 'jezero' }, 'A propone y aprueba ubicación')
comprobar(ubi.d.sala?.ensamblaje.sitio === 'jezero', 'ubicación aplicada')
await paso(B, 'confirmar', { paso: 2 }, 'B confirma activación')
await paso(A, 'confirmar', { paso: 2 }, 'A confirma activación')
const fin = await paso(B, 'confirmar', { paso: 3 }, 'B comprueba instalaciones')
comprobar(fin.d.sala?.fase === 'base', 'fase base')
const bot = await llamar('bot', { codigo, v, texto: '¿cuánto oxígeno queda?' }, B)
comprobar(typeof bot.d.respuesta === 'string' && bot.d.respuesta.includes('Oxígeno'), 'el asistente responde con datos de la sala')
await paso(B, 'accion', { id: 'reparar', payload: { modulo: 'habitat' } }, 'B repara un módulo')
await paso(A, 'accion', { id: 'reparar', payload: { modulo: 'habitat' } }, 'A no puede reparar (no es su rol)', 400)
console.log('  ... esperando horas de misión')
await esperar(6000)
const base2 = await llamar('estado', { codigo, v, h: '' }, A)
comprobar(base2.d.sala?.mision.hora > 8, `el reloj de misión corre (hora ${base2.d.sala?.mision.hora})`)
comprobar(base2.d.sala?.jugadores.every((j) => j.conectado), 'ambos figuran conectados')
await llamar('salir', { codigo }, A)
await llamar('salir', { codigo }, B)

console.log(fallos === 0 ? '\nE2E OK' : `\nE2E CON ${fallos} FALLA(S)`)
process.exit(fallos === 0 ? 0 : 1)
