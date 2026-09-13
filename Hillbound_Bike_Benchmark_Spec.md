# Hillbound Bike — Deterministic Coding-Agent Benchmark Specification

**Specification version:** 1.0.0  
**Status:** Normative  
**Implementation language:** TypeScript  
**Target runtime:** Modern desktop and mobile web browsers  
**Reference game loop:** Side-scrolling, physics-based hill riding with fuel, coins, airtime, and flips  

> This benchmark is inspired by the general physics-racing loop popularized by *Hill Climb Racing*. The implementation MUST use the original name **Hillbound Bike**, original procedural artwork, original terrain, and original sounds. It MUST NOT copy Fingersoft artwork, characters, source code, level geometry, music, sound effects, logos, or UI. The commercial game's private physics constants are not public; therefore, this document defines the canonical benchmark behavior in full.

---

## 1. Purpose

The task is to build a complete, playable, deterministic 2D motorcycle hill-riding game from this specification.

The game has deliberately narrow scope:

1. One vehicle: a motorcycle with one rider.
2. Exactly two playable levels:
   - **Green Hills** — normal Earth-like gravity and rolling hills.
   - **Moon Run** — low gravity, longer airtime, and crater-like terrain.
3. A complete fuel system with collectible fuel cans.
4. Collectible coins with exact point values.
5. Exact airtime and rotation scoring.
6. A real rigid-body physics simulation with wheels, chassis, suspension, gravity, traction, collisions, and airborne control.
7. Deterministic test hooks, replay, telemetry, and acceptance tests suitable for evaluating a coding-agent harness.

The benchmark evaluates whether an agent can turn a long specification into a reliable product. A visually impressive demo that violates the specified rules is not a passing implementation.

### 1.1 Normative language

The words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative.

- **MUST / MUST NOT:** required for conformance.
- **SHOULD / SHOULD NOT:** expected unless a documented technical reason justifies a deviation.
- **MAY:** optional.

### 1.2 Source of truth

When prose, examples, and tests appear to conflict, use this order:

1. Constants and formulas in this specification.
2. Golden acceptance scenarios in Section 24.
3. Other normative prose.
4. Illustrative examples.

The implementation MUST include a machine-readable copy of all canonical constants in `src/config/gameConfig.ts`. Tests MUST import this configuration rather than duplicating magic numbers.

---

## 2. Required technology

### 2.1 Language choice: TypeScript

All authored application and test logic MUST be TypeScript.

TypeScript is selected because it allows the benchmark to use one language for:

- gameplay;
- rendering and input;
- physics integration;
- deterministic terrain generation;
- unit and browser tests;
- telemetry and replay;
- a headless evaluator API.

JSON, HTML, CSS, Markdown, lockfiles, and tool configuration do not count as additional programming languages. There MUST be no authored JavaScript source files except unavoidable generated build output.

### 2.2 Required stack

The implementation MUST use:

- **Phaser 3.90.0** for scenes, rendering, cameras, input, and browser integration.
- Phaser's bundled **Matter Physics** integration for rigid-body simulation.
- **Vite** for the development server and production build.
- **Vitest** for unit and simulation tests.
- **Playwright** for browser acceptance tests.
- **npm** and a committed `package-lock.json`.

Phaser 3.90.0 is intentionally pinned even if a newer major release exists. The benchmark values reproducible behavior and mature Matter integration over using the newest API. Exact dependency versions MUST be committed; version ranges such as `^3.90.0` MUST NOT be used for Phaser.

### 2.3 Runtime constraints

- The finished game MUST run with `npm ci && npm run build`.
- The development build MUST run with `npm ci && npm run dev -- --host 0.0.0.0`.
- Node.js 22 or 24 is acceptable.
- The game MUST require no backend, database, account, API key, or external service.
- After `npm ci`, build, tests, and gameplay MUST work with network access disabled.
- Runtime code MUST NOT make HTTP, WebSocket, analytics, advertising, or telemetry requests.
- All visual and audio assets MUST be local or generated procedurally.

---

## 3. Deliverables

A conforming submission MUST contain:

```text
/
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── index.html
├── src/
│   ├── main.ts
│   ├── config/
│   │   ├── gameConfig.ts
│   │   └── levels.ts
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── MenuScene.ts
│   │   ├── GameScene.ts
│   │   └── ResultsScene.ts
│   ├── bike/
│   │   ├── Bike.ts
│   │   ├── BikeController.ts
│   │   └── BikeContactTracker.ts
│   ├── terrain/
│   │   ├── terrainHeight.ts
│   │   ├── terrainGeometry.ts
│   │   └── terrainRenderer.ts
│   ├── systems/
│   │   ├── FuelSystem.ts
│   │   ├── PickupSystem.ts
│   │   ├── StuntSystem.ts
│   │   ├── ScoreSystem.ts
│   │   ├── RunStateMachine.ts
│   │   ├── ReplaySystem.ts
│   │   └── Telemetry.ts
│   ├── ui/
│   │   ├── Hud.ts
│   │   ├── TouchControls.ts
│   │   └── overlays.ts
│   ├── audio/
│   │   └── ProceduralAudio.ts
│   ├── testApi/
│   │   └── installTestApi.ts
│   └── types/
│       └── game.ts
├── tests/
│   ├── unit/
│   ├── simulation/
│   └── e2e/
└── public/
    └── favicon.svg
```

Equivalent organization MAY be used, but the concerns MUST remain separately testable. The repository MUST NOT contain a checked-in `node_modules`, production `dist`, credentials, or downloaded copyrighted game assets.

