# Datenschutz und Datenminimierung

**Zielgruppe:** Implementierungsteam, Schuladministration, Datenschutzaudit.  
**Gültig ab:** 2026-06-22.  
**Status:** Draft (vor Schulrechtsbeauftragung).

---

## 1. Grundsätze

Das System folgt den Datenschutzzielen durch technisches Design, nicht durch Richtlinien allein:

- **Datenminimierung:** Nur Daten erfassen, verarbeiten und speichern, die unmittelbar notwendig sind für die jeweils aktive Funktion (z.B. Korrekturvorbereitung, nicht Profiling).
- **Zweckbindung:** Verarbeitete Daten dienen ausschliesslich dem deklarierten Zweck; Zweckänderung erfordert Lehrkraft-Genehmigung und Datenschutzbewertung.
- **Pseudonymisierung-by-default:** Schülernamen werden auf System-Ebene zu stabilen Pseudonymen (pseudonym_id) transformiert, bevor sie in LLM-Prompts oder Cloud-Prozesse gelangen.
- **Local-first:** Verarbeitung und Speicherung von Schülerdaten erfolgen im Schulnetzwerk (lokale Ollama, lokale PostgreSQL, lokal verwaltete Redaction-Mapping); Cloud nur unter dokumentierter Schulfreigabe und nur für redacted Daten.
- **Fail-closed:** Fehler in der Redaction oder Freigabe-Logik führen zu Abbruch, nicht zu Fallback-Übertragung sensibler Daten.

---

## 2. Datenklassen und Cloud-Eignung

Das System klassifiziert alle Daten nach Sensitivität und Cloud-Zulässigkeit:

| Datenklasse | Beispiele | At-Rest (lokal) | Cloud-fähig | Pseudonymisierung | Besonderheiten |
|---|---|---|---|---|---|
| **PUBLIC** | Veröffentlichte Lernmaterialien, allgemeine Fachcurricula, öffentliche Schulinfo | ✓ | ✓ (unrestricted) | nein | Keine Einschränkung; Standard-Datenschutz (Audit-Log) ausreichend |
| **INTERNAL** | Schulinterner Ablauf, Lehrkraft-Notizen ohne Schülerbezug, Admin-Logs | ✓ | ✓ (mit Audit) | nein | Einmal lokal indexiert, dann Cloud-Zugang nur durch Schuladmin freigegeben |
| **PERSONAL_TEACHER** | Lehrkraft-spezifische Konfiguration, private Unterrichtspläne, Feedback-Entwürfe (vor Versand an Schüler) | ✓ | ✓ (mit Audit + Consent) | n/a | Nur für die Lehrkraft zugänglich; Cloud nur mit explizitem Opt-in pro Datenelement |
| **SENSITIVE_STUDENT** | Schülernamen, Schülerleistungen, Feedback an Schüler, Schülerlernstände, Förderbedarfskennzeichnung, Konfession, medizinische Hinweise | ✓ (mit Verschlüsselung) | ⚠️ Nur pseudonymisiert + dokumentierte Schulfreigabe | ja (mandatory) | Klarnamen verlassen das System im Normalbetrieb nicht. Cloud-Zugang nur unter CloudReleaseGrant; Klartext-Modus ist Ausnahmeregelung, auditiert, mit Warnhinweis. Siehe Abschnitt 4. |

**Cloud-fähig-Definition:**  
- **✓:** Datenklasse darf cloud-seitig verarbeitet werden, sofern technische und organisatorische Massnahmen (Verschlüsselung, Audit, Schulvereinbarung) eingehalten sind.
- **⚠️:** Datenklasse darf cloud-seitig verarbeitet werden, aber nur unter restriktiven Bedingungen (Pseudonymisierung, dokumentierte Schulfreigabe, Audit).
- **✗:** Datenklasse darf nicht in Cloud-Prozesse fliessen (nicht geplant für diese Version).

---

## 3. LLM-Request-Pipeline (nicht umgehbar)

Jeder Aufruf an einen LLM-Provider (Ollama lokal, oder externe Cloud-Provider wie OpenAI, Anthropic, o.ä.) durchläuft diese Schrittfolge. Sie ist architektonisch eingebaut und kann nicht übersprungen werden.

### 3.1 Intent + Scope bestimmen

**Auslöser:** Lehrkraft initiiert Anfrage (z.B. "Generiere Musterkorrektur für Deutschaufsatz").

