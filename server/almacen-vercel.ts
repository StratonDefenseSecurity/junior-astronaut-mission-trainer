// Almacén en Vercel Blob privado, para la función de Vercel (server/vercel.ts).
import { BlobPreconditionFailedError, del, get, put } from '@vercel/blob'
import type { Almacen } from './almacen.js'

export function almacenBlob(): Almacen {
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
