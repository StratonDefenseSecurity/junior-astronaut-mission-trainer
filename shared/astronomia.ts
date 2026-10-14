// Cálculos astronómicos que comparten el servidor y el cliente, con astronomy-engine (efemérides
// validadas contra JPL Horizons).
import { Body, Ecliptic, HelioVector } from 'astronomy-engine'

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
