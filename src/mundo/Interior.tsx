// Interior del hábitat: es la nave durante el viaje y la base una vez en Marte.
//
// Se inspira en los módulos de la Estación Espacial: paredes cubiertas de bastidores de equipos,
// pasamanos para moverse sin gravedad, cables, bolsas de carga blancas, luces LED y anillos de
// estructura. Cada espacio tiene su equipo: cinta de correr y bicicleta en el gimnasio, sacos
// de dormir sujetos a la pared (en Marte, literas), cámara de cultivo con luz rosada de LED
// rojos y azules, camilla en la enfermería y una mesa común en el centro para comer y conversar.
// Sin gravedad, algunos objetos sueltos flotan por el módulo.
import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { Almohadilla, CultivoId, RoomState } from '@shared/types'
import { ESTACION_BY_ID, INTERIOR, PUNTOS } from './mapa'
import { Ventana } from './Ventana'

const L = INTERIOR.x1 - INTERIOR.x0
const A = INTERIOR.z1 - INTERIOR.z0
const H = INTERIOR.alto
/** Altura a la que empieza el chaflán entre pared y techo. */
const HP = 2.45

/** Sin gravedad: el viaje y la órbita de Marte. */
export const enMicrogravedad = (sala: RoomState) => sala.fase === 'transito' || (sala.fase === 'llegada' && sala.subfase !== 'descenso')

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
    m.opacity = activo ? 0.9 : destacado ? 0.45 + Math.sin(clock.elapsedTime * 4) * 0.3 : 0.14
    ref.current.scale.setScalar(destacado && !activo ? 1 + Math.sin(clock.elapsedTime * 4) * 0.08 : 1)
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <ringGeometry args={[radio * 0.78, radio, 40]} />
      <meshBasicMaterial color={activo ? '#4fc3f7' : destacado ? '#f5b942' : '#8aa0bd'} transparent opacity={0.3} depthWrite={false} />
    </mesh>
  )
}

// ---------- Materiales compartidos ----------

const MAT = {
  panel: new THREE.MeshStandardMaterial({ color: '#dcd8cc', roughness: 0.78, metalness: 0.05 }),
  panelClaro: new THREE.MeshStandardMaterial({ color: '#eceae3', roughness: 0.7, metalness: 0.05 }),
  panelGris: new THREE.MeshStandardMaterial({ color: '#b9bec6', roughness: 0.6, metalness: 0.2 }),
  junta: new THREE.MeshStandardMaterial({ color: '#8e949c', roughness: 0.5, metalness: 0.4 }),
  metal: new THREE.MeshStandardMaterial({ color: '#c7ccd3', roughness: 0.3, metalness: 0.8 }),
  pasamanos: new THREE.MeshStandardMaterial({ color: '#7f97b8', roughness: 0.4, metalness: 0.6 }),
  suelo: new THREE.MeshStandardMaterial({ color: '#4a505a', roughness: 0.85, metalness: 0.15 }),
  sueloRaya: new THREE.MeshStandardMaterial({ color: '#3a3f47', roughness: 0.9 }),
  oscuro: new THREE.MeshStandardMaterial({ color: '#1f242b', roughness: 0.6, metalness: 0.3 }),
  bolsa: new THREE.MeshStandardMaterial({ color: '#f1f0ea', roughness: 0.95 }),
  cinta: new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 0.95 }),
  cable: new THREE.MeshStandardMaterial({ color: '#3d4c63', roughness: 0.7 }),
  cableNaranja: new THREE.MeshStandardMaterial({ color: '#d9822b', roughness: 0.7 }),
  led: new THREE.MeshBasicMaterial({ color: '#fff4e2' }),
  saco: new THREE.MeshStandardMaterial({ color: '#4f6f9a', roughness: 0.92 }),
  sacoCierre: new THREE.MeshStandardMaterial({ color: '#2f4467', roughness: 0.9 }),
  colchon: new THREE.MeshStandardMaterial({ color: '#d8dee6', roughness: 0.95 }),
  planta: new THREE.MeshStandardMaterial({ color: '#3c9a4a', roughness: 0.8 }),
  plantaClara: new THREE.MeshStandardMaterial({ color: '#69b84f', roughness: 0.8 }),
  cristal: new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }),
}

