import type { ResultReason, RunState } from "../types/game";

const TRANSITIONS: Record<RunState, RunState[]> = {
  BOOT: ["MENU"],
  MENU: ["PLAYING"],
  PLAYING: ["PAUSED", "OUT_OF_FUEL_COASTING", "CRASHED", "COMPLETED", "ABANDONED", "RESULTS"],
  PAUSED: ["PLAYING", "OUT_OF_FUEL_COASTING"],
  OUT_OF_FUEL_COASTING: ["PAUSED", "CRASHED", "COMPLETED", "RESULTS"],
  CRASHED: ["RESULTS"],
  COMPLETED: ["RESULTS"],
  RESULTS: ["PLAYING", "MENU"],
  ABANDONED: ["MENU"],
};

export class InvalidStateTransitionError extends Error {
  constructor(
    readonly from: RunState,
    readonly to: RunState,
  ) {
    super(`invalid_state_transition:${from}->${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

export function canTransition(from: RunState, to: RunState): boolean {
  return TRANSITIONS[from].includes(to);
}

export class RunStateMachine {
  state: RunState = "BOOT";
  resultReason: ResultReason | null = null;
  presentationTicks = 0;
  private resumeState: RunState = "PLAYING";

  resetToMenu(): void {
    this.state = "MENU";
    this.resultReason = null;
    this.presentationTicks = 0;
    this.resumeState = "PLAYING";
  }

  startPlaying(): void {
    this.force("PLAYING");
    this.resultReason = null;
    this.presentationTicks = 0;
    this.resumeState = "PLAYING";
  }

  transition(to: RunState, options?: { strict?: boolean; onInvalid?: () => void }): boolean {
    if (this.state === to) return true;
    if (!canTransition(this.state, to)) {
      options?.onInvalid?.();
      if (options?.strict) {
        throw new InvalidStateTransitionError(this.state, to);
      }
      return false;
    }
    if (this.state === "PLAYING" || this.state === "OUT_OF_FUEL_COASTING") {
      this.resumeState = this.state;
    }
    this.state = to;
    return true;
  }

  pause(): boolean {
    if (this.state === "PLAYING" || this.state === "OUT_OF_FUEL_COASTING") {
      this.resumeState = this.state;
      return this.transition("PAUSED");
    }
    return false;
  }

  resume(): boolean {
    if (this.state !== "PAUSED") return false;
    return this.transition(this.resumeState);
  }

  abandon(): boolean {
    if (this.state === "PAUSED") {
      this.state = "ABANDONED";
      this.resultReason = "abandoned";
      return true;
    }
    return this.transition("ABANDONED");
  }

  isSimulating(): boolean {
    return (
      this.state === "PLAYING" ||
      this.state === "OUT_OF_FUEL_COASTING" ||
      this.state === "CRASHED" ||
      this.state === "COMPLETED"
    );
  }

  isScoring(): boolean {
    return this.state === "PLAYING" || this.state === "OUT_OF_FUEL_COASTING";
  }

  isBurningFuel(): boolean {
    return this.state === "PLAYING";
  }

  acceptsInput(): boolean {
    return this.state === "PLAYING" || this.state === "OUT_OF_FUEL_COASTING";
  }

  private force(state: RunState): void {
    this.state = state;
  }
}
