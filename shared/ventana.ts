// Ventana de lanzamiento diaria desde la plataforma 39B del Centro Espacial Kennedy.
//
// Modelo de salida con órbita de aparcamiento (el de Curiosity y Perseverance):
//  1. La transferencia a Marte (Lambert, shared/lambert.ts) da la velocidad de la nave respecto
//     de la Tierra al salir, v-infinito. Su dirección es la asíntota de salida, con su
//     declinación (DLA) y ascensión recta (RLA).
//  2. El cohete deja la nave en una órbita baja de aparcamiento. Esa órbita tiene que contener la
//     asíntota; dónde se enciende la etapa superior para salir hacia Marte se ajusta con el tiempo
//     de espera en órbita. El plano queda fijado por dos rectas: la del centro de la Tierra a la
//     plataforma en el despegue y la asíntota. Así, el rumbo del despegue (azimut) es el azimut con
//     que se ve la asíntota desde la plataforma, o el opuesto, el que vaya hacia el este.
//  3. La Tierra gira y la plataforma cambia de plano: el azimut necesario barre de norte a sur dos
//     veces al día. La ventana es el rato en que ese azimut cae dentro de los permitidos y la
//     espera en órbita es corta.
//
// Comprobado contra misiones reales con este mismo modelo: para Curiosity (26 de noviembre de 2011,
// llegada el 6 de agosto de 2012) la ventana abre a las 9:58 EST, y la real abrió a las 10:02 EST;
// para Perseverance (30 de julio de 2020, llegada el 18 de febrero de 2021) abre a las 7:51 EDT, y
// despegó a las 7:50 EDT. Fuentes en shared/ciencia.ts (FUENTES).
import { Body, HelioVector, MakeTime, RotateVector, Rotation_EQJ_EQD, SiderealTime, Vector } from 'astronomy-engine'
import { resolverLambert, type Vec3 } from './lambert.js'

/**
 * Plataforma 39B (Kennedy, Florida): 28°37′38″ N, 80°37′15″ W, de donde salió Artemis I.
 * Fuente: coordenadas de la ficha de Kennedy Space Center Launch Complex 39B (Wikipedia).
 */
export const LC39B = { lat: 28.62722, lon: -80.62083 }

/**
 * Azimuts permitidos para el despegue, en grados desde el norte (SUPUESTO calibrado). Con este
 * modelo, las ventanas reales de Curiosity (26/11/2011, 10:02 a 11:45 EST) y de Perseverance
 * (30/07/2020, 7:50 a 9:50 EDT) van de 89° a 102°, y la de Perseverance del 20/07/2020 (9:15 a
 * 11:15 EDT), con la asíntota más al norte, de 105° a 113°. El juego usa 89° a 113° para todas.
 */
export const AZIMUT_MIN = 89
export const AZIMUT_MAX = 113
/**
 * La ventana dura lo que el azimut está dentro de lo permitido, como mucho 2 h (las ventanas de
 * Perseverance y de Artemis I duraron 2 h) y como poco 1 h (la de Curiosity, 1 h 43 min). SUPUESTO.
 */
export const VENTANA_MAX_MIN = 120
export const VENTANA_MIN_MIN = 60
/**
 * Arco de la órbita de aparcamiento, desde el despegue, hasta el encendido hacia Marte. Se
 * aceptan las salidas con espera corta: de 40° (ya en órbita) a 200° (algo más de media vuelta,
 * unos 50 min). Así queda una oportunidad por día. SUPUESTO; en las de Curiosity y Perseverance
 * del modelo salen 130° y 182°.
 */
const ARCO_MIN = 40
const ARCO_MAX = 200
/** Altura de la órbita de aparcamiento (km). SUPUESTO. */
const ALTURA_APARCAMIENTO_KM = 185
/**
 * Si la asíntota está tan al norte o al sur que ningún azimut permitido sirve, el cohete hace un
 * giro lateral (dog-leg). La ventana se abre cuando ese giro es mínimo y dura mientras no crezca
 * más de esto, en grados de azimut. SUPUESTO.
 */
const TOLERANCIA_GIRO = 3

/** μ de la Tierra (km³/s²), IERS 2010, y su radio ecuatorial (km), WGS-84. */
const MU_TIERRA = 398_600.4418
const RADIO_TIERRA = 6378.137
const UA_KM = 149_597_870.7
const DIA_MS = 86_400_000
const MIN_MS = 60_000
const G = Math.PI / 180
/** Grados que gira la Tierra respecto de las estrellas por día solar medio. */
const GIRO_DIA = 360.98564736629

export interface Asintota {
  /** Declinación (DLA) y ascensión recta (RLA) de la asíntota de salida, en grados (ecuador del día). */
  dla: number
  rla: number
  /** Velocidad de salida respecto de la Tierra, km/s. */
  vInfKmS: number
}

