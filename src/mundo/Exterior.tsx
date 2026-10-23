// La superficie de Marte alrededor de la base: el hábitat por fuera, los equipos desplegados
// y los puntos de muestreo. La luz, el cielo y el polvo siguen la hora local y el clima.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { RoomState } from '@shared/types'
import { useGraficos } from '../graficos'
import { escenarioDe, fechaDeMision } from '@shared/escenarios'
import { Cielo } from './cielo/Cielo'
import { vectorHelio } from './cielo/astro'
import { SITIOS_MARTE, orientacionCieloMarte } from './cieloMarte'
import { Marca, Rotulo } from './Interior'
import { ESTACIONES, ESTACION_BY_ID, estacionVisible } from './mapa'
import { BordeCrater, CampoRipples, CupulaCielo, Huellas, Rocas, Rodadas, Terreno, cableSuelo, coloresCielo } from './MarteSuelo'
import { empolvar, texturaFranjas, texturaMLI, texturaPanelSolar, texturaRadiador, texturaRotulo } from './procedural'

const mezclar = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t)))

/** Marca un material para que lleve polvo marciano posado (se llama como `ref`). */
const conPolvo = (m: THREE.MeshStandardMaterial | null) => {
  if (m && !m.userData.polvo) {
    m.userData.polvo = true
    empolvar(m, 0.5)
  }
}

/**
 * El hábitat visto por fuera: el mismo módulo en el que se viajó, forrado de mantas térmicas
 * (MLI), con radiadores en el techo, pasamanos de paseo, esclusa con su escotilla y dos
 * suitports (puertos donde se acoplan los trajes por la espalda), todo con polvo encima.
 */
