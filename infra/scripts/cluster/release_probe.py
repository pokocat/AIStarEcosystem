"""Run the fixed production account probe on a release node over SSH."""

import base64
import hashlib
import hmac
import http.client
import ipaddress
import json
import os
import socket
import ssl
import stat
import sys
import time


SUBJECT = "e5fa3eb7-ab72-4f16-9eb5-b6583217ff8b"
USERNAME = "aistar-release-probe"
HOST = "api.aibuzz.cn"
ENVIRONMENT = "/etc/aistar/server.json"
TOKEN_TTL = 90


def segment(value):
    return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=")


def account_token(key, now):
    if len(key) < 32:
        raise ValueError("Production signing key is unavailable")
    header = segment({"alg": "HS256"})
    claims = segment({
        "sub": SUBJECT,
        "username": USERNAME,
        "role": "PERSONAL",
        "iat": now,
        "exp": now + TOKEN_TTL,
    })
    message = header + b"." + claims
    signature = base64.urlsafe_b64encode(hmac.digest(key, message, hashlib.sha256)).rstrip(b"=")
    return (message + b"." + signature).decode("ascii")


def production_token():
    with os.fdopen(os.open(ENVIRONMENT, os.O_RDONLY | os.O_NOFOLLOW), encoding="utf-8") as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o600:
            raise ValueError("Production configuration must be root-owned and private")
        key = json.load(source)["AEP_JWT_SECRET"].encode()
    return account_token(key, int(time.time()))


def request(ip, path, token=None):
    if ip is None:
        connection = http.client.HTTPConnection("127.0.0.1", 8080, timeout=10)
    else:
        context = ssl.create_default_context()
        connection = http.client.HTTPSConnection(HOST, timeout=10, context=context)
    try:
        if ip is not None:
            connection.sock = context.wrap_socket(socket.create_connection((ip, 443), timeout=10), server_hostname=HOST)
        headers = {} if token is None else {"Authorization": "Bearer " + token}
        connection.request("GET", path, headers=headers)
        response = connection.getresponse()
        body = json.loads(response.read(64 * 1024))
        return response.status, body, response.getheader("X-Aistar-Node")
    finally:
        connection.close()


def matches_account(body):
    data = body.get("data") or {}
    return (
        body.get("success") is True
        and data.get("id") == SUBJECT
        and data.get("username") == USERNAME
        and data.get("status") == "active"
        and data.get("kind") == "personal"
        and data.get("operatorRole") is None
        and data.get("identityUid") is None
        and data.get("enrollments") == []
        and data.get("studio") is None
        and data.get("phone") is None
        and data.get("email") is None
        and data.get("hasPassword") is False
    )


def verify(ip, readiness, authenticated):
    result = {}
    if readiness:
        status, body, node = request(ip, "/internal/ready")
        result["ready"] = {"ok": status == 200 and body.get("ready") is True, "node": node}
    if authenticated:
        token = production_token()
        status, body, node = request(ip, "/api/me", token)
        result["account"] = {"ok": status == 200 and matches_account(body), "node": node}
        status, body, node = request(ip, "/api/me")
        result["anonymous"] = {
            "ok": status == 401 and body.get("error", {}).get("code") == "UNAUTHORIZED",
            "node": node,
        }
        status, body, node = request(ip, "/api/admin/auth/me", token)
        result["admin_denied"] = {
            "ok": status == 403 and body.get("error", {}).get("code") == "FORBIDDEN",
            "node": node,
        }
    return result


if __name__ == "__main__":
    try:
        spec = json.load(sys.stdin)
        ip = str(ipaddress.IPv4Address(spec["ip"])) if spec["ip"] is not None else None
        print(json.dumps(verify(ip, spec["readiness"] is True, spec["authenticated"] is True)))
    except (OSError, ValueError, KeyError, TypeError, http.client.HTTPException) as error:
        # An exception may contain request or response data. Return only its type.
        print(json.dumps({"error": type(error).__name__}))
