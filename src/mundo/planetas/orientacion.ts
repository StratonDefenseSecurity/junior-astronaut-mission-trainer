// Orientación real de los globos para una fecha: hacia dónde apunta el polo norte y cuánto
// ha girado el planeta sobre su eje, más la dirección del Sol. Todo en el marco de la escena
// de ../cielo/marco.ts (Y = norte celeste, X = punto vernal, Z = -Y de EQJ).
//
//  - Tierra: tiempo sidéreo aparente de Greenwich + precesión y nutación (astronomy-engine:
//    SiderealTime y Rotation_EQD_EQJ). Es el mismo modelo que usa astronomy-engine para ubicar
//    a un observador en la superficie. No incluye el movimiento del polo (< 1 segundo de arco).
//  - Marte y Luna: elementos de rotación de la IAU (WGCCRE 2015) vía RotationAxis: el polo
//    (α0, δ0) y el ángulo W del meridiano cero, medido desde el nodo ascendente del ecuador del
//    cuerpo sobre el ecuador J2000. En la Luna esto deja la cara visible mirando a la Tierra
//    (con su libración real).
//
// Marco LOCAL de cada globo (el de la textura y de latLonAVector):
//   +X = latitud 0, longitud 0;  +Y = polo norte;  -Z = longitud 90° E.
// Es eqjAEscena aplicado a los ejes del cuerpo (meridiano, este, polo), así que la orientación
// del globo es simplemente la rotación que lleva esos ejes a sus direcciones reales.
import * as THREE from 'three'
import { AstroTime, Body, GeoMoon, GeoVector, HelioVector, MakeTime, RotateVector, RotationAxis, Rotation_EQD_EQJ, SiderealTime, Vector } from 'astronomy-engine'
import { eqjAEscena } from '../cielo/marco'

export type CuerpoGlobo = 'tierra' | 'marte' | 'luna'

/**
 * Fecha de la misión: un Date, milisegundos Unix (Date.getTime()) o una función que devuelve
 * cualquiera de los dos (se evalúa en cada cuadro; así no hace falta re-renderizar React).
 */
export type Fecha = Date | number | (() => Date | number)

export const msDeFecha = (f: Fecha): number => {
  const v = typeof f === 'function' ? f() : f
  return typeof v === 'number' ? v : v.getTime()
}

const GRAD = Math.PI / 180

/**
 * Posición de un punto de latitud y longitud planetocéntricas (grados, longitud positiva al
 * este) sobre una esfera de radio `radio`, en el marco LOCAL del globo (antes de orientarlo).
 * Coincide con la textura equirectangular de THREE.SphereGeometry.
 */
export function latLonAVector(lat: number, lon: number, radio = 1, salida = new THREE.Vector3()): THREE.Vector3 {
  const f = lat * GRAD
  const l = lon * GRAD
  const c = Math.cos(f)
  return salida.set(radio * c * Math.cos(l), radio * Math.sin(f), -radio * c * Math.sin(l))
}

/** Inversa de latLonAVector: latitud y longitud (grados) de un vector en el marco local. */
export function vectorALatLon(v: THREE.Vector3): { lat: number; lon: number } {
  const r = v.length() || 1
  return { lat: Math.asin(Math.max(-1, Math.min(1, v.y / r))) / GRAD, lon: Math.atan2(-v.z, v.x) / GRAD }
}

/** Ejes del cuerpo en EQJ: meridiano cero en el ecuador, longitud 90° E y polo norte. */
interface Ejes {
  m: [number, number, number]
  e: [number, number, number]
  p: [number, number, number]
}

const cruz = (a: readonly number[], b: readonly number[]): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unitario = (a: [number, number, number]): [number, number, number] => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / n, a[1] / n, a[2] / n]
}

function ejesCuerpo(cuerpo: CuerpoGlobo, t: AstroTime): Ejes {
  if (cuerpo === 'tierra') {
    // Greenwich en el ecuador verdadero de la fecha está en AR = GAST; luego se pasa a J2000.
    const rot = Rotation_EQD_EQJ(t)
    const g = SiderealTime(t) * 15 * GRAD
    const a = (x: number, y: number, z: number): [number, number, number] => {
      const v = RotateVector(rot, new Vector(x, y, z, t))
      return [v.x, v.y, v.z]
    }
    return { m: a(Math.cos(g), Math.sin(g), 0), e: a(-Math.sin(g), Math.cos(g), 0), p: a(0, 0, 1) }
  }
  const eje = RotationAxis(cuerpo === 'marte' ? Body.Mars : Body.Moon, t)
  const p = unitario([eje.north.x, eje.north.y, eje.north.z])
  // Nodo ascendente del ecuador del cuerpo sobre el ecuador J2000: Q = Z × P (AR = α0 + 90°).
  const q = unitario(cruz([0, 0, 1], p))
  const pq = cruz(p, q)
  const w = eje.spin * GRAD
  const c = Math.cos(w)
  const s = Math.sin(w)
  const m: [number, number, number] = [q[0] * c + pq[0] * s, q[1] * c + pq[1] * s, q[2] * c + pq[2] * s]
  return { m, e: cruz(p, m), p }
}

