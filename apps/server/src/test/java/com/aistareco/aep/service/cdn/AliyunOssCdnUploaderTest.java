package com.aistareco.aep.service.cdn;

import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AliyunOssCdnUploaderTest {

    @Test
    void publicUrlKeepsKnownAbsoluteSeedMediaKeyWhenLocalPrefixDiffers() {
        AliyunOssCdnUploader uploader = uploader("test_media", "media");

        assertEquals(
                "https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/seed/flova/skills/demo.mp4",
                uploader.publicUrlFor("media/seed/flova/skills/demo.mp4")
        );
    }

    @Test
    void publicUrlStillPrefixesOrdinaryRelativeKeys() {
        AliyunOssCdnUploader uploader = uploader("test_media", "media");

        assertEquals(
                "https://aiartist.oss-cn-hangzhou.aliyuncs.com/test_media/drama/render/demo.mp4",
                uploader.publicUrlFor("drama/render/demo.mp4")
        );
    }

    @Test
    void browserUploadPolicyPinsOneObjectExactSizeMimeAndV4Credential() {
        AliyunOssCdnUploader uploader = uploader("media", "media");
        CdnUploader.BrowserUploadTicket ticket = uploader.browserUpload(
                "clip_clone_avatar/u-1/demo.mp4", "video/mp4", 1234, 1234, Instant.now().plusSeconds(300));

        assertEquals("https://aiartist.oss-cn-hangzhou.aliyuncs.com", ticket.uploadUrl());
        assertEquals("media/clip_clone_avatar/u-1/demo.mp4", ticket.formData().get("key"));
        assertEquals("OSS4-HMAC-SHA256", ticket.formData().get("x-oss-signature-version"));
        assertTrue(ticket.formData().get("x-oss-credential").startsWith("test-access-key-id/"));
        assertTrue(ticket.formData().get("x-oss-signature").matches("[0-9a-f]{64}"));
        String policy = new String(Base64.getDecoder().decode(ticket.formData().get("policy")), StandardCharsets.UTF_8);
        assertTrue(policy.contains("clip_clone_avatar\\/u-1\\/demo.mp4"), policy);
        assertTrue(policy.contains("content-length-range"));
        assertTrue(policy.contains("1234"));
        assertTrue(policy.contains("x-oss-content-type"));
        assertTrue(policy.contains("video\\/mp4"));
        assertTrue(policy.contains("x-oss-forbid-overwrite"));
        assertTrue(policy.contains("x-oss-signature-version"));
        assertTrue(policy.contains("x-oss-credential"));
        assertTrue(policy.contains("x-oss-date"));
        assertTrue(policy.contains("success_action_status"));
    }

    private static AliyunOssCdnUploader uploader(String keyPrefix, String absoluteKeyPrefixes) {
        return new AliyunOssCdnUploader(
                "oss-cn-hangzhou.aliyuncs.com",
                "aiartist",
                "test-access-key-id",
                "test-access-key-secret",
                "https://aiartist.oss-cn-hangzhou.aliyuncs.com",
                keyPrefix,
                absoluteKeyPrefixes,
                "cn-hangzhou",
                "none",
                3600L,
                ""
        );
    }
}
