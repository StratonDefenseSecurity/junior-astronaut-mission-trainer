// Interior del hábitat: es la nave durante el viaje y la base una vez en Marte.
import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { RoomState } from '@shared/types'
import { ESTACION_BY_ID, INTERIOR } from './mapa'

const L = INTERIOR.x1 - INTERIOR.x0
const A = INTERIOR.z1 - INTERIOR.z0
const H = INTERIOR.alto
const PARED = '#c9d1dc'
const SUELO = '#3b424e'

/** Rótulo flotante de una estación. */
export function Rotulo({ texto, y = 2.75, activo, destacado }: { texto: string; y?: number; activo: boolean; destacado: boolean }) {
  return (
    <Html position={[0, y, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`rotulo ${activo ? 'activo' : ''} ${destacado ? 'destacado' : ''}`}>{texto}</div>
    </Html>
  )
}

/** Marca en el suelo que señala dónde pararse; late si la estación tiene una tarea para ti. */
export function Marca({ activo, destacado, radio = 0.8 }: { activo: boolean; destacado: boolean; radio?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const m = ref.current.material as THREE.MeshBasicMaterial
    m.opacity = activo ? 0.9 : destacado ? 0.45 + Math.sin(clock.elapsedTime * 4) * 0.3 : 0.16
    ref.current.scale.setScalar(destacado && !activo ? 1 + Math.sin(clock.elapsedTime * 4) * 0.08 : 1)
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <ringGeometry args={[radio * 0.78, radio, 40]} />
      <meshBasicMaterial color={activo ? '#4fc3f7' : destacado ? '#f5b942' : '#8aa0bd'} transparent opacity={0.3} depthWrite={false} />
    </mesh>
  )
}

interface PuestoProps {
  id: string
  cerca: string | null
  destacadas: string[]
  color: string
  children?: ReactNode
}

/** Armario de equipos contra la pared, con su rótulo y su marca en el suelo. */
function Puesto({ id, cerca, destacadas, color, children }: PuestoProps) {
  const e = ESTACION_BY_ID[id]
  const lado = Math.sign(e.z) // -1 pared norte, +1 pared sur
  return (
    <group position={[e.x, 0, e.z]}>
      <group rotation={[0, lado > 0 ? Math.PI : 0, 0]}>
        {/* bastidor */}
        <mesh position={[0, 1.15, -0.28]} castShadow>
          <boxGeometry args={[2.5, 2.3, 0.5]} />
          <meshStandardMaterial color="#aeb7c4" roughness={0.6} metalness={0.25} />
        </mesh>
        <mesh position={[0, 2.38, -0.2]}>
          <boxGeometry args={[2.5, 0.16, 0.56]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
        </mesh>
        {children}
      </group>
      <group position={[0, 0, -lado * 1.05]}>
        <Marca activo={cerca === id} destacado={destacadas.includes(id)} />
      </group>
      <Rotulo texto={e.nombre} activo={cerca === id} destacado={destacadas.includes(id)} />
    </group>
  )
}

function Pantalla({ x = 0, y = 1.45, ancho = 0.9, alto = 0.55, color = '#3ddc97', intensidad = 0.9 }: { x?: number; y?: number; ancho?: number; alto?: number; color?: string; intensidad?: number }) {
  return (
    <mesh position={[x, y, 0]}>
      <boxGeometry args={[ancho, alto, 0.04]} />
      <meshStandardMaterial color="#0b1220" emissive={color} emissiveIntensity={intensidad} />
    </mesh>
  )
}

const tono = (malo: boolean, regular: boolean) => (malo ? '#ef5350' : regular ? '#f5b942' : '#3ddc97')

function Estaciones({ sala, cerca, destacadas }: { sala: RoomState; cerca: string | null; destacadas: string[] }) {
  const c = sala.cabina
  const e = sala.energia
  const bateria = e.capacidad ? e.bateria / e.capacidad : 0
  const sis = (id: string) => sala.sistemas.find((s) => s.id === id)!
  const comun = { cerca, destacadas }
  return (
    <>
      <Puesto id="soporte" color="#4fc3f7" {...comun}>
        <Pantalla x={-0.6} color={tono(c.ppO2 < 18 || c.ppCO2 > 1, c.ppO2 < 19.5 || c.ppCO2 > 0.4)} />
        {[0.25, 0.65, 1.0].map((x, i) => (
          <mesh key={x} position={[x, 0.95, 0.06]}>
            <cylinderGeometry args={[0.16, 0.16, 1.5, 14]} />
            <meshStandardMaterial color={['#dfe6ee', '#9fd3f5', '#f2c6a0'][i]} metalness={0.5} roughness={0.35} />
          </mesh>
        ))}
        <Pantalla x={-0.6} y={0.75} alto={0.3} color={tono(!sis('cdra').operativo || !sis('oga').operativo, !sis('wrs').operativo)} intensidad={0.6} />
      </Puesto>

      <Puesto id="energia" color="#f5b942" {...comun}>
        <Pantalla x={-0.55} color={tono(bateria < 0.15, bateria < 0.4)} />
        {/* barras de batería */}
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[0.25 + (i % 3) * 0.32, 1.0 + Math.floor(i / 3) * 0.62, 0.02]}>
            <boxGeometry args={[0.24, 0.5, 0.06]} />
            <meshStandardMaterial color="#111827" emissive={bateria * 6 > i ? '#3ddc97' : '#1f2937'} emissiveIntensity={bateria * 6 > i ? 0.9 : 0.1} />
          </mesh>
        ))}
      </Puesto>

      <Puesto id="almacen" color="#66bb6a" {...comun}>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[-0.9 + (i % 4) * 0.6, 0.5 + Math.floor(i / 4) * 0.62, 0.02]}>
            <boxGeometry args={[0.52, 0.54, 0.06]} />
            <meshStandardMaterial color={i % 5 === 0 ? '#8fa3b8' : '#d5dbe3'} roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0.7, 0.3, 0.5]} castShadow>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#b98b52" roughness={0.9} />
        </mesh>
      </Puesto>

      <Puesto id="laboratorio" color="#ab47bc" {...comun}>
        <Pantalla x={-0.65} color="#c084fc" />
        {/* estantes del huerto: se llenan de verde al avanzar */}
        {[0.7, 1.3, 1.9].map((y, i) => (
          <group key={y} position={[0.45, y, 0.12]}>
            <mesh>
              <boxGeometry args={[1.2, 0.05, 0.4]} />
              <meshStandardMaterial color="#6b7280" />
            </mesh>
            {sala.huerto.progreso > i * 33 && (
              <mesh position={[0, 0.16, 0]}>
                <boxGeometry args={[1.1, 0.26, 0.32]} />
                <meshStandardMaterial color={sala.huerto.establecido ? '#2e9e4f' : '#7ca36b'} emissive="#14532d" emissiveIntensity={sala.huerto.establecido ? 0.5 : 0.15} roughness={0.9} />
              </mesh>
            )}
          </group>
        ))}
      </Puesto>

      <Puesto id="enfermeria" color="#ef5350" {...comun}>
        <Pantalla x={0.6} color="#fb7185" />
        <mesh position={[-0.35, 0.55, 0.55]} castShadow>
          <boxGeometry args={[1.5, 0.22, 0.75]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
        </mesh>
        <mesh position={[-0.35, 0.25, 0.55]}>
          <boxGeometry args={[1.3, 0.45, 0.6]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </Puesto>

      <Puesto id="ejercicio" color="#ffa726" {...comun}>
        <mesh position={[0, 0.16, 0.65]} castShadow>
          <boxGeometry args={[0.8, 0.2, 1.5]} />
          <meshStandardMaterial color="#1f2937" roughness={0.6} />
        </mesh>
        {[-0.38, 0.38].map((x) => (
          <mesh key={x} position={[x, 0.75, 0.05]}>
            <cylinderGeometry args={[0.035, 0.035, 1.2, 8]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.25} />
          </mesh>
        ))}
        <mesh position={[0, 1.32, 0.05]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 0.8, 8]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.25} />
        </mesh>
      </Puesto>

      <Puesto id="literas" color="#7c8cf8" {...comun}>
        {[0.55, 1.5].map((y) => (
          <group key={y} position={[0, y, 0.25]}>
            <mesh castShadow>
              <boxGeometry args={[2.2, 0.16, 0.85]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.95} />
            </mesh>
            <mesh position={[-0.85, 0.14, 0]}>
              <boxGeometry args={[0.4, 0.12, 0.6]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
          </group>
        ))}
      </Puesto>

      <Puesto id="refugio" color="#38bdf8" {...comun}>
        {/* paredes de agua del refugio: una capa visible por cada capa de blindaje */}
        {Array.from({ length: 1 + sala.blindaje }, (_, i) => (
          <mesh key={i} position={[0, 1.1, 0.1 + i * 0.14]}>
            <boxGeometry args={[2.3 - i * 0.08, 2.0, 0.1]} />
            <meshStandardMaterial color="#1d4ed8" transparent opacity={0.35} roughness={0.15} metalness={0.2} />
          </mesh>
        ))}
        <Pantalla x={0} y={1.7} ancho={0.7} alto={0.3} color={tono(Boolean(sala.ambiente.tormentaSolar), false)} />
      </Puesto>
    </>
  )
}

