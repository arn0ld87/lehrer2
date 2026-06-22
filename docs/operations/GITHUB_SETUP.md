# GitHub-Setup — Unterrichtsassistenz LSA

> **Repo:** `arn0ld87/lehrer2` (privat, Default-Branch `main`, nicht leer).
> **Account:** `arn0ld87` (ADMIN-Berechtigung auf `lehrer2`).
> **Status dieses Dokuments:** reale Ergebnisse vom 2026-06-22. Nicht ausgeführte Aktionen und Ursachen am Ende.

Dieses Dokument beschreibt das GitHub-Setup für das Fundament-Repo der
Unterrichtsassistenz LSA. Es ist **live aus den Ergebnissen der Preflight-Phase
(`gh auth status`, `gh api user`, `gh repo view`, `gh label list`, `gh api …/milestones`,
`gh issue list`, `gh project list`) entstanden** und wird bei jeder erneuten
Setup-Ausführung idempotent fortgeschrieben.

## 1. Preflight (read-only) — reale Ergebnisse

### 1.1 gh CLI

```
gh version 2.93.0 (2026-05-27)
https://github.com/cli/cli/releases/tag/v2.93.0
```

### 1.2 Authentifizierung

```
github.com
  ✓ Logged in to github.com account arn0ld87 (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'
```

**Account:** `arn0ld87` (via `gh api user -q .login` bestätigt).

### 1.3 Ziel-Repo

```
gh repo view arn0ld87/lehrer2 --json visibility,isEmpty,defaultBranchRef,viewerPermission
→ {"defaultBranchRef":{"name":"main"},"isEmpty":false,
   "viewerPermission":"ADMIN","visibility":"PRIVATE"}
```

- `visibility = PRIVATE` ✓ (datenschutzsensibles Produkt — privat ist korrekt)
- `isEmpty = false` → bestehende History, Integration ohne Clobbern nötig (siehe §4)
- `viewerPermission = ADMIN` ✓ → Labels/Milestones/Issues anlegbar
- Default-Branch `main`

### 1.4 Bestehende Labels

`gh label list -R arn0ld87/lehrer2 --json name` lieferte die GitHub-Default-Labels:

```
bug, documentation, duplicate, enhancement, good first issue,
help wanted, invalid, question, wontfix
```

Keine projekt-spezifischen Labels vorhanden. Die 16 geforderten Labels (§3) werden
daher alle neu angelegt.

### 1.5 Bestehende Milestones

```
gh api repos/arn0ld87/lehrer2/milestones --jq '.[]|.title'
→ (keine Ausgabe)
```

Keine Milestones vorhanden. Die 5 geforderten Milestones (§3) werden neu angelegt.

### 1.6 Bestehende Issues

```
gh issue list -R arn0ld87/lehrer2 --limit 50 --json number,title
→ []
```

Keine Issues vorhanden. Die 29 Issues gemäß Issue-Matrix (§3) werden neu angelegt.

### 1.7 Project v2 — **scheitert am fehlenden Scope**

```
gh project list --owner arn0ld87
→ error: your authentication token is missing required scopes [read:project]
   To request it, run:  gh auth refresh -s read:project
```

Der `project`-Scope (sowie `read:project`) fehlt im aktuellen Token. Damit sind
**alle** `gh project *`-Kommandos (list, create, field-create, item-add) nicht
ausführbar. Siehe §5 für die manuelle Anleitung.

## 2. Token-Scopes

Aktuell vorhanden: `gist`, `read:org`, `repo`, `workflow`.

**Fehlend:** `project` (und `read:project`).

### 2.1 Scope nachfordern (exakter Befehl)

```bash
gh auth refresh -s project
```

Dieser Befehl öffnet einen Browser-Flow zur Erweiterung des bestehenden Tokens um
den `project`-Scope (umfasst `read:project` und `project`). Nach erfolgreichem
Refresh prüfen:

```bash
gh auth status
# Erwartet: Token scopes: 'gist', 'read:org', 'project', 'repo', 'workflow'
gh project list --owner arn0ld87
# Erwartet: Liste vorhandener Projects (oder leere Liste)
```

> **Hinweis:** `gh auth refresh` kann nur interaktiv (Browser) ausgeführt werden.
> In CI/headless-Umgebungen stattdessen einen Personal Access Token mit `project`-
> Scope via `GH_TOKEN`-Umgebungsvariable setzen. Für dieses Setup ist der interaktive
> Weg der reguläre Weg.

### 2.2 Wenn der Refresh nicht möglich ist

