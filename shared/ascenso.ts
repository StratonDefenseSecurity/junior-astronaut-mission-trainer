// Ascenso real de Artemis I: el SLS Block 1 con Orion despegó del complejo 39B del Centro Espacial
// Kennedy el 16 de noviembre de 2022 a la 1:47:44 a. m. (hora del este, T0 = encendido de los
// propulsores sólidos). El juego usa este ascenso para la tripulación; lo usan la telemetría del
// servidor (server/sim/vuelo.ts), la escena (src/mundo/Cinematicas.tsx), el panel y el sonido.
//
// Fuentes (ver FUENTES en ciencia.ts):
//  - Kit de prensa de Artemis I (NASA, 2022): cuenta terminal (T-12 s quemado de hidrógeno, T-10 s
//    orden de arranque, T-6.36 s arranque de los RS-25, T0 encendido de los propulsores, separación
//    de umbilicales y despegue) y cronología planificada del ascenso (separación de propulsores
//    00:02:12, carenado del módulo de servicio 00:03:11, torre de escape 00:03:16, corte de motores
//    00:08:03 y separación de la etapa central 00:08:15).
//  - Página de cronología de la misión (NASA): máxima presión dinámica a 00:01:10.
//  - Mehta, Smith y Mobley, "Space Launch System Base Aerothermodynamics Post-Flight Reconstruction
//    for Artemis I", AIAA SciTech 2024 (NTRS 20230017528): lo que pasó en vuelo. Máxima presión
//    dinámica a 43 000 ft, separación de propulsores a T+132 s y 158 000 ft, torre de escape a
//    T+210 s y 288 000 ft, corte de motores (MECO) a T+500 s y 531 000 ft.
//  - Ben Evans, AmericaSpace (16 nov 2023): supersónico a los 54 s y velocidades respecto de la Tierra: 3170 mph
//    al soltar los propulsores, más de 4500 mph al soltar la torre y 17 430 mph en el MECO. Sus
//    tiempos y altitudes coinciden con la reconstrucción de NASA. NASA da "unos 4000 mph" y "unos
//    17 500 mph" en sus resúmenes: la diferencia en la separación de propulsores es parecida a los
//    ~0.4 km/s que suma la rotación de la Tierra en Kennedy, así que el juego los toma como
//    velocidades medidas en otro marco de referencia.
//  - NASA, "Initial Assessment Shows Excellent Performance for Artemis Moon Rocket" (2022): Orion
//    quedó a unas 3 millas de la órbita prevista de 975 x 16 millas náuticas.
//  - Hoja de datos del SLS (NASA, 2023): 8.8 millones de libras de empuje y 5.75 millones de libras
//    de peso al despegar.
//  - Addona et al., AAS 25-122 (NTRS 20240016417): los propulsores pierden empuje antes de
//    separarse (la secuencia arranca ~9 s antes de soltarlos) y los RS-25 bajan el empuje mientras.
//
// El tiempo `t` es en segundos desde el despegue (T0), igual que el tiempo de misión del juego.
// El tiempo real de vuelo cabe entero en la fase de lanzamiento: la etapa central se separa a
// T+512 s y la nave sigue en órbita hasta TRANSITO_INICIO_S.

const G0 = 9.80665
const R_TIERRA_KM = 6378.137
const MU_TIERRA = 398600.4418
const KM_POR_PIE = 0.0003048
const KM_S_POR_MPH = 0.00044704
const KM_POR_MILLA_NAUTICA = 1.852

/** Momentos clave, en segundos desde el despegue. */
export const ASCENSO = {
  /** T-12 s: se encienden los quemadores del hidrógeno bajo los motores (kit de prensa). */
  quemadores: -12,
  /** T-10 s: el secuenciador de tierra ordena arrancar los motores de la etapa central. */
  ordenArranque: -10,
  /** T-6.36 s: arrancan los cuatro RS-25. */
  arranqueRS25: -6.36,
  /** T0: encendido de los propulsores sólidos, separación de umbilicales y despegue. */
  despegue: 0,
  /** Pasa la velocidad del sonido (AmericaSpace). */
  supersonico: 54,
  /** Máxima presión dinámica (NASA, 1 min 10 s), a 43 000 ft (reconstrucción). */
  maxQ: 70,
  /**
   * Los propulsores se apagan antes de soltarse: la secuencia empieza cuando su presión baja de un
   * umbral, ~9 s antes de la separación (Addona et al., tabla 1). El juego atenúa sus llamas desde
   * los 110 s, cuando se activa la lógica de separación.
   */
  apagadoSRB: 123,
  separacionSRB: 132,
  /**
   * Carenado del módulo de servicio. La reconstrucción no da su hora; el plan lo ponía 5 s antes de
   * la torre (00:03:11 y 00:03:16) y el juego mantiene esa diferencia con la hora real de la torre.
   */
  carenado: 205,
  torreEscape: 210,
  /** Corte de los motores de la etapa central (MECO), a 531 000 ft. */
  meco: 500,
  /** Separación de la etapa central: 12 s después del corte, como en el plan (00:08:03 y 00:08:15). */
  separacionCentral: 512,
}

