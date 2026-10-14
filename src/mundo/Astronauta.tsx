// El personaje de cada jugador, hecho con geometría propia (sin modelos externos): cara con
// ojos que parpadean y miran, cejas, nariz, boca, orejas y pelo; cuerpo articulado (hombros,
// codos, caderas, rodillas) con el mono de vuelo de su color. Fuera lleva el traje completo:
// casco transparente con visor dorado levantado (así se le ve la cara), mochila de soporte vital.
//
// Las animaciones dependen de lo que esté haciendo: de pie, andando, flotando sin gravedad,
// corriendo en la cinta, pedaleando, durmiendo, trabajando en una consola, encogido en el
// refugio o tumbado. Todo se calcula en cada fotograma sin crear objetos nuevos.
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { trajePorDefecto, type Traje } from '@shared/types'

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

    if (p) {
      r.position.set(p.x, p.y ?? 0, p.z)
      let d = p.giro - r.rotation.y
      d = Math.atan2(Math.sin(d), Math.cos(d))
      r.rotation.y += d * Math.min(1, dt * 10)
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
      // Andar: en Marte, con un 38% de la gravedad, se rebota más.
      const rebote = gravedad === 'marte' ? 0.09 : 0.035
      alto = Math.abs(Math.sin(fase)) * rebote * andar
      ladeo = Math.sin(fase) * 0.04 * andar
    } else {
      alto = Math.sin(t * 1.6) * 0.004
    }
    c.rotation.x += (pitch - c.rotation.x) * Math.min(1, dt * 5)
    c.rotation.z += (roll + ladeo - c.rotation.z) * Math.min(1, dt * 5)
    c.position.y += (alto - c.position.y) * Math.min(1, dt * 8)

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
      const s = Math.sin(fase)
      const amplitud = gravedad === 'marte' ? 0.55 : 0.6
      piernaA = s * amplitud * andar
      piernaB = -s * amplitud * andar
      rodillaA = Math.max(0, -Math.cos(fase)) * 0.9 * andar + 0.05
      rodillaB = Math.max(0, Math.cos(fase)) * 0.9 * andar + 0.05
      brazoA = -s * 0.5 * andar
      brazoB = s * 0.5 * andar
      codoA = codoB = -0.35 * andar - 0.1
    }
    const k = Math.min(1, dt * 14)
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
              <mesh geometry={G.capsula} position={[0, -0.22, 0]} scale={[0.075 * grosor, 0.15, 0.08 * grosor]} material={completo ? m.eva : m.tela} castShadow />
              {/* bolsillo lateral del muslo */}
              {!completo && <mesh geometry={G.caja} position={[lado * 0.07, -0.2, 0.01]} scale={[0.02, 0.11, 0.09]} material={m.telaOscura} />}
              <mesh geometry={G.cilindro} position={[0, -0.12, 0]} scale={[0.079 * grosor, 0.03, 0.084 * grosor]} material={m.acento} />
              <group ref={rodillas[i]} position={[0, -0.44, 0]}>
                <mesh geometry={G.capsula} position={[0, -0.2, 0]} scale={[0.062 * grosor, 0.15, 0.066 * grosor]} material={completo ? m.eva : m.tela} castShadow />
                {/* bota */}
                <mesh geometry={G.caja} position={[0, -0.42, 0.04]} scale={[0.1 * grosor, 0.08, 0.24]} material={m.bota} castShadow />
                <mesh geometry={G.caja} position={[0, -0.455, 0.04]} scale={[0.105 * grosor, 0.02, 0.25]} material={m.gris} />
              </group>
            </group>
          )
        })}

        {/* ---- torso ---- */}
        <group ref={torso} position={[0, 0.92, 0]}>
          {/* cadera y cinturón */}
          <mesh geometry={G.capsula} position={[0, 0.06, 0]} scale={[0.15 * grosor, 0.05, 0.11 * grosor]} material={completo ? m.eva : m.tela} />
          <mesh geometry={G.cilindro} position={[0, 0.06, 0]} scale={[0.158 * grosor, 0.035, 0.118 * grosor]} material={m.gris} />
          {/* pecho: más ancho arriba */}
          <mesh geometry={G.capsula} position={[0, 0.3, 0]} scale={[0.165 * grosor, 0.13, 0.11 * grosor]} material={completo ? m.eva : m.tela} castShadow />
          <mesh geometry={G.esfera} position={[0, 0.38, 0.005]} scale={[0.2 * grosor, 0.1, 0.115 * grosor]} material={completo ? m.eva : m.tela} castShadow />
          {/* cremallera y cuello del mono */}
          {!completo && (
            <>
              <mesh geometry={G.caja} position={[0, 0.3, 0.113]} scale={[0.008, 0.28, 0.004]} material={m.telaOscura} />
              <mesh geometry={G.anillo} position={[0, 0.48, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.065, 0.06, 0.12]} material={m.acento} />
            </>
          )}
          {/* distintivo del rol */}
          <mesh geometry={G.caja} position={[0.075, 0.38, 0.118 * grosor]} scale={[0.06, 0.04, 0.008]} material={m.distintivo} />
          {/* parche de misión: círculo con el color del traje y borde de acento */}
          <mesh geometry={G.disco} position={[-0.08, 0.38, 0.121 * grosor]} scale={0.032} material={m.acento} />
          {/* panel de control del traje */}
          {completo && <mesh geometry={G.caja} position={[0, 0.27, 0.15]} scale={[0.17, 0.11, 0.05]} material={m.gris} />}
          {/* mochila de soporte vital */}
          {completo && (
            <group position={[0, 0.33, -0.17]}>
              <mesh geometry={G.caja} scale={[0.36, 0.52, 0.2]} material={m.eva} castShadow />
              <mesh geometry={G.caja} position={[0, 0.17, -0.105]} scale={[0.22, 0.05, 0.012]} material={m.acento} />
              <mesh geometry={G.cilindro} position={[0.12, -0.12, -0.105]} rotation={[Math.PI / 2, 0, 0]} scale={[0.03, 0.02, 0.03]} material={m.gris} />
            </group>
          )}

          {/* ---- brazos ---- */}
          {[0, 1].map((i) => {
            const lado = i === 0 ? -1 : 1
            return (
              <group key={i} ref={brazos[i]} position={[lado * 0.215 * (completo ? 1.12 : 1), 0.44, 0]}>
                <mesh geometry={G.esfera} scale={[0.065 * grosor, 0.065 * grosor, 0.065 * grosor]} material={completo ? m.eva : m.tela} />
                <mesh geometry={G.capsula} position={[0, -0.15, 0]} scale={[0.05 * grosor, 0.1, 0.052 * grosor]} material={completo ? m.eva : m.tela} castShadow />
                <mesh geometry={G.cilindro} position={[0, -0.07, 0]} scale={[0.053 * grosor, 0.025, 0.055 * grosor]} material={m.acento} />
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
                  <mesh geometry={G.capsula} position={[0, -0.13, 0]} scale={[0.044 * grosor, 0.09, 0.046 * grosor]} material={completo ? m.eva : m.tela} castShadow />
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
                <mesh geometry={G.casquete} position={[0, 0.02, 0.012]} rotation={[-0.55, 0, 0]} scale={[0.178, 0.178, 0.178]} material={m.visor} />
                <mesh geometry={G.anillo} position={[0, -0.135, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.15, 0.15, 0.25]} material={m.gris} />
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
