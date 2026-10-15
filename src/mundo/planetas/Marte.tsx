// Marte: el mosaico en color de Viking (USGS MDIM2.1) con el relieve del altímetro MOLA, si las
// imágenes están en public/texturas (ver scripts/texturas-reales.mjs). Si no, o mientras llegan,
// el globo procedural: rasgos grandes en sus coordenadas reales del Nomenclátor de la IAU
// (Olympus Mons, Tharsis, Valles Marineris, Hellas, Argyre, Syrtis Major, Acidalia, Utopia,
// casquetes...) con color estilizado. Encima, una bruma fina de polvo en el limbo.
import { useMemo } from 'react'
import { Globo, type ConfigGlobo, type PropsGlobo } from './Globo'
import { PROVISIONAL, texturasMarte, texturasRealesMarte, useTexturasGlobo } from './texturas'

export interface PropsMarte extends PropsGlobo {
  /** Bruma de polvo en el limbo (por defecto sí). */
  atmosfera?: boolean
}

/** Exageración del relieve real: con la pendiente verdadera, a 10 km por píxel, se vería plano. */
const EXAGERACION_RELIEVE = 5

export function Marte(props: PropsMarte) {
  const { atmosfera = true, detalle = 'alto' } = props
  const { real, procedural } = useTexturasGlobo('marte', `marte-${detalle}`, texturasRealesMarte, () => texturasMarte(detalle))
  const config = useMemo<ConfigGlobo>(
    () => ({
      cuerpo: 'marte',
      mapa: real?.color ?? procedural?.color ?? PROVISIONAL.marte,
      relieve: real?.relieve ?? procedural?.relieve ?? PROVISIONAL.relievePlano,
      // La textura real guarda 128 + pendiente × k; el shader divide por 40 (ESCALA_RELIEVE).
      fuerzaRelieve: real ? (EXAGERACION_RELIEVE * 40) / real.k : undefined,
      nubes: null,
      bruma: { color: '#c98e64', fuerza: 0.22 },
      // La escala de altura de la atmósfera de Marte es ~11 km ≈ 0.0032 R. De día el polvo da
      // un tono rosado caramelo; al atardecer el cielo cerca del Sol se ve azulado (Curiosity, PIA19400, 2015).
      atmosfera: atmosfera ? { color: '#dfa184', ocaso: '#8fa8d8', intensidad: 0.6, H: 0.0032 } : null,
      alturaNubes: 0,
    }),
    [real, procedural, atmosfera],
  )
  return <Globo config={config} props={props} />
}
