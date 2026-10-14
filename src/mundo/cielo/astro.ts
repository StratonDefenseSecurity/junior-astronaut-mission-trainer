// Cálculos astronómicos del cielo: dónde están el Sol, los planetas, la Luna y la nave en una
// fecha, cómo se ven desde cualquier punto del sistema solar y cuándo abre cada ventana de
// lanzamiento a Marte. Todas las posiciones son vectores heliocéntricos en el sistema ecuatorial
// J2000 (EQJ), en unidades astronómicas (UA), como los entrega astronomy-engine (efemérides
// validadas contra JPL Horizons). Para pasarlos a la escena, ver marco.ts.
import {
  Body,
  Ecliptic,
  HelioVector,
  MakeTime,
  Observer,
  Rotation_EQJ_HOR,
  RotationAxis,
} from 'astronomy-engine'
import * as THREE from 'three'
import { UA_KM, eqjAEscena } from './marco'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type Cuerpo = 'Sol' | 'Mercurio' | 'Venus' | 'Tierra' | 'Luna' | 'Marte' | 'Jupiter' | 'Saturno'

export const CUERPOS: readonly Cuerpo[] = ['Sol', 'Mercurio', 'Venus', 'Tierra', 'Luna', 'Marte', 'Jupiter', 'Saturno']

/** Nombre para mostrar en pantalla. */
export const NOMBRE_CUERPO: Record<Cuerpo, string> = {
  Sol: 'Sol',
  Mercurio: 'Mercurio',
  Venus: 'Venus',
  Tierra: 'Tierra',
  Luna: 'Luna',
  Marte: 'Marte',
  Jupiter: 'Júpiter',
  Saturno: 'Saturno',
}

const CUERPO_AE: Record<Cuerpo, Body> = {
  Sol: Body.Sun,
  Mercurio: Body.Mercury,
  Venus: Body.Venus,
  Tierra: Body.Earth,
  Luna: Body.Moon,
  Marte: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturno: Body.Saturn,
}

/**
 * Radio medio volumétrico en km. Fuente: NASA, Planetary Fact Sheets
 * (https://nssdc.gsfc.nasa.gov/planetary/factsheet/); el del Sol es el radio nominal de la
 * IAU 2015 (Resolución B3), el mismo de la Sun Fact Sheet.
 */
export const RADIO_KM: Record<Cuerpo, number> = {
  Sol: 695_700,
  Mercurio: 2_439.7,
  Venus: 6_051.8,
  Tierra: 6_371.0,
  Luna: 1_737.4,
  Marte: 3_389.5,
  Jupiter: 69_911,
  Saturno: 58_232,
}

/**
 * Parámetro gravitacional del Sol en UA³/día²: el cuadrado de la constante gravitacional de
 * Gauss k = 0.01720209895 (IAU 1976), que define la UA de las efemérides clásicas.
 */
export const MU_SOL = 0.01720209895 ** 2

const GRADOS = 180 / Math.PI
const DIA_MS = 86_400_000

// ------------------------------------------------------------------ vectores

const resta = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const punto = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cruz = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const largo = (a: Vec3) => Math.sqrt(punto(a, a))
const escalar = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k })
const suma = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const angulo = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, punto(a, b) / (largo(a) * largo(b)))))

/** Posición heliocéntrica (EQJ, UA) de un cuerpo. Geométrica: sin corregir por tiempo de luz. */
export function vectorHelio(cuerpo: Cuerpo, fecha: Date): Vec3 {
  if (cuerpo === 'Sol') return { x: 0, y: 0, z: 0 }
  const v = HelioVector(CUERPO_AE[cuerpo], fecha)
  return { x: v.x, y: v.y, z: v.z }
}

/** Dirección unitaria (EQJ) y distancia (UA) de `objetivo` vista desde `observador`. */
export function vistoDesde(observador: Vec3, objetivo: Vec3): { direccion: Vec3; distanciaUA: number } {
  const d = resta(objetivo, observador)
  const r = largo(d)
  return { direccion: r > 0 ? escalar(d, 1 / r) : { x: 0, y: 0, z: 0 }, distanciaUA: r }
}

// ------------------------------------------------------------------- brillo

