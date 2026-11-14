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
  /** Energía media por tripulante y día que debe dar la comida: 3 035 kcal (NASA-STD-3001 Vol. 2 [V2 7003]). */
  MENU_KCAL_DIA: 3035,
  /** kcal de más por cada hora de salida con traje (NASA-STD-3001 Vol. 2 [V2 7004]). */
  EVA_KCAL_H: 200,
  /** Diseño del juego: las 3 035 kcal del estándar repartidas en los 1.83 kg de comida de la ISS. */
  KCAL_POR_KG_COMIDA: 3035 / 1.83,
  /** Déficit de energía por kg de peso perdido: unas 7 700 kcal (Hall 2008, aproximación). */
  KCAL_POR_KG_PESO: 7700,
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
  /**
   * Regolito sobre un hábitat en Marte a 0 km (Simonsen y Nealy 1991, NASA TP-3079): casi toda la
   * reducción está en los primeros 20 g/cm², unos 15 cm a 1.5 g/cm³. Con 20 g/cm², los rayos
   * cósmicos bajan de 11.9 a 10.0 rem/año (−16%) y la tormenta solar de febrero de 1956, de 9.9 a
   * 6.3 rem (−36%), en los órganos que forman la sangre.
   */
  REGOLITO_CM_UTIL: 15,
  REGOLITO_GCR: 0.16,
  REGOLITO_SPE: 0.36,

  // ---- Construcción de la base ----
  /** Volumen habitable de BEAM en la ISS una vez expandido: 565 pies³ = 16 m³. */
  MODULO_M3: 16,
  /** Distancia entre el aterrizaje del Apollo 12 y el Surveyor 3, que quedó picado por el regolito. */
  APOLLO12_M: 155,
  /** Estudio de la NASA: los módulos de aterrizaje en Marte a ~1 km entre sí (más cerca, es arriesgado). */
  PISTA_SEGURA_M: 1000,
  /** Horas locales en que MRO cruza el ecuador (órbita heliosíncrona, 3 a. m. y 3 p. m.). */
  HORAS_RELE: [3, 15] as readonly number[],

  // ---- Marte (NASA Mars Fact Sheet) ----
  /** Duración de un sol: 24 h 39 min 35 s. */
  SOL_S: 88775,
  /** Inclinación del eje de Marte: 25.19°. Con ella, sen(declinación del Sol) = sen 25.19° · sen Ls. */
  OBLICUIDAD_MARTE_GRADOS: 25.19,
  GRAVEDAD_MARTE: 3.73,
  GRAVEDAD_TIERRA: 9.82,
  /** Irradiancia solar en la órbita de Marte y en la de la Tierra, W/m². */
  IRRADIANCIA_MARTE: 586,
  IRRADIANCIA_TIERRA: 1361,
  UA_KM: 149_597_871,
  DISTANCIA_SOL_MARTE_UA: 1.524,
  VELOCIDAD_LUZ_KM_S: 299_792,
  /** Conjunción solar: NASA no envía órdenes a Marte con el Sol a menos de 2° de Marte en el cielo de la Tierra (JPL). */
  CONJUNCION_GRADOS: 2,
  /** Diseño del juego: por debajo de este ángulo el enlace se muestra como ruidoso. */
  ENLACE_RUIDOSO_GRADOS: 3.5,

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

  // ---- Día a bordo (ESA, Outpost 42) ----
  /** Horas de sueño programadas cada noche en la ISS. */
  SUENO_ISS_H: 8.5,

  // ---- Salidas al exterior ----
  /** Horas que dura el absorbente de CO2 del traje (juego: igual a la duración de diseño del EMU). */
  TRAJE_CO2_H: 8,
  /** Ventana que se planifica para una salida en la ISS. */
  EVA_VENTANA_H: 6.5,
  /** Reserva de consumibles con que se vuelve (Apollo: 30 min; el SOP del EMU da 30 min). */
  EVA_RESERVA_MIN: 30,
  /** Minutos para volver y cruzar la esclusa (juego). */
  EVA_REGRESO_MIN: 15,
  /** Distancia máxima al compañero de salida antes de avisar (juego). */
  EVA_COMPANERO_M: 25,

  // ---- Logística ----
  /** kg de basura por persona y día (estimación de la NASA para misiones largas). */
  BASURA_KG_DIA: 1,
  /** kg de basura por persona que caben en la zona de basura antes de que huela (juego). */
  BASURA_LIMITE_KG: 7,
  /** Días de vida útil de la comida envasada: el extremo bajo de los 2 a 3 años de la ISS. */
  COMIDA_VIDA_UTIL_DIAS: 730,
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
    dato: 'A sol lasts 24 h 39 min 35 s. Gravity is 3.73 m/s². Sunlight delivers 586 W/m², compared with 1,361 on Earth. The axis is tilted 25.19°, so the Sun climbs higher or lower with the season.',
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
    tema: 'A day on the space station',
    dato: 'A standard ISS crew day starts with about 1 hour of post-sleep time, then the morning Daily Planning Conference. It has 6.5 hours of work, a 1-hour midday meal, 2.5 hours of exercise and 8.5 hours of sleep. The evening conference is the goodnight call.',
    fuente: 'ESA, Outpost 42 blog, "The astronaut daily schedule".',
    url: 'https://outpost42.esa.int/blog/the-astronaut-daily-schedule/',
  },
  {
    tema: 'Saturday cleaning',
    dato: 'On the ISS the alarm rings at 06:00 UTC and the plan runs to 21:30. Saturday mornings are for cleaning: everyone vacuums the air vents, wipes the surfaces and finds lost items. Weekends are for calls with family and friends.',
    fuente: 'DLR blog, "Always on Saturday: everyday life on the ISS" (2018).',
    url: 'https://www.dlr.de/en/blog/archive/2018/always-on-saturday-everyday-life-on-the-iss',
  },
  {
    tema: 'Planning a spacewalk',
    dato: 'An ISS spacewalk is planned to fit about 6.5 hours. Oxygen, battery power and cooling water limit it, and CO2 removal limits it most. Crews wear a cuff checklist on the wrist, with a page for each suit warning.',
    fuente: 'NASA, Houston We Have a Podcast, "How to Plan a Spacewalk".',
    url: 'https://www.nasa.gov/johnson/HWHAP/how-to-plan-a-spacewalk',
  },
  {
    tema: 'Turn-back rule',
    dato: 'On the Moon, Apollo crews could only go as far as the suit consumables allowed them to walk back to the lander, after keeping a 30-minute reserve.',
    fuente: 'Bellcomm, Apollo 15 lunar surface traverse planning, NASA Apollo Lunar Surface Journal.',
    url: 'https://www.nasa.gov/wp-content/uploads/static/history/alsj/19790073512_1979073512.pdf',
  },
  {
    tema: 'Emergency oxygen in the suit',
    dato: 'The EMU suit has a Secondary Oxygen Pack, two tanks with a 30-minute emergency supply.',
    fuente: 'NASA, "Extravehicular Mobility Unit" fact sheet.',
    url: 'https://www.nasa.gov/wp-content/uploads/2009/07/188963main_extravehicular_mobility_unit.pdf',
  },
  {
    tema: 'Food shelf life',
    dato: 'The ISS shelf-stable food system has a shelf life of about 2 to 3 years. Foods for Mars missions are expected to need 5 years.',
    fuente: 'NASA Human Research Program, Food and Nutrition risk strategy (2024); Perchonok and Catauro, Thermostabilized Shelf Life Study, NASA (2009).',
    url: 'https://ntrs.nasa.gov/api/citations/20240010162/downloads/FN%20Risk%20Strategy%20ISLSWG%20Sep%202024.pdf',
  },
  {
    tema: 'Trash',
    dato: 'Long missions are estimated to make about 1 kg of trash per crew member per day. On the ISS the crew compacts it by hand into bags that leave in a cargo ship and burn up on reentry.',
    fuente: 'NASA Ames, "What is NASA’s Heat Melt Compactor?".',
    url: 'https://www.nasa.gov/ames/space-biosciences/what-is-nasas-heat-melt-compactor',
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
  {
    tema: 'Mars solar conjunction',
    dato: 'About every 26 months Mars passes behind the Sun as seen from Earth. NASA Mars missions stop sending commands while the Sun is within 2 degrees of Mars in Earth\'s sky, because the Sun\'s plasma can corrupt the radio signal. In 2015 that was from about June 7 to June 21.',
    fuente: 'NASA JPL, "Mars Missions to Pause Commanding in June Due to Sun" (2015).',
    url: 'https://www.jpl.nasa.gov/news/mars-missions-to-pause-commanding-in-june-due-to-sun/',
  },
  {
    tema: 'Signal delay from Mars',
    dato: 'The one-way light time is the Earth to Mars distance divided by the speed of light, 299,792 km/s. On Mars the game takes that distance for the mission date from the astronomy-engine ephemeris, validated against JPL Horizons, so the delay goes from about 3 to 22 minutes.',
    fuente: 'Cosinekitty, astronomy-engine (VSOP87 planetary model), checked against NASA JPL Horizons.',
    url: 'https://github.com/cosinekitty/astronomy',
  },
  {
    tema: 'How a Mars base is set up',
    dato: 'In NASA Mars Design Reference Architecture 5.0, cargo is pre-deployed one launch opportunity ahead of the crew, and its systems are checked out before the crew leaves Earth. ISRU makes the ascent propellant (oxygen) and crew consumables from the atmosphere, and nuclear surface power runs it. The crew stays about 500 days.',
    fuente: 'Drake (ed.), NASA, Mars Design Reference Architecture 5.0 Study, executive summary (December 4, 2008). Full report: NASA-SP-2009-566.',
    url: 'https://www.nasa.gov/wp-content/uploads/2015/09/373669main_2008-12-04_mars_dra5_executive_summary-presentation.pdf',
  },
  {
    tema: 'Surface power far from the crew',
    dato: 'A NASA study assumes two 40 kWe fission power units. The first one lands on a cargo lander, makes the return propellant and must be unloaded, deployed and switched on by robots before the crew arrives. Each unit is about 7,000 kg and must run more than 1 km from the habitat. Landers come down about 1 km apart, because landing closer is risky. The crew lander lands after the ascent vehicle is fueled.',
    fuente: 'Rucker, M. A., NASA, "Surface Power for Mars", FISO presentation (December 2016), from NETS 2015 paper 5074.',
    url: 'https://ntrs.nasa.gov/citations/20160014032',
  },
  {
    tema: 'Regolith shielding',
    dato: 'For a habitat on Mars at 0 km, most of the dose reduction from regolith happens in the first 20 g/cm², about 15 cm of soil. With 20 g/cm², cosmic rays drop from 11.9 to 10.0 rem per year and the February 1956 solar storm from 9.9 to 6.3 rem. The study recommends 15 to 20 cm if regolith is used.',
    fuente: 'Simonsen, L. C. and Nealy, J. E., NASA Langley, Radiation Protection for Human Missions to the Moon and Mars, NASA TP-3079 (1991).',
    url: 'https://ntrs.nasa.gov/citations/19910008686',
  },
  {
    tema: 'Inflatable habitats',
    dato: 'NASA TransHab was designed as the living module of a transit ship to Mars: a composite core inside an inflatable shell. At Johnson Space Center a test article held four times its working pressure, and a full-size one was folded and deployed in a vacuum chamber.',
    fuente: 'de la Fuente, H., Raboin, J., Spexarth, G. and Valle, G., "TransHab: NASA\'s Large-Scale Inflatable Spacecraft", AIAA (2000).',
    url: 'https://ntrs.nasa.gov/citations/20100042636',
  },
  {
    tema: 'Expanding BEAM on the ISS',
    dato: 'The first try on May 26, 2016 stopped because the module did not grow. On May 28, Jeff Williams let air in through a valve in short bursts (8 bursts and 44 seconds of air by late morning). Expansion took from 9:04 a.m. to 4:10 p.m. EDT. Eight air tanks then pressurized it in 10 minutes. Leak checks ran for a week before the hatch was opened on June 6. BEAM gives 16 m³ of habitable volume.',
    fuente: 'NASA Space Station blog, May 2016 posts, and "BEAM Fully Expanded and Pressurized" (May 28, 2016).',
    url: 'https://www.nasa.gov/blogs/spacestation/2016/05/28/beam-fully-expanded-and-pressurized/',
  },
  {
    tema: 'Landing blast ejecta',
    dato: 'Apollo 12 landed 155 m from the Surveyor 3 probe. Parts of Surveyor brought back to Earth were pitted by soil that the lunar module engine threw at high speed.',
    fuente: 'Metzger, P. T., Hintze, P. E., Trigwell, S. and Lane, J. E., "Further Analysis on the Mystery of the Surveyor III Dust Deposits" (NASA KSC, 2012).',
    url: 'https://ntrs.nasa.gov/citations/20120000029',
  },
  {
    tema: 'Talking to Earth from Mars',
    dato: 'Perseverance routinely receives commands from Earth with its X-band high-gain antenna, a hexagonal paddle that rotates. It can also send data back, but slowly: 99.9% of science data goes through the UHF antenna to passing orbiters. The MRO orbit crosses the equator at about 3 a.m. and 3 p.m. local solar time.',
    fuente: 'NASA JPL, Mars 2020 landing press kit, Telecommunications; NASA JPL, "NASA Mars Orbiter Preparing for Mars Landers\' 2016 Arrival" (2014).',
    url: 'https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/telecommunications/',
  },
  {
    tema: 'Analog base: CHAPEA',
    dato: 'NASA CHAPEA crews of four live for a year in Mars Dune Alpha, a 1,700 square foot habitat 3D-printed by ICON at Johnson Space Center in Houston. Mission 1 ran from June 25, 2023 to July 6, 2024.',
    fuente: 'NASA, Crew Health and Performance Exploration Analog (CHAPEA); NASA, "NASA is Recruiting for Yearlong Simulated Mars Mission" (ICON-built habitat).',
    url: 'https://www.nasa.gov/humans-in-space/chapea/',
  },
  {
    tema: 'Food energy',
    dato: 'The food system must give each crew member an average of 3,035 kcal per day. The reference values are 3,041 kcal for men (82.9 kg on average) and 2,344 kcal for women (65.1 kg). Each hour of spacewalk needs 200 kcal more than the normal intake.',
    fuente: 'NASA-STD-3001 Vol. 2, section 7.1 Food and Nutrition: [V2 7003] Food Caloric Content and [V2 7004] EVA Food Caloric Content.',
    url: 'https://www.nasa.gov/reference/7-0-habit-ability-functions-vol-2/',
  },
  {
    tema: 'Eating less in space',
    dato: 'On the International Space Station, crew members ate on average 80% of their recommended energy intake and weighed less on landing day than before the flight.',
    fuente: 'Smith S.M., Zwart S.R. et al. (2005), The nutritional status of astronauts is altered after long-term space flight aboard the International Space Station, Journal of Nutrition 135(3): 437-443.',
    url: 'https://doi.org/10.1093/jn/135.3.437',
  },
  {
    tema: 'What hunger does to the body',
    dato: 'In the Minnesota Starvation Experiment (1944 to 1945), 36 volunteers ate about 1,570 kcal per day for 24 weeks. They lost about 25% of their body weight, their work capacity fell, and they showed depression, constant thoughts of food and social withdrawal.',
    fuente: 'Kalm L.M., Semba R.D. (2005), They starved so that others be better fed: remembering Ancel Keys and the Minnesota experiment, Journal of Nutrition 135(6): 1347-1352.',
    url: 'https://doi.org/10.1093/jn/135.6.1347',
  },
  {
    tema: 'Energy and body weight',
    dato: 'Losing 1 kg of body weight takes an energy deficit of about 7,700 kcal, the classic 3,500 kcal per pound rule. It is an approximation: the real value changes with body fat and over time.',
    fuente: 'Hall K.D. (2008), What is the required energy deficit per unit weight loss? International Journal of Obesity 32: 573-576.',
    url: 'https://doi.org/10.1038/sj.ijo.0803720',
  },
  {
    tema: 'Long twilight on Mars',
    dato: 'Mars Pathfinder found that the sky stays bright for up to two hours after sunset, because dust reaches very high in the atmosphere. Spirit saw the same glow over Gusev Crater in 2005: sunlight kept reflecting off dust high in the air for up to two hours.',
    fuente: 'NASA/JPL, Mars Pathfinder science results (1997); NASA Astronomy Picture of the Day, Sunset Over Gusev Crater (June 20, 2005).',
    url: 'https://science.nasa.gov/image-article/apod-2005-june-20-sunset-over-gusev-crater/',
  },
  {
    tema: 'Blue sunset on Mars',
    dato: 'Curiosity filmed a sunset in Gale Crater on sol 956 (April 15, 2015). Around the Sun the sky turns blue: the very fine dust lets blue light through a little more easily and scatters it close to the direction of the Sun.',
    fuente: "NASA/JPL, NASA's Curiosity Rover Views Serene Sundown on Mars (May 8, 2015), Mastcam images PIA19400 and PIA19401.",
    url: 'https://www.jpl.nasa.gov/news/nasas-curiosity-rover-views-serene-sundown-on-mars/',
  },
  {
    tema: 'Phobos and Deimos',
    dato: 'Phobos circles Mars about 6,000 km above the surface every 7 h 39 min, faster than Mars turns, so from the ground it rises in the west and sets in the east. Deimos is farther out and takes about 30 hours per orbit, so it rises in the east and crosses the sky slowly.',
    fuente: 'NASA Science, Mars Moons.',
    url: 'https://science.nasa.gov/mars/moons/',
  },
  {
    tema: 'Suit power and heat',
    dato: 'The backpack provides electricity for the suit. The fingers get coldest, so spacesuit gloves have heaters that keep them warm while still letting the crew use tools.',
    fuente: 'NASA, Spacewalk Spacesuit Basics.',
    url: 'https://www.nasa.gov/feature/spacewalk-spacesuit-basics/',
  },
  {
    tema: 'Launch windows to Mars',
    dato: 'A rocket to Mars first reaches a low parking orbit. That orbit has to line up with the direction the ship must leave Earth, and the pad turns with Earth, so it lines up only for a short time each day, at a time that shifts from day to day. Curiosity lifted off at 10:02 a.m. EST on November 26, 2011, right when its window of 1 hour 43 minutes opened.',
    fuente: "NASA/JPL, NASA Sets Mars Science Laboratory Launch Coverage (updated November 19, 2011); NASA Science, Curiosity's Launch.",
    url: 'https://www.jpl.nasa.gov/news/nasa-sets-mars-science-laboratory-launch-coverage/',
  },
  {
    tema: 'Perseverance launch window',
    dato: 'Perseverance lifted off at 7:50 a.m. EDT on July 30, 2020, on an Atlas V from Cape Canaveral. The window changed every day of the launch period: on July 20 it ran from 9:15 to 11:15 a.m. EDT, and on August 11 from 8:55 to 9:25 a.m. EDT.',
    fuente: 'NASA, NASA, ULA Launch Mars 2020 Perseverance Rover Mission to Red Planet (July 30, 2020); NASA/JPL, Mars 2020 Perseverance Launch Press Kit.',
    url: 'https://www.jpl.nasa.gov/news/press_kits/mars_2020/launch/mission/',
  },
  {
    tema: 'Pad 39B',
    dato: 'Launch Complex 39B at Kennedy Space Center, where Artemis I lifted off, is at 28°37′38″ N, 80°37′15″ W. Florida uses Eastern Time: EST in winter and EDT from the second Sunday of March to the first Sunday of November.',
    fuente: 'Kennedy Space Center Launch Complex 39B (Wikipedia, coordinates); U.S. Energy Policy Act of 2005 (daylight saving time dates).',
    url: 'https://en.wikipedia.org/wiki/Kennedy_Space_Center_Launch_Complex_39B',
  },
  {
    tema: 'Launch weather rules',
    dato: 'Artemis I could not lift off with peak winds above 29 to 39 knots (from 132.5 ft to 457.5 ft up). After lightning within 10 nautical miles of the flight path, the team had to wait 30 minutes. It could not launch within 10 nautical miles of a thunderstorm anvil cloud, or through a cloud layer within 5 nautical miles that is more than 4,500 ft thick and reaches freezing temperatures, unless extra checks were met.',
    fuente: 'NASA, Artemis I Weather Criteria.',
    url: 'https://www.nasa.gov/missions/artemis/orion/artemis-i-weather-criteria/',
  },
  {
    tema: 'Launch weather forecast',
    dato: 'Meteorologists of the U.S. Space Force Space Launch Delta 45 forecast the weather for launches from Florida. For Artemis I they gave 90% favorable two days before, and 80% favorable for the two-hour window that opened at 1:04 a.m. EST on November 16, 2022, with thick clouds as the main concern. Lightning rules are the second leading weather cause of launch delays and scrubs at Cape Canaveral.',
    fuente: 'NASA Artemis blog, Weather Forecast 90% Favorable for Artemis I Launch (November 13, 2022) and Mission Managers Give Go to Proceed Toward Tanking (November 15, 2022); Roeder and McNamara, 45th Weather Squadron, A Survey of the Lightning Launch Commit Criteria (AMS, 2006).',
    url: 'https://www.nasa.gov/blogs/missions/2022/11/15/mission-managers-give-go-to-proceed-toward-tanking-operations-for-artemis-i/',
  },
  {
    tema: 'Launch scrubs',
    dato: 'Artemis I was scrubbed twice. On August 29, 2022, the attempt stopped at about 8:34 a.m. EDT: a test to chill the core stage engines to their start temperature failed and the two-hour window ran out. On September 3, 2022, it was called off at about 11:17 a.m. EDT for a liquid hydrogen leak while fueling the core stage. Artemis I flew on November 16, 2022.',
    fuente: 'NASA Artemis blog, Launch Attempt Scrubbed (August 29, 2022) and Artemis I Launch Attempt Scrubbed (September 3, 2022).',
    url: 'https://www.nasa.gov/blogs/missions/2022/09/03/artemis-i-launch-attempt-scrubbed/',
  },
  // Estudios del NASA Open Science Data Repository (los mismos de shared/osdr.ts), consultados el 14/11/2026.
  {
    tema: 'Muscle and bone loss in space (OSDR)',
    dato: 'Wild type mice lost significant muscle and bone mass during 33 days in microgravity on the International Space Station (Rodent Research-19, SpaceX-19, December 2019 to January 2020).',
    fuente: 'NASA Open Science Data Repository, OSD-342: Targeting myostatin/activin A protects against skeletal muscle and bone loss during spaceflight [plasma proteomics].',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-342',
  },
  {
    tema: 'Exercise during bed rest (OSDR)',
    dato: 'In the NASA 70-day bed rest study, which simulates microgravity on Earth, aerobic and resistance training effectively counteracted the decline in aerobic capacity, muscle mass, strength and endurance of 22 healthy young men.',
    fuente: 'NASA Open Science Data Repository, OSD-942: Exercise Training Attenuates the Muscle Mitochondria Genomic Response to Bed Rest (microarray data).',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-942',
  },
  {
    tema: 'Low doses of space radiation (OSDR)',
    dato: 'Leaving the protection of low Earth orbit exposes astronauts to higher cumulative doses of space radiation. Mice received low doses of gamma rays, oxygen ions or iron ions, and their spleens were studied 1, 2 and 4 months later.',
    fuente: 'NASA Open Science Data Repository, OSD-360: Effects of low dose space radiation exposures on the splenic metabolome.',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-360',
  },
  {
    tema: 'Chile peppers on the ISS (OSDR)',
    dato: 'Leafy greens grown in the Veggie chamber on the ISS were safe for the astronauts to eat. In the Advanced Plant Habitat, the PH-04 chile peppers (launched on SpaceX-22, June 2021) grew for 137 days, one of the longest continuous plant growth experiments on the ISS, and produced 26 pepper fruit.',
    fuente: 'NASA Open Science Data Repository, OSD-772: PH-04 Chile Peppers in Space.',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-772',
  },
  {
    tema: 'Veggie lettuce (OSDR)',
    dato: 'Lettuce grown in the Veggie payload on the ISS (VEG-01B, SpaceX-3, April to May 2014) was harvested and returned to Earth for chemical, microbiological and molecular analysis.',
    fuente: 'NASA Open Science Data Repository, OSD-268: Microbiological and nutritional analysis of lettuce crops grown on the International Space Station-VEG01B.',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-268',
  },
  {
    tema: 'Daily rhythms in space (OSDR)',
    dato: 'Rodent Research-7 (SpaceX-15, launched June 29, 2018) studied how the space environment changes the gut microbes of mice and how that affects their immune system, metabolism and circadian (daily) rhythms, with 48-hour video recordings in each habitat.',
    fuente: 'NASA Open Science Data Repository, OSD-253: Transcriptional analysis of kidneys from mice flown on the RR-7 mission.',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-253',
  },
  {
    tema: 'Base site images (Mars Trek)',
    dato: 'The pictures of Gale, Jezero and Utopia Planitia come from the THEMIS daytime infrared global mosaic of NASA\'s Mars Odyssey, 100 m per pixel (Mars Trek WMTS layer THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018), downloaded on November 14, 2026. Daytime infrared images emphasize the shape of the ground: slopes facing the Sun are warmer and look brighter.',
    fuente: 'NASA Mars Trek, layer "MO THEMIS-IR Day, Global Mosaic" (Mars Odyssey, THEMIS).',
    url: 'https://trek.nasa.gov/mars/',
  },
  {
    tema: 'Space weather now',
    dato: 'The flares (FLR), solar energetic particle events (SEP), geomagnetic storms (GST, with their Kp index) and coronal mass ejections (CME) of the last 30 days, downloaded from DONKI when the game asks (kept for one hour). The live mode of a mission saves them in the room when the host chooses it.',
    fuente: 'DONKI web service, Community Coordinated Modeling Center (CCMC), NASA Goddard Space Flight Center. No key. If it does not answer, the NASA API (api.nasa.gov, DEMO_KEY); if neither answers, the archived 2024 record, labeled as archived.',
    url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/',
  },
  {
    tema: 'Radiation on the ISS',
    dato: 'Absorbed dose rate measured inside the ISS by the IV-TEPC detector, one value per day: 12.53 μGy per hour on average (from 11.83 to 14.99) at location NOD3FD3 from April 8 to May 3, 2016, and 12.46 μGy per hour (from 12.05 to 13.39) at location COL1A2 from February 24 to March 14, 2017. The first gives 0.30 mGy per day, the value the game compares with. Archived data, read on November 14, 2026.',
    fuente: 'NASA Open Science Data Repository, RadLab portal and Data API (absorbed_dose_rate in μGy/hour).',
    url: 'https://visualization.osdr.nasa.gov/radlab/api/?instrument=IV-TEPC&absorbed_dose_rate>0&format=tsv',
  },
  {
    tema: 'Radiation quality factor',
    dato: 'Curiosity\'s RAD measured an average quality factor of 3.82 during the cruise to Mars and 3.05 on the surface (dose equivalent in mSv = absorbed dose in mGy × quality factor).',
    fuente: 'Hassler et al. (2014), "Mars\' Surface Radiation Environment Measured with the Mars Science Laboratory\'s Curiosity Rover", Science 343.',
    url: 'https://doi.org/10.1126/science.1244797',
  },
]

