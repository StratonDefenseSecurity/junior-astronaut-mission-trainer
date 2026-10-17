// Recorrido de la interfaz que sigue scripts/ui.mjs.
export default async function ({ pagina, pulsar, botones, captura, ok, esperar, esperarTexto, textoPagina, mantenerTecla }) {
  console.log('Entrada')
  await captura('entrada')
  console.log('  botones:', (await botones()).join(' | '))
  await pagina.type('input', 'Jurado')
  ok(await pulsar('Start'), 'entrar como invitado')
  ok(await esperarTexto(/Single player with bots/), 'llega a la pantalla de inicio')
  await captura('inicio')
  console.log('  botones:', (await botones()).join(' | '))
  ok(await pulsar('Where the data comes from'), 'abre las fuentes')
  await captura('fuentes')
  ok(await pulsar('Close', { exacto: true }), 'cierra las fuentes')

  console.log('Sala de un jugador')
  ok(await pulsar('Single player with bots'), 'elige un jugador con bots')
  ok(await pulsar('Create room with bots'), 'crea la sala con bots')
  ok(await esperarTexto(/\bAI\b/), 'aparecen los tripulantes bot')
  await esperar(1500)
  await captura('lobby')
  ok(await pulsar('Water Under the Ice'), 'elige la situación Agua bajo el hielo')
  ok(await pulsar('Curly', { exacto: true }), 'cambia el peinado')
  // Muestras de color: botones sin texto. Se pulsa el cuarto (piel) y el tercero del traje.
  const muestras = await pagina.$$('button:not(:has(*))')
  const vacios = []
  for (const b of muestras) if (!(await b.evaluate((e) => e.textContent.trim()))) vacios.push(b)
  if (vacios[3]) await vacios[3].click()
  if (vacios[14]) await vacios[14].click()
  await esperar(500)
  await pagina.select('select', 'lambayeque').catch(() => {})
  await esperar(800)
  ok((await textoPagina()).includes('Water Under the Ice'), 'la situación queda elegida')
  await captura('lobby-elegido')
  ok(await pulsar('Start the mission'), 'empieza la misión')
  ok(await esperarTexto(/situation|Situation/), 'entra a la contextualización')
  await esperar(1500)
  await captura('contexto-1')
  ok(await pulsar('Where'), 'abre las fuentes de la situación')
  await pulsar('Close', { exacto: true })
  ok(await pulsar('Got it: see the roles'), 'pasa a los roles')
  await esperar(1000)
  ok(await pulsar('Mission Commander'), 'elige ser comandante')
  ok(await esperarTexto(/Continue: mission objective/), 'se habilita el objetivo')
  await esperar(6000)
  await captura('contexto-2')
  ok(await pulsar('Continue: mission objective'), 'pasa al objetivo')
  await esperar(1000)
  await captura('contexto-3')
  await pagina.type('input[placeholder^="For example"]', 'Inti 1')
  await pagina.keyboard.press('Tab')
  await esperar(1200)
  ok(await pulsar('Reconnaissance'), 'elige la misión de reconocimiento')
  ok(await pulsar('Fast'), 'elige la trayectoria rápida')
  await esperar(1000)
  ok(/Inti 1/.test(await pagina.$eval('input[placeholder^="For example"]', (e) => e.value)), 'la misión se llama Inti 1')
  await captura('contexto-3')
  ok(await pulsar('Continue: supplies'), 'pasa a los suministros')
  await esperar(1000)
  await captura('contexto-4')
  ok(await pulsar('Bare Minimum'), 'elige la carga mínima')
  ok(await pulsar('Adjust quantities by hand', { selector: 'summary' }), 'abre el ajuste a mano')
  await esperar(800)
  ok(await pulsar("I'm ready"), 'marca listo')
  ok(await esperarTexto(/Authorize launch/), 'aparece el botón de lanzamiento')
  // Los bots confirman a su ritmo.
  let lanzado = false
  for (let i = 0; i < 40 && !lanzado; i++) {
    await esperar(1500)
    lanzado = await pulsar('Authorize launch')
    if (lanzado) lanzado = await esperarTexto(/T−|T-|Altitude|ALTITUDE/, 4000)
  }
  ok(lanzado, 'el comandante autoriza el lanzamiento')
  await esperar(3000)
  await captura('cuenta-regresiva')
  await esperar(20000)
  await captura('ascenso')

  console.log('Viaje')
  ok(await esperarTexto(/CRUISE TO MARS/i, 90000), 'llega al viaje')
  await esperar(3000)
  console.log('  botones:', (await botones()).join(' | '))
  await captura('viaje')
  ok(await pulsar('Proposals', { exacto: true }), 'pestaña de propuestas')
  ok(await pulsar('Assistant', { exacto: true }), 'pestaña del asistente')
  await pagina.type('input[placeholder="Question or message"]', 'why is my pulse up?')
  await pagina.keyboard.press('Enter')
  ok(await esperarTexto(/beats per minute/, 10000), 'el asistente responde con datos')
  await captura('asistente')
  ok(await pulsar('Mission', { exacto: true }), 'pestaña de misión')
  ok(await pulsar('HD', { exacto: true }), 'cambia a gráficos ligeros')
  ok(await esperarTexto(/Lite/, 3000), 'el botón muestra la calidad ligera')
  await esperar(1500)
  await pulsar('Lite', { exacto: true })
  ok(await pulsar('Sound', { exacto: true }), 'botón de sonido')
  ok(await pulsar('Sources', { exacto: true }), 'abre las fuentes en el juego')
  await captura('fuentes-juego')
  // Hay varios "Cerrar" (mensajes de radio, paneles): se pulsa el de la ventana de fuentes.
  ok(
    await pagina.$$eval('button', (els) => {
      const b = els.find((e) => e.textContent.trim() === 'Close' && e.closest('div')?.parentElement?.textContent.includes('Where the data comes from'))
      b?.click()
      return Boolean(b)
    }),
    'cierra las fuentes',
  )
  await esperar(500)
  ok(!/Where the data comes from/.test(await textoPagina()), 'la ventana de fuentes queda cerrada')
  await pagina.keyboard.press('KeyM')
  ok(await esperarTexto(/Base Dashboard/, 4000), 'la tecla M abre la página principal')
  await captura('pagina-principal')
  console.log('  botones:', (await botones()).join(' | '))
  await pagina.keyboard.press('KeyM')
  await esperar(500)
  await pagina.keyboard.press('KeyH')
  await esperar(800)
  await captura('sin-paneles')
  await pagina.keyboard.press('KeyH')
  await esperar(500)
  ok(await pulsar('Panels', { exacto: true }), 'botón de paneles')
  await pulsar('Panels', { exacto: true })

  /** Lo que haría el comandante: aprobar lo pendiente y decidir las emergencias que le tocan. */
  let aprobadas = 0
  let decididas = 0
  const atender = async () => {
    while (await pulsar('Approve', { exacto: true })) aprobadas += 1
    const elegido = await pagina.$$eval('.emergencia button.opcion', (els) => {
      const b = els.find((e) => !e.disabled)
      if (b) b.click()
      return Boolean(b)
    })
    if (elegido) {
      decididas += 1
      await esperar(500)
    }
  }
  ok(await pulsar('×86,400', { exacto: true }), 'acelera a un día por segundo')
  let fase = ''
  for (let i = 0; i < 400; i++) {
    await esperar(1000)
    await atender()
    const t = await textoPagina()
    if (/MARS ARRIVAL/i.test(t) && !/CRUISE TO MARS/i.test(t)) {
      fase = 'orbita'
      break
    }
    if (i === 60) await captura('viaje-dia-60')
    if (i % 30 === 0) {
      const mem = await pagina.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6))
      console.log(`  memoria a los ${i} s: ${mem} MB`)
    }
  }
  console.log(`  propuestas aprobadas: ${aprobadas}, emergencias decididas: ${decididas}`)
  ok(fase === 'orbita', 'llega a la órbita de Marte')
  await captura('orbita')
  for (let i = 0; i < 150; i++) {
    await esperar(1000)
    await atender()
    if (/entry|descent|parachute|heat/i.test(await textoPagina()) && /km\/h/.test(await textoPagina())) break
  }
  ok(/km\/h/.test(await textoPagina()), 'empieza el descenso')
  for (const s of [3, 12, 12]) {
    await esperar(s * 1000)
    await captura('descenso')
  }
  ok(await esperarTexto(/BASE ASSEMBLY/i, 60000), 'aterriza y empieza el montaje')
  await esperar(2000)
  await captura('base')
  await pulsar('Close (M)', { exacto: true })

  // El montaje por dentro, caminando hasta cada estación, lo recorre scripts/ui-base.mjs.
}
