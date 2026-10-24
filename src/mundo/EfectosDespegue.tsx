// Efectos visuales del despegue: nubes de vapor y humo que salen del canal de llamas y del agua
// del sistema de supresión de sonido, el resplandor naranja de la plataforma y el cono de
// condensación cerca de la máxima presión dinámica. Son efectos de diseño: los momentos salen de
// la cronología real de Artemis I (shared/ascenso.ts), las formas y cantidades no son medidas.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ASCENSO, empujeRS25, empujeSRB } from '@shared/ascenso'
import { useGraficos } from '../graficos'
import { texturaSuave } from './SLS'

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Fuego que llega a la plataforma: casi todo es de los propulsores y se va al subir el cohete. */
export const fuegoEnPlataforma = (t: number) => Math.max(empujeSRB(t), 0.4 * empujeRS25(t)) * (1 - THREE.MathUtils.smoothstep(t, 3, 14))

/** Textura de nube: varios grumos suaves, para que cada bocanada no sea un disco perfecto. */
function texturaNube() {
  const n = 128
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  for (let i = 0; i < 18; i++) {
    const a = hash(i) * Math.PI * 2
    const d = Math.sqrt(hash(i + 50)) * n * 0.24
    const x = n / 2 + Math.cos(a) * d
    const y = n / 2 + Math.sin(a) * d
    const r = n * (0.14 + 0.14 * hash(i + 99))
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, 'rgba(255,255,255,0.55)')
    gr.addColorStop(0.6, 'rgba(255,255,255,0.22)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, n, n)
  }
  const t = new THREE.CanvasTexture(c)
  return t
}

/**
 * Bocanadas como cuadrados de frente a la cámara, todas en una sola llamada de dibujo. Se iluminan
 * como esferas: por el Sol y, desde abajo, por la llama.
 */
