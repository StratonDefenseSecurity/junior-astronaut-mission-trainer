// El cielo real "en el infinito": estrellas (XHIP), Vía Láctea, constelaciones, Sol, planetas y
// Luna en sus posiciones verdaderas para la fecha, vistos desde donde está el observador.
//
// Cómo se dibuja: todo cuelga de un grupo que cada cuadro se centra en la cámara (así nunca se
// llega a las estrellas) y se dibuja primero (renderOrder muy bajo), sin escribir profundidad y
// con mezcla aditiva. Cualquier geometría opaca que venga después (paredes, el casco, el suelo de
// Marte) lo tapa, y por un hueco de ventana se ve el cielo. Por eso los rótulos son sprites en la
// escena y no HTML: un rótulo HTML se vería encima de las paredes.
//
// Detrás del cielo el fondo tiene que ser negro (o usar fondoNegro). Montarlo una sola vez por
// escena; ignora las transformaciones de sus padres (su giro es `orientacion`, en el mundo).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CONSTELACIONES, ESTRELLAS, ESTRELLAS_CON_NOMBRE, N_ESTRELLAS, VIA_LACTEA } from './datos'
import { CUERPOS, NOMBRE_CUERPO, cuerposVisibles, type Cuerpo, type InfoCuerpo, type Vec3 } from './astro'
import { colorDesdeBV } from './color'
import { radecAEscena } from './marco'

export { orientacionHacia } from './orientacion'
export { cuerposVisibles, orientacionSuperficie, alturaGrados } from './astro'

export interface PropsCielo {
  /** Fecha y hora de la misión: fija dónde están el Sol, los planetas y la Luna. */
  fecha: Date
  /** Posición heliocéntrica del observador, EQJ, en UA (p. ej. posicionNave o vectorHelio('Marte')). */
  observador: Vec3
  /** Radio de la esfera celeste en unidades de escena (debe quedar dentro del plano lejano). Por defecto 2000. */
  radio?: number
  /** Visibilidad general de estrellas, planetas y Vía Láctea: 1 espacio profundo, ~0.8 noche en Marte, ~0 de día. El Sol no cambia. */
  brillo?: number
  /** Hay atmósfera (superficie de Marte o de la Tierra): las estrellas centellean un poco. En el espacio, no. */
  atmosfera?: boolean
  /** Amplitud del centelleo con atmósfera (0..1). Por defecto 0.12; la atmósfera de Marte es tenue, conviene menos. */
  centelleo?: number
  /** Rótulos con el nombre del Sol, los planetas y la Luna (esta solo si se distingue de la Tierra). */
  etiquetas?: boolean
  /** Figuras de las 88 constelaciones y nombre de las 14 más conocidas. */
  constelaciones?: boolean
  /** Nombres de ~30 estrellas famosas. Por defecto igual que `constelaciones`. */
  nombresEstrellas?: boolean
  /** Giro de la esfera celeste en el mundo (ver orientacionHacia y orientacionSuperficie). Puede mutarse cada cuadro. */
  orientacion?: THREE.Quaternion
  /** Cuerpos que no se dibujan como punto porque la escena dibuja su globo detallado. */
  ocultarCuerpos?: readonly Cuerpo[]
  /** Recibe dirección (escena), distancia y tamaño angular de cada cuerpo cuando cambian fecha u observador. */
  onCuerpos?: (cuerpos: Record<Cuerpo, InfoCuerpo>) => void
  /** Pinta una esfera negra detrás del cielo, por si el fondo de la escena no es negro. */
  fondoNegro?: boolean
}

