package com.aistareco.aep.service;

import com.aistareco.aep.model.MaterialScript;
import com.aistareco.aep.model.MaterialVideo;
import com.aistareco.aep.model.MaterialViralHit;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.MaterialScriptRepository;
import com.aistareco.aep.repository.MaterialVideoRepository;
import com.aistareco.aep.repository.MaterialViralHitRepository;
import com.aistareco.aep.repository.ProductRepository;
import com.aistareco.aep.repository.AepUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 素材运营领域服务。脚本 / 视频 / 爆款以「关键列 + JSON payload」存储，出 wire 时
 * 直接回放 payload（前端 ScriptAsset / MaterialVideo / ViralHit 形状）。
 * productId 关联到商品库 —— 引用商品时 bump usageCount，实现数据集成。
 */
@Service
@Transactional
public class MaterialOpsService {

    private final MaterialScriptRepository scriptRepo;
    private final MaterialVideoRepository videoRepo;
    private final MaterialViralHitRepository viralRepo;
    private final ProductService productService;
    private final ProductRepository productRepo;
    private final AepUserRepository userRepo;
    private final MaterialAiService materialAi;
    private final CreditService creditService;
    private final CelebrityActionPricingService actionPricing;
    private final ObjectMapper om;
    private final HttpClient viralHttp = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    public MaterialOpsService(MaterialScriptRepository scriptRepo,
                              MaterialVideoRepository videoRepo,
                              MaterialViralHitRepository viralRepo,
                              ProductService productService,
                              ProductRepository productRepo,
                              AepUserRepository userRepo,
                              MaterialAiService materialAi,
                              CreditService creditService,
                              CelebrityActionPricingService actionPricing,
                              ObjectMapper om) {
        this.scriptRepo = scriptRepo;
        this.videoRepo = videoRepo;
        this.viralRepo = viralRepo;
        this.productService = productService;
        this.productRepo = productRepo;
        this.userRepo = userRepo;
        this.materialAi = materialAi;
        this.creditService = creditService;
        this.actionPricing = actionPricing;
        this.om = om;
    }

