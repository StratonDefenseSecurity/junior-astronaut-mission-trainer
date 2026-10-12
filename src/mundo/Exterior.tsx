// La superficie de Marte alrededor de la base: el hábitat por fuera, los equipos desplegados
// y los puntos de muestreo. La luz, el cielo y el polvo siguen la hora local y el clima.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RoomState } from '@shared/types'
import { Marca, Rotulo } from './Interior'
import { ESTACIONES, ESTACION_BY_ID, estacionVisible } from './mapa'

const mezclar = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t)))

function Terreno({ color }: { color: THREE.Color }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(420, 420, 110, 110)
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const d = Math.sqrt(x * x + y * y)
      // Llano donde se camina; dunas y colinas más allá.
      const relieve = Math.min(1, Math.max(0, (d - 50) / 40))
      const h = (Math.sin(x * 0.045) * Math.cos(y * 0.05) * 7 + Math.sin(x * 0.13 + y * 0.09) * 1.8 + Math.cos(y * 0.21) * 0.8) * relieve
      const ondas = Math.sin(x * 0.6) * Math.cos(y * 0.5) * 0.04
      pos.setZ(i, h + ondas)
    }
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial color={color} roughness={1} metalness={0} />
    </mesh>
  )
}

function Rocas() {
  const rocas = useMemo(() => {
    let s = 7
    const azar = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    const lista: { p: [number, number, number]; e: number; g: number }[] = []
    while (lista.length < 90) {
      const a = azar() * Math.PI * 2
      const r = 6 + azar() * 110
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      // Ni encima del hábitat ni pegadas a una estación.
      if (Math.abs(x) < 12 && Math.abs(z) < 6) continue
      if (ESTACIONES.some((e) => e.zona === 'exterior' && Math.hypot(e.x - x, e.z - z) < 3.5)) continue
      const e = r < 46 ? 0.15 + azar() * 0.35 : 0.5 + azar() * 2.4
      lista.push({ p: [x, e * 0.3, z], e, g: azar() * 6 })
    }
    return lista
  }, [])
  return (
    <>
      {rocas.map((r, i) => (
        <mesh key={i} position={r.p} scale={r.e} rotation={[r.g, r.g * 1.7, 0]} castShadow>
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color="#7a3a22" roughness={1} />
        </mesh>
      ))}
    </>
  )
}

/** El hábitat visto por fuera: el mismo módulo en el que se viajó. */
function Habitat({ sala }: { sala: RoomState }) {
  const noche = sala.ambiente.hora < 6 || sala.ambiente.hora > 19
  return (
    <group>
      <mesh position={[0, 1.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[3.5, 3.5, 18.4, 32]} />
        <meshStandardMaterial color="#d7dde6" roughness={0.6} metalness={0.25} />
      </mesh>
      {[-9.2, 9.2].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[3.5, 3.5, 0.3, 32]} />
          <meshStandardMaterial color="#aab3c0" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* ventanal del puente */}
      <mesh position={[-9.4, 1.9, 0]}>
        <boxGeometry args={[0.12, 1.7, 4.6]} />
        <meshStandardMaterial color="#0b1220" emissive="#ffd9a0" emissiveIntensity={noche ? 0.9 : 0.15} roughness={0.1} />
      </mesh>
      {/* franjas de color */}
      {[-5, 0, 5].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[3.53, 3.53, 0.25, 32]} />
          <meshStandardMaterial color="#c2410c" roughness={0.6} />
        </mesh>
      ))}
      {/* patas */}
      {[[-7, -3.4], [-7, 3.4], [7, -3.4], [7, 3.4]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.5, z]} rotation={[z > 0 ? -0.5 : 0.5, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.2, 2.2, 10]} />
          <meshStandardMaterial color="#5b6472" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {/* túnel de la esclusa */}
      <mesh position={[10.1, 1.25, 0]} castShadow>
        <boxGeometry args={[1.6, 2.4, 2.4]} />
        <meshStandardMaterial color="#b8c0cc" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[10.93, 1.2, 0]}>
        <boxGeometry args={[0.06, 2.0, 1.3]} />
        <meshStandardMaterial color="#334155" emissive="#3ddc97" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[11.4, 0.08, 0]}>
        <boxGeometry args={[1.2, 0.16, 2]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} />
      </mesh>
      <pointLight position={[12, 3.2, 0]} intensity={noche ? 40 : 0} distance={26} color="#fff1d6" />
      <pointLight position={[-11, 3.2, 0]} intensity={noche ? 20 : 0} distance={20} color="#fff1d6" />
      {/* cúpula del huerto */}
      {sala.huerto.progreso > 0 && (
        <mesh position={[2, 0, 5.8]}>
          <sphereGeometry args={[2.6, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={sala.huerto.establecido ? '#86efac' : '#cbd5e1'} emissive="#166534" emissiveIntensity={sala.huerto.establecido ? 0.45 : 0.05} transparent opacity={0.55} roughness={0.15} />
        </mesh>
      )}
    </group>
  )
}

