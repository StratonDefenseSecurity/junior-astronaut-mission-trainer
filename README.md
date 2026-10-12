# Mission Trainer · Base Marte

Juego 3D multijugador para el reto **"Build a Junior Astronaut Mission Trainer"** del NASA Space Apps Challenge 2026.
Una tripulación de 2 a 6 estudiantes crea su cuenta, entra a una sala, elige un rol y opera una base en Marte
equilibrando soporte vital, radiación, energía y alimentos. Las decisiones en disputa las aprueba el comandante o se votan.

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. El cliente (Vite) corre en el 5173 y el servidor de juego (Socket.IO) en el 3001.
Para probar multijugador en una sola computadora abre una pestaña en `http://localhost:5173` y otra en `http://127.0.0.1:5173`
(son orígenes distintos, así cada una guarda su propia sesión).

Producción (un solo proceso sirve todo):

```bash
npm run build
npm start
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run typecheck` | Revisa tipos de cliente y servidor |
| `npm run simular` | Simula una misión completa con 6 roles sin navegador y verifica la lógica |

## Flujo del juego (según el mapa del equipo)

1. **Lobby**: cuenta, sala con código de 6 letras, elección de rol. Se necesita comandante y al menos 2 jugadores.
2. **Contextualización**: situación, objetivo, consecuencias del rol y elección de suministros con límite de 40 t. El asistente explica cada elección. El comandante autoriza el lanzamiento.
3. **Lanzamiento**: animación del despegue, combustible según la masa, días en tránsito.
4. **Ensamblaje de la base**: ubicación (piloto + comandante), despliegue (logística + piloto), activación (sistemas + comandante), comprobación (sistemas). Si un rol no está en la sala, el sistema completa su parte.
5. **Gestión diaria**: reloj de misión compartido (1 hora cada 2.5 s). Recursos, desgaste de equipos, día y noche, radiación, huerto artificial, experimentos. Objetivo: 6 soles y 3 experimentos.
6. **Emergencias**: alerta → problema → alternativas con consecuencias distintas y un temporizador. Tormenta solar, fallo de soporte vital, fuga de agua, tripulante enfermo, panel dañado, inventario incorrecto.
7. **Chatbot**: recibe la consulta, revisa el estado real de la sala, evalúa los datos y explica riesgos. Funciona por reglas, sin claves ni internet.

## Roles y responsabilidades

| Tarea | Roles |
|---|---|
| Elegir ubicación | Piloto + comandante |
| Desplegar hábitat | Logística + piloto |
| Activar soporte vital y energía | Sistemas + comandante |
| Comprobar instalaciones | Sistemas |
| Distribuir recursos (ración) | Logística + comandante |
| Producción y reciclaje | Logística + comandante + médico |
| Proteger de la radiación (refugio) | Médico + comandante |
| Mantener equipos, prioridad de energía | Sistemas |
| Huerto artificial, experimentos | Científico |
| Revisión médica | Médico |

Las acciones con más de un rol responsable se convierten en propuestas. El comandante las aprueba o rechaza,
o se votan por mayoría según el modo elegido al crear la sala. Cualquier integrante puede pedir ayuda a otro rol
y el otro ve un botón "Ir a ayudar".

## Estructura

```
shared/types.ts     tipos, roles, suministros, sitios, módulos, acciones (compartido)
server/index.ts     Express + Socket.IO, cuentas en server/data/users.json, salas en memoria
server/game.ts      lógica autoritativa: fases, propuestas, acciones, tick por hora
server/emergencies.ts catálogo de emergencias y efectos
server/bot.ts       chatbot por reglas
src/three/          escenas 3D (React Three Fiber): plataforma, lanzamiento, base marciana
src/hud/            paneles de interfaz por fase, tripulación, propuestas, emergencias, chat
src/screens/        acceso, inicio, lobby, juego
scripts/simular.ts  prueba de punta a punta de la lógica
```

## Límites conocidos

- Las salas viven en memoria: si el servidor se reinicia, las misiones en curso se pierden. Las cuentas sí persisten.
- Vista de la base en tercera persona con cámara orbital. No hay modo en primera persona todavía.
- El chatbot es por reglas. Se puede conectar a un modelo de lenguaje desde `server/bot.ts` sin tocar el cliente.
- Para desplegar en un host con un solo puerto (Render, Railway, Fly) basta `npm run build` y `npm start`; el servidor toma `PORT` del entorno.
