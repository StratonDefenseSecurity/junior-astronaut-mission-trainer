// Tipos y catálogos compartidos entre servidor y cliente.

export type Role = 'comandante' | 'piloto' | 'medico' | 'logistica' | 'cientifico' | 'sistemas'
export type Phase = 'lobby' | 'contexto' | 'lanzamiento' | 'transito' | 'llegada' | 'ensamblaje' | 'base' | 'fin'
export type DecisionMode = 'comandante' | 'votacion'
/** Dónde está el astronauta: dentro del hábitat presurizado o fuera con el traje. */
export type Zona = 'nave' | 'exterior'
export type Actividad = 'sueno' | 'reposo' | 'trabajo' | 'ejercicio' | 'eva'
export type SistemaId = 'oga' | 'cdra' | 'wrs' | 'energia' | 'termico' | 'esclusa' | 'huerto' | 'isru'
export type RacionComida = 'normal' | 'ahorro' | 'estricto'
export type RacionAgua = 'normal' | 'ahorro'
export type PerfilId = 'corta' | 'estandar' | 'larga'
export type TrayectoriaId = 'rapida' | 'estandar' | 'economica'

// ---------- Roles ----------

export interface RoleInfo {
  id: Role
  nombre: string
  corto: string
  descripcion: string
  consecuencias: string
  color: string
}

export const ROLES: RoleInfo[] = [
  {
    id: 'comandante',
    nombre: 'Mission Commander',
    corto: 'CMD',
    descripcion: 'Oversees every role, authorizes the launch, controls the time scale and approves or rejects disputed decisions.',
    consecuencias: 'The whole crew pays for a bad approval. Without a commander, nobody settles disputes.',
    color: '#f5b942',
  },
  {
    id: 'piloto',
    nombre: 'Pilot & Navigator',
    corto: 'PLT',
    descripcion: 'Flies the ship, corrects the trajectory, picks the landing site with the commander and deploys the equipment on arrival.',
    consecuencias: 'A bad site limits light or water for the whole mission. A late correction burns more propellant.',
    color: '#4fc3f7',
  },
  {
    id: 'medico',
    nombre: 'Flight Surgeon',
    corto: 'MED',
    descripcion: 'Watches the pulse, breathing, blood oxygen and radiation dose of every crew member. Decides the exercise plan and when to go to the shelter.',
    consecuencias: 'Ignoring a solar storm adds dose that never goes away. Without exercise, the crew reaches Mars weak.',
    color: '#ef5350',
  },
  {
    id: 'logistica',
    nombre: 'Resources & Logistics',
    corto: 'LOG',
    descripcion: 'Tracks water, oxygen, food and power. Decides the rations, the recycling and how to share what is running low.',
    consecuencias: 'Rationing too much weakens the crew. Rationing too little uses up the reserves too early.',
    color: '#66bb6a',
  },
  {
    id: 'cientifico',
    nombre: 'Science Specialist',
    corto: 'SCI',
    descripcion: 'Makes sure the mission plans and objective are met: collects samples, analyzes them and sets up the garden.',
    consecuencias: 'Without analyzed samples, the mission misses its objective even if everyone survives.',
    color: '#ab47bc',
  },
  {
    id: 'sistemas',
    nombre: 'Systems Engineer',
    corto: 'SYS',
    descripcion: 'Turns on life support and power, checks the facilities and repairs equipment by going to it.',
    consecuencias: 'Equipment without maintenance fails at the worst moment. Spare parts are limited.',
    color: '#ffa726',
  },
]
export const ROLE_BY_ID: Record<Role, RoleInfo> = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<Role, RoleInfo>

// ---------- Traje ----------

export type Peinado = 'corto' | 'largo' | 'rizado' | 'mono' | 'rapado'
export interface Traje {
  color: string
  acento: string
  visor: string
  /** Tono de piel, color y forma del pelo del personaje. */
  piel: string
  pelo: string
  peinado: Peinado
}
export const TRAJE_COLORES = ['#f2f4f7', '#ff7a1a', '#3b82f6', '#22c55e', '#e11d48', '#a855f7', '#eab308', '#334155']
export const TRAJE_VISORES = ['#f5b942', '#38bdf8', '#111827', '#f472b6']
export const TRAJE_PIELES = ['#f3d2b8', '#e8b48f', '#d39a6e', '#b97a4f', '#8d5a3b', '#5e3b26']
export const TRAJE_PELOS = ['#1b1410', '#3b2417', '#6b4226', '#a8743f', '#d8b16a', '#9a9a9a']
export const PEINADOS: { id: Peinado; nombre: string }[] = [
  { id: 'corto', nombre: 'Short' },
  { id: 'largo', nombre: 'Long' },
  { id: 'rizado', nombre: 'Curly' },
  { id: 'mono', nombre: 'Bun' },
  { id: 'rapado', nombre: 'Buzz cut' },
]
export const trajePorDefecto = (): Traje => ({ color: '#f2f4f7', acento: '#ff7a1a', visor: '#f5b942', piel: '#d39a6e', pelo: '#1b1410', peinado: 'corto' })

