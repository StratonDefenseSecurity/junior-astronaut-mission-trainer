// Valores reales en los que se apoya la simulación, con su fuente.
//
// Regla del proyecto: cada número marcado como real sale de la publicación citada en FUENTES
// y fue verificado contra ella. Lo que es una decisión de diseño del juego se dice aquí y se
// muestra al jugador en la lista SUPUESTOS.

export const C = {
  // ---- Metabolismo humano (tripulante de referencia de 82 kg) ----
  /** kg de O2 consumidos por joule de gasto metabólico: 0.84 kg/día a 137 W (Wieland 1994). */
  O2_KG_POR_J: 7.1e-8,
  /** kg de CO2 producidos por kg de O2 consumido: 1.00 kg/día por 0.84 kg/día (Wieland 1994). */
  CO2_POR_O2: 1.19,
  /**
   * Gasto metabólico por actividad, en vatios. Sueño (88), trabajo nominal (139) y salida con
   * traje (295) son del BVAD de NASA; reposo y el promedio de una sesión de ejercicio son del juego.
   */
  METABOLISMO_W: { sueno: 88, reposo: 100, trabajo: 139, eva: 295, ejercicio: 400 },
  METABOLISMO_MEDIO_W: 137,
  /** Agua para beber (2.0) y rehidratar comida (0.5), kg por persona y día (BVAD). */
  AGUA_BEBIDA_KG_DIA: 2.5,
  /** Higiene personal (0.4) e inodoro (0.3), kg por persona y día (BVAD, valores de la ISS). */
  AGUA_HIGIENE_KG_DIA: 0.7,
  /** Comida empacada de la ISS, kg por persona y día (BVAD; la revisión de 2022 la sube a 2.39). */
  COMIDA_KG_DIA: 1.83,
  /** Diseño del juego: 3 000 kcal diarias repartidas en esa masa de comida. */
  KCAL_POR_KG_COMIDA: 1640,
  MASA_CORPORAL_KG: 82,
  /** Consumo máximo de oxígeno: 45 mL/kg/min para 82 kg (BVAD). */
  VO2MAX_L_MIN: 3.7,
  /** Energía liberada por litro de O2 consumido, J. */
  J_POR_L_O2: 20100,
  /** Diseño del juego: edad de la tripulación para estimar el pulso máximo. */
  EDAD: 38,

  // ---- Cabina (atmósfera tipo Estación Espacial Internacional) ----
  /** Diseño del juego: volumen presurizado del hábitat. */
  VOLUMEN_M3: 150,
  TEMP_CABINA_C: 22,
  PRESION_KPA: 101.3,
  PPO2_NOMINAL_KPA: 21.3,
  /** Diseño del juego: por debajo de esta presión parcial de O2 la saturación cae a ~90%. */
  PPO2_MINIMA_KPA: 16,
  /** Límite vigente de CO2 en cabina: 3 mmHg = 0.4 kPa (NASA-STD-3001 Vol. 2). */
  PPCO2_LIMITE_KPA: 0.4,
  /** Diseño del juego: desde 15 mmHg (2 kPa) el CO2 daña la salud. */
  PPCO2_PELIGRO_KPA: 2.0,
  /** kg de gas por cada kPa de presión parcial en la cabina (gas ideal, 150 m³, 295 K). */
  KG_O2_POR_KPA: 1.957,
  KG_CO2_POR_KPA: 2.691,

  // ---- Soporte vital (equipos de la ISS) ----
  /** Generador de oxígeno de la ISS: hasta 9.2 kg de O2 por día en funcionamiento continuo. */
  OGA_KG_DIA: 9.2,
  /** Agua consumida por kg de O2 producido (estequiometría de la electrólisis). */
  OGA_AGUA_POR_O2: 1.125,
  /** 3.57 kW a plena producción (9.2 kg/día). */
  OGA_KW_POR_KG_DIA: 0.39,
  /**
   * Depurador de CO2 de la ISS: retira (1.723 × mmHg de CO2 − 0.38) kg por día.
   * La ISS tiene dos; el hábitat del juego también.
   */
  CDRA_PENDIENTE: 1.723,
  CDRA_ORIGEN: 0.38,
  CDRA_UNIDADES: 2,
  /** 1 kW por depurador en la ISS. */
  CDRA_KW: 1.0,
  /** Recuperación de agua lograda en la ISS en 2023. */
  WRS_EFICIENCIA: 0.98,
  /** Diseño del juego: capacidad y potencia del reciclador. */
  WRS_KG_DIA: 32,
  WRS_KW: 0.7,
  /**
   * Diseño del juego: cartucho con 3 kg de hidróxido de litio. Por la reacción
   * 2 LiOH + CO2 → Li2CO3 + H2O, cada kg de LiOH absorbe 0.92 kg de CO2.
   */
  LIOH_KG_CO2: 2.7,

  // ---- Traje espacial (EMU de NASA) ----
  /** Oxígeno utilizable del tanque primario: 1.217 lb. */
  TRAJE_O2_KG: 0.55,
  /** Oxígeno puro a 4.3 psi. */
  TRAJE_PRESION_KPA: 29.6,
  /** Diseñado para 7 horas, hasta 8 con menos esfuerzo. */
  TRAJE_BATERIA_H: 8,

  // ---- Radiación (instrumento RAD de Curiosity) ----
  /** Rayos cósmicos durante el crucero Tierra–Marte, mSv/día (Zeitlin 2013). */
  GCR_CRUCERO_MSV_DIA: 1.84,
  /** Rayos cósmicos en la superficie de Marte, mSv/día (Hassler 2014). */
  GCR_SUPERFICIE_MSV_DIA: 0.64,
  /** Límite de dosis de carrera de NASA. */
  LIMITE_CARRERA_MSV: 600,

  // ---- Marte (NASA Mars Fact Sheet) ----
  /** Duración de un sol: 24 h 39 min 35 s. */
  SOL_S: 88775,
  GRAVEDAD_MARTE: 3.73,
  GRAVEDAD_TIERRA: 9.82,
  /** Irradiancia solar en la órbita de Marte y en la de la Tierra, W/m². */
  IRRADIANCIA_MARTE: 586,
  IRRADIANCIA_TIERRA: 1361,
  UA_KM: 149_597_871,
  DISTANCIA_SOL_MARTE_UA: 1.524,
  VELOCIDAD_LUZ_KM_S: 299_792,

  // ---- Energía (diseño del juego, salvo el reactor) ----
  /** Potencia de un campo solar de 50 m² al mediodía marciano con cielo limpio, kW. */
  PANEL_KW: 7,
  BATERIA_KWH: 100,
  /** Reactor Kilopower: hasta 10 kW eléctricos continuos, unos 1 500 kg. */
  REACTOR_KW: 10,
  /** Pérdida de calor del hábitat, W por cada °C de diferencia con el exterior. */
  PERDIDA_TERMICA_W_K: 60,
  /** Polvo que se deposita sobre los paneles cada sol (fracción de potencia perdida). */
  POLVO_POR_SOL: 0.002,

  // ---- Ejercicio en microgravedad ----
  /** Horas de ejercicio programadas cada día para la tripulación de la ISS. */
  EJERCICIO_ISS_H: 2.5,
} as const

