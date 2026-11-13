// Guía de construcción de la base: cómo se montaría de verdad una base en Marte según los
// estudios de la NASA (DRA 5.0, energía de superficie, blindaje de regolito, inflables, pista y
// antena), qué fases hace la tripulación en el juego, quién y dónde, y qué falla si se salta una.
// También el resumen de las obras de la base en operación y los datos del enlace con la Tierra.
import { C } from '@shared/ciencia'
import { OBRAS, PROC_BY_ID, enlaceDirecto, obraHecha, pasoActual, pasoDeRele, procPorId, tierraEnCielo } from '@shared/procedimientos'
import { type Player, type Role, type RoomState } from '@shared/types'
import { ESTACION_BY_ID } from '../mundo/mapa'
import { useStore } from '../store'
import { roles } from './comun'

interface Fase {
  titulo: string
  /** Lo que se hace de verdad, en pocas frases. */
  real: string
  /** Quién lo hace de verdad y dónde. */
  quien: string
  /** Si lo hace la tripulación en el juego: sí, en parte o no. */
  juego: 'si' | 'parte' | 'no'
  /** Lo que hace la tripulación en el juego, con sus roles y su estación. */
  enJuego?: string
  roles?: Role[]
  estacion?: string
  /** Lo que sale mal si se salta. */
  saltar: string
  hecho?: (s: RoomState) => boolean
}

const tareaHecha = (id: string) => (s: RoomState) => Boolean(s.ensamblaje.hechas[id])
const obra = (id: string) => (s: RoomState) => obraHecha(s, id)

