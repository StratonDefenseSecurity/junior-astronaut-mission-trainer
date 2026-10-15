// Destello del Sol en la cámara: un resplandor con rayos, como en las fotos de los astronautas.
// Es un solo sprite que suma luz (sin posproceso, para las computadoras del colegio). Se apaga
// suave cuando el Sol queda detrás de un planeta, calculando si el rayo hacia el Sol lo cruza.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export interface Oclusor {
  /** Centro en coordenadas de mundo. */
  centro: THREE.Vector3
  /** Radio en unidades de mundo. */
  radio: number
}

/** Textura del destello: núcleo, halo ancho y seis rayos finos que se desvanecen. */
function texturaDestello(): THREE.CanvasTexture {
  const n = 256
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = n
  const c = lienzo.getContext('2d')!
  const m = n / 2
  const halo = c.createRadialGradient(m, m, 0, m, m, m)
  halo.addColorStop(0, 'rgba(255,250,235,1)')
  halo.addColorStop(0.04, 'rgba(255,244,220,0.9)')
  halo.addColorStop(0.15, 'rgba(255,225,180,0.25)')
  halo.addColorStop(0.45, 'rgba(255,200,150,0.06)')
  halo.addColorStop(1, 'rgba(255,190,140,0)')
  c.fillStyle = halo
  c.fillRect(0, 0, n, n)
  c.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + 0.3
    c.save()
    c.translate(m, m)
    c.rotate(a)
    const rayo = c.createLinearGradient(0, 0, m, 0)
    rayo.addColorStop(0, 'rgba(255,245,225,0.55)')
    rayo.addColorStop(1, 'rgba(255,245,225,0)')
    c.fillStyle = rayo
    c.beginPath()
    c.moveTo(0, -2.2)
    c.lineTo(m, 0)
    c.lineTo(0, 2.2)
    c.closePath()
    c.fill()
    c.restore()
  }
  const t = new THREE.CanvasTexture(lienzo)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const tmpCam = new THREE.Vector3()
const tmpHacia = new THREE.Vector3()
const tmpDir = new THREE.Vector3()

/**
 * `direccion`: dirección unitaria hacia el Sol en el mundo (se lee cada cuadro).
 * `oclusores`: planetas que pueden taparlo. `tamano`: alto del destello en fracción de la pantalla.
 * `encima`: se dibuja sobre todo, como el destello de una lente (en las cinemáticas). Sin él,
 * las paredes de la nave lo tapan (en la ventana).
 */
export function Destello({
  direccion,
  oclusores,
  tamano = 0.55,
  intensidad = 1,
  distancia = 1500,
  encima = false,
}: {
  direccion: () => THREE.Vector3 | null
  oclusores?: () => readonly Oclusor[]
  tamano?: number
  intensidad?: number
  distancia?: number
  encima?: boolean
}) {
  const sprite = useRef<THREE.Sprite>(null)
  const material = useMemo(
    () => new THREE.SpriteMaterial({ map: texturaDestello(), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: !encima, transparent: true, sizeAttenuation: false, fog: false }),
    [encima],
  )
  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
    },
    [material],
  )

  useFrame(({ camera }) => {
    const s = sprite.current
    if (!s) return
    const d = direccion()
    if (!d) {
      s.visible = false
      return
    }
    camera.getWorldPosition(tmpCam)
    tmpDir.copy(d).normalize()
    // Visibilidad: 1 si nada lo tapa; baja suave al acercarse el Sol al borde de un planeta.
    let ver = 1
    for (const o of oclusores?.() ?? []) {
      tmpHacia.subVectors(o.centro, tmpCam)
      const dist = tmpHacia.length()
      if (dist <= o.radio) {
        ver = 0
        break
      }
      const radioAng = Math.asin(Math.min(1, o.radio / dist))
      const sep = Math.acos(Math.max(-1, Math.min(1, tmpHacia.dot(tmpDir) / dist)))
      ver = Math.min(ver, THREE.MathUtils.smoothstep(sep - radioAng, -0.002, 0.012))
    }
    s.visible = ver > 0.01
    s.position.copy(tmpCam).addScaledVector(tmpDir, distancia)
    s.parent?.worldToLocal(s.position)
    s.scale.setScalar(tamano)
    material.opacity = ver * intensidad
  })

  return <sprite ref={sprite} material={material} renderOrder={10} />
}
