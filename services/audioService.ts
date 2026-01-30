
class CryptoSynth {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private nextNoteTime: number = 0;
  private currentStep: number = 0;
  private timerId: number | null = null;

  // C-Major Pentatonic for a "positive" crypto feel
  private scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
  private pattern = [0, 2, 4, 3, 5, 4, 2, 1];

  constructor() {}

  private initContext() {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  public start() {
    if (this.isPlaying) return;
    const ctx = this.initContext();
    this.isPlaying = true;
    this.nextNoteTime = ctx.currentTime;
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId) window.clearTimeout(this.timerId);
    if (this.ctx) this.ctx.close();
  }

  public playSfx(type: 'PLAY' | 'DRAW' | 'BULL' | 'BEAR' | 'WIN') {
    const ctx = this.initContext();
    if (ctx.state === 'suspended') ctx.resume();
    
    const time = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    switch (type) {
      case 'PLAY':
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, time);
        osc.frequency.exponentialRampToValueAtTime(880, time + 0.1);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.start(time);
        osc.stop(time + 0.1);
        break;
      case 'DRAW':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, time);
        osc.frequency.linearRampToValueAtTime(440, time + 0.2);
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        osc.start(time);
        osc.stop(time + 0.2);
        break;
      case 'BULL':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, time); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.50, time + 0.4);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
        osc.start(time);
        osc.stop(time + 0.5);
        break;
      case 'BEAR':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(261.63, time); // C4
        osc.frequency.exponentialRampToValueAtTime(65.41, time + 0.6);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
        osc.start(time);
        osc.stop(time + 0.6);
        break;
      case 'WIN':
        // A simple celebratory chord
        [261.63, 329.63, 392.00, 523.25].forEach((f, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.setValueAtTime(f, time + i * 0.1);
          g.gain.setValueAtTime(0.1, time + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(time + i * 0.1);
          o.stop(time + 1.0);
        });
        return;
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
  }

  private playNote(freq: number, time: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.03, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private scheduler() {
    while (this.ctx && this.nextNoteTime < this.ctx.currentTime + 0.1) {
      const freq = this.scale[this.pattern[this.currentStep % this.pattern.length]];
      this.playNote(freq, this.nextNoteTime);
      this.nextNoteTime += 0.25;
      this.currentStep++;
    }
    if (this.isPlaying) {
      this.timerId = window.setTimeout(() => this.scheduler(), 25);
    }
  }
}

export const synth = new CryptoSynth();
