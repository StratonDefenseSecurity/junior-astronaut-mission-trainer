// El cuerpo de cada astronauta: respiración, corazón, agua, energía, fatiga, músculo y radiación.
// Los valores de partida son reales (ver shared/ciencia.ts); las ecuaciones son simplificadas.
import { C } from '../../shared/ciencia.js'
import type { Player } from '../../shared/types.js'
import { hacia, limitar } from '../base.js'

export interface Contexto {
  /** Segundos de misión de este paso. */
  dt: number
  g: number
  superficie: boolean
  microgravedad: boolean
  /** Aire de la cabina, en kPa. */
  ppO2: number
  ppCO2: number
  presion: number
  temp: number
  /** kg que puede beber y comer en este paso. */
  aguaDisponible: number
  comidaDisponible: number
  /** 1 normal, 0.8 ahorro, 0.6 estricto. */
  racionComida: number
  /** Horas de ejercicio del plan diario. */
  ejercicio: number
  /** mSv por día que recibe ahora. */
  dosisTasa: number
  alerta: boolean
}

export interface Consumo {
  /** kg que salen del aire de la cabina y kg de CO2 que entran. */
  o2: number
  co2: number
  agua: number
  comida: number
  trajeAgotado: boolean
}

/**
 * Saturación de oxígeno en sangre (%) a partir del aire que se respira.
 * Presión alveolar con la ecuación del gas alveolar y curva de Severinghaus (1979).
 */
export function saturacion(ppO2: number, presionTotal: number, ppCO2: number): number {
  const mmHg = 7.50062
  const inspirado = ppO2 * mmHg * (1 - 47 / Math.max(60, presionTotal * mmHg))
  const arterialCO2 = 40 + Math.max(0, ppCO2 * mmHg - 3) * 0.7
  const alveolar = Math.max(1, inspirado - arterialCO2 / 0.8 - 4)
  const s = 1 / (1 + 23400 / (alveolar * alveolar * alveolar + 150 * alveolar))
  return limitar(s * 100, 0, 99)
}

/** Cada persona tiene un pulso en reposo algo distinto; sale de su identificador. */
function pulsoEnReposo(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return 54 + (h % 11)
}

export const FC_MAXIMA = 208 - 0.7 * C.EDAD

