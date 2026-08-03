package com.aistareco.aep.dap.dto;

import com.aistareco.aep.dap.model.DapAssetIp;
import com.aistareco.aep.dap.model.DapAssetUsage;
import com.aistareco.aep.dap.model.DapComposition;
import com.aistareco.aep.dap.model.DapCompositionOutput;
import com.aistareco.aep.dap.model.DapProduct;
import com.aistareco.aep.dap.model.DapScene;
import com.aistareco.aep.dap.model.DapStyle;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * 数字资产平台 · 六类资产 wire DTO（真源 = apps/web-aiavatar/src/proto/data.ts 的 TS interface）。
 *
 * 统一登记语言：登记号（prefix + 编号）+ 资产名 + 版本 + 更新时间；分类靠前缀区分不靠颜色。
 * 文件字段 DB 真值是 storage key，URL 由这里用调用方传入的 keyToUrl（FileStorageService::signedUrl）
 * 派生（§4.7.4 / §4.7.5）；JSON 文档里的资产同样只存 key、出 wire 时逐条派生（§4.7.7）。
 */
public final class DapAssetDtos {

    private DapAssetDtos() {}

    // ── 资产总览（首页 / 资产库共用）────────────────────────────

    /** 六类资产瓦片：登记前缀 + 数量。 */
    public record AssetTypeTileDto(String key, String label, String prefix, long count) {}

    /** 最近更新（跨类型，按时间排序）。 */
    public record RecentAssetDto(String kind, String kindLabel, String id, String name,
                                 String when, String imageUrl) {}

    public record AssetSummaryDto(long totalCount, long totalBytes, String totalSizeLabel,
                                  List<AssetTypeTileDto> types, List<RecentAssetDto> recent) {}

    // ── IP 容器 ────────────────────────────────────────────────

    public record IpMembersDto(long characters, long scenes, long products, long voices) {}

    public record IpDto(String id, String name, String tagline, String summary, String status,
                        String licenseId, String licenseStatus, String coverUrl, int hue,
                        int versions, String updated, IpMembersDto members, long works) {

        public static IpDto from(DapAssetIp ip, String updatedZh, IpMembersDto members, long works,
                                 String licenseStatus, String coverUrlFallback,
                                 Function<String, String> keyToUrl) {
            String cover = ip.getCoverKey() != null ? keyToUrl.apply(ip.getCoverKey()) : coverUrlFallback;
            return new IpDto(ip.getId(), ip.getName(), ip.getTagline(), ip.getSummary(), ip.getStatus(),
                    ip.getLicenseId(), licenseStatus, cover, ip.getHue(), ip.getVersions(), updatedZh,
                    members, works);
        }
    }

    /** IP 详情：容器视图 —— 下挂人物 / 场景 / 产品 / 声音 + 作品 + 授权。 */
    public record IpDetailDto(IpDto ip,
                              List<DapDtos.AvatarDto> characters,
                              List<SceneDto> scenes,
                              List<ProductDto> products,
                              List<Map<String, Object>> voices,
                              List<CompositionDto> compositions,
                              Map<String, Object> license) {}

    // ── 场景 ──────────────────────────────────────────────────

    /** 光线变体 / 多角度图的通用条目（label + 派生 URL + 规格）。 */
    public record AssetShotDto(String label, String url, String spec) {}

    public record SceneDto(String id, String name, String description, String source, String space,
                           String light, int width, int height, String spec, String imageUrl,
                           String ipId, String status, String jobId, int hue, String updated,
                           List<AssetShotDto> variants, long usageCount) {

        public static SceneDto from(DapScene s, String updatedZh, long usageCount,
                                    Function<String, String> keyToUrl) {
            return new SceneDto(s.getId(), s.getName(), s.getDescription(), s.getSource(), s.getSpace(),
                    s.getLight(), s.getWidth(), s.getHeight(), specOf(s.getWidth(), s.getHeight()),
                    s.getImageKey() != null ? keyToUrl.apply(s.getImageKey()) : null,
                    s.getIpId(), s.getStatus(), s.getJobId(), s.getHue(), updatedZh,
                    shotsOf(s.variantsOrEmpty(), keyToUrl), usageCount);
        }
    }

    // ── 产品 ──────────────────────────────────────────────────

