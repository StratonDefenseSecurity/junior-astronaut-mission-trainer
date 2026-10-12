// Asistente de misión por reglas: recibe la consulta, mira el estado real de la sala,
// evalúa los datos y explica los riesgos. No usa servicios externos.
import { C } from '../shared/ciencia.js'
import { PERFIL_BY_ID, ROLE_BY_ID, SISTEMA_BY_ID, SITE_BY_ID, formatoHora, formatoMET, type Player, type RoomState } from '../shared/types.js'
import { rendimiento, sis, tripulacion } from './base.js'
import { UMBRAL_AVERIA } from './emergencies.js'
import { enSuperficie, tasaDeDosis } from './sim/ambiente.js'
import { FC_MAXIMA } from './sim/fisiologia.js'
import { diasRestantes } from './sim/paso.js'

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const dias = (d: number) => (d >= 999 ? 'de sobra' : `${Math.round(d)} días`)
const n1 = (v: number) => v.toFixed(1)

function riesgos(room: RoomState): string {
  return room.puntosCriticos.length ? `Puntos críticos ahora: ${room.puntosCriticos.join('; ')}.` : 'No detecto riesgos inmediatos.'
}

function porRol(room: RoomState, j: Player): string {
  const sup = enSuperficie(room)
  switch (j.rol) {
    case 'comandante': {
      const p = room.propuestas.filter((x) => x.estado === 'pendiente').length
      return p
        ? `Tienes ${p} propuesta(s) esperando tu decisión. Lee la consecuencia antes de aprobar.`
        : 'Controla la escala de tiempo: acelera cuando todo esté estable y baja la velocidad antes de una tarea delicada. Vigila los puntos críticos.'
    }
    case 'piloto':
      return room.fase === 'transito'
        ? 'Corrige la trayectoria en cuanto se pida: cuanto antes, menos propelente cuesta. Al llegar, propón el sitio de aterrizaje.'
        : sup
          ? 'Ayuda fuera: despliega equipos y limpia los paneles cuando acumulen polvo. Vigila el oxígeno del traje.'
          : 'Prepárate para proponer el sitio de aterrizaje desde la órbita.'
    case 'medico': {
      const peor = [...tripulacion(room)].sort((a, b) => a.vit.salud - b.vit.salud)[0]
      return `Revisa los signos de cada integrante. ${peor && peor.vit.salud < 80 ? `${peor.nombre} tiene la salud en ${Math.round(peor.vit.salud)}: trátalo en la enfermería. ` : ''}El plan de ejercicio actual es de ${room.ajustes.ejercicio} h al día; en la ISS hacen ${C.EJERCICIO_ISS_H}.`
    }
    case 'logistica':
      return `Compara cuántos días alcanza cada reserva con los ${Math.round(diasRestantes(room))} que faltan. Agua: ${dias(room.autonomia.agua)}. Aire: ${dias(room.autonomia.aire)}. Comida: ${dias(room.autonomia.comida)}. Si algo no alcanza, propón racionar.`
    case 'cientifico':
      return room.fase === 'base'
        ? `Van ${room.mision.muestrasAnalizadas} de ${room.mision.muestrasObjetivo} muestras. Sal con el traje, recoge en los puntos marcados y analiza en el laboratorio.`
        : room.cargamento.huerto > 0 && !room.huerto.establecido
          ? `Puedes ir montando el huerto en el laboratorio durante el viaje. Va en ${room.huerto.progreso}%.`
          : 'Prepara el plan de muestreo para cuando la base esté operativa.'
    case 'sistemas': {
      const peor = [...room.sistemas].filter((s) => s.instalado).sort((a, b) => a.integridad - b.integridad)[0]
      return `El equipo más gastado es ${SISTEMA_BY_ID[peor.id].nombre.toLowerCase()} (${Math.round(peor.integridad)}%). Por debajo de ${UMBRAL_AVERIA}% deja de funcionar. Quedan ${room.rec.repuestos} kits; hay que ir hasta el equipo para repararlo.`
    }
    default:
      return 'Elige un rol para recibir consejos.'
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

  if (room.fase === 'lobby') return 'Estamos en el lobby. Cuando todos elijan rol y traje, quien creó la sala puede iniciar la misión.'

  if (room.fase === 'contexto') {
    const viaje = room.mision.diasTransito
    const estancia = (room.mision.solesObjetivo * C.SOL_S) / 86400
    const total = viaje + estancia
    const carga = room.cargamento
    const comida = (carga.alimentos * 100) / (n * C.COMIDA_KG_DIA)
    const aguaDia = n * (3.2 * 0.07 + 0.84 * C.OGA_AGUA_POR_O2)
    const agua = (carga.agua * 100) / aguaDia
    const dosis = viaje * C.GCR_CRUCERO_MSV_DIA + estancia * C.GCR_SUPERFICIE_MSV_DIA
    if (/radiac|dosis|blindaje/.test(t)) {
      return `Solo por rayos cósmicos, cada tripulante recibirá unos ${Math.round(dosis)} mSv en ${Math.round(total)} días (${C.GCR_CRUCERO_MSV_DIA} mSv/día en el viaje y ${C.GCR_SUPERFICIE_MSV_DIA} en Marte). El límite de carrera de NASA es ${C.LIMITE_CARRERA_MSV} mSv. Las tormentas solares suman más: el refugio blindado es lo que las reduce.`
    }
    if (/energia|panel|bateria|reactor/.test(t)) {
      return `De noche en Marte la base necesita unos 8 kW durante más de 12 horas: cerca de 100 kWh. Llevan ${carga.baterias} batería(s) de 100 kWh y ${carga.paneles} campo(s) solar(es) de 7 kW al mediodía. El reactor da 10 kW continuos y no le afecta el polvo.`
    }
    return `Tripulación de ${n}, viaje de ${viaje} días más ${room.mision.solesObjetivo} soles: ${Math.round(total)} días en total. Con la carga actual la comida alcanza para ${Math.round(comida)} días y el agua para unos ${Math.round(agua)} (reciclando al 98% y fabricando el oxígeno con ella). Masa: ${room.masa.toFixed(1)} de ${room.capacidad.toFixed(1)} t${room.masa > room.capacidad ? ', excede el máximo' : ''}. Pregúntame por radiación o energía.`
  }

  if (room.fase === 'fin') return room.resultado?.motivo ?? 'La misión terminó.'

  // ---- Consultas durante la misión ----
  if (/pulso|corazon|cardiac|latido/.test(t)) {
    const causas: string[] = []
    if (autor.actividad === 'eva') causas.push('trabajas con el traje')
    if (autor.actividad === 'ejercicio') causas.push('estás haciendo ejercicio')
    if (room.vuelo.g > 1.5) causas.push(`soportas ${room.vuelo.g} g`)
    if (v.spo2 < 94) causas.push('tu oxígeno en sangre está bajo')
    if (c.ppCO2 > C.PPCO2_LIMITE_KPA) causas.push('hay CO2 alto en la cabina')
    if (autor.deficitAgua > 0.5) causas.push('te falta agua')
    if (v.fatiga > 70) causas.push('estás muy cansado')
    return `Tu pulso es de ${Math.round(v.fc)} latidos por minuto y respiras ${Math.round(v.fr)} veces por minuto. Tu máximo teórico es ${Math.round(FC_MAXIMA)} (208 − 0.7 × edad). ${causas.length ? `Sube porque ${causas.join(', ')}.` : 'Está en un rango normal para lo que haces.'}`
  }
  if (/mi estado|como estoy|mis signos|mi salud|me siento|mi cuerpo/.test(t)) {
    return `Salud ${Math.round(v.salud)}. Pulso ${Math.round(v.fc)}, respiración ${Math.round(v.fr)}, oxígeno en sangre ${Math.round(v.spo2)}%. Hidratación ${Math.round(v.hidratacion)}%, reservas de energía ${Math.round(v.reservas)}%, fatiga ${Math.round(v.fatiga)}%. Músculo y hueso al ${Math.round(v.condicion)}%. Dosis acumulada ${n1(v.dosis)} mSv de ${C.LIMITE_CARRERA_MSV}.${autor.dolencia ? ` Tienes ${autor.dolencia}: ve con el médico.` : ''}`
  }
  if (/traje|eva|salir|exterior|esclusa/.test(t)) {
    const o2 = Math.round((autor.trajeO2 / C.TRAJE_O2_KG) * 100)
    return `Tu traje tiene ${o2}% de oxígeno y ${Math.round(autor.trajeBateria * 100)}% de batería. Lleno dura entre 7 y ${C.TRAJE_BATERIA_H} horas de trabajo. Funciona con oxígeno puro a ${C.TRAJE_PRESION_KPA} kPa. ${sup ? `Fuera hay ${a.tempExt} °C y ${a.presion} Pa, menos del 1% de la presión de la Tierra. Con alguien fuera la escala de tiempo no pasa de ×60.` : 'Solo se puede salir cuando la nave esté en Marte.'} La esclusa lo recarga al volver.`
  }
  if (/co2|dioxido|depurador|lioh|hidroxido/.test(t)) {
    const mmHg = c.ppCO2 * 7.5
    const cdra = sis(room, 'cdra')
    return `CO2 en cabina: ${n1(mmHg)} mmHg. El límite de NASA es 3; en el juego, por encima de 15 daña la salud. Depurador ${cdra.operativo ? `en marcha al ${Math.round(cdra.integridad)}%` : 'DETENIDO'}. La tripulación produce ${n1(n * 1.0)} kg de CO2 al día. Cartuchos de reserva: ${r.lioh} (cada uno absorbe ${C.LIOH_KG_CO2} kg).`
  }
  if (/oxigeno|o2|aire|respir|asfix/.test(t)) {
    const oga = sis(room, 'oga')
    return `Oxígeno en cabina: ${n1(c.ppO2)} kPa (lo normal es ${C.PPO2_NOMINAL_KPA}; por debajo de ${C.PPO2_MINIMA_KPA} empieza la hipoxia). Tu sangre está al ${Math.round(v.spo2)}%. Generador ${oga.operativo ? `en marcha al ${Math.round(oga.integridad)}%` : 'detenido'}; tanques con ${Math.round(r.o2)} kg. La tripulación consume ${n1(n * 0.84)} kg al día. Alcanza para ${dias(room.autonomia.aire)}.`
  }
  if (/agua|hidrat|sed|recicl/.test(t)) {
    const wrs = sis(room, 'wrs')
    return `Agua potable: ${Math.round(r.agua)} kg, más ${Math.round(r.aguaResidual)} kg usados esperando reciclaje. Reciclador ${wrs.operativo ? `en marcha: recupera el ${Math.round((0.9 + (C.WRS_EFICIENCIA - 0.9) * rendimiento(wrs.integridad)) * 100)}%` : 'DETENIDO: se pierde toda el agua usada'}. Cada persona usa unos 3.2 kg al día y el generador de oxígeno gasta ${C.OGA_AGUA_POR_O2} kg por kg de oxígeno. Alcanza para ${dias(room.autonomia.agua)}; faltan ${Math.round(diasRestantes(room))} días de misión.`
  }
  if (/comida|aliment|racion|hambre|huerto|cosecha/.test(t)) {
    const h = room.huerto
    return `Alimentos: ${Math.round(r.comida)} kg. Ración ${room.ajustes.racionComida}: ${n1(n * C.COMIDA_KG_DIA * { normal: 1, ahorro: 0.8, estricto: 0.6 }[room.ajustes.racionComida])} kg al día. Alcanza para ${dias(room.autonomia.comida)}; faltan ${Math.round(diasRestantes(room))}. Tus reservas están al ${Math.round(v.reservas)}%. Huerto: ${h.establecido ? `establecido, próxima cosecha en ${Math.round(28 - h.diasCultivo)} días` : room.cargamento.huerto ? `${h.progreso}% montado` : 'no trajeron el kit'}.`
  }
  if (/energia|bateria|panel|solar|reactor|electric|luz/.test(t)) {
    const pct = e.capacidad ? Math.round((e.bateria / e.capacidad) * 100) : 0
    return `Generación ${n1(e.generacion)} kW, consumo ${n1(e.consumo)} kW, baterías al ${pct}% (${Math.round(e.bateria)} de ${e.capacidad} kWh). ${sup ? `Son las ${formatoHora(a.hora)}; opacidad del polvo ${a.tau}; polvo sobre los paneles −${Math.round(e.polvo * 100)}%.` : 'En el espacio los paneles reciben luz todo el tiempo.'} ${e.cortes.length ? `Sin energía: ${e.cortes.map((id) => SISTEMA_BY_ID[id].nombre.toLowerCase()).join(', ')}.` : ''} Prioridad si falta energía: ${room.ajustes.prioridad}.`
  }
  if (/radiac|dosis|tormenta solar|refugio|blindaje|fulgur|particul/.test(t)) {
    const cabina = tasaDeDosis(room, 'nave', false)
    const refugio = tasaDeDosis(room, 'nave', true)
    return `Ahora recibes ${n1(v.dosisTasa)} mSv por día y llevas ${n1(v.dosis)} mSv; el límite de carrera de NASA es ${C.LIMITE_CARRERA_MSV}. En la cabina son ${n1(cabina)} mSv/día y en el refugio ${n1(refugio)}. ${a.tormentaSolar ? `Hay una tormenta solar activa (la del ${a.tormentaSolar.fecha}).` : 'No hay tormenta solar.'} El refugio tiene ${room.blindaje} capa(s) de blindaje. Los rayos cósmicos casi no se frenan; las partículas del Sol sí.`
  }
  if (/clima|temperatura|frio|calor|polvo|viento|presion|tiempo hace|afuera/.test(t)) {
    if (!sup) return `Estamos en el espacio: fuera no hay aire. La cabina está a ${n1(c.temp)} °C. Llegan ${a.flujoSolar} W/m² de luz solar; en la órbita de la Tierra son ${C.IRRADIANCIA_TIERRA} y en la de Marte ${C.IRRADIANCIA_MARTE}.`
    return `Sol ${a.sol}, ${formatoHora(a.hora)} hora local. Fuera hay ${a.tempExt} °C y ${a.presion} Pa. Son los datos que midió Curiosity en su sol ${a.solCuriosity}${room.sitio !== 'gale' ? ', con un ajuste estimado para este sitio' : ''}. Opacidad del polvo ${a.tau}${a.tormentaPolvo ? `, hay tormenta de polvo para ${a.polvoSoles} soles más` : ''}. La cabina está a ${n1(c.temp)} °C.`
  }
  if (/equipo|reparar|averia|mantenim|integridad|repuesto|sistema/.test(t)) {
    const lista = room.sistemas.filter((s) => s.instalado).map((s) => `${SISTEMA_BY_ID[s.id].nombre.toLowerCase()} ${Math.round(s.integridad)}%${s.integridad <= UMBRAL_AVERIA ? ' (averiado)' : !s.activo ? ' (apagado)' : ''}`)
    return `Equipos: ${lista.join(', ')}. Repuestos: ${r.repuestos} kits. Una reparación sube 45 puntos y usa 1 kit, o 2 si el equipo está por debajo de 30%. Por debajo de ${UMBRAL_AVERIA}% el equipo se detiene.`
  }
  if (/escala|tiempo|acelera|rapido|lento|pausa|cuanto falta|reloj/.test(t)) {
    return `La misión corre a ×${room.escala}: cada segundo real son ${room.escala >= 3600 ? `${room.escala / 3600} hora(s)` : room.escala >= 60 ? `${room.escala / 60} minuto(s)` : `${room.escala} segundo(s)`} de misión. Tiempo de misión: ${formatoMET(room.t)}. La escala la fija el comandante; baja sola a ×60 si hay una emergencia o alguien está fuera. Faltan ${Math.round(diasRestantes(room))} días de misión.`
  }
  if (/viaje|distancia|tierra|marte|llegar|trayect|senal|comunic/.test(t) && !sup) {
    const f = room.vuelo
    return `Vamos por el ${Math.round(f.progreso * 100)}% del viaje de ${room.mision.diasTransito} días. La Tierra está a ${f.distTierra} millones de km y Marte a ${f.distMarte}. Una señal tarda ${Math.round(f.retardo / 60)} min ${f.retardo % 60} s en llegar a la Tierra, por eso las decisiones urgentes son de la tripulación. Margen de propelente: ${Math.round(r.propelente)}%.`
  }
  if (/objetivo|mision|muestra|ganar|ciencia|meta/.test(t)) {
    return `${room.mision.objetivo} ${sup ? `Vamos en el sol ${a.sol} de ${room.mision.solesObjetivo}, en ${SITE_BY_ID[room.sitio ?? 'gale'].nombre}. ` : ''}Muestras analizadas: ${room.mision.muestrasAnalizadas} de ${room.mision.muestrasObjetivo}. Perfil: ${PERFIL_BY_ID[room.perfil].nombre}. ${riesgos(room)}`
  }
  if (/que hago|que debo|recomiend|consejo|ayuda|sugerenc|mi rol|que sigue/.test(t)) {
    return `Como ${autor.rol ? ROLE_BY_ID[autor.rol].nombre : 'tripulante'}: ${porRol(room, autor)} ${riesgos(room)}`
  }
  if (/estado|resumen|como vamos|situacion|todo bien/.test(t)) {
    return `${sup ? `Sol ${a.sol}, ${formatoHora(a.hora)}` : formatoMET(room.t)}. Aire: ${n1(c.ppO2)} kPa de oxígeno y ${n1(c.ppCO2 * 7.5)} mmHg de CO2. Agua para ${dias(room.autonomia.agua)}, aire para ${dias(room.autonomia.aire)}, comida para ${dias(room.autonomia.comida)}. Energía ${n1(e.generacion)} de ${n1(e.consumo)} kW, baterías ${e.capacidad ? Math.round((e.bateria / e.capacidad) * 100) : 0}%. ${riesgos(room)}`
  }
  return `Revisé el estado de la misión. ${riesgos(room)} Puedes preguntarme por tu pulso, tu estado, el traje, oxígeno, CO2, agua, comida, energía, radiación, clima, equipos, el viaje, la escala de tiempo, el objetivo o qué debe hacer tu rol.`
}
