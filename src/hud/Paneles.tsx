// Paneles fijos de la pantalla de juego: barra superior, mi estado, tripulación, puntos
// críticos y registro. Siguen el boceto del equipo: el mundo al centro, los integrantes a un
// lado con su oxígeno, salud y pulso, y los puntos críticos abajo.
import { useState } from 'react'
import { useGraficos } from '../graficos'
import { ASCENSO, llamadaCuenta, proximoEvento } from '@shared/ascenso'
import { C } from '@shared/ciencia'
import { ESCALAS, ESCALA_MAXIMA, ROLES, ROLE_BY_ID, SITE_BY_ID, etiquetaTiempo, formatoHora, type Player, type RoomState } from '@shared/types'
import { puede } from '../mundo/mapa'
import { api } from '../red'
import { useStore, useYo } from '../store'
import { sonido, useSonido } from '../sonido'
import { useVoz, voz } from '../voz'
import { Barra, Dato, MarcaIA, RolTag, enMarte, energiaUsada, escalaTexto, mmHg, nivel, pctTraje, relojMision, tiempoEnEspacio } from './comun'

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
  return (
    <div className="panel superior">
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
        </div>
      ) : sala.fase === 'transito' || sala.fase === 'llegada' ? (
        <div className="bloque datos">
          <Dato etiqueta="To Mars" valor={`${v.distMarte} M km`} barra={{ valor: v.progreso * 100 }} nota={`${Math.round(v.progreso * 100)}% of the trip done`} />
          <Dato etiqueta="Signal" valor={`${Math.floor(v.retardo / 60)} min ${v.retardo % 60} s`} nota={`How long a message takes to reach Earth, ${v.distTierra} million km away`} />
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
        <Dato etiqueta="Radiation" valor={`${a.radiacion} mSv/d`} tono={a.tormentaSolar ? 'bad' : undefined} nota="Background dose from cosmic rays" />
      </div>

      <div className="grow" />
      <div className="bloque" style={{ textAlign: 'right', marginLeft: 'auto' }}>
        <div className="mono mini">Room {sala.codigo}</div>
        <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
          <BotonesAudio />
          <button className="chip" onClick={alternar} title="Key H">Panels</button>
          <button className="chip" onClick={() => setFuentes(true)}>Sources</button>
          <button className="chip" onClick={() => api.salir()}>Leave</button>
        </div>
      </div>
    </div>
  )
}

/** Silenciar el sonido y activar el chat de voz. */
export function BotonesAudio() {
  const s = useSonido()
  const v = useVoz()
  const g = useGraficos()
  return (
    <>
      <button className="chip" title={g.calidad === 'alta' ? 'High quality graphics. Click for the lite version, better on simple computers.' : 'Lite graphics. Click for high quality.'} onClick={g.alternar}>
        {g.calidad === 'alta' ? 'HD' : 'Lite'}
      </button>
      <button className="chip" title={s.silenciado ? 'Turn sound on' : 'Mute'} onClick={() => (void sonido.activar(), sonido.silenciar(!s.silenciado))}>
        {s.silenciado ? 'Sound: off' : 'Sound'}
      </button>
      {v.disponible && (
        <button
          className={`chip ${v.activa ? 'activo' : ''}`}
          title={v.activa ? 'Leave voice chat' : 'Talk with the crew'}
          onClick={() => (v.activa ? voz.desactivar() : void voz.activar())}
        >
          {v.activa ? `Voice · ${v.conectados}` : 'Voice'}
        </button>
      )}
      {v.activa && v.microfono === 'si' && (
        <button className="chip" title="Microphone" onClick={() => voz.silenciar(!v.silenciado)}>
          {v.silenciado ? 'Mic: off' : 'Mic'}
        </button>
      )}
    </>
  )
}

const ACTIVIDAD: Record<Player['actividad'], string> = { sueno: 'Sleeping', reposo: 'Resting', trabajo: 'Working', ejercicio: 'Exercising', eva: 'Outside in the suit' }

