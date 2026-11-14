// Notas "Real science" con estudios del NASA Open Science Data Repository (shared/osdr.ts):
// una línea en la estación donde importa (gimnasio, literas, huerto, refugio) y la lista en el informe final.
import { ESTUDIOS_OSDR, OSDR_BY_ID, type OsdrId } from '@shared/osdr'
import './glosario.css'

/** Una línea con la frase del estudio y el enlace a su ficha en OSDR. */
export function NotaOsdr({ id }: { id: OsdrId }) {
  const e = OSDR_BY_ID[id]
  return (
    <p className="ciencia-real">
      <b>Real science:</b> {e.frase}{' '}
      <a href={e.url} target="_blank" rel="noreferrer noopener" title={e.titulo}>
        NASA OSDR {e.id}
      </a>
    </p>
  )
}

/** Sección del informe final: los estudios reales detrás del cuerpo, las plantas y la radiación. */
export function CienciaRealInforme() {
  return (
    <>
      <h3>Real science</h3>
      <p className="mini muted">What really happened to the body and the plants in space, from studies in NASA's Open Science Data Repository.</p>
      <ul className="informe-objetivos">
        {ESTUDIOS_OSDR.map((e) => (
          <li key={e.id}>
            {e.frase}{' '}
            <span className="mini muted">
              {e.mision}.{' '}
              <a href={e.url} target="_blank" rel="noreferrer noopener" title={e.titulo}>
                {e.id}
              </a>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
