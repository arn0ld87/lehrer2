"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  generateWorksheetAction,
  type WorksheetActionResult,
} from "@/app/actions/worksheet";
import type { SubjectOption } from "@/lib/types";
import { BuilderPanel } from "./builder-panel";
import { WorksheetPreview } from "./worksheet-preview";

/**
 * WorksheetContainer — Client-Wrapper, der useActionState hält und
 * State + FormAction an BuilderPanel und WorksheetPreview weitergibt.
 *
 * Die Form-Boundary liegt hier; BuilderPanel enthält nur Inputs + Submit.
 */
export function WorksheetContainer({ subjects }: { subjects: SubjectOption[] }) {
  const [state, formAction] = useActionState<WorksheetActionResult | null, FormData>(
    generateWorksheetAction,
    null,
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <form action={formAction} noValidate>
        <BuilderPanel subjects={subjects} />
      </form>
      <WorksheetPreview state={state} />
    </div>
  );
}
