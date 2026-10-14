// Componente común de los tres globos: orienta la esfera con la rotación real del cuerpo para
// la fecha de la misión, la ilumina desde la dirección del Sol, agrega la capa de nubes y el
// halo de atmósfera (si los tiene) y dibuja los marcadores con sus etiquetas.
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { latLonAVector, msDeFecha, RelojCuerpo, type CuerpoGlobo, type Fecha } from './orientacion'
import { materialAtmosfera, materialMarcadores, materialNubes, materialSuperficie, type UniformsAtmosfera, type UniformsSuperficie } from './materiales'
import { PROVISIONAL, type Detalle } from './texturas'

export interface Marcador {
  /** Latitud planetocéntrica (grados, +N). */
  lat: number
  /** Longitud planetocéntrica (grados, +E). */
  lon: number
  nombre: string
  /** Color CSS del punto (por defecto, amarillo). */
  color?: string
}

/** Props comunes de <Tierra>, <Marte> y <Luna>. */
export interface PropsGlobo {
  /** Radio en unidades de la escena (por defecto 1). */
  radio?: number
  /**
   * Fecha y hora de la misión: Date, milisegundos Unix o una función que devuelve cualquiera
   * de los dos (se lee en cada cuadro, así el globo gira sin re-renderizar React).
   */
  fecha: Fecha
  /**
   * Dirección unitaria del planeta hacia el Sol, en coordenadas del grupo PADRE del globo.
   * Si no se pasa, se calcula con astronomy-engine para la fecha, en el marco de la escena
   * (correcto si el padre no está girado respecto de la escena).
   */
  direccionSol?: THREE.Vector3
  /** Puntos con nombre sobre la superficie (se ocultan cuando quedan del otro lado). */
  marcadores?: readonly Marcador[]
  /** 'alto' (por defecto) o 'bajo': resolución de texturas y de la malla. */
  detalle?: Detalle
  /** Mostrar los nombres de los marcadores (por defecto sí). */
  etiquetas?: boolean
  /** Posición del centro del globo en el grupo padre. */
  position?: [number, number, number]
  /** Luz mínima del lado nocturno (0 = negro total). Por defecto 0.012. */
  brilloNoche?: number
}

/** Configuración interna de cada cuerpo. */
export interface ConfigGlobo {
  cuerpo: CuerpoGlobo
  mapa: THREE.Texture
  relieve: THREE.Texture
  nubes: THREE.Texture | null
  /** Bruma sobre el disco (color y fuerza). */
  bruma: { color: string; fuerza: number }
  /** Halo del limbo; H es la escala de altura como fracción del radio. */
  atmosfera: { color: string; ocaso: string; intensidad: number; H: number } | null
  /** Altura de la capa de nubes como fracción del radio. */
  alturaNubes: number
}

const esferas = new Map<number, THREE.SphereGeometry>()
function esfera(segmentos: number) {
  let g = esferas.get(segmentos)
  if (!g) {
    g = new THREE.SphereGeometry(1, segmentos, segmentos / 2)
    esferas.set(segmentos, g)
  }
  return g
}

const tmpQ = new THREE.Quaternion()
const tmpV = new THREE.Vector3()
const tmpCam = new THREE.Vector3()
const tmpEscala = new THREE.Vector3()
const tmpSol = new THREE.Vector3()
const tmpPunto = new THREE.Vector3()
const tmpNormal = new THREE.Vector3()
const tmpHaciaCam = new THREE.Vector3()

