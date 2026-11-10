// Cómo se muestra cada medidor: el mismo campo del servidor, las mismas unidades, el mismo
// redondeo y los mismos umbrales en todas las vistas (barra superior, panel lateral, estaciones,
// tarjetas de la tripulación, página principal, Asistente, vista del docente e informe).
// El servidor es la fuente de verdad: aquí solo se da formato, nunca se interpola ni se estima.
import { C } from './ciencia.js'
import { TRANSITO_INICIO_S, type Player, type RoomState, type Vuelo } from './types.js'

export type Tono = 'ok' | 'warn' | 'bad'
/** Un valor listo para mostrar: el número, su texto con unidades y su color. */
export interface Lectura {
  valor: number
  texto: string
  tono: Tono
}

const tono = (malo: boolean, regular: boolean): Tono => (malo ? 'bad' : regular ? 'warn' : 'ok')
const lectura = (valor: number, texto: string, t: Tono): Lectura => ({ valor, texto, tono: t })

/** kPa a mmHg (1 mmHg = 133.322 Pa). */
export const KPA_A_MMHG = 7.50062
export const CO2_LIMITE_MMHG = Math.round(C.PPCO2_LIMITE_KPA * KPA_A_MMHG)
export const CO2_PELIGRO_MMHG = Math.round(C.PPCO2_PELIGRO_KPA * KPA_A_MMHG)

// ---------- Cabina (lo mismo para toda la tripulación) ----------

export const o2Cabina = (s: RoomState): Lectura => {
  const v = s.cabina.ppO2
  return lectura(v, `${v.toFixed(1)} kPa`, tono(v < C.PPO2_MINIMA_KPA, v < 19.5))
}
export const co2Cabina = (s: RoomState): Lectura => {
  const v = s.cabina.ppCO2 * KPA_A_MMHG
  return lectura(v, `${v.toFixed(1)} mmHg`, tono(v >= CO2_PELIGRO_MMHG, v > CO2_LIMITE_MMHG))
}
export const tempCabina = (s: RoomState): Lectura => {
  const v = s.cabina.temp
  return lectura(v, `${v.toFixed(1)} °C`, tono(v < 5 || v > 32, v < 15 || v > 28))
}

// ---------- Cuerpo de cada tripulante ----------

export const pulso = (j: Player): Lectura => {
  const v = Math.round(j.vit.fc)
  return lectura(v, `${v} bpm`, tono(v > 150, v > 110))
}
export const respiracion = (j: Player): Lectura => {
  const v = Math.round(j.vit.fr)
  return lectura(v, `${v} /min`, tono(v > 34, v > 24))
}
export const spo2 = (j: Player): Lectura => {
  const v = Math.round(j.vit.spo2)
  return lectura(v, `${v}%`, tono(v < 88, v < 94))
}
export const salud = (j: Player): Lectura => {
  const v = Math.round(j.vit.salud)
  return lectura(v, `${v}`, tono(v < 40, v < 70))
}
export const hidratacion = (j: Player): Lectura => {
  const v = Math.round(j.vit.hidratacion)
  return lectura(v, `${v}%`, tono(v < 60, v < 85))
}
export const reservas = (j: Player): Lectura => {
  const v = Math.round(j.vit.reservas)
  return lectura(v, `${v}%`, tono(v < 50, v < 80))
}
export const fatiga = (j: Player): Lectura => {
  const v = Math.round(j.vit.fatiga)
  return lectura(v, `${v}%`, tono(v > 85, v > 60))
}
export const condicion = (j: Player): Lectura => {
  const v = Math.round(j.vit.condicion)
  return lectura(v, `${v}%`, tono(v < 70, v < 88))
}
/** Dosis acumulada: una cifra decimal hasta 100 mSv, sin decimales después. */
export const dosisTexto = (mSv: number) => `${mSv < 100 ? (Math.round(mSv * 10) / 10).toFixed(1) : Math.round(mSv)} mSv`
export const dosis = (j: Player): Lectura => {
  const v = j.vit.dosis
  return lectura(v, dosisTexto(v), tono(v > C.LIMITE_CARRERA_MSV, v > 450))
}
/** Tasa de dosis, mSv por día, con dos decimales (los valores de fondo son de 0.1 a 2). */
export const tasaTexto = (mSvDia: number) => `${mSvDia.toFixed(2)} mSv/day`
export const dosisTasa = (j: Player): Lectura => lectura(j.vit.dosisTasa, tasaTexto(j.vit.dosisTasa), 'ok')
export const trajeO2 = (j: Player): Lectura => {
  const v = Math.round((j.trajeO2 / C.TRAJE_O2_KG) * 100)
  return lectura(v, `${v}%`, tono(v < 20, v < 40))
}
export const trajeBateria = (j: Player): Lectura => {
  const v = Math.round(j.trajeBateria * 100)
  return lectura(v, `${v}%`, tono(v < 20, v < 40))
}

// ---------- Recursos y energía ----------

export const kg = (v: number) => `${Math.round(v)} kg`
export const bateria = (s: RoomState): Lectura => {
  const e = s.energia
  const v = e.capacidad ? Math.round((e.bateria / e.capacidad) * 100) : 0
  return lectura(v, `${v}%`, tono(v < 15, v < 40))
}
export const bateriaKwh = (s: RoomState) => `${Math.round(s.energia.bateria)} / ${s.energia.capacidad} kWh`
export const kw = (v: number) => `${v.toFixed(1)} kW`
/** Días que alcanza una reserva (999 = de sobra). */
export const diasTexto = (d: number) => (d >= 999 ? 'plenty' : `${Math.round(d)} d`)
export const diasLargo = (d: number) => (d >= 999 ? 'more than enough days' : `${Math.round(d)} days`)

/** Días de misión que faltan, contando el viaje y la estancia (la misma cuenta en todas partes). */
export function diasRestantes(s: RoomState): number {
  const estancia = (s.mision.solesObjetivo * C.SOL_S) / 86400
  if (s.tAterrizaje > 0 && s.t >= s.tAterrizaje) return Math.max(0, estancia - (s.t - s.tAterrizaje) / 86400)
  return Math.max(0, s.mision.diasTransito - Math.max(0, s.t - TRANSITO_INICIO_S) / 86400) + estancia
}

// ---------- Enlace con la Tierra ----------

/** Retardo de la señal en un sentido: "12 min 46 s". */
export function retardoTexto(segundos: number): string {
  const s = Math.max(0, Math.round(segundos))
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`
}

/** Estado del enlace con la Red de Espacio Profundo, en una línea: "DSN link: good · 12 min 46 s delay". */
export function enlace(v: Vuelo): Lectura & { estado: 'bueno' | 'conjuncion' | 'cerca' } {
  const estado = v.enlace ?? 'bueno'
  const delay = `${retardoTexto(v.retardo)} delay`
  if (estado === 'conjuncion') return { valor: v.retardo, estado, tono: 'bad', texto: `DSN link: solar conjunction · ${delay}` }
  if (estado === 'cerca') return { valor: v.retardo, estado, tono: 'warn', texto: `DSN link: noisy, Sun close · ${delay}` }
  return { valor: v.retardo, estado, tono: 'ok', texto: `DSN link: good · ${delay}` }
}
