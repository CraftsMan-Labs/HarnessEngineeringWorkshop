import { describe, expect, it } from "vitest";
import { BikeContactTracker } from "../../src/bike/BikeContactTracker";

describe("ground grace", () => {
  it("does not start airtime after five isolated no-contact ticks", () => {
    const tracker = new BikeContactTracker();
    tracker.setRawForTest(true, true);
    expect(tracker.step().airborneJustStarted).toBe(false);
    tracker.setRawForTest(false, false);
    for (let i = 0; i < 5; i += 1) {
      expect(tracker.step().airborneJustStarted).toBe(false);
    }
    tracker.setRawForTest(true, false);
    expect(tracker.step().airborne).toBe(false);
  });

  it("starts airtime on the sixth no-contact tick", () => {
    const tracker = new BikeContactTracker();
    tracker.setRawForTest(true, true);
    tracker.step();
    tracker.setRawForTest(false, false);
    const starts: boolean[] = [];
    for (let i = 0; i < 6; i += 1) starts.push(tracker.step().airborneJustStarted);
    expect(starts.filter(Boolean)).toHaveLength(1);
    expect(starts[5]).toBe(true);
  });

  it("ignores chassis-only contact when deciding landings", () => {
    const tracker = new BikeContactTracker();
    tracker.setRawForTest(true, true);
    tracker.step();
    tracker.setRawForTest(false, false);
    for (let i = 0; i < 6; i += 1) tracker.step();
    expect(tracker.airborne).toBe(true);
    tracker.setRawForTest(false, false);
    const mid = tracker.step();
    expect(mid.landed).toBe(false);
    expect(mid.airborne).toBe(true);
    tracker.setRawForTest(true, false);
    expect(tracker.step().landed).toBe(true);
  });
});
