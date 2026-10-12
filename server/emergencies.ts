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
    problema: 'Una válvula del depurador de CO2 se atascó. El CO2 que exhala la tripulación se acumula en la cabina: sin depurar, se supera el límite de 3 mmHg en un par de horas.',
    pasiva: { id: 'lioh', etiqueta: 'Instalar cartuchos de hidróxido de litio', consecuencia: 'Usa 2 cartuchos, que absorben 5.4 kg de CO2. El depurador sigue averiado.' },
  },
  oga: {
    problema: 'La pila de electrólisis del generador de oxígeno se apagó por una lectura anómala. El aire se mantiene con los tanques mientras duren.',
    pasiva: { id: 'nada', etiqueta: 'Seguir con los tanques de oxígeno', consecuencia: 'No gasta repuestos. La reserva de oxígeno baja 0.84 kg por persona y día.' },
  },
  wrs: {
    problema: 'Falló el destilador del reciclador de agua. El agua usada se acumula sin recuperarse.',
    pasiva: { id: 'nada', etiqueta: 'Dejarlo apagado', consecuencia: 'No gasta repuestos. Se pierde toda el agua que se use hasta repararlo.' },
  },
  termico: {
    problema: 'Una bomba del circuito térmico se detuvo. La temperatura de la cabina empezará a alejarse de los 22 °C.',
    pasiva: { id: 'nada', etiqueta: 'Dejarlo apagado', consecuencia: 'No gasta repuestos. La cabina se enfría en Marte o se calienta en el espacio.' },
  },
  energia: {
    problema: 'Un regulador de la planta de energía entró en modo seguro. La generación cae casi a cero y la base vive de las baterías.',
    pasiva: { id: 'nada', etiqueta: 'Esperar', consecuencia: 'No gasta repuestos. Cuando se agoten las baterías se apagan los equipos.' },
  },
  esclusa: {
    problema: 'El sello de la esclusa pierde presión. No se puede salir ni recargar los trajes hasta repararlo.',
    pasiva: { id: 'nada', etiqueta: 'Dejarla cerrada', consecuencia: 'No gasta repuestos. Nadie puede salir al exterior.' },
  },
  huerto: {
    problema: 'Las luces del huerto se apagaron por un fallo del controlador. Las plantas dejan de crecer.',
    pasiva: { id: 'nada', etiqueta: 'Dejarlo apagado', consecuencia: 'No gasta repuestos. El cultivo se detiene.' },
  },
  isru: {
    problema: 'La bomba del extractor de hielo se bloqueó. Deja de entrar agua nueva.',
    pasiva: { id: 'nada', etiqueta: 'Dejarlo apagado', consecuencia: 'No gasta repuestos. No se obtiene agua del subsuelo.' },
  },
}

const ESCASEZ: Record<string, { nombre: string; alternativas: EmergencyAlternative[] }> = {
  comida: {
    nombre: 'alimentos',
    alternativas: [
      { id: 'ahorro', etiqueta: 'Pasar a ración de ahorro (80%)', consecuencia: 'La comida dura un 25% más. La tripulación pierde reservas poco a poco.' },
      { id: 'estricto', etiqueta: 'Pasar a ración estricta (60%)', consecuencia: 'La comida dura un 67% más. Pasadas unas semanas la salud se resiente.' },
      { id: 'nada', etiqueta: 'Mantener la ración', consecuencia: 'Nada cambia. La comida puede acabarse antes de terminar la misión.' },
    ],
  },
  agua: {
    nombre: 'agua',
    alternativas: [
      { id: 'ahorro', etiqueta: 'Ahorro de agua', consecuencia: 'Se recorta la higiene al mínimo. No afecta a lo que bebe la tripulación.' },
      { id: 'ejercicio', etiqueta: 'Suspender el ejercicio', consecuencia: 'Se suda y se respira menos, así que se gasta menos agua y oxígeno. Se pierde músculo y hueso.' },
      { id: 'nada', etiqueta: 'Mantener el consumo', consecuencia: 'Nada cambia. El agua puede acabarse antes de terminar la misión.' },
    ],
  },
  aire: {
    nombre: 'oxígeno',
    alternativas: [
      { id: 'oga', etiqueta: 'Encender el generador de oxígeno', consecuencia: 'Produce oxígeno a partir del agua: 1.125 kg de agua por kg de oxígeno.' },
      { id: 'ejercicio', etiqueta: 'Suspender el ejercicio', consecuencia: 'El consumo de oxígeno baja cerca de un 25%. Se pierde músculo y hueso.' },
      { id: 'nada', etiqueta: 'Mantener el consumo', consecuencia: 'Nada cambia. El oxígeno puede acabarse antes de terminar la misión.' },
    ],
  },
}

