// Plano del hábitat y de la base: dónde está cada estación y por dónde se puede caminar.
import { activos } from '@shared/procedimientos'
import { TAREAS_ENSAMBLAJE, type Player, type Role, type RoomState, type SistemaId, type Zona } from '@shared/types'

export interface Estacion {
  id: string
  zona: Zona
  nombre: string
  x: number
  z: number
  /** Radio del objeto, para no atravesarlo. 0 = pegado a la pared. */
  radio: number
  /** Equipo que se repara aquí, si lo hay. */
  sistemas?: SistemaId[]
}

/** Interior: módulo de 18 × 6.4 m. El pasillo central es por donde se camina. */
export const INTERIOR = { x0: -9, x1: 9, z0: -3.2, z1: 3.2, alto: 3, pasilloX0: -8.2, pasilloX1: 8.3, pasilloZ: 1.95 }
/** Exterior: se puede caminar hasta 46 m del hábitat. */
export const EXTERIOR = { radio: 46, habX: 9.7, habZ: 3.9 }

export const ESTACIONES: Estacion[] = [
  { id: 'puente', zona: 'nave', nombre: 'Bridge', x: -7.6, z: 0, radio: 0.85 },
  { id: 'soporte', zona: 'nave', nombre: 'Life Support', x: -4.6, z: -2.6, radio: 0, sistemas: ['oga', 'cdra', 'wrs', 'termico'] },
  { id: 'energia', zona: 'nave', nombre: 'Power', x: -1.5, z: -2.6, radio: 0 },
  { id: 'almacen', zona: 'nave', nombre: 'Storage', x: 1.6, z: -2.6, radio: 0 },
  { id: 'laboratorio', zona: 'nave', nombre: 'Lab & Garden', x: 4.7, z: -2.6, radio: 0, sistemas: ['huerto'] },
  { id: 'enfermeria', zona: 'nave', nombre: 'Medical Bay', x: -4.6, z: 2.6, radio: 0 },
  { id: 'ejercicio', zona: 'nave', nombre: 'Gym', x: -1.5, z: 2.6, radio: 0 },
  { id: 'literas', zona: 'nave', nombre: 'Bunks', x: 1.6, z: 2.6, radio: 0 },
  { id: 'refugio', zona: 'nave', nombre: 'Storm Shelter', x: 4.7, z: 2.6, radio: 0 },
  { id: 'esclusa', zona: 'nave', nombre: 'Airlock', x: 8.4, z: 0, radio: 0, sistemas: ['esclusa'] },
  // Mesa común en el centro del módulo: donde la tripulación come y conversa.
  { id: 'comedor', zona: 'nave', nombre: 'Galley Table', x: 0.05, z: 0, radio: 0.62 },

  { id: 'esclusaExt', zona: 'exterior', nombre: 'Airlock', x: 10.6, z: 0, radio: 0 },
  { id: 'plantaExt', zona: 'exterior', nombre: 'Power Plant', x: 14.5, z: -8, radio: 1.1, sistemas: ['energia'] },
  { id: 'campoSolar', zona: 'exterior', nombre: 'Solar Arrays', x: 21, z: -15, radio: 0 },
  { id: 'carga', zona: 'exterior', nombre: 'Cargo Area', x: 17, z: 10, radio: 1.6 },
  { id: 'antena', zona: 'exterior', nombre: 'Antenna & Hull', x: -12.5, z: -7, radio: 0.7 },
  { id: 'isruExt', zona: 'exterior', nombre: 'Ice Extractor', x: -17, z: 12, radio: 1.3, sistemas: ['isru'] },
  { id: 'muestra1', zona: 'exterior', nombre: 'Sample Site 1', x: 25, z: 5, radio: 0 },
  { id: 'muestra2', zona: 'exterior', nombre: 'Sample Site 2', x: -23, z: -5, radio: 0 },
  { id: 'muestra3', zona: 'exterior', nombre: 'Sample Site 3', x: 7, z: 27, radio: 0 },
  { id: 'muestra4', zona: 'exterior', nombre: 'Sample Site 4', x: -9, z: -25, radio: 0 },
  { id: 'muestra5', zona: 'exterior', nombre: 'Sample Site 5', x: 32, z: -20, radio: 0 },
  { id: 'muestra6', zona: 'exterior', nombre: 'Sample Site 6', x: -29, z: 15, radio: 0 },
  { id: 'muestra7', zona: 'exterior', nombre: 'Sample Site 7', x: 21, z: 31, radio: 0 },
  { id: 'muestra8', zona: 'exterior', nombre: 'Sample Site 8', x: -31, z: -27, radio: 0 },
]
export const ESTACION_BY_ID = Object.fromEntries(ESTACIONES.map((e) => [e.id, e])) as Record<string, Estacion>

/** Distancia a la que se puede usar una estación. */
export const ALCANCE = 2.1

/** Dónde aparece cada uno al entrar en una zona. */
export const ENTRADA: Record<Zona, { x: number; z: number; giro: number }> = {
  nave: { x: 6.9, z: 0, giro: -Math.PI / 2 },
  exterior: { x: 12.4, z: 0, giro: Math.PI / 2 },
}

/** Puesto habitual de cada rol: donde se ve a quien no está moviendo su personaje. */
export const PUESTO: Record<Role, { x: number; z: number }> = {
  comandante: { x: -6.2, z: 0.9 },
  piloto: { x: -6.2, z: -0.9 },
  medico: { x: -4.6, z: 1.5 },
  logistica: { x: 1.6, z: -1.5 },
  cientifico: { x: 4.7, z: -1.5 },
  sistemas: { x: -1.5, z: -1.5 },
}
export const PUESTO_REFUGIO = { x: 4.7, z: 1.7 }