function materialNubes(mapa: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMapa: { value: mapa },
      uSol: { value: new THREE.Vector3(0, 1, 0) },
      uDia: { value: new THREE.Color('#e8e6e2') },
      uSombra: { value: new THREE.Color('#6f7178') },
      uFuego: { value: new THREE.Color('#ff7a26') },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aPuff;
      attribute vec4 aDatos;
      varying vec2 vUv;
      varying vec2 vQ;
      varying vec4 vD;
      void main() {
        vec4 mv = modelViewMatrix * vec4(aPuff.xyz, 1.0);
        float escala = length(modelViewMatrix[0].xyz);
        float a = aDatos.z * 6.2831 + aDatos.w * 1.2;
        vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy;
        mv.xy += q * aPuff.w * escala;
        vUv = position.xy + 0.5;
        vQ = position.xy * 2.0;
        vD = aDatos;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMapa;
      uniform vec3 uSol;
      uniform vec3 uDia;
      uniform vec3 uSombra;
      uniform vec3 uFuego;
      varying vec2 vUv;
      varying vec2 vQ;
      varying vec4 vD;
      void main() {
        float r2 = dot(vQ, vQ);
        if (r2 > 1.0) discard;
        float forma = texture2D(uMapa, vUv).a * (1.0 - r2);
        vec3 n = vec3(vQ, sqrt(max(0.0, 1.0 - r2)));
        float sol = clamp(dot(n, uSol) * 0.6 + 0.45, 0.0, 1.0);
        vec3 col = mix(uSombra, uDia, sol);
        col += uFuego * vD.y * (0.55 + 0.6 * clamp(-n.y, 0.0, 1.0));
        float a = clamp(vD.x * forma * 2.2, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  })
}

const tmpSol = new THREE.Vector3()

/**
 * Nubes del despegue, en metros y con el origen en la cubierta del lanzador (dentro del grupo de
 * la plataforma). Casi todo el chorro sale por el canal de llamas hacia el norte (-Z); el agua del
 * sistema de supresión de sonido se vuelve vapor y se abre alrededor de la base.
 */
export function NubesDespegue({ tiempo, noche, sol, sueloY }: { tiempo: () => number; noche: number; sol: () => THREE.Vector3; sueloY: number }) {
  const ligera = useGraficos((s) => s.calidad) === 'ligera'
  const N = ligera ? 56 : 150
  const mapa = useMemo(texturaNube, [])
  const mat = useMemo(() => materialNubes(mapa), [mapa])
  const geo = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = base.index
    g.setAttribute('position', base.getAttribute('position'))
    const puff = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage)
    const datos = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aPuff', puff)
    g.setAttribute('aDatos', datos)
    g.instanceCount = N
    return g
  }, [N])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(
    () => () => {
      mat.dispose()
      mapa.dispose()
    },
    [mat, mapa],
  )
  const malla = useRef<THREE.Mesh>(null)

  useFrame(({ camera }) => {
    const t = tiempo()
    const t0 = ASCENSO.arranqueRS25
    const m = malla.current
    if (!m) return
    // Nada antes de los motores ni cuando las nubes ya se deshicieron.
    m.visible = t > t0 && t < 75
    if (!m.visible) return
    const u = mat.uniforms
    u.uSol.value.copy(tmpSol.copy(sol()).transformDirection(camera.matrixWorldInverse))
    // De día, vapor blanco; de noche, gris oscuro que solo se ve donde lo alumbra la llama.
    u.uDia.value.setRGB(0.93 - 0.68 * noche, 0.92 - 0.67 * noche, 0.9 - 0.62 * noche)
    u.uSombra.value.setRGB(0.5 - 0.38 * noche, 0.51 - 0.38 * noche, 0.55 - 0.38 * noche)
    const fuegoAhora = fuegoEnPlataforma(t)
    const pa = geo.getAttribute('aPuff') as THREE.InstancedBufferAttribute
    const da = geo.getAttribute('aDatos') as THREE.InstancedBufferAttribute
    for (let i = 0; i < N; i++) {
      const canal = i % 5 < 3
      const vida = canal ? 16 + 10 * hash(i + 3) : 11 + 7 * hash(i + 7)
      const x = t - t0 + hash(i + 11) * vida
      const ciclo = Math.floor(x / vida)
      const edad = x - ciclo * vida
      const nacio = t - edad
      // Fuerza del chorro cuando nació la bocanada: el arranque de los RS-25 hace poco; los
      // propulsores, muchísimo.
      const e = nacio < t0 ? 0 : Math.max(empujeSRB(nacio), 0.3 * empujeRS25(nacio)) * (1 - THREE.MathUtils.smoothstep(nacio, 8, 20))
      if (e < 0.02) {
        da.setXYZW(i, 0, 0, 0, 0)
        pa.setXYZW(i, 0, -1e4, 0, 0)
        continue
      }
      const sem = i * 7.31 + ciclo * 13.7
      let px: number, pz: number, py: number, tam: number, lejos: number
      if (canal) {
        const a = -Math.PI / 2 + (hash(sem) - 0.5) * 1.1
        const v = (45 + 45 * hash(sem + 1)) * e
        const d = 38 + v * 3.2 * (1 - Math.exp(-edad / 3.2)) + 2 * edad
        lejos = d
        px = Math.cos(a) * d
        pz = Math.sin(a) * d
        py = sueloY + 5 + (2 + 2.5 * hash(sem + 2)) * edad * (0.4 + e) + 8 * hash(sem + 3)
        tam = (12 + 13 * Math.pow(edad, 0.7)) * (0.55 + 0.45 * e) * (0.8 + 0.4 * hash(sem + 4))
      } else {
        const a = hash(sem) * Math.PI * 2
        const v = (16 + 16 * hash(sem + 1)) * Math.max(0.35, e)
        const d = 20 + v * 2.5 * (1 - Math.exp(-edad / 2.5))
        lejos = d
        px = Math.cos(a) * d
        pz = Math.sin(a) * d
        py = sueloY + 3 + 2.4 * edad + 4 * hash(sem + 3)
        tam = (9 + 9 * Math.pow(edad, 0.7)) * (0.8 + 0.4 * hash(sem + 4))
      }
      const alfa = 0.55 * Math.min(1, e * 1.4) * THREE.MathUtils.smoothstep(edad, 0, 0.8) * (1 - THREE.MathUtils.smoothstep(edad, vida * 0.5, vida))
      const brillo = fuegoAhora * Math.exp(-lejos / 110) * (canal ? 1.4 : 0.9)
      pa.setXYZW(i, px, py, pz, tam)
      da.setXYZW(i, alfa, brillo, hash(sem + 5), edad / vida)
    }
    pa.needsUpdate = true
    da.needsUpdate = true
  })

  return <mesh ref={malla} geometry={geo} material={mat} frustumCulled={false} renderOrder={2} visible={false} />
}

