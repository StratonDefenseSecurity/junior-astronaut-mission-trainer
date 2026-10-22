// Vista del docente ("Mission Control"): sigue una sala por su código sin ser tripulante.
// Solo lectura, salvo dos cosas: enviar un mensaje de radio a la tripulación y pausar la
// misión para comentarla en clase. El servidor no la cuenta como jugador ni como presencia.
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { NOTA_TEXTO } from '@shared/avisos'
import { C } from '@shared/ciencia'
import { escenarioDe } from '@shared/escenarios'
import { ROLE_BY_ID, etiquetaTiempo, type Player, type Role, type RoomState } from '@shared/types'
import { BotonAccesibilidad } from '../hud/Accesibilidad'
import { MarcaIA, RolTag } from '../hud/comun'
import { pedirSuelto } from '../red'

export const useObservador = create<{ codigo: string | null; abrir: (codigo: string | null) => void }>((set) => ({
  codigo: null,
  abrir: (codigo) => set({ codigo }),
}))

const INTERVALO_MS = 2000

const FASE: Record<RoomState['fase'], string> = {
  lobby: 'Crew is getting ready (lobby)',
  contexto: 'Mission briefing',
  lanzamiento: 'Launch',
  transito: 'Cruise to Mars',
  llegada: 'Arrival and landing',
  ensamblaje: 'Building the base',
  base: 'Surface operations',
  fin: 'Mission over',
}

const ACTIVIDAD: Record<Player['actividad'], string> = {
  sueno: 'sleeping',
  reposo: 'resting',
  trabajo: 'working',
  ejercicio: 'exercising',
  eva: 'on a spacewalk',
}

function ubicacion(j: Player): string {
  if (j.incapacitado > 0) return 'Out of action'
  if (j.enRefugio) return 'In the storm shelter'
  return `${j.zona === 'exterior' ? 'Outside' : 'Inside'}, ${ACTIVIDAD[j.actividad] ?? j.actividad}`
}

/** Estado con texto además del color, para no depender solo del rojo y el verde. */
function Estado({ valor, malo, regular }: { valor: number; malo: number; regular: number }) {
  const [clase, palabra] = valor < malo ? ['bad', 'critical'] : valor < regular ? ['warn', 'low'] : ['ok', 'good']
  return (
    <span className={`tag ${clase}`}>
      {Math.round(valor)} {palabra}
    </span>
  )
}

const nombreRol = (r: Role) => ROLE_BY_ID[r]?.nombre ?? r

