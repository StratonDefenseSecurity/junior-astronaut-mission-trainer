// Pruebas del módulo del cielo (src/mundo/cielo). Uso:  npx tsx scripts/probar-cielo.ts
// Comprueba los datos generados, la trayectoria de la nave, las ventanas de lanzamiento, el
// brillo de los planetas y la orientación en superficie, y muestra qué vería la tripulación.
import { Body, Illumination, MakeTime, SearchRelativeLongitude } from 'astronomy-engine'
import * as THREE from 'three'
import { ESTRELLAS, ESTRELLAS_CON_NOMBRE, CONSTELACIONES, N_ESTRELLAS, VIA_LACTEA } from '../src/mundo/cielo/datos'
import {
  CUERPOS,
  DURACION_HOHMANN_DIAS,
  FASE_HOHMANN_GRADOS,
  alturaGrados,
  cuerposVisibles,
  fechasConFase,
  magnitudAparente,
  marcoHorizonte,
  marcoHorizonteIAU,
  orientacionSuperficie,
  posicionNave,
  trayectoria,
  vectorHelio,
  ventanasDeLanzamiento,
  vistoDesde,
  type Cuerpo,
  type Vec3,
} from '../src/mundo/cielo/astro'
import { colorDesdeBV, temperaturaDesdeBV } from '../src/mundo/cielo/color'
import { radecAEscena, UA_KM } from '../src/mundo/cielo/marco'
import { orientacionHacia } from '../src/mundo/cielo/orientacion'

let fallas = 0
function comprobar(ok: boolean, texto: string) {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}`)
  if (!ok) fallas++
}
const dia = (d: Date) => d.toISOString().slice(0, 10)
const GR = 180 / Math.PI

// ------------------------------------------------------------------ datos
console.log('\n== Datos del catálogo')
comprobar(ESTRELLAS.length === N_ESTRELLAS * 4, `${N_ESTRELLAS} estrellas, 4 valores cada una`)
function estrella(nombre: string) {
  const e = ESTRELLAS_CON_NOMBRE.find((x) => x.nombre === nombre)
  if (!e) throw new Error(`no está ${nombre}`)
  const i = e.indice * 4
  return { ra: ESTRELLAS[i] as number, dec: ESTRELLAS[i + 1] as number, mag: ESTRELLAS[i + 2] as number, bv: ESTRELLAS[i + 3] }
}
// Valores de referencia J2000 de SIMBAD (CDS): Betelgeuse 05h55m10.305s +07°24'25.43";
// Sirio 06h45m08.917s -16°42'58.02". Se compara con tolerancia de 0.01°.
const hms = (h: number, m: number, s: number) => (h + m / 60 + s / 3600) * 15
const dms = (g: number, m: number, s: number) => Math.sign(g) * (Math.abs(g) + m / 60 + s / 3600)
for (const [nombre, ra, dec] of [
  ['Betelgeuse', hms(5, 55, 10.305), dms(7, 24, 25.43)],
  ['Sirio', hms(6, 45, 8.917), dms(-16, 42, 58.02)],
] as const) {
  const e = estrella(nombre)
  const d = Math.max(Math.abs(e.ra - ra), Math.abs(e.dec - dec))
  comprobar(d < 0.01, `${nombre}: AR ${e.ra.toFixed(4)}° Dec ${e.dec.toFixed(4)}° mag ${e.mag} B-V ${e.bv} (diferencia con SIMBAD ${(d * 3600).toFixed(1)}")`)
}
{
  // Ida y vuelta por el marco de escena: AR/Dec -> vector -> AR/Dec.
  const e = estrella('Betelgeuse')
  const v = radecAEscena(e.ra, e.dec)
  const ra = ((Math.atan2(-v.z, v.x) * GR) % 360 + 360) % 360
  const dec = Math.asin(v.y) * GR
  comprobar(Math.abs(ra - e.ra) < 1e-9 && Math.abs(dec - e.dec) < 1e-9, `Betelgeuse vuelve igual desde la escena (Y = norte celeste: y=${v.y.toFixed(3)})`)
}
comprobar(CONSTELACIONES.length === 88 && CONSTELACIONES.filter((c) => c.famosa).length === 14, '88 constelaciones, 14 famosas con nombre')
comprobar(VIA_LACTEA.rle.length > 1000, `Vía Láctea ${VIA_LACTEA.ancho}x${VIA_LACTEA.alto}, ${VIA_LACTEA.rle.length} caracteres`)

