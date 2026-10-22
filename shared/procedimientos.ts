// Procedimientos por pasos: cómo se monta de verdad cada parte de la base y cómo se cuida un
// huerto en el espacio. Cada procedimiento explica cómo se hace en la vida real y se divide en
// pasos con una interacción propia (mantener, ordenar, ajustar, elegir o leer un instrumento).
//
// Los usan igual el servidor (que valida y aplica las consecuencias, server/procedimientos.ts)
// y la pantalla (que da la respuesta inmediata, src/hud/Procedimiento.tsx). Los datos reales
// tienen su fuente en FUENTES de shared/ciencia.ts; lo que es del juego está en SUPUESTOS.
import { C } from './ciencia.js'
import { SISTEMA_BY_ID, SITE_BY_ID, TAREAS_ENSAMBLAJE, type CultivoId, type Player, type Role, type RoomState, type SistemaId, type Zona } from './types.js'

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
  /** Texto de los dos botones (pasa, falla), si no son «Pass» y «Fail». */
  botones?: [string, string]
  /** En las barras, la que se destaca (si no, se destacan las que pasan del límite). */
  resaltar?: string
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
  /** Al terminar este paso, quien lo hizo cruza la esclusa y queda en esta zona. */
  cambiaZona?: Zona
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
  /**
   * Trabajo que alguien empieza a mano cuando hace falta (reparar, curar, salir...). No se
   * anuncia como pendiente: se ofrece en el panel de su estación y los bots lo eligen según su rol.
   */
  aDemanda?: boolean
  /** Solo lo hace este jugador (ponerse su traje, analizar sus muestras). */
  jugador?: string
  /** Sobre qué se hace, en los trabajos con instancia (en `reparar:oga` es 'oga'). */
  objetivo?: string
  /** Frase corta que se muestra antes de empezar. */
  resumen?: string
  /** ¿Se puede empezar ahora? (Si ya está a medias, siempre se puede seguir.) */
  puedeEmpezar?: (room: RoomState) => boolean
  /** Por qué no se puede empezar ahora. */
  motivo?: (room: RoomState) => string
  /** Si lo que quedó a medias todavía vale (si no, se empieza de cero). */
  sigue?: (room: RoomState) => boolean
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

/** Un paso sin roles, zona ni estación: los hereda del procedimiento, salvo que diga los suyos. */
type PasoLocal = Paso extends infer T ? (T extends Paso ? Omit<T, 'roles' | 'zona' | 'estacion'> & Partial<Pick<T, 'roles' | 'zona' | 'estacion'>> : never) : never

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
// ---------- Trabajos de la tripulación: salir, reparar, curar, tomar y analizar muestras ----------
//
// Son trabajos que alguien empieza cuando hacen falta, no tareas que anuncia el montaje. Los que
// dependen de algo (qué equipo, qué sitio, qué paciente, quién se pone el traje) se crean como
// instancias con id `familia:objetivo`, por ejemplo `reparar:oga` o `salida:u1`; su estado se
// guarda en room.procedimientos con ese mismo id. Las consecuencias están en server/trabajos.ts.

const TODOS: Role[] = ['comandante', 'piloto', 'medico', 'logistica', 'cientifico', 'sistemas']
/** Por debajo de esta integridad un equipo deja de funcionar (igual que UMBRAL_AVERIA del servidor). */
const AVERIA = 15
export const SITIOS_MUESTRA = ['muestra1', 'muestra2', 'muestra3', 'muestra4', 'muestra5', 'muestra6', 'muestra7', 'muestra8']
/** Muestras que se pueden cargar antes de volver al laboratorio. */
export const MAX_MUESTRAS = 3
/** Valor mínimo (de 0 a 1) para que una muestra analizada cuente para el objetivo (modelo del juego). */
export const VALOR_MINIMO_MUESTRA = 0.6

const enLaSuperficie = (room: RoomState) => room.tAterrizaje > 0 && room.t >= room.tAterrizaje
const jugadorDe = (room: RoomState, id: string): Player | undefined => room.jugadores.find((j) => j.id === id)
const datosDe = (room: RoomState, id: string) => room.procedimientos?.[id]?.datos ?? {}
const valoresDe = (room: RoomState, id: string) => room.procedimientos?.[id]?.valores ?? []
const trajeCargado = (j: Player) => j.trajeO2 >= C.TRAJE_O2_KG * 0.3 && j.trajeBateria >= 0.3
/** Número estable a partir de un texto, para ordenar opciones sin azar. */
const hash = (s: string) => {
  let h = 7
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}
const rotar = <T,>(lista: T[], n: number) => lista.map((_, i) => lista[(i + n) % lista.length])
const ruido = (semilla: number, k: number) => Math.sin(semilla * 7.3 + k * 2.1)

/** Kits de repuestos que pide una reparación según lo gastado que está el equipo. */
export const kitsReparacion = (integridad: number) => (integridad <= 30 ? 2 : 1)

/** Dónde se repara cada equipo: los de fuera, en la superficie, se reparan con el traje puesto. */
export function estacionSistema(room: RoomState, id: SistemaId): { estacion: string; zona: Zona } {
  const fuera = SISTEMA_BY_ID[id].exterior && enLaSuperficie(room)
  switch (id) {
    case 'energia':
      return fuera ? { estacion: 'plantaExt', zona: 'exterior' } : { estacion: 'energia', zona: 'nave' }
    case 'isru':
      return { estacion: 'isruExt', zona: 'exterior' }
    case 'esclusa':
      return { estacion: 'esclusa', zona: 'nave' }
    case 'huerto':
      return { estacion: 'laboratorio', zona: 'nave' }
    default:
      return { estacion: 'soporte', zona: 'nave' }
  }
}

/** Riesgo de enfermedad por descompresión según el plan de prerrespiración (modelo del juego). */
export const RIESGO_DCS: Record<string, number> = { isle: 0, cuatro: 0, corto: 0.4, nada: 0.7 }
/** Oxígeno de más que pierde por hora un traje con una fuga que no se arregló (modelo del juego). */
export const FUGA_TRAJE_KG_H = 0.08

/** Las piezas del traje, en un orden que no es el de ponérselo. */
const PIEZAS_TRAJE = [
  { id: 'casco', nombre: 'Helmet' },
  { id: 'inferior', nombre: 'Lower torso: pants and boots' },
  { id: 'guantes', nombre: 'Gloves' },
  { id: 'lcvg', nombre: 'Liquid cooling garment' },
  { id: 'gorro', nombre: 'Comm cap with earphones and microphone' },
  { id: 'superior', nombre: 'Hard upper torso' },
]

function salida(pid: string): Procedimiento {
  const id = `salida:${pid}`
  return proc({
    id,
    titulo: 'Suit up and go outside',
    aDemanda: true,
    recurrente: true,
    jugador: pid,
    objetivo: pid,
    resumen: 'Put on the suit, check it for leaks, breathe pure oxygen and pump down the airlock.',
    intro:
      'A spacewalk starts hours before the hatch opens. The suit runs on pure oxygen at only 29.6 kPa, so the body first has to get rid of the nitrogen it holds. If not, bubbles form when the pressure drops: decompression sickness, the bends. On the ISS the crew uses the In-Suit Light Exercise protocol: 40 minutes on an oxygen mask, the airlock lowered to 70.3 kPa, and light exercise in the suit. NASA recommends that Moon and Mars habitats live at 56.5 kPa with 34% oxygen, where a 20-minute prebreathe is enough. This habitat keeps the ISS atmosphere of 101.3 kPa, so the prebreathe is longer.',
    roles: TODOS,
    zona: 'nave',
    estacion: 'esclusa',
    sigue: (room) => jugadorDe(room, pid)?.zona === 'nave',
    puedeEmpezar: (room) => {
      const j = jugadorDe(room, pid)
      const esclusa = room.sistemas.find((s) => s.id === 'esclusa')
      return Boolean(
        j?.rol && j.zona === 'nave' && enLaSuperficie(room) && (room.fase === 'ensamblaje' || room.fase === 'base') &&
          !j.enRefugio && j.incapacitado <= 0 && (esclusa?.integridad ?? 0) > AVERIA && trajeCargado(j),
      )
    },
    motivo: (room) => {
      const j = jugadorDe(room, pid)
      if (!j) return 'Player not found.'
      if (j.zona !== 'nave') return 'You are already outside.'
      if (!enLaSuperficie(room) || (room.fase !== 'ensamblaje' && room.fase !== 'base')) return 'You can only go outside once the ship is on Mars.'
      if (j.incapacitado > 0) return 'You are out of action. You need rest or the Flight Surgeon.'
      if (j.enRefugio) return 'You are in the Storm Shelter. You cannot work until you leave.'
      if ((room.sistemas.find((s) => s.id === 'esclusa')?.integridad ?? 0) <= AVERIA) return 'The Airlock is broken. The Systems Engineer must repair it.'
      if (!trajeCargado(j)) return 'Your suit is not charged. Wait for the Airlock to recharge it.'
      return 'You cannot go outside right now.'
    },
    pasos: [
      {
        id: 'vestir',
        tipo: 'secuencia',
        titulo: 'Put on the suit',
        instruccion: 'Put on each part of the suit. Tap them in the order you put them on.',
        porque: 'The cooling garment goes against the skin, so it goes first. Then come the pants and boots, and you dive up into the hard upper torso while a crewmate locks the waist ring. The comm cap, the helmet and the gloves go last and seal the suit.',
        segundos: 12,
        elementos: PIEZAS_TRAJE,
        ordenes: [['lcvg', 'inferior', 'superior', 'gorro', 'casco', 'guantes']],
        error: 'The cooling garment touches the skin, so it goes on first. The pants go on before the upper torso, and the helmet and gloves go on last.',
      },
      {
        id: 'fugas',
        tipo: 'comprobar',
        titulo: 'Suit leak check',
        instruccion: 'The suit is pressurized 29.6 kPa above the airlock and its oxygen supply is closed. Watch the pressure for 5 minutes.',
        porque: 'A small leak is normal, up to 1.38 kPa per minute. More than that and the suit would lose its oxygen outside. If it fails, you check every seal and do the test again.',
        segundos: 10,
        lectura: (room) => {
          const d = datosDe(room, id)
          const fuga = (d.fuga ?? 0) > 0
          const s = d.semilla ?? 1
          const tasa = fuga ? 2 + (s % 5) * 0.25 : 0.08 + (s % 4) * 0.02
          const puntos = Array.from({ length: 11 }, (_, k) => ({ x: k / 2, y: r2(29.6 - tasa * (k / 2) + ruido(s, k) * 0.05) }))
          return {
            forma: 'linea',
            titulo: 'Suit pressure above the airlock',
            unidad: 'kPa',
            eje: 'minutes',
            puntos,
            limite: r1(29.6 - 1.38 * 5),
            limiteTexto: 'Maximum drop: 1.38 kPa per minute',
            pregunta: 'Is the suit tight enough to go outside?',
            correcto: fuga ? 'falla' : 'pasa',
            explicacion: fuga
              ? `The suit loses ${r1(tasa)} kPa per minute. That is more than 1.38: a seal is not closed.`
              : `The suit loses only ${r2(tasa)} kPa per minute. A small leak like this is normal.`,
          }
        },
      },
      {
        id: 'protocolo',
        tipo: 'elegir',
        titulo: 'Prebreathe plan',
        instruccion: `The habitat is at ${C.PRESION_KPA} kPa with 21% oxygen, and the suit will be at ${C.TRAJE_PRESION_KPA} kPa. How do you get the nitrogen out of your body?`,
        porque: 'Breathing pure oxygen lets the nitrogen dissolved in your body leave through the lungs. The bigger the pressure drop, the longer it takes.',
        segundos: 8,
        opciones: () => [
          { id: 'isle', texto: 'The ISS protocol: 40 minutes on an oxygen mask, the airlock lowered to 70.3 kPa, then light exercise in the suit', calidad: 1, consecuencia: 'The protocol the ISS has used since 2011. It takes a few hours, and the bends are rare.' },
          { id: 'cuatro', texto: 'Four hours of pure oxygen in the suit at cabin pressure', calidad: 0.8, consecuencia: 'It is safe, but you spend four hours in the suit before you start working. You go outside tired.' },
          { id: 'corto', texto: 'Only 20 minutes, like the exploration atmosphere protocol', calidad: 0.2, consecuencia: 'That protocol was tested on people who live at 56.5 kPa, whose bodies hold much less nitrogen. From 101.3 kPa it is far too short: the risk of the bends is high.' },
          { id: 'nada', texto: 'Skip it and go out now', calidad: 0, consecuencia: 'All the nitrogen is still in your body. When the pressure drops, bubbles can form in your joints and blood.' },
        ],
      },
      {
        id: 'oxigeno',
        tipo: 'mantener',
        titulo: 'Breathe pure oxygen',
        instruccion: 'Breathe pure oxygen and do not take a breath of cabin air. Press and hold until the prebreathe is over.',
        porque: 'One breath of cabin air brings nitrogen back. On the ISS, a break in the prebreathe adds time or forces a restart.',
        segundos: 8,
        boton: 'Hold to prebreathe',
      },
      {
        id: 'despresurizar',
        tipo: 'mantener',
        titulo: 'Pump down the airlock',
        instruccion: 'Close the inner hatch and pump the air out of the airlock. Press and hold while the pressure drops.',
        porque: 'On the Space Shuttle the pump-down paused at 34.5 kPa to check the suits for leaks once more. A problem found there can still be fixed with the hatch closed.',
        segundos: 6,
        boton: 'Hold to pump down',
      },
      {
        id: 'radio',
        tipo: 'elegir',
        titulo: 'Final checks',
        instruccion: 'The airlock is at Mars pressure. What do you do before you open the outer hatch?',
        porque: 'Spacewalkers check each other and keep radio contact with the habitat. A problem caught inside the airlock is easy to fix. Outside, it is not.',
        segundos: 6,
        cambiaZona: 'exterior',
        opciones: () => [
          { id: 'radio', texto: 'Do a radio check with the habitat and have a crewmate read your suit display', calidad: 1, consecuencia: 'The habitat hears you clearly and someone else has seen that your suit is working.' },
          { id: 'solo', texto: 'Skip the radio check and open the hatch', calidad: 0.5, consecuencia: 'You go outside without knowing if the habitat can hear you if something goes wrong.' },
        ],
      },
    ],
  })
}

