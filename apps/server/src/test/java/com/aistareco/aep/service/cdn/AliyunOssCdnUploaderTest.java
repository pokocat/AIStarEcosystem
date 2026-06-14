package com.aistareco.aep.service.cdn;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