/** Puente de mando: consola frente al ventanal. */
function Puente({ cerca, destacadas }: { cerca: string | null; destacadas: string[] }) {
  const e = ESTACION_BY_ID.puente
  return (
    <group position={[e.x, 0, e.z]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.9, 1.0, 2.6]} />
        <meshStandardMaterial color="#8793a5" metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0.1, 1.06, 0]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.6, 0.06, 2.4]} />
        <meshStandardMaterial color="#0b1220" emissive="#38bdf8" emissiveIntensity={0.7} />
      </mesh>
      {[-0.9, 0.9].map((z) => (
        <group key={z} position={[1.35, 0, z]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.55, 0.12, 0.55]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0.25, 0.9, 0]}>
            <boxGeometry args={[0.1, 0.9, 0.55]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.06, 0.2, 0.44, 10]} />
            <meshStandardMaterial color="#64748b" metalness={0.7} />
          </mesh>
        </group>
      ))}
      <group position={[1.35, 0, 0]}>
        <Marca activo={cerca === 'puente'} destacado={destacadas.includes('puente')} radio={0.7} />
      </group>
      <Rotulo texto={e.nombre} y={2.3} activo={cerca === 'puente'} destacado={destacadas.includes('puente')} />
    </group>
  )
}

function Esclusa({ sala, cerca, destacadas }: { sala: RoomState; cerca: string | null; destacadas: string[] }) {
  const e = ESTACION_BY_ID.esclusa
  const s = sala.sistemas.find((x) => x.id === 'esclusa')!
  const enMarte = sala.tAterrizaje > 0
  const color = s.integridad <= 15 ? '#ef5350' : enMarte ? '#3ddc97' : '#64748b'
  return (
    <group position={[e.x, 0, e.z]}>
      <mesh position={[0.45, 1.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.05, 1.05, 0.25, 28]} />
        <meshStandardMaterial color="#6b7686" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0.3, 1.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.55, 0.06, 8, 24]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.3, 2.5, 0]}>
        <boxGeometry args={[0.08, 0.14, 0.5]} />
        <meshStandardMaterial color="#0b1220" emissive={color} emissiveIntensity={1} />
      </mesh>
      <group position={[-0.9, 0, 0]}>
        <Marca activo={cerca === 'esclusa'} destacado={destacadas.includes('esclusa')} radio={0.7} />
      </group>
      <Rotulo texto={enMarte ? 'Esclusa · salida al exterior' : 'Esclusa'} activo={cerca === 'esclusa'} destacado={destacadas.includes('esclusa')} />
    </group>
  )
}

