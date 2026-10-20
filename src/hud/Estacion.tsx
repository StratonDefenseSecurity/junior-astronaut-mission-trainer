// Panel de cada estación: una sub-interfaz distinta para cada cosa que hay que administrar
// (aire, energía, suministros, salud, ciencia, equipos). Se abre con E al acercarse, o desde
// la página principal, que reúne las opciones del esquema del equipo.
import { createContext, useContext, type ReactNode } from 'react'
import { C } from '@shared/ciencia'
import { CULTIVO_BY_ID, MAX_MUESTRAS, cultivoDe, estacionSistema, kitsReparacion } from '@shared/procedimientos'
import {
  GESTION_BASE,
  PASOS_ENSAMBLAJE,
  ROLE_BY_ID,
  SISTEMA_BY_ID,
  SITES,
  TAREAS_ENSAMBLAJE,
  nombreSistema,
  type OpcionBase,
  type Player,
  type Role,
  type RoomState,
  type SistemaId,
} from '@shared/types'
import { ESTACION_BY_ID, puede } from '../mundo/mapa'
import { api } from '../red'
import { useStore } from '../store'
import { useVoz, voz } from '../voz'
import { Procedimientos, Trabajo } from './Procedimiento'
import { Barra, Dato, RolTag, diasRestantes, diasTexto, enMarte, energiaUsada, mmHg, nivel, pctTraje, roles, tiempoEnEspacio, type Nivel } from './comun'

interface P {
  sala: RoomState
  yo: Player
}

/**
 * El panel se abrió desde la página principal, sin estar junto a la estación: se puede
 * consultar y decidir, pero los trabajos manuales piden ir hasta allí.
 */
const Remoto = createContext(false)
/** Estación del panel abierto: los trabajos se ofrecen donde se hacen. */
const Aqui = createContext('')
const IR_HASTA_AQUI = 'You have to go to the station to do this.'

const hayPropuesta = (sala: RoomState, tipo: string, filtro?: (payload: Record<string, unknown>) => boolean) =>
  sala.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === tipo && (!filtro || filtro(p.payload)))

/** Aviso de quién puede hacer algo, cuando no eres tú. */
function Reservado({ a }: { a: Role[] }) {
  return <span className="mini muted">Done by: {a.map((r) => ROLE_BY_ID[r].nombre).join(' or ')}</span>
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="seccion">
      <h4>{titulo}</h4>
      {children}
    </section>
  )
}

/** Procedimientos por pasos que tocan en esta estación: el montaje de la base y el huerto. */
function Tarea({ sala, yo, estacion }: P & { estacion: string }) {
  const remoto = useContext(Remoto)
  return <Procedimientos sala={sala} yo={yo} estacion={estacion} remoto={remoto} />
}

/** Un trabajo por pasos de esta estación (reparar, curar, salir...), con su botón de empezar. */
function Trabajar({ sala, yo, procId, motivo }: P & { procId: string; motivo?: boolean }) {
  const remoto = useContext(Remoto)
  const aqui = useContext(Aqui)
  return <Trabajo sala={sala} yo={yo} procId={procId} estacion={aqui} remoto={remoto} motivo={motivo} />
}

/** Estado de un equipo, con sus botones de reparar y de encender o apagar. */
function Equipo({ sala, yo, id, aqui = true }: P & { id: SistemaId; aqui?: boolean }) {
  const remoto = useContext(Remoto)
  const s = sala.sistemas.find((x) => x.id === id)!
  if (!s.instalado) return null
  const info = SISTEMA_BY_ID[id]
  const averiado = s.integridad <= 15
  const cortado = sala.energia.cortes.includes(id)
  const estado = averiado ? 'broken' : !s.activo ? 'off' : cortado ? 'no power' : s.operativo ? 'running' : 'stopped'
  const kits = kitsReparacion(s.integridad)
  const interruptor = id !== 'energia' && id !== 'esclusa'
  const lugar = estacionSistema(sala, id)
  return (
    <div className="equipo">
      <div className="row" style={{ gap: 6 }}>
        <strong className="grow">{info.nombre}</strong>
        <span className={`tag ${nivel(averiado || cortado, !s.activo)}`}>{estado}</span>
      </div>
      <p className="mini muted">{info.descripcion}</p>
      <div className="row" style={{ gap: 6 }}>
        <span className="mini muted">Integrity</span>
        <div className="grow"><Barra valor={s.integridad} tono={nivel(s.integridad < 30, s.integridad < 55)} /></div>
        <span className="mono mini">{Math.round(s.integridad)}%</span>
      </div>
      {aqui && s.integridad < 95 && <Trabajar sala={sala} yo={yo} procId={`reparar:${id}`} />}
      {s.integridad < 95 && sala.rec.repuestos < kits && <span className="mini warn">A repair needs {kits} spare parts kit{kits > 1 ? 's' : ''} and {sala.rec.repuestos} {sala.rec.repuestos === 1 ? 'is' : 'are'} left.</span>}
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        {remoto ? (
          <span className="mini muted">Repair it by going to the equipment.</span>
        ) : !aqui ? (
          <span className="mini muted">It is repaired at {ESTACION_BY_ID[lugar.estacion]?.nombre ?? 'its station'}{lugar.zona === 'exterior' ? ', outside in the suit' : ''}.</span>
        ) : null}
        {interruptor && puede(sala, yo, ['logistica', 'comandante', 'medico']) && (
          <button className="small" disabled={hayPropuesta(sala, 'equipo', (p) => p.sistema === id)} onClick={() => api.accion('equipo', { sistema: id })}>
            Propose {s.activo ? 'shutdown' : 'startup'}
          </button>
        )}
      </div>
    </div>
  )
}

