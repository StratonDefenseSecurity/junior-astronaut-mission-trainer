// El suelo de Marte alrededor de la base y su cielo: regolito con granos y guijarros, rocas de
// varios tipos (basalto anguloso, ventifactos tallados por el viento y cantos redondeados), un
// campo de ripples de arena, el borde de un cráter a lo lejos, rodadas de rover, huellas de
// botas y cables tendidos por el suelo. Todo es geometría y texturas hechas con código.
//
// Colores del cielo (decisión visual, inspirada en las fotos de los rovers): de día, color
// caramelo por el polvo suspendido; al atardecer, un halo azulado alrededor del Sol, como en la
// imagen del Curiosity en el cráter Gale (NASA/JPL-Caltech/MSSS, PIA19400).
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGraficos } from '../graficos'
import { ESTACIONES } from './mapa'
import { azar, empolvar, texturaHuella, texturaRodada, texturasRegolito } from './procedural'

/** Altura del terreno en un punto del mundo (la misma fórmula con la que se levanta la malla). */
export function alturaTerreno(x: number, z: number) {
  const y = -z
  const d = Math.sqrt(x * x + y * y)
  const relieve = Math.min(1, Math.max(0, (d - 50) / 40))
  const h = (Math.sin(x * 0.045) * Math.cos(y * 0.05) * 7 + Math.sin(x * 0.13 + y * 0.09) * 1.8 + Math.cos(y * 0.21) * 0.8) * relieve
  return h + Math.sin(x * 0.6) * Math.cos(y * 0.5) * 0.04
}

/** Campo de ripples: centro y medidas (m). */
const RIPPLES = { x: -8, z: 33, ancho: 22, largo: 13 }
const enRipples = (x: number, z: number, margen = 0) => Math.abs(x - RIPPLES.x) < RIPPLES.ancho / 2 + margen && Math.abs(z - RIPPLES.z) < RIPPLES.largo / 2 + margen

export function Terreno({ color }: { color: THREE.Color }) {
  const alta = useGraficos((s) => s.calidad) === 'alta'
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(420, 420, 110, 110)
    const pos = g.attributes.position as THREE.BufferAttribute
    const colores = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      pos.setZ(i, alturaTerreno(x, -y))
      // manchas grandes: arena basáltica oscura y polvo claro
      const m = Math.sin(x * 0.031 + 1.3) * Math.cos(y * 0.027) + Math.sin(x * 0.083 - y * 0.061) * 0.5
      const v = 0.92 + m * 0.1
      colores[i * 3] = v * 1.02
      colores[i * 3 + 1] = v
      colores[i * 3 + 2] = v * 0.97
    }
    g.setAttribute('color', new THREE.BufferAttribute(colores, 3))
    g.computeVertexNormals()
    return g
  }, [])
  const mat = useMemo(() => {
    const { color: map, normal } = texturasRegolito(alta)
    const m = new THREE.MeshStandardMaterial({ map, normalMap: normal, roughness: 1, metalness: 0, vertexColors: true })
    m.normalScale.set(0.7, 0.7)
    map.repeat.set(70, 70)
    normal.repeat.set(70, 70)
    return m
  }, [alta])
  // La textura es casi gris: se multiplica por el tono del suelo según la hora.
  useLayoutEffect(() => {
    mat.color.copy(color).multiplyScalar(1.6)
  }, [mat, color])
  return <mesh geometry={geo} material={mat} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
}

/** Geometría de roca: un poliedro con los vértices movidos, de caras planas. */
function roca(base: THREE.BufferGeometry, semilla: number, irregular: number) {
  const r = azar(semilla)
  base.deleteAttribute('normal')
  base.deleteAttribute('uv')
  const g = mergeVertices(base)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const f = 1 + (r() - 0.5) * irregular
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * (f * 0.9), p.getZ(i) * f)
  }
  const plana = g.toNonIndexed()
  plana.computeVertexNormals()
  return plana
}

interface Roca {
  x: number
  z: number
  e: number
  g: number
}

/**
 * Rocas: basalto oscuro anguloso, ventifactos alargados y orientados con el viento dominante,
 * cantos redondeados y, en calidad alta, guijarros. Cerca del hábitat proyectan sombra.
 */
