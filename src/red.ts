// Comunicación con el servidor. Cada acción es una petición HTTP. Además, el cliente consulta
// el estado de la sala dos veces por segundo; en cada consulta manda dónde está su personaje y
// recibe dónde están los demás. Esa consulta va por WebSocket cuando el servidor lo ofrece
// (Cloudflare) y por HTTP cuando no (servidor local), con la misma pregunta y la misma respuesta.
import { masaTotal, type Loadout, type RoomState, type Traje } from '@shared/types'
import { local } from './mundo/control'
import { useStore } from './store'
import { voz } from './voz'

interface Resultado {
  sala?: RoomState
  h?: string
  ahora?: number
  igual?: boolean
  pos?: Record<string, number[]>
  error?: string
  sinSala?: boolean
  sinSesion?: boolean
  respuesta?: string
  token?: string
  usuario?: { id: string; nombre: string }
}

export interface PosicionAjena {
  x: number
  z: number
  giro: number
  andando: boolean
  /** Está usando una consola. */
  trabajando: boolean
  /** Momento (reloj local) en que llegó. */
  t: number
}
/** Última posición conocida de los demás personajes. La lee la escena en cada fotograma. */
export const ajenos = new Map<string, PosicionAjena>()

const INTERVALO_MS = 500
let secuencia = 0
let aplicada = 0
let huella = ''
let consultando = false
let temporizador: number | null = null
let cargaPendiente: Partial<Loadout> = {}
let cargaTimer: number | null = null

function conCargaPendiente(sala: RoomState): RoomState {
  if (Object.keys(cargaPendiente).length === 0 || sala.fase !== 'contexto') return sala
  const cargamento = { ...sala.cargamento, ...cargaPendiente } as Loadout
  return { ...sala, cargamento, masa: masaTotal(cargamento) }
}

/** Aplica una respuesta del servidor, venga por HTTP o por WebSocket. `n` ordena las respuestas. */
function aplicar(d: Resultado, n: number, silencioso: boolean) {
  const st = useStore.getState()
  if (!st.conectado) st.setConectado(true)
  if (typeof d.ahora === 'number') {
    const desfase = d.ahora - Date.now()
    if (Math.abs(desfase - st.desfase) > 250) st.setDesfase(desfase)
  }
  if (d.pos) {
    const t = performance.now()
    for (const [id, p] of Object.entries(d.pos)) ajenos.set(id, { x: p[0], z: p[1], giro: p[2] ?? 0, andando: p[3] === 1, trabajando: p[3] === 2, t })
  }
  if (d.sinSesion) {
    cerrarSocket()
    st.setAuth(null, null)
    return
  }
  if (d.sinSala) {
    const teniaSala = Boolean(st.sala)
    huella = ''
    ajenos.clear()
    cerrarSocket()
    st.setSala(null)
    if (d.error && (teniaSala || !silencioso)) st.toast(d.error)
    return
  }
  if (d.sala && n > aplicada) {
    aplicada = n
    huella = d.h ?? ''
    st.setSala(conCargaPendiente(d.sala))
  }
  if (d.error && !silencioso) st.toast(d.error)
}

async function llamar(op: string, datos: Record<string, unknown> = {}, silencioso = false): Promise<Resultado | null> {
  const s = useStore.getState()
  const n = ++secuencia
  let d: Resultado
  try {
    const r = await fetch('/api/juego', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(s.token ? { authorization: `Bearer ${s.token}` } : {}) },
      body: JSON.stringify({ op, codigo: s.codigo ?? undefined, v: s.sala?.version ?? 0, ...datos }),
    })
    if (r.headers.get('x-mt-ws') === '1') socketDisponible = true
    d = (await r.json().catch(() => ({ error: 'Respuesta inválida del servidor.' }))) as Resultado
  } catch {
    useStore.getState().setConectado(false)
    return null
  }
  aplicar(d, n, silencioso)
  return d
}

// ---------- Consulta del estado por WebSocket ----------

