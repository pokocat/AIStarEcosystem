"""Patch the pinned upstream's Python 3.11 syntax and import every shipped driver.

Runs at image build time without launching a browser or contacting a platform.
Keep this exact patch until the pinned social-auto-upload commit is upgraded.
"""

import importlib
import importlib.util
from pathlib import Path
import tempfile


OLD = r'''f"预览区域内容: {all_text.strip().replace('\\n', ' ')}"'''
NEW = r'''"预览区域内容: " + all_text.strip().replace('\\n', ' ')'''


def patch_source(source):
    if source.count(OLD) == 1:
        source = source.replace(OLD, NEW)
    elif OLD in source or source.count(NEW) != 1:
        raise RuntimeError("Pinned Xiaohongshu source changed; review the compatibility patch")
    compile(source, "xiaohongshu_uploader/main.py", "exec")
    return source


def main():
    spec = importlib.util.find_spec("uploader")
    if spec is None or not spec.submodule_search_locations:
        raise RuntimeError("Real-mode upstream package is missing")
    target = Path(next(iter(spec.submodule_search_locations))) / "xiaohongshu_uploader/main.py"
    target.write_text(patch_source(target.read_text(encoding="utf-8")), encoding="utf-8")

    from sau_service.upstream_conf import ensure_upstream_conf

    with tempfile.TemporaryDirectory(prefix="sau-build-import-") as directory:
        ensure_upstream_conf(headless=True, base_dir=directory)
        for name, class_name in (
            ("douyin", "DouYinVideo"),
            ("tencent", "TencentVideo"),
            ("ks", "KSVideo"),
            ("xiaohongshu", "XiaoHongShuVideo"),
        ):
            module = importlib.import_module(f"uploader.{name}_uploader.main")
            getattr(module, class_name)
            print(f"Real driver import OK: {name}")


if __name__ == "__main__":
    main()
