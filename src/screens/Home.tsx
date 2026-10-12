import { useState } from 'react'
import { useStore } from '../store'
import { api } from '../socket'

export function HomeScreen() {
  const usuario = useStore((s) => s.usuario)
  const conectado = useStore((s) => s.conectado)
  const setAuth = useStore((s) => s.setAuth)
  const [codigo, setCodigo] = useState('')
  const [modo, setModo] = useState<'comandante' | 'votacion'>('comandante')

  return (
    <div className="center-screen">
      <div className="card stack">
        <div className="row">
          <div className="brand grow">Mission Trainer</div>
          <span className="tag" style={{ color: conectado ? 'var(--ok)' : 'var(--warn)' }}>{conectado ? 'conectado' : 'conectando…'}</span>
        </div>
        <h1>Hola, {usuario?.nombre}</h1>
        <p className="muted">Crea una sala y comparte el código con tu tripulación, o únete a una existente.</p>

        <h3>Crear sala</h3>
        <label className="stack" style={{ gap: 4 }}>
          <span className="muted">¿Cómo se resuelven las decisiones en disputa?</span>
          <select value={modo} onChange={(e) => setModo(e.target.value as 'comandante' | 'votacion')}>
            <option value="comandante">El comandante aprueba o rechaza</option>
            <option value="votacion">Se vota por mayoría</option>
          </select>
        </label>
        <button className="primary" disabled={!conectado} onClick={() => api.crearSala(modo)}>Crear sala</button>

        <h3 style={{ marginTop: 10 }}>Unirse a una sala</h3>
        <div className="row">
          <input
            className="grow mono"
            placeholder="CÓDIGO"
            value={codigo}
            maxLength={6}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && codigo.length === 6 && api.unirse(codigo)}
          />
          <button disabled={!conectado || codigo.length !== 6} onClick={() => api.unirse(codigo)}>Unirse</button>
        </div>

        <button className="small" style={{ alignSelf: 'flex-start', marginTop: 12, background: 'transparent' }} onClick={() => setAuth(null, null)}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
