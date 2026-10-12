import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { MODULE_BY_ID, ROLE_BY_ID, type ModuleId, type RoomState } from '@shared/types'
import { useStore } from '../store'

export const MODULE_POS: Record<ModuleId, [number, number, number]> = {
  habitat: [0, 0, 0],
  soporteVital: [-6, 0, 2],
  energia: [8, 0, -4],
  invernadero: [5, 0, 5],
  almacen: [-5, 0, -5],
  taller: [1, 0, -7],
  refugio: [-9, 0, -2],
}

function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(120, 120, 90, 90)
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const d = Math.sqrt(x * x + y * y)
      const h =
        (Math.sin(x * 0.18) * Math.cos(y * 0.21) * 1.2 + Math.sin(x * 0.45 + y * 0.3) * 0.4 + Math.cos(y * 0.6) * 0.25) *
        Math.min(1, Math.max(0, (d - 11) / 10))
      pos.setZ(i, h)
    }
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <meshStandardMaterial color="#b4542f" roughness={1} metalness={0} />
    </mesh>
  )
}

function Rocks() {
  const rocks = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const a = (i / 40) * Math.PI * 2 + Math.random()
        const r = 16 + Math.random() * 35
        return { p: [Math.cos(a) * r, 0, Math.sin(a) * r] as [number, number, number], s: 0.4 + Math.random() * 1.4, rot: Math.random() * 3 }
      }),
    [],
  )
  return (
    <>
      {rocks.map((r, i) => (
        <mesh key={i} position={r.p} scale={r.s} rotation={[r.rot, r.rot, 0]}>
          <dodecahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color="#7f3a22" roughness={1} />
        </mesh>
      ))}
    </>
  )
}

function statusColor(sala: RoomState, id: ModuleId) {
  const s = sala.sistemas.find((x) => x.id === id)!
  if (!s.online) return { color: '#4a4f5a', emissive: '#000000' }
  if (s.integridad < 30) return { color: '#ef5350', emissive: '#4a0d0d' }
  if (s.integridad < 60) return { color: '#f5b942', emissive: '#3d2a05' }
  return { color: '#cfd8e3', emissive: '#0c2a3d' }
}

