"use client";

import * as React from "react";
import { Card, CardHead, Button, Notice } from "../ui";
import { mockWorksheetRepository } from "@/lib/mock";

/** Arbeitsblatt-Builder — Inhalte und Hilfen konfigurieren (reine UI). */
export function BuilderPanel() {
  const repo = mockWorksheetRepository;
  const types = repo.types();
  const [selected, setSelected] = React.useState(types[0]?.id ?? "");

  return (
    <Card className="lg:sticky lg:top-5 h-max">
      <CardHead title="Arbeitsblatt-Builder" subtitle="Inhalte und Hilfen konfigurieren." />
      <div className="grid gap-2.5">
        {types.map((t) => (
          <label
            key={t.id}
            className={`flex items-center gap-2.5 p-2.5 border rounded-[11px] bg-surface cursor-pointer ${
              selected === t.id ? "border-[#B9A9FF] bg-[#FAF9FF]" : "border-line"
            }`}
          >
            <input
              type="radio"
              name="type"
              className="accent-primary"
              checked={selected === t.id}
              onChange={() => setSelected(t.id)}
            />
            <div className="min-w-0">
              <strong className="block text-[11px]">{t.label}</strong>
              <span className="block text-[10px] text-muted mt-px">{t.detail}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <Field label="Fach">
          <Select>
            <option>Deutsch</option>
            <option>Evangelische Religion</option>
            <option>Katholische Religion</option>
            <option>Ethik</option>
          </Select>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Differenzierung">
          <Select>
            {repo.differentiationOptions().map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Sprache & Ton">
          <Select>
            {repo.toneOptions().map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <Notice icon="lock" title="Export bleibt im Entwurfsmodus.">
          Prüfe Quellen, Aufgabenstellung und Lösung vor Verwendung.
        </Notice>
      </div>

      <Button variant="primary" className="w-full mt-3.5">
        Vorschau aktualisieren
      </Button>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold text-[#424A67]">{label}</span>
      {children}
    </label>
  );
}

function Select({ children }: { children: React.ReactNode }) {
  return (
    <select className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink outline-none focus:border-[#9D8AFB] focus:shadow-[0_0_0_3px_rgba(93,61,245,0.10)] transition w-full appearance-none pr-[30px]">
      {children}
    </select>
  );
}