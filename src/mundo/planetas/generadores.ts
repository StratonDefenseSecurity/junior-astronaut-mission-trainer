// Generación de los píxeles de las texturas de la Tierra, Marte y la Luna (sin DOM ni three.js:
// solo arreglos tipados, así se puede cronometrar con tsx o mover a un worker).
//
// Todas las texturas son equirectangulares: columna 0 = longitud -180°, fila 0 = polo SUR
// (es lo que espera THREE.DataTexture con flipY = false sobre una THREE.SphereGeometry).
//
// QUÉ ES REAL Y QUÉ ES ESTILIZADO
//  - Tierra: las costas son reales (Natural Earth). Los colores del suelo (selva, desierto,
//    tundra...) NO son datos satelitales: salen de una regla simple por latitud más regiones
//    aproximadas de desiertos, selvas y montañas conocidas, y ruido. El hielo de Groenlandia y la
//    Antártida usa la forma real de esas tierras; el borde del hielo marino es aproximado.
//    Las nubes son ruido procedural con las franjas de nubosidad típicas (ZCIT, cinturones de
//    tormentas de latitudes medias); no son las nubes de ningún día real.
//  - Marte: los rasgos grandes están en sus coordenadas reales del Nomenclátor de la IAU
//    (ver lugares.ts); su forma fina, el color y los cráteres pequeños son estilizados.
//  - Luna: los mares están en sus coordenadas reales (IAU) con su diámetro; los bordes y los
//    cráteres pequeños son estilizados.
//
// Rendimiento: lo suave (clima, albedo, cuencas) se calcula a 1/4 de resolución y se amplía
// con interpolación bilineal; el detalle fino sale de una losa de ruido periódica. Así cada
// textura se genera en una fracción de segundo.
import { azarConSemilla, crearRuido, desenfocar, limitar, losaPeriodica, suave, type Campo } from './ruido'
import { puntoEnAnillo, rasterizarPoligonos, type Poligono } from './rasterizar'
import { ALBEDO_MARTE, CASQUETES_MARTE, CHASMATA_MARTE, LUGARES_LUNA, LUGARES_MARTE } from './lugares'

const GRAD = Math.PI / 180
type RGB = readonly [number, number, number]

/** Diferencia de longitudes llevada a -180..180. */
const dLon = (a: number, b: number) => {
  let d = a - b
  if (d > 180) d -= 360
  else if (d < -180) d += 360
  if (d > 180 || d < -180) d = ((((d % 360) + 540) % 360) - 180)
  return d
}

/** Latitud y longitud (grados) del centro del píxel. Fila 0 = polo sur. */
const latDeFila = (y: number, alto: number) => -90 + ((y + 0.5) * 180) / alto
const lonDeColumna = (x: number, ancho: number) => -180 + ((x + 0.5) * 360) / ancho

/** Senos y cosenos de cada fila y columna, calculados una vez. */
interface Reticula {
  ancho: number
  alto: number
  lat: Float64Array
  sinLat: Float64Array
  cosLat: Float64Array
  lon: Float64Array
  sinLon: Float64Array
  cosLon: Float64Array
}

function reticula(ancho: number, alto: number): Reticula {
  const r: Reticula = {
    ancho,
    alto,
    lat: new Float64Array(alto),
    sinLat: new Float64Array(alto),
    cosLat: new Float64Array(alto),
    lon: new Float64Array(ancho),
    sinLon: new Float64Array(ancho),
    cosLon: new Float64Array(ancho),
  }
  for (let j = 0; j < alto; j++) {
    r.lat[j] = latDeFila(j, alto)
    r.sinLat[j] = Math.sin(r.lat[j] * GRAD)
    r.cosLat[j] = Math.cos(r.lat[j] * GRAD)
  }
  for (let i = 0; i < ancho; i++) {
    r.lon[i] = lonDeColumna(i, ancho)
    r.sinLon[i] = Math.sin(r.lon[i] * GRAD)
    r.cosLon[i] = Math.cos(r.lon[i] * GRAD)
  }
  return r
}

/** Centro de una forma en la esfera, con su trigonometría precalculada. */
interface Centro {
  s: number
  c: number
  cl: number
  sl: number
}
const centro = (lat: number, lon: number): Centro => ({
  s: Math.sin(lat * GRAD),
  c: Math.cos(lat * GRAD),
  cl: Math.cos(lon * GRAD),
  sl: Math.sin(lon * GRAD),
})
/** Coseno del arco entre el píxel (j, i) y un centro. */
const cosArco = (r: Reticula, j: number, i: number, k: Centro) => r.sinLat[j] * k.s + r.cosLat[j] * k.c * (r.cosLon[i] * k.cl + r.sinLon[i] * k.sl)
const arcoDeCos = (c: number) => Math.acos(c > 1 ? 1 : c < -1 ? -1 : c) / GRAD

/** Elipse en el plano tangente (semiejes en grados de arco), lista para evaluarse rápido. */
interface Elipse {
  lat: number
  lon: number
  /** Radio que la encierra (grados), para descartar rápido los puntos lejanos. */
  lim: number
  k: number
  c: number
  s: number
  iLat: number
  iLon: number
}
const elipse = (lat: number, lon: number, rLat: number, rLon: number, giro = 0): Elipse => ({
  lat,
  lon,
  lim: 2 * Math.max(rLat, rLon),
  k: Math.cos(lat * GRAD),
  c: Math.cos(giro * GRAD),
  s: Math.sin(giro * GRAD),
  iLat: 1 / rLat,
  iLon: 1 / rLon,
})
/** Distancia normalizada (1 = en el borde) del punto a la elipse. */
function enElipse(e: Elipse, lat: number, lon: number): number {
  const dy = lat - e.lat
  if (dy > e.lim || dy < -e.lim) return 9
  const dx = dLon(lon, e.lon) * e.k
  if (dx > e.lim || dx < -e.lim) return 9
  const u = (dx * e.c + dy * e.s) * e.iLon
  const v = (-dx * e.s + dy * e.c) * e.iLat
  return Math.sqrt(u * u + v * v)
}

/** Polilínea [lat, lon][] con los saltos de longitud ya desenrollados. */
interface Polilinea {
  lat: Float64Array
  lon: Float64Array
  dLon: Float64Array
}
function polilinea(puntos: ReadonlyArray<readonly [number, number]>): Polilinea {
  const n = puntos.length
  const p: Polilinea = { lat: new Float64Array(n), lon: new Float64Array(n), dLon: new Float64Array(n) }
  for (let i = 0; i < n; i++) {
    p.lat[i] = puntos[i][0]
    p.lon[i] = puntos[i][1]
    if (i > 0) p.dLon[i] = dLon(puntos[i][1], puntos[i - 1][1])
  }
  return p
}
/**
 * Distancia (grados de arco, aproximación local) del punto a la polilínea; `t` devuelve el
 * tramo y la fracción más cercanos. Cada tramo se mide desde su primer punto para que un
 * tramo no "dé la vuelta" al planeta al cruzar el antimeridiano.
 */