/** El cuerpo y el traje del jugador. */
export function MiEstado({ sala, yo }: { sala: RoomState; yo: Player }) {
  const v = yo.vit
  const fuera = yo.zona === 'exterior'
  const o2 = pctTraje(yo.trajeO2)
  const aire = fuera ? `suit air: ${C.TRAJE_PRESION_KPA} kPa of pure oxygen` : `cabin air: ${sala.cabina.ppO2.toFixed(1)} kPa of O₂, ${mmHg(sala.cabina.ppCO2).toFixed(1)} mmHg of CO₂`
  return (
    <div className="panel estado">
      <div className="row" style={{ gap: 6 }}>
        <RolTag rol={yo.rol} />
        <strong className="grow">{yo.nombre}</strong>
        <span className="mini muted">{yo.incapacitado > 0 ? 'Out of action' : yo.enRefugio ? 'In the shelter' : ACTIVIDAD[yo.actividad]}</span>
      </div>
      <div className="vitales">
        <Dato etiqueta="Pulse" valor={`${Math.round(v.fc)} bpm`} tono={nivel(v.fc > 150, v.fc > 110)} nota="Heartbeats per minute" />
        <Dato etiqueta="Breathing" valor={`${Math.round(v.fr)} /min`} tono={nivel(v.fr > 34, v.fr > 24)} nota="Breaths per minute" />
        <Dato etiqueta="Blood O₂" valor={`${Math.round(v.spo2)}%`} tono={nivel(v.spo2 < 88, v.spo2 < 94)} nota={`You breathe ${aire}`} />
      </div>
      <div className="medidores">
        <Dato etiqueta="Health" valor={Math.round(v.salud)} tono={nivel(v.salud < 40, v.salud < 70)} barra={{ valor: v.salud }} />
        <Dato etiqueta="Hydration" valor={`${Math.round(v.hidratacion)}%`} tono={nivel(v.hidratacion < 60, v.hidratacion < 85)} barra={{ valor: v.hidratacion }} />
        <Dato etiqueta="Energy" valor={`${Math.round(v.reservas)}%`} tono={nivel(v.reservas < 50, v.reservas < 80)} barra={{ valor: v.reservas }} nota="Body reserves, based on what you eat and burn" />
        <Dato etiqueta="Fatigue" valor={`${Math.round(v.fatiga)}%`} tono={nivel(v.fatiga > 85, v.fatiga > 60)} barra={{ valor: v.fatiga }} />
        <Dato etiqueta="Muscle and bone" valor={`${Math.round(v.condicion)}%`} tono={nivel(v.condicion < 70, v.condicion < 88)} barra={{ valor: v.condicion }} nota="Lost without gravity and exercise" />
        <Dato
          etiqueta="Radiation"
          valor={`${v.dosis.toFixed(v.dosis < 10 ? 2 : 0)} mSv`}
          tono={nivel(v.dosis > C.LIMITE_CARRERA_MSV, v.dosis > 450)}
          barra={{ valor: v.dosis, max: C.LIMITE_CARRERA_MSV }}
          nota={`Now: ${v.dosisTasa} mSv per day. NASA career limit: ${C.LIMITE_CARRERA_MSV} mSv`}
        />
      </div>
      <div className="traje">
        <span className="mini muted">{fuera ? 'Suit in use' : 'Suit (charging in the airlock)'}</span>
        <div className="row" style={{ gap: 8 }}>
          <div className="grow">
            <div className="mini">Oxygen {o2}%</div>
            <Barra valor={o2} tono={nivel(o2 < 20, o2 < 40)} />
          </div>
          <div className="grow">
            <div className="mini">Battery {Math.round(yo.trajeBateria * 100)}%</div>
            <Barra valor={yo.trajeBateria * 100} tono={nivel(yo.trajeBateria < 0.2, yo.trajeBateria < 0.4)} />
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
        return (
          <div key={j.id} className={`crew-card ${j.id === yo?.id ? 'me' : ''} ${j.conectado ? '' : 'offline'}`}>
            <div className="row" style={{ gap: 6 }}>
              <RolTag rol={j.rol} />
              <strong className="grow">
                {j.nombre}
                <MarcaIA bot={j.bot} />
              </strong>
              <span className="mini muted">{j.incapacitado > 0 ? 'out of action' : j.enRefugio ? 'shelter' : j.zona === 'exterior' ? 'outside' : !j.conectado ? 'away' : j.manual === 'sueno' ? 'asleep' : ''}</span>
            </div>
            <div className="tres">
              <div>
                <span>Oxygen</span>
                <b className={nivel(v.spo2 < 88, v.spo2 < 94)}>{Math.round(v.spo2)}%</b>
              </div>
              <div>
                <span>Health</span>
                <b className={nivel(v.salud < 40, v.salud < 70)}>{Math.round(v.salud)}</b>
              </div>
              <div>
                <span>Pulse</span>
                <b className={nivel(v.fc > 150, v.fc > 110)}>{Math.round(v.fc)}</b>
              </div>
            </div>
            <Barra valor={v.salud} tono={nivel(v.salud < 40, v.salud < 70)} />
            <div className="mini muted progreso">
              {ACTIVIDAD[j.actividad]} · {j.aportes ?? 0} {(j.aportes ?? 0) === 1 ? 'task done' : 'tasks done'}
            </div>
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
        <div><span>Your pulse</span><b className={nivel(yo.vit.fc > 150, yo.vit.fc > 110)}>{Math.round(yo.vit.fc)} bpm</b></div>
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
