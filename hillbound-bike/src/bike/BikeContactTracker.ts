import { CONTACT } from "../config/gameConfig";

export interface ContactStep {
  rawGrounded: boolean;
  gameplayGrounded: boolean;
  airborne: boolean;
  airborneJustStarted: boolean;
  landed: boolean;
}

export class BikeContactTracker {
  rearContacts = new Set<number>();
  frontContacts = new Set<number>();
  ticksSinceRaw = 0;
  airborne = false;
  gameplayGrounded = true;

  reset(): void {
    this.rearContacts.clear();
    this.frontContacts.clear();
    this.ticksSinceRaw = 0;
    this.airborne = false;
    this.gameplayGrounded = true;
  }

  add(wheel: "rear" | "front", terrainId: number): void {
    (wheel === "rear" ? this.rearContacts : this.frontContacts).add(terrainId);
  }

  remove(wheel: "rear" | "front", terrainId: number): void {
    (wheel === "rear" ? this.rearContacts : this.frontContacts).delete(terrainId);
  }

  setRawForTest(rear: boolean, front: boolean): void {
    this.rearContacts.clear();
    this.frontContacts.clear();
    if (rear) this.rearContacts.add(1);
    if (front) this.frontContacts.add(2);
  }

  get rawGrounded(): boolean {
    return this.rearContacts.size > 0 || this.frontContacts.size > 0;
  }

  step(): ContactStep {
    const rawGrounded = this.rawGrounded;
    if (rawGrounded) this.ticksSinceRaw = 0;
    else this.ticksSinceRaw += 1;

    const gameplayGrounded = rawGrounded || this.ticksSinceRaw <= CONTACT.groundGraceTicks;
    let airborneJustStarted = false;
    let landed = false;

    if (!rawGrounded && this.ticksSinceRaw >= CONTACT.airborneAfterTicks) {
      if (!this.airborne) {
        this.airborne = true;
        airborneJustStarted = true;
      }
    }

    if (rawGrounded && this.airborne) {
      this.airborne = false;
      landed = true;
    }

    this.gameplayGrounded = gameplayGrounded;
    return {
      rawGrounded,
      gameplayGrounded,
      airborne: this.airborne,
      airborneJustStarted,
      landed,
    };
  }
}
