package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.IpStudioFixtures;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 全局示例素材的归属闸。
 *
 * <p>这一条曾经是破的：{@code ownsAssetKey} 拿 {@code CATEGORY_DEMO + "/"}
 * （= {@code "ipstudio/demo/"}）判前缀，而 {@code FileStorageService.buildKey} 会
 * {@code sanitizeSegment} 掉分类名里的 {@code /} —— 真实落地的 key 是
 * {@code ipstudio_demo/<demoId>/…}，**永远匹配不上**。
 * 于是示例素材过不了闸、出 wire 不重签，用户打开示例工作流一片空白。
 *
 * <p>本测试放在 {@code ...ipstudio.service} 包里，是为了能直接测那个包级方法 ——
 * 不为了测试把它 public 掉（那等于为了验证而放宽封装）。
 *
 * <p>关键：断言用的 key **由存储层自己算**，不是手写字符串 ——
 * 手写就等于把同一个假设抄进测试，bug 照样测不出来。
 */
class IpDemoAssetGateTest {

    private final FileStorageService storage = IpStudioFixtures.storage();
    private final IpProjectService svc = new IpProjectService(
            new IpStudioFixtures.Projects().repo, new IpStudioFixtures.Runs().repo,
            new IpCatalogService(IpStudioFixtures.OM), IpStudioFixtures.templateResolver(),
            storage, IpStudioFixtures.props(), IpStudioFixtures.videoJobs(), IpStudioFixtures.OM);

    private static final String USER = "u-1";

    @Test
    void 示例素材任何登录用户都读得到_且前缀按真实落地形状算() {
        String realKey = storage.allocateKey(
                IpDemoTemplateService.CATEGORY_DEMO, "IPD-abc123", "cover.png");

        assertTrue(realKey.startsWith("ipstudio_demo/"),
                "存储层会把分类里的 / 换成 _，实际前缀应是 ipstudio_demo/，得到：" + realKey);
        assertTrue(svc.ownsAssetKey(USER, realKey),
                "示例是平台自有内容，登录用户都该读得到；实际被判成非本人：" + realKey);
        assertTrue(svc.ownsAssetKey("someone-else", realKey),
                "换个人打开同一个示例也该读得到 —— 否则示例工作流对别人就是一片空白");
    }

    @Test
    void 不能拿相似前缀蒙混过关() {
        assertFalse(svc.ownsAssetKey(USER, "ipstudio_demoX/other/1.png"), "前缀必须到分隔符为止");
        assertFalse(svc.ownsAssetKey(USER, "../ipstudio_demo/x/1.png"), "路径穿越");
        assertFalse(svc.ownsAssetKey(USER, "/ipstudio_demo/x/1.png"), "绝对路径");
        assertFalse(svc.ownsAssetKey(USER, "ipstudio_demo\\x\\1.png"), "反斜杠");
    }

    @Test
    void 别人的私有素材照旧读不到() {
        String other = storage.allocateKey(IpProjectService.CATEGORY_SOURCE, "someone-else", "a.png");
        assertFalse(svc.ownsAssetKey(USER, other),
                "放行示例前缀不能顺带放行别人的私有素材");
    }
}