export function Globo({ config, props, children }: { config: ConfigGlobo; props: PropsGlobo; children?: ReactNode }) {
  const { radio = 1, fecha, direccionSol, marcadores, detalle = 'alto', etiquetas = true, position, brilloNoche = 0.012 } = props
  const raiz = useRef<THREE.Group>(null)
  const orientado = useRef<THREE.Group>(null)
  const atm = useRef<THREE.Mesh>(null)
  const etiquetasRef = useRef<(HTMLDivElement | null)[]>([])
  const reloj = useMemo(() => new RelojCuerpo(config.cuerpo), [config.cuerpo])

  const superficie = useMemo(
    () => materialSuperficie(config.cuerpo, { mapa: config.mapa, relieve: config.relieve, nubes: config.nubes ?? PROVISIONAL.sinNubes, atm: config.bruma.color, atmFuerza: config.bruma.fuerza }),
    // Las texturas se cambian abajo sin recrear el material.
    [config.cuerpo],
  )
  const nubes = useMemo(() => (config.nubes ? materialNubes(config.nubes) : null), [config.nubes !== null])
  const halo = useMemo(
    () => (config.atmosfera ? materialAtmosfera(config.atmosfera.color, config.atmosfera.ocaso, config.atmosfera.intensidad) : null),
    [config.atmosfera?.color, config.atmosfera?.ocaso, config.atmosfera?.intensidad],
  )
  const puntos = useMemo(() => materialMarcadores(9), [])
  useEffect(() => () => superficie.dispose(), [superficie])
  useEffect(() => () => nubes?.dispose(), [nubes])
  useEffect(() => () => halo?.dispose(), [halo])
  useEffect(() => () => puntos.dispose(), [puntos])

  // Texturas: llegan cuando el worker termina (antes hay unas provisionales de 1×1).
  useEffect(() => {
    const u = superficie.uniforms as UniformsSuperficie
    u.uMapa.value = config.mapa
    u.uRelieve.value = config.relieve
    u.uNubes.value = config.nubes ?? PROVISIONAL.sinNubes
    if (nubes && config.nubes) nubes.uniforms.uNubes.value = config.nubes
  }, [superficie, nubes, config.mapa, config.relieve, config.nubes])

  // Geometría de los marcadores: un solo objeto de puntos para todos.
  const geoPuntos = useMemo(() => {
    const lista = marcadores ?? []
    const pos = new Float32Array(lista.length * 3)
    const col = new Float32Array(lista.length * 3)
    const c = new THREE.Color()
    lista.forEach((m, i) => {
      latLonAVector(m.lat, m.lon, 1.003, tmpV).toArray(pos, i * 3)
      c.set(m.color ?? '#ffd34d').toArray(col, i * 3)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [marcadores])
  useEffect(() => () => geoPuntos.dispose(), [geoPuntos])

  const segmentos = detalle === 'alto' ? 160 : 64

  useFrame(({ camera, size, gl }) => {
    const r = raiz.current
    const o = orientado.current
    if (!r || !o) return
    // 1) Giro real del planeta para la fecha.
    reloj.actualizar(msDeFecha(fecha))
    o.quaternion.copy(reloj.cuaternion)
    o.updateMatrixWorld()

    // 2) Sol: del marco del padre al mundo.
    r.getWorldQuaternion(tmpQ)
    tmpSol
      .copy(direccionSol ?? reloj.sol)
      .applyQuaternion(tmpQ)
      .normalize()
    const us = superficie.uniforms as UniformsSuperficie
    us.uSol.value.copy(tmpSol)
    us.uAmbiente.value = brilloNoche
    if (nubes) {
      nubes.uniforms.uSol.value.copy(tmpSol)
      nubes.uniforms.uAmbiente.value = brilloNoche
    }

    // 3) Tamaño en pantalla: detalle fino de cerca y grosor mínimo del halo de lejos.
    r.getWorldPosition(tmpV)
    r.getWorldScale(tmpEscala)
    const escala = tmpEscala.x
    const R = radio * escala
    tmpCam.setFromMatrixPosition(camera.matrixWorld)
    const dist = Math.max(tmpCam.distanceTo(tmpV), R * 1.0001)
    const fov = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? (camera as THREE.PerspectiveCamera).fov : 50
    const pixel = (dist * 2 * Math.tan((fov * Math.PI) / 360)) / Math.max(1, size.height)
    const radioPx = R / pixel
    const alt = (dist - R) / R
    const cerca = 1 - THREE.MathUtils.smoothstep(alt, 0.12, 0.6)
    us.uDetalle.value = cerca
    if (nubes) nubes.uniforms.uDetalle.value = cerca
    puntos.uniforms.uTam.value = 9 * gl.getPixelRatio()

    if (halo && atm.current && config.atmosfera) {
      // H real del halo, pero nunca más fino que ~0.7 píxeles para que se vea de lejos.
      const H = Math.max(config.atmosfera.H * R, pixel * 0.7)
      const Ra = R + 7 * H
      atm.current.scale.setScalar(Ra / escala)
      const ua = halo.uniforms as UniformsAtmosfera
      ua.uSol.value.copy(tmpSol)
      ua.uCentro.value.copy(tmpV)
      ua.uRadio.value = R
      ua.uRadioAtm.value = Ra
      ua.uH.value = H
      // De lejos el halo es una línea fina; se le da un poco más de brillo para que se note.
      ua.uIntensidad.value = config.atmosfera.intensidad * (H > config.atmosfera.H * R * 1.5 ? 1.4 : 1)
    }

    // 4) Etiquetas: solo las del lado que mira a la cámara, y si el planeta no es un puntito.
    const lista = marcadores ?? []
    for (let i = 0; i < lista.length; i++) {
      const el = etiquetasRef.current[i]
      if (!el) continue
      latLonAVector(lista[i].lat, lista[i].lon, radio, tmpPunto).applyMatrix4(o.matrixWorld)
      tmpNormal.subVectors(tmpPunto, tmpV)
      tmpHaciaCam.subVectors(tmpCam, tmpPunto)
      const visible = etiquetas && radioPx > 40 && tmpNormal.dot(tmpHaciaCam) > 0
      const d = visible ? '' : 'none'
      if (el.style.display !== d) el.style.display = d
    }
  })

  return (
    <group ref={raiz} position={position}>
      <group ref={orientado}>
        <mesh geometry={esfera(segmentos)} material={superficie} scale={radio} />
        {nubes && <mesh geometry={esfera(segmentos)} material={nubes} scale={radio * (1 + config.alturaNubes)} renderOrder={1} />}
        {(marcadores?.length ?? 0) > 0 && <points geometry={geoPuntos} material={puntos} scale={radio} renderOrder={3} />}
        {marcadores?.map((m, i) => (
          <Html
            key={`${m.nombre}-${i}`}
            position={latLonAVector(m.lat, m.lon, radio * 1.004).toArray()}
            ref={(el) => {
              etiquetasRef.current[i] = el
            }}
            zIndexRange={[20, 0]}
            pointerEvents="none"
            style={{ display: 'none' }}
          >
            <div
              style={{
                transform: 'translate(9px, -50%)',
                font: '600 11px/1.2 system-ui, sans-serif',
                color: '#f8fafc',
                background: 'rgba(8, 15, 30, 0.72)',
                border: `1px solid ${m.color ?? '#ffd34d'}`,
                borderRadius: 4,
                padding: '2px 6px',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}
            >
              {m.nombre}
            </div>
          </Html>
        ))}
        {children}
      </group>
      {halo && <mesh ref={atm} geometry={esfera(64)} material={halo} renderOrder={2} />}
    </group>
  )
}
