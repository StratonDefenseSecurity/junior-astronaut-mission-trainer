import { useEffect } from 'react'
import { useStore } from './store'
import { iniciarSondeo } from './red'
import { AuthScreen } from './screens/Auth'
import { HomeScreen } from './screens/Home'
import { LobbyScreen } from './screens/Lobby'
import { GameScreen } from './screens/Game'

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts">
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

  useEffect(() => {
    if (token) iniciarSondeo()
  }, [token])

  let pantalla
  if (!token) pantalla = <AuthScreen />
  else if (!sala && reanudando)
    pantalla = (
      <div className="center-screen">
        <p className="muted">Volviendo a tu sala…</p>
      </div>
    )
  else if (!sala) pantalla = <HomeScreen />
  else if (sala.fase === 'lobby') pantalla = <LobbyScreen />
  else pantalla = <GameScreen />

  return (
    <>
      {pantalla}
      <Toasts />
    </>
  )
}
