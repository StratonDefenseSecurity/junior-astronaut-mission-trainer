// Dificultad, misión de demostración e informe final ("qué aprendimos"). Lo usan el servidor
// (para calcularlo y guardarlo en la sala) y el cliente (para mostrarlo y en el certificado).
import type { Nota, Role } from './types.js'

// ---------- Dificultad ----------

export type Dificultad = 'cadete' | 'astronauta' | 'comandante'

export interface InfoDificultad {
  id: Dificultad
  nombre: string
  descripcion: string
  /** Multiplica la probabilidad de avería al azar de cada equipo. */
  averias: number
  /** Multiplica el tiempo para decidir una emergencia. */
  plazo: number
  /** Cada cuántos ms reales el centro de control da una pista si hay puntos críticos (null = nunca). */
  pistaMs: number | null
  /** Multiplica los días entre dos avisos de escasez. */
  escasez: number
}

export const DIFICULTADES: InfoDificultad[] = [
  { id: 'cadete', nombre: 'Cadet', descripcion: 'More hints from Mission Control. Half as many random breakdowns. 50% more time to decide in an emergency.', averias: 0.5, plazo: 1.5, pistaMs: 60_000, escasez: 0.5 },
  { id: 'astronauta', nombre: 'Astronaut', descripcion: 'The standard mission.', averias: 1, plazo: 1, pistaMs: null, escasez: 1 },
  { id: 'comandante', nombre: 'Commander', descripcion: 'No hints. 60% more random breakdowns. 30% less time to decide in an emergency.', averias: 1.6, plazo: 0.7, pistaMs: null, escasez: 2 },
]
export const DIFICULTAD_BY_ID = Object.fromEntries(DIFICULTADES.map((d) => [d.id, d])) as Record<Dificultad, InfoDificultad>
export const dificultadDe = (room: { dificultad?: Dificultad }) => DIFICULTAD_BY_ID[room.dificultad ?? 'astronauta'] ?? DIFICULTAD_BY_ID.astronauta

// ---------- Misión de demostración ----------

/** La demostración solo acorta la estancia y usa el viaje rápido: los números reales no cambian. */
export const DEMO = { soles: 3, muestras: 2, trayectoria: 'rapida' as const }

// ---------- Lo que se anota durante la misión ----------

/** Lo que se va anotando para el informe final. Pequeño: se guarda con la sala. */
export interface Bitacora {
  /** Pasos de procedimiento hechos y la suma de su calidad (0 a 1). */
  pasos: number
  calidad: number
  notas: Record<Nota, number>
  /** Decisiones valoradas, como mucho 16. `t` es el segundo de misión. */
  decisiones: { t: number; tipo: string; titulo: string; nota: Nota; porque: string }[]
  /** Por jugador: pasos, suma de calidad y habilidades practicadas (ids de HABILIDADES). */
  porJugador: Record<string, { p: number; c: number; h: string[] }>
  /** Retardo máximo de la señal con la Tierra, en segundos. */
  retardoMax: number
  /** Emergencias de escasez que hubo. */
  escaseces: number
  /** Última pista del centro de control (ms reales) y última fase en que la demo subió la escala. */
  pistaMs?: number
  faseDemo?: string
}

export const bitacoraVacia = (): Bitacora => ({ pasos: 0, calidad: 0, notas: { buena: 0, aceptable: 0, riesgosa: 0 }, decisiones: [], porJugador: {}, retardoMax: 0, escaseces: 0 })

// ---------- Informe final ----------

export interface ParteInforme { id: string; nombre: string; puntos: number; max: number; detalle: string }
export interface DecisionInforme { t: number; tipo: string; titulo: string; nota: Nota; porque: string }
export interface PersonaInforme { id: string; nombre: string; rol: Role | null; aportes: number; pasos: number; calidad: number | null; deberes: number; habilidades: string[] }
export interface ObjetivoInforme { id: string; nombre: string; logrado: boolean; detalle: string }
export interface Informe {
  puntos: number
  partes: ParteInforme[]
  decisiones: DecisionInforme[]
  personas: PersonaInforme[]
  objetivos: ObjetivoInforme[]
}