function aPolilinea(p: Polilinea, lat: number, lon: number, t?: { tramo: number; f: number }): number {
  const k = Math.cos(lat * GRAD)
  let mejor = Infinity
  for (let i = 0; i + 1 < p.lat.length; i++) {
    const dax = dLon(p.lon[i], lon)
    if (dax > 100 || dax < -100) continue
    const ax = dax * k
    const ay = p.lat[i] - lat
    const ex = p.dLon[i + 1] * k
    const ey = p.lat[i + 1] - p.lat[i]
    const f = limitar(-(ax * ex + ay * ey) / (ex * ex + ey * ey || 1))
    const px = ax + ex * f
    const py = ay + ey * f
    const d = px * px + py * py
    if (d < mejor) {
      mejor = d
      if (t) {
        t.tramo = i
        t.f = f
      }
    }
  }
  return Math.sqrt(mejor)
}

function campoVacio(ancho: number, alto: number): Campo {
  return { ancho, alto, datos: new Float32Array(ancho * alto) }
}

/** Promedia bloques de f×f píxeles (para pasar una máscara grande a un campo pequeño). */
function reducir(datos: Float32Array, ancho: number, alto: number, f: number): Campo {
  const c = campoVacio(ancho / f, alto / f)
  const inv = 1 / (f * f)
  for (let j = 0; j < alto; j++) {
    const fila = Math.floor(j / f) * c.ancho
    for (let i = 0; i < ancho; i++) c.datos[fila + Math.floor(i / f)] += datos[j * ancho + i] * inv
  }
  return c
}

/** Amplía campos pequeños fila por fila con interpolación bilineal (se repite en longitud). */
class Ampliador {
  private ix0: Int32Array
  private ix1: Int32Array
  private fx: Float32Array
  constructor(
    private chico: { ancho: number; alto: number },
    private ancho: number,
    private alto: number,
  ) {
    this.ix0 = new Int32Array(ancho)
    this.ix1 = new Int32Array(ancho)
    this.fx = new Float32Array(ancho)
    const sx = chico.ancho / ancho
    for (let i = 0; i < ancho; i++) {
      const x = (i + 0.5) * sx - 0.5
      const x0 = Math.floor(x)
      this.fx[i] = x - x0
      this.ix0[i] = (x0 + chico.ancho) % chico.ancho
      this.ix1[i] = (x0 + 1) % chico.ancho
    }
  }
  fila(c: Campo, j: number, salida: Float32Array) {
    const y = ((j + 0.5) * this.chico.alto) / this.alto - 0.5
    const y0 = Math.floor(y)
    const fy = y - y0
    const f0 = Math.max(0, y0) * c.ancho
    const f1 = Math.min(c.alto - 1, y0 + 1) * c.ancho
    const d = c.datos
    for (let i = 0; i < this.ancho; i++) {
      const fx = this.fx[i]
      const a = d[f0 + this.ix0[i]]
      const b = d[f0 + this.ix1[i]]
      const e = d[f1 + this.ix0[i]]
      const f = d[f1 + this.ix1[i]]
      const s = a + fx * (b - a)
      salida[i] = s + fy * (e + fx * (f - e) - s)
    }
  }
}

const mezclar = (a: number, b: number, t: number) => a + (b - a) * t
const byte = (x: number) => (x <= 0 ? 0 : x >= 1 ? 255 : (x * 255 + 0.5) | 0)
const col = (r: number, g: number, b: number): RGB => [r / 255, g / 255, b / 255]

function mezclarRGB(base: [number, number, number], c: RGB, t: number) {
  if (t <= 0) return
  base[0] += (c[0] - base[0]) * t
  base[1] += (c[1] - base[1]) * t
  base[2] += (c[2] - base[2]) * t
}

/** Pendientes del campo de alturas → textura RG (128 = plano), para el relieve en el shader. */
function pendientes(h: Campo, escala: number): Uint8Array {
  const { ancho, alto, datos } = h
  const salida = new Uint8Array(ancho * alto * 2)
  const dx = (2 * Math.PI) / ancho
  const dy = Math.PI / alto
  for (let j = 0; j < alto; j++) {
    const cl = Math.max(0.02, Math.cos(latDeFila(j, alto) * GRAD))
    const kx = escala / (2 * dx * cl)
    const ky = escala / (2 * dy)
    const fila = j * ancho
    const jN = Math.min(alto - 1, j + 1) * ancho
    const jS = Math.max(0, j - 1) * ancho
    for (let i = 0; i < ancho; i++) {
      const e = datos[fila + (i + 1 === ancho ? 0 : i + 1)]
      const o = datos[fila + (i === 0 ? ancho - 1 : i - 1)]
      let gx = 128 + (e - o) * kx
      let gy = 128 + (datos[jN + i] - datos[jS + i]) * ky
      gx = gx < 0 ? 0 : gx > 255 ? 255 : gx
      gy = gy < 0 ? 0 : gy > 255 ? 255 : gy
      salida[(fila + i) * 2] = gx + 0.5
      salida[(fila + i) * 2 + 1] = gy + 0.5
    }
  }
  return salida
}

/**
 * Suma una "estampa" en un campo de alturas recorriendo solo la caja que la contiene.
 * `f` recibe r = distancia / radio (aproximación local: solo para formas de menos de ~10°).
 */
function estampar(h: Campo, lat0: number, lon0: number, radioGrados: number, alcance: number, f: (r: number, lat: number, lon: number) => number) {
  const { ancho, alto, datos } = h
  const ext = radioGrados * alcance
  const j0 = Math.max(0, Math.floor(((lat0 - ext + 90) / 180) * alto))
  const j1 = Math.min(alto - 1, Math.ceil(((lat0 + ext + 90) / 180) * alto))
  const inv = 1 / radioGrados
  for (let j = j0; j <= j1; j++) {
    const lat = latDeFila(j, alto)
    const cl = Math.cos(lat * GRAD)
    const extLon = cl > 0.05 ? Math.min(180, ext / cl) : 180
    const i0 = Math.floor(((lon0 - extLon + 180) / 360) * ancho)
    const pasos = Math.min(ancho, Math.ceil(((2 * extLon) / 360) * ancho) + 2)
    const dy = (lat - lat0) * inv
    for (let s = 0; s < pasos; s++) {
      const i = (((i0 + s) % ancho) + ancho) % ancho
      const lon = lonDeColumna(i, ancho)
      const dx = dLon(lon, lon0) * cl * inv
      const r = Math.sqrt(dx * dx + dy * dy)
      if (r <= alcance) datos[j * ancho + i] += f(r, lat, lon)
    }
  }
}

/** Perfil de un cráter (r = distancia / radio): cuenco, borde levantado y manto de eyecta. */
function crater(r: number, prof: number): number {
  if (r < 1) return prof * (r * r - 1) * 0.9 + prof * 0.25 * r ** 6
  return prof * 0.25 * Math.exp(-((r - 1) * 3.2))
}

