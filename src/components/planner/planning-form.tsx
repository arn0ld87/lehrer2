'use client';

import { useActionState, useState } from 'react';
import { Button } from '../ui/button';
import { StatusChip } from '../ui/status-chip';
import { Notice } from '../ui';
import { PlanningProgress } from './planning-progress';
import { StructureProposal } from './structure-proposal';
import { CurriculumFitCard } from './curriculum-fit-card';
import {
  generatePlanningAction,
  type UIStatement,
  type UICitation,
} from '@/app/actions/planning';
import { exportPlanningAction } from '@/app/actions/export';
import type { PlanningStep, StructurePhase, CurriculumFit } from '@/lib/types';

interface PlanningFormProps {
  initialSteps: PlanningStep[];
  initialPhases: StructurePhase[];
  initialCurriculum: CurriculumFit[];
}

const RELIGION_SUBJECTS = new Set(['evangelische-religion', 'katholische-religion']);
const TRUSTED_LEVELS = new Set(['OFFICIAL_BINDING', 'OFFICIAL_GUIDANCE']);

const DRAFT_KEY = 'ua-lsa:planung-draft';

/** Vordefinierte Rahmenbedingungs-Chips (zusätzlich zu Freitext via "+ Kontext"). */
const PRESET_CONSTRAINTS = [
  '45 Minuten',
  'Doppelstunde (90 Min)',
  'heterogene Lerngruppe',
  'LRS-Unterstützung',
  'Inklusion',
  'digitale Endgeräte',
];

interface PlanFields {
  subject: string;
  confession: string;
  gradeBand: string;
  schoolForm: string;
  topic: string;
  goal: string;
}

const DEFAULT_FIELDS: PlanFields = {
  subject: 'deutsch',
  confession: 'evangelisch',
  gradeBand: '9-10',
  schoolForm: 'gymnasialer-bildungsgang',
  topic: '',
  goal: '',
};

/** Startfertige Vorlagen — füllen Formular + Rahmenbedingungen in einem Klick. */
const TEMPLATES: { id: string; label: string; fields: PlanFields; constraints: string[] }[] = [
  {
    id: 'kurzgeschichte',
    label: 'Kurzgeschichte analysieren · Deutsch, Kl. 9–10',
    fields: {
      subject: 'deutsch',
      confession: 'evangelisch',
      gradeBand: '9-10',
      schoolForm: 'gymnasialer-bildungsgang',
      topic: 'Eine Kurzgeschichte analysieren',
      goal: 'Die Lernenden analysieren Aufbau, Figuren und Wirkung einer Kurzgeschichte.',
    },
    constraints: ['45 Minuten', 'heterogene Lerngruppe'],
  },
  {
    id: 'gedicht',
    label: 'Gedicht erschließen · Deutsch, Kl. 7–8',
    fields: {
      subject: 'deutsch',
      confession: 'evangelisch',
      gradeBand: '7-8',
      schoolForm: 'gemeinschaftsschule',
      topic: 'Ein Gedicht erschließen',
      goal: 'Die Lernenden erschließen Form und Inhalt eines Gedichts und deuten seine Wirkung.',
    },
    constraints: ['45 Minuten', 'LRS-Unterstützung'],
  },
  {
    id: 'charakterisierung',
    label: 'Charakterisierung schreiben · Deutsch, Kl. 9–10',
    fields: {
      subject: 'deutsch',
      confession: 'evangelisch',
      gradeBand: '9-10',
      schoolForm: 'gemeinschaftsschule',
      topic: 'Eine Charakterisierung schreiben',
      goal: 'Die Lernenden verfassen eine strukturierte, textbelegte Charakterisierung.',
    },
    constraints: ['heterogene Lerngruppe'],
  },
];

function statementsToPhases(statements: UIStatement[]): StructurePhase[] {
  return statements.map((s, i) => ({
    id: String(i),
    title: s.text.length > 90 ? s.text.slice(0, 90) + '…' : s.text,
    detail:
      s.confidence === 'GROUNDED'
        ? `Quellengestützt${s.citationRefs.length ? ' · [' + s.citationRefs.join(', ') + ']' : ''}`
        : 'Entwurf — noch nicht quellengestützt',
  }));
}

function citationsToFit(citations: UICitation[]): CurriculumFit[] {
  return citations.map((c) => ({
    id: String(c.index),
    label: c.title,
    detail: [c.publisher, c.locator].filter(Boolean).join(' · '),
    sourceHint: c.license,
    status: TRUSTED_LEVELS.has(c.trustLevel)
      ? ('belegt' as const)
      : ('pruefen' as const),
  }));
}

