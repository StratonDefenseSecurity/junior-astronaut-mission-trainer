// Entrada de la función de Vercel: POST /api/juego
import type { IncomingMessage, ServerResponse } from 'node:http'
import { usarAlmacen } from './almacen.js'
import { almacenBlob } from './almacen-vercel.js'
import { manejar } from './api.js'

// Sin almacén Blob configurado, las salas viven solo en la memoria de la instancia.
if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) usarAlmacen(almacenBlob())

async function leerCuerpo(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  let cuerpo = req.body
  if (cuerpo === undefined) {
    const partes: Buffer[] = []
    for await (const parte of req) partes.push(Buffer.isBuffer(parte) ? parte : Buffer.from(parte))
    cuerpo = Buffer.concat(partes)
  }
  if (Buffer.isBuffer(cuerpo)) cuerpo = cuerpo.toString('utf8')
  if (typeof cuerpo === 'string') {
    try {
      return cuerpo ? JSON.parse(cuerpo) : {}
    } catch {
      return {}
    }
  }
  return cuerpo
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('{"error":"Usa POST."}')
    return
  }
  const r = await manejar(await leerCuerpo(req), req.headers.authorization)
  res.statusCode = r.status
  res.end(r.json)
}