/** Dónde se coloca cada uno para hacer ejercicio, dormir o refugiarse. */
export const PUNTOS = {
  /** Cinta de correr y bicicleta del gimnasio, mirando hacia el puente. */
  cinta: { x: -2.15, z: 1.72, giro: -Math.PI / 2 },
  bici: { x: -0.75, z: 1.72, giro: -Math.PI / 2 },
  /** Sacos de dormir sujetos a la pared (sin gravedad) y literas (en Marte). */
  sacos: [-0.1, 0.52, 1.14, 1.76, 2.38, 3.0].map((x) => ({ x, z: 2.28, giro: Math.PI })),
  literas: [0.6, 1.6, 2.6].flatMap((x) => [0.42, 1.32].map((y) => ({ x, z: 2.35, y, giro: Math.PI }))),
}

/** Corrige una posición para que no atraviese paredes ni objetos. */
export function limitarPosicion(zona: Zona, x: number, z: number, visibles: (id: string) => boolean): [number, number] {
  if (zona === 'nave') {
    x = Math.min(INTERIOR.pasilloX1, Math.max(INTERIOR.pasilloX0, x))
    z = Math.min(INTERIOR.pasilloZ, Math.max(-INTERIOR.pasilloZ, z))
  } else {
    const d = Math.hypot(x, z)
    if (d > EXTERIOR.radio) {
      x *= EXTERIOR.radio / d
      z *= EXTERIOR.radio / d
    }
    // El hábitat es un bloque: se empuja hacia el lado más cercano.
    if (Math.abs(x) < EXTERIOR.habX && Math.abs(z) < EXTERIOR.habZ) {
      const dx = EXTERIOR.habX - Math.abs(x)
      const dz = EXTERIOR.habZ - Math.abs(z)
      if (dx < dz) x = Math.sign(x || 1) * EXTERIOR.habX
      else z = Math.sign(z || 1) * EXTERIOR.habZ
    }
  }
  for (const e of ESTACIONES) {
    if (e.zona !== zona || e.radio <= 0 || !visibles(e.id)) continue
    const dx = x - e.x
    const dz = z - e.z
    const d = Math.hypot(dx, dz)
    const minimo = e.radio + 0.35
    if (d < minimo && d > 0.0001) {
      x = e.x + (dx / d) * minimo
      z = e.z + (dz / d) * minimo
    }
  }
  return [x, z]
}

/** ¿Existe ya esa estación en el mundo? (Los equipos de superficie aparecen al desplegarlos.) */
export function estacionVisible(sala: RoomState, id: string): boolean {
  const hechas = sala.ensamblaje.hechas
  switch (id) {
    case 'plantaExt':
      return Boolean(hechas.paneles) || Boolean(hechas.carga)
    case 'isruExt':
      return sala.sistemas.some((s) => s.id === 'isru' && s.instalado)
    case 'esclusa':
    case 'esclusaExt':
      return true
    default:
      if (id.startsWith('muestra')) return sala.fase === 'base' && !sala.muestreos.includes(id)
      return true
  }
}

/** ¿Puede este jugador hacer algo reservado a esos roles? (Misma regla que el servidor.) */
export function puede(sala: RoomState, yo: Player | null, roles: Role[]): boolean {
  if (!yo?.rol) return false
  return roles.includes(yo.rol) || !roles.some((r) => sala.jugadores.some((j) => j.rol === r && j.conectado))
}

/** Tareas de ensamblaje que le tocan ahora a este jugador. */
export function tareasPendientes(sala: RoomState, yo: Player | null) {
  if (sala.fase !== 'ensamblaje') return []
  return TAREAS_ENSAMBLAJE.filter((t) => t.paso === sala.ensamblaje.paso && !sala.ensamblaje.hechas[t.id] && puede(sala, yo, t.roles))
}

/** Estaciones que conviene señalar al jugador según lo que le toca hacer. */
export function estacionesDestacadas(sala: RoomState, yo: Player | null): string[] {
  if (!yo) return []
  const ids = new Set<string>()
  for (const t of tareasPendientes(sala, yo)) ids.add(t.estacion)
  if (sala.fase === 'llegada' && sala.subfase === 'orbita' && puede(sala, yo, ['piloto', 'comandante'])) ids.add('puente')
  if (sala.fase === 'base') {
    if (puede(sala, yo, ['cientifico'])) {
      if (yo.muestras > 0) ids.add('laboratorio')
      if (sala.mision.muestrasAnalizadas + yo.muestras < sala.mision.muestrasObjetivo) {
        for (const e of ESTACIONES) if (e.id.startsWith('muestra') && !sala.muestreos.includes(e.id)) ids.add(e.id)
      }
    }
    if (sala.energia.polvo > 0.1) ids.add('campoSolar')
  }
  // Pasos de procedimiento que le tocan: el montaje del huerto y su cuidado (regar, ralear, cosechar...).
  for (const a of activos(sala)) {
    const paso = a.proc.pasos[a.paso]
    if (!a.proc.tarea && puede(sala, yo, paso.roles)) ids.add(paso.estacion)
  }
  if (puede(sala, yo, ['sistemas'])) {
    for (const e of ESTACIONES) {
      if (e.sistemas?.some((id) => sala.sistemas.some((s) => s.id === id && s.instalado && s.integridad < 50))) ids.add(e.id)
    }
    if (sala.sistemas.some((s) => s.id === 'energia' && s.integridad < 50) && sala.tAterrizaje === 0) ids.add('energia')
  }
  if (puede(sala, yo, ['medico']) && sala.jugadores.some((j) => j.rol && (j.dolencia || j.vit.salud < 60))) ids.add('enfermeria')
  return [...ids]
}