/**
 * Resumen del registro de Curiosity que usa el juego (server/datos/climaMarte.ts). Lo comprueba
 * scripts/simular.ts contra los datos, para que no se desfase si se vuelven a descargar.
 */
export const REMS_RESUMEN = { soles: 669, tMin: -100, tMax: 8, pMin: 679, pMax: 854 } as const

/** Presión al nivel del mar en la Tierra, Pa (atmósfera estándar). */
export const PRESION_TIERRA_PA = 101_325

/**
 * Modelo del juego: millones de km a la Tierra al llegar a Marte. Mientras la nave viaja, la
 * Tierra se adelanta en su órbita, así que un viaje más largo termina más lejos de ella.
 */
export const distanciaTierraAlLlegar = (diasDeViaje: number) => 180 + diasDeViaje * 0.33

/** Minutos que tarda una señal en llegar a la Tierra desde Marte al final del viaje. */
export const minutosDeSenalAlLlegar = (diasDeViaje: number) =>
  Math.round((distanciaTierraAlLlegar(diasDeViaje) * 1e6) / C.VELOCIDAD_LUZ_KM_S / 60)

export interface Fuente {
  tema: string
  dato: string
  fuente: string
  url: string
}

export const FUENTES: Fuente[] = [
  {
    tema: 'Breathing and metabolism',
    dato: 'One person uses 0.84 kg of oxygen and produces 1.00 kg of CO2 per day, with an average output of 137 W.',
    fuente: 'Wieland (1994), Designing for Human Presence in Space: An Introduction to Environmental Control and Life Support Systems, NASA RP-1324.',
    url: 'https://ntrs.nasa.gov/citations/19940022934',
  },
  {
    tema: 'Water, food and effort',
    dato: '2.5 kg of water for drinking and preparing food and 0.7 kg for hygiene per person per day. 1.83 kg of packaged food (ISS value). Output of 88 W while sleeping, 139 W during normal work and 295 W in the suit.',
    fuente: 'NASA, Life Support Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570/REV2 (2022).',
    url: 'https://ntrs.nasa.gov/citations/20210024855',
  },
  {
    tema: 'Water recycling',
    dato: 'The International Space Station recovers 98% of the water the crew uses.',
    fuente: 'NASA, "NASA Achieves Water Recovery Milestone on International Space Station" (June 20, 2023).',
    url: 'https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/',
  },
  {
    tema: 'CO2 limit',
    dato: 'Cabin CO2 must not go over 3 mmHg (0.4 kPa) on average. The old limit was 5.3 mmHg for stays of 7 to 180 days.',
    fuente: 'NASA-STD-3001 Vol. 2 [V2 6004], summarized in the NASA technical brief OCHMO-TB-004.',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf',
  },
  {
    tema: 'CO2 scrubber',
    dato: 'Each ISS scrubber removes about (1.723 × mmHg of CO2 − 0.38) kg per day. The station has two.',
    fuente: 'NASA, technical report on the ISS CDRA scrubber, NTRS 20050210002.',
    url: 'https://ntrs.nasa.gov/citations/20050210002',
  },
  {
    tema: 'Oxygen generator',
    dato: 'The ISS oxygen generator produces between 2.3 and 9.2 kg per day and uses 3.57 kW at full load.',
    fuente: 'NASA, technical report on the ISS oxygen generator, NTRS 20080036243.',
    url: 'https://ntrs.nasa.gov/citations/20080036243',
  },
  {
    tema: 'Radiation during the trip',
    dato: 'During the cruise to Mars, the measured dose was 1.84 mSv per day.',
    fuente: 'Zeitlin et al. (2013), "Measurements of Energetic Particle Radiation in Transit to Mars on the Mars Science Laboratory", Science 340.',
    url: 'https://doi.org/10.1126/science.1235989',
  },
  {
    tema: 'Radiation on Mars',
    dato: 'On the surface of Mars, the measured dose is 0.64 mSv per day.',
    fuente: 'Hassler et al. (2014), "Mars\' Surface Radiation Environment Measured with the Mars Science Laboratory\'s Curiosity Rover", Science 343.',
    url: 'https://doi.org/10.1126/science.1244797',
  },
  {
    tema: 'Radiation limit',
    dato: 'NASA limits the dose over an astronaut\'s whole career to less than 600 mSv.',
    fuente: 'NASA-STD-3001, NASA Spaceflight Human-System Standard, Volume 1: Crew Health, Rev. C (2023) [V1 4030].',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf',
  },
  {
    tema: 'Mars weather',
    dato: 'Low and high temperature, pressure and ultraviolet index for each sol over one full Martian year. These are public outreach data.',
    fuente: 'REMS station on the Curiosity rover, Gale Crater. Centro de Astrobiología (CSIC-INTA) and NASA JPL.',
    url: 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json',
  },
  {
    tema: 'Solar storms',
    dato: 'The 54 X-class flares and the solar energetic particle events recorded in 2024.',
    fuente: 'DONKI, Community Coordinated Modeling Center, NASA Goddard Space Flight Center.',
    url: 'https://ccmc.gsfc.nasa.gov/DONKI/',
  },
  {
    tema: 'Mars',
    dato: 'A sol lasts 24 h 39 min 35 s. Gravity is 3.73 m/s². Sunlight delivers 586 W/m², compared with 1,361 on Earth.',
    fuente: 'NASA, Mars Fact Sheet, NSSDCA.',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
  },
  {
    tema: 'Blood oxygen',
    dato: 'Saturation is calculated with the hemoglobin dissociation curve.',
    fuente: 'Severinghaus (1979), "Simple, accurate equations for human blood O2 dissociation computations", J. Appl. Physiol. 46.',
    url: 'https://doi.org/10.1152/jappl.1979.46.3.599',
  },
  {
    tema: 'Heart rate',
    dato: 'The maximum heart rate is estimated as 208 − 0.7 × age.',
    fuente: 'Tanaka, Monahan and Seals (2001), "Age-predicted maximal heart rate revisited", J. Am. Coll. Cardiol. 37.',
    url: 'https://doi.org/10.1016/S0735-1097(00)01054-8',
  },
  {
    tema: 'Spacesuit',
    dato: 'The EMU suit runs on pure oxygen at 29.6 kPa, carries 0.55 kg of oxygen and is designed for 7-hour spacewalks, up to 8 with little effort.',
    fuente: 'NASA, EMU LSS/SSA Data Book, Rev. V (2017).',
    url: 'https://www.nasa.gov/wp-content/uploads/2017/02/esoc-13_rev._v_emu_hardware_data_book_jsc-e-daa-tn55224.pdf',
  },
  {
    tema: 'Exercise',
    dato: 'The ISS crew has two and a half hours of exercise scheduled each day to slow the loss of muscle and bone.',
    fuente: 'NASA, "FAQ: The Real Story About Astronaut Health Care in Space" (2024).',
    url: 'https://www.nasa.gov/missions/station/faq-the-real-story-about-astronaut-health-care-in-space/',
  },
  {
    tema: 'Nuclear power',
    dato: 'The Kilopower reactor can give up to 10 kW of electricity nonstop for at least ten years. A 10 kW unit weighs about 1,500 kg.',
    fuente: 'NASA, "Demonstration Proves Nuclear Fission System Can Provide Space Exploration Power" (2018) and NTRS 20180000691.',
    url: 'https://www.nasa.gov/news-release/demonstration-proves-nuclear-fission-system-can-provide-space-exploration-power/',
  },
  {
    tema: 'Dust on the panels',
    dato: 'Dust cut the power of the InSight lander until its batteries ran out in 2022.',
    fuente: 'NASA, "NASA Retires InSight Mars Lander Mission After Years of Science" (2022).',
    url: 'https://www.nasa.gov/missions/insight/nasa-retires-insight-mars-lander-mission-after-years-of-science/',
  },
  {
    tema: 'Dust storms',
    dato: 'In June 2018 a global storm raised the sky opacity to 10.8 over the Opportunity rover, which stopped working.',
    fuente: 'NASA JPL, "Opportunity Hunkers Down During Dust Storm" (2018).',
    url: 'https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/',
  },
  {
    tema: 'Ice in Utopia Planitia',
    dato: 'The SHARAD radar found a buried ice deposit of up to 14,300 km³, as much water as Lake Superior.',
    fuente: 'Stuurman et al. (2016), Geophys. Res. Lett. 43, and NASA JPL, "Mars Ice Deposit Holds as Much Water as Lake Superior".',
    url: 'https://doi.org/10.1002/2016GL070138',
  },
  {
    tema: 'Launch windows and situation dates',
    dato: 'The launch dates (Oct 25, 2024, Dec 5, 2026, Jan 7, 2029, Feb 10, 2031 and Mar 19, 2033) are real windows for a Hohmann transfer, calculated with ephemerides. They match the Mars oppositions of 2027, 2029, 2031 and 2033.',
    fuente: 'astronomy-engine (Don Cross, MIT), validated against JPL Horizons',
    url: 'https://github.com/cosinekitty/astronomy',
  },
  {
    tema: 'Artemis I countdown and launch plan',
    dato: 'Artemis I lifted off from Launch Pad 39B at Kennedy Space Center. In the last seconds: hydrogen burn-off igniters at T−12 s, the command for core stage engine start at T−10 s, RS-25 startup at T−6.36 s, then booster ignition, umbilical separation and liftoff. The plan put booster separation at 2 min 12 s, the service module fairing at 3 min 11 s, the abort tower at 3 min 16 s, main engine cutoff at 8 min 03 s and core stage separation at 8 min 15 s.',
    fuente: 'NASA, Artemis I Press Kit (2022), countdown milestones and ascent timeline',
    url: 'https://www.nasa.gov/wp-content/uploads/static/artemis-i-press-kit/img/Artemis%20I_Press%20Kit.pdf',
  },
  {
    tema: 'Artemis I ascent as flown',
    dato: 'Liftoff (booster ignition) was at 1:47:44 a.m. EST on November 16, 2022. Maximum dynamic pressure came at 1 min 10 s and 43,000 ft. The boosters separated at 132 s and 158,000 ft, the abort tower at 210 s and 288,000 ft, and the core stage engines cut off at 500 s and 531,000 ft.',
    fuente: 'Mehta, Smith and Mobley, "Space Launch System Base Aerothermodynamics Post-Flight Reconstruction for Artemis I", AIAA SciTech 2024; NASA, Artemis I mission timeline',
    url: 'https://ntrs.nasa.gov/citations/20230017528',
  },
  {
    tema: 'Artemis I speeds and orbit',
    dato: 'Relative to Earth, the rocket went supersonic at 54 s and flew at 3,170 mph at booster separation, over 4,500 mph at abort tower jettison and 17,430 mph at main engine cutoff. NASA rounds these to about 4,000 and 17,500 mph and says Orion reached within about 3 miles of its planned 975 by 16 nautical mile orbit. The orbit inclination of 30.5° is from Jonathan McDowell\'s Space Report.',
    fuente: 'Ben Evans, AmericaSpace (Nov 16, 2023); NASA, "Initial Assessment Shows Excellent Performance for Artemis Moon Rocket" (2022); Jonathan\'s Space Report No. 812',
    url: 'https://www.americaspace.com/2023/11/16/the-harder-the-climb-remembering-artemis-is-date-with-destiny-one-year-ago/',
  },
  {
    tema: 'Booster separation',
    dato: 'The boosters lose thrust before they let go: the separation sequence starts when their chamber pressure drops, about 9 s before separation, while the RS-25 engines throttle down. Then 16 small motors, four at each end of each booster, push them away.',
    fuente: 'Addona et al., "Dynamics and Clearance Analysis of NASA\'s Space Launch System Block-1 and Block-1B Solid Rocket Booster Separation Event", AAS 25-122',
    url: 'https://ntrs.nasa.gov/citations/20240016417',
  },
  {
    tema: 'SLS Block 1 rocket',
    dato: '322 ft (98 m) tall and 5.75 million lb at liftoff, with 8.8 million lb of thrust. The orange core stage is over 212 ft tall and 27.6 ft wide with four RS-25 engines. Each five-segment booster is 177 ft tall and 12 ft wide. The stage adapter is 27.5 ft tall and narrows to 16.5 ft; the upper stage (ICPS) is about 45 ft by 16.7 ft. The booster plumes are bright from aluminum oxide; the RS-25 plumes, mostly water vapor, are nearly transparent.',
    fuente: 'NASA, Space Launch System fact sheet FS-2023-05-119-MSFC; NASA LVSA and ICPS reference pages; Mehta et al. (2024)',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/07/0080-sls-fact-sheet-jun2023-508-1.pdf',
  },
  {
    tema: 'Orion launch abort system',
    dato: 'The abort system is 50 ft tall with its ogive panels around the capsule and 44 ft without them. The tower is 3 ft wide and opens to 17 ft at the base. On Artemis I only its jettison motor was live.',
    fuente: 'NASA, Launch Abort System reference page and Orion Launch Abort System fact sheet',
    url: 'https://www.nasa.gov/reference/launch-abort-system/',
  },
  {
    tema: 'Mobile Launcher 1 and Pad 39B',
    dato: 'The mobile launcher has a two-story base 25 ft high, 165 ft long and 135 ft wide on six 22 ft mounts, so its deck is 47 ft above the ground. Its tower is 40 ft square and about 345 ft tall, with umbilical arms and the crew access arm. Pad 39B is protected by three lightning towers about 600 ft tall that hold a catenary wire with nine downleads.',
    fuente: 'NASA, Mobile Launcher 1 fact sheet (2021); Mata et al., "A New Comprehensive Lightning Instrumentation System for Pad 39B", ICLP 2010; tower height from Spectrum News (Aug 28, 2022)',
    url: 'https://www.nasa.gov/wp-content/uploads/2021/04/final_-_mobile_launcher_1_fact_sheet.pdf',
  },
  {
    tema: 'Mars season on arrival',
    dato: 'The solar longitude Ls comes from the real position of Mars on the arrival date. The weather is taken from the Curiosity sol with the same Ls.',
    fuente: 'JPL, Approximate Positions of the Planets; Curiosity REMS',
    url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
  },
  {
    tema: 'Stars and constellations',
    dato: 'The 5,044 stars down to magnitude 6 are in their real positions, with their real brightness and color. The constellations are the 88 recognized by the IAU.',
    fuente: 'XHIP, An Extended Hipparcos Compilation (Anderson and Francis 2012), via d3-celestial',
    url: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/137D',
  },
  {
    tema: 'Planets in the sky and the ship\'s trajectory',
    dato: 'The Sun, the Moon and the planets appear where they were on the mission date, seen from the ship or from Mars. The ship follows a transfer orbit calculated with Lambert\'s problem.',
    fuente: 'astronomy-engine; brightness from Mallama and Hilton (2018)',
    url: 'https://arxiv.org/abs/1808.01973',
  },
  {
    tema: 'Solar Maximum',
    dato: 'On October 15, 2024, NASA and NOAA announced that the Sun had reached the maximum phase of its 11-year cycle.',
    fuente: 'NASA, "NASA, NOAA: Sun Reaches Maximum Phase in 11-Year Solar Cycle"',
    url: 'https://science.nasa.gov/science-research/heliophysics/nasa-noaa-sun-reaches-maximum-phase-in-11-year-solar-cycle/',
  },
  {
    tema: 'Buried ice in Utopia Planitia',
    dato: 'In 2016 the SHARAD radar on Mars Reconnaissance Orbiter found an ice deposit holding as much water as Lake Superior, covered by 1 to 10 m of soil.',
    fuente: 'NASA JPL / University of Texas, "Mars Ice Deposit Holds as Much Water as Lake Superior" (2016)',
    url: 'https://www.jpl.nasa.gov/news/mars-ice-deposit-holds-as-much-water-as-lake-superior/',
  },
  {
    tema: 'Opportunity and the global storm of 2018',
    dato: 'The solar-powered Opportunity rover stopped communicating on June 10, 2018, during a dust storm that covered the planet.',
    fuente: 'NASA Science, MER Opportunity mission',
    url: 'https://science.nasa.gov/mission/mer-opportunity/',
  },
  {
    tema: 'Perseverance in Jezero',
    dato: 'Perseverance landed in Jezero Crater, an ancient lake with a delta, on February 18, 2021, and stores rock samples in sealed tubes.',
    fuente: 'NASA Science, Mars 2020 Perseverance mission',
    url: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
  },
  {
    tema: 'The seven minutes of terror',
    dato: 'The cruise stage separates 10 minutes before entry. The capsule enters at about 19,500 km/h, and the heat shield reaches about 1300 °C around 75 s. The 21.5 m parachute opens at 240 s, at about 11 km and 1512 km/h, and the heat shield drops 20 s later. The radar measures from 7 to 8 km, and terrain navigation works between 4.2 and 2.2 km. At 2.1 km the backshell is released and the engines start. At 20 m and 2.7 km/h the sky crane lowers the rover on 7.6 m cables.',
    fuente: 'NASA/JPL, Mars 2020 Perseverance Landing Press Kit, Mission Overview (2021)',
    url: 'https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/',
  },
  {
    tema: 'Reconstructed trajectory of Perseverance',
    dato: 'Entry is counted when crossing the 3522.2 km radius, 128.2 km above the MOLA areoid, at 5333.6 m/s. Peak load comes at 87.6 s, the parachute fires at Mach 1.82 at 240.6 s, the heat shield separates at 263.2 s and the backshell at 357.5 s. Touchdown, at 418.7 s, was at 0.83 m/s.',
    fuente: 'Karlgaard, Schoenenberger, Dutta and Way, "Mars Entry, Descent, and Landing Instrumentation 2 Trajectory, Aerodynamics, and Atmosphere Reconstruction", AIAA SciTech 2022, table 8',
    url: 'https://ntrs.nasa.gov/citations/20210024320',
  },
  {
    tema: 'Time of entry and landing',
    dato: 'Perseverance entered the atmosphere at 20:36:50 and touched the ground in Jezero at 20:43:49 UTC, spacecraft time, on February 18, 2021: 6 minutes and 59 seconds. On Earth, people learned of it at 20:55:11.',
    fuente: 'Wong et al., "Mars 2020 Perseverance Trajectory Reconstruction and Performance from Launch through Landing", JPL (2021)',
    url: 'https://ntrs.nasa.gov/citations/20230006978',
  },
  {
    tema: 'Earth seen from space',
    dato: 'The ground color is the Blue Marble: Next Generation mosaic from December 2004. The city lights are the 2016 Black Marble from the Suomi NPP satellite, and the clouds are a Blue Marble composite.',
    fuente: 'NASA Earth Observatory / NASA Goddard Space Flight Center',
    url: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry',
  },
  {
    tema: 'The Moon',
    dato: 'The color is the LROC camera map and the relief is the LOLA laser altimetry, both from Lunar Reconnaissance Orbiter, prepared in the CGI Moon Kit.',
    fuente: "NASA's Scientific Visualization Studio, CGI Moon Kit; data from NASA/GSFC/Arizona State University",
    url: 'https://svs.gsfc.nasa.gov/4720',
  },
  {
    tema: 'Apollo 13',
    dato: 'In April 1970 an oxygen tank exploded on the way to the Moon. The crew adapted lithium hydroxide cartridges with materials they had on board.',
    fuente: 'NASA, Apollo 13 mission',
    url: 'https://www.nasa.gov/mission/apollo-13/',
  },
  {
    tema: 'Sound on Mars',
    dato: 'On Mars the same sound arrives about 20 dB weaker than on Earth, and high notes fade quickly. There are two speeds of sound: about 240 m/s for low notes and 250 m/s for high notes.',
    fuente: 'Maurice et al., "In situ recording of Mars soundscape", Nature 605 (2022)',
    url: 'https://doi.org/10.1038/s41586-022-04679-0',
  },
  {
    tema: 'Quindar tones',
    dato: 'Apollo Mission Control transmissions began with a 2525 Hz tone and ended with a 2475 Hz tone, each 250 ms long.',
    fuente: 'Quindar tones (summary with references)',
    url: 'https://en.wikipedia.org/wiki/Quindar_tones',
  },
  {
    tema: 'Roll-out solar panels',
    dato: 'The ROSA roll-out panel was tested on the ISS in June 2017. Shane Kimbrough and Thomas Pesquet installed the first iROSA panels on spacewalks in June 2021.',
    fuente: 'NASA, "Rolling Out a Path to Future Space Travel"; Redwire, press releases on the iROSA installation (2021).',
    url: 'https://www.nasa.gov/directorates/spacetech/Rolling_Out_a_Path_to_Future_Space_Travel',
  },
  {
    tema: 'Tilt of a fixed panel',
    dato: 'As a general rule, a fixed panel faces the equator and is tilted at an angle close to the latitude of the site.',
    fuente: 'Penn State University, course EMSC 297, "Solar Array Orientation".',
    url: 'https://www.e-education.psu.edu/emsc297/node/681',
  },
  {
    tema: 'ISS electrical power',
    dato: 'The panels give between 150 and 170 V of direct current. It is regulated to 160 V on the primary bus and stepped down to 124.5 V on the secondary bus, which feeds the equipment.',
    fuente: 'Electrical system of the International Space Station (summary with references to NASA and Boeing).',
    url: 'https://en.wikipedia.org/wiki/Electrical_system_of_the_International_Space_Station',
  },
  {
    tema: 'Leak check before opening a hatch',
    dato: 'When the Dragon spacecraft arrived in January 2015, Samantha Cristoforetti pressurized the vestibule between the hatches to 260 mmHg and checked for 20 minutes that the pressure held before opening.',
    fuente: 'ESA, Futura mission logbook, day 50.',
    url: 'https://outpost42.esa.int/blog/diario-di-bordo/single/l50-dragon-has-arrived/',
  },
  {
    tema: 'Crane for unloading modules',
    dato: 'The Lunar Surface Manipulation System from NASA Langley is a light lattice crane moved by cables, designed to lower habitats and rovers from a lander. Its flight version would lift about one ton on the Moon.',
    fuente: 'NASA Langley, "Lightweight Crane Technology Could Find a Home on the Moon".',
    url: 'https://www.nasa.gov/centers-and-facilities/langley/lightweight-crane-technology-could-find-a-home-on-the-moon/',
  },
  {
    tema: 'KRUSTY reactor test',
    dato: 'The Kilopower test reactor ran in Nevada between November 2017 and March 2018 and ended with a 28-hour full-power test that simulated a mission.',
    fuente: 'NASA and NNSA, "Demonstration Proves Nuclear Fission System Can Provide Space Exploration Power" (2018).',
    url: 'https://www.nasa.gov/news-release/demonstration-proves-nuclear-fission-system-can-provide-space-exploration-power/',
  },
  {
    tema: 'Where to put a surface reactor',
    dato: 'The NASA Fission Surface Power project sets the dose limit at 1 km from the reactor. An earlier study prefers installing it in a dug pit so the soil itself shields it.',
    fuente: 'NASA, Fission Surface Power, presentation at ASCEND 2022 (NTRS 20220014952), and NTRS 20060011236.',
    url: 'https://ntrs.nasa.gov/citations/20220014952',
  },
  {
    tema: 'ISS Veggie garden',
    dato: 'The plants grow in fabric pillows with baked clay, slow-release fertilizer and wicks that draw water from a mat. Above them are red, blue and green LED lights and a clear bellows held on with magnets. Each pillow is thinned to one plant.',
    fuente: 'NASA, "Veggie Plant Growth System Activated on International Space Station" (2014).',
    url: 'https://www.nasa.gov/missions/station/veggie-plant-growth-system-activated-on-international-space-station',
  },
  {
    tema: 'First Veggie crop',
    dato: 'In 2014 the wicks did not draw up enough water, and the crew had to water the pillows directly.',
    fuente: 'NASA, VEG-01 experiment report, NTRS 20150001374.',
    url: 'https://ntrs.nasa.gov/citations/20150001374',
  },
  {
    tema: 'The first lettuce eaten in space',
    dato: 'The red romaine lettuce Outredgeous grew for 33 days in Veggie. On August 10, 2015, the crew cleaned it with citric acid wipes, ate half and froze the rest to be analyzed on Earth.',
    fuente: 'collectSPACE, "Astronauts eat space-grown lettuce" (2015), with information from NASA.',
    url: 'https://www.collectspace.com/news/news-081015c-astronauts-space-grown-lettuce.html',
  },
  {
    tema: 'Scott Kelly\'s zinnias',
    dato: 'In late 2015 water leaked out of the wicks and the zinnias got covered in mold. With the fan on high they dried out. NASA named Kelly an autonomous gardener so he could decide when to water, and in January 2016 they bloomed.',
    fuente: 'Space.com, "A Garden Grows in Space: First Zinnias Bloom" (2016), with information from NASA.',
    url: 'https://www.space.com/31658-zinnia-flowers-bloom-in-space-photo.html',
  },
  {
    tema: 'Cut and regrow',
    dato: 'In 2017 the crew tested cutting only some of the lettuce and mizuna leaves in Veggie so the plant would keep producing.',
    fuente: 'NASA, "Third Lettuce Crop Begins Growing Aboard Station" (2017).',
    url: 'https://www.nasa.gov/feature/third-lettuce-crop-begins-growing-aboard-station',
  },
  {
    tema: 'Radishes in space',
    dato: 'The PH-02 experiment grew radishes in the Advanced Plant Habitat. They mature in 27 days. Kate Rubins harvested 20 on November 30, 2020.',
    fuente: 'NASA, "Astronauts Harvest Radish Crop on International Space Station" (2020).',
    url: 'https://www.nasa.gov/feature/astronauts-harvest-radish-crop-on-international-space-station',
  },
  {
    tema: 'Chile peppers in space',
    dato: 'The PH-04 experiment grew the improved Española chile pepper for 137 days in 2021, with harvests on October 29 and November 26: 26 peppers from four plants.',
    fuente: 'NASA, Plant Habitat-04 experiment fact sheet.',
    url: 'https://www.nasa.gov/sites/default/files/atoms/files/plant_habitat-04.pdf',
  },
  {
    tema: 'Decompression sickness and prebreathe',
    dato: 'Decompression sickness, the bends, is caused by gas bubbles when the pressure drops, as when going from the cabin to a suit. It causes joint pain, itching and, in severe cases, nerve problems. The ISS In-Suit Light Exercise protocol spends 40 minutes breathing pure oxygen by mask and then lowers the airlock to 10.2 psi (70.3 kPa). Other protocols are 4 hours of oxygen in the suit at 14.7 psi, or a night camped out in the airlock at 10.2 psi. A break in the prebreathe adds time or forces a restart.',
    fuente: 'NASA Office of the Chief Health and Medical Officer, technical brief OCHMO-TB-037, "Decompression Sickness (DCS) Risk Mitigation", Rev. D.',
    url: 'https://www.nasa.gov/sites/default/files/atoms/files/dcs_technical_brief_ochmo.pdf',
  },
  {
    tema: 'First use of the ISLE prebreathe',
    dato: 'The In-Suit Light Exercise prebreathe was first used on the third spacewalk of STS-134, in May 2011, to avoid the overnight campout in the airlock.',
    fuente: 'NASASpaceflight.com, "STS-134: EVA-3 debuts ISLE" (2011).',
    url: 'https://www.nasaspaceflight.com/2011/05/sts-134-eva-3-debuts-isle-mmt-no-mission-extension/',
  },
  {
    tema: 'Exploration atmosphere',
    dato: 'NASA recommends that future Moon and Mars habitats live at 56.5 kPa (8.2 psi) with 34% oxygen, with a 29.6 kPa suit. In chamber tests, a 20-minute prebreathe at 85% oxygen gave a 4% rate of mild decompression sickness in 50 simulated spacewalks.',
    fuente: 'Garbino et al., "Development, Validation and Approval of a Planetary Extravehicular Activity Prebreathe Protocol: NASA Exploration Atmosphere Tests 1 & 2", NASA (2023), NTRS 20230015380.',
    url: 'https://ntrs.nasa.gov/citations/20230015380',
  },
  {
    tema: 'Suiting up and the suit leak check',
    dato: 'The cooling garment goes on first, then the lower torso, and the astronaut dives up into the hard upper torso while a crewmate locks the body seal. The cap, helmet and gloves go last. For the leak check, the suit is pressurized 29.6 kPa above the airlock and its oxygen supply is closed: a leak of up to 1.38 kPa per minute is normal. The airlock pump-down pauses at 34.48 kPa for another check.',
    fuente: 'Canadian Space Agency, "Suiting Up" educator guide (Space Shuttle EMU), archived 2006.',
    url: 'https://bac-lac.wayback.archive-it.org/web/20060212133225/http://www.espace.gc.ca/asc/pdf/educator-donning.pdf',
  },
  {
    tema: 'Perchlorate in the soil of Mars',
    dato: 'In 2008 the Phoenix lander found perchlorate salts in the Martian soil. Perchlorate interferes with how the thyroid works.',
    fuente: 'Hecht et al. (2009), "Detection of Perchlorate and the Soluble Chemistry of Martian Soil at the Phoenix Lander Site", Science 325; U.S. EPA, "Perchlorate in Drinking Water".',
    url: 'https://doi.org/10.1126/science.1172466',
  },
  {
    tema: 'Orbital Replacement Units',
    dato: 'The ISS is built from units that are swapped for a spare when they fail or reach the end of their life, instead of being repaired on the spot.',
    fuente: 'Orbital replacement unit (summary with references to NASA).',
    url: 'https://en.wikipedia.org/wiki/Orbital_replacement_unit',
  },
  {
    tema: 'Swapping a unit of the oxygen generator',
    dato: 'In March 2015 Terry Virts removed and replaced the hydrogen sensor of the ISS Oxygen Generation Assembly as routine maintenance.',
    fuente: 'NASA, ISS Daily Summary Report, March 16, 2015.',
    url: 'https://www.nasa.gov/blogs/stationreport/2015/03/16/iss-daily-summary-report-03-16-15/',
  },
  {
    tema: 'Sealing a leak on the ISS (2018)',
    dato: 'In August 2018 the crew traced a slow pressure drop to a 2 mm hole in the orbital module of Soyuz MS-09. They covered it with Kapton tape and then with a cloth soaked in sealant, and the pressure held.',
    fuente: 'Spaceflight Now, "Cosmonauts plug small air leak on the International Space Station" (August 30, 2018).',
    url: 'https://spaceflightnow.com/2018/08/30/cosmonauts-plug-small-air-leak-on-the-international-space-station/',
  },
  {
    tema: 'Finding a leak with tea leaves (2020)',
    dato: 'In October 2020 the ISS crew closed the hatches to isolate the leaking section of the Zvezda module, released tea leaves and saw them drift toward a small crack, which they covered with Kapton tape.',
    fuente: 'Universe Today, "The Crew of the ISS has Found the Source of the Station\'s Air Leak" (2020), with information from Roscosmos.',
    url: 'https://www.universetoday.com/148443/the-crew-of-the-iss-has-found-the-source-of-the-stations-air-leak/',
  },
  {
    tema: 'Lithium hydroxide canisters',
    dato: 'On the Space Shuttle, lithium hydroxide canisters were the main way to remove CO2. Cabin air went from a fan through two canisters that removed CO2 and odors. A spent canister cannot be reused and has to be replaced.',
    fuente: 'Smithsonian National Air and Space Museum, "Air Cleaner, Orbiter Cabin, Space Shuttle"; Matty (2010), NASA, NTRS 20100021976.',
    url: 'https://airandspace.si.edu/collection-objects/air-cleaner-orbiter-cabin-space-shuttle/nasm_A20170094000',
  },
  {
    tema: 'Cleaning the panels of InSight',
    dato: 'On May 22, 2021, the InSight team used the robotic arm to trickle sand next to a solar panel at windy noon. The blowing grains carried some dust off and the lander gained about 30 watt-hours per sol.',
    fuente: 'NASA JPL, "NASA\'s InSight Mars Lander Gets a Power Boost" (2021).',
    url: 'https://www.jpl.nasa.gov/news/nasas-insight-mars-lander-gets-a-power-boost',
  },
  {
    tema: 'How Perseverance takes a sample',
    dato: 'Before drilling, Perseverance grinds a patch about 5 cm wide off the rock and studies it up close with PIXL, an X-ray instrument, and SHERLOC, an ultraviolet instrument, and its WATSON camera. Then it drills a core and seals it in a tube.',
    fuente: 'NASA Science, Perseverance blog "Navigating a Slanted River"; NASA, "WATSON\'s View of Dourbes in Mars\' Jezero Crater".',
    url: 'https://science.nasa.gov/blog/navigating-a-slanted-river',
  },
  {
    tema: 'The first Perseverance sample',
    dato: 'On sol 164, in August 2021, the corer reached its full commanded depth of 7 cm, and the tube was sealed and stored. The volume check showed it was empty: the rock had crumbled into powder.',
    fuente: 'NASA Science, "Assessing Perseverance\'s First Sample Attempt" (2021).',
    url: 'https://science.nasa.gov/blog/assessing-perseverances-first-sample-attempt/',
  },
  {
    tema: 'Perseverance sample tubes',
    dato: 'Perseverance carries 43 sample tubes in total.',
    fuente: 'NASA JPL, PIA24305, "Installing Perseverance\'s Sample Tubes" (2020).',
    url: 'https://photojournal.jpl.nasa.gov/catalog/PIA24305',
  },
  {
    tema: 'Preparing samples on Curiosity',
    dato: 'The CHIMRA system on Curiosity passes drill powder through a 150-micrometer sieve and delivers a portion to the SAM and CheMin instruments. A human hair is about 100 micrometers thick.',
    fuente: 'NASA, PIA16691, "Preparing Samples on Mars".',
    url: 'https://science.nasa.gov/photojournal/preparing-samples-on-mars',
  },
  {
    tema: 'Clay found by CheMin',
    dato: 'In March 2013, the CheMin X-ray diffraction instrument found that the John Klein rock was at least 20% clay minerals, which form in water. NASA concluded that Gale Crater once had conditions suited for microbial life.',
    fuente: 'NASA JPL, "NASA Rover Finds Conditions Once Suited for Ancient Life on Mars" (March 12, 2013).',
    url: 'https://www.jpl.nasa.gov/news/nasa-rover-finds-conditions-once-suited-for-ancient-life-on-mars/',
  },
  {
    tema: 'Evolved gas analysis on Curiosity',
    dato: 'After a successful CheMin analysis of the Hutton sample in 2020, SAM heated the powder in an oven and sent the released gases, such as water vapor, CO2, oxygen and sulfur compounds, to its mass spectrometer. Heating takes so much power that the next sol was used to recharge the batteries.',
    fuente: 'NASA Science, Curiosity blog, "Sols 2676-2679: 4 Sols of Love for Curiosity" (2020).',
    url: 'https://science.nasa.gov/blog/sols-2676-2679-4-sols-of-love-for-curiosity/',
  },
  {
    tema: 'Medical care far from Earth',
    dato: 'On Mars missions, communication delays and the impossibility of an evacuation call for a more autonomous Crew Medical Officer. According to NASA-STD-3001, a planetary mission must include at least one physician on the crew.',
    fuente: 'Thompson et al., "The Exploration Crew Medical Officer of the Future", NASA (2021), NTRS 20205008928.',
    url: 'https://ntrs.nasa.gov/citations/20205008928',
  },
  {
    tema: 'Resting heart rate',
    dato: 'A normal resting heart rate for adults is 60 to 100 beats per minute.',
    fuente: 'Mayo Clinic, "Heart rate: What\'s normal?".',
    url: 'https://www.mayoclinic.org/healthy-lifestyle/fitness/expert-answers/heart-rate/faq-20057979',
  },
  {
    tema: 'Daily Planning Conference',
    dato: 'ISS crews start and end each day with a Daily Planning Conference with the flight control teams to go over the plan, the changes and any questions.',
    fuente: 'ESA, Outpost 42 blog, "The astronaut daily schedule".',
    url: 'https://outpost42.esa.int/blog/the-astronaut-daily-schedule/',
  },
  {
    tema: 'Spacecraft navigation',
    dato: 'Star trackers image the star field to find the orientation of a spacecraft. Deep space position comes mainly from Deep Space Network radio tracking (two-way Doppler and range), and Orion can also navigate with a camera that measures the size and angle of the Moon and Earth.',
    fuente: 'NASA, Orion optical navigation papers (NTRS 20180004519) and DSN radiometric tracking overview.',
    url: 'https://ntrs.nasa.gov/citations/20180004519',
  },
  {
    tema: 'Crew medical checks on the ISS',
    dato: 'Each ISS crew member has a weekly private medical conference with a flight surgeon over a private audio and video link. Crew members also examine each other in periodic health status exams.',
    fuente: 'NASA, "Houston We Have a Podcast: Mission Control Crew Health Consoles", and NASA technical report NTRS 20080010877.',
    url: 'https://www.nasa.gov/podcasts/houston-we-have-a-podcast/mission-control-crew-health-consoles',
  },
  {
    tema: 'Inventory on the ISS',
    dato: 'Every item on the ISS has a barcode and is tracked in the Inventory Management System. Crew time is budgeted at 20 minutes a day for it, and auditing a cargo bag by hand takes about 20 minutes.',
    fuente: 'NASA, RFID for ISS inventory, NTRS 20100020164.',
    url: 'https://ntrs.nasa.gov/api/citations/20100020164/downloads/20100020164.pdf',
  },
  {
    tema: 'Air filters on the ISS',
    dato: 'Without gravity, particles do not settle. ISS crews vacuum the inlets of the bacteria filters every week, and fan screens and grilles are cleaned in the weekly housekeeping.',
    fuente: 'NASA technical paper on ISS bacteria filter elements, NTRS 20170006617.',
    url: 'https://ntrs.nasa.gov/api/citations/20170006617/downloads/20170006617.pdf',
  },
  {
    tema: 'Spacesuit glove inspection',
    dato: 'After a cut in a glove from the STS-116 spacewalks was found on the ground in 2007, NASA had spacewalkers check their gloves several times during each spacewalk and inspect them inside before and after.',
    fuente: 'NASA, "Glove Inspection Technology Lends a Helping Hand to Future Spacewalks".',
    url: 'https://www.nasa.gov/missions/station/glove-inspection-technology-lends-a-helping-hand-to-future-spacewalks',
  },
]