Dann bleibt Project v2 manuell über die GitHub-Web-UI anzulegen (§5). Labels,
Milestones und Issues sind davon **nicht** betroffen — diese benötigen nur
`repo`-Scope, der vorhanden ist.

## 3. Labels, Milestones, Issues (benötigt nur `repo`-Scope)

Alle Befehle gegen `arn0ld87/lehrer2` (`-R arn0ld87/lehrer2`).

### 3.1 Labels (16, idempotent via `--force`)

`gh label create --force` ist ein Upsert: vorhandenes Label wird aktualisiert,
fehlendes wird angelegt. Damit sind die Befehle ohne vorherige Existenzprüfung
wiederholbar.

| Label                   | Farbe (hex) | Beschreibung                                                                      |
| ----------------------- | ----------- | --------------------------------------------------------------------------------- |
| `type: feature`         | `a2eeef`    | Neuer Funktionsumfang                                                             |
| `type: bug`             | `d73a4a`    | Fehler, nicht wie erwartet                                                        |
| `type: research`        | `fbca04`    | Untersuchung/Erkundung, kein Code                                                 |
| `type: documentation`   | `0075ca`    | Doku, ADRs, Leitfäden                                                             |
| `type: security`        | `b60205`    | Sicherheitsrelevant (PII/Guard/Cloud)                                             |
| `area: product`         | `1d76db`    | Produktvision, Scope, User Flows                                                  |
| `area: frontend`        | `c5def5`    | Next.js UI, Design-Kit                                                            |
| `area: backend`         | `0e8a16`    | API, Workers, Persistenz                                                          |
| `area: rag`             | `5319e7`    | Quellen, Ingestion, Retrieval                                                     |
| `area: data-governance` | `f9d0c4`    | Datenschutz, Löschung, PII-Guard                                                  |
| `area: devops`          | `e99695`    | CI/CD, Docker, Deployment                                                         |
| `priority: p0`          | `b60205`    | Blockierend, sofort                                                               |
| `priority: p1`          | `d93f0b`    | Wichtig, nächste Iteration                                                        |
| `priority: p2`          | `fef2c0`    | Niedrig, optional                                                                 |
| `status: blocked`       | `5319e7`    | Wartet auf Klärung/Abhängigkeit                                                   |
| `good first issue`      | `7057ff`    | Einstiegs-issue (bereits als Default vorhanden, wird mit `--force` überschrieben) |

Anlege-Befehle (Skript-form, nacheinander ausführen):

```bash
gh label create -R arn0ld87/lehrer2 "type: feature"   --color a2eeef --description "Neuer Funktionsumfang" --force
gh label create -R arn0ld87/lehrer2 "type: bug"       --color d73a4a --description "Fehler, nicht wie erwartet" --force
gh label create -R arn0ld87/lehrer2 "type: research"  --color fbca04 --description "Untersuchung/Erkundung, kein Code" --force
gh label create -R arn0ld87/lehrer2 "type: documentation" --color 0075ca --description "Doku, ADRs, Leitfäden" --force
gh label create -R arn0ld87/lehrer2 "type: security"  --color b60205 --description "Sicherheitsrelevant (PII/Guard/Cloud)" --force
gh label create -R arn0ld87/lehrer2 "area: product"   --color 1d76db --description "Produktvision, Scope, User Flows" --force
gh label create -R arn0ld87/lehrer2 "area: frontend"  --color c5def5 --description "Next.js UI, Design-Kit" --force
gh label create -R arn0ld87/lehrer2 "area: backend"   --color 0e8a16 --description "API, Workers, Persistenz" --force
gh label create -R arn0ld87/lehrer2 "area: rag"       --color 5319e7 --description "Quellen, Ingestion, Retrieval" --force
gh label create -R arn0ld87/lehrer2 "area: data-governance" --color f9d0c4 --description "Datenschutz, Löschung, PII-Guard" --force
gh label create -R arn0ld87/lehrer2 "area: devops"    --color e99695 --description "CI/CD, Docker, Deployment" --force
gh label create -R arn0ld87/lehrer2 "priority: p0"    --color b60205 --description "Blockierend, sofort" --force
gh label create -R arn0ld87/lehrer2 "priority: p1"    --color d93f0b --description "Wichtig, nächste Iteration" --force
gh label create -R arn0ld87/lehrer2 "priority: p2"    --color fef2c0 --description "Niedrig, optional" --force
gh label create -R arn0ld87/lehrer2 "status: blocked" --color 5319e7 --description "Wartet auf Klärung/Abhängigkeit" --force
gh label create -R arn0ld87/lehrer2 "good first issue" --color 7057ff --description "Einstiegs-issue" --force
```

