#!/opt/aibuzz-id/runtime/python311/bin/python3
"""Forced SSH command for the dedicated AIStar background key."""
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path("/var/lib/aistar-depth-jobs")
RUNNER = "/opt/studio-depth/run.sh"
WEIGHTS = Path("/opt/studio-depth/weights")
MAX_INPUT_BYTES = 220 * 1024 * 1024


def numeric(value, minimum, maximum):
    if not re.fullmatch(r"[0-9]{3,4}", value) or not minimum <= int(value) <= maximum:
        raise ValueError("invalid resolution")
    return value


def copy_input(path):
    with path.open("xb") as target:
        remaining = MAX_INPUT_BYTES
        while block := sys.stdin.buffer.read(1024 * 1024):
            remaining -= len(block)
            if remaining < 0:
                raise ValueError("reference exceeds input limit")
            target.write(block)


def run_model(command, job):
    def interrupted(signum, _frame):
        raise InterruptedError(signum)

    for signum in (signal.SIGHUP, signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, interrupted)
    with subprocess.Popen(command, cwd=job, stdin=subprocess.DEVNULL, start_new_session=True) as process:
        try:
            return process.wait(timeout=1230)
        except (InterruptedError, subprocess.TimeoutExpired):
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
            raise


def main():
    args = os.environ.get("SSH_ORIGINAL_COMMAND", "").split()
    if args == ["version"]:
        return subprocess.call([RUNNER, "--version"], stdin=subprocess.DEVNULL)
    if len(args) < 2 or not re.fullmatch(r"[0-9a-f]{32}", args[1]):
        raise ValueError("invalid request")
    action, token, *arguments = args
    job = ROOT / token
    if job.is_symlink():
        raise ValueError("invalid job directory")
    if action == "upload" and not arguments:
        cutoff = time.time() - 7200
        for expired in ROOT.iterdir():
            if re.fullmatch(r"[0-9a-f]{32}", expired.name) and expired.is_dir() and not expired.is_symlink():
                if expired.stat().st_mtime < cutoff:
                    shutil.rmtree(expired)
        job.mkdir(mode=0o700)
        try:
            copy_input(job / "reference.mp4")
        except Exception:
            shutil.rmtree(job)
            raise
    elif action == "run-pose" and len(arguments) == 1:
        command = [RUNNER, "reference.mp4", "-o", "output.mp4", "--control", "pose",
                   "--checkpoint-dir", str(WEIGHTS / "dwpose"), "--keypoints", "keypoints.json",
                   "--target", "h3", "--max-res", numeric(arguments[0], 160, 1280)]
        return run_model(command, job)
    elif action == "run-depth" and len(arguments) == 2:
        size = numeric(arguments[1], 140, 924)
        if int(size) % 14:
            raise ValueError("invalid input resolution")
        command = [RUNNER, "reference.mp4", "-o", "output.mp4", "--control", "depth",
                   "--model", "small", "--checkpoint", str(WEIGHTS / "video_depth_anything_vits.pth"),
                   "--target", "h3", "--max-res", numeric(arguments[0], 160, 1280),
                   "--input-size", size]
        return run_model(command, job)
    elif action == "download" and arguments in (["output"], ["keypoints"]):
        name = "output.mp4" if arguments == ["output"] else "keypoints.json"
        with (job / name).open("rb") as source:
            shutil.copyfileobj(source, sys.stdout.buffer)
    elif action == "cleanup" and not arguments:
        if job.is_dir():
            shutil.rmtree(job)
    else:
        raise ValueError("operation denied")
    return 0


if __name__ == "__main__":
    os.umask(0o077)
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.TimeoutExpired):
        sys.exit("AIStar ReShot request rejected or incomplete")
