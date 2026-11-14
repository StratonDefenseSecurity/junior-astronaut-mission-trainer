// "El Sol ahora": los últimos 30 días de clima espacial según DONKI (NASA), para la sala de
// espera y la contextualización. En la sala de espera el anfitrión elige si la misión usa ese
// mes real o el registro archivado de 2024. Cada dato dice si es en vivo o archivado, con fecha.
import { useEffect, useState } from 'react'
import { EXPLICACION_SOL, REGLA_NIVEL_SOL, etiquetaSol, fechaSol, nivelSol, type ResumenSol } from '@shared/solHoy'
import type { RoomState } from '@shared/types'
import { api, pedirSuelto } from '../red'

/** El servidor guarda el resumen una hora; aquí basta con pedirlo una vez cada 10 minutos. */
let guardado: { t: number; sol: ResumenSol } | null = null

function useSolHoy(): { sol: ResumenSol | null; error: string | null } {
  const [estado, setEstado] = useState<{ sol: ResumenSol | null; error: string | null }>({ sol: guardado?.sol ?? null, error: null })
  useEffect(() => {
    if (guardado && Date.now() - guardado.t < 600_000) return
    let vivo = true
    void pedirSuelto<{ sol: ResumenSol }>('solHoy').then((d) => {
      if (d.sol) guardado = { t: Date.now(), sol: d.sol }
      if (vivo) setEstado({ sol: d.sol ?? null, error: d.sol ? null : (d.error ?? 'No answer from the server.') })
    })
    return () => {
      vivo = false
    }
  }, [])
  return estado
}

const TONO = { Low: 'ok', Medium: 'warn', High: 'bad' } as const

export function SolHoy({ sala, soyHost }: { sala: RoomState; soyHost?: boolean }) {
  const ahora = useSolHoy()
  const [enviando, setEnviando] = useState(false)
  const delMision = sala.solVivo ?? null
  const sol = delMision ?? ahora.sol
  const eligiendo = soyHost !== undefined && sala.fase === 'lobby'

  const elegir = async (vivo: boolean) => {
    setEnviando(true)
    await api.climaSolar(vivo)
    setEnviando(false)
  }

  if (!sol) {
    return (
      <div className="hecho">
        <span>The Sun right now</span>
        <p className="mini muted">{ahora.error ? `Could not get NASA space weather data: ${ahora.error}` : 'Asking NASA DONKI about the last 30 days…'}</p>
      </div>
    )
  }

  const riesgo = nivelSol(sol)
  const n = sol.particulas.length
  const archivo = sol.modo === 'archivo'
  return (
    <div className="stack" style={{ gap: 8 }}>
      <h3 style={{ marginBottom: 0 }}>The Sun right now</h3>
      <p className="mini muted" style={{ margin: 0 }}>
        <span className={`tag ${archivo ? 'warn' : 'ok'}`}>{archivo ? 'ARCHIVED' : 'LIVE'}</span> {etiquetaSol(sol)}.
        {sol.aviso ? ` The live data could not be fetched (${sol.aviso}), so these are the same 30 days of 2024.` : ''}
      </p>
      <p className="mini" style={{ margin: 0 }}>{EXPLICACION_SOL}</p>
      <div className="situacion">
        <div className="hecho">
          <span>Solar flares</span>
          <b>{sol.clases.M === null ? `${sol.clases.X} X class` : `${sol.clases.X + sol.clases.M + (sol.clases.C ?? 0)}`}</b>
          <p className="mini">
            {sol.clases.M === null
              ? 'The archive keeps only the strongest (X class) flares.'
              : `${sol.clases.X} X, ${sol.clases.M} M and ${sol.clases.C} C class.`}
            {sol.mayor ? ` Strongest: ${sol.mayor.clase} on ${fechaSol(sol.mayor.fecha)}.` : ''}
          </p>
        </div>
        <div className="hecho">
          <span>Solar particle events</span>
          <b>{n}</b>
          <p className="mini">
            {n === 0
              ? `The Sun was quiet this month: ${archivo ? 'archived' : 'real'} data. No particle storm, so no reason to go to the shelter.`
              : `On ${sol.particulas.map((p) => fechaSol(p[4])).join(', ')}.`}
          </p>
        </div>
        <div className="hecho">
          <span>Risk for astronauts</span>
          <b className={TONO[riesgo.nivel]}>{riesgo.nivel}</b>
          <p className="mini">{riesgo.porque}</p>
        </div>
      </div>
      <p className="mini muted" style={{ margin: 0 }}>
        How the risk level is set (a game rule, not a NASA forecast): {REGLA_NIVEL_SOL}
        {sol.kpMax !== null ? ` Strongest geomagnetic storm at Earth: Kp ${sol.kpMax}${sol.kpFecha ? ` on ${fechaSol(sol.kpFecha)}` : ''}.` : ''}
        {sol.eyecciones !== null ? ` Coronal mass ejections recorded: ${sol.eyecciones}.` : ''}{' '}
        <a href={sol.urls[0]} target="_blank" rel="noreferrer noopener">Data: {sol.servicio}</a>
      </p>

      {eligiendo ? (
        <>
          <h3 style={{ marginBottom: 0 }}>Space weather for the mission {soyHost ? '· you choose it' : ''}</h3>
          <div className="opciones" role="radiogroup" aria-label="Space weather">
            <button role="radio" aria-checked={Boolean(delMision)} className={`opcion ${delMision ? 'activa' : ''}`} disabled={!soyHost || enviando} onClick={() => void elegir(true)}>
              <strong>Live from NASA DONKI (last 30 days)</strong>
              <small>
                The first {Math.round(ahora.sol?.dias ?? 30)} days of the mission replay the real flares and particle storms of this month, saved when you choose. After that, nobody knows what the Sun will do, so the archived 2024 record takes over.
              </small>
            </button>
            <button role="radio" aria-checked={!delMision} className={`opcion ${!delMision ? 'activa' : ''}`} disabled={!soyHost || enviando} onClick={() => void elegir(false)}>
              <strong>Archived 2024 solar maximum</strong>
              <small>The whole mission replays the real 2024 events (NASA DONKI record). In 2024 the Sun was in the maximum phase of its 11-year cycle.</small>
            </button>
          </div>
        </>
      ) : (
        <p className="mini" style={{ margin: 0 }}>
          This mission uses{' '}
          {delMision
            ? `the live NASA DONKI month ${etiquetaSol(delMision).replace('Live from NASA DONKI, ', '')} for its first ${Math.round(delMision.dias)} days, then the archived 2024 record.`
            : 'the archived 2024 NASA DONKI record (solar maximum) for the whole trip. The card above is only to know the Sun today.'}
        </p>
      )}
    </div>
  )
}
