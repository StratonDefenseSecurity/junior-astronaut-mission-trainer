// Sala de espera: se reúne la tripulación y cada uno personaliza su traje. Los roles no se
// eligen aquí: se asignan en la contextualización, cuando ya conocen la situación.
import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CIUDADES, CIUDAD_BY_ID, ESCENARIOS, ESCENARIO_BY_ID, fechaLarga, type CiudadId, type EscenarioId } from '@shared/escenarios'
import { PEINADOS, TRAJE_COLORES, TRAJE_PELOS, TRAJE_PIELES, TRAJE_VISORES, type Traje } from '@shared/types'
import { MarcaIA } from '../hud/comun'
import { ComprobacionConexion } from '../hud/Conexion'
import { Astronauta } from '../mundo/Astronauta'
import { api } from '../red'
import { useStore, useYo } from '../store'
import { DificultadLobby } from './DificultadLobby'
import { BotonAccesibilidad } from '../hud/Accesibilidad'

function Giratorio({ traje, distintivo }: { traje: Traje; distintivo: string }) {
  const ref = useRef<THREE.Group>(null)
  // Gira de un lado a otro para que casi siempre se le vea la cara.
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.45) * 1.1
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
      <Canvas camera={{ position: [0, 0.42, 2.7], fov: 30 }} dpr={[1, 2]}>
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
  { titulo: 'Mission Briefing', texto: 'You get the situation your crew must face. Then each of you gets a role, you set the objective and you choose the supplies.' },
  { titulo: 'Launch', texto: 'Liftoff, the fuel and energy you use, and the days and hours you spend in space.' },
  { titulo: 'Reach the Base and Manage Resources', texto: 'Build the base and look after the water, oxygen, food, power, equipment and crew.' },
  { titulo: 'Emergencies', texto: 'An alert comes in. You find the problem and choose between several options.' },
]

/** Nombre de la misión: lo pone el anfitrión; los demás lo ven. */
function NombreMision({ editable }: { editable: boolean }) {
  const actual = useStore((s) => s.sala?.nombreMision ?? '')
  const [texto, setTexto] = useState(actual)
  useEffect(() => setTexto(actual), [actual])
  const guardar = () => {
    if (texto.trim() !== actual) void api.nombrarMision(texto)
  }
  if (!editable) return <h1 className="titulo-mision">{actual || 'Unnamed mission'}</h1>
  return (
    <label className="stack" style={{ gap: 3 }}>
      <input
        className="titulo-mision"
        value={texto}
        maxLength={28}
        placeholder="Name your mission"
        aria-label="Mission name"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
      <span className="mini muted">Mission name. The commander can change it in the briefing.</span>
    </label>
  )
}

