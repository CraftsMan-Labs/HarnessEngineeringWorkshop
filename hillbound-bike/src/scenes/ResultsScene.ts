import Phaser from "phaser";
import { drawBackground } from "../terrain/terrainRenderer";
import { getRuntime } from "../gameContext";

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super("ResultsScene");
  }

  create(): void {
    const runtime = getRuntime();
    const graphics = this.add.graphics();
    drawBackground(graphics, runtime.world.levelId, runtime.world.bike?.chassis.position.x ?? 0);
  }
}
