// Procedimientos por pasos en la estación: cómo se hace en la vida real, la lista de pasos con
// quién hizo cada uno y la interacción del paso que toca. Cada tipo de paso se hace de verdad:
// mantener pulsado, tocar en orden, ajustar un valor, elegir o leer un instrumento.
import { useEffect, useRef, useState } from 'react'
import {
  activos,
  evaluarPaso,
  prefijoValido,
  procDeTarea,
  textoDe,
  type Lectura,
  type Paso,
  type PasoAjustar,
  type PasoComprobar,
  type PasoElegir,
  type PasoMantener,
  type PasoSecuencia,
  type Procedimiento,
} from '@shared/procedimientos'
import { ROLE_BY_ID, TAREAS_ENSAMBLAJE, type Player, type RoomState } from '@shared/types'
import { puede } from '../mundo/mapa'
import { api } from '../red'
import { Barra } from './comun'

interface Aviso { tipo: 'ok' | 'warn' | 'bad'; texto: string }
type Enviar = (valor: unknown) => Promise<void>

const nombreDe = (sala: RoomState, id: string) => sala.jugadores.find((j) => j.id === id)?.nombre ?? (id ? 'alguien' : 'no hacía falta')

// ---------- Mantener pulsado ----------

function Mantener({ paso, enviar, activo }: { paso: PasoMantener; enviar: Enviar; activo: boolean }) {
  const [progreso, setProgreso] = useState(0)
  const inicio = useRef<number | null>(null)
  const marco = useRef(0)
  const enviado = useRef(false)

  const soltar = () => {
    if (inicio.current === null) return
    inicio.current = null
    window.clearInterval(marco.current)
    if (!enviado.current) setProgreso(0)
  }
  const apretar = () => {
    if (!activo || inicio.current !== null || enviado.current) return
    inicio.current = performance.now()
    const tic = () => {
      if (inicio.current === null) return
      const s = (performance.now() - inicio.current) / 1000
      setProgreso(Math.min(1, s / paso.segundos))
      if (s >= paso.segundos) {
        inicio.current = null
        window.clearInterval(marco.current)
        enviado.current = true
        void enviar(s).finally(() => {
          enviado.current = false
          setProgreso(0)
        })
      }
    }
    // Con un intervalo y no por fotogramas: el tiempo cuenta aunque la escena 3D vaya lenta.
    marco.current = window.setInterval(tic, 50)
  }

  // La barra espaciadora también sirve, mientras este paso está en pantalla.
  useEffect(() => {
    const abajo = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      e.preventDefault()
      apretar()
    }
    const arriba = (e: KeyboardEvent) => e.code === 'Space' && soltar()
    window.addEventListener('keydown', abajo)
    window.addEventListener('keyup', arriba)
    window.addEventListener('blur', soltar)
    return () => {
      window.removeEventListener('keydown', abajo)
      window.removeEventListener('keyup', arriba)
      window.removeEventListener('blur', soltar)
      window.clearInterval(marco.current)
    }
  }, [activo, paso.id])

  return (
    <div className="proc-mantener">
      <button
        className="primary"
        disabled={!activo}
        style={{ touchAction: 'none', userSelect: 'none' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          apretar()
        }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onLostPointerCapture={soltar}
        onContextMenu={(e) => e.preventDefault()}
      >
        {paso.boton}
      </button>
      <div className="grow">
        <Barra valor={progreso * 100} tono="azul" />
        <span className="mini muted">{progreso > 0 && progreso < 1 ? `${Math.ceil(paso.segundos * (1 - progreso))} s` : `${paso.segundos} s · también con la barra espaciadora`}</span>
      </div>
    </div>
  )
}

// ---------- Tocar en orden ----------

