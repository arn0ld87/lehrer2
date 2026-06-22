import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  teachingUnit,
  lesson,
  worksheet,
  task,
  expectationHorizon,
  rubric,
  rubricCriterion,
  sourceRef,
  worksheetSourceRef,
  taskSourceRef,
  lessonCurriculumNode,
} from "@/lib/db/schema/artifacts";
import { user } from "@/lib/db/schema/auth";
import { curriculumStrand, curriculumNode } from "@/lib/db/schema/curriculum";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

afterAll(async () => {
  await client.end();
});

describe("Artifact Schema & Soft-Delete", () => {
  it("creates teaching unit, lesson, worksheet, task, expectation_horizon, rubric, rubric_criterion, source_ref and join tables", async () => {
    // File-unique seed to avoid collisions with other tests
    const [testUser] = await db
      .insert(user)
      .values({
        id: "t-art",
        name: "Test Teacher",
        email: "art@example.org",
      })
      .returning();

    expect(testUser.id).toBe("t-art");

    // Create curriculum strand
    const [testStrand] = await db
      .insert(curriculumStrand)
      .values({
        subject: "DEUTSCH",
        confessionContext: "NICHT_ANWENDBAR",
        schoolStage: "SEK_I",
        frameworkAuthority: "Test Authority",
        validFrom: "2024-01-01",
        version: "1.0.0",
      })
      .returning();

    expect(testStrand.id).toBeDefined();

    // Create curriculum node
    const [testNode] = await db
      .insert(curriculumNode)
      .values({
        strandId: testStrand.id,
        code: "DE-K5-001",
        title: "Textanalyse",
        description: "Analyse von Texten",
      })
      .returning();

    expect(testNode.id).toBeDefined();

    // Create teaching unit
    const [unit] = await db
      .insert(teachingUnit)
      .values({
        title: "Literatur Epoche",
        strandId: testStrand.id,
        gradeBand: "KS9",
        goals: "Schüler kennen die Merkmale der Epoche",
        status: "DRAFT",
        ownerTeacherId: testUser.id,
      })
      .returning();

    expect(unit.id).toBeDefined();
    expect(unit.title).toBe("Literatur Epoche");
    expect(unit.status).toBe("DRAFT");

    // Create lesson
    const [les] = await db
      .insert(lesson)
      .values({
        unitId: unit.id,
        objectives: "Lesen und analysieren",
        phasePlan: JSON.stringify({
          einstieg: "Warming up",
          erarbeitung: "Text reading",
        }),
        ownerTeacherId: testUser.id,
      })
      .returning();

    expect(les.id).toBeDefined();

    // Create worksheet (scoped to unit for later deletion verification)
    const [ws] = await db
      .insert(worksheet)
      .values({
        unitId: unit.id,
        title: "Arbeitsblatt 1",
        instructions: "Lesen Sie den Text",
        license: "CC-BY-SA",
        ownerTeacherId: testUser.id,
      })
      .returning();

    expect(ws.id).toBeDefined();

    // Create task
    const [tsk] = await db
      .insert(task)
      .values({
        worksheetId: ws.id,
        prompt: "Analysieren Sie den Text",
        taskType: "ESSAY",
        difficulty: "MEDIUM",
        expectedCompetenceNodeId: testNode.id,
        points: 10,
        ownerTeacherId: testUser.id,
      })
      .returning();

    expect(tsk.id).toBeDefined();
    expect(tsk.taskType).toBe("ESSAY");

    // Create expectation horizon
    const [horizon] = await db
      .insert(expectationHorizon)
      .values({
        taskId: tsk.id,
        modelSolution: "Eine gute Analyse enthält...",
        acceptanceCriteria: JSON.stringify({
          comprehension: "verständnis",
          analysis: "struktur",
        }),
        partialCreditRules: JSON.stringify({ partial: 0.5 }),
        ownerTeacherId: testUser.id,
      })
      .returning();

    expect(horizon.id).toBeDefined();

    // Create rubric
    const [rub] = await db
      .insert(rubric)
      .values({
        scope: "TASK",
        targetId: tsk.id,
        scaleType: "ANALYTIC",
        totalPoints: 10,
        ownerTeacherId: testUser.id,
      })
      .returning();

    expect(rub.id).toBeDefined();

    // Create rubric criterion
    const [criterion] = await db
      .insert(rubricCriterion)
      .values({
        rubricId: rub.id,
        label: "Korrektheit",
        weight: 0.5,
        levelDescriptors: ["Falsch", "Teils korrekt", "Korrekt"],
        ownerTeacherId: testUser.id,
      })
      .returning();

    expect(criterion.id).toBeDefined();

    // Create source ref
    const [src] = await db
      .insert(sourceRef)
      .values({
        contentHash: "hash-test-001",
        sourceType: "OPEN_CURATED",
        title: "Source Document",
        uri: "https://example.org/doc",
        confidence: 0.9,
        ownerTeacherId: testUser.id,
      })
      .returning();

    expect(src.id).toBeDefined();

    // Create worksheet source ref join
    const [wsRef] = await db
      .insert(worksheetSourceRef)
      .values({
        worksheetId: ws.id,
        sourceRefId: src.id,
      })
      .returning();

    expect(wsRef.id).toBeDefined();

    // Create task source ref join
    const [tskRef] = await db
      .insert(taskSourceRef)
      .values({
        taskId: tsk.id,
        sourceRefId: src.id,
      })
      .returning();

    expect(tskRef.id).toBeDefined();

    // Create lesson curriculum node join
    const [lesNode] = await db
      .insert(lessonCurriculumNode)
      .values({
        lessonId: les.id,
        curriculumNodeId: testNode.id,
      })
      .returning();

    expect(lesNode.id).toBeDefined();

    // Test soft-delete: mark worksheet as deleted
    await db
      .update(worksheet)
      .set({ deletedAt: new Date() })
      .where(eq(worksheet.id, ws.id));

    // Verify soft-delete
    const [deletedWs] = await db
      .select()
      .from(worksheet)
      .where(eq(worksheet.id, ws.id));

    expect(deletedWs.deletedAt).toBeDefined();
    expect(deletedWs.deletedAt).not.toBeNull();

    // Verify version increment on update
    expect(deletedWs.version).toBe(1); // version should still be 1 since we don't auto-increment on update

    // Verify join tables cascade-delete still exist (they weren't soft-deleted)
    const wsRefAfterDelete = await db
      .select()
      .from(worksheetSourceRef)
      .where(eq(worksheetSourceRef.worksheetId, ws.id));

    expect(wsRefAfterDelete.length).toBe(1); // join still exists (not cascade deleted in this update)
  });
});
