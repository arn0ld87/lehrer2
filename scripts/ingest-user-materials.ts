#!/usr/bin/env tsx
/**
 * scripts/ingest-user-materials.ts
 *
 * RUNBOOK
 * =======
 * Ingestiert Janas freigegebene 0_FGS-Materialien als USER_APPROVED in den RAG-Bestand.
 *
 * WICHTIG — USER_APPROVED-Trust-Level:
 *   USER_APPROVED liegt unter minTrust=OFFICIAL_GUIDANCE. Diese Materialien erscheinen
 *   erst in der Generierung, wenn der Retrieval-minTrust abgesenkt wird. Das ist eine
 *   separate, bewusste Entscheidung. Dieser Walker ingestiert nur — er ändert keine
 *   Retrieval-Schwellen.
 *
 * Freigabe:
 *   Jana Zwarg hat diese Materialien (inkl. ggf. urheberrechtlich geschützter
 *   Verlagswerke) explizit für den lokalen, mandantenbezogenen Einsatz freigegeben
 *   (2026-06-26). Kein Cloud-Provider, kein Git-Commit von Inhalten.
 *
 * PII-Ausschluss (fail-closed):
 *   classifyFgsFile() schließt Schüler-PII, Noten, Diagnosen und Verwaltungsdaten
 *   vor der Ingestion hart aus. Diese Grenze darf nicht umgangen werden.
 *
 * Voraussetzungen:
 *   - docker compose up -d  (Postgres + Qdrant + MinIO müssen laufen)
 *   - ollama läuft mit aktivem Embedding-Modell (qwen3-embedding:4b)
 *   - Tesseract-Binary + deu traineddata installiert
 *     macOS:          brew install tesseract tesseract-lang
 *     Debian/Ubuntu:  apt install tesseract-ocr tesseract-ocr-deu
 *   - MATERIAL_ROOT_FGS zeigt auf das 0_FGS-Verzeichnis (Standard: /Volumes/Data/0_FGS)
 *
 * Aufruf:
 *   pnpm tsx scripts/ingest-user-materials.ts [--only=<ordner>] [--limit=<n>] [--dry-run]
 *
 * Optionen:
 *   --only=<ordner>  Nur Dateien im genannten Top-Level-Ordner verarbeiten
 *   --limit=<n>      Maximale Anzahl Kandidaten (nach Klassifikation)
 *   --dry-run        Nur klassifizieren und zählen, NICHT in DB/Blob schreiben
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, extname, basename } from "path";
import { pathToFileURL } from "url";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db/client.js";
import { sourceRef } from "../src/lib/db/schema/artifacts.js";
import { getSourceRepository } from "../src/lib/db/repositories/factory.js";
import { createBlobStore, createEmbedder, createVectorStore } from "../src/lib/infra/index.js";
import { blobKeyForSource } from "../src/lib/infra/minio.js";
import { ingestSource, DuplicateContentError, type IngestDeps } from "../src/lib/rag/ingest.js";
import { TesseractOcrEngine } from "../src/lib/rag/ocr/tesseract-engine.js";

// REPOSITORY_BACKEND wird in ingestUserMaterials() (echter Pfad) gesetzt, NICHT auf
// Modulebene — damit der Import von classifyFgsFile() in Tests seiteneffektfrei bleibt.

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const MATERIAL_ROOT =
  process.env.MATERIAL_ROOT_FGS ?? "/Volumes/Data/0_FGS";

/** Nur diese Top-Level-Ordner werden gescannt — alles andere bleibt unberührt. */
const SCANNED_DIRS = [
  "2_Deutsch",
  "3_Religion",
  "3_Religion_RAG_Auswahl",
  "Materialsammlung-RAG",
  "Lehrpläne Schulgesetz Sachsen Anhalt",
  "Lernbüro 6 2024_2025",
] as const;

const LICENSE_INFO =
  "Von Lehrkraft explizit freigegeben (USER_APPROVED), 2026-06-26; ggf. urheberrechtlich geschütztes Verlagsmaterial, nur lokaler Store, kein Cloud, nicht im Git.";