export function LobbyScreen() {
  const sala = useStore((s) => s.sala)!
  const usuario = useStore((s) => s.usuario)
  const yo = useYo()
  const soyHost = sala.hostId === usuario?.id
  const solo = sala.modoJuego === 'solo'
  const presentes = sala.jugadores.filter((j) => j.conectado)
  const puedeIniciar = soyHost && (solo || presentes.length >= 2 || Boolean(sala.rellenarBots))
  const anfitrion = sala.jugadores.find((j) => j.id === sala.hostId)?.nombre ?? 'The host'
  const aviso = solo
    ? 'Your AI crew is already here. You pick your role first and they cover the rest.'
    : presentes.length < 2
      ? 'You need at least 2 crew members. Share the room code.'
      : soyHost
        ? 'You can start now. First you will see the situation your crew must face.'
        : `Waiting for ${anfitrion} to start the mission.`

  return (
    <div className="center-screen alto">
      <div className="card wide stack">
        <div className="row">
          <div className="grow">
            <div className="brand">Crew Room</div>
            <NombreMision editable={soyHost} />
            <p className="muted">
              Room code <strong className="mono codigo-sala">{sala.codigo}</strong>. {solo ? 'Single player with bots.' : 'Share this code so others can join.'} Disputed decisions: {sala.modoDecision === 'comandante' ? 'the Mission Commander approves them' : 'majority vote'}.
            </p>
          </div>
          <div className="stack" style={{ gap: 6, alignItems: 'flex-end', maxWidth: 340 }}>
            <div className="row" style={{ gap: 6 }}>
              <BotonAccesibilidad />
              <button onClick={() => api.salir()}>Leave</button>
            </div>
            <ComprobacionConexion />
          </div>
        </div>

        <div className="lobby">
          <div className="stack">
            <h3>Crew ({presentes.length} of 6)</h3>
            <div className="crew-lista">
              {sala.jugadores.map((j) => (
                <div key={j.id} className={`crew-card ${j.id === usuario?.id ? 'me' : ''} ${j.conectado ? '' : 'offline'}`}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="punto" style={{ background: j.traje.color, borderColor: j.traje.acento }} />
                    <strong className="grow">
                      {j.nombre}
                      {j.id === usuario?.id ? ' (you)' : ''}
                      <MarcaIA bot={j.bot} />
                    </strong>
                    <span className="mini muted">
                      {j.bot ? (j.hogar ? CIUDAD_BY_ID[j.hogar as CiudadId]?.nombre : 'crew member') : j.id === sala.hostId ? 'host' : j.conectado ? 'in the room' : 'away'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <h3>The situation {soyHost ? '· you choose it' : ''}</h3>
            <div className="escenarios">
              <button className={`opcion ${sala.escenarioElegido === 'azar' ? 'activa' : ''}`} disabled={!soyHost} onClick={() => api.escenario('azar')}>
                <strong>Let Mission Control pick</strong>
                <small>One of the six situations, at random. Nobody knows which one until you start.</small>
              </button>
              {ESCENARIOS.map((e) => (
                <button key={e.id} className={`opcion ${sala.escenarioElegido === e.id ? 'activa' : ''}`} disabled={!soyHost} onClick={() => api.escenario(e.id)}>
                  <strong>{e.nombre}</strong>
                  <small>{e.lema} Liftoff: {fechaLarga(new Date(e.lanzamiento))}.</small>
                </button>
              ))}
            </div>
            {!soyHost && (
              <p className="mini muted">
                {sala.escenarioElegido === 'azar' ? 'The situation will be assigned when you start.' : `Chosen situation: ${ESCENARIO_BY_ID[sala.escenarioElegido as EscenarioId]?.nombre}.`}
              </p>
            )}

            <DificultadLobby sala={sala} soyHost={soyHost} />

            <h3>How the mission works</h3>
            <ol className="recorrido">
              {RECORRIDO.map((r, i) => (
                <li key={r.titulo} className={i === 0 ? 'siguiente' : ''}>
                  <strong>{r.titulo}</strong>
                  <span>{r.texto}</span>
                </li>
              ))}
            </ol>
            <p className="mini muted">An assistant helps you through the whole mission. It checks the real status and explains the risks of each decision.</p>
          </div>

          <div className="stack lobby-lado">
            <h3>Your astronaut</h3>
            {yo && (
              <>
                <VistaTraje traje={yo.traje} distintivo="#94a3b8" />
                <Muestras titulo="Skin" colores={TRAJE_PIELES} actual={yo.traje.piel} onElegir={(piel) => api.elegirTraje({ piel })} />
                <Muestras titulo="Hair" colores={TRAJE_PELOS} actual={yo.traje.pelo} onElegir={(pelo) => api.elegirTraje({ pelo })} />
                <div className="muestras">
                  <span className="mini muted">Hairstyle</span>
                  <div className="row" style={{ gap: 4 }}>
                    {PEINADOS.map((x) => (
                      <button key={x.id} className={`chip ${yo.traje.peinado === x.id ? 'activo' : ''}`} onClick={() => api.elegirTraje({ peinado: x.id })}>
                        {x.nombre}
                      </button>
                    ))}
                  </div>
                </div>
                <Muestras titulo="Suit" colores={TRAJE_COLORES} actual={yo.traje.color} onElegir={(color) => api.elegirTraje({ color })} />
                <Muestras titulo="Stripes" colores={TRAJE_COLORES} actual={yo.traje.acento} onElegir={(acento) => api.elegirTraje({ acento })} />
                <Muestras titulo="Helmet visor" colores={TRAJE_VISORES} actual={yo.traje.visor} onElegir={(visor) => api.elegirTraje({ visor })} />
                <label className="stack" style={{ gap: 3 }}>
                  <span className="mini muted">Your city: it will be marked on Earth, and messages from home will come from there</span>
                  <select value={yo.hogar ?? ''} onChange={(e) => api.hogar(e.target.value || null)}>
                    <option value="">Not chosen</option>
                    {CIUDADES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}, {c.pais}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {!solo && (
              <label className="mini">
                <input type="checkbox" checked={Boolean(sala.rellenarBots)} disabled={!soyHost} onChange={(e) => api.rellenarBots(e.target.checked)} /> Add bots for empty roles. They take only the roles nobody chooses.
              </label>
            )}
          </div>
        </div>
        {/* Pie fijo: en pantallas bajas (1366×768) el botón queda a la vista sin desplazar. */}
        <div className="lobby-pie">
          <div className="assistant grow">{aviso}</div>
          <button className="primary" disabled={!puedeIniciar} onClick={() => api.iniciar()}>Start the mission</button>
        </div>
      </div>
    </div>
  )
}
