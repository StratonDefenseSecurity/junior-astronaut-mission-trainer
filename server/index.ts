import express from 'express'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import type { DecisionMode, Role, RoomState } from '../shared/types.js'
import {
  accion,
  ajustarCargamento,
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
  tick,
  votar,
} from './game.js'
import { responderBot } from './bot.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const SECRET_FILE = path.join(DATA_DIR, 'secret.txt')
fs.mkdirSync(DATA_DIR, { recursive: true })

// ---------- Cuentas (archivo JSON, suficiente para un hackathon) ----------
interface User { id: string; usuario: string; salt: string; hash: string; creado: number }
let users: User[] = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) : []
const saveUsers = () => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
const secret = fs.existsSync(SECRET_FILE) ? fs.readFileSync(SECRET_FILE, 'utf8') : (() => {
  const s = crypto.randomBytes(32).toString('hex')
  fs.writeFileSync(SECRET_FILE, s)
  return s
})()
const hashPw = (pw: string, salt: string) => crypto.scryptSync(pw, salt, 32).toString('hex')
const firmar = (userId: string) => `${userId}.${crypto.createHmac('sha256', secret).update(userId).digest('hex')}`
const verificar = (token: unknown): User | null => {
  if (typeof token !== 'string') return null
  const [id, sig] = token.split('.')
  if (!id || !sig) return null
  const u = users.find((x) => x.id === id)
  if (!u) return null
  const esperado = crypto.createHmac('sha256', secret).update(id).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado)) ? u : null
}

const app = express()
app.use(express.json())

app.post('/api/registro', (req, res) => {
  const usuario = String(req.body?.usuario ?? '').trim()
  const clave = String(req.body?.clave ?? '')
  if (!/^[\wáéíóúñÁÉÍÓÚÑ.-]{3,20}$/.test(usuario)) return res.status(400).json({ error: 'Usuario de 3 a 20 caracteres, sin espacios.' })
  if (clave.length < 4) return res.status(400).json({ error: 'La clave necesita al menos 4 caracteres.' })
  if (users.some((u) => u.usuario.toLowerCase() === usuario.toLowerCase())) return res.status(409).json({ error: 'Ese usuario ya existe.' })
  const salt = crypto.randomBytes(8).toString('hex')
  const u: User = { id: crypto.randomUUID(), usuario, salt, hash: hashPw(clave, salt), creado: Date.now() }
  users.push(u)
  saveUsers()
  res.json({ token: firmar(u.id), usuario: { id: u.id, nombre: u.usuario } })
})

app.post('/api/ingresar', (req, res) => {
  const usuario = String(req.body?.usuario ?? '').trim()
  const clave = String(req.body?.clave ?? '')
  const u = users.find((x) => x.usuario.toLowerCase() === usuario.toLowerCase())
  if (!u || hashPw(clave, u.salt) !== u.hash) return res.status(401).json({ error: 'Usuario o clave incorrectos.' })
  res.json({ token: firmar(u.id), usuario: { id: u.id, nombre: u.usuario } })
})

app.get('/api/yo', (req, res) => {
  const u = verificar(req.headers.authorization?.replace('Bearer ', ''))
  if (!u) return res.status(401).json({ error: 'Sesión inválida.' })
  res.json({ usuario: { id: u.id, nombre: u.usuario } })
})

// ---------- Salas ----------
const rooms = new Map<string, RoomState>()
const codigoNuevo = () => {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  do c = Array.from({ length: 6 }, () => letras[Math.floor(Math.random() * letras.length)]).join('')
  while (rooms.has(c))
  return c
}

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

io.use((socket, next) => {
  const u = verificar(socket.handshake.auth?.token)
  if (!u) return next(new Error('no autorizado'))
  socket.data.user = { id: u.id, nombre: u.usuario }
  next()
})

const emitir = (room: RoomState) => io.to(room.codigo).emit('sala:estado', room)

