/**
 * Redaction — PII-Erkennung und -Maskierung vor LLM-Calls
 *
 * Implementiert die Redaction-Regeln aus docs/security/REDACTION_AND_GUARD_SPEC.md §2.
 *
 * Design-Entscheidungen:
 * - Deterministisch und pure (kein IO, kein State).
 * - Kein externes Paket — nur native RegExp.
 * - Kategorien spiegeln §2.1 der Spec exakt.
 * - NER ist nicht möglich ohne externe Bibliothek; wir verwenden deshalb
 *   Pattern-Matching als belastbaren Fallback für den Guard-Layer.
 *   (Spec §2.2 Schritt 1 „NER" ist für Phase 3 vorgesehen, wenn ein
 *   lokales NER-Modell via Ollama integriert wird.)
 */

export type RedactionCategory =
  | "name"
  | "birthdate"
  | "address"
  | "contact"
  | "sensitive_attribute"
  | "student_id";

export interface RedactionResult {
  redactedText: string;
  redactionApplied: boolean;
  categoriesHit: RedactionCategory[];
}

// ── Kategorie-Definitionen ────────────────────────────────────────────────────

interface CategoryDef {
  category: RedactionCategory;
  /** Alle Muster werden sequenziell auf den (jeweils bereits reduzierten) Text angewendet. */
  patterns: RegExp[];
  mask: string;
}

/**
 * Reihenfolge ist semantisch: spezifischere Muster zuerst, damit spätere
 * Muster nicht schon durch frühere Masken verfälscht werden.
 */
