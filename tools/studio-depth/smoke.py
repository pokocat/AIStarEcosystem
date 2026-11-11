"""Real temporal depth inference on a synthetic moving scene. No model-provider charges or private material.
Run under devq. This checks preprocessing, not the quality of a generated character's performance.
"""
import json
import os
import pathlib
import subprocess
import sys

import cv2
import imageio_ffmpeg

root = pathlib.Path(os.environ['STUDIO_DEPTH_HOME'])
out = pathlib.Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
source = out / 'reference.mp4'
depth = out / 'depth.mp4'
subprocess.run([ffmpeg, '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                'testsrc2=size=720x1280:rate=24:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(source)], check=True)
subprocess.run([str(root / 'venv/bin/reshot'), str(source), '-o', str(depth), '--control', 'depth',
                '--model', 'small', '--checkpoint', str(root / 'weights/video_depth_anything_vits.pth'),
                '--target', 'h3', '--quality', 'fast', '--metrics', str(out / 'metrics.json')], check=True)
capture = cv2.VideoCapture(str(depth))
count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
fps = capture.get(cv2.CAP_PROP_FPS)
ok, frame = capture.read()
capture.release()
assert ok and count == 48 and abs(fps - 24) < .01, (count, fps)
assert frame.std() > 10, 'Depth image must contain spatial structure, not a flat placeholder'
assert abs(frame[:, :, 0].astype(float) - frame[:, :, 2]).mean() < 2, 'Depth must be greyscale'
print(json.dumps({'source': str(source), 'depth': str(depth), 'frames': count, 'fps': fps,
                  'width': frame.shape[1], 'height': frame.shape[0], 'bytes': depth.stat().st_size,
                  'realDepthInference': True}))