// ---------- Perfil de misión y trayectoria ----------

export interface PerfilInfo { id: PerfilId; nombre: string; soles: number; muestras: number; descripcion: string }
export const PERFILES: PerfilInfo[] = [
  { id: 'corta', nombre: 'Reconnaissance', soles: 10, muestras: 3, descripcion: '10 sols on the surface and 3 analyzed samples.' },
  { id: 'estandar', nombre: 'Exploration', soles: 20, muestras: 5, descripcion: '20 sols on the surface and 5 analyzed samples.' },
  { id: 'larga', nombre: 'Outpost', soles: 40, muestras: 8, descripcion: '40 sols on the surface and 8 analyzed samples.' },
]
export const PERFIL_BY_ID = Object.fromEntries(PERFILES.map((p) => [p.id, p])) as Record<PerfilId, PerfilInfo>

export interface TrayectoriaInfo { id: TrayectoriaId; nombre: string; dias: number; factorCarga: number; descripcion: string }
export const TRAYECTORIAS: TrayectoriaInfo[] = [
  { id: 'rapida', nombre: 'Fast', dias: 150, factorCarga: 0.75, descripcion: '150 days. Less radiation and fewer supplies used, but the extra propellant takes away 25% of the cargo.' },
  { id: 'estandar', nombre: 'Standard', dias: 210, factorCarga: 1, descripcion: '210 days. The usual balance between time and cargo.' },
  { id: 'economica', nombre: 'Economy (Hohmann)', dias: 259, factorCarga: 1.15, descripcion: '259 days. The lowest-energy option: 15% more cargo, but more radiation and more supplies used.' },
]
export const TRAYECTORIA_BY_ID = Object.fromEntries(TRAYECTORIAS.map((t) => [t.id, t])) as Record<TrayectoriaId, TrayectoriaInfo>

// ---------- Contextualización ----------

/**
 * Pasos de la contextualización, en el orden del esquema del equipo: primero se da la
 * situación, después se asignan los roles, se establece el objetivo y se eligen los suministros.
 */
export const PASOS_CONTEXTO = [
  { id: 'situacion', titulo: 'The Situation', corto: 'Situation' },
  { id: 'roles', titulo: 'Role Assignment', corto: 'Your Role' },
  { id: 'objetivo', titulo: 'Mission Objective', corto: 'Objective' },
  { id: 'suministros', titulo: 'Supplies', corto: 'Supplies' },
] as const

/**
 * Cuántos tripulantes cuenta el plan. Antes del lanzamiento son los que están en la sala
 * (todos elegirán rol); después, quienes tienen rol.
 */
export const tripulantesPlan = (room: { fase: Phase; jugadores: { rol: Role | null; conectado: boolean }[] }): number =>
  room.fase === 'lobby' || room.fase === 'contexto'
    ? Math.max(1, room.jugadores.filter((j) => j.rol || j.conectado).length)
    : room.jugadores.filter((j) => j.rol).length

/** Toneladas de carga que admite la nave según la tripulación y la trayectoria. */
export const capacidadCarga = (tripulantes: number, trayectoria: TrayectoriaId) =>
  Math.round((5 + tripulantes) * TRAYECTORIA_BY_ID[trayectoria].factorCarga * 10) / 10

// ---------- Suministros ----------

export type SupplyId =
  | 'agua' | 'oxigeno' | 'alimentos' | 'lioh' | 'repuestos' | 'paneles'
  | 'baterias' | 'reactor' | 'blindaje' | 'botiquin' | 'huerto' | 'isru'

export interface SupplyItem {
  id: SupplyId
  nombre: string
  unidad: string
  /** Toneladas por unidad. */
  masa: number
  min: number
  max: number
  consecuencia: string
}