### 3.2 Milestones (5, idempotent via GET-then-POST)

`gh api` kennt kein `--force` für Milestones. Idempotenz durch Titel-Suche vor Create:

```bash
# Hilfsfunktion: Milestone nur anlegen, wenn Titel noch nicht existiert
ensure_milestone() {
  local title="$1"
  local number=$(gh api repos/arn0ld87/lehrer2/milestones --jq ".[] | select(.title==\"$title\") | .number")
  if [ -z "$number" ]; then
    gh api repos/arn0ld87/lehrer2/milestones -f title="$title" -f state=open -f description="$2" --jq .number
  else
    echo "$number (bestehend)"
  fi
}

ensure_milestone "M0 – Foundations & Governance" "Fundament: Repo, Doku, ADRs, Governance, CI-Gerüst, Quellenkandidaten"
ensure_milestone "M1 – Curriculum & Planung"     "Curriculummodell, Planungsassistent, Arbeitsblatt-/Bewertungsgeneratoren"
ensure_milestone "M2 – RAG & Quellen"            "Quellenverwaltung, Ingestion, Chunking, Retrieval, Evaluierung"
ensure_milestone "M3 – Korrektur & Datenschutz"  "Korrekturworkflow, Pseudonymisierung, Feedbackformat, OCR/Upload"
ensure_milestone "M4 – Security, Pilot & Betrieb" "Rollen, Backup, Deployment, Pilot, Security-Review"
```

> Keine Zeitversprechen in Milestone-Beschreibungen (Plan-Vorgabe).

### 3.3 Issues (29, idempotent via Titel-Suche)

Pro Issue: erst `gh issue list --search "<exakter Titel> in:title"`, nur anlegen
wenn absent. Bodies als Dateien schreiben und mit `gh issue create -F <datei>`
übergeben. Siehe Issue-Matrix in
[`PLAN.md`](../../PLAN.md) bzw. im Ausführungsplan
(`~/.claude/plans/du-arbeitest-als-staff-curried-hearth.md`).

```bash
ensure_issue() {
  local title="$1"
  local body_file="$2"
  local labels="$3"
  local milestone="$4"
  local existing=$(gh issue list -R arn0ld87/lehrer2 --search "$title in:title" --json number --jq 'length')
  if [ "$existing" = "0" ]; then
    gh issue create -R arn0ld87/lehrer2 -t "$title" -F "$body_file" -l "$labels" -m "$milestone"
  else
    echo "skip: $title (bereits vorhanden)"
  fi
}
```

## 4. Git-Integration (bestehendes Repo, nicht leer)

Lokaler Zustand (Preflight): Working-Tree clean bis auf `.DS_Store` (getrackt, s. u.).
Lokal und `origin/main` sind synchron (`0 0` ahead/behind).

### 4.1 `.DS_Store` aus Tracking entfernen

`.DS_Store`, `docs/.DS_Store`, `unterrichtsassistenz-lsa-design-kit/.DS_Store` sind
getrackt, obwohl `.gitignore` `.DS_Store` enthält (wurden vor `.gitignore` committet).
Bereinigung ohne `--force`:

```bash
git rm --cached .DS_Store docs/.DS_Store unterrichtsassistenz-lsa-design-kit/.DS_Store
git commit -m "chore: stop tracking .DS_Store (gitignored)"
```

### 4.2 Foundation-Commit + Push

```bash
git add -A
git commit -m "chore: initialize Unterrichtsassistenz LSA foundation

Co-Authored-By: Claude <noreply@anthropic.com>
Generated-with: pi coding agent (Claude)"

git push -u origin main
# Nie --force. Bei non-fast-forward: git pull --rebase origin main, dann push.
```

> **Hinweis:** `main` ist nicht branch-protection-geschützt (Preflight hat keine
> Protection detectiert). Dennoch kein `--force`. Sollte `main` später geschützt
> werden, ist ein Feature-Branch + PR erforderlich (siehe `docs/operations/CI_CD.md`).

## 5. Project v2 — manuelle Anleitung (falls Scope-Refresh nicht möglich)

Da `gh project *` aktuell am fehlenden `project`-Scope scheitert, hier die exakte
manuelle Anleitung. **Keine Erfolgsbehauptung** — das Project ist erst angelegt,
wenn die Schritte tatsächlich ausgeführt wurden.

### 5.1 Project anlegen (Web-UI)

