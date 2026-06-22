# Sicherheits-Findings (Review-Ergebnisse)

Dieses Dokument listet die im Rahmen des Security-Reviews (ASVS & Datenschutz) identifizierten Lücken auf. Diese sind als `type: security` Issues zu behandeln.

---

## 1. Auth-Lösung ist noch im Entwurfsstadium (ASVS V2)

- **Beschreibung:** Die Authentifizierungslösung (ADR 0007) befindet sich noch im Status _Proposed_. Ohne eine finale Entscheidung und Implementierung (inkl. MFA) ist das Projekt nicht ASVS Level 2 konform.
- **Risiko:** Unzureichende Authentifizierung führt zu unbefugtem Zugriff auf Lehrkraft-Konten und sensible Schülerdaten.
- **Maßnahme:** ADR 0007 finalisieren, Better Auth (oder äquivalent) implementieren und MFA (TOTP) als Standard vorsehen.
- **Priorität:** Hoch (p1)
- **Status:** Offen

## 2. Redaction-Service & Guard-Assertion fehlen (ASVS V5, V12)

- **Beschreibung:** Der Kern-Datenschutzmechanismus (Pseudonymisierung vor LLM-Call) ist spezifiziert, aber noch nicht implementiert. Die "fail-closed" Invariante kann derzeit nicht technisch erzwungen werden.
- **Risiko:** Unbeabsichtigte Übertragung von Klarnamen (PII) an Cloud-Provider bei Fehlkonfiguration oder Prompt-Injection.
- **Maßnahme:** Implementierung des `RedactionService` und der `Guard-Assertion` (wie in `DATA_PROTECTION.md` Kap. 3 beschrieben) mit hoher Testabdeckung. Spezifikation für Upload/OCR siehe `UPLOAD_AND_OCR_SECURITY.md`.
- **Priorität:** Hoch (p1)
- **Status:** Spezifiziert

## 3. Fehlendes automatisiertes Dependency-Scanning (ASVS V14)

- **Beschreibung:** Es gibt derzeit keine automatisierten Prüfungen auf bekannte Schwachstellen in den Abhängigkeiten (SCA).
- **Risiko:** Nutzung von Bibliotheken mit kritischen Sicherheitslücken.
- **Maßnahme:** Integration von Tools wie `npm audit`, `snyk` oder GitHub Dependabot in die CI-Pipeline.
- **Priorität:** Mittel (p2)
- **Status:** Offen

## 4. Re-Identifikationsrisiko aus Freitext (Datenschutz)

- **Beschreibung:** Trotz Pseudonymisierung können Schüler durch Kontextinformationen (Hobbys, spezifische Fehlerkombinationen) im Freitext identifiziert werden.
- **Risiko:** Verletzung der Anonymität trotz technischer Pseudonymisierung.
- **Maßnahme:** Implementierung von k-Anonymitäts-Prüfungen oder aggregiertem Feedback für große Klassen; Sensibilisierung der Lehrkräfte.
- **Priorität:** Mittel (p2)
- **Status:** Dokumentiertes Restrisiko

## 5. Fehlende Rate-Limiting-Implementierung (ASVS V4, THREAT_MODEL)

- **Beschreibung:** Mechanismen zur Verhinderung von DoS-Angriffen durch massive Uploads oder API-Anfragen sind zwar im Threat Model geplant, aber noch nicht implementiert.
- **Risiko:** Systeminstabilität oder hohe Cloud-Kosten durch Denial-of-Service.
- **Maßnahme:** Implementierung von Rate-Limiting (z. B. via Redis/BullMQ oder API-Gateway) pro Lehrkraft/Schule. Spezifikation für Uploads siehe `UPLOAD_AND_OCR_SECURITY.md`.
- **Priorität:** Mittel (p2)
- **Status:** Spezifiziert
