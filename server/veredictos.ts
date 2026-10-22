// Valoración de las decisiones: tras resolver una emergencia (o una propuesta de resultado claro),
// quienes decidieron ven "Good call", "Acceptable" o "Risky choice" con una frase del porqué.
import { NOTA_TEXTO, veAlerta } from '../shared/avisos.js'
import { SISTEMA_BY_ID, type Emergency, type Nota, type Proposal, type RoomState, type SistemaId, type Veredicto } from '../shared/types.js'
import { log } from './base.js'
import { ahora } from './reloj.js'

function anotar(room: RoomState, titulo: string, nota: Nota, porque: string, decisores: string[]): Veredicto {
  log(room, `Decision review, ${titulo}: ${NOTA_TEXTO[nota]}. ${porque}`, nota === 'riesgosa' ? 'alerta' : nota === 'buena' ? 'ok' : 'info')
  return { nota, porque, decisores, t: ahora() }
}

/**
 * Valora la emergencia recién resuelta. `decisores` son quienes eligieron o votaron; si nadie
 * decidió a tiempo, se valora para quienes tenían la alerta delante.
 */
export function valorarEmergencia(room: RoomState, em: Emergency, decisores: string[] | null) {
  const alt = em.alternativas.find((a) => a.id === em.elegida)
  if (!alt) return
  if (decisores === null) {
    const quienes = room.jugadores.filter((j) => j.conectado && veAlerta(room, j, em)).map((j) => j.id)
    em.veredicto = anotar(room, em.titulo, 'riesgosa', `Nobody decided in time, so "${alt.etiqueta}" was applied.`, quienes)
    return
  }
  em.veredicto = anotar(room, em.titulo, alt.nota ?? 'aceptable', alt.porque ?? alt.consecuencia, decisores)
}

const VITALES: SistemaId[] = ['cdra', 'oga', 'termico', 'energia']

/** Valora una propuesta aprobada o rechazada, solo cuando el resultado está claro. */
export function valorarPropuesta(room: RoomState, prop: Proposal, aprobada: boolean) {
  const d = prop.payload
  const tormenta = Boolean(room.ambiente.tormentaSolar && room.ambiente.tormentaSolar.hasta > room.t)
  let v: [Nota, string] | null = null
  if (prop.tipo === 'refugio' && d.salir) {
    if (tormenta) v = aprobada ? ['riesgosa', 'The solar storm is still on. Leaving the shelter exposes the crew.'] : ['buena', 'The solar storm is still on, so staying in the shelter keeps the dose low.']
    else v = aprobada ? ['buena', 'The storm is over, so the crew can go back to work.'] : ['aceptable', 'The storm is over. Staying longer only stops the work.']
  } else if (prop.tipo === 'refugio') {
    if (tormenta) v = aprobada ? ['buena', 'A solar storm is on. The shelter cuts the dose the crew gets.'] : ['riesgosa', 'A solar storm is on and the crew stays exposed to it.']
    else if (aprobada) v = ['aceptable', 'There is no storm right now, so the shelter only stops the work.']
  } else if (prop.tipo === 'equipo' && !d.activo && VITALES.includes(d.sistema as SistemaId)) {
    const nombre = SISTEMA_BY_ID[d.sistema as SistemaId].nombre
    v = aprobada ? ['riesgosa', `The ${nombre} keeps the crew alive. Turning it off is a big risk.`] : ['buena', `The ${nombre} keeps the crew alive, so keeping it on is right.`]
  }
  if (!v) return
  prop.veredicto = anotar(room, prop.titulo, v[0], v[1], Object.keys(prop.votos))
}
