'use server';

/**
 * export.ts — Server Action für Arbeitsblatt-Export (DOCX / PDF)
 *
 * Ablauf: Session → Teacher-Profil → Worksheet + Tasks + SourceRefs aus DB →
 *   ExportableWorksheet bauen → exportArtifact → base64 zurückgeben.
 *
 * Datenschutz: kein PII in Logs. DB-Zugriff nur nach Sitzungsprüfung.
 */

import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

import { auth } from '@/lib/auth/auth';
import { getCurrentTeacher } from '@/lib/auth/index';
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

export interface ExportActionResult {
  ok: boolean;
  error?: string;
  filename?: string;
  base64?: string;
}

export async function exportWorksheetAction(
  worksheetId: string,
  format: ExportFormat,
): Promise<ExportActionResult> {
  // 1. Session prüfen
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: 'Nicht angemeldet' };

  const teacher = await getCurrentTeacher(session.user.id);
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