export function Cielo({
  fecha,
  observador,
  radio = 2000,
  brillo = 1,
  atmosfera = false,
  centelleo = 0.12,
  etiquetas = false,
  constelaciones = false,
  nombresEstrellas,
  orientacion,
  ocultarCuerpos,
  onCuerpos,
  fondoNegro = false,
}: PropsCielo) {
  const motor = useMemo(() => new MotorCielo(radio), [radio])
  useEffect(() => () => motor.liberar(), [motor])

  const t = fecha.getTime()
  const { x, y, z } = observador
  const cuerpos = useMemo(() => cuerposVisibles(new Date(t), { x, y, z }), [t, x, y, z])
  const ocultos = (ocultarCuerpos ?? []).join(',')
  const alAvisar = useRef(onCuerpos)
  alAvisar.current = onCuerpos

  useEffect(() => {
    motor.actualizarCuerpos(cuerpos, new Set(ocultos.split(',')))
    alAvisar.current?.(cuerpos)
  }, [motor, cuerpos, ocultos])

  useEffect(() => {
    motor.configurar({
      brillo: Math.min(1, Math.max(0, brillo)),
      centelleo: atmosfera ? centelleo : 0,
      etiquetas,
      constelaciones,
      nombresEstrellas: nombresEstrellas ?? constelaciones,
      fondoNegro,
    })
  }, [motor, brillo, atmosfera, centelleo, etiquetas, constelaciones, nombresEstrellas, fondoNegro])

  useFrame((estado) => motor.cuadro(estado.camera, estado.size.height, estado.clock.elapsedTime, estado.viewport.dpr, orientacion))

  return <primitive object={motor.raiz} />
}

// ======================================================================= motor

const ORDEN = -1000
const IDENTIDAD = new THREE.Quaternion()
const UNO = new THREE.Vector3(1, 1, 1)
/** El cielo no se puede tocar: así ningún raycaster del juego pierde tiempo ni lo choca. */
const sinRayos = () => {}

/** Cuerpos que se dibujan como punto (el Sol va aparte, con su disco). */
const PUNTOS: readonly Cuerpo[] = ['Mercurio', 'Venus', 'Tierra', 'Luna', 'Marte', 'Jupiter', 'Saturno']

/**
 * Tinte de cada cuerpo en la luz reflejada, solo visual y aproximado (no es una medida):
 * Tierra algo azulada, Marte rojizo, Júpiter crema, Saturno dorado pálido.
 */
const TINTE: Record<Cuerpo, [number, number, number]> = {
  Sol: [1, 1, 1],
  Mercurio: [0.85, 0.82, 0.78],
  Venus: [1.0, 0.96, 0.86],
  Tierra: [0.7, 0.82, 1.0],
  Luna: [0.9, 0.9, 0.88],
  Marte: [1.0, 0.62, 0.42],
  Jupiter: [1.0, 0.93, 0.8],
  Saturno: [1.0, 0.88, 0.62],
}

/** Más allá de este diámetro aparente un punto ya no representa al cuerpo: la escena debe dibujar su globo. */
const TAMANO_MAX_PUNTO_RAD = THREE.MathUtils.degToRad(2)

const VERTICE_PUNTOS = /* glsl */ `
attribute float aMag;
attribute vec3 aColor;
uniform float uPixel;
uniform float uBrillo;
uniform float uTiempo;
uniform float uCentelleo;
varying vec3 vColor;
varying float vInten;
varying float vTam;
varying float vSigma;
varying float vHalo;

float azar(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float m = aMag;
  // Magnitud límite: con el cielo menos oscuro (brillo bajo) se apagan primero las débiles.
  float mLim = 2.0 + 4.5 * uBrillo;
  float apagado = clamp(mLim + 0.5 - m, 0.0, 1.0);
  // Intensidad del núcleo: crece con el flujo (10^(-0.4 m)) atenuado a la mitad en escala
  // logarítmica para una pantalla, y satura en magnitud 2; las más brillantes crecen en tamaño.
  float inten = min(1.0, pow(10.0, -0.2 * (m - 2.0))) * uBrillo * apagado;
  if (uCentelleo > 0.0) {
    // Centelleo: más fuerte cerca del horizonte (más aire en el camino). +Y del mundo = cenit.
    float h = azar(position);
    float alt = clamp(normalize((modelMatrix * vec4(position, 0.0)).xyz).y, 0.0, 1.0);
    float amp = uCentelleo * mix(2.0, 0.6, alt);
    inten *= 1.0 + amp * (0.6 * sin(uTiempo * (6.0 + 5.0 * h) + h * 40.0) + 0.4 * sin(uTiempo * (13.0 + 7.0 * h) + h * 91.0));
  }
  float extra = max(0.0, 2.5 - m);
  vSigma = (0.75 + 0.35 * extra) * uPixel;
  vHalo = clamp(0.06 * extra, 0.0, 0.6);
  float radio = vHalo > 0.0 ? vSigma * 3.5 : vSigma;
  vTam = min(6.0 * radio, 96.0 * uPixel);
  vInten = inten;
  vColor = aColor;
  gl_PointSize = inten > 0.002 ? vTam : 0.0;
}
`

