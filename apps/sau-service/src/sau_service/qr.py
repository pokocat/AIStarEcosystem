"""Per-platform QR helpers.

In mock mode we render a deterministic placeholder PNG so the frontend can
display *something* without a real browser. The Slice 5 real-mode equivalent
will use Playwright to screenshot the login QR region; the public function
shape stays the same.
"""

from __future__ import annotations

import base64
import hashlib
import struct
import zlib


def build_mock_qr(platform: str, account_name: str) -> str:
    """Return a `data:image/png;base64,...` URL for a synthetic QR placeholder.

    The image is a tiny 8x8 PNG whose pixel pattern is derived from
    sha256(platform + account_name) — enough to be visually different per
    request, while keeping the byte stream entirely self-contained.
    """
    seed = hashlib.sha256(f"{platform}:{account_name}".encode("utf-8")).digest()
    # 8x8 grayscale PNG. We pack the first 8 bytes of the seed as 8 rows of 8 px.
    raw_rows: list[bytes] = []
    for i in range(8):
        row_byte = seed[i]
        # expand the byte into 8 grayscale pixels (each bit → 0xFF or 0x10)
        row = bytes(0xFF if (row_byte >> b) & 1 else 0x10 for b in range(8))
        raw_rows.append(b"\x00" + row)  # PNG filter byte per row
    raw = b"".join(raw_rows)
    return _wrap_png_data_url(_encode_png(8, 8, raw))


def _encode_png(width: int, height: int, raw: bytes) -> bytes:
    def chunk(tag: bytes, payload: bytes) -> bytes:
        body = tag + payload
        return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body))

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)  # 8-bit grayscale
    compressed = zlib.compress(raw)
    return signature + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")


def _wrap_png_data_url(png_bytes: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")
