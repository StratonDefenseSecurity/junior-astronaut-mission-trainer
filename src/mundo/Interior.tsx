// Interior del hábitat: es la nave durante el viaje y la base una vez en Marte.
//
// Se inspira en los módulos de la Estación Espacial: paredes cubiertas de bastidores de equipos,
// pasamanos para moverse sin gravedad, cables, bolsas de carga blancas, luces LED y anillos de
// estructura. Cada espacio tiene su equipo: cinta de correr y bicicleta en el gimnasio, sacos
// de dormir sujetos a la pared (en Marte, literas), cámara de cultivo con luz rosada de LED
// rojos y azules, camilla en la enfermería y una mesa común en el centro para comer y conversar.
// Sin gravedad, algunos objetos sueltos flotan por el módulo.
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Almohadilla, CultivoId, RoomState } from '@shared/types'
import { useGraficos } from '../graficos'
import { ESTACION_BY_ID, ESTACIONES, INTERIOR, PUNTOS } from './mapa'
import { azar, texturaBastidor, texturaCTB, texturaDesgaste, texturaFranjas, texturaLuz, texturaPortatil, texturaRejilla, texturaRotulo } from './procedural'
import { Ventana } from './Ventana'

const L = INTERIOR.x1 - INTERIOR.x0
/** Estaciones de los deberes de rutina, con bastidores más estrechos. */
const ESTRECHOS = ['comms', 'ciencia', 'estiba']
const ANCHO_ESTRECHO = 1.3
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

/** Portátil sobre su brazo articulado, anclado al bastidor, como los de la Estación Espacial. */
function Portatil({ x, y, z = 0.05, giro = 0 }: { x: number; y: number; z?: number; giro?: number }) {
  const pantalla = useMemo(() => new THREE.MeshBasicMaterial({ map: texturaPortatil(Math.round(x * 10 + y * 7)) }), [x, y])
  return (
    <group position={[x, y, z]} rotation={[0, giro, 0]}>
      <mesh material={MAT.oscuro} position={[0, 0, 0.1]}>
        <boxGeometry args={[0.36, 0.02, 0.24]} />
      </mesh>
      <mesh position={[0, 0.12, -0.01]} rotation={[-0.25, 0, 0]} material={MAT.oscuro}>
        <boxGeometry args={[0.36, 0.24, 0.015]} />
      </mesh>
      <mesh position={[0, 0.12, 0.0]} rotation={[-0.25, 0, 0]} material={pantalla}>
        <planeGeometry args={[0.32, 0.2]} />
      </mesh>
      {/* brazo: placa en el bastidor, dos tramos y la rótula bajo el teclado */}
      <mesh position={[0, -0.12, -0.07]} material={MAT.junta}>
        <boxGeometry args={[0.09, 0.12, 0.02]} />
      </mesh>
      <mesh position={[0, -0.12, 0.02]} rotation={[Math.PI / 2, 0, 0]} material={MAT.metal}>
        <cylinderGeometry args={[0.014, 0.014, 0.18, 8]} />
      </mesh>
      <mesh position={[0, -0.12, 0.11]} material={MAT.metal}>
        <sphereGeometry args={[0.022, 10, 8]} />
      </mesh>
      <mesh position={[0, -0.06, 0.11]} material={MAT.metal}>
        <cylinderGeometry args={[0.012, 0.012, 0.11, 8]} />
      </mesh>
    </group>
  )
}

/** Material de cada variante de bolsa de carga (CTB). */
const CTB_MAT = new Map<number, THREE.MeshStandardMaterial>()
function materialCTB(n: number) {
  const k = n % 6
  let m = CTB_MAT.get(k)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: texturaCTB(k), roughness: 0.95 })
    CTB_MAT.set(k, m)
  }
  return m
}
const CAJA = new THREE.BoxGeometry(1, 1, 1)

