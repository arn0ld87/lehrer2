# Quellenregistry — Unterrichtsassistenz LSA

> **Status: KANDIDATENLISTE. Keine Quelle ist geprüft, freigegeben oder ingestiert.**
> Alle Einträge führen `status: candidate`, `license_verified: false`, `content_hash: null`.
> Die Spiegelung der Maschinendaten liegt unter [`data/source-registry.seed.yaml`](../../data/source-registry.seed.yaml).

Diese Registry ist **nur eine Kandidatenliste** offizieller Bildungs- und Rechtsquellen für
das Land Sachsen-Anhalt. Sie ist kein Nachweis von RAG-Konformität, Lehrplanbezug oder
datenschutzrechtlicher Eignung. Erst nach Durchlaufen des Source-Governance-Prozesses
([ADR 0003](../adr/0003-source-governance-before-ingestion.md)) darf eine Quelle in die
RAG-Pipeline aufgenommen werden (`status: approved` bzw. `ingested`).

## Politik

1. **Nur offizielle Quellen.** Aufgenommen werden ausschließlich Quellen von
   `bildung-lsa.de`, `lisa.sachsen-anhalt.de`, `mb.sachsen-anhalt.de`,
   `datenschutz.sachsen-anhalt.de`, `landesschulamt.sachsen-anhalt.de`,
   `landtag.sachsen-anhalt.de` sowie — für das Schulgesetz — die via `GVBl. LSA`
   veröffentlichte Bekanntmachung (Ersatzweise das amtlich reproduzierte PDF auf
   `begabungslotse.de`, in `notes` als solche gekennzeichnet). Keine Verlagsmaterialien,
   keine Schulbuchkopien, keine Paywall-Inhalte, kein Scraping geschützter Inhalte.

2. **Nur Metadaten.** Diese Registry enthält ausschließlich Metadaten (Titel, Herausgeber,
   URL, Versionsstand, Lizenzhinweis, Notizen). Die verlinkten Dokumente werden _nicht_
   in diesem Repository gespeichert. Downloads/Ingestion erfolgen erst nach Freigabe
   durch Source-Governance und ausschließlich in die RAG-Ingestion-Pipeline.

3. **Lizenz ungeprüft.** `license_verified: false` für alle Einträge. Vor Ingestion muss
   pro Quelle die Lizenz rechtsverbindlich geprüft und dokumentiert werden. Bei
   Unklarheit wird die Quelle _nicht_ ingestiert (fail-closed, ADR 0003).

