import { readFileSync } from "fs";
import { resolve } from "path";
import YAML from "js-yaml";
import { db } from "../src/lib/db/client";
import { sourceRef } from "../src/lib/db/schema/artifacts";
import { sql } from "drizzle-orm";

interface SourceSeedEntry {
  id: string;
  title: string;
  publisher: string;
  official_url: string;
  source_type: string;
  trust_level: string;
  subject: string;
  school_form: string;
  grade_range: string;
  version_or_date: string;
  license_or_terms: string;
  license_verified: boolean;
  retrieved_at: string;
  content_hash: null;
  status: string;
  notes: string;
}

interface SeedFile {
  sources: SourceSeedEntry[];
}

/**
 * Mappt trust_level + source_type → sourceTrust enum
 * - official + (framework|law|curriculum) → OFFICIAL_BINDING
 * - (official|unverified) + guidance → OFFICIAL_GUIDANCE
 * - sonst → UNVERIFIED
 */
function mapSourceType(
  trustLevel: string,
  sourceType: string,
): "OFFICIAL_BINDING" | "OFFICIAL_GUIDANCE" | "OPEN_CURATED" | "UNVERIFIED" {
  const normalizedTrust = trustLevel.toLowerCase();
  const normalizedType = sourceType.toLowerCase();

  if (
    normalizedTrust === "official" &&
    ["framework", "law", "curriculum"].includes(normalizedType)
  ) {
    return "OFFICIAL_BINDING";
  }

  if (normalizedType === "guidance") {
    return "OFFICIAL_GUIDANCE";
  }

  return "UNVERIFIED";
}

/**
 * Mappt YAML subject → sourceRef.subjectAlignment
 * BLOCKER: Die YAML nutzt RELIGION_EV/RELIGION_KA, aber das Enum kennt nur RELIGION.
 * Laut Spec: NUR wenn subject in {DEUTSCH,RELIGION,ETHIK} → dieser Wert.
 * → RELIGION_EV/RELIGION_KA werden zu null (nicht in der Ziel-Liste).
 * Konfessionstrennung muss separat implementiert werden (siehe Maintainer-Notes in der YAML).
 */
function mapSubject(yamlSubject: string): "DEUTSCH" | "RELIGION" | "ETHIK" | null {
  const normalized = yamlSubject.toUpperCase();

  if (normalized === "DEUTSCH") return "DEUTSCH";
  if (normalized === "ETHIK") return "ETHIK";
  // BLOCKER: RELIGION_EV / RELIGION_KA sind nicht im Enum; mappieren zu null
  if (["RELIGION_EV", "RELIGION_KA", "RELIGION"].includes(normalized)) {
    // Falls exakt "RELIGION": akzeptieren
    if (normalized === "RELIGION") return "RELIGION";
    // Falls RELIGION_EV / RELIGION_KA: Spec sagt → null
    return null;
  }

  return null;
}

export interface SeedResult {
  inserted: number;
  skipped: number;
}

export async function seedSources(seedDb = db): Promise<SeedResult> {
  console.log("🌱 Starting source seed import...");

  const seedPath = resolve(process.cwd(), "data/source-registry.seed.yaml");
  const seedContent = readFileSync(seedPath, "utf-8");
  const seedData = YAML.load(seedContent) as SeedFile;

  if (!seedData.sources || !Array.isArray(seedData.sources)) {
    throw new Error("Invalid seed file: missing 'sources' array");
  }

  console.log(`📄 Loaded ${seedData.sources.length} source entries from YAML`);

  let inserted = 0;
  let skipped = 0;

  for (const entry of seedData.sources) {
    // Idempotenz-Check: prüfe, ob bereits ein sourceRef mit approvalMetadata.sourceSeedId = entry.id existiert
    const existing = await seedDb
      .select()
      .from(sourceRef)
      .where(sql`${sourceRef.approvalMetadata}->>'sourceSeedId' = ${entry.id}`)
      .limit(1);

    if (existing.length > 0) {
      console.log(`⏭️  Skipped src-${entry.id}: already imported`);
      skipped++;
      continue;
    }

    // Mapping
    const mappedSourceType = mapSourceType(entry.trust_level, entry.source_type);
    const mappedSubject = mapSubject(entry.subject);

    // Insert
    await seedDb.insert(sourceRef).values({
      // contentHash: null (Seed-Kandidat hat noch kein durchgesehenes Content-Hash)
      contentHash: null,
      sourceType: mappedSourceType,
      title: entry.title,
      uri: entry.official_url,
      confidence: null,
      ownerTeacherId: null, // Seed-Quellen sind nicht benutzerfreigegeben
      authorOrganization: entry.publisher,
      publishedDate: null, // version_or_date ist Text, kein Datum
      licenseInfo: entry.license_or_terms,
      licenseVerified: false,
      validFrom: null,
      validTo: null,
      subjectAlignment: mappedSubject,
      confessionContext: null, // Seed trägt keine Konfession
      lifecycleStatus: "DISCOVERED",
      approvalMetadata: {
        sourceSeedId: entry.id,
        schoolForm: entry.school_form,
        gradeRange: entry.grade_range,
        sourceType: entry.source_type,
        versionOrDate: entry.version_or_date,
        status: entry.status,
        notes: entry.notes,
      },
      retrievedAt: new Date(entry.retrieved_at),
      sourceVersion: 1,
    });

    console.log(`✅ Imported ${entry.id}: ${entry.title}`);
    inserted++;
  }

  console.log(`\n✨ Seed import complete: ${inserted} inserted, ${skipped} skipped`);

  return { inserted, skipped };
}

// CLI entry point
seedSources()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seed import failed:", error);
    process.exit(1);
  });
