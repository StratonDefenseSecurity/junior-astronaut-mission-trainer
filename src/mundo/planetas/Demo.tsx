// Vista de prueba: los tres globos uno al lado del otro, con la cámara girando despacio y el
// tiempo acelerado (1 hora de rotación por segundo) para ver el día, la noche y el giro.
// No está conectada al juego; sirve para revisarlos a ojo.
//   <DemoPlanetas />            → crea su propio <Canvas> (ocupa el contenedor)
//   <EscenaDemoPlanetas />      → solo el contenido, para meterlo en un <Canvas> existente
// Los tamaños NO están a escala (la Tierra mide 3.7 Lunas y 1.9 Martes).
import { useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Luna } from './Luna'
import { Marte } from './Marte'
import { Tierra } from './Tierra'
import { LUGARES_LUNA, LUGARES_MARTE, LUGARES_TIERRA } from './lugares'
import type { Marcador } from './Globo'

const marcar = (l: { nombre: string; lat: number; lon: number }, color?: string): Marcador => ({ nombre: l.nombre, lat: l.lat, lon: l.lon, color })

const EN_TIERRA: Marcador[] = [marcar(LUGARES_TIERRA.lambayeque, '#ffd34d'), marcar(LUGARES_TIERRA.lima, '#7dd3fc')]
const EN_MARTE: Marcador[] = [
  marcar(LUGARES_MARTE.olympusMons, '#fca5a5'),
  marcar(LUGARES_MARTE.vallesMarineris, '#fca5a5'),
  marcar(LUGARES_MARTE.hellas, '#fca5a5'),
  marcar(LUGARES_MARTE.curiosity, '#ffd34d'),
  marcar(LUGARES_MARTE.perseverance, '#ffd34d'),
  marcar(LUGARES_MARTE.hieloUtopia, '#7dd3fc'),
]
const EN_LUNA: Marcador[] = [marcar(LUGARES_LUNA.tranquillitatis, '#e2e8f0'), marcar(LUGARES_LUNA.tycho, '#e2e8f0')]

export function EscenaDemoPlanetas({ aceleracion = 3600 }: { aceleracion?: number }) {
  // Fecha que avanza `aceleracion` veces más rápido que el reloj real, desde que se monta.
  const fecha = useMemo(() => {
    const t0 = Date.now()
    const p0 = performance.now()
    return () => t0 + (performance.now() - p0) * aceleracion
  }, [aceleracion])

  useFrame(({ camera, clock }) => {
    const a = clock.elapsedTime * 0.08
    camera.position.set(Math.sin(a) * 9, 2.2 + Math.sin(a * 0.7) * 1.5, Math.cos(a) * 9)
    camera.lookAt(0, 0, 0)
  })

  return (
    <group>
      <Tierra radio={1.2} fecha={fecha} marcadores={EN_TIERRA} position={[-3.3, 0, 0]} />
      <Marte radio={1} fecha={fecha} marcadores={EN_MARTE} position={[0, 0, 0]} />
      <Luna radio={0.7} fecha={fecha} marcadores={EN_LUNA} position={[2.9, 0, 0]} />
    </group>
  )
}

export function DemoPlanetas({ aceleracion = 3600 }: { aceleracion?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <Canvas camera={{ position: [0, 2, 9], fov: 45, near: 0.01, far: 100 }} dpr={[1, 2]}>
        <color attach="background" args={['#000']} />
        <EscenaDemoPlanetas aceleracion={aceleracion} />
      </Canvas>
    </div>
  )
}