function entrada(pid: string): Procedimiento {
  const orden = ['guantes', 'casco', 'gorro', 'superior', 'inferior', 'lcvg']
  return proc({
    id: `entrada:${pid}`,
    titulo: 'Come back inside',
    aDemanda: true,
    recurrente: true,
    jugador: pid,
    objetivo: pid,
    resumen: 'Brush off the dust, close the hatch, repressurize and take off the suit.',
    intro:
      'Coming in is a procedure too. The dust has to stay outside: it is very fine and clings to the suit, and in 2008 the Phoenix lander found perchlorate salts in the soil, which are harmful to people. Then the outer hatch is closed, the airlock fills with air again and the suit comes off in the reverse order. Inside, the airlock recharges the suit.',
    roles: TODOS,
    zona: 'exterior',
    estacion: 'esclusaExt',
    puedeEmpezar: (room) => jugadorDe(room, pid)?.zona === 'exterior',
    sigue: (room) => jugadorDe(room, pid)?.zona === 'exterior' || (room.procedimientos?.[`entrada:${pid}`]?.paso ?? 0) >= 2,
    motivo: () => 'You are already inside.',
    pasos: [
      {
        id: 'polvo',
        tipo: 'elegir',
        titulo: 'Remove the dust',
        instruccion: 'Your suit is covered in fine red dust. What do you do before you go in?',
        porque: 'Whatever dust comes in ends up in the air the crew breathes and in the filters of the life support equipment.',
        segundos: 8,
        opciones: () => [
          { id: 'cepillar', texto: 'Brush the suit down outside, from the helmet to the boots', calidad: 1, consecuencia: 'Most of the dust stays on Mars.' },
          { id: 'dentro', texto: 'Go in and clean up inside', calidad: 0.3, consecuencia: 'The dust comes into the habitat. It clogs the air filters and the crew breathes it.' },
        ],
      },
      {
        id: 'presurizar',
        tipo: 'mantener',
        titulo: 'Close the hatch and repressurize',
        instruccion: 'Close the outer hatch and fill the airlock with air. Press and hold while the pressure rises.',
        porque: 'The pressure goes up slowly so your ears can adjust. You swallow or yawn to clear them.',
        segundos: 6,
        boton: 'Hold to repressurize',
        cambiaZona: 'nave',
      },
      {
        id: 'quitar',
        tipo: 'secuencia',
        titulo: 'Take off the suit',
        instruccion: 'Take off each part of the suit. Tap them in the order you take them off.',
        porque: 'The suit comes off in the reverse order. Plugged into the airlock, it recharges its oxygen and battery.',
        segundos: 10,
        zona: 'nave',
        estacion: 'esclusa',
        elementos: PIEZAS_TRAJE,
        ordenes: [orden, ['casco', 'guantes', ...orden.slice(2)]],
        error: 'It comes off in the reverse order: helmet and gloves first, the cooling garment last.',
      },
    ],
  })
}

function reparar(sid: string, room?: RoomState): Procedimiento {
  const id = `reparar:${sid}`
  const sistema = sid as SistemaId
  const info = SISTEMA_BY_ID[sistema]
  const lugar = room && info ? estacionSistema(room, sistema) : { estacion: 'soporte', zona: 'nave' as Zona }
  const estado = (r: RoomState) => r.sistemas.find((s) => s.id === sistema)
  const nombre = info?.nombre ?? 'equipment'
  const kits = room ? kitsReparacion(estado(room)?.integridad ?? 100) : 1
  return proc({
    id,
    titulo: `Repair the ${nombre}`,
    aDemanda: true,
    recurrente: true,
    objetivo: sid,
    resumen: `Swap the worn unit for a spare from the kit. It uses ${kits === 1 ? 'one spare parts kit' : `${kits} spare parts kits`}.`,
    intro:
      'The ISS is built from Orbital Replacement Units: boxes that the crew swaps for a spare instead of fixing them on the spot. In March 2015, Terry Virts removed and replaced the hydrogen sensor of the station oxygen generator as routine maintenance. The swap always follows the same order: make the unit safe, take out the old one, put in the spare, reconnect it in order and test it.',
    roles: ['sistemas'],
    zona: lugar.zona,
    estacion: lugar.estacion,
    puedeEmpezar: (r) => {
      const s = estado(r)
      return Boolean(s?.instalado && s.integridad < 95 && r.rec.repuestos >= kitsReparacion(s.integridad) && ['transito', 'llegada', 'ensamblaje', 'base'].includes(r.fase))
    },
    motivo: (r) => {
      const s = estado(r)
      if (!s?.instalado) return 'That equipment is not installed.'
      if (s.integridad >= 95) return 'That equipment is in good shape.'
      const n = kitsReparacion(s.integridad)
      if (r.rec.repuestos < n) return `You need ${n} spare parts kit${n > 1 ? 's' : ''} and ${r.rec.repuestos} ${r.rec.repuestos === 1 ? 'is' : 'are'} left.`
      return 'You cannot repair it right now.'
    },
    pasos: [
      {
        id: 'seguro',
        tipo: 'elegir',
        titulo: 'Power down and lock out',
        instruccion: `You are about to open the ${nombre}. How do you make it safe?`,
        porque: 'Before you put your hands inside, the unit is switched off, its breaker gets a lock and a tag, and you measure that there is no voltage. Then nobody can switch it on while you work.',
        segundos: 8,
        opciones: () => [
          { id: 'bloqueo', texto: 'Switch it off, lock and tag the breaker, and measure that there is no voltage', calidad: 1, consecuencia: 'Nobody can power it while your hands are inside, and the meter proves it is dead.' },
          { id: 'apagar', texto: 'Switch it off and start', calidad: 0.6, consecuencia: 'Without a lock, someone who does not know you are working could switch it back on.' },
          { id: 'caliente', texto: 'Leave it running so the base does not lose it', calidad: 0, repetir: true, consecuencia: 'No. Live connectors and moving parts can burn or crush your hand. Choose another way.' },
        ],
      },
      {
        id: 'retirar',
        tipo: 'secuencia',
        titulo: 'Remove the failed unit',
        instruccion: 'Take out the worn unit. Tap the steps in the order you do them.',
        porque: 'Fluid lines and connectors are closed and capped first, so nothing leaks or shorts. The bolts come out last, so the unit never hangs from its cables or hoses.',
        segundos: 10,
        elementos: [
          { id: 'extraer', nombre: 'Slide out the failed unit' },
          { id: 'conectores', nombre: 'Unplug the connectors and cap them' },
          { id: 'valvulas', nombre: 'Close the fluid valves' },
          { id: 'pernos', nombre: 'Undo the mounting bolts' },
        ],
        ordenes: [
          ['valvulas', 'conectores', 'pernos', 'extraer'],
          ['conectores', 'valvulas', 'pernos', 'extraer'],
        ],
        error: 'First close the valves and unplug the unit. The bolts come out last, so the unit does not hang from its cables or hoses.',
      },
      {
        id: 'instalar',
        tipo: 'mantener',
        titulo: 'Install the spare',
        instruccion: 'Slide the spare unit from the kit into place and tighten its bolts. Press and hold while you install it.',
        porque: 'A unit that is not fully seated fails the test, or fails later when nobody is watching.',
        segundos: 8,
        boton: 'Hold to install',
      },
      {
        id: 'reconectar',
        tipo: 'secuencia',
        titulo: 'Reconnect in order',
        instruccion: 'Connect the new unit. Tap the steps in the order you do them.',
        porque: 'Fluids and data first, then power. The lock comes off last, when everything is connected and nobody has their hands inside.',
        segundos: 10,
        elementos: [
          { id: 'bloqueo', nombre: 'Remove the lock and tag' },
          { id: 'energia', nombre: 'Plug in the power connector' },
          { id: 'fluidos', nombre: 'Open the fluid valves and check for drips' },
          { id: 'datos', nombre: 'Plug in the data connector' },
        ],
        ordenes: [
          ['fluidos', 'datos', 'energia', 'bloqueo'],
          ['datos', 'fluidos', 'energia', 'bloqueo'],
        ],
        error: 'Power goes in after the fluid and data lines, and the lock comes off last.',
      },
      {
        id: 'prueba',
        tipo: 'comprobar',
        titulo: 'Checkout test',
        instruccion: `Switch the ${nombre} back on and watch its output for 10 minutes.`,
        porque: 'A repair is not done until the test shows the unit works. If it does not, you look for the connector that is not seated and test again.',
        segundos: 10,
        lectura: (r) => {
          const d = datosDe(r, id)
          const fallo = (d.fallo ?? 0) > 0
          const s = d.semilla ?? 1
          const techo = fallo ? 55 + (s % 5) * 3 : 100
          const puntos = Array.from({ length: 11 }, (_, k) => ({ x: k, y: r1(techo * (1 - Math.exp(-k / 2)) + ruido(s, k) * 1.2) }))
          return {
            forma: 'linea',
            titulo: `Output of the ${nombre}`,
            unidad: '%',
            eje: 'minutes',
            puntos,
            limite: 90,
            limiteTexto: 'Minimum: 90% of its rated output',
            pregunta: 'Does the new unit work as it should?',
            correcto: fallo ? 'falla' : 'pasa',
            explicacion: fallo ? `The output stays at about ${techo}%. A connector is not fully seated.` : 'The output reaches its rated value. The swap worked.',
          }
        },
      },
    ],
  })
}