/**
 * Magnitud visual aparente (banda V) de un cuerpo visto desde cualquier punto.
 *
 * Planetas: Mallama, A. y Hilton, J. L. (2018), "Computing apparent planetary magnitudes for The
 * Astronomical Almanac", Astronomy and Computing 25, 10-24 (https://arxiv.org/abs/1808.01973),
 * las fórmulas actuales del Astronomical Almanac. Todas tienen la forma
 *     V = 5·log10(r·d) + V(1, α)
 * con r = distancia Sol-planeta y d = distancia observador-planeta en UA, y α el ángulo de fase
 * (Sol-planeta-observador). El artículo incluye curvas de fase para ángulos que no se ven desde la
 * Tierra (útiles desde una nave): Ec. 2 Mercurio, 3-4 Venus, 5 Tierra, 6-7 Marte, 8-9 Júpiter,
 * 10 y 12 Saturno. Aproximaciones: en Marte se omiten las correcciones por longitud y estación
 * (menos de 0.06 mag); en Saturno, con α > 6.5° el artículo solo da el globo sin anillos (Ec. 12);
 * fuera del rango de validez de cada polinomio se usa el valor del borde.
 * Luna: misma fórmula que astronomy-engine (MoonMagnitude), con la distancia al observador.
 * Sol: V = -26.74 a 1 UA (NASA Sun Fact Sheet), más 5·log10(d).
 */
export function magnitudAparente(cuerpo: Cuerpo, fecha: Date, observador: Vec3): number {
  const p = vectorHelio(cuerpo, fecha)
  return magnitudConGeometria(cuerpo, fecha, p, observador)
}

function magnitudConGeometria(cuerpo: Cuerpo, fecha: Date, p: Vec3, observador: Vec3): number {
  const haciaObs = resta(observador, p)
  const d = largo(haciaObs)
  if (cuerpo === 'Sol') return -26.74 + 5 * Math.log10(d)
  const r = largo(p)
  const a = angulo(escalar(p, -1), haciaObs) * GRADOS // ángulo de fase en grados
  const base = 5 * Math.log10(r * d)
  const lim = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))
  switch (cuerpo) {
    case 'Mercurio': {
      const x = lim(a, 2.1, 169.5)
      return base - 0.613 + 6.328e-2 * x - 1.6336e-3 * x ** 2 + 3.3644e-5 * x ** 3 - 3.4265e-7 * x ** 4 + 1.6893e-9 * x ** 5 - 3.0334e-12 * x ** 6
    }
    case 'Venus': {
      if (a <= 163.7) return base - 4.384 - 1.044e-3 * a + 3.687e-4 * a ** 2 - 2.814e-6 * a ** 3 + 8.938e-9 * a ** 4
      const x = Math.min(a, 179)
      return base + 236.05828 - 2.81914 * x + 8.39034e-3 * x ** 2
    }
    case 'Tierra':
      return base - 3.99 - 1.06e-3 * a + 2.054e-4 * a ** 2
    case 'Marte':
      if (a <= 50) return base - 1.601 + 0.02267 * a - 0.0001302 * a ** 2
      return base - 0.367 - 0.02573 * a + 0.0003445 * a ** 2
    case 'Jupiter': {
      if (a <= 12) return base - 9.395 - 3.7e-4 * a + 6.16e-4 * a ** 2
      const x = Math.min(a, 130) / 180
      return base - 9.428 - 2.5 * Math.log10(1 - 1.507 * x - 0.363 * x ** 2 - 0.062 * x ** 3 + 2.809 * x ** 4 - 1.876 * x ** 5)
    }
    case 'Saturno': {
      if (a <= 6.5) {
        // Inclinación efectiva de los anillos: media geométrica de las latitudes saturnocéntricas
        // del observador y del Sol; si el Sol ilumina la otra cara de los anillos, cuenta 0.
        const polo = RotationAxis(Body.Saturn, fecha).north
        const bE = Math.asin(lim(punto(polo, haciaObs) / d, -1, 1))
        const bS = Math.asin(lim(-punto(polo, p) / r, -1, 1))
        const beta = bE * bS > 0 ? Math.sqrt(bE * bS) : 0
        const s = Math.sin(beta)
        return base - 8.914 - 1.825 * s + 0.026 * a - 0.378 * s * Math.exp(-2.25 * a)
      }
      const x = Math.min(a, 150)
      return base - 8.94 + 2.446e-4 * x + 2.672e-4 * x ** 2 - 1.505e-6 * x ** 3 + 4.767e-9 * x ** 4
    }
    case 'Luna': {
      const rad = a / GRADOS
      const distanciaMediaLunaUA = 385_000.6 / UA_KM
      return -12.717 + 1.49 * Math.abs(rad) + 0.0431 * rad ** 4 + 5 * Math.log10(r * (d / distanciaMediaLunaUA))
    }
  }
}

