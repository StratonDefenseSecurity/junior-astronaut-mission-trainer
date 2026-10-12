// Tipos y catálogos compartidos entre servidor y cliente.

export type Role = 'comandante' | 'piloto' | 'medico' | 'logistica' | 'cientifico' | 'sistemas'
export type Phase = 'lobby' | 'contexto' | 'lanzamiento' | 'ensamblaje' | 'base' | 'fin'
export type DecisionMode = 'comandante' | 'votacion'
export type ModuleId = 'habitat' | 'soporteVital' | 'energia' | 'invernadero' | 'almacen' | 'taller' | 'refugio'
export type RacionLevel = 'normal' | 'ahorro' | 'estricto'

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
    descripcion: 'Supervisa cada rol. Aprueba o rechaza las decisiones en disputa y es responsable del objetivo de la misión.',
    consecuencias: 'Si aprueba mal una propuesta, toda la tripulación paga las consecuencias. Sin comandante no hay quien resuelva controversias.',
    color: '#f5b942',
  },
  {
    id: 'piloto',
    nombre: 'Piloto y navegación',
    corto: 'PIL',
    descripcion: 'Dirige el lanzamiento, elige el sitio de aterrizaje con el comandante y ayuda a desplegar el hábitat.',
    consecuencias: 'Un mal sitio de aterrizaje limita la energía o el agua durante toda la misión.',
    color: '#4fc3f7',
  },
  {
    id: 'medico',
    nombre: 'Médico de expedición',
    corto: 'MED',
    descripcion: 'Vigila la salud, el oxígeno y el pulso de cada integrante. Decide cómo proteger a la tripulación de la radiación.',
    consecuencias: 'Si ignora una tormenta solar o una enfermedad, un tripulante puede quedar fuera de servicio.',
    color: '#ef5350',
  },
  {
    id: 'logistica',
    nombre: 'Recursos y logística',
    corto: 'LOG',
    descripcion: 'Controla agua, oxígeno, alimentos y energía. Decide cómo distribuir recursos limitados y gestiona el reciclaje.',
    consecuencias: 'Racionar demasiado debilita a la tripulación; racionar poco agota las reservas antes de tiempo.',
    color: '#66bb6a',
  },
  {
    id: 'cientifico',
    nombre: 'Especialista científico',
    corto: 'CIE',
    descripcion: 'Se encarga de que se cumplan los planes y el objetivo científico. Establece el huerto artificial y ejecuta experimentos.',
    consecuencias: 'Sin huerto, la comida se acaba. Sin experimentos, la misión no cumple su objetivo aunque sobreviva.',
    color: '#ab47bc',
  },
  {
    id: 'sistemas',
    nombre: 'Responsable de sistemas',
    corto: 'SIS',
    descripcion: 'Activa el soporte vital y la energía, comprueba las instalaciones y mantiene los equipos.',
    consecuencias: 'Un módulo sin mantenimiento falla en el peor momento. Los repuestos son limitados.',
    color: '#ffa726',
  },
]

export const ROLE_BY_ID: Record<Role, RoleInfo> = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<Role, RoleInfo>

// Suministros que se eligen en Contextualización. masa en toneladas por unidad.
export type SupplyId = 'agua' | 'alimentos' | 'oxigeno' | 'repuestos' | 'semillas' | 'paneles' | 'blindaje' | 'botiquin'
export interface SupplyItem {
  id: SupplyId
  nombre: string
  unidad: string
  masa: number
  min: number
  max: number
  defecto: number
  consecuencia: string
}

