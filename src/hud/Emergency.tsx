import { useEffect, useState } from 'react'
import { ROLE_BY_ID, type RoomState } from '@shared/types'
import { useYo } from '../store'
import { api } from '../socket'

export function EmergencyModal({ sala }: { sala: RoomState }) {
  const yo = useYo()
  const em = sala.emergencias.find((e) => e.estado === 'activa')
  const [ahora, setAhora] = useState(Date.now())
  const [minimizada, setMinimizada] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => setMinimizada(false), [em?.id])
  if (!em) return null
  const restante = Math.max(0, Math.round((em.vence - ahora) / 1000))
  const presentes = em.rolesResponsables.filter((r) => sala.jugadores.some((j) => j.rol === r && j.conectado))
  const soyResponsable = yo?.rol && (em.rolesResponsables.includes(yo.rol) || (presentes.length === 0 && yo.rol === 'comandante'))
  const propuesta = sala.propuestas.find((p) => p.tipo === 'emergencia' && p.estado === 'pendiente' && p.payload.emergenciaId === em.id)

  if (minimizada) {
    return (
      <button className="danger" style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 25 }} onClick={() => setMinimizada(false)}>
        ⚠ {em.titulo} · {restante}s
      </button>
    )
  }

  return (
    <div className="modal-backdrop" style={{ background: 'transparent', pointerEvents: 'none' }}>
      <div className="modal" style={{ pointerEvents: 'auto' }}>
        <div className="row">
          <span className="tag" style={{ color: 'var(--bad)' }}>1 · ALERTA</span>
          <span className="countdown grow">se decide en {restante}s o se aplica la peor opción</span>
          <button className="small" onClick={() => setMinimizada(true)}>minimizar</button>
        </div>
        <h2 style={{ marginTop: 8 }}>{em.titulo}</h2>
        <span className="tag" style={{ color: 'var(--warn)' }}>2 · PROBLEMA</span>
        <p style={{ marginTop: 6 }}>{em.descripcion}</p>
        <p className="muted" style={{ fontSize: 12 }}>
          Deciden: {em.rolesResponsables.map((r) => ROLE_BY_ID[r].nombre).join(' y ')}.{' '}
          {presentes.length > 1 ? 'Como son varios roles, la elección se convierte en propuesta.' : ''}
        </p>
        <span className="tag" style={{ color: 'var(--accent)' }}>3 · ALTERNATIVAS</span>
        {propuesta && <div className="help" style={{ marginTop: 8 }}>Propuesta en curso: {propuesta.titulo}. Revisa la pestaña Propuestas.</div>}
        {em.alternativas.map((a) => (
          <button key={a.id} className="alt" disabled={!soyResponsable || Boolean(propuesta)} onClick={() => api.elegirAlternativa(em.id, a.id)}>
            <strong>{a.etiqueta}</strong>
            <small>{a.consecuencia}</small>
          </button>
        ))}
        {!soyResponsable && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Tu rol no decide esta emergencia. Puedes consultar al asistente o pedir ayuda.</p>}
      </div>
    </div>
  )
}

export function ResultOverlay({ sala }: { sala: RoomState }) {
  if (!sala.resultado) return null
  const ultimas = sala.emergencias.filter((e) => e.estado !== 'activa').slice(0, 5)
  return (
    <div className="result-screen">
      <div className={`modal ${sala.resultado.victoria ? 'ok' : ''}`}>
        <div className="brand">{sala.resultado.victoria ? 'Misión cumplida' : 'Misión fallida'}</div>
        <h1>{sala.resultado.victoria ? '¡Base establecida!' : 'La misión terminó'}</h1>
        <p>{sala.resultado.motivo}</p>
        <p className="muted" style={{ fontSize: 12 }}>
          Soles: {sala.mision.sol - 1} · Experimentos: {sala.mision.experimentos} · Huerto: {sala.huerto.establecido ? 'sí' : 'no'} · Emergencias resueltas: {sala.emergencias.filter((e) => e.estado === 'resuelta').length}
        </p>
        {ultimas.length > 0 && (
          <div className="log" style={{ marginTop: 8 }}>
            {ultimas.map((e) => (
              <div key={e.id} className={e.estado === 'vencida' ? 'alerta' : 'info'}>
                {e.titulo}: {e.alternativas.find((a) => a.id === e.elegida)?.etiqueta ?? '—'} → {e.resultado}
              </div>
            ))}
          </div>
        )}
        <button className="primary" style={{ marginTop: 14 }} onClick={() => api.salir()}>
          Volver al inicio
        </button>
      </div>
    </div>
  )
}