1. https://github.com/users/arn0ld87/projects?type=beta öffnen.
2. **New project** → Template **Repository-linked** oder **Blank**.
3. Name: **Unterrichtsassistenz LSA – Roadmap**.
4. Sichtbarkeit: **Private** (Repo ist privat, Roadmap enthält Roadmap-Details).
5. Speichern. Project-URL notieren (z. B.
   `https://github.com/users/arn0ld87/projects/NN`).

### 5.2 Felder anlegen (Single-Select wo sinnvoll)

Im Project: **+ New field** pro Feld. Empfohlene Felder (über die Default-Felder
`Title`, `Assignees`, `Status` hinaus):

| Feld          | Typ                                                  | Optionen                                                             |
| ------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| **Status**    | Single-Select (bereits vorhanden, Optionen anpassen) | `Backlog`, `In Progress`, `In Review`, `Done`, `Blocked`             |
| **Priority**  | Single-Select                                        | `P0`, `P1`, `P2`                                                     |
| **Area**      | Single-Select                                        | `product`, `frontend`, `backend`, `rag`, `data-governance`, `devops` |
| **Milestone** | Single-Select (oder Iteration, wenn zeitlich)        | `M0`, `M1`, `M2`, `M3`, `M4`                                         |
| **Risk**      | Single-Select                                        | `low`, `medium`, `high`                                              |

### 5.3 Issues dem Project zuordnen

Pro Issue: In der Project-Ansicht **+ Add item** → Issue auswählen. Alternativ
nach Scope-Refresh via CLI:

```bash
# Nach gh auth refresh -s project:
PROJECT_ID=$(gh project list --owner arn0ld87 --format json --jq '.[] | select(.title=="Unterrichtsassistenz LSA – Roadmap") | .id')
for n in $(gh issue list -R arn0ld87/lehrer2 --json number --jq '.[].number'); do
  gh project item-add "$PROJECT_ID" --owner arn0ld87 --url "https://github.com/arn0ld87/lehrer2/issues/$n"
done
```

### 5.4 Felder pro Issue setzen

Feldwerte (Status/Priority/Area/Milestone/Risk) werden nicht automatisch aus den
Repo-Labels/Milestones übernommen. Sie müssen pro Issue im Project gesetzt werden
(CLI nach Scope-Refresh oder Web-UI). Empfehlung: Web-UI-Bulk-Edit via
Ansicht → Feld-Spalte → Werte zuweisen.

## 6. Idempotenz-Hinweise

- **Labels:** `gh label create --force` ist ein Upsert. Unbedenklich wiederholbar.
- **Milestones:** Kein `--force`. `gh api repos/:owner/:repo/milestones` (GET) vor
  Create, Titel-Match. Bestehende Milestone-Nummer notieren (Issues referenzieren
  Milestone-Nummer, nicht Titel).
- **Issues:** Kein `--force`. `gh issue list --search "<title> in:title"` vor Create.
  Bei Titel-Kollision skippen. Bodies als Dateien belassen, damit Re-Runs identisch
  reproduzierbar sind.
- **Project v2:** Komplett manuell oder erst nach `gh auth refresh -s project`.
  Keine CLI-seitige Idempotenz ohne eigenen Check.

## 7. Nicht ausgeführte Aktionen + Ursache

| Aktion                                         | Status               | Ursache                                                                                                                          |
| ---------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `gh project list/create/field-create/item-add` | **nicht ausgeführt** | Fehlender `project`-Scope im Token; `gh project list` scheitert mit `[read:project]`-Fehler. Manuelles Setup in §5 dokumentiert. |
| `gh auth refresh -s project`                   | **nicht ausgeführt** | Erfordert interaktiven Browser-Flow; kann nicht headless vom Agent ausgeführt werden. Befehl in §2.1 dokumentiert.               |
| Branch-Protection für `main` konfigurieren     | **nicht ausgeführt** | Nicht Teil dieses Fundament-Auftrags; offene Entscheidung (s. `docs/decisions/OPEN_QUESTIONS.md`).                               |
| Visibility-Änderung                            | **nicht ausgeführt** | Repo ist bereits `PRIVATE` — keine Aktion nötig.                                                                                 |

## 8. Verwandte Dokumente

- [`CI_CD.md`](./CI_CD.md) — CI-Workflow, Branch-Protection-Optionen
- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — lokales Setup, Docker-Compose
- [`BACKUP_AND_RECOVERY.md`](./BACKUP_AND_RECOVERY.md) — Backup-Plan
- [`../decisions/OPEN_QUESTIONS.md`](../decisions/OPEN_QUESTIONS.md) — Auth/Export offene Entscheidungen
- [`../../PLAN.md`](../../PLAN.md) — Roadmap M0–M4, Issue-Matrix
