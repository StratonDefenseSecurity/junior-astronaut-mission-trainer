# Real sky

The sky the crew sees through the window: stars, the Milky Way, constellations, the Sun,
planets and the Moon in their true positions for the mission date, seen from where the
observer is (Earth, the ship on its way or the surface of Mars).

## Files

| File | What it does |
| --- | --- |
| `marco.ts` | Axis convention: EQJ (J2000 equatorial) to the scene. Scene Y = celestial north. |
| `datos.ts` | **Generated** by `node scripts/datos-cielo.mjs` (do not edit): 5044 stars down to magnitude 6, proper names for ~30 of them, the 88 constellations and the Milky Way. |
| `astro.ts` | Positions (astronomy-engine), planet brightness from any point, the ship's trajectory (Lambert), launch windows and orientation on the surface of Earth or Mars. |
| `color.ts` | The color of each star from its B-V index. |
| `orientacion.ts` | `orientacionHacia`: turns the sky so that a real direction faces the window. |
| `Cielo.tsx` | React Three Fiber component that draws everything. |

Tests: `npx tsx scripts/probar-cielo.ts`.

## Usage

```tsx
<Cielo fecha={fecha} observador={posicionNave(salida, llegada, f)} etiquetas ocultarCuerpos={['Tierra']} />
// On Mars, at night:
<Cielo fecha={fecha} observador={vectorHelio('Marte', fecha)} brillo={0.8} atmosfera centelleo={0.05}
       orientacion={orientacionSuperficie('Marte', fecha, 18.44, 77.45)} />
```

The sky is drawn first and without writing depth: the walls cover it and it shows through the window.
The background behind it must be black (or use `fondoNegro`). When Earth, Mars or the Moon are
close, the scene draws their globe (`cuerposVisibles` gives it the direction and size) and hides them with
`ocultarCuerpos`. Bodies larger than 2° in apparent diameter are not drawn as a point.

## Sources

- Stars: XHIP, An Extended Hipparcos Compilation, Anderson and Francis (2012), VizieR V/137D,
  https://cdsarc.cds.unistra.fr/viz-bin/cat/V/137D , through d3-celestial (Olaf Frohn,
  BSD-3-Clause), https://github.com/ofrohn/d3-celestial
- Constellations (figures and names): IAU, https://www.iau.org/public/themes/constellations/ , via d3-celestial.
- Milky Way: Milky Way Outline Catalog, Jose R. Vieira, http://www.skymap.com/milkyway_cat.htm , via d3-celestial.
- Positions of the Sun, planets and Moon, rotation axes: astronomy-engine (Don Cross, MIT),
  validated against JPL Horizons, https://github.com/cosinekitty/astronomy
- Planet brightness: Mallama and Hilton (2018), Astronomy and Computing 25, 10-24,
  https://arxiv.org/abs/1808.01973
- Radii: NASA Planetary Fact Sheets, https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- Color: Ballesteros (2012), EPL 97, 34008, https://arxiv.org/abs/1201.1809 ; Wyman, Sloan and
  Shirley (2013), JCGT 2(2), https://jcgt.org/published/0002/02/01/
- Mean orbits for the Hohmann phase: Standish, JPL, https://ssd.jpl.nasa.gov/planets/approx_pos.html
- Lambert and Kepler: H. Curtis, *Orbital Mechanics for Engineering Students*, algorithms 3.3, 3.4 and 5.2.

## Stated approximations

- Stars at J2000, with no proper motion or parallax (from Mars they shift less than 1").
- Planets with no light-time or aberration correction.
- The ship follows a Keplerian arc around the Sun, without the gravity of Earth or Mars
  near the ends and without correction maneuvers.
- The windows use the Hohmann phase for circular orbits (44.35°). A real mission fine-tunes the date.
- Planet tints and the visual size of the points are presentation choices, not measurements.