/** El servidor anunció (cabecera x-mt-ws) que acepta las consultas por WebSocket. */
let socketDisponible = false
let socket: WebSocket | null = null
let socketCodigo = ''
let socketAbierto = false
/** Consultas enviadas por el WebSocket que aún no tienen respuesta. */
let sinRespuesta: { n: number; t: number }[] = []
/** No se intenta reconectar antes de este instante. */
let socketReintento = 0

function cerrarSocket(esperaMs = 0) {
  const s = socket
  socket = null
  socketAbierto = false
  sinRespuesta = []
  socketReintento = performance.now() + esperaMs
  voz.conectarCanal(useStore.getState().usuario?.id ?? '', null)
  if (!s) return
  s.onopen = s.onmessage = s.onclose = s.onerror = null
  try {
    s.close()
  } catch {
    // ya estaba cerrado
  }
}

/** Devuelve el WebSocket de la sala si ya se puede usar; si no, lo va abriendo. */
function socketDe(codigo: string, token: string): WebSocket | null {
  if (!socketDisponible || typeof WebSocket === 'undefined') return null
  if (socket && socketCodigo !== codigo) cerrarSocket()
  if (socket) return socketAbierto ? socket : null
  if (performance.now() < socketReintento) return null
  const s = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/ws?codigo=${encodeURIComponent(codigo)}`)
  socket = s
  socketCodigo = codigo
  s.onopen = () => {
    if (socket !== s) return
    // La sesión viaja en el primer mensaje, no en la dirección.
    s.send(JSON.stringify({ auth: `Bearer ${token}` }))
    socketAbierto = true
    // El mismo WebSocket sirve para las señales del chat de voz.
    voz.conectarCanal(useStore.getState().usuario?.id ?? '', (para, d) => {
      if (socket === s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify({ senal: { para, d } }))
    })
  }
  s.onmessage = (e) => {
    if (socket !== s || typeof e.data !== 'string') return
    let d: Resultado & { n?: number; senal?: { de: string; d: Parameters<typeof voz.alRecibir>[1] } }
    try {
      d = JSON.parse(e.data) as typeof d
    } catch {
      return
    }
    if (d.senal) {
      void voz.alRecibir(d.senal.de, d.senal.d)
      return
    }
    const n = typeof d.n === 'number' ? d.n : 0
    sinRespuesta = sinRespuesta.filter((p) => p.n > n)
    aplicar(d, n, true)
  }
  s.onclose = s.onerror = () => {
    if (socket === s) cerrarSocket(5000)
  }
  return null
}

async function sondear() {
  const s = useStore.getState()
  if (!s.token || !s.codigo) {
    if (socket) cerrarSocket()
    return
  }
  const enMundo = s.sala && !['lobby', 'contexto', 'fin'].includes(s.sala.fase)
  // El cuarto valor es la animación: 0 quieto, 1 andando, 2 trabajando en una consola.
  const p = enMundo ? [local.x, local.z, local.giro, local.trabajando ? 2 : local.vel > 0.2 ? 1 : 0] : undefined

  const ws = socketDe(s.codigo, s.token)
  if (ws) {
    const t = performance.now()
    if (sinRespuesta.length && t - sinRespuesta[0].t > 5000) {
      // El WebSocket dejó de responder: se cierra y esta consulta sigue por HTTP.
      cerrarSocket(5000)
    } else {
      if (sinRespuesta.length < 2) {
        const n = ++secuencia
        try {
          ws.send(JSON.stringify({ n, v: s.sala?.version ?? 0, h: huella, p }))
          sinRespuesta.push({ n, t })
        } catch {
          cerrarSocket(5000)
        }
      }
      return
    }
  }

  if (consultando) return
  consultando = true
  try {
    await llamar('estado', { h: huella, p }, true)
  } finally {
    consultando = false
  }
}

export function iniciarSondeo() {
  if (temporizador !== null) return
  temporizador = window.setInterval(sondear, INTERVALO_MS)
  void sondear()
}

export const api = {
  crearSala: (modo: 'comandante' | 'votacion', juego: 'solo' | 'multi') => llamar('crear', { modo, juego, codigo: undefined }),
  unirse: (codigo: string) => llamar('unirse', { codigo }),
  salir: () => llamar('salir'),
  // Sala y contextualización
  elegirRol: (rol: string | null) => llamar('rol', { rol }),
  elegirTraje: (traje: Partial<Traje>) => llamar('traje', { traje }),
  iniciar: () => llamar('iniciar'),
  escenario: (escenario: string) => llamar('escenario', { escenario }),
  hogar: (hogar: string | null) => llamar('hogar', { hogar }),
  nombrarMision: (nombre: string) => llamar('nombre', { nombre }),
  /** Los deslizadores cambian muchas veces por segundo: se muestran al instante y se envían agrupados. */
  cargamento: (cambios: Partial<Loadout>) => {
    cargaPendiente = { ...cargaPendiente, ...cambios }
    const s = useStore.getState()
    if (s.sala) useStore.setState({ sala: conCargaPendiente(s.sala) })
    if (cargaTimer !== null) window.clearTimeout(cargaTimer)
    cargaTimer = window.setTimeout(async () => {
      const enviar = cargaPendiente
      cargaTimer = null
      await llamar('cargamento', { cambios: enviar })
      if (cargaTimer === null) cargaPendiente = {}
    }, 350)
  },
  preset: (preset: string) => {
    cargaPendiente = {}
    return llamar('preset', { preset })
  },
  perfil: (perfil: string) => llamar('perfil', { perfil }),
  trayectoria: (trayectoria: string) => llamar('trayectoria', { trayectoria }),
  paso: (paso: number) => llamar('paso', { paso }, true),
  listo: (listo: boolean) => llamar('listo', { listo }),
  lanzar: async () => {
    if (cargaTimer !== null) {
      window.clearTimeout(cargaTimer)
      cargaTimer = null
      await llamar('cargamento', { cambios: cargaPendiente })
      cargaPendiente = {}
    }
    return llamar('lanzar')
  },
  // Misión
  escala: (valor: number) => llamar('escala', { valor }),
  pausa: (pausa: boolean) => llamar('pausa', { pausa }),
  proponerUbicacion: (sitioId: string) => llamar('ubicacion', { sitioId }),
  /** Un paso de un procedimiento (ver shared/procedimientos.ts). Los errores los muestra quien llama. */
  procedimiento: (proc: string, paso: number, valor: unknown) => llamar('procedimiento', { proc, paso, valor }, true),
  zona: (zona: 'nave' | 'exterior') => llamar('zona', { zona }),
  actividad: (actividad: 'ejercicio' | 'sueno' | null) => llamar('actividad', { actividad }),
  refugio: (entrar: boolean) => llamar('refugio', { entrar }),
  accion: (id: string, payload?: Record<string, unknown>) => llamar('accion', { id, payload }),
  votar: (id: string, aprueba: boolean) => llamar('votar', { id, aprueba }),
  elegirAlternativa: (id: string, altId: string) => llamar('emergencia', { id, altId }),
  pedirAyuda: (paraRol: string, motivo: string) => llamar('ayudaPedir', { paraRol, motivo }),
  irAyudar: (jugadorId: string) => llamar('ayudaIr', { jugadorId }),
  chat: (texto: string) => llamar('chat', { texto }),
  /** El asistente responde solo a quien pregunta; su conversación no se guarda en la sala. */
  bot: async (texto: string) => {
    const s = useStore.getState()
    const t = Date.now() + s.desfase
    s.agregarBot({ id: `p${t}`, de: s.usuario?.nombre ?? 'Tú', texto, t, bot: false })
    const d = await llamar('bot', { texto })
    if (d?.respuesta) useStore.getState().agregarBot({ id: `r${t}`, de: 'Asistente', texto: d.respuesta, t: t + 1, bot: true })
  },
}

export async function httpAuth(ruta: 'registro' | 'ingresar', usuario: string, clave: string) {
  const r = await fetch('/api/juego', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op: ruta, usuario, clave }),
  })
  const d = (await r.json().catch(() => ({ error: 'Respuesta inválida del servidor.' }))) as Resultado
  if (!r.ok || !d.token || !d.usuario) throw new Error(d.error ?? 'No se pudo completar.')
  return { token: d.token, usuario: d.usuario }
}
