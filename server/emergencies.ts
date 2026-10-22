// Emergencias: alerta → identificación del problema → alternativas con consecuencias distintas.
// Cada alternativa separa lo que se gana (pro) de lo que cuesta (contra) y lleva una valoración
// (nota y porqué) que se muestra a quienes decidieron, una vez resuelta.
import { C } from '../shared/ciencia.js'
import { SISTEMA_BY_ID, nombreSistema, type Emergency, type EmergencyAlternative, type Nota, type Role, type RoomState, type SistemaId } from '../shared/types.js'
import { hayEmergencia, jugador, limitar, log, rid, sis, tripulacion } from './base.js'
import { ahora, azar } from './reloj.js'
import { enSuperficie } from './sim/ambiente.js'

/** Por debajo de esta integridad un equipo deja de funcionar. */
export const UMBRAL_AVERIA = 15

type Datos = Record<string, unknown>

interface Definicion {
  roles: (room: RoomState, d: Datos) => Role[]
  titulo: (room: RoomState, d: Datos) => string
  /** Titular corto para la línea de aviso de quienes no deciden. */
  corto?: (room: RoomState, d: Datos) => string
  /** Qué pasó. */
  descripcion: (room: RoomState, d: Datos) => string
  /** Por qué importa: el riesgo concreto y en cuánto tiempo. */
  riesgo: (room: RoomState, d: Datos) => string
  fuente?: (room: RoomState, d: Datos) => string | null
  /** La última alternativa es la que se aplica si nadie decide a tiempo. */
  alternativas: (room: RoomState, d: Datos) => EmergencyAlternative[]
  /** Efecto inmediato al ocurrir, antes de que nadie decida. */
  alOcurrir?: (room: RoomState, d: Datos) => void
  aplicar: (room: RoomState, d: Datos, alt: string) => string
  /** Segundos reales para decidir. */
  segundos?: number
}

/** Alternativa con su ganancia, su coste y su valoración. `consecuencia` junta ambas para bots y propuestas. */
const op = (id: string, etiqueta: string, pro: string, contra: string, nota: Nota, porque: string): EmergencyAlternative => ({
  id,
  etiqueta,
  consecuencia: `${pro} ${contra}`,
  pro,
  contra,
  nota,
  porque,
})

const reduccionRefugio = (room: RoomState) => Math.round(Math.max(0.07, 0.25 - 0.06 * room.blindaje) * 100)
const kits = (n: number) => `${n} kit${n === 1 ? '' : 's'}`

const FALLOS: Record<SistemaId, { problema: string; riesgo: string; pasiva: (room: RoomState) => EmergencyAlternative }> = {
  cdra: {
    problema: 'A valve in the CO2 Scrubber got stuck. The CO2 the crew breathes out is no longer removed.',
    riesgo: 'CO2 goes over the 3 mmHg limit in about two hours. High CO2 causes headaches and slow thinking.',
    pasiva: (room) =>
      op(
        'lioh',
        'Install lithium hydroxide cartridges',
        'Uses no spare parts. 2 cartridges absorb 5.4 kg of CO2.',
        'The scrubber stays broken and the cartridges run out.',
        room.rec.lioh > 0 ? 'aceptable' : 'riesgosa',
        room.rec.lioh > 0 ? 'The cartridges buy time, but the scrubber still needs a repair.' : 'There were no cartridges left, so CO2 keeps rising.',
      ),
  },
  oga: {
    problema: 'The electrolysis stack of the Oxygen Generator shut down after an abnormal reading.',
    riesgo: 'No new oxygen is made. The crew lives on the tanks, which drop 0.84 kg per person per day until they run out.',
    pasiva: () => op('nada', 'Keep using the oxygen tanks', 'Uses no spare parts.', 'The oxygen tanks drop 0.84 kg per person per day.', 'riesgosa', 'The tanks are a reserve. Without the generator they run out.'),
  },
  wrs: {
    problema: 'The distiller of the Water Recycler failed.',
    riesgo: 'Used water is no longer recovered. The water reserve drops every day until it is repaired.',
    pasiva: () => op('nada', 'Leave it off', 'Uses no spare parts.', 'All the water used is lost until it is repaired.', 'riesgosa', 'Water is the hardest supply to replace on a long mission.'),
  },
  termico: {
    problema: 'A pump in the thermal loop stopped.',
    riesgo: 'The cabin starts to drift away from 22 °C right away. It cools down on Mars and heats up in space.',
    pasiva: () => op('nada', 'Leave it off', 'Uses no spare parts.', 'The cabin keeps cooling down on Mars or heating up in space.', 'riesgosa', 'A stable temperature keeps the crew and the equipment working.'),
  },
  energia: {
    problema: 'A regulator in the Power Plant went into safe mode. Generation drops almost to zero.',
    riesgo: 'The base runs on its batteries. When they run out, the air, water and heat equipment shut down.',
    pasiva: () => op('nada', 'Wait', 'Uses no spare parts.', 'When the batteries run out, the equipment shuts down.', 'riesgosa', 'Everything in the base depends on power.'),
  },
  esclusa: {
    problema: 'The Airlock seal is losing pressure.',
    riesgo: 'Nobody can go outside or recharge the suits until it is repaired.',
    pasiva: () => op('nada', 'Keep it closed', 'Uses no spare parts.', 'Nobody can go outside until it is repaired.', 'aceptable', 'It is safe for now, but all outside work stops.'),
  },
  huerto: {
    problema: 'A controller failure turned off the garden lights.',
    riesgo: 'The plants stop growing. The fresh food harvest is delayed until the lights are back.',
    pasiva: () => op('nada', 'Leave it off', 'Uses no spare parts.', 'The crop stops growing.', 'aceptable', 'The garden is not needed to stay alive today, so saving parts is fair.'),
  },
  isru: {
    problema: 'The pump of the Ice Extractor jammed.',
    riesgo: 'No new water comes in from underground. The base lives on stored water until it is fixed.',
    pasiva: () => op('nada', 'Leave it off', 'Uses no spare parts.', 'No water is drawn from underground.', 'aceptable', 'Stored water lasts a while, so saving parts is fair.'),
  },
}

