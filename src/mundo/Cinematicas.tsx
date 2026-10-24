// Escenas que no se caminan: el lanzamiento y el descenso a Marte.
// Siguen la telemetría real de la sala (altitud, etapa, aceleración). El Sol ilumina desde su
// dirección real para la fecha y el lugar, con un destello en la cámara cuando se ve.
// El ascenso reproduce el de Artemis I (shared/ascenso.ts) con el SLS y la plataforma 39B
// (SLS.tsx); el descenso, momento a momento, el de Perseverance (shared/edl.ts).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ASCENSO, altitudAscenso, distanciaAscenso, empujeRS25, empujeSRB, RUMBO_ASCENSO } from '@shared/ascenso'
import { calorEDL, EDL, estadoEDL, trayectoriaEDL } from '@shared/edl'
import { escenarioDe, fechaDeMision } from '@shared/escenarios'
import { DESCENSO_S, type RoomState } from '@shared/types'
import { factorMovimiento } from '../accesibilidad'
import { Cielo } from './cielo/Cielo'
import { orientacionSuperficie, vectorHelio } from './cielo/astro'
import { SITIOS_MARTE } from './cieloMarte'
import { Destello, type Oclusor } from './Destello'
import { NubesDespegue, ResplandorPlataforma } from './EfectosDespegue'
import { sonido } from '../sonido'
import { direccionSolEscena, Marte, Tierra } from './planetas'
import { CUBIERTA_M, PlataformaLC39B, posicionCohete, U, VehiculoSLS } from './SLS'

/** Complejo de lanzamiento 39B del Centro Espacial Kennedy (Florida), de donde salió Artemis I. */
const LC39B = { lat: 28.627, lon: -80.621 }
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
 * Altura (unidades de la escena) a la que queda el suelo bajo el cohete cuando la cámara lo
 * acompaña. Arriba es la escala real del globo (1 unidad = 3.19 km) y abajo se estira un poco.
 */
const bajadaTierra = (altKm: number) => altKm / 3.19 + 25 * (1 - Math.exp(-altKm / 5))
const R_TIERRA_KM = 6371

/** Hasta aquí se mira desde tierra, como las cámaras de seguimiento; después se acompaña al cohete. */
const T_ACOMPANA = 45

/**
 * Encuadres de la cámara que acompaña: [desde t, distancia, elevación (rad), giro alrededor del
 * cohete (rad, 0 = de costado), altura del punto mirado sobre la cubierta (m)]. Cada uno mira un
 * evento real: la separación de los propulsores, la del carenado y la torre, y la de la etapa central.
 */
const ENCUADRES: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [T_ACOMPANA, 52, -0.12, 0.45, 45],
  [ASCENSO.separacionSRB - 14, 58, 0.1, 0.08, 32],
  [ASCENSO.separacionSRB + 40, 44, 0.22, 0.5, 60],
  [ASCENSO.carenado - 8, 19, 0.16, 0.7, 86],
  [ASCENSO.torreEscape + 22, 58, 0.5, 0.95, 50],
  [ASCENSO.meco - 12, 46, 0.45, 0.3, 62],
  [ASCENSO.separacionCentral + 4, 34, 0.42, 0.45, 76],
]
const encuadre = (t: number) => [...ENCUADRES].reverse().find((e) => t >= e[0]) ?? ENCUADRES[0]

/**
 * Cámaras como en la transmisión de NASA TV, que cambian solas según la cronología: la plataforma,
 * la de seguimiento de largo alcance, la de a bordo que mira hacia atrás por la etapa central y la
 * de persecución. Con C el jugador las recorre (y vuelve a la automática).
 */
