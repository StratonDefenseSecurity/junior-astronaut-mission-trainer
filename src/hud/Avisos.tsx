// Ventanas que aparecen sobre el juego: emergencias (alerta → problema → alternativas),
// propuestas que esperan tu voto, resultado final y las fuentes de los datos.
import { useEffect, useRef, useState } from 'react'
import { C, FUENTES, SUPUESTOS } from '@shared/ciencia'
import { ROLE_BY_ID, type Player, type RoomState } from '@shared/types'
import { ESTACION_BY_ID, puede } from '../mundo/mapa'
import { palanca } from '../mundo/control'
import { api } from '../red'
import { useStore } from '../store'
import { RolTag, useAhora } from './comun'
import { descargarCertificado } from './Certificado'

/**
 * Mensajes del centro de control y de casa. Aparecen un momento sobre el juego, como una
 * transmisión que llega con el retraso real de la señal.
 */
export function Transmision({ sala }: { sala: RoomState }) {
  const vistos = useRef<Set<string> | null>(null)
  const [actual, setActual] = useState<string | null>(null)
  const radios = sala.registro.filter((l) => l.tipo === 'radio')
  const clave = (l: { t: number; texto: string }) => `${l.t}|${l.texto.slice(0, 40)}`
  // Lo que ya estaba al entrar no se vuelve a anunciar.
  if (vistos.current === null) vistos.current = new Set(radios.map(clave))
  const nuevo = radios.find((l) => !vistos.current!.has(clave(l)))
  useEffect(() => {
    if (!nuevo) return
    vistos.current!.add(clave(nuevo))
    setActual(nuevo.texto)
    window.dispatchEvent(new CustomEvent('mt:transmision'))
    const id = window.setTimeout(() => setActual(null), 16000)
    return () => window.clearTimeout(id)
  }, [nuevo])
  if (!actual) return null
  return (
    <div className="transmision" role="status">
      <div className="cabeza">
        <i /> Transmission received
        <span className="grow" />
        <button className="small plano" onClick={() => setActual(null)}>Close</button>
      </div>
      <p>{actual}</p>
    </div>
  )
}

export function Emergencia({ sala, yo }: { sala: RoomState; yo: Player }) {
  const em = sala.emergencias.find((e) => e.estado === 'activa')
  const ahora = useAhora()
  const [minimizada, setMinimizada] = useState(false)
  useEffect(() => setMinimizada(false), [em?.id])
  if (!em) return null
  const restante = Math.max(0, Math.round((em.vence - ahora) / 1000))
  const responsable = puede(sala, yo, em.rolesResponsables)
  const variosRoles = em.rolesResponsables.filter((r) => sala.jugadores.some((j) => j.rol === r && j.conectado)).length > 1
  const propuesta = sala.propuestas.find((p) => p.tipo === 'emergencia' && p.estado === 'pendiente' && p.payload.emergenciaId === em.id)

  if (minimizada) {
    return (
      <button className="emergencia-mini" onClick={() => setMinimizada(false)}>
        ALERT · {em.titulo} · {restante} s
      </button>
    )
  }
  return (
    <div className="emergencia">
      <div className="row">
        <span className="tag bad">1 · Alert</span>
        <span className="countdown grow">{restante} s left. If nobody decides, the last option is applied.</span>
        <button className="small" onClick={() => setMinimizada(true)}>Minimize</button>
      </div>
      <h2>{em.titulo}</h2>
      <span className="tag warn">2 · The problem</span>
      <p>{em.descripcion}</p>
      {em.fuente && <p className="mini muted">Real data: {em.fuente}.</p>}
      <p className="mini muted">
        Who decides: {em.rolesResponsables.map((r) => ROLE_BY_ID[r].nombre).join(' and ')}.
        {variosRoles ? ' Since several roles decide, the choice becomes a proposal.' : ''}
      </p>
      <span className="tag azul">3 · Options</span>
      {propuesta && <div className="help">Proposed: {propuesta.titulo.split(': ').slice(1).join(': ')}. It still needs approval.</div>}
      {em.alternativas.map((a) => (
        <button key={a.id} className="opcion" disabled={!responsable || Boolean(propuesta)} onClick={() => api.elegirAlternativa(em.id, a.id)}>
          <strong>{a.etiqueta}</strong>
          <small>{a.consecuencia}</small>
        </button>
      ))}
      {!responsable && <p className="mini muted">Your role does not decide this emergency. You can ask the assistant or warn the crew.</p>}
    </div>
  )
}

