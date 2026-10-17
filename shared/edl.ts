// Entrada, descenso y aterrizaje (EDL) de Perseverance, el 18 de febrero de 2021: los "siete
// minutos de terror" que sigue el descenso del juego. Lo usan la telemetría del servidor
// (server/sim/vuelo.ts), la cinemática (src/mundo/Cinematicas.tsx) y el sonido.
//
// Fuentes (ver FUENTES en ciencia.ts):
//  - Trayectoria reconstruida: Karlgaard, Schoenenberger, Dutta y Way, "Mars Entry, Descent, and
//    Landing Instrumentation 2 Trajectory, Aerodynamics, and Atmosphere Reconstruction", AIAA
//    SciTech 2022, tabla 8. Tiempos desde la entrada (radio 3522.2 km, 540.140 s después del
//    inicio del guiado), altitud sobre el areoide de MOLA y velocidad respecto del aire.
//  - Kit de prensa de aterrizaje de NASA/JPL: etapa de crucero 10 min antes de la entrada,
//    calentamiento máximo ~75 s después, Lander Vision System entre 4.2 y 2.2 km, grúa celeste a
//    20 m y 2.7 km/h, cables de 7.6 m.
//
// El tiempo `t` es en segundos desde la entrada atmosférica. El juego empieza el descenso en la
// entrada (t = 0) y aterriza a los 418.7 s; DESCENSO_S = 420 deja un instante en el suelo.

/** Altitud MOLA del punto de contacto en Jezero (tabla 8): se resta para dar la altura sobre el suelo. */
const SUELO_MOLA_KM = -2.56

/** Eventos de la reconstrucción: [t s, altitud MOLA km, velocidad respecto del aire km/s]. */
const TABLA: ReadonlyArray<readonly [number, number, number]> = [
  [0, 128.22, 5.33356], // entrada atmosférica
  [50.86, 58.86, 5.38099], // empieza el guiado
  [66.363, 40.69, 5.1683], // Mach 25
  [81.734, 25.81, 4.28601], // primera inversión de alabeo
  [87.552, 19.47, 3.71671], // carga máxima
  [91.892, 16.1, 3.28544], // Mach 15
  [101.984, 16.09, 2.43193], // segunda inversión de alabeo
  [105.132, 15.47, 2.22282], // Mach 10
  [137.632, 13.92, 1.10889], // Mach 5
  [223.61, 11.74, 0.46677], // se sueltan las masas de equilibrio
  [240.61, 10.04, 0.41438], // paracaídas
  [263.234, 7.92, 0.14563], // separación del escudo térmico
  [357.531, -0.34, 0.08214], // separación de la cubierta trasera
]

/**
 * Ángulo de la trayectoria respecto del horizonte (grados, negativo hacia abajo), relativo al
 * aire, de la misma tabla: casi rasante en la entrada y vertical al final.
 */
const TRAYECTORIA: ReadonlyArray<readonly [number, number]> = [
  [0, -16.18],
  [50.86, -13.31],
  [66.363, -12.22],
  [81.734, -10.71],
  [87.552, -9.12],
  [91.892, -7.82],
  [101.984, -5.24],
  [105.132, -4.3],
  [137.632, 0.07],
  [223.61, -9.55],
  [240.61, -16.26],
  [263.234, -31.4],
  [357.531, -81.3],
  [418.73 - 12, -90],
]

/** Momentos clave, en segundos desde la entrada. */
export const EDL = {
  /** La etapa de crucero se separa 10 min antes de la entrada (kit de prensa). El juego la muestra al principio. */
  crucero: 0,
  guiado: 50.86,
  /** Calentamiento máximo, ~75 s después de la entrada, ~1300 °C fuera del escudo (kit de prensa). */
  calorMaximo: 75,
  cargaMaxima: 87.552,
  masasEquilibrio: 223.61,
  /** Paracaídas de 21.5 m a Mach 1.8 (reconstrucción) y ~1512 km/h (kit de prensa). */
  paracaidas: 240.61,
  escudo: 263.234,
  /** Lander Vision System: empieza a 4.2 km del suelo (kit de prensa). Se calcula abajo. */
  navegacion: 0,
  cubierta: 357.531,
  /** Grúa celeste: ~12 s antes del contacto, a 20 m del suelo (NASA). */
  gruaCeleste: 418.73 - 12,
  contacto: 418.73,
}

/** Puntos del perfil: [t, altura sobre el suelo km, velocidad km/s]. */
const PERFIL: Array<[number, number, number]> = [
  ...TABLA.map(([t, a, v]) => [t, a - SUELO_MOLA_KM, v] as [number, number, number]),
  // Grúa celeste: a 20 m y 2.7 km/h (kit de prensa); contacto a 0.83 m/s (reconstrucción).
  [EDL.gruaCeleste, 0.02, 0.00075],
  [EDL.contacto, 0, 0.00083],
]

