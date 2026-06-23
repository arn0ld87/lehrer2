/**
 * Fail-closed Guard — letzte Instanz vor Provider-Call (REDACTION_AND_GUARD_SPEC.md §3)
 *
 * assertNoPii() scannt den finalen Provider-Payload (Prompt + Kontext als String)
 * auf PII-Muster. Findet es PII → wirft PiiGuardError (Provider wird NICHT aufgerufen).
 *
 * Geprüfte Muster (§3.1):
 *   - Namens-Pattern: aufeinanderfolgende kapitalisierte Wörter (Paar-Scan, nicht greedy regex)
 *   - ISO-Datum: \d{2,4}-\d{2}-\d{2}
 *   - DD.MM.YYYY: \d{2}\.\d{2}\.\d{4}
 *   - PLZ: \d{5} [A-ZÄÖÜ]
 *   - Sensible Begriffe: lrs|dyskalkulie|adhs|legasthenie|autismus
 *   - E-Mail (ergänzend): [\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}
 *   - Telefon (ergänzend): (\+49|0049)\s?[\d\s\-/]{7,}
 *
 * Konsequenzen bei PII-Fund (§3.2):
 *   - API-Call wird unterbunden (throw PiiGuardError).
 *   - Caller muss Security-Event im Audit-Log speichern.
 *   - Nutzer erhält: "Sicherheitsprüfung fehlgeschlagen: Potenzielle Klardaten im Prompt erkannt."
 *
 * Masken (aus redact.ts) werden VOR dem Guard aus dem Payload entfernt,
 * damit korrekt redactete Texte die Prüfung bestehen.
 */

import { MASK_NAME, MASK_DATE, MASK_ADDRESS, MASK_CONTACT, MASK_TRAIT } from "./redact";

// ─── Fehlertyp ────────────────────────────────────────────────────────────────

export class PiiGuardError extends Error {
  constructor(
    /** Nachricht für den Nutzer */
    public readonly userMessage: string,
    /** Welche Muster haben angeschlagen */
    public readonly detectedPatterns: string[],
    /** Payload-Länge (kein Inhalt — kein Log von PII) */
    public readonly payloadLength: number,
  ) {
    super(userMessage);
    this.name = "PiiGuardError";
  }
}

// ─── Wörter, die NIE als Personenname gelten ─────────────────────────────────

/**
 * Wörter, die in einem capitalisierten Zwei-Wort-Bigram NICHT als Personenname
 * gewertet werden. Gilt für BEIDE Wörter eines Paares — wenn eines der beiden
 * in dieser Liste steht, ist das Bigram kein verdächtiger Name.
 */
const NOT_A_NAME_WORD = new Set([
  // Artikel
  "Der", "Die", "Das", "Den", "Dem", "Des",
  "Ein", "Eine", "Einer", "Eines",
  // Schul-Substantive
  "Begriff", "Klasse", "Fach", "Schule", "Schüler", "Schülerin",
  "Lehrplan", "Unterricht", "Aufgabe", "Kompetenz", "Leistung",
  "Ergebnis", "Prüfung", "Stunde", "Thema", "Bereich", "Inhalt", "Ziel",
  "Schreibkompetenz", "Lesekompetenz", "Sprechkompetenz", "Methode",
  // PII-Label-Wörter (erscheinen in Prompts als Feldbezeichner, nicht als Namen)
  "Geburtsdatum", "Kontakt", "Adresse", "Telefon", "Anschrift",
  // Häufige Verben / Adverbien (großgeschrieben am Satzanfang)
  "Bitte", "Lesen", "Schreiben", "Sprechen", "Hören", "Erklären",
  "Erkläre",
  // Konjunktionen / sonstige
  "Sehr", "Mit", "Oder", "Und", "Aber", "Doch",
]);

// ─── Hilfsfunktion: Name-Scan ─────────────────────────────────────────────────

/**
 * Prüft, ob im Text mindestens ein aufeinanderfolgendes Paar kapitalisierter
 * Wörter vorkommt, bei dem KEINES der beiden Wörter in NOT_A_NAME_WORD steht.
 *
 * Strategie (robuster als greedy Regex):
 *   1. Alle Wörter mit Großbuchstabe am Anfang extrahieren (mind. 3 Zeichen).
 *   2. Aufeinanderfolgende Paare im Originaltext prüfen (gleiche Reihenfolge).
 *
 * "Schüler Max Müller": Schüler↔Max = (Schüler in exclusion) → skip;
 *                        Max↔Müller = beide nicht in exclusion → PII!
 */
/**
 * Tokenisiert den Text in Wörter die mit einem Großbuchstaben beginnen
 * (inklusive Umlaute Ä/Ö/Ü), mind. 3 Zeichen insgesamt.
 *
 * Nutzt KEINE \b-Word-Boundary (scheitert an nicht-ASCII-Zeichen wie Ä),
 * sondern prüft, dass dem Großbuchstaben ein Nicht-Buchstabe oder
 * Stringanfang vorausgeht.
 */