// ------------------------------------------------------------------ color
console.log('\n== Color de estrellas (B-V -> T -> RGB)')
comprobar(Math.abs(temperaturaDesdeBV(0.65) - 5778) < 30, `Sol (B-V 0.65): ${temperaturaDesdeBV(0.65).toFixed(0)} K`)
for (const n of ['Rigel', 'Sirio', 'Betelgeuse', 'Antares']) {
  const e = estrella(n)
  const c = colorDesdeBV(e.bv)
  console.log(`      ${n.padEnd(11)} B-V ${String(e.bv).padStart(6)}  T ${temperaturaDesdeBV(e.bv as number).toFixed(0).padStart(5)} K  rgb ${c.map((x) => x.toFixed(2)).join(' ')}`)
}
{
  const azul = colorDesdeBV(estrella('Rigel').bv)
  const rojo = colorDesdeBV(estrella('Betelgeuse').bv)
  comprobar(azul[2] >= azul[0] && rojo[0] > rojo[2], 'Rigel sale azulada y Betelgeuse anaranjada')
}

// ------------------------------------------------- oposiciones y ventanas
console.log('\n== Oposiciones de Marte (validan la fase relativa)')
const desde = new Date('2026-01-01T00:00:00Z')
const hasta = new Date('2035-01-01T00:00:00Z')
const oposiciones = fechasConFase(0, desde, hasta)
const conocidas = ['2027-02-19', '2029-03-25', '2031-05-04', '2033-06-27']
conocidas.forEach((f, i) => {
  const o = oposiciones[i]
  const ae = SearchRelativeLongitude(Body.Mars, 0, i === 0 ? desde : new Date(oposiciones[i - 1].getTime() + 30 * 86_400_000)).date
  const dif = o ? Math.abs(o.getTime() - new Date(`${f}T12:00:00Z`).getTime()) / 86_400_000 : 99
  comprobar(dif < 1.5, `oposición ${o ? o.toISOString().slice(0, 16) : '?'} (pública: ${f}; astronomy-engine SearchRelativeLongitude: ${ae.toISOString().slice(0, 16)})`)
})

console.log(`\n== Ventanas de lanzamiento (fase de Hohmann ${FASE_HOHMANN_GRADOS.toFixed(2)}°, viaje Hohmann ${DURACION_HOHMANN_DIAS.toFixed(1)} días)`)
const ventanas = ventanasDeLanzamiento(desde, hasta)
// Periodos conocidos de las ventanas a Marte: fines de 2026, fines de 2028 o inicios de 2029,
// inicios de 2031 y primavera (boreal) de 2033. Como la órbita de Marte es excéntrica, la
// distancia en días a la oposición cambia de una ventana a otra.
const esperadas = [['2026-10', '2026-12'], ['2028-11', '2029-02'], ['2031-01', '2031-03'], ['2033-02', '2033-05']]
ventanas.forEach((v, i) => {
  const op = oposiciones[i]
  const antes = op ? ((op.getTime() - v.getTime()) / 86_400_000).toFixed(0) : '?'
  const mes = dia(v).slice(0, 7)
  const ok = !!esperadas[i] && mes >= esperadas[i][0] && mes <= esperadas[i][1]
  comprobar(ok, `ventana ${v.toISOString().slice(0, 16)} UTC (${antes} días antes de la oposición)`)
})
comprobar(ventanas.length === 4, `${ventanas.length} ventanas entre 2026 y 2034`)

