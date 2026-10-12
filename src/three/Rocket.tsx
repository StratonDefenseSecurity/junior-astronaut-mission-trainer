import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Rocket({ flame = 0, scale = 1 }: { flame?: number; scale?: number }) {
  const flameRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!flameRef.current) return
    const f = flame * (0.8 + Math.sin(clock.elapsedTime * 40) * 0.2 + Math.random() * 0.1)
    flameRef.current.scale.set(1, Math.max(0.001, f * 3.2), 1)
    flameRef.current.visible = flame > 0.01
  })
  return (
    <group scale={scale}>
      {/* cuerpo */}
      <mesh position={[0, 2.2, 0]}>
        <cylinderGeometry args={[0.55, 0.6, 4.4, 24]} />
        <meshStandardMaterial color="#e8ecf3" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.61, 0.61, 0.5, 24]} />
        <meshStandardMaterial color="#c62828" />
      </mesh>
      {/* cono */}
      <mesh position={[0, 5.1, 0]}>
        <coneGeometry args={[0.55, 1.4, 24]} />
        <meshStandardMaterial color="#c62828" />
      </mesh>
      {/* aletas */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * 0.7, 0.45, Math.sin((i * Math.PI) / 2) * 0.7]} rotation={[0, -(i * Math.PI) / 2, 0]}>
          <boxGeometry args={[0.5, 0.9, 0.08]} />
          <meshStandardMaterial color="#9aa5b5" />
        </mesh>
      ))}
      {/* tobera */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.3, 0.45, 0.4, 20]} />
        <meshStandardMaterial color="#3a3f4a" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* llama */}
      <mesh ref={flameRef} position={[0, -0.35, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.35, 1, 16, 1, true]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.85} />
      </mesh>
      {flame > 0.01 && <pointLight position={[0, -1, 0]} color="#ff9a3c" intensity={flame * 6} distance={12} />}
    </group>
  )
}
