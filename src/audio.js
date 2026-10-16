// Synthesized sound effects and region music using the Web Audio API (no audio files needed).
// Each effect is throttled so dense fights never turn into noise.

export class Audio {
  constructor() {
    this.ctx = null;
    this.last = new Map();
    this.settings = { master: 0.7, sfx: 0.8, music: 0.5 };
    this.track = null;
    this.musicTimer = null;
  }
  // Must be called from a user gesture.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    // gentle limiter so stacked hits never clip
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply(this.settings);
    if (this.pendingTrack) { const t = this.pendingTrack; this.pendingTrack = null; this.music(t); }
  }
  apply(s) {
    this.settings = { ...this.settings, ...s };
    if (!this.ctx) return;
    this.master.gain.value = this.settings.master;
    this.sfxGain.gain.value = this.settings.sfx * 0.55;
    this.musicGain.gain.value = this.settings.music * 0.22;
  }

  tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, delay = 0, attack = 0.005 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  burst(dur, { vol = 0.3, freq = 1200, q = 1, type = 'lowpass', delay = 0, sweep = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t); s.stop(t + dur + 0.02);
  }

  play(name, opts = {}) {
    if (!this.ctx || this.settings.master <= 0 || this.settings.sfx <= 0) return;
    const now = performance.now();
    const gap = THROTTLE[name] ?? 40;
    if (now - (this.last.get(name) || 0) < gap) return;
    this.last.set(name, now);
    const fx = SFX[name];
    if (fx) fx(this, opts);
  }

  // ── music: a small generative sequencer per area ──
  music(trackId) {
    if (this.track === trackId) return;
    if (!this.ctx) { this.pendingTrack = trackId; return; }
    this.stopMusic();
    this.track = trackId;
    const song = SONGS[trackId];
    if (!song) return;
    let step = 0;
    let next = this.ctx.currentTime + 0.1;
    const beat = 60 / song.bpm / 2;
    const schedule = () => {
      while (next < this.ctx.currentTime + 0.4) {
        const bar = Math.floor(step / 16) % song.prog.length;
        const root = song.root * Math.pow(2, song.prog[bar] / 12);
        const s = step % 16;
        if (s % 8 === 0) this.note(root / 2, beat * 7, song.bass, 0.5, next);
        if (song.arp[s] != null) this.note(root * Math.pow(2, song.scale[song.arp[s] % song.scale.length] / 12) * (song.arp[s] >= song.scale.length ? 2 : 1), beat * 1.6, song.lead, 0.22, next);
        if (song.pad && s === 0) this.note(root * Math.pow(2, song.scale[2] / 12), beat * 15, 'sine', 0.12, next);
        next += beat;
        step++;
      }
    };
    schedule();
    this.musicTimer = setInterval(schedule, 120);
  }
  note(freq, dur, type, vol, t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.track = null;
  }
}

const THROTTLE = { hit: 45, enemyShoot: 70, shoot: 55, step: 200, bossShoot: 90, flame: 90, chime: 120, pickup: 60, gold: 50 };

