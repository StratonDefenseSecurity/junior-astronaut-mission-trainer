// Prueba de punta a punta contra un servidor en marcha (local o Vercel):
//   node scripts/e2e.mjs http://localhost:3001            misión completa (unos 6 minutos)
//   node scripts/e2e.mjs https://mi-sitio.vercel.app --corto   hasta el inicio del viaje (1.5 min)
// Crea dos cuentas de prueba y juega con ellas por la API, como lo haría el navegador.
const base = (process.argv[2] ?? 'http://localhost:3001').replace(/\/$/, '')
const corto = process.argv.includes('--corto')
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

console.log(`Servidor: ${base}${corto ? ' (prueba corta)' : ''}`)
const clave = `prueba-${sufijo}`
const a = await llamar('registro', { usuario: `e2e_cmd_${sufijo}`, clave })
comprobar(a.status === 200 && a.d.token, `registro A (${a.ms} ms)`, JSON.stringify(a.d))
const b = await llamar('registro', { usuario: `e2e_sis_${sufijo}`, clave })
comprobar(b.status === 200 && b.d.token, `registro B (${b.ms} ms)`, JSON.stringify(b.d))
comprobar((await llamar('registro', { usuario: `e2e_cmd_${sufijo}`, clave })).status === 409, 'registro duplicado rechazado')
comprobar((await llamar('ingresar', { usuario: `e2e_cmd_${sufijo}`, clave: 'otra' })).status === 401, 'clave incorrecta rechazada')
comprobar((await llamar('crear', { modo: 'comandante' })).status === 401, 'sin sesión no se crean salas')

const A = a.d.token
const B = b.d.token
const idA = a.d.usuario.id
const creada = await llamar('crear', { modo: 'comandante' }, A)
const codigo = creada.d.sala?.codigo
comprobar(creada.status === 200 && /^[A-Z0-9]{6}$/.test(codigo ?? ''), `sala creada ${codigo} (${creada.ms} ms)`, JSON.stringify(creada.d).slice(0, 200))
comprobar((await llamar('unirse', { codigo: 'ZZZZZ9' }, B)).status === 404, 'código inexistente rechazado')
const une = await llamar('unirse', { codigo }, B)
comprobar(une.status === 200 && une.d.sala.jugadores.length === 2, `B se une (${une.ms} ms)`)

let sala = une.d.sala
const paso = async (quien, op, datos, msg, esperado = 200) => {
  const r = await llamar(op, { codigo, v: sala.version, ...datos }, quien)
  if (r.d.sala) sala = r.d.sala
  comprobar(r.status === esperado, `${msg} (${r.ms} ms)`, JSON.stringify(r.d).slice(0, 220))
  return r
}
const estado = async (quien, extra = {}) => {
  const r = await llamar('estado', { codigo, v: sala.version, h: '', ...extra }, quien)
  if (r.d.sala) sala = r.d.sala
  return r
}

await paso(A, 'rol', { rol: 'comandante' }, 'A elige comandante')
await paso(B, 'rol', { rol: 'comandante' }, 'B no puede repetir rol', 400)
await paso(B, 'rol', { rol: 'sistemas' }, 'B elige sistemas')
const traje = await paso(B, 'traje', { traje: { color: '#3b82f6', visor: '#38bdf8' } }, 'B personaliza su traje')
comprobar(traje.d.sala?.jugadores[1].traje.color === '#3b82f6', 'el traje queda guardado')
await paso(B, 'iniciar', {}, 'solo el anfitrión inicia', 400)
await paso(A, 'iniciar', {}, 'A inicia la misión')
comprobar(sala.fase === 'contexto' && sala.capacidad > 0, `contextualización: capacidad ${sala.capacidad} t, carga sugerida ${sala.masa} t`)
await paso(B, 'perfil', { perfil: 'corta' }, 'solo el comandante fija el objetivo', 400)
await paso(A, 'perfil', { perfil: 'corta' }, 'A elige misión corta')
await paso(A, 'trayectoria', { trayectoria: 'rapida' }, 'A elige trayectoria rápida')
comprobar(sala.mision.diasTransito === 150 && sala.mision.solesObjetivo === 10, 'el plan cambia viaje y estancia')
await paso(A, 'preset', { preset: 'equilibrado' }, 'alternativa de suministros equilibrada')
if (sala.masa > sala.capacidad) await paso(A, 'cargamento', { cambios: { blindaje: 0, huerto: 0 } }, `recorte de carga (${sala.masa} t)`)
await paso(A, 'lanzar', {}, 'no se despega sin que todos estén listos', 400)
await paso(B, 'listo', { listo: true }, 'B marca listo')
await paso(B, 'lanzar', {}, 'solo el comandante autoriza', 400)
await paso(A, 'lanzar', {}, 'A autoriza el lanzamiento')
comprobar(sala.fase === 'lanzamiento' && sala.t < 0, `cuenta regresiva (T${Math.round(sala.t)})`)

