// Dosis medida a bordo de la ISS, del portal RadLab (NASA OSDR), para comparar con la de la
// tripulación. Datos archivados, consultados el 14/11/2026 con:
//   https://visualization.osdr.nasa.gov/radlab/api/?instrument=IV-TEPC&absorbed_dose_rate>0&format=tsv
// RadLab da la tasa de dosis absorbida en μGy/hora (promedio de cada día para el IV-TEPC).
// No da la dosis equivalente (mSv) de este instrumento, así que la comparación pasa la dosis de
// la tripulación a dosis absorbida con el factor de calidad que midió RAD en el crucero.
import { rangoSol } from './solHoy.js'

export interface TramoRadLab {
  instrumento: string
  /** Código de ubicación tal como lo da RadLab. */
  ubicacion: string
  desde: string
  hasta: string
  dias: number
  /** Tasa de dosis absorbida, μGy/hora: promedio de los valores diarios, mínimo y máximo. */
  media: number
  min: number
  max: number
}

export const RADLAB_URL = 'https://visualization.osdr.nasa.gov/radlab/api/?instrument=IV-TEPC&absorbed_dose_rate>0&format=tsv'

/** Los dos tramos completos (un valor por día, sin huecos) más largos de la serie. */
export const RADLAB_ISS: TramoRadLab[] = [
  { instrumento: 'IV-TEPC', ubicacion: 'NOD3FD3', desde: '2016-04-08', hasta: '2016-05-03', dias: 26, media: 12.533, min: 11.831, max: 14.989 },
  { instrumento: 'IV-TEPC', ubicacion: 'COL1A2', desde: '2017-02-24', hasta: '2017-03-14', dias: 19, media: 12.464, min: 12.051, max: 13.385 },
]

/** El tramo que usa la comparación. */
export const ISS_REF = RADLAB_ISS[0]
/** Dosis absorbida por día en la ISS según ese tramo, mGy. */
export const ISS_MGY_DIA = (ISS_REF.media * 24) / 1000

/** Factor de calidad medido por RAD en el crucero a Marte (Zeitlin et al. 2013, resumido en Hassler et al. 2014): mSv = mGy × Q. */
export const Q_CRUCERO_RAD = 3.82

/** Días a bordo de la ISS que dan la misma dosis absorbida que `mSv` de la tripulación. */
export const diasEnISS = (mSv: number) => mSv / Q_CRUCERO_RAD / ISS_MGY_DIA

export const textoDiasISS = (mSv: number) => {
  const d = diasEnISS(mSv)
  return d < 1 ? 'less than 1 day' : `${Math.round(d)} ${Math.round(d) === 1 ? 'day' : 'days'}`
}

/** Fuente corta para mostrar junto al número. */
export const FUENTE_ISS = `archived NASA RadLab data, ${ISS_REF.instrumento} detector, ${rangoSol(ISS_REF.desde, ISS_REF.hasta)}`
