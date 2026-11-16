/* =========================================================
   Klangkulisse
   - J. S. Bach: Air (Orchestersuite Nr. 3, BWV 1068)
     gespielt von den Air Force Strings, U.S. Air Force Band – gemeinfrei
   - darunter leiser, live erzeugter Herbstwind (Web Audio API)
   Startet nur auf Knopfdruck (Browser erlauben keinen Autoplay-Ton).
   ========================================================= */
(() => {
  "use strict";

  const AC = window.AudioContext || window.webkitAudioContext;
  const btn = document.getElementById("soundBtn");
  if (!btn) return;
  if (!AC) { btn.hidden = true; return; }

  const MUSIC_SRC = "assets/audio/bach-air.m4a";
  const MUSIC_LEVEL = .6;     // Musik im Verhältnis zum Wind
  const PAUSE_BETWEEN = 6000; // ms nur Wind, bevor das Stück von vorn beginnt

  const rand = (a, b) => a + Math.random() * (b - a);

  let ctx, master, musicGain, windGain, windLP, airBP, audio;
  let on = false, windTimer = null, restartTimer = null, scrollEnergy = 0;

  function init() {
    // iOS: auch bei Lautlos-Schalter abspielen, wenn Besucher bewusst Musik einschalten
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* egal */ }

    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Musik über Web Audio, damit sich die Lautstärke auch auf dem iPhone regeln lässt
    audio = new Audio();
    audio.src = MUSIC_SRC;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "");
    const src = ctx.createMediaElementSource(audio);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    src.connect(musicGain).connect(master);

    audio.addEventListener("ended", () => {
      musicGain.gain.setValueAtTime(0, ctx.currentTime);
      if (on) restartTimer = setTimeout(playMusic, PAUSE_BETWEEN);
    });

    startWind();
  }

  /* ---------- Wind ---------- */
  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function startWind() {
    const buf = noiseBuffer(4);
    const src = ctx.createBufferSource();
    src.buffer = buf;
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
    air.buffer = buf;
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
    windGain.gain.setTargetAtTime(.035 + gust * .07 + scrollEnergy * .06, t, rand(1.2, 2.4));
    windLP.frequency.setTargetAtTime(280 + gust * 650 + scrollEnergy * 500, t, 1.6);
    airBP.frequency.setTargetAtTime(550 + gust * 900, t, 2);
  }

  /* ---------- Musik ---------- */
  function playMusic() {
    if (!on) return;
    const t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(0, t);
    musicGain.gain.linearRampToValueAtTime(MUSIC_LEVEL, t + 4);
    audio.play().catch(() => {});
  }

  /* ---------- Start / Stopp ---------- */
  function fadeMaster(to, seconds) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(to, t + seconds);
  }

  async function start() {
    if (!ctx) init();
    // play() muss direkt in der Tipp-Geste starten (iOS)
    const playing = audio.paused ? audio.play() : Promise.resolve();
    if (ctx.state !== "running") await ctx.resume();
    on = true;
    await playing.catch(() => {});
    fadeMaster(1, 2.5);
    const t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t);
    musicGain.gain.linearRampToValueAtTime(MUSIC_LEVEL, t + 4);
    windTick();
    windTimer = setInterval(windTick, 2300);
  }

  function stop() {
    on = false;
    clearInterval(windTimer);
    clearTimeout(restartTimer);
    fadeMaster(0, 1.2);
    setTimeout(() => {
      if (on) return;
      audio.pause();
      ctx.suspend();
    }, 1300);
  }

  function render() {
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "Musik ausschalten" : "Musik einschalten");
  }

  btn.addEventListener("click", async () => {
    btn.classList.add("compact");
    if (on) stop();
    else {
      try { await start(); } catch (e) { on = false; }
    }
    render();
  });

  // Im Hintergrund-Tab pausieren, beim Zurückkehren weiterspielen
  let wasPlaying = false;
  document.addEventListener("visibilitychange", () => {
    if (!ctx || !on) return;
    if (document.hidden) {
      wasPlaying = !audio.paused;
      clearInterval(windTimer);
      audio.pause();
      ctx.suspend();
    } else {
      ctx.resume().then(() => {
        if (wasPlaying) audio.play().catch(() => {});
        clearInterval(windTimer);
        windTimer = setInterval(windTick, 2300);
      });
    }
  });

  /* ---------- Schnittstelle für script.js ---------- */
  window.Ambience = {
    setScroll(v) { scrollEnergy += (Math.min(1, v / 40) - scrollEnergy) * .1; },
  };
})();
