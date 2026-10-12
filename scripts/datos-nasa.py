"""Descarga datos reales de NASA y los deja listos para el juego.

Uso: python scripts/datos-nasa.py

Guarda la copia descargada en datos/nasa/*.json y genera los módulos compactos
server/datos/*.ts que usa la simulación.

Fuentes:
- Clima de Marte: estación REMS del rover Curiosity (cráter Gale), difundida por el
  Centro de Astrobiología (CSIC-INTA) a través de mars.nasa.gov.
- Clima espacial: base DONKI del Community Coordinated Modeling Center (NASA Goddard).

El juego no llama a estas direcciones mientras se juega: usa las copias generadas aquí,
para que funcione sin conexión y siempre igual.
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'datos', 'nasa')
MODULOS = os.path.join(RAIZ, 'server', 'datos')
os.makedirs(SALIDA, exist_ok=True)
os.makedirs(MODULOS, exist_ok=True)

REMS_URL = 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json'
DONKI_URL = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/{tipo}?startDate={ini}&endDate={fin}'
ANIO = 2024
UV = {'Low': 0, 'Moderate': 1, 'High': 2, 'Very_High': 3}
NL = chr(10)


def bajar(url, intentos=4):
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'mission-trainer-space-apps/1.0'})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read().decode('utf-8', errors='replace')
        except Exception as e:  # noqa: BLE001
            print(f'  reintento {i + 1}: {e}')
            time.sleep(3 * (i + 1))
    raise SystemExit(f'No se pudo descargar {url}')


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def minutos(hhmm):
    try:
        h, m = hhmm.split(':')
        return int(h) * 60 + int(m)
    except Exception:  # noqa: BLE001
        return None


def dia_del_anio(iso):
    t = dt.datetime.strptime(iso[:16], '%Y-%m-%dT%H:%M')
    return round((t - dt.datetime(t.year, 1, 1)).total_seconds() / 86400 + 1, 3)


def modulo(nombre, constante, comentarios, objeto):
    ruta = os.path.join(MODULOS, nombre)
    lineas = ['// GENERADO por scripts/datos-nasa.py a partir de datos de NASA. No editar a mano.'] + comentarios
    lineas.append(f'export const {constante} = ' + json.dumps(objeto, ensure_ascii=False, separators=(',', ':')))
    with open(ruta, 'w', encoding='utf-8', newline=NL) as f:
        f.write(NL.join(lineas) + NL)
    print(f'  módulo server/datos/{nombre} ({os.path.getsize(ruta) // 1024} KB)')


def clima_marte():
    print('Clima de Marte (REMS, Curiosity)...')
    datos = json.loads(bajar(REMS_URL))
    soles = []
    for s in datos['soles']:
        tmin, tmax, pres = num(s.get('min_temp')), num(s.get('max_temp')), num(s.get('pressure'))
        if tmin is None or tmax is None or pres is None:
            continue
        soles.append({
            'sol': int(s['sol']),
            'fecha': s.get('terrestrial_date'),
            'ls': num(s.get('ls')),
            'estacion': s.get('season'),
            'tmin': tmin,
            'tmax': tmax,
            'presion': pres,
            'opacidad': s.get('atmo_opacity'),
            'uv': s.get('local_uv_irradiance_index'),
            'amanecer': s.get('sunrise'),
            'atardecer': s.get('sunset'),
        })
    soles.sort(key=lambda x: x['sol'])
    # Un año marciano completo (669 soles) de los registros más recientes con datos válidos.
    anio = soles[-669:]
    fuente = 'REMS (Rover Environmental Monitoring Station), rover Curiosity (MSL), cráter Gale. Centro de Astrobiología (CSIC-INTA) / NASA JPL.'
    hoy = dt.date.today().isoformat()
    resumen = {
        'fuente': fuente,
        'url': REMS_URL,
        'descargado': hoy,
        'nota': 'Mínimas y máximas diarias de temperatura del aire (°C) y presión media (Pa). Datos de divulgación, no científicos.',
        'primerSol': anio[0]['sol'],
        'ultimoSol': anio[-1]['sol'],
        'soles': anio,
    }
    with open(os.path.join(SALIDA, 'clima-marte.json'), 'w', encoding='utf-8') as f:
        json.dump(resumen, f, ensure_ascii=False, separators=(',', ':'))
    modulo(
        'climaMarte.ts',
        'CLIMA_MARTE',
        ['// Cada sol: [mínima °C, máxima °C, presión Pa, UV (0 bajo, 1 moderado, 2 alto, 3 muy alto), Ls, amanecer min, atardecer min]'],
        {
            'fuente': fuente,
            'url': REMS_URL,
            'descargado': hoy,
            'primerSol': anio[0]['sol'],
            'ultimoSol': anio[-1]['sol'],
            'primeraFecha': anio[0]['fecha'],
            'ultimaFecha': anio[-1]['fecha'],
            'soles': [
                [x['tmin'], x['tmax'], x['presion'], UV.get(x['uv'], 1), x['ls'] or 0, minutos(x['amanecer']) or 400, minutos(x['atardecer']) or 1130]
                for x in anio
            ],
        },
    )
    t = [s['tmin'] for s in anio] + [s['tmax'] for s in anio]
    p = [s['presion'] for s in anio]
    print(f"  {len(anio)} soles ({anio[0]['sol']}-{anio[-1]['sol']}), temperatura {min(t)} a {max(t)} C, presion {min(p)}-{max(p)} Pa")


def tramos(anio):
    ini = dt.date(anio, 1, 1)
    while ini.year == anio:
        fin = min(ini + dt.timedelta(days=59), dt.date(anio, 12, 31))
        yield ini.isoformat(), fin.isoformat()
        ini = fin + dt.timedelta(days=1)


def clima_espacial():
    print(f'Clima espacial {ANIO} (DONKI)...')
    fulguraciones, particulas = [], []
    for ini, fin in tramos(ANIO):
        flr = json.loads(bajar(DONKI_URL.format(tipo='FLR', ini=ini, fin=fin)) or '[]')
        sep = json.loads(bajar(DONKI_URL.format(tipo='SEP', ini=ini, fin=fin)) or '[]')
        print(f'  {ini} a {fin}: {len(flr)} fulguraciones, {len(sep)} registros de particulas')
        for f in flr:
            clase = f.get('classType') or ''
            if not clase.startswith('X'):
                continue  # solo las más intensas (clase X)
            fulguraciones.append({
                'id': f.get('flrID'),
                'inicio': f.get('beginTime'),
                'pico': f.get('peakTime'),
                'fin': f.get('endTime'),
                'clase': clase,
                'region': f.get('activeRegionNum'),
                'posicion': f.get('sourceLocation'),
                'enlace': f.get('link'),
            })
        for s in sep:
            particulas.append({
                'id': s.get('sepID'),
                'inicio': s.get('eventTime'),
                'instrumentos': [i.get('displayName') for i in (s.get('instruments') or [])],
                'enlace': s.get('link'),
            })
        time.sleep(1)
    fulguraciones.sort(key=lambda x: x['pico'] or x['inicio'] or '')
    particulas.sort(key=lambda x: x['inicio'] or '')
    fuente = 'DONKI (Space Weather Database Of Notifications, Knowledge, Information), Community Coordinated Modeling Center, NASA Goddard Space Flight Center.'
    hoy = dt.date.today().isoformat()
    periodo = f'{ANIO}-01-01 a {ANIO}-12-31'
    salida = {
        'fuente': fuente,
        'url': 'https://ccmc.gsfc.nasa.gov/DONKI/',
        'descargado': hoy,
        'periodo': periodo,
        'nota': 'Fulguraciones solares de clase X y eventos de partículas energéticas solares (SEP) registrados ese año.',
        'fulguraciones': fulguraciones,
        'particulas': particulas,
    }
    with open(os.path.join(SALIDA, 'clima-espacial.json'), 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, separators=(',', ':'))

    # Un mismo evento de partículas aparece una vez por instrumento: se agrupan los registros
    # que empiezan con menos de 18 horas de diferencia.
    grupos = []
    for p in particulas:
        if not p['inicio']:
            continue
        d = dia_del_anio(p['inicio'])
        alta = any(('GOES' in (i or '')) or ('100' in (i or '')) for i in p['instrumentos'])
        if grupos and d - grupos[-1]['dia'] < 0.75:
            grupos[-1]['registros'] += 1
            grupos[-1]['alta'] = grupos[-1]['alta'] or alta
        else:
            grupos.append({'dia': d, 'registros': 1, 'alta': alta, 'id': p['id'], 'fecha': p['inicio'][:10]})
    modulo(
        'climaEspacial.ts',
        'CLIMA_ESPACIAL',
        [
            '// fulguraciones: [día del año, clase, región activa, id DONKI]',
            '// particulas: [día del año, registros de instrumentos, ¿detectado por GOES o a más de 100 MeV?, id DONKI, fecha]',
        ],
        {
            'fuente': fuente,
            'url': 'https://ccmc.gsfc.nasa.gov/DONKI/',
            'periodo': periodo,
            'descargado': hoy,
            'anio': ANIO,
            'fulguraciones': [
                [dia_del_anio(f['pico'] or f['inicio']), f['clase'], f['region'] or 0, f['id']]
                for f in fulguraciones
                if (f['pico'] or f['inicio'])
            ],
            'particulas': [[g['dia'], g['registros'], g['alta'], g['id'], g['fecha']] for g in grupos],
        },
    )
    print(f'  {len(fulguraciones)} fulguraciones clase X, {len(particulas)} registros de particulas en {len(grupos)} eventos')


if __name__ == '__main__':
    que = sys.argv[1] if len(sys.argv) > 1 else 'todo'
    if que in ('todo', 'marte'):
        clima_marte()
    if que in ('todo', 'espacio'):
        clima_espacial()
    print('Listo')