export function ObservadorScreen() {
  const codigo = useObservador((s) => s.codigo) ?? ''
  const salirVista = useObservador((s) => s.abrir)
  const [sala, setSala] = useState<RoomState | null>(null)
  const [ahora, setAhora] = useState(0)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let vivo = true
    let temporizador = 0
    const consultar = async () => {
      const d = await pedirSuelto<{ sala: RoomState; ahora: number; sinSala: boolean }>('observar', { codigo })
      if (!vivo) return
      if (d.sala) {
        setSala(d.sala)
        setAhora(d.ahora ?? 0)
        setError('')
      } else setError(d.error ?? 'Could not read the room.')
      if (!d.sinSala) temporizador = window.setTimeout(consultar, INTERVALO_MS)
    }
    consultar()
    return () => {
      vivo = false
      window.clearTimeout(temporizador)
    }
  }, [codigo])

  const enviar = async (op: 'controlMensaje' | 'controlPausa', datos: Record<string, unknown>) => {
    const d = await pedirSuelto<{ sala: RoomState; ahora: number }>(op, { codigo, ...datos })
    if (d.sala) {
      setSala(d.sala)
      setAhora(d.ahora ?? ahora)
      setAviso(op === 'controlMensaje' ? 'Message sent to the crew.' : '')
      if (op === 'controlMensaje') setMensaje('')
    } else setAviso(d.error ?? 'Could not send it.')
  }

  const nombre = (id: string) => sala?.jugadores.find((j) => j.id === id)?.nombre ?? 'Someone'
  const enCurso = sala && !['lobby', 'contexto', 'fin'].includes(sala.fase) && !sala.resultado

  return (
    <div className="center-screen alto observador">
      <div className="card wide stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="brand grow">Mission Control. Teacher view</div>
          <BotonAccesibilidad />
          <button className="small" onClick={() => salirVista(null)}>Stop watching</button>
        </div>

        {!sala && <p className={error ? 'bad' : 'muted'}>{error || 'Connecting to the room…'}</p>}

        {sala && (
          <>
            <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <h1 className="grow" style={{ margin: 0 }}>{sala.nombreMision || 'Unnamed mission'}</h1>
              <span className="mono muted">room {sala.codigo}</span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {escenarioDe(sala.escenario).nombre}. {FASE[sala.fase]}. {etiquetaTiempo({ t: sala.t, fase: sala.fase }, sala.tAterrizaje, C.SOL_S)}.
              {sala.pausa && <strong className="warn"> Paused.</strong>}
            </p>
            {error && <p className="mini bad">{error}</p>}
            {sala.resultado && (
              <div className={`help ${sala.resultado.victoria ? 'ok' : ''}`}>
                <strong>{sala.resultado.victoria ? 'Success' : 'Mission failed'}: {sala.resultado.titulo}.</strong> {sala.resultado.motivo}
              </div>
            )}

            <div className="obs-grid">
              <section className="panel">
                <h3>Crew</h3>
                {sala.jugadores.filter((j) => j.rol).length === 0 && <p className="mini muted">Nobody has picked a role yet.</p>}
                {sala.jugadores
                  .filter((j) => j.rol)
                  .map((j) => (
                    <div key={j.id} className={`obs-fila ${j.conectado ? '' : 'offline'}`}>
                      <RolTag rol={j.rol} />
                      <span className="grow">
                        {j.nombre}
                        <MarcaIA bot={j.bot} /> <small className="muted">{j.conectado ? '' : '(away)'}</small>
                        <small className="muted" style={{ display: 'block' }}>{ubicacion(j)}</small>
                      </span>
                      <span className="mini">Health <Estado valor={j.vit.salud} malo={40} regular={70} /></span>
                    </div>
                  ))}
              </section>

              <section className="panel">
                <h3>Resources</h3>
                <div className="obs-recursos mini">
                  <span>Water</span><b className="mono">{Math.round(sala.rec.agua)} kg</b>
                  <span>Oxygen</span><b className="mono">{Math.round(sala.rec.o2)} kg</b>
                  <span>Food</span><b className="mono">{Math.round(sala.rec.comida)} kg</b>
                  <span>Spare parts</span><b className="mono">{sala.rec.repuestos}</b>
                  <span>Medical kits</span><b className="mono">{sala.rec.botiquines}</b>
                  <span>Samples analyzed</span><b className="mono">{sala.mision.muestrasAnalizadas}/{sala.mision.muestrasObjetivo}</b>
                  <span>Days of water, air, food</span>
                  <b className="mono">
                    {[sala.autonomia.agua, sala.autonomia.aire, sala.autonomia.comida].map((d) => (d >= 999 ? 'plenty' : Math.round(d))).join(', ')}
                  </b>
                </div>
                <h3 style={{ marginTop: 10 }}>Critical points</h3>
                {sala.puntosCriticos.length === 0 ? (
                  <p className="mini ok">No alerts. Everything is normal.</p>
                ) : (
                  <ul className="mini obs-lista">
                    {sala.puntosCriticos.map((p, i) => <li key={i} className="warn">{p}</li>)}
                  </ul>
                )}
              </section>

              <section className="panel">
                <h3>Active emergencies</h3>
                {sala.emergencias.filter((e) => e.estado === 'activa').length === 0 && <p className="mini muted">None right now.</p>}
                {sala.emergencias
                  .filter((e) => e.estado === 'activa')
                  .map((e) => {
                    const quienes = sala.jugadores.filter((j) => j.rol && e.rolesResponsables.includes(j.rol)).map((j) => j.nombre)
                    return (
                      <div key={e.id} className="help">
                        <strong>{e.titulo}</strong> <span className="mono mini">{Math.max(0, Math.round((e.vence - ahora) / 1000))} s left</span>
                        <div className="mini">
                          Who decides: {e.rolesResponsables.map(nombreRol).join(', ')}
                          {quienes.length > 0 && ` (${quienes.join(', ')})`}.
                        </div>
                        <div className="mini muted">Options: {e.alternativas.map((a) => a.etiqueta).join(' / ')}</div>
                      </div>
                    )
                  })}

                <h3 style={{ marginTop: 10 }}>Proposals</h3>
                {sala.propuestas.length === 0 && <p className="mini muted">No proposals yet.</p>}
                <ul className="mini obs-lista">
                  {sala.propuestas.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <strong>{p.titulo}</strong>{' '}
                      <span className={`tag ${p.estado === 'aprobada' ? 'ok' : p.estado === 'rechazada' ? 'bad' : 'warn'}`}>
                        {p.estado === 'aprobada' ? 'approved' : p.estado === 'rechazada' ? 'rejected' : 'pending'}
                      </span>{' '}
                      <span className="muted">by {nombre(p.proponente)}, {Object.values(p.votos).filter(Boolean).length} in favor</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="panel">
                <h3>Decision reviews</h3>
                <Veredictos sala={sala} nombre={nombre} />
              </section>
            </div>

            <section className="panel">
              <h3>Talk to the crew as Mission Control</h3>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <input
                  className="grow"
                  placeholder="Message for the crew"
                  value={mensaje}
                  maxLength={200}
                  aria-label="Message for the crew"
                  onChange={(e) => setMensaje(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && mensaje.trim() && enviar('controlMensaje', { texto: mensaje })}
                />
                <button className="primary" disabled={!mensaje.trim()} onClick={() => enviar('controlMensaje', { texto: mensaje })}>Send</button>
                <button disabled={!enCurso} onClick={() => enviar('controlPausa', { pausa: !sala.pausa })} title="Stops mission time for everyone">
                  {sala.pausa ? 'Resume mission' : 'Pause for class discussion'}
                </button>
              </div>
              {aviso && <p className="mini muted" role="status">{aviso}</p>}
            </section>

            <section className="panel">
              <h3>Mission log</h3>
              <div className="log obs-log">
                {sala.registro
                  .slice(-25)
                  .reverse()
                  .map((l, i) => (
                    <div key={`${l.t}-${i}`} className={l.tipo}>
                      <span className="muted">{etiquetaTiempo(l, sala.tAterrizaje, C.SOL_S)}</span> {l.texto}
                    </div>
                  ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function Veredictos({ sala, nombre }: { sala: RoomState; nombre: (id: string) => string }) {
  const lista = [
    ...sala.emergencias.filter((e) => e.veredicto).map((e) => ({ id: e.id, titulo: e.titulo, v: e.veredicto! })),
    ...sala.propuestas.filter((p) => p.veredicto).map((p) => ({ id: p.id, titulo: p.titulo, v: p.veredicto! })),
  ].sort((a, b) => b.v.t - a.v.t)
  if (lista.length === 0) return <p className="mini muted">No decisions reviewed yet.</p>
  return (
    <ul className="mini obs-lista">
      {lista.slice(0, 8).map((x) => (
        <li key={x.id}>
          <span className={`tag ${x.v.nota === 'buena' ? 'ok' : x.v.nota === 'riesgosa' ? 'bad' : 'warn'}`}>{NOTA_TEXTO[x.v.nota]}</span> <strong>{x.titulo}.</strong>{' '}
          {x.v.porque} <span className="muted">Decided by {x.v.decisores.length ? x.v.decisores.map(nombre).join(', ') : 'nobody'}.</span>
        </li>
      ))}
    </ul>
  )
}