export function Rocas() {
  const alta = useGraficos((s) => s.calidad) === 'alta'
  const datos = useMemo(() => {
    const r = azar(7)
    const tipos: { cerca: Roca[]; lejos: Roca[] }[] = [0, 1, 2].map(() => ({ cerca: [], lejos: [] }))
    let n = 0
    while (n < 150) {
      const a = r() * Math.PI * 2
      const d = 6 + r() * 120
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      // Ni encima del hábitat, ni pegadas a una estación, ni en el campo de ripples.
      if (Math.abs(x) < 12 && Math.abs(z) < 6) continue
      if (ESTACIONES.some((e) => e.zona === 'exterior' && Math.hypot(e.x - x, e.z - z) < 3.5)) continue
      if (enRipples(x, z, 1)) continue
      const e = d < 46 ? 0.12 + r() * r() * 0.5 : 0.4 + r() * 2.2
      const tipo = r() < 0.45 ? 0 : r() < 0.55 ? 1 : 2
      ;(d < 46 ? tipos[tipo].cerca : tipos[tipo].lejos).push({ x, z, e, g: r() * 6.28 })
      n++
    }
    const guijarros: Roca[] = []
    while (guijarros.length < 450) {
      const a = r() * Math.PI * 2
      const d = 4 + r() * 44
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (Math.abs(x) < 10.5 && Math.abs(z) < 4.5) continue
      if (enRipples(x, z)) continue
      guijarros.push({ x, z, e: 0.025 + r() * r() * 0.08, g: r() * 6.28 })
    }
    return { tipos, guijarros }
  }, [])
  const piezas = useMemo(
    () => [
      // basalto: oscuro, anguloso y algo aplastado
      { geo: roca(new THREE.IcosahedronGeometry(0.7, 0), 3, 0.55), mat: empolvar(new THREE.MeshStandardMaterial({ color: '#3b2c27', roughness: 0.92, flatShading: true }), 0.55) },
      // ventifacto: alargado, con aristas afiladas y todos alineados con el viento
      { geo: roca(new THREE.OctahedronGeometry(0.7, 0), 9, 0.35), mat: empolvar(new THREE.MeshStandardMaterial({ color: '#6b5142', roughness: 0.8, flatShading: true }), 0.45) },
      // canto redondeado del color del suelo
      { geo: roca(new THREE.DodecahedronGeometry(0.7, 1), 15, 0.25), mat: empolvar(new THREE.MeshStandardMaterial({ color: '#7a3d25', roughness: 1 }), 0.4) },
    ],
    [],
  )
  const matrices = useMemo(() => {
    const ESCALAS: [number, number, number][] = [[1.15, 0.7, 1], [1.7, 0.75, 0.8], [1, 0.8, 1]]
    const matriz = (r: Roca, escala: [number, number, number], viento: boolean, hundir = 0.25) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(r.x, alturaTerreno(r.x, r.z) + r.e * escala[1] * hundir, r.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(viento ? 0.05 : r.g * 0.3, viento ? 0.35 + Math.sin(r.g) * 0.15 : r.g, viento ? 0.04 : r.g * 0.2)),
        new THREE.Vector3(r.e * escala[0], r.e * escala[1], r.e * escala[2]),
      )
    return {
      tipos: datos.tipos.map((t, k) => ({ cerca: t.cerca.map((r) => matriz(r, ESCALAS[k], k === 1)), lejos: t.lejos.map((r) => matriz(r, ESCALAS[k], k === 1)) })),
      guijarros: datos.guijarros.map((r) => matriz(r, [1, 0.7, 1], false, 0.1)),
    }
  }, [datos])
  return (
    <group>
      {piezas.map((p, k) => (
        <group key={k}>
          <Instancias geo={p.geo} mat={p.mat} m={matrices.tipos[k].cerca} sombra={alta} />
          <Instancias geo={p.geo} mat={p.mat} m={matrices.tipos[k].lejos} />
        </group>
      ))}
      {alta && <Instancias geo={piezas[0].geo} mat={piezas[1].mat} m={matrices.guijarros} />}
    </group>
  )
}