export const DOLENCIAS = ['dolor lumbar', 'cálculo renal', 'congestión y dolor de cabeza', 'lesión en la mano', 'erupción en la piel', 'insomnio']

export const EMERGENCIAS: Record<string, Definicion> = {
  // Evento real de partículas solares (DONKI).
  particulas: {
    segundos: 90,
    roles: () => ['medico', 'comandante'],
    titulo: () => 'Tormenta de radiación solar',
    descripcion: (room, d) =>
      `Llega una tormenta de partículas del Sol, la que se registró el ${d.fecha}. ` +
      (enSuperficie(room)
        ? `La atmósfera de Marte frena buena parte, pero fuera del hábitat la dosis sube a unos ${Math.round(Number(d.tasa) * 0.15)} mSv por día durante ${d.horas} horas.`
        : `En la cabina la dosis sube a unos ${Math.round(Number(d.tasa) * 0.5)} mSv por día durante ${d.horas} horas. Lo normal en el viaje son ${C.GCR_CRUCERO_MSV_DIA}.`),
    fuente: (_room, d) => `NASA DONKI, evento ${d.id}`,
    alOcurrir: (room, d) => {
      room.ambiente.tormentaSolar = { id: String(d.id), fecha: String(d.fecha), tasa: Number(d.tasa), hasta: room.t + Number(d.horas) * 3600 }
    },
    alternativas: (room, d) => [
      { id: 'refugio', etiqueta: 'Toda la tripulación al refugio', consecuencia: `La dosis de la tormenta baja al ${reduccionRefugio(room)}%. Nadie trabaja ni repara durante ${d.horas} horas.` },
      { id: 'parcial', etiqueta: 'Refugio, salvo sistemas', consecuencia: 'Quien lleva los sistemas sigue en su puesto y recibe la dosis de cabina. El resto se protege.' },
      { id: 'seguir', etiqueta: 'Seguir trabajando', consecuencia: 'Todo sigue funcionando. Toda la tripulación recibe la dosis de cabina.' },
    ],
    aplicar: (room, _d, alt) => {
      const hasta = room.ambiente.tormentaSolar?.hasta ?? room.t
      if (alt === 'seguir') return 'La tripulación sigue en sus puestos y acumula dosis.'
      for (const j of tripulacion(room)) {
        if (alt === 'parcial' && j.rol === 'sistemas') continue
        j.zona = 'nave'
        j.enRefugio = true
        j.manual = null
      }
      room.refugioHasta = Math.max(room.refugioHasta, hasta)
      return alt === 'parcial' ? 'La tripulación se protege; quien lleva los sistemas recibe la dosis de cabina.' : 'Toda la tripulación está en el refugio.'
    },
  },

  fallo: {
    roles: (_room, d) => (d.sistema === 'wrs' ? ['sistemas', 'logistica'] : ['sistemas']),
    titulo: (_room, d) => `Avería: ${nombreSistema(d.sistema as SistemaId)}`,
    descripcion: (room, d) => `${FALLOS[d.sistema as SistemaId].problema} Quedan ${room.rec.repuestos} kits de repuestos.`,
    alOcurrir: (room, d) => {
      const s = sis(room, d.sistema as SistemaId)
      s.integridad = Math.min(s.integridad, 10)
      s.operativo = false
    },
    alternativas: (_room, d) => [
      { id: 'reparar', etiqueta: 'Reparar con repuestos', consecuencia: 'Usa 2 kits. El equipo vuelve al 85%.' },
      { id: 'reinicio', etiqueta: 'Reinicio de emergencia', consecuencia: 'No gasta repuestos. Mitad de probabilidad de que vuelva al 45%; si falla, queda inservible hasta repararlo.' },
      FALLOS[d.sistema as SistemaId].pasiva,
    ],
    aplicar: (room, d, alt) => {
      const s = sis(room, d.sistema as SistemaId)
      const nombre = SISTEMA_BY_ID[s.id].nombre
      if (alt === 'reparar') {
        if (room.rec.repuestos < 2) return `No había repuestos suficientes. ${nombre} sigue averiado.`
        room.rec.repuestos -= 2
        s.integridad = 85
        s.activo = true
        return `${nombre} reparado y en marcha.`
      }
      if (alt === 'reinicio') {
        if (azar(room) < 0.5) {
          s.integridad = 45
          s.activo = true
          return `El reinicio funcionó. ${nombre} vuelve al 45%.`
        }
        s.integridad = 3
        return `El reinicio falló. ${nombre} queda inservible hasta que se repare.`
      }
      if (alt === 'lioh') {
        const usados = Math.min(2, room.rec.lioh)
        if (usados === 0) return 'No quedaban cartuchos. El CO2 sigue subiendo.'
        room.rec.lioh -= usados
        room.rec.liohActivo += usados * C.LIOH_KG_CO2
        return `Se instalaron ${usados} cartuchos. El depurador sigue averiado.`
      }
      return `${nombre} sigue averiado.`
    },
  },

  fuga: {
    roles: () => ['sistemas', 'comandante'],
    titulo: () => 'Fuga de presión',
    descripcion: () => 'Un impacto pequeño perforó el casco. La cabina pierde 1.5 kg de aire por hora y el oxígeno se repone desde las reservas.',
    alOcurrir: (room) => {
      room.cabina.fuga = 1.5
    },
    alternativas: () => [
      { id: 'sellar', etiqueta: 'Sellar con un kit de reparación', consecuencia: 'Usa 1 kit. La fuga se detiene.' },
      { id: 'aislar', etiqueta: 'Cerrar la sección dañada', consecuencia: 'La fuga se detiene sin gastar repuestos, pero se pierde el 6% del agua y la comida guardadas allí.' },
      { id: 'nada', etiqueta: 'Compensar con las reservas', consecuencia: 'La fuga sigue hasta que sistemas la selle. Cada hora se pierde aire.' },
    ],
    aplicar: (room, _d, alt) => {
      if (alt === 'sellar') {
        if (room.rec.repuestos < 1) return 'No quedaban repuestos. La fuga continúa.'
        room.rec.repuestos -= 1
        room.cabina.fuga = 0
        return 'Fuga sellada.'
      }
      if (alt === 'aislar') {
        room.cabina.fuga = 0
        room.rec.agua *= 0.94
        room.rec.comida *= 0.94
        return 'Sección cerrada. Se perdió parte del agua y la comida.'
      }
      return 'La fuga continúa.'
    },
  },

  polvo: {
    roles: () => ['logistica', 'comandante'],
    titulo: () => 'Tormenta de polvo',
    descripcion: (room, d) =>
      `Se acerca una tormenta de polvo. La opacidad del cielo sube a ${d.tau} y la energía solar cae al ${Math.round(Math.exp(-0.35 * (Number(d.tau) - 0.5)) * 100)}% durante unos ${d.soles} soles. El polvo también se deposita sobre los paneles.` +
      (room.cargamento.reactor > 0 ? ' El reactor no se ve afectado.' : ''),
    alternativas: () => [
      { id: 'ahorro', etiqueta: 'Modo ahorro', consecuencia: 'Se apagan el huerto y el extractor de hielo. La energía se reserva para el aire y el calor.' },
      { id: 'limpiar', etiqueta: 'Mantener todo y limpiar paneles', consecuencia: 'Nada se apaga. Alguien debe salir a limpiar los paneles cada sol, con poca visibilidad.' },
      { id: 'nada', etiqueta: 'Seguir igual', consecuencia: 'Nada cambia. Si las baterías se agotan, los equipos se apagan solos.' },
    ],
    aplicar: (room, _d, alt) => {
      if (alt === 'ahorro') {
        sis(room, 'huerto').activo = false
        sis(room, 'isru').activo = false
        room.ajustes.prioridad = 'vida'
        return 'Modo ahorro activado: huerto y extractor apagados.'
      }
      return alt === 'limpiar' ? 'Se mantiene todo encendido. Hay que limpiar los paneles.' : 'Sin cambios.'
    },
  },

  medico: {
    roles: () => ['medico'],
    titulo: (_room, d) => `Problema médico: ${d.dolencia}`,
    descripcion: (room, d) => `${d.nombre} presenta ${d.dolencia}. Quedan ${room.rec.botiquines} botiquines.`,
    alOcurrir: (room, d) => {
      const j = jugador(room, String(d.jugadorId))
      if (j) {
        j.dolencia = String(d.dolencia)
        j.dolenciaHasta = room.t + 8 * 86400
      }
    },
    alternativas: () => [
      { id: 'tratar', etiqueta: 'Tratar con un botiquín', consecuencia: 'Usa 1 botiquín. Se recupera y sigue trabajando.' },
      { id: 'reposo', etiqueta: 'Reposo de 12 horas', consecuencia: 'No gasta botiquín. Queda fuera de servicio medio día.' },
      { id: 'nada', etiqueta: 'Que siga trabajando', consecuencia: 'Pierde salud y la dolencia continúa hasta que el médico la trate.' },
    ],
    aplicar: (room, d, alt) => {
      const j = jugador(room, String(d.jugadorId))
      if (!j) return 'Sin paciente.'
      if (alt === 'tratar') {
        if (room.rec.botiquines < 1) {
          j.incapacitado = 12 * 3600
          j.dolencia = null
          return `No quedaban botiquines. ${j.nombre} queda en reposo 12 horas.`
        }
        room.rec.botiquines -= 1
        j.dolencia = null
        j.vit.salud = limitar(j.vit.salud + 5, 0, 100)
        return `${j.nombre} recibió tratamiento y sigue en servicio.`
      }
      if (alt === 'reposo') {
        j.incapacitado = 12 * 3600
        j.dolencia = null
        return `${j.nombre} queda en reposo 12 horas.`
      }
      j.vit.salud = limitar(j.vit.salud - 12, 0, 100)
      return `${j.nombre} sigue trabajando con ${d.dolencia}.`
    },
  },

  mareo: {
    roles: () => ['medico'],
    titulo: () => 'Mareo espacial',
    descripcion: (_room, d) => `${d.nombre} tiene náuseas y desorientación. Le ocurre a más de la mitad de los astronautas en sus primeros días sin gravedad.`,
    alOcurrir: (room, d) => {
      const j = jugador(room, String(d.jugadorId))
      if (j) {
        j.dolencia = 'mareo espacial'
        j.dolenciaHasta = room.t + 3 * 86400
      }
    },
    alternativas: () => [
      { id: 'tratar', etiqueta: 'Medicación contra el mareo', consecuencia: 'Usa 1 botiquín. Se recupera en poco tiempo.' },
      { id: 'reposo', etiqueta: 'Reposo de 12 horas', consecuencia: 'No gasta botiquín. El cuerpo se adapta solo, pero queda fuera de servicio.' },
      { id: 'nada', etiqueta: 'Que siga trabajando', consecuencia: 'Pierde salud y el mareo sigue hasta recibir tratamiento.' },
    ],
    aplicar: (room, d, alt) => EMERGENCIAS.medico.aplicar(room, { ...d, dolencia: 'mareo espacial' }, alt),
  },

  escasez: {
    roles: () => ['logistica', 'comandante'],
    titulo: (_room, d) => `Escasez de ${ESCASEZ[String(d.recurso)].nombre}`,
    descripcion: (_room, d) =>
      `Al ritmo actual, las reservas de ${ESCASEZ[String(d.recurso)].nombre} alcanzan para ${d.dias} días y la misión necesita ${d.necesarios}.`,
    alternativas: (_room, d) => ESCASEZ[String(d.recurso)].alternativas,
    aplicar: (room, d, alt) => {
      if (alt === 'ahorro' && d.recurso === 'comida') {
        room.ajustes.racionComida = 'ahorro'
        return 'Ración de ahorro activada.'
      }
      if (alt === 'estricto') {
        room.ajustes.racionComida = 'estricto'
        return 'Ración estricta activada.'
      }
      if (alt === 'ahorro') {
        room.ajustes.racionAgua = 'ahorro'
        return 'Ahorro de agua activado.'
      }
      if (alt === 'ejercicio') {
        room.ajustes.ejercicio = 0
        return 'Ejercicio suspendido.'
      }
      if (alt === 'oga') {
        const oga = sis(room, 'oga')
        oga.activo = true
        return oga.integridad > UMBRAL_AVERIA ? 'Generador de oxígeno encendido.' : 'El generador está averiado: hay que repararlo primero.'
      }
      return 'Sin cambios.'
    },
  },

  correccion: {
    roles: () => ['piloto', 'comandante'],
    titulo: () => 'Corrección de trayectoria',
    descripcion: (room) =>
      `La navegación indica una desviación respecto al punto de entrada en Marte. Margen de propelente: ${Math.round(room.rec.propelente)}%. La señal a la Tierra tarda ${Math.round(room.vuelo.retardo / 60)} minutos: la decisión es de la tripulación.`,
    alternativas: () => [
      { id: 'ahora', etiqueta: 'Corregir ahora', consecuencia: 'Gasta 3% de propelente. Cuanto antes se corrige, menos cuesta.' },
      { id: 'tarde', etiqueta: 'Corregir en la aproximación', consecuencia: 'Gasta 9% de propelente más adelante.' },
      { id: 'nada', etiqueta: 'No corregir', consecuencia: 'No gasta propelente. El aterrizaje será impreciso y más duro para los equipos.' },
    ],
    aplicar: (room, _d, alt) => {
      if (alt === 'ahora') {
        room.rec.propelente = Math.max(0, room.rec.propelente - 3)
        return 'Maniobra hecha. Trayectoria nominal.'
      }
      if (alt === 'tarde') {
        room.rec.propelente = Math.max(0, room.rec.propelente - 9)
        return 'La maniobra se hará en la aproximación.'
      }
      room.avisos.desvio = (room.avisos.desvio ?? 0) + 1
      return 'La nave sigue desviada.'
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
  log(room, `ALERTA: ${em.titulo}.`, 'alerta')
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
  return EMERGENCIAS[em.tipo]?.aplicar(room, em.datos, alt) ?? 'Sin efecto.'
}
