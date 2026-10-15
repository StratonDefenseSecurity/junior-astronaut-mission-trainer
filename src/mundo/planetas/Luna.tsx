// La Luna: el mosaico en color de LROC con el relieve del altímetro LOLA (NASA SVS, CGI Moon
// Kit). Mientras llegan, o si fallan, el globo procedural: mares en sus posiciones reales (IAU),
// cráter Tycho con sus rayos y relieve de cráteres estilizado. Sin atmósfera. Gira con el modelo
// de la IAU, así que su cara visible mira a la Tierra (rotación sincrónica, con la libración real).
import { useMemo } from 'react'
import { Globo, type ConfigGlobo, type PropsGlobo } from './Globo'
import { PROVISIONAL, texturasLuna, texturasRealesLuna, useTexturasGlobo } from './texturas'

/** Exageración del relieve real de LOLA (7.6 km por píxel en el ecuador). */
const EXAGERACION_RELIEVE = 3

export function Luna(props: PropsGlobo) {
  const { detalle = 'alto' } = props
  const { real, procedural } = useTexturasGlobo('luna', `luna-${detalle}`, texturasRealesLuna, () => texturasLuna(detalle))
  const config = useMemo<ConfigGlobo>(
    () => ({
      cuerpo: 'luna',
      mapa: real?.color ?? procedural?.color ?? PROVISIONAL.luna,
      relieve: real?.relieve ?? procedural?.relieve ?? PROVISIONAL.relievePlano,
      fuerzaRelieve: real ? (EXAGERACION_RELIEVE * 40) / real.k : undefined,
      nubes: null,
      bruma: { color: '#000000', fuerza: 0 },
      atmosfera: null,
      alturaNubes: 0,
    }),
    [real, procedural],
  )
  return <Globo config={config} props={props} />
}
