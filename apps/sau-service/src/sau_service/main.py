"""FastAPI entry point.

`uvicorn sau_service.main:app` (containers) or
`python -m sau_service.main`  (local debug) both work.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import load_settings
from .login_pool import LoginPool
from .routes import accounts, login, upload
from .uploader import UploadManager

log = logging.getLogger("sau_service")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    app.state.settings = settings
    app.state.login_pool = LoginPool(ttl_seconds=settings.login_ticket_ttl_s)
    app.state.upload_manager = UploadManager(
        max_concurrency=settings.max_concurrency,
        mock_mode=settings.mock_mode,
        tmpfs_dir=settings.tmpfs_dir,
    )
    sweeper = asyncio.create_task(_sweep_loop(app))
    log.info(
        "sau-service ready (mock_mode=%s, concurrency=%d, login_ttl=%ds)",
        settings.mock_mode,
        settings.max_concurrency,
        settings.login_ticket_ttl_s,
    )
    try:
        yield
    finally:
        sweeper.cancel()
        try:
            await sweeper
        except asyncio.CancelledError:
            pass
        # Close any patchright browsers still attached to live tickets so the
        # container shuts down cleanly (chromium processes otherwise linger).
        try:
            await app.state.login_pool.shutdown_all()
        except Exception:  # noqa: BLE001
            log.exception("login_pool shutdown_all failed during lifespan exit")


async def _sweep_loop(app: FastAPI) -> None:
    """Periodically drop expired login sessions so memory doesn't leak."""
    while True:
        await asyncio.sleep(60)
        try:
            dropped = await app.state.login_pool.sweep_expired()
            if dropped:
                log.info("login sweep dropped %d expired session(s)", dropped)
        except Exception:  # noqa: BLE001
            log.exception("login sweep failed")


app = FastAPI(
    title="sau-service",
    description="AI Star Eco sau-service (Python + Playwright wrapper).",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(login.router)
app.include_router(accounts.router)
app.include_router(upload.router)


@app.get("/healthz")
async def healthz():
    settings = app.state.settings
    return {"ok": True, "mockMode": settings.mock_mode, "version": "0.1.0"}


def run() -> None:
    """`sau-service` console-script entry point."""
    import uvicorn

    uvicorn.run("sau_service.main:app", host="0.0.0.0", port=8090, reload=False)


if __name__ == "__main__":
    run()
