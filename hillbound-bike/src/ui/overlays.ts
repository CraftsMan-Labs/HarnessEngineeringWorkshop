import { hudFuelPercent } from "../systems/FuelSystem";
import { LEVELS, LEVEL_ORDER } from "../config/levels";
import type { LevelId, ResultReason, RunState, SaveDataV1, ScoreComponents } from "../types/game";

export interface OverlayCallbacks {
  selectLevel: (id: LevelId) => void;
  play: () => void;
  resume: () => void;
  restart: () => void;
  menu: () => void;
  toggleMute: () => void;
  pause: () => void;
}

const REASON_LABEL: Record<ResultReason, string> = {
  head_crash: "Head crash",
  out_of_fuel: "Out of fuel",
  finish: "Finished",
  out_of_bounds: "Out of bounds",
  simulation_fault: "Simulation fault",
  abandoned: "Abandoned",
};

export class OverlayController {
  readonly root: HTMLElement;
  private callbacks: OverlayCallbacks;
  selected: LevelId = "green-hills";

  constructor(root: HTMLElement, callbacks: OverlayCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
  }

  render(options: {
    state: RunState;
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
    this.selected = options.selected;
    this.root.replaceChildren();
    if (options.state === "BOOT") {
      this.root.append(this.panel("boot", [this.el("h1", "HILLBOUND BIKE"), this.el("p", "Loading…")]));
      return;
    }
    if (options.state === "MENU") {
      this.root.append(this.menu(options.save));
      return;
    }
    if (options.state === "RESULTS") {
      this.root.append(this.results(options));
      return;
    }
    if (options.state === "PLAYING" || options.state === "PAUSED" || options.state === "OUT_OF_FUEL_COASTING" || options.state === "CRASHED" || options.state === "COMPLETED") {
      this.root.append(this.hud(options));
      if (options.paused) this.root.append(this.pause());
    }
  }

  private menu(save: SaveDataV1): HTMLElement {
    const panel = this.panel("menu");
    panel.append(this.el("h1", "HILLBOUND BIKE"));
    const mute = this.button(save.muted ? "Sound: Off" : "Sound: On", () => this.callbacks.toggleMute());
    mute.classList.add("mute");
    panel.append(mute);
    const cards = this.el("div");
    cards.className = "cards";
    for (const id of LEVEL_ORDER) {
      const level = LEVELS[id];
      const best = save.levels[id];
      const card = this.button("", () => this.callbacks.selectLevel(id));
      card.className = `card ${id === this.selected ? "selected" : ""}`;
      card.dataset.levelId = id;
      card.innerHTML = `
        <strong>${level.displayName}</strong>
        <span>${id === "green-hills" ? "Daylight grassland" : "Dark lunar surface"}</span>
        <span>Gravity ${id === "green-hills" ? "Earth" : "16.5% Moon"}</span>
        <span>Best ${Math.floor(best.bestDistanceM)} m / ${best.bestScore}</span>
      `;
      cards.append(card);
    }
    panel.append(cards);
    const play = this.button("PLAY", () => this.callbacks.play());
    play.classList.add("primary");
    play.dataset.action = "play";
    panel.append(play);
    return panel;
  }

  private hud(options: {
    levelName: string;
    distance: number;
    score: number;
    fuel: number;
    notifications: string[];
    outOfFuel: boolean;
  }): HTMLElement {
    const hud = this.el("div");
    hud.className = "hud";
    const percent = hudFuelPercent(options.fuel);
    let fuelClass = "fuel-high";
    if (options.fuel <= 0) fuelClass = "fuel-empty";
    else if (percent <= 20) fuelClass = "fuel-low";
    else if (percent <= 50) fuelClass = "fuel-mid";
    hud.innerHTML = `
      <div class="hud-top">
        <div>
          <div class="label" data-hud="level">${options.levelName}</div>
          <div data-hud="distance">${options.distance} m</div>
          <div data-hud="score">${options.score}</div>
        </div>
        <button type="button" class="icon-btn" data-action="pause" aria-label="Pause">II</button>
      </div>
      <div class="fuel ${fuelClass}" data-hud="fuel">
        <div class="fuel-bar" style="width:${Math.min(100, percent)}%"></div>
        <span>${options.outOfFuel ? "OUT OF FUEL" : `Fuel ${percent}%`}</span>
      </div>
      <div class="notes">${options.notifications.map((note) => `<div>${note}</div>`).join("")}</div>
    `;
    hud.querySelector("[data-action=pause]")?.addEventListener("click", () => this.callbacks.pause());
    return hud;
  }

  private pause(): HTMLElement {
    const panel = this.panel("pause");
    panel.append(this.el("h2", "Paused"));
    panel.append(this.el("p", "Simulation is paused"));
    panel.append(this.actionButton("Resume", "resume", () => this.callbacks.resume()));
    panel.append(this.actionButton("Restart", "restart", () => this.callbacks.restart()));
    panel.append(this.actionButton("Return to Menu", "menu", () => this.callbacks.menu()));
    return panel;
  }

  private results(options: {
    resultReason: ResultReason | null;
    levelName: string;
    distance: number;
    components: ScoreComponents;
    save: SaveDataV1;
    selected: LevelId;
  }): HTMLElement {
    const panel = this.panel("results");
    const reason = options.resultReason ? REASON_LABEL[options.resultReason] : "Run ended";
    const best = options.save.levels[options.selected];
    panel.innerHTML = `
      <h2>Results</h2>
      <p data-result="reason">${reason}</p>
      <p data-result="level">${options.levelName}</p>
      <ul>
        <li>Distance ${options.distance} m / ${options.components.distanceScore}</li>
        <li>Coins ${options.components.coinScore}</li>
        <li>Fuel pickups ${options.components.fuelPickupScore}</li>
        <li>Airtime ${options.components.airtimeScore}</li>
        <li>Rotations ${options.components.rotationScore}</li>
        <li data-result="total">Total ${options.components.totalScore}</li>
        <li>Best ${Math.floor(best.bestDistanceM)} m / ${best.bestScore}</li>
      </ul>
    `;
    panel.append(this.actionButton("Restart", "restart", () => this.callbacks.restart()));
    panel.append(this.actionButton("Menu", "menu", () => this.callbacks.menu()));
    return panel;
  }

  private panel(name: string, children: HTMLElement[] = []): HTMLElement {
    const panel = this.el("section");
    panel.className = `panel ${name}`;
    panel.dataset.panel = name;
    for (const child of children) panel.append(child);
    return panel;
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  private actionButton(label: string, action: string, onClick: () => void): HTMLButtonElement {
    const button = this.button(label, onClick);
    button.dataset.action = action;
    return button;
  }

  private el(tag: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    return node;
  }
}
