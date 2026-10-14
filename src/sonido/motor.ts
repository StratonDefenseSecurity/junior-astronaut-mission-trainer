// Motor de sonido procedural. Todo se sintetiza con la Web Audio API: no hay archivos de audio,
// no se usa la red y no se agregan paquetes. Los ruidos base se generan una sola vez y se reusan.
//
// Regla de verdad: lo físico lleva su fuente (lista completa en README.md de esta carpeta); los
// niveles, timbres y frecuencias de motores, alarmas y pasos son decisiones de diseño del juego.
//
// Física que se respeta:
// - En el vacío no hay sonido. En órbita o en una toma exterior solo suena lo que se oye dentro de
//   la nave o del propio traje.
// - Dentro de una nave nunca hay silencio: ventiladores y bombas del soporte vital suenan siempre.
//   En la ISS se midieron 56-60 dBA en el Nodo 1 y el FGB, 69 dBA en el Módulo de Servicio y 77 dBA
//   con la cinta de correr (Clark, "Acoustic Issues in Human Spaceflight", NASA JSC).
// - En Marte la presión en superficie es 6.36 mb contra 1014 mb en la Tierra (fichas de NASA):
//   menos del 1 %. Una misma fuente suena unos 20 dB más débil, los agudos se apagan en pocos metros
//   (respecto a 1 m, una onda de 8 kHz pierde 40 dB a 8 m; en la Tierra, a 65 m) y el sonido viaja
//   a unos 240 m/s por debajo de 240 Hz y unos 10 m/s más rápido por encima: dos velocidades del
//   sonido medidas con los micrófonos de Perseverance (Maurice et al., Nature 605, 653-658, 2022).

export type TipoAmbiente = 'ninguno' | 'nave' | 'base' | 'eva' | 'lanzamiento' | 'descenso' | 'orbita'

export type NombreEvento =
  | 'alarma'
  | 'aviso'
  | 'clic'
  | 'quindarInicio'
  | 'quindarFin'
  | 'radio'
  | 'esclusa'
  | 'paso'
  | 'separacion'
  | 'teclado'
  | 'exito'
  | 'latido'
  | 'ejercicio'

/** Eventos que se repiten hasta llamar a detener(nombre). */
export type BucleSonido = 'alarma' | 'ejercicio'

/** Parámetros vivos de los ambientes. Todos son opcionales; lo que no se pasa conserva su valor. */
export interface ParametrosAmbiente {
  /** 'base' y 'eva': viento de Marte, 0..1. */
  viento?: number
  /** 'eva': respiraciones por minuto del jugador. Por debajo de 3 no se oye respirar. */
  respiracion?: number
  /** 'lanzamiento': empuje de los motores, 0..1. 0 = motores apagados. */
  empuje?: number
  /** 'lanzamiento': altitud en km. El aire que lleva el ruido del chorro se adelgaza al subir. */
  altitudKm?: number
  /** 'lanzamiento' (opcional): presión dinámica normalizada, 1 = máxima (máx. Q). Golpeteo del aire. */
  presionDinamica?: number
  /** 'descenso': rugido de la entrada atmosférica, 0..1. */
  calor?: number
  /** 'descenso': paracaídas abierto, 0..1. */
  paracaidas?: number
  /** 'descenso': retrocohetes, 0..1. */
  retro?: number
  /** 'descenso': 1 si se desciende en Marte, 0 en la Tierra. Lo que viaja por el aire llega ~20 dB más débil. */
  marte?: number
}

export interface OpcionesEvento {
  /** Multiplica el nivel del evento (1 = normal, máximo 2). */
  volumen?: number
  /** 'esclusa': sentido del cambio de presión. Por defecto 'despresurizar'. */
  direccion?: 'despresurizar' | 'presurizar'
  /** 'esclusa' y 'radio': duración en segundos (la esclusa va en tiempo comprimido de juego). */
  duracion?: number
  /** 'paso': 'interior' (nave o base, por defecto) o 'marte' (afuera, con traje). */
  superficie?: 'interior' | 'marte'
  /** 'teclado': cuántas teclas suenan. */
  cantidad?: number
  /** 'ejercicio': pasos por minuto en la cinta. Llamar otra vez cambia el ritmo sin cortar. */
  ritmo?: number
}

export interface EstadoSonido {
  /** El AudioContext existe y está sonando (se activó con un gesto del usuario). */
  activo: boolean
  silenciado: boolean
  /** Volumen maestro, 0..1. */
  volumen: number
}

type Parametros = Required<ParametrosAmbiente>
type TipoRuido = 'blanco' | 'rosa' | 'marron'

// ---- Constantes de diseño (afinar de oído aquí) ----
const FUNDIDO_S = 1.5
const VOLUMEN_INICIAL = 0.6
const INTERVALO_PARAMETROS_MS = 50
const CLAVE_SILENCIO = 'mt_sonido_silencio'
const CLAVE_VOLUMEN = 'mt_sonido_volumen'
/** Nivel relativo de cada mezcla. 'orbita' es la cabina en calma; 'base' es más tranquila que la nave. */
const NIVEL = { nave: 1, orbita: 0.5, base: 0.72, eva: 1, lanzamiento: 1, descenso: 1 }
/** Altura de escala de la atmósfera terrestre: 8.5 km (NASA, Earth Fact Sheet). */
const ALTURA_ESCALA_KM = 8.5
/** Una misma fuente suena unos 20 dB más débil en Marte (Maurice et al. 2022): factor 0.1 en amplitud. */
const ATENUACION_MARTE = 0.1

const PARAMETROS_INICIALES: Parametros = {
  viento: 0.3,
  respiracion: 14, // ritmo tranquilo del juego, no un dato medido
  empuje: 0,
  altitudKm: 0,
  presionDinamica: 0,
  calor: 0,
  paracaidas: 0,
  retro: 0,
  marte: 0,
}
const CLAVES = Object.keys(PARAMETROS_INICIALES) as (keyof Parametros)[]

const limitar = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const azar = (a: number, b: number) => a + Math.random() * (b - a)

/**
 * Densidad relativa del aire a una altitud, con la aproximación isotérmica exp(-h/H).
 * Es una simplificación del juego: la atmósfera real no es isotérmica.
 */
const densidadRelativa = (km: number) => Math.exp(-Math.max(0, km) / ALTURA_ESCALA_KM)

const leer = (clave: string) => {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}
const guardar = (clave: string, valor: string) => {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // almacenamiento no disponible (modo privado): la preferencia dura lo que dure la pestaña
  }
}

// ---------------------------------------------------------------------------------------------
// Ruido base: se genera una vez por contexto y todas las fuentes lo leen con desfases al azar.
// ---------------------------------------------------------------------------------------------

