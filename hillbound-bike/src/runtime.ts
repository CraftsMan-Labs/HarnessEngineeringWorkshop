import { GAME_CONFIG, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, isLevelId } from "./config/gameConfig";
import { LEVELS } from "./config/levels";
import { ProceduralAudio } from "./audio/ProceduralAudio";
import { GameWorld } from "./systems/GameWorld";
import { loadSave, recordResult, writeSave } from "./systems/persistence";
import type { LevelId, SaveDataV1 } from "./types/game";
import { Hud } from "./ui/Hud";
import { OverlayController } from "./ui/overlays";
import { TouchControls } from "./ui/TouchControls";

export interface RuntimeFlags {
  testMode: boolean;
  manual: boolean;
}

export function readFlags(search = window.location.search): RuntimeFlags {
  const params = new URLSearchParams(search);
  return {
    testMode: params.get("testMode") === "1",
    manual: params.get("manual") === "1",
  };
}

export class Runtime {
  readonly flags: RuntimeFlags;
  readonly world: GameWorld;
  readonly audio: ProceduralAudio;
  readonly overlays: OverlayController;
  readonly hud: Hud;
  readonly touch: TouchControls;
  save: SaveDataV1;
  selected: LevelId = "green-hills";
  reducedMotion: boolean;
  lastUiKey = "";
  onSceneChange: ((scene: "boot" | "menu" | "game" | "results") => void) | null = null;

  constructor(uiRoot: HTMLElement, flags: RuntimeFlags) {
    this.flags = flags;
    this.save = loadSave(safeStorage());
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.world = new GameWorld({
      testMode: flags.testMode,
      manual: flags.manual,
      strictTransitions: flags.testMode,
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      userAgent: navigator.userAgent,
    });
    this.audio = new ProceduralAudio({ enabled: !flags.testMode, muted: this.save.muted });
    this.overlays = new OverlayController(uiRoot, {
      selectLevel: (id) => {
        this.selected = id;
        this.refreshUi();
      },
      play: () => this.playSelected(),
      resume: () => this.resume(),
      restart: () => this.restart(),
      menu: () => this.returnToMenu(),
      toggleMute: () => this.toggleMute(),
      pause: () => this.pause(),
    });
    this.hud = new Hud(this.overlays);
    this.touch = new TouchControls(uiRoot, (state) => {
      this.world.touch = state;
    });
    this.touch.setVisible(false);
    this.world.machine.resetToMenu();
    this.refreshUi();
  }

  playSelected(): void {
    this.audio.unlock();
    this.world.startRun(this.selected);
    this.touch.setVisible(true);
    this.onSceneChange?.("game");
    this.refreshUi();
  }

  pause(): void {
    if (this.world.state === "PLAYING" || this.world.state === "OUT_OF_FUEL_COASTING") {
      this.world.pause();
      this.world.releaseAllInput();
      this.touch.reset((state) => {
        this.world.touch = state;
      });
      this.refreshUi();
    }
  }

  resume(): void {
    this.world.resume();
    this.refreshUi();
  }

  restart(): void {
    this.world.restartRun();
    this.touch.setVisible(true);
    this.onSceneChange?.("game");
    this.refreshUi();
  }

  returnToMenu(): void {
    if (this.world.state === "RESULTS") {
      this.world.machine.transition("MENU", { strict: this.flags.testMode });
    } else {
      this.world.abandonToMenu();
      this.world.machine.resetToMenu();
    }
    this.touch.setVisible(false);
    this.onSceneChange?.("menu");
    this.refreshUi();
  }

  toggleMute(): void {
    this.save.muted = !this.save.muted;
    this.audio.setMuted(this.save.muted);
    writeSave(this.save, safeStorage());
    this.refreshUi();
  }

  persistResults(): void {
    this.save = recordResult(
      this.save,
      this.world.levelId,
      this.world.score.maxDistanceM,
      this.world.score.totalScore,
    );
    writeSave(this.save, safeStorage());
  }

  refreshUi(): void {
    const playing =
      this.world.state === "PLAYING" ||
      this.world.state === "PAUSED" ||
      this.world.state === "OUT_OF_FUEL_COASTING" ||
      this.world.state === "CRASHED" ||
      this.world.state === "COMPLETED";
    this.touch.setVisible(playing);
    const notes = this.world.notifications
      .filter((note) => this.world.tick - note.bornTick < note.lifeTicks)
      .slice(-3)
      .map((note) => note.text);
    this.hud.update({
      runState: this.world.state === "ABANDONED" ? "MENU" : this.world.state,
      selected: this.selected,
      save: this.save,
      levelName: LEVELS[this.world.state === "MENU" ? this.selected : this.world.levelId].displayName,
      distance: this.world.score.displayDistanceM,
      score: this.world.score.totalScore,
      fuel: this.world.fuel.value,
      paused: this.world.state === "PAUSED",
      resultReason: this.world.machine.resultReason,
      components: this.world.score.snapshot(),
      notifications: notes,
      outOfFuel: this.world.state === "OUT_OF_FUEL_COASTING" || this.world.fuel.value <= 0 && playing,
    });
  }

  getConfig() {
    return GAME_CONFIG;
  }
}

export function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function parseLevelParam(value: string | null): LevelId | null {
  if (!value) return null;
  return isLevelId(value) ? value : null;
}
