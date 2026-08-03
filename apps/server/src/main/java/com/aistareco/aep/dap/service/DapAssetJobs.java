package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapComposition;
import com.aistareco.aep.dap.model.DapCompositionOutput;
import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.model.DapProduct;
import com.aistareco.aep.dap.model.DapScene;
import com.aistareco.aep.dap.model.DapStyle;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapCompositionOutputRepository;
import com.aistareco.aep.dap.repository.DapCompositionRepository;
import com.aistareco.aep.dap.repository.DapProductRepository;
import com.aistareco.aep.dap.repository.DapSceneRepository;
import com.aistareco.aep.dap.repository.DapStyleRepository;
import com.aistareco.aep.service.PromptService;
import com.aistareco.aep.service.storage.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 数字资产平台的作业执行体：AI 生成场景 / 场景光线变体 / AI 生成产品图 / 产品补充角度 /
 * 跨资产合成（人物 × 场景 × 产品 → 成片）。
 *
 * 与人物线一致的两条纪律：
 *  · 进度回写与取消判定由 {@link DapJobRunner} 通过 {@link Progress} 注入，终态 / 计费也在那里收口；
 *  · 未配置生成引擎时产出占位图并让上层打 mock 标（§8.0 的 dev 降级路径，生产由
 *    {@code aep.dap.allow-placeholder=false} 在提交期直接 503，根本走不到这里）。
 */
@Service
public class DapAssetJobs {

