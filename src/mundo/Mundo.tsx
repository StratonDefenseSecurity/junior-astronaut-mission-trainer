// El mundo 3D: elige la escena según la fase y la zona, mueve al personaje propio con la
// cámara en tercera persona y dibuja a los compañeros donde están.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ROLE_BY_ID, type Player, type RoomState } from '@shared/types'
import { ajenos } from '../red'
import { useStore } from '../store'
import { Astronauta, type Pose } from './Astronauta'
import { Descenso, Lanzamiento } from './Cinematicas'
import { controlesDeCamara, entrarEnZona, local, palanca, tecla, useTeclado } from './control'
import { Exterior } from './Exterior'
import { Interior } from './Interior'
import { ALCANCE, ENTRADA, ESTACIONES, INTERIOR, PUESTO, PUESTO_REFUGIO, estacionVisible, estacionesDestacadas, limitarPosicion } from './mapa'

function Etiqueta({ j, propio }: { j: Player; propio: boolean }) {
  const rol = j.rol ? ROLE_BY_ID[j.rol] : null
  const estado = j.incapacitado > 0 ? 'fuera de servicio' : j.enRefugio ? 'en el refugio' : j.manual === 'sueno' ? 'durmiendo' : j.manual === 'ejercicio' ? 'ejercicio' : null
  return (
    <div className={`nombre ${propio ? 'propio' : ''} ${j.ayuda ? 'ayuda' : ''}`} style={{ borderColor: rol?.color }}>
      {j.ayuda && <b>! </b>}
      {j.nombre}
      {rol && <span style={{ color: rol.color }}> {rol.corto}</span>}
      {estado && <i> · {estado}</i>}
    </div>
  )
}