**System ermittelt:**
- Fachdomäne (z.B. "Deutsch", "Mathematik")
- Strang (z.B. "Korrekturassistenz", "Aufgabengenerierung")
- Datenklasse des Eingabe-Kontexts (z.B. "SENSITIVE_STUDENT" weil Schülertexte beteiligt)
- Erforderliche RAG-Quellen (Lehrplan, Korrekturrichtlinien, Schulvorgaben)

**Keine Verarbeitung ohne vorherige Klassifizierung.**

### 3.2 Provider-Policy-Gate

**Entscheidungslogik:**

```
if data_class == PUBLIC or INTERNAL:
    provider = local_ollama  (default, kostengünstig)
    (cloud möglich mit Audit, aber nicht verpflichtet)
elif data_class == PERSONAL_TEACHER:
    provider = local_ollama  (default)
    (cloud nur mit explizitem Consent der Lehrkraft pro Request)
elif data_class == SENSITIVE_STUDENT:
    provider = local_ollama  (default, mandatory)
    if user_selects_cloud:
        if cloudReleaseGrant exists and data_will_be_pseudonymized and school_audit_ok:
            provider = cloud  (mit Redaction als Vorbedingung)
        else:
            reject_request  (fail-closed)
else:
    reject_request  (unknown class)
```

**CloudReleaseGrant-Anforderungen** (für SENSITIVE_STUDENT Cloud-Nutzung):
- **Freigebende Person:** Schulleitung, Datenschutzbeauftragte oder designierter Schuladmin
- **Zweck:** Explizit benannte Funktion(en) (z.B. "Korrekturassistenz mit OpenAI für Deutschunterricht")
- **Geltungsdatum:** Startdatum und Ablaufdatum
- **Geltungsbereich:** Welche Klassen/Jahrgangsstufen betroffen
- **Rechtsgrundlage:** GDPR-Artikel, länderspezifisches Schulgesetz oder Verordnung
- **Auftragsverarbeitungsvertrag (AVV):** Unterzeichnet mit Cloud-Provider
- **Datenschutz-Folgenabschätzung (DSFA):** Dokumentiert Risiken und Massnahmen (z.B. Pseudonymisierung, Datenlöschung nach X Tagen, Encryption-Standard)
- **Provider und Region:** Welcher Anbieter, in welchem Rechenzentrum (z.B. "OpenAI US", "Anthropic EU")

**Ablage:** CloudReleaseGrant als signiertes Dokument (PDF oder digitale Signatur) in `/docs/compliance/cloud-release-grants/` mit Versionierung.

### 3.3 Redaction und Pseudonymisierung (lokal, vor jedem Provider-Call)

**Voraussetzung:** Dieser Schritt findet lokal statt, BEVOR Daten an einen beliebigen Provider gesendet werden — lokal oder Cloud.

**Logik:**

1. **Schülernamen zu stabilen Pseudonymen:**
   - Eingabe: "Der Schüler Max Müller hat folgende Fehler..."
   - Algorithmus: SHA256(school_id + student_id) → pseudonym_id (z.B. "student_9a42c8e1")
   - Output: "Der Schüler student_9a42c8e1 hat folgende Fehler..."
   - **Mapping-Speicher:** Nur lokal in PostgreSQL (Tabelle `pseudonym_mappings`), nie in Cloud, nie in Prompts

2. **Weitere PII entfernen/maskieren:**
   - Geburtsdaten: Entfernen oder zu "Jahrgangsstufe X" generalisieren
   - Adressen: Entfernen
   - Telefonnummern: Entfernen
   - Förderbedarfskennzeichnung (z.B. "Schüler hat LRS") → Entfernen (Cloud) oder Beibehalt lokal
   - Konfession (wenn Cloud): Entfernen oder zu "konfessionell" generalisieren (Ausnahme: Religionsunterricht mit dokumentierter Cloud-Freigabe pro Klasse)
   - Medizinische Hinweise (Allergien, Erkrankungen): Entfernen

3. **Protokollierung:**
   - Für jeden Request: `redaction_applied=true`, Timestamp, Lehrkraft-ID, Liste der entfernten/geänderten Felder
   - Speichern in Audit-Log (siehe Abschnitt 8)

**Implementierung:** Klasse `RedactionService` in Backend, aufgerufen IMMER VOR dem Prompt-Assembly:

