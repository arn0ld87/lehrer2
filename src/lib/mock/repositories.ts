/**
 * Mock-Repository-Implementierungen — kapseln die Mock-Factories hinter die
 * Verträge aus repositories.ts. Komponenten importieren diese nicht direkt,
 * sondern greifen über die Interfaces zu (siehe ./index.ts).
 */

import type {
  CorrectionRepository,
  DashboardRepository,
  PlanningRepository,
  SourcesRepository,
  UserContextRepository,
  WorksheetRepository,
} from "../repositories";
import {
  mockActivities,
  mockCurriculumFit,
  mockDashboardMetrics,
  mockDifferentiationOptions,
  mockFeedbackDraft,
  mockFeedbackHistory,
  mockFeedbackStatements,
  mockGovernanceChecks,
  mockPlanningSteps,
  mockRecentWork,
  mockRagQuality,
  mockRubricScores,
  mockSourceEntries,
  mockSourceQuickAccess,
  mockStructureProposal,
  mockSubmissionMeta,
  mockToneOptions,
  mockTrustPrinciples,
  mockUser,
  mockUserContext,
  mockWorksheetTypes,
} from "./factories";

export const mockDashboardRepository: DashboardRepository = {
  metrics: () => mockDashboardMetrics(),
  recentWork: () => mockRecentWork(),
  activities: () => mockActivities(),
  sourceQuickAccess: () => mockSourceQuickAccess(),
  trustPrinciples: () => mockTrustPrinciples(),
};

export const mockPlanningRepository: PlanningRepository = {
  steps: () => mockPlanningSteps(),
  structureProposal: () => mockStructureProposal(),
  curriculumFit: () => mockCurriculumFit(),
};

export const mockWorksheetRepository: WorksheetRepository = {
  types: () => mockWorksheetTypes(),
  differentiationOptions: () => mockDifferentiationOptions(),
  toneOptions: () => mockToneOptions(),
};

export const mockCorrectionRepository: CorrectionRepository = {
  submissionMeta: () => mockSubmissionMeta(),
  rubricScores: () => mockRubricScores(),
  feedbackDraft: () => mockFeedbackDraft(),
  feedbackStatements: () => mockFeedbackStatements(),
  history: () => mockFeedbackHistory(),
};

export const mockSourcesRepository: SourcesRepository = {
  ragQuality: () => mockRagQuality(),
  entries: () => mockSourceEntries(),
  governanceChecks: () => mockGovernanceChecks(),
};

export const mockUserContextRepository: UserContextRepository = {
  current: () => mockUserContext(),
  user: () => mockUser(),
};