function Opciones<T extends string | number>({ actual, opciones, onElegir, permitido, pendiente }: { actual: T; opciones: { valor: T; nombre: string; nota: string }[]; onElegir: (v: T) => void; permitido: boolean; pendiente: boolean }) {
  return (
    <div className="opciones">
      {opciones.map((o) => (
        <button key={String(o.valor)} className={`opcion ${o.valor === actual ? 'activa' : ''}`} disabled={!permitido || pendiente || o.valor === actual} onClick={() => onElegir(o.valor)}>
          <strong>{o.nombre}{o.valor === actual ? ' · current' : ''}</strong>
          <small>{o.nota}</small>
        </button>
      ))}
      {pendiente && <span className="mini warn">A proposal is waiting for approval.</span>}
    </div>
  )
}

// ---------- Estaciones ----------

function Puente({ sala, yo }: P) {
  const v = sala.vuelo
  const enOrbita = sala.fase === 'llegada' && sala.subfase === 'orbita'
  const propuesta = sala.propuestas.find((p) => p.tipo === 'ubicacion' && p.estado === 'pendiente')
  return (
    <>
      {enOrbita && (
        <Seccion titulo="Choose where to land">
          <p className="mini muted">The Pilot proposes a site and the Mission Commander approves it. The choice sets the weather, sunlight and water for the whole stay.</p>
          {propuesta ? (
            <span className="mini warn">Proposed: {propuesta.titulo}. It still needs approval in Proposals.</span>
          ) : (
            SITES.map((s) => (
              <button key={s.id} className="opcion" disabled={!puede(sala, yo, ['piloto', 'comandante'])} onClick={() => api.proponerUbicacion(s.id)}>
                <strong>{s.nombre} · {s.latitud}</strong>
                <small>{s.descripcion}</small>
              </button>
            ))
          )}
          {!puede(sala, yo, ['piloto', 'comandante']) && <Reservado a={['piloto', 'comandante']} />}
        </Seccion>
      )}
      <Seccion titulo="Navigation">
        {enMarte(sala) ? (
          <p className="mini">The ship is on the surface. Sol {sala.ambiente.sol} of {sala.mision.solesObjetivo}. The trip took {tiempoEnEspacio(sala)} and the mission has used {energiaUsada(sala)} of energy so far.</p>
        ) : (
          <div className="rejilla">
            <Dato etiqueta="Trip" valor={`${Math.round(v.progreso * 100)}%`} barra={{ valor: v.progreso * 100 }} />
            <Dato etiqueta="Speed" valor={`${v.velocidad} km/s`} />
            <Dato etiqueta="Distance to the Sun" valor={`${v.distSol} AU`} />
            <Dato etiqueta="Signal delay" valor={`${Math.floor(v.retardo / 60)} min ${v.retardo % 60} s`} />
            <Dato etiqueta="Fuel" valor={`${Math.round(sala.rec.propelente)}%`} tono={nivel(sala.rec.propelente < 10, sala.rec.propelente < 30)} />
            <Dato etiqueta="In space" valor={tiempoEnEspacio(sala)} />
            <Dato etiqueta="Energy used" valor={energiaUsada(sala)} />
            <Dato etiqueta="Sunlight" valor={`${sala.ambiente.flujoSolar} W/m²`} />
          </div>
        )}
      </Seccion>
      <Seccion titulo="Mission objective">
        <p className="mini">{sala.mision.objetivo}</p>
        <p className="mini muted">{Math.round(diasRestantes(sala))} mission days to go. The time scale is in the top bar. Only the Mission Commander can change it.</p>
      </Seccion>
    </>
  )
}

function SoporteVital({ sala, yo }: P) {
  const remoto = useContext(Remoto)
  const c = sala.cabina
  const co2 = mmHg(c.ppCO2)
  return (
    <>
      <Tarea sala={sala} yo={yo} estacion="soporte" />
      <Seccion titulo="Cabin air">
        <div className="rejilla">
          <Dato etiqueta="Oxygen" valor={`${c.ppO2.toFixed(1)} kPa`} tono={nivel(c.ppO2 < C.PPO2_MINIMA_KPA, c.ppO2 < 19.5)} barra={{ valor: c.ppO2, max: C.PPO2_NOMINAL_KPA }} nota={`Normal is ${C.PPO2_NOMINAL_KPA} kPa`} />
          <Dato etiqueta="CO₂" valor={`${co2.toFixed(1)} mmHg`} tono={nivel(co2 > 10, co2 > 3)} barra={{ valor: co2, max: 15 }} nota="NASA limit: 3 mmHg" />
          <Dato etiqueta="Temperature" valor={`${c.temp.toFixed(1)} °C`} tono={nivel(c.temp < 5 || c.temp > 32, c.temp < 15 || c.temp > 28)} />
        </div>
        <p className="mini muted">The crew uses about {(sala.jugadores.filter((j) => j.rol).length * 0.84).toFixed(1)} kg of oxygen a day and breathes out almost the same mass of CO₂.</p>
        {c.fuga > 0 && <div className="help">There is a leak: {c.fuga} kg of air lost per hour.</div>}
        {c.fuga > 0 && <Trabajar sala={sala} yo={yo} procId="sellar" motivo />}
      </Seccion>
      <Seccion titulo="Production and recycling">
        <Equipo sala={sala} yo={yo} id="oga" />
        <Equipo sala={sala} yo={yo} id="cdra" />
        <Equipo sala={sala} yo={yo} id="wrs" />
        <Equipo sala={sala} yo={yo} id="termico" />
      </Seccion>
      <Seccion titulo="Lithium hydroxide cartridges">
        <p className="mini">{sala.rec.lioh} left. The installed ones can still absorb {sala.rec.liohActivo.toFixed(1)} kg of CO₂. They work without electricity.</p>
        <Trabajar sala={sala} yo={yo} procId="lioh" motivo />
      </Seccion>
    </>
  )
}

