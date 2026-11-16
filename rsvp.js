/* =========================================================
   Persönliche Einladung & Zusage
   - Gäste öffnen ihre Einladung mit dem Passwort von der Karte
     (oder direkt über den persönlichen Link / QR-Code: …/#pw=Passwort)
   - Das Passwort wird im Backend (Google Apps Script) geprüft,
     persönliche Daten stehen nie im öffentlichen Code der Seite.
   ========================================================= */
(() => {
  "use strict";

  const cfg = window.RSVP_CONFIG || {};
  const API = String(cfg.apiUrl || "").trim();
  const STAY = cfg.stayOptions && cfg.stayOptions.length ? cfg.stayOptions : ["Nein, danke"];
  const DEADLINE = cfg.deadline || "";
  const STORE_KEY = "wv-invite";

  const $ = s => document.querySelector(s);
  const el = (tag, attrs = {}, text) => {
    const n = document.createElement(tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  };

  const views = { login: $("#rsvpLogin"), form: $("#rsvpForm"), done: $("#rsvpDone") };
  if (!views.login) return;

  const store = {
    get() { try { return localStorage.getItem(STORE_KEY) || ""; } catch (e) { return ""; } },
    set(v) { try { localStorage.setItem(STORE_KEY, v); } catch (e) { /* privat */ } },
    clear() { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* privat */ } },
  };

  let password = "";
  let guest = null;
  let answer = null;
  let kids = 0;

  // „du“ oder „ihr“ – je nachdem, wer eingeladen ist
  const T = (du, ihr) => (guest && guest.plural ? ihr : du);

  const ERR = {
    wrong_password: "Das Passwort stimmt leider nicht. Bitte prüft die Schreibweise auf eurer Karte.",
    locked: "Zu viele Versuche – bitte versucht es in ein paar Minuten noch einmal.",
    server: "Da ist leider etwas schiefgelaufen. Bitte versucht es später noch einmal.",
    network: "Keine Verbindung. Bitte prüft eure Internetverbindung und versucht es erneut.",
    setup: "Das Antwortformular wird gerade eingerichtet – bitte schaut bald wieder vorbei.",
  };

  function show(name) {
    for (const k in views) views[k].hidden = k !== name;
  }
  function msg(sel, text) {
    $(sel).textContent = text || "";
  }
  function busy(btn, on, label) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.disabled = on;
    btn.textContent = on ? label : btn.dataset.label;
  }

  async function api(action, extra) {
    // text/plain-Body = kein CORS-Preflight; Apps Script antwortet mit JSON
    const res = await fetch(API, { method: "POST", body: JSON.stringify(Object.assign({ action, password }, extra)) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  /* ---------- Anmelden ---------- */
  const loginBtn = $("#loginBtn");

  async function login(pw, silent) {
    if (!API) { if (!silent) msg("#loginMsg", ERR.setup); return; }
    password = pw;
    msg("#loginMsg", "");
    busy(loginBtn, true, "Einen Moment …");
    try {
      const r = await api("login");
      if (!r.ok) {
        if (r.error === "wrong_password") store.clear();
        if (!silent) msg("#loginMsg", ERR[r.error] || ERR.server);
        return;
      }
      store.set(pw);
      guest = r.guest;
      answer = r.answer;
      personalize();
      if (answer) renderDone(); else renderForm(null);
    } catch (e) {
      if (!silent) msg("#loginMsg", ERR.network);
    } finally {
      busy(loginBtn, false);
    }
  }

  $("#loginForm").addEventListener("submit", e => {
    e.preventDefault();
    const pw = $("#pw").value.trim();
    if (!pw) { msg("#loginMsg", "Bitte gebt euer Passwort ein."); return; }
    login(pw, false);
  });

  function personalize() {
    const hero = $("#heroGreet");
    if (hero) { hero.textContent = guest.anrede; hero.hidden = false; }
    $("#greet").textContent = guest.anrede + ",";
    $("#doneGreet").textContent = guest.anrede + ",";
  }

  $("#logout").addEventListener("click", () => {
    store.clear();
    password = ""; guest = null; answer = null;
    const hero = $("#heroGreet");
    if (hero) hero.hidden = true;
    $("#pw").value = "";
    show("login");
  });

  /* ---------- Formular ---------- */
  const form = $("#answerForm");

  function renderForm(prev) {
    $("#formTitle").textContent = T("Bist du dabei?", "Seid ihr dabei?");
    $("#yesLabel").textContent = T("Ich komme gerne", "Wir kommen gerne");
    $("#noLabel").textContent = T("Ich kann leider nicht", "Wir können leider nicht");

    form.reset();
    if (prev) form.querySelector(`input[name="attending"][value="${prev.attending ? "yes" : "no"}"]`).checked = true;

    // Wer kommt? (nur wenn mehrere Personen eingeladen sind)
    const box = $("#persons");
    box.textContent = "";
    guest.persons.forEach(name => {
      const label = el("label", { class: "check" });
      const input = el("input", { type: "checkbox", name: "person" });
      input.value = name;
      input.checked = prev ? prev.persons.includes(name) : true;
      label.append(input, el("span", {}, name));
      box.append(label);
    });
    $("#personsField").hidden = guest.persons.length < 2;

    // Begleitung
    $("#companionField").hidden = !guest.companionAllowed;
    $("#companion").checked = !!(prev && prev.companion);
    $("#companionName").value = prev && prev.companion && prev.companion !== "ja" ? prev.companion : "";

    // Kinder
    $("#kidsField").hidden = !(guest.maxKids > 0);
    $("#kidsMax").textContent = guest.maxKids > 1 ? `(bis zu ${guest.maxKids})` : "";
    setKids(prev ? prev.kids : 0);
    $("#kidsInfo").value = prev ? prev.kidsInfo || "" : "";

    // Übernachtung
    const stay = $("#stayOptions");
    stay.textContent = "";
    STAY.forEach((opt, i) => {
      const label = el("label", { class: "pill small" });
      const input = el("input", { type: "radio", name: "stay" });
      input.value = opt;
      input.checked = prev && prev.stay ? prev.stay === opt : i === 0;
      label.append(input, el("span", {}, opt));
      stay.append(label);
    });
    $("#stayField").hidden = !guest.stayOffered;

    $("#food").value = prev ? prev.food || "" : "";
    $("#message").value = prev ? prev.message || "" : "";

    syncVisibility();
    msg("#answerMsg", "");
    show("form");
  }

  function setKids(n) {
    kids = Math.max(0, Math.min(guest ? guest.maxKids : 0, n));
    $("#kidsCount").textContent = kids;
    $("#kidsInfoWrap").hidden = kids === 0;
  }
  $$("#kidsField [data-step]").forEach(b => b.addEventListener("click", () => setKids(kids + Number(b.dataset.step))));

  function syncVisibility() {
    const att = form.querySelector('input[name="attending"]:checked');
    $("#yesFields").hidden = !att || att.value !== "yes";
    $("#companionNameWrap").hidden = !$("#companion").checked;
  }
  form.addEventListener("change", syncVisibility);

  function collect() {
    const att = form.querySelector('input[name="attending"]:checked');
    if (!att) return { error: T("Bitte wähle aus, ob du kommst.", "Bitte wählt aus, ob ihr kommt.") };
    const attending = att.value === "yes";
    const persons = guest.persons.length < 2
      ? guest.persons.slice()
      : [...form.querySelectorAll('input[name="person"]:checked')].map(i => i.value);
    if (attending && persons.length === 0) return { error: "Bitte wählt aus, wer von euch kommt." };
    const stay = form.querySelector('input[name="stay"]:checked');
    return {
      answer: {
        attending,
        persons,
        companion: $("#companion").checked,
        companionName: $("#companionName").value.trim(),
        kids,
        kidsInfo: $("#kidsInfo").value.trim(),
        stay: guest.stayOffered && stay ? stay.value : "",
        food: $("#food").value.trim(),
        message: $("#message").value.trim(),
      },
    };
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const c = collect();
    if (c.error) { msg("#answerMsg", c.error); return; }
    const btn = $("#sendBtn");
    busy(btn, true, "Wird gesendet …");
    msg("#answerMsg", "");
    try {
      const r = await api("rsvp", { answer: c.answer });
      if (!r.ok) {
        msg("#answerMsg", ERR[r.error] || ERR.server);
        if (r.error === "wrong_password") { store.clear(); show("login"); }
        return;
      }
      answer = r.answer;
      renderDone();
      $("#rsvp").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      msg("#answerMsg", ERR.network);
    } finally {
      busy(btn, false);
    }
  });

  /* ---------- Bestätigung ---------- */
  function renderDone() {
    const a = answer;
    $("#doneTitle").textContent = a.attending
      ? T("Schön, dass du dabei bist!", "Schön, dass ihr dabei seid!")
      : T("Schade, dass du nicht kommen kannst", "Schade, dass ihr nicht kommen könnt");

    const list = $("#doneList");
    list.textContent = "";
    const add = (k, v) => { if (v) list.append(el("dt", {}, k), el("dd", {}, v)); };
    if (a.attending) {
      if (guest.persons.length > 1) add("Es kommen", a.persons.join(", "));
      if (a.companion) add("Begleitung", a.companion === "ja" ? "ja" : a.companion);
      if (a.kids) add("Kinder", a.kids + (a.kidsInfo ? ` (${a.kidsInfo})` : ""));
      if (guest.stayOffered && a.stay) add("Übernachtung", a.stay);
      add("Essen", a.food);
    }
    add("Nachricht", a.message);
    list.hidden = !list.childElementCount;

    $("#doneText").textContent = a.attending
      ? T("Wir freuen uns sehr auf dich.", "Wir freuen uns sehr auf euch.")
      : T("Danke, dass du uns Bescheid gegeben hast – wir denken an dich.", "Danke, dass ihr uns Bescheid gegeben habt – wir denken an euch.");
    $("#doneNote").textContent = DEADLINE
      ? T(`Du kannst deine Antwort bis zum ${DEADLINE} jederzeit ändern.`, `Ihr könnt eure Antwort bis zum ${DEADLINE} jederzeit ändern.`)
      : "";
    show("done");
  }

  $("#editAnswer").addEventListener("click", () => renderForm(answer));

  function $$(s) { return [...document.querySelectorAll(s)]; }

  /* ---------- Start ---------- */
  if (DEADLINE) $("#loginDeadline").textContent = `Um Antwort wird gebeten bis zum ${DEADLINE}.`;

  // Persönlicher Link / QR-Code: …/#pw=Passwort  → automatisch öffnen, Passwort aus der Adresszeile entfernen
  const m = /^#pw=(.+)$/.exec(location.hash);
  if (m) {
    const pw = decodeURIComponent(m[1]);
    history.replaceState(null, "", location.pathname + location.search);
    $("#pw").value = pw;
    login(pw, false);
  } else {
    const saved = store.get();
    if (saved) login(saved, true);
  }
})();
