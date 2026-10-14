// Marte: rasgos grandes en sus coordenadas reales del Nomenclátor de la IAU (Olympus Mons,
// Tharsis, Valles Marineris, Hellas, Argyre, Syrtis Major, Acidalia, Utopia, casquetes...),
// relieve por pendientes y una bruma fina de polvo en el limbo. El color es estilizado.
import { useMemo } from 'react'
import { Globo, type ConfigGlobo, type PropsGlobo } from './Globo'
import { PROVISIONAL, texturasMarte, usePromesa } from './texturas'

export interface PropsMarte extends PropsGlobo {
  /** Bruma de polvo en el limbo (por defecto sí). */
  atmosfera?: boolean
}

export function Marte(props: PropsMarte) {
  const { atmosfera = true, detalle = 'alto' } = props
  const tex = usePromesa(() => texturasMarte(detalle), `marte-${detalle}`)
  const config = useMemo<ConfigGlobo>(
    () => ({
      cuerpo: 'marte',
      mapa: tex?.color ?? PROVISIONAL.marte,
      relieve: tex?.relieve ?? PROVISIONAL.relievePlano,
      nubes: null,
      bruma: { color: '#c98e64', fuerza: 0.22 },
      // La escala de altura de la atmósfera de Marte es ~11 km ≈ 0.0032 R. De día el polvo da
      // un tono caramelo; al atardecer el cielo cerca del Sol se ve azulado (Curiosity, PIA19400, 2015).
      atmosfera: atmosfera ? { color: '#d9a27a', ocaso: '#8fa8d8', intensidad: 0.55, H: 0.0032 } : null,
      alturaNubes: 0,
    }),
    [tex, atmosfera],
  )
  return <Globo config={config} props={props} />
}
