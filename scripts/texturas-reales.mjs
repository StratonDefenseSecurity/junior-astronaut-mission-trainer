// Descarga las imágenes de NASA y USGS de la Tierra, la Luna y Marte y las convierte en texturas
// para la web en public/texturas/ (Vite las copia tal cual a dist/). Escribe además
// src/mundo/planetas/texturasReales.json con lo que hay, para que el cliente sepa qué pedir
// sin probar archivos que no existen. Créditos y fuentes: public/texturas/CREDITOS.md.
//
// Uso:
//   node scripts/texturas-reales.mjs                 Tierra y Luna
//   node scripts/texturas-reales.mjs --sondear-marte solo lee los encabezados de los mosaicos de Marte
//   node scripts/texturas-reales.mjs --marte         además Marte, leyendo filas sueltas por rangos HTTP
//
// Las descargas son datos ajenos: van a su propia carpeta (.cache/texturas-reales/descargas,
// fuera de git) y solo se leen como imágenes, nunca se ejecutan.
//
// Los mosaicos de Marte de USGS (Viking MDIM2.1 en color, 12.7 GB, y el MDE de MOLA, 2.1 GB) no son
// Cloud-Optimized GeoTIFF: no tienen vistas reducidas y guardan una fila por bloque sin comprimir.
// Para reducirlos hay que leer filas enteras: con --marte se baja solo una fila de cada N, pero
// igual son cientos de MB (el script lo calcula y lo muestra antes de empezar).
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { fromArrayBuffer, fromUrl } from 'geotiff'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dirDescargas = resolve(raiz, '.cache/texturas-reales/descargas')
const dirSalida = resolve(raiz, 'public/texturas')
const manifiesto = resolve(raiz, 'src/mundo/planetas/texturasReales.json')
const args = new Set(process.argv.slice(2))

/** Archivos aprobados. Ningún otro se descarga. */
const FUENTES = {
  tierraDia: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg',
  tierraNoche: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg',
  tierraNubes: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg',
  lunaColor: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_2k.tif',
  lunaAltura: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif',
  // Redirigen a asc-pds-services.s3.us-west-2.amazonaws.com; se leen por rangos, nunca enteros.
  marteColor: 'https://planetarymaps.usgs.gov/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif',
  marteAltura: 'https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif',
}

const mb = (b) => `${(b / 1048576).toFixed(2)} MB`

async function descargar(clave) {
  const url = FUENTES[clave]
  const destino = resolve(dirDescargas, url.split('/').pop())
  if (existsSync(destino) && statSync(destino).size > 0) return destino
  mkdirSync(dirDescargas, { recursive: true })
  process.stdout.write(`Descargando ${url} ... `)
  const r = await fetch(url)
  if (!r.ok || !r.body) throw new Error(`${url}: HTTP ${r.status}`)
  const largo = Number(r.headers.get('content-length') || 0)
  // Tope de seguridad: ninguna de las imágenes aprobadas pasa de 10 MB.
  if (largo > 10 * 1048576) throw new Error(`${url}: ${mb(largo)}, más de lo esperado`)
  await pipeline(Readable.fromWeb(r.body), createWriteStream(destino))
  console.log(mb(statSync(destino).size))
  return destino
}

const reporte = []
async function guardar(nombre, imagen) {
  const ruta = resolve(dirSalida, nombre)
  const info = await imagen.toFile(ruta)
  reporte.push([nombre, info.width, info.height, statSync(ruta).size])
  return { archivo: `texturas/${nombre}`, ancho: info.width, alto: info.height }
}

