// Globo de la Tierra, la Luna o Marte para las vistas lejanas (ventana, órbita), con las texturas
// y la rotación real de src/mundo/planetas. Se coloca en el marco celeste: el grupo padre no debe
// estar girado respecto de él (el giro de la ventana se aplica por fuera).
import type { Cuerpo } from './cielo/astro'
import { Luna, Marte, Tierra, type Marcador } from './planetas'

export function Globo({ cuerpo, radio, fecha, marcadores }: { cuerpo: Cuerpo; radio: number; fecha: Date; marcadores?: readonly Marcador[] }) {
  if (cuerpo === 'Tierra') return <Tierra radio={radio} fecha={fecha} marcadores={marcadores} detalle="alto" />
  if (cuerpo === 'Marte') return <Marte radio={radio} fecha={fecha} marcadores={marcadores} detalle="alto" />
  if (cuerpo === 'Luna') return <Luna radio={radio} fecha={fecha} detalle="bajo" />
  return null
}
