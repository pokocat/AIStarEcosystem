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
# Subclass mocks keep the exact production target bytecode untouched before Sandbox retransforms it.
mockmaker = classes / 'mockito-extensions/org.mockito.plugins.MockMaker'
mockmaker.parent.mkdir(parents=True, exist_ok=True)
mockmaker.write_text('mock-maker-subclass\n')
here = pathlib.Path(__file__).resolve().parent
app_cp = ':'.join([str(classes), str(root / 'original'), args.classpath])
subprocess.run([str(args.java_home / 'bin/javac'), '--release', '17', '--add-modules', 'jdk.httpserver',
                '-cp', app_cp, '-d', str(classes), str(here / 'PaymentProbe.java'), str(here / 'ProbeLauncher.java')], check=True)
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
ready = []
while target.poll() is None:
    line = target.stdout.readline().strip()
    if line.startswith('READY '):
        ready = line.split()
        break
if ready[:1] != ['READY']:
    target.terminate()
    target.wait(timeout=10)
    raise SystemExit('Probe failed to start; inspect ' + str(root / 'application.log'))
port, pid = int(ready[1]), int(ready[2])
namespace = 'aep-payment-probe-' + str(pid)
evidence = {'pid': pid, 'healthErrors': [], 'healthSamples': 0, 'phases': {}}
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
                evidence['healthSamples'] += 1
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
    evidence['phases']['before'] = request('balance')
    assert evidence['phases']['before'][1]['status'] == 'running'
    assert evidence['phases']['before'][1]['inFlight'] == 320
    evidence['modules'] = sandbox_cmd('-l')
    evidence['frozenStatus'] = sandbox_cmd('-d', 'aep-payment-recovery/status')
    assert 'active=false' in evidence['frozenStatus']
    evidence['frozen'] = request('balance')
    assert evidence['frozen'][1]['status'] == 'running'
    sandbox_cmd('-a', 'aep-payment-recovery')
    evidence['phases']['active'] = {k: request(k) for k in ('balance','mixed','unknown','direct','preempt','regression')}
    for name, (code, result) in evidence['phases']['active'].items():
        assert code == 200 and result['pid'] == pid, (name,code,result)
    for name, expected in [('balance',0),('mixed',40)]:
        result=evidence['phases']['active'][name][1]
        assert result['status'] == 'needs_user' and result['inFlight'] == expected, (name,result)
    for name in ('unknown','preempt'):
        result=evidence['phases']['active'][name][1]
        assert result['status'] == 'running' and result['stepStatus'] == 'submitted' and result['inFlight'] == 320, (name,result)
    evidence['activeStatus'] = sandbox_cmd('-d', 'aep-payment-recovery/status')
    assert 'bridgeErrors=0' in evidence['activeStatus']
    sandbox_cmd('-u', 'aep-payment-recovery')
    evidence['phases']['unloaded'] = request('balance')
    assert evidence['phases']['unloaded'][1]['status'] == 'running'
    assert evidence['phases']['unloaded'][1]['inFlight'] == 320
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