/** Bolsa blanca de transporte de carga (CTB) con sus cintas de velcro y la tarjeta de inventario. */
function Bolsa({ p, t = [0.5, 0.32, 0.4] }: { p: [number, number, number]; t?: [number, number, number] }) {
  const n = Math.abs(Math.round(p[0] * 13 + p[1] * 7 + p[2] * 3))
  return <mesh geometry={CAJA} position={p} scale={t} material={materialCTB(n)} />
}

interface PuestoProps {
  id: string
  cerca: string | null
  destacadas: string[]
  color: string
  /** Ancho del bastidor, en metros (los de los deberes son más estrechos). */
  ancho?: number
  children?: ReactNode
}

/** Bastidor de equipos contra la pared, con su rótulo y su marca en el suelo. */
function Puesto({ id, cerca, destacadas, color, ancho = 2.5, children }: PuestoProps) {
  const e = ESTACION_BY_ID[id]
  const lado = Math.sign(e.z) // -1 pared norte, +1 pared sur
  const alta = useGraficos((s) => s.calidad) === 'alta'
  // Frente con cajones, placas y código de ubicación al estilo de la Estación Espacial.
  const frente = useMemo(() => {
    const codigo = `HAB1${lado < 0 ? 'P' : 'S'}${Math.round((e.x - INTERIOR.x0) / 2.3)}`
    return new THREE.MeshStandardMaterial({ map: texturaBastidor(codigo, ancho, 2.24, e.x * 3 + lado, alta), roughness: 0.72, metalness: 0.05 })
  }, [e.x, lado, ancho, alta])
  return (
    <group position={[e.x, 0, e.z]}>
      <group rotation={[0, lado > 0 ? Math.PI : 0, 0]}>
        {/* bastidor con tapa frontal y juntas */}
        <RoundedBox args={[ancho, 2.3, 0.5]} radius={0.04} smoothness={2} position={[0, 1.15, -0.28]} castShadow receiveShadow>
          <meshStandardMaterial color="#d3d0c6" roughness={0.75} metalness={0.05} />
        </RoundedBox>
        <mesh position={[0, 1.15, -0.026]} material={frente} receiveShadow>
          <planeGeometry args={[ancho - 0.05, 2.24]} />
        </mesh>
        {[-ancho / 2 + 0.01, ancho / 2 - 0.01].map((x) => (
          <mesh key={x} position={[x, 1.15, 0.0]} material={MAT.junta}>
            <boxGeometry args={[0.04, 2.3, 0.04]} />
          </mesh>
        ))}
        {/* franja de color de la estación, iluminada */}
        <mesh position={[0, 2.38, -0.2]}>
          <boxGeometry args={[ancho, 0.12, 0.56]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
        </mesh>
        {/* pasamanos sobre el bastidor */}
        <mesh position={[0, 2.1, 0.06]} rotation={[0, 0, Math.PI / 2]} material={MAT.pasamanos}>
          <cylinderGeometry args={[0.022, 0.022, ancho * 0.64, 8]} />
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

      <Puesto id="comms" color="#38bdf8" ancho={ANCHO_ESTRECHO} {...comun}>
        {/* consola de comunicaciones y navegación: dos pantallas, auriculares y el reloj de la señal */}
        <Pantalla x={0} y={1.62} ancho={0.95} alto={0.42} color="#38bdf8" />
        <Pantalla x={-0.25} y={1.08} ancho={0.42} alto={0.3} color="#3ddc97" intensidad={0.6} />
        <Pantalla x={0.3} y={1.08} ancho={0.36} alto={0.3} color="#f5b942" intensidad={0.6} />
        <mesh position={[0.38, 0.55, 0.1]} rotation={[0, 0, Math.PI / 2]} material={MAT.oscuro}>
          <torusGeometry args={[0.1, 0.022, 8, 18, Math.PI]} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[-0.42 + i * 0.1, 0.62, 0.04]} material={i % 2 ? MAT.panelGris : MAT.cableNaranja}>
            <boxGeometry args={[0.06, 0.06, 0.04]} />
          </mesh>
        ))}
        <Portatil x={-0.2} y={0.78} />
      </Puesto>

      <Puesto id="ciencia" color="#c084fc" ancho={ANCHO_ESTRECHO} {...comun}>
        {/* guantera sellada con sus dos puertos para los brazos y los dosímetros en su panel */}
        <mesh position={[0, 1.0, 0.12]} material={MAT.cristal}>
          <boxGeometry args={[1.0, 0.6, 0.5]} />
        </mesh>
        <mesh position={[0, 0.68, 0.12]} material={MAT.panelGris}>
          <boxGeometry args={[1.05, 0.06, 0.52]} />
        </mesh>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, 1.0, 0.38]} material={MAT.oscuro}>
            <torusGeometry args={[0.09, 0.018, 8, 18]} />
          </mesh>
        ))}
        <Pantalla x={0} y={1.75} ancho={0.8} alto={0.32} color="#c084fc" intensidad={0.7} />
        {Array.from({ length: 4 }, (_, i) => (
          <mesh key={`d${i}`} position={[-0.36 + i * 0.24, 0.42, 0.04]}>
            <boxGeometry args={[0.12, 0.16, 0.05]} />
            <meshStandardMaterial color="#facc15" roughness={0.5} />
          </mesh>
        ))}
      </Puesto>

      <Puesto id="estiba" color="#9ccc65" ancho={ANCHO_ESTRECHO} {...comun}>
        {/* bolsas de carga con su código de barras, sujetas con cinchas */}
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i}>
            <Bolsa p={[-0.3 + (i % 2) * 0.6, 0.32 + Math.floor(i / 2) * 0.62, 0.12]} t={[0.52, 0.52, 0.4]} />
            <mesh position={[-0.3 + (i % 2) * 0.6, 0.32 + Math.floor(i / 2) * 0.62, 0.325]}>
              <planeGeometry args={[0.2, 0.08]} />
              <meshBasicMaterial color="#111827" />
            </mesh>
          </group>
        ))}
        {[0.62, 1.24].map((y) => (
          <mesh key={y} position={[0, y, 0.34]} material={MAT.cable}>
            <boxGeometry args={[1.25, 0.035, 0.01]} />
          </mesh>
        ))}
        {/* lector de códigos de barras colgado de su cable */}
        <mesh position={[0.5, 2.0, 0.08]} material={MAT.oscuro}>
          <boxGeometry args={[0.08, 0.2, 0.06]} />
        </mesh>
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

