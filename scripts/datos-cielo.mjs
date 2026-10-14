// Genera src/mundo/cielo/datos.ts a partir de los datos de d3-celestial (solo en tiempo de
// compilación: el cliente nunca importa d3-celestial). Uso:  node scripts/datos-cielo.mjs
//
// Qué sale y de dónde:
//  - Estrellas hasta magnitud 6.0 (stars.6.json): XHIP, An Extended Hipparcos Compilation
//    (Anderson y Francis 2012, VizieR V/137D). AR/Dec J2000 en grados, magnitud V e índice B-V.
//  - Nombres propios en español de ~30 estrellas famosas (starnames.json trae el campo "es" solo
//    para algunas; para el resto se usa la forma española de uso común del mismo nombre).
//  - Líneas de las 88 constelaciones IAU y posición de su nombre (constellations.lines.json,
//    constellations.json); los nombres en español vienen del propio archivo.
//  - Vía Láctea: contornos en 5 niveles de brillo del Milky Way Outline Catalog (Jose R. Vieira,
//    mw.json), rasterizados aquí a una grilla en coordenadas galácticas de 0.5°.
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dirDatos = resolve(raiz, 'node_modules/d3-celestial/data')
const leer = (n) => JSON.parse(readFileSync(resolve(dirDatos, n), 'utf8'))
const salida = resolve(raiz, 'src/mundo/cielo/datos.ts')

const MAG_LIMITE = 6.0

// ---------------------------------------------------------------- estrellas
const estrellas = leer('stars.6.json').features
  .filter((f) => f.properties.mag <= MAG_LIMITE)
  // Las brillantes primero: así el índice de las estrellas con nombre es corto y estable.
  .sort((a, b) => a.properties.mag - b.properties.mag)

const ra360 = (lon) => ((lon % 360) + 360) % 360
const red = (x, d) => Number(x.toFixed(d))

const plano = []
const indicePorHip = new Map()
let sinBV = 0
estrellas.forEach((f, i) => {
  const [lon, lat] = f.geometry.coordinates
  const bvTexto = f.properties.bv
  const bv = bvTexto === '' || bvTexto == null || Number.isNaN(Number(bvTexto)) ? null : red(Number(bvTexto), 3)
  if (bv === null) sinBV++
  plano.push(red(ra360(lon), 4), red(lat, 4), red(f.properties.mag, 2), bv)
  indicePorHip.set(Number(f.id), i)
})

// ------------------------------------------------------- nombres de estrellas
// HIP -> [nombre esperado en el catálogo (para comprobar que el HIP es el correcto), nombre en español].
// El español es la forma de uso común del mismo nombre propio; no se inventa ninguna estrella.
const NOMBRES = [
  [32349, 'Sirius', 'Sirio'],
  [30438, 'Canopus', 'Canopus'],
  [69673, 'Arcturus', 'Arturo'],
  [71683, 'Rigil Kentaurus', 'Alfa Centauri'],
  [91262, 'Vega', 'Vega'],
  [24608, 'Capella', 'Capella'],
  [24436, 'Rigel', 'Rigel'],
  [37279, 'Procyon', 'Proción'],
  [7588, 'Achernar', 'Achernar'],
  [27989, 'Betelgeuse', 'Betelgeuse'],
  [68702, 'Hadar', 'Hadar'],
  [97649, 'Altair', 'Altair'],
  [60718, 'Acrux', 'Ácrux'],
  [21421, 'Aldebaran', 'Aldebarán'],
  [65474, 'Spica', 'Espiga'],
  [80763, 'Antares', 'Antares'],
  [37826, 'Pollux', 'Pólux'],
  [113368, 'Fomalhaut', 'Fomalhaut'],
  [62434, 'Mimosa', 'Mimosa'],
  [102098, 'Deneb', 'Deneb'],
  [49669, 'Regulus', 'Régulo'],
  [36850, 'Castor', 'Cástor'],
  [61084, 'Gacrux', 'Gacrux'],
  [85927, 'Shaula', 'Shaula'],
  [25336, 'Bellatrix', 'Bellatrix'],
  [11767, 'Polaris', 'Estrella Polar'],
  [26311, 'Alnilam', 'Alnilam'],
  [26727, 'Alnitak', 'Alnitak'],
  [25930, 'Mintaka', 'Mintaka'],
]
const starnames = leer('starnames.json')
const conNombre = NOMBRES.map(([hip, ingles, es]) => {
  const n = starnames[hip]
  if (!n || n.name !== ingles) throw new Error(`HIP ${hip}: se esperaba ${ingles}, el catálogo dice ${n && n.name}`)
  const indice = indicePorHip.get(hip)
  if (indice === undefined) throw new Error(`HIP ${hip} (${ingles}) no está en stars.6.json`)
  // Si el catálogo trae el nombre español, se usa ese (salvo Alfa Centauri, que nombra al par).
  const nombre = n.es && hip !== 71683 ? n.es : es
  return { hip, nombre, indice }
})

