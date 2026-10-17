// Procedimientos por pasos: cómo se monta de verdad cada parte de la base y cómo se cuida un
// huerto en el espacio. Cada procedimiento explica cómo se hace en la vida real y se divide en
// pasos con una interacción propia (mantener, ordenar, ajustar, elegir o leer un instrumento).
//
// Los usan igual el servidor (que valida y aplica las consecuencias, server/procedimientos.ts)
// y la pantalla (que da la respuesta inmediata, src/hud/Procedimiento.tsx). Los datos reales
// tienen su fuente en FUENTES de shared/ciencia.ts; lo que es del juego está en SUPUESTOS.
import { C } from './ciencia.js'
import { SITE_BY_ID, TAREAS_ENSAMBLAJE, type CultivoId, type Role, type RoomState, type Zona } from './types.js'

export type TipoPaso = 'mantener' | 'secuencia' | 'ajustar' | 'elegir' | 'comprobar'

export interface Opcion {
  id: string
  texto: string
  /** 0 a 1: 1 = lo que haría alguien con experiencia. */
  calidad: number
  /** Lo que pasa en la vida real si se elige. */
  consecuencia: string
  /** Si es peligrosa, no se acepta: se explica y hay que elegir otra. */
  repetir?: boolean
}

/** Lo que muestra un instrumento en un paso de comprobación. */
export interface Lectura {
  forma: 'linea' | 'barras'
  titulo: string
  unidad: string
  /** Etiqueta del eje horizontal. */
  eje: string
  puntos: { x: number | string; y: number }[]
  /** Línea de referencia: en la de presión, la presión mínima aceptable; en barras, el máximo. */
  limite: number
  limiteTexto: string
  pregunta: string
  correcto: 'pasa' | 'falla'
  explicacion: string
}

interface PasoBase {
  id: string
  titulo: string
  /** Qué hay que hacer. Puede depender de la sala, por ejemplo de la latitud del sitio. */
  instruccion: string | ((room: RoomState) => string)
  /** Por qué se hace así en la vida real. */
  porque: string
  roles: Role[]
  zona: Zona
  /** Estación del mapa (src/mundo/mapa.ts) donde se hace. */
  estacion: string
  /** Segundos reales que lleva hacerlo con calma. */
  segundos: number
  /** Si el paso no aplica a esta misión (por ejemplo, sin reactor), se salta solo. */
  aplica?: (room: RoomState) => boolean
}
export interface PasoMantener extends PasoBase { tipo: 'mantener'; boton: string }
export interface PasoSecuencia extends PasoBase {
  tipo: 'secuencia'
  /** Se muestran en este orden, que no es el correcto. */
  elementos: { id: string; nombre: string }[]
  /** Órdenes válidos; el primero es el de referencia. */
  ordenes: string[][]
  error: string
}
export interface PasoAjustar extends PasoBase {
  tipo: 'ajustar'
  min: number
  max: number
  paso: number
  unidad: string
  inicial: number
  /** Lo que pondría alguien con experiencia. */
  objetivo: (room: RoomState) => number
  evaluar: (room: RoomState, v: number) => { calidad: number; mensaje: string }
}
export interface PasoElegir extends PasoBase { tipo: 'elegir'; opciones: (room: RoomState) => Opcion[] }
export interface PasoComprobar extends PasoBase { tipo: 'comprobar'; lectura: (room: RoomState) => Lectura }
export type Paso = PasoMantener | PasoSecuencia | PasoAjustar | PasoElegir | PasoComprobar

export interface Procedimiento {
  id: string
  titulo: string
  /** Cómo se hace en la vida real y de dónde sale. */
  intro: string
  roles: Role[]
  zona: Zona
  estacion: string
  /** Tarea del montaje de la base que completa, si es una (ver TAREAS_ENSAMBLAJE). */
  tarea?: string
  /** Se repite cada vez que hace falta, como regar. */
  recurrente?: boolean
  pasos: Paso[]
}

const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100
const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const pct = (v: number) => `${Math.round(v * 100)}%`

// ---------- Geometría de los paneles ----------

/** Latitud del sitio en grados, positiva al norte (sale del texto de SITES, p. ej. '4.6° S'). */
export function latitudDe(sitio: string | null): number {
  const s = SITE_BY_ID[sitio ?? 'gale'] ?? SITE_BY_ID.gale
  const m = /([\d.]+)°\s*([NS])/.exec(s.latitud)
  return m ? Number(m[1]) * (m[2] === 'S' ? -1 : 1) : 0
}

/** Punto cardinal hacia el que queda el ecuador desde el sitio. */
export const haciaEcuador = (sitio: string | null) => (latitudDe(sitio) < 0 ? 'norte' : 'sur')
/** Nombre en pantalla de cada punto cardinal (los ids siguen en español). */
const RUMBO: Record<string, string> = { norte: 'north', sur: 'south', este: 'east', oeste: 'west' }

/**
 * Modelo del juego: fracción de la luz que aprovecha un panel fijo, según el coseno del ángulo
 * entre el panel y el Sol del mediodía en el equinoccio. Un 15% llega siempre como luz difusa.
 */
export function factorPanel(sitio: string | null, azimut: string, inclinacion: number): number {
  const lat = (Math.abs(latitudDe(sitio)) * Math.PI) / 180
  const b = (inclinacion * Math.PI) / 180
  const ecuador = haciaEcuador(sitio)
  const polo = ecuador === 'norte' ? 'sur' : 'norte'
  const cos = azimut === ecuador ? Math.cos(b - lat) : azimut === polo ? Math.cos(b + lat) : Math.cos(b) * Math.cos(lat)
  return r2(0.15 + 0.85 * Math.max(0, cos))
}
/** Inclinación con la que mejor rinde un panel orientado hacia `azimut`. */
const mejorInclinacion = (sitio: string | null, azimut: string) => (azimut === haciaEcuador(sitio) ? Math.round(Math.abs(latitudDe(sitio))) : 0)

// ---------- Huerto ----------

/** Humedad que gana el sustrato por cada mL de agua (modelo del juego). */
export const HUMEDAD_POR_ML = 0.5
/** Humedad a la que se quiere dejar el sustrato tras regar (modelo del juego). */
export const HUMEDAD_IDEAL = 70
export const ALMOHADILLAS = 6