export const SUPPLIES: SupplyItem[] = [
  { id: 'agua', nombre: 'Water', unidad: '× 100 kg', masa: 0.1, min: 2, max: 60, consecuencia: 'For drinking and hygiene, and the oxygen generator turns it into air. Recycling recovers up to 98%.' },
  { id: 'oxigeno', nombre: 'Oxygen tanks', unidad: '× 100 kg', masa: 0.16, min: 0, max: 20, consecuencia: 'A direct reserve of air. Each person uses 0.84 kg per day. The tank weighs more than the gas.' },
  { id: 'alimentos', nombre: 'Food', unidad: '× 100 kg', masa: 0.1, min: 2, max: 50, consecuencia: 'Each person eats 1.83 kg per day. Food cannot be recycled.' },
  { id: 'lioh', nombre: 'Lithium hydroxide cartridges', unidad: 'cartridges', masa: 0.005, min: 0, max: 60, consecuencia: 'They absorb CO2 if the scrubber fails. This is what saved Apollo 13. Each one removes 2.7 kg.' },
  { id: 'repuestos', nombre: 'Spare parts', unidad: 'kits', masa: 0.05, min: 0, max: 30, consecuencia: 'The only way to repair damaged equipment. Each repair uses one or two kits.' },
  { id: 'paneles', nombre: 'Solar arrays', unidad: '× 50 m²', masa: 0.25, min: 1, max: 8, consecuencia: 'Each array gives up to 7 kW at noon under a clear sky. They produce nothing at night or under dust.' },
  { id: 'baterias', nombre: 'Batteries', unidad: '× 100 kWh', masa: 0.6, min: 1, max: 5, consecuencia: 'They keep the base running through the Martian night, which lasts more than 12 hours at −70 °C.' },
  { id: 'reactor', nombre: 'Kilopower reactor', unidad: 'unit', masa: 1.5, min: 0, max: 1, consecuencia: 'Gives 10 kW day and night, no matter the dust. It weighs as much as six solar arrays.' },
  { id: 'blindaje', nombre: 'Shielded shelter', unidad: 'layers', masa: 1.0, min: 0, max: 3, consecuencia: 'Lowers the dose during solar storms. It is very heavy and gives no protection outside the shelter.' },
  { id: 'botiquin', nombre: 'Medical kits', unidad: 'kits', masa: 0.02, min: 0, max: 10, consecuencia: 'Each kit treats one injury or illness.' },
  { id: 'huerto', nombre: 'Garden kit', unidad: 'kit', masa: 0.3, min: 0, max: 1, consecuencia: 'Seeds, growing medium and lights for the plant garden. It gives fresh food and some oxygen.' },
  { id: 'isru', nombre: 'Ice extractor', unidad: 'unit', masa: 0.8, min: 0, max: 1, consecuencia: 'Gets water from buried ice. It only works if you land where there is ice.' },
]
export const SUPPLY_BY_ID = Object.fromEntries(SUPPLIES.map((s) => [s.id, s])) as Record<SupplyId, SupplyItem>

export type Loadout = Record<SupplyId, number>
export const masaTotal = (l: Loadout): number =>
  Math.round(SUPPLIES.reduce((acc, s) => acc + s.masa * (l[s.id] ?? 0), 0) * 100) / 100

// ---------- Sitios de aterrizaje ----------

export interface SiteInfo {
  id: string
  nombre: string
  latitud: string
  descripcion: string
  /** Ajuste estimado respecto al clima medido en Gale. */
  ajusteTemp: number
  solar: number
  hielo: boolean
  /** Muestras que se descuentan del objetivo por el valor científico del sitio. */
  bonoCiencia: number
}
export const SITES: SiteInfo[] = [
  { id: 'gale', nombre: 'Gale Crater', latitud: '4.6° S', descripcion: 'Where the Curiosity rover works. The game weather is the weather measured here. Equatorial zone with good light. No ice you can reach.', ajusteTemp: 0, solar: 1, hielo: false, bonoCiencia: 0 },
  { id: 'jezero', nombre: 'Jezero Crater', latitud: '18.4° N', descripcion: 'The delta of an ancient river, where the Perseverance rover works. High science value: one fewer sample in the objective. No ice you can reach.', ajusteTemp: -3, solar: 0.95, hielo: false, bonoCiencia: 1 },
  { id: 'utopia', nombre: 'Utopia Planitia', latitud: '45° N', descripcion: 'A plain with buried ice found by radar. The extractor can get water from it. Colder, with 25% less light.', ajusteTemp: -15, solar: 0.75, hielo: true, bonoCiencia: 0 },
]
export const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s])) as Record<string, SiteInfo>

// ---------- Equipos ----------

