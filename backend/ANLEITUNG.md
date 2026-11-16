# Persönliche Einladungen & Zusagen einrichten

So funktioniert es:

```
Gast öffnet die Seite ──► gibt Passwort ein ──► Google Apps Script prüft es
                                                   │
                         Google-Tabelle „Gäste“ ◄──┘ (Passwort, Namen, was erlaubt ist)
                         Google-Tabelle „Antworten“ ◄── Zusage/Absage wird gespeichert
```

Die Webseite auf GitHub Pages ist öffentlich, enthält aber **keine** Gästedaten.
Namen, Passwörter und Antworten liegen nur in eurer Google-Tabelle. Das Skript prüft die Passwörter,
also das, was die Webseite mit der Tabelle verbindet.

Dauer: ca. 15 Minuten.

---

## 1. Google-Tabelle anlegen

1. Mit eurem **privaten** Google-Konto anmelden, nicht mit dem Uni-Konto. Uni-Konten werden nach
   dem Studium gelöscht, und die Uni kann Web-Apps für „Jeder“ sperren.
2. Auf <https://sheets.new> eine neue Tabelle anlegen und z. B. „Hochzeit – Gäste“ nennen.

## 2. Skript einfügen

1. In der Tabelle: **Erweiterungen → Apps Script**.
2. Den vorhandenen Inhalt von `Code.gs` komplett löschen.
3. Den Inhalt von [`backend/Code.gs`](Code.gs) aus diesem Repository hineinkopieren.
4. Auf das Speichern-Symbol (💾) klicken.

## 3. Tabellen einrichten

1. Zur Tabelle zurückkehren und die Seite **neu laden**. Oben erscheint das Menü **„Hochzeit“**.
2. **Hochzeit → 1. Tabellen einrichten** wählen.
3. Google fragt beim ersten Mal nach Berechtigungen:
   - Konto auswählen
   - Bei „Google hat diese App nicht überprüft“: **Erweitert → Zu … wechseln (unsicher)**.
     Das ist normal, denn es ist euer eigenes Skript.
   - **Zulassen**
4. Danach gibt es die Blätter **„Gäste“** (mit 3 Beispielzeilen) und **„Antworten“**.

## 4. Gäste eintragen

Eine Zeile pro Einladung, also pro Gast, Paar oder Familie:

| Spalte | Bedeutung | Beispiel |
|---|---|---|
| **ID** | leer lassen, wird automatisch erzeugt | |
| **Passwort** | leer lassen, wird automatisch erzeugt (oder selbst eintragen) | `Ahorn-Laterne-482` |
| **Persönlicher Link** | wird automatisch erzeugt, öffnet die Einladung direkt | |
| **Anrede** | so werden die Gäste begrüßt | `Liebe Anna, lieber Tom` |
| **Personen** | alle eingeladenen Erwachsenen, mit Komma getrennt | `Anna, Tom` |
| **Begleitung erlaubt** | `ja`, wenn ein Einzelgast jemanden mitbringen darf | `ja` / `nein` |
| **Max. Kinder** | wie viele Kinder höchstens mitkommen dürfen (0 = keine) | `2` |
| **Übernachtung angeboten** | `ja`, wenn die Gäste nach einer Übernachtung gefragt werden sollen | `ja` / `nein` |
| **Notiz (nur für euch)** | sehen die Gäste nicht | |

Die Seite redet die Gäste automatisch mit **„du“** an, wenn eine einzelne Person ohne Kinder eingeladen ist,
sonst mit **„ihr“**.

Die drei Beispielzeilen löschen oder überschreiben.

## 5. Passwörter und Links erzeugen

**Hochzeit → 2. IDs, Passwörter & Links erzeugen**

- Jede Zeile bekommt eine ID, ein Passwort wie `Kastanie-Mond-317` und einen persönlichen Link.
- Bereits vorhandene Passwörter bleiben unverändert. Ihr könnt den Menüpunkt also jederzeit wieder
  ausführen, wenn neue Gäste dazukommen.
- Bei der Eingabe sind Groß-/Kleinschreibung, Leerzeichen und Bindestriche egal.

## 6. Als Web-App veröffentlichen

1. Im Apps-Script-Editor: **Bereitstellen → Neue Bereitstellung**.
2. Beim Zahnrad neben „Typ auswählen“ **Web-App** wählen.
3. Einstellungen:
   - Beschreibung: z. B. `Zusagen`
   - **Ausführen als: Ich**
   - **Zugriff: Jeder**
4. **Bereitstellen** wählen und die **Web-App-URL** kopieren. Sie endet auf `/exec`.

> „Jeder“ heißt nur: Die Webseite darf das Skript aufrufen. Ohne gültiges Passwort bekommt
> niemand Daten. Nach 40 falschen Versuchen in 10 Minuten sperrt das Skript außerdem kurz.

## 7. Webseite verbinden

In [`config.js`](../config.js) die URL eintragen:

```js
apiUrl: "https://script.google.com/macros/s/……/exec",
```

Danach committen und pushen, oder Claude bitten, das zu übernehmen.
Nach ca. einer Minute ist das Formular auf der Seite aktiv.

## 8. Testen

1. Einen **persönlichen Link** aus dem Blatt „Gäste“ im Handy öffnen. Die Einladung sollte sich mit
   der Anrede öffnen.
2. Eine Testantwort senden. Sie erscheint im Blatt **„Antworten“**, und ihr bekommt eine E-Mail.
3. Die Testzeile in „Antworten“ danach löschen.

---

## Für die Einladungskarten

Zwei Möglichkeiten, die sich kombinieren lassen:

- **Passwort auf die Karte drucken.** Gäste öffnen die Seite und tippen es ein.
- **QR-Code mit dem persönlichen Link.** Der Link enthält das Passwort, Gäste müssen dann nichts eintippen.
  Den QR-Code am besten mit einem Programm erzeugen, das offline arbeitet, oder mit dem Tool der
  Druckerei. Bei Online-QR-Generatoren landet der Link mit dem Passwort auf fremden Servern.

Die Seite merkt sich das Passwort auf dem Gerät des Gastes. Beim nächsten Besuch ist die Einladung
direkt offen. Über „Nicht eure Einladung? Abmelden“ lässt sich das zurücksetzen.

## Gut zu wissen

- **Antworten ändern:** Gäste können ihre Antwort jederzeit ändern. Dann wird ihre Zeile in
  „Antworten“ überschrieben, es gibt also immer nur eine Zeile pro Einladung.
- **E-Mail-Benachrichtigung** abschalten: In `Code.gs` `NOTIFY: false` setzen.
- **Einladung zurückziehen:** Passwort in der Zeile löschen oder ändern. Der alte Zugang funktioniert
  dann nicht mehr.
- **Übernachtungs-Optionen** wie „Samstag → Sonntag“ stehen in `config.js` unter `stayOptions`.
- **Änderungen am Skript** werden erst nach einer neuen Version aktiv:
  **Bereitstellen → Bereitstellungen verwalten → ✏️ Bearbeiten → Version: Neue Version → Bereitstellen**.
  Die URL bleibt dabei gleich.
- Nicht die Spalte **„Daten (technisch – nicht ändern)“** im Blatt „Antworten“ bearbeiten. Daraus liest
  die Seite die bisherige Antwort, wenn Gäste sie ändern wollen. Sie ist standardmäßig ausgeblendet.
- Das Blatt „Antworten“ könnt ihr filtern, sortieren und für Sitzplan oder Catering nutzen. Die Spalte
  „Erwachsene gesamt“ zählt Gäste plus Begleitung.