const SFX = {
  shoot: (a, o) => {
    const k = o.kind;
    if (k === 'arrow') a.burst(0.07, { vol: 0.18, freq: 3000, type: 'highpass' });
    else if (k === 'spirit') a.tone(700, 0.12, { type: 'sine', vol: 0.12, slide: 300 });
    else a.tone(520, 0.09, { type: 'triangle', vol: 0.14, slide: 400 });
  },
  swing: (a) => a.burst(0.09, { vol: 0.22, freq: 1800, type: 'bandpass', q: 2, sweep: -1200 }),
  hit: (a) => { a.burst(0.05, { vol: 0.2, freq: 900 }); a.tone(160, 0.06, { vol: 0.12, slide: -80 }); },
  crit: (a) => { a.burst(0.07, { vol: 0.28, freq: 1500 }); a.tone(880, 0.08, { type: 'square', vol: 0.08 }); },
  enemyDie: (a) => { a.burst(0.18, { vol: 0.25, freq: 700, sweep: -500 }); a.tone(220, 0.15, { vol: 0.1, slide: -150 }); },
  enemyShoot: (a) => a.tone(330, 0.08, { type: 'square', vol: 0.06, slide: -120 }),
  playerHurt: (a) => { a.tone(200, 0.18, { type: 'sawtooth', vol: 0.2, slide: -120 }); a.burst(0.1, { vol: 0.2, freq: 600 }); },
  dodge: (a) => a.burst(0.12, { vol: 0.15, freq: 2500, type: 'bandpass', q: 1.5, sweep: -1800 }),
  pickup: (a) => { a.tone(660, 0.06, { type: 'square', vol: 0.08 }); a.tone(990, 0.08, { type: 'square', vol: 0.08, delay: 0.05 }); },
  gold: (a) => a.tone(1320, 0.05, { type: 'square', vol: 0.05 }),
  rare: (a) => { [523, 659, 784, 1046].forEach((f, i) => a.tone(f, 0.18, { type: 'triangle', vol: 0.14, delay: i * 0.06 })); },
  legendary: (a) => { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => a.tone(f, 0.3, { type: 'triangle', vol: 0.16, delay: i * 0.07 })); },
  ability: (a) => { a.tone(300, 0.2, { type: 'sawtooth', vol: 0.1, slide: 600 }); a.burst(0.15, { vol: 0.1, freq: 2000, type: 'bandpass' }); },
  nova: (a) => { a.burst(0.35, { vol: 0.25, freq: 3000, type: 'highpass' }); a.tone(1200, 0.3, { type: 'sine', vol: 0.1, slide: -900 }); },
  barrier: (a) => { a.tone(440, 0.3, { type: 'sine', vol: 0.15, slide: 220 }); a.tone(660, 0.3, { type: 'sine', vol: 0.1, slide: 330 }); },
  slam: (a) => { a.burst(0.3, { vol: 0.4, freq: 300 }); a.tone(80, 0.3, { type: 'sine', vol: 0.3, slide: -40 }); },
  blink: (a) => a.tone(1600, 0.15, { type: 'sine', vol: 0.12, slide: -1200 }),
  heal: (a) => { [523, 659, 784].forEach((f, i) => a.tone(f, 0.25, { type: 'sine', vol: 0.12, delay: i * 0.08 })); },
  levelUp: (a) => { [392, 494, 587, 784, 988].forEach((f, i) => a.tone(f, 0.22, { type: 'square', vol: 0.09, delay: i * 0.07 })); },
  chest: (a) => { a.burst(0.1, { vol: 0.2, freq: 500 }); [660, 880, 1100].forEach((f, i) => a.tone(f, 0.12, { type: 'triangle', vol: 0.1, delay: 0.1 + i * 0.06 })); },
  gate: (a) => { a.burst(0.25, { vol: 0.25, freq: 250 }); a.tone(110, 0.25, { type: 'square', vol: 0.08, slide: -30 }); },
  clear: (a) => { [523, 784, 1046].forEach((f, i) => a.tone(f, 0.25, { type: 'triangle', vol: 0.12, delay: i * 0.09 })); },
  bossIntro: (a) => { a.tone(55, 1.6, { type: 'sawtooth', vol: 0.25, slide: 20, attack: 0.3 }); a.burst(1.2, { vol: 0.2, freq: 200, sweep: 600 }); },
  bossShoot: (a) => { a.tone(180, 0.15, { type: 'square', vol: 0.12, slide: -60 }); a.burst(0.08, { vol: 0.12, freq: 800 }); },
  roar: (a) => { a.tone(90, 0.6, { type: 'sawtooth', vol: 0.25, slide: -40 }); a.burst(0.5, { vol: 0.25, freq: 400, sweep: -250 }); },
  flame: (a) => a.burst(0.12, { vol: 0.12, freq: 900, type: 'bandpass', q: 0.8 }),
  boom: (a) => { a.burst(0.4, { vol: 0.35, freq: 500, sweep: -400 }); a.tone(60, 0.35, { type: 'sine', vol: 0.3, slide: -20 }); },
  charge: (a) => a.tone(200, 0.9, { type: 'sawtooth', vol: 0.1, slide: 900, attack: 0.5 }),
  laser: (a) => { a.tone(880, 0.6, { type: 'sawtooth', vol: 0.08 }); a.burst(0.6, { vol: 0.1, freq: 4000, type: 'highpass' }); },
  chime: (a) => a.tone(1760 + Math.random() * 400, 0.15, { type: 'sine', vol: 0.06 }),
  bossDie: (a) => { a.burst(1.5, { vol: 0.4, freq: 800, sweep: -700 }); [196, 247, 294, 392].forEach((f, i) => a.tone(f, 0.6, { type: 'triangle', vol: 0.14, delay: 0.5 + i * 0.15 })); },
  complete: (a) => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => a.tone(f, 0.25, { type: 'square', vol: 0.08, delay: i * 0.1 })); },
  death: (a) => { [392, 330, 262, 196].forEach((f, i) => a.tone(f, 0.4, { type: 'triangle', vol: 0.14, delay: i * 0.18 })); },
  click: (a) => a.tone(880, 0.04, { type: 'square', vol: 0.06 }),
  hover: (a) => a.tone(1320, 0.02, { type: 'square', vol: 0.025 }),
  deny: (a) => a.tone(150, 0.12, { type: 'square', vol: 0.1 }),
  crackBreak: (a) => { a.burst(0.4, { vol: 0.35, freq: 600, sweep: -400 }); a.tone(120, 0.3, { type: 'square', vol: 0.1, slide: -60 }); },
  portal: (a) => { a.tone(300, 0.8, { type: 'sine', vol: 0.15, slide: 600 }); a.tone(450, 0.8, { type: 'sine', vol: 0.1, slide: 900 }); },
  spawn: (a) => a.tone(400, 0.3, { type: 'sine', vol: 0.06, slide: -250 }),
};

