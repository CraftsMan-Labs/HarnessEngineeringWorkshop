import type Phaser from "phaser";
import type { LevelId } from "../types/game";
import type { TerrainSample } from "./terrainGeometry";

const GREEN = {
  skyTop: 0x9ad4ff,
  skyBottom: 0xe7f6ff,
  hillFar: 0x6aa36a,
  hillNear: 0x4f8a55,
  turf: 0x3f7d3a,
  soil: 0x6b4423,
};

const MOON = {
  skyTop: 0x050714,
  skyBottom: 0x141a33,
  surface: 0x8b8f99,
  dust: 0x5c616c,
  crater: 0x3c4048,
};

export function drawBackground(graphics: Phaser.GameObjects.Graphics, levelId: LevelId, cameraX: number): void {
  graphics.clear();
  if (levelId === "green-hills") {
    graphics.fillGradientStyle(GREEN.skyTop, GREEN.skyTop, GREEN.skyBottom, GREEN.skyBottom, 1);
    graphics.fillRect(cameraX - 400, -800, 4000, 2200);
    graphics.fillStyle(GREEN.hillFar, 1);
    drawParallaxHills(graphics, cameraX, 0.15, 420, 90);
    graphics.fillStyle(GREEN.hillNear, 1);
    drawParallaxHills(graphics, cameraX, 0.35, 460, 70);
    return;
  }
  graphics.fillGradientStyle(MOON.skyTop, MOON.skyTop, MOON.skyBottom, MOON.skyBottom, 1);
  graphics.fillRect(cameraX - 400, -800, 4000, 2200);
  graphics.fillStyle(0xffffff, 0.85);
  for (let i = 0; i < 40; i += 1) {
    const x = cameraX - 200 + ((i * 137) % 1800);
    const y = 40 + ((i * 97) % 280);
    graphics.fillCircle(x, y, 1 + (i % 2));
  }
  graphics.fillStyle(0x8ec8ff, 1);
  graphics.fillCircle(cameraX + 820, 90, 28);
  graphics.fillStyle(0x0b1020, 1);
  graphics.fillCircle(cameraX + 832, 86, 22);
}

function drawParallaxHills(
  graphics: Phaser.GameObjects.Graphics,
  cameraX: number,
  factor: number,
  baseY: number,
  amplitude: number,
): void {
  const offset = cameraX * factor;
  graphics.beginPath();
  graphics.moveTo(cameraX - 500, 1400);
  for (let x = -500; x <= 2200; x += 24) {
    const worldX = cameraX + x;
    const y = baseY + Math.sin((worldX + offset) / 180) * amplitude + Math.sin((worldX + offset) / 70) * amplitude * 0.35;
    graphics.lineTo(worldX, y);
  }
  graphics.lineTo(cameraX + 2200, 1400);
  graphics.closePath();
  graphics.fillPath();
}

export function drawTerrain(graphics: Phaser.GameObjects.Graphics, samples: TerrainSample[], levelId: LevelId): void {
  if (samples.length === 0) return;
  const soil = levelId === "moon-run" ? MOON.dust : GREEN.soil;
  const top = levelId === "moon-run" ? MOON.surface : GREEN.turf;
  graphics.fillStyle(soil, 1);
  graphics.beginPath();
  graphics.moveTo(samples[0].x, samples[0].y);
  for (const sample of samples) graphics.lineTo(sample.x, sample.y);
  const last = samples[samples.length - 1];
  graphics.lineTo(last.x, last.y + 900);
  graphics.lineTo(samples[0].x, samples[0].y + 900);
  graphics.closePath();
  graphics.fillPath();

  graphics.lineStyle(8, top, 1);
  graphics.beginPath();
  graphics.moveTo(samples[0].x, samples[0].y);
  for (const sample of samples) graphics.lineTo(sample.x, sample.y);
  graphics.strokePath();

  if (levelId === "moon-run") {
    graphics.fillStyle(MOON.crater, 0.35);
    for (let k = 0; k < 24; k += 1) {
      const sample = samples[40 + k * 80];
      if (!sample) continue;
      graphics.fillEllipse(sample.x, sample.y + 18, 48, 16);
    }
  }
}

export function drawFinish(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
  graphics.lineStyle(8, 0xf4d35e, 1);
  graphics.strokeRect(x - 16, y - 140, 32, 160);
  graphics.fillStyle(0xf4d35e, 1);
  graphics.fillRect(x - 70, y - 150, 140, 18);
  graphics.fillStyle(0x111111, 1);
  graphics.fillRect(x - 52, y - 146, 20, 10);
  graphics.fillRect(x - 12, y - 146, 20, 10);
  graphics.fillRect(x + 28, y - 146, 20, 10);
}
