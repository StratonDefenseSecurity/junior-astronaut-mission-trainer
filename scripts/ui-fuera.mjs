// Comprobación rápida para scripts/ui.mjs (UI_PASOS=ui-fuera): la vista al salir con el traje.
import fs from 'node:fs'
export default async function ({ pagina, ok, esperar, esperarTexto, captura, botones, pulsar }) {
  const demo = JSON.parse(fs.readFileSync('scripts/.sala-demo.json', 'utf8'))
  const base = new URL(pagina.url()).origin
  await pagina.evaluate((d) => {
    localStorage.setItem('mt_token', d.A.token)
    localStorage.setItem('mt_usuario', JSON.stringify(d.A.usuario))
    localStorage.setItem('mt_sala', d.codigo)
  }, demo)
  await pagina.reload({ waitUntil: 'networkidle0' })
  ok(await esperarTexto(/BASE/, 20000), 'entra a la base')
  await esperar(2000)
  const r = await pagina.evaluate(async ({ base, d }) => {
    const x = await fetch(`${base}/api/juego`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${d.A.token}` }, body: JSON.stringify({ op: 'zona', codigo: d.codigo, zona: 'exterior' }) })
    return x.status
  }, { base, d: demo })
  ok(r === 200, 'sale con el traje')
  ok(await esperarTexto(/Outside in the suit/i, 10000), 'aparece fuera')
  await esperar(3000)
  await pulsar('Close (M)', { exacto: true })
  await pagina.keyboard.press('KeyH')
  await esperar(4000)
  await captura('fuera-al-salir')
  console.log('  botones:', (await botones()).filter((b) => b.startsWith('E ')).join(','))
}
