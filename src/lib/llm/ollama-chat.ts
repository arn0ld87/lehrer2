/**
 * OllamaChatProvider — lokale LLM-Anbindung über Ollama Chat-API
 *
 * Spiegelt exakt das Fetch-Idiom von OllamaEmbedder (src/lib/infra/ollama.ts):
 * POST, Content-Type: application/json, throw on !response.ok, kein SDK.
 *
 * Env-Variablen:
 *   OLLAMA_BASE_URL       — Default: http://localhost:11434
 *   OLLAMA_CHAT_MODEL     — Default: qwen2.5:14b
 */

import { type CallContext, type JSONSchema, type LLMProvider, StructuredParseError } from "./provider";
import { stripJsonFences } from "./json-extract";

interface OllamaChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: false;
  format?: JSONSchema;
}

interface OllamaChatResponse {
  message: {
    role: string;
    content: string;
  };
}

export class OllamaChatProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    this.model = model ?? process.env.OLLAMA_CHAT_MODEL ?? "qwen2.5:14b";
  }

  async call(prompt: string, _context?: CallContext): Promise<string> {
    const body: OllamaChatRequest = {
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat failed: ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    return data.message.content;
  }

  async callStructured<T>(prompt: string, schema: JSONSchema, _context?: CallContext): Promise<T> {
    const body: OllamaChatRequest = {
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      format: schema,
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat (structured) failed: ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const raw = data.message.content;

    try {
      // Markdown-Fences entfernen (Modelle verpacken JSON trotz format-Vorgabe).
      return JSON.parse(stripJsonFences(raw)) as T;
    } catch {
      // FAIL-CLOSED: nie ein Objekt erfinden, immer werfen
      throw new StructuredParseError(
        `OllamaChatProvider: JSON.parse fehlgeschlagen (${String(raw).slice(0, 120)})`,
        raw,
      );
    }
  }

  estimateTokens(text: string): number {
    // Heuristik: ~4 Zeichen pro Token (gängige Daumenregel für westeuropäische Sprachen)
    return Math.ceil(text.length / 4);
  }
}
