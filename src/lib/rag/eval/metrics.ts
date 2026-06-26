/**
 * metrics.ts — Retrieval-Qualitätsmetriken für die RAG-Evaluierungs-Suite
 *
 * Alle Funktionen sind rein (keine Seiteneffekte, kein I/O).
 * Ein Treffer gilt als relevant, wenn seine sourceId in expectedSourceIds enthalten ist.
 *
 * Robustheit gegen Randfälle:
 *   - Leere Arrays → 0 (definiert, keine Exception)
 *   - k <= 0       → 0 (definiert, keine Exception)
 */

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/**
 * Gibt die ersten k Einträge des Arrays zurück.
 * Gibt [] zurück wenn k <= 0 oder das Array leer ist.
 */
function topK(items: string[], k: number): string[] {
  if (k <= 0 || items.length === 0) return [];
  return items.slice(0, k);
}

// ── Metriken ─────────────────────────────────────────────────────────────────

/**
 * Precision@K — Anteil relevanter Treffer unter den ersten K retrivierten Dokumenten.
 *
 * P@K = |{relevante Treffer in top-K}| / K
 *
 * Randfälle:
 *   - k <= 0 oder retrievedSourceIds leer → 0
 *   - expectedSourceIds leer              → 0 (kein Treffer kann relevant sein)
 */
export function precisionAtK(
  retrievedSourceIds: string[],
  expectedSourceIds: string[],
  k: number,
): number {
  if (k <= 0 || retrievedSourceIds.length === 0 || expectedSourceIds.length === 0) return 0;

  const topKIds = topK(retrievedSourceIds, k);
  const expectedSet = new Set(expectedSourceIds);
  const relevantCount = topKIds.filter((id) => expectedSet.has(id)).length;

  return relevantCount / k;
}

/**
 * Recall@K — Anteil der erwarteten Quellen, die unter den ersten K retrivierten Dokumenten gefunden wurden.
 *
 * R@K = |{relevante Treffer in top-K}| / |expectedSourceIds|
 *
 * Randfälle:
 *   - k <= 0 oder retrievedSourceIds leer → 0
 *   - expectedSourceIds leer              → 0 (Division durch 0 vermeiden)
 */
export function recallAtK(
  retrievedSourceIds: string[],
  expectedSourceIds: string[],
  k: number,
): number {
  if (k <= 0 || retrievedSourceIds.length === 0 || expectedSourceIds.length === 0) return 0;

  const topKIds = topK(retrievedSourceIds, k);
  const expectedSet = new Set(expectedSourceIds);
  const relevantCount = topKIds.filter((id) => expectedSet.has(id)).length;

  return relevantCount / expectedSourceIds.length;
}

/**
 * Reciprocal Rank (RR) — 1 / Rang des ersten relevanten Treffers in der Rangliste.
 *
 * RR = 1/r  wenn ein relevanter Treffer bei Rang r (1-basiert) gefunden wird
 * RR = 0    wenn kein relevanter Treffer gefunden wird
 *
 * Randfälle:
 *   - retrievedSourceIds oder expectedSourceIds leer → 0
 */
export function reciprocalRank(
  retrievedSourceIds: string[],
  expectedSourceIds: string[],
): number {
  if (retrievedSourceIds.length === 0 || expectedSourceIds.length === 0) return 0;

  const expectedSet = new Set(expectedSourceIds);

  for (let i = 0; i < retrievedSourceIds.length; i++) {
    if (expectedSet.has(retrievedSourceIds[i]!)) {
      return 1 / (i + 1); // Rang ist 1-basiert
    }
  }

  return 0;
}
