# Evaluierungsplan für RAG-Antworten

## Ziel der Evaluierung

Dieser Plan definiert, wie die Qualität der vom LSA generierten Antworten systematisch gemessen, überwacht und kontinuierlich verbessert wird. Evaluierung ist nicht einmalig, sondern ein fortlaufender Prozess mit Schwerpunkten auf:

1. **Retrieval-Qualität**: Findet die Vektorsuche die richtigen Quellen?
2. **Zitations-Korrektheit**: Werden Belege korrekt angegeben und sind sie sachlich zutreffend?
3. **Konfessions-Sensibilität** (Religion): Wird das evangelische, katholische oder übergreifende Framing korrekt bewahrt?
4. **Halluzinations-Sicherheit**: Macht das LLM-Modell ungestützte oder erfundene Aussagen?
5. **Abdeckung und Relevanz**: Sind die Antworten für den Lehralltag in Sachsen-Anhalt praktisch nutzbar?
6. **Performance**: Antwortlatenz, Kosten, API-Durchsatz — sind Pädagogenanforderungen erfüllt?

---

## Golden-Questions-Konzept (Methodologie)

Das System wird mit **Golden Questions** evaluiert — diese sind Testfragen pro Fachgebiet und pro Konfession, deren **richtige Antworten** bekannt sind und gegen die Ausgaben des LSA verglichen werden.

### Golden Questions für Deutsch

**Methodik**: Pro Kompetenzbereich (Sprechen, Schreiben, Leseverstehen, Grammatik) werden mind. 3–5 Beispielfragen erarbeitet, die:

- Ein häufiges pädagogisches Anliegen abbilden (z. B. "Wie unterrichte ich Kommaregeln strukturiert?")
- Mit **Lehrplan-Bezug** (Sachsen-Anhalt Klasse 9–10 Deutsch) beantwortbar sind
- Mehrere Quellen-Typen aktivieren (Lehrplan selbst, Handreichung, Beispiel-Unterrichtsreihe)
- **Noch auszuarbeiten**: konkrete Fragesammlungen werden vom Fachteam gepflegt (nicht erfunden)

**Beispiel-Struktur** (nicht konkrete Fragen, nur Template):

```
{
  "id": "de-001",
  "domain": "Deutsch",
  "competency": "Schreiben – Argumentative Texte",
  "question": "[hier später konkrete Frage eintragen]",
  "expected_sources": [
    "Lehrplan Sachsen-Anhalt Deutsch 2021",
    "Handreichung Argumentatives Schreiben (Kultusministerium)"
  ],
  "expected_answer_elements": [
    "[noch auszuarbeiten: Schlüsselkonzepte, die in der Antwort vorkommen müssen]"
  ],
  "confidence_threshold": 0.8  // Mindest-Confidence für akzeptabel
}
```

### Golden Questions für Religion

**Konfessions-Differenzierung**: Je Frage wird festgelegt, ob sie:

- **Evangelisch spezifisch** ist (theologische Inhalte, Katechismus, Glaube)
- **Katholisch spezifisch** ist (Dogmatik, liturgische Traditionen)
- **Übergreifend** ist (Ethik, Religionsgeschichte, Dialog zwischen Konfessionen)

**Methodik**: Pro Konfession und Kompetenzbereich (z. B. "Evangelische Ethik – Verantwortung", "Katholische Sakramentenlehre") mind. 3–5 Golden Questions, die:

- Sachlich und glaubenstreue darstellen
- Mit Lehrplan Sachsen-Anhalt Evangelische/Katholische Religion (Klasse 5–12) konsistent sind
- **Noch auszuarbeiten**: konkrete Fragesammlungen werden vom Konfessionsberatungs-Team gepflegt
- Markieren, welche Quellen neutral sein müssen (z. B. Rechtsethik) vs. welche konfessionsgebunden

**Beispiel-Struktur**:

