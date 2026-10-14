// Cuentas del plan de misión que usan igual el servidor y la pantalla de contextualización:
// las alternativas de suministros y lo que el asistente analiza sobre la carga elegida.
import { C } from './ciencia.js'
import { escenarioDe } from './escenarios.js'
import { SUPPLIES, masaTotal, tripulantesPlan, type Loadout, type RoomState } from './types.js'

type Plan = Pick<RoomState, 'fase' | 'jugadores' | 'mision' | 'cargamento' | 'capacidad' | 'escenario'>

/** Las tres alternativas sobre la cantidad de suministros. `margen` 1 = lo justo. */
export const ALTERNATIVAS = [
  { id: 'minimo', nombre: 'Lo mínimo', margen: 1, descripcion: 'Lo justo para la misión, sin margen. Pesa menos, pero cualquier avería o retraso deja a la tripulación sin reservas.' },
  { id: 'equilibrado', nombre: 'Equilibrada', margen: 1.15, descripcion: 'Un 15% de más en agua, comida y repuestos, algo de blindaje y el huerto. Aguanta un imprevisto.' },
  { id: 'seguro', nombre: 'Máxima seguridad', margen: 1.3, descripcion: 'Un 30% de más, más oxígeno, más paneles y doble blindaje. Es la más pesada: puede que no quepa en la nave.' },
] as const
export type AlternativaId = (typeof ALTERNATIVAS)[number]['id']

const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** Días que dura la misión entera: el viaje más la estancia en la superficie. */
export const diasDeMision = (room: Plan) => room.mision.diasTransito + (room.mision.solesObjetivo * C.SOL_S) / 86400

/** Kg de agua que gasta una persona al día con el reciclaje funcionando: casi toda se va en fabricar oxígeno. */
const AGUA_NETA_KG_DIA = 3.2 * 0.07 + 0.84 * C.OGA_AGUA_POR_O2

/** Carga sugerida para la tripulación y el plan actuales. */
export function cargaRecomendada(room: Plan, margen: number): Loadout {
  const n = tripulantesPlan(room)
  const dias = diasDeMision(room) + 2
  const aguaKg = (n * AGUA_NETA_KG_DIA * dias + 60 + 20 * n) * margen
  const comidaKg = n * C.COMIDA_KG_DIA * dias * margen
  const seguro = margen >= 1.25
  const justo = margen <= 1.02
  const carga: Loadout = {
    agua: Math.ceil(aguaKg / 100),
    oxigeno: justo ? 1 : seguro ? 3 : 2,
    alimentos: Math.ceil(comidaKg / 100),
    lioh: Math.ceil(n * 3 * margen),
    repuestos: Math.ceil((7 + dias / 25) * margen),
    paneles: justo ? 4 : seguro ? 6 : 5,
    baterias: justo ? 1 : 2,
    reactor: 0,
    blindaje: justo ? 0 : seguro ? 2 : 1,
    botiquin: Math.ceil(n * 0.8 * margen),
    huerto: justo ? 0 : 1,
    isru: 0,
  }
  for (const s of SUPPLIES) carga[s.id] = limitar(Math.max(carga[s.id], minimoDe(room, s.id)), s.min, s.max)
  return carga
}

/** Cantidad mínima de un suministro que exige la situación de la misión. */
export const minimoDe = (room: Pick<RoomState, 'escenario'>, id: keyof Loadout) => escenarioDe(room.escenario).cargaMinima?.[id] ?? 0

/** Lo que el asistente calcula sobre una carga: para cuántos días alcanza cada cosa. */
export function analizarCarga(room: Plan, carga: Loadout = room.cargamento) {
  const n = tripulantesPlan(room)
  const viaje = room.mision.diasTransito
  const estancia = (room.mision.solesObjetivo * C.SOL_S) / 86400
  const total = viaje + estancia
  const energia = carga.paneles * C.PANEL_KW * 0.637 * 0.5 + carga.reactor * C.REACTOR_KW
  return {
    n,
    viaje,
    estancia,
    total,
    masa: masaTotal(carga),
    /** Días de comida. No se recicla. */
    comida: (carga.alimentos * 100) / (n * C.COMIDA_KG_DIA),
    /** Días de agua, reciclando y fabricando con ella el oxígeno. */
    agua: (carga.agua * 100) / (n * AGUA_NETA_KG_DIA),
    /** Días de oxígeno en tanques si el generador falla. */
    aireTanques: (carga.oxigeno * 100) / (n * 0.84),
    /** kW medios en la superficie de Marte, de día y de noche. */
    energia,
    /** kWh de baterías para pasar la noche. */
    noche: carga.baterias * C.BATERIA_KWH,
    /** mSv por persona solo de rayos cósmicos, sin tormentas solares. */
    dosis: viaje * C.GCR_CRUCERO_MSV_DIA + estancia * C.GCR_SUPERFICIE_MSV_DIA,
  }
}
