// El personaje de cada jugador, hecho con geometría propia (sin modelos externos): cara con
// ojos que parpadean y miran, cejas, nariz, boca, orejas y pelo; cuerpo articulado (hombros,
// codos, caderas, rodillas). Dentro viste ropa de a bordo: polo de su color y pantalón de
// bolsillos. Fuera lleva un traje de exploración al estilo del xEMU de NASA: casco de burbuja con
// visor dorado levantado (así se le ve la cara), carcasa con focos y cámaras, mochila de soporte
// vital (PLSS), módulo de pantalla y mandos en el pecho, rodamientos en las articulaciones,
// guantes, botas con suela de tacos y parche de misión. El detalle más fino, solo en calidad alta.
//
// Las animaciones dependen de lo que esté haciendo: de pie, andando, flotando sin gravedad,
// corriendo en la cinta, pedaleando, durmiendo, trabajando en una consola, encogido en el
// refugio o tumbado. Todo se calcula en cada fotograma sin crear objetos nuevos.
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { trajePorDefecto, type Traje } from '@shared/types'
import { useGraficos } from '../graficos'
import { empolvar, texturaParche } from './procedural'

export type Accion = 'pie' | 'flotar' | 'correr' | 'bici' | 'dormir' | 'consola' | 'refugio' | 'tumbado'

export interface Pose {
  x: number
  z: number
  giro: number
  /** 0 quieto, 1 andando (o impulsándose, si flota). */
  andando: number
  /** Fase del ciclo de pasos. */
  paso: number
  /** Altura extra sobre el suelo (al flotar o en la litera de arriba). */
  y?: number
  accion?: Accion
  /** Rapidez sobre el suelo, en m/s. Decide la mezcla entre andar y correr. */
  velocidad?: number
}

// ---------- Marcha ----------
// Modelo sencillo de la marcha: el pie apoyado barre un arco de ±A radianes alrededor
// de la cadera (pierna de PIERNA metros) mientras el cuerpo avanza β·L, donde β es la
// fracción del ciclo que cada pie pasa en el suelo y L la zancada (dos pasos). De ahí
// sale L = 2·PIERNA·sen(A)/β, y la fase avanza 2π por cada L recorrida: así el pie no
// patina. Andar: β≈0.6, sin fase de vuelo. Correr: β≈0.38, con vuelo. En Marte (0.38 g)
// la marcha natural es el trote a saltos de las misiones Apollo: menos pasos por
// segundo, zancada larga y un vuelo largo entre apoyos.

const PIERNA = 0.9
/** Rapidez (m/s) a la que empieza y termina la transición de andar a correr. */
const ANDAR_HASTA = 3.5
const CORRER_DESDE = 4.4

export interface Marcha {
  /** 0 andar, 1 correr. */
  carrera: number
  /** Amplitud del giro de la cadera, en radianes. */
  amplitud: number
  /** Fracción del ciclo con el pie en el suelo. */
  apoyo: number
  /** Zancada (dos pasos), en metros. */
  zancada: number
}

export function marcha(v: number, gravedad: 'tierra' | 'marte' | 'cero'): Marcha {
  const carrera = THREE.MathUtils.smoothstep(v, ANDAR_HASTA, CORRER_DESDE)
  const marte = gravedad === 'marte'
  const lenta = THREE.MathUtils.clamp(v / 1.6, 0.35, 1)
  const amplitud = (marte ? THREE.MathUtils.lerp(0.55, 0.7, carrera) : THREE.MathUtils.lerp(0.72, 0.82, carrera)) * lenta
  const apoyo = marte ? THREE.MathUtils.lerp(0.32, 0.28, carrera) : THREE.MathUtils.lerp(0.6, 0.38, carrera)
  const zancada = Math.max(0.5, (2 * PIERNA * Math.sin(amplitud)) / apoyo)
  return { carrera, amplitud, apoyo, zancada }
}

/** Avanza la fase del ciclo de pasos según lo recorrido, para que los pies no patinen. */
export function avanzarPaso(paso: number, v: number, dt: number, gravedad: 'tierra' | 'marte' | 'cero'): number {
  if (v <= 0.01) return paso
  return paso + (dt * 2 * Math.PI * v) / marcha(v, gravedad).zancada
}

interface Props {
  traje: Traje
  /** Color del rol, para el distintivo del pecho. */
  distintivo: string
  /** Con casco y mochila (fuera) o sin ellos (dentro). */
  completo: boolean
  /** Devuelve la pose actual; se llama en cada fotograma. */
  pose?: () => Pose
  /** Tumbado (dormido o fuera de servicio). Atajo para la acción 'tumbado'. */
  tumbado?: boolean
  /** Gravedad del lugar: cambia la forma de andar. */
  gravedad?: 'tierra' | 'marte' | 'cero'
  /** Franjas de la bandera del hombro, de izquierda a derecha o de arriba abajo. */
  bandera?: { colores: string[]; vertical: boolean } | null
  etiqueta?: ReactNode
  escala?: number
}

// ---------- Geometrías compartidas por todos los personajes ----------

