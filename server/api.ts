// API del juego sobre HTTP: una sola entrada (`manejar`) que usan tanto la función de Vercel
// como el servidor local de desarrollo.
//
// Modelo de ejecución (pensado para funciones sin proceso permanente):
// - El estado de cada sala vive en el almacén (Vercel Blob) y se guarda con cada acción.
// - Cada instancia mantiene una copia en memoria para no leer el almacén en cada consulta, y la
//   revalida cada pocos segundos por si otra instancia escribió.
// - El paso del tiempo no se guarda: `avanzar` lo recalcula de forma determinista.
// - Los clientes consultan el estado cada segundo (`estado`) en lugar de usar sockets.
import crypto from 'node:crypto'
import type { DecisionMode, Role, RoomState } from '../shared/types.js'
import { almacen } from './almacen.js'
import { responderBot } from './bot.js'
import {
  accion,
  ajustarCargamento,
  avanzar,
  confirmarPaso,
  crearSala,
  elegirAlternativa,
  elegirRol,
  iniciarMision,
  irAyudar,
  jugador,
  lanzar,
  log,
  nuevoJugador,
  pedirAyuda,
  proponerUbicacion,
  votar,
} from './game.js'
import { fijarAhora } from './reloj.js'

export interface Respuesta {
  status: number
  json: string
}
interface Usuario {
  id: string
  nombre: string
}
interface CuentaGuardada {
  id: string
  usuario: string
  salt: string
  hash: string
  creado: number
}

const REVALIDAR_MS = 4000 // cada cuánto se comprueba si otra instancia cambió la sala
const DESCONECTADO_MS = 12_000 // sin consultas durante este tiempo = desconectado
const FANTASMA_LOBBY_MS = 30_000 // en el lobby, quien no consulta en este tiempo libera su rol
const MAX_JUGADORES = 6

const ok = (cuerpo: unknown): Respuesta => ({ status: 200, json: JSON.stringify(cuerpo) })
const fallo = (status: number, error: string, extra: Record<string, unknown> = {}): Respuesta => ({
  status,
  json: JSON.stringify({ error, ...extra }),
})

// ---------- Cuentas ----------

function secreto(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('Falta la variable de entorno AUTH_SECRET')
  return s
}
const hmac = (texto: string) => crypto.createHmac('sha256', secreto()).update(texto).digest('base64url')
const firmar = (u: Usuario) => {
  const carga = Buffer.from(JSON.stringify({ id: u.id, n: u.nombre })).toString('base64url')
  return `${carga}.${hmac(carga)}`
}
function verificar(autorizacion: string | undefined): Usuario | null {
  const token = autorizacion?.startsWith('Bearer ') ? autorizacion.slice(7) : null
  if (!token) return null
  const [carga, firma] = token.split('.')
  if (!carga || !firma) return null
  const a = Buffer.from(firma)
  const b = Buffer.from(hmac(carga))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const d = JSON.parse(Buffer.from(carga, 'base64url').toString()) as { id: string; n: string }
    return typeof d.id === 'string' && typeof d.n === 'string' ? { id: d.id, nombre: d.n } : null
  } catch {
    return null
  }
}
const claveDerivada = (clave: string, salt: string) => crypto.scryptSync(clave, salt, 32).toString('hex')
const rutaCuenta = (usuario: string) => `usuarios/${Buffer.from(usuario.toLowerCase()).toString('hex')}.json`

async function registro(usuario: string, clave: string): Promise<Respuesta> {
  if (!/^[\wáéíóúñÁÉÍÓÚÑ.-]{3,20}$/.test(usuario)) return fallo(400, 'Usuario de 3 a 20 caracteres, sin espacios.')
  if (clave.length < 4) return fallo(400, 'La clave necesita al menos 4 caracteres.')
  const salt = crypto.randomBytes(8).toString('hex')
  const cuenta: CuentaGuardada = { id: crypto.randomUUID(), usuario, salt, hash: claveDerivada(clave, salt), creado: Date.now() }
  const r = await almacen().escribir(rutaCuenta(usuario), JSON.stringify(cuenta), null)
  if (r === 'conflicto') return fallo(409, 'Ese usuario ya existe.')
  const u = { id: cuenta.id, nombre: cuenta.usuario }
  return ok({ token: firmar(u), usuario: u })
}