function Pantalla({ x = 0, y = 1.45, z = 0, ancho = 0.9, alto = 0.55, color = '#3ddc97', intensidad = 0.85 }: { x?: number; y?: number; z?: number; ancho?: number; alto?: number; color?: string; intensidad?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh material={MAT.oscuro}>
        <boxGeometry args={[ancho + 0.06, alto + 0.06, 0.05]} />
      </mesh>
      <mesh position={[0, 0, 0.027]}>
        <planeGeometry args={[ancho, alto]} />
        <meshStandardMaterial color="#071019" emissive={color} emissiveIntensity={intensidad} roughness={0.3} />
      </mesh>
      {/* líneas de datos */}
      {[0.28, 0.08, -0.12].map((f, i) => (
        <mesh key={i} position={[-ancho * 0.1, alto * f, 0.03]}>
          <planeGeometry args={[ancho * (0.7 - i * 0.15), alto * 0.05]} />
          <meshBasicMaterial color="#e8fff4" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  )
}

/** Portátil sujeto con velcro, como los de la Estación Espacial. */
function Portatil({ x, y, z = 0.05, giro = 0 }: { x: number; y: number; z?: number; giro?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, giro, 0]}>
      <mesh material={MAT.oscuro} position={[0, 0, 0.1]}>
        <boxGeometry args={[0.36, 0.02, 0.24]} />
      </mesh>
      <mesh position={[0, 0.12, -0.01]} rotation={[-0.25, 0, 0]} material={MAT.oscuro}>
        <boxGeometry args={[0.36, 0.24, 0.015]} />
      </mesh>
      <mesh position={[0, 0.12, 0.0]} rotation={[-0.25, 0, 0]}>
        <planeGeometry args={[0.32, 0.2]} />
        <meshBasicMaterial color="#7cc4ff" />
      </mesh>
    </group>
  )
}

/** Bolsa blanca de transporte de carga. */
function Bolsa({ p, t = [0.5, 0.32, 0.4] }: { p: [number, number, number]; t?: [number, number, number] }) {
  return (
    <RoundedBox args={t} radius={0.05} smoothness={2} position={p} material={MAT.bolsa} castShadow>
      <meshStandardMaterial attach="material" color="#f1f0ea" roughness={0.95} />
    </RoundedBox>
  )
}

interface PuestoProps {
  id: string
  cerca: string | null
  destacadas: string[]
  color: string
  children?: ReactNode
}

/** Bastidor de equipos contra la pared, con su rótulo y su marca en el suelo. */
function Puesto({ id, cerca, destacadas, color, children }: PuestoProps) {
  const e = ESTACION_BY_ID[id]
  const lado = Math.sign(e.z) // -1 pared norte, +1 pared sur
  return (
    <group position={[e.x, 0, e.z]}>
      <group rotation={[0, lado > 0 ? Math.PI : 0, 0]}>
        {/* bastidor con tapa frontal y juntas */}
        <RoundedBox args={[2.5, 2.3, 0.5]} radius={0.04} smoothness={2} position={[0, 1.15, -0.28]} castShadow receiveShadow>
          <meshStandardMaterial color="#d3d0c6" roughness={0.75} metalness={0.05} />
        </RoundedBox>
        {[-1.24, 1.24].map((x) => (
          <mesh key={x} position={[x, 1.15, 0.0]} material={MAT.junta}>
            <boxGeometry args={[0.04, 2.3, 0.04]} />
          </mesh>
        ))}
        {/* franja de color de la estación, iluminada */}
        <mesh position={[0, 2.38, -0.2]}>
          <boxGeometry args={[2.5, 0.12, 0.56]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
        </mesh>
        {/* pasamanos sobre el bastidor */}
        <mesh position={[0, 2.1, 0.06]} rotation={[0, 0, Math.PI / 2]} material={MAT.pasamanos}>
          <cylinderGeometry args={[0.022, 0.022, 1.6, 8]} />
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

const tono = (malo: boolean, regular: boolean) => (malo ? '#ef5350' : regular ? '#f5b942' : '#3ddc97')

/** Color de las hojas de cada cultivo. */
const HOJA: Record<CultivoId, string> = { lechuga: '#9b2d4a', mizuna: '#4f9a3a', rabano: '#4f9a3a', chile: '#3e7f34' }
const SANA = new THREE.Color()
const AMARILLA = new THREE.Color('#c9b24a')
const SECA = new THREE.Color('#6b4a2a')

/** Una planta en su almohadilla: crece, amarillea si le falta agua y se cubre de moho si le sobra. */
function Planta({ a, cultivo, x, y }: { a: Almohadilla | null; cultivo: CultivoId; x: number; y: number }) {
  const color = useMemo(() => {
    if (!a) return SECA
    if (a.muerta) return SECA
    const c = SANA.clone().set(HOJA[cultivo]).lerp(AMARILLA, Math.min(1, Math.max(0, (75 - a.salud) / 50)))
    return a.moho > 0.1 ? c.lerp(new THREE.Color('#e5e7eb'), Math.min(0.7, a.moho)) : c
  }, [a, cultivo])
  const g = a ? (a.muerta ? 0.15 : 0.12 + 0.88 * a.crecimiento) : 0
  const brotes = a && !a.muerta ? Math.min(3, a.plantulas) : 1
  return (
    <group position={[x, y, 0.27]}>
      {/* almohadilla de tela con arcilla */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.24, 0.06, 0.2]} />
        <meshStandardMaterial color={a && a.humedad > 60 ? '#b89a76' : '#d9c3a0'} roughness={1} />
      </mesh>
      {a &&
        Array.from({ length: brotes }, (_, k) => {
          const dx = brotes > 1 ? (k - (brotes - 1) / 2) * 0.06 : 0
          const escala = brotes > 1 ? 0.6 : 1
          return (
            <group key={k} position={[dx, 0.06, 0]} scale={escala}>
              <mesh position={[0, 0.12 * g, 0]} rotation={[0, 0, a.salud < 50 ? 0.5 : 0]}>
                <coneGeometry args={[0.03 + 0.07 * g, 0.24 * g + 0.02, 6]} />
                <meshStandardMaterial color={color} roughness={0.8} />
              </mesh>
              <mesh position={[0, 0.24 * g + 0.02, 0]} scale={[1, 0.6, 1]}>
                <sphereGeometry args={[0.025 + 0.06 * g, 8, 6]} />
                <meshStandardMaterial color={color} roughness={0.8} />
              </mesh>
              {/* el rábano engorda en la raíz; el chile da frutos al final */}
              {cultivo === 'rabano' && !a.muerta && a.crecimiento > 0.4 && (
                <mesh position={[0, 0.01, 0]}>
                  <sphereGeometry args={[0.02 + 0.04 * a.crecimiento, 8, 6]} />
                  <meshStandardMaterial color="#d6336c" roughness={0.6} />
                </mesh>
              )}
              {cultivo === 'chile' && !a.muerta && a.crecimiento > 0.75 &&
                [-1, 1].map((l) => (
                  <mesh key={l} position={[l * 0.06 * g, 0.16 * g, 0.04]} rotation={[0, 0, l * 0.4]}>
                    <coneGeometry args={[0.014, 0.07, 6]} />
                    <meshStandardMaterial color={a.crecimiento >= 1 ? '#d62828' : '#5a9e2f'} roughness={0.5} />
                  </mesh>
                ))}
            </group>
          )
        })}
    </group>
  )
}

/** La cámara de cultivo por dentro: las seis almohadillas y la luz de los LED. */
function Cultivo({ sala }: { sala: RoomState }) {
  const h = sala.huerto
  const encendida = sala.sistemas.some((s) => s.id === 'huerto' && s.operativo) && h.progreso >= 60
  // Rojo, azul y verde dan rosa; solo rojo y azul, violeta; las de cabina, blanco tenue.
  const luz = h.luz === undefined || h.luz >= 1 ? '#ff6ad5' : h.luz >= 0.9 ? '#b43cff' : '#fff4e2'
  const colocadas = h.establecido || h.progreso >= 80
  const posiciones = [-0.36, 0, 0.36].flatMap((x) => [0.6, 1.2].map((y) => [x, y] as const))
  return (
    <>
      <pointLight position={[0, 1.6, 0.4]} color={luz} intensity={encendida ? (h.luz !== undefined && h.luz < 0.9 ? 1.2 : 2.5) : 0} distance={2.5} decay={2} />
      {/* fuelle transparente: aparece al desplegar la cámara */}
      {h.progreso >= 40 && (
        <mesh position={[0, 1.15, 0.3]} material={MAT.cristal}>
          <boxGeometry args={[1.1, 1.35, 0.24]} />
        </mesh>
      )}
      {colocadas &&
        posiciones.map(([x, y], i) => (
          <Planta key={i} a={h.establecido ? (h.almohadillas?.[i] ?? null) : null} cultivo={h.cultivo ?? 'lechuga'} x={x} y={y} />
        ))}
    </>
  )
}

function Estaciones({ sala, cerca, destacadas, micro }: { sala: RoomState; cerca: string | null; destacadas: string[]; micro: boolean }) {
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
          <mesh key={x} position={[x, 0.95, 0.06]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 1.45, 18]} />
            <meshStandardMaterial color={['#e6ebf1', '#a9d6f5', '#f2c6a0'][i]} metalness={0.45} roughness={0.35} />
          </mesh>
        ))}
        {/* tuberías */}
        {[1.75, 1.85].map((y, i) => (
          <mesh key={y} position={[0.4, y, 0.04]} rotation={[0, 0, Math.PI / 2]} material={i ? MAT.cableNaranja : MAT.metal}>
            <cylinderGeometry args={[0.025, 0.025, 1.6, 8]} />
          </mesh>
        ))}
        <Pantalla x={-0.6} y={0.75} alto={0.3} color={tono(!sis('cdra').operativo || !sis('oga').operativo, !sis('wrs').operativo)} intensidad={0.6} />
      </Puesto>

      <Puesto id="energia" color="#f5b942" {...comun}>
        <Pantalla x={-0.55} color={tono(bateria < 0.15, bateria < 0.4)} />
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[0.25 + (i % 3) * 0.32, 1.0 + Math.floor(i / 3) * 0.62, 0.02]}>
            <boxGeometry args={[0.24, 0.5, 0.06]} />
            <meshStandardMaterial color="#111827" emissive={bateria * 6 > i ? '#3ddc97' : '#1f2937'} emissiveIntensity={bateria * 6 > i ? 0.9 : 0.1} />
          </mesh>
        ))}
        {/* cuadro de interruptores */}
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={`i${i}`} position={[-0.85 + (i % 4) * 0.12, 0.55 + Math.floor(i / 4) * 0.12, 0.03]} material={i % 3 ? MAT.panelGris : MAT.cableNaranja}>
            <boxGeometry args={[0.07, 0.07, 0.04]} />
          </mesh>
        ))}
      </Puesto>

      <Puesto id="almacen" color="#66bb6a" {...comun}>
        {/* bolsas de carga apiladas y sujetas con cinchas */}
        {Array.from({ length: 9 }, (_, i) => (
          <Bolsa key={i} p={[-0.8 + (i % 3) * 0.55, 0.3 + Math.floor(i / 3) * 0.6, 0.12]} />
        ))}
        {[0.9, 1.5].map((y) => (
          <mesh key={y} position={[-0.25, y, 0.33]} material={MAT.cable}>
            <boxGeometry args={[1.7, 0.04, 0.01]} />
          </mesh>
        ))}
        <Portatil x={0.75} y={1.25} />
        <Bolsa p={[0.75, 0.3, 0.45]} t={[0.55, 0.5, 0.55]} />
      </Puesto>

      <Puesto id="laboratorio" color="#ab47bc" {...comun}>
        <Pantalla x={-0.75} y={1.55} ancho={0.6} alto={0.4} color="#c084fc" />
        {/* guantera de experimentos */}
        <mesh position={[-0.75, 0.85, 0.1]} material={MAT.cristal}>
          <boxGeometry args={[0.8, 0.55, 0.45]} />
        </mesh>
        {[-0.95, -0.55].map((x) => (
          <mesh key={x} position={[x, 0.85, 0.33]} rotation={[Math.PI / 2, 0, 0]} material={MAT.oscuro}>
            <torusGeometry args={[0.08, 0.015, 6, 16]} />
          </mesh>
        ))}
        {/* cámara de cultivo: los LED rojos y azules dan luz rosada */}
        <group position={[0.5, 0, 0.1]}>
          <mesh position={[0, 1.2, -0.02]}>
            <boxGeometry args={[1.2, 1.5, 0.45]} />
            <meshStandardMaterial color="#2b2030" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.93, 0.05]}>
            <boxGeometry args={[1.05, 0.04, 0.3]} />
            <meshBasicMaterial color="#ff7ad9" />
          </mesh>
          <Cultivo sala={sala} />
        </group>
      </Puesto>

      <Puesto id="enfermeria" color="#ef5350" {...comun}>
        <Pantalla x={0.65} color="#fb7185" />
        {/* camilla con sujeciones */}
        <RoundedBox args={[1.5, 0.16, 0.72]} radius={0.05} smoothness={2} position={[-0.35, 0.62, 0.55]} castShadow>
          <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
        </RoundedBox>
        <mesh position={[-0.35, 0.3, 0.55]} material={MAT.panelGris}>
          <boxGeometry args={[1.2, 0.5, 0.55]} />
        </mesh>
        {[-0.75, 0.05].map((x) => (
          <mesh key={x} position={[x, 0.71, 0.55]} material={MAT.cableNaranja}>
            <boxGeometry args={[0.06, 0.02, 0.74]} />
          </mesh>
        ))}
        {/* botiquín con la cruz */}
        <mesh position={[0.65, 0.75, 0.04]}>
          <boxGeometry args={[0.5, 0.4, 0.08]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.6} />
        </mesh>
        <mesh position={[0.65, 0.75, 0.085]}>
          <boxGeometry args={[0.24, 0.07, 0.01]} />
          <meshBasicMaterial color="#e11d48" />
        </mesh>
        <mesh position={[0.65, 0.75, 0.085]}>
          <boxGeometry args={[0.07, 0.24, 0.01]} />
          <meshBasicMaterial color="#e11d48" />
        </mesh>
      </Puesto>

      <Puesto id="ejercicio" color="#ffa726" {...comun}>
        <Pantalla x={0.6} y={1.6} ancho={0.6} alto={0.38} color="#fbbf24" />
        {/* barra de sentadillas con resistencia por vacío, como la de la Estación Espacial */}
        <mesh position={[-0.6, 1.3, 0.1]} rotation={[0, 0, Math.PI / 2]} material={MAT.metal}>
          <cylinderGeometry args={[0.03, 0.03, 1.1, 10]} />
        </mesh>
        {[-1.05, -0.15].map((x) => (
          <mesh key={x} position={[x, 0.8, 0.1]} material={MAT.metal}>
            <cylinderGeometry args={[0.05, 0.05, 1.0, 10]} />
          </mesh>
        ))}
      </Puesto>

      <Puesto id="literas" color="#7c8cf8" {...comun}>
        <Pantalla x={-0.95} y={2.0} ancho={0.4} alto={0.22} color="#a5b4fc" intensidad={0.4} />
      </Puesto>

      <Puesto id="refugio" color="#38bdf8" {...comun}>
        {/* paredes de agua del refugio: una capa visible por cada capa de blindaje */}
        {Array.from({ length: 1 + sala.blindaje }, (_, i) => (
          <mesh key={i} position={[0, 1.1, 0.1 + i * 0.14]}>
            <boxGeometry args={[2.3 - i * 0.08, 2.0, 0.1]} />
            <meshStandardMaterial color="#1d4ed8" transparent opacity={0.32} roughness={0.15} metalness={0.2} />
          </mesh>
        ))}
        <Pantalla x={0} y={1.75} ancho={0.7} alto={0.3} color={tono(Boolean(sala.ambiente.tormentaSolar), false)} />
      </Puesto>

      <Gimnasio micro={micro} />
      <Dormitorio micro={micro} />
      <Mesa cerca={cerca} destacadas={destacadas} />
    </>
  )
}

