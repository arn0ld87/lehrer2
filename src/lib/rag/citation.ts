/**
 * citation.ts — Zitations-Typen und Assemblierung für RAG-Retrieval (M2 Schritt 2)
 *
 * Jede RankedCitation trägt ALLE Pflichtfelder aus CITATION_STANDARD.md.
 * Fehlt ein Pflichtfeld in den Qdrant-Payload- oder sourceRef-Metadaten,
 * wird der Treffer als "unvollständig" markiert (incomplete: true) und
 * vom retrieve()-Layer aussortiert — nie erfunden.
 *
 * confidence-Regel (CITATION_STANDARD.md §Confidence-Zustände):
 *   GROUNDED          wenn trustLevel ∈ {OFFICIAL_BINDING, OFFICIAL_GUIDANCE}
 *   UNSUPPORTED_DRAFT sonst
 */

/** Vertrauensstufen aus sourceTrustEnum (enums.ts) */
export type SourceTrustLevel =
  | "OFFICIAL_BINDING"
  | "OFFICIAL_GUIDANCE"
  | "OPEN_CURATED"
  | "USER_APPROVED"
  | "UNVERIFIED";

/** Konfessions-Kontext-Werte aus confessionContextEnum (enums.ts) */
export type DbConfessionContext =
  | "EVANGELISCH"
  | "KATHOLISCH"
  | "KONFESSIONSSENSIBEL_UEBERGREIFEND"
  | "RELIGIONSKUNDLICH"
  | "NICHT_ANWENDBAR";

/** Confidence-Zustände gemäß CITATION_STANDARD.md */
export type CitationConfidence = "GROUNDED" | "UNSUPPORTED_DRAFT";

/**
 * RankedCitation — vollständige quellengebundene Zitation mit Ranking-Score.
 *
 * Pflichtfelder aus CITATION_STANDARD.md, die in einem validen Treffer IMMER
 * gesetzt sein müssen (fehlt eines, wird der Treffer verworfen — nie erfunden):
 *   sourceId, title, publisher, pageOrSection, sourceVersion, license,
 *   contentHash, trustLevel, chunkText, score, confidence
 *
 * Bedingte Felder (laut Standard ausdrücklich null zulässig):
 *   uri ("wenn verfügbar"), retrievedAt ("für Web-Quellen"),
 *   confessionContext ("falls relevant"), subject (fachübergreifende Quellen).
 */
export interface RankedCitation {
  /** Eindeutige ID des Quelldokuments (source_ref.id) */
  sourceId: string;
  /** Offizieller Titel des Quelldokuments */
  title: string;
  /** Permanente URL / DOI */
  uri: string | null;
  /** Herausgeber / Institution (authorOrganization aus sourceRef) — Pflichtfeld */
  publisher: string;
  /** Spezifischer Verweis: Seite, Kapitel, Abschnitt */
  pageOrSection: string;
  /** Versionsnummer oder Datum der Quelle */
  sourceVersion: number;
  /** Lizenzangabe — Pflichtfeld (insb. OER) */
  license: string;
  /** Abrufdatum (ISO8601) */
  retrievedAt: string | null;
  /** SHA-256-Hash des Inhalts */
  contentHash: string;
  /** Vertrauensstufe der Quelle */
  trustLevel: SourceTrustLevel;
  /** Konfessioneller Kontext (aus Qdrant-Payload; bedingt — null bei Fach ohne Konfessionsbezug) */
  confessionContext: DbConfessionContext | null;
  /** Fachbereich (aus Qdrant-Payload; bedingt — null bei fachübergreifenden Quellen) */
  subject: "DEUTSCH" | "RELIGION" | "ETHIK" | null;
  /** Text-Snippet des gefundenen Chunks */
  chunkText: string;
  /** Kosinus-Ähnlichkeits-Score aus Qdrant (oder MMR-adjustierter Score) */
  score: number;
  /** Confidence-Zustand gemäß CITATION_STANDARD.md */
  confidence: CitationConfidence;
}

/**
 * SourceRefMeta — die sourceRef-Felder, die retrieve() für die Zitations-
 * Assemblierung benötigt. Dieses Interface ermöglicht eine Fake-Implementierung
 * in Tests ohne DB-Zugriff.
 */
export interface SourceRefMeta {
  id: string;
  title: string;
  uri: string | null;
  authorOrganization: string | null;
  licenseInfo: string | null;
  retrievedAt: Date | null;
  sourceVersion: number;
  contentHash: string | null;
}