### 3.1 Required npm scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:all": "npm run lint && npm run test && npm run build && npm run test:e2e"
  }
}
```

Additional scripts MAY be added. The meanings of the required scripts MUST NOT be changed.

---

## 4. Product definition

### 4.1 Core loop

The player chooses one of two levels and controls a motorcycle from left to right. The player balances throttle and brake/reverse to cross uneven ground, collects coins and fuel, performs airtime and flips, and tries to travel as far as possible.

A run ends when:

- the rider's head touches terrain;
- the bike remains out of fuel and stops;
- the out-of-fuel hard timeout expires;
- the bike reaches the 1,500 m finish marker; or
- the player manually returns to the menu, in which case the run is abandoned and is not a completion.

### 4.2 Required screens

The game MUST have:

1. Boot/loading screen.
2. Main menu with title and level selection.
3. Gameplay screen.
4. Pause overlay.
5. Results screen.

There MUST be no vehicle-selection screen, upgrades screen, shop, login, advertisement, multiplayer lobby, or level unlock requirement.

### 4.3 Exactly two levels

The menu MUST expose exactly these two level IDs:

| ID | Display name | Description |
|---|---|---|
| `green-hills` | Green Hills | Rolling earth terrain with normal gravity |
| `moon-run` | Moon Run | Cratered terrain with 16.5% gravity |

Both levels MUST be unlocked on first load. No third playable level may appear in the UI, route parameters, configuration, or hidden menu.

### 4.4 One vehicle

Only the `trail-bike` vehicle is playable. Decorative silhouettes in backgrounds are allowed, but they MUST NOT be selectable or physically interactive vehicles.

---

## 5. Coordinate system and canonical units

The implementation MUST use these conventions:

- World horizontal axis: `+x` points right.
- Phaser/Matter vertical axis: `+y` points down.
- Display angle: `0` means the bike faces right.
- Positive Matter angle is clockwise on screen.
- Positive bike rotation is therefore a **front flip** when traveling right.
- `PX_PER_METER = 64`.
- `START_X_PX = 8 * PX_PER_METER = 512`.
- `COURSE_LENGTH_M = 1500`.
- `FINISH_X_PX = START_X_PX + COURSE_LENGTH_M * PX_PER_METER`.
- Nominal viewport: `1280 × 720` CSS pixels.
- Simulation tick: `1 / 60 s`.

Conversion helpers MUST be centralized:

```ts
const PX_PER_METER = 64;
const metersToPixels = (m: number): number => m * PX_PER_METER;
const pixelsToMeters = (px: number): number => px / PX_PER_METER;
```

Distance traveled is calculated from the furthest chassis x-position, never from current x-position:

```ts
maxDistanceM = Math.max(
  previousMaxDistanceM,
  Math.max(0, (chassis.position.x - START_X_PX) / PX_PER_METER),
);
displayDistanceM = Math.floor(maxDistanceM);
```

Moving backward MUST NOT reduce displayed distance or distance score.

---

## 6. Deterministic simulation

### 6.1 Fixed timestep

The physics world MUST advance only in fixed `1000 / 60` millisecond increments.

- Phaser/Matter automatic variable-delta updates MUST NOT determine canonical simulation behavior.
- Render frames MAY be variable.
- An accumulator MAY run zero or more physics ticks per render frame.
- At most five physics ticks may be consumed in one render frame.
- Excess accumulated time beyond five ticks MUST be discarded and a `simulation_time_dropped` telemetry event emitted.
- Game timers, fuel, stunts, replay, and end conditions MUST use simulation ticks, not wall-clock time.
- When the page is hidden, the run MUST auto-pause; hidden time MUST NOT be simulated on return.

Canonical tick constants:

```ts
SIM_HZ = 60
FIXED_DT_S = 1 / 60
FIXED_DT_MS = 1000 / 60
MAX_CATCH_UP_TICKS = 5
```

Matter engine settings:

```ts
enableSleeping = false
positionIterations = 8
velocityIterations = 6
constraintIterations = 4
timeScale = 1
```

Set Phaser Matter `autoUpdate` to `false`. The game loop MUST call Matter `Engine.update(engine, FIXED_DT_MS)` itself for each consumed simulation tick. Phaser scene `update(time, delta)` may feed the accumulator but MUST NOT pass its variable `delta` directly to Matter.

### 6.2 Determinism rules

- `Math.random()` MUST NOT be called by gameplay logic.
- Terrain and pickup placement MUST be pure functions of level configuration and seed.
- Input changes MUST be recorded against integer simulation ticks.
- Collection and scoring order within a tick MUST be stable.
- Collections in the same tick MUST be sorted by pickup ID before scoring.
- Floating-point values in state hashes MUST be rounded to four decimal places.
- Date, locale, device pixel ratio, wall-clock speed, and render frame rate MUST NOT change game rules.
- The deterministic guarantee applies to the same dependency lockfile, browser engine, seed, and ordered input tape.

### 6.3 Canonical state hash

Every 60 ticks, the game MUST be able to calculate a stable SHA-256 hash over this ordered JSON-compatible state:

```ts
interface CanonicalState {
  tick: number;
  levelId: "green-hills" | "moon-run";
  seed: number;
  runState: string;
  chassis: BodySnapshot;
  rearWheel: BodySnapshot;
  frontWheel: BodySnapshot;
  fuel: number;
  score: number;
  maxDistanceM: number;
  collectedPickupIds: string[];
  stunt: StuntSnapshot;
}

