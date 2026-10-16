// Recorrido de la base para scripts/ui.mjs (UI_PASOS=ui-base): entra a la sala que dejó
// scripts/sala-demo.mjs en el montaje y hace los procedimientos de dentro con la interfaz,
// caminando hasta cada estación con el teclado.
import fs from 'node:fs'

export default async function ({ pagina, pulsar, botones, captura, ok, esperar, esperarTexto, textoPagina, mantenerTecla }) {
  const demo = JSON.parse(fs.readFileSync('scripts/.sala-demo.json', 'utf8'))
  const base = new URL(pagina.url()).origin
  const llamar = async (op, datos, token) => {
    const r = await fetch(`${base}/api/juego`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ op, codigo: demo.codigo, ...datos }) })
    return r.json()
  }
  // Lo de fuera lo hace B por la API, como haría un compañero.
  const fuera = async (proc, n, valor) => {
    const d = await llamar('procedimiento', { proc, paso: n, valor }, demo.B.token)
    if (d.error) console.log(`  (B ${proc} ${n}: ${d.error})`)
  }
  await llamar('zona', { zona: 'exterior' }, demo.B.token)
  await fuera('paneles', 0, 'norte')
  await fuera('paneles', 1, { orden: ['no', 'se', 'ne', 'so'], errores: 0 })
  await fuera('paneles', 2, 6)
  await fuera('paneles', 3, 5)
  await fuera('carga', 0, { orden: ['eslingas', 'guia', 'tensar', 'soltar'], errores: 0 })
  await fuera('carga', 1, 8)
  await llamar('zona', { zona: 'nave' }, demo.B.token)

  await pagina.evaluate((d) => {
    localStorage.setItem('mt_token', d.A.token)
    localStorage.setItem('mt_usuario', JSON.stringify(d.A.usuario))
    localStorage.setItem('mt_sala', d.codigo)
  }, demo)
  await pagina.reload({ waitUntil: 'networkidle0' })
  ok(await esperarTexto(/MONTAJE DE LA BASE/, 20000), 'entra a la base en montaje')
  await esperar(2000)
  await captura('base-dentro')

  // Sin tarjeta gráfica el navegador de prueba va a pocos fotogramas por segundo y el personaje
  // avanza más despacio (cada fotograma mueve como mucho 50 ms): las pulsaciones se alargan.
  const fps = await pagina.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2) }; requestAnimationFrame(f) }))
  const lento = Math.min(8, Math.max(1, 20 / Math.max(1, fps)))
  console.log(`  fotogramas por segundo: ${fps}; pulsaciones ×${lento.toFixed(1)}`)
  const mover = (tecla, ms) => mantenerTecla(tecla, Math.round(ms * lento))

  /** Camina con el teclado por el pasillo, pegado a cada pared, hasta ver el aviso "E <estación>". */
  const cerca = async (nombre) => (await botones()).some((b) => b.startsWith(`E ${nombre}`))
  async function irA(nombre) {
    await pulsar('Cerrar (M)', { exacto: true })
    await pulsar('Cerrar', { exacto: true })
    let llego = await cerca(nombre)
    for (const pared of ['KeyD', 'KeyA']) {
      if (llego) break
      await mover(pared, 900)
      for (const sentido of ['KeyS', 'KeyW']) {
        for (let i = 0; i < 16 && !llego; i++) {
          await mover(sentido, 330)
          llego = await cerca(nombre)
        }
        if (llego) break
      }
    }
    ok(llego, `camina hasta ${nombre}`)
    if (llego) {
      await pagina.keyboard.press('KeyE')
      await esperar(1500)
    }
    return llego
  }

  /** Hace con la interfaz el paso que esté en pantalla. Devuelve false si no hay ninguno. */
  async function hacerPaso() {
    const tipo = await pagina.evaluate(() => {
      const c = document.querySelector('.proc-actual')
      if (!c) return null
      for (const t of ['mantener', 'secuencia', 'ajustar', 'comprobar']) if (c.querySelector(`.proc-${t}`)) return t
      return 'elegir'
    })
    if (!tipo) return false
    const titulo = await pagina.$eval('.proc-actual', (e) => e.innerText.split('\n')[0])
    if (tipo === 'mantener') {
      await pagina.keyboard.down('Space')
      for (let i = 0; i < 50; i++) {
        await esperar(500)
        if ((await pagina.$eval('.proc-actual', (e) => e.innerText.split('\n')[0]).catch(() => '')) !== titulo) break
      }
      await pagina.keyboard.up('Space')
    } else if (tipo === 'secuencia') {
      // Prueba cada elemento hasta dar con el siguiente correcto, como alguien que aprende.
      for (let vuelta = 0; vuelta < 12; vuelta++) {
        const quedan = await pagina.$$('.proc-actual .proc-secuencia button.opcion:not([disabled])')
        if (!quedan.length) break
        let avanzo = false
        for (const b of quedan) {
          const antes = await pagina.$$eval('.proc-actual .proc-secuencia button.activa', (x) => x.length)
          await b.click()
          await esperar(350)
          const despues = await pagina.$$eval('.proc-actual .proc-secuencia button.activa', (x) => x.length).catch(() => -1)
          if (despues < 0 || despues > antes) {
            avanzo = true
            break
          }
        }
        if (!avanzo) break
      }
    } else if (tipo === 'ajustar') {
      await pulsar('Confirmar', { exacto: true })
    } else if (tipo === 'comprobar') {
      await esperar(3500)
      if (!(await pulsar('Pasa', { exacto: true }))) await pulsar('Falla', { exacto: true })
      await esperar(800)
      if ((await pagina.$eval('.proc-actual', (e) => e.innerText.split('\n')[0]).catch(() => '')) === titulo) await pulsar('Falla', { exacto: true })
    } else {
      const opciones = await pagina.$$('.proc-actual button.opcion:not([disabled])')
      for (const b of opciones) {
        await b.click()
        await esperar(700)
        if ((await pagina.$eval('.proc-actual', (e) => e.innerText.split('\n')[0]).catch(() => '')) !== titulo) break
      }
    }
    await esperar(900)
    const despues = await pagina.$eval('.proc-actual', (e) => e.innerText.split('\n')[0]).catch(() => '')
    console.log(`    ${tipo}: ${titulo.slice(0, 60)}${despues === titulo ? ' (sigue igual)' : ''}`)
    return despues !== titulo
  }
  async function procedimiento(nombre) {
    let pasos = 0
    for (let i = 0; i < 12; i++) {
      if (!(await hacerPaso())) break
      pasos += 1
    }
    await captura(`proc-${nombre}`)
    ok(pasos > 0, `${nombre}: ${pasos} paso(s) hechos con la interfaz`)
  }

  // Desde el puesto del comandante: a la derecha hasta la pared y hacia atrás hasta Energía.
  if (await irA('Energía')) {
    await captura('estacion-energia')
    console.log('  botones:', (await botones()).join(' | '))
    await procedimiento('energia')
    await pulsar('Cerrar', { exacto: true })
  }
  if (await irA('Soporte vital')) await procedimiento('soporte')
  await pulsar('Cerrar', { exacto: true })
  ok(await esperarTexto(/paso 3 de 3|Comprobar las instalaciones/, 15000), 'el montaje pasa a comprobar las instalaciones')
  if (await irA('Esclusa')) await procedimiento('esclusa')
  await pulsar('Cerrar', { exacto: true })

  console.log('Exterior')
  if (await irA('Esclusa')) {
    ok(await pulsar('Ponerme el traje y salir'), 'se pone el traje y sale')
    ok(await esperarTexto(/Fuera, con el traje|con el traje/, 10000), 'aparece fuera, con el traje')
    await esperar(4000)
    await captura('exterior')
    console.log('  botones:', (await botones()).join(' | '))
    for (let i = 0; i < 10 && !(await cerca('Esclusa')); i++) await mover(i % 2 ? 'KeyW' : 'KeyS', 250)
    if (await cerca('Esclusa')) {
      await pagina.keyboard.press('KeyE')
      await esperar(1200)
      console.log('  botones esclusa fuera:', (await botones()).join(' | '))
      ok(await pulsar('Entrar'), 'vuelve a entrar al hábitat')
      await esperar(2500)
      await captura('de-vuelta')
    } else ok(false, 'encuentra la esclusa desde fuera')
  }
}