4. **Versionsstände nicht geraten.** Lehrpläne liegen in unterschiedlichen Fassungen
   vor (2007/2012/2019/2022/2023/2024, Erprobungs- vs. Endfassungen). Bei
   Widersprüchen wird in `notes` markiert und ein Maintainer-Issue zur Klärung
   vorgemerkt (zusätzlich zu Roadmap-Issue #6 „Initiale offizielle Quellenregistry
   für Deutsch und Religion LSA erstellen"). Siehe auch offene Fragen in
   [`docs/decisions/OPEN_QUESTIONS.md`](../decisions/OPEN_QUESTIONS.md).

5. **Konfessionstrennung.** Evangelischer und katholischer Religionsunterricht sowie
   Ethikunterricht werden als **getrennte** Stränge geführt (Curriculummodell, ADR 0004).
   Quellen werden entsprechend mit `subject: RELIGION_EV` / `RELIGION_KATH` / `ETHIK`
   markiert; Mischen ist nicht zulässig.

6. **Content-Hash erst bei Ingestion.** `content_hash: null` für alle Kandidaten.
   Hashing erfolgt erst, wenn eine Quelle tatsächlich in die Pipeline aufgenommen wird
   (Lebenszyklus `REGISTERED→APPROVED→INGESTED`, siehe
   [`RAG_ARCHITECTURE.md`](../architecture/RAG_ARCHITECTURE.md)).

7. **Keine Behauptung von Lehrplanbezug.** Ein Eintrag in dieser Registry ist _keine_
   Aussage darüber, dass diequelle für den Unterricht in einer bestimmten Klassenstufe
   verbindlich ist. Verbindlichkeit ergibt sich ausschließlich aus dem RdErl. zu den
   Lehrplänen/Rahmenrichtlinien ab Schuljahr 2025/2026 (src-005) bzw. den jeweiligen
   Fachlehrplänen in ihrer aktuell gültigen Fassung.

## Kandidaten (Stand 2026-06-22)

| ID      | Titel                                                      | Herausgeber            | URL                                                                                                                                                                                                                                   | Fach             | Schulform      | Kl.  | Version/Datum   | Lizenz                    | Status    |
| ------- | ---------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------- | ---- | --------------- | ------------------------- | --------- |
| src-001 | Fachlehrplan Sekundarschule — Deutsch                      | MB LSA                 | [PDF](https://www.bildung-lsa.de/pool/RRL_Lehrplaene/Endfassungen/lp_sks_deutsch.pdf)                                                                                                                                                 | Deutsch          | Sekundarschule | 5–10 | 2012, Anp. 2019 | unverifiziert             | candidate |
| src-002 | Fachlehrplan Grundschule — Deutsch                         | MB LSA                 | [PDF](https://www.bildung-lsa.de/files/7c5f6ff122fa27b7eb9822ab54ee6396/lp_gs_deutsch_01_08_2019.pdf)                                                                                                                                 | Deutsch          | Grundschule    | 1–4  | 2007, Anp. 2019 | unverifiziert             | candidate |
| src-003 | Fachlehrplan Grundschule — Ev. Religionsunterricht         | MB LSA                 | [PDF](https://www.bildung-lsa.de/files/7c5f6ff122fa27b7eb9822ab54ee6396/lp_gs_evrel_01_08_2019.pdf)                                                                                                                                   | Religion ev.     | Grundschule    | 1–4  | 2007, Anp. 2019 | unverifiziert             | candidate |
| src-004 | RRL Gymnasium — Ev. Religionsunterricht (5–12)             | KM LSA                 | [PDF](https://www.bildung-lsa.de/pool/RRL_Lehrplaene/evrelgyma.pdf)                                                                                                                                                                   | Religion ev.     | Gymnasium      | 5–12 | 1999, Anp. 2003 | unverifiziert             | candidate |
| src-005 | RdErl. Lehrpläne/Rahmenrichtlinien ab 2025/2026            | MB LSA                 | [PDF](https://mb.sachsen-anhalt.de/fileadmin/Bibliothek/Landesjournal/Bildung_und_Wissenschaft/Erlasse/Lehrpl%C3%A4ne__Rahmenrichtlinien_f%C3%BCr_den_Unterricht_der_allgemeinbildenden_und_berufsbildenden_Schulen_ab_2025_2026.pdf) | Meta             | alle           | alle | 18.7.2025       | unverifiziert             | candidate |
| src-006 | LISA — Anhörungsverfahren/Erprobung                        | LISA                   | [Web](https://lisa.sachsen-anhalt.de/schulqualitaet/lehrplaene-rahmenrichtlinien/anhoerungsverfahren-erprobung)                                                                                                                       | Meta             | alle           | alle | 2026            | unverifiziert             | candidate |
| src-007 | LISA — FB Schul- und Unterrichtsentwicklung                | LISA                   | [Web](https://lisa.sachsen-anhalt.de/institut/organisation/fb-schul-und-unterrichtungsentwicklung)                                                                                                                                    | Meta             | alle           | alle | 2026            | unverifiziert             | candidate |
| src-008 | Planungsbeispiel Religion 5–10 (offene Gesellschaft LSA)   | LISA                   | [PDF](https://www.bildung-lsa.de/files/9416c87542aa9f9c8a5b62d195f5755a/PB_RU_5_10_Religion.pdf)                                                                                                                                      | Religion ev.     | Sekundarschule | 5–10 | LISA            | unverifiziert             | candidate |
| src-009 | Flyer Ethik/Religion — Fachauswahl                         | LISA                   | [PDF](https://www.bildung-lsa.de/files/ed380f5cdc850bd235815600fd99a2b4/Flyer_Ethik_Religion_6s_DRUCK.pdf)                                                                                                                            | Ethik            | alle           | alle | 2022            | unverifiziert             | candidate |
| src-010 | Fachlehrplan Gymnasium — Wirtschaftslehre                  | MB LSA                 | [PDF](https://lisa.sachsen-anhalt.de/fileadmin/Bibliothek/Politik_und_Verwaltung/MK/LISA/Unterricht/Lehrplaene/Gym/FLP_Wirtschaftslehre_010824_LTd.pdf)                                                                               | Wirtschaft       | Gymnasium      | 9–12 | 2017, Anp. 2024 | unverifiziert             | candidate |
| src-011 | LISA Information 02/2022 — Bildungsstandards Bio/Chem/Phys | LISA                   | [PDF](https://lisa.sachsen-anhalt.de/fileadmin/Bibliothek/Politik_und_Verwaltung/MK/LISA/Unterricht/Lehrplaene/Gym/Anpassung_2022/LISA_Pub_02-2022_Was_ist_neu_Biologie__Chemie__Physik.pdf)                                          | Meta             | Gymnasium      | 5–12 | 2022            | CC BY-NC-SA (Impressum)   | candidate |
| src-012 | Rahmenplan Gymnasium — Lernen in der digitalen Welt        | MB LSA                 | [PDF](https://www.bildung-lsa.de/files/b45de329c361a40a2f0a7211902d5815/RPL_LeDiWe_Gym_St01082023.pdf)                                                                                                                                | Digitale Bildung | Gymnasium      | 5–8  | ab 1.8.2023     | unverifiziert             | candidate |
| src-013 | Landeskonzept Bildung in der digitalen Welt (LSA)          | MB LSA                 | [PDF](https://www.bildung-lsa.de/files/87532f5391d20fb29d9ac147a6267312/Landeskonzept_LSA_2017.pdf)                                                                                                                                   | Digitale Bildung | alle           | alle | 1.6.2017        | unverifiziert             | candidate |
| src-014 | Schulgesetz LSA — Neufassung 2018                          | MB LSA (GVBl. 17/2018) | [PDF](https://www.begabungslotse.de/cms-assets/files/GVBl_Nr.17_Schulgesetz_Fassung2018.pdf)                                                                                                                                          | Recht            | alle           | alle | 9.8.2018        | rechtsverbindlich (GVBl.) | candidate |
| src-015 | DSAG LSA (DS-GVO-Ausfüllungsgesetz)                        | Landtag LSA            | [PDF](https://www.landtag.sachsen-anhalt.de/fileadmin/Downloads/Rechtsgrundlagen/Gesetze_8.WP/20240229_Datenschutzgrundverordnungsausfuellungsgesetz-DSAG-LSA2_Online.pdf)                                                            | Datenschutz      | alle           | alle | 2020, Anp. 2023 | rechtsverbindlich         | candidate |
| src-016 | Infopaket Schule und Kita (Datenschutz)                    | LfD LSA                | [Web](https://datenschutz.sachsen-anhalt.de/informationen/infopakete/infopaket-schule-und-kita)                                                                                                                                       | Datenschutz      | alle           | alle | 2026            | unverifiziert             | candidate |
| src-017 | Standard-Datenschutzmodell (SDM) V2.0a                     | DSK                    | [Web](https://datenschutz.sachsen-anhalt.de/informationen/hinweise/standard-datenschutzmodell-sdm)                                                                                                                                    | Datenschutz      | alle           | alle | 6.11.2019       | unverifiziert             | candidate |
| src-018 | Datenschutz an Schulen — FAQ (Landesschulamt)              | Landesschulamt LSA     | [Web](https://landesschulamt.sachsen-anhalt.de/service/datenschutz-an-schulen)                                                                                                                                                        | Datenschutz      | alle           | alle | 2026            | unverifiziert             | candidate |
| src-019 | Schulbuchverzeichnis LSA 2026/2027                         | LISA                   | [PDF](https://www.bildung-lsa.de/files/74ce365e88f07e43ce9a1b7aaf384d61/Schulbuchverzeichnis_2026_27_Neu.pdf)                                                                                                                         | Meta             | alle           | 1–10 | 13.3.2026       | unverifiziert             | candidate |
| src-020 | RdErl. Aufnahme an weiterführende Schulen                  | MB LSA                 | [PDF](https://www.gs-spiegel.bildung-lsa.de/dat/cms1001238/images/Dokumente/aufnahme_an_weiterfuehrenden_schulen.pdf)                                                                                                                 | Meta             | alle           | 4–5  | 2014, Anp. 2024 | unverifiziert             | candidate |
| src-021 | LISA — Projekte/Pädagogische Entwicklungsvorhaben          | LISA                   | [Web](https://lisa.sachsen-anhalt.de/schulqualitaet/projekte-paedagogische-entwicklungsvorhaben)                                                                                                                                      | Meta             | alle           | alle | 2026            | unverifiziert             | candidate |

## Bekannte Lücken (Maintainer-Issues)

Die folgenden Quellen konnten via `web_search`/`web_fetch` am 2026-06-22 nicht
zuverlässig als direktes PDF abgerufen werden und sind in dieser Kandidatenliste
noch **nicht** enthalten. Sie müssen vor Ingestion separat beschafft und als
eigene Einträge (`src-022`+) aufgenommen werden:

- **Katholischer Religionsunterricht**: Fachlehrpläne Grundschule und Sekundarschule/Gymnasium
  (Bildungsserver-Informationsportal lieferte binären Content; direkte PDF-URLs verifizieren).
- **Ethikunterricht**: Fachlehrpläne Grundschule/Sekundarschule/Gymnasium.
- **Gymnasium Religion ev. neue Fassung ab 1.8.2022** (gemäß RdErl src-005): direktes PDF
  verifizieren und ggf. src-004 ersetzen/ergänzen.
- **Gymnasium Deutsch** Fachlehrplan (neue Fassung ab 1.8.2022): verifizieren.

Diese Lücken werden in [`docs/decisions/OPEN_QUESTIONS.md`](../decisions/OPEN_QUESTIONS.md)
referenziert und sind im Rahmen von Roadmap-Issue #6 „Initiale offizielle Quellenregistry
für Deutsch und Religion LSA erstellen" zu schließen.

## Verwandte Dokumente

- [`INGESTION_POLICY.md`](./INGESTION_POLICY.md) — Freigabegate, nur ab `APPROVED`
- [`CITATION_STANDARD.md`](./CITATION_STANDARD.md) — Pflichtfelder pro Aussage
- [`EVALUATION_PLAN.md`](./EVALUATION_PLAN.md) — Golden Questions, Drift
- [`../architecture/RAG_ARCHITECTURE.md`](../architecture/RAG_ARCHITECTURE.md) — Lebenszyklus
- [`../adr/0003-source-governance-before-ingestion.md`](../adr/0003-source-governance-before-ingestion.md) — Source-Governance
- [`../decisions/OPEN_QUESTIONS.md`](../decisions/OPEN_QUESTIONS.md) — offene Quellen-/Versionsfragen