const sellar = proc({
  id: 'sellar',
  titulo: 'Seal the pressure leak',
  aDemanda: true,
  recurrente: true,
  resumen: 'Find where the air escapes, patch it and check that the pressure holds. It uses one spare parts kit.',
  intro:
    'In August 2018 the ISS crew traced a slow pressure drop to a 2 mm hole in a Soyuz. They covered it with Kapton tape, then with a cloth soaked in sealant, and the pressure held. In 2020 another crew closed the hatches between modules to find the leaking section, then released tea leaves and watched them drift toward a crack.',
  roles: ['sistemas'],
  zona: 'nave',
  estacion: 'soporte',
  puedeEmpezar: (r) => r.cabina.fuga > 0 && r.rec.repuestos >= 1 && ['transito', 'llegada', 'ensamblaje', 'base'].includes(r.fase),
  motivo: (r) => (r.cabina.fuga <= 0 ? 'There is no leak.' : r.rec.repuestos < 1 ? 'No spare parts left.' : 'You cannot seal it right now.'),
  pasos: [
    {
      id: 'buscar',
      tipo: 'elegir',
      titulo: 'Find the leak',
      instruccion: (r) => `The cabin is losing ${r.cabina.fuga} kg of air per hour. How do you find where it escapes?`,
      porque: 'A small hole is hard to see and hard to hear. First you narrow down the section, then you look for the exact spot.',
      segundos: 8,
      opciones: (r) => [
        { id: 'aislar', texto: 'Close the hatches between sections and see which one loses pressure', calidad: 1, consecuencia: 'The pressure only drops in the leaking section. Then you only have to search there.' },
        enLaSuperficie(r)
          ? { id: 'te', texto: 'Release tea leaves and watch where the air carries them', calidad: 0.4, consecuencia: 'On Mars the leaves fall to the floor before the air can carry them. That trick worked on the ISS because there is no gravity.' }
          : { id: 'te', texto: 'Release tea leaves and watch where the air carries them', calidad: 0.8, consecuencia: 'Without gravity the leaves drift toward the hole, as on the ISS in 2020. Without closing hatches first, you search the whole ship.' },
        { id: 'esperar', texto: 'Wait until the leak gets louder and easier to hear', calidad: 0.1, consecuencia: 'Air is lost every hour you wait.' },
      ],
    },
    {
      id: 'parche',
      tipo: 'elegir',
      titulo: 'Choose the patch',
      instruccion: 'You found a small crack in the wall. How do you patch it?',
      porque: 'Tape stops the leak at once. The sealant on top makes the repair last.',
      segundos: 8,
      opciones: () => [
        { id: 'doble', texto: 'Kapton tape over the crack, then a cloth soaked in sealant on top', calidad: 1, consecuencia: 'What the ISS crew did in 2018. The tape stops the air and the sealant makes it last.' },
        { id: 'sellante', texto: 'Only sealant, pressed into the crack', calidad: 0.7, consecuencia: 'The air pushes on the wet sealant before it sets. It may leave a small leak.' },
        { id: 'cinta', texto: 'Only Kapton tape', calidad: 0.5, consecuencia: 'Tape alone is a temporary fix. It can lift at the edges and the leak comes back.' },
      ],
    },
    {
      id: 'presionar',
      tipo: 'mantener',
      titulo: 'Apply the patch',
      instruccion: 'Press the patch down and hold it while the sealant sets. Press and hold.',
      porque: 'If you let go too soon, the patch lifts at the edges and the air finds its way out.',
      segundos: 6,
      boton: 'Hold the patch',
    },
    {
      id: 'decaimiento',
      tipo: 'comprobar',
      titulo: 'Pressure decay check',
      instruccion: 'Close the section and watch its pressure for one hour.',
      porque: 'A repair is checked the same way a leak is found: if the pressure keeps dropping, air is still escaping.',
      segundos: 10,
      lectura: (r) => {
        const d = datosDe(r, 'sellar')
        const resto = (d.resto ?? 0) > 0
        const s = d.semilla ?? 1
        const caida = resto ? 0.025 + (s % 4) * 0.005 : 0.002
        const puntos = Array.from({ length: 11 }, (_, k) => ({ x: k * 6, y: r2(C.PRESION_KPA - caida * k * 6 + ruido(s, k) * 0.03) }))
        return {
          forma: 'linea',
          titulo: 'Section pressure',
          unidad: 'kPa',
          eje: 'minutes',
          puntos,
          limite: r1(C.PRESION_KPA - 0.5),
          limiteTexto: 'Maximum drop: 0.5 kPa in one hour',
          pregunta: 'Does the patch hold?',
          correcto: resto ? 'falla' : 'pasa',
          explicacion: resto ? `The pressure dropped ${r1(caida * 60)} kPa in an hour. Air is still escaping at the edge of the patch.` : 'The pressure holds. The small ups and downs are sensor noise.',
        }
      },
    },
  ],
})

const lioh = proc({
  id: 'lioh',
  titulo: 'Swap a lithium hydroxide cartridge',
  aDemanda: true,
  recurrente: true,
  resumen: `Put in a fresh cartridge. It absorbs ${C.LIOH_KG_CO2} kg of CO2 with no electricity.`,
  intro:
    'Lithium hydroxide traps CO2 with no power: two molecules of LiOH and one of CO2 give lithium carbonate and water. The Space Shuttle pushed cabin air through two LiOH canisters, and the crew replaced them when they were spent. On Apollo 13 the crew built an adapter so the command module canisters fit in the lunar module.',
  roles: ['logistica', 'sistemas'],
  zona: 'nave',
  estacion: 'soporte',
  puedeEmpezar: (r) => r.rec.lioh >= 1 && ['transito', 'llegada', 'ensamblaje', 'base'].includes(r.fase),
  motivo: () => 'No cartridges left.',
  pasos: [
    {
      id: 'cambio',
      tipo: 'secuencia',
      titulo: 'Swap the cartridge',
      instruccion: 'Change the cartridge. Tap the steps in the order you do them.',
      porque: 'Lithium hydroxide is a strong base and its dust burns the eyes and skin. With the fan off, nothing blows it into the cabin while the canister is open.',
      segundos: 10,
      elementos: [
        { id: 'insertar', nombre: 'Insert the new cartridge and close the latches' },
        { id: 'encender', nombre: 'Turn the fan back on' },
        { id: 'ventilador', nombre: 'Turn off the fan that pushes air through it' },
        { id: 'retirar', nombre: 'Take out the spent cartridge and seal it in a bag' },
      ],
      ordenes: [['ventilador', 'retirar', 'insertar', 'encender']],
      error: 'Turn off the fan first, take the old cartridge out before the new one goes in, and turn the fan on last.',
    },
    {
      id: 'co2',
      tipo: 'comprobar',
      titulo: 'Read the CO2 trend',
      instruccion: 'Watch the CO2 in the cabin air for 30 minutes after the swap.',
      porque: 'If the cartridge is not sealed in its socket, the air goes around it instead of through it and the CO2 does not drop.',
      segundos: 10,
      lectura: (r) => {
        const d = datosDe(r, 'lioh')
        const malo = (d.malo ?? 0) > 0
        const s = d.semilla ?? 1
        const v0 = (d.co2 ?? 30) / 10
        const fin = malo ? v0 * 1.08 + 0.3 : Math.max(0.4, v0 * 0.55)
        const puntos = Array.from({ length: 11 }, (_, k) => ({ x: k * 3, y: r2(Math.max(0.1, v0 + ((fin - v0) * k) / 10 + ruido(s, k) * 0.04)) }))
        return {
          forma: 'linea',
          titulo: 'Cabin CO2',
          unidad: 'mmHg',
          eje: 'minutes',
          puntos,
          limite: 3,
          limiteTexto: 'NASA limit: 3 mmHg',
          pregunta: 'Is the new cartridge removing CO2?',
          correcto: malo ? 'falla' : 'pasa',
          explicacion: malo ? 'The CO2 is not dropping. The cartridge is not sealed in its socket and the air goes around it.' : 'The CO2 is dropping. The air goes through the new cartridge.',
          botones: ['It is working', 'It is not working'],
        }
      },
    },
  ],
})

