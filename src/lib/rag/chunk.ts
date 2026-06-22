/**
 * chunk.ts — Char-basiertes Text-Chunking
 *
 * Deterministisch; kein Zufallszustand.
 * Chunks < 50 Zeichen werden an den Vorgänger-Chunk angehängt
 * (rag_chunk verlangt char_length >= 50 per DB-CHECK).
 * pageOrSection: "chunk:<index>" (0-basiert), sofern keine Seitenmarkierung erkennbar.
 */

export interface Chunk {
  text: string;
  pageOrSection: string;
}

interface ChunkOptions {
  size?: number;
  overlap?: number;
}

const DEFAULT_SIZE = 1000;
const DEFAULT_OVERLAP = 200;
const MIN_CHUNK_LEN = 50;

/**
 * Zerlegt einen Text in überlappende Chunks.
 *
 * @param text  Eingabe-Text (nach Extraktion)
 * @param opts  size (default 1000), overlap (default 200)
 * @returns     Array von Chunks; leer wenn text leer
 */
export function chunkText(text: string, opts?: ChunkOptions): Chunk[] {
  const size = opts?.size ?? DEFAULT_SIZE;
  const overlap = opts?.overlap ?? DEFAULT_OVERLAP;

  if (!text.trim()) return [];

  const step = size - overlap;
  if (step <= 0) {
    throw new Error(`chunkText: overlap (${overlap}) muss kleiner sein als size (${size})`);
  }

  // Text passt vollständig in einen einzigen Chunk → kein Splitting nötig
  if (text.length <= size) {
    return [{ text, pageOrSection: "chunk:0" }];
  }

  const raw: string[] = [];
  for (let start = 0; start < text.length; start += step) {
    raw.push(text.slice(start, start + size));
    // Sobald der aktuelle Chunk das Ende des Textes erreicht oder überschreitet,
    // gibt es keinen sinnvollen neuen Startpunkt mehr → Loop beenden.
    if (start + size >= text.length) break;
  }

  if (raw.length === 0) return [];

  // Zu kurze End-Chunks an Vorgänger anhängen
  const merged: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const chunk = raw[i]!;
    if (i === raw.length - 1 && chunk.length < MIN_CHUNK_LEN && merged.length > 0) {
      // Anhängen an Vorgänger
      merged[merged.length - 1] += chunk;
    } else {
      merged.push(chunk);
    }
  }

  return merged.map((t, i) => ({
    text: t,
    pageOrSection: `chunk:${i}`,
  }));
}
