// Relleno de polígonos (longitud, latitud) sobre una retícula equirectangular, sin canvas.
// Se hace a mano para poder generar las texturas en cualquier hilo (y medir su tiempo con tsx).
//
// Regla par-impar: los lagos interiores que vienen como agujeros (el mar Caspio) quedan como
// agua sin importar el sentido de giro de los anillos. Los anillos que cruzan el antimeridiano
// se "desenrollan" y se dibujan también corridos ±360°; si un anillo da la vuelta completa al
// planeta (la Antártida en Natural Earth), se cierra pasando por el polo.

/** Un anillo es una lista de puntos [longitud, latitud] en grados. */
export type Anillo = ReadonlyArray<ReadonlyArray<number>>
/** Un polígono es su borde exterior seguido de sus agujeros. */
export type Poligono = ReadonlyArray<Anillo>

/**
 * Cobertura (0..1) de los polígonos en cada píxel. La fila 0 es el polo SUR (así lo espera
 * THREE.DataTexture con flipY = false); la columna 0 empieza en la longitud -180°.
 * Antialias: `sub` líneas de barrido por fila y cobertura horizontal exacta en los bordes.
 */
export function rasterizarPoligonos(poligonos: ReadonlyArray<Poligono>, ancho: number, alto: number, sub = 4): Float32Array {
  const filas = alto * sub
  const sx = ancho / 360
  const sy = filas / 180
  // 1) Aristas en coordenadas de subfila (x en píxeles, y en subfilas).
  const aristas: number[] = []
  const agregar = (xs: number[], ys: number[]) => {
    let min = Infinity
    let max = -Infinity
    for (const x of xs) {
      if (x < min) min = x
      if (x > max) max = x
    }
    // Copias corridas una vuelta para cubrir lo que sale por los bordes del mapa.
    const k0 = Math.ceil((0 - max) / ancho)
    const k1 = Math.floor((ancho - min) / ancho)
    for (let k = k0; k <= k1; k++) {
      const dx = k * ancho
      for (let i = 0; i < xs.length; i++) {
        const j = (i + 1) % xs.length
        if (ys[i] !== ys[j]) aristas.push(xs[i] + dx, ys[i], xs[j] + dx, ys[j])
      }
    }
  }
  for (const poligono of poligonos) {
    for (const anillo of poligono) {
      if (anillo.length < 3) continue
      const xs: number[] = []
      const ys: number[] = []
      let lonPrev = anillo[0][0]
      let corrimiento = 0
      for (const p of anillo) {
        let lon = p[0] + corrimiento
        // Salto de más de 180°: el anillo cruzó el antimeridiano.
        if (lon - lonPrev > 180) {
          corrimiento -= 360
          lon -= 360
        } else if (lon - lonPrev < -180) {
          corrimiento += 360
          lon += 360
        }
        lonPrev = lon
        xs.push((lon + 180) * sx)
        ys.push((p[1] + 90) * sy)
      }
      // Cierre del anillo (el primer punto puede repetirse al final).
      const vuelta = Math.round((xs[xs.length - 1] - xs[0]) / ancho)
      if (vuelta !== 0) {
        // Da la vuelta al planeta: se cierra por el polo más cercano a su latitud media.
        let suma = 0
        for (const y of ys) suma += y
        const yPolo = suma / ys.length < filas / 2 ? 0 : filas
        xs.push(xs[xs.length - 1], xs[0])
        ys.push(yPolo, yPolo)
      }
      agregar(xs, ys)
    }
  }

  // 2) Cruces por subfila: primero se cuentan y luego se llenan, en un solo arreglo plano.
  const cuenta = new Uint32Array(filas + 1)
  const nA = aristas.length / 4
  for (let a = 0; a < nA; a++) {
    const y0 = aristas[a * 4 + 1]
    const y1 = aristas[a * 4 + 3]
    const ymin = Math.min(y0, y1)
    const ymax = Math.max(y0, y1)
    const k0 = Math.max(0, Math.ceil(ymin - 0.5))
    const k1 = Math.min(filas - 1, Math.ceil(ymax - 0.5) - 1)
    for (let k = k0; k <= k1; k++) cuenta[k + 1]++
  }
  for (let k = 0; k < filas; k++) cuenta[k + 1] += cuenta[k]
  const cruces = new Float64Array(cuenta[filas])
  const lleno = new Uint32Array(filas)
  for (let a = 0; a < nA; a++) {
    const x0 = aristas[a * 4]
    const y0 = aristas[a * 4 + 1]
    const x1 = aristas[a * 4 + 2]
    const y1 = aristas[a * 4 + 3]
    const ymin = Math.min(y0, y1)
    const ymax = Math.max(y0, y1)
    const k0 = Math.max(0, Math.ceil(ymin - 0.5))
    const k1 = Math.min(filas - 1, Math.ceil(ymax - 0.5) - 1)
    const pendiente = (x1 - x0) / (y1 - y0)
    for (let k = k0; k <= k1; k++) {
      const yc = k + 0.5
      cruces[cuenta[k] + lleno[k]++] = x0 + (yc - y0) * pendiente
    }
  }

  // 3) Relleno par-impar con cobertura parcial en los extremos de cada tramo.
  const cobertura = new Float32Array(ancho * alto)
  const peso = 1 / sub
  for (let k = 0; k < filas; k++) {
    const ini = cuenta[k]
    const fin = cuenta[k + 1]
    if (fin - ini < 2) continue
    const fila = cruces.subarray(ini, fin).sort()
    const base = Math.floor(k / sub) * ancho
    for (let i = 0; i + 1 < fila.length; i += 2) {
      const xa = Math.max(0, fila[i])
      const xb = Math.min(ancho, fila[i + 1])
      if (xb <= xa) continue
      const ia = Math.floor(xa)
      const ib = Math.floor(xb)
      if (ia === ib) {
        cobertura[base + ia] += (xb - xa) * peso
        continue
      }
      cobertura[base + ia] += (ia + 1 - xa) * peso
      for (let x = ia + 1; x < ib; x++) cobertura[base + x] += peso
      if (ib < ancho) cobertura[base + ib] += (xb - ib) * peso
    }
  }
  for (let i = 0; i < cobertura.length; i++) if (cobertura[i] > 1) cobertura[i] = 1
  return cobertura
}

/** ¿El punto (lon, lat) está dentro del anillo? (par-impar, plano, sin cruzar el antimeridiano). */
export function puntoEnAnillo(lon: number, lat: number, anillo: Anillo): boolean {
  let dentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const xi = anillo[i][0]
    const yi = anillo[i][1]
    const xj = anillo[j][0]
    const yj = anillo[j][1]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}
