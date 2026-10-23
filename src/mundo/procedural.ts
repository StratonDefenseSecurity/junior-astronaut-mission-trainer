// Texturas hechas con código (lienzos 2D) y un retoque de polvo para materiales: nada se
// descarga. Cada textura se crea una sola vez y se guarda; las del interior imitan los
// rótulos de la Estación Espacial (códigos de ubicación, avisos en mayúsculas, códigos de barras).
import * as THREE from 'three'

/** Números pseudoaleatorios repetibles. */
export function azar(semilla: number) {
  let s = Math.floor(Math.abs(semilla) * 9973) % 2147483646 || 1
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const cache = new Map<string, THREE.Texture>()

function lienzo(clave: string, w: number, h: number, dibujar: (c: CanvasRenderingContext2D, w: number, h: number) => void, opciones: { repetir?: boolean; color?: boolean } = {}) {
  const hecha = cache.get(clave)
  if (hecha) return hecha
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const c = cv.getContext('2d')!
  dibujar(c, w, h)
  const t = new THREE.CanvasTexture(cv)
  if (opciones.color !== false) t.colorSpace = THREE.SRGBColorSpace
  if (opciones.repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  cache.set(clave, t)
  return t
}

const FUENTE = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif'

/** Grano suave de suciedad y uso sobre lo que ya hay dibujado. */
function desgaste(c: CanvasRenderingContext2D, w: number, h: number, r: () => number, fuerza = 1) {
  for (let i = 0; i < (w * h) / 900; i++) {
    c.fillStyle = `rgba(60,55,45,${0.015 * fuerza + r() * 0.02 * fuerza})`
    c.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2)
  }
  for (let i = 0; i < 6 * fuerza; i++) {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 1)
    g.addColorStop(0, 'rgba(70,64,52,0.10)')
    g.addColorStop(1, 'rgba(70,64,52,0)')
    c.save()
    c.translate(r() * w, r() * h)
    c.scale(10 + r() * w * 0.12, 6 + r() * h * 0.06)
    c.fillStyle = g
    c.beginPath()
    c.arc(0, 0, 1, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }
  // rozaduras finas
  c.strokeStyle = 'rgba(255,255,255,0.25)'
  c.lineWidth = 1
  for (let i = 0; i < 10 * fuerza; i++) {
    const x = r() * w
    const y = r() * h
    c.beginPath()
    c.moveTo(x, y)
    c.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 6)
    c.stroke()
  }
}