function crearRuido(ctx: BaseAudioContext, tipo: TipoRuido, segundos: number): AudioBuffer {
  const sr = ctx.sampleRate
  const n = Math.floor(sr * segundos)
  const cruce = Math.floor(sr * 0.08)
  const crudo = new Float32Array(n + cruce)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, ultimo = 0
  for (let i = 0; i < crudo.length; i++) {
    const w = Math.random() * 2 - 1
    if (tipo === 'blanco') {
      crudo[i] = w
    } else if (tipo === 'rosa') {
      // Filtro de Paul Kellet: aproxima la caída de 3 dB por octava del ruido rosa
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      crudo[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
      b6 = w * 0.115926
    } else {
      // Ruido marrón: integración con fuga para que no se aleje de cero
      ultimo = (ultimo + 0.02 * w) / 1.02
      crudo[i] = ultimo
    }
  }
  let media = 0
  for (let i = 0; i < crudo.length; i++) media += crudo[i]
  media /= crudo.length
  const buffer = ctx.createBuffer(1, n, sr)
  const d = buffer.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = crudo[i] - media
  // El principio se funde con lo que sigue al final: al repetirse el bucle no hay clic
  for (let i = 0; i < cruce; i++) {
    const a = i / cruce
    d[i] = (crudo[i] - media) * Math.sqrt(a) + (crudo[n + i] - media) * Math.sqrt(1 - a)
  }
  let suma = 0
  for (let i = 0; i < n; i++) suma += d[i] * d[i]
  const escala = 0.25 / Math.sqrt(suma / n || 1)
  for (let i = 0; i < n; i++) d[i] *= escala
  return buffer
}

/** Conecta los nodos en cadena. El último puede ser un AudioParam (modulación). */
function cadena(...nodos: [...AudioNode[], AudioNode | AudioParam]) {
  for (let i = 0; i < nodos.length - 1; i++) {
    const origen = nodos[i] as AudioNode
    const destino = nodos[i + 1]
    if (destino instanceof AudioParam) origen.connect(destino)
    else origen.connect(destino)
  }
}

/** Golpe: sube en `ataque` s hasta `pico` y cae de forma exponencial en `caida` s. */
function golpe(p: AudioParam, t: number, pico: number, ataque: number, caida: number) {
  p.setValueAtTime(0, t)
  p.linearRampToValueAtTime(Math.max(pico, 1e-4), t + ataque)
  p.exponentialRampToValueAtTime(1e-4, t + ataque + caida)
}

/** Tono sostenido con bordes suaves para que no haga clic. */
function tono(p: AudioParam, t: number, dur: number, nivel: number, borde = 0.005) {
  p.setValueAtTime(0, t)
  p.linearRampToValueAtTime(nivel, t + borde)
  p.setValueAtTime(nivel, t + dur - borde)
  p.linearRampToValueAtTime(0, t + dur)
}

/** Chasquido instantáneo sobre una ganancia que normalmente está en 0. */
function chasquido(p: AudioParam, t: number, nivel: number) {
  p.setValueAtTime(nivel, t)
  p.setTargetAtTime(0, t + 0.0015, 0.007)
}

class Fabrica {
  constructor(
    readonly ctx: AudioContext,
    private readonly ruidos: Record<TipoRuido, AudioBuffer>,
  ) {}
  ruido(tipo: TipoRuido): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource()
    s.buffer = this.ruidos[tipo]
    s.loop = true
    return s
  }
  duracion(tipo: TipoRuido) {
    return this.ruidos[tipo].duration
  }
  osc(tipo: OscillatorType, frecuencia: number): OscillatorNode {
    const o = this.ctx.createOscillator()
    o.type = tipo
    o.frequency.value = frecuencia
    return o
  }
  filtro(tipo: BiquadFilterType, frecuencia: number, q = 0.707, ganancia = 0): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter()
    f.type = tipo
    f.frequency.value = frecuencia
    f.Q.value = q
    f.gain.value = ganancia
    return f
  }
  ganancia(v: number): GainNode {
    const g = this.ctx.createGain()
    g.gain.value = v
    return g
  }
}

/** Sonido corto: sus nodos se desconectan solos cuando termina la última fuente. */
class Disparo {
  private nodos: AudioNode[] = []
  private activas = 0
  constructor(private readonly f: Fabrica) {}
  n<T extends AudioNode>(nodo: T): T {
    this.nodos.push(nodo)
    return nodo
  }
  private fuente<T extends AudioScheduledSourceNode>(s: T): T {
    this.n(s)
    this.activas++
    s.onended = () => {
      if (--this.activas === 0) for (const nodo of this.nodos) nodo.disconnect()
    }
    return s
  }
  ruido(tipo: TipoRuido, t: number, dur: number) {
    const s = this.f.ruido(tipo)
    s.start(t, Math.random() * this.f.duracion(tipo))
    s.stop(t + dur)
    return this.fuente(s)
  }
  osc(tipo: OscillatorType, frecuencia: number, t: number, dur: number) {
    const o = this.f.osc(tipo, frecuencia)
    o.start(t)
    o.stop(t + dur)
    return this.fuente(o)
  }
  filtro(tipo: BiquadFilterType, frecuencia: number, q?: number, ganancia?: number) {
    return this.n(this.f.filtro(tipo, frecuencia, q, ganancia))
  }
  ganancia(v: number) {
    return this.n(this.f.ganancia(v))
  }
}

/** Conjunto de nodos que suena hasta que se detiene (ambientes y bucles). */
class Grupo {
  readonly salida: GainNode
  vivo = true
  private nodos: AudioNode[] = []
  private fuentes: AudioScheduledSourceNode[] = []
  private cancelaciones: (() => void)[] = []
  constructor(
    readonly f: Fabrica,
    destino: AudioNode,
    inicial = 1,
  ) {
    this.salida = this.n(f.ganancia(inicial))
    this.salida.connect(destino)
  }
  get ctx() {
    return this.f.ctx
  }
  n<T extends AudioNode>(nodo: T): T {
    this.nodos.push(nodo)
    return nodo
  }
  ruido(tipo: TipoRuido) {
    const s = this.n(this.f.ruido(tipo))
    s.start(this.ctx.currentTime, Math.random() * this.f.duracion(tipo))
    this.fuentes.push(s)
    return s
  }
  osc(tipo: OscillatorType, frecuencia: number) {
    const o = this.n(this.f.osc(tipo, frecuencia))
    o.start()
    this.fuentes.push(o)
    return o
  }
  filtro(tipo: BiquadFilterType, frecuencia: number, q?: number, ganancia?: number) {
    return this.n(this.f.filtro(tipo, frecuencia, q, ganancia))
  }
  ganancia(v: number) {
    return this.n(this.f.ganancia(v))
  }
  /** Repite `paso`, que devuelve cuántos ms esperar hasta la siguiente vez. */
  cada(paso: () => number) {
    let id = 0
    const correr = () => {
      if (!this.vivo) return
      id = window.setTimeout(correr, paso())
    }
    id = window.setTimeout(correr, 0)
    this.cancelaciones.push(() => window.clearTimeout(id))
  }
  /** Ejecuta `accion` de vez en cuando, cada `min` a `max` segundos. */
  aVeces(min: number, max: number, accion: () => void) {
    let primera = true
    this.cada(() => {
      if (!primera) accion()
      primera = false
      return azar(min, max) * 1000
    })
  }
  aparecer(objetivo: number, fundido: number) {
    const g = this.salida.gain
    g.setValueAtTime(0, this.ctx.currentTime)
    g.setTargetAtTime(objetivo, this.ctx.currentTime, fundido / 4)
  }
  detener(fundido: number) {
    if (!this.vivo) return
    this.vivo = false
    for (const cancelar of this.cancelaciones) cancelar()
    const t = this.ctx.currentTime
    const g = this.salida.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.setTargetAtTime(0, t, fundido / 5)
    window.setTimeout(() => {
      for (const s of this.fuentes) {
        try {
          s.stop()
        } catch {
          // ya estaba detenida o el contexto se cerró
        }
      }
      for (const nodo of this.nodos) nodo.disconnect()
    }, fundido * 1000 + 200)
  }
}

