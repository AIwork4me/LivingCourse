import { LivingVoiceNarrationProvider } from "@livingcourse/providers";
import type { TtsCapability } from "@livingcourse/generation";

export class NarrationConfigurationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "NarrationConfigurationError";
    this.code = code;
  }
}

export interface ResolvedNarrationProvider {
  enabled: boolean;
  /** Present only when enabled; a LivingVoice HTTP narration adapter. */
  narration: TtsCapability | null;
  detail: string;
}

const configuredValue = (name: string): string | null => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

/**
 * Narration provider resolution (v0.1.1 production closure).
 *
 * Mirrors `resolveSemanticCapabilitiesFromEnv`: environment names stay in
 * workflow; core, compiler and renderers never see them. When
 * LIVINGCOURSE_NARRATION_BASE_URL points at a LivingVoice server, builds may
 * regenerate missing narration audio through the pinned voice config
 * (`slide.narration.voiceProfile` = LivingVoice `voice_config_id`).
 * Without the variable, builds keep the existing behavior: missing audio is
 * a hard LC-PROVIDER-001 blocker.
 */
export const resolveNarrationProviderFromEnv = (): ResolvedNarrationProvider => {
  const baseUrl = configuredValue("LIVINGCOURSE_NARRATION_BASE_URL");
  if (baseUrl === null) {
    return {
      enabled: false,
      narration: null,
      detail: "LIVINGCOURSE_NARRATION_BASE_URL is not set; narration audio must be approved on disk."
    };
  }
  const timeoutValue = configuredValue("LIVINGCOURSE_NARRATION_TIMEOUT_MS");
  const timeoutMs = timeoutValue === null ? 120_000 : Number(timeoutValue);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new NarrationConfigurationError("LC-NARRATION-CONFIG-001", "LIVINGCOURSE_NARRATION_TIMEOUT_MS must be a positive integer.");
  }
  const apiKey = configuredValue("LIVINGCOURSE_NARRATION_API_KEY");
  return {
    enabled: true,
    narration: new LivingVoiceNarrationProvider({
      baseUrl,
      ...(apiKey !== null ? { apiKey } : {}),
      timeoutMs
    }),
    detail: `LivingVoice narration at ${baseUrl} (voice configs are pinned per slide via narration.voiceProfile).`
  };
};
