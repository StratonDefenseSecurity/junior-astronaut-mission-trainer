// API del juego: una sola entrada (`manejar`) que usan el Worker de Cloudflare, el servidor
// local de desarrollo y la función de Vercel.
//
// Modelo de ejecución (pensado para plataformas sin proceso permanente):
// - El estado de cada sala vive en el almacén. Se guarda con cada acción y, mientras alguien
//   juega, cada 45 segundos.
// - Cada instancia mantiene una copia en memoria para no leer el almacén en cada consulta, y la
//   revalida cada pocos segundos por si otra instancia escribió. En Cloudflare cada sala tiene
//   una única instancia (su Durable Object), así que nunca hay otra que escriba.
// - El paso del tiempo entre guardados se recalcula de forma determinista (`avanzar`).
// - Los clientes consultan el estado dos veces por segundo (`estado`), por WebSocket donde lo
//   hay y por HTTP donde no. En esa consulta envían dónde está su personaje y reciben dónde
//   están los demás.
import crypto from 'node:crypto'
import type { Actividad, DecisionMode, PerfilId, Role, RoomState, Traje, TrayectoriaId, Zona } from '../shared/types.js'
import { almacen } from './almacen.js'
import { responderBot } from './bot.js'
import {
  accion,
  ajustarPlan,
  ajustarCargamento,
  aplicarPreset,
  avanzar,
  cambiarZona,
  crearSala,
  elegirAlternativa,
  elegirEscenario,
  elegirHogar,
  elegirPerfil,
  elegirRol,
  elegirTraje,
  elegirTrayectoria,
  fijarActividad,
  fijarEscala,
  fijarPaso,
  iniciarMision,
  irAyudar,
  jugador,
  lanzar,
  marcarListo,
  nombrarMision,
  nuevoJugador,
  pausar,
  pedirAyuda,
  proponerUbicacion,
  usarRefugio,
  votar,
} from './game.js'
import { log } from './base.js'
import { pasoProcedimiento } from './procedimientos.js'
import { fijarAhora, fijarMovidos } from './reloj.js'
import { agregarBots, posicionesBots, type Andar } from './tripulantes.js'

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
const GUARDAR_MS = 45_000 // punto de guardado periódico mientras alguien juega
const DESCONECTADO_MS = 12_000 // sin consultas durante este tiempo = desconectado
const FANTASMA_LOBBY_MS = 30_000 // en el lobby, quien no consulta en este tiempo libera su rol
const MOVIMIENTO_MS = 30_000 // se considera despierto a quien se movió hace menos de esto
const MAX_JUGADORES = 6

const ok = (cuerpo: unknown): Respuesta => ({ status: 200, json: JSON.stringify(cuerpo) })
const fallo = (status: number, error: string, extra: Record<string, unknown> = {}): Respuesta => ({
  status,
  json: JSON.stringify({ error, ...extra }),
})

// ---------- Cuentas ----------

let secretoFijado = ''
/** Fija el secreto de sesiones cuando no llega por variable de entorno (Cloudflare). */
export function fijarSecreto(s: string) {
  secretoFijado = s
}
function secreto(): string {
  const s = secretoFijado || (typeof process !== 'undefined' ? process.env.AUTH_SECRET : '')
  if (!s) throw new Error('Falta el secreto de sesiones AUTH_SECRET')
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
/** Quién es el dueño de una cabecera de autorización, o null. */
export const usuarioDeToken = (autorizacion: string | undefined) => verificar(autorizacion)

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
  /** Última vez que se comprobó contra el almacén. */
  verificado: number
  /** Última vez (reloj real) que la sala avanzó. Se guarda junto con la sala. */
  visto: number
  guardado: number
}
interface Presencia {
  desde: number
  ultimo: Map<string, number>
  /** Posición de cada personaje: [x, z, giro, animación]. */
  pos: Map<string, number[]>
  movido: Map<string, number>
  /** Dónde se dibuja cada tripulante bot (ver `posicionesBots`). */
  bots: Map<string, Andar>
}
const salas = new Map<string, Entrada>()
const presencias = new Map<string, Presencia>()
const colas = new Map<string, Promise<void>>()

const rutaSala = (codigo: string) => `salas2/${codigo}.json`
const huella = (texto: string) => crypto.createHash('sha1').update(texto).digest('hex').slice(0, 16)
const documento = (visto: number, texto: string) => `{"visto":${visto},"sala":${texto}}`
const SIN_SALA = { sinSala: true }

function presenciaDe(codigo: string): Presencia {
  let p = presencias.get(codigo)
  if (!p) presencias.set(codigo, (p = { desde: Date.now(), ultimo: new Map(), pos: new Map(), movido: new Map(), bots: new Map() }))
  return p
}

