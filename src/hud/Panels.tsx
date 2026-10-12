import { useState } from 'react'
import { ROLES, ROLE_BY_ID, MODULE_BY_ID, type RoomState } from '@shared/types'
import { useStore, useYo } from '../store'
import { api } from '../socket'

const FASES: Record<RoomState['fase'], string> = {
  lobby: 'Lobby',
  contexto: 'Contextualización',
  lanzamiento: 'Lanzamiento',
  ensamblaje: 'Ensamblaje de la base',
  base: 'Gestión de la base',
  fin: 'Misión terminada',
}

const nivel = (v: number, max: number) => (v / max < 0.15 ? 'bad' : v / max < 0.35 ? 'warn' : 'ok')

export function TopBar({ sala }: { sala: RoomState }) {
  const r = sala.recursos
  const enBase = sala.fase === 'base' || sala.fase === 'fin' || sala.fase === 'ensamblaje'
  return (
    <div className="panel topbar">
      <div>
        <div className="brand">{FASES[sala.fase]}</div>
        <div className="mono" style={{ fontSize: 12 }}>
          Sala {sala.codigo} · {sala.modoDecision === 'comandante' ? 'aprueba CMD' : 'votación'}
        </div>
      </div>
      {sala.fase === 'lanzamiento' && (
        <div className="res">
          <b>Tránsito</b> día {sala.mision.diasTransito}/210 · <b>Combustible</b> {sala.mision.combustible}%
        </div>
      )}
      {enBase && (
        <>
          <div className="res"><b>Sol</b> {sala.mision.sol}/{sala.mision.solesObjetivo} · <b>Hora</b> {String(sala.mision.hora).padStart(2, '0')}:00</div>
          <div className="res"><b>Agua</b> <span style={{ color: `var(--${nivel(r.agua, 400)})` }}>{Math.round(r.agua)} L</span></div>
          <div className="res"><b>O₂</b> <span style={{ color: `var(--${nivel(r.oxigeno, 400)})` }}>{Math.round(r.oxigeno)}</span></div>
          <div className="res"><b>Alimentos</b> <span style={{ color: `var(--${nivel(r.alimentos, 400)})` }}>{Math.round(r.alimentos)}</span></div>
          <div className="res"><b>Energía</b> <span style={{ color: `var(--${nivel(r.energia, sala.capacidad.energia)})` }}>{Math.round(r.energia)}/{sala.capacidad.energia}</span></div>
          <div className="res"><b>Repuestos</b> {r.repuestos} · <b>Botiquines</b> {r.botiquines}</div>
          <div className="res"><b>Radiación</b> <span style={{ color: sala.radiacion > 0.8 ? 'var(--bad)' : sala.radiacion > 0.5 ? 'var(--warn)' : 'var(--ok)' }}>{sala.radiacion.toFixed(2)}</span></div>
          <div className="res"><b>Experimentos</b> {sala.mision.experimentos}/{sala.mision.experimentosObjetivo}</div>
        </>
      )}
      <div className="grow" />
      <button className="small" onClick={() => api.salir()}>Salir</button>
    </div>
  )
}

