// Certificado de misión: una imagen para guardar o compartir con la tripulación, el nombre de la
// misión, la situación, las fechas reales y lo que lograron.
import { C } from '@shared/ciencia'
import { escenarioDe, fechaDeMision, fechaLarga } from '@shared/escenarios'
import { DIFICULTAD_BY_ID } from '@shared/informe'
import { ROLE_BY_ID, SITE_BY_ID, TRANSITO_INICIO_S, type RoomState } from '@shared/types'

export function descargarCertificado(sala: RoomState) {
  const esc = escenarioDe(sala.escenario)
  const W = 1600
  const H = 1000
  const lienzo = document.createElement('canvas')
  lienzo.width = W
  lienzo.height = H
  const g = lienzo.getContext('2d')
  if (!g) return
  // Fondo: espacio con estrellas fijas y un Marte al borde.
  const fondo = g.createLinearGradient(0, 0, 0, H)
  fondo.addColorStop(0, '#05070f')
  fondo.addColorStop(1, '#0d1426')
  g.fillStyle = fondo
  g.fillRect(0, 0, W, H)
  let semilla = 7
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + azar() * 0.7})`
    g.fillRect(azar() * W, azar() * H, azar() < 0.1 ? 2 : 1, azar() < 0.1 ? 2 : 1)
  }
  const marte = g.createRadialGradient(W - 140, H + 60, 40, W - 140, H + 60, 420)
  marte.addColorStop(0, '#d9733f')
  marte.addColorStop(0.7, '#a2401d')
  marte.addColorStop(1, 'rgba(120,40,15,0)')
  g.fillStyle = marte
  g.beginPath()
  g.arc(W - 140, H + 60, 420, 0, Math.PI * 2)
  g.fill()

  g.strokeStyle = '#f5b942'
  g.lineWidth = 3
  g.strokeRect(40, 40, W - 80, H - 80)

  const texto = (t: string, x: number, y: number, tam: number, color = '#e6ecf7', peso = '400', alinear: CanvasTextAlign = 'left') => {
    g.font = `${peso} ${tam}px "Space Grotesk", system-ui, sans-serif`
    g.fillStyle = color
    g.textAlign = alinear
    g.fillText(t, x, y)
  }
  const victoria = sala.resultado?.victoria ?? false
  texto('NASA SPACE APPS 2026 · JUNIOR ASTRONAUT MISSION TRAINER', W / 2, 110, 22, '#4fc3f7', '600', 'center')
  texto('MISSION CERTIFICATE', W / 2, 175, 54, '#ffffff', '700', 'center')
  texto(sala.nombreMision || `Mission ${sala.codigo}`, W / 2, 250, 64, '#f5b942', '700', 'center')
  texto(`${esc.nombre} · ${sala.resultado?.titulo ?? ''}`, W / 2, 305, 30, victoria ? '#5fd08a' : '#ff8a80', '600', 'center')
  const inf = sala.informe
  if (inf) {
    const dif = DIFICULTAD_BY_ID[sala.dificultad ?? 'astronauta']?.nombre ?? 'Astronaut'
    texto(`MISSION SCORE ${inf.puntos}/100 · ${dif}${sala.demo ? ' · Quick demo' : ''}`, W / 2, 352, 30, '#4fc3f7', '700', 'center')
  }

  const despegue = fechaDeMision(esc, 0)
  const llegada = sala.tAterrizaje > 0 ? fechaDeMision(esc, sala.tAterrizaje) : null
  const lineas = [
    `Liftoff: ${fechaLarga(despegue)}`,
    llegada ? `Landing: ${fechaLarga(llegada)} at ${SITE_BY_ID[sala.sitio ?? 'gale'].nombre}` : 'The crew did not reach the surface',
    `${Math.round(Math.max(0, (sala.tAterrizaje || sala.t) - TRANSITO_INICIO_S) / 86400)} days in space · ${Math.max(0, sala.ambiente.sol - 1)} sols on Mars`,
    `${sala.mision.muestrasAnalizadas} of ${sala.mision.muestrasObjetivo} samples analyzed${sala.mision.aguaObjetivo ? ` · ${Math.round(sala.mision.aguaExtraida)} kg of water taken from the ice` : ''}`,
  ]
  if (inf) lineas.push(`${inf.objetivos.filter((o) => o.logrado).length} of ${inf.objetivos.length} learning objectives achieved`)
  lineas.forEach((l, i) => texto(l, 120, 400 + i * 40, 26))

  texto('CREW', 120, 610, 22, '#4fc3f7', '600')
  sala.jugadores
    .filter((j) => j.rol)
    .forEach((j, i) => {
      const x = 120 + (i % 3) * 460
      const y = 660 + Math.floor(i / 3) * 110
      const rol = ROLE_BY_ID[j.rol!]
      g.fillStyle = rol.color
      g.fillRect(x, y - 26, 8, 70)
      texto(j.nombre, x + 24, y, 32, '#ffffff', '700')
      texto(`${rol.nombre} · ${Math.round(j.vit.dosis)} mSv`, x + 24, y + 36, 22, '#a8b4cc')
    })
  texto(`NASA career radiation limit: ${C.LIMITE_CARRERA_MSV} mSv. Real NASA data. Everything else is an educational simulation.`, W / 2, H - 70, 18, '#8d9ab5', '400', 'center')

  const enlace = document.createElement('a')
  enlace.download = `mission-certificate-${(sala.nombreMision || sala.codigo).replace(/[^\w-]+/g, '-')}.png`
  enlace.href = lienzo.toDataURL('image/png')
  enlace.click()
}