function CampoSolar({ sala }: { sala: RoomState }) {
  const e = ESTACION_BY_ID.campoSolar
  const desplegado = Boolean(sala.ensamblaje.hechas.paneles)
  const n = sala.cargamento.paneles
  const celda = mezclar('#1c3b6e', '#a0623f', sala.energia.polvo * 2.2)
  if (!desplegado) {
    // Paquetes plegados esperando a que alguien los despliegue.
    return (
      <group position={[e.x, 0, e.z]}>
        {Array.from({ length: Math.min(n, 4) }, (_, i) => (
          <mesh key={i} position={[(i % 2) * 1.5 - 0.75, 0.4 + Math.floor(i / 2) * 0.75, -2.2]} castShadow>
            <boxGeometry args={[1.3, 0.7, 2]} />
            <meshStandardMaterial color="#334155" roughness={0.6} />
          </mesh>
        ))}
      </group>
    )
  }
  return (
    <group position={[e.x, 0, e.z]}>
      {Array.from({ length: n * 2 }, (_, i) => {
        const fila = Math.floor(i / 4)
        const col = i % 4
        return (
          <group key={i} position={[col * 4.4 - 6.6, 0, -3 - fila * 4.2]}>
            <mesh position={[0, 1.3, 0]} rotation={[-0.42, 0, 0]} castShadow>
              <boxGeometry args={[4, 0.08, 2.3]} />
              <meshStandardMaterial color={celda} metalness={0.7} roughness={0.25} emissive="#0a1f3d" emissiveIntensity={0.3} />
            </mesh>
            <mesh position={[0, 0.6, 0.2]}>
              <cylinderGeometry args={[0.07, 0.07, 1.2, 8]} />
              <meshStandardMaterial color="#64748b" metalness={0.6} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function PlantaEnergia({ sala }: { sala: RoomState }) {
  const e = ESTACION_BY_ID.plantaExt
  const s = sala.sistemas.find((x) => x.id === 'energia')!
  const conectada = Boolean(sala.ensamblaje.hechas.energia)
  const color = s.integridad <= 15 ? '#ef5350' : conectada ? '#3ddc97' : '#f5b942'
  return (
    <group position={[e.x, 0, e.z]}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[1.6, 1.5, 1.2]} />
        <meshStandardMaterial color="#8793a5" metalness={0.4} roughness={0.5} />
      </mesh>
      {[-0.5, 0, 0.5].map((x) => (
        <mesh key={x} position={[x, 1.75, 0]}>
          <boxGeometry args={[0.08, 0.6, 1.1]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 1.0, 0.62]}>
        <boxGeometry args={[0.6, 0.3, 0.04]} />
        <meshStandardMaterial color="#0b1220" emissive={color} emissiveIntensity={1} />
      </mesh>
      {/* reactor, lejos de la base */}
      {sala.cargamento.reactor > 0 && sala.ensamblaje.hechas.carga && (
        <group position={[22, 0, 30]}>
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.7, 2.4, 14]} />
            <meshStandardMaterial color="#9aa5b5" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 3.2, 0]}>
            <coneGeometry args={[2.4, 1.3, 16, 1, true]} />
            <meshStandardMaterial color="#e2e8f0" side={THREE.DoubleSide} metalness={0.5} roughness={0.4} />
          </mesh>
          <pointLight position={[0, 1, 0]} color="#7dd3fc" intensity={6} distance={10} />
        </group>
      )}
    </group>
  )
}

function Carga({ sala }: { sala: RoomState }) {
  const e = ESTACION_BY_ID.carga
  const descargada = Boolean(sala.ensamblaje.hechas.carga)
  const cajas: [number, number, number][] = descargada
    ? [[-1.2, 0.35, 0.6], [1.1, 0.35, -0.4], [0.2, 0.35, 1.3]]
    : [[-0.6, 0.45, 0], [0.6, 0.45, 0], [0, 0.45, 0.95], [-0.3, 1.35, 0.2], [0.5, 1.35, 0.4], [0, 2.2, 0.3]]
  return (
    <group position={[e.x, 0, e.z]}>
      {cajas.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[1, descargada ? 0.7 : 0.9, 0.9]} />
          <meshStandardMaterial color={['#b98b52', '#94a3b8', '#d6b37a'][i % 3]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Antena() {
  const e = ESTACION_BY_ID.antena
  const plato = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (plato.current) plato.current.rotation.y += dt * 0.05
  })
  return (
    <group position={[e.x, 0, e.z]}>
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.14, 4, 10]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
      </mesh>
      <group ref={plato} position={[0, 4.1, 0]}>
        <mesh rotation={[-0.9, 0, 0]}>
          <sphereGeometry args={[1.1, 20, 10, 0, Math.PI * 2, 0, 0.9]} />
          <meshStandardMaterial color="#e2e8f0" side={THREE.DoubleSide} metalness={0.4} roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

function Extractor({ sala }: { sala: RoomState }) {
  const e = ESTACION_BY_ID.isruExt
  const s = sala.sistemas.find((x) => x.id === 'isru')!
  return (
    <group position={[e.x, 0, e.z]}>
      {[[-0.8, -0.8], [0.8, -0.8], [0, 0.9]].map(([x, z], i) => (
        <mesh key={i} position={[x * 0.5, 1.6, z * 0.5]} rotation={[z * 0.25, 0, -x * 0.25]}>
          <cylinderGeometry args={[0.06, 0.06, 3.4, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} />
        </mesh>
      ))}
      <mesh position={[2, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.8, 0.8, 1.6, 18]} />
        <meshStandardMaterial color="#9fd3f5" metalness={0.5} roughness={0.3} emissive="#0c4a6e" emissiveIntensity={s.operativo ? 0.5 : 0} />
      </mesh>
    </group>
  )
}

/** Baliza de un punto de muestreo aún sin visitar. */
function Baliza() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 1.5 + Math.sin(clock.elapsedTime * 2) * 0.12
  })
  return (
    <group>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.4, 6]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh ref={ref} position={[0, 1.5, 0]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshBasicMaterial color="#c084fc" />
      </mesh>
      <pointLight position={[0, 1.5, 0]} color="#c084fc" intensity={4} distance={7} />
    </group>
  )
}

function Polvareda({ fuerza }: { fuerza: number }) {
  const ref = useRef<THREE.Points>(null)
  const posiciones = useMemo(() => {
    const arr = new Float32Array(900 * 3)
    for (let i = 0; i < 900; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 120
      arr[i * 3 + 1] = Math.random() * 22
      arr[i * 3 + 2] = (Math.random() - 0.5) * 120
    }
    return arr
  }, [])
  useFrame((_, dt) => {
    if (!ref.current) return
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) + dt * (9 + fuerza * 5)
      if (x > 60) x = -60
      p.setX(i, x)
      p.setY(i, (p.getY(i) + dt * 0.6) % 22)
    }
    p.needsUpdate = true
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posiciones, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.22} color="#e0a070" transparent opacity={0.75} />
    </points>
  )
}

function Estrellas() {
  const pos = useMemo(() => {
    const arr = new Float32Array(1000 * 3)
    for (let i = 0; i < 1000; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.random() * Math.PI * 0.48
      arr[i * 3] = 300 * Math.sin(ph) * Math.cos(th)
      arr[i * 3 + 1] = 300 * Math.cos(ph)
      arr[i * 3 + 2] = 300 * Math.sin(ph) * Math.sin(th)
    }
    return arr
  }, [])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={1.1} color="#dbe7ff" fog={false} />
    </points>
  )
}