const G = {
  esfera: new THREE.SphereGeometry(1, 20, 14),
  esferaBaja: new THREE.SphereGeometry(1, 12, 8),
  capsula: new THREE.CapsuleGeometry(1, 1, 6, 12),
  cilindro: new THREE.CylinderGeometry(1, 1, 1, 14),
  caja: new THREE.BoxGeometry(1, 1, 1),
  // Casquete superior de una esfera: párpados y pelo.
  casquete: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
  pelo: new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
  disco: new THREE.CircleGeometry(1, 18),
  sonrisa: new THREE.TorusGeometry(1, 0.16, 6, 14, Math.PI * 0.62),
  anillo: new THREE.TorusGeometry(1, 0.12, 8, 28),
}

/** Bucles de pelo para el peinado rizado, siempre en el mismo sitio. */
const RIZOS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 * 1.618
  const alto = 0.25 + ((i * 7) % 10) / 14
  const r = Math.sqrt(1 - alto * alto)
  return [Math.cos(a) * r * 0.105, 0.02 + alto * 0.12, Math.sin(a) * r * 0.1 - 0.012] as const
})

const oscurecer = (hex: string, f: number) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString()

function Ojo({ x, iris, lado, parpado, piel }: { x: number; iris: string; lado: number; parpado: React.RefObject<THREE.Mesh>; piel: THREE.Material }) {
  return (
    <group position={[x, 0.018, 0.094]}>
      {/* esclerótica */}
      <mesh geometry={G.esfera} scale={[0.0165, 0.0155, 0.011]}>
        <meshStandardMaterial color="#f4f1ec" roughness={0.35} />
      </mesh>
      {/* iris, pupila y brillo: miran un poco hacia el centro */}
      <group position={[-lado * 0.0015, 0, 0.0098]}>
        <mesh geometry={G.disco} scale={0.0085}>
          <meshStandardMaterial color={iris} roughness={0.3} />
        </mesh>
        <mesh geometry={G.disco} scale={0.0042} position={[0, 0, 0.0004]}>
          <meshBasicMaterial color="#0b0b0d" />
        </mesh>
        <mesh geometry={G.esferaBaja} scale={0.0016} position={[0.003, 0.003, 0.0012]}>
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
      {/* párpado superior: gira hacia abajo para parpadear */}
      <mesh ref={parpado} geometry={G.casquete} scale={[0.0178, 0.0172, 0.0122]} material={piel} rotation={[-1.05, 0, 0]} />
    </group>
  )
}

