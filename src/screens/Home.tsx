import { useState } from 'react'
import { api } from '../red'
import { useStore } from '../store'
import { BotonAccesibilidad } from '../hud/Accesibilidad'
import { TablaRanking } from '../hud/Ranking'
import { useObservador } from './Observador'

export function HomeScreen() {
  const usuario = useStore((s) => s.usuario)
  const conectado = useStore((s) => s.conectado)
  const setAuth = useStore((s) => s.setAuth)
  const setFuentes = useStore((s) => s.setFuentes)
  const [codigo, setCodigo] = useState('')
  const [modo, setModo] = useState<'comandante' | 'votacion'>('comandante')
  const [juego, setJuego] = useState<'solo' | 'multi'>('solo')

  return (
    <div className="center-screen">
      <div className="card stack">
        <div className="row">
          <div className="brand grow">Mission Trainer</div>
          {!conectado && <span className="tag warn">offline</span>}
        </div>
        <h1>Hi, {usuario?.nombre}</h1>
        <p className="muted">Play with a crew of 2 to 6 people, each with a role, or alone with crewmates run by AI.</p>

        <h3>Create a room</h3>
        <div className="opciones">
          <button className={`opcion ${juego === 'solo' ? 'activa' : ''}`} onClick={() => setJuego('solo')}>
            <strong>Single player with bots</strong>
            <small>You pick your role and five AI crew members cover the rest. Start whenever you want.</small>
          </button>
          <button className={`opcion ${juego === 'multi' ? 'activa' : ''}`} onClick={() => setJuego('multi')}>
            <strong>Multiplayer</strong>
            <small>Share the room code with your crew. You need at least 2 people.</small>
          </button>
        </div>
        <label className="stack" style={{ gap: 4 }}>
          <span className="muted">How are disputed decisions settled?</span>
          <select value={modo} onChange={(e) => setModo(e.target.value as 'comandante' | 'votacion')}>
            <option value="comandante">The Mission Commander approves or rejects</option>
            <option value="votacion">Majority vote</option>
          </select>
        </label>
        <button className="primary" onClick={() => api.crearSala(modo, juego)}>{juego === 'solo' ? 'Create room with bots' : 'Create room'}</button>

        <h3 style={{ marginTop: 10 }}>Join a room</h3>
        <div className="row">
          <input
            className="grow mono"
            placeholder="CODE"
            value={codigo}
            maxLength={6}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && codigo.length === 6 && api.unirse(codigo)}
          />
          <button disabled={codigo.length !== 6} onClick={() => api.unirse(codigo)}>Join</button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="small" disabled={codigo.length !== 6} onClick={() => useObservador.getState().abrir(codigo)}>Teacher view: watch a room</button>
          <small className="muted grow">Type the code, then watch the crew without joining it.</small>
        </div>

        <TablaRanking />

        <div className="row" style={{ marginTop: 12 }}>
          <button className="small plano" onClick={() => setFuentes(true)}>Where the data comes from</button>
          <BotonAccesibilidad />
          <div className="grow" />
          <button className="small plano" onClick={() => setAuth(null, null)}>Log out</button>
        </div>
      </div>
    </div>
  )
}
