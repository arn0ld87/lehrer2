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

import { revalidatePath } from 'next/cache';

import { getActiveTeacher } from '@/lib/auth/index';
import {
  generatePlanning,
  GenerationBlockedError,
  type PlanningInput,
} from '@/lib/generation/planning';
import { createGenerationDeps } from '@/lib/generation/factory';

// Nicht-Action-Exporte (Typen + sync mapCitation) liegen in ./shared —
// 'use server'-Module dürfen ausschließlich async Funktionen exportieren.
import { mapCitation } from './shared';
import type { UICitation, UIStatement } from './shared';

export type { UICitation, UIStatement } from './shared';

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
  // 1./2. Aktiven Lehrer-Kontext ermitteln (Login deaktiviert → single-tenant-Fallback)
  const teacher = await getActiveTeacher();
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
