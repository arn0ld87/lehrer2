/**
 * index.ts — Öffentliche API der RAG-Evaluierungs-Suite
 *
 * Re-exportiert alle öffentlichen Typen und Funktionen aus den Untermodulen.
 */

// GoldenQuestion — Typ, Loader, Enums
export type {
  GoldenQuestion,
  GoldenDomain,
  GoldenConfessionContext,
  GoldenStatus,
} from "./golden-questions";
export { parseGoldenQuestions, GOLDEN_DOMAINS, GOLDEN_CONFESSION_CONTEXTS, GOLDEN_STATUSES } from "./golden-questions";

// Metriken
export { precisionAtK, recallAtK, reciprocalRank } from "./metrics";

// Evaluierungs-Harness
export type {
  RetrievedHit,
  RetrieveFn,
  EvalResultPerQuestion,
  DomainStats,
  EvalSummary,
} from "./run-eval";
export { runEvaluation } from "./run-eval";

// Drift-Erkennung
export type { MetricBaseline, MetricRegression, DriftResult } from "./drift";
export { detectDrift, DEFAULT_DRIFT_THRESHOLD } from "./drift";
