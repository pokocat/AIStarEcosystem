# sau-service — Python + Playwright wrapper for social-auto-upload.
#
# Two-mode image:
#   - SAU_MOCK_MODE=1 (default): mock uploader, no Playwright runtime needed.
#     Used by CI and by `apps/server` integration tests.
#   - SAU_MOCK_MODE=0: pulls in the patchright + pokocat/social-auto-upload
#     fork via the [real] extra and routes uploads through real Playwright
#     contexts. Requires `INSTALL_REAL=1` at build time.
#
# Slice 3 shipped the mock path; Slice 5 wires the real path with the upstream
# fork pinned by SHA. Switch SHA in pyproject.toml `[project.optional-dependencies] real`.

ARG INSTALL_REAL=0

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    SAU_SERVICE_PORT=8090

# tini for proper signal handling under docker; curl for healthcheck; git so
# we can pip-install the upstream from a github sha when INSTALL_REAL=1.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini curl git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml /app/pyproject.toml
COPY src/ /app/src/
ENV PYTHONPATH=/app/src

# Core deps always installed (mock path needs them too).
RUN pip install --upgrade pip \
 && pip install fastapi==0.115.5 "uvicorn[standard]==0.32.1" pydantic==2.10.3 \
                httpx==0.28.1 python-multipart==0.0.20

# Optional real-mode layer. Built only when `docker build --build-arg INSTALL_REAL=1 .`
ARG INSTALL_REAL
RUN if [ "$INSTALL_REAL" = "1" ]; then \
        pip install -e '/app[real]' \
     && python -m patchright install --with-deps chromium ; \
    fi

EXPOSE 8090

HEALTHCHECK --interval=20s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8090/healthz || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "sau_service.main:app", "--host", "0.0.0.0", "--port", "8090"]
