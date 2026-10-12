// Ayuda de desarrollo: lleva una sala existente hasta una fase, jugando por la API con dos
// cuentas que ya están dentro. Sirve para revisar pantallas avanzadas sin jugar todo el viaje.
//   node scripts/avanzar-sala.mjs <url> <codigo> <usuarioCmd> <usuarioOtro> <clave> [ensamblaje|base]
const [url, codigo, uA, uB, clave, meta = 'base'] = process.argv.slice(2)
if (!url || !codigo || !uA || !uB || !clave) {
  console.error('Uso: node scripts/avanzar-sala.mjs <url> <codigo> <usuarioCmd> <usuarioOtro> <clave> [ensamblaje|base]')
  process.exit(1)
}
const base = url.replace(/\/$/, '')
async function llamar(op, datos = {}, token) {
  const r = await fetch(`${base}/api/juego`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ op, ...datos }),
  })
  return r.json().catch(() => ({}))
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const A = (await llamar('ingresar', { usuario: uA, clave })).token
const B = (await llamar('ingresar', { usuario: uB, clave })).token
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
  if (sala.fase === 'transito') {
    if (sala.escalaDeseada !== 86400) await accion(A, 'escala', { valor: 86400 })
    for (const s of sala.sistemas) if (s.instalado && s.integridad < 50 && sala.rec.repuestos >= 2) await accion(A, 'accion', { id: 'reparar', payload: { sistema: s.id } })
  }
  if (sala.fase === 'llegada' && sala.subfase === 'orbita' && !sala.propuestas.some((p) => p.estado === 'pendiente')) await accion(A, 'ubicacion', { sitioId: 'gale' })
  if (sala.fase === 'ensamblaje' && meta === 'base') {
    for (const [tarea, fuera] of [['paneles', true], ['carga', true], ['energia', false], ['soporte', false], ['revisionInt', false], ['revisionExt', true]]) {
      if (sala.ensamblaje.hechas[tarea]) continue
      if (fuera) await accion(A, 'zona', { zona: 'exterior' })
      await accion(A, 'tarea', { tarea })
      if (fuera) await accion(A, 'zona', { zona: 'nave' })
    }
  }
  await esperar(1000)
}
console.log(`Sala ${codigo}: fase ${sala.fase}, ${Math.round(sala.t / 86400)} días de misión.`)