const e1 = await llamar('estado', { codigo, v: sala.version, h: '' }, A)
const e2 = await llamar('estado', { codigo, v: sala.version, h: e1.d.h, p: [1.5, -0.5, 0.3, 1] }, A)
comprobar(typeof e2.d.ahora === 'number' && (e2.d.igual === true || e2.d.sala), `consulta rápida (${e2.ms} ms)`)
const vistaB = await estado(B)
comprobar(Array.isArray(vistaB.d.pos?.[idA]) && vistaB.d.pos[idA][0] === 1.5, 'B recibe la posición del personaje de A', JSON.stringify(vistaB.d.pos))

console.log('  ... ascenso (unos 65 s)')
let gMax = 0
let pulsoMax = 0
for (let i = 0; i < 90 && sala.fase === 'lanzamiento'; i++) {
  await esperar(1000)
  // Consultan los dos, como harían sus navegadores: quien deja de consultar pasa a ausente.
  await estado(i % 2 ? A : B, { p: [0, 0, 0, 0] })
  gMax = Math.max(gMax, sala.vuelo.g)
  pulsoMax = Math.max(pulsoMax, sala.jugadores[0].vit.fc)
}
comprobar(sala.fase === 'transito', `órbita y rumbo a Marte (${sala.vuelo.etapa})`)
comprobar(gMax > 2.5 && pulsoMax > 95, `el cuerpo siente el despegue: ${gMax} g, pulso ${Math.round(pulsoMax)} lpm`)
const c = sala.cabina
comprobar(c.ppO2 > 20 && c.ppO2 < 22 && c.ppCO2 > 0.05 && c.ppCO2 < 0.6, `aire de cabina normal: ${c.ppO2.toFixed(1)} kPa O2, ${(c.ppCO2 * 7.5).toFixed(1)} mmHg CO2`)
await paso(B, 'escala', { valor: 86400 }, 'solo el comandante cambia la escala', 400)
await paso(A, 'escala', { valor: 86400 }, 'A acelera el tiempo a 1 día por segundo')
const bot = await llamar('bot', { codigo, v: sala.version, texto: '¿por qué mi pulso?' }, B)
comprobar(typeof bot.d.respuesta === 'string' && /latidos/.test(bot.d.respuesta), 'el asistente explica el pulso con datos propios')
await paso(B, 'actividad', { actividad: 'ejercicio' }, 'B se pone a hacer ejercicio')
comprobar(sala.jugadores[1].manual === 'ejercicio', 'la sesión de ejercicio queda registrada')
await esperar(2500)
await estado(A)
comprobar(sala.jugadores[1].manual === null && sala.jugadores[1].incapacitado === 0, 'la sesión termina sola tras una hora de misión, sin agotar a nadie')

