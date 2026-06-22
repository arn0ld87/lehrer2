import type { Metadata } from "next";
import { AppHeader } from "@/components/app-shell";
import { Card, CardHead, Button, Badge, StatusChip, SectionBanner } from "@/components/ui";

export const metadata: Metadata = { title: "Design-System" };

interface Swatch {
  name: string;
  hex: string;
  token: string;
}

const SWATCHES_ROW1: Swatch[] = [
  { name: "Ink", hex: "#12162E", token: "--color-ink" },
  { name: "Primary", hex: "#5D3DF5", token: "--color-primary" },
  { name: "Religion", hex: "#0F9B7A", token: "--color-religion" },
  { name: "Correction", hex: "#E05A38", token: "--color-correction" },
];

const SWATCHES_ROW2: Swatch[] = [
  { name: "Canvas", hex: "#F7F7FB", token: "--color-canvas" },
  { name: "Primary soft", hex: "#EFEAFF", token: "--color-primary-soft" },
  { name: "Success soft", hex: "#E7F9F4", token: "--color-success-soft" },
  { name: "Warning soft", hex: "#FFF6E4", token: "--color-warning-soft" },
];

const RULES = [
  {
    title: "Quellen sind sichtbar",
    detail: "Keine versteckten Belege hinter einem Tool-Icon.",
  },
  {
    title: "Unsicherheit bekommt Raum",
    detail: "Unklare KI-Ergebnisse werden markiert statt glattgebügelt.",
  },
  {
    title: "Korrektur bleibt nüchtern",
    detail: "Keine Punkteskalen als Gamification, keine emotionalen Urteile.",
  },
];

export default function DesignSystemPage() {
  return (
    <>
      <AppHeader
        title="Design-System"
        subtitle="Tokens, Komponenten und Regeln für eine konsistente Umsetzung."
      />

      <div className="grid gap-5">
        <SectionBanner
          title="Design-System: sachlich, warm, nicht nach EdTech-Babysprache."
          description="Das Interface soll Lehrkräfte entlasten und Kompetenz ausstrahlen. Kein gamifiziertes Klassenzimmer und keine Spielzeug-Illustrationen."
          action={<Button variant="secondary">Token-Datei ansehen</Button>}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <CardHead title="Farbpalette" subtitle="Klare Semantik statt Zufallsfarben." />
            <SwatchRow swatches={SWATCHES_ROW1} />
            <div className="mt-2.5">
              <SwatchRow swatches={SWATCHES_ROW2} />
            </div>
          </Card>

          <Card>
            <CardHead title="Typografie" subtitle="Dichte Informationen, gut lesbar." />
            <div className="p-4 border border-line rounded-[14px]">
              <h1 className="font-display text-[32px] tracking-[-0.05em] font-extrabold m-0 mb-2">
                Klare Entscheidungen brauchen klare Informationen.
              </h1>
              <h2 className="font-display text-[22px] tracking-[-0.04em] font-extrabold m-0 mb-2">
                Abschnittsüberschrift
              </h2>
              <h3 className="text-[15px] font-bold m-0 mb-2">Komponentenüberschrift</h3>
              <p className="text-muted text-[13px] m-0 mb-2">
                Fließtext ist bewusst unaufgeregt: gute Lesbarkeit bei Tabellen, Korrekturen,
                Quellen und längeren Arbeitsaufträgen.
              </p>
              <Badge tone="neutral">Inter / Manrope</Badge>
            </div>
          </Card>

          <Card>
            <CardHead
              title="Buttons & Status"
              subtitle="Stark für Handlungen, leise für Alternativen."
            />
            <div className="flex flex-wrap gap-2.5">
              <Button variant="primary">Primäre Aktion</Button>
              <Button variant="secondary">Sekundär</Button>
              <Button variant="ghost">Textaktion</Button>
            </div>
            <div className="flex flex-wrap gap-2.5 mt-4">
              <StatusChip status="draft" />
              <StatusChip status="progress" />
              <StatusChip status="ready" />
              <StatusChip status="review" />
            </div>
            <div className="flex flex-wrap gap-2.5 mt-4">
              <StatusChip trust="OFFICIAL_BINDING" />
              <StatusChip trust="OFFICIAL_GUIDANCE" />
              <StatusChip trust="USER_APPROVED" />
              <StatusChip trust="UNVERIFIED" />
            </div>
          </Card>

          <Card>
            <CardHead
              title="Verhaltensregeln"
              subtitle="Was das Design bewusst vermeidet."
            />
            <div className="grid gap-2">
              {RULES.map((r, i) => (
                <div
                  key={r.title}
                  className="flex items-start gap-2.5 p-3 border border-line rounded-[12px]"
                >
                  <span className="grid place-items-center w-[21px] h-[21px] rounded-[7px] bg-primary-soft text-primary text-[11px] font-extrabold shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="block text-[11px]">{r.title}</strong>
                    <span className="block text-[10px] text-muted mt-0.5">{r.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function SwatchRow({ swatches }: { swatches: Swatch[] }) {
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {swatches.map((s) => (
        <div key={s.name} className="border border-line rounded-[12px] overflow-hidden">
          <div className="h-[62px]" style={{ background: s.hex }} />
          <div className="p-1.5">
            <div className="text-[10px] font-extrabold">{s.name}</div>
            <div className="text-[9px] text-muted mt-0.5">{s.hex}</div>
            <div className="text-[9px] text-muted-2 mt-0.5">{s.token}</div>
          </div>
        </div>
      ))}
    </div>
  );
}