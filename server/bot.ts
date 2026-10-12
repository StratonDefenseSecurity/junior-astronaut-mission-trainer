// Chatbot por reglas: recibe la acción o pregunta, consulta el estado de la misión,
// evalúa según los datos encontrados y explica los riesgos.
import { MODULE_BY_ID, ROLE_BY_ID, type Player, type RoomState } from '../shared/types.js'

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

function horasRestantes(cantidad: number, consumoPorHora: number): string {
  if (consumoPorHora <= 0) return 'estable'
  const h = cantidad / consumoPorHora
  if (h > 48) return `más de ${Math.floor(h / 24)} soles`
  return `${Math.round(h)} h`
}

export function responderBot(room: RoomState, autor: Player, textoOriginal: string): string {
  const t = norm(textoOriginal)
  const r = room.recursos
  const n = Math.max(1, room.jugadores.filter((j) => j.rol).length)
  const factor = { normal: 1, ahorro: 0.8, estricto: 0.6 }[room.racion]
  const soporte = room.sistemas.find((s) => s.id === 'soporteVital')!
  const planta = room.sistemas.find((s) => s.id === 'energia')!
  const consumoAgua = 0.4 * n * factor * (room.reciclajeActivo && soporte.online ? 0.4 : 1)
  const consumoO2 = 0.5 * n * factor * (room.reciclajeActivo && soporte.online ? 0.5 : 1) * (soporte.online ? 1 : 2)
  const consumoComida = 0.25 * n * factor
  const rol = autor.rol ? ROLE_BY_ID[autor.rol].nombre : 'sin rol'

  if (room.fase === 'lobby') return 'Aún estamos en el lobby. Cuando todos elijan rol, el anfitrión puede iniciar la misión.'
  if (room.fase === 'contexto') {
    return `Estamos eligiendo el cargamento. Masa actual ${room.masa.toFixed(1)} t de 40 t. Mi evaluación: ${
      room.masa > 40 ? 'excede el máximo, hay que quitar carga.' : room.masa > 34 ? 'carga pesada, el combustible quedará justo.' : 'carga razonable.'
    } Recuerda que sin kits de semillas no habrá huerto y sin blindaje la radiación golpea fuerte.`
  }
  if (room.fase === 'lanzamiento') return `En tránsito a Marte, día ${room.mision.diasTransito} de 210. Combustible restante ${room.mision.combustible}%. Nada que decidir todavía.`
  if (room.fase === 'ensamblaje') {
    return `Misión de ensamblaje, paso ${room.ensamblaje.paso + 1} de 4. ${
      room.ensamblaje.paso === 0
        ? 'Sobre la ubicación: Jezero da agua pero menos luz; Utopia da luz pero nada de agua; el tubo de lava protege de la radiación pero reduce mucho la energía.'
        : 'Los roles responsables deben confirmar el paso para avanzar.'
    }`
  }
  if (room.fase === 'fin') return room.resultado?.motivo ?? 'La misión terminó.'

  // ---- Fase base: evaluar según intención ----
  const riesgos: string[] = []
  if (r.oxigeno < 60) riesgos.push(`oxígeno para ${horasRestantes(r.oxigeno, consumoO2)}`)
  if (r.agua < 60) riesgos.push(`agua para ${horasRestantes(r.agua, consumoAgua)}`)
  if (r.alimentos < 40) riesgos.push(`alimentos para ${horasRestantes(r.alimentos, consumoComida)}`)
  if (r.energia < 15) riesgos.push('energía crítica, de noche se apagarán módulos')
  if (!soporte.online) riesgos.push('soporte vital apagado: el oxígeno cae al doble')
  if (!planta.online) riesgos.push('planta de energía apagada')
  if (room.tormenta) riesgos.push(`tormenta solar activa, radiación ${room.radiacion.toFixed(1)}`)
  const enfermos = room.jugadores.filter((j) => j.rol && j.salud < 40)
  if (enfermos.length) riesgos.push(`salud crítica: ${enfermos.map((j) => j.nombre).join(', ')}`)
  const riesgosTxt = riesgos.length ? `Riesgos detectados: ${riesgos.join('; ')}.` : 'No detecto riesgos inmediatos.'

  if (/oxigeno|o2|respirar/.test(t)) {
    return `Oxígeno: ${Math.round(r.oxigeno)} unidades, consumo ${consumoO2.toFixed(2)}/h → alcanza ${horasRestantes(r.oxigeno, consumoO2)}. Soporte vital ${soporte.online ? 'en línea' : 'APAGADO'} (${Math.round(soporte.integridad)}%). ${
      room.reciclajeActivo ? 'El reciclaje está activo.' : 'Activar el reciclaje (propuesta de logística, comandante o médico) reduce el consumo a la mitad.'
    }`
  }
  if (/agua|hidrat|tanque/.test(t)) {
    return `Agua: ${Math.round(r.agua)} L, consumo ${consumoAgua.toFixed(2)} L/h → alcanza ${horasRestantes(r.agua, consumoAgua)}. ${
      room.huerto.establecido ? 'El huerto gasta 0.2 L/h adicionales.' : 'Avanzar el huerto cuesta 10 L por turno de trabajo.'
    } ${room.reciclajeActivo ? 'Reciclaje activo recupera el 60%.' : 'Sin reciclaje se pierde todo lo consumido.'}`
  }
  if (/comida|aliment|racion|hambre|huerto|invernadero/.test(t)) {
    return `Alimentos: ${Math.round(r.alimentos)} raciones, consumo ${consumoComida.toFixed(2)}/h → ${horasRestantes(r.alimentos, consumoComida)}. Ración actual: ${room.racion}. Huerto: ${
      room.huerto.establecido ? 'establecido, produce 0.25 raciones por tripulante y hora.' : `${room.huerto.progreso}% (lo avanza el científico con kits de semillas).`
    } Racionar en estricto ahorra 40% pero resta 0.4 de salud por hora.`
  }
  if (/energia|bateria|panel|solar|luz|noche/.test(t)) {
    const esDia = room.mision.hora >= 6 && room.mision.hora < 18
    return `Energía: ${Math.round(r.energia)} de ${room.capacidad.energia}. ${esDia ? 'Es de día, los paneles generan.' : 'Es de noche, la base vive de la batería.'} Planta ${planta.online ? 'en línea' : 'APAGADA'} al ${Math.round(planta.integridad)}%. Prioridad actual: ${MODULE_BY_ID[room.prioridadEnergia].nombre}. Si la batería llega a 0 se apagan todos los módulos salvo el prioritario.`
  }
  if (/radiacion|tormenta|refugio|blindaje|solar/.test(t)) {
    return `Radiación: ${room.radiacion.toFixed(2)} (umbral seguro 0.5). Blindaje ${room.blindaje} capas (-${Math.min(90, room.blindaje * 30)}%). ${
      room.tormenta ? 'Hay tormenta en curso: recomiendo refugio total si la salud de alguien está bajo 50.' : 'Sin tormenta. Durante una tormenta la dosis sube a 2.4 por hora.'
    } ${room.enRefugio ? 'La tripulación está en el refugio.' : ''}`
  }
  if (/reparar|equipo|modulo|mantenimiento|integridad|falla|fallo/.test(t)) {
    const peor = [...room.sistemas].sort((a, b) => a.integridad - b.integridad)[0]
    const apagados = room.sistemas.filter((s) => !s.online && s.id !== 'invernadero').map((s) => MODULE_BY_ID[s.id].nombre)
    return `Repuestos: ${r.repuestos} (cada reparación usa 2). Módulo más desgastado: ${MODULE_BY_ID[peor.id].nombre} al ${Math.round(peor.integridad)}%. ${
      apagados.length ? `Apagados: ${apagados.join(', ')}.` : 'Todos los módulos críticos están en línea.'
    } Por debajo de 25% un módulo puede apagarse solo en cualquier hora.`
  }
  if (/salud|enferm|medic|pulso|tripul/.test(t)) {
    const lista = room.jugadores.filter((j) => j.rol).map((j) => `${j.nombre} ${Math.round(j.salud)}`).join(', ')
    return `Salud de la tripulación: ${lista}. Botiquines: ${r.botiquines}. ${
      enfermos.length ? `${enfermos.map((j) => j.nombre).join(' y ')} necesitan revisión médica ya.` : 'Nadie está en zona crítica.'
    } La salud se recupera 0.3 por hora cuando no falta nada.`
  }
  if (/experimento|objetivo|ciencia|mision|cuanto falta|ganar/.test(t)) {
    return `Objetivo: ${room.mision.objetivo} Vamos en el sol ${room.mision.sol} de ${room.mision.solesObjetivo}, hora ${room.mision.hora}. Experimentos ${room.mision.experimentos}/${room.mision.experimentosObjetivo}. Cada experimento cuesta 6 de energía y lo ejecuta el científico. ${riesgosTxt}`
  }
  if (/que hago|que debo|recomienda|consejo|ayuda|sugerencia|mi rol/.test(t)) {
    const porRol: Record<string, string> = {
      comandante: 'Revisa las propuestas pendientes y aprueba las que reduzcan los riesgos listados. Si hay tormenta, propón el refugio con el médico.',
      piloto: 'Tu trabajo fuerte fue el aterrizaje. Ahora apoya en emergencias de paneles y ayuda a quien lo pida.',
      medico: 'Vigila el panel de tripulantes. Si alguien baja de 40 haz una revisión médica. Propón el refugio si la radiación supera 0.8.',
      logistica: 'Decide la ración según las horas restantes de cada recurso y propón activar el reciclaje si hay energía.',
      cientifico: 'Prioridad: establecer el huerto antes de que se acabe la comida y ejecutar los experimentos cuando haya energía de sobra.',
      sistemas: 'Repara el módulo más desgastado antes de que baje de 25% y fija la prioridad de energía en soporte vital de noche.',
    }
    return `Para tu rol (${rol}): ${porRol[autor.rol ?? ''] ?? 'elige un rol primero.'} ${riesgosTxt}`
  }
  if (/estado|resumen|como vamos|situacion/.test(t)) {
    return `Sol ${room.mision.sol}, hora ${room.mision.hora}. Agua ${Math.round(r.agua)} L, oxígeno ${Math.round(r.oxigeno)}, alimentos ${Math.round(r.alimentos)}, energía ${Math.round(r.energia)}, repuestos ${r.repuestos}. ${riesgosTxt}`
  }
  return `Recibí tu consulta "${textoOriginal.slice(0, 60)}". Consulté el estado de la misión: ${riesgosTxt} Pregúntame por oxígeno, agua, alimentos, energía, radiación, equipos, salud, objetivo o qué debe hacer tu rol.`
}
