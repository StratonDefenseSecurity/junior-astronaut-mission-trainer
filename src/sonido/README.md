# Sonido del juego

Motor de sonido procedural: todo se sintetiza con la Web Audio API. No hay archivos de audio, no se usa la red y no se agregaron paquetes.

- `motor.ts`: el motor (síntesis, mezcla, compresor y limitador).
- `index.ts`: la API pública (`sonido`) y el gancho `useSonido()`.
- `Demo.tsx`: `DemoSonido`, un banco de pruebas con botones para cada ambiente y evento. No está conectado al juego.

## Uso

```ts
import { sonido, useSonido } from './sonido'

sonido.activarAlInteractuar()                  // al arrancar: el primer clic o tecla enciende el audio
sonido.ambiente('lanzamiento', { empuje: 0 })  // fundido de 1.5 s con el ambiente anterior
sonido.parametros({ empuje: 1, altitudKm: 12 }) // cada cuadro: barato, no crea nodos
sonido.evento('quindarInicio')
sonido.evento('alarma'); sonido.detener('alarma')
const { activo, silenciado, volumen } = useSonido()
```

| Función | Qué hace |
|---|---|
| `activar(): Promise<void>` | Crea o reanuda el AudioContext. Llamar desde un gesto del usuario (política de reproducción automática). Se puede llamar muchas veces. Lo pedido antes (ambiente, alarma, ejercicio) empieza al activar. |
| `activarAlInteractuar(): () => void` | Activa con el primer `pointerdown`, `keydown`, `touchend` o `click`. Devuelve la función para cancelar. |
| `silenciar(b)`, `volumen(v)` | Silencio y volumen maestro 0..1 (por defecto 0.6). Se guardan en localStorage (`mt_sonido_silencio`, `mt_sonido_volumen`). |
| `estado()` | `{ activo, silenciado, volumen }`, con referencia estable. `suscribir(fn)` avisa cuando cambia. |
| `ambiente(tipo, parametros?)` | `'ninguno' \| 'nave' \| 'base' \| 'eva' \| 'lanzamiento' \| 'descenso' \| 'orbita'`. Con el mismo tipo solo actualiza parámetros. |
| `parametros(p)` | Actualiza los parámetros vivos. Aplica como mucho 20 veces por segundo y solo si algo cambió. |
| `evento(nombre, opciones?)` | Sonidos cortos (tabla abajo). Si el audio no está activado no suena, salvo `alarma` y `ejercicio`, que esperan a la activación. |
| `detener(nombre?)` | Detiene `'alarma'` o `'ejercicio'`; sin nombre, los dos. |
| `contexto()` | El AudioContext, o `null` antes de activar. |
| `destinoVoces()` | GainNode para el chat de voz. Respeta silencio y volumen y pasa por el limitador, pero no por el compresor (el retumbo no baja las voces). `null` antes de activar. |

### Ambientes y parámetros

| Ambiente | Qué suena | Parámetros |
|---|---|---|
| `nave` | Ventiladores y bombas del soporte vital (aire filtrado y un zumbido grave con un batido lento), relés y gorgoteo de agua de vez en cuando. | — |
| `orbita` | Solo los ventiladores de la cabina, más bajos. | — |
| `base` | Como la nave pero más tranquila, con el viento de Marte apenas audible, grave y apagado por el casco. | `viento` 0..1 |
| `eva` | Dentro del traje en Marte: ventilador y bomba del traje, tu respiración y un viento exterior muy débil. | `respiracion` (por minuto; < 3 no se oye), `viento` 0..1 |
| `lanzamiento` | Vibración de los motores por la estructura (dura mientras haya empuje), ruido que llega por el aire (se apaga al subir), crepitar y ráfagas. Con empuje 0 solo quedan los ventiladores. | `empuje` 0..1, `altitudKm`, `presionDinamica` 0..1 opcional (golpeteo en máx. Q) |
| `descenso` | Rugido de la entrada, aleteo del paracaídas, retrocohetes. | `calor`, `paracaidas`, `retro` 0..1; `marte` 1 para Marte |

Para una caminata en el vacío, `eva` con `viento: 0`. Para una toma exterior en el espacio, `'ninguno'` (silencio total) u `'orbita'` si la cámara representa a alguien dentro de la nave.

### Eventos

`alarma` (bucle), `aviso`, `clic`, `quindarInicio`, `quindarFin`, `radio`, `esclusa`, `paso`, `separacion`, `teclado`, `exito`, `latido`, `ejercicio` (bucle).

Opciones: `volumen` (multiplica, máx. 2) en todos; `direccion: 'despresurizar' | 'presurizar'` y `duracion` (s, tiempo comprimido del juego) en `esclusa`; `duracion` en `radio`; `superficie: 'interior' | 'marte'` en `paso`; `cantidad` en `teclado`; `ritmo` (pasos por minuto) en `ejercicio`, que se puede volver a llamar para cambiarlo sin cortar. Mientras suena la alarma, el ambiente baja a la mitad.

### Chat de voz

```ts
const ctx = sonido.contexto()!
const panner = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse' })
ctx.createMediaStreamSource(streamRemoto).connect(panner).connect(sonido.destinoVoces()!)
```

En Chrome, un stream remoto de WebRTC suele necesitar también estar asignado a un `<audio muted>` para que suene por Web Audio. Es un error conocido del navegador, no del motor.

## Física (verificada) y fuentes

