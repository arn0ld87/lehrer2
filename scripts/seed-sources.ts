// .env laden, BEVOR src/lib/db/client.ts process.env.DATABASE_URL beim Import liest
import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";
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
 * Mappt YAML subject → { subjectAlignment, confessionContext }
 *
 * RELIGION_EV / RELIGION_KA werden nicht mehr auf null gemappt, sondern auf
 * subjectAlignment="RELIGION" + jeweiliger confessionContext (EVANGELISCH / KATHOLISCH).
 * DEUTSCH  → NICHT_ANWENDBAR, ETHIK → RELIGIONSKUNDLICH, RELIGION (plain)
 * → KONFESSIONSSENSIBEL_UEBERGREIFEND.
 */
function mapSubject(yamlSubject: string): {
  subjectAlignment: "DEUTSCH" | "RELIGION" | "ETHIK" | null;
  confessionContext:
    | "NICHT_ANWENDBAR"
    | "EVANGELISCH"
    | "KATHOLISCH"
    | "KONFESSIONSSENSIBEL_UEBERGREIFEND"
    | "RELIGIONSKUNDLICH"
    | null;
} {
  const normalized = yamlSubject.toUpperCase();

  if (normalized === "DEUTSCH") {
    return { subjectAlignment: "DEUTSCH", confessionContext: "NICHT_ANWENDBAR" };
  }
  if (normalized === "ETHIK") {
    return { subjectAlignment: "ETHIK", confessionContext: "RELIGIONSKUNDLICH" };
  }
  if (normalized === "RELIGION_EV") {
    return { subjectAlignment: "RELIGION", confessionContext: "EVANGELISCH" };
  }
  if (normalized === "RELIGION_KA") {
    return { subjectAlignment: "RELIGION", confessionContext: "KATHOLISCH" };
  }
  if (normalized === "RELIGION") {
    return {
      subjectAlignment: "RELIGION",
      confessionContext: "KONFESSIONSSENSIBEL_UEBERGREIFEND",
    };
  }

  return { subjectAlignment: null, confessionContext: null };
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
    const { subjectAlignment: mappedSubject, confessionContext: mappedConfession } = mapSubject(
      entry.subject,
    );

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
      confessionContext: mappedConfession,
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

// CLI entry point — nur bei direktem Aufruf, nicht beim Import (Test-Safe, Modul-Guard)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedSources()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seed import failed:", error);
      process.exit(1);
    });
}
