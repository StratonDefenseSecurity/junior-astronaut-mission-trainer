// Materiales (shaders) de los globos. Se iluminan SOLO con la dirección del Sol (uniform), no
// con las luces de la escena: así el día, la noche y el terminador quedan donde corresponden
// aunque la escena tenga otras luces para la nave.
//
// Todo el sombreado se hace en coordenadas de mundo (normales con mat3(modelMatrix); los
// globos se escalan de forma uniforme).
import * as THREE from 'three'
import { ESCALA_RELIEVE } from './generadores'

export type TipoSuperficie = 'tierra' | 'marte' | 'luna'

/** Ruido de valor 3D en GLSL para el detalle fino cuando la cámara está cerca. */
const RUIDO_GLSL = /* glsl */ `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float ruido3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z) * 2.0 - 1.0;
}
float detalleFino(vec3 p) {
  return ruido3(p * 180.0) * 0.5 + ruido3(p * 410.0) * 0.3 + ruido3(p * 950.0) * 0.2;
}
`

// El vértice calcula la normal y la base local (este, norte) en coordenadas de mundo; el
// fragmento no tiene modelMatrix en three.js.
const VERT_SUPERFICIE = /* glsl */ `
varying vec2 vUv;
varying vec3 vLocal;
varying vec3 vPosMundo;
varying vec3 vNormal;
varying vec3 vEste;
varying vec3 vNorte;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vUv = uv;
  vec3 n = normalize(position);
  vLocal = n;
  // Marco local: +Y = polo norte, así que el este es Y × n.
  vec3 e = vec3(n.z, 0.0, -n.x);
  float le = length(e);
  e = le > 1e-5 ? e / le : vec3(0.0, 0.0, -1.0);
  mat3 m = mat3(modelMatrix);
  vNormal = normalize(m * n);
  vEste = normalize(m * e);
  vNorte = normalize(m * cross(n, e));
  vec4 pm = modelMatrix * vec4(position, 1.0);
  vPosMundo = pm.xyz;
  gl_Position = projectionMatrix * viewMatrix * pm;
  #include <logdepthbuf_vertex>
}
`