interface BodySnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
}
```

Keys MUST be serialized in the order shown. Numeric values MUST be rounded to four decimals, `-0` normalized to `0`, and pickup IDs sorted lexicographically.

---

## 7. Level definitions

### 7.1 Shared level properties

Both levels MUST:

- begin with a flat 14 m safety platform;
- have continuous terrain from 0 m through 1,520 m;
- place the bike at course distance 0 m;
- place a finish arch at 1,500 m;
- use the same bike geometry and base control logic;
- use the same fuel capacity and collection amount;
- contain deterministic fuel and coin placements;
- have no moving platforms or enemies;
- prevent the bike from leaving the course through the left boundary.

### 7.2 Level constants

| Property | Green Hills | Moon Run |
|---|---:|---:|
| Seed | `0x47524831` | `0x4d4f4f4e` |
| Gravity x | `0` | `0` |
| Gravity y | `1` | `1` |
| Gravity scale | `0.001000` | `0.000165` |
| Terrain friction | `0.92` | `0.70` |
| Terrain static friction | `1.00` | `0.85` |
| Terrain restitution | `0.00` | `0.02` |
| Chassis air friction | `0.012` | `0.004` |
| Wheel air friction | `0.008` | `0.003` |
| Airtime score multiplier | `1.0` | `1.5` |
| Visual theme | daylight grassland | dark lunar surface |

The Moon gravity scale is exactly 16.5% of Green Hills gravity. Tests MUST compare the configured values directly and MUST also include a free-fall behavioral comparison.

---

## 8. Terrain generation

### 8.1 Height representation

Terrain height `h(x)` is measured in meters upward from a datum. Convert height to screen-space world y using:

```ts
terrainYpx(distanceM) = 520 - terrainHeightM(distanceM) * PX_PER_METER
terrainXpx(distanceM) = START_X_PX + distanceM * PX_PER_METER
```

The first 14 m MUST have height `0`. From 14 m to 26 m, the procedural profile MUST be blended in with `smoothstep`:

```ts
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
```

From 1,476 m to 1,500 m, terrain MUST blend back to a locally flat finish height. Terrain continues flat for 20 m after the finish so the bike cannot fall through immediately after completing the run.

### 8.2 Green Hills height function

For `x` in meters, calculate the unblended profile:

```ts
function greenRaw(x: number): number {
  const progression = 1 + 0.35 * clamp(x / 1500, 0, 1);
  return progression * (
    2.15 * Math.sin(x / 13.0) +
    1.05 * Math.sin(x / 5.30 + 0.70) +
    0.42 * Math.sin(x / 2.15 + 1.90)
  ) + 0.0015 * x;
}
```

The canonical height is:

```ts
greenHeight(x) = smoothstep(14, 26, x) * greenRaw(x)
```

At `x >= 1476`, apply this exact finish blend:

```ts
const profile = smoothstep(14, 26, x) * greenRaw(x);
const finishHeight = greenRaw(1476);
return lerp(profile, finishHeight, smoothstep(1476, 1500, x));
```

At and after 1,500 m, return `finishHeight` exactly.

### 8.3 Moon Run height function

Moon Run uses a rolling base plus deterministic craters.

```ts
function moonBase(x: number): number {
  return (
    2.80 * Math.sin(x / 19.0 + 0.35) +
    1.20 * Math.sin(x / 7.25 + 1.40) +
    0.35 * Math.sin(x / 2.80)
  );
}
```

Crater centers occur at:

```ts
center(k) = 42 + 58 * k, for integer k >= 0 while center(k) < 1460
radius(k) = 5.5 + 1.5 * ((k * 7) % 4)  // repeating values from 5.5 through 10.0
depth(k) = 1.4 + 0.35 * ((k * 3) % 5)  // repeating values from 1.4 through 2.8
```

For each crater whose center is within its radius of `x`, add this depression:

```ts
function craterContribution(x: number, c: number, r: number, d: number): number {
  const u = Math.abs(x - c) / r;
  if (u >= 1) return 0;
  // Zero value and zero first derivative at the rim.
  const bowl = (1 - u * u) ** 2;
  return -d * bowl;
}
```

The unblended profile is `moonBase(x) + sum(craterContribution(...))`. Apply the same 14–26 m starting blend and 1,476–1,500 m finish blend used by Green Hills, with the Moon unblended profile evaluated at 1,476 m as `finishHeight`.

### 8.4 Sampling and collision geometry

- Sample terrain every `0.5 m` from `0` through `1520 m`, inclusive.
- Round sampled meter heights to six decimal places before conversion to pixels.
- Each consecutive sample pair MUST create one static Matter rectangle.
- The rectangle's top long edge MUST coincide with the sample segment.
- Collision rectangles MUST be `2.25 m` thick and overlap adjacent segments by `2 px` along the tangent.
- Rectangle centers MUST be offset toward positive screen y by half the thickness along the segment's downward-facing normal.
- Terrain bodies MUST have collision label `terrain`.
- Internal terrain segment boundaries MUST NOT create collectible events or crash events.
- Terrain bodies SHOULD be chunked into Matter composites of at most 200 segments for manageable cleanup.

For segment endpoints `p0`, `p1` in pixels:

```ts
dx = p1.x - p0.x
dy = p1.y - p0.y
length = hypot(dx, dy)
angle = atan2(dy, dx)
normal = { x: -sin(angle), y: cos(angle) }
center = midpoint(p0, p1) + normal * (2.25 * PX_PER_METER / 2)
bodyWidth = length + 2
bodyHeight = 2.25 * PX_PER_METER
```

### 8.5 Terrain rendering

- The visible ground edge MUST use the exact sampled points used by collision geometry.
- Do not render a decorative curve that materially differs from the collision surface.
- Green Hills MUST show green turf over brown soil, blue sky, and at least two parallax hill layers.
- Moon Run MUST show gray terrain, a dark navy/black sky, stars, Earth in the far background, and crater markings.
- Backgrounds MUST be decorative and have no collision.
- Procedural Phaser Graphics are preferred so the project remains asset-independent.

---

## 9. Motorcycle rigid-body model

### 9.1 Required bodies

The motorcycle MUST be a Matter composite containing:

1. `bike-chassis` — dynamic chamfered rectangle/polygon.
2. `rear-wheel` — dynamic circle.
3. `front-wheel` — dynamic circle.
4. Two suspension constraints per wheel, for a total of four wheel-to-chassis constraints.
5. `rider-head` — circular sensor attached rigidly to the chassis transform.

The visual rider torso and limbs MAY be kinematic/procedural graphics. The head sensor position MUST track the chassis exactly before each physics step and MUST participate in terrain collision detection without applying physical collision response.

The head sensor MUST be synchronized from the chassis transform both before and after every Matter update. After the post-update synchronization, call Matter `Query.collides(headSensor, terrainBodies)` (or a behaviorally identical query). Either an engine collision event or this explicit post-update overlap query triggers the same idempotent crash handler. This avoids a one-tick lag or tunneling caused by treating the head as an independently integrated body.

### 9.2 Canonical geometry

All offsets are relative to the chassis center in its local coordinate space.

| Component | Value |
|---|---:|
| Chassis width | `1.70 m` (`108.8 px`) |
| Chassis height | `0.42 m` (`26.88 px`) |
| Chassis chamfer radius | `8 px` |
| Rear wheel radius | `0.36 m` (`23.04 px`) |
| Front wheel radius | `0.36 m` (`23.04 px`) |
| Rear wheel center | `(-0.62 m, +0.34 m)` |
| Front wheel center | `(+0.62 m, +0.34 m)` |
| Rider head center | `(-0.08 m, -0.72 m)` |
| Rider head radius | `0.19 m` (`12.16 px`) |

The bike spawns at distance `0 m`, with chassis center `1.35 m` above terrain and angle `0`.

### 9.3 Body properties

| Property | Chassis | Each wheel | Rider head sensor |
|---|---:|---:|---:|
| Density | `0.0022` | `0.0014` | `0.0001` |
| Friction | `0.65` | `0.95` | `0` |
| Static friction | `0.80` | `1.00` | `0` |
| Restitution | `0.02` | `0.06` | `0` |
| Slop | `0.03` | `0.02` | `0` |
| Sleep | disabled | disabled | disabled |
| Sensor | no | no | yes |

Air friction comes from the selected level table in Section 7.2.

### 9.4 Suspension constraints

Each wheel uses two constraints attached to the chassis at x offsets `wheelX - 0.16 m` and `wheelX + 0.16 m` and to the wheel center.

Canonical constraint values:

```ts
length = 0.34 * PX_PER_METER
stiffness = 0.62
damping = 0.16
angularStiffness = 0
```

The wheel and chassis MUST not collide with one another. Both wheels MUST collide with terrain. The rider head MUST detect terrain. Pickups MUST be sensors and MUST not alter motorcycle motion.

### 9.5 Collision categories

```ts
BIKE = 0x0001
TERRAIN = 0x0002
PICKUP = 0x0004
HEAD_SENSOR = 0x0008
FINISH = 0x0010
```

Required masks:

- Chassis and wheels collide with `TERRAIN` and `FINISH` only.
- Head sensor overlaps `TERRAIN` only.
- Pickups overlap `BIKE` only.
- Terrain collides with `BIKE` and `HEAD_SENSOR`.

### 9.6 Contact tracking

Ground contact MUST be derived from physics collision pairs, not from sprite positions or a simple y threshold.

Track active terrain contact IDs separately for each wheel. A wheel is grounded while its active-contact set is non-empty. To prevent one-frame terrain seams from creating false airtime:

- `rawGrounded = rearContacts > 0 || frontContacts > 0`.
- `groundGraceTicks = 5`.
- The bike is considered gameplay-grounded if raw-grounded now or raw-grounded occurred within the previous five ticks.
- Airborne state begins only after six consecutive ticks without raw wheel contact.
- Landing occurs on the first raw-grounded tick after airborne state began.

Chassis contact alone MUST NOT count as a grounded wheel and MUST NOT end airtime.

---

## 10. Controls and bike behavior

### 10.1 Logical inputs

Gameplay accepts two analog logical inputs in `[0, 1]`:

```ts
interface ControlState {
  throttle: number;
  brake: number;
}
```

Values MUST be clamped to `[0, 1]`. If both inputs are active, brake takes precedence for wheel drive; airborne pitch torques cancel proportionally.

### 10.2 Input mapping

| Action | Keyboard | Touch |
|---|---|---|
| Throttle / forward / nose-up | `ArrowRight`, `D`, or `W` | right pedal button |
| Brake / reverse / nose-down | `ArrowLeft`, `A`, or `S` | left pedal button |
| Pause/resume | `Escape` or `P` | pause icon |
| Restart after result | `Enter` or `R` | restart button |

Browser scrolling and zoom gestures MUST be prevented only while the player is interacting with the game canvas or touch controls.

### 10.3 Ground drive controller

The rear wheel is powered; the front wheel free-rolls.

Matter angular velocity is measured in radians per simulation tick. On each tick:

```ts
FORWARD_TARGET_OMEGA = 0.42
REVERSE_TARGET_OMEGA = -0.18
FORWARD_ACCEL_PER_TICK = 0.018
REVERSE_ACCEL_PER_TICK = 0.012
BRAKE_DECEL_PER_TICK = 0.030
REVERSE_ENTRY_SPEED_MPS = 1.20
```

Rules:

1. If `brake > 0` and absolute chassis horizontal speed is greater than `1.20 m/s`, move both wheel angular velocities toward zero by `BRAKE_DECEL_PER_TICK * brake`.
2. If `brake > 0` and absolute horizontal speed is at most `1.20 m/s`, move rear wheel angular velocity toward `REVERSE_TARGET_OMEGA` by `REVERSE_ACCEL_PER_TICK * brake`.
3. Otherwise, if `throttle > 0`, move rear wheel angular velocity toward `FORWARD_TARGET_OMEGA` by `FORWARD_ACCEL_PER_TICK * throttle`.
4. Otherwise, do not force a target; allow friction and air resistance to coast naturally.
5. Never directly set chassis linear velocity for ordinary driving.
6. The front wheel MUST never receive forward motor drive.

`moveToward(current, target, maxDelta)` MUST approach without overshooting.

### 10.4 Air control

While gameplay-airborne:

- Throttle applies negative chassis torque, raising the front wheel (**nose-up / back-flip direction**).
- Brake applies positive chassis torque, lowering the front wheel (**nose-down / front-flip direction**).

Canonical values:

```ts
AIR_CONTROL_TORQUE = 0.0030
MAX_CHASSIS_ANGULAR_VELOCITY = 0.135
```

Per tick:

```ts
chassis.torque += AIR_CONTROL_TORQUE * (brake - throttle);
```

After Matter resolves the tick, clamp chassis angular velocity to `[-0.135, +0.135]`. Air-control torque MUST NOT be multiplied by the Moon gravity ratio; low gravity naturally creates more time to rotate.

### 10.5 Speed safety cap

To avoid solver instability without making motion visibly artificial:

```ts
MAX_LINEAR_SPEED_MPS = 32
```

If a body exceeds this speed, normalize its velocity to the cap after the physics tick and emit `speed_clamped`. Ordinary terrain and controls SHOULD not reach the cap.

---

## 11. Fuel system

### 11.1 Fuel state

```ts
FUEL_CAPACITY = 100.0
STARTING_FUEL = 100.0
BASE_FUEL_BURN_PER_SECOND = 0.20
THROTTLE_BURN_PER_SECOND = 0.80
BRAKE_BURN_PER_SECOND = 0.35
FUEL_PICKUP_AMOUNT = 35.0
FUEL_PICKUP_SCORE = 200
```

Fuel burn on each playing tick is:

```ts
burnPerSecond = 0.20 + 0.80 * throttle + 0.35 * brake;
fuel = clamp(fuel - burnPerSecond / 60, 0, 100);
```

- Fuel MUST not burn in menu, paused, result, crashed, completed, or abandoned states.
- Fuel values MUST retain floating-point precision internally.
- HUD percentage MUST be `ceil(fuel)` so a small positive amount does not display as zero.
- At exactly zero fuel, all motor and airborne control inputs MUST stop affecting physics.
- Coasting and natural physics MUST continue after fuel reaches zero.

### 11.2 Fuel placement

Fuel can centers occur at these course distances:

```ts
fuelDistance(k) = 180 + 210 * k
```

for integer `k >= 0` while distance is `< 1470`. This produces cans at 180, 390, 600, 810, 1020, 1230, and 1440 m.

For each can:

- ID: `fuel-{levelId}-{distance}`.
- x: the exact course distance.
- y: `terrainHeight(distance) + 1.65 m` above the ground.
- Sensor radius: `0.60 m`.
- Visual: red can with a white fuel-drop symbol; Moon cans may have a cool-white glow.
- Animation: vertical bob of `±0.10 m` over 1.2 wall-clock seconds is visual only; the sensor MUST remain at its canonical position.

### 11.3 Fuel collection

When any chassis or wheel body overlaps an uncollected fuel sensor:

1. Mark its ID collected before doing any visual or audio work.
2. Set `fuel = min(100, fuel + 35)`.
3. Add exactly `200` points.
4. Remove/disable the sensor before the next physics tick.
5. Show `FUEL +35` and `+200` near the pickup.
6. Emit one `pickup_collected` event.
7. Play one procedural collection sound.

A fuel can MUST be collectible only once, even if several bike bodies overlap it in the same collision event.

### 11.4 Out-of-fuel ending

At the first tick where fuel reaches zero:

- enter substate `OUT_OF_FUEL_COASTING`;
- emit `fuel_empty` once;
- disable motor and air-control input;
- show `OUT OF FUEL` in the HUD.

The run ends with reason `out_of_fuel` when either:

- chassis speed remains below `0.50 m/s` for 120 consecutive ticks; or
- 480 ticks have elapsed since fuel first reached zero.

The low-speed counter resets whenever speed is at least `0.50 m/s`.

---

## 12. Coin pickups

### 12.1 Coin values

| Type | Color | Points |
|---|---|---:|
| Bronze | orange/bronze | `10` |
| Silver | light gray | `25` |
| Gold | yellow/gold | `100` |

Coins affect run score only. There is no shop or persistent currency economy.

### 12.2 Coin-group placement

Candidate group centers are:

```ts
groupCenter(k) = 55 + 45 * k
```

for integer `k >= 0` while center is `< 1470`.

Skip a candidate group if its center is within `12 m` inclusive of any fuel-can distance. Every non-skipped group contains nine coins indexed `j = 0..8`:

```ts
coinDistance = center + (j - 4) * 1.25
normalized = (j - 4) / 4
coinElevation = 1.40 + 3.20 * (1 - normalized * normalized)
coinHeight = terrainHeight(coinDistance) + coinElevation
```

Coin types:

- `j = 4`: Gold.
- `j = 2` or `j = 6`: Silver.
- All other indices: Bronze.

The total value of a complete group is exactly `210` points.

Coin ID format:

```text
coin-{levelId}-{groupCenter}-{j}
```

### 12.3 Coin collection

- Sensor radius: `0.32 m`.
- Any chassis or wheel overlap collects the coin.
- The rider-head sensor MUST NOT collect coins.
- A coin MUST be idempotent and collected at most once.
- Add its table value to score immediately.
- Emit `pickup_collected` with ID, type, value, tick, and bike position.
- Show a floating `+10`, `+25`, or `+100` label.
- Coins MAY spin or pulse visually, but sensor positions MUST remain canonical.

---

## 13. Score system

### 13.1 Score components

The integer run score is:

```ts
totalScore =
  distanceScore +
  coinScore +
  fuelPickupScore +
  airtimeScore +
  rotationScore;
