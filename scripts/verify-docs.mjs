// Doku-Qualitaetsgate (Node, ESM). Geprueft werden:
//  1. Praesenz aller Pflichtdateien
//  2. Interne (relative) Markdown-Links zeigen auf existierende Ziele
//  3. YAML-Dateien sind syntaktisch valide
// Externe Links (http/https) und das Design-Kit werden NICHT geprueft.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const ROOT = process.cwd();
const errors = [];

const REQUIRED = [
  "README.md", "PLAN.md", "LICENSE-DECISION.md", ".gitignore", ".editorconfig",
  ".env.example", "compose.yaml", "package.json",
  "docs/product/PRODUCT_VISION.md", "docs/product/MVP_SCOPE.md",
  "docs/product/USER_FLOWS.md", "docs/product/ACCEPTANCE_CRITERIA.md",
  "docs/architecture/ARCHITECTURE.md", "docs/architecture/DATA_MODEL.md",
  "docs/architecture/RAG_ARCHITECTURE.md", "docs/architecture/INTEGRATION_BOUNDARIES.md",
  "docs/adr/0001-modular-monolith-first.md", "docs/adr/0002-provider-agnostic-llm-layer.md",
  "docs/adr/0003-source-governance-before-ingestion.md", "docs/adr/0004-local-first-student-data.md",
  "docs/adr/0005-orm-drizzle.md",
  "docs/security/SECURITY.md", "docs/security/THREAT_MODEL.md",
  "docs/security/DATA_PROTECTION.md", "docs/security/RETENTION_AND_DELETION.md",
  "docs/security/UPLOAD_AND_OCR_SECURITY.md", "docs/security/REDACTION_AND_GUARD_SPEC.md",
  "docs/rag/SOURCE_REGISTRY.md", "docs/rag/INGESTION_POLICY.md",
  "docs/rag/EVALUATION_PLAN.md", "docs/rag/CITATION_STANDARD.md",
  "docs/operations/DEVELOPMENT.md", "docs/operations/GITHUB_SETUP.md",
  "docs/operations/CI_CD.md", "docs/operations/BACKUP_AND_RECOVERY.md",
  "docs/decisions/OPEN_QUESTIONS.md", "docs/design/DESIGN_SYSTEM.md",
  "data/source-registry.seed.yaml",
  ".github/workflows/ci.yml", ".github/pull_request_template.md",
  ".github/ISSUE_TEMPLATE/feature.yml", ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/research.yml", ".github/ISSUE_TEMPLATE/security.yml",
  ".github/ISSUE_TEMPLATE/config.yml", "scripts/verify-docs.sh",
];

for (const f of REQUIRED) {
  if (!fs.existsSync(path.join(ROOT, f))) errors.push(`FEHLT: ${f}`);
}

const SKIP_DIRS = new Set(["node_modules", "unterrichtsassistenz-lsa-design-kit"]);

function walk(dir, test, acc) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith(".git")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, test, acc);
    else if (test(e.name)) acc.push(p);
  }
}

// Markdown-Dateien: docs/** + ausgewaehlte Root-Dateien
const mdFiles = [];
walk(path.join(ROOT, "docs"), (n) => n.endsWith(".md"), mdFiles);
for (const f of ["README.md", "PLAN.md", "LICENSE-DECISION.md"]) {
  const af = path.join(ROOT, f);
  if (fs.existsSync(af)) mdFiles.push(af);
}

const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
for (const file of mdFiles) {
  let txt = fs.readFileSync(file, "utf8");
  txt = txt.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, ""); // Codebloecke ignorieren
  let m;
  while ((m = linkRe.exec(txt))) {
    let target = m[1].trim();
    if (!target || /^(https?:|mailto:|tel:|#)/i.test(target)) continue;
    target = target.split(/[#?\s]/)[0];
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) {
      errors.push(`TOTER LINK: ${path.relative(ROOT, file)} -> ${m[1]}`);
    }
  }
}

// YAML-Validitaet: .github/**, data/**, compose.yaml
const yamlFiles = [];
walk(path.join(ROOT, ".github"), (n) => /\.ya?ml$/.test(n), yamlFiles);
walk(path.join(ROOT, "data"), (n) => /\.ya?ml$/.test(n), yamlFiles);
const compose = path.join(ROOT, "compose.yaml");
if (fs.existsSync(compose)) yamlFiles.push(compose);
for (const yf of yamlFiles) {
  try {
    yaml.loadAll(fs.readFileSync(yf, "utf8"));
  } catch (e) {
    errors.push(`YAML-FEHLER: ${path.relative(ROOT, yf)}: ${e.message}`);
  }
}

if (errors.length) {
  console.error(`verify-docs: ${errors.length} Problem(e) gefunden:`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(
  `verify-docs: OK — ${mdFiles.length} Markdown-, ${yamlFiles.length} YAML-, ${REQUIRED.length} Pflichtdateien geprueft.`,
);
