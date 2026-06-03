package com.aistareco.aep.service.cdn;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * v0.47+：AliyunOssCdnUploader.resolveRegion 单测。
 *
 * <p>SDK 3.18.5 V4 签名要求显式 region。解析规则：
 * <ul>
 *   <li>显式 region 配置优先</li>
 *   <li>否则从 endpoint 推导（含 internal / 外网 / https 前缀变体）</li>
 *   <li>推导失败 fail-fast</li>
 * </ul>
 */
class AliyunOssCdnUploaderRegionTest {

    @Test
    void configuredRegionTakesPriority() {
        assertThat(AliyunOssCdnUploader.resolveRegion(
                "cn-shenzhen", "oss-cn-hangzhou.aliyuncs.com")).isEqualTo("cn-shenzhen");
        assertThat(AliyunOssCdnUploader.resolveRegion(
                "  us-east-1  ", "")).isEqualTo("us-east-1");
    }

    @Test
    void derivesRegionFromPlainEndpoint() {
        assertThat(AliyunOssCdnUploader.resolveRegion(null,
                "oss-cn-hangzhou.aliyuncs.com")).isEqualTo("cn-hangzhou");
        assertThat(AliyunOssCdnUploader.resolveRegion("",
                "oss-cn-beijing.aliyuncs.com")).isEqualTo("cn-beijing");
        assertThat(AliyunOssCdnUploader.resolveRegion(null,
                "oss-us-east-1.aliyuncs.com")).isEqualTo("us-east-1");
    }

    @Test
    void derivesRegionStrippingInternalSuffix() {
        // 生产 ECS 推荐用 -internal endpoint 省流量费
        assertThat(AliyunOssCdnUploader.resolveRegion(null,
                "oss-cn-hangzhou-internal.aliyuncs.com")).isEqualTo("cn-hangzhou");
        assertThat(AliyunOssCdnUploader.resolveRegion(null,
                "oss-cn-shanghai-internal.aliyuncs.com")).isEqualTo("cn-shanghai");
    }

    @Test
    void derivesRegionStrippingProtocolAndPort() {
        assertThat(AliyunOssCdnUploader.resolveRegion(null,
                "https://oss-cn-hangzhou.aliyuncs.com")).isEqualTo("cn-hangzhou");
        assertThat(AliyunOssCdnUploader.resolveRegion(null,
                "http://oss-cn-hangzhou.aliyuncs.com:443")).isEqualTo("cn-hangzhou");
        assertThat(AliyunOssCdnUploader.resolveRegion(null,
                "https://oss-cn-hangzhou.aliyuncs.com/some/path")).isEqualTo("cn-hangzhou");
    }

    @Test
    void failsFastOnUnparseableEndpoint() {
        // 自定义域名 / VPC endpoint 等无法推导 → fail-fast 强制运维显式配 region
        assertThatThrownBy(() -> AliyunOssCdnUploader.resolveRegion(null, "cdn.aibuzz.cn"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("aep.cdn.oss.region");

        assertThatThrownBy(() -> AliyunOssCdnUploader.resolveRegion(null, ""))
                .isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() -> AliyunOssCdnUploader.resolveRegion(null, null))
                .isInstanceOf(IllegalStateException.class);
    }
}