export interface CultivoInfo {
  id: CultivoId
  nombre: string
  /** Nombre corto para usar en mitad de una frase. */
  corto: string
  /** Días de la siembra a la cosecha. */
  dias: number
  /** kg comestibles por almohadilla y cosecha completa (modelo del juego). */
  kg: number
  /** Crecimiento con el que queda la planta tras una cosecha que la deja rebrotar. */
  rebrote: number
  historia: string
  cortes: (Opcion & { factor: number; rebrota: boolean })[]
}

const CORTES_HOJA: CultivoInfo['cortes'] = [
  { id: 'hojas', texto: 'Cut the outer leaves and leave the center', calidad: 1, consecuencia: 'This is the cut-and-regrow method tested on the ISS in 2017: the plant keeps growing leaves and you can harvest again sooner.', factor: 0.6, rebrota: true },
  { id: 'entera', texto: 'Cut the whole plant', calidad: 0.7, consecuencia: 'There is more food today, but you have to plant again and wait for the full cycle.', factor: 1, rebrota: false },
]

export const CULTIVOS: CultivoInfo[] = [
  {
    id: 'lechuga',
    nombre: 'Outredgeous red romaine lettuce',
    corto: 'lettuce',
    dias: 33,
    kg: 0.9,
    rebrote: 0.5,
    historia: 'The first vegetable grown and eaten on the ISS. It grew for 33 days and the crew ate it on August 10, 2015.',
    cortes: CORTES_HOJA,
  },
  {
    id: 'mizuna',
    nombre: 'Mizuna, a Japanese leafy mustard',
    corto: 'mizuna',
    dias: 28,
    kg: 0.8,
    rebrote: 0.5,
    historia: 'It was grown in Veggie in 2017 and 2019 to compare different lights and repeated harvests.',
    cortes: CORTES_HOJA,
  },
  {
    id: 'rabano',
    nombre: 'Radish',
    corto: 'radish',
    dias: 27,
    kg: 0.6,
    rebrote: 0,
    historia: 'The PH-02 experiment grew it in the Advanced Plant Habitat in 2020. It matures in 27 days.',
    cortes: [
      { id: 'entera', texto: 'Pull up the whole plant with its root', calidad: 1, consecuencia: 'The radish is the root: you harvest it whole and plant again.', factor: 1, rebrota: false },
      { id: 'hojas', texto: 'Cut only the leaves', calidad: 0.3, consecuencia: 'You get a few leaves and the root stops growing.', factor: 0.3, rebrota: true },
    ],
  },
  {
    id: 'chile',
    nombre: 'Improved Española chile pepper',
    corto: 'chile pepper',
    dias: 110,
    kg: 1.2,
    rebrote: 0.75,
    historia: 'The PH-04 experiment grew it in 2021 for 137 days. It was the first fruit harvested on the ISS, in two harvests.',
    cortes: [
      { id: 'frutos', texto: 'Cut the ripe peppers with scissors', calidad: 1, consecuencia: 'The plant keeps flowering and gives another harvest, as in PH-04.', factor: 1, rebrota: true },
      { id: 'entera', texto: 'Pull out the plant', calidad: 0.2, consecuencia: 'You lose a plant that took months to bear fruit.', factor: 1, rebrota: false },
    ],
  },
]
export const CULTIVO_BY_ID = Object.fromEntries(CULTIVOS.map((c) => [c.id, c])) as Record<CultivoId, CultivoInfo>
export const cultivoDe = (room: RoomState) => CULTIVO_BY_ID[room.huerto.cultivo ?? 'lechuga'] ?? CULTIVO_BY_ID.lechuga

/** Calidad de un riego según la humedad con la que queda el sustrato. */
function calidadRiego(final: number): { calidad: number; mensaje: string } {
  const error = Math.abs(final - HUMEDAD_IDEAL)
  const calidad = r2(limitar(1 - Math.max(0, error - 10) / 30, 0, 1))
  const mensaje =
    final > 88 ? `The growing medium is at ${Math.round(final)}% and soaked. With that much moisture, mold appears, like on the ISS zinnias.`
    : final < 45 ? `The growing medium is at ${Math.round(final)}%. That is too little: the roots are still thirsty.`
    : `The growing medium is at ${Math.round(final)}% moisture. Good.`
  return { calidad, mensaje }
}

const vivas = (room: RoomState) => (room.huerto.almohadillas ?? []).filter((a) => !a.muerta)
/** Almohadillas que se riegan: las que están por debajo de la mitad. */
export const secas = (room: RoomState) => vivas(room).filter((a) => a.humedad < 50)

// ---------- Datos de los procedimientos ----------

const tarea = (id: string) => TAREAS_ENSAMBLAJE.find((t) => t.id === id)!

/** Un paso sin roles, zona ni estación: los hereda del procedimiento. */
type PasoLocal = Paso extends infer T ? (T extends Paso ? Omit<T, 'roles' | 'zona' | 'estacion'> : never) : never

/** Crea un procedimiento: cada paso recibe los roles, la zona y la estación del procedimiento. */
function proc(p: Omit<Procedimiento, 'pasos'> & { pasos: PasoLocal[] }): Procedimiento {
  return { ...p, pasos: p.pasos.map((x) => ({ roles: p.roles, zona: p.zona, estacion: p.estacion, ...x }) as Paso) }
}
function deTarea(id: string, p: Omit<Procedimiento, 'id' | 'roles' | 'zona' | 'estacion' | 'tarea' | 'titulo' | 'pasos'> & { pasos: PasoLocal[] }) {
  const t = tarea(id)
  return proc({ ...p, id, titulo: t.titulo, roles: t.roles, zona: t.zona, estacion: t.estacion, tarea: id })
}

/** Órdenes en cruz para apretar cuatro esquinas: cada una seguida de su opuesta. */
const ORDENES_CRUZ = (() => {
  const opuesta: Record<string, string> = { no: 'se', se: 'no', ne: 'so', so: 'ne' }
  const lista: string[][] = []
  for (const a of ['no', 'se', 'ne', 'so']) {
    for (const b of ['no', 'se', 'ne', 'so'].filter((x) => x !== a && x !== opuesta[a])) lista.push([a, opuesta[a], b, opuesta[b]])
  }
  return lista
})()

const dosisReactor: Record<string, number> = { enterrado: 0, lejos: 0.05, cerca: 1.5 }
export const DOSIS_REACTOR = dosisReactor
const LUZ: Record<string, number> = { rgb: 1, rb: 0.95, blanca: 0.5 }
export const LUZ_HUERTO = LUZ

