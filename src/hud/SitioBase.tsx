// Tarjeta "Your base site" de la sesión informativa: imagen real de Mars Trek alrededor de la base
// (public/sitios/, generadas con scripts/sitios-marte.py; créditos en public/texturas/CREDITOS.md),
// coordenadas y por qué se eligió el sitio, solo con hechos que ya tienen fuente en FUENTES.
import { useState } from 'react'
import { escenarioDe } from '@shared/escenarios'
import { SITE_BY_ID, type RoomState } from '@shared/types'
import { SITIOS_MARTE } from '../mundo/cieloMarte'
import './glosario.css'

type SitioId = 'gale' | 'jezero' | 'utopia'
const IDS: SitioId[] = ['gale', 'jezero', 'utopia']

/** Por qué se elige cada sitio, en una línea para niños (fuentes: Mars weather, Perseverance in Jezero, Buried ice in Utopia Planitia). */
const POR_QUE: Record<SitioId, string> = {
  gale: 'The Curiosity rover works here, and its weather station measured the real weather you will live with in the game.',
  jezero: 'Long ago this crater held a lake with a river delta, and the Perseverance rover has collected rock samples here since 2021.',
  utopia: 'A radar on the Mars Reconnaissance Orbiter found ice buried under this plain with as much water as Lake Superior, and your crew can dig it out for water.',
}

/** Lado de cada recorte en km (scripts/sitios-marte.py). */
const LADO_KM: Record<SitioId, number> = { gale: 180, jezero: 70, utopia: 120 }

const grados = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`

export function SitioBase({ sala }: { sala: RoomState }) {
  const fijo = (sala.sitio ?? escenarioDe(sala.escenario).sitio ?? null) as SitioId | null
  const [visto, setVisto] = useState<SitioId>(fijo ?? 'gale')
  const id = fijo ?? visto
  const s = SITE_BY_ID[id]
  const c = SITIOS_MARTE[id]
  return (
    <div className="stack" style={{ gap: 6 }}>
      <h3 style={{ margin: 0 }}>{fijo ? 'Your base site' : 'Where could your base be?'}</h3>
      {!fijo && <p className="mini muted" style={{ margin: 0 }}>You choose the landing site from Mars orbit. These are the three options.</p>}
      <div className="sitio-base">
        <figure>
          <div className="sitio-foto">
            <img
              src={`${import.meta.env.BASE_URL}sitios/${id}.jpg`}
              alt={`View from orbit of ${s.nombre}, about ${LADO_KM[id]} km across, with the base point in the center`}
              width={420}
              height={420}
              loading="lazy"
            />
          </div>
          <figcaption>
            Image: <a href="https://trek.nasa.gov/mars/" target="_blank" rel="noreferrer noopener">NASA Mars Trek</a>. Mars Odyssey THEMIS daytime
            infrared, about {LADO_KM[id]} km across. Sunny slopes look bright.
          </figcaption>
        </figure>
        <div>
          <strong>{s.nombre}</strong>
          <p className="mini mono">{grados(c.lat, 'N', 'S')}, {grados(c.lon, 'E', 'W')}</p>
          <p className="mini">{POR_QUE[id]}</p>
          <p className="mini muted">The yellow ring marks where the base goes in the game.</p>
          {!fijo && (
            <div className="sitio-opciones" role="group" aria-label="Landing site options">
              {IDS.map((o) => (
                <button key={o} className={o === id ? 'small primary' : 'small'} aria-pressed={o === id} onClick={() => setVisto(o)}>
                  {SITE_BY_ID[o].nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
