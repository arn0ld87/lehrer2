/**
 * CloudProvider — Cloud-LLM-Anbindung (OpenAI-kompatibel + Anthropic)
 *
 * DATENSCHUTZ-GATE: Diese Klasse DARF NICHT direkt über createLLMProvider()
 * verwendet werden. Sie wird von der Privacy-Pipeline in Phase 2 umhüllt
 * (CloudReleaseGrant-Check, Pseudonymisierung, PII-Guard-Assertion).
 *
 * Kein @anthropic-ai/sdk oder openai SDK — reines fetch, kein neues npm-Paket.
 *
 * Env-Variablen (alle ohne Default — fehlen sie, bleibt der Pfad deaktiviert):
 *   CLOUD_LLM_ENABLED        — "true" schaltet Cloud-Pfad frei; Default: "false"
 *   OPENAI_API_KEY           — Bearer-Token für OpenAI-kompatible Endpoints
 *   OPENAI_BASE_URL          — z.B. https://api.openai.com oder lokale vLLM-URL
 *   OPENAI_CHAT_MODEL        — z.B. "gpt-4o-mini"
 *   ANTHROPIC_API_KEY        — Bearer-Token für Anthropic Messages API
 */

import { type CallContext, type JSONSchema, type LLMProvider, StructuredParseError } from "./provider";
import { stripJsonFences } from "./json-extract";

export type CloudProviderKind = "openai-compat" | "anthropic";

interface CloudProviderConfig {
  kind: CloudProviderKind;
  /** Für openai-compat: Basis-URL des Endpoints */
  baseUrl?: string;
  /** Für openai-compat: API-Key */
  apiKey?: string;
  /** Modell-ID */
  model?: string;
}

// ── OpenAI-kompatible API-Typen ───────────────────────────────────────────────

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      schema: JSONSchema;
      strict?: boolean;
    };
  };
}

interface OpenAIChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ── Anthropic Messages API-Typen ──────────────────────────────────────────────

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
}

interface AnthropicResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

// ── CloudProvider ─────────────────────────────────────────────────────────────

export class CloudProvider implements LLMProvider {
  private kind: CloudProviderKind;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(config: CloudProviderConfig) {
    this.kind = config.kind;

    if (config.kind === "anthropic") {
      // Anthropic-Pfad: nur mit explizitem ANTHROPIC_API_KEY; per Default OFF
      this.baseUrl = "https://api.anthropic.com";
      this.apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
      // TODO(Phase-2): Modell-ID via CloudReleaseGrant konfigurieren; hier Platzhalter
      this.model = config.model ?? "claude-opus-4-8";
    } else {
      // openai-compat: vLLM, llama.cpp, openai.com — alle über dieselbe REST-API
      this.baseUrl = config.baseUrl ?? process.env.OPENAI_BASE_URL ?? "";
      this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? "";
      this.model = config.model ?? process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
    }
  }

  /**
   * Prüft, ob CLOUD_LLM_ENABLED=true gesetzt ist.
   * Wird geworfen, bevor ein echter HTTP-Call stattfindet — fail-closed.
   */
  private assertCloudEnabled(): void {
    const enabled = process.env.CLOUD_LLM_ENABLED === "true";
    if (!enabled) {
      throw new Error(
        "CloudProvider: Cloud-LLM ist deaktiviert (CLOUD_LLM_ENABLED != 'true'). " +
          "Aktivierung erfordert dokumentierten CloudReleaseGrant (ADR 0002).",
      );
    }
    if (!this.apiKey) {
      const keyVar = this.kind === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
      throw new Error(`CloudProvider: ${keyVar} ist nicht gesetzt.`);
    }
    if (this.kind === "openai-compat" && !this.baseUrl) {
      throw new Error("CloudProvider: OPENAI_BASE_URL ist nicht gesetzt.");
    }
  }

  async call(prompt: string, context?: CallContext): Promise<string> {
    this.assertCloudEnabled();

    if (this.kind === "anthropic") {
      return this.callAnthropic(prompt, context);
    }
    return this.callOpenAICompat(prompt, undefined, context);
  }

  async callStructured<T>(
    prompt: string,
    schema: JSONSchema,
    context?: CallContext,
  ): Promise<T> {
    this.assertCloudEnabled();

    let raw: string;
    if (this.kind === "anthropic") {
      // TODO(Phase-2): Anthropic structured output via tool_use; für jetzt
      // als plain JSON-Prompt abwickeln — fragiler als OpenAI response_format.
      // Anthropic-Pfad ist per Default OFF; dieser Zweig nur nach CloudReleaseGrant.
      raw = await this.callAnthropic(
        `${prompt}\n\nAntworte ausschließlich mit validem JSON, das dem folgenden Schema entspricht:\n${JSON.stringify(schema)}`,
        context,
      );
    } else {
      raw = await this.callOpenAICompat(prompt, schema, context);
    }

    try {
      // Manche Cloud-Modelle (gpt-oss) verpacken JSON in Markdown-Fences trotz
      // response_format → vor dem Parsen entfernen (sonst fail-closed 0 Ergebnisse).
      return JSON.parse(stripJsonFences(raw)) as T;
    } catch {
      throw new StructuredParseError(
        `CloudProvider(${this.kind}): JSON.parse fehlgeschlagen (${String(raw).slice(0, 120)})`,
        raw,
      );
    }
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // ── Private Hilfsmethoden ─────────────────────────────────────────────────

  private async callOpenAICompat(
    prompt: string,
    schema: JSONSchema | undefined,
    context?: CallContext,
  ): Promise<string> {
    const body: OpenAIChatRequest = {
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      ...(context?.maxTokens ? { max_tokens: context.maxTokens } : {}),
      ...(schema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: { name: "structured_output", schema, strict: true },
            },
          }
        : {}),
    };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `CloudProvider(openai-compat) chat failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as OpenAIChatResponse;
    return data.choices[0].message.content;
  }

  private async callAnthropic(prompt: string, context?: CallContext): Promise<string> {
    // HINWEIS: Anthropic-Pfad ist per Default OFF (CLOUD_LLM_ENABLED=false,
    // zusätzlich provider==='anthropic' muss explizit gewählt werden).
    // TODO(Phase-2): Anthropic-AVV, DSFA, CloudReleaseGrant vor Aktivierung.
    const body: AnthropicRequest = {
      model: this.model,
      max_tokens: context?.maxTokens ?? 4096,
      messages: [{ role: "user", content: prompt }],
    };

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `CloudProvider(anthropic) messages failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as AnthropicResponse;

    // Bounds-guard (Phase-2 hardening): content kann leer oder fehlen —
    // TypeError wäre unklar; StructuredParseError macht den Fehlerort eindeutig.
    if (!data.content || data.content.length === 0 || !data.content[0]) {
      throw new StructuredParseError(
        "CloudProvider(anthropic): Antwort enthält kein content-Element.",
        JSON.stringify(data),
      );
    }

    return data.content[0].text;
  }
}

/**
 * Hilfsfunktion für Phase-2-Gate: instanziiert einen CloudProvider.
 * Wird NICHT von createLLMProvider() aufgerufen — nur vom Privacy-Gate.
 */
export function createCloudProvider(
  kind: CloudProviderKind,
  config?: Partial<CloudProviderConfig>,
): CloudProvider {
  return new CloudProvider({ kind, ...config });
}
