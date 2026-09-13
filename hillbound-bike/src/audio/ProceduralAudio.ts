export class ProceduralAudio {
  muted = false;
  enabled = true;
  private context: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  constructor(options?: { enabled?: boolean; muted?: boolean }) {
    this.enabled = options?.enabled ?? true;
    this.muted = options?.muted ?? false;
  }

  unlock(): void {
    if (!this.enabled || this.muted) return;
    this.ensureContext();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stopEngine();
  }

  engine(throttle: number, rearOmega: number): void {
    if (!this.enabled || this.muted || throttle <= 0) {
      this.stopEngine();
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = ctx.createOscillator();
      this.engineGain = ctx.createGain();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(ctx.destination);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 70 + Math.abs(rearOmega) * 220;
    if (this.engineGain) this.engineGain.gain.value = 0.03 * throttle;
  }

  coin(): void {
    this.blip(880, 0.08, "square", 0.05);
  }

  fuel(): void {
    this.blip(420, 0.09, "triangle", 0.05);
    this.blip(620, 0.1, "triangle", 0.04, 0.08);
  }

  stunt(): void {
    this.blip(740, 0.12, "sine", 0.05);
  }

  crash(): void {
    this.blip(90, 0.22, "sawtooth", 0.08);
  }

  finish(): void {
    this.blip(523, 0.1, "sine", 0.05);
    this.blip(659, 0.1, "sine", 0.05, 0.1);
    this.blip(784, 0.16, "sine", 0.05, 0.2);
  }

  dispose(): void {
    this.stopEngine();
    void this.context?.close();
    this.context = null;
  }

  private stopEngine(): void {
    try {
      this.engineOsc?.stop();
    } catch {
      // already stopped
    }
    this.engineOsc = null;
    this.engineGain = null;
  }

  private blip(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    if (!this.enabled || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    g.gain.value = 0;
    osc.connect(g);
    g.connect(ctx.destination);
    const start = ctx.currentTime + delay;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.context) {
        const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.context = new Ctor();
      }
      if (this.context.state === "suspended") void this.context.resume();
      return this.context;
    } catch {
      return null;
    }
  }
}
