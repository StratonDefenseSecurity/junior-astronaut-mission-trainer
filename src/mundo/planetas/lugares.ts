// Coordenadas reales de los lugares que se dibujan en los globos y que se pueden marcar.
// Cada valor viene de una fuente citada (ver FUENTES_PLANETAS al final, sirve para el panel de
// fuentes del juego). Convención en todo el módulo:
//   - latitud planetocéntrica en grados, positiva al norte;
//   - longitud planetocéntrica en grados, POSITIVA AL ESTE, en el rango -180..180.
// El Nomenclátor de la IAU da Marte en "planetocéntrica, +Este, 0..360": aquí se resta 360 a las
// longitudes mayores que 180 (por ejemplo, Olympus Mons 226.00° E se guarda como -134.00).
// Para Marte se usa la primera ubicación ("primary") que lista el Nomenclátor de cada rasgo.

export interface Lugar {
  nombre: string
  /** Latitud planetocéntrica (grados, +N). */
  lat: number
  /** Longitud planetocéntrica (grados, +E, -180..180). */
  lon: number
  /** Diámetro o largo del rasgo según la fuente; null si la fuente no lo da. */
  km: number | null
  /** Clave de FUENTES_PLANETAS. */
  fuente: ClaveFuente
}

/** Lleva una longitud este 0..360 a -180..180. */
export const lonEste = (grados: number) => (grados > 180 ? grados - 360 : grados)

// --------------------------------------------------------------------------------- Tierra

export const LUGARES_TIERRA = {
  // Wikipedia, ficha de la ciudad: 6°41′59″S 79°54′08″W.
  lambayeque: { nombre: 'Lambayeque', lat: -6.7, lon: -79.9, km: null, fuente: 'wikiLambayeque' },
  // Wikipedia, ficha de la ciudad: 12°03′36″S 77°02′15″W.
  lima: { nombre: 'Lima', lat: -12.06, lon: -77.04, km: null, fuente: 'wikiLima' },
} satisfies Record<string, Lugar>

// ---------------------------------------------------------------------------------- Marte

export const LUGARES_MARTE = {
  olympusMons: { nombre: 'Olympus Mons', lat: 18.4, lon: lonEste(226.0), km: 648, fuente: 'iauOlympus' },
  arsiaMons: { nombre: 'Arsia Mons', lat: -8.3, lon: lonEste(238.9), km: 475, fuente: 'iauArsia' },
  pavonisMons: { nombre: 'Pavonis Mons', lat: 0.79, lon: lonEste(246.6), km: 375, fuente: 'iauPavonis' },
  ascraeusMons: { nombre: 'Ascraeus Mons', lat: 11.76, lon: lonEste(255.5), km: 460, fuente: 'iauAscraeus' },
  elysiumMons: { nombre: 'Elysium Mons', lat: 24.74, lon: 146.9, km: 410, fuente: 'iauElysium' },
  // Largo del sistema de cañones; el Nomenclátor lo encierra entre 2.96°S y 19.09°S, 267.30°E y 331.10°E.
  vallesMarineris: { nombre: 'Valles Marineris', lat: -13.74, lon: lonEste(300.8), km: 3769, fuente: 'iauValles' },
  hellas: { nombre: 'Hellas Planitia', lat: -42.66, lon: 70.0, km: 2200, fuente: 'iauHellas' },
  argyre: { nombre: 'Argyre Planitia', lat: -49.67, lon: lonEste(316.0), km: 800, fuente: 'iauArgyre' },
  syrtisMajor: { nombre: 'Syrtis Major Planum', lat: 8.4, lon: 69.5, km: 1350, fuente: 'iauSyrtisPlanum' },
  acidalia: { nombre: 'Acidalia Planitia', lat: 46.66, lon: lonEste(338.0), km: 2300, fuente: 'iauAcidalia' },
  utopia: { nombre: 'Utopia Planitia', lat: 49.67, lon: 118.0, km: 3200, fuente: 'iauUtopia' },
  meridiani: { nombre: 'Meridiani Planum', lat: 0.2, lon: lonEste(357.5), km: 1100, fuente: 'iauMeridiani' },
  gale: { nombre: 'Gale Crater', lat: -5.44, lon: 137.7, km: 155.3, fuente: 'iauGale' },
  jezero: { nombre: 'Jezero Crater', lat: 18.41, lon: 77.69, km: 47.52, fuente: 'iauJezero' },
  // Punto de aterrizaje de Curiosity (Bradbury Landing): 4.5895°S, 137.4417°E.
  curiosity: { nombre: 'Curiosity landing site', lat: -4.5895, lon: 137.4417, km: null, fuente: 'pdsMsl' },
  // Punto de aterrizaje de Perseverance (Octavia E. Butler Landing): 18.44°N, 77.45°E.
  perseverance: { nombre: 'Perseverance landing site', lat: 18.44, lon: 77.45, km: null, fuente: 'gissLanders' },
  // Hielo enterrado detectado con el radar SHARAD (Stuurman et al. 2016): entre 39° y 49° N (JPL)
  // en el borde occidental de Utopia, 70°-90° E (según Xu et al. 2025, que cita ese trabajo).
  // El punto es el centro de ese recuadro, no un sitio puntual.
  hieloUtopia: { nombre: 'Buried ice, Utopia', lat: 44, lon: 80, km: null, fuente: 'jplHieloUtopia' },
} satisfies Record<string, Lugar>

