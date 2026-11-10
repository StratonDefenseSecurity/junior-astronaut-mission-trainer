// Paneles fijos de la pantalla de juego: barra superior, mi estado, tripulación, puntos
// críticos y registro. Siguen el boceto del equipo: el mundo al centro, los integrantes a un
// lado con su oxígeno, salud y pulso, y los puntos críticos abajo.
import { useEffect, useRef, useState } from 'react'
import { useGraficos } from '../graficos'
import { ASCENSO, llamadaCuenta, proximoEvento } from '@shared/ascenso'
import { C } from '@shared/ciencia'
import { ESCALAS, ESCALA_MAXIMA, ROLES, ROLE_BY_ID, SITE_BY_ID, etiquetaTiempo, formatoHora, type Player, type RoomState } from '@shared/types'
import { puede } from '../mundo/mapa'
import { api } from '../red'
import { useStore, useYo } from '../store'
import { sonido, useSonido } from '../sonido'
import { BotonAccesibilidad } from './Accesibilidad'
import { ChipConexion } from './Conexion'
import { BotonesVoz, IndicadorVoz } from './Voz'
import * as M from '@shared/medidores'
import { Barra, Dato, MarcaIA, RolTag, enMarte, energiaUsada, escalaTexto, nivel, relojMision, tiempoEnEspacio } from './comun'

const FASES: Record<RoomState['fase'], string> = {
  lobby: 'Room',
  contexto: 'Mission Briefing',
  lanzamiento: 'Launch',
  transito: 'Cruise to Mars',
  llegada: 'Mars Arrival',
  ensamblaje: 'Base Assembly',
  base: 'Mars Base',
  fin: 'Mission Over',
}

