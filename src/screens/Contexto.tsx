// Contextualización, en el orden del esquema del equipo:
//   1. A cada integrante se le da la situación que tiene que afrontar.
//   2. Asignación de roles.
//   3. Se establece el objetivo de la misión.
//   4. Se presentan alternativas sobre la cantidad de suministros y se eligen.
// Es una interfaz sencilla, de un paso por pantalla. El asistente analiza las consecuencias
// de cada rol y de cada elección.
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { C, PRESION_TIERRA_PA, REMS_RESUMEN, minutosDeSenalAlLlegar } from '@shared/ciencia'
import { escenarioDe, fechaLarga } from '@shared/escenarios'
import { ALTERNATIVAS, analizarCarga, cargaRecomendada, minimoDe } from '@shared/plan'
import {
  PASOS_CONTEXTO,
  PERFILES,
  ROLES,
  ROLE_BY_ID,
  SITE_BY_ID,
  SUPPLIES,
  TRAYECTORIAS,
  masaTotal,
  tareasDeRol,
  type Player,
  type RoomState,
  type SupplyId,
} from '@shared/types'
import { Barra, MarcaIA, RolTag, nivel } from '../hud/comun'
import { puede } from '../mundo/mapa'
import { api } from '../red'
import { useStore } from '../store'
import { VistaTraje } from './Lobby'

interface P {
  sala: RoomState
  yo: Player
}

/** Lo que está haciendo cada integrante, para verlo desde los demás puestos. */
const HACIENDO = ['Reading the situation', 'Choosing a role', 'Checking the objective', 'Choosing supplies']

function Asistente({ children }: { children: ReactNode }) {
  return (
    <div className="assistant">
      <strong>Assistant:</strong> {children}
    </div>
  )
}

// ---------- Paso 1: la situación ----------