```typescript
// Pseudo-Code
const redacted = redactionService.apply({
  input: rawInput,
  dataClass: SENSITIVE_STUDENT,
  provider: 'openai',
  pseudonymMapping: localMapping
});
// redacted.text: "Der Schüler student_9a42c8e1 hat…"
// redacted.applied: true
// redacted.fields_removed: ["name", "dob", …]
```

### 3.4 Kontext-Assembly (RAG-Retrieval mit Pflichtfiltern)

**Auslöser:** Nach Intent-Bestimmung und Policy-Gate wird der RAG-Index abgefragt.

**Pflichtfilter:**
- **Fachdomäne:** Nur Chunks aus dem korrekten Fach (z.B. "Deutsch" LLM-Input nicht mit "Mathematik"-Quellen vermischen)
- **Konfession:** 
  - Religionsunterricht: Nur Chunks der Schulkonfession (evangelisch/katholisch) oder konfessionssensibel-übergreifend
  - Ethik-Unterricht: Nur Chunks aus der Ethik-Kategorie, keine konfessionellen Inhalte vermischen
  - Übrige Fächer: Keine religiösen Hinweise (ausser explizit schulintern freigegeben)
- **TrustLevel:** Nur Chunks mit TrustLevel >= OFFICIAL_GUIDANCE (siehe auch [../rag/SOURCE_REGISTRY.md](../rag/SOURCE_REGISTRY.md))
  - `OFFICIAL_BINDING`: Lehrpläne, Schulvorgaben (immer zulässig)
  - `OFFICIAL_GUIDANCE`: Lehrerverbandsmaterial, Schulbuch-Zusatzmaterialien (zulässig)
  - `OPEN_CURATED`: Lehrerblogs, Fachforen (zulässig mit Unsicherheit-Hinweis)
  - `USER_APPROVED`: Von Lehrkraft manuell freigegeben (zulässig)
  - `UNVERIFIED`: Nicht überprüftes Internet (nie produktiv)

**Ergebnis:** Kontext-Chunks für Prompt-Assembly, markiert mit Herkunft (Source + TrustLevel).

### 3.5 Guard-Assertion vor Versand (fail-closed)

**Auslöser:** Kurz BEVOR der finale Prompt an den Provider versendet wird, findet eine automatische letzte Kontrolle statt.

**Logik:**

```
final_payload = redacted_input + assembled_context + system_prompt

guard_check = pattern_match(final_payload, [
  r'(?i)\b[A-ZÄÖÜ][a-zäöü]+ [A-ZÄÖÜ][a-zäöü]+\b',  # Vorname + Nachname
  r'\d{2,4}-\d{2}-\d{2}',  # Geburtsdatum
  r'\d{5} [A-Z]',  # PLZ + Stadt
  r'(?i)lrs|dyskalkulie|adhs|körperbehinderung',  # Förderhinweise
  ...
])

if guard_check.matches and redaction_applied != true:
    log_error("PII in payload detected, redaction failed")
    return ERROR_ABORT
elif guard_check.matches and redaction_applied == true:
    # Redaction ran, Guard triggered anyway → Log warning, aber Versand erlaubt
    log_warning("Guard pattern matched, but redaction applied. Proceeding.")
else:
    proceed_to_provider_call()
```

**Konsequenz bei Treffer:**
- Abbruch (`fail-closed`)
- Alert an Lehrkraft und Admin: "Datenschutzprobleme erkannt, Anfrage konnte nicht verarbeitet werden. Kontaktieren Sie den Admin."
- Audit-Log-Eintrag (siehe Abschnitt 8)

### 3.6 Provider-Call über provider-agnostische Abstraktion

**Architektur:** Ein einziger `LLMProviderAdapter`-Interface mit Implementierungen:

```typescript
interface LLMProviderAdapter {
  call(prompt: string, context?: string): Promise<GenerationResult>;
}

class OllamaAdapter implements LLMProviderAdapter { ... }
class OpenAIAdapter implements LLMProviderAdapter { ... }
class AnthropicAdapter implements LLMProviderAdapter { ... }
```

**Jeder Adapter erbt automatisch:**
- Redaction (Schritt 3.3)
- Guard-Assertion (Schritt 3.5)
- Provenance-Logging (Schritt 3.8)

**Kein Adapter darf diese Schritte überspringen.**

**Verbindungsrichtlinien:**
- Lokal (Ollama): Unverschlüsselt oder TLS (lokal)
- Cloud (OpenAI, Anthropic): TLS 1.3, Mutual TLS wo möglich, API-Key aus Vaultwarden