/** El personaje que controla este jugador, con la cámara detrás. */
function Jugador({ sala, yo }: { sala: RoomState; yo: Player }) {
  const pose = useRef<Pose>({ x: local.x, z: local.z, giro: local.giro, andando: 0, paso: 0 })
  const destino = useMemo(() => new THREE.Vector3(), [])
  const mira = useMemo(() => new THREE.Vector3(), [])
  const salaRef = useRef(sala)
  salaRef.current = sala
  const yoRef = useRef(yo)
  yoRef.current = yo

  useFrame(({ camera }, dtBruto) => {
    const dt = Math.min(0.05, dtBruto)
    const s = salaRef.current
    const j = yoRef.current
    const visible = (id: string) => estacionVisible(s, id)

    // ---- Movimiento ----
    let adelante = (tecla('KeyW') || tecla('ArrowUp') ? 1 : 0) - (tecla('KeyS') || tecla('ArrowDown') ? 1 : 0) + palanca.y
    let lado = (tecla('KeyD') ? 1 : 0) - (tecla('KeyA') ? 1 : 0) + palanca.x
    if (tecla('ArrowLeft')) local.camGiro += dt * 2.2
    if (tecla('ArrowRight')) local.camGiro -= dt * 2.2
    const quieto = j.enRefugio || j.incapacitado > 0
    if (quieto) {
      adelante = 0
      lado = 0
      if (j.enRefugio) {
        local.x = PUESTO_REFUGIO.x
        local.z = PUESTO_REFUGIO.z
      }
    }
    const fuerza = Math.min(1, Math.hypot(adelante, lado))
    if (fuerza > 0.08) {
      // Adelante es hacia donde mira la cámara.
      const fx = -Math.sin(local.camGiro)
      const fz = -Math.cos(local.camGiro)
      const rx = Math.cos(local.camGiro)
      const rz = -Math.sin(local.camGiro)
      let dx = fx * adelante + rx * lado
      let dz = fz * adelante + rz * lado
      const n = Math.hypot(dx, dz) || 1
      dx /= n
      dz /= n
      let v = tecla('ShiftLeft') || tecla('ShiftRight') ? 5.6 : 3.4
      if (local.zona === 'exterior') v *= 0.8
      if (j.vit.fatiga > 85) v *= 0.7
      v *= fuerza
      const [x, z] = limitarPosicion(local.zona, local.x + dx * v * dt, local.z + dz * v * dt, visible)
      local.x = x
      local.z = z
      local.giro = Math.atan2(dx, dz)
      local.vel = v
      local.paso += dt * v * 2.6
    } else {
      local.vel = 0
    }
    const p = pose.current
    p.x = local.x
    p.z = local.z
    p.giro = local.giro
    p.andando += ((local.vel > 0.2 ? 1 : 0) - p.andando) * Math.min(1, dt * 10)
    p.paso = local.paso

    // ---- Cámara en tercera persona ----
    const cosA = Math.cos(local.camAltura)
    mira.set(local.x, 1.55, local.z)
    destino.set(
      local.x + Math.sin(local.camGiro) * cosA * local.camDistancia,
      1.55 + Math.sin(local.camAltura) * local.camDistancia,
      local.z + Math.cos(local.camGiro) * cosA * local.camDistancia,
    )
    if (local.zona === 'nave') {
      // Dentro, la cámara no puede salirse de las paredes.
      destino.x = Math.min(INTERIOR.x1 - 0.3, Math.max(INTERIOR.x0 + 0.3, destino.x))
      destino.z = Math.min(INTERIOR.z1 - 0.25, Math.max(INTERIOR.z0 + 0.25, destino.z))
      destino.y = Math.min(INTERIOR.alto - 0.2, Math.max(0.5, destino.y))
    } else destino.y = Math.max(0.6, destino.y)
    camera.position.lerp(destino, 1 - Math.exp(-dt * 12))
    camera.lookAt(mira)

    // ---- Estación al alcance ----
    let cerca: string | null = null
    let mejor = ALCANCE
    for (const e of ESTACIONES) {
      if (e.zona !== local.zona || !visible(e.id)) continue
      const d = Math.hypot(e.x - local.x, e.z - local.z) - e.radio
      if (d < mejor) {
        mejor = d
        cerca = e.id
      }
    }
    const st = useStore.getState()
    st.setCerca(quieto ? null : cerca)
    // La página principal y los paneles abiertos desde ella no dependen de dónde esté el personaje.
    if (st.estacion && st.estacion !== 'principal' && !st.remoto) {
      const e = ESTACIONES.find((x) => x.id === st.estacion)
      if (!e || e.zona !== local.zona || Math.hypot(e.x - local.x, e.z - local.z) - e.radio > ALCANCE + 1.4) st.abrirEstacion(null)
    }
  })

  return (
    <Astronauta
      traje={yo.traje}
      distintivo={yo.rol ? ROLE_BY_ID[yo.rol].color : '#ffffff'}
      completo={yo.zona === 'exterior'}
      tumbado={yo.incapacitado > 0}
      pose={() => pose.current}
      etiqueta={<Etiqueta j={yo} propio />}
    />
  )
}