/** Cinta de correr y bicicleta estática, frente al bastidor del gimnasio. */
function Gimnasio({ micro }: { micro: boolean }) {
  const { cinta, bici } = PUNTOS
  return (
    <group>
      {/* cinta: base, banda, barandillas y consola */}
      <group position={[cinta.x, 0, cinta.z]} rotation={[0, cinta.giro + Math.PI / 2, 0]}>
        <RoundedBox args={[0.7, 0.14, 1.7]} radius={0.04} smoothness={2} position={[0, 0.07, 0]} castShadow>
          <meshStandardMaterial color="#3b4048" roughness={0.6} metalness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0.145, 0]} material={MAT.cinta}>
          <boxGeometry args={[0.52, 0.01, 1.55]} />
        </mesh>
        {[-0.33, 0.33].map((x) => (
          <mesh key={x} position={[x, 0.55, -0.55]} material={MAT.metal}>
            <cylinderGeometry args={[0.02, 0.02, 0.85, 8]} />
          </mesh>
        ))}
        <mesh position={[0, 0.98, -0.7]} rotation={[-0.5, 0, 0]} material={MAT.oscuro}>
          <boxGeometry args={[0.55, 0.3, 0.05]} />
        </mesh>
        {/* sin gravedad hay que sujetarse a la cinta con un arnés y cuerdas elásticas */}
        {micro &&
          [-0.25, 0.25].map((x) => (
            <mesh key={x} position={[x, 0.75, 0.1]} rotation={[0.25, 0, 0]} material={MAT.cableNaranja}>
              <cylinderGeometry args={[0.008, 0.008, 1.2, 4]} />
            </mesh>
          ))}
      </group>
      {/* bicicleta: cuadro, sillín (en Marte), manillar y pedales */}
      <group position={[bici.x, 0, bici.z]} rotation={[0, bici.giro + Math.PI / 2, 0]}>
        <mesh position={[0, 0.06, 0]} material={MAT.oscuro}>
          <boxGeometry args={[0.45, 0.12, 0.9]} />
        </mesh>
        <mesh position={[0, 0.42, -0.05]} rotation={[0.35, 0, 0]} material={MAT.metal}>
          <cylinderGeometry args={[0.035, 0.035, 0.75, 8]} />
        </mesh>
        <mesh position={[0, 0.3, -0.25]} rotation={[0, 0, Math.PI / 2]} material={MAT.oscuro}>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 20]} />
        </mesh>
        {!micro && (
          <mesh position={[0, 0.66, 0.28]} material={MAT.oscuro}>
            <boxGeometry args={[0.2, 0.05, 0.3]} />
          </mesh>
        )}
        <mesh position={[0, 0.98, -0.42]} rotation={[0, 0, Math.PI / 2]} material={MAT.metal}>
          <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
        </mesh>
      </group>
    </group>
  )
}

