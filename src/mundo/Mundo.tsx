// El mundo 3D: elige la escena según la fase y la zona, mueve al personaje propio con la
// cámara en tercera persona y dibuja a los compañeros donde están.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useGraficos } from '../graficos'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CIUDAD_BY_ID } from '@shared/escenarios'
import { ROLE_BY_ID, type Player, type RoomState } from '@shared/types'
import { MarcaIA } from '../hud/comun'
import { ajenos, api } from '../red'
import { useStore } from '../store'
import { sonido } from '../sonido'
import { voz } from '../voz'
import { useState } from 'react'
import { Astronauta, avanzarPaso, type Accion, type Pose } from './Astronauta'
import { Descenso, Lanzamiento } from './Cinematicas'
import { controlesDeCamara, entrarEnZona, local, palanca, tecla, useTeclado } from './control'
import { Exterior } from './Exterior'
import { Interior, enMicrogravedad } from './Interior'
import { ALCANCE, ENTRADA, ESTACIONES, ESTACION_BY_ID, EXTERIOR, INTERIOR, PUESTO, PUESTO_REFUGIO, PUNTOS, estacionVisible, estacionesDestacadas, limitarPosicion } from './mapa'

/** Ondas junto al nombre mientras esa persona habla por el chat de voz. */
function Habla({ id }: { id: string }) {
  const [si, setSi] = useState(false)
  useEffect(() => {
    const t = window.setInterval(() => setSi(voz.hablando(id)), 150)
    return () => window.clearInterval(t)
  }, [id])
  return si ? <span className="habla" aria-label="talking"> 🔊</span> : null
}

function Etiqueta({ j, propio }: { j: Player; propio: boolean }) {
  const rol = j.rol ? ROLE_BY_ID[j.rol] : null
  const estado = j.incapacitado > 0 ? 'out of action' : j.enRefugio ? 'in the shelter' : j.manual === 'sueno' ? 'sleeping' : j.manual === 'ejercicio' ? 'exercising' : null
  return (
    <div className={`nombre ${propio ? 'propio' : ''} ${j.ayuda ? 'ayuda' : ''}`} style={{ borderColor: rol?.color }}>
      {j.ayuda && <b>! </b>}
      {j.nombre}
      {rol && <span style={{ color: rol.color }}> {rol.corto}</span>}
      <MarcaIA bot={j.bot} />
      {estado && <i> · {estado}</i>}
      <Habla id={j.id} />
    </div>
  )
}

/** Banderas de tres franjas para el hombro, según el país de la ciudad de origen. */
const BANDERAS: Record<string, { colores: string[]; vertical: boolean }> = {
  Peru: { colores: ['#d91023', '#ffffff', '#d91023'], vertical: true },
  Mexico: { colores: ['#006847', '#ffffff', '#ce1126'], vertical: true },
  Ecuador: { colores: ['#fcd116', '#fcd116', '#003893', '#ce1126'], vertical: false },
  Colombia: { colores: ['#fcd116', '#fcd116', '#003893', '#ce1126'], vertical: false },
  Bolivia: { colores: ['#d52b1e', '#f9e300', '#007934'], vertical: false },
  Argentina: { colores: ['#74acdf', '#ffffff', '#74acdf'], vertical: false },
  Spain: { colores: ['#aa151b', '#f1bf00', '#f1bf00', '#aa151b'], vertical: false },
  Chile: { colores: ['#ffffff', '#d52b1e'], vertical: false },
}
const banderaDe = (j: Player) => {
  const c = j.hogar ? CIUDAD_BY_ID[j.hogar as keyof typeof CIUDAD_BY_ID] : null
  return c ? (BANDERAS[c.pais] ?? null) : null
}

type Gravedad = 'tierra' | 'marte' | 'cero'
const gravedadDe = (sala: RoomState): Gravedad => (enMicrogravedad(sala) ? 'cero' : sala.tAterrizaje > 0 ? 'marte' : 'tierra')

