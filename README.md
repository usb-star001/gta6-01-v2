# Neon Harbor

[![Neon Harbor on make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/usb-star001/gta6-01-v2/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/usb-star001/gta6-01-v2/reward.svg)](https://make.fun/bounty/gta6-01)

A top-down open-world crime game set in the fictional Port Azure. You are Mara Voss. You came back to Port Azure with nothing but a busted sedan and a name the harbour syndicate remembers — and you owe them **$50,000**. They don't send letters. They send men. Drive, deliver, don't get caught, and pay it all back.

Built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — a playable open-world crime game in the browser. Canvas + ES modules, no libraries, no network calls, WebAudio synth sound.

## How to run

Serve the repo root over HTTP (any static server) and open `game/index.html`, or open `game/index.html` directly. The entrypoint is `main.ts`, which boots `game/main.js`.

```sh
python3 -m http.server 8000
# then open http://localhost:8000/game/index.html
```

## The city

Port Azure is a 3600×2800 open city on a road grid, with buildings, a harbor along the south edge, traffic cars, pedestrians on the sidewalks, and parked cars worth stealing. A full day/night cycle takes about five minutes: streets darken, the "Night Run" race only opens after dark, and the music shifts with the hour.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Drive (in a car) or walk (on foot) |
| E | Steal / enter a car (press again to get out) |
| Space | Handbrake |
| Mouse | Aim (on foot) |
| Click | Shoot the pistol (on foot) |
| F | Start a job or race at a marker |
| H | Mara's Record — stats and records screen |

## Jobs

**Eddie Kline** has three story jobs, in order: First Fare ($150), The Getaway ($300), and Harbor Run ($500). Each is a pickup and a drop-off. Finish all three and **Rosa "The Broker"** opens up with three more: The Smuggler ($400), The Tail ($350 — follow a grey sedan for 20 seconds without losing him), and The Payoff ($600). After Eddie, Rosa also offers repeatable delivery gigs ($80–$150) at her corner, and the taxi stand runs repeatable fares ($40–$90) from the start.

## Races

Three street races with checkpoints and par times: Harbor Sprint (par 60s), Uptown Loop (par 90s), and Night Run (par 75s, night only). Winning pays $300.

## Collectibles and vehicles

Twelve hidden packages are scattered around the city — each is worth $250. The drivable fleet is the player sedan (64×30), the **Night Hawk** motorcycle (1.6× top speed), and the **Harbor Hauler** truck. All three are parked somewhere in the city and can be stolen.

## Wanted level

Stealing cars, hitting pedestrians, and shooting raise your wanted level (0–5 stars). Police cars chase and ram you. Break line of sight and stay hidden and the heat dies down. At 3+ stars the music switches to a tense loop.

## Sound

All sound is synthesized in WebAudio: engine hum that follows your speed, and two music loops — "Dusk" and "Night Run" — that trade every four bars, with a tense loop forced at 3+ wanted stars.

## Stats and saving

Press H for **Mara's Record**: session totals and all-time totals (money earned, jobs done, races won, packages found, shots fired, cars stolen), saved in localStorage. Progress, money, debt, and collected packages save automatically.

## Files

- `main.ts` — entrypoint, boots the game
- `game/index.html` — full-screen canvas shell
- `game/main.js` — game loop, world, camera, rendering, HUD, minimap, police, combat, save/load
- `game/input.js` — keyboard and mouse
- `game/audio.js` — WebAudio synth, music loops, SFX
- `game/missions.js` — Eddie Kline's three jobs
- `game/sidejobs.js` — Rosa's jobs, delivery gigs, taxi fares
- `game/races.js` — three street races
- `game/collectibles.js` — twelve hidden packages
- `game/vehicles.js` — car, motorcycle, truck physics and drawing
- `game/daynight.js` — day/night cycle and lighting
- `game/stats.js` — Mara's Record (session + all-time stats)
- `screenshots/` — gameplay screenshots
