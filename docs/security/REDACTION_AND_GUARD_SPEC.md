# Spezifikation: Pseudonymisierung, Redaction und Guard-Logic

Dieses Dokument definiert die technischen Anforderungen und Algorithmen für die Pseudonymisierung und Redaction von Daten sowie die Funktionsweise des fail-closed Guards vor KI-Anfragen.

## 1. Pseudonymisierung (Mapping-Schritt)

Bevor Daten das lokale System für eine KI-Anfrage verlassen oder dauerhaft gespeichert werden, müssen alle Identifikatoren von Schülern in stabile Pseudonyme umgewandelt werden.

### 1.1 Algorithmus
Die Pseudonymisierung erfolgt durch einen kryptographischen Hash-Prozess:
`pseudonym_id = BASE64_URL_SAFE(HMAC_SHA256(school_secret, student_id))`

- **school_secret**: Ein schulspezifisches Geheimnis, das in der Secure Enclave / dem Secret Management (Vaultwarden) gespeichert ist.
- **student_id**: Die interne, eindeutige Datenbank-ID des Schülers.
- **Eigenschaft**: Das Pseudonym ist stabil innerhalb einer Schule, ermöglicht also Längsschnittanalysen durch die KI (z.B. Lernfortschritt), ohne den Klarnamen preiszugeben.

### 1.2 Mapping-Tabelle
Das Mapping zwischen `student_id` und `pseudonym_id` wird ausschließlich lokal in der Tabelle `pseudonym_mappings` gespeichert. Diese Tabelle ist verschlüsselt (AES-256).

---

## 2. Redaction-Regeln (Maskierung von PII)

Der `RedactionService` identifiziert und maskiert personenbezogene Informationen (PII) im Freitext.

### 2.1 Kategorien und Muster

| Kategorie | Beschreibung | Beispiel / Regex (Auszug) | Maske |
| :--- | :--- | :--- | :--- |
| **Namen** | Vor- und Nachnamen von Schülern | `Max Müller` | `[SCHÜLER_PSEUDONYM]` |
| **Geburtsdaten** | Datumsangaben im Kontext von Personen | `\d{2}\.\d{2}\.\d{4}` | `[DATUM_REDACTED]` |
| **Adressen** | Straßen, Hausnummern, PLZ, Orte | `\d{5}\s+[A-Z][a-z]+` | `[ADRESSE_REDACTED]` |
| **Kontaktdaten** | E-Mail, Telefonnummern | `[\w\.-]+@[\w\.-]+\.\w+` | `[KONTAKT_REDACTED]` |
| **Sensible Merkmale**| Förderbedarf, Konfession (wenn Cloud) | `LRS`, `Dyskalkulie` | `[MERKMAL_REDACTED]` |

### 2.2 Ablauf
1. **Named Entity Recognition (NER)**: Identifikation von Eigennamen und Orten.
2. **Pattern Matching**: Anwendung von Regex-Filtern für strukturierte Daten (Datum, E-Mail).
3. **Lookup**: Abgleich mit der lokalen Schülerdatenbank der jeweiligen Klasse.
4. **Ersetzung**: Austausch der Fundstellen durch die definierten Masken.

---

## 3. Fail-closed Guard (Assertion vor Versand)

Der Guard ist die letzte Instanz vor dem Absenden des Payloads an einen LLM-Provider. Er arbeitet nach dem **Fail-Closed-Prinzip** (ADR 0004).

### 3.1 Prüflogik
Unmittelbar vor dem API-Call wird der finale String (Prompt + Kontext) erneut gescannt:

```typescript
function guardAssertion(payload: string, dataClass: DataClass): boolean {
  const piiPatterns = [
    /\b[A-ZÄÖÜ][a-zäöü]+ [A-ZÄÖÜ][a-zäöü]+\b/, // Name-Pattern
    /\d{2,4}-\d{2}-\d{2}/,                   // ISO-Datum
    /\d{5} [A-ZÄÖÜ]/,                        // PLZ
    /(?i)lrs|dyskalkulie|adhs/               // Sensible Begriffe
  ];

  for (const pattern of piiPatterns) {
    if (pattern.test(payload)) {
       // Treffer ohne vorherige explizite Redaction-Markierung -> ABBRUCH
       return false;
    }
  }
  return true;
}
```

### 3.2 Konsequenzen
- **Validation-Success**: Der Call wird ausgeführt.
- **Validation-Failure**:
  - Der API-Call wird unterbunden.
  - Ein Security-Event wird im Audit-Log gespeichert.
  - Der Nutzer erhält eine Fehlermeldung: "Sicherheitsprüfung fehlgeschlagen: Potenzielle Klardaten im Prompt erkannt."

---

## 4. CloudReleaseGrant-Struktur

Ein `CloudReleaseGrant` ist die zwingende Voraussetzung für die Nutzung von Cloud-LLMs bei Daten der Klasse `SENSITIVE_STUDENT` (Klartext-Cloud-Modus) oder für die Übermittlung pseudonymisierter Daten an Drittanbieter.

### 4.1 Datenmodell
```typescript
interface CloudReleaseGrant {
  id: UUID;
  schoolId: UUID;
  provider: "openai" | "anthropic" | "google";
  region: "eu-central-1" | "us-east-1";

  // Rechtliche Basis
  legalBasis: string;       // z.B. "Dienstanweisung Schulleitung vom 01.09.2026"
  dsfaId: string;           // Referenz auf die Datenschutz-Folgenabschätzung
  avvStatus: "signed" | "pending";

  // Geltung
  scope: {
    subjects: string[];     // ["DEUTSCH", "ETHIK"]
    gradeBands: string[];   // ["KS9", "KS10"]
  };

  validFrom: ISO8601;
  validUntil: ISO8601;

  issuer: {
    name: string;           // Name der Schulleitung / DSB
    role: "SCHOOL_ADMIN" | "DSB";
  };
}
```

### 4.2 Validierungs-Invarianten
- **Kein Grant, kein Cloud-Call**: Ohne aktiven, zeitlich gültigen Grant wird jeder Cloud-Adapter durch den Guard blockiert.
- **Zweckbindung**: Der Grant muss zum aktuellen Fachkontext passen.
- **Auditierung**: Die Erteilung eines Grants wird manipulationssicher geloggt.

---

## 5. Querverweise

- **[ADR 0004: Local-First Student Data](../adr/0004-local-first-student-data.md)** – Grundsatzentscheidung zum Schutz von Schülerdaten.
- **[DATA_PROTECTION.md](./DATA_PROTECTION.md)** – Übergreifendes Datenschutzkonzept.
- **[SECURITY.md](./SECURITY.md)** – Sicherheitsarchitektur und Defense-in-Depth.
