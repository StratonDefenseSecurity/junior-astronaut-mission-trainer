// Quién ve cada emergencia en grande y quién solo una línea de aviso. La usan el cliente (para
// mostrarla) y el servidor (para saber a quién dar la valoración si nadie decide a tiempo).
import { ROLE_BY_ID, type Emergency, type Nota, type Player, type Role, type RoomState } from './types.js'

const conectadoCon = (sala: RoomState, rol: Role) => sala.jugadores.some((j) => j.rol === rol && j.conectado)

/** Roles que se ocupan ahora de la emergencia: los responsables presentes o, si no hay ninguno, el comandante. */
export function quienSeOcupa(sala: RoomState, em: Emergency): Role[] {
  const presentes = em.rolesResponsables.filter((r) => conectadoCon(sala, r))
  if (presentes.length) return presentes
  return conectadoCon(sala, 'comandante') ? ['comandante'] : []
}

/**
 * ¿Ve este jugador la ventana completa? Sí si su rol decide, si es el afectado (el paciente) o, cuando
 * ningún rol responsable está conectado, si es el comandante (o cualquiera que pueda actuar si tampoco hay comandante).
 */
export function veAlerta(sala: RoomState, yo: Player | null, em: Emergency): boolean {
  if (!yo?.rol) return false
  if (em.afectado && em.afectado === yo.id) return true
  const ocupan = quienSeOcupa(sala, em)
  return ocupan.length ? ocupan.includes(yo.rol) : true
}

/** Línea corta para el resto: "Oxygen Generator failure. Systems Engineer is handling it." */
export function lineaAviso(sala: RoomState, em: Emergency): string {
  const roles = quienSeOcupa(sala, em)
  const quien = roles.length ? roles.map((r) => ROLE_BY_ID[r].nombre).join(' and ') : 'The crew'
  return `${em.corto ?? em.titulo}. ${quien} ${roles.length > 1 || !roles.length ? 'are' : 'is'} handling it.`
}

export const NOTA_TEXTO: Record<Nota, string> = { buena: 'Good call', aceptable: 'Acceptable', riesgosa: 'Risky choice' }
