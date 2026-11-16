/**
 * Hochzeit Veronika & Wladimir – Backend für die persönlichen Einladungen
 *
 * Läuft als Google Apps Script direkt in eurer Google-Tabelle.
 * - Blatt „Gäste“:     wer eingeladen ist, Passwort, was erlaubt ist (nur ihr seht das)
 * - Blatt „Antworten“: die Zusagen/Absagen der Gäste
 *
 * Die Webseite schickt das Passwort hierher. Nur wenn es zu einem Gast passt,
 * bekommt sie dessen persönliche Daten zurück bzw. darf eine Antwort speichern.
 * Einrichtung: siehe backend/ANLEITUNG.md
 */

const CONFIG = {
  SITE_URL: 'https://wagnerwl.github.io/W-V/',
  NOTIFY: true,       // E-Mail an euch bei jeder neuen oder geänderten Antwort
  MAX_FAILS: 40,      // falsche Passwörter pro 10 Minuten, danach kurze Sperre (Schutz vor Durchprobieren)
};

const GUESTS = 'Gäste';
const ANSWERS = 'Antworten';

const G = {
  id: 'ID',
  pw: 'Passwort',
  link: 'Persönlicher Link',
  anrede: 'Anrede',
  persons: 'Personen',
  companion: 'Begleitung erlaubt',
  kids: 'Max. Kinder',
  stay: 'Übernachtung angeboten',
  note: 'Notiz (nur für euch)',
};

const A_HEADERS = [
  'ID', 'Anrede', 'Zuletzt geändert', 'Zusage', 'Wer kommt', 'Erwachsene gesamt',
  'Begleitung', 'Kinder', 'Kinder (Namen/Alter)', 'Übernachtung', 'Essen/Allergien',
  'Nachricht', 'Daten (technisch – nicht ändern)',
];

const WORDS = [
  'Ahorn', 'Apfel', 'Birne', 'Eiche', 'Herbst', 'Kastanie', 'Kerze', 'Laterne', 'Laub', 'Nebel',
  'Walnuss', 'Zimt', 'Moos', 'Feder', 'Hagebutte', 'Sonne', 'Wind', 'Linde', 'Birke', 'Eichel',
  'Pilz', 'Ernte', 'Garten', 'Wolke', 'Fuchs', 'Igel', 'Rose', 'Mond', 'Stern', 'Ring',
  'Kranz', 'Gold', 'Honig', 'Beere', 'Traube', 'Tanne', 'Zweig', 'Blatt', 'Feuer', 'Schal',
];

/* =========================================================
   Menü in der Tabelle
   ========================================================= */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Hochzeit')
    .addItem('1. Tabellen einrichten', 'setup')
    .addItem('2. IDs, Passwörter & Links erzeugen', 'generateCredentials')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  let g = ss.getSheetByName(GUESTS);
  if (!g) {
    g = ss.insertSheet(GUESTS, 0);
    const headers = Object.values(G);
    g.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f6eadc');
    g.setFrozenRows(1);
    const example = (anrede, persons, companion, kids, stay, note) => {
      const row = {};
      row[G.anrede] = anrede; row[G.persons] = persons; row[G.companion] = companion;
      row[G.kids] = kids; row[G.stay] = stay; row[G.note] = note;
      return headers.map(h => row[h] ?? '');
    };
    g.getRange(2, 1, 3, headers.length).setValues([
      example('Liebe Anna, lieber Tom', 'Anna, Tom', 'nein', 0, 'ja', 'Beispiel – überschreiben oder löschen'),
      example('Lieber Max', 'Max', 'ja', 0, 'nein', 'Beispiel: Einzelgast mit Begleitung'),
      example('Liebe Familie Müller', 'Julia, Stefan', 'nein', 2, 'ja', 'Beispiel: Familie mit bis zu 2 Kindern'),
    ]);
    g.autoResizeColumns(1, headers.length);
  }
  let a = ss.getSheetByName(ANSWERS);
  if (!a) {
    a = ss.insertSheet(ANSWERS, 1);
    a.getRange(1, 1, 1, A_HEADERS.length).setValues([A_HEADERS]).setFontWeight('bold').setBackground('#f6eadc');
    a.setFrozenRows(1);
    a.hideColumns(A_HEADERS.length);
  }
  SpreadsheetApp.getUi().alert(
    'Fertig! Tragt jetzt eure Gäste im Blatt „Gäste“ ein (Spalten Anrede, Personen, Begleitung erlaubt, Max. Kinder, Übernachtung angeboten) ' +
    'und wählt danach „Hochzeit → 2. IDs, Passwörter & Links erzeugen“.'
  );
}