const FRAG_SUPERFICIE = /* glsl */ `
uniform sampler2D uMapa;
uniform sampler2D uRelieve;
uniform sampler2D uNubes;
uniform sampler2D uLuces;
uniform sampler2D uAgua;
uniform float uConAgua;
uniform float uBrilloLuces;
uniform float uDeriva;
uniform vec3 uSol;
uniform float uAmbiente;
uniform float uFuerzaRelieve;
uniform float uDetalle;
uniform vec3 uAtm;
uniform float uAtmFuerza;
uniform float uAlturaNubes;
varying vec2 vUv;
varying vec3 vLocal;
varying vec3 vPosMundo;
varying vec3 vNormal;
varying vec3 vEste;
varying vec3 vNorte;
#include <common>
#include <logdepthbuf_pars_fragment>
${RUIDO_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vLocal);
  vec3 Ng = normalize(vNormal);
  vec3 este = normalize(vEste);
  vec3 norte = normalize(vNorte);
  vec3 V = normalize(cameraPosition - vPosMundo);
  vec3 L = normalize(uSol);
  vec4 texel = texture2D(uMapa, vUv);
  vec3 albedo = texel.rgb;

  #ifdef CON_RELIEVE
    // Pendientes guardadas en la textura → normal inclinada (solo afecta la luz).
    vec2 g = (texture2D(uRelieve, vUv).rg * 255.0 - 128.0) / ${ESCALA_RELIEVE.toFixed(1)};
    vec3 Np = normalize(Ng - uFuerzaRelieve * (g.x * este + g.y * norte));
  #else
    vec3 Np = Ng;
  #endif

  #ifdef TIERRA
    // Agua: máscara de Natural Earth con las imágenes reales; alfa del mapa en el procedural.
    float agua = mix(texel.a, texture2D(uAgua, vUv).r, uConAgua);
  #endif

  // Detalle fino procedural solo de cerca (desaparece al alejarse para no parpadear).
  if (uDetalle > 0.001) {
    float d = detalleFino(n);
    #ifdef TIERRA
      albedo *= 1.0 + d * 0.22 * uDetalle * (1.0 - agua);
    #else
      albedo *= 1.0 + d * 0.16 * uDetalle;
    #endif
  }

  float nlg = dot(Ng, L);
  float mu0 = max(dot(Np, L), 0.0);
  #if defined(LUNA)
    // Lommel-Seeliger: el disco lunar lleno se ve parejo, sin oscurecerse hacia el borde.
    float mu = max(dot(Ng, V), 0.02);
    float luz = mix(2.0 * mu0 / (mu0 + mu), mu0, 0.3);
  #elif defined(MARTE)
    float mu = max(dot(Ng, V), 0.02);
    float luz = mix(2.0 * mu0 / (mu0 + mu), mu0, 0.55);
  #else
    float luz = mu0;
  #endif
  // Terminador suave: la luz del Sol no se corta en seco (refracción y dispersión).
  luz *= smoothstep(-0.06, 0.08, nlg);
  vec3 color = albedo * (luz + uAmbiente);

  #ifdef TIERRA
    // Sombras de las nubes: se busca la nube que está entre el punto y el Sol.
    float cz = max(nlg, 0.08);
    float cosLat = sqrt(max(1.0 - n.y * n.y, 0.0025));
    vec2 desplaza = vec2(dot(L, este) / (6.2831853 * cosLat), dot(L, norte) / 3.1415927) * uAlturaNubes / cz;
    float sombra = texture2D(uNubes, vUv + vec2(uDeriva, 0.0) + desplaza).r;
    float nubeEncima = texture2D(uNubes, vUv + vec2(uDeriva, 0.0)).r;
    color *= 1.0 - 0.5 * sombra * smoothstep(0.0, 0.15, nlg);
    // Reflejo del Sol en el océano (más intenso cerca del borde, como el agua real).
    vec3 H = normalize(L + V);
    float nh = max(dot(Ng, H), 0.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
    float brillo = (pow(nh, 160.0) * 1.3 + pow(nh, 18.0) * 0.07) * (0.4 + fresnel);
    color += vec3(1.0, 0.94, 0.82) * brillo * agua * smoothstep(0.0, 0.1, nlg) * (1.0 - 0.8 * sombra);
    // Franja anaranjada del crepúsculo junto al terminador.
    float crep = smoothstep(-0.12, 0.0, nlg) * (1.0 - smoothstep(0.0, 0.18, nlg));
    color += albedo * vec3(0.9, 0.45, 0.2) * crep * 0.25;
    // Luces de las ciudades (Black Marble): solo en el lado de noche, se encienden pasado el
    // terminador y las tapan las nubes. Tono de lámpara de sodio.
    float ciudad = texture2D(uLuces, vUv).r;
    float noche = 1.0 - smoothstep(-0.12, 0.03, nlg);
    color += vec3(1.0, 0.68, 0.36) * (ciudad * ciudad) * uBrilloLuces * noche * (1.0 - 0.8 * nubeEncima);
  #endif

  // Bruma atmosférica: azulada en la Tierra, polvo anaranjado en Marte; más fuerte hacia el borde.
  float rim = pow(1.0 - max(dot(Ng, V), 0.0), 2.6);
  float diaAtm = smoothstep(-0.25, 0.35, nlg);
  color += uAtm * uAtmFuerza * (rim * 0.9 + 0.06) * diaAtm;

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export interface UniformsSuperficie {
  [k: string]: THREE.IUniform
  uMapa: THREE.IUniform<THREE.Texture>
  uRelieve: THREE.IUniform<THREE.Texture>
  uNubes: THREE.IUniform<THREE.Texture>
  uSol: THREE.IUniform<THREE.Vector3>
  uAmbiente: THREE.IUniform<number>
  uFuerzaRelieve: THREE.IUniform<number>
  uDetalle: THREE.IUniform<number>
  uAtm: THREE.IUniform<THREE.Color>
  uAtmFuerza: THREE.IUniform<number>
  uAlturaNubes: THREE.IUniform<number>
  uLuces: THREE.IUniform<THREE.Texture>
  uAgua: THREE.IUniform<THREE.Texture>
  uConAgua: THREE.IUniform<number>
  uBrilloLuces: THREE.IUniform<number>
  uDeriva: THREE.IUniform<number>
}

export function materialSuperficie(
  tipo: TipoSuperficie,
  inicial: { mapa: THREE.Texture; relieve: THREE.Texture; nubes: THREE.Texture; luces: THREE.Texture; agua: THREE.Texture; atm: string; atmFuerza: number },
) {
  const uniforms: UniformsSuperficie = {
    uMapa: { value: inicial.mapa },
    uRelieve: { value: inicial.relieve },
    uNubes: { value: inicial.nubes },
    uSol: { value: new THREE.Vector3(1, 0, 0) },
    uAmbiente: { value: 0.012 },
    uFuerzaRelieve: { value: tipo === 'luna' ? 0.15 : 0.13 },
    uDetalle: { value: 0 },
    uAtm: { value: new THREE.Color(inicial.atm) },
    uAtmFuerza: { value: inicial.atmFuerza },
    uAlturaNubes: { value: 0.006 },
    uLuces: { value: inicial.luces },
    uAgua: { value: inicial.agua },
    uConAgua: { value: 0 },
    uBrilloLuces: { value: 2.6 },
    uDeriva: { value: 0 },
  }
  const defines: Record<string, string> = {}
  if (tipo === 'tierra') defines.TIERRA = ''
  else defines.CON_RELIEVE = ''
  if (tipo === 'marte') defines.MARTE = ''
  if (tipo === 'luna') defines.LUNA = ''
  return new THREE.ShaderMaterial({ uniforms, defines, vertexShader: VERT_SUPERFICIE, fragmentShader: FRAG_SUPERFICIE })
}

// ----------------------------------------------------------------------------------- nubes

const FRAG_NUBES = /* glsl */ `
uniform sampler2D uNubes;
uniform vec3 uSol;
uniform float uAmbiente;
uniform float uDetalle;
uniform float uDeriva;
varying vec2 vUv;
varying vec3 vLocal;
varying vec3 vPosMundo;
varying vec3 vNormal;
#include <common>
#include <logdepthbuf_pars_fragment>
${RUIDO_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  vec3 Ng = normalize(vNormal);
  vec3 L = normalize(uSol);
  vec3 V = normalize(cameraPosition - vPosMundo);
  float a = texture2D(uNubes, vUv + vec2(uDeriva, 0.0)).r;
  if (uDetalle > 0.001) {
    // De cerca, los bordes de las nubes se deshilachan en vez de verse borrosos.
    float d = detalleFino(normalize(vLocal) * 0.7);
    a = clamp(a + d * 0.35 * uDetalle * a * (1.0 - a) * 4.0, 0.0, 1.0);
  }
  float nl = dot(Ng, L);
  float luz = max(nl, 0.0) * smoothstep(-0.08, 0.1, nl);
  // Las nubes se ven algo más densas hacia el borde del disco (se miran de costado).
  float costado = 1.0 + 0.6 * pow(1.0 - max(dot(Ng, V), 0.0), 3.0);
  vec3 color = vec3(1.0) * (luz * 0.98 + uAmbiente);
  float crep = smoothstep(-0.1, 0.02, nl) * (1.0 - smoothstep(0.02, 0.2, nl));
  color = mix(color, vec3(1.0, 0.55, 0.3) * 0.6, crep * 0.6);
  gl_FragColor = vec4(color, clamp(a * costado, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function materialNubes(nubes: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNubes: { value: nubes },
      uSol: { value: new THREE.Vector3(1, 0, 0) },
      uAmbiente: { value: 0.01 },
      uDetalle: { value: 0 },
      uDeriva: { value: 0 },
    },
    vertexShader: VERT_SUPERFICIE,
    fragmentShader: FRAG_NUBES,
    transparent: true,
    depthWrite: false,
    // Empuja la capa hacia la cámara en el búfer de profundidad: evita que se mezcle con la
    // superficie cuando el planeta está lejos y la precisión de profundidad es poca.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
}

// ------------------------------------------------------------------------------ atmósfera

const VERT_ATM = /* glsl */ `
varying vec3 vPosMundo;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vec4 pm = modelMatrix * vec4(position, 1.0);
  vPosMundo = pm.xyz;
  gl_Position = projectionMatrix * viewMatrix * pm;
  #include <logdepthbuf_vertex>
}
`

// Brillo del limbo con un modelo simple de atmósfera exponencial: para cada rayo de la cámara
// se busca su punto más cercano al planeta; la densidad cae como exp(-altura / H). El color
// azul (Rayleigh) pasa a anaranjado donde ese punto está en el crepúsculo.
const FRAG_ATM = /* glsl */ `
uniform vec3 uSol;
uniform vec3 uCentro;
uniform float uRadio;
uniform float uRadioAtm;
uniform float uH;
uniform vec3 uColor;
uniform vec3 uColorOcaso;
uniform float uIntensidad;
uniform float uDelante;
varying vec3 vPosMundo;
#include <common>
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec3 dir = normalize(vPosMundo - cameraPosition);
  vec3 oc = uCentro - cameraPosition;
  float t = max(dot(oc, dir), 0.0);
  vec3 pc = cameraPosition + dir * t;
  float d = length(pc - uCentro);
  float h = max(d - uRadio, 0.0);
  float dens = exp(-h / uH) * (1.0 - smoothstep(0.75, 1.0, h / (uRadioAtm - uRadio)));
  // Rayos que chocan con el planeta: solo cuenta la capa delante del disco (la pone la superficie).
  if (d < uRadio) dens *= uDelante;
  vec3 np = normalize(pc - uCentro);
  float sl = dot(np, normalize(uSol));
  float ilum = smoothstep(-0.28, 0.18, sl);
  float cosT = dot(dir, normalize(uSol));
  float fase = 0.75 * (1.0 + cosT * cosT) + 0.8 * pow(max(cosT, 0.0), 10.0);
  vec3 col = mix(uColorOcaso, uColor, smoothstep(-0.12, 0.3, sl));
  gl_FragColor = vec4(col * dens * ilum * fase * uIntensidad, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export interface UniformsAtmosfera {
  [k: string]: THREE.IUniform
  uSol: THREE.IUniform<THREE.Vector3>
  uCentro: THREE.IUniform<THREE.Vector3>
  uRadio: THREE.IUniform<number>
  uRadioAtm: THREE.IUniform<number>
  uH: THREE.IUniform<number>
  uColor: THREE.IUniform<THREE.Color>
  uColorOcaso: THREE.IUniform<THREE.Color>
  uIntensidad: THREE.IUniform<number>
  uDelante: THREE.IUniform<number>
}

export function materialAtmosfera(color: string, ocaso: string, intensidad: number) {
  const uniforms: UniformsAtmosfera = {
    uSol: { value: new THREE.Vector3(1, 0, 0) },
    uCentro: { value: new THREE.Vector3() },
    uRadio: { value: 1 },
    uRadioAtm: { value: 1.03 },
    uH: { value: 0.005 },
    uColor: { value: new THREE.Color(color) },
    uColorOcaso: { value: new THREE.Color(ocaso) },
    uIntensidad: { value: intensidad },
    uDelante: { value: 0 },
  }
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT_ATM,
    fragmentShader: FRAG_ATM,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

// ------------------------------------------------------------------------------ marcadores

const VERT_PUNTOS = /* glsl */ `
attribute vec3 color;
uniform float uTam;
varying vec3 vColor;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uTam;
  #include <logdepthbuf_vertex>
}
`
const FRAG_PUNTOS = /* glsl */ `
varying vec3 vColor;
#include <common>
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float nucleo = 1.0 - smoothstep(0.18, 0.32, r);
  float halo = pow(1.0 - r, 2.0) * 0.8;
  gl_FragColor = vec4(mix(vColor, vec3(1.0), nucleo * 0.6), max(nucleo, halo));
  #include <colorspace_fragment>
}
`

export function materialMarcadores(tamPx: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uTam: { value: tamPx } },
    vertexShader: VERT_PUNTOS,
    fragmentShader: FRAG_PUNTOS,
    transparent: true,
    depthWrite: false,
  })
}