export interface SistemaInfo { id: SistemaId; nombre: string; descripcion: string; exterior: boolean }
export const SISTEMAS: SistemaInfo[] = [
  { id: 'oga', nombre: 'Oxygen Generator', descripcion: 'Splits water into oxygen and hydrogen by electrolysis.', exterior: false },
  { id: 'cdra', nombre: 'CO2 Scrubber', descripcion: 'Removes the CO2 that the crew breathes out.', exterior: false },
  { id: 'wrs', nombre: 'Water Recycler', descripcion: 'Recovers water from urine and from moisture in the air.', exterior: false },
  { id: 'termico', nombre: 'Thermal Control', descripcion: 'Keeps the cabin at 22 °C.', exterior: false },
  { id: 'esclusa', nombre: 'Airlock', descripcion: 'Lets you go out and come in without losing cabin air. Recharges the suits.', exterior: false },
  { id: 'energia', nombre: 'Power Plant', descripcion: 'Solar arrays, reactor and batteries.', exterior: true },
  { id: 'huerto', nombre: 'Plant Garden', descripcion: 'Crops grown under LED lights.', exterior: false },
  { id: 'isru', nombre: 'Ice Extractor', descripcion: 'Melts buried ice and pumps out the water.', exterior: true },
]
export const SISTEMA_BY_ID = Object.fromEntries(SISTEMAS.map((s) => [s.id, s])) as Record<SistemaId, SistemaInfo>
/** Nombre del equipo para usar en mitad de una frase (inicial en minúscula, siglas intactas). */
export const nombreSistema = (id: SistemaId) =>
  SISTEMA_BY_ID[id].nombre
    .split(' ')
    .map((w) => (/^[A-Z0-9]+$/.test(w) ? w : w.toLowerCase()))
    .join(' ')

export interface SistemaEstado {
  id: SistemaId
  /** 0 a 100. */
  integridad: number
  /** Si la tripulación lo quiere encendido. */
  activo: boolean
  /** Si de verdad está funcionando (encendido, con energía y sin avería). */
  operativo: boolean
  instalado: boolean
}

// ---------- Ensamblaje de la base ----------

export interface TareaEnsamblaje {
  id: string
  paso: number
  titulo: string
  roles: Role[]
  /** Estación del mapa donde se hace. */
  estacion: string
  zona: Zona
}
export const PASOS_ENSAMBLAJE = [
  { paso: 0, titulo: 'Choose the base location', descripcion: 'From orbit, the pilot proposes a site and the commander approves it.', roles: ['piloto', 'comandante'] as Role[] },
  { paso: 1, titulo: 'Deploy the habitat and equipment', descripcion: 'Logistics and the pilot suit up and go outside to deploy the solar arrays and unload the cargo.', roles: ['logistica', 'piloto'] as Role[] },
  { paso: 2, titulo: 'Turn on life support and power', descripcion: 'Systems and the commander connect surface power and turn on life support.', roles: ['sistemas', 'comandante'] as Role[] },
  { paso: 3, titulo: 'Check the facilities', descripcion: 'Systems checks the airlock from inside and the hull from outside before operations begin.', roles: ['sistemas'] as Role[] },
]
export const TAREAS_ENSAMBLAJE: TareaEnsamblaje[] = [
  { id: 'paneles', paso: 1, titulo: 'Deploy the solar arrays', roles: ['logistica', 'piloto'], estacion: 'campoSolar', zona: 'exterior' },
  { id: 'carga', paso: 1, titulo: 'Unload equipment and supplies', roles: ['logistica', 'piloto'], estacion: 'carga', zona: 'exterior' },
  { id: 'energia', paso: 2, titulo: 'Connect surface power', roles: ['sistemas', 'comandante'], estacion: 'energia', zona: 'nave' },
  { id: 'soporte', paso: 2, titulo: 'Turn on surface life support', roles: ['sistemas', 'comandante'], estacion: 'soporte', zona: 'nave' },
  { id: 'revisionInt', paso: 3, titulo: 'Check the airlock and seals', roles: ['sistemas'], estacion: 'esclusa', zona: 'nave' },
  { id: 'revisionExt', paso: 3, titulo: 'Inspect the hull from outside', roles: ['sistemas'], estacion: 'antena', zona: 'exterior' },
]

// ---------- Página principal de la base ----------

/**
 * Las opciones de la página principal, tal como las plantea el esquema del equipo: cada una
 * tiene sus responsables y una sub-interfaz distinta, que es la estación donde se gestiona.
 */
export interface OpcionBase {
  id: 'controlar' | 'distribuir' | 'produccion' | 'equipos' | 'radiacion' | 'huerto'
  titulo: string
  descripcion: string
  roles: Role[]
  /** Estaciones del hábitat donde está su sub-interfaz. */
  estaciones: string[]
}
export const GESTION_BASE: OpcionBase[] = [
  {
    id: 'controlar',
    titulo: 'Track water, oxygen, food and power',
    descripcion: 'How much of each is left and how many days it will last.',
    roles: ['logistica', 'comandante', 'medico'],
    estaciones: ['almacen', 'energia'],
  },
  {
    id: 'distribuir',
    titulo: 'Decide how to share limited resources',
    descripcion: 'Food and water rations, and what stays on if power runs short.',
    roles: ['logistica', 'comandante'],
    estaciones: ['almacen', 'energia'],
  },
  {
    id: 'produccion',
    titulo: 'Manage production and recycling',
    descripcion: 'The oxygen generator, the CO2 scrubber and the water recycler.',
    roles: ['logistica', 'comandante', 'medico'],
    estaciones: ['soporte'],
  },
  {
    id: 'equipos',
    titulo: 'Maintain the equipment',
    descripcion: 'Check the wear and repair things before they fail. You have to go to the equipment.',
    roles: ['sistemas'],
    estaciones: ['soporte', 'energia', 'esclusa'],
  },
  {
    id: 'radiacion',
    titulo: 'Protect the crew from radiation',
    descripcion: 'Each crew member\'s dose, the order to take shelter and the exercise plan.',
    roles: ['medico', 'comandante'],
    estaciones: ['enfermeria', 'refugio'],
  },
  {
    id: 'huerto',
    titulo: 'Base plant garden',
    descripcion: 'Set it up, look after it and harvest. Also the ground samples.',
    roles: ['cientifico'],
    estaciones: ['laboratorio'],
  },
]

