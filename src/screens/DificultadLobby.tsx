// Dificultad y misión de demostración: las elige el anfitrión en la sala de espera.
import { DEMO, DIFICULTADES } from '@shared/informe'
import { TRAYECTORIA_BY_ID, type RoomState } from '@shared/types'
import { api } from '../red'
import '../aprendizaje.css'

export function DificultadLobby({ sala, soyHost }: { sala: RoomState; soyHost: boolean }) {
  const actual = sala.dificultad ?? 'astronauta'
  const demo = Boolean(sala.demo)
  return (
    <>
      <h3>Difficulty {soyHost ? '· you choose it' : ''}</h3>
      <div className="dificultad" role="radiogroup" aria-label="Difficulty">
        {DIFICULTADES.map((d) => (
          <button key={d.id} role="radio" aria-checked={actual === d.id} className={`opcion ${actual === d.id ? 'activa' : ''}`} disabled={!soyHost} onClick={() => api.dificultad(d.id, demo)}>
            <strong>{d.nombre}</strong>
            <small>{d.descripcion}</small>
          </button>
        ))}
      </div>
      <label className="mini demo-opcion">
        <input type="checkbox" checked={demo} disabled={!soyHost} onChange={(e) => api.dificultad(actual, e.target.checked)} />
        <span>
          <strong>Quick demo mission.</strong> About 10 to 15 minutes from launch to the end, for judges and classrooms. It uses the {TRAYECTORIA_BY_ID[DEMO.trayectoria].dias}-day fast trajectory, {DEMO.soles} sols on Mars and {DEMO.muestras} samples. Time runs at the highest scale in each phase. All the science numbers stay real.
        </span>
      </label>
    </>
  )
}
