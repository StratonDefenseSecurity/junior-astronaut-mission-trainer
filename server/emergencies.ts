// Emergencias: alerta → identificación del problema → alternativas con consecuencias distintas.
import { C } from '../shared/ciencia.js'
import { SISTEMA_BY_ID, nombreSistema, type Emergency, type EmergencyAlternative, type Role, type RoomState, type SistemaId } from '../shared/types.js'
import { hayEmergencia, jugador, limitar, log, rid, sis, tripulacion } from './base.js'
import { ahora, azar } from './reloj.js'
import { enSuperficie } from './sim/ambiente.js'

/** Por debajo de esta integridad un equipo deja de funcionar. */
export const UMBRAL_AVERIA = 15

type Datos = Record<string, unknown>

interface Definicion {
  roles: (room: RoomState, d: Datos) => Role[]
  titulo: (room: RoomState, d: Datos) => string
  descripcion: (room: RoomState, d: Datos) => string
  fuente?: (room: RoomState, d: Datos) => string | null
  /** La última alternativa es la que se aplica si nadie decide a tiempo. */
  alternativas: (room: RoomState, d: Datos) => EmergencyAlternative[]
  /** Efecto inmediato al ocurrir, antes de que nadie decida. */
  alOcurrir?: (room: RoomState, d: Datos) => void
  aplicar: (room: RoomState, d: Datos, alt: string) => string
  /** Segundos reales para decidir. */
  segundos?: number
}

const reduccionRefugio = (room: RoomState) => Math.round(Math.max(0.07, 0.25 - 0.06 * room.blindaje) * 100)

const FALLOS: Record<SistemaId, { problema: string; pasiva: EmergencyAlternative }> = {
  cdra: {
    problema: 'A valve in the CO2 Scrubber got stuck. The CO2 the crew breathes out builds up in the cabin. Without scrubbing, it goes over the 3 mmHg limit in a couple of hours.',
    pasiva: { id: 'lioh', etiqueta: 'Install lithium hydroxide cartridges', consecuencia: 'Uses 2 cartridges, which absorb 5.4 kg of CO2. The scrubber stays broken.' },
  },
  oga: {
    problema: 'The electrolysis stack of the Oxygen Generator shut down after an abnormal reading. The air is kept up with the tanks while they last.',
    pasiva: { id: 'nada', etiqueta: 'Keep using the oxygen tanks', consecuencia: 'Uses no spare parts. The oxygen supply drops 0.84 kg per person per day.' },
  },
  wrs: {
    problema: 'The distiller of the Water Recycler failed. Used water builds up and is not recovered.',
    pasiva: { id: 'nada', etiqueta: 'Leave it off', consecuencia: 'Uses no spare parts. All water used is lost until it is repaired.' },
  },
  termico: {
    problema: 'A pump in the thermal loop stopped. The cabin temperature will start to drift away from 22 °C.',
    pasiva: { id: 'nada', etiqueta: 'Leave it off', consecuencia: 'Uses no spare parts. The cabin cools down on Mars or heats up in space.' },
  },
  energia: {
    problema: 'A regulator in the Power Plant went into safe mode. Generation drops almost to zero and the base runs on its batteries.',
    pasiva: { id: 'nada', etiqueta: 'Wait', consecuencia: 'Uses no spare parts. When the batteries run out, the equipment shuts down.' },
  },
  esclusa: {
    problema: 'The Airlock seal is losing pressure. Nobody can go outside or recharge the suits until it is repaired.',
    pasiva: { id: 'nada', etiqueta: 'Keep it closed', consecuencia: 'Uses no spare parts. Nobody can go outside.' },
  },
  huerto: {
    problema: 'The garden lights went out because of a controller failure. The plants stop growing.',
    pasiva: { id: 'nada', etiqueta: 'Leave it off', consecuencia: 'Uses no spare parts. The crop stops growing.' },
  },
  isru: {
    problema: 'The pump of the Ice Extractor jammed. No new water is coming in.',
    pasiva: { id: 'nada', etiqueta: 'Leave it off', consecuencia: 'Uses no spare parts. No water is drawn from underground.' },
  },
}

