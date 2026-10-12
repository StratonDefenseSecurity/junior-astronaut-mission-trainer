// Escenas que no se caminan: el lanzamiento y el descenso a Marte.
// Siguen la telemetría real de la sala (altitud, etapa, aceleración).
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DESCENSO_S, type RoomState } from '@shared/types'

/** Tiempo de misión interpolado entre una consulta al servidor y la siguiente. */
export function useTiempoSuave(sala: RoomState) {
  const ref = useRef({ t: sala.t, recibido: performance.now(), escala: sala.escala })
  if (ref.current.t !== sala.t || ref.current.escala !== sala.escala) ref.current = { t: sala.t, recibido: performance.now(), escala: sala.escala }
  return () => {
    const r = ref.current
    const extra = Math.min(1.6, (performance.now() - r.recibido) / 1000)
    return r.t + extra * r.escala
  }
}

function Estrellas({ n = 1200, radio = 900 }: { n?: number; radio?: number }) {
  const pos = useMemo(() => {
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = radio * Math.sin(ph) * Math.cos(th)
      arr[i * 3 + 1] = radio * Math.cos(ph)
      arr[i * 3 + 2] = radio * Math.sin(ph) * Math.sin(th)
    }
    return arr
  }, [n, radio])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={2.2} color="#dbe7ff" sizeAttenuation fog={false} />
    </points>
  )
}

function Llama({ fuerza, radio = 0.5, largo = 4 }: { fuerza: () => number; radio?: number; largo?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const luz = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const f = fuerza()
    if (ref.current) {
      ref.current.visible = f > 0.02
      ref.current.scale.set(1, Math.max(0.01, f * (0.85 + Math.sin(clock.elapsedTime * 45) * 0.15)), 1)
    }
    if (luz.current) luz.current.intensity = f * 60
  })
  return (
    <group>
      <mesh ref={ref} position={[0, -largo / 2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radio, largo, 16, 1, true]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.88} side={THREE.DoubleSide} />
      </mesh>
      <pointLight ref={luz} position={[0, -1.5, 0]} color="#ff9a3c" distance={40} intensity={0} />
    </group>
  )
}

export function Lanzamiento({ sala }: { sala: RoomState }) {
  const tiempo = useTiempoSuave(sala)
  const mundo = useRef<THREE.Group>(null)
  const primera = useRef<THREE.Group>(null)
  const cielo = useRef(new THREE.Color('#6aa5e8'))
  const negro = useMemo(() => new THREE.Color('#02040a'), [])
  const azul = useMemo(() => new THREE.Color('#6aa5e8'), [])

  useFrame(({ camera, scene, clock }) => {
    const t = tiempo()
    // Altitud aproximada (km) a partir del tiempo, igual que la telemetría del servidor.
    const alt = t < 0 ? 0 : t < 150 ? 65 * Math.pow(t / 150, 2) : t < 160 ? 65 + (t - 150) * 1.3 : 78 + 122 * Math.pow(Math.min(1, (t - 160) / 350), 0.7)
    if (mundo.current) mundo.current.position.y = -alt * 3.2
    if (primera.current) {
      const sep = Math.max(0, t - 150)
      primera.current.position.y = -sep * sep * 0.35
      primera.current.rotation.z = sep * 0.04
      primera.current.visible = sep < 30
    }
    cielo.current.copy(azul).lerp(negro, Math.min(1, alt / 70))
    scene.background = cielo.current
    const giro = clock.elapsedTime * 0.12
    const dist = t < 0 ? 26 : 30 - Math.min(12, alt * 0.12)
    const temblor = t > 0 && t < 510 ? (Math.random() - 0.5) * 0.12 * Math.min(1, sala.vuelo.g / 3) : 0
    camera.position.set(Math.cos(giro) * dist + temblor, 6 + Math.min(10, alt * 0.1) + temblor, Math.sin(giro) * dist)
    camera.lookAt(0, 7, 0)
  })

  const empuje1 = () => {
    const t = tiempo()
    return t >= 0 && t < 150 ? 1 : 0
  }
  const empuje2 = () => {
    const t = tiempo()
    return t >= 160 && t < 510 ? 0.75 : 0
  }

  return (
    <group>
      <ambientLight intensity={0.55} />
      <directionalLight position={[30, 60, 20]} intensity={1.8} />
      <Estrellas />
      {/* la Tierra y la plataforma quedan abajo a medida que sube el cohete */}
      <group ref={mundo}>
        <mesh position={[0, -2000, 0]}>
          <sphereGeometry args={[2000, 96, 64]} />
          <meshStandardMaterial color="#2f6fb0" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[9, 11, 0.6, 32]} />
          <meshStandardMaterial color="#56606e" roughness={0.8} />
        </mesh>
        <mesh position={[5.5, 8, 0]}>
          <boxGeometry args={[1.2, 16, 1.2]} />
          <meshStandardMaterial color="#8d2a2a" roughness={0.7} />
        </mesh>
        <mesh position={[3.4, 12, 0]}>
          <boxGeometry args={[3.2, 0.3, 0.4]} />
          <meshStandardMaterial color="#8d2a2a" />
        </mesh>
      </group>
      {/* cohete */}
      <group position={[0, 0.5, 0]}>
        <group ref={primera}>
          <mesh position={[0, 4.5, 0]}>
            <cylinderGeometry args={[1.2, 1.25, 9, 28]} />
            <meshStandardMaterial color="#e8ecf3" metalness={0.3} roughness={0.4} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * 1.5, 0.9, Math.sin((i * Math.PI) / 2) * 1.5]} rotation={[0, -(i * Math.PI) / 2, 0]}>
              <boxGeometry args={[1, 1.8, 0.14]} />
              <meshStandardMaterial color="#9aa5b5" />
            </mesh>
          ))}
          <Llama fuerza={empuje1} radio={1.1} largo={9} />
        </group>
        <mesh position={[0, 11.2, 0]}>
          <cylinderGeometry args={[1.15, 1.2, 4.4, 28]} />
          <meshStandardMaterial color="#f4f6f9" metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh position={[0, 9.2, 0]}>
          <cylinderGeometry args={[1.22, 1.22, 0.5, 28]} />
          <meshStandardMaterial color="#c2410c" />
        </mesh>
        <mesh position={[0, 14.6, 0]}>
          <coneGeometry args={[1.15, 2.6, 28]} />
          <meshStandardMaterial color="#c2410c" />
        </mesh>
        <group position={[0, 9, 0]}>
          <Llama fuerza={empuje2} radio={0.7} largo={5} />
        </group>
      </group>
    </group>
  )
}