/**
 * Leitet den confidence-Zustand aus dem trustLevel ab.
 * GROUNDED: trustLevel ∈ {OFFICIAL_BINDING, OFFICIAL_GUIDANCE}
 * UNSUPPORTED_DRAFT: alles andere
 */
export function deriveConfidence(trustLevel: SourceTrustLevel): CitationConfidence {
  if (trustLevel === "OFFICIAL_BINDING" || trustLevel === "OFFICIAL_GUIDANCE") {
    return "GROUNDED";
  }
  return "UNSUPPORTED_DRAFT";
}

/**
 * Ergebnis der Zitations-Assemblierung.
 * complete: false → Pflichtfeld fehlt; der Treffer wird verworfen.
 */
export type AssembleResult =
  | { complete: true; citation: RankedCitation }
  | { complete: false; reason: string };

/**
 * Assembliert eine RankedCitation aus Qdrant-Treffer-Payload + Score + sourceRef-Metadaten.
 *
 * Pflichtfelder, die nicht aus dem Payload rekonstruiert werden können:
 *   - chunkText: muss im Payload als `chunk_text` stehen
 *   - contentHash: aus Payload (`content_hash`) ODER aus sourceRef.contentHash
 *   - trustLevel: aus Payload (`trust_level`)
 *
 * Fehlt eines dieser Felder → complete: false (nie erfinden).
 */
export function assembleCitation(
  payload: Record<string, unknown>,
  score: number,
  meta: SourceRefMeta,
): AssembleResult {
  // ── Pflichtfelder aus Payload ──────────────────────────────────────────────

  const chunkText = typeof payload.chunk_text === "string" ? payload.chunk_text : null;
  if (!chunkText) {
    return { complete: false, reason: "payload.chunk_text fehlt oder kein String" };
  }

  const trustLevel = typeof payload.trust_level === "string" ? payload.trust_level : null;
  if (!trustLevel) {
    return { complete: false, reason: "payload.trust_level fehlt oder kein String" };
  }

  // contentHash: Payload hat Vorrang (aktueller Ingest-Zeitpunkt); Fallback sourceRef.contentHash
  const contentHash =
    typeof payload.content_hash === "string"
      ? payload.content_hash
      : (meta.contentHash ?? null);
  if (!contentHash) {
    return { complete: false, reason: "contentHash fehlt in Payload und sourceRef" };
  }

  const pageOrSection =
    typeof payload.page_or_section === "string" ? payload.page_or_section : null;
  if (!pageOrSection) {
    return { complete: false, reason: "payload.page_or_section fehlt oder kein String" };
  }

  const confessionContext =
    typeof payload.confession_context === "string"
      ? (payload.confession_context as DbConfessionContext)
      : null;

  // subject (bedingtes Feld): aus Payload; null bei unbekanntem/fehlendem Wert
  const subject =
    payload.subject === "DEUTSCH" ||
    payload.subject === "RELIGION" ||
    payload.subject === "ETHIK"
      ? payload.subject
      : null;

  // ── Pflichtfelder aus sourceRef-Metadaten (unbedingt; fehlt eines → verwerfen) ──

  const title = typeof meta.title === "string" && meta.title.trim() !== "" ? meta.title : null;
  if (!title) {
    return { complete: false, reason: "sourceRef.title fehlt — Pflichtfeld" };
  }

  // publisher = authorOrganization; laut CITATION_STANDARD.md unbedingt pflichtig
  const publisher =
    typeof meta.authorOrganization === "string" && meta.authorOrganization.trim() !== ""
      ? meta.authorOrganization
      : null;
  if (!publisher) {
    return { complete: false, reason: "publisher (authorOrganization) fehlt — Pflichtfeld" };
  }

  // license; unbedingt pflichtig (Quellenpflicht; Ingest erzwingt licenseVerified)
  const license =
    typeof meta.licenseInfo === "string" && meta.licenseInfo.trim() !== ""
      ? meta.licenseInfo
      : null;
  if (!license) {
    return { complete: false, reason: "license fehlt — Pflichtfeld" };
  }

  return {
    complete: true,
    citation: {
      sourceId: meta.id,
      title,
      uri: meta.uri,
      publisher,
      pageOrSection,
      sourceVersion: meta.sourceVersion,
      license,
      retrievedAt: meta.retrievedAt ? meta.retrievedAt.toISOString() : null,
      contentHash,
      trustLevel: trustLevel as SourceTrustLevel,
      confessionContext,
      subject,
      chunkText,
      score,
      confidence: deriveConfidence(trustLevel as SourceTrustLevel),
    },
  };
}