/** Región del hielo enterrado de Utopia (recuadro, grados). */
export const REGION_HIELO_UTOPIA = { latMin: 39, latMax: 49, lonMin: 70, lonMax: 90 } as const

/** Rasgos de albedo oscuros clásicos (centros del Nomenclátor; la IAU no da su tamaño). */
export const ALBEDO_MARTE = {
  syrtisMajor: { nombre: 'Syrtis Major', lat: 9.88, lon: 70.0, km: null, fuente: 'iauAlbedo' },
  mareAcidalium: { nombre: 'Mare Acidalium', lat: 44.66, lon: lonEste(330.0), km: null, fuente: 'iauAlbedo' },
  mareErythraeum: { nombre: 'Mare Erythraeum', lat: -24.74, lon: lonEste(320.0), km: null, fuente: 'iauAlbedo' },
  mareCimmerium: { nombre: 'Mare Cimmerium', lat: -19.78, lon: 140.0, km: null, fuente: 'iauAlbedo' },
  mareTyrrhenum: { nombre: 'Mare Tyrrhenum', lat: -19.78, lon: 105.0, km: null, fuente: 'iauAlbedo' },
  mareSirenum: { nombre: 'Mare Sirenum', lat: -29.71, lon: lonEste(205.0), km: null, fuente: 'iauAlbedo' },
  mareSerpentis: { nombre: 'Mare Serpentis', lat: -29.71, lon: 40.0, km: null, fuente: 'iauAlbedo' },
  mareChronium: { nombre: 'Mare Chronium', lat: -57.7, lon: 150.0, km: null, fuente: 'iauAlbedo' },
  sinusMeridiani: { nombre: 'Sinus Meridiani', lat: -4.94, lon: 0.0, km: null, fuente: 'iauAlbedo' },
  sinusSabaeus: { nombre: 'Sinus Sabaeus', lat: -7.91, lon: 20.0, km: null, fuente: 'iauAlbedo' },
  solisLacus: { nombre: 'Solis Lacus', lat: -27.72, lon: lonEste(270.0), km: null, fuente: 'iauAlbedo' },
} satisfies Record<string, Lugar>

/** Tramos de Valles Marineris de oeste a este (centros y largos de Wikipedia, que cita al Nomenclátor). */
export const CHASMATA_MARTE = {
  noctis: { nombre: 'Noctis Labyrinthus', lat: -7.0, lon: -102.2, km: 1263, fuente: 'wikiChasmata' },
  ius: { nombre: 'Ius Chasma', lat: -7.0, lon: -85.8, km: 938, fuente: 'wikiChasmata' },
  melas: { nombre: 'Melas Chasma', lat: -10.4, lon: -72.7, km: 547, fuente: 'wikiChasmata' },
  coprates: { nombre: 'Coprates Chasma', lat: -13.4, lon: -61.4, km: 966, fuente: 'wikiChasmata' },
  eos: { nombre: 'Eos Chasma', lat: -12.1, lon: -39.7, km: 1413, fuente: 'wikiChasmata' },
} satisfies Record<string, Lugar>

/**
 * Casquetes polares residuales (los que quedan en verano).
 * Norte: ~1000-1100 km de diámetro, centrado en el polo; Planum Boreum empieza en 78.5° N.
 * Sur: ~400 km de diámetro y desplazado unos 3° (≈150 km) del polo hacia el hemisferio
 * occidental (ESA 2008). La longitud exacta de ese desplazamiento no está en las fuentes
 * consultadas: el -45° de abajo es una aproximación nuestra dentro de ese hemisferio.
 */
export const CASQUETES_MARTE = {
  norte: { lat: 90, lon: 0, km: 1050 },
  sur: { lat: -87, lon: -45, km: 400 },
} as const

// ------------------------------------------------------------------------------------ Luna
// El Nomenclátor da la Luna en "+Este, -180..180", que es la misma convención de este módulo.
// Mares (lado visible y bordes) con su diámetro o dimensión mayor.

