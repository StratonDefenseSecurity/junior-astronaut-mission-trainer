// Ventanas que aparecen sobre el juego: emergencias (alerta → problema → alternativas),
// propuestas que esperan tu voto, resultado final y las fuentes de los datos.
import { useEffect, useState } from 'react'
import { C, FUENTES, SUPUESTOS } from '@shared/ciencia'
import { ROLE_BY_ID, type Player, type RoomState } from '@shared/types'
import { ESTACION_BY_ID, puede } from '../mundo/mapa'
import { palanca } from '../mundo/control'
import { api } from '../red'
import { useStore } from '../store'
import { RolTag, useAhora } from './comun'

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
        ALERTA · {em.titulo} · {restante} s
      </button>
    )
  }
  return (
    <div className="emergencia">
      <div className="row">
        <span className="tag bad">1 · Alerta</span>
        <span className="countdown grow">Quedan {restante} s. Si nadie decide, se aplica la última opción.</span>
        <button className="small" onClick={() => setMinimizada(true)}>Minimizar</button>
      </div>
      <h2>{em.titulo}</h2>
      <span className="tag warn">2 · El problema</span>
      <p>{em.descripcion}</p>
      {em.fuente && <p className="mini muted">Dato real: {em.fuente}.</p>}
      <p className="mini muted">
        Deciden: {em.rolesResponsables.map((r) => ROLE_BY_ID[r].nombre).join(' y ')}.
        {variosRoles ? ' Como son varios roles, lo que se elija pasa a ser una propuesta.' : ''}
      </p>
      <span className="tag azul">3 · Alternativas</span>
      {propuesta && <div className="help">Se propuso: {propuesta.titulo.split(': ').slice(1).join(': ')}. Falta aprobarla.</div>}
      {em.alternativas.map((a) => (
        <button key={a.id} className="opcion" disabled={!responsable || Boolean(propuesta)} onClick={() => api.elegirAlternativa(em.id, a.id)}>
          <strong>{a.etiqueta}</strong>
          <small>{a.consecuencia}</small>
        </button>
      ))}
      {!responsable && <p className="mini muted">Tu rol no decide esta emergencia. Puedes preguntar al asistente o avisar al equipo.</p>}
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
        <span className="tag warn">Propuesta</span>
        <RolTag rol={quien?.rol ?? null} />
        <span className="mini muted grow">{quien?.nombre} · {Math.max(0, Math.round((p.vence - ahora) / 1000))} s</span>
      </div>
      <strong>{p.titulo}</strong>
      <p className="mini muted">{p.descripcion}</p>
      <div className="row" style={{ gap: 6 }}>
        <button className="small ok" onClick={() => api.votar(p.id, true)}>{decideCmd ? 'Aprobar' : 'Votar sí'}</button>
        <button className="small danger" onClick={() => api.votar(p.id, false)}>{decideCmd ? 'Rechazar' : 'Votar no'}</button>
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
        <h1>{sala.resultado.victoria ? 'Base establecida en Marte' : 'La misión terminó'}</h1>
        <p>{sala.resultado.motivo}</p>
        <table className="tabla compacta">
          <thead>
            <tr><th>Tripulante</th><th>Salud</th><th>Radiación</th><th>Músculo y hueso</th></tr>
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
          {dias} días de misión · {sala.tAterrizaje > 0 ? `${Math.max(0, sala.ambiente.sol - 1)} soles en Marte` : 'sin llegar a la superficie'} · {sala.mision.muestrasAnalizadas} de {sala.mision.muestrasObjetivo} muestras · huerto {sala.huerto.establecido ? 'establecido' : 'sin establecer'}. Límite de radiación de carrera: {C.LIMITE_CARRERA_MSV} mSv.
        </p>
        {resueltas.length > 0 && (
          <>
            <h3>Últimas decisiones</h3>
            <div className="log">
              {resueltas.slice(0, 5).map((e) => (
                <div key={e.id} className={e.estado === 'vencida' ? 'alerta' : 'info'}>
                  {e.titulo}: {e.alternativas.find((a) => a.id === e.elegida)?.etiqueta ?? 'sin decisión'}. {e.resultado}
                </div>
              ))}
            </div>
          </>
        )}
        <button className="primary" style={{ marginTop: 12 }} onClick={() => api.salir()}>Volver al inicio</button>
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
          <h2 className="grow">De dónde salen los datos</h2>
          <button className="small" onClick={() => cerrar(false)}>Cerrar</button>
        </div>
        <p className="mini muted">Los números del juego parten de mediciones y documentos reales. Las ecuaciones que los combinan son simplificaciones para aprender.</p>
        <div className="fuentes">
          {FUENTES.map((f) => (
            <div key={f.tema} className="fuente">
              <strong>{f.tema}</strong>
              <p>{f.dato}</p>
              <a href={f.url} target="_blank" rel="noreferrer noopener">{f.fuente}</a>
            </div>
          ))}
        </div>
        <h3 style={{ marginTop: 14 }}>Lo que el juego simplifica o supone</h3>
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