const GRUPOS: { titulo: string; fases: Fase[] }[] = [
  {
    titulo: 'Before the crew leaves Earth',
    fases: [
      {
        titulo: 'Train in an analog base',
        real: 'Crews rehearse on Earth first. In NASA CHAPEA, four people live for a year in Mars Dune Alpha, a habitat 3D-printed by ICON in Houston.',
        quien: 'The crew and NASA, on Earth.',
        juego: 'si',
        enJuego: 'This trainer is your analog base.',
        saltar: 'Problems with food, tools or teamwork show up on Mars, where no help can come.',
      },
      {
        titulo: 'Send the cargo first',
        real: 'Cargo landers go one launch window ahead, about 26 months. They carry the power plant, the propellant plant and the ascent vehicle.',
        quien: 'Mission Control and robots, before the crew launches.',
        juego: 'no',
        enJuego: 'In the game your cargo lands with you.',
        saltar: 'The crew would land without a ride home waiting for them.',
      },
      {
        titulo: 'Put the power plant far away',
        real: 'Robots unload the fission power unit and set it up more than 1 km from the habitat. The soil and the distance stop its radiation.',
        quien: 'Robots, driven from Earth.',
        juego: 'parte',
        enJuego: 'If you brought the reactor, you choose where it goes while you unload the cargo.',
        roles: ['logistica', 'piloto'],
        estacion: 'carga',
        saltar: 'Next to the habitat, the reactor adds radiation day and night.',
        hecho: tareaHecha('carga'),
      },
      {
        titulo: 'Make propellant and supplies on Mars',
        real: 'The power runs an ISRU plant that turns the CO2 air into oxygen for the ascent rocket and for the crew.',
        quien: 'Robots, before the crew launches.',
        juego: 'parte',
        enJuego: 'At a site with ice, the Ice Extractor is installed with life support and makes water.',
        roles: ['sistemas', 'comandante'],
        estacion: 'soporte',
        saltar: 'With no propellant in the ascent vehicle, there is no way home.',
        hecho: (s) => s.sistemas.some((x) => x.id === 'isru' && x.instalado),
      },
      {
        titulo: 'Check everything, then launch the crew',
        real: 'The crew leaves Earth only after the cargo is on Mars and its systems pass their checkout.',
        quien: 'Mission Control.',
        juego: 'no',
        saltar: 'The crew would arrive at a base that may not work.',
      },
    ],
  },
  {
    titulo: 'Landing and first days',
    fases: [
      { titulo: 'Choose the landing site', real: 'From orbit, the crew confirms a site with good light, safe ground and, ideally, ice.', quien: 'Pilot and commander, from orbit.', juego: 'si', roles: ['piloto', 'comandante'], estacion: 'puente', saltar: 'A bad site costs water, power or safety for the whole stay.', hecho: (s) => s.tAterrizaje > 0 },
      { titulo: 'Deploy the solar arrays', real: 'Roll-out panels unroll on their own. They face the equator, tilted about as much as the latitude.', quien: 'Two crew members outside, in suits.', juego: 'si', roles: ['logistica', 'piloto'], estacion: 'campoSolar', saltar: 'No daytime power: the batteries run down and life support stops.', hecho: tareaHecha('paneles') },
      { titulo: 'Unload the cargo', real: 'A light crane lowers each pallet slowly, with a guide rope against the swing.', quien: 'Two crew members outside, in suits.', juego: 'si', roles: ['logistica', 'piloto'], estacion: 'carga', saltar: 'The equipment stays on the lander and cannot be used.', hecho: tareaHecha('carga') },
      { titulo: 'Connect surface power', real: 'The circuit is locked out, then powered from the source toward the loads, one stage at a time.', quien: 'Systems and the commander, inside.', juego: 'si', roles: ['sistemas', 'comandante'], estacion: 'energia', saltar: 'A live direct current connector can arc and burn. Power up out of order and spikes damage equipment.', hecho: tareaHecha('energia') },
      { titulo: 'Start life support', real: 'Cooling first, then the water recycler, the CO2 scrubber and the oxygen generator, set for the crew size.', quien: 'Systems and the commander, inside.', juego: 'si', roles: ['sistemas', 'comandante'], estacion: 'soporte', saltar: 'An oxygen generator started dry is damaged, and CO2 builds up.', hecho: tareaHecha('soporte') },
      { titulo: 'Check the airlock and the hull', real: 'A pressure test shows any leak. Photos of the hull show dents from the landing.', quien: 'Systems, inside and outside.', juego: 'si', roles: ['sistemas'], estacion: 'esclusa', saltar: 'A slow leak empties the air tanks, and a damaged hull loses heat.', hecho: tareaHecha('revisionExt') },
    ],
  },
  {
    titulo: 'Building out the base',
    fases: [
      { titulo: 'Deploy the inflatable module', real: 'Like TransHab and BEAM, it travels folded. It is inflated in short bursts, checked for leaks for days, and only then opened.', quien: 'Logistics outside, then Systems at the hatch.', juego: 'si', roles: ['logistica', 'sistemas'], estacion: 'modulo', saltar: 'A fast fill can stall or strain the fabric. Skip the leak check and the module leaks slowly.', hecho: obra('inflable') },
      { titulo: 'Shield the shelter with regolith', real: 'Bags of soil on the roof. About 15 cm gives most of the protection soil can give.', quien: 'Two crew members outside, in suits.', juego: 'si', roles: ['logistica', 'piloto'], estacion: 'techoRefugio', saltar: 'In a solar storm the shelter lets through about a third more dose than with 15 cm of soil.', hecho: obra('regolito') },
      { titulo: 'Prepare the landing pad', real: 'A cleared, marked circle about 1 km away, so the next lander does not blast the base.', quien: 'Pilot and Logistics outside, then the commander gives the go.', juego: 'si', roles: ['piloto', 'logistica'], estacion: 'pista', saltar: 'A lander close to the base sandblasts the panels and the hull, as Apollo 12 did to Surveyor 3.', hecho: obra('pista') },
      { titulo: 'Point the high-gain antenna', real: 'The dish is pointed at Earth with the ephemeris and then follows it as Mars turns.', quien: 'Systems or the pilot: the mast outside, the pointing from Comms.', juego: 'si', roles: ['sistemas', 'piloto'], estacion: 'antena', saltar: 'Messages from Earth wait for an orbiter pass, up to half a sol.', hecho: obra('antenaAlta') },
    ],
  },
]