export const SUPPLIES: SupplyItem[] = [
  { id: 'agua', nombre: 'Agua', unidad: 'tanques', masa: 1.0, min: 0, max: 20, defecto: 10, consecuencia: 'Cada tanque da 50 L. La tripulación consume 0.4 L por persona y hora si no hay reciclaje.' },
  { id: 'oxigeno', nombre: 'Oxígeno', unidad: 'tanques', masa: 0.8, min: 0, max: 20, defecto: 10, consecuencia: 'Cada tanque da 50 unidades. Sin soporte vital activo el oxígeno baja el doble de rápido.' },
  { id: 'alimentos', nombre: 'Alimentos', unidad: 'paquetes', masa: 0.6, min: 0, max: 20, defecto: 10, consecuencia: 'Cada paquete son 50 raciones. El huerto artificial puede reponer parte de la comida.' },
  { id: 'repuestos', nombre: 'Repuestos', unidad: 'cajas', masa: 0.5, min: 0, max: 12, defecto: 5, consecuencia: 'Cada caja da 5 repuestos. Son la única forma de reparar un módulo dañado.' },
  { id: 'semillas', nombre: 'Semillas y sustrato', unidad: 'kits', masa: 0.7, min: 0, max: 4, defecto: 2, consecuencia: 'Sin kits no se puede establecer el huerto artificial. Más kits aceleran su construcción.' },
  { id: 'paneles', nombre: 'Paneles solares', unidad: 'paneles', masa: 1.2, min: 1, max: 8, defecto: 4, consecuencia: 'Cada panel genera energía de día. De noche la base vive de la batería.' },
  { id: 'blindaje', nombre: 'Blindaje contra radiación', unidad: 'capas', masa: 2.5, min: 0, max: 3, defecto: 1, consecuencia: 'Cada capa reduce 30% la dosis de radiación. Pesa mucho y consume combustible.' },
  { id: 'botiquin', nombre: 'Botiquín médico', unidad: 'kits', masa: 0.3, min: 0, max: 6, defecto: 2, consecuencia: 'Cada kit permite tratar una emergencia médica o hacer una revisión.' },
]
export const MASA_MAXIMA = 40

export type Loadout = Record<SupplyId, number>
export const defaultLoadout = (): Loadout =>
  Object.fromEntries(SUPPLIES.map((s) => [s.id, s.defecto])) as Loadout
export const masaTotal = (l: Loadout): number =>
  SUPPLIES.reduce((acc, s) => acc + s.masa * (l[s.id] ?? 0), 0)

export interface SiteInfo {
  id: string
  nombre: string
  descripcion: string
  solar: number
  aguaExtra: number
  blindajeExtra: number
}
export const SITES: SiteInfo[] = [
  { id: 'jezero', nombre: 'Cráter Jezero', descripcion: 'Hielo cercano: +150 L de agua. Terreno irregular: 20% menos luz solar.', solar: 0.8, aguaExtra: 150, blindajeExtra: 0 },
  { id: 'utopia', nombre: 'Planicie Utopia', descripcion: 'Terreno plano con 20% más luz. Sin hielo accesible.', solar: 1.2, aguaExtra: 0, blindajeExtra: 0 },
  { id: 'tubo', nombre: 'Tubo de lava', descripcion: 'Blindaje natural (+1 capa). Solo 60% de luz para los paneles.', solar: 0.6, aguaExtra: 50, blindajeExtra: 1 },
]

export interface ModuleInfo { id: ModuleId; nombre: string; descripcion: string }
export const MODULES: ModuleInfo[] = [
  { id: 'habitat', nombre: 'Hábitat', descripcion: 'Donde vive y duerme la tripulación.' },
  { id: 'soporteVital', nombre: 'Soporte vital', descripcion: 'Regenera oxígeno y recicla agua. Si falla, el oxígeno cae rápido.' },
  { id: 'energia', nombre: 'Planta de energía', descripcion: 'Paneles solares y batería. Sin ella nada funciona de noche.' },
  { id: 'invernadero', nombre: 'Invernadero', descripcion: 'Huerto artificial. Produce alimentos cuando está establecido.' },
  { id: 'almacen', nombre: 'Almacén', descripcion: 'Reservas de agua, comida, oxígeno y repuestos.' },
  { id: 'taller', nombre: 'Taller', descripcion: 'Donde sistemas repara los equipos.' },
  { id: 'refugio', nombre: 'Refugio antirradiación', descripcion: 'Protege a la tripulación durante una tormenta solar.' },
]
export const MODULE_BY_ID: Record<ModuleId, ModuleInfo> = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<ModuleId, ModuleInfo>

export interface SystemState { id: ModuleId; integridad: number; online: boolean }

export interface HelpRequest { paraRol: Role; motivo: string; desde: number }

export interface Player {
  id: string
  nombre: string
  rol: Role | null
  conectado: boolean
  salud: number
  oxigeno: number
  pulso: number
  ubicacion: ModuleId
  ayuda: HelpRequest | null
  ayudando: string | null
  fueraDeServicio: number
}

export interface Resources { agua: number; oxigeno: number; alimentos: number; energia: number; repuestos: number; botiquines: number }

export type ProposalType = 'ubicacion' | 'racionar' | 'reciclaje' | 'refugio' | 'emergencia'

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
  rolesResponsables: Role[]
  alternativas: EmergencyAlternative[]
  creada: number
  vence: number
  estado: 'activa' | 'resuelta' | 'vencida'
  elegida: string | null
  resultado: string | null
}