/** Sin gravedad se duerme en sacos sujetos a la pared; en Marte, en literas. */
function Dormitorio({ micro }: { micro: boolean }) {
  if (micro) {
    return (
      <group>
        {PUNTOS.sacos.map((s, i) => (
          <group key={i} position={[s.x, 0, 2.62]}>
            {/* el saco vacío cuelga de la pared */}
            <mesh position={[0, 1.15, 0]} scale={[0.23, 0.55, 0.12]} material={MAT.saco}>
              <capsuleGeometry args={[1, 1, 6, 12]} />
            </mesh>
            <mesh position={[0.08, 1.15, 0.11]} material={MAT.sacoCierre}>
              <boxGeometry args={[0.02, 1.2, 0.01]} />
            </mesh>
            <mesh position={[0, 2.05, 0.02]} rotation={[0, 0, Math.PI / 2]} material={MAT.pasamanos}>
              <cylinderGeometry args={[0.018, 0.018, 0.4, 8]} />
            </mesh>
            {/* luz de lectura */}
            <mesh position={[0, 2.25, 0.02]}>
              <boxGeometry args={[0.12, 0.04, 0.03]} />
              <meshBasicMaterial color="#ffe9b8" />
            </mesh>
          </group>
        ))}
      </group>
    )
  }
  return (
    <group>
      {PUNTOS.literas.map((l, i) => (
        <group key={i} position={[l.x, l.y, 2.35]}>
          <RoundedBox args={[0.85, 0.14, 1.75]} radius={0.04} smoothness={2} position={[0, 0, 0.05]} castShadow>
            <meshStandardMaterial color="#d8dee6" roughness={0.95} />
          </RoundedBox>
          <mesh position={[0, -0.09, 0.05]} material={MAT.panelGris}>
            <boxGeometry args={[0.9, 0.05, 1.8]} />
          </mesh>
          <mesh position={[0, 0.1, 0.72]} material={MAT.saco}>
            <boxGeometry args={[0.45, 0.08, 0.25]} />
          </mesh>
        </group>
      ))}
      {[0.12, 1.08, 2.12, 3.1].map((x) => (
        <mesh key={x} position={[x, 0.95, 2.35]} material={MAT.metal}>
          <boxGeometry args={[0.05, 1.9, 0.05]} />
        </mesh>
      ))}
    </group>
  )
}

