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
  /** Optionale didaktische Rahmenbedingungen (z. B. "45 Minuten", "LRS-Unterstützung"). */
  constraints?: string[];
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
      "Decke in deinen Aussagen die folgenden Aspekte eines Unterrichtsplans ab:",
      "- Lernziele (gestützt auf die curriculare Grundlage [n])",
      "- Kompetenzerwartungen (nur aus den bereitgestellten Quellen ableiten [n])",
      "- Unterrichtsphasen (Einstieg, Erarbeitung, Sicherung, ggf. Hausaufgabe)",
      "- Differenzierungshinweise",
    ].join("\n");
  }
  return [
    "Decke in deinen Aussagen die folgenden Aspekte eines Arbeitsblatts ab:",
    "- Aufgabenstellung (klar formuliert, altersgerecht)",
    "- mindestens drei Aufgaben, aufsteigend im Anforderungsniveau",
    "- Erwartungshorizont / Musterlösung (kurz, ohne Bewertungsurteil)",
  ].join("\n");
}

/**
 * Verbindliches JSON-Ausgabeformat.
 *
 * KRITISCH (Bug 2026-06-26): Manche Provider (gpt-oss über Ollama-Cloud)
 * erzwingen `response_format json_schema` NICHT. Ohne explizite Format-Vorgabe
 * im Prompt liefert das Modell Prosa/Markdown statt JSON → StructuredParseError
 * → 0 Statements → stiller Mock-Fallback in der UI. Das Format MUSS daher auch
 * im Prompt-Text stehen und am Ende (stärkste Recency) wiederholt werden.
 */
function outputFormatSection(): string {
  return [
    "AUSGABEFORMAT (verbindlich):",
    "Antworte AUSSCHLIESSLICH mit einem JSON-Objekt — keine Prosa, kein Markdown,",
    "keine Code-Fences, kein Text davor oder danach.",
    'Form: {"statements":[{"text":"<eine Aussage als vollständiger Satz>","citationRefs":[<Quellnummern>]}]}',
    "Jede Aussage ist genau EIN Satz. citationRefs listet die Nummern der belegenden",
    "Quellen (z. B. [1,2]); verwende [] nur, wenn die Aussage ein nicht belegter ENTWURF ist.",
    "Erzeuge mehrere Aussagen, die die oben genannten Aspekte inhaltlich abdecken.",
  ].join("\n");
}

/**
 * buildGroundedPrompt — erstellt einen quellengebundenen LLM-Prompt.
 *
 * Bei leeren citations: FAIL-SAFE-Prompt ohne Quellenblock.
 * Bei vorhandenen citations: Quellenblock mit nummerierten Referenzen [1..n].
 */
export function buildGroundedPrompt(args: BuildGroundedPromptArgs): string {
  const { task, subject, gradeBand, topic, confessionLabel, citations, constraints } = args;

  const subjectLabel = confessionLabel ? `${subject} (${confessionLabel})` : subject;

  const cleanConstraints = (constraints ?? [])
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const contextHeader = [
    `Fach: ${subjectLabel}`,
    `Jahrgangsstufe / Klassenstufe: ${gradeBand}`,
    `Thema: ${topic}`,
    ...(cleanConstraints.length > 0
      ? [`Besondere Rahmenbedingungen (verbindlich berücksichtigen): ${cleanConstraints.join("; ")}`]
      : []),
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
      "",
      outputFormatSection(),
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
    outputFormatSection(),
  ].join("\n");
}
