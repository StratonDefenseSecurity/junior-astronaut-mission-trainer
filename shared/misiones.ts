// Misiones personales: objetivos de cada tripulante según su rol y la situación, aparte de las
// emergencias. Se cuentan con lo que ya anota la bitácora (trabajos terminados por familia y
// decisiones), así que no hay estado nuevo que guardar. Cada una cita su tema de FUENTES
// (shared/ciencia.ts); cuántas veces hay que hacerlas es un valor del juego (ver SUPUESTOS).
import type { Bitacora } from './informe.js'
import type { Phase, Player, Role, RoomState } from './types.js'

/** Familia de un trabajo para contarlo: `deber:navegacion` se cuenta aparte; `reparar:oga`, como `reparar`. */
export const familiaDe = (procId: string) => (procId.startsWith('deber:') ? procId : procId.split(':')[0])

export interface MisionPersonal {
  id: string
  rol: Role
  titulo: string
  /** Por qué importa, en una frase. */
  detalle: string
  /** Dónde se hace. */
  donde: string
  /** Fases en las que se puede avanzar. */
  fases: Phase[]
  meta: number
  /** Cuánto lleva: trabajos terminados de esta familia, decisiones, o un valor de la sala. */
  cuenta: { familia: string } | { decisiones: true } | { valor: (s: RoomState) => number }
  /** Solo en las misiones que lo cumplen (por ejemplo, las que piden agua del hielo). */
  aplica?: (s: RoomState) => boolean
  /** Tema de FUENTES que lo respalda. */
  fuente: string
}

const VIAJE: Phase[] = ['transito']
const MARTE: Phase[] = ['ensamblaje', 'base']
const SIEMPRE: Phase[] = ['transito', 'llegada', 'ensamblaje', 'base']
const RUTINA: Phase[] = ['transito', 'base']

