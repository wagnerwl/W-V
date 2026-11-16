# 🎃 Goldener Herbst

Eine für Handys optimierte Herbst-Webseite mit Scroll-Animationen: Beim Scrollen wächst ein Kürbis vom Samen bis zur leuchtenden Halloween-Laterne. Dazu gibt es fallende Blätter, Parallax-Hügel, eine horizontal scrollende Farbpalette und Glühwürmchen.

Reines HTML/CSS/JS – kein Build-Schritt, keine Abhängigkeiten.

## Lokal ansehen

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen (oder im WLAN über die IP des Rechners vom Handy aus)
```

## Auf GitHub Pages veröffentlichen

1. Änderungen auf `main` pushen.
2. Im Repository auf **Settings → Pages** gehen.
3. Unter **Build and deployment** als Quelle **Deploy from a branch** wählen, Branch `main` und Ordner `/ (root)`.
4. Nach ca. einer Minute ist die Seite unter `https://<benutzername>.github.io/<repo-name>/` erreichbar.

## Interaktionen

- **Scrollen** – der Kürbis wächst, färbt sich orange und wird nachts zur Laterne.
- **Tippen** irgendwo auf den Bildschirm – Blätter wirbeln auf.
- **„Wind machen“** – ein Windstoß fegt über die Seite.

Mit aktivierter Systemeinstellung „Bewegung reduzieren“ werden die dekorativen Animationen abgeschaltet.
