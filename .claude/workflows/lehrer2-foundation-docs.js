export const meta = {
  name: 'lehrer2-foundation-docs',
  description: 'Restliche Governance-/Architektur-Dokumente + Design-System-Doku fuer Unterrichtsassistenz LSA (Haiku-Agents)',
  phases: [
    { title: 'Design', detail: 'Design-Kit inventarisieren + docs/design/DESIGN_SYSTEM.md' },
    { title: 'Docs', detail: 'ADRs, Datenmodell, RAG, Datenschutz, Zitation, README, Open Questions' },
  ],
}

const ROOT = '/Volumes/T7/Projekte/jana_lehrerin'

const SHARED = `GREENFIELD-Projekt "Unterrichtsassistenz LSA", Repo arn0ld87/lehrer2 (privat). KEINE App, KEIN Code — alles Planung/Spezifikation. Behaupte NIRGENDS Umsetzung/Konformitaet. Erfinde keine Quellen/Zahlen/Personen. Deutsch, korrekte Umlaute, keine Emojis, knapp, Markdown (H1 + H2/H3, Tabellen/Listen). Native Write mit exakten absoluten Pfaden. KEIN Bash (Hook blockt es); zum Lesen Read/Glob. Schreibe NUR die dir zugewiesenen Dateien.
GEPLANTER STACK: Next.js App Router + TS + Tailwind; PostgreSQL + Drizzle ORM; Qdrant; Object Store MinIO (S3-kompatibel); Redis + BullMQ; OCR-Worker; provider-agnostische LLM-Abstraktion (lokal Ollama = Default); Rollen Lehrkraft/Admin (spaeter Fachkonferenz/Schuladmin); Docker Compose; modularer Monolith.
INVARIANTEN: Datenklassen PUBLIC/INTERNAL/PERSONAL_TEACHER/SENSITIVE_STUDENT. Pseudonymisierung-by-default; lokaler Redaction-Schritt + fail-closed Guard VOR jedem LLM-Call; Schueler-Klarnamen verlassen das System im Normalbetrieb NIE; Cloud-LLM nur mit dokumentierter Schulfreigabe (CloudReleaseGrant: Rechtsgrundlage+AVV+DSFA+Provider/Region). RAG-Trust OFFICIAL_BINDING/OFFICIAL_GUIDANCE/OPEN_CURATED/USER_APPROVED/UNVERIFIED (UNVERIFIED nie produktiv). Religion strikt getrennt: evangelisch/katholisch/konfessionssensibel-uebergreifend/Ethik(religionskundlich) — nie vermischen. Korrektur: nur Vorschlaege mit Kriterien/Belegen/Unsicherheiten; menschliche Letztentscheidung Pflicht.
CROSS-LINKS relativ; nur existierende Pfade. Baum: Root(PLAN.md, README.md, LICENSE-DECISION.md, compose.yaml, .env.example, package.json, scripts/verify-docs.sh, .github/workflows/ci.yml); docs/product/(PRODUCT_VISION,MVP_SCOPE,USER_FLOWS,ACCEPTANCE_CRITERIA).md; docs/architecture/(ARCHITECTURE,DATA_MODEL,RAG_ARCHITECTURE,INTEGRATION_BOUNDARIES).md; docs/adr/(0001-modular-monolith-first,0002-provider-agnostic-llm-layer,0003-source-governance-before-ingestion,0004-local-first-student-data,0005-orm-drizzle).md; docs/security/(SECURITY,THREAT_MODEL,DATA_PROTECTION,RETENTION_AND_DELETION).md; docs/rag/(SOURCE_REGISTRY,INGESTION_POLICY,EVALUATION_PLAN,CITATION_STANDARD).md; docs/operations/(DEVELOPMENT,GITHUB_SETUP,CI_CD,BACKUP_AND_RECOVERY).md; docs/decisions/OPEN_QUESTIONS.md; docs/design/DESIGN_SYSTEM.md.
ADR-FORMAT (MADR): "# NNNN: Titel" / "## Status" (Akzeptiert, 2026-06-22) / "## Kontext" / "## Optionen" / "## Entscheidung" / "## Konsequenzen" / "## Verweise".`

