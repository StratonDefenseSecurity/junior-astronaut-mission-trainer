// Columna de pestañas: qué toca hacer (Misión), decisiones en curso (Propuestas) y el asistente.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { escenarioDe } from '@shared/escenarios'
import { PASOS_ENSAMBLAJE, ROLE_BY_ID, TAREAS_ENSAMBLAJE, type Player, type RoomState } from '@shared/types'
import { ESTACION_BY_ID, estacionesDestacadas, puede } from '../mundo/mapa'
import { api } from '../red'
import { useStore } from '../store'
import { diasRestantes, diasTexto, enMarte, roles, useAhora } from './comun'

function consejo(sala: RoomState, yo: Player): string {
  const sup = enMarte(sala)
  if (yo.incapacitado > 0) return 'Estás fuera de servicio. Descansa; el médico puede tratarte en la enfermería.'
  if (yo.enRefugio) return 'Estás en el refugio. Aquí la dosis de la tormenta solar es mucho menor, pero no puedes trabajar.'
  if (sala.fase === 'llegada' && sala.subfase === 'orbita') {
    return puede(sala, yo, ['piloto', 'comandante']) ? 'Ve al puente de mando y propón el sitio de aterrizaje.' : 'El piloto y el comandante eligen el sitio de aterrizaje en el puente.'
  }
  switch (yo.rol) {
    case 'comandante':
      return 'Decides las propuestas en disputa y controlas la escala de tiempo desde la barra superior. Acelera cuando todo esté estable; el tiempo se frena solo si hay una emergencia.'
    case 'piloto':
      return sup ? 'Sal a desplegar equipos y limpia los paneles cuando junten polvo. Vigila el oxígeno de tu traje.' : 'Vigila la trayectoria en el puente. Cuando se pida una corrección, cuanto antes se haga, menos propelente cuesta.'
    case 'medico':
      return 'En la enfermería ves los signos de todos, tratas dolencias y propones el plan de ejercicio o la orden de refugio.'
    case 'logistica':
      return `En el almacén ves cuántos días alcanza cada reserva. Faltan ${Math.round(diasRestantes(sala))} días: agua ${diasTexto(sala.autonomia.agua)}, aire ${diasTexto(sala.autonomia.aire)}, comida ${diasTexto(sala.autonomia.comida)}.`
    case 'cientifico':
      return sala.fase === 'base'
        ? 'Sal con el traje, recoge muestras en los puntos marcados (hasta 3 por salida) y analízalas en el laboratorio.'
        : sala.cargamento.huerto > 0 && !sala.huerto.establecido
          ? 'Puedes ir montando el huerto en el laboratorio durante el viaje.'
          : 'Tu trabajo fuerte empieza cuando la base esté operativa: recoger y analizar muestras.'
    case 'sistemas':
      return 'Repara los equipos antes de que bajen del 50%: para hacerlo tienes que ir hasta el equipo. Cada reparación gasta kits de repuestos.'
    default:
      return ''
  }
}

