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
        <h1>Base Marte</h1>
        <p className="muted">Entrena como tripulante de una misión a Marte: fechas, clima, radiación y procedimientos reales de la NASA. Juega solo con una tripulación de bots o con tus compañeros.</p>
        <div className="tabs">
          <button type="button" className={modo === 'invitado' ? 'active' : ''} onClick={() => setModo('invitado')}>Jugar ya</button>
          <button type="button" className={modo === 'ingresar' ? 'active' : ''} onClick={() => setModo('ingresar')}>Ingresar</button>
          <button type="button" className={modo === 'registro' ? 'active' : ''} onClick={() => setModo('registro')}>Crear cuenta</button>
        </div>
        <input placeholder="Nombre de astronauta" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus maxLength={20} />
        {conClave && <input placeholder="Clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} />}
        {modo === 'invitado' && <p className="mini muted">Sin cuenta ni clave. Si sales de la sesión, no podrás volver a ella.</p>}
        {error && <p style={{ color: 'var(--bad)' }}>{error}</p>}
        <button className="primary" disabled={cargando || usuario.trim().length < 3 || (conClave && !clave)}>
          {modo === 'invitado' ? 'Empezar' : modo === 'ingresar' ? 'Ingresar' : 'Crear cuenta y entrar'}
        </button>
      </form>
    </div>
  )
}