const jobs = [
  {
    label: 'design-system',
    phase: 'Design',
    prompt: `${SHARED}

AUFGABE: (1) Inventarisiere den Ordner "unterrichtsassistenz-lsa-design-kit" — suche ihn per Glob unter ${ROOT}/ und unter dem Elternverzeichnis /Volumes/T7/Projekte/. Lies (Read) die wichtigsten Dateien (README, Tokens/JSON/CSS, Farb-/Typo-Definitionen, Komponentenliste) — KEIN Bash.
(2) Schreibe ${ROOT}/docs/design/DESIGN_SYSTEM.md mit: Ueberblick (was das Design-Kit enthaelt), absoluter Pfad des Kits und ob es INNERHALB des Repos liegt, Design-Tokens (Farben/Typografie/Spacing soweit vorhanden — nichts erfinden, nur Vorgefundenes), Komponenten-/Screen-Inventar, Mapping auf den geplanten Stack (Next.js + Tailwind), Nutzungshinweise fuer spaetere UI-Umsetzung, Barrierefreiheit/Kontrast falls dokumentiert. Verlinke ../../PLAN.md und ../product/USER_FLOWS.md.
Falls der Ordner nicht auffindbar ist: schreibe die Datei trotzdem mit einem klar markierten Abschnitt "Design-Kit nicht gefunden — Pfad pruefen" und liste, wo gesucht wurde.
RUECKGABE (Text): absoluter Pfad des Kits, ob im Repo, Stichliste der gefundenen Token/Dateien.`,
  },
  {
    label: 'adr-0001-0003',
    prompt: `${SHARED}

AUFGABE: Schreibe diese 3 ADRs im MADR-Format:
${ROOT}/docs/adr/0001-modular-monolith-first.md — Entscheidung: Start als modularer Monolith (eine deploybare Next.js-App + separater Worker), Module mit klaren Grenzen; Microservices spaeter bei Bedarf. Kontext: kleines Team, Kostenkontrolle, Evolvierbarkeit, Self-Hosting. Optionen: Monolith vs Microservices vs Serverless. Konsequenzen: einfacher Betrieb, Modulgrenzen muessen diszipliniert durchgesetzt werden, OCR/Extraktion bereits als separater Prozess vorgesehen. Verweise: ../architecture/ARCHITECTURE.md, ../../PLAN.md.
${ROOT}/docs/adr/0002-provider-agnostic-llm-layer.md — Entscheidung: LLM hinter einer Abstraktion mit Adaptern (Ollama=Default lokal, OpenAI-kompatible lokale APIs, freigegebene Cloud), ALLE hinter einem einheitlichen Datenschutz-Gate (Redaction+Guard). Kontext: Kosten, Datenschutz, Austauschbarkeit, kein Lock-in. Konsequenzen: einheitliche Redaction/Guard, Provider-Policy je Datenklasse, lokaler Default. Verweise: ../architecture/INTEGRATION_BOUNDARIES.md, ../security/DATA_PROTECTION.md, 0004-local-first-student-data.md.
${ROOT}/docs/adr/0003-source-governance-before-ingestion.md — Entscheidung: Kein Dokument gelangt in den produktiven RAG, bevor Lizenz/Nutzungsbedingungen UND Aktualitaet geprueft sind und Status APPROVED ist; UNVERIFIED nie produktiv. Kontext: Urheberrecht, Curriculum-Korrektheit, Haftung. Konsequenzen: Registry + Freigabe-Workflow vor Ingestion, langsamer aber rechtssicher; Konfliktfassungen -> Maintainer-Issue statt Raten. Verweise: ../rag/INGESTION_POLICY.md, ../rag/SOURCE_REGISTRY.md.
RUECKGABE: Liste der geschriebenen Pfade.`,
  },
  {
    label: 'adr-0004-0005',
    prompt: `${SHARED}

AUFGABE: Schreibe diese 2 entscheidungsschweren ADRs im MADR-Format, sorgfaeltig:
${ROOT}/docs/adr/0004-local-first-student-data.md — Entscheidung: Lokaler Ollama ist Default-Provider; SENSITIVE_STUDENT-Daten werden standardmaessig lokal verarbeitet; VOR jedem Cloud-Call ist Pseudonymisierung/Redaction Pflicht (fail-closed Guard); Schueler-Klarnamen verlassen das System im Normalbetrieb NIE. Ein "Klartext-Cloud-Modus" existiert ausschliesslich als OFF-BY-DEFAULT, pro Schule gesetzlich freigegebene (CloudReleaseGrant: Rechtsgrundlage + AVV + DSFA + Provider/Region) und AUDITIERTE Ausnahme mit lautem Warnhinweis. Kontext: DSGVO, Minderjaehrige, im Religionsunterricht Art.-9-Daten (Konfession/Weltanschauung). Optionen: (a) gar keine Schuelerdaten in Cloud, (b) pseudonymisiert+gegated [GEWAEHLT], (c) Klarnamen-Default [VERWORFEN]. Entscheidungsverlauf dokumentieren: Auftraggeber wollte zunaechst Klarnamen-Default; Einwand (kein funktionaler Nutzen, Spec-Widerspruch, hohes Rechtsrisiko) fuehrte zu Variante (b). Konsequenzen: Datenschutz-Gate nicht umgehbar; Cloud gegated; RESTRISIKO Re-Identifikation aus pseudonymisiertem Freitext explizit fuehren; Empfehlung: Klartext-Modus erst nach Ruecksprache mit Landesdatenschutzbeauftragtem. Verweise: ../security/DATA_PROTECTION.md, ../security/THREAT_MODEL.md, ../decisions/OPEN_QUESTIONS.md.
${ROOT}/docs/adr/0005-orm-drizzle.md — Entscheidung: Drizzle ORM. Kontext: PostgreSQL, TypeScript strict, Self-Hosting, Kostensensitivitaet, auditierbare Loeschkonzepte (DSGVO Art. 17). Optionen: Prisma (sehr reife Migrationen, exzellente DX/Studio, breite Verbreitung; schwergewichtiger, SQL staerker abstrahiert) vs Drizzle (SQL-transparent/auditierbar, TS-nativ, schlank; juengeres Migrations-Tooling). Entscheidung Drizzle wegen SQL-Transparenz fuer nachweisbare Loeschoperationen + schlankem Self-Hosting-Fussabdruck. Wichtigste Gegenstimme festhalten: Prisma fuehrt bei Migrations-Reife und Onboarding. Mitigation: Loeschpfade als benannte, getestete SQL-Repository-Methoden; Migrationen reviewpflichtig; CI-Check gegen Schema-Drift. Verweise: ../architecture/DATA_MODEL.md, ../architecture/ARCHITECTURE.md.
RUECKGABE: Liste der geschriebenen Pfade.`,
  },
  {
    label: 'data-model',
    prompt: `${SHARED}

AUFGABE: Schreibe ${ROOT}/docs/architecture/DATA_MODEL.md als KONZEPTIONELLES Datenmodell (KEIN echter Code/keine Drizzle-TS-Datei; Entitaeten als Tabellen + Prosa + Pseudo-CHECK-Regeln). Inhalt exakt uebernehmen und sauber ausformulieren:

## Kontrollierte Vokabulare (Enums)
- SchoolForm: GESAMTSCHULE, GEMEINSCHAFTSSCHULE
- EducationTrack (Bildungsgang): HAUPTSCHULBILDUNGSGANG, REALSCHULBILDUNGSGANG, GYMNASIALER_BILDUNGSGANG
- SchoolStage: SEK_I, SEK_II (strukturell getrennt)
- Subject: DEUTSCH, RELIGION, ETHIK
- ConfessionContext: EVANGELISCH, KATHOLISCH, KONFESSIONSSENSIBEL_UEBERGREIFEND, RELIGIONSKUNDLICH, NICHT_ANWENDBAR
- GradeBand: KS5..KS10 fuer Sek I; Sek II ueber Kurshalbjahre (nicht ueber Jahrgangszahl)

## CurriculumStrand (Lehrplan-Strang, unteilbare fachliche Einheit)
Felder: id (UUID PK), subject, confessionContext (Pflicht; bei DEUTSCH = NICHT_ANWENDBAR), schoolForm, educationTrack (nullable; null nur bei Sek II/schulformuebergreifend), schoolStage, framework_authority, valid_from, valid_to (nullable), version (SemVer), supersedes_id (nullable), status (DRAFT/ACTIVE/RETIRED).

## CurriculumNode (Kompetenz-/Themenknoten, hierarchisch)
Felder: id, strand_id (FK -> CurriculumStrand, erbt Domaenen-/Konfessions-Identitaet), parent_id (nullable Baum), grade_band (nullable), code (offizieller Lehrplan-Code fuer Zitation), title, description, competence_area.

## Erzwungene Konfessionstrennung (nicht nur Doku)
1. Konfession sitzt am Strang, nicht am Inhalt; Inhalte erben confessionContext ueber strand_id.
2. Pseudo-CHECK: subject=RELIGION => confessionContext in {EVANGELISCH,KATHOLISCH,KONFESSIONSSENSIBEL_UEBERGREIFEND}; subject=ETHIK => confessionContext in {RELIGIONSKUNDLICH,NICHT_ANWENDBAR}; subject=DEUTSCH => confessionContext=NICHT_ANWENDBAR. Damit "katholischer Ethik-Strang" o.ae. auf DB-Ebene unmoeglich.
3. RAG-Retrieval traegt subject+confessionContext als harte Pflichtfilter.
4. Keine kreuzkonfessionelle Aggregation in Generierungs-Prompts (Kontext pro Strang).

## Unterrichtsartefakte (Konvention: owner_teacher_id, strand_id, data_class, created_at/updated_at, deleted_at Soft-Delete, version)
Tabelle mit Entitaet | Schluesselfelder | Relationen | Datenklasse:
- TeachingUnit (id,title,strand_id,grade_band,goals,sequence_order,status) -> CurriculumStrand; 1:n Lesson/Worksheet | INTERNAL
- Lesson (id,unit_id,objectives,phase_plan) -> TeachingUnit; n:m CurriculumNode | INTERNAL
- Worksheet (id,unit_id,title,instructions,layout_ref,license,derivation_source) -> 1:n Task; n:m SourceRef | INTERNAL
- Task (id,worksheet_id,prompt,task_type,difficulty,expected_competence_node_id,points) -> 1:1 ExpectationHorizon | INTERNAL
- ExpectationHorizon (id,task_id,model_solution,acceptance_criteria,partial_credit_rules) | INTERNAL
- Rubric (id,scope UNIT|TASK,target_id,scale_type,total_points) -> 1:n RubricCriterion | INTERNAL
- RubricCriterion (id,rubric_id,label,weight,level_descriptors[]) | INTERNAL
- StudentSubmission (id,task_id,pseudonym_id,content_ref,ocr_text_ref,submitted_at) | SENSITIVE_STUDENT
- CorrectionDraft (id,submission_id,rubric_id,ai_suggestion,provenance,human_decision,decided_by,decided_at,status DRAFT|HUMAN_CONFIRMED|OVERRIDDEN) | SENSITIVE_STUDENT
- GenerationProvenance (id,artifact_type,artifact_id,provider,model,prompt_hash,redaction_applied,source_refs[],confidence_state) | INTERNAL/Audit
- SourceRef (siehe CITATION_STANDARD) | je nach Quelle

## Datenklassifizierung
PUBLIC / INTERNAL / PERSONAL_TEACHER / SENSITIVE_STUDENT (kurz erlaeutern).

## Schlusselregel Korrektur
CorrectionDraft.status wechselt nur mit gesetztem decided_by (Lehrkraft) zu HUMAN_CONFIRMED — menschliche Letztentscheidung als Datenmodell-Invariante.

Verlinke ./ARCHITECTURE.md, ./RAG_ARCHITECTURE.md, ../rag/CITATION_STANDARD.md, ../adr/0005-orm-drizzle.md, ../security/DATA_PROTECTION.md.
RUECKGABE: geschriebener Pfad.`,
  },
  {
    label: 'rag-architecture',
    prompt: `${SHARED}

AUFGABE: Schreibe ${ROOT}/docs/architecture/RAG_ARCHITECTURE.md. Inhalt:

## Vertrauensstufen (TrustLevel)
Tabelle: OFFICIAL_BINDING (verbindlicher Lehrplan/Rechtsnorm; hoechste Prioritaet, zitierpflichtig), OFFICIAL_GUIDANCE (offizielle Handreichung; nutzbar, gekennzeichnet), OPEN_CURATED (gepruefte offene Bildungsressourcen, lizenzgeklaert), USER_APPROVED (von Schule/Lehrkraft freigegebenes Eigenmaterial; eigener Scope), UNVERIFIED (ungeprueft; NIE produktiv).

## Quellen-Lebenszyklus (Statusmaschine)
DISCOVERED -> UNDER_REVIEW -> REGISTERED -> APPROVED -> INGESTED -> VERSIONED -> EVALUATED -> REVOKED/DELETED. Pro Uebergang kurz beschreiben (discover=Metadaten; pruefen=Lizenz/Autoritaet/Aktualitaet -> TrustLevel; registrieren=Pflichtmetadaten; freigeben=Admin/Fachkonferenz; ingestieren=OCR/Chunk/Embed ab APPROVED; versionieren=neue Chunk-Generation, alte referenzierbar fuer Zitatstabilitaet; evaluieren=Qualitaet/Drift; widerrufen/loeschen=Chunks aus Qdrant + PG als nicht-retrievbar + harte Loeschung kaskadiert Object Store/PG/Vektoren).

## RagChunk — Pflichtfelder
source_document_id, chunk_text, embedding_ref (Qdrant-Point-ID), page_or_section, source_version, license, retrieved_at, content_hash, trust_level, subject, confession_context, valid_from, valid_to. Ein Chunk ohne vollstaendige Pflichtfelder wird NICHT in Qdrant aufgenommen (Ingestion-Gate).

## Garantien
1. UNVERIFIED nie produktiv — DOPPELTE Absicherung: (a) UNVERIFIED-Chunks werden gar nicht nach Qdrant geschrieben; (b) Retrieval-Query setzt zusaetzlich serverseitigen trust_level-Filter. Zwei unabhaengige Schichten.
2. Beleg-Pflicht/Confidence: GROUNDED (>=1 SourceRef, Zitat sichtbar) vs UNSUPPORTED_DRAFT (kein Beleg -> im UI klar als Entwurf ohne Quellnachweis markiert, nicht freigabefaehig, nie als Lehrplanbehauptung). Aussagen mit Lehrplan-Anspruch ohne OFFICIAL_*-Beleg gelten grundsaetzlich als UNSUPPORTED_DRAFT.
3. Konfessions-/Fach-Scope ist Pflichtfilter jeder Query.

## Retrieval-/Embedding-Pipeline (konzeptionell)
Embedding-Modell (lokal, z.B. via Ollama), Qdrant-Collection mit Metadaten-Filter, optionales Reranking, Zitat-Zusammenbau gemaess CITATION_STANDARD.

Verlinke ./DATA_MODEL.md, ../rag/INGESTION_POLICY.md, ../rag/CITATION_STANDARD.md, ../rag/SOURCE_REGISTRY.md, ../adr/0003-source-governance-before-ingestion.md.
RUECKGABE: geschriebener Pfad.`,
  },
  {
    label: 'data-protection',
    prompt: `${SHARED}

AUFGABE: Schreibe ${ROOT}/docs/security/DATA_PROTECTION.md (dies ist das zentrale Datenschutzdokument; sorgfaeltig). Inhalt:

## Grundsaetze
Datenminimierung, Zweckbindung, Pseudonymisierung-by-default, Local-first, fail-closed.

## Datenklassen
PUBLIC / INTERNAL / PERSONAL_TEACHER / SENSITIVE_STUDENT — je mit Cloud-Eignung (SENSITIVE_STUDENT: nur pseudonymisiert + dokumentierte Schulfreigabe; Klarnamen nie).

## LLM-Request-Pipeline (nicht umgehbar) — Schrittfolge
1. Intent + Scope bestimmen (Fachdomaene, Strang, Datenklasse).
2. Provider-Policy-Gate: Default LOCAL_OLLAMA. Cloud nur wenn (a) aktiver CloudReleaseGrant der Schule (freigebende Person, Zweck, Datum, Geltungsbereich, Rechtsgrundlage, AVV, DSFA) UND (b) Datenklasse Cloud zulaesst. SENSITIVE_STUDENT Klartext -> Cloud nur im gegated Klartext-Modus; Default bleibt pseudonymisiert.
3. Redaction/Pseudonymisierung (lokal, vor jedem Provider-Call): Schuelernamen -> stabile Pseudonyme (pseudonym_id); weitere PII (Geburtsdaten, Adressen, ggf. Foerderbedarf/Art.-9-Hinweise) entfernen/maskieren. Mapping bleibt ausschliesslich lokal. redaction_applied=true protokollieren.
4. Kontext-Assembly: RAG-Retrieval mit Pflichtfiltern (Fach, Konfession, TrustLevel); nur freigegebene Chunks.
5. Guard-Assertion vor Versand (fail-closed): letzter automatischer Check auf Klarnamen/PII-Muster im ausgehenden Payload; bei Treffer Abbruch, kein Versand.
6. Provider-Call ueber die provider-agnostische Abstraktion.
7. Re-Identifikation (lokal, nur lokaler Output-Pfad): Pseudonyme nur beim Zurueckspielen an die Lehrkraft lokal aufgeloest; nie im an die Cloud gesendeten Material.
8. Provenance-Logging: GenerationProvenance (Provider, Modell, prompt_hash, redaction_applied, source_refs, confidence_state).
9. Confidence-/Citation-Markierung des Outputs.
Designinvariante: Schritt 3 und 5 sind nicht umgehbar; jeder Provider-Adapter liegt hinter demselben Gate; ein neuer Cloud-Adapter erbt automatisch Redaction + Guard.

## Klartext-Cloud-Modus (Ausnahme)
off-by-default, pro Schule per CloudReleaseGrant gesetzlich freigegeben, auditiert, mit Warnhinweis. RESTRISIKO: Re-Identifikation aus pseudonymisiertem Freitext; Empfehlung: erst nach Ruecksprache mit Landesdatenschutzbeauftragtem aktivieren.

## Weitere Anforderungen
Rollenmodell & Mandantentrennung (Schule/Lehrkraft), Verschluesselung (at-rest/in-transit), Secrets-Verwaltung (keine Secrets im Repo), Auditierbarkeit (Audit-Log), Loeschkonzept (Verweis), Korrekturassistenz liefert nur nachvollziehbare Vorschlaege inkl. Kriterien/Belegen/Unsicherheiten.

Verlinke ../adr/0004-local-first-student-data.md, ./THREAT_MODEL.md, ./RETENTION_AND_DELETION.md, ../architecture/DATA_MODEL.md, ../decisions/OPEN_QUESTIONS.md.
RUECKGABE: geschriebener Pfad.`,
  },
  {
    label: 'citation-openq',
    prompt: `${SHARED}

AUFGABE: Schreibe diese 2 Dateien:

${ROOT}/docs/rag/CITATION_STANDARD.md — Zitationsstandard. Inhalt: Grundsatz (jede fachliche/curriculare Aussage belegt). Pflichtfelder einer Zitation/eines SourceRef: source_document_id, title, publisher, official_url, trust_level, page_or_section, source_version, license, retrieved_at, content_hash, subject, confession_context. Confidence-Zustaende GROUNDED vs UNSUPPORTED_DRAFT (Definition + UI-Konsequenz). Darstellungsformat im Produkt (z.B. Fussnote/Quellenliste mit Seite/Abschnitt + Version + Abrufdatum) als Beispiel-Schema (kein echter Code). Regel: Aussagen mit Lehrplan-Anspruch ohne OFFICIAL_*-Beleg sind UNSUPPORTED_DRAFT. Verlinke ../architecture/RAG_ARCHITECTURE.md, ./SOURCE_REGISTRY.md, ./INGESTION_POLICY.md.

${ROOT}/docs/decisions/OPEN_QUESTIONS.md — Offene Entscheidungen (je: Frage, Kontext, Optionen, Vorschlag, Status offen, zugehoeriges Maintainer-Issue als Platzhalter):
1. Sek-II-Modellierung (GradeBand vs Kurshalbjahr) und ob Klassen 11/12 MVP-relevant sind (Spec sagt 5-12, Curriculummodell 5-10 + Sek II separat).
2. KONFESSIONSSENSIBEL_UEBERGREIFEND als eigener dritter Strang (kein Mischen) — bestaetigungsbeduerftig.
3. Ethik als eigenes Subject vs Modus von Religion (RELIGIONSKUNDLICH mischt Fach- und Perspektivachse).
4. Pseudonym-Stabilitaet vs Recht auf Vergessenwerden (Loeschfristen der Mapping-Tabelle, Re-Pseudonymisierung).
5. Freigaberolle Fachkonferenz/Schuladmin kommt "spaeter" — Uebergangsregel: Admin uebernimmt Freigabe vorerst.
6. Umgang mit widerspruechlichen/mehreren Lehrplanfassungen: nicht raten -> Konflikt dokumentieren + Maintainer-Issue.
Verlinke ../../PLAN.md, ../security/DATA_PROTECTION.md.
RUECKGABE: Liste der geschriebenen Pfade.`,
  },
  {
    label: 'readme-license',
    prompt: `${SHARED}

AUFGABE: Schreibe diese 2 Dateien:

${ROOT}/README.md — Front-Door. Inhalt: Projektname + Einzeiler; deutlicher Status-Disclaimer (Fundament/Planung, KEINE App, keine Konformitaetsbehauptung); Zielgruppe/Faecher kurz; Repo arn0ld87/lehrer2 (privat); Doku-Index als Linkliste auf ALLE Dokumente (PLAN.md; docs/product/*; docs/architecture/*; docs/adr/*; docs/security/*; docs/rag/*; docs/operations/*; docs/decisions/OPEN_QUESTIONS.md; docs/design/DESIGN_SYSTEM.md; LICENSE-DECISION.md); Quickstart-Verweis auf docs/operations/DEVELOPMENT.md; Hinweis Beitrag/Issues; Lizenz-Hinweis (Verweis LICENSE-DECISION.md). Relative Links ab Repo-Root (z.B. docs/architecture/ARCHITECTURE.md).

${ROOT}/LICENSE-DECISION.md — Lizenzentscheidung offen. Inhalt: aktueller Stand (privat, Lizenz noch nicht festgelegt, daher KEIN LICENSE-File); Optionen mit kurzer Bewertung (proprietaer/all-rights-reserved; EUPL-1.2; AGPL-3.0; MIT/Apache-2.0); Entscheidungskriterien (Self-Hosting/Weitergabe an Schulen, Copyleft vs permissiv, Datenschutz-/Schulkontext, kommerzielle Spielraeume); naechste Schritte; Verweis ../README... nein: README.md, PLAN.md.
RUECKGABE: Liste der geschriebenen Pfade.`,
  },
]

phase('Docs')
log(`Starte ${jobs.length} Haiku-Agents (Docs + Design)`) 
const results = await parallel(jobs.map(j => () => agent(j.prompt, { label: j.label, phase: j.phase || 'Docs', model: 'haiku' })))
const ok = results.filter(Boolean).length
log(`${ok}/${jobs.length} Agents fertig`)
return { agents: jobs.length, completed: ok, outputs: results.map((r, i) => ({ label: jobs[i].label, summary: (r || 'NULL').slice(0, 400) })) }
