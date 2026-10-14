// Ruido procedural para las texturas (sin DOM: se puede probar y cronometrar con tsx).
// Es ruido de valor en 3D: se evalúa sobre la esfera unidad, así no hay costura en la
// longitud 180° ni pellizco en los polos. Con semilla fija, cada sesión genera lo mismo.

/** Generador pseudoaleatorio pequeño y rápido (mulberry32). Devuelve [0, 1). */
export function azarConSemilla(semilla: number): () => number {
  let s = semilla >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Ruido3 {
  /** Ruido de valor en [-1, 1]. */
  valor(x: number, y: number, z: number): number
  /** Suma de octavas (fBm), normalizada a [-1, 1] aproximadamente. */
  fbm(x: number, y: number, z: number, octavas: number, ganancia?: number): number
}

export function crearRuido(semilla: number): Ruido3 {
  const azar = azarConSemilla(semilla)
  const perm = new Uint8Array(512)
  const valores = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    perm[i] = i
    valores[i] = azar() * 2 - 1
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    const t = perm[i]
    perm[i] = perm[j]
    perm[j] = t
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]

  function valor(x: number, y: number, z: number): number {
    const fx0 = Math.floor(x)
    const fy0 = Math.floor(y)
    const fz0 = Math.floor(z)
    const fx = x - fx0
    const fy = y - fy0
    const fz = z - fz0
    const ix = fx0 & 255
    const iy = fy0 & 255
    const iz = fz0 & 255
    // Interpolación suave (smoothstep) para que no se vea la retícula.
    const u = fx * fx * (3 - 2 * fx)
    const v = fy * fy * (3 - 2 * fy)
    const w = fz * fz * (3 - 2 * fz)
    const a = perm[ix] + iy
    const b = perm[ix + 1] + iy
    const aa = perm[a] + iz
    const ab = perm[a + 1] + iz
    const ba = perm[b] + iz
    const bb = perm[b + 1] + iz
    const x00 = valores[perm[aa]] + u * (valores[perm[ba]] - valores[perm[aa]])
    const x10 = valores[perm[ab]] + u * (valores[perm[bb]] - valores[perm[ab]])
    const x01 = valores[perm[aa + 1]] + u * (valores[perm[ba + 1]] - valores[perm[aa + 1]])
    const x11 = valores[perm[ab + 1]] + u * (valores[perm[bb + 1]] - valores[perm[ab + 1]])
    const y0 = x00 + v * (x10 - x00)
    const y1 = x01 + v * (x11 - x01)
    return y0 + w * (y1 - y0)
  }

  function fbm(x: number, y: number, z: number, octavas: number, ganancia = 0.5): number {
    let suma = 0
    let amp = 1
    let total = 0
    let f = 1
    for (let o = 0; o < octavas; o++) {
      // Desplazamiento por octava para que no coincidan los nodos de la retícula.
      suma += amp * valor(x * f + o * 17.31, y * f - o * 9.13, z * f + o * 5.71)
      total += amp
      amp *= ganancia
      f *= 2.03
    }
    return suma / total
  }

  return { valor, fbm }
}

/**
 * Losa cuadrada de ruido 2D que se repite sin costura (periodo = tam). Sirve para el detalle
 * fino a resolución completa, que sería muy caro de calcular con ruido 3D píxel a píxel.
 * `celdas` son los tamaños de celda de cada octava, en píxeles (deben dividir a tam).
 */
