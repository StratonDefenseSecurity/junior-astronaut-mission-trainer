// Texturas de los globos generadas en tiempo de ejecución (sin imágenes ni red): se pintan en
// arreglos tipados (ver generadores.ts) dentro de un Web Worker y se suben como
// THREE.DataTexture. Se guardan en caché toda la sesión.
//
// Tamaños (ancho × alto, equirectangular):
//   detalle 'alto': Tierra 2048×1024 (+ nubes 1024×512), Marte 2048×1024, Luna 1024×512.
//   detalle 'bajo': la mitad en cada lado.
// La Tierra usa las costas de Natural Earth 1:50 millones (world-atlas land-50m).
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import type { Poligono } from './rasterizar'

export type Detalle = 'alto' | 'bajo'
type Tipo = 'tierra' | 'nubes' | 'marte' | 'luna'

/** Mensaje al worker. */
export interface PedidoTextura {
  id: number
  tipo: Tipo
  ancho: number
  alto: number
}
/** Respuesta del worker: capas de píxeles en el orden en que las devuelve cada generador. */
export interface RespuestaTextura {
  id: number
  capas: Uint8Array[]
  error?: string
}

const TAMANOS: Record<Tipo, Record<Detalle, [number, number]>> = {
  tierra: { alto: [2048, 1024], bajo: [1024, 512] },
  nubes: { alto: [1024, 512], bajo: [512, 256] },
  marte: { alto: [2048, 1024], bajo: [1024, 512] },
  luna: { alto: [1024, 512], bajo: [512, 256] },
}

// ------------------------------------------------------------------------------ worker

let trabajador: Worker | null | undefined
let siguienteId = 1
const pendientes = new Map<number, { ok: (c: Uint8Array[]) => void; mal: (e: Error) => void }>()

function obtenerTrabajador(): Worker | null {
  if (trabajador !== undefined) return trabajador
  try {
    trabajador = new Worker(new URL('./trabajador.ts', import.meta.url), { type: 'module' })
    trabajador.onmessage = (ev: MessageEvent<RespuestaTextura>) => {
      const p = pendientes.get(ev.data.id)
      if (!p) return
      pendientes.delete(ev.data.id)
      if (ev.data.error) p.mal(new Error(ev.data.error))
      else p.ok(ev.data.capas)
    }
    trabajador.onerror = () => {
      // Si el worker no arranca (navegador viejo), se genera en el hilo principal.
      trabajador = null
      for (const [id, p] of pendientes) {
        pendientes.delete(id)
        p.mal(new Error('worker'))
      }
    }
  } catch {
    trabajador = null
  }
  return trabajador
}

/** Plan B sin worker: mismo código en el hilo principal (las costas, en su propio chunk). */
let costasPrincipal: Promise<Poligono[]> | null = null
async function generarAqui(tipo: Tipo, ancho: number, alto: number): Promise<Uint8Array[]> {
  const g = await import('./generadores')
  // Ceder un cuadro para que la escena se dibuje antes del trabajo pesado.
  await new Promise((r) => setTimeout(r, 0))
  if (tipo === 'tierra') {
    costasPrincipal ??= Promise.all([import('topojson-client'), import('world-atlas/land-50m.json')]).then(([tc, datos]) => {
      const topo = ((datos as { default?: unknown }).default ?? datos) as Parameters<typeof tc.feature>[0]
      const geo = tc.feature(topo, topo.objects.land) as unknown as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>
      return geo.features.flatMap((f) => f.geometry.coordinates)
    })
    return [g.generarColorTierra(await costasPrincipal, ancho, alto)]
  }
  if (tipo === 'nubes') return [g.generarNubesTierra(ancho, alto)]
  const r = tipo === 'marte' ? g.generarMarte(ancho, alto) : g.generarLuna(ancho, alto)
  return [r.color, r.relieve]
}

function pedir(tipo: Tipo, ancho: number, alto: number): Promise<Uint8Array[]> {
  const w = obtenerTrabajador()
  if (!w) return generarAqui(tipo, ancho, alto)
  const id = siguienteId++
  return new Promise<Uint8Array[]>((ok, mal) => {
    pendientes.set(id, { ok, mal })
    const pedido: PedidoTextura = { id, tipo, ancho, alto }
    w.postMessage(pedido)
  }).catch(() => generarAqui(tipo, ancho, alto))
}

// ------------------------------------------------------------------------------ texturas