/** Órbita de inserción: 975 x 16 millas náuticas (NASA). Radios en km. */
const APOGEO_KM = R_TIERRA_KM + 975 * KM_POR_MILLA_NAUTICA
const PERIGEO_KM = R_TIERRA_KM + 16 * KM_POR_MILLA_NAUTICA
const SEMIEJE_KM = (APOGEO_KM + PERIGEO_KM) / 2

/** Altitudes de la reconstrucción de NASA: [t s, altitud km]. */
const ALTITUD_REAL: ReadonlyArray<readonly [number, number]> = [
  [ASCENSO.maxQ, 43_000 * KM_POR_PIE],
  [ASCENSO.separacionSRB, 158_000 * KM_POR_PIE],
  [ASCENSO.torreEscape, 288_000 * KM_POR_PIE],
  [ASCENSO.meco, 531_000 * KM_POR_PIE],
]
const ALT_MECO = ALTITUD_REAL[ALTITUD_REAL.length - 1][1]

/** Velocidades respecto de la Tierra: [t s, km/s]. */
const V_SRB = 3170 * KM_S_POR_MPH
const V_TORRE_MINIMA = 4500 * KM_S_POR_MPH
const V_MECO = 17_430 * KM_S_POR_MPH

/**
 * Aceleración al despegar: empuje sobre peso menos la gravedad, con 8.8 millones de libras de
 * empuje para 5.75 millones de libras (hoja de datos del SLS), en km/s².
 */
const EMPUJE_SOBRE_PESO = 8.8 / 5.75
const ACEL_DESPEGUE = ((EMPUJE_SOBRE_PESO - 1) * G0) / 1000

// ---------- Interpolación cúbica monótona (Fritsch–Carlson) ----------

interface Tramo {
  t: number[]
  y: number[]
  m: number[]
}

/** Pendientes que no crean subidas ni bajadas falsas; las fijas (no nulas en `fijas`) se respetan. */
function curva(puntos: ReadonlyArray<readonly [number, number]>, fijas: Array<number | undefined>): Tramo {
  const t = puntos.map((p) => p[0])
  const y = puntos.map((p) => p[1])
  const n = t.length
  const d = Array.from({ length: n - 1 }, (_, i) => (y[i + 1] - y[i]) / (t[i + 1] - t[i]))
  const m = Array.from({ length: n }, (_, i) => {
    if (fijas[i] !== undefined) return fijas[i]!
    if (i === 0) return d[0]
    if (i === n - 1) {
      // Extremo: fórmula de tres puntos, sin pasar del triple de la última pendiente.
      const h1 = t[n - 2] - t[n - 3]
      const h2 = t[n - 1] - t[n - 2]
      const e = ((2 * h2 + h1) * d[n - 2] - h2 * d[n - 3]) / (h1 + h2)
      return Math.max(0, Math.min(3 * d[n - 2], e))
    }
    if (d[i - 1] * d[i] <= 0) return 0
    const h0 = t[i] - t[i - 1]
    const h1 = t[i + 1] - t[i]
    const w1 = 2 * h1 + h0
    const w2 = h1 + 2 * h0
    return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
  })
  return { t, y, m }
}

function evaluar(c: Tramo, x: number): number {
  const { t, y, m } = c
  if (x <= t[0]) return y[0]
  const n = t.length
  if (x >= t[n - 1]) return y[n - 1]
  let i = 0
  while (x > t[i + 1]) i++
  const h = t[i + 1] - t[i]
  const s = (x - t[i]) / h
  const s2 = s * s
  const s3 = s2 * s
  return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1]
}

// ---------- Perfil ----------

/**
 * Velocidad del sonido (km/s) a una altitud por debajo de 11 km, con la atmósfera estándar de
 * EE. UU. de 1976: 288.15 K a nivel del mar y 6.5 K menos por km. Sirve para el paso a Mach 1.
 */
