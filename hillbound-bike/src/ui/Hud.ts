import type { OverlayController } from "./overlays";
import type { LevelId, ResultReason, RunState, SaveDataV1, ScoreComponents } from "../types/game";

export class Hud {
  constructor(private readonly overlays: OverlayController) {}

  update(state: {
    runState: RunState;
    selected: LevelId;
    save: SaveDataV1;
    levelName: string;
    distance: number;
    score: number;
    fuel: number;
    paused: boolean;
    resultReason: ResultReason | null;
    components: ScoreComponents;
    notifications: string[];
    outOfFuel: boolean;
  }): void {
    this.overlays.render({
      state: state.runState,
      selected: state.selected,
      save: state.save,
      levelName: state.levelName,
      distance: state.distance,
      score: state.score,
      fuel: state.fuel,
      paused: state.paused,
      resultReason: state.resultReason,
      components: state.components,
      notifications: state.notifications,
      outOfFuel: state.outOfFuel,
    });
  }
}