/** Lo que el juego simplifica o inventa para poder jugarse. Se muestra junto a las fuentes. */
export const SUPUESTOS: string[] = [
  'Routine duties follow ISS practice, but how often they come (every 2 to 4 mission days, and never more than once every 2.5 real minutes) and what they give or cost are game values: 4 fatigue points from the planning conference, 0.2% or 1% of propellant for a drift, 1.5 kg of food found or expired, 5% less radiation while sleeping behind the stowage, +2% for the CO2 Scrubber, 50% more wear or illness risk when skipped, and 10% more chance of a suit leak.',
  'The course drift, glove wear, inventory gaps and filter pressure drops shown in the routine duties are game readings, not real data. The 60% glove wear limit and the 180 Pa filter limit are game values.',
  'The missions in the Mission Briefing are training situations. The premises and the messages from Mission Control or from home are fiction. The data that comes with them is real.',
  'Solar storms are replayed from the 2024 records even in missions from other years, more or less often depending on the solar cycle phase that the game estimates.',
  'Sounds are generated in the browser. Their levels and tones are game choices inspired by real measurements.',
  'Mission time runs faster than real time. The scale is always shown on screen, and the commander controls it.',
  'The weather is what Curiosity measured in Gale Crater. For other sites, an estimated adjustment to temperature and light is applied.',
  'Solar storms happen on the same dates as in 2024, counting from launch day. The game assumes the ship is in the path of the particles, which is not always true.',
  'The dose of each solar storm is a game estimate based on how many instruments recorded it. It is not a measurement.',
  'Dust opacity and dust storms come from the game\'s own model. Curiosity\'s public data does not include them.',
  'The size of the habitat, panels, batteries and recycler, and the masses of the supplies, are game design values inspired by the ISS and NASA studies.',
  'Each lithium hydroxide cartridge holds 3 kg of chemical. How much it absorbs comes from the chemistry of the reaction, not from a real cartridge.',
  'The wear on each piece of equipment, the chance of a random breakdown and how much each kit repairs are game values.',
  'The thresholds at which the body gets hurt (oxygen, CO2, cold, dehydration) are approximations for the game.',
  'The human body is modeled with simple equations. It is for learning cause and effect, not for medical use.',
  'The trips of 150, 210 and 259 days and the distances on screen are approximate. 259 days is the real length of a Hohmann transfer.',
  'The launch is the real ascent of Artemis I, which carried an uncrewed Orion toward the Moon. A crewed mission to Mars would need a different, larger vehicle and would climb differently; no rocket has yet launched a crew to Mars. The date and the light of the sky are those of the mission, not of the Artemis I night launch.',
  'Launch times, altitudes and speeds come from Artemis I. Between those moments the game draws smooth curves through them. The first 10 s are taken as straight up, and the tilt of the rocket comes from those curves.',
  'The acceleration on screen is calculated from those curves, plus the part of gravity the rocket fights while climbing, without air drag. It starts at the real 1.5 g of liftoff (8.8 million lb of thrust for 5.75 million lb) and stays near 2 g. The real one varies more: it drops when the boosters burn out and the engines throttle.',
  'The service module fairing time as flown is not published. The game keeps the planned 5 s before the abort tower. Core stage separation is placed 12 s after engine cutoff, as in the plan.',
  'After core stage separation the game goes on to the cruise. Artemis I stayed in Earth orbit and its upper stage fired 1 h 29 min after liftoff to leave for the Moon.',
  'The first 15 s after liftoff run in real time and the rest of the climb at ×10. The separated parts drift away more slowly than real ones would, so they can be seen at that speed.',
  'The pad is drawn simply: the mobile launcher, its arms, the lightning towers and the ground around them have real sizes, but their exact positions and the shape of the coast are approximate. The exhaust plumes widen as the air thins with a simple exponential model of air pressure.',
  'The return to Earth is not simulated. The mission ends when the surface stay is complete.',
  'The descent follows the real trajectory of Perseverance, an uncrewed robot, at any landing site. A crewed ship would be heavier and would come down differently.',
  'The cruise stage separates 10 minutes before entry. The game starts at entry and shows it moving away in the first seconds.',
  'Between the events of the reconstructed trajectory, height and speed are interpolated in a straight line. Height is measured from the floor of Jezero.',
  'The acceleration on screen is calculated from the change in speed between those events and reaches about 10 g at the peak. Under the parachute and with the engines on, Mars gravity is added.',
  'In the descent animation, the distance to the ground is compressed so the ship and the planet can be seen at the same time.',
  'Earth\'s clouds come from a satellite composite, not from the day of the mission, and they drift slowly over the ground. On the Earth map the sea is darkened, because the sea floor cannot be seen from orbit.',
  'The assembly procedures follow real practice, but their steps, order and timing are simplified so they can be played. The seconds you have to press and hold are not the real ones.',
  'How well the panels perform based on their orientation is a game model: the cosine of the angle to the noon Sun at the equinox, plus 15% diffuse light.',
  'The dose the reactor adds depending on where it is placed, the damage from overvoltage and the extra power use at low voltage are game values.',
  'The chance of an airlock leak or a dent in the hull, the 1 mmHg limit in the pressure test and the 1 mm limit for marks on the hull come from the game.',
  'The garden has six pillows, like Veggie, but gives more oxygen and food than a real Veggie: up to 0.7 kg of oxygen per day and between 0.6 and 1.2 kg per pillow per harvest.',
  'How the growing medium dries, how much moisture each mL adds, when mold appears and how it affects plant health are game models. The chile pepper harvest at 110 days is an estimate based on PH-04.',
  'Spacewalks, repairs, samples and treatments follow real practice, but their steps are simplified and take a few real seconds. While someone is in the middle of one, time runs no faster than ×600.',
  'The habitat keeps the ISS atmosphere of 101.3 kPa. The risk of the bends after a short or skipped prebreathe (40% and 70%), the chance of a suit leak and the extra oxygen a leaking suit loses outside (0.08 kg per hour) are game values.',
  'The output curve in the repair test, the chance that a spare is not seated, the pressure limit after a patch (0.5 kPa in one hour), the CO2 curve after a cartridge swap and how much a badly seated cartridge absorbs are game values.',
  'How much dust each tool and brushing direction removes, and how much light a scratched panel loses for good (2% to 5%), are game values.',
  'The rocks at each sample site, their science value, the 50% chance that a cracked rock crumbles, the mineral and gas readings in the lab, the 3% detection limit and the rule that a sample counts if it keeps at least 60% of its value are game models.',
  'The findings, diagnoses and treatments in the Medical Bay are simplified, based on common problems of spaceflight. They are for learning, not for medical use.',
  'The Quick demo mission compresses only time: it uses the real 150-day fast trajectory, a 3-sol surface stay with 2 samples, and starts each phase at the highest time scale allowed. Every rate, dose, supply and constant stays the same as in a full mission.',
  'The difficulty levels change only game values: Cadet halves the chance of a random breakdown, gives 50% more time to decide in an emergency, sends hints and repeats shortage alerts twice as often. Commander has 60% more random breakdowns, 30% less time to decide and repeats shortage alerts half as often.',
  'The mission score, its six parts and their weights are game design values for learning. They are not a NASA rating. The learning objectives are checked against what happened in your mission.',
]
