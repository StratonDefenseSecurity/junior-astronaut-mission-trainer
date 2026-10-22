// Controles del chat de voz: modo, medidor y prueba del micrófono, estado y avisos.
import { useState } from 'react'
import type { RoomState } from '@shared/types'
import { useVoz, voz, type EstadoPar } from '../voz'

const TEXTO_PAR: Record<EstadoPar, string> = { conectando: 'connecting voice', conectado: 'voice on', reintentando: 'reconnecting voice', fallo: 'no voice' }

/** Junto al nombre de cada tripulante: si está hablando y cómo va su voz. */
export function IndicadorVoz({ id, yo }: { id: string; yo: boolean }) {
  const v = useVoz()
  if (!v.activa) return null
  const habla = v.hablan.includes(id)
  const estado = yo ? (v.microfono === 'si' ? 'conectado' : null) : v.pares[id]
  if (!estado && !habla) return null
  return (
    <span className={`voz-ind ${habla ? 'habla' : ''} ${estado ?? ''}`} title={habla ? 'Speaking' : estado ? TEXTO_PAR[estado] : ''} aria-label={habla ? 'speaking' : undefined}>
      <i />
      {habla ? 'speaking' : estado === 'fallo' ? 'no voice' : estado === 'reintentando' || estado === 'conectando' ? '...' : ''}
    </span>
  )
}

/** Medidor del nivel del micrófono. */
export function Medidor({ nivel }: { nivel: number }) {
  return (
    <div className="medidor-mic" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(nivel * 100)}>
      <i style={{ width: `${Math.round(nivel * 100)}%` }} />
    </div>
  )
}

/** Panel desplegable con las opciones de voz. */
export function PanelVoz({ sala, alCerrar }: { sala: RoomState; alCerrar: () => void }) {
  const v = useVoz()
  const nombre = (id: string) => sala.jugadores.find((j) => j.id === id)?.nombre ?? 'a crewmate'
  const fallidos = Object.entries(v.pares).filter(([, e]) => e === 'fallo').map(([id]) => id)
  const estado = v.reconectando
    ? 'Reconnecting to voice chat.'
    : !v.activa
      ? 'Voice chat is off.'
      : v.microfono !== 'si'
        ? 'You are listening only. Your microphone is off.'
        : v.silenciado
          ? 'Your microphone is muted.'
          : v.modo === 'pulsar'
            ? v.transmitiendo
              ? 'Transmitting.'
              : 'Hold V to talk.'
            : 'Your microphone is on.'
  return (
    <div className="panel panel-voz" role="dialog" aria-label="Voice chat">
      <div className="row">
        <strong className="grow">Voice chat</strong>
        <button className="chip" onClick={alCerrar}>Close</button>
      </div>
      <div className="mini">{estado} {v.activa ? `Connected with ${v.conectados}.` : ''}</div>
      {v.error && <div className="help mini">{v.error}</div>}
      {fallidos.map((id) => (
        <div key={id} className="help mini">Voice could not connect to {nombre(id)}. Your network may block it. Use the text chat.</div>
      ))}
      {fallidos.length > 0 && (
        <button className="small" onClick={() => voz.reintentar()}>Try again</button>
      )}
      <div className="stack" style={{ gap: 4 }}>
        <span className="mini muted">Mode</span>
        <div className="row" style={{ gap: 4 }}>
          <button className={`chip ${v.modo === 'abierto' ? 'activo' : ''}`} onClick={() => voz.cambiarModo('abierto')}>Always on</button>
          <button className={`chip ${v.modo === 'pulsar' ? 'activo' : ''}`} onClick={() => voz.cambiarModo('pulsar')}>Push to talk (V)</button>
        </div>
      </div>
      <div className="stack" style={{ gap: 4 }}>
        <span className="mini muted">Microphone level</span>
        <Medidor nivel={v.microfono === 'si' ? v.nivel : 0} />
        {!v.activa && (
          <button className="small" disabled={v.probando} onClick={() => void voz.probar()}>
            {v.probando ? 'Speak now. Watch the bar move.' : 'Test my microphone'}
          </button>
        )}
      </div>
      <div className="row" style={{ gap: 4 }}>
        <button className={v.activa ? 'small' : 'small primary'} onClick={() => (v.activa || v.reconectando ? voz.desactivar() : void voz.activar())}>
          {v.activa || v.reconectando ? 'Leave voice chat' : 'Join voice chat'}
        </button>
      </div>
      <div className="mini muted">Inside the ship you hear people near you. Outside, everyone talks by radio.</div>
    </div>
  )
}

/** Botones de voz de la barra superior: entrar o salir, micrófono y opciones. */
export function BotonesVoz({ sala }: { sala: RoomState }) {
  const v = useVoz()
  const [abierto, setAbierto] = useState(false)
  const fallos = Object.values(v.pares).some((e) => e === 'fallo')
  if (!v.disponible && !v.activa && !v.reconectando) return null
  return (
    <>
      <button
        className={`chip ${v.activa ? 'activo' : ''} ${fallos || v.error ? 'aviso' : ''}`}
        title={v.activa ? 'Voice options' : 'Talk with the crew'}
        onClick={() => setAbierto(!abierto)}
      >
        {v.reconectando ? 'Voice: reconnecting' : v.activa ? `Voice · ${v.conectados}` : 'Voice'}
      </button>
      {v.activa && v.microfono === 'si' && (
        <button className={`chip ${v.modo === 'pulsar' && v.transmitiendo ? 'activo' : ''}`} title={v.modo === 'pulsar' ? 'Hold V to talk. Click to mute.' : 'Microphone'} onClick={() => voz.silenciar(!v.silenciado)}>
          {v.silenciado ? 'Mic: off' : v.modo === 'pulsar' ? (v.transmitiendo ? 'Mic: on air' : 'Mic: hold V') : 'Mic'}
        </button>
      )}
      {abierto && <PanelVoz sala={sala} alCerrar={() => setAbierto(false)} />}
    </>
  )
}