/** Paredes, suelo y techo. La pared delantera tiene el ventanal. */
function Casco() {
  const pared = <meshStandardMaterial color={PARED} roughness={0.85} metalness={0.05} />
  return (
    <group>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[L, 0.1, A]} />
        <meshStandardMaterial color={SUELO} roughness={0.8} />
      </mesh>
      {/* franja del pasillo */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L - 1.2, 0.18]} />
        <meshBasicMaterial color="#f5b942" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, H + 0.05, 0]}>
        <boxGeometry args={[L, 0.1, A]} />
        {pared}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, H / 2, s * (A / 2 + 0.05)]}>
          <boxGeometry args={[L, H, 0.1]} />
          {pared}
        </mesh>
      ))}
      {/* pared trasera (esclusa) */}
      <mesh position={[L / 2 + 0.05, H / 2, 0]}>
        <boxGeometry args={[0.1, H, A]} />
        {pared}
      </mesh>
      {/* pared delantera con ventanal de 5 × 1.9 m */}
      <mesh position={[-L / 2 - 0.05, 0.4, 0]}>
        <boxGeometry args={[0.1, 0.8, A]} />
        {pared}
      </mesh>
      <mesh position={[-L / 2 - 0.05, 2.85, 0]}>
        <boxGeometry args={[0.1, 0.3, A]} />
        {pared}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-L / 2 - 0.05, 1.75, s * 2.85]}>
          <boxGeometry args={[0.1, 1.9, 0.7]} />
          {pared}
        </mesh>
      ))}
      <mesh position={[-L / 2 - 0.02, 1.75, 0]}>
        <boxGeometry args={[0.03, 1.9, 5]} />
        <meshStandardMaterial color="#9fd8ff" transparent opacity={0.08} roughness={0.05} metalness={0.4} />
      </mesh>
      {/* tiras de luz del techo */}
      {[-6, -2, 2, 6].map((x) => (
        <mesh key={x} position={[x, H - 0.02, 0]}>
          <boxGeometry args={[2.4, 0.04, 0.5]} />
          <meshBasicMaterial color="#f8fbff" />
        </mesh>
      ))}
    </group>
  )
}