if (!corto) {
  console.log('  ... viaje de 150 días (unos 3 minutos, atendiendo emergencias)')
  const atender = async () => {
    const em = sala.emergencias.find((e) => e.estado === 'activa')
    if (em) {
      const quien = em.rolesResponsables.includes('sistemas') ? B : A
      const alt = em.tipo === 'fallo' && sala.rec.repuestos < 2 ? em.alternativas[1].id : em.alternativas[0].id
      await llamar('emergencia', { codigo, v: sala.version, id: em.id, altId: alt }, quien)
    }
    for (const p of sala.propuestas.filter((x) => x.estado === 'pendiente')) await llamar('votar', { codigo, v: sala.version, id: p.id, aprueba: true }, A)
    for (const s of sala.sistemas) {
      if (s.instalado && s.integridad < 50 && sala.rec.repuestos >= 2 && !(sala.tAterrizaje > 0 && (s.id === 'energia' || s.id === 'isru'))) {
        await llamar('accion', { codigo, v: sala.version, id: 'reparar', payload: { sistema: s.id } }, B)
      }
    }
  }
  const emergencias = new Set()
  for (let i = 0; i < 420 && sala.fase === 'transito'; i++) {
    await esperar(1000)
    await estado(i % 2 ? A : B, { p: [i % 5, 0, 0, 1] })
    for (const e of sala.emergencias) emergencias.add(`${e.tipo}:${e.id}`)
    await atender()
  }
  comprobar(sala.fase === 'llegada' && sala.subfase === 'orbita', `órbita de Marte tras ${Math.round(sala.t / 86400)} días`)
  comprobar(emergencias.size >= 3, `hubo ${emergencias.size} emergencias en el viaje: ${[...new Set([...emergencias].map((e) => e.split(':')[0]))].join(', ')}`)
  const dosis = sala.jugadores[0].vit.dosis
  comprobar(dosis > 200 && dosis < 600, `dosis acumulada en el viaje: ${Math.round(dosis)} mSv`)
  comprobar(sala.jugadores.every((j) => j.vit.salud > 50), `tripulación viva y con salud ${sala.jugadores.map((j) => Math.round(j.vit.salud)).join('/')}`)

  await paso(B, 'zona', { zona: 'exterior' }, 'no se puede salir antes de aterrizar', 400)
  await paso(A, 'ubicacion', { sitioId: 'gale' }, 'A propone y aprueba aterrizar en Gale')
  comprobar(sala.sitio === 'gale' && sala.subfase === 'descenso', 'empieza el descenso')
  console.log('  ... descenso (unos 45 s)')
  for (let i = 0; i < 70 && sala.fase === 'llegada'; i++) {
    await esperar(1000)
    await estado(A)
  }
  comprobar(sala.fase === 'ensamblaje' && sala.tAterrizaje > 0, 'contacto con Marte')
  await esperar(1500)
  await estado(A)
  const amb = sala.ambiente
  comprobar(amb.sol === 1 && amb.tempExt < 10 && amb.presion > 600 && amb.presion < 900, `clima real: ${amb.tempExt} °C, ${amb.presion} Pa (sol ${amb.solCuriosity} de Curiosity)`)
  comprobar(sala.energia.generacion === 0, 'sin energía de superficie hasta desplegar los paneles')

  await paso(A, 'tarea', { tarea: 'paneles' }, 'la tarea exterior exige salir', 400)
  await paso(A, 'zona', { zona: 'exterior' }, 'A sale con el traje')
  await paso(A, 'tarea', { tarea: 'paneles' }, 'A despliega los campos solares')
  await paso(A, 'tarea', { tarea: 'carga' }, 'A descarga los equipos')
  await paso(A, 'zona', { zona: 'nave' }, 'A vuelve al hábitat')
  await paso(B, 'tarea', { tarea: 'energia' }, 'B conecta la energía')
  await paso(B, 'tarea', { tarea: 'soporte' }, 'B activa el soporte vital')
  await paso(B, 'tarea', { tarea: 'revisionInt' }, 'B comprueba la esclusa')
  await paso(B, 'zona', { zona: 'exterior' }, 'B sale a inspeccionar')
  await paso(B, 'tarea', { tarea: 'revisionExt' }, 'B inspecciona el casco')
  comprobar(sala.fase === 'base', 'la base entra en operación')
  await esperar(4000)
  await estado(B)
  const jB = sala.jugadores[1]
  comprobar(jB.actividad === 'eva' && jB.trajeO2 < 0.55, `fuera, el traje gasta oxígeno (${Math.round((jB.trajeO2 / 0.55) * 100)}%) y la escala baja a ×${sala.escala}`)
  comprobar(sala.escala <= 60, 'con alguien fuera el tiempo no corre a más de ×60')
  await paso(B, 'accion', { id: 'muestra', payload: { sitio: 'muestra1' } }, 'B recoge una muestra (no hay científico: puede cualquiera)')
  await paso(B, 'zona', { zona: 'nave' }, 'B vuelve al hábitat')
  await paso(B, 'accion', { id: 'analizar' }, 'B analiza la muestra')
  comprobar(sala.mision.muestrasAnalizadas === 1, 'la muestra cuenta para el objetivo')
  await paso(B, 'accion', { id: 'racionComida', payload: { nivel: 'ahorro' } }, 'sistemas no decide las raciones si hay comandante', 400)
  await paso(A, 'accion', { id: 'racionComida', payload: { nivel: 'ahorro' } }, 'el comandante propone ración de ahorro')
  comprobar(sala.ajustes.racionComida === 'ahorro', 'en modo comandante su propuesta queda aprobada')
  await paso(A, 'accion', { id: 'refugio', payload: { horas: 6 } }, 'el comandante ordena refugio 6 horas')
  comprobar(sala.jugadores.every((x) => x.enRefugio), 'toda la tripulación entra al refugio')
  await paso(B, 'accion', { id: 'reparar', payload: { sistema: 'cdra' } }, 'en el refugio no se puede trabajar', 400)
  await paso(A, 'accion', { id: 'refugio', payload: { salir: true } }, 'desde el refugio el comandante sí puede levantar la orden')
  comprobar(sala.jugadores.every((x) => !x.enRefugio), 'la tripulación sale del refugio')
  const clima = await llamar('bot', { codigo, v: sala.version, texto: '¿qué clima hace afuera?' }, A)
  comprobar(/Curiosity/.test(clima.d.respuesta ?? ''), 'el asistente cita el clima medido por Curiosity')
}

await llamar('salir', { codigo }, A)
await llamar('salir', { codigo }, B)
console.log(fallos === 0 ? '\nE2E OK' : `\nE2E CON ${fallos} FALLA(S)`)
process.exit(fallos === 0 ? 0 : 1)
