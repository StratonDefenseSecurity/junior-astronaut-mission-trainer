// Panel de cada estación: una sub-interfaz distinta para cada cosa que hay que administrar
// (aire, energía, suministros, salud, ciencia, equipos). Se abre con E al acercarse, o desde
// la página principal, que reúne las opciones del esquema del equipo.
import { createContext, useContext, type ReactNode } from 'react'
import { C } from '@shared/ciencia'
import { CULTIVO_BY_ID, cultivoDe } from '@shared/procedimientos'
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
import { Procedimientos } from './Procedimiento'
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
const IR_HASTA_AQUI = 'Hay que ir hasta la estación para hacerlo.'

const hayPropuesta = (sala: RoomState, tipo: string, filtro?: (payload: Record<string, unknown>) => boolean) =>
  sala.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === tipo && (!filtro || filtro(p.payload)))

/** Aviso de quién puede hacer algo, cuando no eres tú. */
function Reservado({ a }: { a: Role[] }) {
  return <span className="mini muted">Lo hace: {a.map((r) => ROLE_BY_ID[r].nombre).join(' o ')}</span>
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

/** Estado de un equipo, con sus botones de reparar y de encender o apagar. */
function Equipo({ sala, yo, id, aqui = true }: P & { id: SistemaId; aqui?: boolean }) {
  const remoto = useContext(Remoto)
  const s = sala.sistemas.find((x) => x.id === id)!
  if (!s.instalado) return null
  const info = SISTEMA_BY_ID[id]
  const averiado = s.integridad <= 15
  const cortado = sala.energia.cortes.includes(id)
  const estado = averiado ? 'averiado' : !s.activo ? 'apagado' : cortado ? 'sin energía' : s.operativo ? 'en marcha' : 'detenido'
  const kits = s.integridad <= 30 ? 2 : 1
  const interruptor = id !== 'energia' && id !== 'esclusa'
  return (
    <div className="equipo">
      <div className="row" style={{ gap: 6 }}>
        <strong className="grow">{info.nombre}</strong>
        <span className={`tag ${nivel(averiado || cortado, !s.activo)}`}>{estado}</span>
      </div>
      <p className="mini muted">{info.descripcion}</p>
      <div className="row" style={{ gap: 6 }}>
        <span className="mini muted">Integridad</span>
        <div className="grow"><Barra valor={s.integridad} tono={nivel(s.integridad < 30, s.integridad < 55)} /></div>
        <span className="mono mini">{Math.round(s.integridad)}%</span>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        {remoto ? (
          <span className="mini muted">Se repara yendo hasta el equipo.</span>
        ) : aqui ? (
          puede(sala, yo, ['sistemas']) ? (
            <button className="small" disabled={s.integridad >= 95 || sala.rec.repuestos < kits} onClick={() => api.accion('reparar', { sistema: id })}>
              Reparar ({kits} kit{kits > 1 ? 's' : ''})
            </button>
          ) : (
            <Reservado a={['sistemas']} />
          )
        ) : (
          <span className="mini muted">Se repara fuera, en su ubicación.</span>
        )}
        {interruptor && puede(sala, yo, ['logistica', 'comandante', 'medico']) && (
          <button className="small" disabled={hayPropuesta(sala, 'equipo', (p) => p.sistema === id)} onClick={() => api.accion('equipo', { sistema: id })}>
            Proponer {s.activo ? 'apagar' : 'encender'}
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
          <strong>{o.nombre}{o.valor === actual ? ' · actual' : ''}</strong>
          <small>{o.nota}</small>
        </button>
      ))}
      {pendiente && <span className="mini warn">Hay una propuesta pendiente de aprobación.</span>}
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
        <Seccion titulo="Elegir dónde aterrizar">
          <p className="mini muted">El piloto propone un sitio y el comandante lo aprueba. La decisión condiciona el clima, la luz y el agua de toda la estancia.</p>
          {propuesta ? (
            <span className="mini warn">Propuesto: {propuesta.titulo}. Falta aprobarlo en Propuestas.</span>
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
      <Seccion titulo="Navegación">
        {enMarte(sala) ? (
          <p className="mini">La nave está en la superficie. Sol {sala.ambiente.sol} de {sala.mision.solesObjetivo}. El viaje duró {tiempoEnEspacio(sala)} y la misión lleva {energiaUsada(sala)} de energía usados.</p>
        ) : (
          <div className="rejilla">
            <Dato etiqueta="Viaje" valor={`${Math.round(v.progreso * 100)}%`} barra={{ valor: v.progreso * 100 }} />
            <Dato etiqueta="Velocidad" valor={`${v.velocidad} km/s`} />
            <Dato etiqueta="Distancia al Sol" valor={`${v.distSol} UA`} />
            <Dato etiqueta="Retardo de señal" valor={`${Math.floor(v.retardo / 60)} min ${v.retardo % 60} s`} />
            <Dato etiqueta="Combustible" valor={`${Math.round(sala.rec.propelente)}%`} tono={nivel(sala.rec.propelente < 10, sala.rec.propelente < 30)} />
            <Dato etiqueta="En el espacio" valor={tiempoEnEspacio(sala)} />
            <Dato etiqueta="Energía usada" valor={energiaUsada(sala)} />
            <Dato etiqueta="Luz solar" valor={`${sala.ambiente.flujoSolar} W/m²`} />
          </div>
        )}
      </Seccion>
      <Seccion titulo="Objetivo de la misión">
        <p className="mini">{sala.mision.objetivo}</p>
        <p className="mini muted">Faltan {Math.round(diasRestantes(sala))} días de misión. La escala de tiempo se controla en la barra superior; solo el comandante puede cambiarla.</p>
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
      <Seccion titulo="Aire de la cabina">
        <div className="rejilla">
          <Dato etiqueta="Oxígeno" valor={`${c.ppO2.toFixed(1)} kPa`} tono={nivel(c.ppO2 < C.PPO2_MINIMA_KPA, c.ppO2 < 19.5)} barra={{ valor: c.ppO2, max: C.PPO2_NOMINAL_KPA }} nota={`Lo normal es ${C.PPO2_NOMINAL_KPA} kPa`} />
          <Dato etiqueta="CO₂" valor={`${co2.toFixed(1)} mmHg`} tono={nivel(co2 > 10, co2 > 3)} barra={{ valor: co2, max: 15 }} nota="Límite de NASA: 3 mmHg" />
          <Dato etiqueta="Temperatura" valor={`${c.temp.toFixed(1)} °C`} tono={nivel(c.temp < 5 || c.temp > 32, c.temp < 15 || c.temp > 28)} />
        </div>
        <p className="mini muted">La tripulación consume unos {(sala.jugadores.filter((j) => j.rol).length * 0.84).toFixed(1)} kg de oxígeno al día y exhala casi lo mismo en CO₂.</p>
        {c.fuga > 0 && (
          <div className="help">
            Hay una fuga: se pierden {c.fuga} kg de aire por hora.{' '}
            {puede(sala, yo, ['sistemas']) ? <button className="small" disabled={remoto} title={remoto ? IR_HASTA_AQUI : undefined} onClick={() => api.accion('sellar')}>Sellar (1 kit)</button> : <Reservado a={['sistemas']} />}
          </div>
        )}
      </Seccion>
      <Seccion titulo="Producción y reciclaje">
        <Equipo sala={sala} yo={yo} id="oga" />
        <Equipo sala={sala} yo={yo} id="cdra" />
        <Equipo sala={sala} yo={yo} id="wrs" />
        <Equipo sala={sala} yo={yo} id="termico" />
      </Seccion>
      <Seccion titulo="Cartuchos de hidróxido de litio">
        <p className="mini">Quedan {sala.rec.lioh}. Los instalados pueden absorber aún {sala.rec.liohActivo.toFixed(1)} kg de CO₂. Funcionan sin electricidad.</p>
        {puede(sala, yo, ['logistica', 'sistemas']) ? (
          <button className="small" disabled={remoto || sala.rec.lioh < 1} title={remoto ? IR_HASTA_AQUI : undefined} onClick={() => api.accion('lioh')}>Instalar un cartucho ({C.LIOH_KG_CO2} kg de CO₂)</button>
        ) : (
          <Reservado a={['logistica', 'sistemas']} />
        )}
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
      <Seccion titulo="Balance de energía">
        <div className="rejilla">
          <Dato etiqueta="Generación" valor={`${e.generacion.toFixed(1)} kW`} />
          <Dato etiqueta="Consumo" valor={`${e.consumo.toFixed(1)} kW`} tono={nivel(false, e.consumo > e.generacion)} />
          <Dato etiqueta="Baterías" valor={`${Math.round(e.bateria)} / ${e.capacidad} kWh`} tono={nivel(pct < 15, pct < 40)} barra={{ valor: pct }} />
          <Dato etiqueta="Usada en la misión" valor={energiaUsada(sala)} nota="Electricidad consumida desde el despegue" />
        </div>
        <p className="mini muted">
          {horas !== null ? `A este ritmo las baterías duran ${horas.toFixed(1)} horas. ` : 'Las baterías se están cargando o están llenas. '}
          {enMarte(sala)
            ? `Hay ${sala.cargamento.paneles} campo(s) solar(es)${sala.cargamento.reactor ? ' y un reactor' : ''}. El polvo sobre los paneles quita un ${Math.round(e.polvo * 100)}%.`
            : 'En el espacio los paneles reciben luz todo el tiempo; al alejarse del Sol producen menos.'}
        </p>
        {e.cortes.length > 0 && <div className="help">Sin energía: {e.cortes.map((id) => nombreSistema(id)).join(', ')}.</div>}
      </Seccion>
      <Seccion titulo="Qué proteger si falta energía">
        <Opciones
          actual={sala.ajustes.prioridad}
          permitido={puede(sala, yo, ['logistica', 'comandante'])}
          pendiente={hayPropuesta(sala, 'prioridad')}
          onElegir={(valor) => api.accion('prioridad', { valor })}
          opciones={[
            { valor: 'vida', nombre: 'El aire', nota: 'Se sacrifica antes la calefacción que el oxígeno y el depurador.' },
            { valor: 'calor', nombre: 'El calor', nota: 'Se mantiene la calefacción; el oxígeno sale de los tanques.' },
            { valor: 'ciencia', nombre: 'El huerto', nota: 'Las luces del huerto se apagan después que la calefacción.' },
          ]}
        />
        {!puede(sala, yo, ['logistica', 'comandante']) && <Reservado a={['logistica', 'comandante']} />}
      </Seccion>
      <Seccion titulo="Planta de energía">
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
      <Seccion titulo="Suministros">
        <table className="tabla">
          <thead>
            <tr><th></th><th>Queda</th><th>Alcanza</th></tr>
          </thead>
          <tbody>
            {fila('Agua potable', `${Math.round(r.agua)} kg`, a.agua)}
            {fila('Agua por reciclar', `${Math.round(r.aguaResidual)} kg`, null)}
            {fila('Oxígeno en tanques', `${Math.round(r.o2)} kg`, a.aire)}
            {fila('Alimentos', `${Math.round(r.comida)} kg`, a.comida)}
            {fila('Repuestos', `${r.repuestos} kits`, null)}
            {fila('Botiquines', `${r.botiquines}`, null)}
            {fila('Cartuchos de LiOH', `${r.lioh}`, null)}
          </tbody>
        </table>
        <p className="mini muted">Faltan {Math.round(faltan)} días de misión. En rojo, lo que no alcanza al ritmo actual.</p>
      </Seccion>
      <Seccion titulo="Ración de comida">
        <Opciones
          actual={sala.ajustes.racionComida}
          permitido={manda}
          pendiente={hayPropuesta(sala, 'racionComida')}
          onElegir={(nivel_) => api.accion('racionComida', { nivel: nivel_ })}
          opciones={[
            { valor: 'normal', nombre: 'Completa', nota: `${C.COMIDA_KG_DIA} kg por persona y día.` },
            { valor: 'ahorro', nombre: 'Ahorro (80%)', nota: 'Dura un 25% más. Las reservas del cuerpo bajan poco a poco.' },
            { valor: 'estricto', nombre: 'Estricta (60%)', nota: 'Dura un 67% más. En semanas afecta a la salud.' },
          ]}
        />
      </Seccion>
      <Seccion titulo="Uso de agua">
        <Opciones
          actual={sala.ajustes.racionAgua}
          permitido={manda}
          pendiente={hayPropuesta(sala, 'racionAgua')}
          onElegir={(nivel_) => api.accion('racionAgua', { nivel: nivel_ })}
          opciones={[
            { valor: 'normal', nombre: 'Normal', nota: `${C.AGUA_BEBIDA_KG_DIA} kg para beber y ${C.AGUA_HIGIENE_KG_DIA} kg de higiene por persona.` },
            { valor: 'ahorro', nombre: 'Ahorro', nota: 'Higiene al mínimo. Lo que se bebe no cambia.' },
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
      <Seccion titulo="Signos de la tripulación">
        <table className="tabla compacta">
          <thead>
            <tr><th></th><th>Pulso</th><th>Resp.</th><th>O₂</th><th>Agua</th><th>Fatiga</th><th>Músc.</th><th>mSv</th><th></th></tr>
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
                  <td>
                    {soyMedico && (
                      <button className="small" disabled={remoto || sala.rec.botiquines < 1 || (!j.dolencia && j.incapacitado <= 0 && v.salud > 90)} title={remoto ? IR_HASTA_AQUI : undefined} onClick={() => api.accion('tratar', { jugadorId: j.id })}>
                        Tratar
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mini muted">Botiquines: {sala.rec.botiquines}. Cada tratamiento usa uno. Límite de radiación de carrera: {C.LIMITE_CARRERA_MSV} mSv.</p>
      </Seccion>
      <Seccion titulo="Plan de ejercicio">
        <Opciones
          actual={sala.ajustes.ejercicio}
          permitido={manda}
          pendiente={hayPropuesta(sala, 'ejercicio')}
          onElegir={(horas) => api.accion('ejercicio', { horas })}
          opciones={[
            { valor: 2.5, nombre: '2.5 horas al día', nota: 'Lo programado en la Estación Espacial. Mantiene músculo y hueso.' },
            { valor: 1, nombre: '1 hora al día', nota: 'Frena la pérdida a medias. Gasta menos aire, agua y comida.' },
            { valor: 0, nombre: 'Sin ejercicio', nota: 'Ahorra recursos, pero el cuerpo se debilita cada día sin gravedad.' },
          ]}
        />
      </Seccion>
      <Seccion titulo="Proteger de la radiación">
        <p className="mini">
          {sala.ambiente.tormentaSolar ? `Tormenta solar activa (la del ${sala.ambiente.tormentaSolar.fecha}).` : 'Sin tormenta solar.'} El refugio tiene {sala.blindaje} capa(s) de blindaje.
        </p>
        {manda ? (
          <div className="row" style={{ gap: 6 }}>
            {enRefugio ? (
              <button className="small" disabled={hayPropuesta(sala, 'refugio')} onClick={() => api.accion('refugio', { salir: true })}>Proponer salir del refugio</button>
            ) : (
              [6, 24, 48].map((h) => (
                <button key={h} className="small" disabled={hayPropuesta(sala, 'refugio')} onClick={() => api.accion('refugio', { horas: h })}>
                  Refugio {h} h
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
        {c.nombre}. Día {Math.floor(h.diasCultivo)} de cultivo; {maximo >= 1 ? 'hay plantas listas para cosechar' : `cosecha en unos ${Math.max(1, Math.round((1 - maximo) * c.dias))} días si se cuidan`}. Cosechas: {h.cosechas}, con {(h.comidaFresca ?? 0).toFixed(1)} kg de verdura fresca comida. Ventilador {h.ventilador === 'alto' ? 'alto: el sustrato se seca antes' : 'normal'}.
      </p>
      <div className="almohadillas">
        {lista.map((a, i) => (
          <div key={i} className={`almohadilla ${a.muerta ? 'muerta' : ''}`}>
            <b className="mini">Almohadilla {i + 1}</b>
            {a.muerta ? (
              <span className="mini bad">Planta muerta</span>
            ) : (
              <>
                <span className="mini muted">Humedad {Math.round(a.humedad)}%</span>
                <Barra valor={a.humedad} tono={a.humedad < 25 || a.humedad > 88 ? 'bad' : a.humedad < 40 || a.humedad > 80 ? 'warn' : 'azul'} />
                <span className="mini muted">Salud {Math.round(a.salud)}%</span>
                <Barra valor={a.salud} tono={a.salud < 40 ? 'bad' : a.salud < 70 ? 'warn' : 'ok'} />
                <span className="mini muted">Crecimiento {Math.round(a.crecimiento * 100)}%</span>
                <Barra valor={a.crecimiento * 100} tono="ok" />
                {a.moho >= 0.1 && <span className="mini warn">Pelusa blanca: moho</span>}
                {a.plantulas > 1 && <span className="mini muted">{a.plantulas} plántulas</span>}
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
      <Seccion titulo="Huerto artificial">
        {sala.cargamento.huerto < 1 ? (
          <p className="mini muted">No trajeron el kit de huerto.</p>
        ) : (
          <>
            {h.establecido && <Almohadillas sala={sala} />}
            <Tarea sala={sala} yo={yo} estacion="laboratorio" />
            {h.establecido && <Equipo sala={sala} yo={yo} id="huerto" />}
          </>
        )}
      </Seccion>
      <Seccion titulo="Muestras del terreno">
        <p className="mini">Analizadas: {sala.mision.muestrasAnalizadas} de {sala.mision.muestrasObjetivo}. Llevas {yo.muestras} sin analizar.</p>
        <button className="small primary" disabled={remoto || yo.muestras < 1} title={remoto ? IR_HASTA_AQUI : undefined} onClick={() => api.accion('analizar')}>
          Analizar mis muestras ({(1.5 * Math.max(1, yo.muestras)).toFixed(1)} kWh)
        </button>
        <p className="mini muted">Las muestras se recogen fuera, en los puntos marcados, cuando la base ya está operativa.</p>
      </Seccion>
    </>
  )
}

function Gimnasio({ yo }: P) {
  const activo = yo.manual === 'ejercicio'
  return (
    <Seccion titulo="Gimnasio">
      <p className="mini">Sin gravedad se pierde músculo y hueso. Tu condición es del {Math.round(yo.vit.condicion)}%. Una sesión dura una hora de misión: la recupera más rápido, pero sube el pulso, la sed y la fatiga.</p>
      <button className={activo ? 'small danger' : 'small primary'} onClick={() => api.actividad(activo ? null : 'ejercicio')}>{activo ? 'Dejar de ejercitarme' : 'Hacer ejercicio'}</button>
    </Seccion>
  )
}

function Literas({ yo }: P) {
  const activo = yo.manual === 'sueno'
  return (
    <Seccion titulo="Literas">
      <p className="mini">Tu fatiga es del {Math.round(yo.vit.fatiga)}%. Dormir la baja unos 12 puntos por hora. Si no te mueves durante la noche, tu personaje duerme solo.</p>
      <button className={activo ? 'small danger' : 'small primary'} onClick={() => api.actividad(activo ? null : 'sueno')}>{activo ? 'Levantarme' : 'Dormir'}</button>
    </Seccion>
  )
}

function Refugio({ sala, yo }: P) {
  const ts = sala.ambiente.tormentaSolar
  const obligado = sala.refugioHasta > sala.t
  const remoto = useContext(Remoto)
  return (
    <Seccion titulo="Refugio contra la radiación">
      <p className="mini">
        Paredes de agua con {sala.blindaje} capa(s) extra de blindaje. Frena bien las partículas del Sol y muy poco los rayos cósmicos.{' '}
        {ts ? `Hay una tormenta solar: fuera del refugio la dosis sube.` : 'Ahora no hay tormenta solar.'}
      </p>
      <p className="mini muted">Tu dosis ahora: {yo.vit.dosisTasa} mSv por día. Dentro del refugio no puedes trabajar.</p>
      {obligado && yo.enRefugio ? (
        <span className="mini warn">Orden de refugio en curso. El médico o el comandante pueden levantarla.</span>
      ) : (
        <button className={yo.enRefugio ? 'small danger' : 'small primary'} disabled={remoto} title={remoto ? IR_HASTA_AQUI : undefined} onClick={() => api.refugio(!yo.enRefugio)}>{yo.enRefugio ? 'Salir del refugio' : 'Entrar al refugio'}</button>
      )}
    </Seccion>
  )
}

function Esclusa({ sala, yo }: P) {
  const abrir = useStore((s) => s.abrirEstacion)
  const o2 = pctTraje(yo.trajeO2)
  const listo = yo.trajeO2 >= C.TRAJE_O2_KG * 0.3 && yo.trajeBateria >= 0.3
  const a = sala.ambiente
  return (
    <>
      <Tarea sala={sala} yo={yo} estacion="esclusa" />
      <Seccion titulo="Tu traje">
        <div className="rejilla">
          <Dato etiqueta="Oxígeno" valor={`${o2}%`} tono={nivel(o2 < 20, o2 < 40)} barra={{ valor: o2 }} />
          <Dato etiqueta="Batería" valor={`${Math.round(yo.trajeBateria * 100)}%`} tono={nivel(yo.trajeBateria < 0.2, yo.trajeBateria < 0.4)} barra={{ valor: yo.trajeBateria * 100 }} />
        </div>
        <p className="mini muted">Oxígeno puro a {C.TRAJE_PRESION_KPA} kPa. Lleno dura entre 7 y {C.TRAJE_BATERIA_H} horas; trabajando se gasta antes. Si se agota fuera, te rescatan con daño.</p>
      </Seccion>
      <Seccion titulo="Salir al exterior">
        {enMarte(sala) ? (
          <>
            <p className="mini">Fuera hay {a.tempExt} °C y {a.presion} Pa{a.tormentaPolvo ? ', con tormenta de polvo' : ''}. Mientras alguien esté fuera, el tiempo no corre a más de ×60.</p>
            <button
              className="primary"
              disabled={!listo || yo.enRefugio || yo.incapacitado > 0}
              onClick={async () => {
                const r = await api.zona('exterior')
                if (r && !r.error) abrir(null)
              }}
            >
              Ponerme el traje y salir
            </button>
            {!listo && <span className="mini warn"> El traje se está recargando.</span>}
          </>
        ) : (
          <p className="mini muted">Solo se puede salir cuando la nave esté en Marte.</p>
        )}
      </Seccion>
      <Seccion titulo="Equipo">
        <Equipo sala={sala} yo={yo} id="esclusa" />
      </Seccion>
    </>
  )
}

function EsclusaExterior() {
  const abrir = useStore((s) => s.abrirEstacion)
  return (
    <Seccion titulo="Volver al hábitat">
      <p className="mini">Dentro te quitas el traje y la esclusa lo recarga.</p>
      <button
        className="primary"
        onClick={async () => {
          const r = await api.zona('nave')
          if (r && !r.error) abrir(null)
        }}
      >
        Entrar
      </button>
    </Seccion>
  )
}

function CampoSolar({ sala, yo }: P) {
  const desplegado = Boolean(sala.ensamblaje.hechas.paneles)
  const polvo = Math.round(sala.energia.polvo * 100)
  return (
    <>
      <Tarea sala={sala} yo={yo} estacion="campoSolar" />
      <Seccion titulo="Campos solares">
        {desplegado ? (
          <>
            <p className="mini">{sala.cargamento.paneles} campo(s) de 50 m². Cada uno da hasta {C.PANEL_KW} kW al mediodía con cielo limpio. Por cómo se orientaron aprovechan el {Math.round((sala.efectos?.solar ?? 1) * 100)}% de la luz. El polvo acumulado quita un {polvo}%.</p>
            <button className="small primary" disabled={polvo < 3} onClick={() => api.accion('limpiar')}>Limpiar los paneles</button>
            <p className="mini muted">Cualquiera puede limpiarlos. El polvo vuelve a posarse cada sol, y mucho más rápido en una tormenta.</p>
          </>
        ) : (
          <p className="mini muted">Los paneles siguen plegados.</p>
        )}
      </Seccion>
    </>
  )
}

function Muestreo({ sala, yo, id }: P & { id: string }) {
  const tomada = sala.muestreos.includes(id)
  return (
    <Seccion titulo="Punto de muestreo">
      <p className="mini">Roca y suelo sin alterar. Llevas {yo.muestras} de 3 muestras posibles antes de volver al laboratorio.</p>
      {tomada ? (
        <span className="mini ok">Ya se tomó la muestra de este punto.</span>
      ) : puede(sala, yo, ['cientifico']) ? (
        <button className="primary" disabled={yo.muestras >= 3} onClick={() => api.accion('muestra', { sitio: id })}>Recoger muestra</button>
      ) : (
        <Reservado a={['cientifico']} />
      )}
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
      <Seccion titulo="Hablar con la tripulación">
        <p className="mini">
          Aquí come la tripulación y se reúne a decidir. Con el chat de voz se oye más fuerte a quien está cerca; si alguien está fuera con el traje, se le oye por radio.
        </p>
        {!v.disponible ? (
          <p className="mini muted">El chat de voz funciona en el juego publicado. En este servidor se puede escribir en el chat del asistente.</p>
        ) : v.activa ? (
          <div className="row" style={{ gap: 6 }}>
            <span className="mini ok">Voz activa · {v.conectados} conectado(s){v.microfono === 'denegado' ? ' · solo escuchas: sin permiso de micrófono' : ''}</span>
            {v.microfono === 'si' && <button className="small" onClick={() => voz.silenciar(!v.silenciado)}>{v.silenciado ? 'Activar micrófono' : 'Silenciar micrófono'}</button>}
            <button className="small" onClick={() => voz.desactivar()}>Salir de la voz</button>
          </div>
        ) : (
          <button className="primary" onClick={() => void voz.activar()}>Entrar al chat de voz</button>
        )}
        {v.error && <p className="mini warn">{v.error}</p>}
      </Seccion>
      <Seccion titulo="En la nave ahora">
        <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
          {aqui.map((j) => (
            <span key={j.id} className="tag">
              <RolTag rol={j.rol} /> {j.nombre}
            </span>
          ))}
        </div>
        <button className="small" style={{ marginTop: 6 }} onClick={() => setPestana('asistente')}>Escribir al equipo</button>
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
      return <EsclusaExterior />
    case 'campoSolar':
      return <CampoSolar {...p} />
    case 'plantaExt':
      return (
        <Seccion titulo="Planta de energía">
          <p className="mini">Reparte la energía de los paneles{p.sala.cargamento.reactor ? ' y del reactor' : ''} y carga las baterías.</p>
          <Equipo {...p} id="energia" />
        </Seccion>
      )
    case 'carga':
      return (
        <>
          <Tarea {...p} estacion="carga" />
          <Seccion titulo="Zona de carga">
            <p className="mini">Aquí bajaron los equipos de superficie{p.sala.cargamento.reactor ? ', incluido el reactor' : ''}. {p.sala.ensamblaje.hechas.carga ? 'Ya está todo descargado.' : 'Hay que descargarlos para poder usarlos.'}</p>
          </Seccion>
        </>
      )
    case 'antena':
      return (
        <>
          <Tarea {...p} estacion="antena" />
          <Seccion titulo="Antena">
            <p className="mini">Enlace con la Tierra. Un mensaje tarda unos {Math.max(3, Math.round(p.sala.vuelo.retardo / 60))} minutos en llegar: por eso la tripulación decide sola.</p>
          </Seccion>
        </>
      )
    case 'isruExt':
      return (
        <Seccion titulo="Extractor de hielo">
          <p className="mini">Derrite hielo enterrado y bombea hasta 45 kg de agua al día. Consume 3 kW.</p>
          <Equipo {...p} id="isru" />
        </Seccion>
      )
    default:
      return id.startsWith('muestra') ? <Muestreo {...p} id={id} /> : null
  }
}

// ---------- Página principal ----------

const RACION = { normal: 'completa', ahorro: 'de ahorro', estricto: 'estricta' } as const
const PROTEGE = { vida: 'el aire', calor: 'el calor', ciencia: 'el huerto' } as const

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
        texto: `Agua ${diasTexto(a.agua)}, aire ${diasTexto(a.aire)}, comida ${diasTexto(a.comida)}. Baterías al ${bat}%. Faltan ${Math.round(faltan)} días de misión.`,
        tono: nivel(minimo < faltan * 0.9 || bat < 15, minimo < faltan * 1.15 || bat < 40),
      }
    }
    case 'distribuir':
      return {
        texto: `Ración de comida ${RACION[sala.ajustes.racionComida]}, agua en uso ${sala.ajustes.racionAgua === 'normal' ? 'normal' : 'de ahorro'}. Si falta energía se protege ${PROTEGE[sala.ajustes.prioridad]}.`,
        tono: nivel(false, sala.ajustes.racionComida !== 'normal' || sala.ajustes.racionAgua !== 'normal'),
      }
    case 'produccion': {
      const equipos = (['oga', 'cdra', 'wrs'] as SistemaId[]).map((x) => sala.sistemas.find((s) => s.id === x)!)
      const parados = equipos.filter((s) => !s.operativo)
      return {
        texto: parados.length ? `Parado: ${parados.map((s) => nombreSistema(s.id)).join(', ')}.` : 'El generador de oxígeno, el depurador de CO₂ y el reciclador de agua están en marcha.',
        tono: nivel(parados.length > 1, parados.length === 1),
      }
    }
    case 'equipos': {
      const peor = [...instalados].sort((x, y) => x.integridad - y.integridad)[0]
      return {
        texto: `El más gastado: ${nombreSistema(peor.id)}, al ${Math.round(peor.integridad)}%. Quedan ${sala.rec.repuestos} kits de repuestos.`,
        tono: nivel(peor.integridad < 30, peor.integridad < 55),
      }
    }
    case 'radiacion': {
      const dosis = Math.max(0, ...sala.jugadores.filter((j) => j.rol).map((j) => j.vit.dosis))
      const ts = sala.ambiente.tormentaSolar
      return {
        texto: `Dosis más alta: ${Math.round(dosis)} de ${C.LIMITE_CARRERA_MSV} mSv. ${ts ? 'Hay una tormenta solar activa.' : 'Sin tormenta solar.'}${sala.refugioHasta > sala.t ? ' Orden de refugio en curso.' : ''}`,
        tono: nivel(dosis > C.LIMITE_CARRERA_MSV, Boolean(ts) || dosis > 450),
      }
    }
    case 'huerto': {
      const h = sala.huerto
      return {
        texto: sala.cargamento.huerto < 1 ? 'No trajeron el kit de huerto.' : h.establecido ? `${CULTIVO_BY_ID[h.cultivo ?? 'lechuga'].nombre}: ${(h.almohadillas ?? []).filter((a) => !a.muerta).length} plantas vivas. Cosechas: ${h.cosechas}.` : `Montaje al ${h.progreso}%.`,
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
          <strong>Misión de ensamblaje de la base · paso {paso.paso} de 3</strong>
          <p>{paso.titulo}. <span className="muted">{roles(paso.roles)}</span></p>
          {tareas.map((t) => (
            <div key={t.id} className={`mini ${sala.ensamblaje.hechas[t.id] ? 'ok' : ''}`}>
              {sala.ensamblaje.hechas[t.id] ? '✓' : '○'} {t.titulo} · {ESTACION_BY_ID[t.estacion].nombre} ({t.zona === 'exterior' ? 'fuera, con el traje' : 'dentro'})
            </div>
          ))}
        </div>
      )}
      {sala.fase === 'base' && <div className="help ok">Base activada. Hay que mantenerla en marcha hasta completar los {sala.mision.solesObjetivo} soles.</div>}
      {pendientes > 0 && (
        <div className="help">
          {decideComandante
            ? yo.rol === 'comandante'
              ? `Tienes ${pendientes} decisión(es) de otros integrantes por aprobar o rechazar, velando por el bienestar de la mayoría.`
              : `Hay ${pendientes} decisión(es) esperando al comandante.`
            : `Hay ${pendientes} decisión(es) en votación.`}{' '}
          <button className="small" onClick={() => setPestana('propuestas')}>Ver propuestas</button>
        </div>
      )}
      <Seccion titulo="Administrar los recursos">
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
                <p className="mini muted">{o.descripcion}{mia ? ' Te corresponde a ti.' : ''}</p>
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
  const impedido = yo.incapacitado > 0 ? 'Estás fuera de servicio.' : yo.enRefugio && id !== 'refugio' ? 'Estás en el refugio: no puedes trabajar.' : null
  return (
    <div className="panel estacion">
      <div className="row cabecera">
        {remoto && <button className="small plano" onClick={() => abrir('principal')}>‹ Página principal</button>}
        <h2 className="grow">{principal ? `Página principal · ${enMarte(sala) ? 'base' : 'nave'}` : e.nombre}</h2>
        <span className="mini muted">{roles(sala.jugadores.filter((j) => j.rol === yo.rol).map((j) => j.rol!))}</span>
        <button className="small" onClick={() => abrir(null)}>Cerrar{principal ? ' (M)' : ' (E)'}</button>
      </div>
      {impedido && !principal && <div className="help">{impedido}</div>}
      {remoto && !principal && <div className="help ok">La ves desde la página principal. Aquí puedes consultar y proponer decisiones; para reparar, instalar, tratar o cultivar hay que ir hasta {e.nombre}.</div>}
      <div className="cuerpo">
        <Remoto.Provider value={remoto && !principal}>{principal ? <Principal sala={sala} yo={yo} /> : contenido(id, { sala, yo })}</Remoto.Provider>
      </div>
    </div>
  )
}
