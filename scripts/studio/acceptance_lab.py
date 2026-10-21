#!/usr/bin/env python3
"""Local-only Studio acceptance lab. The vendor is simulated; app/DB/ledger/media remain real.

python3 scripts/studio/acceptance_lab.py media
python3 scripts/studio/acceptance_lab.py serve
python3 scripts/studio/acceptance_lab.py setup
No credentials or supplier prompt bodies are written to artifacts.
"""
import argparse
import copy
import json
import re
import subprocess
import threading
import time
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.studio-e2e/remaining-20261019'
BASE = 'http://localhost:18080/api'
PORT = 19090
CHAT = 'studio-e2e-controlled-chat'
VIDEO = 'studio-e2e-controlled-video'
STATE = {'dialogue': [], 'videoDelay': 0, 'holdVideos': False, 'holdTake': None, 'reject429': 0,
         'visualMemoryReject': 0, 'revision': 1}
JOBS = {}
LOCK = threading.Lock()


def call(method, path, body=None, token=None):
    headers = {'Content-Type': 'application/json', 'X-App-Code': 'aiavatar'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, method=method, headers=headers,
                                 data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            value = json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError((e.code, path, json.load(e))) from None
    return value.get('data')


def save(name, value):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2))


def media():
    from PIL import Image, ImageDraw, ImageFont
    OUT.mkdir(parents=True, exist_ok=True)
    for name, seconds, color, hz in [('source', 15, 'yellow', 220), ('segment', 5, 'orange', 330),
                                      ('take1', 4, 'red', 440), ('take2', 4, 'green', 550), ('take3', 4, 'blue', 660)]:
        target = OUT / (name + '.mp4')
        if target.exists():
            continue
        label = 'TEST SOURCE' if name == 'source' else 'TEST SEGMENT' if name == 'segment' else 'TEST ' + name.upper()
        frame = Image.new('RGB', (720, 1280), color)
        draw = ImageDraw.Draw(frame)
        draw.text((60, 400), label, font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 52), fill='black')
        frame_path = OUT / (name + '.png')
        frame.save(frame_path)
        subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-loop', '1', '-framerate', '24', '-i', str(frame_path),
                        '-f', 'lavfi', '-i', f'sine=frequency={hz}:duration={seconds}', '-t', str(seconds),
                        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', str(target)], check=True)
    for name, duration in [('voice-long', 16), ('voice-short', 8)]:
        target = OUT / (name + '.wav')
        if not target.exists():
            subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i',
                            f'sine=frequency=880:duration={duration}', '-c:a', 'pcm_s16le', str(target)], check=True)
    save('media-manifest.json', {'testOnly': True, 'files': [p.name for p in OUT.glob('*.mp4')] + [p.name for p in OUT.glob('*.wav')]})


def plan(stage):
    approach = {'id': 'test-rebuild', 'title': '测试素材重建', 'summary': '用明确标记的三段测试视频验证执行链路',
                'rationale': '只验收编排、计费与恢复，不评判真实生成质量', 'preserve': ['三段顺序'],
                'change': ['画面替换为测试色块'], 'tradeoffs': ['供应商响应是受控测试响应'], 'requiredCapabilities': []}
    if stage == 'analysis':
        steps = [{'id': 'compile', 'operation': 'text', 'title': '编排测试制作计划', 'prompt': '根据测试目标编排三段制作计划',
                  'execution': 'auto', 'settings': {'purpose': 'plan-compile'}, 'referenceNodeIds': [], 'dependsOn': []}]
    else:
        steps = []
        for i in range(1, 4):
            steps.append({'id': f'v{i}', 'operation': 'video', 'title': f'测试片段 {i}',
                          'prompt': f'TEST TAKE{i} REV{STATE["revision"] if i == 3 else 1}', 'execution': 'auto',
                          'strategy': {'approachId': 'test-rebuild', 'method': 'controlled-test', 'reason': '验证测试步骤'},
                          'settings': {'video': {'mode': 't2v', 'resolutionTier': '720p'}, 'durationSec': 4,
                                       'aspectRatio': '9:16', 'count': 1, 'referenceBindings': []},
                          'referenceNodeIds': [], 'dependsOn': [f'v{i-1}'] if i > 1 else []})
        steps.append({'id': 'c3', 'operation': 'check', 'title': '检查测试片段', 'prompt': '仅检查实测时长与段序',
                      'execution': 'auto', 'settings': {'targetStepId': 'v3', 'checkIds': ['duration-and-order']},
                      'referenceNodeIds': [], 'dependsOn': ['v3']})
        steps.append({'id': 'join', 'operation': 'assemble', 'title': '合成测试成片', 'prompt': '', 'execution': 'auto',
                      'settings': {'clipOrder': [{'stepId': f'v{i}'} for i in range(1, 4)], 'audioStrategy': 'generated'},
                      'referenceNodeIds': [], 'dependsOn': ['v1', 'v2', 'v3', 'c3']})
    return {'summary': '测试专用：' + ('先编排计划，确认后制作' if stage == 'analysis' else '制作三段带测试标识的视频并检查合成'),
            'approaches': [approach], 'recommendedApproachId': 'test-rebuild', 'steps': steps, 'questions': [], 'notes': ['本计划使用本地受控模型上游，不代表真实生成效果']}


