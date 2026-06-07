#!/usr/bin/env python3
# ============================================================
# 数字人资产平台 API 端到端测试（由 scripts/dap-verify.sh 驱动）
#   登录 → 账户/目录 → AI 创建（人设+4 变体）→ 挑选 → 迭代 → 精调
#   → 造型 → 图集 → 定稿入库 → 真人捕获（素材+核验+授权+复刻）
#   → 声音克隆 → 任务列表/重试语义 → 越权与未登录负例 → 扣费对账
# 仅用标准库；产物校验会真实下载字节。
# ============================================================
import json, os, sys, time, urllib.request, urllib.error, uuid

SERVER = os.environ.get("SERVER", "http://localhost:8080")
VIDEO = os.environ.get("VIDEO", "0") == "1"
AGNES = os.environ.get("AGNES", "real")
TIMEOUT_JOB = 420 if AGNES == "real" else 90

PASS = 0
FAIL = 0
def ok(name):
    global PASS; PASS += 1; print(f"PASS  e2e: {name}")
def bad(name, detail=""):
    global FAIL; FAIL += 1; print(f"FAIL  e2e: {name}  {detail}")

TOKEN = None
def req(method, path, body=None, token=True, raw=False, multipart=None, expect_error=False):
    url = SERVER + path
    headers = {}
    data = None
    if multipart is not None:
        boundary = "----dapE2E" + uuid.uuid4().hex[:12]
        parts = []
        for (name, filename, ctype, content) in multipart:
            parts.append(("--" + boundary).encode())
            if filename:
                parts.append(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode())
                parts.append(f"Content-Type: {ctype}".encode())
            else:
                parts.append(f'Content-Disposition: form-data; name="{name}"'.encode())
            parts.append(b"")
            parts.append(content if isinstance(content, bytes) else str(content).encode())
        parts.append(("--" + boundary + "--").encode())
        data = b"\r\n".join(parts)
        headers["Content-Type"] = "multipart/form-data; boundary=" + boundary
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token and TOKEN:
        headers["Authorization"] = "Bearer " + TOKEN
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            payload = resp.read()
            if raw:
                return resp.status, payload
            j = json.loads(payload or b"{}")
            return resp.status, (j.get("data") if isinstance(j, dict) and "data" in j else j)
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            j = json.loads(payload or b"{}")
        except Exception:
            j = {"raw": payload[:200].decode(errors="replace")}
        if not expect_error:
            print(f"      !! HTTP {e.code} {method} {path} -> {json.dumps(j, ensure_ascii=False)[:300]}")
        return e.code, j

def await_job(job_id, timeout=TIMEOUT_JOB):
    t0 = time.time()
    while time.time() - t0 < timeout:
        code, job = req("GET", f"/api/v1/jobs/{job_id}")
        if code != 200:
            return None, f"poll http {code}"
        st = job.get("status")
        if st == "done":
            return job, None
        if st == "failed":
            return job, job.get("error") or "failed"
        time.sleep(2 if AGNES == "real" else 1)
    return None, "timeout"

def fetch_asset(url_path, min_bytes=500):
    url = url_path if url_path.startswith("http") else SERVER + url_path
    r = urllib.request.Request(url, headers={"Authorization": "Bearer " + (TOKEN or "")})
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            b = resp.read()
            return len(b) >= min_bytes, len(b)
    except Exception as e:
        return False, str(e)

# 1x1 PNG（捕获/照片上传用）
TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009077"
    "53de0000000c4944415408d763f8cfc000000301010018dd8db00000000049"
    "454e44ae426082")

