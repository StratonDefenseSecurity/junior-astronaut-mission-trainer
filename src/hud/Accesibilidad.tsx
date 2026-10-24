// Panel de ajustes: temas de color, accesibilidad y subtítulos de los sonidos (lógica en
// src/accesibilidad.ts y src/temas.ts).
import { useEffect, useRef } from 'react'
import { useAccesibilidad, useSubtitulos, type AjustesAccesibilidad } from '../accesibilidad'
import { contraste, sobreAcento, TEMAS, type TemaId } from '../temas'

const OPCIONES: { k: keyof AjustesAccesibilidad; titulo: string; texto: string }[] = [
  { k: 'textoGrande', titulo: 'Larger text', texto: 'Makes panels, buttons and messages bigger.' },
  { k: 'movimientoReducido', titulo: 'Reduced motion', texto: 'No camera shake and fewer animations.' },
  { k: 'subtitulos', titulo: 'Sound captions', texto: 'Shows a caption when an alarm, radio or other sound plays.' },
]

/** Botones que abren los ajustes (colores o accesibilidad). `chip` para la barra superior del juego. */
export function BotonAccesibilidad({ chip = false }: { chip?: boolean }) {
  const abrir = useAccesibilidad((s) => s.abrir)
  const clase = chip ? 'chip' : 'small plano'
  return (
    <>
      <button type="button" className={clase} onClick={() => abrir(true, 'colores')} aria-haspopup="dialog" title="Interface colors">
        Theme
      </button>
      <button type="button" className={clase} onClick={() => abrir(true, 'ajustes')} aria-haspopup="dialog">
        Accessibility
      </button>
    </>
  )
}

/** Tarjeta de un tema con vista previa pintada con sus propios colores. */
function TarjetaTema({ id, activo, elegir }: { id: TemaId; activo: boolean; elegir: () => void }) {
  const t = TEMAS[id]
  return (
    <button className={activo ? 'tema activo' : 'tema'} onClick={elegir} aria-pressed={activo}>
      <span className="tema-vista" style={{ background: t.panelSolid, color: t.text, borderColor: t.border, outline: `3px solid ${t.bg}` }} aria-hidden>
        <strong style={{ color: t.text }}>Mission status</strong>
        <span style={{ color: t.muted }}>Oxygen 98%</span>
        <span className="estados">
          <span style={{ color: t.ok }}>OK</span>
          <span style={{ color: t.warn }}>WARN</span>
          <span style={{ color: t.bad }}>ALERT</span>
        </span>
        <span className="boton" style={{ background: t.accent, color: sobreAcento(t.accent) }}>Go</span>
      </span>
      <strong>{t.nombre}</strong>
      <small>{t.texto}</small>
    </button>
  )
}

function Colores() {
  const { tema, acento, elegirTema, elegirAcento } = useAccesibilidad()
  const t = TEMAS[tema]
  const actual = acento ?? t.accent
  const bajo = contraste(actual, t.panelSolid) < 3
  return (
    <section className="stack" aria-labelledby="temas-titulo">
      <h3 id="temas-titulo" style={{ margin: 0 }}>Colors</h3>
      <div className="temas" role="group" aria-label="Color theme">
        {(Object.keys(TEMAS) as TemaId[]).map((id) => (
          <TarjetaTema key={id} id={id} activo={id === tema} elegir={() => elegirTema(id)} />
        ))}
      </div>
      <div className="acento">
        <label className="row" style={{ gap: 8 }}>
          <span>Accent color</span>
          <input type="color" value={actual} onChange={(e) => elegirAcento(e.target.value)} />
        </label>
        {acento && <button className="small plano" onClick={() => elegirAcento(null)}>Use theme accent</button>}
        {bajo && <span className="mini" style={{ color: 'var(--warn)' }}>Hard to see with this theme. Try a {t.esquema === 'light' ? 'darker' : 'brighter'} color.</span>}
      </div>
    </section>
  )
}

export function PanelAccesibilidad() {
  const a = useAccesibilidad()
  const ajustes = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (a.abierto && a.seccion === 'ajustes') ajustes.current?.scrollIntoView({ block: 'nearest' })
  }, [a.abierto, a.seccion])
  if (!a.abierto) return null
  return (
    <div className="velo" onClick={() => a.abrir(false)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="a11y-titulo" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 className="grow" id="a11y-titulo">Theme &amp; accessibility</h2>
          <button className="small" onClick={() => a.abrir(false)} autoFocus>Close</button>
        </div>
        <p className="mini muted">These settings are saved on this device.</p>
        <Colores />
        <h3 style={{ margin: '6px 0 0' }}>Accessibility</h3>
        <div className="stack a11y-opciones" ref={ajustes}>
          {OPCIONES.map((o) => (
            <label key={o.k} className="a11y-opcion">
              <input type="checkbox" checked={a[o.k]} onChange={(e) => a.cambiar(o.k, e.target.checked)} />
              <span>
                <strong>{o.titulo}</strong>
                <small>{o.texto}</small>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Subtítulos de los efectos de sonido, abajo al centro. */
export function Subtitulos() {
  const lista = useSubtitulos((s) => s.lista)
  if (lista.length === 0) return null
  return (
    <div className="subtitulos" role="status" aria-live="polite">
      {lista.map((s) => (
        <div key={s.id}>[{s.texto}]</div>
      ))}
    </div>
  )
}