function Energia({ sala, yo }: P) {
  const e = sala.energia
  const pct = e.capacidad ? (e.bateria / e.capacidad) * 100 : 0
  const horas = e.consumo > e.generacion && e.consumo > 0 ? e.bateria / (e.consumo - e.generacion) : null
  return (
    <>
      <Tarea sala={sala} yo={yo} estacion="energia" />
      <Seccion titulo="Power balance">
        <div className="rejilla">
          <Dato etiqueta="Generation" valor={`${e.generacion.toFixed(1)} kW`} />
          <Dato etiqueta="Use" valor={`${e.consumo.toFixed(1)} kW`} tono={nivel(false, e.consumo > e.generacion)} />
          <Dato etiqueta="Batteries" valor={`${Math.round(e.bateria)} / ${e.capacidad} kWh`} tono={nivel(pct < 15, pct < 40)} barra={{ valor: pct }} />
          <Dato etiqueta="Used this mission" valor={energiaUsada(sala)} nota="Electricity used since liftoff" />
        </div>
        <p className="mini muted">
          {horas !== null ? `At this rate the batteries last ${horas.toFixed(1)} hours. ` : 'The batteries are charging or full. '}
          {enMarte(sala)
            ? `There are ${sala.cargamento.paneles} solar array(s)${sala.cargamento.reactor ? ' and a reactor' : ''}. Dust on the panels takes away ${Math.round(e.polvo * 100)}%.`
            : 'In space the panels get sunlight all the time. Farther from the Sun, they make less power.'}
        </p>
        {e.cortes.length > 0 && <div className="help">No power: {e.cortes.map((id) => nombreSistema(id)).join(', ')}.</div>}
      </Seccion>
      <Seccion titulo="What to protect if power runs low">
        <Opciones
          actual={sala.ajustes.prioridad}
          permitido={puede(sala, yo, ['logistica', 'comandante'])}
          pendiente={hayPropuesta(sala, 'prioridad')}
          onElegir={(valor) => api.accion('prioridad', { valor })}
          opciones={[
            { valor: 'vida', nombre: 'Air', nota: 'Heating is cut before the oxygen generator and the CO2 scrubber.' },
            { valor: 'calor', nombre: 'Heat', nota: 'Heating stays on. Oxygen comes from the tanks.' },
            { valor: 'ciencia', nombre: 'Garden', nota: 'The garden lights go off after the heating.' },
          ]}
        />
        {!puede(sala, yo, ['logistica', 'comandante']) && <Reservado a={['logistica', 'comandante']} />}
      </Seccion>
      <Seccion titulo="Power Plant">
        <Equipo sala={sala} yo={yo} id="energia" aqui={!enMarte(sala)} />
      </Seccion>
    </>
  )
}

function Almacen({ sala, yo }: P) {
  const r = sala.rec
  const a = sala.autonomia
  const faltan = diasRestantes(sala)
  const fila = (nombre: string, cantidad: string, dias: number | null) => (
    <tr>
      <td>{nombre}</td>
      <td className="mono">{cantidad}</td>
      <td className={`mono ${dias === null ? '' : nivel(dias < faltan * 0.9, dias < faltan * 1.15)}`}>{dias === null ? '' : diasTexto(dias)}</td>
    </tr>
  )
  const manda = puede(sala, yo, ['logistica', 'comandante'])
  return (
    <>
      <Seccion titulo="Supplies">
        <table className="tabla">
          <thead>
            <tr><th></th><th>Left</th><th>Lasts</th></tr>
          </thead>
          <tbody>
            {fila('Drinking water', `${Math.round(r.agua)} kg`, a.agua)}
            {fila('Water to recycle', `${Math.round(r.aguaResidual)} kg`, null)}
            {fila('Oxygen tanks', `${Math.round(r.o2)} kg`, a.aire)}
            {fila('Food', `${Math.round(r.comida)} kg`, a.comida)}
            {fila('Spare parts', `${r.repuestos} kits`, null)}
            {fila('Medical kits', `${r.botiquines}`, null)}
            {fila('LiOH cartridges', `${r.lioh}`, null)}
          </tbody>
        </table>
        <p className="mini muted">{Math.round(faltan)} mission days to go. In red: what will run out at the current rate.</p>
      </Seccion>
      <Seccion titulo="Food ration">
        <Opciones
          actual={sala.ajustes.racionComida}
          permitido={manda}
          pendiente={hayPropuesta(sala, 'racionComida')}
          onElegir={(nivel_) => api.accion('racionComida', { nivel: nivel_ })}
          opciones={[
            { valor: 'normal', nombre: 'Full', nota: `${C.COMIDA_KG_DIA} kg per person per day.` },
            { valor: 'ahorro', nombre: 'Saving (80%)', nota: 'Lasts 25% longer. Body reserves drop little by little.' },
            { valor: 'estricto', nombre: 'Strict (60%)', nota: 'Lasts 67% longer. Within weeks it hurts health.' },
          ]}
        />
      </Seccion>
      <Seccion titulo="Water use">
        <Opciones
          actual={sala.ajustes.racionAgua}
          permitido={manda}
          pendiente={hayPropuesta(sala, 'racionAgua')}
          onElegir={(nivel_) => api.accion('racionAgua', { nivel: nivel_ })}
          opciones={[
            { valor: 'normal', nombre: 'Normal', nota: `${C.AGUA_BEBIDA_KG_DIA} kg for drinking and ${C.AGUA_HIGIENE_KG_DIA} kg for hygiene per person.` },
            { valor: 'ahorro', nombre: 'Saving', nota: 'Minimum hygiene. Drinking water stays the same.' },
          ]}
        />
        {!manda && <Reservado a={['logistica', 'comandante']} />}
      </Seccion>
    </>
  )
}