// ------------------------------------------------------- cuerpos en el cielo

export interface InfoCuerpo {
  /** Dirección unitaria en coordenadas de escena (marco.ts) vista desde el observador. */
  direccion: THREE.Vector3
  distanciaUA: number
  /** Diámetro angular aparente en radianes. */
  tamanoAngularRad: number
  /** Magnitud visual aparente. */
  magnitud: number
  /** Ángulo Sol-cuerpo-observador en grados (0 = lleno, 180 = nuevo). 0 para el Sol. */
  anguloFaseGrados: number
  /** Fracción del disco iluminada que ve el observador (0..1). */
  fraccionIluminada: number
  /** false si el observador está dentro o sobre el cuerpo (no tiene sentido verlo desde fuera). */
  visible: boolean
}

/**
 * Sol, planetas y Luna vistos desde `observador` (heliocéntrico, EQJ, UA) en `fecha`.
 * Sirve para que la escena ponga globos detallados en la dirección y con el tamaño correctos.
 */
export function cuerposVisibles(fecha: Date, observador: Vec3): Record<Cuerpo, InfoCuerpo> {
  const salida = {} as Record<Cuerpo, InfoCuerpo>
  for (const c of CUERPOS) {
    const p = vectorHelio(c, fecha)
    const { direccion, distanciaUA } = vistoDesde(observador, p)
    const radioUA = RADIO_KM[c] / UA_KM
    const visible = distanciaUA > radioUA * 1.0001
    const fase = c === 'Sol' || !visible ? 0 : angulo(escalar(p, -1), resta(observador, p)) * GRADOS
    salida[c] = {
      direccion: eqjAEscena(direccion.x, direccion.y, direccion.z),
      distanciaUA,
      tamanoAngularRad: visible ? 2 * Math.asin(radioUA / distanciaUA) : Math.PI,
      magnitud: visible ? magnitudConGeometria(c, fecha, p, observador) : Number.NaN,
      anguloFaseGrados: fase,
      fraccionIluminada: c === 'Sol' ? 1 : (1 + Math.cos(fase / GRADOS)) / 2,
      visible,
    }
  }
  return salida
}

// ------------------------------------------------- trayectoria de la nave

function stumpffC(z: number): number {
  if (z > 1e-8) return (1 - Math.cos(Math.sqrt(z))) / z
  if (z < -1e-8) return (Math.cosh(Math.sqrt(-z)) - 1) / -z
  return 1 / 2 - z / 24
}
function stumpffS(z: number): number {
  if (z > 1e-8) {
    const s = Math.sqrt(z)
    return (s - Math.sin(s)) / (s * s * s)
  }
  if (z < -1e-8) {
    const s = Math.sqrt(-z)
    return (Math.sinh(s) - s) / (s * s * s)
  }
  return 1 / 6 - z / 120
}

/** Polo norte de la eclíptica J2000 en EQJ (oblicuidad 23.4392911°, IAU 1976). */
const POLO_ECLIPTICA: Vec3 = (() => {
  const e = 23.4392911 / GRADOS
  return { x: 0, y: -Math.sin(e), z: Math.cos(e) }
})()

/**
 * Problema de Lambert (una vuelta, sentido directo alrededor del polo de la eclíptica): la órbita
 * kepleriana alrededor del Sol que va de r1 a r2 en `dias`. Variables universales, algoritmo 5.2
 * de Curtis, "Orbital Mechanics for Engineering Students"; la ecuación en z se resuelve por
 * bisección (el tiempo de vuelo crece con z), que es robusta.
 */
