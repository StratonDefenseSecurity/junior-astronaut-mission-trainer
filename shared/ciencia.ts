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
    tema: 'Respiración y metabolismo',
    dato: 'Una persona consume 0.84 kg de oxígeno y produce 1.00 kg de CO2 por día, con un gasto medio de 137 W.',
    fuente: 'Wieland (1994), Designing for Human Presence in Space: An Introduction to Environmental Control and Life Support Systems, NASA RP-1324.',
    url: 'https://ntrs.nasa.gov/citations/19940022934',
  },
  {
    tema: 'Agua, comida y esfuerzo',
    dato: '2.5 kg de agua para beber y preparar comida y 0.7 kg para higiene por persona y día; 1.83 kg de comida empacada (valor de la ISS). Gasto de 88 W durmiendo, 139 W en trabajo normal y 295 W con el traje.',
    fuente: 'NASA, Life Support Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570/REV2 (2022).',
    url: 'https://ntrs.nasa.gov/citations/20210024855',
  },
  {
    tema: 'Reciclaje de agua',
    dato: 'La Estación Espacial Internacional recupera el 98% del agua que usa la tripulación.',
    fuente: 'NASA, "NASA Achieves Water Recovery Milestone on International Space Station" (20 de junio de 2023).',
    url: 'https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/',
  },
  {
    tema: 'Límite de CO2',
    dato: 'El CO2 en cabina no debe pasar de 3 mmHg (0.4 kPa) en promedio. El límite anterior era 5.3 mmHg para estancias de 7 a 180 días.',
    fuente: 'NASA-STD-3001 Vol. 2 [V2 6004], resumido en el informe técnico OCHMO-TB-004 de NASA.',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf',
  },
  {
    tema: 'Depurador de CO2',
    dato: 'Cada depurador de la ISS retira aproximadamente (1.723 × mmHg de CO2 − 0.38) kg por día. La estación tiene dos.',
    fuente: 'NASA, informe técnico sobre el depurador CDRA de la ISS, NTRS 20050210002.',
    url: 'https://ntrs.nasa.gov/citations/20050210002',
  },
  {
    tema: 'Generador de oxígeno',
    dato: 'El generador de oxígeno de la ISS produce entre 2.3 y 9.2 kg por día y consume 3.57 kW a plena carga.',
    fuente: 'NASA, informe técnico sobre el generador de oxígeno de la ISS, NTRS 20080036243.',
    url: 'https://ntrs.nasa.gov/citations/20080036243',
  },
  {
    tema: 'Radiación en el viaje',
    dato: 'Durante el crucero a Marte la dosis medida fue de 1.84 mSv por día.',
    fuente: 'Zeitlin et al. (2013), "Measurements of Energetic Particle Radiation in Transit to Mars on the Mars Science Laboratory", Science 340.',
    url: 'https://doi.org/10.1126/science.1235989',
  },
  {
    tema: 'Radiación en Marte',
    dato: 'En la superficie de Marte la dosis medida es de 0.64 mSv por día.',
    fuente: 'Hassler et al. (2014), "Mars\' Surface Radiation Environment Measured with the Mars Science Laboratory\'s Curiosity Rover", Science 343.',
    url: 'https://doi.org/10.1126/science.1244797',
  },
  {
    tema: 'Límite de radiación',
    dato: 'NASA limita la dosis de toda la carrera de un astronauta a menos de 600 mSv.',
    fuente: 'NASA-STD-3001, NASA Spaceflight Human-System Standard, Volume 1: Crew Health, Rev. C (2023) [V1 4030].',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf',
  },
  {
    tema: 'Clima de Marte',
    dato: 'Temperatura mínima y máxima, presión e índice ultravioleta de cada sol durante un año marciano completo. Son datos de divulgación.',
    fuente: 'Estación REMS del rover Curiosity, cráter Gale. Centro de Astrobiología (CSIC-INTA) y NASA JPL.',
    url: 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json',
  },
  {
    tema: 'Tormentas solares',
    dato: 'Las 54 fulguraciones de clase X y los eventos de partículas energéticas solares registrados en 2024.',
    fuente: 'DONKI, Community Coordinated Modeling Center, NASA Goddard Space Flight Center.',
    url: 'https://ccmc.gsfc.nasa.gov/DONKI/',
  },
  {
    tema: 'Marte',
    dato: 'Un sol dura 24 h 39 min 35 s; la gravedad es 3.73 m/s²; llegan 586 W/m² de luz solar, contra 1 361 en la Tierra.',
    fuente: 'NASA, Mars Fact Sheet, NSSDCA.',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
  },
  {
    tema: 'Oxígeno en sangre',
    dato: 'La saturación se calcula con la curva de disociación de la hemoglobina.',
    fuente: 'Severinghaus (1979), "Simple, accurate equations for human blood O2 dissociation computations", J. Appl. Physiol. 46.',
    url: 'https://doi.org/10.1152/jappl.1979.46.3.599',
  },
  {
    tema: 'Frecuencia cardiaca',
    dato: 'La frecuencia máxima se estima como 208 − 0.7 × edad.',
    fuente: 'Tanaka, Monahan y Seals (2001), "Age-predicted maximal heart rate revisited", J. Am. Coll. Cardiol. 37.',
    url: 'https://doi.org/10.1016/S0735-1097(00)01054-8',
  },
  {
    tema: 'Traje espacial',
    dato: 'El traje EMU funciona con oxígeno puro a 29.6 kPa, lleva 0.55 kg de oxígeno y está diseñado para salidas de 7 horas, hasta 8 con poco esfuerzo.',
    fuente: 'NASA, EMU LSS/SSA Data Book, Rev. V (2017).',
    url: 'https://www.nasa.gov/wp-content/uploads/2017/02/esoc-13_rev._v_emu_hardware_data_book_jsc-e-daa-tn55224.pdf',
  },
  {
    tema: 'Ejercicio',
    dato: 'La tripulación de la ISS tiene programadas dos horas y media de ejercicio al día para frenar la pérdida de músculo y hueso.',
    fuente: 'NASA, "FAQ: The Real Story About Astronaut Health Care in Space" (2024).',
    url: 'https://www.nasa.gov/missions/station/faq-the-real-story-about-astronaut-health-care-in-space/',
  },
  {
    tema: 'Energía nuclear',
    dato: 'El reactor Kilopower puede dar hasta 10 kW eléctricos de forma continua durante al menos diez años; una unidad de 10 kW pesa unos 1 500 kg.',
    fuente: 'NASA, "Demonstration Proves Nuclear Fission System Can Provide Space Exploration Power" (2018) y NTRS 20180000691.',
    url: 'https://www.nasa.gov/news-release/demonstration-proves-nuclear-fission-system-can-provide-space-exploration-power/',
  },
  {
    tema: 'Polvo en los paneles',
    dato: 'El polvo redujo la energía del módulo InSight hasta agotar sus baterías en 2022.',
    fuente: 'NASA, "NASA Retires InSight Mars Lander Mission After Years of Science" (2022).',
    url: 'https://www.nasa.gov/missions/insight/nasa-retires-insight-mars-lander-mission-after-years-of-science/',
  },
  {
    tema: 'Tormentas de polvo',
    dato: 'En junio de 2018 una tormenta global llevó la opacidad del cielo a 10.8 sobre el rover Opportunity, que dejó de funcionar.',
    fuente: 'NASA JPL, "Opportunity Hunkers Down During Dust Storm" (2018).',
    url: 'https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/',
  },
  {
    tema: 'Hielo en Utopia Planitia',
    dato: 'El radar SHARAD detectó un depósito de hielo enterrado de hasta 14 300 km³, tanta agua como el lago Superior.',
    fuente: 'Stuurman et al. (2016), Geophys. Res. Lett. 43, y NASA JPL, "Mars Ice Deposit Holds as Much Water as Lake Superior".',
    url: 'https://doi.org/10.1002/2016GL070138',
  },
  {
    tema: 'Ventanas de lanzamiento y fechas de las situaciones',
    dato: 'Las fechas de despegue (25 oct 2024, 5 dic 2026, 7 ene 2029, 10 feb 2031, 19 mar 2033) son ventanas reales para una transferencia de Hohmann, calculadas con efemérides. Coinciden con las oposiciones de Marte de 2027, 2029, 2031 y 2033.',
    fuente: 'astronomy-engine (Don Cross, MIT), validada contra JPL Horizons',
    url: 'https://github.com/cosinekitty/astronomy',
  },
  {
    tema: 'Estación de Marte al llegar',
    dato: 'La longitud solar Ls se obtiene de la posición real de Marte en la fecha de llegada; el clima se toma del sol de Curiosity con la misma Ls.',
    fuente: 'JPL, Approximate Positions of the Planets; REMS de Curiosity',
    url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
  },
  {
    tema: 'Estrellas y constelaciones',
    dato: 'Las 5 044 estrellas hasta la magnitud 6 están en su posición real, con su brillo y su color. Las constelaciones son las 88 de la IAU.',
    fuente: 'XHIP, An Extended Hipparcos Compilation (Anderson y Francis 2012), vía d3-celestial',
    url: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/137D',
  },
  {
    tema: 'Planetas en el cielo y trayectoria de la nave',
    dato: 'Sol, Luna y planetas se ven donde estaban en la fecha de la misión, desde la nave o desde Marte. La nave sigue una órbita de transferencia calculada con el problema de Lambert.',
    fuente: 'astronomy-engine; brillos según Mallama y Hilton (2018)',
    url: 'https://arxiv.org/abs/1808.01973',
  },
  {
    tema: 'El Sol en su máximo',
    dato: 'La NASA y la NOAA anunciaron el 15 de octubre de 2024 que el Sol había llegado a la fase de máximo de su ciclo de 11 años.',
    fuente: 'NASA, "NASA, NOAA: Sun Reaches Maximum Phase in 11-Year Solar Cycle"',
    url: 'https://science.nasa.gov/science-research/heliophysics/nasa-noaa-sun-reaches-maximum-phase-in-11-year-solar-cycle/',
  },
  {
    tema: 'Hielo enterrado en Utopia Planitia',
    dato: 'El radar SHARAD de Mars Reconnaissance Orbiter encontró en 2016 un depósito de hielo con tanta agua como el lago Superior, cubierto por 1 a 10 m de suelo.',
    fuente: 'NASA JPL / Universidad de Texas, "Mars Ice Deposit Holds as Much Water as Lake Superior" (2016)',
    url: 'https://www.jpl.nasa.gov/news/mars-ice-deposit-holds-as-much-water-as-lake-superior/',
  },
  {
    tema: 'Opportunity y la tormenta global de 2018',
    dato: 'El rover solar Opportunity dejó de comunicarse el 10 de junio de 2018 durante una tormenta de polvo que cubrió el planeta.',
    fuente: 'NASA Science, misión MER Opportunity',
    url: 'https://science.nasa.gov/mission/mer-opportunity/',
  },
  {
    tema: 'Perseverance en Jezero',
    dato: 'Perseverance aterrizó en el cráter Jezero, un antiguo lago con delta, el 18 de febrero de 2021 y guarda muestras de roca en tubos sellados.',
    fuente: 'NASA Science, misión Mars 2020 Perseverance',
    url: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
  },
  {
    tema: 'Apolo 13',
    dato: 'En abril de 1970 explotó un tanque de oxígeno camino a la Luna; la tripulación adaptó cartuchos de hidróxido de litio con materiales de a bordo.',
    fuente: 'NASA, misión Apolo 13',
    url: 'https://www.nasa.gov/mission/apollo-13/',
  },
  {
    tema: 'El sonido en Marte',
    dato: 'En Marte un mismo sonido llega unos 20 dB más débil que en la Tierra y los agudos se apagan pronto; hay dos velocidades del sonido, unos 240 m/s en graves y 250 m/s en agudos.',
    fuente: 'Maurice et al., "In situ recording of Mars soundscape", Nature 605 (2022)',
    url: 'https://doi.org/10.1038/s41586-022-04679-0',
  },
  {
    tema: 'Tonos Quindar',
    dato: 'Las transmisiones del centro de control del Apolo empezaban con un tono de 2525 Hz y terminaban con uno de 2475 Hz, de 250 ms cada uno.',
    fuente: 'Quindar tones (resumen con referencias)',
    url: 'https://en.wikipedia.org/wiki/Quindar_tones',
  },
]

