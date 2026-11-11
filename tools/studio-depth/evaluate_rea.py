"""Offline evaluation of rea-video's shot detector; not a production dependency.

Run through devq with numpy and opencv-python-headless<5 in an isolated venv.
Downloads only four source modules and their license at the pinned upstream commit.
No agent installer, model download, API keys or paid generation is involved.
"""
import argparse
import hashlib
import importlib
import json
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

REVISION = 'b32fbbdb074adbd72f54505114ed8600366cdaa5'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    vendor = out / 'upstream'
    hashes = {}
    for name in ('rea_video/__init__.py', 'rea_video/media.py', 'rea_video/util.py', 'rea_video/shots.py', 'LICENSE'):
        destination = vendor / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        url = f'https://raw.githubusercontent.com/JuneYaooo/rea-video/{REVISION}/{name}'
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        destination.write_bytes(data)
        hashes[name] = hashlib.sha256(data).hexdigest()
    sys.path.insert(0, str(vendor))
    media = importlib.import_module('rea_video.media')
    shots = importlib.import_module('rea_video.shots')
    import numpy as np
    import cv2

    fps, width, height, seconds = 24, 320, 180, 6
    yy, xx = np.mgrid[:height, :width]
    # Textured, distinct scenes keep histogram and motion evidence non-degenerate.
    a = np.stack(((xx * 2) % 150 + 70, (yy * 3) % 100, (xx + yy) % 90), axis=2).astype(np.uint8)
    b = np.stack(((yy * 2) % 80, (xx + yy) % 100 + 100, (xx * 3) % 100 + 100), axis=2).astype(np.uint8)

    def frame(case, n):
        if case == 'hard_cuts':
            return a if n < 48 or n >= 96 else b
        if case == 'short_insert':
            return b if 48 <= n < 54 else a
        if case == 'flash_return':
            return np.full_like(a, 255) if n == 48 else a
        if case == 'dissolve':
            mix = min(1, max(0, (n - 60) / 24))
            return (a * (1 - mix) + b * mix).astype(np.uint8)
        if case == 'pan':
            return np.roll(a, n * 2, axis=1)
        return a

    cases = {'hard_cuts': [2.0, 4.0], 'short_insert': [2.0, 2.25],
             'flash_return': [], 'dissolve': [3.0], 'pan': [], 'static': []}
    results = []
    for case, expected in cases.items():
        video = out / f'{case}.mp4'
        process = subprocess.Popen(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-f', 'rawvideo',
                                    '-pix_fmt', 'rgb24', '-s', f'{width}x{height}', '-r', str(fps),
                                    '-i', '-', '-an', '-c:v', 'libx264', '-threads', '2',
                                    '-pix_fmt', 'yuv420p', str(video)], stdin=subprocess.PIPE)
        try:
            for n in range(fps * seconds):
                process.stdin.write(frame(case, n).tobytes())
        finally:
            process.stdin.close()
        if process.wait(timeout=60) != 0:
            raise RuntimeError(f'Encoding failed: {case}')
        started = time.monotonic()
        detected = shots.detect_shots(shots.build_track(str(video), media.video_info(video)))
        actual = [shot.start for shot in detected[1:]]
        tolerance = .55 if case == 'dissolve' else 2 / fps
        unmatched = list(actual)
        misses = []
        for boundary in expected:
            nearest = min(unmatched, key=lambda t: abs(t - boundary), default=None)
            if nearest is not None and abs(nearest - boundary) <= tolerance:
                unmatched.remove(nearest)
            else:
                misses.append(boundary)
        results.append({'case': case, 'expected': expected, 'actual': actual,
                        'shots': [shot.to_dict() for shot in detected], 'misses': misses,
                        'falsePositives': unmatched, 'elapsedSeconds': round(time.monotonic() - started, 3),
                        'passed': not misses and not unmatched})
    report = {'upstream': 'https://github.com/JuneYaooo/rea-video', 'revision': REVISION,
              'sourceSha256': hashes, 'numpy': np.__version__, 'opencv': cv2.__version__,
              'scope': 'synthetic shot-boundary evaluation only; no semantic or generation-quality validation',
              'cases': results, 'passed': sum(r['passed'] for r in results), 'total': len(results)}
    (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
