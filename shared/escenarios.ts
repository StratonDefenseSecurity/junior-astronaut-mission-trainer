// Situaciones de misión. La contextualización empieza dándole a la tripulación una de ellas:
// cada una tiene una fecha de lanzamiento real, un contexto verídico, un reto propio y
// sucesos que la hacen distinta. La fecha decide dónde están los planetas, qué estación hay
// en Marte al llegar (y por tanto el clima de Curiosity que se usa) y qué se ve por la ventana.
//
// Regla de verdad: los "hechos" son datos comprobables; los multiplicadores de `mod` y los
// objetivos extra son decisiones de diseño del juego y se muestran como supuestos.
import type { Loadout } from './types.js'

export type EscenarioId = 'primeraBase' | 'maximoSolar' | 'tormentaPolvo' | 'hieloUtopia' | 'vidaJezero' | 'averiaViaje'

export interface DatoEscenario {
  etiqueta: string
  valor: string
  texto: string
}

/** Un suceso preparado de antemano. En el viaje se mide en fracción del trayecto; en Marte, en soles. */
export interface SucesoGuion {
  viaje?: number
  sol?: number
  tipo: 'fuga' | 'fallo' | 'polvo' | 'medico'
  datos?: Record<string, unknown>
}

export interface Escenario {
  id: EscenarioId
  nombre: string
  lema: string
  /** Fecha de despegue (UTC), en una ventana de lanzamiento real calculada con efemérides. */
  lanzamiento: string
  ventana: string
  /** Lo que se le cuenta a la tripulación, en dos o tres párrafos cortos. */
  situacion: string[]
  hechos: DatoEscenario[]
  reto: string
  /** Sitio de aterrizaje obligado por la misión. */
  sitio?: 'gale' | 'jezero' | 'utopia'
  objetivo?: { muestrasExtra?: number; aguaPorSol?: number }
  /** Consejo del asistente para elegir los suministros de esta misión. */
  consejo?: string
  /** Suministros que la misión necesita sí o sí. */
  cargaMinima?: Partial<Loadout>
  /** Multiplicadores del juego (1 = lo normal). */
  mod: { particulas: number; gcr: number; polvo: number; desgaste: number }
  supuestos: string[]
  guion: SucesoGuion[]
  /** Día del año 2024 desde el que se reproducen las tormentas solares reales de DONKI. */
  diaClimaEspacial?: number
}

