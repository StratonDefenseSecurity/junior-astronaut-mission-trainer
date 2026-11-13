// La vida diaria a bordo: el horario de hoy (como el Onboard Short-Term Plan de la ISS) y, fuera
// del hábitat, la lista del puño del traje con los consumibles, la hora de volver y el compañero.
import { C } from '@shared/ciencia'
import { consumiblesTraje, minutosFuera, minutosHastaVolver } from '@shared/eva'
import { cargaTraje, oscuro, solDeSala } from '@shared/noche'
import { DIAS_SEMANA, HORARIO, SABADO, bloqueDe, diaSemana, enMarte, horaTexto } from '@shared/horario'
import { deberesDeFase } from '@shared/procedimientos'
import type { Player, RoomState } from '@shared/types'
import { local } from '../mundo/control'
import { ajenos, api } from '../red'

const minTexto = (m: number) => {
  const v = Math.max(0, Math.round(m))
  return v >= 60 ? `${Math.floor(v / 60)} h ${String(v % 60).padStart(2, '0')} min` : `${v} min`
}

/** Pestaña "Today": el horario del día con el bloque actual resaltado. */
export function Hoy({ sala }: { sala: RoomState }) {
  const h = sala.ambiente.hora
  const actual = bloqueDe(h)
  const marte = enMarte(sala)
  const dia = diaSemana(sala)
  const pendientes = deberesDeFase(sala).filter((d) => sala.deberes?.[d.id]?.pendiente)
  return (
    <div className="hoy">
      <p className="mini">
        <strong>{DIAS_SEMANA[dia]}</strong>, {marte ? `sol ${sala.ambiente.sol}, ${horaTexto(h)} Mars time` : `${horaTexto(h)} ship time`}.
        {marte ? ' A sol lasts 24 h 39 min, so each Mars hour is a bit longer.' : ''}
        {dia === SABADO ? ' Saturday morning is cleaning time.' : ''}
      </p>
      <ol className="horario">
        {HORARIO.map((b) => (
          <li key={b.id} className={b.id === actual.id ? 'ahora' : ''} aria-current={b.id === actual.id ? 'time' : undefined}>
            <span className="hora">{horaTexto(b.desde)}</span>
            <span>{b.nombre}</span>
          </li>
        ))}
      </ol>
      {pendientes.length > 0 && <p className="mini">Routine duties due now: {pendientes.length}. See the Mission tab.</p>}
      <p className="mini muted">Real ISS durations: 1 h post-sleep, 6.5 h of work, {C.EJERCICIO_ISS_H} h of exercise, {C.SUENO_ISS_H} h of sleep.</p>
    </div>
  )
}

/** Lista del puño del traje: aparece mientras estás fuera. */
export function ListaPuno({ sala, yo }: { sala: RoomState; yo: Player }) {
  if (yo.zona !== 'exterior') return null
  const c = consumiblesTraje(yo, sala)
  const eva = yo.eva
  const fuera = minutosFuera(sala, yo)
  const volver = minutosHastaVolver(sala, yo)
  const companero = eva?.companero ? sala.jugadores.find((o) => o.id === eva.companero) : null
  let distancia: number | null = null
  if (companero && companero.zona === 'exterior') {
    const p = ajenos.get(companero.id)
    if (p) distancia = Math.hypot(p.x - local.x, p.z - local.z)
  }
  const lejos = distancia !== null && distancia > C.EVA_COMPANERO_M
  const reserva = c.min <= C.EVA_RESERVA_MIN
  const tono = (m: number) => (m <= C.EVA_RESERVA_MIN ? 'bad' : m <= C.EVA_RESERVA_MIN + C.EVA_REGRESO_MIN ? 'warn' : '')
  return (
    <div className={`puno ${reserva ? 'bad' : volver <= 0 || lejos ? 'warn' : ''}`} role="status" aria-label="Cuff checklist">
      <strong>Cuff checklist</strong>
      {eva ? <p className="mini">{eva.objetivo}.</p> : null}
      <ul className="mini">
        <li className={tono(c.o2)}>O2: {minTexto(c.o2)}</li>
        <li className={tono(c.bateria)}>Battery: {minTexto(c.bateria)}</li>
        <li className={tono(c.co2)}>CO2 absorbent: {minTexto(c.co2)}</li>
        <li>Outside: {minTexto(fuera)} of {C.EVA_VENTANA_H} h planned</li>
        <li className={volver <= 0 ? 'warn' : ''}>{volver > 0 ? `Turn back in ${minTexto(volver)}` : 'Turn back now'}</li>
        <li className={lejos ? 'warn' : ''}>
          {companero
            ? `Buddy: ${companero.nombre}${companero.zona === 'exterior' ? (distancia !== null ? `, ${Math.round(distancia)} m away` : ', outside') : ', on the radio inside'}`
            : 'No buddy. Nobody is watching you.'}
        </li>
      </ul>
      {lejos && <p className="mini">Your buddy is too far. Stay within {C.EVA_COMPANERO_M} m.</p>}
      {reserva && <p className="mini">Reserve reached. Go inside now.</p>}
      {!reserva && volver <= 0 && <p className="mini">Walk back now. Keep the {C.EVA_RESERVA_MIN}-minute reserve.</p>}
      <LucesTraje sala={sala} yo={yo} bateria={c.bateria} />
      <p className="mini muted">If the suit fails: the backup oxygen pack gives 30 minutes. Go straight to the airlock.</p>
    </div>
  )
}

/** Focos del casco y linterna: encenderlos cuesta batería; de noche, sin ellos, el suelo no se ve. */
function LucesTraje({ sala, yo, bateria }: { sala: RoomState; yo: Player; bateria: number }) {
  if (!enMarte(sala)) return null
  const casco = Boolean(yo.luces?.casco)
  const mano = Boolean(yo.luces?.mano)
  const carga = cargaTraje(sala, yo)
  const noche = oscuro(sala)
  const elev = solDeSala(sala).elevacion
  const sinLuces = (bateria * carga.total) / (carga.total - carga.luces)
  const pct = (x: number) => `${Math.round(x * 100)}%`
  return (
    <div className="luces-traje">
      <strong className="mini">Lights</strong>
      <p className="mini">
        {noche ? `Night. The Sun is ${Math.round(-elev)}° below the horizon.` : elev < 0 ? 'Twilight. The dust high up still glows. It gets dark soon.' : 'Daylight.'} It is {sala.ambiente.tempExt} °C.
      </p>
      <div className="row" style={{ gap: 6 }}>
        <button className={`small ${casco ? 'primary' : ''}`} aria-pressed={casco} onClick={() => api.accion('luces', { casco: !casco })}>
          Helmet lights {casco ? 'on' : 'off'}
        </button>
        <button className={`small ${mano ? 'primary' : ''}`} aria-pressed={mano} onClick={() => api.accion('luces', { mano: !mano })}>
          Hand light {mano ? 'on' : 'off'}
        </button>
      </div>
      <p className="mini muted">
        Battery use: {pct(carga.total)} of normal. Lights +{pct(carga.luces)}, heater +{pct(carga.calor)}.
        {carga.luces > 0 ? ` Battery left: ${minTexto(bateria)} with lights, ${minTexto(sinLuces)} without.` : ''} Press L for the helmet lights.
      </p>
      {noche && !casco && <p className="mini warn">{mano ? 'The hand light shows only a small patch. You walk slower and may still fall.' : 'It is dark. Without lights you walk at half speed and may fall.'}</p>}
      {!noche && (casco || mano) && <p className="mini muted">There is enough light now. Your lights only drain the battery.</p>}
    </div>
  )
}