export interface Ventana {
  /** Apertura y cierre (ms UTC). El despegue es a la apertura. */
  abre: number
  cierra: number
  /** Azimut del despegue al abrir (grados desde el norte), dentro de los permitidos. */
  azimut: number
  /** Grados de giro lateral (dog-leg) que hacen falta porque la asíntota no se alcanza; 0 si ninguno. */
  giro: number
  /** true si la ventana necesita una espera larga en órbita (más de media vuelta). */
  esperaLarga: boolean
  dla: number
  rla: number
  vInf: number
}

// ------------------------------------------------------------------ hora de Florida

/** Día del mes del n-ésimo domingo de un mes (mes 0..11). */
function domingo(anio: number, mes: number, n: number): number {
  const primero = new Date(Date.UTC(anio, mes, 1)).getUTCDay()
  return 1 + ((7 - primero) % 7) + 7 * (n - 1)
}

/**
 * Horas de diferencia con UTC en Florida en ese instante: −4 con horario de verano (EDT), −5 en
 * invierno (EST). Regla de EE. UU. desde 2007: del segundo domingo de marzo al primer domingo de
 * noviembre, a las 2:00 locales.
 */
export function desfaseFlorida(ms: number): number {
  const anio = new Date(ms).getUTCFullYear()
  const inicio = Date.UTC(anio, 2, domingo(anio, 2, 2), 7)
  const fin = Date.UTC(anio, 10, domingo(anio, 10, 1), 6)
  return ms >= inicio && ms < fin ? -4 : -5
}

export const zonaFlorida = (ms: number) => (desfaseFlorida(ms) === -4 ? 'EDT' : 'EST')

