// Las obras de la base en operación vistas por fuera: el módulo inflable, las bolsas de regolito
// sobre el refugio, la plataforma de aterrizaje con su carguero y la antena apuntada a la Tierra.
// Formas simples y baratas; aparecen según el estado de cada obra (shared/procedimientos.ts).
import { useMemo } from 'react'
import * as THREE from 'three'
import { obraHecha, tierraEnCielo } from '@shared/procedimientos'
import type { RoomState } from '@shared/types'
import { ESTACION_BY_ID, REFUGIO } from './mapa'

const GRADO = Math.PI / 180

/** Módulo inflable junto al hábitat: plegado mientras no se infla, del tamaño de BEAM cuando ya está. */
function Modulo({ sala }: { sala: RoomState }) {
  const e = sala.procedimientos?.inflable
  const inflado = obraHecha(sala, 'inflable') || (e?.paso ?? 0) >= 3
  if (sala.fase !== 'base' && !inflado) return null
  return (
    <group position={[-3, 0, 0]}>
      {/* túnel hasta la escotilla del hábitat */}
      <mesh position={[0, 1.6, 3.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 1.2, 16]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>
      {inflado ? (
        <mesh position={[0, 1.65, 6.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[1.6, 2.4, 8, 20]} />
          <meshStandardMaterial color="#efe9dc" roughness={0.95} />
        </mesh>
      ) : (
        <mesh position={[0, 0.6, 5.4]} castShadow>
          <boxGeometry args={[1.6, 1.2, 1.6]} />
          <meshStandardMaterial color="#e7dfcf" roughness={0.95} />
        </mesh>
      )}
    </group>
  )
}

/** Filas de bolsas de regolito sobre el casco, encima del refugio. */
function Bolsas({ sala }: { sala: RoomState }) {
  const cm = sala.efectos?.regolitoCm ?? 0
  const bolsas = useMemo(() => {
    const lista: { p: [number, number, number]; r: number }[] = []
    for (let x = REFUGIO.x0 + 0.3; x <= REFUGIO.x1 - 0.2; x += 0.65) {
      for (let k = -3; k <= 3; k++) {
        const a = k * 0.32
        lista.push({ p: [x, 1.7 + 3.62 * Math.cos(a), 3.62 * Math.sin(a)], r: -a })
      }
    }
    return lista
  }, [])
  if (!cm) return null
  const alto = Math.max(0.12, cm / 100)
  return (
    <group>
      {bolsas.map((b, i) => (
        <mesh key={i} position={b.p} rotation={[b.r, 0, 0]}>
          <boxGeometry args={[0.6, alto, 1.1]} />
          <meshStandardMaterial color={i % 2 ? '#a0522d' : '#b5653a'} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/** Plataforma de aterrizaje marcada con balizas y, cuando aterriza, el carguero. */
function Pista({ sala }: { sala: RoomState }) {
  const e = ESTACION_BY_ID.pista
  const ef = sala.efectos ?? {}
  if (!ef.carguero) return null
  return (
    <group position={[e.x, 0, e.z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[4, 32]} />
        <meshStandardMaterial color="#c98b62" roughness={1} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[Math.cos((k * Math.PI) / 2) * 4.3, 0.3, Math.sin((k * Math.PI) / 2) * 4.3]}>
          <cylinderGeometry args={[0.08, 0.1, 0.6, 8]} />
          <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[1.3, 1.6, 2.6, 16]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.9, 0]}>
        <coneGeometry args={[1.3, 0.9, 16]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.4} roughness={0.5} />
      </mesh>
      {[0, 1, 2, 3].map((k) => {
        const a = (k * Math.PI) / 2 + Math.PI / 4
        return (
          <mesh key={k} position={[Math.cos(a) * 1.7, 0.6, Math.sin(a) * 1.7]} rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]}>
            <cylinderGeometry args={[0.07, 0.07, 1.5, 6]} />
            <meshStandardMaterial color="#6b7280" metalness={0.6} />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * Antena de alta ganancia apuntada: el plato mira al acimut y la elevación donde quedó, o sigue a
 * la Tierra mientras está sobre el horizonte si se activó el seguimiento por efemérides.
 */
export function AntenaApuntada({ sala }: { sala: RoomState }) {
  const e = ESTACION_BY_ID.antena
  const ef = sala.efectos ?? {}
  // La Tierra se mueve despacio: basta recalcularla cada pocos minutos de misión.
  const paso = Math.floor(sala.t / 300)
  const giro = useMemo(() => {
    const t = ef.antenaSigue ? tierraEnCielo(sala) : null
    const az = (t && t.el > 0 ? t.az : (ef.antenaAz ?? 0)) * GRADO
    const el = Math.max(0, t && t.el > 0 ? t.el : (ef.antenaEl ?? 30)) * GRADO
    // El eje del plato (+z) apunta a (sen az cos el, sen el, −cos az cos el): el norte es −z.
    return new THREE.Euler(-el, Math.PI - az, 0, 'YXZ')
  }, [paso, ef.antenaSigue, ef.antenaAz, ef.antenaEl])
  return (
    <group position={[e.x, 0, e.z]}>
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.14, 4, 10]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
      </mesh>
      <group position={[0, 4.1, 0]} rotation={giro}>
        <mesh position={[0, 0, 1.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[1.1, 20, 10, 0, Math.PI * 2, 0, 0.9]} />
          <meshStandardMaterial color="#e2e8f0" side={THREE.DoubleSide} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.4, 6]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </group>
    </group>
  )
}

/** Todas las obras visibles por fuera. */
export function ObrasExterior({ sala }: { sala: RoomState }) {
  return (
    <>
      <Modulo sala={sala} />
      <Bolsas sala={sala} />
      <Pista sala={sala} />
    </>
  )
}
