// El SLS Block 1 con Orion y la plataforma 39B con el lanzador móvil, hechos con figuras simples
// pero con las medidas reales. Las separaciones siguen los momentos de Artemis I (shared/ascenso.ts).
//
// Medidas (NASA):
//  - SLS Block 1: 322 ft (98.1 m) de alto. Etapa central: más de 212 ft (64.6 m) y 27.6 ft (8.4 m)
//    de diámetro, cuatro RS-25. Propulsores de cinco segmentos: 177 ft (53.9 m) y 12 ft (3.66 m).
//    Hoja de datos del SLS, FS-2023-05-119-MSFC.
//  - Adaptador de la etapa (LVSA): 27.5 ft (8.4 m) de alto, de 27.5 ft a 16.5 ft (5 m) de diámetro.
//  - ICPS: unos 45 ft (13.7 m) y 16.7 ft (5.1 m). Adaptador de Orion (OSA): 5 ft (1.5 m) y 18 ft.
//  - Torre de escape (LAS): 50 ft (15.2 m) con la ojiva y 44 ft sin ella; la torre mide 3 ft
//    (0.9 m) de diámetro y se abre a 17 ft (5.2 m) en la base. Cápsula: 16.5 ft (5 m).
//  - Lanzador móvil 1: base de dos pisos de 25 x 165 x 135 ft sobre seis soportes de 22 ft (la
//    cubierta queda a 47 ft, 14.3 m), torre de 40 ft de lado y unos 345 ft de alto, hueco de llamas
//    de 34 x 64 ft. Hoja de datos del Mobile Launcher 1 (2021).
//  - Pararrayos de 39B: tres torres (la 1 al noroeste y la 2 al noreste) que sostienen cables con
//    nueve bajadas a tierra (Mata et al., ICLP 2010, NTRS 20100036324); miden unos 600 ft, 181 m
//    (Spectrum News, 28 ago 2022).
// Lo que no publica NASA (la altura de la ICPS que asoma, la del carenado del módulo de servicio,
// la posición de los brazos y de los pararrayos) se ajusta para que el total dé los 322 ft.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ASCENSO, altitudAscenso, distanciaAscenso, empujeRS25, empujeSRB, trayectoriaAscenso } from '@shared/ascenso'

/** Unidades de la escena por metro: el cohete de 98 m mide 24.5 unidades. */
export const U = 0.25
/** Altura de la cubierta del lanzador móvil sobre el suelo (47 ft). */
export const CUBIERTA_M = 14.3

// Alturas sobre la cubierta (m). El pie de los propulsores apoya en la cubierta.
const CENTRAL_BASE = 2.5
const CENTRAL_TOPE = CENTRAL_BASE + 64.6
const LVSA_TOPE = CENTRAL_TOPE + 8.4
const ICPS_TOPE = LVSA_TOPE + 1.5
const OSA_TOPE = ICPS_TOPE + 1.5
const ORION_BASE = 82.9
const TOPE = 98.1
const R_CENTRAL = 4.2
const R_SRB = 1.83
const X_SRB = R_CENTRAL + R_SRB + 0.6
const LARGO_SRB = 53.9
const R_ICPS = 2.55
const R_ORION = 2.6
/** Centro de masa aproximado de cada propulsor, para que giren al soltarse. */
const CM_SRB = 27

/**
 * Presión del aire relativa a la del suelo, con una atmósfera exponencial de 7.5 km de escala.
 * El chorro sale a una presión fija: cuanto menos aire lo aprieta, más se abre.
 */
const presion = (km: number) => Math.exp(-km / 7.5)
const apertura = (km: number, tope: number) => Math.min(tope, 1 / Math.sqrt(presion(km)))

// ---------------------------------------------------------------------------- chorros

/** Cilindro unitario abierto, de y = 0 (tobera) a y = -1 (punta). El sombreador le da la forma. */
const GEO_CHORRO = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 24, 12, true)
  g.translate(0, -0.5, 0)
  return g
})()

/**
 * Chorro de un motor: brillo aditivo más fuerte en el eje, que se apaga hacia la punta, con
 * discos de choque cerca de la tobera si `uDiamantes` > 0.
 */
const VERTICE_CHORRO = /* glsl */ `
  uniform float uR0;
  uniform float uR1;
  uniform float uLargo;
  varying float vS;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float s = clamp(-position.y, 0.0, 1.0);
    float r = mix(uR0, uR1, sqrt(s));
    vec3 p = vec3(position.x * r, -s * uLargo, position.z * r);
    vS = s;
    vN = normalize(normalMatrix * vec3(normal.x, 0.0, normal.z));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`

/**
 * Columna de humo de los propulsores: no suma luz como la llama, la tapa. Más densa en el eje y
 * hacia el cohete, y se deshace en los bordes y hacia abajo.
 */