const FRAGMENTO_PUNTOS = /* glsl */ `
varying vec3 vColor;
varying float vInten;
varying float vTam;
varying float vSigma;
varying float vHalo;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * vTam;
  float r2 = dot(p, p);
  float nucleo = exp(-r2 / (2.0 * vSigma * vSigma));
  float hs = vSigma * 3.5;
  float halo = vHalo * exp(-r2 / (2.0 * hs * hs));
  float a = (nucleo + halo) * vInten;
  if (a < 0.002) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`

const VERTICE_VIA = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENTO_VIA = /* glsl */ `
uniform sampler2D uMapa;
uniform mat3 uGal;
uniform float uIntensidad;
varying vec3 vDir;
const float PI = 3.141592653589793;
void main() {
  vec3 d = normalize(vDir);
  // Escena -> EQJ (inverso de marco.ts) -> galácticas.
  vec3 g = uGal * vec3(d.x, -d.z, d.y);
  float u = fract(atan(g.y, g.x) / (2.0 * PI));
  float v = (asin(clamp(g.z, -1.0, 1.0)) + 0.5 * PI) / PI;
  float n = texture2D(uMapa, vec2(u, v)).r;
  gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * uIntensidad * pow(n, 1.2), 1.0);
  #include <colorspace_fragment>
}
`

function materialPuntos(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uPixel: { value: 1 }, uBrillo: { value: 1 }, uTiempo: { value: 0 }, uCentelleo: { value: 0 } },
    vertexShader: VERTICE_PUNTOS,
    fragmentShader: FRAGMENTO_PUNTOS,
    blending: THREE.AdditiveBlending,
    transparent: false,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  })
}

/** Textura radial generada (sin archivos): `f(r)` con r de 0 (centro) a 1 (borde) da la intensidad. */
function texturaRadial(n: number, color: [number, number, number], f: (r: number) => number): THREE.DataTexture {
  const datos = new Uint8Array(n * n * 4)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const r = Math.hypot((i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5) * 2
      const v = Math.max(0, Math.min(1, f(r)))
      const k = (j * n + i) * 4
      datos[k] = Math.round(255 * v * color[0])
      datos[k + 1] = Math.round(255 * v * color[1])
      datos[k + 2] = Math.round(255 * v * color[2])
      datos[k + 3] = 255
    }
  }
  const t = new THREE.DataTexture(datos, n, n, THREE.RGBAFormat)
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}

function materialSprite(mapa: THREE.Texture): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map: mapa,
    blending: THREE.AdditiveBlending,
    transparent: false,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    fog: false,
  })
}

/** Vía Láctea: decodifica la grilla galáctica de datos.ts y la suaviza (≈1°) para que no se vean celdas. */
function texturaViaLactea(): THREE.DataTexture {
  const { ancho, alto, niveles, rle } = VIA_LACTEA
  const a = new Float32Array(ancho * alto)
  let k = 0
  for (let i = 0; i < rle.length; ) {
    const v = rle.charCodeAt(i) - 65
    let j = i + 1
    // El largo va en base 36 con minúsculas; la próxima mayúscula abre el tramo siguiente.
    while (j < rle.length && !(rle.charCodeAt(j) >= 65 && rle.charCodeAt(j) <= 90)) j++
    const largo = parseInt(rle.slice(i + 1, j), 36)
    a.fill(v / niveles, k, k + largo)
    k += largo
    i = j
  }
  const b = new Float32Array(a.length)
  const R = 2
  for (let pasada = 0; pasada < 2; pasada++) {
    // Horizontal (la longitud galáctica da la vuelta) y luego vertical.
    for (let f = 0; f < alto; f++) {
      for (let c = 0; c < ancho; c++) {
        let s = 0
        for (let d = -R; d <= R; d++) s += a[f * ancho + ((c + d + ancho) % ancho)]
        b[f * ancho + c] = s / (2 * R + 1)
      }
    }
    for (let f = 0; f < alto; f++) {
      for (let c = 0; c < ancho; c++) {
        let s = 0
        for (let d = -R; d <= R; d++) s += b[Math.min(alto - 1, Math.max(0, f + d)) * ancho + c]
        a[f * ancho + c] = s / (2 * R + 1)
      }
    }
  }
  const bytes = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) bytes[i] = Math.round(255 * Math.min(1, a[i]))
  const t = new THREE.DataTexture(bytes, ancho, alto, THREE.RedFormat, THREE.UnsignedByteType)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}