/** Mesa común: donde la tripulación come y conversa. */
function Mesa({ cerca, destacadas }: { cerca: string | null; destacadas: string[] }) {
  const e = ESTACION_BY_ID.comedor
  return (
    <group position={[e.x, 0, e.z]}>
      <mesh position={[0, 0.96, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.05, 36]} />
        <meshStandardMaterial color="#cfd5dc" roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.48, 0]} material={MAT.metal}>
        <cylinderGeometry args={[0.07, 0.12, 0.95, 12]} />
      </mesh>
      {/* bolsas de comida y bebida sujetas con velcro */}
      {[
        [0.22, 0.12, '#f59e0b'],
        [-0.2, 0.2, '#ef4444'],
        [0.05, -0.28, '#22c55e'],
        [-0.3, -0.12, '#3b82f6'],
      ].map(([x, z, col], i) => (
        <mesh key={i} position={[x as number, 1.02, z as number]} rotation={[0, i, 0]}>
          <boxGeometry args={[0.12, 0.05, 0.16]} />
          <meshStandardMaterial color={col as string} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0.32, 1.05, -0.3]}>
        <cylinderGeometry args={[0.035, 0.035, 0.12, 10]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
      </mesh>
      <Marca activo={cerca === 'comedor'} destacado={destacadas.includes('comedor')} radio={1.05} />
      <Rotulo texto={e.nombre} y={1.6} activo={cerca === 'comedor'} destacado={destacadas.includes('comedor')} />
    </group>
  )
}