    // ── 脚本 ─────────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<JsonNode> listScripts(String userId) {
        List<JsonNode> out = new ArrayList<>();
        for (MaterialScript s : scriptRepo.findVisibleTo(userId)) out.add(toScriptWire(s));
        return out;
    }

    /** 按 id 取脚本，并做归属校验：私有脚本仅本人可见，他人取到视为不存在。 */
    @Transactional(readOnly = true)
    public JsonNode getScript(String id, String userId) {
        MaterialScript s = scriptRepo.findById(id).orElse(null);
        if (s == null) return null;
        if (s.getDeletedAt() != null) return null;
        if (s.getOwnerUserId() != null && !s.getOwnerUserId().equals(userId)) return null; // 别人的私有脚本
        return toScriptWire(s);
    }

    public JsonNode saveScript(JsonNode body, String userId) {
        String id = text(body, "id");
        if (id == null || id.isBlank()) throw new IllegalArgumentException("script id required");
        String productId = text(body, "product_id");
        String kind = orDefault(text(body, "kind"), "my_script");
        MaterialScript existing = scriptRepo.findById(id).orElse(null);
        if (existing != null && existing.getDeletedAt() != null) {
            throw new IllegalStateException("script deleted");
        }
        // 已存在的私有脚本只能本人改；他人改视为不存在（防越权覆盖）。
        if (existing != null && existing.getOwnerUserId() != null
                && !existing.getOwnerUserId().equals(userId)) {
            throw new IllegalStateException("script not owned by current user");
        }
        // 个人脚本归当前用户；共享类型（template/viral_clone/ai_seed）保持共享(null)。
        String ownerUserId = "my_script".equals(kind) ? userId : null;
        JsonNode payload = scriptPayloadForSave(body, ownerUserId);
        MaterialScript row = MaterialScript.builder()
                .id(id)
                .productId(productId)
                .kind(kind)
                .tier(orDefault(text(body, "tier"), "D"))
                .category(text(body, "category"))
                .hookType(text(body, "hook_type"))
                .durationSec(body.path("duration_sec").asInt(0))
                .ord(existing != null ? existing.getOrd() : 0)
                .ownerUserId(ownerUserId)
                .payloadJson(write(payload))
                .build();
        scriptRepo.save(row);
        if (existing == null && productId != null) bumpProduct(productId);
        return toScriptWire(row);
    }

    /** 软删脚本：共享脚本或本人私有脚本可删；他人私有脚本不可删。 */
    public void deleteScript(String id, String userId) {
        MaterialScript s = scriptRepo.findById(id).orElse(null);
        if (s == null || s.getDeletedAt() != null) return;
        if (s.getOwnerUserId() != null && !s.getOwnerUserId().equals(userId)) {
            throw new IllegalStateException("script not owned by current user");
        }
        s.setDeletedAt(OffsetDateTime.now());
        scriptRepo.save(s);
    }

    // ── 视频 ─────────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<JsonNode> listVideos(String productId, String userId) {
        List<MaterialVideo> rows = (productId != null && !productId.isBlank())
                ? videoRepo.findVisibleToByProduct(userId, productId)
                : videoRepo.findVisibleTo(userId);
        List<JsonNode> out = new ArrayList<>();
        for (MaterialVideo v : rows) out.add(parse(v.getPayloadJson()));
        return out;
    }

    public void addVideos(List<JsonNode> videos, String userId) {
        if (videos == null) return;
        for (JsonNode v : videos) {
            String id = text(v, "id");
            if (id == null || id.isBlank()) continue;
            String productId = text(v, "product_id");
            videoRepo.save(MaterialVideo.builder()
                    .id(id)
                    .scriptId(text(v, "script_id"))
                    .productId(productId)
                    .kind(text(v, "kind"))
                    .status(orDefault(text(v, "status"), "ready"))
                    .parentVideoId(text(v, "parent_video_id"))
                    .ord(-1) // 新生成的排在前
                    .ownerUserId(userId) // 用户生成的视频归本人
                    .payloadJson(write(v))
                    .build());
            if (productId != null) bumpProduct(productId);
        }
    }

    /** 删视频：只能删自己生成的；共享演示视频（owner=null）与他人视频不允许删。 */
    public void deleteVideo(String id, String userId) {
        MaterialVideo v = videoRepo.findById(id).orElse(null);
        if (v == null) return;
        if (v.getOwnerUserId() == null || !v.getOwnerUserId().equals(userId)) {
            throw new IllegalStateException("video not owned by current user");
        }
        videoRepo.deleteById(id);
    }

    // ── AI 起稿 / 变量抽取（接真 LLM，失败降级，见 MaterialAiService） ──────────────
    /**
     * AI 起脚本候选（不落库，仅返回；用户选用并保存时才走 saveScript）。
     * 上下文优先取库内 Product（权威卖点）；库里没有则用请求里带的字段构造临时上下文。
     *
     * 计费（后端可配置）：单价取 CelebrityActionPricingService action="material.script-draft"
     * （admin → 平台与配置 → 引擎价格 → 动作单价；默认 0 = 不计费）。单价 > 0 时按
     * 单价 × 稿数 走 CreditService hold → 成功 commit / 失败 release 三段式（不可变账本约束）。
     * 余额不足 → CreditService 抛 402，明确报错。anonymous 用户不计费（dev/H2 lite）。
     *
     * NOT_SUPPORTED：挂起外层事务，让 hold / commit / release 各自独立成事务（立即落账），
     * 且 LLM 的 HTTP 调用不占用 DB 连接（避免长事务）。
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public List<JsonNode> draftScripts(JsonNode body, String userId) {
        String productId = text(body, "product_id");
        Product product = productId != null ? productRepo.findById(productId).orElse(null) : null;
        if (product == null) {
            product = new Product();
            product.setId(productId);
            product.setName(orDefault(text(body, "product_name"), "商品"));
            product.setCategory(orDefault(text(body, "category"), "通用"));
            product.setSellingPoints(text(body, "selling_points"));
        }
        String tone = orDefault(text(body, "tone"), "情感故事");
        List<String> audience = strList(body.get("audience"));
        int durationSec = body.path("duration_sec").asInt(38);
        int count = Math.max(1, Math.min(body.path("count").asInt(3), 5));

        long unit = scriptDraftUnitCost();
        long cost = unit * count;
        boolean charge = billable(userId) && cost > 0;
        String ref = "material-draft-" + (userId == null ? "anon" : userId) + "-" + System.nanoTime();
        String desc = "AI 起稿 · " + count + " 稿 · " + orDefault(product.getName(), "商品");

        if (charge) {
            // 余额不足在此抛 402（PAYMENT_REQUIRED），明确报错，不会进入 AI 调用。
            creditService.hold(userId, cost, "material_script_draft", ref, desc);
        }
        try {
            List<JsonNode> out = materialAi.draftScripts(product, tone, audience, durationSec, count);
            if (charge) creditService.commitHold("material_script_draft", ref, cost, desc);
            return out;
        } catch (RuntimeException e) {
            // AI 未配置 / 调用失败 / 解析失败 → 退还冻结，向上抛明确错误（不扣费）。
            if (charge) {
                try {
                    creditService.releaseHold("material_script_draft", ref, "AI 起稿失败回滚");
                } catch (Exception ignore) {
                    /* 退款失败仅 log，不掩盖原始错误 */
                }
            }
            throw e;
        }
    }

    /** AI 起稿单价（积分/单稿）；未配置或 0 → 0（不计费）。 */
    private long scriptDraftUnitCost() {
        Long p = actionPricing.creditPriceOf(CelebrityActionPricingService.ACTION_SCRIPT_DRAFT);
        return p != null && p > 0 ? p : 0L;
    }

    /** "anonymous" 等占位用户名不参与扣费（与 mixcut 同口径）。 */
    private static boolean billable(String userId) {
        return userId != null && !userId.isBlank() && !"anonymous".equals(userId);
    }

    /**
     * 从脚本抽取可替换变量（owner 校验：私有脚本仅本人）。
     * 找不到 / 无权访问 → 返回空列表（前端用正则兜底，不泄露存在性）。
     * NOT_SUPPORTED：LLM 的 HTTP 调用不占用 DB 连接（脚本只读一次，autocommit 即可）。
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public List<JsonNode> extractVariables(String scriptId, String userId) {
        JsonNode script = getScript(scriptId, userId);
        if (script == null) return new ArrayList<>();
        return materialAi.extractVariables(script.get("blocks"));
    }

    // ── 爆款雷达 ───────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<JsonNode> listViralHits() {
        List<JsonNode> out = new ArrayList<>();
        viralRepo.findAllByOrderByScoreDesc().forEach(h -> out.add(parse(h.getPayloadJson())));
        return out;
    }

    /**
     * 爆款雷达改为「用户主动提交链接」：不做平台批量抓取，只解析这一个 URL 并交给 AI 拆解。
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public JsonNode analyzeViralUrl(JsonNode body, String userId) {
        String sourceUrl = extractUrl(orDefault(text(body, "url"), ""));
        if (sourceUrl == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "VIRAL_URL_REQUIRED", "请填入要分析的视频链接");
        }
        validateHttpUrl(sourceUrl);
        String videoUrl = firstNonBlank(text(body, "video_url"), text(body, "videoUrl"), isDirectVideoUrl(sourceUrl) ? sourceUrl : null);
        if (videoUrl == null) {
            videoUrl = resolveSubmittedVideoUrl(sourceUrl);
        }
        if (videoUrl == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "VIRAL_VIDEO_UNRESOLVED",
                    "未能从该链接解析到可分析的视频地址，请粘贴视频直链或换一个分享链接");
        }
        videoUrl = trimTrailingPunctuation(videoUrl);
        validateHttpUrl(videoUrl);
        String platform = normalizePlatform(firstNonBlank(text(body, "platform"), inferPlatform(sourceUrl)));
        String titleHint = firstNonBlank(text(body, "title_hint"), titleHintFromUrl(sourceUrl));

        JsonNode analyzed = materialAi.analyzeViralLink(sourceUrl, videoUrl, platform, titleHint);
        if (!(analyzed instanceof ObjectNode obj)) return analyzed;
        String id = "viral-url-" + shortHash(sourceUrl);
        obj.put("id", id);
        obj.put("source_url", sourceUrl);
        if (videoUrl != null) obj.put("video_url", videoUrl);
        obj.put("analyzed_at", OffsetDateTime.now().toString());
        obj.put("submitted_by", userId == null || userId.isBlank() ? "anonymous" : userId);
        viralRepo.save(MaterialViralHit.builder()
                .id(id)
                .platform(obj.path("platform").asText(platform))
                .score(obj.path("score").asInt(0))
                .payloadJson(write(obj))
                .build());
        return obj;
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    private void bumpProduct(String productId) {
        try {
            productService.bumpUsageCountByProductId(productId);
        } catch (Exception ignored) {
            // 商品不存在 / 方法签名差异时静默，不阻塞素材落库。
        }
    }

    private JsonNode parse(String json) {
        try {
            return om.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException("bad material payload json", e);
        }
    }

    private String write(JsonNode node) {
        try {
            return om.writeValueAsString(node);
        } catch (Exception e) {
            throw new RuntimeException("cannot serialize material payload", e);
        }
    }

    private JsonNode toScriptWire(MaterialScript script) {
        JsonNode parsed = parse(script.getPayloadJson());
        if (!(parsed instanceof ObjectNode obj)) return parsed;
        applyOwnerFields(obj, script.getOwnerUserId());
        return obj;
    }

    private JsonNode scriptPayloadForSave(JsonNode body, String ownerUserId) {
        ObjectNode obj = body instanceof ObjectNode
                ? ((ObjectNode) body).deepCopy()
                : om.createObjectNode().setAll(om.convertValue(body, ObjectNode.class));
        applyOwnerFields(obj, ownerUserId);
        if (ownerUserId != null && !ownerUserId.isBlank()) {
            obj.put("created_by", ownerUserId);
        }
        return obj;
    }

    private void applyOwnerFields(ObjectNode obj, String ownerUserId) {
        if (ownerUserId == null || ownerUserId.isBlank()) {
            obj.putNull("owner_user_id");
            obj.putNull("owner_display_name");
            obj.putNull("owner_username");
            return;
        }

        AepUser owner = userRepo.findById(ownerUserId).orElse(null);
        String username = owner != null ? owner.getUsername() : null;
        String displayName = owner != null ? owner.getDisplayName() : null;
        obj.put("owner_user_id", ownerUserId);
        if (displayName != null && !displayName.isBlank()) {
            obj.put("owner_display_name", displayName);
        } else if (username != null && !username.isBlank()) {
            obj.put("owner_display_name", username);
        } else {
            obj.put("owner_display_name", ownerUserId);
        }
        if (username != null && !username.isBlank()) {
            obj.put("owner_username", username);
        } else {
            obj.putNull("owner_username");
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static final Set<String> VIRAL_LINK_HOST_SUFFIXES = Set.of(
            "douyin.com", "iesdouyin.com", "amemv.com", "snssdk.com",
            "xiaohongshu.com", "xhslink.com",
            "kuaishou.com", "gifshow.com",
            "weixin.qq.com", "channels.weixin.qq.com"
    );
    private static final Pattern URL_PATTERN = Pattern.compile("https?://[^\\s，。；;、)）]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern DIRECT_VIDEO_URL_PATTERN = Pattern.compile(
            "https?://[^\"'<>\\\\\\s]+?\\.(?:mp4|mov|webm|m4v)(?:\\?[^\"'<>\\\\\\s]*)?",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern KEYED_VIDEO_URL_PATTERN = Pattern.compile(
            "(?:play_addr|playAddr|download_addr|downloadAddr|video_url|videoUrl|url_list|urlList).{0,1200}?(https?://[^\"'<>\\\\\\s]+)",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static String extractUrl(String raw) {
        if (raw == null) return null;
        String s = raw.strip();
        if (s.isBlank()) return null;
        Matcher m = URL_PATTERN.matcher(s);
        return m.find() ? trimTrailingPunctuation(m.group()) : (s.startsWith("http://") || s.startsWith("https://") ? trimTrailingPunctuation(s) : null);
    }

    private static String trimTrailingPunctuation(String url) {
        String s = url == null ? null : url.strip();
        if (s == null) return null;
        while (s.endsWith(".") || s.endsWith(",") || s.endsWith("，") || s.endsWith("。")) {
            s = s.substring(0, s.length() - 1);
        }
        return s;
    }

    private static void validateHttpUrl(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) throw new IllegalArgumentException();
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "VIRAL_URL_INVALID", "链接格式不正确");
        }
    }

    private static boolean isDirectVideoUrl(String url) {
        String path = URI.create(url).getPath().toLowerCase(Locale.ROOT);
        return path.endsWith(".mp4") || path.endsWith(".mov") || path.endsWith(".webm") || path.endsWith(".m4v");
    }

    /**
     * 只解析用户提交的这一条分享页，不做平台批量抓取。为降低 SSRF 面，非直链只允许已知短视频平台域名。
     */
    private String resolveSubmittedVideoUrl(String sourceUrl) {
        URI current;
        try {
            current = URI.create(sourceUrl);
        } catch (Exception e) {
            return null;
        }
        if (!isAllowedViralHost(current.getHost())) return null;

        for (int i = 0; i < 4; i++) {
            if (!isAllowedViralHost(current.getHost())) return null;
            try {
                HttpRequest req = HttpRequest.newBuilder(current)
                        .timeout(Duration.ofSeconds(8))
                        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36")
                        .header("Accept", "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8")
                        .GET()
                        .build();
                HttpResponse<String> res = viralHttp.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                int status = res.statusCode();
                if (status >= 300 && status < 400) {
                    String loc = res.headers().firstValue("location").orElse(null);
                    if (loc == null || loc.isBlank()) return null;
                    URI next = current.resolve(loc);
                    if (!isHttpUri(next)) return null;
                    String nextUrl = trimTrailingPunctuation(next.toString());
                    if (isLikelyVideoUrl(nextUrl)) return nextUrl;
                    if (!isAllowedViralHost(next.getHost())) return null;
                    current = next;
                    continue;
                }
                if (status < 200 || status >= 300) return null;
                return extractVideoUrlFromHtml(res.body());
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    private static boolean isHttpUri(URI uri) {
        String scheme = uri.getScheme();
        return "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
    }

    private static boolean isAllowedViralHost(String host) {
        if (host == null || host.isBlank()) return false;
        String h = host.toLowerCase(Locale.ROOT);
        for (String suffix : VIRAL_LINK_HOST_SUFFIXES) {
            if (h.equals(suffix) || h.endsWith("." + suffix)) return true;
        }
        return false;
    }

    private static String extractVideoUrlFromHtml(String html) {
        if (html == null || html.isBlank()) return null;
        String normalized = normalizeHtmlEscapes(html.length() > 2_000_000 ? html.substring(0, 2_000_000) : html);
        Matcher direct = DIRECT_VIDEO_URL_PATTERN.matcher(normalized);
        if (direct.find()) return cleanupScrapedUrl(direct.group());

        Matcher keyed = KEYED_VIDEO_URL_PATTERN.matcher(normalized);
        while (keyed.find()) {
            String candidate = cleanupScrapedUrl(keyed.group(1));
            if (isLikelyVideoUrl(candidate)) return candidate;
        }
        return null;
    }

    private static String normalizeHtmlEscapes(String html) {
        return html
                .replace("\\u002F", "/")
                .replace("\\u002f", "/")
                .replace("\\u003A", ":")
                .replace("\\u003a", ":")
                .replace("\\u0026", "&")
                .replace("\\/", "/")
                .replace("&amp;", "&");
    }

    private static String cleanupScrapedUrl(String raw) {
        if (raw == null) return null;
        String s = trimTrailingPunctuation(raw.strip());
        while (s != null && (s.endsWith("\\") || s.endsWith("&quot;"))) {
            s = s.substring(0, s.length() - (s.endsWith("&quot;") ? 6 : 1));
        }
        return s;
    }

    private static boolean isLikelyVideoUrl(String url) {
        if (url == null || url.isBlank()) return false;
        try {
            validateHttpUrl(url);
            if (isDirectVideoUrl(url)) return true;
            URI uri = URI.create(url);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase(Locale.ROOT);
            String query = uri.getQuery() == null ? "" : uri.getQuery().toLowerCase(Locale.ROOT);
            String combined = host + " " + path + " " + query;
            return combined.contains("douyinvod")
                    || combined.contains("douyinvideo")
                    || combined.contains("sns-video")
                    || combined.contains("kwaicdn")
                    || combined.contains("gifshow")
                    || combined.contains("video_id=")
                    || path.contains("/aweme/v1/play")
                    || path.contains("/play/");
        } catch (Exception e) {
            return false;
        }
    }

    private static String inferPlatform(String url) {
        String host = URI.create(url).getHost();
        String h = host == null ? "" : host.toLowerCase(Locale.ROOT);
        if (h.contains("xiaohongshu") || h.contains("xhslink")) return "xhs";
        if (h.contains("kuaishou") || h.contains("gifshow")) return "kuaishou";
        if (h.contains("weixin") || h.contains("channels")) return "wechat";
        return "douyin";
    }

    private static String normalizePlatform(String p) {
        String v = p == null ? "" : p.strip().toLowerCase(Locale.ROOT);
        return switch (v) {
            case "douyin", "xhs", "wechat", "kuaishou" -> v;
            default -> "douyin";
        };
    }

    private static String titleHintFromUrl(String url) {
        try {
            String path = URI.create(url).getPath();
            if (path == null || path.isBlank()) return "链接解析视频";
            int slash = path.lastIndexOf('/');
            String file = slash >= 0 ? path.substring(slash + 1) : path;
            int dot = file.lastIndexOf('.');
            if (dot > 0) file = file.substring(0, dot);
            String decoded = URLDecoder.decode(file, StandardCharsets.UTF_8);
            return decoded.isBlank() ? "链接解析视频" : decoded;
        } catch (Exception e) {
            return "链接解析视频";
        }
    }

    private static String shortHash(String input) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-1").digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 6);
        } catch (Exception e) {
            return Long.toString(Math.abs(input.hashCode()), 36);
        }
    }

    private static String firstNonBlank(String... vals) {
        for (String v : vals) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }

    private static List<String> strList(JsonNode arr) {
        List<String> out = new ArrayList<>();
        if (arr != null && arr.isArray()) {
            arr.forEach(x -> {
                String t = x.asText("").strip();
                if (!t.isBlank()) out.add(t);
            });
        }
        return out;
    }
}
