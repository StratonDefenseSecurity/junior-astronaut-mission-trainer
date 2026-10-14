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
    nombre: 'Comandante de misión',
    corto: 'CMD',
    descripcion: 'Supervisa cada rol, autoriza el lanzamiento, controla la escala de tiempo y aprueba o rechaza las decisiones en disputa.',
    consecuencias: 'Una mala aprobación la paga toda la tripulación. Sin comandante nadie resuelve las controversias.',
    color: '#f5b942',
  },
  {
    id: 'piloto',
    nombre: 'Piloto y navegación',
    corto: 'PIL',
    descripcion: 'Lleva la nave, corrige la trayectoria, elige el sitio de aterrizaje con el comandante y despliega los equipos al llegar.',
    consecuencias: 'Un mal sitio limita la luz o el agua toda la misión. Una corrección tardía gasta más propelente.',
    color: '#4fc3f7',
  },
  {
    id: 'medico',
    nombre: 'Médico de expedición',
    corto: 'MED',
    descripcion: 'Vigila pulso, respiración, oxígeno en sangre y dosis de radiación de cada integrante. Decide el plan de ejercicio y cuándo ir al refugio.',
    consecuencias: 'Ignorar una tormenta solar suma dosis que no se recupera. Sin ejercicio la tripulación llega débil a Marte.',
    color: '#ef5350',
  },
  {
    id: 'logistica',
    nombre: 'Recursos y logística',
    corto: 'LOG',
    descripcion: 'Controla agua, oxígeno, alimentos y energía. Decide las raciones, el reciclaje y cómo repartir lo que escasea.',
    consecuencias: 'Racionar de más debilita a la tripulación; racionar de menos agota las reservas antes de tiempo.',
    color: '#66bb6a',
  },
  {
    id: 'cientifico',
    nombre: 'Especialista científico',
    corto: 'CIE',
    descripcion: 'Se encarga de que se cumplan los planes y el objetivo de la misión: recoge muestras, las analiza y establece el huerto.',
    consecuencias: 'Sin muestras analizadas la misión no cumple su objetivo aunque todos sobrevivan.',
    color: '#ab47bc',
  },
  {
    id: 'sistemas',
    nombre: 'Responsable de sistemas',
    corto: 'SIS',
    descripcion: 'Activa el soporte vital y la energía, comprueba las instalaciones y repara los equipos yendo hasta ellos.',
    consecuencias: 'Un equipo sin mantenimiento falla en el peor momento. Los repuestos son limitados.',
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
  { id: 'corto', nombre: 'Corto' },
  { id: 'largo', nombre: 'Largo' },
  { id: 'rizado', nombre: 'Rizado' },
  { id: 'mono', nombre: 'Moño' },
  { id: 'rapado', nombre: 'Rapado' },
]
export const trajePorDefecto = (): Traje => ({ color: '#f2f4f7', acento: '#ff7a1a', visor: '#f5b942', piel: '#d39a6e', pelo: '#1b1410', peinado: 'corto' })

// ---------- Perfil de misión y trayectoria ----------

export interface PerfilInfo { id: PerfilId; nombre: string; soles: number; muestras: number; descripcion: string }
export const PERFILES: PerfilInfo[] = [
  { id: 'corta', nombre: 'Reconocimiento', soles: 10, muestras: 3, descripcion: '10 soles en la superficie y 3 muestras analizadas.' },
  { id: 'estandar', nombre: 'Exploración', soles: 20, muestras: 5, descripcion: '20 soles en la superficie y 5 muestras analizadas.' },
  { id: 'larga', nombre: 'Puesto avanzado', soles: 40, muestras: 8, descripcion: '40 soles en la superficie y 8 muestras analizadas.' },
]
export const PERFIL_BY_ID = Object.fromEntries(PERFILES.map((p) => [p.id, p])) as Record<PerfilId, PerfilInfo>

export interface TrayectoriaInfo { id: TrayectoriaId; nombre: string; dias: number; factorCarga: number; descripcion: string }
export const TRAYECTORIAS: TrayectoriaInfo[] = [
  { id: 'rapida', nombre: 'Rápida', dias: 150, factorCarga: 0.75, descripcion: '150 días. Menos radiación y menos consumo, pero el propelente extra quita un 25% de carga.' },
  { id: 'estandar', nombre: 'Estándar', dias: 210, factorCarga: 1, descripcion: '210 días. El equilibrio habitual entre tiempo y carga.' },
  { id: 'economica', nombre: 'Económica (Hohmann)', dias: 259, factorCarga: 1.15, descripcion: '259 días. La de menor energía: 15% más de carga, a cambio de más radiación y más consumo.' },
]
export const TRAYECTORIA_BY_ID = Object.fromEntries(TRAYECTORIAS.map((t) => [t.id, t])) as Record<TrayectoriaId, TrayectoriaInfo>

