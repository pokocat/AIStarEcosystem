package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * payload.cover 的唯一解析层：把用户在小程序填的四个文本槽位规整成渲染器能直接吃的 spec。
 * 全是纯函数，没有 IO，方便单测覆盖截断与「填了什么才算要封面」这两条容易出错的规则。
 *
 * <p>封面是可选步骤：cover 缺失、enabled 非 true、或四个槽位全空，一律返回 empty ——
 * 也就是「不填就不加封面」，绝不会因为前端漏传字段就给用户塞一张空白封面。
 */
public final class ClipCoverPlan {
    private ClipCoverPlan() {}

    /**
     * 已规整的封面配置。
     *
     * @param backgroundAssetId    用户自传底图素材 id；空则从成片里取帧
     * @param backgroundSourceNo   底图取自哪一个源句子（segment.no）；<=0 表示交给渲染侧挑形象出镜段
     */
    public record Spec(
            ClipCoverTemplate template,
            String keyword,
            String handle,
            List<String> sloganLines,
            String signature,
            String backgroundAssetId,
            int backgroundSourceNo
    ) {
        public boolean hasText() {
            return !keyword.isBlank() || !handle.isBlank() || !signature.isBlank()
                    || sloganLines.stream().anyMatch(line -> !line.isBlank());
        }
    }

    public static Optional<Spec> parse(Map<String, Object> payload) {
        Map<String, Object> cover = payload == null ? null : ClipDtos.safeMapValue(payload.get("cover"));
        if (cover == null) return Optional.empty();
        if (!Boolean.TRUE.equals(cover.get("enabled"))) return Optional.empty();
        Spec spec = toSpec(cover);
        return spec.hasText() ? Optional.of(spec) : Optional.empty();
    }

    /** 不看开关，只把四个槽位规整成 spec。给 {@link #normalize} 和渲染共用。 */
    private static Spec toSpec(Map<String, Object> cover) {
        ClipCoverTemplate template = ClipCoverTemplate.byId(text(cover.get("templateId")));
        return new Spec(
                template,
                truncate(text(cover.get("keyword")), template.keyword().maxChars()),
                truncate(text(cover.get("handle")), template.handle().maxChars()),
                sloganLines(cover.get("sloganLines"), template.slogan()),
                truncate(text(cover.get("signature")), template.signature().maxChars()),
                text(cover.get("backgroundAssetId")),
                number(cover.get("backgroundSourceNo")));
    }

    /**
     * 入库前规整。**关掉封面不会丢文案** —— 只把 enabled 置 false，四个槽位原样留着，
     * 用户再打开时还是他自己写的那几句；不然「手滑关一下」就等于清空重填，谁都会骂。
     */
    public static Map<String, Object> normalize(Map<String, Object> cover) {
        if (cover == null) return new LinkedHashMap<>(Map.of("enabled", false));
        Map<String, Object> out = toMap(toSpec(cover));
        out.put("enabled", Boolean.TRUE.equals(cover.get("enabled")));
        return out;
    }

    /**
     * 标语规整为最多 maxLines 行：接受数组，也接受用户在单个输入框里敲的换行。
     * 多出来的行直接丢弃而不是拼接——拼起来会得到一行读不通的长句。
     */
    public static List<String> sloganLines(Object raw, ClipCoverTemplate.Slot slot) {
        List<String> source = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object item : list) source.addAll(List.of(text(item).split("\\R")));
        } else {
            source.addAll(List.of(text(raw).split("\\R")));
        }
        List<String> out = new ArrayList<>();
        for (String line : source) {
            String value = truncate(line.trim(), slot.maxChars());
            if (value.isBlank()) continue;
            out.add(value);
            if (out.size() >= slot.maxLines()) break;
        }
        return List.copyOf(out);
    }

    /**
     * 按「码点」截断，不是按 char —— emoji 和生僻字都是双 char，按 char 截会把字劈成乱码。
     * 只有真的超长才补省略号。
     */
    public static String truncate(String value, int maxChars) {
        if (value == null) return "";
        String trimmed = value.trim();
        if (maxChars <= 0) return "";
        int points = trimmed.codePointCount(0, trimmed.length());
        if (points <= maxChars) return trimmed;
        int end = trimmed.offsetByCodePoints(0, Math.max(1, maxChars - 1));
        return trimmed.substring(0, end) + "…";
    }

    /** 把 spec 回写成 payload 形状，供 DTO 出参与测试断言复用。 */
    public static Map<String, Object> toMap(Spec spec) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("enabled", true);
        map.put("templateId", spec.template().id());
        map.put("keyword", spec.keyword());
        map.put("handle", spec.handle());
        map.put("sloganLines", spec.sloganLines());
        map.put("signature", spec.signature());
        map.put("backgroundAssetId", spec.backgroundAssetId().isBlank() ? null : spec.backgroundAssetId());
        map.put("backgroundSourceNo", spec.backgroundSourceNo());
        return map;
    }

    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static int number(Object value) { return value instanceof Number n ? n.intValue() : 0; }
}