const sonido = (km: number) => Math.sqrt(1.4 * 287.053 * (288.15 - 6.5 * km)) / 1000

/** Velocidad respecto de la Tierra (km/s) mientras empujan los motores. */
const VELOCIDAD_SIN_MACH = curva(
  [
    [0, 0],
    [ASCENSO.separacionSRB, V_SRB],
    [ASCENSO.meco, V_MECO],
  ],
  [ACEL_DESPEGUE, undefined, undefined],
)
/** Mach 1 a los 54 s, a la altitud que da el perfil en ese momento. */
const V_SONICO = (() => {
  // La altitud a los 54 s sale de la curva de altitudes reales (casi no depende de la velocidad).
  const provisional = curva([[0, 0], ...ALTITUD_REAL], [0, undefined, undefined, undefined, undefined])
  void VELOCIDAD_SIN_MACH
  return sonido(evaluar(provisional, ASCENSO.supersonico))
})()
const VELOCIDAD = curva(
  [
    [0, 0],
    [ASCENSO.supersonico, V_SONICO],
    [ASCENSO.separacionSRB, V_SRB],
    [ASCENSO.meco, V_MECO],
  ],
  [ACEL_DESPEGUE, undefined, undefined, undefined],
)

/** Órbita al cortar motores: velocidad radial (subida, km/s) e inercial, con la órbita de NASA. */
const R_MECO = R_TIERRA_KM + ALT_MECO
const V_INERCIAL_MECO = Math.sqrt(MU_TIERRA * (2 / R_MECO - 1 / SEMIEJE_KM))
const MOMENTO = Math.sqrt(MU_TIERRA * SEMIEJE_KM * (1 - Math.pow((APOGEO_KM - PERIGEO_KM) / (APOGEO_KM + PERIGEO_KM), 2)))
const V_RADIAL_MECO = Math.sqrt(Math.max(0, V_INERCIAL_MECO * V_INERCIAL_MECO - Math.pow(MOMENTO / R_MECO, 2)))

/**
 * Los primeros 10 s el cohete sube en vertical: la altura sale de integrar la velocidad. Desde ahí
 * se une con las altitudes reales, y en el corte de motores sube a la velocidad radial de la órbita.
 */
const T_VERTICAL = 10
const ALT_VERTICAL = (() => {
  const n = 40
  let s = 0
  for (let i = 0; i < n; i++) s += evaluar(VELOCIDAD, ((i + 0.5) / n) * T_VERTICAL) * (T_VERTICAL / n)
  return s
})()
const ALTITUD = curva(
  [[0, 0], [T_VERTICAL, ALT_VERTICAL], ...ALTITUD_REAL],
  [0, evaluar(VELOCIDAD, T_VERTICAL), undefined, undefined, undefined, V_RADIAL_MECO],
)

/** Tras el corte la nave cae libre en su órbita: altitud y velocidad con las leyes de Kepler. */
function enOrbita(dt: number) {
  // Integración sencilla del movimiento radial; para un minuto basta con pasos de 1 s.
  let r = R_MECO
  let vr = V_RADIAL_MECO
  const pasos = Math.ceil(dt)
  const h = pasos > 0 ? dt / pasos : 0
  for (let i = 0; i < pasos; i++) {
    const ar = -MU_TIERRA / (r * r) + (MOMENTO * MOMENTO) / (r * r * r)
    vr += ar * h
    r += vr * h
  }
  const vInercial = Math.sqrt(MU_TIERRA * (2 / r - 1 / SEMIEJE_KM))
  return { altitud: r - R_TIERRA_KM, velocidad: V_MECO + (vInercial - V_INERCIAL_MECO) }
}

/** Altitud (km) `t` segundos después del despegue. */
export function altitudAscenso(t: number): number {
  if (t <= 0) return 0
  if (t <= T_VERTICAL) {
    const n = 12
    let s = 0
    for (let i = 0; i < n; i++) s += evaluar(VELOCIDAD, ((i + 0.5) / n) * t) * (t / n)
    return s
  }
  if (t <= ASCENSO.meco) return evaluar(ALTITUD, t)
  return enOrbita(t - ASCENSO.meco).altitud
}

/** Velocidad respecto de la Tierra (km/s) `t` segundos después del despegue. */
export function velocidadAscenso(t: number): number {
  if (t <= 0) return 0
  if (t <= ASCENSO.meco) return evaluar(VELOCIDAD, t)
  return enOrbita(t - ASCENSO.meco).velocidad
}