/** Posiciones de los demás personajes vistos hace poco, y de los bots, que caminan solos. */
function posiciones(codigo: string, room: RoomState, yo: string, t: number): string {
  const p = presenciaDe(codigo)
  const salida: Record<string, number[]> = room.jugadores.some((j) => j.bot) ? posicionesBots(room, p.bots, t) : {}
  for (const [id, pos] of p.pos) if (id !== yo && t - (p.ultimo.get(id) ?? 0) < 6000) salida[id] = pos
  return JSON.stringify(salida)
}

const respuestaSala = (e: Entrada, texto: string, codigo: string, yo: string, t: number): Respuesta => ({
  status: 200,
  json: `{"sala":${texto},"h":"${huella(texto)}","ahora":${t - e.room.desfase},"pos":${posiciones(codigo, e.room, yo, t)}}`,
})

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
  const doc = JSON.parse(r.texto) as { visto: number; sala: RoomState }
  const nueva: Entrada = { room: doc.sala, etiqueta: r.etiqueta, verificado: t, visto: doc.visto, guardado: doc.visto }
  salas.set(codigo, nueva)
  return nueva
}

/** Marca al usuario como visto y recalcula quién está conectado según las consultas recientes. */
function actualizarPresencia(codigo: string, room: RoomState, usuarioId: string, t: number, pos?: unknown) {
  const p = presenciaDe(codigo)
  p.ultimo.set(usuarioId, t)
  if (Array.isArray(pos) && pos.length >= 3 && pos.length <= 5 && pos.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    const nueva = (pos as number[]).map((v) => Math.round(v * 100) / 100)
    const previa = p.pos.get(usuarioId)
    if (!previa || Math.abs(previa[0] - nueva[0]) + Math.abs(previa[1] - nueva[1]) > 0.05) p.movido.set(usuarioId, t)
    p.pos.set(usuarioId, nueva)
  }
  // Los bots no consultan: siempre están conectados.
  for (const j of room.jugadores) j.conectado = Boolean(j.bot) || t - (p.ultimo.get(j.id) ?? p.desde) < DESCONECTADO_MS
  const despiertos = new Set<string>()
  for (const [id, cuando] of p.movido) if (t - cuando < MOVIMIENTO_MS) despiertos.add(id)
  fijarMovidos(despiertos)
}

/** En el lobby, quien cerró la pestaña deja de ocupar su rol. */
function podarLobby(codigo: string, room: RoomState, t: number) {
  const p = presenciaDe(codigo)
  const antes = room.jugadores.length
  room.jugadores = room.jugadores.filter((j) => j.bot || t - (p.ultimo.get(j.id) ?? p.desde) < FANTASMA_LOBBY_MS)
  const persona = room.jugadores.find((j) => !j.bot)
  if (room.jugadores.length !== antes && !room.jugadores.some((j) => j.id === room.hostId) && persona) {
    room.hostId = persona.id
  }
}

async function guardar(codigo: string, e: Entrada, texto: string, t: number): Promise<boolean> {
  let r: string
  try {
    r = await almacen().escribir(rutaSala(codigo), documento(e.visto, texto), e.etiqueta)
  } catch (err) {
    salas.delete(codigo) // la copia en memoria ya no coincide con lo guardado
    throw err
  }
  if (r === 'conflicto') {
    salas.delete(codigo)
    return false
  }
  e.etiqueta = r
  e.verificado = Date.now()
  e.guardado = t
  return true
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
      avanzar(room, t, e.visto)
      e.visto = t
      if (soloMiembros && !jugador(room, usuario.id)) return fallo(403, 'No formas parte de esa sala.', SIN_SALA)
      const error = fn(room, t - room.desfase)
      if (error) return fallo(400, error)
      room.version += 1
      const texto = JSON.stringify(room)
      if (await guardar(codigo, e, texto, t)) return respuestaSala(e, texto, codigo, usuario.id, t)
    }
    return fallo(409, 'La sala está muy ocupada. Intenta de nuevo.')
  })
}

function consultar(codigo: string, usuario: Usuario, versionCliente: number, huellaCliente: string, pos: unknown): Promise<Respuesta> {
  return enCola(codigo, async () => {
    const e = await obtener(codigo, versionCliente)
    if (!e) return fallo(404, 'Esa sala ya no existe.', SIN_SALA)
    const room = e.room
    if (!jugador(room, usuario.id)) return fallo(403, 'No formas parte de esa sala.', SIN_SALA)
    const t = Date.now()
    actualizarPresencia(codigo, room, usuario.id, t, pos)
    avanzar(room, t, e.visto)
    e.visto = t
    // Punto de guardado: si la instancia se recicla, se pierde como mucho este intervalo.
    if (t - e.guardado > GUARDAR_MS && !['lobby', 'contexto', 'fin'].includes(room.fase)) {
      room.version += 1
      await guardar(codigo, e, JSON.stringify(room), t)
    }
    const texto = JSON.stringify(room)
    if (huella(texto) === huellaCliente) {
      return { status: 200, json: `{"igual":true,"ahora":${t - room.desfase},"pos":${posiciones(codigo, room, usuario.id, t)}}` }
    }
    return respuestaSala(e, texto, codigo, usuario.id, t)
  })
}

const LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Código de sala nuevo: 6 caracteres sin letras ni cifras que se confundan. */
export const codigoAleatorio = () => Array.from(crypto.randomBytes(6), (b) => LETRAS_CODIGO[b % LETRAS_CODIGO.length]).join('')

/**
 * Crea una sala. `codigoFijo` lo pasa quien ya eligió el código porque de él depende dónde se
 * guarda la sala (en Cloudflare, en qué Durable Object); si está en uso responde `codigoEnUso`.
 */
async function crear(usuario: Usuario, modo: DecisionMode, juego: 'solo' | 'multi', codigoFijo?: string): Promise<Respuesta> {
  for (let intento = 0; intento < (codigoFijo ? 1 : 6); intento++) {
    const codigo = codigoFijo ?? codigoAleatorio()
    const t = Date.now()
    fijarAhora(t)
    const room = crearSala(codigo, usuario.id, modo)
    room.modoJuego = juego
    room.jugadores.push(nuevoJugador(usuario.id, usuario.nombre))
    // Un jugador: el resto de la tripulación la ponen los bots desde el principio.
    if (juego === 'solo') agregarBots(room)
    log(room, juego === 'solo' ? `${usuario.nombre} creó la sala con una tripulación de bots.` : `${usuario.nombre} creó la sala.`)
    room.version = 1
    const texto = JSON.stringify(room)
    const r = await almacen().escribir(rutaSala(codigo), documento(t, texto), null)
    if (r === 'conflicto') {
      if (codigoFijo) return fallo(409, 'Ese código de sala ya está en uso.', { codigoEnUso: true })
      continue
    }
    const e: Entrada = { room, etiqueta: r, verificado: t, visto: t, guardado: t }
    salas.set(codigo, e)
    presenciaDe(codigo).ultimo.set(usuario.id, t)
    return respuestaSala(e, texto, codigo, usuario.id, t)
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
      if (room.modoJuego === 'solo') return 'Esa sala es de un solo jugador con bots.'
      if (room.fase !== 'lobby' && room.fase !== 'contexto') return 'Esa misión ya despegó y no formas parte de ella.'
      if (room.jugadores.length >= MAX_JUGADORES) return `La sala está llena (${MAX_JUGADORES} tripulantes).`
      room.jugadores.push(nuevoJugador(usuario.id, usuario.nombre))
      ajustarPlan(room)
      log(room, `${usuario.nombre} se unió a la sala.`)
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
    const p = presenciaDe(codigo)
    p.ultimo.set(usuario.id, 0)
    p.pos.delete(usuario.id)
    // Tras el despegue conserva su puesto y puede volver con el código; antes, deja la sala.
    if (room.fase !== 'lobby' && room.fase !== 'contexto') return ok(SIN_SALA)
    room.jugadores = room.jugadores.filter((j) => j.id !== usuario.id)
    if (!room.jugadores.some((j) => !j.bot)) {
      salas.delete(codigo)
      presencias.delete(codigo)
      await almacen().borrar(rutaSala(codigo))
      return ok(SIN_SALA)
    }
    if (room.hostId === usuario.id) room.hostId = room.jugadores[0].id
    ajustarPlan(room)
    room.version += 1
    await guardar(codigo, e, JSON.stringify(room), Date.now())
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
    avanzar(e.room, t, e.visto)
    e.visto = t
    return ok({ respuesta: responderBot(e.room, j, texto), ahora: t - e.room.desfase })
  })
}

// ---------- Entrada ----------

const texto = (v: unknown, max = 300) => String(v ?? '').trim().slice(0, max)
const objeto = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

export interface OpcionesManejo {
  /** Código para la sala que se va a crear (ver `crear`). Nunca viene del cliente. */
  codigoNuevo?: string
}