/** Un ambiente continuo. `aplicar` solo mueve AudioParams: no crea nodos. */
class Cama extends Grupo {
  aplicar: (p: Parametros, t: number) => void = () => {}
}

// ---------------------------------------------------------------------------------------------
// Piezas de los ambientes
// ---------------------------------------------------------------------------------------------

/** Ventiladores y bombas del soporte vital. El timbre (aire filtrado y zumbido con batido) es de diseño. */
function soporteVital(c: Grupo, destino: AudioNode, nivel: number) {
  const aire = c.ganancia(0.22 * nivel)
  cadena(c.ruido('rosa'), c.filtro('highpass', 70, 0.7), c.filtro('lowpass', 950, 0.6), c.filtro('peaking', 380, 1.4, 3), aire, destino)
  // Vaivén muy lento del caudal para que el ruido no suene congelado
  const vaiven = c.ganancia(0.02 * nivel)
  cadena(c.osc('sine', azar(0.025, 0.045)), vaiven, aire.gain)
  // Zumbido de motores y bombas: dos senos casi iguales que baten despacio y un armónico suave
  const zumbido = c.ganancia(0.011 * nivel)
  const base = azar(94, 99)
  c.osc('sine', base).connect(zumbido)
  c.osc('sine', base + azar(0.4, 0.7)).connect(zumbido)
  const armonico = c.ganancia(0.4)
  cadena(c.osc('sine', base * 2 + 0.3), armonico, zumbido)
  zumbido.connect(destino)
}

/** Relé: dos chasquidos muy cortos (contacto y rebote). */
function clicRele(f: Fabrica, destino: AudioNode, nivel: number) {
  const t = f.ctx.currentTime + 0.02
  const d = new Disparo(f)
  const g = d.ganancia(0)
  cadena(d.ruido('blanco', t, 0.12), d.filtro('bandpass', azar(1800, 2600), 2.5), g, destino)
  golpe(g.gain, t, 0.2 * nivel, 0.0008, 0.012)
  golpe(g.gain, t + azar(0.03, 0.07), 0.05 * nivel, 0.0008, 0.01)
}

/** Gorgoteo de agua en una tubería: burbujas cuyo tono sube al cerrarse. */
function gorgoteo(f: Fabrica, destino: AudioNode, nivel: number) {
  const d = new Disparo(f)
  const lp = d.filtro('lowpass', 1600, 0.7)
  const salida = d.ganancia(nivel)
  cadena(lp, salida, destino)
  let t = f.ctx.currentTime + 0.02
  const n = Math.floor(azar(3, 9))
  for (let i = 0; i < n; i++) {
    const dur = azar(0.04, 0.09)
    const f0 = azar(280, 850)
    const o = d.osc('sine', f0, t, dur + 0.02)
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f0 * azar(1.4, 2), t + dur)
    const e = d.ganancia(0)
    golpe(e.gain, t, azar(0.008, 0.02), 0.004, dur)
    cadena(o, e, lp)
    t += azar(0.05, 0.22)
  }
}

/**
 * Viento de Marte oído desde dentro (casco del hábitat o del traje): muy débil, grave y apagado,
 * porque el aire es tenue y los agudos se pierden (Maurice et al. 2022). Devuelve el control.
 */
function vientoMarciano(c: Grupo, destino: AudioNode, corte: number, maximo: number) {
  const lp = c.filtro('lowpass', corte, 0.8)
  const g = c.ganancia(0)
  cadena(c.ruido('marron'), lp, c.filtro('lowpass', corte * 1.6, 0.5), g, destino)
  // Ráfagas: dos osciladores lentos sumados no repiten un patrón evidente
  const r1 = c.osc('sine', azar(0.05, 0.08))
  const r2 = c.osc('sine', azar(0.11, 0.17))
  const profundidad = c.ganancia(0)
  r1.connect(profundidad)
  r2.connect(profundidad)
  profundidad.connect(g.gain)
  const barrido = c.ganancia(corte * 0.25)
  r1.connect(barrido)
  r2.connect(barrido)
  barrido.connect(lp.frequency)
  return (viento: number, t: number) => {
    const v = limitar(viento, 0, 1)
    g.gain.setTargetAtTime(maximo * v, t, 0.4)
    // La suma de las dos ráfagas llega a ±0.6 del nivel: la ganancia nunca cruza cero
    profundidad.gain.setTargetAtTime(maximo * 0.3 * v, t, 0.4)
  }
}

/** Chasquidos sueltos y algunas ráfagas, con la intensidad que diga `intensidad()` (0..1). */
function crepitar(c: Grupo, destino: AudioNode, nivel: number, intensidad: () => number) {
  const g = c.ganancia(0)
  cadena(c.ruido('blanco'), c.filtro('bandpass', 1100, 0.5), c.filtro('lowpass', 4000, 0.7), g, destino)
  let cursor = 0
  c.cada(() => {
    const ahora = c.ctx.currentTime
    if (cursor < ahora + 0.02) cursor = ahora + 0.05
    if (cursor > ahora + 0.3) return 80
    const i = limitar(intensidad(), 0, 1)
    const fin = cursor + 0.1
    if (i > 0.02) {
      let t = cursor
      for (;;) {
        t += -Math.log(1 - Math.random()) / (i * 22)
        if (t >= fin) break
        chasquido(g.gain, t, nivel * i * azar(0.4, 1.3))
      }
      if (Math.random() < i * 0.05) {
        let t2 = fin
        const n = 6 + Math.floor(Math.random() * 10)
        for (let k = 0; k < n; k++) {
          t2 += azar(0.012, 0.045)
          chasquido(g.gain, t2, nivel * i * azar(0.8, 1.8))
        }
        cursor = t2 + 0.02
        return 100
      }
    }
    cursor = fin
    return 100
  })
}

// ---------------------------------------------------------------------------------------------
// Ambientes
// ---------------------------------------------------------------------------------------------

/** Nave en tránsito (o cabina en órbita si `eventos` es falso): soporte vital, relés y agua. */
function camaNave(c: Cama, nivel: number, eventos: boolean) {
  soporteVital(c, c.salida, nivel)
  if (!eventos) return
  c.aVeces(9, 28, () => clicRele(c.f, c.salida, nivel))
  c.aVeces(25, 75, () => gorgoteo(c.f, c.salida, nivel))
}

/** Hábitat en Marte: como la nave pero más tranquilo, con el viento apenas audible por el casco. */
function camaBase(c: Cama, nivel: number) {
  soporteVital(c, c.salida, nivel)
  c.aVeces(15, 45, () => clicRele(c.f, c.salida, nivel * 0.8))
  c.aVeces(40, 110, () => gorgoteo(c.f, c.salida, nivel * 0.7))
  const viento = vientoMarciano(c, c.salida, 160, 0.09)
  c.aplicar = (p, t) => viento(p.viento, t)
}

/**
 * Dentro del traje en Marte. Según el astronauta Garrett Reisman, en una caminata espacial lo que
 * más se oye son las bombas y ventiladores que mueven aire y agua por el traje; la respiración está,
 * pero no es lo único. Si la caminata es en el vacío, poner viento 0: no hay aire que lleve sonido.
 */