/** Lo que le toca a cada rol, según la matriz de responsables del esquema. */
export const tareasDeRol = (rol: Role): string[] => [
  ...PASOS_ENSAMBLAJE.filter((p) => p.roles.includes(rol)).map((p) => p.titulo),
  ...GESTION_BASE.filter((o) => o.roles.includes(rol)).map((o) => o.titulo),
  ...(rol === 'cientifico' ? ['Collect and analyze the ground samples'] : []),
]

// ---------- Estado ----------

export interface Vitales {
  /** Frecuencia cardiaca, latidos por minuto. */
  fc: number
  /** Frecuencia respiratoria, respiraciones por minuto. */
  fr: number
  /** Saturación de oxígeno en sangre, %. */
  spo2: number
  /** 100 = bien hidratado. */
  hidratacion: number
  /** 100 = reservas de energía completas. */
  reservas: number
  /** 0 = descansado, 100 = agotado. */
  fatiga: number
  /** Dosis de radiación acumulada, mSv. */
  dosis: number
  /** Dosis que está recibiendo ahora, mSv por día. */
  dosisTasa: number
  /** Músculo y hueso: 100 = como al salir de la Tierra. */
  condicion: number
  /** 0 a 100. */
  salud: number
}

export interface HelpRequest { paraRol: Role; motivo: string; desde: number }

export interface Player {
  id: string
  nombre: string
  rol: Role | null
  conectado: boolean
  traje: Traje
  zona: Zona
  actividad: Actividad
  /** Actividad que el jugador eligió a mano (ejercitarse, dormir); null = según el horario. */
  manual: Actividad | null
  /** Segundo de misión en que termina la actividad elegida a mano. */
  manualHasta: number
  vit: Vitales
  /** kg de agua que le faltan al cuerpo. */
  deficitAgua: number
  /** kcal que le faltan al cuerpo. */
  deficitKcal: number
  /** kg de oxígeno en el tanque del traje. */
  trajeO2: number
  /** 0 a 1. */
  trajeBateria: number
  enRefugio: boolean
  /** Segundos de misión que le quedan fuera de servicio. */
  incapacitado: number
  dolencia: string | null
  /** Segundo de misión en que la dolencia se pasa sola. */
  dolenciaHasta: number
  ayuda: HelpRequest | null
  /** Paso de la contextualización en el que va (ver PASOS_CONTEXTO). */
  paso: number
  /** Listo para el lanzamiento. */
  listo: boolean
  /** Tareas y trabajos que ha completado: su progreso a la vista de los demás. */
  aportes: number
  /** Ciudad de origen (ver CIUDADES): se marca en la Tierra y recibe mensajes de casa. */
  hogar: string | null
  /** Muestras que carga sin analizar. */
  muestras: number
  /** Cada muestra que carga: el sitio, la roca y su valor científico (0 a 1) según cómo se tomó. */
  muestrasTomadas?: { sitio: string; roca: string; valor: number }[]
  /** kg de O2 por hora que pierde de más el traje por una fuga que no se reparó antes de salir. */
  trajeFuga?: number
  /** Tripulante controlado por el servidor (modo de un jugador). */
  bot?: boolean
  /** Estación donde está trabajando ahora (los bots caminan hasta ella). */
  estacion?: string | null
}

export interface Recursos {
  /** kg de agua potable. */
  agua: number
  /** kg de agua usada esperando reciclaje. */
  aguaResidual: number
  /** kg de oxígeno en tanques. */
  o2: number
  /** kg de alimento. */
  comida: number
  repuestos: number
  botiquines: number
  /** Cartuchos de LiOH sin usar. */
  lioh: number
  /** kg de CO2 que aún pueden absorber los cartuchos instalados. */
  liohActivo: number
  /** Margen de propelente, %. */
  propelente: number
}

