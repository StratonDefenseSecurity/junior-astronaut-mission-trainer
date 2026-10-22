// Columna de pestañas: qué toca hacer (Misión), decisiones en curso (Propuestas) y el asistente.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { escenarioDe } from '@shared/escenarios'
import { PASOS_ENSAMBLAJE, ROLE_BY_ID, TAREAS_ENSAMBLAJE, type Player, type RoomState } from '@shared/types'
import { ESTACION_BY_ID, deberesPendientes, estacionesDestacadas, puede } from '../mundo/mapa'
import { api } from '../red'
import { useStore } from '../store'
import { MarcaIA, diasRestantes, diasTexto, enMarte, roles, useAhora } from './comun'

function consejo(sala: RoomState, yo: Player): string {
  const sup = enMarte(sala)
  if (yo.incapacitado > 0) return 'You are out of action. Rest. The Flight Surgeon can treat you in the Medical Bay.'
  if (yo.enRefugio) return 'You are in the Storm Shelter. The solar storm dose is much lower here, but you cannot work.'
  if (sala.fase === 'llegada' && sala.subfase === 'orbita') {
    return puede(sala, yo, ['piloto', 'comandante']) ? 'Go to the Bridge and propose the landing site.' : 'The Pilot and the Mission Commander choose the landing site on the Bridge.'
  }
  switch (yo.rol) {
    case 'comandante':
      return 'You decide disputed proposals and control the time scale from the top bar. Speed up when everything is stable. Time slows down by itself if there is an emergency.'
    case 'piloto':
      return sup ? 'Go outside to set up equipment and clean the panels when they get dusty. Watch your suit oxygen.' : 'Watch the trajectory on the Bridge. When a correction is needed, the sooner you do it, the less propellant it costs.'
    case 'medico':
      return 'In the Medical Bay you see everyone\'s vital signs, treat illnesses and propose the exercise plan or the order to take shelter.'
    case 'logistica':
      return `In Storage you see how many days each supply will last. ${Math.round(diasRestantes(sala))} days to go: water ${diasTexto(sala.autonomia.agua)}, air ${diasTexto(sala.autonomia.aire)}, food ${diasTexto(sala.autonomia.comida)}.`
    case 'cientifico':
      return sala.fase === 'base'
        ? 'Go outside in your suit, collect samples at the marked sites (up to 3 per trip) and analyze them in the lab.'
        : sala.cargamento.huerto > 0 && !sala.huerto.establecido
          ? 'You can start setting up the garden in the lab during the trip.'
          : 'Your main work starts when the base is running: collecting and analyzing samples.'
    case 'sistemas':
      return 'Repair equipment before it drops below 50%. You have to go to the equipment to do it. Each repair uses spare parts kits.'
    default:
      return ''
  }
}

