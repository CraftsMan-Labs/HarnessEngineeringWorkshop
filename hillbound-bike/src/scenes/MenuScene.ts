import Phaser from "phaser";
import { drawBackground } from "../terrain/terrainRenderer";

export class MenuScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Graphics;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.background = this.add.graphics();
    drawBackground(this.background, "green-hills", 0);
    this.cameras.main.setBackgroundColor("#9ad4ff");
  }
}