// Minor-key loops. arp: indices into scale (>= scale.length means an octave up)
const SONGS = {
  hub: { bpm: 84, root: 261.6, scale: [0, 2, 4, 7, 9], prog: [0, 5, 7, 5], arp: [0, null, 2, null, 3, null, 2, null, 4, null, 3, null, 2, null, 1, null], lead: 'triangle', bass: 'sine', pad: true },
  moss: { bpm: 96, root: 220, scale: [0, 3, 5, 7, 10], prog: [0, 0, 8, 7], arp: [0, 2, 4, 2, 5, 2, 4, 2, 0, 2, 4, 2, 6, 4, 3, 1], lead: 'triangle', bass: 'triangle' },
  cinder: { bpm: 112, root: 164.8, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 0, 1, 0], arp: [0, null, 0, 4, null, 0, 5, null, 0, null, 0, 4, null, 7, 5, 4], lead: 'square', bass: 'sawtooth' },
  prism: { bpm: 90, root: 246.9, scale: [0, 2, 3, 7, 8], prog: [0, 3, 5, 3], arp: [5, null, 7, null, 6, null, 3, null, 5, null, 8, null, 7, null, 4, null], lead: 'sine', bass: 'sine', pad: true },
  boss: { bpm: 140, root: 130.8, scale: [0, 1, 3, 6, 7, 10], prog: [0, 0, 1, 6], arp: [0, 0, 6, 0, 3, 0, 6, 4, 0, 0, 6, 0, 8, 7, 6, 4], lead: 'square', bass: 'sawtooth' },
  title: { bpm: 72, root: 196, scale: [0, 2, 3, 7, 10], prog: [0, 8, 3, 10], arp: [0, null, null, 2, null, null, 3, null, 5, null, null, 4, null, null, 2, null], lead: 'triangle', bass: 'sine', pad: true },
};
