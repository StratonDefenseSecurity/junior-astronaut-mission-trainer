// Prueba de punta a punta contra un servidor en marcha (local o Cloudflare):
//   node scripts/e2e.mjs http://localhost:3001            misión completa (unos 6 minutos)
//   node scripts/e2e.mjs https://mi-sitio.workers.dev --corto   hasta el inicio del viaje (1.5 min)
//   node scripts/e2e.mjs http://localhost:3001 --solo     solo el modo de un jugador con bots (unos 4 minutos)
// Crea cuentas de prueba y juega con ellas por la API, como lo haría el navegador. Al final
// prueba también el modo de un jugador, con una persona y cinco tripulantes bot.
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
  return { status: r.status, d, ms: Date.now() - t0, ws: r.headers.get('x-mt-ws') === '1' }
}

/** Abre el WebSocket de consultas de una sala y devuelve cómo preguntar por él. */
function abrirSocket(codigo, token) {
  return new Promise((resolver, rechazar) => {
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/api/ws?codigo=${codigo}`)
    const esperando = []
    let cerrado = null
    ws.onmessage = (e) => esperando.shift()?.(JSON.parse(e.data))
    ws.onclose = (e) => {
      cerrado = e.code
      for (const r of esperando.splice(0)) r(null)
    }
    ws.onerror = () => rechazar(new Error('no se pudo abrir el WebSocket'))
    ws.onopen = () => {
      if (token) ws.send(JSON.stringify({ auth: `Bearer ${token}` }))
      resolver({
        preguntar: (m) =>
          new Promise((r) => {
            if (cerrado !== null) return r(null)
            esperando.push(r)
            ws.send(JSON.stringify(m))
            setTimeout(() => r(null), 8000)
          }),
        cerrar: () => ws.close(),
        codigoDeCierre: () => cerrado,
      })
    }
  })
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
if (process.argv.includes('--solo')) {
  await pruebaSolo()
  await pruebaRelleno()
  await pruebaDificultad()
  console.log(fallos === 0 ? '\nE2E OK' : `\nE2E CON ${fallos} FALLA(S)`)
  process.exit(fallos === 0 ? 0 : 1)
}
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
const idB = b.d.usuario.id
const creada = await llamar('crear', { modo: 'comandante' }, A)
const codigo = creada.d.sala?.codigo
comprobar(creada.status === 200 && /^[A-Z0-9]{6}$/.test(codigo ?? ''), `sala creada ${codigo} (${creada.ms} ms)`, JSON.stringify(creada.d).slice(0, 200))
comprobar((await llamar('unirse', { codigo: 'ZZZZZ9' }, B)).status === 404, 'código inexistente rechazado')
const une = await llamar('unirse', { codigo }, B)
comprobar(une.status === 200 && une.d.sala.jugadores.length === 2, `B se une (${une.ms} ms)`)

let sala = une.d.sala

if (une.ws) {
  // El servidor ofrece las consultas por WebSocket (Cloudflare): misma pregunta, misma respuesta.
  const s1 = await abrirSocket(codigo, B)
  const t0 = Date.now()
  const r1 = await s1.preguntar({ n: 1, v: 0, h: '' })
  comprobar(r1?.n === 1 && r1.sala?.codigo === codigo && typeof r1.h === 'string', `consulta por WebSocket (${Date.now() - t0} ms)`, JSON.stringify(r1).slice(0, 200))
  const r2 = await s1.preguntar({ n: 2, v: r1?.sala?.version ?? 0, h: r1?.h ?? '', p: [2, 1, 0, 1] })
  comprobar(r2?.n === 2 && r2.igual === true && typeof r2.ahora === 'number', 'sin cambios, el WebSocket responde solo "igual"', JSON.stringify(r2).slice(0, 200))
  s1.cerrar()
  const s2 = await abrirSocket(codigo, null)
  const r3 = await s2.preguntar({ n: 1, v: 0, h: '' })
  await esperar(300)
  comprobar(r3?.sinSesion === true && s2.codigoDeCierre() !== null, 'un WebSocket sin sesión se rechaza y se cierra', JSON.stringify(r3))
} else console.log('  ...   este servidor no ofrece WebSocket: las consultas van por HTTP')
const paso = async (quien, op, datos, msg, esperado = 200) => {
  const r = await llamar(op, { codigo, v: sala.version, ...datos }, quien)
  if (r.d.sala) sala = r.d.sala
  comprobar(r.status === esperado, `${msg} (${r.ms} ms)`, JSON.stringify(r.d).slice(0, 220))
  return r
}
/**
 * Valores de experto de los trabajos por pasos (shared/procedimientos.ts), paso a paso. Una
 * función recibe los datos que preparó el servidor para leer el instrumento.
 */
const EXPERTO = {
  salida: [{ orden: ['lcvg', 'inferior', 'superior', 'gorro', 'casco', 'guantes'], errores: 0 }, (d) => (d.fuga ? 'falla' : 'pasa'), 'isle', 8, 6, 'radio'],
  entrada: ['cepillar', 6, { orden: ['guantes', 'casco', 'gorro', 'superior', 'inferior', 'lcvg'], errores: 0 }],
  reparar: ['bloqueo', { orden: ['valvulas', 'conectores', 'pernos', 'extraer'], errores: 0 }, 8, { orden: ['fluidos', 'datos', 'energia', 'bloqueo'], errores: 0 }, (d) => (d.fallo ? 'falla' : 'pasa')],
  muestra: [6, 'capas', 6, 'escanear', 8, { orden: ['revisar', 'foto', 'sellar', 'etiqueta'], errores: 0 }],
  analizar: ['tamizar', 'ambos', 8, 'pasa'],
}
/** Hace entero un trabajo por pasos como lo haría un experto, siguiendo el paso que toca. */
const trabajo = async (quien, procId, msg) => {
  const lista = EXPERTO[procId.split(':')[0]]
  for (let k = 0; k < 20; k++) {
    const e = sala.procedimientos?.[procId]
    const n = e && !e.terminado ? e.paso : 0
    const v = lista[n]
    const valor = typeof v === 'function' ? v(e?.datos ?? {}) : v
    const r = await llamar('procedimiento', { codigo, v: sala.version, proc: procId, paso: n, valor }, quien)
    if (r.d.sala) sala = r.d.sala
    if (r.status !== 200) {
      comprobar(false, `${msg} (paso ${n})`, JSON.stringify(r.d).slice(0, 220))
      return false
    }
    if (!sala.procedimientos?.[procId]) {
      comprobar(true, `${msg} (${k + 1} pasos)`)
      return true
    }
  }
  comprobar(false, `${msg}: no terminó`)
  return false
}
const estado = async (quien, extra = {}) => {
  const r = await llamar('estado', { codigo, v: sala.version, h: '', ...extra }, quien)
  if (r.d.sala) sala = r.d.sala
  return r
}

// El orden del esquema: en la sala de espera no hay roles; la contextualización empieza por
// la situación, y después vienen los roles, el objetivo y los suministros.
await paso(A, 'rol', { rol: 'comandante' }, 'en la sala de espera aún no se eligen roles', 400)
const traje = await paso(B, 'traje', { traje: { color: '#3b82f6', visor: '#38bdf8' } }, 'B personaliza su traje')
comprobar(traje.d.sala?.jugadores[1].traje.color === '#3b82f6', 'el traje queda guardado')
await paso(B, 'escenario', { escenario: 'primeraBase' }, 'solo el anfitrión elige la situación', 400)
await paso(A, 'escenario', { escenario: 'primeraBase' }, 'A elige la situación "Primera base en Marte"')
await paso(B, 'hogar', { hogar: 'lambayeque' }, 'B marca Lambayeque como su ciudad')
await paso(B, 'iniciar', {}, 'solo el anfitrión inicia', 400)
await paso(A, 'iniciar', {}, 'A inicia la misión')
comprobar(sala.fase === 'contexto' && sala.jugadores.every((j) => j.paso === 0 && !j.rol), 'la contextualización empieza por la situación, sin roles asignados')
comprobar(sala.escenario === 'primeraBase' && sala.mision.objetivo.length > 0, `la situación asignada es ${sala.escenario}`)
comprobar(sala.capacidad === 7, `la nave se dimensiona para los 2 de la sala: ${sala.capacidad} t`)
await paso(B, 'paso', { paso: 2 }, 'no se pasa al objetivo sin tener rol', 400)
await paso(B, 'listo', { listo: true }, 'no se marca listo sin tener rol', 400)
await paso(A, 'paso', { paso: 1 }, 'A pasa de la situación a los roles')
await paso(A, 'rol', { rol: 'comandante' }, 'A elige comandante')
await paso(B, 'paso', { paso: 1 }, 'B pasa de la situación a los roles')
await paso(B, 'rol', { rol: 'comandante' }, 'B no puede repetir rol', 400)
await paso(A, 'lanzar', {}, 'no se despega mientras alguien no tenga rol', 400)
await paso(B, 'rol', { rol: 'sistemas' }, 'B elige sistemas')
await paso(A, 'paso', { paso: 2 }, 'A pasa al objetivo de la misión')
await paso(B, 'paso', { paso: 2 }, 'B pasa al objetivo de la misión')
comprobar(sala.jugadores.every((j) => j.paso === 2 && j.rol), 'todos ven el objetivo ya con su rol')
await paso(B, 'perfil', { perfil: 'corta' }, 'solo el comandante fija el objetivo', 400)
await paso(A, 'nombre', { nombre: 'Chaski 1' }, 'el comandante bautiza la misión')
comprobar(sala.nombreMision === 'Chaski 1', 'la misión se llama Chaski 1')
await paso(A, 'perfil', { perfil: 'corta' }, 'A elige misión corta')
await paso(A, 'trayectoria', { trayectoria: 'rapida' }, 'A elige trayectoria rápida')
comprobar(sala.mision.diasTransito === 150 && sala.mision.solesObjetivo === 10, 'el plan cambia viaje y estancia')
await paso(A, 'paso', { paso: 3 }, 'A pasa a los suministros')
await paso(A, 'preset', { preset: 'equilibrado' }, 'alternativa de suministros equilibrada')
// Se recorta primero el blindaje, para que el huerto viaje y se pueda montar en el camino.
if (sala.masa > sala.capacidad) await paso(A, 'cargamento', { cambios: { blindaje: 0 } }, `recorte de carga (${sala.masa} t)`)
if (sala.masa > sala.capacidad) await paso(A, 'cargamento', { cambios: { huerto: 0 } }, `recorte del huerto (${sala.masa} t)`)
await paso(A, 'lanzar', {}, 'no se despega sin que todos estén listos', 400)
await paso(B, 'listo', { listo: true }, 'B marca listo')
comprobar(sala.jugadores[1].paso === 3, 'al marcar listo, B queda en el último paso')
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
comprobar(sala.energia.usada > 0.3 && sala.registro.some((l) => /Orbit reached.*kWh/.test(l.texto)), `el lanzamiento registra la energía usada: ${sala.energia.usada} kWh`)
comprobar(gMax > 1.4 && pulsoMax > 85, `el cuerpo siente el despegue: ${gMax} g, pulso ${Math.round(pulsoMax)} lpm`)
const c = sala.cabina
comprobar(c.ppO2 > 20 && c.ppO2 < 22 && c.ppCO2 > 0.05 && c.ppCO2 < 0.6, `aire de cabina normal: ${c.ppO2.toFixed(1)} kPa O2, ${(c.ppCO2 * 7.5).toFixed(1)} mmHg CO2`)
await paso(B, 'escala', { valor: 86400 }, 'solo el comandante cambia la escala', 400)
await paso(A, 'escala', { valor: 86400 }, 'A acelera el tiempo a 1 día por segundo')
const bot = await llamar('bot', { codigo, v: sala.version, texto: 'why is my pulse high?' }, B)
comprobar(typeof bot.d.respuesta === 'string' && /beats per minute/.test(bot.d.respuesta), 'el asistente explica el pulso con datos propios')
await paso(B, 'actividad', { actividad: 'ejercicio' }, 'B se pone a hacer ejercicio')
comprobar(sala.jugadores[1].manual === 'ejercicio', 'la sesión de ejercicio queda registrada')
// A un día por segundo la hora pasa enseguida; si salta una emergencia el tiempo baja a ×60 y
// la hora tarda un minuto real.
for (let i = 0; i < 50 && sala.jugadores[1].manual !== null; i++) {
  await esperar(1500)
  await estado(A)
}
comprobar(sala.jugadores[1].manual === null && sala.jugadores[1].incapacitado === 0, 'la sesión termina sola tras una hora de misión, sin agotar a nadie')

// Vista del docente: observa sin ser tripulante, habla como Mission Control y pausa.
{
  const O = (await llamar('invitado', { usuario: `Docente ${sufijo}` })).d.token
  const tripulantes = sala.jugadores.length
  const vista = await llamar('observar', { codigo }, O)
  comprobar(vista.status === 200 && vista.d.sala?.codigo === codigo && vista.d.observador === true, 'el docente observa la sala por su código')
  comprobar(vista.d.sala?.jugadores.length === tripulantes, 'el observador no cuenta como jugador')
  const msj = await llamar('controlMensaje', { codigo, texto: 'Check your oxygen levels.' }, O)
  comprobar(msj.d.sala?.registro.some((l) => l.texto === 'Mission Control: Check your oxygen levels.' && l.tipo === 'radio'), 'el mensaje de Mission Control llega al registro por radio')
  const pausa = await llamar('controlPausa', { codigo, pausa: true }, O)
  comprobar(pausa.d.sala?.pausa === true, 'el docente pausa la misión para comentarla en clase')
  const sigue = await llamar('controlPausa', { codigo, pausa: false }, O)
  comprobar(sigue.d.sala?.pausa === false && sigue.d.sala?.jugadores.length === tripulantes, 'el docente reanuda la misión sin unirse')
  comprobar((await llamar('estado', { codigo, v: 0, h: '' }, O)).status === 403, 'el observador no consulta como tripulante')
  const rk = await llamar('ranking', {})
  comprobar(rk.status === 200 && Array.isArray(rk.d.ranking), 'la clasificación global responde')
  await estado(A)
}

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
      // Los repuestos se guardan para el soporte vital: el huerto no se repara en el viaje.
      if (s.instalado && s.integridad < 50 && sala.rec.repuestos >= 2 && s.id !== 'huerto' && !(sala.tAterrizaje > 0 && (s.id === 'energia' || s.id === 'isru'))) {
        await trabajo(B, `reparar:${s.id}`, `B cambia la unidad gastada de ${s.id} paso a paso`)
      }
    }
  }
  if (sala.cargamento.huerto > 0) {
    const huerto = (n, valor, msg) => paso(A, 'procedimiento', { proc: 'huerto', paso: n, valor }, msg)
    await huerto(0, 'rabano', 'A elige cultivar rábanos')
    await huerto(1, 4, 'A despliega la cámara de cultivo')
    await huerto(2, 'rgb', 'A enciende las luces roja, azul y verde')
    await huerto(3, { orden: ['colocar', 'mechas', 'sujetar'], errores: 0 }, 'A coloca las almohadillas')
    await huerto(4, 140, 'A ceba cada almohadilla con 140 mL')
    comprobar(sala.huerto.establecido && sala.huerto.almohadillas?.length === 6 && sala.huerto.almohadillas[0].humedad === 70, 'huerto montado: seis almohadillas al 70% de humedad')
  }
  const emergencias = new Set()
  for (let i = 0; i < 420 && sala.fase === 'transito'; i++) {
    await esperar(1000)
    await estado(i % 2 ? A : B, { p: [i % 5, 0, 0, 1] })
    for (const e of sala.emergencias) emergencias.add(`${e.tipo}:${e.id}`)
    await atender()
  }
  comprobar(sala.fase === 'llegada' && sala.subfase === 'orbita', `órbita de Marte tras ${Math.round(sala.t / 86400)} días`)
  comprobar(sala.registro.some((l) => l.tipo === 'radio' && /Mission Control/.test(l.texto)), 'llegan transmisiones del centro de control durante el viaje')
  comprobar(sala.registro.some((l) => /Logbook: \d+ days in space/.test(l.texto)), 'la bitácora registra los días en el espacio, el combustible y la energía')
  comprobar(sala.registro.some((l) => /Mars orbit.*fuel.*kWh/.test(l.texto)), `al llegar se anota lo gastado: ${Math.round(sala.rec.propelente)}% de combustible, ${Math.round(sala.energia.usada)} kWh`)
  comprobar(emergencias.size >= 3, `hubo ${emergencias.size} emergencias en el viaje: ${[...new Set([...emergencias].map((e) => e.split(':')[0]))].join(', ')}`)
  const dosis = sala.jugadores[0].vit.dosis
  comprobar(dosis > 200 && dosis < 600, `dosis acumulada en el viaje: ${Math.round(dosis)} mSv`)
  if (sala.huerto.establecido) {
    const vivas = sala.huerto.almohadillas.filter((x) => !x.muerta)
    comprobar(sala.huerto.diasCultivo > 100 && vivas.every((x) => x.crecimiento > 0), `el huerto creció ${Math.round(sala.huerto.diasCultivo)} días: ${vivas.length} plantas vivas`)
  }
  comprobar(sala.jugadores.every((j) => j.vit.salud > 50), `tripulación viva y con salud ${sala.jugadores.map((j) => Math.round(j.vit.salud)).join('/')}`)
  if (sala.resultado) {
    console.log(`  (resultado: ${sala.resultado.motivo})`)
    for (const l of sala.registro.slice(-12)) console.log(`    día ${Math.round(l.t / 86400)} · ${l.texto}`)
  }

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

  // Montaje por procedimientos, paso a paso, con los valores que daría un experto en Gale (4.6° S).
  const proc = (quien, id, n, valor, msg, esperado = 200) => paso(quien, 'procedimiento', { proc: id, paso: n, valor }, msg, esperado)
  // Si la esclusa llegó dañada (aterrizaje duro o una avería del viaje), sistemas la repara antes de salir.
  const esclusa = sala.sistemas.find((x) => x.id === 'esclusa')
  if (esclusa.integridad <= 15) await trabajo(B, 'reparar:esclusa', `B repara la esclusa (${Math.round(esclusa.integridad)}%, ${sala.rec.repuestos} kits)`)
  await proc(A, 'paneles', 0, 'norte', 'el paso exterior exige salir', 400)
  await paso(A, 'zona', { zona: 'exterior' }, 'la esclusa no se cruza de un salto', 400)
  await paso(A, 'accion', { id: 'reparar', payload: { sistema: 'oga' } }, 'reparar de un clic ya no existe', 400)
  await proc(A, `salida:${idA}`, 0, { orden: ['inferior', 'lcvg', 'superior', 'gorro', 'casco', 'guantes'], errores: 0 }, 'el traje no se pone en cualquier orden', 400)
  await proc(B, `salida:${idA}`, 0, { orden: ['lcvg', 'inferior', 'superior', 'gorro', 'casco', 'guantes'], errores: 0 }, 'nadie se pone el traje de otro', 400)
  await trabajo(A, `salida:${idA}`, 'A se pone el traje, revisa fugas, prerrespira y sale')
  comprobar(sala.jugadores[0].zona === 'exterior' && sala.registro.some((l) => /went outside/.test(l.texto)), 'A está fuera tras la esclusa')
  await proc(A, 'paneles', 1, { orden: ['no', 'se', 'ne', 'so'], errores: 0 }, 'no se salta el orden de los pasos', 400)
  await proc(A, 'paneles', 0, 'norte', 'A orienta los paneles hacia el ecuador, al norte')
  await proc(A, 'paneles', 1, { orden: ['no', 'ne', 'so', 'se'], errores: 0 }, 'apretar dos esquinas del mismo lado se rechaza', 400)
  await proc(A, 'paneles', 1, { orden: ['no', 'se', 'ne', 'so'], errores: 1 }, 'A aprieta los anclajes en cruz')
  await proc(A, 'paneles', 2, 2, 'soltar antes de tiempo no despliega el ala', 400)
  await proc(A, 'paneles', 2, 6, 'A acompaña el ala mientras se desenrolla')
  await proc(A, 'paneles', 3, 5, 'A inclina los paneles 5°, como la latitud')
  comprobar(sala.efectos?.solar === 1 && sala.procedimientos.paneles.calidad[1] < 1, `los paneles rinden al ${sala.efectos?.solar} y el error de orden queda anotado`)
  await proc(A, 'carga', 0, { orden: ['eslingas', 'guia', 'tensar', 'soltar'], errores: 0 }, 'A prepara el izado con la grúa')
  await proc(A, 'carga', 1, 8, 'A baja la carga despacio')
  if (sala.cargamento.reactor > 0) await proc(A, 'carga', 2, 'enterrado', 'A deja el reactor a 1 km, enterrado')
  comprobar(sala.ensamblaje.hechas.carga && sala.ensamblaje.paso === 2, sala.cargamento.reactor > 0 ? 'carga descargada y reactor enterrado' : 'sin reactor, el paso de dónde dejarlo se salta solo y el montaje avanza')
  await trabajo(A, `entrada:${idA}`, 'A se quita el polvo, represuriza y se quita el traje')
  comprobar(sala.jugadores[0].zona === 'nave', 'A vuelve al hábitat')
  await proc(B, 'energia', 0, 'caliente', 'conectar en caliente se rechaza y se explica', 400)
  await proc(B, 'energia', 0, 'bloqueo', 'B bloquea y etiqueta el interruptor')
  await proc(B, 'energia', 1, { orden: ['fuente', 'primario', 'baterias', 'convertidor', 'cargas'], errores: 0 }, 'B energiza de la fuente hacia las cargas')
  await proc(B, 'energia', 2, 124.5, 'B ajusta el convertidor a 124.5 V')
  await proc(B, 'soporte', 0, { orden: ['termico', 'wrs', 'cdra', 'oga'], errores: 0 }, 'B arranca el soporte vital en orden')
  await proc(B, 'soporte', 1, 1.7, 'B ajusta el generador a 1.7 kg de oxígeno al día para 2 personas')
  await proc(B, 'soporte', 2, '3', 'B pone la alarma de CO2 en 3 mmHg')
  comprobar(sala.ensamblaje.paso === 3 && sala.efectos?.ogaKgDia === 1.7, 'energía y soporte vital listos')
  await proc(B, 'revisionInt', 0, { orden: ['revisar', 'limpiar', 'cerrar', 'trabas'], errores: 0 }, 'B revisa y limpia el sello')
  await proc(B, 'revisionInt', 1, 5, 'B presuriza la esclusa')
  if (sala.procedimientos.revisionInt.datos?.fuga) {
    await proc(B, 'revisionInt', 2, 'falla', 'B ve la caída de presión: hay fuga')
    comprobar(sala.procedimientos.revisionInt.paso === 0, 'con fuga, la prueba vuelve a empezar')
    await proc(B, 'revisionInt', 0, { orden: ['revisar', 'limpiar', 'cerrar', 'trabas'], errores: 0 }, 'B vuelve a limpiar el sello')
    await proc(B, 'revisionInt', 1, 5, 'B presuriza otra vez')
  } else await proc(B, 'revisionInt', 2, 'falla', 'sin fuga, dar la prueba por mala se rechaza', 400)
  await proc(B, 'revisionInt', 2, 'pasa', 'B da la esclusa por estanca')
  comprobar(sala.cabina.fuga === 0, 'la esclusa queda sin fugas')
  await trabajo(B, `salida:${idB}`, 'B sale a inspeccionar con el traje')
  await proc(B, 'revisionExt', 0, 6, 'B fotografía el casco')
  await proc(B, 'revisionExt', 1, sala.procedimientos.revisionExt.datos?.dano ? 'falla' : 'pasa', 'B mide las marcas del casco y decide')
  comprobar(sala.fase === 'base', 'la base entra en operación')
  await esperar(4000)
  await estado(B)
  const jB = sala.jugadores[1]
  comprobar(jB.actividad === 'eva' && jB.trajeO2 < 0.55, `fuera, el traje gasta oxígeno (${Math.round((jB.trajeO2 / 0.55) * 100)}%) y la escala baja a ×${sala.escala}`)
  comprobar(sala.escala <= 60, 'con alguien fuera el tiempo no corre a más de ×60')
  await paso(B, 'accion', { id: 'muestra', payload: { sitio: 'muestra1' } }, 'la muestra de un clic ya no existe', 400)
  await trabajo(B, 'muestra:muestra1', 'B toma una muestra como Perseverance (no hay científico: puede cualquiera)')
  comprobar(sala.jugadores[1].muestras === 1 && sala.muestreos.includes('muestra1'), 'B carga la muestra sellada')
  await trabajo(B, `entrada:${idB}`, 'B vuelve al hábitat por la esclusa')
  await trabajo(B, `analizar:${idB}`, 'B tamiza, analiza y lee la muestra en el laboratorio')
  comprobar(sala.mision.muestrasAnalizadas === 1, 'la muestra cuenta para el objetivo')
  await paso(B, 'accion', { id: 'racionComida', payload: { nivel: 'ahorro' } }, 'sistemas no decide las raciones si hay comandante', 400)
  await paso(A, 'accion', { id: 'racionComida', payload: { nivel: 'ahorro' } }, 'el comandante propone ración de ahorro')
  comprobar(sala.ajustes.racionComida === 'ahorro', 'en modo comandante su propuesta queda aprobada')
  await paso(A, 'accion', { id: 'refugio', payload: { horas: 6 } }, 'el comandante ordena refugio 6 horas')
  comprobar(sala.jugadores.every((x) => x.enRefugio), 'toda la tripulación entra al refugio')
  await proc(B, `salida:${idB}`, 0, { orden: ['lcvg', 'inferior', 'superior', 'gorro', 'casco', 'guantes'], errores: 0 }, 'en el refugio no se puede trabajar', 400)
  await paso(A, 'accion', { id: 'refugio', payload: { salir: true } }, 'desde el refugio el comandante sí puede levantar la orden')
  comprobar(sala.jugadores.every((x) => !x.enRefugio), 'la tripulación sale del refugio')
  const clima = await llamar('bot', { codigo, v: sala.version, texto: 'what is the weather outside?' }, A)
  comprobar(/Curiosity/.test(clima.d.respuesta ?? ''), 'el asistente cita el clima medido por Curiosity')

  // Informe final: el comandante termina antes (para clases con poco tiempo) y se ve qué se aprendió.
  await paso(B, 'accion', { id: 'terminar', payload: {} }, 'solo el comandante termina la misión antes', 400)
  await paso(A, 'accion', { id: 'terminar', payload: {} }, 'el comandante termina la misión antes')
  const inf = sala.informe
  comprobar(sala.fase === 'fin' && sala.resultado?.titulo === 'Mission Ended Early', 'la misión termina y se muestra el resultado')
  comprobar(inf && inf.puntos >= 0 && inf.puntos <= 100 && inf.partes.length === 6 && inf.partes.reduce((s, p) => s + p.max, 0) === 100, `informe con puntuación ${inf?.puntos}/100 y 6 partes`)
  comprobar(inf?.personas.length === 2 && inf.personas.every((p) => p.rol && Array.isArray(p.habilidades)), `una ficha por tripulante: ${inf?.personas.map((p) => `${p.nombre} ${p.pasos} pasos, ${p.habilidades.length} habilidades`).join('; ')}`)
  comprobar(inf?.personas.some((p) => p.habilidades.includes('eva') && p.habilidades.includes('muestra')), 'las habilidades salen de lo que hizo cada uno (salir y tomar muestras)')
  comprobar(inf?.objetivos.length === 6 && inf.objetivos.find((o) => o.id === 'ciencia')?.logrado === true, 'objetivos de aprendizaje: el método científico se logró con la muestra analizada')
  comprobar(inf?.decisiones.length <= 8 && inf.decisiones.every((d) => d.titulo && d.nota), `decisiones clave valoradas: ${inf?.decisiones.length}`)
  comprobar(JSON.stringify(inf).length < 6000, `el informe es pequeño: ${JSON.stringify(inf).length} bytes`)
  await paso(A, 'accion', { id: 'terminar', payload: {} }, 'una misión terminada no se termina otra vez', 400)
}

await llamar('salir', { codigo }, A)
await llamar('salir', { codigo }, B)
await pruebaSolo()
await pruebaRelleno()
await pruebaDificultad()
console.log(fallos === 0 ? '\nE2E OK' : `\nE2E CON ${fallos} FALLA(S)`)
process.exit(fallos === 0 ? 0 : 1)

/** Modo de un jugador: una persona elige su rol y cinco bots hacen el resto de la tripulación. */
async function pruebaSolo() {
  console.log('\nUn jugador con bots')
  const r = await llamar('registro', { usuario: `e2e_solo_${sufijo}`, clave })
  const T = r.d.token
  const creada = await llamar('crear', { modo: 'comandante', juego: 'solo' }, T)
  let s = creada.d.sala
  const cod = s?.codigo
  comprobar(creada.status === 200 && s?.modoJuego === 'solo', `sala de un jugador ${cod}`, JSON.stringify(creada.d).slice(0, 200))
  const bots = s.jugadores.filter((j) => j.bot)
  comprobar(bots.length === 5 && new Set(bots.map((b) => b.nombre)).size === 5 && bots.every((b) => b.hogar && b.conectado), `cinco bots con nombre y ciudad: ${bots.map((b) => b.nombre).join(', ')}`)
  comprobar(new Set(s.jugadores.map((b) => b.traje.color)).size === 6, 'cada uno con un traje de otro color')
  const otro = await llamar('registro', { usuario: `e2e_otro_${sufijo}`, clave })
  comprobar((await llamar('unirse', { codigo: cod }, otro.d.token)).status === 400, 'nadie más puede unirse a una sala de un jugador')

  const op = async (o, datos, msg, esperado = 200) => {
    const x = await llamar(o, { codigo: cod, v: s.version, ...datos }, T)
    if (x.d.sala) s = x.d.sala
    comprobar(x.status === esperado, msg, JSON.stringify(x.d).slice(0, 200))
    return x
  }
  const mirar = async (extra = {}) => {
    const x = await llamar('estado', { codigo: cod, v: s.version, h: '', ...extra }, T)
    if (x.d.sala) s = x.d.sala
    return x
  }
  const esBot = (id) => Boolean(s.jugadores.find((j) => j.id === id)?.bot)

  await op('iniciar', {}, 'el anfitrión empieza solo, sin esperar a nadie')
  comprobar(s.fase === 'contexto', 'contextualización')
  for (let i = 0; i < 8; i++) {
    await esperar(1000)
    await mirar()
  }
  comprobar(s.jugadores.filter((j) => j.bot).every((j) => !j.rol), 'los bots esperan a que la persona elija su rol')
  comprobar(s.jugadores.some((j) => j.bot && j.paso >= 1), 'los bots avanzan por la contextualización a su ritmo')
  await op('paso', { paso: 1 }, 'la persona pasa a los roles')
  await op('rol', { rol: 'comandante' }, 'la persona elige comandante')
  for (let i = 0; i < 45 && s.jugadores.some((j) => !j.rol); i++) {
    await esperar(1000)
    await mirar()
  }
  comprobar(new Set(s.jugadores.map((j) => j.rol).filter(Boolean)).size === 6, `los bots tomaron los otros roles: ${s.jugadores.filter((j) => j.bot).map((j) => `${j.nombre} ${j.rol}`).join(', ')}`)
  const piloto = s.jugadores.find((j) => j.rol === 'piloto')
  await op('rol', { rol: 'piloto' }, 'la persona pide el rol de un bot')
  comprobar(s.jugadores.find((j) => j.id === piloto?.id)?.rol === 'comandante', 'el bot le cede el rol y toma el que ella deja')
  await op('rol', { rol: 'comandante' }, 'y vuelve a comandante')
  await op('paso', { paso: 2 }, 'la persona pasa al objetivo')
  await op('nombre', { nombre: 'Solo 1' }, 'bautiza la misión')
  await op('paso', { paso: 3 }, 'pasa a los suministros')
  await op('preset', { preset: 'equilibrado' }, 'carga equilibrada')
  for (const cambio of [{ blindaje: 0 }, { huerto: 0 }, { oxigeno: 1 }, { paneles: 3 }]) {
    if (s.masa > s.capacidad) await op('cargamento', { cambios: cambio }, `recorte de carga (${s.masa} t de ${s.capacidad} t)`)
  }
  await op('listo', { listo: true }, 'la persona marca listo')
  for (let i = 0; i < 45 && s.jugadores.some((j) => !j.listo); i++) {
    await esperar(1000)
    await mirar()
  }
  comprobar(s.jugadores.every((j) => j.listo), 'los bots confirman que están listos')
  await op('lanzar', {}, 'el comandante autoriza el lanzamiento')
  comprobar(s.fase === 'lanzamiento', 'cuenta regresiva')
  console.log('  ... ascenso (unos 65 s)')
  for (let i = 0; i < 90 && s.fase === 'lanzamiento'; i++) {
    await esperar(1000)
    await mirar({ p: [0, 0, 0, 0] })
  }
  comprobar(s.fase === 'transito', 'rumbo a Marte')
  if (!corto) {
    await op('escala', { valor: 86400 }, 'el comandante acelera el tiempo')
    console.log('  ... viaje con los bots (hasta 2 minutos)')
    const nombres = new Set(s.jugadores.filter((j) => j.bot).map((j) => j.nombre))
    const t0 = s.t
    let propuesta = null
    let posiciones = false
    for (let i = 0; i < 120 && s.fase === 'transito'; i++) {
      await esperar(1000)
      const x = await mirar({ p: [0, 0, 0, 0] })
      if (s.jugadores.some((j) => j.bot && Array.isArray(x.d.pos?.[j.id]) && x.d.pos[j.id].length === 4)) posiciones = true
      // La persona es el comandante: aprueba lo que proponen los bots.
      for (const p of s.propuestas.filter((y) => y.estado === 'pendiente' && esBot(y.proponente))) {
        if (!propuesta) {
          propuesta = p
          await op('votar', { id: p.id, aprueba: true }, `la persona aprueba la propuesta de un bot: ${p.titulo}`)
        } else await llamar('votar', { codigo: cod, v: s.version, id: p.id, aprueba: true }, T)
      }
      const listo = propuesta && posiciones && s.chat.some((m) => nombres.has(m.de)) && s.jugadores.some((j) => j.bot && j.aportes > 0)
      if (listo && s.t - t0 > 20 * 86400) break
    }
    comprobar(propuesta, 'un bot propone algo y espera la aprobación del comandante')
    const chat = s.chat.filter((m) => nombres.has(m.de))
    comprobar(chat.length > 0, `los bots escriben en el chat: "${chat[chat.length - 1]?.de}: ${chat[chat.length - 1]?.texto}"`)
    comprobar(posiciones, 'el servidor envía la posición de los bots para dibujarlos')
    comprobar(s.jugadores.some((j) => j.bot && j.aportes > 0), `los bots trabajan: ${s.jugadores.filter((j) => j.bot).map((j) => `${j.nombre} ${j.aportes}`).join(', ')}`)
    comprobar(s.t - t0 > 10 * 86400 && s.jugadores.every((j) => j.vit.salud > 50), `la misión avanza: día ${Math.round(s.t / 86400)}`)
  }
  await llamar('salir', { codigo: cod }, T)
}

/** Multijugador con dos personas: el anfitrión pide bots y estos toman solo los roles libres. */
async function pruebaRelleno() {
  console.log('\nMultijugador con bots en los roles vacíos')
  const H = (await llamar('registro', { usuario: `e2e_host_${sufijo}`, clave })).d.token
  const G = (await llamar('registro', { usuario: `e2e_invi_${sufijo}`, clave })).d.token
  let s = (await llamar('crear', { modo: 'comandante' }, H)).d.sala
  const cod = s.codigo
  await llamar('unirse', { codigo: cod }, G)
  const op = async (o, datos, tok = H) => {
    const x = await llamar(o, { codigo: cod, v: s.version, ...datos }, tok)
    if (x.d.sala) s = x.d.sala
    return x
  }
  const mirar = async () => {
    await llamar('estado', { codigo: cod, v: 0, h: '' }, G)
    const x = await llamar('estado', { codigo: cod, v: 0, h: '' }, H)
    if (x.d.sala) s = x.d.sala
  }
  comprobar((await op('rellenarBots', { valor: true }, G)).status !== 200, 'solo el anfitrión activa los bots')
  comprobar((await op('rellenarBots', { valor: true })).status === 200 && s.rellenarBots === true, 'el anfitrión activa los bots para los roles vacíos')
  comprobar((await op('iniciar', {})).status === 200 && s.fase === 'contexto', 'empieza la misión')
  const bots = () => s.jugadores.filter((j) => j.bot)
  comprobar(bots().length === 4, `cuatro bots para completar seis: ${bots().map((b) => b.nombre).join(', ')}`)
  for (let i = 0; i < 6; i++) {
    await esperar(1000)
    await mirar()
  }
  comprobar(bots().every((j) => !j.rol), 'los bots esperan a que todas las personas elijan')
  await op('rol', { rol: 'cientifico' })
  await op('rol', { rol: 'medico' }, G)
  for (let i = 0; i < 45 && bots().some((j) => !j.rol); i++) {
    await esperar(1000)
    await mirar()
  }
  const roles = s.jugadores.map((j) => j.rol)
  comprobar(new Set(roles).size === 6 && roles.every(Boolean), `seis roles distintos: ${roles.join(', ')}`)
  comprobar(bots().every((j) => j.rol !== 'cientifico' && j.rol !== 'medico'), 'los bots solo tomaron roles libres')
  await llamar('salir', { codigo: cod }, G)
  await llamar('salir', { codigo: cod }, H)
}

/** Dificultad y misión de demostración: las elige el anfitrión en la sala de espera. */
async function pruebaDificultad() {
  console.log('\nDificultad y misión de demostración')
  const H = (await llamar('registro', { usuario: `e2e_dif_${sufijo}`, clave })).d.token
  const G = (await llamar('registro', { usuario: `e2e_dig_${sufijo}`, clave })).d.token
  let s = (await llamar('crear', { modo: 'comandante' }, H)).d.sala
  const cod = s.codigo
  await llamar('unirse', { codigo: cod }, G)
  const op = async (o, datos, tok = H) => {
    const x = await llamar(o, { codigo: cod, v: s.version, ...datos }, tok)
    if (x.d.sala) s = x.d.sala
    return x
  }
  comprobar((s.dificultad ?? 'astronauta') === 'astronauta' && !s.demo, 'por defecto: Astronaut y misión completa')
  comprobar((await op('dificultad', { dificultad: 'comandante', demo: true }, G)).status === 400, 'solo el anfitrión elige la dificultad')
  comprobar((await op('dificultad', { dificultad: 'experto', demo: false })).status === 400, 'una dificultad inválida no se acepta')
  const r = await op('dificultad', { dificultad: 'comandante', demo: true })
  comprobar(r.status === 200 && s.dificultad === 'comandante' && s.demo === true, 'el anfitrión elige Commander y la misión de demostración')
  comprobar((await op('iniciar', {})).status === 200 && s.fase === 'contexto', 'empieza la misión')
  comprobar(s.trayectoria === 'rapida' && s.mision.diasTransito === 150 && s.mision.solesObjetivo === 3, `la demostración usa el viaje real de ${s.mision.diasTransito} días y ${s.mision.solesObjetivo} soles`)
  comprobar((await op('dificultad', { dificultad: 'cadete', demo: false })).status === 400 && s.dificultad === 'comandante', 'la dificultad no cambia una vez empezada')
  await llamar('salir', { codigo: cod }, G)
  await llamar('salir', { codigo: cod }, H)
}