export function Astronauta({ traje: trajeEntrada, distintivo, completo, pose, tumbado = false, gravedad = 'tierra', bandera, etiqueta, escala = 1 }: Props) {
  const traje = { ...trajePorDefecto(), ...trajeEntrada }
  const raiz = useRef<THREE.Group>(null)
  const cuerpo = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const cabeza = useRef<THREE.Group>(null)
  const piernas = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const rodillas = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const brazos = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const codos = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const parpados = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)]
  const saco = useRef<THREE.Mesh>(null)
  const estado = useRef({ parpadeo: 2 + Math.random() * 3, cerrar: 0, mirar: 0, mirarObjetivo: 0, semilla: Math.random() * 100 })

  // Materiales de este personaje (sus colores).
  const m = useMemo(() => {
    const piel = new THREE.MeshStandardMaterial({ color: traje.piel, roughness: 0.62, metalness: 0 })
    return {
      piel,
      labios: new THREE.MeshStandardMaterial({ color: oscurecer(traje.piel, 0.72), roughness: 0.5 }),
      pelo: new THREE.MeshStandardMaterial({ color: traje.pelo, roughness: 0.85 }),
      tela: new THREE.MeshStandardMaterial({ color: traje.color, roughness: 0.82 }),
      telaOscura: new THREE.MeshStandardMaterial({ color: oscurecer(traje.color, 0.78), roughness: 0.85 }),
      acento: new THREE.MeshStandardMaterial({ color: traje.acento, roughness: 0.6 }),
      gris: new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.55, metalness: 0.35 }),
      bota: new THREE.MeshStandardMaterial({ color: completo ? '#e5e7eb' : '#2b2f36', roughness: 0.7 }),
      eva: new THREE.MeshStandardMaterial({ color: '#f3f4f6', roughness: 0.75 }),
      guante: new THREE.MeshStandardMaterial({ color: completo ? '#e5e7eb' : traje.piel, roughness: completo ? 0.7 : 0.62 }),
      distintivo: new THREE.MeshStandardMaterial({ color: distintivo, emissive: distintivo, emissiveIntensity: 0.35, roughness: 0.5 }),
      cristal: new THREE.MeshPhysicalMaterial({ color: '#dbeafe', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, clearcoat: 1 }),
      visor: new THREE.MeshStandardMaterial({ color: traje.visor, roughness: 0.05, metalness: 0.95, emissive: traje.visor, emissiveIntensity: 0.06 }),
      saco: new THREE.MeshStandardMaterial({ color: '#4f6f9a', roughness: 0.9 }),
      // ropa de a bordo
      pantalon: new THREE.MeshStandardMaterial({ color: '#3f4552', roughness: 0.9 }),
      pantalonOscuro: new THREE.MeshStandardMaterial({ color: '#30353f', roughness: 0.9 }),
      boton: new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.4 }),
      suela: new THREE.MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.8 }),
      // traje de exploración
      rodamiento: new THREE.MeshStandardMaterial({ color: '#b9c0c9', roughness: 0.28, metalness: 0.85 }),
      pliegue: new THREE.MeshStandardMaterial({ color: '#d9dce1', roughness: 0.85 }),
      dcm: new THREE.MeshStandardMaterial({ color: '#c9cdd3', roughness: 0.5, metalness: 0.2 }),
      pantallaDcm: new THREE.MeshStandardMaterial({ color: '#06121a', emissive: '#3ddc97', emissiveIntensity: 0.7, roughness: 0.2 }),
      mando: new THREE.MeshStandardMaterial({ color: '#23272e', roughness: 0.5, metalness: 0.3 }),
      purga: new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.5 }),
      foco: new THREE.MeshBasicMaterial({ color: '#fff6e0' }),
      palma: new THREE.MeshStandardMaterial({ color: '#4a4f57', roughness: 0.9 }),
      botaTraje: empolvar(new THREE.MeshStandardMaterial({ color: '#d7dade', roughness: 0.8 }), 0.55),
      parche: new THREE.MeshStandardMaterial({ map: texturaParche(), roughness: 0.7 }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traje.piel, traje.pelo, traje.color, traje.acento, traje.visor, distintivo, completo])

  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m])

  const iris = useMemo(() => ['#4a2f1b', '#2f5f8a', '#3f6b3a', '#6b4a2b'][Math.abs(traje.pelo.charCodeAt(2) + traje.piel.charCodeAt(3)) % 4], [traje.pelo, traje.piel])

  useFrame(({ clock }, dtBruto) => {
    const dt = Math.min(0.05, dtBruto)
    const p = pose?.()
    const r = raiz.current
    const c = cuerpo.current
    if (!r || !c) return
    const t = clock.elapsedTime + estado.current.semilla
    const accion: Accion = tumbado ? 'tumbado' : (p?.accion ?? (gravedad === 'cero' ? 'flotar' : 'pie'))
    const andar = p?.andando ?? 0
    const fase = p?.paso ?? 0
    const v = p?.velocidad ?? andar * 3
    const mar = marcha(v, gravedad)
    const marte = gravedad === 'marte'
    // Mezcla del ciclo: 0 andar (péndulo invertido), 1 correr o trotar a saltos (con vuelo).
    const vuelo = marte ? 1 : mar.carrera

    if (p) {
      r.position.set(p.x, p.y ?? 0, p.z)
      // Girar hacia donde se avanza de forma suave y con un límite de velocidad angular,
      // sin saltos aunque la dirección cambie de golpe.
      let d = p.giro - r.rotation.y
      d = Math.atan2(Math.sin(d), Math.cos(d))
      const maximo = dt * (marte ? 6 : 9)
      r.rotation.y += THREE.MathUtils.clamp(d * Math.min(1, dt * 9), -maximo, maximo)
    }

    // ---- Postura del cuerpo entero ----
    let pitch = 0
    let roll = 0
    let alto = 0
    let ladeo = 0
    if (accion === 'tumbado') {
      pitch = -Math.PI / 2
      alto = 0.32
    } else if (accion === 'dormir' && gravedad !== 'cero') {
      pitch = -Math.PI / 2
      alto = 0.3
    } else if (accion === 'flotar') {
      // Sin gravedad el cuerpo se relaja: se inclina hacia donde avanza y se mece despacio.
      pitch = 0.65 * andar + Math.sin(t * 0.7) * 0.06
      roll = Math.sin(t * 0.5) * 0.07
      alto = Math.sin(t * 1.1) * 0.05
    } else if (accion === 'dormir') {
      roll = Math.sin(t * 0.3) * 0.03
      alto = Math.sin(t * 0.6) * 0.015
    } else if (accion === 'refugio') {
      alto = -0.45
    } else if (accion === 'bici') {
      alto = -0.28
      pitch = 0.18
    } else if (accion === 'correr') {
      alto = Math.abs(Math.sin(t * 9)) * 0.05
      pitch = 0.1
    } else if (andar > 0.05) {
      // Andando, la cadera está más alta a mitad del apoyo (piernas rectas, |cos| = 1) y
      // más baja con las dos piernas abiertas. Corriendo es al revés: lo más alto es el
      // vuelo y lo más bajo el apoyo, cuando la rodilla amortigua. En Marte el vuelo dura
      // más y sube más (0.38 g).
      const sube = marte ? 0.07 + 0.05 * mar.carrera : 0.05 + 0.02 * mar.carrera
      const andando = Math.abs(Math.cos(fase)) * 0.035
      const corriendo = Math.abs(Math.sin(fase)) * sube
      alto = THREE.MathUtils.lerp(andando, corriendo, vuelo) * andar - 0.02 * vuelo * andar
      ladeo = Math.sin(fase) * (marte ? 0.025 : 0.035) * andar
      pitch = (0.04 + 0.1 * mar.carrera + (marte ? 0.06 : 0)) * andar
    } else {
      alto = Math.sin(t * 1.6) * 0.004
    }
    c.rotation.x += (pitch - c.rotation.x) * Math.min(1, dt * 5)
    c.rotation.z += (roll + ladeo - c.rotation.z) * Math.min(1, dt * 5)
    const ritmo = accion === 'pie' && andar > 0.05 ? 22 : 8
    c.position.y += (alto - c.position.y) * Math.min(1, dt * ritmo)

    // Respirar: el pecho sube un poco.
    if (torso.current) torso.current.scale.y = 1 + Math.sin(t * (accion === 'correr' || accion === 'bici' ? 4 : 1.6)) * 0.012

    // ---- Extremidades ----
    let piernaA = 0
    let piernaB = 0
    let rodillaA = 0
    let rodillaB = 0
    let brazoA = 0.06
    let brazoB = 0.06
    let codoA = -0.12
    let codoB = -0.12
    let abrir = 0.08
    if (accion === 'correr') {
      const f = t * 9
      piernaA = Math.sin(f) * 0.75
      piernaB = -Math.sin(f) * 0.75
      rodillaA = 0.35 + Math.max(0, -Math.cos(f)) * 1.1
      rodillaB = 0.35 + Math.max(0, Math.cos(f)) * 1.1
      brazoA = -Math.sin(f) * 0.7
      brazoB = Math.sin(f) * 0.7
      codoA = codoB = -1.4
    } else if (accion === 'bici') {
      const f = t * 5.5
      piernaA = -1.15 + Math.sin(f) * 0.32
      piernaB = -1.15 - Math.sin(f) * 0.32
      rodillaA = 1.55 + Math.cos(f) * 0.35
      rodillaB = 1.55 - Math.cos(f) * 0.35
      brazoA = brazoB = -0.95
      codoA = codoB = -0.45
    } else if (accion === 'consola') {
      brazoA = -0.55 + Math.sin(t * 7) * 0.05
      brazoB = -0.55 + Math.sin(t * 6.3 + 1) * 0.05
      codoA = -1.05 + Math.sin(t * 9) * 0.06
      codoB = -1.05 + Math.sin(t * 8.1 + 2) * 0.06
      abrir = 0.18
    } else if (accion === 'refugio') {
      piernaA = piernaB = -1.65
      rodillaA = rodillaB = 2.3
      brazoA = brazoB = -0.85
      codoA = codoB = -1.2
      abrir = 0.28
    } else if (accion === 'flotar') {
      // Postura neutra de microgravedad: rodillas y codos medio doblados, brazos al frente.
      piernaA = -0.35 + Math.sin(t * 0.9) * 0.06
      piernaB = -0.25 - Math.sin(t * 0.9) * 0.06
      rodillaA = 0.75
      rodillaB = 0.6
      brazoA = -0.5 - andar * 0.6 + Math.sin(t * 0.8) * 0.08
      brazoB = -0.4 - andar * 0.6 - Math.sin(t * 0.8) * 0.08
      codoA = -0.7
      codoB = -0.8
      abrir = 0.35
    } else if (accion === 'dormir' && gravedad === 'cero') {
      brazoA = brazoB = -0.6
      codoA = codoB = -0.5
      rodillaA = rodillaB = 0.2
    } else if (andar > 0.05) {
      // Pierna A: ángulo s·A (positivo = pie atrás). Con cos > 0 va hacia atrás (apoyo) y
      // con cos < 0 hacia delante (balanceo, con la rodilla doblada para no rozar el suelo).
      const s = Math.sin(fase)
      const c = Math.cos(fase)
      const A = mar.amplitud
      piernaA = s * A * andar
      piernaB = -s * A * andar
      const balanceo = THREE.MathUtils.lerp(0.75, marte ? 1.15 : 1.45, vuelo)
      const amortigua = 0.25 * vuelo
      rodillaA = (Math.max(0, -c) * balanceo + Math.max(0, c) * amortigua) * andar + 0.05
      rodillaB = (Math.max(0, c) * balanceo + Math.max(0, -c) * amortigua) * andar + 0.05
      // Los brazos van al revés que la pierna de su lado. Con traje en Marte se balancean
      // poco y se separan del cuerpo para mantener el equilibrio.
      const brazo = marte ? 0.28 : THREE.MathUtils.lerp(0.42, 0.75, mar.carrera)
      brazoA = -s * brazo * andar
      brazoB = s * brazo * andar
      codoA = codoB = -(0.25 + 1.0 * mar.carrera + (marte ? 0.3 : 0)) * andar - 0.1
      abrir = 0.08 + (marte ? 0.18 : 0.04 * mar.carrera) * andar
    }
    // Los hombros giran al contrario que la cadera.
    if (torso.current) torso.current.rotation.y = accion === 'pie' && andar > 0.05 ? Math.sin(fase) * 0.09 * andar * (marte ? 0.5 : 1) : 0
    const k = Math.min(1, dt * (accion === 'pie' && andar > 0.05 ? 24 : 14))
    const ajustar = (g: THREE.Group | null, x: number, z = 0) => {
      if (!g) return
      g.rotation.x += (x - g.rotation.x) * k
      g.rotation.z += (z - g.rotation.z) * k
    }
    ajustar(piernas[0].current, piernaA, 0.04)
    ajustar(piernas[1].current, piernaB, -0.04)
    ajustar(rodillas[0].current, rodillaA)
    ajustar(rodillas[1].current, rodillaB)
    ajustar(brazos[0].current, brazoA, abrir)
    ajustar(brazos[1].current, brazoB, -abrir)
    ajustar(codos[0].current, codoA)
    ajustar(codos[1].current, codoB)

    // ---- Cabeza: mira alrededor de vez en cuando ----
    const e = estado.current
    if (Math.random() < dt * 0.25) e.mirarObjetivo = (Math.random() - 0.5) * 0.9
    e.mirar += (e.mirarObjetivo - e.mirar) * Math.min(1, dt * 2)
    if (cabeza.current) {
      const dormido = accion === 'dormir' || accion === 'tumbado'
      cabeza.current.rotation.y = dormido || accion === 'consola' || accion === 'correr' || accion === 'bici' ? 0 : e.mirar * (andar > 0.3 ? 0.3 : 1)
      cabeza.current.rotation.x = accion === 'consola' ? 0.25 : accion === 'refugio' ? 0.35 : dormido ? 0.05 : Math.sin(t * 0.4) * 0.04
    }

    // ---- Parpadeo (y ojos cerrados al dormir) ----
    e.parpadeo -= dt
    if (e.parpadeo <= 0) {
      e.cerrar = 0.16
      e.parpadeo = 2.5 + Math.random() * 4
    }
    e.cerrar = Math.max(0, e.cerrar - dt)
    const cerrado = accion === 'dormir' || accion === 'tumbado' ? 1 : e.cerrar > 0 ? 1 : 0
    for (const pr of parpados) {
      if (!pr.current) continue
      // Abierto: el casquete se echa hacia atrás; cerrado: tapa el ojo.
      const objetivo = cerrado ? 0.55 : -1.05
      pr.current.rotation.x += (objetivo - pr.current.rotation.x) * Math.min(1, dt * (cerrado ? 40 : 18))
    }
    if (saco.current) saco.current.visible = accion === 'dormir'
  })

  // ---- Medidas (metros) ----
  const grosor = completo ? 1.25 : 1
  const alta = useGraficos((s) => s.calidad) === 'alta'
  // Tela de cada parte: traje blanco fuera; dentro, polo arriba y pantalón abajo.
  const arriba = completo ? m.eva : m.tela
  const abajo = completo ? m.eva : m.pantalon

  return (
    <group ref={raiz} scale={escala}>
      <group ref={cuerpo}>
        {/* saco de dormir */}
        <mesh ref={saco} geometry={G.capsula} position={[0, 0.98, -0.02]} scale={[0.24, 0.62, 0.2]} material={m.saco} visible={false} />

        {/* ---- piernas ---- */}
        {[0, 1].map((i) => {
          const lado = i === 0 ? -1 : 1
          return (
            <group key={i} ref={piernas[i]} position={[lado * 0.1, 0.92, 0]}>
              <mesh geometry={G.capsula} position={[0, -0.22, 0]} scale={[0.075 * grosor, 0.15, 0.08 * grosor]} material={abajo} castShadow />
              {/* bolsillo lateral del muslo (pantalón de a bordo) */}
              {!completo && <mesh geometry={G.caja} position={[lado * 0.07, -0.2, 0.01]} scale={[0.02, 0.11, 0.09]} material={m.pantalonOscuro} />}
              {/* franja del traje con el color del jugador y rodamiento de la cadera */}
              {completo && <mesh geometry={G.cilindro} position={[0, -0.12, 0]} scale={[0.079 * grosor, 0.03, 0.084 * grosor]} material={m.acento} />}
              {completo && <mesh geometry={G.cilindro} position={[0, -0.03, 0]} scale={[0.1, 0.028, 0.104]} material={m.rodamiento} />}
              <group ref={rodillas[i]} position={[0, -0.44, 0]}>
                <mesh geometry={G.capsula} position={[0, -0.2, 0]} scale={[0.062 * grosor, 0.15, 0.066 * grosor]} material={abajo} castShadow />
                {/* pliegues de la rodilla del traje */}
                {completo && alta && [0.02, -0.025].map((y) => <mesh key={y} geometry={G.cilindro} position={[0, y, 0]} scale={[0.084, 0.016, 0.088]} material={m.pliegue} />)}
                {completo ? (
                  <>
                    {/* bota del traje: caña, rodamiento del tobillo, puntera y suela de tacos */}
                    <mesh geometry={G.cilindro} position={[0, -0.33, 0.005]} scale={[0.074, 0.12, 0.08]} material={m.botaTraje} />
                    <mesh geometry={G.cilindro} position={[0, -0.27, 0.005]} scale={[0.08, 0.02, 0.085]} material={m.rodamiento} />
                    <mesh geometry={G.caja} position={[0, -0.42, 0.045]} scale={[0.13, 0.09, 0.27]} material={m.botaTraje} castShadow />
                    <mesh geometry={G.esferaBaja} position={[0, -0.43, 0.165]} scale={[0.066, 0.05, 0.05]} material={m.botaTraje} />
                    <mesh geometry={G.caja} position={[0, -0.47, 0.05]} scale={[0.136, 0.025, 0.3]} material={m.mando} />
                    {alta && [-0.06, 0.02, 0.1].map((z) => <mesh key={z} geometry={G.caja} position={[0, -0.487, z]} scale={[0.13, 0.012, 0.03]} material={m.mando} />)}
                  </>
                ) : (
                  <>
                    {/* zapatilla con suela clara */}
                    <mesh geometry={G.caja} position={[0, -0.42, 0.04]} scale={[0.1, 0.08, 0.24]} material={m.bota} castShadow />
                    <mesh geometry={G.caja} position={[0, -0.455, 0.04]} scale={[0.105, 0.02, 0.25]} material={m.suela} />
                  </>
                )}
              </group>
            </group>
          )
        })}

        {/* ---- torso ---- */}
        <group ref={torso} position={[0, 0.92, 0]}>
          {/* cadera y cinturón */}
          <mesh geometry={G.capsula} position={[0, 0.06, 0]} scale={[0.15 * grosor, 0.05, 0.11 * grosor]} material={abajo} />
          <mesh geometry={G.cilindro} position={[0, 0.06, 0]} scale={[0.158 * grosor, 0.035, 0.118 * grosor]} material={completo ? m.rodamiento : m.mando} />
          {/* pecho: más ancho arriba */}
          <mesh geometry={G.capsula} position={[0, 0.3, 0]} scale={[0.165 * grosor, 0.13, 0.11 * grosor]} material={arriba} castShadow />
          <mesh geometry={G.esfera} position={[0, 0.38, 0.005]} scale={[0.2 * grosor, 0.1, 0.115 * grosor]} material={arriba} castShadow />
          {/* polo: cuello con solapas y tapeta con botones */}
          {!completo && (
            <>
              <mesh geometry={G.anillo} position={[0, 0.48, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.065, 0.06, 0.12]} material={m.tela} />
              {[-1, 1].map((l) => (
                <mesh key={l} geometry={G.caja} position={[l * 0.035, 0.475, 0.07]} rotation={[-0.5, 0, l * 0.55]} scale={[0.06, 0.03, 0.008]} material={m.telaOscura} />
              ))}
              <mesh geometry={G.caja} position={[0, 0.43, 0.113]} scale={[0.026, 0.08, 0.004]} material={m.telaOscura} />
              {[0.45, 0.415].map((y) => (
                <mesh key={y} geometry={G.esferaBaja} position={[0, y, 0.117]} scale={0.0055} material={m.boton} />
              ))}
            </>
          )}
          {/* traje: rodamiento de la cintura */}
          {completo && <mesh geometry={G.cilindro} position={[0, 0.15, 0]} scale={[0.19, 0.022, 0.135]} material={m.rodamiento} />}
          {/* distintivo del rol */}
          <mesh geometry={G.caja} position={[0.075, 0.38, 0.118 * grosor]} scale={[0.06, 0.04, 0.008]} material={m.distintivo} />
          {/* parche de misión */}
          <mesh geometry={G.disco} position={[-0.08, 0.38, 0.121 * grosor]} scale={0.032} material={m.parche} />
          {/* módulo de pantalla y mandos del pecho (DCM): pantalla, perillas y la de purga */}
          {completo && (
            <group position={[0, 0.25, 0.155]}>
              <mesh geometry={G.caja} scale={[0.19, 0.11, 0.06]} material={m.dcm} castShadow />
              <mesh geometry={G.caja} position={[0, 0.055, 0.005]} rotation={[-0.45, 0, 0]} scale={[0.17, 0.012, 0.05]} material={m.dcm} />
              <mesh geometry={G.caja} position={[0, 0.06, 0.012]} rotation={[-0.45 - Math.PI / 2, 0, 0]} scale={[0.11, 0.035, 0.002]} material={m.pantallaDcm} />
              {[-0.06, 0.06].map((x) => (
                <mesh key={x} geometry={G.cilindro} position={[x, -0.015, 0.035]} rotation={[Math.PI / 2, 0, 0]} scale={[0.016, 0.02, 0.016]} material={m.mando} />
              ))}
              <mesh geometry={G.cilindro} position={[0, -0.03, 0.035]} rotation={[Math.PI / 2, 0, 0]} scale={[0.012, 0.018, 0.012]} material={m.purga} />
              {/* mangueras hacia la mochila */}
              {alta &&
                [-1, 1].map((l) => (
                  <mesh key={l} geometry={G.capsula} position={[l * 0.13, -0.01, -0.06]} rotation={[0.9, 0, l * 0.5]} scale={[0.012, 0.06, 0.012]} material={m.mando} />
                ))}
            </group>
          )}
          {/* mochila de soporte vital (PLSS): cuerpo, rieles, rejilla, botella de reserva y antena */}
          {completo && (
            <group position={[0, 0.33, -0.18]}>
              <mesh geometry={G.caja} scale={[0.4, 0.56, 0.22]} material={m.eva} castShadow />
              <mesh geometry={G.caja} position={[0, 0.2, -0.115]} scale={[0.24, 0.05, 0.012]} material={m.acento} />
              {[-1, 1].map((l) => (
                <mesh key={l} geometry={G.caja} position={[l * 0.205, 0, 0]} scale={[0.02, 0.5, 0.2]} material={m.dcm} />
              ))}
              <mesh geometry={G.caja} position={[0, -0.19, -0.115]} scale={[0.28, 0.08, 0.01]} material={m.mando} />
              <mesh geometry={G.cilindro} position={[0, -0.3, -0.01]} rotation={[0, 0, Math.PI / 2]} scale={[0.06, 0.36, 0.06]} material={m.eva} />
              <mesh geometry={G.cilindro} position={[0.13, -0.08, -0.115]} rotation={[Math.PI / 2, 0, 0]} scale={[0.03, 0.02, 0.03]} material={m.gris} />
              {alta && (
                <>
                  <mesh geometry={G.cilindro} position={[0.15, 0.36, -0.05]} scale={[0.007, 0.12, 0.007]} material={m.gris} />
                  {[0.08, -0.05].map((y) => (
                    <mesh key={y} geometry={G.caja} position={[0, y, -0.112]} scale={[0.34, 0.004, 0.004]} material={m.pliegue} />
                  ))}
                </>
              )}
            </group>
          )}

          {/* ---- brazos ---- */}
          {[0, 1].map((i) => {
            const lado = i === 0 ? -1 : 1
            return (
              <group key={i} ref={brazos[i]} position={[lado * 0.215 * (completo ? 1.12 : 1), 0.44, 0]}>
                <mesh geometry={G.esfera} scale={[0.065 * grosor, 0.065 * grosor, 0.065 * grosor]} material={arriba} />
                {completo ? (
                  <>
                    <mesh geometry={G.capsula} position={[0, -0.15, 0]} scale={[0.05 * grosor, 0.1, 0.052 * grosor]} material={m.eva} castShadow />
                    <mesh geometry={G.cilindro} position={[0, -0.07, 0]} scale={[0.053 * grosor, 0.025, 0.055 * grosor]} material={m.acento} />
                    {/* rodamientos del hombro y del brazo */}
                    <mesh geometry={G.cilindro} position={[0, -0.025, 0]} scale={[0.072, 0.024, 0.072]} material={m.rodamiento} />
                    {alta && <mesh geometry={G.cilindro} position={[0, -0.2, 0]} scale={[0.066, 0.018, 0.068]} material={m.rodamiento} />}
                  </>
                ) : (
                  <>
                    {/* manga corta del polo con su ribete y el brazo al aire */}
                    <mesh geometry={G.capsula} position={[0, -0.08, 0]} scale={[0.05, 0.045, 0.052]} material={m.tela} castShadow />
                    <mesh geometry={G.cilindro} position={[0, -0.135, 0]} scale={[0.051, 0.012, 0.053]} material={m.telaOscura} />
                    <mesh geometry={G.capsula} position={[0, -0.18, 0]} scale={[0.04, 0.07, 0.042]} material={m.piel} />
                  </>
                )}
                {/* bandera en el hombro izquierdo */}
                {bandera && i === 0 && (
                  <group position={[-0.051 * grosor, -0.11, 0]} rotation={[0, -Math.PI / 2, 0]}>
                    {bandera.colores.map((col, k) => (
                      <mesh
                        key={k}
                        position={bandera.vertical ? [(k - (bandera.colores.length - 1) / 2) * 0.016, 0, 0] : [0, ((bandera.colores.length - 1) / 2 - k) * 0.011, 0]}
                      >
                        <planeGeometry args={bandera.vertical ? [0.016, 0.033] : [0.048, 0.011]} />
                        <meshStandardMaterial color={col} roughness={0.6} side={THREE.DoubleSide} />
                      </mesh>
                    ))}
                  </group>
                )}
                <group ref={codos[i]} position={[0, -0.29, 0]}>
                  <mesh geometry={G.capsula} position={[0, -0.13, 0]} scale={[0.044 * grosor, 0.09, 0.046 * grosor]} material={completo ? m.eva : m.piel} castShadow />
                  {completo && (
                    <>
                      {/* pliegues del codo, rodamiento de la muñeca y guantelete */}
                      {alta && <mesh geometry={G.cilindro} position={[0, 0, 0]} scale={[0.062, 0.016, 0.064]} material={m.pliegue} />}
                      <mesh geometry={G.cilindro} position={[0, -0.215, 0]} scale={[0.054, 0.024, 0.056]} material={m.rodamiento} />
                      <mesh geometry={G.cilindro} position={[0, -0.235, 0]} scale={[0.05, 0.02, 0.052]} material={m.guante} />
                      <mesh geometry={G.esferaBaja} position={[0, -0.3, 0.01]} scale={[0.045, 0.03, 0.03]} material={m.palma} />
                    </>
                  )}
                  {/* mano: palma y pulgar */}
                  <mesh geometry={G.esfera} position={[0, -0.27, 0.005]} scale={[0.04 * grosor, 0.055, 0.025 * grosor]} material={m.guante} />
                  <mesh geometry={G.capsula} position={[-lado * 0.03, -0.25, 0.02]} rotation={[0, 0, lado * 0.6]} scale={[0.012 * grosor, 0.018, 0.012 * grosor]} material={m.guante} />
                </group>
              </group>
            )
          })}

          {/* ---- cuello y cabeza ---- */}
          <mesh geometry={G.cilindro} position={[0, 0.56, 0]} scale={[0.045, 0.09, 0.045]} material={m.piel} />
          <group ref={cabeza} position={[0, 0.7, 0.005]}>
            {/* cráneo y mandíbula */}
            <mesh geometry={G.esfera} scale={[0.1, 0.122, 0.11]} material={m.piel} castShadow />
            <mesh geometry={G.esfera} position={[0, -0.045, 0.022]} scale={[0.082, 0.08, 0.088]} material={m.piel} />
            {/* orejas */}
            {[-1, 1].map((l) => (
              <mesh key={l} geometry={G.esferaBaja} position={[l * 0.098, 0.005, -0.005]} scale={[0.014, 0.026, 0.018]} material={m.piel} />
            ))}
            {/* nariz */}
            <mesh geometry={G.esferaBaja} position={[0, -0.008, 0.106]} scale={[0.013, 0.02, 0.016]} material={m.piel} />
            {/* ojos */}
            <Ojo x={-0.036} iris={iris} lado={-1} parpado={parpados[0]} piel={m.piel} />
            <Ojo x={0.036} iris={iris} lado={1} parpado={parpados[1]} piel={m.piel} />
            {/* cejas */}
            {[-1, 1].map((l) => (
              <mesh key={l} geometry={G.caja} position={[l * 0.037, 0.043, 0.098]} rotation={[0.2, 0, l * -0.12]} scale={[0.028, 0.0055, 0.006]} material={m.pelo} />
            ))}
            {/* boca */}
            <mesh geometry={G.sonrisa} position={[0, -0.05, 0.111]} rotation={[0.25, 0, Math.PI + Math.PI * 0.19]} scale={0.017} material={m.labios} />
            {/* pelo */}
            {traje.peinado !== 'rapado' && (
              <mesh geometry={G.pelo} position={[0, 0.012, -0.008]} rotation={[-0.5, 0, 0]} scale={[0.106, 0.128, 0.118]} material={m.pelo} castShadow />
            )}
            {traje.peinado === 'rapado' && <mesh geometry={G.pelo} position={[0, 0.006, -0.004]} rotation={[-0.55, 0, 0]} scale={[0.1015, 0.1235, 0.1125]} material={m.pelo} />}
            {traje.peinado === 'largo' && (
              <mesh geometry={G.capsula} position={[0, -0.07, -0.07]} scale={[0.092, 0.085, 0.05]} material={m.pelo} castShadow />
            )}
            {traje.peinado === 'mono' && <mesh geometry={G.esfera} position={[0, 0.07, -0.105]} scale={0.042} material={m.pelo} castShadow />}
            {traje.peinado === 'rizado' &&
              RIZOS.map((p, k) => <mesh key={k} geometry={G.esferaBaja} position={p as unknown as [number, number, number]} scale={0.036} material={m.pelo} />)}

            {/* casco: burbuja transparente, visor dorado levantado y anillo del cuello */}
            {completo && (
              <>
                <mesh geometry={G.esfera} position={[0, 0.0, 0.01]} scale={0.175} material={m.cristal} renderOrder={2} />
                {/* carcasa trasera del casco (cubre la nuca) y visor dorado levantado */}
                <mesh geometry={G.casquete} position={[0, 0.0, 0.0]} rotation={[-Math.PI / 2 - 0.15, 0, 0]} scale={[0.184, 0.184, 0.184]} material={m.eva} />
                <mesh geometry={G.casquete} position={[0, 0.02, 0.012]} rotation={[-0.55, 0, 0]} scale={[0.186, 0.186, 0.186]} material={m.visor} />
                {/* focos y cámaras a los lados */}
                {[-1, 1].map((l) => (
                  <group key={l} position={[l * 0.17, 0.05, 0.02]}>
                    <mesh geometry={G.caja} scale={[0.035, 0.05, 0.08]} material={m.eva} />
                    <mesh geometry={G.disco} position={[0, 0, 0.041]} scale={0.016} material={m.foco} />
                    <mesh geometry={G.cilindro} position={[0, 0.042, 0.015]} rotation={[Math.PI / 2, 0, 0]} scale={[0.011, 0.05, 0.011]} material={m.mando} />
                  </group>
                ))}
                <mesh geometry={G.anillo} position={[0, -0.135, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.15, 0.15, 0.25]} material={m.rodamiento} />
              </>
            )}
          </group>
        </group>
      </group>
      {etiqueta && (
        <Html position={[0, tumbado ? 1.1 : 2.12, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          {etiqueta}
        </Html>
      )}
    </group>
  )
}
