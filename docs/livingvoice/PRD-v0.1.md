# LivingVoice v0.1 Product Requirements Document

> **Status:** Implementation-ready draft  
> **Version:** v0.1  
> **Product:** LivingVoice  
> **Parent project / consumer:** LivingCourse  
> **Source of truth:** This document  
> **Primary implementation audience:** Codex / engineers  
> **Product principle:** 极致单一、极致好用

---

## 0. Executive Summary

LivingVoice is a focused open-source high-fidelity voice cloning tool for LivingCourse.

Its job is deliberately narrow:

> **LivingVoice does not help users find a voice. It helps users turn a voice they already like into a stable, reusable voice asset, compare their top choices, select a Preferred Voice, and expose a versioned Voice Config that LivingCourse can use to narrate courses at scale.**

The product must optimize for this golden path:

```text
Upload Voice
  → Clone
  → Listen
  → Save
  → Top 3
  → Blind Compare
  → Preferred Voice
  → Voice Config
  → LivingCourse
  → Course Audio
```

LivingVoice solves two problems in sequence:

```text
1. Human problem:
   Which voice do we actually want to keep listening to?

2. Machine problem:
   How do we reproduce that approved voice consistently across an entire course?
```

The most important v0.1 features are therefore:

1. **Upload Voice**
2. **High-fidelity Voice Clone**
3. **Voice Library**
4. **Text → Voice generation**
5. **Top-3 Voice Compare**
6. **Blind Compare**
7. **Preferred Voice**
8. **Versioned Preferred Voice Config**
9. **LivingCourse speech API**
10. **Bring-your-own TTS Provider via Base URL + API Key**

LivingVoice is **not** an audio workstation, video editor, podcast tool, speaker-separation tool, model playground, or general-purpose TTS console.

---

# 1. Product Positioning

## 1.1 Core message

Primary headline:

> **Upload a voice you like. Clone it. Type text. Get the voice.**

Supporting line:

> **High-fidelity voice cloning for your content.**

LivingCourse-specific value proposition:

> **Find the voice people want to keep listening to — then use it consistently across an entire course.**

## 1.2 Product promise

A user should be able to:

1. Prepare a clean 15–30 second voice sample using any editor they already know.
2. Upload it to LivingVoice.
3. Let LivingVoice prepare the audio and transcribe it automatically.
4. Clone the voice.
5. Generate a realistic sample from arbitrary text.
6. Save several candidate voices.
7. Compare up to three candidates using the exact same real course script.
8. Select a Preferred Voice through blind listening.
9. Save the winning production settings as a versioned Voice Config.
10. Let LivingCourse call that Voice Config to generate course narration without knowing which TTS provider or model is underneath.

## 1.3 North-star outcome

The primary success event is **not** “voice cloned”.

It is:

> **Preferred Voice selected and successfully used by LivingCourse.**

---

# 2. Product Principles

These principles are requirements, not suggestions.

## P1 — Extreme focus

LivingVoice has one job:

> Turn a selected voice into a reusable production voice for course narration.

Do not add adjacent audio-production features unless they directly improve this workflow.

## P2 — Human taste first, machine scale second

The system must never pretend that an algorithm can decide which voice humans prefer.

LivingVoice first helps people listen and choose.

Only after a human selects the Preferred Voice does LivingVoice turn that decision into a stable machine-readable configuration.

## P3 — “Voice”, not “audio file”

User-facing terminology must center on **Voice**.

Use:

- Upload Voice
- Add Voice
- Your Voices
- Compare Voices
- Preferred Voice

Avoid making WAV/MP3/model terminology the product mental model.

## P4 — Provider details stay hidden

Normal users must not need to understand:

- model names
- embeddings
- temperature
- top-p
- top-k
- seeds
- CFG
- prompt tokens
- speaker IDs
- inference engines

Provider/model details belong only in admin settings and internal metadata.

## P5 — Reproducibility

Once a Preferred Voice is selected, LivingCourse must be able to reproduce it reliably.

Therefore Preferred Voice Configs are immutable and versioned.

## P6 — Provider-neutral integration

LivingCourse must never directly call Qwen, CosyVoice, or another TTS implementation.

LivingCourse knows only:

```text
voice_config_id
```

## P7 — Explicit consent

A Voice cannot be created unless the uploader confirms that they own the voice or have permission to clone and use it.

## P8 — Fail clearly

If an input is unsuitable, the UI must explain what is wrong and what the user should do next.

Never silently “fix” a multi-speaker or music-heavy recording and pretend it is a good cloning source.

---

# 3. Target Users

## 3.1 Primary user: HR / course producer

Characteristics:

- Non-technical.
- Has already found several voices that the boss or training owner may like.
- Can use Jianying/CapCut/Audacity/etc. to trim a clip.
- Does not want to understand TTS models.
- Needs fast, dependable results.