/** Puesto fijo y animación de quien está haciendo algo concreto (ejercicio, dormir, refugio). */
function puestoDeActividad(sala: RoomState, j: Player, indice: number): { x: number; z: number; giro: number; y: number; accion: Accion } | null {
  const micro = enMicrogravedad(sala)
  if (j.zona !== 'nave') return null
  if (j.enRefugio) return { x: PUESTO_REFUGIO.x + (indice % 3) * 0.7 - 0.7, z: PUESTO_REFUGIO.z - Math.floor(indice / 3) * 0.6 + 0.3, giro: Math.PI, y: 0, accion: 'refugio' }
  if (j.manual === 'ejercicio') {
    // El primero en la cinta, el siguiente en la bicicleta.
    const antes = sala.jugadores.filter((o) => o.manual === 'ejercicio' && o.zona === 'nave' && o.id < j.id).length
    const p = antes % 2 === 0 ? PUNTOS.cinta : PUNTOS.bici
    return { x: p.x, z: p.z, giro: p.giro, y: p === PUNTOS.cinta ? 0.15 : 0.16, accion: p === PUNTOS.cinta ? 'correr' : 'bici' }
  }
  if (j.manual === 'sueno') {
    if (micro) {
      const p = PUNTOS.sacos[indice % PUNTOS.sacos.length]
      return { x: p.x, z: p.z, giro: p.giro, y: 0.18, accion: 'dormir' }
    }
    const p = PUNTOS.literas[indice % PUNTOS.literas.length]
    return { x: p.x, z: p.z + 0.05, giro: p.giro, y: p.y + 0.1, accion: 'dormir' }
  }
  return null
}

