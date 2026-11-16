/* =========================================================
   Herbstklänge – alles live erzeugt (Web Audio API)
   - Wind in sanften Böen
   - Blätterrascheln
   - leises, warmes Klavier mit generativen Arpeggios (F-Dur)
   Startet nur auf Knopfdruck (Browser erlauben keinen Autoplay-Ton).
   ========================================================= */
(() => {
  "use strict";

  const AC = window.AudioContext || window.webkitAudioContext;
  const btn = document.getElementById("soundBtn");
  if (!btn) return;
  if (!AC) { btn.hidden = true; return; }

  const rand = (a, b) => a + Math.random() * (b - a);
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  let ctx, master, musicBus, sfxBus, reverb, noiseBuf;
  let windGain, windLP, airBP;
  let on = false, schedTimer = null, windTimer = null, rustleTimer = null;
  let nextNoteTime = 0, step = 0, scrollEnergy = 0;

  /* ---------- Grundbausteine ---------- */
  function makeNoise(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  // Künstlicher Raumhall: abklingendes Rauschen als Impulsantwort
  function makeImpulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function panner(value) {
    if (!ctx.createStereoPanner) return null;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, value));
    return p;
  }

  function init() {
    // iOS: auch bei Lautlos-Schalter abspielen, wenn Besucher bewusst Musik einschalten
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* egal */ }

    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(3.4, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = .5;
    reverb.connect(wet).connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = .7;
    musicBus.connect(master);
    const musicSend = ctx.createGain();
    musicSend.gain.value = .65;
    musicBus.connect(musicSend).connect(reverb);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = .8;
    sfxBus.connect(master);
    const sfxSend = ctx.createGain();
    sfxSend.gain.value = .2;
    sfxBus.connect(sfxSend).connect(reverb);

    noiseBuf = makeNoise(4);
    startWind();
  }

  /* ---------- Wind ---------- */
  function startWind() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    windLP = ctx.createBiquadFilter();
    windLP.type = "lowpass";
    windLP.frequency.value = 420;
    windLP.Q.value = .6;
    windGain = ctx.createGain();
    windGain.gain.value = .05;
    src.connect(windLP).connect(windGain).connect(master);

    // feines, luftiges Pfeifen obendrüber
    const air = ctx.createBufferSource();
    air.buffer = noiseBuf;
    air.loop = true;
    air.playbackRate.value = .8;
    airBP = ctx.createBiquadFilter();
    airBP.type = "bandpass";
    airBP.frequency.value = 800;
    airBP.Q.value = 2.5;
    const airGain = ctx.createGain();
    airGain.gain.value = .02;
    air.connect(airBP).connect(airGain).connect(windGain);

    src.start();
    air.start(ctx.currentTime, 1.7);
  }

  function windTick() {
    const t = ctx.currentTime;
    const gust = Math.random() < .2 ? rand(.6, 1) : rand(.1, .45);
    const level = .035 + gust * .07 + scrollEnergy * .06;
    windGain.gain.setTargetAtTime(level, t, rand(1.2, 2.4));
    windLP.frequency.setTargetAtTime(280 + gust * 650 + scrollEnergy * 500, t, 1.6);
    airBP.frequency.setTargetAtTime(550 + gust * 900, t, 2);
    if (gust > .65) setTimeout(() => rustle(rand(-.8, .8), rand(.35, .6)), rand(300, 900));
  }

  /* ---------- Blätterrascheln ---------- */
  function rustle(pan = 0, strength = .5) {
    if (!ctx || !on) return;
    const t0 = ctx.currentTime + .02;
    const dur = rand(.35, .9) * (.7 + strength);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1600;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = rand(2800, 5200);
    bp.Q.value = .7;
    const g = ctx.createGain();
    g.gain.value = 0;
    const p = panner(pan);
    src.connect(hp).connect(bp).connect(g);
    (p ? g.connect(p) : g).connect(sfxBus);

    // viele winzige Knister-Körner = trockenes Laub
    const n = Math.round(10 + strength * 30);
    const times = Array.from({ length: n }, () => t0 + Math.random() * dur).sort((a, b) => a - b);
    times.forEach((t, i) => {
      const next = times[i + 1] ?? t + .05;
      const len = Math.min(rand(.006, .035), Math.max(.004, next - t - .001));
      const amp = rand(.25, 1) * strength * 1.1;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + .002);
      g.gain.exponentialRampToValueAtTime(.0001, t + len);
    });
    src.start(t0, rand(0, 3));
    src.stop(t0 + dur + .1);
  }

  /* ---------- Klavier ---------- */
  function piano(midi, time, vel = .2, bright = 1, dest = musicBus) {
    const f = mtof(midi);
    const decay = Math.max(1.6, Math.min(4.5, 3.2 + (60 - midi) * .05));
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(vel, time + .008);
    out.gain.exponentialRampToValueAtTime(vel * .35, time + .35);
    out.gain.exponentialRampToValueAtTime(.0001, time + decay);

    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.Q.value = .5;
    filt.frequency.setValueAtTime(Math.min(7000, f * 7 * bright), time);
    filt.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.6), time + 1.4);
    filt.connect(out).connect(dest);

    [[ "sine", 1, .6 ], [ "triangle", 1.002, .25 ], [ "sine", 2, .1 ], [ "sine", 3, .03 ]].forEach(([type, mul, amp]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mul;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(filt);
      o.start(time);
      o.stop(time + decay + .1);
    });
  }

  // warmer, kaum hörbarer Klangteppich unter jedem Akkord
  function pad(notes, time, length) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(.035, time + 2.4);
    g.gain.setValueAtTime(.035, time + length - .4);
    g.gain.linearRampToValueAtTime(0, time + length + 2.6);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    lp.connect(g).connect(musicBus);
    notes.forEach((m, i) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = mtof(m);
      o.detune.value = i % 2 ? 4 : -4;
      o.connect(lp);
      o.start(time);
      o.stop(time + length + 2.8);
    });
  }

  /* ---------- Komposition ---------- */
  // Fmaj7 – Dm9 – B♭maj7 – Csus4 (je 2 Takte, ruhige 64 BPM)
  const CHORDS = [
    { bass: 41, pad: [53, 57, 60, 64], tones: [53, 57, 60, 64, 65, 69, 72, 76] },
    { bass: 38, pad: [50, 53, 57, 60], tones: [50, 53, 57, 60, 64, 65, 69, 72] },
    { bass: 46, pad: [50, 53, 57, 58], tones: [53, 57, 58, 62, 65, 69, 70, 74] },
    { bass: 48, pad: [53, 55, 60, 62], tones: [55, 60, 62, 65, 67, 72, 74, 77] },
  ];
  const SHAPES = [
    [0, null, 2, 4, 3, null, 4, 2, 1, null, 3, 5, 4, null, 2, null],
    [2, 4, 5, null, 4, 2, null, 3, null, 4, 6, 5, null, 3, 4, null],
    [0, 2, 4, 6, 7, null, 6, 4, 3, null, 2, null, 4, 3, null, null],
  ];
  const EIGHTH = 60 / 64 / 2;

  function playSlot(s, t) {
    const ci = Math.floor(s / 16) % CHORDS.length;
    const slot = s % 16;
    const cycle = Math.floor(s / 64);
    const ch = CHORDS[ci];
    const hum = () => t + rand(-.012, .012);

    if (slot === 0) {
      piano(ch.bass, t, .3, .7);
      pad(ch.pad, t, EIGHTH * 16);
    }
    if (slot === 8 && Math.random() < .55) piano(ch.bass + 12, hum(), .12, .7);

    const idx = SHAPES[(cycle + ci) % SHAPES.length][slot];
    if (idx != null && Math.random() > .12) piano(ch.tones[idx], hum(), rand(.11, .17));

    // ab und zu ein heller Ton oben drüber
    if ((slot === 6 || slot === 14) && Math.random() < .22) piano(ch.tones[ch.tones.length - 1] + 12, hum(), .06, 1.4);
  }

  function scheduler() {
    while (nextNoteTime < ctx.currentTime + .35) {
      playSlot(step, nextNoteTime);
      nextNoteTime += EIGHTH;
      step++;
    }
  }

  /* ---------- Start / Stopp ---------- */
  function startTimers() {
    nextNoteTime = Math.max(nextNoteTime, ctx.currentTime + .15);
    schedTimer = setInterval(scheduler, 90);
    windTimer = setInterval(windTick, 2300);
    const loop = () => {
      rustle(rand(-.9, .9), rand(.2, .45));
      rustleTimer = setTimeout(loop, rand(3500, 9000));
    };
    rustleTimer = setTimeout(loop, 2500);
  }
  function stopTimers() {
    clearInterval(schedTimer);
    clearInterval(windTimer);
    clearTimeout(rustleTimer);
  }

  async function start() {
    if (!ctx) init();
    if (ctx.state !== "running") await ctx.resume();
    on = true;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(1, t + 3);
    nextNoteTime = t + .3;
    startTimers();
    windTick();
  }

  function stop() {
    on = false;
    stopTimers();
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + .9);
    setTimeout(() => { if (!on) ctx.suspend(); }, 1000);
  }

  function render() {
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "Musik und Herbstklänge ausschalten" : "Musik und Herbstklänge einschalten");
  }

  btn.addEventListener("click", async () => {
    btn.classList.add("compact");
    if (on) stop();
    else {
      try { await start(); } catch (e) { on = false; }
    }
    render();
  });

  // Im Hintergrund-Tab pausieren
  document.addEventListener("visibilitychange", () => {
    if (!ctx || !on) return;
    if (document.hidden) { stopTimers(); ctx.suspend(); }
    else { ctx.resume().then(startTimers); }
  });

  /* ---------- Schnittstelle für script.js ---------- */
  window.Ambience = {
    rustle(xNorm = .5, strength = .6) { if (on) rustle((xNorm - .5) * 1.6, strength); },
    chime() {
      if (!on) return;
      const ch = CHORDS[Math.floor(step / 16) % CHORDS.length];
      const t = ctx.currentTime + .03;
      const top = ch.tones[ch.tones.length - 1];
      piano(top + 12, t, .09, 1.6);
      piano(top + 7, t + .16, .06, 1.6);
    },
    setScroll(v) { scrollEnergy += (Math.min(1, v / 40) - scrollEnergy) * .1; },
  };
})();