Primary tasks:

```text
Upload → Clone → Listen → Save → Compare → Preferred
```

## 3.2 Decision maker: boss / course owner

Characteristics:

- May never configure or administer LivingVoice.
- Cares about whether the voice sounds right and is comfortable for long-form listening.
- Needs a simple blind A/B/C comparison.

Primary task:

```text
Listen to A/B/C → choose the voice I want learners to keep hearing
```

## 3.3 Machine consumer: LivingCourse

Needs:

- A stable `voice_config_id`.
- A stable speech-generation API.
- Reproducible output behavior.
- Provider-independent integration.
- Version safety when models/providers change.

---

# 4. Scope

## 4.1 v0.1 MUST support

| Capability | v0.1 |
|---|---|
| Upload Voice | MUST |
| WAV upload | MUST |
| MP3 upload | MUST |
| M4A upload | MUST |
| Local MP4 upload | MUST |
| 15–30 s input guidance | MUST |
| Basic audio normalization | MUST |
| Trim leading/trailing silence | MUST |
| Automatic transcription | MUST |
| Transcript review/edit | MUST, secondary action |
| Basic quality gate | MUST |
| Single-speaker requirement | MUST |
| Explicit consent checkbox | MUST |
| Voice cloning | MUST |
| Voice Library | MUST |
| Voice preview | MUST |
| Text → Voice | MUST |
| Regenerate | MUST |
| WAV download | MUST |
| Select up to 3 voices | MUST |
| Top-3 Voice Compare | MUST |
| Blind Compare | MUST |
| Randomized A/B/C assignment | MUST |
| Preferred Voice | MUST |
| Versioned Preferred Voice Config | MUST |
| Copy Voice Config ID | MUST |
| LivingCourse speech endpoint | MUST |
| TTS Provider Base URL | MUST |
| TTS Provider API Key | MUST |
| Provider connection test | MUST |
| Server-side key storage | MUST |
| Mock provider for tests | MUST |

## 4.2 Explicitly NOT in v0.1

Do not implement:

- YouTube URL
- URL-based video download
- automatic “find the best segment” from a long video
- speaker diarization
- multi-speaker extraction
- speaker separation
- background-music removal
- source-separation models
- waveform editing
- timeline editor
- podcast creation
- video dubbing
- lip sync
- voice marketplace
- voice design from text
- fine-tuning UI
- emotion studio
- pitch editor
- advanced generation controls
- exposed temperature/top-p/top-k/seed
- automatic AI winner selection
- analytics dashboard
- team/project management
- billing

If Codex encounters ambiguity, **prefer omission over adding product surface**.

---

# 5. Golden User Flow

This flow is the product contract.

```text
Upload Voice
  ↓
Validate sample
  ↓
Prepare audio
  ↓
Transcribe
  ↓
Clone
  ↓
Listen
  ↓
Save Voice
  ↓
Repeat until user has candidates
  ↓
Select up to 3
  ↓
Use one identical real-course audition script
  ↓
Generate all candidates
  ↓
Blind Compare A/B/C
  ↓
Human selects winner
  ↓
Set as Preferred Voice
  ↓
Create immutable Voice Config v1
  ↓
LivingCourse stores voice_config_id
  ↓
LivingCourse sends course text
  ↓
LivingVoice generates Course Audio
```

No other workflow should be more prominent than this one.

---

# 6. Information Architecture

v0.1 has only four primary navigation destinations:

```text
Voices | Compare | Preferred | Settings
```

No Dashboard.

No Projects.

No Models.

No Audio Studio.

No Analytics.

## 6.1 Voices

Purpose:

- Add Voice
- preview saved Voices
- generate arbitrary text using a Voice
- rename/delete a Voice
- select candidate Voices for Compare

## 6.2 Compare

Purpose:

- choose up to three Voices
- provide one audition script
- generate fair A/B/C samples
- run blind comparison
- choose winner

## 6.3 Preferred

Purpose:

- show the currently approved Preferred Voice
- preview it
- show production Voice Config version
- expose `voice_config_id`
- show readiness for LivingCourse

## 6.4 Settings

Purpose:

- configure TTS provider
- Base URL
- API Key
- optional provider/model name if required by adapter
- Test Connection

Settings are admin-facing and visually secondary.

---

# 7. Screen Requirements

## 7.1 Voices screen

Minimal structure:

```text
LivingVoice

Your Voices                                      + Add Voice

★ Warm Instructor
  ▶ Preview
  Preferred

Executive
  ▶ Preview

Calm Narrator
  ▶ Preview
```

Each Voice card must show only:

- name
- preview
- Preferred badge when applicable
- creation date (optional, low visual priority)
- overflow menu

Overflow menu:

```text
Rename
Replace reference
Delete
```

Do not show provider/model details on the card.

## 7.2 Add Voice screen