const limpiar = proc({
  id: 'limpiar',
  titulo: 'Clean the solar panels',
  aDemanda: true,
  recurrente: true,
  resumen: 'Brush the dust off the panels without scratching them.',
  intro:
    'Dust slowly covered the panels of the InSight lander until its batteries ran out in 2022. In May 2021 its team tried a trick: the robotic arm trickled sand next to a panel at windy noon, and the blowing grains carried some dust away, about 30 watt-hours more per sol. A person with a brush can do much better, if they do not scratch the panel.',
  roles: TODOS,
  zona: 'exterior',
  estacion: 'campoSolar',
  puedeEmpezar: (r) => enLaSuperficie(r) && Boolean(r.ensamblaje.hechas.paneles) && r.energia.polvo >= 0.03 && (r.fase === 'ensamblaje' || r.fase === 'base'),
  motivo: (r) => (!r.ensamblaje.hechas.paneles ? 'The panels are not deployed yet.' : 'The panels are clean.'),
  pasos: [
    {
      id: 'herramienta',
      tipo: 'elegir',
      titulo: 'Choose the tool',
      instruccion: (r) => `Dust takes away ${Math.round(r.energia.polvo * 100)}% of the panel power. What do you clean them with?`,
      porque: 'The dust grains are tiny bits of hard rock. Rubbed hard into the cover glass, they scratch it, and a scratched panel loses light for good.',
      segundos: 8,
      opciones: () => [
        { id: 'suave', texto: 'A soft brush, with light strokes', calidad: 1, consecuencia: 'It sweeps the dust off without scratching the cover glass.' },
        { id: 'gas', texto: 'A puff of compressed gas', calidad: 0.7, consecuencia: 'It lifts the loose dust, but the finest dust that clings to the glass stays.' },
        { id: 'duro', texto: 'A stiff brush, pressing hard', calidad: 0.2, consecuencia: 'The panels look clean, but the grains scratch the cover glass. They will always catch a little less light.' },
      ],
    },
    {
      id: 'direccion',
      tipo: 'elegir',
      titulo: 'How to brush',
      instruccion: 'The panels are tilted. Which way do you brush?',
      porque: 'Dust that falls off the low edge does not land again on the part you already cleaned.',
      segundos: 6,
      opciones: () => [
        { id: 'abajo', texto: 'From the top edge down, in one direction', calidad: 1, consecuencia: 'The dust falls off the low edge and the clean part stays clean.' },
        { id: 'arriba', texto: 'From the bottom edge up', calidad: 0.6, consecuencia: 'The dust you lift slides back down onto the part you just cleaned.' },
        { id: 'circulos', texto: 'In circles, back and forth', calidad: 0.5, consecuencia: 'You push the dust around and grind it into the glass.' },
      ],
    },
    {
      id: 'barrer',
      tipo: 'mantener',
      titulo: 'Brush the panels',
      instruccion: 'Brush each panel from end to end. Press and hold while you work along the array.',
      porque: 'A panel row is long. Stopping halfway leaves part of it covered.',
      segundos: 8,
      boton: 'Hold to brush',
    },
  ],
})

/** Rocas que se pueden encontrar en un sitio de muestreo. */
const ROCAS: Opcion[] = [
  { id: 'capas', texto: 'A fine-grained rock with thin layers', calidad: 1, consecuencia: 'Thin layers form when mud settles slowly in still water. If there was ever life here, this is where traces could last.' },
  { id: 'fracturada', texto: 'A cracked rock that flakes at the edges', calidad: 0.4, consecuencia: 'It may crumble when you drill, like the first rock Perseverance tried in 2021, and leave the tube empty.' },
  { id: 'suelta', texto: 'A loose stone lying on the surface', calidad: 0.5, consecuencia: 'It may have rolled here from far away. Without knowing where it formed, it tells you much less.' },
  { id: 'polvo', texto: 'The dusty top of a boulder', calidad: 0.3, consecuencia: 'The surface is coated with dust and changed by wind and radiation. It no longer shows what the rock was like.' },
]
export const CALIDAD_ROCA = Object.fromEntries(ROCAS.map((r) => [r.id, r.calidad])) as Record<string, number>

function muestra(sitio: string): Procedimiento {
  const n = sitio.replace('muestra', '')
  return proc({
    id: `muestra:${sitio}`,
    titulo: `Collect a sample at Sample Site ${n}`,
    aDemanda: true,
    recurrente: true,
    objetivo: sitio,
    resumen: 'Photograph the site, choose the rock, look inside it, drill a core and seal it in a tube.',
    intro:
      'Perseverance collects each sample in the same order. It photographs the site, grinds a patch about 5 cm wide off the rock to see its fresh inside, and scans that patch up close with PIXL, an X-ray instrument, and SHERLOC, an ultraviolet one. Only then does it drill a core, about 7 cm deep, check the tube, seal it and store it. Its first try, in August 2021, came up empty: the rock crumbled into powder.',
    roles: ['cientifico'],
    zona: 'exterior',
    estacion: sitio,
    puedeEmpezar: (r) => r.fase === 'base' && !r.muestreos.includes(sitio),
    motivo: (r) => (r.fase !== 'base' ? 'Samples are collected once the base is up and running.' : 'That site has already been sampled.'),
    pasos: [
      {
        id: 'contexto',
        tipo: 'mantener',
        titulo: 'Photograph the site',
        instruccion: 'Take pictures of the whole site before you touch anything. Press and hold while you shoot around it.',
        porque: 'Without the pictures, nobody will know later where the rock was or what was around it. Perseverance images its workspace before and after drilling.',
        segundos: 6,
        boton: 'Hold to photograph',
      },
      {
        id: 'roca',
        tipo: 'elegir',
        titulo: 'Choose the rock',
        instruccion: 'There are several rocks within reach. Which one do you sample?',
        porque: 'A sample tube is precious: Perseverance carries only 43. The mission looks for rocks that formed in water, where traces of ancient life could last.',
        segundos: 8,
        opciones: () => rotar(ROCAS, hash(sitio) % ROCAS.length),
      },
      {
        id: 'abrasion',
        tipo: 'mantener',
        titulo: 'Abrade a patch',
        instruccion: 'Grind a patch about 5 cm wide off the rock surface. Press and hold while the bit grinds.',
        porque: 'Abrasion removes the dust and the weathered crust, so the instruments see the fresh rock inside.',
        segundos: 6,
        boton: 'Hold to abrade',
      },
      {
        id: 'proximidad',
        tipo: 'elegir',
        titulo: 'Scan the patch up close',
        instruccion: 'The fresh rock is exposed. What do you do before you drill?',
        porque: 'The scan tells you what elements and minerals are in the rock, so you only spend a tube on a rock that is worth it.',
        segundos: 6,
        opciones: () => [
          { id: 'escanear', texto: 'Scan it with the X-ray and ultraviolet instruments, then decide', calidad: 1, consecuencia: 'You know what the rock is made of and where the sample came from.' },
          { id: 'saltar', texto: 'Skip the scan and drill right away', calidad: 0.6, consecuencia: 'It saves time, but you may spend a tube on a rock that is not worth it, and the lab will know less about it.' },
        ],
      },
      {
        id: 'perforar',
        tipo: 'mantener',
        titulo: 'Drill the core',
        instruccion: 'Drill a core 7 cm deep into the rock. Press and hold while the drill turns.',
        porque: 'Perseverance drills to a set depth of about 7 cm. A steady, slow drill keeps the core in one piece.',
        segundos: 8,
        boton: 'Hold to drill',
      },
      {
        id: 'sellar',
        tipo: 'secuencia',
        titulo: 'Seal and record',
        instruccion: 'Close out the sample. Tap the steps in the order you do them.',
        porque: 'Perseverance checks and photographs each tube before sealing it hermetically. A sealed tube keeps the sample clean until the lab opens it.',
        segundos: 10,
        elementos: [
          { id: 'etiqueta', nombre: 'Label the tube with the site, time and depth' },
          { id: 'sellar', nombre: 'Seal the tube hermetically' },
          { id: 'foto', nombre: 'Photograph the borehole and the tube' },
          { id: 'revisar', nombre: 'Check that there is rock inside the tube' },
        ],
        ordenes: [
          ['revisar', 'foto', 'sellar', 'etiqueta'],
          ['foto', 'revisar', 'sellar', 'etiqueta'],
        ],
        error: 'Check and photograph what is inside before you seal it. The label goes on last, with the final data.',
      },
    ],
  })
}

/** ¿Hay arcilla en las muestras que carga? (Solo la dan las rocas en capas, que se formaron en agua.) */
const conArcilla = (j: Player | undefined) => {
  const t = j?.muestrasTomadas ?? []
  return t.length ? t.some((m) => m.roca === 'capas') : (j?.muestras ?? 0) > 0
}