function Secuencia({ paso, enviar, activo, avisar }: { paso: PasoSecuencia; enviar: Enviar; activo: boolean; avisar: (a: Aviso) => void }) {
  const [orden, setOrden] = useState<string[]>([])
  const [errores, setErrores] = useState(0)
  useEffect(() => {
    setOrden([])
    setErrores(0)
  }, [paso.id])
  const tocar = (id: string) => {
    const nuevo = [...orden, id]
    if (!prefijoValido(paso, nuevo)) {
      setErrores((e) => e + 1)
      avisar({ tipo: 'bad', texto: `No en ese orden. ${paso.error}` })
      return
    }
    setOrden(nuevo)
    if (nuevo.length === paso.elementos.length) {
      void enviar({ orden: nuevo, errores }).then(() => setOrden([]))
    } else avisar({ tipo: 'ok', texto: 'Bien. Sigue.' })
  }
  return (
    <div className="proc-secuencia">
      {paso.elementos.map((el) => {
        const n = orden.indexOf(el.id)
        return (
          <button key={el.id} className={`opcion ${n >= 0 ? 'activa' : ''}`} disabled={!activo || n >= 0} onClick={() => tocar(el.id)}>
            <strong>{n >= 0 ? `${n + 1}. ` : ''}{el.nombre}</strong>
          </button>
        )
      })}
      {orden.length > 0 && (
        <button className="small plano" onClick={() => setOrden([])}>Empezar de nuevo</button>
      )}
    </div>
  )
}

// ---------- Ajustar un valor ----------

function Ajustar({ paso, enviar, activo }: { paso: PasoAjustar; enviar: Enviar; activo: boolean }) {
  const [v, setV] = useState(paso.inicial)
  useEffect(() => setV(paso.inicial), [paso.id, paso.inicial])
  const decimales = paso.paso < 1 ? 1 : 0
  return (
    <div className="proc-ajustar">
      <div className="row" style={{ gap: 8 }}>
        <input
          className="grow"
          type="range"
          min={paso.min}
          max={paso.max}
          step={paso.paso}
          value={v}
          disabled={!activo}
          onChange={(e) => setV(Number(e.target.value))}
        />
        <b className="mono">{v.toFixed(decimales)} {paso.unidad}</b>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <button className="small" disabled={!activo || v <= paso.min} onClick={() => setV((x) => Math.max(paso.min, +(x - paso.paso).toFixed(2)))}>Menos</button>
        <button className="small" disabled={!activo || v >= paso.max} onClick={() => setV((x) => Math.min(paso.max, +(x + paso.paso).toFixed(2)))}>Más</button>
        <span className="grow" />
        <button className="primary small" disabled={!activo} onClick={() => void enviar(v)}>Confirmar</button>
      </div>
    </div>
  )
}

// ---------- Elegir ----------

function Elegir({ sala, paso, enviar, activo }: { sala: RoomState; paso: PasoElegir; enviar: Enviar; activo: boolean }) {
  return (
    <div className="opciones">
      {paso.opciones(sala).map((o) => (
        <button key={o.id} className="opcion" disabled={!activo} onClick={() => void enviar(o.id)}>
          <strong>{o.texto}</strong>
        </button>
      ))}
    </div>
  )
}

// ---------- Leer un instrumento ----------

function Grafica({ l, visibles }: { l: Lectura; visibles: number }) {
  const W = 280
  const H = 130
  const m = { i: 34, d: 8, a: 8, b: 22 }
  const ys = l.puntos.map((p) => p.y).concat(l.limite)
  const yMin = l.forma === 'barras' ? 0 : Math.floor(Math.min(...ys) - 1)
  const yMax = l.forma === 'barras' ? Math.max(...ys) * 1.2 : Math.ceil(Math.max(...ys) + 1)
  const y = (v: number) => m.a + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - m.a - m.b)
  const n = l.puntos.length
  const x = (i: number) => m.i + (i / Math.max(1, n - 1)) * (W - m.i - m.d)
  const anchoBarra = (W - m.i - m.d) / n
  const puntos = l.puntos.slice(0, visibles)
  return (
    <svg className="proc-grafica" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={l.titulo}>
      <line x1={m.i} y1={y(l.limite)} x2={W - m.d} y2={y(l.limite)} stroke="var(--warn)" strokeDasharray="4 3" />
      <text x={m.i - 4} y={y(yMax) + 4} textAnchor="end" className="eje">{yMax.toFixed(0)}</text>
      <text x={m.i - 4} y={y(yMin)} textAnchor="end" className="eje">{yMin.toFixed(0)}</text>
      <text x={m.i - 4} y={y(l.limite) + 3} textAnchor="end" className="eje" fill="var(--warn)">{l.limite}</text>
      <line x1={m.i} y1={H - m.b} x2={W - m.d} y2={H - m.b} stroke="var(--border)" />
      {l.forma === 'linea' ? (
        <polyline fill="none" stroke="var(--accent)" strokeWidth={2} points={puntos.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')} />
      ) : (
        puntos.map((p, i) => (
          <g key={i}>
            <rect x={m.i + i * anchoBarra + 4} y={y(p.y)} width={anchoBarra - 8} height={H - m.b - y(p.y)} fill={p.y > l.limite ? 'var(--bad)' : 'var(--accent)'} opacity={0.85} />
            <text x={m.i + i * anchoBarra + anchoBarra / 2} y={H - 8} textAnchor="middle" className="eje">{String(p.x)}</text>
          </g>
        ))
      )}
      {l.forma === 'linea' && (
        <>
          <text x={m.i} y={H - 6} className="eje">0</text>
          <text x={W - m.d} y={H - 6} textAnchor="end" className="eje">{String(l.puntos[n - 1].x)} {l.eje}</text>
        </>
      )}
    </svg>
  )
}

