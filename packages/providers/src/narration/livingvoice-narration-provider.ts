import type { GeneratedArtifact, TtsCapability } from "@livingcourse/generation";

export interface LivingVoiceNarrationProviderConfig {
  /** Base URL of the LivingVoice server, e.g. http://127.0.0.1:4310 */
  baseUrl: string;
  /** Optional bearer token for deployments that front LivingVoice with one. */
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class LivingVoiceNarrationError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, message: string, status: number | null = null) {
    super(message);
    this.name = "LivingVoiceNarrationError";
    this.code = code;
    this.status = status;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Provider-neutral narration adapter: the only LivingCourse-side component
 * that speaks to LivingVoice over HTTP.
 *
 * Boundary (v0.1.1 production closure): LivingCourse sends exactly
 * `voice_config_id + text` and receives WAV bytes. It never sees provider
 * endpoints, models, or credentials — those live behind the LivingVoice API
 * and its VoiceConfig pinning.
 *
 * Wire usage of the LivingVoice API:
 *   GET  {base}/v1/voice-configs/{voiceConfigId}  → must be 200 (pinned config exists)
 *   POST {base}/v1/speech  { voice_config_id, text } → { audio_url, generation_id }
 *   GET  {base}{audio_url}                        → audio/wav bytes
 */
export class LivingVoiceNarrationProvider implements TtsCapability {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(config: LivingVoiceNarrationProviderConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/u, "");
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /** Verify the pinned voice config exists before a build starts. */
  async verifyVoiceConfig(voiceConfigId: string): Promise<void> {
    const response = await this.request("GET", `/v1/voice-configs/${encodeURIComponent(voiceConfigId)}`);
    if (response.status === 404) {
      throw new LivingVoiceNarrationError(
        "LC-NARRATION-001",
        `LivingVoice voice config '${voiceConfigId}' does not exist.`
      );
    }
    if (!response.ok) {
      throw new LivingVoiceNarrationError(
        "LC-NARRATION-002",
        `LivingVoice returned ${response.status} for voice config '${voiceConfigId}'.`,
        response.status
      );
    }
  }

  async synthesize(input: { text: string; language: string; voiceProfile: string }): Promise<GeneratedArtifact> {
    if (input.text.trim().length === 0) {
      throw new LivingVoiceNarrationError("LC-NARRATION-003", "Narration script is empty.");
    }
    await this.verifyVoiceConfig(input.voiceProfile);

    const speechResponse = await this.request("POST", "/v1/speech", {
      voice_config_id: input.voiceProfile,
      text: input.text
    });
    if (!speechResponse.ok) {
      throw new LivingVoiceNarrationError(
        "LC-NARRATION-002",
        `LivingVoice speech generation failed with ${speechResponse.status}.`,
        speechResponse.status
      );
    }
    let speech: { audio_url?: unknown; generation_id?: unknown };
    try {
      speech = (await speechResponse.json()) as typeof speech;
    } catch {
      throw new LivingVoiceNarrationError("LC-NARRATION-002", "LivingVoice returned a non-JSON speech response.");
    }
    const audioUrl = typeof speech.audio_url === "string" ? speech.audio_url : null;
    if (audioUrl === null || audioUrl.length === 0) {
      throw new LivingVoiceNarrationError("LC-NARRATION-002", "LivingVoice speech response has no audio_url.");
    }
    const generationId = typeof speech.generation_id === "string" ? speech.generation_id : null;

    const audioResponse = await this.request("GET", audioUrl);
    if (!audioResponse.ok) {
      throw new LivingVoiceNarrationError(
        "LC-NARRATION-002",
        `Downloading generated narration failed with ${audioResponse.status}.`
      );
    }
    const bytes = new Uint8Array(await audioResponse.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new LivingVoiceNarrationError("LC-NARRATION-002", "LivingVoice returned empty narration audio.");
    }
    return {
      bytes,
      mediaType: "audio/wav",
      provenance: {
        provider: "livingvoice",
        model: `voice-config:${input.voiceProfile}`,
        promptTemplateVersion: "none",
        profileVersion: input.voiceProfile
      },
      providerMetadata: {
        voice_config_id: input.voiceProfile,
        language: input.language,
        ...(generationId !== null ? { generation_id: generationId } : {})
      }
    };
  }

  private async request(method: string, path: string, payload?: Record<string, unknown>): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey !== undefined && this.apiKey.length > 0) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }
      let body: string | undefined;
      if (payload !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(payload);
      }
      return await this.fetchImpl(path.startsWith("http") ? path : `${this.baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
        signal: controller.signal
      });
    } catch (error) {
      throw new LivingVoiceNarrationError(
        "LC-NARRATION-004",
        `LivingVoice server could not be reached (${error instanceof Error ? error.message : String(error)}).`
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
