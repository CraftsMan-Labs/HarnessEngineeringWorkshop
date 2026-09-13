import Phaser from "phaser";
import "./style.css";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./config/gameConfig";
import { setRuntime } from "./gameContext";
import { Runtime, readFlags } from "./runtime";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { MenuScene } from "./scenes/MenuScene";
import { ResultsScene } from "./scenes/ResultsScene";
import { installTestApi } from "./testApi/installTestApi";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui-root") as HTMLElement;
const flags = readFlags();
const runtime = new Runtime(uiRoot, flags);
setRuntime(runtime);

if (flags.testMode) {
  installTestApi(runtime);
}

const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "letterbox",
  canvas,
  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,
  backgroundColor: "#9ad4ff",
  banner: false,
  audio: { noAudio: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  },
  scene: [BootScene, MenuScene, GameScene, ResultsScene],
  input: {
    keyboard: true,
    activePointers: 3,
  },
});

runtime.onSceneChange = (scene) => {
  if (scene === "game") {
    game.scene.stop("MenuScene");
    game.scene.stop("ResultsScene");
    game.scene.start("GameScene");
  } else if (scene === "menu") {
    game.scene.stop("GameScene");
    game.scene.stop("ResultsScene");
    game.scene.start("MenuScene");
  } else if (scene === "results") {
    game.scene.stop("GameScene");
    game.scene.start("ResultsScene");
  }
};

function bindKeyboard(): void {
  const down = new Set<string>();
  const apply = () => {
    runtime.world.keyboard = {
      throttle: down.has("throttle") ? 1 : 0,
      brake: down.has("brake") ? 1 : 0,
    };
    runtime.world.setCombinedInput();
    runtime.world.telemetry.emit(runtime.world.tick, "input_changed", { ...runtime.world.input });
  };

  window.addEventListener("keydown", (event) => {
    const interacting = event.target === canvas || uiRoot.contains(event.target as Node);
    if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", " "].includes(event.key) && interacting) {
      event.preventDefault();
    }
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D" || event.key === "w" || event.key === "W") {
      down.add("throttle");
      apply();
    }
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A" || event.key === "s" || event.key === "S") {
      down.add("brake");
      apply();
    }
    if (event.key === "Escape" || event.key === "p" || event.key === "P") {
      if (runtime.world.state === "PAUSED") runtime.resume();
      else runtime.pause();
    }
    if ((event.key === "Enter" || event.key === "r" || event.key === "R") && runtime.world.state === "RESULTS") {
      runtime.restart();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D" || event.key === "w" || event.key === "W") {
      down.delete("throttle");
      apply();
    }
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A" || event.key === "s" || event.key === "S") {
      down.delete("brake");
      apply();
    }
  });
}

function bindSafety(): void {
  const release = () => {
    runtime.world.releaseAllInput();
    runtime.touch.reset((state) => {
      runtime.world.touch = state;
    });
  };
  window.addEventListener("blur", release);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      runtime.pause();
      release();
    }
  });
}

bindKeyboard();
bindSafety();

window.addEventListener("pointerdown", () => runtime.audio.unlock(), { once: true });

window.__HILLBOUND_READY__ = true;
if (!flags.testMode) {
  window.__HILLBOUND_TELEMETRY__ = runtime.world.telemetry.events;
}

void game;