type ModoCamara = 'pad' | 'tracking' | 'onboard' | 'chase'
const NOMBRE_CAMARA: Record<ModoCamara, string> = { pad: 'Pad', tracking: 'Tracking', onboard: 'Onboard', chase: 'Chase' }
const PROGRAMA: ReadonlyArray<readonly [number, ModoCamara]> = [
  [-Infinity, 'pad'],
  [8, 'tracking'],
  [T_ACOMPANA, 'chase'],
  [ASCENSO.apagadoSRB - 6, 'onboard'],
  [ASCENSO.separacionSRB + 16, 'chase'],
  [300, 'onboard'],
  [345, 'chase'],
]
const camaraAuto = (t: number) => [...PROGRAMA].reverse().find((e) => t >= e[0])![1]
/** Las de tierra solo mientras el mundo queda quieto (antes de que la cámara acompañe al cohete). */
const camarasDisponibles = (t: number): ModoCamara[] => (t < T_ACOMPANA ? ['pad', 'tracking', 'onboard', 'chase'] : ['onboard', 'chase'])
/** Velocidad del sonido a nivel del mar, 343 m/s: el rugido llega tarde a las cámaras de tierra. */
const SONIDO_M_S = 343
const empujeTotal = (t: number) => Math.min(1, 0.78 * empujeSRB(t) + 0.32 * empujeRS25(t))

const EJE_Y = new THREE.Vector3(0, 1, 0)
const EJE_Z = new THREE.Vector3(0, 0, 1)
const tmpB = new THREE.Vector3()
const tmpArriba = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()
const tmpQ2 = new THREE.Quaternion()
const tmpV = new THREE.Vector3()
const tmpH = new THREE.Vector3()