function dataTextura(datos: Uint8Array, ancho: number, alto: number, formato: THREE.PixelFormat, color: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(datos as unknown as BufferSource, ancho, alto, formato, THREE.UnsignedByteType)
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.wrapS = THREE.RepeatWrapping // sin costura en el antimeridiano
  t.wrapT = THREE.ClampToEdgeWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8 // el renderizador lo limita al máximo de la GPU
  t.needsUpdate = true
  return t
}

export interface TexturasTierra {
  /** Color (sRGB); alfa = agua abierta (para el brillo especular). */
  color: THREE.DataTexture
  /** Nubes: canal R = opacidad. */
  nubes: THREE.DataTexture
}
export interface TexturasRelieve {
  color: THREE.DataTexture
  /** Pendientes este/norte en R y G (128 = plano). */
  relieve: THREE.DataTexture
}

const cache = new Map<string, Promise<unknown>>()

function memo<T>(clave: string, f: () => Promise<T>): Promise<T> {
  let p = cache.get(clave) as Promise<T> | undefined
  if (!p) {
    p = f()
    // Si falla, se permite reintentar más tarde.
    p.catch(() => cache.delete(clave))
    cache.set(clave, p)
  }
  return p
}

export function texturasTierra(detalle: Detalle = 'alto'): Promise<TexturasTierra> {
  return memo(`tierra-${detalle}`, async () => {
    const [w, h] = TAMANOS.tierra[detalle]
    const [nw, nh] = TAMANOS.nubes[detalle]
    const [[color], [nubes]] = await Promise.all([pedir('tierra', w, h), pedir('nubes', nw, nh)])
    return { color: dataTextura(color, w, h, THREE.RGBAFormat, true), nubes: dataTextura(nubes, nw, nh, THREE.RedFormat, false) }
  })
}

function texturasRelieve(tipo: 'marte' | 'luna', detalle: Detalle): Promise<TexturasRelieve> {
  return memo(`${tipo}-${detalle}`, async () => {
    const [w, h] = TAMANOS[tipo][detalle]
    const [color, relieve] = await pedir(tipo, w, h)
    return { color: dataTextura(color, w, h, THREE.RGBAFormat, true), relieve: dataTextura(relieve, w, h, THREE.RGFormat, false) }
  })
}
export const texturasMarte = (detalle: Detalle = 'alto') => texturasRelieve('marte', detalle)
export const texturasLuna = (detalle: Detalle = 'alto') => texturasRelieve('luna', detalle)

/**
 * Empieza a generar las texturas antes de que hagan falta (por ejemplo, en el lobby), para que
 * los globos aparezcan ya pintados.
 */
export function precargarTexturas(cuales: ReadonlyArray<'tierra' | 'marte' | 'luna'> = ['tierra', 'marte', 'luna'], detalle: Detalle = 'alto'): Promise<void> {
  const f = { tierra: texturasTierra, marte: texturasMarte, luna: texturasLuna }
  return Promise.all(cuales.map((c) => f[c](detalle))).then(() => undefined)
}

/** Hook: la promesa resuelta o null mientras se genera. */
export function usePromesa<T>(crear: () => Promise<T>, clave: string): T | null {
  const [valor, setValor] = useState<{ clave: string; v: T } | null>(null)
  useEffect(() => {
    let vivo = true
    crear().then(
      (v) => vivo && setValor({ clave, v }),
      (e) => console.warn('No se pudieron generar las texturas del planeta', e),
    )
    return () => {
      vivo = false
    }
  }, [clave])
  return valor && valor.clave === clave ? valor.v : null
}

// ------------------------------------------------------------------ texturas provisionales

/** Texturas de 1×1 con el color medio de cada cuerpo, mientras se generan las de verdad. */
function plana(r: number, g: number, b: number, a: number, formato: THREE.PixelFormat = THREE.RGBAFormat, color = true) {
  const datos = formato === THREE.RGBAFormat ? new Uint8Array([r, g, b, a]) : formato === THREE.RGFormat ? new Uint8Array([r, g]) : new Uint8Array([r])
  const t = new THREE.DataTexture(datos, 1, 1, formato, THREE.UnsignedByteType)
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.needsUpdate = true
  return t
}
export const PROVISIONAL = {
  tierra: plana(22, 52, 92, 200),
  marte: plana(186, 116, 74, 255),
  luna: plana(150, 149, 146, 255),
  relievePlano: plana(128, 128, 0, 0, THREE.RGFormat, false),
  sinNubes: plana(0, 0, 0, 0, THREE.RedFormat, false),
}
