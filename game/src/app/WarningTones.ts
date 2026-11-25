/**
 * Cockpit warning tones (presentation only): plays what the aircraft's equipment requests through
 * AudioCues — a short double beep per newly displayed emitter, a steady tone while the RWR reports
 * steady illumination, a fast warble for a missile. Simple synthesized tones, not recorded
 * aircraft audio. Silently does nothing where Web Audio is unavailable or not yet allowed.
 */
import type { AudioCues } from "../platforms/aircraft/common/Avionics.js";

export class WarningTones {
  private ctx: AudioContext | null = null;
  private lockOsc: { osc: OscillatorNode; gain: GainNode } | null = null;
  private missileOsc: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  private lastBeepS = -1;

  private audio(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    } catch { this.ctx = null; }
    return this.ctx;
  }

  private tone(freq: number, gain: number): { osc: OscillatorNode; gain: GainNode } | null {
    const a = this.audio();
    if (!a) return null;
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(a.destination);
    osc.start();
    return { osc, gain: g };
  }

  /** Call every frame; null = silence (paused). */
  public update(cues: AudioCues | null): void {
    const a = this.audio();
    if (!a) return;
    if (a.state === "suspended") void a.resume().catch(() => undefined);
    const lock = !!cues?.steadyIllumination && !cues.missile, missile = !!cues?.missile;
    if (lock && !this.lockOsc) this.lockOsc = this.tone(1000, 0.025);
    if (!lock && this.lockOsc) { this.lockOsc.osc.stop(); this.lockOsc = null; }
    if (missile && !this.missileOsc) {
      const t = this.tone(1400, 0.03);
      if (t) {
        const lfo = a.createOscillator(), depth = a.createGain();
        lfo.frequency.value = 12;
        depth.gain.value = 500;
        lfo.connect(depth).connect(t.osc.frequency);
        lfo.start();
        this.missileOsc = { ...t, lfo };
      }
    }
    if (!missile && this.missileOsc) { this.missileOsc.osc.stop(); this.missileOsc.lfo.stop(); this.missileOsc = null; }
    if (cues && cues.newContacts > 0 && a.currentTime - this.lastBeepS > 0.6) {
      this.lastBeepS = a.currentTime;
      for (const at of [0, 0.15]) {
        const osc = a.createOscillator(), g = a.createGain();
        osc.type = "square";
        osc.frequency.value = 1800;
        g.gain.value = 0.02;
        osc.connect(g).connect(a.destination);
        osc.start(a.currentTime + at);
        osc.stop(a.currentTime + at + 0.08);
      }
    }
  }

  public dispose(): void {
    this.update(null);
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