export function Mision({ sala, yo }: { sala: RoomState; yo: Player }) {
  const destacadas = estacionesDestacadas(sala, yo)
  const deberes = deberesPendientes(sala, yo)
  const abrir = useStore((s) => s.abrirEstacion)
  const cinematica = sala.fase === 'lanzamiento' || (sala.fase === 'llegada' && sala.subfase === 'descenso')
  return (
    <div className="stack">
      <div className="mision-tarjeta">
        <span className="brand">{sala.nombreMision || 'Mission'} · {escenarioDe(sala.escenario).nombre}</span>
        <p className="mini">{escenarioDe(sala.escenario).reto}</p>
        <div className="mini muted">
          Samples {sala.mision.muestrasAnalizadas}/{sala.mision.muestrasObjetivo}
          {sala.mision.aguaObjetivo > 0 && ` · water from ice ${Math.round(sala.mision.aguaExtraida)}/${sala.mision.aguaObjetivo} kg`}
        </div>
      </div>
      {!cinematica && !sala.resultado && (
        <button className="primary" onClick={() => abrir('principal')}>Base Dashboard (M)</button>
      )}
      <div className="assistant">
        <strong>{yo.rol ? ROLE_BY_ID[yo.rol].nombre : 'Crew member'}:</strong> {consejo(sala, yo)}
      </div>

      {sala.fase === 'ensamblaje' && (
        <div className="steps">
          {PASOS_ENSAMBLAJE.map((p) => {
            const estado = p.paso < sala.ensamblaje.paso ? 'done' : p.paso === sala.ensamblaje.paso ? 'active' : ''
            const tareas = TAREAS_ENSAMBLAJE.filter((t) => t.paso === p.paso)
            return (
              <div key={p.paso} className={`step ${estado}`}>
                <strong>{p.paso + 1}. {p.titulo}</strong>
                <div className="who">{roles(p.roles)}</div>
                {estado === 'active' &&
                  tareas.map((t) => (
                    <div key={t.id} className={`mini ${sala.ensamblaje.hechas[t.id] ? 'ok' : ''}`}>
                      {sala.ensamblaje.hechas[t.id] ? '✓' : '○'} {t.titulo} · {ESTACION_BY_ID[t.estacion].nombre} ({t.zona === 'exterior' ? 'outside' : 'inside'})
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
      )}

      {deberes.length > 0 && (
        <div>
          <h3>Your duties</h3>
          <ul className="lista">
            {deberes.map((d) => (
              <li key={d.id}>
                {d.titulo} <span className="muted">· {ESTACION_BY_ID[d.estacion]?.nombre ?? d.estacion}</span>
              </li>
            ))}
          </ul>
          <p className="mini muted">Routine work, like on the ISS. Skipping it has a small cost.</p>
        </div>
      )}

      {destacadas.length > 0 && (
        <div>
          <h3>Your next stops</h3>
          <ul className="lista">
            {destacadas.slice(0, 6).map((id) => (
              <li key={id}>
                {ESTACION_BY_ID[id].nombre} <span className="muted">· {ESTACION_BY_ID[id].zona === 'exterior' ? 'outside' : 'inside'}</span>
              </li>
            ))}
          </ul>
          <p className="mini muted">They are marked with a yellow ring on the floor.</p>
        </div>
      )}

      <div>
        <h3>How to play</h3>
        <p className="mini muted">
          Move with W A S D, run with Shift and drag to turn the camera. Walk up to a station and press E to use it. M opens the Base Dashboard and H hides the panels.
        </p>
      </div>
    </div>
  )
}

export function Propuestas({ sala, yo }: { sala: RoomState; yo: Player }) {
  const ahora = useAhora()
  const hayComandante = sala.jugadores.some((j) => j.rol === 'comandante' && j.conectado)
  const decideCmd = sala.modoDecision === 'comandante' && hayComandante
  if (sala.propuestas.length === 0) {
    return <p className="muted mini">No proposals yet. Decisions that affect the whole crew, such as rations, shutting down equipment, the shelter or the landing site, show up here so {decideCmd ? 'the Mission Commander can approve them' : 'the crew can vote'}.</p>
  }
  return (
    <div>
      <div className="assistant">{decideCmd ? 'The Mission Commander approves or rejects each proposal, looking out for the good of the whole crew.' : 'The majority of the connected crew wins.'}</div>
      {sala.propuestas.map((p) => {
        const autor = sala.jugadores.find((j) => j.id === p.proponente)
        const quien = autor?.nombre ?? '?'
        const si = Object.values(p.votos).filter(Boolean).length
        const no = Object.values(p.votos).filter((v) => !v).length
        const yaVote = typeof p.votos[yo.id] === 'boolean'
        const puedoVotar = p.estado === 'pendiente' && (!decideCmd || yo.rol === 'comandante') && !yaVote
        const restante = Math.max(0, Math.round((p.vence - ahora) / 1000))
        return (
          <div key={p.id} className={`proposal ${p.estado}`}>
            <div className="row" style={{ gap: 6 }}>
              <strong className="grow">{p.titulo}</strong>
              <span className={`tag ${p.estado === 'pendiente' ? 'warn' : p.estado === 'aprobada' ? 'ok' : 'bad'}`}>{ESTADO_PROPUESTA[p.estado] ?? p.estado}</span>
            </div>
            <p className="mini muted">{p.descripcion}</p>
            <div className="votes">
              by {quien}
              <MarcaIA bot={autor?.bot} /> · {roles(p.rolesResponsables)} · yes {si} / no {no}
              {p.estado === 'pendiente' && <span className="countdown"> · {restante} s</span>}
            </div>
            {puedoVotar && (
              <div className="row" style={{ marginTop: 6, gap: 6 }}>
                <button className="small ok" onClick={() => api.votar(p.id, true)}>{decideCmd ? 'Approve' : 'Vote yes'}</button>
                <button className="small danger" onClick={() => api.votar(p.id, false)}>{decideCmd ? 'Reject' : 'Vote no'}</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const SUGERENCIAS = ['How are we doing?', 'How am I?', 'Why is my pulse up?', 'How much air is left?', 'Is there radiation?', 'What should I do now?']

/** Texto visible del estado de una propuesta. */
const ESTADO_PROPUESTA: Record<string, string> = { pendiente: 'pending', aprobada: 'approved', rechazada: 'rejected', vencida: 'expired' }

export function Asistente({ sala }: { sala: RoomState }) {
  const [texto, setTexto] = useState('')
  const fin = useRef<HTMLDivElement>(null)
  const botMsgs = useStore((s) => s.botMsgs)
  const mensajes = [...sala.chat, ...botMsgs].sort((a, b) => a.t - b.t)
  const deIA = new Set(sala.jugadores.filter((j) => j.bot).map((j) => j.nombre))
  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [mensajes.length])

  const enviar = (e: FormEvent, alBot: boolean) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return
    if (alBot) void api.bot(t)
    else void api.chat(t)
    setTexto('')
  }

  return (
    <div className="chat">
      <div className="row" style={{ gap: 4, marginBottom: 6 }}>
        {SUGERENCIAS.map((s) => (
          <button key={s} className="chip" onClick={() => void api.bot(s)}>{s}</button>
        ))}
      </div>
      <div className="msgs">
        {mensajes.length === 0 && <p className="muted mini">The assistant checks the real mission status and explains the risks. Only you see what you ask it. Everyone sees messages to the crew.</p>}
        {mensajes.map((m) => (
          <div key={m.id} className={`msg ${m.bot ? 'bot' : ''}`}>
            <b>
              {m.de}
              {!m.bot && <MarcaIA bot={deIA.has(m.de)} />}
            </b>
            {m.texto}
          </div>
        ))}
        <div ref={fin} />
      </div>
      <form onSubmit={(e) => enviar(e, true)}>
        <input placeholder="Question or message" value={texto} maxLength={300} onChange={(e) => setTexto(e.target.value)} />
        <button type="button" className="small" onClick={(e) => enviar(e, false)} disabled={!texto.trim()}>Crew</button>
        <button type="submit" className="small primary" disabled={!texto.trim()}>Assistant</button>
      </form>
    </div>
  )
}

export function Lateral({ sala, yo }: { sala: RoomState; yo: Player }) {
  const pestana = useStore((s) => s.pestana)
  const setPestana = useStore((s) => s.setPestana)
  const pendientes = sala.propuestas.filter((p) => p.estado === 'pendiente').length
  return (
    <div className="panel lateral">
      <div className="tabs">
        <button className={pestana === 'mision' ? 'active' : ''} onClick={() => setPestana('mision')}>Mission</button>
        <button className={pestana === 'propuestas' ? 'active' : ''} onClick={() => setPestana('propuestas')}>Proposals{pendientes ? ` (${pendientes})` : ''}</button>
        <button className={pestana === 'asistente' ? 'active' : ''} onClick={() => setPestana('asistente')}>Assistant</button>
      </div>
      <div className="contenido">
        {pestana === 'mision' && <Mision sala={sala} yo={yo} />}
        {pestana === 'propuestas' && <Propuestas sala={sala} yo={yo} />}
        {pestana === 'asistente' && <Asistente sala={sala} />}
      </div>
    </div>
  )
}