// ---------- Contextualización ----------

/**
 * Pasos de la contextualización, en el orden del esquema del equipo: primero se da la
 * situación, después se asignan los roles, se establece el objetivo y se eligen los suministros.
 */
export const PASOS_CONTEXTO = [
  { id: 'situacion', titulo: 'La situación', corto: 'Situación' },
  { id: 'roles', titulo: 'Asignación de roles', corto: 'Tu rol' },
  { id: 'objetivo', titulo: 'Objetivo de la misión', corto: 'Objetivo' },
  { id: 'suministros', titulo: 'Suministros', corto: 'Suministros' },
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
  { id: 'agua', nombre: 'Agua', unidad: '× 100 kg', masa: 0.1, min: 2, max: 60, consecuencia: 'Se bebe, se usa en higiene y el generador de oxígeno la convierte en aire. El reciclaje recupera hasta el 98%.' },
  { id: 'oxigeno', nombre: 'Oxígeno en tanques', unidad: '× 100 kg', masa: 0.16, min: 0, max: 20, consecuencia: 'Reserva directa de aire. Cada persona consume 0.84 kg por día. El tanque pesa más que el gas.' },
  { id: 'alimentos', nombre: 'Alimentos', unidad: '× 100 kg', masa: 0.1, min: 2, max: 50, consecuencia: 'Cada persona come 1.83 kg por día. No se pueden reciclar.' },
  { id: 'lioh', nombre: 'Cartuchos de hidróxido de litio', unidad: 'cartuchos', masa: 0.005, min: 0, max: 60, consecuencia: 'Absorben CO2 si falla el depurador. Fue lo que salvó al Apolo 13. Cada uno retira 2.7 kg.' },
  { id: 'repuestos', nombre: 'Repuestos', unidad: 'kits', masa: 0.05, min: 0, max: 30, consecuencia: 'La única forma de reparar un equipo dañado. Cada reparación usa uno o dos kits.' },
  { id: 'paneles', nombre: 'Campos solares', unidad: '× 50 m²', masa: 0.25, min: 1, max: 8, consecuencia: 'Cada campo da hasta 7 kW al mediodía con cielo limpio. De noche y con polvo no producen.' },
  { id: 'baterias', nombre: 'Baterías', unidad: '× 100 kWh', masa: 0.6, min: 1, max: 5, consecuencia: 'Sostienen la base durante la noche marciana, que dura más de 12 horas a −70 °C.' },
  { id: 'reactor', nombre: 'Reactor Kilopower', unidad: 'unidad', masa: 1.5, min: 0, max: 1, consecuencia: 'Da 10 kW día y noche sin importar el polvo. Pesa tanto como seis campos solares.' },
  { id: 'blindaje', nombre: 'Refugio blindado', unidad: 'capas', masa: 1.0, min: 0, max: 3, consecuencia: 'Reduce la dosis durante las tormentas solares. Pesa mucho y no protege fuera del refugio.' },
  { id: 'botiquin', nombre: 'Botiquines', unidad: 'kits', masa: 0.02, min: 0, max: 10, consecuencia: 'Cada kit permite tratar una lesión o enfermedad.' },
  { id: 'huerto', nombre: 'Kit de huerto', unidad: 'kit', masa: 0.3, min: 0, max: 1, consecuencia: 'Semillas, sustrato y luces para el huerto artificial. Da comida fresca y algo de oxígeno.' },
  { id: 'isru', nombre: 'Extractor de hielo', unidad: 'equipo', masa: 0.8, min: 0, max: 1, consecuencia: 'Saca agua del hielo enterrado. Solo sirve si aterrizan donde hay hielo.' },
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
  { id: 'gale', nombre: 'Cráter Gale', latitud: '4.6° S', descripcion: 'Donde trabaja el rover Curiosity. El clima del juego es el que se midió aquí. Zona ecuatorial con buena luz. Sin hielo accesible.', ajusteTemp: 0, solar: 1, hielo: false, bonoCiencia: 0 },
  { id: 'jezero', nombre: 'Cráter Jezero', latitud: '18.4° N', descripcion: 'Delta de un antiguo río, donde trabaja el rover Perseverance. Alto valor científico: una muestra menos en el objetivo. Sin hielo accesible.', ajusteTemp: -3, solar: 0.95, hielo: false, bonoCiencia: 1 },
  { id: 'utopia', nombre: 'Utopia Planitia', latitud: '45° N', descripcion: 'Llanura con hielo enterrado detectado por radar. Con el extractor se obtiene agua. Más fría y con un 25% menos de luz.', ajusteTemp: -15, solar: 0.75, hielo: true, bonoCiencia: 0 },
]
export const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s])) as Record<string, SiteInfo>