export const LUGARES_LUNA = {
  imbrium: { nombre: 'Mare Imbrium', lat: 34.72, lon: -14.91, km: 1145.53, fuente: 'iauMaresLuna' },
  serenitatis: { nombre: 'Mare Serenitatis', lat: 27.29, lon: 18.36, km: 674.28, fuente: 'iauMaresLuna' },
  tranquillitatis: { nombre: 'Mare Tranquillitatis', lat: 8.35, lon: 30.83, km: 875.75, fuente: 'iauMaresLuna' },
  crisium: { nombre: 'Mare Crisium', lat: 16.18, lon: 59.1, km: 555.92, fuente: 'iauMaresLuna' },
  procellarum: { nombre: 'Oceanus Procellarum', lat: 20.67, lon: -56.68, km: 2592.24, fuente: 'iauMaresLuna' },
  nubium: { nombre: 'Mare Nubium', lat: -20.59, lon: -17.29, km: 714.5, fuente: 'iauMaresLuna' },
  fecunditatis: { nombre: 'Mare Fecunditatis', lat: -7.83, lon: 53.67, km: 840.35, fuente: 'iauMaresLuna' },
  nectaris: { nombre: 'Mare Nectaris', lat: -15.19, lon: 34.6, km: 339.39, fuente: 'iauMaresLuna' },
  frigoris: { nombre: 'Mare Frigoris', lat: 57.59, lon: -0.01, km: 1446.41, fuente: 'iauMaresLuna' },
  humorum: { nombre: 'Mare Humorum', lat: -24.48, lon: -38.57, km: 419.67, fuente: 'iauMaresLuna' },
  vaporum: { nombre: 'Mare Vaporum', lat: 13.2, lon: 4.09, km: 242.46, fuente: 'iauMaresLuna' },
  insularum: { nombre: 'Mare Insularum', lat: 7.79, lon: -30.64, km: 511.93, fuente: 'iauMaresLuna' },
  cognitum: { nombre: 'Mare Cognitum', lat: -10.53, lon: -22.31, km: 350.01, fuente: 'iauMaresLuna' },
  marginis: { nombre: 'Mare Marginis', lat: 12.7, lon: 86.52, km: 357.63, fuente: 'iauMaresLuna' },
  smythii: { nombre: 'Mare Smythii', lat: -1.71, lon: 87.05, km: 373.97, fuente: 'iauMaresLuna' },
  undarum: { nombre: 'Mare Undarum', lat: 7.49, lon: 68.66, km: 244.84, fuente: 'iauMaresLuna' },
  spumans: { nombre: 'Mare Spumans', lat: 1.3, lon: 65.3, km: 143.13, fuente: 'iauMaresLuna' },
  anguis: { nombre: 'Mare Anguis', lat: 22.43, lon: 67.58, km: 145.99, fuente: 'iauMaresLuna' },
  australe: { nombre: 'Mare Australe', lat: -47.77, lon: 91.99, km: 996.84, fuente: 'iauMaresLuna' },
  orientale: { nombre: 'Mare Orientale', lat: -19.87, lon: -94.67, km: 294.16, fuente: 'iauMaresLuna' },
  moscoviense: { nombre: 'Mare Moscoviense', lat: 27.28, lon: 148.12, km: 275.57, fuente: 'iauMaresLuna' },
  ingenii: { nombre: 'Mare Ingenii', lat: -33.25, lon: 164.83, km: 282.2, fuente: 'iauMaresLuna' },
  humboldtianum: { nombre: 'Mare Humboldtianum', lat: 56.92, lon: 81.54, km: 230.78, fuente: 'iauMaresLuna' },
  // Cráter Tycho: ~85 km; sus rayos llegan a ~1500 km.
  tycho: { nombre: 'Tycho Crater', lat: -43.31, lon: -11.36, km: 85, fuente: 'iauTycho' },
} satisfies Record<string, Lugar>

// --------------------------------------------------------------------------------- fuentes

