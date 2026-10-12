import { useState } from 'react'
import { api } from '../red'
import { useStore } from '../store'

export function HomeScreen() {
  const usuario = useStore((s) => s.usuario)
  const conectado = useStore((s) => s.conectado)
  const setAuth = useStore((s) => s.setAuth)
  const setFuentes = useStore((s) => s.setFuentes)
  const [codigo, setCodigo] = useState('')
  const [modo, setModo] = useState<'comandante' | 'votacion'>('comandante')

  return (
    <div className="center-screen">
      <div className="card stack">
        <div className="row">
          <div className="brand grow">Mission Trainer</div>
          {!conectado && <span className="tag warn">sin conexión</span>}
        </div>
        <h1>Hola, {usuario?.nombre}</h1>
        <p className="muted">Crea una sala y comparte el código con tu tripulación, o únete a una que ya exista. Se juega de 2 a 6 personas, cada una con su rol.</p>

        <h3>Crear sala</h3>
        <label className="stack" style={{ gap: 4 }}>
          <span className="muted">¿Cómo se resuelven las decisiones en disputa?</span>
          <select value={modo} onChange={(e) => setModo(e.target.value as 'comandante' | 'votacion')}>
            <option value="comandante">El comandante aprueba o rechaza</option>
            <option value="votacion">Se vota por mayoría</option>
          </select>
        </label>
        <button className="primary" onClick={() => api.crearSala(modo)}>Crear sala</button>

        <h3 style={{ marginTop: 10 }}>Unirse a una sala</h3>
        <div className="row">
          <input
            className="grow mono"
            placeholder="CÓDIGO"
            value={codigo}
            maxLength={6}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && codigo.length === 6 && api.unirse(codigo)}
          />
          <button disabled={codigo.length !== 6} onClick={() => api.unirse(codigo)}>Unirse</button>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="small plano" onClick={() => setFuentes(true)}>De dónde salen los datos</button>
          <div className="grow" />
          <button className="small plano" onClick={() => setAuth(null, null)}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  )
}
