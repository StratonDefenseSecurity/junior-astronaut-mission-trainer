# Game sound

Procedural sound engine: everything is synthesized with the Web Audio API. There are no audio files, no network use and no added packages.

- `motor.ts`: the engine (synthesis, mixing, compressor and limiter).
- `index.ts`: the public API (`sonido`) and the `useSonido()` hook.
- `Demo.tsx`: `DemoSonido`, a test bench with buttons for each ambience and event. It is not connected to the game.

## Usage

```ts
import { sonido, useSonido } from './sonido'

sonido.activarAlInteractuar()                  // at startup: the first click or key press turns on audio
sonido.ambiente('lanzamiento', { empuje: 0 })  // 1.5 s crossfade with the previous ambience
sonido.parametros({ empuje: 1, altitudKm: 12 }) // every frame: cheap, creates no nodes
sonido.evento('quindarInicio')
sonido.evento('alarma'); sonido.detener('alarma')
const { activo, silenciado, volumen } = useSonido()
```

| Function | What it does |
|---|---|
| `activar(): Promise<void>` | Creates or resumes the AudioContext. Call it from a user gesture (autoplay policy). It can be called many times. Anything requested earlier (ambience, alarm, exercise) starts on activation. |
| `activarAlInteractuar(): () => void` | Activates on the first `pointerdown`, `keydown`, `touchend` or `click`. Returns a function to cancel. |
| `silenciar(b)`, `volumen(v)` | Mute and master volume 0..1 (default 0.6). Saved in localStorage (`mt_sonido_silencio`, `mt_sonido_volumen`). |
| `estado()` | `{ activo, silenciado, volumen }`, with a stable reference. `suscribir(fn)` notifies when it changes. |
| `ambiente(tipo, parametros?)` | `'ninguno' \| 'nave' \| 'base' \| 'eva' \| 'lanzamiento' \| 'descenso' \| 'orbita'`. With the same type it only updates parameters. |
| `parametros(p)` | Updates the live parameters. Applies at most 20 times per second and only if something changed. |
| `evento(nombre, opciones?)` | Short sounds (table below). If audio is not activated it does not play, except `alarma` and `ejercicio`, which wait for activation. |
| `detener(nombre?)` | Stops `'alarma'` or `'ejercicio'`; with no name, both. |
| `contexto()` | The AudioContext, or `null` before activation. |
| `destinoVoces()` | GainNode for voice chat. It respects mute and volume and goes through the limiter, but not the compressor (the rumble does not lower the voices). `null` before activation. |

### Ambiences and parameters

| Ambience | What you hear | Parameters |
|---|---|---|
| `nave` | Life support fans and pumps (filtered air and a low hum with a slow beat), relays and water gurgling now and then. | None |
| `orbita` | Only the cabin fans, quieter. | None |
| `base` | Like the ship but calmer, with the Martian wind barely audible, low and muffled by the hull. | `viento` 0..1 |
| `eva` | Inside the suit on Mars: the suit fan and pump, your breathing and a very faint outside wind. | `respiracion` (per minute; < 3 is silent), `viento` 0..1 |
| `lanzamiento` | Engine vibration through the structure (lasts while there is thrust), noise arriving through the air (fades as you climb), crackle and gusts. With thrust 0 only the fans remain. | `empuje` 0..1, `altitudKm`, optional `presionDinamica` 0..1 (buffeting at max Q) |
| `descenso` | Roar of entry, parachute flutter, retrorockets. | `calor`, `paracaidas`, `retro` 0..1; `marte` 1 for Mars |

For a spacewalk in vacuum, use `eva` with `viento: 0`. For an outside shot in space, use `'ninguno'` (total silence) or `'orbita'` if the camera stands for someone inside the ship.

### Events

`alarma` (loop), `aviso`, `clic`, `quindarInicio`, `quindarFin`, `radio`, `esclusa`, `paso`, `separacion`, `teclado`, `exito`, `latido`, `ejercicio` (loop).

Options: `volumen` (multiplier, max 2) on all of them; `direccion: 'despresurizar' | 'presurizar'` and `duracion` (s, compressed game time) on `esclusa`; `duracion` on `radio`; `superficie: 'interior' | 'marte'` on `paso`; `cantidad` on `teclado`; `ritmo` (steps per minute) on `ejercicio`, which can be called again to change it without cutting out. While the alarm sounds, the ambience drops to half.

### Voice chat

```ts
const ctx = sonido.contexto()!
const panner = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse' })
ctx.createMediaStreamSource(streamRemoto).connect(panner).connect(sonido.destinoVoces()!)
```

In Chrome, a remote WebRTC stream usually also has to be attached to an `<audio muted>` element to play through Web Audio. This is a known browser bug, not an engine bug.

## Physics (verified) and sources