const losas = new Map<string, Float32Array>()
export function losaPeriodica(tam: number, celdas: readonly number[], semilla: number): Float32Array {
  const clave = `${tam}:${celdas.join(',')}:${semilla}`
  const hecha = losas.get(clave)
  if (hecha) return hecha
  const azar = azarConSemilla(semilla)
  const salida = new Float32Array(tam * tam)
  let total = 0
  let amp = 1
  for (const c of celdas) {
    const p = tam / c
    const red = new Float32Array(p * p)
    for (let i = 0; i < red.length; i++) red[i] = azar() * 2 - 1
    // Pesos por columna, iguales en todas las filas.
    const cx0 = new Int32Array(tam)
    const cx1 = new Int32Array(tam)
    const ux = new Float32Array(tam)
    for (let x = 0; x < tam; x++) {
      const gx = x / c
      const x0 = Math.floor(gx)
      const u = gx - x0
      ux[x] = u * u * (3 - 2 * u)
      cx0[x] = x0 % p
      cx1[x] = (x0 + 1) % p
    }
    for (let y = 0; y < tam; y++) {
      const gy = y / c
      const y0 = Math.floor(gy)
      let v = gy - y0
      v = v * v * (3 - 2 * v)
      const f0 = (y0 % p) * p
      const f1 = ((y0 + 1) % p) * p
      for (let x = 0; x < tam; x++) {
        const u = ux[x]
        const c0 = cx0[x]
        const c1 = cx1[x]
        const a = red[f0 + c0] + u * (red[f0 + c1] - red[f0 + c0])
        const b = red[f1 + c0] + u * (red[f1 + c1] - red[f1 + c0])
        salida[y * tam + x] += amp * (a + v * (b - a))
      }
    }
    total += amp
    amp *= 0.55
  }
  for (let i = 0; i < salida.length; i++) salida[i] /= total
  losas.set(clave, salida)
  return salida
}

/** Interpolación suave entre dos bordes (como GLSL). */
export function suave(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export const limitar = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x)

/**
 * Campo escalar en una retícula equirectangular pequeña, para muestrearlo con interpolación
 * bilineal desde una textura más grande (lo caro se calcula una sola vez a baja resolución).
 */
export interface Campo {
  ancho: number
  alto: number
  datos: Float32Array
}

/** Muestra bilineal de un campo en coordenadas normalizadas u (0..1, se repite) y v (0..1). */
export function muestrear(c: Campo, u: number, v: number): number {
  const x = u * c.ancho - 0.5
  const y = v * c.alto - 0.5
  let x0 = Math.floor(x)
  let y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  let y1 = y0 + 1
  if (y0 < 0) y0 = 0
  if (y1 > c.alto - 1) y1 = c.alto - 1
  if (y0 > c.alto - 1) y0 = c.alto - 1
  let x1 = x0 + 1
  x0 = ((x0 % c.ancho) + c.ancho) % c.ancho
  x1 = ((x1 % c.ancho) + c.ancho) % c.ancho
  const d = c.datos
  const a = d[y0 * c.ancho + x0]
  const b = d[y0 * c.ancho + x1]
  const e = d[y1 * c.ancho + x0]
  const f = d[y1 * c.ancho + x1]
  const s = a + fx * (b - a)
  const t = e + fx * (f - e)
  return s + fy * (t - s)
}

/**
 * Desenfoque de caja separable sobre un campo equirectangular (se repite en longitud, se
 * recorta en latitud). Varias pasadas se parecen a un desenfoque gaussiano.
 */
export function desenfocar(c: Campo, radioX: number, radioY: number, pasadas = 2): void {
  const { ancho, alto, datos } = c
  const tmp = new Float32Array(Math.max(ancho, alto))
  for (let p = 0; p < pasadas; p++) {
    if (radioX > 0) {
      const n = radioX * 2 + 1
      for (let y = 0; y < alto; y++) {
        const fila = y * ancho
        let suma = 0
        for (let k = -radioX; k <= radioX; k++) suma += datos[fila + ((k % ancho) + ancho) % ancho]
        for (let x = 0; x < ancho; x++) {
          tmp[x] = suma / n
          const sale = (((x - radioX) % ancho) + ancho) % ancho
          const entra = (x + radioX + 1) % ancho
          suma += datos[fila + entra] - datos[fila + sale]
        }
        for (let x = 0; x < ancho; x++) datos[fila + x] = tmp[x]
      }
    }
    if (radioY > 0) {
      const n = radioY * 2 + 1
      for (let x = 0; x < ancho; x++) {
        let suma = 0
        for (let k = -radioY; k <= radioY; k++) suma += datos[Math.min(alto - 1, Math.max(0, k)) * ancho + x]
        for (let y = 0; y < alto; y++) {
          tmp[y] = suma / n
          const sale = Math.max(0, y - radioY)
          const entra = Math.min(alto - 1, y + radioY + 1)
          suma += datos[entra * ancho + x] - datos[sale * ancho + x]
        }
        for (let y = 0; y < alto; y++) datos[y * ancho + x] = tmp[y]
      }
    }
  }
}