export function resolverLambert(r1: Vec3, r2: Vec3, dias: number, mu = MU_SOL): { v1: Vec3; v2: Vec3; anguloBarridoGrados: number } {
  const R1 = largo(r1)
  const R2 = largo(r2)
  let th = angulo(r1, r2)
  if (punto(cruz(r1, r2), POLO_ECLIPTICA) < 0) th = 2 * Math.PI - th
  const A = Math.sin(th) * Math.sqrt((R1 * R2) / (1 - Math.cos(th)))
  if (!Number.isFinite(A) || Math.abs(A) < 1e-12) throw new Error('Lambert: los puntos están alineados con el Sol (plano indefinido)')
  const y = (z: number) => R1 + R2 + (A * (z * stumpffS(z) - 1)) / Math.sqrt(stumpffC(z))
  const tiempo = (z: number) => {
    const yz = y(z)
    if (yz < 0) return -Infinity
    return (Math.pow(yz / stumpffC(z), 1.5) * stumpffS(z) + A * Math.sqrt(yz)) / Math.sqrt(mu)
  }
  let lo = -4 * Math.PI * Math.PI
  let hi = 4 * Math.PI * Math.PI - 1e-9
  while (tiempo(lo) > dias) lo *= 2
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2
    if (tiempo(m) < dias) lo = m
    else hi = m
  }
  const z = (lo + hi) / 2
  const yz = y(z)
  const f = 1 - yz / R1
  const g = A * Math.sqrt(yz / mu)
  const gp = 1 - yz / R2
  return {
    v1: escalar(resta(r2, escalar(r1, f)), 1 / g),
    v2: escalar(resta(escalar(r2, gp), r1), 1 / g),
    anguloBarridoGrados: th * GRADOS,
  }
}

/** Posición tras `dias` en la órbita kepleriana que pasa por r0 con velocidad v0 (Curtis, alg. 3.3-3.4). */
export function propagarKepler(r0: Vec3, v0: Vec3, dias: number, mu = MU_SOL): Vec3 {
  const R0 = largo(r0)
  const vr0 = punto(r0, v0) / R0
  const alfa = 2 / R0 - punto(v0, v0) / mu
  const sm = Math.sqrt(mu)
  let x = sm * Math.abs(alfa) * dias
  for (let i = 0; i < 100; i++) {
    const z = alfa * x * x
    const C = stumpffC(z)
    const S = stumpffS(z)
    const F = ((R0 * vr0) / sm) * x * x * C + (1 - alfa * R0) * x * x * x * S + R0 * x - sm * dias
    const dF = ((R0 * vr0) / sm) * x * (1 - z * S) + (1 - alfa * R0) * x * x * C + R0
    const paso = F / dF
    x -= paso
    if (Math.abs(paso) < 1e-13) break
  }
  const z = alfa * x * x
  const f = 1 - ((x * x) / R0) * stumpffC(z)
  const g = dias - (x * x * x * stumpffS(z)) / sm
  return suma(escalar(r0, f), escalar(v0, g))
}

export interface Trayectoria {
  salida: Date
  llegada: Date
  dias: number
  /** Posición y velocidad heliocéntricas (UA, UA/día) al salir de la Tierra y al llegar a Marte. */
  r1: Vec3
  v1: Vec3
  r2: Vec3
  v2: Vec3
  /** Ángulo que recorre la nave alrededor del Sol, en grados. */
  anguloBarridoGrados: number
  /** Velocidad de la nave respecto de la Tierra al salir y respecto de Marte al llegar (km/s). */
  vInfSalidaKmS: number
  vInfLlegadaKmS: number
}

let cache: Trayectoria | null = null

/** Trayectoria de transferencia Tierra -> Marte entre dos fechas (solución de Lambert real). */
export function trayectoria(salida: Date, llegada: Date): Trayectoria {
  if (cache && cache.salida.getTime() === salida.getTime() && cache.llegada.getTime() === llegada.getTime()) return cache
  const dias = (llegada.getTime() - salida.getTime()) / DIA_MS
  if (!(dias > 0)) throw new Error('trayectoria: la llegada debe ser posterior a la salida')
  const r1 = vectorHelio('Tierra', salida)
  const r2 = vectorHelio('Marte', llegada)
  const { v1, v2, anguloBarridoGrados } = resolverLambert(r1, r2, dias)
  // Velocidades de los planetas por diferencia centrada de una hora (suficiente para v-infinito).
  const velocidad = (c: Cuerpo, t: Date): Vec3 => {
    const h = 3_600_000
    const a = vectorHelio(c, new Date(t.getTime() - h))
    const b = vectorHelio(c, new Date(t.getTime() + h))
    return escalar(resta(b, a), DIA_MS / (2 * h))
  }
  const kms = UA_KM / 86_400
  cache = {
    salida: new Date(salida.getTime()),
    llegada: new Date(llegada.getTime()),
    dias,
    r1,
    v1,
    r2,
    v2,
    anguloBarridoGrados,
    vInfSalidaKmS: largo(resta(v1, velocidad('Tierra', salida))) * kms,
    vInfLlegadaKmS: largo(resta(v2, velocidad('Marte', llegada))) * kms,
  }
  return cache
}