function camaEva(c: Cama, p: Parametros, nivel: number) {
  // Ventilador del traje
  cadena(c.ruido('rosa'), c.filtro('highpass', 120, 0.7), c.filtro('bandpass', 520, 0.55), c.filtro('lowpass', 2200, 0.6), c.ganancia(0.3 * nivel), c.salida)
  // Motor del ventilador y bomba de agua: zumbidos suaves (frecuencias de diseño)
  const motor = c.ganancia(0.006 * nivel)
  c.osc('sine', 205).connect(motor)
  c.osc('sine', 205.6).connect(motor)
  motor.connect(c.salida)
  const bomba = c.ganancia(0.012 * nivel)
  cadena(c.osc('triangle', 58), c.filtro('lowpass', 160, 0.7), bomba, c.salida)
  const pulso = c.ganancia(0.004 * nivel)
  cadena(c.osc('sine', 1.7), pulso, bomba.gain)

  // Casco: un realce y un eco muy corto dan el color de un espacio cerrado y pequeño
  const casco = c.filtro('peaking', 950, 1.1, 4)
  const eco = c.n(c.ctx.createDelay(0.05))
  eco.delayTime.value = 0.0027
  const realimentacion = c.ganancia(0.28)
  const mezclaEco = c.ganancia(0.35)
  casco.connect(c.salida)
  casco.connect(eco)
  cadena(eco, realimentacion, eco)
  cadena(eco, mezclaEco, c.salida)

  // Respiración: dos ruidos fijos cuyas ganancias se mueven en cada respiración (no crea nodos)
  const fInhala = c.filtro('bandpass', 1150, 0.9)
  const gInhala = c.ganancia(0)
  cadena(c.ruido('rosa'), fInhala, gInhala, casco)
  const fExhala = c.filtro('bandpass', 760, 0.8)
  const gExhala = c.ganancia(0)
  cadena(c.ruido('rosa'), fExhala, c.filtro('lowpass', 2600, 0.6), gExhala, casco)

  const soplo = (g: AudioParam, fr: AudioParam, t: number, dur: number, pico: number, f0: number, f1: number) => {
    g.setValueAtTime(0, t)
    g.linearRampToValueAtTime(pico * 0.85, t + dur * 0.3)
    g.linearRampToValueAtTime(pico, t + dur * 0.6)
    g.linearRampToValueAtTime(0, t + dur)
    fr.setValueAtTime(f0, t)
    fr.linearRampToValueAtTime(f1, t + dur)
  }
  let siguiente = c.ctx.currentTime + 0.4
  let inicio = -1
  let finUltima = 0
  c.cada(() => {
    const ahora = c.ctx.currentTime
    const rpm = limitar(p.respiracion, 0, 50)
    if (rpm < 3) {
      siguiente = Math.max(siguiente, ahora + 0.3)
      return 300
    }
    // Si el ritmo sube bastante, la próxima respiración se adelanta sin pisar la que está sonando
    const nuevo = 60 / rpm
    if (inicio >= 0 && inicio + nuevo < siguiente - Math.max(0.15, 0.1 * nuevo)) siguiente = Math.max(inicio + nuevo, finUltima + 0.05)
    if (siguiente < ahora + 0.05) siguiente = ahora + 0.05
    if (siguiente - ahora > 0.3) return 150
    // Inhalar más corto que exhalar, con una pausa; reparto y variación al azar son de diseño
    const periodo = (60 / rpm) * azar(0.94, 1.06)
    const fuerza = (0.75 + 0.35 * limitar((rpm - 12) / 25, 0, 1)) * nivel
    const inhala = limitar(periodo * 0.36, 0.45, 2)
    const pausa = limitar(periodo * 0.06, 0.05, 0.4)
    const exhala = limitar(periodo * 0.46, 0.55, 2.8)
    soplo(gInhala.gain, fInhala.frequency, siguiente, inhala, 0.26 * fuerza * azar(0.85, 1.1), 1050, 1400)
    soplo(gExhala.gain, fExhala.frequency, siguiente + inhala + pausa, exhala, 0.32 * fuerza * azar(0.85, 1.1), 820, 600)
    inicio = siguiente
    finUltima = siguiente + inhala + pausa + exhala
    siguiente += periodo
    return 150
  })

  const viento = vientoMarciano(c, c.salida, 220, 0.06)
  c.aplicar = (q, t) => viento(q.viento, t)
}

/**
 * Lanzamiento. El ruido nace en la combustión, la mezcla del chorro con el aire, la capa límite y
 * las ondas de choque (NASA OCHMO-TB-035). A la cabina llegan dos caminos:
 * - la vibración de los motores por la estructura, que dura mientras haya empuje;
 * - lo que viaja por el aire, que se adelgaza con la densidad (aproximación exp(-h/8.5 km)).
 * Al apagar motores solo quedan los ventiladores de la cabina.
 */
function camaLanzamiento(c: Cama, p: Parametros, nivel: number) {
  soporteVital(c, c.salida, 0.5 * nivel)

  // 1) Estructura: retumbo grave con sacudidas
  const estructura = c.ganancia(0)
  cadena(c.ruido('marron'), c.filtro('lowpass', 120, 0.9), estructura, c.salida)
  const sacudida = c.ganancia(0)
  c.osc('sine', 6.7).connect(sacudida)
  c.osc('sine', 9.3).connect(sacudida)
  sacudida.connect(estructura.gain)
  const sub = c.ganancia(0)
  c.osc('sine', 31).connect(sub)
  c.osc('sine', 47.5).connect(sub)
  sub.connect(c.salida)

  // 2) Aire: más brillo y más fuerza cuanto más denso es el aire
  const corteAire = c.filtro('lowpass', 1500, 0.6)
  const aire = c.ganancia(0)
  cadena(c.ruido('rosa'), c.filtro('highpass', 35, 0.7), corteAire, aire, c.salida)

  // 3) Golpeteo aerodinámico cerca de la máxima presión dinámica (si el juego la manda)
  const golpeteo = c.ganancia(0)
  cadena(c.ruido('rosa'), c.filtro('bandpass', 180, 0.7), golpeteo, c.salida)
  const golpeteoLfo = c.ganancia(0)
  cadena(c.osc('sine', 4.1), golpeteoLfo, golpeteo.gain)

  // 4) Crepitar del chorro: viaja por el aire, así que también se apaga al subir
  crepitar(c, c.salida, 0.8 * nivel, () => limitar(p.empuje, 0, 1) * densidadRelativa(p.altitudKm))

  c.aplicar = (q, t) => {
    const e = limitar(q.empuje, 0, 1)
    const d = densidadRelativa(q.altitudKm)
    const pd = limitar(q.presionDinamica, 0, 1)
    estructura.gain.setTargetAtTime(0.75 * e * nivel, t, 0.12)
    sacudida.gain.setTargetAtTime(0.18 * e * nivel, t, 0.12)
    sub.gain.setTargetAtTime(0.06 * e * nivel, t, 0.12)
    aire.gain.setTargetAtTime(0.45 * e * d * nivel, t, 0.15)
    corteAire.frequency.setTargetAtTime(180 + 1400 * d, t, 0.2)
    golpeteo.gain.setTargetAtTime(0.25 * pd * nivel, t, 0.15)
    golpeteoLfo.gain.setTargetAtTime(0.1 * pd * nivel, t, 0.15)
  }
}

/**
 * Descenso: rugido de la entrada (calor), aleteo del paracaídas y retrocohetes. Lo que llega por la
 * estructura se oye igual en la Tierra y en Marte; lo que viaja por el aire exterior se baja 20 dB
 * y pierde los agudos cuando `marte` es 1 (diferencia calculada por Maurice et al. 2022 para una
 * misma fuente; aplicarla a todo el ruido exterior es una aproximación del juego).
 */
