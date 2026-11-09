#!/usr/bin/env python3
"""Deploy GPT Image endpoint configuration through the audited management API.

Run on the production host. Read {"apiKey": "..."} from stdin, never argv.
The default is a read-only plan. --apply requires a private backup directory.
"""
import argparse
import base64
import copy
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


BASE_URL = "https://superaitoken.ai/v1"
MODELS = {
    "gpt-image-2-1k-pic", "gpt-image-2-4k-pic",
    "gpt-image-2.5-flare-1k", "gpt-image-2.5-flare-4k",
    "gpt-image-2.5-sunburst-1k", "gpt-image-2.5-sunburst-4k",
}
PRESERVE_LIMITS = (
    "rpmLimit", "concurrencyLimit", "tpmLimit", "dailyTokenQuota",
    "dailyCostQuotaMicros", "alertFailureRatePct",
)


def endpoint_patch(endpoint):
    """Keep endpoint identity, model family, pricing and limits; use native edits for references."""
    model = endpoint["model"]
    if model not in MODELS:
        raise ValueError("Unmapped GPT Image model: " + model)
    spec = copy.deepcopy(endpoint["imageRequestSpec"])
    if not spec or not spec.get("wire"):
        raise ValueError("Missing native image specification: " + endpoint["id"])
    wire = spec["wire"]
    wire.update(resultMode="sync-url", outputPointer="/data/0/url")
    wire.pop("outputHosts", None)  # Result URLs are downloaded without a host allowlist.
    # Generations rejects image inputs with unexpected_image_input. With references
    # the client sends ordered files to edits; without references it sends JSON to generations.
    wire.update(inputMode="multipart", submitPath="/images/generations",
                referenceSubmitPath="/images/edits", modelQueryParam="",
                submitTemplate={"model": "${model}", "prompt": "${prompt}"})
    # This exact portrait size was generated and downloaded on 2026-11-09.
    # Restoring it lets the director keep GPT Image 2 at its existing 2K price.
    if model == "gpt-image-2-1k-pic" and not any(
            o["canvasSize"] == "1152x2048" for o in spec["outputs"]):
        spec["outputs"].append({"canvasSize": "1152x2048", "aspectRatio": "9:16",
                                "providerFields": {"n": 1, "size": "1152x2048"}})
    for output in spec["outputs"]:
        output["providerFields"]["response_format"] = "url"
    value = {"name": endpoint["name"].replace("OneToken", "SuperAIToken"),
             "baseUrl": BASE_URL, "model": model, "imageRequestSpec": spec}
    # EndpointAdminService clears omitted operational limits on update.
    value.update({key: endpoint.get(key) for key in PRESERVE_LIMITS})
    return {"action": "endpointSave", "id": endpoint["id"], "value": value}


def read_env(path):
    result = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            result[key] = value.strip().strip('"').strip("'")
    return result


def signed_token(command_json, action, secret):
    def enc(value):
        return base64.urlsafe_b64encode(value).rstrip(b"=").decode()
    now = int(time.time())
    header = enc(b'{"alg":"HS256","typ":"JWT"}')
    claims = {"iss": "aibuzz-platform", "aud": "aistar-model-management-v1",
              "sub": "gpt-image-channel-release", "scope": "platform", "action": action,
              "iat": now, "exp": now + 25, "jti": str(uuid.uuid4()),
              "commandHash": hashlib.sha256(command_json.encode()).hexdigest()}
    unsigned = header + "." + enc(json.dumps(claims, separators=(",", ":")).encode())
    return unsigned + "." + enc(hmac.new(bytes.fromhex(secret), unsigned.encode(), hashlib.sha256).digest())


