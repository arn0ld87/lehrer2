# Dedup-Strategie: Erkennung und Vermeidung inhaltsdoppelter Quellen

## Kontext

Jede Quelle (`source_ref`) erhält ihren SHA-256-Content-Hash (`content_hash`) erst am
Ende der Ingestion — atomar innerhalb der PG-Transaktion, zusammen mit den
`rag_chunk`-Records und dem Status `INGESTED`. Der Hash ist daher während des gesamten
Zwischenzeitraums (Status `DISCOVERED` bis `APPROVED`) **null**.

Der partielle Unique-Index `source_ref_content_hash_uniq` greift ausschließlich für
`IS NOT NULL`-Werte:

```sql
CREATE UNIQUE INDEX source_ref_content_hash_uniq
  ON source_ref (content_hash)
  WHERE content_hash IS NOT NULL;
```

Das bedeutet: Mehrere Quellen mit identischem Inhalt können gleichzeitig die Pipeline
durchlaufen — ihren Duplikat-Charakter erkennt die DB erst beim letzten
`UPDATE … SET content_hash = …`, wenn die zweite Quelle eine **Unique-Violation** auslöst.
Diese Fehlermeldung war bisher kryptisch und kam nach erheblicher Embedding- und
Qdrant-Arbeit.

---

## Heutige DB-Garantie (fail-closed)

Der partielle Unique-Index **verhindert zuverlässig**, dass zwei Quellen mit
identischem Inhalt gleichzeitig den Status `INGESTED` tragen. Die Garantie ist
**fail-closed**: Die zweite Ingestion schlägt fehl (Unique-Violation), statt still
ein Duplikat zu erzeugen. Kein INGESTED-Duplikat kann in den Vektorspeicher gelangen.

---

## Interim-Verbesserung: Früherkennung per `DuplicateContentError` (#43)

Seit Issue #43 erkennt `ingestSource` Duplikate **früh** — direkt nach der
Hash-Berechnung (Schritt 3b), noch vor Embedding- und Qdrant-Arbeit:

1. SHA-256 des Rohdokuments berechnen.
2. Per `findExistingSourceForHash()` prüfen: Hält bereits eine **andere** `source_ref`
   (≠ eigene `sourceRefId`) diesen Hash?
3. Wenn ja → `DuplicateContentError` werfen mit:
   - `contentHash` — der kollidierende Hash
   - `existingSourceRefId` — die ID der Quelle, die den Hash bereits besitzt

```typescript
// Beispiel: Aufrufer kann gezielt auf Duplikat reagieren
try {
  await ingestSource(deps, sourceRefId);
} catch (err) {
  if (err instanceof DuplicateContentError) {
    // Kein Embedding verschwendet; existingSourceRefId enthält die bekannte Quelle
    console.warn(`Duplikat erkannt: ${sourceRefId} → ${err.existingSourceRefId}`);
  }
}
```

**Verhalten:** fail-loud (kein stilles Schlucken). Der Status der neuen Quelle bleibt
`APPROVED` (nicht `INGESTED`), kein Qdrant-Punkt und kein `rag_chunk`-Record werden
angelegt. Der DB-Unique-Index bleibt als zweite Sicherheitslinie aktiv.

**Re-Ingest derselben Quelle:** `findExistingSourceForHash()` schließt die eigene
`sourceRefId` explizit aus (`ne(sourceRef.id, ownSourceRefId)`). Ein erneuter
Ingest-Versuch derselben Quelle wird durch diesen Check nicht blockiert.

---

## NULL-Fenster und Race-Condition

Das NULL-Fenster (contentHash = null, Status zwischen `DISCOVERED` und `APPROVED`)
ermöglicht theoretisch, dass mehrere Quellen mit identischem Inhalt gleichzeitig
die GATE-Prüfung passieren. Der Dedup-Check in Schritt 3b erkennt Duplikate nur,
wenn die erste Quelle bereits vollständig ingestiert wurde (contentHash gesetzt).

**Konkurrente Ingestion:** Laufen zwei Instanzen von `ingestSource` für identische
Inhalte parallel, kann Schritt 3b für beide `null` zurückgeben — der DB-Unique-Index
fängt das dann beim zweiten `UPDATE` ab (Unique-Violation, kein stilles Duplikat).

Für die aktuelle Single-Worker-Architektur ist das NULL-Fenster kein Problem in
der Praxis; bei horizontaler Skalierung der Ingestion bleibt der DB-Index die
letzte Absicherung.

---

## Zielzustand: Pre-Hash beim Upload (geplanter Integrationspunkt)

Sobald ein **Upload-Bytes-Flow** existiert (Lehrkraft lädt Datei hoch, bevor die
Quelle registriert wird), soll der SHA-256-Hash **vor der `create()`-Anlage**
berechnet werden:

1. Rohbytes empfangen, Hash berechnen.
2. Lookup: Existiert bereits eine `source_ref` mit diesem Hash? → Aufrufer
   erhält die ID der bestehenden Quelle zurück; keine neue Zeile wird angelegt.
3. Nur wenn kein Duplikat: `create()` aufrufen, `contentHash` ggf. bereits setzen
   (erfordert Schema-Änderung: `contentHash` beim `create()` schreiben statt nullable lassen).

Dieser Flow **eliminiert das NULL-Fenster** vollständig und macht den Dedup-Check
in Schritt 3b redundant (kann dann entfernt oder als Defense-in-depth belassen werden).

**Status heute:** Der Upload-Bytes-Flow existiert noch nicht (es gibt `putObject`
in `src/lib/infra/minio.ts`, aber keinen übergeordneten Upload-Endpunkt mit
Hash-Berechnung). Dieser Abschnitt dokumentiert den geplanten Integrationspunkt;
er ist NICHT implementiert und wird erst relevant, wenn der Upload-Flow gebaut wird.

---

## Option: Periodischer Dedup-Report

Für eine spätere Betriebsphase (z. B. bei Bulk-Import historischer Quellen) kann
ein periodischer Dedup-Job sinnvoll sein:

- Query: alle `content_hash`-Werte, die von mehr als einer `source_ref` gehalten
  werden (sollte nach aktueller Garantie nie auftreten, aber defensiv prüfbar).
- Report an Maintainer als GitHub Issue oder Log-Eintrag.
- Keine automatische Bereinigung — Entscheidung bleibt beim Maintainer
  (welche der Duplikat-Quellen behalten / welche `REVOKED` werden soll).

Eine Hilfsfunktion `findDuplicateContentHashes()` kann bei Bedarf in
`src/lib/db/repositories/sources.pg.ts` ergänzt werden.

---

## Referenzen

- [./INGESTION_POLICY.md](./INGESTION_POLICY.md) — Governance-Gate und Ingestion-Schritte
- `src/lib/rag/ingest.ts` — Implementierung (`DuplicateContentError`, `findExistingSourceForHash`, Schritt 3b)
- `src/lib/db/schema/artifacts.ts` — `sourceRef`-Tabelle, partieller Unique-Index
- GitHub Issue #43
