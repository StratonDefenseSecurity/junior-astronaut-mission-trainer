// Giros de la esfera celeste: sirven para que una dirección real del cielo (por ejemplo, hacia
// Marte) quede justo frente a la ventana de la nave.
import * as THREE from 'three'

const a1 = new THREE.Vector3()
const a2 = new THREE.Vector3()
const a3 = new THREE.Vector3()
const b1 = new THREE.Vector3()
const b2 = new THREE.Vector3()
const b3 = new THREE.Vector3()
const ma = new THREE.Matrix4()
const mb = new THREE.Matrix4()

/**
 * Rotación que lleva la dirección real `direccionEscena` (coordenadas de escena de marco.ts) a la
 * dirección local `haciaLocal` (por ejemplo, la normal de la ventana). Sin `arriba*`, usa el giro
 * más corto (el giro alrededor de esa dirección queda libre). Con `arribaEscena` y `arribaLocal`
 * fija también ese giro: lo que en el cielo apunta a `arribaEscena` (p. ej. el norte celeste,
 * +Y) queda lo más cerca posible de `arribaLocal`.
 */
export function orientacionHacia(
  direccionEscena: THREE.Vector3,
  haciaLocal: THREE.Vector3,
  arribaEscena?: THREE.Vector3,
  arribaLocal?: THREE.Vector3,
  salida = new THREE.Quaternion(),
): THREE.Quaternion {
  a1.copy(direccionEscena).normalize()
  b1.copy(haciaLocal).normalize()
  if (!arribaEscena || !arribaLocal) return salida.setFromUnitVectors(a1, b1)
  // Bases ortonormales (dirección, arriba, lado) en ambos marcos; R = B · Aᵀ.
  if (!base(a1, arribaEscena, a2, a3) || !base(b1, arribaLocal, b2, b3)) return salida.setFromUnitVectors(a1, b1)
  ma.makeBasis(a1, a2, a3)
  mb.makeBasis(b1, b2, b3)
  return salida.setFromRotationMatrix(mb.multiply(ma.transpose()))
}

function base(d: THREE.Vector3, arriba: THREE.Vector3, u: THREE.Vector3, l: THREE.Vector3): boolean {
  u.copy(arriba).addScaledVector(d, -arriba.dot(d))
  if (u.lengthSq() < 1e-10) return false
  u.normalize()
  l.crossVectors(d, u)
  return true
}