### 3.7 Re-Identifikation (lokal, nur lokaler Output-Pfad)

**Auslöser:** Provider gibt Antwort zurück; System nimmt diese in Empfang.

**Logik:**

1. **Provider-Output enthält Pseudonyme** (z.B. "student_9a42c8e1")
2. **Lokal nachschlagen:** Mapping-Tabelle (`pseudonym_mappings`) → Klarname (z.B. "Max Müller")
3. **Nur Zuruck-Mapping an Lehrkraft im UI:**
   - Lehrkraft sieht: "Rückmeldung für Max Müller: […]"
   - Audit-Log: Re-ID-Operation protokolliert
4. **Kein Re-ID in Cloud oder in an Cloud gesendeten Payload**

**Zweck:** Lehrkraft kann Ergebnisse ihren Schülern zuordnen, ohne dass Klarnamen je in der Cloud waren.

### 3.8 Provenance-Logging

**Für jeden Request wird ein `GenerationProvenance`-Eintrag in der Audit-Log-Tabelle gespeichert:**

```typescript
interface GenerationProvenance {
  id: UUID;
  timestamp: ISO8601;
  teacher_id: UUID;
  school_id: UUID;
  function: string;  // "correction_assistance", "task_generation", …
  data_class: "PUBLIC" | "INTERNAL" | "PERSONAL_TEACHER" | "SENSITIVE_STUDENT";
  provider: string;  // "ollama", "openai", "anthropic"
  model: string;     // "qwen3:7b", "gpt-4", "claude-3-sonnet"
  prompt_hash: string;  // SHA256(system_prompt + assembled_context)
  redaction_applied: boolean;
  redaction_fields: string[];  // ["name", "dob", "address"]
  source_refs: { source_id: string; trust_level: string }[];
  confidence_state: "high" | "medium" | "low";  // Von Provider
  result_citation_status: "fully_cited" | "partially_cited" | "unsure_marked";
  guard_check_passed: boolean;
  abort_reason?: string;  // Falls Abort
}
```

**Speicherort:** PostgreSQL Tabelle `generation_provenance`, mit Index auf `teacher_id`, `school_id`, `timestamp`.

**Auditierbar:** Schuladmin und Datenschutzbeauftragte können auf diese Logs zugreifen, um zu prüfen, welche Daten an welche Provider gesendet wurden.

### 3.9 Confidence- und Citation-Markierung des Outputs

**Output-Format für Lehrkraft:**

```markdown
## Musterkorrektur für Deutschaufsatz (Klasse 9a)

[OLLAMA | GPT-4 | Anthropic]
Vertrauensniveau: Hoch / Mittel / Niedrig
Quellen: Lehrplan Deutsch NRW (2022) [OFFICIAL_BINDING], 
         Fehlerkatolog Dudenverlag [OFFICIAL_GUIDANCE]

### Rückmeldungen:

**Satz 1:** "Das ist falsch." 
→ **Vorschlag:** "Das stimmt nicht." 
   **Grund:** Schriftsprache vermeidet Umgangssprache in formalen Arbeiten. 
   **Quelle:** Duden Deutschunterricht, Kap. 5. 
   **Sicherheit:** Mittel (Regelwerk, aber Ausnahmen möglich)

---

⚠️ Schüler-Namen sind pseudonymisiert verarbeitet worden. 
Alle Quellen lokal geprüft (TrustLevel >= OFFICIAL_GUIDANCE).
```

**Lehrkraft-Aufgabe:**
- Prüfe Vorschläge auf Plausibilität
- Nutze Kriterien und Belege, um selbst Urteile zu bilden
- Entscheide Letztverantwortung (System ist Assistent, nicht Entscheidungsträger)

---

## 4. Klartext-Cloud-Modus (Ausnahmeregelung)

**Default:** off.  
**Aktivierbar:** pro Schule, pro Fachkonferenz, unter restriktiven Bedingungen.

### 4.1 Wann ist ein Klartext-Cloud-Modus sinnvoll?

- Schule möchte spezialisierte Cloud-Modelle nutzen (z.B. GPT-4 für Sprachanalyse), die lokal nicht verfügbar sind.
- Lokale Ollama-Inferenz ist zu langsam oder zu ressourcenhungrig.
- Schule hat Budgetmittel für Cloud-Services und möchte diese nutzen.

