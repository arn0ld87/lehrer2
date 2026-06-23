/**
 * Redaction-Engine (REDACTION_AND_GUARD_SPEC.md §2)
 *
 * Maskiert PII-Kategorien im Freitext vor LLM-Calls:
 *   - Namen (Vor- + Nachname-Muster)
 *   - Geburtsdaten (DD.MM.YYYY)
 *   - Adressen (PLZ + Ort, Straße + Hausnummer)
 *   - Kontaktdaten (E-Mail, Telefon)
 *   - Sensible Merkmale (LRS, Dyskalkulie, ADHS, etc.)
 *
 * Ablauf (§2.2):
 *   1. Pattern Matching (strukturierte Daten: Datum, E-Mail, Tel, PLZ)
 *   2. Name-Pattern (Großschreibung Vorname Nachname)
 *   3. Sensible-Begriffe-Lookup
 *   4. Ersetzung durch definierte Masken
 *
 * redact() ist rein synchron, kein I/O, deterministisch.
 * Alle Funde werden in foundPii gesammelt (für Guard + Audit).
 */

// ─── Masken (REDACTION_AND_GUARD_SPEC.md §2.1) ────────────────────────────────

export const MASK_NAME = "[SCHÜLER_PSEUDONYM]";
export const MASK_DATE = "[DATUM_REDACTED]";
export const MASK_ADDRESS = "[ADRESSE_REDACTED]";
export const MASK_CONTACT = "[KONTAKT_REDACTED]";
export const MASK_TRAIT = "[MERKMAL_REDACTED]";

// ─── PII-Kategorien ───────────────────────────────────────────────────────────

export type PiiCategory = "name" | "date" | "address" | "contact" | "trait";

export interface PiiMatch {
  category: PiiCategory;
  original: string;
  mask: string;
  /** Position im Originaltext (Startindex) */
  offset: number;
}

export interface RedactResult {
  redactedText: string;
  foundPii: PiiMatch[];
}

// ─── Muster (REDACTION_AND_GUARD_SPEC.md §2.1) ───────────────────────────────

/**
 * Datum DD.MM.YYYY (auch DD-MM-YYYY, YYYY-MM-DD)
 * Spezifikation: \d{2}\.\d{2}\.\d{4}
 */
const DATE_PATTERNS: RegExp[] = [
  /\b\d{2}\.\d{2}\.\d{4}\b/g,          // 15.03.2009
  /\b\d{4}-\d{2}-\d{2}\b/g,             // 2009-03-15 (ISO)
  /\b\d{2}-\d{2}-\d{4}\b/g,             // 15-03-2009
];

/**
 * Kontaktdaten: E-Mail + Telefon
 * Spezifikation: [\w\.-]+@[\w\.-]+\.\w+
 *
 * WICHTIG: Kein generisches Rufnummern-Muster \d{3,5}[\s\-]?\d{2,8}…, das ISO-Daten
 * (2009-03-15) fälschlich trifft. Stattdessen zwei verankerte Muster: +49/0049-Präfix
 * sowie 0-Vorwahl MIT Trenner (z.B. "0361 234567"). Letzteres trifft keine ISO-/DD-Daten,
 * da diese nie mit "0" + ≥2 Ziffern + Trenner beginnen.
 */
const CONTACT_PATTERNS: RegExp[] = [
  /\b[\w.\-+]+@[\w.\-]+\.[a-zA-Z]{2,}\b/g,               // E-Mail
  /(?<!\d)(\+49|0049)\s?[\d\s\-/]{7,15}(?!\d)/g,          // Rufnummer mit Ländervorwahl
  /(?<!\d)0\d{2,4}[\s/-]\d{3,9}(?!\d)/g,                  // Rufnummer mit 0-Vorwahl + Trenner
];

/**
 * Adressen: PLZ + Ort, Straße + Hausnummer
 * Spezifikation: \d{5}\s+[A-Z][a-z]+
 */