    public record ProductDto(String id, String name, String category, String description, String source,
                             String ipId, boolean brandAuthorized, String brandLicenseUntil,
                             String imageUrl, List<AssetShotDto> angles, String status, String jobId,
                             int hue, String updated, long usageCount) {

        public static ProductDto from(DapProduct p, String updatedZh, long usageCount,
                                      Function<String, String> keyToUrl) {
            return new ProductDto(p.getId(), p.getName(), p.getCategory(), p.getDescription(), p.getSource(),
                    p.getIpId(), p.isBrandAuthorized(), p.getBrandLicenseUntil(),
                    p.getImageKey() != null ? keyToUrl.apply(p.getImageKey()) : null,
                    shotsOf(p.anglesOrEmpty(), keyToUrl), p.getStatus(), p.getJobId(), p.getHue(),
                    updatedZh, usageCount);
        }
    }

    // ── 风格模板 ───────────────────────────────────────────────

    public record StyleDto(String id, String name, String summary, String promptEn, List<String> tags,
                           String source, String coverUrl, int hue, int useCount, String updated) {

        public static StyleDto from(DapStyle s, String updatedZh, Function<String, String> keyToUrl) {
            return new StyleDto(s.getId(), s.getName(), s.getSummary(), s.getPromptEn(), s.getTags(),
                    s.getSource(), s.getCoverKey() != null ? keyToUrl.apply(s.getCoverKey()) : null,
                    s.getHue(), s.getUseCount(), updatedZh);
        }
    }

    // ── 引用台账（APPLIED TO · 已用于）──────────────────────────

    public record AssetUsageDto(String usedByType, String usedById, String title, String meta,
                                String thumbUrl, int times) {

        public static AssetUsageDto from(DapAssetUsage u, Function<String, String> keyToUrl) {
            return new AssetUsageDto(u.getUsedByType(), u.getUsedById(), u.getTitle(), u.getMeta(),
                    u.getThumbKey() != null ? keyToUrl.apply(u.getThumbKey()) : null, u.getTimes());
        }
    }

    // ── 合成 ──────────────────────────────────────────────────

    /** 合成用到的一个资产（结果页 SOURCE · 用到的资产）。 */
    public record CompositionSourceDto(String kind, String id, String name, String thumbUrl) {}

    public record CompositionOutputDto(String id, int idx, String no, String url, String spec) {

        public static CompositionOutputDto from(DapCompositionOutput o, Function<String, String> keyToUrl) {
            return new CompositionOutputDto(o.getId(), o.getIdx(), String.format("%02d", o.getIdx() + 1),
                    o.getFileKey() != null ? keyToUrl.apply(o.getFileKey()) : null, o.getSpec());
        }
    }

    public record CompositionDto(String id, String avatarId, String sceneId, String productId,
                                 String styleId, String ipId, String ratio, int count, String status,
                                 String jobId, String licenseNote, long cost, String created,
                                 List<CompositionOutputDto> outputs, List<CompositionSourceDto> sources) {

        public static CompositionDto from(DapComposition c, String createdZh,
                                          List<CompositionOutputDto> outputs,
                                          List<CompositionSourceDto> sources) {
            return new CompositionDto(c.getId(), c.getAvatarId(), c.getSceneId(), c.getProductId(),
                    c.getStyleId(), c.getIpId(), c.getRatio(), c.getCount(), c.getStatus(), c.getJobId(),
                    c.getLicenseNote(), c.getCost(), createdZh, outputs, sources);
        }
    }

    /** 合成工作台出片设置的可选项与单价（前端算 COST 用）。 */
    public record ComposeOptionsDto(long costPerImage, int minCount, int maxCount, int defaultCount,
                                    List<String> ratios, List<StyleDto> styles) {}

    // ── 共用小工具 ─────────────────────────────────────────────

    /** JSON 文档 {"items":[{label,cdnKey,spec}]} → 派生 URL 的展示条目（§4.7.7：文档里只存 key）。 */
    @SuppressWarnings("unchecked")
    public static List<AssetShotDto> shotsOf(Map<String, Object> doc, Function<String, String> keyToUrl) {
        List<AssetShotDto> out = new ArrayList<>();
        Object items = doc == null ? null : doc.get("items");
        if (!(items instanceof List<?> list)) return out;
        for (Object it : list) {
            if (!(it instanceof Map<?, ?> m)) continue;
            Object key = ((Map<String, Object>) m).get("cdnKey");
            if (key == null) continue;
            Object label = ((Map<String, Object>) m).get("label");
            Object spec = ((Map<String, Object>) m).get("spec");
            out.add(new AssetShotDto(label == null ? "" : String.valueOf(label),
                    keyToUrl.apply(String.valueOf(key)),
                    spec == null ? null : String.valueOf(spec)));
        }
        return out;
    }

    public static String specOf(int w, int h) {
        return (w > 0 && h > 0) ? (w + " × " + h) : "—";
    }
}