const APPROVED_BY = "user-explicit-release-2026-06-26";

// ---------------------------------------------------------------------------
// Klassifikations-Typen und reine Funktion (exportiert für Tests)
// ---------------------------------------------------------------------------

export interface ClassifyResult {
  include: boolean;
  subject?: "DEUTSCH" | "RELIGION";
  confession?: "NICHT_ANWENDBAR" | "EVANGELISCH";
  reason: string;
}

/**
 * Klassifiziert eine Datei relativ zum MATERIAL_ROOT.
 * REIN (keine I/O). Alle Regeln case-insensitive auf dem gesamten relPath.
 *
 * Reihenfolge: 1→2→3→3b→4→5/6→7.
 * PII/Tooling/Leistungserhebung/Out-of-Scope schlagen Subject-Regeln (fail-closed).
 */
export function classifyFgsFile(relPathFromRoot: string): ClassifyResult {
  const p = relPathFromRoot; // Alias für Lesbarkeit
  const pLower = p.toLowerCase();
  const ext = extname(p).toLowerCase();

  // (1) Nicht unterstützte Dateitypen
  const SUPPORTED_EXTS = new Set([".pdf", ".docx", ".txt", ".html", ".htm", ".md"]);
  if (!SUPPORTED_EXTS.has(ext)) {
    return { include: false, reason: "unsupported-type" };
  }

  // (2) Tooling / Build-Artefakte
  const TOOLING_PATTERNS = [
    "__pycache__",
    "/site-packages/",
    "/_report",
    "node_modules",
    "/.venv",
    "/venv/",
    "/bin/",
    "/lib/python",
  ];
  for (const pat of TOOLING_PATTERNS) {
    if (pLower.includes(pat.toLowerCase())) {
      return { include: false, reason: "tooling" };
    }
  }

  // (3) Schüler-PII / Verwaltung / Leistungsbewertung — HARTE GRENZE, fail-closed
  //   Erweitert 2026-06-26 (adversarischer Dry-Run-Befund): der ursprüngliche
  //   Filter ließ reale Schüler-PII durch — Facharbeiten mit Klarnamen, bewertete
  //   Leseproben/Feedback, und "Pruefung" (ue-Schreibweise) matchte pr[üu]fung nicht.
  //   Neu erfasst: facharbeit|seminararbeit (Schülerarbeiten), bewertung|leseprobe|
  //   feedback (Leistungsrückmeldung), pr(?:ü|ue|u)fung (alle Umlaut-Varianten).
  const PII_RE =
    /(zeugnis|notenübersicht|notenubersicht|\bnoten?\b|klassenarbeit|klausur|pr(?:ü|ue|u)fung|klassenliste|sch[üu]lerliste|diagnos|f[öo]rderplan|gutachten|korrekturhinweise|auswertung|anwesenheit|fehlzeit|datev|freistellung|krankmeld|elternbrief|facharbeit|seminararbeit|bewertung|leseprobe|feedback)/i;
  if (PII_RE.test(p)) {
    return { include: false, reason: "pii-or-admin" };
  }

  // (3b) Leistungskontrollen per Datei-Prefix — fail-closed
  //   KA_/LK_ = Klassenarbeit/Leistungskontrolle. Diese tragen die PII-Begriffe
  //   oft nicht im Namen (z. B. "KA_Abrahamisch_7a", "LK_8a_Gleichnis"), sind aber
  //   schülerbezogene Leistungserhebungen. Segment-anchored, damit Wörter wie
  //   "Lkw" o. Ä. nicht fälschlich greifen.
  const ASSESSMENT_PREFIX_RE = /(^|\/)(KA|LK)[ _]/i;
  if (ASSESSMENT_PREFIX_RE.test(p)) {
    return { include: false, reason: "student-assessment" };
  }

  // (4) Nicht in Scope (Fach)
  //   `\bgeschichte` mit Wortgrenze: das Schulfach Geschichte ist out-of-scope,
  //   aber die Deutsch-Gattung "Kurzgeschichte" darf nicht als Teilstring matchen
  //   (sonst landet z. B. "Lesen/kurzgeschichte.md" fälschlich im Ausschluss).
  const OUT_OF_SCOPE_RE =
    /(biolog|englisch|\bmathe|physik|chemie|\bgeschichte|geograf|\bmusik|\bkunst|\bsport|informatik)/i;
  if (OUT_OF_SCOPE_RE.test(p)) {
    return { include: false, reason: "out-of-scope-subject" };
  }

  // (5) Religion — Top-Ordner-Check (case-insensitive) ODER /relig/i im Pfad
  const topFolder = p.split("/")[0] ?? "";
  const isReligionFolder =
    topFolder.toLowerCase() === "3_religion" ||
    topFolder.toLowerCase() === "3_religion_rag_auswahl";
  if (isReligionFolder || /relig/i.test(p)) {
    return {
      include: true,
      subject: "RELIGION",
      confession: "EVANGELISCH",
      reason: "religion-ev",
    };
  }

  // (6) Ethik — vorerst ausgeschlossen (eigener Fach-Scope)
  if (/\bethik/i.test(p)) {
    return { include: false, reason: "ethik-deferred" };
  }

  // (7) Default: Deutsch
  return {
    include: true,
    subject: "DEUTSCH",
    confession: "NICHT_ANWENDBAR",
    reason: "deutsch",
  };
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function walkDir(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // Ordner existiert nicht oder nicht lesbar → überspringen
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      if (statSync(full).isDirectory()) {
        results.push(...walkDir(full));
      } else {
        results.push(full);
      }
    } catch {
      // Nicht zugängliche Einträge überspringen
    }
  }
  return results;
}

function contentTypeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".txt":
    case ".md":
      return "text/plain";
    case ".html":
    case ".htm":
      return "text/html";
    default:
      return "application/octet-stream";
  }
}

// ---------------------------------------------------------------------------
// Summary-Typ
// ---------------------------------------------------------------------------

export interface IngestSummary {
  ingested: number;
  skipped: number;
  excludedByReason: Record<string, number>;
  failed: string[];
}

// ---------------------------------------------------------------------------
// Haupt-Funktion (auch als Modul importierbar)
// ---------------------------------------------------------------------------

export async function ingestUserMaterials(opts?: {
  only?: string;
  limit?: number;
  dryRun?: boolean;
}): Promise<IngestSummary> {
  const dryRun = opts?.dryRun ?? false;

  // Dateien aus den erlaubten Top-Level-Ordnern einsammeln
  const dirs = opts?.only
    ? [opts.only]
    : SCANNED_DIRS;

  const allFiles: string[] = [];
  for (const dir of dirs) {
    allFiles.push(...walkDir(join(MATERIAL_ROOT, dir)));
  }

  // Klassifizieren
  const excludedByReason: Record<string, number> = {};
  const candidates: Array<{ absPath: string; relPath: string; cls: ClassifyResult }> = [];

  for (const absPath of allFiles) {
    const relPath = relative(MATERIAL_ROOT, absPath);
    const cls = classifyFgsFile(relPath);
    if (!cls.include) {
      excludedByReason[cls.reason] = (excludedByReason[cls.reason] ?? 0) + 1;
      console.log(`  exclude [${cls.reason}] ${relPath}`);
    } else {
      candidates.push({ absPath, relPath, cls });
    }
  }

  const limited = opts?.limit ? candidates.slice(0, opts.limit) : candidates;

  console.log(
    `ingest-user-materials: ${limited.length} Kandidat(en) zum Ingestieren` +
      (dryRun ? " [DRY RUN — kein Schreiben]" : "") +
      (opts?.only ? ` (--only=${opts.only})` : "") +
      (opts?.limit ? ` (--limit=${opts.limit})` : ""),
  );

  if (dryRun) {
    let would = 0;
    for (const { relPath, cls } of limited) {
      console.log(`  [dry] would ingest ${relPath} → ${cls.subject}/${cls.confession}`);
      would++;
    }
    console.log(`\n[dry-run] ${would} würden ingestiert werden`);
    console.log("Ausschlüsse:", excludedByReason);
    // ingested bleibt 0 — im Dry-Run wird nichts tatsächlich geschrieben.
    return { ingested: 0, skipped: 0, excludedByReason, failed: [] };
  }

  // Echte Ingestion — hier den DB-Backend-Pfad erzwingen (seiteneffektfrei beim Import)
  process.env.REPOSITORY_BACKEND = "db";
  const repo = getSourceRepository();
  const blob = createBlobStore();
  const embedder = createEmbedder();
  const store = createVectorStore();
  const ocr = new TesseractOcrEngine();
  const deps: IngestDeps = { db, store, blob, embedder, ocr };

  let ingested = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const { absPath, relPath, cls } of limited) {
    const ingestKey = relPath;
    try {
      // Idempotenz-Check: skip wenn sourceRef mit diesem ingestKey bereits existiert
      const existing = await db
        .select({ id: sourceRef.id })
        .from(sourceRef)
        .where(sql`${sourceRef.approvalMetadata}->>'ingestKey' = ${ingestKey}`)
        .limit(1);

      if (existing.length > 0) {
        console.log(`  skip    ${relPath}`);
        skipped++;
        continue;
      }

      console.log(`  start   ${relPath} → ${cls.subject}/${cls.confession}`);

      const ext = extname(relPath).toLowerCase();
      const contentType = contentTypeForExt(ext);
      // URI mit korrekter Endung, damit guessMime in ingestSource greift
      const uri = `file://0_FGS/${relPath}`;
      const title = basename(relPath, ext).replace(/[_-]/g, " ").trim();

      // 1. create() → DISCOVERED
      const sourceId = await repo.create({
        title,
        uri,
        sourceType: "USER_APPROVED",
        subjectAlignment: cls.subject!,
        confessionContext: cls.confession!,
        licenseInfo: LICENSE_INFO,
      });

      // 2. Bytes lesen + in Blob hochladen
      const bytes = readFileSync(absPath);
      await blob.putObject(
        blobKeyForSource(sourceId, 1),
        new Uint8Array(bytes),
        contentType,
      );

      // 3. register() → REGISTERED
      await repo.register(sourceId, {
        licenseInfo: LICENSE_INFO,
        licenseVerified: true,
        approvalMetadata: {
          ingestKey,
          approvedBy: APPROVED_BY,
          source: "0_FGS",
        },
      });

      // 4. approve() → APPROVED (fail-closed: wirft wenn licenseVerified !== true)
      await repo.approve(sourceId, {});

      // 5. ingestSource() → Extraktion + Chunking + Embedding + Persistenz
      const { chunkCount } = await ingestSource(deps, sourceId);

      console.log(`  ok      ${relPath} → ${chunkCount} Chunk(s)`);
      ingested++;
    } catch (err) {
      if (err instanceof DuplicateContentError) {
        console.log(`  skip    ${relPath} (DuplicateContentError — Inhalt bereits ingestiert)`);
        skipped++;
        continue;
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FEHLER  ${relPath}: ${msg}`);
      failed.push(relPath);
    }
  }

  console.log(
    `\ningest-user-materials: ${ingested} ingestiert, ${skipped} übersprungen, ${failed.length} Fehler`,
  );
  console.log("Ausschlüsse:", excludedByReason);
  if (failed.length > 0) {
    console.error("Fehlgeschlagene Dateien:");
    for (const f of failed) console.error(`  - ${f}`);
  }

  return { ingested, skipped, excludedByReason, failed };
}

// ---------------------------------------------------------------------------
// CLI-Entry — nicht beim Import ausführen (Modul-Guard)
// ---------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];
  const limitStr = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;
  const dryRun = args.includes("--dry-run");

  ingestUserMaterials({ only, limit, dryRun })
    .then(({ failed }) => process.exit(failed.length > 0 ? 1 : 0))
    .catch((err) => {
      console.error("ingest-user-materials FATAL:", err);
      process.exit(1);
    });
}