/** km a grados de arco en un cuerpo de radio R (km). */
const kmAGrados = (km: number, radioKm: number) => km / radioKm / GRAD
const RADIO_MARTE_KM = 3389.5
const RADIO_LUNA_KM = 1737.4

/** Los campos suaves se calculan en una retícula de 256×128 como máximo (1.4° por celda). */
const factorSuave = (ancho: number) => Math.max(4, ancho / 256)

/** Valor de la losa de detalle para el píxel (i, j). */
const LOSA = 512
const enLosa = (losa: Float32Array, i: number, j: number) => losa[(j & (LOSA - 1)) * LOSA + (i & (LOSA - 1))]

// =========================================================================================
//                                          TIERRA
// =========================================================================================

// Colores aproximados (sRGB) de cada tipo de suelo, vistos desde el espacio. Estilizados.
const C_SELVA = col(34, 60, 27)
const C_SABANA = col(104, 106, 58)
const C_TEMPLADO = col(64, 84, 46)
const C_ESTEPA = col(132, 124, 86)
const C_BOREAL = col(31, 50, 33)
const C_TUNDRA = col(106, 102, 84)
const C_ARENA = col(204, 172, 122)
const C_ROJIZO = col(184, 126, 80)
const C_GRIS = col(166, 150, 120)
const C_ROCA = col(118, 106, 92)
const C_MESETA = col(140, 124, 98)
const C_HIELO = col(238, 242, 247)
const C_HIELO_MAR = col(214, 226, 236)
const C_OCEANO_HONDO = col(9, 22, 52)
const C_OCEANO = col(13, 38, 80)
const C_PLATAFORMA = col(30, 82, 108)

interface Region {
  e: Elipse
  color: RGB
  fuerza: number
}
const region = (lat: number, lon: number, rLat: number, rLon: number, color: RGB, fuerza = 1, giro = 0): Region => ({
  e: elipse(lat, lon, rLat, rLon, giro),
  color,
  fuerza,
})

// Regiones APROXIMADAS (centro y semiejes en grados) de desiertos, selvas, sabanas y mesetas
// conocidas. Sirven solo para colorear de forma creíble; no son límites medidos.
const DESIERTOS: ReadonlyArray<Region> = [
  region(23, 10, 9, 24, C_ARENA), // Sahara
  region(22, 47, 8, 10, C_ARENA), // Arabia
  region(31, 60, 5, 10, C_GRIS), // Irán y Afganistán
  region(27, 71, 3.5, 3.5, C_ARENA), // Thar
  region(41, 61, 4, 8, C_GRIS, 0.8), // Karakum y Kyzylkum
  region(39, 83, 2.6, 6.5, C_ARENA), // Taklamakán
  region(43, 105, 4, 12, C_GRIS, 0.85), // Gobi
  region(-25, 132, 8, 14, C_ROJIZO), // interior de Australia
  region(-24, 19, 6, 7, C_GRIS, 0.8), // Kalahari y Namib
  region(8, 46, 5, 5, C_GRIS, 0.85), // Cuerno de África
  region(31, -110, 5, 7, C_GRIS, 0.85), // Sonora y Chihuahua
  region(40, -116, 4, 5, C_ESTEPA, 0.8), // Gran Cuenca
  region(-45, -69, 6, 3.5, C_ESTEPA, 0.85), // estepa patagónica
  region(-18, -68, 5, 2.5, C_MESETA, 0.85), // Altiplano
]
const SELVAS: ReadonlyArray<Region> = [
  region(-4, -62, 9, 14, C_SELVA), // Amazonía
  region(0, 21, 5, 9, C_SELVA), // Congo
  region(1, 108, 7, 16, C_SELVA), // Sudeste asiático
  region(-5, 142, 4, 8, C_SELVA), // Nueva Guinea
  region(12, -86, 5, 5, C_SELVA, 0.7), // Centroamérica
]
const SABANAS: ReadonlyArray<Region> = [
  region(-6, 35, 9, 6, C_SABANA), // África oriental
  region(-14, -48, 7, 7, C_SABANA), // Cerrado
  region(-16, 133, 4, 12, C_SABANA), // norte de Australia
  region(18, 77, 6, 5, C_SABANA, 0.7), // meseta del Decán
]
// Franja desértica de la costa de Perú y Chile (Sechura, costa central, Atacama): entre el
// mar y las primeras estribaciones de los Andes. Trazado aproximado.
const COSTA_DESIERTO_PERU = polilinea([
  [-4.5, -81.2],
  [-6.5, -80.2],
  [-9, -78.6],
  [-12, -77.1],
  [-15, -75.3],
  [-17.5, -71.6],
  [-21, -70.2],
  [-25, -70.4],
  [-28.5, -71],
])
// Cordilleras principales (trazado aproximado).
const ANDES = polilinea([
  [8, -73],
  [3, -76.5],
  [-2, -78.6],
  [-8, -77.6],
  [-13, -73.5],
  [-17, -69.5],
  [-23, -67.8],
  [-30, -69.8],
  [-36, -70.3],
  [-42, -71.8],
  [-50, -73.4],
  [-54, -71],
])
const ROCOSAS = polilinea([
  [62, -138],
  [56, -125],
  [50, -116],
  [44, -110],
  [39, -106.5],
  [34, -106],
])
const HIMALAYA = polilinea([
  [35.5, 74],
  [32, 77.5],
  [29.5, 81],
  [28, 86],
  [27.8, 90],
  [28.5, 95],
])
const TIBET = elipse(33, 87, 5, 13)
const ALPES = elipse(46.3, 9.5, 1.1, 4.5, 15)

/** Índice del polígono de Natural Earth que contiene un punto (o -1). */
export function poligonoQueContiene(poligonos: ReadonlyArray<Poligono>, lon: number, lat: number): number {
  for (let i = 0; i < poligonos.length; i++) if (puntoEnAnillo(lon, lat, poligonos[i][0])) return i
  return -1
}

/**
 * Mapa de color de la Tierra (RGBA, sRGB). El canal alfa es 255 sobre agua abierta (para el
 * brillo especular del océano) y 0 sobre tierra y hielo.
 */
