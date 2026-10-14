// Marco de referencia común para todo lo astronómico de las escenas 3D.
//
// Las posiciones reales (Sol, planetas, Luna, estrellas, la nave) se calculan en el sistema
// ecuatorial J2000 (EQJ), el que usa la librería astronomy-engine y el catálogo de estrellas:
//   +X apunta al punto vernal, +Z al polo norte celeste, +Y completa el sistema.
// three.js usa Y hacia arriba, así que se pasa de EQJ a la escena con:
//   escena.x = eqj.x,  escena.y = eqj.z,  escena.z = -eqj.y
// Así el polo norte celeste queda "arriba" y el giro de la Tierra es alrededor del eje Y.
import * as THREE from 'three'

/** Unidad astronómica en km (IAU 2012). */
export const UA_KM = 149_597_870.7

/** Pasa un vector EQJ a coordenadas de escena. */
export function eqjAEscena(x: number, y: number, z: number, salida = new THREE.Vector3()): THREE.Vector3 {
  return salida.set(x, z, -y)
}

/** Dirección unitaria en la escena a partir de ascensión recta y declinación (grados). */
export function radecAEscena(raGrados: number, decGrados: number, salida = new THREE.Vector3()): THREE.Vector3 {
  const ra = THREE.MathUtils.degToRad(raGrados)
  const dec = THREE.MathUtils.degToRad(decGrados)
  const c = Math.cos(dec)
  return eqjAEscena(c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec), salida)
}
