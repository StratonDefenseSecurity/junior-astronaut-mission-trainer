import { Suspense, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { RoomState } from '@shared/types'
import { ahoraServidor } from '../store'
import { Planet, Stars } from './Space'
import { Rocket } from './Rocket'
import { BaseScene } from './Base'

function PadScene() {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.15
  })
  return (
    <group>
      <color attach="background" args={['#0a1322']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} />
      <Stars />
      <Planet radius={60} color="#2f6fb0" position={[0, -60.5, 0]} spin={0.01} />
      <group ref={ref}>
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[4, 4.4, 0.5, 32]} />
          <meshStandardMaterial color="#56606e" />
        </mesh>
        {/* torre */}
        <mesh position={[2.2, 3, 0]}>
          <boxGeometry args={[0.5, 6, 0.5]} />
          <meshStandardMaterial color="#8d2a2a" />
        </mesh>
        <mesh position={[1.4, 4.5, 0]}>
          <boxGeometry args={[1.4, 0.15, 0.15]} />
          <meshStandardMaterial color="#8d2a2a" />
        </mesh>
        <Rocket flame={0} />
      </group>
    </group>
  )
}

function LaunchScene({ sala }: { sala: RoomState }) {
  const rocket = useRef<THREE.Group>(null)
  const earth = useRef<THREE.Group>(null)
  const mars = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const flameRef = useRef(1)
  useFrame(() => {
    const t = sala.transito ? Math.min(1, (ahoraServidor() - sala.transito.inicio) / sala.transito.duracion) : 1
    const ease = t * t * (3 - 2 * t)
    if (rocket.current) {
      rocket.current.position.y = ease * 40
      rocket.current.rotation.z = -ease * 0.9
      rocket.current.position.x = ease * 25
    }
    if (earth.current) {
      const s = 1 - ease * 0.85
      earth.current.scale.setScalar(s)
      earth.current.position.y = -60.5 - ease * 60
    }
    if (mars.current) {
      mars.current.position.set(60 - ease * 30, 20 + ease * 8, -90 + ease * 60)
      mars.current.scale.setScalar(0.3 + ease * 1.2)
    }
    flameRef.current = t < 0.95 ? 1 : 0
    camera.position.lerp(new THREE.Vector3(8 + ease * 20, 6 + ease * 38, 22 - ease * 2), 0.03)
    camera.lookAt(ease * 25, ease * 40 + 2, 0)
  })
  return (
    <group>
      <color attach="background" args={['#050913']} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[20, 30, 10]} intensity={1.6} />
      <Stars />
      <group ref={earth}>
        <Planet radius={60} color="#2f6fb0" position={[0, 0, 0]} spin={0.01} />
      </group>
      <group ref={mars}>
        <Planet radius={14} color="#c1440e" emissive="#2a0b02" position={[0, 0, 0]} spin={0.05} />
      </group>
      <group ref={rocket}>
        <Rocket flame={1} />
      </group>
    </group>
  )
}

function CameraRig({ fase }: { fase: RoomState['fase'] }) {
  const { camera } = useThree()
  const done = useRef<string>('')
  useFrame(() => {
    if (done.current === fase) return
    done.current = fase
    if (fase === 'contexto') camera.position.set(0, 6, 16)
    if (fase === 'lanzamiento') camera.position.set(8, 6, 22)
    if (fase === 'ensamblaje' || fase === 'base' || fase === 'fin') camera.position.set(18, 14, 24)
  })
  return null
}

export function Scene({ sala }: { sala: RoomState }) {
  const orbit = sala.fase !== 'lanzamiento'
  return (
    <Canvas camera={{ position: [0, 6, 16], fov: 50, near: 0.1, far: 600 }} dpr={[1, 1.5]} shadows>
      <Suspense fallback={null}>
        <CameraRig fase={sala.fase} />
        {sala.fase === 'contexto' && <PadScene />}
        {sala.fase === 'lanzamiento' && <LaunchScene sala={sala} />}
        {(sala.fase === 'ensamblaje' || sala.fase === 'base' || sala.fase === 'fin') && <BaseScene sala={sala} />}
        {orbit && <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.05} minDistance={6} maxDistance={70} target={[0, 1, 0]} />}
      </Suspense>
    </Canvas>
  )
}