function Situacion({ sala, alSeguir }: { sala: RoomState; alSeguir: () => void }) {
  const setFuentes = useStore((s) => s.setFuentes)
  const n = analizarCarga(sala).n
  const dias = TRAYECTORIAS.map((t) => t.dias)
  const senal = dias.map(minutosDeSenalAlLlegar)
  const presion = ((REMS_RESUMEN.pMax / PRESION_TIERRA_PA) * 100).toFixed(1)
  const datos = [
    {
      etiqueta: 'The trip',
      valor: `${Math.min(...dias)} to ${Math.max(...dias)} days`,
      texto: 'It depends on the trajectory you choose. The whole time you will live inside the ship, with no gravity and no way to get off.',
    },
    {
      etiqueta: 'Earth, far away',
      valor: `${Math.min(...senal)} to ${Math.max(...senal)} minutes`,
      texto: 'That is how long a message will take to arrive once you are at Mars. You will make the urgent decisions yourselves.',
    },
    {
      etiqueta: 'The air on Mars',
      valor: `${REMS_RESUMEN.pMin} to ${REMS_RESUMEN.pMax} pascals`,
      texto: `Measured by Curiosity: at most ${presion}% of the pressure on Earth. It is almost all carbon dioxide. Outside the habitat you only survive in a suit.`,
    },
    {
      etiqueta: 'The cold',
      valor: `${REMS_RESUMEN.tMin} to ${REMS_RESUMEN.tMax} °C`,
      texto: `Measured by the Curiosity rover over ${REMS_RESUMEN.soles} sols, a full Martian year. That will be the weather at your base.`,
    },
    {
      etiqueta: 'Radiation',
      valor: `${C.GCR_CRUCERO_MSV_DIA} mSv every day`,
      texto: `from cosmic rays during the trip. The NASA limit for a whole career is ${C.LIMITE_CARRERA_MSV} mSv, and solar storms add more.`,
    },
    {
      etiqueta: 'Each person, each day',
      valor: '0.84 kg of oxygen',
      texto: `plus ${C.AGUA_BEBIDA_KG_DIA} kg of drinking water and ${C.COMIDA_KG_DIA} kg of food. Multiply that by ${n} crew members and hundreds of days.`,
    },
  ]
  const esc = escenarioDe(sala.escenario)
  return (
    <div className="stack">
      <div className="escenario-cabecera">
        <h2>{esc.nombre}</h2>
        <span className="fecha">Liftoff: {fechaLarga(new Date(esc.lanzamiento))}</span>
      </div>
      {esc.situacion.map((t, i) => (
        <p key={i} className="entrada">{t}</p>
      ))}
      <div className="situacion especial">
        {esc.hechos.map((d) => (
          <div key={d.etiqueta} className="hecho">
            <span>{d.etiqueta}</span>
            <b>{d.valor}</b>
            <p>{d.texto}</p>
          </div>
        ))}
      </div>
      <div className="reto">
        <strong>The challenge of this mission</strong>
        {esc.reto}
      </div>
      <h3>What every crew traveling to Mars faces</h3>
      <p className="mini muted">You are a crew of {n}. Nobody is waiting for you there and nobody can come to get you. What you carry on the ship is all you will have.</p>
      <div className="situacion">
        {datos.map((d) => (
          <div key={d.etiqueta} className="hecho">
            <span>{d.etiqueta}</span>
            <b>{d.valor}</b>
            <p>{d.texto}</p>
          </div>
        ))}
      </div>
      <div className="action">
        <strong>What you have to achieve</strong>
        <p className="mini">Reach Mars, build the base, keep the whole crew alive and analyze soil samples. You will decide how many sols you stay and how many samples you analyze later, when you set the objective.</p>
      </div>
      <Asistente>
        I will be with you for the whole mission. Now each of you gets a role. Then you set the objective, and last you choose the supplies. For each choice, I will tell you what it means.
      </Asistente>
      {esc.supuestos.length > 0 && (
        <div>
          <span className="mini muted">Game assumptions for this situation:</span>
          <ul className="supuestos">
            {esc.supuestos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="row">
        <button className="small plano" onClick={() => setFuentes(true)}>Where the data comes from</button>
        <div className="grow" />
        <button className="primary" onClick={alSeguir}>Got it: see the roles</button>
      </div>
    </div>
  )
}

// ---------- Paso 2: asignación de roles ----------

function Roles({ sala, yo, alSeguir }: P & { alSeguir: () => void }) {
  const mio = yo.rol ? ROLE_BY_ID[yo.rol] : null
  const n = sala.jugadores.filter((j) => j.conectado || j.rol).length
  const hayComandante = sala.jugadores.some((j) => j.rol === 'comandante')
  return (
    <div className="lobby">
      <div className="stack">
        <p className="mini muted">Each role has its own tasks and different consequences if it fails. Pick yours. Two people cannot have the same role.</p>
        <div className="roles-grid">
          {ROLES.map((r) => {
            const dueno = sala.jugadores.find((j) => j.rol === r.id)
            const esMio = dueno?.id === yo.id
            // En el modo de un jugador, el bot cede su rol si la persona lo pide.
            const tomado = Boolean(dueno) && !esMio && !dueno?.bot
            return (
              <button key={r.id} className={`role-card ${tomado ? 'taken' : ''} ${esMio ? 'mine' : ''}`} disabled={tomado} onClick={() => api.elegirRol(esMio ? null : r.id)}>
                <div className="row">
                  <span className="tag" style={{ color: r.color }}>{r.corto}</span>
                  <strong className="grow">{r.nombre}</strong>
                  {dueno && (
                    <span className="muted">
                      {esMio ? 'you' : dueno.nombre}
                      <MarcaIA bot={dueno.bot} />
                    </span>
                  )}
                </div>
                <span className="muted">{r.descripcion}</span>
                <span className="mini">Tasks: {tareasDeRol(r.id).map((t) => t.charAt(0).toLowerCase() + t.slice(1)).join('; ')}.</span>
                <span className="consecuencia">{r.consecuencias}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="stack lobby-lado">
        <h3>{mio ? `Your role: ${mio.nombre}` : 'You have no role yet'}</h3>
        <VistaTraje traje={yo.traje} distintivo={mio?.color ?? '#94a3b8'} />
        <Asistente>
          {mio ? `${mio.consecuencias} You can change roles until liftoff.` : 'Pick a role from the list. I will tell you what it means.'}
        </Asistente>
        {!hayComandante && <div className="help">Nobody is the Mission Commander yet. You cannot launch without one.</div>}
        {n < ROLES.length && (
          <p className="mini muted">
            You are {n}, so {ROLES.length - n} roles will stay empty. Any of you can do their tasks.
          </p>
        )}
        <button className="primary" disabled={!mio} onClick={alSeguir}>Continue: mission objective</button>
      </div>
    </div>
  )
}

// ---------- Paso 3: objetivo de la misión ----------

/** El comandante bautiza la misión; los demás ven el nombre. */
function NombreMision({ sala, editable }: { sala: RoomState; editable: boolean }) {
  const [texto, setTexto] = useState(sala.nombreMision)
  useEffect(() => setTexto(sala.nombreMision), [sala.nombreMision])
  const guardar = () => {
    if (texto.trim() !== sala.nombreMision) void api.nombrarMision(texto)
  }
  if (!editable) return <div className="nombre-mision">{sala.nombreMision || 'No name yet'}</div>
  return (
    <input
      className="nombre-mision"
      value={texto}
      maxLength={28}
      placeholder="For example: Inti 1, Chaski, Hope…"
      onChange={(e) => setTexto(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && (e.currentTarget.blur(), guardar())}
    />
  )
}

function Objetivo({ sala, yo, alSeguir }: P & { alSeguir: () => void }) {
  const a = analizarCarga(sala)
  const esc = escenarioDe(sala.escenario)
  const comandante = sala.jugadores.find((j) => j.rol === 'comandante')
  const mando = puede(sala, yo, ['comandante'])
  const navega = puede(sala, yo, ['piloto', 'comandante'])
  return (
    <div className="contexto-rejilla">
      <div className="stack">
        <h3>How long do you stay on Mars? {mando ? '' : '· the Mission Commander decides'}</h3>
        <div className="opciones">
          {PERFILES.map((p) => (
            <button key={p.id} className={`opcion ${sala.perfil === p.id ? 'activa' : ''}`} disabled={!mando || sala.perfil === p.id} onClick={() => api.perfil(p.id)}>
              <strong>{p.nombre}</strong>
              <small>{p.descripcion}</small>
            </button>
          ))}
        </div>
        <h3>Which route do you take? {navega ? '' : '· the Pilot or the Mission Commander decides'}</h3>
        <div className="opciones">
          {TRAYECTORIAS.map((t) => (
            <button key={t.id} className={`opcion ${sala.trayectoria === t.id ? 'activa' : ''}`} disabled={!navega || sala.trayectoria === t.id} onClick={() => api.trayectoria(t.id)}>
              <strong>{t.nombre}</strong>
              <small>{t.descripcion}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="stack">
        <div className="action objetivo">
          <span className="brand">Mission objective</span>
          <p>{sala.mision.objetivo}</p>
          <span className="mini muted">
            {comandante ? `Set by ${comandante.nombre}, Mission Commander.` : 'There is no Mission Commander yet. For now, anyone with a role can set it.'}
          </span>
        </div>
        <label className="stack" style={{ gap: 4 }}>
          <span className="mini muted">Mission name {mando ? '· it will appear on the ship, the suits and the final certificate' : '· the Mission Commander names it'}</span>
          <NombreMision sala={sala} editable={mando} />
        </label>
        {esc.sitio && (
          <Asistente>
            This mission will land at {SITE_BY_ID[esc.sitio].nombre}. {SITE_BY_ID[esc.sitio].descripcion}
          </Asistente>
        )}
        <Asistente>
          With this plan you will spend {Math.round(a.total)} days away from Earth: {a.viaje} traveling and {Math.round(a.estancia)} on the surface.
        </Asistente>
        <ul className="analisis">
          <Linea bien={a.dosis < 480} regular={a.dosis < C.LIMITE_CARRERA_MSV}>
            Background radiation: about {Math.round(a.dosis)} mSv per person, out of a limit of {C.LIMITE_CARRERA_MSV}. A shorter trip lowers it.
          </Linea>
          <Linea bien>
            The ship can carry {sala.capacidad.toFixed(1)} tons of cargo on this trajectory. The fastest one burns more propellant and leaves less room.
          </Linea>
          <Linea bien>
            More sols on Mars need more food, more water and more spare parts. You will see this in the next step.
          </Linea>
        </ul>
        <div className="row">
          <div className="grow" />
          <button className="primary" onClick={alSeguir}>Continue: supplies</button>
        </div>
      </div>
    </div>
  )
}

// ---------- Paso 4: suministros ----------

function Linea({ bien, regular, children }: { bien: boolean; regular?: boolean; children: ReactNode }) {
  const tono = nivel(!bien && !regular, !bien && Boolean(regular))
  return (
    <li className={tono}>
      <span className="marca">{bien ? '✓' : regular ? '!' : '✗'}</span> <span>{children}</span>
    </li>
  )
}

function Suministros({ sala, yo }: P) {
  const [ultimo, setUltimo] = useState<SupplyId | null>(null)
  const a = analizarCarga(sala)
  const exceso = sala.masa > sala.capacidad
  const mando = puede(sala, yo, ['comandante'])
  const hayComandante = sala.jugadores.some((j) => j.rol === 'comandante')
  const sinRol = sala.jugadores.filter((j) => j.conectado && !j.rol)
  const faltan = sala.jugadores.filter((j) => j.conectado && j.rol && j.id !== yo.id && !j.listo)
  const item = ultimo ? SUPPLIES.find((s) => s.id === ultimo)! : null
  const impide = exceso
    ? 'The cargo is more than the ship can carry. You have to leave something behind.'
    : !hayComandante
      ? 'Someone still has to take the Mission Commander role.'
      : sinRol.length
        ? `Still choosing a role: ${sinRol.map((j) => j.nombre).join(', ')}.`
        : faltan.length
          ? `Still need to confirm: ${faltan.map((j) => j.nombre).join(', ')}.`
          : null

  return (
    <div className="contexto-rejilla">
      <div className="stack">
        <h3>Three options</h3>
        <div className="opciones">
          {ALTERNATIVAS.map((alt) => {
            const carga = cargaRecomendada(sala, alt.margen)
            const masa = masaTotal(carga)
            const elegida = SUPPLIES.every((s) => carga[s.id] === sala.cargamento[s.id])
            return (
              <button key={alt.id} className={`opcion ${elegida ? 'activa' : ''}`} onClick={() => { setUltimo(null); void api.preset(alt.id) }}>
                <strong>
                  {alt.nombre} · {masa.toFixed(1)} t {masa > sala.capacidad ? <i className="bad">does not fit</i> : null}
                </strong>
                <small>{alt.descripcion}</small>
              </button>
            )
          })}
        </div>

        <details className="ajuste">
          <summary>Adjust quantities by hand</summary>
          <div className="suministros">
            {SUPPLIES.map((s) => (
              <div key={s.id} className="supply">
                <div>
                  <div className="row" style={{ gap: 6 }}>
                    <strong className="grow">{s.nombre}</strong>
                    <small>{(s.masa * sala.cargamento[s.id]).toFixed(2)} t</small>
                  </div>
                  <input
                    type="range"
                    min={Math.max(s.min, minimoDe(sala, s.id))}
                    max={s.max}
                    value={sala.cargamento[s.id]}
                    aria-label={s.nombre}
                    onChange={(e) => {
                      setUltimo(s.id)
                      api.cargamento({ [s.id]: Number(e.target.value) })
                    }}
                  />
                </div>
                <div className="val">
                  {sala.cargamento[s.id]} <small>{s.unidad}</small>
                </div>
              </div>
            ))}
          </div>
        </details>
        {item && (
          <Asistente>
            <b>{item.nombre}.</b> {item.consecuencia}
          </Asistente>
        )}
      </div>

      <div className="stack">
        <h3>The assistant checks the consequences</h3>
        {escenarioDe(sala.escenario).consejo && <Asistente>{escenarioDe(sala.escenario).consejo}</Asistente>}
        <div className="row" style={{ gap: 6 }}>
          <span className="mini muted">Cargo</span>
          <div className="grow"><Barra valor={sala.masa} max={sala.capacidad} tono={nivel(exceso, sala.masa > sala.capacidad * 0.93)} /></div>
          <span className={`mono mini ${exceso ? 'bad' : ''}`}>{sala.masa.toFixed(1)} / {sala.capacidad.toFixed(1)} t</span>
        </div>
        <ul className="analisis">
          <Linea bien={a.comida >= a.total} regular={a.comida >= a.total * 0.85}>
            Food for {Math.round(a.comida)} days. The mission lasts {Math.round(a.total)}. Food cannot be recycled.
          </Linea>
          <Linea bien={a.agua >= a.total} regular={a.agua >= a.total * 0.85}>
            Water for about {Math.round(a.agua)} days, recycling 98% of it and using it to make oxygen.
          </Linea>
          <Linea bien={a.aireTanques >= 10} regular={a.aireTanques >= 4}>
            Oxygen tanks for {Math.round(a.aireTanques)} days if the generator fails.
          </Linea>
          <Linea bien={a.energia >= 7.5} regular={a.energia >= 6}>
            Average power on Mars: {a.energia.toFixed(1)} kW. The base uses about 7.
          </Linea>
          <Linea bien={a.noche >= 150} regular={a.noche >= 90 || sala.cargamento.reactor > 0}>
            Batteries: {a.noche} kWh. A Martian night needs about 85{sala.cargamento.reactor ? '. The reactor also works at night' : ''}.
          </Linea>
          <Linea bien={sala.cargamento.blindaje >= 1} regular>
            {sala.cargamento.blindaje} shielding layer(s) in the shelter for solar storms.
          </Linea>
          {sala.mision.aguaObjetivo > 0 && (
            <Linea bien={sala.cargamento.isru > 0}>
              Ice extractor {sala.cargamento.isru > 0 ? 'on board' : 'not loaded'}. The goal is to extract {sala.mision.aguaObjetivo} kg of water. It makes up to 45 kg a day if it has power.
            </Linea>
          )}
          <Linea bien={sala.cargamento.repuestos >= 14} regular={sala.cargamento.repuestos >= 8}>
            {sala.cargamento.repuestos} spare parts kits for {Math.round(a.total)} days of wear and breakdowns.
          </Linea>
        </ul>

        <h3>Ready for liftoff</h3>
        <div className="row" style={{ gap: 6 }}>
          <button className={yo.listo ? 'ok grow' : 'grow'} onClick={() => api.listo(!yo.listo)}>{yo.listo ? 'Ready ✓ (click to change)' : "I'm ready"}</button>
          {mando && (
            <button className="primary grow" disabled={Boolean(impide)} onClick={() => api.lanzar()}>
              Authorize launch
            </button>
          )}
        </div>
        <p className="mini muted">{impide ?? (mando ? 'All set. The Mission Commander authorizes the launch.' : 'The Mission Commander authorizes the launch when everyone is ready.')}</p>
      </div>
    </div>
  )
}

// ---------- Pantalla ----------

export function ContextoScreen() {
  const sala = useStore((s) => s.sala)!
  const usuario = useStore((s) => s.usuario)
  const yo = sala.jugadores.find((j) => j.id === usuario?.id) ?? null
  const pasoServidor = yo?.paso ?? 0
  const [paso, setPaso] = useState(pasoServidor)
  // El servidor manda si cambia por su cuenta (por ejemplo, al soltar el rol).
  useEffect(() => setPaso(pasoServidor), [pasoServidor])
  if (!yo) return null

  const ir = (n: number) => {
    if (n >= 2 && !yo.rol) return
    setPaso(n)
    void api.paso(n)
  }
  const actual = Math.min(paso, yo.rol ? PASOS_CONTEXTO.length - 1 : 1)

  return (
    <div className="center-screen alto">
      <div className="card wide stack contexto">
        <div className="row">
          <div className="grow">
            <div className="brand">
              Mission Briefing{sala.nombreMision ? ` · ${sala.nombreMision}` : ''} <span className="mono muted codigo-sala">room {sala.codigo}</span>
            </div>
            <h1>{PASOS_CONTEXTO[actual].titulo}</h1>
          </div>
          <button className="small" onClick={() => api.salir()}>Leave</button>
        </div>

        <ol className="pasos">
          {PASOS_CONTEXTO.map((p, i) => (
            <li key={p.id}>
              <button className={`paso ${i === actual ? 'actual' : i < actual ? 'hecho' : ''}`} disabled={i >= 2 && !yo.rol} aria-current={i === actual ? 'step' : undefined} onClick={() => ir(i)}>
                <b>{i + 1}</b> {p.corto}
              </button>
            </li>
          ))}
        </ol>

        {actual === 0 && <Situacion sala={sala} alSeguir={() => ir(1)} />}
        {actual === 1 && <Roles sala={sala} yo={yo} alSeguir={() => ir(2)} />}
        {actual === 2 && <Objetivo sala={sala} yo={yo} alSeguir={() => ir(3)} />}
        {actual === 3 && <Suministros sala={sala} yo={yo} />}

        <div className="integrantes">
          {sala.jugadores.map((j) => (
            <span key={j.id} className={`tag ${j.listo ? 'ok' : ''} ${j.conectado ? '' : 'apagado'}`}>
              <RolTag rol={j.rol} /> {j.nombre}
              <MarcaIA bot={j.bot} />
              {j.id === yo.id ? ' (you)' : ''} · {j.listo ? 'ready ✓' : j.conectado ? HACIENDO[j.paso ?? 0] : 'away'}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