// ---------- Equipos ----------

export interface SistemaInfo { id: SistemaId; nombre: string; descripcion: string; exterior: boolean }
export const SISTEMAS: SistemaInfo[] = [
  { id: 'oga', nombre: 'Generador de oxígeno', descripcion: 'Separa el agua en oxígeno e hidrógeno por electrólisis.', exterior: false },
  { id: 'cdra', nombre: 'Depurador de CO2', descripcion: 'Retira del aire el CO2 que exhala la tripulación.', exterior: false },
  { id: 'wrs', nombre: 'Reciclador de agua', descripcion: 'Recupera agua de la orina y de la humedad del aire.', exterior: false },
  { id: 'termico', nombre: 'Control térmico', descripcion: 'Mantiene la cabina a 22 °C.', exterior: false },
  { id: 'esclusa', nombre: 'Esclusa', descripcion: 'Permite salir y entrar sin perder el aire de la cabina. Recarga los trajes.', exterior: false },
  { id: 'energia', nombre: 'Planta de energía', descripcion: 'Campos solares, reactor y baterías.', exterior: true },
  { id: 'huerto', nombre: 'Huerto artificial', descripcion: 'Cultivo bajo luces LED.', exterior: false },
  { id: 'isru', nombre: 'Extractor de hielo', descripcion: 'Derrite hielo enterrado y bombea el agua.', exterior: true },
]
export const SISTEMA_BY_ID = Object.fromEntries(SISTEMAS.map((s) => [s.id, s])) as Record<SistemaId, SistemaInfo>
/** Nombre del equipo para usar en mitad de una frase (inicial en minúscula, siglas intactas). */
export const nombreSistema = (id: SistemaId) => {
  const n = SISTEMA_BY_ID[id].nombre
  return n.charAt(0).toLowerCase() + n.slice(1)
}

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
  { paso: 0, titulo: 'Elegir la ubicación de la base', descripcion: 'Desde la órbita, el piloto propone un sitio y el comandante lo aprueba.', roles: ['piloto', 'comandante'] as Role[] },
  { paso: 1, titulo: 'Desplegar el hábitat y los equipos', descripcion: 'Logística y piloto salen con el traje a desplegar los campos solares y descargar la carga.', roles: ['logistica', 'piloto'] as Role[] },
  { paso: 2, titulo: 'Activar el soporte vital y la energía', descripcion: 'Sistemas y comandante conectan la energía de superficie y encienden el soporte vital.', roles: ['sistemas', 'comandante'] as Role[] },
  { paso: 3, titulo: 'Comprobar las instalaciones', descripcion: 'Sistemas revisa la esclusa por dentro y el casco por fuera antes de iniciar las operaciones.', roles: ['sistemas'] as Role[] },
]
export const TAREAS_ENSAMBLAJE: TareaEnsamblaje[] = [
  { id: 'paneles', paso: 1, titulo: 'Desplegar los campos solares', roles: ['logistica', 'piloto'], estacion: 'campoSolar', zona: 'exterior' },
  { id: 'carga', paso: 1, titulo: 'Descargar equipos y suministros', roles: ['logistica', 'piloto'], estacion: 'carga', zona: 'exterior' },
  { id: 'energia', paso: 2, titulo: 'Conectar la energía de superficie', roles: ['sistemas', 'comandante'], estacion: 'energia', zona: 'nave' },
  { id: 'soporte', paso: 2, titulo: 'Activar el soporte vital de superficie', roles: ['sistemas', 'comandante'], estacion: 'soporte', zona: 'nave' },
  { id: 'revisionInt', paso: 3, titulo: 'Comprobar la esclusa y los sellos', roles: ['sistemas'], estacion: 'esclusa', zona: 'nave' },
  { id: 'revisionExt', paso: 3, titulo: 'Inspeccionar el casco por fuera', roles: ['sistemas'], estacion: 'antena', zona: 'exterior' },
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
    titulo: 'Controlar agua, oxígeno, alimentos y energía',
    descripcion: 'Cuánto queda de cada cosa y para cuántos días alcanza.',
    roles: ['logistica', 'comandante', 'medico'],
    estaciones: ['almacen', 'energia'],
  },
  {
    id: 'distribuir',
    titulo: 'Decidir cómo distribuir recursos limitados',
    descripcion: 'Las raciones de comida y agua, y qué se protege si falta energía.',
    roles: ['logistica', 'comandante'],
    estaciones: ['almacen', 'energia'],
  },
  {
    id: 'produccion',
    titulo: 'Administrar producción y reciclaje',
    descripcion: 'El generador de oxígeno, el depurador de CO2 y el reciclador de agua.',
    roles: ['logistica', 'comandante', 'medico'],
    estaciones: ['soporte'],
  },
  {
    id: 'equipos',
    titulo: 'Mantener los equipos',
    descripcion: 'Revisar el desgaste y reparar antes de que fallen. Hay que ir hasta el equipo.',
    roles: ['sistemas'],
    estaciones: ['soporte', 'energia', 'esclusa'],
  },
  {
    id: 'radiacion',
    titulo: 'Proteger a la tripulación de la radiación',
    descripcion: 'La dosis de cada integrante, la orden de refugio y el plan de ejercicio.',
    roles: ['medico', 'comandante'],
    estaciones: ['enfermeria', 'refugio'],
  },
  {
    id: 'huerto',
    titulo: 'Huerto artificial de la base',
    descripcion: 'Montarlo, cuidarlo y cosechar. También las muestras del terreno.',
    roles: ['cientifico'],
    estaciones: ['laboratorio'],
  },
]

