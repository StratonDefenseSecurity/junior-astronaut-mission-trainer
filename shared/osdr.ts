// Estudios reales del NASA Open Science Data Repository (OSDR) que respaldan mecánicas del juego.
// Se buscaron con la API pública de búsqueda (https://osdr.nasa.gov/osdr/data/search, type=cgene)
// el 14/11/2026. Cada frase para niños sale solo de la descripción del estudio: no se añaden cifras.

export type OsdrId = 'OSD-342' | 'OSD-942' | 'OSD-360' | 'OSD-772' | 'OSD-268' | 'OSD-253'

export interface EstudioOsdr {
  id: OsdrId
  /** Título tal como figura en OSDR. */
  titulo: string
  /** Misión o vuelo, o el tipo de estudio si no voló. */
  mision: string
  /** Qué parte del juego respalda. */
  tema: 'bone' | 'exercise' | 'radiation' | 'plants' | 'sleep'
  /** Una frase para niños de 7 a 12 años, sacada solo de la descripción del estudio. */
  frase: string
  url: string
}

const url = (id: OsdrId) => `https://osdr.nasa.gov/bio/repo/data/studies/${id}`

export const ESTUDIOS_OSDR: EstudioOsdr[] = [
  {
    id: 'OSD-342',
    titulo: 'Targeting myostatin/activin A protects against skeletal muscle and bone loss during spaceflight [plasma proteomics]',
    mision: 'SpaceX-19 to the International Space Station (Rodent Research-19), 2019 to 2020',
    tema: 'bone',
    frase: 'Mice that spent 33 days floating on the International Space Station lost muscle and bone.',
    url: url('OSD-342'),
  },
  {
    id: 'OSD-942',
    titulo: 'Exercise Training Attenuates the Muscle Mitochondria Genomic Response to Bed Rest (microarray data)',
    mision: 'NASA 70-day bed rest study on Earth (simulated microgravity)',
    tema: 'exercise',
    frase: 'Volunteers stayed in bed for 70 days to copy weightlessness, and the ones who exercised kept their muscles, strength and fitness much better.',
    url: url('OSD-942'),
  },
  {
    id: 'OSD-360',
    titulo: 'Effects of low dose space radiation exposures on the splenic metabolome',
    mision: 'Ground study on Earth (mice, no flight)',
    tema: 'radiation',
    frase: 'Far from Earth, astronauts collect more space radiation over time, so scientists gave mice small doses and checked them 1, 2 and 4 months later.',
    url: url('OSD-360'),
  },
  {
    id: 'OSD-772',
    titulo: 'PH-04 Chile Peppers in Space',
    mision: 'SpaceX-22 to the International Space Station (Plant Habitat-04), 2021',
    tema: 'plants',
    frase: 'Astronauts grew chile peppers on the space station for 137 days and got 26 peppers, one of the longest plant experiments there.',
    url: url('OSD-772'),
  },
  {
    id: 'OSD-268',
    titulo: 'Microbiological and nutritional analysis of lettuce crops grown on the International Space Station-VEG01B',
    mision: 'SpaceX-3 to the International Space Station (Veggie VEG-01B), 2014',
    tema: 'plants',
    frase: 'Lettuce grown in the Veggie garden on the space station was sent back to Earth so scientists could check its germs and its nutrients.',
    url: url('OSD-268'),
  },
  {
    id: 'OSD-253',
    titulo: 'Transcriptional analysis of kidneys from mice flown on the RR-7 mission',
    mision: 'SpaceX-15 to the International Space Station (Rodent Research-7), 2018',
    tema: 'sleep',
    frase: 'Scientists filmed mice on the space station for 48 hours at a time to see whether space changes their daily rhythms, the body clock that says when to sleep and wake.',
    url: url('OSD-253'),
  },
]

export const OSDR_BY_ID = Object.fromEntries(ESTUDIOS_OSDR.map((e) => [e.id, e])) as Record<OsdrId, EstudioOsdr>
