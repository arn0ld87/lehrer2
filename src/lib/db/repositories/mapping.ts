/**
 * Persistenz↔UI-Mapping für Subject und Confession.
 *
 * Das Persistenzmodell trennt `subject` (DEUTSCH/RELIGION/ETHIK) und
 * `confessionContext`. Die UI-Union `Subject` konflatiert beides in einen
 * einzigen String. Diese Datei ist die einzige Übersetzungsstelle — keine
 * UI-Annahme darf ins Schema lecken und kein Schema-Wert darf unkontrolliert
 * in die UI gelangen.
 */

import type { Subject as UiSubject } from "@/lib/types";

export type DbSubject = "DEUTSCH" | "RELIGION" | "ETHIK";
export type DbConfession =
  | "EVANGELISCH"
  | "KATHOLISCH"
  | "KONFESSIONSSENSIBEL_UEBERGREIFEND"
  | "RELIGIONSKUNDLICH"
  | "NICHT_ANWENDBAR";

/**
 * Persistenz (subject + confession) → UI-Union.
 *
 * Hinweis: KONFESSIONSSENSIBEL_UEBERGREIFEND wird als "evangelische-religion"
 * dargestellt, weil die UI-Union keinen dritten Konfessionsstrang kennt.
 * Dieses Verhalten ist bewusst und dokumentiert; eine spätere UI-Erweiterung
 * muss hier ansetzen, nicht im Schema.
 */
export function dbSubjectToUi(subject: DbSubject, confession: DbConfession): UiSubject {
  if (subject === "DEUTSCH") return "deutsch";
  if (subject === "ETHIK") return "ethik";
  // RELIGION — Konfession entscheidet
  if (confession === "KATHOLISCH") return "katholische-religion";
  // EVANGELISCH + KONFESSIONSSENSIBEL_UEBERGREIFEND → evangelisch-nah (UI kennt keinen dritten Strang)
  return "evangelische-religion";
}

/**
 * UI-Union → Persistenz (subject + confession).
 *
 * Umkehrfunktion zu dbSubjectToUi. Für Ethik wird confession auf
 * RELIGIONSKUNDLICH gesetzt (inhaltlich nächster Wert; kein Konfessionsbezug).
 *
 * WARNUNG (M2-RAG): Ein UI-Filter für "evangelische-religion" maps zu
 * `confession = EVANGELISCH`, ignoriert aber `KONFESSIONSSENSIBEL_UEBERGREIFEND`.
 * RAG-Retrieval-Queries, die aus dieser Mapping-Funktion stammen, müssen
 * daher `confession_context IN ('EVANGELISCH','KONFESSIONSSENSIBEL_UEBERGREIFEND')`
 * verwenden, nie Gleichheit (`confession = ...`). Siehe DATA_MODEL.md.
 * TODO(M2-RAG): Strikte Assertion für RAG-Filter-Bau aus UI-Auswahl.
 */
export function uiSubjectToDb(ui: UiSubject): { subject: DbSubject; confession: DbConfession } {
  switch (ui) {
    case "deutsch":
      return { subject: "DEUTSCH", confession: "NICHT_ANWENDBAR" };
    case "ethik":
      return { subject: "ETHIK", confession: "RELIGIONSKUNDLICH" };
    case "evangelische-religion":
      return { subject: "RELIGION", confession: "EVANGELISCH" };
    case "katholische-religion":
      return { subject: "RELIGION", confession: "KATHOLISCH" };
    default: {
      // fail-closed: ein unbekanntes UI-Fach darf nie unkontrolliert durchrutschen
      const _exhaustive: never = ui;
      throw new Error(`uiSubjectToDb: unbekanntes UI-Fach: ${String(_exhaustive)}`);
    }
  }
}

/**
 * UI-Fach → confession_context-IN-Liste für den RAG-Retrieval-Filter (#39, M2 Schritt 2).
 *
 * Löst die WARNUNG in uiSubjectToDb auf: statt einfacher Gleichheit liefert diese
 * Funktion die vollständige IN-Liste, die serverseitig für konfessionskorrektes
 * Cross-Strang-freies Retrieval gebraucht wird.
 *
 * Regeln (nicht verhandelbar):
 *   evangelische-religion → ['EVANGELISCH', 'KONFESSIONSSENSIBEL_UEBERGREIFEND']
 *   katholische-religion  → ['KATHOLISCH',  'KONFESSIONSSENSIBEL_UEBERGREIFEND']
 *   ethik                 → ['RELIGIONSKUNDLICH']   — NIE mit Religion-Kontexten mischen
 *   deutsch               → []  (kein Konfessionsfilter; nur subject=DEUTSCH wird gesetzt)
 *
 * @returns Array der erlaubten confession_context-Werte; leer = kein Konfessionsfilter nötig.
 */
export function uiConfessionToDbContexts(ui: UiSubject): DbConfession[] {
  switch (ui) {
    case "evangelische-religion":
      return ["EVANGELISCH", "KONFESSIONSSENSIBEL_UEBERGREIFEND"];
    case "katholische-religion":
      return ["KATHOLISCH", "KONFESSIONSSENSIBEL_UEBERGREIFEND"];
    case "ethik":
      return ["RELIGIONSKUNDLICH"];
    case "deutsch":
      return [];
    default: {
      // fail-closed: ein unbekanntes UI-Fach darf den Konfessionsfilter NIE
      // stillschweigend deaktivieren (würde Cross-Strang-Retrieval erlauben)
      const _exhaustive: never = ui;
      throw new Error(`uiConfessionToDbContexts: unbekanntes UI-Fach: ${String(_exhaustive)}`);
    }
  }
}
