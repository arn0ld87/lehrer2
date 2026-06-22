/**
 * Mock-Factories — synthetische Demodaten für die UI-Shell.
 *
 * MARKER: Alle Daten hier sind erfunden und dienen nur der Veranschaulichung.
 * Keine echten Schülerdaten, keine echten Lehrplandokumente, keine Tokens.
 * Später werden diese durch echte Repository-Implementierungen ersetzt.
 */

import type {
  Activity,
  CurriculumFit,
  DashboardMetric,
  FeedbackHistoryEntry,
  FeedbackStatement,
  MockUser,
  PlanningStep,
  RagQuality,
  RecentWork,
  RubricScore,
  SourceEntry,
  SourceQuickAccess,
  StructurePhase,
  TrustPrinciple,
  UserContext,
} from "../types";

/* ------------------------------------------------------------------ Dashboard */

export function mockDashboardMetrics(): DashboardMetric[] {
  return [
    {
      id: "m-today",
      kicker: "Heute geplant",
      value: 2,
      foot: "Unterrichtseinheiten",
      icon: "calendar",
      accent: "purple",
      href: "/planung",
    },
    {
      id: "m-sheets",
      kicker: "Arbeitsblätter erstellt",
      value: 5,
      foot: "in dieser Woche",
      icon: "file",
      accent: "green",
      href: "/arbeitsblaetter",
    },
    {
      id: "m-corrections",
      kicker: "Korrekturen offen",
      value: 12,
      foot: "zur Bearbeitung",
      icon: "wand",
      accent: "orange",
      href: "/korrektur",
    },
    {
      id: "m-sources",
      kicker: "Quellen im System",
      value: 248,
      foot: "verifizierte Quellen",
      icon: "layers",
      accent: "blue",
      href: "/quelle",
    },
  ];
}

export function mockRecentWork(): RecentWork[] {
  return [
    {
      id: "rw-1",
      title: "Eine Charakterisierung schreiben",
      subtitle: "Unterrichtseinheit · Deutsch · Klasse 8",
      subject: "deutsch",
      icon: "calendar",
      modifiedAt: "Geändert vor 2 Std.",
      tab: "zuletzt",
    },
    {
      id: "rw-2",
      title: "Balladen untersuchen – Differenzierte Aufgaben",
      subtitle: "Arbeitsblatt · Deutsch · Klasse 7/8",
      subject: "deutsch",
      icon: "file",
      modifiedAt: "Gestern",
      tab: "zuletzt",
    },
    {
      id: "rw-3",
      title: "Gedankenrede analysieren",
      subtitle: "Unterrichtseinheit · Deutsch · Klasse 9",
      subject: "deutsch",
      icon: "wand",
      modifiedAt: "vor 2 Tagen",
      tab: "zuletzt",
    },
    {
      id: "rw-4",
      title: "Erwartungshorizont: Kurzgeschichte",
      subtitle: "Bewertungsraster · Deutsch · Klasse 8",
      subject: "deutsch",
      icon: "file",
      modifiedAt: "vor 3 Tagen",
      tab: "zuletzt",
    },
  ];
}

export function mockActivities(): Activity[] {
  return [
    {
      id: "a-1",
      title: "Quellen-Update abgeschlossen",
      detail: "5 neue Quellen wurden geprüft und vorgeschlagen.",
      icon: "ok",
      timestamp: "vor 1 Std.",
    },
    {
      id: "a-2",
      title: "Korrekturen bereit zur Prüfung",
      detail: "12 Arbeiten wurden strukturiert ausgewertet.",
      icon: "warn",
      timestamp: "vor 3 Std.",
    },
    {
      id: "a-3",
      title: "Planung gespeichert",
      detail: "„Balladen im Wandel der Zeit“ wurde gesichert.",
      icon: "info",
      timestamp: "gestern",
    },
    {
      id: "a-4",
      title: "Arbeitsblatt exportiert",
      detail: "„Rechtschreibung – Groß-/Kleinschreibung“ als PDF.",
      icon: "info",
      timestamp: "gestern",
    },
  ];
}

