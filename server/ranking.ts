// Clasificación global: un resumen de cada misión terminada, en un único documento.
//
// En local (y en Vercel) se guarda en el mismo almacén que las salas. En Cloudflare vive en su
// propio Durable Object ("ranking"): la sala no escribe aquí directamente, sino que llama a
// `fijarDestinoRanking` con una función que lo envía por RPC (ver server/cloudflare.ts).
import { C } from '../shared/ciencia.js'
import { escenarioDe } from '../shared/escenarios.js'
import type { RoomState } from '../shared/types.js'
import { almacen } from './almacen.js'

export interface EntradaRanking {
  codigo: string
  mision: string
  situacion: string
  victoria: boolean
  resultado: string
  dias: number
  soles: number
  muestras: number
  muestrasObjetivo: number
  /** Salud media de la tripulación al terminar, 0 a 100. */
  salud: number
  /** Puntaje del informe final, si la sala lo tiene. */
  puntaje: number | null
  tripulantes: number
  modo: 'solo' | 'multi'
  t: number
}

const RUTA = 'ranking/global.json'
const GUARDADAS = 100
export const MOSTRADAS = 20

/** Resumen de una sala terminada. */
export function resumenRanking(room: RoomState): EntradaRanking {
  const debrief = (room as { debrief?: { puntaje?: unknown } }).debrief
  const puntaje = typeof debrief?.puntaje === 'number' && Number.isFinite(debrief.puntaje) ? Math.round(debrief.puntaje) : null
  const crew = room.jugadores.filter((j) => j.rol)
  const salud = crew.length ? crew.reduce((s, j) => s + Math.max(0, j.vit.salud), 0) / crew.length : 0
  const enSuperficie = room.tAterrizaje > 0 && room.t >= room.tAterrizaje
  return {
    codigo: room.codigo,
    mision: (room.nombreMision || 'Unnamed mission').slice(0, 60),
    situacion: escenarioDe(room.escenario).nombre,
    victoria: Boolean(room.resultado?.victoria),
    resultado: (room.resultado?.titulo ?? '').slice(0, 80),
    dias: Math.floor(Math.max(0, room.t) / 86400),
    soles: enSuperficie ? Math.floor((room.t - room.tAterrizaje) / C.SOL_S) : 0,
    muestras: room.mision.muestrasAnalizadas,
    muestrasObjetivo: room.mision.muestrasObjetivo,
    salud: Math.round(salud),
    puntaje,
    tripulantes: crew.length,
    modo: room.modoJuego === 'solo' ? 'solo' : 'multi',
    t: Date.now(),
  }
}

/** Orden: primero las victorias, luego el puntaje (si lo hay), las muestras y la salud. */
function comparar(a: EntradaRanking, b: EntradaRanking): number {
  return (
    Number(b.victoria) - Number(a.victoria) ||
    (b.puntaje ?? -1) - (a.puntaje ?? -1) ||
    b.muestras - a.muestras ||
    b.salud - a.salud ||
    a.t - b.t
  )
}

export async function leerRanking(): Promise<EntradaRanking[]> {
  const doc = await almacen().leer(RUTA)
  if (!doc || doc === 'igual') return []
  try {
    const lista = JSON.parse(doc.texto) as EntradaRanking[]
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

/** Agrega (o reemplaza, si la sala ya estaba) una misión terminada. */
export async function agregarRanking(e: EntradaRanking): Promise<void> {
  for (let intento = 0; intento < 5; intento++) {
    const doc = await almacen().leer(RUTA)
    let lista: EntradaRanking[] = []
    if (doc && doc !== 'igual') {
      try {
        lista = JSON.parse(doc.texto) as EntradaRanking[]
      } catch {
        lista = []
      }
    }
    lista = lista.filter((x) => x.codigo !== e.codigo)
    lista.push(e)
    lista.sort(comparar)
    lista.length = Math.min(lista.length, GUARDADAS)
    const r = await almacen().escribir(RUTA, JSON.stringify(lista), doc && doc !== 'igual' ? doc.etiqueta : null)
    if (r !== 'conflicto') return
  }
}

type Destino = (e: EntradaRanking) => Promise<void>
let destino: Destino = agregarRanking
/** Dónde se envían las misiones terminadas. Por defecto, al almacén de la petición. */
export function fijarDestinoRanking(fn: Destino) {
  destino = fn
}

const enviadas = new Set<string>()
/** Si la misión acaba de terminar, la envía a la clasificación (una vez por sala en esta instancia). */
export async function anotarSiTermino(room: RoomState): Promise<void> {
  if (room.fase !== 'fin' || !room.resultado || enviadas.has(room.codigo)) return
  enviadas.add(room.codigo)
  try {
    await destino(resumenRanking(room))
  } catch (err) {
    enviadas.delete(room.codigo)
    console.error('[ranking]', err)
  }
}