function analizar(pid: string): Procedimiento {
  const id = `analizar:${pid}`
  return proc({
    id,
    titulo: 'Analyze the samples',
    aDemanda: true,
    recurrente: true,
    jugador: pid,
    objetivo: pid,
    resumen: 'Grind and sieve the samples, run the instruments and read the result.',
    intro:
      'Curiosity sieves its drill powder below 150 micrometers and drops a portion into two instruments. CheMin shines X-rays through the powder and identifies the minerals by the way their crystals scatter them. SAM heats the powder in an oven and sends the gases to a mass spectrometer: water, CO2, oxygen and sulfur compounds. In 2013 CheMin found that the John Klein rock was at least 20% clay minerals, which form in water.',
    roles: TODOS,
    zona: 'nave',
    estacion: 'laboratorio',
    puedeEmpezar: (r) => (jugadorDe(r, pid)?.muestras ?? 0) > 0,
    motivo: () => 'You are not carrying any samples to analyze.',
    pasos: [
      {
        id: 'preparar',
        tipo: 'elegir',
        titulo: 'Prepare the sample',
        instruccion: (r) => `You have ${jugadorDe(r, pid)?.muestras ?? 0} sample tube(s). How do you prepare the rock for the instruments?`,
        porque: 'X-ray diffraction needs a fine, even powder. Curiosity passes its powder through a 150-micrometer sieve. A human hair is about 100 micrometers thick.',
        segundos: 8,
        opciones: () => [
          { id: 'tamizar', texto: 'Grind part of each core and sieve the powder below 150 micrometers', calidad: 1, consecuencia: 'Fine, even powder is what the instruments need, and part of the core is kept to repeat the test.' },
          { id: 'entero', texto: 'Grind the whole core', calidad: 0.7, consecuencia: 'It works, but nothing is left to repeat the test or to send to Earth.' },
          { id: 'trozos', texto: 'Put small chips straight into the instrument', calidad: 0.4, consecuencia: 'With chips, the diffraction pattern comes out blurred and hard to read.' },
        ],
      },
      {
        id: 'instrumento',
        tipo: 'elegir',
        titulo: 'Choose the analysis',
        instruccion: 'Which analysis do you run?',
        porque: 'The minerals tell you how the rock formed, and the gases tell you what it holds, like water or carbon. Heating the oven takes a lot of power.',
        segundos: 8,
        opciones: () => [
          { id: 'ambos', texto: 'X-ray diffraction first, then evolved gas analysis', calidad: 1, consecuencia: 'Like Curiosity with the Hutton sample in 2020: first the minerals, then the gases. It uses the most power.' },
          { id: 'xrd', texto: 'Only X-ray diffraction, to identify the minerals', calidad: 0.8, consecuencia: 'You learn the minerals, but not the water and gases trapped in them.' },
          { id: 'ega', texto: 'Only evolved gas analysis, heating the powder', calidad: 0.7, consecuencia: 'You see the gases, but not which minerals hold them.' },
        ],
      },
      {
        id: 'medir',
        tipo: 'mantener',
        titulo: 'Run the analysis',
        instruccion: 'Load the powder and start the instrument. Press and hold while it runs.',
        porque: 'X-ray diffraction builds up its pattern over many exposures, and the oven heats the powder little by little while the gases are measured.',
        segundos: 8,
        boton: 'Hold to run',
      },
      {
        id: 'lectura',
        tipo: 'comprobar',
        titulo: 'Read the result',
        instruccion: 'Read the result and decide what it shows.',
        porque: 'The instrument only gives numbers. Somebody has to read them and decide what they mean before the result goes in the report.',
        segundos: 10,
        lectura: (r) => {
          const d = datosDe(r, id)
          const s = d.semilla ?? 1
          const arcilla = conArcilla(jugadorDe(r, pid))
          const v = (k: number, a: number, b: number) => Math.round(a + (Math.abs(ruido(s, k)) * (b - a)))
          if (valoresDe(r, id)[1] === 'ega') {
            const agua = arcilla ? v(1, 8, 12) : r1(0.3 + Math.abs(ruido(s, 1)) * 0.4)
            return {
              forma: 'barras',
              titulo: 'Gases released by heating',
              unidad: 'signal',
              eje: 'gas',
              puntos: [
                { x: 'H2O', y: agua },
                { x: 'CO2', y: v(2, 3, 6) },
                { x: 'O2', y: v(3, 1, 3) },
                { x: 'SO2', y: v(4, 1, 4) },
              ],
              limite: 1,
              limiteTexto: 'Detection level',
              resaltar: 'H2O',
              pregunta: 'Did the powder release water when it was heated?',
              correcto: arcilla ? 'pasa' : 'falla',
              explicacion: arcilla ? 'Water came off when the powder was heated. Minerals that formed in water hold it in their structure.' : 'Almost no water came off. This rock shows no sign of having formed in water.',
              botones: ['Yes, water', 'No water'],
            }
          }
          const clay = arcilla ? v(4, 18, 24) : 0
          return {
            forma: 'barras',
            titulo: 'Minerals found by X-ray diffraction',
            unidad: '%',
            eje: 'mineral',
            puntos: [
              { x: 'Plagioclase', y: v(1, 28, 38) },
              { x: 'Pyroxene', y: v(2, 14, 24) },
              { x: 'Olivine', y: arcilla ? v(3, 1, 3) : v(3, 6, 12) },
              { x: 'Clay', y: clay },
              { x: 'Sulfate', y: arcilla ? v(5, 2, 5) : v(5, 0, 2) },
              { x: 'Glass', y: v(6, 18, 28) },
            ],
            limite: 3,
            limiteTexto: 'Detection limit: 3%',
            resaltar: 'Clay',
            pregunta: 'Is there clay in this sample?',
            correcto: arcilla ? 'pasa' : 'falla',
            explicacion: arcilla
              ? `Clay minerals make up ${clay}% of the powder. Clay forms in water: this rock was once wet, like the John Klein rock that Curiosity drilled in 2013.`
              : 'Only volcanic minerals such as plagioclase and pyroxene. This rock shows no sign of having formed in water.',
            botones: ['Yes, clay', 'No clay'],
          }
        },
      },
    ],
  })
}

// ---------- Enfermería ----------

export interface Condicion {
  id: string
  /** Texto de la dolencia tal como la guarda el jugador (null = salud baja sin dolencia). */
  dolencia: string | null
  hallazgo: string
  diagnostico: string
  tratamiento: string
  /** Si no se puede esperar la respuesta de la Tierra. */
  urgente: boolean
}

export const DCS = 'decompression sickness'

export const CONDICIONES: Condicion[] = [
  { id: 'espalda', dolencia: 'lower back pain', hallazgo: 'Pain in the lower back that gets worse when bending. In low gravity the spine stretches out.', diagnostico: 'Lower back pain from the stretched spine', tratamiento: 'Pain medicine, gentle stretching and a heat pack', urgente: false },
  { id: 'calculo', dolencia: 'a kidney stone', hallazgo: 'Sharp pain in one side that comes in waves, and the urine test strip shows blood. Bone loss in space puts more calcium in the urine.', diagnostico: 'Kidney stone', tratamiento: 'Pain medicine, plenty of water and an ultrasound scan to follow the stone', urgente: false },
  { id: 'congestion', dolencia: 'congestion and a headache', hallazgo: 'Stuffy nose, puffy face and a headache. In low gravity body fluids shift toward the head.', diagnostico: 'Congestion from the fluid shift', tratamiento: 'Decongestant and pain medicine', urgente: false },
  { id: 'mano', dolencia: 'a hand injury', hallazgo: 'Sore, swollen fingertips and a fingernail coming loose. Suit gloves press hard on the fingers.', diagnostico: 'Hand injury from the suit gloves', tratamiento: 'Clean and dress the finger, splint it and rest the hand', urgente: false },
  { id: 'piel', dolencia: 'a skin rash', hallazgo: 'A red, itchy rash on the arms. The air is dry and nobody can take a real shower.', diagnostico: 'Skin rash', tratamiento: 'Clean the skin and apply a cream from the kit', urgente: false },
  { id: 'insomnio', dolencia: 'insomnia', hallazgo: 'Very tired, slow to react, and sleeping only a few hours. The light and the work schedule keep changing.', diagnostico: 'Insomnia', tratamiento: 'A fixed sleep schedule, dim lights at night and a sleep aid', urgente: false },
  { id: 'mareo', dolencia: 'space sickness', hallazgo: 'Nausea, vomiting and dizziness in the first days without gravity.', diagnostico: 'Space sickness', tratamiento: 'Anti-nausea medicine and rest', urgente: false },
  { id: 'dcs', dolencia: DCS, hallazgo: 'Deep, aching pain in the knees and shoulders after a spacewalk, and itchy skin.', diagnostico: 'Decompression sickness, the bends', tratamiento: 'Pure oxygen and recompression in the suit at a higher pressure', urgente: true },
  { id: 'agotamiento', dolencia: null, hallazgo: 'Low health, worn out and thirsty after a hard shift.', diagnostico: 'Exhaustion and dehydration', tratamiento: 'Fluids, food and 12 hours of rest', urgente: false },
]
const CONDICION_BY_ID = Object.fromEntries(CONDICIONES.map((c) => [c.id, c])) as Record<string, Condicion>

/** La condición de un paciente según su dolencia de ahora. */
export function condicionDe(j: Player | undefined): Condicion {
  return CONDICIONES.find((c) => c.dolencia !== null && c.dolencia === j?.dolencia) ?? CONDICION_BY_ID.agotamiento
}
const necesitaTratamiento = (j: Player | undefined) => Boolean(j?.rol && (j.dolencia || j.incapacitado > 0 || j.vit.salud <= 90))

