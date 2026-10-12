// Sala de espera: se reúne la tripulación y cada uno personaliza su traje. Los roles no se
// eligen aquí: se asignan en la contextualización, cuando ya conocen la situación.
import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRAJE_COLORES, TRAJE_VISORES, type Traje } from '@shared/types'
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

/** El recorrido de la misión, en el orden del esquema del equipo. */
const RECORRIDO = [
  { titulo: 'Contextualización', texto: 'Se les da la situación que tienen que afrontar. Después cada uno recibe su rol, se establece el objetivo y eligen los suministros.' },
  { titulo: 'Lanzamiento', texto: 'El despegue, el combustible y la energía que se gastan, y los días y horas que llevan en el espacio.' },
  { titulo: 'Llegar a la base y administrar recursos', texto: 'Montar la base y cuidar el agua, el oxígeno, los alimentos, la energía, los equipos y a la tripulación.' },
  { titulo: 'Emergencias', texto: 'Llega una alerta, se identifica el problema y se decide entre varias alternativas.' },
]

export function LobbyScreen() {
  const sala = useStore((s) => s.sala)!
  const usuario = useStore((s) => s.usuario)
  const yo = useYo()
  const soyHost = sala.hostId === usuario?.id
  const presentes = sala.jugadores.filter((j) => j.conectado)
  const puedeIniciar = soyHost && presentes.length >= 2
  const anfitrion = sala.jugadores.find((j) => j.id === sala.hostId)?.nombre ?? 'Quien creó la sala'
  const aviso =
    presentes.length < 2
      ? 'Se necesitan al menos 2 tripulantes. Comparte el código de la sala.'
      : soyHost
        ? 'Ya pueden empezar. Lo primero que verán es la situación que tienen que afrontar.'
        : `Esperando a que ${anfitrion} empiece la misión.`

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
            <h3>Tripulación ({presentes.length} de 6)</h3>
            <div className="crew-lista">
              {sala.jugadores.map((j) => (
                <div key={j.id} className={`crew-card ${j.id === usuario?.id ? 'me' : ''} ${j.conectado ? '' : 'offline'}`}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="punto" style={{ background: j.traje.color, borderColor: j.traje.acento }} />
                    <strong className="grow">{j.nombre}{j.id === usuario?.id ? ' (tú)' : ''}</strong>
                    <span className="mini muted">{j.id === sala.hostId ? 'anfitrión' : j.conectado ? 'en la sala' : 'ausente'}</span>
                  </div>
                </div>
              ))}
            </div>

            <h3>Cómo será la misión</h3>
            <ol className="recorrido">
              {RECORRIDO.map((r, i) => (
                <li key={r.titulo} className={i === 0 ? 'siguiente' : ''}>
                  <strong>{r.titulo}</strong>
                  <span>{r.texto}</span>
                </li>
              ))}
            </ol>
            <p className="mini muted">Un asistente acompaña toda la misión: consulta el estado real y explica los riesgos de cada decisión.</p>
          </div>

          <div className="stack lobby-lado">
            <h3>Tu astronauta</h3>
            {yo && (
              <>
                <VistaTraje traje={yo.traje} distintivo="#94a3b8" />
                <Muestras titulo="Traje" colores={TRAJE_COLORES} actual={yo.traje.color} onElegir={(color) => api.elegirTraje({ color })} />
                <Muestras titulo="Franjas" colores={TRAJE_COLORES} actual={yo.traje.acento} onElegir={(acento) => api.elegirTraje({ acento })} />
                <Muestras titulo="Visor" colores={TRAJE_VISORES} actual={yo.traje.visor} onElegir={(visor) => api.elegirTraje({ visor })} />
              </>
            )}
            <div className="assistant">{aviso}</div>
            <button className="primary" disabled={!puedeIniciar} onClick={() => api.iniciar()}>Empezar la misión</button>
          </div>
        </div>
      </div>
    </div>
  )
}