export function mockSourceQuickAccess(): SourceQuickAccess[] {
  return [
    {
      id: "sq-1",
      title: "Lehrplan Deutsch (LSA)",
      subtitle: "Gemeinschaftsschule · Klassen 5–10",
      accent: "primary",
    },
    {
      id: "sq-2",
      title: "Lehrplan Evangelische Religion",
      subtitle: "Gemeinschaftsschule · Klassen 5–10",
      accent: "green",
    },
    {
      id: "sq-3",
      title: "Lehrplan Katholische Religion",
      subtitle: "Gemeinschaftsschule · Klassen 5–10",
      accent: "green",
    },
  ];
}

export function mockTrustPrinciples(): TrustPrinciple[] {
  return [
    {
      id: "t-1",
      icon: "shield",
      title: "Datenschutz hat Priorität",
      detail: "Local-first. Deine Daten bleiben kontrollierbar.",
    },
    {
      id: "t-2",
      icon: "file",
      title: "Quellen transparent",
      detail: "Jede Antwort ist mit Fundstellen belegbar.",
    },
    {
      id: "t-3",
      icon: "user",
      title: "Lehrkraft entscheidet",
      detail: "KI liefert Vorschläge, Du triffst Entscheidungen.",
    },
  ];
}

/* ------------------------------------------------------------------- Planning */

export function mockPlanningSteps(): PlanningStep[] {
  return [
    {
      id: "p-1",
      title: "Rahmendaten",
      detail: "Fach, Klasse, Bildungsgang und Zeitfenster sind gesetzt.",
      done: true,
    },
    {
      id: "p-2",
      title: "Lehrplanbezug",
      detail: "Kompetenzen werden mit Fundstellen abgeglichen.",
      done: false,
    },
    {
      id: "p-3",
      title: "Stundenlogik",
      detail: "Phasen, Methoden und Materialien werden vorgeschlagen.",
      done: false,
    },
    {
      id: "p-4",
      title: "Differenzierung",
      detail: "Hilfen und Erweiterungen werden ergänzt.",
      done: false,
    },
    {
      id: "p-5",
      title: "Prüfung & Export",
      detail: "Du kontrollierst die Einheit vor dem Export.",
      done: false,
    },
  ];
}

export function mockStructureProposal(): StructurePhase[] {
  return [
    {
      id: "s-1",
      title: "Einstieg: Figurenwirkung wahrnehmen",
      detail: "Impulsbild, Zitatkarten, erste Hypothesen zur Figur. 45 Minuten.",
    },
    {
      id: "s-2",
      title: "Textbelege gezielt erschließen",
      detail: "Lesestrategie und Markierhilfe für Aussagen, Handlungen und Beziehungen.",
    },
    {
      id: "s-3",
      title: "Merkmale einer Charakterisierung sichern",
      detail: "Aufbaukarten, sprachliche Mittel, Satzstarter und Mini-Beispiele.",
    },
    {
      id: "s-4",
      title: "Eigenen Text planen, schreiben und überarbeiten",
      detail: "Checkliste, Peer-Feedback und differenzierte Schreibkonferenz.",
    },
  ];
}

export function mockCurriculumFit(): CurriculumFit[] {
  return [
    {
      id: "c-1",
      label: "Schreiben: Texte planen und gestalten",
      detail: "Lehrplan-Kandidat · Seite / Abschnitt wird bei Freigabe belegt.",
      status: "belegt",
      sourceHint: "Fachlehrplan Deutsch (LSA), 2024-01",
    },
    {
      id: "c-2",
      label: "Lesen: Texte verstehen und nutzen",
      detail: "Kompetenzbezug für Textbelege und Figurenanalyse.",
      status: "belegt",
      sourceHint: "Fachlehrplan Deutsch (LSA), 2024-01",
    },
    {
      id: "c-3",
      label: "Differenzierung: LRS-Scaffolding",
      detail: "Methodischer Vorschlag, noch ohne offizielle Quellenbindung.",
      status: "pruefen",
      sourceHint: "Keine offizielle Fundstelle — Prüfung offen.",
    },
  ];
}

