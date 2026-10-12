import { useState } from 'react'
import { ACTIONS, ASSEMBLY_STEPS, MASA_MAXIMA, MODULES, ROLE_BY_ID, SITES, SUPPLIES, type RacionLevel, type RoomState, type SupplyId } from '@shared/types'
import { useYo } from '../store'
import { api } from '../red'

export function ContextoPanel({ sala }: { sala: RoomState }) {
  const yo = useYo()
  const [ultimo, setUltimo] = useState<SupplyId>('agua')
  const item = SUPPLIES.find((s) => s.id === ultimo)!
  const exceso = sala.masa > MASA_MAXIMA
  const rol = yo?.rol ? ROLE_BY_ID[yo.rol] : null
  return (
    <div className="stack">
      <div className="assistant">
        <strong>Situación:</strong> {sala.mision.objetivo}
      </div>
      {rol && (
        <div className="action">
          <div className="row" style={{ gap: 6 }}>
            <span className="tag" style={{ color: rol.color }}>{rol.corto}</span>
            <strong style={{ margin: 0 }}>Tu rol: {rol.nombre}</strong>
          </div>
          <p>{rol.descripcion}</p>
          <p style={{ color: 'var(--warn)' }}>Consecuencia: {rol.consecuencias}</p>
        </div>
      )}
      <h3>Suministros (toda la tripulación puede ajustar)</h3>
      {SUPPLIES.map((s) => (
        <div key={s.id} className="supply">
          <div>
            <div className="row" style={{ gap: 6 }}>
              <strong className="grow">{s.nombre}</strong>
              <small>{s.masa} t c/u</small>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={sala.cargamento[s.id]}
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
      <div className="row" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 11 }}>Masa</span>
        <div className={`bar grow ${exceso ? 'bad' : sala.masa > 34 ? 'warn' : 'ok'}`}><i style={{ width: `${Math.min(100, (sala.masa / MASA_MAXIMA) * 100)}%` }} /></div>
        <span className="mono" style={{ fontSize: 12, color: exceso ? 'var(--bad)' : 'inherit' }}>{sala.masa.toFixed(1)} / {MASA_MAXIMA} t</span>
      </div>
      <div className="assistant">
        <strong>Asistente sobre {item.nombre}:</strong> {item.consecuencia}{' '}
        {exceso ? 'La carga supera el máximo: el cohete no despega.' : `Combustible estimado al llegar: ${Math.max(5, Math.round(100 - sala.masa * 1.6))}%.`}
      </div>
      {yo?.rol === 'comandante' ? (
        <button className="primary" disabled={exceso} onClick={() => api.lanzar()}>
          Autorizar lanzamiento
        </button>
      ) : (
        <p className="muted">El comandante autoriza el lanzamiento cuando el cargamento esté listo.</p>
      )}
    </div>
  )
}

export function LanzamientoPanel({ sala }: { sala: RoomState }) {
  return (
    <div className="stack">
      <div className="assistant">
        <strong>Lanzamiento.</strong> Combustible restante {sala.mision.combustible}%. El viaje a Marte toma unos 210 días; aquí lo verás en segundos.
      </div>
      <div className="mono" style={{ fontSize: 28 }}>Día {sala.mision.diasTransito} <span className="muted" style={{ fontSize: 14 }}>/ 210 en tránsito</span></div>
      <div className="bar"><i style={{ width: `${(sala.mision.diasTransito / 210) * 100}%` }} /></div>
      <p className="muted">Cargamento: {SUPPLIES.map((s) => `${sala.cargamento[s.id]} ${s.nombre.toLowerCase()}`).join(', ')}.</p>
    </div>
  )
}

export function EnsamblajePanel({ sala }: { sala: RoomState }) {
  const yo = useYo()
  const paso = sala.ensamblaje.paso
  const pendienteUbicacion = sala.propuestas.find((p) => p.tipo === 'ubicacion' && p.estado === 'pendiente')
  return (
    <div className="stack">
      <div className="assistant">
        <strong>Misión de ensamblaje.</strong> Cada paso lo confirman los roles responsables. Si un rol no está en la sala, se da por confirmado.
      </div>
      <div className="steps">
        {ASSEMBLY_STEPS.map((s) => {
          const estado = s.id < paso ? 'done' : s.id === paso ? 'active' : ''
          const confirmados = sala.ensamblaje.confirmaciones[s.id] ?? []
          const soyResponsable = yo?.rol && s.roles.includes(yo.rol)
          const yaConfirme = yo && confirmados.includes(yo.id)
          return (
            <div key={s.id} className={`step ${estado}`}>
              <strong>{s.id + 1}. {s.titulo}</strong>
              <div className="who">{s.roles.map((r) => ROLE_BY_ID[r].corto).join(' + ')}</div>
              <p className="muted" style={{ fontSize: 12, margin: '4px 0' }}>{s.descripcion}</p>
              {estado === 'active' && s.id === 0 && (
                <>
                  {soyResponsable && !pendienteUbicacion ? (
                    SITES.map((site) => (
                      <button key={site.id} className="site" onClick={() => api.proponerUbicacion(site.id)}>
                        <strong>{site.nombre}</strong>
                        <small>{site.descripcion}</small>
                      </button>
                    ))
                  ) : pendienteUbicacion ? (
                    <p style={{ fontSize: 12, color: 'var(--warn)' }}>Propuesta pendiente: {pendienteUbicacion.titulo}. Revisa la pestaña Propuestas.</p>
                  ) : (
                    <p className="muted" style={{ fontSize: 12 }}>Esperando que el piloto o el comandante propongan un sitio.</p>
                  )}
                </>
              )}
              {estado === 'active' && s.id > 0 && soyResponsable && (
                <button className="ok small" disabled={Boolean(yaConfirme)} onClick={() => api.confirmarPaso(s.id)}>
                  {yaConfirme ? 'Confirmado' : 'Confirmar mi parte'}
                </button>
              )}
              {estado === 'active' && s.id > 0 && (
                <div className="who" style={{ marginTop: 4 }}>
                  Confirmaron: {confirmados.map((id) => sala.jugadores.find((j) => j.id === id)?.nombre).filter(Boolean).join(', ') || 'nadie aún'}
                </div>
              )}
              {estado === 'done' && s.id === 0 && sala.ensamblaje.sitio && <div className="who">Sitio: {SITES.find((x) => x.id === sala.ensamblaje.sitio)?.nombre}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BasePanel({ sala }: { sala: RoomState }) {
  const yo = useYo()
  const [racion, setRacion] = useState<RacionLevel>('ahorro')
  const [modulo, setModulo] = useState<string>('soporteVital')
  const [prioridad, setPrioridad] = useState<string>(sala.prioridadEnergia)
  const [paciente, setPaciente] = useState<string>('')
  if (!yo?.rol) return <p className="muted">Sin rol asignado.</p>
  const rol = ROLE_BY_ID[yo.rol]
  const mias = ACTIONS.filter((a) => a.roles.includes(yo.rol!))
  const otras = ACTIONS.filter((a) => !a.roles.includes(yo.rol!))
  const pendiente = (tipo: string) => sala.propuestas.some((p) => p.estado === 'pendiente' && p.tipo === tipo)
  const fuera = yo.fueraDeServicio > 0

  const consejo = (() => {
    const r = sala.recursos
    switch (yo.rol) {
      case 'comandante': {
        const n = sala.propuestas.filter((p) => p.estado === 'pendiente').length
        return n ? `Hay ${n} propuesta(s) esperando tu decisión en la pestaña Propuestas.` : 'Sin propuestas pendientes. Vigila los puntos críticos y coordina a la tripulación.'
      }
      case 'logistica':
        return r.agua < 80 || r.alimentos < 60 ? 'Las reservas bajan. Propón ración de ahorro o activar el reciclaje.' : 'Reservas estables. Revisa cuántas horas quedan de cada recurso con el asistente.'
      case 'medico': {
        const e = sala.jugadores.find((j) => j.rol && j.salud < 40)
        return e ? `${e.nombre} tiene salud crítica. Haz una revisión médica.` : sala.tormenta ? 'Tormenta solar: propón ir al refugio.' : 'Tripulación estable. Vigila el pulso y la salud.'
      }
      case 'sistemas': {
        const peor = [...sala.sistemas].filter((s) => s.online).sort((a, b) => a.integridad - b.integridad)[0]
        const off = sala.sistemas.find((s) => !s.online && ['soporteVital', 'energia'].includes(s.id))
        return off ? `${MODULES.find((m) => m.id === off.id)?.nombre} está apagado. Repáralo ya.` : peor && peor.integridad < 45 ? `${MODULES.find((m) => m.id === peor.id)?.nombre} al ${Math.round(peor.integridad)}%. Repara antes de que falle.` : 'Equipos en buen estado. Revisa la prioridad de energía antes de la noche.'
      }
      case 'cientifico':
        return !sala.huerto.establecido ? `Huerto al ${sala.huerto.progreso}%. Cada turno cuesta 10 L de agua.` : sala.mision.experimentos < sala.mision.experimentosObjetivo ? 'Huerto listo. Ejecuta experimentos cuando haya energía de sobra.' : 'Objetivo científico cumplido. Apoya a la tripulación.'
      case 'piloto':
        return 'Tu parte fuerte ya pasó. Atiende emergencias de paneles y ayuda a quien lo pida.'
    }
  })()

  return (
    <div className="stack">
      <div className="assistant">
        <strong>Asistente para {rol.nombre}:</strong> {consejo}
      </div>
      {fuera && <div className="help">Estás fuera de servicio {yo.fueraDeServicio} h. Pide ayuda al médico.</div>}
      <h3>Tus acciones</h3>
      {mias.map((a) => (
        <div key={a.id} className="action">
          <strong>{a.nombre}</strong>
          <p>{a.descripcion}{a.requierePropuesta ? ` Decide: ${a.roles.map((r) => ROLE_BY_ID[r].corto).join(' + ')}.` : ''}</p>
          <div className="row">
            {a.id === 'racionar' && (
              <select value={racion} onChange={(e) => setRacion(e.target.value as RacionLevel)}>
                <option value="normal">Normal (actual: {sala.racion})</option>
                <option value="ahorro">Ahorro 80%</option>
                <option value="estricto">Estricto 60%</option>
              </select>
            )}
            {(a.id === 'reparar' || a.id === 'prioridad') && (
              <select value={a.id === 'reparar' ? modulo : prioridad} onChange={(e) => (a.id === 'reparar' ? setModulo(e.target.value) : setPrioridad(e.target.value))}>
                {MODULES.map((m) => {
                  const s = sala.sistemas.find((x) => x.id === m.id)!
                  return (
                    <option key={m.id} value={m.id}>
                      {m.nombre} ({s.online ? `${Math.round(s.integridad)}%` : 'OFF'})
                    </option>
                  )
                })}
              </select>
            )}
            {a.id === 'revision' && (
              <select value={paciente} onChange={(e) => setPaciente(e.target.value)}>
                <option value="">Elige tripulante</option>
                {sala.jugadores.filter((j) => j.rol).map((j) => (
                  <option key={j.id} value={j.id}>{j.nombre} (salud {Math.round(j.salud)})</option>
                ))}
              </select>
            )}
            <button
              className="small"
              disabled={
                fuera ||
                (a.requierePropuesta && pendiente(a.id)) ||
                (a.id === 'revision' && !paciente) ||
                (a.id === 'huerto' && sala.huerto.establecido) ||
                (a.id === 'reparar' && sala.recursos.repuestos < 2)
              }
              onClick={() => {
                const payload: Record<string, unknown> =
                  a.id === 'racionar' ? { nivel: racion } : a.id === 'reparar' ? { modulo } : a.id === 'prioridad' ? { modulo: prioridad } : a.id === 'revision' ? { jugadorId: paciente } : {}
                api.accion(a.id, payload)
              }}
            >
              {a.requierePropuesta ? (pendiente(a.id) ? 'Propuesta pendiente' : a.id === 'reciclaje' ? (sala.reciclajeActivo ? 'Proponer desactivar' : 'Proponer activar') : 'Proponer') : 'Ejecutar'}
            </button>
          </div>
        </div>
      ))}
      <h3>Acciones de otros roles</h3>
      <p className="muted" style={{ fontSize: 12 }}>
        {otras.map((a) => `${a.nombre} (${a.roles.map((r) => ROLE_BY_ID[r].corto).join('+')})`).join(' · ')}
      </p>
    </div>
  )
}