function Comprobar({ sala, paso, enviar, activo }: { sala: RoomState; paso: PasoComprobar; enviar: Enviar; activo: boolean }) {
  const l = paso.lectura(sala)
  const [visibles, setVisibles] = useState(1)
  // La lectura va apareciendo, como en un instrumento que registra en el tiempo.
  useEffect(() => {
    setVisibles(1)
    const id = window.setInterval(() => setVisibles((v) => (v >= l.puntos.length ? v : v + 1)), l.forma === 'linea' ? 160 : 350)
    return () => window.clearInterval(id)
  }, [paso.id, l.puntos.length, l.forma])
  const completa = visibles >= l.puntos.length
  return (
    <div className="proc-comprobar">
      <div className="mini muted">{l.titulo} · {l.unidad} · {l.limiteTexto}</div>
      <Grafica l={l} visibles={visibles} />
      <p className="mini">{l.pregunta}</p>
      <div className="row" style={{ gap: 6 }}>
        <button className="ok" disabled={!activo || !completa} onClick={() => void enviar('pasa')}>Pasa</button>
        <button className="danger" disabled={!activo || !completa} onClick={() => void enviar('falla')}>Falla</button>
        {!completa && <span className="mini muted">Registrando…</span>}
      </div>
    </div>
  )
}

// ---------- Un procedimiento ----------

function Interaccion(props: { sala: RoomState; paso: Paso; enviar: Enviar; activo: boolean; avisar: (a: Aviso) => void }) {
  const { paso } = props
  switch (paso.tipo) {
    case 'mantener':
      return <Mantener paso={paso} enviar={props.enviar} activo={props.activo} />
    case 'secuencia':
      return <Secuencia paso={paso} enviar={props.enviar} activo={props.activo} avisar={props.avisar} />
    case 'ajustar':
      return <Ajustar paso={paso} enviar={props.enviar} activo={props.activo} />
    case 'elegir':
      return <Elegir sala={props.sala} paso={paso} enviar={props.enviar} activo={props.activo} />
    case 'comprobar':
      return <Comprobar sala={props.sala} paso={paso} enviar={props.enviar} activo={props.activo} />
  }
}

const TIPO: Record<Paso['tipo'], string> = {
  mantener: 'Mantener pulsado',
  secuencia: 'Tocar en orden',
  ajustar: 'Ajustar',
  elegir: 'Elegir',
  comprobar: 'Leer el instrumento',
}