/** Propuesta pendiente que este jugador puede decidir, a la vista sin abrir la pestaña. */
export function VotoRapido({ sala, yo }: { sala: RoomState; yo: Player }) {
  const ahora = useAhora()
  const hayComandante = sala.jugadores.some((j) => j.rol === 'comandante' && j.conectado)
  const decideCmd = sala.modoDecision === 'comandante' && hayComandante
  const p = sala.propuestas.find((x) => x.estado === 'pendiente' && typeof x.votos[yo.id] !== 'boolean' && (!decideCmd || yo.rol === 'comandante'))
  if (!p) return null
  const quien = sala.jugadores.find((j) => j.id === p.proponente)
  return (
    <div className="voto">
      <div className="row" style={{ gap: 6 }}>
        <span className="tag warn">Proposal</span>
        <RolTag rol={quien?.rol ?? null} />
        <span className="mini muted grow">{quien?.nombre} · {Math.max(0, Math.round((p.vence - ahora) / 1000))} s</span>
      </div>
      <strong>{p.titulo}</strong>
      <p className="mini muted">{p.descripcion}</p>
      <div className="row" style={{ gap: 6 }}>
        <button className="small ok" onClick={() => api.votar(p.id, true)}>{decideCmd ? 'Approve' : 'Vote yes'}</button>
        <button className="small danger" onClick={() => api.votar(p.id, false)}>{decideCmd ? 'Reject' : 'Vote no'}</button>
      </div>
    </div>
  )
}

export function Resultado({ sala }: { sala: RoomState }) {
  if (!sala.resultado) return null
  const crew = sala.jugadores.filter((j) => j.rol)
  const dias = Math.floor(Math.max(0, sala.t) / 86400)
  const resueltas = sala.emergencias.filter((e) => e.estado !== 'activa')
  return (
    <div className="velo">
      <div className={`modal ${sala.resultado.victoria ? 'ok' : 'bad'}`}>
        <div className="brand">{sala.resultado.titulo}</div>
        <h1>{sala.nombreMision ? `${sala.nombreMision}: ` : ''}{sala.resultado.victoria ? 'base established on Mars' : 'the mission is over'}</h1>
        <p>{sala.resultado.motivo}</p>
        <table className="tabla compacta">
          <thead>
            <tr><th>Crew member</th><th>Health</th><th>Radiation</th><th>Muscle and bone</th></tr>
          </thead>
          <tbody>
            {crew.map((j) => (
              <tr key={j.id}>
                <td><RolTag rol={j.rol} /> {j.nombre}</td>
                <td className="mono">{Math.round(j.vit.salud)}</td>
                <td className={`mono ${j.vit.dosis > C.LIMITE_CARRERA_MSV ? 'bad' : ''}`}>{Math.round(j.vit.dosis)} mSv</td>
                <td className="mono">{Math.round(j.vit.condicion)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mini muted">
          {dias} mission days · {sala.tAterrizaje > 0 ? `${Math.max(0, sala.ambiente.sol - 1)} sols on Mars` : 'did not reach the surface'} · {sala.mision.muestrasAnalizadas} of {sala.mision.muestrasObjetivo} samples · garden {sala.huerto.establecido ? 'established' : 'not established'}. Career radiation limit: {C.LIMITE_CARRERA_MSV} mSv.
        </p>
        {resueltas.length > 0 && (
          <>
            <h3>Latest decisions</h3>
            <div className="log">
              {resueltas.slice(0, 5).map((e) => (
                <div key={e.id} className={e.estado === 'vencida' ? 'alerta' : 'info'}>
                  {e.titulo}: {e.alternativas.find((a) => a.id === e.elegida)?.etiqueta ?? 'no decision'}. {e.resultado}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <button className="ok" onClick={() => descargarCertificado(sala)}>Download the certificate</button>
          <button className="primary" onClick={() => api.salir()}>Back to start</button>
        </div>
      </div>
    </div>
  )
}

export function Fuentes() {
  const abierto = useStore((s) => s.fuentes)
  const cerrar = useStore((s) => s.setFuentes)
  if (!abierto) return null
  return (
    <div className="velo" onClick={() => cerrar(false)}>
      <div className="modal ancho" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 className="grow">Where the data comes from</h2>
          <button className="small" onClick={() => cerrar(false)}>Close</button>
        </div>
        <p className="mini muted">The numbers in the game come from real measurements and documents. The equations that combine them are simplified for learning.</p>
        <div className="fuentes">
          {FUENTES.map((f) => (
            <div key={f.tema} className="fuente">
              <strong>{f.tema}</strong>
              <p>{f.dato}</p>
              <a href={f.url} target="_blank" rel="noreferrer noopener">{f.fuente}</a>
            </div>
          ))}
        </div>
        <h3 style={{ marginTop: 14 }}>What the game simplifies or assumes</h3>
        <ul className="lista">
          {SUPUESTOS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Indicador de la estación al alcance y, en pantallas táctiles, palanca de movimiento. */
export function Interaccion() {
  const cerca = useStore((s) => s.cerca)
  const estacion = useStore((s) => s.estacion)
  const abrir = useStore((s) => s.abrirEstacion)
  const [tactil] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    palanca.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2.4))
    palanca.y = -Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2.4))
  }
  const soltar = () => {
    palanca.x = 0
    palanca.y = 0
  }
  return (
    <>
      {cerca && !estacion && (
        <button className="interaccion" onClick={() => abrir(cerca)}>
          <kbd>E</kbd> {ESTACION_BY_ID[cerca]?.nombre}
        </button>
      )}
      {tactil && (
        <div
          className="palanca"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            mover(e)
          }}
          onPointerMove={(e) => e.buttons > 0 && mover(e)}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          <i />
        </div>
      )}
    </>
  )
}
