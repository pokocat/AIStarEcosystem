#!/usr/bin/env python3
"""启动 Studio 本机账号中心并恢复固定 dev fixture，不访问产品库或生产。"""
import argparse
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
IDENTITY = ROOT.parent / "aibuzz-id"
CONFIG = ROOT / "infra/local/studio-identity.yml"
STATE = ROOT / ".studio-e2e/unified-auth/local-identity"
BASE = "http://localhost:8098"
LOCAL_HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def request(path, data=None, token=None, form=False):
    headers = {}
    if data is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded" if form else "application/json"
        data = (urllib.parse.urlencode(data) if form else json.dumps(data)).encode()
    if token:
        headers["Authorization"] = "Bearer " + token
    method = "PUT" if path.endswith("/login-name") else None
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with LOCAL_HTTP.open(req, timeout=5) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # 不把可能含凭据的响应正文写到终端。
        raise RuntimeError(f"本地账号中心请求失败：HTTP {error.code} {path}") from None


def listener():
    result = subprocess.run(["lsof", "-nP", "-t", "-iTCP:8098", "-sTCP:LISTEN"],
                            capture_output=True, text=True)
    pids = set(result.stdout.split())
    if len(pids) > 1:
        raise RuntimeError("8098 有多个监听进程，请先检查本地服务")
    return int(next(iter(pids))) if pids else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--restart", action="store_true", help="重启 8098 上已确认的本机 aibuzz-id 进程")
    args = parser.parse_args()
    if any(p in os.environ.get("SPRING_PROFILES_ACTIVE", "").split(",")
           for p in ("prod", "production", "mysql")) or os.environ.get("NODE_ENV") == "production":
        raise RuntimeError("此脚本仅用于本机开发，不能在生产环境运行")
    if not (IDENTITY / "mvnw").is_file():
        raise RuntimeError(f"请先将 aibuzz-id 放到同级目录：{IDENTITY}")
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    secret_file = STATE / "fixture-secret"
    if not secret_file.exists():
        with secret_file.open("x") as file:
            os.chmod(secret_file, 0o600)
            file.write(secrets.token_urlsafe(48))
    fixture_secret = secret_file.read_text().strip()
    pid = listener()
    if pid:
        cmd = subprocess.check_output(["ps", "-p", str(pid), "-o", "command="], text=True)
        cwd = subprocess.check_output(["lsof", "-a", "-p", str(pid), "-d", "cwd", "-Fn"], text=True)
        if ("com.aibuzz.id.IdServerApplication" not in cmd
                or f"n{IDENTITY}\n" not in cwd):
            raise RuntimeError("8098 由其他程序使用，未停止该进程")
        if args.restart:
            os.kill(pid, signal.SIGTERM)
            deadline = time.monotonic() + 15
            while listener() and time.monotonic() < deadline:
                time.sleep(0.25)
            if listener():
                raise RuntimeError("旧账号中心尚未停止，请检查后再运行")
            pid = None
        elif str(CONFIG) not in cmd:
            raise RuntimeError("8098 仍使用旧配置；运行本脚本加 --restart 切换到固定本地配置")
    child = None
    if not pid:
        # 清除继承的身份服务配置，确保只能启动 dev、回环地址和本机文件库。
        env = {key: value for key, value in os.environ.items()
               if not key.startswith(("ID_", "SPRING_", "STUDIO_LOCAL_"))}
        env.update(SPRING_PROFILES_ACTIVE="dev", SERVER_PORT="8098", SERVER_ADDRESS="127.0.0.1",
                   STUDIO_LOCAL_FIXTURE_SECRET=fixture_secret,
                   STUDIO_LOCAL_ID_DATABASE=f"jdbc:h2:file:{STATE / 'database'};DB_CLOSE_ON_EXIT=FALSE")
        log_path = STATE / "identity.log"
        with log_path.open("a") as log:
            os.chmod(log_path, 0o600)
            child = subprocess.Popen(
                [str(IDENTITY / "mvnw"), "-q", "spring-boot:run",
                 f"-Dspring-boot.run.arguments=--spring.config.additional-location=file:{CONFIG}"],
                cwd=IDENTITY, env=env, stdout=log, stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL, start_new_session=True)
        deadline = time.monotonic() + 150
        while time.monotonic() < deadline:
            if child.poll() is not None:
                raise RuntimeError(f"本地账号中心启动失败，查看 {log_path}")
            try:
                discovery = request("/.well-known/openid-configuration")
                if discovery.get("issuer") != BASE:
                    raise RuntimeError("本地 issuer 不匹配")
                break
            except urllib.error.URLError:
                time.sleep(1)
        else:
            raise RuntimeError(f"本地账号中心启动超时，查看 {log_path}")
    # Tomcat 开始接请求之后才运行客户端 Seeder，首次启动需等初始化完成。
    deadline = time.monotonic() + (10 if child else 0)
    while True:
        try:
            token = request("/oauth2/token", dict(grant_type="client_credentials", client_id="admin-server",
                            client_secret=fixture_secret, scope="product.link admin.users"), form=True)["access_token"]
            break
        except RuntimeError:
            if time.monotonic() >= deadline:
                raise
            time.sleep(0.5)
    result = request("/api/products/admin/import-users",
                     [dict(localSubjectId="studio-local-dev", phone="13900000001")], token)["data"]["results"][0]
    uid = result.get("uid")
    if not uid:
        raise RuntimeError("本地测试账号导入失败，未修改任何产品权限")
    marker = STATE / "dev-account.json"
    if result["created"] or not marker.exists():
        request(f"/api/admin/users/{uid}/login-name", dict(loginName="dev", password="devdevdevdevdev"), token)
    with marker.open("w") as file:
        os.chmod(marker, 0o600)
        json.dump(dict(uid=uid, loginName="dev"), file)
    (STATE / "identity.pid").write_text(str(listener()))
    print("本地账号中心已就绪：http://localhost:8098；dev 测试账号已保存，重启保持同一 UID。")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, urllib.error.URLError) as error:
        raise SystemExit(str(error))
