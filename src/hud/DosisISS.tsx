// La dosis de la tripulación comparada con los días a bordo de la ISS, con datos reales del
// portal RadLab (NASA OSDR, archivados). Va en el informe final.
import { ISS_MGY_DIA, ISS_REF, Q_CRUCERO_RAD, RADLAB_URL, textoDiasISS } from '@shared/radlab'
import { rangoSol } from '@shared/solHoy'
import type { RoomState } from '@shared/types'
import { dosisTexto } from '@shared/medidores'

export function DosisISS({ sala }: { sala: RoomState }) {
  const crew = sala.jugadores.filter((j) => j.rol)
  if (!crew.length) return null
  const media = crew.reduce((s, j) => s + j.vit.dosis, 0) / crew.length
  const mayor = crew.reduce((a, j) => (j.vit.dosis > a.vit.dosis ? j : a))
  return (
    <>
      <h3>Radiation compared with the ISS</h3>
      <p className="mini" style={{ margin: 0 }}>
        Your crew&apos;s average dose, {dosisTexto(media)}, equals about <strong>{textoDiasISS(media)} aboard the International Space Station</strong>.
        {crew.length > 1 ? ` The highest, ${mayor.nombre} with ${dosisTexto(mayor.vit.dosis)}, equals ${textoDiasISS(mayor.vit.dosis)}.` : ''}
      </p>
      <p className="mini muted" style={{ margin: 0 }}>
        ISS data (archived): NASA RadLab, {ISS_REF.instrumento} detector at location {ISS_REF.ubicacion}, {rangoSol(ISS_REF.desde, ISS_REF.hasta)}: on average{' '}
        {ISS_REF.media.toFixed(1)} μGy per hour ({ISS_MGY_DIA.toFixed(2)} mGy per day) of absorbed dose. RadLab gives absorbed dose, so your dose in mSv is turned into
        absorbed dose with the quality factor {Q_CRUCERO_RAD} that Curiosity&apos;s RAD measured on the way to Mars (Zeitlin et al. 2013; Hassler et al. 2014).{' '}
        <a href={RADLAB_URL} target="_blank" rel="noreferrer noopener">RadLab data</a>
      </p>
    </>
  )
}