/** Lo que el juego simplifica o inventa para poder jugarse. Se muestra junto a las fuentes. */
export const SUPUESTOS: string[] = [
  'Las misiones de la contextualización son situaciones de entrenamiento: las premisas y los mensajes del centro de control o de casa son ficción; los datos que las acompañan son reales.',
  'Las tormentas solares se reproducen desde los registros de 2024 también en las misiones de otros años, con más o menos frecuencia según la fase del ciclo solar estimada por el juego.',
  'Los sonidos se generan en el navegador: los niveles y timbres son decisiones del juego inspiradas en mediciones reales.',
  'El tiempo de misión corre acelerado. La escala se ve siempre en pantalla y la controla el comandante.',
  'El clima es el que midió Curiosity en el cráter Gale. Para otros sitios se aplica un ajuste estimado de temperatura y luz.',
  'Las tormentas solares ocurren en las mismas fechas que en 2024, contando desde el día del lanzamiento. Se asume que la nave está en la trayectoria de las partículas, lo cual no siempre ocurre.',
  'La dosis de cada tormenta solar es una estimación del juego según cuántos instrumentos la registraron. No es una medición.',
  'La opacidad del polvo y las tormentas de polvo se generan con un modelo propio; los datos públicos de Curiosity no las incluyen.',
  'El tamaño del hábitat, de los paneles, de las baterías y del reciclador, y las masas de los suministros, son valores de diseño del juego inspirados en la ISS y en estudios de NASA.',
  'Cada cartucho de hidróxido de litio lleva 3 kg de reactivo. Lo que absorbe sale de la química de la reacción, no de un cartucho real.',
  'Los umbrales a partir de los cuales el cuerpo sufre daño (oxígeno, CO2, frío, deshidratación) son aproximaciones para el juego.',
  'El cuerpo humano se modela con ecuaciones sencillas. Sirve para aprender relaciones de causa y efecto, no para uso médico.',
  'Los trayectos de 150, 210 y 259 días y las distancias en pantalla son aproximados; 259 días es la duración real de una transferencia de Hohmann.',
  'El regreso a la Tierra no se simula: la misión termina al cumplir la estancia en la superficie.',
]