// ------------------------------------------------------------ trayectoria
console.log('\n== Trayectoria de la nave (Lambert)')
const salida = ventanas[0]
const llegada = new Date(salida.getTime() + 210 * 86_400_000)
const t = trayectoria(salida, llegada)
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
comprobar(dist(posicionNave(salida, llegada, 0), vectorHelio('Tierra', salida)) === 0, 'f=0 está en la Tierra')
comprobar(dist(posicionNave(salida, llegada, 1), vectorHelio('Marte', llegada)) === 0, 'f=1 está en Marte')
{
  // La órbita propagada todo el viaje debe caer en Marte (valida Lambert + Kepler).
  const casi = posicionNave(salida, llegada, 0.999999999)
  const err = dist(casi, vectorHelio('Marte', llegada)) * UA_KM
  comprobar(err < 50, `la órbita propagada llega a Marte (error ${err.toFixed(2)} km)`)
}
comprobar(t.vInfSalidaKmS > 2.5 && t.vInfSalidaKmS < 6 && t.vInfLlegadaKmS > 2 && t.vInfLlegadaKmS < 7,
  `salida ${dia(salida)}, llegada ${dia(llegada)}: barre ${t.anguloBarridoGrados.toFixed(1)}°, v∞ salida ${t.vInfSalidaKmS.toFixed(2)} km/s, v∞ llegada ${t.vInfLlegadaKmS.toFixed(2)} km/s`)
{
  let maxR = 0
  for (let f = 0; f <= 1; f += 0.01) maxR = Math.max(maxR, Math.hypot(...Object.values(posicionNave(salida, llegada, f))))
  comprobar(maxR < 1.7, `distancia máxima al Sol ${maxR.toFixed(3)} UA`)
}

// ------------------------------------------------------------------ brillo
console.log('\n== Brillo desde la Tierra: Mallama y Hilton (2018) frente a astronomy-engine')
{
  const f = new Date('2027-02-19T00:00:00Z')
  const tierra = vectorHelio('Tierra', f)
  for (const [c, b] of [['Mercurio', Body.Mercury], ['Venus', Body.Venus], ['Marte', Body.Mars], ['Jupiter', Body.Jupiter], ['Saturno', Body.Saturn], ['Luna', Body.Moon]] as [Cuerpo, Body][]) {
    const m = magnitudAparente(c, f, tierra)
    const ae = Illumination(b, MakeTime(f)).mag
    comprobar(Math.abs(m - ae) < 0.3, `${c.padEnd(8)} ${m.toFixed(2)} (astronomy-engine ${ae.toFixed(2)})`)
  }
  comprobar(Math.abs(magnitudAparente('Sol', f, tierra) + 26.74) < 0.05, `Sol desde la Tierra ${magnitudAparente('Sol', f, tierra).toFixed(2)}`)
}