export const ESCENARIOS: Escenario[] = [
  {
    id: 'primeraBase',
    nombre: 'Primera base en Marte',
    lema: 'Ser los primeros en vivir en otro planeta.',
    lanzamiento: '2026-12-05T14:00:00Z',
    ventana: 'diciembre de 2026',
    situacion: [
      'El centro de control los eligió para la misión que montará la primera base habitada en Marte. Despegan en la ventana de diciembre de 2026, cuando la Tierra y Marte quedan en la posición que permite el viaje con menos combustible.',
      'Será la primera vez que una tripulación viva en la superficie de otro planeta. Lo que no lleven, no lo tendrán.',
    ],
    hechos: [
      { etiqueta: 'Ventana de lanzamiento', valor: 'cada 26 meses', texto: 'La Tierra y Marte vuelven a quedar alineados para el viaje más económico aproximadamente cada 26 meses.' },
    ],
    reto: 'Llegar, montar la base y cumplir el objetivo sin que nadie enferme.',
    mod: { particulas: 0.8, gcr: 1, polvo: 1, desgaste: 1 },
    supuestos: ['La actividad solar se rebaja un 20% respecto a 2024 porque el ciclo solar va en descenso.'],
    guion: [],
  },
  {
    id: 'maximoSolar',
    nombre: 'El Sol en su máximo',
    lema: 'Un viaje en pleno máximo de actividad solar.',
    lanzamiento: '2024-10-25T14:00:00Z',
    ventana: 'octubre de 2024',
    situacion: [
      'Es una simulación de la ventana de octubre de 2024, con el Sol en lo más alto de su ciclo de actividad. Las tormentas de partículas que van a encontrar son las que registró la NASA desde ese mismo día.',
      'Una tormenta solar fuerte puede dar en pocas horas tanta dosis como varias semanas de rayos cósmicos. El refugio y el blindaje van a ser decisivos.',
    ],
    hechos: [
      { etiqueta: 'Máximo solar', valor: 'octubre de 2024', texto: 'La NASA y la NOAA anunciaron en octubre de 2024 que el Sol había llegado al máximo de su ciclo de actividad.' },
      { etiqueta: 'Menos rayos cósmicos', valor: 'con el Sol activo', texto: 'Cuando el Sol está activo, su viento desvía parte de los rayos cósmicos que llegan de fuera del sistema solar.' },
    ],
    reto: 'Proteger a la tripulación de las tormentas solares sin descuidar el resto.',
    consejo: 'Cada capa de blindaje en el refugio reduce la dosis de las tormentas solares.',
    mod: { particulas: 1.4, gcr: 0.9, polvo: 1, desgaste: 1 },
    supuestos: [
      'Las tormentas solares son más frecuentes que en las otras misiones y los rayos cósmicos bajan un 10%: es una estimación del juego.',
    ],
    guion: [],
    diaClimaEspacial: 299,
  },
  {
    id: 'tormentaPolvo',
    nombre: 'Temporada de tormentas',
    lema: 'Llegarán cuando el polvo cubre el cielo de Marte.',
    lanzamiento: '2031-02-10T14:00:00Z',
    ventana: 'febrero de 2031',
    situacion: [
      'Despegan en la ventana de febrero de 2031 y llegarán a Marte en su temporada de polvo: la primavera y el verano del hemisferio sur, cuando el planeta pasa más cerca del Sol.',
      'En 2018 una tormenta cubrió todo el planeta durante semanas. El rover Opportunity, que funcionaba con paneles solares, se quedó sin energía y no volvió a comunicarse.',
    ],
    hechos: [
      { etiqueta: 'Opportunity', valor: '10 de junio de 2018', texto: 'Último contacto con el rover, durante la tormenta global de 2018. La NASA dio por terminada su misión en febrero de 2019.' },
    ],
    reto: 'Mantener la base con energía aunque la luz del Sol apenas atraviese el polvo.',
    consejo: 'Con tormentas de polvo los paneles casi no producen. El reactor funciona igual de día, de noche y con polvo.',
    mod: { particulas: 0.4, gcr: 1.25, polvo: 2.5, desgaste: 1 },
    supuestos: [
      'Las tormentas de polvo son 2.5 veces más probables que en una llegada normal y habrá una grande al tercer sol: es diseño del juego.',
      'Con el Sol más tranquilo hay menos tormentas solares y un 25% más de rayos cósmicos: es una estimación del juego.',
    ],
    guion: [{ sol: 3, tipo: 'polvo', datos: { soles: 8, tau: 4.5 } }],
  },
  {
    id: 'hieloUtopia',
    nombre: 'Agua bajo el hielo',
    lema: 'Sacar agua de Marte para las misiones que vendrán.',
    lanzamiento: '2029-01-07T14:00:00Z',
    ventana: 'enero de 2029',
    situacion: [
      'El objetivo es demostrar que se puede vivir del agua de Marte. Aterrizarán en Utopia Planitia, donde el radar de una sonda de la NASA encontró hielo enterrado.',
      'Tendrán que llevar el extractor, instalarlo y sacar agua del subsuelo. Es una llanura más fría y con menos luz que la zona del ecuador.',
    ],
    hechos: [
      {
        etiqueta: 'Hielo enterrado',
        valor: 'como el lago Superior',
        texto: 'En 2016 el radar SHARAD de la sonda Mars Reconnaissance Orbiter detectó bajo Utopia Planitia hielo con un volumen de agua parecido al del lago Superior.',
      },
    ],
    reto: 'Aterrizar en Utopia Planitia y sacar del hielo 10 kg de agua por cada sol de estancia.',
    sitio: 'utopia',
    objetivo: { aguaPorSol: 10 },
    consejo: 'El extractor de hielo es obligatorio en esta misión. Gasta 3 kW: piensen en paneles o en el reactor.',
    cargaMinima: { isru: 1 },
    mod: { particulas: 0.5, gcr: 1.15, polvo: 1, desgaste: 1 },
    supuestos: ['La meta de 10 kg de agua por sol y el ritmo del extractor son valores de diseño del juego.'],
    guion: [],
  },
  {
    id: 'vidaJezero',
    nombre: 'Rastros de un antiguo lago',
    lema: 'Buscar señales de vida antigua donde hubo un lago.',
    lanzamiento: '2033-03-19T14:00:00Z',
    ventana: 'marzo de 2033',
    situacion: [
      'Hace unos 3 500 millones de años el cráter Jezero fue un lago, con un río que formó un delta. Desde 2021 el rover Perseverance recoge allí muestras de roca.',
      'Su misión es estudiar el delta de cerca: más muestras y más salidas al exterior. Llegarán en plena temporada de polvo.',
    ],
    hechos: [
      { etiqueta: 'Perseverance', valor: '18 de febrero de 2021', texto: 'Aterrizaje del rover en Jezero. Guarda muestras en tubos sellados para que algún día vuelvan a la Tierra.' },
    ],
    reto: 'Aterrizar en Jezero y analizar más muestras que en una misión normal.',
    sitio: 'jezero',
    objetivo: { muestrasExtra: 3 },
    mod: { particulas: 0.6, gcr: 1.1, polvo: 1.3, desgaste: 1 },
    supuestos: ['Las tres muestras extra y la mayor probabilidad de polvo son diseño del juego.'],
    guion: [],
  },
  {
    id: 'averiaViaje',
    nombre: 'Problema a bordo',
    lema: 'Una avería grave a mitad de camino.',
    lanzamiento: '2026-12-05T14:00:00Z',
    ventana: 'diciembre de 2026',
    situacion: [
      'Despegan en la ventana de diciembre de 2026. A mitad del viaje algo va a fallar, y la Tierra estará demasiado lejos para ayudar a tiempo.',
      'En 1970 la tripulación del Apolo 13 sobrevivió a la explosión de un tanque de oxígeno improvisando con lo que había a bordo, incluido un adaptador de cinta y cartón para los cartuchos de hidróxido de litio.',
    ],
    hechos: [
      { etiqueta: 'Apolo 13', valor: 'abril de 1970', texto: 'Un tanque de oxígeno explotó camino a la Luna. La tripulación volvió a salvo gracias a decisiones rápidas y piezas improvisadas.' },
    ],
    reto: 'Superar una avería en cadena y llegar a Marte con todos sanos.',
    consejo: 'Lleven repuestos de sobra y cartuchos de hidróxido de litio: limpian el CO2 aunque falle el depurador.',
    mod: { particulas: 0.8, gcr: 1, polvo: 1, desgaste: 1.25 },
    supuestos: ['La fuga y las averías en cadena a mitad del viaje están preparadas por el juego; el desgaste es un 25% mayor.'],
    guion: [
      { viaje: 0.4, tipo: 'fuga' },
      { viaje: 0.41, tipo: 'fallo', datos: { sistema: 'oga' } },
      { viaje: 0.55, tipo: 'fallo', datos: { sistema: 'cdra' } },
    ],
  },
]

