/**
 * retrieve.ts — Quellengebundenes Retrieval mit Reranking und vollständiger Zitation
 * M2 Schritt 2 (#18)
 *
 * Ablauf (fail-closed):
 *   query → embedder.embed([query])
 *   → SearchFilter bauen (trustLevelNot=UNVERIFIED IMMER; Konfessionsfilter PFLICHT wenn subject gesetzt)
 *   → store.search(vector, filter, k * OVERSAMPLE_FACTOR)
 *   → MMR-Reranking (deterministisch, lokal, keine externen Dependencies)
 *   → Zitations-Assemblierung via assembleCitation()
 *   → unvollständige Zitationen verwerfen
 *   → RankedCitation[] (maximal k Einträge)
 *
 * Invarianten (nicht verhandelbar):
 *   - trustLevelNot = 'UNVERIFIED' wird IMMER gesetzt (auch ohne minTrust-Option).
 *   - Konfessionsfilter ist serverseitig PFLICHT bei subject ∈ {Religion, Ethik}.
 *   - Religion und Ethik werden NIE gemischt.
 *   - Kein Treffer ohne vollständige Zitation.
 *   - Keine schweren externen Reranking-Pakete (kein Cross-Encoder).
 */

import type { Embedder } from "@/lib/infra/ollama";
import type { VectorStore, SearchFilter } from "@/lib/infra/qdrant";
import type { Subject as UiSubject } from "@/lib/types";
import type { SourceRefMeta } from "./citation";
import { assembleCitation } from "./citation";
import type { RankedCitation, SourceTrustLevel } from "./citation";
import { uiSubjectToDb, uiConfessionToDbContexts } from "@/lib/db/repositories/mapping";

// ── Konstanten ────────────────────────────────────────────────────────────────

/**
 * Überfetch-Faktor: Qdrant gibt k * OVERSAMPLE_FACTOR Treffer zurück,
 * damit MMR-Reranking genug Kandidaten hat und unvollständige Zitationen
 * verworfen werden können, ohne die Ergebnismenge zu leeren.
 */
const OVERSAMPLE_FACTOR = 3;

/** Standard-Ergebnismenge, wenn k in opts nicht gesetzt. */
const DEFAULT_K = 5;

/**
 * MMR-Diversitäts-Lambda:
 *   λ = 1.0 → reines Score-Ranking (kein Diversity-Penalty)
 *   λ = 0.5 → ausgewogene Balance
 * Wir wählen 0.7: primär relevanz-getrieben, mit moderater Diversifikation.
 * Deterministisch: gleiche Eingabe → gleiche Ausgabe.
 */
const MMR_LAMBDA = 0.7;

// ── Trust-Level-Ordnung (für minTrust-Filter) ─────────────────────────────────

const TRUST_ORDER: Record<SourceTrustLevel, number> = {
  OFFICIAL_BINDING: 4,
  OFFICIAL_GUIDANCE: 3,
  OPEN_CURATED: 2,
  USER_APPROVED: 1,
  UNVERIFIED: 0,
};

// ── Interfaces ────────────────────────────────────────────────────────────────

/**
 * SourceRefReader — dünnes Interface für den Lese-Zugriff auf sourceRef-Metadaten.
 * Ermöglicht eine Fake-Implementierung in Tests ohne DB-Zugriff.
 *
 * Spiegelt das IngestDeps-Muster aus ingest.ts: Abhängigkeiten werden injiziert,
 * nie direkt importiert.
 */
export interface SourceRefReader {
  /**
   * Liest die Metadaten einer sourceRef-Zeile anhand ihrer ID.
   * Gibt null zurück, wenn die Quelle nicht gefunden wird.
   */
  getById(sourceId: string): Promise<SourceRefMeta | null>;
}

/**
 * RetrieveDeps — injizierte Abhängigkeiten für retrieve().
 * Kein direkter DB-Zugriff, kein fetch — alles über Interfaces.
 */
export interface RetrieveDeps {
  embedder: Embedder;
  store: VectorStore;
  sourceRefReader: SourceRefReader;
}

/**
 * RetrieveOpts — optionale Steuerparameter für eine Retrieval-Anfrage.
 */