function camaDescenso(c: Cama, p: Parametros, nivel: number) {
  soporteVital(c, c.salida, 0.45 * nivel)

  const exterior = c.ganancia(1)
  const corteExterior = c.filtro('lowpass', 12000, 0.5)
  cadena(exterior, corteExterior, c.salida)
  const enMarte = () => p.marte >= 0.5

  // Entrada: rugido del aire contra el escudo, con oleadas, y su retumbo por la estructura
  const plasma = c.ganancia(0)
  cadena(c.ruido('rosa'), c.filtro('bandpass', 420, 0.45), c.filtro('lowpass', 1600, 0.6), plasma, exterior)
  const oleada = c.ganancia(0)
  c.osc('sine', 0.23).connect(oleada)
  c.osc('sine', 0.37).connect(oleada)
  oleada.connect(plasma.gain)
  const retumbo = c.ganancia(0)
  cadena(c.ruido('marron'), c.filtro('lowpass', 110, 0.8), retumbo, c.salida)

  // Paracaídas: tela que aletea y viento que pasa por las cuerdas
  const tela = c.ganancia(0)
  cadena(c.ruido('rosa'), c.filtro('bandpass', 240, 1.1), tela, exterior)
  const aleteo = c.ganancia(0)
  c.osc('sine', 5.3).connect(aleteo)
  c.osc('sine', 7.9).connect(aleteo)
  aleteo.connect(tela.gain)
  const cuerdas = c.ganancia(0)
  cadena(c.ruido('blanco'), c.filtro('bandpass', 900, 0.5), cuerdas, exterior)

  // Retrocohetes: estructura y aire
  const retroEstructura = c.ganancia(0)
  cadena(c.ruido('marron'), c.filtro('lowpass', 140, 0.9), retroEstructura, c.salida)
  const retroAire = c.ganancia(0)
  cadena(c.ruido('rosa'), c.filtro('lowpass', 900, 0.6), retroAire, exterior)
  crepitar(c, exterior, 0.45 * nivel, () => limitar(p.retro, 0, 1))

  c.aplicar = (q, t) => {
    const marte = enMarte()
    const ca = limitar(q.calor, 0, 1) * nivel
    const pa = limitar(q.paracaidas, 0, 1) * nivel
    const re = limitar(q.retro, 0, 1) * nivel
    exterior.gain.setTargetAtTime(marte ? ATENUACION_MARTE : 1, t, 0.3)
    corteExterior.frequency.setTargetAtTime(marte ? 2500 : 12000, t, 0.3)
    plasma.gain.setTargetAtTime(0.5 * ca, t, 0.2)
    oleada.gain.setTargetAtTime(0.1 * ca, t, 0.2)
    retumbo.gain.setTargetAtTime(0.6 * ca, t, 0.2)
    tela.gain.setTargetAtTime(0.45 * pa, t, 0.15)
    aleteo.gain.setTargetAtTime(0.15 * pa, t, 0.15)
    cuerdas.gain.setTargetAtTime(0.12 * pa, t, 0.15)
    retroEstructura.gain.setTargetAtTime(0.7 * re, t, 0.1)
    retroAire.gain.setTargetAtTime(0.35 * re, t, 0.1)
  }
}

// ---------------------------------------------------------------------------------------------
// Eventos cortos
// ---------------------------------------------------------------------------------------------

/** Clic de interfaz: muy corto y suave. */
function clic(f: Fabrica, destino: AudioNode, t: number, v: number) {
  const d = new Disparo(f)
  const g = d.ganancia(0)
  cadena(d.ruido('blanco', t, 0.04), d.filtro('bandpass', 3500, 1.2), g, destino)
  golpe(g.gain, t, 0.35 * v, 0.0007, 0.018)
  const gt = d.ganancia(0)
  cadena(d.osc('sine', 2100, t, 0.03), gt, destino)
  golpe(gt.gain, t, 0.05 * v, 0.0005, 0.012)
}

/**
 * Aviso de precaución: dos pitidos suaves. Las alarmas de precaución y advertencia de la ISS suenan
 * entre 0.5 y 2 kHz (Clark, NASA JSC); el patrón exacto es de diseño.
 */
function aviso(f: Fabrica, destino: AudioNode, t: number, v: number) {
  const d = new Disparo(f)
  const g = d.ganancia(0)
  cadena(d.osc('triangle', 990, t, 0.5), d.filtro('lowpass', 3000, 0.7), g, destino)
  tono(g.gain, t, 0.14, 0.12 * v, 0.01)
  tono(g.gain, t + 0.22, 0.14, 0.12 * v, 0.01)
}

/**
 * Tonos Quindar del Apolo: seno puro de 250 ms, 2525 Hz al empezar a hablar CAPCOM y 2475 Hz al
 * soltar el botón. Encendían y apagaban los transmisores remotos en la Tierra.
 */
function quindar(f: Fabrica, destino: AudioNode, t: number, v: number, frecuencia: number) {
  const d = new Disparo(f)
  const g = d.ganancia(0)
  cadena(d.osc('sine', frecuencia, t, 0.27), g, destino)
  tono(g.gain, t, 0.25, 0.07 * v, 0.004)
}

/** Estática de radio: ruido de banda telefónica con parpadeo al azar. */
function radio(f: Fabrica, destino: AudioNode, t: number, v: number, duracion: number) {
  const d = new Disparo(f)
  const g = d.ganancia(0)
  cadena(d.ruido('blanco', t, duracion + 0.05), d.filtro('highpass', 350, 0.7), d.filtro('bandpass', 1900, 0.55), g, destino)
  g.gain.setValueAtTime(0, t)
  let x = t + 0.004
  while (x < t + duracion - 0.01) {
    g.gain.linearRampToValueAtTime(0.5 * v * azar(0.25, 1), x)
    x += azar(0.012, 0.03)
  }
  g.gain.linearRampToValueAtTime(0, t + duracion)
}

/** Golpe sordo: seno que baja de tono más un poco de ruido grave. */
function golpeSordo(d: Disparo, destino: AudioNode, t: number, frecuencia: number, nivel: number, caida: number) {
  const o = d.osc('sine', frecuencia, t, caida + 0.05)
  o.frequency.setValueAtTime(frecuencia, t)
  o.frequency.exponentialRampToValueAtTime(frecuencia * 0.6, t + caida)
  const g = d.ganancia(0)
  cadena(o, g, destino)
  golpe(g.gain, t, nivel, 0.004, caida)
  const gr = d.ganancia(0)
  cadena(d.ruido('marron', t, caida + 0.05), d.filtro('lowpass', 260, 0.7), gr, destino)
  golpe(gr.gain, t, nivel * 1.2, 0.005, caida * 0.8)
}

/**
 * Esclusa. Al despresurizar queda cada vez menos aire que lleve el sonido: el siseo se adelgaza
 * y se apaga. Al presurizar vuelve el aire: empieza fino y casi mudo y se llena. Tiempo comprimido.
 */
