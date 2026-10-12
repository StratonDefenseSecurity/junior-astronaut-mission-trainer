import { useEffect, useState } from 'react'
import { ROLE_BY_ID, type RoomState } from '@shared/types'
import { useYo } from '../store'
import { api } from '../socket'

function useAhora() {
  const [t, setT] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return t
}

export function ProposalsPanel({ sala }: { sala: RoomState }) {
  const yo = useYo()
  const ahora = useAhora()
  const hayComandante = sala.jugadores.some((j) => j.rol === 'comandante' && j.conectado)
  const decideCmd = sala.modoDecision === 'comandante' && hayComandante
  if (sala.propuestas.length === 0) return <p className="muted">Sin propuestas todavía. Las acciones que involucran a varios roles aparecen aquí para aprobarse.</p>
  return (
    <div>
      <div className="assistant">
        {decideCmd ? 'Modo comandante: el comandante aprueba o rechaza cada propuesta.' : 'Modo votación: gana la mayoría de la tripulación conectada.'}
      </div>
      {sala.propuestas.map((p) => {
        const quien = sala.jugadores.find((j) => j.id === p.proponente)?.nombre ?? '?'
        const si = Object.values(p.votos).filter(Boolean).length
        const no = Object.values(p.votos).filter((v) => !v).length
        const yaVote = yo && typeof p.votos[yo.id] === 'boolean'
        const puedoVotar = p.estado === 'pendiente' && yo?.rol && (!decideCmd || yo.rol === 'comandante') && !yaVote
        const restante = Math.max(0, Math.round((p.vence - ahora) / 1000))
        return (
          <div key={p.id} className={`proposal ${p.estado}`}>
            <div className="row" style={{ gap: 6 }}>
              <strong className="grow">{p.titulo}</strong>
              <span className="tag" style={{ color: p.estado === 'pendiente' ? 'var(--warn)' : p.estado === 'aprobada' ? 'var(--ok)' : 'var(--bad)' }}>{p.estado}</span>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '4px 0' }}>{p.descripcion}</p>
            <div className="votes">
              por {quien} · roles {p.rolesResponsables.map((r) => ROLE_BY_ID[r].corto).join('+')} · sí {si} / no {no}
              {p.estado === 'pendiente' && <span className="countdown"> · {restante}s</span>}
            </div>
            {puedoVotar && (
              <div className="row" style={{ marginTop: 8, gap: 6 }}>
                <button className="small ok" onClick={() => api.votar(p.id, true)}>{decideCmd ? 'Aprobar' : 'Votar sí'}</button>
                <button className="small danger" onClick={() => api.votar(p.id, false)}>{decideCmd ? 'Rechazar' : 'Votar no'}</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
