#!/usr/bin/env python3
"""Audit checkpointed M5/M6 results. Replay only saved request keys; never retry failures."""
import hashlib
import json
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

BASE = 'http://localhost:18080/api'

def call(method, route, body=None):
    request = urllib.request.Request(BASE + route, method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={'Content-Type': 'application/json', 'X-App-Code': 'aiavatar'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)['data']

def ledger():
    rows = []
    for page in range(100):
        batch = call('GET', f'/me/ledger?size=100&page={page}')
        rows.extend(batch)
        if len(batch) < 100:
            return rows
    raise AssertionError('Ledger exceeded bounded pagination')

assert not call('GET', '/v1/ip-studio/studio/capabilities')['mock']
before = ledger()
reports = []
for stage in ('m6', 'm5'):
    output = Path('.studio-e2e') / stage
    state = json.loads((output / 'checkpoint.json').read_text())
    project_id = state['projectId']
    project = call('GET', f'/v1/ip-studio/projects/{project_id}')
    (output / 'final-doc.json').write_text(json.dumps(project, ensure_ascii=False, indent=2))
    requests = {}
    node_runs = {}
    works = []
    for node in project['doc']['nodes']:
        studio = node.get('metadata', {}).get('studio', {})
        if studio.get('runId'):
            node_runs[studio['runId']] = node
            if studio.get('request') or studio.get('speechRequest') or studio.get('lipSyncRequest'):
                requests[studio['runId']] = studio.get('lipSyncRequest') or studio.get('speechRequest') or studio['request']
        for step in studio.get('batch', {}).get('steps', []):
            assert step.get('runId'), 'Saved production plan has an unsubmitted step'
            requests[step['runId']] = step['request']
    runs = {run_id: call('GET', f'/v1/ip-studio/runs/{run_id}') for run_id in node_runs}
    assert all(run['status'] == 'done' for run in runs.values()), 'A canvas run is not completed'
    for run_id, request in requests.items():
        route='lip-sync-runs' if 'videoStorageKey' in request and 'audioStorageKey' in request else 'speech-runs' if 'speaker' in request and 'text' in request else 'studio-runs'
        replay = call('POST', f'/v1/ip-studio/projects/{project_id}/{route}', request)
        assert replay['id'] == run_id and replay['status'] == 'done'
        if route=='lip-sync-runs' and replay['output'].get('lipSyncNormalized'):
            extraction=call('POST',f'/v1/ip-studio/projects/{project_id}/lip-sync-runs/{run_id}/extract')
            assert extraction['output']['storageKey']==replay['output']['storageKey'], 'Extraction produced another artifact'
    references = {run['output'].get('nativeVideoJobId', run['id']) for run in runs.values()}
    spends = [row for row in before if row['type'] == 'spend' and row['referenceId'] in references]
    assert len(spends) == len({row['referenceId'] for row in spends}), 'Duplicate settlement'
    cost = sum(run['cost'] for run in runs.values())
    assert -sum(row['amount'] for row in spends) == cost
    for run_id, node in node_runs.items():
        studio = node['metadata']['studio']
        if studio.get('kind') != 'work':
            continue
        key = runs[run_id]['output']['storageKey']
        request = urllib.request.Request(BASE + '/v1/ip-studio/assets/content?key=' + urllib.parse.quote(key),
            headers={'X-App-Code': 'aiavatar'})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
        name = f"episode-{studio.get('episodeNo', 'all')}-{run_id}.mp4"
        video = output / name
        video.write_bytes(data)
        assert hashlib.sha256(data).digest() == hashlib.sha256((Path('.studio-e2e/cdn') / key).read_bytes()).digest()
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(video)]))
        stream = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
        assert (stream['width'], stream['height'], stream['codec_name']) == (720, 1280, 'h264')
        assert any(stream['codec_type'] == 'audio' for stream in probe['streams'])
        source_duration=0
        for ref in runs[run_id]['inputs']['references']:
            source=Path('.studio-e2e/cdn') / ref['storageKey']
            source_probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(source)]))
            source_duration+=float(source_probe['format']['duration'])
        assert abs(float(probe['format']['duration'])-source_duration)<0.08+0.05*len(runs[run_id]['inputs']['references']), 'Assembly changed the source clip duration'
        works.append({'runId': run_id, 'episodeNo': studio.get('episodeNo'), 'path': str(video),
            'sha256': hashlib.sha256(data).hexdigest(), 'durationSec': float(probe['format']['duration']),
            'width': 720, 'height': 1280, 'audio': True, 'packaging': runs[run_id]['inputs'].get('packaging')})
    if stage == 'm6':
        assert sorted(work['episodeNo'] for work in works) == [1, 2]
    else:
        assert works and all(work['packaging']['captions'] for work in works), 'Real product packaging is required'
    ip_id = next(node['metadata']['studio']['adoption']['ipId'] for node in project['doc']['nodes']
        if node.get('metadata', {}).get('studio', {}).get('adoption'))
    usages = call('GET', f'/v1/assets/usages?assetType=ip&assetId={ip_id}')
    assert any(usage['usedById'] == project_id for usage in usages)
    reports.append({'stage': stage, 'projectId': project_id, 'runIds': list(runs), 'cost': cost,
        'spendEntries': len(spends), 'replayedRequests': len(requests), 'sourceIpUsageVerified': True, 'works': works})
after = ledger()
assert before == after, 'Replaying saved requests changed the ledger'
assert call('GET', '/me/wallet')['pendingBalance'] == 0
report = {'projects': reports, 'pending': 0, 'replayAddedCharges': False}
Path('.studio-e2e/extended-real-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
