// Ayuda de desarrollo: crea dos cuentas de prueba, una sala con la situación indicada y la lleva
// hasta una fase, para revisar escenas avanzadas en el navegador sin jugar todo el viaje.
//   node scripts/sala-demo.mjs <url> [situacion] [transito|llegada|ensamblaje|base]
// Escribe en scripts/.sala-demo.json (fuera de git) las sesiones para abrirlas en el navegador.
import fs from 'node:fs'
import crypto from 'node:crypto'

const [url = 'http://localhost:3001', escenario = 'primeraBase', meta = 'transito'] = process.argv.slice(2)
const base = url.replace(/\/$/, '')
const llamar = async (op, datos = {}, token) => {
  const r = await fetch(`${base}/api/juego`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ op, ...datos }),
  })
  return r.json()
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const sufijo = crypto.randomBytes(3).toString('hex')
const a = await llamar('registro', { usuario: `Luna_${sufijo}`, clave: crypto.randomUUID() })
const b = await llamar('registro', { usuario: `Marco_${sufijo}`, clave: crypto.randomUUID() })
const A = a.token
const B = b.token
let sala = (await llamar('crear', { modo: 'comandante' }, A)).sala
const codigo = sala.codigo
const op = async (quien, nombre, datos = {}) => {
  const d = await llamar(nombre, { codigo, v: sala.version, ...datos }, quien)
  if (d.sala) sala = d.sala
  if (d.error) console.log(`  (${nombre}: ${d.error})`)
  return d
}
await op(B, 'unirse')
await op(A, 'escenario', { escenario })
await op(A, 'traje', { traje: { color: '#3b82f6', acento: '#f5b942', piel: '#b97a4f', pelo: '#1b1410', peinado: 'mono' } })
await op(B, 'traje', { traje: { color: '#f2f4f7', acento: '#e11d48', piel: '#e8b48f', pelo: '#6b4226', peinado: 'rizado' } })
await op(A, 'hogar', { hogar: 'lambayeque' })
await op(B, 'hogar', { hogar: 'lima' })
await op(A, 'iniciar')
await op(A, 'rol', { rol: 'comandante' })
await op(B, 'rol', { rol: 'cientifico' })
await op(A, 'nombre', { nombre: 'Chaski 1' })
await op(A, 'trayectoria', { trayectoria: 'rapida' })
await op(A, 'perfil', { perfil: 'corta' })
await op(A, 'preset', { preset: 'minimo' })
await op(B, 'listo', { listo: true })
await op(A, 'lanzar')
fs.writeFileSync('scripts/.sala-demo.json', JSON.stringify({ codigo, A: { token: A, usuario: a.usuario }, B: { token: B, usuario: b.usuario } }))
console.log(`Sala ${codigo} (${escenario}), llevando hasta ${meta}…`)
const orden = ['lanzamiento', 'transito', 'llegada', 'ensamblaje', 'base']
for (let i = 0; i < 900; i++) {
  await op(i % 2 ? A : B, 'estado', { h: '' })
  if (sala.resultado || orden.indexOf(sala.fase) >= orden.indexOf(meta)) break
  const em = sala.emergencias.find((e) => e.estado === 'activa')
  if (em) await op(A, 'emergencia', { id: em.id, altId: em.alternativas[0].id })
  for (const p of sala.propuestas.filter((x) => x.estado === 'pendiente')) await op(A, 'votar', { id: p.id, aprueba: true })
  if (sala.fase === 'transito' && sala.escalaDeseada !== 86400) await op(A, 'escala', { valor: 86400 })
  if (sala.fase === 'llegada' && sala.subfase === 'orbita' && !sala.propuestas.some((p) => p.estado === 'pendiente'))
    await op(A, 'ubicacion', { sitioId: { hieloUtopia: 'utopia', vidaJezero: 'jezero' }[escenario] ?? 'gale' })
  await esperar(1000)
}
console.log(`Sala ${codigo}: fase ${sala.fase} ${sala.subfase}, día ${Math.round(sala.t / 86400)}.`)