/* ----------------------------------------------------------------- Worksheet */

export function mockWorksheetTypes(): { id: string; label: string; detail: string }[] {
  return [
    { id: "wt-1", label: "Übungsblatt", detail: "Aufgaben mit Lösungen und Hilfen." },
    { id: "wt-2", label: "Lernstationen", detail: "Material für selbstständige Arbeitsphasen." },
    { id: "wt-3", label: "Diagnosebogen", detail: "Kurze Lernstandserhebung mit Raster." },
  ];
}

export function mockDifferentiationOptions(): string[] {
  return ["Basis + Erweiterung + Hilfen", "Einheitliches Niveau", "Fördermaterial"];
}

export function mockToneOptions(): string[] {
  return ["Klar, altersangemessen", "Einfach und entlastend", "Anspruchsvoll und analytisch"];
}

/* ----------------------------------------------------------------- Correction */

export function mockSubmissionMeta() {
  return {
    title: "Analyse: Charakterisierung",
    subjectLabel: "Deutsch · Klasse 8",
    submittedAt: "18.06.2026",
    // Synthetisches Pseudonym — kein realer Schülerbezug.
    pseudonym: "SCHUELER_08_017",
    status: "review" as const,
  };
}

export function mockRubricScores(): RubricScore[] {
  return [
    {
      id: "r-1",
      criterion: "Inhaltliche Erfassung",
      achieved: 13,
      max: 16,
      note: "Figur und zentrale Merkmale korrekt erfasst. Zwei Deutungen bleiben unbelegt.",
      confidence: {
        level: "HIGH",
        reasoning: "Eindeutige Übereinstimmung mit dem Erwartungshorizont.",
      },
    },
    {
      id: "r-2",
      criterion: "Textbelege & Analyse",
      achieved: 10,
      max: 18,
      note: "Belege vorhanden, aber teils aufgezählt statt erklärt. Ein Beleg ist nicht eindeutig.",
      confidence: {
        level: "MEDIUM",
        reasoning: "Zuordnung eines Belegs ist interpretierbar.",
      },
    },
    {
      id: "r-3",
      criterion: "Aufbau & Kohärenz",
      achieved: 9,
      max: 12,
      note: "Grundstruktur stimmig. Übergänge zwischen Absätzen könnten klarer sein.",
      confidence: {
        level: "HIGH",
        reasoning: "Strukturelle Merkmale sind klar identifizierbar.",
      },
    },
    {
      id: "r-4",
      criterion: "Sprache & Ausdruck",
      achieved: 8,
      max: 14,
      note: "Angemessener Wortschatz. Mehrere Satzbau- und Kongruenzfehler.",
      confidence: {
        level: "LOW",
        reasoning: "Häufung von Fehlern erschwert die automatisierte Analyse.",
      },
    },
  ];
}

export function mockFeedbackDraft(): string {
  return (
    "Du beschreibst Jana mit mehreren passenden Merkmalen und nutzt Textstellen. " +
    "Besonders gelungen ist, dass du ihre Beziehung zu ihrer Mutter erklärst. " +
    "Im nächsten Schritt solltest du jeden Beleg genauer deuten: Was zeigt die Stelle über Jana?"
  );
}

export function mockFeedbackStatements(): FeedbackStatement[] {
  return [
    {
      id: "stmt-1",
      text: "Du beschreibst Jana mit mehreren passenden Merkmalen und nutzt Textstellen.",
      evidence: [
        {
          type: "STUDENT_TEXT",
          reference: "Zeile 5-8",
          content: "...sie war eher still und zurückhaltend...",
        },
      ],
      confidence: {
        level: "HIGH",
        reasoning: "Direkter Beleg im Text gefunden.",
      },
      status: "AI_GENERATED",
    },
    {
      id: "stmt-2",
      text: "Besonders gelungen ist, dass du ihre Beziehung zu ihrer Mutter erklärst.",
      evidence: [
        {
          type: "STUDENT_TEXT",
          reference: "Zeile 15-20",
        },
        {
          type: "CURRICULUM",
          reference: "Kriterium 2: Beziehungsanalyse",
          label: "Erwartungshorizont",
        },
      ],
      confidence: {
        level: "MEDIUM",
        reasoning: "Interpretation der emotionalen Ebene ist fundiert, aber subjektiv.",
      },
      status: "AI_GENERATED",
    },
    {
      id: "stmt-3",
      text: "Im nächsten Schritt solltest du jeden Beleg genauer deuten: Was zeigt die Stelle über Jana?",
      evidence: [],
      confidence: {
        level: "HIGH",
        reasoning: "Methodischer Standardhinweis bei fehlender Deutungstiefe.",
      },
      status: "HUMAN_APPROVED",
    },
  ];
}

