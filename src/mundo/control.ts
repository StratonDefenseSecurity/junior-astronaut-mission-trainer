// Estado del personaje propio y de la cámara, y lectura del teclado, ratón y pantalla táctil.
// Vive fuera de React porque cambia en cada fotograma.
import { useEffect } from 'react'
import type { Zona } from '@shared/types'
import { useStore } from '../store'
import { ENTRADA } from './mapa'

export const local = {
  x: ENTRADA.nave.x,
  z: ENTRADA.nave.z,
  giro: ENTRADA.nave.giro,
  /** Velocidad actual, m/s. */
  vel: 0,
  zona: 'nave' as Zona,
  /** Fase del ciclo de pasos, para animar. */
  paso: 0,
  camGiro: -Math.PI / 2,
  camAltura: 0.32,
  camDistancia: 4.4,
}

/** Palanca virtual para pantallas táctiles: x derecha, y adelante, de -1 a 1. */
export const palanca = { x: 0, y: 0 }
const teclas = new Set<string>()
export const tecla = (codigo: string) => teclas.has(codigo)

/** Coloca al personaje en la entrada de una zona (al cruzar la esclusa). */
export function entrarEnZona(zona: Zona) {
  const e = ENTRADA[zona]
  local.zona = zona
  local.x = e.x
  local.z = e.z
  local.giro = e.giro
  local.vel = 0
  local.camGiro = e.giro + Math.PI
  local.camDistancia = zona === 'nave' ? 4.4 : 7
}

const escribiendo = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  return Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))
}

/** Instala los controles de teclado mientras el mundo está en pantalla. */
export function useTeclado() {
  useEffect(() => {
    const abajo = (e: KeyboardEvent) => {
      if (escribiendo(e)) return
      teclas.add(e.code)
      const s = useStore.getState()
      if (e.code === 'KeyE' && !e.repeat) {
        if (s.estacion) s.abrirEstacion(null)
        else if (s.cerca) s.abrirEstacion(s.cerca)
      } else if (e.code === 'Escape') s.abrirEstacion(null)
      else if (e.code === 'KeyH' && !e.repeat) s.alternarPaneles()
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
    }
    const arriba = (e: KeyboardEvent) => teclas.delete(e.code)
    const soltar = () => teclas.clear()
    window.addEventListener('keydown', abajo)
    window.addEventListener('keyup', arriba)
    window.addEventListener('blur', soltar)
    return () => {
      window.removeEventListener('keydown', abajo)
      window.removeEventListener('keyup', arriba)
      window.removeEventListener('blur', soltar)
      teclas.clear()
    }
  }, [])
}

/** Arrastre sobre la escena para girar la cámara y rueda para acercarla. */
export function controlesDeCamara() {
  let arrastrando = false
  let ultimoX = 0
  let ultimoY = 0
  return {
    onPointerDown: (e: React.PointerEvent) => {
      arrastrando = true
      ultimoX = e.clientX
      ultimoY = e.clientY
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!arrastrando) return
      local.camGiro -= (e.clientX - ultimoX) * 0.006
      local.camAltura = Math.min(1.25, Math.max(0.06, local.camAltura + (e.clientY - ultimoY) * 0.004))
      ultimoX = e.clientX
      ultimoY = e.clientY
    },
    onPointerUp: (e: React.PointerEvent) => {
      arrastrando = false
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    },
    onWheel: (e: React.WheelEvent) => {
      const max = local.zona === 'nave' ? 7 : 18
      local.camDistancia = Math.min(max, Math.max(2.4, local.camDistancia + e.deltaY * 0.006))
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}

// En desarrollo, se expone el estado para poder probar el movimiento desde la consola.
if (import.meta.env.DEV) (window as unknown as { __mt: unknown }).__mt = { local, palanca }