function esclusa(f: Fabrica, destino: AudioNode, t: number, v: number, duracion: number, presurizar: boolean) {
  const d = new Disparo(f)
  const banda = d.filtro('bandpass', 3000, 0.8)
  const g = d.ganancia(0)
  cadena(d.ruido('blanco', t, duracion + 0.1), banda, d.filtro('highpass', 250, 0.7), g, destino)
  const gc = d.ganancia(0)
  cadena(d.ruido('marron', t, duracion + 0.1), d.filtro('lowpass', 260, 0.7), gc, destino)
  const pico = 0.5 * v
  const fin = t + duracion
  if (!presurizar) {
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(pico, t + 0.25)
    g.gain.exponentialRampToValueAtTime(1e-4, fin)
    banda.frequency.setValueAtTime(2200, t)
    banda.frequency.exponentialRampToValueAtTime(5200, fin)
    gc.gain.setValueAtTime(0, t)
    gc.gain.linearRampToValueAtTime(pico * 0.6, t + 0.2)
    gc.gain.exponentialRampToValueAtTime(1e-4, t + duracion * 0.6)
  } else {
    g.gain.setValueAtTime(pico * 0.01, t)
    g.gain.exponentialRampToValueAtTime(pico, t + duracion * 0.85)
    g.gain.linearRampToValueAtTime(0, fin)
    banda.frequency.setValueAtTime(5200, t)
    banda.frequency.exponentialRampToValueAtTime(2200, t + duracion * 0.85)
    gc.gain.setValueAtTime(pico * 0.006, t)
    gc.gain.exponentialRampToValueAtTime(pico * 0.6, t + duracion * 0.85)
    gc.gain.linearRampToValueAtTime(0, fin)
    golpeSordo(d, destino, fin, 110, 0.12 * v, 0.15)
  }
  // La válvula se abre con un golpe metálico sordo
  golpeSordo(d, destino, t, 120, 0.15 * v, 0.15)
}

/**
 * Paso. Dentro: pisada suave en el piso. Afuera en Marte: crujido apagado del regolito que llega
 * sobre todo por el cuerpo y el traje, porque el aire tenue casi no lo lleva.
 */
function paso(f: Fabrica, destino: AudioNode, t: number, v: number, marte: boolean) {
  const d = new Disparo(f)
  if (!marte) {
    const g = d.ganancia(0)
    cadena(d.ruido('rosa', t, 0.12), d.filtro('lowpass', 700 * azar(0.85, 1.15), 0.7), g, destino)
    golpe(g.gain, t, 0.16 * v, 0.004, 0.07)
    golpeSordo(d, destino, t, 90 * azar(0.9, 1.1), 0.07 * v, 0.08)
    return
  }
  const g = d.ganancia(0)
  cadena(d.ruido('blanco', t, 0.2), d.filtro('bandpass', 1100 * azar(0.85, 1.15), 0.8), d.filtro('lowpass', 1300, 0.6), g, destino)
  g.gain.setValueAtTime(0, t)
  let x = t
  const granos = 6 + Math.floor(Math.random() * 5)
  for (let i = 0; i < granos; i++) {
    x += azar(0.006, 0.02)
    chasquido(g.gain, x, 0.25 * v * azar(0.4, 1))
  }
  golpeSordo(d, destino, t, 70 * azar(0.9, 1.1), 0.1 * v, 0.1)
}

/** Separación de etapas: pirotecnia seca, golpe grave, retumbo y metal que vibra, todo por la estructura. */
function separacion(f: Fabrica, destino: AudioNode, t: number, v: number) {
  const d = new Disparo(f)
  const crack = d.ganancia(0)
  cadena(d.ruido('blanco', t, 0.06), d.filtro('highpass', 700, 0.7), d.filtro('lowpass', 4000, 0.7), crack, destino)
  golpe(crack.gain, t, 0.5 * v, 0.0008, 0.035)
  const o = d.osc('sine', 58, t, 1)
  o.frequency.setValueAtTime(58, t)
  o.frequency.exponentialRampToValueAtTime(26, t + 0.5)
  const g = d.ganancia(0)
  cadena(o, g, destino)
  golpe(g.gain, t, 0.6 * v, 0.004, 0.8)
  const r = d.ganancia(0)
  cadena(d.ruido('marron', t, 1.7), d.filtro('lowpass', 220, 0.7), r, destino)
  golpe(r.gain, t, 0.45 * v, 0.01, 1.4)
  // Parciales inarmónicos: frecuencias de diseño para que suene a metal
  const metal = d.filtro('lowpass', 1500, 0.7)
  metal.connect(destino)
  for (const fr of [173, 287, 431]) {
    const gm = d.ganancia(0)
    cadena(d.osc('sine', fr * azar(0.98, 1.02), t, 1.7), gm, metal)
    golpe(gm.gain, t, 0.03 * v, 0.003, 1.4)
  }
}

/** Unas cuantas teclas suaves. */
function teclado(f: Fabrica, destino: AudioNode, t: number, v: number, cantidad: number) {
  const d = new Disparo(f)
  let x = t
  for (let i = 0; i < cantidad; i++) {
    const g = d.ganancia(0)
    cadena(d.ruido('blanco', x, 0.03), d.filtro('bandpass', azar(2600, 3600), 1.6), g, destino)
    golpe(g.gain, x, 0.25 * v * azar(0.7, 1), 0.0006, 0.014)
    const gt = d.ganancia(0)
    cadena(d.osc('sine', 180 * azar(0.9, 1.1), x, 0.05), gt, destino)
    golpe(gt.gain, x, 0.03 * v, 0.001, 0.03)
    x += azar(0.07, 0.19)
  }
}

/** Confirmación breve y agradable: do-mi-sol. */
function exito(f: Fabrica, destino: AudioNode, t: number, v: number) {
  const d = new Disparo(f)
  const lp = d.filtro('lowpass', 3200, 0.7)
  lp.connect(destino)
  const notas = [523.25, 659.26, 783.99]
  notas.forEach((fr, i) => {
    const dur = i === notas.length - 1 ? 0.7 : 0.35
    const x = t + i * 0.09
    const g = d.ganancia(0)
    cadena(d.osc('triangle', fr, x, dur + 0.05), g, lp)
    golpe(g.gain, x, 0.08 * v, 0.008, dur)
  })
}

/** Un latido: "lub" más grave y largo, "dub" más corto (timbres de diseño). */
function latido(f: Fabrica, destino: AudioNode, t: number, v: number) {
  const d = new Disparo(f)
  const lp = d.filtro('lowpass', 220, 0.7)
  lp.connect(destino)
  const golpes: [number, number, number, number][] = [
    [0, 58, 0.5, 0.14],
    [0.26, 72, 0.32, 0.1],
  ]
  for (const [dt, f0, pico, dur] of golpes) {
    const x = t + dt
    const o = d.osc('triangle', f0, x, dur + 0.05)
    o.frequency.setValueAtTime(f0, x)
    o.frequency.exponentialRampToValueAtTime(f0 * 0.7, x + dur)
    const g = d.ganancia(0)
    cadena(o, g, lp)
    golpe(g.gain, x, pico * v, 0.012, dur)
  }
}

/** Alarma maestra: dos tonos y una pausa, en la banda de 0.5 a 2 kHz. Se repite hasta detenerla. */
function crearAlarma(f: Fabrica, destino: AudioNode, v: number) {
  const g = new Grupo(f, destino, v)
  const o = g.osc('square', 880)
  const env = g.ganancia(0)
  cadena(o, g.filtro('lowpass', 2000, 0.7), env, g.salida)
  let t = 0
  g.cada(() => {
    const ahora = f.ctx.currentTime
    if (t < ahora + 0.02) t = ahora + 0.03
    if (t > ahora + 0.5) return 100
    o.frequency.setValueAtTime(880, t)
    tono(env.gain, t, 0.2, 0.1, 0.008)
    o.frequency.setValueAtTime(660, t + 0.23)
    tono(env.gain, t + 0.23, 0.2, 0.1, 0.008)
    t += 0.75
    return 120
  })
  return g
}

