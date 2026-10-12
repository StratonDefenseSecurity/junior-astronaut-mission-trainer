// Comunicación con el servidor por HTTP. No hay sockets: el cliente consulta el estado de la
// sala dos veces por segundo y envía cada acción como una petición aparte. En cada consulta
// manda dónde está su personaje y recibe dónde están los demás.
import { masaTotal, type Loadout, type RoomState, type Traje } from '@shared/types'
import { local } from './mundo/control'
import { useStore } from './store'

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
    d = (await r.json().catch(() => ({ error: 'Respuesta inválida del servidor.' }))) as Resultado
  } catch {
    useStore.getState().setConectado(false)
    return null
  }
  const st = useStore.getState()
  if (!st.conectado) st.setConectado(true)
  if (typeof d.ahora === 'number') {
    const desfase = d.ahora - Date.now()
    if (Math.abs(desfase - st.desfase) > 250) st.setDesfase(desfase)
  }
  if (d.pos) {
    const t = performance.now()
    for (const [id, p] of Object.entries(d.pos)) ajenos.set(id, { x: p[0], z: p[1], giro: p[2] ?? 0, andando: (p[3] ?? 0) > 0, t })
  }
  if (d.sinSesion) {
    st.setAuth(null, null)
    return d
  }
  if (d.sinSala) {
    const teniaSala = Boolean(st.sala)
    huella = ''
    ajenos.clear()
    st.setSala(null)
    if (d.error && (teniaSala || !silencioso)) st.toast(d.error)
    return d
  }
  if (d.sala && n > aplicada) {
    aplicada = n
    huella = d.h ?? ''
    st.setSala(conCargaPendiente(d.sala))
  }
  if (d.error && !silencioso) st.toast(d.error)
  return d
}

async function sondear() {
  const s = useStore.getState()
  if (!s.token || !s.codigo || consultando) return
  consultando = true
  try {
    const enMundo = s.sala && !['lobby', 'contexto', 'fin'].includes(s.sala.fase)
    const p = enMundo ? [local.x, local.z, local.giro, local.vel > 0.2 ? 1 : 0] : undefined
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
  crearSala: (modo: 'comandante' | 'votacion') => llamar('crear', { modo, codigo: undefined }),
  unirse: (codigo: string) => llamar('unirse', { codigo }),
  salir: () => llamar('salir'),
  // Lobby y contextualización
  elegirRol: (rol: string | null) => llamar('rol', { rol }),
  elegirTraje: (traje: Partial<Traje>) => llamar('traje', { traje }),
  iniciar: () => llamar('iniciar'),
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
  tarea: (tarea: string) => llamar('tarea', { tarea }),
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
