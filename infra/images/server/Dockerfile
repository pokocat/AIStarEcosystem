ARG JAVA_BASE=eclipse-temurin:17-jre-noble
FROM ${JAVA_BASE}
USER root
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ffmpeg fontconfig fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 aistar \
 && useradd --uid 10001 --gid 10001 --create-home --home-dir /app aistar \
 && mkdir -p /app/work /var/log/aistar \
 && chown -R 10001:10001 /app /var/log/aistar
WORKDIR /app/work
COPY --chown=10001:10001 app.jar /app/app.jar
COPY entrypoint.sh /usr/local/bin/aistar-entrypoint
ARG APP_SHA256
RUN test -n "$APP_SHA256" && echo "$APP_SHA256  /app/app.jar" | sha256sum --check \
 && chmod 0755 /usr/local/bin/aistar-entrypoint
ENV LANG=C.UTF-8 TZ=Asia/Shanghai
EXPOSE 8080
USER 10001:10001
ENTRYPOINT ["/usr/local/bin/aistar-entrypoint"]