function rectRedondo(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

function codigoBarras(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: () => number) {
  c.fillStyle = '#f7f7f2'
  c.fillRect(x, y, w, h)
  c.fillStyle = '#111'
  let px = x + 2
  while (px < x + w - 3) {
    const g = 1 + Math.floor(r() * 2.5)
    c.fillRect(px, y + 2, g, h - 4)
    px += g + 1 + Math.floor(r() * 2)
  }
}

function etiqueta(c: CanvasRenderingContext2D, texto: string, x: number, y: number, alto: number, fondo = '#f4f3ee', tinta = '#111') {
  c.font = `bold ${alto * 0.72}px ${FUENTE}`
  const w = c.measureText(texto).width + alto * 0.6
  c.fillStyle = fondo
  c.fillRect(x, y, w, alto)
  c.strokeStyle = 'rgba(0,0,0,0.35)'
  c.lineWidth = 1
  c.strokeRect(x + 0.5, y + 0.5, w - 1, alto - 1)
  c.fillStyle = tinta
  c.textBaseline = 'middle'
  c.fillText(texto, x + alto * 0.3, y + alto * 0.54)
  return w
}

const AVISOS = ['CAUTION HOT SURFACE', 'DO NOT STEP', 'NO HANDHOLD', 'KEEP CLEAR', 'CAUTION 120 VDC', 'STOW BEFORE REBOOST']
const PLACAS = ['MLE', 'UOP', 'J-BOX', 'SSC', 'MDM', 'ER', 'PCS', 'AVIONICS', 'IMV', 'CHeCS', 'TCS', 'DDCU']

/**
 * Frente de un bastidor de equipos al estilo de la Estación Espacial: cajones con asas y
 * placas, panel de interruptores, puerto de incendios, conectores, LED y el código de
 * ubicación arriba (p. ej. «HAB1S2»). Se dibuja a la medida del bastidor.
 */
export function texturaBastidor(codigo: string, anchoM: number, altoM: number, semilla: number, alta: boolean) {
  const ppm = alta ? 220 : 110
  const w = Math.round(anchoM * ppm)
  const h = Math.round(altoM * ppm)
  return lienzo(`rack:${codigo}:${anchoM}:${altoM}:${ppm}`, w, h, (c) => {
    const r = azar(semilla + 1)
    const u = ppm / 100 // escala: 1 u = 1 cm
    c.fillStyle = '#d8d4c7'
    c.fillRect(0, 0, w, h)
    // postes laterales del bastidor
    c.fillStyle = '#b9b6ab'
    c.fillRect(0, 0, 3 * u, h)
    c.fillRect(w - 3 * u, 0, 3 * u, h)
    // cabecera con el código de ubicación
    c.fillStyle = '#cfcbbd'
    c.fillRect(3 * u, 0, w - 6 * u, 9 * u)
    c.fillStyle = '#121212'
    c.font = `bold ${6.2 * u}px ${FUENTE}`
    c.textBaseline = 'middle'
    c.fillText(codigo, 5 * u, 4.8 * u)
    codigoBarras(c, w - 26 * u, 2 * u, 20 * u, 5 * u, r)
    // cajones (casilleros) en filas de altura variable
    let y = 10 * u
    while (y < h - 6 * u) {
      const alto = Math.min(h - 3 * u - y, (r() < 0.25 ? 44 : 23) * u + r() * 4 * u)
      if (alto < 8 * u) break
      const columnas = anchoM > 1 ? Math.max(1, Math.round((anchoM * 100) / (r() < 0.5 ? 46 : 60))) : 1
      const anchoCol = (w - 8 * u) / columnas
      for (let k = 0; k < columnas; k++) {
        const x = 4 * u + k * anchoCol
        const cw = anchoCol - 1.5 * u
        const ch = alto - 1.5 * u
        const tipo = r()
        c.fillStyle = tipo < 0.12 ? '#c6c9cd' : tipo < 0.2 ? '#e7e5de' : '#dedacd'
        rectRedondo(c, x, y, cw, ch, 1.2 * u)
        c.fill()
        c.strokeStyle = 'rgba(40,36,30,0.55)'
        c.lineWidth = Math.max(1, 0.35 * u)
        c.stroke()
        // tornillos de las esquinas
        c.fillStyle = '#8b8f94'
        const b = 1.6 * u
        for (const [sx, sy] of [[b, b], [cw - b, b], [b, ch - b], [cw - b, ch - b]]) {
          c.beginPath()
          c.arc(x + sx, y + sy, 0.45 * u, 0, Math.PI * 2)
          c.fill()
        }
        // asas a los lados
        c.fillStyle = '#5b6067'
        c.fillRect(x + 2.5 * u, y + ch / 2 - 3 * u, 1.4 * u, 6 * u)
        c.fillRect(x + cw - 3.9 * u, y + ch / 2 - 3 * u, 1.4 * u, 6 * u)
        // placa con nombre y número de pieza
        const nombre = `${PLACAS[Math.floor(r() * PLACAS.length)]}-${1 + Math.floor(r() * 9)}`
        etiqueta(c, nombre, x + 6 * u, y + 2 * u, 3.6 * u)
        c.fillStyle = 'rgba(20,20,20,0.7)'
        c.font = `${1.7 * u}px ${FUENTE}`
        c.fillText(`P/N 683-${10000 + Math.floor(r() * 89999)}`, x + 6 * u, y + 7.6 * u)
        if (ch > 14 * u && r() < 0.45) codigoBarras(c, x + cw - 18 * u, y + ch - 6 * u, 13 * u, 4 * u, r)
        // panel de interruptores con guardas y LED
        if (r() < 0.35 && cw > 30 * u) {
          const px = x + cw * 0.38
          const py = y + ch * 0.45
          c.fillStyle = '#2a2d31'
          c.fillRect(px, py, cw * 0.5, 9 * u)
          for (let s = 0; s < 6; s++) {
            const sx = px + 3 * u + s * ((cw * 0.5 - 6 * u) / 5)
            c.fillStyle = '#c9ccd0'
            c.fillRect(sx - 0.5 * u, py + 2 * u, 1 * u, 3.4 * u)
            c.strokeStyle = '#8d9196'
            c.strokeRect(sx - 1.6 * u, py + 1.4 * u, 3.2 * u, 4.6 * u)
            c.fillStyle = r() < 0.7 ? '#43e08a' : '#f5b942'
            c.beginPath()
            c.arc(sx, py + 7.3 * u, 0.6 * u, 0, Math.PI * 2)
            c.fill()
          }
        }
        // conectores redondos
        if (r() < 0.3) {
          for (let s = 0; s < 3; s++) {
            const cx = x + cw - 8 * u - s * 5 * u
            const cy = y + ch * 0.55
            c.fillStyle = '#6b7077'
            c.beginPath()
            c.arc(cx, cy, 1.8 * u, 0, Math.PI * 2)
            c.fill()
            c.fillStyle = '#2b2e33'
            c.beginPath()
            c.arc(cx, cy, 1.1 * u, 0, Math.PI * 2)
            c.fill()
          }
        }
        // aviso amarillo
        if (r() < 0.14) {
          const aviso = AVISOS[Math.floor(r() * AVISOS.length)]
          etiqueta(c, aviso, x + 6 * u, y + ch - 6.5 * u, 3.2 * u, '#f2c230', '#141414')
        }
      }
      y += alto
    }
    // puerto de incendios (anillo con el triángulo de aviso) a media altura
    const fx = w - 9 * u
    const fy = h * 0.42
    c.fillStyle = '#e7e4da'
    c.beginPath()
    c.arc(fx, fy, 3.2 * u, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#1a1a1a'
    c.lineWidth = 0.6 * u
    c.stroke()
    c.fillStyle = '#222'
    c.beginPath()
    c.arc(fx, fy, 1.2 * u, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#c62828'
    c.font = `bold ${1.8 * u}px ${FUENTE}`
    c.fillText('FIRE PORT', fx - 4.5 * u, fy + 5 * u)
    desgaste(c, w, h, r, alta ? 1.4 : 1)
  })
}

/** Bolsa blanca de transporte de carga (CTB) con cintas de velcro, asa y tarjeta de inventario. */
export function texturaCTB(n: number) {
  return lienzo(`ctb:${n}`, 256, 256, (c, w, h) => {
    const r = azar(n + 40)
    c.fillStyle = '#ecebe4'
    c.fillRect(0, 0, w, h)
    // trama de la tela Nomex
    c.globalAlpha = 0.07
    for (let i = 0; i < w; i += 3) {
      c.fillStyle = i % 6 ? '#000' : '#fff'
      c.fillRect(i, 0, 1, h)
      c.fillRect(0, i, w, 1)
    }
    c.globalAlpha = 1
    // costuras del borde
    c.strokeStyle = 'rgba(80,76,66,0.5)'
    c.setLineDash([4, 3])
    c.strokeRect(8, 8, w - 16, h - 16)
    c.setLineDash([])
    // dos cintas de velcro gris claro con hebilla
    for (const x of [0.27, 0.73]) {
      c.fillStyle = '#c9c8c0'
      c.fillRect(w * x - 11, 0, 22, h)
      c.strokeStyle = 'rgba(60,60,60,0.35)'
      c.strokeRect(w * x - 11, 0, 22, h)
      c.fillStyle = '#9a9a92'
      c.fillRect(w * x - 13, h * 0.5 - 7, 26, 14)
    }
    // bolsillo de la tarjeta de inventario con su código de barras
    c.fillStyle = 'rgba(210,225,235,0.6)'
    c.fillRect(w * 0.36, h * 0.14, w * 0.28, h * 0.26)
    c.fillStyle = '#fafaf6'
    c.fillRect(w * 0.38, h * 0.16, w * 0.24, h * 0.22)
    c.fillStyle = '#111'
    c.font = `bold 13px ${FUENTE}`
    c.textBaseline = 'top'
    const cosas = ['FOOD', 'CREW PROV', 'IFM TOOLS', 'HYGIENE', 'SPARES', 'SCIENCE', 'CLOTHING', 'MEDICAL']
    c.fillText(cosas[n % cosas.length], w * 0.395, h * 0.175)
    c.font = `10px ${FUENTE}`
    c.fillText(`CTB 1.0  #${1000 + Math.floor(r() * 8999)}`, w * 0.395, h * 0.24)
    codigoBarras(c, w * 0.395, h * 0.3, w * 0.2, h * 0.06, r)
    desgaste(c, w, h, r, 1.2)
  })
}

/** Grano de uso para paneles claros (manchas de manos, roces), repetible. */
export function texturaDesgaste() {
  return lienzo('desgaste', 256, 256, (c, w, h) => {
    const r = azar(3)
    c.fillStyle = '#ffffff'
    c.fillRect(0, 0, w, h)
    desgaste(c, w, h, r, 2)
    // juntas de paneles
    c.strokeStyle = 'rgba(90,90,90,0.35)'
    c.lineWidth = 2
    c.strokeRect(1, 1, w - 2, h - 2)
    c.fillStyle = 'rgba(110,110,110,0.5)'
    for (const [x, y] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]]) {
      c.beginPath()
      c.arc(x, y, 2.2, 0, Math.PI * 2)
      c.fill()
    }
  }, { repetir: true })
}

/** Panel de luz LED con difusor y marco. */
export function texturaLuz() {
  return lienzo('luz', 256, 96, (c, w, h) => {
    c.fillStyle = '#9aa0a6'
    c.fillRect(0, 0, w, h)
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#fff6e6')
    g.addColorStop(0.5, '#ffffff')
    g.addColorStop(1, '#fff6e6')
    c.fillStyle = g
    c.fillRect(8, 8, w - 16, h - 16)
    c.strokeStyle = 'rgba(200,190,170,0.35)'
    for (let x = 8; x < w - 8; x += 12) {
      c.beginPath()
      c.moveTo(x, 8)
      c.lineTo(x, h - 8)
      c.stroke()
    }
    c.fillStyle = '#5d636a'
    c.fillRect(w - 30, h - 8, 22, 6)
  })
}

/** Rejilla de ventilación con lamas. */
export function texturaRejilla() {
  return lienzo('rejilla', 128, 96, (c, w, h) => {
    c.fillStyle = '#b8bcc2'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#2d3136'
    c.fillRect(6, 6, w - 12, h - 12)
    for (let y = 9; y < h - 8; y += 6) {
      c.fillStyle = '#c8ccd2'
      c.fillRect(8, y, w - 16, 3)
      c.fillStyle = '#7f858c'
      c.fillRect(8, y + 3, w - 16, 1)
    }
    c.fillStyle = '#111'
    c.font = `bold 9px ${FUENTE}`
    c.fillText('IMV SUPPLY', 10, h - 2)
  })
}

/** Rótulo plano con letras de plantilla (fondo transparente si no se da color). */
export function texturaRotulo(texto: string, fondo: string | null, tinta: string, anchoPx = 512, altoPx = 96) {
  return lienzo(`rot:${texto}:${fondo}:${tinta}:${anchoPx}`, anchoPx, altoPx, (c, w, h) => {
    if (fondo) {
      c.fillStyle = fondo
      c.fillRect(0, 0, w, h)
    }
    c.fillStyle = tinta
    c.font = `bold ${h * 0.62}px ${FUENTE}`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(texto, w / 2, h * 0.54, w * 0.94)
  })
}

/** Franjas de aviso amarillas y negras. */
export function texturaFranjas() {
  return lienzo('franjas', 128, 32, (c, w, h) => {
    c.fillStyle = '#f2c230'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#151515'
    for (let x = -h; x < w; x += 24) {
      c.beginPath()
      c.moveTo(x, h)
      c.lineTo(x + 12, h)
      c.lineTo(x + 12 + h, 0)
      c.lineTo(x + h, 0)
      c.fill()
    }
  }, { repetir: true })
}

/** Pantalla de portátil con ventanas, gráficas y texto. */
export function texturaPortatil(n: number) {
  return lienzo(`laptop:${n}`, 256, 160, (c, w, h) => {
    const r = azar(n + 77)
    c.fillStyle = '#0d1b2a'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#1f3b5c'
    c.fillRect(0, 0, w, 12)
    c.fillStyle = '#9fd0ff'
    c.font = `9px ${FUENTE}`
    c.fillText('PROCEDURE VIEWER   GMT 214/13:42', 4, 9)
    // ventana de procedimiento
    c.fillStyle = '#e8edf2'
    c.fillRect(6, 18, w * 0.55, h - 26)
    c.fillStyle = '#334'
    for (let y = 26; y < h - 12; y += 8) c.fillRect(10, y, (w * 0.55 - 12) * (0.4 + r() * 0.55), 3)
    // gráfica
    c.fillStyle = '#061018'
    c.fillRect(w * 0.6, 18, w * 0.37, h * 0.45)
    c.strokeStyle = '#3ddc97'
    c.beginPath()
    for (let i = 0; i <= 30; i++) {
      const x = w * 0.6 + (i / 30) * w * 0.37
      const y = 18 + h * 0.22 + Math.sin(i * 0.5 + n) * h * 0.08 + (r() - 0.5) * 6
      if (i) c.lineTo(x, y)
      else c.moveTo(x, y)
    }
    c.stroke()
    c.fillStyle = '#f5b942'
    c.fillRect(w * 0.6, h * 0.7, w * 0.37, 10)
  })
}

/** Manta térmica multicapa (MLI) acolchada, con costuras y parches. */
export function texturaMLI() {
  return lienzo('mli', 512, 512, (c, w, h) => {
    const r = azar(11)
    c.fillStyle = '#e9e7df'
    c.fillRect(0, 0, w, h)
    const paso = 32
    for (let y = 0; y < h; y += paso) {
      for (let x = 0; x < w; x += paso) {
        const g = c.createRadialGradient(x + paso / 2, y + paso / 2, 2, x + paso / 2, y + paso / 2, paso * 0.75)
        g.addColorStop(0, 'rgba(255,255,255,0.18)')
        g.addColorStop(1, 'rgba(120,115,100,0.1)')
        c.fillStyle = g
        c.fillRect(x, y, paso, paso)
      }
    }
    c.strokeStyle = 'rgba(90,86,74,0.28)'
    c.setLineDash([2, 3])
    for (let i = 0; i <= w; i += paso) {
      c.beginPath()
      c.moveTo(i, 0)
      c.lineTo(i, h)
      c.stroke()
      c.beginPath()
      c.moveTo(0, i)
      c.lineTo(w, i)
      c.stroke()
    }
    c.setLineDash([])
    // juntas entre mantas, con cinta de velcro
    c.fillStyle = 'rgba(175,171,160,0.7)'
    c.fillRect(0, h / 2 - 5, w, 10)
    c.fillRect(w / 2 - 5, 0, 10, h)
    // remiendos de cinta plateada
    for (let i = 0; i < 5; i++) {
      c.fillStyle = 'rgba(190,195,200,0.85)'
      c.fillRect(r() * w, r() * h, 18 + r() * 30, 10 + r() * 14)
    }
    desgaste(c, w, h, r, 1.5)
  }, { repetir: true })
}

/** Radiador: panel blanco con tubos de fluido en paralelo. */
export function texturaRadiador() {
  return lienzo('radiador', 256, 256, (c, w, h) => {
    c.fillStyle = '#f2f2ee'
    c.fillRect(0, 0, w, h)
    for (let x = 6; x < w; x += 16) {
      c.fillStyle = '#c9ccd0'
      c.fillRect(x, 0, 4, h)
      c.fillStyle = 'rgba(255,255,255,0.9)'
      c.fillRect(x + 4, 0, 2, h)
    }
    c.fillStyle = '#9aa1a8'
    c.fillRect(0, 0, w, 8)
    c.fillRect(0, h - 8, w, 8)
  }, { repetir: true })
}

/**
 * Regolito: color con granos, guijarros y manchas, más su mapa de normales.
 * El color es casi gris para multiplicarse por el tono del suelo según la hora.
 */
export function texturasRegolito(alta: boolean) {
  const n = alta ? 512 : 256
  const clave = `regolito:${n}`
  const hecha = cache.get(clave)
  if (hecha) return { color: hecha, normal: cache.get(clave + ':n')! }
  const r = azar(21)
  const alto = new Float32Array(n * n)
  // ruido de valor en varias octavas, periódico para que se repita sin costuras
  const octava = (celdas: number, peso: number) => {
    const rejilla = Array.from({ length: celdas * celdas }, () => r())
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const fx = (x / n) * celdas
        const fy = (y / n) * celdas
        const x0 = Math.floor(fx)
        const y0 = Math.floor(fy)
        const tx = fx - x0
        const ty = fy - y0
        const sx = tx * tx * (3 - 2 * tx)
        const sy = ty * ty * (3 - 2 * ty)
        const v = (i: number, j: number) => rejilla[((j % celdas) * celdas + (i % celdas)) | 0]
        const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx
        const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx
        alto[y * n + x] += (a + (b - a) * sy) * peso
      }
  }
  octava(4, 0.45)
  octava(16, 0.3)
  octava(64, 0.18)
  // guijarros
  const guijarros: [number, number, number][] = []
  for (let i = 0; i < (alta ? 900 : 400); i++) guijarros.push([r() * n, r() * n, 1 + r() * r() * 5])
  for (const [gx, gy, gr] of guijarros) {
    for (let dy = -Math.ceil(gr); dy <= gr; dy++)
      for (let dx = -Math.ceil(gr); dx <= gr; dx++) {
        const d = Math.hypot(dx, dy) / gr
        if (d > 1) continue
        const x = (Math.floor(gx + dx) + n) % n
        const y = (Math.floor(gy + dy) + n) % n
        alto[y * n + x] += Math.sqrt(1 - d * d) * 0.35
      }
  }
  const cvC = document.createElement('canvas')
  cvC.width = cvC.height = n
  const cC = cvC.getContext('2d')!
  const imgC = cC.createImageData(n, n)
  const cvN = document.createElement('canvas')
  cvN.width = cvN.height = n
  const cN = cvN.getContext('2d')!
  const imgN = cN.createImageData(n, n)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x
      const h = alto[i]
      const v = 150 + h * 70 + (r() - 0.5) * 22
      imgC.data[i * 4] = Math.min(255, v * 1.04)
      imgC.data[i * 4 + 1] = Math.min(255, v * 0.97)
      imgC.data[i * 4 + 2] = Math.min(255, v * 0.92)
      imgC.data[i * 4 + 3] = 255
      const hx = alto[y * n + ((x + 1) % n)] - alto[y * n + ((x - 1 + n) % n)]
      const hy = alto[((y + 1) % n) * n + x] - alto[((y - 1 + n) % n) * n + x]
      const nx = -hx * 0.9
      const ny = -hy * 0.9
      const l = Math.hypot(nx, ny, 1)
      imgN.data[i * 4] = (nx / l) * 127 + 128
      imgN.data[i * 4 + 1] = (ny / l) * 127 + 128
      imgN.data[i * 4 + 2] = (1 / l) * 127 + 128
      imgN.data[i * 4 + 3] = 255
    }
  cC.putImageData(imgC, 0, 0)
  cN.putImageData(imgN, 0, 0)
  const color = new THREE.CanvasTexture(cvC)
  color.colorSpace = THREE.SRGBColorSpace
  const normal = new THREE.CanvasTexture(cvN)
  for (const t of [color, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 4
  }
  cache.set(clave, color)
  cache.set(clave + ':n', normal)
  return { color, normal }
}