const JPG = { quality: 86, mozjpeg: true, chromaSubsampling: '4:2:0' }
// Pendientes en R y G: sin submuestreo de color, para que un canal no se mezcle con el otro.
const JPG_RELIEVE = { quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' }

// ----------------------------------------------------------------------- relieve

/**
 * Pendientes este y norte de un modelo de elevación equirectangular (fila 0 = norte, columna 0 =
 * longitud -180°), en metros por metro. Se guardan como 128 + pendiente × k en R y G.
 * `alturas` en metros, `radio` del cuerpo en metros.
 */
function pendientesRG(alturas, ancho, alto, radio, k) {
  const salida = Buffer.alloc(ancho * alto * 3)
  const dx = ((2 * Math.PI) / ancho) * radio
  const dy = (Math.PI / alto) * radio
  let saturados = 0
  for (let j = 0; j < alto; j++) {
    const lat = 90 - ((j + 0.5) * 180) / alto
    const cl = Math.max(0.02, Math.cos((lat * Math.PI) / 180))
    const jN = Math.max(0, j - 1)
    const jS = Math.min(alto - 1, j + 1)
    for (let i = 0; i < ancho; i++) {
      const e = alturas[j * ancho + ((i + 1) % ancho)]
      const o = alturas[j * ancho + ((i - 1 + ancho) % ancho)]
      const gx = (e - o) / (2 * dx * cl)
      const gy = (alturas[jN * ancho + i] - alturas[jS * ancho + i]) / ((jS - jN) * dy)
      const r = 128 + gx * k
      const g = 128 + gy * k
      if (r < 0 || r > 255 || g < 0 || g > 255) saturados++
      const p = (j * ancho + i) * 3
      salida[p] = Math.max(0, Math.min(255, Math.round(r)))
      salida[p + 1] = Math.max(0, Math.min(255, Math.round(g)))
      salida[p + 2] = 128
    }
  }
  return { datos: salida, saturados: saturados / (ancho * alto) }
}

// ------------------------------------------------------------------------- Tierra

async function tierra() {
  const dia = await descargar('tierraDia')
  const noche = await descargar('tierraNoche')
  const nubes = await descargar('tierraNubes')
  const W = 4096
  const H = 2048

  // Agua: las costas de Natural Earth 1:50 millones (las mismas del globo procedural), con el
  // rasterizador del cliente. Sale con la fila 0 en el polo sur; las imágenes van con el norte arriba.
  const { rasterizarPoligonos } = await import('../src/mundo/planetas/rasterizar.ts')
  const { feature } = await import('topojson-client')
  const topo = JSON.parse(readFileSync(resolve(raiz, 'node_modules/world-atlas/land-50m.json'), 'utf8'))
  const poligonos = feature(topo, topo.objects.land).features.flatMap((f) => f.geometry.coordinates)
  const MW = W / 2
  const MH = H / 2
  const tierraFirme = rasterizarPoligonos(poligonos, MW, MH, 4)
  const agua = Buffer.alloc(MW * MH)
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) agua[j * MW + i] = Math.round(255 * (1 - tierraFirme[(MH - 1 - j) * MW + i]))

  // Océano: la batimetría del mosaico (fondos claros sobre la plataforma y estrías de los
  // sondeos) no se ve así desde órbita, donde el mar abierto es azul marino oscuro. Se acerca el
  // agua a ese tono y se deja algo del turquesa de las aguas muy someras (Bahamas, arrecifes).
  const { data: px } = await sharp(dia).resize(W, H, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const MARINO = [6, 18, 42]
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const a = agua[(j >> 1) * MW + (i >> 1)] / 255
      if (a <= 0) continue
      const p = (j * W + i) * 3
      const claro = (px[p] + px[p + 1] + px[p + 2]) / 765
      const somero = Math.min(1, Math.max(0, (claro - 0.38) / 0.25))
      const f = a * (0.85 - 0.5 * somero)
      px[p] = Math.round(px[p] * (1 - f) + MARINO[0] * f)
      px[p + 1] = Math.round(px[p + 1] * (1 - f) + MARINO[1] * f)
      px[p + 2] = Math.round(px[p + 2] * (1 - f) + MARINO[2] * f)
    }
  }
  const salidas = {}
  salidas.dia = await guardar('tierra-dia.jpg', sharp(px, { raw: { width: W, height: H, channels: 3 } }).jpeg(JPG))
  salidas.agua = await guardar('tierra-agua.png', sharp(agua, { raw: { width: MW, height: MH, channels: 1 } }).toColourspace('b-w').png({ compressionLevel: 9 }))

  // Luces de noche: Black Marble 2016 viene en color (luces sobre un fondo oscuro con el relieve
  // apenas visible, y el hielo de Groenlandia y la Antártida en gris, entre 50 y 60). Se guarda la
  // luminancia y el tinte se pone en el shader; se recorta ese fondo para que el suelo no brille.
  const { data: ln, info: iln } = await sharp(noche).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < ln.length; i++) ln[i] = Math.round(255 * Math.pow(Math.max(0, ln[i] - 62) / 193, 1.2))
  salidas.noche = await guardar('tierra-noche.jpg', sharp(ln, { raw: { width: iln.width, height: iln.height, channels: 1 } }).toColourspace('b-w').jpeg({ ...JPG, quality: 80 }))

  // Nubes: composición de varios satélites (2048 × 1024). Opacidad = brillo, con un poco más de
  // contraste para que la bruma tenue no vele todo el océano.
  const { data: nb, info: inb } = await sharp(nubes).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < nb.length; i++) {
    const x = Math.min(1, Math.max(0, (nb[i] / 255 - 0.1) / 0.8))
    nb[i] = Math.round(255 * x * x * (3 - 2 * x))
  }
  salidas.nubes = await guardar('tierra-nubes.jpg', sharp(nb, { raw: { width: inb.width, height: inb.height, channels: 1 } }).toColourspace('b-w').jpeg({ ...JPG, quality: 82 }))
  return salidas
}

// --------------------------------------------------------------------------- Luna

async function luna() {
  const color = await descargar('lunaColor')
  const altura = await descargar('lunaAltura')
  const salidas = {}
  salidas.color = await guardar('luna-color.jpg', sharp(color).removeAlpha().toColourspace('srgb').jpeg(JPG))

  // LOLA: alturas en km sobre la esfera de 1737.4 km, 4 píxeles por grado.
  const buf = readFileSync(altura)
  const tif = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const im = await tif.getImage()
  const [h] = await im.readRasters()
  const w = im.getWidth()
  const a = im.getHeight()
  const metros = new Float32Array(w * a)
  for (let i = 0; i < metros.length; i++) metros[i] = h[i] * 1000
  const K = 300
  const { datos, saturados } = pendientesRG(metros, w, a, 1737400, K)
  console.log(`Luna: ${w}×${a}, pendientes fuera de rango ${(saturados * 100).toFixed(2)}%`)
  salidas.relieve = await guardar('luna-relieve.jpg', sharp(datos, { raw: { width: w, height: a, channels: 3 } }).jpeg(JPG_RELIEVE))
  salidas.relieve.k = K
  return salidas
}