const CATEGORY_DEFS: CategoryDef[] = [
  // ── Schüler-IDs (Muster vor Namen, damit "Schüler 12345" nicht als Name erkannt wird) ──
  {
    category: "student_id",
    patterns: [
      // "S12345", "SN-2023-0042", "ID:12345", schulspezifische Formate
      /\bS(?:N)?[-_]?\d{4,8}\b/gi,
      /\bID\s*[:=]\s*\d{4,10}\b/gi,
      // Schülerausweis-Nummern (6-10-stellige Ziffernfolgen nach Schlüsselwörtern)
      /(?:Schüler(?:in)?(?:nummer|ausweis|ID)?|Matrikel(?:nummer)?)\s*[:=]?\s*\d{4,10}\b/gi,
    ],
    mask: "[SCHÜLER_ID_REDACTED]",
  },

  // ── Kontaktdaten (E-Mail + Telefon) ──────────────────────────────────────────
  {
    category: "contact",
    patterns: [
      // E-Mail (spec §2.1 Regex: [\w\.-]+@[\w\.-]+\.\w+)
      /[\w.+-]+@[\w.-]+\.\w{2,}/gi,
      // Deutsche Telefonnummern (diverse Formate)
      /(?:\+49|0049|0)\s*(?:\d[\s-]?){7,14}\d/g,
      // Internationale Telefonnummern (E.164-ähnlich)
      /\+\d{1,3}[\s-]?\(?\d+\)?[\s-]?\d[\s\d-]{5,}/g,
    ],
    mask: "[KONTAKT_REDACTED]",
  },

  // ── Geburtsdaten ─────────────────────────────────────────────────────────────
  {
    category: "birthdate",
    patterns: [
      // Deutsches Datumsformat (spec §2.1): DD.MM.YYYY
      /\b\d{2}\.\d{2}\.\d{4}\b/g,
      // ISO-Format: YYYY-MM-DD (spec guardAssertion §3.1)
      /\b\d{4}-\d{2}-\d{2}\b/g,
      // Varianten: DD/MM/YYYY, DD-MM-YYYY
      /\b\d{2}[/-]\d{2}[/-]\d{4}\b/g,
      // Kontext-bezogen: "geboren am", "geb.", "Geb.-Datum"
      /(?:geboren\s+am|geb\.?|Geburtsdatum\s*[:=]?)\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/gi,
    ],
    mask: "[DATUM_REDACTED]",
  },

  // ── Adressen (PLZ + Ort, Straßen) ────────────────────────────────────────────
  {
    category: "address",
    patterns: [
      // PLZ + Ortsname (spec §2.1: \d{5}\s+[A-Z][a-z]+, auch Sonderzeichen im Ortsnamen)
      /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:[-\s][A-ZÄÖÜ][a-zäöüß]+)*/g,
      // Straße/Gasse/Weg/Platz + Hausnummer
      /[A-ZÄÖÜ][a-zäöüß]+(?:[-\s][A-ZÄÖÜ][a-zäöüß]+)*(?:straße|strasse|str\.|gasse|weg|allee|platz|ring|damm|ufer)\s+\d+[a-z]?/gi,
      // Kontext: "Adresse:", "wohnhaft in"
      /(?:Adresse|Anschrift|wohnhaft\s+in|wohnhaft\s+bei)\s*[:=]?\s*[^\n,;]{5,60}/gi,
    ],
    mask: "[ADRESSE_REDACTED]",
  },

  // ── Sensible Merkmale (Förderbedarf, Diagnosen, Konfession bei Cloud-Pfad) ───
  {
    category: "sensitive_attribute",
    patterns: [
      // Spec §2.1 explizite Begriffe + gängige Erweiterungen
      /\b(?:LRS|Legasthenie|Dyskalkulie|ADHS|ADS|ASS|Autismus|Förderbedarf|Nachteilsausgleich|sonderpädagogisch(?:er?\s+Förderbedarf)?)\b/gi,
      // Konfession (relevant bei Cloud-Pfad — Spec §2.1 „Konfession (wenn Cloud)")
      /\b(?:evangelisch|katholisch|konfessionslos|muslimisch|islamisch|jüdisch|konfessionell)\b/gi,
      // Staatsangehörigkeit / Aufenthaltsstatus (datenschutzrelevant)
      /\b(?:Aufenthaltserlaubnis|Aufenthaltsstatus|Asylantrag|Duldung|Flüchtlingsstatus)\b/gi,
    ],
    mask: "[MERKMAL_REDACTED]",
  },

  // ── Namen (am Ende, da am breitesten — nach spezifischeren Kategorien) ────────
  //
  // KORREKTUR (E) 2026-06-25: Das ursprüngliche Roh-Bigram-Muster
  // /\b[A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+\b/ blockierte legitime deutsche
  // Curriculum-Eigennamen ("Martin Luther", "Anne Frank", Buchtitel, Ortsnamen).
  // Spec §2.1 definiert die Kategorie als "Vor- und Nachnamen von Schülern" —
  // der Schüler-Kontext ist entscheidend, nicht jedes Großbuchstaben-Bigram.
  //
  // Strategie: Nur label-anchored oder explizit als Schüler-Kontext markierte
  // Namen redacten. Unmarkierte Eigennamen im Fließtext (Lehrer-/Curriculum-
  // Content, dataClass PUBLIC/INTERNAL) bleiben unverändert.
  //
  // Wenn ein NER-Modell via Ollama integriert wird (Phase 3), kann kontextbasiertes
  // Name-Matching mit dataClass-Guard wieder aktiviert werden.
  //
  // Guard-Assertion (guard.ts) spiegelt diese Entscheidung: das Roh-Bigram-
  // Muster ist dort ebenfalls auskommentiert; nur label-anchored Reste werden
  // als RESIDUAL_PII gewertet.
  {
    category: "name",
    patterns: [
      // Explizit markierte Schüler-Namen (label-anchored, Spec §2.1):
      // "Name:", "Schüler:", "Schülerin:", "Vorname:", "Nachname:", "Familienname:"
      /(?:Name|Schüler(?:in)?|Vorname|Nachname|Familienname)\s*[:=]\s*[A-ZÄÖÜ][a-zäöüß\s-]{2,40}/gi,
      // Defensive Re-Sweep: Pseudonym-Masken mit Resttext (sehr selten)
      /\[SCHÜLER_PSEUDONYM\]\s+[A-ZÄÖÜ][a-zäöüß]{1,}/g,
    ],
    mask: "[SCHÜLER_PSEUDONYM]",
  },
];

// ── Haupt-Export ──────────────────────────────────────────────────────────────

/**
 * Klassifiziert und redact PII aus `text`.
 *
 * @param text   Roher Prompt-Text (darf PII enthalten).
 * @returns      Redaction-Ergebnis: bereinigter Text, Anwendungs-Flag, getroffene Kategorien.
 *
 * Reihenfolge der Anwendung: gemäß CATEGORY_DEFS (student_id → contact →
 * birthdate → address → sensitive_attribute → name). Jede Kategorie operiert
 * auf dem jeweils bereits reduzierten Text.
 */
export function redact(text: string): RedactionResult {
  let current = text;
  const categoriesHit: RedactionCategory[] = [];

  for (const def of CATEGORY_DEFS) {
    let hitThisCategory = false;

    for (const pattern of def.patterns) {
      // Reset lastIndex damit globale Regex korrekt arbeiten
      pattern.lastIndex = 0;
      if (pattern.test(current)) {
        hitThisCategory = true;
      }
      pattern.lastIndex = 0;
      current = current.replace(pattern, def.mask);
    }

    if (hitThisCategory && !categoriesHit.includes(def.category)) {
      categoriesHit.push(def.category);
    }
  }

  return {
    redactedText: current,
    redactionApplied: categoriesHit.length > 0,
    categoriesHit,
  };
}
