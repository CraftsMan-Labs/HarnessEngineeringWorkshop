import type { ControlState } from "../types/game";

export class TouchControls {
  readonly root: HTMLElement;
  state: ControlState = { throttle: 0, brake: 0 };
  private brakeButton: HTMLButtonElement;
  private throttleButton: HTMLButtonElement;

  constructor(parent: HTMLElement, onChange: (state: ControlState) => void) {
    this.root = document.createElement("div");
    this.root.className = "touch-controls";
    this.brakeButton = this.pedal("Brake", "brake");
    this.throttleButton = this.pedal("Throttle", "throttle");
    this.root.append(this.brakeButton, this.throttleButton);
    parent.append(this.root);
    this.bind(this.brakeButton, "brake", onChange);
    this.bind(this.throttleButton, "throttle", onChange);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  reset(onChange?: (state: ControlState) => void): void {
    this.state = { throttle: 0, brake: 0 };
    this.brakeButton.classList.remove("pressed");
    this.throttleButton.classList.remove("pressed");
    onChange?.(this.state);
  }

  private pedal(label: string, action: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pedal";
    button.dataset.action = action;
    button.setAttribute("aria-label", label);
    button.textContent = action === "throttle" ? "GO" : "STOP";
    return button;
  }

  private bind(button: HTMLButtonElement, key: keyof ControlState, onChange: (state: ControlState) => void): void {
    const down = (event: Event) => {
      event.preventDefault();
      this.state = { ...this.state, [key]: 1 };
      button.classList.add("pressed");
      onChange(this.state);
    };
    const up = (event: Event) => {
      event.preventDefault();
      this.state = { ...this.state, [key]: 0 };
      button.classList.remove("pressed");
      onChange(this.state);
    };
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);
    button.addEventListener("pointerout", up);
    button.addEventListener("lostpointercapture", up);
  }
}