// -------------------------------------------------------------------------- Marte

async function abrirMarte() {
  const color = await fromUrl(FUENTES.marteColor, { allowFullFile: false })
  const altura = await fromUrl(FUENTES.marteAltura, { allowFullFile: false })
  return { color: await color.getImage(), altura: await altura.getImage(), cantidad: [await color.getImageCount(), await altura.getImageCount()] }
}

/** Bytes de una fila entera de un GeoTIFF con filas sin comprimir. */
const bytesFila = (im) => (im.getWidth() * im.getSamplesPerPixel() * im.getBitsPerSample()) / 8

async function marte(sondear) {
  const ANCHO_COLOR = 2048
  const ANCHO_ALTURA = 1440
  const { color, altura, cantidad } = await abrirMarte()
  const filasColor = ANCHO_COLOR / 2
  const filasAltura = ANCHO_ALTURA / 2
  const costo = filasColor * bytesFila(color) + filasAltura * bytesFila(altura)
  console.log(`Viking MDIM2.1: ${color.getWidth()}×${color.getHeight()}, ${cantidad[0]} imagen(es), compresión ${color.fileDirectory.Compression}, filas por bloque ${color.fileDirectory.RowsPerStrip ?? color.getTileHeight()}`)
  console.log(`MOLA MDE:       ${altura.getWidth()}×${altura.getHeight()}, ${cantidad[1]} imagen(es), compresión ${altura.fileDirectory.Compression}, filas por bloque ${altura.fileDirectory.RowsPerStrip ?? altura.getTileHeight()}`)
  console.log(`Leer ${filasColor} filas de color y ${filasAltura} de altura cuesta ${mb(costo)} de descarga.`)
  if (sondear) return null

  const leerFilas = async (im, filas, ancho, canales) => {
    const W = im.getWidth()
    const Hs = im.getHeight()
    const paso = W / ancho
    const salida = new Float32Array(ancho * filas * canales)
    for (let j = 0; j < filas; j++) {
      const y = Math.min(Hs - 1, Math.floor(((j + 0.5) * Hs) / filas))
      const bandas = await im.readRasters({ window: [0, y, W, y + 1] })
      // Promedio de cada tramo de la fila (caja horizontal).
      for (let i = 0; i < ancho; i++) {
        const x0 = Math.floor(i * paso)
        const x1 = Math.floor((i + 1) * paso)
        for (let c = 0; c < canales; c++) {
          let s = 0
          let n = 0
          for (let x = x0; x < x1; x++) {
            const v = bandas[c][x]
            if (v === -32768) continue
            s += v
            n++
          }
          salida[(j * ancho + i) * canales + c] = n ? s / n : 0
        }
      }
      if (j % 64 === 0) process.stdout.write(`\r  fila ${j + 1} de ${filas}`)
    }
    console.log()
    return salida
  }

  const salidas = {}
  const c = await leerFilas(color, filasColor, ANCHO_COLOR, 3)
  const rgb = Buffer.alloc(c.length)
  for (let i = 0; i < c.length; i++) rgb[i] = Math.max(0, Math.min(255, Math.round(c[i])))
  salidas.color = await guardar('marte-color.jpg', sharp(rgb, { raw: { width: ANCHO_COLOR, height: filasColor, channels: 3 } }).jpeg(JPG))
  const h = await leerFilas(altura, filasAltura, ANCHO_ALTURA, 1)
  const K = 300
  const { datos, saturados } = pendientesRG(h, ANCHO_ALTURA, filasAltura, 3396190, K)
  console.log(`Marte: pendientes fuera de rango ${(saturados * 100).toFixed(2)}%`)
  salidas.relieve = await guardar('marte-relieve.jpg', sharp(datos, { raw: { width: ANCHO_ALTURA, height: filasAltura, channels: 3 } }).jpeg(JPG_RELIEVE))
  salidas.relieve.k = K
  return salidas
}

// ----------------------------------------------------------------------------------

mkdirSync(dirSalida, { recursive: true })
const previo = existsSync(manifiesto) ? JSON.parse(readFileSync(manifiesto, 'utf8')) : {}

if (args.has('--sondear-marte')) {
  await marte(true)
  process.exit(0)
}

const salida = { ...previo }
salida.tierra = await tierra()
salida.luna = await luna()
if (args.has('--marte')) salida.marte = await marte(false)
writeFileSync(manifiesto, JSON.stringify(salida, null, 2) + '\n')

let total = 0
for (const [n, w, h, b] of reporte) {
  total += b
  console.log(`${n.padEnd(20)} ${String(w).padStart(5)}×${String(h).padEnd(5)} ${mb(b)}`)
}
console.log(`Total ${mb(total)}`)
