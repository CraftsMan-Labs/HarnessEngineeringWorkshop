import { SPEC_VERSION } from "../config/gameConfig";
import type { ControlState, InputChange, LevelId, ReplayTape } from "../types/game";

export class ReplaySystem {
  levelId: LevelId = "green-hills";
  seed = 0;
  dependencyFingerprint = "";
  changes: InputChange[] = [];
  private last: ControlState = { throttle: 0, brake: 0 };

  start(levelId: LevelId, seed: number, dependencyFingerprint: string): void {
    this.levelId = levelId;
    this.seed = seed;
    this.dependencyFingerprint = dependencyFingerprint;
    this.changes = [{ tick: 0, throttle: 0, brake: 0 }];
    this.last = { throttle: 0, brake: 0 };
  }

  record(tick: number, input: ControlState): void {
    if (input.throttle === this.last.throttle && input.brake === this.last.brake) return;
    this.last = { ...input };
    const existing = this.changes.findIndex((change) => change.tick === tick);
    const entry = { tick, throttle: input.throttle, brake: input.brake };
    if (existing >= 0) this.changes[existing] = entry;
    else this.changes.push(entry);
    this.changes.sort((a, b) => a.tick - b.tick);
  }

  inputAt(tick: number): ControlState {
    let current: ControlState = { throttle: 0, brake: 0 };
    for (const change of this.changes) {
      if (change.tick > tick) break;
      current = { throttle: change.throttle, brake: change.brake };
    }
    return current;
  }

  exportTape(): ReplayTape {
    return {
      specVersion: SPEC_VERSION,
      levelId: this.levelId,
      seed: this.seed,
      dependencyFingerprint: this.dependencyFingerprint,
      changes: this.changes.map((change) => ({ ...change })),
    };
  }
}
