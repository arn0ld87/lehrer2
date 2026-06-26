/**
 * drift.ts — Metriken-Drift-Erkennung für die RAG-Evaluierungs-Suite
 *
 * Vergleicht einen aktuellen Eval-Lauf mit einer gespeicherten Baseline.
 * Flaggt jede Metrik, deren aktueller Wert um mehr als `threshold` UNTER
 * dem Baseline-Wert liegt (Regression).
 *
 * Kein I/O, keine Seiteneffekte — reine Funktion.
 */

import type { EvalSummary } from "./run-eval";

// ── Typen ─────────────────────────────────────────────────────────────────────

/**
 * Gespeicherte Baseline-Metriken eines früheren Eval-Laufs.
 * Wird aus einer JSON-Datei oder einer DB-Zeile geladen (Caller-Verantwortung).
 */
export interface MetricBaseline {
  /** ISO8601-Zeitstempel des Baseline-Laufs */
  generatedAt: string;
  meanPrecisionAt5: number;
  meanRecallAt10: number;
  meanReciprocalRank: number;
}

/**
 * Standard-Drift-Schwellenwert: 0.05 (5 Prozentpunkte).
 * Eine Metrik gilt als regressiert, wenn sie mehr als diesen Wert
 * unter dem Baseline-Wert liegt.
 */
export const DEFAULT_DRIFT_THRESHOLD = 0.05;

/** Einzelne Regression einer Metrik. */
export interface MetricRegression {
  metric: string;
  baseline: number;
  current: number;
  /** Negativ bei Regression (current − baseline). */
  delta: number;
}

/** Ergebnis der Drift-Erkennung. */
export interface DriftResult {
  hasDrift: boolean;
  regressions: MetricRegression[];
}

// ── detectDrift ───────────────────────────────────────────────────────────────

/**
 * Vergleicht `current` mit `baseline` und meldet Regressionen.
 *
 * Eine Regression liegt vor, wenn:
 *   baseline_value − current_value > threshold
 * (d. h. der aktuelle Wert liegt um mehr als `threshold` unter dem Baseline-Wert)
 *
 * @param current   EvalSummary des aktuellen Laufs
 * @param baseline  Gespeicherte Baseline; null → kein Vergleich möglich → kein Drift
 * @param threshold Schwellenwert (Default: 0.05)
 */
export function detectDrift(
  current: EvalSummary,
  baseline: MetricBaseline | null,
  threshold: number = DEFAULT_DRIFT_THRESHOLD,
): DriftResult {
  if (baseline === null) {
    return { hasDrift: false, regressions: [] };
  }

  const checks: Array<{ metric: string; baseline: number; current: number }> = [
    {
      metric: "meanPrecisionAt5",
      baseline: baseline.meanPrecisionAt5,
      current: current.meanPrecisionAt5,
    },
    {
      metric: "meanRecallAt10",
      baseline: baseline.meanRecallAt10,
      current: current.meanRecallAt10,
    },
    {
      metric: "meanReciprocalRank",
      baseline: baseline.meanReciprocalRank,
      current: current.meanReciprocalRank,
    },
  ];

  const regressions: MetricRegression[] = [];

  for (const check of checks) {
    const delta = check.current - check.baseline;
    // Regression: aktueller Wert liegt um mehr als threshold UNTER Baseline.
    // EPSILON (1e-9) gegen Float-Ungenauigkeit (z. B. 0.8 - 0.05 ≠ exakt 0.75),
    // damit eine Regression exakt in Threshold-Höhe NICHT fälschlich zählt.
    if (check.baseline - check.current > threshold + 1e-9) {
      regressions.push({
        metric: check.metric,
        baseline: check.baseline,
        current: check.current,
        delta,
      });
    }
  }

  return {
    hasDrift: regressions.length > 0,
    regressions,
  };
}
