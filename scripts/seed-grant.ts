/**
 * scripts/seed-grant.ts — CloudReleaseGrant für den Cloud-LLM-Pfad (ADR 0002/0004)
 *
 * GOVERNANCE / OVERRIDE-DOKUMENTATION:
 *   Dieser Grant aktiviert den gegateten Cloud-Provider (Ollama-Cloud via
 *   OpenAI-kompatiblem Endpoint). Er dokumentiert die AUSDRÜCKLICHE Freigabe
 *   des Nutzers (Alex Schneider, 2026-06-26), Generierungs-Prompts inkl.
 *   freigegebenen 0_FGS-Materials an Ollama-Cloud zu senden — bewusster
 *   Override der projektinternen „0_FGS local-only"-Vorgabe.
 *   Schüler-PII bleibt fail-closed ausgeschlossen (Redaction + Guard im Gate).
 *
 * Idempotent: legt nur an, wenn für (schoolId, provider) noch kein Grant existiert.
 *
 * Aufruf:  set -a; . ./.env; set +a; npx tsx scripts/seed-grant.ts
 */

import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { cloudReleaseGrant } from "../src/lib/db/schema/grants";
import { school } from "../src/lib/db/schema/tenant";

const PROVIDER = "openai"; // withGate providerName für den OpenAI-kompatiblen CloudProvider

async function main() {
  const schools = await db.select({ id: school.id, name: school.name }).from(school).limit(1);
  if (schools.length === 0) {
    throw new Error("Keine Schule gefunden — zuerst scripts/seed-user.ts ausführen.");
  }
  const schoolId = schools[0].id;

  const existing = await db
    .select({ id: cloudReleaseGrant.id })
    .from(cloudReleaseGrant)
    .where(and(eq(cloudReleaseGrant.schoolId, schoolId), eq(cloudReleaseGrant.provider, PROVIDER)))
    .limit(1);

  if (existing.length > 0) {
    console.log(`ℹ️  Grant existiert bereits (id=${existing[0].id}) — übersprungen.`);
    return;
  }

  const validFrom = new Date("2026-06-26T00:00:00Z");
  const validUntil = new Date("2027-06-26T00:00:00Z");

  const [row] = await db
    .insert(cloudReleaseGrant)
    .values({
      schoolId,
      provider: PROVIDER,
      scopeSubjects: [], // leer = alle Fächer freigegeben
      scopeGradeBands: [], // leer = alle Klassenstufen
      legalBasis:
        "Explizite Nutzerfreigabe (Alex Schneider) 2026-06-26: Cloud-Generierung via " +
        "Ollama-Cloud (self-hosted Signin-Proxy), inkl. freigegebenem 0_FGS-Material. " +
        "Bewusster Override der 0_FGS-local-only-Vorgabe; Schüler-PII bleibt fail-closed " +
        "ausgeschlossen (Redaction + Guard). DSFA/AVV: ausstehend (Dev/Pilot).",
      avvStatus: "pending",
      dsfaId: null,
      region: "ollama-cloud",
      validFrom,
      validUntil,
      issuerName: "Alex Schneider",
      issuerRole: "Maintainer/Data-Owner",
    })
    .returning({ id: cloudReleaseGrant.id });

  console.log(`✅ CloudReleaseGrant angelegt (id=${row.id}, school=${schoolId}, provider=${PROVIDER})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ seed-grant fehlgeschlagen:", err);
    process.exit(1);
  });