1. **There is no sound in a vacuum.** In orbit or in an outside shot, you only hear what can be heard inside the ship or the suit.
2. **Mars has less than 1% of Earth's pressure:** 6.36 mb at the surface compared with 1014 mb. Sources: NASA, [Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) and [Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html).
3. **Sound on Mars (Perseverance microphones).** Source: S. Maurice et al., "In situ recording of Mars soundscape", *Nature* 605, 653-658 (2022), [doi:10.1038/s41586-022-04679-0](https://doi.org/10.1038/s41586-022-04679-0).
   - Because of the low acoustic impedance of the air, the same source sounds about 20 dB weaker than on Earth. The engine uses that factor (0.1 in amplitude) for what travels through the outside air in `descenso` with `marte: 1`. Applying it to all outside noise is a game approximation.
   - Attenuation is very large, especially above 1 kHz. Compared with 1 m, an 8 kHz wave loses 40 dB at 8 m; on Earth you would need to be 65 m away. That is why wind and footsteps on Mars sound low and muffled.
   - **Two speeds of sound.** There are two values about 10 m/s apart, below and above 240 Hz: about 240 m/s for low notes and about 250 m/s for high notes (on Earth, about 340 m/s). The engine does not simulate it, because there are no distant sources, but it is a fact worth showing the player. CNRS summary: [Perseverance records the first ever sounds from Mars](https://www.cnrs.fr/en/perseverance-records-first-ever-sounds-mars) (April 1, 2022), which also gives the 170 times lower pressure and the difficulty of talking at 5 m. NASA: [Sounds of Mars](https://science.nasa.gov/mission/mars-2020-perseverance/sounds-of-mars/), about an atmosphere roughly 100 times less dense and the loss of high-pitched sounds.
4. **Spacecraft are noisy.** On the ISS, 56-60 dBA was measured in Node 1 and the FGB, 69 dBA in the Service Module and 77 dBA during treadmill exercise. Caution and warning alarms sound between 0.5 and 2 kHz and must be 20 dBA above the background noise. The U.S. specification is NC-50 awake and NC-40 asleep. Source: J. B. Clark, "Acoustic Issues in Human Spaceflight", NASA Johnson Space Center, [NTRS 20100031889](https://ntrs.nasa.gov/citations/20100031889). These are old measurements: fans are quieter today.
5. **Where launch and entry noise comes from:** combustion, the jet mixing with the air, boundary layer pressures and shock waves. Source: NASA, [NASA-STD-3001 Technical Brief: Acoustics (OCHMO-TB-035 Rev C, 2023)](https://www.nasa.gov/sites/default/files/atoms/files/acoustics_technical_brief_ochmo_0.pdf). The engine separates what arrives through the structure (lasts while there is thrust) from what arrives through the air. The latter is scaled by the relative density exp(−h / 8.5 km), where 8.5 km is the scale height from the Earth Fact Sheet. This is an isothermal game approximation.
6. **Inside the suit**, what you hear most are the pumps and fans moving air and water. It is not "just your breathing", and tool impacts in a vacuum cannot be heard. Source: astronaut Garrett Reisman in [What Sounds Do Astronauts Hear During a Spacewalk?](https://www.slate.com/blogs/quora/2013/10/14/what_sounds_do_astronauts_hear_during_a_spacewalk.html) (Slate/Quora, October 14, 2013).
7. **Quindar tones (Apollo):** a pure 250 ms sine wave, 2525 Hz when CAPCOM pressed the button and 2475 Hz on release. They switched the remote transmitters on and off. Sources: [Quindar tones (Wikipedia)](https://en.wikipedia.org/wiki/Quindar_tones), which has no inline citation for those figures, and [Apollo S-band, part 27: adding Quindar tones](https://scanalyst.fourmilab.ch/t/apollo-spacecraft-s-band-communication-system-part-27-adding-quindar-tones-to-voice-communication/3104), which agrees. Not verified directly (the Apollo Lunar Surface Journal page is no longer online): one engineer cites 2474 Hz for the second tone, and the crew barely heard them because a filter removed them from the link. The game uses them as a radio signal, which is how the public knows them.

## Design choices (not data)

These are game choices and do not reproduce dBA levels:

- the mix levels;
- the tones, and the frequencies of the hums, the alarm, the footsteps, the heartbeat and the separation metal;
- the default breathing rate (14 per minute) and how it is split between breathing in, pausing and breathing out;
- the simulation profiles in `Demo.tsx`, in compressed time;
- the airlock duration, also in compressed time.

Levels are tuned in `NIVEL` (in `motor.ts`) and in each piece.

## Limits

- It was not listened to in a browser during construction. It was checked with `tsc` and with a Node test against a simulated Web Audio: no invalid calls, all sources stop and the nodes disconnect. Levels were calculated, not measured. It is worth listening with `DemoSonido` and tuning.
- Low sounds (heartbeat, separation, rumble) can barely be heard on laptop speakers. With headphones they sound fine.
- On iPhone, the silent switch can turn off web audio.
- The Web Audio compressor applies automatic makeup gain. The `recorte` in the master chain roughly compensates for it.
