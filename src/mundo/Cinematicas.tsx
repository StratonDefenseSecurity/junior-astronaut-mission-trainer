// Escenas que no se caminan: el lanzamiento y el descenso a Marte.
// Siguen la telemetría real de la sala (altitud, etapa, aceleración). El Sol ilumina desde su
// dirección real para la fecha y el lugar, con un destello en la cámara cuando se ve.
// El descenso reproduce, momento a momento, el de Perseverance (shared/edl.ts).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { calorEDL, EDL, estadoEDL, trayectoriaEDL } from '@shared/edl'
import { escenarioDe, fechaDeMision } from '@shared/escenarios'
import { DESCENSO_S, type RoomState } from '@shared/types'
import { Cielo } from './cielo/Cielo'
import { orientacionSuperficie, vectorHelio } from './cielo/astro'
import { SITIOS_MARTE } from './cieloMarte'
import { Destello, type Oclusor } from './Destello'
import { direccionSolEscena, Marte, Tierra } from './planetas'

/** Cabo Cañaveral (Florida): el sitio de lanzamiento que se supone para la misión. */
const CABO_CANAVERAL = { lat: 28.39, lon: -80.6 }
/** Radio de la Tierra en el lanzamiento (unidades de la escena): 1 unidad = 3.19 km. */
const R_PLANETA = 2000
/**
 * Radio de Marte en el descenso: más grande, para que desde pocos km el horizonte se vea casi
 * plano como en las imágenes reales. La cámara ve más lejos mientras dura la escena.
 */
const R_MARTE = 8000
const LEJOS_DESCENSO = 14000

/**
 * Exposición y mapeo de tonos ACES de la cámara mientras dura la escena. El Sol en el espacio es
 * mucho más fuerte que cualquier luz de la nave: con ACES las zonas iluminadas no se queman.
 */
function useExposicion(exposicion: number) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const antes = { mapeo: gl.toneMapping, exposicion: gl.toneMappingExposure }
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = exposicion
    return () => {
      gl.toneMapping = antes.mapeo
      gl.toneMappingExposure = antes.exposicion
    }
  }, [gl, exposicion])
}

/** Dirección del Sol en la escena local de un sitio (cenit = +Y), la misma que usa su globo. */
function solLocal(cuerpo: 'tierra' | 'marte', fecha: Date, q: THREE.Quaternion) {
  return direccionSolEscena(cuerpo, fecha).applyQuaternion(q).normalize()
}

/** El cielo real sobre el cohete: se va viendo a medida que el aire se hace tenue. */
function CieloDespegue({ fecha, orientacion, brillo }: { fecha: Date; orientacion: THREE.Quaternion; brillo: number }) {
  const observador = useMemo(() => vectorHelio('Tierra', fecha), [fecha])
  return <Cielo fecha={fecha} observador={observador} orientacion={orientacion} brillo={brillo} ocultarCuerpos={['Tierra']} />
}

/** La Tierra real con Cabo Cañaveral justo debajo de la plataforma. */
function TierraDebajo({ fecha, orientacion }: { fecha: Date; orientacion: THREE.Quaternion }) {
  return (
    <group position={[0, -R_PLANETA, 0]} quaternion={orientacion}>
      <Tierra radio={R_PLANETA} fecha={fecha} detalle="alto" etiquetas={false} />
    </group>
  )
}

function MarteDebajo({ fecha, orientacion }: { fecha: Date; orientacion: THREE.Quaternion }) {
  return (
    <group quaternion={orientacion}>
      <Marte radio={R_MARTE} fecha={fecha} detalle="alto" etiquetas={false} />
    </group>
  )
}

/** El cielo de Marte durante la entrada: negro y estrellado arriba, hasta que el polvo lo tiñe. */
function CieloEntrada({ fecha, orientacion, brillo }: { fecha: Date; orientacion: THREE.Quaternion; brillo: number }) {
  const observador = useMemo(() => vectorHelio('Marte', fecha), [fecha])
  return <Cielo fecha={fecha} observador={observador} orientacion={orientacion} brillo={brillo} etiquetas ocultarCuerpos={['Sol', 'Marte']} />
}

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

function Llama({ fuerza, radio = 0.5, largo = 4, conLuz = true }: { fuerza: () => number; radio?: number; largo?: number; conLuz?: boolean }) {
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
      {conLuz && <pointLight ref={luz} position={[0, -1.5, 0]} color="#ff9a3c" distance={40} intensity={0} />}
    </group>
  )
}

