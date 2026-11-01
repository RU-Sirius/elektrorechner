# ElektroRechner – Web-App

Offline-fähige Web-App (PWA) mit allen Funktionen frei: Ohmsches Gesetz, Spannungsfall (DC/1~/3~),
Mindestquerschnitt, Widerstands-Farbcode. Kein Build-Schritt, keine Abhängigkeiten.

- `calc.js`: Rechenlogik (aus der iOS-App portiert); Tests: `node test.mjs`
- `app.js`, `index.html`, `style.css`: Oberfläche
- `sw.js`: Offline-Cache. **Nach Änderungen `CACHE`-Version erhöhen.**

Hosting: Jeder statische HTTPS-Host (z. B. GitHub Pages). Der Offline-Cache funktioniert nur über HTTPS.

## Haftung & Lizenz
Kostenloses Hilfsmittel ohne Gewähr; Ergebnisse dienen nur der Orientierung und ersetzen keine normgerechte Planung durch eine Elektrofachkraft. Lizenz: MIT (siehe `LICENSE`). Built by R. U. Sirius?
