// Ajustes de accesibilidad: texto más grande, movimiento reducido, subtítulos de los sonidos y el
// tema de color (src/temas.ts; el alto contraste apto para daltónicos es uno de los temas). Se guardan en localStorage y se aplican como clases en
// <html> (los estilos están al final de src/styles.css).
import { create } from 'zustand'
import { aplicarTema, esHex, esTema, type TemaId } from './temas'

export interface AjustesAccesibilidad {
  textoGrande: boolean
  movimientoReducido: boolean
  subtitulos: boolean
}

const CLAVE = 'mt_accesibilidad'
const CLASES: Record<keyof AjustesAccesibilidad, string> = {
  textoGrande: 'a11y-texto',
  movimientoReducido: 'a11y-calma',
  subtitulos: 'a11y-subtitulos',
}

interface Guardado extends AjustesAccesibilidad {
  tema: TemaId
  acento: string | null
}

function inicial(): Guardado {
  let prefiereCalma = false
  try {
    prefiereCalma = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    // sin matchMedia
  }
  const base: Guardado = { textoGrande: false, movimientoReducido: prefiereCalma, subtitulos: false, tema: 'mision', acento: null }
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as (Partial<Guardado> & { contraste?: boolean }) | null
    if (guardado && typeof guardado === 'object') {
      for (const k of Object.keys(CLASES) as (keyof AjustesAccesibilidad)[]) if (typeof guardado[k] === 'boolean') base[k] = guardado[k]
      if (esTema(guardado.tema)) base.tema = guardado.tema
      else if (guardado.contraste === true) base.tema = 'contraste' // ajuste antiguo
      if (esHex(guardado.acento)) base.acento = guardado.acento
    }
  } catch {
    // sin almacenamiento o dato inválido
  }
  return base
}

function aplicar(a: Guardado) {
  const html = document.documentElement
  aplicarTema(a.tema, a.acento)
  for (const k of Object.keys(CLASES) as (keyof AjustesAccesibilidad)[]) html.classList.toggle(CLASES[k], a[k])
}

interface Estado extends Guardado {
  abierto: boolean
  /** Sección a la que se desplaza el panel al abrirse. */
  seccion: 'colores' | 'ajustes'
  abrir: (b: boolean, seccion?: Estado['seccion']) => void
  cambiar: (k: keyof AjustesAccesibilidad, v: boolean) => void
  elegirTema: (t: TemaId) => void
  /** Acento propio (hex) o null para el del tema. */
  elegirAcento: (hex: string | null) => void
}

export const useAccesibilidad = create<Estado>((set, get) => ({
  ...inicial(),
  abierto: false,
  seccion: 'ajustes',
  abrir: (abierto, seccion = 'ajustes') => set({ abierto, seccion }),
  cambiar: (k, v) => guardar(set, get, { [k]: v }),
  elegirTema: (tema) => guardar(set, get, { tema }),
  elegirAcento: (acento) => guardar(set, get, { acento }),
}))

function guardar(set: (p: Partial<Estado>) => void, get: () => Estado, cambio: Partial<Guardado>) {
  set(cambio)
  const { textoGrande, movimientoReducido, subtitulos, tema, acento } = get()
  const ajustes: Guardado = { textoGrande, movimientoReducido, subtitulos, tema, acento }
  aplicar(ajustes)
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ajustes))
  } catch {
    // sin almacenamiento: dura hasta recargar
  }
}
aplicar(useAccesibilidad.getState())

/** Para bucles de animación (useFrame): 0 con movimiento reducido, 1 si no. */
export const factorMovimiento = (): number => (useAccesibilidad.getState().movimientoReducido ? 0 : 1)

// ---------- Subtítulos de sonidos ----------

/** Texto de cada efecto de sonido. Los que no están aquí (clics, pasos, teclado) no se subtitulan. */
const TEXTO_SONIDO: Record<string, string> = {
  alarma: 'Alarm sounding',
  aviso: 'Alert tone',
  quindarInicio: 'Radio beep. Mission Control is talking',
  quindarFin: 'Radio beep. Transmission ends',
  radio: 'Radio static',
  esclusa: 'Airlock hissing',
  separacion: 'Loud bang. Stage separation',
  exito: 'Success tone',
  latido: 'Heartbeat',
  ejercicio: 'Exercise machine running',
}

export interface Subtitulo {
  id: number
  texto: string
}

let siguiente = 0
const ultimaVez = new Map<string, number>()

export const useSubtitulos = create<{ lista: Subtitulo[] }>(() => ({ lista: [] }))

/** Muestra el subtítulo de un efecto de sonido (si están activados) durante unos segundos. */
export function subtitular(nombre: string) {
  const texto = TEXTO_SONIDO[nombre]
  if (!texto || !useAccesibilidad.getState().subtitulos) return
  const t = Date.now()
  if (t - (ultimaVez.get(nombre) ?? 0) < 2500) return // los bucles no repiten el mismo texto
  ultimaVez.set(nombre, t)
  const id = ++siguiente
  useSubtitulos.setState((s) => ({ lista: [...s.lista.slice(-2), { id, texto }] }))
  window.setTimeout(() => useSubtitulos.setState((s) => ({ lista: s.lista.filter((x) => x.id !== id) })), 4000)
}