export function Exterior({ sala, cerca, destacadas }: { sala: RoomState; cerca: string | null; destacadas: string[] }) {
  const a = sala.ambiente
  // Altura del Sol: 0 de noche, 1 al mediodía.
  const dia = Math.max(0, Math.sin(((a.hora - 6.6) / 12.4) * Math.PI))
  const esNoche = a.hora < 6.3 || a.hora > 19.3
  const polvo = Math.min(1, Math.max(0, (a.tau - 0.5) / 3.5))
  const cielo = useMemo(() => {
    const base = mezclar('#0b0a14', '#d39a6f', Math.pow(dia, 0.45))
    return base.lerp(new THREE.Color('#7a4226'), polvo * 0.8 * (dia > 0 ? 1 : 0.4))
  }, [dia, polvo])
  const suelo = useMemo(() => mezclar('#3a1a10', '#b4542f', 0.25 + dia * 0.75), [dia])
  const angulo = ((a.hora - 6.6) / 12.4) * Math.PI
  const sol: [number, number, number] = [Math.cos(angulo) * 120, Math.max(6, Math.sin(angulo) * 120), -40]
  const visibilidad = 190 - polvo * 150

  return (
    <group>
      <color attach="background" args={[cielo.getHex()]} />
      <fog attach="fog" args={[cielo.getHex(), 18, visibilidad]} />
      <ambientLight intensity={0.16 + dia * 0.45} color={esNoche ? '#9db4ff' : '#ffe2c8'} />
      <hemisphereLight args={['#ffd2b0', '#4a1f10', 0.12 + dia * 0.3]} />
      <directionalLight position={sol} intensity={dia * 1.9 * (1 - polvo * 0.75)} color="#ffe6cf" castShadow />
      {esNoche && <Estrellas />}
      {/* disco del Sol, pequeño: desde Marte se ve dos tercios del tamaño que tiene desde la Tierra */}
      {dia > 0.02 && (
        <mesh position={[sol[0] * 2, sol[1] * 2, sol[2] * 2]}>
          <sphereGeometry args={[3.2, 16, 16]} />
          <meshBasicMaterial color="#fff3df" fog={false} />
        </mesh>
      )}
      <Terreno color={suelo} />
      <Rocas />
      <Habitat sala={sala} />
      <CampoSolar sala={sala} />
      {estacionVisible(sala, 'plantaExt') && <PlantaEnergia sala={sala} />}
      <Carga sala={sala} />
      <Antena />
      {estacionVisible(sala, 'isruExt') && <Extractor sala={sala} />}
      {a.tormentaPolvo && <Polvareda fuerza={polvo} />}
      {ESTACIONES.filter((e) => e.zona === 'exterior' && estacionVisible(sala, e.id)).map((e) => (
        <group key={e.id} position={[e.x, 0, e.z]}>
          {e.id.startsWith('muestra') && <Baliza />}
          <group position={e.radio > 0 ? [0, 0, e.radio + 0.9] : [0, 0, 0]}>
            <Marca activo={cerca === e.id} destacado={destacadas.includes(e.id)} radio={e.id.startsWith('muestra') ? 0.9 : 1.1} />
          </group>
          <Rotulo texto={e.nombre} y={e.id === 'antena' ? 5.6 : e.id.startsWith('muestra') ? 2.3 : 3.2} activo={cerca === e.id} destacado={destacadas.includes(e.id)} />
        </group>
      ))}
    </group>
  )
}