const NOMBRE_ESCASEZ: Record<string, string> = { comida: 'food', agua: 'water', aire: 'oxygen' }

function alternativasEscasez(room: RoomState, d: Datos): EmergencyAlternative[] {
  const recurso = String(d.recurso)
  const nombre = NOMBRE_ESCASEZ[recurso]
  const nada = op('nada', 'Keep the same use', 'Nothing changes.', `The ${nombre} may run out before the mission ends.`, 'riesgosa', `Running out of ${nombre} ends the mission.`)
  if (recurso === 'comida') {
    const bastaAhorro = Number(d.dias) * 1.25 >= Number(d.necesarios)
    return [
      op(
        'ahorro',
        'Switch to the saver ration (80%)',
        'Food lasts 25% longer.',
        'The crew slowly loses body reserves.',
        bastaAhorro ? 'buena' : 'aceptable',
        bastaAhorro ? 'A small cut is enough to close the gap, with little harm.' : 'It helps, but 25% more is not enough to close the gap.',
      ),
      op(
        'estricto',
        'Switch to the strict ration (60%)',
        'Food lasts 67% longer.',
        'After a few weeks health suffers.',
        bastaAhorro ? 'aceptable' : 'buena',
        bastaAhorro ? 'It works, but the saver ration was enough and hurts health less.' : 'Only the strict ration closes the gap.',
      ),
      { ...nada, etiqueta: 'Keep the ration' },
    ]
  }
  if (recurso === 'agua') {
    return [
      op('ahorro', 'Save water', 'Water use drops.', 'Hygiene is cut to the minimum. Drinking water does not change.', 'buena', 'It saves water without harming health.'),
      op('ejercicio', 'Stop exercise', 'The crew sweats and breathes less, so less water and oxygen are used.', 'Muscle and bone are lost.', 'aceptable', 'It saves water, but bone and muscle loss is hard to undo.'),
      nada,
    ]
  }
  const ogaSirve = sis(room, 'oga').integridad > UMBRAL_AVERIA
  return [
    op(
      'oga',
      'Turn on the Oxygen Generator',
      'It makes oxygen from water.',
      'Uses 1.125 kg of water per kg of oxygen.',
      ogaSirve ? 'buena' : 'riesgosa',
      ogaSirve ? 'Making oxygen from water is what the generator is for.' : 'The generator was broken, so nothing changes until it is repaired.',
    ),
    op('ejercicio', 'Stop exercise', 'Oxygen use drops by about 25%.', 'Muscle and bone are lost.', 'aceptable', 'It saves oxygen, but bone and muscle loss is hard to undo.'),
    nada,
  ]
}

export const DOLENCIAS = ['lower back pain', 'a kidney stone', 'congestion and a headache', 'a hand injury', 'a skin rash', 'insomnia']