export interface RetrieveOpts {
  /** UI-Fach-Filter (deutsch/evangelische-religion/katholische-religion/ethik). */
  subject?: UiSubject;
  /**
   * Alias für subject — aus Rückwärtskompatibilität akzeptiert;
   * subject hat Vorrang wenn beide angegeben.
   */
  confession?: UiSubject;
  /**
   * Mindest-Vertrauensstufe. Treffer unterhalb dieser Stufe werden verworfen.
   * UNVERIFIED-Treffer werden IMMER verworfen, unabhängig von minTrust.
   */
  minTrust?: SourceTrustLevel;
  /** Maximale Anzahl zurückgegebener Zitationen (Default: 5). */
  k?: number;
}

// ── MMR-Reranking ─────────────────────────────────────────────────────────────

/**
 * Kosinus-Ähnlichkeit zwischen zwei Vektoren.
 * Beide müssen gleiche Dimension haben. Gibt 0 zurück bei Nullvektor.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * MMR (Maximal Marginal Relevance) — deterministisches Score-basiertes Reranking.
 *
 * Wählt iterativ den Kandidaten aus, der den besten Trade-off zwischen
 * Ähnlichkeit zur Query (relevance) und Unähnlichkeit zu bereits gewählten
 * Treffern (diversity) bietet.
 *
 * MMR(d) = λ * sim(d, query) - (1 - λ) * max_{d' ∈ S} sim(d, d')
 *
 * @param candidates  Array mit {vector, score, index} — vector kann fehlen (Fake-Store
 *                    liefert keinen Vektor zurück); in diesem Fall wird nur der
 *                    ursprüngliche Score als Relevanz-Maßstab genutzt (λ = 1).
 * @param queryVector Embedding-Vektor der Query.
 * @param k           Maximale Anzahl zu wählender Treffer.
 * @param lambda      Diversitäts-Lambda (0..1).
 * @returns           Indizes der gewählten Kandidaten in MMR-Reihenfolge.
 */
function mmrRerank(
  candidates: Array<{ score: number; idx: number; vector?: number[] }>,
  queryVector: number[],
  k: number,
  lambda: number,
): number[] {
  if (candidates.length === 0) return [];

  const selected: number[] = []; // Indizes der gewählten Kandidaten
  const remaining = new Set(candidates.map((_, i) => i));

  while (selected.length < k && remaining.size > 0) {
    let bestLocalIdx = -1;
    let bestScore = -Infinity;

    for (const localIdx of remaining) {
      const cand = candidates[localIdx]!;

      // Relevanz: ursprünglicher Qdrant-Score (Kosinus-Ähnlichkeit ≈ normiert)
      const relevance = cand.score;

      // Diversity: maximale Ähnlichkeit zu bereits gewählten Treffern
      let maxSim = 0;
      if (cand.vector && cand.vector.length > 0) {
        for (const selLocalIdx of selected) {
          const selCand = candidates[selLocalIdx]!;
          if (selCand.vector && selCand.vector.length > 0) {
            const sim = cosineSimilarity(cand.vector, selCand.vector);
            if (sim > maxSim) maxSim = sim;
          }
        }
      }

      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestLocalIdx = localIdx;
      }
    }

    if (bestLocalIdx === -1) break;
    selected.push(bestLocalIdx);
    remaining.delete(bestLocalIdx);
  }

  return selected.map((localIdx) => candidates[localIdx]!.idx);
}

// ── retrieve() ────────────────────────────────────────────────────────────────

/**
 * retrieve — quellengebundenes Retrieval mit Reranking und vollständiger Zitation.
 *
 * Öffentliche API-Signatur:
 *   retrieve(deps: RetrieveDeps, query: string, opts?: RetrieveOpts): Promise<RankedCitation[]>
 *
 * Fail-closed-Invarianten:
 *   1. trustLevelNot = 'UNVERIFIED' ist immer im Filter — UNVERIFIED-Chunks
 *      erscheinen nie im Ergebnis, auch wenn minTrust nicht gesetzt ist.
 *   2. Bei subject ∈ {evangelische-religion, katholische-religion, ethik} ist
 *      confessionContextIn ein Pflichtfilter — kein Cross-Strang-Retrieval.
 *   3. Treffer ohne vollständige Zitation (fehlende Pflichtfelder) werden verworfen.
 *   4. Reranking ist lokal und deterministisch (MMR, kein externer Cross-Encoder).
 */
