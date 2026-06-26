'use server';

/**
 * export.ts — Server Action für Arbeitsblatt-Export (DOCX / PDF)
 *
 * Ablauf: Session → Teacher-Profil → Worksheet + Tasks + SourceRefs aus DB →
 *   ExportableWorksheet bauen → exportArtifact → base64 zurückgeben.
 *
 * Datenschutz: kein PII in Logs. DB-Zugriff nur nach Sitzungsprüfung.
 */

import { eq } from 'drizzle-orm';

import { getActiveTeacher } from '@/lib/auth/index';
import { db } from '@/lib/db/client';
import {
  worksheet,
  task,
  worksheetSourceRef,
  sourceRef,
} from '@/lib/db/schema/artifacts';
import { exportArtifact } from '@/lib/export';
import type {
  ExportFormat,
  ExportableWorksheet,
  ExportableTask,
} from '@/lib/export/types';
import type { PlanExportPayload } from './shared';

export interface ExportActionResult {
  ok: boolean;
  error?: string;
  filename?: string;
  base64?: string;
}

/**
 * exportPlanningAction — exportiert eine generierte Unterrichtsplanung (DOCX/PDF).
 *
 * Nimmt die im Client vorliegenden Statements + Citations (keine DB-Reload nötig)
 * und rendert sie über das gemeinsame Export-Subsystem mit Quellen-/Lizenz-Footer.
 * Statements tragen kein Niveau (difficulty) — anders als Arbeitsblatt-Aufgaben.
 */
export async function exportPlanningAction(
  payload: PlanExportPayload,
  format: ExportFormat,
): Promise<ExportActionResult> {
  const teacher = await getActiveTeacher();
  if (!teacher) return { ok: false, error: 'Kein Lehrerprofil gefunden' };

  const title = payload.title?.trim() || 'Unterrichtsplanung';
  const exportable: ExportableWorksheet = {
    title: `Unterrichtsplanung – ${title}`,
    instructions:
      'Quellengebundener Entwurf. Vor dem Einsatz prüfen — die Letztentscheidung liegt bei der Lehrkraft.',
    tasks: (payload.statements ?? []).map(
      (s): ExportableTask => ({
        prompt: s.citationRefs?.length ? `${s.text} [${s.citationRefs.join(', ')}]` : s.text,
      }),
    ),
    sources: (payload.citations ?? []).map((c) => ({
      title: c.title,
      locator: c.locator,
      license: c.license,
    })),
  };

  try {
    const result = await exportArtifact(exportable, format);
    return {
      ok: true,
      filename: result.filename,
      base64: result.bytes.toString('base64'),
    };
  } catch {
    console.error('[exportPlanningAction] Export fehlgeschlagen', { format });
    return { ok: false, error: 'Export fehlgeschlagen' };
  }
}

export async function exportWorksheetAction(
  worksheetId: string,
  format: ExportFormat,
): Promise<ExportActionResult> {
  // 1./2. Aktiven Lehrer-Kontext ermitteln (Login deaktiviert → single-tenant-Fallback)
  const teacher = await getActiveTeacher();
  if (!teacher) return { ok: false, error: 'Kein Lehrerprofil gefunden' };

  // 2. Worksheet laden
  const ws = await db.query.worksheet.findFirst({
    where: eq(worksheet.id, worksheetId),
  });
  if (!ws) return { ok: false, error: 'Arbeitsblatt nicht gefunden' };

  // 3. Tasks laden
  const tasks = await db
    .select()
    .from(task)
    .where(eq(task.worksheetId, worksheetId));

  // 4. Quellen über Join laden
  const sourcesRows = await db
    .select({
      title: sourceRef.title,
      license: sourceRef.licenseInfo,
    })
    .from(worksheetSourceRef)
    .innerJoin(sourceRef, eq(worksheetSourceRef.sourceRefId, sourceRef.id))
    .where(eq(worksheetSourceRef.worksheetId, worksheetId));

  // 5. ExportableWorksheet bauen
  const exportable: ExportableWorksheet = {
    title: ws.title,
    instructions: ws.instructions ?? undefined,
    tasks: tasks.map(
      (t): ExportableTask => ({
        prompt: t.prompt,
        difficulty: t.difficulty as 'EASY' | 'MEDIUM' | 'HARD',
      }),
    ),
    license: ws.license ?? undefined,
    derivationSource: ws.derivationSource ?? undefined,
    sources: sourcesRows.map((s) => ({
      title: s.title,
      license: s.license ?? undefined,
    })),
  };

  // 6. Exportieren
  try {
    const result = await exportArtifact(exportable, format);
    return {
      ok: true,
      filename: result.filename,
      base64: result.bytes.toString('base64'),
    };
  } catch {
    console.error('[exportWorksheetAction] Export fehlgeschlagen', { format });
    return { ok: false, error: 'Export fehlgeschlagen' };
  }
}