/**
 * Detalle de la escotilla: marco, ventanilla redonda, palanca de cierre, pestillos, válvula de
 * igualar presión, rótulos de plantilla y franjas de aviso en el umbral.
 */
function HatchDetalle({ enMarte }: { enMarte: boolean }) {
  const alta = useGraficos((s) => s.calidad) === 'alta'
  const m = useMemo(() => {
    const franjas = texturaFranjas().clone()
    franjas.repeat.set(1, 8)
    franjas.needsUpdate = true
    return {
      rotulo: new THREE.MeshStandardMaterial({ map: texturaRotulo('AIRLOCK HATCH', '#f2f1ea', '#111'), roughness: 0.7 }),
      aviso: new THREE.MeshStandardMaterial({ map: texturaRotulo('CHECK ΔP BEFORE OPENING', '#f2c230', '#141414'), roughness: 0.7 }),
      franjas: new THREE.MeshStandardMaterial({ map: franjas, roughness: 0.8 }),
    }
  }, [])
  // Por la ventanilla se ve el exterior: el cielo de Marte o la oscuridad del espacio.
  const vista = enMarte ? '#c98a55' : '#05070c'
  return (
    <group>
      {/* marco grueso alrededor de la escotilla */}
      {[
        [0.47, 2.14, 0, 0.3, 0.14, 1.9],
        [0.47, 0.36, 0, 0.3, 0.14, 1.9],
        [0.47, 1.25, 0.88, 0.3, 1.9, 0.14],
        [0.47, 1.25, -0.88, 0.3, 1.9, 0.14],
      ].map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={i} position={[x, y, z]} material={MAT.panelGris}>
          <boxGeometry args={[sx, sy, sz]} />
        </mesh>
      ))}
      {/* ventanilla con su anillo */}
      <mesh position={[0.318, 1.7, 0]} rotation={[0, Math.PI / 2, 0]} material={MAT.junta}>
        <torusGeometry args={[0.115, 0.022, 8, 24]} />
      </mesh>
      <mesh position={[0.322, 1.7, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <circleGeometry args={[0.11, 24]} />
        <meshStandardMaterial color="#0a0f16" emissive={vista} emissiveIntensity={0.35} roughness={0.05} metalness={0.6} />
      </mesh>
      {/* palanca de cierre */}
      <mesh position={[0.27, 1.25, 0]} rotation={[0.5, 0, 0]} material={MAT.metal}>
        <boxGeometry args={[0.035, 0.06, 0.5]} />
      </mesh>
      <mesh position={[0.25, 1.25, 0.22]} rotation={[0.5, 0, 0]} material={MAT.oscuro}>
        <boxGeometry args={[0.05, 0.07, 0.1]} />
      </mesh>
      {/* válvula de igualar presión */}
      <mesh position={[0.3, 1.7, 0.3]} rotation={[0, 0, Math.PI / 2]} material={MAT.oscuro}>
        <cylinderGeometry args={[0.035, 0.035, 0.05, 12]} />
      </mesh>
      {/* pestillos del contorno */}
      {alta &&
        [
          [1.98, 0.5], [1.98, -0.5], [0.52, 0.5], [0.52, -0.5], [1.25, 0.72], [1.25, -0.72],
        ].map(([y, z], i) => (
          <mesh key={i} position={[0.31, y, z]} material={MAT.junta}>
            <boxGeometry args={[0.03, 0.06, 0.09]} />
          </mesh>
        ))}
      {/* rótulos */}
      <mesh position={[0.315, 0.62, 0]} rotation={[0, -Math.PI / 2, 0]} material={m.rotulo}>
        <planeGeometry args={[0.7, 0.13]} />
      </mesh>
      <mesh position={[0.315, 1.95, 0]} rotation={[0, -Math.PI / 2, 0]} material={m.aviso}>
        <planeGeometry args={[0.8, 0.12]} />
      </mesh>
      {/* franjas de aviso en el umbral */}
      <mesh position={[0.16, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.franjas}>
        <planeGeometry args={[0.3, 1.7]} />
      </mesh>
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
      <HatchDetalle enMarte={enMarte} />
      <group position={[-0.9, 0, 0]}>
        <Marca activo={cerca === 'esclusa'} destacado={destacadas.includes('esclusa')} radio={0.7} />
      </group>
      <Rotulo texto={enMarte ? 'Airlock · exit to the outside' : 'Airlock'} activo={cerca === 'esclusa'} destacado={destacadas.includes('esclusa')} />
    </group>
  )
}

// ---------- Detalle de la Estación Espacial (instanciado: pocas llamadas de dibujo) ----------

const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _s = new THREE.Vector3()
/** Matriz de una instancia: posición, giro (x, y, z) y escala. */
function matriz(x: number, y: number, z: number, giro: [number, number, number] = [0, 0, 0], escala: [number, number, number] = [1, 1, 1]) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(giro[0], giro[1], giro[2])), _s.set(escala[0], escala[1], escala[2]))
}