/** El personaje que controla este jugador, con la cámara detrás. */
function Jugador({ sala, yo }: { sala: RoomState; yo: Player }) {
  const pose = useRef<Pose>({ x: local.x, z: local.z, giro: local.giro, andando: 0, paso: 0, y: 0, accion: 'pie' })
  const destino = useMemo(() => new THREE.Vector3(), [])
  const mira = useMemo(() => new THREE.Vector3(), [])
  const salaRef = useRef(sala)
  salaRef.current = sala
  const yoRef = useRef(yo)
  yoRef.current = yo
  const cancelando = useRef(0)
  const ultimoPaso = useRef(0)
  const gravedad = gravedadDe(sala)
  const indice = Math.max(0, sala.jugadores.filter((j) => j.rol).findIndex((j) => j.id === yo.id))

  useFrame(({ camera, clock }, dtBruto) => {
    const dt = Math.min(0.05, dtBruto)
    const s = salaRef.current
    const j = yoRef.current
    const visible = (id: string) => estacionVisible(s, id)
    const sinGravedad = enMicrogravedad(s) && local.zona === 'nave'
    const st = useStore.getState()

    // ---- Entrada ----
    let adelante = (tecla('KeyW') || tecla('ArrowUp') ? 1 : 0) - (tecla('KeyS') || tecla('ArrowDown') ? 1 : 0) + palanca.y
    let lado = (tecla('KeyD') ? 1 : 0) - (tecla('KeyA') ? 1 : 0) + palanca.x
    if (tecla('ArrowLeft')) local.camGiro += dt * 2.2
    if (tecla('ArrowRight')) local.camGiro -= dt * 2.2
    const quieto = j.enRefugio || j.incapacitado > 0
    const fuerza = quieto ? 0 : Math.min(1, Math.hypot(adelante, lado))

    // Moverse interrumpe el ejercicio o el sueño, como en la vida real: hay que dejarlo.
    const actividad = puestoDeActividad(s, j, indice)
    if (actividad && fuerza > 0.3 && (j.manual === 'ejercicio' || j.manual === 'sueno') && clock.elapsedTime - cancelando.current > 2) {
      cancelando.current = clock.elapsedTime
      void api.actividad(null)
    }

    let dx = 0
    let dz = 0
    if (fuerza > 0.08 && !(actividad && j.manual)) {
      // Adelante es hacia donde mira la cámara.
      const fx = -Math.sin(local.camGiro)
      const fz = -Math.cos(local.camGiro)
      const rx = Math.cos(local.camGiro)
      const rz = -Math.sin(local.camGiro)
      dx = fx * adelante + rx * lado
      dz = fz * adelante + rz * lado
      const n = Math.hypot(dx, dz) || 1
      dx /= n
      dz /= n
    } else {
      adelante = 0
      lado = 0
    }

    if (actividad) {
      // Se coloca en su puesto y hace la actividad.
      local.x += (actividad.x - local.x) * Math.min(1, dt * 6)
      local.z += (actividad.z - local.z) * Math.min(1, dt * 6)
      local.y += (actividad.y - local.y) * Math.min(1, dt * 6)
      local.giro = actividad.giro
      local.vel = 0
      local.vx = local.vz = 0
    } else if (sinGravedad) {
      // Sin gravedad uno se impulsa en los pasamanos y sigue deslizándose: hay inercia.
      const empuje = 3.2 * fuerza
      local.vx += dx * empuje * dt
      local.vz += dz * empuje * dt
      const roce = Math.exp(-dt * (fuerza > 0.08 ? 0.6 : 1.1))
      local.vx *= roce
      local.vz *= roce
      const v = Math.hypot(local.vx, local.vz)
      const maxima = tecla('ShiftLeft') || tecla('ShiftRight') ? 3.2 : 2.2
      if (v > maxima) {
        local.vx *= maxima / v
        local.vz *= maxima / v
      }
      const [x, z] = limitarPosicion(local.zona, local.x + local.vx * dt, local.z + local.vz * dt, visible)
      if (x !== local.x + local.vx * dt) local.vx *= -0.3
      if (z !== local.z + local.vz * dt) local.vz *= -0.3
      local.x = x
      local.z = z
      local.vel = Math.hypot(local.vx, local.vz)
      if (local.vel > 0.15) local.giro = Math.atan2(local.vx, local.vz)
      local.y += (0.38 - local.y) * Math.min(1, dt * 2)
      local.paso += dt
    } else if (fuerza > 0.08) {
      let v = tecla('ShiftLeft') || tecla('ShiftRight') ? 5.6 : 3.4
      if (local.zona === 'exterior') v *= 0.8
      if (j.vit.fatiga > 85) v *= 0.7
      v *= fuerza
      const [x, z] = limitarPosicion(local.zona, local.x + dx * v * dt, local.z + dz * v * dt, visible)
      local.x = x
      local.z = z
      local.giro = Math.atan2(dx, dz)
      local.vel = v
      local.paso = avanzarPaso(local.paso, v, dt, local.zona === 'nave' ? gravedad : 'marte')
      local.y += (0 - local.y) * Math.min(1, dt * 8)
    } else {
      local.vel = 0
      local.y += (0 - local.y) * Math.min(1, dt * 8)
    }
    if (j.enRefugio) {
      local.x = PUESTO_REFUGIO.x
      local.z = PUESTO_REFUGIO.z
    }

    // ¿Trabaja en una consola? Mira hacia la estación cuyo panel tiene abierto.
    const panel = st.estacion && st.estacion !== 'principal' && !st.remoto ? ESTACION_BY_ID[st.estacion] : null
    local.trabajando = Boolean(panel && panel.zona === local.zona && !actividad && local.vel < 0.2)
    if (local.trabajando && panel) local.giro = Math.atan2(panel.x - local.x, panel.z - local.z)

    // Un paso suena cada medio ciclo de la zancada.
    if (!sinGravedad && local.vel > 0.5 && Math.floor(local.paso / Math.PI) !== ultimoPaso.current) {
      ultimoPaso.current = Math.floor(local.paso / Math.PI)
      sonido.evento('paso', { superficie: local.zona === 'exterior' ? 'marte' : 'interior', volumen: 0.5 })
    }

    const p = pose.current
    p.x = local.x
    p.z = local.z
    p.y = local.y
    p.giro = local.giro
    p.andando += ((local.vel > 0.2 ? 1 : 0) - p.andando) * Math.min(1, dt * 10)
    p.velocidad = (p.velocidad ?? 0) + (local.vel - (p.velocidad ?? 0)) * Math.min(1, dt * 6)
    p.paso = local.paso
    p.accion = actividad?.accion ?? (local.trabajando ? 'consola' : sinGravedad ? 'flotar' : 'pie')

    // ---- Cámara en tercera persona ----
    const cosA = Math.cos(local.camAltura)
    const alturaOjos = 1.55 + local.y * 0.8
    mira.set(local.x, alturaOjos, local.z)
    destino.set(
      local.x + Math.sin(local.camGiro) * cosA * local.camDistancia,
      alturaOjos + Math.sin(local.camAltura) * local.camDistancia,
      local.z + Math.cos(local.camGiro) * cosA * local.camDistancia,
    )
    if (local.zona === 'nave') {
      // Dentro, la cámara no puede salirse de las paredes.
      destino.x = Math.min(INTERIOR.x1 - 0.3, Math.max(INTERIOR.x0 + 0.3, destino.x))
      destino.z = Math.min(INTERIOR.z1 - 0.3, Math.max(INTERIOR.z0 + 0.3, destino.z))
      destino.y = Math.min(INTERIOR.alto - 0.2, Math.max(0.5, destino.y))
    } else {
      destino.y = Math.max(0.6, destino.y)
      // Fuera, la cámara no puede quedar dentro del hábitat: se la saca por el lado más cercano.
      const hx = EXTERIOR.habX + 0.4
      const hz = EXTERIOR.habZ + 0.4
      if (Math.abs(destino.x) < hx && Math.abs(destino.z) < hz && destino.y < 5.4) {
        if (hx - Math.abs(destino.x) < hz - Math.abs(destino.z)) destino.x = Math.sign(destino.x || 1) * hx
        else destino.z = Math.sign(destino.z || 1) * hz
      }
    }
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
      gravedad={yo.zona === 'nave' ? gravedad : 'marte'}
      bandera={banderaDe(yo)}
      pose={() => pose.current}
      etiqueta={<Etiqueta j={yo} propio />}
    />
  )
}

/** Un compañero: sigue con suavidad la última posición que envió. */
function Companero({ sala, j, indice }: { sala: RoomState; j: Player; indice: number }) {
  const pose = useRef<Pose | null>(null)
  const jRef = useRef(j)
  jRef.current = j
  const salaRef = useRef(sala)
  salaRef.current = sala
  const indiceCrew = Math.max(0, sala.jugadores.filter((x) => x.rol).findIndex((x) => x.id === j.id))
  const gravedad = gravedadDe(sala)
  const calcular = (dt: number): Pose => {
    const x = jRef.current
    const s = salaRef.current
    const a = ajenos.get(x.id)
    const fresca = a && performance.now() - a.t < 8000 && x.conectado
    const actividad = puestoDeActividad(s, x, indiceCrew)
    const sinGravedad = enMicrogravedad(s) && x.zona === 'nave'
    let tx: number
    let tz: number
    let ty = 0
    let giro = 0
    let accion: Accion = sinGravedad ? 'flotar' : 'pie'
    if (actividad) {
      tx = actividad.x
      tz = actividad.z
      ty = actividad.y
      giro = actividad.giro
      accion = actividad.accion
    } else if (fresca) {
      tx = a.x
      tz = a.z
      giro = a.giro
      if (a.trabajando) accion = 'consola'
    } else if (x.zona === 'nave') {
      const p = PUESTO[x.rol ?? 'comandante']
      tx = p.x
      tz = p.z
      giro = p.z < 0 ? Math.PI : 0
      // Quien no está jugando ahora descansa en su puesto, o duerme si es de noche.
      if (!x.conectado && x.actividad === 'sueno') {
        const d = puestoDeActividad(s, { ...x, manual: 'sueno' }, indice)
        if (d) {
          tx = d.x
          tz = d.z
          ty = d.y
          giro = d.giro
          accion = 'dormir'
        }
      }
    } else {
      tx = ENTRADA.exterior.x + 1.5 + indice * 1.1
      tz = ENTRADA.exterior.z + 2.5
    }
    if (sinGravedad && accion === 'flotar') ty = 0.38
    const actual = pose.current
    if (!actual) return (pose.current = { x: tx, z: tz, giro, andando: 0, paso: 0, y: ty, accion })
    const k = 1 - Math.exp(-dt * 7)
    const dx = (tx - actual.x) * k
    const dz = (tz - actual.z) * k
    actual.x += dx
    actual.z += dz
    actual.y = (actual.y ?? 0) + (ty - (actual.y ?? 0)) * k
    actual.accion = accion
    // Se anima igual que el propio jugador, a partir de su rapidez (suavizada, porque las
    // posiciones llegan a saltos con cada consulta al servidor).
    const rapidez = dt > 0 ? Math.min(6, Math.hypot(dx, dz) / dt) : 0
    const v = (actual.velocidad ?? 0) + (rapidez - (actual.velocidad ?? 0)) * Math.min(1, dt * 5)
    actual.velocidad = accion === 'pie' ? v : 0
    actual.andando += ((v > 0.35 && accion === 'pie' ? 1 : 0) - actual.andando) * Math.min(1, dt * 8)
    actual.paso = sinGravedad ? actual.paso + dt : avanzarPaso(actual.paso, v, dt, x.zona === 'nave' ? gravedadDe(s) : 'marte')
    if (v > 0.35 && !actividad && Math.hypot(dx, dz) > 1e-4) actual.giro = Math.atan2(dx, dz)
    else if (v <= 0.35) actual.giro = giro
    return actual
  }
  useFrame((_, dt) => {
    calcular(Math.min(0.05, dt))
  })
  return (
    <Astronauta
      traje={j.traje}
      distintivo={j.rol ? ROLE_BY_ID[j.rol].color : '#ffffff'}
      completo={j.zona === 'exterior'}
      tumbado={j.incapacitado > 0}
      gravedad={j.zona === 'nave' ? gravedad : 'marte'}
      bandera={banderaDe(j)}
      pose={() => pose.current ?? calcular(0.016)}
      etiqueta={<Etiqueta j={j} propio={false} />}
    />
  )
}

/** Coloca el oído (la cámara) y las voces de los compañeros en cada cuadro. */
function OidoVoz({ sala, yo }: { sala: RoomState; yo: Player }) {
  const otros = useMemo(() => new Map<string, { x: number; z: number; fuera: boolean }>(), [])
  const adelante = useMemo(() => new THREE.Vector3(), [])
  const salaRef = useRef(sala)
  salaRef.current = sala
  useFrame(({ camera }) => {
    otros.clear()
    for (const j of salaRef.current.jugadores) {
      // Los bots no hablan por la voz.
      if (j.id === yo.id || j.bot) continue
      const a = ajenos.get(j.id)
      otros.set(j.id, { x: a?.x ?? 0, z: a?.z ?? 0, fuera: j.zona === 'exterior' || j.zona !== yo.zona })
    }
    camera.getWorldDirection(adelante)
    voz.actualizar({ x: camera.position.x, y: camera.position.y, z: camera.position.z, adelante }, yo.zona === 'exterior', otros)
  })
  return null
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
  const calidad = useGraficos((s) => s.calidad)

  return (
    <div className="mundo" {...(cinematica ? {} : camara)}>
      <Canvas shadows={calidad === 'alta'} dpr={calidad === 'alta' ? [1, 1.5] : [0.75, 1]} camera={{ position: [10, 3, 0], fov: 58, near: 0.1, far: 3200 }}>
        <Suspense fallback={null}>
          <Depuracion />
          {sala.fase === 'lanzamiento' && <Lanzamiento sala={sala} />}
          {sala.fase === 'llegada' && sala.subfase === 'descenso' && <Descenso sala={sala} />}
          {!cinematica && yo.zona === 'nave' && <Interior sala={sala} cerca={cerca} destacadas={destacadas} />}
          {!cinematica && yo.zona === 'exterior' && <Exterior sala={sala} cerca={cerca} destacadas={destacadas} />}
          {!cinematica && <Jugador sala={sala} yo={yo} />}
          <OidoVoz sala={sala} yo={yo} />
          {!cinematica && companeros.map((j, i) => <Companero key={j.id} sala={sala} j={j} indice={i} />)}
        </Suspense>
      </Canvas>
    </div>
  )
}
