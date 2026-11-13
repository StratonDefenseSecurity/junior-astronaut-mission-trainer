// El día del lanzamiento: la ventana diaria, el tiempo en la plataforma, las fallas técnicas y los
// scrubs (suspensiones). La geometría de la ventana está en shared/ventana.ts.
//
// Cada intento tiene su día. Al preparar la ventana se decide, con un azar propio (sale del código
// de la sala, el número de intento y el día, y no gasta el azar de la sala), qué tiempo hará en
// la plataforma a la hora de apertura y si algo fallará en el cohete. En el sondeo final, a
// T−10 s, se comparan esas condiciones con los criterios reales de lanzamiento de Artemis I. Si
// alguno no se cumple, la cuenta se detiene y el comandante decide cuándo volver a intentarlo.
import { escenarioDe, fechaDeMision } from '../shared/escenarios.js'
import { lsMarte } from '../shared/astronomia.js'
import { CUENTA_REGRESIVA_S, TRANSITO_INICIO_S, type RoomState, type VentanaSala } from '../shared/types.js'
import { desfaseFlorida, horaFlorida, sumarDias, textoVentana, ventanaDelDia } from '../shared/ventana.js'
import { log } from './base.js'
import { iniciarClimaEspacial, indiceClimaParaLs } from './sim/ambiente.js'

/** Como mucho dos scrubs: el tercer intento siempre despega, para no detener la misión. SUPUESTO. */
export const MAX_SCRUBS = 2
/** Segundo de la cuenta en que se hace el sondeo final (justo antes de "go for core stage engine start"). */
export const T_SONDEO = -10.5

/** Criterios reales de Artemis I (NASA, Artemis I Weather Criteria). Ver FUENTES. */
const VIENTO_MAX_KT = 29
const RAYO_NM = 10
const YUNQUE_NM = 10
const CAPA_MAX_FT = 4500

/**
 * Fallas técnicas: las dos que suspendieron Artemis I (blog de la NASA, 29 de agosto y 3 de
 * septiembre de 2022). Ver FUENTES.
 */
const FALLAS = [
  'The engine bleed test fails: one core stage engine does not chill down to its start temperature. This scrubbed Artemis I on August 29, 2022.',
  'Liquid hydrogen leaks at the quick disconnect that fills the core stage. This scrubbed Artemis I on September 3, 2022.',
]
/** Probabilidad de una falla técnica por intento, y tras reciclar deprisa después de una. SUPUESTO. */
const P_FALLA = 0.1
const P_FALLA_APURADO = 0.3

/** Azar determinista a partir de un texto (FNV-1a + mulberry32). No toca el azar de la sala. */
function azarDe(texto: string): () => number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619)
  let s = h | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const una = (x: number) => Math.round(x * 10) / 10

/**
 * Tiempo en la plataforma a la hora de apertura, con un modelo del juego (SUPUESTO): más viento
 * con los frentes de invierno (noviembre a marzo), tormentas eléctricas las tardes de verano
 * (junio a septiembre) y capas de nubes gruesas algo más frecuentes en invierno.
 */
function condiciones(semilla: string, abre: number) {
  const r = azarDe(semilla)
  const local = new Date(abre + desfaseFlorida(abre) * 3_600_000)
  const mes = local.getUTCMonth()
  const hora = local.getUTCHours()
  const invierno = mes >= 10 || mes <= 2
  const verano = mes >= 5 && mes <= 8
  const tarde = hora >= 12 && hora < 20
  // Racha máxima a 132.5 ft: la media del mes más una cola de rachas fuertes (20·u³).
  const media = invierno ? 16 : 12
  const vientoKt = Math.round(media - 4 + 20 * r() ** 3)
  const pViento = Math.max(0, 1 - Math.cbrt(Math.min(1, (VIENTO_MAX_KT + 4 - media) / 20)))
  const pRayo = verano ? (tarde ? 0.3 : 0.08) : mes === 4 || mes === 9 ? (tarde ? 0.12 : 0.04) : 0.03
  const rayoNm = r() < pRayo ? una(1 + 8.5 * r()) : null
  const pYunque = pRayo * 0.6 + 0.02
  const yunqueNm = r() < pYunque ? una(2 + 7.5 * r()) : null
  const pCapa = invierno ? 0.1 : 0.06
  const capaFt = r() < pCapa ? Math.round((4600 + 4000 * r()) / 100) * 100 : null
  const pFalla = r()
  const cualFalla = r()
  // Pronóstico como el del escuadrón meteorológico: % de que el tiempo permita lanzar, de 5 en 5.
  const pronostico = Math.round(((1 - pViento) * (1 - pRayo) * (1 - pYunque) * (1 - pCapa) * 100) / 5) * 5
  return { clima: { vientoKt, rayoNm, yunqueNm, capaFt }, pronostico, pFalla, cualFalla }
}

