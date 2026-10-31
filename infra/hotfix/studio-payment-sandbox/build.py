#!/usr/bin/env python3
"""Build the narrow payment module from the repository message policy. No downloads, secrets, attach, or server mutation."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import tempfile
import zipfile

p = argparse.ArgumentParser()
p.add_argument('--sandbox', type=pathlib.Path, required=True)
p.add_argument('--java-home', type=pathlib.Path, required=True)
p.add_argument('--output', type=pathlib.Path, required=True)
p.add_argument('--m2', type=pathlib.Path, default=pathlib.Path.home() / '.m2/repository')
p.add_argument('--target-class', type=pathlib.Path, required=True, help='Exact original production StudioPlanExecutor.class')
p.add_argument('--source-commit', help='Full main commit when building an exact git archive without .git')
args = p.parse_args()
root = pathlib.Path(__file__).resolve().parents[3]
source = root / 'apps/server/src/main/java/com/aistareco/aep/ipstudio/execution/StudioPaymentMessage.java'
deps = [] # module uses only the Sandbox API and JDK; application objects stay in their own loader
for item in deps + [args.sandbox / 'lib/sandbox-core.jar']:
    if not item.is_file():
        raise SystemExit('Required local dependency missing: ' + str(item))
args.output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='aep-json-module-') as tmp:
    tmp = pathlib.Path(tmp)
    parser = tmp / 'src/cn/aibuzz/hotfix/payment/StudioPaymentMessage.java'
    parser.parent.mkdir(parents=True)
    parser.write_text(source.read_text().replace('package com.aistareco.aep.ipstudio.execution;', 'package cn.aibuzz.hotfix.payment;'))
    classes = tmp / 'classes'
    classes.mkdir()
    subprocess.run([str(args.java_home / 'bin/javac'), '--release', '17', '-encoding', 'UTF-8', '-cp',
                    ':'.join(map(str, deps + [args.sandbox / 'lib/sandbox-core.jar'])), '-d', str(classes),
                    str(parser), str(pathlib.Path(__file__).with_name('PaymentRecoveryModule.java'))], check=True)
    metadata = {'targetExecutorSha256': hashlib.sha256(args.target_class.read_bytes()).hexdigest(), 'messagePolicySha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'moduleSha256': hashlib.sha256(pathlib.Path(__file__).with_name('PaymentRecoveryModule.java').read_bytes()).hexdigest(),
                'sandboxVersion': (args.sandbox / 'cfg/version').read_text().strip(),
                'gitCommit': args.source_commit or subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()}
    if len(metadata['gitCommit']) != 40 or any(c not in '0123456789abcdef' for c in metadata['gitCommit']):
        raise SystemExit('source commit must be a full Git SHA')
    target = args.output / 'aep-payment-recovery.jar'
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as jar:
        seen = set()
        for dependency in deps:
            with zipfile.ZipFile(dependency) as archive:
                for item in archive.infolist():
                    name = item.filename
                    if item.is_dir() or name in seen or name.endswith('module-info.class'):
                        continue
                    if name.startswith('META-INF/') and (name.endswith(('.SF', '.RSA', '.DSA')) or name == 'META-INF/MANIFEST.MF'):
                        continue
                    jar.writestr(name, archive.read(name))
                    seen.add(name)
        for file in sorted(classes.rglob('*.class')):
            jar.write(file, file.relative_to(classes).as_posix())
        jar.writestr('META-INF/aep-payment-target.properties', 'sha256=' + metadata['targetExecutorSha256'] + '\n')
        jar.writestr('META-INF/services/com.alibaba.jvm.sandbox.api.Module', 'cn.aibuzz.hotfix.PaymentRecoveryModule\n')
        jar.writestr('META-INF/aep-payment-recovery.json', json.dumps(metadata, indent=2) + '\n')
    metadata['jarSha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    (args.output / 'manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps({'artifact': str(target), **metadata}))