const ESCASEZ: Record<string, { nombre: string; alternativas: EmergencyAlternative[] }> = {
  comida: {
    nombre: 'food',
    alternativas: [
      { id: 'ahorro', etiqueta: 'Switch to the saver ration (80%)', consecuencia: 'Food lasts 25% longer. The crew loses body reserves little by little.' },
      { id: 'estricto', etiqueta: 'Switch to the strict ration (60%)', consecuencia: 'Food lasts 67% longer. After a few weeks health suffers.' },
      { id: 'nada', etiqueta: 'Keep the ration', consecuencia: 'Nothing changes. Food may run out before the mission ends.' },
    ],
  },
  agua: {
    nombre: 'water',
    alternativas: [
      { id: 'ahorro', etiqueta: 'Save water', consecuencia: 'Hygiene is cut to the minimum. What the crew drinks does not change.' },
      { id: 'ejercicio', etiqueta: 'Stop exercise', consecuencia: 'The crew sweats and breathes less, so less water and oxygen are used. Muscle and bone are lost.' },
      { id: 'nada', etiqueta: 'Keep the same use', consecuencia: 'Nothing changes. Water may run out before the mission ends.' },
    ],
  },
  aire: {
    nombre: 'oxygen',
    alternativas: [
      { id: 'oga', etiqueta: 'Turn on the Oxygen Generator', consecuencia: 'It makes oxygen from water: 1.125 kg of water per kg of oxygen.' },
      { id: 'ejercicio', etiqueta: 'Stop exercise', consecuencia: 'Oxygen use drops by about 25%. Muscle and bone are lost.' },
      { id: 'nada', etiqueta: 'Keep the same use', consecuencia: 'Nothing changes. Oxygen may run out before the mission ends.' },
    ],
  },
}

export const DOLENCIAS = ['lower back pain', 'a kidney stone', 'congestion and a headache', 'a hand injury', 'a skin rash', 'insomnia']

