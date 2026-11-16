(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const easeOutBack = t => (t <= 0 ? 0 : 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const WEDDING = new Date("2027-10-09T14:00:00+02:00");
  let W = innerWidth, H = innerHeight;

  /* ---------------------------------------------------------
     Fallende Aquarell-Blätter
     --------------------------------------------------------- */
  const cvs = $("#leaves");
  const ctx = cvs.getContext("2d");
  const SPRITES = [];
  const leaves = [];
  const baseCount = () => (reduceMotion ? 0 : W < 600 ? 7 : 12);

  // SVGs mit Filtern sind teuer zu zeichnen – einmal in Bitmaps vorrendern
  ["maple", "leaf-a", "leaf-b"].forEach(name => {
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const w = 90 * scale;
      const h = Math.round(w * (img.naturalHeight / img.naturalWidth || 2));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      SPRITES.push({ c, ratio: h / w, big: name === "maple" });
    };
    img.src = `assets/${name}.svg`;
  });

  function makeLeaf(o = {}) {
    const z = .5 + Math.random() * .5;
    return {
      x: o.x ?? Math.random() * W,
      y: o.y ?? -60 - Math.random() * H,
      z,
      s: Math.random(),
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - .5) * .025,
      flip: Math.random() * Math.PI * 2,
      vf: .012 + Math.random() * .025,
      sway: Math.random() * Math.PI * 2,
      vx: o.vx ?? 0,
      vy: o.vy ?? 0,
      sprite: (Math.random() * 3) | 0,
      temp: !!o.temp,
    };
  }

  function resizeCanvas() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cvs.width = Math.round(W * dpr);
    cvs.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = leaves.filter(l => !l.temp).length;
    for (let i = base; i < baseCount(); i++) leaves.push(makeLeaf({ y: Math.random() * H * 1.2 - H * .2 }));
  }

  function burst(x, y, n) {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - .5) * 2.2;
      const sp = 2 + Math.random() * 4;
      leaves.push(makeLeaf({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, temp: true }));
    }
  }

  let wind = 0;
  function stepLeaves(dt, t, scrollVel) {
    ctx.clearRect(0, 0, W, H);
    if (!SPRITES.length) return;
    wind += ((.25 + Math.sin(t * .00025) * .35) - wind) * .02 * dt;

    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i];
      l.sway += .018 * dt;
      l.vx += ((wind + Math.sin(l.sway) * .7) * l.z - l.vx) * .025 * dt;
      l.vy += ((.35 + l.z * .6) - l.vy) * .025 * dt;
      l.x += l.vx * dt;
      l.y += l.vy * dt - scrollVel * .3 * l.z;
      l.rot += (l.vr + l.vx * .003) * dt;
      l.flip += l.vf * dt;

      if (l.temp) {
        if (l.y > H + 80 || l.x < -100 || l.x > W + 100 || l.y < -H) { leaves.splice(i, 1); continue; }
      } else {
        if (l.y > H + 60) { l.y = -60; l.x = Math.random() * W; }
        if (l.y < -160) { l.y = H + 50; l.x = Math.random() * W; }
        if (l.x > W + 60) l.x = -60;
        if (l.x < -60) l.x = W + 60;
      }

      const sp = SPRITES[l.sprite % SPRITES.length];
      const w = (sp.big ? 34 + l.s * 14 : 14 + l.s * 8) * l.z;
      const h = w * sp.ratio;
      const fx = Math.cos(l.flip);
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.scale(Math.abs(fx) < .1 ? .1 * Math.sign(fx || 1) : fx, 1);
      ctx.globalAlpha = .55 + .4 * l.z;
      ctx.drawImage(sp.c, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  // Antippen lässt ein paar Blätter aufwirbeln
  let tap = null;
  document.addEventListener("pointerdown", e => {
    tap = e.target.closest("a, button") ? null : { x: e.clientX, y: e.clientY, t: performance.now() };
  }, { passive: true });
  document.addEventListener("pointercancel", () => { tap = null; }, { passive: true });
  document.addEventListener("pointerup", e => {
    if (!tap) return;
    if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12 && performance.now() - tap.t < 500) {
      burst(e.clientX, e.clientY, 5);
      window.Ambience?.rustle(e.clientX / W, .7);
    }
    tap = null;
  }, { passive: true });

  /* ---------------------------------------------------------
     Hero-Parallax
     --------------------------------------------------------- */
  const names = $(".names");
  const bouquet = $(".bouquet");
  function updateHero(y) {
    if (y > H * 1.2) return;
    names.style.transform = `translate3d(0, ${y * .22}px, 0)`;
    bouquet.style.transform = `translate3d(0, ${y * .1}px, 0)`;
  }

  /* ---------------------------------------------------------
     Kranz, der sich beim Scrollen zusammensetzt
     --------------------------------------------------------- */
  const story = $("#story");
  const spin = $(".wreath-spin");
  const ring = $(".ring circle");
  const wreathLeaves = $(".wreath-leaves");
  const steps = $$(".step");

  // [Bild, Breite in % des Kranzes, Neigung, Radius-Versatz]
  const PATTERN = [
    ["maple", 22, 62, 0], ["leaf-a", 8, 78, 3], ["berries", 13, 48, 1], ["leaf-b", 8, 100, -3],
    ["leaf-a", 7.5, 70, 2], ["leaf-b", 8, 84, -1], ["maple", 17, 66, 1], ["leaf-a", 7.5, 104, -3],
    ["berries", 12, 56, 1], ["leaf-b", 8, 76, 2], ["leaf-a", 7.5, 92, -2], ["leaf-b", 7.5, 68, 2],
    ["maple", 19, 72, 0], ["leaf-a", 8, 98, -3], ["berries", 12, 52, 2], ["leaf-b", 8, 80, -1],
    ["leaf-a", 7.5, 66, 2], ["leaf-b", 7.5, 96, -2],
  ];
  const START = -130; // Startwinkel unten links – wie auf der Karte
  const wl = PATTERN.map(([src, w, tilt, dr], i) => {
    const el = document.createElement("div");
    el.className = "wl";
    el.style.setProperty("--w", `${w}%`);
    el.innerHTML = `<img src="assets/${src}.svg" alt="">`;
    wreathLeaves.appendChild(el);
    return { el, angle: START + i * (360 / PATTERN.length), tilt, dr, from: .06 + i * .033 };
  });

  let ringR = 0;
  function sizeWreath() {
    ringR = wreathLeaves.offsetWidth * .39;
    lastStoryP = -1;
  }

  let lastStoryP = -1, lastStep = -1;
  function updateStory() {
    const r = story.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - H));
    if (Math.abs(p - lastStoryP) < .0004) return;
    lastStoryP = p;

    ring.style.strokeDashoffset = 1 - range(p, .02, .64);
    spin.style.transform = `rotate(${-14 + p * 26}deg) scale(${.94 + range(p, .6, .95) * .06})`;

    wl.forEach(l => {
      const s = easeOutBack(range(p, l.from, l.from + .09));
      const R = ringR * (1 + l.dr / 100);
      // Fuß des Blattes sitzt auf dem Ring, das Blatt liegt leicht schräg am Kranz
      l.el.style.transform = `rotate(${l.angle}deg) translateY(${-R}px) rotate(${l.tilt}deg) scale(${s}) translate(0, -96%)`;
      l.el.style.opacity = s > 0 ? 1 : 0;
    });

    const idx = p < .2 ? 0 : p < .44 ? 1 : p < .68 ? 2 : 3;
    if (idx !== lastStep) {
      if (lastStep !== -1) window.Ambience?.chime();
      lastStep = idx;
    }
    steps.forEach((s, i) => s.classList.toggle("on", i === idx));
  }

  /* ---------------------------------------------------------
     Countdown
     --------------------------------------------------------- */
  const cdEls = Object.fromEntries($$("#countdown [data-u]").map(el => [el.dataset.u, el]));
  function updateCountdown() {
    let diff = Math.max(0, WEDDING - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5);  diff -= h * 36e5;
    const m = Math.floor(diff / 6e4);   diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    const vals = { d: String(d), h: String(h).padStart(2, "0"), m: String(m).padStart(2, "0"), s: String(s).padStart(2, "0") };
    for (const k in vals) {
      const el = cdEls[k];
      if (el.textContent !== vals[k]) {
        el.textContent = vals[k];
        if (!reduceMotion) { el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }
      }
    }
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);

  /* ---------------------------------------------------------
     Zeitstrahl
     --------------------------------------------------------- */
  const timeline = $(".timeline");
  const tItems = $$(".t-item");
  function updateTimeline() {
    const r = timeline.getBoundingClientRect();
    if (r.top > H || r.bottom < 0) return;
    const p = clamp((H * .62 - r.top) / r.height);
    timeline.style.setProperty("--progress", p);
    tItems.forEach(it => it.classList.toggle("on", it.offsetTop / r.height <= p + .02));
  }

  /* ---------------------------------------------------------
     Reveal
     --------------------------------------------------------- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        io.unobserve(en.target);
      });
    }, { threshold: .2, rootMargin: "0px 0px -6% 0px" });
    $$(".reveal").forEach(el => io.observe(el));
  } else {
    $$(".reveal").forEach(el => el.classList.add("in"));
  }

  /* ---------------------------------------------------------
     Zusage (Platzhalter)
     --------------------------------------------------------- */
  $("#rsvpBtn").addEventListener("click", () => {
    $("#rsvpNote").hidden = false;
    const r = $("#rsvpBtn").getBoundingClientRect();
    burst(r.left + r.width / 2, r.top, 8);
    window.Ambience?.chime();
  });

  /* ---------------------------------------------------------
     Hauptschleife
     --------------------------------------------------------- */
  let lastY = scrollY, lastT = performance.now(), vel = 0;
  let soundBtn = $("#soundBtn");
  function frame(now) {
    const dt = clamp((now - lastT) / 16.67, 0, 3);
    lastT = now;
    const y = scrollY;
    vel += ((y - lastY) - vel) * .5;
    lastY = y;

    updateHero(y);
    window.Ambience?.setScroll(Math.abs(vel));
    if (y > 120 && soundBtn) { soundBtn.classList.add("compact"); soundBtn = null; }
    updateStory();
    updateTimeline();
    if (!reduceMotion) stepLeaves(dt, now, clamp(vel, -50, 50));
    requestAnimationFrame(frame);
  }

  function onResize() {
    W = innerWidth;
    H = innerHeight;
    resizeCanvas();
    sizeWreath();
  }
  addEventListener("resize", onResize);
  onResize();
  requestAnimationFrame(frame);
})();
