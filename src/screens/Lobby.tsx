// Sala de espera: cada jugador elige su rol y personaliza su traje.
import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ROLES, ROLE_BY_ID, TRAJE_COLORES, TRAJE_VISORES, type Traje } from '@shared/types'
import { RolTag } from '../hud/comun'
import { Astronauta } from '../mundo/Astronauta'
import { api } from '../red'
import { useStore, useYo } from '../store'

function Giratorio({ traje, distintivo }: { traje: Traje; distintivo: string }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.6
  })
  return (
    <group ref={ref} position={[0, -1.05, 0]}>
      <Astronauta traje={traje} distintivo={distintivo} completo />
      <mesh position={[0, -0.03, 0]}>
        <cylinderGeometry args={[0.9, 1, 0.06, 40]} />
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  )
}

export function VistaTraje({ traje, distintivo }: { traje: Traje; distintivo: string }) {
  return (
    <div className="vista-traje">
      <Canvas camera={{ position: [0, 0.35, 4.3], fov: 34 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 5, 4]} intensity={1.7} />
        <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#7dd3fc" />
        <Giratorio traje={traje} distintivo={distintivo} />
      </Canvas>
    </div>
  )
}

function Muestras({ titulo, colores, actual, onElegir }: { titulo: string; colores: string[]; actual: string; onElegir: (c: string) => void }) {
  return (
    <div className="muestras">
      <span className="mini muted">{titulo}</span>
      <div className="row" style={{ gap: 5 }}>
        {colores.map((c) => (
          <button key={c} className={`muestra ${c === actual ? 'activa' : ''}`} style={{ background: c }} aria-label={`${titulo} ${c}`} onClick={() => onElegir(c)} />
        ))}
      </div>
    </div>
  )
}

export function LobbyScreen() {
  const sala = useStore((s) => s.sala)!
  const usuario = useStore((s) => s.usuario)
  const yo = useYo()
  const soyHost = sala.hostId === usuario?.id
  const conectados = sala.jugadores.filter((j) => j.conectado)
  const hayComandante = conectados.some((j) => j.rol === 'comandante')
  const todosConRol = conectados.every((j) => j.rol)
  const puedeIniciar = soyHost && hayComandante && todosConRol && conectados.length >= 2
  const aviso = !yo?.rol
    ? 'Elige un rol. Cada uno tiene responsabilidades y consecuencias distintas.'
    : !hayComandante
      ? 'Falta un comandante. Sin él nadie resuelve las decisiones en disputa.'
      : !todosConRol
        ? 'Esperando a que todos elijan rol.'
        : conectados.length < 2
          ? 'Se necesitan al menos 2 tripulantes. Comparte el código de la sala.'
          : soyHost
            ? 'Todo listo. Puedes iniciar la misión.'
            : 'Todo listo. Quien creó la sala iniciará la misión.'

  return (
    <div className="center-screen alto">
      <div className="card wide stack">
        <div className="row">
          <div className="grow">
            <div className="brand">Sala de tripulación</div>
            <h1 className="mono" style={{ letterSpacing: '0.2em' }}>{sala.codigo}</h1>
            <p className="muted">Comparte este código. Decisiones en disputa: {sala.modoDecision === 'comandante' ? 'las aprueba el comandante' : 'se votan por mayoría'}.</p>
          </div>
          <button onClick={() => api.salir()}>Salir</button>
        </div>

        <div className="lobby">
          <div className="stack">
            <h3>Elige tu rol</h3>
            <div className="roles-grid">
              {ROLES.map((r) => {
                const dueno = sala.jugadores.find((j) => j.rol === r.id)
                const esMio = dueno?.id === usuario?.id
                const tomado = Boolean(dueno) && !esMio
                return (
                  <button key={r.id} className={`role-card ${tomado ? 'taken' : ''} ${esMio ? 'mine' : ''}`} disabled={tomado} onClick={() => api.elegirRol(esMio ? null : r.id)}>
                    <div className="row">
                      <span className="tag" style={{ color: r.color }}>{r.corto}</span>
                      <strong className="grow">{r.nombre}</strong>
                      {dueno && <span className="muted">{esMio ? 'tú' : dueno.nombre}</span>}
                    </div>
                    <span className="muted">{r.descripcion}</span>
                    <span className="consecuencia">{r.consecuencias}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="stack lobby-lado">
            <h3>Tu astronauta</h3>
            {yo && (
              <>
                <VistaTraje traje={yo.traje} distintivo={yo.rol ? ROLE_BY_ID[yo.rol].color : '#94a3b8'} />
                <Muestras titulo="Traje" colores={TRAJE_COLORES} actual={yo.traje.color} onElegir={(color) => api.elegirTraje({ color })} />
                <Muestras titulo="Franjas" colores={TRAJE_COLORES} actual={yo.traje.acento} onElegir={(acento) => api.elegirTraje({ acento })} />
                <Muestras titulo="Visor" colores={TRAJE_VISORES} actual={yo.traje.visor} onElegir={(visor) => api.elegirTraje({ visor })} />
              </>
            )}
            <h3>Tripulación ({conectados.length})</h3>
            {sala.jugadores.map((j) => (
              <div key={j.id} className={`crew-card ${j.id === usuario?.id ? 'me' : ''} ${j.conectado ? '' : 'offline'}`}>
                <div className="row" style={{ gap: 6 }}>
                  <span className="punto" style={{ background: j.traje.color, borderColor: j.traje.acento }} />
                  <strong className="grow">{j.nombre}{j.id === sala.hostId ? ' (anfitrión)' : ''}</strong>
                  <RolTag rol={j.rol} />
                </div>
              </div>
            ))}
            <div className="assistant">{aviso}</div>
            <button className="primary" disabled={!puedeIniciar} onClick={() => api.iniciar()}>Iniciar misión</button>
          </div>
        </div>
      </div>
    </div>
  )
}
