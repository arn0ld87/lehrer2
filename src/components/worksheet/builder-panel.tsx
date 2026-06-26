"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import type { SubjectOption } from "@/lib/types";
import { Card, CardHead, Button, Notice } from "../ui";

const RELIGION_SUBJECTS = new Set(["evangelische-religion", "katholische-religion"]);

const DEFAULT_CONFESSION: Record<string, string> = {
  "evangelische-religion": "EVANGELISCH",
  "katholische-religion": "KATHOLISCH",
};

/** Vordefinierte Rahmenbedingungs-Chips (zusätzlich zu Freitext). */
const PRESET_CONSTRAINTS = [
  "45 Minuten",
  "Doppelstunde (90 Min)",
  "heterogene Lerngruppe",
  "LRS-Unterstützung",
  "Inklusion",
  "digitale Endgeräte",
];

/** Arbeitsblatt-Builder — Generierungsformular (gebunden an generateWorksheetAction). */
export function BuilderPanel({ subjects }: { subjects: SubjectOption[] }) {
  const [subject, setSubject] = React.useState<string>(subjects[0]?.value ?? "deutsch");
  const [constraints, setConstraints] = React.useState<string[]>([]);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [customValue, setCustomValue] = React.useState("");
  const isReligion = RELIGION_SUBJECTS.has(subject);

  const toggleConstraint = (c: string) =>
    setConstraints((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const addCustom = () => {
    const t = customValue.trim();
    if (t && !constraints.includes(t)) setConstraints((cur) => [...cur, t]);
    setCustomValue("");
    setCustomOpen(false);
  };

  return (
    <Card className="lg:sticky lg:top-5 h-max">
      <CardHead
        title="Arbeitsblatt-Builder"
        subtitle="Thema, Fach und Differenzierung wählen."
      />

      <div className="grid gap-3">
        {/* Fach */}
        <Field label="Fach" htmlFor="ws-subject">
          <Select
            id="ws-subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        {/* Konfession — nur bei Religion Pflichtfeld */}
        {isReligion && (
          <Field label="Konfession *" htmlFor="ws-confession">
            <Select
              id="ws-confession"
              name="confession"
              defaultValue={DEFAULT_CONFESSION[subject] ?? "EVANGELISCH"}
            >
              <option value="EVANGELISCH">Evangelisch</option>
              <option value="KATHOLISCH">Katholisch</option>
              <option value="KONFESSIONSSENSIBEL_UEBERGREIFEND">
                Konfessionssensibel / übergreifend
              </option>
            </Select>
          </Field>
        )}

        {/* Schulform */}
        <Field label="Schulform" htmlFor="ws-school-form">
          <Select id="ws-school-form" name="schoolForm" defaultValue="GEMEINSCHAFTSSCHULE">
            <option value="GESAMTSCHULE">Gesamtschule</option>
            <option value="GEMEINSCHAFTSSCHULE">Gemeinschaftsschule</option>
          </Select>
        </Field>

        {/* Jahrgangsstufe */}
        <Field label="Jahrgang" htmlFor="ws-grade-band">
          <Select id="ws-grade-band" name="gradeBand" defaultValue="KS8">
            <option value="KS5">Klasse 5</option>
            <option value="KS6">Klasse 6</option>
            <option value="KS7">Klasse 7</option>
            <option value="KS8">Klasse 8</option>
            <option value="KS9">Klasse 9</option>
            <option value="KS10">Klasse 10</option>
          </Select>
        </Field>

        {/* Thema */}
        <Field label="Thema / Lernziel" htmlFor="ws-topic">
          <input
            id="ws-topic"
            name="topic"
            type="text"
            required
            placeholder="z.B. Charakterisierung schreiben"
            className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink text-[13px] outline-none focus:border-focus-ring focus:shadow-focus-ring transition w-full"
          />
        </Field>

        {/* Feinabstimmung — Freitext, fließt verbindlich in den Prompt */}
        <Field label="Zusätzliche Anweisungen (optional)" htmlFor="ws-instructions">
          <textarea
            id="ws-instructions"
            name="instructions"
            rows={3}
            placeholder="z.B. Fokus auf innere Monologe, genau 3 Aufgaben, mit Lösungsblatt, einfache Sprache."
            className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink text-[13px] outline-none focus:border-focus-ring focus:shadow-focus-ring transition w-full resize-y leading-[1.5]"
          />
        </Field>

        {/* Differenzierung */}
        <fieldset className="grid gap-1.5">
          <legend className="text-[11px] font-bold text-ink-body mb-1">
            Differenzierung
          </legend>
          {(
            [
              { value: "Basis", label: "Basis", defaultChecked: true },
              { value: "Erweiterung", label: "Erweiterung", defaultChecked: false },
              { value: "Foerder", label: "Förderung", defaultChecked: false },
            ] as const
          ).map(({ value, label, defaultChecked }) => (
            <label
              key={value}
              className="flex items-center gap-2.5 p-2.5 border border-line rounded-[11px] bg-surface cursor-pointer"
            >
              <input
                type="checkbox"
                name="difficulties"
                value={value}
                defaultChecked={defaultChecked}
                className="accent-primary"
              />
              <span className="text-[11px] font-bold">{label}</span>
            </label>
          ))}
        </fieldset>

        {/* Besondere Rahmenbedingungen — fließen in die Generierung (Prompt) */}
        <fieldset className="grid gap-1.5">
          <legend className="text-[11px] font-bold text-ink-body mb-1">
            Besondere Rahmenbedingungen
          </legend>
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
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                  autoFocus
                  placeholder="eigene Bedingung"
                  className="border border-line-strong bg-surface rounded-full px-2.5 py-[3px] text-[10px] outline-none focus:border-focus-ring w-[130px]"
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
        </fieldset>
      </div>

      {/* Gewählte Rahmenbedingungen werden mit dem Formular übermittelt */}
      <input type="hidden" name="constraints" value={JSON.stringify(constraints)} />

      <div className="mt-4">
        <Notice icon="lock" title="Export bleibt im Entwurfsmodus.">
          Prüfe Quellen, Aufgabenstellung und Differenzierung vor Verwendung.
        </Notice>
      </div>

      <SubmitButton />
    </Card>
  );
}

/** Submit-Button mit pending-State aus useFormStatus. */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      variant="primary"
      type="submit"
      disabled={pending}
      className="w-full mt-3.5"
    >
      {pending ? "Wird erstellt…" : "Arbeitsblatt generieren"}
    </Button>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[11px] font-bold text-ink-body">
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink text-[13px] outline-none focus:border-focus-ring focus:shadow-focus-ring transition w-full"
      {...rest}
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
          ? "bg-primary text-white border-primary"
          : "bg-chip-bg text-muted border-line hover:border-focus-ring"
      }`}
    >
      {children}
    </button>
  );
}