function Habitat({ sala }: { sala: RoomState }) {
  const noche = sala.ambiente.hora < 6 || sala.ambiente.hora > 19
  const alta = useGraficos((s) => s.calidad) === 'alta'
  const m = useMemo(() => {
    const mli = texturaMLI().clone()
    mli.repeat.set(12, 8)
    mli.needsUpdate = true
    const mliEsclusa = texturaMLI().clone()
    mliEsclusa.repeat.set(2, 2)
    mliEsclusa.needsUpdate = true
    const rad = texturaRadiador()
    return {
      casco: empolvar(new THREE.MeshStandardMaterial({ map: mli, roughness: 0.85, metalness: 0.05 }), 0.5),
      esclusa: empolvar(new THREE.MeshStandardMaterial({ map: mliEsclusa, roughness: 0.85 }), 0.5),
      radiador: empolvar(new THREE.MeshStandardMaterial({ map: rad, roughness: 0.4, metalness: 0.2 }), 0.35),
      metal: empolvar(new THREE.MeshStandardMaterial({ color: '#b9bfc8', roughness: 0.5, metalness: 0.25 }), 0.4),
      pasamanos: new THREE.MeshStandardMaterial({ color: '#d4a62a', roughness: 0.5, metalness: 0.3 }),
      oscuro: new THREE.MeshStandardMaterial({ color: '#1f2630', roughness: 0.5, metalness: 0.4 }),
      franjas: (() => {
        const t = texturaFranjas().clone()
        t.repeat.set(6, 1)
        t.needsUpdate = true
        return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })
      })(),
      rotulo: new THREE.MeshStandardMaterial({ map: texturaRotulo('SUITPORT', '#e9e7df', '#1a1a1a'), roughness: 0.8 }),
    }
  }, [])
  return (
    <group>
      <mesh position={[0, 1.7, 0]} rotation={[0, 0, Math.PI / 2]} material={m.casco} castShadow receiveShadow>
        <cylinderGeometry args={[3.5, 3.5, 18.4, 40, 1, true]} />
      </mesh>
      {[-9.2, 9.2].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
          <cylinderGeometry args={[3.5, 3.5, 0.3, 40]} />
        </mesh>
      ))}
      {/* ventanal del puente */}
      <mesh position={[-9.4, 1.9, 0]}>
        <boxGeometry args={[0.12, 1.7, 4.6]} />
        <meshStandardMaterial color="#0b1220" emissive="#ffd9a0" emissiveIntensity={noche ? 0.9 : 0.15} roughness={0.1} />
      </mesh>
      {/* anillos de estructura sobre las mantas */}
      {[-5, 0, 5].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[3.53, 3.53, 0.25, 40, 1, true]} />
          <meshStandardMaterial ref={conPolvo} color="#c2410c" roughness={0.6} />
        </mesh>
      ))}
      {/* patas */}
      {[[-7, -3.4], [-7, 3.4], [7, -3.4], [7, 3.4]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.5, z]} rotation={[z > 0 ? -0.5 : 0.5, 0, 0]} material={m.metal}>
          <cylinderGeometry args={[0.14, 0.2, 2.2, 10]} />
        </mesh>
      ))}
      {/* radiadores en el techo: dos aletas verticales sobre puntales */}
      {[-1, 1].map((s) => (
        <group key={s} position={[-1.5, 5.15, s * 0.9]} rotation={[s * 0.18, 0, 0]}>
          <mesh position={[0, 0.85, 0]} material={m.radiador} castShadow>
            <boxGeometry args={[8, 1.4, 0.05]} />
          </mesh>
          {[-3.6, 0, 3.6].map((x) => (
            <mesh key={x} position={[x, 0.08, 0]} material={m.metal}>
              <cylinderGeometry args={[0.05, 0.05, 0.35, 6]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* pasamanos dorados para los paseos por fuera */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 1.7 + 3.62 * Math.sin(0.9), s * 3.62 * Math.cos(0.9)]} rotation={[0, 0, Math.PI / 2]} material={m.pasamanos}>
          <cylinderGeometry args={[0.03, 0.03, 14, 6]} />
        </mesh>
      ))}
      {alta &&
        [-1, 1].flatMap((s) =>
          [-6, -3, 0, 3, 6].map((x) => (
            <mesh key={`${s}${x}`} position={[x, 1.7 + 3.56 * Math.sin(0.9), s * 3.56 * Math.cos(0.9)]} rotation={[s * (Math.PI / 2 - 0.9), 0, 0]} material={m.pasamanos}>
              <boxGeometry args={[0.04, 0.14, 0.04]} />
            </mesh>
          )),
        )}
      {/* módulo de la esclusa */}
      <mesh position={[10.1, 1.25, 0]} material={m.esclusa} castShadow>
        <boxGeometry args={[1.6, 2.4, 2.4]} />
      </mesh>
      {/* escotilla exterior con marco, ventanilla y palanca */}
      <mesh position={[10.92, 1.2, 0]} material={m.metal}>
        <boxGeometry args={[0.06, 2.15, 1.45]} />
      </mesh>
      <mesh position={[10.95, 1.2, 0]}>
        <boxGeometry args={[0.04, 2.0, 1.3]} />
        <meshStandardMaterial color="#9aa3ae" roughness={0.45} metalness={0.5} emissive="#3ddc97" emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[10.975, 1.6, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.13, 20]} />
        <meshStandardMaterial color="#0b1220" emissive="#ffe9c4" emissiveIntensity={noche ? 0.8 : 0.1} roughness={0.05} />
      </mesh>
      <mesh position={[10.99, 1.1, 0]} rotation={[0.4, 0, 0]} material={m.oscuro}>
        <boxGeometry args={[0.04, 0.05, 0.42]} />
      </mesh>
      {/* luz de estado y focos sobre la puerta */}
      <mesh position={[10.95, 2.3, 0]}>
        <boxGeometry args={[0.05, 0.08, 0.5]} />
        <meshBasicMaterial color={noche ? '#fff1d6' : '#d9d2c4'} />
      </mesh>
      {/* pasamanos a los lados de la puerta */}
      {[-0.85, 0.85].map((z) => (
        <mesh key={z} position={[10.98, 1.2, z]} material={m.pasamanos}>
          <cylinderGeometry args={[0.025, 0.025, 1.3, 6]} />
        </mesh>
      ))}
      {/* suitports en los costados: anillo, tapa con la forma de la mochila y rótulo */}
      {[-1, 1].map((s) => (
        <group key={s} position={[10.1, 1.3, s * 1.205]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
          <mesh material={m.metal}>
            <torusGeometry args={[0.42, 0.05, 8, 28]} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[0.55, 0.72, 0.05]} />
            <meshStandardMaterial ref={conPolvo} color="#e7e5de" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.62, 0.01]} material={m.rotulo}>
            <planeGeometry args={[0.6, 0.11]} />
          </mesh>
        </group>
      ))}
      {/* rampa con franjas de aviso */}
      <mesh position={[11.4, 0.08, 0]} material={m.metal}>
        <boxGeometry args={[1.2, 0.16, 2]} />
      </mesh>
      <mesh position={[11.95, 0.165, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={m.franjas}>
        <planeGeometry args={[2, 0.12]} />
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

/** Cables de potencia por el suelo: del hábitat a la planta y de la planta a los paneles y al reactor. */
function Cables({ sala }: { sala: RoomState }) {
  const planta = estacionVisible(sala, 'plantaExt')
  const proc = sala.procedimientos?.paneles
  const paneles = Boolean(sala.ensamblaje.hechas.paneles) || (proc?.paso ?? 0) >= 2
  const reactor = sala.cargamento.reactor > 0 && Boolean(sala.ensamblaje.hechas.carga)
  const sitio = sala.procedimientos?.carga?.valores?.[2]
  const geo = useMemo(() => {
    const p = ESTACION_BY_ID.plantaExt
    const sol = ESTACION_BY_ID.campoSolar
    const rutas: [number, number][][] = []
    if (planta) rutas.push([[8.6, -3.7], [10.5, -4.6], [12.6, -6.6], [p.x - 0.85, p.z + 0.2]])
    if (planta && paneles)
      rutas.push([[p.x + 0.85, p.z - 0.3], [17.5, -11], [sol.x - 6.6, sol.z - 1.6]], [[sol.x - 6.6, sol.z - 1.6], [sol.x + 6.6, sol.z - 1.6]], [[sol.x - 6.6, sol.z - 1.6], [sol.x - 6.6, sol.z - 7.2]])
    if (planta && reactor)
      rutas.push(sitio === 'cerca' ? [[-7, 3.9], [-6.6, 8], [-6, 13]] : [[p.x + 0.6, p.z + 0.65], [23, 2], [23.5, 18], [22, 29]])
    if (!rutas.length) return null
    return mergeGeometries(rutas.map((r) => cableSuelo(r)))
  }, [planta, paneles, reactor, sitio])
  if (!geo) return null
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial ref={conPolvo} color="#2b2f36" roughness={0.8} />
    </mesh>
  )
}

/** Hacia dónde gira cada fila de paneles según la orientación elegida (el norte es −z). */
const GIRO_AZIMUT: Record<string, number> = { norte: 0, sur: Math.PI, este: -Math.PI / 2, oeste: Math.PI / 2 }

function CampoSolar({ sala }: { sala: RoomState }) {
  const e = ESTACION_BY_ID.campoSolar
  const desplegado = Boolean(sala.ensamblaje.hechas.paneles)
  const n = sala.cargamento.paneles
  // Las celdas se van cubriendo de polvo: la textura se tiñe del color del regolito.
  const celda = mezclar('#ffffff', '#c0703f', sala.energia.polvo * 2.2)
  // Mientras se monta se ven los pasos: marcos anclados, alas desenrolladas y por fin inclinadas.
  const proc = sala.procedimientos?.paneles
  const hechos = desplegado ? 4 : (proc?.paso ?? 0)
  if (hechos < 2) {
    // Paquetes enrollados esperando a que alguien los despliegue.
    return (
      <group position={[e.x, 0, e.z]}>
        {Array.from({ length: Math.min(n, 4) }, (_, i) => (
          <mesh key={i} position={[(i % 2) * 1.5 - 0.75, 0.4 + Math.floor(i / 2) * 0.75, -2.2]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 2, 16]} />
            <meshStandardMaterial color="#334155" roughness={0.6} />
          </mesh>
        ))}
      </group>
    )
  }
  const giro = GIRO_AZIMUT[String(proc?.valores?.[0] ?? 'norte')] ?? 0
  const inclinacion = hechos >= 4 ? ((Number(proc?.valores?.[3] ?? 24) || 0) * Math.PI) / 180 : 0
  const desenrollado = hechos >= 3
  return (
    <group position={[e.x, 0, e.z]}>
      {Array.from({ length: n * 2 }, (_, i) => {
        const fila = Math.floor(i / 4)
        const col = i % 4
        return (
          <group key={i} position={[col * 4.4 - 6.6, 0, -3 - fila * 4.2]} rotation={[0, giro, 0]}>
            {desenrollado ? (
              <mesh position={[0, 1.3, 0]} rotation={[-inclinacion, 0, 0]} castShadow>
                <boxGeometry args={[4, 0.08, 2.3]} />
                <meshStandardMaterial map={texturaPanelSolar()} color={celda} metalness={0.55} roughness={0.3} emissive="#0a1f3d" emissiveIntensity={0.15} />
              </mesh>
            ) : (
              <mesh position={[-1.8, 1.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.18, 2.3, 12]} />
                <meshStandardMaterial color="#334155" roughness={0.6} />
              </mesh>
            )}
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
        <meshStandardMaterial ref={conPolvo} color="#8793a5" metalness={0.4} roughness={0.5} />
      </mesh>
      {[-0.5, 0, 0.5].map((x) => (
        <mesh key={x} position={[x, 1.75, 0]}>
          <boxGeometry args={[0.08, 0.6, 1.1]} />
          <meshStandardMaterial ref={conPolvo} color="#cbd5e1" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 1.0, 0.62]}>
        <boxGeometry args={[0.6, 0.3, 0.04]} />
        <meshStandardMaterial color="#0b1220" emissive={color} emissiveIntensity={1} />
      </mesh>
      {/* reactor, lejos de la base */}
      {sala.cargamento.reactor > 0 && sala.ensamblaje.hechas.carga && (
        // Junto al hábitat, a lo lejos sobre el suelo, o hundido en su hoyo con regolito.
        <group position={sala.procedimientos?.carga?.valores?.[2] === 'cerca' ? [-6, 0, 14] : [22, sala.procedimientos?.carga?.valores?.[2] === 'lejos' ? 0 : -1.6, 30]}>
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
          <meshStandardMaterial ref={conPolvo} color={['#b98b52', '#94a3b8', '#d6b37a'][i % 3]} roughness={0.9} />
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

function CieloNocturno({ sala, brillo }: { sala: RoomState; brillo: number }) {
  const fecha = fechaDeMision(escenarioDe(sala.escenario), Math.max(0, sala.t))
  const sitio = SITIOS_MARTE[sala.sitio ?? 'gale'] ?? SITIOS_MARTE.gale
  const minuto = Math.floor(fecha.getTime() / 300_000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const orientacion = useMemo(() => orientacionCieloMarte(fecha, sitio.lat, sitio.lon, sala.ambiente.hora), [minuto, sitio.lat])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const observador = useMemo(() => vectorHelio('Marte', fecha), [Math.floor(minuto / 12)])
  return <Cielo fecha={fecha} observador={observador} orientacion={orientacion} brillo={Math.max(0, brillo) * 0.9} atmosfera centelleo={0.05} etiquetas ocultarCuerpos={['Sol']} />
}

export function Exterior({ sala, cerca, destacadas }: { sala: RoomState; cerca: string | null; destacadas: string[] }) {
  const a = sala.ambiente
  const alta = useGraficos((s) => s.calidad) === 'alta'
  // Altura del Sol: 0 de noche, 1 al mediodía.
  const dia = Math.max(0, Math.sin(((a.hora - 6.6) / 12.4) * Math.PI))
  const esNoche = a.hora < 6.3 || a.hora > 19.3
  const polvo = Math.min(1, Math.max(0, (a.tau - 0.5) / 3.5))
  const angulo = ((a.hora - 6.6) / 12.4) * Math.PI
  // Cielo de Marte: caramelo de día, halo azul junto al Sol al atardecer (ver MarteSuelo).
  const colores = useMemo(() => coloresCielo(Math.sin(angulo), polvo), [angulo, polvo])
  const cielo = colores.horizonte
  const suelo = useMemo(() => mezclar('#3a1a10', '#b4542f', 0.25 + dia * 0.75), [dia])
  const sol = useMemo<[number, number, number]>(() => [Math.cos(angulo) * 120, Math.max(6, Math.sin(angulo) * 120), -40], [angulo])
  const lejos = useMemo(() => suelo.clone().lerp(cielo, 0.62), [suelo, cielo])
  const visibilidad = 190 - polvo * 150

  return (
    <group>
      <color attach="background" args={[cielo.getHex()]} />
      <CupulaCielo colores={colores} sol={sol} />
      <fog attach="fog" args={[cielo.getHex(), 18, visibilidad]} />
      <ambientLight intensity={0.16 + dia * 0.45} color={esNoche ? '#9db4ff' : '#ffe2c8'} />
      <hemisphereLight args={['#ffd2b0', '#4a1f10', 0.12 + dia * 0.3]} />
      <directionalLight position={sol} intensity={dia * 1.9 * (1 - polvo * 0.75)} color={dia < 0.25 ? '#ffc999' : '#ffe6cf'} castShadow />
      {/* De noche, el cielo real del sitio: estrellas, planetas y la Tierra como un lucero azulado. */}
      {(esNoche || dia < 0.15) && <CieloNocturno sala={sala} brillo={(1 - dia / 0.15) * (1 - polvo * 0.85)} />}
      {/* disco del Sol, pequeño: desde Marte se ve dos tercios del tamaño que tiene desde la Tierra */}
      {dia > 0.02 && (
        <mesh position={[sol[0] * 2, sol[1] * 2, sol[2] * 2]}>
          <sphereGeometry args={[3.2, 16, 16]} />
          <meshBasicMaterial color="#fff3df" fog={false} />
        </mesh>
      )}
      <Terreno color={suelo} />
      <BordeCrater color={lejos} />
      <CampoRipples color={suelo} />
      <Rodadas />
      {alta && <Huellas />}
      <Rocas />
      <Habitat sala={sala} />
      <Cables sala={sala} />
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
