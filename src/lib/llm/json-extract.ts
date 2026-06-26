/**
 * stripJsonFences — extrahiert validen JSON-Text aus LLM-Antworten.
 *
 * Manche Modelle (u. a. gpt-oss über Ollama-Cloud) verpacken strukturierte
 * Ausgaben in Markdown-Code-Blöcke (```json … ```) oder umgeben sie mit Prosa,
 * obwohl ein JSON-Schema/response_format angefragt wurde. Direktes JSON.parse()
 * scheitert dann und der fail-closed-Pfad liefert ein leeres Ergebnis (0 Statements).
 *
 * Diese Funktion entfernt Code-Fences und schneidet das äußerste JSON-Objekt bzw.
 * -Array heraus. Sie erfindet nichts: ist kein JSON enthalten, bleibt der Rückgabe-
 * Wert ungültig und der Aufrufer wirft weiterhin StructuredParseError.
 */
/**
 * coerceToSchemaShape — normalisiert ein geparstes LLM-Ergebnis auf die vom
 * Schema verlangte Form.
 *
 * Hintergrund (Bug 2026-06-26): gpt-oss über Ollama-Cloud ignoriert
 * `strict: true json_schema` und flacht Single-Property-Wrapper-Schemata ab —
 * statt `{ statements: [...] }` kommt ein BARE ARRAY `[...]` zurück. Die
 * Generierung las dann `parsed.statements` = undefined → fail-closed 0 Statements,
 * und /planung + /arbeitsblaetter fielen still auf Mock-Daten zurück.
 *
 * Diese Funktion erfindet nichts: Sie wickelt ein bare Array NUR dann ein, wenn
 * das Schema ein Objekt mit GENAU EINER Array-typisierten Property beschreibt
 * (eindeutiger Wrapper). In allen anderen Fällen bleibt der Wert unverändert.
 */
export function coerceToSchemaShape(
  parsed: unknown,
  schema: Record<string, unknown>,
): unknown {
  if (!Array.isArray(parsed)) return parsed;
  if (!schema || typeof schema !== "object" || schema.type !== "object") {
    return parsed;
  }
  const properties = schema.properties;
  if (!properties || typeof properties !== "object") return parsed;

  const arrayProps = Object.entries(properties as Record<string, unknown>).filter(
    ([, def]) =>
      def != null && typeof def === "object" && (def as { type?: unknown }).type === "array",
  );
  if (arrayProps.length !== 1) return parsed;

  return { [arrayProps[0][0]]: parsed };
}

export function stripJsonFences(raw: string): string {
  let s = raw.trim();

  // ```json … ``` oder ``` … ``` → Inhalt extrahieren
  const fenced = s.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenced && fenced[1]) {
    s = fenced[1].trim();
  }

  // Noch Prosa drumherum? Äußerstes { … } / [ … ] herausschneiden.
  if (s[0] !== "{" && s[0] !== "[") {
    const objStart = s.indexOf("{");
    const arrStart = s.indexOf("[");
    const start =
      objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
    if (start >= 0) {
      const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
      if (end > start) s = s.slice(start, end + 1);
    }
  }

  return s.trim();
}
