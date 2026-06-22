# Datenschutz-Checkliste — LSA (Unterrichtsassistenz)

Diese Checkliste dient der Überprüfung der DSGVO-Konformität und der Einhaltung der projektspezifischen Datenschutzvorgaben.

---

## 1. Grundsätze der Verarbeitung (Art. 5 DSGVO)

- [ ] **Rechtmäßigkeit, Verarbeitung nach Treu und Glauben, Transparenz:** Rechtsgrundlagen sind in `DATA_PROTECTION.md` definiert (z.B. Art. 6(1)(c) für Rechtspflichten).
- [ ] **Zweckbindung:** Daten werden nur für Unterrichtsplanung, Materialerstellung und Korrekturassistenz verwendet.
- [ ] **Datenminimierung:** Es werden nur notwendige Daten erhoben; Redaction-Schritt entfernt PII vor LLM-Verarbeitung.
- [ ] **Richtigkeit:** Lehrkraft hat Letztentscheidung und kann KI-Vorschläge korrigieren.
- [ ] **Speicherbegrenzung:** Löschkonzept in `RETENTION_AND_DELETION.md` ist implementiert (z.B. 12 Monate nach Ausscheiden).
- [ ] **Upload-Sicherheit:** Beschränkungen und OCR-Sicherheit gemäß `UPLOAD_AND_OCR_SECURITY.md`.
- [ ] **Integrität und Vertraulichkeit:** Verschlüsselung At-Rest (AES-256) und In-Transit (TLS 1.3).

---

## 2. Technische Maßnahmen (Privacy by Design)

- [ ] **Pseudonymisierung-by-default:** Klarnamen werden vor Verarbeitung in stabile Pseudonyme gewandelt.
- [ ] **Local-first Strategy:** Schülerdaten verbleiben standardmäßig im lokalen Netz (Ollama); Cloud ist Ausnahme.
- [ ] **Fail-closed Guards:** Bei Fehlern in der Redaction wird die Anfrage blockiert.
- [ ] **Mandantentrennung:** Row-Level Security (RLS) verhindert Zugriff zwischen Schulen/Klassen.
- [ ] **Audit-Logging:** Alle Zugriffe auf Schülerdaten und LLM-Interaktionen werden (ohne PII) protokolliert.

---

## 3. Cloud-LLM-Nutzung (Art. 28, 44 DSGVO)

- [ ] **CloudReleaseGrant:** Für jede Cloud-Nutzung liegt eine explizite Schulleitungs-Freigabe vor.
- [ ] **Auftragsverarbeitungsvertrag (AVV):** Verträge mit Providern (z.B. OpenAI EU) sind geprüft/vorhanden.
- [ ] **Datenschutz-Folgenabschätzung (DSFA):** Risiken der Cloud-Nutzung sind bewertet und dokumentiert.
- [ ] **Transparenz:** Lehrkraft wird im UI gewarnt, wenn Cloud-Modelle aktiv sind.

---

## 4. Betroffenenrechte (Art. 12-23 DSGVO)

- [ ] **Auskunftsrecht:** Prozess zum Export von Schülerdaten für Eltern/Schüler ist definiert.
- [ ] **Recht auf Löschung:** Manuelle Löschung auf Anfrage ("Recht auf Vergessenwerden") ist möglich.
- [ ] **Widerrufsrecht:** Lehrkraft kann Cloud-Zustimmung jederzeit zurückziehen.

---

## 5. Spezifische Anforderungen (Religion / Art. 9 DSGVO)

- [ ] **Strikte Trennung:** RAG-Filter verhindern das Vermischen konfessioneller Inhalte.
- [ ] **Zweckgebundene Verarbeitung:** Religionsdaten werden nur im Kontext des jeweiligen Fachunterrichts genutzt.

---

## Dokumentations-Status

| Bereich           | Status               | Referenz                                      |
| :---------------- | :------------------- | :-------------------------------------------- |
| Rechtsgrundlagen  | 🟢 Vollständig       | `docs/security/DATA_PROTECTION.md`            |
| Löschkonzept      | 🟢 Vollständig       | `docs/security/RETENTION_AND_DELETION.md`     |
| Pseudonymisierung | 🟢 Spezifiziert      | `docs/adr/0004`, `0009`                       |
| Cloud-Freigabe    | 🟢 Prozess definiert | `docs/security/DATA_PROTECTION.md` (Kap. 3.2) |
