// Lo que le toca a cada jugador: sus misiones personales, el aviso de sueño (con el botón para
// despertar) y la guía para volver a entrar al hábitat por la esclusa.
import { useEffect, useRef } from 'react'
import { avanceTexto, misionesVisibles } from '@shared/misiones'
import { procPorId } from '@shared/procedimientos'
import type { Player, RoomState } from '@shared/types'
import { api } from '../red'
import { useStore } from '../store'
import { Barra, useAhora } from './comun'

/** Tarjeta "My missions": objetivos del rol en esta situación, con su avance. */
export function MisMisiones({ sala, yo }: { sala: RoomState; yo: Player }) {
  const lista = misionesVisibles(sala, yo)
  const toast = useStore((s) => s.toast)
  // Aviso al cumplir una: solo las que pasan a cumplidas mientras se mira, no las de antes.
  const vistas = useRef<Set<string> | null>(null)
  const hechas = lista.filter((a) => a.hecha).map((a) => a.mision.id)
  useEffect(() => {
    if (vistas.current === null) {
      vistas.current = new Set(hechas)
      return
    }
    for (const id of hechas) {
      if (vistas.current.has(id)) continue
      vistas.current.add(id)
      const m = lista.find((a) => a.mision.id === id)
      if (m) toast(`Personal mission complete: ${m.mision.titulo}.`, 'info')
    }
  }, [hechas.join('|')])
  if (!lista.length) return null
  const total = lista.filter((a) => a.hecha).length
  return (
    <div className="mis-misiones">
      <h3>
        My missions <span className="mini muted">{total} of {lista.length} done</span>
      </h3>
      {lista.map((a) => (
        <div key={a.mision.id} className={`mi-mision ${a.hecha ? 'hecha' : ''}`}>
          <div className="row" style={{ gap: 6 }}>
            <span className={a.hecha ? 'ok' : 'muted'}>{a.hecha ? '✓' : '○'}</span>
            <strong className="grow mini">{a.mision.titulo}</strong>
            <span className="mini mono">{a.hecha ? 'Done' : avanceTexto(a)}</span>
          </div>
          {!a.hecha && <Barra valor={a.hecho} max={a.mision.meta} tono={a.ahora ? 'azul' : 'ok'} />}
          <div className="mini muted">
            {a.mision.detalle} {a.hecha ? '' : a.ahora ? `Where: ${a.mision.donde}.` : 'Not in this phase.'}
          </div>
        </div>
      ))}
    </div>
  )
}

/** "You are sleeping" con el botón para despertar, y el aviso antes de dormirse solo. */
export function AvisoSueno({ yo }: { yo: Player }) {
  const ahora = useAhora()
  if (yo.incapacitado > 0 || yo.zona !== 'nave') return null
  if (yo.actividad === 'sueno' || yo.manual === 'sueno') {
    return (
      <div className="aviso-personal" role="status">
        <strong>You are sleeping</strong>
        <p className="mini">Fatigue {Math.round(yo.vit.fatiga)}%. Sleep lowers it by about 12 points per hour. Moving also wakes you up.</p>
        <button className="primary" onClick={() => api.despertar()}>Wake up</button>
      </div>
    )
  }
  if (yo.suenoAvisoMs) {
    const s = Math.max(0, Math.ceil((yo.suenoAvisoMs - ahora) / 1000))
    return (
      <div className="aviso-personal warn" role="status">
        <strong>Lights out</strong>
        <p className="mini">{s > 0 ? `You will fall asleep in ${s} s if you stand still.` : 'You are falling asleep.'} Move or tap Stay awake. Staying up raises your fatigue.</p>
        <button className="small" onClick={() => api.despertar()}>Stay awake</button>
      </div>
    )
  }
  return null
}

/**
 * Volver a entrar: un aviso claro "Go inside" con los pasos en orden mientras estás fuera, y si el
 * procedimiento quedó a medias ya dentro, el recordatorio de quitarse el traje en la esclusa.
 */
export function EntrarHabitat({ sala, yo }: { sala: RoomState; yo: Player }) {
  const cerca = useStore((s) => s.cerca)
  const abierta = useStore((s) => s.estacion)
  const abrir = useStore((s) => s.abrirEstacion)
  const id = `entrada:${yo.id}`
  const e = sala.procedimientos?.[id]
  const fuera = yo.zona === 'exterior'
  if (!fuera && !(e && !e.terminado && e.paso > 0)) return null
  const proc = procPorId(id, sala)
  if (!proc) return null
  const paso = e && !e.terminado ? e.paso : 0
  const estacion = proc.pasos[Math.min(paso, proc.pasos.length - 1)].estacion
  if (abierta === estacion) return null
  const aqui = cerca === estacion
  return (
    <div className="aviso-personal entrar" role="status">
      <strong>{fuera ? 'Go inside' : 'Finish taking off your suit'}</strong>
      <ol className="mini">
        {proc.pasos.map((p, i) => (
          <li key={p.id} className={i < paso ? 'ok' : i === paso ? '' : 'muted'}>
            {i < paso ? '✓ ' : ''}
            {p.titulo}
          </li>
        ))}
      </ol>
      {aqui ? (
        <button className="primary small" onClick={() => abrir(estacion)}>{fuera ? 'Go inside' : 'Take off the suit'}</button>
      ) : (
        <p className="mini muted">{fuera ? 'Walk to the outer airlock hatch, marked with a yellow ring, and press E.' : 'Go to the Airlock inside the habitat and press E.'}</p>
      )}
    </div>
  )
}