function tratar(pid: string, room?: RoomState): Procedimiento {
  const id = `tratar:${pid}`
  const nombre = (room && jugadorDe(room, pid)?.nombre) || 'the patient'
  /** La condición que se anotó al empezar el examen, o la de ahora. */
  const cond = (r: RoomState) => {
    const k = datosDe(r, id).cond
    return k !== undefined && CONDICIONES[k] ? CONDICIONES[k] : condicionDe(jugadorDe(r, pid))
  }
  /** La condición correcta y tres más, en un orden fijo para este paciente. */
  const opcionesDe = (r: RoomState) => {
    const c = cond(r)
    const otras = CONDICIONES.filter((x) => x.id !== c.id)
    const h = hash(pid + c.id)
    const tres = [0, 1, 2].map((k) => otras[(h + k * 3) % otras.length])
    return rotar([c, ...tres], h % 4)
  }
  return proc({
    id,
    titulo: `Treat ${nombre}`,
    aDemanda: true,
    recurrente: true,
    objetivo: pid,
    resumen: room ? `${(jugadorDe(room, pid)?.dolencia ?? 'Low health').replace(/^./, (x) => x.toUpperCase())}. It uses one medical kit.` : 'It uses one medical kit.',
    intro:
      'A crew on Mars cannot be evacuated, and every question to Earth takes minutes to arrive. NASA standards call for at least one physician on a crew that lands on another planet, and the Crew Medical Officer has to examine, diagnose and treat on their own. The flight surgeons on Earth are still there for a second opinion, if the patient can wait for the answer.',
    roles: ['medico'],
    zona: 'nave',
    estacion: 'enfermeria',
    puedeEmpezar: (r) => necesitaTratamiento(jugadorDe(r, pid)) && r.rec.botiquines >= 1 && ['transito', 'llegada', 'ensamblaje', 'base'].includes(r.fase),
    motivo: (r) => (r.rec.botiquines < 1 ? 'No medical kits left.' : `${jugadorDe(r, pid)?.nombre ?? 'The patient'} does not need treatment.`),
    pasos: [
      {
        id: 'examinar',
        tipo: 'mantener',
        titulo: 'Examine the patient',
        instruccion: `Ask ${nombre} what is wrong, and measure the pulse, breathing and blood oxygen. Press and hold while you examine.`,
        porque: 'A diagnosis starts with what the patient tells you and with numbers you can compare later.',
        segundos: 6,
        boton: 'Hold to examine',
      },
      {
        id: 'vitales',
        tipo: 'comprobar',
        titulo: 'Read the vital signs',
        instruccion: (r) => {
          const d = datosDe(r, id)
          const p = jugadorDe(r, pid)
          return `Breathing ${d.fr ?? Math.round(p?.vit.fr ?? 14)} per minute, blood oxygen ${d.spo2 ?? Math.round(p?.vit.spo2 ?? 97)}%. Watch the pulse for 10 minutes.`
        },
        porque: 'A fast pulse at rest can mean pain, fever, dehydration or blood loss. It tells you how urgent the case is.',
        segundos: 8,
        lectura: (r) => {
          const d = datosDe(r, id)
          const fc = d.fc ?? Math.round(jugadorDe(r, pid)?.vit.fc ?? 70)
          const s = d.semilla ?? 1
          return {
            forma: 'linea',
            titulo: `Pulse of ${nombre}`,
            unidad: 'beats/min',
            eje: 'minutes',
            puntos: Array.from({ length: 11 }, (_, k) => ({ x: k, y: Math.round(fc + ruido(s, k) * 3) })),
            limite: 100,
            limiteTexto: 'Upper normal at rest: 100 beats per minute',
            pregunta: 'Is the pulse in the normal range?',
            correcto: fc <= 100 ? 'pasa' : 'falla',
            explicacion: fc <= 100 ? `The pulse is ${fc} beats per minute, within the normal range of 60 to 100.` : `The pulse is ${fc} beats per minute, above 100. The body is under stress.`,
            botones: ['Normal', 'Too high'],
          }
        },
      },
      {
        id: 'diagnostico',
        tipo: 'elegir',
        titulo: 'Diagnose',
        instruccion: (r) => `Findings: ${cond(r).hallazgo} What is the diagnosis?`,
        porque: 'The right treatment depends on the right diagnosis. The findings have to explain everything you saw.',
        segundos: 8,
        opciones: (r) => {
          const c = cond(r)
          return opcionesDe(r).map((x) => ({ id: x.id, texto: x.diagnostico, calidad: x.id === c.id ? 1 : 0.2, consecuencia: x.id === c.id ? 'That explains all the findings.' : 'That does not explain all the findings.' }))
        },
      },
      {
        id: 'consulta',
        tipo: 'elegir',
        titulo: 'Ask Earth?',
        instruccion: (r) => {
          const s = Math.round(r.vuelo.retardo)
          return `A message to the flight surgeons on Earth takes ${s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`} each way. Do you wait for their opinion?`
        },
        porque: 'A second opinion catches mistakes, but on Mars the answer can take more than half an hour. Some cases cannot wait.',
        segundos: 6,
        opciones: (r) => {
          const urgente = cond(r).urgente
          const ida = Math.max(1, Math.round((2 * r.vuelo.retardo) / 60))
          return [
            { id: 'consultar', texto: 'Send the findings to the flight surgeon and wait for the reply', calidad: urgente ? 0.4 : 1, consecuencia: urgente ? `The reply takes ${ida} minutes, and the bends get worse while you wait.` : `The reply comes back in about ${ida} minutes. A second opinion catches mistakes.` },
            { id: 'ahora', texto: 'Treat now and send a report to Earth', calidad: urgente ? 1 : 0.8, consecuencia: urgente ? 'With the bends, every minute counts. Earth gets the report later.' : 'You save time, but nobody checks your diagnosis.' },
          ]
        },
      },
      {
        id: 'tratamiento',
        tipo: 'elegir',
        titulo: 'Treat with the kit',
        instruccion: (r) => {
          const pedido = 'Choose the treatment from the medical kit.'
          return valoresDe(r, id)[3] === 'consultar' ? `The flight surgeon replied: the findings fit ${cond(r).diagnostico.toLowerCase()}. ${pedido}` : pedido
        },
        porque: 'Each kit has medicines and supplies for the most likely problems on a long mission. Using the wrong one wastes it and the patient does not get better.',
        segundos: 8,
        opciones: (r) => {
          const c = cond(r)
          return opcionesDe(r).map((x) => ({ id: x.id, texto: x.tratamiento, calidad: x.id === c.id ? 1 : 0.2, consecuencia: x.id === c.id ? 'This is the treatment for what the patient has.' : 'This treatment is for something else.' }))
        },
      },
    ],
  })
}

// ---------- Deberes de rutina de cada rol ----------
// Lo que una tripulación hace todos los días aunque no pase nada: la conferencia de planificación,
// la navegación, el control médico, el inventario, los experimentos y la limpieza de filtros, como
// en la Estación Espacial. Tocan cada pocos días de misión (y nunca más a menudo que DEBER_CADA_MS
// de tiempo real), se hacen paso a paso con instancias `deber:<id>` y sus consecuencias están en
// server/deberes.ts.

export interface InfoDeber {
  id: string
  rol: Role
  /** Fases de la misión en que toca. */
  fases: RoomState['fase'][]
  /** Cada cuántos días de misión vuelve a tocar, y días que hay para hacerlo. */
  cadaDias: number
  plazoDias: number
  /** Lo que gana la tripulación y lo que pasa si se salta, para mostrarlo. */
  beneficio: string
  penalizacion: string
}

/** Tiempo real mínimo entre dos veces del mismo deber, para que a ×86 400 no aparezca a cada momento. */
export const DEBER_CADA_MS = 150_000
/** Tiempo real mínimo para hacerlo antes de que se dé por saltado. */
export const DEBER_PLAZO_MS = 120_000

export const DEBERES: InfoDeber[] = [
  { id: 'planificacion', rol: 'comandante', fases: ['transito', 'base'], cadaDias: 2, plazoDias: 2, beneficio: 'A clear plan leaves time to rest: everyone gets a little less tired.', penalizacion: 'Without a plan, tasks overlap and everyone gets a little more tired.' },
  { id: 'navegacion', rol: 'piloto', fases: ['transito'], cadaDias: 3, plazoDias: 3, beneficio: 'A drift found early is fixed with a tiny burn.', penalizacion: 'An unnoticed drift grows, and fixing it later costs 1% of the propellant.' },
  { id: 'trajes', rol: 'piloto', fases: ['base'], cadaDias: 3, plazoDias: 3, beneficio: 'Checked suits are less likely to leak outside.', penalizacion: 'Unchecked suits are more likely to leak on the next walk outside.' },
  { id: 'chequeo', rol: 'medico', fases: ['transito', 'base'], cadaDias: 4, plazoDias: 3, beneficio: 'Small problems are caught early and the crew stays healthier.', penalizacion: 'Illnesses become more likely and go unnoticed longer, so they start worse.' },
  { id: 'inventario', rol: 'logistica', fases: ['transito', 'base'], cadaDias: 3, plazoDias: 3, beneficio: 'Misplaced food is found and the oldest food is eaten first.', penalizacion: 'Some food passes its shelf life in a forgotten bag.' },
  { id: 'experimento', rol: 'cientifico', fases: ['transito', 'base'], cadaDias: 3, plazoDias: 3, beneficio: 'The dosimeter map shows where to sleep: the crew gets a bit less radiation.', penalizacion: 'The radiation data has a gap and the crew loses the lower dose.' },
  { id: 'filtros', rol: 'sistemas', fases: ['transito', 'base'], cadaDias: 4, plazoDias: 3, beneficio: 'Clean filters ease the load on the CO2 Scrubber and Thermal Control.', penalizacion: 'Clogged filters make the CO2 Scrubber and Thermal Control wear out faster.' },
]
export const DEBER_BY_ID = Object.fromEntries(DEBERES.map((d) => [d.id, d])) as Record<string, InfoDeber>
/** ¿Toca ahora este deber? */
export const deberPendiente = (room: RoomState, id: string) => Boolean(room.deberes?.[id]?.pendiente)
/** ¿Se saltó el último y sigue sin hacerse? */
export const deberAtrasado = (room: RoomState, id: string) => Boolean(room.deberes?.[id]?.atrasado)
/** Deberes que existen en esta fase de la misión para un rol (o para todos). */
export const deberesDeFase = (room: RoomState, rol?: Role | null) =>
  DEBERES.filter((d) => d.fases.includes(room.fase) && (!rol || d.rol === rol) && room.jugadores.some((j) => j.rol === d.rol))

const minutosSenal = (r: RoomState) => Math.max(1, Math.round((r.vuelo?.retardo ?? 0) / 60))
const datosDeber = (r: RoomState, id: string) => datosDe(r, `deber:${id}`)

function crearDeber(d: InfoDeber, p: Omit<Procedimiento, 'id' | 'roles' | 'zona' | 'aDemanda' | 'recurrente' | 'puedeEmpezar' | 'motivo' | 'pasos'> & { pasos: PasoLocal[] }): Procedimiento {
  return proc({
    ...p,
    id: `deber:${d.id}`,
    objetivo: d.id,
    roles: [d.rol],
    zona: 'nave',
    aDemanda: true,
    recurrente: true,
    puedeEmpezar: (r) => deberPendiente(r, d.id) && d.fases.includes(r.fase),
    motivo: () => 'Nothing due now. Routine duties come back every few days.',
  })
}

const PROC_DEBER: Record<string, Procedimiento> = {
  planificacion: crearDeber(DEBER_BY_ID.planificacion, {
    titulo: 'Daily Planning Conference',
    estacion: 'comms',
    resumen: 'Agree on the plan for the day with Mission Control, despite the signal delay.',
    intro:
      'On the ISS the crew starts and ends each day with a Daily Planning Conference: a call with the control centers to go over the plan, the changes and any questions. Near Mars a signal takes minutes to reach Earth, so a live conversation does not work. The plan goes out as a message and the answers come back later.',
    pasos: [
      {
        id: 'formato',
        tipo: 'elegir',
        titulo: 'Choose how to talk',
        instruccion: (r) => `A signal takes ${minutosSenal(r)} minutes to reach Earth and the same to come back. How do you hold the conference?`,
        porque: 'Every question and answer waits for the round trip of the signal. Near Mars a round trip can take more than 40 minutes.',
        segundos: 8,
        opciones: (r) => [
          { id: 'mensaje', texto: 'Send the plan and all the questions in one message, then read the reply', calidad: 1, consecuencia: 'Mission Control answers everything in one reply. Nobody waits on the line.' },
          { id: 'vivo', texto: 'Call live and ask one question at a time', calidad: 0.4, consecuencia: `Each answer takes ${2 * minutosSenal(r)} minutes to come back. The crew loses the morning waiting.` },
          { id: 'solos', texto: 'Skip Mission Control and plan alone', calidad: 0.6, consecuencia: 'It saves time, but the ground teams cannot warn you about what they see in the data.' },
        ],
      },
      {
        id: 'orden',
        tipo: 'secuencia',
        titulo: 'Go over the day',
        instruccion: 'Run the conference. Tap the steps in the order you do them.',
        porque: 'The overnight messages may change the plan, so they come first. The plan goes back to Earth only after the crew has checked it.',
        segundos: 10,
        elementos: [
          { id: 'enviar', nombre: 'Send the confirmed plan to Mission Control' },
          { id: 'leer', nombre: 'Read the messages that came in overnight' },
          { id: 'tareas', nombre: 'Assign the tasks and check that none overlap' },
          { id: 'revisar', nombre: 'Review the timeline for today' },
        ],
        ordenes: [['leer', 'revisar', 'tareas', 'enviar']],
        error: 'Read the overnight messages first, then review the timeline, assign the tasks and send the plan last.',
      },
      { id: 'transmitir', tipo: 'mantener', titulo: 'Transmit the plan', instruccion: 'Hold while the plan goes out through the antenna.', porque: 'The link to Earth is slow. The message has to go out whole.', segundos: 4, boton: 'Hold to transmit' },
    ],
  }),

  navegacion: crearDeber(DEBER_BY_ID.navegacion, {
    titulo: 'Navigation fix',
    estacion: 'comms',
    resumen: 'Check where the ship points and whether it is still on course.',
    intro:
      'A star tracker photographs the stars and compares them with a catalog to know where the ship points. Position and speed come mostly from radio tracking by the Deep Space Network on Earth, and Orion can also fix its position with a camera that measures the Moon and Earth. A drift found early costs very little propellant to fix.',
    pasos: [
      {
        id: 'actitud',
        tipo: 'elegir',
        titulo: 'Find the attitude',
        instruccion: 'First the ship needs to know where it points. Which sensor do you use?',
        porque: 'Gyroscopes drift a little all the time. A star fix resets them.',
        segundos: 8,
        opciones: () => [
          { id: 'estrellas', texto: 'The star tracker', calidad: 1, consecuencia: 'It matches the stars it sees with its catalog and gives a precise attitude.' },
          { id: 'sol', texto: 'The sun sensor', calidad: 0.5, consecuencia: 'It finds the Sun, but one direction is not enough to know the full attitude.' },
          { id: 'giroscopios', texto: 'The gyroscopes alone', calidad: 0.3, consecuencia: 'Without a star fix, their small error keeps growing.' },
        ],
      },
      {
        id: 'rumbo',
        tipo: 'comprobar',
        titulo: 'Check the course',
        instruccion: 'Compare the tracking data with the planned path.',
        porque: 'A small error in speed grows into a big miss at Mars. The earlier it is fixed, the smaller the burn.',
        segundos: 10,
        lectura: (r) => {
          const d = datosDeber(r, 'navegacion')
          const deriva = (d.deriva ?? 0) > 0
          const s = d.semilla ?? 1
          const puntos = Array.from({ length: 8 }, (_, k) => ({ x: 7 - k, y: r1(Math.max(0, (deriva ? 150 + k * 70 : 120) + ruido(s, k) * 40)) }))
          return {
            forma: 'linea',
            titulo: 'Distance from the planned path',
            unidad: 'km',
            eje: 'days ago',
            puntos,
            limite: 500,
            limiteTexto: 'Planned corridor',
            pregunta: 'Is the ship inside the planned corridor?',
            correcto: deriva ? 'falla' : 'pasa',
            explicacion: deriva ? 'The distance keeps growing and is leaving the corridor. A tiny trim burn now fixes it.' : 'The ship stays close to the planned path. No burn needed.',
            botones: ['On course', 'Drifting'],
          }
        },
      },
    ],
  }),

  trajes: crearDeber(DEBER_BY_ID.trajes, {
    titulo: 'Spacesuit checkout',
    estacion: 'esclusa',
    resumen: 'Inspect the suits and gloves so they are ready for the next walk outside.',
    intro:
      'In 2007 a cut in a spacewalker\'s glove was only found back on Earth. Since then, gloves are checked several times during each spacewalk and inspected inside before and after, with photos sent to the ground.',
    pasos: [
      {
        id: 'inspeccion',
        tipo: 'elegir',
        titulo: 'Inspect the gloves',
        instruccion: 'The gloves take the most wear outside. How do you check them?',
        porque: 'Mars dust is sharp and wears the outer layer. A small cut is easy to miss.',
        segundos: 8,
        opciones: () => [
          { id: 'luz', texto: 'Under bright light, finger by finger, with photos', calidad: 1, consecuencia: 'Every finger is checked and the photos go to the ground.' },
          { id: 'rapido', texto: 'A quick look at the palms', calidad: 0.4, consecuencia: 'A cut on a finger can go unnoticed.' },
          { id: 'nada', texto: 'Skip it. They looked fine last time', calidad: 0.2, consecuencia: 'Wear builds up from one walk to the next.' },
        ],
      },
      {
        id: 'guante',
        tipo: 'comprobar',
        titulo: 'Read the glove wear',
        instruccion: 'Look at how worn the outer layer is on each finger.',
        porque: 'A glove past its wear limit is replaced before it goes outside again.',
        segundos: 10,
        lectura: (r) => {
          const d = datosDeber(r, 'trajes')
          const corte = (d.corte ?? -1) >= 0 ? d.corte! : -1
          const dedos = ['Thumb', 'Index', 'Middle', 'Ring', 'Little']
          const s = d.semilla ?? 1
          return {
            forma: 'barras',
            titulo: 'Wear of the outer glove layer',
            unidad: '%',
            eje: 'finger',
            puntos: dedos.map((x, k) => ({ x, y: Math.round(k === corte ? 72 + ruido(s, k) * 8 : 25 + Math.abs(ruido(s, k)) * 20) })),
            limite: 60,
            limiteTexto: 'Replace above 60%',
            pregunta: 'Can these gloves go outside again?',
            correcto: corte >= 0 ? 'falla' : 'pasa',
            explicacion: corte >= 0 ? `The ${dedos[corte].toLowerCase()} is past the limit. The glove gets replaced.` : 'Every finger is under the limit. The gloves are fine.',
            botones: ['Gloves are fine', 'Replace a glove'],
          }
        },
      },
    ],
  }),

  chequeo: crearDeber(DEBER_BY_ID.chequeo, {
    titulo: 'Crew health check',
    estacion: 'enfermeria',
    resumen: 'Examine the crew and hold the private medical conferences.',
    intro:
      'Every week each ISS astronaut has a private medical conference with a flight surgeon, one at a time, over a private audio and video link. Crew members also examine each other in periodic health checks and send the data to the ground. Problems found early are easier to treat.',
    pasos: [
      {
        id: 'vitales',
        tipo: 'comprobar',
        titulo: 'Examine the crew',
        instruccion: 'Check each crew member: vital signs, sleep, appetite and any pain.',
        porque: 'Far from Earth, the crew has to notice problems before they become emergencies.',
        segundos: 10,
        lectura: (r) => {
          const crew = r.jugadores.filter((j) => j.rol)
          const puntos = crew.map((j) => ({ x: j.nombre, y: Math.max(0, Math.round(100 - j.vit.salud)) }))
          const alguien = puntos.some((p) => p.y > 15)
          return {
            forma: 'barras',
            titulo: 'Symptoms found in the exam',
            unidad: 'points',
            eje: 'crew member',
            puntos,
            limite: 15,
            limiteTexto: 'Above 15: give care now',
            pregunta: 'Does anyone need care?',
            correcto: alguien ? 'falla' : 'pasa',
            explicacion: alguien ? 'Someone is above the line. They get care now, before it gets worse.' : 'Everyone is under the line. Nobody needs care now.',
            botones: ['Everyone is fine', 'Someone needs care'],
          }
        },
      },
      {
        id: 'conferencia',
        tipo: 'elegir',
        titulo: 'Private medical conferences',
        instruccion: 'Each crew member talks with the flight surgeon on Earth. How?',
        porque: 'People only talk openly about sleep, pain or worries when nobody else listens.',
        segundos: 8,
        opciones: () => [
          { id: 'privada', texto: 'One at a time, on a private link', calidad: 1, consecuencia: 'People speak openly. What they say stays private unless it affects the mission.' },
          { id: 'mesa', texto: 'All together at the galley table', calidad: 0.3, consecuencia: 'Nobody wants to talk about their problems in front of everyone. Small symptoms stay hidden.' },
          { id: 'saltar', texto: 'Skip them this week', calidad: 0.4, consecuencia: 'Nothing gets noticed until it becomes serious.' },
        ],
      },
    ],
  }),

  inventario: crearDeber(DEBER_BY_ID.inventario, {
    titulo: 'Stowage audit',
    estacion: 'estiba',
    resumen: 'Audit a cargo bag and keep the food and water count right.',
    intro:
      'Every item on the ISS has a barcode, and each move is logged in the Inventory Management System. NASA budgets 20 minutes of crew time a day for it, and auditing a cargo bag by hand takes about 20 minutes. Without it, things get lost in a small space packed with bags.',
    pasos: [
      {
        id: 'auditar',
        tipo: 'secuencia',
        titulo: 'Audit a cargo bag',
        instruccion: 'Tap the steps in the order you do them.',
        porque: 'The scan tells you what the bag should hold. Only then can you count and log the difference.',
        segundos: 10,
        elementos: [
          { id: 'actualizar', nombre: 'Update the inventory system' },
          { id: 'escanear', nombre: 'Scan the barcode of the bag' },
          { id: 'anotar', nombre: 'Note what is missing or misplaced' },
          { id: 'contar', nombre: 'Count each item against the list' },
        ],
        ordenes: [['escanear', 'contar', 'anotar', 'actualizar']],
        error: 'Scan the bag first, count the items, note the differences and update the system last.',
      },
      {
        id: 'rotar',
        tipo: 'elegir',
        titulo: 'Rotate the food',
        instruccion: 'Which food packages go to the galley first?',
        porque: 'Food on board has a shelf life. Old packages at the back of a bag expire unnoticed.',
        segundos: 8,
        opciones: () => [
          { id: 'antigua', texto: 'The oldest packages first', calidad: 1, consecuencia: 'Nothing waits long enough to expire.' },
          { id: 'arriba', texto: 'Whatever is on top', calidad: 0.6, consecuencia: 'Some old packages stay buried and expire.' },
          { id: 'nueva', texto: 'The newest packages first', calidad: 0.3, consecuencia: 'The old ones stay at the back and pass their date.' },
        ],
      },
      {
        id: 'cuenta',
        tipo: 'comprobar',
        titulo: 'Compare count and log',
        instruccion: 'Compare what you counted with what the system says.',
        porque: 'A difference means something was used without logging it or stowed in the wrong bag.',
        segundos: 10,
        lectura: (r) => {
          const d = datosDeber(r, 'inventario')
          const perdido = (d.perdido ?? 0) > 0
          const s = d.semilla ?? 1
          const cosas = ['Food', 'Water', 'Medical kits', 'Spare parts']
          return {
            forma: 'barras',
            titulo: 'Difference between count and log',
            unidad: 'kg',
            eje: 'item',
            puntos: cosas.map((x, k) => ({ x, y: r1(k === 0 && perdido ? 2.4 + ruido(s, k) * 0.3 : Math.abs(ruido(s, k)) * 0.4) })),
            limite: 1,
            limiteTexto: 'Search above 1 kg',
            pregunta: 'Do the count and the log match?',
            correcto: perdido ? 'falla' : 'pasa',
            explicacion: perdido ? 'Food is missing from the log. It was stowed in the wrong bag. Search and log it.' : 'Everything matches within 1 kg.',
            botones: ['They match', 'Something is missing'],
          }
        },
      },
    ],
  }),

  experimento: crearDeber(DEBER_BY_ID.experimento, {
    titulo: 'Radiation experiment',
    estacion: 'ciencia',
    resumen: 'Read the dosimeters and run the experiment in the glovebox.',
    intro:
      'Curiosity\'s RAD instrument measured about 1.84 mSv a day during the cruise to Mars and 0.64 mSv a day on the surface. On the ISS, crews read dosimeters and handle samples inside a sealed glovebox. Mass between the crew and space lowers the dose, and water and food are good shields because they are rich in hydrogen.',
    pasos: [
      {
        id: 'guantera',
        tipo: 'secuencia',
        titulo: 'Use the glovebox',
        instruccion: 'Tap the steps in the order you do them.',
        porque: 'The glovebox is kept at a slightly lower pressure, so nothing leaks into the cabin even if it is not perfectly sealed.',
        segundos: 10,
        elementos: [
          { id: 'cerrar', nombre: 'Close the container before taking your hands out' },
          { id: 'presion', nombre: 'Check the glovebox is sealed and at lower pressure' },
          { id: 'abrir', nombre: 'Open the dosimeter case inside' },
          { id: 'manos', nombre: 'Put your hands in the gloves' },
        ],
        ordenes: [['presion', 'manos', 'abrir', 'cerrar']],
        error: 'Check the seal and pressure first, then hands in, open inside, and close everything before taking your hands out.',
      },
      {
        id: 'dosis',
        tipo: 'comprobar',
        titulo: 'Read the dose',
        instruccion: 'Read the daily dose of the last week.',
        porque: 'A sudden rise means a solar storm. The crew should then stay near the shelter.',
        segundos: 10,
        lectura: (r) => {
          const d = datosDeber(r, 'experimento')
          const alta = (d.alta ?? 0) > 0
          const s = d.semilla ?? 1
          const base = r.tAterrizaje > 0 && r.t >= r.tAterrizaje ? C.GCR_SUPERFICIE_MSV_DIA : C.GCR_CRUCERO_MSV_DIA
          const puntos = Array.from({ length: 7 }, (_, k) => ({ x: 6 - k, y: r2(base * (1 + ruido(s, k) * 0.06) * (alta && k === 6 ? 4 : 1)) }))
          return {
            forma: 'linea',
            titulo: 'Dose rate in the cabin',
            unidad: 'mSv/day',
            eje: 'days ago',
            puntos,
            limite: r2(base * 2),
            limiteTexto: 'Twice the normal rate',
            pregunta: 'Is the dose normal?',
            correcto: alta ? 'falla' : 'pasa',
            explicacion: alta ? 'Today the dose is several times higher. A solar storm is going on. Warn the crew.' : 'The dose is the steady background of cosmic rays.',
            botones: ['Normal', 'Too high'],
          }
        },
      },
      {
        id: 'dormir',
        tipo: 'elegir',
        titulo: 'Use the dose map',
        instruccion: 'The dosimeters show where the dose is lowest. Where do the sleeping bags go?',
        porque: 'The crew spends a third of the day asleep. Where they sleep matters.',
        segundos: 8,
        opciones: () => [
          { id: 'agua', texto: 'Behind the water and food stowage', calidad: 1, consecuencia: 'The extra mass stops part of the radiation. The dose drops a little.' },
          { id: 'igual', texto: 'Leave them where they are', calidad: 0.6, consecuencia: 'Nothing changes.' },
          { id: 'ventana', texto: 'Near the window, for the view', calidad: 0.3, consecuencia: 'There is less mass there. The dose goes up a little.' },
        ],
      },
    ],
  }),

  filtros: crearDeber(DEBER_BY_ID.filtros, {
    titulo: 'Air filter cleaning',
    estacion: 'soporte',
    resumen: 'Vacuum the air filter inlets and the fan screens.',
    intro:
      'Without gravity, dust and lint do not settle. They float until they end up in the air filters. ISS crews vacuum the inlets of the bacteria filters every week and clean fan screens and grilles during the weekly housekeeping. Clogged filters make the fans and the air systems work harder.',
    pasos: [
      {
        id: 'limpiarFiltro',
        tipo: 'secuencia',
        titulo: 'Clean a filter',
        instruccion: 'Tap the steps in the order you do them.',
        porque: 'With the fan running, the vacuum fights the airflow and dust gets pulled back in.',
        segundos: 10,
        elementos: [
          { id: 'aspirar', nombre: 'Vacuum the lint and dust' },
          { id: 'reponer', nombre: 'Put the screen back and turn the fan on' },
          { id: 'apagar', nombre: 'Turn off the fan of that air loop' },
          { id: 'quitar', nombre: 'Take off the inlet screen' },
        ],
        ordenes: [['apagar', 'quitar', 'aspirar', 'reponer']],
        error: 'Turn off the fan first, take off the screen, vacuum, and put it all back last.',
      },
      {
        id: 'flujo',
        tipo: 'comprobar',
        titulo: 'Read the pressure drop',
        instruccion: 'Read how hard the air pushes through each filter.',
        porque: 'A big pressure drop means the filter is still clogged and the fan works harder.',
        segundos: 10,
        lectura: (r) => {
          const d = datosDeber(r, 'filtros')
          const tapado = (d.tapado ?? 0) > 0
          const s = d.semilla ?? 1
          const filtros = ['Filter 1', 'Filter 2', 'Filter 3', 'Filter 4']
          return {
            forma: 'barras',
            titulo: 'Pressure drop across each filter',
            unidad: 'Pa',
            eje: 'filter',
            puntos: filtros.map((x, k) => ({ x, y: Math.round(k === 2 && tapado ? 230 + ruido(s, k) * 20 : 110 + ruido(s, k) * 25) })),
            limite: 180,
            limiteTexto: 'Clean again above 180 Pa',
            pregunta: 'Are all the filters clean?',
            correcto: tapado ? 'falla' : 'pasa',
            explicacion: tapado ? 'Filter 3 is still clogged. It gets cleaned again.' : 'All filters are under the limit.',
            botones: ['All clean', 'One is clogged'],
          }
        },
      },
    ],
  }),
}

/** Trabajos sin instancia: hay uno solo de cada uno. */
export const TRABAJOS: Procedimiento[] = [sellar, lioh, limpiar]

interface Familia {
  /** Para qué objetivos puede existir ahora (todos; si se puede empezar lo dice el procedimiento). */
  objetivos: (room: RoomState) => string[]
  crear: (objetivo: string, room?: RoomState) => Procedimiento
}
const conRol = (room: RoomState) => room.jugadores.filter((j) => j.rol).map((j) => j.id)
const FAMILIAS: Record<string, Familia> = {
  salida: { objetivos: conRol, crear: salida },
  entrada: { objetivos: conRol, crear: entrada },
  reparar: { objetivos: (room) => room.sistemas.filter((s) => s.instalado).map((s) => s.id), crear: reparar },
  muestra: { objetivos: () => SITIOS_MUESTRA, crear: muestra },
  analizar: { objetivos: conRol, crear: analizar },
  tratar: { objetivos: conRol, crear: tratar },
  deber: { objetivos: () => DEBERES.map((d) => d.id), crear: (o) => PROC_DEBER[o] },
}

export const PROC_BY_ID = Object.fromEntries([...PROCEDIMIENTOS, ...TRABAJOS].map((p) => [p.id, p])) as Record<string, Procedimiento>

/**
 * El procedimiento con ese id: uno fijo (`paneles`, `regar`, `sellar`) o una instancia de una
 * familia (`reparar:oga`). La sala ajusta lo que depende de ella, como dónde se repara un equipo.
 */
export function procPorId(id: string, room?: RoomState): Procedimiento | undefined {
  if (PROC_BY_ID[id]) return PROC_BY_ID[id]
  const k = id.indexOf(':')
  if (k < 1) return undefined
  const familia = FAMILIAS[id.slice(0, k)]
  const objetivo = id.slice(k + 1)
  if (!familia || !objetivo) return undefined
  if (id.startsWith('reparar:') && !SISTEMA_BY_ID[objetivo as SistemaId]) return undefined
  if (id.startsWith('muestra:') && !SITIOS_MUESTRA.includes(objetivo)) return undefined
  if (id.startsWith('deber:') && !PROC_DEBER[objetivo]) return undefined
  return familia.crear(objetivo, room)
}

/** Todas las instancias que pueden existir ahora, más las que quedaron a medias. */
function instancias(room: RoomState): Procedimiento[] {
  const ids = new Set<string>()
  for (const [f, def] of Object.entries(FAMILIAS)) for (const o of def.objetivos(room)) ids.add(`${f}:${o}`)
  for (const k of Object.keys(room.procedimientos ?? {})) if (k.includes(':')) ids.add(k)
  return [...ids].map((id) => procPorId(id, room)).filter((p): p is Procedimiento => Boolean(p))
}
/** Procedimiento que monta cada tarea de la base. */
export const procDeTarea = (tareaId: string) => PROCEDIMIENTOS.find((p) => p.tarea === tareaId)

// ---------- Cuándo toca cada procedimiento ----------

const FASES_HUERTO = ['transito', 'llegada', 'ensamblaje', 'base']

/** ¿Se puede hacer ahora este procedimiento? */
export function disponible(room: RoomState, p: Procedimiento): boolean {
  if (p.aDemanda) {
    const e = room.procedimientos?.[p.id]
    if (e && !e.terminado && e.paso > 0 && (p.sigue?.(room) ?? true)) return true
    return p.puedeEmpezar?.(room) ?? false
  }
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
export const pasoActual = (room: RoomState, p: Procedimiento) =>
  siguienteAplicable(room, p, p.sigue && !p.sigue(room) ? 0 : (room.procedimientos?.[p.id]?.paso ?? 0))

/** Lo que se puede hacer ahora, con el paso que toca. */
export const activos = (room: RoomState) =>
  [...PROCEDIMIENTOS, ...TRABAJOS, ...instancias(room)]
    .filter((p) => disponible(room, p))
    .map((p) => ({ proc: p, paso: pasoActual(room, p) }))
    .filter((x) => x.paso < x.proc.pasos.length)

/** ¿Está a medias? (Alguien ya hizo algún paso y no lo terminó.) */
export const enCurso = (room: RoomState, id: string) => {
  const e = room.procedimientos?.[id]
  return Boolean(e && !e.terminado && e.paso > 0)
}

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