export const FUENTES_PLANETAS = {
  naturalEarth: {
    titulo: 'Natural Earth 4.1.0 (public domain), via the world-atlas 2.0.2 package (ISC license)',
    url: 'https://www.naturalearthdata.com/about/terms-of-use/',
  },
  worldAtlas: { titulo: 'world-atlas: prebuilt TopoJSON from Natural Earth', url: 'https://github.com/topojson/world-atlas' },
  iauRotacion: {
    titulo: 'Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015 (via astronomy-engine RotationAxis)',
    url: 'https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2015reprint.pdf',
  },
  astronomyEngine: { titulo: 'astronomy-engine (Don Cross, MIT license)', url: 'https://github.com/cosinekitty/astronomy' },
  wikiLambayeque: { titulo: 'Wikipedia: Lambayeque, Peru', url: 'https://en.wikipedia.org/wiki/Lambayeque,_Peru' },
  wikiLima: { titulo: 'Wikipedia: Lima', url: 'https://en.wikipedia.org/wiki/Lima' },
  iauOlympus: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Olympus Mons', url: 'https://planetarynames.wr.usgs.gov/Feature/4453' },
  iauArsia: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Arsia Mons', url: 'https://planetarynames.wr.usgs.gov/Feature/394' },
  iauPavonis: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Pavonis Mons', url: 'https://planetarynames.wr.usgs.gov/Feature/4620' },
  iauAscraeus: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Ascraeus Mons', url: 'https://planetarynames.wr.usgs.gov/Feature/417' },
  iauElysium: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Elysium Mons', url: 'https://planetarynames.wr.usgs.gov/Feature/1783' },
  iauValles: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Valles Marineris', url: 'https://planetarynames.wr.usgs.gov/Feature/6288' },
  iauHellas: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Hellas Planitia', url: 'https://planetarynames.wr.usgs.gov/Feature/2432' },
  iauArgyre: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Argyre Planitia', url: 'https://planetarynames.wr.usgs.gov/Feature/371' },
  iauSyrtisPlanum: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Syrtis Major Planum', url: 'https://planetarynames.wr.usgs.gov/Feature/5796' },
  iauAcidalia: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Acidalia Planitia', url: 'https://planetarynames.wr.usgs.gov/Feature/38' },
  iauUtopia: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Utopia Planitia', url: 'https://planetarynames.wr.usgs.gov/Feature/6260' },
  iauMeridiani: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Meridiani Planum', url: 'https://planetarynames.wr.usgs.gov/Feature/3854' },
  iauGale: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Gale', url: 'https://planetarynames.wr.usgs.gov/Feature/2071' },
  iauJezero: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Jezero', url: 'https://planetarynames.wr.usgs.gov/Feature/14300' },
  iauAlbedo: {
    titulo:
      'Gazetteer of Planetary Nomenclature (IAU/USGS), Mars albedo features: Syrtis Major (5795), Mare Acidalium (3663), Mare Erythraeum (3672), Mare Cimmerium (3669), Mare Tyrrhenum (3692), Mare Sirenum (3688), Mare Serpentis (3687), Mare Chronium (3668), Sinus Meridiani (5568), Sinus Sabaeus (5570), Solis Lacus (5624)',
    url: 'https://planetarynames.wr.usgs.gov/Feature/5795',
  },
  wikiChasmata: {
    titulo: 'Wikipedia: Ius, Melas, Coprates and Eos Chasma, Noctis Labyrinthus (entries taken from the IAU Gazetteer)',
    url: 'https://en.wikipedia.org/wiki/Coprates_Chasma',
  },
  pdsMsl: {
    titulo: 'NASA PDS / NAIF, MSL (Curiosity) mission catalog: landing at 4.5895° S, 137.4417° E',
    url: 'https://pds.nasa.gov/data/pds3/releases/latest/2026/202603-naif/msl/zzold/mission.cat',
  },
  gissLanders: { titulo: 'NASA GISS Mars24: Mars Lander Missions (Perseverance 18.44° N, 77.45° E)', url: 'https://www.giss.nasa.gov/tools/mars24/help/landers.html' },
  jplHieloUtopia: {
    titulo:
      'NASA JPL (2016): Mars Ice Deposit Holds as Much Water as Lake Superior (39°-49° N); Stuurman et al. 2016, GRL 43, doi:10.1002/2016GL070138; longitude 70°-90° E from Xu et al. 2025, JGR Planets, doi:10.1029/2023JE008145',
    url: 'https://www.jpl.nasa.gov/news/mars-ice-deposit-holds-as-much-water-as-lake-superior/',
  },
  casquetes: {
    titulo: 'ESA (2008): Mars polar cap mystery solved; Wikipedia: Martian polar ice caps; Wikipedia: Planum Boreum',
    url: 'https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Mars_polar_cap_mystery_solved',
  },
  atardecerMarte: {
    titulo: "NASA/JPL PIA19400: Sunset in Mars' Gale Crater (Curiosity, 2015): the sky near the Sun looks blue at sunset",
    url: 'https://www.jpl.nasa.gov/images/pia19400-sunset-in-mars-gale-crater/',
  },
  iauMaresLuna: {
    titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS), lunar maria (via Wikipedia: List of maria on the Moon), for example Mare Imbrium',
    url: 'https://planetarynames.wr.usgs.gov/Feature/3678',
  },
  iauTycho: { titulo: 'Gazetteer of Planetary Nomenclature (IAU/USGS): Tycho (via Wikipedia)', url: 'https://planetarynames.wr.usgs.gov/Feature/6163' },
} as const

export type ClaveFuente = keyof typeof FUENTES_PLANETAS
