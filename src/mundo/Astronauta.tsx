// El personaje: un astronauta hecho con formas simples, con el traje de colores de cada jugador.
// Dentro del hábitat va sin casco ni mochila; fuera lleva el traje completo.
import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Traje } from '@shared/types'

export interface Pose {
  x: number
  z: number
  giro: number
  /** 0 quieto, 1 andando. */
  andando: number
  /** Fase del ciclo de pasos. */
  paso: number
}

interface Props {
  traje: Traje
  /** Color del rol, para el distintivo del pecho. */
  distintivo: string
  /** Con casco y mochila (fuera) o sin ellos (dentro). */
  completo: boolean
  /** Devuelve la pose actual; se llama en cada fotograma. */
  pose?: () => Pose
  /** Tumbado (dormido o fuera de servicio). */
  tumbado?: boolean
  etiqueta?: ReactNode
  escala?: number
}

const PIEL = '#d9a57e'

export function Astronauta({ traje, distintivo, completo, pose, tumbado = false, etiqueta, escala = 1 }: Props) {
  const raiz = useRef<THREE.Group>(null)
  const cuerpo = useRef<THREE.Group>(null)
  const piernaI = useRef<THREE.Group>(null)
  const piernaD = useRef<THREE.Group>(null)
  const brazoI = useRef<THREE.Group>(null)
  const brazoD = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    const p = pose?.()
    if (!raiz.current || !cuerpo.current) return
    if (p) {
      raiz.current.position.set(p.x, 0, p.z)
      // Giro por el camino más corto.
      let d = p.giro - raiz.current.rotation.y
      d = Math.atan2(Math.sin(d), Math.cos(d))
      raiz.current.rotation.y += d * Math.min(1, dt * 12)
    }
    const andar = tumbado ? 0 : (p?.andando ?? 0)
    const fase = p?.paso ?? 0
    const balanceo = Math.sin(fase) * 0.7 * andar
    if (piernaI.current) piernaI.current.rotation.x = balanceo
    if (piernaD.current) piernaD.current.rotation.x = -balanceo
    if (brazoI.current) brazoI.current.rotation.x = -balanceo * 0.8
    if (brazoD.current) brazoD.current.rotation.x = balanceo * 0.8
    const objetivoX = tumbado ? -Math.PI / 2 : 0
    cuerpo.current.rotation.x += (objetivoX - cuerpo.current.rotation.x) * Math.min(1, dt * 6)
    cuerpo.current.position.y = tumbado ? 0.55 : Math.abs(Math.sin(fase)) * 0.04 * andar
  })

  const tela = <meshStandardMaterial color={traje.color} roughness={0.75} metalness={0.05} />
  const acento = <meshStandardMaterial color={traje.acento} roughness={0.6} />
  const gris = <meshStandardMaterial color="#5b6472" roughness={0.6} metalness={0.4} />

  return (
    <group ref={raiz} scale={escala}>
      <group ref={cuerpo}>
        {/* piernas */}
        {([[-0.14, piernaI], [0.14, piernaD]] as const).map(([x, ref]) => (
          <group key={x} ref={ref} position={[x, 0.9, 0]}>
            <mesh position={[0, -0.42, 0]} castShadow>
              <capsuleGeometry args={[0.12, 0.52, 4, 10]} />
              {tela}
            </mesh>
            <mesh position={[0, -0.84, 0.05]} castShadow>
              <boxGeometry args={[0.2, 0.14, 0.34]} />
              {gris}
            </mesh>
            <mesh position={[0, -0.42, 0]}>
              <cylinderGeometry args={[0.125, 0.125, 0.07, 12]} />
              {acento}
            </mesh>
          </group>
        ))}
        {/* torso */}
        <mesh position={[0, 1.2, 0]} castShadow>
          <capsuleGeometry args={[0.26, 0.34, 6, 14]} />
          {tela}
        </mesh>
        <mesh position={[0, 0.93, 0]}>
          <cylinderGeometry args={[0.265, 0.265, 0.08, 16]} />
          {gris}
        </mesh>
        {/* distintivo del rol y panel de control en el pecho */}
        <mesh position={[0.11, 1.34, 0.245]}>
          <boxGeometry args={[0.12, 0.09, 0.03]} />
          <meshStandardMaterial color={distintivo} emissive={distintivo} emissiveIntensity={0.5} />
        </mesh>
        {completo && (
          <mesh position={[-0.07, 1.24, 0.25]}>
            <boxGeometry args={[0.2, 0.16, 0.06]} />
            {gris}
          </mesh>
        )}
        {/* brazos */}
        {([[-0.36, brazoI], [0.36, brazoD]] as const).map(([x, ref]) => (
          <group key={x} ref={ref} position={[x, 1.42, 0]}>
            <mesh position={[0, -0.3, 0]} castShadow>
              <capsuleGeometry args={[0.09, 0.44, 4, 10]} />
              {tela}
            </mesh>
            <mesh position={[0, -0.18, 0]}>
              <cylinderGeometry args={[0.095, 0.095, 0.06, 12]} />
              {acento}
            </mesh>
            <mesh position={[0, -0.6, 0]}>
              <sphereGeometry args={[0.1, 10, 10]} />
              {completo ? gris : <meshStandardMaterial color={PIEL} roughness={0.8} />}
            </mesh>
          </group>
        ))}
        {/* cabeza */}
        {completo ? (
          <group position={[0, 1.74, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.27, 20, 20]} />
              <meshStandardMaterial color="#f1f3f6" roughness={0.35} metalness={0.1} />
            </mesh>
            <mesh position={[0, 0.01, 0.07]}>
              <sphereGeometry args={[0.235, 20, 20, 0, Math.PI * 2, 0.5, 1.55]} />
              <meshStandardMaterial color={traje.visor} roughness={0.08} metalness={0.9} emissive={traje.visor} emissiveIntensity={0.12} />
            </mesh>
            <mesh position={[0, -0.24, 0]}>
              <cylinderGeometry args={[0.2, 0.24, 0.1, 16]} />
              {gris}
            </mesh>
          </group>
        ) : (
          <group position={[0, 1.7, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.17, 16, 16]} />
              <meshStandardMaterial color={PIEL} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.06, -0.02]}>
              <sphereGeometry args={[0.175, 16, 16, 0, Math.PI * 2, 0, 1.25]} />
              <meshStandardMaterial color="#2b2118" roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.2, 0]}>
              <cylinderGeometry args={[0.17, 0.2, 0.08, 14]} />
              {acento}
            </mesh>
          </group>
        )}
        {/* mochila de soporte vital */}
        {completo && (
          <group position={[0, 1.28, -0.3]}>
            <mesh castShadow>
              <boxGeometry args={[0.46, 0.62, 0.24]} />
              <meshStandardMaterial color="#dfe3ea" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.2, -0.125]}>
              <boxGeometry args={[0.3, 0.06, 0.02]} />
              {acento}
            </mesh>
          </group>
        )}
      </group>
      {etiqueta && (
        <Html position={[0, tumbado ? 1.1 : 2.25, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          {etiqueta}
        </Html>
      )}
    </group>
  )
}