export function mockFeedbackHistory(): FeedbackHistoryEntry[] {
  return [
    {
      timestamp: "vor 2 Std.",
      actor: "AI (qwen2.5-14b)",
      action: "CREATE_DRAFT",
      changeSummary: "Initialer Korrekturvorschlag generiert.",
    },
    {
      timestamp: "vor 1 Std.",
      actor: "Jana Zwarg (Lehrkraft)",
      action: "EDIT_STATEMENT",
      targetId: "stmt-3",
      changeSummary: "Didaktischen Hinweis präzisiert.",
    },
  ];
}

/* ------------------------------------------------------------------- Sources */

export function mockRagQuality(): RagQuality {
  return {
    metadataCoverage: 98.7,
    goldenQuestionRecall: 91.4,
    sourcesNeedingReview: 11,
    indexFreshness: "letzte Prüfung: heute",
  };
}

export function mockSourceEntries(): SourceEntry[] {
  return [
    {
      id: "src-1",
      title: "Fachlehrplan Deutsch",
      origin: "LISA Sachsen-Anhalt · amtliche Quelle",
      subject: "deutsch",
      gradeRange: "Sek. I · Klasse 5–10",
      trust: "OFFICIAL_BINDING",
      version: "2024-01",
      license: "geprüft",
      status: "active",
    },
    {
      id: "src-2",
      title: "Lehrplan Evangelischer Religionsunterricht",
      origin: "LISA Sachsen-Anhalt · amtliche Quelle",
      subject: "evangelische-religion",
      gradeRange: "Sek. I · Klasse 5–10",
      trust: "OFFICIAL_BINDING",
      version: "2023-08",
      license: "geprüft",
      status: "active",
    },
    {
      id: "src-3",
      title: "Niveaubestimmende Aufgabe: Schreiben",
      origin: "Offizielle Handreichung · Kandidat",
      subject: "deutsch",
      gradeRange: "Sek. I · Klasse 7/8",
      trust: "OFFICIAL_GUIDANCE",
      version: "2022-06",
      license: "zu prüfen",
      status: "waiting",
    },
    {
      id: "src-4",
      title: "Materialsammlung „Biblische Erzählungen“",
      origin: "Fachkonferenz-Upload · Schule intern",
      subject: "katholische-religion",
      gradeRange: "Klasse 5/6",
      trust: "USER_APPROVED",
      version: "2026-04",
      license: "intern",
      status: "pending-review",
    },
  ];
}

export function mockGovernanceChecks(): { id: string; title: string; detail: string }[] {
  return [
    {
      id: "g-1",
      title: "Lizenz & Nutzung prüfen",
      detail: "Kein automatischer Import ohne nachvollziehbare Berechtigung.",
    },
    {
      id: "g-2",
      title: "Gültigkeit festhalten",
      detail: "Version, Abrufdatum und Aktualität sichtbar speichern.",
    },
    {
      id: "g-3",
      title: "Freigabe protokollieren",
      detail: "Quelle erst danach für produktive Antworten aktivieren.",
    },
  ];
}

/* ------------------------------------------------------------- User / Context */

export function mockUserContext(): UserContext {
  return {
    subject: "deutsch",
    schoolForm: "gemeinschaftsschule",
    grade: 8,
  };
}

export function mockUser(): MockUser {
  return {
    initials: "JZ",
    name: "Jana Zwarg",
    role: "Lehrkraft",
  };
}