/** Muchas copias de la misma pieza en una sola llamada de dibujo. */
function Instancias({ geo, mat, m }: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[]; m: THREE.Matrix4[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    m.forEach((x, i) => im.setMatrixAt(i, x))
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [m])
  return <instancedMesh key={m.length} ref={ref} args={[geo, mat, m.length]} receiveShadow />
}

const GEO = {
  cilindro: new THREE.CylinderGeometry(1, 1, 1, 8),
  plano: new THREE.PlaneGeometry(1, 1),
  lazo: new THREE.TorusGeometry(0.09, 0.012, 4, 10, Math.PI),
}

const MAT_EXTRA = {
  cableBlanco: new THREE.MeshStandardMaterial({ color: '#e4e2da', roughness: 0.7 }),
  cableGris: new THREE.MeshStandardMaterial({ color: '#2f343b', roughness: 0.6 }),
  palanca: new THREE.MeshStandardMaterial({ color: '#d5d8dc', roughness: 0.3, metalness: 0.8 }),
  cincha: new THREE.MeshStandardMaterial({ color: '#3a4458', roughness: 0.9 }),
}

/** Cable que cuelga entre dos puntos, con su comba. */
function catenaria(a: THREE.Vector3, b: THREE.Vector3, comba: number, radio: number) {
  const medio = a.clone().lerp(b, 0.5)
  medio.y -= comba
  const p1 = a.clone().lerp(medio, 0.55).setY(a.y - comba * 0.7)
  const p2 = b.clone().lerp(medio, 0.55).setY(b.y - comba * 0.7)
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, p1, medio, p2, b]), 14, radio, 5, false)
}