export async function retrieve(
  deps: RetrieveDeps,
  query: string,
  opts: RetrieveOpts = {},
): Promise<RankedCitation[]> {
  const { embedder, store, sourceRefReader } = deps;
  const k = opts.k ?? DEFAULT_K;
  const effectiveSubject = opts.subject ?? opts.confession;

  // ── (1) Query embedden ────────────────────────────────────────────────────
  const vectors = await embedder.embed([query]);
  const queryVector = vectors[0];
  if (!queryVector || queryVector.length === 0) {
    throw new Error("retrieve: embedder lieferte keinen Vektor für die Query");
  }

  // ── (2) SearchFilter bauen (fail-closed) ──────────────────────────────────
  const filter: SearchFilter = {
    // INVARIANTE: UNVERIFIED immer ausschließen
    trustLevelNot: "UNVERIFIED",
  };

  if (effectiveSubject) {
    const { subject: dbSubject } = uiSubjectToDb(effectiveSubject);
    filter.subject = dbSubject;

    // INVARIANTE: Konfessionsfilter PFLICHT bei Religion und Ethik
    const confessionContexts = uiConfessionToDbContexts(effectiveSubject);
    if (confessionContexts.length > 0) {
      filter.confessionContextIn = confessionContexts;
    }
    // deutsch: kein confessionContextIn — nur subject=DEUTSCH filtert
  }

  // ── (3) Qdrant-Suche mit Überfetch ────────────────────────────────────────
  const searchLimit = k * OVERSAMPLE_FACTOR;
  const hits = await store.search(queryVector, filter, searchLimit);

  if (hits.length === 0) {
    return [];
  }

  // ── (4) minTrust-Filter (post-search, deterministisch) ────────────────────
  const minTrustLevel = opts.minTrust;
  const filteredHits = minTrustLevel
    ? hits.filter((hit) => {
        const tl = hit.payload.trust_level as SourceTrustLevel | undefined;
        if (!tl) return false;
        return (TRUST_ORDER[tl] ?? -1) >= (TRUST_ORDER[minTrustLevel] ?? 0);
      })
    : hits;

  if (filteredHits.length === 0) {
    return [];
  }

  // ── (5) MMR-Reranking ─────────────────────────────────────────────────────
  // FakeVectorStore liefert keinen Vektor im Treffer zurück — vector bleibt undefined.
  // MMR degeneriert dann zu reinem Score-Ranking (λ = 1), was deterministisch ist.
  const candidates = filteredHits.map((hit, idx) => ({
    score: hit.score,
    idx,
    // QdrantStore liefert keine Vektoren in Suchergebnissen zurück (Standard-Qdrant-API);
    // FakeVectorStore ebenso. Vektoren stehen für MMR daher nicht zur Verfügung —
    // wir nutzen den Score als Relevanz-Proxy (lambda-gewichtetes Fallback).
    vector: undefined as number[] | undefined,
  }));

  const rankedIndices = mmrRerank(candidates, queryVector, k, MMR_LAMBDA);

  // ── (6) Zitations-Assemblierung ───────────────────────────────────────────
  const citations: RankedCitation[] = [];

  for (const hitIdx of rankedIndices) {
    const hit = filteredHits[hitIdx];
    if (!hit) continue;

    const sourceId = typeof hit.payload.source_id === "string" ? hit.payload.source_id : null;
    if (!sourceId) continue;

    // sourceRef-Metadaten laden (via injiziertem Reader — kein direkter DB-Zugriff)
    const meta = await sourceRefReader.getById(sourceId);
    if (!meta) continue;

    const result = assembleCitation(hit.payload, hit.score, meta);
    if (!result.complete) {
      // Pflichtfeld fehlt → Treffer verwerfen (nie erfinden)
      continue;
    }

    citations.push(result.citation);

    if (citations.length >= k) break;
  }

  return citations;
}