export const PROCEDIMIENTOS: Procedimiento[] = [
  deTarea('paneles', {
    intro:
      'In space, NASA already uses flexible panels that travel rolled up like a carpet. ROSA was tested on the ISS in June 2017, and astronauts have installed iROSA panels on spacewalks since June 2021. They unroll on their own using the stored spring energy in their side beams. On the ground, a fixed panel faces the equator and is tilted about as much as the latitude of the site, so the noon Sun hits it straight on.',
    pasos: [
      {
        id: 'orientacion',
        tipo: 'elegir',
        titulo: 'Point the array',
        instruccion: (room) => `The base is at latitude ${Math.abs(latitudDe(room.sitio))}° ${latitudDe(room.sitio) < 0 ? 'south' : 'north'}. Which way do the panels face?`,
        porque: 'A fixed panel gets more light over the year if it faces the equator, because the noon Sun crosses that side of the sky.',
        segundos: 8,
        opciones: (room) =>
          ['norte', 'sur', 'este', 'oeste'].map((az) => {
            const f = factorPanel(room.sitio, az, mejorInclinacion(room.sitio, haciaEcuador(room.sitio)))
            const ecuador = az === haciaEcuador(room.sitio)
            return {
              id: az,
              texto: `Facing ${RUMBO[az]}`,
              calidad: ecuador ? 1 : r2(f),
              consecuencia: ecuador
                ? 'Facing the equator: the noon Sun hits them straight on.'
                : `This way they use ${pct(f)} of the noon light. ${Math.abs(latitudDe(room.sitio)) < 10 ? 'Near the equator it hardly matters. Far from it, it matters a lot.' : 'At this latitude you lose a lot.'}`,
            }
          }),
      },
      {
        id: 'anclaje',
        tipo: 'secuencia',
        titulo: 'Anchor the frame',
        instruccion: 'Tighten the anchors at the four corners. Tap the corners in the order you tighten them.',
        porque: 'The bolts on a large part are tightened in a cross pattern, switching between opposite corners, so the frame sits evenly and does not twist.',
        segundos: 10,
        elementos: [
          { id: 'no', nombre: 'Northwest corner' },
          { id: 'ne', nombre: 'Northeast corner' },
          { id: 'so', nombre: 'Southwest corner' },
          { id: 'se', nombre: 'Southeast corner' },
        ],
        ordenes: ORDENES_CRUZ,
        error: 'After one corner comes the opposite one, across the diagonal. If you tighten two in a row on the same side, the frame twists.',
      },
      {
        id: 'desenrollar',
        tipo: 'mantener',
        titulo: 'Unroll the wings',
        instruccion: 'Release the latch and guide the wing while it extends. Press and hold until it is fully extended.',
        porque: 'The wing unrolls on its own, but someone guides it so it does not twist or catch on rocks. If you let go too early, it stays half open.',
        segundos: 6,
        boton: 'Hold to unroll',
      },
      {
        id: 'inclinacion',
        tipo: 'ajustar',
        titulo: 'Tilt the panels',
        instruccion: (room) => `Adjust the tilt of the panels. The base is at latitude ${Math.abs(latitudDe(room.sitio))}°.`,
        porque: 'Tilted to match the latitude, the panel is at a right angle to the noon Sun at the equinoxes. Flatter or steeper, it loses light.',
        segundos: 8,
        min: 0,
        max: 60,
        paso: 1,
        unidad: '°',
        inicial: 30,
        objetivo: (room) => {
          const az = String(room.procedimientos?.paneles?.valores?.[0] ?? haciaEcuador(room.sitio))
          return mejorInclinacion(room.sitio, az)
        },
        evaluar: (room, v) => {
          const az = String(room.procedimientos?.paneles?.valores?.[0] ?? haciaEcuador(room.sitio))
          const f = factorPanel(room.sitio, az, v)
          const mejor = factorPanel(room.sitio, az, mejorInclinacion(room.sitio, az))
          return { calidad: r2(Math.min(1, f / mejor)), mensaje: `At ${v}° facing ${RUMBO[az] ?? az}, the panels use ${pct(f)} of the noon light.` }
        },
      },
    ],
  }),

  deTarea('carga', {
    intro:
      'To lower habitats and rovers from a lander, NASA Langley designed a light lattice crane moved by cables, the Lunar Surface Manipulation System. Its flight version would lift about one ton on the Moon. The best-known problem is the load swinging, because on another planet there is nobody on the ground to stop it. If the reactor came along, you also have to decide where to put it.',
    pasos: [
      {
        id: 'aparejo',
        tipo: 'secuencia',
        titulo: 'Get ready to lift',
        instruccion: 'Get the load ready to lift. Tap the steps in the order you would do them.',
        porque: 'First the load hangs from the crane and the cable is tight. Only then are the launch tie-downs released, so nothing moves on its own when it is freed.',
        segundos: 10,
        elementos: [
          { id: 'soltar', nombre: 'Release the launch tie-downs' },
          { id: 'eslingas', nombre: 'Hook the slings to the four lifting points' },
          { id: 'tensar', nombre: 'Tighten the crane cable' },
          { id: 'guia', nombre: 'Tie a guide rope to stop the swinging' },
        ],
        ordenes: [
          ['eslingas', 'guia', 'tensar', 'soltar'],
          ['guia', 'eslingas', 'tensar', 'soltar'],
          ['eslingas', 'tensar', 'guia', 'soltar'],
        ],
        error: 'If you release the tie-downs before the cable is tight, the load slides across the deck on its own.',
      },
      {
        id: 'bajar',
        tipo: 'mantener',
        titulo: 'Lower the load',
        instruccion: 'Lower each pallet slowly to the ground. Press and hold while it goes down.',
        porque: 'On Mars the load weighs a third of what it weighs on Earth, but it keeps all its mass. If it picks up speed or swings, it is just as hard to stop.',
        segundos: 8,
        boton: 'Hold to lower',
      },
      {
        id: 'reactor',
        tipo: 'elegir',
        titulo: 'Where to put the reactor',
        instruccion: 'The fission reactor gives power day and night, but it gives off radiation. Where do you put it?',
        porque: 'NASA studies for a surface reactor set the acceptable dose at 1 km and suggest putting it in a pit so the soil itself shields it. In 2018 the Kilopower reactor passed a 28-hour full-power test in Nevada.',
        segundos: 8,
        aplica: (room) => room.cargamento.reactor > 0,
        opciones: () => [
          { id: 'enterrado', texto: '1 km away, inside a pit covered with regolith', calidad: 1, consecuencia: 'The soil acts as shielding and the distance lowers the dose. You need to lay a long cable.' },
          { id: 'lejos', texto: '1 km away, on the surface', calidad: 0.7, consecuencia: 'The distance helps, but with no soil around it the radiation reaches farther. Anyone who goes outside gets a bit more dose.' },
          { id: 'cerca', texto: 'Next to the habitat, to save cable', calidad: 0.1, consecuencia: 'The crew gets radiation from the reactor day and night. That is why NASA plans keep it far away.' },
        ],
      },
    ],
  }),

  deTarea('energia', {
    intro:
      'On the ISS, the panels give between 150 and 170 volts of direct current. Some units hold it at 160 V, the primary bus, which charges the batteries. Then converters step the voltage down to 124.5 V, the secondary bus that reaches the labs and the crew. Here you connect it the same way, with the circuit locked out and working from the source toward the loads.',
    pasos: [
      {
        id: 'seguridad',
        tipo: 'elegir',
        titulo: 'Make the circuit safe',
        instruccion: 'You are about to connect the surface cables to the habitat panel. How do you prepare?',
        porque: 'Before touching a connector, you open the breaker, put a lock and a tag on it, and measure that there is no voltage. That way nobody can close it while you work.',
        segundos: 8,
        opciones: () => [
          { id: 'bloqueo', texto: 'Open the breaker, lock and tag it, and measure that there is no voltage', calidad: 1, consecuencia: 'This is how you work with circuits: nobody can close it while you connect, and you check it with the meter.' },
          { id: 'apagar', texto: 'Open the breaker without a lock', calidad: 0.6, consecuencia: 'It works, but someone who does not know you are connecting could close it.' },
          { id: 'caliente', texto: 'Connect with the circuit on so the lights stay on', calidad: 0, repetir: true, consecuencia: 'No. With direct current, an electric arc does not go out on its own like with alternating current. It burns the connector and the person holding it. Choose another way.' },
        ],
      },
      {
        id: 'cierre',
        tipo: 'secuencia',
        titulo: 'Power up the system',
        instruccion: 'Close the breakers one by one. Tap each stage in the order you power it up.',
        porque: 'You power up from the source toward the loads, one stage at a time, checking the voltage before moving on. That way a fault shows up at the stage where it happens.',
        segundos: 12,
        elementos: [
          { id: 'cargas', nombre: 'Habitat loads' },
          { id: 'convertidor', nombre: '124.5 V converter' },
          { id: 'fuente', nombre: 'Surface power generation' },
          { id: 'baterias', nombre: 'Batteries' },
          { id: 'primario', nombre: '160 V primary bus' },
        ],
        ordenes: [
          ['fuente', 'primario', 'baterias', 'convertidor', 'cargas'],
          ['fuente', 'primario', 'convertidor', 'baterias', 'cargas'],
        ],
        error: 'It goes from the source toward the loads. Closing a stage before the one that feeds it causes a spike when it connects and damages the equipment.',
      },
      {
        id: 'tension',
        tipo: 'ajustar',
        titulo: 'Adjust the converter',
        instruccion: 'Adjust the output voltage of the converter that powers the habitat.',
        porque: 'The equipment is built for the secondary bus voltage, 124.5 V on the ISS. With more voltage it gets damaged. With less, it draws more current and the cables heat up.',
        segundos: 8,
        min: 100,
        max: 170,
        paso: 0.5,
        unidad: 'V',
        inicial: 160,
        objetivo: () => 124.5,
        evaluar: (_room, v) => {
          const e = Math.abs(v - 124.5)
          const calidad = r2(limitar(1 - Math.max(0, e - 1) / 15, 0, 1))
          return {
            calidad,
            mensaje: v > 130 ? `${v} V is too much: the life support equipment suffers from overvoltage.` : v < 119 ? `At ${v} V the equipment draws more current and energy is lost as heat.` : `${v} V. The equipment gets the voltage it was built for.`,
          }
        },
      },
    ],
  }),

  deTarea('soporte', {
    intro:
      'ISS life support has three main machines: the water recycler, which recovers 98% of the water; the oxygen generator, which splits water into oxygen and hydrogen; and the scrubber, which removes CO2 from the air. They are all cooled by the water loops of the thermal control system. Here you turn them on in order and set them for the crew you have.',
    pasos: [
      {
        id: 'arranque',
        tipo: 'secuencia',
        titulo: 'Turn on the equipment',
        instruccion: 'Turn on the four machines. Tap each one in the order you turn it on.',
        porque: 'Cooling comes first, because the machines heat up while they work. The oxygen generator goes after the recycler, because it splits the water the recycler gives it.',
        segundos: 12,
        elementos: [
          { id: 'oga', nombre: 'Oxygen Generator' },
          { id: 'cdra', nombre: 'CO2 Scrubber' },
          { id: 'termico', nombre: 'Thermal Control' },
          { id: 'wrs', nombre: 'Water Recycler' },
        ],
        ordenes: [
          ['termico', 'wrs', 'cdra', 'oga'],
          ['termico', 'cdra', 'wrs', 'oga'],
          ['termico', 'wrs', 'oga', 'cdra'],
        ],
        error: 'Thermal control comes first, because it cools the others. And the oxygen generator needs water from the recycler: starting it dry damages it.',
      },
      {
        id: 'oxigeno',
        tipo: 'ajustar',
        titulo: 'Oxygen production',
        instruccion: (room) => `Set how much oxygen the generator makes per day. ${room.jugadores.filter((j) => j.rol).length} people live in the base.`,
        porque: `Each person uses about ${0.84} kg of oxygen per day. The ISS generator makes up to ${C.OGA_KG_DIA} kg. Making too much wastes water and power. Making too little empties the tanks.`,
        segundos: 10,
        min: 0,
        max: C.OGA_KG_DIA,
        paso: 0.1,
        unidad: 'kg/day',
        inicial: 2,
        objetivo: (room) => r1(room.jugadores.filter((j) => j.rol).length * 0.84),
        evaluar: (room, v) => {
          const necesario = room.jugadores.filter((j) => j.rol).length * 0.84
          const r = necesario > 0 ? v / necesario : 1
          const calidad = r2(r < 0.95 ? limitar(1 - (0.95 - r) * 2.5, 0, 1) : r > 1.2 ? limitar(1 - (r - 1.2) * 0.6, 0.5, 1) : 1)
          return {
            calidad,
            mensaje: r < 0.95 ? `${v} kg per day is not enough: you need ${r1(necesario)}. The rest will come from the tanks.` : r > 1.2 ? `${v} kg per day is more than you need: it wastes water and power.` : `${v} kg per day covers what the crew breathes.`,
          }
        },
      },
      {
        id: 'alarma',
        tipo: 'elegir',
        titulo: 'CO2 alarm',
        instruccion: 'At what level of CO2 in the air should the alarm go off?',
        porque: 'NASA lowered the cabin CO2 limit to 3 mmHg because above it the crew gets headaches and works less well. A late alarm lets the problem slip by.',
        segundos: 6,
        opciones: () => [
          { id: '3', texto: 'At 3 mmHg', calidad: 1, consecuencia: 'This is the current NASA limit. The alarm warns you in time.' },
          { id: '5.3', texto: 'At 5.3 mmHg', calidad: 0.6, consecuencia: 'This was the old limit. The alarm warns you when there are already symptoms.' },
          { id: '10', texto: 'At 10 mmHg', calidad: 0.2, consecuencia: 'The alarm will go off very late: the air will already be doing harm before anyone notices.' },
        ],
      },
    ],
  }),

  deTarea('revisionInt', {
    intro:
      'On the ISS, a hatch is never opened without first checking that there is no leak. The space between the two hatches is pressurized and the crew watches that the pressure does not drop. When a Dragon spacecraft arrived in 2015, Samantha Cristoforetti pressurized it to 260 mmHg and checked for 20 minutes that the pressure held.',
    pasos: [
      {
        id: 'sello',
        tipo: 'secuencia',
        titulo: 'Prepare the seal',
        instruccion: 'Prepare the inner hatch of the airlock. Tap the steps in order.',
        porque: 'Martian dust is very fine and sticks to everything. One grain on the seal is enough for a slow leak, so the seal is checked and cleaned before closing.',
        segundos: 10,
        elementos: [
          { id: 'cerrar', nombre: 'Close the hatch' },
          { id: 'limpiar', nombre: 'Clean the dust off the seal' },
          { id: 'trabas', nombre: 'Lock the latches' },
          { id: 'revisar', nombre: 'Check the seal for cuts' },
        ],
        ordenes: [
          ['revisar', 'limpiar', 'cerrar', 'trabas'],
          ['limpiar', 'revisar', 'cerrar', 'trabas'],
        ],
        error: 'The seal is checked and cleaned with the hatch open. The latches are locked at the end.',
      },
      {
        id: 'presurizar',
        tipo: 'mantener',
        titulo: 'Pressurize',
        instruccion: 'Open the valve and pressurize the airlock to 260 mmHg. Press and hold until it gets there.',
        porque: 'A pressure lower than the cabin is used: a leak still shows up, and if something gives way the blow is smaller.',
        segundos: 5,
        boton: 'Hold to pressurize',
      },
      {
        id: 'caida',
        tipo: 'comprobar',
        titulo: 'Read the pressure drop',
        instruccion: 'Watch the pressure for 20 minutes and decide if the airlock is airtight.',
        porque: 'If the pressure drops more than the sensor can explain, there is a leak. You find it and repeat the test before opening.',
        segundos: 10,
        lectura: (room) => {
          const d = room.procedimientos?.revisionInt?.datos ?? {}
          const fuga = (d.fuga ?? 0) > 0
          const caida = fuga ? 0.45 + ((d.semilla ?? 0) % 7) * 0.05 : 0.01
          const puntos = Array.from({ length: 21 }, (_, x) => {
            const ruido = Math.sin((d.semilla ?? 1) * 7.3 + x * 2.1) * 0.12
            return { x, y: Math.round((260 - caida * x + ruido) * 100) / 100 }
          })
          return {
            forma: 'linea',
            titulo: 'Airlock pressure',
            unidad: 'mmHg',
            eje: 'minutes',
            puntos,
            limite: 259,
            limiteTexto: 'Maximum drop: 1 mmHg in 20 minutes',
            pregunta: 'Is the airlock airtight?',
            correcto: fuga ? 'falla' : 'pasa',
            explicacion: fuga
              ? `The pressure dropped ${r1(caida * 20)} mmHg in 20 minutes. That is more than sensor noise: there is a leak.`
              : 'The pressure holds. The small ups and downs are sensor noise.',
          }
        },
      },
    ],
  }),

  deTarea('revisionExt', {
    intro:
      'On the ISS, the outside is photographed with handheld cameras and with the cameras on the robotic arm. The photos are compared with earlier ones to find micrometeoroid hits. Here you also have to look for dents from the landing before calling the base good.',
    pasos: [
      {
        id: 'fotos',
        tipo: 'mantener',
        titulo: 'Photograph the hull',
        instruccion: 'Walk along the hull and photograph each section. Press and hold while you move.',
        porque: 'A small mark is hard to see with the naked eye while wearing the suit. The photos are enlarged and compared with the ones from launch.',
        segundos: 6,
        boton: 'Hold to photograph',
      },
      {
        id: 'marcas',
        tipo: 'comprobar',
        titulo: 'Measure the marks',
        instruccion: 'Check the deepest mark on each section of the hull and decide if it needs repair.',
        porque: 'A shallow mark is normal. If it goes past the limit, the insulation layer is damaged and the habitat loses heat.',
        segundos: 10,
        lectura: (room) => {
          const d = room.procedimientos?.revisionExt?.datos ?? {}
          const dano = (d.dano ?? 0) > 0
          const zona = (d.semilla ?? 0) % 6
          const nombres = ['Bow', 'Bridge', 'Center', 'Garden', 'Stern', 'Airlock']
          const puntos = nombres.map((x, i) => ({ x, y: dano && i === zona ? 1.6 + ((d.semilla ?? 0) % 5) * 0.15 : r2(0.15 + Math.abs(Math.sin((d.semilla ?? 1) + i * 1.7)) * 0.4) }))
          return {
            forma: 'barras',
            titulo: 'Deepest mark per section',
            unidad: 'mm',
            eje: 'hull section',
            puntos,
            limite: 1,
            limiteTexto: 'Limit: 1 mm',
            pregunta: 'Is the hull in good shape?',
            correcto: dano ? 'falla' : 'pasa',
            explicacion: dano ? `The mark on the ${nombres[zona].toLowerCase()} section is past the limit. It needs a patch.` : 'All the marks are below the limit.',
          }
        },
      },
    ],
  }),

  proc({
    id: 'huerto',
    titulo: 'Set up the garden',
    intro:
      'The garden follows the ISS Veggie system. The plants grow in fabric pillows filled with baked clay and slow-release fertilizer, with wicks that carry water to the roots. On top is a lid of red, blue and green LED lights that make everything look pink, and a clear bellows that gets longer as the plants grow. The crew waters each pillow with a syringe.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'cultivo',
        tipo: 'elegir',
        titulo: 'Choose the crop',
        instruccion: 'What are you going to grow? All of these were grown on the ISS.',
        porque: 'The first tests used leafy plants that grow fast. Fruit came later: it takes months and needs more care.',
        segundos: 10,
        opciones: () => CULTIVOS.map((c) => ({ id: c.id, texto: c.nombre, calidad: 1, consecuencia: `${c.historia} In the game it is harvested after ${c.dias} days.` })),
      },
      {
        id: 'camara',
        tipo: 'mantener',
        titulo: 'Deploy the chamber',
        instruccion: 'Extend the clear bellows under the light lid. Press and hold while you deploy it.',
        porque: 'The bellows encloses the plants and keeps their moisture in. It is held on with magnets and gets longer as they grow.',
        segundos: 4,
        boton: 'Hold to deploy',
      },
      {
        id: 'luces',
        tipo: 'elegir',
        titulo: 'Turn on the lights',
        instruccion: 'Which lights do you turn on over the plants?',
        porque: 'Plants mostly use red and blue light. Veggie adds green so the crew can see the leaves in a more natural color.',
        segundos: 6,
        opciones: () => [
          { id: 'rgb', texto: 'Red, blue and green', calidad: 1, consecuencia: 'Like Veggie. They grow well, and you can see in time if a leaf gets spots or turns yellow.' },
          { id: 'rb', texto: 'Only red and blue', calidad: 0.85, consecuencia: 'They grow, but they look almost black and it is hard to spot a problem in time.' },
          { id: 'blanca', texto: 'The white cabin lights', calidad: 0.4, consecuencia: 'Those are for the crew, not for growing plants. Little light reaches the leaves and they grow slowly.' },
        ],
      },
      {
        id: 'almohadillas',
        tipo: 'secuencia',
        titulo: 'Place the pillows',
        instruccion: `Place the ${ALMOHADILLAS} pillows with seeds. Tap the steps in order.`,
        porque: 'The wicks only carry water if they touch the root mat. During the trip there is no gravity: anything not held down floats away.',
        segundos: 10,
        elementos: [
          { id: 'sujetar', nombre: 'Strap them down' },
          { id: 'mechas', nombre: 'Check that the wicks touch the mat' },
          { id: 'colocar', nombre: 'Place them on the root mat' },
        ],
        ordenes: [
          ['colocar', 'mechas', 'sujetar'],
          ['colocar', 'sujetar', 'mechas'],
        ],
        error: 'First they have to be placed on the mat. You cannot check or strap down something that is not in place yet.',
      },
      {
        id: 'cebado',
        tipo: 'ajustar',
        titulo: 'Prime with water',
        instruccion: `Inject water into each dry pillow with the syringe. Each mL raises the moisture by ${HUMEDAD_POR_ML}%. The ideal is to leave it close to ${HUMEDAD_IDEAL}%.`,
        porque: 'In the first Veggie crop, in 2014, the wicks did not draw up enough water and the crew had to water by hand. In 2015, too much water gave the zinnias mold.',
        segundos: 10,
        min: 0,
        max: 250,
        paso: 10,
        unidad: 'mL',
        inicial: 50,
        objetivo: () => Math.round(HUMEDAD_IDEAL / HUMEDAD_POR_ML / 10) * 10,
        evaluar: (_room, v) => calidadRiego(v * HUMEDAD_POR_ML),
      },
    ],
  }),

  proc({
    id: 'regar',
    titulo: 'Water the garden',
    recurrente: true,
    intro: 'In Veggie the crew waters each pillow with a syringe through a water port. In 2016 Scott Kelly learned that there is no fixed schedule: you look at the plant and the growing medium, and you water when they need it.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'jeringa',
        tipo: 'secuencia',
        titulo: 'Prepare the syringe',
        instruccion: 'Prepare the syringe. Tap the steps in order.',
        porque: 'Without gravity, a bubble does not rise on its own: it gets injected into the pillow and leaves a dry spot. That is why the air is pushed out before connecting.',
        segundos: 8,
        elementos: [
          { id: 'inyectar', nombre: 'Inject the water slowly' },
          { id: 'conectar', nombre: 'Connect to the pillow port' },
          { id: 'desconectar', nombre: 'Disconnect and cap the port' },
          { id: 'purgar', nombre: 'Push the air out of the syringe' },
        ],
        ordenes: [['purgar', 'conectar', 'inyectar', 'desconectar']],
        error: 'The air is pushed out before connecting, and the water is injected with the syringe already connected.',
      },
      {
        id: 'agua',
        tipo: 'ajustar',
        titulo: 'How much water',
        instruccion: (room) => {
          const s = secas(room)
          const min = s.length ? Math.round(Math.min(...s.map((a) => a.humedad))) : 50
          return `${s.length === 1 ? 'One pillow is' : `${s.length} pillows are`} below 50%. The driest is at ${min}%. Each mL raises it by ${HUMEDAD_POR_ML}%. The ideal is to leave it close to ${HUMEDAD_IDEAL}%.`
        },
        porque: 'Too little water leaves the roots thirsty. Too much soaks the clay, the roots cannot breathe and mold appears.',
        segundos: 8,
        min: 0,
        max: 200,
        paso: 10,
        unidad: 'mL',
        inicial: 20,
        objetivo: (room) => {
          const s = secas(room)
          const min = s.length ? Math.min(...s.map((a) => a.humedad)) : HUMEDAD_IDEAL
          return limitar(Math.round((HUMEDAD_IDEAL - min) / HUMEDAD_POR_ML / 10) * 10, 0, 200)
        },
        evaluar: (room, v) => {
          const s = secas(room)
          const min = s.length ? Math.min(...s.map((a) => a.humedad)) : HUMEDAD_IDEAL
          return calidadRiego(Math.min(100, min + v * HUMEDAD_POR_ML))
        },
      },
    ],
  }),

  proc({
    id: 'ralear',
    titulo: 'Thin the seedlings',
    recurrente: true,
    intro: 'Several seeds are planted in each pillow in case some do not sprout. When they grow, only one is left per pillow, as in the first Veggie crop, so they do not compete for water and fertilizer.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'como',
        tipo: 'elegir',
        titulo: 'Leave one per pillow',
        instruccion: 'Several seedlings sprouted in each pillow. What do you do?',
        porque: 'Several plants in the same handful of clay take water and fertilizer from each other, and none of them grows well.',
        segundos: 8,
        opciones: () => [
          { id: 'cortar', texto: 'Keep the strongest and cut the others at the base with scissors', calidad: 1, consecuencia: 'The one that stays has all the growing medium to itself and its roots are not disturbed.' },
          { id: 'arrancar', texto: 'Pull out the extra ones by the roots', calidad: 0.6, consecuencia: 'The roots are tangled: when you pull, you also damage the roots of the plant that stays.' },
          { id: 'dejar', texto: 'Leave them all', calidad: 0.3, consecuencia: 'They compete with each other and grow more slowly.' },
        ],
      },
    ],
  }),

  proc({
    id: 'moho',
    titulo: 'Check the leaves: white spots',
    recurrente: true,
    intro: 'In December 2015 the zinnias on the ISS got covered in mold: water was leaking out of the wicks and the air was barely moving. Scott Kelly cut off the damaged parts and turned up the fan. NASA named him an autonomous gardener so he could decide for himself, without waiting for instructions from Earth.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'revisar',
        tipo: 'mantener',
        titulo: 'Check leaf by leaf',
        instruccion: 'Look at each leaf from above and below. Press and hold while you check.',
        porque: 'Mold starts as white fuzz under the leaves and on the wet growing medium.',
        segundos: 4,
        boton: 'Hold to check',
      },
      {
        id: 'que',
        tipo: 'elegir',
        titulo: 'What to do',
        instruccion: 'Some leaves have white fuzz and the growing medium is soaked. What do you do?',
        porque: 'Mold grows with lots of moisture and little air. You cut off the damaged parts, seal them in a bag so the spores do not spread, and move more air.',
        segundos: 8,
        opciones: () => [
          { id: 'retirar', texto: 'Cut off the moldy leaves, seal them in a bag and turn up the fan', calidad: 1, consecuencia: 'This is what Kelly did. Careful: with more air the growing medium dries faster and you will have to water more often.' },
          { id: 'nada', texto: 'Wait and see if it goes away', calidad: 0.2, consecuencia: 'The mold keeps spreading and weakens the plants.' },
          { id: 'regar', texto: 'Water more so they recover', calidad: 0, consecuencia: 'More water is exactly what the mold needs to grow.' },
        ],
      },
    ],
  }),

  proc({
    id: 'amarillas',
    titulo: 'Check the leaves: drooping leaves',
    recurrente: true,
    intro: 'After fighting the mold, the zinnias on the ISS dried out: the fan on high was carrying the moisture away. Kelly learned to look at the plants and water when they needed it, without waiting for the calendar.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'revisar',
        tipo: 'mantener',
        titulo: 'Check leaf by leaf',
        instruccion: 'Look at the leaves and touch the growing medium. Press and hold while you check.',
        porque: 'Drooping, curled or yellow leaves warn you that something is wrong with the roots.',
        segundos: 4,
        boton: 'Hold to check',
      },
      {
        id: 'que',
        tipo: 'elegir',
        titulo: 'What to do',
        instruccion: 'Some leaves are drooping and turning yellow. What do you do?',
        porque: 'You have to find the cause. Here the leaves droop because the roots lack water.',
        segundos: 8,
        opciones: () => [
          { id: 'regar', texto: 'Measure the moisture of each pillow, water the dry ones and turn down the fan', calidad: 1, consecuencia: 'This goes after the cause. In a few days the leaves perk up.' },
          { id: 'cortar', texto: 'Cut off the yellow leaves and nothing else', calidad: 0.4, consecuencia: 'It looks better, but the roots still have no water.' },
          { id: 'ventilador', texto: 'Turn up the fan', calidad: 0.1, consecuencia: 'It dries the plants out even more. This is what left the zinnias thirsty.' },
        ],
      },
    ],
  }),

  proc({
    id: 'cosechar',
    titulo: 'Harvest',
    recurrente: true,
    intro: 'On August 10, 2015, the ISS crew ate something they had grown for the first time: red romaine lettuce. They cleaned it with citric acid sanitizing wipes, ate half and froze the other half to be analyzed on Earth.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'corte',
        tipo: 'elegir',
        titulo: 'How to harvest',
        instruccion: (room) => `The ${cultivoDe(room).corto} is ready. How do you harvest it?`,
        porque: 'Each plant is harvested based on the part you eat. If you let it regrow, you can harvest again without waiting for the full cycle.',
        segundos: 8,
        opciones: (room) => cultivoDe(room).cortes,
      },
      {
        id: 'consumo',
        tipo: 'elegir',
        titulo: 'Before eating',
        instruccion: 'What do you do with the harvest?',
        porque: 'On Earth, vegetables get washed. In space you cannot rinse them, so they are cleaned with wipes. And part is kept to find out if it is safe.',
        segundos: 8,
        opciones: () => [
          { id: 'mitad', texto: 'Clean it with wipes, eat half and freeze the rest for analysis', calidad: 1, consecuencia: 'Like on the ISS. Fresh food today and data for the next mission.' },
          { id: 'todo', texto: 'Clean it with wipes and eat it all', calidad: 0.8, consecuencia: 'More fresh food today, but nobody will know if it was free of microbes.' },
          { id: 'sucia', texto: 'Eat it without cleaning', calidad: 0, repetir: true, consecuencia: 'No. The leaves may carry microbes from the habitat. Clean them with the wipes first.' },
        ],
      },
    ],
  }),
]
export const PROC_BY_ID = Object.fromEntries(PROCEDIMIENTOS.map((p) => [p.id, p])) as Record<string, Procedimiento>
/** Procedimiento que monta cada tarea de la base. */
export const procDeTarea = (tareaId: string) => PROCEDIMIENTOS.find((p) => p.tarea === tareaId)

