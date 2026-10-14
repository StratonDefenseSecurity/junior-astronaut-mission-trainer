# Mission Trainer · Base Marte

Juego 3D multijugador para el reto **"Build a Junior Astronaut Mission Trainer"** del NASA Space Apps Challenge 2026.

Una tripulación de 2 a 6 estudiantes crea su cuenta y entra a una sala. La misión sigue el esquema que diseñó el equipo: primero se les da la situación que tienen que afrontar, después cada uno recibe su rol, se establece el objetivo y eligen los suministros. Cada jugador controla a su astronauta en tercera persona: vive el despegue, cruza el espacio dentro de la nave, aterriza y monta una base en Marte. El cuerpo de cada astronauta, el aire, el agua, la energía, el clima y la radiación se calculan con valores publicados por NASA.

**En línea:** https://mision-marte-trainer.nunesjaramilloluis.workers.dev

## Cómo se juega

1. **Sala.** Cuenta, código de sala de 6 caracteres y traje. Aquí todavía no hay roles. Hacen falta al menos 2 jugadores para empezar.
2. **Contextualización.** Es una interfaz sencilla, de un paso por pantalla, y cada integrante avanza a su ritmo:
   1. *La situación.* Se le da a cada uno la situación que tiene que afrontar: lo que dura el viaje, lo lejos que queda la Tierra, el aire, el frío, la radiación y lo que consume cada persona.
   2. *Asignación de roles.* Cada uno elige su rol entre los seis. El asistente dice qué consecuencias tiene. Hace falta un comandante.
   3. *Objetivo de la misión.* El comandante establece cuántos soles se quedan y cuántas muestras analizan. El piloto o el comandante eligen la trayectoria.
   4. *Suministros.* Se presentan tres alternativas sobre la cantidad de suministros, que también se pueden ajustar a mano con un límite de carga. El asistente analiza para cuántos días alcanza cada cosa.
3. **Lanzamiento.** Cuenta regresiva y ascenso con telemetría: altitud, velocidad, aceleración, combustible y energía usada. El pulso de cada tripulante sube con las g.
4. **Viaje a Marte.** Se camina por el interior de la nave. Dura 150, 210 o 259 días de misión según la trayectoria. En pantalla y en la bitácora quedan registrados los días y horas que llevan en el espacio, el combustible y la energía usada. El comandante controla la escala de tiempo.
5. **Llegada.** Desde la órbita se elige el sitio de aterrizaje y se vive el descenso.
6. **Llegar a la base.** Al aterrizar se presenta la página principal, con la misión de ensamblaje: elegir ubicación, desplegar hábitat y equipos, activar soporte vital y energía, comprobar instalaciones. Cada tarea la hace el rol responsable yendo al lugar, dentro o fuera.
7. **Administrar recursos.** La página principal reúne las opciones del esquema, cada una con su sub-interfaz: controlar agua, oxígeno, alimentos y energía; decidir cómo distribuir recursos limitados; administrar producción y reciclaje; mantener los equipos; proteger a la tripulación de la radiación; y el huerto artificial. El comandante aprueba o rechaza las decisiones de los demás.
8. **Emergencias.** Alerta, identificación del problema y alternativas con consecuencias distintas. Las de varios roles pasan por el comandante o se votan.

Al lado se ve siempre a los integrantes, con su oxígeno, su salud, su pulso y su progreso, y abajo los puntos críticos.

Controles: `W A S D` para moverse, `Mayús` para correr, arrastrar para girar la cámara, rueda para acercarla, `E` para usar la estación cercana, `M` para abrir la página principal, `H` para ocultar los paneles. En pantallas táctiles aparece una palanca.

## Roles y responsabilidades

| Tarea | Roles |
|---|---|
| Elegir ubicación de la base | Piloto + comandante |
| Desplegar hábitat y equipos | Logística + piloto |
| Activar soporte vital y energía | Sistemas + comandante |
| Comprobar instalaciones | Sistemas |
| Distribuir recursos (raciones, prioridad de energía) | Logística + comandante |
| Producción y reciclaje (encender o apagar equipos) | Logística + comandante + médico |
| Proteger de la radiación (refugio, ejercicio) | Médico + comandante |
| Mantener equipos | Sistemas |
| Huerto y muestras | Científico |
| Tratamientos | Médico |
| Escala de tiempo, lanzamiento | Comandante |

Si el rol responsable no está conectado, cualquier tripulante puede hacer su tarea, para que se pueda jugar con pocos.

## Qué es real y qué es del juego

La lista completa, con enlaces, está en el juego (botón **Fuentes**) y en [shared/ciencia.ts](shared/ciencia.ts).

- **Datos reales integrados:** el clima de un año marciano medido por el rover Curiosity (669 soles) y los eventos de clima espacial de 2024 de la base DONKI de NASA (54 fulguraciones de clase X y 29 tormentas de partículas). Se regeneran con `python scripts/datos-nasa.py`.
- **Constantes verificadas contra su fuente:** consumo de oxígeno y producción de CO2, agua y comida por persona, reciclaje de agua de la ISS, límite de CO2, capacidad del depurador y del generador de oxígeno de la ISS, radiación en crucero y en superficie, límite de dosis de carrera, datos de Marte, traje EMU, reactor Kilopower.
- **Del juego:** las ecuaciones que combinan esos números, el tamaño del hábitat y de los equipos, las masas de los suministros, la dosis de cada tormenta solar, el modelo de polvo y los umbrales de daño. Se muestran al jugador como supuestos.

## Desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. El cliente (Vite) corre en el 5173 y el servidor en el 3001. Para probar dos jugadores en una computadora usa `http://localhost:5173` en una pestaña y `http://127.0.0.1:5173` en otra.

| Comando | Qué hace |
|---|---|
| `npm run typecheck` | Revisa tipos del cliente, del servidor y del Worker |
| `npm run simular` | Juega una misión completa sin navegador. Acepta tripulantes, alternativa, política, trayectoria y perfil: `npx tsx scripts/simular.ts 4 minimo buena rapida corta` |
| `npm run e2e` | Prueba de punta a punta por la API contra un servidor en marcha. Añade la URL y `--corto` para la versión de 90 segundos |
| `npm run cf:dev` | Compila el sitio y lo sirve con el emulador de Cloudflare en `http://127.0.0.1:8787`, con Durable Objects y WebSocket como en producción |
| `npm run desplegar` | Compila el sitio y lo publica en Cloudflare |

## Arquitectura

Todo corre en Cloudflare, en el plan gratuito, sin un servidor siempre encendido.

- **Cliente:** React, React Three Fiber y Zustand. Cada acción es una petición HTTP. Además consulta el estado de la sala dos veces por segundo, y en esa consulta envía la posición de su personaje y recibe la de los demás. La consulta va por WebSocket; si el WebSocket falla, sigue por HTTP.
- **Worker:** sirve el sitio y reparte las peticiones de `/api/*`. No calcula nada: en el plan gratuito solo dispone de 10 ms de CPU por petición.
- **Durable Objects:** cada sala tiene el suyo, una única instancia en todo el mundo con la sala en memoria y su propio almacenamiento SQLite. Ahí corren las reglas y la simulación. Las cuentas viven en otro. Como cada sala tiene un solo proceso, nunca hay dos escribiendo a la vez.
- **Guardado:** la sala se guarda con cada acción y cada 45 segundos mientras alguien juega. Entre guardados el tiempo se recalcula de forma determinista, así que si Cloudflare descarga el objeto de memoria, al volver llega al mismo estado.
- **Tiempo:** la misión solo avanza mientras alguien consulta. Si todos se van más de 90 segundos, se detiene sola.

```
shared/types.ts       tipos, roles, suministros, sitios, tareas, escalas
shared/ciencia.ts     constantes reales, fuentes y supuestos
shared/plan.ts        alternativas de suministros y cuentas del asistente sobre la carga
server/cloudflare.ts  Worker y Durable Objects: reparto de peticiones, WebSocket, almacenamiento
server/api.ts         operaciones del juego: cuentas, salas, posiciones, guardado
server/game.ts        reglas: roles, suministros, propuestas, acciones, emergencias
server/emergencies.ts catálogo de emergencias
server/bot.ts         asistente por reglas
server/sim/           simulación: paso, fisiología, ambiente, vuelo
server/datos/         datos de NASA generados
server/almacen*.ts    dónde se guardan los documentos: Durable Object, archivos locales o Vercel Blob
server/index.ts       servidor local de desarrollo (Express)
src/mundo/            escenas 3D, personaje, controles, mapa de estaciones
src/hud/              paneles, estaciones, propuestas, emergencias, asistente, fuentes
src/screens/          acceso, inicio, sala, contextualización por pasos, juego
scripts/              simulación, prueba e2e, datos de NASA
wrangler.jsonc        configuración del despliegue en Cloudflare
```

## Despliegue

El sitio está en Cloudflare Workers, en la cuenta `e205fb741a6d9827ec596ebd9adfa1da`, como el Worker `mision-marte-trainer`. La configuración está en [wrangler.jsonc](wrangler.jsonc).

```bash
npx wrangler login
```

```bash
npm run desplegar
```

El primer comando solo hace falta una vez por computadora. El secreto de sesiones `AUTH_SECRET` ya está guardado en Cloudflare y los despliegues no lo tocan. Para el emulador local se lee de `.dev.vars`, que no se sube a git.

El despliegue anterior en Vercel sigue en el repositorio como alternativa (`npm run desplegar:vercel`), pero ya no es el que se usa.

## Límites conocidos

- El plan gratuito de Cloudflare admite 100 000 peticiones al día, tanto al Worker como a los Durable Objects, y se renueva a las 00:00 UTC. Con las consultas por WebSocket, cada jugador gasta unas 400 por hora de juego. Si un día se agotan, el juego deja de responder hasta el día siguiente.
- Las cuentas y las salas creadas en el despliegue de Vercel no pasaron a Cloudflare: hay que registrarse de nuevo.
- El asistente responde por reglas, no con un modelo de lenguaje.
- El movimiento de los compañeros se actualiza dos veces por segundo y se suaviza en pantalla.
- No hay vista en primera persona.