export const EMERGENCIAS: Record<string, Definicion> = {
  // Evento real de partículas solares (DONKI).
  particulas: {
    segundos: 90,
    roles: () => ['medico', 'comandante'],
    titulo: () => 'Solar radiation storm',
    descripcion: (room, d) =>
      `A storm of particles from the Sun is arriving, the one recorded on ${d.fecha}. ` +
      (enSuperficie(room)
        ? `The atmosphere of Mars stops a good part of it, but outside the habitat the dose rises to about ${Math.round(Number(d.tasa) * 0.15)} mSv per day for ${d.horas} hours.`
        : `In the cabin the dose rises to about ${Math.round(Number(d.tasa) * 0.5)} mSv per day for ${d.horas} hours. The normal level during the cruise is ${C.GCR_CRUCERO_MSV_DIA}.`),
    fuente: (_room, d) => `NASA DONKI, event ${d.id}`,
    alOcurrir: (room, d) => {
      room.ambiente.tormentaSolar = { id: String(d.id), fecha: String(d.fecha), tasa: Number(d.tasa), hasta: room.t + Number(d.horas) * 3600 }
    },
    alternativas: (room, d) => [
      { id: 'refugio', etiqueta: 'Whole crew to the Storm Shelter', consecuencia: `The storm dose drops to ${reduccionRefugio(room)}%. Nobody works or repairs anything for ${d.horas} hours.` },
      { id: 'parcial', etiqueta: 'Shelter, except the Systems Engineer', consecuencia: 'The Systems Engineer stays at their station and gets the cabin dose. The rest take cover.' },
      { id: 'seguir', etiqueta: 'Keep working', consecuencia: 'Everything keeps running. The whole crew gets the cabin dose.' },
    ],
    aplicar: (room, _d, alt) => {
      const hasta = room.ambiente.tormentaSolar?.hasta ?? room.t
      if (alt === 'seguir') return 'The crew stays at their stations and builds up dose.'
      for (const j of tripulacion(room)) {
        if (alt === 'parcial' && j.rol === 'sistemas') continue
        j.zona = 'nave'
        j.enRefugio = true
        j.manual = null
      }
      room.refugioHasta = Math.max(room.refugioHasta, hasta)
      return alt === 'parcial' ? 'The crew takes cover. The Systems Engineer gets the cabin dose.' : 'The whole crew is in the Storm Shelter.'
    },
  },

  fallo: {
    roles: (_room, d) => (d.sistema === 'wrs' ? ['sistemas', 'logistica'] : ['sistemas']),
    titulo: (_room, d) => `Failure: ${nombreSistema(d.sistema as SistemaId)}`,
    descripcion: (room, d) => `${FALLOS[d.sistema as SistemaId].problema} ${room.rec.repuestos} spare part kits left.`,
    alOcurrir: (room, d) => {
      const s = sis(room, d.sistema as SistemaId)
      s.integridad = Math.min(s.integridad, 10)
      s.operativo = false
    },
    alternativas: (_room, d) => [
      { id: 'reparar', etiqueta: 'Repair with spare parts', consecuencia: 'Uses 2 kits. The equipment goes back to 85%.' },
      { id: 'reinicio', etiqueta: 'Emergency restart', consecuencia: 'Uses no spare parts. A 50% chance it goes back to 45%. If it fails, it stays useless until repaired.' },
      FALLOS[d.sistema as SistemaId].pasiva,
    ],
    aplicar: (room, d, alt) => {
      const s = sis(room, d.sistema as SistemaId)
      const nombre = SISTEMA_BY_ID[s.id].nombre
      if (alt === 'reparar') {
        if (room.rec.repuestos < 2) return `There were not enough spare parts. The ${nombre} is still broken.`
        room.rec.repuestos -= 2
        s.integridad = 85
        s.activo = true
        return `The ${nombre} is repaired and running.`
      }
      if (alt === 'reinicio') {
        if (azar(room) < 0.5) {
          s.integridad = 45
          s.activo = true
          return `The restart worked. The ${nombre} is back at 45%.`
        }
        s.integridad = 3
        return `The restart failed. The ${nombre} is useless until it is repaired.`
      }
      if (alt === 'lioh') {
        const usados = Math.min(2, room.rec.lioh)
        if (usados === 0) return 'There were no cartridges left. CO2 keeps rising.'
        room.rec.lioh -= usados
        room.rec.liohActivo += usados * C.LIOH_KG_CO2
        return `${usados} cartridge${usados === 1 ? ' was' : 's were'} installed. The scrubber is still broken.`
      }
      return `The ${nombre} is still broken.`
    },
  },

  fuga: {
    roles: () => ['sistemas', 'comandante'],
    titulo: () => 'Pressure leak',
    descripcion: () => 'A small impact punched a hole in the hull. The cabin loses 1.5 kg of air per hour and oxygen is topped up from the reserves.',
    alOcurrir: (room) => {
      room.cabina.fuga = 1.5
    },
    alternativas: () => [
      { id: 'sellar', etiqueta: 'Seal it with a repair kit', consecuencia: 'Uses 1 kit. The leak stops.' },
      { id: 'aislar', etiqueta: 'Close off the damaged section', consecuencia: 'The leak stops without using spare parts, but 6% of the water and food stored there is lost.' },
      { id: 'nada', etiqueta: 'Make up for it with the reserves', consecuencia: 'The leak goes on until the Systems Engineer seals it. Air is lost every hour.' },
    ],
    aplicar: (room, _d, alt) => {
      if (alt === 'sellar') {
        if (room.rec.repuestos < 1) return 'There were no spare parts left. The leak goes on.'
        room.rec.repuestos -= 1
        room.cabina.fuga = 0
        return 'Leak sealed.'
      }
      if (alt === 'aislar') {
        room.cabina.fuga = 0
        room.rec.agua *= 0.94
        room.rec.comida *= 0.94
        return 'Section closed. Some of the water and food was lost.'
      }
      return 'The leak goes on.'
    },
  },

  polvo: {
    roles: () => ['logistica', 'comandante'],
    titulo: () => 'Dust storm',
    descripcion: (room, d) =>
      `A dust storm is coming. The sky opacity rises to ${d.tau} and solar power drops to ${Math.round(Math.exp(-0.35 * (Number(d.tau) - 0.5)) * 100)}% for about ${d.soles} sols. Dust also settles on the panels.` +
      (room.cargamento.reactor > 0 ? ' The reactor is not affected.' : ''),
    alternativas: () => [
      { id: 'ahorro', etiqueta: 'Power saving mode', consecuencia: 'The garden and the Ice Extractor are turned off. Power is kept for air and heat.' },
      { id: 'limpiar', etiqueta: 'Keep everything on and clean the panels', consecuencia: 'Nothing is turned off. Someone has to go out and clean the panels every sol, with poor visibility.' },
      { id: 'nada', etiqueta: 'Carry on as usual', consecuencia: 'Nothing changes. If the batteries run out, the equipment shuts down on its own.' },
    ],
    aplicar: (room, _d, alt) => {
      if (alt === 'ahorro') {
        sis(room, 'huerto').activo = false
        sis(room, 'isru').activo = false
        room.ajustes.prioridad = 'vida'
        return 'Power saving mode on: garden and Ice Extractor turned off.'
      }
      return alt === 'limpiar' ? 'Everything stays on. The panels need cleaning.' : 'No changes.'
    },
  },

  medico: {
    roles: () => ['medico'],
    titulo: (_room, d) => `Medical problem: ${d.dolencia}`,
    descripcion: (room, d) => `${d.nombre} has ${d.dolencia}. ${room.rec.botiquines} medical kits left.`,
    alOcurrir: (room, d) => {
      const j = jugador(room, String(d.jugadorId))
      if (j) {
        j.dolencia = String(d.dolencia)
        j.dolenciaHasta = room.t + 8 * 86400
      }
    },
    alternativas: () => [
      { id: 'tratar', etiqueta: 'Treat with a medical kit', consecuencia: 'Uses 1 medical kit. They recover and keep working.' },
      { id: 'reposo', etiqueta: '12 hours of rest', consecuencia: 'Uses no medical kit. They are out of action for half a day.' },
      { id: 'nada', etiqueta: 'Keep working', consecuencia: 'They lose health and the problem goes on until the Flight Surgeon treats it.' },
    ],
    aplicar: (room, d, alt) => {
      const j = jugador(room, String(d.jugadorId))
      if (!j) return 'No patient.'
      if (alt === 'tratar') {
        if (room.rec.botiquines < 1) {
          j.incapacitado = 12 * 3600
          j.dolencia = null
          return `There were no medical kits left. ${j.nombre} rests for 12 hours.`
        }
        room.rec.botiquines -= 1
        j.dolencia = null
        j.vit.salud = limitar(j.vit.salud + 5, 0, 100)
        return `${j.nombre} was treated and stays on duty.`
      }
      if (alt === 'reposo') {
        j.incapacitado = 12 * 3600
        j.dolencia = null
        return `${j.nombre} rests for 12 hours.`
      }
      j.vit.salud = limitar(j.vit.salud - 12, 0, 100)
      return `${j.nombre} keeps working with ${d.dolencia}.`
    },
  },

  mareo: {
    roles: () => ['medico'],
    titulo: () => 'Space sickness',
    descripcion: (_room, d) => `${d.nombre} feels sick and disoriented. This happens to more than half of astronauts in their first days without gravity.`,
    alOcurrir: (room, d) => {
      const j = jugador(room, String(d.jugadorId))
      if (j) {
        j.dolencia = 'space sickness'
        j.dolenciaHasta = room.t + 3 * 86400
      }
    },
    alternativas: () => [
      { id: 'tratar', etiqueta: 'Motion sickness medicine', consecuencia: 'Uses 1 medical kit. They recover quickly.' },
      { id: 'reposo', etiqueta: '12 hours of rest', consecuencia: 'Uses no medical kit. The body adapts on its own, but they are out of action.' },
      { id: 'nada', etiqueta: 'Keep working', consecuencia: 'They lose health and the sickness goes on until treated.' },
    ],
    aplicar: (room, d, alt) => EMERGENCIAS.medico.aplicar(room, { ...d, dolencia: 'space sickness' }, alt),
  },

  escasez: {
    roles: () => ['logistica', 'comandante'],
    titulo: (_room, d) => {
      const nombre = ESCASEZ[String(d.recurso)].nombre
      return `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} shortage`
    },
    descripcion: (_room, d) =>
      `At the current rate, the ${ESCASEZ[String(d.recurso)].nombre} supply lasts ${d.dias} days and the mission needs ${d.necesarios}.`,
    alternativas: (_room, d) => ESCASEZ[String(d.recurso)].alternativas,
    aplicar: (room, d, alt) => {
      if (alt === 'ahorro' && d.recurso === 'comida') {
        room.ajustes.racionComida = 'ahorro'
        return 'Saver ration on.'
      }
      if (alt === 'estricto') {
        room.ajustes.racionComida = 'estricto'
        return 'Strict ration on.'
      }
      if (alt === 'ahorro') {
        room.ajustes.racionAgua = 'ahorro'
        return 'Water saving on.'
      }
      if (alt === 'ejercicio') {
        room.ajustes.ejercicio = 0
        return 'Exercise stopped.'
      }
      if (alt === 'oga') {
        const oga = sis(room, 'oga')
        oga.activo = true
        return oga.integridad > UMBRAL_AVERIA ? 'Oxygen Generator on.' : 'The generator is broken. It has to be repaired first.'
      }
      return 'No changes.'
    },
  },

  correccion: {
    roles: () => ['piloto', 'comandante'],
    titulo: () => 'Trajectory correction',
    descripcion: (room) =>
      `Navigation shows a drift from the entry point at Mars. Propellant margin: ${Math.round(room.rec.propelente)}%. A signal to Earth takes ${Math.round(room.vuelo.retardo / 60)} minutes, so the decision is up to the crew.`,
    alternativas: () => [
      { id: 'ahora', etiqueta: 'Correct now', consecuencia: 'Uses 3% of propellant. The sooner you correct, the less it costs.' },
      { id: 'tarde', etiqueta: 'Correct on approach', consecuencia: 'Uses 9% of propellant later on.' },
      { id: 'nada', etiqueta: 'Do not correct', consecuencia: 'Uses no propellant. The landing will be off target and harder on the equipment.' },
    ],
    aplicar: (room, _d, alt) => {
      if (alt === 'ahora') {
        room.rec.propelente = Math.max(0, room.rec.propelente - 3)
        return 'Maneuver done. Trajectory on track.'
      }
      if (alt === 'tarde') {
        room.rec.propelente = Math.max(0, room.rec.propelente - 9)
        return 'The maneuver will be done on approach.'
      }
      room.avisos.desvio = (room.avisos.desvio ?? 0) + 1
      return 'The ship is still off course.'
    },
  },
}