function Module({ id, sala, visible }: { id: ModuleId; sala: RoomState; visible: boolean }) {
  const sel = useStore((s) => s.moduloSeleccionado)
  const seleccionar = useStore((s) => s.seleccionarModulo)
  const sys = sala.sistemas.find((x) => x.id === id)!
  const { color, emissive } = statusColor(sala, id)
  const ref = useRef<THREE.Group>(null)
  const pos = MODULE_POS[id]
  useFrame(({ clock }) => {
    if (!ref.current) return
    const critico = sys.online && sys.integridad < 30
    const s = critico ? 1 + Math.sin(clock.elapsedTime * 6) * 0.03 : 1
    ref.current.scale.setScalar(s)
  })
  if (!visible) return null
  const activo = sel === id
  const onClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    seleccionar(activo ? null : id)
  }
  const mat = <meshStandardMaterial color={color} emissive={activo ? '#1e88e5' : emissive} emissiveIntensity={activo ? 0.8 : 1} roughness={0.5} metalness={0.3} />

  let forma: JSX.Element
  switch (id) {
    case 'habitat':
      forma = (
        <group>
          <mesh position={[0, 0, 0]} onClick={onClick}>
            <sphereGeometry args={[2.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.9, 2.3]} onClick={onClick}>
            <boxGeometry args={[1.2, 1.4, 1.2]} />
            <meshStandardMaterial color="#9aa5b5" />
          </mesh>
        </group>
      )
      break
    case 'soporteVital':
      forma = (
        <group>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 1, 0]} onClick={onClick}>
            <cylinderGeometry args={[1, 1, 4, 24]} />
            {mat}
          </mesh>
          {[-1.2, 0, 1.2].map((x) => (
            <mesh key={x} position={[x, 2.2, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.6, 10]} />
              <meshStandardMaterial color="#6b7280" />
            </mesh>
          ))}
        </group>
      )
      break
    case 'energia':
      forma = (
        <group>
          <mesh position={[0, 0.6, 0]} onClick={onClick}>
            <boxGeometry args={[1.8, 1.2, 1.8]} />
            {mat}
          </mesh>
          {Array.from({ length: Math.min(8, sala.cargamento.paneles) }, (_, i) => (
            <group key={i} position={[(i % 4) * 2.2 - 3.3, 1.1, Math.floor(i / 4) * 2.4 + 2.4]} rotation={[-0.5, 0, 0]}>
              <mesh>
                <boxGeometry args={[2, 0.08, 1.4]} />
                <meshStandardMaterial color="#1c3b6e" metalness={0.8} roughness={0.2} emissive="#0a1f3d" />
              </mesh>
            </group>
          ))}
        </group>
      )
      break
    case 'invernadero':
      forma = (
        <group>
          <mesh position={[0, 0, 0]} onClick={onClick}>
            <sphereGeometry args={[2.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color={sala.huerto.establecido ? '#7fd38a' : color}
              emissive={sala.huerto.establecido ? '#1b5e20' : emissive}
              transparent
              opacity={0.55}
              roughness={0.2}
            />
          </mesh>
          {sala.huerto.establecido &&
            [-0.8, 0, 0.8].map((x) => (
              <mesh key={x} position={[x, 0.4, 0]}>
                <boxGeometry args={[0.5, 0.8, 1.6]} />
                <meshStandardMaterial color="#2e7d32" />
              </mesh>
            ))}
        </group>
      )
      break
    case 'refugio':
      forma = (
        <group>
          <mesh position={[0, -0.6, 0]} onClick={onClick}>
            <sphereGeometry args={[2.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#8a4a30" roughness={1} emissive={activo ? '#1e88e5' : '#000'} />
          </mesh>
          <mesh position={[0, 0.5, 1.6]} onClick={onClick}>
            <boxGeometry args={[1.2, 1, 1]} />
            {mat}
          </mesh>
        </group>
      )
      break
    default:
      forma = (
        <mesh position={[0, 0.9, 0]} onClick={onClick}>
          <boxGeometry args={id === 'almacen' ? [3, 1.8, 2.4] : [2.4, 1.8, 2.4]} />
          {mat}
        </mesh>
      )
  }

  return (
    <group ref={ref} position={pos}>
      {forma}
      <Html position={[0, 3.2, 0]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(8,12,22,0.8)',
            border: `1px solid ${sys.online ? (sys.integridad < 30 ? '#ef5350' : 'rgba(120,160,220,0.4)') : '#555'}`,
            borderRadius: 8,
            padding: '3px 8px',
            fontSize: 12,
            whiteSpace: 'nowrap',
            color: '#e6ecf7',
            fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          {MODULE_BY_ID[id].nombre} · <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{sys.online ? `${Math.round(sys.integridad)}%` : 'OFF'}</span>
        </div>
      </Html>
    </group>
  )
}

function CrewMarkers({ sala }: { sala: RoomState }) {
  const usuario = useStore((s) => s.usuario)
  const porModulo: Record<string, number> = {}
  return (
    <>
      {sala.jugadores
        .filter((j) => j.rol)
        .map((j) => {
          const idx = (porModulo[j.ubicacion] = (porModulo[j.ubicacion] ?? 0) + 1)
          const base = MODULE_POS[j.ubicacion]
          const a = idx * 1.1
          const pos: [number, number, number] = [base[0] + Math.cos(a) * 3.4, 0.6, base[2] + Math.sin(a) * 3.4]
          const color = ROLE_BY_ID[j.rol!].color
          return (
            <group key={j.id} position={pos}>
              <mesh>
                <capsuleGeometry args={[0.28, 0.7, 6, 12]} />
                <meshStandardMaterial color={j.conectado ? color : '#555'} emissive={color} emissiveIntensity={j.salud < 40 ? 0.9 : 0.25} />
              </mesh>
              <mesh position={[0, 0.55, 0]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color="#e8ecf3" metalness={0.6} roughness={0.2} />
              </mesh>
              <Html position={[0, 1.3, 0]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
                <div
                  style={{
                    background: j.id === usuario?.id ? 'rgba(79,195,247,0.25)' : 'rgba(8,12,22,0.75)',
                    border: `1px solid ${j.ayuda ? '#f5b942' : color}`,
                    borderRadius: 999,
                    padding: '2px 8px',
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                    color: '#fff',
                    fontFamily: 'Space Grotesk, sans-serif',
                  }}
                >
                  {j.ayuda ? '⚠ ' : ''}
                  {j.nombre} · {ROLE_BY_ID[j.rol!].corto}
                </div>
              </Html>
            </group>
          )
        })}
    </>
  )
}

function Storm({ activa }: { activa: boolean }) {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const arr = new Float32Array(600 * 3)
    for (let i = 0; i < 600; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 80
      arr[i * 3 + 1] = Math.random() * 30
      arr[i * 3 + 2] = (Math.random() - 0.5) * 80
    }
    return arr
  }, [])
  useFrame((_, dt) => {
    if (!ref.current || !activa) return
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - dt * 14
      if (y < 0) y = 30
      p.setY(i, y)
      p.setX(i, p.getX(i) + dt * 6)
      if (p.getX(i) > 40) p.setX(i, -40)
    }
    p.needsUpdate = true
  })
  if (!activa) return null
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.25} color="#ff7043" transparent opacity={0.8} />
    </points>
  )
}

