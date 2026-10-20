# Junior Astronaut Mission Trainer · Mars Base

A 3D multiplayer game for the **"Build a Junior Astronaut Mission Trainer"** challenge of the NASA Space Apps Challenge 2026.

You can play alone, with five bot crew members filling the other roles, or as a group, with a crew of 2 to 6 students in the same room. To start, you only need to type a name; an account with a password is optional. The mission follows the plan the team designed: first the crew gets the situation they have to face, then each person gets a role, the objective is set and they choose the supplies. Each player controls their astronaut in third person: they live through the launch, cross space inside the ship, land and build a base on Mars. Each astronaut's body, the air, the water, the power, the weather and the radiation are calculated with values published by NASA.

**Online:** https://mision-marte-trainer.nunesjaramilloluis.workers.dev

## Demonstration for the judges (about 10 minutes)

1. Open the link, type a name and press **Start**.
2. Choose **Single player with bots** and a situation, for example *Water Under the Ice*. Five bots complete the crew.
3. In the Mission Briefing, read the real situation, take the **Mission Commander** role, name the mission and choose the supplies. The Assistant works out how many days each supply will last.
4. Launch: countdown, then the climb over Cape Canaveral with Earth below, made from real NASA images.
5. During the cruise, speed up time. Look out the big window: Earth and the Moon move away and Mars grows, in their real positions for the date. The bots work, report in the chat and make proposals; the commander approves them in **Proposals**. If an emergency comes up, time slows down on its own.
6. In Mars orbit, approve the landing site and watch the entry, descent and landing with the real Perseverance timeline.
7. At the base, open the Base Dashboard with `M` and watch the step-by-step assembly: panels tilted for the latitude, breakers closed in order, the airlock leak check. In the lab, the garden works like the Veggie system on the ISS.
8. The **Sources** button shows where each real fact comes from and what the game simplifies.

To show it on a basic computer, the **HD** button in the top bar switches to the Lite graphics.

## How to play

1. **Room.** Choose to play alone with bots or as a group. In a group you share the 6-character room code. Each player picks a look for their character (skin, hair color, hairstyle, suit and visor) and a home city, which is marked on Earth and sends messages from home. There are no roles yet. The person who creates the room chooses the situation or leaves it to chance. A group needs at least 2 players; when playing alone, the bots complete the crew.
2. **Mission Briefing.** A simple screen with one step per page, and each crew member moves at their own pace:
   1. *The Situation.* The crew gets one of six situations, each with a real launch date, its true background, its challenge and its own events: First Base on Mars, Solar Maximum, Dust Storm Season, Water Under the Ice, Traces of an Ancient Lake and Trouble On Board. Then come the facts that apply to any trip to Mars.
   2. *Role Assignment.* Each person chooses one of the six roles. The Assistant explains the consequences. A commander is required.
   3. *Mission Objective.* The commander sets how many sols the crew stays and names the mission. The pilot or the commander chooses the trajectory.
   4. *Supplies.* There are three options for the amount of supplies, which can also be adjusted by hand up to a cargo limit. The Assistant works out how many days each supply will last.
3. **Launch.** Countdown and climb with telemetry: altitude, speed, acceleration, fuel and energy used. Each crew member's pulse rises with the g-forces.
4. **Cruise to Mars.** You walk around inside the ship. The trip lasts 150, 210 or 259 mission days depending on the trajectory. The screen and the log record the days and hours in space, the fuel and the energy used. The commander controls the time scale.
5. **Mars Arrival.** From orbit, the crew chooses the landing site and lives through the descent.
6. **Reach the Base.** After landing, the Base Dashboard opens with the Base Assembly mission: choose the location, deploy the habitat and equipment, turn on life support and power, and check the facilities. The responsible role does each task by going to the right place, inside or outside, step by step as in real life: press and hold while a panel unrolls, tighten the anchors in a cross pattern, set the tilt for the latitude, power up from the source toward the loads, and read the airlock pressure drop before calling it airtight. How you do it matters: a badly aimed panel produces less, and a leak you let slide keeps losing air.
7. **Manage Resources.** The Base Dashboard gathers the options from the plan, each with its own screen: track water, oxygen, food and power; decide how to share limited resources; manage production and recycling; maintain the equipment; protect the crew from radiation; and the plant garden, which follows the ISS Veggie system: choose the crop, deploy the chamber, turn on the lights, place the pillows and water them with a syringe. After that you water them when they dry out, thin the seedlings, check the leaves for mold or drooping, and harvest. The commander approves or rejects the others' decisions.
   The crew's hands-on work is step by step too. Going outside means putting on the suit in order, a suit leak check, a prebreathe plan to avoid the bends and pumping down the airlock; coming back in means brushing off the dust, repressurizing and taking the suit off. A repair is an ISS-style unit swap with lockout and a checkout test. A leak is found, patched and checked by pressure decay. Samples are taken like Perseverance takes them and analyzed like Curiosity does, and the Flight Surgeon examines, diagnoses, can ask Earth with the real signal delay and treats. Bad choices have consequences: a skipped prebreathe can give the bends, an ignored suit leak drains oxygen, and a poor rock does not count for the objective. While someone is in the middle of one of these, time runs no faster than ×600.
