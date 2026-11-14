"""Descarga imágenes reales de Mars Trek (NASA) alrededor de cada sitio de la base.

Uso: python -I scripts/sitios-marte.py [--capa themis|viking]

Lee los mosaicos WMTS de Mars Trek (https://trek.nasa.gov/mars/), une las teselas que cubren
cada sitio, recorta un cuadrado centrado en la base y guarda una versión pequeña en
public/sitios/<sitio>.jpg (máximo 150 KB cada una). Las teselas descargadas son datos ajenos:
van a .cache/sitios-marte/ (fuera de git) y no se ejecuta nada de ellas.

Coordenadas: las mismas de la base en el juego (src/mundo/cieloMarte.ts, SITIOS_MARTE).
Proyección de Mars Trek: equirectangular, columna 0 en -180° E, fila 0 en 90° N; en el nivel z
hay 2^(z+1) columnas y 2^z filas de 256 píxeles.

Necesita Pillow. Al terminar imprime el tamaño de cada imagen y la fecha de descarga para
public/texturas/CREDITOS.md.
"""
import datetime as dt
import io
import math
import os
import sys
import time
import urllib.request

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(RAIZ, '.cache', 'sitios-marte')
SALIDA = os.path.join(RAIZ, 'public', 'sitios')

CAPAS = {
    # Mars Odyssey THEMIS, mosaico global controlado de infrarrojo de día, 100 m por píxel.
    'themis': {'id': 'THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018', 'ext': 'png', 'nivel': 9},
    # Viking MDIM2.1, mosaico global en color, 232 m por píxel.
    'viking': {'id': 'Mars_Viking_MDIM21_ClrMosaic_global_232m', 'ext': 'jpg', 'nivel': 7},
}

# lat (°N), lon (°E) de la base y lado del recorte en km.
SITIOS = {
    'gale': (-5.44, 137.7, 180),
    'jezero': (18.41, 77.69, 70),
    'utopia': (44.0, 80.0, 120),
}

KM_POR_GRADO = 2 * math.pi * 3389.5 / 360  # radio medio de Marte, 3389.5 km
LADO_PX = 420
MAX_BYTES = 150 * 1024


def tesela(capa, z, fila, col):
    ruta = os.path.join(CACHE, capa['id'], str(z), str(fila), f"{col}.{capa['ext']}")
    if not os.path.exists(ruta):
        url = f"https://trek.nasa.gov/tiles/Mars/EQ/{capa['id']}/1.0.0/default/default028mm/{z}/{fila}/{col}.{capa['ext']}"
        pet = urllib.request.Request(url, headers={'User-Agent': 'mission-trainer-sitios/1.0'})
        for intento in range(3):
            try:
                datos = urllib.request.urlopen(pet, timeout=60).read()
                break
            except Exception as e:  # red inestable: reintenta
                if intento == 2:
                    raise RuntimeError(f'No se pudo bajar {url}: {e}')
                time.sleep(2)
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        with open(ruta, 'wb') as f:
            f.write(datos)
    return Image.open(ruta).convert('RGB')


def recorte(capa, lat, lon, lado_km):
    z = capa['nivel']
    grados_tesela = 180 / 2 ** z
    px_por_grado = 256 / grados_tesela
    alto_g = lado_km / KM_POR_GRADO
    ancho_g = alto_g / math.cos(math.radians(lat))  # cuadrado en km, no en grados
    oeste, este = lon - ancho_g / 2, lon + ancho_g / 2
    norte, sur = lat + alto_g / 2, lat - alto_g / 2
    c0, c1 = int((oeste + 180) // grados_tesela), int((este + 180) // grados_tesela)
    f0, f1 = int((90 - norte) // grados_tesela), int((90 - sur) // grados_tesela)
    mosaico = Image.new('RGB', ((c1 - c0 + 1) * 256, (f1 - f0 + 1) * 256))
    for f in range(f0, f1 + 1):
        for c in range(c0, c1 + 1):
            mosaico.paste(tesela(capa, z, f, c), ((c - c0) * 256, (f - f0) * 256))
    x0 = (oeste + 180 - c0 * grados_tesela) * px_por_grado
    y0 = (90 - norte - f0 * grados_tesela) * px_por_grado
    caja = (round(x0), round(y0), round(x0 + ancho_g * px_por_grado), round(y0 + alto_g * px_por_grado))
    return mosaico.crop(caja), (oeste, sur, este, norte)


def guardar(img, ruta):
    img = img.resize((LADO_PX, LADO_PX), Image.LANCZOS)
    for calidad in (82, 75, 68, 60):
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=calidad, optimize=True, progressive=True)
        if buf.tell() <= MAX_BYTES:
            break
    with open(ruta, 'wb') as f:
        f.write(buf.getvalue())
    return buf.tell(), calidad


def main():
    nombre = sys.argv[sys.argv.index('--capa') + 1] if '--capa' in sys.argv else 'themis'
    capa = CAPAS[nombre]
    os.makedirs(SALIDA, exist_ok=True)
    total = 0
    for sitio, (lat, lon, lado) in SITIOS.items():
        img, caja = recorte(capa, lat, lon, lado)
        if capa['id'].startswith('THEMIS'):
            # El infrarrojo es una sola banda: se guarda en gris y se estira el contraste.
            from PIL import ImageOps
            img = ImageOps.autocontrast(img.convert('L'), cutoff=0.5).convert('RGB')
        tam, calidad = guardar(img, os.path.join(SALIDA, f'{sitio}.jpg'))
        total += tam
        print(f'{sitio}: {LADO_PX}x{LADO_PX}, {tam / 1024:.0f} KB (calidad {calidad}), {lado} km, '
              f'lon {caja[0]:.3f} a {caja[2]:.3f} E, lat {caja[1]:.3f} a {caja[3]:.3f} N')
    print(f'Capa {capa["id"]}, total {total / 1024:.0f} KB, descargado {dt.date.today().isoformat()}')
    if total > 1024 * 1024:
        sys.exit('Las imágenes pasan de 1 MB en total.')


if __name__ == '__main__':
    main()