// ---------- Cuándo toca cada procedimiento ----------

const FASES_HUERTO = ['transito', 'llegada', 'ensamblaje', 'base']

/** ¿Se puede hacer ahora este procedimiento? */
export function disponible(room: RoomState, p: Procedimiento): boolean {
  if (p.tarea) {
    const t = tarea(p.tarea)
    return room.fase === 'ensamblaje' && t.paso === room.ensamblaje.paso && !room.ensamblaje.hechas[t.id]
  }
  const h = room.huerto
  if (!FASES_HUERTO.includes(room.fase)) return false
  if (p.id === 'huerto') return room.cargamento.huerto > 0 && !h.establecido
  if (!h.establecido || !h.almohadillas) return false
  const vv = vivas(room)
  const enCurso = room.procedimientos?.[p.id] && !room.procedimientos[p.id].terminado && room.procedimientos[p.id].paso > 0
  switch (p.id) {
    case 'regar':
      return Boolean(enCurso) || vv.some((a) => a.humedad < 40)
    case 'ralear':
      return vv.some((a) => !a.raleada && a.plantulas > 1 && a.crecimiento >= 0.12)
    case 'moho':
      return vv.some((a) => a.moho >= 0.25)
    case 'amarillas':
      return !vv.some((a) => a.moho >= 0.25) && vv.some((a) => a.salud < 70) && room.t - (h.revisado ?? -1e9) > 2 * 86400
    case 'cosechar':
      return Boolean(enCurso) || vv.some((a) => a.crecimiento >= 1)
  }
  return false
}

