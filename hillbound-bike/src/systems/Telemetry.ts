import { TELEMETRY_CAP } from "../config/gameConfig";
import type { TelemetryEvent } from "../types/game";

const PRESERVED_TYPES = new Set([
  "run_started",
  "pickup_collected",
  "stunt_awarded",
  "state_hash",
  "simulation_fault",
  "run_ended",
]);

export class Telemetry {
  events: TelemetryEvent[] = [];
  runId = "";
  private sequence = 0;

  reset(runId: string): void {
    this.events = [];
    this.runId = runId;
    this.sequence = 0;
  }

  emit(tick: number, type: string, data: Record<string, unknown> = {}): void {
    const event: TelemetryEvent = {
      sequence: this.sequence,
      runId: this.runId,
      tick,
      type,
      data,
    };
    this.sequence += 1;
    this.events.push(event);
    if (this.events.length > TELEMETRY_CAP) {
      const preserved = this.events.filter((item) => PRESERVED_TYPES.has(item.type));
      const recent = this.events.slice(-Math.floor(TELEMETRY_CAP / 2));
      const merged = [...preserved];
      for (const item of recent) {
        if (!merged.includes(item)) merged.push(item);
      }
      merged.sort((a, b) => a.sequence - b.sequence);
      this.events = merged.slice(-TELEMETRY_CAP);
    }
  }

  clone(): TelemetryEvent[] {
    return this.events.map((event) => ({
      ...event,
      data: { ...event.data },
    }));
  }
}