export function generarColorTierra(poligonos: ReadonlyArray<Poligono>, ancho: number, alto: number, semilla = 7): Uint8Array {
  const ruido = crearRuido(semilla)
  // Costas reales con antialias.
  const tierra = rasterizarPoligonos(poligonos, ancho, alto, ancho >= 2048 ? 2 : 3)

  // Campos de baja resolución: aquí va todo lo suave (clima, plataforma, hielo).
  const bajo = reducir(tierra, ancho, alto, factorSuave(ancho))
  const cerca: Campo = { ...bajo, datos: bajo.datos.slice() }
  desenfocar(cerca, Math.max(1, Math.round(bajo.ancho / 360)), Math.max(1, Math.round(bajo.alto / 180)), 2)
  const lejos: Campo = { ...bajo, datos: bajo.datos.slice() }
  desenfocar(lejos, Math.round(bajo.ancho / 90), Math.round(bajo.alto / 45), 2)

  // Groenlandia: su polígono real se cubre de hielo salvo una franja costera.
  const iGroen = poligonoQueContiene(poligonos, -42, 72)
  const groen: Campo = {
    ancho: bajo.ancho,
    alto: bajo.alto,
    datos: iGroen >= 0 ? rasterizarPoligonos([poligonos[iGroen]], bajo.ancho, bajo.alto, 2) : new Float32Array(bajo.ancho * bajo.alto),
  }
  desenfocar(groen, 1, 1, 2)

  const R = reticula(bajo.ancho, bajo.alto)
  const campos = Array.from({ length: 7 }, () => campoVacio(bajo.ancho, bajo.alto))
  const [tR, tG, tB, oR, oG, oB, agua] = campos.map((c) => c.datos)
  const c: [number, number, number] = [0, 0, 0]
  for (let j = 0; j < R.alto; j++) {
    const lat = R.lat[j]
    for (let i = 0; i < R.ancho; i++) {
      const k = j * R.ancho + i
      const lon = R.lon[i]
      const x = R.cosLat[j] * R.cosLon[i]
      const y = R.cosLat[j] * R.sinLon[i]
      const z = R.sinLat[j]
      const r1 = ruido.fbm(x * 3, y * 3, z * 3, 3)
      const r2 = ruido.fbm(x * 9 + 40, y * 9, z * 9, 2)
      const a = Math.abs(lat) + r1 * 5
      // ---- suelo por franjas de latitud (con el borde movido por ruido)
      c[0] = C_SELVA[0]
      c[1] = C_SELVA[1]
      c[2] = C_SELVA[2]
      mezclarRGB(c, C_SABANA, suave(9, 17, a))
      mezclarRGB(c, C_ESTEPA, suave(19, 27, a) * (1 - suave(28, 36, a)) * 0.6)
      mezclarRGB(c, C_TEMPLADO, suave(28, 36, a))
      if (lat > 0) {
        mezclarRGB(c, C_BOREAL, suave(47, 55, a))
        mezclarRGB(c, C_TUNDRA, suave(63, 70, a))
      } else {
        mezclarRGB(c, C_ESTEPA, suave(40, 50, a) * 0.5)
        mezclarRGB(c, C_TUNDRA, suave(52, 58, a))
      }
      // ---- regiones conocidas (aproximadas), con bordes irregulares
      for (const s of SELVAS) mezclarRGB(c, s.color, (1 - suave(0.6, 1.1, enElipse(s.e, lat, lon) + r2 * 0.35)) * s.fuerza)
      for (const s of SABANAS) mezclarRGB(c, s.color, (1 - suave(0.5, 1.1, enElipse(s.e, lat, lon) + r2 * 0.35)) * s.fuerza)
      for (const s of DESIERTOS) mezclarRGB(c, s.color, (1 - suave(0.5, 1.15, enElipse(s.e, lat, lon) + r2 * 0.55 + r1 * 0.35)) * s.fuerza)
      if (lat < 0 && lat > -32 && lon < -60) mezclarRGB(c, C_GRIS, (1 - suave(0.6, 1.6, aPolilinea(COSTA_DESIERTO_PERU, lat, lon) + r2 * 0.6)) * 0.9)
      // Montañas: roca, mesetas y algo de nieve en lo más alto.
      const andes = lon < -60 && lon > -85 ? 1 - suave(0.8, 2.2, aPolilinea(ANDES, lat, lon) + r2 * 0.8) : 0
      const rocosas = lon < -95 && lat > 28 ? 1 - suave(1.5, 4, aPolilinea(ROCOSAS, lat, lon) + r2 * 1.2) : 0
      const himalaya = lon > 65 && lon < 105 && lat > 20 && lat < 42 ? 1 - suave(0.4, 1.4, aPolilinea(HIMALAYA, lat, lon) + r2 * 0.5) : 0
      const tibet = 1 - suave(0.6, 1.1, enElipse(TIBET, lat, lon) + r2 * 0.3)
      const alpes = 1 - suave(0.5, 1.2, enElipse(ALPES, lat, lon) + r2 * 0.4)
      mezclarRGB(c, C_ROCA, Math.max(andes, rocosas * 0.7, alpes * 0.7, himalaya * 0.8) * (0.55 + 0.25 * r1))
      mezclarRGB(c, C_MESETA, tibet * 0.85)
      mezclarRGB(c, C_HIELO, Math.max(himalaya * 0.5, alpes * 0.4, andes * suave(-35, -50, lat) * 0.6) * suave(-0.2, 0.3, r2))
      // ---- hielo permanente: Antártida, Groenlandia (salvo la orilla) y el Ártico alto
      let hielo = lat < -60 ? 1 : 0
      hielo = Math.max(hielo, suave(0.35, 0.7, groen.datos[k]))
      if (lat > 74) hielo = Math.max(hielo, suave(74, 82, lat + r2 * 4) * 0.8)
      // Variación de brillo para que no se vean manchas planas.
      const brillo = 1 + r2 * 0.12 + r1 * 0.06
      const hb = 0.97 + r2 * 0.03
      tR[k] = mezclar(c[0] * brillo, C_HIELO[0] * hb, hielo)
      tG[k] = mezclar(c[1] * brillo, C_HIELO[1] * hb, hielo)
      tB[k] = mezclar(c[2] * brillo, C_HIELO[2] * hb, hielo)

      // ---- océano: hondo lejos de la costa, plataforma clara pegada a ella (aproximado)
      const hondo = suave(0.02, 0.3, lejos.datos[k])
      let r = mezclar(C_OCEANO_HONDO[0], C_OCEANO[0], hondo)
      let g = mezclar(C_OCEANO_HONDO[1], C_OCEANO[1], hondo)
      let b = mezclar(C_OCEANO_HONDO[2], C_OCEANO[2], hondo)
      const plataforma = suave(0.04, 0.5, cerca.datos[k] + r2 * 0.08) * 0.85
      r = mezclar(r, C_PLATAFORMA[0], plataforma)
      g = mezclar(g, C_PLATAFORMA[1], plataforma)
      b = mezclar(b, C_PLATAFORMA[2], plataforma)
      // Aguas polares algo más oscuras y verdosas.
      const frio = suave(45, 70, Math.abs(lat))
      g *= 1 + frio * 0.08
      b *= 1 - frio * 0.15
      // Hielo marino: extensión típica aproximada (estilizada, no de una fecha concreta).
      const mar = lat > 0 ? suave(77, 81, lat + r1 * 5 + r2 * 2) : suave(-66, -70, lat + r1 * 3 + r2 * 2)
      oR[k] = mezclar(r, C_HIELO_MAR[0], mar)
      oG[k] = mezclar(g, C_HIELO_MAR[1], mar)
      oB[k] = mezclar(b, C_HIELO_MAR[2], mar)
      agua[k] = 1 - mar
    }
  }

  // Detalle fino (rugosidad del suelo, vetas del hielo) desde una losa periódica.
  const losa = losaPeriodica(LOSA, [64, 32, 16, 8, 4], semilla)
  const amp = new Ampliador(bajo, ancho, alto)
  const filas = campos.map(() => new Float32Array(ancho))
  const salida = new Uint8Array(ancho * alto * 4)
  for (let j = 0; j < alto; j++) {
    for (let f = 0; f < campos.length; f++) amp.fila(campos[f], j, filas[f])
    const [fR, fG, fB, fOR, fOG, fOB, fAgua] = filas
    for (let i = 0; i < ancho; i++) {
      const k = j * ancho + i
      const t = tierra[k]
      const d = enLosa(losa, i, j)
      // Menos detalle sobre el hielo (es liso y muy claro).
      const m = 1 + d * (0.32 - 0.26 * suave(0.6, 0.85, fG[i]))
      const o = 1 + d * 0.05
      const q = k * 4
      salida[q] = byte(mezclar(fOR[i] * o, fR[i] * m, t))
      salida[q + 1] = byte(mezclar(fOG[i] * o, fG[i] * m, t))
      salida[q + 2] = byte(mezclar(fOB[i] * o, fB[i] * m, t))
      salida[q + 3] = byte(fAgua[i] * (1 - t))
    }
  }
  return salida
}