function materialHumo() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uR0: { value: 6 },
      uR1: { value: 30 },
      uLargo: { value: 400 },
      uOpacidad: { value: 0 },
      uColor: { value: new THREE.Color('#d8d4cc') },
    },
    vertexShader: VERTICE_CHORRO,
    fragmentShader: /* glsl */ `
      uniform float uOpacidad;
      uniform vec3 uColor;
      varying float vS;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float centro = pow(abs(dot(normalize(vN), normalize(vV))), 0.9);
        float a = uOpacidad * centro * pow(1.0 - vS, 0.6) * smoothstep(0.0, 0.04, vS);
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

function materialChorro(nucleo: string, borde: string) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFuerza: { value: 0 },
      uTiempo: { value: 0 },
      uR0: { value: 1 },
      uR1: { value: 2 },
      uLargo: { value: 10 },
      uDiamantes: { value: 0 },
      uNucleo: { value: new THREE.Color(nucleo) },
      uBorde: { value: new THREE.Color(borde) },
    },
    vertexShader: VERTICE_CHORRO,
    fragmentShader: /* glsl */ `
      uniform float uFuerza;
      uniform float uTiempo;
      uniform float uDiamantes;
      uniform vec3 uNucleo;
      uniform vec3 uBorde;
      varying float vS;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float centro = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
        float largo = pow(1.0 - vS, 1.8);
        float parpadeo = 0.86 + 0.14 * sin(uTiempo * 47.0 + vS * 31.0) * sin(uTiempo * 23.0 - vS * 13.0);
        float diamantes = uDiamantes * pow(0.5 + 0.5 * cos(vS * 62.0), 6.0) * exp(-vS * 7.0) * centro;
        vec3 col = mix(uBorde, uNucleo, clamp(centro * (1.15 - vS), 0.0, 1.0));
        float a = uFuerza * (largo * (0.15 + centro) * parpadeo + diamantes);
        gl_FragColor = vec4(col * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

function ajustarChorro(m: THREE.ShaderMaterial, fuerza: number, r0: number, r1: number, largo: number, diamantes: number, reloj: number) {
  const u = m.uniforms
  u.uFuerza.value = fuerza
  u.uR0.value = r0
  u.uR1.value = r1
  u.uLargo.value = largo
  u.uDiamantes.value = diamantes
  u.uTiempo.value = reloj
}

/** Textura redonda y suave (humo, vapor, destellos). */
export function texturaSuave(color = '255,255,255') {
  const n = 64
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  r.addColorStop(0, `rgba(${color},1)`)
  r.addColorStop(0.45, `rgba(${color},0.55)`)
  r.addColorStop(1, `rgba(${color},0)`)
  g.fillStyle = r
  g.fillRect(0, 0, n, n)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ---------------------------------------------------------------------------- materiales

function useMateriales() {
  const m = useMemo(
    () => ({
      // Espuma aislante de la etapa central: naranja tostado y mate.
      naranja: new THREE.MeshStandardMaterial({ color: '#c7682a', roughness: 0.88 }),
      naranjaOscuro: new THREE.MeshStandardMaterial({ color: '#a9561f', roughness: 0.9 }),
      blanco: new THREE.MeshStandardMaterial({ color: '#eceef0', roughness: 0.55 }),
      gris: new THREE.MeshStandardMaterial({ color: '#b9bec5', roughness: 0.5, metalness: 0.2 }),
      junta: new THREE.MeshStandardMaterial({ color: '#8e949c', roughness: 0.6 }),
      oscuro: new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.7, metalness: 0.3 }),
      tobera: new THREE.MeshStandardMaterial({ color: '#5c5f66', roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide }),
      capsula: new THREE.MeshStandardMaterial({ color: '#8f959d', roughness: 0.45, metalness: 0.55 }),
      // Módulo de servicio europeo: mantas aislantes plateadas y doradas, y los paneles plegados.
      servicio: new THREE.MeshStandardMaterial({ color: '#d6d0bd', roughness: 0.4, metalness: 0.5 }),
      dorado: new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.35, metalness: 0.7 }),
      panel: new THREE.MeshStandardMaterial({ color: '#1d2a52', roughness: 0.3, metalness: 0.4 }),
      carenado: new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: 0.5, side: THREE.DoubleSide }),
      acero: new THREE.MeshStandardMaterial({ color: '#7d838c', roughness: 0.7, metalness: 0.3 }),
      aceroClaro: new THREE.MeshStandardMaterial({ color: '#a3a8af', roughness: 0.6, metalness: 0.3 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m])
  return m
}
type Materiales = ReturnType<typeof useMateriales>

// ---------------------------------------------------------------------------- partes

/** Un propulsor de cinco segmentos, con el origen en su centro de masa. */
function Propulsor({ m, lado }: { m: Materiales; lado: 1 | -1 }) {
  const seg = 8
  const base = 3.6
  return (
    <group position={[0, -CM_SRB, 0]}>
      {/* tobera, dentro del faldón */}
      <mesh position={[0, 0.1, 0]} material={m.tobera}>
        <cylinderGeometry args={[0.85, 1.9, 2.2, 20, 1, true]} />
      </mesh>
      {/* faldón de popa, más ancho abajo */}
      <mesh position={[0, base / 2 + 0.2, 0]} material={m.blanco}>
        <cylinderGeometry args={[R_SRB, 2.55, base, 24]} />
      </mesh>
      {/* cinco segmentos con sus juntas */}
      <mesh position={[0, base + (5 * seg) / 2, 0]} material={m.blanco}>
        <cylinderGeometry args={[R_SRB, R_SRB, 5 * seg, 24]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[0, base + i * seg, 0]} material={m.junta}>
          <cylinderGeometry args={[R_SRB + 0.05, R_SRB + 0.05, 0.4, 24]} />
        </mesh>
      ))}
      {/* faldón delantero y cono de la nariz */}
      <mesh position={[0, base + 5 * seg + 1.5, 0]} material={m.blanco}>
        <cylinderGeometry args={[R_SRB, R_SRB, 3, 24]} />
      </mesh>
      <mesh position={[0, base + 5 * seg + 3 + (LARGO_SRB - base - 5 * seg - 3) / 2, 0]} material={m.blanco}>
        <cylinderGeometry args={[0.32, R_SRB, LARGO_SRB - base - 5 * seg - 3, 24]} />
      </mesh>
      <mesh position={[0, LARGO_SRB, 0]} material={m.blanco}>
        <sphereGeometry args={[0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* túnel de cables por fuera, del lado opuesto a la etapa central */}
      <mesh position={[lado * (R_SRB + 0.12), base + (5 * seg) / 2, 0]} material={m.junta}>
        <boxGeometry args={[0.25, 5 * seg, 0.55]} />
      </mesh>
    </group>
  )
}

