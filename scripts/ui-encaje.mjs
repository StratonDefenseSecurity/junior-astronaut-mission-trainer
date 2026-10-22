// Recorrido corto para comprobar que la interfaz cabe en pantallas pequeñas (1366×768, 1280×720):
// entrada, sala, contextualización y viaje. En cada pantalla anota lo que queda cortado fuera de
// la ventana sin poder desplazarse.
//   UI_PASOS=ui-encaje UI_ANCHO=1366 UI_ALTO=768 node scripts/ui.mjs http://localhost:3083 capturas
const SELECTORES = '.panel, .card, .modal, .estacion, .emergencia, .emergencia-mini, .voto, .transmision, .veredicto, .aviso-linea, .panel-voz'

export default async function ({ pagina, pulsar, captura, ok, esperar, esperarTexto }) {
  const revisar = async (nombre) => {
    const cortados = await pagina.evaluate((sel) => {
      const W = innerWidth
      const H = innerHeight
      const fuera = []
      for (const e of document.querySelectorAll(sel)) {
        if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') continue
        const r = e.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        // ¿Lo puede desplazar algún antecesor (o él mismo)?
        let desplazable = false
        for (let p = e; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowY
          if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) desplazable = true
        }
        const sobraY = Math.round(r.bottom - H)
        const sobraX = Math.round(Math.max(r.right - W, -r.left))
        const interno = e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)
        if ((sobraY > 1 && !desplazable) || sobraX > 1 || (e.scrollHeight > e.clientHeight + 4 && !interno && getComputedStyle(e).overflowY === 'hidden'))
          fuera.push(`${e.className.toString().slice(0, 40)} (abajo +${sobraY}px, lado +${sobraX}px)`)
      }
      return fuera
    }, SELECTORES)
    ok(cortados.length === 0, `${nombre}: nada cortado${cortados.length ? `: ${cortados.join('; ')}` : ''}`)
  }

  await pagina.type('input', 'Tester')
  ok(await pulsar('Start'), 'entra como invitado')
  ok(await esperarTexto(/Single player with bots/), 'pantalla de inicio')
  await revisar('inicio')
  ok(await pulsar('Single player with bots'), 'un jugador con bots')
  ok(await pulsar('Create room with bots'), 'crea la sala')
  ok(await esperarTexto(/\bAI\b/), 'aparecen los bots')
  await pagina.type('input.titulo-mision', 'Ares Dawn')
  await pagina.keyboard.press('Enter')
  await esperar(2500)
  ok(/Connection: (good|slow|poor)/.test(await pagina.evaluate(() => document.body.innerText)), 'la sala muestra la conexión')
  await revisar('sala')
  console.log('  conexión en la sala:', await pagina.$eval('.comprobacion-conexion', (e) => e.textContent).catch(() => '?'))
  await captura('sala')
  ok(await pulsar('Start the mission'), 'empieza')
  ok(await esperarTexto(/Got it: see the roles/), 'contextualización')
  ok(/Ares Dawn/i.test(await pagina.evaluate(() => document.body.innerText)), 'el nombre de la misión llega a la contextualización')
  await revisar('contexto 1')
  await pulsar('Got it: see the roles')
  await esperar(800)
  ok(await pulsar('Mission Commander'), 'comandante')
  ok(await esperarTexto(/Continue: mission objective/), 'objetivo habilitado')
  await revisar('contexto 2')
  await pulsar('Continue: mission objective')
  await esperar(800)
  await revisar('contexto 3')
  await pulsar('Reconnaissance')
  await pulsar('Fast')
  await pulsar('Continue: supplies')
  await esperar(800)
  await pulsar('Bare Minimum')
  await revisar('contexto 4')
  await captura('suministros')
  await pulsar("I'm ready")
  let lanzado = false
  for (let i = 0; i < 40 && !lanzado; i++) {
    await esperar(1500)
    lanzado = await pulsar('Authorize launch')
    if (lanzado) lanzado = await esperarTexto(/T−|T-|Altitude|ALTITUDE/, 4000)
  }
  ok(lanzado, 'lanzamiento')
  ok(await esperarTexto(/CRUISE TO MARS/i, 120000), 'llega al viaje')
  await esperar(3000)
  ok(/Ares Dawn/.test(await pagina.evaluate(() => document.body.innerText)), 'el nombre de la misión en la barra')
  await pulsar('Voice', { exacto: true }) // Solo existe con WebSocket (Cloudflare).
  await revisar('viaje')
  console.log('  conexión en el viaje:', await pagina.$eval('.chip.conexion', (e) => `${e.textContent} ${e.title}`).catch(() => '?'))
  await captura('viaje')
}