/**
 * Nubes de la Tierra (un canal: opacidad). Ruido con franjas de nubosidad por latitud:
 * la zona de convergencia intertropical (algo al norte del ecuador), cielos despejados en los
 * subtrópicos y los cinturones de tormentas de latitudes medias (más fuertes en el sur).
 * Es una ilustración del patrón climático, no las nubes de un día real.
 */
export function generarNubesTierra(ancho: number, alto: number, semilla = 11): Uint8Array {
  const ruido = crearRuido(semilla)
  const otro = crearRuido(semilla + 101)
  // Deformación del dominio a 1/4: da formas de remolino y frentes.
  const R4 = reticula(ancho / 4, alto / 4)
  const wx = campoVacio(R4.ancho, R4.alto)
  const wy = campoVacio(R4.ancho, R4.alto)
  const wz = campoVacio(R4.ancho, R4.alto)
  for (let j = 0; j < R4.alto; j++)
    for (let i = 0; i < R4.ancho; i++) {
      const k = j * R4.ancho + i
      const x = R4.cosLat[j] * R4.cosLon[i] * 2.5
      const y = R4.cosLat[j] * R4.sinLon[i] * 2.5
      const z = R4.sinLat[j] * 2.5
      wx.datos[k] = otro.fbm(x, y, z, 2)
      wy.datos[k] = otro.fbm(x + 31, y, z, 2)
      wz.datos[k] = otro.fbm(x, y - 17, z, 2)
    }
  // Ruido principal a 1/2 con el dominio deformado.
  const R2 = reticula(ancho / 2, alto / 2)
  const base = campoVacio(R2.ancho, R2.alto)
  const amp2 = new Ampliador(R4, R2.ancho, R2.alto)
  const fx = new Float32Array(R2.ancho)
  const fy = new Float32Array(R2.ancho)
  const fz = new Float32Array(R2.ancho)
  for (let j = 0; j < R2.alto; j++) {
    amp2.fila(wx, j, fx)
    amp2.fila(wy, j, fy)
    amp2.fila(wz, j, fz)
    const lat = R2.lat[j]
    const a = Math.abs(lat)
    // Fracción de cielo cubierto típica por latitud (forma aproximada del promedio anual).
    const zcit = Math.exp(-(((lat - 6) / 7) ** 2))
    const subtropico = Math.exp(-(((a - 24) / 8) ** 2))
    const tormentas = Math.exp(-(((a - 55) / 11) ** 2)) * (lat < 0 ? 1.25 : 1)
    const cobertura = limitar(0.47 + 0.25 * zcit - 0.27 * subtropico + 0.27 * tormentas + 0.08 * suave(65, 85, a), 0.08, 0.9)
    for (let i = 0; i < R2.ancho; i++) {
      const x = R2.cosLat[j] * R2.cosLon[i] + fx[i] * 0.35
      const y = R2.cosLat[j] * R2.sinLon[i] + fy[i] * 0.35
      const z = R2.sinLat[j] + fz[i] * 0.35
      // Se guarda ya restado el umbral de la latitud: > 0 = nube.
      base.datos[j * R2.ancho + i] = ruido.fbm(x * 3.2, y * 3.2, z * 3.2, 5, 0.6) * 0.95 + 0.5 - (1 - cobertura)
    }
  }
  const losa = losaPeriodica(LOSA, [32, 16, 8, 4], semilla + 5)
  const amp = new Ampliador(R2, ancho, alto)
  const fila = new Float32Array(ancho)
  const salida = new Uint8Array(ancho * alto)
  for (let j = 0; j < alto; j++) {
    amp.fila(base, j, fila)
    for (let i = 0; i < ancho; i++) {
      const n = fila[i] + enLosa(losa, i, j) * 0.14
      // Borde ancho: deja zonas de nube delgada y semitransparente, no solo blanco o nada.
      const c = suave(-0.26, 0.3, n)
      salida[j * ancho + i] = byte(c * Math.sqrt(c) * 0.95)
    }
  }
  return salida
}

// =========================================================================================
//                                          MARTE
// =========================================================================================

// Paleta aproximada del color de Marte visto desde órbita (sRGB). Estilizada.
const M_CLARO = col(206, 142, 92) // regiones polvorientas (Tharsis, Arabia, Elysium)
const M_MEDIO = col(178, 106, 66)
const M_OSCURO = col(114, 80, 60) // rasgos de albedo oscuros (Syrtis Major, Acidalium...)
const M_CASQUETE = col(242, 238, 230)
const M_FONDO_BRILLANTE = col(214, 168, 124) // fondo polvoriento/escarchado de Hellas y Argyre

/** Tamaño que les damos a los rasgos de albedo (semiejes en grados): ESTILIZADO, la IAU solo da el centro. */
const FORMA_ALBEDO: Record<keyof typeof ALBEDO_MARTE, { rLat: number; rLon: number; giro?: number; fuerza?: number }> = {
  syrtisMajor: { rLat: 13, rLon: 8, giro: 12 },
  mareAcidalium: { rLat: 12, rLon: 20, fuerza: 0.8 },
  mareErythraeum: { rLat: 11, rLon: 26, fuerza: 0.85 },
  mareCimmerium: { rLat: 10, rLon: 22 },
  mareTyrrhenum: { rLat: 10, rLon: 18 },
  mareSirenum: { rLat: 9, rLon: 22, fuerza: 0.9 },
  mareSerpentis: { rLat: 8, rLon: 16, fuerza: 0.85 },
  mareChronium: { rLat: 6, rLon: 28, fuerza: 0.65 },
  sinusMeridiani: { rLat: 5, rLon: 13 },
  sinusSabaeus: { rLat: 5, rLon: 20 },
  solisLacus: { rLat: 6, rLon: 8, fuerza: 0.8 },
}

