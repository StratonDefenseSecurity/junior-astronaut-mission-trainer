// Certificado de misión: una imagen para guardar o compartir con la tripulación, el nombre de la
// misión, la situación, las fechas reales y lo que lograron.
import { C } from '@shared/ciencia'
import { escenarioDe, fechaDeMision, fechaLarga } from '@shared/escenarios'
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
  texto('CERTIFICADO DE MISIÓN', W / 2, 175, 54, '#ffffff', '700', 'center')
  texto(sala.nombreMision || `Misión ${sala.codigo}`, W / 2, 250, 64, '#f5b942', '700', 'center')
  texto(`${esc.nombre} · ${sala.resultado?.titulo ?? ''}`, W / 2, 305, 30, victoria ? '#5fd08a' : '#ff8a80', '600', 'center')

  const despegue = fechaDeMision(esc, 0)
  const llegada = sala.tAterrizaje > 0 ? fechaDeMision(esc, sala.tAterrizaje) : null
  const lineas = [
    `Despegue: ${fechaLarga(despegue)}`,
    llegada ? `Aterrizaje: ${fechaLarga(llegada)} en ${SITE_BY_ID[sala.sitio ?? 'gale'].nombre}` : 'No llegaron a la superficie',
    `${Math.round(Math.max(0, (sala.tAterrizaje || sala.t) - TRANSITO_INICIO_S) / 86400)} días en el espacio · ${Math.max(0, sala.ambiente.sol - 1)} soles en Marte`,
    `${sala.mision.muestrasAnalizadas} de ${sala.mision.muestrasObjetivo} muestras analizadas${sala.mision.aguaObjetivo ? ` · ${Math.round(sala.mision.aguaExtraida)} kg de agua sacada del hielo` : ''}`,
  ]
  lineas.forEach((l, i) => texto(l, 120, 400 + i * 44, 28))

  texto('TRIPULACIÓN', 120, 610, 22, '#4fc3f7', '600')
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
  texto(`Límite de radiación de carrera de la NASA: ${C.LIMITE_CARRERA_MSV} mSv. Datos reales de NASA; el resto es simulación educativa.`, W / 2, H - 70, 18, '#8d9ab5', '400', 'center')

  const enlace = document.createElement('a')
  enlace.download = `certificado-${(sala.nombreMision || sala.codigo).replace(/[^\w-]+/g, '-')}.png`
  enlace.href = lienzo.toDataURL('image/png')
  enlace.click()
}