### 4.2 Aktivierungsprozess

1. **Datenschutzbeauftragte / Schulleitung** initiiert Anfrage.
2. **Schulkonferenz oder Fachkonferenz** diskutiert Risiken:
   - Re-Identifikation aus pseudonymisiertem Text möglich (z.B. "Schüler schreibt zum Lieblingsbuch Goethes")
   - Datenverlust bei Cloud-Provider-Breach
   - Compliance mit Schulgesetz und GDPR
3. **Externe Datenschutzkonsultation** (optional aber empfohlen): Rücksprache mit Landesdatenschutzbeauftragtem.
4. **CloudReleaseGrant unterzeichnen** (Abschnitt 3.2).
5. **Schuladmin aktiviert Klartext-Modus** pro Schule in der Datenbank (Flag: `school.klartext_cloud_mode_enabled`).

### 4.3 Technische Umsetzung im Klartext-Modus

**Wenn aktiviert:**

```typescript
if school.klartext_cloud_mode_enabled == true and cloudReleaseGrant.valid == true:
    // Pseudonymisierung wird ÜBERSPRUNGEN
    redaction_applied = false  
    prompt_text = raw_input  // Schülernamen IN Klarttext
    send_to_cloud(prompt_text)
else:
    // Standard-Modus: Redaction ERZWUNGEN
    redacted = redactionService.apply(...)
    send_to_cloud(redacted)
```

**Warnhinweis für Lehrkraft im UI:**

```
⚠️ Klartext-Cloud-Modus aktiv
Diese Anfrage wird MIT Schülernamen an [Provider] übermittelt.
Risiken: Datenschutz, Datenverlust.
Schulfreigabe vorhanden (CloudReleaseGrant 2026-06).
```

### 4.4 Audit und Monitoring

- Jeder Klartext-Cloud-Request wird explizit geloggt (`redaction_applied=false`).
- Wöchentlicher Report an Schuladmin: "Klartext-Requests letzte Woche: X, davon Y zu Cloud-Provider Z".
- Schuladmin kann Klartext-Modus pro Lehrkraft einschränken (z.B. nur für Senior-Lehrkräfte).

### 4.5 Restrisiko und Empfehlung

**Restrisiko:** Auch mit Pseudonymisierung: Re-Identifikation ist theoretisch möglich, wenn ein Cloud-Provider Zugriff auf weitere Daten (z.B. Public Social Media) hat und Kontextmuster abgleicht.

**Empfehlung:** 
- Klartext-Modus nur nach Abstimmung mit Landesdatenschutzbeauftragtem aktivieren.
- Nicht für besonders sensitive Fälle (z.B. Schüler mit Förderbedarfskennzeichnung, besondere Lebensumstände).
- Regelmässige Risiko-Neubewertung (mind. jährlich).

---

## 5. Rollenmodell und Mandantentrennung

### 5.1 Rollen

| Rolle | Berechtigung | Datenzugriff |
|---|---|---|
| **Lehrkraft** | Erstellt Anfragen für eigene Klassen; sieht Outputs für ihre Fächer | SENSITIVE_STUDENT (own class only), PERSONAL_TEACHER |
| **Admin (Schule)** | Verwaltet CloudReleaseGrant, Konfiguration, Audit-Logs | Alle, mit Audit-Trail |
| **Datenschutzbeauftragte (Schule)** | Liest Audit-Logs, validiert CloudReleaseGrant, genehmigt Klartext-Modus | INTERNAL, Audit-Logs (read-only) |
| **System** | Technik-Rolle, Redaction, Guard, Logging | Alle (vertrauensgebunden) |

### 5.2 Mandantentrennung

**Invariante:** Daten einer Schule dürfen NICHT für Lehrkräfte oder Anfragen einer anderen Schule zugreifbar sein.

**Implementierung:**
- PostgreSQL: Row-Level Security (RLS) auf allen `school_id`-sensitiven Tabellen.
- Redis: Key-Namespace mit `school_id` (z.B. `school:123:generation:request:uuid`).
- Qdrant: Metadata-Filter auf `school_id` bei jedem RAG-Query.
- Audit-Log: Jeder Eintrag trägt `school_id`, `teacher_id` (wo relevant).

**Test-Szenario:** Lehrkraft von Schule A darf nicht sehen, dass Lehrkraft von Schule B eine Anfrage gestellt hat.

---

## 6. Verschlüsselung

### 6.1 At-Rest

