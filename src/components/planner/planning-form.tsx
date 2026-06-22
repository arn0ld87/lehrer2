import { Button } from "../ui/button";
import { StatusChip } from "../ui/status-chip";

/** Planungsformular — Rahmendaten, Thema, Ziel, Rahmenbedingungen. */
export function PlanningForm() {
  return (
    <form className="bg-surface border border-line rounded-[22px] shadow-subtle p-[19px]">
      <div className="flex items-center justify-between gap-2.5 mb-[15px]">
        <div>
          <h2 className="font-display text-base font-extrabold tracking-[-0.025em] m-0">
            Neue Unterrichtseinheit
          </h2>
          <p className="text-xs text-muted mt-[3px] m-0">
            Rahmendaten zuerst, danach entstehen Ziele und Stundenlogik.
          </p>
        </div>
        <StatusChip status="draft" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Fach">
          <Select>
            <option>Deutsch</option>
            <option>Evangelische Religion</option>
            <option>Katholische Religion</option>
            <option>Ethik</option>
          </Select>
        </Field>
        <Field label="Klasse">
          <Select>
            <option>8</option>
            <option>7</option>
            <option>9</option>
          </Select>
        </Field>
        <Field label="Bildungsgang">
          <Select>
            <option>Gemeinschaftsschule</option>
            <option>Gymnasialer Bildungsgang</option>
          </Select>
        </Field>
        <Field label="Zeitrahmen">
          <Select>
            <option>4 Unterrichtsstunden</option>
            <option>6 Unterrichtsstunden</option>
            <option>8 Unterrichtsstunden</option>
          </Select>
        </Field>
      </div>

      <div className="mt-3.5">
        <Field label="Thema der Einheit">
          <input
            className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink outline-none focus:border-[#9D8AFB] focus:shadow-[0_0_0_3px_rgba(93,61,245,0.10)] transition w-full"
            defaultValue="Eine Charakterisierung schreiben"
          />
        </Field>
      </div>

      <div className="mt-3.5">
        <Field label="Ziel in eigenen Worten">
          <textarea
            className="border border-line-strong bg-surface rounded-[10px] px-[11px] py-2.5 text-ink outline-none focus:border-[#9D8AFB] focus:shadow-[0_0_0_3px_rgba(93,61,245,0.10)] transition w-full min-h-[94px] resize-y"
            defaultValue="Die Lernenden beschreiben eine literarische Figur begründet, verwenden Textbelege und formulieren einen strukturierten Charakterisierungstext."
          />
        </Field>
      </div>

      <div className="mt-3.5">
        <Field label="Besondere Rahmenbedingungen">
          <div className="flex flex-wrap gap-1.5">
            <Chip>45 Minuten</Chip>
            <Chip>heterogene Lerngruppe</Chip>
            <Chip>LRS-Unterstützung</Chip>
            <button
              type="button"
              className="inline-flex items-center rounded-full text-[10px] font-bold px-2 py-[5px] bg-[#F4F5F9] text-muted border border-line hover:bg-[#ECEEF5]"
            >
              + Kontext
            </button>
          </div>
        </Field>
      </div>

      <div className="flex gap-2.5 justify-end mt-5">
        <Button variant="secondary">Entwurf speichern</Button>
        <Button variant="primary">Struktur vorschlagen</Button>
      </div>
    </form>
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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full text-[10px] font-bold px-2 py-[5px] bg-[#F4F5F9] text-muted border border-line">
      {children}
    </span>
  );
}