interface Etiqueta {
  sprite: THREE.Sprite
  altoPx: number
  aspecto: number
}

/** Rótulo de texto como sprite (lo tapan las paredes como a todo el cielo). */
function crearEtiqueta(texto: string, color: string, px: number): Etiqueta {
  const escala = 2 // canvas al doble para que el texto se vea nítido
  const lienzo = document.createElement('canvas')
  const ctx = lienzo.getContext('2d')
  const fuente = `500 ${px * escala}px system-ui, "Segoe UI", sans-serif`
  const margen = 9 * escala // separación del punto, a la izquierda del texto
  let ancho = px * escala * texto.length * 0.6
  if (ctx) {
    ctx.font = fuente
    ancho = ctx.measureText(texto).width
  }
  lienzo.width = Math.ceil(margen + ancho + 4)
  lienzo.height = Math.ceil(px * escala * 1.4)
  if (ctx) {
    ctx.font = fuente
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.fillText(texto, margen, lienzo.height / 2)
  }
  const mapa = new THREE.CanvasTexture(lienzo)
  mapa.colorSpace = THREE.SRGBColorSpace
  mapa.minFilter = THREE.LinearFilter
  mapa.generateMipmaps = false
  const sprite = new THREE.Sprite(materialSprite(mapa))
  sprite.center.set(0, 0.5)
  sprite.renderOrder = 3
  sprite.frustumCulled = false
  return { sprite, altoPx: lienzo.height / escala, aspecto: lienzo.width / lienzo.height }
}

interface Config {
  brillo: number
  centelleo: number
  etiquetas: boolean
  constelaciones: boolean
  nombresEstrellas: boolean
  fondoNegro: boolean
}

class MotorCielo {
  readonly raiz = new THREE.Group()
  private readonly radio: number
  private readonly matEstrellas = materialPuntos()
  private readonly matCuerpos = materialPuntos()
  private readonly geoCuerpos = new THREE.BufferGeometry()
  private readonly lineas: THREE.LineSegments
  private readonly fondo: THREE.Mesh
  private readonly via: THREE.Mesh
  private readonly solDisco: THREE.Sprite
  private readonly solBrillo: THREE.Sprite
  private readonly etiquetasCuerpos = new Map<Cuerpo, Etiqueta>()
  private readonly etiquetasConst: Etiqueta[] = []
  private readonly etiquetasEstrellas: Etiqueta[] = []
  private readonly liberables: { dispose(): void }[] = []
  private config: Config = { brillo: 1, centelleo: 0, etiquetas: false, constelaciones: false, nombresEstrellas: false, fondoNegro: false }
  private solDiametroRad = 0
  private separacionLunaRad = 0
  private lunaRotulable = false
  private k = -1
  private readonly pos = new THREE.Vector3()

