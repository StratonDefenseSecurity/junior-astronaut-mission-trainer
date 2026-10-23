// Recorrido del jurado: entrada con "Play now", inicio, accesibilidad, sala con bots en Cadet y
// misión de demostración, tutorial, lanzamiento, viaje, llegada, montaje, informe y certificado.
// En un segundo contexto del navegador, la vista del profesor mira la misma sala.
//   UI_PASOS=ui-jurado UI_ANCHO=1366 UI_ALTO=768 node scripts/ui.mjs http://localhost:3095 capturas
const SELECTORES = '.panel, .card, .modal, .estacion, .emergencia, .emergencia-mini, .voto, .transmision, .veredicto, .aviso-linea, .panel-voz'

export default async function ({ pagina, pulsar, captura, ok, esperar, esperarTexto, textoPagina, errores }) {
  pagina.on('dialog', (d) => d.accept())
  const revisar = async (nombre) => {
    const cortados = await pagina.evaluate((sel) => {
      const W = innerWidth
      const H = innerHeight
      const fuera = []
      for (const e of document.querySelectorAll(sel)) {
        if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') continue
        const r = e.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        let desplazable = false
        for (let p = e; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowY
          if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) desplazable = true
        }
        const sobraY = Math.round(r.bottom - H)
        const sobraX = Math.round(Math.max(r.right - W, -r.left))
        if ((sobraY > 1 && !desplazable) || sobraX > 1) fuera.push(`${e.className.toString().slice(0, 40)} (abajo +${sobraY}px, lado +${sobraX}px)`)
      }
      return fuera
    }, SELECTORES)
    ok(cortados.length === 0, `${nombre}: nada cortado${cortados.length ? `: ${cortados.join('; ')}` : ''}`)
  }
  /** ¿Se ve el botón entero sin desplazar nada? */
  const visibleSinDesplazar = (texto) =>
    pagina.evaluate((texto) => {
      const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === texto && e.offsetParent !== null)
      if (!b) return 'no está'
      const r = b.getBoundingClientRect()
      return r.top >= 0 && r.bottom <= innerHeight ? 'ok' : `top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)}, ventana ${innerHeight}`
    }, texto)

  console.log('Entrada')
  ok(await pulsar('Play now', { exacto: true }), 'pestaña Play now')
  await pagina.type('input', 'Judge')
  ok(await pulsar('Start', { exacto: true }), 'entra como invitado')
  ok(await esperarTexto(/Single player with bots/), 'pantalla de inicio')
  await esperar(1500)
  const inicio = await textoPagina()
  ok(/leaderboard/i.test(inicio) && !/Could not load the leaderboard/.test(inicio), 'se ve la clasificación')
  ok(/Teacher view/.test(inicio), 'botón de la vista del profesor')
  await revisar('inicio')

  console.log('Accesibilidad')
  ok(await pulsar('Accessibility', { exacto: true }), 'abre accesibilidad')
  const marcar = async (titulo) =>
    pagina.$$eval(
      'label.a11y-opcion',
      (els, titulo) => {
        const l = els.find((e) => e.textContent.includes(titulo))
        l?.querySelector('input')?.click()
        return Boolean(l)
      },
      titulo,
    )
  for (const t of ['Larger text', 'High contrast', 'Reduced motion']) ok(await marcar(t), `activa ${t}`)
  await esperar(600)
  const clases = await pagina.evaluate(() => document.documentElement.className)
  console.log('  clases html:', clases)
  ok(clases.split(/\s+/).filter(Boolean).length >= 3, 'las tres opciones se aplican a la página')
  await captura('accesibilidad')
  await pulsar('Close', { exacto: true })
  await revisar('inicio con texto grande')

  console.log('Sala')
  ok(await pulsar('Single player with bots'), 'un jugador con bots')
  ok(await pulsar('Create room with bots'), 'crea la sala')
  ok(await esperarTexto(/\bAI\b/), 'aparecen los bots')
  await esperar(1500)
  ok(await pulsar('Cadet'), 'elige Cadet')
  ok(await pagina.$eval('.demo-opcion input', (e) => (e.click(), true)).catch(() => false), 'marca la misión de demostración')
  await esperar(1000)
  ok(await pagina.$eval('.demo-opcion input', (e) => e.checked).catch(() => false), 'la demostración queda marcada')
  await pagina.evaluate(() => { scrollTo(0, 0); for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0 })
  await esperar(300)
  const verInicio = await visibleSinDesplazar('Start the mission')
  ok(verInicio === 'ok', `"Start the mission" se ve sin desplazar (${verInicio})`)
  await revisar('sala (texto grande)')
  await captura('sala')
  // Los ajustes siguen activos durante el juego: así se prueban también dentro de la misión.
  ok(await pulsar('Accessibility', { exacto: true }), 'accesibilidad también en la sala')
  await pulsar('Close', { exacto: true })
  ok(await pulsar('Start the mission'), 'empieza')
  ok(await esperarTexto(/Got it: see the roles/), 'contextualización')
  await revisar('contexto 1')
  await pulsar('Got it: see the roles')
  await esperar(800)
  ok(await pulsar('Mission Commander'), 'comandante')
  ok(await esperarTexto(/Continue: mission objective/), 'objetivo habilitado')
  await pulsar('Continue: mission objective')
  await esperar(800)
  await revisar('contexto 3')
  await pulsar('Reconnaissance')
  await pulsar('Fast')
  await pulsar('Continue: supplies')
  await esperar(800)
  await pulsar('Bare Minimum')
  await revisar('contexto 4')
  ok(await pulsar("I'm ready"), 'listo')
  let lanzado = false
  for (let i = 0; i < 40 && !lanzado; i++) {
    await esperar(1500)
    lanzado = await pulsar('Authorize launch')
    if (lanzado) lanzado = await esperarTexto(/T−|T-|Altitude|ALTITUDE/, 4000)
  }
  ok(lanzado, 'lanzamiento')
  ok(await esperarTexto(/CRUISE TO MARS/i, 150000), 'llega al viaje')
  await esperar(3000)

  console.log('Tutorial')
  const enTutorial = () => pagina.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Skip' && b.offsetParent !== null))
  ok(await enTutorial(), 'aparece el tutorial')
  await captura('tutorial')
  ok(await pulsar('Skip', { exacto: true }), 'se salta el tutorial')
  ok(!(await enTutorial()), 'el tutorial se cierra')
  ok(await pagina.$eval('.boton-ayuda', (e) => (e.click(), true)).catch(() => false), 'botón de ayuda')
  await esperar(500)
  ok(await enTutorial(), 'el tutorial se reabre')
  await pulsar('Next', { exacto: true })
  await pulsar('Skip', { exacto: true })
  await revisar('viaje')
  const codigo = (await textoPagina()).match(/room ([A-Z0-9]{6})/)?.[1]
  ok(Boolean(codigo), `código de la sala ${codigo}`)

  console.log('Vista del profesor')
  const contexto = await pagina.browser().createBrowserContext()
  const prof = await contexto.newPage()
  await prof.setViewport(pagina.viewport())
  prof.on('pageerror', (e) => errores.push(`profesor, error de página: ${e.message}`))
  prof.on('console', (m) => m.type() === 'error' && !/favicon|WebSocket|AudioContext/.test(m.text()) && errores.push(`profesor, consola: ${m.text().slice(0, 200)}`))
  prof.on('dialog', (d) => d.accept())
  const pp = async (texto, exacto = false) => {
    const r = await prof.$$eval(
      'button',
      (els, texto, exacto) => {
        const e = els.find((x) => x.offsetParent !== null && !x.disabled && (exacto ? x.textContent.trim() === texto : x.textContent.includes(texto)))
        e?.click()
        return Boolean(e)
      },
      texto,
      exacto,
    )
    await esperar(600)
    return r
  }
  const ptexto = () => prof.evaluate(() => document.body.innerText)
  const pesperar = async (re, ms = 20000) => {
    for (const fin = Date.now() + ms; Date.now() < fin; await esperar(400)) if (re.test(await ptexto())) return true
    return false
  }
  await prof.bringToFront()
  await prof.goto(pagina.url(), { waitUntil: 'domcontentloaded', timeout: 90000 })
  await prof.waitForSelector('input', { timeout: 90000 })
  await prof.type('input', 'Teacher')
  await pp('Start', true)
  ok(await pesperar(/Single player with bots/), 'profesor: inicio')
  await prof.type('input.mono', codigo ?? '')
  ok(await pp('Teacher view'), 'profesor: abre la vista')
  ok(await pesperar(/crew/i, 15000) && (await pesperar(/resources/i, 5000)), 'profesor: ve tripulación y recursos')
  await prof.type('input[placeholder="Message for the crew"]', 'Great work, crew!')
  ok(await pp('Send', true), 'profesor: envía mensaje')
  ok(await pesperar(/Message sent to the crew/, 30000), 'profesor: confirma el envío')
  ok(await pesperar(/Mission Control: Great work, crew!/, 30000), 'profesor: el mensaje queda en el registro')
  ok(await pp('Pause'), 'profesor: pausa')
  ok(await pesperar(/Paused\./, 30000), 'profesor: la sala queda en pausa')
  await prof.screenshot({ path: (await captura('juego-en-pausa')).replace('juego-en-pausa', 'profesor') })
  ok(await pp('Resume mission', true), 'profesor: reanuda')
  ok(await pesperar(/Mission Control resumed the mission/, 30000), 'profesor: la pausa se quita')
  await contexto.close()
  await pagina.bringToFront()
  ok(/Great work, crew!/.test(await textoPagina()) || (await esperarTexto(/Great work, crew!/, 20000)), 'el mensaje se ve en el juego')

  console.log('Viaje')
  let aprobadas = 0
  let decididas = 0
  const atender = async () => {
    while (await pulsar('Approve', { exacto: true })) aprobadas += 1
    const elegido = await pagina.$$eval('.emergencia button.opcion', (els) => {
      const b = els.find((e) => !e.disabled)
      if (b) b.click()
      return Boolean(b)
    })
    if (elegido) decididas += 1
  }
  await pulsar('×86,400', { exacto: true })
  let orbita = false
  for (let i = 0; i < 400 && !orbita; i++) {
    await esperar(1000)
    await atender()
    const t = await textoPagina()
    orbita = /MARS ARRIVAL/i.test(t) && !/CRUISE TO MARS/i.test(t)
  }
  console.log(`  propuestas aprobadas: ${aprobadas}, emergencias decididas: ${decididas}`)
  ok(orbita, 'llega a Marte')
  let base = false
  for (let i = 0; i < 300 && !base; i++) {
    await esperar(1000)
    await atender()
    base = /BASE ASSEMBLY/i.test(await textoPagina())
  }
  ok(base, 'aterriza y empieza el montaje')
  await esperar(2000)
  await pulsar('Close (M)', { exacto: true })
  await revisar('base')
  await captura('base')
  // Los bots montan la base solos; el comandante deja pasar un rato y termina.
  for (let i = 0; i < 90; i++) {
    await esperar(1000)
    await atender()
    if (/Mission debrief/.test(await textoPagina())) break
  }
  if (!/Mission debrief/.test(await textoPagina())) ok(await pulsar('End mission', { exacto: true }), 'el comandante termina la misión')

  console.log('Informe')
  ok(await esperarTexto(/Mission debrief/, 30000), 'aparece el informe')
  await esperar(1500)
  const inf = await textoPagina()
  ok(/Key decisions/i.test(inf), 'decisiones clave')
  ok(/Learning objectives/i.test(inf), 'objetivos de aprendizaje')
  ok(/\d+\s*(\/|of)\s*\d+|points|score/i.test(inf), 'puntuación')
  await revisar('informe')
  await captura('informe')
  const antes = errores.length
  ok(await pulsar('Download the certificate', { exacto: true }), 'descarga el certificado')
  await esperar(3000)
  ok(errores.length === antes, 'el certificado no da errores')
}
