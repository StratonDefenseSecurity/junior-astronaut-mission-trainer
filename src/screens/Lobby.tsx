import { ROLES } from '@shared/types'
import { useStore, useYo } from '../store'
import { api } from '../socket'

export function LobbyScreen() {
  const sala = useStore((s) => s.sala)!
  const yo = useYo()
  const usuario = useStore((s) => s.usuario)
  const soyHost = sala.hostId === usuario?.id
  const conectados = sala.jugadores.filter((j) => j.conectado)
  const hayComandante = conectados.some((j) => j.rol === 'comandante')
  const todosConRol = conectados.every((j) => j.rol)
  const puedeIniciar = soyHost && hayComandante && todosConRol && conectados.length >= 2

  return (
    <div className="center-screen">
      <div className="card wide stack">
        <div className="row">
          <div className="grow">
            <div className="brand">Sala de tripulación</div>
            <h1 className="mono" style={{ letterSpacing: '0.2em' }}>{sala.codigo}</h1>
            <p className="muted">
              Comparte este código. Decisiones en disputa: {sala.modoDecision === 'comandante' ? 'aprueba el comandante' : 'votación por mayoría'}.
            </p>
          </div>
          <button onClick={() => api.salir()}>Salir</button>
        </div>

        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow stack">
            <h3>Elige tu rol</h3>
            <div className="roles-grid">
              {ROLES.map((r) => {
                const dueño = sala.jugadores.find((j) => j.rol === r.id)
                const esMio = dueño?.id === usuario?.id
                const tomado = Boolean(dueño) && !esMio
                return (
                  <button
                    key={r.id}
                    className={`role-card ${tomado ? 'taken' : ''} ${esMio ? 'mine' : ''}`}
                    disabled={tomado}
                    onClick={() => api.elegirRol(esMio ? null : r.id)}
                  >
                    <div className="row">
                      <span className="tag" style={{ color: r.color }}>{r.corto}</span>
                      <strong className="grow">{r.nombre}</strong>
                      {dueño && <span className="muted">{esMio ? 'tú' : dueño.nombre}</span>}
                    </div>
                    <span className="muted">{r.descripcion}</span>
                    <span style={{ fontSize: 12, color: 'var(--warn)' }}>Consecuencia: {r.consecuencias}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="stack" style={{ width: 260 }}>
            <h3>Tripulación ({conectados.length})</h3>
            {sala.jugadores.map((j) => {
              const rol = ROLES.find((r) => r.id === j.rol)
              return (
                <div key={j.id} className={`crew-card ${j.id === usuario?.id ? 'me' : ''} ${j.conectado ? '' : 'offline'}`}>
                  <div className="row">
                    <strong className="grow">{j.nombre}{j.id === sala.hostId ? ' (anfitrión)' : ''}</strong>
                    {rol ? <span className="tag" style={{ color: rol.color }}>{rol.corto}</span> : <span className="muted">sin rol</span>}
                  </div>
                </div>
              )
            })}
            <div className="assistant">
              <strong>Asistente:</strong>{' '}
              {!yo?.rol
                ? 'Elige un rol. Cada rol tiene responsabilidades y consecuencias distintas durante la misión.'
                : !hayComandante
                  ? 'Falta un comandante. Sin comandante nadie puede resolver las decisiones en disputa.'
                  : !todosConRol
                    ? 'Esperando a que todos elijan rol.'
                    : conectados.length < 2
                      ? 'Se necesitan al menos 2 tripulantes para iniciar.'
                      : soyHost
                        ? 'Todo listo. Puedes iniciar la misión.'
                        : 'Todo listo. El anfitrión iniciará la misión.'}
            </div>
            <button className="primary" disabled={!puedeIniciar} onClick={() => api.iniciar()}>
              Iniciar misión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