/**
 * Altura (unidades de la escena) a la que queda el suelo bajo el cohete. Arriba es la escala real
 * del globo (1 unidad = 3.19 km) y abajo se estira un poco para ver alejarse la plataforma.
 */
const bajadaTierra = (altKm: number) => altKm / 3.19 + 25 * (1 - Math.exp(-altKm / 5))

export function Lanzamiento({ sala }: { sala: RoomState }) {
  const tiempo = useTiempoSuave(sala)
  const mundo = useRef<THREE.Group>(null)
  const primera = useRef<THREE.Group>(null)
  // Por encima de unos 40 km el cielo ya es negro y se empiezan a ver las estrellas.
  const brilloCielo = Math.min(0.75, Math.max(0, (sala.vuelo.altitud - 35) / 60))
  const cielo = useRef(new THREE.Color('#6aa5e8'))
  const negro = useMemo(() => new THREE.Color('#02040a'), [])
  const azul = useMemo(() => new THREE.Color('#6aa5e8'), [])
  const noche = useMemo(() => new THREE.Color('#0b1424'), [])
  const fecha = useMemo(() => fechaDeMision(escenarioDe(sala.escenario), 0), [sala.escenario])
  const orientacion = useMemo(() => orientacionSuperficie('Tierra', fecha, CABO_CANAVERAL.lat, CABO_CANAVERAL.lon), [fecha])
  const sol = useMemo(() => solLocal('tierra', fecha, orientacion), [fecha, orientacion])
  // Luz del día en la plataforma según la altura del Sol: el despegue puede ser de noche.
  const dia = THREE.MathUtils.smoothstep(sol.y, -0.1, 0.12)
  const centroTierra = useRef(new THREE.Vector3(0, -R_PLANETA, 0))
  const oclusores = useMemo<Oclusor[]>(() => [{ centro: centroTierra.current, radio: R_PLANETA }], [])
  useExposicion(1.05)

  useFrame(({ camera, scene, clock }) => {
    const t = tiempo()
    // Altitud aproximada (km) a partir del tiempo, igual que la telemetría del servidor.
    const alt = t < 0 ? 0 : t < 150 ? 65 * Math.pow(t / 150, 2) : t < 160 ? 65 + (t - 150) * 1.3 : 78 + 122 * Math.pow(Math.min(1, (t - 160) / 350), 0.7)
    const baja = bajadaTierra(alt)
    if (mundo.current) mundo.current.position.y = -baja
    centroTierra.current.set(0, -R_PLANETA - baja, 0)
    if (primera.current) {
      const sep = Math.max(0, t - 150)
      primera.current.position.y = -sep * sep * 0.35
      primera.current.rotation.z = sep * 0.04
      primera.current.visible = sep < 30
    }
    // Cielo azul de día (negro de noche) que se apaga al subir.
    cielo.current.copy(noche).lerp(azul, dia).lerp(negro, Math.min(1, alt / 70))
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
      {/* el Sol en su dirección real; abajo, la luz azulada que devuelve la Tierra */}
      <directionalLight position={sol.clone().multiplyScalar(100).toArray()} intensity={2.6 * Math.max(0.05, THREE.MathUtils.smoothstep(sol.y, -0.08, 0.05))} color="#fff4e6" />
      <hemisphereLight args={['#9cc4ff', '#2a4a7a', 0.25 + 0.35 * dia]} />
      <ambientLight intensity={0.08} />
      <CieloDespegue fecha={fecha} orientacion={orientacion} brillo={brilloCielo} />
      <Destello direccion={() => sol} oclusores={() => oclusores} encima />
      {/* la Tierra y la plataforma quedan abajo a medida que sube el cohete */}
      <group ref={mundo}>
        <TierraDebajo fecha={fecha} orientacion={orientacion} />
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

// ------------------------------------------------------------------------------ descenso

/**
 * Escala de la nave: el escudo de Perseverance mide 4.5 m y aquí tiene 3.4 unidades de radio,
 * así que 1 unidad ≈ 0.66 m. Los cables de la grúa celeste miden 7.6 m.
 */
const M_POR_UNIDAD = 0.66
const CABLES = 7.6 / M_POR_UNIDAD
/** La etapa de descenso va dentro de la cubierta trasera; el rover cuelga debajo de ella. */
const ETAPA_Y = 1.2
const ROVER_ARRIBA = -1.4
const RUEDAS = 0.9
/** Con los cables estirados, las ruedas del rover tocan el suelo aquí. */
const SUELO_CONTACTO = ETAPA_Y + ROVER_ARRIBA - CABLES - RUEDAS

/**
 * Distancia al suelo en la escena: a escala de la nave en los últimos 20 m y comprimida
 * (logarítmica) más arriba, para ver a la vez la nave y el planeta.
 */
function bajadaMarte(altKm: number) {
  const m = altKm * 1000
  const base = 20 / M_POR_UNIDAD
  return -SUELO_CONTACTO + (m <= 20 ? m / M_POR_UNIDAD : base + 18 * Math.log(m / 20))
}

/**
 * Plasma del choque delante del escudo: brillo que crece hacia el borde, aditivo. Con `estela`,
 * la cola caliente detrás de la cápsula, más tenue y que se apaga a lo largo.
 */
function materialPlasma(estela = false) {
  return new THREE.ShaderMaterial({
    uniforms: { uFuerza: { value: 0 }, uTiempo: { value: 0 } },
    defines: estela ? { ESTELA: '' } : {},
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vP;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFuerza;
      uniform float uTiempo;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vP;
      void main() {
        float borde = pow(1.0 - abs(dot(vN, vV)), 1.6);
        float onda = 0.85 + 0.15 * sin(vP.y * 9.0 - uTiempo * 30.0 + vP.x * 4.0);
        vec3 col = mix(vec3(1.0, 0.45, 0.25), vec3(1.0, 0.9, 0.75), 1.0 - borde);
        #ifdef ESTELA
          // vP.y va de -6.5 (junto al escudo) a 6.5 (la punta de la cola).
          float largo = 1.0 - smoothstep(-6.5, 6.5, vP.y);
          gl_FragColor = vec4(vec3(1.0, 0.5, 0.3) * uFuerza * borde * largo * largo * onda, 1.0);
        #else
          gl_FragColor = vec4(col * uFuerza * (0.35 + borde * 1.4) * onda, 1.0);
        #endif
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

/** Textura redonda y suave para el polvo que levantan los motores. */
function texturaPolvo() {
  const n = 64
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  r.addColorStop(0, 'rgba(196,140,100,0.9)')
  r.addColorStop(1, 'rgba(196,140,100,0)')
  g.fillStyle = r
  g.fillRect(0, 0, n, n)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const tmpEje = new THREE.Vector3(0, 0, 1)

export function Descenso({ sala }: { sala: RoomState }) {
  const tiempo = useTiempoSuave(sala)
  const marte = useRef<THREE.Group>(null)
  const brilloCielo = Math.min(0.8, Math.max(0, (sala.vuelo.altitud - 40) / 60))
  const nave = useRef<THREE.Group>(null)
  const crucero = useRef<THREE.Group>(null)
  const escudo = useRef<THREE.Group>(null)
  const cubierta = useRef<THREE.Group>(null)
  const paracaidas = useRef<THREE.Group>(null)
  const etapa = useRef<THREE.Group>(null)
  const rover = useRef<THREE.Group>(null)
  const cables = useRef<THREE.Group>(null)
  const masas = useRef<THREE.Group>(null)
  const luzMotores = useRef<THREE.PointLight>(null)
  const camara = useRef({ mira: new THREE.Vector3(), radio: 16, listo: false })
  const objetivo = useMemo(() => new THREE.Vector3(), [])
  const polvo = useRef<THREE.Group>(null)
  const plasma = useMemo(() => materialPlasma(), [])
  const estela = useMemo(() => materialPlasma(true), [])
  const texPolvo = useMemo(texturaPolvo, [])
  useEffect(
    () => () => {
      plasma.dispose()
      estela.dispose()
      texPolvo.dispose()
    },
    [plasma, estela, texPolvo],
  )
  const cielo = useRef(new THREE.Color('#02040a'))
  const negro = useMemo(() => new THREE.Color('#02040a'), [])
  const ocre = useMemo(() => new THREE.Color('#c98a62'), [])
  const fecha = useMemo(() => fechaDeMision(escenarioDe(sala.escenario), sala.tFase), [sala.escenario, sala.tFase])
  const sitio = SITIOS_MARTE[sala.sitio ?? 'gale'] ?? SITIOS_MARTE.gale
  const orientacion = useMemo(() => orientacionSuperficie('Marte', fecha, sitio.lat, sitio.lon), [fecha, sitio.lat, sitio.lon])
  const sol = useMemo(() => solLocal('marte', fecha, orientacion), [fecha, orientacion])
  const dia = THREE.MathUtils.smoothstep(sol.y, -0.1, 0.15)
  const centroMarte = useRef(new THREE.Vector3(0, -R_MARTE, 0))
  const oclusores = useMemo<Oclusor[]>(() => [{ centro: centroMarte.current, radio: R_MARTE }], [])
  useExposicion(1)
  const camaraEscena = useThree((s) => s.camera)
  useEffect(() => {
    const c = camaraEscena as THREE.PerspectiveCamera
    const antes = c.far
    c.far = Math.max(antes, LEJOS_DESCENSO)
    c.updateProjectionMatrix()
    return () => {
      c.far = antes
      c.updateProjectionMatrix()
    }
  }, [camaraEscena])

  const td = () => Math.max(0, Math.min(DESCENSO_S, tiempo() - sala.tFase))

  useFrame(({ camera, scene, clock }, delta) => {
    const x = td()
    const e = estadoEDL(x)
    const baja = bajadaMarte(e.altitud)
    if (marte.current) marte.current.position.y = -R_MARTE - baja
    centroMarte.current.set(0, -R_MARTE - baja, 0)
    const reloj = clock.elapsedTime

    // La nave apunta el escudo hacia donde va: casi rasante al entrar, vertical al final.
    if (nave.current) {
      const gamma = (trayectoriaEDL(x) * Math.PI) / 180
      const vaiven = x >= EDL.paracaidas && x < EDL.cubierta ? Math.sin(reloj * 1.7) * 0.1 : Math.sin(reloj * 0.9) * 0.02
      nave.current.quaternion.setFromAxisAngle(tmpEje, gamma + Math.PI / 2 + vaiven)
    }
    // Etapa de crucero: se aleja en los primeros segundos.
    if (crucero.current) {
      crucero.current.visible = x < 10
      crucero.current.position.set(x * 1.5, 4 + x * x * 0.6, 0)
      crucero.current.rotation.z = x * 0.08
    }
    // Plasma: máximo hacia los 75 s.
    const calor = calorEDL(x)
    plasma.uniforms.uFuerza.value = calor * 1.6
    plasma.uniforms.uTiempo.value = reloj
    estela.uniforms.uFuerza.value = calor * 0.45
    estela.uniforms.uTiempo.value = reloj
    // Masas de equilibrio: se sueltan y se alejan.
    if (masas.current) {
      const s = x - EDL.masasEquilibrio
      masas.current.visible = s > 0 && s < 12
      masas.current.children.forEach((m, i) => {
        const a = (i / masas.current!.children.length) * Math.PI * 2
        m.position.set(Math.cos(a) * (3 + s * 2.2), 0.8 - s * s * 0.05, Math.sin(a) * (3 + s * 2.2))
      })
    }
    // Paracaídas: se infla en un segundo y medio.
    if (paracaidas.current) {
      const s = x - EDL.paracaidas
      paracaidas.current.visible = s > 0
      paracaidas.current.scale.setScalar(Math.min(1, Math.max(0.05, s / 1.5)))
    }
    // Escudo térmico: cae y se aleja.
    if (escudo.current) {
      const s = Math.max(0, x - EDL.escudo)
      escudo.current.position.y = -s * s * 0.6
      escudo.current.rotation.x = s * 0.15
      escudo.current.visible = s < 12
    }
    // Cubierta trasera con el paracaídas: se suelta y la etapa de descenso cae libre.
    if (cubierta.current) {
      const s = Math.max(0, x - EDL.cubierta)
      cubierta.current.position.set(s * s * 0.2, s * s * 0.5, 0)
      cubierta.current.visible = s < 14
    }
    // La etapa de descenso y el rover van dentro del escudo hasta que este se suelta.
    if (etapa.current) etapa.current.visible = x >= EDL.escudo
    if (luzMotores.current) luzMotores.current.intensity = x >= EDL.cubierta + 1 && x < EDL.contacto ? 70 : 0
    // Grúa celeste: el rover baja colgado de los cables.
    const bajar = Math.min(1, Math.max(0, (x - EDL.gruaCeleste) / 6))
    if (rover.current) rover.current.position.y = ROVER_ARRIBA - bajar * CABLES
    if (cables.current) {
      cables.current.visible = bajar > 0
      cables.current.scale.set(1, Math.max(0.001, bajar * CABLES), 1)
    }
    // Polvo que levantan los motores cerca del suelo.
    if (polvo.current) {
      const cerca = x >= EDL.cubierta ? 1 - THREE.MathUtils.smoothstep(e.altitud * 1000, 15, 60) : 0
      polvo.current.visible = cerca > 0.01
      polvo.current.position.y = -baja
      polvo.current.children.forEach((p, i) => {
        const a = (i / polvo.current!.children.length) * Math.PI * 2 + reloj * 0.15
        const r = 6 + ((reloj * 3 + i * 1.7) % 14)
        p.position.set(Math.cos(a) * r, 1 + (i % 3), Math.sin(a) * r)
        ;((p as THREE.Sprite).material as THREE.SpriteMaterial).opacity = cerca * 0.55 * (1 - (r - 6) / 14)
      })
    }

    // Cielo: negro arriba; el polvo lo tiñe de caramelo de día al bajar.
    cielo.current.copy(negro).lerp(ocre, Math.min(1, Math.max(0, (30 - e.altitud) / 26)) * dia)
    scene.background = cielo.current
    // Cámara: cerca de la cápsula al entrar, lejos para ver el paracaídas entero, y abajo junto
    // al rover en la grúa celeste. Pasa de un encuadre a otro con suavidad.
    const temblor = (Math.random() - 0.5) * 0.25 * Math.min(1, sala.vuelo.g / 3)
    const giro = reloj * 0.1
    const conParacaidas = x >= EDL.paracaidas && x < EDL.cubierta + 3
    const final = x >= EDL.gruaCeleste - 4
    if (conParacaidas && nave.current) objetivo.set(0, 14, 0).applyQuaternion(nave.current.quaternion)
    else objetivo.set(0, final ? ETAPA_Y - 7 : x >= EDL.cubierta ? ETAPA_Y - 2 : 1.5, 0)
    const radio = conParacaidas ? 85 : final ? 26 : x >= EDL.cubierta ? 20 : 16
    const k = 1 - Math.exp(-Math.min(0.1, delta) * 1.5)
    const c = camara.current
    if (!c.listo) {
      c.mira.copy(objetivo)
      c.radio = radio
      c.listo = true
    }
    c.mira.lerp(objetivo, k)
    c.radio += (radio - c.radio) * k
    camera.position.set(c.mira.x + Math.cos(giro) * c.radio + temblor, c.mira.y + c.radio * 0.3 + temblor, c.mira.z + Math.sin(giro) * c.radio)
    camera.lookAt(c.mira)
  })

  const frenado = () => {
    const x = td()
    return x >= EDL.cubierta + 1 && x < EDL.contacto ? 0.9 : 0
  }

  return (
    <group>
      <directionalLight position={sol.clone().multiplyScalar(100).toArray()} intensity={2.2 * Math.max(0.04, THREE.MathUtils.smoothstep(sol.y, -0.08, 0.05))} color="#ffe6cf" />
      <hemisphereLight args={['#d9b08c', '#5a3422', 0.18 + 0.3 * dia]} />
      <CieloEntrada fecha={fecha} orientacion={orientacion} brillo={brilloCielo} />
      <Destello direccion={() => sol} oclusores={() => oclusores} tamano={0.5} intensidad={0.9} encima />
      <group ref={marte}>
        <MarteDebajo fecha={fecha} orientacion={orientacion} />
      </group>
      <group ref={polvo}>
        {Array.from({ length: 18 }, (_, i) => (
          <sprite key={i} scale={[9, 5, 1]}>
            <spriteMaterial map={texPolvo} transparent depthWrite={false} opacity={0} />
          </sprite>
        ))}
      </group>
      <group ref={nave}>
        {/* etapa de crucero: disco con paneles solares, encima de la cápsula */}
        <group ref={crucero}>
          <mesh>
            <cylinderGeometry args={[2.9, 2.9, 0.5, 28]} />
            <meshStandardMaterial color="#c9ced6" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.27, 0]}>
            <cylinderGeometry args={[2.85, 2.85, 0.04, 28]} />
            <meshStandardMaterial color="#1e2a4a" metalness={0.2} roughness={0.3} />
          </mesh>
        </group>
        {/* escudo térmico */}
        <group ref={escudo}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[3.4, 1.1, 36]} />
            <meshStandardMaterial color="#5b4636" roughness={0.9} />
          </mesh>
          {/* plasma del choque, delante del escudo */}
          <mesh position={[0, -0.75, 0]} scale={[1.18, 0.55, 1.18]} material={plasma}>
            <sphereGeometry args={[3.4, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          </mesh>
          {/* estela caliente que sigue a la cápsula */}
          <mesh position={[0, 6, 0]} material={estela}>
            <cylinderGeometry args={[1.2, 3.9, 13, 24, 1, true]} />
          </mesh>
        </group>
        {/* cubierta trasera con el paracaídas de 21.5 m */}
        <group ref={cubierta}>
          <mesh position={[0, 2.2, 0]}>
            <coneGeometry args={[3.3, 3.6, 36, 1, true]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.3} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
          <group ref={paracaidas} position={[0, 4, 0]}>
            <group position={[0, 22, 0]}>
              <mesh>
                <sphereGeometry args={[16, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2.3]} />
                <meshStandardMaterial color="#f1f1ee" side={THREE.DoubleSide} roughness={0.9} />
              </mesh>
              {/* franjas naranjas del paracaídas real */}
              <mesh>
                <sphereGeometry args={[16.05, 32, 12, 0, Math.PI * 2, Math.PI / 4.5, Math.PI / 14]} />
                <meshStandardMaterial color="#f97316" side={THREE.DoubleSide} roughness={0.9} />
              </mesh>
            </group>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const a = (i * Math.PI) / 4
              return (
                <mesh key={i} position={[Math.cos(a) * 7.8, 14.6, Math.sin(a) * 7.8]} rotation={[Math.sin(a) * 0.64, 0, -Math.cos(a) * 0.64]}>
                  <cylinderGeometry args={[0.03, 0.03, 26.2, 4]} />
                  <meshBasicMaterial color="#e2e8f0" />
                </mesh>
              )
            })}
          </group>
        </group>
        {/* etapa de descenso con sus ocho motores, y el rover debajo */}
        <group ref={etapa} position={[0, ETAPA_Y, 0]}>
          <pointLight position={[0, -2, 0]} color="#ff9a3c" distance={45} intensity={0} ref={luzMotores} />
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[2.3, 2.3, 0.9, 8]} />
            <meshStandardMaterial color="#b7bcc4" metalness={0.6} roughness={0.35} />
          </mesh>
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2 + Math.PI / 4
            return (
              <group key={i} position={[Math.cos(a) * 2.4, -0.1, Math.sin(a) * 2.4]}>
                {[-0.35, 0.35].map((d) => (
                  <group key={d} position={[-Math.sin(a) * d, 0, Math.cos(a) * d]}>
                    <Llama fuerza={frenado} radio={0.22} largo={2.6} conLuz={false} />
                  </group>
                ))}
              </group>
            )
          })}
          <group ref={cables} position={[0, ROVER_ARRIBA + 0.6, 0]}>
            {[0, 1, 2].map((i) => {
              const a = (i * Math.PI * 2) / 3
              return (
                <mesh key={i} position={[Math.cos(a) * 0.7, -0.5, Math.sin(a) * 0.7]}>
                  <cylinderGeometry args={[0.025, 0.025, 1, 4]} />
                  <meshBasicMaterial color="#d6d3d1" />
                </mesh>
              )
            })}
          </group>
          <group ref={rover} position={[0, ROVER_ARRIBA, 0]}>
            <mesh>
              <boxGeometry args={[3.2, 0.9, 2.2]} />
              <meshStandardMaterial color="#e7e5e4" metalness={0.2} roughness={0.6} />
            </mesh>
            {[-1.3, 0, 1.3].flatMap((px) =>
              [-1.25, 1.25].map((pz) => (
                <mesh key={`${px}${pz}`} position={[px, -0.55, pz]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.4, 0.4, 0.35, 14]} />
                  <meshStandardMaterial color="#44403c" roughness={0.9} />
                </mesh>
              )),
            )}
            <mesh position={[1.1, 1.1, 0]}>
              <boxGeometry args={[0.25, 1.4, 0.25]} />
              <meshStandardMaterial color="#d6d3d1" />
            </mesh>
          </group>
        </group>
        <group ref={masas}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i}>
              <boxGeometry args={[0.35, 0.35, 0.35]} />
              <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}