async function ingresar(usuario: string, clave: string): Promise<Respuesta> {
  const doc = usuario ? await almacen().leer(rutaCuenta(usuario)) : null
  if (!doc || doc === 'igual') return fallo(401, 'Usuario o clave incorrectos.')
  const cuenta = JSON.parse(doc.texto) as CuentaGuardada
  const a = Buffer.from(claveDerivada(clave, cuenta.salt))
  const b = Buffer.from(cuenta.hash)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fallo(401, 'Usuario o clave incorrectos.')
  const u = { id: cuenta.id, nombre: cuenta.usuario }
  return ok({ token: firmar(u), usuario: u })
}

// ---------- Salas en esta instancia ----------

interface Entrada {
  room: RoomState
  etiqueta: string
  verificado: number
}
interface Presencia {
  desde: number
  ultimo: Map<string, number>
}
const salas = new Map<string, Entrada>()
const presencias = new Map<string, Presencia>()
const colas = new Map<string, Promise<void>>()

const rutaSala = (codigo: string) => `salas/${codigo}.json`
const huella = (texto: string) => crypto.createHash('sha1').update(texto).digest('hex').slice(0, 16)
const respuestaSala = (texto: string): Respuesta => ({
  status: 200,
  json: `{"sala":${texto},"h":"${huella(texto)}","ahora":${Date.now()}}`,
})
const SIN_SALA = { sinSala: true }

/** Ejecuta las operaciones de una misma sala de una en una dentro de esta instancia. */
function enCola<T>(codigo: string, tarea: () => Promise<T>): Promise<T> {
  const previa = colas.get(codigo) ?? Promise.resolve()
  const resultado = previa.then(tarea, tarea)
  const cola = resultado.then(
    () => undefined,
    () => undefined,
  )
  colas.set(codigo, cola)
  void cola.then(() => {
    if (colas.get(codigo) === cola) colas.delete(codigo)
  })
  return resultado
}

async function obtener(codigo: string, versionCliente: number): Promise<Entrada | null> {
  const t = Date.now()
  const e = salas.get(codigo)
  if (e) {
    const edad = t - e.verificado
    if (edad < 1000 || (e.room.version >= versionCliente && edad < REVALIDAR_MS)) return e
  }
  const r = await almacen().leer(rutaSala(codigo), e?.etiqueta)
  if (r === null) {
    salas.delete(codigo)
    presencias.delete(codigo)
    return null
  }
  if (r === 'igual' && e) {
    e.verificado = t
    return e
  }
  if (r === 'igual') return null
  const nueva: Entrada = { room: JSON.parse(r.texto) as RoomState, etiqueta: r.etiqueta, verificado: t }
  salas.set(codigo, nueva)
  return nueva
}

function presenciaDe(codigo: string): Presencia {
  let p = presencias.get(codigo)
  if (!p) presencias.set(codigo, (p = { desde: Date.now(), ultimo: new Map() }))
  return p
}

/** Marca al usuario como visto y recalcula quién está conectado según las consultas recientes. */
function actualizarPresencia(codigo: string, room: RoomState, usuarioId: string, t: number) {
  const p = presenciaDe(codigo)
  p.ultimo.set(usuarioId, t)
  for (const j of room.jugadores) j.conectado = t - (p.ultimo.get(j.id) ?? p.desde) < DESCONECTADO_MS
}

/** En el lobby, quien cerró la pestaña deja de ocupar su rol. */
function podarLobby(codigo: string, room: RoomState, t: number) {
  const p = presenciaDe(codigo)
  const antes = room.jugadores.length
  room.jugadores = room.jugadores.filter((j) => t - (p.ultimo.get(j.id) ?? p.desde) < FANTASMA_LOBBY_MS)
  if (room.jugadores.length !== antes && !room.jugadores.some((j) => j.id === room.hostId) && room.jugadores[0]) {
    room.hostId = room.jugadores[0].id
  }
}

type Mutacion = (room: RoomState, t: number) => string | null