// --------------------------------------------------------- superficie
console.log('\n== Orientación en superficie')
{
  // El modelo IAU aplicado a la Tierra debe coincidir con la rotación completa de astronomy-engine.
  const f = new Date('2026-10-14T03:00:00Z')
  const a = marcoHorizonte('Tierra', f, -6.77, -79.84) // Chiclayo
  const b = marcoHorizonteIAU('Tierra', f, -6.77, -79.84)
  const ang = (u: Vec3, v: Vec3) => Math.acos(Math.min(1, u.x * v.x + u.y * v.y + u.z * v.z)) * GR
  const err = Math.max(ang(a.cenit, b.cenit), ang(a.norte, b.norte))
  // El modelo IAU de la Tierra es simplificado (sin nutación, precesión lineal), así que se
  // espera menos de 1° de diferencia; un error de signo en la longitud daría decenas de grados.
  comprobar(err < 1, `Tierra: modelo IAU vs rotación completa difieren ${err.toFixed(3)}° (valida la convención usada en Marte)`)
  const q = orientacionSuperficie('Tierra', f, -6.77, -79.84)
  const sol = cuerposVisibles(f, vectorHelio('Tierra', f)).Sol
  comprobar(alturaGrados(sol.direccion, q) < -10, `Chiclayo a las 22:00 hora local: Sol a ${alturaGrados(sol.direccion, q).toFixed(1)}° (de noche)`)
  // Polaris: desde la latitud 40°N debe estar a ~40° de altura.
  const pol = estrella('Estrella Polar')
  const alt = alturaGrados(radecAEscena(pol.ra, pol.dec), orientacionSuperficie('Tierra', f, 40, 0))
  comprobar(Math.abs(alt - 40) < 1.5, `Estrella Polar desde 40°N a ${alt.toFixed(2)}° de altura`)
}
{
  // Marte, cráter Jezero (18.44°N, 77.45°E): el Sol debe salir y ponerse una vez por sol (24.66 h).
  const q0 = new Date('2029-01-01T00:00:00Z').getTime()
  let cruces = 0
  let prev = 0
  for (let h = 0; h <= 24.66 * 3; h += 0.25) {
    const f = new Date(q0 + h * 3_600_000)
    const marte = vectorHelio('Marte', f)
    const a = alturaGrados(cuerposVisibles(f, marte).Sol.direccion, orientacionSuperficie('Marte', f, 18.44, 77.45))
    if (h > 0 && Math.sign(a) !== Math.sign(prev)) cruces++
    prev = a
  }
  comprobar(cruces === 6, `Jezero: ${cruces} salidas/puestas de Sol en 3 soles`)
}
{
  const dir = radecAEscena(88.79, 7.41)
  const q = orientacionHacia(dir, new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0))
  const v = dir.clone().applyQuaternion(q)
  comprobar(v.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-9, 'orientacionHacia pone Betelgeuse al frente (-Z)')
}

// ------------------------------------------------- lo que ve la tripulación
console.log(`\n== Qué ve la tripulación (salida ${dia(salida)}, viaje de 210 días)`)
const nombre = (c: Cuerpo) => c.padEnd(8)
for (const f of [0.1, 0.5, 0.9]) {
  const fecha = new Date(salida.getTime() + f * t.dias * 86_400_000)
  const nave = posicionNave(salida, llegada, f)
  const c = cuerposVisibles(fecha, nave)
  console.log(`  ${Math.round(f * 100)}% (${dia(fecha)}), nave a ${Math.hypot(nave.x, nave.y, nave.z).toFixed(3)} UA del Sol`)
  for (const k of CUERPOS) {
    const i = c[k]
    const ra = ((Math.atan2(-i.direccion.z, i.direccion.x) * GR) % 360 + 360) % 360
    const dec = Math.asin(i.direccion.y) * GR
    const km = i.distanciaUA * UA_KM
    console.log(`    ${nombre(k)} ${(km / 1e6).toFixed(1).padStart(6)} M km  AR ${ra.toFixed(1).padStart(5)}° Dec ${dec.toFixed(1).padStart(5)}°  mag ${i.magnitud.toFixed(1).padStart(5)}  diámetro ${(i.tamanoAngularRad * GR * 3600).toFixed(1).padStart(7)}"  iluminada ${(i.fraccionIluminada * 100).toFixed(0)}%`)
  }
  const sep = vistoDesde(nave, vectorHelio('Tierra', fecha)).direccion
  const sepL = vistoDesde(nave, vectorHelio('Luna', fecha)).direccion
  const ang = Math.acos(Math.min(1, sep.x * sepL.x + sep.y * sepL.y + sep.z * sepL.z)) * GR
  console.log(`    Tierra-Luna separadas ${ang.toFixed(3)}° en el cielo`)
}

console.log(fallas ? `\n${fallas} FALLAS` : '\nTodo bien.')
process.exit(fallas ? 1 : 0)