/** Cinta de correr: motor, banda y pisadas al ritmo pedido. En la ISS medía 77 dBA (Clark, NASA JSC). */
function crearEjercicio(f: Fabrica, destino: AudioNode, v: number, ritmo: () => number) {
  const g = new Grupo(f, destino, 0)
  g.aparecer(v, 0.6)
  cadena(g.osc('sawtooth', 88), g.filtro('lowpass', 420, 2), g.ganancia(0.022), g.salida)
  cadena(g.ruido('rosa'), g.filtro('bandpass', 1250, 4), g.ganancia(0.15), g.salida)
  cadena(g.ruido('marron'), g.filtro('lowpass', 300, 0.7), g.ganancia(0.1), g.salida)
  const pie = g.ganancia(0)
  cadena(g.ruido('marron'), g.filtro('lowpass', 260, 0.7), pie, g.salida)
  const impacto = g.ganancia(0)
  cadena(g.osc('sine', 64), impacto, g.salida)
  let siguiente = 0
  let izquierdo = true
  g.cada(() => {
    const ahora = f.ctx.currentTime
    if (siguiente < ahora + 0.03) siguiente = ahora + 0.05
    while (siguiente < ahora + 0.3) {
      const a = izquierdo ? 1 : 0.85
      golpe(pie.gain, siguiente, 0.5 * a * azar(0.85, 1.05), 0.006, 0.08)
      golpe(impacto.gain, siguiente, 0.12 * a, 0.004, 0.09)
      siguiente += (60 / ritmo()) * azar(0.97, 1.03)
      izquierdo = !izquierdo
    }
    return 100
  })
  return g
}

// ---------------------------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------------------------

const GESTOS = ['pointerdown', 'keydown', 'touchend', 'click'] as const

class Motor {
  private ctx: AudioContext | null = null
  private fabrica: Fabrica | null = null
  private maestro: GainNode | null = null
  private busAmbiente: GainNode | null = null
  private busEventos: GainNode | null = null
  private voces: GainNode | null = null
  private cama: Cama | null = null
  private tipo: TipoAmbiente = 'ninguno'
  private readonly p: Parametros = { ...PARAMETROS_INICIALES }
  private readonly aplicados: Parametros = { ...PARAMETROS_INICIALES }
  private bucles: Partial<Record<BucleSonido, Grupo>> = {}
  private pedidos = new Set<BucleSonido>()
  private volumenBucle: Record<BucleSonido, number> = { alarma: 1, ejercicio: 1 }
  private ritmo = 150
  private silenciado = leer(CLAVE_SILENCIO) === '1'
  private vol = (() => {
    const v = Number(leer(CLAVE_VOLUMEN))
    return leer(CLAVE_VOLUMEN) !== null && Number.isFinite(v) ? limitar(v, 0, 1) : VOLUMEN_INICIAL
  })()
  private oyentes = new Set<() => void>()
  private foto: EstadoSonido = { activo: false, silenciado: this.silenciado, volumen: this.vol }
  private ultimaAplicacion = 0
  private relojParametros = 0

