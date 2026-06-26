#!/usr/bin/env tsx
/**
 * scripts/ingest-curriculum.ts
 *
 * RUNBOOK
 * =======
 * Ingestiert amtliche und gemeinfreie LSA-Deutsch-Materialien in den RAG-Bestand.
 *
 * Voraussetzungen:
 *   - docker compose up -d  (Postgres + Qdrant + MinIO müssen laufen)
 *   - aktiver Embedding-Provider gemäß .env (EMBEDDING_PROVIDER):
 *     lokal Ollama (qwen3-embedding:4b) oder OpenAI-kompatibel (text-embedding-3-small).
 *     Ingestion und Retrieval MÜSSEN dieselbe Provider-/Dimensions-Config nutzen.
 *   - Tesseract-Binary + deu traineddata installiert
 *     macOS:          brew install tesseract tesseract-lang
 *     Debian/Ubuntu:  apt install tesseract-ocr tesseract-ocr-deu
 *
 * Governance / Quellenpflicht (ADR 0003):
 *   licenseVerified=true ist hier die dokumentierte menschliche Governance-Entscheidung.
 *   Alle Materialien in MATERIAL_ROOT sind amtlich/offiziell, frei lizenziert oder gemeinfrei;
 *   Verlagsmaterial wurde bewusst ausgelassen.
 *   Provenienz und Lizenzen: README.md und QUELLEN.md im MATERIAL_ROOT.
 *   Referenzen: data/source-registry.seed.yaml, docs/rag/INGESTION_POLICY.md, ADR 0003.
 *   Scan-PDFs werden lokal via Tesseract-OCR verarbeitet — KEIN Cloud-Provider.
 *
 * Aufruf:
 *   pnpm tsx scripts/ingest-curriculum.ts [--only=<ordner>] [--limit=<n>]
 *
 * Optionen:
 *   --only=<ordner>  Nur Dateien im genannten Top-Level-Ordner ingestieren
 *                    (lehrplaene | bildungsstandards-kmk |
 *                     niveaubestimmende-aufgaben | lektueren-gemeinfrei)
 *   --limit=<n>      Maximale Anzahl Dateien (gedrosselter Teilmengen-Lauf)
 */

// .env laden, BEVOR src/lib/db/client.ts process.env.DATABASE_URL beim Import liest
import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, basename, extname } from "path";
import { pathToFileURL } from "url";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { sourceRef } from "../src/lib/db/schema/artifacts";
import { getSourceRepository } from "../src/lib/db/repositories/factory";
import { createBlobStore, createEmbedder, createVectorStore } from "../src/lib/infra";
import { blobKeyForSource } from "../src/lib/infra/minio";
import { ingestSource, type IngestDeps } from "../src/lib/rag/ingest";
import { TesseractOcrEngine } from "../src/lib/rag/ocr/tesseract-engine";

// Erzwingt den echten Postgres-Repository-Pfad (unabhängig von .env-Default)
process.env.REPOSITORY_BACKEND = "db";

const MATERIAL_ROOT =
  process.env.MATERIAL_ROOT ??
  "/Volumes/T7/Offload/Downloads/lehrmaterial-deutsch-lsa";

// ---------------------------------------------------------------------------
// Interne Typen
// ---------------------------------------------------------------------------