/** Índice del primer paso desde `desde` que aplica a esta misión. */
export function siguienteAplicable(room: RoomState, p: Procedimiento, desde: number): number {
  let i = desde
  while (i < p.pasos.length && p.pasos[i].aplica && !p.pasos[i].aplica!(room)) i++
  return i
}

/** Paso que toca ahora en un procedimiento. */
export const pasoActual = (room: RoomState, p: Procedimiento) => siguienteAplicable(room, p, room.procedimientos?.[p.id]?.paso ?? 0)

/** Lo que se puede hacer ahora, con el paso que toca. */
export const activos = (room: RoomState) =>
  PROCEDIMIENTOS.filter((p) => disponible(room, p)).map((p) => ({ proc: p, paso: pasoActual(room, p) })).filter((x) => x.paso < x.proc.pasos.length)

export const textoDe = (room: RoomState, t: string | ((room: RoomState) => string)) => (typeof t === 'function' ? t(room) : t)

// ---------- Evaluar un paso ----------

export type Evaluacion =
  | { ok: false; mensaje: string }
  | { ok: true; calidad: number; mensaje: string; valor: number | string | null }

/** Un orden parcial es válido si empieza como alguno de los órdenes correctos. */
export const prefijoValido = (paso: PasoSecuencia, orden: string[]) => paso.ordenes.some((o) => orden.every((id, i) => o[i] === id))

