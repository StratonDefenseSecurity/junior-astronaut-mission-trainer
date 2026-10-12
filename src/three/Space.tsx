import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Stars({ count = 1500 }: { count?: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 180 + Math.random() * 120
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(ph) * Math.cos(th)
      arr[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th)
      arr[i * 3 + 2] = r * Math.cos(ph)
    }
    return arr
  }, [count])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.9} color="#dbe7ff" sizeAttenuation transparent opacity={0.9} />
    </points>
  )
}

export function Planet({
  radius,
  color,
  emissive = '#000000',
  position,
  spin = 0.02,
  bands = false,
}: {
  radius: number
  color: string
  emissive?: string
  position: [number, number, number]
  spin?: number
  bands?: boolean
}) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += spin * dt
  })
  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial color={color} emissive={emissive} roughness={0.9} metalness={0} />
      </mesh>
      {bands && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 1.02, radius * 0.08, 8, 64]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.25} />
        </mesh>
      )}
      <mesh>
        <sphereGeometry args={[radius * 1.04, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}