export interface Energia {
  bateria: number
  capacidad: number
  generacion: number
  consumo: number
  /** kWh consumidos desde el despegue. */
  usada: number
  /** Fracción de potencia perdida por polvo sobre los paneles. */
  polvo: number
  /** Equipos apagados por falta de energía. */
  cortes: SistemaId[]
}

export interface Cabina {
  ppO2: number
  ppCO2: number
  temp: number
  /** kg de aire que se escapan por hora si hay una fuga. */
  fuga: number
}

export interface TormentaSolar {
  id: string
  fecha: string
  /** mSv por día en espacio abierto y sin blindaje. */
  tasa: number
  /** Segundo de misión en que termina. */
  hasta: number
}

export interface Ambiente {
  /** Sol desde el aterrizaje (1 = día del aterrizaje). 0 antes de llegar. */
  sol: number
  /** Hora local, 0 a 24. En tránsito es la hora de a bordo. */
  hora: number
  tempExt: number
  presion: number
  /** Opacidad del polvo en la atmósfera. */
  tau: number
  uv: number
  /** W/m² que llegan a los paneles. */
  flujoSolar: number
  tormentaPolvo: boolean
  /** Soles que le quedan a la tormenta de polvo. */
  polvoSoles: number
  /** Sol de Curiosity del que se toman los datos de hoy. */
  solCuriosity: number
  /** Dosis de fondo actual, mSv por día. */
  radiacion: number
  tormentaSolar: TormentaSolar | null
}

export interface Vuelo {
  altitud: number
  velocidad: number
  g: number
  etapa: string
  /** 0 a 1 del viaje Tierra–Marte. */
  progreso: number
  /** Millones de km. */
  distTierra: number
  distMarte: number
  /** Unidades astronómicas. */
  distSol: number
  /** Segundos que tarda una señal en llegar a la Tierra. */
  retardo: number
}

export interface Ajustes {
  racionComida: RacionComida
  racionAgua: RacionAgua
  /** Horas de ejercicio por día. */
  ejercicio: number
  /** Qué se apaga último cuando falta energía. */
  prioridad: 'vida' | 'calor' | 'ciencia'
}

export type ProposalType = 'ubicacion' | 'racionComida' | 'racionAgua' | 'equipo' | 'refugio' | 'ejercicio' | 'prioridad' | 'emergencia'

export interface Proposal {
  id: string
  tipo: ProposalType
  titulo: string
  descripcion: string
  payload: Record<string, unknown>
  proponente: string
  rolesResponsables: Role[]
  votos: Record<string, boolean>
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  creada: number
  vence: number
}

export interface EmergencyAlternative { id: string; etiqueta: string; consecuencia: string }
export interface Emergency {
  id: string
  tipo: string
  titulo: string
  descripcion: string
  /** Referencia al registro real, si la emergencia viene de datos de NASA. */
  fuente: string | null
  rolesResponsables: Role[]
  alternativas: EmergencyAlternative[]
  datos: Record<string, unknown>
  creada: number
  vence: number
  estado: 'activa' | 'resuelta' | 'vencida'
  elegida: string | null
  resultado: string | null
}

/** `t` es el segundo de misión en que ocurrió. */
export interface LogEntry { t: number; fase: Phase; texto: string; tipo: 'info' | 'alerta' | 'ok' | 'radio' }
export interface ChatMsg { id: string; de: string; texto: string; t: number; bot: boolean }

export interface RoomState {
  codigo: string
  /** Sube en 1 con cada acción guardada. Sirve para detectar copias atrasadas. */
  version: number
  /** Reloj virtual (ms) del último paso de simulación. */
  reloj: number
  /** Semilla del azar de la sala. */
  rng: number
  /** ms de tiempo real que la misión ha estado detenida (pausa o sala vacía). */
  desfase: number
  pausa: boolean
  hostId: string
  modoDecision: DecisionMode
  fase: Phase
  /** Detalle dentro de la fase: en `llegada` es 'orbita' o 'descenso'. */
  subfase: string
  jugadores: Player[]

  /** Segundos de misión desde el despegue. Negativo durante la cuenta regresiva. */
  t: number
  /** Segundos de misión por segundo real. */
  escala: number
  /** Escala que eligió el comandante; `escala` puede bajar sola durante una alerta. */
  escalaDeseada: number
  /** Segundo de misión del aterrizaje. */
  tAterrizaje: number
  /** Segundo de misión en que empezó la fase actual. */
  tFase: number
  /** Día del año 2024 que corresponde al despegue (para el clima espacial real). */
  diaLanzamiento: number
  /** Primer índice del año de datos de Curiosity que se usa como sol 1. */
  indiceClima: number
  /** Situación de la misión (ver shared/escenarios.ts). */
  escenario: string
  /** Lo que eligió quien creó la sala: una situación concreta o 'azar'. */
  escenarioElegido: string
  /** Nombre que la tripulación le pone a su misión. */
  nombreMision: string
  /** 'solo': un jugador con tripulantes bot; 'multi': todos son personas. */
  modoJuego?: 'solo' | 'multi'
  /** Memoria de los tripulantes bot, por id (ver server/tripulantes.ts). */
  bots?: Record<string, MemoriaBot>
  /** Avance de cada procedimiento por pasos (ver shared/procedimientos.ts), por id. */
  procedimientos?: Record<string, EstadoProcedimiento>
  /** Sucesos preparados para esta misión: los de la situación más alguno al azar. */
  guion: { viaje?: number; sol?: number; tipo: string; datos?: Record<string, unknown>; hecho: boolean }[]

