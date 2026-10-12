import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { httpAuth } from '../red'

export function AuthScreen() {
  const setAuth = useStore((s) => s.setAuth)
  const [modo, setModo] = useState<'ingresar' | 'registro'>('ingresar')
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const r = await httpAuth(modo, usuario, clave)
      setAuth(r.token, r.usuario)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="center-screen">
      <form className="card stack" onSubmit={enviar}>
        <div className="brand">NASA Space Apps 2026 · Junior Astronaut Mission Trainer</div>
        <h1>Base Marte</h1>
        <p className="muted">Crea tu cuenta de astronauta y únete a una sala con tu tripulación.</p>
        <div className="tabs">
          <button type="button" className={modo === 'ingresar' ? 'active' : ''} onClick={() => setModo('ingresar')}>Ingresar</button>
          <button type="button" className={modo === 'registro' ? 'active' : ''} onClick={() => setModo('registro')}>Crear cuenta</button>
        </div>
        <input placeholder="Nombre de astronauta" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus />
        <input placeholder="Clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} />
        {error && <p style={{ color: 'var(--bad)' }}>{error}</p>}
        <button className="primary" disabled={cargando || !usuario || !clave}>
          {modo === 'ingresar' ? 'Ingresar' : 'Crear cuenta y entrar'}
        </button>
      </form>
    </div>
  )
}
