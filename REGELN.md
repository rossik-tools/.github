# Rossik Tools - Arbeitsregeln der Organisation

> Gilt fuer JEDES Repo in github.com/rossik-tools. Aenderungen an diesem Dokument nur per PR mit Freigabe von Filip.
> Stand: 20.08.2026, Version 1.0

## 0. Leitsatz

Wir arbeiten wie eine professionelle IT-Firma: strukturiert, nachvollziehbar, sauber.
**Wir kopieren nichts blind. Wir bauen schrittweise und verstehen, was wir bauen.**
Bestehende Systeme (Intranet, Lovable-Tools) sind Vorbilder und Lieferanten von Ideen - nicht Kopiervorlagen.

## 1. WO - Struktur

| Regel | Konkret |
|---|---|
| Ein Modul = ein Repo = eine Subdomain | orgchart -> orgchart.rossiktools.com, fleet -> fleet.rossiktools.com |
| Repo-Namen | englisch, kleingeschrieben, kurz: `portal`, `orgchart`, `fleet-monitor` |
| Pflichtdateien pro Repo | `README.md` (was ist das, wie deployen), `AGENTS.md` (Regeln fuer KI-Sessions), `docs/` fuer Entscheidungen |
| Datenbank | Supabase. Jedes Modul NUR sein eigenes Tabellen-Praefix. Fremde Praefixe sind tabu - auch lesend nur nach Absprache |
| Secrets | NIEMALS im Code, in Commits oder im Chat. Vault (rossik-core) oder Function-Secrets. Ohne Ausnahme |
| Hosting | Cloudflare (Pages/Workers). Deploys nur aus `main`, nie aus lokalen Staenden |

## 2. WIE - Arbeitsablauf

1. **`main` ist heilig.** Immer lauffaehig, immer der Stand, der live ist. Direkte Pushes sind technisch gesperrt.
2. **Jeder arbeitet auf seinem Branch** (`filip`, `bogdan`, ...). Experimente sind dort ausdruecklich erwuenscht.
3. **Auf main kommt Code nur per Pull Request** mit mindestens 1 Freigabe. Eigene PRs gibt man nicht selbst frei.
4. **Kleine PRs.** Ein PR = ein Thema. 200 geaenderte Zeilen sind besser pruefbar als 2.000.
5. **DB-Migrationen** laufen als Datei im PR mit. Deploy in die Datenbank erst NACH dem Merge, durch den Modul-Verantwortlichen. Repo und Datenbank muessen immer denselben Stand haben.
6. **Commit-Sprache Englisch**, Format `typ(bereich): was` - z.B. `feat(leave): telegram webhook`, `fix(orgchart): mobile layout`. Diskussionen in PRs: Sprache frei.
7. **KI-Arbeit (Claude Code, Lovable) folgt denselben Regeln.** Die AGENTS.md des Repos ist fuer jede KI-Session bindend.

## 3. WAS - Definition of Done

Eine Aufgabe ist fertig, wenn ALLES zutrifft - sonst ist sie "in Arbeit":

- [ ] Code gebaut und lokal geprueft (Build laeuft, Kernfunktion getestet)
- [ ] Sicherheits-Standards eingehalten (siehe Punkt 5)
- [ ] Migrationen als Datei im Repo, nicht nur in der DB
- [ ] README/Doku angepasst, falls sich Verhalten oder Struktur geaendert hat
- [ ] PR erstellt, Review erhalten, gemerged
- [ ] Aus main deployed und live verifiziert (nicht nur "sollte gehen")

## 4. WANN - Freigaben

| Aktion | Braucht |
|---|---|
| Arbeiten auf eigenem Branch | nichts - freie Fahrt |
| Merge auf main | PR + 1 Freigabe (technisch erzwungen) |
| Deploy / Veroeffentlichung / DNS-Aenderung | Filip-GO |
| Neue Domain, neuer Dienst, neue Kosten | Filip-GO |
| Rechte-Aenderungen (GitHub, Supabase, Cloudflare, Access) | Filip-GO |
| Loeschen von Daten oder Infrastruktur | Filip-GO, ausdruecklich |

## 5. Sicherheit - Mindeststandard fuer jeden PR mit Datenbank-Anteil

- RLS auf jeder neuen Tabelle, Mandanten-Trennung wo vorhanden
- `REVOKE ALL ... FROM anon, PUBLIC` auf neuen Tabellen UND Funktionen (PUBLIC-Falle!)
- Rollen-Checks NULL-sicher (`COALESCE(..., false)`, `IS DISTINCT FROM`)
- Rechte konfigurierbar statt hartcodiert, wo sinnvoll
- Keine Produktivdaten in Repos, Tests oder Chats (DSGVO)
- Oeffentlich erreichbare Endpunkte (Webhooks) brauchen einen eigenen Auth-Mechanismus und werden im PR begruendet

## 6. WER - Rollen

| Person | Rolle |
|---|---|
| Filip | Owner. Freigaben, Merges, Rechte, Infrastruktur |
| Bogdan | Entwickler. Schreibzugriff auf zugewiesene Repos, arbeitet auf Branch `bogdan` |
| Modul-Verantwortlicher | pro Repo benannt (im README). Verantwortet Qualitaet und DB-Stand seines Moduls |

Zugriff wird pro Repo vergeben, nie pauschal auf alles. Neue Mitglieder starten mit Lese-Zugriff.

## 7. Entscheidungen festhalten

Wichtige Architektur-Entscheidungen (Warum Foederation? Warum Cloudflare?) werden als kurze Notiz
in `docs/` des betroffenen Repos festgehalten: Was wurde entschieden, warum, was war die Alternative.
Drei Saetze reichen. In einem Jahr weiss sonst niemand mehr, warum etwas so gebaut wurde.
