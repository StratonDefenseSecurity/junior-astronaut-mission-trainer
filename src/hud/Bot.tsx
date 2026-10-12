import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { RoomState } from '@shared/types'
import { api } from '../red'
import { useStore } from '../store'

const SUGERENCIAS = ['¿Cómo vamos?', '¿Cuánto oxígeno queda?', '¿Qué debo hacer con mi rol?', '¿Hay riesgo de radiación?', '¿Qué equipo reparar?']

export function BotPanel({ sala }: { sala: RoomState }) {
  const [texto, setTexto] = useState('')
  const fin = useRef<HTMLDivElement>(null)
  const botMsgs = useStore((s) => s.botMsgs)
  const mensajes = [...sala.chat, ...botMsgs].sort((a, b) => a.t - b.t)
  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes.length])

  const enviar = (e: FormEvent, bot: boolean) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return
    if (bot) api.bot(t)
    else api.chat(t)
    setTexto('')
  }

  return (
    <div className="chat">
      <div className="assistant">
        <strong>Asistente de misión.</strong> Recibe tu consulta, revisa el estado de la misión, evalúa los datos y te explica los riesgos.
      </div>
      <div className="row" style={{ gap: 4, marginBottom: 8 }}>
        {SUGERENCIAS.map((s) => (
          <button key={s} className="small" style={{ fontSize: 11 }} onClick={() => api.bot(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="msgs">
        {mensajes.length === 0 && <p className="muted">Aquí aparecen los mensajes del equipo y tus consultas al asistente (solo tú las ves).</p>}
        {mensajes.map((m) => (
          <div key={m.id} className={`msg ${m.bot ? 'bot' : ''}`}>
            <b>{m.de}</b>
            {m.texto}
          </div>
        ))}
        <div ref={fin} />
      </div>
      <form onSubmit={(e) => enviar(e, true)}>
        <input placeholder="Escribe al equipo o pregunta al asistente" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button type="button" className="small" onClick={(e) => enviar(e, false)} disabled={!texto.trim()}>
          Equipo
        </button>
        <button type="submit" className="small primary" disabled={!texto.trim()}>
          Asistente
        </button>
      </form>
    </div>
  )
}
