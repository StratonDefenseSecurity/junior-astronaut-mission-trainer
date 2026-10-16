// Diagnóstico para scripts/ui.mjs: fotogramas por segundo y si las teclas mueven al personaje.
import fs from 'node:fs'
export default async function ({ pagina, botones, esperar, esperarTexto, mantenerTecla, captura }) {
  const demo = JSON.parse(fs.readFileSync('scripts/.sala-demo.json', 'utf8'))
  await pagina.evaluate((d) => {
    localStorage.setItem('mt_token', d.A.token)
    localStorage.setItem('mt_usuario', JSON.stringify(d.A.usuario))
    localStorage.setItem('mt_sala', d.codigo)
  }, demo)
  await pagina.reload({ waitUntil: 'networkidle0' })
  await esperarTexto(/MONTAJE DE LA BASE|BASE/, 20000)
  await esperar(3000)
  const fps = await pagina.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2) }; requestAnimationFrame(f) }))
  console.log('  fps:', fps)
  const e = async () => (await botones()).filter((b) => b.startsWith('E ')).join(',')
  console.log('  inicio:', await e())
  for (const t of ['KeyS', 'KeyS', 'KeyS', 'KeyD', 'KeyD', 'KeyS', 'KeyS', 'KeyS', 'KeyS']) {
    await mantenerTecla(t, 1500)
    console.log(`  tras ${t}:`, await e())
  }
  await captura('fps')
}
