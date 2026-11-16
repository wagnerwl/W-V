(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const easeInOut = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOutBack = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = innerWidth, H = innerHeight;

  /* ---------------------------------------------------------
     Titel in Buchstaben zerlegen
     --------------------------------------------------------- */
  $$(".split").forEach(el => {
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    let i = 0;
    el.innerHTML = text.split(" ").map(word =>
      `<span class="word" aria-hidden="true">${[...word].map(ch => `<span class="ch" style="--i:${i++}">${ch}</span>`).join("")}</span>`
    ).join(" ");
  });

  /* ---------------------------------------------------------
     Fallende Blätter (Canvas)
     --------------------------------------------------------- */
  const cvs = $("#leaves");
  const ctx = cvs.getContext("2d");
  let DPR = 1;

  const MAPLE = new Path2D("M50 2 L58 22 L70 14 L66 36 L86 26 L80 44 L98 46 L82 58 L88 66 L62 64 L56 80 L52 78 L52 98 L48 98 L48 78 L44 80 L38 64 L12 66 L18 58 L2 46 L20 44 L14 26 L34 36 L30 14 L42 22 Z");
  const OVAL = new Path2D("M50 4 C82 24 84 70 50 96 C16 70 18 24 50 4 Z");
  const RIB = new Path2D("M50 10 L50 92");
  const COLORS = ["#e8731c", "#c2410c", "#f4a63a", "#b91c1c", "#d97706", "#8a3b12", "#eab308", "#a3401a"];

  const leaves = [];
  let wind = 0, gust = 0;
  const baseCount = () => (reduceMotion ? 0 : W < 600 ? 16 : 28);

  function makeLeaf(opts = {}) {
    const z = .45 + Math.random() * .55;
    return {
      x: opts.x ?? Math.random() * W,
      y: opts.y ?? -40 - Math.random() * H,
      z,
      size: (16 + Math.random() * 16) * z,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - .5) * .05,
      flip: Math.random() * Math.PI * 2,
      vf: .02 + Math.random() * .05,
      sway: Math.random() * Math.PI * 2,
      vx: opts.vx ?? 0,
      vy: opts.vy ?? 0,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      shape: Math.random() < .6 ? MAPLE : OVAL,
      temp: !!opts.temp,
    };
  }

  function resizeCanvas() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    cvs.width = Math.round(W * DPR);
    cvs.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const want = baseCount();
    const base = leaves.filter(l => !l.temp).length;
    for (let i = base; i < want; i++) leaves.push(makeLeaf({ y: Math.random() * H * 1.2 - H * .2 }));
  }

  function burst(x, y, n = 10, power = 1) {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (3 + Math.random() * 6) * power;
      leaves.push(makeLeaf({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, temp: true }));
    }
  }

  function stepLeaves(dt, t, scrollVel) {
    ctx.clearRect(0, 0, W, H);
    gust *= Math.pow(.97, dt);
    const target = .35 + Math.sin(t * .0004) * .5 + gust;
    wind += (target - wind) * .04 * dt;

    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i];
      l.sway += .025 * dt;
      const tx = (wind * 1.6 + Math.sin(l.sway) * .9) * l.z;
      const ty = .5 + l.z * 1.1;
      l.vx += (tx - l.vx) * .03 * dt;
      l.vy += (ty - l.vy) * .03 * dt;
      l.x += l.vx * dt;
      l.y += l.vy * dt - scrollVel * .35 * l.z;
      l.rot += (l.vr + l.vx * .005) * dt;
      l.flip += l.vf * dt;

      if (l.temp) {
        if (l.y > H + 60 || l.x > W + 80 || l.x < -80 || l.y < -H) { leaves.splice(i, 1); continue; }
      } else {
        if (l.y > H + 40) { l.y = -40; l.x = Math.random() * W; }
        if (l.y < -140) { l.y = H + 30; l.x = Math.random() * W; }
        if (l.x > W + 40) l.x = -40;
        if (l.x < -40) l.x = W + 40;
      }

      const s = l.size / 100;
      const fx = Math.cos(l.flip);
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.scale(s * (Math.abs(fx) < .08 ? .08 : fx), s);
      ctx.translate(-50, -50);
      ctx.globalAlpha = .55 + .45 * l.z;
      ctx.fillStyle = l.color;
      ctx.fill(l.shape);
      if (fx < 0) { ctx.fillStyle = "rgba(40,10,0,.22)"; ctx.fill(l.shape); }
      ctx.strokeStyle = "rgba(60,20,0,.35)";
      ctx.lineWidth = 3;
      ctx.stroke(RIB);
      ctx.restore();
    }
  }

  /* ---------------------------------------------------------
     Tippen = Blätter-Explosion, Button = Sturm
     --------------------------------------------------------- */
  // Pointer-Events statt click: iOS feuert click nicht zuverlässig auf nicht-interaktiven Flächen
  let tap = null;
  document.addEventListener("pointerdown", e => {
    tap = e.target.closest("a, button") ? null : { x: e.clientX, y: e.clientY, t: performance.now() };
  }, { passive: true });
  document.addEventListener("pointercancel", () => { tap = null; }, { passive: true });
  document.addEventListener("pointerup", e => {
    if (!tap) return;
    const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
    if (moved < 12 && performance.now() - tap.t < 500) burst(e.clientX, e.clientY, 9);
    tap = null;
  }, { passive: true });

  const gustBtn = $("#gustBtn");
  gustBtn.addEventListener("click", () => {
    gust = 7;
    gustBtn.classList.remove("blow");
    void gustBtn.offsetWidth;
    gustBtn.classList.add("blow");
    if (reduceMotion) return;
    for (let i = 0; i < 26; i++) {
      leaves.push(makeLeaf({ x: -30 - Math.random() * 120, y: Math.random() * H, vx: 8 + Math.random() * 8, vy: -1 + Math.random() * 2, temp: true }));
    }
    if (navigator.vibrate) navigator.vibrate(30);
  });

  /* ---------------------------------------------------------
     Hero-Parallax
     --------------------------------------------------------- */
  const heroText = $(".hero-text");
  const heroSun = $(".hero-sun");
  const hills = [[$(".hill-3"), .12], [$(".hill-2"), .22], [$(".hill-1"), .34]];

  function updateHero(y) {
    if (y > H * 1.2) return;
    heroText.style.transform = `translate3d(0, ${y * .45}px, 0)`;
    heroText.style.opacity = 1 - clamp(y / (H * .6));
    heroSun.style.transform = `translate3d(0, ${y * .55}px, 0) scale(${1 + y / H * .3})`;
    hills.forEach(([el, f]) => { el.style.transform = `translate3d(0, ${-y * f}px, 0)`; });
  }

  /* ---------------------------------------------------------
     Kürbis wächst
     --------------------------------------------------------- */
  const grow = $("#grow");
  const pumpkin = $(".pumpkin");
  const sprout = $(".sprout");
  const seed = $(".seed");
  const vine = $(".pk-vine");
  const leaf = $(".pk-leaf");
  const face = $(".pk-face");
  const glow = $(".pk-glow");
  const halo = $(".halo");
  const pop = $(".pop");
  const skyDusk = $(".sky-dusk");
  const skyNight = $(".sky-night");
  const growSun = $(".grow-sun");
  const moon = $(".moon");
  const stars = $(".stars");
  const shade = $(".shade");
  const caption = $(".caption");
  const phaseNum = $("#phaseNum");
  const phaseTitle = $("#phaseTitle");
  const phaseText = $("#phaseText");
  const dots = $$(".dots i");
  const weightEl = $("#weight");

  const PHASES = [
    { at: 0,    title: "Ein kleiner Samen",  text: "Alles beginnt mit einem Kern in der warmen Erde." },
    { at: .1,   title: "Der erste Keim",     text: "Sonne und Regen wecken die kleine Pflanze." },
    { at: .26,  title: "Ein grüner Winzling", text: "Aus der Blüte wächst ein kleiner, grüner Kürbis." },
    { at: .46,  title: "Reifezeit",           text: "In der Spätsommersonne färbt er sich langsam orange." },
    { at: .64,  title: "Ein Riesenkürbis!",   text: "Prall, rund und bereit für die Ernte." },
    { at: .82,  title: "Halloween!",          text: "Geschnitzt und beleuchtet wird er zur Laterne." },
  ];

  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",")})`;
  const tri = (st, t) => (t < .5 ? mix(st[0], st[1], t * 2) : mix(st[1], st[2], (t - .5) * 2));
  const PAL = {
    dark:  ["#3f6b26", "#b8861a", "#c2500f"].map(hex),
    mid:   ["#5c8a32", "#d9a72a", "#e36d14"].map(hex),
    light: ["#7aa843", "#ecc045", "#f88f2c"].map(hex),
  };
  const fmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const fmtInt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

  let phase = -1;
  let lastGrowP = -1;

  function setPhase(i) {
    if (i === phase) return;
    const first = phase === -1;
    phase = i;
    const ph = PHASES[i];
    phaseNum.textContent = i + 1;
    phaseTitle.textContent = ph.title;
    phaseText.textContent = ph.text;
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
    if (first) return;
    caption.classList.remove("swap");
    void caption.offsetWidth;
    caption.classList.add("swap");
    if (!reduceMotion && pop.animate) {
      pop.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.07, .95)" }, { transform: "scale(.97, 1.04)" }, { transform: "scale(1)" }],
        { duration: 520, easing: "ease-out" }
      );
    }
    // Feier-Blätter, wenn der Kürbis groß bzw. zur Laterne wird
    if (i >= 4) {
      const r = pumpkin.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height * .55, i === 5 ? 18 : 12, 1.2);
    }
  }

  function updateGrow() {
    const r = grow.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - H));
    if (Math.abs(p - lastGrowP) < .0005) return;
    lastGrowP = p;

    // Samen & Keimling
    seed.style.opacity = 1 - range(p, .05, .12);
    const sp = range(p, .05, .2);
    sprout.style.transform = `scale(${easeOutBack(sp) * (sp > 0 ? 1 : 0)})`;
    sprout.style.opacity = 1 - range(p, .3, .38);

    // Kürbis
    const g = range(p, .2, .8);
    const scale = p < .2 ? 0 : lerp(.08, 1, easeInOut(g));
    pumpkin.style.transform = `scale(${scale})`;
    const c = range(p, .34, .68);
    pumpkin.style.setProperty("--pk-dark", tri(PAL.dark, c));
    pumpkin.style.setProperty("--pk-mid", tri(PAL.mid, c));
    pumpkin.style.setProperty("--pk-light", tri(PAL.light, c));
    vine.style.strokeDashoffset = 1 - range(p, .28, .6);
    leaf.style.transform = `scale(${easeOutBack(range(p, .26, .46))})`;

    // Gesicht & Leuchten
    face.style.opacity = range(p, .8, .85);
    const lit = range(p, .85, .93);
    glow.style.opacity = lit;
    halo.style.opacity = lit;

    // Himmel: Tag → Abend → Nacht
    const dusk = range(p, .42, .68);
    const night = range(p, .7, .88);
    skyDusk.style.opacity = dusk;
    skyNight.style.opacity = night;
    shade.style.opacity = night * (1 - lit * .35);
    growSun.style.transform = `translate3d(0, ${range(p, .3, .82) * H * .75}px, 0) scale(${1 + dusk * .25})`;
    stars.style.opacity = night;
    moon.style.opacity = night;
    moon.style.transform = `translate3d(0, ${(1 - night) * 60}px, 0)`;
    pumpkin.style.filter = night > 0
      ? `brightness(${1 - night * .35 + lit * .25}) drop-shadow(0 0 ${lit * 24}px rgba(255,170,60,${lit * .7}))`
      : "";

    // Gewicht (nur zum Spaß)
    const kg = p < .2 ? .0002 + p * .002 : .05 + 611.95 * Math.pow(g, 3);
    weightEl.textContent = kg < 1 ? `${fmtInt.format(kg * 1000)} g` : `${fmt.format(kg)} kg`;

    // Phase
    let idx = 0;
    PHASES.forEach((ph, k) => { if (p >= ph.at) idx = k; });
    setPhase(idx);
  }

  /* ---------------------------------------------------------
     Farben – horizontales Scrollen
     --------------------------------------------------------- */
  const colors = $("#colors");
  const track = $(".track");
  const swatches = $$(".swatch");
  let colExtra = 0, swCenters = [], lastColP = -1;

  function sizeColors() {
    track.style.transform = "";
    colExtra = Math.max(0, track.offsetWidth - W);
    colors.style.height = `${colExtra + H * 1.15}px`;
    swCenters = swatches.map(s => s.offsetLeft + s.offsetWidth / 2);
    lastColP = -1;
  }

  function updateColors() {
    const r = colors.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - H));
    if (Math.abs(p - lastColP) < .0005) return;
    lastColP = p;
    const x = p * colExtra;
    track.style.transform = `translate3d(${-x}px, 0, 0)`;
    swatches.forEach((s, i) => {
      const d = clamp((swCenters[i] - x - W / 2) / W, -1, 1);
      s.style.transform = `translateY(${Math.abs(d) * 40}px) rotate(${d * 8}deg) scale(${1 - Math.abs(d) * .1})`;
      s.style.opacity = 1 - Math.abs(d) * .45;
    });
  }

  /* ---------------------------------------------------------
     Reveal + Zähler
     --------------------------------------------------------- */
  function countUp(el) {
    const end = +el.dataset.count;
    const pre = el.dataset.prefix || "";
    const suf = el.dataset.suffix || "";
    if (reduceMotion) { el.textContent = pre + end + suf; return; }
    const t0 = performance.now(), dur = 1600;
    const tick = now => {
      const t = clamp((now - t0) / dur);
      el.textContent = pre + Math.round(end * (1 - Math.pow(1 - t, 3))) + suf;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        $$("[data-count]", en.target).forEach(countUp);
        io.unobserve(en.target);
      });
    }, { threshold: .2, rootMargin: "0px 0px -8% 0px" });
    $$(".reveal").forEach(el => io.observe(el));
  } else {
    $$(".reveal").forEach(el => { el.classList.add("in"); $$("[data-count]", el).forEach(countUp); });
  }

  /* ---------------------------------------------------------
     Glühwürmchen
     --------------------------------------------------------- */
  const ff = $(".fireflies");
  for (let i = 0; i < 18; i++) {
    const f = document.createElement("i");
    f.style.left = `${Math.random() * 100}%`;
    f.style.top = `${Math.random() * 100}%`;
    f.style.setProperty("--t", `${6 + Math.random() * 6}s`);
    f.style.setProperty("--dl", `${-Math.random() * 10}s`);
    f.style.setProperty("--x", `${(Math.random() - .5) * 120}px`);
    f.style.setProperty("--y", `${(Math.random() - .5) * 120}px`);
    ff.appendChild(f);
  }

  /* ---------------------------------------------------------
     Hauptschleife
     --------------------------------------------------------- */
  const bar = $(".progress span");
  let lastY = scrollY, lastT = performance.now(), smoothVel = 0;

  function frame(now) {
    const dt = clamp((now - lastT) / 16.67, 0, 3);
    lastT = now;
    const y = scrollY;
    const vel = y - lastY;
    lastY = y;
    smoothVel += (vel - smoothVel) * .5;

    updateHero(y);
    updateGrow();
    updateColors();

    const max = document.documentElement.scrollHeight - H;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    if (!reduceMotion) stepLeaves(dt, now, clamp(smoothVel, -60, 60));
    requestAnimationFrame(frame);
  }

  let sizedW = 0, sizedH = 0;
  function onResize() {
    W = innerWidth;
    H = innerHeight;
    resizeCanvas();
    lastGrowP = -1;
    // Die mobile Adressleiste ändert beim Scrollen die Höhe ein wenig –
    // dann nicht neu layouten, sonst springt die Seite.
    if (W !== sizedW || Math.abs(H - sizedH) > 160) {
      sizedW = W; sizedH = H;
      sizeColors();
    }
  }

  addEventListener("resize", onResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeColors);
  onResize();
  requestAnimationFrame(frame);
})();