/**
 * Posición heliocéntrica (EQJ, UA) de la nave en la fracción `f` (0..1) del viaje. Es un arco
 * kepleriano real alrededor del Sol (Lambert) que sale del centro de la Tierra en `salida` y llega
 * al centro de Marte en `llegada`; ignora la gravedad de los planetas cerca de cada extremo y las
 * maniobras de corrección, como en un diseño preliminar de misión.
 */
export function posicionNave(salida: Date, llegada: Date, f: number): Vec3 {
  const t = trayectoria(salida, llegada)
  if (f <= 0) return { ...t.r1 }
  if (f >= 1) return { ...t.r2 }
  return propagarKepler(t.r1, t.v1, f * t.dias)
}

// --------------------------------------------------- ventanas de lanzamiento

/**
 * Semiejes mayores medios (UA) de la Tierra y Marte, J2000: Standish, "Keplerian Elements for
 * Approximate Positions of the Major Planets", JPL (https://ssd.jpl.nasa.gov/planets/approx_pos.html),
 * los mismos de d3-celestial/data/planets.json.
 */
const A_TIERRA = 1.00000261
const A_MARTE = 1.52371034

/** Duración de una transferencia de Hohmann Tierra-Marte (órbitas circulares y coplanares), en días. */
export const DURACION_HOHMANN_DIAS = Math.PI * Math.sqrt(((A_TIERRA + A_MARTE) / 2) ** 3 / MU_SOL)

/**
 * Ángulo que Marte debe llevar de ventaja a la Tierra (longitud heliocéntrica) al despegar para
 * una transferencia de Hohmann: 180° menos lo que avanza Marte durante el viaje. Sale ≈ 44.3°.
 * Es la aproximación de órbitas circulares; las misiones reales afinan la fecha con Lambert.
 */
export const FASE_HOHMANN_GRADOS = 180 - 360 * (DURACION_HOHMANN_DIAS / (2 * Math.PI * Math.sqrt(A_MARTE ** 3 / MU_SOL)))

/** Longitud heliocéntrica eclíptica de Marte menos la de la Tierra, en (-180, 180]. */
export function faseMarteTierra(fecha: Date): number {
  const lm = Ecliptic(HelioVector(Body.Mars, fecha)).elon
  const lt = Ecliptic(HelioVector(Body.Earth, fecha)).elon
  return envolver180(lm - lt)
}

const envolver180 = (x: number) => {
  const y = (((x + 180) % 360) + 360) % 360 - 180
  return y === -180 ? 180 : y
}

/** Fechas, ordenadas, en que Marte va `anguloGrados` por delante de la Tierra (0 = oposición). */
export function fechasConFase(anguloGrados: number, desde: Date, hasta: Date): Date[] {
  const h = (ms: number) => envolver180(faseMarteTierra(new Date(ms)) - anguloGrados)
  const paso = 5 * DIA_MS
  const fechas: Date[] = []
  let t0 = desde.getTime()
  let h0 = h(t0)
  for (let t1 = t0 + paso; t0 < hasta.getTime(); t1 += paso) {
    const h1 = h(t1)
    // La Tierra alcanza a Marte, así que la diferencia baja y cruza el cero de + a -.
    if (h0 >= 0 && h1 < 0 && h0 - h1 < 90) {
      let a = t0
      let b = t1
      while (b - a > 60_000) {
        const m = (a + b) / 2
        if (h(m) >= 0) a = m
        else b = m
      }
      const raiz = (a + b) / 2
      if (raiz >= desde.getTime() && raiz <= hasta.getTime()) fechas.push(new Date(Math.round(raiz)))
    }
    t0 = t1
    h0 = h1
  }
  return fechas
}

