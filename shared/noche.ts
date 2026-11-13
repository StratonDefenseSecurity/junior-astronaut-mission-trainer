// La noche en Marte: la altura del Sol, el crepúsculo largo por el polvo alto y lo que cuesta la
// luz. Fuera, los focos del casco, la linterna y la calefacción del traje gastan su batería; dentro,
// las luces del hábitat y los focos exteriores gastan la energía de la base. Sin luz, el suelo no
// se ve: se camina despacio y uno se puede caer. Hechos en FUENTES; valores de juego en SUPUESTOS.
import { C } from './ciencia.js'
import { enMarte } from './horario.js'
import { SITE_BY_ID, type Ambiente, type Player, type RoomState } from './types.js'

const RAD = Math.PI / 180

/** Latitud del sitio en grados (+ norte), leída de su ficha ("4.6° S"). */
export function latitudSitio(sitio: string | null | undefined): number {
  const s = SITE_BY_ID[sitio ?? 'gale'] ?? SITE_BY_ID.gale
  const v = parseFloat(s.latitud)
  return /S/.test(s.latitud) ? -v : v
}

export interface SolLocal {
  /** Altura sobre el horizonte, grados (negativa de noche). */
  elevacion: number
  /** Dirección en la escena: +X este, +Y cenit, -Z norte. */
  dir: [number, number, number]
  /** Hora solar verdadera: 12 = el Sol en lo más alto. */
  horaSolar: number
}

/**
 * Posición del Sol para quien está en el sitio. La declinación sale de la estación (Ls) y de la
 * inclinación del eje de Marte: sen δ = sen 25.19° · sen Ls. El mediodía es el punto medio entre
 * la salida y la puesta del registro de Curiosity, así coincide con la energía de los paneles.
 */
export function solMarte(a: Ambiente, lat: number): SolLocal {
  const mediodia = a.amanecer !== undefined && a.atardecer !== undefined ? (a.amanecer + a.atardecer) / 2 : 12.8
  const horaSolar = (((a.hora - mediodia + 12) % 24) + 24) % 24
  const H = (horaSolar - 12) * 15 * RAD
  const d = Math.asin(Math.sin(C.OBLICUIDAD_MARTE_GRADOS * RAD) * Math.sin((a.ls ?? 0) * RAD))
  const f = lat * RAD
  const este = -Math.cos(d) * Math.sin(H)
  const norte = Math.cos(f) * Math.sin(d) - Math.sin(f) * Math.cos(d) * Math.cos(H)
  const arriba = Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(H)
  return { elevacion: Math.asin(Math.max(-1, Math.min(1, arriba))) / RAD, dir: [este, arriba, -norte], horaSolar }
}

/** Sol de la sala ahora (en Marte). */
export const solDeSala = (room: RoomState) => solMarte(room.ambiente, latitudSitio(room.sitio))

/**
 * Brillo del crepúsculo, 1 con el Sol en el horizonte. El polvo alto sigue iluminado mucho después
 * de la puesta: la curva deja un resplandor débil hasta unas dos horas después (Sol a unos −28°).
 */
export const brilloCrepusculo = (elevacion: number) => (elevacion >= 0 ? 1 : Math.exp(elevacion / 5))

/** Juego: con el Sol más de 8° bajo el horizonte el suelo ya no se ve sin luz. */
export const OSCURO_GRADOS = -8

/** De noche en la superficie: hace falta luz para ver el suelo. */
export const oscuro = (room: RoomState) => enMarte(room) && solDeSala(room).elevacion < OSCURO_GRADOS

// ---- Luces y calefacción del traje (juego: fracción del consumo normal del traje) ----
export const LUZ_CASCO = 0.15
export const LUZ_MANO = 0.08
/** Calefacción: 0.4% más por cada grado bajo −20 °C; con Sol, un tercio. */
export const CALOR_POR_GRADO = 0.004
export const CALOR_DESDE_C = -20

export interface CargaTraje {
  luces: number
  calor: number
  /** Multiplica el gasto de batería: 1 = consumo normal del traje (8 h). */
  total: number
}

/** Lo que gasta la batería del traje ahora, contando luces y calefacción. */
export function cargaTraje(room: RoomState, j: Player): CargaTraje {
  const luces = (j.luces?.casco ? LUZ_CASCO : 0) + (j.luces?.mano ? LUZ_MANO : 0)
  let calor = 0
  if (enMarte(room)) {
    const conSol = solDeSala(room).elevacion > 0
    calor = Math.max(0, CALOR_DESDE_C - room.ambiente.tempExt) * CALOR_POR_GRADO * (conSol ? 1 / 3 : 1)
  }
  return { luces, calor, total: 1 + luces + calor }
}

// ---- Caminar a oscuras ----
/** Juego: probabilidad por hora de caerse caminando a oscuras sin ninguna luz. */
export const RIESGO_CAIDA_H = 0.25
/** Juego: distancia al hábitat que alumbran sus focos, m. */
export const RADIO_FOCOS_M = 22

export const focosEncendidos = (room: RoomState) => room.ajustes.focosBase !== false && oscuro(room)

/** Probabilidad por hora de caerse fuera ahora (0 de día o con los focos del casco). */
export function riesgoCaidaH(room: RoomState, j: Player): number {
  if (j.zona !== 'exterior' || !oscuro(room) || j.luces?.casco) return 0
  const base = j.luces?.mano ? RIESGO_CAIDA_H * 0.3 : RIESGO_CAIDA_H
  // Los focos de la base alumbran la zona de trabajo junto al hábitat.
  return focosEncendidos(room) ? base * 0.5 : base
}

/** Velocidad al caminar a oscuras: la mitad sin luz, algo menos solo con la linterna. */
export function factorPasoOscuro(room: RoomState, j: Player, cercaBase: boolean): number {
  if (j.zona !== 'exterior' || !oscuro(room) || j.luces?.casco) return 1
  if (cercaBase && focosEncendidos(room)) return 1
  return j.luces?.mano ? 0.85 : 0.5
}

// ---- Luces de la base (energía) ----
/** Juego: luces del hábitat con alguien despierto dentro, y de guardia mientras todos duermen. */
export const LUZ_HABITAT_KW = 0.15
export const LUZ_GUARDIA_KW = 0.03
/** Juego: focos exteriores del hábitat. */
export const FOCOS_KW = 0.4

/** kW que gastan ahora las luces de la base. */
export function cargaLucesKw(room: RoomState): { habitat: number; focos: number } {
  const despiertos = room.jugadores.some((j) => j.rol && j.zona === 'nave' && j.actividad !== 'sueno')
  return { habitat: despiertos ? LUZ_HABITAT_KW : LUZ_GUARDIA_KW, focos: focosEncendidos(room) ? FOCOS_KW : 0 }
}