/** Füllt leere IDs und Passwörter auf und schreibt den persönlichen Link (für QR-Codes). */
function generateCredentials() {
  const sh = SpreadsheetApp.getActive().getSheetByName(GUESTS);
  const data = sh.getDataRange().getValues();
  const col = headerIndex(data[0]);
  const used = new Set(data.slice(1).map(r => norm(r[col[G.pw]])).filter(Boolean));
  let created = 0;

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!String(r[col[G.persons]]).trim()) continue;
    if (!String(r[col[G.id]]).trim()) r[col[G.id]] = Utilities.getUuid().slice(0, 8);
    if (!String(r[col[G.pw]]).trim()) {
      let pw;
      do { pw = makePassword(); } while (used.has(norm(pw)));
      used.add(norm(pw));
      r[col[G.pw]] = pw;
      created++;
    }
    r[col[G.link]] = CONFIG.SITE_URL + '#pw=' + encodeURIComponent(r[col[G.pw]]);
  }
  sh.getRange(1, 1, data.length, data[0].length).setValues(data);

  const dupes = findDuplicatePasswords(data, col);
  SpreadsheetApp.getUi().alert(
    created + ' neue Passwörter erzeugt.' +
    (dupes.length ? '\n\nACHTUNG – diese Passwörter kommen doppelt vor, bitte ändern: ' + dupes.join(', ') : '')
  );
}

function makePassword() {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  let a = pick(), b = pick();
  while (b === a) b = pick();
  return a + '-' + b + '-' + (100 + Math.floor(Math.random() * 900));
}

function findDuplicatePasswords(data, col) {
  const seen = {}, dupes = [];
  data.slice(1).forEach(r => {
    const p = norm(r[col[G.pw]]);
    if (!p) return;
    if (seen[p]) dupes.push(r[col[G.pw]]);
    seen[p] = true;
  });
  return dupes;
}

/* =========================================================
   Web-App (wird von der Webseite aufgerufen)
   ========================================================= */
function doGet() {
  return json({ ok: true, service: 'hochzeit-rsvp' });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (tooManyFails()) return json({ ok: false, error: 'locked' });

    const guest = findGuest(req.password);
    if (!guest) {
      addFail();
      Utilities.sleep(700);
      return json({ ok: false, error: 'wrong_password' });
    }

    if (req.action === 'login') {
      return json({ ok: true, guest: publicGuest(guest), answer: readAnswer(guest.id) });
    }
    if (req.action === 'rsvp') {
      const answer = cleanAnswer(req.answer || {}, guest);
      saveAnswer(guest, answer);
      notify(guest, answer);
      return json({ ok: true, answer: answer });
    }
    return json({ ok: false, error: 'unknown_action' });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'server' });
  }
}

/* =========================================================
   Gäste
   ========================================================= */
function findGuest(password) {
  const p = norm(password);
  if (!p) return null;
  const data = SpreadsheetApp.getActive().getSheetByName(GUESTS).getDataRange().getValues();
  const col = headerIndex(data[0]);
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (norm(r[col[G.pw]]) !== p || !String(r[col[G.id]]).trim()) continue;
    const persons = String(r[col[G.persons]]).split(/\s*(?:,|;|&|\bund\b)\s*/).map(s => s.trim()).filter(Boolean);
    return {
      id: String(r[col[G.id]]).trim(),
      anrede: String(r[col[G.anrede]]).trim(),
      persons: persons,
      companion: yes(r[col[G.companion]]),
      maxKids: Math.max(0, parseInt(r[col[G.kids]], 10) || 0),
      stay: yes(r[col[G.stay]]),
    };
  }
  return null;
}

function publicGuest(g) {
  return {
    anrede: g.anrede,
    persons: g.persons,
    companionAllowed: g.companion,
    maxKids: g.maxKids,
    stayOffered: g.stay,
    plural: g.persons.length > 1 || g.maxKids > 0,
  };
}