/** Muchas copias de una pieza en una sola llamada de dibujo. */
export function Instancias({ geo, mat, m, sombra = false }: { geo: THREE.BufferGeometry; mat: THREE.Material; m: THREE.Matrix4[]; sombra?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    m.forEach((x, i) => im.setMatrixAt(i, x))
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [m])
  return <instancedMesh key={m.length} ref={ref} args={[geo, mat, m.length]} castShadow={sombra} receiveShadow />
}

/** Campo de ripples de arena oscura: crestas perpendiculares al viento, con polvo claro en ellas. */
export function CampoRipples({ color }: { color: THREE.Color }) {
  const alta = useGraficos((s) => s.calidad) === 'alta'
  const geo = useMemo(() => {
    const { ancho, largo } = RIPPLES
    const g = new THREE.PlaneGeometry(ancho, largo, alta ? 220 : 110, alta ? 52 : 26)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    const col = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i)
      const lz = p.getZ(i)
      const x = lx + RIPPLES.x
      const z = lz + RIPPLES.z
      // borde suave para fundirse con el llano
      const bx = Math.min(1, (ancho / 2 - Math.abs(lx)) / 3)
      const bz = Math.min(1, (largo / 2 - Math.abs(lz)) / 2.5)
      const borde = Math.max(0, Math.min(bx, bz))
      const suave = borde * borde * (3 - 2 * borde)
      // perfil asimétrico: ladera suave a barlovento y más empinada a sotavento
      const fase = (x + Math.sin(z * 0.45) * 0.6 + Math.sin(z * 1.3) * 0.12) / 0.95
      const f = fase - Math.floor(fase)
      const perfil = f < 0.72 ? f / 0.72 : (1 - f) / 0.28
      const h = (perfil * 0.09 + 0.05) * suave
      p.setY(i, alturaTerreno(x, z) + h + 0.015)
      const v = 0.62 + perfil * 0.32 * suave + (1 - suave) * 0.3
      col[i * 3] = v * 1.02
      col[i * 3 + 1] = v * 0.95
      col[i * 3 + 2] = v * 0.92
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [alta])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [])
  useLayoutEffect(() => {
    mat.color.copy(color).multiplyScalar(0.95)
  }, [mat, color])
  return <mesh geometry={geo} material={mat} position={[RIPPLES.x, 0, RIPPLES.z]} receiveShadow />
}