- **PostgreSQL:** SENSITIVE_STUDENT Daten in verschlüsselten Spalten (pgcrypto oder Anwendungsebene, AES-256).
- **MinIO (Object Store):** S3-Server-Side Encryption, AES-256 (Standard).
- **Redis:** Unverschlüsselt im Memory (Sicherheitsrisiko, siehe THREAT_MODEL.md).
- **Mapping-Tabelle (`pseudonym_mappings`):** Verschlüsselt, Schlüssel in Vaultwarden.

### 6.2 In-Transit

- **Client ↔ Server:** TLS 1.3, selbstsigniertes Zertifikat (lokal) oder CA-signiert (Production).
- **Server ↔ Ollama:** TLS (lokal) oder unverschlüsselt (wenn Ollama im selben Container-Netzwerk).
- **Server ↔ Cloud-Provider:** TLS 1.3 mandatory, API-Key in Authorization-Header.

---

## 7. Secrets-Verwaltung

**Regel:** Keine Secrets im Git-Repo, auch nicht `.env.example` mit Dummy-Werten.

**Speicherort:** Vaultwarden (Alex' selfhosted `https://vw.alexle135.de`), oder für Schulumgebungen: Schulinternes Secret-Mangagement (z.B. HashiCorp Vault).

**Runtime-Injection:**
```bash
export OPENAI_API_KEY="$(vw get OPENAI_API_KEY)"
npm run start
```

**Kontrollmechanismus:** Docker-Compose oder Kubernetes Secrets (nicht in Dockerfile).

---

## 8. Auditierbarkeit

### 8.1 Audit-Log Tabelle

**Spalten:**
- `id` (UUID)
- `timestamp` (ISO8601)
- `event_type` (login, logout, generation_request, redaction, guard_check, cloud_call, re_identification, …)
- `actor_id` (Lehrkraft/Admin/System, UUID)
- `school_id` (UUID)
- `subject` (Beschreibung, z.B. "generation_request_for_correction_assistance")
- `details` (JSON: { generation_provenance_id, redaction_fields, cloud_provider, … })
- `severity` (info, warning, error, critical)

### 8.2 Zugriff und Retention

- **Zugriff:** Admin und Datenschutzbeauftragte nur, Row-Level Security (`school_id`).
- **Retention:** 3 Jahre (oder länderspezifische Vorgabe).
- **Export:** CSV-Export für externe Audits (mit Schulfreigabe).

---

## 9. Löschkonzept

**Verweise:** [./RETENTION_AND_DELETION.md](./RETENTION_AND_DELETION.md)

**Schnellübersicht:**
- **Schüler-Daten:** Löschen spätestens 12 Monate nach Schulausscheiden, auf Anfrage sofort.
- **Generation-Outputs:** Löschen nach Lehrkraft-Archivierung oder spätestens 5 Jahre.
- **Audit-Logs:** 3 Jahre, dann anonymisieren oder löschen.
- **Pseudonym-Mappings:** Gleichzeitig mit Schüler-Daten löschen.

**Mechanik:**
- Automatisierte Batch-Löschung (z.B. täglich um 02:00 Uhr UTC).
- Soft-Delete (markiert als gelöscht, nicht physisch entfernt, für Wiederherstellung).
- Vor physischem Delete: Backup und Archivierung für Compliance.

---

## 10. Korrekturassistenz: Nachvollziehbarkeit und Letztentscheidung

**Designinvariante:** Korrekturassistenz liefert NUR Vorschläge mit vollständiger Nachvollziehbarkeit.

### 10.1 Struktur eines Vorschlags

```markdown
**Problem:** Satz enthält Komma-Fehler.

**Kriterium:** DUDEN Rechtschreibung §42, Regel X.Y

**Beleg:** 
- Regel-Text: "Komma trennt Hauptsätze."
- Ihr Satz: "Der Schüler schreibt, und der Lehrer liest."
  → Zwei Hauptsätze, Komma korrekt.

**Vorschlag:** Satz ist korrekt. (Kein Fehler.)

**Unsicherheiten:**
- Ausnahmeregelung: Stilistische Kommas nach §42 Abs. 2 können delegiert sein.
- Wort "liest" könnte Partizip sein (ambig).

**Quellen:** 
- Duden Grammatik, 9. Aufl., S. 425
- Schulbuch Deutsch NRW Kl. 9, Kap. 5 (TrustLevel: OFFICIAL_BINDING)
```

### 10.2 Letztentscheidung bleibt bei Lehrkraft

Das System gibt Empfehlungen. Lehrkraft trifft finale Entscheidung:
- "Ich akzeptiere / lehne den Vorschlag ab."
- "Ich korrigiere die Empfehlung selbst."
- "Schüler bespricht Vorschlag im Unterricht."

**Audit-Eintrag:** Welche Empfehlungen die Lehrkraft angenommen/abgelehnt hat (optional, für Reflexion).

---

## 11. Religion und Konfession

**Designinvariante:** Religion wird strikt getrennt; kein Vermischen von Inhalten.

### 11.1 Kategorisierung

| Fachkontext | Konfession | LLM-Input Filterung |
|---|---|---|
| Katholischer Religionsunterricht | Katholisch | Nur Chunks `religion=katholisch` oder `religion=konfessionssensibel_übergreifend` |
| Evangelischer Religionsunterricht | Evangelisch | Nur Chunks `religion=evangelisch` oder `religion=konfessionssensibel_übergreifend` |
| Ethik-Unterricht | n/a | Nur Chunks `religion=ethik_religionskundlich`, KEINE konfessionellen Inhalte |
| Übrige Fächer (Deutsch, Mathe, etc.) | n/a | Keine religiösen Hinweise (ausser explizit Schulvorgabe) |

### 11.2 Implementierung

- RAG-Filter: `WHERE religion IN (…)` als Pflichtfilter in Schritt 3.4.
- Konfession wird aus `teacher_profile.confessionality` gelesen (bei Schultritt-Setup).
- Falls Lehrkraft keine Konfession eingestellt hat: System fragt beim ersten Request nach.

### 11.3 Audit

- Audit-Log protokolliert `confessional_filter_applied=true` und `filter_value=catholicism`.
- Schuladmin kann überprüfen, ob Filterung ordnungsgemäss stattfand.

---

## 12. Verweise und weiterführende Dokumente

- **[ADR 0004: Local-First Student Data](../adr/0004-local-first-student-data.md)** – Architektur-Rationale für lokale Schülerdaten.
- **[THREAT_MODEL.md](./THREAT_MODEL.md)** – Identifizierte Sicherheits- und Datenschutz-Risiken.
- **[RETENTION_AND_DELETION.md](./RETENTION_AND_DELETION.md)** – Detailliertes Löschkonzept, Aufbewahrungsdauer, Rechtsgrundlagen.
- **[DATA_MODEL.md](../architecture/DATA_MODEL.md)** – Entity-Relationen, Datenklassen-Mapping.
- **[OPEN_QUESTIONS.md](../decisions/OPEN_QUESTIONS.md)** – Offene Datenschutz-Fragen, z.B. Notwendigkeit externen Audit, DSFA-Partner.

---

## 13. Checkliste für Schulimplementierung

Vor Produktivbetrieb durchgehen:

- [ ] Schulleitung und Datenschutzbeauftragte haben DATA_PROTECTION.md gelesen und verstanden.
- [ ] Vaultwarden (oder alternatives Secret-Management) ist aufgesetzt und betriebsbereit.
- [ ] Pseudonym-Mapping-Schlüssel in Vault hinterlegt (nicht in Code).
- [ ] PostgreSQL RLS ist auf allen `school_id`-Tabellen aktiviert.
- [ ] Audit-Log-Tabelle existiert, Automatische Retention (3 Jahre) ist konfiguriert.
- [ ] Lokale Ollama-Instanz (oder Cloud-LLM-Adapter) ist konfiguriert und getestet.
- [ ] Redaction- und Guard-Module sind Unit-getestet.
- [ ] RAG-Filter (Fach, Konfession, TrustLevel) sind integriert und getestet.
- [ ] CloudReleaseGrant-Template ist vorbereitet; Schulleitung kennt Unterzeichnungsprozess.
- [ ] Lehrkraft-Onboarding beinhaltet Erklärung: "Was bedeutet Pseudonymisierung? Wann sehe ich Schülernamen wieder?"
- [ ] Admin-Dashboard zeigt Audit-Logs; monatlicher Report an Datenschutzbeauftragte wird automatisiert.

---

**Dokument-Version:** 1.0  
**Ersteller:** Architektur-Team  
**Gültig ab:** 2026-06-22  
**Nächste Überprüfung:** 2027-06-22 (jährlich oder bei Gesetzesänderung)