/**
 * Marte: color y relieve con los rasgos reales del Nomenclátor de la IAU en sus coordenadas.
 * Alturas en unidades arbitrarias (1 ≈ un volcán grande); el shader solo usa las pendientes.
 */
export function generarMarte(ancho: number, alto: number, semilla = 23): PixelesPlaneta {
  const ruido = crearRuido(semilla)
  const azar = azarConSemilla(semilla)
  const L = LUGARES_MARTE
  const g = (km: number) => kmAGrados(km, RADIO_MARTE_KM)

  // ---- campos suaves a 1/4: albedo (0 = polvo claro, 1 = oscuro), fondos claros y alturas grandes
  const R = reticula(ancho / factorSuave(ancho), alto / factorSuave(ancho))
  const oscuroB = campoVacio(R.ancho, R.alto)
  const claroB = campoVacio(R.ancho, R.alto)
  const alturaB = campoVacio(R.ancho, R.alto)
  const manchas = (Object.keys(FORMA_ALBEDO) as (keyof typeof FORMA_ALBEDO)[]).map((k) => {
    const a = ALBEDO_MARTE[k]
    const f = FORMA_ALBEDO[k]
    return { e: elipse(a.lat, a.lon, f.rLat, f.rLon, f.giro ?? 0), fuerza: f.fuerza ?? 1 }
  })
  const meridiani = elipse(L.meridiani.lat, L.meridiani.lon, 4, 8)
  // Regiones claras y polvorientas: Tharsis, Arabia, Elysium, Amazonis (forma estilizada).
  const claras = [elipse(5, -112, 22, 30), elipse(20, 25, 14, 22), elipse(20, 155, 14, 22), elipse(15, -160, 12, 18)]
  const cHellas = centro(L.hellas.lat, L.hellas.lon)
  const cArgyre = centro(L.argyre.lat, L.argyre.lon)
  const cTharsis = centro(2, -110)
  const rHellas = g(L.hellas.km) / 2
  const rArgyre = g(L.argyre.km) / 2
  for (let j = 0; j < R.alto; j++) {
    const lat = R.lat[j]
    for (let i = 0; i < R.ancho; i++) {
      const k = j * R.ancho + i
      const lon = R.lon[i]
      const x = R.cosLat[j] * R.cosLon[i]
      const y = R.cosLat[j] * R.sinLon[i]
      const z = R.sinLat[j]
      const r1 = ruido.fbm(x * 4, y * 4, z * 4, 3)
      const r2 = ruido.fbm(x * 12 + 7, y * 12, z * 12, 2)
      // Tierras altas del sur algo más oscuras que las llanuras del norte (estilizado).
      // Franja austral algo más oscura que une los "mares" clásicos (estilizado).
      let oscuro = 0.18 + r1 * 0.12 + suave(25, -15, lat + r1 * 12) * 0.12 + Math.exp(-(((lat + 22) / 14) ** 2)) * (0.15 + 0.25 * r2)
      for (const m of manchas) {
        const d = enElipse(m.e, lat, lon) + r1 * 0.5 + r2 * 0.3
        if (d < 1.3) oscuro = Math.max(oscuro, (1 - suave(0.2, 1.3, d)) * m.fuerza)
      }
      // Meridiani Planum (hematita) y el collar oscuro de dunas alrededor del casquete norte.
      oscuro = Math.max(oscuro, (1 - suave(0.4, 1.1, enElipse(meridiani, lat, lon) + r2 * 0.3)) * 0.7)
      oscuro = Math.max(oscuro, suave(73, 77, lat + r2 * 4 + r1 * 3) * (1 - suave(79, 82, lat)) * (0.35 + 0.3 * r2))
      let claro = 0
      for (const e of claras) claro = Math.max(claro, 1 - suave(0.5, 1.1, enElipse(e, lat, lon) + r1 * 0.3))
      oscuroB.datos[k] = limitar(oscuro * (1 - claro * 0.65))
      // Cuencas de impacto: fondo hundido y claro, borde montañoso (forma estilizada).
      const dH = arcoDeCos(cosArco(R, j, i, cHellas)) / rHellas
      const dA = arcoDeCos(cosArco(R, j, i, cArgyre)) / rArgyre
      claroB.datos[k] = Math.max(1 - suave(0.55, 0.95, dH + r2 * 0.15), 1 - suave(0.6, 1, dA + r2 * 0.15))
      const bordeH = Math.exp(-(((dH - 1.24) / 0.22) ** 2)) * 0.3 * (0.6 + 0.8 * Math.abs(r2))
      // Argyre: el Nomenclátor da 800 km para la llanura; la cuenca con su anillo de montañas
      // es bastante mayor (anillo estilizado a ~2.2 veces ese radio).
      const bordeA = Math.exp(-(((dA - 2.2) / 0.4) ** 2)) * 0.3 * (0.6 + 0.8 * Math.abs(r2))
      let h = -0.9 * (1 - suave(0.8, 1.24, dH)) - 0.5 * (1 - suave(1, 2.2, dA)) + bordeH + bordeA
      // Abultamiento de Tharsis (forma aproximada) bajo los volcanes.
      const dT = arcoDeCos(cosArco(R, j, i, cTharsis)) / 28
      h += 0.35 * Math.exp(-dT * dT * 2.2)
      // Domo de capas polares del norte (Planum Boreum).
      if (lat > 78) h += 0.25 * (1 - ((90 - lat) / 12) ** 2)
      h += r2 * 0.03
      alturaB.datos[k] = h
    }
  }

  // ---- alturas a resolución completa: lo suave ampliado + rugosidad + rasgos nítidos
  const h = campoVacio(ancho, alto)
  const losa = losaPeriodica(LOSA, [64, 32, 16, 8, 4], semilla)
  {
    const amp = new Ampliador(R, ancho, alto)
    const fila = new Float32Array(ancho)
    for (let j = 0; j < alto; j++) {
      amp.fila(alturaB, j, fila)
      // Rugosidad general, más fuerte en las tierras altas del sur.
      const lat = latDeFila(j, alto)
      const kr = 0.05 + suave(30, -10, lat) * 0.07
      for (let i = 0; i < ancho; i++) h.datos[j * ancho + i] = fila[i] + enLosa(losa, i, j) * kr
    }
  }
  // Volcanes en escudo: domo, escarpe basal (muy marcado en Olympus Mons) y caldera.
  const volcan = (lugar: { lat: number; lon: number; km: number }, altura: number, escarpe: number) => {
    estampar(h, lugar.lat, lugar.lon, g(lugar.km) / 2, 1.05, (r) => {
      if (r >= 1) return 0
      const domo = altura * (escarpe + (1 - escarpe) * (1 - r * r) ** 1.4)
      const caldera = r < 0.12 ? -altura * 0.35 * (1 - (r / 0.12) ** 2) : 0
      return domo + caldera
    })
  }
  volcan(L.olympusMons, 1.0, 0.3)
  volcan(L.arsiaMons, 0.75, 0.08)
  volcan(L.pavonisMons, 0.65, 0.08)
  volcan(L.ascraeusMons, 0.75, 0.08)
  volcan(L.elysiumMons, 0.55, 0.06)
  // Valles Marineris: fosa a lo largo de sus tramos reales (de Ius a Eos Chasma), con el ancho
  // de cada tramo estilizado (Melas es el más ancho).
  const C = CHASMATA_MARTE
  const tramos: ReadonlyArray<readonly [number, number, number]> = [
    [C.ius.lat, C.ius.lon - g(C.ius.km) / 2, 0.7],
    [C.ius.lat, C.ius.lon, 1.0],
    [(C.ius.lat + C.melas.lat) / 2 + 0.6, (C.ius.lon + C.melas.lon) / 2, 1.6],
    [C.melas.lat, C.melas.lon, 2.3],
    [C.coprates.lat, C.coprates.lon, 1.2],
    [(C.coprates.lat + C.eos.lat) / 2, (C.coprates.lon + C.eos.lon) / 2, 1.3],
    [C.eos.lat, C.eos.lon, 1.8],
    [C.eos.lat + 1, C.eos.lon + g(C.eos.km) / 2, 1.0],
  ]
  {
    const pl = polilinea(tramos.map((t) => [t[0], t[1]] as const))
    const t = { tramo: 0, f: 0 }
    const j0 = Math.floor(((-21 + 90) / 180) * alto)
    const j1 = Math.ceil(((0 + 90) / 180) * alto)
    const i0 = Math.floor(((-106 + 180) / 360) * ancho)
    const i1 = Math.ceil(((-24 + 180) / 360) * ancho)
    for (let j = j0; j <= j1; j++) {
      const lat = latDeFila(j, alto)
      for (let i = i0; i <= i1; i++) {
        const lon = lonDeColumna(i, ancho)
        const d = aPolilinea(pl, lat, lon, t)
        if (d > 3.5) continue
        const w = mezclar(tramos[t.tramo][2], tramos[t.tramo + 1][2], t.f) * (1 + 0.25 * enLosa(losa, i * 3, j * 3))
        h.datos[j * ancho + i] += -0.55 * (1 - suave(w * 0.55, w, d))
      }
    }
    // Noctis Labyrinthus: red de fosas cortas (estilizada) en su ubicación real.
    estampar(h, C.noctis.lat, C.noctis.lon, g(C.noctis.km) / 2, 1, (r, lat, lon) => {
      const red = Math.abs(ruido.valor(lat * 2.2, lon * 2.2, 21)) + Math.abs(ruido.valor(lat * 2.2, lon * 2.2, 37))
      return -0.25 * (1 - suave(0.04, 0.12, red)) * (1 - suave(0.6, 1, r))
    })
  }
  // Cráteres de las zonas de aterrizaje en su lugar real.
  estampar(h, L.gale.lat, L.gale.lon, g(L.gale.km) / 2, 2.5, (r) => {
    // Gale tiene un gran montículo central: Aeolis Mons (monte Sharp).
    const monte = r < 0.55 ? 0.3 * (1 - (r / 0.55) ** 2) : 0
    return crater(r, 0.35) + monte
  })
  estampar(h, L.jezero.lat, L.jezero.lon, g(L.jezero.km) / 2, 2.5, (r) => crater(r, 0.2))
  // Cráteres al azar (estilizados): muchos en las tierras altas del sur, pocos en el norte.
  const cuantos = Math.round(2600 * (ancho / 2048) ** 0.5)
  for (let n = 0; n < cuantos; n++) {
    const lat = Math.asin(azar() * 2 - 1) / GRAD
    const lon = azar() * 360 - 180
    const sur = suave(20, -15, lat)
    if (azar() > 0.25 + sur * 0.75) continue
    const radioKm = 6 * Math.pow(azar(), -0.75)
    if (radioKm > 220 || (radioKm < 9 && ancho < 2048)) continue
    const prof = 0.06 + Math.sqrt(radioKm) * 0.022
    estampar(h, lat, lon, g(radioKm), 2.5, (r) => crater(r, prof))
  }

  // ---- color a resolución completa
  const color = new Uint8Array(ancho * alto * 4)
  const cS = CASQUETES_MARTE.sur
  const centroSur = centro(cS.lat, cS.lon)
  const radioN = g(CASQUETES_MARTE.norte.km) / 2
  const radioS = g(cS.km) / 2
  const RF = reticula(ancho, alto)
  const amp = new Ampliador(R, ancho, alto)
  const fO = new Float32Array(ancho)
  const fC = new Float32Array(ancho)
  // Tabla de color según lo oscuro del albedo (0..255), para no mezclar colores píxel a píxel.
  const tabla = new Float32Array(256 * 3)
  for (let q = 0; q < 256; q++) {
    const o = q / 255
    const t1 = suave(0.05, 0.55, o)
    const t2 = suave(0.35, 1.0, o)
    for (let c = 0; c < 3; c++) tabla[q * 3 + c] = mezclar(mezclar(M_CLARO[c], M_MEDIO[c], t1), M_OSCURO[c], t2)
  }
  for (let j = 0; j < alto; j++) {
    amp.fila(oscuroB, j, fO)
    amp.fila(claroB, j, fC)
    const lat = RF.lat[j]
    for (let i = 0; i < ancho; i++) {
      const k = j * ancho + i
      const d = enLosa(losa, i, j)
      let o = fO[i] + d * 0.2
      o = o < 0 ? 0 : o > 1 ? 1 : o
      const q = ((o * 255 + 0.5) | 0) * 3
      const t3 = fC[i] * 0.6
      let r = tabla[q] + (M_FONDO_BRILLANTE[0] - tabla[q]) * t3
      let gg = tabla[q + 1] + (M_FONDO_BRILLANTE[1] - tabla[q + 1]) * t3
      let b = tabla[q + 2] + (M_FONDO_BRILLANTE[2] - tabla[q + 2]) * t3
      // Los fondos de cráteres y fosas se ven algo más oscuros; los bordes, más claros.
      let hs = h.datos[k] * 0.25
      hs = hs < -0.22 ? -0.22 : hs > 0.08 ? 0.08 : hs
      const sombra = 1 + hs
      // Casquetes residuales con borde irregular y vetas en espiral (forma estilizada).
      let casquete = 0
      if (lat > 70) {
        const dist = 90 - lat
        casquete = (1 - suave(radioN * 0.8, radioN * 1.15, dist + d * 3)) * (0.9 + 0.1 * d)
      } else if (lat < -78) {
        const dist = arcoDeCos(cosArco(RF, j, i, centroSur))
        casquete = 1 - suave(radioS * 0.75, radioS * 1.2, dist + d * 1.2)
      }
      const m = 1 + d * 0.1
      r = mezclar(r * sombra, M_CASQUETE[0], casquete) * m
      gg = mezclar(gg * sombra, M_CASQUETE[1], casquete) * m
      b = mezclar(b * sombra, M_CASQUETE[2], casquete) * m
      color[k * 4] = byte(r)
      color[k * 4 + 1] = byte(gg)
      color[k * 4 + 2] = byte(b)
      color[k * 4 + 3] = 255
    }
  }
  return { color, relieve: pendientes(h, ESCALA_RELIEVE * 0.6) }
}

