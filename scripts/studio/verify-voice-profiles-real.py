#!/usr/bin/env python3
"""Audit saved real speech and voice versions; never submit a new supplier request."""
import hashlib,json,urllib.request
from pathlib import Path
BASE='http://localhost:18080/api'
ROOT=Path('.studio-e2e/voice-profiles')
def call(method,path,body=None):
    req=urllib.request.Request(BASE+path,method=method,headers={'Content-Type':'application/json','X-App-Code':'aiavatar'},data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(req,timeout=60) as response:return json.load(response)['data']
def ledger():
    rows=[]
    for page in range(100):
        batch=call('GET',f'/me/ledger?size=100&page={page}');rows+=batch
        if len(batch)<100:return rows
    raise AssertionError('Ledger pagination exceeded audit bound')
state=json.loads((ROOT/'checkpoint.json').read_text());before=ledger();catalog=call('GET','/v1/ip-studio/studio/voice-profiles')
profiles=sorted((v for v in catalog['profiles'] if v['avatarId']=='DH-39773'),key=lambda v:v['version']);assert [v['version'] for v in profiles]==[1,2]
one,two=profiles;assert one['voiceId']==state['voiceId'];person=next(a for a in catalog['performers'] if a['avatarId']==one['avatarId'])
call('PUT',f"/v1/ip-studio/studio/performers/{person['avatarId']}/voice",{'voiceId':two['voiceId'],'expectedVoiceId':person.get('voiceId')})
original=call('GET','/v1/ip-studio/runs/'+state['runId']);replay=call('POST',f"/v1/ip-studio/projects/{state['projectId']}/speech-runs",state['request'])
assert replay['id']==original['id'] and replay['status']=='done' and replay['inputs']['appliedVoice']['voiceId']==one['voiceId'] and replay['output']==original['output']
prior=call('GET','/v1/ip-studio/runs/'+one['sourceRunId']);oldRequest={k:v for k,v in prior['inputs'].items() if k not in ('appliedVoice',)}
oldReplay=call('POST',f"/v1/ip-studio/projects/{state['projectId']}/speech-runs",oldRequest);assert oldReplay['id']==prior['id']
for v in profiles:
    adopted=call('POST',f"/v1/ip-studio/projects/{state['projectId']}/adopt-voice",{'runId':v['sourceRunId'],'avatarId':person['avatarId'],'name':v['name'],'expectedVoiceId':None});assert adopted['voiceId']==v['voiceId']
current=call('GET','/v1/ip-studio/studio/voice-profiles');assert next(a for a in current['performers'] if a['avatarId']==person['avatarId'])['voiceId']==two['voiceId']
call('PUT',f"/v1/ip-studio/studio/performers/{person['avatarId']}/voice",{'voiceId':one['voiceId'],'expectedVoiceId':two['voiceId']})
usage=call('GET',f"/v1/assets/usages?assetType=voice&assetId={one['voiceId']}");assert any(u['usedById']==state['projectId'] for u in usage)
after=ledger();assert after==before,'Replay/default switching changed ledger'
initial=json.loads((ROOT/'before-ledger.json').read_text());added=[row for row in after if row['id'] not in {r['id'] for r in initial}];spends=[r for r in added if r['type']=='spend'];assert len(spends)==1 and spends[0]['referenceId']==state['runId'] and spends[0]['amount']==-8
assert len([r for r in after if r['type']=='spend' and r['referenceId']==state['runId']])==1
proof=json.loads((ROOT/'bound-audio-proof.json').read_text());report={'runId':state['runId'],'status':original['status'],'cost':original['cost'],'durationSec':original['output']['durationSec'],'profiles':profiles,'appliedVoice':original['inputs']['appliedVoice'],'sha256':proof['sha256'],'usage':usage,'ledgerNewSpends':spends,'replayLedgerUnchanged':True,'defaultChangeReusedHistoricalVersion':True}
(ROOT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:report[k] for k in ['runId','status','cost','durationSec','replayLedgerUnchanged','defaultChangeReusedHistoricalVersion']},ensure_ascii=False))
