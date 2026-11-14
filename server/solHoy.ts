// "El Sol ahora": los últimos 30 días de clima espacial, descargados de DONKI (NASA) sin clave.
// Lo usan la operación `solHoy` (tarjeta del lobby y de la contextualización) y la elección
// "en vivo" de una sala, que guarda el resumen en la sala para que la simulación sea determinista.
// Se guarda en memoria una hora. Si ningún servicio responde, devuelve el registro archivado de
// 2024 marcado como archivo: nunca se presenta como dato en vivo.
import type { RoomState } from '../shared/types.js'
import { VENTANA_SOL_DIAS, type FulguracionSol, type ParticulasSol, type ResumenSol } from '../shared/solHoy.js'
import { CLIMA_ESPACIAL } from './datos/climaEspacial.js'

/** Servicios en orden de preferencia. Los dos primeros son el servicio web del CCMC (sin clave). */
const SERVICIOS = [
  { nombre: 'NASA CCMC DONKI web service', base: 'https://ccmc.gsfc.nasa.gov/DONKI/WS/get/', clave: '' },
  { nombre: 'NASA CCMC DONKI web service', base: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/', clave: '' },
  { nombre: 'NASA API (api.nasa.gov) DONKI', base: 'https://api.nasa.gov/DONKI/', clave: '&api_key=DEMO_KEY' },
]
const UNA_HORA_MS = 3_600_000
const ESPERA_MS = 8_000
const DIA_MS = 86_400_000

const dia = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const r3 = (v: number) => Math.round(v * 1000) / 1000

async function bajar(url: string): Promise<string> {
  const r = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS), headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

function lista(texto: string): Record<string, unknown>[] {
  const v: unknown = texto.trim() ? JSON.parse(texto) : []
  if (!Array.isArray(v)) throw new Error('unexpected answer')
  return v as Record<string, unknown>[]
}

/** Valor de una clase para compararlas: X2.5 > X1 > M9.9 > C1. */
const fuerza = (clase: string) => 'ABCMX'.indexOf(clase[0]) * 1000 + (parseFloat(clase.slice(1)) || 0)

/** Agrupa los registros de un mismo evento de partículas (empiezan a menos de 18 h). */
function agrupar(registros: { d: number; alta: boolean; id: string; fecha: string }[]): ParticulasSol[] {
  const grupos: ParticulasSol[] = []
  for (const p of registros.sort((a, b) => a.d - b.d)) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && p.d - ultimo[0] < 0.75) {
      ultimo[1] += 1
      ultimo[2] = ultimo[2] || p.alta
    } else grupos.push([r3(p.d), 1, p.alta, p.id, p.fecha])
  }
  return grupos
}

async function deServicio(s: (typeof SERVICIOS)[number], ahora: number): Promise<ResumenSol> {
  const inicio = Date.parse(`${dia(ahora - VENTANA_SOL_DIAS * DIA_MS)}T00:00:00Z`)
  const desde = dia(inicio)
  const hasta = dia(ahora)
  const url = (tipo: string) => `${s.base}${tipo}?startDate=${desde}&endDate=${hasta}${s.clave}`
  const [flr, sep, gst] = (await Promise.all(['FLR', 'SEP', 'GST'].map((t) => bajar(url(t))))).map(lista)
  // Las eyecciones solo se cuentan. La respuesta pesa 100 a 200 KB, pero esto corre en su propio
  // Durable Object (en Cloudflare) y se guarda una hora.
  let eyecciones: number | null = null
  try {
    eyecciones = lista(await bajar(url('CME'))).length
  } catch {
    // sin el conteo de eyecciones el resumen sigue valiendo
  }

  const clases = { X: 0, M: 0, C: 0 }
  const fulguraciones: FulguracionSol[] = []
  let mayor: ResumenSol['mayor'] = null
  for (const f of flr) {
    const clase = String(f.classType ?? '')
    const t = String(f.peakTime ?? f.beginTime ?? '')
    const ms = Date.parse(t)
    if (!clase || !Number.isFinite(ms)) continue
    const letra = clase[0] as 'X' | 'M' | 'C'
    if (letra in clases) clases[letra] += 1
    if (!mayor || fuerza(clase) > fuerza(mayor.clase)) mayor = { clase, fecha: t.slice(0, 10) }
    if (letra === 'X' || letra === 'M') fulguraciones.push([r3((ms - inicio) / DIA_MS), clase, Number(f.activeRegionNum) || 0, String(f.flrID ?? ''), t.slice(0, 10)])
  }
  fulguraciones.sort((a, b) => a[0] - b[0])

  const registros = []
  for (const p of sep) {
    const t = String(p.eventTime ?? '')
    const ms = Date.parse(t)
    if (!Number.isFinite(ms)) continue
    const instrumentos = Array.isArray(p.instruments) ? (p.instruments as { displayName?: string }[]).map((i) => String(i?.displayName ?? '')) : []
    registros.push({ d: (ms - inicio) / DIA_MS, alta: instrumentos.some((i) => i.includes('GOES') || i.includes('100')), id: String(p.sepID ?? ''), fecha: t.slice(0, 10) })
  }

  let kpMax: number | null = null
  let kpFecha: string | null = null
  for (const g of gst) {
    for (const k of Array.isArray(g.allKpIndex) ? (g.allKpIndex as { kpIndex?: number; observedTime?: string }[]) : []) {
      const kp = Number(k?.kpIndex)
      if (Number.isFinite(kp) && (kpMax === null || kp > kpMax)) {
        kpMax = kp
        kpFecha = String(k.observedTime ?? g.startTime ?? '').slice(0, 10) || null
      }
    }
  }

  return {
    modo: 'vivo',
    desde,
    hasta,
    dias: Math.round(((ahora - inicio) / DIA_MS) * 100) / 100,
    obtenido: new Date(ahora).toISOString().slice(0, 19) + 'Z',
    servicio: s.nombre,
    urls: ['FLR', 'SEP', 'GST', 'CME'].map((t) => url(t).replace(s.clave, '')),
    clases,
    mayor,
    fulguraciones,
    particulas: agrupar(registros),
    kpMax,
    kpFecha,
    eyecciones,
  }
}

