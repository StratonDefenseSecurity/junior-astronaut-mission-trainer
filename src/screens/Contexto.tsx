// Contextualización: a cada integrante se le presenta la situación y su rol, se fija el
// objetivo de la misión y se eligen los suministros. El asistente analiza las consecuencias.
import { useState } from 'react'
import { C } from '@shared/ciencia'
import { PERFILES, ROLE_BY_ID, SUPPLIES, TRAYECTORIAS, type RoomState, type SupplyId } from '@shared/types'
import { Barra, RolTag, nivel } from '../hud/comun'
import { puede } from '../mundo/mapa'
import { api } from '../red'
import { useStore, useYo } from '../store'
import { VistaTraje } from './Lobby'

/** Cuentas del asistente sobre la carga elegida. Usa las mismas cifras que la simulación. */
function analisis(sala: RoomState) {
  const n = Math.max(1, sala.jugadores.filter((j) => j.rol).length)
  const viaje = sala.mision.diasTransito
  const estancia = (sala.mision.solesObjetivo * C.SOL_S) / 86400
  const total = viaje + estancia
  const c = sala.cargamento
  const comida = (c.alimentos * 100) / (n * C.COMIDA_KG_DIA)
  // Con reciclaje al 98%, casi toda el agua que se gasta es la que se convierte en oxígeno.
  const agua = (c.agua * 100) / (n * (3.2 * 0.07 + 0.84 * C.OGA_AGUA_POR_O2))
  const aireTanques = (c.oxigeno * 100) / (n * 0.84)
  const mediaSolar = c.paneles * C.PANEL_KW * 0.637 * 0.5
  const energia = mediaSolar + c.reactor * C.REACTOR_KW
  const noche = c.baterias * C.BATERIA_KWH
  const dosis = viaje * C.GCR_CRUCERO_MSV_DIA + estancia * C.GCR_SUPERFICIE_MSV_DIA
  return { n, viaje, estancia, total, comida, agua, aireTanques, energia, noche, dosis }
}

function Linea({ bien, regular, children }: { bien: boolean; regular?: boolean; children: React.ReactNode }) {
  const tono = nivel(!bien && !regular, !bien && Boolean(regular))
  return (
    <li className={tono}>
      <span className="marca">{bien ? '✓' : regular ? '!' : '✗'}</span> <span>{children}</span>
    </li>
  )
}