function Tarjeta({ sala, yo, proc, paso, remoto, alTerminar }: { sala: RoomState; yo: Player; proc: Procedimiento; paso: number; remoto: boolean; alTerminar: (a: Aviso) => void }) {
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const e = sala.procedimientos?.[proc.id]
  const def = proc.pasos[paso]
  const tarea = proc.tarea ? TAREAS_ENSAMBLAJE.find((t) => t.id === proc.tarea) : null
  const mio = puede(sala, yo, def.roles)
  const impedido = yo.incapacitado > 0 ? 'Estás fuera de servicio.' : yo.enRefugio ? 'Estás en el refugio.' : null
  const motivo = remoto ? 'Hay que ir hasta la estación para hacerlo.' : impedido ? impedido : yo.zona !== def.zona ? (def.zona === 'exterior' ? 'Este paso se hace fuera, con el traje.' : 'Este paso se hace dentro del hábitat.') : null
  const activo = mio && !motivo && !ocupado

  const enviar: Enviar = async (valor) => {
    // La misma regla que el servidor, para responder al instante.
    const ev = evaluarPaso(sala, proc, paso, valor)
    if (!ev.ok) {
      setAviso({ tipo: 'bad', texto: ev.mensaje })
      return
    }
    setOcupado(true)
    const r = await api.procedimiento(proc.id, paso, valor)
    setOcupado(false)
    if (!r) setAviso({ tipo: 'bad', texto: 'Sin conexión con el servidor.' })
    else if (r.error) setAviso({ tipo: 'bad', texto: r.error })
    else {
      const a: Aviso = { tipo: ev.calidad >= 0.8 ? 'ok' : ev.calidad >= 0.5 ? 'warn' : 'bad', texto: ev.mensaje }
      setAviso(a)
      if (paso === proc.pasos.length - 1) alTerminar({ ...a, texto: `${proc.titulo}: listo. ${ev.mensaje}` })
    }
  }

  return (
    <div className="tarea proc">
      <strong>{tarea ? `Montaje de la base · paso ${tarea.paso}` : proc.recurrente ? 'Cuidado del huerto' : 'Procedimiento'}</strong>
      <p>{proc.titulo}</p>
      <details className="proc-real">
        <summary>Cómo se hace en la vida real</summary>
        <p className="mini">{proc.intro}</p>
      </details>
      <ol className="proc-pasos">
        {proc.pasos.map((p, i) => {
          const hecho = i < paso
          const quien = e?.por[i]
          const q = e?.calidad[i]
          return (
            <li key={p.id} className={hecho ? 'listo' : i === paso ? 'actual' : ''}>
              <span>{hecho ? '✓' : i === paso ? '●' : '○'} {p.titulo}</span>
              {hecho && quien !== undefined && (
                <span className="mini muted"> · {nombreDe(sala, quien)}{quien && q !== undefined ? ` · ${Math.round(q * 100)}%` : ''}</span>
              )}
            </li>
          )
        })}
      </ol>
      <div className="proc-actual">
        <div className="row" style={{ gap: 6 }}>
          <b className="grow">{def.titulo}</b>
          <span className="tag">{TIPO[def.tipo]}</span>
        </div>
        <p className="mini">{textoDe(sala, def.instruccion)}</p>
        <p className="mini muted">Por qué así: {def.porque}</p>
        {mio ? (
          <>
            <Interaccion key={`${proc.id}:${paso}`} sala={sala} paso={def} enviar={enviar} activo={activo} avisar={setAviso} />
            {motivo && <span className="mini warn">{motivo}</span>}
          </>
        ) : (
          <span className="mini muted">Lo hace: {def.roles.map((r) => ROLE_BY_ID[r].nombre).join(' o ')}</span>
        )}
        {aviso && <p className={`mini ${aviso.tipo}`}>{aviso.texto}</p>}
      </div>
    </div>
  )
}

/** Los procedimientos que tocan en esta estación, y las tareas de montaje ya hechas aquí. */
export function Procedimientos({ sala, yo, estacion, remoto }: { sala: RoomState; yo: Player; estacion: string; remoto: boolean }) {
  const [ultimo, setUltimo] = useState<Aviso | null>(null)
  const aqui = activos(sala).filter((a) => a.proc.pasos[a.paso].estacion === estacion)
  const hechas = sala.fase === 'ensamblaje' ? TAREAS_ENSAMBLAJE.filter((t) => t.estacion === estacion && sala.ensamblaje.hechas[t.id]) : []
  return (
    <>
      {hechas.map((t) => {
        const e = sala.procedimientos?.[procDeTarea(t.id)?.id ?? '']
        const media = e?.calidad.length ? e.calidad.reduce((a, b) => a + b, 0) / e.calidad.length : null
        return (
          <div key={t.id} className="tarea hecha">
            <strong>Montaje de la base · paso {t.paso}</strong>
            <p>{t.titulo}</p>
            <span className="mini ok">Hecha por {nombreDe(sala, sala.ensamblaje.hechas[t.id])}{media !== null ? `, al ${Math.round(media * 100)}% de como lo haría un experto` : ''}.</span>
          </div>
        )
      })}
      {aqui.map(({ proc, paso }) => (
        <Tarjeta key={proc.id} sala={sala} yo={yo} proc={proc} paso={paso} remoto={remoto} alTerminar={setUltimo} />
      ))}
      {ultimo && !aqui.length && <p className={`mini ${ultimo.tipo}`}>{ultimo.texto}</p>}
    </>
  )
}
