# ElektroRechner – Web-App

Offline-fähige Web-App (PWA) für Elektroniker, Elektroingenieure und das Elektrohandwerk.
Kein Build-Schritt, keine Abhängigkeiten, keine Datenübertragung: Gespeicherte Berechnungen bleiben lokal im Browser.

**App öffnen:** https://ru-sirius.github.io/elektrorechner/ – auf dem iPhone in Safari über *Teilen → Zum Home-Bildschirm* installieren.

## Funktionen (v1.4.0)

**Grundlagen**
- Ohmsches Gesetz & Leistung (zwei beliebige von U, I, R, P)
- Reihen- & Parallelschaltung (R, L, C)
- Spannungsteiler (U aus oder R1 mit Normwert)
- Dezibel-Rechner (Spannung/Leistung, beide Richtungen)

**Leitungen & Energietechnik**
- Strom aus Leistung / Leistung aus Strom (1~/3~, P, Q, S, φ, Motorstrom mit η)
- Leitungsberechnung: Mindestquerschnitt nach Spannungsfall
- Spannungsfall (DC, 1~, 3~)
- Maximale Leitungslänge nach Spannungsfall und Abschaltbedingung
- Leitungswiderstand bei Betriebstemperatur
- Blindleistungskompensation (1~, 3~ Stern/Dreieck)
- Stern-Dreieck-Umrechnung

**Schutztechnik & Einspeisung**
- Schutzorgan / Absicherung: Ib ≤ In ≤ Iz und I₂ ≤ 1,45·Iz (Iz wird eingegeben)
- Schleifenimpedanz & Abschaltbedingung (LS B/C/D oder Ia aus Kennlinie)
- Kurzschlussstrom (Trafoklemmen, aus Schleifenimpedanz)
- Selektivität von gG-Sicherungen (Nennstromverhältnis ≥ 1,6 : 1)
- UVT-Zuleitung: Gesamtprüfung Überlast, Spannungsfall, Abschaltung
- Trafo- & Einspeiseberechnung (In, Ik3, Zk, Auslastung)

**Anschlüsse**
- Baustromanschluss (Leistungsbilanz mit Gleichzeitigkeit → Bemessungsstrom)
- Ladeinfrastruktur (Ladepunkte, Gleichzeitigkeit, Ladezeit)

**Photovoltaik & Speicher**
- PV-Stringauslegung mit Temperaturkorrektur
- PV-Ertrag & statische Amortisation
- Energiespeicher (Laufzeit, Kapazität, Ladezeit)

**Sicherheitstechnik**
- Batterie für Sicherheitsbeleuchtung
- BMA/EMA-Notstrombatterie
- SAA/ELA-Leistungsprüfung inkl. Verlust auf der 100-V-Linie

**Elektronik**
- LED-Vorwiderstand, Widerstands-Farbcode, E-Reihen (E6/E12/E24)
- Blindwiderstand & Resonanz, RC/RL-Zeitkonstante

**Netzwerktechnik**
- IPv4-Subnetzrechner (Netz, Maske, Broadcast, Host-Bereich, Adresstyp)
- IPv4-Subnetting (nach Anzahl Netze oder Hosts pro Netz)
- IPv6-Adressen & Präfixe (Kurzform nach RFC 5952, Anzahl /64-Netze)
- Datenübertragung & Bandbreite
- PoE-Leistungsbudget (IEEE 802.3af/at/bt)
- LWL-Dämpfungsbudget
- Netzwerk-Tabellen (Kabelkategorien, Ethernet-Längen, PoE, private Bereiche, Präfixe)

**Nachschlagen**
- IP-Schutzarten (IEC 60529), IK-Stoßfestigkeit (IEC 62262)
- Tabellen & Praxiswerte (LS-Auslösebereiche, I₂, Abschaltzeiten, Nennquerschnitte, Bemessungsströme, κ/α, Normreihen)

**Arbeiten mit der App**
- Favoriten (☆ oben rechts in jedem Rechner)
- Projekte: Berechnungen speichern, wieder öffnen, löschen
- PDF-Ausgabe jeder Berechnung: wird in der App erzeugt und auf iPhone/iPad über das Teilen-Menü ausgegeben, am Computer heruntergeladen
- Projektberichte mit allen Berechnungen eines Projekts (PDF)
- Eingabe mit SI-Präfix (4,7k · 100n · 2,2µ · 10m), Offline-Betrieb, automatische Updates

## Bewusst nicht enthalten
Normtabellen zur Strombelastbarkeit (Iz) und Umrechnungsfaktoren, Sicherungskennlinien, Selektivitätstabellen von Herstellern
sowie normative Zeiten und Reservefaktoren für Sicherheitsstromversorgungen. Diese Werte werden vom Anwender aus den
geltenden Normen bzw. Herstellerunterlagen eingegeben.

## Entwicklung
- `calc.js`: Rechenlogik · Tests: `node test.mjs`
- `ui.js`: gemeinsame Bausteine · `tools.js`, `tools2.js`, `tools3.js`: Rechner · `net.js`: Netzwerk-Logik
- `projects.js`: Favoriten, Projekte, Berichte · `pdf.js`: PDF-Erzeugung ohne externe Bibliothek
- `app.js`, `index.html`, `style.css`: Startseite, Routing, Darstellung
- `sw.js`: Offline-Cache. **Nach Änderungen `CACHE`-Version erhöhen.**

Hosting: jeder statische HTTPS-Host (hier GitHub Pages).

## Haftung & Lizenz
Kostenloses Hilfsmittel ohne Gewähr; Ergebnisse dienen nur der Orientierung und ersetzen keine normgerechte Planung,
Bemessung und Prüfung durch eine Elektrofachkraft. Lizenz: MIT (siehe `LICENSE`). Built by R. U. Sirius?