/** Etapa central con sus cuatro RS-25 y el adaptador (LVSA), que se van juntos al separarse. */
function EtapaCentral({ m }: { m: Materiales }) {
  const largoH2 = 33.5
  return (
    <group>
      {/* sección de motores: escudo térmico abajo y los cuatro RS-25 */}
      <mesh position={[0, CENTRAL_BASE + 3.25, 0]} material={m.naranja}>
        <cylinderGeometry args={[R_CENTRAL, R_CENTRAL - 0.15, 6.5, 32]} />
      </mesh>
      <mesh position={[0, CENTRAL_BASE + 0.05, 0]} material={m.oscuro}>
        <cylinderGeometry args={[R_CENTRAL - 0.15, R_CENTRAL - 0.15, 0.1, 32]} />
      </mesh>
      {[
        [1.6, 1.6],
        [-1.6, 1.6],
        [1.6, -1.6],
        [-1.6, -1.6],
      ].map(([x, z], i) => (
        <group key={i} position={[x, CENTRAL_BASE, z]}>
          <mesh position={[0, -1.55, 0]} material={m.tobera}>
            <cylinderGeometry args={[0.42, 1.15, 3.1, 20, 1, true]} />
          </mesh>
          <mesh position={[0, -0.05, 0]} material={m.blanco}>
            <cylinderGeometry args={[0.55, 0.5, 0.5, 14]} />
          </mesh>
        </group>
      ))}
      {/* tanque de hidrógeno, entre tanques, tanque de oxígeno y faldón delantero */}
      <mesh position={[0, CENTRAL_BASE + 6.5 + largoH2 / 2, 0]} material={m.naranja}>
        <cylinderGeometry args={[R_CENTRAL, R_CENTRAL, largoH2, 32]} />
      </mesh>
      <mesh position={[0, CENTRAL_BASE + 6.5 + largoH2 + 3.45, 0]} material={m.naranjaOscuro}>
        <cylinderGeometry args={[R_CENTRAL + 0.04, R_CENTRAL + 0.04, 6.9, 32]} />
      </mesh>
      <mesh position={[0, (CENTRAL_BASE + 6.5 + largoH2 + 6.9 + CENTRAL_TOPE) / 2, 0]} material={m.naranja}>
        <cylinderGeometry args={[R_CENTRAL, R_CENTRAL, CENTRAL_TOPE - (CENTRAL_BASE + 6.5 + largoH2 + 6.9), 32]} />
      </mesh>
      {/* conducto de oxígeno que baja por fuera del tanque de hidrógeno */}
      <mesh position={[0, CENTRAL_BASE + 6.5 + largoH2 / 2 + 1, R_CENTRAL + 0.3]} material={m.naranjaOscuro}>
        <cylinderGeometry args={[0.32, 0.32, largoH2 + 2, 10]} />
      </mesh>
      {/* adaptador cónico de la etapa superior */}
      <mesh position={[0, CENTRAL_TOPE + 4.2, 0]} material={m.blanco}>
        <cylinderGeometry args={[R_ICPS - 0.05, R_CENTRAL, 8.4, 32, 1, true]} />
      </mesh>
    </group>
  )
}

/** Etapa superior (ICPS): tanque de hidrógeno de 5 m, tanque de oxígeno debajo y el motor RL10. */
function ICPS({ m }: { m: Materiales }) {
  return (
    <group>
      <mesh position={[0, (71.6 + ICPS_TOPE) / 2, 0]} material={m.blanco}>
        <cylinderGeometry args={[R_ICPS, R_ICPS, ICPS_TOPE - 71.6, 28]} />
      </mesh>
      <mesh position={[0, 70.4, 0]} scale={[1, 0.75, 1]} material={m.gris}>
        <sphereGeometry args={[1.7, 20, 12]} />
      </mesh>
      <mesh position={[0, 67.9, 0]} material={m.tobera}>
        <cylinderGeometry args={[0.25, 0.95, 2.6, 16, 1, true]} />
      </mesh>
      {/* adaptador de Orion */}
      <mesh position={[0, ICPS_TOPE + 0.75, 0]} material={m.gris}>
        <cylinderGeometry args={[2.7, 2.7, 1.5, 28]} />
      </mesh>
    </group>
  )
}

/** Orion: módulo de servicio con los paneles plegados y la cápsula. */
function Orion({ m }: { m: Materiales }) {
  return (
    <group>
      <mesh position={[0, OSA_TOPE + 0.6, 0]} material={m.gris}>
        <cylinderGeometry args={[2.05, 2.55, 1.2, 24]} />
      </mesh>
      <mesh position={[0, (OSA_TOPE + 1.2 + ORION_BASE) / 2, 0]} material={m.servicio}>
        <cylinderGeometry args={[2.05, 2.05, ORION_BASE - OSA_TOPE - 1.2, 24]} />
      </mesh>
      <mesh position={[0, ORION_BASE - 0.4, 0]} material={m.dorado}>
        <cylinderGeometry args={[2.08, 2.08, 0.5, 24]} />
      </mesh>
      {/* cuatro alas solares plegadas contra el módulo; se abren a los 18 min, ya en órbita */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4
        return (
          <mesh key={i} position={[Math.cos(a) * 2.12, (OSA_TOPE + 1.2 + ORION_BASE) / 2, Math.sin(a) * 2.12]} rotation={[0, -a, 0]} material={m.panel}>
            <boxGeometry args={[0.08, 2.4, 1.3]} />
          </mesh>
        )
      })}
      {/* cápsula de 5 m */}
      <mesh position={[0, ORION_BASE + 1.65, 0]} material={m.capsula}>
        <cylinderGeometry args={[1.05, 2.5, 3.3, 28]} />
      </mesh>
      <mesh position={[0, ORION_BASE + 3.45, 0]} material={m.oscuro}>
        <cylinderGeometry args={[0.6, 0.75, 0.3, 16]} />
      </mesh>
    </group>
  )
}

/** Un tercio del carenado del módulo de servicio, con la bisagra abajo. */
function PanelCarenado({ m, i }: { m: Materiales; i: number }) {
  const alto = ORION_BASE - OSA_TOPE
  return (
    <mesh position={[0, alto / 2, 0]} material={m.carenado}>
      <cylinderGeometry args={[R_ORION, R_ORION + 0.1, alto, 16, 1, true, (i * 2 * Math.PI) / 3, (2 * Math.PI) / 3]} />
    </mesh>
  )
}