/** Fechas de despegue a Marte según el ángulo de fase de Hohmann, ordenadas. */
export function ventanasDeLanzamiento(desde: Date, hasta: Date): Date[] {
  return fechasConFase(FASE_HOHMANN_GRADOS, desde, hasta)
}

// ------------------------------------------------- horizonte en la superficie

export interface MarcoHorizonte {
  este: Vec3
  cenit: Vec3
  norte: Vec3
}

/**
 * Ejes del horizonte local (EQJ) en un punto de la superficie con el modelo de rotación de la
 * IAU (WGCCRE 2015, vía astronomy-engine RotationAxis). La longitud es planetocéntrica y
 * positiva hacia el este (la convención actual para Marte).
 */
export function marcoHorizonteIAU(cuerpo: Cuerpo, fecha: Date, latitudGrados: number, longitudEsteGrados: number): MarcoHorizonte {
  const eje = RotationAxis(CUERPO_AE[cuerpo], fecha)
  const n: Vec3 = { x: eje.north.x, y: eje.north.y, z: eje.north.z }
  const ra0 = (eje.ra * 15) / GRADOS
  // Nodo ascendente del ecuador del cuerpo sobre el ecuador J2000: AR = α0 + 90°.
  const q: Vec3 = { x: -Math.sin(ra0), y: Math.cos(ra0), z: 0 }
  const nq = cruz(n, q)
  const ang = (eje.spin + longitudEsteGrados) / GRADOS
  const meridiano = suma(escalar(q, Math.cos(ang)), escalar(nq, Math.sin(ang)))
  const este = suma(escalar(q, -Math.sin(ang)), escalar(nq, Math.cos(ang)))
  const lat = latitudGrados / GRADOS
  return {
    este,
    cenit: suma(escalar(meridiano, Math.cos(lat)), escalar(n, Math.sin(lat))),
    norte: suma(escalar(meridiano, -Math.sin(lat)), escalar(n, Math.cos(lat))),
  }
}

/**
 * Ejes del horizonte local (EQJ). En la Tierra usa la rotación completa de astronomy-engine
 * (precesión, nutación y tiempo sidéreo); en Marte, el modelo IAU.
 */
export function marcoHorizonte(cuerpo: 'Tierra' | 'Marte', fecha: Date, latitudGrados: number, longitudEsteGrados: number): MarcoHorizonte {
  if (cuerpo === 'Marte') return marcoHorizonteIAU('Marte', fecha, latitudGrados, longitudEsteGrados)
  // Filas de la rotación EQJ -> HOR: x = norte, y = oeste, z = cenit.
  const m = Rotation_EQJ_HOR(MakeTime(fecha), new Observer(latitudGrados, longitudEsteGrados, 0)).rot
  const fila = (i: number): Vec3 => ({ x: m[0][i], y: m[1][i], z: m[2][i] })
  const oeste = fila(1)
  return { norte: fila(0), este: escalar(oeste, -1), cenit: fila(2) }
}

/**
 * Rotación del cielo para un observador parado en la superficie: deja el cenit en +Y, el norte en
 * -Z y el este en +X de la escena. Se pasa como `orientacion` a <Cielo>. Si el terreno del juego
 * tiene el norte en otra dirección, se compone con un giro alrededor de Y.
 */
export function orientacionSuperficie(cuerpo: 'Tierra' | 'Marte', fecha: Date, latitudGrados: number, longitudEsteGrados: number): THREE.Quaternion {
  const { este, cenit, norte } = marcoHorizonte(cuerpo, fecha, latitudGrados, longitudEsteGrados)
  const e = eqjAEscena(este.x, este.y, este.z)
  const u = eqjAEscena(cenit.x, cenit.y, cenit.z)
  const s = eqjAEscena(-norte.x, -norte.y, -norte.z)
  const m = new THREE.Matrix4().set(e.x, e.y, e.z, 0, u.x, u.y, u.z, 0, s.x, s.y, s.z, 0, 0, 0, 0, 1)
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

const tmpAltura = new THREE.Vector3()

/** Altura sobre el horizonte (grados) de una dirección de escena, tras aplicar `orientacion`. */
export function alturaGrados(direccionEscena: THREE.Vector3, orientacion: THREE.Quaternion): number {
  tmpAltura.copy(direccionEscena).normalize().applyQuaternion(orientacion)
  return Math.asin(Math.max(-1, Math.min(1, tmpAltura.y))) * GRADOS
}