  activar = (): Promise<void> => {
    if (typeof window === 'undefined') return Promise.resolve()
    if (!this.ctx) {
      const Clase = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Clase) return Promise.resolve()
      try {
        this.ctx = new Clase({ latencyHint: 'interactive' })
      } catch {
        return Promise.resolve()
      }
      this.construir(this.ctx)
      document.addEventListener('visibilitychange', this.alVolver)
    }
    const ctx = this.ctx
    if (ctx.state === 'running') {
      this.emitir()
      return Promise.resolve()
    }
    return ctx.resume().then(this.emitir, this.emitir)
  }

  /** Activa el sonido con el primer gesto del usuario. Devuelve una función para dejar de escuchar. */
  activarAlInteractuar = (): (() => void) => {
    if (typeof window === 'undefined') return () => {}
    const quitar = () => {
      for (const e of GESTOS) window.removeEventListener(e, alGesto, true)
    }
    const alGesto = () => {
      void this.activar().then(() => {
        if (this.ctx?.state === 'running') quitar()
      })
    }
    for (const e of GESTOS) window.addEventListener(e, alGesto, true)
    return quitar
  }

  silenciar = (b: boolean) => {
    this.silenciado = Boolean(b)
    guardar(CLAVE_SILENCIO, this.silenciado ? '1' : '0')
    this.aplicarMaestro()
    this.emitir()
  }

  volumen = (v: number) => {
    if (!Number.isFinite(v)) return
    this.vol = limitar(v, 0, 1)
    guardar(CLAVE_VOLUMEN, String(this.vol))
    this.aplicarMaestro()
    this.emitir()
  }

  /** Instantánea estable: solo cambia de referencia cuando cambia algún valor. */
  estado = (): EstadoSonido => this.foto

  suscribir = (fn: () => void): (() => void) => {
    this.oyentes.add(fn)
    return () => {
      this.oyentes.delete(fn)
    }
  }

  ambiente = (tipo: TipoAmbiente, parametros?: ParametrosAmbiente) => {
    if (tipo === this.tipo) {
      if (parametros) this.parametros(parametros)
      return
    }
    if (parametros) this.copiar(parametros)
    this.tipo = tipo
    if (!this.fabrica || !this.busAmbiente) return
    this.cama?.detener(FUNDIDO_S)
    this.cama = tipo === 'ninguno' ? null : this.crearCama(tipo, this.fabrica, this.busAmbiente)
  }

  parametros = (p: ParametrosAmbiente) => {
    this.copiar(p)
    if (!this.cama) return
    if (performance.now() - this.ultimaAplicacion >= INTERVALO_PARAMETROS_MS) this.aplicarAhora()
    else if (!this.relojParametros) this.relojParametros = window.setTimeout(this.aplicarDiferido, INTERVALO_PARAMETROS_MS)
  }

  evento = (nombre: NombreEvento, opciones: OpcionesEvento = {}) => {
    const v = limitar(opciones.volumen ?? 1, 0, 2)
    if (nombre === 'alarma' || nombre === 'ejercicio') {
      if (opciones.ritmo !== undefined && Number.isFinite(opciones.ritmo)) this.ritmo = limitar(opciones.ritmo, 40, 220)
      this.volumenBucle[nombre] = v
      this.pedidos.add(nombre)
      this.iniciarBucle(nombre)
      return
    }
    const f = this.fabrica
    const destino = this.busEventos
    if (!f || !destino) return
    const t = f.ctx.currentTime + 0.01
    switch (nombre) {
      case 'aviso':
        return aviso(f, destino, t, v)
      case 'clic':
        return clic(f, destino, t, v)
      case 'quindarInicio':
        return quindar(f, destino, t, v, 2525)
      case 'quindarFin':
        return quindar(f, destino, t, v, 2475)
      case 'radio':
        return radio(f, destino, t, v, limitar(opciones.duracion ?? azar(0.18, 0.35), 0.05, 3))
      case 'esclusa':
        return esclusa(f, destino, t, v, limitar(opciones.duracion ?? 6, 1, 60), opciones.direccion === 'presurizar')
      case 'paso':
        return paso(f, destino, t, v, opciones.superficie === 'marte')
      case 'separacion':
        return separacion(f, destino, t, v)
      case 'teclado':
        return teclado(f, destino, t, v, Math.round(limitar(opciones.cantidad ?? azar(3, 6), 1, 20)))
      case 'exito':
        return exito(f, destino, t, v)
      case 'latido':
        return latido(f, destino, t, v)
    }
  }

  /** Detiene un bucle ('alarma' o 'ejercicio'); sin nombre, detiene todos. Otros nombres no hacen nada. */
  detener = (nombre?: NombreEvento) => {
    const nombres: BucleSonido[] = nombre === undefined ? ['alarma', 'ejercicio'] : nombre === 'alarma' || nombre === 'ejercicio' ? [nombre] : []
    for (const n of nombres) {
      this.pedidos.delete(n)
      this.bucles[n]?.detener(n === 'alarma' ? 0.08 : 0.6)
      delete this.bucles[n]
    }
    this.atenuarAmbiente()
  }

  contexto = (): AudioContext | null => this.ctx

  destinoVoces = (): GainNode | null => this.voces

  /** Cierra el contexto y suelta todo (útil al recargar módulos en desarrollo). */
  cerrar = () => {
    if (!this.ctx) return
    document.removeEventListener('visibilitychange', this.alVolver)
    window.clearTimeout(this.relojParametros)
    this.relojParametros = 0
    // Detener los grupos corta sus temporizadores; si no, seguirían corriendo sin contexto
    this.cama?.detener(0.05)
    for (const g of Object.values(this.bucles)) g?.detener(0.05)
    void this.ctx.close().catch(() => {})
    this.ctx = null
    this.fabrica = this.maestro = this.busAmbiente = this.busEventos = this.voces = null
    this.cama = null
    this.bucles = {}
    this.emitir()
  }

  // ---- interno ----

  private construir(ctx: AudioContext) {
    // Cadena maestra: mezcla → compresor suave → recorte → limitador → volumen → salida.
    // El compresor de Web Audio sube solo las señales suaves (ganancia de compensación); el
    // recorte la devuelve a un nivel parecido al de entrada.
    const mezcla = ctx.createGain()
    const compresor = ctx.createDynamicsCompressor()
    compresor.threshold.value = -16
    compresor.knee.value = 10
    compresor.ratio.value = 3
    compresor.attack.value = 0.02
    compresor.release.value = 0.3
    const recorte = ctx.createGain()
    recorte.gain.value = 0.55
    const limitador = ctx.createDynamicsCompressor()
    limitador.threshold.value = -3
    limitador.knee.value = 0
    limitador.ratio.value = 20
    limitador.attack.value = 0.002
    limitador.release.value = 0.12
    const maestro = ctx.createGain()
    maestro.gain.value = this.silenciado ? 0 : this.vol
    cadena(mezcla, compresor, recorte, limitador, maestro, ctx.destination)

    this.busAmbiente = ctx.createGain()
    this.busEventos = ctx.createGain()
    this.busAmbiente.connect(mezcla)
    this.busEventos.connect(mezcla)
    // Las voces no pasan por el compresor (el retumbo no debe bajarlas), pero sí por el limitador,
    // el silencio y el volumen
    this.voces = ctx.createGain()
    this.voces.connect(limitador)
    this.maestro = maestro

    this.fabrica = new Fabrica(ctx, {
      blanco: crearRuido(ctx, 'blanco', 4),
      rosa: crearRuido(ctx, 'rosa', 6),
      marron: crearRuido(ctx, 'marron', 7),
    })

    // Safari de iOS: un búfer mudo dentro del gesto termina de desbloquear el audio
    const mudo = ctx.createBufferSource()
    mudo.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    mudo.connect(ctx.destination)
    mudo.onended = () => mudo.disconnect()
    mudo.start()

    ctx.onstatechange = this.emitir
    // Lo que se pidió antes de activar empieza ahora
    if (this.tipo !== 'ninguno') this.cama = this.crearCama(this.tipo, this.fabrica, this.busAmbiente)
    for (const n of this.pedidos) this.iniciarBucle(n)
  }

  private crearCama(tipo: Exclude<TipoAmbiente, 'ninguno'>, f: Fabrica, destino: AudioNode): Cama {
    const c = new Cama(f, destino, 0)
    switch (tipo) {
      case 'nave':
        camaNave(c, NIVEL.nave, true)
        break
      case 'orbita':
        camaNave(c, NIVEL.orbita, false)
        break
      case 'base':
        camaBase(c, NIVEL.base)
        break
      case 'eva':
        camaEva(c, this.p, NIVEL.eva)
        break
      case 'lanzamiento':
        camaLanzamiento(c, this.p, NIVEL.lanzamiento)
        break
      case 'descenso':
        camaDescenso(c, this.p, NIVEL.descenso)
        break
    }
    c.aplicar(this.p, f.ctx.currentTime)
    Object.assign(this.aplicados, this.p)
    c.aparecer(1, FUNDIDO_S)
    return c
  }

  private iniciarBucle(nombre: BucleSonido) {
    const f = this.fabrica
    if (!f || !this.busEventos || this.bucles[nombre]) return
    const v = this.volumenBucle[nombre]
    this.bucles[nombre] = nombre === 'alarma' ? crearAlarma(f, this.busEventos, v) : crearEjercicio(f, this.busEventos, v, () => this.ritmo)
    this.atenuarAmbiente()
  }

  /** Con la alarma sonando el ambiente baja a la mitad: se oye la alarma sin subirla más. */
  private atenuarAmbiente() {
    if (!this.ctx || !this.busAmbiente) return
    this.busAmbiente.gain.setTargetAtTime(this.bucles.alarma ? 0.5 : 1, this.ctx.currentTime, 0.15)
  }

  private copiar(p: ParametrosAmbiente) {
    const destino = this.p as unknown as Record<string, number>
    const origen = p as unknown as Record<string, unknown>
    for (const k in origen) {
      if (!(k in PARAMETROS_INICIALES)) continue
      const v = origen[k]
      if (typeof v === 'number' && Number.isFinite(v)) destino[k] = v
    }
  }

  private aplicarDiferido = () => {
    this.relojParametros = 0
    this.aplicarAhora()
  }

  private aplicarAhora() {
    this.ultimaAplicacion = performance.now()
    if (!this.cama || !this.ctx) return
    let cambio = false
    for (const k of CLAVES) {
      if (Math.abs(this.p[k] - this.aplicados[k]) > 1e-4) {
        this.aplicados[k] = this.p[k]
        cambio = true
      }
    }
    if (cambio) this.cama.aplicar(this.p, this.ctx.currentTime)
  }

  private aplicarMaestro() {
    if (!this.ctx || !this.maestro) return
    const g = this.maestro.gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.setTargetAtTime(this.silenciado ? 0 : this.vol, t, 0.04)
  }

  /** Algunos navegadores suspenden el audio en segundo plano; al volver se intenta retomar. */
  private alVolver = () => {
    if (document.visibilityState === 'visible' && this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().then(this.emitir, this.emitir)
    }
  }

  private emitir = () => {
    const activo = this.ctx?.state === 'running'
    const f = this.foto
    if (f.activo === activo && f.silenciado === this.silenciado && f.volumen === this.vol) return
    this.foto = { activo, silenciado: this.silenciado, volumen: this.vol }
    for (const fn of this.oyentes) fn()
  }
}

export const motor = new Motor()

// En desarrollo, al recargar este módulo se cierra el contexto viejo para que no suenen dos
if (import.meta.hot) import.meta.hot.dispose(() => motor.cerrar())