/** Borde de un cráter a lo lejos, al norte: una cresta baja que asoma sobre el horizonte. */
export function BordeCrater({ color }: { color: THREE.Color }) {
  const geo = useMemo(() => {
    const r = azar(33)
    const pasos = 160
    const a0 = Math.PI * 1.08
    const a1 = Math.PI * 1.95
    const filas = [
      { radio: 340, alto: -12, sombra: 0.94 },
      { radio: 318, alto: 0.55, sombra: 1.0 },
      { radio: 300, alto: 1, sombra: 1.06 },
      { radio: 285, alto: 0.7, sombra: 0.9 },
    ]
    const picos = Array.from({ length: pasos + 1 }, (_, i) => {
      const t = i / pasos
      const extremos = Math.sin(t * Math.PI)
      return (16 + Math.sin(t * 17) * 4 + Math.sin(t * 41 + 1) * 2 + r() * 1.5) * Math.pow(extremos, 0.6)
    })
    const pos: number[] = []
    const col: number[] = []
    for (let i = 0; i <= pasos; i++) {
      const a = a0 + (a1 - a0) * (i / pasos)
      for (const f of filas) {
        const y = f.alto < 0 ? f.alto : picos[i] * f.alto - 4
        pos.push(Math.cos(a) * f.radio, y, Math.sin(a) * f.radio)
        col.push(f.sombra, f.sombra, f.sombra)
      }
    }
    const idx: number[] = []
    for (let i = 0; i < pasos; i++)
      for (let j = 0; j < filas.length - 1; j++) {
        const a = i * filas.length + j
        const b = a + filas.length
        idx.push(a, b, a + 1, a + 1, b, b + 1)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    return g
  }, [])
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={color} vertexColors fog={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

const VERT_CIELO = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAG_CIELO = /* glsl */ `
uniform vec3 uSol;
uniform vec3 uZenit;
uniform vec3 uHorizonte;
uniform vec3 uHalo;
uniform float uFuerza;
uniform float uAncho;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(uHorizonte, uZenit, pow(clamp(h, 0.0, 1.0), 0.55));
  float cs = max(dot(d, normalize(uSol)), 0.0);
  c = mix(c, uHalo, clamp(pow(cs, uAncho) * uFuerza, 0.0, 1.0));
  c += uHalo * pow(cs, 400.0) * uFuerza * 0.5;
  c = mix(c, uHorizonte, smoothstep(0.02, -0.05, h));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export interface ColoresCielo {
  zenit: THREE.Color
  horizonte: THREE.Color
  halo: THREE.Color
  fuerza: number
  ancho: number
}

/**
 * Colores del cielo según la altura del Sol (seno de la elevación, −1…1) y el polvo (0…1).
 * Día: caramelo; ocaso: halo azul junto al Sol y el resto pardo; noche: casi negro.
 */
export function coloresCielo(elevacion: number, polvo: number): ColoresCielo {
  const dia = THREE.MathUtils.smoothstep(elevacion, -0.1, 0.35)
  const ocaso = Math.max(0, 1 - Math.abs(elevacion + 0.02) / 0.28)
  const zenit = new THREE.Color('#05050b').lerp(new THREE.Color('#a4744c'), dia).lerp(new THREE.Color('#2b2731'), ocaso * 0.55)
  const horizonte = new THREE.Color('#0b0a12').lerp(new THREE.Color('#d6a674'), dia).lerp(new THREE.Color('#6c5141'), ocaso * 0.45)
  const halo = new THREE.Color('#f3e2c8').lerp(new THREE.Color('#87aade'), ocaso)
  const tormenta = new THREE.Color('#6e3b22').multiplyScalar(0.25 + 0.75 * dia)
  zenit.lerp(tormenta, polvo * 0.85)
  horizonte.lerp(tormenta, polvo * 0.85)
  return { zenit, horizonte, halo, fuerza: (elevacion > -0.18 ? 0.55 + ocaso * 0.6 : 0) * (1 - polvo * 0.7), ancho: 5 + ocaso * 12 }
}

/** Cúpula del cielo centrada en la cámara; se dibuja antes que las estrellas. */
export function CupulaCielo({ colores, sol }: { colores: ColoresCielo; sol: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT_CIELO,
        fragmentShader: FRAG_CIELO,
        uniforms: {
          uSol: { value: new THREE.Vector3() },
          uZenit: { value: new THREE.Color() },
          uHorizonte: { value: new THREE.Color() },
          uHalo: { value: new THREE.Color() },
          uFuerza: { value: 0 },
          uAncho: { value: 6 },
        },
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  )
  useLayoutEffect(() => {
    const u = mat.uniforms
    ;(u.uSol.value as THREE.Vector3).set(sol[0], sol[1], sol[2]).normalize()
    ;(u.uZenit.value as THREE.Color).copy(colores.zenit)
    ;(u.uHorizonte.value as THREE.Color).copy(colores.horizonte)
    ;(u.uHalo.value as THREE.Color).copy(colores.halo)
    u.uFuerza.value = colores.fuerza
    u.uAncho.value = colores.ancho
  }, [mat, colores, sol])
  useFrame(({ camera }) => ref.current?.position.copy(camera.position))
  return (
    <mesh ref={ref} material={mat} renderOrder={-2000} frustumCulled={false}>
      <sphereGeometry args={[1500, 32, 16]} />
    </mesh>
  )
}

/** Puntos de un recorrido por el suelo, cada `paso` metros, a la altura del terreno. */
function recorrer(puntos: [number, number][], paso: number) {
  const curva = new THREE.CatmullRomCurve3(puntos.map(([x, z]) => new THREE.Vector3(x, 0, z)))
  const n = Math.max(2, Math.ceil(curva.getLength() / paso))
  return curva.getSpacedPoints(n)
}

/** Rodadas de un rover: dos franjas paralelas con las garras de las ruedas marcadas. */
export function Rodadas() {
  const geo = useMemo(() => {
    const rutas: [number, number][][] = [
      [[12.6, 1.6], [15, 4.5], [14.8, 8.4], [15.5, 13.5], [20, 16], [27, 9], [31, 2], [40, -6], [62, -16], [90, -20]],
      [[12.6, -1.6], [19, -3.8], [28, -1.5], [34, 7], [30, 19], [18, 25], [6, 41], [-4, 62], [-10, 95]],
    ]
    const piezas: THREE.BufferGeometry[] = []
    for (const ruta of rutas) {
      const pts = recorrer(ruta, 0.5)
      for (const lado of [-1.1, 1.1]) {
        const pos: number[] = []
        const uv: number[] = []
        const idx: number[] = []
        let v = 0
        pts.forEach((p, i) => {
          const sig = pts[Math.min(pts.length - 1, i + 1)]
          const ant = pts[Math.max(0, i - 1)]
          const tx = sig.x - ant.x
          const tz = sig.z - ant.z
          const l = Math.hypot(tx, tz) || 1
          const nx = -tz / l
          const nz = tx / l
          if (i > 0) v += p.distanceTo(pts[i - 1]) / 0.5
          for (const [k, o] of [[0, -0.21], [1, 0.21]] as const) {
            const x = p.x + nx * (lado + o)
            const z = p.z + nz * (lado + o)
            pos.push(x, alturaTerreno(x, z) + 0.02, z)
            uv.push(k, v)
          }
          if (i > 0) {
            const a = (i - 1) * 2
            idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
          }
        })
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
        g.setIndex(idx)
        piezas.push(g)
      }
    }
    const g = mergeGeometries(piezas)
    g.computeVertexNormals()
    return g
  }, [])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texturaRodada(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    [],
  )
  return <mesh geometry={geo} material={mat} receiveShadow renderOrder={1} />
}

/** Huellas de botas de los paseos ya hechos: de la esclusa a la planta, la carga y la antena. */
export function Huellas() {
  const datos = useMemo(() => {
    const r = azar(51)
    const rutas: [number, number][][] = [
      [[11.6, 0.3], [13, -3], [14.2, -5.9]],
      [[11.6, -0.3], [14, 3], [16.2, 7.6]],
      [[11.2, -1.2], [10.2, -4.6], [2, -5.3], [-8, -5.6], [-11.6, -6.1]],
      [[16.6, 8], [21, 6.5], [24.4, 5.3]],
    ]
    const m: THREE.Matrix4[] = []
    for (const ruta of rutas)
      for (const desvio of [-0.35, 0.35]) {
        const pts = recorrer(ruta, 0.72)
        pts.forEach((p, i) => {
          const sig = pts[Math.min(pts.length - 1, i + 1)]
          const ant = pts[Math.max(0, i - 1)]
          const rumbo = Math.atan2(sig.x - ant.x, sig.z - ant.z)
          const lado = i % 2 ? 1 : -1
          const nx = Math.cos(rumbo)
          const nz = -Math.sin(rumbo)
          const x = p.x + nx * (lado * 0.14 + desvio) + (r() - 0.5) * 0.05
          const z = p.z + nz * (lado * 0.14 + desvio) + (r() - 0.5) * 0.05
          if (r() < 0.12) return // algunas borradas por el viento
          m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, alturaTerreno(x, z) + 0.022, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rumbo + (r() - 0.5) * 0.2), new THREE.Vector3(1, 1, 1)))
        })
      }
    return m
  }, [])
  const geo = useMemo(() => new THREE.PlaneGeometry(0.14, 0.32).rotateX(-Math.PI / 2), [])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texturaHuella(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    [],
  )
  return <Instancias geo={geo} mat={mat} m={datos} />
}

/** Cable tendido por el suelo a lo largo de un recorrido. */
export function cableSuelo(ruta: [number, number][], radio = 0.035) {
  const pts = recorrer(ruta, 0.8).map((p) => p.setY(alturaTerreno(p.x, p.z) + radio * 0.8))
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, radio, 6, false)
}
