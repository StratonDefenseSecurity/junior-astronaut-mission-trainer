# Texturas reales de la Tierra, la Luna y Marte

Las genera `node scripts/texturas-reales.mjs` a partir de imágenes de dominio público de NASA
y USGS. Las descargas quedan en `.cache/texturas-reales/` (fuera de git); aquí solo están las
versiones reducidas para la web. El cliente sabe qué hay por `src/mundo/planetas/texturasReales.json`.

| Archivo | Tamaño | Producto y fuente | Crédito |
|---|---|---|---|
| `tierra-dia.jpg` | 4096×2048 | Blue Marble: Next Generation con topografía y batimetría, diciembre de 2004 (`world.topo.bathy.200412.3x5400x2700.jpg`). https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry | NASA Earth Observatory / NASA Goddard Space Flight Center |
| `tierra-noche.jpg` | 3600×1800 | Earth at Night, Black Marble 2016, mapa global en color de 0.1° (`BlackMarble_2016_01deg.jpg`), Suomi NPP VIIRS. https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps | NASA Earth Observatory / NASA Goddard Space Flight Center |
| `tierra-nubes.jpg` | 2048×1024 | Blue Marble, capa de nubes (`cloud_combined_2048.jpg`, registro 57747). https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/ | NASA Earth Observatory / NASA Goddard Space Flight Center |
| `tierra-agua.png` | 2048×1024 | Costas de Natural Earth 1:50 millones (dominio público), vía world-atlas (ISC). https://www.naturalearthdata.com/ | Natural Earth |
| `luna-color.jpg` | 2048×1024 | CGI Moon Kit, mapa de color de LROC 2019 (`lroc_color_poles_2k.tif`). https://svs.gsfc.nasa.gov/4720 | NASA's Scientific Visualization Studio; datos de NASA/GSFC/Arizona State University (LROC) |
| `luna-relieve.jpg` | 1440×720 | CGI Moon Kit, altimetría de LOLA a 4 píxeles por grado (`ldem_4.tif`, km sobre una esfera de 1737.4 km). https://svs.gsfc.nasa.gov/4720 | NASA's Scientific Visualization Studio; datos de NASA/GSFC (LOLA) |

Marte, si se generan con `--marte`:

| Archivo | Tamaño | Producto y fuente | Crédito |
|---|---|---|---|
| `marte-color.jpg` | 2048×1024 | Viking MDIM2.1, mosaico global en color de 232 m. https://planetarymaps.usgs.gov/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif | NASA/JPL/USGS |
| `marte-relieve.jpg` | 1440×720 | MGS MOLA, modelo de elevación global de 463 m. https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif | NASA/JPL/GSFC/USGS (MOLA Science Team) |

## Qué se cambió

- **Día de la Tierra:** reducida a 4096×2048. El mar se acerca a un azul marino oscuro con la
  máscara de agua: el mosaico pinta la batimetría, que desde órbita no se ve. Las aguas muy
  someras, como las Bahamas, conservan parte de su turquesa. Es una decisión visual.
- **Luces de noche:** solo la luminancia; se recorta el fondo gris del hielo y del relieve. El
  tono de lámpara de sodio lo pone el shader.
- **Nubes:** en gris, con algo más de contraste. Son las nubes de una composición de satélites,
  no las del día de la misión.
- **Relieve:** pendientes este y norte del modelo de elevación, guardadas como 128 + pendiente × 300
  en los canales rojo y verde. El shader las exagera para que se vean a esta resolución.
- Todas se proyectan igual: equirectangular, columna 0 en la longitud -180°, norte arriba.

Los mapas de color de la Luna de la SVS están pensados para verse bien, no para hacer ciencia;
el propio sitio lo advierte.