def main():
    global TOKEN
    # ── 登录 ──
    code, accounts = req("GET", "/api/auth/dev-accounts", token=False)
    if code != 200 or not accounts:
        bad("dev-accounts 可用", f"http {code}"); return finish()
    ok("dev-accounts 可用")
    username = accounts[0]["username"] if isinstance(accounts[0], dict) else "creator_luna"
    code, login = req("POST", "/api/auth/dev-login", {"username": username}, token=False)
    if code != 200 or "token" not in login:
        bad("dev-login", f"http {code}"); return finish()
    TOKEN = login["token"]
    ok(f"dev-login（{username}）")

    # ── 未登录负例 ──
    saved, TOKEN_BAK = TOKEN, TOKEN
    TOKEN = None
    code, _ = req("GET", "/api/v1/account", expect_error=True)
    TOKEN = TOKEN_BAK
    ok("未登录访问 /api/v1/account 被拒") if code == 401 else bad("未登录访问应 401", f"got {code}")

    # ── 账户（月度赠送）──
    code, acct = req("GET", "/api/v1/account")
    if code == 200 and acct.get("credits", 0) > 0:
        ok(f"账户 + 月度赠送（credits={acct['credits']}）")
    else:
        bad("账户/月度赠送", f"http {code} acct={acct}")

    # ── 目录 ──
    for path, n, name in [("/api/v1/voices/builtin", 7, "内置音色 7 款"),
                          ("/api/v1/scenes", 6, "场景库 6"),
                          ("/api/v1/templates", 6, "美化模板 6"),
                          ("/api/v1/applications", 3, "应用中心 3")]:
        code, lst = req("GET", path)
        ok(name) if code == 200 and isinstance(lst, list) and len(lst) == n else bad(name, f"http {code} len={len(lst) if isinstance(lst,list) else '?'}")
    code, pub = req("GET", "/api/v1/avatars?scope=public")
    ok("公开数字人") if code == 200 and len(pub) == 6 else bad("公开数字人", f"http {code}")

    # ── AI 创建 ──
    code, av = req("POST", "/api/v1/avatars", {"path": "ai"})
    if code != 200 or "id" not in av:
        bad("创建草稿资产", f"http {code}"); return finish()
    aid = av["id"]
    ok(f"创建草稿资产（{aid}）")

    code, job = req("POST", f"/api/v1/avatars/{aid}/generate",
                    {"mode": "describe", "form": {"desc": "一位 19 岁的星界少女，银白长发，星纱长裙，清冷治愈", "style": "二次元", "gender": "女"}})
    if code != 200:
        bad("提交形象生成", f"http {code}"); return finish()
    ok("提交形象生成（扣费 hold）")
    job, err = await_job(job["id"])
    if err:
        bad("形象生成完成", err); return finish()
    ok("形象生成完成（4 变体）")

    code, av = req("GET", f"/api/v1/avatars/{aid}")
    variants = av.get("variantImages") or []
    if len(variants) == 4:
        ok("4 张候选图就位")
        good, size = fetch_asset(variants[0])
        ok(f"候选图可下载（{size}B）") if good else bad("候选图下载", str(size))
    else:
        bad("候选图数量", f"{len(variants)}")
    if av.get("def", {}).get("设定语"):
        ok("人设解析（设定语非空）")
    else:
        bad("人设解析", f"def={json.dumps(av.get('def', {}), ensure_ascii=False)[:120]}")

    # ── 挑选 → 迭代 → 精调 ──
    code, av = req("POST", f"/api/v1/avatars/{aid}/pick", {"variantIndex": 1})
    ok("挑选候选 → iterating") if code == 200 and av.get("status") == "iterating" else bad("挑选候选", f"http {code} status={av.get('status')}")
    img_before = av.get("imageUrl")

    code, job = req("POST", f"/api/v1/avatars/{aid}/iterate", {"instruction": "发色改为银白色，眼神更温柔"})
    if code == 200:
        job, err = await_job(job["id"])
        if err:
            bad("迭代完成", err)
        else:
            code, av = req("GET", f"/api/v1/avatars/{aid}")
            changed = av.get("imageUrl") and av.get("imageUrl") != img_before
            ok("自然语言迭代（图已更新）") if changed else bad("迭代后图未变化")
    else:
        bad("提交迭代", f"http {code}")

    code, job = req("POST", f"/api/v1/avatars/{aid}/warp", {"face": -12, "eye": 8})
    if code == 200:
        job, err = await_job(job["id"])
        ok("几何精调") if not err else bad("几何精调", err)
    else:
        bad("提交精调", f"http {code}")

    code, vers = req("GET", f"/api/v1/avatars/{aid}/versions")
    ok(f"版本时间线（{len(vers)} 条）") if code == 200 and len(vers) >= 3 else bad("版本时间线", f"http {code} n={len(vers) if isinstance(vers,list) else '?'}")

    # ── 造型 ──
    code, look = req("POST", f"/api/v1/avatars/{aid}/looks", {"sceneId": "s5"})
    if code == 200:
        job_id = look.get("jobId")
        _, err = await_job(job_id) if job_id else (None, "no jobId")
        if err:
            bad("场景造型生成", err)
        else:
            code, looks = req("GET", f"/api/v1/avatars/{aid}/looks")
            done = [l for l in looks if l.get("status") == "done" and l.get("imageUrl")]
            ok("场景造型生成") if done else bad("造型列表无 done 项")
    else:
        bad("提交造型", f"http {code}")

    # ── 标准图集 → 定稿入库 ──
    code, job = req("POST", f"/api/v1/avatars/{aid}/derivatives", {"type": "atlas"})
    if code == 200:
        job, err = await_job(job["id"])
        if err:
            bad("标准图集", err)
        else:
            code, av = req("GET", f"/api/v1/avatars/{aid}")
            shots = av.get("shotImages") or {}
            ok(f"标准图集 5 机位（{len(shots)}）") if len(shots) == 5 else bad("图集机位数", f"{len(shots)}")
    else:
        bad("提交图集", f"http {code}")

    code, av = req("POST", f"/api/v1/avatars/{aid}/voice", {"voiceName": "亲和邻家女声"})
    ok("绑定音色") if code == 200 and av.get("voiceName") == "亲和邻家女声" else bad("绑定音色", f"http {code}")

    code, av = req("POST", f"/api/v1/avatars/{aid}/finalize", {"templateId": "t1", "confirmedShots": ["front-half"], "archive": True})
    ok("定稿入库（archived）") if code == 200 and av.get("status") == "archived" else bad("定稿入库", f"http {code} status={av.get('status')}")

    code, mine = req("GET", "/api/v1/avatars?scope=mine")
    ok("名录列表含新资产") if code == 200 and any(a.get("id") == aid for a in mine) else bad("名录列表", f"http {code}")

    # ── 真人捕获（上传素材路径）──
    code, av2 = req("POST", "/api/v1/avatars", {"path": "real", "name": "E2E 复刻者"})
    aid2 = av2.get("id")
    code, cap = req("POST", "/api/v1/captures", {"avatarId": aid2})
    if code == 200:
        ok("创建捕获会话")
        code, cap = req("POST", f"/api/v1/captures/{cap['id']}/footage",
                        multipart=[("file", "selfie.png", "image/png", TINY_PNG)])
        ok("上传捕获素材") if code == 200 else bad("上传捕获素材", f"http {code}")
        code, v = req("POST", f"/api/v1/captures/{cap['id']}/verify")
        ok("身份核验") if code == 200 and v.get("passed") else bad("身份核验", f"http {code}")
        code, lics = req("GET", "/api/v1/licenses")
        lic = next((l for l in lics if l.get("char") == aid2), None)
        ok("授权自动登记") if lic else bad("授权自动登记", f"n={len(lics)}")
        if lic:
            code, cert = req("GET", f"/api/v1/licenses/{lic['id']}/certificate")
            if code == 200 and cert.get("certificateUrl"):
                good, size = fetch_asset(cert["certificateUrl"], min_bytes=300)
                ok("授权凭证可下载") if good else bad("授权凭证下载", str(size))
            else:
                bad("授权凭证", f"http {code}")
        code, job = req("POST", f"/api/v1/avatars/{aid2}/generate", {"mode": "upload", "captureId": cap["id"]})
        if code == 200:
            job, err = await_job(job["id"])
            if err:
                bad("真人复刻生成", err)
            else:
                code, av2 = req("GET", f"/api/v1/avatars/{aid2}")
                ok("真人复刻生成（定妆图就位）") if av2.get("imageUrl") else bad("复刻无定妆图")
        else:
            bad("提交复刻", f"http {code}")
    else:
        bad("创建捕获会话", f"http {code}")

    # ── 声音克隆 ──
    code, voice = req("POST", "/api/v1/voices/clone",
                      multipart=[("file", "sample.webm", "audio/webm", b"\x1aE\xdf\xa3" + os.urandom(4000)),
                                 ("name", None, None, "E2E 测试声线"),
                                 ("avatarId", None, None, aid)])
    if code == 200 and voice.get("id"):
        ok("声音克隆登记")
        code, mine_v = req("GET", "/api/v1/voices/mine")
        ok("我的声线列表") if any(v.get("id") == voice["id"] for v in mine_v) else bad("声线列表缺新项")
        code, prev = req("POST", "/api/v1/voices/preview", {"voiceId": voice["id"]})
        ok("克隆声线试听（采样回放）") if code == 200 and prev.get("audioUrl") else bad("声线试听", f"http {code}")
    else:
        bad("声音克隆", f"http {code}")

    # ── 任务列表 + 取消语义 ──
    code, jobs = req("GET", "/api/v1/jobs")
    ok(f"任务列表（{len(jobs)} 条）") if code == 200 and len(jobs) >= 4 else bad("任务列表", f"http {code}")

    # ── 运镜视频（可选，耗时）──
    if VIDEO:
        code, job = req("POST", f"/api/v1/avatars/{aid}/derivatives", {"type": "video"})
        if code == 200:
            job, err = await_job(job["id"], timeout=1200 if AGNES == "real" else 120)
            if err:
                bad("运镜视频", err)
            else:
                code, ders = req("GET", f"/api/v1/avatars/{aid}/derivatives")
                vid = next((d for d in ders if d.get("key") == "video"), None)
                if vid and vid.get("fileUrl"):
                    good, size = fetch_asset(vid["fileUrl"], min_bytes=1000)
                    ok(f"运镜视频 MP4 落库（{size}B）") if good else bad("视频下载", str(size))
                else:
                    bad("视频衍生缺产物")
        else:
            bad("提交视频", f"http {code}")
    else:
        print("----  VIDEO=0 跳过运镜视频（VIDEO=1 开启）")

    # ── 越权负例：换账号读他人资产 ──
    if len(accounts) > 1:
        other = accounts[1]["username"]
        code, login2 = req("POST", "/api/auth/dev-login", {"username": other}, token=False)
        if code == 200:
            tok1 = TOKEN
            TOKEN = login2["token"]
            code, _ = req("GET", f"/api/v1/avatars/{aid}", expect_error=True)
            ok("越权读他人资产被拒（404）") if code == 404 else bad("越权应 404", f"got {code}")
            TOKEN = tok1

    # ── 扣费对账 ──
    code, acct2 = req("GET", "/api/v1/account")
    if code == 200 and acct2.get("creditsUsed", 0) > 0 and acct2.get("credits", 10**9) < acct.get("credits", 0):
        ok(f"扣费对账（已用 {acct2['creditsUsed']} 点，余额 {acct2['credits']}）")
    else:
        bad("扣费对账", f"before={acct.get('credits')} after={acct2.get('credits')} used={acct2.get('creditsUsed')}")
    if acct2.get("storageUsedGB", -1) >= 0:
        ok(f"存储统计（{acct2.get('storageUsedGB')} GB）")

    # ── 回收站：软删 → 列表 → 恢复 → 彻底删除 ──
    code, _ = req("DELETE", f"/api/v1/avatars/{aid}")
    ok("软删（移入回收站）") if code == 200 else bad("软删", f"got {code}")
    code, _ = req("GET", f"/api/v1/avatars/{aid}", expect_error=True)
    ok("软删后详情 404") if code == 404 else bad("软删后详情应 404", f"got {code}")
    code, tr = req("GET", "/api/v1/avatars/trash")
    in_trash = code == 200 and any(t.get("id") == aid for t in (tr or []))
    if in_trash:
        item = next(t for t in tr if t.get("id") == aid)
        ok(f"回收站可见（daysLeft={item.get('daysLeft')}）")
    else:
        bad("回收站列表", f"code={code} ids={[t.get('id') for t in (tr or [])]}")
    code, _ = req("POST", f"/api/v1/avatars/{aid}/restore")
    ok("回收站恢复") if code == 200 else bad("恢复", f"got {code}")
    code, _ = req("GET", f"/api/v1/avatars/{aid}")
    ok("恢复后详情可读") if code == 200 else bad("恢复后详情", f"got {code}")
    code, _ = req("DELETE", f"/api/v1/avatars/{aid}/purge", expect_error=True)
    ok("未删先 purge 被拒（400）") if code == 400 else bad("purge 前置校验应 400", f"got {code}")
    code, _ = req("DELETE", f"/api/v1/avatars/{aid}")
    code, _ = req("DELETE", f"/api/v1/avatars/{aid}/purge")
    ok("彻底删除") if code == 200 else bad("彻底删除", f"got {code}")
    code, tr2 = req("GET", "/api/v1/avatars/trash")
    if code == 200 and not any(t.get("id") == aid for t in (tr2 or [])):
        ok("彻底删除后回收站不可见")
    else:
        bad("彻底删除后回收站", f"code={code}")


    return finish()

def finish():
    print(f"\n----  e2e 小计：{PASS} PASS / {FAIL} FAIL")
    sys.exit(0 if FAIL == 0 else 1)

if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        bad("e2e 脚本异常", str(e))
        sys.exit(1)
