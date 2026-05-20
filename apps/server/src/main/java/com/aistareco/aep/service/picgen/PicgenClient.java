package com.aistareco.aep.service.picgen;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * v0.16+: 文字转图客户端 —— 现已 100% in-process 实现，调用 {@link BannerRenderer}（Java2D）
 * 直接出 PNG。不再依赖任何外部 Node 服务 / Puppeteer / Chromium，进程内零网络。
 * <p>
 * 保留 PicgenClient 这个类名是为了让上游 ({@code MixcutPicgenController}, {@code MixcutRenderingService})
 * 的引用无感切换 —— 调用方代码 0 改动。
 * <p>
 * 失败语义：参数错抛 {@link PicgenException}（运行期），调用方决定是 4xx 返回前端还是 fall-through 跳过。
 */
@Service
public class PicgenClient {

    private static final Logger log = LoggerFactory.getLogger(PicgenClient.class);

    private final boolean enabled;
    private final BannerRenderer renderer;

    public PicgenClient(
            @Value("${aep.picgen.enabled:true}") boolean enabled,
            BannerRenderer renderer
    ) {
        this.enabled = enabled;
        this.renderer = renderer;
        log.info("[picgen] initialized (in-process Java2D renderer, enabled={})", enabled);
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** 渲染一张 banner PNG。失败抛 {@link PicgenException}。 */
    public byte[] renderPng(PicgenParams p) {
        if (!enabled) {
            throw new PicgenException("pic-gen 已通过 aep.picgen.enabled=false 关闭");
        }
        if (p == null || p.title() == null || p.title().isBlank()) {
            throw new PicgenException("title 不能为空");
        }
        try {
            var req = new BannerRenderer.BannerRequest(
                    p.title(),
                    p.subtitle(),
                    p.tag(),
                    p.width() == null ? 1080 : p.width(),
                    p.height() == null ? 380 : p.height(),
                    p.seed() == null ? 0L : p.seed(),
                    p.scheme()  // null → renderer 按 seed 抽
            );
            return renderer.render(req);
        } catch (IllegalArgumentException iae) {
            throw new PicgenException(iae.getMessage(), iae);
        } catch (Exception e) {
            log.warn("[picgen] render failed: {}", e.toString());
            throw new PicgenException("banner 渲染失败: " + e.getMessage(), e);
        }
    }

    /**
     * 调用参数 record。title 必填，其他都可选。
     * <p>
     * template / font 字段保留是为了与旧 server 时代的 API 兼容（前端仍可传，
     * 但当前 Java 渲染器只用 scheme + seed 控制差异，template/font 暂被忽略）。
     */
    public record PicgenParams(
            String title,
            String subtitle,
            String tag,
            Integer width,
            Integer height,
            Long seed,
            String template,
            String scheme,
            String font
    ) {}

    /** pic-gen 调用异常（运行期）。 */
    public static class PicgenException extends RuntimeException {
        public PicgenException(String m) { super(m); }
        public PicgenException(String m, Throwable c) { super(m, c); }
    }
}