const tmpM = new THREE.Vector3()
const tmpE = new THREE.Vector3()
const tmpP = new THREE.Vector3()
const tmpMat = new THREE.Matrix4()

/**
 * Rotación (cuaternión) que lleva el marco local del globo a la escena para esa fecha.
 * Se aplica al grupo que contiene la esfera texturizada.
 */
export function orientacionCuerpo(cuerpo: CuerpoGlobo, fecha: Date | number, salida = new THREE.Quaternion()): THREE.Quaternion {
  const t = MakeTime(typeof fecha === 'number' ? new Date(fecha) : fecha)
  const { m, e, p } = ejesCuerpo(cuerpo, t)
  eqjAEscena(m[0], m[1], m[2], tmpM)
  eqjAEscena(e[0], e[1], e[2], tmpE).negate()
  eqjAEscena(p[0], p[1], p[2], tmpP)
  // Columnas: local X → meridiano cero, local Y → polo, local Z → -este.
  tmpMat.makeBasis(tmpM, tmpP, tmpE)
  return salida.setFromRotationMatrix(tmpMat)
}

/**
 * Dirección unitaria del cuerpo hacia el Sol, en el marco de la escena (válida en el grupo
 * padre del globo si ese grupo no está girado respecto de la escena).
 */
export function direccionSolEscena(cuerpo: CuerpoGlobo, fecha: Date | number, salida = new THREE.Vector3()): THREE.Vector3 {
  const d = typeof fecha === 'number' ? new Date(fecha) : fecha
  let x: number
  let y: number
  let z: number
  if (cuerpo === 'marte') {
    const v = HelioVector(Body.Mars, d)
    x = -v.x
    y = -v.y
    z = -v.z
  } else {
    const s = GeoVector(Body.Sun, d, true)
    x = s.x
    y = s.y
    z = s.z
    if (cuerpo === 'luna') {
      const l = GeoMoon(d)
      x -= l.x
      y -= l.y
      z -= l.z
    }
  }
  return eqjAEscena(x, y, z, salida).normalize()
}

/** Ritmo medio de giro (grados por día) para interpolar entre cálculos completos. */
const GIRO_GRADOS_DIA: Record<CuerpoGlobo, number> = {
  // Tiempo sidéreo: 360.98564736629°/día (IAU 1982, el que usa GAST).
  tierra: 360.98564736629,
  // W de Marte y la Luna en el informe WGCCRE 2015 (términos lineales).
  marte: 350.891982443297,
  luna: 13.17635815,
}

/** Cada cuánto (en tiempo de misión) se recalcula todo con astronomy-engine. */
const ANCLA_MS = 3600_000

/**
 * Orientación y Sol de un cuerpo que se actualizan cada cuadro sin crear objetos: hace el
 * cálculo completo como mucho una vez por hora de tiempo de misión y, en medio, gira el globo
 * a su ritmo medio alrededor de su eje (el error es de centésimas de grado).
 */
export class RelojCuerpo {
  readonly cuaternion = new THREE.Quaternion()
  readonly sol = new THREE.Vector3(1, 0, 0)
  private anclaMs = Number.NaN
  private anclaQ = new THREE.Quaternion()
  private giro = new THREE.Quaternion()
  private static readonly Y = new THREE.Vector3(0, 1, 0)

  constructor(readonly cuerpo: CuerpoGlobo) {}

  /** Actualiza para el instante `ms` (milisegundos Unix). */
  actualizar(ms: number): this {
    if (!Number.isFinite(ms)) return this
    if (!(Math.abs(ms - this.anclaMs) <= ANCLA_MS)) {
      this.anclaMs = ms
      orientacionCuerpo(this.cuerpo, ms, this.anclaQ)
      direccionSolEscena(this.cuerpo, ms, this.sol)
    }
    const angulo = (((ms - this.anclaMs) / 86_400_000) * GIRO_GRADOS_DIA[this.cuerpo] * GRAD) % (2 * Math.PI)
    this.giro.setFromAxisAngle(RelojCuerpo.Y, angulo)
    this.cuaternion.copy(this.anclaQ).multiply(this.giro)
    return this
  }
}
