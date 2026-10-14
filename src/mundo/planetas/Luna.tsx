// La Luna: mares en sus posiciones reales (IAU), cráter Tycho con sus rayos y relieve de
// cráteres estilizado. Sin atmósfera. Gira con el modelo de la IAU, así que su cara visible
// mira a la Tierra (rotación sincrónica, con la libración real).
import { useMemo } from 'react'
import { Globo, type ConfigGlobo, type PropsGlobo } from './Globo'
import { PROVISIONAL, texturasLuna, usePromesa } from './texturas'

export function Luna(props: PropsGlobo) {
  const { detalle = 'alto' } = props
  const tex = usePromesa(() => texturasLuna(detalle), `luna-${detalle}`)
  const config = useMemo<ConfigGlobo>(
    () => ({
      cuerpo: 'luna',
      mapa: tex?.color ?? PROVISIONAL.luna,
      relieve: tex?.relieve ?? PROVISIONAL.relievePlano,
      nubes: null,
      bruma: { color: '#000000', fuerza: 0 },
      atmosfera: null,
      alturaNubes: 0,
    }),
    [tex],
  )
  return <Globo config={config} props={props} />
}
