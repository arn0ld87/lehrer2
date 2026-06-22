import { Badge, StatusChip } from "../ui";
import { Icon } from "../ui/icon";
import type { SourceEntry, Subject } from "@/lib/types";

const SUBJECT_BADGE: Record<Subject, string> = {
  deutsch: "Deutsch",
  "evangelische-religion": "Ev. Religion",
  "katholische-religion": "Kath. Religion",
  ethik: "Ethik",
};

/** Quellenregister — amtliche und freigegebene Quellen mit Versionierung. */
export function SourceTable({ entries }: { entries: SourceEntry[] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse min-w-[780px]">
        <thead>
          <tr>
            {["Quelle", "Fach / Kontext", "Vertrauen", "Version", "Lizenz", "Status", ""].map(
              (h) => (
                <th
                  key={h}
                  className="text-left text-[10px] uppercase tracking-[0.04em] text-muted-2 font-extrabold py-3 px-3 border-b border-line"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="hover:bg-surface-2">
              <td className="py-3 px-3 border-b border-[#EEF0F5] text-[11px] align-middle">
                <div className="flex items-center gap-2 min-w-[260px]">
                  <span className="h-[30px] w-[30px] rounded-lg bg-info-soft text-sources grid place-items-center shrink-0">
                    <Icon name="file" width={15} height={15} />
                  </span>
                  <div className="min-w-0">
                    <strong className="block text-[11px]">{e.title}</strong>
                    <span className="block text-[10px] text-muted mt-px">{e.origin}</span>
                  </div>
                </div>
              </td>
              <td className="py-3 px-3 border-b border-[#EEF0F5] text-[11px] align-middle">
                <Badge subject={e.subject}>{SUBJECT_BADGE[e.subject]}</Badge>
                <span className="block text-[10px] text-muted mt-1">{e.gradeRange}</span>
              </td>
              <td className="py-3 px-3 border-b border-[#EEF0F5] text-[11px] align-middle">
                <StatusChip trust={e.trust} />
              </td>
              <td className="py-3 px-3 border-b border-[#EEF0F5] text-[11px] align-middle">
                {e.version}
              </td>
              <td className="py-3 px-3 border-b border-[#EEF0F5] text-[11px] align-middle">
                {e.license}
              </td>
              <td className="py-3 px-3 border-b border-[#EEF0F5] text-[11px] align-middle">
                <StatusChip status={e.status} />
              </td>
              <td className="py-3 px-3 border-b border-[#EEF0F5] text-[11px] align-middle">
                <button
                  type="button"
                  aria-label="Weitere Aktionen"
                  className="border-0 bg-transparent text-muted text-lg leading-none px-1"
                >
                  ⋮
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}