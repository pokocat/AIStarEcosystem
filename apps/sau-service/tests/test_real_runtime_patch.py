"""The pinned upstream must compile on production Python without changing output."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "prepare_real_runtime",
    Path(__file__).parents[1] / "scripts/prepare_real_runtime.py",
)
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)


class RealRuntimePatchTest(unittest.TestCase):
    def test_preserves_debug_message_and_is_idempotent(self):
        source = "all_text = 'hello\\\\nworld'\nresult = " + patch.OLD
        fixed = patch.patch_source(source)
        namespace = {}
        exec(fixed, namespace)
        self.assertEqual(namespace["result"], "预览区域内容: hello world")
        self.assertEqual(patch.patch_source(fixed), fixed)

    def test_changed_upstream_fails_closed(self):
        with self.assertRaises(RuntimeError):
            patch.patch_source("result = 'different upstream'\n")

    def test_other_syntax_errors_still_fail(self):
        with self.assertRaises(SyntaxError):
            patch.patch_source("result = " + patch.OLD + "\ninvalid (\n")