  perfil: PerfilId
  trayectoria: TrayectoriaId
  mision: {
    objetivo: string
    solesObjetivo: number
    muestrasObjetivo: number
    muestrasAnalizadas: number
    diasTransito: number
    /** kg de agua sacados del hielo con el extractor, y la meta si la misión la tiene. */
    aguaExtraida: number
    aguaObjetivo: number
  }
  cargamento: Loadout
  masa: number
  capacidad: number
  sitio: string | null

  vuelo: Vuelo
  ambiente: Ambiente
  cabina: Cabina
  rec: Recursos
  energia: Energia
  sistemas: SistemaEstado[]
  ajustes: Ajustes
  /** Capas de blindaje del refugio. */
  blindaje: number
  /** Segundo de misión hasta el que la tripulación debe quedarse en el refugio. */
  refugioHasta: number
  huerto: Huerto
  ensamblaje: { paso: number; hechas: Record<string, string> }
  /** Consecuencias de cómo se montó la base (ver server/procedimientos.ts). Vacío = como un experto. */
  efectos?: EfectosMontaje
  /** Sitios de muestreo ya visitados. */
  muestreos: string[]
  /** Días que alcanzan las reservas al ritmo actual (999 = de sobra). */
  autonomia: { agua: number; aire: number; comida: number }
  /** Índices de los eventos reales de clima espacial ya procesados. */
  climaEspacial: { fulguracion: number; particulas: number }

  /** Último segundo de misión en que se lanzó cada aviso, para no repetirlo. */
  avisos: Record<string, number>
  /** Emergencias que esperan a que se resuelva la que está activa. */
  cola: { tipo: string; datos: Record<string, unknown> }[]

  propuestas: Proposal[]
  emergencias: Emergency[]
  registro: LogEntry[]
  chat: ChatMsg[]
  puntosCriticos: string[]
  resultado: { victoria: boolean; titulo: string; motivo: string } | null
}

/** Avance de un procedimiento: en qué paso va, qué tan bien se hizo cada paso y quién lo hizo. */
export interface EstadoProcedimiento {
  /** Índice del siguiente paso por hacer. */
  paso: number
  /** 0 a 1 por paso hecho: 1 = como lo haría un experto. */
  calidad: number[]
  /** Id de quien hizo cada paso. */
  por: string[]
  /** Segundo de misión en que empezó. */
  inicio: number
  terminado: boolean
  /** Valor que se dio en cada paso (ángulo, opción elegida, mL de agua...). */
  valores?: (number | string | null)[]
  /** Datos que prepara el servidor para un paso, como la lectura de un instrumento. */
  datos?: Record<string, number>
}

/** Lo que dejó el montaje de la base y que la simulación aplica cada paso. */
export interface EfectosMontaje {
  /** Fracción de la luz que aprovechan los paneles según su orientación e inclinación. */
  solar?: number
  /** mSv por día de más que recibe la tripulación por dónde quedó el reactor. */
  reactorDosis?: number
  /** Multiplica el consumo eléctrico: una tensión baja obliga a más corriente y más pérdidas. */
  perdidaBus?: number
  /** kg de oxígeno por día a los que se ajustó el generador. */
  ogaKgDia?: number
  /** kPa de CO2 a los que salta la alarma. */
  alarmaCO2?: number
}

export type CultivoId = 'lechuga' | 'mizuna' | 'rabano' | 'chile'

/** Una almohadilla de cultivo, como las del Veggie de la ISS. */
export interface Almohadilla {
  /** 0 a 100: agua en el sustrato de arcilla. */
  humedad: number
  /** 0 a 100. */
  salud: number
  /** 0 a 1 hasta la cosecha. */
  crecimiento: number
  /** 0 a 1: hongos en hojas y sustrato. */
  moho: number
  /** Plántulas que brotaron; se ralea a una. */
  plantulas: number
  raleada: boolean
  muerta: boolean
}

