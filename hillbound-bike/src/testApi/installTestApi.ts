import { SPEC_VERSION } from "../config/gameConfig";
import { generatePickupManifest } from "../systems/PickupSystem";
import { terrainHeightM } from "../terrain/terrainHeight";
import type { ControlState, LevelId, ReplayTape, TestBikePose } from "../types/game";
import type { Runtime } from "../runtime";
import { GAME_CONFIG } from "../config/gameConfig";

export interface HillboundTestApi {
  getSpecVersion(): string;
  getConfig(): typeof GAME_CONFIG;
  startRun(levelId: LevelId): void;
  restartRun(): void;
  setInput(input: Partial<ControlState>): void;
  stepTicks(count: number): void;
  getSnapshot(): ReturnType<Runtime["world"]["getSnapshot"]>;
  getStateHash(): Promise<string>;
  getTerrainHeight(levelId: LevelId, distanceM: number): number;
  getPickupManifest(levelId: LevelId): ReturnType<typeof generatePickupManifest>;
  setBikePose(pose: TestBikePose): void;
  setFuel(value: number): void;
  triggerPickup(pickupId: string): void;
  beginSyntheticAirborneSequence(): void;
  setSyntheticChassisAngle(angleRadians: number): void;
  endSyntheticAirborneSequence(): void;
  exportReplay(): ReplayTape;
  playReplay(tape: ReplayTape): void;
  getTelemetry(): ReturnType<Runtime["world"]["telemetry"]["clone"]>;
}

export function installTestApi(runtime: Runtime): HillboundTestApi {
  const api: HillboundTestApi = {
    getSpecVersion: () => SPEC_VERSION,
    getConfig: () => GAME_CONFIG,
    startRun: (levelId) => {
      runtime.selected = levelId;
      runtime.playSelected();
    },
    restartRun: () => runtime.restart(),
    setInput: (input) => runtime.world.setInput(input),
    stepTicks: (count) => {
      runtime.world.stepTicks(count);
      runtime.refreshUi();
      if (runtime.world.state === "RESULTS") runtime.persistResults();
    },
    getSnapshot: () => structuredClone(runtime.world.getSnapshot()),
    getStateHash: () => runtime.world.getStateHash(),
    getTerrainHeight: (levelId, distanceM) => terrainHeightM(levelId, distanceM),
    getPickupManifest: (levelId) => generatePickupManifest(levelId),
    setBikePose: (pose) => runtime.world.setBikePose(pose),
    setFuel: (value) => runtime.world.setFuel(value),
    triggerPickup: (pickupId) => runtime.world.triggerPickup(pickupId),
    beginSyntheticAirborneSequence: () => runtime.world.beginSyntheticAirborneSequence(),
    setSyntheticChassisAngle: (angle) => runtime.world.setSyntheticChassisAngle(angle),
    endSyntheticAirborneSequence: () => runtime.world.endSyntheticAirborneSequence(),
    exportReplay: () => runtime.world.replay.exportTape(),
    playReplay: (tape) => {
      runtime.world.playReplay(tape);
      runtime.refreshUi();
    },
    getTelemetry: () => runtime.world.telemetry.clone(),
  };

  window.__HILLBOUND_TEST_API__ = api;
  Object.defineProperty(window, "__HILLBOUND_TELEMETRY__", {
    configurable: true,
    get: () => runtime.world.telemetry.events,
  });
  return api;
}
