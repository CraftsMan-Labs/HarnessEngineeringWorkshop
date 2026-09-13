import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#111827");
    this.time.delayedCall(200, () => {
      this.scene.start("MenuScene");
    });
  }
}
