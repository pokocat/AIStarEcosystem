#!/usr/bin/env python3
"""Run controlled acceptance through the local HTTP API; does not claim browser acceptance."""
import json
import sys
import time
import urllib.request
import uuid
import acceptance_lab as lab


def control(**values):
    req = urllib.request.Request(f'http://localhost:{lab.PORT}/control', data=json.dumps(values).encode(),
                                 headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def await_value(read, predicate, timeout=300):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        value = read()
        if predicate(value):
            return value
        time.sleep(.5)
    lab.save('last-timeout.json', value)
    raise AssertionError('Timed out; see last-timeout.json')


def state(pid):
    return lab.call('GET', f'/v1/ip-studio/projects/{pid}/conversation')


def post(pid, text, **kw):
    return lab.call('POST', f'/v1/ip-studio/projects/{pid}/conversations/IPT-{pid}/messages',
                    {'clientMessageId': uuid.uuid4().hex, 'text': text, 'model': lab.CHAT, 'maxCost': 49, **kw})


def cards(s, kind):
    return [b for m in s['messages'] for b in m.get('blocks', []) if b.get('type') == kind]


def approve(pid, s):
    card = next(b for b in reversed(cards(s, 'approval')) if b.get('status') == 'pending')
    control(dialogue=[{'text': 'TEST：按你的确认开始。', 'actions': [{'tool': 'confirm_approval', 'args': {'approvalId': card['approvalId']}}]},
                      {'text': 'TEST：已提交确认。'}])
    return post(pid, '可以')


def button_approve(pid, s, cap=None):
    owner, card = next((m, b) for m in reversed(s['messages']) for b in m.get('blocks', [])
                       if b.get('type') == 'approval' and b.get('status') == 'pending')
    block = next(b for b in reversed(cards(s, 'plan')) if b['fingerprint'] == card['planFingerprint'])
    request = {'clientRequestId': uuid.uuid4().hex, 'stage': card['stage'], 'planRunId': block['planRunId'],
               'planFingerprint': card['planFingerprint'], 'budgetCap': cap if cap is not None else card['budgetCap'],
               'autoFixCap': card.get('autoFixCap', 0), 'approvalId': card['approvalId'], 'confirmationMessageId': owner['id']}
    if card.get('billingSelection'):
        request['billing'] = card['billingSelection']
    if card['stage'] == 'production' or card.get('executionId'):
        request.update(executionId=card.get('executionId') or s['execution']['id'], expectedRevision=block['revision'])
    if card['stage'] == 'production':
        request['approachId'] = block['plan'].get('recommendedApproachId')
    return lab.call('POST', f'/v1/ip-studio/projects/{pid}/plan-executions', request)


def begin(name, billing=None):
    control(dialogue=[{'text': 'TEST ONLY：整理测试分析计划。', 'actions': [{'tool': 'propose_plan', 'args': {'brief': '仅验收测试流程', 'stage': 'analysis'}}]},
                      {'text': 'TEST ONLY：请确认测试范围和额度。', 'actions': [{'tool': 'request_approval', 'args': {'scope': ['先编排三段测试视频的制作计划']}}]}])
    p = lab.call('POST', '/v1/ip-studio/projects', {'name': 'TEST · ' + name})
    pid = p['id']
    state(pid)
    post(pid, '请复刻测试视频，先给分析计划。', skillKey='reference-video-recreation', **({'billing': billing} if billing else {}))
    s = await_value(lambda: state(pid), lambda s: not s['thread'].get('activeTurnId') and cards(s, 'approval'))
    print('Analysis card', pid, flush=True)
    approve(pid, s)
    s = await_value(lambda: state(pid), lambda s: s.get('execution') and s['execution']['stage'] == 'analysis' and len(cards(s, 'approval')) > 1)
    print('Production card', s['execution']['id'], flush=True)
    lab.save(name + '-before-production.json', s)
    return pid, s


def boundary_cases(name, paused_raise=False):
    control(holdVideos=False, holdTake=3, revision=1)
    pid, s = begin(name)
    estimated = cards(s, 'plan')[-1]['plan']['budget']['estimated']
    e = button_approve(pid, s, estimated)
    eid = e['id']
    e = await_value(lambda: execution(pid, eid), lambda e: bool(next(x for x in e['steps'] if x['id'] == 'v3')['runIds']))
    control(dialogue=[{'text': 'TEST：这条补充不改计划。'}])
    post(pid, '不用调整制作计划，保持原方案继续。')
    control(holdTake=None)
    s = await_value(lambda: state(pid), lambda s: s.get('execution', {}).get('status') == 'needs_user' and not s['thread'].get('activeTurnId'))
    e = s['execution']
    if '预算不够' not in e.get('needsUserReason', ''):
        try:
            command(pid, eid, 'resume', e['status'])
        except RuntimeError as error:
            if 'STUDIO_PLAN_BUDGET_EXCEEDED' not in str(error):
                raise
            current = state(pid)
            if not any(b.get('status') == 'pending' for b in cards(current, 'approval')):
                lab.save(name + '-result.json', {'verdict': 'fail', 'projectId': pid, 'reason': 'Resume rejects over-budget without producing a raise card', 'error': str(error), 'state': current})
                command(pid, eid, 'cancel', current['execution']['status'])
                print(name, 'FAIL: resume budget deadend; see report', flush=True)
                return
    e = await_value(lambda: execution(pid, eid), lambda e: e['status'] == 'needs_user' and '预算不够' in e.get('needsUserReason', ''))
    print(name, 'shortfall', e['budgets'][-1].get('shortfall'), flush=True)
    if paused_raise:
        command(pid, eid, 'pause', 'needs_user')
    s = state(pid)
    raised = button_approve(pid, s)
    assert raised['status'] == ('paused' if paused_raise else 'running'), raised
    if paused_raise:
        assert not next(x for x in raised['steps'] if x['id'] == 'c3')['runIds']
        command(pid, eid, 'resume', 'paused')
    final = await_value(lambda: execution(pid, eid), lambda e: e['status'] in ['done', 'failed'], 180)
    lab.save(name + '-result.json', {'projectId': pid, 'blocked': e, 'afterRaise': raised, 'final': final, 'state': state(pid)})
    print(name, final['status'], flush=True)


def replan():
    control(holdVideos=False, holdTake=3, revision=1)
    pid, s = begin('replan')
    e = button_approve(pid, s, 200)
    eid = e['id']
    e = await_value(lambda: execution(pid, eid), lambda e: bool(next(x for x in e['steps'] if x['id'] == 'v3')['runIds']))
    before = {x['id']: x['runIds'] for x in e['steps']}
    control(revision=2, dialogue=[{'text': 'TEST：只修改第三段。', 'actions': [{'tool': 'propose_plan', 'args': {'brief': '第3段更换人物，第一二段保持', 'stage': 'production'}}]},
                                 {'text': 'TEST：请确认第三段修订。', 'actions': [{'tool': 'request_approval', 'args': {'scope': ['只修改第三段和其后续检查'], 'budgetCap': 200}}]}])
    posted = post(pid, '第 3 段换个人物，前两段保持。')
    control(holdTake=None)
    s = await_value(lambda: state(pid), lambda s: not s['thread'].get('activeTurnId') and any(b.get('status') == 'pending' for b in cards(s, 'approval')), timeout=180)
    lab.save('replan-before-confirm.json', s)
    try:
        button_approve(pid, s, 200)
        early = 'accepted-after-task-finished'
    except RuntimeError as error:
        assert '还在生成中' in str(error), error
        early = str(error)
        await_value(lambda: execution(pid, eid), lambda e: next(x for x in e['steps'] if x['id'] == 'v3')['status'] == 'done')
        button_approve(pid, state(pid), 200)
    lab.save('replan-inflight-confirm.json', {'result': early})
    final = await_value(lambda: execution(pid, eid), lambda e: e['status'] in ['done', 'failed'], timeout=180)
    after = {x['id']: x['runIds'] for x in final['steps']}
    assert after['v1'] == before['v1'] and after['v2'] == before['v2'], (before, after)
    assert after['v3'] != before['v3'] and next(x for x in final['steps'] if x['id'] == 'v3')['attempt'] == 2, (before, after)
    lab.save('replan-result.json', {'projectId': pid, 'post': posted, 'before': before, 'final': final, 'state': state(pid)})
    print('replan', final['status'], 'v1/v2 preserved, v3 retried once', flush=True)


def execution(pid, eid):
    return lab.call('GET', f'/v1/ip-studio/projects/{pid}/plan-executions/{eid}')


def command(pid, eid, action, status):
    return lab.call('POST', f'/v1/ip-studio/projects/{pid}/plan-executions/{eid}/{action}',
                    {'clientRequestId': uuid.uuid4().hex, 'expectedStatus': status})


def pause_resume():
    control(holdVideos=True)
    before = lab.call('GET', '/me/wallet')
    pid, s = begin('pause-resume')
    eid = s['execution']['id']
    approve(pid, s)
    e = await_value(lambda: execution(pid, eid), lambda e: e['stage'] == 'production' and any(x['runIds'] for x in e['steps'] if x['id'] == 'v1'))
    paused = command(pid, eid, 'pause', e['status'])
    assert paused['status'] == 'paused', paused
    control(holdVideos=False)
    e = await_value(lambda: execution(pid, eid), lambda e: next(x for x in e['steps'] if x['id'] == 'v1')['status'] == 'done')
    assert e['status'] == 'paused' and not next(x for x in e['steps'] if x['id'] == 'v2')['runIds'], e
    print('Pause refreshed accepted run without submitting v2', flush=True)
    command(pid, eid, 'resume', 'paused')
    final = await_value(lambda: execution(pid, eid), lambda e: e['status'] in ['done', 'failed', 'partial', 'needs_user'], timeout=180)
    after = lab.call('GET', '/me/wallet')
    lab.save('pause-resume-result.json', {'projectId': pid, 'before': before, 'after': after, 'execution': final,
                                       'conversation': state(pid)})
    print('Final', final['status'], final.get('needsUserReason'), flush=True)


def real_agnes():
    token = lab.call('POST', '/admin/auth/login', {'username': 'admin', 'password': 'admin123'})['token']
    lab.call('PUT', '/admin/ai-models/studio-live-agnes-text3', {'chatSupportsStreaming': True}, token)
    if (lab.OUT / 'agnes-stream-result.json').exists():
        pid = json.loads((lab.OUT / 'agnes-stream-result.json').read_text())['projectId']
    else:
        p = lab.call('POST', '/v1/ip-studio/projects', {'name': 'TEST · Agnes 真实流式与视觉'})
        pid = p['id']
        state(pid)
        before = lab.call('GET', '/me/wallet')
        reply = post(pid, '请分三句话说明保温杯宣传视频的制作步骤，不生成任何素材。', model='studio-live-agnes-text3', maxCost=21)
        final = await_value(lambda: state(pid), lambda s: not s['thread'].get('activeTurnId'), timeout=180)
        lab.save('agnes-stream-result.json', {'projectId': pid, 'post': reply, 'before': before,
                                            'after': lab.call('GET', '/me/wallet'), 'state': final})
        print('Agnes dialogue', pid, [m['status'] for m in final['messages'] if m['role'] == 'assistant'], flush=True)
    fixture = json.loads((lab.OUT / 'seed.json').read_text())
    source = lab.call('GET', '/v1/ip-studio/projects/' + fixture['projectId'])['doc']['nodes'][0]
    report = {'id': 'study', 'type': 'text', 'title': 'TEST · Agnes 分段报告', 'position': {'x': 400, 'y': 0},
              'width': 360, 'height': 320, 'metadata': {'studio': {'kind': 'recreation', 'recreation': {'mode': 'segments', 'sourceNodeId': 'source', 'sourceStorageKey': source['metadata']['storageKey']}}}}
    lab.call('PUT', f'/v1/ip-studio/projects/{pid}', {'doc': {'nodes': [source, report], 'connections': [{'fromNodeId': 'source', 'toNodeId': 'study'}], 'viewport': {'x': 0, 'y': 0, 'k': 1}},
                                                 'baseDocVersion': lab.call('GET', f'/v1/ip-studio/projects/{pid}')['docVersion']})
    before = lab.call('GET', '/me/wallet')
    native = lab.call('POST', f'/v1/ip-studio/projects/{pid}/studio-runs',
                      {'clientRequestId': uuid.uuid4().hex, 'nodeId': 'study', 'operation': 'recreation',
                       'prompt': '只记录可见的色块和 TEST 标记，按三段分段覆盖完整十五秒；不要推测音频。',
                       'model': 'studio-live-agnes-text3', 'mode': 'segments', 'contextNodeIds': ['source'],
                       'maxCost': 21, 'recreation': {'maxSegmentSec': 'model', 'videoModel': lab.VIDEO}})
    result = await_value(lambda: lab.call('GET', '/v1/ip-studio/runs/' + native['id']), lambda r: r['status'] not in ['running', 'queued'], timeout=300)
    lab.save('agnes-film-result.json', {'projectId': pid, 'before': before, 'after': lab.call('GET', '/me/wallet'), 'run': result})
    print('Agnes film', result['status'], result.get('errorCode'), flush=True)


def enterprise():
    seeded = json.loads((lab.OUT / 'enterprise-seed.json').read_text())
    enterprise_id = seeded['context']['enterprise']['id']
    billing = {'mode': 'enterprise', 'enterpriseId': enterprise_id}
    control(holdVideos=True, holdTake=None, revision=1)
    pid, s = begin('enterprise', billing)
    e = button_approve(pid, s, 300)
    e = await_value(lambda: execution(pid, e['id']), lambda e: bool(next(x for x in e['steps'] if x['id'] == 'v1')['runIds']))
    before = {'personal': lab.call('GET', '/me/wallet'), 'enterprise': lab.call('GET', f'/v1/ip-studio/enterprises/{enterprise_id}/my-balance')}
    for i in range(3):
        control(dialogue=[{'text': 'TEST：企业付款下的补充对话。'}])
        post(pid, f'第{i+1}条备注：暂时不用改计划。')
        await_value(lambda: state(pid), lambda x: not x['thread'].get('activeTurnId'))
    after = {'personal': lab.call('GET', '/me/wallet'), 'enterprise': lab.call('GET', f'/v1/ip-studio/enterprises/{enterprise_id}/my-balance')}
    current = execution(pid, e['id'])
    lab.save('enterprise-result.json', {'projectId': pid, 'before': before, 'after': after, 'execution': current, 'state': state(pid)})
    assert before['personal'] == after['personal'], (before, after)
    assert before['enterprise']['totalBalance'] - after['enterprise']['totalBalance'] == current['budgets'][-1]['dialogueSpent'], (before, after)
    command(pid, e['id'], 'cancel', current['status'])
    control(holdVideos=False)
    print('enterprise 3 messages, settled dialogue credits match enterprise debit; personal unchanged', flush=True)


def stop_intents():
    control(holdVideos=True, holdTake=None, revision=1)
    pid, s = begin('stop-intents')
    e = button_approve(pid, s, 300)
    e = await_value(lambda: execution(pid, e['id']), lambda e: bool(next(x for x in e['steps'] if x['id'] == 'v1')['runIds']))
    records = []
    for text in ['不要停', '要停吗？', '暂停一下', '先停']:
        control(dialogue=[{'text': 'TEST：按普通补充理解。'}])
        before = lab.call('GET', '/me/wallet')
        response = post(pid, text)
        s = await_value(lambda: state(pid), lambda x: not x['thread'].get('activeTurnId'))
        records.append({'text': text, 'response': response, 'status': execution(pid, e['id'])['status'], 'before': before, 'after': lab.call('GET', '/me/wallet'), 'state': s})
        lab.save('stop-intents-result.json', {'projectId': pid, 'records': records, 'execution': execution(pid, e['id'])})
    lab.save('stop-intents-result.json', {'projectId': pid, 'records': records})
    control(holdVideos=False)
    print([(x['text'], x['status']) for x in records], flush=True)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'pause-resume':
        pause_resume()
    elif len(sys.argv) > 1 and sys.argv[1] == 'agnes':
        real_agnes()
    elif len(sys.argv) > 1 and sys.argv[1] == 'budget-auto':
        boundary_cases('budget-auto')
    elif len(sys.argv) > 1 and sys.argv[1] == 'budget-paused':
        boundary_cases('budget-paused', True)
    elif len(sys.argv) > 1 and sys.argv[1] == 'enterprise':
        enterprise()
    elif len(sys.argv) > 1 and sys.argv[1] == 'stop-intents':
        stop_intents()
    elif len(sys.argv) > 1 and sys.argv[1] == 'replan':
        replan()
    else:
        raise SystemExit('Use: acceptance_cases.py pause-resume|agnes|budget-auto|budget-paused|replan|enterprise|stop-intents')