Required copy:

```text
Upload Voice

Drop your voice sample here

WAV · MP3 · M4A · MP4

For the best clone

✓ One speaker only
✓ 15–30 seconds
✓ No background music
✓ Minimal background noise
✓ Clear, natural speech
✓ No strong echo or reverb

Already found a voice you love?
Trim the best 15–30 seconds with Jianying, CapCut, Audacity,
or any editor you like, then upload it here.

☐ I have permission to clone and use this voice.
```

Primary CTA:

```text
Upload Voice
```

CTA stays disabled until:

- file exists
- consent is checked

### File constraints

Recommended defaults:

- max file size: 100 MB
- accepted MIME/types limited to supported formats
- input duration hard range: 5–60 seconds
- ideal duration: 15–30 seconds

If outside 15–30 seconds but within hard bounds, show warning.

If outside 5–60 seconds, block cloning.

## 7.3 Voice preparation / quality screen

LivingVoice may internally:

- extract audio from MP4
- convert to mono
- resample to provider-compatible format
- trim leading/trailing silence
- normalize loudness
- run basic clipping/silence/speech checks
- transcribe

User sees:

```text
Preparing your voice...

Preparing audio      ✓
Checking quality     ✓
Transcribing         ✓
Ready to clone       ✓
```

Then:

```text
[waveform]

▶ 00:00 ━━━━━━━━━━━━━━━ 00:24

Great sample

✓ 24 seconds
✓ Clear speech
✓ Good volume

Transcript

“...automatically transcribed text...”

Edit

Voice name
[ Warm Instructor ]

Create Voice
```

Transcript editing must be available but visually secondary.

## 7.4 Quality states

Use only three product states:

### Great sample

```text
Great sample
Ready to clone.
```

### Usable

```text
Usable sample

This sample may work, but a cleaner 15–30 second recording
usually produces a better clone.

Continue anyway | Replace Voice
```

### Try another sample

Examples:

```text
Try another sample

This sample appears to contain background music.
For a high-fidelity clone, upload clean speech without music.

Replace Voice
```

or:

```text
Try another sample

This sample may contain multiple speakers.
LivingVoice supports one speaker only.

Trim a single-speaker section and upload it again.

Replace Voice
```

v0.1 must not offer automated speaker/music separation.

## 7.5 Clone progress

User-facing steps only:

```text
Creating your voice...

Preparing audio      ✓
Transcribing         ✓
Creating voice       ✓

Your voice is ready.
```

Do not expose model inference details.

## 7.6 First-listen screen

A clone is not considered successful until the user can listen to generated speech.

Required structure:

```text
Warm Instructor

Reference
▶ ━━━━━━━━━━━━━━━━━━━

Try this voice

[ Welcome to today's course... ]

Generate

Generated
▶ ━━━━━━━━━━━━━━━━━━━

Save Voice
```

Default test script should be short but editable.

User must be able to:

- play Reference
- generate Sample
- play Generated Sample
- regenerate
- save

## 7.7 Voice detail / generation screen

Structure:

```text
Warm Instructor

▶ Reference Preview

What should it say?

[                                          ]
[                                          ]
[                                          ]

Generate

▶ generated result

Regenerate            Download WAV
```

Do not expose advanced generation controls in v0.1.

## 7.8 Compare setup screen

User can select 2 or 3 Voices.

3 is the target experience.

Never allow >3 in v0.1.

```text
Compare Voices

Select up to 3 voices.

☑ Executive
☑ Warm Instructor
☑ Calm Narrator

3 / 3 selected

Compare
```

Then:

```text
Audition Script

Use the same real course text to compare every voice.

[ Welcome to this course. Over the next few lessons... ]

Generate Comparison
```

The audition script should encourage **real course material**, because the real question is long-form listenability.

## 7.9 Blind Compare screen

Default mode is Blind Compare.

Names and metadata are hidden.

```text
Which voice would you want to keep listening to?

VOICE A
▶ ━━━━━━━━━━━━━━━━━━━━━━━━━
Choose A

VOICE B
▶ ━━━━━━━━━━━━━━━━━━━━━━━━━
Choose B

VOICE C
▶ ━━━━━━━━━━━━━━━━━━━━━━━━━
Choose C
```

Required behavior:

- all candidates use identical text
- all candidates use the same output format
- all candidates use the same compatible generation defaults
- normalize playback loudness enough to avoid obvious volume bias
- map real voice IDs to A/B/C only after all samples exist
- randomize A/B/C ordering for each new comparison session
- persist the randomized mapping for the session
- do not reveal names until selection or explicit “Reveal” action
- do not algorithmically rank candidates

Primary question must be:

> **Which voice would you want to keep listening to?**

Avoid making “similarity score” the decision criterion.

## 7.10 Winner screen

After the user selects A/B/C:

```text
You chose Voice B

Warm Instructor

▶ Listen again

Set as Preferred Voice
```

Only an explicit action promotes the Voice.

## 7.11 Preferred screen

```text
Preferred Voice

★ Warm Instructor

The voice selected for LivingCourse.

▶ ━━━━━━━━━━━━━━━━━━━━━━━━━

VOICE CONFIG

Warm Instructor · v1

Ready for LivingCourse  ●

voicecfg_warm_instructor_v1

Copy Config ID
```

Optional secondary action:

```text
View Config
```

Do not show API keys.

---

# 8. Domain Model

The following domain concepts are required.

## 8.1 Voice

A human-recognizable cloned voice asset.

Suggested schema:

```ts
type Voice = {
  id: string;
  name: string;

  referenceAudioId: string;
  referenceTranscript: string;

  providerBinding: {
    providerId: string;
    providerVoiceId?: string;
  };

  consentConfirmed: boolean;

  qualityStatus: "great" | "usable" | "rejected";

  createdAt: string;
  updatedAt: string;
};
```

Provider credentials must never live in `Voice`.

## 8.2 ReferenceAudio

```ts
type ReferenceAudio = {
  id: string;
  sourceFilename: string;
  sourceMimeType: string;

  normalizedPathOrObjectKey: string;

  durationMs: number;
  sampleRate?: number;
  channels?: number;

  createdAt: string;
};
```

The normalized 15–30 second reference is a production asset and should be retained by default.

Reason:

- provider migration
- model upgrade
- Voice rebuild
- regression comparison
- reproducibility

## 8.3 ComparisonSession

```ts
type ComparisonSession = {
  id: string;

  candidateVoiceIds: string[]; // 2 or 3
  auditionText: string;

  blindOrder: Array<{
    slot: "A" | "B" | "C";
    voiceId: string;
  }>;

  generatedSampleIds: string[];

  selectedSlot?: "A" | "B" | "C";
  selectedVoiceId?: string;

  status:
    | "draft"
    | "generating"
    | "ready"
    | "selected"
    | "failed";

  createdAt: string;
};
```

## 8.4 PreferredVoice

At most one active Preferred Voice per LivingVoice instance/workspace in v0.1.

```ts
type PreferredVoice = {
  voiceId: string;
  voiceConfigId: string;
  promotedAt: string;
};
```

## 8.5 VoiceConfig

This is a critical production object.

A VoiceConfig is an **immutable, versioned recipe** for reproducing the approved voice.

```ts
type VoiceConfig = {
  id: string;
  version: number;

  voiceId: string;
  displayName: string;

  providerBinding: {
    providerId: string;
    providerVoiceId?: string;
    model?: string;
  };

  reference: {
    audioId: string;
    transcript: string;
  };

  generation: {
    language: "auto" | string;
  };

  output: {
    format: "wav";
    sampleRate?: number;
  };

  status: "preferred" | "superseded";

  createdAt: string;
};
```

Rules:

1. VoiceConfig is immutable after creation.
2. Changing provider/model/reference/generation settings creates a new version.
3. Never silently modify `v1`.
4. A new version does not replace production automatically.
5. Human selection/promotion is required before a newer config becomes Preferred.
6. API keys are never stored inside VoiceConfig.

Example ID:

```text
voicecfg_warm_instructor_v1
```

---

# 9. VoiceConfig Contract for LivingCourse

LivingCourse must not receive internal provider implementation details.

## 9.1 Public/read model

```json
{
  "voice_config_id": "voicecfg_warm_instructor_v1",
  "name": "Warm Instructor",
  "version": 1,
  "status": "preferred"
}
```

LivingCourse stores only `voice_config_id` as the production binding.

## 9.2 Speech request

Required endpoint:

```http
POST /v1/speech
```

Request:

```json
{
  "voice_config_id": "voicecfg_warm_instructor_v1",
  "text": "Welcome to the first lesson."
}
```

Response:

```json
{
  "generation_id": "gen_01...",
  "voice_config_id": "voicecfg_warm_instructor_v1",
  "audio_url": "/v1/audio/gen_01....wav",
  "format": "wav",
  "duration_ms": 8420
}
```

LivingCourse must never need to send:

- provider name
- provider API key
- provider voice ID
- model name
- reference audio
- reference transcript
- low-level generation parameters

## 9.3 Preferred config endpoint

Provide:

```http
GET /v1/preferred-voice
```

Response:

```json
{
  "voice_id": "voice_warm_instructor",
  "voice_config_id": "voicecfg_warm_instructor_v1",
  "name": "Warm Instructor",
  "version": 1
}
```

---

# 10. TTS Provider Contract

The provider abstraction is mandatory.

The UI must not depend on a specific model.

Minimum interface:

```ts
interface TTSProvider {
  health(): Promise<ProviderHealth>;

  clone(input: {
    referenceAudio: Uint8Array | ReadableStream;
    referenceTranscript: string;
  }): Promise<{
    providerVoiceId?: string;
    metadata?: Record<string, unknown>;
  }>;

  generate(input: {
    providerVoiceId?: string;
    referenceAudio?: Uint8Array | ReadableStream;
    referenceTranscript?: string;
    text: string;
    language?: string;
  }): Promise<{
    audio: Uint8Array | ReadableStream;
    format: "wav";
    sampleRate?: number;
  }>;

  deleteVoice?(providerVoiceId: string): Promise<void>;
}
```

The adapter may internally support either:

1. persistent provider-side Voice IDs, or
2. reference-audio prompt reuse.

LivingVoice must normalize both approaches behind the same `Voice` / `VoiceConfig` contract.

## 10.1 v0.1 provider requirement

At minimum implement:

- `CustomTTSProvider`
- `MockTTSProvider` for deterministic automated tests

The Custom provider must be configured with:

```text
Base URL
API Key
```

Optional adapter-specific model field is acceptable in Settings if required.

## 10.2 Provider connection test

Settings must offer:

```text
Test Connection
```

Possible states:

```text
Connected
Authentication failed
Endpoint unavailable
Unsupported provider contract
```

Never display the raw API key.

---

# 11. Transcription

Automatic transcription is a product requirement.

The user should not need to manually type the reference transcript.

Recommended architecture:

```ts
interface TranscriptionProvider {
  transcribe(input: {
    audio: Uint8Array | ReadableStream;
  }): Promise<{
    text: string;
    language?: string;
  }>;
}
```

v0.1 should ship with one working default path.

Implementation options, in preference order:

1. bundled local Whisper-compatible transcription
2. isolated local transcription service/container
3. explicitly configured transcription provider

The UI must not require an HR user to understand ASR configuration.

The transcript must be reviewable/editable before cloning.

---

# 12. Audio Preparation

LivingVoice does not edit content creatively.

It may perform deterministic technical preparation:

- extract audio from local MP4
- convert format
- convert to mono when appropriate
- resample when required
- trim leading/trailing silence
- normalize loudness
- detect clipping
- estimate silence ratio
- estimate whether speech exists
- flag likely background music
- flag likely multiple speakers if a lightweight/reliable check is available

Important:

- Detection may block or warn.
- v0.1 does **not** remove background music.
- v0.1 does **not** separate speakers.
- v0.1 does **not** choose a segment from a long recording.

Use FFmpeg/FFprobe for deterministic media conversion/inspection where possible.

---

# 13. Quality Gate

The Quality Gate exists only to protect cloning quality.

Do not create a complex numerical scoring product.

Public states:

```text
great
usable
rejected
```

Example checks:

- duration
- speech presence
- clipping ratio
- silence ratio
- loudness
- music likelihood
- multi-speaker likelihood when technically reliable

Quality rules must be documented and testable.

If a heuristic is unreliable, prefer a warning instead of a hard rejection.

---

# 14. Blind Compare Rules

Blind Compare is a first-class v0.1 feature.

## 14.1 Fairness requirements

A ComparisonSession must:

- use exactly one audition text for every candidate
- generate all samples before comparison becomes `ready`
- use identical compatible defaults
- avoid candidate-specific manual tuning
- normalize playback loudness
- randomize candidate-to-slot mapping
- keep mapping stable for the session
- hide candidate names while blind
- reveal after selection
- persist the human selection

## 14.2 No algorithmic winner

LivingVoice must not:

- rank voices automatically
- select a Preferred Voice automatically
- show a “best voice” score
- bias selection using similarity metrics

Machines generate.

Humans choose.

## 14.3 Long-listening intent

The compare page should use this wording:

> **Which voice would you want to keep listening to?**

This is intentionally different from:

- Which voice is most similar?
- Which voice is objectively best?

LivingVoice optimizes for sustained course listening.

---

# 15. Preferred Voice Promotion

Promotion is explicit.

Flow:

```text
Comparison winner
  ↓
Reveal Voice
  ↓
Set as Preferred Voice
  ↓
Snapshot immutable VoiceConfig
  ↓
Mark previous preferred config superseded
  ↓
Expose new voice_config_id
```

If no Preferred Voice exists, LivingCourse speech generation without an explicit `voice_config_id` must fail clearly.

Do not silently choose an arbitrary Voice.

---

# 16. Versioning and Regression Safety

Example:

```text
Warm Instructor v1  ★ Production
Warm Instructor v2    Candidate
```

If provider/model changes:

```text
v1
 ↓ rebuild using new provider/model
v2 candidate
 ↓ Blind Compare
human approval
 ↓
promote v2
```

Until promotion, LivingCourse continues using `v1`.

This prevents a model upgrade from silently changing the voice of an existing course.

---

# 17. API Surface

Recommended v0.1 API.