const ETIQUETA = { si: 'You do it in the game', parte: 'Partly in the game', no: 'Not in the game' } as const

/** Botón que abre la guía, desde la página principal o desde el laboratorio. */
export function BotonGuia() {
  const abrir = useStore((s) => s.abrirEstacion)
  return (
    <button className="small" onClick={() => abrir('guia', true)}>
      Base Building Guide
    </button>
  )
}

/** La guía entera: las fases reales, cuáles hace la tripulación, quién y qué falla si se saltan. */
export function GuiaBase({ sala }: { sala: RoomState; yo: Player }) {
  const setFuentes = useStore((s) => s.setFuentes)
  return (
    <>
      <p className="mini">
        How NASA studies plan to set up a base on Mars, phase by phase. Some phases are done by robots before anyone leaves Earth. The rest is your crew&apos;s work.
      </p>
      {GRUPOS.map((g) => (
        <section key={g.titulo} className="seccion">
          <h4>{g.titulo}</h4>
          {g.fases.map((f) => {
            const hecho = f.hecho?.(sala)
            return (
              <div key={f.titulo} className="opcion-base">
                <div className="row" style={{ gap: 6 }}>
                  <strong className="grow">
                    {f.juego !== 'no' && f.hecho ? (hecho ? '✓ ' : '○ ') : ''}
                    {f.titulo}
                  </strong>
                  <span className={`mini ${f.juego === 'no' ? 'muted' : 'ok'}`}>{ETIQUETA[f.juego]}</span>
                </div>
                <p className="mini">{f.real}</p>
                <p className="mini muted">For real: {f.quien}</p>
                {(f.enJuego || f.roles) && (
                  <p className="mini">
                    In the game: {f.enJuego ? `${f.enJuego} ` : ''}
                    {f.roles ? `${roles(f.roles)}${f.estacion ? ` at ${ESTACION_BY_ID[f.estacion]?.nombre ?? f.estacion}` : ''}.` : ''}
                  </p>
                )}
                <p className="mini warn">If it is skipped: {f.saltar}</p>
              </div>
            )
          })}
        </section>
      ))}
      <div className="row" style={{ gap: 6 }}>
        <button className="small" onClick={() => setFuentes(true)}>
          Sources
        </button>
        <span className="mini muted">Each fact comes from a NASA study or mission. What the game simplifies is listed there too.</span>
      </div>
    </>
  )
}

/** Por qué no se puede empezar ahora una obra, o en qué va. */
function estadoObra(sala: RoomState, id: string): { texto: string; tono: string } {
  if (obraHecha(sala, id)) return { texto: 'Done.', tono: 'ok' }
  const e = sala.procedimientos?.[id]
  const p = PROC_BY_ID[id]
  if (e && e.paso > 0) return { texto: `In progress: step ${pasoActual(sala, p) + 1} of ${p.pasos.length}.`, tono: '' }
  if (sala.fase !== 'base') return { texto: 'Opens once the base is running.', tono: 'muted' }
  const a = sala.ambiente
  if (a.tormentaSolar || a.tormentaPolvo) return { texto: 'Wait for the storm to end.', tono: 'warn' }
  if (a.hora <= 7 || a.hora >= 17) return { texto: 'Starts in daylight, from 7:00 to 17:00.', tono: 'muted' }
  return { texto: 'Ready to start.', tono: 'ok' }
}

