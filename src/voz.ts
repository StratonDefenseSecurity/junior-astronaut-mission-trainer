// Chat de voz entre la tripulación, como en una nave de verdad:
// - Dentro de la nave o del hábitat la voz es espacial: se oye más fuerte a quien está cerca y
//   desde el lado en que está. La mesa común es el sitio natural para reunirse a hablar.
// - Si alguien está fuera con el traje, se habla por radio: sin distancia, con el sonido
//   recortado de una radio y los tonos que usaba la NASA para abrir y cerrar cada transmisión.
//
// Técnica: WebRTC de igual a igual (cada jugador con cada uno, hasta 6), con el Durable Object de
// la sala como intermediario para las señales de conexión (por el mismo WebSocket del estado).
// Sin servidor TURN: en algunas redes muy cerradas la voz no llega a conectar. Entonces se
// reintenta unas veces y, si no, se avisa de que use el chat de texto.
//
// Modos: micrófono siempre abierto, o pulsar para hablar (tecla V). Se mide el nivel del
// micrófono propio y de cada compañero para mostrar quién habla.
import { useSyncExternalStore } from 'react'
import { sonido } from './sonido'

type Senal = { tipo: 'hola' | 'oferta' | 'respuesta' | 'ice' | 'adios'; datos?: unknown }

export type EstadoPar = 'conectando' | 'conectado' | 'reintentando' | 'fallo'
export type ModoVoz = 'abierto' | 'pulsar'

interface Par {
  pc: RTCPeerConnection
  /** Elemento de audio mudo: Chrome no entrega audio remoto a Web Audio si no se reproduce también así. */
  audio?: HTMLAudioElement
  fuente?: MediaStreamAudioSourceNode
  panner?: PannerNode
  radio?: BiquadFilterNode
  ganancia?: GainNode
  analizador?: AnalyserNode
  hablando: boolean
  /** Desde cuándo (performance.now) está sin conectar. */
  desde: number
}

const ICE: RTCIceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }]
/** Esperas antes de cada reintento con un compañero, en ms. Después se da por perdido. */
const REINTENTOS_MS = [2000, 5000, 10000]
/** Tiempo máximo para conectar con un compañero antes de reintentar. */
const LIMITE_CONEXION_MS = 15000
const UMBRAL_HABLA = 0.04
const CLAVE_MODO = 'mt-voz-modo'

export interface EstadoVoz {
  disponible: boolean
  activa: boolean
  microfono: 'si' | 'no' | 'denegado' | 'sin-dispositivo'
  silenciado: boolean
  conectados: number
  error: string | null
  modo: ModoVoz
  /** Con pulsar para hablar: la tecla está pulsada. */
  transmitiendo: boolean
  /** Nivel del micrófono propio, de 0 a 1. */
  nivel: number
  /** Probando el micrófono sin unirse a la voz. */
  probando: boolean
  /** Se perdió el canal de señales y se volverá a entrar cuando vuelva. */
  reconectando: boolean
  /** Quién habla ahora (identificadores). */
  hablan: string[]
  /** Estado de la conexión con cada compañero. */
  pares: Record<string, EstadoPar>
}

function modoGuardado(): ModoVoz {
  try {
    return localStorage.getItem(CLAVE_MODO) === 'pulsar' ? 'pulsar' : 'abierto'
  } catch {
    return 'abierto'
  }
}

function escribiendo(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))
}

class Voz {
  private estadoActual: EstadoVoz = {
    disponible: false,
    activa: false,
    microfono: 'no',
    silenciado: false,
    conectados: 0,
    error: null,
    modo: modoGuardado(),
    transmitiendo: false,
    nivel: 0,
    probando: false,
    reconectando: false,
    hablan: [],
    pares: {},
  }
  private oyentes = new Set<() => void>()
  private pares = new Map<string, Par>()
  private reintentos = new Map<string, { n: number; timer: number | null }>()
  private microfono: MediaStream | null = null
  private enviar: ((para: string, d: Senal) => void) | null = null
  private yo = ''
  private hablandoYo = false
  private analizadorYo: AnalyserNode | null = null
  private fuenteYo: MediaStreamAudioSourceNode | null = null
  private buffer = new Uint8Array(256)
  private medidor: number | null = null
  private finPrueba: number | null = null
  /** El jugador quiere estar en la voz (para volver a entrar si se corta el canal). */
  private deseada = false

