# Hypit media adapter

Directly bundles Hypit's unmodified `decodeMediaFrames` and `visualBoundaries` from the pinned source files under `vendor/`. The generated Node 22+ entrypoint ships inside the server JAR. The application supplies an owned local source and a temporary directory, then retains actual source timestamps, adjacent change frames and a bounded set of analysis images. Hypit's visual changes remain mechanical candidates, not asserted shots.

`pnpm hypit:media:build` rebuilds the resource. Runtime requires Node.js 22+ (`AEP_STUDIO_HYPIT_NODE`, default `node`) and existing ffmpeg/ffprobe. No Hypit cloud account, model credential, renderer, browser or global skill installation is required by this adapter. Upstream grid/transcript commands are not bundled; report page layout and existing model/queue/billing remain application responsibilities.

The input is reduced to a small video with the same source frame clock before Hypit's native decoding, to bound temporary disk allocation. The adapter makes no model/network calls. Exact source and license: `vendor/UPSTREAM.json`, `vendor/LICENSE`; both also ship beside the bundled JAR resource. Update upstream deliberately; retain attribution and rerun native timestamp, flash, page evidence, billing and dinosaur acceptance checks.

Production hosts with an older shared FFmpeg can set `AEP_STUDIO_RECREATION_MEDIA_BIN` to a dedicated directory containing FFmpeg 5.1+; only analysis and film-study child processes prepend this directory. Other product media chains keep their existing runtime. Readiness runs a tiny media capability probe before reserving credits.
