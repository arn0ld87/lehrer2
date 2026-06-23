/**
 * LLM-Provider-Abstraktion (ADR 0002 §66)
 *
 * Alle LLM-Calls laufen über dieses Interface — nie direkt an Provider-APIs.
 * Redaction und Guard-Assertion müssen VOR chat() ausgeführt werden (policy.ts).
 */

// ─── Request / Response-Typen ─────────────────────────────────────────────────

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Kontext, der jeden LLM-Call begleitet (Audit-Trail, Policy-Gate).
 * dataClass steuert, welche Provider zulässig sind (ADR 0002 §92).
 */
export interface RequestContext {
  userId: string;
  userRole: "teacher" | "admin";
  /** Klassifikation der übergebenen Daten — bestimmt Provider-Policy */
  dataClass: "PUBLIC" | "INTERNAL" | "PERSONAL_TEACHER" | "SENSITIVE_STUDENT";
  /** Optionale Schüler-IDs für Audit-Trail; Klarnamen dürfen hier NICHT erscheinen */
  studentIds?: string[];
  /** Fachkontext für CloudReleaseGrant-Scope-Prüfung */
  subject?: string;
  /** Klassenstufen-Kontext für CloudReleaseGrant-Scope-Prüfung */
  gradeBand?: string;
}

export interface ChatParams {
  model?: string;
  messages: Message[];
  context: RequestContext;
  /** Optionale RAG-Kontextchunks (bereits redacted) */
  contextChunks?: string[];
  /** Bevorzugtes Modell (Hint, Provider kann abweichen) */
  modelHint?: string;
  system?: string;
}

export interface ChatResponse {
  text: string;
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface EmbedParams {
  texts: string[];
  model?: string;
}

// ─── LLMProvider Interface (ADR 0002 §66) ─────────────────────────────────────

export interface LLMProvider {
  /** Eindeutige Provider-ID: "ollama" | "openai" | "anthropic" */
  readonly id: string;
  /** Verfügbare Modell-IDs dieses Providers */
  readonly models: string[];
  /** true => CloudReleaseGrant muss vor jedem Call validiert sein */
  readonly requiresCloudGrant: boolean;

  chat(params: ChatParams): Promise<ChatResponse>;
  embed(params: EmbedParams): Promise<number[][]>;
}

// ─── OllamaProvider ───────────────────────────────────────────────────────────

interface OllamaGenerateResponse {
  response: string;
  model: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Lokaler Default-Provider via Ollama (OpenAI-kompatibler HTTP-Endpunkt).
 * Sendet NIEMALS Daten an externe Server — local-first (ADR 0004).
 */
export class OllamaProvider implements LLMProvider {
  readonly id = "ollama";
  readonly requiresCloudGrant = false;

  private baseUrl: string;
  private defaultModel: string;

  get models(): string[] {
    return [this.defaultModel];
  }

  constructor(baseUrl?: string, defaultModel?: string) {
    this.baseUrl = baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    this.defaultModel =
      defaultModel ?? process.env.OLLAMA_CHAT_MODEL ?? "llama3.2:3b";
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const model = params.modelHint ?? params.model ?? this.defaultModel;

    // Nachrichten zu einem Prompt zusammenführen (Ollama /api/generate)
    const systemMsg = params.system
      ? params.system
      : params.messages.find((m) => m.role === "system")?.content;

    const userMessages = params.messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const contextBlock =
      params.contextChunks && params.contextChunks.length > 0
        ? `\n\nKontext:\n${params.contextChunks.join("\n---\n")}`
        : "";

    const prompt = `${userMessages}${contextBlock}`;

    const body: Record<string, unknown> = {
      model,
      prompt,
      stream: false,
    };
    if (systemMsg) body.system = systemMsg;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat fehlgeschlagen: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    return {
      text: data.response,
      model: data.model,
      provider: this.id,
      promptTokens: data.prompt_eval_count,
      completionTokens: data.eval_count,
    };
  }

  async embed(params: EmbedParams): Promise<number[][]> {
    const model =
      params.model ?? process.env.OLLAMA_EMBEDDING_MODEL ?? "qwen3-embedding:4b";
    const results: number[][] = [];

    for (const text of params.texts) {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embed fehlgeschlagen: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { embedding: number[] };
      results.push(data.embedding);
    }

    return results;
  }
}

// ─── FakeLlmProvider (Tests) ──────────────────────────────────────────────────

/**
 * Deterministischer Fake-Provider für Unit-Tests.
 * Echo-basiert: gibt den letzten User-Message-Inhalt zurück (prefixed).
 * Kein Netzwerk-I/O.
 */
export class FakeLlmProvider implements LLMProvider {
  readonly id = "fake";
  readonly models = ["fake-model"];
  readonly requiresCloudGrant = false;

  /** Gespeicherte Calls für Assertions in Tests */
  readonly calls: ChatParams[] = [];

  /** Optionale feste Antwort; sonst Echo */
  constructor(private readonly fixedReply?: string) {}

  async chat(params: ChatParams): Promise<ChatResponse> {
    this.calls.push(params);

    const lastUser = [...params.messages]
      .reverse()
      .find((m) => m.role === "user")?.content ?? "";

    const text = this.fixedReply ?? `[FAKE] ${lastUser}`;

    return {
      text,
      model: "fake-model",
      provider: this.id,
      promptTokens: lastUser.length,
      completionTokens: text.length,
    };
  }

  async embed(params: EmbedParams): Promise<number[][]> {
    return params.texts.map((t) => {
      // Deterministischer Einheitsvektor aus char-code-Summe
      let hash = 0;
      for (let i = 0; i < t.length; i++) {
        hash = ((hash << 5) - hash) + t.charCodeAt(i);
        hash = hash & hash;
      }
      let seed = Math.abs(hash) || 1;
      const dim = 8;
      const v = Array.from({ length: dim }, () => {
        seed = (seed * 9301 + 49297) % 233280;
        return (seed / 233280) * 2 - 1;
      });
      const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map((x) => x / mag);
    });
  }
}