// ------------------------------------------------------------- constelaciones
// Selección de constelaciones famosas que muestran su nombre. Para cinco se usa la forma
// española más común en astronomía (equivalente a la del archivo: Escorpión, Toro, Gemelos,
// León, Perro Mayor).
const FAMOSAS = {
  Ori: null, Cru: null, Sco: 'Escorpio', UMa: null, Cas: null, Leo: 'Leo', Tau: 'Tauro',
  Gem: 'Géminis', CMa: 'Can Mayor', Cen: null, Sgr: null, Lyr: null, Cyg: null, Aql: null,
}
const info = new Map()
for (const f of leer('constellations.json').features) {
  if (!info.has(f.id)) info.set(f.id, { nombre: f.properties.es || f.properties.name, etiqueta: f.geometry.coordinates })
}
const lineas = new Map()
for (const f of leer('constellations.lines.json').features) {
  const l = lineas.get(f.id) ?? []
  for (const tramo of f.geometry.coordinates) l.push(tramo.flatMap(([lon, lat]) => [red(ra360(lon), 3), red(lat, 3)]))
  lineas.set(f.id, l)
}
const constelaciones = [...lineas.keys()].map((id) => {
  const i = info.get(id)
  if (!i) throw new Error(`Constelación ${id} sin nombre`)
  const famosa = id in FAMOSAS
  return {
    id,
    nombre: (famosa && FAMOSAS[id]) || i.nombre,
    famosa,
    etiqueta: [red(ra360(i.etiqueta[0]), 2), red(i.etiqueta[1], 2)],
    lineas: lineas.get(id),
  }
})
if (constelaciones.length !== 88) throw new Error(`Se esperaban 88 constelaciones, hay ${constelaciones.length}`)

// ---------------------------------------------------------------- Vía Láctea
// Matriz ICRS/J2000 -> galácticas (Hipparcos, vol. 1, sección 1.5.3, ec. 1.5.11).
const GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [+0.4941094279, -0.4448296300, +0.7469822445],
  [-0.8676661490, -0.1980763734, +0.4559837762],
]
const D2R = Math.PI / 180
function radecAGal(raGrados, decGrados) {
  const a = raGrados * D2R
  const d = decGrados * D2R
  const v = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]
  const g = GAL.map((f) => f[0] * v[0] + f[1] * v[1] + f[2] * v[2])
  return [ra360(Math.atan2(g[1], g[0]) / D2R), Math.asin(Math.max(-1, Math.min(1, g[2]))) / D2R]
}
// Comprobación de la matriz: el centro galáctico (l=0, b=0) está en AR 266.405°, Dec -28.936°.
{
  const [l, b] = radecAGal(266.405, -28.936)
  if (Math.min(l, 360 - l) > 0.01 || Math.abs(b) > 0.01) throw new Error(`Matriz galáctica mal: l=${l} b=${b}`)
}

const PASO = 0.5 // grados por celda
const ANCHO = 360 / PASO
const ALTO = 180 / PASO
const envolver = (x) => ((((x + 180) % 360) + 360) % 360) - 180
const niveles = new Uint8Array(ANCHO * ALTO)
for (const f of leer('mw.json').features) {
  // Aristas del contorno en coordenadas galácticas. Son cortas (< 1°), así que tratarlas como
  // rectas en (l, b) es buena aproximación; el polo galáctico norte queda fuera de todo
  // contorno, así que contar cruces de un rayo hacia el polo (regla par/impar) da el interior,
  // incluso con agujeros y anillos que dan la vuelta al cielo.
  const aristas = []
  for (const poligono of f.geometry.coordinates) {
    for (const anillo of poligono) {
      const g = anillo.map(([lon, lat]) => radecAGal(ra360(lon), lat))
      for (let i = 0; i < g.length; i++) {
        const p = g[i]
        const q = g[(i + 1) % g.length]
        if (p[0] === q[0] && p[1] === q[1]) continue
        aristas.push([p[0], p[1], envolver(q[0] - p[0]), q[1]])
      }
    }
  }
  for (let col = 0; col < ANCHO; col++) {
    const l0 = (col + 0.5) * PASO + 1e-7
    const cruces = []
    for (const [l1, b1, dl, b2] of aristas) {
      const d0 = envolver(l0 - l1)
      if ((dl > 0 && d0 >= 0 && d0 < dl) || (dl < 0 && d0 <= 0 && d0 > dl)) cruces.push(b1 + (b2 - b1) * (d0 / dl))
    }
    cruces.sort((a, b) => a - b)
    let k = 0
    for (let fila = 0; fila < ALTO; fila++) {
      const b0 = -90 + (fila + 0.5) * PASO
      while (k < cruces.length && cruces[k] <= b0) k++
      // Cruces por encima de b0 = total - k.
      if ((cruces.length - k) % 2 === 1) niveles[fila * ANCHO + col]++
    }
  }
}
// RLE: cada tramo es una letra mayúscula (nivel 0..5 -> A..F) y su largo en base 36 en minúsculas.
let rle = ''
for (let i = 0; i < niveles.length; ) {
  let j = i
  while (j < niveles.length && niveles[j] === niveles[i]) j++
  rle += String.fromCharCode(65 + niveles[i]) + (j - i).toString(36)
  i = j
}