## Health

```http
GET /health
```

## Voices

```http
POST   /v1/voices
GET    /v1/voices
GET    /v1/voices/:voiceId
PATCH  /v1/voices/:voiceId
DELETE /v1/voices/:voiceId
```

`POST /v1/voices` accepts multipart upload plus:

- name
- consent confirmation

The server handles preparation/transcription/clone workflow.

If asynchronous processing is necessary, return a job ID and expose a status endpoint. Do not add a complex queue UI.

## Voice generation

```http
POST /v1/voices/:voiceId/generate
```

Request:

```json
{
  "text": "Welcome to today's course."
}
```

## Comparisons

```http
POST /v1/comparisons
GET  /v1/comparisons/:comparisonId
POST /v1/comparisons/:comparisonId/generate
POST /v1/comparisons/:comparisonId/select
```

Create:

```json
{
  "voice_ids": [
    "voice_a",
    "voice_b",
    "voice_c"
  ],
  "audition_text": "..."
}
```

Select:

```json
{
  "slot": "B"
}
```

The client must not be required to know the hidden slot→voice mapping before reveal.

## Preferred

```http
POST /v1/preferred-voice
GET  /v1/preferred-voice
```

Promotion request:

```json
{
  "voice_id": "voice_warm_instructor"
}
```

Response includes new immutable `voice_config_id`.

## Voice Config

```http
GET /v1/voice-configs/:voiceConfigId
```

## LivingCourse speech

```http
POST /v1/speech
```

## Audio

```http
GET /v1/audio/:audioId
```

Production implementation may use object-storage URLs, but API semantics must remain stable.

---

# 18. Error Model

Errors should be structured and actionable.

Suggested shape:

```json
{
  "error": {
    "code": "VOICE_MULTIPLE_SPEAKERS",
    "message": "This sample may contain multiple speakers.",
    "action": "Trim a single-speaker section and upload it again.",
    "retryable": true
  }
}
```

Required stable error categories include:

```text
UNSUPPORTED_FILE
FILE_TOO_LARGE
VOICE_TOO_SHORT
VOICE_TOO_LONG
VOICE_NO_SPEECH
VOICE_BACKGROUND_MUSIC
VOICE_MULTIPLE_SPEAKERS
TRANSCRIPTION_FAILED
PROVIDER_NOT_CONFIGURED
PROVIDER_AUTH_FAILED
PROVIDER_UNAVAILABLE
CLONE_FAILED
GENERATION_FAILED
COMPARISON_NOT_READY
INVALID_COMPARISON_SIZE
PREFERRED_VOICE_NOT_SET
VOICE_CONFIG_NOT_FOUND
```

Never expose provider secrets or raw authorization headers in errors/logs.

---

# 19. Security and Privacy

## 19.1 API keys

Mandatory:

- never store provider API keys in browser localStorage
- never include provider API keys in Voice or VoiceConfig
- never log API keys
- never return API keys from normal API responses
- provider requests happen server-side

For local-first v0.1, environment-backed secret configuration is acceptable and preferred.

A future encrypted credential store may be added without changing public contracts.

## 19.2 Voice consent

Creating a Voice requires:

```text
I have permission to clone and use this voice.
```

Persist:

```ts
consentConfirmed: true
```

No consent → no clone.

## 19.3 Reference assets

Retain the normalized reference by default because it is required for reproducibility and provider migration.

Provide deletion with Voice deletion.

Deletion behavior must be deterministic and documented.

---

# 20. Storage

v0.1 should be simple and local-first.

Recommended:

- metadata: SQLite
- local audio assets: filesystem under an application data directory
- provider secrets: environment/server config
- future storage adapters: S3-compatible

Do not require PostgreSQL or cloud object storage for local v0.1.

Storage paths must not be committed to git.

Generated/reference audio must be excluded by `.gitignore`.

---

# 21. Deployment

The open-source v0.1 must have a one-command local launch path.

Target UX:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:<port>
```

The exact port may follow repository conventions.

A developer without LivingCourse should be able to run LivingVoice independently.

LivingCourse should integrate over HTTP rather than importing provider-specific runtime code.

---

# 22. Recommended Architecture

Logical architecture:

```text
                   Human
                     │
                     ▼
               LivingVoice UI
                     │
                     ▼
              LivingVoice API
          ┌──────────┼───────────┐
          │          │           │
      Voice Core   Compare    Voice Config
          │          │           │
          └──────────┴─────┬─────┘
                           │
                     Provider Layer
                      ┌────┴─────┐
                      │          │
                    TTS         ASR
                      │          │
                Custom/Qwen    Whisper
                      │
                      ▼
                 Audio assets

════════════════════════════════════════════

                LivingCourse
                     │
          voice_config_id + text
                     │
                     ▼
              POST /v1/speech
                     │
                     ▼
                Course Audio