```

Each component MUST be tracked separately and shown on the results screen.

### 13.2 Distance score

Distance score is exactly the furthest whole meter reached:

```ts
distanceScore = Math.floor(maxDistanceM);
```

Do not increment an independent distance counter. Recalculate the component from monotonic maximum distance to prevent double counting after reversing.

### 13.3 Airtime definition

An airtime sequence:

- begins after six consecutive ticks with neither wheel in raw terrain contact;
- uses that sixth no-contact tick as airtime tick 1;
- continues while gameplay-airborne;
- ends on the first raw wheel-contact tick;
- resets immediately on crash or run end.

Chassis-only ground contact does not end airtime. Paused ticks do not count.

### 13.4 Airtime awards

Green Hills base awards:

| Airtime tick | Duration label | Increment | Green cumulative |
|---:|---|---:|---:|
| `45` | AIR TIME | `25` | `25` |
| `90` | BIG AIR | `50` | `75` |
| `150` | HUGE AIR | `100` | `175` |
| `210` | INSANE AIR | `100` | `275` |
| each additional `60` ticks | INSANE AIR | `100` | `+100` each |

Moon Run applies its `1.5` multiplier to each increment and rounds half upward to an integer:

```ts
awarded = Math.floor(baseIncrement * level.airtimeMultiplier + 0.5)
```

Therefore Moon increments are `38`, `75`, `150`, `150`, then `150` per additional second. At every threshold:

- add the increment immediately;
- show the label and `+points`;
- emit `stunt_awarded` with `kind: "airtime"`;
- ensure the same threshold cannot award twice in one airtime sequence.

### 13.5 Rotation tracking

Rotation is measured only during an airtime sequence.

At airtime start:

```ts
previousAngle = chassis.angle
rotationAccumulator = 0
```

Each airborne tick:

```ts
delta = normalizeToMinusPiThroughPi(chassis.angle - previousAngle)
rotationAccumulator += delta
previousAngle = chassis.angle
```

The normalization result MUST be in `(-π, π]`. Direction reversal unwinds existing partial rotation; absolute movement MUST NOT be summed.

Award completed rotations with a loop:

```ts
while (rotationAccumulator >= 2 * Math.PI) {
  awardFrontFlip();
  rotationAccumulator -= 2 * Math.PI;
}

