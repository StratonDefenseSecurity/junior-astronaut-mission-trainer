// Orientación del cielo para quien está en la superficie de Marte.
//
// La fecha real fija dónde están los planetas y las estrellas, pero la hora del día del juego
// (amanecer, mediodía, noche) la marca el sol de la misión. Para que ambas cosas coincidan, se
// gira Marte lo que haga falta (como mucho medio sol) hasta que la hora solar local del sitio sea
// la del juego. En menos de un día los planetas apenas se mueven entre las estrellas.
import * as THREE from 'three'
import { C } from '@shared/ciencia'
import { cuerposVisibles, orientacionSuperficie, vectorHelio } from './cielo/astro'

const sol = new THREE.Vector3()
const eje = new THREE.Vector3()
const meridiano = new THREE.Vector3()
const ESTE = new THREE.Vector3(1, 0, 0)

/** Hora solar local (0 a 24) en el sitio para esa fecha real. */
function horaSolar(fecha: Date, lat: number, lon: number): number {
  const q = orientacionSuperficie('Marte', fecha, lat, lon)
  sol.copy(cuerposVisibles(fecha, vectorHelio('Marte', fecha)).Sol.direccion).applyQuaternion(q)
  // Eje de giro de Marte en el marco local (+Y cenit, -Z norte, +X este).
  const f = THREE.MathUtils.degToRad(lat)
  eje.set(0, Math.sin(f), -Math.cos(f))
  sol.addScaledVector(eje, -sol.dot(eje))
  meridiano.set(0, 1, 0).addScaledVector(eje, -eje.y).normalize()
  // Ángulo horario: positivo por la tarde, con el Sol hacia el oeste.
  const h = Math.atan2(-sol.dot(ESTE), sol.dot(meridiano))
  return (((12 + (h * 24) / (2 * Math.PI)) % 24) + 24) % 24
}

/** Orientación del cielo en el sitio para la fecha real, ajustada a la hora del juego. */
export function orientacionCieloMarte(fecha: Date, lat: number, lon: number, horaJuego: number): THREE.Quaternion {
  const real = horaSolar(fecha, lat, lon)
  let diferencia = horaJuego - real
  diferencia = ((diferencia + 36) % 24) - 12
  const ajustada = new Date(fecha.getTime() + (diferencia / 24) * C.SOL_S * 1000)
  return orientacionSuperficie('Marte', ajustada, lat, lon)
}

export const SITIOS_MARTE: Record<string, { lat: number; lon: number }> = {
  gale: { lat: -5.44, lon: 137.7 },
  jezero: { lat: 18.41, lon: 77.69 },
  utopia: { lat: 44, lon: 80 },
}
