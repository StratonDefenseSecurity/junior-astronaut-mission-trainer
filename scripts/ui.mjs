// Prueba de la interfaz con un navegador real (Edge o Chrome sin ventana): juega como una persona,
// pulsa los botones de cada pantalla, toma capturas y anota cualquier error de la página.
//   node scripts/ui.mjs [url] [carpeta de capturas]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const [url = 'http://localhost:3064', carpeta = 'ui-capturas'] = process.argv.slice(2)
const NAVEGADORES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
fs.mkdirSync(carpeta, { recursive: true })

const errores = []
let fallos = 0
const navegador = await puppeteer.launch({
  executablePath: NAVEGADORES.find((r) => fs.existsSync(r)),
  headless: true,
  // Perfil propio y temporal: no toca el del usuario aunque el navegador esté abierto.
  userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mt-ui-')),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1600,900', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 900 },
})
const pagina = await navegador.newPage()
pagina.on('pageerror', (e) => errores.push(`error de página: ${e.message}`))
pagina.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|WebSocket|AudioContext|getUserMedia/.test(m.text())) errores.push(`consola: ${m.text().slice(0, 200)}`)
})
const avisos = []
pagina.on('response', async (r) => {
  if (!r.url().includes('/api/') || r.status() < 400) return
  const t = await r.text().catch(() => '')
  avisos.push(`${r.status()} ${t.slice(0, 120)}`)
})

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
let n = 0
async function captura(nombre) {
  n += 1
  const ruta = path.join(carpeta, `${String(n).padStart(2, '0')}-${nombre}.png`)
  await pagina.screenshot({ path: ruta })
  return ruta
}
const ok = (cond, texto) => {
  if (!cond) fallos += 1
  console.log(`  ${cond ? 'ok  ' : 'FALLA'} ${texto}`)
}

/** Botones visibles con su texto y si están habilitados. */
const botones = () =>
  pagina.$$eval('button, select, input[type=range]', (els) =>
    els
      .filter((e) => e.offsetParent !== null)
      .map((e) => `${e.tagName === 'BUTTON' ? '' : `[${e.tagName.toLowerCase()}] `}${(e.textContent || e.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 50)}${e.disabled ? ' (desactivado)' : ''}`),
  )

/** Pulsa el primer elemento visible cuyo texto contenga `texto`. */
async function pulsar(texto, { selector = 'button', exacto = false } = {}) {
  const hecho = await pagina.$$eval(
    selector,
    (els, texto, exacto) => {
      const e = els.find((x) => {
        if (x.offsetParent === null || x.disabled) return false
        const t = (x.textContent || '').trim().replace(/\s+/g, ' ')
        return exacto ? t === texto : t.includes(texto)
      })
      if (!e) return false
      e.scrollIntoView({ block: 'center' })
      e.click()
      return true
    },
    texto,
    exacto,
  )
  await esperar(500)
  return hecho
}
const textoPagina = () => pagina.evaluate(() => document.body.innerText)
async function esperarTexto(re, ms = 20000) {
  const fin = Date.now() + ms
  while (Date.now() < fin) {
    if (re.test(await textoPagina())) return true
    await esperar(400)
  }
  return false
}
/** Mantiene pulsada una tecla, como se hace en los pasos de "mantener". */
async function mantenerTecla(tecla, ms) {
  await pagina.keyboard.down(tecla)
  await esperar(ms)
  await pagina.keyboard.up(tecla)
}

export const herramientas = { pagina, pulsar, botones, captura, ok, esperar, esperarTexto, textoPagina, mantenerTecla, errores, avisos }

const pasos = (await import(`./${process.env.UI_PASOS ?? 'ui-pasos'}.mjs?${Date.now()}`)).default
try {
  await pagina.goto(url, { waitUntil: 'networkidle0' })
  await pasos(herramientas)
} catch (e) {
  fallos += 1
  console.log(`  FALLA el recorrido se detuvo: ${e.message}`)
  await captura('detenido').catch(() => {})
}
console.log(`\nErrores de la página: ${errores.length}`)
for (const e of [...new Set(errores)].slice(0, 15)) console.log(`  ${e}`)
console.log(`Respuestas con error del servidor: ${avisos.length}`)
for (const a of [...new Set(avisos)].slice(0, 15)) console.log(`  ${a}`)
await navegador.close()
console.log(fallos || errores.length ? `\nUI CON ${fallos} FALLA(S)` : '\nUI OK')
process.exit(fallos || errores.length ? 1 : 0)