/** Interpolación lineal en el perfil, columna c. */
function interpolar(t: number, c: 1 | 2): number {
  if (t <= PERFIL[0][0]) return PERFIL[0][c]
  for (let i = 1; i < PERFIL.length; i++) {
    const [t1] = PERFIL[i]
    if (t <= t1) {
      const [t0] = PERFIL[i - 1]
      const x = (t - t0) / (t1 - t0)
      return PERFIL[i - 1][c] + (PERFIL[i][c] - PERFIL[i - 1][c]) * x
    }
  }
  return PERFIL[PERFIL.length - 1][c]
}

// El Lander Vision System empieza a 4.2 km del suelo.
for (let i = 1; i < PERFIL.length; i++) {
  if (PERFIL[i][1] <= 4.2) {
    const [t0, a0] = PERFIL[i - 1]
    const [t1, a1] = PERFIL[i]
    EDL.navegacion = t0 + ((a0 - 4.2) / (a0 - a1)) * (t1 - t0)
    break
  }
}

const G0 = 9.80665
const G_MARTE = 3.71

/**
 * Aceleración que se siente, en g terrestres: el frenado medio entre eventos de la tabla
 * (cambio de velocidad sobre tiempo), asignado al centro de cada tramo y suavizado entre ellos.
 * Cuando la cápsula ya cae casi en vertical y despacio (paracaídas y motores) se suma la gravedad
 * de Marte, que sostienen el paracaídas o los motores.
 */
const ACELERACION: Array<[number, number]> = (() => {
  const puntos: Array<[number, number]> = [[0, 0]]
  for (let i = 1; i < PERFIL.length; i++) {
    const [t0, , v0] = PERFIL[i - 1]
    const [t1, , v1] = PERFIL[i]
    const frenado = (Math.max(0, v0 - v1) * 1000) / (t1 - t0)
    const sostiene = t0 >= EDL.paracaidas ? G_MARTE : 0
    puntos.push([(t0 + t1) / 2, (frenado + sostiene) / G0])
  }
  puntos.push([EDL.contacto, G_MARTE / G0])
  return puntos
})()

function aceleracion(t: number): number {
  if (t >= EDL.contacto) return G_MARTE / G0
  for (let i = 1; i < ACELERACION.length; i++) {
    const [t1, g1] = ACELERACION[i]
    if (t <= t1) {
      const [t0, g0] = ACELERACION[i - 1]
      return g0 + (g1 - g0) * ((t - t0) / (t1 - t0))
    }
  }
  return G_MARTE / G0
}

/** Nombre de la etapa en pantalla. */
export function etapaEDL(t: number): string {
  if (t >= EDL.contacto) return 'Touchdown'
  if (t >= EDL.gruaCeleste) return 'Sky crane'
  if (t >= EDL.cubierta + 3) return 'Powered descent'
  if (t >= EDL.cubierta) return 'Backshell separation'
  if (t >= EDL.navegacion) return 'Terrain navigation'
  if (t >= EDL.escudo + 20) return 'Radar measuring altitude'
  if (t >= EDL.escudo) return 'Heat shield separated'
  if (t >= EDL.paracaidas) return 'Supersonic parachute'
  if (t >= EDL.masasEquilibrio) return 'Balance masses released'
  if (t >= EDL.cargaMaxima - 4 && t < EDL.cargaMaxima + 12) return 'Peak deceleration'
  if (t >= EDL.cargaMaxima + 12) return 'Braking in the atmosphere'
  if (t >= EDL.calorMaximo - 8 && t < EDL.cargaMaxima - 4) return 'Peak heating'
  if (t >= EDL.guiado) return 'Guided entry'
  if (t >= 6) return 'Atmospheric entry'
  return 'Cruise stage separated'
}

/** Ángulo de la trayectoria (grados) `t` segundos después de la entrada. */
export function trayectoriaEDL(t: number): number {
  if (t <= 0) return TRAYECTORIA[0][1]
  for (let i = 1; i < TRAYECTORIA.length; i++) {
    const [t1, a1] = TRAYECTORIA[i]
    if (t <= t1) {
      const [t0, a0] = TRAYECTORIA[i - 1]
      return a0 + (a1 - a0) * ((t - t0) / (t1 - t0))
    }
  }
  return -90
}

export interface EstadoEDL {
  /** Altura sobre el suelo, km. */
  altitud: number
  /** Velocidad respecto del aire, km/s. */
  velocidad: number
  /** Aceleración que se siente, en g. */
  g: number
  etapa: string
}

/** Estado del descenso `t` segundos después de la entrada. */
export function estadoEDL(t: number): EstadoEDL {
  const x = Math.max(0, t)
  return {
    altitud: x >= EDL.contacto ? 0 : interpolar(x, 1),
    velocidad: x >= EDL.contacto ? 0 : interpolar(x, 2),
    g: aceleracion(x),
    etapa: etapaEDL(x),
  }
}

/** Brillo del plasma sobre el escudo (0..1), con su máximo en el calentamiento máximo. */
export const calorEDL = (t: number) => (t < 0 || t > EDL.paracaidas ? 0 : Math.exp(-Math.pow((t - EDL.calorMaximo) / 28, 2)))
