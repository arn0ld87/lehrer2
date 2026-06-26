/**
 * shared.ts — serialisierbare UI-Typen + reine Mapping-Helfer für die Server Actions.
 *
 * KEIN 'use server': 'use server'-Module dürfen nur async Funktionen exportieren.
 * Nicht-Action-Exporte (Typen + die sync-Funktion mapCitation) leben deshalb hier
 * und werden von planning.ts / worksheet.ts importiert.
 */

import type { RankedCitation } from '@/lib/rag/citation';

/** Zitation, die direkt in React-State übernommen werden kann (keine DB-Objekte). */
export interface UICitation {
  index: number;
  title: string;
  publisher: string;
  /** = pageOrSection der RankedCitation */
  locator: string;
  license: string;
  trustLevel: string;
  confidence: string;
  uri: string | null;
  /** chunkText, auf ~240 Zeichen gekürzt */
  snippet: string;
}

export interface UIStatement {
  text: string;
  confidence: 'GROUNDED' | 'UNSUPPORTED_DRAFT';
  citationRefs: number[];
}

/**
 * Mappt eine RankedCitation auf das serialisierbare UICitation-Format.
 * Pure Funktion — kein IO, keine DB-Abhängigkeiten (einfach testbar).
 *
 * @param c     Vollständige RankedCitation aus dem Retrieval
 * @param index 1-basierter Zitations-Index für die UI (entspricht citationRefs-Wert)
 */
export function mapCitation(c: RankedCitation, index: number): UICitation {
  const snippet =
    c.chunkText.length > 240 ? c.chunkText.slice(0, 240) + '…' : c.chunkText;
  return {
    index,
    title: c.title,
    publisher: c.publisher,
    locator: c.pageOrSection,
    license: c.license,
    trustLevel: c.trustLevel,
    confidence: c.confidence,
    uri: c.uri,
    snippet,
  };
}