/** "07:42" en hora de Florida. */
export function horaFlorida(ms: number): string {
  const d = new Date(ms + desfaseFlorida(ms) * 3_600_000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** "Launch window: opens 07:42, closes 09:12 local (EST)". */
export const textoVentana = (v: { abre: number; cierra: number }) =>
  `Launch window: opens ${horaFlorida(v.abre)}, closes ${horaFlorida(v.cierra)} local (${zonaFlorida(v.abre)})`

/** Medianoche de Florida (ms UTC) del día 'AAAA-MM-DD'. */
export function medianocheFlorida(dia: string): number {
  const [a, m, d] = dia.slice(0, 10).split('-').map(Number)
  const mediodia = Date.UTC(a, m - 1, d, 12)
  return Date.UTC(a, m - 1, d) - desfaseFlorida(mediodia) * 3_600_000
}

/** El día 'AAAA-MM-DD' que va `n` días después. */
export const sumarDias = (dia: string, n: number) => new Date(Date.parse(dia.slice(0, 10) + 'T00:00:00Z') + n * DIA_MS).toISOString().slice(0, 10)

// ------------------------------------------------------------------ asíntota

const v3 = (v: { x: number; y: number; z: number }): Vec3 => ({ x: v.x, y: v.y, z: v.z })

/**
 * Asíntota de salida hacia Marte para un despegue en `salida` con `dias` de viaje: la velocidad de
 * la transferencia de Lambert menos la de la Tierra (diferencia centrada de una hora), pasada al
 * ecuador del día con la precesión y la nutación de astronomy-engine.
 */
export function asintotaSalida(salida: Date, dias: number): Asintota {
  const llegada = new Date(salida.getTime() + dias * DIA_MS)
  const { v1 } = resolverLambert(v3(HelioVector(Body.Earth, salida)), v3(HelioVector(Body.Mars, llegada)), dias)
  const a = HelioVector(Body.Earth, new Date(salida.getTime() - 3_600_000))
  const b = HelioVector(Body.Earth, new Date(salida.getTime() + 3_600_000))
  // UA/día: la diferencia de dos horas por 12.
  const vInf = { x: v1.x - (b.x - a.x) * 12, y: v1.y - (b.y - a.y) * 12, z: v1.z - (b.z - a.z) * 12 }
  const n = Math.hypot(vInf.x, vInf.y, vInf.z)
  const t = MakeTime(salida)
  const s = RotateVector(Rotation_EQJ_EQD(t), new Vector(vInf.x / n, vInf.y / n, vInf.z / n, t))
  return {
    dla: Math.asin(Math.max(-1, Math.min(1, s.z))) / G,
    rla: ((Math.atan2(s.y, s.x) / G) % 360 + 360) % 360,
    vInfKmS: (n * UA_KM) / 86_400,
  }
}

/**
 * Lo que pide la asíntota en un instante: azimut del despegue (0..180, siempre hacia el este) y
 * arco de órbita de aparcamiento hasta el encendido hacia Marte (grados).
 *  - En la plataforma (ejes este, norte, cenit), la asíntota S tiene ángulo horario H.
 *  - El rumbo es la proyección horizontal de S, o la opuesta si S está al oeste.
 *  - σ es el ángulo, en el sentido del movimiento, de la plataforma a S dentro del plano. El
 *    perigeo de la hipérbola de salida está θ∞ antes de la asíntota (cos θ∞ = −1/e), así que el
 *    encendido llega tras un arco σ − θ∞.
 */
function geometria(H: number, dec: number, lat: number, thetaInf: number): { azimut: number; arco: number } {
  const este = -Math.cos(dec) * Math.sin(H)
  const norte = Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(H)
  const arriba = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)
  const haciaS = este >= 0
  let azimut = Math.atan2(este, norte) / G
  if (azimut < 0) azimut += 360
  if (!haciaS) azimut -= 180
  const sigma = ((Math.atan2((haciaS ? 1 : -1) * Math.hypot(este, norte), arriba) / G) % 360 + 360) % 360
  const arco = ((sigma - thetaInf) % 360 + 360) % 360
  return { azimut, arco }
}

/**
 * Grados de azimut que faltan para entrar en lo permitido (0 si ya está dentro). Infinity si la
 * espera en órbita no cabe entre ARCO_MIN y `arcoMax`.
 */
function desvio(azimut: number, arco: number, arcoMax: number): number {
  if (arco < ARCO_MIN || arco > arcoMax) return Infinity
  return Math.max(0, AZIMUT_MIN - azimut, azimut - AZIMUT_MAX)
}

const cache = new Map<string, Ventana>()

/**
 * Primera ventana del día local `dia` ('AAAA-MM-DD', hora de Florida) para un viaje de `dias`
 * días. Recorre el día de minuto en minuto; la asíntota se calcula una vez, al mediodía (cambia
 * menos de un grado por día). Busca, en este orden:
 *  1. azimut permitido y espera corta en órbita (lo normal, como Curiosity y Perseverance);
 *  2. azimut permitido con una espera larga, de hasta una vuelta entera;
 *  3. si la asíntota queda demasiado al norte o al sur, espera corta y el menor giro lateral.
 * Determinista y en caché.
 */
export function ventanaDelDia(dia: string, dias: number): Ventana {
  const clave = `${dia.slice(0, 10)}:${dias}`
  const guardada = cache.get(clave)
  if (guardada) return guardada
  const t0 = medianocheFlorida(dia)
  const asin = asintotaSalida(new Date(t0 + DIA_MS / 2), dias)
  const rp = RADIO_TIERRA + ALTURA_APARCAMIENTO_KM
  const thetaInf = Math.acos(-1 / (1 + (rp * asin.vInfKmS ** 2) / MU_TIERRA)) / G
  const dec = asin.dla * G
  const lat = LC39B.lat * G
  // Tiempo sidéreo aparente de Greenwich a medianoche local, y la Tierra girando desde ahí.
  const gast0 = SiderealTime(new Date(t0)) * 15
  // Se mira un minuto antes de medianoche para no contar como apertura una ventana que viene del
  // día anterior, y hasta 26 h por si la de hoy se corrió pasada la medianoche.
  const muestras = Array.from({ length: 26 * 60 + 2 }, (_, i) =>
    geometria((gast0 + (GIRO_DIA * (i - 1)) / 1440 + LC39B.lon - asin.rla) * G, dec, lat, thetaInf),
  )
  const minimoDelDia = (arcoMax: number) => Math.min(...muestras.slice(1, 24 * 60 + 1).map((x) => desvio(x.azimut, x.arco, arcoMax)))
  let arcoMax = ARCO_MAX
  let minimo = minimoDelDia(arcoMax)
  if (minimo > 0 && minimoDelDia(360) === 0) {
    arcoMax = 360
    minimo = 0
  }
  const umbral = minimo > 0 ? minimo + TOLERANCIA_GIRO : 0
  const d = muestras.map((x) => desvio(x.azimut, x.arco, arcoMax))
  let abre = -1
  for (let i = 1; i < d.length; i++) {
    if (d[i] <= umbral && d[i - 1] > umbral) {
      abre = i
      break
    }
  }
  // Sin una entrada clara (el giro mínimo cae justo a medianoche), se abre en el mínimo.
  if (abre < 0) abre = Math.max(1, d.indexOf(minimo))
  let cierra = abre
  while (cierra + 1 < d.length && d[cierra + 1] <= umbral && cierra - abre < VENTANA_MAX_MIN) cierra++
  const largo = Math.max(VENTANA_MIN_MIN, Math.min(VENTANA_MAX_MIN, cierra - abre))
  const minutoAbre = abre - 1
  const requerido = muestras[abre].azimut
  // El cohete vuela el azimut permitido más cercano; el resto lo corrige el giro lateral.
  const azimut = Math.max(AZIMUT_MIN, Math.min(AZIMUT_MAX, requerido))
  const v: Ventana = {
    abre: t0 + minutoAbre * MIN_MS,
    cierra: t0 + (minutoAbre + largo) * MIN_MS,
    azimut: Math.round(azimut * 10) / 10,
    giro: Math.round(Math.abs(requerido - azimut)),
    esperaLarga: arcoMax > ARCO_MAX,
    dla: Math.round(asin.dla * 10) / 10,
    rla: Math.round(asin.rla * 10) / 10,
    vInf: Math.round(asin.vInfKmS * 100) / 100,
  }
  if (cache.size > 200) cache.clear()
  cache.set(clave, v)
  return v
}
