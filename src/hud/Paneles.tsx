// Paneles fijos de la pantalla de juego: barra superior, mi estado, tripulación, puntos
// críticos y registro. Siguen el boceto del equipo: el mundo al centro, los integrantes a un
// lado con su oxígeno, salud y pulso, y los puntos críticos abajo.
import { useState } from 'react'
import { useGraficos } from '../graficos'
import { C } from '@shared/ciencia'
import { ESCALAS, ESCALA_MAXIMA, ROLES, ROLE_BY_ID, SITE_BY_ID, etiquetaTiempo, formatoHora, type Player, type RoomState } from '@shared/types'
import { puede } from '../mundo/mapa'
import { api } from '../red'
import { useStore, useYo } from '../store'
import { sonido, useSonido } from '../sonido'
import { useVoz, voz } from '../voz'
import { Barra, Dato, MarcaIA, RolTag, enMarte, energiaUsada, escalaTexto, mmHg, nivel, pctTraje, relojMision, tiempoEnEspacio } from './comun'

const FASES: Record<RoomState['fase'], string> = {
  lobby: 'Sala',
  contexto: 'Contextualización',
  lanzamiento: 'Lanzamiento',
  transito: 'Viaje a Marte',
  llegada: 'Llegada a Marte',
  ensamblaje: 'Montaje de la base',
  base: 'Base en operación',
  fin: 'Misión terminada',
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
        <div className="mini muted">Escala de tiempo{sala.pausa ? ' · EN PAUSA' : ''}</div>
        <div className="row" style={{ gap: 4 }}>
          {fija ? (
            <span className="chip activo">×{sala.escala} · {escalaTexto(sala.escala)}</span>
          ) : (
            ESCALAS.filter((e) => e.valor <= maxima).map((e) => (
              <button
                key={e.valor}
                className={`chip ${sala.escalaDeseada === e.valor ? 'activo' : ''}`}
                disabled={!mando}
                title={mando ? e.detalle : 'La escala la controla el comandante'}
                onClick={() => api.escala(e.valor)}
              >
                {e.nombre}
              </button>
            ))
          )}
          {!fija && mando && (
            <button className="chip" onClick={() => api.pausa(!sala.pausa)}>
              {sala.pausa ? 'Reanudar' : 'Pausa'}
            </button>
          )}
        </div>
        <div className="mini" style={{ color: frenada ? 'var(--warn)' : 'var(--muted)' }}>
          {frenada ? `Corre a ×${sala.escala}: hay una alerta o alguien fuera` : escalaTexto(sala.escala)}
        </div>
      </div>

      {enMarte(sala) ? (
        <div className="bloque datos">
          <Dato etiqueta="Fuera" valor={`${a.tempExt} °C`} nota={`Datos del sol ${a.solCuriosity} de Curiosity`} />
          <Dato etiqueta="Presión" valor={`${a.presion} Pa`} />
          <Dato etiqueta="Polvo" valor={a.tau.toFixed(1)} tono={nivel(a.tau > 2.5, a.tau > 1.2)} nota="Opacidad del cielo (modelo del juego)" />
          <Dato etiqueta="Luz" valor={`${a.flujoSolar} W/m²`} />
          <Dato etiqueta="Sitio" valor={SITE_BY_ID[sala.sitio ?? 'gale'].nombre} />
        </div>
      ) : sala.fase === 'transito' || sala.fase === 'llegada' ? (
        <div className="bloque datos">
          <Dato etiqueta="A Marte" valor={`${v.distMarte} M km`} barra={{ valor: v.progreso * 100 }} nota={`Llevan el ${Math.round(v.progreso * 100)}% del viaje`} />
          <Dato etiqueta="Señal" valor={`${Math.floor(v.retardo / 60)} min ${v.retardo % 60} s`} nota={`Lo que tarda un mensaje en llegar a la Tierra, a ${v.distTierra} millones de km`} />
          <Dato etiqueta="En el espacio" valor={tiempoEnEspacio(sala)} nota="Días y horas desde que alcanzaron la órbita" />
          <Dato etiqueta="Combustible" valor={`${Math.round(sala.rec.propelente)}%`} tono={nivel(sala.rec.propelente < 10, sala.rec.propelente < 30)} nota="Propelente que queda para corregir el rumbo y aterrizar" />
          <Dato etiqueta="Energía usada" valor={energiaUsada(sala)} nota="Electricidad consumida desde el despegue" />
        </div>
      ) : (
        <div className="bloque datos">
          <Dato etiqueta="Etapa" valor={v.etapa} />
          <Dato etiqueta="Altitud" valor={`${v.altitud} km`} />
          <Dato etiqueta="Velocidad" valor={`${v.velocidad} km/s`} />
          <Dato etiqueta="Aceleración" valor={`${v.g} g`} tono={nivel(v.g > 4, v.g > 2.5)} />
          <Dato etiqueta="Combustible" valor={`${Math.round(sala.rec.propelente)}%`} nota="Propelente de la etapa que está empujando" />
          <Dato etiqueta="Energía usada" valor={energiaUsada(sala)} nota="Electricidad consumida desde el despegue" />
        </div>
      )}

      <div className="bloque datos">
        {enMarte(sala) && <Dato etiqueta="Muestras" valor={`${sala.mision.muestrasAnalizadas}/${sala.mision.muestrasObjetivo}`} />}
        <Dato etiqueta="Radiación" valor={`${a.radiacion} mSv/d`} tono={a.tormentaSolar ? 'bad' : undefined} nota="Dosis de fondo por rayos cósmicos" />
      </div>

      <div className="grow" />
      <div className="bloque" style={{ textAlign: 'right', marginLeft: 'auto' }}>
        <div className="mono mini">Sala {sala.codigo}</div>
        <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
          <BotonesAudio />
          <button className="chip" onClick={alternar} title="Tecla H">Paneles</button>
          <button className="chip" onClick={() => setFuentes(true)}>Fuentes</button>
          <button className="chip" onClick={() => api.salir()}>Salir</button>
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
      <button className="chip" title={g.calidad === 'alta' ? 'Gráficos en alta calidad. Pulsa para la versión ligera, mejor en computadoras sencillas.' : 'Gráficos ligeros. Pulsa para la alta calidad.'} onClick={g.alternar}>
        {g.calidad === 'alta' ? 'HD' : 'Ligero'}
      </button>
      <button className="chip" title={s.silenciado ? 'Activar el sonido' : 'Silenciar'} onClick={() => (void sonido.activar(), sonido.silenciar(!s.silenciado))}>
        {s.silenciado ? 'Sonido: no' : 'Sonido'}
      </button>
      {v.disponible && (
        <button
          className={`chip ${v.activa ? 'activo' : ''}`}
          title={v.activa ? 'Salir del chat de voz' : 'Hablar con la tripulación'}
          onClick={() => (v.activa ? voz.desactivar() : void voz.activar())}
        >
          {v.activa ? `Voz · ${v.conectados}` : 'Voz'}
        </button>
      )}
      {v.activa && v.microfono === 'si' && (
        <button className="chip" title="Micrófono" onClick={() => voz.silenciar(!v.silenciado)}>
          {v.silenciado ? 'Mic: no' : 'Mic'}
        </button>
      )}
    </>
  )
}