/** Lo que el juego simplifica o inventa para poder jugarse. Se muestra junto a las fuentes. */
export const SUPUESTOS: string[] = [
  'The Today schedule uses the real ISS durations, but the clock time of each block is a game choice. On the ISS, exercise and conferences shift from person to person and the family conference is usually weekly. On Mars the same plan is spread over the 24 Mars hours of a sol, and the crew keeps a 7-sol week counted from landing day.',
  'The suit CO2 absorbent lasts 8 hours in the game, the same as the EMU design length. The 15 minutes to walk back and cycle the airlock and the 25 m buddy distance are game values. Real ISS spacewalks usually go out in pairs; here the buddy can also stay inside on the radio.',
  'Food is packed in four lots 3, 6, 9 and 12 months before launch, each with a quarter of the food, and is eaten oldest first. The shelf life is 2 years, the low end of the ISS range. These lots are a game model.',
  'The trash limit (7 kg per person before it smells), the cleaning, menu and trash effects (a little health, fatigue or filter wear) and the duty that does each one are game values.',
  'Personal missions follow the real work of each role, but which ones there are and how many times each has to be done (once or twice) are game values.',
  'During a shelter order a crew member can still leave for urgent work, such as a repair, and gets the cabin dose. The crew decides; the game only logs it.',
  'The character sleeps on its own at night only if its player stands still and is not in the middle of a task. A warning comes 15 real seconds before, and after waking up a player stays awake for 90 real seconds. At fast time scales both are capped at one mission hour, and walking keeps a player awake only up to ×600. These times are game values; the sleep and fatigue rates are not changed.',
  'During the cruise the distance to Earth follows a smooth game curve that ends at the real Earth to Mars distance on arrival day. The "noisy link" warning below 3.5 degrees from the Sun is a game value. In a solar conjunction every message from Earth waits until the link is back, while real missions still get some data.',
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
  'The base works (inflatable module, regolith bags, landing pad and high-gain antenna) open once the base is running and can be done in any order. Their steps are simplified and take a few real seconds. A real crew would spread them over days and use robots for some of them.',
  'The inflatable module has the volume of BEAM, 16 m³. Filling it takes the oxygen for 21.3 kPa from the tanks, about 4.5 kg; the nitrogen is not tracked. The leak chance, the pressure readings and the 10% faster recovery while sleeping thanks to the private space are game values.',
  'Regolith bags lower the shelter dose in proportion to their thickness up to 15 cm, using the NASA TP-3079 reductions for 20 g/cm²: 16% for cosmic rays and 36% for a solar storm. Above 15 cm the game adds no more protection. The bags are taken as 1.5 g/cm³ of soil.',
  'The next cargo lander lands as soon as the pad is ready, and the map is compressed, so the pad is drawn near the base. The dust and damage it throws at each distance are game values. DRA 5.0 plans no resupply: the 2 spare parts kits your crew can take from that lander are a game reward.',
  'Antenna pointing uses the real direction of Earth seen from Mars on the mission date (astronomy-engine and the IAU rotation axis of Mars). The local hour is the game clock, taken as solar time. Without the high-gain antenna, messages from Earth wait for an orbiter relay pass at about 3:00 or 15:00, and never more than half a sol. The 3° pointing limit and the signal readings are game values.',
  'The Base Building Guide summarizes NASA studies. Real plans differ from study to study, and none of them has flown yet.',
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
  'The meal plan gives each person the NASA average of 3,035 kcal per day, not a value from their own age, weight and height. The extra 10% for a sick or injured crew member is a game value. The 200 kcal per spacewalk hour is eaten while outside.',
  'Body weight follows the energy balance at 7,700 kcal per kg. Fatigue building 6% faster for each 1% of weight lost (up to 60%) and the mood labels are game values based on the Minnesota study. They are not a medical model.',
  'In the game the helmet lights, the hand light and the suit heater all draw from the main suit battery, so their cost shows in one number. Real suits power some of these from their own batteries. The extra draw (helmet lights 15%, hand light 8%, heater 0.4% per degree below -20 °C, a third of that in sunlight) is a game value.',
  'Walking in the dark without lights halves your speed and gives a 25% chance per hour of a fall. A hand light alone cuts that chance to 30%. The base floodlights light the ground within 22 m of the habitat and halve the chance. The habitat lights (0.15 kW, 0.03 kW while all sleep) and the floodlights (0.4 kW) are game values.',
  'The height of the Sun comes from the site latitude, the season (Ls) and the hour, with noon halfway between the sunrise and sunset in the Curiosity record. The ground counts as dark with the Sun more than 8° below the horizon. How the twilight glow fades is a game curve that leaves a faint glow for about two hours.',
  'Phobos and Deimos follow their real distance and orbit period, but their place along the orbit is not taken from an ephemeris.',
  'Liftoff is at the opening of the daily launch window. The game computes it from the real trajectory to Mars and the turn of Earth: the direction the ship must leave Earth, and the moment Pad 39B can fly into a parking orbit that contains it. The sunlight in the launch scene and every date in the mission follow that moment.',
  'Window model values: allowed headings from 89° to 113° (the range the Curiosity and Perseverance windows cover in this same model), a parking orbit 185 km high, a wait in orbit of 40° to 200° of a turn, and a window of 1 to 2 hours. If the ship must leave too far north or south, the game assumes a longer wait in orbit or a sideways turn (a dog-leg). Real windows also depend on the rocket and change length from day to day.',
  'The weather at the pad comes from a game model with a fixed seed: more wind in winter, more thunderstorms on summer afternoons and thick clouds now and then. It is checked against the real Artemis I rules, simplified: the wind limit is taken at 132.5 ft, and the exceptions for lightning, anvil clouds and thick clouds are not modeled. The forecast percentage comes from the same model.',
  'A technical scrub has a 10% chance on each attempt, and 30% if the team recycles for the next day right after a technical scrub. The faults are the two that scrubbed Artemis I. These chances are game values.',
  'The final poll is at T−10 s. After two scrubs the third attempt always lifts off, so the mission never stays on the ground. Standing down 24 hours moves the attempt two days, to the window after the next one.',
  'Trouble On Board launches on December 9, 2026, a later day of the same launch period as First Base on Mars, so each mission has its own window.',
  'The Real science notes tell, in simple words, what each NASA OSDR study looked at. Most of them used mice, plants or volunteers, on Earth or on the Space Station. The game body model does not use their numbers.',
  'The base site pictures are real THEMIS infrared images from Mars Trek, cropped to a square around the base, reduced to 420 pixels and with the contrast stretched. The base point is the one the game uses for its sky: the center of Gale and of Jezero craters (IAU) and 44° N, 80° E in Utopia Planitia, which is a game choice.',
  'The glossary gives one short, simplified sentence per word, written for young players.',
  'With live space weather, day k of the downloaded month (counted from its first day) becomes day k of the mission. After those 30 days nobody knows the Sun, so the archived 2024 record takes over. Live events are used as they are, without the change in frequency that each situation applies to the 2024 record. The M and X class flares go to the mission log; the archived record only has X class.',
  'The risk level of the "The Sun right now" card is a game rule, not a NASA forecast: High if DONKI lists at least one solar particle event in the 30 days, Medium if none but at least one M or X class flare, Low otherwise. If the live service does not answer, the card shows the same 30 days of 2024 and says it is archived.',
  'Taking shelter has a cost: nobody works, and while somebody is in the shelter with nobody left in the cabin, the machines wear 1.5 times faster because nobody watches or adjusts them. The 1.5 is a game value.',
  'The comparison with the ISS uses absorbed dose, the quantity RadLab gives: the crew dose in mSv is divided by the quality factor of the cruise (3.82) and by the 0.30 mGy per day the IV-TEPC measured at one place in the ISS in April and May 2016. Doses change with the place in the station, the solar cycle and the shielding, so the number of days is a rough comparison.',
]
