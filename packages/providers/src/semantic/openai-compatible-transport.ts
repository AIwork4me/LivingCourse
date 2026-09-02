import {
  DEFAULT_RETRY_POLICY,
  withRetry,
  type RetryPolicy,
  type StructuredGenerationTransport
} from "@livingcourse/generation";

type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type SemanticEndpointClassification = "local" | "remote";

export interface OpenAICompatibleStructuredGenerationTransportOptions {
  baseUrl: string;
  model: string;
  requestTimeoutMs?: number;
  retryPolicy?: RetryPolicy;
  responseFormat?: "json_object" | false;
  fetchImplementation?: FetchImplementation;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}

export class SemanticTransportError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(`${code}: ${message}`);
    this.name = "SemanticTransportError";
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

const rejectUnsafeUrl = (code: string, message: string): never => {
  throw new SemanticTransportError(code, message);
};

export const normalizeOpenAICompatibleBaseUrl = (input: string): string => {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return rejectUnsafeUrl("LC-SEMANTIC-TRANSPORT-001", "base URL is not a valid absolute URL.");
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    return rejectUnsafeUrl("LC-SEMANTIC-TRANSPORT-001", "base URL must use http or https.");
  }
  if (url.username || url.password) {
    return rejectUnsafeUrl("LC-SEMANTIC-TRANSPORT-001", "base URL must not contain credentials.");
  }
  if (url.search || url.hash) {
    return rejectUnsafeUrl("LC-SEMANTIC-TRANSPORT-001", "base URL must not contain a query string or fragment.");
  }
  const pathname = url.pathname.replace(/\/+$/u, "");
  url.pathname = pathname.endsWith("/v1") ? pathname : `${pathname}/v1`;
  return url.toString().replace(/\/$/u, "");
};

export const classifySemanticEndpoint = (baseUrl: string): SemanticEndpointClassification => {
  const url = new URL(normalizeOpenAICompatibleBaseUrl(baseUrl));
  const hostname = url.hostname.toLowerCase();
  return hostname === "localhost" || hostname.startsWith("127.") || hostname === "::1" || hostname === "[::1]" ? "local" : "remote";
};

const safeResponseJson = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const parsed: unknown = await response.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new SemanticTransportError("LC-SEMANTIC-TRANSPORT-005", "endpoint returned malformed JSON.");
  }
};

const contentFromResponse = (payload: Record<string, unknown>): string => {
  if (!Array.isArray(payload.choices) || payload.choices.length === 0) {
    throw new SemanticTransportError("LC-SEMANTIC-TRANSPORT-006", "response did not contain a choices entry.");
  }
  const first = payload.choices[0];
  if (first === null || typeof first !== "object" || Array.isArray(first)) {
    throw new SemanticTransportError("LC-SEMANTIC-TRANSPORT-006", "response choices entry was invalid.");
  }
  const message = (first as Record<string, unknown>).message;
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    throw new SemanticTransportError("LC-SEMANTIC-TRANSPORT-007", "response did not contain message content.");
  }
  const content = (message as Record<string, unknown>).content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new SemanticTransportError("LC-SEMANTIC-TRANSPORT-007", "response message content was empty or invalid.");
  }
  return content;
};

export class OpenAICompatibleStructuredGenerationTransport implements StructuredGenerationTransport {
  readonly normalizedBaseUrl: string;
  readonly endpoint: string;
  readonly model: string;
  readonly endpointClassification: SemanticEndpointClassification;
  private readonly requestTimeoutMs: number;
  private readonly retryPolicy: RetryPolicy;
  private readonly responseFormat: "json_object" | false;
  private readonly fetchImplementation: FetchImplementation;
  private readonly retryDependencies: { sleep?: (milliseconds: number) => Promise<void>; random?: () => number };

  constructor(options: OpenAICompatibleStructuredGenerationTransportOptions) {
    this.normalizedBaseUrl = normalizeOpenAICompatibleBaseUrl(options.baseUrl);
    this.endpoint = `${this.normalizedBaseUrl}/chat/completions`;
    this.endpointClassification = classifySemanticEndpoint(this.normalizedBaseUrl);
    this.model = options.model.trim();
    if (!this.model) throw new SemanticTransportError("LC-SEMANTIC-TRANSPORT-002", "model must not be empty.");
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new SemanticTransportError("LC-SEMANTIC-TRANSPORT-002", "request timeout must be a positive number.");
    }
    this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
    this.responseFormat = options.responseFormat ?? false;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.retryDependencies = {
      ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
      ...(options.random === undefined ? {} : { random: options.random })
    };
  }

  async generate(input: { systemPrompt: string; inputJson: string }): Promise<string> {
    const apiKey = process.env.LIVINGCOURSE_SEMANTIC_API_KEY?.trim();
    if (!apiKey) throw new SemanticTransportError("LC-SEMANTIC-TRANSPORT-002", "semantic API key is not configured.");
    return withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      let response: Response;
      try {
        response = await this.fetchImplementation(this.endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: "system", content: input.systemPrompt },
              { role: "user", content: input.inputJson }
            ],
            temperature: 0,
            ...(this.responseFormat === false ? {} : { response_format: { type: this.responseFormat } })
          }),
          signal: controller.signal
        });
      } catch (error) {
        const timedOut = controller.signal.aborted || (error as Error).name === "AbortError";
        throw new SemanticTransportError(
          "LC-SEMANTIC-TRANSPORT-004",
          timedOut ? "request timed out." : "request failed because of a transient network error.",
          timedOut ? 408 : 503
        );
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        throw new SemanticTransportError("LC-SEMANTIC-TRANSPORT-003", `endpoint returned HTTP ${response.status}.`, response.status);
      }
      return contentFromResponse(await safeResponseJson(response));
    }, this.retryPolicy, this.retryDependencies);
  }
}