class Vendor(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def respond(self, value, status=200):
        raw = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == '/state':
            return self.respond({'state': STATE, 'jobs': JOBS})
        if self.path.startswith('/files/'):
            name = Path(self.path).name
            target = OUT / name
            if not target.is_file() or target.suffix not in ('.mp4', '.wav'):
                return self.respond({'error': 'missing'}, 404)
            raw = target.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'video/mp4' if name.endswith('.mp4') else 'audio/wav')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if self.path.startswith('/tasks/'):
            job = JOBS.get(self.path.split('/')[-1])
            if not job:
                return self.respond({'error': 'missing'}, 404)
            held = STATE['holdVideos'] or STATE.get('holdTake') and job['file'] == f'take{STATE["holdTake"]}.mp4'
            done = not held and time.time() - job['created'] >= STATE['videoDelay']
            return self.respond({'status': 'succeeded' if done else 'running',
                                 'video_url': f'http://localhost:{PORT}/files/{job["file"]}' if done else None})
        return self.respond({'error': 'not found'}, 404)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        if self.path == '/control':
            with LOCK:
                STATE.update(body)
            return self.respond({'ok': True, 'state': STATE})
        if self.path == '/tasks':
            n = re.search(r'TAKE([123])', body.get('prompt', ''))
            name = 'take' + (n.group(1) if n else '1') + '.mp4'
            jid = 'test-' + uuid.uuid4().hex[:12]
            JOBS[jid] = {'created': time.time(), 'file': name, 'prompt': body.get('prompt', '')[:160]}
            return self.respond({'task_id': jid})
        if self.path not in ('/chat/completions', '/v1/chat/completions'):
            return self.respond({'error': 'not found'}, 404)
        messages = body.get('messages', [])
        system = str(messages[0].get('content', '')) if messages else ''
        user = str(messages[-1].get('content', '')) if messages else ''
        images = sum(1 for m in messages if isinstance(m.get('content'), list) for p in m['content'] if p.get('type') == 'image_url')
        with LOCK:
            if STATE['reject429'] > 0:
                STATE['reject429'] -= 1
                return self.respond({'error': {'code': 'rate_limit', 'message': 'TEST upstream 429'}}, 429)
            if STATE['visualMemoryReject'] > 0 and images:
                STATE['visualMemoryReject'] -= 1
                return self.respond({'error': {'code': 'unsupported_geometry', 'message': 'visual activation/HBM headroom budget'}}, 400)
        if '制作规划员' in system:
            production = '阶段：制作阶段' in user or '阶段：production' in user
            content = json.dumps(plan('production' if production else 'analysis'), ensure_ascii=False)
            kind = 'plan-production' if production else 'plan-analysis'
        elif '每项visible' in system:
            content = json.dumps({'frames': [{'visible': '测试色块与测试标记清晰可见', 'uncertainty': '无音轨转写'} for _ in range(images)]}, ensure_ascii=False)
            kind = 'vision-batch'
        elif 'segments' in system and 'endSec' in system or 'endSec' in user and body.get('response_format'):
            content = json.dumps({'segments': [{'endSec': 5}, {'endSec': 10}, {'endSec': 15}]})
            kind = 'film-boundaries'
        elif '连续对话' not in system and '检查' in system and ('items' in system or 'checkIds' in user):
            content = json.dumps({'items': [{'id': 'duration-and-order', 'status': 'pass', 'evidence': [{'kind': 'media', 'observation': '测试视频实测时长符合四秒配置'}], 'reason': '测试媒体时长符合配置', 'suggestion': ''}]}, ensure_ascii=False)
            kind = 'check'
        elif '连续对话' in system or '制作助手' in system and '工具' in system:
            with LOCK:
                response = STATE['dialogue'].pop(0) if STATE['dialogue'] else {'text': '测试响应：收到这条消息。'}
            content = response.get('text', '测试响应：我先整理方案。')
            if response.get('actions'):
                content += '\n<<<studio-actions>>>\n' + json.dumps(response['actions'], ensure_ascii=False)
            kind = 'dialogue'
        elif body.get('response_format'):
            content = json.dumps({'summary': '测试文字', 'content': 'TEST：受控测试文字，非真实模型生成。'}, ensure_ascii=False)
            kind = 'text'
        else:
            content = '# 测试分段报告\n\n画面是带 TEST 标记的色块，音轨未分析。仅用于执行链路验收。'
            kind = 'film-document'
        usage = {'prompt_tokens': 100, 'completion_tokens': 50}
        with (OUT / 'vendor-calls.jsonl').open('a') as f:
            f.write(json.dumps({'at': time.time(), 'kind': kind, 'images': images, 'stream': bool(body.get('stream')), 'usage': usage}) + '\n')
        if not body.get('stream'):
            return self.respond({'id': 'test-' + uuid.uuid4().hex, 'choices': [{'message': {'role': 'assistant', 'content': content}, 'finish_reason': 'stop'}], 'usage': usage})
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache, no-transform')
        self.end_headers()
        try:
            for i in range(0, len(content), 12):
                self.wfile.write(('data: ' + json.dumps({'choices': [{'delta': {'content': content[i:i+12]}}]}, ensure_ascii=False) + '\n\n').encode())
                self.wfile.flush()
                time.sleep(.08)
            self.wfile.write(('data: ' + json.dumps({'choices': [{'delta': {}, 'finish_reason': 'stop'}], 'usage': usage}) + '\n\ndata: [DONE]\n\n').encode())
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass


def setup():
    token = call('POST', '/admin/auth/login', {'username': 'admin', 'password': 'admin123'})['token']
    existing = {e['id']: e for e in call('GET', '/admin/ai-models', token=token)}
    endpoint = {'id': CHAT, 'name': '受控测试对话（模拟上游）', 'modelAlias': '受控测试对话', 'providerType': 'openai_compatible',
                'baseUrl': f'http://localhost:{PORT}', 'model': 'controlled-test', 'apiKey': 'local-test-only', 'enabled': True,
                'chatSupportsStreaming': True, 'chatSupportsTools': False, 'chatSupportsResponseFormat': True,
                'models': [{'id': 'controlled-test', 'label': '受控测试', 'supportsVision': True}]}
    call('PUT' if CHAT in existing else 'POST', '/admin/ai-models' + ('/' + CHAT if CHAT in existing else ''), endpoint, token)
    contract = {'modes': [{'mode': 't2v', 'needsFirstFrame': False, 'needsLastFrame': False}],
                'tiers': [{'tier': '720p', 'canvases': [{'aspectRatio': '9:16', 'width': 720, 'height': 1280}]}],
                'minSeconds': 4, 'maxSeconds': 15, 'promptMaxChars': 7000, 'seedMax': 2147483647}
    endpoint = {'id': VIDEO, 'name': '受控测试视频（模拟上游）', 'modelAlias': '受控测试视频', 'providerType': 'openai_compatible',
                'baseUrl': f'http://localhost:{PORT}', 'model': 'controlled-test-video', 'apiKey': 'local-test-only', 'enabled': True,
                'billingMode': 'PER_SECOND', 'unitPriceMicros': 0, 'videoRequestSpec': {'adapter': 'json-template',
                'contract': contract, 'submitPath': '/tasks', 'pollPathTemplate': '/tasks/{id}', 'requestFields': {},
                'requestTemplates': {'t2v': {'prompt': '${prompt}', 'duration': '${seconds}'}}}}
    call('PUT' if VIDEO in existing else 'POST', '/admin/ai-models' + ('/' + VIDEO if VIDEO in existing else ''), endpoint, token)
    for purpose, eid in [('DAP_PERSONA', CHAT), ('VIDEO_GENERATION', VIDEO)]:
        rows = call('GET', f'/admin/ai-app-bindings/{purpose}/candidates', token=token)
        known = any(x['endpointId'] == eid for x in rows)
        call('PUT' if known else 'POST', f'/admin/ai-app-bindings/{purpose}/candidates' + ('/' + eid if known else ''),
             {'endpointId': eid, 'enabled': True, 'creditCostOverride': 1, 'maxDurationSec': 15}, token)
    # Save the old default; setup changes only isolated local model configuration.
    bindings = call('GET', '/admin/ai-app-bindings', token=token)
    if not (OUT / 'bindings-before.json').exists():
        save('bindings-before.json', bindings)
    call('PUT', '/admin/ai-app-bindings/VIDEO_GENERATION', {'endpointId': VIDEO}, token)
    call('PUT', '/admin/ai-app-bindings/DAP_PERSONA', {'endpointId': CHAT}, token)
    call('PUT', '/admin/platform-configs/ai.model-access.' + VIDEO,
         {'value': {'categories': ['video'], 'scope': 'selected', 'appCodes': ['studio']}, 'description': '本地受控验收'}, token)
    call('PUT', '/admin/platform-configs/ai.app-model-group.studio.video',
         {'value': {'endpointIds': [VIDEO], 'defaultEndpointId': VIDEO}, 'description': '本地受控验收'}, token)
    configs = call('GET', '/admin/platform-configs/ai.chat-token-pricing', token=token)
    value = configs.get('value', configs.get('valueJson', configs))
    if isinstance(value, str):
        value = json.loads(value)
    value.setdefault('endpoints', {})[CHAT] = {'inputCreditsPerK': 1, 'outputCreditsPerK': 2, 'maxInputTokens': 32000, 'maxOutputTokens': 8192}
    call('PUT', '/admin/platform-configs/ai.chat-token-pricing', {'value': value, 'description': '本地受控验收价格'}, token)
    for eid, alias in [('studio-live-agnes-text', 'Agnes 2.5 Flash'), ('studio-live-agnes-text3', 'Agnes 3.0 Flash'), ('studio-live-agnes-image', 'Agnes Image')]:
        if eid in existing:
            call('PUT', '/admin/ai-models/' + eid, {'modelAlias': alias}, token)
    save('lab-config.json', {'base': BASE, 'provider': f'http://localhost:{PORT}', 'chat': CHAT, 'video': VIDEO, 'testOnly': True})
    print(json.dumps({'configured': [CHAT, VIDEO], 'testOnly': True}))


