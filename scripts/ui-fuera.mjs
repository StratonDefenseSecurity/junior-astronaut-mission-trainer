// Comprobación rápida para scripts/ui.mjs (UI_PASOS=ui-fuera): la vista al salir con el traje.
import fs from 'node:fs'
import { cruzar } from './eva.mjs'
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
  // Por la API, con el procedimiento de la esclusa.
  const r = await cruzar(base, demo.codigo, demo.A.token, demo.A.usuario.id, 'exterior')
  ok(r === null, `sale con el traje${r ? `: ${r}` : ''}`)
  ok(await esperarTexto(/Outside in the suit/i, 10000), 'aparece fuera')
  await esperar(3000)
  await pulsar('Close (M)', { exacto: true })
  await pagina.keyboard.press('KeyH')
  await esperar(4000)
  await captura('fuera-al-salir')
  console.log('  botones:', (await botones()).filter((b) => b.startsWith('E ')).join(','))
}