export function Mision({ sala, yo }: { sala: RoomState; yo: Player }) {
  const destacadas = estacionesDestacadas(sala, yo)
  const abrir = useStore((s) => s.abrirEstacion)
  const cinematica = sala.fase === 'lanzamiento' || (sala.fase === 'llegada' && sala.subfase === 'descenso')
  return (
    <div className="stack">
      <div className="mision-tarjeta">
        <span className="brand">{sala.nombreMision || 'Misión'} · {escenarioDe(sala.escenario).nombre}</span>
        <p className="mini">{escenarioDe(sala.escenario).reto}</p>
        <div className="mini muted">
          Muestras {sala.mision.muestrasAnalizadas}/{sala.mision.muestrasObjetivo}
          {sala.mision.aguaObjetivo > 0 && ` · agua del hielo ${Math.round(sala.mision.aguaExtraida)}/${sala.mision.aguaObjetivo} kg`}
        </div>
      </div>
      {!cinematica && !sala.resultado && (
        <button className="primary" onClick={() => abrir('principal')}>Página principal (M)</button>
      )}
      <div className="assistant">
        <strong>{yo.rol ? ROLE_BY_ID[yo.rol].nombre : 'Tripulante'}:</strong> {consejo(sala, yo)}
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
                      {sala.ensamblaje.hechas[t.id] ? '✓' : '○'} {t.titulo} · {ESTACION_BY_ID[t.estacion].nombre} ({t.zona === 'exterior' ? 'fuera' : 'dentro'})
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
      )}

      {destacadas.length > 0 && (
        <div>
          <h3>Te toca ir a</h3>
          <ul className="lista">
            {destacadas.slice(0, 6).map((id) => (
              <li key={id}>
                {ESTACION_BY_ID[id].nombre} <span className="muted">· {ESTACION_BY_ID[id].zona === 'exterior' ? 'fuera' : 'dentro'}</span>
              </li>
            ))}
          </ul>
          <p className="mini muted">Están señaladas con un anillo amarillo en el suelo.</p>
        </div>
      )}

      <div>
        <h3>Cómo se juega</h3>
        <p className="mini muted">
          Muévete con W A S D, corre con Mayús y arrastra para girar la cámara. Acércate a una estación y pulsa E para usarla. M abre la página principal y H oculta los paneles.
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
    return <p className="muted mini">Aún no hay propuestas. Las decisiones que afectan a toda la tripulación (raciones, apagar equipos, refugio, sitio de aterrizaje) aparecen aquí para que {decideCmd ? 'el comandante las apruebe' : 'se voten'}.</p>
  }
  return (
    <div>
      <div className="assistant">{decideCmd ? 'El comandante aprueba o rechaza cada propuesta, velando por el bienestar de la mayoría.' : 'Gana la mayoría de la tripulación conectada.'}</div>
      {sala.propuestas.map((p) => {
        const quien = sala.jugadores.find((j) => j.id === p.proponente)?.nombre ?? '?'
        const si = Object.values(p.votos).filter(Boolean).length
        const no = Object.values(p.votos).filter((v) => !v).length
        const yaVote = typeof p.votos[yo.id] === 'boolean'
        const puedoVotar = p.estado === 'pendiente' && (!decideCmd || yo.rol === 'comandante') && !yaVote
        const restante = Math.max(0, Math.round((p.vence - ahora) / 1000))
        return (
          <div key={p.id} className={`proposal ${p.estado}`}>
            <div className="row" style={{ gap: 6 }}>
              <strong className="grow">{p.titulo}</strong>
              <span className={`tag ${p.estado === 'pendiente' ? 'warn' : p.estado === 'aprobada' ? 'ok' : 'bad'}`}>{p.estado}</span>
            </div>
            <p className="mini muted">{p.descripcion}</p>
            <div className="votes">
              por {quien} · {roles(p.rolesResponsables)} · sí {si} / no {no}
              {p.estado === 'pendiente' && <span className="countdown"> · {restante} s</span>}
            </div>
            {puedoVotar && (
              <div className="row" style={{ marginTop: 6, gap: 6 }}>
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

const SUGERENCIAS = ['¿Cómo vamos?', '¿Cómo estoy?', '¿Por qué mi pulso?', '¿Cuánto aire queda?', '¿Hay radiación?', '¿Qué hago ahora?']

export function Asistente({ sala }: { sala: RoomState }) {
  const [texto, setTexto] = useState('')
  const fin = useRef<HTMLDivElement>(null)
  const botMsgs = useStore((s) => s.botMsgs)
  const mensajes = [...sala.chat, ...botMsgs].sort((a, b) => a.t - b.t)
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
        {mensajes.length === 0 && <p className="muted mini">El asistente consulta el estado real de la misión y explica los riesgos. Lo que le preguntes solo lo ves tú; los mensajes al equipo los ven todos.</p>}
        {mensajes.map((m) => (
          <div key={m.id} className={`msg ${m.bot ? 'bot' : ''}`}>
            <b>{m.de}</b>
            {m.texto}
          </div>
        ))}
        <div ref={fin} />
      </div>
      <form onSubmit={(e) => enviar(e, true)}>
        <input placeholder="Pregunta o mensaje" value={texto} maxLength={300} onChange={(e) => setTexto(e.target.value)} />
        <button type="button" className="small" onClick={(e) => enviar(e, false)} disabled={!texto.trim()}>Equipo</button>
        <button type="submit" className="small primary" disabled={!texto.trim()}>Asistente</button>
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
        <button className={pestana === 'mision' ? 'active' : ''} onClick={() => setPestana('mision')}>Misión</button>
        <button className={pestana === 'propuestas' ? 'active' : ''} onClick={() => setPestana('propuestas')}>Propuestas{pendientes ? ` (${pendientes})` : ''}</button>
        <button className={pestana === 'asistente' ? 'active' : ''} onClick={() => setPestana('asistente')}>Asistente</button>
      </div>
      <div className="contenido">
        {pestana === 'mision' && <Mision sala={sala} yo={yo} />}
        {pestana === 'propuestas' && <Propuestas sala={sala} yo={yo} />}
        {pestana === 'asistente' && <Asistente sala={sala} />}
      </div>
    </div>
  )
}
