// Almacén de documentos JSON con escritura condicional (control de concurrencia optimista).
//
// - En Vercel usa Vercel Blob privado (variable BLOB_READ_WRITE_TOKEN o BLOB_STORE_ID).
// - En local usa archivos dentro de server/data.
//
// Cada documento tiene una "etiqueta" que cambia con su contenido. Para sobrescribir hay que
// presentar la etiqueta que se leyó: si otro proceso escribió antes, la escritura se rechaza
// con 'conflicto' y quien llama vuelve a leer y reintenta.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { BlobPreconditionFailedError, del, get, put } from '@vercel/blob'

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

const sha = (t: string) => crypto.createHash('sha1').update(t).digest('hex')

function almacenArchivos(dir: string): Almacen {
  const archivo = (ruta: string) => path.join(dir, ...ruta.split('/'))
  return {
    nombre: 'archivos',
    async leer(ruta, conocida) {
      const f = archivo(ruta)
      if (!fs.existsSync(f)) return null
      const texto = fs.readFileSync(f, 'utf8')
      const etiqueta = sha(texto)
      return etiqueta === conocida ? 'igual' : { texto, etiqueta }
    },
    async escribir(ruta, texto, etiqueta) {
      const f = archivo(ruta)
      const existe = fs.existsSync(f)
      if (etiqueta === null && existe) return 'conflicto'
      if (etiqueta !== null && (!existe || sha(fs.readFileSync(f, 'utf8')) !== etiqueta)) return 'conflicto'
      fs.mkdirSync(path.dirname(f), { recursive: true })
      fs.writeFileSync(f, texto)
      return sha(texto)
    },
    async borrar(ruta) {
      fs.rmSync(archivo(ruta), { force: true })
    },
  }
}

function almacenMemoria(): Almacen {
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

function almacenBlob(): Almacen {
  return {
    nombre: 'blob',
    async leer(ruta, conocida) {
      const r = await get(ruta, { access: 'private', useCache: false, ...(conocida ? { ifNoneMatch: conocida } : {}) })
      if (!r) return null
      if (r.statusCode === 304) return 'igual'
      return { texto: await new Response(r.stream).text(), etiqueta: r.blob.etag }
    },
    async escribir(ruta, texto, etiqueta) {
      try {
        const b = await put(ruta, texto, {
          access: 'private',
          contentType: 'application/json',
          addRandomSuffix: false,
          ...(etiqueta === null ? { allowOverwrite: false } : { allowOverwrite: true, ifMatch: etiqueta }),
        })
        return b.etag
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError) return 'conflicto'
        if (etiqueta === null && /exist/i.test(String((e as Error)?.message))) return 'conflicto'
        throw e
      }
    },
    async borrar(ruta) {
      try {
        await del(ruta)
      } catch {
        // Borrar es limpieza: si falla, el documento simplemente queda huérfano.
      }
    },
  }
}

let actual: Almacen | null = null

export function almacen(): Almacen {
  if (actual) return actual
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) actual = almacenBlob()
  else if (process.env.VERCEL) actual = almacenMemoria()
  else actual = almacenArchivos(process.env.MT_DATA_DIR ?? path.join(process.cwd(), 'server', 'data'))
  return actual
}
