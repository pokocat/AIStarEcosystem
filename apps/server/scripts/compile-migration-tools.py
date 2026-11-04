#!/usr/bin/env python3
"""Compile fixed-scope rehearsal helpers against the actual packaged application dependencies."""
from pathlib import Path
import zipfile,subprocess,tempfile,os
root=Path(__file__).resolve().parents[3];server=root/'apps/server';artifact=server/'target/ai-star-eco-server-1.0.0.jar';sources=sorted((root/'infra/migration').glob('*.java'))
if not sources or not artifact.is_file():raise SystemExit('Packaged server artifact and migration sources required')
with tempfile.TemporaryDirectory(prefix='migration-tool-',dir=server/'target') as tmp:
 folder=Path(tmp)
 with zipfile.ZipFile(artifact) as jar:
  for entry in jar.infolist():
   if entry.filename.startswith('BOOT-INF/lib/') and entry.filename.endswith('.jar'):
    (folder/Path(entry.filename).name).write_bytes(jar.read(entry))
 dest=server/'target/migration-tools';dest.mkdir(exist_ok=True)
 javac=str(Path(os.environ['JAVA_HOME'])/'bin/javac') if os.environ.get('JAVA_HOME') else 'javac'
 subprocess.run([javac,'-cp',str(folder/'*'),'-d',str(dest),*[str(p) for p in sources]],check=True)
 print('Compiled',len(sources),'rehearsal helpers; no production restore mode')
