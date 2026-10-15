// La Tierra: imágenes reales de NASA (Blue Marble, Black Marble y nubes) con la máscara de agua de
// las costas de Natural Earth; día y noche según el Sol, luces de las ciudades solo de noche,
// brillo del océano, nubes un poco por encima de la superficie (con sus sombras) y halo azul de
// la atmósfera. Mientras llegan las imágenes, o si fallan, se usa el globo procedural de
// generadores.ts, con costas reales y colores estilizados (ver README.md).
import { useMemo } from 'react'
import { Globo, type ConfigGlobo, type PropsGlobo } from './Globo'
import { PROVISIONAL, texturasRealesTierra, texturasTierra, useTexturasGlobo } from './texturas'

export interface PropsTierra extends PropsGlobo {
  /** Capa de nubes (por defecto sí). */
  nubes?: boolean
  /** Halo de la atmósfera (por defecto sí). */
  atmosfera?: boolean
}

export function Tierra(props: PropsTierra) {
  const { nubes = true, atmosfera = true, detalle = 'alto' } = props
  const { real, procedural } = useTexturasGlobo('tierra', `tierra-${detalle}`, texturasRealesTierra, () => texturasTierra(detalle))
  const config = useMemo<ConfigGlobo>(
    () => ({
      cuerpo: 'tierra',
      mapa: real?.dia ?? procedural?.color ?? PROVISIONAL.tierra,
      relieve: PROVISIONAL.relievePlano,
      nubes: nubes ? (real?.nubes ?? procedural?.nubes ?? PROVISIONAL.sinNubes) : null,
      luces: real?.noche,
      agua: real?.agua,
      bruma: { color: '#5d9cff', fuerza: real ? 0.26 : 0.32 },
      // Escala de altura del brillo: ~0.0035 R ≈ 22 km. La real del aire es ~8 km; se exagera
      // un poco para que el limbo azul se vea en pantalla (estilizado).
      atmosfera: atmosfera ? { color: '#4a8dff', ocaso: '#ff8a4c', intensidad: 1.5, H: 0.0035 } : null,
      // Nubes a ~0.004 R ≈ 25 km (las reales llegan a 10-15 km; se exagera un poco el relieve).
      alturaNubes: 0.004,
    }),
    [real, procedural, nubes, atmosfera],
  )
  return <Globo config={config} props={props} />
}
