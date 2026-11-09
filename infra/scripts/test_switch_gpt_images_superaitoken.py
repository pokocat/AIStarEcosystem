import copy
import hashlib
import hmac
import importlib.util
import json
import base64
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("switch_images", Path(__file__).with_name("switch-gpt-images-superaitoken.py"))
switch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(switch)


class EndpointConfigurationTest(unittest.TestCase):
    def endpoint(self, model="gpt-image-2-1k-pic", mode="url"):
        return {"id": "image-endpoint", "model": model, "name": "OneToken · GPT Image",
                "rpmLimit": 12, "concurrencyLimit": 3, "dailyCostQuotaMicros": 2000000,
                "unitPriceMicros": 123, "billingMode": "PER_CALL",
                "imageRequestSpec": {"promptMaxChars": 32000, "referenceField": "multiple",
                    "outputs": [{"canvasSize": "2048x1152", "aspectRatio": "16:9",
                                 "providerFields": {"size": "2048x1152", "n": 1, "response_format": "b64_json"}}],
                    "wire": {"inputMode": mode, "submitPath": "/images/generations",
                             "referenceSubmitPath": "/images/edits" if mode == "multipart" else None,
                             "submitTemplate": {"model": "wrong-generic-model", "prompt": "${prompt}"},
                             "outputHosts": ["old.example"], "resultMode": "sync-base64"}}}

    def test_native_edits_preserve_limits_and_use_exact_model_and_url(self):
        for model in switch.MODELS:
            with self.subTest(model=model):
                endpoint = self.endpoint(model, "multipart" if "2.5" in model else "url")
                before = copy.deepcopy(endpoint)
                change = switch.endpoint_patch(endpoint)
                value = change["value"]
                self.assertEqual(endpoint, before)
                self.assertEqual(change["id"], endpoint["id"])
                self.assertEqual(value["model"], model)
                self.assertEqual(value["rpmLimit"], 12)
                self.assertEqual(value["concurrencyLimit"], 3)
                self.assertEqual(value["dailyCostQuotaMicros"], 2000000)
                self.assertNotIn("unitPriceMicros", value)
                self.assertNotIn("billingMode", value)
                wire = value["imageRequestSpec"]["wire"]
                self.assertEqual(wire["submitTemplate"]["model"], "${model}")
                self.assertEqual(wire["inputMode"], "multipart")
                self.assertEqual(wire["referenceSubmitPath"], "/images/edits")
                self.assertEqual(wire["submitPath"], "/images/generations")
                self.assertEqual(set(wire["submitTemplate"]), {"model", "prompt"})
                self.assertEqual(wire["resultMode"], "sync-url")
                self.assertEqual(wire["outputPointer"], "/data/0/url")
                self.assertNotIn("outputHosts", wire)
                self.assertTrue(all(o["providerFields"]["response_format"] == "url" for o in value["imageRequestSpec"]["outputs"]))

    def test_restores_tested_portrait_without_duplicates(self):
        endpoint = self.endpoint()
        value = switch.endpoint_patch(endpoint)["value"]
        portrait = [o for o in value["imageRequestSpec"]["outputs"] if o["aspectRatio"] == "9:16"]
        self.assertEqual([o["canvasSize"] for o in portrait], ["1152x2048"])
        endpoint["imageRequestSpec"] = value["imageRequestSpec"]
        self.assertEqual(switch.endpoint_patch(endpoint)["value"]["imageRequestSpec"], endpoint["imageRequestSpec"])

    def test_unmapped_model_cannot_be_silently_replaced(self):
        with self.assertRaises(ValueError):
            switch.endpoint_patch(self.endpoint("unmapped-image-model"))

    def test_management_token_is_bound_to_exact_action_and_command(self):
        command = '{"action":"endpoints"}'
        secret = "01" * 32
        token = switch.signed_token(command, "endpoints", secret)
        header, payload, signature = token.split(".")
        decode = lambda s: base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
        claims = json.loads(decode(payload))
        self.assertEqual(claims["commandHash"], hashlib.sha256(command.encode()).hexdigest())
        self.assertEqual(claims["action"], "endpoints")
        self.assertEqual(claims["aud"], "aistar-model-management-v1")
        self.assertLessEqual(claims["exp"] - claims["iat"], 30)
        self.assertEqual(decode(signature), hmac.new(bytes.fromhex(secret), (header + "." + payload).encode(), hashlib.sha256).digest())


if __name__ == "__main__":
    unittest.main()