const ADDRESS_PATTERNS: RegExp[] = [
  /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*/g,  // PLZ Ort
  /\b[A-ZÄÖÜ][a-zäöüß]+(?:straße|gasse|weg|allee|platz|ring|damm|chaussee)\s+\d+[a-z]?\b/gi,  // Straßen
];

/**
 * Namen: Vorname Nachname (je mit Großbuchstaben, mind. 3+3 Zeichen)
 * Spezifikation: \b[A-ZÄÖÜ][a-zäöü]+ [A-ZÄÖÜ][a-zäöü]+\b
 *
 * Einschränkungen gegenüber der Spec-Basis:
 * - Jeder Teil mindestens 3 Kleinbuchstaben (verhindert "Der Lehrplan", "Begriff Metapher")
 * - Ausschluss-Liste für häufig falsch-positive Bigrams
 */
const NAME_PATTERN = /\b[A-ZÄÖÜ][a-zäöüß]{2,}(?:-[A-ZÄÖÜ][a-zäöüß]+)?\s+[A-ZÄÖÜ][a-zäöüß]{2,}(?:-[A-ZÄÖÜ][a-zäöüß]+)?\b/g;

/**
 * Ausnahmen für Namensmuster: häufige Nicht-Namen die falsch-positiv auftreten.
 * Liste wird vor Ersetzung geprüft (case-insensitiv vergleichen).
 */
const NAME_EXCLUSIONS = new Set([
  "Sehr Geehrte",
  "Sehr Geehrter",
  "Mit Freundlichen",
  "Schüler Pseudonym",
  "Datum Redacted",
  "Adresse Redacted",
  "Kontakt Redacted",
  "Merkmal Redacted",
  // Häufige Deutsche Wortkombinationen die kein Name sind
  "Der Lehrplan",
  "Die Schüler",
  "Das Ergebnis",
  "Begriff Metapher",
  "Klasse Leistung",
  "Bitte Erkläre",
  "Fach Deutsch",
  "Fach Religion",
  "Fach Ethik",
  "Bitte Erkläre",
]);

/**
 * Häufige deutsche Substantive, die als erster Teil eines Zwei-Wort-Musters
 * kein Personenname sein können. Wird vor der Ersetzung geprüft.
 */
const NAME_FIRST_WORD_EXCLUSIONS = new Set([
  "Der", "Die", "Das", "Den", "Dem", "Des",
  "Ein", "Eine", "Einer", "Eines",
  "Bitte", "Begriff", "Klasse", "Fach", "Schule", "Schüler", "Schülerin",
  "Sehr", "Mit", "Oder", "Und", "Aber", "Doch", "Nicht",
  "Lesen", "Schreiben", "Sprechen", "Hören",
  "Lehrplan", "Unterricht", "Aufgabe", "Kompetenz",
  "Ergebnis", "Leistung", "Prüfung", "Stunde",
  "Keine", "Viele", "Wenige", "Alle", "Beide",
]);

/**
 * Sensible Merkmale (REDACTION_AND_GUARD_SPEC.md §2.1)
 * Förderbedarf, Diagnosen, Konfession (wenn Cloud-Context)
 */
const TRAIT_TERMS: RegExp[] = [
  /\b(?:LRS|Legasthenie|Dyskalkulie|ADHS|ADS|Autismus|Förderbedarf|sonderpädagogisch(?:er|e|es)?)\b/gi,
  /\b(?:Inklusionskind|Inklusionsschüler|Integrationsschüler|Nachteilsausgleich)\b/gi,
  /\b(?:evangelisch|katholisch|konfessionslos|muslimisch|jüdisch)\b/gi,
];

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/**
 * Wendet eine Liste von Regex-Patterns auf einen Text an und sammelt Funde.
 * Ergebnisse werden nach Offset sortiert für spätere Ersetzungsreihenfolge.
 */