type ColorCable = 'blanco' | 'gris' | 'naranja'
const COLORES_CABLE: ColorCable[] = ['blanco', 'gris', 'naranja']

/**
 * Bastidores genéricos de las paredes, con lo que rodea a los de la Estación Espacial:
 * paneles de interruptores, pasamanos verticales, bolsas de carga sujetas con cinchas y
 * mazos de cables que cuelgan de un bastidor a otro. Lo más fino, solo en calidad alta.
 */
function BastidoresGenericos({ tramos }: { tramos: Record<number, number[]> }) {
  const alta = useGraficos((s) => s.calidad) === 'alta'
  const datos = useMemo(() => {
    const variantes: THREE.Matrix4[][] = [[], [], []]
    const paneles: THREE.Matrix4[] = []
    const palancas: THREE.Matrix4[] = []
    const barras: THREE.Matrix4[] = []
    const soportes: THREE.Matrix4[] = []
    const bolsas: THREE.Matrix4[][] = [[], []]
    const cinchas: THREE.Matrix4[] = []
    const cables: Record<ColorCable, THREE.BufferGeometry[]> = { blanco: [], gris: [], naranja: [] }
    const r = azar(5)
    const fz = A / 2 - 0.2 // frente de los bastidores
    for (const s of [-1, 1]) {
      const giro: [number, number, number] = [0, s > 0 ? Math.PI : 0, 0]
      const xs = tramos[s]
      xs.forEach((x, i) => {
        variantes[(i + (s > 0 ? 1 : 0)) % 3].push(matriz(x, 1.15, s * (A / 2 - 0.12), giro, [0.58, 2.2, 0.16]))
        if (i % 2 === 0) {
          paneles.push(matriz(x, 1.62, s * (fz - 0.015), giro, [0.42, 0.13, 0.03]))
          for (let k = 0; k < 6; k++) palancas.push(matriz(x - 0.16 + k * 0.064, 1.63, s * (fz - 0.04), [s * (Math.PI / 2 + (k % 3 === 1 ? -0.4 : 0.4)), 0, 0], [0.005, 0.035, 0.005]))
        } else {
          barras.push(matriz(x + 0.2, 1.3, s * (fz - 0.07), [0, 0, 0], [0.017, 0.56, 0.017]))
          for (const y of [1.06, 1.54]) soportes.push(matriz(x + 0.2, y, s * (fz - 0.035), giro, [0.03, 0.03, 0.07]))
        }
        if (i % 3 === 1) {
          bolsas[0].push(matriz(x, 0.16, s * (fz - 0.18), giro, [0.5, 0.3, 0.36]))
          bolsas[1].push(matriz(x, 0.47, s * (fz - 0.18), giro, [0.5, 0.3, 0.36]))
          for (const dx of [-0.13, 0.13]) cinchas.push(matriz(x + dx, 0.32, s * (fz - 0.365), giro, [0.025, 0.66, 0.008]))
        }
        // mazos de tres cables colgando hasta el bastidor vecino
        const sig = xs[i + 1]
        if (sig !== undefined && sig - x < 0.7 && r() < 0.65) {
          const comba = 0.12 + r() * 0.22
          COLORES_CABLE.forEach((color, k) => {
            const z = s * (fz - 0.04 - k * 0.022)
            cables[color].push(catenaria(new THREE.Vector3(x, 2.18 + k * 0.02, z), new THREE.Vector3(sig, 2.16 + k * 0.02, z), comba + k * 0.03, color === 'naranja' ? 0.009 : 0.014))
          })
        }
        // bajada desde la bandeja de cables hasta el panel de interruptores
        if (i % 2 === 0 && r() < 0.5) {
          const a = new THREE.Vector3(x + 0.12, HP - 0.02, s * (A / 2 - 0.08))
          const b = new THREE.Vector3(x + 0.14, 1.7, s * (fz - 0.03))
          const c = new THREE.CatmullRomCurve3([a, new THREE.Vector3(x + 0.2, 2.1, s * (fz - 0.09)), b])
          cables.gris.push(new THREE.TubeGeometry(c, 12, 0.012, 5, false))
        }
      })
    }
    const unir = (g: THREE.BufferGeometry[]) => {
      if (!g.length) return null
      const m = mergeGeometries(g)
      g.forEach((x) => x.dispose())
      return m
    }
    return { variantes, paneles, palancas, barras, soportes, bolsas, cinchas, cables: { blanco: unir(cables.blanco), gris: unir(cables.gris), naranja: unir(cables.naranja) } }
  }, [tramos])
  const frentes = useMemo(
    () =>
      ['HAB1D2', 'HAB1O4', 'HAB1P6'].map((codigo, k) => {
        const frente = new THREE.MeshStandardMaterial({ map: texturaBastidor(codigo, 0.58, 2.2, 31 + k * 17, alta), roughness: 0.75, metalness: 0.05 })
        return [MAT.panel, MAT.panel, MAT.panel, MAT.panel, frente, MAT.panel]
      }),
    [alta],
  )
  return (
    <group>
      {datos.variantes.map((m, k) => (
        <Instancias key={k} geo={CAJA} mat={frentes[k]} m={m} />
      ))}
      <Instancias geo={GEO.cilindro} mat={MAT.pasamanos} m={datos.barras} />
      <Instancias geo={CAJA} mat={MAT.junta} m={datos.soportes} />
      <Instancias geo={CAJA} mat={materialCTB(1)} m={datos.bolsas[0]} />
      <Instancias geo={CAJA} mat={materialCTB(4)} m={datos.bolsas[1]} />
      {alta && (
        <>
          <Instancias geo={CAJA} mat={MAT.oscuro} m={datos.paneles} />
          <Instancias geo={GEO.cilindro} mat={MAT_EXTRA.palanca} m={datos.palancas} />
          <Instancias geo={CAJA} mat={MAT_EXTRA.cincha} m={datos.cinchas} />
          {datos.cables.blanco && <mesh geometry={datos.cables.blanco} material={MAT_EXTRA.cableBlanco} />}
          {datos.cables.gris && <mesh geometry={datos.cables.gris} material={MAT_EXTRA.cableGris} />}
          {datos.cables.naranja && <mesh geometry={datos.cables.naranja} material={MAT.cableNaranja} />}
        </>
      )}
    </group>
  )
}

