// Texturas de los globos generadas en tiempo de ejecución (sin imágenes ni red): se pintan en
// arreglos tipados (ver generadores.ts) dentro de un Web Worker y se suben como
// THREE.DataTexture. Se guardan en caché toda la sesión.
//
// Tamaños (ancho × alto, equirectangular):
//   detalle 'alto': Tierra 2048×1024 (+ nubes 1024×512), Marte 2048×1024, Luna 1024×512.
//   detalle 'bajo': la mitad en cada lado.
// La Tierra usa las costas de Natural Earth 1:50 millones (world-atlas land-50m).
//
// Encima de esto están las imágenes reales de NASA y USGS (public/texturas/, generadas con
// scripts/texturas-reales.mjs; créditos en public/texturas/CREDITOS.md). Se piden primero; si no
// llegan en un momento o fallan, se genera el globo procedural, que queda de respaldo.
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import type { Poligono } from './rasterizar'
import manifiesto from './texturasReales.json'

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
/** Valores ya resueltos, para que un globo nuevo los use desde el primer cuadro. */
const resueltos = new Map<string, unknown>()

function memo<T>(clave: string, f: () => Promise<T>): Promise<T> {
  let p = cache.get(clave) as Promise<T> | undefined
  if (!p) {
    const nueva = f()
    p = nueva
    // Si falla, se permite reintentar más tarde.
    nueva.then(
      (v) => {
        if (cache.get(clave) === nueva) resueltos.set(clave, v)
      },
      () => cache.delete(clave),
    )
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
 * Empieza a cargar las texturas antes de que hagan falta (por ejemplo, en el lobby), para que
 * los globos aparezcan ya pintados: las imágenes reales si las hay y, si no, las procedurales.
 */
export function precargarTexturas(cuales: ReadonlyArray<'tierra' | 'marte' | 'luna'> = ['tierra', 'marte', 'luna'], detalle: Detalle = 'alto'): Promise<void> {
  const real: Record<string, () => Promise<unknown>> = { tierra: texturasRealesTierra, marte: texturasRealesMarte, luna: texturasRealesLuna }
  const procedural: Record<string, (d: Detalle) => Promise<unknown>> = { tierra: texturasTierra, marte: texturasMarte, luna: texturasLuna }
  return Promise.all(cuales.map((c) => real[c]().catch(() => procedural[c](detalle)))).then(() => undefined)
}

// ------------------------------------------------------------------- imágenes reales

interface ArchivoReal {
  archivo: string
  ancho: number
  alto: number
  /** Relieve: la textura guarda 128 + pendiente × k. */
  k?: number
}
interface Manifiesto {
  tierra?: { dia: ArchivoReal; agua: ArchivoReal; noche: ArchivoReal; nubes: ArchivoReal }
  luna?: { color: ArchivoReal; relieve: ArchivoReal }
  marte?: { color: ArchivoReal; relieve: ArchivoReal }
}
const REALES = manifiesto as Manifiesto

type UsoImagen = 'color' | 'gris' | 'pendientes'

/** Carga una imagen de public/texturas como textura con mipmaps. */
function cargarImagen(a: ArchivoReal, uso: UsoImagen): Promise<THREE.Texture> {
  const url = `${import.meta.env.BASE_URL}${a.archivo}`
  return new Promise((ok, mal) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = uso === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace
        // Las de un canal o dos se suben así a la GPU: ocupan la cuarta parte o la mitad.
        if (uso === 'gris') t.format = THREE.RedFormat
        if (uso === 'pendientes') t.format = THREE.RGFormat
        t.wrapS = THREE.RepeatWrapping
        t.wrapT = THREE.ClampToEdgeWrapping
        t.magFilter = THREE.LinearFilter
        t.minFilter = THREE.LinearMipmapLinearFilter
        t.generateMipmaps = true
        t.anisotropy = 8
        const img = t.image as HTMLImageElement
        // Se decodifica fuera del hilo principal antes de entregarla, si el navegador lo permite.
        const listo = typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve()
        void listo.then(() => {
          t.needsUpdate = true
          ok(t)
        })
      },
      undefined,
      () => mal(new Error(`No se pudo cargar ${url}`)),
    )
  })
}

export interface TexturasRealesTierra {
  dia: THREE.Texture
  /** Agua abierta en R (1 = mar). */
  agua: THREE.Texture
  /** Luces de noche en R. */
  noche: THREE.Texture
  /** Nubes en R (opacidad). */
  nubes: THREE.Texture
}
export interface TexturasRealesRelieve {
  color: THREE.Texture
  /** Pendientes este y norte en R y G (128 = plano). */
  relieve: THREE.Texture
  /** Escala con que se guardaron las pendientes. */
  k: number
}

