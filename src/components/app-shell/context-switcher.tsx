"use client";

import * as React from "react";
import { Icon, type IconName } from "../ui/icon";
import type { SchoolForm, Subject, UserContext } from "@/lib/types";

const SUBJECT_LABEL: Record<Subject, string> = {
  deutsch: "Deutsch",
  "evangelische-religion": "Ev. Religion",
  "katholische-religion": "Kath. Religion",
  ethik: "Ethik",
};

const SCHOOLFORM_LABEL: Record<SchoolForm, string> = {
  gemeinschaftsschule: "Gemeinschaftsschule",
  "gymnasialer-bildungsgang": "Gymnasialer Bildungsgang",
};

/**
 * Kontext-Switcher — Fach / Schulform / Klasse.
 * Reine Anzeige; der Kontext wird serverseitig geladen und als Prop gereicht
 * (kein Mock-Import mehr). Religion wird konfessionssensibel getrennt dargestellt.
 */
export function ContextSwitcher({ ctx }: { ctx: UserContext }) {
  return (
    <section className="mt-1 border-t border-line pt-[18px]">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted-2 px-3 pb-[7px] pt-1">
        Fach &amp; Kontext
      </div>
      <ContextCard icon="book" label="Fach" value={SUBJECT_LABEL[ctx.subject]} />
      <ContextCard
        icon="users"
        label="Schulform"
        value={SCHOOLFORM_LABEL[ctx.schoolForm]}
      />
      <ContextCard icon="calendar" label="Klasse" value={String(ctx.grade)} />
    </section>
  );
}

function ContextCard({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 border border-line rounded-[12px] bg-surface-2 mb-[7px]">
      <span className="h-7 w-7 rounded-[9px] bg-primary-soft text-primary grid place-items-center">
        <Icon name={icon} width={16} height={16} />
      </span>
      <span className="min-w-0">
        <small className="block text-[10px] font-bold text-muted-2">{label}</small>
        <strong className="block text-[11px] truncate mt-[1px]">{value}</strong>
      </span>
      <Icon name="chevron" width={16} height={16} className="ml-auto text-muted" />
    </div>
  );
}