const ACTIVIDAD: Record<Player['actividad'], string> = { sueno: 'Durmiendo', reposo: 'En reposo', trabajo: 'Trabajando', ejercicio: 'Haciendo ejercicio', eva: 'Fuera, con el traje' }

/** El cuerpo y el traje del jugador. */
export function MiEstado({ sala, yo }: { sala: RoomState; yo: Player }) {
  const v = yo.vit
  const fuera = yo.zona === 'exterior'
  const o2 = pctTraje(yo.trajeO2)
  const aire = fuera ? `traje: ${C.TRAJE_PRESION_KPA} kPa de oxígeno puro` : `cabina: ${sala.cabina.ppO2.toFixed(1)} kPa de O₂, ${mmHg(sala.cabina.ppCO2).toFixed(1)} mmHg de CO₂`
  return (
    <div className="panel estado">
      <div className="row" style={{ gap: 6 }}>
        <RolTag rol={yo.rol} />
        <strong className="grow">{yo.nombre}</strong>
        <span className="mini muted">{yo.incapacitado > 0 ? 'Fuera de servicio' : yo.enRefugio ? 'En el refugio' : ACTIVIDAD[yo.actividad]}</span>
      </div>
      <div className="vitales">
        <Dato etiqueta="Pulso" valor={`${Math.round(v.fc)} lpm`} tono={nivel(v.fc > 150, v.fc > 110)} nota="Latidos por minuto" />
        <Dato etiqueta="Respiración" valor={`${Math.round(v.fr)} rpm`} tono={nivel(v.fr > 34, v.fr > 24)} nota="Respiraciones por minuto" />
        <Dato etiqueta="O₂ en sangre" valor={`${Math.round(v.spo2)}%`} tono={nivel(v.spo2 < 88, v.spo2 < 94)} nota={`Respiras ${aire}`} />
      </div>
      <div className="medidores">
        <Dato etiqueta="Salud" valor={Math.round(v.salud)} tono={nivel(v.salud < 40, v.salud < 70)} barra={{ valor: v.salud }} />
        <Dato etiqueta="Hidratación" valor={`${Math.round(v.hidratacion)}%`} tono={nivel(v.hidratacion < 60, v.hidratacion < 85)} barra={{ valor: v.hidratacion }} />
        <Dato etiqueta="Energía" valor={`${Math.round(v.reservas)}%`} tono={nivel(v.reservas < 50, v.reservas < 80)} barra={{ valor: v.reservas }} nota="Reservas del cuerpo según lo que comes y gastas" />
        <Dato etiqueta="Fatiga" valor={`${Math.round(v.fatiga)}%`} tono={nivel(v.fatiga > 85, v.fatiga > 60)} barra={{ valor: v.fatiga }} />
        <Dato etiqueta="Músculo y hueso" valor={`${Math.round(v.condicion)}%`} tono={nivel(v.condicion < 70, v.condicion < 88)} barra={{ valor: v.condicion }} nota="Se pierde sin gravedad y sin ejercicio" />
        <Dato
          etiqueta="Radiación"
          valor={`${v.dosis.toFixed(v.dosis < 10 ? 2 : 0)} mSv`}
          tono={nivel(v.dosis > C.LIMITE_CARRERA_MSV, v.dosis > 450)}
          barra={{ valor: v.dosis, max: C.LIMITE_CARRERA_MSV }}
          nota={`Ahora: ${v.dosisTasa} mSv por día. Límite de carrera de NASA: ${C.LIMITE_CARRERA_MSV} mSv`}
        />
      </div>
      <div className="traje">
        <span className="mini muted">{fuera ? 'Traje en uso' : 'Traje (cargando en la esclusa)'}</span>
        <div className="row" style={{ gap: 8 }}>
          <div className="grow">
            <div className="mini">Oxígeno {o2}%</div>
            <Barra valor={o2} tono={nivel(o2 < 20, o2 < 40)} />
          </div>
          <div className="grow">
            <div className="mini">Batería {Math.round(yo.trajeBateria * 100)}%</div>
            <Barra valor={yo.trajeBateria * 100} tono={nivel(yo.trajeBateria < 0.2, yo.trajeBateria < 0.4)} />
          </div>
        </div>
      </div>
      {yo.dolencia && <div className="help">Tienes {yo.dolencia}. Ve con el médico.</div>}
      {yo.muestras > 0 && <div className="help ok">Llevas {yo.muestras} muestra(s). Analízalas en el laboratorio.</div>}
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
      <h3>Integrantes</h3>
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
              <span className="mini muted">{j.incapacitado > 0 ? 'fuera de servicio' : j.enRefugio ? 'refugio' : j.zona === 'exterior' ? 'fuera' : !j.conectado ? 'ausente' : j.manual === 'sueno' ? 'duerme' : ''}</span>
            </div>
            <div className="tres">
              <div>
                <span>Oxígeno</span>
                <b className={nivel(v.spo2 < 88, v.spo2 < 94)}>{Math.round(v.spo2)}%</b>
              </div>
              <div>
                <span>Salud</span>
                <b className={nivel(v.salud < 40, v.salud < 70)}>{Math.round(v.salud)}</b>
              </div>
              <div>
                <span>Pulso</span>
                <b className={nivel(v.fc > 150, v.fc > 110)}>{Math.round(v.fc)}</b>
              </div>
            </div>
            <Barra valor={v.salud} tono={nivel(v.salud < 40, v.salud < 70)} />
            <div className="mini muted progreso">
              {ACTIVIDAD[j.actividad]} · {j.aportes ?? 0} {(j.aportes ?? 0) === 1 ? 'tarea hecha' : 'tareas hechas'}
            </div>
            {j.ayuda && (
              <div className="help">
                <strong>Pide ayuda a {ROLE_BY_ID[j.ayuda.paraRol].nombre}:</strong> {j.ayuda.motivo}
                {puedoIr && (
                  <button className="small ok" style={{ marginTop: 5, display: 'block' }} onClick={() => api.irAyudar(j.id)}>
                    Ir a ayudar
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
            <input placeholder="¿Qué necesitas?" value={motivo} maxLength={120} onChange={(e) => setMotivo(e.target.value)} />
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
                Enviar
              </button>
              <button className="small" onClick={() => setPidiendo(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button className="small" onClick={() => setPidiendo(true)}>Pedir ayuda a un compañero</button>
        )
      )}
      {yo?.ayuda && <div className="help">Pediste ayuda a {ROLE_BY_ID[yo.ayuda.paraRol].nombre}. Esperando.</div>}
    </div>
  )
}

export function PuntosCriticos({ sala }: { sala: RoomState }) {
  return (
    <div className="panel criticos">
      <h3>Puntos críticos</h3>
      <div className="critical">
        {sala.puntosCriticos.length === 0 ? <span className="ok">Sin alertas. Todo dentro de lo normal.</span> : sala.puntosCriticos.map((p, i) => <span key={i} className="tag">{p}</span>)}
      </div>
    </div>
  )
}

export function Registro({ sala }: { sala: RoomState }) {
  const ultimos = sala.registro.slice(-7).reverse()
  return (
    <div className="panel registro">
      <h3>Registro de misión</h3>
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
  const cuenta = sala.t < 0
  return (
    <div className="telemetria">
      <div className="etapa">{cuenta ? `Despegue en ${Math.ceil(-sala.t)}` : v.etapa}</div>
      <div className="fila">
        <div><span>Altitud</span><b>{v.altitud} km</b></div>
        <div><span>Velocidad</span><b>{sala.fase === 'lanzamiento' ? `${v.velocidad} km/s` : `${Math.round(v.velocidad * 3600).toLocaleString('es')} km/h`}</b></div>
        <div><span>Aceleración</span><b className={nivel(v.g > 4, v.g > 2.5)}>{v.g} g</b></div>
        <div><span>Tu pulso</span><b className={nivel(yo.vit.fc > 150, yo.vit.fc > 110)}>{Math.round(yo.vit.fc)} lpm</b></div>
      </div>
      <div className="fila gasto">
        <div><span>Combustible</span><b className={nivel(false, sala.rec.propelente < 25)}>{Math.round(sala.rec.propelente)}%</b></div>
        <div><span>Energía usada</span><b>{energiaUsada(sala)}</b></div>
        <div><span>{sala.fase === 'lanzamiento' ? 'Tiempo de vuelo' : 'En el espacio'}</span><b>{sala.fase === 'lanzamiento' ? (cuenta ? 'en tierra' : `${Math.floor(sala.t / 60)} min ${Math.floor(sala.t % 60)} s`) : tiempoEnEspacio(sala)}</b></div>
      </div>
      <div className="muted mini">
        {sala.fase === 'lanzamiento'
          ? 'La aceleración te aplasta contra el asiento y el corazón late más rápido para seguir llevando sangre a la cabeza.'
          : 'Es el descenso real de Perseverance. La cápsula entra a 19 200 km/h y en siete minutos se posa a menos de 3 km/h. La Tierra no puede ayudar: la señal tarda demasiado.'}
      </div>
    </div>
  )
}

export const horaLocal = (sala: RoomState) => formatoHora(sala.ambiente.hora)
