// Mecánica orbital de dos cuerpos que comparten el servidor y el cliente: el problema de Lambert
// (qué órbita une dos puntos en un tiempo dado) y la propagación kepleriana. Vectores en el
// sistema ecuatorial J2000 (EQJ), en UA y días, como los entrega astronomy-engine.

export interface Vec3 {
  x: number
  y: number
  z: number
}

/**
 * Parámetro gravitacional del Sol en UA³/día²: el cuadrado de la constante gravitacional de
 * Gauss k = 0.01720209895 (IAU 1976), que define la UA de las efemérides clásicas.
 */
export const MU_SOL = 0.01720209895 ** 2

const GRADOS = 180 / Math.PI

const resta = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const punto = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cruz = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const largo = (a: Vec3) => Math.sqrt(punto(a, a))
const escalar = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k })
const suma = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const angulo = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, punto(a, b) / (largo(a) * largo(b)))))

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
  if (!Number.isFinite(A) || Math.abs(A) < 1e-12) throw new Error('Lambert: the points are aligned with the Sun (undefined plane)')
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
