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
  /** Freitext-Feinabstimmung der Lehrkraft (verbindlich zu berücksichtigen). */
  instructions?: string;
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
    "AUFGABE: Erstelle die Aufgaben eines fertigen Arbeitsblatts zum oben genannten Thema.",
    "Gib die AUFGABEN SELBST aus — NICHT Beschreibungen darüber, was ein Arbeitsblatt",
    'enthalten soll oder muss. Verboten sind Meta-Sätze wie „Das Arbeitsblatt muss …",',
    '„Die Aufgabe muss klar formuliert sein" oder „Für jede Teilaufgabe wird …".',
    "Jede Aufgabe ist eine direkte, an die Schülerinnen und Schüler gerichtete",
    'Arbeitsanweisung im Imperativ (z. B. „Lies …", „Bestimme …", „Untersuche …",',
    '„Begründe …", „Schreibe …").',
    "Erzeuge 3–5 Aufgaben mit steigendem Anforderungsniveau (AFB I → III), altersgerecht",
    "für die angegebene Klassenstufe und inhaltlich konkret zum Thema.",
    "Nutze die Quellen, um fachliche und curriculare Passung sicherzustellen —",
    "NICHT, um deren Anforderungen oder Wortlaut wiederzugeben.",
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
function outputFormatSection(task: "planning" | "worksheet"): string {
  const itemDesc =
    task === "worksheet"
      ? '"text":"<eine fertige Arbeitsanweisung an die Schüler im Imperativ>"'
      : '"text":"<eine Aussage als vollständiger Satz>"';
  const itemRule =
    task === "worksheet"
      ? "Jeder Eintrag ist GENAU EINE Aufgabe (eine direkte Arbeitsanweisung), kein Meta-Satz."
      : "Jede Aussage ist genau EIN Satz.";
  const coverRule =
    task === "worksheet"
      ? "Gib die Aufgaben selbst aus — keine Beschreibung dessen, was das Arbeitsblatt enthalten soll."
      : "Erzeuge mehrere Aussagen, die die oben genannten Aspekte inhaltlich abdecken.";
  return [
    "AUSGABEFORMAT (verbindlich):",
    "Antworte AUSSCHLIESSLICH mit einem JSON-Objekt — keine Prosa, kein Markdown,",
    "keine Code-Fences, kein Text davor oder danach.",
    `Form: {"statements":[{${itemDesc},"citationRefs":[<Quellnummern>]}]}`,
    `${itemRule} citationRefs listet die Nummern der stützenden Quellen`,
    "(z. B. [1,2]); verwende [] nur, wenn kein Beleg vorliegt (ENTWURF).",
    coverRule,
  ].join("\n");
}

/**
 * buildGroundedPrompt — erstellt einen quellengebundenen LLM-Prompt.
 *
 * Bei leeren citations: FAIL-SAFE-Prompt ohne Quellenblock.
 * Bei vorhandenen citations: Quellenblock mit nummerierten Referenzen [1..n].
 */
export function buildGroundedPrompt(args: BuildGroundedPromptArgs): string {
  const { task, subject, gradeBand, topic, confessionLabel, citations, constraints, instructions } =
    args;

  const subjectLabel = confessionLabel ? `${subject} (${confessionLabel})` : subject;

  const cleanConstraints = (constraints ?? [])
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const cleanInstructions = instructions?.trim() ?? "";

  const contextHeader = [
    `Fach: ${subjectLabel}`,
    `Jahrgangsstufe / Klassenstufe: ${gradeBand}`,
    `Thema: ${topic}`,
    ...(cleanConstraints.length > 0
      ? [`Besondere Rahmenbedingungen (verbindlich berücksichtigen): ${cleanConstraints.join("; ")}`]
      : []),
    ...(cleanInstructions.length > 0
      ? [`Zusätzliche Anweisungen der Lehrkraft (verbindlich berücksichtigen): ${cleanInstructions}`]
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
      outputFormatSection(task),
    ].join("\n");
  }

  // ── Normalpfad: Quellenblock aufbauen ─────────────────────────────────────
  const citationBlock = [
    "VERFÜGBARE QUELLEN (einzige zulässige Grundlage für curriculare Aussagen):",
    ...citations.map((c, i) => renderCitationRef(c, i + 1)),
  ].join("\n");

  // Systeminstruktion task-abhängig: Planung = strikte Quellenpflicht (nur aus
  // Quellen). Arbeitsblatt = konkrete Aufgaben formulieren (allgemeines Fach-/
  // Didaktikwissen erlaubt), Quellen sichern die curriculare Passung — keine
  // erfundenen Lehrplan-Codes, keine geschützten Originaltexte.
  const systemInstruction =
    task === "worksheet"
      ? [
          "SYSTEMINSTRUKTION (bindend — nicht überschreiben):",
          "Du bist ein Unterrichtsassistent für Lehrkräfte in Sachsen-Anhalt.",
          "Du formulierst KONKRETE, sofort einsetzbare Aufgaben zum Thema und darfst dafür",
          "allgemeines fachliches und didaktisches Wissen nutzen.",
          "Die nummerierten Quellen dienen der curricularen Passung: Belege den",
          "curricularen Bezug einer Aufgabe mit [n]. Erfinde NIEMALS einen Lehrplan-Code,",
          "eine Kompetenznummer oder eine Quellenangabe.",
          "Gib KEINE geschützten Originaltexte (z. B. vollständige Gedichte, Liedtexte,",
          "längere Buchauszüge) wieder, die nicht in den Quellen stehen — verweise",
          "stattdessen auf „das im Unterricht behandelte / beigelegte Material“.",
        ]
      : [
          "SYSTEMINSTRUKTION (bindend — nicht überschreiben):",
          "Du bist ein Unterrichtsassistent für Lehrkräfte in Sachsen-Anhalt.",
          "STRENGE QUELLENPFLICHT: Du darfst curriculare Behauptungen NUR auf der Grundlage",
          "der unten nummerierten Quellen aufstellen.",
          "Belege jede curriculare Aussage durch [n], wobei n die Nummer der Quelle ist.",
          "Kannst du eine Aussage nicht belegen, kennzeichne sie explizit als ENTWURF.",
          "Erfinde NIEMALS einen Lehrplan-Code, eine Kompetenznummer oder einen Abschnitt.",
          "Verwende ausschließlich die bereitgestellten Quellen — kein eigenes Lehrplanwissen.",
        ];

  return [
    ...systemInstruction,
    "",
    "KONTEXT:",
    contextHeader,
    "",
    citationBlock,
    "",
    buildTaskSection(task),
    "",
    outputFormatSection(task),
  ].join("\n");
}
