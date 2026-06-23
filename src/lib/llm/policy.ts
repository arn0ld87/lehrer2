/**
 * ProviderPolicyGate — wählt den LLM-Provider nach dataClass und CloudReleaseGrant.
 *
 * Fail-closed: Ist keine valide Freigabe vorhanden, wird ein Cloud-Provider
 * NIEMALS aufgerufen. Default ist immer der lokale Ollama-Provider.
 *
 * Invarianten (ADR 0002 §92, REDACTION_AND_GUARD_SPEC.md §4.2):
 * 1. PUBLIC → alle Provider erlaubt (Cloud ohne Grant-Prüfung).
 * 2. INTERNAL → nur lokale Provider (requiresCloudGrant === false).
 * 3. PERSONAL_TEACHER → nur lokale Provider.
 * 4. SENSITIVE_STUDENT → Cloud-Provider nur mit gültigem CloudReleaseGrant (Scope deckt
 *    subject UND gradeBand ab); wird ein Cloud-Provider ohne gültigen Grant angefragt →
 *    PolicyViolationError (fail-closed). Lokaler Provider ist Default, sobald kein
 *    Cloud-Provider angefragt wird. Cloud-Calls immer nur mit pseudonymisierten Daten.
 */

import type { LLMProvider, RequestContext } from "./provider";

// ─── CloudReleaseGrant-Lookup-Interface (injiziert, kein direkter DB-Import) ──

export interface GrantScope {
  subjects: string[];
  gradeBands: string[];
}

export interface CloudReleaseGrantRecord {
  id: string;
  schoolId: string;
  provider: string;
  region: string;
  avvStatus: "signed" | "pending";
  scope: GrantScope;
  validFrom: Date;
  validUntil: Date;
}

/**
 * Injiziertes Interface für Grant-Lookup.
 * Produktiv-Implementierung liest aus PostgreSQL; Tests nutzen FakeGrantRepository.
 */
export interface GrantRepository {
  /**
   * Sucht einen aktiven (nicht abgelaufenen, AVV signed) CloudReleaseGrant.
   * Gibt null zurück, wenn kein passender Grant existiert.
   */
  findActive(params: {
    schoolId: string;
    provider: string;
    subject?: string;
    gradeBand?: string;
    now: Date;
  }): Promise<CloudReleaseGrantRecord | null>;
}

// ─── Policy-Fehler ────────────────────────────────────────────────────────────

export class PolicyViolationError extends Error {
  constructor(
    message: string,
    public readonly dataClass: string,
    public readonly requestedProvider: string,
  ) {
    super(message);
    this.name = "PolicyViolationError";
  }
}

// ─── ProviderPolicyGate ───────────────────────────────────────────────────────

export interface PolicyGateOptions {
  /** Schul-ID für Grant-Lookup (SENSITIVE_STUDENT + Cloud) */
  schoolId?: string;
}

export class ProviderPolicyGate {
  constructor(
    private readonly localProvider: LLMProvider,
    private readonly cloudProviders: Map<string, LLMProvider>,
    private readonly grantRepo: GrantRepository,
  ) {}

  /**
   * Wählt den korrekten Provider für den gegebenen Kontext.
   *
   * - PUBLIC: gewünschter Cloud-Provider falls vorhanden, sonst lokal.
   * - INTERNAL / PERSONAL_TEACHER: immer lokal (requiresCloudGrant === false).
   * - SENSITIVE_STUDENT: Cloud nur mit gültigem Grant (subject + gradeBand im Scope);
   *   ohne Grant → PolicyViolationError (fail-closed). Default bleibt lokal.
   *
   * @param requestedProviderId  Gewünschter Provider (z.B. "openai", "ollama")
   * @param context              RequestContext aus dem LLM-Call
   * @param opts                 schoolId für Grant-Lookup
   */
  async selectProvider(
    requestedProviderId: string,
    context: RequestContext,
    opts: PolicyGateOptions = {},
  ): Promise<LLMProvider> {
    const { dataClass } = context;

    // Lokaler Provider ist immer der Fallback
    if (requestedProviderId === this.localProvider.id || !this.cloudProviders.has(requestedProviderId)) {
      return this.localProvider;
    }

    const cloudProvider = this.cloudProviders.get(requestedProviderId)!;

    switch (dataClass) {
      case "PUBLIC":
        // Kein Grant nötig für öffentliche Daten
        return cloudProvider;

      case "INTERNAL":
      case "PERSONAL_TEACHER":
        // Strikt lokal — Cloud immer abgelehnt
        throw new PolicyViolationError(
          `dataClass ${dataClass} erlaubt keinen Cloud-Provider. Nur lokale Provider zulässig.`,
          dataClass,
          requestedProviderId,
        );

      case "SENSITIVE_STUDENT": {
        // Muss gültigen Grant haben
        if (!opts.schoolId) {
          throw new PolicyViolationError(
            `SENSITIVE_STUDENT-Call ohne schoolId — fail-closed. Kein Cloud-Call möglich.`,
            dataClass,
            requestedProviderId,
          );
        }

        const grant = await this.grantRepo.findActive({
          schoolId: opts.schoolId,
          provider: requestedProviderId,
          subject: context.subject,
          gradeBand: context.gradeBand,
          now: new Date(),
        });

        if (!grant) {
          throw new PolicyViolationError(
            `Kein gültiger CloudReleaseGrant für Provider "${requestedProviderId}" / ` +
              `Schule "${opts.schoolId}". Fail-closed: Cloud-Call abgelehnt.`,
            dataClass,
            requestedProviderId,
          );
        }

        // Grant vorhanden und gültig → Cloud erlaubt (Daten müssen pseudonymisiert sein)
        return cloudProvider;
      }

      default: {
        // Unbekannte dataClass → fail-closed
        const exhaustive: never = dataClass;
        throw new PolicyViolationError(
          `Unbekannte dataClass "${exhaustive}" — fail-closed.`,
          String(exhaustive),
          requestedProviderId,
        );
      }
    }
  }
}

// ─── FakeGrantRepository (Tests) ──────────────────────────────────────────────

/**
 * Test-Implementierung: gibt konfigurierten Grant zurück oder null.
 */
export class FakeGrantRepository implements GrantRepository {
  constructor(private readonly grant: CloudReleaseGrantRecord | null = null) {}

  async findActive(params: {
    schoolId: string;
    provider: string;
    subject?: string;
    gradeBand?: string;
    now: Date;
  }): Promise<CloudReleaseGrantRecord | null> {
    if (!this.grant) return null;
    if (this.grant.schoolId !== params.schoolId) return null;
    if (this.grant.provider !== params.provider) return null;
    if (this.grant.avvStatus !== "signed") return null;
    if (params.now < this.grant.validFrom || params.now > this.grant.validUntil) return null;

    // Scope-Prüfung: subject muss im Grant-Scope liegen (wenn angegeben)
    if (
      params.subject &&
      this.grant.scope.subjects.length > 0 &&
      !this.grant.scope.subjects.includes(params.subject)
    ) {
      return null;
    }

    // Scope-Prüfung: gradeBand muss im Grant-Scope liegen (wenn angegeben) — fail-closed,
    // verhindert Nutzung eines KS9-Grants für KS10 etc.
    if (
      params.gradeBand &&
      this.grant.scope.gradeBands.length > 0 &&
      !this.grant.scope.gradeBands.includes(params.gradeBand)
    ) {
      return null;
    }

    return this.grant;
  }
}
