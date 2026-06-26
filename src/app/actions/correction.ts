'use server';

/**
 * correction.ts — Server Action für /korrektur (correctionAction)
 *
 * Eingabe: Freitext-Paste ODER Datei-Upload (docx/pdf/Bild → extractContent/OCR).
 * Ablauf (fail-closed, SENSITIVE_STUDENT):
 *   Teacher-Kontext → Eingabe lesen (Upload bevorzugt) → Religion-Validierung →
 *   CorrectionInput → generateCorrection (redaction + gegateter Provider) → Result.
 *
 * Datenschutz: console.error enthält KEIN PII, NIE den Schülertext oder Klarnamen.
 * Der Schülertext wird nicht geloggt und nicht im Klartext persistiert.
 */

import { revalidatePath } from 'next/cache';

import { getActiveTeacher } from '@/lib/auth/index';
import {
  generateCorrection,
  GenerationBlockedError,
  type CorrectionInput,
} from '@/lib/generation/correction';
import { createGenerationDeps } from '@/lib/generation/factory';
import { extractContent, ExtractionFailedError } from '@/lib/rag/extract';
import type { FeedbackStatement, RubricScore } from '@/lib/types';

export interface CorrectionActionResult {
  ok: boolean;
  error?: string;
  unavailable?: boolean;
  crossDenominationWarning?: boolean;
  correctionDraftId?: string;
  statements: FeedbackStatement[];
  rubricScores: RubricScore[];
}

const RELIGION_SUBJECTS = new Set(['evangelische-religion', 'katholische-religion']);

const EMPTY: CorrectionActionResult = { ok: false, statements: [], rubricScores: [] };

/**
 * correctionAction — kompatibel mit <form action> / useActionState.
 *
 * FormData-Felder: subject, confession (optional), schoolForm, gradeBand, topic,
 *   studentWork (Paste) und/oder file (Upload). Upload hat Vorrang.
 */
export async function correctionAction(
  _prev: CorrectionActionResult | null,
  formData: FormData,
): Promise<CorrectionActionResult> {
  const teacher = await getActiveTeacher();
  if (!teacher) {
    return { ...EMPTY, error: 'Kein Lehrerprofil gefunden' };
  }

  const subject = formData.get('subject')?.toString() ?? '';
  const confession = formData.get('confession')?.toString() || undefined;
  const schoolForm = formData.get('schoolForm')?.toString() ?? '';
  const gradeBand = formData.get('gradeBand')?.toString() ?? '';
  const topic = formData.get('topic')?.toString() ?? '';
  const pasted = formData.get('studentWork')?.toString() ?? '';

  // Eingabequelle: Upload (docx/pdf/Bild via OCR) bevorzugt, sonst Paste.
  let studentWork = pasted;
  const file = formData.get('file');
  if (
    file &&
    typeof file === 'object' &&
    'arrayBuffer' in file &&
    typeof (file as File).arrayBuffer === 'function' &&
    (file as File).size > 0
  ) {
    const f = file as File;
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      // Ohne OCR-Engine: Text/HTML/Word/PDF mit Textebene werden gelesen.
      // Bild/Scan-PDF (OCR nötig) ist dem Worker-Pfad vorbehalten (BullMQ, noch nicht real)
      // → extractContent wirft ExtractionFailedError, wir degradieren mit klarem Hinweis.
      studentWork = await extractContent(f.name || 'upload', buf, f.type || 'text/plain');
    } catch (e) {
      if (e instanceof ExtractionFailedError) {
        return {
          ...EMPTY,
          error:
            'Diese Datei braucht Texterkennung (Bild/Scan), die im Web-Pfad noch nicht verfügbar ist. ' +
            'Bitte den Text einfügen oder eine Datei mit Textebene (Word, PDF mit Text) hochladen.',
        };
      }
      throw e;
    }
  }

  if (!studentWork.trim()) {
    return { ...EMPTY, error: 'Bitte Schülertext einfügen oder eine Datei hochladen.' };
  }
  if (RELIGION_SUBJECTS.has(subject) && !confession) {
    return { ...EMPTY, error: 'Konfession ist Pflichtfeld für Religionsunterricht' };
  }

  const input: CorrectionInput = {
    userId: teacher.userId,
    schoolId: teacher.schoolId,
    subject,
    confession,
    schoolForm,
    gradeBand,
    topic: topic || 'Schülerarbeit',
    studentWork,
  };

  try {
    const deps = createGenerationDeps();
    const result = await generateCorrection(deps, input);
    revalidatePath('/korrektur');

    return {
      ok: true,
      correctionDraftId: result.correctionDraftId,
      crossDenominationWarning: result.crossDenominationWarning,
      statements: result.statements,
      rubricScores: result.rubricScores,
    };
  } catch (e) {
    if (e instanceof GenerationBlockedError) {
      return { ...EMPTY, error: e.message };
    }
    // Kein PII im Log — nur Fach/Schulform als Kontext, niemals der Schülertext.
    console.error('[correctionAction] Korrektur fehlgeschlagen', { subject, schoolForm });
    return { ...EMPTY, error: 'Korrektur fehlgeschlagen', unavailable: true };
  }
}
