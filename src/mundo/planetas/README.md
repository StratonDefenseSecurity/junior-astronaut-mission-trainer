# Globos de la Tierra, Marte y la Luna

Componentes de React Three Fiber con la orientación real de cada cuerpo para la fecha de la
misión. Las texturas se generan en el navegador (sin imágenes ni red) dentro de un Web Worker y
se guardan en caché toda la sesión.

```tsx
import { Tierra, Marte, Luna, LUGARES_TIERRA, precargarTexturas } from './mundo/planetas'

precargarTexturas() // opcional, por ejemplo en el lobby

<Tierra radio={2000} fecha={() => inicioMs + tiempo() * 1000}
        marcadores={[{ ...LUGARES_TIERRA.lambayeque }]} />
```

Props comunes: `radio`, `fecha` (Date, ms Unix o función), `direccionSol` (unitaria, en el
marco del grupo padre; si falta se calcula para la fecha), `marcadores`, `detalle`
(`'alto' | 'bajo'`), `etiquetas`, `position`, `brilloNoche`. `<Tierra>` agrega `nubes` y
`atmosfera`; `<Marte>`, `atmosfera`. `latLonAVector(lat, lon, radio)` da un punto en el marco
local del globo (el de la textura); `orientacionCuerpo(cuerpo, fecha)` da la rotación de ese
marco a la escena. `DemoPlanetas` (en `Demo.tsx`) muestra los tres para revisarlos.

## Qué es real

- **Costas de la Tierra**: Natural Earth 1:50 millones (`world-atlas/land-50m.json`).
  Groenlandia y la Antártida se cubren de hielo con su forma real.
- **Rotación y polo**: astronomy-engine. Tierra con tiempo sidéreo aparente, precesión y
  nutación; Marte y la Luna con los elementos de rotación de la IAU (WGCCRE 2015). La Luna
  muestra a la Tierra su cara visible, con la libración real. Marco de la escena: `../cielo/marco.ts`.
- **Dirección del Sol** (si no se pasa): astronomy-engine para la fecha.
- **Marte**: Olympus Mons, Arsia, Pavonis y Ascraeus Mons, Elysium Mons, Valles Marineris (por
  sus tramos Ius, Melas, Coprates y Eos Chasma), Noctis Labyrinthus, Hellas y Argyre Planitia,
  Syrtis Major, Acidalia, Utopia y Meridiani, los cráteres Gale y Jezero y los rasgos de albedo
  clásicos están en las coordenadas del Nomenclátor de la IAU. Latitud y longitud
  **planetocéntricas, longitud positiva al este** (el Nomenclátor da 0..360 °E; aquí se guarda
  en -180..180). Lista completa y enlaces: `lugares.ts`.
- **Aterrizajes**: Curiosity 4.5895° S, 137.4417° E (NASA PDS/NAIF); Perseverance
  18.44° N, 77.45° E (NASA GISS Mars24).
- **Hielo enterrado de Utopia** (radar SHARAD, Stuurman et al. 2016): 39°–49° N (NASA JPL);
  70°–90° E según Xu et al. 2025, que cita ese estudio. El marcador va en el centro del recuadro.
- **Luna**: los mares y el cráter Tycho están en sus coordenadas IAU con su diámetro.

## Qué es estilizado (no son datos)

- El color del suelo terrestre: regla por latitud más regiones aproximadas de desiertos, selvas
  y montañas, y ruido. **No es una imagen satelital**. La plataforma continental se aproxima con
  la distancia a la costa; el borde del hielo marino es una extensión típica, no de una fecha.
- Las nubes: ruido con las franjas típicas de nubosidad (ZCIT, latitudes medias). No son las
  nubes de ningún día. No hay luces de ciudades (no se usan datos de población).
- Marte: el color, la forma y el tamaño de los rasgos de albedo (la IAU solo da su centro), el
  relieve fino y los cráteres pequeños. El casquete sur está corrido unos 3° del polo hacia el
  hemisferio occidental (ESA); la longitud exacta de ese corrimiento es una aproximación nuestra.
- Luna: los bordes de los mares, los cráteres pequeños y los rayos de Tycho.
- Exageraciones para que se vean en pantalla: el halo azul de la Tierra (escala de altura
  ~22 km en vez de ~8 km) y la altura de las nubes (~25 km); de lejos, el halo nunca es más
  fino que un píxel. La escala de altura de Marte (~11 km) es la real.

## Fuentes y licencias

- Natural Earth (dominio público): https://www.naturalearthdata.com/about/terms-of-use/ ·
  world-atlas (ISC): https://github.com/topojson/world-atlas
- astronomy-engine (MIT): https://github.com/cosinekitty/astronomy · IAU WGCCRE 2015:
  https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2015reprint.pdf
- Gazetteer of Planetary Nomenclature (IAU/USGS): https://planetarynames.wr.usgs.gov/
  (cada rasgo con su enlace en `lugares.ts`, objeto `FUENTES_PLANETAS`)
- NASA PDS/NAIF, misión MSL: https://pds.nasa.gov/data/pds3/releases/latest/2026/202603-naif/msl/zzold/mission.cat
- NASA GISS Mars24, Mars Lander Missions: https://www.giss.nasa.gov/tools/mars24/help/landers.html
- NASA JPL (2016), hielo de Utopia: https://www.jpl.nasa.gov/news/mars-ice-deposit-holds-as-much-water-as-lake-superior/
- ESA (2008), casquete sur desplazado: https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Mars_polar_cap_mystery_solved
- Atardecer azul en Marte (NASA/JPL, PIA19400, Curiosity 2015): https://www.jpl.nasa.gov/images/pia19400-sunset-in-mars-gale-crater/

## Límites

- La Tierra se dibuja como esfera: la latitud del globo es geocéntrica (difiere de la
  geográfica hasta 0.19°). No se modela el achatamiento ni el movimiento del polo.
- Resolución: 2048×1024 (≈20 km por píxel en el ecuador). Muy cerca del suelo se suma ruido
  procedural para que no se vea borroso, pero no agrega detalle real.
- Marte no tiene casquetes estacionales ni tormentas de polvo; solo los casquetes residuales.