/** Huella de bota con tacos (canal alfa). */
export function texturaHuella() {
  return lienzo('huella', 64, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h)
    c.fillStyle = 'rgba(60,24,10,0.38)'
    c.beginPath()
    c.ellipse(w / 2, h * 0.3, w * 0.36, h * 0.25, 0, 0, Math.PI * 2)
    c.fill()
    c.beginPath()
    c.ellipse(w / 2, h * 0.76, w * 0.3, h * 0.19, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = 'rgba(255,220,190,0.18)'
    for (let y = 10; y < h - 8; y += 9) for (let x = 14; x < w - 12; x += 10) if ((x + y) % 3) c.fillRect(x, y, 5, 3)
  })
}

/** Rodada de rueda de rover con las garras marcadas (canal alfa, se repite a lo largo). */
export function texturaRodada() {
  return lienzo('rodada', 64, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h)
    c.fillStyle = 'rgba(45,18,8,0.45)'
    c.fillRect(4, 0, w - 8, h)
    c.fillStyle = 'rgba(30,10,4,0.55)'
    for (let y = 0; y < h; y += 16) {
      c.beginPath()
      c.moveTo(4, y)
      c.lineTo(w / 2, y + 6)
      c.lineTo(w - 4, y)
      c.lineTo(w - 4, y + 4)
      c.lineTo(w / 2, y + 10)
      c.lineTo(4, y + 4)
      c.fill()
    }
  }, { repetir: true })
}

