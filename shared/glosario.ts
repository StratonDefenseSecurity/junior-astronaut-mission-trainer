// Glosario para niños de 7 a 12 años: una frase por palabra difícil del juego.
// Las cifras salen de las constantes del juego (shared/ciencia.ts), que ya tienen su fuente.
import { C } from './ciencia'

export type TerminoId = 'sol' | 'microgravedad' | 'dosis' | 'llamarada' | 'particulas' | 'eva' | 'esclusa' | 'kwh' | 'depurador' | 'ventana'

export interface Termino {
  id: TerminoId
  /** La palabra tal como aparece en el juego. */
  palabra: string
  definicion: string
}

const solH = Math.floor(C.SOL_S / 3600)
const solMin = Math.floor((C.SOL_S % 3600) / 60)

export const GLOSARIO: Termino[] = [
  {
    id: 'sol',
    palabra: 'Sol',
    definicion: `A sol is one day on Mars: it lasts ${solH} hours and ${solMin} minutes, a little longer than a day on Earth.`,
  },
  {
    id: 'microgravedad',
    palabra: 'Microgravity',
    definicion: 'Microgravity is the floating feeling in a spaceship: you and the ship fall around the planet together, so nothing seems to weigh anything and your muscles and bones work less.',
  },
  {
    id: 'dosis',
    palabra: 'Radiation dose (mSv)',
    definicion: `A radiation dose says how much radiation your body has taken in; it is counted in millisieverts (mSv), and NASA allows each astronaut at most ${C.LIMITE_CARRERA_MSV} mSv in a whole career.`,
  },
  {
    id: 'llamarada',
    palabra: 'Solar flare',
    definicion: 'A solar flare is a sudden, very bright burst of light and energy from the Sun, set off by its twisted magnetic fields.',
  },
  {
    id: 'particulas',
    palabra: 'Solar particle event',
    definicion: 'A solar particle event is a storm of very fast particles thrown out by the Sun, often after a big flare, that can raise the radiation dose within hours, so the crew goes into the storm shelter.',
  },
  {
    id: 'eva',
    palabra: 'EVA (spacewalk)',
    definicion: 'EVA means extravehicular activity: going outside the ship or the base in a spacesuit, also called a spacewalk.',
  },
  {
    id: 'esclusa',
    palabra: 'Airlock',
    definicion: 'An airlock is a small room with two airtight doors that lets astronauts go outside without letting the air of the base escape.',
  },
  {
    id: 'kwh',
    palabra: 'kWh',
    definicion: 'A kilowatt-hour (kWh) is an amount of electric energy: what a 1,000-watt machine uses when it runs for one hour.',
  },
  {
    id: 'depurador',
    palabra: 'CO₂ scrubber',
    definicion: 'A CO₂ scrubber is a machine that takes out of the cabin air the carbon dioxide we breathe out, so it does not build up and make the crew sick.',
  },
  {
    id: 'ventana',
    palabra: 'Launch window',
    definicion: 'A launch window is the time when a rocket can lift off and still reach its target: each day it opens and closes at set times, and good trips to Mars come only about every 26 months.',
  },
]

export const TERMINO_BY_ID = Object.fromEntries(GLOSARIO.map((t) => [t.id, t])) as Record<TerminoId, Termino>