8. **Emergencies.** An alert, finding the problem and options with different consequences. The ones that involve several roles go to the commander or to a vote.

During the cruise there is no gravity: the characters float, push off with inertia, and loose objects float around the module. Each space has its own animation: running on the treadmill or pedaling in the gym, sleeping in a sleeping bag strapped to the wall (on Mars, in a bunk), typing at the consoles and curling up in the Storm Shelter. Through the big window you see the real sky for the date from the ship's real position: Earth moving away with the Moon, Mars growing, the planets and the stars. At night on Mars, Earth shines like a bright star.

There is sound in every scene and proximity voice chat: inside, you hear people nearby more loudly, and you hear people outside in their suits over the radio. The Galley Table in the module is the place to meet and talk. Mission Control and the families send messages during the trip, with the real signal delay, and at the end you can download a Mission Certificate.

In single player mode, the bots do their role's work under the same rules as a person: they walk to each station, suit up and go outside, follow the procedures, make proposals and vote, and report in the chat. They never do what belongs to the person's role; they remind them, and they only decide for them if an emergency is about to run out of time.

The side panel always shows the crew, with their oxygen, health, pulse and progress, and the Critical Points are shown below.

Controls: `W A S D` to move (with no gravity, to push off), `Shift` to run, drag to turn the camera, mouse wheel to zoom, `E` to use the nearby station, `M` to open the Base Dashboard, `H` to hide the panels. On touch screens a joystick appears.

## Roles and responsibilities

| Task | Roles |
|---|---|
| Choose the base location | Pilot + commander |
| Deploy the habitat and equipment | Logistics + pilot |
| Turn on life support and power | Systems + commander |
| Check the facilities | Systems |
| Share resources (rations, power priority) | Logistics + commander |
| Production and recycling (turn equipment on or off) | Logistics + commander + flight surgeon |
| Protect from radiation (shelter, exercise) | Flight surgeon + commander |
| Maintain the equipment | Systems |
| Garden and samples | Science specialist |
| Treatments | Flight surgeon |
| Time scale, launch | Commander |

If the responsible role is not connected, any crew member can do the task, so the game can be played with a small group.

## What is real and what is game design

The full list, with links, is in the game (**Sources** button) and in [shared/ciencia.ts](shared/ciencia.ts).

- **Real data built in:** the weather of one Martian year measured by the Curiosity rover (669 sols) and the 2024 space weather events from NASA's DONKI database (54 X-class flares and 29 particle storms). They are regenerated with `python scripts/datos-nasa.py`.
- **The sky and the dates:** 5,044 real stars from the Hipparcos catalog (XHIP), the 88 IAU constellations and the Milky Way; the Sun, the Moon and the planets in their real positions for the mission date with astronomy-engine, validated against JPL Horizons. The ship follows a transfer orbit calculated with Lambert's problem, and the launch windows are the real ones.
- **The season on Mars:** the arrival date sets the Martian season (Ls), and with it the Curiosity record used as the weather.
- **Constants checked against their source:** oxygen use and CO2, water and food production per person, ISS water recycling, the CO2 limit, the capacity of the ISS scrubber and oxygen generator, radiation during the cruise and on the surface, the career dose limit, Mars data, the EMU suit, the Kilopower reactor.
- **Real images:** Earth with Blue Marble, the 2016 Black Marble night lights and NASA Earth Observatory clouds; the Moon with the LROC and LOLA maps from NASA's Scientific Visualization Studio; Mars with the Viking color mosaic and the MOLA altimeter relief, from USGS. The credits are in [public/texturas/CREDITOS.md](public/texturas/CREDITOS.md) and are regenerated with `node scripts/texturas-reales.mjs`.
- **Descent:** entry, parachute, heat shield, terrain navigation and sky crane follow the reconstructed timeline of the Perseverance landing on February 18, 2021.
- **Procedures:** the assembly and the garden follow real NASA practice: ROSA roll-out panels, the ISS power buses, leak checks by pressure drop, the LSMS crane, the Kilopower reactor and the ISS Veggie and APH experiments. The crew's work does too: ISS prebreathe protocols and NASA's exploration atmosphere, the EMU leak check, Orbital Replacement Unit swaps, the 2018 and 2020 ISS leak repairs, Shuttle and Apollo 13 lithium hydroxide canisters, the InSight panel cleaning, the Perseverance sampling sequence, Curiosity's CheMin and SAM, and NASA's plans for an autonomous Crew Medical Officer.
- **Game design:** the equations that combine those numbers, the size of the habitat and equipment, the masses of the supplies, the dose of each solar storm, the dust model and the damage thresholds. They are shown to the player as assumptions.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The client (Vite) runs on port 5173 and the server on 3001. To test two players on one computer, use `http://localhost:5173` in one tab and `http://127.0.0.1:5173` in another.

