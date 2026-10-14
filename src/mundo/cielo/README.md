# Cielo real

El cielo que ve la tripulación por la ventana: estrellas, Vía Láctea, constelaciones, Sol,
planetas y Luna en sus posiciones verdaderas para la fecha de la misión, vistos desde donde está
el observador (la Tierra, la nave en ruta o la superficie de Marte).

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `marco.ts` | Convención de ejes: EQJ (ecuatorial J2000) a la escena. Y de la escena = norte celeste. |
| `datos.ts` | **Generado** por `node scripts/datos-cielo.mjs` (no editar): 5044 estrellas hasta magnitud 6, ~30 nombres en español, las 88 constelaciones y la Vía Láctea. |
| `astro.ts` | Posiciones (astronomy-engine), brillo de planetas desde cualquier punto, trayectoria de la nave (Lambert), ventanas de lanzamiento y orientación en la superficie de la Tierra o Marte. |
| `color.ts` | Color de cada estrella desde su índice B-V. |
| `orientacion.ts` | `orientacionHacia`: gira el cielo para que una dirección real quede frente a la ventana. |
| `Cielo.tsx` | Componente de React Three Fiber que dibuja todo. |

Pruebas: `npx tsx scripts/probar-cielo.ts`.

## Uso

```tsx
<Cielo fecha={fecha} observador={posicionNave(salida, llegada, f)} etiquetas ocultarCuerpos={['Tierra']} />
// En Marte, de noche:
<Cielo fecha={fecha} observador={vectorHelio('Marte', fecha)} brillo={0.8} atmosfera centelleo={0.05}
       orientacion={orientacionSuperficie('Marte', fecha, 18.44, 77.45)} />
```

El cielo se dibuja primero y sin escribir profundidad: las paredes lo tapan y por la ventana se ve.
El fondo detrás debe ser negro (o usar `fondoNegro`). Cuando la Tierra, Marte o la Luna están
cerca, la escena dibuja su globo (con `cuerposVisibles` sabe dirección y tamaño) y los oculta con
`ocultarCuerpos`; los que pasan de 2° de diámetro aparente no se dibujan como punto.

## Fuentes

- Estrellas: XHIP, An Extended Hipparcos Compilation, Anderson y Francis (2012), VizieR V/137D,
  https://cdsarc.cds.unistra.fr/viz-bin/cat/V/137D , a través de d3-celestial (Olaf Frohn,
  BSD-3-Clause), https://github.com/ofrohn/d3-celestial
- Constelaciones (figuras y nombres): IAU, https://www.iau.org/public/themes/constellations/ , vía d3-celestial.
- Vía Láctea: Milky Way Outline Catalog, Jose R. Vieira, http://www.skymap.com/milkyway_cat.htm , vía d3-celestial.
- Posiciones del Sol, planetas y Luna, ejes de rotación: astronomy-engine (Don Cross, MIT),
  validado contra JPL Horizons, https://github.com/cosinekitty/astronomy
- Brillo de los planetas: Mallama y Hilton (2018), Astronomy and Computing 25, 10-24,
  https://arxiv.org/abs/1808.01973
- Radios: NASA Planetary Fact Sheets, https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- Color: Ballesteros (2012), EPL 97, 34008, https://arxiv.org/abs/1201.1809 ; Wyman, Sloan y
  Shirley (2013), JCGT 2(2), https://jcgt.org/published/0002/02/01/
- Órbitas medias para la fase de Hohmann: Standish, JPL, https://ssd.jpl.nasa.gov/planets/approx_pos.html
- Lambert y Kepler: H. Curtis, *Orbital Mechanics for Engineering Students*, algoritmos 3.3, 3.4 y 5.2.

## Aproximaciones declaradas

- Estrellas en J2000, sin movimiento propio ni paralaje (desde Marte cambian menos de 1").
- Planetas sin corrección por tiempo de luz ni aberración.
- La nave sigue un arco kepleriano alrededor del Sol, sin la gravedad de la Tierra ni de Marte
  cerca de los extremos ni maniobras de corrección.
- Las ventanas usan la fase de Hohmann de órbitas circulares (44.35°); una misión real afina la fecha.
- Tintes de los planetas y tamaño visual de los puntos: decisiones de presentación, no medidas.
