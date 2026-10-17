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
    nombre: 'First Base on Mars',
    lema: 'Be the first people to live on another planet.',
    lanzamiento: '2026-12-05T14:00:00Z',
    ventana: 'December 2026',
    situacion: [
      'Mission Control chose you for the mission that will build the first crewed base on Mars. You launch in the December 2026 window, when Earth and Mars line up for the trip that uses the least fuel.',
      'It will be the first time a crew lives on the surface of another planet. Whatever you do not bring, you will not have.',
    ],
    hechos: [
      { etiqueta: 'Launch window', valor: 'every 26 months', texto: 'Earth and Mars line up again for the cheapest trip about every 26 months.' },
    ],
    reto: 'Arrive, build the base and meet the objective without anyone getting sick.',
    mod: { particulas: 0.8, gcr: 1, polvo: 1, desgaste: 1 },
    supuestos: ['Solar activity is 20% lower than in 2024 because the solar cycle is winding down.'],
    guion: [],
  },
  {
    id: 'maximoSolar',
    nombre: 'Solar Maximum',
    lema: 'A trip at the peak of solar activity.',
    lanzamiento: '2024-10-25T14:00:00Z',
    ventana: 'October 2024',
    situacion: [
      'This is a simulation of the October 2024 window, with the Sun at the top of its activity cycle. The particle storms you will meet are the ones NASA recorded starting that same day.',
      'A strong solar storm can give, in a few hours, as much dose as several weeks of cosmic rays. The shelter and the shielding will be key.',
    ],
    hechos: [
      { etiqueta: 'Solar maximum', valor: 'October 2024', texto: 'In October 2024, NASA and NOAA announced that the Sun had reached the maximum of its activity cycle.' },
      { etiqueta: 'Fewer cosmic rays', valor: 'with an active Sun', texto: 'When the Sun is active, its wind pushes away part of the cosmic rays that come from outside the solar system.' },
    ],
    reto: 'Protect the crew from solar storms without neglecting everything else.',
    consejo: 'Each layer of shielding in the shelter lowers the dose from solar storms.',
    mod: { particulas: 1.4, gcr: 0.9, polvo: 1, desgaste: 1 },
    supuestos: [
      'Solar storms are more frequent than in the other missions and cosmic rays drop by 10%. This is a game estimate.',
    ],
    guion: [],
    diaClimaEspacial: 299,
  },
  {
    id: 'tormentaPolvo',
    nombre: 'Dust Storm Season',
    lema: 'You will arrive when dust covers the Martian sky.',
    lanzamiento: '2031-02-10T14:00:00Z',
    ventana: 'February 2031',
    situacion: [
      'You launch in the February 2031 window and will reach Mars in its dust season: spring and summer in the southern hemisphere, when the planet is closest to the Sun.',
      'In 2018 a storm covered the whole planet for weeks. The Opportunity rover, which ran on solar panels, ran out of power and never made contact again.',
    ],
    hechos: [
      { etiqueta: 'Opportunity', valor: 'June 10, 2018', texto: 'Last contact with the rover, during the global storm of 2018. NASA declared its mission over in February 2019.' },
    ],
    reto: 'Keep the base powered even when sunlight barely gets through the dust.',
    consejo: 'During dust storms the panels produce almost nothing. The reactor works the same by day, by night and in dust.',
    mod: { particulas: 0.4, gcr: 1.25, polvo: 2.5, desgaste: 1 },
    supuestos: [
      'Dust storms are 2.5 times more likely than on a normal arrival, and a big one will hit on the third sol. This is game design.',
      'With a calmer Sun there are fewer solar storms and 25% more cosmic rays. This is a game estimate.',
    ],
    guion: [{ sol: 3, tipo: 'polvo', datos: { soles: 8, tau: 4.5 } }],
  },
  {
    id: 'hieloUtopia',
    nombre: 'Water Under the Ice',
    lema: 'Get water from Mars for the missions still to come.',
    lanzamiento: '2029-01-07T14:00:00Z',
    ventana: 'January 2029',
    situacion: [
      'The goal is to show that people can live on Martian water. You will land in Utopia Planitia, where the radar of a NASA spacecraft found buried ice.',
      'You will have to bring the extractor, install it and pull water from under the ground. This plain is colder and gets less light than the equator.',
    ],
    hechos: [
      {
        etiqueta: 'Buried ice',
        valor: 'like Lake Superior',
        texto: 'In 2016 the SHARAD radar on the Mars Reconnaissance Orbiter found ice under Utopia Planitia holding about as much water as Lake Superior.',
      },
    ],
    reto: 'Land in Utopia Planitia and get 10 kg of water from the ice for every sol of your stay.',
    sitio: 'utopia',
    objetivo: { aguaPorSol: 10 },
    consejo: 'The ice extractor is required on this mission. It uses 3 kW, so plan for panels or the reactor.',
    cargaMinima: { isru: 1 },
    mod: { particulas: 0.5, gcr: 1.15, polvo: 1, desgaste: 1 },
    supuestos: ['The goal of 10 kg of water per sol and the extractor rate are game design values.'],
    guion: [],
  },
  {
    id: 'vidaJezero',
    nombre: 'Traces of an Ancient Lake',
    lema: 'Look for signs of ancient life where a lake once was.',
    lanzamiento: '2033-03-19T14:00:00Z',
    ventana: 'March 2033',
    situacion: [
      'About 3.5 billion years ago, Jezero Crater was a lake, with a river that built a delta. Since 2021 the Perseverance rover has been collecting rock samples there.',
      'Your mission is to study the delta up close: more samples and more trips outside. You will arrive in the middle of the dust season.',
    ],
    hechos: [
      { etiqueta: 'Perseverance', valor: 'February 18, 2021', texto: 'The rover landed in Jezero. It stores samples in sealed tubes so that one day they can return to Earth.' },
    ],
    reto: 'Land in Jezero and analyze more samples than on a normal mission.',
    sitio: 'jezero',
    objetivo: { muestrasExtra: 3 },
    mod: { particulas: 0.6, gcr: 1.1, polvo: 1.3, desgaste: 1 },
    supuestos: ['The three extra samples and the higher chance of dust are game design.'],
    guion: [],
  },
  {
    id: 'averiaViaje',
    nombre: 'Trouble On Board',
    lema: 'A serious breakdown halfway there.',
    lanzamiento: '2026-12-05T14:00:00Z',
    ventana: 'December 2026',
    situacion: [
      'You launch in the December 2026 window. Halfway through the trip something will fail, and Earth will be too far away to help in time.',
      'In 1970 the Apollo 13 crew survived an oxygen tank explosion by improvising with what they had on board, including an adapter made of tape and cardboard for the lithium hydroxide cartridges.',
    ],
    hechos: [
      { etiqueta: 'Apollo 13', valor: 'April 1970', texto: 'An oxygen tank exploded on the way to the Moon. The crew got home safely thanks to quick decisions and improvised parts.' },
    ],
    reto: 'Get through a chain of breakdowns and reach Mars with everyone healthy.',
    consejo: 'Bring plenty of spare parts and lithium hydroxide cartridges. They clean the CO2 even if the scrubber fails.',
    mod: { particulas: 0.8, gcr: 1, polvo: 1, desgaste: 1.25 },
    supuestos: ['The leak and the chain of breakdowns halfway through the trip are set up by the game. Wear is 25% higher.'],
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

const MESES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MESES_CORTOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fechaLarga = (d: Date) => `${MESES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
export const fechaCorta = (d: Date) => `${MESES_CORTOS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`

// ---------- El hogar de cada tripulante ----------

/** Ciudades para marcar "tu hogar" en la Tierra. Coordenadas en grados (sur y oeste negativos). */
export const CIUDADES = [
  { id: 'lambayeque', nombre: 'Lambayeque', pais: 'Peru', lat: -6.7, lon: -79.91 },
  { id: 'chiclayo', nombre: 'Chiclayo', pais: 'Peru', lat: -6.77, lon: -79.84 },
  { id: 'lima', nombre: 'Lima', pais: 'Peru', lat: -12.05, lon: -77.04 },
  { id: 'trujillo', nombre: 'Trujillo', pais: 'Peru', lat: -8.11, lon: -79.03 },
  { id: 'piura', nombre: 'Piura', pais: 'Peru', lat: -5.19, lon: -80.63 },
  { id: 'cajamarca', nombre: 'Cajamarca', pais: 'Peru', lat: -7.16, lon: -78.51 },
  { id: 'arequipa', nombre: 'Arequipa', pais: 'Peru', lat: -16.4, lon: -71.54 },
  { id: 'cusco', nombre: 'Cusco', pais: 'Peru', lat: -13.53, lon: -71.97 },
  { id: 'puno', nombre: 'Puno', pais: 'Peru', lat: -15.84, lon: -70.02 },
  { id: 'huancayo', nombre: 'Huancayo', pais: 'Peru', lat: -12.07, lon: -75.21 },
  { id: 'iquitos', nombre: 'Iquitos', pais: 'Peru', lat: -3.75, lon: -73.25 },
  { id: 'tacna', nombre: 'Tacna', pais: 'Peru', lat: -18.01, lon: -70.25 },
  { id: 'quito', nombre: 'Quito', pais: 'Ecuador', lat: -0.18, lon: -78.47 },
  { id: 'bogota', nombre: 'Bogotá', pais: 'Colombia', lat: 4.71, lon: -74.07 },
  { id: 'lapaz', nombre: 'La Paz', pais: 'Bolivia', lat: -16.5, lon: -68.15 },
  { id: 'santiago', nombre: 'Santiago', pais: 'Chile', lat: -33.45, lon: -70.67 },
  { id: 'buenosaires', nombre: 'Buenos Aires', pais: 'Argentina', lat: -34.6, lon: -58.38 },
  { id: 'mexico', nombre: 'Mexico City', pais: 'Mexico', lat: 19.43, lon: -99.13 },
  { id: 'madrid', nombre: 'Madrid', pais: 'Spain', lat: 40.42, lon: -3.7 },
  { id: 'houston', nombre: 'Houston', pais: 'United States', lat: 29.76, lon: -95.37 },
] as const
export type CiudadId = (typeof CIUDADES)[number]['id']
export const CIUDAD_BY_ID = Object.fromEntries(CIUDADES.map((c) => [c.id, c])) as Record<CiudadId, (typeof CIUDADES)[number]>
