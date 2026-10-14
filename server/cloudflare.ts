// Entrada en Cloudflare: un Worker que sirve el sitio y reparte las peticiones del juego entre
// Durable Objects.
//
// - Cada sala tiene su propio Durable Object ("sala:CODIGO"): una única instancia en todo el
//   mundo, con la sala en memoria y su almacenamiento SQLite. Nunca hay dos procesos
//   escribiendo la misma sala.
// - Las cuentas viven en otro Durable Object ("cuentas").
// - El Worker solo decide a cuál enviar cada petición. En el plan gratuito dispone de 10 ms de
//   CPU por petición y un Durable Object de 30 s, así que la simulación y el cálculo de las
//   claves corren dentro de ellos.
// - La consulta del estado, que cada jugador repite dos veces por segundo, va por WebSocket
//   con hibernación: los mensajes entrantes cuentan 20 a 1 y los salientes no cuentan, y el
//   objeto solo se factura mientras atiende un mensaje.
import { DurableObject } from 'cloudflare:workers'
import { conAlmacen, type Almacen } from './almacen.js'
import { codigoAleatorio, fijarSecreto, manejar, usuarioDeToken, type Respuesta } from './api.js'

interface Env {
  NODO: DurableObjectNamespace<Nodo>
  ASSETS: Fetcher
  AUTH_SECRET: string
}

/** Documentos en el SQLite del Durable Object. La tabla no se crea hasta la primera escritura. */
function almacenDurable(storage: DurableObjectStorage): Almacen {
  const sql = storage.sql
  let hayTabla = false
  let contador = 0
  const tabla = (crear: boolean): boolean => {
    if (hayTabla) return true
    if (crear) sql.exec('CREATE TABLE IF NOT EXISTS docs (ruta TEXT PRIMARY KEY, texto TEXT NOT NULL, etiqueta TEXT NOT NULL)')
    hayTabla = crear || sql.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'docs'").toArray().length > 0
    return hayTabla
  }
  const etiquetaDe = (ruta: string): string | undefined =>
    tabla(false) ? (sql.exec('SELECT etiqueta FROM docs WHERE ruta = ?', ruta).toArray()[0]?.etiqueta as string | undefined) : undefined
  return {
    nombre: 'durable-object',
    async leer(ruta, conocida) {
      const etiqueta = etiquetaDe(ruta)
      if (etiqueta === undefined) return null
      if (etiqueta === conocida) return 'igual'
      const fila = sql.exec('SELECT texto FROM docs WHERE ruta = ?', ruta).toArray()[0]
      return { texto: fila.texto as string, etiqueta }
    },
    async escribir(ruta, texto, etiqueta) {
      const actual = etiquetaDe(ruta)
      if (etiqueta === null ? actual !== undefined : actual !== etiqueta) return 'conflicto'
      tabla(true)
      const nueva = `${Date.now().toString(36)}.${(++contador).toString(36)}`
      sql.exec('INSERT OR REPLACE INTO docs (ruta, texto, etiqueta) VALUES (?, ?, ?)', ruta, texto, nueva)
      return nueva
    },
    async borrar(ruta) {
      if (!tabla(false)) return
      sql.exec('DELETE FROM docs WHERE ruta = ?', ruta)
      // Una sala abandonada antes del despegue no deja nada guardado.
      if (sql.exec('SELECT 1 FROM docs LIMIT 1').toArray().length === 0) {
        hayTabla = false
        await storage.deleteAll()
      }
    },
  }
}

interface Adjunto {
  codigo: string
  /** Cabecera de autorización que el cliente envía en su primer mensaje. */
  auth: string
  /** Usuario verificado de esa sesión. */
  id?: string
}

/** Antepone el número de consulta para que el cliente sepa a cuál responde. */
const conNumero = (n: unknown, json: string) =>
  typeof n === 'number' && Number.isFinite(n) ? (json.length > 2 ? `{"n":${n},${json.slice(1)}` : `{"n":${n}}`) : json

