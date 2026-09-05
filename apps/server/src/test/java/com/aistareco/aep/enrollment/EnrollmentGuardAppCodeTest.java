package com.aistareco.aep.enrollment;

import com.aistareco.aep.enrollment.config.EnrollmentGuard;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code X-App-Code} 的解析规则：带端后缀（小程序 {@code celebrity-mp}）时按产品前缀判定；
 * 非法值仍为 null。
 *
 * <p>小程序发的是 {@code celebrity-mp} 而不是 {@code celebrity}，因为审计 / 用量要按端分桶。
 * 开通判定必须把它归一到 {@code celebrity}，否则小程序会被自己的埋点挡在门外。</p>
 */
class EnrollmentGuardAppCodeTest {

    @Test
    void productPrefixedAppCode_mapsToProduct() {
        assertThat(EnrollmentGuard.appCodeProduct("celebrity-mp")).isEqualTo("celebrity");
        assertThat(EnrollmentGuard.appCodeProduct("Celebrity-MP ")).isEqualTo("celebrity");
        assertThat(EnrollmentGuard.appCodeProduct("drama")).isEqualTo("drama");
    }

    @Test
    void unknownAppCode_isNull() {
        assertThat(EnrollmentGuard.appCodeProduct("mp-celebrity")).isNull();
        assertThat(EnrollmentGuard.appCodeProduct("-celebrity")).isNull();
        assertThat(EnrollmentGuard.appCodeProduct("")).isNull();
        assertThat(EnrollmentGuard.appCodeProduct(null)).isNull();
    }

    @Test
    void miniprogramAppCodeStillReachesCelebrityRoutes() {
        // 小程序打的是 /api/celebrity/**（路径硬映射），头只用于审计；这里确认归一后一致
        assertThat(EnrollmentGuard.resolveProduct("/api/celebrity/stars", "celebrity-mp"))
                .isEqualTo("celebrity");
    }

    @Test
    void pathMappedProducts_ignoreHeader() {
        assertThat(EnrollmentGuard.resolveProduct("/api/star/profile", "drama")).isEqualTo("star");
        assertThat(EnrollmentGuard.resolveProduct("/api/v1/assets/summary", null)).isEqualTo("aiavatar");
    }
}