io.on('connection', (socket) => {
  const user = socket.data.user as { id: string; nombre: string }
  let salaActual: RoomState | null = null

  const fallo = (msg: string | null) => {
    if (msg) socket.emit('error:accion', msg)
    else if (salaActual) emitir(salaActual)
  }

  const entrar = (room: RoomState) => {
    salaActual = room
    let j = jugador(room, user.id)
    if (!j) {
      j = nuevoJugador(user.id, user.nombre)
      room.jugadores.push(j)
      log(room, `${user.nombre} se unió a la sala.`, 'info')
    } else {
      j.conectado = true
      j.nombre = user.nombre
      log(room, `${user.nombre} se reconectó.`, 'info')
    }
    socket.join(room.codigo)
    emitir(room)
  }

  socket.on('sala:crear', ({ modo }: { modo: DecisionMode }) => {
    const room = crearSala(codigoNuevo(), user.id, modo === 'votacion' ? 'votacion' : 'comandante')
    rooms.set(room.codigo, room)
    entrar(room)
  })

  socket.on('sala:unirse', ({ codigo }: { codigo: string }) => {
    const room = rooms.get(String(codigo ?? '').toUpperCase().trim())
    if (!room) return socket.emit('error:accion', 'No existe una sala con ese código.')
    if (room.fase !== 'lobby' && !jugador(room, user.id)) return socket.emit('error:accion', 'Esa misión ya empezó y no formas parte de ella.')
    entrar(room)
  })

  socket.on('sala:salir', () => {
    if (!salaActual) return
    const room = salaActual
    const j = jugador(room, user.id)
    if (room.fase === 'lobby') room.jugadores = room.jugadores.filter((x) => x.id !== user.id)
    else if (j) j.conectado = false
    socket.leave(room.codigo)
    salaActual = null
    if (room.jugadores.length === 0) rooms.delete(room.codigo)
    else emitir(room)
    socket.emit('sala:estado', null)
  })

  socket.on('lobby:rol', ({ rol }: { rol: Role | null }) => salaActual && fallo(elegirRol(salaActual, user.id, rol)))
  socket.on('lobby:iniciar', () => salaActual && fallo(iniciarMision(salaActual, user.id)))
  socket.on('contexto:cargamento', (patch: Record<string, number>) => salaActual && fallo(ajustarCargamento(salaActual, patch)))
  socket.on('contexto:lanzar', () => salaActual && fallo(lanzar(salaActual, user.id)))
  socket.on('ensamblaje:confirmar', ({ paso }: { paso: number }) => salaActual && fallo(confirmarPaso(salaActual, user.id, paso)))
  socket.on('ensamblaje:ubicacion', ({ sitioId }: { sitioId: string }) => salaActual && fallo(proponerUbicacion(salaActual, user.id, sitioId)))
  socket.on('accion', ({ id, payload }: { id: string; payload?: Record<string, unknown> }) => salaActual && fallo(accion(salaActual, user.id, id, payload ?? {})))
  socket.on('propuesta:votar', ({ id, aprueba }: { id: string; aprueba: boolean }) => salaActual && fallo(votar(salaActual, user.id, id, Boolean(aprueba))))
  socket.on('emergencia:elegir', ({ id, altId }: { id: string; altId: string }) => salaActual && fallo(elegirAlternativa(salaActual, user.id, id, altId)))
  socket.on('ayuda:pedir', ({ paraRol, motivo }: { paraRol: Role; motivo: string }) => salaActual && fallo(pedirAyuda(salaActual, user.id, paraRol, String(motivo ?? ''))))
  socket.on('ayuda:ir', ({ jugadorId }: { jugadorId: string }) => salaActual && fallo(irAyudar(salaActual, user.id, jugadorId)))

  socket.on('chat:enviar', ({ texto }: { texto: string }) => {
    if (!salaActual) return
    const room = salaActual
    const limpio = String(texto ?? '').trim().slice(0, 300)
    if (!limpio) return
    room.chat.push({ id: crypto.randomUUID(), de: user.nombre, texto: limpio, t: Date.now(), bot: false })
    if (room.chat.length > 60) room.chat.shift()
    emitir(room)
  })

  socket.on('bot:preguntar', ({ texto }: { texto: string }) => {
    if (!salaActual) return
    const room = salaActual
    const j = jugador(room, user.id)
    const limpio = String(texto ?? '').trim().slice(0, 300)
    if (!j || !limpio) return
    room.chat.push({ id: crypto.randomUUID(), de: user.nombre, texto: limpio, t: Date.now(), bot: false })
    room.chat.push({ id: crypto.randomUUID(), de: 'Asistente', texto: responderBot(room, j, limpio), t: Date.now(), bot: true })
    if (room.chat.length > 60) room.chat.splice(0, room.chat.length - 60)
    emitir(room)
  })

  socket.on('disconnect', () => {
    if (!salaActual) return
    const room = salaActual
    const j = jugador(room, user.id)
    if (j) {
      j.conectado = false
      log(room, `${user.nombre} se desconectó.`, 'alerta')
    }
    if (room.fase === 'lobby') room.jugadores = room.jugadores.filter((x) => x.id !== user.id)
    if (room.jugadores.length === 0) rooms.delete(room.codigo)
    else emitir(room)
  })
})

// bucle de simulación: cada 500 ms revisa todas las salas
setInterval(() => {
  for (const room of rooms.values()) {
    const antes = JSON.stringify([room.fase, room.mision.hora, room.mision.diasTransito, room.propuestas.map((p) => p.estado), room.emergencias.map((e) => e.estado), room.resultado])
    tick(room)
    const despues = JSON.stringify([room.fase, room.mision.hora, room.mision.diasTransito, room.propuestas.map((p) => p.estado), room.emergencias.map((e) => e.estado), room.resultado])
    if (antes !== despues) emitir(room)
  }
}, 500)

// producción: servir el cliente compilado
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist')
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

// En desarrollo Vite usa PORT (5173); el servidor de juego usa SERVER_PORT o 3001.
// En producción un solo proceso sirve todo y toma PORT del hosting.
const PORT = Number(process.env.SERVER_PORT ?? (process.env.NODE_ENV === 'production' ? process.env.PORT : undefined) ?? 3001)
server.listen(PORT, () => console.log(`Mission Trainer servidor en http://localhost:${PORT}`))
