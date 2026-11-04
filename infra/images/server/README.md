# AIStar PostgreSQL runtime image

Build the already verified backend JAR with `build.sh VERIFIED_JAR IMAGE_TAG PINNED_JAVA_BASE`, inside the local devq heavy-task queue. The base argument must use `@sha256:`. Retain the resulting image ID, base digest and JAR SHA with the release; deploy that exact image instead of rebuilding on ECS. Image package versions are fixed by the resulting image digest; rebuilds require new media acceptance.

The image contains Java17, FFmpeg, fontconfig and Noto CJK from the base distribution's signed repositories. It runs as `10001:10001`, requires the `postgres` profile and explicit DB credentials, and uses UTC. No runtime installer or host Java/Python replacement is needed. On Alibaba Cloud Linux3 use the official `alinux3-updates` Podman RPM through Cloud Assistant; do not reimage the shared ECS.

Before activation, verify the image on both ECS with no network and a read-only root: H.264/AAC, Chinese captions, drawtext, signalstats, metadata, loudnorm, ebur128, overlay, concat and amix. Mount only AIStar-owned writable work/log paths with the correct UID. Mount root-owned env and RDS CA read-only; bind HTTP only to localhost behind the existing Nginx/ALB. Set memory/CPU/PID limits, readiness, stop grace and rollback image explicitly. Secrets never belong in image layers or build arguments.

This directory prepares an artifact, not a production deployment command. The current migration rehearsal API uses the same JAR under an isolated Java17 launcher with outbound network denial; offline image/media acceptance alone is not a production container login or paid generation acceptance. AIStar's first activation and the switch of the default release target require its separate migration window.
