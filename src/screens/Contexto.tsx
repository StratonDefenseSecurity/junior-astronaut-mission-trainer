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
const HACIENDO = ['Lee la situación', 'Elige su rol', 'Revisa el objetivo', 'Elige los suministros']

function Asistente({ children }: { children: ReactNode }) {
  return (
    <div className="assistant">
      <strong>Asistente:</strong> {children}
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
      etiqueta: 'El viaje',
      valor: `${Math.min(...dias)} a ${Math.max(...dias)} días`,
      texto: 'Según la trayectoria que elijan. Todo ese tiempo vivirán dentro de la nave, sin gravedad y sin poder bajar.',
    },
    {
      etiqueta: 'La Tierra, lejos',
      valor: `${Math.min(...senal)} a ${Math.max(...senal)} minutos`,
      texto: 'Lo que tardará en llegar un mensaje cuando estén en Marte. Las decisiones urgentes las tomarán ustedes.',
    },
    {
      etiqueta: 'El aire de Marte',
      valor: `${REMS_RESUMEN.pMin} a ${REMS_RESUMEN.pMax} pascales`,
      texto: `Lo que midió Curiosity: como mucho el ${presion}% de la presión de la Tierra. Es casi todo dióxido de carbono. Fuera del hábitat solo se sobrevive con traje.`,
    },
    {
      etiqueta: 'El frío',
      valor: `${REMS_RESUMEN.tMin} a ${REMS_RESUMEN.tMax} °C`,
      texto: `Lo que midió el rover Curiosity durante ${REMS_RESUMEN.soles} soles, un año marciano entero. Ese será el clima de su base.`,
    },
    {
      etiqueta: 'La radiación',
      valor: `${C.GCR_CRUCERO_MSV_DIA} mSv cada día`,
      texto: `de rayos cósmicos durante el viaje. El límite de NASA para toda una carrera es ${C.LIMITE_CARRERA_MSV} mSv, y las tormentas solares suman más.`,
    },
    {
      etiqueta: 'Cada persona, cada día',
      valor: '0.84 kg de oxígeno',
      texto: `más ${C.AGUA_BEBIDA_KG_DIA} kg de agua para beber y ${C.COMIDA_KG_DIA} kg de comida. Multiplicado por ${n} tripulantes y por cientos de días.`,
    },
  ]
  const esc = escenarioDe(sala.escenario)
  return (
    <div className="stack">
      <div className="escenario-cabecera">
        <h2>{esc.nombre}</h2>
        <span className="fecha">Despegue: {fechaLarga(new Date(esc.lanzamiento))}</span>
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
        <strong>El reto de esta misión</strong>
        {esc.reto}
      </div>
      <h3>Lo que afronta cualquier tripulación que viaje a Marte</h3>
      <p className="mini muted">Son {n}. Nadie los espera allá y nadie puede ir a buscarlos: lo que lleven en la nave es todo lo que tendrán.</p>
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
        <strong>Lo que tienen que lograr</strong>
        <p className="mini">Llegar a Marte, montar la base, mantener con vida a toda la tripulación y analizar muestras del terreno. Cuántos soles se quedan y cuántas muestras analizan lo establecerán más adelante, al fijar el objetivo.</p>
      </div>
      <Asistente>
        Voy a acompañarlos toda la misión. Ahora cada uno recibirá su rol, después se establecerá el objetivo y al final elegirán los suministros. En cada elección les diré qué consecuencias tiene.
      </Asistente>
      {esc.supuestos.length > 0 && (
        <div>
          <span className="mini muted">Supuestos del juego en esta situación:</span>
          <ul className="supuestos">
            {esc.supuestos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="row">
        <button className="small plano" onClick={() => setFuentes(true)}>De dónde salen estos datos</button>
        <div className="grow" />
        <button className="primary" onClick={alSeguir}>Entendido: ver los roles</button>
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
        <p className="mini muted">Cada rol tiene tareas que le corresponden y consecuencias distintas si falla. Elige el tuyo; no puede repetirse.</p>
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
                      {esMio ? 'tú' : dueno.nombre}
                      <MarcaIA bot={dueno.bot} />
                    </span>
                  )}
                </div>
                <span className="muted">{r.descripcion}</span>
                <span className="mini">Le toca: {tareasDeRol(r.id).map((t) => t.charAt(0).toLowerCase() + t.slice(1)).join('; ')}.</span>
                <span className="consecuencia">{r.consecuencias}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="stack lobby-lado">
        <h3>{mio ? `Tu rol: ${mio.nombre}` : 'Aún no tienes rol'}</h3>
        <VistaTraje traje={yo.traje} distintivo={mio?.color ?? '#94a3b8'} />
        <Asistente>
          {mio ? `${mio.consecuencias} Puedes cambiar de rol mientras no hayan despegado.` : 'Elige un rol de la lista. Te diré qué consecuencias tiene.'}
        </Asistente>
        {!hayComandante && <div className="help">Todavía nadie es comandante. Sin comandante no se puede despegar.</div>}
        {n < ROLES.length && (
          <p className="mini muted">
            Son {n}, así que quedarán {ROLES.length - n} roles sin cubrir. Sus tareas las podrá hacer cualquiera de ustedes.
          </p>
        )}
        <button className="primary" disabled={!mio} onClick={alSeguir}>Continuar: objetivo de la misión</button>
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
  if (!editable) return <div className="nombre-mision">{sala.nombreMision || 'Todavía sin nombre'}</div>
  return (
    <input
      className="nombre-mision"
      value={texto}
      maxLength={28}
      placeholder="Por ejemplo: Inti 1, Chaski, Esperanza…"
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
        <h3>¿Cuánto se quedan en Marte? {mando ? '' : '· lo establece el comandante'}</h3>
        <div className="opciones">
          {PERFILES.map((p) => (
            <button key={p.id} className={`opcion ${sala.perfil === p.id ? 'activa' : ''}`} disabled={!mando || sala.perfil === p.id} onClick={() => api.perfil(p.id)}>
              <strong>{p.nombre}</strong>
              <small>{p.descripcion}</small>
            </button>
          ))}
        </div>
        <h3>¿Por dónde viajan? {navega ? '' : '· lo eligen el piloto o el comandante'}</h3>
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
          <span className="brand">Objetivo de la misión</span>
          <p>{sala.mision.objetivo}</p>
          <span className="mini muted">
            {comandante ? `Lo establece ${comandante.nombre}, comandante.` : 'Aún no hay comandante: por ahora puede fijarlo cualquiera que ya tenga rol.'}
          </span>
        </div>
        <label className="stack" style={{ gap: 4 }}>
          <span className="mini muted">Nombre de la misión {mando ? '· aparecerá en la nave, en los trajes y en el certificado final' : '· lo pone el comandante'}</span>
          <NombreMision sala={sala} editable={mando} />
        </label>
        {esc.sitio && (
          <Asistente>
            Esta misión aterrizará en {SITE_BY_ID[esc.sitio].nombre}: {SITE_BY_ID[esc.sitio].descripcion}
          </Asistente>
        )}
        <Asistente>
          Con este plan pasarán {Math.round(a.total)} días fuera de la Tierra: {a.viaje} de viaje y {Math.round(a.estancia)} en la superficie.
        </Asistente>
        <ul className="analisis">
          <Linea bien={a.dosis < 480} regular={a.dosis < C.LIMITE_CARRERA_MSV}>
            Radiación de fondo: unos {Math.round(a.dosis)} mSv por persona, de un límite de {C.LIMITE_CARRERA_MSV}. Un viaje más corto la reduce.
          </Linea>
          <Linea bien>
            La nave admite {sala.capacidad.toFixed(1)} toneladas de carga con esta trayectoria. La más rápida gasta más propelente y deja menos sitio.
          </Linea>
          <Linea bien>
            Más soles en Marte piden más comida, más agua y más repuestos. Lo verán en el siguiente paso.
          </Linea>
        </ul>
        <div className="row">
          <div className="grow" />
          <button className="primary" onClick={alSeguir}>Continuar: suministros</button>
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
    ? 'La carga supera lo que admite la nave: hay que dejar algo.'
    : !hayComandante
      ? 'Falta que alguien asuma el rol de comandante.'
      : sinRol.length
        ? `Faltan por elegir rol: ${sinRol.map((j) => j.nombre).join(', ')}.`
        : faltan.length
          ? `Faltan por confirmar: ${faltan.map((j) => j.nombre).join(', ')}.`
          : null

  return (
    <div className="contexto-rejilla">
      <div className="stack">
        <h3>Tres alternativas</h3>
        <div className="opciones">
          {ALTERNATIVAS.map((alt) => {
            const carga = cargaRecomendada(sala, alt.margen)
            const masa = masaTotal(carga)
            const elegida = SUPPLIES.every((s) => carga[s.id] === sala.cargamento[s.id])
            return (
              <button key={alt.id} className={`opcion ${elegida ? 'activa' : ''}`} onClick={() => { setUltimo(null); void api.preset(alt.id) }}>
                <strong>
                  {alt.nombre} · {masa.toFixed(1)} t {masa > sala.capacidad ? <i className="bad">no cabe</i> : null}
                </strong>
                <small>{alt.descripcion}</small>
              </button>
            )
          })}
        </div>

        <details className="ajuste">
          <summary>Ajustar las cantidades a mano</summary>
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
        <h3>El asistente analiza las consecuencias</h3>
        {escenarioDe(sala.escenario).consejo && <Asistente>{escenarioDe(sala.escenario).consejo}</Asistente>}
        <div className="row" style={{ gap: 6 }}>
          <span className="mini muted">Carga</span>
          <div className="grow"><Barra valor={sala.masa} max={sala.capacidad} tono={nivel(exceso, sala.masa > sala.capacidad * 0.93)} /></div>
          <span className={`mono mini ${exceso ? 'bad' : ''}`}>{sala.masa.toFixed(1)} / {sala.capacidad.toFixed(1)} t</span>
        </div>
        <ul className="analisis">
          <Linea bien={a.comida >= a.total} regular={a.comida >= a.total * 0.85}>
            Comida para {Math.round(a.comida)} días; la misión dura {Math.round(a.total)}. No se puede reciclar.
          </Linea>
          <Linea bien={a.agua >= a.total} regular={a.agua >= a.total * 0.85}>
            Agua para unos {Math.round(a.agua)} días, reciclando el 98% y fabricando con ella el oxígeno.
          </Linea>
          <Linea bien={a.aireTanques >= 10} regular={a.aireTanques >= 4}>
            Oxígeno en tanques para {Math.round(a.aireTanques)} días si el generador falla.
          </Linea>
          <Linea bien={a.energia >= 7.5} regular={a.energia >= 6}>
            Energía media en Marte: {a.energia.toFixed(1)} kW; la base consume cerca de 7.
          </Linea>
          <Linea bien={a.noche >= 150} regular={a.noche >= 90 || sala.cargamento.reactor > 0}>
            Baterías: {a.noche} kWh. Una noche marciana pide unos 85{sala.cargamento.reactor ? '; el reactor también funciona de noche' : ''}.
          </Linea>
          <Linea bien={sala.cargamento.blindaje >= 1} regular>
            {sala.cargamento.blindaje} capa(s) de blindaje en el refugio para las tormentas solares.
          </Linea>
          {sala.mision.aguaObjetivo > 0 && (
            <Linea bien={sala.cargamento.isru > 0}>
              Extractor de hielo {sala.cargamento.isru > 0 ? 'a bordo' : 'sin cargar'}: la meta es sacar {sala.mision.aguaObjetivo} kg de agua. Da hasta 45 kg al día si tiene energía.
            </Linea>
          )}
          <Linea bien={sala.cargamento.repuestos >= 14} regular={sala.cargamento.repuestos >= 8}>
            {sala.cargamento.repuestos} kits de repuestos para {Math.round(a.total)} días de desgaste y averías.
          </Linea>
        </ul>

        <h3>Listos para despegar</h3>
        <div className="row" style={{ gap: 6 }}>
          <button className={yo.listo ? 'ok grow' : 'grow'} onClick={() => api.listo(!yo.listo)}>{yo.listo ? 'Listo ✓ (pulsa para cambiar)' : 'Estoy listo'}</button>
          {mando && (
            <button className="primary grow" disabled={Boolean(impide)} onClick={() => api.lanzar()}>
              Autorizar lanzamiento
            </button>
          )}
        </div>
        <p className="mini muted">{impide ?? (mando ? 'Todo listo. El comandante autoriza el lanzamiento.' : 'El comandante autoriza el lanzamiento cuando todos estén listos.')}</p>
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
            <div className="brand">Contextualización · sala {sala.codigo}</div>
            <h1>{PASOS_CONTEXTO[actual].titulo}</h1>
          </div>
          <button className="small" onClick={() => api.salir()}>Salir</button>
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
              {j.id === yo.id ? ' (tú)' : ''} · {j.listo ? 'listo ✓' : j.conectado ? HACIENDO[j.paso ?? 0] : 'ausente'}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
