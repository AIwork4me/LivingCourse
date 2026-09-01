export interface ReferenceProviderConfig {
  id: "approved-reference-reuse";
  model: "content-addressed-artifact";
  voiceProfiles: Record<string, string>;
}

export interface ApprovedArtifactLookup {
  findByFingerprint(fingerprint: string): { path: string; sha256: string; approved: boolean } | null;
}

export class ApprovedReferenceProvider {
  readonly config: ReferenceProviderConfig;
  constructor(private readonly lookup: ApprovedArtifactLookup, voiceProfiles: Record<string, string>) {
    this.config = { id: "approved-reference-reuse", model: "content-addressed-artifact", voiceProfiles: structuredClone(voiceProfiles) };
  }

  resolveApproved(fingerprint: string): { path: string; sha256: string } {
    const artifact = this.lookup.findByFingerprint(fingerprint);
    if (!artifact?.approved) throw new Error(`LC-PROVIDER-001: no approved artifact for fingerprint '${fingerprint}'.`);
    return { path: artifact.path, sha256: artifact.sha256 };
  }

  resolveVoiceId(voiceProfile: string): string {
    const voiceId = this.config.voiceProfiles[voiceProfile];
    if (!voiceId) throw new Error(`LC-PROVIDER-002: voice profile '${voiceProfile}' has no provider mapping.`);
    return voiceId;
  }
}