/** Las obras de la base en operación, en la página principal, con su estación y la guía. */
export function ObrasBase({ sala, yo }: { sala: RoomState; yo: Player }) {
  const abrir = useStore((s) => s.abrirEstacion)
  const cerca = useStore((s) => s.cerca)
  if (sala.fase !== 'base' && sala.fase !== 'ensamblaje') {
    return (
      <div className="row" style={{ gap: 6 }}>
        <BotonGuia />
      </div>
    )
  }
  return (
    <section className="seccion">
      <div className="row" style={{ gap: 6 }}>
        <h4 className="grow">Build out the base</h4>
        <BotonGuia />
      </div>
      <div className="opciones-base">
        {OBRAS.map((id) => {
          const p = procPorId(id, sala)!
          const est = p.pasos[Math.min(pasoActual(sala, p), p.pasos.length - 1)].estacion
          const mia = yo.rol !== null && p.roles.includes(yo.rol)
          const r = estadoObra(sala, id)
          return (
            <div key={id} className={`opcion-base ${mia ? 'mia' : ''}`}>
              <div className="row" style={{ gap: 6 }}>
                <strong className="grow">{p.titulo}</strong>
                <span className="mini muted">{roles(p.roles)}</span>
              </div>
              <p className="mini muted">{p.resumen}</p>
              <p className={`mini ${r.tono}`}>{r.texto}</p>
              {!obraHecha(sala, id) && sala.fase === 'base' && (
                <button className="small" onClick={() => abrir(est, cerca !== est)}>
                  {ESTACION_BY_ID[est]?.nombre ?? est}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Lo que se ve en las estaciones nuevas de las obras (el procedimiento va aparte). */
export function InfoObra({ sala, id }: { sala: RoomState; id: string }) {
  const ef = sala.efectos ?? {}
  switch (id) {
    case 'modulo':
      return <p className="mini">{ef.modulo ? `Inflated and open: ${C.MODULO_M3} m³ more, with private sleeping space. Sleep recovers 10% faster.` : `A folded module the size of BEAM. Inflated, it gives ${C.MODULO_M3} m³ of private space.`}</p>
    case 'techoRefugio':
      return <p className="mini">{ef.regolitoCm ? `${ef.regolitoCm} cm of regolith bags over the Storm Shelter.` : 'The hull over the Storm Shelter has no regolith yet. About 15 cm of soil gives most of the protection.'}</p>
    case 'pista':
      return <p className="mini">{ef.carguero ? `Pad marked ${ef.pistaM} m from the base. The cargo lander stands on it.` : 'The next cargo lander needs a cleared, marked pad. NASA studies keep landers about 1 km apart.'}</p>
    default:
      return null
  }
}

/** El enlace con la Tierra en la base: directo por la antena o esperando a un orbitador. */
export function InfoEnlace({ sala }: { sala: RoomState }) {
  if (sala.fase !== 'base') return null
  const t = tierraEnCielo(sala)
  const directo = enlaceDirecto(sala)
  const esperan = (sala.radio ?? []).filter((m) => m.llega <= sala.t).length
  const ef = sala.efectos ?? {}
  const apuntada = obraHecha(sala, 'antenaAlta')
  return (
    <>
      <p className="mini">
        Earth now: azimuth {Math.round(t.az) % 360}°, {t.el >= 0 ? `${Math.round(t.el)}° above the horizon` : 'below the horizon'}, {Math.round(t.elongacion)}° from the Sun.
      </p>
      <p className={`mini ${directo ? 'ok' : ''}`}>
        {directo
          ? 'Direct link through the high-gain antenna.'
          : apuntada && !ef.antenaSigue
            ? 'The high-gain antenna does not follow Earth. Messages wait for an orbiter pass.'
            : apuntada && t.el <= 0
              ? 'Earth is below the horizon. Messages wait for an orbiter pass.'
              : `No direct link. Messages from Earth wait for an orbiter pass, at about ${C.HORAS_RELE.map((h) => `${h}:00`).join(' and ')}.`}
        {!directo && pasoDeRele(sala.ambiente.hora) ? ' An orbiter is passing now.' : ''}
        {esperan > 0 ? ` ${esperan} message(s) waiting.` : ''}
      </p>
    </>
  )
}