const FULG_2024 = CLIMA_ESPACIAL.fulguraciones as [number, string, number, string][]
const PART_2024 = CLIMA_ESPACIAL.particulas as [number, number, boolean, string, string][]

/**
 * Los mismos 30 días del calendario, pero de 2024 (máximo solar), con el registro que trae el
 * juego. Ese registro solo guarda las fulguraciones de clase X y no tiene Kp ni eyecciones.
 */
export function resumenArchivado(ahora: number, aviso?: string): ResumenSol {
  const anio = CLIMA_ESPACIAL.anio
  const hoy = new Date(ahora)
  let fin = Date.UTC(anio, hoy.getUTCMonth(), hoy.getUTCDate())
  if (fin - VENTANA_SOL_DIAS * DIA_MS < Date.UTC(anio, 0, 1)) fin = Date.UTC(anio, 0, 1 + VENTANA_SOL_DIAS)
  const inicio = fin - VENTANA_SOL_DIAS * DIA_MS
  // Día del año contado desde 1 (el 1 de enero a las 0 h es 1.0), como en el registro.
  const diaAnio = (ms: number) => (ms - Date.UTC(anio, 0, 1)) / DIA_MS + 1
  const d0 = diaAnio(inicio)
  const d1 = diaAnio(fin) + 1
  const fecha = (d: number) => dia(Date.UTC(anio, 0, 1) + (d - 1) * DIA_MS)
  const fulguraciones: FulguracionSol[] = FULG_2024.filter((f) => f[0] >= d0 && f[0] < d1).map((f) => [r3(f[0] - d0), f[1], f[2], f[3], fecha(f[0])])
  const particulas: ParticulasSol[] = PART_2024.filter((p) => p[0] >= d0 && p[0] < d1).map((p) => [r3(p[0] - d0), p[1], p[2], p[3], p[4]])
  let mayor: ResumenSol['mayor'] = null
  for (const f of fulguraciones) if (!mayor || fuerza(f[1]) > fuerza(mayor.clase)) mayor = { clase: f[1], fecha: f[4] }
  return {
    modo: 'archivo',
    desde: dia(inicio),
    hasta: dia(fin),
    dias: VENTANA_SOL_DIAS + 1,
    obtenido: CLIMA_ESPACIAL.descargado,
    servicio: 'Archived NASA DONKI record (2024) included in the game',
    urls: [CLIMA_ESPACIAL.url],
    aviso,
    clases: { X: fulguraciones.length, M: null, C: null },
    mayor,
    fulguraciones,
    particulas,
    kpMax: null,
    kpFecha: null,
    eyecciones: null,
  }
}

let cache: { vence: number; r: ResumenSol } | null = null
let pendiente: Promise<ResumenSol> | null = null

async function descargar(ahora: number): Promise<ResumenSol> {
  const errores: string[] = []
  for (const s of SERVICIOS) {
    try {
      const r = await deServicio(s, ahora)
      cache = { vence: ahora + UNA_HORA_MS, r }
      return r
    } catch (e) {
      errores.push(`${new URL(s.base).host}: ${e instanceof Error ? e.message : 'error'}`)
    }
  }
  const r = resumenArchivado(ahora, `no answer from ${errores.join('; ')}`)
  // Sin servicio se vuelve a intentar en 10 minutos.
  cache = { vence: ahora + UNA_HORA_MS / 6, r }
  return r
}

/** Resumen de los últimos 30 días, con una hora de caché. */
export function resumenSolHoy(ahora = Date.now()): Promise<ResumenSol> {
  if (cache && ahora < cache.vence) return Promise.resolve(cache.r)
  pendiente ??= descargar(ahora).finally(() => {
    pendiente = null
  })
  return pendiente
}

/** El anfitrión elige en la sala de espera el clima espacial de la misión: en vivo o archivado. */
export function fijarClimaSolar(room: RoomState, id: string, vivo: boolean, r: ResumenSol | null): string | null {
  if (room.fase !== 'lobby') return 'Space weather is chosen before the mission starts.'
  if (id !== room.hostId) return 'Only the host chooses the space weather.'
  if (!vivo) {
    room.solVivo = null
    return null
  }
  if (!r || r.modo !== 'vivo') return `Live NASA DONKI data is not available right now${r?.aviso ? ` (${r.aviso})` : ''}. The mission keeps the archived 2024 record.`
  room.solVivo = r
  return null
}
