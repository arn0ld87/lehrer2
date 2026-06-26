"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Card, CardHead, Button, Notice } from "../ui";

const RELIGION_SUBJECTS = new Set(["evangelische-religion", "katholische-religion"]);

const DEFAULT_CONFESSION: Record<string, string> = {
  "evangelische-religion": "EVANGELISCH",
  "katholische-religion": "KATHOLISCH",
};

/** Arbeitsblatt-Builder — Generierungsformular (gebunden an generateWorksheetAction). */
export function BuilderPanel() {
  const [subject, setSubject] = React.useState("deutsch");
  const isReligion = RELIGION_SUBJECTS.has(subject);

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
            <option value="deutsch">Deutsch</option>
            <option value="evangelische-religion">Ev. Religion</option>
            <option value="katholische-religion">Kath. Religion</option>
            <option value="ethik">Ethik</option>
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
      </div>

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
      className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink text-[13px] outline-none focus:border-focus-ring focus:shadow-focus-ring transition w-full appearance-none"
      {...rest}
    >
      {children}
    </select>
  );
}