  constructor() {
    if (typeof window === 'undefined') return
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyV' || e.repeat || escribiendo(e)) return
      if (this.estadoActual.modo === 'pulsar' && this.microfono) this.pulsar(true)
    })
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyV') this.pulsar(false)
    })
    window.addEventListener('blur', () => this.pulsar(false))
  }

  // ---------- estado para React ----------
  estado = () => this.estadoActual
  suscribir = (fn: () => void) => {
    this.oyentes.add(fn)
    return () => this.oyentes.delete(fn)
  }
  private fijar(cambios: Partial<EstadoVoz>) {
    this.estadoActual = { ...this.estadoActual, ...cambios }
    for (const fn of this.oyentes) fn()
  }
  private fijarPar(id: string, e: EstadoPar | null) {
    const pares = { ...this.estadoActual.pares }
    if (e) pares[id] = e
    else delete pares[id]
    if (this.estadoActual.pares[id] === (e ?? undefined)) return
    this.fijar({ pares, conectados: Object.values(pares).filter((x) => x === 'conectado').length })
  }

  /** La capa de red avisa si hay un canal para las señales (WebSocket) y quién soy. */
  conectarCanal(yo: string, enviar: ((para: string, d: Senal) => void) | null) {
    this.yo = yo
    this.enviar = enviar
    if (!enviar && this.estadoActual.activa) {
      // Se cortó el canal: se cierran las conexiones pero se guarda el micrófono para volver.
      this.cerrarTodo(false)
      this.fijar({ activa: false, reconectando: this.deseada })
    }
    if (Boolean(enviar) !== this.estadoActual.disponible) this.fijar({ disponible: Boolean(enviar) })
    if (enviar && this.deseada && !this.estadoActual.activa) void this.activar()
  }

  private async abrirMicrofono(): Promise<boolean> {
    if (this.microfono) return true
    await sonido.activar()
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fijar({ microfono: 'sin-dispositivo', error: 'This browser cannot use a microphone here. You can still listen.' })
      return false
    }
    try {
      this.microfono = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      const ctx = sonido.contexto()
      if (ctx) {
        this.analizadorYo = ctx.createAnalyser()
        this.analizadorYo.fftSize = 512
        this.fuenteYo = ctx.createMediaStreamSource(this.microfono)
        this.fuenteYo.connect(this.analizadorYo)
      }
      this.aplicarMicrofono()
      this.fijar({ microfono: 'si', error: null })
      this.medir()
      return true
    } catch (e) {
      this.microfono = null
      const nombre = (e as DOMException)?.name
      if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
        this.fijar({ microfono: 'sin-dispositivo', error: 'No microphone found. You can still listen to the crew.' })
      } else if (nombre === 'NotReadableError') {
        this.fijar({ microfono: 'sin-dispositivo', error: 'Another app is using your microphone. Close it and try again.' })
      } else {
        this.fijar({ microfono: 'denegado', error: 'Microphone permission denied. Allow it in the browser address bar, then try again. You can still listen.' })
      }
      return false
    }
  }

  private cerrarMicrofono() {
    this.microfono?.getTracks().forEach((t) => t.stop())
    this.microfono = null
    this.fuenteYo?.disconnect()
    this.fuenteYo = null
    this.analizadorYo = null
    this.hablandoYo = false
  }

  async activar() {
    this.deseada = true
    if (!this.enviar) {
      this.fijar({ reconectando: true })
      return
    }
    if (this.estadoActual.activa) return
    this.terminarPrueba(false)
    await this.abrirMicrofono()
    if (!this.enviar) return
    this.fijar({ activa: true, reconectando: false })
    this.enviar('*', { tipo: 'hola' })
    this.medir()
  }

  desactivar() {
    this.deseada = false
    this.cerrarTodo(true)
    this.cerrarMicrofono()
    this.fijar({ activa: false, reconectando: false, conectados: 0, microfono: 'no', pares: {}, hablan: [], nivel: 0, transmitiendo: false, error: null })
  }

  private cerrarTodo(avisar: boolean) {
    for (const r of this.reintentos.values()) if (r.timer !== null) window.clearTimeout(r.timer)
    this.reintentos.clear()
    for (const id of [...this.pares.keys()]) this.cerrarPar(id, avisar)
    this.fijar({ pares: {}, conectados: 0, hablan: [] })
  }

  silenciar(b: boolean) {
    this.fijar({ silenciado: b })
    this.aplicarMicrofono()
  }

  /** Siempre abierto o pulsar para hablar (V). */
  cambiarModo(modo: ModoVoz) {
    try {
      localStorage.setItem(CLAVE_MODO, modo)
    } catch {
      // sin almacenamiento: solo dura esta sesión
    }
    this.fijar({ modo, transmitiendo: false })
    this.aplicarMicrofono()
  }

  private pulsar(si: boolean) {
    if (this.estadoActual.transmitiendo === si) return
    this.fijar({ transmitiendo: si })
    this.aplicarMicrofono()
  }

  /** La pista del micrófono suena si no está silenciado y, con pulsar para hablar, si se pulsa V. */
  private aplicarMicrofono() {
    const e = this.estadoActual
    const abierto = !e.silenciado && (e.modo === 'abierto' || e.transmitiendo)
    this.microfono?.getAudioTracks().forEach((t) => (t.enabled = abierto || e.probando))
  }

  /** Prueba el micrófono unos segundos sin unirse a la voz: se ve el nivel al hablar. */
  async probar() {
    if (this.estadoActual.activa) return
    this.fijar({ probando: true })
    this.aplicarMicrofono()
    const ok = await this.abrirMicrofono()
    if (!ok) {
      this.fijar({ probando: false })
      return
    }
    this.aplicarMicrofono()
    if (this.finPrueba !== null) window.clearTimeout(this.finPrueba)
    this.finPrueba = window.setTimeout(() => this.terminarPrueba(true), 8000)
  }

  private terminarPrueba(cerrar: boolean) {
    if (this.finPrueba !== null) window.clearTimeout(this.finPrueba)
    this.finPrueba = null
    if (!this.estadoActual.probando) return
    if (cerrar && !this.estadoActual.activa) {
      this.cerrarMicrofono()
      this.fijar({ microfono: 'no', nivel: 0 })
    }
    this.fijar({ probando: false })
    this.aplicarMicrofono()
  }

  /** Mensaje de señalización que llega de otro jugador. */
  async alRecibir(de: string, d: Senal) {
    if (!this.estadoActual.activa || !this.enviar || de === this.yo) return
    try {
      if (d.tipo === 'hola') {
        // Un saludo de alguien con quien la conexión se rompió: se empieza de cero.
        const viejo = this.pares.get(de)
        if (viejo && ['failed', 'closed', 'disconnected'].includes(viejo.pc.connectionState)) this.cerrarPar(de, false)
        const nuevo = !this.pares.has(de)
        const par = this.par(de)
        // Ofrece quien tiene el identificador menor; el otro responde al saludo para que empiece.
        if (this.yo < de) await this.ofrecer(de, par)
        else if (nuevo) this.enviar(de, { tipo: 'hola' })
      } else if (d.tipo === 'oferta') {
        const viejo = this.pares.get(de)
        if (viejo && ['failed', 'closed'].includes(viejo.pc.connectionState)) this.cerrarPar(de, false)
        const par = this.par(de)
        await par.pc.setRemoteDescription(d.datos as RTCSessionDescriptionInit)
        await par.pc.setLocalDescription(await par.pc.createAnswer())
        this.enviar(de, { tipo: 'respuesta', datos: par.pc.localDescription?.toJSON() })
      } else if (d.tipo === 'respuesta') {
        await this.pares.get(de)?.pc.setRemoteDescription(d.datos as RTCSessionDescriptionInit)
      } else if (d.tipo === 'ice') {
        await this.pares.get(de)?.pc.addIceCandidate(d.datos as RTCIceCandidateInit)
      } else if (d.tipo === 'adios') {
        this.cerrarPar(de, false)
        this.olvidar(de)
      }
    } catch (e) {
      console.warn('[voz]', e)
      this.fallo(de)
    }
  }

  private par(id: string): Par {
    const existente = this.pares.get(id)
    if (existente) return existente
    const pc = new RTCPeerConnection({ iceServers: ICE })
    const par: Par = { pc, hablando: false, desde: performance.now() }
    this.pares.set(id, par)
    this.fijarPar(id, this.reintentos.has(id) ? 'reintentando' : 'conectando')
    if (this.microfono) for (const t of this.microfono.getTracks()) pc.addTrack(t, this.microfono)
    else pc.addTransceiver('audio', { direction: 'recvonly' })
    pc.onicecandidate = (e) => e.candidate && this.enviar?.(id, { tipo: 'ice', datos: e.candidate.toJSON() })
    pc.ontrack = (e) => this.conectarAudio(par, e.streams[0] ?? new MediaStream([e.track]))
    pc.onconnectionstatechange = () => {
      if (this.pares.get(id) !== par) return
      const s = pc.connectionState
      if (s === 'connected') {
        this.reintentos.delete(id)
        this.fijarPar(id, 'conectado')
      } else if (s === 'failed') this.fallo(id)
      else if (s === 'disconnected') par.desde = performance.now()
    }
    return par
  }

  /** La conexión con un compañero falló: se reintenta con espera creciente y luego se avisa. */
  private fallo(id: string) {
    this.cerrarPar(id, false)
    if (!this.estadoActual.activa) return
    const r = this.reintentos.get(id) ?? { n: 0, timer: null }
    if (r.timer !== null) return
    if (r.n >= REINTENTOS_MS.length) {
      this.fijarPar(id, 'fallo')
      return
    }
    this.fijarPar(id, 'reintentando')
    r.timer = window.setTimeout(() => {
      r.timer = null
      r.n++
      if (!this.estadoActual.activa || !this.enviar) return
      this.enviar(id, { tipo: 'hola' })
      // Si ni siquiera contesta al saludo, cuenta como otro fallo.
      window.setTimeout(() => {
        if (this.estadoActual.activa && !this.pares.has(id) && this.estadoActual.pares[id] === 'reintentando') this.fallo(id)
      }, LIMITE_CONEXION_MS)
    }, REINTENTOS_MS[r.n])
    this.reintentos.set(id, r)
  }

  /** Vuelve a intentar con todos los que fallaron (botón "Try again"). */
  reintentar() {
    for (const [id, e] of Object.entries(this.estadoActual.pares)) {
      if (e !== 'fallo') continue
      this.reintentos.delete(id)
      this.fijarPar(id, 'reintentando')
    }
    if (this.estadoActual.activa && this.enviar) this.enviar('*', { tipo: 'hola' })
  }

  private olvidar(id: string) {
    const r = this.reintentos.get(id)
    if (r?.timer) window.clearTimeout(r.timer)
    this.reintentos.delete(id)
    this.fijarPar(id, null)
  }

  private async ofrecer(id: string, par: Par) {
    await par.pc.setLocalDescription(await par.pc.createOffer())
    this.enviar?.(id, { tipo: 'oferta', datos: par.pc.localDescription?.toJSON() })
  }

  private conectarAudio(par: Par, stream: MediaStream) {
    const ctx = sonido.contexto()
    const destino = sonido.destinoVoces()
    par.audio = new Audio()
    par.audio.srcObject = stream
    par.audio.muted = Boolean(ctx && destino)
    void par.audio.play().catch(() => undefined)
    if (!ctx || !destino) return
    par.fuente = ctx.createMediaStreamSource(stream)
    par.analizador = ctx.createAnalyser()
    par.analizador.fftSize = 512
    par.panner = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1.5, rolloffFactor: 1.3, maxDistance: 30 })
    par.radio = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 1700, Q: 0.9 })
    par.ganancia = ctx.createGain()
    par.fuente.connect(par.analizador)
    par.fuente.connect(par.panner).connect(par.ganancia).connect(destino)
  }

  private cerrarPar(id: string, avisar: boolean) {
    const par = this.pares.get(id)
    if (!par) return
    if (avisar) this.enviar?.(id, { tipo: 'adios' })
    this.pares.delete(id)
    par.pc.onconnectionstatechange = null
    par.pc.close()
    par.audio?.pause()
    par.fuente?.disconnect()
    par.panner?.disconnect()
    par.radio?.disconnect()
    par.ganancia?.disconnect()
  }

  private nivelDe(a: AnalyserNode | null | undefined): number {
    if (!a) return 0
    a.getByteTimeDomainData(this.buffer)
    let suma = 0
    for (let i = 0; i < this.buffer.length; i++) {
      const v = (this.buffer[i] - 128) / 128
      suma += v * v
    }
    return Math.sqrt(suma / this.buffer.length)
  }

  /** Mide niveles (quién habla) y vigila conexiones atascadas, unas 7 veces por segundo. */
  private medir() {
    if (this.medidor !== null) return
    this.medidor = window.setInterval(() => {
      const e = this.estadoActual
      if (!e.activa && !e.probando && !this.microfono) {
        window.clearInterval(this.medidor!)
        this.medidor = null
        return
      }
      const crudo = this.nivelDe(this.analizadorYo)
      const abierto = !e.silenciado && (e.modo === 'abierto' || e.transmitiendo || e.probando)
      this.hablandoYo = abierto && crudo > UMBRAL_HABLA
      const hablan: string[] = this.hablandoYo && e.activa ? [this.yo] : []
      const ahora = performance.now()
      for (const [id, par] of this.pares) {
        par.hablando = this.nivelDe(par.analizador) > UMBRAL_HABLA
        if (par.hablando) hablan.push(id)
        const s = par.pc.connectionState
        if (s !== 'connected' && ahora - par.desde > (s === 'disconnected' ? 6000 : LIMITE_CONEXION_MS)) this.fallo(id)
      }
      // El medidor se escala para que la voz normal llene más o menos la barra.
      const nivel = Math.round(Math.min(1, crudo * 6) * 20) / 20
      const cambiaHablan = hablan.length !== e.hablan.length || hablan.some((x, i) => x !== e.hablan[i])
      if (nivel !== e.nivel || cambiaHablan) this.fijar({ nivel, hablan: cambiaHablan ? hablan : e.hablan })
    }, 140)
  }

  /**
   * Se llama en cada cuadro con la cámara (oído) y dónde está cada compañero. Coloca cada voz en
   * su sitio, o la pasa por "radio" si alguno de los dos está fuera.
   */
  actualizar(oido: { x: number; y: number; z: number; adelante: { x: number; y: number; z: number } }, fuera: boolean, otros: Map<string, { x: number; z: number; fuera: boolean }>) {
    const ctx = sonido.contexto()
    if (!ctx || !this.estadoActual.activa) return
    const l = ctx.listener
    if (l.positionX) {
      l.positionX.value = oido.x
      l.positionY.value = oido.y
      l.positionZ.value = oido.z
      l.forwardX.value = oido.adelante.x
      l.forwardY.value = oido.adelante.y
      l.forwardZ.value = oido.adelante.z
    }
    for (const [id, par] of this.pares) {
      if (!par.panner || !par.ganancia || !par.fuente || !par.radio) continue
      const o = otros.get(id)
      const porRadio = fuera || !o || o.fuera
      if (porRadio) {
        par.panner.positionX.value = oido.x + oido.adelante.x
        par.panner.positionY.value = oido.y
        par.panner.positionZ.value = oido.z + oido.adelante.z
      } else {
        par.panner.positionX.value = o.x
        par.panner.positionY.value = 1.6
        par.panner.positionZ.value = o.z
      }
      // Cambia entre voz directa y radio reconectando el filtro solo cuando hace falta.
      const conRadio = par.ganancia.gain.value !== 1
      if (porRadio && !conRadio) {
        par.panner.disconnect()
        par.panner.connect(par.radio).connect(par.ganancia)
        par.ganancia.gain.value = 1.0001
      } else if (!porRadio && conRadio) {
        par.panner.disconnect()
        par.radio.disconnect()
        par.panner.connect(par.ganancia)
        par.ganancia.gain.value = 1
      }
    }
  }

  hablando(id: string): boolean {
    return id === this.yo ? this.hablandoYo : Boolean(this.pares.get(id)?.hablando)
  }
}

export const voz = new Voz()

export function useVoz(): EstadoVoz {
  return useSyncExternalStore(voz.suscribir, voz.estado, voz.estado)
}