function Lander() {
  return (
    <group position={[-14, 0, 9]}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[1.1, 1.4, 2.4, 12]} />
        <meshStandardMaterial color="#d9dee6" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.3, 0]}>
        <coneGeometry args={[1.1, 1.2, 12]} />
        <meshStandardMaterial color="#c62828" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2 + 0.78) * 1.6, 0.5, Math.sin((i * Math.PI) / 2 + 0.78) * 1.6]} rotation={[0, 0, 0.5]}>
          <cylinderGeometry args={[0.08, 0.08, 1.4, 8]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      ))}
    </group>
  )
}

export function BaseScene({ sala }: { sala: RoomState }) {
  const paso = sala.fase === 'ensamblaje' ? sala.ensamblaje.paso : 99
  const hora = sala.mision.hora
  const esDia = hora >= 6 && hora < 18
  const sunAngle = ((hora - 6) / 12) * Math.PI
  const sunPos: [number, number, number] = [Math.cos(sunAngle) * 60, Math.max(4, Math.sin(sunAngle) * 60), -20]
  const intensidad = sala.fase === 'base' || sala.fase === 'fin' ? (esDia ? 1.6 : 0.25) : 1.4
  const visibleBasicos = sala.fase !== 'ensamblaje' || paso >= 2
  const visibleCriticos = sala.fase !== 'ensamblaje' || paso >= 3
  const seleccionar = useStore((s) => s.seleccionarModulo)

  return (
    <group onPointerMissed={() => seleccionar(null)}>
      <color attach="background" args={[sala.tormenta ? '#2b0d0a' : esDia ? '#c97a52' : '#0b0a14']} />
      <fog attach="fog" args={[sala.tormenta ? '#5a1a10' : esDia ? '#c97a52' : '#0b0a14', 30, 110]} />
      <ambientLight intensity={esDia ? 0.5 : 0.15} />
      <directionalLight position={sunPos} intensity={intensidad} color={sala.tormenta ? '#ff8a65' : '#ffe9d2'} castShadow />
      <hemisphereLight args={['#ffd2b0', '#4a1f10', 0.35]} />
      <Terrain />
      <Rocks />
      <Lander />
      <Module id="habitat" sala={sala} visible={visibleBasicos} />
      <Module id="almacen" sala={sala} visible={visibleBasicos} />
      <Module id="taller" sala={sala} visible={visibleBasicos} />
      <Module id="refugio" sala={sala} visible={visibleBasicos} />
      <Module id="soporteVital" sala={sala} visible={visibleCriticos} />
      <Module id="energia" sala={sala} visible={visibleCriticos} />
      <Module id="invernadero" sala={sala} visible={visibleCriticos} />
      {visibleBasicos && <CrewMarkers sala={sala} />}
      <Storm activa={sala.tormenta} />
      {!esDia && <Stars count={900} />}
    </group>
  )
}

function Stars({ count }: { count: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 150
      const th = Math.random() * Math.PI * 2
      const ph = Math.random() * Math.PI * 0.5
      arr[i * 3] = r * Math.sin(ph) * Math.cos(th)
      arr[i * 3 + 1] = r * Math.cos(ph)
      arr[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
    }
    return arr
  }, [count])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.8} color="#dbe7ff" />
    </points>
  )
}