async function despachar(c: Record<string, unknown>, autorizacion: string | undefined, opciones: OpcionesManejo): Promise<Respuesta> {
  const op = texto(c.op, 30)
  if (op === 'registro') return registro(texto(c.usuario, 40), String(c.clave ?? ''))
  if (op === 'ingresar') return ingresar(texto(c.usuario, 40), String(c.clave ?? ''))

  const usuario = verificar(autorizacion)
  if (!usuario) return fallo(401, 'Sesión inválida. Vuelve a ingresar.', { sinSesion: true })
  if (op === 'yo') return ok({ usuario })
  if (op === 'crear') return crear(usuario, c.modo === 'votacion' ? 'votacion' : 'comandante', c.juego === 'solo' ? 'solo' : 'multi', opciones.codigoNuevo)

  const codigo = texto(c.codigo, 10).toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(codigo)) return fallo(400, 'El código de sala tiene 6 letras o números.')
  const v = Number.isFinite(Number(c.v)) ? Number(c.v) : 0
  const yo = usuario.id
  const m = (fn: Mutacion) => mutar(codigo, usuario, v, fn)

  switch (op) {
    case 'unirse':
      return unirse(codigo, usuario)
    case 'salir':
      return salir(codigo, usuario)
    case 'estado':
      return consultar(codigo, usuario, v, texto(c.h, 40), c.p)
    case 'bot': {
      const pregunta = texto(c.texto)
      return pregunta ? preguntarBot(codigo, usuario, v, pregunta) : fallo(400, 'Escribe una pregunta.')
    }
    // Lobby y contextualización
    case 'rol':
      return m((room) => elegirRol(room, yo, (c.rol as Role | null) ?? null))
    case 'traje':
      return m((room) => elegirTraje(room, yo, objeto(c.traje) as Partial<Traje>))
    case 'iniciar':
      return m((room) => iniciarMision(room, yo))
    case 'escenario':
      return m((room) => elegirEscenario(room, yo, texto(c.escenario, 20)))
    case 'hogar':
      return m((room) => elegirHogar(room, yo, c.hogar ? texto(c.hogar, 20) : null))
    case 'nombre':
      return m((room) => nombrarMision(room, yo, texto(c.nombre, 60)))
    case 'cargamento':
      return m((room) => ajustarCargamento(room, objeto(c.cambios) as Record<string, number>))
    case 'preset':
      return m((room) => aplicarPreset(room, texto(c.preset, 20)))
    case 'perfil':
      return m((room) => elegirPerfil(room, yo, texto(c.perfil, 20) as PerfilId))
    case 'trayectoria':
      return m((room) => elegirTrayectoria(room, yo, texto(c.trayectoria, 20) as TrayectoriaId))
    case 'paso':
      return m((room) => fijarPaso(room, yo, Number(c.paso)))
    case 'listo':
      return m((room) => marcarListo(room, yo, Boolean(c.listo)))
    case 'lanzar':
      return m((room) => lanzar(room, yo))
    // Tiempo
    case 'escala':
      return m((room) => fijarEscala(room, yo, Number(c.valor)))
    case 'pausa':
      return m((room) => pausar(room, yo, Boolean(c.pausa)))
    // Misión
    case 'ubicacion':
      return m((room) => proponerUbicacion(room, yo, texto(c.sitioId, 20)))
    case 'procedimiento':
      return m((room) => pasoProcedimiento(room, yo, texto(c.proc, 20), Number(c.paso), c.valor))
    case 'zona':
      return m((room) => cambiarZona(room, yo, texto(c.zona, 10) as Zona))
    case 'actividad':
      return m((room) => fijarActividad(room, yo, c.actividad ? (texto(c.actividad, 12) as Actividad) : null))
    case 'refugio':
      return m((room) => usarRefugio(room, yo, Boolean(c.entrar)))
    case 'accion':
      return m((room) => accion(room, yo, texto(c.id, 20), objeto(c.payload)))
    case 'votar':
      return m((room) => votar(room, yo, texto(c.id, 40), Boolean(c.aprueba)))
    case 'emergencia':
      return m((room) => elegirAlternativa(room, yo, texto(c.id, 40), texto(c.altId, 20)))
    case 'ayudaPedir':
      return m((room) => pedirAyuda(room, yo, c.paraRol as Role, texto(c.motivo, 120)))
    case 'ayudaIr':
      return m((room) => irAyudar(room, yo, texto(c.jugadorId, 60)))
    case 'chat': {
      const mensaje = texto(c.texto)
      if (!mensaje) return fallo(400, 'Escribe un mensaje.')
      return m((room, t) => {
        room.chat.push({ id: crypto.randomUUID(), de: usuario.nombre, texto: mensaje, t, bot: false })
        if (room.chat.length > 40) room.chat.splice(0, room.chat.length - 40)
        return null
      })
    }
  }
  return fallo(400, 'Operación desconocida.')
}

export async function manejar(cuerpo: unknown, autorizacion?: string, opciones: OpcionesManejo = {}): Promise<Respuesta> {
  try {
    return await despachar(objeto(cuerpo), autorizacion, opciones)
  } catch (e) {
    console.error('[api]', e)
    return fallo(500, 'Error interno del servidor.')
  }
}
