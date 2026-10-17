// Pantalla de juego: el mundo 3D al centro y, alrededor, mi estado, los integrantes, los
// puntos críticos y el registro, como en el boceto del equipo.
import { useEffect } from 'react'
import { Emergencia, Interaccion, Resultado, Transmision, VotoRapido } from '../hud/Avisos'
import { PanelEstacion } from '../hud/Estacion'
import { Lateral } from '../hud/Lateral'
import { BarraSuperior, MiEstado, PuntosCriticos, Registro, Telemetria, Tripulacion } from '../hud/Paneles'
import { Mundo } from '../mundo/Mundo'
import { useSonidoJuego } from '../mundo/Sonidos'
import { useStore, useYo } from '../store'
import type { Player, RoomState } from '@shared/types'

export function JuegoScreen() {
  const sala = useStore((s) => s.sala)!
  const ocultos = useStore((s) => s.panelesOcultos)
  const abrir = useStore((s) => s.abrirEstacion)
  const yo = useYo()
  const cinematica = sala.fase === 'lanzamiento' || (sala.fase === 'llegada' && sala.subfase === 'descenso')

  // Al cambiar de escena se cierra el panel que estuviera abierto.
  useEffect(() => abrir(null), [cinematica, yo?.zona, abrir])
  // Al llegar a la base se presenta la página principal, con las opciones de gestión.
  const enBase = sala.fase === 'ensamblaje' && !cinematica
  useEffect(() => {
    if (enBase) abrir('principal')
  }, [enBase, abrir])

  return yo ? <JuegoConJugador sala={sala} yo={yo} ocultos={ocultos} cinematica={cinematica} /> : <SinJugador />
}

function SinJugador() {
  return (
    <div className="center-screen">
      <p className="muted">You are not part of this mission.</p>
    </div>
  )
}

function JuegoConJugador({ sala, yo, ocultos, cinematica }: { sala: RoomState; yo: Player; ocultos: boolean; cinematica: boolean }) {
  useSonidoJuego(sala, yo)
  return (
    <div className="juego">
      <Mundo sala={sala} yo={yo} />
      <div className={`hud ${ocultos ? 'oculto' : ''}`}>
        <BarraSuperior sala={sala} />
        <div className="izq">
          <MiEstado sala={sala} yo={yo} />
          <Lateral sala={sala} yo={yo} />
        </div>
        <div className="der">
          <Tripulacion sala={sala} />
        </div>
        <div className="abajo">
          <PuntosCriticos sala={sala} />
          <Registro sala={sala} />
        </div>
      </div>
      {cinematica && <Telemetria sala={sala} yo={yo} />}
      {!cinematica && <PanelEstacion sala={sala} yo={yo} />}
      {!cinematica && !sala.resultado && <Interaccion />}
      <Transmision sala={sala} />
      <VotoRapido sala={sala} yo={yo} />
      <Emergencia sala={sala} yo={yo} />
      <Resultado sala={sala} />
    </div>
  )
}
