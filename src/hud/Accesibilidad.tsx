// Panel de ajustes de accesibilidad y subtítulos de los sonidos (lógica en src/accesibilidad.ts).
import { useAccesibilidad, useSubtitulos, type AjustesAccesibilidad } from '../accesibilidad'

const OPCIONES: { k: keyof AjustesAccesibilidad; titulo: string; texto: string }[] = [
  { k: 'textoGrande', titulo: 'Larger text', texto: 'Makes panels, buttons and messages bigger.' },
  { k: 'contraste', titulo: 'High contrast', texto: 'Stronger colors that work with color blindness. Status labels also get a symbol.' },
  { k: 'movimientoReducido', titulo: 'Reduced motion', texto: 'No camera shake and fewer animations.' },
  { k: 'subtitulos', titulo: 'Sound captions', texto: 'Shows a caption when an alarm, radio or other sound plays.' },
]

/** Botón que abre los ajustes. `chip` para la barra superior del juego. */
export function BotonAccesibilidad({ chip = false }: { chip?: boolean }) {
  const abrir = useAccesibilidad((s) => s.abrir)
  return (
    <button className={chip ? 'chip' : 'small plano'} onClick={() => abrir(true)} aria-haspopup="dialog">
      Accessibility
    </button>
  )
}

export function PanelAccesibilidad() {
  const a = useAccesibilidad()
  if (!a.abierto) return null
  return (
    <div className="velo" onClick={() => a.abrir(false)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="a11y-titulo" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 className="grow" id="a11y-titulo">Accessibility</h2>
          <button className="small" onClick={() => a.abrir(false)} autoFocus>Close</button>
        </div>
        <p className="mini muted">These settings are saved on this device.</p>
        <div className="stack a11y-opciones">
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