export class Nodo extends DurableObject<Env> {
  private readonly almacen: Almacen

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.almacen = almacenDurable(ctx.storage)
    fijarSecreto(env.AUTH_SECRET ?? '')
  }

  /** Una operación del juego. La llama el Worker por RPC. */
  operar(cuerpo: unknown, autorizacion: string, codigoNuevo?: string): Promise<Respuesta> {
    return conAlmacen(this.almacen, () => manejar(cuerpo, autorizacion || undefined, codigoNuevo ? { codigoNuevo } : {}))
  }

  /** Apertura del WebSocket por el que un jugador consulta el estado de esta sala. */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Se esperaba un WebSocket.', { status: 426 })
    const codigo = (new URL(request.url).searchParams.get('codigo') ?? '').toUpperCase()
    const par = new WebSocketPair()
    this.ctx.acceptWebSocket(par[1])
    par[1].serializeAttachment({ codigo, auth: '' } satisfies Adjunto)
    return new Response(null, { status: 101, webSocket: par[0] })
  }

  async webSocketMessage(ws: WebSocket, mensaje: string | ArrayBuffer): Promise<void> {
    // Las señales de voz llevan descripciones de sesión WebRTC de unos pocos KB.
    if (typeof mensaje !== 'string' || mensaje.length > 24_000) return
    let m: Record<string, unknown>
    try {
      m = JSON.parse(mensaje) as Record<string, unknown>
    } catch {
      return
    }
    if (!m || typeof m !== 'object') return
    const adjunto = ws.deserializeAttachment() as Adjunto
    if (typeof m.auth === 'string') {
      adjunto.auth = m.auth.slice(0, 1500)
      adjunto.id = usuarioDeToken(adjunto.auth)?.id
      ws.serializeAttachment(adjunto)
      if (m.n === undefined) return
    }
    // Señal de voz para otro jugador de la sala (o para todos con '*'): solo se reenvía.
    if (m.senal && typeof m.senal === 'object') {
      const { para, d } = m.senal as { para?: unknown; d?: unknown }
      if (!adjunto.id || typeof para !== 'string') return
      const texto = JSON.stringify({ senal: { de: adjunto.id, d } })
      for (const otro of this.ctx.getWebSockets()) {
        if (otro === ws) continue
        const a = otro.deserializeAttachment() as Adjunto
        if (a.id && (para === '*' || a.id === para)) otro.send(texto)
      }
      return
    }
    const r = await conAlmacen(this.almacen, () =>
      manejar({ op: 'estado', codigo: adjunto.codigo, v: m.v, h: m.h, p: m.p }, adjunto.auth || undefined),
    )
    ws.send(conNumero(m.n, r.json))
    // Sin sesión o fuera de la sala no hay nada más que decir por aquí.
    if (r.status === 401 || r.status === 403 || r.status === 404) ws.close(4001, 'fin')
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close(1000, 'cerrado')
    } catch {
      // ya estaba cerrado
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, 'error')
    } catch {
      // ya estaba cerrado
    }
  }
}

// `x-mt-ws` anuncia al cliente que este servidor acepta consultas por WebSocket.
const CABECERAS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-mt-ws': '1' }
const responder = (r: Respuesta) => new Response(r.json, { status: r.status, headers: CABECERAS })
const error = (status: number, texto: string) => responder({ status, json: JSON.stringify({ error: texto }) })
const nodo = (env: Env, nombre: string) => env.NODO.get(env.NODO.idFromName(nombre))
const CODIGO = /^[A-Z0-9]{6}$/
/** Operaciones que no pertenecen a ninguna sala. */
const DE_CUENTAS = new Set(['registro', 'ingresar', 'yo'])

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/ws') {
      const codigo = (url.searchParams.get('codigo') ?? '').toUpperCase()
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' || !CODIGO.test(codigo)) return error(400, 'Conexión inválida.')
      return nodo(env, `sala:${codigo}`).fetch(request)
    }

    if (url.pathname === '/api/juego') {
      if (request.method !== 'POST') return error(405, 'Usa POST.')
      const texto = await request.text()
      if (texto.length > 64_000) return error(413, 'Petición demasiado grande.')
      let cuerpo: Record<string, unknown> = {}
      try {
        const d: unknown = texto ? JSON.parse(texto) : {}
        if (d && typeof d === 'object') cuerpo = d as Record<string, unknown>
      } catch {
        // cuerpo inválido: se trata como vacío y `manejar` responde el error
      }
      const autorizacion = request.headers.get('authorization') ?? ''
      const op = String(cuerpo.op ?? '')
      try {
        if (op === 'crear') {
          // El código decide en qué Durable Object vivirá la sala, así que se elige aquí.
          for (let intento = 0; intento < 6; intento++) {
            const codigo = codigoAleatorio()
            const r = await nodo(env, `sala:${codigo}`).operar(cuerpo, autorizacion, codigo)
            if (!(r.status === 409 && r.json.includes('"codigoEnUso"'))) return responder(r)
          }
          return error(503, 'No se pudo crear la sala. Intenta de nuevo.')
        }
        const codigo = String(cuerpo.codigo ?? '').trim().toUpperCase()
        const destino = !DE_CUENTAS.has(op) && CODIGO.test(codigo) ? `sala:${codigo}` : 'cuentas'
        return responder(await nodo(env, destino).operar(cuerpo, autorizacion))
      } catch (e) {
        console.error('[worker]', e)
        return error(500, 'Error interno del servidor.')
      }
    }

    if (url.pathname.startsWith('/api/')) return error(404, 'No existe.')
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