export function pasoTripulante(j: Player, c: Contexto): Consumo {
  const v = j.vit
  const fuera = j.zona === 'exterior'
  const dormido = j.actividad === 'sueno'

  // ---- Gasto metabólico ----
  let W: number = C.METABOLISMO_W[j.actividad]
  // El plan de ejercicio se reparte a lo largo del día.
  if (j.actividad !== 'ejercicio' && !fuera && j.incapacitado <= 0) {
    W += ((C.METABOLISMO_W.ejercicio - C.METABOLISMO_W.reposo) * c.ejercicio) / 24
  }
  // Quien llega débil a Marte gasta más para hacer lo mismo.
  if (c.superficie && (j.actividad === 'trabajo' || fuera)) W *= 1 + (100 - v.condicion) / 150
  if (c.g > 1.5) W *= 1 + (c.g - 1) * 0.12
  const o2 = W * C.O2_KG_POR_J * c.dt
  const co2 = o2 * C.CO2_POR_O2

  // ---- Aire que respira ----
  let ppO2 = c.ppO2
  let ppCO2 = c.ppCO2
  let presion = c.presion
  let trajeAgotado = false
  if (fuera) {
    j.trajeO2 = Math.max(0, j.trajeO2 - o2 - (0.004 * c.dt) / 3600)
    j.trajeBateria = Math.max(0, j.trajeBateria - c.dt / (C.TRAJE_BATERIA_H * 3600))
    trajeAgotado = j.trajeO2 <= 0 || j.trajeBateria <= 0
    ppO2 = trajeAgotado ? 6 : C.TRAJE_PRESION_KPA
    ppCO2 = trajeAgotado ? 3 : 0.1
    presion = C.TRAJE_PRESION_KPA
  }
  v.spo2 = hacia(v.spo2, saturacion(ppO2, presion, ppCO2), c.dt, 90)

  // ---- Corazón y respiración ----
  const vo2 = (W * 60) / C.J_POR_L_O2
  const vo2max = C.VO2MAX_L_MIN * (0.6 + (0.4 * v.condicion) / 100)
  const esfuerzo = limitar((vo2 - 0.3) / (vo2max - 0.3), 0, 1.1)
  const reposo = pulsoEnReposo(j.id)
  let fc = reposo + (FC_MAXIMA - reposo) * esfuerzo
  if (v.spo2 < 94) fc += (94 - v.spo2) * 1.8
  fc += Math.min(25, ppCO2 * 6) + j.deficitAgua * 4
  if (c.g > 1) fc += (c.g - 1) * 22
  if (c.alerta && !dormido) fc += 8
  if (dormido) fc -= 6
  if (v.fatiga > 70) fc += (v.fatiga - 70) * 0.2
  fc = limitar(fc, 38, FC_MAXIMA + 8)
  let fr = 12 + 26 * Math.pow(esfuerzo, 0.9)
  if (ppCO2 > 0.5) fr += (ppCO2 - 0.5) * 6
  if (v.spo2 < 92) fr += (92 - v.spo2) * 0.5
  if (dormido) fr -= 2
  fr = limitar(fr, 8, 50)
  v.fc = hacia(v.fc, fc, c.dt, 40)
  v.fr = hacia(v.fr, fr, c.dt, 40)

  // ---- Agua ----
  const perdida = ((2.5 + (W - C.METABOLISMO_MEDIO_W) * 0.012) * c.dt) / 86400
  const quiere = perdida + Math.min(j.deficitAgua, (1.0 * c.dt) / 3600)
  const bebe = Math.min(quiere, Math.max(0, c.aguaDisponible))
  j.deficitAgua = Math.max(0, j.deficitAgua + perdida - bebe)
  v.hidratacion = limitar(100 - (j.deficitAgua / 6.5) * 100, 0, 100)

  // ---- Comida ----
  const gasto = (W * c.dt) / 4184
  const racion = (C.COMIDA_KG_DIA * c.racionComida * c.dt) / 86400
  // Con ración completa puede comer un poco más para reponerse.
  const extra = c.racionComida >= 1 ? Math.min(j.deficitKcal / C.KCAL_POR_KG_COMIDA, (0.4 * c.dt) / 86400) : 0
  const come = Math.min(racion + extra, Math.max(0, c.comidaDisponible))
  j.deficitKcal = Math.max(0, j.deficitKcal + gasto - come * C.KCAL_POR_KG_COMIDA)
  v.reservas = limitar(100 - (j.deficitKcal / 60000) * 100, 0, 100)

  // ---- Fatiga (puntos por hora) ----
  let df = { sueno: -12.5, reposo: 1.0, trabajo: 3.5, ejercicio: 6, eva: 9 }[j.actividad]
  if (df > 0) {
    if (v.spo2 < 94) df *= 1 + (94 - v.spo2) / 20
    if (ppCO2 > C.PPCO2_LIMITE_KPA) df *= 1.5
    if (v.reservas < 60) df *= 1.3
    if (c.superficie) df *= 1 + (100 - v.condicion) / 200
  }
  v.fatiga = limitar(v.fatiga + (df * c.dt) / 3600, 0, 100)

  // ---- Músculo y hueso (puntos por día) ----
  let dCond = 0
  if (c.microgravedad) dCond = -0.3 + 0.108 * c.ejercicio
  else if (c.superficie) dCond = -0.05 + 0.04 * c.ejercicio
  if (j.actividad === 'ejercicio') dCond += 0.8
  v.condicion = limitar(v.condicion + (dCond * c.dt) / 86400, 35, 100)

  // ---- Radiación ----
  v.dosisTasa = c.dosisTasa
  v.dosis += (c.dosisTasa * c.dt) / 86400

  // ---- Salud (puntos por hora) ----
  let dano = 0
  if (v.spo2 < 88) dano += (88 - v.spo2) * 0.9
  if (!fuera && ppCO2 > C.PPCO2_PELIGRO_KPA) dano += (ppCO2 - C.PPCO2_PELIGRO_KPA) * 3
  if (j.deficitAgua > 2) dano += (j.deficitAgua - 2) * 1.2
  if (j.deficitKcal > 30000) dano += 0.15
  if (!fuera && c.temp < 5) dano += (5 - c.temp) * 0.06
  if (!fuera && c.temp > 32) dano += (c.temp - 32) * 0.2
  if (v.dosis > 1000) dano += 0.4
  if (c.dosisTasa > 150) dano += 0.2
  if (v.fatiga > 92) dano += 0.3
  if (j.dolencia) dano += 0.08
  v.salud = limitar(v.salud + ((dano > 0 ? -dano : 0.35) * c.dt) / 3600, 0, 100)

  if (j.incapacitado > 0) j.incapacitado = Math.max(0, j.incapacitado - c.dt)

  return { o2: fuera ? 0 : o2, co2: fuera ? 0 : co2, agua: bebe, comida: come, trajeAgotado }
}