```

Key rule:

> LivingCourse integrates with LivingVoice, never directly with a TTS provider.

---

# 23. Repository / Module Boundaries

When implemented as its own repository, recommended high-level layout:

```text
livingvoice/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── voice-core/
│   ├── provider-contracts/
│   └── shared/
├── services/
│   └── transcription/        # only if a separate local ASR service is used
├── data/                     # runtime only; gitignored
├── tests/
├── docker-compose.yml
├── .env.example
├── README.md
└── PRD.md
```

If initially implemented inside the LivingCourse monorepo, preserve existing architectural rules:

- pure domain code must remain provider-neutral
- provider adapters stay isolated
- LivingCourse core must not import TTS provider vocabulary
- the LivingVoice HTTP contract is the integration boundary

Do not force LivingVoice internals into LivingCourse `core`.

---

# 24. Visual / Interaction Style

LivingVoice should feel:

- quiet
- focused
- spacious
- confident
- audio-first
- low cognitive load

Avoid:

- dense admin dashboards
- gradients everywhere
- model benchmark tables
- dozens of toggles
- “AI magic” marketing language
- technical jargon in normal workflow

One screen should normally have one clear primary action.

Use waveform/audio playback as the primary visual element.

---

# 25. Accessibility and Audio UX

At minimum:

- all actions keyboard accessible
- visible focus states
- text labels for playback controls
- no color-only status semantics
- A/B/C buttons have accessible labels
- playback must never auto-start unexpectedly
- changing Voice must stop previous playback
- only one sample should play at a time
- audio controls should work on modern Chromium/Safari/Firefox

---

# 26. Testing Requirements

Codex must not consider v0.1 complete without automated tests.

## 26.1 Domain tests

Test:

- Voice creation validation
- consent required
- VoiceConfig immutability
- VoiceConfig version increments
- single Preferred Voice invariant
- previous config becomes superseded
- comparison requires 2–3 unique Voices
- blind mapping has no duplicates
- blind mapping persists
- selected slot resolves to correct Voice

## 26.2 API tests

Test:

- unsupported upload rejected
- missing consent rejected
- voice create happy path using Mock providers
- generation happy path
- comparison generation
- blind selection
- Preferred promotion
- `POST /v1/speech`
- unknown `voice_config_id`
- provider authentication error normalization
- secrets never returned

## 26.3 Provider contract tests

Use a deterministic MockTTSProvider.

The full test suite must run without a real external TTS API key.

Real-provider smoke tests must be opt-in.

## 26.4 Security tests

Verify:

- `.env` ignored
- runtime audio/data ignored
- secrets not logged
- API responses do not expose secrets
- VoiceConfig contains no API key

## 26.5 UI / E2E golden path

Automate the core flow with mock providers:

```text
Upload Voice
→ Clone
→ Listen
→ Save
→ create 3 Voices
→ Compare
→ blind select B
→ promote winner
→ copy/use Voice Config
→ POST /v1/speech
→ receive audio
```

This is the most important E2E test.

---

# 27. v0.1 Acceptance Criteria

v0.1 is DONE only when all of the following are true.

## Product

- [ ] A non-technical user can see the exact sample requirements directly on Upload Voice.
- [ ] User can upload WAV/MP3/M4A/local MP4.
- [ ] YouTube URLs are not supported.
- [ ] Multi-speaker extraction is not present.
- [ ] Background-music removal is not present.
- [ ] Consent is mandatory.
- [ ] LivingVoice prepares and transcribes a valid sample.
- [ ] User can review/edit transcript.
- [ ] User can clone and listen.
- [ ] User can save multiple Voices.
- [ ] User can generate speech from arbitrary text.
- [ ] User can choose up to three Voices.
- [ ] Comparison uses one identical audition script.
- [ ] Blind A/B/C order is randomized.
- [ ] User can select a winner.
- [ ] User can explicitly promote winner to Preferred.
- [ ] Promotion creates immutable versioned Voice Config.
- [ ] Preferred page exposes `voice_config_id`.
- [ ] LivingCourse can generate speech by sending only `voice_config_id` + `text`.

## Architecture

- [ ] LivingCourse does not depend on provider-specific APIs.
- [ ] Provider keys stay server-side.
- [ ] VoiceConfig does not contain secrets.
- [ ] Provider adapter is replaceable.
- [ ] Mock provider supports offline tests.
- [ ] Reference voice asset is retained for reproducibility.
- [ ] Replacing provider/model does not silently mutate existing VoiceConfig.

## Quality

- [ ] One-command local deployment documented.
- [ ] Main E2E golden path passes.
- [ ] Unit/API/provider tests pass.
- [ ] Lint/typecheck pass for applicable stacks.
- [ ] No real secrets or generated voice assets are committed.
- [ ] README clearly explains the product in under one screen before technical setup.

---

# 28. Required README Product Copy

The first screen of README should remain concise.

Recommended:

```text
# LivingVoice

