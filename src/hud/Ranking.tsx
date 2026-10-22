// Clasificación global de misiones terminadas (server/ranking.ts), en la pantalla de inicio.
import { useEffect, useState } from 'react'
import { pedirSuelto } from '../red'

interface Fila {
  codigo: string
  mision: string
  situacion: string
  victoria: boolean
  resultado: string
  dias: number
  soles: number
  muestras: number
  muestrasObjetivo: number
  salud: number
  puntaje: number | null
  tripulantes: number
  modo: 'solo' | 'multi'
}

export function TablaRanking() {
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    pedirSuelto<{ ranking: Fila[] }>('ranking').then((d) => {
      if (!vivo) return
      if (d.error || !Array.isArray(d.ranking)) setError(d.error ?? 'Could not load the leaderboard.')
      else setFilas(d.ranking)
    })
    return () => {
      vivo = false
    }
  }, [])

  return (
    <details className="ajuste ranking" open>
      <summary>Leaderboard: top 20 missions</summary>
      {error && <p className="mini bad">{error}</p>}
      {!error && !filas && <p className="mini muted">Loading…</p>}
      {filas && filas.length === 0 && <p className="mini muted">No mission has ended yet. Finish one to appear here.</p>}
      {filas && filas.length > 0 && (
        <div className="tabla-ranking">
          {filas.map((f, i) => (
            <div key={f.codigo} className="fila">
              <span className="mono puesto">{i + 1}</span>
              <span className="grow">
                <strong>{f.mision}</strong>
                <small className="muted">
                  {f.situacion}. {f.tripulantes} crew, {f.modo === 'solo' ? 'with bots' : 'multiplayer'}.
                </small>
              </span>
              <span className="mini derecha">
                <span className={`tag ${f.victoria ? 'ok' : 'bad'}`}>{f.victoria ? 'Success' : 'Failed'}</span>
                <small className="muted">
                  {f.soles > 0 ? `Sol ${f.soles}` : `Day ${f.dias}`}. {f.muestras}/{f.muestrasObjetivo} samples. Health {f.salud}.
                </small>
                {f.puntaje !== null && <b className="mono">{f.puntaje} pts</b>}
              </span>
            </div>
          ))}
        </div>
      )}
    </details>
  )
}
