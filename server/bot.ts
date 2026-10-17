// Asistente de misión por reglas: recibe la consulta, mira el estado real de la sala,
// evalúa los datos y explica los riesgos. No usa servicios externos.
import { C } from '../shared/ciencia.js'
import { cultivoDe } from '../shared/procedimientos.js'
import { PERFIL_BY_ID, ROLE_BY_ID, SITE_BY_ID, nombreSistema, formatoHora, formatoMET, type Player, type RoomState } from '../shared/types.js'
import { rendimiento, sis, tripulacion } from './base.js'
import { UMBRAL_AVERIA } from './emergencies.js'
import { enSuperficie, tasaDeDosis } from './sim/ambiente.js'
import { FC_MAXIMA } from './sim/fisiologia.js'
import { diasRestantes } from './sim/paso.js'

/** Cómo va el huerto, almohadilla por almohadilla, y cuándo se cosecha. */
function estadoHuerto(room: RoomState): string {
  const vivas = (room.huerto.almohadillas ?? []).filter((a) => !a.muerta)
  if (!vivas.length) return 'set up, but no plants are left alive'
  const c = cultivoDe(room)
  const falta = Math.max(0, Math.round((1 - Math.max(...vivas.map((a) => a.crecimiento))) * c.dias))
  const seca = Math.round(Math.min(...vivas.map((a) => a.humedad)))
  return `${vivas.length} ${c.nombre.charAt(0).toLowerCase() + c.nombre.slice(1)} plants, ready to harvest in about ${falta} days if you look after them. The driest pad is at ${seca}% moisture. Harvests: ${room.huerto.cosechas}`
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const dias = (d: number) => (d >= 999 ? 'more than enough days' : `${Math.round(d)} days`)
const n1 = (v: number) => v.toFixed(1)
const RACION_EN = { normal: 'Full', ahorro: 'Saver (80%)', estricto: 'Strict (60%)' } as const
const PRIORIDAD_EN = { vida: 'protect the air', calor: 'protect the heat', ciencia: 'protect the garden' } as const

function riesgos(room: RoomState): string {
  return room.puntosCriticos.length ? `Critical points right now: ${room.puntosCriticos.join('; ')}.` : 'I see no immediate risks.'
}

function porRol(room: RoomState, j: Player): string {
  const sup = enSuperficie(room)
  switch (j.rol) {
    case 'comandante': {
      const p = room.propuestas.filter((x) => x.estado === 'pendiente').length
      return p
        ? `You have ${p} proposal${p === 1 ? '' : 's'} waiting for your decision. Read the consequence before you approve.`
        : 'Control the time scale. Speed up when everything is stable and slow down before a delicate task. Watch the critical points.'
    }
    case 'piloto':
      return room.fase === 'transito'
        ? 'Correct the trajectory as soon as it is requested. The sooner you do it, the less propellant it costs. When you arrive, propose the landing site.'
        : sup
          ? 'Help outside. Deploy equipment and clean the panels when dust builds up. Watch your suit oxygen.'
          : 'Get ready to propose the landing site from orbit.'
    case 'medico': {
      const peor = [...tripulacion(room)].sort((a, b) => a.vit.salud - b.vit.salud)[0]
      return `Check the vital signs of each crew member. ${peor && peor.vit.salud < 80 ? `${peor.nombre} has health at ${Math.round(peor.vit.salud)}. Treat them in the Medical Bay. ` : ''}The current exercise plan is ${room.ajustes.ejercicio} h per day. On the ISS they do ${C.EJERCICIO_ISS_H}.`
    }
    case 'logistica':
      return `Compare how many days each supply lasts with the ${Math.round(diasRestantes(room))} days left. Water: ${dias(room.autonomia.agua)}. Air: ${dias(room.autonomia.aire)}. Food: ${dias(room.autonomia.comida)}. If something will not last, propose rationing.`
    case 'cientifico':
      return room.fase === 'base'
        ? `${room.mision.muestrasAnalizadas} of ${room.mision.muestrasObjetivo} samples done. Suit up, collect at the marked sites and analyze them in the lab.`
        : room.cargamento.huerto > 0 && !room.huerto.establecido
          ? `You can start setting up the garden in the lab during the cruise. It is ${room.huerto.progreso}% done.`
          : 'Prepare the sampling plan for when the base is up and running.'
    case 'sistemas': {
      const peor = [...room.sistemas].filter((s) => s.instalado).sort((a, b) => a.integridad - b.integridad)[0]
      return `The most worn equipment is the ${nombreSistema(peor.id)} (${Math.round(peor.integridad)}%). Below ${UMBRAL_AVERIA}% it stops working. ${room.rec.repuestos} kits left. You have to go to the equipment to repair it.`
    }
    default:
      return 'Choose a role to get advice.'
  }
}

export function responderBot(room: RoomState, autor: Player, pregunta: string): string {
  const t = norm(pregunta)
  const r = room.rec
  const c = room.cabina
  const e = room.energia
  const a = room.ambiente
  const v = autor.vit
  const sup = enSuperficie(room)
  const n = Math.max(1, tripulacion(room).length)

  if (room.fase === 'lobby') return 'We are in the lobby. When everyone has chosen a role and a suit, the host can start the mission.'

  if (room.fase === 'contexto') {
    const viaje = room.mision.diasTransito
    const estancia = (room.mision.solesObjetivo * C.SOL_S) / 86400
    const total = viaje + estancia
    const carga = room.cargamento
    const comida = (carga.alimentos * 100) / (n * C.COMIDA_KG_DIA)
    const aguaDia = n * (3.2 * 0.07 + 0.84 * C.OGA_AGUA_POR_O2)
    const agua = (carga.agua * 100) / aguaDia
    const dosis = viaje * C.GCR_CRUCERO_MSV_DIA + estancia * C.GCR_SUPERFICIE_MSV_DIA
    if (/radiac|dosis|blindaje|tormenta solar|radiation|dose|shield|cosmic|sievert|solar storm/.test(t)) {
      return `From cosmic rays alone, each crew member will get about ${Math.round(dosis)} mSv in ${Math.round(total)} days (${C.GCR_CRUCERO_MSV_DIA} mSv per day during the cruise and ${C.GCR_SUPERFICIE_MSV_DIA} on Mars). The NASA career limit is ${C.LIMITE_CARRERA_MSV} mSv. Solar storms add more. The shielded shelter is what reduces them.`
    }
    if (/energia|panel|bateria|reactor|energy|power|batter|solar/.test(t)) {
      return `At night on Mars the base needs about 8 kW for more than 12 hours. That is close to 100 kWh. You are taking ${carga.baterias} batter${carga.baterias === 1 ? 'y' : 'ies'} of 100 kWh and ${carga.paneles} solar array${carga.paneles === 1 ? '' : 's'} of 7 kW at noon. The reactor gives a steady 10 kW and dust does not affect it.`
    }
    return `Crew of ${n}, a ${viaje}-day cruise plus ${room.mision.solesObjetivo} sols: ${Math.round(total)} days in total. With the current cargo the food lasts ${Math.round(comida)} days and the water about ${Math.round(agua)} (recycling 98% and making oxygen from it). Mass: ${room.masa.toFixed(1)} of ${room.capacidad.toFixed(1)} t${room.masa > room.capacidad ? ', over the maximum' : ''}. Ask me about radiation or power.`
  }

  if (room.fase === 'fin') return room.resultado?.motivo ?? 'The mission is over.'

  // ---- Consultas durante la misión ----
  // Las preguntas pueden llegar en español o en inglés: cada regla reconoce palabras de ambos.
  if (/pulso|corazon|cardiac|latido|pulse|heart|\bbpm\b/.test(t)) {
    const causas: string[] = []
    if (autor.actividad === 'eva') causas.push('you are working in your suit')
    if (autor.actividad === 'ejercicio') causas.push('you are exercising')
    if (room.vuelo.g > 1.5) causas.push(`you are pulling ${room.vuelo.g} g`)
    if (v.spo2 < 94) causas.push('your blood oxygen is low')
    if (c.ppCO2 > C.PPCO2_LIMITE_KPA) causas.push('CO2 in the cabin is high')
    if (autor.deficitAgua > 0.5) causas.push('you need water')
    if (v.fatiga > 70) causas.push('you are very tired')
    return `Your pulse is ${Math.round(v.fc)} beats per minute and you breathe ${Math.round(v.fr)} times per minute. Your theoretical maximum is ${Math.round(FC_MAXIMA)} (208 − 0.7 × age). ${causas.length ? `It is up because ${causas.join(', ')}.` : 'It is in a normal range for what you are doing.'}`
  }
  if (/mi estado|como estoy|mis signos|mi salud|me siento|mi cuerpo|how am i|how do i feel|my health|my vitals|my vital signs|my status|my body|my condition/.test(t)) {
    return `Health ${Math.round(v.salud)}. Pulse ${Math.round(v.fc)}, breathing ${Math.round(v.fr)}, blood oxygen ${Math.round(v.spo2)}%. Hydration ${Math.round(v.hidratacion)}%, energy reserves ${Math.round(v.reservas)}%, fatigue ${Math.round(v.fatiga)}%. Muscle and bone at ${Math.round(v.condicion)}%. Total dose ${n1(v.dosis)} mSv of ${C.LIMITE_CARRERA_MSV}.${autor.dolencia ? ` You have ${autor.dolencia}. See the Flight Surgeon.` : ''}`
  }
  if (/traje|\beva\b|salir|exterior|esclusa|\bsuit|spacewalk|airlock|go outside|go out\b/.test(t)) {
    const o2 = Math.round((autor.trajeO2 / C.TRAJE_O2_KG) * 100)
    return `Your suit has ${o2}% oxygen and ${Math.round(autor.trajeBateria * 100)}% battery. When full it lasts between 7 and ${C.TRAJE_BATERIA_H} hours of work. It runs on pure oxygen at ${C.TRAJE_PRESION_KPA} kPa. ${sup ? `Outside it is ${a.tempExt} °C and ${a.presion} Pa, less than 1% of the pressure on Earth. With someone outside, the time scale cannot go above ×60.` : 'You can only go outside once the ship is on Mars.'} The airlock refills it when you come back.`
  }
  if (/co2|dioxido|depurador|lioh|hidroxido|carbon dioxide|scrubber|lithium|hydroxide/.test(t)) {
    const mmHg = c.ppCO2 * 7.5
    const cdra = sis(room, 'cdra')
    return `CO2 in the cabin: ${n1(mmHg)} mmHg. The NASA limit is 3. In the game, above 15 it harms your health. CO2 Scrubber ${cdra.operativo ? `running at ${Math.round(cdra.integridad)}%` : 'STOPPED'}. The crew makes ${n1(n * 1.0)} kg of CO2 per day. Spare cartridges: ${r.lioh} (each one absorbs ${C.LIOH_KG_CO2} kg).`
  }
  if (/oxigeno|o2|aire|respir|asfix|oxygen|\bair\b|breath|suffocat|hypoxi/.test(t)) {
    const oga = sis(room, 'oga')
    return `Oxygen in the cabin: ${n1(c.ppO2)} kPa. Normal is ${C.PPO2_NOMINAL_KPA}, and below ${C.PPO2_MINIMA_KPA} hypoxia begins. Your blood is at ${Math.round(v.spo2)}%. Oxygen Generator ${oga.operativo ? `running at ${Math.round(oga.integridad)}%` : 'stopped'}. The tanks hold ${Math.round(r.o2)} kg. The crew uses ${n1(n * 0.84)} kg per day. It lasts ${dias(room.autonomia.aire)}.`
  }
  if (/agua|hidrat|\bsed\b|recicl|water|hydrat|thirst|drink|recycl/.test(t)) {
    const wrs = sis(room, 'wrs')
    return `Drinking water: ${Math.round(r.agua)} kg, plus ${Math.round(r.aguaResidual)} kg of used water waiting to be recycled. Water Recycler ${wrs.operativo ? `running: it recovers ${Math.round((0.9 + (C.WRS_EFICIENCIA - 0.9) * rendimiento(wrs.integridad)) * 100)}%` : 'STOPPED: all used water is lost'}. Each person uses about 3.2 kg per day, and the Oxygen Generator uses ${C.OGA_AGUA_POR_O2} kg of water per kg of oxygen. It lasts ${dias(room.autonomia.agua)}. There are ${Math.round(diasRestantes(room))} mission days left.`
  }
  if (/comida|aliment|racion|hambre|huerto|cosecha|food|\beat|meal|ration|hungry|hunger|garden|harvest|crops?\b|lettuce/.test(t)) {
    const h = room.huerto
    return `Food: ${Math.round(r.comida)} kg. ${RACION_EN[room.ajustes.racionComida]} ration: ${n1(n * C.COMIDA_KG_DIA * { normal: 1, ahorro: 0.8, estricto: 0.6 }[room.ajustes.racionComida])} kg per day. It lasts ${dias(room.autonomia.comida)}. There are ${Math.round(diasRestantes(room))} days left. Your reserves are at ${Math.round(v.reservas)}%. Garden: ${h.establecido ? estadoHuerto(room) : room.cargamento.huerto ? `${h.progreso}% set up` : 'the crew did not bring the kit'}.`
  }
  // La radiación va antes que la energía para que "tormenta solar" o "solar storm" no caigan en la regla de los paneles.
  if (/radiac|dosis|tormenta solar|refugio|blindaje|fulgur|particul|radiation|dose|solar storm|shelter|shield|flare|particle|cosmic|sievert|msv/.test(t)) {
    const cabina = tasaDeDosis(room, 'nave', false)
    const refugio = tasaDeDosis(room, 'nave', true)
    return `Right now you get ${n1(v.dosisTasa)} mSv per day and you have ${n1(v.dosis)} mSv in total. The NASA career limit is ${C.LIMITE_CARRERA_MSV}. In the cabin it is ${n1(cabina)} mSv per day and in the Storm Shelter ${n1(refugio)}. ${a.tormentaSolar ? `A solar storm is active (the one from ${a.tormentaSolar.fecha}).` : 'There is no solar storm.'} The shelter has ${room.blindaje} layer${room.blindaje === 1 ? '' : 's'} of shielding. Cosmic rays are hard to stop. Particles from the Sun are not.`
  }
  if (/energia|bateria|panel|solar|reactor|electric|luz|energy|power|batter|\blight|\bkw/.test(t)) {
    const pct = e.capacidad ? Math.round((e.bateria / e.capacidad) * 100) : 0
    return `Generation ${n1(e.generacion)} kW, use ${n1(e.consumo)} kW, batteries at ${pct}% (${Math.round(e.bateria)} of ${e.capacidad} kWh). ${sup ? `It is ${formatoHora(a.hora)}. Dust opacity ${a.tau}. Dust on the panels −${Math.round(e.polvo * 100)}%.` : 'In space the panels get light all the time.'} ${e.cortes.length ? `No power: ${e.cortes.map((id) => nombreSistema(id)).join(', ')}.` : ''} Priority if power runs short: ${PRIORIDAD_EN[room.ajustes.prioridad]}.`
  }
  if (/clima|temperatura|frio|calor|polvo|viento|presion|tiempo hace|afuera|weather|temperature|\bcold\b|\bhot\b|heat|dust|wind|pressure|outside|climate/.test(t)) {
    if (!sup) return `We are in space, so there is no air outside. The cabin is at ${n1(c.temp)} °C. Sunlight arrives at ${a.flujoSolar} W/m². At the orbit of Earth it is ${C.IRRADIANCIA_TIERRA} and at the orbit of Mars ${C.IRRADIANCIA_MARTE}.`
    return `Sol ${a.sol}, ${formatoHora(a.hora)} local time. Outside it is ${a.tempExt} °C and ${a.presion} Pa. These are the values Curiosity measured on its sol ${a.solCuriosity}${room.sitio !== 'gale' ? ', with an estimated adjustment for this site' : ''}. Dust opacity ${a.tau}${a.tormentaPolvo ? `, with a dust storm for ${a.polvoSoles} more sols` : ''}. The cabin is at ${n1(c.temp)} °C.`
  }
  if (/equipo|reparar|averia|mantenim|integridad|repuesto|sistema|equipment|repair|broken|\bfix|maintenance|integrity|spare|system|machine/.test(t)) {
    const lista = room.sistemas.filter((s) => s.instalado).map((s) => `${nombreSistema(s.id)} ${Math.round(s.integridad)}%${s.integridad <= UMBRAL_AVERIA ? ' (broken)' : !s.activo ? ' (off)' : ''}`)
    return `Equipment: ${lista.join(', ')}. Spare parts: ${r.repuestos} kits. A repair adds 45 points and uses 1 kit, or 2 if the equipment is below 30%. Below ${UMBRAL_AVERIA}% the equipment stops.`
  }
  if (/escala|tiempo|acelera|rapido|lento|pausa|cuanto falta|reloj|time scale|timescale|\btime\b|speed|faster|slower|accelerat|pause|how long|clock/.test(t)) {
    return `The mission runs at ×${room.escala}. Each real second is ${room.escala >= 3600 ? `${room.escala / 3600} hour${room.escala === 3600 ? '' : 's'}` : room.escala >= 60 ? `${room.escala / 60} minute${room.escala === 60 ? '' : 's'}` : `${room.escala} second${room.escala === 1 ? '' : 's'}`} of mission time. Mission time: ${formatoMET(room.t)}. The Mission Commander sets the time scale. It drops to ×60 on its own if there is an emergency or someone is outside. There are ${Math.round(diasRestantes(room))} mission days left.`
  }
  if (/viaje|distancia|tierra|marte|llegar|trayect|senal|comunic|\btrip|distance|earth|mars|arriv|trajector|signal|communicat|journey|travel|delay/.test(t) && !sup) {
    const f = room.vuelo
    return `We are ${Math.round(f.progreso * 100)}% of the way through the ${room.mision.diasTransito}-day cruise. Earth is ${f.distTierra} million km away and Mars is ${f.distMarte} million km away. A signal takes ${Math.round(f.retardo / 60)} min ${f.retardo % 60} s to reach Earth, so urgent decisions are up to the crew. Propellant margin: ${Math.round(r.propelente)}%.`
  }
  if (/objetivo|mision|muestra|ganar|ciencia|meta|objective|goal|mission|sample|\bwin|science/.test(t)) {
    return `${room.mision.objetivo} ${sup ? `We are on sol ${a.sol} of ${room.mision.solesObjetivo}, at ${SITE_BY_ID[room.sitio ?? 'gale'].nombre}. ` : ''}Samples analyzed: ${room.mision.muestrasAnalizadas} of ${room.mision.muestrasObjetivo}. Profile: ${PERFIL_BY_ID[room.perfil].nombre}. ${riesgos(room)}`
  }
  if (/que hago|que debo|recomiend|consejo|ayuda|sugerenc|mi rol|que sigue|what should i|what do i do|what now|what next|next step|advice|advise|recommend|help|suggest|my role|\btips?\b/.test(t)) {
    return `As ${autor.rol ? ROLE_BY_ID[autor.rol].nombre : 'a crew member'}: ${porRol(room, autor)} ${riesgos(room)}`
  }
  if (/estado|resumen|como vamos|situacion|todo bien|status|summary|overview|how are we|how is it going|how are things|everything ok|situation|report/.test(t)) {
    return `${sup ? `Sol ${a.sol}, ${formatoHora(a.hora)}` : formatoMET(room.t)}. Air: ${n1(c.ppO2)} kPa of oxygen and ${n1(c.ppCO2 * 7.5)} mmHg of CO2. Water for ${dias(room.autonomia.agua)}, air for ${dias(room.autonomia.aire)}, food for ${dias(room.autonomia.comida)}. Power ${n1(e.generacion)} kW generated, ${n1(e.consumo)} kW used, batteries ${e.capacidad ? Math.round((e.bateria / e.capacidad) * 100) : 0}%. ${riesgos(room)}`
  }
  return `I checked the mission status. ${riesgos(room)} You can ask me about your pulse, how you are, your suit, oxygen, CO2, water, food, power, radiation, weather, equipment, the trip, the time scale, the objective, or what your role should do.`
}