export interface PixelesPlaneta {
  /** RGBA sRGB. */
  color: Uint8Array
  /** RG: pendiente hacia el este y hacia el norte (128 = plano). */
  relieve: Uint8Array
}

/** Escala de pendiente usada en las texturas de relieve. */
export const ESCALA_RELIEVE = 40

// =========================================================================================
//                                           LUNA
// =========================================================================================

const L_ALTIPLANICIE = col(178, 176, 170)
const L_MAR = col(92, 92, 96)
const L_RAYO = col(225, 224, 220)

/** Forma de algunos mares (semiejes en grados): ESTILIZADA. Los demás, círculos del diámetro IAU. */
const FORMA_MARES: Partial<Record<keyof typeof LUGARES_LUNA, { rLat: number; rLon: number }>> = {
  // Procellarum es irregular y alargado de norte a sur; el diámetro IAU es su dimensión mayor.
  procellarum: { rLat: 30, rLon: 17 },
  frigoris: { rLat: 5, rLon: 30 },
  australe: { rLat: 10, rLon: 14 },
}

export function generarLuna(ancho: number, alto: number, semilla = 31): PixelesPlaneta {
  const ruido = crearRuido(semilla)
  const azar = azarConSemilla(semilla)
  const g = (km: number) => kmAGrados(km, RADIO_LUNA_KM)
  const claves = (Object.keys(LUGARES_LUNA) as (keyof typeof LUGARES_LUNA)[]).filter((k) => k !== 'tycho')
  const mares = claves.map((k) => {
    const m = LUGARES_LUNA[k]
    const f = FORMA_MARES[k]
    const radio = g(m.km) / 2
    return { c: centro(m.lat, m.lon), radio, cosMax: Math.cos(Math.min(180, radio * 1.4) * GRAD), e: f ? elipse(m.lat, m.lon, f.rLat, f.rLon) : null }
  })

  const R = reticula(ancho / 4, alto / 4)
  const marB = campoVacio(R.ancho, R.alto)
  for (let j = 0; j < R.alto; j++)
    for (let i = 0; i < R.ancho; i++) {
      const x = R.cosLat[j] * R.cosLon[i]
      const y = R.cosLat[j] * R.sinLon[i]
      const z = R.sinLat[j]
      const r1 = ruido.fbm(x * 5, y * 5, z * 5, 3)
      let mar = 0
      for (const m of mares) {
        let d: number
        if (m.e) d = enElipse(m.e, R.lat[j], R.lon[i])
        else {
          const ca = cosArco(R, j, i, m.c)
          if (ca < m.cosMax) continue
          d = arcoDeCos(ca) / m.radio
        }
        mar = Math.max(mar, 1 - suave(0.6, 1.15, d + r1 * 0.45))
      }
      marB.datos[j * R.ancho + i] = mar
    }

  const losa = losaPeriodica(LOSA, [64, 32, 16, 8, 4], semilla)
  const h = campoVacio(ancho, alto)
  for (let j = 0; j < alto; j++) for (let i = 0; i < ancho; i++) h.datos[j * ancho + i] = enLosa(losa, i, j) * 0.06
  // Cráteres al azar (estilizados).
  const cr = Math.round(1800 * (ancho / 1024))
  for (let n = 0; n < cr; n++) {
    const lat = Math.asin(azar() * 2 - 1) / GRAD
    const lon = azar() * 360 - 180
    const radioKm = 4 * Math.pow(azar(), -0.8)
    if (radioKm > 150) continue
    const prof = 0.05 + Math.sqrt(radioKm) * 0.03
    estampar(h, lat, lon, g(radioKm), 2.5, (r) => crater(r, prof))
  }
  const T = LUGARES_LUNA.tycho
  estampar(h, T.lat, T.lon, g(T.km) / 2, 2.5, (r) => crater(r, 0.4))

  // Rayos de Tycho (estilizados): franjas claras que salen del cráter hasta ~1500 km.
  const rayos: number[] = []
  for (let n = 0; n < 40; n++) rayos.push(azar() * 360, 0.3 + azar() * 0.7)
  const largoRayo = g(1500)
  const cT = centro(T.lat, T.lon)
  const cosLargo = Math.cos(largoRayo * GRAD)

  const RF = reticula(ancho, alto)
  const color = new Uint8Array(ancho * alto * 4)
  const amp = new Ampliador(R, ancho, alto)
  const fM = new Float32Array(ancho)
  for (let j = 0; j < alto; j++) {
    amp.fila(marB, j, fM)
    for (let i = 0; i < ancho; i++) {
      const k = j * ancho + i
      const d = enLosa(losa, i, j)
      const mar = limitar(fM[i] * (0.92 + d * 0.3))
      let r = mezclar(L_ALTIPLANICIE[0], L_MAR[0], mar)
      let gg = mezclar(L_ALTIPLANICIE[1], L_MAR[1], mar)
      let b = mezclar(L_ALTIPLANICIE[2], L_MAR[2] * 1.03, mar)
      const ca = cosArco(RF, j, i, cT)
      if (ca > cosLargo) {
        const dist = arcoDeCos(ca)
        const dl = dLon(RF.lon[i], T.lon) * GRAD
        const rumbo = (Math.atan2(Math.sin(dl) * RF.cosLat[j], cT.c * RF.sinLat[j] - cT.s * RF.cosLat[j] * Math.cos(dl)) / GRAD + 360) % 360
        let rayo = 1 - suave(0, g(T.km) * 1.5, dist)
        const anchoRayo = 2.5 + 7 * (1 - dist / largoRayo)
        for (let n = 0; n < rayos.length; n += 2) {
          const dif = Math.abs(dLon(rumbo, rayos[n]))
          if (dif < anchoRayo) rayo = Math.max(rayo, (1 - suave(0, anchoRayo, dif)) * rayos[n + 1] * (1 - suave(0, largoRayo * rayos[n + 1], dist)))
        }
        r = mezclar(r, L_RAYO[0], rayo * 0.4)
        gg = mezclar(gg, L_RAYO[1], rayo * 0.4)
        b = mezclar(b, L_RAYO[2], rayo * 0.4)
      }
      const m = 1 + d * 0.07 + limitar(h.datos[k] * 0.3, -0.1, 0.06)
      color[k * 4] = byte(r * m)
      color[k * 4 + 1] = byte(gg * m)
      color[k * 4 + 2] = byte(b * m)
      color[k * 4 + 3] = 255
    }
  }
  return { color, relieve: pendientes(h, ESCALA_RELIEVE) }
}