/** Lo que le toca a cada rol, según la matriz de responsables del esquema. */
export const tareasDeRol = (rol: Role): string[] => [
  ...PASOS_ENSAMBLAJE.filter((p) => p.roles.includes(rol)).map((p) => p.titulo),
  ...GESTION_BASE.filter((o) => o.roles.includes(rol)).map((o) => o.titulo),
  ...(rol === 'cientifico' ? ['Recoger y analizar las muestras del terreno'] : []),
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
  huerto: { progreso: number; establecido: boolean; diasCultivo: number; cosechas: number }
  ensamblaje: { paso: number; hechas: Record<string, string> }
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

// ---------- Escalas de tiempo ----------

export interface EscalaInfo { valor: number; nombre: string; detalle: string }
export const ESCALAS: EscalaInfo[] = [
  { valor: 1, nombre: '×1', detalle: 'tiempo real' },
  { valor: 10, nombre: '×10', detalle: '1 s = 10 s' },
  { valor: 60, nombre: '×60', detalle: '1 s = 1 min' },
  { valor: 600, nombre: '×600', detalle: '1 s = 10 min' },
  { valor: 3600, nombre: '×3 600', detalle: '1 s = 1 hora' },
  { valor: 21600, nombre: '×21 600', detalle: '1 s = 6 horas' },
  { valor: 86400, nombre: '×86 400', detalle: '1 s = 1 día' },
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
  if (e.fase === 'lobby' || e.fase === 'contexto') return 'Tierra'
  if (e.fase === 'lanzamiento') return formatoMET(e.t)
  if (tAterrizaje > 0 && e.t >= tAterrizaje) {
    const s = e.t - tAterrizaje + (HORA_ATERRIZAJE / 24) * solS
    return `Sol ${Math.floor(s / solS) + 1} ${formatoHora(((s % solS) / solS) * 24)}`
  }
  return `Día ${Math.floor(Math.max(0, e.t) / 86400) + 1}`
}

/** Segundo de misión en que la nave alcanza la órbita y sale hacia Marte. */
export const TRANSITO_INICIO_S = 510
/** Duración de la entrada, el descenso y el aterrizaje ("siete minutos de terror"). */
export const DESCENSO_S = 420
/** Cuenta regresiva antes del despegue. */
export const CUENTA_REGRESIVA_S = 12
