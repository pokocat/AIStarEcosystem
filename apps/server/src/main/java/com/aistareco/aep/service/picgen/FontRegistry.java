package com.aistareco.aep.service.picgen;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.awt.Font;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 启动时扫描 {@code classpath:fonts/**\/*.ttf|*.otf}，把发现的中文字体加载到内存。
 *
 * <p>用文件名里的 hint 推断字体"风格 kind"（{@link Kind}）：
 * <ul>
 *   <li>{@code -black|-heavy|huangyou|kuaile} → {@link Kind#DISPLAY}（粗黑 / 卡通显示）</li>
 *   <li>{@code -serif|-song|-ming|xiaowei} → {@link Kind#SERIF}（衬线 / 优雅）</li>
 *   <li>{@code -brush|mashanzheng|brush} → {@link Kind#BRUSH}（毛笔 / 手写）</li>
 *   <li>其它 → {@link Kind#SANS}（默认无衬线）</li>
 * </ul>
 * picgen 取字体时按 kind 加权抽样，让"主标题大粗黑 / 副标题清秀宋体 / 标签卡通圆"这种层级关系成立。
 *
 * <p>{@code resources/fonts/} 为空 → 注册表为空 → BannerRenderer 回退到 JVM 逻辑字
 * （SansSerif / Serif，OS 字体回退到 macOS PingFang / Linux Noto CJK）。
 *
 * <p>许可证遵守：bundled 字体必须是 OFL / Apache / 公开免商用 license；放进 fonts/ 即视为已审阅。
 */
@Component
public class FontRegistry {

    private static final Logger log = LoggerFactory.getLogger(FontRegistry.class);

    /** 字体风格分类，让 picgen 的 title / subtitle / tag 各取所需。 */
    public enum Kind {
        /** 通用无衬线 —— 安全的默认。 */
        SANS,
        /** 粗显示字 —— 主标题首选。 */
        DISPLAY,
        /** 衬线 / 优雅 —— 副标题或多样化用。 */
        SERIF,
        /** 毛笔 / 手写 —— 偶尔出现，增强变体差异。 */
        BRUSH,
    }

    public record RegisteredFont(String name, Kind kind, Font font) {
        /** 派生指定字号 + 风格位 + 属性。 */
        public Font derive(int style, float size) {
            return font.deriveFont(style, size);
        }
    }

    private final List<RegisteredFont> all = new ArrayList<>();

    @PostConstruct
    public void load() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            for (Resource r : fontResources(resolver)) {
                String filename = r.getFilename();
                if (filename == null) continue;
                try (InputStream in = r.getInputStream()) {
                    Font f = Font.createFont(Font.TRUETYPE_FONT, in);
                    Kind kind = inferKind(filename, f.getFontName(Locale.US));
                    String displayName = stripExt(filename);
                    all.add(new RegisteredFont(displayName, kind, f));
                    log.info("[fonts] loaded '{}' as kind={} ({})",
                            displayName, kind, f.getFontName(Locale.US));
                } catch (Exception e) {
                    log.warn("[fonts] failed to load '{}': {}", filename, e.toString());
                }
            }
        } catch (Exception e) {
            log.warn("[fonts] scan failed: {}", e.toString());
        }
        if (all.isEmpty()) {
            log.info("[fonts] registry empty; BannerRenderer will fall back to JVM logical fonts");
        } else {
            log.info("[fonts] registry total = {} fonts", all.size());
        }
    }

    private static List<Resource> fontResources(PathMatchingResourcePatternResolver resolver) throws Exception {
        String[] patterns = {
                "classpath*:fonts/**/*.ttf",
                "classpath*:fonts/**/*.otf",
                "classpath*:fonts/*.ttf",
                "classpath*:fonts/*.otf",
        };
        Map<String, Resource> resources = new LinkedHashMap<>();
        for (String pattern : patterns) {
            for (Resource resource : resolver.getResources(pattern)) {
                resources.putIfAbsent(resourceKey(resource), resource);
            }
        }
        return new ArrayList<>(resources.values());
    }

    private static String resourceKey(Resource resource) {
        try {
            return resource.getURL().toString();
        } catch (Exception ignored) {
            return String.valueOf(resource.getDescription());
        }
    }

    public List<RegisteredFont> all() {
        return all;
    }

    public boolean isEmpty() {
        return all.isEmpty();
    }

    /** 按 kind 过滤；空集时返回全部（让上游别死循环）。 */
    public List<RegisteredFont> byKind(Kind kind) {
        List<RegisteredFont> out = new ArrayList<>();
        for (RegisteredFont rf : all) {
            if (rf.kind == kind) out.add(rf);
        }
        return out.isEmpty() ? all : out;
    }

    // ── 内部 ────────────────────────────────────────────────────────────────

    private static Kind inferKind(String filename, String fontName) {
        String s = (filename + " " + (fontName == null ? "" : fontName)).toLowerCase(Locale.ROOT);
        // 毛笔 / 手写
        if (s.contains("brush") || s.contains("mashanzheng")
                || s.contains("handwriting") || s.contains("script")
                || s.contains("liu jian") || s.contains("liujianmao")
                || s.contains("ma shan zheng")
                || s.contains("long cang") || s.contains("longcang")) {
            return Kind.BRUSH;
        }
        // 衬线 / 宋 / 明朝体 / 优雅
        if (s.contains("serif") || s.contains("song") || s.contains("ming")
                || s.contains("xiaowei") || s.contains("kaiti") || s.contains("kai")) {
            return Kind.SERIF;
        }
        // 显示字 / 粗黑 / 卡通圆体
        if (s.contains("black") || s.contains("heavy")
                || s.contains("huangyou") || s.contains("kuaile")
                || s.contains("display") || s.contains("poster")
                || s.contains("zcool")) {
            return Kind.DISPLAY;
        }
        return Kind.SANS;
    }

    private static String stripExt(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