/** Perfil de la ojiva de la torre de escape: cubre la cápsula y se estrecha hasta la torre. */
const GEO_OJIVA = (() => {
  const puntos: THREE.Vector2[] = []
  for (let i = 0; i <= 12; i++) {
    const s = i / 12
    puntos.push(new THREE.Vector2(R_ORION - (R_ORION - 0.55) * Math.pow(s, 1.25), s * 5.2))
  }
  return new THREE.LatheGeometry(puntos, 28)
})()

/** Torre de escape: ojiva, motor de escape con sus toberas, motor de control y motor de separación. */
function TorreEscape({ m, chorro }: { m: Materiales; chorro: THREE.ShaderMaterial }) {
  const r = 0.46
  return (
    <group>
      <mesh geometry={GEO_OJIVA} material={m.blanco} />
      <mesh position={[0, 5.2 + 3, 0]} material={m.blanco}>
        <cylinderGeometry args={[r, r, 6, 16]} />
      </mesh>
      {/* cuatro toberas del motor de escape, inclinadas hacia afuera (en Artemis I no se encendió) */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.55, 5.6, Math.sin(a) * 0.55]} rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]} material={m.oscuro}>
            <cylinderGeometry args={[0.12, 0.3, 0.6, 10, 1, true]} />
          </mesh>
        )
      })}
      {/* motor de control de actitud y motor de separación, con sus toberas */}
      <mesh position={[0, 11.6, 0]} material={m.gris}>
        <cylinderGeometry args={[r + 0.08, r + 0.08, 0.9, 16]} />
      </mesh>
      <mesh position={[0, 13.0, 0]} material={m.blanco}>
        <cylinderGeometry args={[r, r, 1.9, 16]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4
        return (
          <group key={i} position={[Math.cos(a) * 0.5, 12.3, Math.sin(a) * 0.5]} rotation={[Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]}>
            <mesh material={m.oscuro}>
              <cylinderGeometry args={[0.1, 0.18, 0.35, 8, 1, true]} />
            </mesh>
            <mesh geometry={GEO_CHORRO} material={chorro} position={[0, -0.18, 0]} frustumCulled={false} />
          </group>
        )
      })}
      <mesh position={[0, 13.95 + (TOPE - ORION_BASE - 13.95) / 2, 0]} material={m.blanco}>
        <cylinderGeometry args={[0.06, r, TOPE - ORION_BASE - 13.95, 16]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------- vehículo

/** Destellos de los 16 motores de separación de los propulsores (cuatro en cada extremo). */
function Destellos({ textura, refGrupo }: { textura: THREE.Texture; refGrupo: React.RefObject<THREE.Group> }) {
  return (
    <group ref={refGrupo} visible={false}>
      {[-1, 1].flatMap((lado) =>
        [CM_SRB - 2, -CM_SRB + 3].map((y) => (
          <sprite key={`${lado}${y}`} position={[lado * (R_SRB + 0.8), y, 0]} scale={[7, 7, 1]}>
            <spriteMaterial map={textura} color="#ffd9a0" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        )),
      )}
    </group>
  )
}

/**
 * El cohete completo, en metros, con el origen en la cubierta del lanzador. Separa sus partes en
 * los momentos reales y ajusta los chorros con la altitud.
 */
export function VehiculoSLS({ tiempo, noche = 0 }: { tiempo: () => number; noche?: number }) {
  const m = useMateriales()
  const chorroSRB = useMemo(() => materialChorro('#fff6d6', '#ff8a2a'), [])
  const chorroRS25 = useMemo(() => materialChorro('#dfe6ff', '#6b6cff'), [])
  const envolvente = useMemo(() => materialChorro('#d9e2ff', '#5864d8'), [])
  const chorroTorre = useMemo(() => materialChorro('#fff2cc', '#ff9a40'), [])
  const textura = useMemo(() => texturaSuave('255,236,200'), [])
  useEffect(
    () => () => {
      chorroSRB.dispose()
      chorroRS25.dispose()
      envolvente.dispose()
      chorroTorre.dispose()
      textura.dispose()
    },
    [chorroSRB, chorroRS25, envolvente, chorroTorre, textura],
  )
  const srb = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const central = useRef<THREE.Group>(null)
  const paneles = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const torre = useRef<THREE.Group>(null)
  const destellos = useRef<THREE.Group>(null)
  const luz = useRef<THREE.PointLight>(null)
  const estela = useRef<THREE.Mesh>(null)
  const estelaMat = useMemo(materialHumo, [])
  useEffect(() => () => estelaMat.dispose(), [estelaMat])

  useFrame(({ clock }) => {
    const t = tiempo()
    const reloj = clock.elapsedTime
    const alt = altitudAscenso(Math.max(0, t))
    const srbF = empujeSRB(t)
    const rsF = empujeRS25(t)
    const abre = apertura(alt, 7)

    // Propulsores: chorro brillante de óxido de aluminio que se abre al subir.
    ajustarChorro(chorroSRB, srbF * 1.15, 1.9, 4 + 3.2 * (abre - 1), 75 + 30 * (abre - 1), 0, reloj)
    // RS-25: chorro casi transparente de vapor de agua, con discos de choque cerca del suelo.
    const abreRS = apertura(alt, 9)
    ajustarChorro(chorroRS25, rsF * (0.55 - 0.4 * THREE.MathUtils.smoothstep(alt, 20, 60)), 1.15, 1.5 + 1.6 * (abreRS - 1), 22 + 8 * (abreRS - 1), 1.6 * Math.exp(-alt / 6), reloj)
    // Arriba, los cuatro chorros se funden en uno solo, enorme y tenue.
    const arriba = THREE.MathUtils.smoothstep(alt, 25, 90)
    ajustarChorro(envolvente, rsF * 0.2 * arriba, 3.4, 6 + 4.5 * abreRS, 50 + 30 * abreRS, 0, reloj)
    // El motor de separación de la torre se enciende al soltarla.
    const tt = t - ASCENSO.torreEscape
    ajustarChorro(chorroTorre, tt > 0 && tt < 2.5 ? 2.2 * (1 - tt / 2.5) : 0, 0.18, 1.2, 9, 0, reloj)
    if (luz.current) luz.current.intensity = 2600 * srbF + (t < 0 ? 140 : 260) * rsF
    if (estela.current) {
      // Humo de los propulsores: denso en el aire bajo, desaparece al subir.
      const u = estelaMat.uniforms
      u.uOpacidad.value = 0.75 * srbF * (1 - THREE.MathUtils.smoothstep(alt, 6, 35)) * THREE.MathUtils.smoothstep(t, 1, 5)
      estela.current.visible = u.uOpacidad.value > 0.01
      // Cerca del suelo la columna llega hasta la plataforma; arriba queda una estela de ~1 km.
      u.uLargo.value = THREE.MathUtils.clamp(alt * 1000 + 40, 300, 1200)
      u.uR0.value = 5
      u.uR1.value = 26 + 12 * Math.min(4, alt)
      // De día, blanco grisáceo; de noche, gris oscuro con el brillo naranja de la llama abajo.
      u.uColor.value.setRGB(0.85 - 0.55 * noche + 0.25 * noche * srbF, 0.83 - 0.58 * noche + 0.12 * noche * srbF, 0.8 - 0.6 * noche)
    }

    // Separación de los propulsores: los motores de separación los empujan hacia afuera y se
    // quedan atrás mientras giran con la nariz hacia afuera. El alejamiento es más lento que el
    // real para que se vea a la escala de tiempo del juego.
    const ts = t - ASCENSO.separacionSRB
    srb.forEach((r, i) => {
      const g = r.current
      if (!g) return
      const lado = i === 0 ? 1 : -1
      if (ts <= 0) {
        g.position.set(lado * X_SRB, CM_SRB, 0)
        g.rotation.set(0, 0, 0)
        g.visible = true
        return
      }
      const empujon = Math.min(ts, 1)
      const lateral = 1.5 * empujon * empujon + 3 * Math.max(0, ts - 1)
      g.position.set(lado * (X_SRB + lateral), CM_SRB - 1.2 * ts * ts, 0)
      g.rotation.set(0, 0, -lado * Math.min(1.3, 0.05 * ts + 0.004 * ts * ts))
      g.visible = ts < 40
    })
    if (destellos.current) {
      destellos.current.visible = ts > 0 && ts < 1.4
      destellos.current.position.set(0, CM_SRB - 1.2 * Math.max(0, ts) ** 2, 0)
      destellos.current.children.forEach((c) => {
        const lado = c.position.x > 0 ? 1 : -1
        c.position.x = lado * (X_SRB + R_SRB + 1 + 1.5 * Math.min(1, Math.max(0, ts)) ** 2)
        ;((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - ts / 1.4)
      })
    }

    // Carenado del módulo de servicio: tres paneles que se abren como pétalos y se alejan.
    const tc = t - ASCENSO.carenado
    paneles.forEach((r, i) => {
      const g = r.current
      if (!g) return
      const a = (i * 2 * Math.PI) / 3 + Math.PI / 3
      const dx = Math.sin(a)
      const dz = Math.cos(a)
      if (tc <= 0) {
        g.position.set(0, OSA_TOPE, 0)
        g.rotation.set(0, 0, 0)
        g.visible = true
        return
      }
      const abrir = Math.min(1.9, 0.9 * tc * tc)
      const lejos = Math.max(0, tc - 1)
      g.position.set(dx * (R_ORION * Math.sin(abrir) * 0.5 + 2.5 * lejos * lejos), OSA_TOPE - 0.6 * tc * tc, dz * (R_ORION * Math.sin(abrir) * 0.5 + 2.5 * lejos * lejos))
      // Gira alrededor del eje tangente, por la bisagra de abajo.
      g.quaternion.setFromAxisAngle(tmpEje.set(dz, 0, -dx), abrir)
      g.visible = tc < 18
    })

    // Torre de escape: su motor la saca hacia adelante y hacia un lado.
    if (torre.current) {
      const g = torre.current
      if (tt <= 0) {
        g.position.set(0, ORION_BASE, 0)
        g.rotation.set(0, 0, 0)
        g.visible = true
      } else {
        g.position.set(0.9 * tt * tt * 0.2, ORION_BASE + 6 * tt * tt, 0)
        g.rotation.set(0, 0, -Math.min(0.5, 0.04 * tt * tt))
        g.visible = tt < 14
      }
    }

    // Etapa central: tras el corte de motores se suelta y se queda atrás, girando despacio.
    if (central.current) {
      const tsc = t - ASCENSO.separacionCentral
      const g = central.current
      if (tsc <= 0) {
        g.position.set(0, 0, 0)
        g.rotation.set(0, 0, 0)
      } else {
        g.position.set(0.1 * tsc, -0.22 * tsc * tsc, 0)
        g.rotation.set(0.0006 * tsc * tsc, 0, 0.0012 * tsc * tsc)
      }
      g.visible = tsc < 60
    }
  })

  return (
    <group>
      <pointLight ref={luz} position={[0, -8, 0]} color="#ffab5c" intensity={0} distance={0} decay={2} />
      <group ref={central}>
        <EtapaCentral m={m} />
        {[
          [1.6, 1.6],
          [-1.6, 1.6],
          [1.6, -1.6],
          [-1.6, -1.6],
        ].map(([x, z], i) => (
          <mesh key={i} geometry={GEO_CHORRO} material={chorroRS25} position={[x, CENTRAL_BASE - 3.1, z]} frustumCulled={false} />
        ))}
        <mesh geometry={GEO_CHORRO} material={envolvente} position={[0, CENTRAL_BASE - 3.1, 0]} frustumCulled={false} />
      </group>
      {srb.map((r, i) => (
        <group key={i} ref={r} position={[(i === 0 ? 1 : -1) * X_SRB, CM_SRB, 0]}>
          <Propulsor m={m} lado={i === 0 ? 1 : -1} />
          <mesh geometry={GEO_CHORRO} material={chorroSRB} position={[0, -CM_SRB - 1, 0]} frustumCulled={false} />
        </group>
      ))}
      {/* columna de humo detrás de los propulsores, mientras empujan en el aire denso */}
      <mesh ref={estela} geometry={GEO_CHORRO} material={estelaMat} position={[0, -40, 0]} visible={false} frustumCulled={false} />
      <Destellos textura={textura} refGrupo={destellos} />
      <ICPS m={m} />
      <Orion m={m} />
      {paneles.map((r, i) => (
        <group key={i} ref={r} position={[0, OSA_TOPE, 0]}>
          <PanelCarenado m={m} i={i} />
        </group>
      ))}
      <group ref={torre} position={[0, ORION_BASE, 0]}>
        <TorreEscape m={m} chorro={chorroTorre} />
      </group>
    </group>
  )
}

const tmpEje = new THREE.Vector3()

// ---------------------------------------------------------------------------- plataforma

/** Caja de `ancho x alto x fondo` con su centro en (x, y, z), lista para unir con otras. */
function caja(ancho: number, alto: number, fondo: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(ancho, alto, fondo)
  g.translate(x, y, z)
  return g
}

/** Viga entre dos puntos, de sección `grosor`. */
function viga(a: THREE.Vector3, b: THREE.Vector3, grosor: number) {
  const largo = a.distanceTo(b)
  const g = new THREE.BoxGeometry(grosor, largo, grosor)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  g.applyQuaternion(q)
  const c = a.clone().add(b).multiplyScalar(0.5)
  g.translate(c.x, c.y, c.z)
  return g
}

/** Centro de la torre del lanzador, al norte del cohete (las coordenadas son las de la plataforma). */
const TORRE_Z = -20
const LADO_TORRE = 12.2
const ALTO_TORRE = 105.2

/** Base de dos pisos con el hueco de llamas, los seis soportes y la torre de celosía. */
function geometriaLanzador() {
  const partes: THREE.BufferGeometry[] = []
  const [L, A, F] = [50.3, 7.6, 41.1]
  const cz = -6
  const hx = 19.5 / 2
  const hz = 10.4 / 2
  // Base con el hueco: cuatro bloques alrededor.
  partes.push(caja((L / 2 - hx), A, F, -(hx + (L / 2 - hx) / 2), -A / 2, cz))
  partes.push(caja((L / 2 - hx), A, F, hx + (L / 2 - hx) / 2, -A / 2, cz))
  partes.push(caja(2 * hx, A, cz + F / 2 - hz, 0, -A / 2, (hz + cz + F / 2) / 2))
  partes.push(caja(2 * hx, A, -hz - (cz - F / 2), 0, -A / 2, (-hz + cz - F / 2) / 2))
  // Seis soportes de 22 ft.
  for (const x of [-20, 0, 20]) for (const z of [cz - 16, cz + 16]) partes.push(caja(2.4, CUBIERTA_M - A, 2.4, x, -A - (CUBIERTA_M - A) / 2, z))
  // Torre: cuatro columnas, un piso cada 20 ft (6.1 m) y cruces en cada cara.
  const s = LADO_TORRE / 2
  const esquinas = [
    [-s, -s],
    [s, -s],
    [s, s],
    [-s, s],
  ]
  for (const [x, z] of esquinas) partes.push(caja(1, ALTO_TORRE, 1, x, ALTO_TORRE / 2, TORRE_Z + z))
  const pisos = Math.floor(ALTO_TORRE / 6.1)
  for (let i = 1; i <= pisos; i++) {
    const y = i * 6.1
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = esquinas[k]
      const [x1, z1] = esquinas[(k + 1) % 4]
      partes.push(viga(new THREE.Vector3(x0, y, TORRE_Z + z0), new THREE.Vector3(x1, y, TORRE_Z + z1), 0.5))
      partes.push(viga(new THREE.Vector3(x0, y - 6.1, TORRE_Z + z0), new THREE.Vector3(x1, y, TORRE_Z + z1), 0.3))
    }
  }
  // Grúa y mástil de la cima.
  partes.push(caja(2, 4, 2, 0, ALTO_TORRE + 2, TORRE_Z))
  partes.push(caja(1, 1, 16, 0, ALTO_TORRE + 4, TORRE_Z + 4))
  // Mástiles de servicio de la popa, a los lados de la etapa central.
  partes.push(caja(3, 9, 3, -11.5, 4.5, -4.5))
  partes.push(caja(3, 9, 3, 11.5, 4.5, -4.5))
  const g = mergeGeometries(partes)!
  partes.forEach((p) => p.dispose())
  return g
}

/** Las tres torres pararrayos, con mástil de fibra de vidrio arriba (posiciones aproximadas). */
const PARARRAYOS: Array<[number, number]> = [
  [-150, -95],
  [150, -95],
  [0, 175],
]
const ALTO_PARARRAYOS = 181

function geometriaPararrayos() {
  const partes: THREE.BufferGeometry[] = []
  for (const [x, z] of PARARRAYOS) {
    const g = new THREE.CylinderGeometry(1.3, 3.2, ALTO_PARARRAYOS - 25, 8)
    g.translate(x, -CUBIERTA_M + (ALTO_PARARRAYOS - 25) / 2, z)
    partes.push(g)
  }
  const g = mergeGeometries(partes)!
  partes.forEach((p) => p.dispose())
  return g
}

function geometriaMastiles() {
  const partes: THREE.BufferGeometry[] = []
  for (const [x, z] of PARARRAYOS) {
    const g = new THREE.CylinderGeometry(0.35, 0.8, 25, 8)
    g.translate(x, -CUBIERTA_M + ALTO_PARARRAYOS - 12.5, z)
    partes.push(g)
  }
  const g = mergeGeometries(partes)!
  partes.forEach((p) => p.dispose())
  return g
}

/** Cables entre las cimas de las torres, con su comba, y los que bajan a tierra. */
function geometriaCables() {
  const pts: number[] = []
  const cima = PARARRAYOS.map(([x, z]) => new THREE.Vector3(x, -CUBIERTA_M + ALTO_PARARRAYOS, z))
  const tramo = (a: THREE.Vector3, b: THREE.Vector3, comba: number) => {
    const n = 16
    for (let i = 0; i < n; i++) {
      const p0 = a.clone().lerp(b, i / n)
      const p1 = a.clone().lerp(b, (i + 1) / n)
      p0.y -= comba * 4 * (i / n) * (1 - i / n)
      p1.y -= comba * 4 * ((i + 1) / n) * (1 - (i + 1) / n)
      pts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
    }
  }
  for (let i = 0; i < 3; i++) tramo(cima[i], cima[(i + 1) % 3], 22)
  // Nueve bajadas a tierra, tres por torre, hacia afuera de la plataforma.
  for (const c of cima) {
    const base = Math.atan2(c.z, c.x)
    for (const d of [-0.7, 0, 0.7]) {
      const a = base + d
      tramo(c, new THREE.Vector3(c.x + Math.cos(a) * 110, -CUBIERTA_M, c.z + Math.sin(a) * 110), 6)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return g
}

/**
 * Suelo de la plataforma pintado en un lienzo: el octógono de hormigón, el canal de llamas hacia
 * el norte, el camino de las orugas hacia el edificio de ensamblaje (al sur-suroeste), el monte
 * bajo de la costa y el Atlántico a unos 700 m al este. Se funde con el globo en el borde.
 */
function texturaSuelo() {
  const n = 1024
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  const m = n / 3200 // píxeles por metro (el lienzo cubre 3.2 km)
  const px = (x: number) => n / 2 + x * m
  g.fillStyle = '#4b5a3a'
  g.fillRect(0, 0, n, n)
  // manchas de monte y lagunas
  for (let i = 0; i < 260; i++) {
    const x = Math.sin(i * 12.9898) * 43758.5453
    const y = Math.sin(i * 78.233) * 12543.1234
    g.fillStyle = i % 5 === 0 ? 'rgba(52,70,60,0.6)' : i % 3 === 0 ? 'rgba(98,104,70,0.45)' : 'rgba(60,78,46,0.5)'
    g.beginPath()
    g.arc((x - Math.floor(x)) * n, (y - Math.floor(y)) * n, 6 + (i % 7) * 5, 0, Math.PI * 2)
    g.fill()
  }
  // playa y océano al este
  g.fillStyle = '#d8cfb2'
  g.beginPath()
  g.moveTo(px(640), 0)
  g.bezierCurveTo(px(700), n * 0.3, px(660), n * 0.7, px(720), n)
  g.lineTo(n, n)
  g.lineTo(n, 0)
  g.fill()
  g.fillStyle = '#1d3d5c'
  g.beginPath()
  g.moveTo(px(700), 0)
  g.bezierCurveTo(px(760), n * 0.3, px(720), n * 0.7, px(780), n)
  g.lineTo(n, n)
  g.lineTo(n, 0)
  g.fill()
  // camino de las orugas hacia el sur-suroeste
  g.save()
  g.translate(px(0), px(0))
  g.rotate(Math.atan2(0.866, -0.5) - Math.PI / 2)
  g.fillStyle = '#9a958a'
  g.fillRect(-25 * m, 0, 50 * m, 2000 * m)
  g.restore()
  // anillo de grava, octógono de hormigón y canal de llamas
  const octogono = (r: number, color: string) => {
    g.fillStyle = color
    g.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      g.lineTo(px(Math.cos(a) * r), px(Math.sin(a) * r))
    }
    g.closePath()
    g.fill()
  }
  octogono(190, '#8f8a7e')
  octogono(120, '#b4b2ab')
  g.fillStyle = '#2b2a28'
  g.fillRect(px(-10), px(-170), 20 * m, 170 * m)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Brillo radial del suelo: opaco en el centro y transparente en el borde, para fundirse con el globo. */
function texturaBorde() {
  const n = 256
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  r.addColorStop(0, '#fff')
  r.addColorStop(0.7, '#fff')
  r.addColorStop(1, '#000')
  g.fillStyle = r
  g.fillRect(0, 0, n, n)
  return new THREE.CanvasTexture(c)
}

interface PropsPlataforma {
  tiempo: () => number
  /** 0 de día, 1 de noche: enciende los reflectores. */
  noche: number
}

/** Plataforma 39B y el lanzador móvil, con los brazos umbilicales, chispas y vapor. */
export function PlataformaLC39B({ tiempo, noche }: PropsPlataforma) {
  const m = useMateriales()
  const lanzador = useMemo(geometriaLanzador, [])
  const pararrayos = useMemo(geometriaPararrayos, [])
  const mastiles = useMemo(geometriaMastiles, [])
  const cables = useMemo(geometriaCables, [])
  const suelo = useMemo(texturaSuelo, [])
  const borde = useMemo(texturaBorde, [])
  const vapor = useMemo(() => texturaSuave('235,235,235'), [])
  const chispa = useMemo(() => texturaSuave('255,190,110'), [])
  useEffect(
    () => () => {
      ;[lanzador, pararrayos, mastiles, cables].forEach((g) => g.dispose())
      ;[suelo, borde, vapor, chispa].forEach((t) => t.dispose())
    },
    [lanzador, pararrayos, mastiles, cables, suelo, borde, vapor, chispa],
  )
  const brazos = useRef<THREE.Group>(null)
  const nubes = useRef<THREE.Group>(null)
  const chispas = useRef<THREE.Points>(null)
  const focos = [useRef<THREE.SpotLight>(null), useRef<THREE.SpotLight>(null)]
  const objetivoFocos = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 50, 0)
    return o
  }, [])
  const N_CHISPAS = 90
  const geoChispas = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_CHISPAS * 3), 3))
    return g
  }, [])
  useEffect(() => () => geoChispas.dispose(), [geoChispas])
  // Nubes de vapor: salen sobre todo por el canal de llamas, hacia el norte.
  const semillas = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const norte = i % 3 !== 0
        const a = norte ? -Math.PI / 2 + (((i * 0.618) % 1) - 0.5) * 1.2 : ((i * 0.618) % 1) * Math.PI * 2
        return { a, retraso: (i % 10) * 0.6, lejos: norte ? 1.6 : 0.8, alto: 0.6 + ((i * 0.37) % 1) * 0.8 }
      }),
    [],
  )

  useFrame(() => {
    const t = tiempo()
    // Brazos umbilicales: se sueltan y giran hacia la torre al despegar.
    if (brazos.current) {
      brazos.current.children.forEach((b, i) => {
        if (i === brazos.current!.children.length - 1) return // el brazo de acceso ya está recogido
        b.rotation.y = -Math.min(1.35, Math.max(0, t) * 1.1) * (b.position.x > 0 ? -1 : 1)
      })
    }
    // Chispas de los quemadores de hidrógeno, de T-12 s hasta el despegue.
    if (chispas.current) {
      const activo = t >= ASCENSO.quemadores && t < 0.5
      chispas.current.visible = activo
      if (activo) {
        const p = geoChispas.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < N_CHISPAS; i++) {
          const edad = (t * 1.7 + i * 0.137) % 1
          const a = i * 2.399
          const v = 6 + (i % 7) * 1.5
          p.setXYZ(i, Math.cos(a) * (2 + v * edad), CENTRAL_BASE - 3.5 - 4 * edad * edad, Math.sin(a) * (2 + v * edad))
        }
        p.needsUpdate = true
      }
    }
    // Vapor y humo: empieza con los RS-25 y crece mucho con los propulsores.
    if (nubes.current) {
      nubes.current.children.forEach((c, i) => {
        const s = semillas[i]
        const tr = t - ASCENSO.arranqueRS25 - s.retraso
        const sprite = c as THREE.Sprite
        const mat = sprite.material as THREE.SpriteMaterial
        if (tr <= 0) {
          sprite.visible = false
          return
        }
        sprite.visible = true
        const fuerza = t < 0 ? 0.35 : 1
        const d = (25 + 14 * Math.pow(tr, 0.75) * fuerza) * s.lejos
        sprite.position.set(Math.cos(s.a) * d, -CUBIERTA_M + 6 + Math.pow(tr, 0.7) * 3 * s.alto, Math.sin(s.a) * d)
        const tam = 18 + 9 * Math.pow(tr, 0.8) * fuerza
        sprite.scale.set(tam, tam * 0.8, 1)
        mat.opacity = Math.min(0.85, tr / 2) * (1 - THREE.MathUtils.smoothstep(t, 60, 120))
        // De noche, la llama ilumina el vapor de naranja.
        const brillo = Math.max(empujeSRB(t), 0.3 * empujeRS25(t)) * Math.exp(-d / 160)
        mat.color.setRGB(0.42 + 0.5 * (1 - noche) + 0.6 * brillo, 0.42 + 0.48 * (1 - noche) + 0.35 * brillo, 0.45 + 0.45 * (1 - noche) + 0.1 * brillo)
      })
    }
    focos.forEach((f) => {
      if (f.current) f.current.intensity = noche * 9000
    })
  })

  const brazo = (y: number, largo: number, x: number, ancho = 2.2) => (
    <group key={y} position={[x, y, TORRE_Z + LADO_TORRE / 2]}>
      <mesh position={[-x / 2, 0, largo / 2]} rotation={[0, Math.atan2(-x, largo), 0]} material={m.aceroClaro}>
        <boxGeometry args={[ancho, 1.8, Math.hypot(largo, x)]} />
      </mesh>
    </group>
  )

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -CUBIERTA_M + 0.3, 0]}>
        <circleGeometry args={[1600, 48]} />
        <meshStandardMaterial map={suelo} alphaMap={borde} transparent roughness={0.95} />
      </mesh>
      <mesh geometry={lanzador} material={m.acero} />
      <mesh geometry={pararrayos} material={m.acero} />
      <mesh geometry={mastiles} material={m.blanco} />
      <lineSegments geometry={cables}>
        <lineBasicMaterial color="#3a3f47" transparent opacity={0.7} />
      </lineSegments>
      {/* brazos umbilicales: entre tanques, faldón delantero, ICPS, módulo de servicio y acceso */}
      <group ref={brazos}>
        {brazo(46, 9.7, 2)}
        {brazo(65.5, 9.7, -2)}
        {brazo(75.8, 11.6, 2, 1.6)}
        {brazo(80.6, 11.1, -2, 1.6)}
        <group position={[3, 84.5, TORRE_Z + LADO_TORRE / 2]} rotation={[0, 1.5, 0]}>
          <mesh position={[0, 0, 5]} material={m.aceroClaro}>
            <boxGeometry args={[2.6, 2.6, 10]} />
          </mesh>
        </group>
      </group>
      <points ref={chispas} geometry={geoChispas} visible={false}>
        <pointsMaterial map={chispa} size={1.1} color="#ffc070" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <group ref={nubes}>
        {semillas.map((_, i) => (
          <sprite key={i} visible={false}>
            <spriteMaterial map={vapor} transparent depthWrite={false} opacity={0} />
          </sprite>
        ))}
      </group>
      <primitive object={objetivoFocos} />
      {[-1, 1].map((lado, i) => (
        <spotLight key={lado} ref={focos[i]} position={[lado * 90, -CUBIERTA_M + 4, 110]} target={objetivoFocos} angle={0.42} penumbra={0.6} distance={0} decay={2} color="#e9efff" intensity={0} />
      ))}
    </group>
  )
}

/**
 * Dónde está el cohete respecto de la plataforma (m) y cuánto se ha inclinado hacia el este
 * (rad), `t` segundos después del despegue. El eje +X de la plataforma apunta hacia el rumbo.
 */
export function posicionCohete(t: number) {
  const x = Math.max(0, t)
  return {
    x: distanciaAscenso(x) * 1000,
    y: altitudAscenso(x) * 1000,
    inclinacion: ((90 - trayectoriaAscenso(x)) * Math.PI) / 180,
  }
}