/** Aplica una acción sobre la sala y la guarda. Reintenta si otra instancia escribió antes. */
function mutar(
  codigo: string,
  usuario: Usuario,
  versionCliente: number,
  fn: Mutacion,
  opciones: { soloMiembros?: boolean; noExiste?: string } = {},
): Promise<Respuesta> {
  const soloMiembros = opciones.soloMiembros ?? true
  return enCola(codigo, async () => {
    for (let intento = 0; intento < 4; intento++) {
      const e = await obtener(codigo, versionCliente)
      if (!e) return fallo(404, opciones.noExiste ?? 'Esa sala ya no existe.', SIN_SALA)
      const room = e.room
      const t = Date.now()
      actualizarPresencia(codigo, room, usuario.id, t)
      if (room.fase === 'lobby') podarLobby(codigo, room, t)
      avanzar(room, t)
      if (soloMiembros && !jugador(room, usuario.id)) return fallo(403, 'No formas parte de esa sala.', SIN_SALA)
      const error = fn(room, t)
      if (error) return fallo(400, error)
      room.version += 1
      const texto = JSON.stringify(room)
      let r: string
      try {
        r = await almacen().escribir(rutaSala(codigo), texto, e.etiqueta)
      } catch (err) {
        salas.delete(codigo) // la copia en memoria ya no coincide con lo guardado
        throw err
      }
      if (r === 'conflicto') {
        salas.delete(codigo)
        continue
      }
      e.etiqueta = r
      e.verificado = Date.now()
      return respuestaSala(texto)
    }
    return fallo(409, 'La sala está muy ocupada. Intenta de nuevo.')
  })
}

function consultar(codigo: string, usuario: Usuario, versionCliente: number, huellaCliente: string): Promise<Respuesta> {
  return enCola(codigo, async () => {
    const e = await obtener(codigo, versionCliente)
    if (!e) return fallo(404, 'Esa sala ya no existe.', SIN_SALA)
    if (!jugador(e.room, usuario.id)) return fallo(403, 'No formas parte de esa sala.', SIN_SALA)
    const t = Date.now()
    actualizarPresencia(codigo, e.room, usuario.id, t)
    avanzar(e.room, t)
    const texto = JSON.stringify(e.room)
    if (huella(texto) === huellaCliente) return ok({ igual: true, ahora: t })
    return respuestaSala(texto)
  })
}

async function crear(usuario: Usuario, modo: DecisionMode): Promise<Respuesta> {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let intento = 0; intento < 6; intento++) {
    const codigo = Array.from(crypto.randomBytes(6), (b) => letras[b % letras.length]).join('')
    const t = Date.now()
    fijarAhora(t)
    const room = crearSala(codigo, usuario.id, modo)
    room.jugadores.push(nuevoJugador(usuario.id, usuario.nombre))
    log(room, `${usuario.nombre} creó la sala.`, 'info')
    room.version = 1
    const texto = JSON.stringify(room)
    const r = await almacen().escribir(rutaSala(codigo), texto, null)
    if (r === 'conflicto') continue
    salas.set(codigo, { room, etiqueta: r, verificado: t })
    presenciaDe(codigo).ultimo.set(usuario.id, t)
    return respuestaSala(texto)
  }
  return fallo(503, 'No se pudo crear la sala. Intenta de nuevo.')
}

function unirse(codigo: string, usuario: Usuario): Promise<Respuesta> {
  return mutar(
    codigo,
    usuario,
    0,
    (room) => {
      const j = jugador(room, usuario.id)
      if (j) {
        j.nombre = usuario.nombre
        return null
      }
      if (room.fase !== 'lobby') return 'Esa misión ya empezó y no formas parte de ella.'
      if (room.jugadores.length >= MAX_JUGADORES) return `La sala está llena (${MAX_JUGADORES} tripulantes).`
      room.jugadores.push(nuevoJugador(usuario.id, usuario.nombre))
      log(room, `${usuario.nombre} se unió a la sala.`, 'info')
      return null
    },
    { soloMiembros: false, noExiste: 'No existe una sala con ese código.' },
  )
}

function salir(codigo: string, usuario: Usuario): Promise<Respuesta> {
  return enCola(codigo, async () => {
    const e = await obtener(codigo, 0)
    if (!e || !jugador(e.room, usuario.id)) return ok(SIN_SALA)
    const room = e.room
    presenciaDe(codigo).ultimo.set(usuario.id, 0)
    if (room.fase !== 'lobby') return ok(SIN_SALA) // en misión conserva su puesto y puede volver con el código
    room.jugadores = room.jugadores.filter((j) => j.id !== usuario.id)
    if (room.jugadores.length === 0) {
      salas.delete(codigo)
      presencias.delete(codigo)
      await almacen().borrar(rutaSala(codigo))
      return ok(SIN_SALA)
    }
    if (room.hostId === usuario.id) room.hostId = room.jugadores[0].id
    room.version += 1
    const r = await almacen().escribir(rutaSala(codigo), JSON.stringify(room), e.etiqueta)
    if (r === 'conflicto') salas.delete(codigo)
    else e.etiqueta = r
    return ok(SIN_SALA)
  })
}