/** Un compañero: sigue con suavidad la última posición que envió. */
function Companero({ j, indice }: { j: Player; indice: number }) {
  const pose = useRef<Pose | null>(null)
  const jRef = useRef(j)
  jRef.current = j
  const calcular = (dt: number): Pose => {
    const x = jRef.current
    const a = ajenos.get(x.id)
    const fresca = a && performance.now() - a.t < 8000 && x.conectado
    let tx: number
    let tz: number
    let giro = 0
    if (x.enRefugio) {
      tx = PUESTO_REFUGIO.x + (indice % 3) * 0.7 - 0.7
      tz = PUESTO_REFUGIO.z - Math.floor(indice / 3) * 0.7
      giro = Math.PI
    } else if (fresca) {
      tx = a.x
      tz = a.z
      giro = a.giro
    } else if (x.zona === 'nave') {
      const p = PUESTO[x.rol ?? 'comandante']
      tx = p.x
      tz = p.z
      giro = p.z < 0 ? Math.PI : 0
    } else {
      tx = ENTRADA.exterior.x + 1.5 + indice * 1.1
      tz = ENTRADA.exterior.z + 2.5
    }
    const actual = pose.current
    if (!actual) return (pose.current = { x: tx, z: tz, giro, andando: 0, paso: 0 })
    const k = 1 - Math.exp(-dt * 7)
    const dx = (tx - actual.x) * k
    const dz = (tz - actual.z) * k
    actual.x += dx
    actual.z += dz
    const rapidez = Math.hypot(dx, dz) / Math.max(dt, 0.001)
    actual.andando += ((rapidez > 0.35 ? 1 : 0) - actual.andando) * Math.min(1, dt * 8)
    actual.paso += dt * Math.min(5, rapidez) * 2.6
    if (rapidez > 0.35) actual.giro = Math.atan2(dx, dz)
    else if (fresca) actual.giro = giro
    return actual
  }
  const dtRef = useRef(0.016)
  useFrame((_, dt) => {
    dtRef.current = Math.min(0.05, dt)
    calcular(dtRef.current)
  })
  return (
    <Astronauta
      traje={j.traje}
      distintivo={j.rol ? ROLE_BY_ID[j.rol].color : '#ffffff'}
      completo={j.zona === 'exterior'}
      tumbado={j.incapacitado > 0 || (j.actividad === 'sueno' && !j.conectado)}
      pose={() => pose.current ?? calcular(0.016)}
      etiqueta={<Etiqueta j={j} propio={false} />}
    />
  )
}

/** Solo en desarrollo: deja avanzar fotogramas desde la consola cuando la pestaña no se dibuja sola. */
function Depuracion() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    const w = window as unknown as { __mt?: Record<string, unknown> }
    if (import.meta.env.DEV && w.__mt) w.__mt.three = get
  }, [get])
  return null
}

export function Mundo({ sala, yo }: { sala: RoomState; yo: Player }) {
  useTeclado()
  const cerca = useStore((s) => s.cerca)
  const cinematica = sala.fase === 'lanzamiento' || (sala.fase === 'llegada' && sala.subfase === 'descenso')
  const destacadas = useMemo(() => estacionesDestacadas(sala, yo), [sala, yo])
  const camara = useMemo(() => controlesDeCamara(), [])

  // Al cruzar la esclusa (o si el servidor lo mueve), el personaje aparece en la otra zona.
  useEffect(() => {
    if (yo.zona !== local.zona) entrarEnZona(yo.zona)
  }, [yo.zona])
  // Tras una escena de vuelo, cada uno aparece en su puesto.
  const fase = sala.fase === 'llegada' ? `llegada-${sala.subfase}` : sala.fase
  useEffect(() => {
    if (fase === 'transito' || fase === 'ensamblaje') {
      const p = PUESTO[yo.rol ?? 'comandante']
      local.zona = 'nave'
      local.x = p.x
      local.z = p.z
      local.camGiro = Math.PI / 2
      local.camDistancia = 4.4
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase])

  const companeros = sala.jugadores.filter((j) => j.rol && j.id !== yo.id && j.zona === yo.zona)

  return (
    <div className="mundo" {...(cinematica ? {} : camara)}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [10, 3, 0], fov: 58, near: 0.1, far: 3200 }}>
        <Suspense fallback={null}>
          <Depuracion />
          {sala.fase === 'lanzamiento' && <Lanzamiento sala={sala} />}
          {sala.fase === 'llegada' && sala.subfase === 'descenso' && <Descenso sala={sala} />}
          {!cinematica && yo.zona === 'nave' && <Interior sala={sala} cerca={cerca} destacadas={destacadas} />}
          {!cinematica && yo.zona === 'exterior' && <Exterior sala={sala} cerca={cerca} destacadas={destacadas} />}
          {!cinematica && <Jugador sala={sala} yo={yo} />}
          {!cinematica && companeros.map((j, i) => <Companero key={j.id} j={j} indice={i} />)}
        </Suspense>
      </Canvas>
    </div>
  )
}
