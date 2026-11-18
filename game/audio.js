// audio.js — WebAudio synth for Neon Harbor.
// Engine hum, two music loops ("Dusk" and "Night Run") that trade every
// four bars, a tense loop forced at 3+ wanted stars, plus small SFX.
// Everything is guarded: if there is no AudioContext (headless) it is a
// silent no-op. No audio files, no network.

const BPM = 112;
const BEAT = 60 / BPM;          // seconds per beat
const BAR = BEAT * 4;           // seconds per bar
const TRADE_BARS = 4;           // loops trade every 4 bars

// note frequencies (Hz)
const N = {
  A2: 110.0, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0,
  A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
  G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
};

// One bar of bass notes per chord (4 beats), and a sparse lead per loop.
const LOOPS = {
  dusk: {
    name: 'Dusk',
    bass: [N.A2, N.F3, N.C3, N.G3],
    lead: [null, N.E4, null, N.D4, null, N.C4, null, N.E4, null, N.G4, null, N.E4, null, N.D4, null, null],
    leadType: 'sine', leadGain: 0.05, bassType: 'triangle', bassGain: 0.10,
  },
  night: {
    name: 'Night Run',
    bass: [N.A2, N.A2, N.F3, N.G3],
    lead: [N.A4, null, N.C5, null, N.A4, null, N.G4, null, N.E4, null, N.G4, N.A4, null, N.C5, null, null],
    leadType: 'square', leadGain: 0.035, bassType: 'sawtooth', bassGain: 0.07,
  },
  tense: {
    name: 'Tense',
    bass: [N.A2, N.A2, N.A2, N.A2],
    lead: [N.C5, N.B3, N.C5, N.B3, N.C5, N.B3, N.A4, N.B3, N.C5, N.B3, N.C5, N.B3, N.G4, N.A4, N.B3, N.C5],
    leadType: 'sawtooth', leadGain: 0.04, bassType: 'sawtooth', bassGain: 0.09,
  },
};

export const AudioSys = {
  ctx: null,
  master: null,
  musicGain: null,
  engineOsc: null,
  engineGain: null,
  engineFilter: null,
  started: false,
  beatClock: 0,        // seconds of music elapsed
  nextBeatAt: 0,        // beatClock value of the next beat boundary
  beatIndex: 0,         // global beat counter
  barIndex: 0,
  loopName: 'dusk',
  wanted: 0,
  sirenPhase: 0,

  init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);
      // engine hum: sawtooth through a lowpass
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      return true;
    } catch (e) {
      this.ctx = null;
      return false;
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  start() {
    if (!this.ctx) this.init();
    this.resume();
    this.started = true;
    this.beatClock = 0;
    this.nextBeatAt = 0;
    this.beatIndex = 0;
    this.barIndex = 0;
  },

  setWanted(n) {
    this.wanted = n;
  },

  // Engine pitch follows speed (0..~600). Call every frame.
  setSpeed(speed) {
    if (!this.ctx || !this.engineOsc) return;
    const f = 55 + Math.min(1, Math.abs(speed) / 600) * 145;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
    const g = this.started ? 0.028 + Math.min(1, Math.abs(speed) / 600) * 0.03 : 0;
    this.engineGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.1);
  },

  // Advance the music sequencer. dt in seconds.
  update(dt) {
    if (!this.ctx || !this.started) return;
    this.beatClock += dt;
    while (this.beatClock >= this.nextBeatAt) {
      this._playBeat(this.beatIndex);
      this.beatIndex += 1;
      this.nextBeatAt += BEAT;
      if (this.beatIndex % 4 === 0) this.barIndex += 1;
    }
    // siren wail while wanted
    if (this.wanted > 0) {
      this.sirenPhase += dt;
      if (this.sirenPhase > 1.1) {
        this.sirenPhase = 0;
        this._siren();
      }
    }
  },

  // Which loop is playing right now: tense at 3+ stars, else dusk/night
  // trading every TRADE_BARS bars.
  currentLoop() {
    if (this.wanted >= 3) return LOOPS.tense;
    const block = Math.floor(this.barIndex / TRADE_BARS) % 2;
    return block === 0 ? LOOPS.dusk : LOOPS.night;
  },

  loopNameNow() {
    return this.currentLoop().name;
  },

  _playBeat(beat) {
    const loop = this.currentLoop();
    const inBar = beat % 4;
    const bassNote = loop.bass[inBar];
    if (bassNote) this._tone(bassNote, BAR * 0.9, loop.bassType, loop.bassGain);
    // lead plays 16th-note slots: 4 per beat
    for (let s = 0; s < 4; s++) {
      const idx = (beat * 4 + s) % 16;
      const f = loop.lead[idx];
      if (f) this._toneAt(f, BEAT * 0.22, loop.leadType, loop.leadGain, s * (BEAT / 4));
    }
    // soft hat tick on off-beats for the night loop
    if (loop === LOOPS.night && beat % 2 === 1) this._hat();
  },

  _tone(freq, dur, type, gain) {
    this._toneAt(freq, dur, type, gain, 0);
  },

  _toneAt(freq, dur, type, gain, delay) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  },

  _hat() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const len = 0.03;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(t0);
  },

  _siren() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(660, t0);
    o.frequency.linearRampToValueAtTime(880, t0 + 0.5);
    o.frequency.linearRampToValueAtTime(660, t0 + 1.0);
    g.gain.setValueAtTime(0.035, t0);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 1.05);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 1.1);
  },

  // ---- one-shot SFX ----
  _blip(freq, dur, type, gain) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  shoot() { this._blip(920, 0.09, 'square', 0.06); },
  hit() { this._blip(140, 0.12, 'sawtooth', 0.08); },
  crash() { this._blip(70, 0.25, 'sawtooth', 0.12); },
  pickup() { this._blip(660, 0.08, 'sine', 0.08); setTimeout(() => this._blip(990, 0.12, 'sine', 0.08), 80); },
  cash() { this._blip(880, 0.07, 'sine', 0.07); setTimeout(() => this._blip(1174, 0.07, 'sine', 0.07), 70); setTimeout(() => this._blip(1568, 0.14, 'sine', 0.07), 140); },
  deny() { this._blip(180, 0.15, 'square', 0.07); },
};
