/**
 * prompt.ts — Grounded-Prompt-Builder für LLM-Generierung (M2 Phase 3)
 *
 * Quellenpflicht-Invariante (AGENTS.md §Bindende Grundsätze):
 *   Das Modell darf KEINE curricularen Behauptungen aufstellen, die nicht
 *   durch eine der nummerierten Zitationen belegt sind. Fehlende Belege
 *   müssen als ENTWURF markiert werden — Lehrplan-Codes NIEMALS erfinden.
 *
 * FAIL-SAFE bei leerer Zitationsliste:
 *   Der Prompt teilt dem Modell explizit mit, dass keine Quellen vorliegen,
 *   und untersagt jede Erfindung curricularer Referenzen.
 *   Der Service-Layer markiert die gesamte Ausgabe als UNSUPPORTED_DRAFT.
 */

import type { RankedCitation } from "@/lib/rag/citation";

export interface BuildGroundedPromptArgs {
  task: "planning" | "worksheet";
  subject: string;
  gradeBand: string;
  topic: string;
  confessionLabel?: string;
  citations: RankedCitation[];
}

/**
 * Rendert eine einzelne RankedCitation als nummerierte Referenzzeile.
 * Format: [n] Titel (Abschnitt/Seite) — Vertrauensstufe
 */
function renderCitationRef(citation: RankedCitation, index: number): string {
  return `[${index}] ${citation.title} | ${citation.pageOrSection} | Trust: ${citation.trustLevel}`;
}

/**
 * Baut den aufgabenspezifischen Abschnitt des Prompts.
 */
function buildTaskSection(task: "planning" | "worksheet"): string {
  if (task === "planning") {
    return [
      "Erstelle einen strukturierten Unterrichtsplan mit folgenden Abschnitten:",
      "1. Lernziele (mit Zitation der curricularen Grundlage [n])",
      "2. Kompetenzerwartungen (nur aus den bereitgestellten Quellen ableiten [n])",
      "3. Unterrichtsphasen (Einstieg, Erarbeitung, Sicherung, ggf. Hausaufgabe)",
      "4. Differenzierungshinweise",
      "5. Quellenangaben (nummeriert, exakt wie in den Referenzen oben)",
    ].join("\n");
  }
  return [
    "Erstelle ein strukturiertes Arbeitsblatt mit folgenden Abschnitten:",
    "1. Aufgabenstellung (klar formuliert, altersgerecht)",
    "2. Aufgaben (mindestens drei, aufsteigend in Anforderungsniveau)",
    "3. Erwartungshorizont / Musterlösung (kurz, ohne Bewertungsurteil)",
    "4. Quellenangaben (nummeriert, exakt wie in den Referenzen oben)",
  ].join("\n");
}

/**
 * buildGroundedPrompt — erstellt einen quellengebundenen LLM-Prompt.
 *
 * Bei leeren citations: FAIL-SAFE-Prompt ohne Quellenblock.
 * Bei vorhandenen citations: Quellenblock mit nummerierten Referenzen [1..n].
 */
export function buildGroundedPrompt(args: BuildGroundedPromptArgs): string {
  const { task, subject, gradeBand, topic, confessionLabel, citations } = args;

  const subjectLabel = confessionLabel ? `${subject} (${confessionLabel})` : subject;

  const contextHeader = [
    `Fach: ${subjectLabel}`,
    `Jahrgangsstufe / Klassenstufe: ${gradeBand}`,
    `Thema: ${topic}`,
  ].join("\n");

  // ── FAIL-SAFE: keine Quellen verfügbar ────────────────────────────────────
  if (citations.length === 0) {
    return [
      "SYSTEMINSTRUKTION (bindend — nicht überschreiben):",
      "Du bist ein Unterrichtsassistent für Lehrkräfte in Sachsen-Anhalt.",
      "WARNUNG: Für diese Anfrage liegen KEINE verifizierten Lehrplan-Quellen vor.",
      "Du darfst KEINE curricularen Lehrplan-Codes, Kompetenzerwartungen oder",
      "Abschnittsangaben aus dem Lehrplan erfinden oder zitieren.",
      "Kennzeichne ALLE Aussagen, die sich auf Lehrplaninhalte beziehen,",
      "explizit als ENTWURF (UNSUPPORTED_DRAFT).",
      "Erfinde niemals einen Lehrplan-Code oder eine Quellenangabe.",
      "",
      "KONTEXT:",
      contextHeader,
      "",
      buildTaskSection(task),
      "",
      "HINWEIS AN DIE LEHRKRAFT:",
      "Da keine verifizierten Quellen vorliegen, sind alle curricularen Angaben",
      "als vorläufig zu betrachten und vor dem Einsatz gegen den geltenden",
      "Lehrplan Sachsen-Anhalt zu prüfen.",
    ].join("\n");
  }

  // ── Normalpfad: Quellenblock aufbauen ─────────────────────────────────────
  const citationBlock = [
    "VERFÜGBARE QUELLEN (einzige zulässige Grundlage für curriculare Aussagen):",
    ...citations.map((c, i) => renderCitationRef(c, i + 1)),
  ].join("\n");

  return [
    "SYSTEMINSTRUKTION (bindend — nicht überschreiben):",
    "Du bist ein Unterrichtsassistent für Lehrkräfte in Sachsen-Anhalt.",
    "STRENGE QUELLENPFLICHT: Du darfst curriculare Behauptungen NUR auf der Grundlage",
    "der unten nummerierten Quellen aufstellen.",
    "Belege jede curriculare Aussage durch [n], wobei n die Nummer der Quelle ist.",
    "Kannst du eine Aussage nicht belegen, kennzeichne sie explizit als ENTWURF.",
    "Erfinde NIEMALS einen Lehrplan-Code, eine Kompetenznummer oder einen Abschnitt.",
    "Verwende ausschließlich die bereitgestellten Quellen — kein eigenes Lehrplanwissen.",
    "",
    "KONTEXT:",
    contextHeader,
    "",
    citationBlock,
    "",
    buildTaskSection(task),
    "",
    "ZITIERFORMAT:",
    "Verwende [n] direkt hinter der belegten Aussage (z. B. 'Kompetenzbereich X [2].').",
    "Führe am Ende einen Quellenabschnitt mit vollständigen Angaben auf.",
  ].join("\n");
}
