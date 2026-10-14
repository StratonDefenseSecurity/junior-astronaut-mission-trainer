// Lo que se ve por el ventanal del puente, calculado para la fecha y el lugar reales de la misión:
// - En el viaje, el cielo desde la posición de la nave en su órbita de transferencia. La primera
//   mitad la ventana mira a la Tierra, que se va alejando con la Luna; la segunda, a Marte, que crece.
// - En la órbita de Marte, el planeta llena la ventana.
// - En la superficie, el paisaje y el cielo del sitio de aterrizaje: color caramelo de día y, de
//   noche, las estrellas con la Tierra como un lucero azulado.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CIUDAD_BY_ID, escenarioDe, fechaDeMision } from '@shared/escenarios'
import type { Marcador } from './planetas'
import { SITE_BY_ID, TRANSITO_INICIO_S, type RoomState } from '@shared/types'
import { Cielo } from './cielo/Cielo'
import { cuerposVisibles, posicionNave, vectorHelio, type Cuerpo, type InfoCuerpo, type Vec3 } from './cielo/astro'
import { UA_KM } from './cielo/marco'
import { orientacionHacia } from './cielo/orientacion'
import { Globo } from './Globo'
import { SITIOS_MARTE, orientacionCieloMarte } from './cieloMarte'

const SITIOS = SITIOS_MARTE
/** La ventana mira hacia -X en el módulo; los planetas quedan un poco a un lado para no taparla entera. */
const HACIA_VENTANA = new THREE.Vector3(-1, 0.12, 0.28).normalize()
const ARRIBA = new THREE.Vector3(0, 1, 0)
const DISTANCIA_GLOBOS = 900

/** Dónde está quien mira por la ventana: la nave, la órbita de Marte o la superficie. */
export function observadorDe(sala: RoomState): { fecha: Date; observador: Vec3; lugar: 'viaje' | 'orbita' | 'superficie' } {
  const esc = escenarioDe(sala.escenario)
  const fecha = fechaDeMision(esc, Math.max(0, sala.t))
  const salida = fechaDeMision(esc, TRANSITO_INICIO_S)
  const llegada = new Date(salida.getTime() + sala.mision.diasTransito * 86400_000)
  if (sala.tAterrizaje > 0) return { fecha, observador: vectorHelio('Marte', fecha), lugar: 'superficie' }
  if (sala.fase === 'llegada') {
    // Órbita baja: a unos 900 km sobre el lado de día.
    const m = vectorHelio('Marte', fecha)
    const n = Math.hypot(m.x, m.y, m.z)
    const r = (3389.5 + 900) / UA_KM
    return { fecha, observador: { x: m.x - (m.x / n) * r * 0.6 + (m.y / n) * r * 0.8, y: m.y - (m.y / n) * r * 0.6 - (m.x / n) * r * 0.8, z: m.z }, lugar: 'orbita' }
  }
  if (sala.fase !== 'transito') return { fecha, observador: vectorHelio('Tierra', fecha), lugar: 'viaje' }
  // En las primeras horas la nave aún está junto a la Tierra: se separa al menos 3 radios.
  const f = Math.min(0.9995, Math.max(0.0004, sala.vuelo.progreso))
  return { fecha, observador: posicionNave(salida, llegada, f), lugar: 'viaje' }
}

/** Planeta o Luna como globo cuando se ve grande, a una distancia fija y del tamaño angular real. */
function CuerpoCercano({ cuerpo, info, orientacion, fecha, marcadores }: { cuerpo: Cuerpo; info: InfoCuerpo; orientacion: THREE.Quaternion; fecha: Date; marcadores?: readonly Marcador[] }) {
  // El globo se coloca en el marco celeste (sin girar) y después se gira todo con el cielo.
  const pos = useMemo(() => info.direccion.clone().multiplyScalar(DISTANCIA_GLOBOS), [info])
  const radio = Math.tan(info.tamanoAngularRad / 2) * DISTANCIA_GLOBOS
  return (
    <group quaternion={orientacion}>
      <group position={pos}>
        <Globo cuerpo={cuerpo} radio={radio} fecha={fecha} marcadores={marcadores} />
      </group>
    </group>
  )
}

