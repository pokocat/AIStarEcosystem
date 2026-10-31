#!/usr/bin/env python3
"""Exercise attach -> frozen -> active -> unload in a dedicated Java 17 process, never a production PID."""
import argparse
import json
import os
import pathlib
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.request

p = argparse.ArgumentParser()
p.add_argument('--sandbox', type=pathlib.Path, required=True)
p.add_argument('--module', type=pathlib.Path, required=True)
p.add_argument('--java-home', type=pathlib.Path, required=True)
p.add_argument('--probe-root', type=pathlib.Path, required=True)
p.add_argument('--classpath', required=True)
args = p.parse_args()
root = args.probe_root.resolve()
root.mkdir(parents=True, exist_ok=True)
classes = root / 'classes'
classes.mkdir(exist_ok=True)
here = pathlib.Path(__file__).resolve().parent
app_cp = ':'.join([str(classes), str(root / 'original'), args.classpath])
subprocess.run([str(args.java_home / 'bin/javac'), '--release', '17', '--add-modules', 'jdk.httpserver',
                '-cp', app_cp, '-d', str(classes), str(here / 'ProbeApp.java'), str(here / 'ProbeLauncher.java')], check=True)
sandbox = root / 'sandbox'
shutil.copytree(args.sandbox, sandbox, dirs_exist_ok=True)
modules = sandbox / 'sandbox-module'
modules.mkdir(exist_ok=True)
shutil.copyfile(args.module, modules / args.module.name)
(sandbox / 'cfg/sandbox.properties').write_text('user_module=' + str(modules) + ';\nunsafe.enable=false\nserver.charset=UTF-8\n')
env = os.environ.copy()
env['JAVA_HOME'] = str(args.java_home)
env['SANDBOX_HOME_DIR'] = str(sandbox)
log = (root / 'application.log').open('w')
target = subprocess.Popen([str(args.java_home / 'bin/java'), '--add-modules', 'jdk.httpserver', '-cp', str(classes),
                           'ProbeLauncher', app_cp, str(root)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=log, text=True)
ready = target.stdout.readline().strip().split()
if ready[:1] != ['READY']:
    raise SystemExit('Probe failed to start; inspect ' + str(root / 'application.log'))
port, pid = int(ready[1]), int(ready[2])
namespace = 'aep-json-probe-' + str(pid)
evidence = {'pid': pid, 'healthErrors': [], 'phases': {}}
stop = threading.Event()

def request(name):
    try:
        r = urllib.request.urlopen(f'http://127.0.0.1:{port}/probe?{name}', timeout=8)
        return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)

def health():
    while not stop.wait(.1):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=5) as r:
                if r.status != 200:
                    evidence['healthErrors'].append(str(r.status))
        except Exception as e:
            evidence['healthErrors'].append(type(e).__name__)

def sandbox_cmd(*argv):
    r = subprocess.run(['bash', str(sandbox / 'bin/sandbox.sh'), '-p', str(pid), '-n', namespace,
                        '-I', '127.0.0.1', *argv], env=env, cwd=sandbox / 'bin', text=True, capture_output=True, timeout=45)
    if r.returncode:
        raise RuntimeError(r.stdout + r.stderr)
    return r.stdout.strip()

t = threading.Thread(target=health, daemon=True)
t.start()
try:
    evidence['phases']['before'] = {k: request(k) for k in ('valid', 'han', 'real1', 'real2') if not k.startswith('real') or (root / (k + '.json')).exists()}
    assert evidence['phases']['before']['han'][0] == 502
    evidence['modules'] = sandbox_cmd('-l')
    evidence['frozenStatus'] = sandbox_cmd('-d', 'aep-json-recovery/status')
    assert 'active=false' in evidence['frozenStatus']
    assert request('han')[0] == 502
    sandbox_cmd('-a', 'aep-json-recovery')
    evidence['probe'] = sandbox_cmd('-d', 'aep-json-recovery/probe')
    evidence['phases']['active'] = {k: request(k) for k in evidence['phases']['before']}
    for k, (status, result) in evidence['phases']['active'].items():
        assert status == 200 and result['applicationNode'] and result['pid'] == pid, (k, status, result)
    expected = {'real1': '98b9c7aaa71c3764f43992aabed53af6f287c0e5feed45dad19f30431e139596',
                'real2': '11f9ffa03cf68c8a884d9ff7d64a6fe345e7d8c53bb9f4aa5923ceed78a619fc'}
    for k, sha in expected.items():
        if k in evidence['phases']['active']:
            assert evidence['phases']['active'][k][1]['sha256'] == sha
    evidence['rejected'] = {k: request(k) for k in ('half', 'ascii', 'missing')}
    for status, result in evidence['rejected'].values():
        assert status == 502 and result['code'] == 'AI_BAD_OUTPUT' and '无法自动恢复' in result['message']
    evidence['activeStatus'] = sandbox_cmd('-d', 'aep-json-recovery/status')
    assert 'bridgeErrors=0' in evidence['activeStatus']
    sandbox_cmd('-u', 'aep-json-recovery')
    evidence['phases']['unloaded'] = {k: request(k) for k in ('valid', 'han')}
    assert evidence['phases']['unloaded']['valid'][0] == 200
    assert evidence['phases']['unloaded']['han'][0] == 502
    assert not evidence['healthErrors'], evidence['healthErrors']
    evidence['pass'] = True
    print(json.dumps(evidence, ensure_ascii=False))
finally:
    try:
        sandbox_cmd('-S')
    except Exception as e:
        evidence['shutdownError'] = str(e)
    stop.set()
    target.stdin.write('\n')
    target.stdin.flush()
    try:
        target.wait(timeout=12)
    except subprocess.TimeoutExpired:
        target.kill()  # Dedicated probe only; this command never accepts a production PID.
        target.wait()
    log.close()
    (root / 'evidence.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
