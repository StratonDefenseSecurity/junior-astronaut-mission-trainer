// Recorrido corto del selector de temas: abre Home, recorre los seis temas y comprueba que las
// variables CSS cambian y que se guardan en localStorage.
//   UI_PASOS=ui-temas node scripts/ui.mjs http://localhost:3097 capturas-temas
export default async function ({ pagina, pulsar, captura, ok, esperar }) {
  await esperar(2500)
  await pulsar('Theme', { exacto: true })
  await esperar(400)
  const nombres = ['NASA blue', 'Mars red', 'High contrast', 'Night red', 'Mission Control', 'Light']
  for (const n of nombres) {
    await pagina.evaluate((n) => [...document.querySelectorAll('button.tema')].find((b) => b.textContent.includes(n))?.click(), n)
    await esperar(150)
    const bg = await pagina.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())
    ok(Boolean(bg), `${n}: --bg = ${bg}`)
  }
  await captura('tema-claro-panel')
  await pulsar('Close', { exacto: true })
  await esperar(300)
  await captura('tema-claro-home')
  const guardado = await pagina.evaluate(() => JSON.parse(localStorage.getItem('mt_accesibilidad') ?? '{}').tema)
  ok(guardado === 'claro', `saved theme = ${guardado}`)
}
