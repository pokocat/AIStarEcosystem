package com.aistareco.aep.aiavatar;

import com.aistareco.aep.aiavatar.model.AiAvatarAssetKind;
import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.provider.*;
import com.aistareco.aep.aiavatar.provider.impl.*;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.awt.image.BufferedImage;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Provider 契约测试（任务书 §5/§8）：每类 Provider 跑同一组契约用例 ——
 * 必须 1) 上报单调递增进度 2) 返回 ProviderResult（资产 url 就绪 或 metaJson 非空）
 * 3) healthcheck 可调用。Mock 与 Real（faceWarp）共用同一契约。
 */
class AiAvatarProviderContractTest {

    private static final ObjectMapper M = new ObjectMapper();

    /** 桩 AiAvatarStorage：不落盘，返回固定 URL；writeImagePng 回填真实尺寸。 */
    private static AiAvatarStorage stubStorage() {
        AiAvatarStorage s = mock(AiAvatarStorage.class);
        when(s.writePlaceholder(anyInt(), anyInt(), anyString(), anyString(), any(), anyString(), anyBoolean(), anyLong(), anyString()))
                .thenAnswer(inv -> new AiAvatarStorage.StoredFile("/static/aiavatar-assets/stub/x.png",
                        inv.getArgument(0), inv.getArgument(1), 1024L, "/tmp/x.png"));
        when(s.writeImagePng(any(BufferedImage.class), anyString()))
                .thenAnswer(inv -> {
                    BufferedImage img = inv.getArgument(0);
                    return new AiAvatarStorage.StoredFile("/static/aiavatar-assets/stub/warp.png",
                            img.getWidth(), img.getHeight(), 2048L, "/tmp/warp.png");
                });
        when(s.writeBytes(any(byte[].class), anyString(), anyString(), anyString()))
                .thenAnswer(inv -> {
                    byte[] b = inv.getArgument(0);
                    return new AiAvatarStorage.StoredFile("/static/aiavatar-assets/stub/model." + inv.getArgument(2),
                            0, 0, b.length, "/tmp/model");
                });
        return s;
    }

    static Stream<CapabilityProvider> providers() {
        AiAvatarStorage st = stubStorage();
        return Stream.of(
                new MockImageProvider(AiAvatarCapability.TXT2IMG, st, M),
                new MockImageProvider(AiAvatarCapability.FACE_CLONE, st, M),
                new MockImageProvider(AiAvatarCapability.MAKEUP, st, M),
                new MockFaceDetectProvider(st, M),
                new MockNluProvider(st, M),
                new Mock3dProvider(st, M),
                new MockVideoProvider(st, M),
                new MockSegmentProvider(st, M),
                new RealFaceWarpProvider(st, M)
        );
    }

    @ParameterizedTest
    @MethodSource("providers")
    void contract_progressMonotonicAndResultPresent(CapabilityProvider p) throws Exception {
        AtomicInteger last = new AtomicInteger(-1);
        ObjectNode input = M.createObjectNode();
        input.put("prompt", "未来机能风测试人设");
        input.put("variants", 2);
        ObjectNode params = input.putObject("params");
        params.put("slimFace", 30);
        params.put("eyeSize", 20);

        AiAvatarJobContext ctx = new AiAvatarJobContext("test-job", "user-1", "av-1",
                p.capability(), p.mode(), stubStorage(), M,
                (pct, msg) -> {
                    assertTrue(pct >= last.get(), "进度必须单调不减: " + last.get() + " -> " + pct);
                    assertTrue(pct >= 0 && pct <= 100);
                    last.set(pct);
                },
                () -> false);

        ProviderResult result = p.run(input, ctx);
        assertNotNull(result, p.capability() + " 必须返回结果");

        boolean hasAssets = result.assets() != null && !result.assets().isEmpty();
        boolean hasMeta = result.metaJson() != null && !result.metaJson().isBlank();
        assertTrue(hasAssets || hasMeta, p.capability() + " 必须产出资产或 meta");

        if (hasAssets) {
            for (AssetSpec a : result.assets()) {
                assertNotNull(a.fileUrl(), "资产 fileUrl 不能为空");
                assertNotNull(a.kind());
                assertNotNull(a.engine(), "资产必须标注 engine 来源");
            }
        }
        assertTrue(last.get() >= 0, "至少上报一次进度");
    }