1. **En el vacío no hay sonido.** En órbita o en una toma exterior solo suena lo que se oye dentro de la nave o del traje.
2. **Marte tiene menos del 1 % de la presión de la Tierra:** 6.36 mb en superficie contra 1014 mb. Fuentes: NASA, [Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) y [Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html).
3. **El sonido en Marte (micrófonos de Perseverance).** Fuente: S. Maurice et al., "In situ recording of Mars soundscape", *Nature* 605, 653-658 (2022), [doi:10.1038/s41586-022-04679-0](https://doi.org/10.1038/s41586-022-04679-0).
   - Por la baja impedancia acústica del aire, una misma fuente suena unos 20 dB más débil que en la Tierra. El motor usa ese factor (0.1 en amplitud) para lo que viaja por el aire exterior en `descenso` con `marte: 1`. Aplicarlo a todo el ruido exterior es una aproximación del juego.
   - La atenuación es muy grande, sobre todo por encima de 1 kHz. Respecto a 1 m, una onda de 8 kHz pierde 40 dB a 8 m; en la Tierra haría falta estar a 65 m. Por eso el viento y los pasos en Marte se oyen graves y apagados.
   - **Dos velocidades del sonido.** Hay dos valores separados por unos 10 m/s, por debajo y por encima de 240 Hz: unos 240 m/s para los graves y unos 250 m/s para los agudos (en la Tierra, unos 340 m/s). El motor no lo simula, porque no hay fuentes lejanas, pero es un dato para mostrar al jugador. Resumen del CNRS: [Perseverance records the first ever sounds from Mars](https://www.cnrs.fr/en/perseverance-records-first-ever-sounds-mars) (1 de abril de 2022), que también da la presión 170 veces menor y la dificultad para conversar a 5 m. NASA: [Sounds of Mars](https://science.nasa.gov/mission/mars-2020-perseverance/sounds-of-mars/), sobre una atmósfera unas 100 veces menos densa y la pérdida de los sonidos agudos.
4. **Las naves son ruidosas.** En la ISS se midieron 56-60 dBA en el Nodo 1 y el FGB, 69 dBA en el Módulo de Servicio y 77 dBA durante el ejercicio en la cinta. Las alarmas de precaución y advertencia suenan entre 0.5 y 2 kHz y deben estar 20 dBA por encima del ruido ambiente. La especificación de EE. UU. es NC-50 despierto y NC-40 dormido. Fuente: J. B. Clark, "Acoustic Issues in Human Spaceflight", NASA Johnson Space Center, [NTRS 20100031889](https://ntrs.nasa.gov/citations/20100031889). Son mediciones antiguas: hoy hay ventiladores más silenciosos.
5. **Origen del ruido del lanzamiento y la entrada:** combustión, mezcla del chorro con el aire, presiones de la capa límite y ondas de choque. Fuente: NASA, [NASA-STD-3001 Technical Brief: Acoustics (OCHMO-TB-035 Rev C, 2023)](https://www.nasa.gov/sites/default/files/atoms/files/acoustics_technical_brief_ochmo_0.pdf). El motor separa lo que llega por la estructura (dura mientras hay empuje) de lo que llega por el aire. Esto último se escala con la densidad relativa exp(−h / 8.5 km), donde 8.5 km es la altura de escala de la Earth Fact Sheet. Es una aproximación isotérmica del juego.
6. **Dentro del traje** lo que más se oye son las bombas y ventiladores que mueven aire y agua; no es "solo tu respiración", y los golpes de herramientas en el vacío no se oyen. Fuente: el astronauta Garrett Reisman en [What Sounds Do Astronauts Hear During a Spacewalk?](https://www.slate.com/blogs/quora/2013/10/14/what_sounds_do_astronauts_hear_during_a_spacewalk.html) (Slate/Quora, 14 de octubre de 2013).
7. **Tonos Quindar (Apolo):** seno puro de 250 ms, 2525 Hz al pulsar el botón de CAPCOM y 2475 Hz al soltarlo. Encendían y apagaban los transmisores remotos. Fuentes: [Quindar tones (Wikipedia)](https://en.wikipedia.org/wiki/Quindar_tones), que en esas cifras no tiene cita en línea, y [Apollo S-band, part 27: adding Quindar tones](https://scanalyst.fourmilab.ch/t/apollo-spacecraft-s-band-communication-system-part-27-adding-quindar-tones-to-voice-communication/3104), que coincide. Sin verificar directamente (la página del Apollo Lunar Surface Journal ya no está en línea): un ingeniero cita 2474 Hz para el segundo tono, y la tripulación casi no los oía porque un filtro los quitaba del enlace. El juego los usa como señal de radio, que es como los conoce el público.

## Decisiones de diseño (no son datos)

Son decisiones del juego y no reproducen niveles en dBA:

- los niveles de la mezcla;
- los timbres, y las frecuencias de los zumbidos, la alarma, los pasos, el latido y el metal de la separación;
- la respiración por defecto (14 por minuto) y su reparto entre inhalar, pausa y exhalar;
- los perfiles de las simulaciones de `Demo.tsx`, en tiempo comprimido;
- la duración de la esclusa, también en tiempo comprimido.

Los niveles se afinan en `NIVEL` (en `motor.ts`) y en cada pieza.

## Límites

- No se escuchó en un navegador durante la construcción. Se verificó con `tsc` y con una prueba en Node contra un Web Audio simulado: sin llamadas inválidas, todas las fuentes se detienen y los nodos se desconectan. Los niveles se calcularon, no se midieron. Conviene escucharlo con `DemoSonido` y afinar.
- Los graves (latido, separación, retumbo) apenas se oyen en parlantes de laptop. Con audífonos se oyen bien.
- En iPhone, el interruptor de silencio puede apagar el audio web.
- El compresor de Web Audio aplica una ganancia de compensación automática. El `recorte` de la cadena maestra la compensa aproximadamente.