/**
 * PlanningForm — Client-Shell für /planung.
 *
 * Kapselt beide Grid-Reihen (Form+Fortschritt, Proposal+Fit), damit
 * useActionState-State ohne Context an StructureProposal/CurriculumFitCard
 * fließen kann. Vor dem ersten Submit: Mock-Daten aus initialPhases/initialCurriculum.
 * Nach Submit mit Ergebnis: echte Statements/Citations (kein Mock mehr sichtbar).
 *
 * Interaktiv: Vorlagen (Presets), wählbare Rahmenbedingungen (fließen in die
 * Generierung), Entwurf speichern/wiederherstellen (localStorage).
 */
export function PlanningForm({
  initialSteps,
  initialPhases,
  initialCurriculum,
}: PlanningFormProps) {
  const [state, formAction, pending] = useActionState(generatePlanningAction, null);
  const [fields, setFields] = useState<PlanFields>(DEFAULT_FIELDS);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState<null | 'docx' | 'pdf'>(null);

  // Entwurf explizit laden (kein mount-Effect → SSR-sicher, keine Cascading Renders).
  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        setDraftNote('Kein gespeicherter Entwurf gefunden.');
        return;
      }
      const parsed = JSON.parse(raw) as { fields?: Partial<PlanFields>; constraints?: string[] };
      if (parsed.fields) setFields((f) => ({ ...f, ...parsed.fields }));
      if (Array.isArray(parsed.constraints)) setConstraints(parsed.constraints);
      setDraftNote('Gespeicherten Entwurf geladen.');
    } catch {
      setDraftNote('Entwurf konnte nicht geladen werden.');
    }
  };

  const setField = (key: keyof PlanFields, value: string) =>
    setFields((f) => ({ ...f, [key]: value }));

  const toggleConstraint = (c: string) =>
    setConstraints((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const addCustom = () => {
    const t = customValue.trim();
    if (t && !constraints.includes(t)) setConstraints((cur) => [...cur, t]);
    setCustomValue('');
    setCustomOpen(false);
  };

  const applyTemplate = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setFields(tpl.fields);
    setConstraints(tpl.constraints);
    setDraftNote(`Vorlage „${tpl.label}" übernommen — anpassbar.`);
  };

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ fields, constraints }));
      setDraftNote('Entwurf gespeichert (lokal in diesem Browser).');
    } catch {
      setDraftNote('Entwurf konnte nicht gespeichert werden.');
    }
  };

  const exportPlan = async (format: 'docx' | 'pdf') => {
    if (!state?.ok || state.unavailable || state.statements.length === 0) return;
    setExporting(format);
    try {
      const res = await exportPlanningAction(
        {
          title: fields.topic || 'Unterrichtsplanung',
          statements: state.statements.map((s) => ({
            text: s.text,
            citationRefs: s.citationRefs,
          })),
          citations: state.citations.map((c) => ({
            title: c.title,
            locator: c.locator,
            license: c.license,
          })),
        },
        format,
      );
      if (res.ok && res.base64 && res.filename) {
        downloadBase64(res.base64, res.filename, format);
        setDraftNote(`Export erstellt: ${res.filename}`);
      } else {
        setDraftNote(res.error ?? 'Export fehlgeschlagen.');
      }
    } catch {
      setDraftNote('Export fehlgeschlagen.');
    } finally {
      setExporting(null);
    }
  };

  const showConfession = RELIGION_SUBJECTS.has(fields.subject);
  const hasStatements =
    !!state?.ok && !state.unavailable && state.statements.length > 0;

  const phases = hasStatements
    ? statementsToPhases(state.statements)
    : initialPhases;
  const curriculum = hasStatements
    ? citationsToFit(state.citations)
    : initialCurriculum;

  return (
    <div className="grid gap-5">
      {/* Vorlagen-Leiste */}
      <div className="flex flex-wrap items-center gap-2 bg-surface border border-line rounded-[14px] px-3.5 py-2.5">
        <span className="text-[11px] font-bold text-ink-body">Vorlage verwenden:</span>
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => applyTemplate(t.id)}
            className="inline-flex items-center rounded-full text-[10px] font-bold px-2.5 py-[5px] bg-chip-bg text-ink-body border border-line hover:border-focus-ring transition"
          >
            {t.label}
          </button>
        ))}
      </div>

      {draftNote && (
        <Notice icon="check" title="Hinweis" tone="info">
          {draftNote}
        </Notice>
      )}

      {/* Reihe 1: Formular + Fortschritt */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <form
          action={formAction}
          className="bg-surface border border-line rounded-[22px] shadow-subtle p-[19px]"
        >
          <div className="flex items-center justify-between gap-2.5 mb-[15px]">
            <div>
              <h2 className="font-display text-base font-extrabold tracking-[-0.025em] m-0">
                Neue Unterrichtseinheit
              </h2>
              <p className="text-xs text-muted mt-[3px] m-0">
                Rahmendaten zuerst, danach entstehen Ziele und Stundenlogik.
              </p>
            </div>
            <StatusChip
              status={pending ? 'progress' : hasStatements ? 'ready' : 'draft'}
            />
          </div>

          {/* Fehler */}
          {state && !state.ok && state.error && (
            <div className="mb-3.5">
              <Notice icon="alert" title="Fehler" tone="warning">
                {state.error}
              </Notice>
            </div>
          )}

          {/* RAG nicht verfügbar */}
          {state?.unavailable && (
            <div className="mb-3.5">
              <Notice icon="shield" title="Wissensbasis nicht verfügbar" tone="info">
                {state.message ??
                  'Die Wissensbasis ist vorübergehend offline. Bitte später erneut versuchen.'}
              </Notice>
            </div>
          )}

          {/* Konfessionsübergreifende Warnung */}
          {state?.crossDenominationWarning && (
            <div className="mb-3.5">
              <Notice icon="alert" title="Konfessionsübergreifende Inhalte" tone="warning">
                Einige Quellen decken mehrere Konfessionen ab — bitte prüfen.
              </Notice>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Fach">
              <SelectField
                name="subject"
                value={fields.subject}
                onChange={(e) => setField('subject', e.target.value)}
              >
                <option value="deutsch">Deutsch</option>
                <option value="evangelische-religion">Evangelische Religion</option>
                <option value="katholische-religion">Katholische Religion</option>
                <option value="ethik">Ethik</option>
              </SelectField>
            </Field>

            {/* Konfession: nur bei ev./kath. Religion, nie bei Ethik */}
            {showConfession && (
              <Field label="Konfession (Pflichtfeld)">
                <SelectField
                  name="confession"
                  value={fields.confession}
                  onChange={(e) => setField('confession', e.target.value)}
                >
                  <option value="evangelisch">Evangelisch</option>
                  <option value="katholisch">Katholisch</option>
                </SelectField>
              </Field>
            )}

            <Field label="Klasse / Jahrgangsstufe">
              <SelectField
                name="gradeBand"
                value={fields.gradeBand}
                onChange={(e) => setField('gradeBand', e.target.value)}
              >
                <option value="5-6">Klasse 5–6</option>
                <option value="7-8">Klasse 7–8</option>
                <option value="9-10">Klasse 9–10</option>
                <option value="11-12">Klasse 11–12</option>
              </SelectField>
            </Field>

            <Field label="Bildungsgang">
              <SelectField
                name="schoolForm"
                value={fields.schoolForm}
                onChange={(e) => setField('schoolForm', e.target.value)}
              >
                <option value="gemeinschaftsschule">Gemeinschaftsschule</option>
                <option value="gymnasialer-bildungsgang">
                  Gymnasialer Bildungsgang
                </option>
              </SelectField>
            </Field>
          </div>

          <div className="mt-3.5">
            <Field label="Thema der Einheit">
              <input
                name="topic"
                value={fields.topic}
                onChange={(e) => setField('topic', e.target.value)}
                className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink outline-none focus:border-focus-ring focus:shadow-focus-ring transition w-full"
                placeholder="z. B. Eine Charakterisierung schreiben"
              />
            </Field>
          </div>

          <div className="mt-3.5">
            <Field label="Ziel in eigenen Worten">
              {/* Kein name= — Action liest dieses Feld nicht; bleibt als UX-Unterstützung */}
              <textarea
                value={fields.goal}
                onChange={(e) => setField('goal', e.target.value)}
                className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink outline-none focus:border-focus-ring focus:shadow-focus-ring transition w-full min-h-[94px] resize-y"
                placeholder="Die Lernenden …"
              />
            </Field>
          </div>

          <div className="mt-3.5">
            <Field label="Besondere Rahmenbedingungen">
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CONSTRAINTS.map((c) => (
                  <ToggleChip
                    key={c}
                    active={constraints.includes(c)}
                    onClick={() => toggleConstraint(c)}
                  >
                    {c}
                  </ToggleChip>
                ))}
                {/* Freitext-Rahmenbedingungen (nicht in den Presets) */}
                {constraints
                  .filter((c) => !PRESET_CONSTRAINTS.includes(c))
                  .map((c) => (
                    <ToggleChip key={c} active onClick={() => toggleConstraint(c)}>
                      {c} ✕
                    </ToggleChip>
                  ))}
                {customOpen ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustom();
                        }
                      }}
                      autoFocus
                      placeholder="eigene Bedingung"
                      className="border border-line-strong bg-surface rounded-full px-2.5 py-[3px] text-[10px] outline-none focus:border-focus-ring w-[140px]"
                    />
                    <button
                      type="button"
                      onClick={addCustom}
                      className="inline-flex items-center rounded-full text-[10px] font-bold px-2 py-[5px] bg-primary text-white"
                    >
                      ✓
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCustomOpen(true)}
                    className="inline-flex items-center rounded-full text-[10px] font-bold px-2 py-[5px] bg-chip-bg text-muted border border-line hover:border-focus-ring transition"
                  >
                    + Kontext
                  </button>
                )}
              </div>
            </Field>
          </div>

          {/* Ausgewählte Rahmenbedingungen werden mit dem Formular übermittelt */}
          <input type="hidden" name="constraints" value={JSON.stringify(constraints)} />

          <div className="flex gap-2.5 justify-end mt-5">
            <Button variant="ghost" type="button" onClick={loadDraft}>
              Entwurf laden
            </Button>
            <Button variant="secondary" type="button" onClick={saveDraft}>
              Entwurf speichern
            </Button>
            <Button variant="primary" type="submit" disabled={pending}>
              {pending ? 'Wird generiert …' : 'Struktur vorschlagen'}
            </Button>
          </div>
        </form>

        <PlanningProgress steps={initialSteps} />
      </div>

      {/* Reihe 2: Vorgeschlagene Struktur + Curriculum-Fit
          Vor erstem Submit zeigen initialPhases/initialCurriculum (Mock).
          Nach Submit mit Ergebnis: Statements → StructurePhase,
          Citations → CurriculumFit — kein Mock mehr sichtbar. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.92fr)]">
        <StructureProposal
          key={state?.lessonId ?? 'initial'}
          phases={phases}
          editable={hasStatements}
        />
        <CurriculumFitCard items={curriculum} />
      </div>

      {/* Weiter-Schritt: generierte Einheit als Dokument sichern (erscheint nach Generierung) */}
      {hasStatements && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-line rounded-[14px] px-4 py-3.5">
          <div className="min-w-0">
            <strong className="block text-[12px]">Weiter: Einheit sichern</strong>
            <span className="block text-[10px] text-muted">
              Quellengebundener Entwurf — als Dokument exportieren (mit Quellen- und Lizenz-Footer).
            </span>
          </div>
          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              type="button"
              disabled={!!exporting}
              onClick={() => exportPlan('docx')}
            >
              {exporting === 'docx' ? 'Erstelle …' : 'Als DOCX exportieren'}
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={!!exporting}
              onClick={() => exportPlan('pdf')}
            >
              {exporting === 'pdf' ? 'Erstelle …' : 'Als PDF exportieren'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Lädt eine base64-kodierte Datei (DOCX/PDF) im Browser herunter. */
function downloadBase64(base64: string, filename: string, format: 'docx' | 'pdf') {
  const mime =
    format === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Lokale Hilfskomponenten ──────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold text-ink-body">{label}</span>
      {children}
    </label>
  );
}

interface SelectFieldProps {
  children: React.ReactNode;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

function SelectField({ children, name, value, onChange }: SelectFieldProps) {
  return (
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink outline-none focus:border-focus-ring focus:shadow-focus-ring transition w-full appearance-none pr-[30px]"
    >
      {children}
    </select>
  );
}

function ToggleChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center rounded-full text-[10px] font-bold px-2 py-[5px] border transition ${
        active
          ? 'bg-primary text-white border-primary'
          : 'bg-chip-bg text-muted border-line hover:border-focus-ring'
      }`}
    >
      {children}
    </button>
  );
}
