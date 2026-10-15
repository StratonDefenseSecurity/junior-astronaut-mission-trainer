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
  { id: 'hojas', texto: 'Cortar las hojas de fuera y dejar el centro', calidad: 1, consecuencia: 'Es el corte y rebrote que se probó en la ISS en 2017: la planta sigue dando hojas y se vuelve a cosechar antes.', factor: 0.6, rebrota: true },
  { id: 'entera', texto: 'Cortar la planta entera', calidad: 0.7, consecuencia: 'Hoy hay más comida, pero hay que volver a sembrar y esperar el ciclo completo.', factor: 1, rebrota: false },
]

export const CULTIVOS: CultivoInfo[] = [
  {
    id: 'lechuga',
    nombre: 'Lechuga romana roja Outredgeous',
    dias: 33,
    kg: 0.9,
    rebrote: 0.5,
    historia: 'La primera verdura cultivada y comida en la ISS. Crecía 33 días y la tripulación la comió el 10 de agosto de 2015.',
    cortes: CORTES_HOJA,
  },
  {
    id: 'mizuna',
    nombre: 'Mizuna, una mostaza japonesa de hoja',
    dias: 28,
    kg: 0.8,
    rebrote: 0.5,
    historia: 'Se cultivó en Veggie en 2017 y 2019 para comparar distintas luces y cosechas repetidas.',
    cortes: CORTES_HOJA,
  },
  {
    id: 'rabano',
    nombre: 'Rábano',
    dias: 27,
    kg: 0.6,
    rebrote: 0,
    historia: 'El experimento PH-02 lo cultivó en el Hábitat Avanzado de Plantas en 2020. Madura en 27 días.',
    cortes: [
      { id: 'entera', texto: 'Sacar la planta entera con su raíz', calidad: 1, consecuencia: 'El rábano es la raíz: se cosecha entero y se vuelve a sembrar.', factor: 1, rebrota: false },
      { id: 'hojas', texto: 'Cortar solo las hojas', calidad: 0.3, consecuencia: 'Te quedas con unas hojas y la raíz deja de engordar.', factor: 0.3, rebrota: true },
    ],
  },
  {
    id: 'chile',
    nombre: 'Chile Española mejorado',
    dias: 110,
    kg: 1.2,
    rebrote: 0.75,
    historia: 'El experimento PH-04 lo cultivó en 2021 durante 137 días. Fue el primer fruto cosechado en la ISS, en dos cosechas.',
    cortes: [
      { id: 'frutos', texto: 'Cortar los chiles maduros con tijera', calidad: 1, consecuencia: 'La planta sigue floreciendo y da otra cosecha, como en PH-04.', factor: 1, rebrota: true },
      { id: 'entera', texto: 'Arrancar la planta', calidad: 0.2, consecuencia: 'Se pierde una planta que tardó meses en dar fruto.', factor: 1, rebrota: false },
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
    final > 88 ? `El sustrato queda al ${Math.round(final)}% y encharcado. Con tanta humedad aparece moho, como en las zinnias de la ISS.`
    : final < 45 ? `El sustrato queda al ${Math.round(final)}%. Es poco: las raíces siguen con sed.`
    : `El sustrato queda al ${Math.round(final)}% de humedad. Bien.`
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
      'En el espacio, NASA ya usa paneles flexibles que viajan enrollados como una alfombra: el ROSA se probó en la ISS en junio de 2017 y los iROSA los instalaron astronautas en caminatas espaciales desde junio de 2021. Se extienden solos con la energía elástica de sus largueros. En el suelo, un panel fijo se orienta hacia el ecuador y se inclina más o menos como la latitud del sitio, para que el Sol del mediodía le llegue de frente.',
    pasos: [
      {
        id: 'orientacion',
        tipo: 'elegir',
        titulo: 'Orientar el campo',
        instruccion: (room) => `La base está a ${Math.abs(latitudDe(room.sitio))}° de latitud ${latitudDe(room.sitio) < 0 ? 'sur' : 'norte'}. ¿Hacia dónde miran los paneles?`,
        porque: 'Un panel fijo recibe más luz al año si mira hacia el ecuador, porque el Sol del mediodía pasa por ese lado del cielo.',
        segundos: 8,
        opciones: (room) =>
          ['norte', 'sur', 'este', 'oeste'].map((az) => {
            const f = factorPanel(room.sitio, az, mejorInclinacion(room.sitio, haciaEcuador(room.sitio)))
            const ecuador = az === haciaEcuador(room.sitio)
            return {
              id: az,
              texto: `Hacia el ${az}`,
              calidad: ecuador ? 1 : r2(f),
              consecuencia: ecuador
                ? 'Hacia el ecuador: el Sol del mediodía les llega de frente.'
                : `Así aprovechan el ${pct(f)} de la luz del mediodía. ${Math.abs(latitudDe(room.sitio)) < 10 ? 'Cerca del ecuador casi no importa, lejos de él importa mucho.' : 'A esta latitud se pierde mucho.'}`,
            }
          }),
      },
      {
        id: 'anclaje',
        tipo: 'secuencia',
        titulo: 'Anclar el marco',
        instruccion: 'Aprieta los anclajes de las cuatro esquinas. Toca las esquinas en el orden en que las aprietas.',
        porque: 'Los pernos de una pieza grande se aprietan en cruz, alternando esquinas opuestas, para que el marco asiente parejo y no se tuerza.',
        segundos: 10,
        elementos: [
          { id: 'no', nombre: 'Esquina noroeste' },
          { id: 'ne', nombre: 'Esquina noreste' },
          { id: 'so', nombre: 'Esquina suroeste' },
          { id: 'se', nombre: 'Esquina sureste' },
        ],
        ordenes: ORDENES_CRUZ,
        error: 'Después de una esquina va la opuesta, en diagonal. Si aprietas dos seguidas del mismo lado, el marco se tuerce.',
      },
      {
        id: 'desenrollar',
        tipo: 'mantener',
        titulo: 'Desenrollar las alas',
        instruccion: 'Suelta el seguro y acompaña el ala mientras se extiende. Mantén pulsado hasta que se extienda entera.',
        porque: 'El ala se despliega sola, pero alguien la acompaña para que no se tuerza ni se enganche en las rocas. Si se suelta antes, se queda a medias.',
        segundos: 6,
        boton: 'Mantener para desenrollar',
      },
      {
        id: 'inclinacion',
        tipo: 'ajustar',
        titulo: 'Inclinar los paneles',
        instruccion: (room) => `Ajusta la inclinación de los paneles. La base está a ${Math.abs(latitudDe(room.sitio))}° de latitud.`,
        porque: 'Inclinado como la latitud, el panel queda perpendicular al Sol del mediodía en los equinoccios. Más plano o más empinado pierde luz.',
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
          return { calidad: r2(Math.min(1, f / mejor)), mensaje: `Con ${v}° hacia el ${az}, los paneles aprovechan el ${pct(f)} de la luz del mediodía.` }
        },
      },
    ],
  }),

  deTarea('carga', {
    intro:
      'Para bajar hábitats y rovers de un módulo de aterrizaje, NASA Langley diseñó una grúa ligera de celosía movida por cables, el Lunar Surface Manipulation System. Su versión de vuelo levantaría cerca de una tonelada en la Luna. El problema más conocido es el balanceo de la carga, porque en otro planeta no hay gente en el suelo para frenarla. Si viajó el reactor, también hay que decidir dónde dejarlo.',
    pasos: [
      {
        id: 'aparejo',
        tipo: 'secuencia',
        titulo: 'Preparar el izado',
        instruccion: 'Prepara la carga para levantarla. Toca los pasos en el orden en que los harías.',
        porque: 'Primero la carga cuelga de la grúa y el cable está tenso. Solo entonces se sueltan los amarres del viaje, para que nada se mueva solo al liberarlo.',
        segundos: 10,
        elementos: [
          { id: 'soltar', nombre: 'Soltar los amarres de lanzamiento' },
          { id: 'eslingas', nombre: 'Enganchar las eslingas a los cuatro puntos de izado' },
          { id: 'tensar', nombre: 'Tensar el cable de la grúa' },
          { id: 'guia', nombre: 'Atar un cabo guía para frenar el balanceo' },
        ],
        ordenes: [
          ['eslingas', 'guia', 'tensar', 'soltar'],
          ['guia', 'eslingas', 'tensar', 'soltar'],
          ['eslingas', 'tensar', 'guia', 'soltar'],
        ],
        error: 'Si sueltas los amarres antes de que el cable esté tenso, la carga se desliza sola por la cubierta.',
      },
      {
        id: 'bajar',
        tipo: 'mantener',
        titulo: 'Bajar la carga',
        instruccion: 'Baja cada palé despacio hasta el suelo. Mantén pulsado mientras baja.',
        porque: 'En Marte la carga pesa un tercio que en la Tierra, pero conserva toda su masa: si coge velocidad o se balancea, cuesta lo mismo frenarla.',
        segundos: 8,
        boton: 'Mantener para bajar',
      },
      {
        id: 'reactor',
        tipo: 'elegir',
        titulo: 'Dónde dejar el reactor',
        instruccion: 'El reactor de fisión da energía día y noche, pero emite radiación. ¿Dónde lo dejas?',
        porque: 'Los estudios de NASA para un reactor de superficie fijan la dosis aceptable a 1 km y proponen meterlo en un hoyo para que el propio suelo lo blinde. El reactor Kilopower superó en 2018 una prueba de 28 horas a plena potencia en Nevada.',
        segundos: 8,
        aplica: (room) => room.cargamento.reactor > 0,
        opciones: () => [
          { id: 'enterrado', texto: 'A 1 km, dentro de un hoyo cubierto con regolito', calidad: 1, consecuencia: 'El suelo hace de blindaje y la distancia baja la dosis. Hace falta tender un cable largo.' },
          { id: 'lejos', texto: 'A 1 km, sobre la superficie', calidad: 0.7, consecuencia: 'La distancia ayuda, pero sin suelo alrededor la radiación llega más lejos. Quien salga recibe algo más de dosis.' },
          { id: 'cerca', texto: 'Junto al hábitat, para ahorrar cable', calidad: 0.1, consecuencia: 'La tripulación recibe radiación del reactor día y noche. Por eso los planes de NASA lo alejan.' },
        ],
      },
    ],
  }),

  deTarea('energia', {
    intro:
      'En la ISS, los paneles dan entre 150 y 170 voltios de corriente continua. Unas unidades los fijan en 160 V, el bus primario, del que se cargan las baterías. Después, convertidores bajan la tensión a 124.5 V, el bus secundario que llega a los laboratorios y a la tripulación. Aquí se conecta igual, con el circuito bloqueado y de la fuente hacia las cargas.',
    pasos: [
      {
        id: 'seguridad',
        tipo: 'elegir',
        titulo: 'Asegurar el circuito',
        instruccion: 'Vas a conectar los cables de superficie al cuadro del hábitat. ¿Cómo lo preparas?',
        porque: 'Antes de tocar un conector se abre el interruptor, se le pone candado y etiqueta, y se mide que no haya tensión. Así nadie lo cierra mientras trabajas.',
        segundos: 8,
        opciones: () => [
          { id: 'bloqueo', texto: 'Abrir el interruptor, ponerle candado y etiqueta y medir que no hay tensión', calidad: 1, consecuencia: 'Así se trabaja con circuitos: nadie puede cerrarlo mientras conectas, y lo compruebas con el medidor.' },
          { id: 'apagar', texto: 'Abrir el interruptor sin candado', calidad: 0.6, consecuencia: 'Funciona, pero alguien que no sabe que estás conectando podría cerrarlo.' },
          { id: 'caliente', texto: 'Conectar con el circuito encendido para no cortar la luz', calidad: 0, repetir: true, consecuencia: 'No. En corriente continua el arco eléctrico no se apaga solo como en la alterna: quema el conector y a quien lo sostiene. Elige otra forma.' },
        ],
      },
      {
        id: 'cierre',
        tipo: 'secuencia',
        titulo: 'Energizar el sistema',
        instruccion: 'Cierra los interruptores uno a uno. Toca cada etapa en el orden en que la energizas.',
        porque: 'Se energiza de la fuente hacia las cargas, una etapa cada vez, comprobando la tensión antes de seguir. Así un fallo se ve en la etapa donde aparece.',
        segundos: 12,
        elementos: [
          { id: 'cargas', nombre: 'Cargas del hábitat' },
          { id: 'convertidor', nombre: 'Convertidor a 124.5 V' },
          { id: 'fuente', nombre: 'Generación de superficie' },
          { id: 'baterias', nombre: 'Baterías' },
          { id: 'primario', nombre: 'Bus primario de 160 V' },
        ],
        ordenes: [
          ['fuente', 'primario', 'baterias', 'convertidor', 'cargas'],
          ['fuente', 'primario', 'convertidor', 'baterias', 'cargas'],
        ],
        error: 'Va de la fuente hacia las cargas. Cerrar una etapa antes que la que la alimenta provoca un pico al conectarla y daña el equipo.',
      },
      {
        id: 'tension',
        tipo: 'ajustar',
        titulo: 'Ajustar el convertidor',
        instruccion: 'Ajusta la tensión de salida del convertidor que alimenta el hábitat.',
        porque: 'Los equipos están hechos para la tensión del bus secundario, 124.5 V en la ISS. Con más tensión se dañan; con menos piden más corriente y los cables se calientan.',
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
            mensaje: v > 130 ? `${v} V es demasiado: los equipos de soporte vital sufren por sobretensión.` : v < 119 ? `Con ${v} V los equipos piden más corriente y se pierde energía en calor.` : `${v} V. Los equipos reciben la tensión para la que están hechos.`,
          }
        },
      },
    ],
  }),

  deTarea('soporte', {
    intro:
      'El soporte vital de la ISS tiene tres equipos principales: el reciclador de agua, que recupera el 98% del agua; el generador de oxígeno, que separa agua en oxígeno e hidrógeno; y el depurador, que retira el CO2 del aire. Todos se enfrían con los lazos de agua del control térmico. Aquí se encienden en orden y se ajustan para la tripulación que hay.',
    pasos: [
      {
        id: 'arranque',
        tipo: 'secuencia',
        titulo: 'Encender los equipos',
        instruccion: 'Enciende los cuatro equipos. Toca cada uno en el orden en que lo enciendes.',
        porque: 'Primero la refrigeración, porque los equipos se calientan al trabajar. El generador de oxígeno va después del reciclador, porque separa el agua que este le da.',
        segundos: 12,
        elementos: [
          { id: 'oga', nombre: 'Generador de oxígeno' },
          { id: 'cdra', nombre: 'Depurador de CO2' },
          { id: 'termico', nombre: 'Control térmico' },
          { id: 'wrs', nombre: 'Reciclador de agua' },
        ],
        ordenes: [
          ['termico', 'wrs', 'cdra', 'oga'],
          ['termico', 'cdra', 'wrs', 'oga'],
          ['termico', 'wrs', 'oga', 'cdra'],
        ],
        error: 'Primero el control térmico, que enfría a los demás. Y el generador de oxígeno necesita el agua del reciclador: arrancarlo en seco lo daña.',
      },
      {
        id: 'oxigeno',
        tipo: 'ajustar',
        titulo: 'Producción de oxígeno',
        instruccion: (room) => `Ajusta cuánto oxígeno produce el generador al día. En la base viven ${room.jugadores.filter((j) => j.rol).length} personas.`,
        porque: `Cada persona consume unos ${0.84} kg de oxígeno al día. El generador de la ISS da hasta ${C.OGA_KG_DIA} kg. Producir de más gasta agua y energía; de menos, se vacían los tanques.`,
        segundos: 10,
        min: 0,
        max: C.OGA_KG_DIA,
        paso: 0.1,
        unidad: 'kg/día',
        inicial: 2,
        objetivo: (room) => r1(room.jugadores.filter((j) => j.rol).length * 0.84),
        evaluar: (room, v) => {
          const necesario = room.jugadores.filter((j) => j.rol).length * 0.84
          const r = necesario > 0 ? v / necesario : 1
          const calidad = r2(r < 0.95 ? limitar(1 - (0.95 - r) * 2.5, 0, 1) : r > 1.2 ? limitar(1 - (r - 1.2) * 0.6, 0.5, 1) : 1)
          return {
            calidad,
            mensaje: r < 0.95 ? `${v} kg al día no alcanza: hacen falta ${r1(necesario)}. El resto saldrá de los tanques.` : r > 1.2 ? `${v} kg al día es más de lo necesario: gasta agua y energía de más.` : `${v} kg al día cubre lo que respira la tripulación.`,
          }
        },
      },
      {
        id: 'alarma',
        tipo: 'elegir',
        titulo: 'Alarma de CO2',
        instruccion: '¿A cuánto CO2 en el aire debe saltar la alarma?',
        porque: 'NASA bajó el límite de CO2 en cabina a 3 mmHg porque con más la tripulación tiene dolores de cabeza y rinde menos. Una alarma tardía deja pasar el problema.',
        segundos: 6,
        opciones: () => [
          { id: '3', texto: 'A 3 mmHg', calidad: 1, consecuencia: 'Es el límite vigente de NASA. La alarma avisa a tiempo.' },
          { id: '5.3', texto: 'A 5.3 mmHg', calidad: 0.6, consecuencia: 'Era el límite anterior. La alarma avisa cuando ya hay síntomas.' },
          { id: '10', texto: 'A 10 mmHg', calidad: 0.2, consecuencia: 'La alarma saltará muy tarde: el aire ya hará daño antes de que se note.' },
        ],
      },
    ],
  }),

  deTarea('revisionInt', {
    intro:
      'En la ISS nunca se abre una escotilla sin comprobar antes que no hay fuga. Se presuriza el espacio entre las dos escotillas y se vigila que la presión no baje. Al llegar una nave Dragon en 2015, Samantha Cristoforetti lo presurizó a 260 mmHg y comprobó durante 20 minutos que se mantenía.',
    pasos: [
      {
        id: 'sello',
        tipo: 'secuencia',
        titulo: 'Preparar el sello',
        instruccion: 'Prepara la escotilla interior de la esclusa. Toca los pasos en orden.',
        porque: 'El polvo de Marte es muy fino y se pega a todo. Un grano en el sello basta para una fuga lenta, así que se revisa y se limpia antes de cerrar.',
        segundos: 10,
        elementos: [
          { id: 'cerrar', nombre: 'Cerrar la escotilla' },
          { id: 'limpiar', nombre: 'Limpiar el polvo del sello' },
          { id: 'trabas', nombre: 'Asegurar las trabas' },
          { id: 'revisar', nombre: 'Revisar el sello buscando cortes' },
        ],
        ordenes: [
          ['revisar', 'limpiar', 'cerrar', 'trabas'],
          ['limpiar', 'revisar', 'cerrar', 'trabas'],
        ],
        error: 'El sello se revisa y se limpia con la escotilla abierta. Las trabas se aseguran al final.',
      },
      {
        id: 'presurizar',
        tipo: 'mantener',
        titulo: 'Presurizar',
        instruccion: 'Abre la válvula y presuriza la esclusa a 260 mmHg. Mantén pulsado hasta llegar.',
        porque: 'Se usa una presión menor que la de cabina: si hay una fuga se nota igual, y si algo cede el golpe es menor.',
        segundos: 5,
        boton: 'Mantener para presurizar',
      },
      {
        id: 'caida',
        tipo: 'comprobar',
        titulo: 'Leer la caída de presión',
        instruccion: 'Observa la presión durante 20 minutos y decide si la esclusa es estanca.',
        porque: 'Si la presión baja más de lo que el sensor puede explicar, hay una fuga. Se busca y se repite la prueba antes de abrir.',
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
            titulo: 'Presión en la esclusa',
            unidad: 'mmHg',
            eje: 'minutos',
            puntos,
            limite: 259,
            limiteTexto: 'Caída máxima: 1 mmHg en 20 minutos',
            pregunta: '¿La esclusa es estanca?',
            correcto: fuga ? 'falla' : 'pasa',
            explicacion: fuga
              ? `La presión bajó ${r1(caida * 20)} mmHg en 20 minutos. Es más que el ruido del sensor: hay una fuga.`
              : 'La presión se mantiene. Lo que sube y baja es el ruido del sensor.',
          }
        },
      },
    ],
  }),

  deTarea('revisionExt', {
    intro:
      'En la ISS el exterior se fotografía con cámaras de mano y con las del brazo robótico. Las fotos se comparan con las anteriores para encontrar impactos de micrometeoritos. Aquí hay que buscar además los golpes del aterrizaje antes de dar la base por buena.',
    pasos: [
      {
        id: 'fotos',
        tipo: 'mantener',
        titulo: 'Fotografiar el casco',
        instruccion: 'Recorre el casco y fotografía cada tramo. Mantén pulsado mientras avanzas.',
        porque: 'Una marca pequeña no se ve a simple vista con el traje puesto. Las fotos se amplían y se comparan con las del despegue.',
        segundos: 6,
        boton: 'Mantener para fotografiar',
      },
      {
        id: 'marcas',
        tipo: 'comprobar',
        titulo: 'Medir las marcas',
        instruccion: 'Revisa la marca más profunda de cada tramo del casco y decide si hay que repararla.',
        porque: 'Una marca poco profunda es normal. Si pasa del límite, la capa de aislamiento quedó dañada y el hábitat pierde calor.',
        segundos: 10,
        lectura: (room) => {
          const d = room.procedimientos?.revisionExt?.datos ?? {}
          const dano = (d.dano ?? 0) > 0
          const zona = (d.semilla ?? 0) % 6
          const nombres = ['Proa', 'Puente', 'Centro', 'Huerto', 'Popa', 'Esclusa']
          const puntos = nombres.map((x, i) => ({ x, y: dano && i === zona ? 1.6 + ((d.semilla ?? 0) % 5) * 0.15 : r2(0.15 + Math.abs(Math.sin((d.semilla ?? 1) + i * 1.7)) * 0.4) }))
          return {
            forma: 'barras',
            titulo: 'Marca más profunda por tramo',
            unidad: 'mm',
            eje: 'tramo del casco',
            puntos,
            limite: 1,
            limiteTexto: 'Límite: 1 mm',
            pregunta: '¿El casco está en buen estado?',
            correcto: dano ? 'falla' : 'pasa',
            explicacion: dano ? `La marca del tramo ${nombres[zona].toLowerCase()} pasa del límite. Hay que parchearla.` : 'Todas las marcas están por debajo del límite.',
          }
        },
      },
    ],
  }),

  proc({
    id: 'huerto',
    titulo: 'Montar el huerto',
    intro:
      'El huerto sigue al Veggie de la ISS. Las plantas crecen en almohadillas de tela rellenas de arcilla cocida y abono de liberación lenta, con mechas que llevan el agua a las raíces. Encima hay una tapa de luces LED rojas, azules y verdes que tiñen todo de rosa, y un fuelle transparente que se alarga según crecen. La tripulación riega cada almohadilla con una jeringa.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'cultivo',
        tipo: 'elegir',
        titulo: 'Elegir el cultivo',
        instruccion: '¿Qué vas a cultivar? Todos se cultivaron en la ISS.',
        porque: 'Las primeras pruebas se hicieron con hojas que crecen rápido. Los frutos llegaron después: tardan meses y piden más cuidado.',
        segundos: 10,
        opciones: () => CULTIVOS.map((c) => ({ id: c.id, texto: c.nombre, calidad: 1, consecuencia: `${c.historia} En el juego se cosecha a los ${c.dias} días.` })),
      },
      {
        id: 'camara',
        tipo: 'mantener',
        titulo: 'Desplegar la cámara',
        instruccion: 'Extiende el fuelle transparente bajo la tapa de luces. Mantén pulsado mientras lo despliegas.',
        porque: 'El fuelle encierra a las plantas y guarda su humedad. Se sujeta con imanes y se alarga según crecen.',
        segundos: 4,
        boton: 'Mantener para desplegar',
      },
      {
        id: 'luces',
        tipo: 'elegir',
        titulo: 'Encender las luces',
        instruccion: '¿Qué luces enciendes sobre las plantas?',
        porque: 'Las plantas usan sobre todo la luz roja y la azul. Veggie añade verde para que la tripulación vea las hojas con un color más natural.',
        segundos: 6,
        opciones: () => [
          { id: 'rgb', texto: 'Rojo, azul y verde', calidad: 1, consecuencia: 'Como en Veggie. Crecen bien y se ve a tiempo si una hoja se mancha o amarillea.' },
          { id: 'rb', texto: 'Solo rojo y azul', calidad: 0.85, consecuencia: 'Crecen, pero se ven casi negras y cuesta notar un problema a tiempo.' },
          { id: 'blanca', texto: 'Las luces blancas de la cabina', calidad: 0.4, consecuencia: 'Son para la tripulación, no para cultivar. Llega poca luz a las hojas y crecen despacio.' },
        ],
      },
      {
        id: 'almohadillas',
        tipo: 'secuencia',
        titulo: 'Colocar las almohadillas',
        instruccion: `Coloca las ${ALMOHADILLAS} almohadillas con semillas. Toca los pasos en orden.`,
        porque: 'Las mechas solo llevan agua si tocan el tapete de raíces. En el viaje no hay gravedad: lo que no se sujeta, flota.',
        segundos: 10,
        elementos: [
          { id: 'sujetar', nombre: 'Sujetarlas con las cintas' },
          { id: 'mechas', nombre: 'Comprobar que las mechas tocan el tapete' },
          { id: 'colocar', nombre: 'Colocarlas sobre el tapete de raíces' },
        ],
        ordenes: [
          ['colocar', 'mechas', 'sujetar'],
          ['colocar', 'sujetar', 'mechas'],
        ],
        error: 'Primero hay que colocarlas sobre el tapete. No se puede comprobar ni sujetar lo que todavía no está en su sitio.',
      },
      {
        id: 'cebado',
        tipo: 'ajustar',
        titulo: 'Cebar con agua',
        instruccion: `Inyecta agua en cada almohadilla seca con la jeringa. Cada mL sube la humedad un ${HUMEDAD_POR_ML}%. Lo ideal es dejarla cerca del ${HUMEDAD_IDEAL}%.`,
        porque: 'En el primer cultivo de Veggie, en 2014, las mechas no subían suficiente agua y hubo que regar a mano. En 2015, el exceso de agua dio moho a las zinnias.',
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
    titulo: 'Regar el huerto',
    recurrente: true,
    intro: 'En Veggie la tripulación riega cada almohadilla con una jeringa por un puerto de agua. Scott Kelly aprendió en 2016 que no hay un horario fijo: se mira la planta y el sustrato, y se riega cuando lo necesitan.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'jeringa',
        tipo: 'secuencia',
        titulo: 'Preparar la jeringa',
        instruccion: 'Prepara la jeringa. Toca los pasos en orden.',
        porque: 'Sin gravedad, una burbuja no sube sola: se inyecta en la almohadilla y deja una zona seca. Por eso se saca el aire antes de conectar.',
        segundos: 8,
        elementos: [
          { id: 'inyectar', nombre: 'Inyectar el agua despacio' },
          { id: 'conectar', nombre: 'Conectar al puerto de la almohadilla' },
          { id: 'desconectar', nombre: 'Desconectar y tapar el puerto' },
          { id: 'purgar', nombre: 'Sacar el aire de la jeringa' },
        ],
        ordenes: [['purgar', 'conectar', 'inyectar', 'desconectar']],
        error: 'El aire se saca antes de conectar, y se inyecta con la jeringa ya conectada.',
      },
      {
        id: 'agua',
        tipo: 'ajustar',
        titulo: 'Cuánta agua',
        instruccion: (room) => {
          const s = secas(room)
          const min = s.length ? Math.round(Math.min(...s.map((a) => a.humedad))) : 50
          return `${s.length === 1 ? 'Hay una almohadilla' : `Hay ${s.length} almohadillas`} por debajo del 50%. La más seca está al ${min}%. Cada mL sube un ${HUMEDAD_POR_ML}%; lo ideal es dejarla cerca del ${HUMEDAD_IDEAL}%.`
        },
        porque: 'Poca agua deja las raíces con sed. Demasiada encharca la arcilla, las raíces se asfixian y aparece el moho.',
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
    titulo: 'Ralear las plántulas',
    recurrente: true,
    intro: 'En cada almohadilla se siembran varias semillas por si alguna no brota. Cuando crecen, se deja solo una por almohadilla, como se hizo en el primer cultivo de Veggie, para que no compitan por el agua y el abono.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'como',
        tipo: 'elegir',
        titulo: 'Dejar una por almohadilla',
        instruccion: 'Brotaron varias plántulas en cada almohadilla. ¿Qué haces?',
        porque: 'Varias plantas en el mismo puñado de arcilla se quitan el agua y el abono, y ninguna crece bien.',
        segundos: 8,
        opciones: () => [
          { id: 'cortar', texto: 'Dejar la más fuerte y cortar las demás a ras con tijera', calidad: 1, consecuencia: 'La que queda tiene todo el sustrato para ella y sus raíces no se tocan.' },
          { id: 'arrancar', texto: 'Arrancar las sobrantes de raíz', calidad: 0.6, consecuencia: 'Las raíces están enredadas: al tirar dañas también las de la planta que se queda.' },
          { id: 'dejar', texto: 'Dejarlas todas', calidad: 0.3, consecuencia: 'Compiten entre ellas y crecen más despacio.' },
        ],
      },
    ],
  }),

  proc({
    id: 'moho',
    titulo: 'Revisar las hojas: manchas blancas',
    recurrente: true,
    intro: 'En diciembre de 2015 las zinnias de la ISS se llenaron de moho: el agua se salía de las mechas y el aire se movía poco. Scott Kelly cortó lo dañado y subió el ventilador. NASA lo nombró jardinero autónomo para que decidiera él, sin esperar instrucciones de la Tierra.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'revisar',
        tipo: 'mantener',
        titulo: 'Revisar hoja por hoja',
        instruccion: 'Mira cada hoja por arriba y por debajo. Mantén pulsado mientras revisas.',
        porque: 'El moho empieza como una pelusa blanca bajo las hojas y en el sustrato húmedo.',
        segundos: 4,
        boton: 'Mantener para revisar',
      },
      {
        id: 'que',
        tipo: 'elegir',
        titulo: 'Qué hacer',
        instruccion: 'Hay hojas con pelusa blanca y el sustrato está empapado. ¿Qué haces?',
        porque: 'El moho crece con mucha humedad y poco aire. Se corta lo dañado, se guarda en bolsa para no esparcir esporas y se mueve más el aire.',
        segundos: 8,
        opciones: () => [
          { id: 'retirar', texto: 'Cortar las hojas con moho, guardarlas en bolsa y subir el ventilador', calidad: 1, consecuencia: 'Lo que hizo Kelly. Ojo: con más aire el sustrato se seca antes y habrá que regar más seguido.' },
          { id: 'nada', texto: 'Esperar a ver si se pasa', calidad: 0.2, consecuencia: 'El moho sigue avanzando y debilita a las plantas.' },
          { id: 'regar', texto: 'Regar más para que se recuperen', calidad: 0, consecuencia: 'Más agua es justo lo que necesita el moho para crecer.' },
        ],
      },
    ],
  }),

  proc({
    id: 'amarillas',
    titulo: 'Revisar las hojas: hojas caídas',
    recurrente: true,
    intro: 'Tras combatir el moho, las zinnias de la ISS se secaron: el ventilador alto se llevaba la humedad. Kelly aprendió a mirar las plantas y regar cuando lo pedían, sin esperar al calendario.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'revisar',
        tipo: 'mantener',
        titulo: 'Revisar hoja por hoja',
        instruccion: 'Mira las hojas y toca el sustrato. Mantén pulsado mientras revisas.',
        porque: 'Las hojas caídas, curvadas o amarillas avisan de que algo falla en las raíces.',
        segundos: 4,
        boton: 'Mantener para revisar',
      },
      {
        id: 'que',
        tipo: 'elegir',
        titulo: 'Qué hacer',
        instruccion: 'Hay hojas caídas y amarillentas. ¿Qué haces?',
        porque: 'Hay que buscar la causa. Aquí las hojas se caen por falta de agua en las raíces.',
        segundos: 8,
        opciones: () => [
          { id: 'regar', texto: 'Medir la humedad de cada almohadilla, regar las secas y bajar el ventilador', calidad: 1, consecuencia: 'Se ataca la causa. En unos días las hojas se levantan.' },
          { id: 'cortar', texto: 'Cortar las hojas amarillas y nada más', calidad: 0.4, consecuencia: 'Se ve mejor, pero las raíces siguen sin agua.' },
          { id: 'ventilador', texto: 'Subir el ventilador', calidad: 0.1, consecuencia: 'Seca todavía más las plantas. Fue lo que dejó sedientas a las zinnias.' },
        ],
      },
    ],
  }),

  proc({
    id: 'cosechar',
    titulo: 'Cosechar',
    recurrente: true,
    intro: 'El 10 de agosto de 2015 la tripulación de la ISS comió por primera vez lo que había cultivado: lechuga romana roja. La limpió con toallitas desinfectantes de ácido cítrico, comió la mitad y congeló la otra mitad para analizarla en la Tierra.',
    roles: ['cientifico'],
    zona: 'nave',
    estacion: 'laboratorio',
    pasos: [
      {
        id: 'corte',
        tipo: 'elegir',
        titulo: 'Cómo cosechar',
        instruccion: (room) => `${cultivoDe(room).nombre} ya está lista. ¿Cómo la cosechas?`,
        porque: 'Cada planta se cosecha según la parte que se come. Si se deja rebrotar, se vuelve a cosechar sin esperar todo el ciclo.',
        segundos: 8,
        opciones: (room) => cultivoDe(room).cortes,
      },
      {
        id: 'consumo',
        tipo: 'elegir',
        titulo: 'Antes de comer',
        instruccion: '¿Qué haces con lo cosechado?',
        porque: 'En la Tierra la verdura se lava. En el espacio no se puede enjuagar: se limpia con toallitas. Y una parte se guarda para saber si es segura.',
        segundos: 8,
        opciones: () => [
          { id: 'mitad', texto: 'Limpiar con toallitas, comer la mitad y congelar el resto para analizarlo', calidad: 1, consecuencia: 'Como en la ISS. Comida fresca hoy y datos para la próxima misión.' },
          { id: 'todo', texto: 'Limpiar con toallitas y comerla toda', calidad: 0.8, consecuencia: 'Más comida fresca hoy, pero nadie sabrá si estaba limpia de microbios.' },
          { id: 'sucia', texto: 'Comerla sin limpiar', calidad: 0, repetir: true, consecuencia: 'No. Las hojas pueden llevar microbios del hábitat. Primero se limpian con las toallitas.' },
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
  if (!paso) return { ok: false, mensaje: 'Paso inválido.' }
  switch (paso.tipo) {
    case 'mantener': {
      const s = Number(valor)
      if (!Number.isFinite(s) || s < paso.segundos - 0.3) return { ok: false, mensaje: 'Hay que mantenerlo hasta el final.' }
      return { ok: true, calidad: 1, mensaje: 'Hecho.', valor: paso.segundos }
    }
    case 'secuencia': {
      const v = (valor && typeof valor === 'object' ? valor : {}) as { orden?: unknown; errores?: unknown }
      const orden = Array.isArray(v.orden) ? v.orden.map(String) : []
      const errores = Math.max(0, Math.min(10, Math.round(Number(v.errores) || 0)))
      if (orden.length !== paso.elementos.length || !prefijoValido(paso, orden)) return { ok: false, mensaje: paso.error }
      const calidad = r2(Math.max(0.4, 1 - 0.15 * errores))
      return { ok: true, calidad, mensaje: errores ? `Orden correcto, con ${errores === 1 ? 'un error' : `${errores} errores`} antes.` : 'Orden correcto.', valor: errores }
    }
    case 'ajustar': {
      const v = Number(valor)
      if (!Number.isFinite(v) || v < paso.min || v > paso.max) return { ok: false, mensaje: `El valor tiene que estar entre ${paso.min} y ${paso.max} ${paso.unidad}.` }
      const redondo = Math.round(v / paso.paso) * paso.paso
      const e = paso.evaluar(room, r2(redondo))
      return { ok: true, calidad: e.calidad, mensaje: e.mensaje, valor: r2(redondo) }
    }
    case 'elegir': {
      const o = paso.opciones(room).find((x) => x.id === valor)
      if (!o) return { ok: false, mensaje: 'Opción inválida.' }
      if (o.repetir) return { ok: false, mensaje: o.consecuencia }
      return { ok: true, calidad: o.calidad, mensaje: o.consecuencia, valor: o.id }
    }
    case 'comprobar': {
      if (valor !== 'pasa' && valor !== 'falla') return { ok: false, mensaje: 'Decide si pasa o falla la comprobación.' }
      const l = paso.lectura(room)
      if (valor === 'falla' && l.correcto === 'pasa') return { ok: false, mensaje: `Vuelve a mirar. ${l.explicacion}` }
      return { ok: true, calidad: valor === l.correcto ? 1 : 0, mensaje: valor === l.correcto ? l.explicacion : 'Se da por buena.', valor }
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