function preguntarBot(codigo: string, usuario: Usuario, versionCliente: number, texto: string): Promise<Respuesta> {
  return enCola(codigo, async () => {
    const e = await obtener(codigo, versionCliente)
    if (!e) return fallo(404, 'Esa sala ya no existe.', SIN_SALA)
    const j = jugador(e.room, usuario.id)
    if (!j) return fallo(403, 'No formas parte de esa sala.', SIN_SALA)
    const t = Date.now()
    actualizarPresencia(codigo, e.room, usuario.id, t)
    avanzar(e.room, t)
    return ok({ respuesta: responderBot(e.room, j, texto), ahora: t })
  })
}

// ---------- Entrada ----------

const texto = (v: unknown, max = 300) => String(v ?? '').trim().slice(0, max)

async function despachar(c: Record<string, unknown>, autorizacion: string | undefined): Promise<Respuesta> {
  const op = texto(c.op, 30)
  if (op === 'registro') return registro(texto(c.usuario, 40), String(c.clave ?? ''))
  if (op === 'ingresar') return ingresar(texto(c.usuario, 40), String(c.clave ?? ''))

  const usuario = verificar(autorizacion)
  if (!usuario) return fallo(401, 'Sesión inválida. Vuelve a ingresar.', { sinSesion: true })
  if (op === 'yo') return ok({ usuario })
  if (op === 'crear') return crear(usuario, c.modo === 'votacion' ? 'votacion' : 'comandante')

  const codigo = texto(c.codigo, 10).toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(codigo)) return fallo(400, 'El código de sala tiene 6 letras o números.')
  const v = Number.isFinite(Number(c.v)) ? Number(c.v) : 0
  const yo = usuario.id

  switch (op) {
    case 'unirse':
      return unirse(codigo, usuario)
    case 'salir':
      return salir(codigo, usuario)
    case 'estado':
      return consultar(codigo, usuario, v, texto(c.h, 40))
    case 'bot': {
      const pregunta = texto(c.texto)
      return pregunta ? preguntarBot(codigo, usuario, v, pregunta) : fallo(400, 'Escribe una pregunta.')
    }
    case 'rol':
      return mutar(codigo, usuario, v, (room) => elegirRol(room, yo, (c.rol as Role | null) ?? null))
    case 'iniciar':
      return mutar(codigo, usuario, v, (room) => iniciarMision(room, yo))
    case 'cargamento':
      return mutar(codigo, usuario, v, (room) => ajustarCargamento(room, (c.cambios ?? {}) as Record<string, number>))
    case 'lanzar':
      return mutar(codigo, usuario, v, (room) => lanzar(room, yo))
    case 'confirmar':
      return mutar(codigo, usuario, v, (room) => confirmarPaso(room, yo, Number(c.paso)))
    case 'ubicacion':
      return mutar(codigo, usuario, v, (room) => proponerUbicacion(room, yo, texto(c.sitioId, 20)))
    case 'accion':
      return mutar(codigo, usuario, v, (room) => accion(room, yo, texto(c.id, 20), (c.payload ?? {}) as Record<string, unknown>))
    case 'votar':
      return mutar(codigo, usuario, v, (room) => votar(room, yo, texto(c.id, 40), Boolean(c.aprueba)))
    case 'emergencia':
      return mutar(codigo, usuario, v, (room) => elegirAlternativa(room, yo, texto(c.id, 40), texto(c.altId, 20)))
    case 'ayudaPedir':
      return mutar(codigo, usuario, v, (room) => pedirAyuda(room, yo, c.paraRol as Role, texto(c.motivo, 120)))
    case 'ayudaIr':
      return mutar(codigo, usuario, v, (room) => irAyudar(room, yo, texto(c.jugadorId, 60)))
    case 'chat': {
      const mensaje = texto(c.texto)
      if (!mensaje) return fallo(400, 'Escribe un mensaje.')
      return mutar(codigo, usuario, v, (room, t) => {
        room.chat.push({ id: crypto.randomUUID(), de: usuario.nombre, texto: mensaje, t, bot: false })
        if (room.chat.length > 60) room.chat.splice(0, room.chat.length - 60)
        return null
      })
    }
  }
  return fallo(400, 'Operación desconocida.')
}

export async function manejar(cuerpo: unknown, autorizacion?: string): Promise<Respuesta> {
  try {
    const c = cuerpo && typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>) : {}
    return await despachar(c, autorizacion)
  } catch (e) {
    console.error('[api]', e)
    return fallo(500, 'Error interno del servidor.')
  }
}
