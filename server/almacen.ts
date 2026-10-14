// Almacén de documentos JSON con escritura condicional (control de concurrencia optimista).
//
// Cada documento tiene una "etiqueta" que cambia con su contenido. Para sobrescribir hay que
// presentar la etiqueta que se leyó: si otro proceso escribió antes, la escritura se rechaza
// con 'conflicto' y quien llama vuelve a leer y reintenta.
//
// Dónde se guardan los documentos depende de dónde corre el servidor:
// - En Cloudflare, en el almacenamiento del Durable Object de cada sala (server/cloudflare.ts).
// - En local, en archivos dentro de server/data (server/almacen-archivos.ts).
// - En Vercel, en Vercel Blob (server/almacen-vercel.ts).
// Este archivo no importa ninguno de ellos para poder empaquetarse en cualquier plataforma.
import { AsyncLocalStorage } from 'node:async_hooks'
import crypto from 'node:crypto'

export interface Documento {
  texto: string
  etiqueta: string
}

export interface Almacen {
  nombre: string
  /** null si no existe; 'igual' si no cambió respecto a `etiquetaConocida`. */
  leer(ruta: string, etiquetaConocida?: string): Promise<Documento | 'igual' | null>
  /** `etiqueta` null crea el documento y falla si ya existe. Devuelve la etiqueta nueva. */
  escribir(ruta: string, texto: string, etiqueta: string | null): Promise<string | 'conflicto'>
  borrar(ruta: string): Promise<void>
}

export const sha = (t: string) => crypto.createHash('sha1').update(t).digest('hex')

export function almacenMemoria(): Almacen {
  const docs = new Map<string, string>()
  return {
    nombre: 'memoria',
    async leer(ruta, conocida) {
      const texto = docs.get(ruta)
      if (texto === undefined) return null
      const etiqueta = sha(texto)
      return etiqueta === conocida ? 'igual' : { texto, etiqueta }
    },
    async escribir(ruta, texto, etiqueta) {
      const actual = docs.get(ruta)
      if (etiqueta === null && actual !== undefined) return 'conflicto'
      if (etiqueta !== null && (actual === undefined || sha(actual) !== etiqueta)) return 'conflicto'
      docs.set(ruta, texto)
      return sha(texto)
    },
    async borrar(ruta) {
      docs.delete(ruta)
    },
  }
}

// El almacén de una petición. En Cloudflare varias salas pueden compartir el mismo proceso y
// cada una tiene su propio almacenamiento, así que no sirve una variable global: el almacén
// viaja con la petición.
const dePeticion = new AsyncLocalStorage<Almacen>()
let porDefecto: Almacen | null = null

/** Fija el almacén de todo el proceso (servidor local, función de Vercel). */
export function usarAlmacen(a: Almacen) {
  porDefecto = a
}

/** Ejecuta `fn` con un almacén propio, que también verán sus continuaciones asíncronas. */
export function conAlmacen<T>(a: Almacen, fn: () => T): T {
  return dePeticion.run(a, fn)
}

export function almacen(): Almacen {
  return dePeticion.getStore() ?? (porDefecto ??= almacenMemoria())
}