/** Reglas del tiempo que se incumplen, en frases cortas para la pantalla. */
function reglasIncumplidas(c: VentanaSala['clima']): string[] {
  const no: string[] = []
  if (c.vientoKt > VIENTO_MAX_KT) no.push(`Peak winds of ${c.vientoKt} knots at 132.5 ft. The limit there is ${VIENTO_MAX_KT} knots.`)
  if (c.rayoNm !== null && c.rayoNm < RAYO_NM) no.push(`Lightning ${c.rayoNm} nautical miles from the flight path in the last 30 minutes. The rule asks for at least ${RAYO_NM}.`)
  if (c.yunqueNm !== null && c.yunqueNm < YUNQUE_NM) no.push(`A thunderstorm anvil cloud ${c.yunqueNm} nautical miles from the flight path. The rule asks for at least ${YUNQUE_NM}.`)
  if (c.capaFt !== null && c.capaFt > CAPA_MAX_FT) no.push(`A cloud layer ${c.capaFt.toLocaleString('en-US')} ft thick reaches freezing temperatures within 5 nautical miles. The limit is ${CAPA_MAX_FT.toLocaleString('en-US')} ft.`)
  return no
}

/**
 * Calcula la ventana del día del intento con la trayectoria elegida y lo que pasará en ella.
 * Conserva el día, el número de intento y los scrubs anteriores.
 */
export function calcularVentana(room: RoomState) {
  const previa = room.ventana
  const dia = previa?.dia ?? escenarioDe(room.escenario).lanzamiento
  const intento = previa?.intento ?? 1
  const v = ventanaDelDia(dia, room.mision.diasTransito)
  const c = condiciones(`${room.codigo}:${intento}:${dia}`, v.abre)
  const ultimo = intento > MAX_SCRUBS
  room.ventana = {
    ...v,
    dia,
    intento,
    pronostico: c.pronostico,
    clima: c.clima,
    // El último intento posible siempre despega: el juego no deja la misión en tierra.
    noGo: ultimo ? [] : reglasIncumplidas(c.clima),
    falla: !ultimo && c.pFalla < (previa?.apurado ? P_FALLA_APURADO : P_FALLA) ? FALLAS[Math.floor(c.cualFalla * FALLAS.length)] : null,
    sondeo: null,
    scrubs: previa?.scrubs ?? [],
    apurado: previa?.apurado ?? false,
  }
}

export interface Scrub {
  motivo: string
  causa: 'clima' | 'tecnica'
  [k: string]: unknown
}

/**
 * Sondeo final a T−10 s: tiempo y vehículo. Devuelve el scrub si algo no cumple; la cuenta queda
 * detenida (subfase 'espera') hasta que el comandante decida.
 */
export function sondeoFinal(room: RoomState): Scrub | null {
  const v = room.ventana
  if (!v || v.sondeo) return null
  if (!v.noGo.length && !v.falla) {
    v.sondeo = 'go'
    const intento = v.intento > 1 ? ` Attempt ${v.intento}.` : ''
    log(room, `Final poll: weather is GO and the vehicle is GO.${intento} Liftoff at ${horaFlorida(v.abre)} local, when the window opens.`, 'ok')
    return null
  }
  v.sondeo = 'scrub'
  room.subfase = 'espera'
  const causa = v.falla ? 'tecnica' : 'clima'
  const motivo = v.falla ?? v.noGo[0]
  log(room, `HOLD. ${causa === 'clima' ? 'Weather is NO GO' : 'The vehicle is NO GO'}: ${motivo} The Launch Director scrubs today's attempt.`, 'alerta')
  return { motivo, causa }
}

/** Ventanas de los dos días siguientes, para decidir. */
export function proximasVentanas(room: RoomState) {
  const v = room.ventana!
  return [1, 2].map((n) => ventanaDelDia(sumarDias(v.dia, n), room.mision.diasTransito))
}

/**
 * Pasa al intento de dentro de `dias` días y reinicia la cuenta. Todo lo que depende de la fecha
 * (clima espacial real, estación de Marte al llegar) se recalcula con el nuevo despegue.
 */
export function reprogramar(room: RoomState, dias: number, causa: string): string {
  const v = room.ventana!
  const antes = v.abre
  room.ventana = { ...v, dia: sumarDias(v.dia, dias), intento: v.intento + 1, scrubs: [...v.scrubs, { dia: v.dia, motivo: causa }], apurado: causa === 'tecnica' && dias === 1 }
  calcularVentana(room)
  const nueva = room.ventana!
  room.subfase = ''
  room.t = -CUENTA_REGRESIVA_S
  room.tFase = room.t
  // Las tormentas solares reales y el clima de Marte siguen a la nueva fecha.
  room.diaLanzamiento += dias
  iniciarClimaEspacial(room)
  room.indiceClima = indiceClimaParaLs(lsMarte(fechaDeMision(room, TRANSITO_INICIO_S + room.mision.diasTransito * 86400)))
  const minutos = Math.round((nueva.abre - antes - dias * 86_400_000) / 60_000)
  const cambio = minutos === 0 ? 'at the same time' : `${Math.abs(minutos)} min ${minutos < 0 ? 'earlier' : 'later'} than today`
  return `New attempt in ${dias === 1 ? '1 day' : `${dias} days`}. ${textoVentana(nueva)}, ${cambio}.`
}

