// Chat de voz entre la tripulación, como en una nave de verdad:
// - Dentro de la nave o del hábitat la voz es espacial: se oye más fuerte a quien está cerca y
//   desde el lado en que está. La mesa común es el sitio natural para reunirse a hablar.
// - Si alguien está fuera con el traje, se habla por radio: sin distancia, con el sonido
//   recortado de una radio y los tonos que usaba la NASA para abrir y cerrar cada transmisión.
//
// Técnica: WebRTC de igual a igual (cada jugador con cada uno, hasta 6), con el Durable Object de
// la sala como intermediario para las señales de conexión (por el mismo WebSocket del estado).
// Sin servidor TURN: en algunas redes muy cerradas la voz no llega a conectar.
import { useSyncExternalStore } from 'react'
import { sonido } from './sonido'

type Senal = { tipo: 'hola' | 'oferta' | 'respuesta' | 'ice' | 'adios'; datos?: unknown }

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
}

const ICE: RTCIceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }]

export interface EstadoVoz {
  disponible: boolean
  activa: boolean
  microfono: 'si' | 'no' | 'denegado'
  silenciado: boolean
  conectados: number
  error: string | null
}

class Voz {
  private estadoActual: EstadoVoz = { disponible: false, activa: false, microfono: 'no', silenciado: false, conectados: 0, error: null }
  private oyentes = new Set<() => void>()
  private pares = new Map<string, Par>()
  private microfono: MediaStream | null = null
  private enviar: ((para: string, d: Senal) => void) | null = null
  private yo = ''
  private hablandoYo = false
  private analizadorYo: AnalyserNode | null = null
  private buffer = new Uint8Array(256)

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

  /** La capa de red avisa si hay un canal para las señales (WebSocket) y quién soy. */
  conectarCanal(yo: string, enviar: ((para: string, d: Senal) => void) | null) {
    this.yo = yo
    this.enviar = enviar
    if (!enviar && this.estadoActual.activa) this.desactivar()
    if (Boolean(enviar) !== this.estadoActual.disponible) this.fijar({ disponible: Boolean(enviar) })
  }

  async activar() {
    if (!this.enviar || this.estadoActual.activa) return
    await sonido.activar()
    try {
      this.microfono = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      const ctx = sonido.contexto()
      if (ctx) {
        this.analizadorYo = ctx.createAnalyser()
        this.analizadorYo.fftSize = 512
        ctx.createMediaStreamSource(this.microfono).connect(this.analizadorYo)
      }
      this.fijar({ microfono: 'si' })
    } catch {
      // Sin micrófono se puede escuchar igual.
      this.microfono = null
      this.fijar({ microfono: 'denegado' })
    }
    this.fijar({ activa: true, error: null })
    this.enviar('*', { tipo: 'hola' })
  }

  desactivar() {
    for (const id of [...this.pares.keys()]) this.cerrarPar(id, true)
    this.microfono?.getTracks().forEach((t) => t.stop())
    this.microfono = null
    this.analizadorYo = null
    this.fijar({ activa: false, conectados: 0, microfono: 'no' })
  }

  silenciar(b: boolean) {
    this.microfono?.getAudioTracks().forEach((t) => (t.enabled = !b))
    this.fijar({ silenciado: b })
  }

  /** Mensaje de señalización que llega de otro jugador. */
  async alRecibir(de: string, d: Senal) {
    if (!this.estadoActual.activa || !this.enviar || de === this.yo) return
    try {
      if (d.tipo === 'hola') {
        const nuevo = !this.pares.has(de)
        const par = this.par(de)
        // Ofrece quien tiene el identificador menor; el otro responde al saludo para que empiece.
        if (this.yo < de) await this.ofrecer(de, par)
        else if (nuevo) this.enviar(de, { tipo: 'hola' })
      } else if (d.tipo === 'oferta') {
        const par = this.par(de)
        await par.pc.setRemoteDescription(d.datos as RTCSessionDescriptionInit)
        await par.pc.setLocalDescription(await par.pc.createAnswer())
        this.enviar(de, { tipo: 'respuesta', datos: par.pc.localDescription?.toJSON() })
      } else if (d.tipo === 'respuesta') {
        await this.pares.get(de)?.pc.setRemoteDescription(d.datos as RTCSessionDescriptionInit)
      } else if (d.tipo === 'ice') {
        await this.pares.get(de)?.pc.addIceCandidate(d.datos as RTCIceCandidateInit)
      } else if (d.tipo === 'adios') this.cerrarPar(de, false)
    } catch (e) {
      this.fijar({ error: 'Could not connect voice with a crewmate.' })
      console.warn('[voz]', e)
    }
  }

  private par(id: string): Par {
    const existente = this.pares.get(id)
    if (existente) return existente
    const pc = new RTCPeerConnection({ iceServers: ICE })
    const par: Par = { pc, hablando: false }
    this.pares.set(id, par)
    if (this.microfono) for (const t of this.microfono.getTracks()) pc.addTrack(t, this.microfono)
    else pc.addTransceiver('audio', { direction: 'recvonly' })
    pc.onicecandidate = (e) => e.candidate && this.enviar?.(id, { tipo: 'ice', datos: e.candidate.toJSON() })
    pc.ontrack = (e) => this.conectarAudio(par, e.streams[0] ?? new MediaStream([e.track]))
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.cerrarPar(id, false)
      this.fijar({ conectados: [...this.pares.values()].filter((p) => p.pc.connectionState === 'connected').length })
    }
    return par
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
    par.pc.close()
    par.audio?.pause()
    par.fuente?.disconnect()
    par.panner?.disconnect()
    par.radio?.disconnect()
    par.ganancia?.disconnect()
    this.pares.delete(id)
    this.fijar({ conectados: [...this.pares.values()].filter((p) => p.pc.connectionState === 'connected').length })
  }

  private nivel(a: AnalyserNode | null | undefined): number {
    if (!a) return 0
    a.getByteTimeDomainData(this.buffer)
    let suma = 0
    for (let i = 0; i < this.buffer.length; i++) {
      const v = (this.buffer[i] - 128) / 128
      suma += v * v
    }
    return Math.sqrt(suma / this.buffer.length)
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
      par.hablando = this.nivel(par.analizador) > 0.04
    }
    this.hablandoYo = !this.estadoActual.silenciado && this.nivel(this.analizadorYo) > 0.04
  }

  hablando(id: string): boolean {
    return id === this.yo ? this.hablandoYo : Boolean(this.pares.get(id)?.hablando)
  }
}

export const voz = new Voz()

export function useVoz(): EstadoVoz {
  return useSyncExternalStore(voz.suscribir, voz.estado, voz.estado)
}