```
{
  "id": "rel-ev-001",
  "domain": "Religion",
  "confession": "evangelisch",
  "competency": "Schöpfung und Verantwortung",
  "question": "[später konkrete Frage]",
  "confession_context": "evangelisch",  // oder "katholisch" oder "übergreifend"
  "expected_sources": [
    "Lehrplan Evangelische Religion Sachsen-Anhalt",
    "[weitere Quellen-Dokumente]"
  ],
  "expected_answer_elements": [
    "[später: Schlüsselkonzepte]"
  ],
  "confidence_threshold": 0.75
}
```

**Wichtig**: Die Golden-Questions-Datenbank wird **manuell gepflegt** und regelmäßig mit Fachexperten validiert. Keine erfundenen oder GPT-generierten Fragen.

---

## Evaluierungs-Metriken

### 1. Retrieval-Qualität

| Metrik                         | Definition                                                    | Akzeptanzbereich | Messpunkt           |
| ------------------------------ | ------------------------------------------------------------- | ---------------- | ------------------- |
| **Precision@5**                | Anteil relevanter Chunks in den Top-5 Retrievals              | ≥ 0.80           | pro Golden Question |
| **Recall@10**                  | Anteil aller relevanten Chunks, die in Top-10 gefunden werden | ≥ 0.75           | pro Golden Question |
| **MRR (Mean Reciprocal Rank)** | Durchschn. Rang des ersten relevanten Results                 | ≥ 0.70           | über alle Queries   |
| **NDCG@5**                     | Rank-gewichtete Relevanz-Akkumulation                         | ≥ 0.70           | über alle Queries   |

**Messmethode**: Qdrant-Ähnlichkeit kombiniert mit manueller Annotation (0 = nicht relevant, 1 = hochrelevant). Automated Check: Quell-ID in Top-5 enthalten?

### 2. Zitations-Korrektheit

| Metrik                      | Definition                                            | Akzeptanzbereich | Messpunkt      |
| --------------------------- | ----------------------------------------------------- | ---------------- | -------------- |
| **Citation Accuracy**       | Zitierte Quelle existiert und enthält behauptete Info | ≥ 0.95           | pro Antwort    |
| **Source-to-Content Match** | Zitierte Seite/Abschnitt ist tatsächlich relevant     | ≥ 0.90           | pro Zitation   |
| **Coverage**                | Anteil der Antworten mit mind. einer Quelle           | = 1.0            | alle Antworten |
| **Unsupported Claims**      | Anteil Sätze ohne Quellenangabe in Faktenfragen       | ≤ 0.05           | pro Antwort    |

**Messmethode**: Manuelles Spot-Check (menschliche Reviewer durchsucht Quellentext nach zitiertem Beleg). Automated Check: `citation_present` und `source_chunk_id_valid` in Response-Metadaten vorhanden?

### 3. Konfessions-Scope-Treue (Religion)

| Metrik                   | Definition                                                            | Akzeptanzbereich | Messpunkt                        |
| ------------------------ | --------------------------------------------------------------------- | ---------------- | -------------------------------- |
| **Confession Alignment** | Antwort entspricht konfessioneller Framing-Erwartung                  | ≥ 0.90           | pro Frage mit confession_context |
| **Ecumenical Boundary**  | Übergreifende Fragen vermeiden konfessionalistische Spitzfindigkeiten | ≥ 0.85           | pro übergreifende Frage          |
| **Neutrality (Ethik)**   | Ethik-Fragen sind konfessionsunabhängig formuliert                    | ≥ 0.95           | pro Ethik-Frage                  |

**Messmethode**: Manuell durch Konfessionsberatungs-Team (katholisch, evangelisch, Ethik). Frage: "Würde diese Antwort an evangelischen / katholischen Schulen akzeptabel sein?"

### 4. Halluzinations- und Ungrounded-Rate