    @ParameterizedTest
    @MethodSource("providers")
    void contract_healthcheckCallable(CapabilityProvider p) {
        ProviderHealth h = p.healthcheck();
        assertNotNull(h);
        assertNotNull(h.message());
    }

    @Test
    void faceDetectReturnsComplianceJudgement() throws Exception {
        var p = new MockFaceDetectProvider(stubStorage(), M);
        AiAvatarJobContext ctx = ctx(p);
        ProviderResult r = p.run(M.createObjectNode(), ctx);
        assertNotNull(r.metaJson());
        var node = M.readTree(r.metaJson());
        assertTrue(node.has("passed"));
        assertTrue(node.has("faces"));
    }

    @Test
    void mock3dProducesValidGlb() throws Exception {
        // Glb.cube 产出真实 glTF 二进制
        byte[] glb = Glb.cube(0.5f, 0xF0A83A);
        assertTrue(glb.length > 100);
        assertEquals('g', glb[0]);
        assertEquals('l', glb[1]);
        assertEquals('T', glb[2]);
        assertEquals('F', glb[3]);
    }

    @Test
    void realFaceWarpIsDeterministicAndChangesPixels() {
        // 同输入两次形变结果一致（确定性）；非中性参数会改变像素
        BufferedImage base = syntheticFace(128, 160);
        AiAvatarGeometryWarp.Sliders sliders = new AiAvatarGeometryWarp.Sliders(50, 0, 0, 0, 0);
        BufferedImage w1 = AiAvatarGeometryWarp.warp(base, sliders);
        BufferedImage w2 = AiAvatarGeometryWarp.warp(base, sliders);
        assertTrue(pixelEquals(w1, w2), "形变必须确定性可复算");
        assertFalse(pixelEquals(base, w1), "非中性滑块必须改变像素");

        // 中性参数恒等（允许采样误差极小）
        BufferedImage neutral = AiAvatarGeometryWarp.warp(base, new AiAvatarGeometryWarp.Sliders(0, 0, 0, 0, 0));
        assertTrue(pixelSimilar(base, neutral, 2), "中性滑块应近似恒等");
    }

    @Test
    void faceWarpProviderEngineIsReal() {
        var p = new RealFaceWarpProvider(stubStorage(), M);
        assertNotEquals("MOCK", p.engine(), "几何形变必须是真实实现，不可标 MOCK");
        assertTrue(p.healthcheck().healthy());
    }

    // ── helpers ──
    private AiAvatarJobContext ctx(CapabilityProvider p) {
        return new AiAvatarJobContext("j", "u", "a", p.capability(), p.mode(), stubStorage(), M,
                (pct, msg) -> {}, () -> false);
    }

    private static BufferedImage syntheticFace(int w, int h) {
        // 高频棋盘 + 斜条纹：保证任何亚像素位移都会改变像素（暴露真实形变）。
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++) {
                boolean checker = ((x / 4) + (y / 4)) % 2 == 0;
                int base = checker ? 40 : 215;
                int r = (base + x * 3) & 0xFF;
                int g = (base + y * 3) & 0xFF;
                int b = (base + (x + y) * 2) & 0xFF;
                img.setRGB(x, y, (r << 16) | (g << 8) | b);
            }
        return img;
    }

    private static boolean pixelEquals(BufferedImage a, BufferedImage b) {
        if (a.getWidth() != b.getWidth() || a.getHeight() != b.getHeight()) return false;
        for (int y = 0; y < a.getHeight(); y++)
            for (int x = 0; x < a.getWidth(); x++)
                if (a.getRGB(x, y) != b.getRGB(x, y)) return false;
        return true;
    }

    private static boolean pixelSimilar(BufferedImage a, BufferedImage b, int tol) {
        int diff = 0;
        for (int y = 0; y < a.getHeight(); y++)
            for (int x = 0; x < a.getWidth(); x++)
                if (a.getRGB(x, y) != b.getRGB(x, y)) diff++;
        return diff <= a.getWidth() * a.getHeight() * tol / 100;
    }
}
