import { describe, expect, it } from "vitest";
import { dbSubjectToUi, uiSubjectToDb } from "@/lib/db/repositories/mapping";

describe("Persistenz↔UI-Subject-Mapping", () => {
  it("mappt katholische Religion bidirektional", () => {
    expect(dbSubjectToUi("RELIGION", "KATHOLISCH")).toBe("katholische-religion");
    expect(uiSubjectToDb("katholische-religion")).toEqual({
      subject: "RELIGION",
      confession: "KATHOLISCH",
    });
  });

  it("hält Deutsch konfessionsfrei", () => {
    expect(uiSubjectToDb("deutsch")).toEqual({
      subject: "DEUTSCH",
      confession: "NICHT_ANWENDBAR",
    });
  });

  it("stellt konfessionssensibel-übergreifend als evangelisch-nah dar (UI kennt keinen dritten Strang)", () => {
    expect(dbSubjectToUi("RELIGION", "KONFESSIONSSENSIBEL_UEBERGREIFEND")).toBe(
      "evangelische-religion",
    );
  });
});
