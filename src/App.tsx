import { useEffect } from 'react'
import { Fuentes } from './hud/Avisos'
import { PanelAccesibilidad, Subtitulos } from './hud/Accesibilidad'
import { iniciarSondeo } from './red'
import { AuthScreen } from './screens/Auth'
import { ContextoScreen } from './screens/Contexto'
import { HomeScreen } from './screens/Home'
import { JuegoScreen } from './screens/Juego'
import { LobbyScreen } from './screens/Lobby'
import { ObservadorScreen, useObservador } from './screens/Observador'
import { useStore } from './store'

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tipo}`}>{t.texto}</div>
      ))}
    </div>
  )
}

export default function App() {
  const token = useStore((s) => s.token)
  const sala = useStore((s) => s.sala)
  const reanudando = useStore((s) => s.reanudando)
  const observando = useObservador((s) => s.codigo)

  useEffect(() => {
    if (token) iniciarSondeo()
  }, [token])

  let pantalla
  if (!token) pantalla = <AuthScreen />
  else if (!sala && reanudando)
    pantalla = (
      <div className="center-screen">
        <p className="muted">Returning to your room…</p>
      </div>
    )
  else if (!sala && observando) pantalla = <ObservadorScreen />
  else if (!sala) pantalla = <HomeScreen />
  else if (sala.fase === 'lobby') pantalla = <LobbyScreen />
  else if (sala.fase === 'contexto') pantalla = <ContextoScreen />
  else pantalla = <JuegoScreen />

  return (
    <>
      {pantalla}
      <Fuentes />
      <PanelAccesibilidad />
      <Subtitulos />
      <Toasts />
    </>
  )
}
