// Ayuda de desarrollo: lleva una sala existente hasta una fase, jugando por la API con dos
// cuentas que ya están dentro. Sirve para revisar pantallas avanzadas sin jugar todo el viaje.
//   node scripts/avanzar-sala.mjs <url> <codigo> <usuarioCmd> <usuarioOtro> <clave> [ensamblaje|base]
const [url, codigo, uA, uB, clave, meta = 'base'] = process.argv.slice(2)
if (!url || !codigo || !uA || !uB || !clave) {
  console.error('Uso: node scripts/avanzar-sala.mjs <url> <codigo> <usuarioCmd> <usuarioOtro> <clave> [ensamblaje|base]')
  process.exit(1)
}
const base = url.replace(/\/$/, '')
const { cruzar } = await import('./eva.mjs')
async function llamar(op, datos = {}, token) {
  const r = await fetch(`${base}/api/juego`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ op, ...datos }),
  })
  return r.json().catch(() => ({}))
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const sesionA = await llamar('ingresar', { usuario: uA, clave })
const sesionB = await llamar('ingresar', { usuario: uB, clave })
const A = sesionA.token
const B = sesionB.token
if (!A || !B) {
  console.error('No se pudo ingresar con esas cuentas.')
  process.exit(1)
}
let sala = (await llamar('estado', { codigo, v: 0, h: '' }, A)).sala
if (!sala) {
  console.error('La cuenta del comandante no está en esa sala.')
  process.exit(1)
}
const accion = async (quien, op, datos = {}) => {
  const d = await llamar(op, { codigo, v: sala.version, ...datos }, quien)
  if (d.sala) sala = d.sala
  if (d.error) console.log(`   (${op}: ${d.error})`)
  return d
}
let faseAnterior = ''
for (let i = 0; i < 900; i++) {
  await accion(A, 'estado', { h: '' })
  if (sala.fase !== faseAnterior) {
    console.log(`→ ${sala.fase}${sala.subfase ? ` (${sala.subfase})` : ''}`)
    faseAnterior = sala.fase
  }
  if (sala.resultado || sala.fase === meta || (meta === 'ensamblaje' && sala.fase === 'base')) break
  const em = sala.emergencias.find((e) => e.estado === 'activa')
  if (em) {
    const alt = em.tipo === 'fallo' && sala.rec.repuestos < 2 ? em.alternativas[1].id : em.alternativas[0].id
    await accion(A, 'emergencia', { id: em.id, altId: alt })
    await accion(B, 'emergencia', { id: em.id, altId: alt })
  }
  for (const p of sala.propuestas.filter((x) => x.estado === 'pendiente')) await accion(A, 'votar', { id: p.id, aprueba: true })
  if (sala.fase === 'lobby') await accion(A, 'iniciar')
  if (sala.fase === 'contexto') {
    // Contextualización: situación, roles, objetivo y suministros, en ese orden.
    const de = (sesion) => sala.jugadores.find((j) => j.id === sesion.usuario.id)
    if (!de(sesionA)?.rol) {
      await accion(A, 'paso', { paso: 1 })
      await accion(A, 'rol', { rol: 'comandante' })
    }
    if (!de(sesionB)?.rol) {
      await accion(B, 'paso', { paso: 1 })
      const libre = ['sistemas', 'cientifico', 'piloto', 'logistica', 'medico'].find((r) => !sala.jugadores.some((j) => j.rol === r))
      await accion(B, 'rol', { rol: libre })
    }
    await accion(A, 'paso', { paso: 3 })
    await accion(A, 'preset', { preset: 'equilibrado' })
    if (sala.masa > sala.capacidad) await accion(A, 'cargamento', { cambios: { blindaje: 0, huerto: 0 } })
    await accion(B, 'listo', { listo: true })
    await accion(A, 'lanzar')
  }
  if (sala.fase === 'transito') {
    if (sala.escalaDeseada !== 86400) await accion(A, 'escala', { valor: 86400 })
    // Las reparaciones ya son procedimientos por pasos: las averías se resuelven como emergencias.
  }
  if (sala.fase === 'llegada' && sala.subfase === 'orbita' && !sala.propuestas.some((p) => p.estado === 'pendiente')) await accion(A, 'ubicacion', { sitioId: { hieloUtopia: 'utopia', vidaJezero: 'jezero' }[sala.escenario] ?? 'gale' })
  if (sala.fase === 'ensamblaje' && meta === 'base') {
    for (const [tarea, fuera] of [['paneles', true], ['carga', true], ['energia', false], ['soporte', false], ['revisionInt', false], ['revisionExt', true]]) {
      if (sala.ensamblaje.hechas[tarea]) continue
      const idA = sesionA.usuario?.id
      if (fuera) console.log(`   (salir: ${(await cruzar(base, codigo, A, idA, 'exterior')) ?? 'ok'})`)
      await accion(A, 'tarea', { tarea })
      if (fuera) console.log(`   (entrar: ${(await cruzar(base, codigo, A, idA, 'nave')) ?? 'ok'})`)
    }
  }
  await esperar(1000)
}
console.log(`Sala ${codigo}: fase ${sala.fase}, ${Math.round(sala.t / 86400)} días de misión.`)
