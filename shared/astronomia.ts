// Cálculos astronómicos que comparten el servidor y el cliente, con astronomy-engine (efemérides
// validadas contra JPL Horizons).
import { Body, Ecliptic, Elongation, GeoVector, HelioVector, RotationAxis } from 'astronomy-engine'

/**
 * Longitud solar de Marte (Ls, en grados): la estación del año marciano. Ls 0 es el equinoccio
 * de primavera del norte; de Ls 180 a 360 es la primavera y el verano del sur, la temporada de
 * polvo. Se obtiene de la longitud heliocéntrica eclíptica de Marte restando 85.06°, la
 * longitud del equinoccio de Marte (el perihelio, en Ls 251°, está en longitud 336.06°).
 * Comprobado: el año marciano 34 empezó el 5 de mayo de 2017 (sale Ls 359.9) y la tormenta
 * global de 2018 arrancó hacia Ls 185 a principios de junio de 2018.
 */
export function lsMarte(fecha: Date): number {
  const lon = Ecliptic(HelioVector(Body.Mars, fecha)).elon
  return (((lon - 85.06) % 360) + 360) % 360
}

/**
 * Enlace Tierra–Marte en una fecha: distancia real en km (centro a centro, con corrección por el
 * tiempo de luz) y elongación de Marte, el ángulo Sol–Tierra–Marte en grados. Con menos de 2° es
 * la conjunción solar. Comprobado: el 14 de junio de 2015 sale 0.6°, y del 7 al 21 de junio de
 * 2015, la moratoria de órdenes de la NASA, unos 2°.
 */
export function enlaceTierraMarte(fecha: Date): { km: number; elongacion: number } {
  const km = GeoVector(Body.Mars, fecha, true).Length() * KM_POR_UA
  return { km, elongacion: Elongation(Body.Mars, fecha).elongation }
}
const KM_POR_UA = 149_597_870.7

type V3 = [number, number, number]
const punto = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unidad = (a: V3): V3 => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / n, a[1] / n, a[2] / n]
}
const GRADO = Math.PI / 180

/**
 * Dónde se ve la Tierra desde un sitio de Marte: acimut (grados desde el norte, hacia el este) y
 * elevación sobre el horizonte, más su distancia angular al Sol. Las direcciones del Sol y de la
 * Tierra salen de las efemérides (astronomy-engine) y se pasan al ecuador de Marte con su eje de
 * rotación IAU (RotationAxis). El ángulo horario del Sol sale de la hora local del juego (12 h es
 * el mediodía solar) y el de la Tierra, de su diferencia de ascensión recta con el Sol en el cielo
 * de Marte. Así la Tierra queda donde corresponde respecto del Sol que se ve en la escena.
 */
export function tierraDesdeMarte(fecha: Date, latitud: number, hora: number): { az: number; el: number; elongacion: number } {
  const m = HelioVector(Body.Mars, fecha)
  const t = HelioVector(Body.Earth, fecha)
  const aTierra: V3 = [t.x - m.x, t.y - m.y, t.z - m.z]
  const aSol: V3 = [-m.x, -m.y, -m.z]
  const n = RotationAxis(Body.Mars, fecha).north
  const N: V3 = [n.x, n.y, n.z]
  // Ejes del ecuador de Marte: X en el nodo con el ecuador de la Tierra, Y completa el sistema.
  const X = unidad(cruz([0, 0, 1], N))
  const Y = cruz(N, X)
  const radec = (v: V3) => {
    const u = unidad(v)
    return { dec: Math.asin(punto(u, N)), ra: Math.atan2(punto(u, Y), punto(u, X)) }
  }
  const sol = radec(aSol)
  const tierra = radec(aTierra)
  const H = (hora - 12) * 15 * GRADO + sol.ra - tierra.ra
  const fi = latitud * GRADO
  const d = tierra.dec
  const el = Math.asin(Math.sin(fi) * Math.sin(d) + Math.cos(fi) * Math.cos(d) * Math.cos(H))
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(fi) - Math.cos(d) * Math.sin(fi) * Math.cos(H))
  const elongacion = Math.acos(Math.max(-1, Math.min(1, punto(unidad(aSol), unidad(aTierra)))))
  return { az: ((az / GRADO) % 360 + 360) % 360, el: el / GRADO, elongacion: elongacion / GRADO }
}
