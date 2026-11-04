# AIStar PostgreSQL runtime image

Build the already verified backend JAR with `build.sh VERIFIED_JAR IMAGE_TAG PINNED_JAVA_BASE PINNED_NODE_BASE`, inside the local devq heavy-task queue. Both official base arguments must use `@sha256:`; the Node base must be the Docker Official Image `node`. Retain the resulting image ID, base digest and JAR SHA with the release; deploy that exact image instead of rebuilding on ECS. Image package versions are fixed by the resulting image digest; rebuilds require new media acceptance.

The image contains Java17, Node.js22+ (binary copied from the digest-pinned official Node image), FFmpeg, fontconfig and Noto CJK from the base distribution's signed repositories. It runs as `10001:10001`, requires the `postgres` profile and explicit DB credentials, and preserves the source Asia/Shanghai business clock while JDBC/Hibernate use UTC. No runtime installer or host Java/Python replacement is needed. On Alibaba Cloud Linux3 use the official `alinux3-updates` Podman RPM through Cloud Assistant; do not reimage the shared ECS.

Before activation, verify the image on both ECS with no network and a read-only root: H.264/AAC, Chinese captions, drawtext, signalstats, metadata, loudnorm, ebur128, overlay, concat and amix. Mount only AIStar-owned writable work/log paths with the correct UID. Mount root-owned env and RDS CA read-only; bind HTTP only to localhost behind the existing Nginx/ALB. Set memory/CPU/PID limits, readiness, stop grace and rollback image explicitly. Secrets never belong in image layers or build arguments.

This directory prepares an artifact, not a production deployment command. The current migration rehearsal API uses the same JAR under an isolated Java17 launcher with outbound network denial; offline image/media acceptance alone is not a production container login or paid generation acceptance. AIStar's first activation and the switch of the default release target require its separate migration window.

Tair TLS使用阿里云实例`DescribeInstanceSSL`返回的官方CA链；为AIStar复制独立Java truststore（仅trustedCertEntry，保留默认公共根），不修改系统或账号中心信任库。原始JRE默认cacerts不包含此托管私有CA，不能关闭证书或主机名校验绕过。正式镜像入口要求挂载`AISTAR_JAVA_TRUSTSTORE=/etc/aistar/java-truststore`只读；完整API验收必须在相同truststore与不可变镜像上通过。

Studio recreation uses the JAR-bundled Hypit adapter through Node, without npm installation or network access. Run `AistarHypitRuntimeVerification` against the exact packaged classes in the image on both nodes: it invokes the real service readiness and extraction path, creates a synthetic red/blue video, and validates 24 native frames and timestamps. A healthy Spring API or FFmpeg-only check does not prove this path.

迁移文件中转只能使用独立私有Bucket，先以无敏感信息的canary验证匿名Range GET为403；仅设置object private ACL不足以证明Bucket策略未放行。禁止把数据库导出、文件归档或含业务信息的中转包放入现有公开素材Bucket。分发OCI归档时校验归档SHA256、配置摘要和RootFS摘要；Podman导出重新压缩可能改变引擎显示的manifest digest，不能据此跳过内容校验。
