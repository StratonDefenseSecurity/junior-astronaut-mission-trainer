// Color de una estrella a partir de su índice B-V, con fórmulas publicadas:
//  1. B-V -> temperatura efectiva: Ballesteros, F. J. (2012), "New insights into black bodies",
//     EPL 97, 34008 (https://arxiv.org/abs/1201.1809):
//        T = 4600 K · ( 1/(0.92·(B-V) + 1.7) + 1/(0.92·(B-V) + 0.62) )
//     Aproxima la estrella como cuerpo negro; con B-V = 0.65 (el Sol) da 5778 K.
//  2. Temperatura -> color: espectro de Planck integrado contra las funciones de igualación de
//     color CIE 1931, usando el ajuste analítico de Wyman, Sloan y Shirley (2013), "Simple
//     Analytic Approximations to the CIE XYZ Color Matching Functions", JCGT 2(2)
//     (https://jcgt.org/published/0002/02/01/).
//  3. XYZ -> sRGB lineal (blanco D65), matriz de IEC 61966-2-1.
// El resultado es un color lineal normalizado (el canal mayor vale 1); el brillo lo pone la magnitud.

/** Temperatura efectiva aproximada (K) desde el índice B-V (Ballesteros 2012). */
export function temperaturaDesdeBV(bv: number): number {
  // Fuera de este rango la fórmula ya no representa estrellas reales.
  const x = Math.min(2.0, Math.max(-0.4, bv))
  return 4600 * (1 / (0.92 * x + 1.7) + 1 / (0.92 * x + 0.62))
}

function lobulo(l: number, mu: number, s1: number, s2: number): number {
  const t = (l - mu) / (l < mu ? s1 : s2)
  return Math.exp(-0.5 * t * t)
}

// Ajuste multilóbulo de Wyman, Sloan y Shirley (2013) para CIE 1931 2°; l en nanómetros.
const xBarra = (l: number) => 1.056 * lobulo(l, 599.8, 37.9, 31.0) + 0.362 * lobulo(l, 442.0, 16.0, 26.7) - 0.065 * lobulo(l, 501.1, 20.4, 26.2)
const yBarra = (l: number) => 0.821 * lobulo(l, 568.8, 46.9, 40.5) + 0.286 * lobulo(l, 530.9, 16.3, 31.1)
const zBarra = (l: number) => 1.217 * lobulo(l, 437.0, 11.8, 36.0) + 0.681 * lobulo(l, 459.0, 26.0, 13.8)

/** Segunda constante de radiación hc/k en m·K (CODATA 2018). */
const C2 = 1.438776877e-2

/** Color lineal [r, g, b] (canal mayor = 1) de un cuerpo negro a la temperatura dada. */
export function colorDesdeTemperatura(t: number, salida: [number, number, number] = [1, 1, 1]): [number, number, number] {
  let X = 0
  let Y = 0
  let Z = 0
  for (let l = 380; l <= 780; l += 5) {
    const m = l * 1e-9
    // Planck sin constantes globales: solo importa la forma del espectro.
    const b = 1 / (Math.pow(m, 5) * (Math.exp(C2 / (m * t)) - 1))
    X += b * xBarra(l)
    Y += b * yBarra(l)
    Z += b * zBarra(l)
  }
  let r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z
  let g = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z
  let a = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z
  // Los colores fuera de la gama sRGB se recortan a 0 antes de normalizar.
  r = Math.max(0, r)
  g = Math.max(0, g)
  a = Math.max(0, a)
  const max = Math.max(r, g, a) || 1
  salida[0] = r / max
  salida[1] = g / max
  salida[2] = a / max
  return salida
}

/** Color lineal desde B-V. Sin dato (null) devuelve blanco neutro, sin inventar un color. */
export function colorDesdeBV(bv: number | null, salida: [number, number, number] = [1, 1, 1]): [number, number, number] {
  if (bv === null || !Number.isFinite(bv)) {
    salida[0] = salida[1] = salida[2] = 1
    return salida
  }
  return colorDesdeTemperatura(temperaturaDesdeBV(bv), salida)
}
