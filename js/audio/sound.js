// Sidehop Web Audio Sound FX Engine
// Pure procedural Web Audio API sounds — zero external assets required!

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterGain = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.4;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('AudioContext init failed:', e);
      this.ctx = null;
    }
  }

  ensureContext() {
    try {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return !!(this.ctx && this.masterGain);
    } catch (e) {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(muted ? 0 : 0.4, this.ctx.currentTime);
      }
    } catch (e) {}
  }

  // --- Sound Effects ---

  // Jump Boing (Kid Pix bouncy boing)
  playJump() {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.16);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  // Landing Squish
  playLand() {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  // Super Spring Launch
  playBounce() {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  // Musical Note Block Sound (Mario Maker style melodic marimba/bell chime progression)
  playMusicNote(pitchIndex = null) {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      // Upbeat 16-note platformer melody progression across C major / pentatonic
      const melody = [
        523.25,  // C5
        659.25,  // E5
        783.99,  // G5
        1046.50, // C6
        880.00,  // A5
        783.99,  // G5
        659.25,  // E5
        587.33,  // D5
        698.46,  // F5
        880.00,  // A5
        987.77,  // B5
        1174.66, // D6
        1046.50, // C6
        987.77,  // B5
        783.99,  // G5
        659.25   // E5
      ];

      if (typeof this.musicStep !== 'number') {
        this.musicStep = 0;
      }

      // Advance through the melody on every hit so repeated bounces play a real tune
      const stepIdx = (pitchIndex !== null && pitchIndex !== undefined)
        ? Math.abs(Math.round(pitchIndex)) % melody.length
        : (this.musicStep++ % melody.length);
      const freq = melody[stepIdx];

      // Primary tone: warm sine wave
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      // Secondary tone: bright chime harmonic (1 octave up, soft triangle)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, now);

      // Sweet vibraphone/chime ADSR envelope
      gain1.gain.setValueAtTime(0.38, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      gain2.gain.setValueAtTime(0.14, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(gain1);
      gain1.connect(this.masterGain);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);

      osc1.start(now);
      osc1.stop(now + 0.4);

      osc2.start(now);
      osc2.stop(now + 0.25);
    } catch (e) {}
  }

  // Collectible Coin Chime
  playCollect() {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      
      // 2-tone bright arpeggio
      [0, 0.07].forEach((delay, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const freq = idx === 0 ? 987.77 : 1318.51; // B5 to E6
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay);
        gain.gain.setValueAtTime(0.2, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + delay);
        osc.stop(now + delay + 0.2);
      });
    } catch (e) {}
  }

  // Enemy Stomp Pop
  playStomp() {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {}
  }

  // Hazard / Defeat Slide Whistle
  playHurt() {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  // Victory Fanfare
  playVictory() {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.11;
        const duration = idx === notes.length - 1 ? 0.45 : 0.18;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + duration);
      });
    } catch (e) {}
  }

  playFanfare() {
    this.playVictory();
  }

  // Paint Squelch (Kid Pix style squishy drawing sound)
  playPaintSquish() {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const randomFreq = 300 + Math.random() * 250;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(randomFreq, now);
      osc.frequency.exponentialRampToValueAtTime(randomFreq * 1.5, now + 0.05);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  // Button Click / Mode Switch
  playClick() {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  // Pistol Gun Shot (Punchy 8-bit blast)
  playShoot() {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  // Gun Powerup Cocking Chime
  playGunPickup() {
    if (this.muted || !this.ensureContext()) return;
    try {
      const now = this.ctx.currentTime;
      [220, 440, 880].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.05;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.1);
      });
    } catch (e) {}
  }
}

export const sounds = new SoundEngine();
