import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { httpAuth } from '../red'

type Modo = 'invitado' | 'ingresar' | 'registro'

export function AuthScreen() {
  const setAuth = useStore((s) => s.setAuth)
  // Por defecto se entra solo con un nombre: es lo más rápido para probar o presentar el juego.
  const [modo, setModo] = useState<Modo>('invitado')
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const conClave = modo !== 'invitado'

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const r = await httpAuth(modo, usuario.trim(), clave)
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
        <h1>Mars Base</h1>
        <p className="muted">Train as a crew member on a mission to Mars, with real NASA dates, weather, radiation and procedures. Play alone with a bot crew or with your classmates.</p>
        <div className="tabs">
          <button type="button" className={modo === 'invitado' ? 'active' : ''} onClick={() => setModo('invitado')}>Play now</button>
          <button type="button" className={modo === 'ingresar' ? 'active' : ''} onClick={() => setModo('ingresar')}>Log in</button>
          <button type="button" className={modo === 'registro' ? 'active' : ''} onClick={() => setModo('registro')}>Sign up</button>
        </div>
        <input placeholder="Astronaut name" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus maxLength={20} />
        {conClave && <input placeholder="Password" type="password" value={clave} onChange={(e) => setClave(e.target.value)} />}
        {modo === 'invitado' && <p className="mini muted">No account or password needed. If you log out, you cannot come back to this session.</p>}
        {error && <p style={{ color: 'var(--bad)' }}>{error}</p>}
        <button className="primary" disabled={cargando || usuario.trim().length < 3 || (conClave && !clave)}>
          {modo === 'invitado' ? 'Start' : modo === 'ingresar' ? 'Log in' : 'Sign up and play'}
        </button>
      </form>
    </div>
  )
}
