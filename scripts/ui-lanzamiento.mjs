// Recorrido corto para scripts/ui.mjs: entra, arma una misión con bots y sigue solo el lanzamiento,
// con capturas en los momentos reales del ascenso de Artemis I. Termina al empezar el crucero.
//   UI_PASOS=ui-lanzamiento node scripts/ui.mjs http://localhost:3072 ui-capturas/lanzamiento
export default async function ({ pagina, pulsar, captura, ok, esperar, esperarTexto, textoPagina }) {
  await pagina.type('input', 'Jurado')
  ok(await pulsar('Start'), 'entrar como invitado')
  ok(await esperarTexto(/Single player with bots/), 'llega a la pantalla de inicio')
  ok(await pulsar('Single player with bots'), 'elige un jugador con bots')
  ok(await pulsar('Create room with bots'), 'crea la sala con bots')
  ok(await esperarTexto(/\bAI\b/), 'aparecen los tripulantes bot')
  await esperar(1500)
  ok(await pulsar(process.env.UI_SITUACION ?? 'Water Under the Ice'), 'elige la situación')
  await esperar(800)
  ok(await pulsar('Start the mission'), 'empieza la misión')
  ok(await esperarTexto(/situation|Situation/), 'entra a la contextualización')
  await esperar(1000)
  ok(await pulsar('Got it: see the roles'), 'pasa a los roles')
  await esperar(1000)
  ok(await pulsar('Mission Commander'), 'elige ser comandante')
  ok(await esperarTexto(/Continue: mission objective/), 'se habilita el objetivo')
  await esperar(6000)
  ok(await pulsar('Continue: mission objective'), 'pasa al objetivo')
  await esperar(1000)
  await pagina.type('input[placeholder^="For example"]', 'Inti 1')
  await pagina.keyboard.press('Tab')
  await esperar(1200)
  ok(await pulsar('Reconnaissance'), 'elige la misión de reconocimiento')
  ok(await pulsar('Fast'), 'elige la trayectoria rápida')
  await esperar(1000)
  ok(await pulsar('Continue: supplies'), 'pasa a los suministros')
  await esperar(1000)
  ok(await pulsar('Bare Minimum'), 'elige la carga mínima')
  await esperar(500)
  ok(await pulsar("I'm ready"), 'marca listo')
  ok(await esperarTexto(/Authorize launch/), 'aparece el botón de lanzamiento')
  let lanzado = false
  for (let i = 0; i < 40 && !lanzado; i++) {
    await esperar(1500)
    lanzado = await pulsar('Authorize launch')
    if (lanzado) lanzado = await esperarTexto(/T−|T-|Altitude|ALTITUDE/, 4000)
  }
  ok(lanzado, 'el comandante autoriza el lanzamiento')

  // Momentos (s desde el despegue; negativos en la cuenta regresiva) en que se toma una captura.
  const momentos = (process.env.UI_MOMENTOS ?? '-11,-5,1,6,12,25,40,55,70,100,126,134,142,160,203,208,214,230,320,470,498,506,516,530,548')
    .split(',')
    .map(Number)
  const hechos = new Set()
  const fin = Date.now() + 180000
  const llamadas = new Set()
  const etapas = new Set()
  while (Date.now() < fin) {
    const texto = await textoPagina()
    if (/CRUISE TO MARS/i.test(texto)) break
    const cuenta = texto.match(/T−(\d+) · Liftoff in/)
    const vuelo = texto.match(/(\d+) min (\d+) s/)
    const t = cuenta ? -Number(cuenta[1]) : vuelo ? Number(vuelo[1]) * 60 + Number(vuelo[2]) : null
    const llamada = texto.match(/“([^”]+)”/)
    if (llamada) llamadas.add(llamada[1])
    const etapa = texto.match(/\n([A-Za-z +]+)\n(?:“|Next:)/)
    if (etapa) etapas.add(etapa[1].trim())
    if (t !== null) {
      const pendiente = momentos.find((m) => !hechos.has(m) && t >= m)
      if (pendiente !== undefined) {
        for (const m of momentos) if (m <= t) hechos.add(m)
        const linea = texto.split('\n').filter((l) => /ALTITUDE|SPEED|ACCELERATION|km|g$/i.test(l)).slice(0, 8).join(' ')
        console.log(`  t=${t} s: ${linea.replace(/\s+/g, ' ').slice(0, 160)}`)
        await captura(`t${t < 0 ? 'm' + -t : String(t).padStart(3, '0')}`)
      }
    }
    await esperar(120)
  }
  console.log('  llamadas vistas:', [...llamadas].join(' | '))
  console.log('  etapas vistas:', [...etapas].join(' | '))
  ok(llamadas.has('Booster ignition, umbilical separation and liftoff'), 'se ve la llamada real del despegue')
  ok(await esperarTexto(/CRUISE TO MARS/i, 60000), 'llega al viaje')
  await esperar(2500)
  await captura('viaje')
}