/** Lo que se ve por el ventanal: el espacio durante el viaje o Marte al llegar. */
function Vista({ sala }: { sala: RoomState }) {
  const estrellas = useMemo(() => {
    const n = 1400
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = 380 * Math.sin(ph) * Math.cos(th)
      arr[i * 3 + 1] = 380 * Math.cos(ph)
      arr[i * 3 + 2] = 380 * Math.sin(ph) * Math.sin(th)
    }
    return arr
  }, [])
  const marte = useRef<THREE.Mesh>(null)
  const giro = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (marte.current) marte.current.rotation.y += dt * 0.01
    if (giro.current) giro.current.rotation.x += dt * 0.004
  })
  const enMarte = sala.tAterrizaje > 0
  if (enMarte) {
    const noche = sala.ambiente.hora < 5.5 || sala.ambiente.hora > 19.5
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-80, -0.6, 0]}>
          <planeGeometry args={[220, 260]} />
          <meshStandardMaterial color={noche ? '#3b1c12' : '#b4542f'} roughness={1} />
        </mesh>
        {[[-40, 3, -18, 9], [-60, 5, 22, 14], [-90, 8, -40, 22], [-30, 2, 30, 6]].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y - r * 0.8, z]}>
            <sphereGeometry args={[r, 16, 12]} />
            <meshStandardMaterial color={noche ? '#2f1710' : '#9c4526'} roughness={1} />
          </mesh>
        ))}
      </group>
    )
  }
  const v = sala.vuelo
  const enOrbita = sala.fase === 'llegada'
  const radioTierra = Math.max(0.5, 40 / (1 + v.distTierra * 10))
  const radioMarte = enOrbita ? 190 : Math.max(0.45, 34 / (1 + v.distMarte * 7))
  return (
    <group>
      <group ref={giro}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[estrellas, 3]} />
          </bufferGeometry>
          <pointsMaterial size={1.3} color="#dbe7ff" sizeAttenuation />
        </points>
      </group>
      {/* el Sol, a un lado */}
      <mesh position={[-200, 90, -260]}>
        <sphereGeometry args={[9 / v.distSol, 20, 20]} />
        <meshBasicMaterial color="#fff6d8" />
      </mesh>
      <mesh position={[-240, 30, -70]}>
        <sphereGeometry args={[radioTierra, 28, 28]} />
        <meshStandardMaterial color="#2f6fb0" emissive="#123a66" emissiveIntensity={0.5} roughness={0.8} />
      </mesh>
      <mesh ref={marte} position={enOrbita ? [-150, -150, 20] : [-260, 14, 40]}>
        <sphereGeometry args={[radioMarte, 48, 48]} />
        <meshStandardMaterial color="#c1440e" emissive="#3a1206" emissiveIntensity={0.55} roughness={0.95} />
      </mesh>
    </group>
  )
}

export function Interior({ sala, cerca, destacadas }: { sala: RoomState; cerca: string | null; destacadas: string[] }) {
  const alerta = sala.emergencias.some((e) => e.estado === 'activa')
  const luzAlerta = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    if (luzAlerta.current) luzAlerta.current.intensity = alerta ? 6 + Math.sin(clock.elapsedTime * 6) * 5 : 0
  })
  const enMarte = sala.tAterrizaje > 0
  const hora = sala.ambiente.hora
  const noche = hora >= 22 || hora < 6
  // Sin energía, la base queda a oscuras con luz de emergencia.
  const apagon = sala.energia.cortes.length >= 4
  const luz = apagon ? 0.12 : noche ? 0.4 : 1
  const cielo = !enMarte ? '#02040a' : hora < 5.5 || hora > 19.5 ? '#0b0a14' : sala.ambiente.tormentaPolvo ? '#8a4a2c' : '#c98a62'
  return (
    <group>
      <color attach="background" args={[cielo]} />
      <ambientLight intensity={0.55 * luz + 0.08} />
      <hemisphereLight args={['#ffffff', '#3b424e', 0.35 * luz]} />
      {[-6, 0, 6].map((x) => (
        <pointLight key={x} position={[x, 2.6, 0]} intensity={9 * luz} distance={11} decay={2} color={apagon ? '#ff6b6b' : '#fff5e6'} />
      ))}
      <pointLight ref={luzAlerta} position={[0, 2.5, 0]} color="#ff3b30" distance={22} intensity={0} />
      {/* luz que entra por el ventanal */}
      <directionalLight position={[-30, 12, 6]} intensity={enMarte ? (noche ? 0.05 : 0.9) : 0.7} color={enMarte ? '#ffd9b8' : '#ffffff'} />
      <Casco />
      <Vista sala={sala} />
      <Puente cerca={cerca} destacadas={destacadas} />
      <Estaciones sala={sala} cerca={cerca} destacadas={destacadas} />
      <Esclusa sala={sala} cerca={cerca} destacadas={destacadas} />
    </group>
  )
}