export const MISIONES: MisionPersonal[] = [
  { id: 'cmd-plan', rol: 'comandante', titulo: 'Run the daily planning conference', detalle: 'ISS crews review the plan with flight control every day.', donde: 'Comms & Nav', fases: RUTINA, meta: 2, cuenta: { familia: 'deber:planificacion' }, fuente: 'Daily Planning Conference' },
  { id: 'cmd-decidir', rol: 'comandante', titulo: 'Lead the crew through a decision', detalle: 'Far from Earth, the crew decides on its own.', donde: 'Emergencies and proposals', fases: SIEMPRE, meta: 1, cuenta: { decisiones: true }, fuente: 'Medical care far from Earth' },
  { id: 'pil-nav', rol: 'piloto', titulo: 'Check the ship position', detalle: 'A small drift found early costs almost no fuel.', donde: 'Comms & Nav', fases: VIAJE, meta: 2, cuenta: { familia: 'deber:navegacion' }, fuente: 'Spacecraft navigation' },
  { id: 'pil-trajes', rol: 'piloto', titulo: 'Inspect the suits', detalle: 'Glove cuts are checked after every walk outside.', donde: 'Airlock', fases: ['base'], meta: 1, cuenta: { familia: 'deber:trajes' }, fuente: 'Spacesuit glove inspection' },
  { id: 'pil-eva', rol: 'piloto', titulo: 'Go outside and come back in safely', detalle: 'Every walk outside ends with the dust left on Mars.', donde: 'Airlock', fases: MARTE, meta: 1, cuenta: { familia: 'entrada' }, fuente: 'Perchlorate in the soil of Mars' },
  { id: 'med-chequeo', rol: 'medico', titulo: 'Run the crew health check', detalle: 'Small problems found early are easy to treat.', donde: 'Medical Bay', fases: RUTINA, meta: 2, cuenta: { familia: 'deber:chequeo' }, fuente: 'Crew medical checks on the ISS' },
  { id: 'med-tratar', rol: 'medico', titulo: 'Treat a crewmate who needs it', detalle: 'There is no evacuation from Mars.', donde: 'Medical Bay', fases: SIEMPRE, meta: 1, cuenta: { familia: 'tratar' }, fuente: 'Medical care far from Earth' },
  { id: 'log-inv', rol: 'logistica', titulo: 'Audit the inventory', detalle: 'Every item has a barcode, so the crew knows what is left.', donde: 'Stowage', fases: RUTINA, meta: 2, cuenta: { familia: 'deber:inventario' }, fuente: 'Inventory on the ISS' },
  { id: 'log-paneles', rol: 'logistica', titulo: 'Clean the solar panels', detalle: 'Dust slowly steals power from the panels.', donde: 'Solar Arrays', fases: ['base'], meta: 1, cuenta: { familia: 'limpiar' }, fuente: 'Cleaning the panels of InSight' },
  { id: 'sci-exp', rol: 'cientifico', titulo: 'Record the radiation experiment', detalle: 'Dose data protects this crew and the next one.', donde: 'Science Rack', fases: RUTINA, meta: 2, cuenta: { familia: 'deber:experimento' }, fuente: 'Radiation during the trip' },
  { id: 'sci-muestra', rol: 'cientifico', titulo: 'Collect a rock sample', detalle: 'Perseverance seals each core in a clean tube.', donde: 'A Sample Site', fases: ['base'], meta: 1, cuenta: { familia: 'muestra' }, fuente: 'How Perseverance takes a sample' },
  { id: 'sci-lab', rol: 'cientifico', titulo: 'Analyze a sample in the lab', detalle: 'Curiosity found clay with this kind of analysis.', donde: 'Lab & Garden', fases: ['base'], meta: 1, cuenta: { familia: 'analizar' }, fuente: 'Clay found by CheMin' },
  { id: 'sis-filtros', rol: 'sistemas', titulo: 'Clean the air filters', detalle: 'Clogged filters make the equipment wear out faster.', donde: 'Life Support', fases: RUTINA, meta: 2, cuenta: { familia: 'deber:filtros' }, fuente: 'Air filters on the ISS' },
  { id: 'sis-reparar', rol: 'sistemas', titulo: 'Swap a worn unit', detalle: 'On the ISS a failed unit is swapped for a spare.', donde: 'The worn equipment', fases: SIEMPRE, meta: 1, cuenta: { familia: 'reparar' }, fuente: 'Orbital Replacement Units' },
  {
    id: 'sis-hielo',
    rol: 'sistemas',
    titulo: 'Get the water out of the ice',
    detalle: 'This mission depends on water mined at the site.',
    donde: 'Ice Extractor',
    fases: ['base'],
    meta: 1,
    cuenta: { valor: (s) => (s.mision.aguaObjetivo ? Math.min(1, s.mision.aguaExtraida / s.mision.aguaObjetivo) : 0) },
    aplica: (s) => s.mision.aguaObjetivo > 0,
    fuente: 'Buried ice in Utopia Planitia',
  },
]

export interface AvanceMision {
  mision: MisionPersonal
  hecho: number
  hecha: boolean
  /** Se puede avanzar ahora (la fase es la suya). */
  ahora: boolean
}

type PorJugador = Bitacora['porJugador'][string]

/** Cuánto lleva `j` en cada misión de su rol. Las cumplidas se guardan, así que no se pierden. */
export function misionesDe(s: RoomState, j: Player): AvanceMision[] {
  if (!j.rol) return []
  const p: PorJugador | undefined = s.bitacora?.porJugador[j.id]
  return MISIONES.filter((m) => m.rol === j.rol && (m.aplica?.(s) ?? true)).map((m) => {
    const c = m.cuenta
    const bruto = 'familia' in c ? (p?.f?.[c.familia] ?? 0) : 'decisiones' in c ? (p?.d ?? 0) : c.valor(s)
    const hecha = Boolean(p?.m?.includes(m.id)) || bruto >= m.meta
    return { mision: m, hecho: Math.min(m.meta, bruto), hecha, ahora: m.fases.includes(s.fase) }
  })
}

/** Las que conviene enseñar: las de la fase actual, las cumplidas y, si no hay, las que vienen. */
export function misionesVisibles(s: RoomState, j: Player): AvanceMision[] {
  const todas = misionesDe(s, j)
  const utiles = todas.filter((a) => a.ahora || a.hecha)
  return utiles.length ? utiles : todas
}

/** Texto del avance: "1 of 2" o, para las de valor continuo, el porcentaje. */
export const avanceTexto = (a: AvanceMision) =>
  'valor' in a.mision.cuenta ? `${Math.round(a.hecho * 100)}%` : `${Math.floor(a.hecho)} of ${a.mision.meta}`