// ------------------------------------------------------------------- escribir
const lineasTs = (arr, porLinea) => {
  const partes = []
  for (let i = 0; i < arr.length; i += porLinea) partes.push('  ' + arr.slice(i, i + porLinea).map((x) => (x === null ? 'null' : String(x))).join(','))
  return partes.join(',\n')
}
const ts = `// GENERADO por scripts/datos-cielo.mjs, no editar (vuelve a correr: node scripts/datos-cielo.mjs).
//
// Fuentes (todas vía el paquete d3-celestial de Olaf Frohn, licencia BSD-3-Clause):
//  - Estrellas: XHIP, An Extended Hipparcos Compilation, Anderson E. y Francis C. (2012),
//    VizieR V/137D, https://cdsarc.cds.unistra.fr/viz-bin/cat/V/137D . Posiciones J2000.
//  - Nombres de estrellas: Kostjuk 2002 (VizieR IV/27A) y traducciones de Stellarium; los nombres
//    en español sin entrada en el catálogo son la forma española de uso común del mismo nombre.
//  - Constelaciones: figuras y nombres de la IAU, https://www.iau.org/public/themes/constellations/
//  - Vía Láctea: Milky Way Outline Catalog, Jose R. Vieira, http://www.skymap.com/milkyway_cat.htm
//    (5 niveles de brillo), rasterizado a una grilla galáctica de ${PASO}°.
//  - d3-celestial: https://github.com/ofrohn/d3-celestial (BSD-3-Clause).

/** Cantidad de estrellas (todas las de magnitud <= ${MAG_LIMITE}). */
export const N_ESTRELLAS = ${estrellas.length}

/**
 * Estrellas ordenadas de la más brillante a la más débil, 4 valores por estrella:
 * ascensión recta J2000 (grados, 0..360), declinación J2000 (grados), magnitud visual V e
 * índice de color B-V (null en las ${sinBV} que el catálogo no lo trae).
 */
export const ESTRELLAS: ReadonlyArray<number | null> = [
${lineasTs(plano, 32)},
]

export interface EstrellaConNombre {
  /** Número del catálogo Hipparcos. */
  hip: number
  nombre: string
  /** Posición de la estrella en ESTRELLAS (multiplicar por 4 para su primer valor). */
  indice: number
}

export const ESTRELLAS_CON_NOMBRE: ReadonlyArray<EstrellaConNombre> = ${JSON.stringify(conNombre)}

export interface Constelacion {
  /** Abreviatura IAU de tres letras. */
  id: string
  nombre: string
  /** Si es parte de la selección de constelaciones famosas que muestran su nombre. */
  famosa: boolean
  /** Dónde se escribe el nombre: [AR, Dec] en grados. */
  etiqueta: readonly [number, number]
  /** Trazos de la figura; cada uno es [AR, Dec, AR, Dec, ...] en grados. */
  lineas: ReadonlyArray<ReadonlyArray<number>>
}

export const CONSTELACIONES: ReadonlyArray<Constelacion> = ${JSON.stringify(constelaciones)}

/**
 * Vía Láctea en una grilla de coordenadas galácticas: columna = longitud l (de 0 a 360°),
 * fila = latitud b (de -90 a +90°), celdas de ${PASO}°. Cada celda guarda cuántos de los 5
 * contornos de brillo la contienen (0 = fuera, 5 = lo más brillante). Codificada por tramos:
 * letra A..F = nivel 0..5, seguida del largo del tramo en base 36.
 */
export const VIA_LACTEA = { ancho: ${ANCHO}, alto: ${ALTO}, niveles: 5, rle: '${rle}' } as const
`
writeFileSync(salida, ts)
const kb = (statSync(salida).size / 1024).toFixed(1)
console.log(`datos.ts: ${estrellas.length} estrellas (${sinBV} sin B-V), ${conNombre.length} con nombre, ${constelaciones.length} constelaciones, Vía Láctea ${ANCHO}x${ALTO} (${rle.length} caracteres RLE). ${kb} KB`)

// Mapa ASCII de la Vía Láctea (cada 4x4 celdas) para revisar a ojo que el rasterizado tiene sentido.
if (process.argv.includes('--mapa')) {
  for (let fila = ALTO - 1; fila >= 0; fila -= 8) {
    let s = ''
    for (let col = 0; col < ANCHO; col += 4) s += ' .:+#@'[niveles[fila * ANCHO + col]]
    console.log(`${String((-90 + fila * PASO).toFixed(0)).padStart(4)} ${s}`)
  }
}
