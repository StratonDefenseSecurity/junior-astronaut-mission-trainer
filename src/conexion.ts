// Calidad de la conexión con el servidor. red.ts anota cuánto tarda cada consulta (ida y
// vuelta, por HTTP o por WebSocket) y cuáles fallan; aquí se resume en buena, lenta o mala
// con las últimas muestras. Una consulta que lleva mucho sin respuesta también cuenta.
import { create } from 'zustand'

export type Calidad = 'midiendo' | 'buena' | 'lenta' | 'mala'

interface Muestra {
  t: number
  /** Ida y vuelta en ms, o null si falló. */
  ms: number | null
}

export interface EstadoConexion {
  calidad: Calidad
  /** Mediana de la ida y vuelta, en ms. */
  ms: number | null
  /** Fracción de consultas fallidas entre las últimas. */
  fallos: number
}

const MUESTRAS = 12
const VIGENCIA_MS = 30_000
let muestras: Muestra[] = []
const pendientes = new Set<number>()

export const useConexion = create<EstadoConexion>(() => ({ calidad: 'midiendo', ms: null, fallos: 0 }))

function evaluar() {
  const ahora = performance.now()
  muestras = muestras.filter((m) => ahora - m.t < VIGENCIA_MS).slice(-MUESTRAS)
  const ok = muestras.filter((m) => m.ms !== null).map((m) => m.ms as number).sort((a, b) => a - b)
  const fallos = muestras.length ? (muestras.length - ok.length) / muestras.length : 0
  const ms = ok.length ? ok[Math.floor(ok.length / 2)] : null
  let espera = 0
  for (const t of pendientes) espera = Math.max(espera, ahora - t)
  let calidad: Calidad
  // Los umbrales son holgados: el tiempo medido incluye lo que tarda la página en atender la
  // respuesta, que en ordenadores sencillos con la escena 3D puede ser bastante.
  if (muestras.length < 3 && espera < 2000) calidad = 'midiendo'
  else if (fallos >= 0.3 || espera > 6000 || (ms ?? 9999) > 2000) calidad = 'mala'
  else if (fallos > 0.1 || espera > 2500 || (ms ?? 0) > 700) calidad = 'lenta'
  else calidad = 'buena'
  const previo = useConexion.getState()
  if (previo.calidad !== calidad || previo.ms !== ms || previo.fallos !== fallos) useConexion.setState({ calidad, ms, fallos })
}

/**
 * Tiempo de red de la petición empezada en t0, según el navegador (Resource Timing). No cuenta
 * lo que la página tarda en atender la respuesta, que con la escena 3D puede ser mucho.
 */
function tiempoDeRed(t0: number): number | null {
  if (typeof performance.getEntriesByType !== 'function') return null
  const lista = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  const e = lista.find((x) => x.name.endsWith('/api/juego') && x.startTime >= t0 - 2 && x.responseEnd > 0)
  if (lista.length > 120) performance.clearResourceTimings()
  return e ? e.responseEnd - e.startTime : null
}

export const conexion = {
  /** Empieza una consulta; devuelve la marca para cerrarla. */
  empezar(): number {
    const t = performance.now()
    pendientes.add(t)
    return t
  },
  /** Termina una consulta empezada con `empezar`. */
  terminar(t0: number, ok: boolean) {
    pendientes.delete(t0)
    muestras.push({ t: performance.now(), ms: ok ? (tiempoDeRed(t0) ?? performance.now() - t0) : null })
    evaluar()
  },
  /** Ida y vuelta medida por otro medio (el WebSocket). */
  anotar(ms: number | null) {
    muestras.push({ t: performance.now(), ms })
    evaluar()
  },
}

if (typeof window !== 'undefined') window.setInterval(evaluar, 1000)

export const TEXTO_CALIDAD: Record<Calidad, string> = { midiendo: 'checking', buena: 'good', lenta: 'slow', mala: 'poor' }
