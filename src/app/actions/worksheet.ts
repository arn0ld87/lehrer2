'use server';

/**
 * worksheet.ts — Server Action für /arbeitsblaetter (generateWorksheetAction)
 *
 * Ablauf (fail-closed):
 *   Session → Teacher-Profil → Religion-Validation → WorksheetInput bauen →
 *   GenerationDeps → generateWorksheet → ActionResult serialisieren.
 *
 * Datenschutz: console.error enthält KEIN PII, keine Schülernamen.
 * Cloud-Pfad: ausdrücklich kein Cloud-LLM ohne CloudReleaseGrant (AGENTS.md).
 */

import { revalidatePath } from 'next/cache';

import { getActiveTeacher } from '@/lib/auth/index';
import {
  generateWorksheet,
  GenerationBlockedError,
  type WorksheetInput,
  type WorksheetDifficulty,
} from '@/lib/generation/worksheet';
import { createGenerationDeps } from '@/lib/generation/factory';

// Serialisierbare UI-Typen + Mapper aus ./shared (kein 'use server')
import { mapCitation, parseConstraints } from './shared';
import type { UICitation, UIStatement } from './shared';

// ── Serialisierbarer Ergebnistyp ─────────────────────────────────────────────

export interface WorksheetActionResult {
  ok: boolean;
  error?: string;
  unavailable?: boolean;
  message?: string;
  crossDenominationWarning?: boolean;
  worksheetId?: string;
  taskIds?: string[];
  statements: UIStatement[];
  citations: UICitation[];
}

// ── Konstanten ────────────────────────────────────────────────────────────────

const RELIGION_SUBJECTS = new Set([
  'evangelische-religion',
  'katholische-religion',
]);

const VALID_DIFFICULTIES = new Set<string>(['Basis', 'Erweiterung', 'Foerder']);

const EMPTY: WorksheetActionResult = { ok: false, statements: [], citations: [] };

// ── Server Action ─────────────────────────────────────────────────────────────

/**
 * generateWorksheetAction — kompatibel mit <form action> / useActionState.
 *
 * FormData-Felder: subject, confession (optional), schoolForm, gradeBand, topic,
 *   difficulties (getAll — mehrere Werte: "Basis", "Erweiterung", "Foerder").
 */
export async function generateWorksheetAction(
  _prev: WorksheetActionResult | null,
  formData: FormData,
): Promise<WorksheetActionResult> {
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
  // Freitext-Feinabstimmung (optional) — fließt in den Generierungs-Prompt
  const instructions = formData.get('instructions')?.toString().trim() || undefined;

  // difficulties: mehrere Werte per getAll; nur valide Werte übernehmen
  const rawDifficulties = formData.getAll('difficulties').map(String);
  const difficulties: WorksheetDifficulty[] =
    rawDifficulties.filter((d) => VALID_DIFFICULTIES.has(d)) as WorksheetDifficulty[];

  // Didaktische Rahmenbedingungen (JSON-Array oder ;-getrennt) → fließen in den Prompt
  const constraints = parseConstraints(formData.get('constraints')?.toString());

  // 4. Religion-Validierung: Konfession Pflicht bei ev./kath. Religion
  if (RELIGION_SUBJECTS.has(subject) && !confession) {
    return {
      ...EMPTY,
      error: 'Konfession ist Pflichtfeld für Religionsunterricht',
    };
  }

  // 5. Generierung
  const input: WorksheetInput = {
    userId: teacher.userId,
    schoolId: teacher.schoolId,
    subject,
    confession,
    schoolForm,
    gradeBand,
    topic,
    difficulties: difficulties.length > 0 ? difficulties : undefined,
    constraints: constraints.length > 0 ? constraints : undefined,
    instructions,
  };

  try {
    const deps = createGenerationDeps();
    const result = await generateWorksheet(deps, input);

    revalidatePath('/arbeitsblaetter');

    if (result.unavailable) {
      // RAG offline: freundlich kommunizieren, kein Crash
      return {
        ok: true,
        unavailable: true,
        message: result.message,
        crossDenominationWarning: result.crossDenominationWarning,
        worksheetId: result.worksheetId,
        taskIds: result.taskIds,
        statements: [],
        citations: [],
      };
    }

    return {
      ok: true,
      worksheetId: result.worksheetId,
      taskIds: result.taskIds,
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
    console.error('[generateWorksheetAction] Generierung fehlgeschlagen', {
      subject,
      schoolForm,
    });
    return { ...EMPTY, error: 'Generierung fehlgeschlagen' };
  }
}