/** Qué tan bien está hecho un paso con el valor dado. La misma regla en el servidor y en pantalla. */
export function evaluarPaso(room: RoomState, p: Procedimiento, i: number, valor: unknown): Evaluacion {
  const paso = p.pasos[i]
  if (!paso) return { ok: false, mensaje: 'Invalid step.' }
  switch (paso.tipo) {
    case 'mantener': {
      const s = Number(valor)
      if (!Number.isFinite(s) || s < paso.segundos - 0.3) return { ok: false, mensaje: 'You have to hold it until the end.' }
      return { ok: true, calidad: 1, mensaje: 'Done.', valor: paso.segundos }
    }
    case 'secuencia': {
      const v = (valor && typeof valor === 'object' ? valor : {}) as { orden?: unknown; errores?: unknown }
      const orden = Array.isArray(v.orden) ? v.orden.map(String) : []
      const errores = Math.max(0, Math.min(10, Math.round(Number(v.errores) || 0)))
      if (orden.length !== paso.elementos.length || !prefijoValido(paso, orden)) return { ok: false, mensaje: paso.error }
      const calidad = r2(Math.max(0.4, 1 - 0.15 * errores))
      return { ok: true, calidad, mensaje: errores ? `Correct order, after ${errores === 1 ? 'one mistake' : `${errores} mistakes`}.` : 'Correct order.', valor: errores }
    }
    case 'ajustar': {
      const v = Number(valor)
      if (!Number.isFinite(v) || v < paso.min || v > paso.max) return { ok: false, mensaje: `The value has to be between ${paso.min} and ${paso.max} ${paso.unidad}.` }
      const redondo = Math.round(v / paso.paso) * paso.paso
      const e = paso.evaluar(room, r2(redondo))
      return { ok: true, calidad: e.calidad, mensaje: e.mensaje, valor: r2(redondo) }
    }
    case 'elegir': {
      const o = paso.opciones(room).find((x) => x.id === valor)
      if (!o) return { ok: false, mensaje: 'Invalid option.' }
      if (o.repetir) return { ok: false, mensaje: o.consecuencia }
      return { ok: true, calidad: o.calidad, mensaje: o.consecuencia, valor: o.id }
    }
    case 'comprobar': {
      if (valor !== 'pasa' && valor !== 'falla') return { ok: false, mensaje: 'Decide if the check passes or fails.' }
      const l = paso.lectura(room)
      if (valor === 'falla' && l.correcto === 'pasa') return { ok: false, mensaje: `Look again. ${l.explicacion}` }
      return { ok: true, calidad: valor === l.correcto ? 1 : 0, mensaje: valor === l.correcto ? l.explicacion : 'It is marked as good.', valor }
    }
  }
}

/** Lo que haría alguien con experiencia en ese paso. */
export function valorDeExperto(room: RoomState, p: Procedimiento, i: number): unknown {
  const paso = p.pasos[i]
  if (!paso) return null
  switch (paso.tipo) {
    case 'mantener':
      return paso.segundos
    case 'secuencia':
      return { orden: paso.ordenes[0], errores: 0 }
    case 'ajustar':
      return paso.objetivo(room)
    case 'elegir': {
      const ops = paso.opciones(room).filter((o) => !o.repetir)
      return [...ops].sort((a, b) => b.calidad - a.calidad)[0]?.id ?? null
    }
    case 'comprobar':
      return paso.lectura(room).correcto
  }
}