/**
 * Aceleración que siente la tripulación (g): la del perfil a lo largo de la trayectoria más la
 * parte de la gravedad que hay que vencer al subir, g·sen(γ), con sen(γ) = subida / velocidad.
 * No incluye el frenado del aire. En el suelo es 1 g y tras el corte de motores, 0 (caída libre).
 */
export function gAscenso(t: number): number {
  if (t < 0) return 1
  if (t >= ASCENSO.meco) return 0
  const dt = 0.5
  const a = t + dt <= ASCENSO.meco ? t : ASCENSO.meco - dt
  const v0 = velocidadAscenso(a)
  const v1 = velocidadAscenso(a + dt)
  const subida = (altitudAscenso(a + dt) - altitudAscenso(a)) / dt
  const v = (v0 + v1) / 2
  const seno = v > 0.02 ? Math.min(1, Math.max(0, subida / v)) : 1
  const gLocal = G0 * Math.pow(R_TIERRA_KM / (R_TIERRA_KM + altitudAscenso(a)), 2)
  return Math.max(1, (((v1 - v0) / dt) * 1000 + gLocal * seno) / G0)
}

/** Seno del ángulo de la trayectoria sobre el horizonte: lo que sube dividido por la velocidad. */
function senoTrayectoria(t: number): number {
  if (t <= T_VERTICAL) return 1
  const dt = 0.5
  const v = velocidadAscenso(t)
  const subida = (altitudAscenso(t + dt / 2) - altitudAscenso(t - dt / 2)) / dt
  return v > 0.02 ? Math.min(1, Math.max(0, subida / v)) : 1
}

/**
 * Ángulo de la trayectoria (grados sobre el horizonte) y distancia recorrida sobre el suelo (km),
 * calculados del perfil cada segundo: la nave sube en vertical y se va tumbando hacia el este hasta
 * volar casi horizontal al cortar motores.
 */
const TABLA_TRAYECTORIA: Array<[number, number]> = (() => {
  // Las curvas de altitud y velocidad se interpolan por separado, así que el ángulo crudo puede
  // subir un poco entre dos eventos. La nave no vuelve a enderezarse: se toma el mínimo hasta ese
  // momento y se suaviza ±10 s.
  const crudo: number[] = []
  let minimo = 90
  for (let t = 0; t <= 700; t++) {
    minimo = Math.min(minimo, (Math.asin(senoTrayectoria(t)) * 180) / Math.PI)
    crudo.push(minimo)
  }
  const tabla: Array<[number, number]> = []
  let distancia = 0
  for (let t = 0; t <= 700; t++) {
    let suma = 0
    let n = 0
    for (let k = Math.max(0, t - 10); k <= Math.min(700, t + 10); k++, n++) suma += crudo[k]
    const gamma = t <= T_VERTICAL ? 90 : suma / n
    tabla.push([gamma, distancia])
    const coseno = Math.cos((gamma * Math.PI) / 180)
    distancia += velocidadAscenso(t + 0.5) * coseno * (R_TIERRA_KM / (R_TIERRA_KM + altitudAscenso(t + 0.5)))
  }
  return tabla
})()

function deTabla(t: number, c: 0 | 1): number {
  if (t <= 0) return TABLA_TRAYECTORIA[0][c]
  const i = Math.min(TABLA_TRAYECTORIA.length - 2, Math.floor(t))
  const x = Math.min(1, t - i)
  return TABLA_TRAYECTORIA[i][c] + (TABLA_TRAYECTORIA[i + 1][c] - TABLA_TRAYECTORIA[i][c]) * x
}

/** Ángulo de la trayectoria sobre el horizonte (grados) `t` segundos después del despegue. */
export const trayectoriaAscenso = (t: number) => (t <= 0 ? 90 : deTabla(t, 0))
/** Distancia recorrida sobre el suelo desde la plataforma (km). */
export const distanciaAscenso = (t: number) => (t <= 0 ? 0 : deTabla(t, 1))

/**
 * Rumbo de lanzamiento (grados desde el norte hacia el este) para la inclinación de 30.5° que
 * publicó Jonathan McDowell (Jonathan's Space Report 812) desde la latitud de LC-39B (28.627° N):
 * sen(rumbo) = cos(i) / cos(latitud). Sale hacia el este-noreste, sobre el Atlántico.
 */
export const RUMBO_ASCENSO = (Math.asin(Math.cos((30.5 * Math.PI) / 180) / Math.cos((28.627 * Math.PI) / 180)) * 180) / Math.PI