/** Rejillas de ventilación en los chaflanes y estribos para los pies frente a cada puesto. */
function DetallesCasco() {
  const alta = useGraficos((s) => s.calidad) === 'alta'
  const rejilla = useMemo(() => new THREE.MeshStandardMaterial({ map: texturaRejilla(), roughness: 0.6, metalness: 0.3 }), [])
  const rejillas = useMemo(() => [-7.2, -4.0, -0.8, 2.4, 5.6].map((x) => matriz(x, -0.053, 0.24, [Math.PI / 2, 0, 0], [0.5, 0.3, 1])), [])
  const lazos = useMemo(
    () =>
      ESTACIONES.filter((e) => e.zona === 'nave' && Math.abs(e.z) > 1).flatMap((e) =>
        [-0.2, 0.2].map((dx) => matriz(e.x + dx, 0, e.z - Math.sign(e.z) * 0.62, [0, 0, 0], [1, 0.45, 1])),
      ),
    [],
  )
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[0, HP + 0.27, s * (A / 2 - 0.3)]} rotation={[s * Math.PI * 0.25, 0, 0]}>
          <Instancias geo={GEO.plano} mat={rejilla} m={rejillas} />
        </group>
      ))}
      {alta && <Instancias geo={GEO.lazo} mat={MAT_EXTRA.cincha} m={lazos} />}
    </group>
  )
}

