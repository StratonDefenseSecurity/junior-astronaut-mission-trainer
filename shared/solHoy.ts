// "El Sol ahora": resumen de los últimos 30 días de clima espacial según DONKI (NASA). Lo arma
// server/solHoy.ts; aquí van su forma, la regla del nivel de riesgo y los textos para niños.

/** Días hacia atrás que cubre el resumen en vivo. */
export const VENTANA_SOL_DIAS = 30

/** Fulguración: [día desde `desde`, clase, región activa (0 si no hay), id DONKI, fecha AAAA-MM-DD]. */
export type FulguracionSol = [number, string, number, string, string]
/** Evento de partículas: [día desde `desde`, registros de instrumentos, ¿GOES o más de 100 MeV?, id DONKI, fecha]. */
export type ParticulasSol = [number, number, boolean, string, string]

export interface ResumenSol {
  /** 'vivo' = descargado ahora de DONKI; 'archivo' = el registro de 2024 que trae el juego. */
  modo: 'vivo' | 'archivo'
  /** Primer y último día de la ventana (UTC, AAAA-MM-DD). */
  desde: string
  hasta: string
  /** Días que van de `desde` (00:00 UTC) a la descarga: lo que dura la parte en vivo de la misión. */
  dias: number
  /** Momento de la descarga (ISO, UTC). En el archivo, el día en que se bajó el registro. */
  obtenido: string
  /** Servicio del que salió. */
  servicio: string
  /** Direcciones consultadas (sin clave). */
  urls: string[]
  /** Por qué se usa el archivo en vez de los datos en vivo. */
  aviso?: string
  /** Fulguraciones por clase. El archivo de 2024 solo guarda las de clase X (null = no se sabe). */
  clases: { X: number; M: number | null; C: number | null }
  /** La fulguración más fuerte de la ventana. */
  mayor: { clase: string; fecha: string } | null
  /** Fulguraciones de clase M y X, las que el juego lleva a la misión. */
  fulguraciones: FulguracionSol[]
  /** Eventos de partículas solares (los registros de un mismo evento ya agrupados). */
  particulas: ParticulasSol[]
  /** Índice Kp más alto de las tormentas geomagnéticas y su fecha (null = sin dato). */
  kpMax: number | null
  kpFecha: string | null
  /** Eyecciones de masa coronal registradas (null = sin dato). */
  eyecciones: number | null
}

export type NivelSol = 'Low' | 'Medium' | 'High'

/**
 * Regla del nivel de riesgo, a la vista en el juego y en SUPUESTOS: alto si hubo al menos un
 * evento de partículas; medio si no hubo ninguno pero sí fulguraciones de clase M o X (las
 * clases que pueden venir con una tormenta de partículas); bajo en otro caso.
 */
export function nivelSol(r: ResumenSol): { nivel: NivelSol; porque: string } {
  const n = r.particulas.length
  if (n > 0) return { nivel: 'High', porque: `${n} solar particle ${n === 1 ? 'event' : 'events'} in these days.` }
  const fuertes = r.clases.X + (r.clases.M ?? 0)
  if (fuertes > 0) return { nivel: 'Medium', porque: `No solar particle event, but ${fuertes} strong (${r.clases.M === null ? 'X' : 'M or X'} class) ${fuertes === 1 ? 'flare' : 'flares'}.` }
  return { nivel: 'Low', porque: `No solar particle event and no ${r.clases.M === null ? 'X' : 'M or X'} class flare.` }
}

export const REGLA_NIVEL_SOL =
  'High: at least one solar particle event in the 30 days. Medium: none, but at least one M or X class flare (the strong flares that can come with a particle storm). Low: neither.'

export const EXPLICACION_SOL =
  'A solar flare is a flash of light from the Sun. A solar particle event is a shower of fast particles; that is when astronauts go to the shelter.'

const MESES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MESES_CORTOS = MESES.map((m) => m.slice(0, 3))

/** '2026-11-05' → 'November 5, 2026'. */
export function fechaSol(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${MESES[Number(m) - 1]} ${Number(d)}, ${a}`
}

/** '2026-10-15', '2026-11-14' → 'Oct 15 – Nov 14, 2026'. */
export function rangoSol(desde: string, hasta: string): string {
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  return `${MESES_CORTOS[m1 - 1]} ${d1}${a1 !== a2 ? `, ${a1}` : ''} – ${MESES_CORTOS[m2 - 1]} ${d2}, ${a2}`
}

/** Hora de la descarga en UTC: 'Nov 14, 2026, 15:07 UTC'. */
export function horaSol(iso: string): string {
  const [f, h] = iso.split('T')
  const [a, m, d] = f.split('-').map(Number)
  return `${MESES_CORTOS[m - 1]} ${d}, ${a}${h ? `, ${h.slice(0, 5)} UTC` : ''}`
}

/** Etiqueta corta que acompaña a todo dato: en vivo o archivado, siempre con su fecha. */
export function etiquetaSol(r: ResumenSol): string {
  return r.modo === 'vivo'
    ? `Live from NASA DONKI, ${rangoSol(r.desde, r.hasta)} (fetched ${horaSol(r.obtenido)})`
    : `Archived NASA DONKI record, ${rangoSol(r.desde, r.hasta)}`
}

/**
 * Costo del refugio (valor del juego, en SUPUESTOS): mientras hay gente en el refugio y nadie
 * queda en la cabina para vigilar y ajustar los equipos, estos se desgastan este número de veces
 * más rápido.
 */
export const DESGASTE_SIN_VIGILANCIA = 1.5