const sinImagenes = (cuerpo: string) => Promise.reject(new Error(`No hay imágenes reales de ${cuerpo}`))

export function texturasRealesTierra(): Promise<TexturasRealesTierra> {
  const m = REALES.tierra
  if (!m) return sinImagenes('la Tierra')
  return memo('real-tierra', async () => {
    const [dia, agua, noche, nubes] = await Promise.all([cargarImagen(m.dia, 'color'), cargarImagen(m.agua, 'gris'), cargarImagen(m.noche, 'gris'), cargarImagen(m.nubes, 'gris')])
    liberarProcedural(['tierra-alto', 'tierra-bajo'])
    return { dia, agua, noche, nubes }
  })
}

function texturasRealesRelieve(cuerpo: 'marte' | 'luna'): Promise<TexturasRealesRelieve> {
  const m = REALES[cuerpo]
  if (!m) return sinImagenes(cuerpo)
  return memo(`real-${cuerpo}`, async () => {
    const [color, relieve] = await Promise.all([cargarImagen(m.color, 'color'), cargarImagen(m.relieve, 'pendientes')])
    liberarProcedural([`${cuerpo}-alto`, `${cuerpo}-bajo`])
    return { color, relieve, k: m.relieve.k ?? 300 }
  })
}
export const texturasRealesMarte = () => texturasRealesRelieve('marte')
export const texturasRealesLuna = () => texturasRealesRelieve('luna')

/** ¿Hay imágenes reales de este cuerpo en el sitio? */
export const hayImagenesReales = (cuerpo: 'tierra' | 'marte' | 'luna') => Boolean(REALES[cuerpo])

/**
 * Cuando llegan las imágenes reales, las texturas procedurales ya no hacen falta: se liberan de
 * la GPU unos segundos después, para que ningún globo las esté usando todavía.
 */
function liberarProcedural(claves: string[]) {
  for (const clave of claves) {
    const p = cache.get(clave) as Promise<object> | undefined
    if (!p) continue
    cache.delete(clave)
    resueltos.delete(clave)
    p.then(
      (tex) => setTimeout(() => Object.values(tex).forEach((t) => (t as THREE.Texture).dispose()), 4000),
      () => undefined,
    )
  }
}

/**
 * Hook de los globos: pide las imágenes reales y, si no llegan en `espera` ms o fallan, genera
 * las procedurales. Devuelve lo que haya; cuando llegan las reales, el globo se cambia a ellas.
 * `cuerpo` y `clave` identifican el pedido (la clave cambia con el detalle).
 */
export function useTexturasGlobo<R, P>(
  cuerpo: 'tierra' | 'marte' | 'luna',
  clave: string,
  real: () => Promise<R>,
  procedural: () => Promise<P>,
  espera = 4000,
): { real: R | null; procedural: P | null } {
  type Estado = { clave: string; real: R | null; procedural: P | null }
  const inicial = (): Estado => ({ clave, real: (resueltos.get(`real-${cuerpo}`) as R | undefined) ?? null, procedural: (resueltos.get(clave) as P | undefined) ?? null })
  const [estado, setEstado] = useState<Estado>(inicial)
  useEffect(() => {
    let vivo = true
    let llegoReal = false
    const pedirProcedural = () => {
      if (!vivo || llegoReal) return
      procedural().then(
        (p) => {
          if (vivo && !llegoReal) setEstado((e) => (e.clave === clave ? { ...e, procedural: p } : e))
        },
        (e) => console.warn('No se pudieron generar las texturas del planeta', e),
      )
    }
    const reloj = setTimeout(pedirProcedural, espera)
    real().then(
      (r) => {
        llegoReal = true
        clearTimeout(reloj)
        if (vivo) setEstado((e) => (e.clave === clave ? { ...e, real: r } : { clave, real: r, procedural: null }))
      },
      () => {
        clearTimeout(reloj)
        pedirProcedural()
      },
    )
    return () => {
      vivo = false
      clearTimeout(reloj)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
  const e = estado.clave === clave ? estado : inicial()
  return { real: e.real, procedural: e.procedural }
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
  /** Sin luces de ciudades ni máscara de agua. */
  negro: plana(0, 0, 0, 0, THREE.RedFormat, false),
}