export function Lanzamiento({ sala }: { sala: RoomState }) {
  const tiempo = useTiempoSuave(sala)
  const tierra = useRef<THREE.Group>(null)
  const plataforma = useRef<THREE.Group>(null)
  const cohete = useRef<THREE.Group>(null)
  const luzSol = useRef<THREE.DirectionalLight>(null)
  // Por encima de unos 40 km el cielo ya es negro y se empiezan a ver las estrellas.
  const brilloCielo = Math.min(0.75, Math.max(0, (sala.vuelo.altitud - 35) / 60))
  const cielo = useRef(new THREE.Color('#2f62b0'))
  const negro = useMemo(() => new THREE.Color('#02040a'), [])
  const azul = useMemo(() => new THREE.Color('#2f62b0'), [])
  const noche = useMemo(() => new THREE.Color('#0b1424'), [])
  const fecha = useMemo(() => fechaDeMision(escenarioDe(sala.escenario), 0), [sala.escenario])
  const orientacion = useMemo(() => orientacionSuperficie('Tierra', fecha, LC39B.lat, LC39B.lon), [fecha])
  const sol = useMemo(() => solLocal('tierra', fecha, orientacion), [fecha, orientacion])
  const solEscena = useRef(sol.clone())
  // Luz del día en la plataforma según la altura del Sol: el despegue puede ser de noche, como el
  // de Artemis I.
  const dia = THREE.MathUtils.smoothstep(sol.y, -0.1, 0.12)
  const centroTierra = useRef(new THREE.Vector3(0, -R_PLANETA, 0))
  const oclusores = useMemo<Oclusor[]>(() => [{ centro: centroTierra.current, radio: R_PLANETA }], [])
  // Rumbo real: el eje +X de la plataforma y del cohete apunta hacia donde vuela (este-noreste).
  const marco = useMemo(() => {
    const r = (RUMBO_ASCENSO * Math.PI) / 180
    const avance = new THREE.Vector3(Math.sin(r), 0, -Math.cos(r))
    return {
      avance,
      costado: EJE_Y.clone().cross(avance).normalize(),
      giroTierra: avance.clone().cross(EJE_Y).normalize(),
      guinada: new THREE.Quaternion().setFromAxisAngle(EJE_Y, Math.atan2(-avance.z, avance.x)),
    }
  }, [])
  const camara = useRef({ R: 50, e: 0, az: 0, ty: 40, listo: false })
  // null = cámara automática; si no, la que eligió el jugador con C.
  const elegida = useRef<ModoCamara | null>(null)
  const rotulo = useRef<HTMLDivElement | null>(null)
  const sonidoEnviado = useRef({ km: -1, cuando: 0 })
  const lienzo = useThree((s) => s.gl.domElement)
  // Rótulo de la cámara, como en la transmisión: arriba al centro del lienzo 3D.
  useEffect(() => {
    const padre = lienzo.parentElement
    if (!padre) return
    const d = document.createElement('div')
    d.title = 'Press C to change camera'
    d.setAttribute('aria-live', 'polite')
    Object.assign(d.style, {
      position: 'absolute',
      top: '72px', // debajo de la barra superior del HUD
      left: '50%',
      transform: 'translateX(-50%)',
      pointerEvents: 'none',
      zIndex: '1',
      font: '600 12px ui-monospace, Menlo, Consolas, monospace',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#fff',
      background: 'rgba(0,0,0,0.55)',
      padding: '3px 8px',
      borderRadius: '3px',
    })
    padre.appendChild(d)
    rotulo.current = d
    return () => {
      d.remove()
      rotulo.current = null
    }
  }, [lienzo])
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'c') return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      const lista: (ModoCamara | null)[] = [null, ...camarasDisponibles(tiempo())]
      elegida.current = lista[(lista.indexOf(elegida.current) + 1) % lista.length]
    }
    window.addEventListener('keydown', alPulsar)
    return () => {
      window.removeEventListener('keydown', alPulsar)
      sonido.parametros({ distanciaKm: 0 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const desdeTierra = sala.t < T_ACOMPANA
  const objetivo = useMemo(() => new THREE.Vector3(), [])
  useExposicion(1.05)
  const camaraEscena = useThree((s) => s.camera) as THREE.PerspectiveCamera
  useEffect(() => {
    const antes = { fov: camaraEscena.fov, far: camaraEscena.far }
    camaraEscena.far = Math.max(antes.far, 4000)
    camaraEscena.updateProjectionMatrix()
    return () => {
      camaraEscena.fov = antes.fov
      camaraEscena.far = antes.far
      camaraEscena.updateProjectionMatrix()
    }
  }, [camaraEscena])

  useFrame(({ camera, scene, clock }, delta) => {
    const cam = camera as THREE.PerspectiveCamera
    const t = tiempo()
    const tv = Math.max(0, t)
    const alt = altitudAscenso(tv)
    const p = posicionCohete(t)
    const acompana = t >= T_ACOMPANA
    // El cohete sube en vertical y se va tumbando hacia el rumbo.
    const qCohete = tmpQ.copy(marco.guinada).multiply(tmpQ2.setFromAxisAngle(EJE_Z, -p.inclinacion))
    const ti = tierra.current
    const co = cohete.current
    if (ti && co) {
      if (!acompana) {
        // Toma desde tierra: el mundo queda quieto y el cohete se aleja.
        ti.position.set(0, -R_PLANETA, 0)
        ti.quaternion.identity()
        co.position.set(p.x * U, p.y * U, 0).applyQuaternion(marco.guinada)
        co.position.y += CUBIERTA_M * U
      } else {
        // La cámara acompaña: el cohete queda en el centro, la Tierra baja y gira hacia atrás
        // tanto como la distancia recorrida sobre el suelo.
        ti.position.set(0, -R_PLANETA - CUBIERTA_M * U - bajadaTierra(alt), 0)
        ti.quaternion.setFromAxisAngle(marco.giroTierra, distanciaAscenso(tv) / R_TIERRA_KM)
        co.position.set(0, 0, 0)
      }
      co.quaternion.copy(qCohete)
      centroTierra.current.copy(ti.position)
      solEscena.current.copy(sol).applyQuaternion(ti.quaternion)
    }
    if (plataforma.current) plataforma.current.visible = !acompana
    if (luzSol.current) luzSol.current.position.copy(solEscena.current).multiplyScalar(100)

    // Cámara: la elegida por el jugador si se puede usar ahora; si no, la de la cronología.
    const disponibles = camarasDisponibles(t)
    if (elegida.current && !disponibles.includes(elegida.current)) elegida.current = null
    const auto = camaraAuto(t)
    const modo: ModoCamara = elegida.current ?? (disponibles.includes(auto) ? auto : 'chase')
    const enTierra = modo === 'pad' || modo === 'tracking'
    if (rotulo.current) {
      const texto = `CAMERA: ${NOMBRE_CAMARA[modo]}${elegida.current ? '' : ' · auto'}`
      if (rotulo.current.textContent !== texto) rotulo.current.textContent = texto
    }

    // Cielo azul de día (negro de noche) que se oscurece al subir, visto desde donde está la cámara.
    const altCielo = enTierra ? 0 : alt
    cielo.current.copy(noche).lerp(azul, dia).lerp(negro, 1 - Math.exp(-altCielo / 14))
    scene.background = cielo.current

    const fm = factorMovimiento()
    const vibra = t > -6.4 && t < ASCENSO.meco ? Math.min(1, sala.vuelo.g / 2.5) * fm : 0
    const temblor = (Math.random() - 0.5) * 0.1 * vibra
    const centro = tmpV.set(0, 40 * U, 0).applyQuaternion(qCohete)
    const base = tmpB.set(0, 0, 0)
    if (co) {
      centro.add(co.position)
      base.copy(co.position)
    }
    let mirarAbajo = true
    if (modo !== 'chase') camara.current.listo = false
    if (modo === 'pad' && t < -6.4) {
      // Cuenta regresiva: vuelta lenta alrededor de la plataforma, desde el suroeste.
      const a = 2.0 + (t + 12) * 0.025
      const r = 80 - (t + 12) * 0.5
      cam.position.set(Math.cos(a) * r, 5 + CUBIERTA_M * U, Math.sin(a) * r).applyQuaternion(marco.guinada)
      cam.fov = 50
      cam.lookAt(centro.x, centro.y - 2, centro.z)
    } else if (modo === 'pad') {
      // Cámara de la plataforma, a ras del suelo a unos 140 m: ve salir las nubes y sigue al
      // cohete hacia arriba cerrando el zoom.
      cam.position.set(55 * U, 2.5 * U, 128 * U).applyQuaternion(marco.guinada)
      tmpH.set(0, (12 + 30 * THREE.MathUtils.smoothstep(t, 0, 6)) * U, 0).applyQuaternion(qCohete).add(base)
      const d = cam.position.distanceTo(tmpH)
      cam.fov = THREE.MathUtils.clamp((2 * Math.atan2(62 * U, d) * 180) / Math.PI, 6, 58)
      cam.lookAt(tmpH)
    } else if (modo === 'tracking') {
      // Cámara de seguimiento a ~400 m al oeste: sigue al cohete y cierra el zoom a medida que se
      // aleja, como las cámaras de largo alcance.
      cam.position.set(-330 * U, 2 * U, 200 * U).applyQuaternion(marco.guinada)
      const d = cam.position.distanceTo(centro)
      cam.fov = THREE.MathUtils.clamp((2 * Math.atan2(30 + 0.012 * d, d) * 180) / Math.PI, 4, 50)
      cam.lookAt(centro.x, centro.y - 6, centro.z)
    } else if (modo === 'onboard') {
      // Cámara de a bordo en lo alto de la etapa central, mirando hacia atrás: el costado naranja,
      // los propulsores y, abajo, la Tierra.
      cam.position.set(0, 62 * U, 4.9 * U).applyQuaternion(qCohete).add(base)
      tmpH.set(0, -150 * U, 12 * U).applyQuaternion(qCohete).add(base)
      cam.up.copy(tmpArriba.set(0, 0, 1).applyQuaternion(qCohete))
      cam.fov = 72
      cam.lookAt(tmpH)
      cam.up.set(0, 1, 0)
      // La estructura vibra con el empuje.
      cam.rotateX((Math.random() - 0.5) * 0.004 * vibra)
      cam.rotateY((Math.random() - 0.5) * 0.004 * vibra)
      mirarAbajo = false
    } else {
      const [, R, e, az, ty] = encuadre(t)
      const c = camara.current
      if (!c.listo) Object.assign(c, { R, e, az, ty, listo: true })
      const k = 1 - Math.exp(-Math.min(0.1, delta) * 1.1)
      c.R += (R - c.R) * k
      c.e += (e - c.e) * k
      c.az += (az + 0.08 * Math.sin(clock.elapsedTime * 0.07) - c.az) * k
      c.ty += (ty - c.ty) * k
      objetivo.set(0, c.ty * U, 0).applyQuaternion(qCohete).add(base)
      tmpH.copy(marco.costado).multiplyScalar(Math.cos(c.az)).addScaledVector(marco.avance, -Math.sin(c.az))
      cam.position.copy(objetivo).addScaledVector(tmpH, Math.cos(c.e) * c.R).addScaledVector(EJE_Y, Math.sin(c.e) * c.R)
      // Nunca por debajo del suelo.
      const suelo = acompana ? -CUBIERTA_M * U - bajadaTierra(alt) + 3 : 1
      if (cam.position.y < suelo) cam.position.y = suelo
      cam.position.x += temblor
      cam.position.y += temblor
      cam.fov = 50
      cam.lookAt(objetivo)
    }

    // Desde tierra el rugido llega con el retraso del sonido, y con él tiembla el suelo.
    const distanciaM = enTierra ? cam.position.distanceTo(base) / U : 0
    if (enTierra && fm > 0) {
      const llega = empujeTotal(t - distanciaM / SONIDO_M_S) * Math.min(1, 260 / Math.max(1, distanciaM))
      const amp = 0.012 * llega * (cam.fov / 50)
      cam.rotateX((Math.random() - 0.5) * amp)
      cam.rotateY((Math.random() - 0.5) * amp * 0.7)
    }
    const km = Math.round(distanciaM / 10) / 100
    const ahora = clock.elapsedTime
    if (km !== sonidoEnviado.current.km && ahora - sonidoEnviado.current.cuando > 0.1) {
      sonido.parametros({ distanciaKm: km })
      sonidoEnviado.current = { km, cuando: ahora }
    }

    // El panel de telemetría tapa la parte baja de la pantalla: se baja un poco la mirada para que
    // el cohete quede en la mitad de arriba.
    if (mirarAbajo) cam.rotateX((-cam.fov * Math.PI * 0.17) / 180)
    cam.updateProjectionMatrix()
  })

  return (
    <group>
      {/* el Sol en su dirección real; abajo, la luz azulada que devuelve la Tierra */}
      <directionalLight ref={luzSol} position={sol.clone().multiplyScalar(100).toArray()} intensity={2.6 * Math.max(0.05, THREE.MathUtils.smoothstep(sol.y, -0.08, 0.05))} color="#fff4e6" />
      <hemisphereLight args={['#9cc4ff', '#2a4a7a', 0.25 + 0.35 * dia]} />
      <ambientLight intensity={0.1} />
      <CieloDespegue fecha={fecha} orientacion={orientacion} brillo={brilloCielo} />
      <Destello direccion={() => solEscena.current} oclusores={() => oclusores} encima />
      {/* la Tierra real, con la plataforma 39B arriba; baja y gira hacia atrás mientras se sube */}
      <group ref={tierra} position={[0, -R_PLANETA, 0]}>
        <group quaternion={orientacion}>
          {/* desde el suelo el halo de la atmósfera, pensado para verse desde el espacio, tiñe todo el cielo */}
          <Tierra radio={R_PLANETA} fecha={fecha} detalle="alto" etiquetas={false} atmosfera={!desdeTierra} />
        </group>
        <group ref={plataforma} position={[0, R_PLANETA + CUBIERTA_M * U, 0]} quaternion={marco.guinada} scale={U}>
          <PlataformaLC39B tiempo={tiempo} noche={1 - dia} />
          <NubesDespegue tiempo={tiempo} noche={1 - dia} sol={() => solEscena.current} sueloY={-CUBIERTA_M} />
          <ResplandorPlataforma tiempo={tiempo} sueloY={-CUBIERTA_M} />
        </group>
      </group>
      <group ref={cohete} position={[0, CUBIERTA_M * U, 0]} quaternion={marco.guinada}>
        <group scale={U}>
          <VehiculoSLS tiempo={tiempo} noche={1 - dia} />
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
    const temblor = (Math.random() - 0.5) * 0.25 * Math.min(1, sala.vuelo.g / 3) * factorMovimiento()
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