| Metrik                    | Definition                                                       | Akzeptanzbereich | Messpunkt      |
| ------------------------- | ---------------------------------------------------------------- | ---------------- | -------------- |
| **Factual Hallucination** | Antwort enthält erfundene Fakten (z. B. falsche Lehrplan-Zitate) | ≤ 0.02           | pro Antwort    |
| **Source Hallucination**  | Antwort zitiert nicht existente Quellen                          | = 0              | alle Antworten |
| **Grounding Rate**        | Anteil der Aussagen, die in Retrieval-Set enthalten sind         | ≥ 0.90           | pro Antwort    |

**Messmethode**: Manuelles Fact-Checking durch Fachexperten; Qdrant-Verifizierung (sind zitierte Chunks tatsächlich retrieved?).

### 5. Antwortlatenz und Kosten

| Metrik                 | Definition                                                      | Target                                       | Messpunkt   |
| ---------------------- | --------------------------------------------------------------- | -------------------------------------------- | ----------- |
| **End-to-End Latency** | Zeit von Query bis finale Antwort                               | ≤ 3 Sekunden                                 | per Request |
| **Retrieval Latency**  | Zeit für Vektorsuche in Qdrant                                  | ≤ 500 ms                                     | per Request |
| **LLM Inference Time** | Zeit für Token-Generierung                                      | ≤ 2 Sekunden                                 | per Request |
| **Cost per Query**     | Monetary Cost (bei Cloud-APIs) oder Token-Input/Output (Ollama) | ≤ 0.10 € (Cloud) oder < 1000 tokens (Ollama) | pro Request |

**Messmethode**: Logging in Request-Handler; Prometheus/Datadog-Metriken. Bei Ollama: Token-Count aus llm-response.

---

## Bewertungsverfahren

### Automatisierte Checks

Laufen kontinuierlich in CI/CD oder regelmäßig scheduled:

1. **Schema-Validierung**: Ist Response-JSON strukturell korrekt?
   - Erforderliche Felder: `query`, `answer`, `citations`, `confidence`, `model`, `timestamp`
   - Citation-Struktur: `{ source_id, page, section, retrieved_at, license }`

2. **Source-Validität**: Sind alle `source_id`s in der Dokument-Registry registriert und NICHT revoked?
   - Automatischer Filter: revoked sources rauswerfen, Warnung loggen

3. **Trust-Level-Filter**: Keine `UNVERIFIED`-Quellen in Antwort?
   - Query-Filter prüfen: hat Qdrant-Query `trust_level != UNVERIFIED` gesetzt?

4. **Latenz und Fehlerquoten**: Monitoren pro Zeitfenster
   - P95-Latenz überschritten? Alert
   - Error-Rate > 1%? Alert

### Menschliche Evaluierung

Regelmäßig (mind. 2-wöchentlich oder nach Modell-Updates):

1. **Golden-Questions-Durchlauf**
   - Alle ausstehenden Golden Questions (max. 50 pro Session) durch LSA-Interface beantworten lassen
   - Antworten von 2 unabhängigen Fachexperten bewerten (Deutsch) oder Konfessionsberatern (Religion)
   - Disagreement lösen durch Diskussion oder Dritte Meinung

2. **User-Feedback-Sampling**
   - Falls Logging aktiviert: zufällige Sample von echten Lehrkraft-Queries bewerten
   - Frage: "War diese Antwort nützlich und sachlich korrekt?"
   - Negative Bewertungen: näher untersuchen (Citation-Problem? Halluzination? Relevanz?)

3. **Confessional Sensitivity Spot-Check**
   - Jede Woche 5–10 Antworten zu Religion-Fragen prüfen
   - Konfessionsberater: "Würde das an unserer Schulart Ärger geben?"

---

## Drift- und Regressions-Prüfung

### Szenario: Quellen-Update

Wenn neue Versionen von Lehrplan-Dokumenten ingestiert werden:

1. **Baseline-Test**: Letzte N Golden Questions mit alten Quellen evaluieren, Metriken B_old speichern
2. **Neue Quellen ingestieren** und Dokumente-Versionen updaten
3. **Re-Test**: Gleiche N Golden Questions mit neuen Quellen, Metriken B_new speichern
4. **Regression-Check**:
   - Wenn `(B_new.Precision - B_old.Precision) < -0.10`: Regression! Issue öffnen, Rollback erwägen
   - Wenn `B_new.Hallucination_Rate > B_old.Hallucination_Rate + 0.02`: Regression!
5. **Approval**: Nur wenn `B_new >= B_old` oder Unterschiede erklärbar und akzeptiert

### Szenario: Modell-Wechsel

Wenn LLM-Modell gewechselt wird (z. B. neue Ollama-Version oder anderer Provider):

1. **A/B-Test**: Beide Modelle in parallel auf 100 Golden Questions laufen lassen
2. **Vergleich**:
   - Precision, Recall, Hallucination-Rate, Latenz zwischen Modellen
   - Konfessionelle Sensibilität: unterscheidet sich die Antwortqualität?
3. **Entscheidung**: Nur wechseln, wenn Metriken gleich oder besser; Downtime ankündigen

---

## Abnahmeschwellen (Noch auszufüllen)

Die folgenden Schwellen werden in Abstimmung mit dem Schul- und Fachberatungs-Team finalisiert:

| Kriterium                     | Aktuell | Ziel Q4 2026 | Begründung                                               |
| ----------------------------- | ------- | ------------ | -------------------------------------------------------- |
| Precision@5 (Deutsch)         | ?       | ≥ 0.85       | Verbesserte Relevanz für Lehrkraft-Queries               |
| Precision@5 (Religion)        | ?       | ≥ 0.80       | Komplexere Konfessionalität, etwas höhere Fehlertoleranz |
| Citation Accuracy             | ?       | ≥ 0.95       | Rechtsschutz bei Lehrplan-Zitaten                        |
| Hallucination Rate            | ?       | ≤ 0.02       | Vertrauen ist kritisch                                   |
| Confessional Alignment (Rel.) | ?       | ≥ 0.90       | Schulfriedensschutz                                      |
| End-to-End Latency P95        | ?       | ≤ 4 Sekunden | Nutzergebenheit für synchrone Nutzung                    |

**Status**: Diese Werte werden nach den ersten evaluierten Durchläufen festgelegt.

---

## Evaluierungs-Governance

### Zuständigkeiten

- **Fachteam Deutsch**: Validiert Golden Questions, bewertet Retrieval und Halluzination
- **Konfessionsberatungs-Team**: Bewertet Religion-Fragen auf Konfessions-Treue
- **DevOps/QA**: Lädt automatisierte Checks aus, monitort Metriken-Dashboards
- **Projektleitung**: Authorisiert Modell- und Quellen-Wechsel, setzt finale Schwellenwerte

### Reporting

- **Täglich**: Latenz, Error-Rate, Source-Health-Dashboard (automatisch)
- **Wöchentlich**: Confessional Spot-Check Report (Konfessionsberatungs-Team)
- **Alle 2 Wochen**: Golden-Questions-Durchlauf (Fachexperten)
- **Monatlich**: Trend-Report (Metriken Y-o-Y, Halluzination-Rate-Prognose, empfohlene Verbesserungen)

### Change Log

Jeder große Evaluierungs-Milestone wird dokumentiert (z. B. in GitHub Issues mit Label `evaluation:milestone`):

- Datum, evaluierte Metriken, Ergebnis (bestanden/nicht bestanden)
- Falls nicht bestanden: Root-Cause (Modell? Quellen? Retrieval-Algorithmus?) und geplante Behebung

---

## Referenzen und weiterführende Dokumentation

- [./CITATION_STANDARD.md](./CITATION_STANDARD.md) — Standardformat für Zitationen in Responses
- [../../PLAN.md](../../PLAN.md) — Übergeordnete Projekt-Roadmap und Meilensteine
