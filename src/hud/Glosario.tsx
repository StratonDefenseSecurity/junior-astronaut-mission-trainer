// Glosario para niños: un chip "?" junto a las palabras difíciles de los medidores, que abre una
// definición de una frase, y la lista completa en el panel de fuentes. Las definiciones están en
// shared/glosario.ts. El globo se dibuja en document.body para no mover ni recortar el HUD.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GLOSARIO, TERMINO_BY_ID, type TerminoId } from '@shared/glosario'
import './glosario.css'

export function Termino({ id }: { id: TerminoId }) {
  const t = TERMINO_BY_ID[id]
  const boton = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!pos) return
    const cerrar = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e.target === boton.current) return
      setPos(null)
    }
    window.addEventListener('pointerdown', cerrar, true)
    window.addEventListener('keydown', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      window.removeEventListener('pointerdown', cerrar, true)
      window.removeEventListener('keydown', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [pos])

  const alternar = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (pos) return setPos(null)
    const r = boton.current?.getBoundingClientRect()
    if (!r) return
    const ancho = 260
    const x = Math.max(8, Math.min(window.innerWidth - ancho - 8, r.left - 8))
    const y = r.bottom + 120 > window.innerHeight ? Math.max(8, r.top - 110) : r.bottom + 6
    setPos({ x, y })
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        className="termino"
        aria-label={`What is ${t.palabra}?`}
        aria-expanded={pos !== null}
        title={t.definicion}
        onClick={alternar}
      >
        ?
      </button>
      {pos &&
        createPortal(
          <div className="termino-globo" role="tooltip" style={{ left: pos.x, top: pos.y }}>
            <b>{t.palabra}</b>
            {t.definicion}
          </div>,
          document.body,
        )}
    </>
  )
}

/** Lista completa, para el panel "Where the data comes from". */
export function GlosarioLista() {
  return (
    <dl className="glosario">
      {GLOSARIO.map((t) => (
        <div key={t.id}>
          <dt>{t.palabra}</dt>
          <dd>{t.definicion}</dd>
        </div>
      ))}
    </dl>
  )
}