function Enfermeria({ sala, yo }: P) {
  const crew = sala.jugadores.filter((j) => j.rol)
  const soyMedico = puede(sala, yo, ['medico'])
  const manda = puede(sala, yo, ['medico', 'comandante'])
  const enRefugio = sala.refugioHasta > sala.t
  const remoto = useContext(Remoto)
  return (
    <>
      <Seccion titulo="Crew vital signs">
        <table className="tabla compacta">
          <thead>
            <tr><th></th><th>Pulse</th><th>Resp.</th><th>O₂</th><th>Water</th><th>Fatigue</th><th>Musc.</th><th>mSv</th><th>Health</th></tr>
          </thead>
          <tbody>
            {crew.map((j) => {
              const v = j.vit
              return (
                <tr key={j.id}>
                  <td><RolTag rol={j.rol} /> {j.nombre}{j.dolencia ? <i className="warn"> · {j.dolencia}</i> : null}</td>
                  <td className={`mono ${nivel(v.fc > 150, v.fc > 110)}`}>{Math.round(v.fc)}</td>
                  <td className={`mono ${nivel(v.fr > 34, v.fr > 24)}`}>{Math.round(v.fr)}</td>
                  <td className={`mono ${nivel(v.spo2 < 88, v.spo2 < 94)}`}>{Math.round(v.spo2)}%</td>
                  <td className={`mono ${nivel(v.hidratacion < 60, v.hidratacion < 85)}`}>{Math.round(v.hidratacion)}%</td>
                  <td className={`mono ${nivel(v.fatiga > 85, v.fatiga > 60)}`}>{Math.round(v.fatiga)}%</td>
                  <td className={`mono ${nivel(v.condicion < 70, v.condicion < 88)}`}>{Math.round(v.condicion)}%</td>
                  <td className={`mono ${nivel(v.dosis > C.LIMITE_CARRERA_MSV, v.dosis > 450)}`}>{Math.round(v.dosis)}</td>
                  <td className={`mono ${nivel(v.salud < 40, v.salud < 70)}`}>{Math.round(v.salud)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mini muted">Medical kits: {sala.rec.botiquines}. Each treatment uses one. Career radiation limit: {C.LIMITE_CARRERA_MSV} mSv.</p>
      </Seccion>
      <Seccion titulo="Patients">
        {crew.some((j) => j.dolencia || j.incapacitado > 0 || j.vit.salud <= 90) ? (
          crew.map((j) => <Trabajar key={j.id} sala={sala} yo={yo} procId={`tratar:${j.id}`} />)
        ) : (
          <p className="mini muted">Nobody needs treatment right now.</p>
        )}
        {!soyMedico && <Reservado a={['medico']} />}
      </Seccion>
      <Seccion titulo="Exercise plan">
        <Opciones
          actual={sala.ajustes.ejercicio}
          permitido={manda}
          pendiente={hayPropuesta(sala, 'ejercicio')}
          onElegir={(horas) => api.accion('ejercicio', { horas })}
          opciones={[
            { valor: 2.5, nombre: '2.5 hours a day', nota: 'The schedule on the Space Station. Keeps muscle and bone.' },
            { valor: 1, nombre: '1 hour a day', nota: 'Slows the loss by about half. Uses less air, water and food.' },
            { valor: 0, nombre: 'No exercise', nota: 'Saves supplies, but the body gets weaker every day without gravity.' },
          ]}
        />
      </Seccion>
      <Seccion titulo="Radiation protection">
        <p className="mini">
          {sala.ambiente.tormentaSolar ? `Solar storm in progress, based on the real one of ${sala.ambiente.tormentaSolar.fecha}.` : 'No solar storm.'} The shelter has {sala.blindaje} shielding layer(s).
        </p>
        {manda ? (
          <div className="row" style={{ gap: 6 }}>
            {enRefugio ? (
              <button className="small" disabled={hayPropuesta(sala, 'refugio')} onClick={() => api.accion('refugio', { salir: true })}>Propose leaving the shelter</button>
            ) : (
              [6, 24, 48].map((h) => (
                <button key={h} className="small" disabled={hayPropuesta(sala, 'refugio')} onClick={() => api.accion('refugio', { horas: h })}>
                  Shelter {h} h
                </button>
              ))
            )}
          </div>
        ) : (
          <Reservado a={['medico', 'comandante']} />
        )}
      </Seccion>
    </>
  )
}

/** Las almohadillas del huerto: humedad, salud, crecimiento y moho de cada una. */
function Almohadillas({ sala }: { sala: RoomState }) {
  const h = sala.huerto
  const c = cultivoDe(sala)
  const lista = h.almohadillas ?? []
  const vivas = lista.filter((a) => !a.muerta)
  const maximo = vivas.length ? Math.max(...vivas.map((a) => a.crecimiento)) : 0
  return (
    <>
      <p className="mini">
        {c.nombre}. Growing day {Math.floor(h.diasCultivo)}. {maximo >= 1 ? 'Some plants are ready to harvest' : `Harvest in about ${Math.max(1, Math.round((1 - maximo) * c.dias))} days with good care`}. Harvests: {h.cosechas}, with {(h.comidaFresca ?? 0).toFixed(1)} kg of fresh greens eaten. Fan {h.ventilador === 'alto' ? 'high: the soil dries out faster' : 'normal'}.
      </p>
      <div className="almohadillas">
        {lista.map((a, i) => (
          <div key={i} className={`almohadilla ${a.muerta ? 'muerta' : ''}`}>
            <b className="mini">Pillow {i + 1}</b>
            {a.muerta ? (
              <span className="mini bad">Dead plant</span>
            ) : (
              <>
                <span className="mini muted">Moisture {Math.round(a.humedad)}%</span>
                <Barra valor={a.humedad} tono={a.humedad < 25 || a.humedad > 88 ? 'bad' : a.humedad < 40 || a.humedad > 80 ? 'warn' : 'azul'} />
                <span className="mini muted">Health {Math.round(a.salud)}%</span>
                <Barra valor={a.salud} tono={a.salud < 40 ? 'bad' : a.salud < 70 ? 'warn' : 'ok'} />
                <span className="mini muted">Growth {Math.round(a.crecimiento * 100)}%</span>
                <Barra valor={a.crecimiento * 100} tono="ok" />
                {a.moho >= 0.1 && <span className="mini warn">White fuzz: mold</span>}
                {a.plantulas > 1 && <span className="mini muted">{a.plantulas} seedlings</span>}
              </>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function Laboratorio({ sala, yo }: P) {
  const h = sala.huerto
  const remoto = useContext(Remoto)
  return (
    <>
      <Seccion titulo="Plant Garden">
        {sala.cargamento.huerto < 1 ? (
          <p className="mini muted">You did not bring the garden kit.</p>
        ) : (
          <>
            {h.establecido && <Almohadillas sala={sala} />}
            <Tarea sala={sala} yo={yo} estacion="laboratorio" />
            {h.establecido && <Equipo sala={sala} yo={yo} id="huerto" />}
          </>
        )}
      </Seccion>
      <Seccion titulo="Soil samples">
        <p className="mini">Analyzed: {sala.mision.muestrasAnalizadas} of {sala.mision.muestrasObjetivo}. You are carrying {yo.muestras} not yet analyzed.</p>
        <Trabajar sala={sala} yo={yo} procId={`analizar:${yo.id}`} />
        <p className="mini muted">Samples are collected outside, at the marked sites, once the base is running. A sample only counts if it was taken and analyzed with care. The full analysis uses 1.5 kWh per sample.</p>
      </Seccion>
    </>
  )
}

function Gimnasio({ yo }: P) {
  const activo = yo.manual === 'ejercicio'
  return (
    <Seccion titulo="Gym">
      <p className="mini">Without gravity you lose muscle and bone. Your condition is {Math.round(yo.vit.condicion)}%. A session lasts one mission hour. It rebuilds condition faster, but raises your pulse, thirst and fatigue.</p>
      <button className={activo ? 'small danger' : 'small primary'} onClick={() => api.actividad(activo ? null : 'ejercicio')}>{activo ? 'Stop exercising' : 'Exercise'}</button>
    </Seccion>
  )
}

function Literas({ yo }: P) {
  const activo = yo.manual === 'sueno'
  return (
    <Seccion titulo="Bunks">
      <p className="mini">Your fatigue is {Math.round(yo.vit.fatiga)}%. Sleep lowers it by about 12 points per hour. If you do not move during the night, your character sleeps on its own.</p>
      <button className={activo ? 'small danger' : 'small primary'} onClick={() => api.actividad(activo ? null : 'sueno')}>{activo ? 'Get up' : 'Sleep'}</button>
    </Seccion>
  )
}

function Refugio({ sala, yo }: P) {
  const ts = sala.ambiente.tormentaSolar
  const obligado = sala.refugioHasta > sala.t
  const remoto = useContext(Remoto)
  return (
    <Seccion titulo="Storm Shelter">
      <p className="mini">
        Water walls with {sala.blindaje} extra shielding layer(s). They stop solar particles well, but cosmic rays only a little.{' '}
        {ts ? `There is a solar storm: outside the shelter the dose goes up.` : 'There is no solar storm right now.'}
      </p>
      <p className="mini muted">Your dose now: {yo.vit.dosisTasa} mSv per day. You cannot work inside the shelter.</p>
      {obligado && yo.enRefugio ? (
        <span className="mini warn">Shelter order in effect. The Flight Surgeon or the Mission Commander can lift it.</span>
      ) : (
        <button className={yo.enRefugio ? 'small danger' : 'small primary'} disabled={remoto} title={remoto ? IR_HASTA_AQUI : undefined} onClick={() => api.refugio(!yo.enRefugio)}>{yo.enRefugio ? 'Leave the shelter' : 'Enter the shelter'}</button>
      )}
    </Seccion>
  )
}

function Esclusa({ sala, yo }: P) {
  const o2 = pctTraje(yo.trajeO2)
  const a = sala.ambiente
  return (
    <>
      <Tarea sala={sala} yo={yo} estacion="esclusa" />
      <Seccion titulo="Your suit">
        <div className="rejilla">
          <Dato etiqueta="Oxygen" valor={`${o2}%`} tono={nivel(o2 < 20, o2 < 40)} barra={{ valor: o2 }} />
          <Dato etiqueta="Battery" valor={`${Math.round(yo.trajeBateria * 100)}%`} tono={nivel(yo.trajeBateria < 0.2, yo.trajeBateria < 0.4)} barra={{ valor: yo.trajeBateria * 100 }} />
        </div>
        <p className="mini muted">Pure oxygen at {C.TRAJE_PRESION_KPA} kPa. A full suit lasts 7 to {C.TRAJE_BATERIA_H} hours. Hard work uses it up faster. If it runs out outside, you are rescued but injured.</p>
      </Seccion>
      <Seccion titulo="Go outside">
        {enMarte(sala) ? (
          <>
            <p className="mini">Outside it is {a.tempExt} °C and {a.presion} Pa{a.tormentaPolvo ? ', with a dust storm' : ''}. While someone is outside, time runs no faster than ×60.</p>
            <Trabajar sala={sala} yo={yo} procId={`salida:${yo.id}`} motivo />
            <Trabajar sala={sala} yo={yo} procId={`entrada:${yo.id}`} />
          </>
        ) : (
          <p className="mini muted">You can only go outside once the ship is on Mars.</p>
        )}
      </Seccion>
      <Seccion titulo="Equipment">
        <Equipo sala={sala} yo={yo} id="esclusa" />
      </Seccion>
    </>
  )
}

function EsclusaExterior({ sala, yo }: P) {
  const o2 = pctTraje(yo.trajeO2)
  return (
    <Seccion titulo="Back to the habitat">
      <p className="mini">Your suit has {o2}% of its oxygen{yo.trajeFuga ? ' and it is leaking' : ''}. Inside you take off the suit and the airlock recharges it.</p>
      <Trabajar sala={sala} yo={yo} procId={`entrada:${yo.id}`} motivo />
    </Seccion>
  )
}

function CampoSolar({ sala, yo }: P) {
  const desplegado = Boolean(sala.ensamblaje.hechas.paneles)
  const polvo = Math.round(sala.energia.polvo * 100)
  return (
    <>
      <Tarea sala={sala} yo={yo} estacion="campoSolar" />
      <Seccion titulo="Solar Arrays">
        {desplegado ? (
          <>
            <p className="mini">{sala.cargamento.paneles} array(s) of 50 m². Each one gives up to {C.PANEL_KW} kW at noon under a clear sky. Because of how they were aimed, they use {Math.round((sala.efectos?.solar ?? 1) * 100)}% of the light. Built-up dust takes away {polvo}%.</p>
            <Trabajar sala={sala} yo={yo} procId="limpiar" motivo />
            <p className="mini muted">Anyone can clean them. Dust settles again every sol, and much faster in a storm.</p>
          </>
        ) : (
          <p className="mini muted">The panels are still folded.</p>
        )}
      </Seccion>
    </>
  )
}

function Muestreo({ sala, yo, id }: P & { id: string }) {
  const tomada = sala.muestreos.includes(id)
  return (
    <Seccion titulo="Sample Site">
      <p className="mini">Untouched rock and soil. You are carrying {yo.muestras} of {MAX_MUESTRAS} possible samples before you must return to the lab.</p>
      {tomada ? <span className="mini ok">The sample from this site has already been taken.</span> : <Trabajar sala={sala} yo={yo} procId={`muestra:${id}`} motivo />}
    </Seccion>
  )
}

/** Mesa común: el sitio para reunirse a hablar. */
function Comedor({ sala, yo }: P) {
  const v = useVoz()
  const setPestana = useStore((s) => s.setPestana)
  const aqui = sala.jugadores.filter((j) => j.rol && j.zona === yo.zona)
  return (
    <>
      <Seccion titulo="Talk with the crew">
        <p className="mini">
          The crew eats here and meets to make decisions. In voice chat, people close to you sound louder. If someone is outside in the suit, you hear them by radio.
        </p>
        {!v.disponible ? (
          <p className="mini muted">Voice chat works in the published game. On this server you can type in the assistant chat.</p>
        ) : v.activa ? (
          <div className="row" style={{ gap: 6 }}>
            <span className="mini ok">Voice on · {v.conectados} connected{v.microfono === 'denegado' ? ' · listen only: no microphone permission' : ''}</span>
            {v.microfono === 'si' && <button className="small" onClick={() => voz.silenciar(!v.silenciado)}>{v.silenciado ? 'Unmute microphone' : 'Mute microphone'}</button>}
            <button className="small" onClick={() => voz.desactivar()}>Leave voice</button>
          </div>
        ) : (
          <button className="primary" onClick={() => void voz.activar()}>Join voice chat</button>
        )}
        {v.error && <p className="mini warn">{v.error}</p>}
      </Seccion>
      <Seccion titulo="On board now">
        <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
          {aqui.map((j) => (
            <span key={j.id} className="tag">
              <RolTag rol={j.rol} /> {j.nombre}
            </span>
          ))}
        </div>
        <button className="small" style={{ marginTop: 6 }} onClick={() => setPestana('asistente')}>Message the crew</button>
      </Seccion>
    </>
  )
}

function contenido(id: string, p: P): ReactNode {
  switch (id) {
    case 'comedor':
      return <Comedor {...p} />
    case 'puente':
      return <Puente {...p} />
    case 'soporte':
      return <SoporteVital {...p} />
    case 'energia':
      return <Energia {...p} />
    case 'almacen':
      return <Almacen {...p} />
    case 'enfermeria':
      return <Enfermeria {...p} />
    case 'laboratorio':
      return <Laboratorio {...p} />
    case 'ejercicio':
      return <Gimnasio {...p} />
    case 'literas':
      return <Literas {...p} />
    case 'refugio':
      return <Refugio {...p} />
    case 'esclusa':
      return <Esclusa {...p} />
    case 'esclusaExt':
      return <EsclusaExterior {...p} />
    case 'campoSolar':
      return <CampoSolar {...p} />
    case 'plantaExt':
      return (
        <Seccion titulo="Power Plant">
          <p className="mini">It distributes power from the panels{p.sala.cargamento.reactor ? ' and the reactor' : ''} and charges the batteries.</p>
          <Equipo {...p} id="energia" />
        </Seccion>
      )
    case 'carga':
      return (
        <>
          <Tarea {...p} estacion="carga" />
          <Seccion titulo="Cargo Area">
            <p className="mini">The surface equipment landed here{p.sala.cargamento.reactor ? ', including the reactor' : ''}. {p.sala.ensamblaje.hechas.carga ? 'Everything is unloaded.' : 'You have to unload it before you can use it.'}</p>
          </Seccion>
        </>
      )
    case 'antena':
      return (
        <>
          <Tarea {...p} estacion="antena" />
          <Seccion titulo="Antenna">
            <p className="mini">Link to Earth. A message takes about {Math.max(3, Math.round(p.sala.vuelo.retardo / 60))} minutes to arrive. That is why the crew decides on its own.</p>
          </Seccion>
        </>
      )
    case 'isruExt':
      return (
        <Seccion titulo="Ice Extractor">
          <p className="mini">It melts buried ice and pumps up to 45 kg of water a day. It uses 3 kW.</p>
          <Equipo {...p} id="isru" />
        </Seccion>
      )
    default:
      return id.startsWith('muestra') ? <Muestreo {...p} id={id} /> : null
  }
}

// ---------- Página principal ----------

const RACION = { normal: 'full', ahorro: 'saving', estricto: 'strict' } as const
const PROTEGE = { vida: 'air', calor: 'heat', ciencia: 'the garden' } as const

/** Cómo va cada opción de la página principal, en una línea. */
function resumenOpcion(sala: RoomState, id: OpcionBase['id']): { texto: string; tono: Nivel } {
  const a = sala.autonomia
  const e = sala.energia
  const faltan = diasRestantes(sala)
  const instalados = sala.sistemas.filter((s) => s.instalado)
  switch (id) {
    case 'controlar': {
      const bat = e.capacidad ? Math.round((e.bateria / e.capacidad) * 100) : 0
      const minimo = Math.min(a.agua, a.aire, a.comida)
      return {
        texto: `Water ${diasTexto(a.agua)}, air ${diasTexto(a.aire)}, food ${diasTexto(a.comida)}. Batteries at ${bat}%. ${Math.round(faltan)} mission days to go.`,
        tono: nivel(minimo < faltan * 0.9 || bat < 15, minimo < faltan * 1.15 || bat < 40),
      }
    }
    case 'distribuir':
      return {
        texto: `Food ration: ${RACION[sala.ajustes.racionComida]}. Water use: ${sala.ajustes.racionAgua === 'normal' ? 'normal' : 'saving'}. If power runs low, ${PROTEGE[sala.ajustes.prioridad]} comes first.`,
        tono: nivel(false, sala.ajustes.racionComida !== 'normal' || sala.ajustes.racionAgua !== 'normal'),
      }
    case 'produccion': {
      const equipos = (['oga', 'cdra', 'wrs'] as SistemaId[]).map((x) => sala.sistemas.find((s) => s.id === x)!)
      const parados = equipos.filter((s) => !s.operativo)
      return {
        texto: parados.length ? `Stopped: ${parados.map((s) => nombreSistema(s.id)).join(', ')}.` : 'The Oxygen Generator, the CO2 Scrubber and the Water Recycler are running.',
        tono: nivel(parados.length > 1, parados.length === 1),
      }
    }
    case 'equipos': {
      const peor = [...instalados].sort((x, y) => x.integridad - y.integridad)[0]
      return {
        texto: `Most worn: ${nombreSistema(peor.id)}, at ${Math.round(peor.integridad)}%. ${sala.rec.repuestos} spare parts kits left.`,
        tono: nivel(peor.integridad < 30, peor.integridad < 55),
      }
    }
    case 'radiacion': {
      const dosis = Math.max(0, ...sala.jugadores.filter((j) => j.rol).map((j) => j.vit.dosis))
      const ts = sala.ambiente.tormentaSolar
      return {
        texto: `Highest dose: ${Math.round(dosis)} of ${C.LIMITE_CARRERA_MSV} mSv. ${ts ? 'A solar storm is in progress.' : 'No solar storm.'}${sala.refugioHasta > sala.t ? ' Shelter order in effect.' : ''}`,
        tono: nivel(dosis > C.LIMITE_CARRERA_MSV, Boolean(ts) || dosis > 450),
      }
    }
    case 'huerto': {
      const h = sala.huerto
      return {
        texto: sala.cargamento.huerto < 1 ? 'You did not bring the garden kit.' : h.establecido ? `${CULTIVO_BY_ID[h.cultivo ?? 'lechuga'].nombre}: ${(h.almohadillas ?? []).filter((a) => !a.muerta).length} plants alive. Harvests: ${h.cosechas}.` : `Setup ${h.progreso}% done.`,
        tono: nivel(false, sala.cargamento.huerto > 0 && !h.establecido),
      }
    }
  }
}

/** La página principal: las opciones de gestión, cada una con su sub-interfaz. */
function Principal({ sala, yo }: P) {
  const abrir = useStore((s) => s.abrirEstacion)
  const cerca = useStore((s) => s.cerca)
  const setPestana = useStore((s) => s.setPestana)
  const pendientes = sala.propuestas.filter((p) => p.estado === 'pendiente').length
  const decideComandante = sala.modoDecision === 'comandante'
  const paso = PASOS_ENSAMBLAJE.find((p) => p.paso === sala.ensamblaje.paso)
  const tareas = TAREAS_ENSAMBLAJE.filter((t) => t.paso === sala.ensamblaje.paso)
  return (
    <>
      {sala.fase === 'ensamblaje' && paso && (
        <div className="tarea">
          <strong>Base Assembly mission · step {paso.paso} of 3</strong>
          <p>{paso.titulo}. <span className="muted">{roles(paso.roles)}</span></p>
          {tareas.map((t) => (
            <div key={t.id} className={`mini ${sala.ensamblaje.hechas[t.id] ? 'ok' : ''}`}>
              {sala.ensamblaje.hechas[t.id] ? '✓' : '○'} {t.titulo} · {ESTACION_BY_ID[t.estacion].nombre} ({t.zona === 'exterior' ? 'outside, in the suit' : 'inside'})
            </div>
          ))}
        </div>
      )}
      {sala.fase === 'base' && <div className="help ok">Base activated. Keep it running until you complete all {sala.mision.solesObjetivo} sols.</div>}
      {pendientes > 0 && (
        <div className="help">
          {decideComandante
            ? yo.rol === 'comandante'
              ? `You have ${pendientes} decision(s) from other crew members to approve or reject, looking out for the good of the whole crew.`
              : `${pendientes} decision(s) waiting for the Mission Commander.`
            : `${pendientes} decision(s) up for a vote.`}{' '}
          <button className="small" onClick={() => setPestana('propuestas')}>See proposals</button>
        </div>
      )}
      <Seccion titulo="Manage resources">
        <div className="opciones-base">
          {GESTION_BASE.map((o) => {
            const r = resumenOpcion(sala, o.id)
            const mia = yo.rol !== null && o.roles.includes(yo.rol)
            return (
              <div key={o.id} className={`opcion-base ${mia ? 'mia' : ''}`}>
                <div className="row" style={{ gap: 6 }}>
                  <strong className="grow">{o.titulo}</strong>
                  <span className="mini muted">{roles(o.roles)}</span>
                </div>
                <p className="mini muted">{o.descripcion}{mia ? ' This is your job.' : ''}</p>
                <p className={`mini ${r.tono}`}>{r.texto}</p>
                <div className="row" style={{ gap: 5 }}>
                  {o.estaciones.map((id) => (
                    <button key={id} className="small" onClick={() => abrir(id, cerca !== id)}>
                      {ESTACION_BY_ID[id].nombre}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Seccion>
    </>
  )
}

/** Panel de la estación abierta, o la página principal. */
export function PanelEstacion({ sala, yo }: P) {
  const id = useStore((s) => s.estacion)
  const remoto = useStore((s) => s.remoto)
  const abrir = useStore((s) => s.abrirEstacion)
  if (!id) return null
  const principal = id === 'principal'
  const e = ESTACION_BY_ID[id]
  if (!e && !principal) return null
  const impedido = yo.incapacitado > 0 ? 'You are out of action.' : yo.enRefugio && id !== 'refugio' ? 'You are in the shelter: you cannot work.' : null
  return (
    <div className="panel estacion">
      <div className="row cabecera">
        {remoto && <button className="small plano" onClick={() => abrir('principal')}>Back to Base Dashboard</button>}
        <h2 className="grow">{principal ? `Base Dashboard · ${enMarte(sala) ? 'Mars Base' : 'ship'}` : e.nombre}</h2>
        <span className="mini muted">{roles(sala.jugadores.filter((j) => j.rol === yo.rol).map((j) => j.rol!))}</span>
        <button className="small" onClick={() => abrir(null)}>Close{principal ? ' (M)' : ' (E)'}</button>
      </div>
      {impedido && !principal && <div className="help">{impedido}</div>}
      {remoto && !principal && <div className="help ok">You are viewing this from the Base Dashboard. Here you can check and propose decisions. To repair, install, treat or grow plants, go to {e.nombre}.</div>}
      <div className="cuerpo">
        <Remoto.Provider value={remoto && !principal}>
          <Aqui.Provider value={id}>{principal ? <Principal sala={sala} yo={yo} /> : contenido(id, { sala, yo })}</Aqui.Provider>
        </Remoto.Provider>
      </div>
    </div>
  )
}
