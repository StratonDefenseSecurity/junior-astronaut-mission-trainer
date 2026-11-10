// Cálculos astronómicos que comparten el servidor y el cliente, con astronomy-engine (efemérides
// validadas contra JPL Horizons).
import { Body, Ecliptic, Elongation, GeoVector, HelioVector } from 'astronomy-engine'

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
