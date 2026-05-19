# sau-service — Python + Playwright wrapper for social-auto-upload.
#
# Slice 3 (this commit): runs FastAPI shim with a *mock* Playwright layer so
# apps/server can integrate end-to-end. The mock returns synthetic QR codes
# and synthetic storage_state.
#
# Slice 5 will:
#   - add `RUN pip install "social-auto-upload @ git+https://github.com/pokocat/social-auto-upload@<sha>"`
#   - swap src/sau_service/uploader.py from MockUploader -> calls into the
#     forked sau uploader.* functions
#   - add `RUN playwright install --with-deps chromium`
#
# Until then this image stays small and deterministic so it can boot in CI.

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    SAU_SERVICE_PORT=8090

# tini for proper signal handling under docker; curl for healthcheck
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# install dependencies first so the build cache survives source edits
COPY pyproject.toml /app/pyproject.toml
RUN pip install --upgrade pip \
 && pip install fastapi==0.115.5 "uvicorn[standard]==0.32.1" pydantic==2.10.3 \
                httpx==0.28.1 python-multipart==0.0.20 playwright==1.49.1

# TODO(slice-5): swap to the patched fork once the storage_state arg is merged.
# RUN pip install "social-auto-upload @ git+https://github.com/pokocat/social-auto-upload@<SHA>"
# RUN playwright install --with-deps chromium

COPY src/ /app/src/
ENV PYTHONPATH=/app/src

EXPOSE 8090

HEALTHCHECK --interval=20s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8090/healthz || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "sau_service.main:app", "--host", "0.0.0.0", "--port", "8090"]