def upload(path):
    boundary = 'test-' + uuid.uuid4().hex
    mime = 'video/mp4' if path.suffix == '.mp4' else 'audio/wav'
    payload = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
               + path.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
    req = urllib.request.Request(BASE + '/v1/ip-studio/library/uploads?mediaType=' + ('video' if path.suffix == '.mp4' else 'audio'), method='POST', data=payload,
                                 headers={'X-App-Code': 'aiavatar', 'Content-Type': 'multipart/form-data; boundary=' + boundary})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)['data']


def seed():
    media()
    assets = {name: upload(OUT / (name + ext)) for name, ext in
              [('source', '.mp4'), ('segment', '.mp4'), ('take1', '.mp4'), ('take2', '.mp4'), ('take3', '.mp4'),
               ('voice-long', '.wav'), ('voice-short', '.wav')]}
    nodes = []
    for i, (name, asset) in enumerate(assets.items()):
        audio = name.startswith('voice')
        seconds = 16 if name == 'voice-long' else 8 if name == 'voice-short' else 15 if name == 'source' else 5 if name == 'segment' else 4
        studio = {'origin': 'upload'}
        if name.startswith('take'):
            studio.update({'kind': 'video', 'episodeNo': 1, 'request': {'operation': 'video', 'prompt': 'TEST ONLY ' + name,
                           'references': [{'storageKey': assets['source']['key'], 'role': 'reference-video'},
                                          {'storageKey': assets['segment']['key'], 'role': 'reference-video'}]}})
        md = {'storageKey': asset['key'], 'content': asset.get('url'), 'status': 'success', 'origin': 'upload' if not name.startswith('take') else 'derived', 'seconds': seconds, 'durationMs': seconds * 1000,
              'studio': studio, 'prompt': 'TEST ONLY：编号色块与不同频率音轨，用于排序、字幕、配音验收'}
        nodes.append({'id': name, 'type': 'audio' if audio else 'video', 'title': 'TEST · ' + name,
                      'position': {'x': i % 4 * 390, 'y': i // 4 * 550}, 'width': 330, 'height': 450 if not audio else 180,
                      'metadata': md})
    project = call('POST', '/v1/ip-studio/projects', {'name': 'TEST 剩余验收 · 成片素材'})
    doc = {'nodes': nodes, 'connections': [{'fromNodeId': source, 'toNodeId': take} for source in ['source', 'segment'] for take in ['take1', 'take2', 'take3']],
           'viewport': {'x': 20, 'y': 50, 'k': .5}}
    saved = call('PUT', f'/v1/ip-studio/projects/{project["id"]}', {'doc': doc, 'baseDocVersion': project['docVersion']})
    save('seed.json', {'projectId': saved['id'], 'assets': assets, 'testOnly': True})
    print(json.dumps({'projectId': saved['id'], 'assets': len(assets), 'testOnly': True}))


def seed_enterprise():
    """Local test ledger only: no payment gateway is involved."""
    context = call('POST', '/v1/ip-studio/enterprises', {'name': 'TEST E2E 企业', 'clientRequestId': uuid.uuid4().hex})
    eid, mid = context['enterprise']['id'], context['member']['id']
    base = '/v1/ip-studio/enterprises/' + eid
    order = call('POST', base + '/recharges', {'clientRequestId': uuid.uuid4().hex, 'requestedPriceCents': 100, 'note': '本地测试账本，不涉及实际付款'})
    token = call('POST', '/admin/auth/login', {'username': 'admin', 'password': 'admin123'})['token']
    call('POST', '/admin/finance/enterprise-recharges/' + order['id'] + '/confirm', {'clientRequestId': uuid.uuid4().hex, 'priceCents': 100, 'credits': 1000, 'receiptReference': 'TEST-LOCAL', 'note': '本地验收测试积分'}, token)
    items = [{'memberId': mid, 'amount': 800}]
    preview = call('POST', base + '/points/allocate/preview', {'items': items})
    call('POST', base + '/points/allocate', {'clientRequestId': uuid.uuid4().hex, 'confirmationFingerprint': preview['confirmationFingerprint'], 'items': items})
    policy = call('GET', base + '/policy')
    call('PUT', base + '/policy', {'allowedEndpointIds': [CHAT, VIDEO], 'maxActiveJobs': 5, 'version': policy['version']})
    save('enterprise-seed.json', {'context': context, 'wallet': call('GET', base + '/wallet'), 'balance': call('GET', base + '/my-balance')})
    print(json.dumps({'enterpriseId': eid, 'testOnly': True}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['media', 'serve', 'setup', 'seed', 'enterprise'])
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.command == 'media':
        media()
    elif args.command == 'setup':
        setup()
    elif args.command == 'seed':
        seed()
    elif args.command == 'enterprise':
        seed_enterprise()
    else:
        print(f'TEST ONLY vendor on 127.0.0.1:{PORT}', flush=True)
        ThreadingHTTPServer(('127.0.0.1', PORT), Vendor).serve_forever()
