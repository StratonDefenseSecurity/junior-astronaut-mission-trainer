// Informe final de la misión: puntuación con su desglose, decisiones clave con lo que hacen las
// tripulaciones de NASA, una ficha por tripulante y los objetivos de aprendizaje logrados.
// Lo calcula el servidor al terminar (server/aprendizaje.ts); aquí solo se muestra.
import { NOTA_TEXTO } from '@shared/avisos'
import { FUENTES } from '@shared/ciencia'
import { DIFICULTAD_BY_ID, HABILIDADES, practicaDe } from '@shared/informe'
import type { RoomState } from '@shared/types'
import { RolTag } from './comun'
import '../aprendizaje.css'

const FUENTE_POR_TEMA = Object.fromEntries(FUENTES.map((f) => [f.tema, f]))

/** Segundo de misión como "Day 12" en el viaje o "Sol 3" en Marte. */
function cuando(sala: RoomState, t: number): string {
  if (sala.tAterrizaje > 0 && t >= sala.tAterrizaje) return `Sol ${1 + Math.floor((t - sala.tAterrizaje) / 88775)}`
  return `Day ${Math.max(0, Math.floor(t / 86400))}`
}

export function Informe({ sala }: { sala: RoomState }) {
  const inf = sala.informe
  if (!inf) return null
  const dif = DIFICULTAD_BY_ID[sala.dificultad ?? 'astronauta']
  return (
    <div className="stack" style={{ gap: 10 }}>
      <h2 style={{ margin: '6px 0 0' }}>Mission debrief: what did we learn?</h2>
      <div className="informe-puntos">
        <div className="nota-total" aria-label={`Mission score ${inf.puntos} out of 100`}>{inf.puntos}</div>
        <div className="mini muted">
          Mission score out of 100.
          <br />
          Difficulty: {dif?.nombre ?? 'Astronaut'}{sala.demo ? ' · Quick demo mission' : ''}.
        </div>
      </div>
      <div className="informe-partes">
        {inf.partes.map((p) => (
          <div key={p.id} className="informe-parte">
            <div className="row">
              <strong className="grow">{p.nombre}</strong>
              <span className="mono">{p.puntos}/{p.max}</span>
            </div>
            <div className="barra" aria-hidden="true">
              <span style={{ width: `${Math.round((p.puntos / p.max) * 100)}%` }} />
            </div>
            <div className="mini muted">{p.detalle}</div>
          </div>
        ))}
      </div>

      <h3>Key decisions</h3>
      {inf.decisiones.length ? (
        <ol className="informe-linea">
          {inf.decisiones.map((d, i) => {
            const nasa = practicaDe(d.tipo)
            const f = FUENTE_POR_TEMA[nasa.fuente]
            return (
              <li key={i} className={d.nota}>
                <div>
                  <span className="mini muted mono">{cuando(sala, d.t)}</span> <strong>{d.titulo}</strong>: {NOTA_TEXTO[d.nota]}. {d.porque}
                </div>
                <div className="mini muted">
                  What NASA crews do: {nasa.texto}{' '}
                  {f ? (
                    <a href={f.url} target="_blank" rel="noreferrer">Source</a>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="mini muted">No decisions were rated in this mission.</p>
      )}

      <h3>The crew</h3>
      <div className="informe-personas">
        {inf.personas.map((p) => (
          <div key={p.id} className="informe-persona">
            <div><RolTag rol={p.rol} /> <strong>{p.nombre}</strong></div>
            <div className="mini">
              {p.aportes} contribution{p.aportes === 1 ? '' : 's'} · {p.pasos} procedure step{p.pasos === 1 ? '' : 's'}
              {p.calidad !== null ? `, ${p.calidad}% expert quality` : ''} · {p.deberes} routine dut{p.deberes === 1 ? 'y' : 'ies'}
            </div>
            <div className="mini muted">
              Skills practiced: {p.habilidades.length ? p.habilidades.map((h) => HABILIDADES[h] ?? h).join(', ') : 'none yet'}.
            </div>
          </div>
        ))}
      </div>

      <h3>Learning objectives</h3>
      <ul className="informe-objetivos">
        {inf.objetivos.map((o) => (
          <li key={o.id}>
            <span className={o.logrado ? 'si' : 'no'}>{o.logrado ? 'Achieved' : 'Not yet'}</span> · <strong>{o.nombre}</strong>. <span className="mini muted">{o.detalle}</span>
          </li>
        ))}
      </ul>
      <p className="mini muted">The score and its weights are game values for learning, not a NASA rating.</p>
    </div>
  )
}
