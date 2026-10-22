// Indicador de la calidad de la conexión (ver src/conexion.ts).
import { TEXTO_CALIDAD, useConexion, type Calidad } from '../conexion'

const TONO: Record<Calidad, string> = { midiendo: '', buena: 'ok', lenta: 'warn', mala: 'bad' }

function detalle(ms: number | null, fallos: number): string {
  const partes = []
  if (ms !== null) partes.push(`Round trip ${Math.round(ms)} ms.`)
  if (fallos > 0) partes.push(`${Math.round(fallos * 100)}% of requests failed.`)
  return partes.join(' ') || 'Measuring the connection to the server.'
}

/** Chip pequeño para la barra superior, con un aviso si la conexión es mala. */
export function ChipConexion() {
  const { calidad, ms, fallos } = useConexion()
  return (
    <>
      <span className={`chip conexion ${TONO[calidad]}`} title={detalle(ms, fallos)}>
        <i className="punto" /> Connection: {TEXTO_CALIDAD[calidad]}
      </span>
      {calidad === 'mala' && <div className="aviso-conexion mini">Your connection is slow. Actions may take a few seconds.</div>}
    </>
  )
}

/** Comprobación de la conexión en la sala de espera, antes de empezar. */
export function ComprobacionConexion() {
  const { calidad, ms, fallos } = useConexion()
  const texto: Record<Calidad, string> = {
    midiendo: 'Checking your connection to the server.',
    buena: 'Your connection is good. You are ready to play.',
    lenta: 'Your connection is a bit slow. The game works, but actions may take a moment.',
    mala: 'Your connection is poor. Actions may take a few seconds. Try a better network if you can.',
  }
  return (
    <div className={`comprobacion-conexion ${TONO[calidad]}`}>
      <i className="punto" />
      <div>
        <strong>Connection: {TEXTO_CALIDAD[calidad]}</strong>
        <div className="mini muted">
          {texto[calidad]} {detalle(ms, fallos)}
        </div>
      </div>
    </div>
  )
}
