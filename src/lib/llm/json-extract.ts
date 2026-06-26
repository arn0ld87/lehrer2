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
