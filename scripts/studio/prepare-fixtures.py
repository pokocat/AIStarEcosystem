#!/usr/bin/env python3
"""Import user-authorized online exports as deterministic model responses. No API calls."""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--image', action='append', required=True)
parser.add_argument('--video', required=True)
parser.add_argument('--out', default='.studio-fixtures')
args = parser.parse_args()
destination = Path(args.out).resolve()
destination.mkdir(parents=True, exist_ok=True)
entries = []
images = []
for index, source_name in enumerate(args.image):
    source = Path(source_name).resolve()
    target = destination / f'image-{index+1}{source.suffix.lower()}'
    if source != target:
        shutil.copyfile(source, target)
    images.append(target.name)
    entries.append({'file': target.name, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
source = Path(args.video).resolve()
video = destination / 'video-1.mp4'
if source != video:
    shutil.copyfile(source, video)
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(video)]))
assert any(stream.get('codec_type') == 'video' for stream in probe['streams']), 'Fixture has no video stream'
duration = float(probe['format']['duration'])
entries.append({'file': video.name, 'sha256': hashlib.sha256(video.read_bytes()).hexdigest()})
script = json.loads((Path(__file__).parent / 'fixtures/script.json').read_text())
manifest = {'schemaVersion': 1, 'images': images, 'video': video.name, 'videoDurationSec': duration,
            'script': script, 'files': entries,
            'provenance': {'media': 'User-authorized exports from the online test project IPP-3c324f13',
                           'text': 'Curated deterministic test script; it is not a generated or production result'}}
(destination / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print(f'Prepared {len(images)} images, {duration:g}s video, and a three-shot script in {destination}')