while (rotationAccumulator <= -2 * Math.PI) {
  awardBackFlip();
  rotationAccumulator += 2 * Math.PI;
}
```

### 13.6 Rotation awards

| Rotation | Direction in screen coordinates | Award per full 360° |
|---|---|---:|
| Front flip | positive / clockwise | `250` |
| Back flip | negative / counterclockwise | `300` |

Rotation scores do not receive the Moon airtime multiplier. Multiple rotations in one jump are each awarded. A `+4π` accumulated rotation yields two front flips and `500` points. A partial rotation never earns points.

Awards are immediate; crashing afterward does not revoke already-earned points.

### 13.7 No unspecified scoring

There MUST be no points for:

- wheelies;
- time survived;
- speed;
- hard landings;
- level completion beyond distance already earned;
- remaining fuel;
- restart streaks;
- UI actions.

This exclusion is important for deterministic grading.

---

## 14. Crash, landing, and completion rules

### 14.1 Head crash

Any `collisionStart` or `collisionActive` overlap between `rider-head` and a `terrain` body while state is `PLAYING` causes a crash.

- There is no minimum impulse threshold.
- The crash MUST be idempotent.
- Physics continues in slow motion for 45 ticks at `timeScale = 0.35` for visual feedback.
- Input, fuel burn, pickups, and scoring stop immediately at the crash tick.
- After 45 crash-animation ticks, transition to Results.
- Result reason: `head_crash`.

The head sensor MUST not crash while the bike is being created, reset, paused, already crashed, or completed.

### 14.2 Ordinary landing

There is no general hard-landing death rule. A landing is safe unless the rider head touches terrain. Chassis scraping is allowed. This keeps death detection unambiguous and prevents engine-specific contact-impulse differences from changing benchmark outcomes.

### 14.3 Finish

Place a static sensor at course distance `1500 m`, extending from `4 m` above to `4 m` below terrain.

The run completes when the chassis center crosses the finish x coordinate from left to right while state is `PLAYING` or `OUT_OF_FUEL_COASTING`.

- Transition immediately to `COMPLETED`.
- Stop fuel burn, controls, pickups, and scoring after the completion tick.
- Keep normal physics active for 60 celebratory ticks.
- Then show Results with reason `finish`.
- Finishing adds no separate points.

### 14.4 Left and fall protection

- Add an invisible static wall at course distance `-6 m` so the bike cannot leave through the left side.
- If the chassis center is more than `20 m` below the expected terrain y at its clamped x-position for 30 consecutive ticks, end with reason `out_of_bounds`.
- If any required bike body becomes non-finite (`NaN` or `Infinity`), emit `simulation_fault` and end with reason `simulation_fault`.

---

## 15. Run state machine

The state machine MUST use these states:

```text
BOOT
MENU
PLAYING
PAUSED
OUT_OF_FUEL_COASTING
CRASHED
COMPLETED
RESULTS
ABANDONED
```

Valid transitions:

```text
BOOT -> MENU
MENU -> PLAYING
PLAYING <-> PAUSED
PLAYING -> OUT_OF_FUEL_COASTING
PLAYING -> CRASHED
PLAYING -> COMPLETED
PLAYING -> ABANDONED
OUT_OF_FUEL_COASTING <-> PAUSED
OUT_OF_FUEL_COASTING -> CRASHED
OUT_OF_FUEL_COASTING -> COMPLETED
OUT_OF_FUEL_COASTING -> RESULTS
CRASHED -> RESULTS
COMPLETED -> RESULTS
ABANDONED -> MENU
RESULTS -> PLAYING
RESULTS -> MENU
```

Invalid transitions MUST throw in development/test mode and emit `invalid_state_transition` in production before being ignored.

Starting or restarting a run MUST reset:

- physics engine/world;
- simulation tick to zero;
- bike composite and contacts;
- fuel to 100;
- score components to zero;
- maximum distance to zero;
- all collected pickup IDs;
- stunt state;
- input state;
- telemetry run ID;
- replay tape;
- pause state and timers.

It MUST preserve only saved best results and user-level sound preference.

---

## 16. Camera and presentation

### 16.1 Camera

- Camera follows the chassis with interpolation, never the wheels.
- Horizontal target: keep chassis at 35% of viewport width.
- Vertical target: keep chassis at 55% of viewport height.
- Camera smoothing: `lerp = 0.10` per render frame, rendering only.
- Camera MUST NOT influence physics.
- Camera MUST not scroll left of course distance `-8 m`.
- Camera zoom at nominal viewport: `1.0`.
- For narrow portrait layouts, use a letterboxed landscape canvas; do not alter world scale or physics.

### 16.2 HUD

The gameplay HUD MUST display:

- level name;
- distance in whole meters;
- total score as an integer;
- fuel bar and whole percentage;
- pause button;
- temporary stunt/pickup notifications.

Fuel color:

- above 50: green;
- 21–50: amber;
- 1–20: red and pulsing;
- 0: empty red outline and `OUT OF FUEL`.

### 16.3 Touch controls

- Two large pedal buttons MUST sit at bottom-left and bottom-right within safe-area insets.
- Minimum interactive size: `88 × 88 CSS px` at nominal scale.
- Buttons MUST support simultaneous multi-touch.
- Pointer down sets input to 1; pointer up, cancel, out, blur, pause, or visibility change resets it to 0.
- Touch buttons MUST provide pressed visual state.
- Keyboard and touch inputs combine using `max()` per logical action.

### 16.4 Menus

Main menu:

- title `HILLBOUND BIKE`;
- two level cards only;
- each card shows name, theme art, gravity label, and saved best distance/score;
- `PLAY` starts the currently selected level.

Pause overlay:

- Resume;
- Restart;
- Return to Menu;
- show that simulation is paused.

Results screen:

- result reason;
- level;
- distance;
- coin points;
- fuel pickup points;
- airtime points;
- rotation points;
- total score;
- best distance and best score;
- Restart and Menu buttons.

### 16.5 Visual quality floor

The game MUST be recognizably complete rather than a physics debug view:

- motorcycle, rider, wheels, suspension, fuel cans, coins, terrain, finish, and backgrounds must be visually distinct;
- the bike visuals must follow physical bodies without obvious separation;
- text must be readable at 1280×720 and 390×844;
- no missing-texture boxes;
- no collision debug rendering in normal mode;
- transitions must not flash an unstyled white canvas;
- procedural art must use a consistent original palette.

---

## 17. Procedural audio

Audio is REQUIRED but MUST be generated using the Web Audio API from TypeScript; external audio files are not required.

Required cues:

- engine tone while throttle is active, pitch linked to rear-wheel angular speed;
- coin collection chirp;
- fuel collection two-tone cue;
- airtime/flip award cue;
- crash low burst;
- finish three-note cue.

Rules:

- AudioContext MUST start only after user interaction.
- A visible mute toggle MUST exist and persist in local storage.
- Muting MUST not change simulation or scoring.
- Audio failure or browser autoplay restrictions MUST never prevent gameplay.
- Test mode MUST disable audio.

---

## 18. Persistence

Use local storage key:

```text
hillbound-bike:v1
```

Schema:

```ts
interface SaveDataV1 {
  version: 1;
  muted: boolean;
  levels: Record<LevelId, {
    bestDistanceM: number;
    bestScore: number;
  }>;
}
```

- Save only on transition to Results or when mute changes.
- Best distance is the greater numeric value, retained to two decimals.
- Best score is the greater integer value.
- Corrupt or unknown-version data MUST be ignored safely and replaced with defaults.
- Local storage failure MUST not prevent play.
- There is no cloud save.

---

## 19. Replay system

### 19.1 Input tape

Every run MUST create an input tape:

```ts
interface InputChange {
  tick: number;
  throttle: number;
  brake: number;
}