/* =========================================================
   Antworten
   ========================================================= */
function cleanAnswer(a, g) {
  const attending = a.attending === true;
  let persons = [];
  if (attending) {
    persons = Array.isArray(a.persons) ? a.persons.filter(p => g.persons.indexOf(p) !== -1) : [];
    if (g.persons.length === 1) persons = g.persons.slice();
  }
  const companion = attending && g.companion && a.companion ? (text(a.companionName, 80) || 'ja') : '';
  const kids = attending ? Math.min(g.maxKids, Math.max(0, parseInt(a.kids, 10) || 0)) : 0;
  return {
    attending: attending,
    persons: persons,
    companion: companion,
    kids: kids,
    kidsInfo: kids ? text(a.kidsInfo, 200) : '',
    stay: attending && g.stay ? text(a.stay, 40) : '',
    food: attending ? text(a.food, 300) : '',
    message: text(a.message, 1000),
  };
}

function saveAnswer(g, a) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(ANSWERS);
    const row = [
      g.id,
      g.anrede,
      new Date(),
      a.attending ? 'Zusage' : 'Absage',
      a.persons.join(', '),
      a.persons.length + (a.companion ? 1 : 0),
      a.companion,
      a.kids,
      a.kidsInfo,
      a.stay,
      a.food,
      a.message,
      JSON.stringify(a),
    ].map(safe);
    const ids = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues().map(r => String(r[0]));
    const idx = ids.indexOf(g.id);
    if (idx > 0) sh.getRange(idx + 1, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

function readAnswer(id) {
  const sh = SpreadsheetApp.getActive().getSheetByName(ANSWERS);
  if (sh.getLastRow() < 2) return null;
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, A_HEADERS.length).getValues();
  const r = data.find(row => String(row[0]) === id);
  if (!r) return null;
  try { return JSON.parse(String(r[A_HEADERS.length - 1]).replace(/^'/, '')); } catch (e) { return null; }
}

function notify(g, a) {
  if (!CONFIG.NOTIFY) return;
  try {
    const lines = [
      g.anrede,
      a.attending ? 'ZUSAGE' : 'ABSAGE',
      a.persons.length ? 'Es kommen: ' + a.persons.join(', ') : '',
      a.companion ? 'Begleitung: ' + a.companion : '',
      a.kids ? 'Kinder: ' + a.kids + (a.kidsInfo ? ' (' + a.kidsInfo + ')' : '') : '',
      a.stay ? 'Übernachtung: ' + a.stay : '',
      a.food ? 'Essen/Allergien: ' + a.food : '',
      a.message ? '\nNachricht:\n' + a.message : '',
      '\nAlle Antworten: ' + SpreadsheetApp.getActive().getUrl(),
    ].filter(Boolean);
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      'Hochzeit: ' + (a.attending ? 'Zusage' : 'Absage') + ' – ' + g.anrede,
      lines.join('\n')
    );
  } catch (e) {
    console.error('Mail fehlgeschlagen', e);
  }
}

/* =========================================================
   Schutz vor Durchprobieren
   ========================================================= */
function tooManyFails() {
  return Number(CacheService.getScriptCache().get('fails') || 0) >= CONFIG.MAX_FAILS;
}
function addFail() {
  const c = CacheService.getScriptCache();
  c.put('fails', String(Number(c.get('fails') || 0) + 1), 600);
}

/* =========================================================
   Hilfsfunktionen
   ========================================================= */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function headerIndex(row) {
  const idx = {};
  row.forEach((h, i) => { idx[String(h).trim()] = i; });
  Object.values(G).forEach(h => {
    if (!(h in idx)) throw new Error('Spalte fehlt im Blatt „' + GUESTS + '“: ' + h);
  });
  return idx;
}
// Groß-/Kleinschreibung, Leerzeichen und Bindestriche beim Passwort egal
function norm(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
}
function yes(v) {
  return v === true || /^(ja|j|yes|x|1|true|wahr)$/i.test(String(v).trim());
}
function text(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}
// verhindert, dass Eingaben als Tabellenformel ausgeführt werden
function safe(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}
