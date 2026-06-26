/**
 * run-eval.ts — RAG-Evaluierungs-Harness (Orchestrierung)
 *
 * Führt alle aktiven GoldenQuestions gegen eine RetrieveFn aus,
 * berechnet Metriken pro Frage und aggregiert zu einer EvalSummary.
 *
 * Design-Entscheidungen:
 *   - RetrieveFn ist vom echten retrieve() entkoppelt — der Adapter kommt vom Caller.
 *   - Kein Date.now()/new Date() im Modul; generatedAt wird als Parameter hereingereicht.
 *   - Fragen mit status != "active" (blocked-*) werden übersprungen.
 *   - byDomain aggregiert über alle aktiven Fragen.
 */

import type { GoldenQuestion } from "./golden-questions";
import { precisionAtK, recallAtK, reciprocalRank } from "./metrics";

// ── Öffentliche Typen ─────────────────────────────────────────────────────────

/** Ein einzelner Retrieval-Treffer (entkoppelt von Qdrant/RankedCitation). */
export interface RetrievedHit {
  sourceId: string;
}

/**
 * RetrieveFn — schlanke Retrieval-Abstraktion für die Eval-Suite.
 *
 * Der Caller adaptiert die echte retrieve()-Funktion auf dieses Interface,
 * damit der Eval-Harness keinen Qdrant-/Embedder-Import benötigt.
 */
export type RetrieveFn = (query: string) => Promise<RetrievedHit[]>;

/** Metriken für eine einzelne GoldenQuestion. */
export interface EvalResultPerQuestion {
  id: string;
  domain: string;
  confessionContext: string;
  precisionAt5: number;
  recallAt10: number;
  reciprocalRank: number;
}

/** Domain-aggregierte Metriken. */
export interface DomainStats {
  count: number;
  meanPrecisionAt5: number;
  meanRecallAt10: number;
  meanReciprocalRank: number;
}

/** Aggregierte Zusammenfassung eines Eval-Laufs. */
export interface EvalSummary {
  /** ISO8601-Zeitstempel des Eval-Laufs (vom Caller übergeben — deterministisch). */
  generatedAt: string;
  /** Gesamtzahl der GoldenQuestions (aktive + übersprungene). */
  total: number;
  /** Anzahl übersprungener Fragen (status != "active", d. h. blocked-*). */
  skippedBlocked: number;
  /** Mittelwert P@5 über alle aktiven Fragen. */
  meanPrecisionAt5: number;
  /** Mittelwert R@10 über alle aktiven Fragen. */
  meanRecallAt10: number;
  /** Mean Reciprocal Rank über alle aktiven Fragen. */
  meanReciprocalRank: number;
  /** Aufschlüsselung nach Domäne (Schlüssel = domain-String). */
  byDomain: Record<string, DomainStats>;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ── runEvaluation ─────────────────────────────────────────────────────────────

/**
 * Führt alle aktiven GoldenQuestions gegen `retrieve` aus und berechnet Metriken.
 *
 * @param opts.retrieve      Retrieval-Funktion (vom Caller adaptiert)
 * @param opts.questions     Geladene GoldenQuestions
 * @param opts.generatedAt   ISO8601-Zeitstempel (vom Caller — kein Date.now() hier)
 */
export async function runEvaluation(opts: {
  retrieve: RetrieveFn;
  questions: GoldenQuestion[];
  generatedAt: string;
}): Promise<{ perQuestion: EvalResultPerQuestion[]; summary: EvalSummary }> {
  const { retrieve, questions, generatedAt } = opts;

  const perQuestion: EvalResultPerQuestion[] = [];
  let skippedBlocked = 0;

  for (const q of questions) {
    // Blockierte Fragen überspringen (jede Nicht-active-Variante: Quelle fehlt
    // oder ist noch nicht freigegeben). Nur "active" wird evaluiert.
    if (q.status !== "active") {
      skippedBlocked++;
      continue;
    }

    const hits = await retrieve(q.query);
    const retrievedIds = hits.map((h) => h.sourceId);

    perQuestion.push({
      id: q.id,
      domain: q.domain,
      confessionContext: q.confessionContext,
      precisionAt5: precisionAtK(retrievedIds, q.expectedSourceIds, 5),
      recallAt10: recallAtK(retrievedIds, q.expectedSourceIds, 10),
      reciprocalRank: reciprocalRank(retrievedIds, q.expectedSourceIds),
    });
  }

  // ── Aggregation ───────────────────────────────────────────────────────────

  const meanPrecisionAt5 = mean(perQuestion.map((r) => r.precisionAt5));
  const meanRecallAt10 = mean(perQuestion.map((r) => r.recallAt10));
  const meanReciprocalRank = mean(perQuestion.map((r) => r.reciprocalRank));

  // byDomain: gruppiere nach domain
  const domainGroups: Record<string, EvalResultPerQuestion[]> = {};
  for (const result of perQuestion) {
    const group = domainGroups[result.domain] ?? [];
    group.push(result);
    domainGroups[result.domain] = group;
  }

  const byDomain: Record<string, DomainStats> = {};
  for (const [domain, results] of Object.entries(domainGroups)) {
    byDomain[domain] = {
      count: results.length,
      meanPrecisionAt5: mean(results.map((r) => r.precisionAt5)),
      meanRecallAt10: mean(results.map((r) => r.recallAt10)),
      meanReciprocalRank: mean(results.map((r) => r.reciprocalRank)),
    };
  }

  const summary: EvalSummary = {
    generatedAt,
    total: questions.length,
    skippedBlocked,
    meanPrecisionAt5,
    meanRecallAt10,
    meanReciprocalRank,
    byDomain,
  };

  return { perQuestion, summary };
}
