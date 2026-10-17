# Globes of Earth, Mars and the Moon

React Three Fiber components with the real orientation of each body for the mission date.
They use real images from NASA and USGS (`public/texturas/`, see below). While those load,
or if they cannot be loaded, the game uses textures generated in the browser inside a Web Worker,
with no images and no network. All of them are cached for the whole session.

```tsx
import { Tierra, Marte, Luna, LUGARES_TIERRA, precargarTexturas } from './mundo/planetas'

precargarTexturas() // optional, for example in the lobby

<Tierra radio={2000} fecha={() => inicioMs + tiempo() * 1000}
        marcadores={[{ ...LUGARES_TIERRA.lambayeque }]} />
```

Common props: `radio`, `fecha` (Date, Unix ms or a function), `direccionSol` (unit vector, in the
parent group's frame; if missing it is calculated for the date), `marcadores`, `detalle`
(`'alto' | 'bajo'`), `etiquetas`, `position`, `brilloNoche`. `<Tierra>` adds `nubes` and
`atmosfera`; `<Marte>` adds `atmosfera`. `latLonAVector(lat, lon, radio)` gives a point in the
globe's local frame (the texture frame). `orientacionCuerpo(cuerpo, fecha)` gives the rotation from that
frame to the scene. `DemoPlanetas` (in `Demo.tsx`) shows all three for review.

## Real images

`node scripts/texturas-reales.mjs` downloads the approved images to `.cache/texturas-reales/`
(outside git), writes web versions to `public/texturas/` (about 2 MB in total) and writes the
list of what is available to `texturasReales.json`. Credits and changes: `public/texturas/CREDITOS.md`.

- **Earth:** Blue Marble: Next Generation with bathymetry, December 2004 (4096×2048). Lights from
  Black Marble 2016 (only on the night side; they turn on past the terminator and clouds cover
  them). Blue Marble clouds on a separate layer that drifts slowly. Sun glint on the
  water using the Natural Earth coastline mask.
- **Moon:** LROC color and LOLA relief (CGI Moon Kit from NASA's SVS).
- **Mars:** the code already loads the Viking MDIM2.1 mosaic and the MOLA relief if they exist, but
  the USGS files have no reduced versions: generating them with `--marte` downloads about 330 MB. Until
  they are approved, Mars uses the procedural globe.

`useTexturasGlobo` asks for the images first. If they do not arrive within 4 s or they fail, it generates the
procedural ones, and when the real ones arrive it switches to them and frees the others from the GPU. Single-channel
textures are uploaded as `RedFormat` and relief textures as `RGFormat`, with mipmaps.

## What is real

- **Earth's coastlines**: Natural Earth 1:50 million (`world-atlas/land-50m.json`).
  Greenland and Antarctica are covered in ice with their real shape.
- **Rotation and pole**: astronomy-engine. Earth with apparent sidereal time, precession and
  nutation. Mars and the Moon with the IAU rotation elements (WGCCRE 2015). The Moon
  shows Earth its near side, with the real libration. Scene frame: `../cielo/marco.ts`.
- **Direction of the Sun** (if not given): astronomy-engine for the date.
- **Mars**: Olympus Mons, Arsia, Pavonis and Ascraeus Mons, Elysium Mons, Valles Marineris (through
  its Ius, Melas, Coprates and Eos Chasma sections), Noctis Labyrinthus, Hellas and Argyre Planitia,
  Syrtis Major, Acidalia, Utopia and Meridiani, Gale and Jezero craters and the classic albedo
  features are at the coordinates from the IAU Gazetteer. Latitude and longitude are
  **planetocentric, with longitude positive to the east** (the Gazetteer gives 0..360 °E; here it is stored
  as -180..180). Full list and links: `lugares.ts`.
- **Landings**: Curiosity 4.5895° S, 137.4417° E (NASA PDS/NAIF); Perseverance
  18.44° N, 77.45° E (NASA GISS Mars24).
- **Buried ice in Utopia** (SHARAD radar, Stuurman et al. 2016): 39° to 49° N (NASA JPL);
  70° to 90° E according to Xu et al. 2025, which cites that study. The marker sits at the center of the box.
- **Moon**: the maria and Tycho crater are at their IAU coordinates with their diameter.

## What is stylized (not data)

- With the real images: the darkened sea (the mosaic paints the bathymetry), the tint of the
  city lights, the exaggerated relief of the Moon (×3) and Mars (×5), and the drift
  of the clouds, which come from a satellite composite and not from the day of the mission.
- On the procedural backup globe, the color of Earth's ground: a rule by latitude plus
  rough regions of deserts, jungles and mountains, and noise. **It is not a satellite image**.
  The continental shelf is approximated by distance to the coast. The sea ice edge is
  a typical extent, not from a specific date. Its clouds are noise with the typical cloud
  bands (ITCZ, mid-latitudes) and it has no city lights.
- Procedural Mars: the color, shape and size of the albedo features (the IAU only gives their center), the
  fine relief and the small craters. The south polar cap is shifted about 3° from the pole toward the
  western hemisphere (ESA). The exact longitude of that shift is our approximation.
- Procedural Moon: the edges of the maria, the small craters and Tycho's rays.
- Exaggerations so they show up on screen: Earth's blue halo (scale height
  ~22 km instead of ~8 km) and the cloud height (~25 km). From far away, the halo is never thinner
  than one pixel. The Mars scale height (~11 km) is the real one.

## Sources and licenses

- NASA and USGS images (public domain), details in `public/texturas/CREDITOS.md`:
  Blue Marble and Black Marble from NASA Earth Observatory / NASA Goddard; CGI Moon Kit from NASA's
  SVS (https://svs.gsfc.nasa.gov/4720) with data from LROC (NASA/GSFC/Arizona State University) and
  LOLA; Viking MDIM2.1 and MOLA from NASA/JPL/USGS.
- Natural Earth (public domain): https://www.naturalearthdata.com/about/terms-of-use/ ·
  world-atlas (ISC): https://github.com/topojson/world-atlas
- astronomy-engine (MIT): https://github.com/cosinekitty/astronomy · IAU WGCCRE 2015:
  https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2015reprint.pdf
- Gazetteer of Planetary Nomenclature (IAU/USGS): https://planetarynames.wr.usgs.gov/
  (each feature with its link in `lugares.ts`, object `FUENTES_PLANETAS`)
- NASA PDS/NAIF, MSL mission: https://pds.nasa.gov/data/pds3/releases/latest/2026/202603-naif/msl/zzold/mission.cat
- NASA GISS Mars24, Mars Lander Missions: https://www.giss.nasa.gov/tools/mars24/help/landers.html
- NASA JPL (2016), Utopia ice: https://www.jpl.nasa.gov/news/mars-ice-deposit-holds-as-much-water-as-lake-superior/
- ESA (2008), offset south polar cap: https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Mars_polar_cap_mystery_solved
- Blue sunset on Mars (NASA/JPL, PIA19400, Curiosity 2015): https://www.jpl.nasa.gov/images/pia19400-sunset-in-mars-gale-crater/

## Limits

- Earth is drawn as a sphere: the globe's latitude is geocentric (it differs from
  geographic latitude by up to 0.19°). Flattening and polar motion are not modeled.
- Resolution: real Earth 4096×2048 (about 10 km per pixel at the equator), the Moon 2048×1024 and
  its relief 1440×720; the procedural globe 2048×1024. Very close to the ground, procedural noise is added
  so it does not look blurry, but it adds no real detail.
- Mars has no seasonal polar caps and no dust storms, only the residual caps.
