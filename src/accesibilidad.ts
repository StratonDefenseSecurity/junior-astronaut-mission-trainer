// Ajustes de accesibilidad: texto más grande, alto contraste apto para daltónicos, movimiento
// reducido y subtítulos de los sonidos. Se guardan en localStorage y se aplican como clases en
// <html> (los estilos están al final de src/styles.css).
import { create } from 'zustand'

export interface AjustesAccesibilidad {
  textoGrande: boolean
  contraste: boolean
  movimientoReducido: boolean
  subtitulos: boolean
}

const CLAVE = 'mt_accesibilidad'
const CLASES: Record<keyof AjustesAccesibilidad, string> = {
  textoGrande: 'a11y-texto',
  contraste: 'a11y-contraste',
  movimientoReducido: 'a11y-calma',
  subtitulos: 'a11y-subtitulos',
}

function inicial(): AjustesAccesibilidad {
  let prefiereCalma = false
  try {
    prefiereCalma = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    // sin matchMedia
  }
  const base: AjustesAccesibilidad = { textoGrande: false, contraste: false, movimientoReducido: prefiereCalma, subtitulos: false }
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<AjustesAccesibilidad> | null
    if (guardado && typeof guardado === 'object') {
      for (const k of Object.keys(base) as (keyof AjustesAccesibilidad)[]) if (typeof guardado[k] === 'boolean') base[k] = guardado[k]
    }
  } catch {
    // sin almacenamiento o dato inválido
  }
  return base
}

function aplicar(a: AjustesAccesibilidad) {
  const html = document.documentElement
  for (const k of Object.keys(CLASES) as (keyof AjustesAccesibilidad)[]) html.classList.toggle(CLASES[k], a[k])
}

interface Estado extends AjustesAccesibilidad {
  abierto: boolean
  abrir: (b: boolean) => void
  cambiar: (k: keyof AjustesAccesibilidad, v: boolean) => void
}

export const useAccesibilidad = create<Estado>((set, get) => ({
  ...inicial(),
  abierto: false,
  abrir: (abierto) => set({ abierto }),
  cambiar: (k, v) => {
    set({ [k]: v } as Partial<Estado>)
    const { textoGrande, contraste, movimientoReducido, subtitulos } = get()
    const ajustes = { textoGrande, contraste, movimientoReducido, subtitulos }
    aplicar(ajustes)
    try {
      localStorage.setItem(CLAVE, JSON.stringify(ajustes))
    } catch {
      // sin almacenamiento: dura hasta recargar
    }
  },
}))
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