export interface Huerto {
  progreso: number
  establecido: boolean
  diasCultivo: number
  cosechas: number
  cultivo?: CultivoId
  /** 0 a 1: qué tan buena es la luz elegida para el cultivo. */
  luz?: number
  /** Ventilador alto: seca hojas y sustrato más rápido. */
  ventilador?: 'normal' | 'alto'
  almohadillas?: Almohadilla[]
  /** Segundo de misión de la última revisión de hojas, para no repetirla enseguida. */
  revisado?: number
  /** kg de verdura fresca comida en la misión. */
  comidaFresca?: number
}

/** Un tramo del trabajo de un bot: ir a una estación, quedarse unos segundos y hacer algo allí. */
export interface EtapaBot {
  estacion: string
  zona: Zona
  /** Segundos reales de trabajo en la estación, sin contar el camino. */
  segundos: number
  /** Lo que hace al terminar (ver `ejecutar` en server/tripulantes.ts). */
  hacer: Record<string, unknown> | null
}

/** Lo que recuerda cada tripulante bot entre un segundo y el siguiente. */
export interface MemoriaBot {
  /** Reloj (ms) hasta el que se lo piensa antes de volver a actuar. */
  libre: number
  /** Reloj (ms) de su último mensaje en el chat. */
  habla: number
  /** Dónde terminó su último trabajo, para calcular lo que tarda en llegar al siguiente. */
  x: number
  z: number
  /** Trabajo en curso: sus etapas y cuándo termina la actual. */
  trabajo: { que: string; etapas: EtapaBot[]; hasta: number } | null
  /** Cosas ya dichas o hechas y cuándo, para no repetirlas. */
  marcas: Record<string, number>
}

// ---------- Escalas de tiempo ----------

export interface EscalaInfo { valor: number; nombre: string; detalle: string }
export const ESCALAS: EscalaInfo[] = [
  { valor: 1, nombre: '×1', detalle: 'real time' },
  { valor: 10, nombre: '×10', detalle: '1 s = 10 s' },
  { valor: 60, nombre: '×60', detalle: '1 s = 1 min' },
  { valor: 600, nombre: '×600', detalle: '1 s = 10 min' },
  { valor: 3600, nombre: '×3,600', detalle: '1 s = 1 hour' },
  { valor: 21600, nombre: '×21,600', detalle: '1 s = 6 hours' },
  { valor: 86400, nombre: '×86,400', detalle: '1 s = 1 day' },
]
/** Escala más alta que se permite en cada fase. */
export const ESCALA_MAXIMA: Record<Phase, number> = {
  lobby: 1,
  contexto: 1,
  lanzamiento: 10,
  transito: 86400,
  llegada: 60,
  ensamblaje: 600,
  base: 3600,
  fin: 1,
}
/** Escala a la que baja la misión mientras hay una emergencia sin resolver. */
export const ESCALA_ALERTA = 60

// ---------- Formato ----------

const dos = (n: number) => String(Math.floor(n)).padStart(2, '0')

/** Tiempo de misión como T+ddd hh:mm:ss. */
export function formatoMET(t: number): string {
  const signo = t < 0 ? 'T−' : 'T+'
  const a = Math.abs(t)
  const d = Math.floor(a / 86400)
  const resto = `${dos((a % 86400) / 3600)}:${dos((a % 3600) / 60)}:${dos(a % 60)}`
  return d > 0 ? `${signo}${d} d ${resto}` : `${signo}${resto}`
}
export const formatoHora = (h: number) => `${dos(h)}:${dos((h % 1) * 60)}`

/** Hora local a la que se aterriza. */
export const HORA_ATERRIZAJE = 9

/** Etiqueta corta del momento de la misión para el registro. */
export function etiquetaTiempo(e: { t: number; fase: Phase }, tAterrizaje: number, solS: number): string {
  if (e.fase === 'lobby' || e.fase === 'contexto') return 'Earth'
  if (e.fase === 'lanzamiento') return formatoMET(e.t)
  if (tAterrizaje > 0 && e.t >= tAterrizaje) {
    const s = e.t - tAterrizaje + (HORA_ATERRIZAJE / 24) * solS
    return `Sol ${Math.floor(s / solS) + 1} ${formatoHora(((s % solS) / solS) * 24)}`
  }
  return `Day ${Math.floor(Math.max(0, e.t) / 86400) + 1}`
}

/**
 * Segundo de misión en que la nave sale hacia Marte. El ascenso es el de Artemis I
 * (shared/ascenso.ts): corte de motores a T+500 s y separación de la etapa central a T+512 s; los
 * segundos que siguen dejan ver la etapa alejarse antes del crucero.
 */
export const TRANSITO_INICIO_S = 560
/** Duración de la entrada, el descenso y el aterrizaje ("siete minutos de terror"). */
export const DESCENSO_S = 420
/** Cuenta regresiva antes del despegue. */
export const CUENTA_REGRESIVA_S = 12