/**
 * Resplandor de la llama en la plataforma: una luz naranja junto al canal de llamas y un brillo
 * en el suelo alrededor, mientras el fuego está cerca.
 */
export function ResplandorPlataforma({ tiempo, sueloY }: { tiempo: () => number; sueloY: number }) {
  const luz = useRef<THREE.PointLight>(null)
  const disco = useRef<THREE.Mesh>(null)
  const textura = useMemo(() => texturaSuave('255,140,60'), [])
  useEffect(() => () => textura.dispose(), [textura])
  useFrame(({ clock }) => {
    const f = fuegoEnPlataforma(tiempo()) * (0.88 + 0.12 * Math.sin(clock.elapsedTime * 37) * Math.sin(clock.elapsedTime * 13))
    if (luz.current) luz.current.intensity = 1400 * f
    if (disco.current) {
      disco.current.visible = f > 0.01
      ;(disco.current.material as THREE.MeshBasicMaterial).opacity = Math.min(1, 0.9 * f)
    }
  })
  return (
    <group>
      <pointLight ref={luz} position={[0, sueloY + 10, -28]} color="#ff8a3a" intensity={0} distance={0} decay={2} />
      <mesh ref={disco} rotation={[-Math.PI / 2, 0, 0]} position={[0, sueloY + 0.6, -30]} visible={false}>
        <circleGeometry args={[160, 32]} />
        <meshBasicMaterial map={textura} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </mesh>
    </group>
  )
}

/**
 * Nube de condensación: cerca de la velocidad del sonido, la caída de presión en los hombros del
 * cohete condensa la humedad del aire en conos blancos. Aparece antes de Mach 1 y se va pasada la
 * máxima presión dinámica (momentos reales de Artemis I; la forma es de diseño).
 */
export function materialConoVapor() {
  return new THREE.ShaderMaterial({
    uniforms: {
      // Cono unitario: el tamaño de cada uno lo da la escala de su malla.
      uR0: { value: 1 },
      uR1: { value: 2.3 },
      uLargo: { value: 1 },
      uOpacidad: { value: 0 },
      uTiempo: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uR0;
      uniform float uR1;
      uniform float uLargo;
      varying float vS;
      varying float vA;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float s = clamp(-position.y, 0.0, 1.0);
        float r = mix(uR0, uR1, pow(s, 0.6));
        vec3 p = vec3(position.x * r, -s * uLargo, position.z * r);
        vS = s;
        vA = atan(position.z, position.x);
        vN = normalize(normalMatrix * vec3(normal.x, 0.0, normal.z));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacidad;
      uniform float uTiempo;
      varying float vS;
      varying float vA;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float borde = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float estrias = 0.7 + 0.3 * sin(vA * 11.0 + uTiempo * 9.0) * sin(vS * 23.0 - uTiempo * 17.0);
        float a = uOpacidad * (0.3 + 0.7 * borde) * smoothstep(0.0, 0.12, vS) * pow(1.0 - vS, 1.3) * estrias;
        gl_FragColor = vec4(vec3(0.95, 0.96, 0.98), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

/** Opacidad del cono de condensación según el tiempo de vuelo. */
export const vaporTransonico = (t: number) => THREE.MathUtils.smoothstep(t, ASCENSO.supersonico - 9, ASCENSO.supersonico - 3) * (1 - THREE.MathUtils.smoothstep(t, ASCENSO.maxQ, ASCENSO.maxQ + 9))