function collectMatches(
  text: string,
  patterns: RegExp[],
  category: PiiCategory,
  mask: string,
): PiiMatch[] {
  const matches: PiiMatch[] = [];

  for (const pattern of patterns) {
    // Reset lastIndex für globale Regex
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        category,
        original: match[0],
        mask,
        offset: match.index,
      });
    }
  }

  return matches;
}

/**
 * Ersetzt alle gematchten Ranges im Text (von hinten nach vorne für Offset-Stabilität).
 */
function applyReplacements(text: string, matches: PiiMatch[]): string {
  if (matches.length === 0) return text;

  // Nach Offset absteigend sortieren → rückwärts ersetzen
  const sorted = [...matches].sort((a, b) => b.offset - a.offset);

  let result = text;
  for (const m of sorted) {
    const before = result.slice(0, m.offset);
    const after = result.slice(m.offset + m.original.length);
    result = before + m.mask + after;
  }

  return result;
}

// ─── Öffentliche API ──────────────────────────────────────────────────────────

/**
 * Redact — maskiert PII im Freitext (REDACTION_AND_GUARD_SPEC.md §2).
 *
 * Reihenfolge:
 *   1. Kontaktdaten (E-Mail, Tel) — spezifischste strukturierte Muster zuerst
 *   2. Geburtsdaten
 *   3. Adressen
 *   4. Sensible Merkmale
 *   5. Namen (Name-Pattern zuletzt, da breiter)
 *
 * @param text  Eingabetext (darf PII enthalten)
 * @returns     { redactedText, foundPii }
 */
export function redact(text: string): RedactResult {
  // Schritt-weise Ersetzung: jede Runde arbeitet auf dem bereits maskierten Text,
  // damit Offsets konsistent bleiben und Masken nicht nochmals gematcht werden.

  let current = text;
  const allMatches: PiiMatch[] = [];

  // 1. Kontaktdaten
  const contactMatches = collectMatches(current, CONTACT_PATTERNS, "contact", MASK_CONTACT);
  if (contactMatches.length > 0) {
    allMatches.push(...contactMatches);
    current = applyReplacements(current, contactMatches);
  }

  // 2. Geburtsdaten
  const dateMatches = collectMatches(current, DATE_PATTERNS, "date", MASK_DATE);
  if (dateMatches.length > 0) {
    allMatches.push(...dateMatches);
    current = applyReplacements(current, dateMatches);
  }

  // 3. Adressen
  const addressMatches = collectMatches(current, ADDRESS_PATTERNS, "address", MASK_ADDRESS);
  if (addressMatches.length > 0) {
    allMatches.push(...addressMatches);
    current = applyReplacements(current, addressMatches);
  }

  // 4. Sensible Merkmale
  const traitMatches = collectMatches(current, TRAIT_TERMS, "trait", MASK_TRAIT);
  if (traitMatches.length > 0) {
    allMatches.push(...traitMatches);
    current = applyReplacements(current, traitMatches);
  }

  // 5. Namen (nach den spezifischeren Mustern, damit Maskennamen nicht nochmals matchen)
  NAME_PATTERN.lastIndex = 0;
  const rawNameMatches = collectMatches(current, [NAME_PATTERN], "name", MASK_NAME);
  const nameMatches = rawNameMatches.filter((m) => {
    // Ausschluss-Liste für bekannte Nicht-Namen (vollständiges Bigram)
    if (NAME_EXCLUSIONS.has(m.original)) return false;
    // Ausschluss wenn erstes Wort ein häufiges deutsches Substantiv ist
    const firstWord = m.original.split(/\s+/)[0] ?? "";
    if (NAME_FIRST_WORD_EXCLUSIONS.has(firstWord)) return false;
    return true;
  });
  if (nameMatches.length > 0) {
    allMatches.push(...nameMatches);
    current = applyReplacements(current, nameMatches);
  }

  return {
    redactedText: current,
    foundPii: allMatches,
  };
}