export function BarraSuperior({ sala }: { sala: RoomState }) {
  const yo = useYo()
  const setFuentes = useStore((s) => s.setFuentes)
  const alternar = useStore((s) => s.alternarPaneles)
  const reloj = relojMision(sala)
  const mando = puede(sala, yo, ['comandante'])
  const maxima = ESCALA_MAXIMA[sala.fase]
  const fija = sala.fase === 'lanzamiento' || (sala.fase === 'llegada' && sala.subfase === 'descenso')
  const frenada = !fija && sala.escala < Math.min(sala.escalaDeseada, maxima)
  const a = sala.ambiente
  const v = sala.vuelo
  // La altura de la barra cambia con el ancho de la pantalla: los paneles flotantes se colocan
  // debajo leyendo --alto-superior.
  const barra = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const e = barra.current
    if (!e || typeof ResizeObserver === 'undefined') return
    const raiz = document.documentElement
    const fijar = () => raiz.style.setProperty('--alto-superior', `${Math.round(e.getBoundingClientRect().bottom)}px`)
    const o = new ResizeObserver(fijar)
    o.observe(e)
    fijar()
    return () => {
      o.disconnect()
      raiz.style.removeProperty('--alto-superior')
    }
  }, [])
  return (
    <div className="panel superior" ref={barra}>
      <div className="bloque">
        <div className="brand">{FASES[sala.fase]}</div>
        <div className="reloj">{reloj.principal}</div>
        <div className="muted mini">{reloj.secundario}</div>
      </div>

      <div className="bloque escala">
        <div className="mini muted">Time Scale{sala.pausa ? ' · PAUSED' : ''}</div>
        <div className="row" style={{ gap: 4 }}>
          {fija ? (
            <span className="chip activo">×{sala.escala} · {escalaTexto(sala.escala)}</span>
          ) : (
            ESCALAS.filter((e) => e.valor <= maxima).map((e) => (
              <button
                key={e.valor}
                className={`chip ${sala.escalaDeseada === e.valor ? 'activo' : ''}`}
                disabled={!mando}
                title={mando ? e.detalle : 'The Mission Commander controls the time scale'}
                onClick={() => api.escala(e.valor)}
              >
                {e.nombre}
              </button>
            ))
          )}
          {!fija && mando && (
            <button className="chip" onClick={() => api.pausa(!sala.pausa)}>
              {sala.pausa ? 'Resume' : 'Pause'}
            </button>
          )}
          {!fija && mando && (
            <button
              className="chip"
              title="End the mission now and see the debrief"
              onClick={() => window.confirm('End the mission now? You will see the debrief with what the crew achieved.') && api.accion('terminar')}
            >
              End mission
            </button>
          )}
        </div>
        <div className="mini" style={{ color: frenada ? 'var(--warn)' : 'var(--muted)' }}>
          {frenada ? `Running at ×${sala.escala}: there is an alert or someone is outside` : escalaTexto(sala.escala)}
        </div>
      </div>

      {enMarte(sala) ? (
        <div className="bloque datos">
          <Dato etiqueta="Outside" valor={`${a.tempExt} °C`} nota={`Curiosity data from sol ${a.solCuriosity}`} />
          <Dato etiqueta="Pressure" valor={`${a.presion} Pa`} />
          <Dato etiqueta="Dust" valor={a.tau.toFixed(1)} tono={nivel(a.tau > 2.5, a.tau > 1.2)} nota="Sky opacity (game model)" />
          <Dato etiqueta="Sunlight" valor={`${a.flujoSolar} W/m²`} />
          <Dato etiqueta="Site" valor={SITE_BY_ID[sala.sitio ?? 'gale'].nombre} />
          <Enlace sala={sala} />
        </div>
      ) : sala.fase === 'transito' || sala.fase === 'llegada' ? (
        <div className="bloque datos">
          <Dato etiqueta="To Mars" valor={`${v.distMarte} M km`} barra={{ valor: v.progreso * 100 }} nota={`${Math.round(v.progreso * 100)}% of the trip done`} />
          <Enlace sala={sala} />
          <Dato etiqueta="In space" valor={tiempoEnEspacio(sala)} nota="Days and hours since you reached orbit" />
          <Dato etiqueta="Fuel" valor={`${Math.round(sala.rec.propelente)}%`} tono={nivel(sala.rec.propelente < 10, sala.rec.propelente < 30)} nota="Propellant left to correct course and land" />
          <Dato etiqueta="Energy used" valor={energiaUsada(sala)} nota="Electricity used since liftoff" />
        </div>
      ) : (
        <div className="bloque datos">
          <Dato etiqueta="Stage" valor={v.etapa} />
          <Dato etiqueta="Altitude" valor={`${v.altitud} km`} />
          <Dato etiqueta="Speed" valor={`${v.velocidad} km/s`} />
          <Dato etiqueta="Acceleration" valor={`${v.g} g`} tono={nivel(v.g > 4, v.g > 2.5)} />
          <Dato etiqueta="Fuel" valor={`${Math.round(sala.rec.propelente)}%`} nota="Propellant in the stage that is firing" />
          <Dato etiqueta="Energy used" valor={energiaUsada(sala)} nota="Electricity used since liftoff" />
        </div>
      )}

      <div className="bloque datos">
        {enMarte(sala) && <Dato etiqueta="Samples" valor={`${sala.mision.muestrasAnalizadas}/${sala.mision.muestrasObjetivo}`} />}
        <Dato etiqueta="Space radiation" valor={M.tasaTexto(a.radiacion)} tono={a.tormentaSolar ? 'bad' : undefined} nota="Unshielded dose outside the ship. Your own dose rate is in your status panel." />
      </div>

      <div className="grow" />
      <div className="bloque acciones-superior" style={{ textAlign: 'right', marginLeft: 'auto' }}>
        <div className="row mision-linea">
          <div className="mision-nombre" title={`Room code ${sala.codigo}. Others use it to join.`}>
            <strong>{sala.nombreMision || 'Unnamed mission'}</strong> <span className="mono mini muted">room {sala.codigo}</span>
          </div>
          <ChipConexion />
        </div>
        <div className="row" style={{ gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <BotonesAudio sala={sala} />
          <button className="chip" onClick={alternar} title="Key H">Panels</button>
          <BotonAccesibilidad chip />
          <button className="chip" onClick={() => setFuentes(true)}>Sources</button>
          <button className="chip" onClick={() => api.salir()}>Leave</button>
        </div>
      </div>
    </div>
  )
}

/** Silenciar el sonido y activar el chat de voz. */
export function BotonesAudio({ sala }: { sala: RoomState }) {
  const s = useSonido()
  const g = useGraficos()
  return (
    <>
      <button className="chip" title={g.calidad === 'alta' ? 'High quality graphics. Click for the lite version, better on simple computers.' : 'Lite graphics. Click for high quality.'} onClick={g.alternar}>
        {g.calidad === 'alta' ? 'HD' : 'Lite'}
      </button>
      <button className="chip" title={s.silenciado ? 'Turn sound on' : 'Mute'} onClick={() => (void sonido.activar(), sonido.silenciar(!s.silenciado))}>
        {s.silenciado ? 'Sound: off' : 'Sound'}
      </button>
      <BotonesVoz sala={sala} />
    </>
  )
}

const ACTIVIDAD: Record<Player['actividad'], string> = { sueno: 'Sleeping', reposo: 'Resting', trabajo: 'Working', ejercicio: 'Exercising', eva: 'Outside in the suit' }

/** El cuerpo y el traje del jugador. */
export function MiEstado({ sala, yo }: { sala: RoomState; yo: Player }) {
  const v = yo.vit
  const fuera = yo.zona === 'exterior'
  const o2 = M.trajeO2(yo)
  const bat = M.trajeBateria(yo)
  const aire = fuera ? `suit air: ${C.TRAJE_PRESION_KPA} kPa of pure oxygen` : `cabin air. Cabin O₂ ${M.o2Cabina(sala).texto}, cabin CO₂ ${M.co2Cabina(sala).texto}`
  const d = (l: M.Lectura) => ({ valor: l.texto, tono: l.tono })
  return (
    <div className="panel estado">
      <div className="row" style={{ gap: 6 }}>
        <RolTag rol={yo.rol} />
        <strong className="grow">{yo.nombre}</strong>
        <span className="mini muted">{yo.incapacitado > 0 ? 'Out of action' : yo.enRefugio ? (yo.actividad === 'sueno' ? 'Sleeping in the shelter' : 'In the shelter') : ACTIVIDAD[yo.actividad]}</span>
      </div>
      <div className="vitales">
        <Dato etiqueta="Your pulse" {...d(M.pulso(yo))} nota="Heartbeats per minute" />
        <Dato etiqueta="Your breathing" {...d(M.respiracion(yo))} nota="Breaths per minute" />
        <Dato etiqueta="Your SpO₂" {...d(M.spo2(yo))} nota={`Oxygen in your blood. You breathe ${aire}`} />
      </div>
      <div className="medidores">
        <Dato etiqueta="Health" {...d(M.salud(yo))} barra={{ valor: v.salud }} />
        <Dato etiqueta="Hydration" {...d(M.hidratacion(yo))} barra={{ valor: v.hidratacion }} />
        <Dato etiqueta="Energy" {...d(M.reservas(yo))} barra={{ valor: v.reservas }} nota="Body reserves, based on what you eat and burn" />
        <Dato etiqueta="Fatigue" {...d(M.fatiga(yo))} barra={{ valor: v.fatiga }} />
        <Dato etiqueta="Muscle and bone" {...d(M.condicion(yo))} barra={{ valor: v.condicion }} nota="Lost without gravity and exercise" />
        <Dato
          etiqueta="Your dose"
          {...d(M.dosis(yo))}
          barra={{ valor: v.dosis, max: C.LIMITE_CARRERA_MSV }}
          nota={`Your dose rate now: ${M.tasaTexto(v.dosisTasa)}. NASA career limit: ${C.LIMITE_CARRERA_MSV} mSv`}
        />
      </div>
      <div className="traje">
        <span className="mini muted">{fuera ? 'Suit in use' : 'Suit (charging in the airlock)'}</span>
        <div className="row" style={{ gap: 8 }}>
          <div className="grow">
            <div className="mini">Suit O₂ {o2.texto}</div>
            <Barra valor={o2.valor} tono={o2.tono} />
          </div>
          <div className="grow">
            <div className="mini">Suit battery {bat.texto}</div>
            <Barra valor={bat.valor} tono={bat.tono} />
          </div>
        </div>
      </div>
      {yo.dolencia && <div className="help">You have {yo.dolencia}. See the Flight Surgeon.</div>}
      {yo.muestras > 0 && <div className="help ok">You are carrying {yo.muestras} sample(s). Analyze them in the lab.</div>}
    </div>
  )
}

/** Los integrantes: oxígeno, salud y pulso de cada uno, y las peticiones de ayuda. */
export function Tripulacion({ sala }: { sala: RoomState }) {
  const yo = useYo()
  const [paraRol, setParaRol] = useState('medico')
  const [motivo, setMotivo] = useState('')
  const [pidiendo, setPidiendo] = useState(false)
  const crew = sala.jugadores.filter((j) => j.rol)
  return (
    <div className="panel tripulacion">
      <h3>Crew</h3>
      {crew.map((j) => {
        const v = j.vit
        const puedoIr = j.ayuda && yo && j.id !== yo.id && (yo.rol === j.ayuda.paraRol || yo.rol === 'comandante')
        const dormido = j.actividad === 'sueno' && j.incapacitado <= 0
        const sp = M.spo2(j)
        const sa = M.salud(j)
        const pu = M.pulso(j)
        return (
          <div key={j.id} className={`crew-card ${j.id === yo?.id ? 'me' : ''} ${j.conectado ? '' : 'offline'}`}>
            <div className="row" style={{ gap: 6 }}>
              <RolTag rol={j.rol} />
              <strong className="grow">
                {j.nombre}
                <MarcaIA bot={j.bot} />
                <IndicadorVoz id={j.id} yo={j.id === yo?.id} />
              </strong>
              <span className="mini muted">{j.incapacitado > 0 ? 'out of action' : dormido ? 'asleep' : j.enRefugio ? 'shelter' : j.zona === 'exterior' ? 'outside' : !j.conectado ? 'away' : ''}</span>
            </div>
            <div className="tres">
              <div>
                <span>SpO₂</span>
                <b className={sp.tono}>{sp.texto}</b>
              </div>
              <div>
                <span>Health</span>
                <b className={sa.tono}>{sa.texto}</b>
              </div>
              <div>
                <span>Pulse</span>
                <b className={pu.tono}>{pu.valor}</b>
              </div>
            </div>
            <Barra valor={v.salud} tono={sa.tono} />
            <div className="mini muted progreso">
              {ACTIVIDAD[j.actividad]} · {j.aportes ?? 0} {(j.aportes ?? 0) === 1 ? 'task done' : 'tasks done'}
            </div>
            {dormido && yo && j.id !== yo.id && j.zona === yo.zona && (
              <button className="small" style={{ marginTop: 5 }} onClick={() => api.despertar(j.id)}>
                Wake {j.nombre} up
              </button>
            )}
            {j.ayuda && (
              <div className="help">
                <strong>Asks the {ROLE_BY_ID[j.ayuda.paraRol].nombre} for help:</strong> {j.ayuda.motivo}
                {puedoIr && (
                  <button className="small ok" style={{ marginTop: 5, display: 'block' }} onClick={() => api.irAyudar(j.id)}>
                    Go help
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
      {yo && !yo.ayuda && (
        pidiendo ? (
          <div className="stack" style={{ gap: 5 }}>
            <select value={paraRol} onChange={(e) => setParaRol(e.target.value)}>
              {ROLES.filter((r) => r.id !== yo.rol).map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
            <input placeholder="What do you need?" value={motivo} maxLength={120} onChange={(e) => setMotivo(e.target.value)} />
            <div className="row" style={{ gap: 5 }}>
              <button
                className="small primary"
                disabled={!motivo.trim()}
                onClick={() => {
                  api.pedirAyuda(paraRol, motivo)
                  setMotivo('')
                  setPidiendo(false)
                }}
              >
                Send
              </button>
              <button className="small" onClick={() => setPidiendo(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="small" onClick={() => setPidiendo(true)}>Ask a crewmate for help</button>
        )
      )}
      {yo?.ayuda && <div className="help">You asked the {ROLE_BY_ID[yo.ayuda.paraRol].nombre} for help. Waiting.</div>}
    </div>
  )
}

export function PuntosCriticos({ sala }: { sala: RoomState }) {
  return (
    <div className="panel criticos">
      <h3>Critical Points</h3>
      <div className="critical">
        {sala.puntosCriticos.length === 0 ? <span className="ok">No alerts. Everything is normal.</span> : sala.puntosCriticos.map((p, i) => <span key={i} className="tag">{p}</span>)}
      </div>
    </div>
  )
}

export function Registro({ sala }: { sala: RoomState }) {
  const ultimos = sala.registro.slice(-7).reverse()
  return (
    <div className="panel registro">
      <h3>Mission Log</h3>
      <div className="log">
        {ultimos.map((l, i) => (
          <div key={`${l.t}-${i}`} className={l.tipo}>
            <span className="muted">{etiquetaTiempo(l, sala.tAterrizaje, C.SOL_S)}</span> {l.texto}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Telemetría grande durante el lanzamiento y el descenso. */
export function Telemetria({ sala, yo }: { sala: RoomState; yo: Player }) {
  const v = sala.vuelo
  const lanzamiento = sala.fase === 'lanzamiento'
  const cuenta = sala.t < 0
  // Las llamadas reales de la cuenta terminal de Artemis I y el próximo evento del ascenso.
  const llamada = lanzamiento ? llamadaCuenta(sala.t) : null
  const proximo = lanzamiento && !cuenta ? proximoEvento(sala.t) : null
  return (
    <div className="telemetria">
      <div className="etapa">{cuenta ? `T−${Math.ceil(-sala.t)} · Liftoff in ${Math.ceil(-sala.t)}` : v.etapa}</div>
      {llamada && <div className="llamada">“{llamada}”</div>}
      {proximo && !llamada && (
        <div className="llamada muted">
          Next: {proximo.nombre} at T+{Math.floor(proximo.t / 60)}:{String(proximo.t % 60).padStart(2, '0')}, in {Math.ceil(proximo.t - sala.t)} s
        </div>
      )}
      <div className="fila">
        <div><span>Altitude</span><b>{v.altitud} km</b></div>
        <div><span>Speed</span><b>{sala.fase === 'lanzamiento' ? `${v.velocidad} km/s` : `${Math.round(v.velocidad * 3600).toLocaleString('en-US')} km/h`}</b></div>
        <div><span>Acceleration</span><b className={nivel(v.g > 4, v.g > 2.5)}>{v.g} g</b></div>
        <div><span>Your pulse</span><b className={M.pulso(yo).tono}>{M.pulso(yo).texto}</b></div>
      </div>
      <div className="fila gasto">
        <div><span>{lanzamiento ? (sala.t >= ASCENSO.separacionCentral ? 'Fuel (upper stage)' : 'Fuel (core stage)') : 'Fuel'}</span><b className={nivel(false, !lanzamiento && sala.rec.propelente < 25)}>{Math.round(sala.rec.propelente)}%</b></div>
        <div><span>Energy used</span><b>{energiaUsada(sala)}</b></div>
        <div><span>{sala.fase === 'lanzamiento' ? 'Flight time' : 'In space'}</span><b>{sala.fase === 'lanzamiento' ? (cuenta ? 'on the ground' : `${Math.floor(sala.t / 60)} min ${Math.floor(sala.t % 60)} s`) : tiempoEnEspacio(sala)}</b></div>
      </div>
      <div className="muted mini">
        {sala.fase === 'lanzamiento'
          ? 'This is the real climb of Artemis I, launched by the SLS rocket from Pad 39B on November 16, 2022. The acceleration presses you into your seat, and your heart beats faster to keep blood flowing to your head.'
          : 'This is the real descent of Perseverance. The capsule enters at 19,200 km/h and in seven minutes touches down at less than 3 km/h. Earth cannot help: the signal takes too long.'}
      </div>
    </div>
  )
}

export const horaLocal = (sala: RoomState) => formatoHora(sala.ambiente.hora)

/** Enlace con la Tierra: estado y retardo real de la señal en un sentido. */
function Enlace({ sala }: { sala: RoomState }) {
  const l = M.enlace(sala.vuelo)
  const v = sala.vuelo
  const nota =
    l.estado === 'conjuncion'
      ? `Solar conjunction: the Sun is ${v.elongacion ?? 0}° from Mars in Earth's sky. NASA sends no commands below ${C.CONJUNCION_GRADOS}°. Messages wait.`
      : `One-way light time to Earth, ${v.distTierra} million km away.${v.elongacion !== undefined ? ` Sun to Mars angle seen from Earth: ${v.elongacion}°.` : ''}`
  return <Dato etiqueta="Earth link" valor={l.texto.replace('DSN link: ', 'DSN ')} tono={l.tono === 'ok' ? undefined : l.tono} nota={nota} />
}
