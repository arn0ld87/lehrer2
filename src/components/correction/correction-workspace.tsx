'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { Card, CardHead, Button, Notice } from '../ui';
import { StatusChip } from '../ui/status-chip';
import { SubmissionPreview } from './submission-preview';
import { RubricScoreCard } from './rubric-score-card';
import { FeedbackDraft } from './feedback-draft';
import { CorrectionHistory } from './correction-history';
import { correctionAction } from '@/app/actions/correction';
import type { CorrectionSubmissionMeta } from '@/lib/repositories';
import type {
  FeedbackHistoryEntry,
  FeedbackStatement,
  RubricScore,
} from '@/lib/types';

const RELIGION_SUBJECTS = new Set(['evangelische-religion', 'katholische-religion']);

interface CorrectionWorkspaceProps {
  initialMeta: CorrectionSubmissionMeta;
  initialScores: RubricScore[];
  initialStatements: FeedbackStatement[];
  history: FeedbackHistoryEntry[];
}

/**
 * CorrectionWorkspace — Client-Shell für /korrektur.
 *
 * Links: Eingabe (Rahmendaten + Schülerarbeit per Paste ODER Upload), gebunden an
 * correctionAction. Rechts: Vorschlag (Rubric + Feedback) — vor dem ersten Lauf die
 * zuletzt gespeicherte Korrektur, danach das frisch generierte Ergebnis.
 *
 * Datenschutz: nur Pseudonyme sichtbar; der Schülertext wird übermittelt, aber nicht
 * angezeigt/gespeichert. Sprache bewusst „Vorschlag/Prüfen", nie „Note/Übernehmen".
 */
export function CorrectionWorkspace({
  initialMeta,
  initialScores,
  initialStatements,
  history,
}: CorrectionWorkspaceProps) {
  const [state, formAction, pending] = useActionState(correctionAction, null);
  const [subject, setSubject] = React.useState('deutsch');
  const isReligion = RELIGION_SUBJECTS.has(subject);

  const hasResult = !!state?.ok && !state.unavailable;
  const scores = hasResult ? state!.rubricScores : initialScores;
  const statements = hasResult ? state!.statements : initialStatements;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(310px,0.7fr)]">
      {/* Linke Spalte: Eingabe + Vorschau */}
      <div className="grid gap-5 content-start">
        <Card>
          <CardHead
            title="Schülerarbeit hinzufügen"
            subtitle="Text einfügen oder Datei hochladen — pseudonymisiert, kein Klarname."
          />

          {state && !state.ok && state.error && (
            <div className="mb-3.5">
              <Notice icon="alert" title="Hinweis" tone="warning">
                {state.error}
              </Notice>
            </div>
          )}
          {state?.unavailable && (
            <div className="mb-3.5">
              <Notice icon="shield" title="Dienst nicht verfügbar" tone="info">
                Die Korrektur-Generierung ist momentan nicht erreichbar. Bitte später erneut versuchen.
              </Notice>
            </div>
          )}
          {state?.crossDenominationWarning && (
            <div className="mb-3.5">
              <Notice icon="alert" title="Konfessions-Hinweis" tone="warning">
                Die herangezogenen Quellen umfassen mehrere Konfessionskontexte — bitte prüfen.
              </Notice>
            </div>
          )}

          <form action={formAction} className="grid gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Fach">
                <Select name="subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
                  <option value="deutsch">Deutsch</option>
                  <option value="evangelische-religion">Ev. Religion</option>
                  <option value="katholische-religion">Kath. Religion</option>
                  <option value="ethik">Ethik</option>
                </Select>
              </Field>
              {isReligion && (
                <Field label="Konfession *">
                  <Select name="confession" defaultValue="EVANGELISCH">
                    <option value="EVANGELISCH">Evangelisch</option>
                    <option value="KATHOLISCH">Katholisch</option>
                  </Select>
                </Field>
              )}
              <Field label="Schulform">
                <Select name="schoolForm" defaultValue="GEMEINSCHAFTSSCHULE">
                  <option value="GESAMTSCHULE">Gesamtschule</option>
                  <option value="GEMEINSCHAFTSSCHULE">Gemeinschaftsschule</option>
                </Select>
              </Field>
              <Field label="Jahrgang">
                <Select name="gradeBand" defaultValue="KS8">
                  <option value="KS5">Klasse 5</option>
                  <option value="KS6">Klasse 6</option>
                  <option value="KS7">Klasse 7</option>
                  <option value="KS8">Klasse 8</option>
                  <option value="KS9">Klasse 9</option>
                  <option value="KS10">Klasse 10</option>
                </Select>
              </Field>
            </div>

            <Field label="Aufgabenstellung / Kontext">
              <input
                name="topic"
                type="text"
                placeholder="z. B. Charakterisierung schreiben"
                className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink text-[13px] outline-none focus:border-focus-ring focus:shadow-focus-ring transition w-full"
              />
            </Field>

            <Field label="Schülerarbeit (Text einfügen)">
              <textarea
                name="studentWork"
                placeholder="Text der Schülerarbeit hier einfügen …"
                className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink text-[13px] outline-none focus:border-focus-ring focus:shadow-focus-ring transition w-full min-h-[150px] resize-y"
              />
            </Field>

            <Field label="… oder Datei hochladen (Word/PDF mit Textebene, txt)">
              <input
                name="file"
                type="file"
                accept=".txt,.html,.pdf,.docx"
                className="text-[12px] file:mr-3 file:rounded-[8px] file:border-0 file:bg-primary-soft file:text-primary file:px-3 file:py-1.5 file:text-[11px] file:font-bold"
              />
            </Field>

            <div className="flex items-center justify-between gap-3 mt-1">
              <span className="text-[10px] text-muted">
                Klarnamen werden vor jeder Analyse lokal maskiert.
              </span>
              <Button variant="primary" type="submit" disabled={pending}>
                {pending ? 'Wird geprüft …' : 'Vorschlag erstellen'}
              </Button>
            </div>
          </form>
        </Card>

        <SubmissionPreview
          title={initialMeta.title}
          subjectLabel={initialMeta.subjectLabel}
          submittedAt={initialMeta.submittedAt}
          pseudonym={initialMeta.pseudonym}
        />
      </div>

      {/* Rechte Spalte: Vorschlag (Rubric + Feedback + Verlauf) */}
      <div className="grid gap-5 content-start">
        {hasResult && (
          <Notice icon="check" title="Vorschlag erstellt" tone="info">
            Strukturierter Entwurf — bitte prüfen. Die Bewertung bleibt deine Entscheidung.
          </Notice>
        )}
        <div className="flex items-center gap-2">
          <StatusChip status={hasResult ? 'review' : 'draft'} />
          <span className="text-[11px] text-muted">
            {hasResult ? 'Neuer Vorschlag — ungeprüft' : 'Zuletzt gespeicherte Korrektur'}
          </span>
        </div>
        <RubricScoreCard scores={scores} />
        <FeedbackDraft statements={statements} />
        <CorrectionHistory entries={history} />
      </div>
    </div>
  );
}

// ── Lokale Hilfskomponenten ──────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold text-ink-body">{label}</span>
      {children}
    </label>
  );
}

function Select({
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink text-[13px] outline-none focus:border-focus-ring focus:shadow-focus-ring transition w-full appearance-none"
      {...rest}
    >
      {children}
    </select>
  );
}