export interface LogEntry { t: number; texto: string; tipo: 'info' | 'alerta' | 'ok' | 'bot' }
export interface ChatMsg { id: string; de: string; texto: string; t: number; bot: boolean }

export interface AssemblyStep { id: number; titulo: string; descripcion: string; roles: Role[] }
export const ASSEMBLY_STEPS: AssemblyStep[] = [
  { id: 0, titulo: 'Elegir ubicación de la base', descripcion: 'El piloto propone un sitio y el comandante lo aprueba (o se vota).', roles: ['piloto', 'comandante'] },
  { id: 1, titulo: 'Desplegar hábitat y equipos', descripcion: 'Logística y piloto confirman el despliegue.', roles: ['logistica', 'piloto'] },
  { id: 2, titulo: 'Activar soporte vital y energía', descripcion: 'Sistemas y comandante encienden los módulos críticos.', roles: ['sistemas', 'comandante'] },
  { id: 3, titulo: 'Comprobar instalaciones', descripcion: 'Sistemas verifica que todo funcione antes de operar.', roles: ['sistemas'] },
]

export interface RoomState {
  codigo: string
  hostId: string
  modoDecision: DecisionMode
  fase: Phase
  jugadores: Player[]
  mision: {
    objetivo: string
    solesObjetivo: number
    experimentosObjetivo: number
    sol: number
    hora: number
    combustible: number
    diasTransito: number
    experimentos: number
  }
  cargamento: Loadout
  masa: number
  transito: { inicio: number; duracion: number } | null
  ensamblaje: { paso: number; sitio: string | null; confirmaciones: Record<number, string[]> }
  recursos: Resources
  capacidad: Resources
  sistemas: SystemState[]
  racion: RacionLevel
  reciclajeActivo: boolean
  enRefugio: boolean
  refugioHasta: number
  radiacion: number
  blindaje: number
  tormenta: boolean
  tormentaHasta: number
  huerto: { establecido: boolean; progreso: number }
  prioridadEnergia: ModuleId
  propuestas: Proposal[]
  emergencias: Emergency[]
  registro: LogEntry[]
  chat: ChatMsg[]
  resultado: { victoria: boolean; motivo: string } | null
  puntosCriticos: string[]
}

// Acciones que un rol puede lanzar en la fase base.
export interface ActionDef {
  id: string
  nombre: string
  descripcion: string
  roles: Role[]
  requierePropuesta: boolean
}
export const ACTIONS: ActionDef[] = [
  { id: 'racionar', nombre: 'Distribuir recursos', descripcion: 'Cambia el nivel de ración: normal, ahorro o estricto.', roles: ['logistica', 'comandante'], requierePropuesta: true },
  { id: 'reciclaje', nombre: 'Producción y reciclaje', descripcion: 'Activa o desactiva el reciclaje de agua y oxígeno. Consume energía.', roles: ['logistica', 'comandante', 'medico'], requierePropuesta: true },
  { id: 'refugio', nombre: 'Proteger de la radiación', descripcion: 'Lleva a la tripulación al refugio 6 horas. Se detiene la producción.', roles: ['medico', 'comandante'], requierePropuesta: true },
  { id: 'reparar', nombre: 'Mantener equipos', descripcion: 'Repara un módulo usando 2 repuestos.', roles: ['sistemas'], requierePropuesta: false },
  { id: 'prioridad', nombre: 'Priorizar energía', descripcion: 'Elige qué módulo recibe energía primero cuando falta.', roles: ['sistemas'], requierePropuesta: false },
  { id: 'huerto', nombre: 'Trabajar en el huerto', descripcion: 'Avanza el huerto artificial. Requiere kits de semillas.', roles: ['cientifico'], requierePropuesta: false },
  { id: 'experimento', nombre: 'Ejecutar experimento', descripcion: 'Consume 6 de energía y suma al objetivo científico.', roles: ['cientifico'], requierePropuesta: false },
  { id: 'revision', nombre: 'Revisión médica', descripcion: 'Atiende a un tripulante y recupera 15 de salud. Consume 1 botiquín.', roles: ['medico'], requierePropuesta: false },
]

export const HORA_MS = 2500 // milisegundos reales por hora de misión
export const TRANSITO_MS = 14000 // duración real de la animación de lanzamiento
