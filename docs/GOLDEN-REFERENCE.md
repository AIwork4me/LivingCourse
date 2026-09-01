# Golden reference

The previous project at `C:\Users\rocm\Desktop\SoundPPT` is a read-only Golden Reference and regression oracle. It was not refactored or modified.

Only a whitelist was copied into the new repository: approved source metadata, seven approved visuals, three approved narration files, timing/caption metadata, deterministic QA metadata and the prior PPTX/MP4 oracle. Runtime cache, temporary URLs, raw provider responses, failed assets and development logs were excluded.

The original course manifest SHA-256 is:

```text
D84F74258AE12F600888E59D00FB1657B2153D78DFB55A8387FE48B457F6541F
```

## Regression interpretation

- Golden PPTX: 3 slides; Slide 3 was a release-blocked placeholder.
- Golden MP4: 1280×720, 30 fps, H.264 + AAC, 55.552 seconds; it used a disclosed synthetic Slide 3 for Author Review.
- v0.2 MP4: 1280×720, 30 fps, H.264 + AAC, 55.531 seconds.
- Caption profile remains black native text, transparent background, no border/colored block and at most two lines.

The v0.2 PPT intentionally aligns its Author Review behavior with the video: Slide 3 renders the disclosed synthetic view while the production gate remains blocked. Stable Slides 1 and 2 preserve the Golden hierarchy, approved visuals and instructional sequence.

Regression uses structural PPT inspection, rendered page inspection, representative video still inspection, audio/video metadata and the human checklist recorded in `M2-RENDERER-REPORT.md`; cross-platform MP4 binary equality is not required.