function alternativasMedicas(room: RoomState, mareo: boolean): EmergencyAlternative[] {
  const n = room.rec.botiquines
  const hay = n > 0
  return [
    op(
      'tratar',
      mareo ? 'Motion sickness medicine' : 'Treat with a medical kit',
      mareo ? 'They recover quickly.' : 'They recover and keep working.',
      `Uses 1 of the ${n} medical ${n === 1 ? 'kit' : 'kits'}.`,
      !hay ? 'aceptable' : mareo ? 'aceptable' : 'buena',
      !hay
        ? 'There were no medical kits, so it ended up as 12 hours of rest.'
        : mareo
          ? 'It works, but kits are scarce and space sickness passes on its own.'
          : 'A kit fixes it now and keeps the crew at full strength.',
    ),
    op(
      'reposo',
      '12 hours of rest',
      mareo ? 'Uses no medical kit. The body adapts on its own.' : 'Uses no medical kit.',
      'They are out of action for 12 hours.',
      mareo || !hay ? 'buena' : 'aceptable',
      mareo ? 'The body adapts to weightlessness on its own, so rest saves a kit.' : !hay ? 'With no kits left, rest is the right treatment.' : 'It saves a kit at the cost of half a day of work.',
    ),
    op('nada', 'Keep working', 'Nothing is used and they keep working.', 'They lose health and the problem goes on until treated.', 'riesgosa', 'Working while sick costs health and the problem stays.'),
  ]
}

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
    riesgo: (_room, d) =>
      `For the next ${d.horas} hours anyone outside the shelter gets the extra dose. Radiation adds up over a career, and the limit is ${C.LIMITE_CARRERA_MSV} mSv.`,
    fuente: (_room, d) => `NASA DONKI, event ${d.id}`,
    alOcurrir: (room, d) => {
      room.ambiente.tormentaSolar = { id: String(d.id), fecha: String(d.fecha), tasa: Number(d.tasa), hasta: room.t + Number(d.horas) * 3600 }
    },
    alternativas: (room, d) => [
      op('refugio', 'Whole crew to the Storm Shelter', `The storm dose drops to ${reduccionRefugio(room)}%.`, `Nobody works or repairs anything for ${d.horas} hours.`, 'buena', 'Radiation is the main long-term risk, and the shelter is built for this.'),
      op('parcial', 'Shelter, except the Systems Engineer', 'The rest take cover and the equipment stays watched.', 'The Systems Engineer gets the full cabin dose.', 'aceptable', 'One person takes the dose so the base is not left alone.'),
      op('seguir', 'Keep working', 'Everything keeps running.', 'The whole crew gets the cabin dose.', 'riesgosa', 'The whole crew took radiation that the shelter would have stopped.'),
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
    corto: (_room, d) => `${nombreSistema(d.sistema as SistemaId)} failure`,
    descripcion: (room, d) => `${FALLOS[d.sistema as SistemaId].problema} ${room.rec.repuestos} spare part kits left.`,
    riesgo: (_room, d) => FALLOS[d.sistema as SistemaId].riesgo,
    alOcurrir: (room, d) => {
      const s = sis(room, d.sistema as SistemaId)
      s.integridad = Math.min(s.integridad, 10)
      s.operativo = false
    },
    alternativas: (room, d) => {
      const hay = room.rec.repuestos >= 2
      return [
        op('reparar', 'Repair with spare parts', 'The equipment goes back to 85%.', `Uses 2 of the ${kits(room.rec.repuestos)}.`, hay ? 'buena' : 'riesgosa', hay ? 'A repair with parts is the sure fix.' : 'There were fewer than 2 kits, so the repair could not be done.'),
        op(
          'reinicio',
          'Emergency restart',
          'Uses no spare parts. A 50% chance it goes back to 45%.',
          'If it fails, it stays useless until repaired.',
          hay ? 'aceptable' : 'buena',
          hay ? 'It saves parts, but it is a coin toss.' : 'With fewer than 2 kits, a restart was the best chance to get it back.',
        ),
        FALLOS[d.sistema as SistemaId].pasiva(room),
      ]
    },
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
    descripcion: () => 'A small impact punched a hole in the hull. The cabin loses 1.5 kg of air per hour.',
    riesgo: () => 'Oxygen is topped up from the reserves, so every hour of leak eats into them. The leak does not stop on its own.',
    alOcurrir: (room) => {
      room.cabina.fuga = 1.5
    },
    alternativas: (room) => {
      const hay = room.rec.repuestos >= 1
      return [
        op('sellar', 'Seal it with a repair kit', 'The leak stops.', `Uses 1 of the ${kits(room.rec.repuestos)}.`, hay ? 'buena' : 'riesgosa', hay ? 'One kit for a lasting fix is a good trade.' : 'There were no kits, so nothing was sealed.'),
        op(
          'aislar',
          'Close off the damaged section',
          'The leak stops without using spare parts.',
          '6% of the water and food stored there is lost.',
          hay ? 'aceptable' : 'buena',
          hay ? 'It works, but it costs supplies that a kit would have saved.' : 'With no kits, closing the section was the only way to stop the leak.',
        ),
        op('nada', 'Make up for it with the reserves', 'Uses nothing now.', 'Air is lost every hour until the Systems Engineer seals it.', 'riesgosa', 'The leak keeps draining the air reserves.'),
      ]
    },
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
    riesgo: (room, d) =>
      room.cargamento.reactor > 0
        ? `For about ${d.soles} sols the panels make less power. The reactor keeps the base running, so the risk is low.`
        : `For about ${d.soles} sols the batteries drain faster. If they run out, the air and heat equipment shut down.`,
    alternativas: (room) => {
      const reactor = room.cargamento.reactor > 0
      return [
        op(
          'ahorro',
          'Power saving mode',
          'Power is kept for air and heat.',
          'The garden and the Ice Extractor are turned off.',
          reactor ? 'aceptable' : 'buena',
          reactor ? 'Safe, but the reactor already covered the base.' : 'Life support comes first when power is short.',
        ),
        op('limpiar', 'Keep everything on and clean the panels', 'Nothing is turned off.', 'Someone has to go out every sol to clean the panels, with poor visibility.', 'aceptable', 'It keeps everything on, but adds risky outside work.'),
        op(
          'nada',
          'Carry on as usual',
          'Nothing changes.',
          'If the batteries run out, the equipment shuts down on its own.',
          reactor ? 'aceptable' : 'riesgosa',
          reactor ? 'The reactor is not affected, so the base can ride it out.' : 'Without a plan, the base can lose power for days.',
        ),
      ]
    },
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
    corto: (_room, d) => `Medical problem for ${d.nombre}`,
    descripcion: (room, d) => `${d.nombre} has ${d.dolencia}. ${room.rec.botiquines} medical kits left.`,
    riesgo: (_room, d) => `Untreated, it lasts about 8 days and ${d.nombre} loses health while working.`,
    alOcurrir: (room, d) => {
      const j = jugador(room, String(d.jugadorId))
      if (j) {
        j.dolencia = String(d.dolencia)
        j.dolenciaHasta = room.t + 8 * 86400
      }
    },
    alternativas: (room) => alternativasMedicas(room, false),
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
    corto: (_room, d) => `Space sickness for ${d.nombre}`,
    descripcion: (_room, d) => `${d.nombre} feels sick and disoriented. This happens to more than half of astronauts in their first days without gravity.`,
    riesgo: (_room, d) => `It usually lasts 2 to 3 days. Until it is treated, ${d.nombre} loses health.`,
    alOcurrir: (room, d) => {
      const j = jugador(room, String(d.jugadorId))
      if (j) {
        j.dolencia = 'space sickness'
        j.dolenciaHasta = room.t + 3 * 86400
      }
    },
    alternativas: (room) => alternativasMedicas(room, true),
    aplicar: (room, d, alt) => EMERGENCIAS.medico.aplicar(room, { ...d, dolencia: 'space sickness' }, alt),
  },

  escasez: {
    roles: () => ['logistica', 'comandante'],
    titulo: (_room, d) => {
      const nombre = NOMBRE_ESCASEZ[String(d.recurso)]
      return `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} shortage`
    },
    descripcion: (_room, d) => `At the current rate, the ${NOMBRE_ESCASEZ[String(d.recurso)]} supply lasts ${d.dias} days and the mission needs ${d.necesarios}.`,
    riesgo: (_room, d) =>
      `If nothing changes, the ${NOMBRE_ESCASEZ[String(d.recurso)]} runs out about ${Math.max(1, Number(d.necesarios) - Number(d.dias))} days before the mission ends.`,
    alternativas: alternativasEscasez,
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
    riesgo: () => 'A small drift grows with distance. Fixing it later costs three times more propellant, and not fixing it means an off-target landing.',
    alternativas: (room) => [
      op('ahora', 'Correct now', 'The cheapest fix. The trajectory is back on track.', `Uses 3% of the ${Math.round(room.rec.propelente)}% propellant left.`, 'buena', 'Early corrections cost the least. Real missions fix drift as soon as they see it.'),
      op('tarde', 'Correct on approach', 'Keeps the propellant for now.', 'Uses 9% of propellant later on.', 'aceptable', 'It works, but it costs three times more than correcting now.'),
      op('nada', 'Do not correct', 'Uses no propellant.', 'The landing will be off target and harder on the equipment.', 'riesgosa', 'An off-target landing puts the equipment and the crew at risk.'),
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
    corto: def.corto?.(room, datos) ?? def.titulo(room, datos),
    descripcion: def.descripcion(room, datos),
    riesgo: def.riesgo(room, datos),
    afectado: typeof datos.jugadorId === 'string' ? datos.jugadorId : null,
    fuente: def.fuente?.(room, datos) ?? null,
    rolesResponsables: roles,
    alternativas: def.alternativas(room, datos),
    datos,
    creada: ahora(),
    vence: ahora() + (def.segundos ?? 75) * 1000,
    estado: 'activa',
    elegida: null,
    resultado: null,
    veredicto: null,
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