/** Suelo, paredes, chaflanes y techo, con anillos de estructura, pasamanos, cables y luces. */
function Casco() {
  const tramos = useMemo(() => {
    // Huecos de pared entre estaciones, que se cubren con bastidores genéricos.
    // Los bastidores de las estaciones de cada pared, con su mitad de ancho.
    const ocupados = (s: number) => [
      ...[-4.6, -1.5, 1.6, 4.7].map((x) => ({ x, medio: 1.25 })),
      ...ESTRECHOS.filter((id) => Math.sign(ESTACION_BY_ID[id].z) === s).map((id) => ({ x: ESTACION_BY_ID[id].x, medio: ANCHO_ESTRECHO / 2 })),
    ]
    const lista = (s: number) => {
      const o = ocupados(s)
      const xs: number[] = []
      for (let x = INTERIOR.x0 + 0.9; x < INTERIOR.x1 - 0.6; x += 0.62) if (!o.some((e) => Math.abs(e.x - x) < e.medio + 0.35)) xs.push(x)
      return xs
    }
    return { [-1]: lista(-1), [1]: lista(1) } as Record<number, number[]>
  }, [])
  const luzPanel = useMemo(() => new THREE.MeshBasicMaterial({ map: texturaLuz() }), [])
  // Paneles claros con marcas de uso (manos, roces) y juntas.
  useLayoutEffect(() => {
    const t = texturaDesgaste()
    t.repeat.set(7, 1.2)
    MAT.panelClaro.map = t
    MAT.panelClaro.needsUpdate = true
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
      {/* bastidores genéricos en los huecos, todos de una vez (tres variantes de frente) */}
      <BastidoresGenericos tramos={tramos} />
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
      {/* paneles de luz LED con su marco y difusor */}
      {[-6, -2, 2, 6].map((x) => (
        <group key={x} position={[x, H - 0.012, 0]}>
          <mesh material={MAT.junta}>
            <boxGeometry args={[2.1, 0.03, 0.7]} />
          </mesh>
          <mesh position={[0, -0.017, 0]} rotation={[Math.PI / 2, 0, 0]} material={luzPanel}>
            <planeGeometry args={[2.0, 0.6]} />
          </mesh>
        </group>
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
      <DetallesCasco />
      <Ventana sala={sala} />
      <Puente cerca={cerca} destacadas={destacadas} />
      <Estaciones sala={sala} cerca={cerca} destacadas={destacadas} micro={micro} />
      <Esclusa sala={sala} cerca={cerca} destacadas={destacadas} />
      {micro && <ObjetosFlotantes />}
    </group>
  )
}
