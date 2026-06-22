import { Badge } from "../ui";

interface WorksheetTask {
  title: string;
  instruction: string;
  linesHeight?: number;
}

const TASKS: WorksheetTask[] = [
  {
    title: "Aufgabe 1 · Figur wahrnehmen",
    instruction:
      "Markiere Aussagen, Handlungen und Gedanken, die etwas über Jana zeigen. Notiere zu jeder Markierung ein mögliches Merkmal.",
  },
  {
    title: "Aufgabe 2 · Textbelege ordnen",
    instruction:
      "Sortiere deine Belege in die Kategorien Aussehen, Verhalten, Sprache, Beziehungen. Entscheide, welche Kategorie für deine Charakterisierung besonders wichtig ist.",
  },
  {
    title: "Aufgabe 3 · Charakterisierung schreiben",
    instruction:
      "Schreibe einen zusammenhängenden Text. Nutze eine Einleitung, ordne deine Aussagen sinnvoll und belege mindestens drei Merkmale mit Textstellen.",
    linesHeight: 110,
  },
];

/** Arbeitsblatt-Vorschau — papierenes Layout, keine Generierung. */
export function WorksheetPreview() {
  return (
    <section
      aria-label="Arbeitsblatt-Vorschau"
      className="bg-surface border border-line rounded-[12px] shadow-[0_22px_42px_rgba(25,28,52,0.1)] max-w-[820px] mx-auto p-[46px_54px] min-h-[880px]"
    >
      <div className="flex justify-between text-[10px] text-muted border-b-2 border-ink pb-3">
        <span>Deutsch · Klasse 8 · Gemeinschaftsschule</span>
        <span>Name: ______________________</span>
      </div>

      <h1 className="font-display text-[26px] tracking-[-0.04em] mt-8 mb-2 font-extrabold">
        Eine Charakterisierung schreiben
      </h1>

      <div className="flex gap-2 flex-wrap">
        <Badge subject="deutsch">Deutsch</Badge>
        <Badge tone="neutral">45 Minuten</Badge>
        <Badge tone="neutral">Basis + Erweiterung</Badge>
      </div>

      <p className="text-[13px] leading-[1.7] mt-4">
        Du untersuchst die Figur <strong>Jana</strong> aus dem Auszug. Beschreibe ihre
        Eigenschaften nicht nur mit Adjektiven, sondern belege sie mit passenden Stellen aus
        dem Text.
      </p>

      {TASKS.map((t, i) => (
        <div
          key={i}
          className="border border-[#E7E3FA] bg-[#FCFBFF] p-[15px_16px] rounded-[12px] my-3.5"
        >
          <strong className="block text-xs mb-1.5">{t.title}</strong>
          <p className="text-[13px] leading-[1.7] m-0">{t.instruction}</p>
          <div
            className="mt-2.5 bg-[repeating-linear-gradient(transparent_0,transparent_22px,#EDEEF4_23px)]"
            style={{ height: t.linesHeight ?? 76 }}
          />
        </div>
      ))}

      <h2 className="text-[15px] mt-6 mb-2 font-bold">Hilfekarte</h2>
      <p className="text-[13px] leading-[1.7] m-0">
        <strong>Satzstarter:</strong> „Jana wirkt …, weil …“ · „Dies zeigt sich besonders,
        als …“ · „Dadurch wird deutlich, dass …“
      </p>

      <table className="w-full border-collapse mt-4 text-[11px]">
        <thead>
          <tr>
            <th className="bg-[#F3F0FF] text-[#4C35B4] text-left text-[10px] border border-line p-2">
              Kriterium
            </th>
            <th className="bg-[#F3F0FF] text-[#4C35B4] text-left text-[10px] border border-line p-2">
              Woran erkennst du es?
            </th>
            <th className="bg-[#F3F0FF] text-[#4C35B4] text-left text-[10px] border border-line p-2">
              Selbsteinschätzung
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-line p-2 align-top">Textbelege</td>
            <td className="border border-line p-2 align-top">
              Du erklärst mindestens drei Textstellen.
            </td>
            <td className="border border-line p-2 align-top whitespace-nowrap">
              □ sicher &nbsp; □ teilweise &nbsp; □ noch üben
            </td>
          </tr>
          <tr>
            <td className="border border-line p-2 align-top">Aufbau</td>
            <td className="border border-line p-2 align-top">
              Dein Text hat Einleitung, Hauptteil und Schluss.
            </td>
            <td className="border border-line p-2 align-top whitespace-nowrap">
              □ sicher &nbsp; □ teilweise &nbsp; □ noch üben
            </td>
          </tr>
          <tr>
            <td className="border border-line p-2 align-top">Sprache</td>
            <td className="border border-line p-2 align-top">
              Du verwendest treffende Verben und Adjektive.
            </td>
            <td className="border border-line p-2 align-top whitespace-nowrap">
              □ sicher &nbsp; □ teilweise &nbsp; □ noch üben
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}