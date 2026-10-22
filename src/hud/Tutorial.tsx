// Tutorial guiado para quien juega por primera vez: unos pasos cortos sobre los controles y
// los paneles. Sale una sola vez (se recuerda en localStorage) y se reabre con el botón de ayuda.
import { useEffect, useState } from 'react'
import type { RoomState } from '@shared/types'
import '../aprendizaje.css'

const CLAVE = 'mt_tutorial_visto'

const PASOS: { titulo: string; texto: string; donde: 'centro' | 'izq' | 'der' | 'arriba' | 'abajo' }[] = [
  { titulo: 'Welcome, astronaut', texto: 'This short tour shows you the controls. It takes about one minute. You can skip it at any time.', donde: 'centro' },
  { titulo: 'Move', texto: 'Move with W A S D. Hold Shift to run. Drag with the mouse to turn the camera.', donde: 'abajo' },
  { titulo: 'Use a station', texto: 'Walk up to a station and press E to use it. Repairs, samples and treatments are done step by step there.', donde: 'abajo' },
  { titulo: 'Base Dashboard', texto: 'Press M to open the Base Dashboard. From there you can check the base and propose decisions from anywhere.', donde: 'izq' },
  { titulo: 'Time scale', texto: 'The Mission Commander sets the time scale at the top. Time slows down by itself during alerts and while someone is outside.', donde: 'arriba' },
  { titulo: 'Crew and critical points', texto: 'The crew panel on the right shows everyone\'s health. The critical points at the bottom show what needs attention now.', donde: 'der' },
  { titulo: 'The Assistant', texto: 'Ask the Assistant in the left panel. It checks the real status and explains the risks of each decision. The ? button opens this tour again.', donde: 'izq' },
]

function leerVisto(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}
function marcarVisto() {
  try {
    localStorage.setItem(CLAVE, '1')
  } catch {
    // Sin almacenamiento: el tutorial volverá a salir la próxima vez.
  }
}

export function Tutorial({ sala, activo }: { sala: RoomState; activo: boolean }) {
  const [paso, setPaso] = useState<number | null>(null)
  // La primera vez sale solo, cuando ya se puede jugar (no en el despegue ni al terminar).
  useEffect(() => {
    if (activo && !sala.resultado && paso === null && !leerVisto()) setPaso(0)
  }, [activo, sala.resultado, paso])
  const cerrar = () => {
    marcarVisto()
    setPaso(-1)
  }
  useEffect(() => {
    if (paso === null || paso < 0) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [paso])

  const abierto = paso !== null && paso >= 0
  const p = abierto ? PASOS[paso] : null
  return (
    <>
      {!sala.resultado && (
        <button className="boton-ayuda" title="Help: show the tutorial" aria-label="Help: show the tutorial" onClick={() => setPaso(0)}>
          ?
        </button>
      )}
      {p && (
        <div className={`tutorial ${p.donde}`} role="dialog" aria-live="polite" aria-label={`Tutorial step ${paso! + 1} of ${PASOS.length}`}>
          <div className="row">
            <span className="mini muted grow">Step {paso! + 1} of {PASOS.length}</span>
            <div className="puntos-tutorial" aria-hidden="true">
              {PASOS.map((_, i) => <span key={i} className={i === paso ? 'activo' : ''} />)}
            </div>
          </div>
          <h3>{p.titulo}</h3>
          <p>{p.texto}</p>
          <div className="row" style={{ gap: 6 }}>
            <button className="small plano" onClick={cerrar}>Skip</button>
            <span className="grow" />
            {paso! > 0 && <button className="small" onClick={() => setPaso(paso! - 1)}>Back</button>}
            {paso! < PASOS.length - 1 ? (
              <button className="small primary" onClick={() => setPaso(paso! + 1)}>Next</button>
            ) : (
              <button className="small primary" onClick={cerrar}>Start playing</button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
