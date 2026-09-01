import type { DocumentInput, DocumentParsingProvider } from "./types.js";

export class DocumentParsingProviderRegistry {
  private readonly providers = new Map<string, DocumentParsingProvider>();

  register(provider: DocumentParsingProvider): void {
    if (this.providers.has(provider.id)) throw new Error(`LC-PARSER-REGISTRY-001: duplicate provider '${provider.id}'.`);
    this.providers.set(provider.id, provider);
  }

  get(id: string): DocumentParsingProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`LC-PARSER-REGISTRY-002: provider '${id}' is not registered.`);
    return provider;
  }

  resolve(input: DocumentInput, preferredProviderId?: string): DocumentParsingProvider {
    if (preferredProviderId) {
      const provider = this.get(preferredProviderId);
      if (!provider.supports(input)) throw new Error(`LC-PARSER-REGISTRY-003: provider '${preferredProviderId}' does not support '${input.mediaType}'.`);
      return provider;
    }
    const provider = [...this.providers.values()].find((candidate) => candidate.supports(input));
    if (!provider) throw new Error(`LC-PARSER-REGISTRY-004: no provider supports '${input.mediaType}'.`);
    return provider;
  }
}