/** Fracción del propelente de la etapa central que queda: se gasta en "algo más de ocho minutos". */
export function propelenteCentral(t: number): number {
  const inicio = ASCENSO.arranqueRS25
  return Math.max(0, Math.min(1, 1 - (t - inicio) / (ASCENSO.meco - inicio)))
}

/** Empuje relativo de los propulsores sólidos (0..1): pleno hasta 110 s y se apaga al separarse. */
export function empujeSRB(t: number): number {
  if (t < 0 || t >= ASCENSO.separacionSRB) return 0
  if (t < 110) return 1
  if (t < ASCENSO.apagadoSRB) return 1 - 0.75 * ((t - 110) / (ASCENSO.apagadoSRB - 110))
  return 0.25 * (1 - (t - ASCENSO.apagadoSRB) / (ASCENSO.separacionSRB - ASCENSO.apagadoSRB))
}

/** Empuje relativo de los RS-25 (0..1): arrancan a T-6.36 s y se apagan en el MECO. */
export function empujeRS25(t: number): number {
  if (t < ASCENSO.arranqueRS25 || t >= ASCENSO.meco) return 0
  // Arranque en unos 3 s; bajan el empuje durante la máxima presión y al soltar los propulsores.
  const arranque = Math.min(1, (t - ASCENSO.arranqueRS25) / 3)
  const cubeta = 1 - 0.2 * Math.exp(-Math.pow((t - ASCENSO.maxQ) / 12, 2)) - 0.2 * (t > 115 && t < ASCENSO.separacionSRB ? 1 : 0)
  return arranque * cubeta
}

/** Nombre de la etapa en pantalla (corto, en inglés). */
export function etapaAscenso(t: number): string {
  if (t < 0) return 'Terminal count'
  if (t < 10) return 'Liftoff'
  if (t >= ASCENSO.maxQ - 8 && t < ASCENSO.maxQ + 8) return 'Max Q'
  if (t < ASCENSO.apagadoSRB) return 'Boosters + core stage'
  if (t < ASCENSO.separacionSRB) return 'Booster burnout'
  if (t < ASCENSO.separacionSRB + 8) return 'Booster separation'
  if (t < ASCENSO.carenado) return 'Core stage'
  if (t < ASCENSO.torreEscape) return 'Fairing jettison'
  if (t < ASCENSO.torreEscape + 8) return 'Abort tower jettison'
  if (t < ASCENSO.meco) return 'Core stage'
  if (t < ASCENSO.separacionCentral) return 'Main engine cutoff'
  if (t < ASCENSO.separacionCentral + 12) return 'Core stage separation'
  return 'Orion + ICPS in orbit'
}

/** Llamada real de la cuenta terminal en este momento (kit de prensa), o null. */
export function llamadaCuenta(t: number): string | null {
  if (t < ASCENSO.quemadores || t >= 8) return null
  if (t < ASCENSO.ordenArranque) return 'Hydrogen burn-off igniters initiated'
  if (t < ASCENSO.arranqueRS25) return 'Go for core stage engine start'
  if (t < 0) return 'RS-25 engines startup'
  return 'Booster ignition, umbilical separation and liftoff'
}

/** Eventos del ascenso para el panel: nombre corto y momento. */
export const EVENTOS_ASCENSO: ReadonlyArray<{ t: number; nombre: string }> = [
  { t: ASCENSO.despegue, nombre: 'Liftoff' },
  { t: ASCENSO.supersonico, nombre: 'Supersonic' },
  { t: ASCENSO.maxQ, nombre: 'Max Q' },
  { t: ASCENSO.separacionSRB, nombre: 'Booster separation' },
  { t: ASCENSO.carenado, nombre: 'Fairing jettison' },
  { t: ASCENSO.torreEscape, nombre: 'Abort tower jettison' },
  { t: ASCENSO.meco, nombre: 'Main engine cutoff' },
  { t: ASCENSO.separacionCentral, nombre: 'Core stage separation' },
]

/** Próximo evento después de `t`, o null si ya pasaron todos. */
export function proximoEvento(t: number) {
  return EVENTOS_ASCENSO.find((e) => e.t > t) ?? null
}

/** Comprobaciones con los datos (para pruebas): la velocidad al soltar la torre supera 4500 mph. */
export const CONTROL_ASCENSO = {
  velocidadTorreKmS: () => velocidadAscenso(ASCENSO.torreEscape),
  velocidadTorreMinimaKmS: V_TORRE_MINIMA,
  velocidadRadialMecoKmS: V_RADIAL_MECO,
  velocidadInercialMecoKmS: V_INERCIAL_MECO,
}