function crear(room: RoomState, tipo: string, datos: Datos) {
  const def = EMERGENCIAS[tipo]
  const roles = def.roles(room, datos)
  const em: Emergency = {
    id: rid(room),
    tipo,
    titulo: def.titulo(room, datos),
    descripcion: def.descripcion(room, datos),
    fuente: def.fuente?.(room, datos) ?? null,
    rolesResponsables: roles,
    alternativas: def.alternativas(room, datos),
    datos,
    creada: ahora(),
    vence: ahora() + (def.segundos ?? 75) * 1000,
    estado: 'activa',
    elegida: null,
    resultado: null,
  }
  room.emergencias.unshift(em)
  if (room.emergencias.length > 8) room.emergencias.length = 8
  log(room, `ALERT: ${em.titulo}.`, 'alerta')
}

/** Ocurre una emergencia. Su efecto es inmediato; la decisión espera turno si ya hay otra abierta. */
export function lanzarEmergencia(room: RoomState, tipo: string, datos: Datos = {}) {
  const def = EMERGENCIAS[tipo]
  if (!def || room.resultado) return
  def.alOcurrir?.(room, datos)
  if (hayEmergencia(room)) {
    if (room.cola.length < 6) room.cola.push({ tipo, datos })
  } else crear(room, tipo, datos)
}

/** Abre la siguiente emergencia en espera, si no hay ninguna activa. */
export function despacharCola(room: RoomState) {
  if (hayEmergencia(room) || room.cola.length === 0 || room.resultado) return
  const sig = room.cola.shift()!
  crear(room, sig.tipo, sig.datos)
}

export function aplicarAlternativa(room: RoomState, em: Emergency, alt: string): string {
  return EMERGENCIAS[em.tipo]?.aplicar(room, em.datos, alt) ?? 'No effect.'
}