interface FileMeta {
  /** Stabiler Schlüssel für Idempotenz (relPath vom MATERIAL_ROOT) */
  ingestKey: string;
  /** Anzeigename der Quelle */
  title: string;
  /** Provenienz-URI mit korrekter Endung → guessMime in ingestSource */
  uri: string;
  sourceType: "OFFICIAL_BINDING" | "OFFICIAL_GUIDANCE" | "OPEN_CURATED";
  publisher: string;
  licenseInfo: string;
  /** Optional: Klassenstufe aus Unterordner-Name, geht in approvalMetadata */
  gradeBand?: string;
  contentType: "application/pdf" | "text/plain";
  /** Absoluter Dateipfad für readFileSync */
  localPath: string;
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function deriveTitle(filename: string): string {
  return basename(filename, extname(filename))
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .trim();
}

function subfolderGradeBand(subfolder: string): string | undefined {
  if (subfolder.startsWith("sek_kl5")) return "KS5";
  if (subfolder.startsWith("sek_kl7")) return "KS7";
  if (subfolder.startsWith("sek_kl9")) return "KS9";
  if (subfolder === "sek_2012") return "KS9";
  return undefined;
}

// ---------------------------------------------------------------------------
// Kategorie-Mapping (top-level Ordner → Metadaten)
// ---------------------------------------------------------------------------

function categorizeFile(absPath: string): FileMeta | null {
  const relPath = relative(MATERIAL_ROOT, absPath);
  const parts = relPath.split("/");
  const topFolder = parts[0];
  const filename = basename(absPath);
  const ext = extname(filename).toLowerCase();

  // Nur PDF und TXT ingestieren; Markdown/QUELLEN.md/README.md auslassen
  if (![".pdf", ".txt"].includes(ext)) return null;

  const contentType: "application/pdf" | "text/plain" =
    ext === ".pdf" ? "application/pdf" : "text/plain";
  // URI mit korrekter Endung damit guessMime in ingestSource greift
  const uri = `file://lehrmaterial-deutsch-lsa/${relPath}`;

  // --- lehrplaene ---
  if (topFolder === "lehrplaene") {
    const isGuidance =
      filename.startsWith("Lektuereempfehlungen") ||
      filename.startsWith("Lekt_reempfehlungen") ||
      filename === "Lektuereliste_VOLLTEXT.txt";

    return {
      ingestKey: relPath,
      title: deriveTitle(filename),
      uri,
      sourceType: isGuidance ? "OFFICIAL_GUIDANCE" : "OFFICIAL_BINDING",
      publisher: "Ministerium für Bildung LSA (LISA)",
      licenseInfo: "Amtlich, kostenfrei zugänglich",
      contentType,
      localPath: absPath,
    };
  }

  // --- bildungsstandards-kmk ---
  if (topFolder === "bildungsstandards-kmk") {
    return {
      ingestKey: relPath,
      title: deriveTitle(filename),
      uri,
      sourceType: "OFFICIAL_BINDING",
      publisher: "KMK",
      licenseInfo: "Amtlich, kostenfrei zugänglich",
      contentType,
      localPath: absPath,
    };
  }

  // --- niveaubestimmende-aufgaben ---
  if (topFolder === "niveaubestimmende-aufgaben") {
    const subfolder = parts[1] ?? "";
    const gradeBand = subfolderGradeBand(subfolder);

    return {
      ingestKey: relPath,
      title: deriveTitle(filename),
      uri,
      sourceType: "OFFICIAL_GUIDANCE",
      publisher: "LISA Sachsen-Anhalt",
      licenseInfo: "Amtlich, kostenfrei zugänglich",
      gradeBand,
      contentType,
      localPath: absPath,
    };
  }

  // --- lektueren-gemeinfrei ---
  if (topFolder === "lektueren-gemeinfrei") {
    return {
      ingestKey: relPath,
      title: deriveTitle(filename),
      uri,
      sourceType: "OPEN_CURATED",
      publisher: "Project Gutenberg/Wikisource",
      licenseInfo: "Public Domain (gemeinfrei)",
      contentType,
      localPath: absPath,
    };
  }

  // Unbekannter Top-Level-Ordner → nicht ingestieren
  return null;
}

// ---------------------------------------------------------------------------
// Haupt-Funktion (auch als Modul importierbar für Tests)
// ---------------------------------------------------------------------------

export async function ingestCurriculum(opts?: {
  only?: string;
  limit?: number;
}): Promise<{ ok: number; skipped: number; failed: string[] }> {
  const repo = getSourceRepository();
  const blob = createBlobStore();
  const embedder = createEmbedder();
  const store = createVectorStore();
  const ocr = new TesseractOcrEngine();

  const deps: IngestDeps = { db, store, blob, embedder, ocr };

  // Dateien einsammeln
  const scanRoot = opts?.only ? join(MATERIAL_ROOT, opts.only) : MATERIAL_ROOT;
  const allFiles = walkDir(scanRoot);

  // Kategorisieren + nicht-ingestierbare Dateien herausfiltern
  const fileMetas = allFiles
    .map(categorizeFile)
    .filter((m): m is FileMeta => m !== null);

  const candidates = opts?.limit ? fileMetas.slice(0, opts.limit) : fileMetas;

  console.log(
    `ingest-curriculum: ${candidates.length} Datei(en) zum Ingestieren` +
      (opts?.only ? ` (--only=${opts.only})` : "") +
      (opts?.limit ? ` (--limit=${opts.limit})` : ""),
  );

  let ok = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const meta of candidates) {
    try {
      // Idempotenz-Check: skip wenn bereits eine sourceRef mit diesem ingestKey existiert
      const existing = await db
        .select({ id: sourceRef.id })
        .from(sourceRef)
        .where(sql`${sourceRef.approvalMetadata}->>'ingestKey' = ${meta.ingestKey}`)
        .limit(1);

      if (existing.length > 0) {
        console.log(`  skip    ${meta.ingestKey}`);
        skipped++;
        continue;
      }

      console.log(`  start   ${meta.ingestKey}`);

      // 1. create() → Status DISCOVERED
      const sourceId = await repo.create({
        title: meta.title,
        uri: meta.uri,
        sourceType: meta.sourceType,
        subjectAlignment: "DEUTSCH",
        confessionContext: "NICHT_ANWENDBAR",
        licenseInfo: meta.licenseInfo,
      });

      // 2. Lokale Bytes lesen und in Blob-Store hochladen
      //    (ingestSource holt Bytes aus dem Blob via blobKeyForSource — KEIN lokaler Pfad-Zugriff)
      const bytes = readFileSync(meta.localPath);
      await blob.putObject(
        blobKeyForSource(sourceId, 1),
        new Uint8Array(bytes),
        meta.contentType,
      );

      // 3. register() → REGISTERED (setzt licenseVerified=true + ingestKey für Idempotenz)
      await repo.register(sourceId, {
        licenseInfo: meta.licenseInfo,
        licenseVerified: true,
        approvalMetadata: {
          ingestKey: meta.ingestKey,
          publisher: meta.publisher,
          gradeBand: meta.gradeBand ?? null,
        },
      });

      // 4. approve() → APPROVED (fail-closed: wirft wenn licenseVerified !== true)
      //    KEIN approvalMetadata übergeben — approve() würde es sonst überschreiben
      //    und die in register() gesetzten Felder (publisher, gradeBand) verlieren.
      await repo.approve(sourceId, {});

      // 5. ingestSource() → Extraktion + Chunking + Embedding + Persistenz
      //    Setzt Status INGESTED selbst — ingestMark() NICHT separat aufrufen.
      //    Scan-PDFs ohne Text-Ebene laufen automatisch über deps.ocr (Tesseract).
      const { chunkCount } = await ingestSource(deps, sourceId);

      console.log(`  ok      ${meta.ingestKey} → ${chunkCount} Chunk(s)`);
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Drizzle wickelt die eigentliche Postgres-Ursache in err.cause — diese ist
      // für die Diagnose entscheidend (z. B. NOT-NULL-/CHECK-Verletzung).
      const cause = (err as { cause?: unknown }).cause;
      const causeMsg =
        cause instanceof Error ? cause.message : cause != null ? String(cause) : "";
      console.error(`  FEHLER  ${meta.ingestKey}: ${msg.slice(0, 160)}`);
      if (causeMsg) console.error(`          cause: ${causeMsg.slice(0, 240)}`);
      failed.push(meta.ingestKey);
    }
  }

  console.log(
    `\ningest-curriculum: ${ok} ok, ${skipped} übersprungen, ${failed.length} Fehler`,
  );
  if (failed.length > 0) {
    console.error("Fehlgeschlagene Dateien:");
    for (const f of failed) console.error(`  - ${f}`);
  }

  return { ok, skipped, failed };
}

// ---------------------------------------------------------------------------
// CLI-Entry — nicht beim Import ausführen (Modul-Guard)
// ---------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];
  const limitStr = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  ingestCurriculum({ only, limit })
    .then(({ failed }) => process.exit(failed.length > 0 ? 1 : 0))
    .catch((err) => {
      console.error("ingest-curriculum FATAL:", err);
      process.exit(1);
    });
}