export const ESCENARIO_BY_ID = Object.fromEntries(ESCENARIOS.map((e) => [e.id, e])) as Record<EscenarioId, Escenario>
export const escenarioDe = (id: string | undefined): Escenario => ESCENARIO_BY_ID[(id ?? '') as EscenarioId] ?? ESCENARIOS[0]

/** Fecha real (UTC) que corresponde a un instante de la misión, en segundos desde el despegue. */
export const fechaDeMision = (escenario: Escenario, t: number) => new Date(Date.parse(escenario.lanzamiento) + t * 1000)

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const fechaLarga = (d: Date) => `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
export const fechaCorta = (d: Date) => `${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]} ${d.getUTCFullYear()}`

// ---------- El hogar de cada tripulante ----------

/** Ciudades para marcar "tu hogar" en la Tierra. Coordenadas en grados (sur y oeste negativos). */
export const CIUDADES = [
  { id: 'lambayeque', nombre: 'Lambayeque', pais: 'Perú', lat: -6.7, lon: -79.91 },
  { id: 'chiclayo', nombre: 'Chiclayo', pais: 'Perú', lat: -6.77, lon: -79.84 },
  { id: 'lima', nombre: 'Lima', pais: 'Perú', lat: -12.05, lon: -77.04 },
  { id: 'trujillo', nombre: 'Trujillo', pais: 'Perú', lat: -8.11, lon: -79.03 },
  { id: 'piura', nombre: 'Piura', pais: 'Perú', lat: -5.19, lon: -80.63 },
  { id: 'cajamarca', nombre: 'Cajamarca', pais: 'Perú', lat: -7.16, lon: -78.51 },
  { id: 'arequipa', nombre: 'Arequipa', pais: 'Perú', lat: -16.4, lon: -71.54 },
  { id: 'cusco', nombre: 'Cusco', pais: 'Perú', lat: -13.53, lon: -71.97 },
  { id: 'puno', nombre: 'Puno', pais: 'Perú', lat: -15.84, lon: -70.02 },
  { id: 'huancayo', nombre: 'Huancayo', pais: 'Perú', lat: -12.07, lon: -75.21 },
  { id: 'iquitos', nombre: 'Iquitos', pais: 'Perú', lat: -3.75, lon: -73.25 },
  { id: 'tacna', nombre: 'Tacna', pais: 'Perú', lat: -18.01, lon: -70.25 },
  { id: 'quito', nombre: 'Quito', pais: 'Ecuador', lat: -0.18, lon: -78.47 },
  { id: 'bogota', nombre: 'Bogotá', pais: 'Colombia', lat: 4.71, lon: -74.07 },
  { id: 'lapaz', nombre: 'La Paz', pais: 'Bolivia', lat: -16.5, lon: -68.15 },
  { id: 'santiago', nombre: 'Santiago', pais: 'Chile', lat: -33.45, lon: -70.67 },
  { id: 'buenosaires', nombre: 'Buenos Aires', pais: 'Argentina', lat: -34.6, lon: -58.38 },
  { id: 'mexico', nombre: 'Ciudad de México', pais: 'México', lat: 19.43, lon: -99.13 },
  { id: 'madrid', nombre: 'Madrid', pais: 'España', lat: 40.42, lon: -3.7 },
  { id: 'houston', nombre: 'Houston', pais: 'Estados Unidos', lat: 29.76, lon: -95.37 },
] as const
export type CiudadId = (typeof CIUDADES)[number]['id']
export const CIUDAD_BY_ID = Object.fromEntries(CIUDADES.map((c) => [c.id, c])) as Record<CiudadId, (typeof CIUDADES)[number]>
