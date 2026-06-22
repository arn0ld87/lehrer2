import type { ExportableWorksheet } from "./types";

export function buildFooter(ws: ExportableWorksheet): string {
  const lines: string[] = ["Quellen:"];
  ws.sources.forEach((s, i) => {
    const loc = s.locator ? `, ${s.locator}` : "";
    const lic = s.license ? ` (${s.license})` : "";
    lines.push(`${i + 1}. ${s.title}${loc}${lic}`);
  });
  if (ws.derivationSource) lines.push(`Adaptiert von: ${ws.derivationSource}`);
  if (ws.license) lines.push(`Lizenz: ${ws.license}`);
  return lines.join("\n");
}
