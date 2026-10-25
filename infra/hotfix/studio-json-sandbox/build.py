#!/usr/bin/env python3
"""Build the narrow Sandbox module from the repository parser. No downloads, secrets, attach, or server mutation."""
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
p.add_argument('--source-commit', help='Full main commit when building an exact git archive without .git')
args = p.parse_args()
root = pathlib.Path(__file__).resolve().parents[3]
source = root / 'apps/server/src/main/java/com/aistareco/aep/ipstudio/service/ModelJson.java'
deps = [args.m2 / rel for rel in (
    'com/fasterxml/jackson/core/jackson-databind/2.17.2/jackson-databind-2.17.2.jar',
    'com/fasterxml/jackson/core/jackson-core/2.17.2/jackson-core-2.17.2.jar',
    'com/fasterxml/jackson/core/jackson-annotations/2.17.2/jackson-annotations-2.17.2.jar',
    'org/slf4j/slf4j-api/2.0.16/slf4j-api-2.0.16.jar')]
for item in deps + [args.sandbox / 'lib/sandbox-core.jar']:
    if not item.is_file():
        raise SystemExit('Required local dependency missing: ' + str(item))
args.output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='aep-json-module-') as tmp:
    tmp = pathlib.Path(tmp)
    parser = tmp / 'src/cn/aibuzz/hotfix/json/ModelJson.java'
    parser.parent.mkdir(parents=True)
    parser.write_text(source.read_text().replace('package com.aistareco.aep.ipstudio.service;', 'package cn.aibuzz.hotfix.json;'))
    classes = tmp / 'classes'
    classes.mkdir()
    subprocess.run([str(args.java_home / 'bin/javac'), '--release', '17', '-encoding', 'UTF-8', '-cp',
                    ':'.join(map(str, deps + [args.sandbox / 'lib/sandbox-core.jar'])), '-d', str(classes),
                    str(parser), str(pathlib.Path(__file__).with_name('JsonRecoveryModule.java'))], check=True)
    metadata = {'parserSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'moduleSha256': hashlib.sha256(pathlib.Path(__file__).with_name('JsonRecoveryModule.java').read_bytes()).hexdigest(),
                'sandboxVersion': (args.sandbox / 'cfg/version').read_text().strip(),
                'gitCommit': args.source_commit or subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()}
    if len(metadata['gitCommit']) != 40 or any(c not in '0123456789abcdef' for c in metadata['gitCommit']):
        raise SystemExit('source commit must be a full Git SHA')
    target = args.output / 'aep-json-recovery.jar'
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
        jar.writestr('META-INF/services/com.alibaba.jvm.sandbox.api.Module', 'cn.aibuzz.hotfix.JsonRecoveryModule\n')
        jar.writestr('META-INF/aep-json-recovery.json', json.dumps(metadata, indent=2) + '\n')
    metadata['jarSha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    (args.output / 'manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps({'artifact': str(target), **metadata}))
