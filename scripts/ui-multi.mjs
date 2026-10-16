// Recorrido multijugador para scripts/ui.mjs (UI_PASOS=ui-multi): dos personas en navegadores
// separados crean y comparten una sala, eligen roles y despegan juntas.
export default async function ({ pagina, ok, esperar, captura }) {
  const segundo = await (await pagina.browser().createBrowserContext()).newPage()
  await segundo.setViewport({ width: 1600, height: 900 })
  const errores = []
  segundo.on('pageerror', (e) => errores.push(e.message))
  segundo.on('response', async (r) => {
    if (!r.url().includes('/api/') || r.status() < 400) return
    console.log(`  respuesta con error para Beto: ${r.status()} ${(await r.text().catch(() => '')).slice(0, 100)}`)
  })
  segundo.on('request', (r) => {
    if (r.url().includes('/api/juego') && r.postData() && !/"op":"estado"/.test(r.postData())) console.log(`  Beto pide: ${r.postData().slice(0, 60)}`)
  })

  const pulsarEn = (p, texto, exacto = false) =>
    p.$$eval(
      'button, summary',
      (els, texto, exacto) => {
        const e = els.find((x) => x.offsetParent !== null && !x.disabled && (exacto ? x.textContent.trim() === texto : x.textContent.includes(texto)))
        if (e) e.click()
        return Boolean(e)
      },
      texto,
      exacto,
    )
  const esperarEn = async (p, re, ms = 20000) => {
    const fin = Date.now() + ms
    while (Date.now() < fin) {
      if (re.test(await p.evaluate(() => document.body.innerText))) return true
      await esperar(400)
    }
    return false
  }
  const entrar = async (p, nombre) => {
    await p.type('input', nombre)
    await pulsarEn(p, 'Empezar', true)
    return esperarEn(p, /Crear sala|Unirse/)
  }

  await segundo.goto(pagina.url(), { waitUntil: 'networkidle0' })
  ok(await entrar(pagina, 'Ana'), 'Ana entra')
  ok(await entrar(segundo, 'Beto'), 'Beto entra en otro navegador')
  ok(await pulsarEn(pagina, 'Multijugador'), 'Ana elige multijugador')
  await esperar(400)
  ok(await pulsarEn(pagina, 'Crear sala', true), 'Ana crea la sala')
  ok(await esperarEn(pagina, /SALA DE TRIPULACIÓN|Sala de tripulación/i), 'Ana está en la sala')
  const codigo = await pagina.evaluate(() => (document.body.innerText.match(/\b[A-HJ-NP-Z2-9]{6}\b/) ?? [''])[0])
  console.log(`  código de sala: ${codigo}`)
  await segundo.type('input', codigo)
  ok(await pulsarEn(segundo, 'Unirse', true), 'Beto escribe el código y se une')
  ok(await esperarEn(segundo, /Ana/) && (await esperarEn(pagina, /Beto/)), 'cada uno ve al otro en la sala')
  await captura('multi-sala')
  ok(await pulsarEn(pagina, 'Empezar la misión'), 'Ana empieza la misión')
  ok(await esperarEn(segundo, /La situación/), 'a Beto también le llega la situación')
  for (const p of [pagina, segundo]) await pulsarEn(p, 'Entendido: ver los roles')
  await esperar(1000)
  ok(await pulsarEn(pagina, 'Comandante de misión'), 'Ana toma el rol de comandante')
  const roles = await segundo.$$eval('button', (els) => els.filter((e) => e.offsetParent).map((e) => `${e.textContent.trim().slice(0, 30)}${e.disabled ? ' (desactivado)' : ''}`))
  console.log('  botones de Beto:', roles.join(' | '))
  await segundo.screenshot({ path: `${process.argv[3] ?? 'ui-capturas'}/multi-beto-roles.png` })
  ok(await pulsarEn(segundo, 'Piloto y navegación'), 'Beto toma el rol de piloto')
  await esperar(1500)
  ok(!(await pulsarEn(segundo, 'Comandante de misión')) || (await esperarEn(segundo, /tomado|Ana/, 3000)), 'el rol de Ana no se puede repetir')
  for (const p of [pagina, segundo]) await pulsarEn(p, 'Continuar: objetivo de la misión')
  await esperar(1000)
  for (const p of [pagina, segundo]) await pulsarEn(p, 'Continuar: suministros')
  await esperar(1000)
  ok(await pulsarEn(pagina, 'Lo mínimo'), 'Ana elige la carga mínima')
  ok(await pulsarEn(segundo, 'Estoy listo'), 'Beto marca listo')
  await esperar(1500)
  await pulsarEn(pagina, 'Estoy listo')
  await esperar(1000)
  ok(await pulsarEn(pagina, 'Autorizar lanzamiento'), 'Ana autoriza el lanzamiento')
  ok(await esperarEn(segundo, /LANZAMIENTO|Lanzamiento/, 15000), 'Beto ve el lanzamiento')
  await esperar(4000)
  await segundo.screenshot({ path: `${process.argv[3] ?? 'ui-capturas'}/multi-beto-lanzamiento.png` })
  ok(errores.length === 0, `sin errores en la página de Beto${errores.length ? `: ${errores[0]}` : ''}`)
}