/** Puente de mando: consola frente al ventanal. */
function Puente({ cerca, destacadas }: { cerca: string | null; destacadas: string[] }) {
  const e = ESTACION_BY_ID.puente
  return (
    <group position={[e.x, 0, e.z]}>
      <RoundedBox args={[0.9, 1.0, 2.6]} radius={0.05} smoothness={2} position={[0, 0.5, 0]} castShadow>
        <meshStandardMaterial color="#8793a5" metalness={0.35} roughness={0.5} />
      </RoundedBox>
      {[-0.8, 0, 0.8].map((z, i) => (
        <mesh key={z} position={[0.12, 1.08, z]} rotation={[0, Math.PI / 2, 0.35]}>
          <planeGeometry args={[0.7, 0.42]} />
          <meshStandardMaterial color="#071019" emissive={['#38bdf8', '#3ddc97', '#f5b942'][i]} emissiveIntensity={0.8} />
        </mesh>
      ))}
      {[-0.9, 0.9].map((z) => (
        <group key={z} position={[1.35, 0, z]}>
          <mesh position={[0, 0.45, 0]} castShadow material={MAT.oscuro}>
            <boxGeometry args={[0.55, 0.12, 0.55]} />
          </mesh>
          <mesh position={[0.25, 0.9, 0]} material={MAT.oscuro}>
            <boxGeometry args={[0.1, 0.9, 0.55]} />
          </mesh>
          <mesh position={[0, 0.22, 0]} material={MAT.metal}>
            <cylinderGeometry args={[0.06, 0.2, 0.44, 10]} />
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
      {/* escotilla cuadrada de esquinas redondeadas, como las de la Estación Espacial */}
      <RoundedBox args={[0.25, 1.6, 1.6]} radius={0.18} smoothness={3} position={[0.45, 1.25, 0]}>
        <meshStandardMaterial color="#9aa3ae" metalness={0.55} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0.31, 1.25, 0]} rotation={[0, Math.PI / 2, 0]} material={MAT.metal}>
        <torusGeometry args={[0.18, 0.03, 8, 20]} />
      </mesh>
      <mesh position={[0.31, 2.2, 0]}>
        <boxGeometry args={[0.04, 0.12, 0.5]} />
        <meshStandardMaterial color="#0b1220" emissive={color} emissiveIntensity={1} />
      </mesh>
      <group position={[-0.9, 0, 0]}>
        <Marca activo={cerca === 'esclusa'} destacado={destacadas.includes('esclusa')} radio={0.7} />
      </group>
      <Rotulo texto={enMarte ? 'Airlock · exit to the outside' : 'Airlock'} activo={cerca === 'esclusa'} destacado={destacadas.includes('esclusa')} />
    </group>
  )
}

/** Suelo, paredes, chaflanes y techo, con anillos de estructura, pasamanos, cables y luces. */
function Casco() {
  const tramos = useMemo(() => {
    // Huecos de pared entre estaciones, que se cubren con bastidores genéricos.
    const ocupados = [-4.6, -1.5, 1.6, 4.7]
    const lista: number[] = []
    for (let x = INTERIOR.x0 + 0.9; x < INTERIOR.x1 - 0.6; x += 0.62) if (!ocupados.some((o) => Math.abs(o - x) < 1.6)) lista.push(x)
    return lista
  }, [])
  return (
    <group>
      {/* suelo con juntas */}
      <mesh position={[0, -0.05, 0]} receiveShadow material={MAT.suelo}>
        <boxGeometry args={[L, 0.1, A]} />
      </mesh>
      {Array.from({ length: 15 }, (_, i) => (
        <mesh key={i} position={[INTERIOR.x0 + 1.2 * (i + 0.5), 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.sueloRaya}>
          <planeGeometry args={[0.03, A]} />
        </mesh>
      ))}
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L - 1.2, 0.12]} />
        <meshBasicMaterial color="#f5b942" transparent opacity={0.35} />
      </mesh>
      {/* paredes laterales */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, HP / 2, s * (A / 2 + 0.05)]} material={MAT.panelClaro} receiveShadow>
          <boxGeometry args={[L, HP, 0.1]} />
        </mesh>
      ))}
      {/* bastidores genéricos en los huecos */}
      {[-1, 1].map((s) =>
        tramos.map((x) => (
          <group key={`${s}${x}`} position={[x, 0, s * (A / 2 - 0.12)]}>
            <mesh position={[0, 1.15, 0]} material={MAT.panel}>
              <boxGeometry args={[0.58, 2.2, 0.16]} />
            </mesh>
            <mesh position={[0, 1.6, -s * 0.085]} material={MAT.panelGris}>
              <boxGeometry args={[0.4, 0.3, 0.02]} />
            </mesh>
          </group>
        )),
      )}
      {/* chaflanes entre pared y techo, con tiras de luz LED */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[0, HP + 0.27, s * (A / 2 - 0.3)]} rotation={[s * Math.PI * 0.25, 0, 0]} material={MAT.panelClaro}>
            <boxGeometry args={[L, 0.1, 0.85]} />
          </mesh>
          <mesh position={[0, HP + 0.24, s * (A / 2 - 0.36)]} rotation={[s * Math.PI * 0.25, 0, 0]} material={MAT.led}>
            <boxGeometry args={[L - 1, 0.12, 0.08]} />
          </mesh>
          {/* bandeja de cables */}
          <mesh position={[0, HP - 0.06, s * (A / 2 - 0.08)]} rotation={[0, 0, Math.PI / 2]} material={MAT.cable}>
            <cylinderGeometry args={[0.04, 0.04, L, 8]} />
          </mesh>
          <mesh position={[0, HP - 0.15, s * (A / 2 - 0.06)]} rotation={[0, 0, Math.PI / 2]} material={MAT.cableNaranja}>
            <cylinderGeometry args={[0.018, 0.018, L, 6]} />
          </mesh>
          {/* pasamanos a lo largo de la pared */}
          <mesh position={[0, 1.02, s * (A / 2 - 0.42)]} rotation={[0, 0, Math.PI / 2]} material={MAT.pasamanos}>
            <cylinderGeometry args={[0.02, 0.02, L - 2, 8]} />
          </mesh>
        </group>
      ))}
      {/* techo con paneles de luz */}
      <mesh position={[0, H + 0.05, 0]} material={MAT.panelClaro}>
        <boxGeometry args={[L, 0.1, A - 1.1]} />
      </mesh>
      {[-6, -2, 2, 6].map((x) => (
        <mesh key={x} position={[x, H - 0.01, 0]} material={MAT.led}>
          <boxGeometry args={[2.0, 0.03, 0.6]} />
        </mesh>
      ))}
      {/* anillos de estructura que dividen el módulo */}
      {[-3.05, 3.15].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, HP / 2, s * (A / 2 - 0.05)]} material={MAT.junta}>
              <boxGeometry args={[0.16, HP, 0.2]} />
            </mesh>
          ))}
          <mesh position={[0, H - 0.04, 0]} material={MAT.junta}>
            <boxGeometry args={[0.16, 0.14, A - 0.9]} />
          </mesh>
        </group>
      ))}
      {/* pared trasera (esclusa) */}
      <mesh position={[L / 2 + 0.05, H / 2, 0]} material={MAT.panelClaro}>
        <boxGeometry args={[0.1, H, A]} />
      </mesh>
      {/* pared delantera con el ventanal de 5 × 1.9 m */}
      <mesh position={[-L / 2 - 0.05, 0.4, 0]} material={MAT.panelClaro}>
        <boxGeometry args={[0.1, 0.8, A]} />
      </mesh>
      <mesh position={[-L / 2 - 0.05, 2.85, 0]} material={MAT.panelClaro}>
        <boxGeometry args={[0.1, 0.3, A]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-L / 2 - 0.05, 1.75, s * 2.85]} material={MAT.panelClaro}>
          <boxGeometry args={[0.1, 1.9, 0.7]} />
        </mesh>
      ))}
      {/* marco del ventanal y el cristal */}
      <mesh position={[-L / 2 + 0.01, 1.75, 0]} rotation={[0, Math.PI / 2, 0]} material={MAT.junta}>
        <torusGeometry args={[0.001, 0.001, 2, 4]} />
      </mesh>
      {[0.8, 2.7].map((y) => (
        <mesh key={y} position={[-L / 2 + 0.02, y, 0]} material={MAT.junta}>
          <boxGeometry args={[0.08, 0.08, 5.1]} />
        </mesh>
      ))}
      {[-2.5, 2.5].map((z) => (
        <mesh key={z} position={[-L / 2 + 0.02, 1.75, z]} material={MAT.junta}>
          <boxGeometry args={[0.08, 1.98, 0.08]} />
        </mesh>
      ))}
      <mesh position={[-L / 2 - 0.02, 1.75, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[5, 1.9]} />
        <meshStandardMaterial color="#9fd8ff" transparent opacity={0.05} roughness={0.02} metalness={0.5} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Objetos sueltos que flotan sin gravedad: una lista de tareas, un bolígrafo, una bolsa y una gota de agua. */
function ObjetosFlotantes() {
  const objetos = useMemo(
    () =>
      [
        { tipo: 'hoja', p: new THREE.Vector3(-3.4, 1.9, 0.8), v: new THREE.Vector3(0.07, 0.02, -0.04), giro: new THREE.Vector3(0.3, 0.5, 0.2) },
        { tipo: 'boli', p: new THREE.Vector3(2.4, 1.6, -0.9), v: new THREE.Vector3(-0.05, -0.015, 0.03), giro: new THREE.Vector3(0.8, 0.2, 0.6) },
        { tipo: 'bolsa', p: new THREE.Vector3(5.6, 2.1, 0.4), v: new THREE.Vector3(-0.03, 0.01, 0.02), giro: new THREE.Vector3(0.1, 0.25, 0.15) },
        { tipo: 'gota', p: new THREE.Vector3(-1.0, 1.75, -0.3), v: new THREE.Vector3(0.04, 0.012, 0.025), giro: new THREE.Vector3(0, 0, 0) },
      ] as const,
    [],
  )
  const refs = useRef<(THREE.Object3D | null)[]>([])
  useFrame(({ clock }, dtBruto) => {
    const dt = Math.min(0.05, dtBruto)
    objetos.forEach((o, i) => {
      const obj = refs.current[i]
      if (!obj) return
      o.p.addScaledVector(o.v, dt)
      // Rebotan suavemente en las paredes del pasillo.
      if (o.p.x < INTERIOR.pasilloX0 || o.p.x > INTERIOR.pasilloX1) o.v.x *= -1
      if (Math.abs(o.p.z) > 1.8) o.v.z *= -1
      if (o.p.y < 1.1 || o.p.y > 2.5) o.v.y *= -1
      obj.position.copy(o.p)
      obj.rotation.x += o.giro.x * dt
      obj.rotation.y += o.giro.y * dt
      obj.rotation.z += o.giro.z * dt
      // La gota de agua tiembla: la tensión superficial la mantiene redonda.
      if (o.tipo === 'gota') obj.scale.set(1 + Math.sin(clock.elapsedTime * 7) * 0.08, 1 - Math.sin(clock.elapsedTime * 7) * 0.08, 1)
    })
  })
  return (
    <group>
      {objetos.map((o, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          {o.tipo === 'hoja' && (
            <mesh>
              <boxGeometry args={[0.21, 0.003, 0.29]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.9} />
            </mesh>
          )}
          {o.tipo === 'boli' && (
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.006, 0.006, 0.14, 6]} />
              <meshStandardMaterial color="#1d4ed8" roughness={0.4} />
            </mesh>
          )}
          {o.tipo === 'bolsa' && (
            <mesh>
              <boxGeometry args={[0.14, 0.04, 0.2]} />
              <meshStandardMaterial color="#f59e0b" roughness={0.7} />
            </mesh>
          )}
          {o.tipo === 'gota' && (
            <mesh>
              <sphereGeometry args={[0.035, 16, 12]} />
              <meshStandardMaterial color="#bfe6ff" roughness={0.02} metalness={0.1} transparent opacity={0.65} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

export function Interior({ sala, cerca, destacadas }: { sala: RoomState; cerca: string | null; destacadas: string[] }) {
  const alerta = sala.emergencias.some((e) => e.estado === 'activa')
  const luzAlerta = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    if (luzAlerta.current) luzAlerta.current.intensity = alerta ? 6 + Math.sin(clock.elapsedTime * 6) * 5 : 0
  })
  const micro = enMicrogravedad(sala)
  const enMarte = sala.tAterrizaje > 0
  const hora = sala.ambiente.hora
  // Ciclo de luz: de noche las luces bajan, como en la Estación Espacial, para dormir mejor.
  const noche = hora >= 22 || hora < 6
  // Sin energía, la base queda a oscuras con luz de emergencia.
  const apagon = sala.energia.cortes.length >= 4
  const luz = apagon ? 0.12 : noche ? 0.45 : 1
  return (
    <group>
      <color attach="background" args={['#02040a']} />
      <ambientLight intensity={0.22 * luz + 0.05} />
      <hemisphereLight args={['#eef4ff', '#3a3f48', 0.75 * luz]} />
      {[-6, -2, 2, 6].map((x) => (
        <pointLight key={x} position={[x, 2.6, 0]} intensity={7 * luz} distance={9} decay={2} color={apagon ? '#ff6b6b' : noche ? '#ffd6a8' : '#fff6ea'} />
      ))}
      <pointLight ref={luzAlerta} position={[0, 2.5, 0]} color="#ff3b30" distance={22} intensity={0} />
      {/* luz que entra por el ventanal */}
      <directionalLight position={[-30, 12, 6]} intensity={enMarte ? (noche ? 0.05 : 0.8) : 0.55} color={enMarte ? '#ffd9b8' : '#ffffff'} />
      <Casco />
      <Ventana sala={sala} />
      <Puente cerca={cerca} destacadas={destacadas} />
      <Estaciones sala={sala} cerca={cerca} destacadas={destacadas} micro={micro} />
      <Esclusa sala={sala} cerca={cerca} destacadas={destacadas} />
      {micro && <ObjetosFlotantes />}
    </group>
  )
}