/** Habilidades que se practican con cada trabajo. */
export const HABILIDADES: Record<string, string> = {
  eva: 'Spacewalk safety',
  reparar: 'Equipment repair',
  muestra: 'Field sampling',
  lab: 'Lab analysis',
  medicina: 'Space medicine',
  plan: 'Mission planning',
  nav: 'Navigation',
  trajes: 'Suit inspection',
  salud: 'Crew health checks',
  inventario: 'Inventory control',
  radiacion: 'Radiation science',
  fugas: 'Leak repair',
  co2: 'CO2 control',
  paneles: 'Solar power care',
  huerto: 'Space farming',
  montaje: 'Base assembly',
  decision: 'Emergency decisions',
}

const DEBER_HABILIDAD: Record<string, string> = { planificacion: 'plan', navegacion: 'nav', trajes: 'trajes', chequeo: 'salud', inventario: 'inventario', experimento: 'radiacion' }
const HUERTO = ['huerto', 'regar', 'ralear', 'moho', 'amarillas', 'cosechar', 'lechuga', 'mizuna', 'rabano', 'chile']

/** La habilidad que practica un paso del procedimiento `id`. Lo demás es montaje de la base. */
export function habilidadDe(id: string): string {
  const [familia, objetivo] = id.split(':')
  if (familia === 'salida' || familia === 'entrada') return 'eva'
  if (familia === 'reparar') return 'reparar'
  if (familia === 'muestra') return 'muestra'
  if (familia === 'analizar') return 'lab'
  if (familia === 'tratar') return 'medicina'
  if (familia === 'deber') return DEBER_HABILIDAD[objetivo] ?? 'plan'
  if (familia === 'sellar') return 'fugas'
  if (familia === 'lioh') return 'co2'
  if (familia === 'limpiar') return 'paneles'
  if (HUERTO.includes(familia)) return 'huerto'
  return 'montaje'
}

/**
 * Lo que hacen las tripulaciones reales ante cada tipo de decisión, en una frase, y el tema de
 * FUENTES (shared/ciencia.ts) que lo respalda.
 */
export const PRACTICA_NASA: Record<string, { texto: string; fuente: string }> = {
  fallo: { texto: 'On the ISS, a failed unit is swapped for a spare instead of being repaired on the spot.', fuente: 'Orbital Replacement Units' },
  fuga: { texto: 'In 2018 an ISS crew traced a slow pressure drop to a 2 mm hole and sealed it with tape and sealant.', fuente: 'Sealing a leak on the ISS (2018)' },
  medico: { texto: 'Far from Earth there is no evacuation, so NASA requires a physician on every planetary crew.', fuente: 'Medical care far from Earth' },
  mareo: { texto: 'Far from Earth there is no evacuation, so NASA requires a physician on every planetary crew.', fuente: 'Medical care far from Earth' },
  particulas: { texto: 'NASA keeps each career dose under 600 mSv, so every hour of exposure in a solar storm counts.', fuente: 'Radiation limit' },
  refugio: { texto: 'NASA keeps each career dose under 600 mSv, so every hour of exposure in a solar storm counts.', fuente: 'Radiation limit' },
  polvo: { texto: 'The solar-powered Opportunity rover went silent in a global dust storm in June 2018.', fuente: 'Opportunity and the global storm of 2018' },
  escasez: { texto: 'Every item on the ISS has a barcode and is tracked, so crews know what they have left.', fuente: 'Inventory on the ISS' },
  correccion: { texto: 'Navigators find the ship\'s position with Deep Space Network radio tracking.', fuente: 'Spacecraft navigation' },
  equipo: { texto: 'One person uses 0.84 kg of oxygen a day, so life support has to keep running.', fuente: 'Breathing and metabolism' },
}
export const PRACTICA_GENERAL = { texto: 'ISS crews go over the plan and any changes with flight control every day.', fuente: 'Daily Planning Conference' }
export const practicaDe = (tipo: string) => PRACTICA_NASA[tipo] ?? PRACTICA_GENERAL
