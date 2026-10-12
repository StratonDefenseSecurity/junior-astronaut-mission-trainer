import { useEffect } from 'react'
import { useStore } from '../store'
import { Scene } from '../three/Scene'
import { TopBar, CrewPanel, CriticalPanel, LogPanel, ModuleCard } from '../hud/Panels'
import { ContextoPanel, LanzamientoPanel, EnsamblajePanel, BasePanel } from '../hud/PhasePanels'
import { ProposalsPanel } from '../hud/Proposals'
import { EmergencyModal, ResultOverlay } from '../hud/Emergency'
import { BotPanel } from '../hud/Bot'

export function GameScreen() {
  const sala = useStore((s) => s.sala)!
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const pendientes = sala.propuestas.filter((p) => p.estado === 'pendiente').length
  const emergenciaActiva = sala.emergencias.some((e) => e.estado === 'activa')

  // Al entrar a una emergencia o propuesta nueva, llevar al jugador al panel útil.
  useEffect(() => {
    if (pendientes > 0 && panel === 'rol' && sala.fase !== 'ensamblaje') setPanel('propuestas')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendientes])

  const contenido =
    sala.fase === 'contexto' ? <ContextoPanel sala={sala} /> :
    sala.fase === 'lanzamiento' ? <LanzamientoPanel sala={sala} /> :
    sala.fase === 'ensamblaje' ? <EnsamblajePanel sala={sala} /> :
    <BasePanel sala={sala} />

  return (
    <div className="game">
      <Scene sala={sala} />
      <div className="hud">
        <TopBar sala={sala} />
        <div className="left">
          <div className="panel">
            <div className="tabs">
              <button className={panel === 'rol' ? 'active' : ''} onClick={() => setPanel('rol')}>Mi rol</button>
              <button className={panel === 'propuestas' ? 'active' : ''} onClick={() => setPanel('propuestas')}>
                Propuestas{pendientes ? ` (${pendientes})` : ''}
              </button>
              <button className={panel === 'bot' ? 'active' : ''} onClick={() => setPanel('bot')}>Asistente</button>
            </div>
            {panel === 'rol' && contenido}
            {panel === 'propuestas' && <ProposalsPanel sala={sala} />}
            {panel === 'bot' && <BotPanel sala={sala} />}
          </div>
        </div>
        <div className="right">
          <CrewPanel sala={sala} />
        </div>
        <div className="bottom">
          <CriticalPanel sala={sala} />
          <LogPanel sala={sala} />
        </div>
      </div>
      <ModuleCard sala={sala} />
      {emergenciaActiva && <EmergencyModal sala={sala} />}
      <ResultOverlay sala={sala} />
    </div>
  )
}
