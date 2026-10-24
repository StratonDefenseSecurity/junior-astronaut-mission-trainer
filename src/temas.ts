// Temas de color de la interfaz. Única fuente de verdad: aplicarTema() escribe estas variables CSS
// en <html> (las mismas de :root en src/styles.css) y el selector de temas usa los mismos valores
// para su vista previa. Cada tema cumple WCAG AA (4,5:1) para texto, texto atenuado y estados
// sobre el fondo y el panel (comprobado con contraste()).

export type TemaId = 'mision' | 'nasa' | 'marte' | 'claro' | 'contraste' | 'noche'

export interface Tema {
  nombre: string
  texto: string
  esquema: 'dark' | 'light'
  bg: string
  panel: string
  panelSolid: string
  border: string
  text: string
  muted: string
  accent: string
  ok: string
  warn: string
  bad: string
}

export const TEMAS: Record<TemaId, Tema> = {
  mision: {
    nombre: 'Mission Control', texto: 'Dark console (default).', esquema: 'dark',
    bg: '#070a12', panel: 'rgba(10, 15, 27, 0.84)', panelSolid: '#0f1627', border: 'rgba(120, 160, 220, 0.2)',
    text: '#e6ecf7', muted: '#8d9ab5', accent: '#4fc3f7', ok: '#5fd08a', warn: '#f5b942', bad: '#ff6b66',
  },
  nasa: {
    nombre: 'NASA blue', texto: 'Deep navy with bright blue.', esquema: 'dark',
    bg: '#061633', panel: 'rgba(8, 30, 70, 0.86)', panelSolid: '#0b2350', border: 'rgba(140, 180, 255, 0.28)',
    text: '#f1f5ff', muted: '#aabde3', accent: '#6cb4ff', ok: '#5fd08a', warn: '#f5b942', bad: '#ff7a73',
  },
  marte: {
    nombre: 'Mars red', texto: 'Warm rust and orange.', esquema: 'dark',
    bg: '#170906', panel: 'rgba(38, 16, 10, 0.86)', panelSolid: '#2a120b', border: 'rgba(255, 170, 130, 0.26)',
    text: '#fbeee8', muted: '#d2aa9a', accent: '#ff8f52', ok: '#7bd88f', warn: '#ffd25a', bad: '#ff6b8b',
  },
  claro: {
    nombre: 'Light', texto: 'Bright panels for daylight.', esquema: 'light',
    bg: '#eef2f7', panel: 'rgba(255, 255, 255, 0.93)', panelSolid: '#ffffff', border: 'rgba(20, 40, 80, 0.24)',
    text: '#142033', muted: '#4a5873', accent: '#0a6fb8', ok: '#12763a', warn: '#8f5b00', bad: '#c0262d',
  },
  contraste: {
    nombre: 'High contrast', texto: 'Black and white, color-blind safe status colors with symbols.', esquema: 'dark',
    bg: '#000000', panel: 'rgba(0, 0, 0, 0.95)', panelSolid: '#000000', border: 'rgba(255, 255, 255, 0.8)',
    text: '#ffffff', muted: '#dfe6f2', accent: '#33e6ff', ok: '#5ab4ff', warn: '#ffe14d', bad: '#ff8a3d',
  },
  noche: {
    nombre: 'Night red', texto: 'Dim red for dark rooms. Status labels get a symbol.', esquema: 'dark',
    bg: '#0a0000', panel: 'rgba(22, 2, 0, 0.9)', panelSolid: '#160200', border: 'rgba(255, 70, 50, 0.32)',
    text: '#ff7060', muted: '#e85544', accent: '#ff4a35', ok: '#ff9a66', warn: '#ffc857', bad: '#ff2f4f',
  },
}

export const esTema = (v: unknown): v is TemaId => typeof v === 'string' && v in TEMAS
export const esHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

/** "#4fc3f7" → "79, 195, 247" (para rgba(var(--accent-rgb), 0.2)). */
export function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).split(', ').map((c) => {
    const s = Number(c) / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razón de contraste WCAG entre dos colores hex. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** Texto legible sobre el color de acento (botón principal). */
export const sobreAcento = (accent: string) => (contraste(accent, '#000000') >= contraste(accent, '#ffffff') ? '#04121c' : '#ffffff')

/** Escribe las variables del tema (y el acento propio, si hay) en <html>. */
export function aplicarTema(id: TemaId, acento: string | null) {
  const t = TEMAS[id]
  const accent = acento ?? t.accent
  const html = document.documentElement
  const vars: Record<string, string> = {
    '--bg': t.bg, '--panel': t.panel, '--panel-solid': t.panelSolid, '--border': t.border,
    '--text': t.text, '--muted': t.muted, '--accent': accent, '--ok': t.ok, '--warn': t.warn, '--bad': t.bad,
    '--accent-rgb': rgb(accent), '--ok-rgb': rgb(t.ok), '--warn-rgb': rgb(t.warn), '--bad-rgb': rgb(t.bad),
    '--panel-rgb': rgb(t.panelSolid), '--fg-rgb': t.esquema === 'light' ? '20, 32, 51' : '255, 255, 255',
    '--on-accent': sobreAcento(accent),
  }
  for (const [k, v] of Object.entries(vars)) html.style.setProperty(k, v)
  html.style.colorScheme = t.esquema
  html.dataset.tema = id
  html.classList.toggle('a11y-contraste', id === 'contraste')
  html.classList.toggle('a11y-simbolos', id === 'contraste' || id === 'noche')
}
