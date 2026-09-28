package com.aistareco.aep.controller;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 上传超限提示里的上限值：必须是「照着改就一定能传上去」的数（向下取、不到 1 MB 用 KB）。
 * 断的是换算规则，不是整句提示。
 */
class DramaAssetUploadControllerTest {

    @Test
    void wholeMegabytesHaveNoDecimal() {
        assertEquals("100 MB", DramaAssetUploadController.sizeLimitLabel(104_857_600L));
        assertEquals("1 MB", DramaAssetUploadController.sizeLimitLabel(1024L * 1024));
    }

    @Test
    void fractionalMegabytesKeepOneDecimalRoundedDown() {
        assertEquals("1.5 MB", DramaAssetUploadController.sizeLimitLabel(1536L * 1024));
        // 1.99 MB 不能说成 2 MB（用户压到 2 MB 仍会被拒）
        assertEquals("1.9 MB", DramaAssetUploadController.sizeLimitLabel((long) (1.99 * 1024 * 1024)));
    }

    @Test
    void underOneMegabyteUsesKilobytesInsteadOfClaimingOneMegabyte() {
        assertEquals("512 KB", DramaAssetUploadController.sizeLimitLabel(512L * 1024));
        assertEquals("1023.9 KB", DramaAssetUploadController.sizeLimitLabel(1024L * 1024 - 1));
        assertEquals("500 字节", DramaAssetUploadController.sizeLimitLabel(500));
    }
}