    private static final Logger log = LoggerFactory.getLogger(DapAssetJobs.class);
    private static final DateTimeFormatter DATE =
            DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.of("Asia/Shanghai"));

    /** 进度钩子（实现在 DapJobRunner）。 */
    public interface Progress {
        void step(int pct, String stage, String eta);
        void checkCancel();
    }

    private final DapSceneRepository sceneRepo;
    private final DapProductRepository productRepo;
    private final DapStyleRepository styleRepo;
    private final DapAvatarRepository avatarRepo;
    private final DapCompositionRepository compRepo;
    private final DapCompositionOutputRepository outputRepo;
    private final DapAssetService assets;
    private final DapMultimodalClient multimodal;
    private final FileStorageService storage;
    private final DapSupport support;
    private final DapImageInput imageInput;
    private final PromptService prompts;

    public DapAssetJobs(DapSceneRepository sceneRepo,
                        DapProductRepository productRepo,
                        DapStyleRepository styleRepo,
                        DapAvatarRepository avatarRepo,
                        DapCompositionRepository compRepo,
                        DapCompositionOutputRepository outputRepo,
                        DapAssetService assets,
                        DapMultimodalClient multimodal,
                        FileStorageService storage,
                        DapSupport support,
                        DapImageInput imageInput,
                        PromptService prompts) {
        this.sceneRepo = sceneRepo;
        this.productRepo = productRepo;
        this.styleRepo = styleRepo;
        this.avatarRepo = avatarRepo;
        this.compRepo = compRepo;
        this.outputRepo = outputRepo;
        this.assets = assets;
        this.multimodal = multimodal;
        this.storage = storage;
        this.support = support;
        this.imageInput = imageInput;
        this.prompts = prompts;
    }

    private String promptOf(String key, Map<String, String> vars) {
        return PromptService.fill(prompts.resolve(key).userTemplate(), vars == null ? Map.of() : vars);
    }

    // ── 场景生成 ───────────────────────────────────────────────

    /** AI 生成场景主图（空景板，明确排除人物）。 */
    public Map<String, Object> runSceneGen(DapJob job, Progress p) {
        DapScene s = scene(job);
        try {
            p.step(12, "scene.image", "生成场景…");
            String[] wh = sizeOf(str(job.getPayload(), "ratio", "16:10"));
            byte[] img;
            if (multimodal.isConfigured()) {
                String prompt = promptOf(PromptService.KEY_DAP_SCENE_IMAGE, Map.of(
                        "scene", str(job.getPayload(), "prompt", s.getName()),
                        "space", spaceClause(s.getSpace()),
                        "light", s.getLight() == null || s.getLight().isBlank() ? "" : ("Lighting: " + s.getLight() + ". ")));
                img = multimodal.generateImage(prompt, wh[0] + "x" + wh[1], List.of());
            } else {
                img = support.placeholderPortrait(s.getHue(), "占位 · " + s.getName(),
                        Integer.parseInt(wh[0]), Integer.parseInt(wh[1]));
            }
            p.checkCancel();
            p.step(85, "storage.persist", "落库…");
            FileStorageService.StoredFile stored =
                    storage.store(img, "dap/scene", job.getOwnerUserId(), "png", "image/png");
            s.setImageKey(stored.key());
            s.setWidth(Integer.parseInt(wh[0]));
            s.setHeight(Integer.parseInt(wh[1]));
            s.setBytes(s.getBytes() + stored.bytes());
            s.setStatus("ready");
            s.setUpdatedAt(Instant.now());
            sceneRepo.save(s);
            return Map.of("sceneId", s.getId(), "imageUrl", storage.signedUrl(stored.key()));
        } catch (RuntimeException e) {
            markFailed(s, e);
            throw e;
        }
    }

    /** 场景光线变体：同一空间同机位，只换光。产物进 variantsJson（只存 cdnKey，§4.7.7）。 */
    public Map<String, Object> runSceneVariant(DapJob job, Progress p) {
        DapScene s = scene(job);
        List<String> labels = strList(job.getPayload(), "labels");
        String base = imageInput.of(s.getImageKey());
        List<String> inputs = base == null ? List.of() : List.of(base);

        Map<String, Object> doc = s.variantsOrEmpty();
        List<Map<String, Object>> items = itemsOf(doc);
        long bytes = 0;
        int i = 0;
        for (String label : labels) {
            p.checkCancel();
            p.step(10 + i * (80 / Math.max(1, labels.size())), "scene.variant." + (i + 1),
                    label + "（" + (i + 1) + "/" + labels.size() + "）…");
            byte[] img;
            int w = s.getWidth() > 0 ? Math.min(1024, s.getWidth()) : 1024;
            int h = s.getHeight() > 0 ? Math.round(w * (s.getHeight() / (float) s.getWidth())) : 640;
            if (multimodal.isConfigured()) {
                img = multimodal.generateImage(
                        promptOf(PromptService.KEY_DAP_SCENE_VARIANT, Map.of("variant", lightPhrase(label))),
                        w + "x" + h, inputs);
            } else {
                img = support.placeholderPortrait(s.getHue() + i * 17, "占位 · " + label, w, h);
            }
            FileStorageService.StoredFile stored =
                    storage.store(img, "dap/scene", job.getOwnerUserId(), "png", "image/png");
            items.removeIf(it -> label.equals(it.get("label")));   // 同名变体重生成 → 覆盖
            items.add(DapAssetService.angleItem(label, stored.key(), w + " × " + h));
            bytes += stored.bytes();
            i++;
        }
        doc.put("items", items);
        s.setVariantsJson(doc);
        s.setBytes(s.getBytes() + bytes);
        s.setUpdatedAt(Instant.now());
        sceneRepo.save(s);
        return Map.of("sceneId", s.getId(), "count", labels.size());
    }

    // ── 产品生成 ───────────────────────────────────────────────

    /** AI 生成产品主图（纯净底，可抠图）。 */
    public Map<String, Object> runProductGen(DapJob job, Progress p) {
        DapProduct pr = product(job);
        try {
            p.step(12, "product.image", "生成产品图…");
            byte[] img;
            if (multimodal.isConfigured()) {
                String cat = pr.getCategory();
                img = multimodal.generateImage(promptOf(PromptService.KEY_DAP_PRODUCT_IMAGE, Map.of(
                        "product", str(job.getPayload(), "prompt", pr.getName()),
                        "category", cat == null || cat.isBlank() ? "" : ("Category: " + cat + ". "))),
                        "1024x1024", List.of());
            } else {
                img = support.placeholderPortrait(pr.getHue(), "占位 · " + pr.getName(), 1024, 1024);
            }
            p.checkCancel();
            p.step(85, "storage.persist", "落库…");
            FileStorageService.StoredFile stored =
                    storage.store(img, "dap/product", job.getOwnerUserId(), "png", "image/png");
            Map<String, Object> doc = pr.anglesOrEmpty();
            List<Map<String, Object>> items = itemsOf(doc);
            items.removeIf(it -> "正面".equals(it.get("label")));
            items.add(0, DapAssetService.angleItem("正面", stored.key(), "1024 × 1024 · PNG"));
            doc.put("items", items);
            pr.setAnglesJson(doc);
            pr.setImageKey(stored.key());
            pr.setBytes(pr.getBytes() + stored.bytes());
            pr.setStatus("ready");
            pr.setUpdatedAt(Instant.now());
            productRepo.save(pr);
            return Map.of("productId", pr.getId(), "imageUrl", storage.signedUrl(stored.key()));
        } catch (RuntimeException e) {
            markFailed(pr, e);
            throw e;
        }
    }

    /** 产品补充角度：锁同一件商品，只换机位。 */
    public Map<String, Object> runProductAngle(DapJob job, Progress p) {
        DapProduct pr = product(job);
        List<String> labels = strList(job.getPayload(), "labels");
        String base = imageInput.of(pr.getImageKey());
        List<String> inputs = base == null ? List.of() : List.of(base);

        Map<String, Object> doc = pr.anglesOrEmpty();
        List<Map<String, Object>> items = itemsOf(doc);
        long bytes = 0;
        int i = 0;
        for (String label : labels) {
            p.checkCancel();
            p.step(10 + i * (80 / Math.max(1, labels.size())), "product.angle." + (i + 1),
                    label + "（" + (i + 1) + "/" + labels.size() + "）…");
            byte[] img;
            if (multimodal.isConfigured()) {
                img = multimodal.generateImage(
                        promptOf(PromptService.KEY_DAP_PRODUCT_ANGLE, Map.of("angle", anglePhrase(label))),
                        "1024x1024", inputs);
            } else {
                img = support.placeholderPortrait(pr.getHue() + i * 17, "占位 · " + label, 1024, 1024);
            }
            FileStorageService.StoredFile stored =
                    storage.store(img, "dap/product", job.getOwnerUserId(), "png", "image/png");
            items.removeIf(it -> label.equals(it.get("label")));
            items.add(DapAssetService.angleItem(label, stored.key(), "1024 × 1024 · PNG"));
            bytes += stored.bytes();
            i++;
        }
        doc.put("items", items);
        pr.setAnglesJson(doc);
        pr.setBytes(pr.getBytes() + bytes);
        pr.setUpdatedAt(Instant.now());
        productRepo.save(pr);
        return Map.of("productId", pr.getId(), "count", labels.size());
    }

    // ── 跨资产合成 ─────────────────────────────────────────────

    /**
     * 人物 × 场景 × 产品 → 成片。参考图顺序 = 人物定妆图（身份锚）→ 场景板 → 产品图，
     * 产物入库为该 IP 的衍生物，并给每个用到的资产写一条「已用于」双向引用。
     */
    public Map<String, Object> runCompose(DapJob job, Progress p) {
        String compId = str(job.getPayload(), "compositionId", null);
        DapComposition c = compId == null ? null : compRepo.findById(compId).orElse(null);
        if (c == null) throw new IllegalStateException("合成记录缺失 " + compId);
        try {
            DapAvatar avatar = avatarRepo.findById(c.getAvatarId()).orElse(null);
            DapScene scene = sceneRepo.findById(c.getSceneId()).orElse(null);
            if (avatar == null || scene == null) throw new IllegalStateException("合成所需的人物或场景已不存在");
            DapProduct product = c.getProductId() == null ? null
                    : productRepo.findById(c.getProductId()).orElse(null);
            DapStyle style = c.getStyleId() == null ? null : styleRepo.findById(c.getStyleId()).orElse(null);

            // 参考图顺序即优先级：人物定妆图（身份锚）→ 场景板 → 产品图
            List<String> inputs = new ArrayList<>();
            addRef(inputs, avatar.getImageKey());
            addRef(inputs, scene.getImageKey());
            if (product != null) addRef(inputs, product.getImageKey());

            String prompt = multimodal.isConfigured() ? promptOf(PromptService.KEY_DAP_COMPOSE, Map.of(
                    "scene", sceneClause(scene),
                    "product", product == null ? ""
                            : ("The person is presenting this product: " + productClause(product) + ". "),
                    "style", style == null || style.getPromptEn() == null || style.getPromptEn().isBlank()
                            ? "" : (style.getPromptEn() + ". "),
                    "ratio", c.getRatio())) : null;
            if (prompt != null && c.getPromptEn() != null) prompt = prompt + " " + c.getPromptEn();

            String[] wh = sizeOf(c.getRatio());
            outputRepo.deleteByCompositionId(c.getId());
            long bytes = 0;
            int n = Math.max(1, c.getCount());
            for (int i = 0; i < n; i++) {
                p.checkCancel();
                p.step(8 + i * (84 / n), "compose.image." + (i + 1), "合成出片（" + (i + 1) + "/" + n + "）…");
                byte[] img = multimodal.isConfigured()
                        ? multimodal.generateImage(prompt, wh[0] + "x" + wh[1], inputs)
                        : support.placeholderPortrait(avatar.getHue() + i * 13, "占位 · 合成 " + (i + 1),
                                Integer.parseInt(wh[0]), Integer.parseInt(wh[1]));
                FileStorageService.StoredFile stored =
                        storage.store(img, "dap/compose", job.getOwnerUserId(), "png", "image/png");
                outputRepo.save(DapCompositionOutput.builder()
                        .id("CO-" + UUID.randomUUID().toString().substring(0, 12))
                        .compositionId(c.getId())
                        .ownerUserId(job.getOwnerUserId())
                        .idx(i)
                        .fileKey(stored.key())
                        .spec(wh[0] + " × " + wh[1] + " · PNG")
                        .bytes(stored.bytes())
                        .createdAt(Instant.now())
                        .build());
                bytes += stored.bytes();
            }

            c.setStatus("done");
            c.setBytes(bytes);
            c.setFinishedAt(Instant.now());
            compRepo.save(c);
            recordUsages(job.getOwnerUserId(), c, avatar, scene, product, style);

            return Map.of("compositionId", c.getId(), "count", n,
                    "ipId", c.getIpId() == null ? "" : c.getIpId());
        } catch (RuntimeException e) {
            c.setStatus("failed");
            c.setFinishedAt(Instant.now());
            compRepo.save(c);
            log.warn("[dap-asset] composition {} 合成失败: {}", c.getId(), e.getMessage());
            throw e;
        }
    }

    /** 双向引用登记：每个用到的资产各一条；产物同时挂到 IP 名下（作品 tab 的来源）。 */
    private void recordUsages(String userId, DapComposition c, DapAvatar avatar, DapScene scene,
                              DapProduct product, DapStyle style) {
        String title = avatar.getName() + " × " + scene.getName()
                + (product == null ? "" : " × " + product.getName());
        String meta = "合成工作台 · " + DATE.format(c.getCreatedAt() == null ? Instant.now() : c.getCreatedAt()) + " 出片";
        String thumb = outputRepo.findByCompositionIdOrderByIdxAsc(c.getId()).stream()
                .map(DapCompositionOutput::getFileKey)
                .filter(k -> k != null)
                .findFirst()
                .orElse(avatar.getImageKey());
        assets.recordUsage(userId, "character", avatar.getId(), "composition", c.getId(), title, meta, thumb);
        assets.recordUsage(userId, "scene", scene.getId(), "composition", c.getId(), title, meta, thumb);
        if (product != null) {
            assets.recordUsage(userId, "product", product.getId(), "composition", c.getId(), title, meta, thumb);
        }
        if (style != null) {
            assets.recordUsage(userId, "style", style.getId(), "composition", c.getId(), title, meta, thumb);
            assets.bumpStyleUse(userId, style.getId());
        }
        if (c.getIpId() != null) {
            assets.recordUsage(userId, "ip", c.getIpId(), "composition", c.getId(), title, meta, thumb);
        }
    }

    // ── 内部工具 ───────────────────────────────────────────────

    private DapScene scene(DapJob job) {
        String id = str(job.getPayload(), "sceneId", job.getAssetId());
        return sceneRepo.findById(id == null ? "" : id)
                .orElseThrow(() -> new IllegalStateException("场景记录缺失 " + id));
    }

    private DapProduct product(DapJob job) {
        String id = str(job.getPayload(), "productId", job.getAssetId());
        return productRepo.findById(id == null ? "" : id)
                .orElseThrow(() -> new IllegalStateException("产品记录缺失 " + id));
    }

    private void markFailed(DapScene s, RuntimeException e) {
        s.setStatus("failed");
        s.setUpdatedAt(Instant.now());
        sceneRepo.save(s);
        log.warn("[dap-asset] scene {} 生成失败: {}", s.getId(), e.getMessage());
    }

    private void markFailed(DapProduct p, RuntimeException e) {
        p.setStatus("failed");
        p.setUpdatedAt(Instant.now());
        productRepo.save(p);
        log.warn("[dap-asset] product {} 生成失败: {}", p.getId(), e.getMessage());
    }

    /** storage key → 引擎可消费的图片输入串；解析不到就跳过（少一张参考图，不阻断出片）。 */
    private void addRef(List<String> inputs, String key) {
        String in = imageInput.of(key);
        if (in != null) inputs.add(in);
    }

    /** 画幅 → 出图像素尺寸。 */
    static String[] sizeOf(String ratio) {
        return switch (ratio == null ? "" : ratio) {
            case "1:1" -> new String[]{"1024", "1024"};
            case "16:9" -> new String[]{"1365", "768"};
            case "16:10" -> new String[]{"1024", "640"};
            case "4:3" -> new String[]{"1024", "768"};
            default -> new String[]{"768", "1365"};   // 9:16
        };
    }

    private static String spaceClause(String space) {
        return switch (space == null ? "" : space) {
            case "outdoor" -> "An outdoor location. ";
            case "studio" -> "A photo studio set. ";
            case "indoor" -> "An indoor interior. ";
            default -> "";
        };
    }

    private static String lightPhrase(String label) {
        return switch (label == null ? "" : label) {
            case "午后" -> "warm bright afternoon daylight";
            case "夜晚" -> "night time with warm interior lamps and cool ambient light";
            case "清晨" -> "soft cool early-morning light";
            case "阴天" -> "flat soft overcast daylight";
            case "黄昏" -> "golden hour sunset light";
            default -> label;
        };
    }

    private static String anglePhrase(String label) {
        return switch (label == null ? "" : label) {
            case "正面" -> "straight front view";
            case "45°" -> "three-quarter view rotated 45 degrees";
            case "背面" -> "back view";
            case "细节" -> "extreme close-up macro detail of its texture and finish";
            case "俯视" -> "top-down view";
            case "侧面" -> "exact side profile view";
            default -> label;
        };
    }

    private static String sceneClause(DapScene s) {
        StringBuilder sb = new StringBuilder(s.getName() == null ? "the reference environment" : s.getName());
        if (s.getDescription() != null && !s.getDescription().isBlank()) sb.append(" — ").append(s.getDescription());
        if (s.getLight() != null && !s.getLight().isBlank()) sb.append(", ").append(s.getLight());
        return sb.toString();
    }

    private static String productClause(DapProduct p) {
        StringBuilder sb = new StringBuilder(p.getName() == null ? "the reference product" : p.getName());
        if (p.getCategory() != null && !p.getCategory().isBlank()) sb.append(" (").append(p.getCategory()).append(")");
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> itemsOf(Map<String, Object> doc) {
        Object v = doc == null ? null : doc.get("items");
        if (v instanceof List<?> list) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object o : list) {
                if (o instanceof Map<?, ?> m) out.add(new LinkedHashMap<>((Map<String, Object>) m));
            }
            return out;
        }
        return new ArrayList<>();
    }

    @SuppressWarnings("unchecked")
    private static List<String> strList(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        if (v instanceof List<?> list) {
            List<String> out = new ArrayList<>();
            for (Object o : list) {
                if (o != null && !String.valueOf(o).isBlank()) out.add(String.valueOf(o));
            }
            return out;
        }
        return List.of();
    }

    private static String str(Map<String, Object> m, String key, String dft) {
        Object v = m == null ? null : m.get(key);
        return v == null || String.valueOf(v).isBlank() ? dft : String.valueOf(v);
    }
}