export function CrewPanel({ sala }: { sala: RoomState }) {
  const yo = useYo()
  const [paraRol, setParaRol] = useState<string>('medico')
  const [motivo, setMotivo] = useState('')
  const jugadores = sala.jugadores.filter((j) => j.rol)
  const puedoAyudar = (j: (typeof jugadores)[number]) => j.ayuda && yo && j.id !== yo.id && (yo.rol === j.ayuda.paraRol || yo.rol === 'comandante')

  return (
    <div className="panel stack">
      <h3>Integrantes</h3>
      <div className="crew">
        {jugadores.map((j) => {
          const rol = ROLE_BY_ID[j.rol!]
          return (
            <div key={j.id} className={`crew-card ${j.id === yo?.id ? 'me' : ''} ${j.conectado ? '' : 'offline'}`}>
              <div className="row" style={{ gap: 6 }}>
                <span className="tag" style={{ color: rol.color }}>{rol.corto}</span>
                <strong className="grow">{j.nombre}</strong>
                <span className="muted" style={{ fontSize: 11 }}>{MODULE_BY_ID[j.ubicacion].nombre}</span>
              </div>
              <div className="stats">
                <div>
                  <span>Oxígeno</span>
                  <div className="bar" style={{ marginBottom: 2 }}><i style={{ width: `${j.oxigeno}%`, background: j.oxigeno < 30 ? 'var(--bad)' : 'var(--accent)' }} /></div>
                  {j.oxigeno}%
                </div>
                <div>
                  <span>Salud</span>
                  <div className="bar" style={{ marginBottom: 2 }}><i style={{ width: `${j.salud}%`, background: j.salud < 40 ? 'var(--bad)' : j.salud < 70 ? 'var(--warn)' : 'var(--ok)' }} /></div>
                  {Math.round(j.salud)}
                </div>
                <div>
                  <span>Pulso</span>
                  <div style={{ fontSize: 14, color: j.pulso > 100 ? 'var(--bad)' : 'inherit' }}>{j.pulso} bpm</div>
                </div>
              </div>
              {j.fueraDeServicio > 0 && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Fuera de servicio {j.fueraDeServicio} h</div>}
              {j.ayuda && (
                <div className="help">
                  <div>
                    <strong>Necesita a {ROLE_BY_ID[j.ayuda.paraRol].nombre}:</strong> {j.ayuda.motivo}
                  </div>
                  {puedoAyudar(j) && (
                    <button className="small ok" style={{ marginTop: 6 }} onClick={() => api.irAyudar(j.id)}>
                      Ir a ayudar
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {yo && !yo.ayuda && (sala.fase === 'base' || sala.fase === 'ensamblaje') && (
        <div className="action" style={{ marginBottom: 0 }}>
          <strong>Pedir ayuda</strong>
          <div className="row" style={{ gap: 6 }}>
            <select value={paraRol} onChange={(e) => setParaRol(e.target.value)}>
              {ROLES.filter((r) => r.id !== yo.rol).map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <input placeholder="¿Qué necesitas?" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ padding: '5px 8px', fontSize: 12 }} />
            <button
              className="small"
              disabled={!motivo.trim()}
              onClick={() => {
                api.pedirAyuda(paraRol, motivo)
                setMotivo('')
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
      {yo?.ayuda && <div className="help">Pediste ayuda a {ROLE_BY_ID[yo.ayuda.paraRol].nombre}. Esperando…</div>}
    </div>
  )
}

export function CriticalPanel({ sala }: { sala: RoomState }) {
  return (
    <div className="panel">
      <h3>Puntos críticos</h3>
      <div className="critical">
        {sala.puntosCriticos.length === 0 ? <span className="none">Sin alertas. Todo dentro de lo normal.</span> : sala.puntosCriticos.map((p, i) => <span key={i} className="tag">{p}</span>)}
      </div>
    </div>
  )
}

export function LogPanel({ sala }: { sala: RoomState }) {
  const ultimos = sala.registro.slice(-8).reverse()
  return (
    <div className="panel">
      <h3>Registro de misión</h3>
      <div className="log">
        {ultimos.map((l, i) => (
          <div key={i} className={l.tipo}>
            <span className="muted">{new Date(l.t).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span> {l.texto}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ModuleCard({ sala }: { sala: RoomState }) {
  const sel = useStore((s) => s.moduloSeleccionado)
  const seleccionar = useStore((s) => s.seleccionarModulo)
  const yo = useYo()
  if (!sel) return null
  const sys = sala.sistemas.find((s) => s.id === sel)!
  const info = MODULE_BY_ID[sel]
  return (
    <div className="panel" style={{ position: 'absolute', left: '50%', bottom: 150, transform: 'translateX(-50%)', width: 340, pointerEvents: 'auto' }}>
      <div className="row">
        <strong className="grow">{info.nombre}</strong>
        <span className="tag" style={{ color: sys.online ? 'var(--ok)' : 'var(--bad)' }}>{sys.online ? 'en línea' : 'apagado'}</span>
        <button className="small" onClick={() => seleccionar(null)}>×</button>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>{info.descripcion}</p>
      <div className="row" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 11 }}>Integridad</span>
        <div className={`bar grow ${sys.integridad < 30 ? 'bad' : sys.integridad < 60 ? 'warn' : 'ok'}`}><i style={{ width: `${sys.integridad}%` }} /></div>
        <span className="mono" style={{ fontSize: 12 }}>{Math.round(sys.integridad)}%</span>
      </div>
      {sel === 'invernadero' && (
        <p style={{ fontSize: 12, marginTop: 6 }}>
          Huerto: {sala.huerto.establecido ? 'establecido y produciendo' : `${sala.huerto.progreso}% construido`}
        </p>
      )}
      {sala.fase === 'base' && yo?.rol === 'sistemas' && (
        <button className="small" style={{ marginTop: 8 }} disabled={sala.recursos.repuestos < 2} onClick={() => api.accion('reparar', { modulo: sel })}>
          Reparar (2 repuestos)
        </button>
      )}
    </div>
  )
}