/** Parche de misión: círculo azul con Marte, la órbita y estrellas (diseño del juego). */
export function texturaParche() {
  return lienzo('parche', 128, 128, (c, w) => {
    const m = w / 2
    c.fillStyle = '#d9d4c3'
    c.beginPath()
    c.arc(m, m, m, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#123a7a'
    c.beginPath()
    c.arc(m, m, m - 7, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#c1440e'
    c.beginPath()
    c.arc(m + 10, m + 10, 26, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#f5f5f5'
    c.lineWidth = 3
    c.beginPath()
    c.ellipse(m, m, 50, 18, -0.5, 0, Math.PI * 2)
    c.stroke()
    c.fillStyle = '#fff'
    for (const [x, y] of [[34, 36], [52, 26], [92, 40], [30, 82]]) c.fillRect(x, y, 3, 3)
  })
}

/** Panel solar: celdas azul oscuro con sus líneas plateadas. */
export function texturaPanelSolar() {
  return lienzo('solar', 256, 128, (c, w, h) => {
    c.fillStyle = '#c9ccd0'
    c.fillRect(0, 0, w, h)
    for (let y = 2; y < h - 2; y += 16)
      for (let x = 2; x < w - 2; x += 16) {
        c.fillStyle = '#16264a'
        c.fillRect(x, y, 14, 14)
        c.fillStyle = 'rgba(160,180,210,0.35)'
        c.fillRect(x, y + 7, 14, 1)
      }
  })
}

/**
 * Polvo marciano posado: aclara y enrojece las caras que miran hacia arriba y vuelve la
 * superficie mate. Se aplica una vez por material.
 */
export function empolvar<T extends THREE.MeshStandardMaterial>(mat: T, cantidad = 0.6, color = '#b5703f'): T {
  const tono = new THREE.Color(color)
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uPolvo = { value: cantidad }
    sh.uniforms.uColorPolvo = { value: tono }
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float uPolvo;\nuniform vec3 uColorPolvo;\nvoid main() {')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec3 arribaV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float kp = smoothstep(0.15, 0.85, dot(normal, arribaV)) * uPolvo;
          kp = max(kp, uPolvo * 0.18);
          diffuseColor.rgb = mix(diffuseColor.rgb, uColorPolvo, kp);
          roughnessFactor = mix(roughnessFactor, 1.0, kp);
          metalnessFactor = mix(metalnessFactor, 0.0, kp);
        }`,
      )
  }
  mat.customProgramCacheKey = () => `polvo${cantidad}`
  return mat
}