interface ReplayTape {
  specVersion: "1.0.0";
  levelId: LevelId;
  seed: number;
  dependencyFingerprint: string;
  changes: InputChange[];
}
```

- Record only when the logical control state changes.
- The first entry MUST be tick 0 with both values 0.
- Entries MUST be ordered by tick.
- At most one final input state may exist per tick; later same-tick changes overwrite earlier ones.
- Playback MUST apply the entry before simulating its tick.

### 19.2 Replay accessibility

In test mode, the current tape MUST be exportable as JSON. A replay supplied through the test API MUST be able to start a new run. Replaying the same tape twice must produce identical 60-tick state hashes under the deterministic constraints of Section 6.2.

Replay UI for ordinary players is optional.

---

## 20. Telemetry and benchmark observability

Telemetry is local, in-memory, and exportable. It MUST never be transmitted.

Expose:

```ts
window.__HILLBOUND_TELEMETRY__: TelemetryEvent[]
```

Every event MUST contain:

```ts
interface TelemetryEvent {
  sequence: number;
  runId: string;
  tick: number;
  type: string;
  data: Record<string, unknown>;
}
```

`sequence` starts at zero and increments without gaps. Required event types:

```text
run_started
run_paused
run_resumed
input_changed
pickup_collected
airtime_started
stunt_awarded
landed
fuel_empty
speed_clamped
state_hash
simulation_time_dropped
simulation_fault
run_ended
```

`run_started` data MUST include spec version, level, seed, viewport, user agent, and dependency fingerprint. `run_ended` MUST include reason, ticks, simulated duration, every score component, total score, distance, fuel, pickup counts, and final state hash.

Telemetry event creation MUST not depend on rendered animations. The global array MAY be capped at 50,000 events, but if capped it MUST preserve `run_started`, every scoring/pickup event, every 60-tick hash, faults, and `run_ended`.

---

## 21. Test mode and evaluator API

### 21.1 Activation

Test mode activates with URL query `?testMode=1`. It MUST:

- disable audio;
- disable non-deterministic visual particles;
- expose the evaluator API;
- allow manual tick stepping;
- prevent automatic physics advancement when `manual=1` is also present;
- retain normal collision, fuel, pickups, scoring, and state-machine logic.

### 21.2 Required API

Expose:

```ts
window.__HILLBOUND_TEST_API__ = {
  getSpecVersion(): string;
  getConfig(): Readonly<GameConfig>;
  startRun(levelId: LevelId): void;
  restartRun(): void;
  setInput(input: Partial<ControlState>): void;
  stepTicks(count: number): void;
  getSnapshot(): CanonicalState & RunSummary;
  getStateHash(): Promise<string>;
  getTerrainHeight(levelId: LevelId, distanceM: number): number;
  getPickupManifest(levelId: LevelId): PickupManifestEntry[];
  setBikePose(pose: TestBikePose): void;
  setFuel(value: number): void;
  triggerPickup(pickupId: string): void;
  beginSyntheticAirborneSequence(): void;
  setSyntheticChassisAngle(angleRadians: number): void;
  endSyntheticAirborneSequence(): void;
  exportReplay(): ReplayTape;
  playReplay(tape: ReplayTape): void;
  getTelemetry(): TelemetryEvent[];
};
```

Test-only mutation methods MUST be unavailable unless `testMode=1`. Synthetic stunt helpers MUST call the production `StuntSystem`; they MUST NOT implement separate scoring logic.

### 21.3 Snapshot requirements

`getSnapshot()` MUST return plain cloned data, not mutable references to game objects. It MUST include:

- state, tick, level, seed;
- bike body snapshots;
- raw and gameplay grounded flags;
- fuel;
- each score component and total;
- max/display distance;
- airborne ticks and rotation accumulator;
- collected pickup IDs;
- result reason if present.

---

## 22. Architecture requirements

### 22.1 Separation of concerns

At minimum:

- Terrain formulas MUST be pure and independent of Phaser.
- Pickup manifests MUST be generated independently of rendering.
- Fuel and score arithmetic MUST be independently unit-testable.
- Stunt angle accumulation MUST be independently unit-testable.
- Phaser scene code MUST orchestrate systems rather than contain all rules in one update method.
- Canonical constants MUST have one source of truth.
- UI MUST read game state and must not own authoritative values.
- Telemetry MUST observe state changes without changing results.

### 22.2 Error handling

- Invalid level IDs fall back to the menu and show a non-blocking message.
- Duplicate pickup collection is ignored and logged only in development mode.
- Non-finite physics state terminates safely as `simulation_fault`.
- Missing local storage, audio, or vibration capability degrades gracefully.
- Unhandled promise rejections and uncaught errors MUST be surfaced in tests.

### 22.3 Performance

On a typical modern laptop at 1280×720:

- target 60 rendered FPS;
- p95 simulation-tick CPU time under 4 ms during a normal run;
- no unbounded creation of terrain, text, particles, or listeners;
- remove all scene event listeners during shutdown;
- no more than 3,100 active terrain segment bodies;
- no more than 400 active pickup sensors;
- production bundle SHOULD be under 5 MB compressed, excluding source maps.

Object pooling SHOULD be used for floating labels and simple particles.

---

## 23. Accessibility and responsive behavior

- Canvas must have an accessible name: `Hillbound Bike game`.
- Menus and overlays MUST be operable by keyboard.
- Focus indication MUST be visible on DOM-based controls.
- UI text contrast SHOULD meet WCAG AA.
- Important state must not be communicated by color alone; fuel includes a number and label.
- A reduced-motion media query MUST disable camera shake, pulsing, and decorative particles without changing gameplay.
- At 390×844 CSS pixels, all required HUD information and both touch controls MUST remain visible without page scrolling.
- At 1280×720, UI elements MUST not overlap the bike at the starting position.
- Resizing MUST not reset or advance the simulation.

---

## 24. Golden acceptance scenarios

These scenarios are normative. Tests may use the public test API to isolate systems, but at least the marked end-to-end cases must also exercise the rendered game.

### G01 — Build and offline runtime [gate]

Given dependencies are already cached/installed:

1. `npm run lint` exits 0.
2. `npm run test` exits 0.
3. `npm run build` exits 0.
4. Built game loads with browser network blocked.
5. No runtime request leaves the local origin.

### G02 — Exactly two levels [gate, E2E]

The menu shows `Green Hills` and `Moon Run`, both playable, and no third level. Starting each sets the matching level ID and constants.

### G03 — Bike composition [gate]

A new run contains one chassis, two wheel bodies of equal canonical radius, four suspension constraints, and one head sensor. The rear wheel is powered and the front wheel is not.

### G04 — Fixed timestep [gate]

In manual test mode, `stepTicks(60)` advances tick from 0 to 60 and simulated time by exactly 1 second regardless of wall-clock delay. Fuel and stunt timers use these ticks.

### G05 — Idle fuel burn

Starting from fuel 100 with zero input, 60 playing ticks produce fuel `99.80 ± 0.0001`.

### G06 — Throttle fuel burn

Starting from fuel 100 with throttle 1 and brake 0, 60 playing ticks produce fuel `99.00 ± 0.0001`.

### G07 — Brake fuel burn

Starting from fuel 100 with throttle 0 and brake 1, 60 playing ticks produce fuel `99.45 ± 0.0001`.

### G08 — Fuel collection and cap [gate]

Set fuel to 80, trigger the first fuel pickup, and assert:

- fuel equals 100;
- fuel pickup score equals 200;
- total score rises by exactly 200 except for unchanged distance recomputation;
- one pickup event exists;
- triggering the same ID again changes nothing.

Set fuel to 10 in a fresh run and trigger a fuel pickup; fuel must equal 45.

### G09 — Fuel manifest

Each level contains fuel at exactly `[180, 390, 600, 810, 1020, 1230, 1440]` m with unique canonical IDs.

### G10 — Coin-group value

For any complete non-skipped group, collecting all nine coins adds exactly 210 coin points: six bronze, two silver, and one gold.

### G11 — Coin idempotency

Trigger one gold coin through overlapping chassis and wheel contacts in the same tick. Score rises by exactly 100 and only one collection event is emitted.

### G12 — Distance monotonicity

Set bike positions corresponding to 10.9 m, 14.2 m, and then 12.0 m. Display distance and distance score must be 10, then 14, then remain 14.

### G13 — Green airtime milestones [gate]

In a synthetic Green Hills airtime sequence with no rotation:

- tick 44: airtime score 0;
- tick 45: 25;
- tick 89: 25;
- tick 90: 75;
- tick 149: 75;
- tick 150: 175;
- tick 210: 275;
- tick 270: 375.

Exactly one award event must exist for each crossed threshold.

### G14 — Moon airtime milestones [gate]

In a synthetic Moon Run airtime sequence:

- tick 45: airtime score 38;
- tick 90: 113;
- tick 150: 263;
- tick 210: 413;
- tick 270: 563.

### G15 — Front flips [gate]

During one airtime sequence, feed smooth positive angle deltas totaling `4π + 0.01`. Assert two front-flip events and rotation score 500.

### G16 — Back flip

Feed smooth negative deltas totaling `-2π - 0.01`. Assert one back-flip event and rotation score 300.

### G17 — Reversal does not double count

Accumulate `+1.5π`, then `-1.5π`, then end airtime. Rotation score must be zero.

### G18 — Angle wrapping

Feed angles that cross Matter's visual `π/-π` boundary in small positive increments totaling one full rotation. Assert one front flip, not zero and not two.

### G19 — Ground grace

Starting grounded, remove raw wheel contacts for five ticks and restore contact on tick six. No airtime sequence starts. Remove contacts for six complete ticks; one airtime sequence starts with airtime tick 1 on the sixth no-contact tick.

### G20 — Chassis contact is not a landing

During airborne state, report chassis-terrain contact without wheel contact. Airtime continues. Report wheel-terrain contact; one landed event occurs and airtime resets.

### G21 — Gravity ratio [gate]

Create the same isolated non-rotating test body at rest in each level, set its air friction to zero, disable collisions, and step 120 ticks. Let downward displacement from the initial position be `dGreen` and `dMoon`. Assert:

```text
dMoon / dGreen = 0.165 ± 0.005
```

Also assert configured scales are exactly `0.001` and `0.000165`.

### G22 — Terrain determinism [gate]

For each level, generate the terrain twice and compare all rounded sampled heights byte-for-byte. Heights from 0–14 m must be zero. Samples must be finite through 1,520 m.

### G23 — Pickup determinism

For each level, generate the pickup manifest twice and compare canonical JSON byte-for-byte. All IDs are unique and every pickup lies above its corresponding terrain height.

### G24 — Head crash [gate, E2E]

Start Green Hills, place the bike inverted immediately above the first hill, step until head-terrain contact, and assert:

- state becomes `CRASHED` once;
- result reason becomes `head_crash`;
- fuel and score stop changing after the crash tick;
- Results appears after the 45-tick crash presentation.

### G25 — Chassis scrape does not crash

Cause chassis-terrain contact with no head contact. The state remains playable.

### G26 — Out-of-fuel coast [gate]

Set fuel to a tiny positive value and consume it. Assert motor input stops on the zero-fuel tick. With chassis speed held below 0.50 m/s, Results appears after 120 consecutive ticks with reason `out_of_fuel`.

### G27 — Finish [E2E]

Place the chassis just before 1,500 m, give it rightward velocity, and cross the finish. Assert state `COMPLETED`, no extra completion points, 60 presentation ticks, then Results with reason `finish`.

### G28 — Pause invariance [gate, E2E]

Pause a run for at least one wall-clock second. Tick, physics body poses, fuel, score, and airtime counters must not change. Resume and confirm advancement continues from the prior tick.

### G29 — Input release safety [E2E]

Press a touch pedal, then dispatch pointer cancel, window blur, and page visibility change in separate cases. The corresponding logical input must return to zero every time.

### G30 — Replay determinism [gate]

Record a scripted 600-tick run. Replay it twice from clean worlds. The state hashes at ticks 60, 120, ..., 600 must match between replays.

### G31 — Restart cleanliness [gate]

Collect a coin, earn airtime, consume fuel, and restart. Assert tick 0, fuel 100, zero score, zero distance, empty collected IDs, no active contacts, and one fresh telemetry run ID.

### G32 — Responsive UI [E2E]

At both 1280×720 and 390×844:

- menu buttons are visible;
- fuel, distance, score, pause, and touch pedals are visible during play;
- no page-level horizontal scroll exists;
- controls do not overlap each other.

### G33 — No unauthorized networking [gate]

During menu load and a 300-tick run, Playwright records no requests except same-origin document, JS, CSS, favicon, and source maps served by the local test server.

### G34 — Telemetry completeness

A run that collects a coin, starts airtime, earns one award, lands, pauses, resumes, and ends must include all corresponding ordered event types, monotonic sequence numbers, and a complete `run_ended` summary.

### G35 — Persistence

Finish a run with a nonzero result, reload, and confirm best distance and score on the correct level card. Corrupt the storage value, reload, and confirm the game starts with defaults instead of crashing.

---

## 25. Benchmark grading rubric

Score only after all tests have run. The authoritative evaluator SHOULD write `benchmark-report.json`.

### 25.1 Hard gates

A submission receives at most **49/100** if any of these is true:

- project does not install or build;
- either required level is not playable;
- vehicle is not a motorcycle with two physical wheels;
- no rigid-body terrain collision exists;
- normal and Moon gravity are effectively the same;
- fuel cannot run out or be replenished;
- coin scoring is absent;
- airtime or full-rotation scoring is absent;
- game cannot be controlled;
- runtime requires a backend or external network;
- required test API is absent;
- more than 25% of normative acceptance scenarios cannot be executed because of crashes or missing hooks.

### 25.2 Point allocation

| Category | Points | What is measured |
|---|---:|---|
| Build and packaging | 8 | clean install, typecheck, build, offline load |
| Core game flow | 8 | menu, both levels, pause, restart, results |
| Motorcycle physics | 18 | body model, suspension, traction, control, contacts, stability |
| Level and gravity fidelity | 12 | canonical terrain, Earth/Moon distinction, determinism |
| Fuel system | 10 | burn formula, placements, collection, empty-state ending |
| Coins and score ledger | 10 | manifest, values, idempotency, component totals |
| Airtime and rotations | 14 | timing, milestones, wrapping, directions, Moon multiplier |
| UI, responsive behavior, audio | 8 | readability, touch, visual completeness, procedural cues |
| Testing and evaluator API | 7 | unit/simulation/E2E depth, deterministic hooks |
| Observability and replay | 5 | event completeness, state hashes, replay repeatability |
| **Total** | **100** | |

### 25.3 Objective scoring guidance

- Award full category points when all mapped golden scenarios pass.
- Award proportional points for independent passing scenarios.
- Do not award visual polish points for missing canonical mechanics.
- Do not infer success from source-code presence; execute the behavior.
- A self-authored test suite passing does not override evaluator failures.
- The post-run clean-sandbox acceptance suite is authoritative.

### 25.4 Harness metrics kept outside game-quality score

The benchmark runner SHOULD record these separately so model/harness comparisons do not distort product correctness:

- wall-clock duration;
- model tokens and cost;
- tool calls by type;
- shell commands;
- files read and written;
- test runs and failing-to-passing transitions;
- number of human interventions;
- retries or context compactions;
- sandbox failures;
- final git diff size;
- whether a clean verifier sandbox was used;
- repeat score across at least three fresh runs.

These are process/economics metrics, not excuses to change the 100-point product score.

---

## 26. Required test-suite coverage

The submission MUST include its own tests, not only rely on an external evaluator.

Minimum required coverage areas:

### 26.1 Unit tests

- `smoothstep` bounds and endpoints;
- both terrain height functions at start, middle, finish, and post-finish;
- all terrain values finite across every sample;
- fuel burn at idle, throttle, brake, and mixed input;
- fuel pickup cap and idempotency;
- coin values and group total;
- distance monotonicity;
- airtime thresholds for both levels;
- positive and negative rotations;
- angle wrap normalization;
- rotation reversal;
- state-machine valid and invalid transitions;
- save-data recovery;
- canonical state serialization.

### 26.2 Simulation tests

- bike composite body/constraint counts;
- gravity displacement ratio;
- rear-wheel drive versus unpowered front wheel;
- ground-contact grace;
- head collision versus chassis scrape;
- pickup sensor overlaps;
- zero-fuel motor disable;
- finish crossing;
- replay hashes.

### 26.3 Browser tests

- both levels launch from visible UI;
- keyboard control changes bike behavior;
- touch controls and cancellation;
- pause invariance;
- results/restart/menu flow;
- 1280×720 and 390×844 layouts;
- local-storage persistence;
- zero unauthorized requests;
- no console errors in a standard 300-tick smoke run.

Tests MUST avoid arbitrary sleep when deterministic tick stepping is available.

---

## 27. Evaluator report format

The external benchmark evaluator SHOULD produce:

```json
{
  "specVersion": "1.0.0",
  "submission": {
    "commit": "<sha>",
    "dependencyFingerprint": "<sha256>",
    "evaluatedAt": "<ISO-8601>"
  },
  "gates": {
    "passed": true,
    "failedIds": []
  },
  "score": {
    "total": 0,
    "maximum": 100,
    "categories": {}
  },
  "scenarios": [
    {
      "id": "G01",
      "status": "pass",
      "durationMs": 0,
      "evidence": [],
      "message": ""
    }
  ],
  "harnessMetrics": {
    "wallClockSeconds": null,
    "toolCalls": null,
    "humanInterventions": null,
    "estimatedCostUsd": null
  }
}
```

Allowed scenario statuses are `pass`, `fail`, and `not_run`. A gate marked `not_run` counts as failed unless the evaluator itself is demonstrably broken.

---

## 28. Implementation sequence

This order is recommended because every checkpoint remains runnable and testable:

1. Scaffold TypeScript, Phaser, Vite, Vitest, and Playwright.
2. Implement canonical configuration and pure terrain functions.
3. Render Green Hills collision terrain and test the surface.
4. Create motorcycle composite, suspension, and contact tracking.
5. Add fixed-step control loop and keyboard input.
6. Add Moon Run configuration and verify gravity ratio.
7. Add fuel burn, fuel pickups, and out-of-fuel behavior.
8. Add coin manifest and idempotent collection.
9. Add score ledger, airtime state, angle unwrapping, and flips.
10. Add crash and finish rules.
11. Add menus, HUD, pause, results, and persistence.
12. Add touch controls and responsive layout.
13. Add procedural visuals and audio.
14. Add replay, telemetry, state hashes, and test API.
15. Complete unit, simulation, and browser acceptance tests.
16. Run the full suite in a clean environment with network disabled after install.

Each step SHOULD end with passing tests and a coherent commit.

---

## 29. Explicit non-goals

Do not implement these as part of benchmark conformance:

- cars or additional bikes;
- vehicle upgrades;
- character customization;
- more than two levels;
- multiplayer;
- leaderboards or accounts;
- achievements;
- a shop or persistent coins;
- ads or monetization;
- enemies, traffic, or destructible terrain;
- online services;
- weather;
- level editor;
- exact imitation of commercial game art, audio, characters, or UI;
- a custom physics engine replacing Matter;
- server-side authoritative simulation.

Extra features MUST NOT interfere with evaluator hooks, required UI, deterministic behavior, or the two-level/one-vehicle premise. In general, implementers SHOULD spend remaining time on correctness and polish rather than scope expansion.

---

## 30. Definition of done

The implementation is done only when all of the following are true:

- A fresh clone installs, typechecks, tests, and builds using documented commands.
- Green Hills and Moon Run are both selectable and visibly distinct.
- The same motorcycle is physically simulated in both.
- Gravity, wheels, suspension, traction, coasting, braking/reversing, and airborne rotation work.
- Fuel decreases by the exact formula, cans restore exactly 35, and empty fuel ends the run correctly.
- Coin layouts and values follow the manifest formula.
- Airtime and flips produce the exact specified point increments.
- Head collision, pause, restart, finish, and results follow the state machine.
- Keyboard and touch controls work and release safely.
- The game is readable and playable at desktop and narrow mobile sizes.
- No runtime network is required or attempted.
- State hashes and replay are repeatable.
- Required telemetry and evaluator API are present.
- The submission's own tests cover the mandated areas.
- The clean-sandbox acceptance suite passes all hard gates.
- The project uses original procedural presentation and contains no copied commercial assets.

---

## 31. Reference notes

- Fingersoft describes the original title as a physics-based driving game involving coins, stunts, fuel, varied vehicles, and hill environments: <https://fingersoft.com/games/hill-climb-racing/>.
- Phaser's Matter integration supports rigid bodies, constraints, joints, gravity, collision events, sensors, friction, restitution, forces, and angular velocity: <https://docs.phaser.io/phaser/concepts/physics/matter>.
- Matter Engine exposes explicit fixed-delta updates, gravity scale, solver iteration settings, timestamps, and collision lifecycle events: <https://brm.io/matter-js/docs/classes/Engine.html>.
- Phaser 3.90 release: <https://github.com/phaserjs/phaser/releases/tag/v3.90.0>.

These references justify the chosen implementation stack and broad gameplay loop. All benchmark-specific constants and behaviors are defined normatively in this document.
