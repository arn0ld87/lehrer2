'use server';

/**
 * planning.ts — Server Action für /planung (generatePlanningAction)
 *
 * Ablauf (fail-closed):
 *   Session → Teacher-Profil → Religion-Validation → PlanningInput bauen →
 *   GenerationDeps → generatePlanning → ActionResult serialisieren.
 *
 * Datenschutz: console.error enthält KEIN PII, keine Schülernamen.
 * Cloud-Pfad: ausdrücklich kein Cloud-LLM ohne CloudReleaseGrant (AGENTS.md).
 */

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth/auth';
import { getCurrentTeacher } from '@/lib/auth/index';
import {
  generatePlanning,
  GenerationBlockedError,
  type PlanningInput,
} from '@/lib/generation/planning';
import { createGenerationDeps } from '@/lib/generation/factory';
import type { RankedCitation } from '@/lib/rag/citation';

// ── Serialisierbare UI-Typen ─────────────────────────────────────────────────

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

export interface PlanningActionResult {
  ok: boolean;
  error?: string;
  unavailable?: boolean;
  message?: string;
  crossDenominationWarning?: boolean;
  teachingUnitId?: string;
  lessonId?: string;
  statements: UIStatement[];
  citations: UICitation[];
}

// ── Mapping-Hilfsfunktion (exportiert für Tests / Werkzeug-Stubs) ─────────────

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

// ── Konstanten ────────────────────────────────────────────────────────────────

const RELIGION_SUBJECTS = new Set([
  'evangelische-religion',
  'katholische-religion',
]);

const EMPTY: PlanningActionResult = { ok: false, statements: [], citations: [] };

// ── Server Action ─────────────────────────────────────────────────────────────

/**
 * generatePlanningAction — kompatibel mit <form action> / useActionState.
 *
 * FormData-Felder: subject, confession (optional), schoolForm, gradeBand, topic.
 */
export async function generatePlanningAction(
  _prev: PlanningActionResult | null,
  formData: FormData,
): Promise<PlanningActionResult> {
  // 1. Session prüfen
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ...EMPTY, error: 'Nicht angemeldet' };
  }

  // 2. Teacher-Profil laden
  const teacher = await getCurrentTeacher(session.user.id);
  if (!teacher) {
    return { ...EMPTY, error: 'Kein Lehrerprofil gefunden' };
  }

  // 3. FormData lesen
  const subject = formData.get('subject')?.toString() ?? '';
  const confession = formData.get('confession')?.toString() || undefined;
  const schoolForm = formData.get('schoolForm')?.toString() ?? '';
  const gradeBand = formData.get('gradeBand')?.toString() ?? '';
  const topic = formData.get('topic')?.toString() ?? '';

  // 4. Religion-Validierung: Konfession Pflicht bei ev./kath. Religion
  if (RELIGION_SUBJECTS.has(subject) && !confession) {
    return {
      ...EMPTY,
      error: 'Konfession ist Pflichtfeld für Religionsunterricht',
    };
  }

  // 5. Generierung
  const input: PlanningInput = {
    userId: teacher.userId,
    schoolId: teacher.schoolId,
    subject,
    confession,
    schoolForm,
    gradeBand,
    topic,
  };

  try {
    const deps = createGenerationDeps();
    const result = await generatePlanning(deps, input);

    revalidatePath('/planung');

    if (result.unavailable) {
      // RAG offline: freundlich kommunizieren, kein Crash
      return {
        ok: true,
        unavailable: true,
        message: result.message,
        crossDenominationWarning: result.crossDenominationWarning,
        teachingUnitId: result.teachingUnitId,
        lessonId: result.lessonId,
        statements: [],
        citations: [],
      };
    }

    return {
      ok: true,
      teachingUnitId: result.teachingUnitId,
      lessonId: result.lessonId,
      crossDenominationWarning: result.crossDenominationWarning,
      statements: result.statements.map((s) => ({
        text: s.text,
        confidence: s.confidence,
        citationRefs: s.citationRefs,
      })),
      citations: result.citations.map((c, i) => mapCitation(c, i + 1)),
    };
  } catch (e) {
    if (e instanceof GenerationBlockedError) {
      return { ...EMPTY, error: e.message };
    }
    // Kein PII im Log — nur Fach/Schulform als Kontext
    console.error('[generatePlanningAction] Generierung fehlgeschlagen', {
      subject,
      schoolForm,
    });
    return { ...EMPTY, error: 'Generierung fehlgeschlagen' };
  }
}