export function ContextoScreen() {
  const sala = useStore((s) => s.sala)!
  const setFuentes = useStore((s) => s.setFuentes)
  const yo = useYo()
  const [ultimo, setUltimo] = useState<SupplyId>('agua')
  if (!yo) return null
  const rol = yo.rol ? ROLE_BY_ID[yo.rol] : null
  const a = analisis(sala)
  const exceso = sala.masa > sala.capacidad
  const mando = puede(sala, yo, ['comandante'])
  const navega = puede(sala, yo, ['piloto', 'comandante'])
  const crew = sala.jugadores.filter((j) => j.rol)
  const faltan = crew.filter((j) => j.conectado && j.id !== yo.id && !j.listo)
  const item = SUPPLIES.find((s) => s.id === ultimo)!

  return (
    <div className="center-screen alto">
      <div className="card wide stack contexto">
        <div className="row">
          <div className="grow">
            <div className="brand">Contextualización · sala {sala.codigo}</div>
            <h1>Misión a Marte</h1>
          </div>
          <button className="small" onClick={() => setFuentes(true)}>De dónde salen los datos</button>
          <button className="small" onClick={() => api.salir()}>Salir</button>
        </div>

        <div className="assistant">
          <strong>La situación:</strong> {sala.mision.objetivo} Son {a.n} tripulantes. El viaje dura {a.viaje} días y la señal a la Tierra llega a tardar más de 10 minutos, así que cada decisión urgente será de ustedes. Todo lo que necesiten tiene que caber en la nave: {sala.capacidad.toFixed(1)} toneladas.
        </div>

        <div className="contexto-rejilla">
          <div className="stack">
            {rol && (
              <div className="action">
                <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <VistaTraje traje={yo.traje} distintivo={rol.color} />
                  <div className="grow">
                    <div className="row" style={{ gap: 6 }}>
                      <RolTag rol={yo.rol} />
                      <strong>Tu rol: {rol.nombre}</strong>
                    </div>
                    <p className="mini">{rol.descripcion}</p>
                    <p className="consecuencia">{rol.consecuencias}</p>
                  </div>
                </div>
              </div>
            )}

            <h3>Objetivo de la misión {mando ? '' : '· lo fija el comandante'}</h3>
            <div className="opciones fila">
              {PERFILES.map((p) => (
                <button key={p.id} className={`opcion ${sala.perfil === p.id ? 'activa' : ''}`} disabled={!mando || sala.perfil === p.id} onClick={() => api.perfil(p.id)}>
                  <strong>{p.nombre}</strong>
                  <small>{p.descripcion}</small>
                </button>
              ))}
            </div>

            <h3>Trayectoria {navega ? '' : '· la eligen piloto o comandante'}</h3>
            <div className="opciones fila">
              {TRAYECTORIAS.map((t) => (
                <button key={t.id} className={`opcion ${sala.trayectoria === t.id ? 'activa' : ''}`} disabled={!navega || sala.trayectoria === t.id} onClick={() => api.trayectoria(t.id)}>
                  <strong>{t.nombre}</strong>
                  <small>{t.descripcion}</small>
                </button>
              ))}
            </div>

            <h3>Análisis del asistente</h3>
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
              <Linea bien={a.dosis < 480} regular={a.dosis < C.LIMITE_CARRERA_MSV}>
                Radiación de fondo: unos {Math.round(a.dosis)} mSv por persona. El límite de carrera de NASA es {C.LIMITE_CARRERA_MSV}, y las tormentas solares suman más.
              </Linea>
              <Linea bien={sala.cargamento.repuestos >= 14} regular={sala.cargamento.repuestos >= 8}>
                {sala.cargamento.repuestos} kits de repuestos para {Math.round(a.total)} días de desgaste y averías.
              </Linea>
            </ul>
          </div>

          <div className="stack">
            <h3>Suministros · tres alternativas</h3>
            <div className="row" style={{ gap: 6 }}>
              <button className="grow" onClick={() => api.preset('minimo')}>Lo mínimo</button>
              <button className="grow" onClick={() => api.preset('equilibrado')}>Equilibrada</button>
              <button className="grow" onClick={() => api.preset('seguro')}>Máxima seguridad</button>
            </div>
            <p className="mini muted">Lo mínimo va sin margen. La equilibrada lleva un 15% de más y algo de protección. La de máxima seguridad lleva un 30% de más y puede que no quepa.</p>
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
                      min={s.min}
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
            <div className="row" style={{ gap: 6 }}>
              <span className="mini muted">Carga</span>
              <div className="grow"><Barra valor={sala.masa} max={sala.capacidad} tono={nivel(exceso, sala.masa > sala.capacidad * 0.93)} /></div>
              <span className={`mono mini ${exceso ? 'bad' : ''}`}>{sala.masa.toFixed(1)} / {sala.capacidad.toFixed(1)} t</span>
            </div>
            <div className="assistant">
              <strong>{item.nombre}:</strong> {item.consecuencia}
              {exceso ? ' La carga supera lo que admite la nave: hay que dejar algo.' : ''}
            </div>

            <h3>Listos para despegar</h3>
            <div className="listos">
              {crew.map((j) => (
                <span key={j.id} className={`tag ${j.listo || (j.rol === 'comandante' && mando && j.id === yo.id) ? 'ok' : j.conectado ? 'warn' : ''}`}>
                  {ROLE_BY_ID[j.rol!].corto} {j.nombre} {j.listo ? '✓' : j.conectado ? '…' : '(ausente)'}
                </span>
              ))}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className={yo.listo ? 'ok grow' : 'grow'} onClick={() => api.listo(!yo.listo)}>{yo.listo ? 'Listo ✓ (pulsa para cambiar)' : 'Estoy listo'}</button>
              {mando && (
                <button className="primary grow" disabled={exceso || faltan.length > 0} onClick={() => api.lanzar()}>
                  Autorizar lanzamiento
                </button>
              )}
            </div>
            {mando && faltan.length > 0 && <p className="mini muted">Faltan por confirmar: {faltan.map((j) => j.nombre).join(', ')}.</p>}
            {!mando && <p className="mini muted">El comandante autoriza el lanzamiento cuando todos estén listos.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