export function Ventana({ sala }: { sala: RoomState }) {
  const { fecha, observador, lugar } = observadorDe(sala)
  const sigue = useRef<THREE.Group>(null)
  useFrame(({ camera }) => {
    // Los globos están "en el infinito", como el cielo: se mueven con la cámara.
    if (sigue.current) sigue.current.position.copy(camera.position)
  })
  const cuerpos = useMemo(() => cuerposVisibles(fecha, observador), [fecha.getTime(), observador.x, observador.y, observador.z]) // eslint-disable-line react-hooks/exhaustive-deps
  const objetivo: Cuerpo = lugar === 'orbita' ? 'Marte' : sala.vuelo.progreso < 0.5 ? 'Tierra' : 'Marte'
  const sitio = SITIOS[sala.sitio ?? escenarioDe(sala.escenario).sitio ?? 'gale'] ?? SITIOS.gale
  const orientacion = useMemo(() => {
    if (lugar === 'superficie') return orientacionCieloMarte(fecha, sitio.lat, sitio.lon, sala.ambiente.hora)
    const hacia = lugar === 'orbita' ? new THREE.Vector3(-1, -0.55, 0.05).normalize() : HACIA_VENTANA
    return orientacionHacia(cuerpos[objetivo].direccion, hacia, ARRIBA, ARRIBA)
    // Se reorienta por pasos para que el cielo no "baile" con cada consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lugar, objetivo, lugar === 'superficie' ? Math.floor(fecha.getTime() / 600_000) : Math.floor(sala.vuelo.progreso * 400), sitio.lat])

  // En la Tierra, las ciudades de la tripulación; en Marte, el sitio de aterrizaje.
  const hogares = useMemo(
    () =>
      sala.jugadores
        .map((j) => (j.hogar ? CIUDAD_BY_ID[j.hogar as keyof typeof CIUDAD_BY_ID] : null))
        .filter((c, i, l): c is NonNullable<typeof c> => Boolean(c) && l.indexOf(c) === i)
        .map((c) => ({ lat: c.lat, lon: c.lon, nombre: c.nombre, color: '#f5b942' })),
    [sala.jugadores],
  )
  const destino = useMemo(() => [{ ...sitio, nombre: SITE_BY_ID[sala.sitio ?? escenarioDe(sala.escenario).sitio ?? 'gale'].nombre, color: '#4fc3f7' }], [sitio, sala.sitio, sala.escenario])
  // Cuerpos que se ven como disco y se dibujan como globo detallado.
  const grandes = (['Tierra', 'Luna', 'Marte'] as Cuerpo[]).filter((c) => cuerpos[c].visible && cuerpos[c].tamanoAngularRad > 0.0035)

  if (lugar === 'superficie') return <VistaMarte sala={sala} fecha={fecha} observador={observador} orientacion={orientacion} />
  return (
    <group>
      <Cielo fecha={fecha} observador={observador} orientacion={orientacion} etiquetas constelaciones={false} ocultarCuerpos={grandes} fondoNegro />
      <group ref={sigue}>
        {grandes.map((c) => (
          <CuerpoCercano key={c} cuerpo={c} info={cuerpos[c]} orientacion={orientacion} fecha={fecha} marcadores={c === 'Tierra' ? hogares : c === 'Marte' ? destino : undefined} />
        ))}
      </group>
    </group>
  )
}

/** Desde el hábitat en Marte: suelo, colinas y el cielo del sitio, de día o de noche. */
function VistaMarte({ sala, fecha, observador, orientacion }: { sala: RoomState; fecha: Date; observador: Vec3; orientacion: THREE.Quaternion }) {
  const hora = sala.ambiente.hora
  // Luz del día: sube al amanecer y baja al atardecer (horario local del sitio).
  const dia = Math.min(1, Math.max(0, Math.min(hora - 5.5, 19.5 - hora) / 1.2))
  const polvo = Math.min(1, sala.ambiente.tau / 4)
  const cupula = useRef<THREE.Mesh>(null)
  useFrame(({ camera }) => {
    if (cupula.current) cupula.current.position.copy(camera.position)
  })
  const colorCielo = useMemo(() => new THREE.Color('#c99a6b').lerp(new THREE.Color('#8a5a3c'), polvo), [polvo])
  return (
    <group>
      <Cielo fecha={fecha} observador={observador} orientacion={orientacion} brillo={(1 - dia) * (1 - polvo * 0.8) * 0.85} atmosfera centelleo={0.05} etiquetas ocultarCuerpos={['Sol']} fondoNegro />
      {/* el cielo de día de Marte es color caramelo por el polvo en suspensión */}
      <mesh ref={cupula} renderOrder={-5}>
        <sphereGeometry args={[1200, 24, 12]} />
        <meshBasicMaterial color={colorCielo} side={THREE.BackSide} transparent opacity={dia * 0.97} depthWrite={false} fog={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-80, -0.6, 0]}>
        <planeGeometry args={[220, 260]} />
        <meshStandardMaterial color={dia > 0.2 ? '#a9542f' : '#3b1c12'} roughness={1} />
      </mesh>
      {[[-40, 3, -18, 9], [-60, 5, 22, 14], [-90, 8, -40, 22], [-30, 2, 30, 6]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y - r * 0.8, z]}>
          <sphereGeometry args={[r, 16, 12]} />
          <meshStandardMaterial color={dia > 0.2 ? '#93432a' : '#2f1710'} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}