export function Descenso({ sala }: { sala: RoomState }) {
  const tiempo = useTiempoSuave(sala)
  const marte = useRef<THREE.Group>(null)
  const capsula = useRef<THREE.Group>(null)
  const brillo = useRef<THREE.Mesh>(null)
  const paracaidas = useRef<THREE.Group>(null)
  const cielo = useRef(new THREE.Color('#02040a'))
  const negro = useMemo(() => new THREE.Color('#02040a'), [])
  const ocre = useMemo(() => new THREE.Color('#c98a62'), [])

  const td = () => Math.max(0, Math.min(DESCENSO_S, tiempo() - sala.tFase))
  const altitud = () => {
    const x = td()
    if (x < 255) return 125 + (11 - 125) * Math.pow(x / 255, 0.8)
    if (x < 360) return 11 + (1.6 - 11) * ((x - 255) / 105)
    return 1.6 * (1 - (x - 360) / (DESCENSO_S - 360))
  }

  useFrame(({ camera, scene, clock }) => {
    const x = td()
    const alt = altitud()
    if (marte.current) marte.current.position.y = -2000 - alt * 6
    const calor = Math.exp(-Math.pow((x - 95) / 55, 2))
    if (brillo.current) {
      brillo.current.visible = calor > 0.04
      ;(brillo.current.material as THREE.MeshBasicMaterial).opacity = calor * 0.9
      brillo.current.scale.setScalar(1 + calor * 0.6 + Math.sin(clock.elapsedTime * 40) * 0.05)
    }
    if (paracaidas.current) paracaidas.current.visible = x >= 255 && x < 360
    if (capsula.current) capsula.current.rotation.z = Math.sin(clock.elapsedTime * 1.7) * (x >= 255 && x < 360 ? 0.12 : 0.03)
    cielo.current.copy(negro).lerp(ocre, Math.min(1, Math.max(0, (60 - alt) / 55)))
    scene.background = cielo.current
    const temblor = (Math.random() - 0.5) * 0.25 * Math.min(1, sala.vuelo.g / 3)
    const giro = clock.elapsedTime * 0.1
    camera.position.set(Math.cos(giro) * 16 + temblor, 7 + temblor, Math.sin(giro) * 16)
    camera.lookAt(0, 1.5, 0)
  })

  const frenado = () => {
    const x = td()
    return x >= 360 && x < DESCENSO_S ? 0.9 : 0
  }

  return (
    <group>
      <ambientLight intensity={0.6} />
      <directionalLight position={[40, 50, 10]} intensity={1.7} color="#ffe6cf" />
      <Estrellas />
      <group ref={marte}>
        <mesh>
          <sphereGeometry args={[2000, 96, 64]} />
          <meshStandardMaterial color="#b4542f" roughness={1} />
        </mesh>
      </group>
      <group ref={capsula}>
        {/* escudo térmico */}
        <mesh position={[0, 0, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[3.4, 1.1, 36]} />
          <meshStandardMaterial color="#5b4636" roughness={0.9} />
        </mesh>
        {/* carcasa: dentro va el hábitat */}
        <mesh position={[0, 2.2, 0]}>
          <coneGeometry args={[3.3, 3.6, 36]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh ref={brillo} position={[0, -0.9, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[4.2, 2.6, 28, 1, true]} />
          <meshBasicMaterial color="#ff7a2f" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
        <group ref={paracaidas} position={[0, 15, 0]}>
          <mesh>
            <sphereGeometry args={[5.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
            <meshStandardMaterial color="#f97316" side={THREE.DoubleSide} roughness={0.9} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} position={[Math.cos((i * Math.PI) / 3) * 2.6, -5.4, Math.sin((i * Math.PI) / 3) * 2.6]} rotation={[Math.sin((i * Math.PI) / 3) * 0.42, 0, -Math.cos((i * Math.PI) / 3) * 0.42]}>
              <cylinderGeometry args={[0.02, 0.02, 11.5, 4]} />
              <meshBasicMaterial color="#e2e8f0" />
            </mesh>
          ))}
        </group>
        <group position={[0, -0.6, 0]}>
          <Llama fuerza={frenado} radio={1.2} largo={6} />
        </group>
      </group>
    </group>
  )
}