  constructor(radio: number) {
    this.radio = radio
    const r = this.raiz
    r.name = 'Cielo'
    r.renderOrder = ORDEN
    // La matriz de mundo se fija a mano cada cuadro (centrada en la cámara, girada con
    // `orientacion`), sin heredar la de los padres.
    r.matrixAutoUpdate = false
    r.matrixWorldAutoUpdate = false

    // Fondo negro opcional.
    const matFondo = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false })
    this.fondo = this.agregar(new THREE.Mesh(new THREE.SphereGeometry(radio * 1.02, 16, 8), matFondo), 0)
    this.fondo.visible = false

    // Vía Láctea.
    const mapaVia = texturaViaLactea()
    this.liberables.push(mapaVia)
    const matVia = new THREE.ShaderMaterial({
      uniforms: {
        uMapa: { value: mapaVia },
        uIntensidad: { value: 0.055 },
        // ICRS/J2000 -> galácticas (Hipparcos, vol. 1, ec. 1.5.11).
        uGal: {
          value: new THREE.Matrix3().set(
            -0.0548755604, -0.8734370902, -0.4838350155,
            0.4941094279, -0.44482963, 0.7469822445,
            -0.867666149, -0.1980763734, 0.4559837762,
          ),
        },
      },
      vertexShader: VERTICE_VIA,
      fragmentShader: FRAGMENTO_VIA,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: false,
      depthWrite: false,
      toneMapped: false,
    })
    this.via = this.agregar(new THREE.Mesh(new THREE.SphereGeometry(radio * 1.01, 96, 48), matVia), 1)

    // Figuras de constelaciones (un solo dibujo para todas).
    const segs: number[] = []
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const rl = radio * 0.999
    for (const c of CONSTELACIONES) {
      for (const tramo of c.lineas) {
        for (let i = 0; i + 3 < tramo.length; i += 2) {
          radecAEscena(tramo[i], tramo[i + 1], a).multiplyScalar(rl)
          radecAEscena(tramo[i + 2], tramo[i + 3], b).multiplyScalar(rl)
          segs.push(a.x, a.y, a.z, b.x, b.y, b.z)
        }
      }
    }
    const geoL = new THREE.BufferGeometry()
    geoL.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3))
    const matL = new THREE.LineBasicMaterial({ color: 0x000000, blending: THREE.AdditiveBlending, transparent: false, depthWrite: false, toneMapped: false, fog: false })
    this.lineas = this.agregar(new THREE.LineSegments(geoL, matL), 2)
    this.lineas.visible = false

    // Estrellas: un solo THREE.Points para las ~5000.
    const n = N_ESTRELLAS
    const posiciones = new Float32Array(n * 3)
    const mags = new Float32Array(n)
    const colores = new Float32Array(n * 3)
    const col: [number, number, number] = [1, 1, 1]
    for (let i = 0; i < n; i++) {
      radecAEscena(ESTRELLAS[i * 4] as number, ESTRELLAS[i * 4 + 1] as number, a).multiplyScalar(radio)
      posiciones.set([a.x, a.y, a.z], i * 3)
      mags[i] = ESTRELLAS[i * 4 + 2] as number
      colorDesdeBV(ESTRELLAS[i * 4 + 3], col)
      colores.set(col, i * 3)
    }
    const geoE = new THREE.BufferGeometry()
    geoE.setAttribute('position', new THREE.BufferAttribute(posiciones, 3))
    geoE.setAttribute('aMag', new THREE.BufferAttribute(mags, 1))
    geoE.setAttribute('aColor', new THREE.BufferAttribute(colores, 3))
    this.agregar(new THREE.Points(geoE, this.matEstrellas), 3)

    // Planetas y Luna: otro THREE.Points pequeño que se actualiza al cambiar fecha u observador.
    const m = PUNTOS.length
    this.geoCuerpos.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m * 3), 3).setUsage(THREE.DynamicDrawUsage))
    this.geoCuerpos.setAttribute('aMag', new THREE.BufferAttribute(new Float32Array(m).fill(99), 1).setUsage(THREE.DynamicDrawUsage))
    const tintes = new Float32Array(m * 3)
    PUNTOS.forEach((c, i) => tintes.set(TINTE[c], i * 3))
    this.geoCuerpos.setAttribute('aColor', new THREE.BufferAttribute(tintes, 3))
    this.agregar(new THREE.Points(this.geoCuerpos, this.matCuerpos), 4)

    // Sol: disco con oscurecimiento al borde (ley lineal con u = 0.6, aproximación visual) y
    // resplandor. El color sale del B-V solar (0.65).
    const colSol = colorDesdeBV(0.65)
    const texDisco = texturaRadial(64, colSol, (r) => (r < 1 ? (1 - 0.6 * (1 - Math.sqrt(1 - r * r))) * Math.min(1, (1 - r) * 20) : 0))
    const texBrillo = texturaRadial(128, colSol, (r) => (0.55 * Math.exp(-r * 9) + 0.12 * Math.exp(-r * 3)) * (1 - r) * (1 - r))
    this.solBrillo = this.agregar(new THREE.Sprite(materialSprite(texBrillo)), 5)
    this.solDisco = this.agregar(new THREE.Sprite(materialSprite(texDisco)), 6)
    this.solDisco.visible = this.solBrillo.visible = false

    // Rótulos.
    for (const c of CUERPOS) {
      const e = crearEtiqueta(NOMBRE_CUERPO[c], c === 'Sol' ? '#fff3c8' : '#ffe2b0', 13)
      e.sprite.visible = false
      this.etiquetasCuerpos.set(c, this.agregarEtiqueta(e))
    }
    for (const c of CONSTELACIONES) {
      if (!c.famosa) continue
      const e = crearEtiqueta(c.nombre.toUpperCase(), '#6f8fc4', 11)
      radecAEscena(c.etiqueta[0], c.etiqueta[1], e.sprite.position).multiplyScalar(radio * 0.97)
      e.sprite.visible = false
      this.etiquetasConst.push(this.agregarEtiqueta(e))
    }
    for (const s of ESTRELLAS_CON_NOMBRE) {
      const e = crearEtiqueta(s.nombre, '#a9c1e6', 11)
      radecAEscena(ESTRELLAS[s.indice * 4] as number, ESTRELLAS[s.indice * 4 + 1] as number, e.sprite.position).multiplyScalar(radio * 0.97)
      e.sprite.visible = false
      this.etiquetasEstrellas.push(this.agregarEtiqueta(e))
    }
  }

  private agregar<T extends THREE.Object3D>(o: T, orden: number): T {
    o.renderOrder = orden
    o.frustumCulled = false
    o.raycast = sinRayos
    this.raiz.add(o)
    return o
  }

  private agregarEtiqueta(e: Etiqueta): Etiqueta {
    e.sprite.raycast = sinRayos
    this.raiz.add(e.sprite)
    return e
  }

  configurar(c: Config) {
    this.config = c
    for (const mat of [this.matEstrellas, this.matCuerpos]) mat.uniforms.uBrillo.value = c.brillo
    this.matEstrellas.uniforms.uCentelleo.value = c.centelleo
    ;(this.via.material as THREE.ShaderMaterial).uniforms.uIntensidad.value = 0.055 * c.brillo
    this.via.visible = c.brillo > 0.01
    ;(this.lineas.material as THREE.LineBasicMaterial).color.setRGB(0.1, 0.16, 0.3).multiplyScalar(Math.max(0.25, c.brillo))
    this.lineas.visible = c.constelaciones
    for (const e of this.etiquetasConst) e.sprite.visible = c.constelaciones
    for (const e of this.etiquetasEstrellas) e.sprite.visible = c.nombresEstrellas
    this.fondo.visible = c.fondoNegro
    this.aplicarVisibilidadCuerpos()
  }

  /** Cuerpos que se dibujan como punto (o disco, el Sol). */
  private readonly visiblesCuerpos = new Map<Cuerpo, boolean>()
  /** Cuerpos que se pueden rotular: vistos desde fuera y todavía pequeños, aunque la escena dibuje su globo. */
  private readonly rotulables = new Map<Cuerpo, boolean>()

  actualizarCuerpos(cuerpos: Record<Cuerpo, InfoCuerpo>, ocultos: Set<string>) {
    const pos = this.geoCuerpos.getAttribute('position') as THREE.BufferAttribute
    const mag = this.geoCuerpos.getAttribute('aMag') as THREE.BufferAttribute
    const d = this.pos
    for (const c of CUERPOS) {
      const i = cuerpos[c]
      const pequeno = i.visible && (c === 'Sol' || i.tamanoAngularRad < TAMANO_MAX_PUNTO_RAD)
      const dibujar = pequeno && !ocultos.has(c)
      this.visiblesCuerpos.set(c, dibujar)
      this.rotulables.set(c, pequeno && (c === 'Sol' || i.magnitud < 6.5))
      d.copy(i.direccion)
      const e = this.etiquetasCuerpos.get(c)
      if (e) e.sprite.position.copy(d).multiplyScalar(this.radio * 0.97)
      const k = PUNTOS.indexOf(c)
      if (k >= 0) {
        pos.setXYZ(k, d.x * this.radio * 0.995, d.y * this.radio * 0.995, d.z * this.radio * 0.995)
        mag.setX(k, dibujar ? i.magnitud : 99)
      }
    }
    pos.needsUpdate = true
    mag.needsUpdate = true
    // Sol.
    const sol = cuerpos.Sol
    this.solDiametroRad = sol.tamanoAngularRad
    this.solDisco.position.copy(sol.direccion).multiplyScalar(this.radio * 0.98)
    this.solBrillo.position.copy(this.solDisco.position)
    // La Luna se rotula aparte solo si se separa de la Tierra en pantalla (se revisa por cuadro).
    const t = cuerpos.Tierra
    const l = cuerpos.Luna
    this.separacionLunaRad = t.direccion.angleTo(l.direccion)
    this.lunaRotulable = !!this.rotulables.get('Luna')
    this.k = -1 // fuerza a recalcular tamaños
    this.aplicarVisibilidadCuerpos()
  }

  private aplicarVisibilidadCuerpos() {
    const { etiquetas, brillo } = this.config
    const sol = !!this.visiblesCuerpos.get('Sol')
    this.solDisco.visible = this.solBrillo.visible = sol
    for (const c of CUERPOS) {
      const e = this.etiquetasCuerpos.get(c)
      if (!e) continue
      const ok = !!this.rotulables.get(c) && (c === 'Sol' || brillo > 0.05)
      e.sprite.visible = etiquetas && ok && c !== 'Luna'
    }
  }

  cuadro(camara: THREE.Camera, altoPx: number, tiempo: number, dpr: number, orientacion?: THREE.Quaternion) {
    camara.getWorldPosition(this.pos)
    this.raiz.matrixWorld.compose(this.pos, orientacion ?? IDENTIDAD, UNO)
    this.matEstrellas.uniforms.uTiempo.value = tiempo
    this.matEstrellas.uniforms.uPixel.value = dpr
    this.matCuerpos.uniforms.uPixel.value = dpr

    // Unidades de escena por píxel de pantalla a la distancia de los rótulos.
    const cam = camara as THREE.PerspectiveCamera
    if (!cam.isPerspectiveCamera || altoPx <= 0) return
    const tanMedia = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) / cam.zoom
    const k = (2 * this.radio * 0.97 * tanMedia) / altoPx
    if (k !== this.k) {
      this.k = k
      for (const e of this.etiquetasCuerpos.values()) this.escalarEtiqueta(e, k)
      for (const e of this.etiquetasConst) this.escalarEtiqueta(e, k)
      for (const e of this.etiquetasEstrellas) this.escalarEtiqueta(e, k)
      // Disco solar con su tamaño angular real (mínimo 3 px para que se vea redondo) y un
      // resplandor de unos 12° de diámetro.
      const dSol = Math.max(this.solDiametroRad * this.radio * 0.98, 3 * k)
      this.solDisco.scale.set(dSol, dSol, 1)
      const dBrillo = Math.max(THREE.MathUtils.degToRad(12) * this.radio, 60 * k)
      this.solBrillo.scale.set(dBrillo, dBrillo, 1)
    }
    const luna = this.etiquetasCuerpos.get('Luna')
    if (luna) {
      const pxPorRad = altoPx / (2 * tanMedia)
      luna.sprite.visible = this.config.etiquetas && this.lunaRotulable && this.config.brillo > 0.05 && this.separacionLunaRad * pxPorRad > 18
    }
  }

  private escalarEtiqueta(e: Etiqueta, k: number) {
    const h = e.altoPx * k
    e.sprite.scale.set(h * e.aspecto, h, 1)
  }

  /**
   * Libera la memoria de la GPU. No saca el grupo de la escena (eso lo hace React) y se puede
   * llamar más de una vez: si el motor se vuelve a usar (StrictMode monta dos veces), three.js
   * vuelve a subir lo que haga falta.
   */
  liberar() {
    this.raiz.traverse((o) => {
      const m = o as THREE.Mesh
      // La geometría de los sprites es compartida por todos los sprites de three.js: no se toca.
      if (m.geometry && !(o as THREE.Sprite).isSprite) m.geometry.dispose()
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []
      for (const mat of mats) {
        const mapa = (mat as THREE.SpriteMaterial).map
        if (mapa) mapa.dispose()
        mat.dispose()
      }
    })
    for (const l of this.liberables) l.dispose()
  }
}