Upload a voice you like.
Clone it.
Type text.
Get the voice.

High-fidelity voice cloning.

Upload → Clone → Listen → Compare → Preferred → LivingCourse

- Clone from a clean 15–30s voice sample
- Blind-compare your top 3 voices
- Save a versioned Preferred Voice Config
- Bring your own TTS provider
```

Do not lead README with architecture.

Lead with user value.

---

# 29. Codex Implementation Order

Codex should implement in this order.

## Phase 1 — Contracts first

1. Read this PRD completely.
2. Inspect the existing repository and current architecture before changing code.
3. Define pure domain schemas:
   - Voice
   - ReferenceAudio
   - ComparisonSession
   - PreferredVoice
   - VoiceConfig
4. Define TTSProvider and TranscriptionProvider contracts.
5. Add deterministic Mock providers.
6. Add domain tests.

**Do not start with UI.**

## Phase 2 — API and storage

1. SQLite/local storage.
2. audio asset storage.
3. Voice CRUD.
4. upload validation.
5. audio preparation.
6. transcription workflow.
7. clone workflow.
8. speech generation.
9. ComparisonSession APIs.
10. Preferred promotion.
11. `/v1/speech`.
12. API tests.

## Phase 3 — UI golden path

Implement only:

```text
Voices
Add Voice
Voice Detail / Generate
Compare
Blind Compare
Preferred
Settings
```

Keep advanced controls out.

## Phase 4 — Integration

1. Configure CustomTTSProvider.
2. Test connection.
3. Run real clone manually with an authorized sample.
4. Promote a Preferred Voice.
5. Call `/v1/speech` using only `voice_config_id`.
6. Verify LivingCourse can consume the output.

## Phase 5 — Hardening

Run:

- unit tests
- API tests
- E2E
- lint
- typecheck
- security checks
- secret scan

Document anything not actually verified as **NOT VERIFIED**.

Never claim a real provider works unless a real smoke test was executed successfully.

---

# 30. Codex Guardrails

Codex MUST follow these rules while implementing:

1. Do not broaden v0.1 scope.
2. Do not add YouTube support.
3. Do not add speaker separation.
4. Do not add background-music removal.
5. Do not add an audio editor.
6. Do not expose model-tuning controls in normal UI.
7. Do not couple LivingCourse to a provider.
8. Do not store API keys in browser storage or VoiceConfig.
9. Do not silently overwrite a Preferred Voice Config.
10. Do not auto-select a comparison winner.
11. Do not call a voice “Preferred” until a human explicitly promotes it.
12. Do not treat “clone succeeded” as task completion; user must be able to listen.
13. Do not mark v0.1 complete until the full golden-path E2E passes.
14. If a capability cannot be verified, report `NOT VERIFIED` rather than guessing.
15. Prefer a smaller working implementation over speculative extensibility.

---

# 31. Product Decision Log for v0.1

These decisions are locked for v0.1.

### D1
**Use “Upload Voice”, not “Upload Audio”.**

### D2
**LivingVoice does not help users find a voice.**

Users prepare the clip themselves.

### D3
**Reference guidance is visible in GUI.**

One speaker, 15–30s, no background music, minimal noise, clear natural speech, no strong echo/reverb.

### D4
**No YouTube URL.**

### D5
**No multi-speaker extraction.**

### D6
**Voice Compare is a core feature, not an add-on.**

### D7
**Top-3 is the maximum comparison set.**

### D8
**Blind Compare is default.**

### D9
**Preferred Voice requires explicit human promotion.**

### D10
**Preferred Voice creates a versioned immutable Voice Config.**

### D11
**LivingCourse uses `voice_config_id`, never provider details.**

### D12
**Human taste first; machine-scale production second.**

---

# 32. Definition of Product Success

LivingVoice v0.1 succeeds when this sentence is true:

> A non-technical course producer can upload three authorized voices they already like, clone and listen to each one, let the course owner blindly choose the voice they would most want to keep listening to, promote that winner to a versioned Preferred Voice Config, and have LivingCourse generate course narration by sending only that config ID and course text.

If that works simply, reliably, and without exposing model complexity, v0.1 has achieved its purpose.

---

# 33. Final Product Boundary

LivingVoice is:

> **Voice Selection + Voice Reproduction Infrastructure for LivingCourse.**

It is intentionally not a broad audio platform.

The permanent product loop is:

```text
Human taste
   ↓
Upload Voice
   ↓
Clone
   ↓
Listen
   ↓
Top 3
   ↓
Blind Compare
   ↓
Preferred Voice
   ↓
Versioned Voice Config
   ↓
Machine-scale generation
   ↓
LivingCourse
   ↓
Course Audio
```

**First solve human taste. Then solve machine-scale production.**