| Command | What it does |
|---|---|
| `npm run typecheck` | Checks the types of the client, the server and the Worker |
| `npm run simular` | Plays a full mission without a browser. Accepts crew size, supply option, policy, trajectory and profile: `npx tsx scripts/simular.ts 4 minimo buena rapida corta` |
| `npm run e2e` | End-to-end test through the API against a running server. Add the URL and `--corto` for the 90-second version |
| `npm run ui -- <url> <folder>` | Interface test with headless Chrome or Edge: it plays like a person, presses the buttons, walks with the keyboard and saves screenshots. `UI_PASOS=ui-multi` tests two players; `UI_PASOS=ui-base` tests the base procedures (needs a room from `scripts/sala-demo.mjs`) |
| `node scripts/texturas-reales.mjs` | Downloads the NASA images of Earth and the Moon and generates the textures in `public/texturas/`. With `--marte` it also does Mars, which downloads about 330 MB |
| `npm run cf:dev` | Builds the site and serves it with the Cloudflare emulator at `http://127.0.0.1:8787`, with Durable Objects and WebSocket as in production |
| `npm run desplegar` | Builds the site and publishes it on Cloudflare |

## Architecture

Everything runs on Cloudflare, on the free plan, with no always-on server.

- **Client:** React, React Three Fiber and Zustand. Each action is an HTTP request. The client also checks the room state twice per second, and in that request it sends its character's position and receives everyone else's. The check goes over WebSocket; if the WebSocket fails, it falls back to HTTP.
- **Worker:** serves the site and routes the `/api/*` requests. It does no calculations: on the free plan it only has 10 ms of CPU per request.
- **Durable Objects:** each room has its own, a single instance in the whole world with the room in memory and its own SQLite storage. The rules and the simulation run there. Accounts live in a separate one. Since each room has a single process, there are never two writers at the same time.
- **Saving:** the room is saved with every action and every 45 seconds while someone is playing. Between saves, time is recalculated deterministically, so if Cloudflare unloads the object from memory, it comes back to the same state.
- **Time:** the mission only moves forward while someone is checking in. If everyone leaves for more than 90 seconds, it stops on its own.

```
shared/types.ts       types, roles, supplies, sites, tasks, time scales
shared/ciencia.ts     real constants, sources and assumptions
shared/plan.ts        supply options and the Assistant's calculations on the cargo
shared/procedimientos.ts  step-by-step assembly, garden and crew procedures (airlock, repairs, samples, treatments)
server/cloudflare.ts  Worker and Durable Objects: request routing, WebSocket, storage
server/api.ts         game operations: accounts, rooms, positions, saving
shared/escenarios.ts  mission situations, real dates and home cities
shared/astronomia.ts  Mars season (Ls) from the date
server/game.ts        rules: roles, supplies, proposals, actions, emergencies
server/emergencies.ts emergency catalog
server/bot.ts         rule-based Assistant
server/procedimientos.ts  validates each step and applies its consequences
server/trabajos.ts    consequences of the crew procedures: airlock, repairs, leaks, samples, treatments
server/sim/           simulation: step, physiology, environment, flight, garden
server/datos/         generated NASA data
server/almacen*.ts    where documents are stored: Durable Object, local files or Vercel Blob
server/index.ts       local development server (Express)
src/mundo/            3D scenes, animated character, controls, station map
src/mundo/cielo/      real sky: stars, constellations, planets, trajectory
src/sonido/           sound generated in the browser
src/voz.ts            proximity voice chat (WebRTC)
src/hud/              panels, stations, proposals, emergencies, Assistant, sources
src/screens/          login, home, room, step-by-step Mission Briefing, game
scripts/              simulation, e2e test, NASA data
wrangler.jsonc        Cloudflare deployment configuration
```

## Deployment

The site is on Cloudflare Workers, in the account `e205fb741a6d9827ec596ebd9adfa1da`, as the Worker `mision-marte-trainer`. The configuration is in [wrangler.jsonc](wrangler.jsonc).

```bash
npx wrangler login
```

```bash
npm run desplegar
```

The first command is only needed once per computer. The session secret `AUTH_SECRET` is already stored in Cloudflare and deployments do not touch it. For the local emulator it is read from `.dev.vars`, which is not uploaded to git.

The previous Vercel deployment is still in the repository as an alternative (`npm run desplegar:vercel`), but it is no longer the one in use.

## Known limits

- The Cloudflare free plan allows 100,000 requests per day, both to the Worker and to the Durable Objects, and it resets at 00:00 UTC. With WebSocket checks, each player uses about 400 per hour of play. If they run out on a given day, the game stops responding until the next day.
- Accounts and rooms created on the Vercel deployment did not move to Cloudflare: you have to sign up again.
- The whole game is in English.
- The Assistant answers with rules, not with a language model.
- Crewmates' movement is updated twice per second and smoothed on screen.
- There is no first-person view.
- Voice chat connects peer to peer without a TURN server: on some very locked-down networks it cannot connect. It only works in the published game, not with `npm run dev`.