def command(value, env):
    body = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    token = signed_token(body, value["action"], env["AEP_PLATFORM_MODEL_MANAGEMENT_KEY"])
    request = urllib.request.Request(
        "http://127.0.0.1:8080/api/service/model-management/v1/command",
        data=json.dumps({"commandJson": body}).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        # Never print a command: endpointSave carries the supplier key.
        detail = json.loads(error.read())
        raise RuntimeError(f'{value["action"]}: HTTP {error.code}, {detail.get("error", {}).get("code", "rejected")}') from None
    if not result.get("success"):
        raise RuntimeError(value["action"] + " was rejected")
    return result["data"]


def private_json(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def backup_rows(ids, env, directory):
    if any(not re.fullmatch(r"[a-zA-Z0-9_.:-]+", ident) for ident in ids):
        raise ValueError("Unsafe endpoint identifier")
    columns = ["id", "name", "base_url", "default_model", "api_key_encrypted", "image_request_spec_json"]
    fields = ",".join("'" + col + "'," + col for col in columns)
    sql = "SET SESSION TRANSACTION READ ONLY; SELECT JSON_OBJECT(" + fields + ") FROM ai_model_providers WHERE id IN (" + ",".join("'" + ident + "'" for ident in ids) + ");"
    db = urllib.parse.urlsplit(env["DB_URL"].removeprefix("jdbc:"))
    process_env = os.environ.copy()
    process_env["MYSQL_PWD"] = env["DB_PASSWORD"]
    result = subprocess.run(["mysql", "--protocol=TCP", "-h", db.hostname,
        "-P", str(db.port or 3306), "-u", env.get("DB_USERNAME", "root"),
        "--default-character-set=utf8mb4", "--batch", "--raw", "--skip-column-names",
        db.path.strip("/"), "-e", sql], env=process_env, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Database backup query failed")
    rows = [json.loads(line) for line in result.stdout.splitlines() if line]
    if {row["id"] for row in rows} != set(ids):
        raise RuntimeError("Incomplete endpoint backup")
    private_json(directory / "encrypted-endpoints-before.json", rows)
    def literal(value):
        return "NULL" if value is None else "CONVERT(0x" + str(value).encode().hex() + " USING utf8mb4)"
    rollback = ["START TRANSACTION;"]
    for row in rows:
        assignments = ",".join("`" + col + "`=" + literal(row[col]) for col in columns if col != "id")
        rollback.append("UPDATE ai_model_providers SET " + assignments + " WHERE id=" + literal(row["id"]) + ";")
    rollback.append("COMMIT;")
    fd = os.open(directory / "rollback.sql", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as handle:
        handle.write("\n".join(rollback) + "\n")


def deploy(args, api_key):
    env = read_env(args.env_file)
    endpoints = command({"action": "endpoints"}, env)
    selected = [e for e in endpoints if e.get("model", "").startswith("gpt-image-")]
    if not selected:
        raise RuntimeError("No GPT Image endpoints found")
    request = urllib.request.Request(BASE_URL + "/models", headers={"Authorization": "Bearer " + api_key})
    with urllib.request.urlopen(request, timeout=20) as response:
        available = {item["id"] for item in json.load(response)["data"]}
    changes = [endpoint_patch(endpoint) for endpoint in selected]
    if any(change["value"]["model"] not in available for change in changes):
        raise RuntimeError("The key cannot access every target model")
    print(json.dumps({"apply": args.apply, "endpoints": [{"id": c["id"], "model": c["value"]["model"],
        "baseUrl": c["value"]["baseUrl"], "inputMode": c["value"]["imageRequestSpec"]["wire"]["inputMode"],
        "sizes": [o["canvasSize"] for o in c["value"]["imageRequestSpec"]["outputs"]]} for c in changes]}), flush=True)
    if not args.apply:
        return
    directory = Path(args.backup_dir)
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    private_json(directory / "endpoints-before.json", selected)
    policies_before = command({"action": "scenePolicies"}, env)
    private_json(directory / "scene-policies-before.json", policies_before)
    backup_rows([e["id"] for e in selected], env, directory)
    for change in changes:
        change["value"]["apiKey"] = api_key
        saved = command(change, env)
        change["value"].pop("apiKey")
        if any(saved.get(k) != v for k, v in change["value"].items()):
            raise RuntimeError("Endpoint readback differs: " + change["id"])
        print(json.dumps({"saved": saved["id"], "model": saved["model"]}), flush=True)
    if command({"action": "scenePolicies"}, env) != policies_before:
        raise RuntimeError("Scene policies changed during deployment; inspect before continuing")
    private_json(directory / "applied.json", changes)
    print(json.dumps({"deployed": len(changes), "backupDir": str(directory), "scenePoliciesUnchanged": True}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", default="/etc/aistareco/server.env")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup-dir")
    options = parser.parse_args()
    if options.apply and not options.backup_dir:
        parser.error("--apply requires --backup-dir")
    try:
        deploy(options, json.load(sys.stdin)["apiKey"])
    except Exception as error:
        print(type(error).__name__ + ": " + str(error), file=sys.stderr)
        sys.exit(1)