function extractCapitalisedWords(text: string): Array<{ word: string; start: number; end: number }> {
  // Muster: optionaler Nicht-Buchstabe (Lookbehind) + Großbuchstabe + mind. 2 Kleinbuchstaben
  // Lookbehind (?<![A-ZÄÖÜa-zäöüßA-Za-z]) = nicht innerhalb eines Wortes
  const re = /(?<![A-ZÄÖÜa-zäöüß])([A-ZÄÖÜ][a-zäöüß]{2,}(?:-[A-ZÄÖÜ][a-zäöüß]+)?)/g;

  const results: Array<{ word: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    results.push({
      word: m[1]!,
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return results;
}

function containsSuspectNamePair(text: string): boolean {
  const words = extractCapitalisedWords(text);

  // Aufeinanderfolgende Paare prüfen:
  // gap = Anzahl Zeichen zwischen Ende w1 und Anfang w2 (max 2: " " oder ", ")
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i]!;
    const w2 = words[i + 1]!;

    // Abstand: end von w1 bis start von w2 (max 2 Zeichen Trenner: " " oder ", " = 2)
    const gap = w2.start - w1.end;
    if (gap > 2) continue;

    // Beide Wörter dürfen nicht in der Ausschluss-Liste stehen
    if (!NOT_A_NAME_WORD.has(w1.word) && !NOT_A_NAME_WORD.has(w2.word)) {
      return true;
    }
  }

  return false;
}

// ─── Alle bekannten Masken ────────────────────────────────────────────────────

const KNOWN_MASKS = [
  MASK_NAME,
  MASK_DATE,
  MASK_ADDRESS,
  MASK_CONTACT,
  MASK_TRAIT,
];

// ─── Weitere PII-Muster ───────────────────────────────────────────────────────

const OTHER_PII_CHECKS: Array<{ name: string; test: (text: string) => boolean }> = [
  {
    name: "ISO-Datum (YYYY-MM-DD oder DD-MM-YYYY)",
    test: (t) => /\b\d{2,4}-\d{2}-\d{2}\b/.test(t),
  },
  {
    name: "Datum DD.MM.YYYY",
    test: (t) => /\b\d{2}\.\d{2}\.\d{4}\b/.test(t),
  },
  {
    name: "PLZ (5-stellig + Stadtname)",
    test: (t) => /\b\d{5}\s+[A-ZÄÖÜ]/.test(t),
  },
  {
    name: "Sensible Begriffe (LRS/Dyskalkulie/ADHS/…)",
    test: (t) => /\b(?:LRS|Legasthenie|Dyskalkulie|ADHS|ADS|Autismus|Förderbedarf)\b/i.test(t),
  },
  {
    name: "E-Mail-Adresse",
    test: (t) => /\b[\w.\-+]+@[\w.\-]+\.[a-zA-Z]{2,}\b/.test(t),
  },
  {
    name: "Deutsche Telefonnummer (+49/0049)",
    test: (t) => /(?<!\d)(\+49|0049)\s?[\d\s\-/]{7,15}(?!\d)/.test(t),
  },
  {
    name: "Deutsche Telefonnummer (0-Vorwahl + Trenner)",
    test: (t) => /(?<!\d)0\d{2,4}[\s/-]\d{3,9}(?!\d)/.test(t),
  },
];

// ─── Guard-Funktion ───────────────────────────────────────────────────────────

/**
 * Wirft PiiGuardError wenn der Payload PII enthält (§3.1/§3.2).
 * Gibt sonst still zurück (kein Rückgabewert).
 *
 * Ablauf:
 *   1. Bekannte Masken aus dem Payload entfernen (nicht PII).
 *   2. Name-Paar-Scan (alle Wort-Paare, robust gegen greedy-Regex-Shadowing).
 *   3. Weitere PII-Muster testen.
 *   4. Wenn ≥1 Treffer: PiiGuardError werfen.
 *
 * @param payload  Finaler Provider-Payload (Prompt-String inkl. RAG-Kontext)
 * @throws {PiiGuardError} wenn PII erkannt
 */
export function assertNoPii(payload: string): void {
  // Masken entfernen
  let scanText = payload;
  for (const mask of KNOWN_MASKS) {
    scanText = scanText.replaceAll(mask, "");
  }

  const detected: string[] = [];

  // 1. Name-Paar-Scan
  if (containsSuspectNamePair(scanText)) {
    detected.push("Name-Pattern (Vorname Nachname)");
  }

  // 2. Weitere PII-Muster
  for (const { name, test } of OTHER_PII_CHECKS) {
    if (test(scanText)) {
      detected.push(name);
    }
  }

  if (detected.length > 0) {
    throw new PiiGuardError(
      "Sicherheitsprüfung fehlgeschlagen: Potenzielle Klardaten im Prompt erkannt.",
      detected,
      payload.length,
    );
  }
}
