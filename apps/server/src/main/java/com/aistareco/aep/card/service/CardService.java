package com.aistareco.aep.card.service;

import com.aistareco.aep.card.model.CardProfile;
import com.aistareco.aep.card.repository.CardProfileRepository;
import com.aistareco.aep.dap.service.DapAssetService;
import com.aistareco.common.BusinessException;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 名片读取。一期只有公开读 —— 建卡 / 编辑 / 发布随二期补。
 *
 * <p><b>公开读不校验登录</b>：见客户扫码就得能打开。安全面靠三件事，缺一不可：
 * {@code AepSecurityConfig} 的 permitAll、{@code ProductRouteTable.PUBLIC_GETS} 的登记、
 * 以及这里只吐 {@code status=published} 且未软删的名片。
 *
 * <p>出 wire 一律经 {@link CdnUrlSigner} 派生签名地址：文档里存的是 cdnKey，
 * 签名 URL 有 TTL，绝不能落库（§4.7.7 的教训）。
 */
@Service
public class CardService {

    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(CardService.class);

    /** 前端保留短链：后端未接通时的演示入口，不允许真实名片占用。 */
    public static final Set<String> RESERVED_SLUGS = Set.of("demo", "p", "new", "preview");

    /** 短链规则：小写起头，只收小写字母 / 数字 / 连字符，3–32 位。进 URL 的东西不能含歧义字符。 */
    private static final java.util.regex.Pattern SLUG = java.util.regex.Pattern.compile("^[a-z0-9][a-z0-9-]{2,31}$");

    private final CardProfileRepository repo;
    private final CdnUrlSigner signer;
    private final ObjectMapper mapper;
    private final DapAssetService assets;

    public CardService(CardProfileRepository repo, CdnUrlSigner signer, ObjectMapper mapper,
                       DapAssetService assets) {
        this.repo = repo;
        this.signer = signer;
        this.mapper = mapper;
        this.assets = assets;
    }

    // ── 属主入口（唯一一处校验归属，其余方法都从这里拿实体）──────────

    @Transactional(readOnly = true)
    public CardProfile required(String userId, String id) {
        CardProfile c = repo.findById(id)
                .filter(x -> x.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("CARD_NOT_FOUND", "名片不存在"));
        if (!c.getOwnerUserId().equals(userId)) {
            // 不是「无权限」而是「不存在」：否则可以拿别人的 id 探出名片存在与否。
            throw BusinessException.notFound("CARD_NOT_FOUND", "名片不存在");
        }
        return c;
    }

    @Transactional(readOnly = true)
    public List<CardProfile> listMine(String userId) {
        return repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> detail(String userId, String id) {
        return toWire(required(userId, id));
    }

    // ── 建卡 / 保存 / 发布 ──────────────────────────────────

    /**
     * 建卡。{@code avatarId} 可选 —— 从数字资产一键建卡时带上，名片即引用那个形象；
     * 不带就是空壳，之后在编辑器里挑。**一个账号可以有多张名片**（对外身份可能不止一个）。
     */
    @Transactional
    public CardProfile create(String userId, String slug, String avatarId, Map<String, Object> doc) {
        String s = normalizeSlug(slug);
        requireSlugFree(s, null);
        Instant now = Instant.now();
        CardProfile c = CardProfile.builder()
                .id("CARD-" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 8))
                .ownerUserId(userId)
                .slug(s)
                .regNo("BC-" + (1000 + Math.abs(s.hashCode() % 9000)))
                .status(CardProfile.STATUS_DRAFT)
                .avatarId(trimToNull(avatarId))
                .payloadJson(writeDoc(doc))
                .createdAt(now).updatedAt(now)
                .build();
        return repo.save(c);
    }

    /** 保存名片文档。整存整取：服务端逐字保存，不改写内容（与 ipstudio 画布同一条纪律）。 */
    @Transactional
    public CardProfile save(String userId, String id, String slug, String avatarId, Map<String, Object> doc) {
        CardProfile c = required(userId, id);
        if (slug != null && !slug.equals(c.getSlug())) {
            String s = normalizeSlug(slug);
            requireSlugFree(s, c.getId());
            c.setSlug(s);
        }
        if (avatarId != null) c.setAvatarId(trimToNull(avatarId));
        if (doc != null) c.setPayloadJson(writeDoc(doc));
        c.setUpdatedAt(Instant.now());
        return repo.save(c);
    }

    /**
     * 发布。发布后名片就能被匿名访客读到，所以这里是唯一一道内容闸。
     *
     * <p>顺带写一条 {@code DapAssetUsage} —— 于是数字资产详情页能看到
     * 「已用于 · AI 数字名片」，形象被删 / 授权撤销时也能立刻查到影响面。
     * 用量写入是**旁路**：失败只记日志，不能让名片发不出去（§8.0 观测类例外）。
     */
    @Transactional
    public CardProfile publish(String userId, String id) {
        CardProfile c = required(userId, id);
        JsonNode doc = readDoc(c);
        if (blank(doc, "name")) {
            throw BusinessException.badRequest("CARD_NAME_REQUIRED", "名片还没有名字，先把基础信息填上");
        }
        if (blank(doc, "title")) {
            throw BusinessException.badRequest("CARD_TITLE_REQUIRED", "名片还没有身份（公司 · 职务），先补上再发布");
        }
        Instant now = Instant.now();
        c.setStatus(CardProfile.STATUS_PUBLISHED);
        c.setPublishedAt(now);
        c.setUpdatedAt(now);
        CardProfile saved = repo.save(c);
        recordAvatarUsage(userId, saved, doc);
        return saved;
    }

    @Transactional
    public CardProfile unpublish(String userId, String id) {
        CardProfile c = required(userId, id);
        c.setStatus(CardProfile.STATUS_DRAFT);
        c.setUpdatedAt(Instant.now());
        return repo.save(c);
    }

    @Transactional
    public void softDelete(String userId, String id) {
        CardProfile c = required(userId, id);
        c.setDeletedAt(Instant.now());
        c.setStatus(CardProfile.STATUS_DRAFT);
        c.setUpdatedAt(Instant.now());
        repo.save(c);
    }

    private void recordAvatarUsage(String userId, CardProfile c, JsonNode doc) {
        if (c.getAvatarId() == null) return;
        try {
            String name = doc.path("name").asText(c.getRegNo());
            assets.recordUsage(userId, "avatar", c.getAvatarId(), "card", c.getId(),
                    name + " · 数字名片", "REG · " + c.getRegNo(), null);
        } catch (RuntimeException e) {
            // 旁路：用量是观测数据，丢了不该阻断发布。
            LOG.warn("[card] 写资产用量失败 card={} avatar={}", c.getId(), c.getAvatarId(), e);
        }
    }

    // ── 短链 ────────────────────────────────────────────────

    private String normalizeSlug(String raw) {
        String s = raw == null ? "" : raw.trim().toLowerCase(java.util.Locale.ROOT);
        if (!SLUG.matcher(s).matches()) {
            throw BusinessException.badRequest("CARD_SLUG_INVALID",
                    "短链只能用小写字母、数字和连字符，3–32 位，且要以字母或数字开头");
        }
        if (RESERVED_SLUGS.contains(s)) {
            throw BusinessException.badRequest("CARD_SLUG_RESERVED", "「" + s + "」是保留短链，换一个");
        }
        return s;
    }

    private void requireSlugFree(String slug, String selfId) {
        repo.findBySlug(slug)
                .filter(x -> selfId == null || !x.getId().equals(selfId))
                .ifPresent(x -> {
                    throw BusinessException.badRequest("CARD_SLUG_TAKEN", "这个短链被占用了，换一个");
                });
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static boolean blank(JsonNode doc, String field) {
        JsonNode v = doc.path(field);
        return !v.isTextual() || v.asText().isBlank();
    }

    private String writeDoc(Map<String, Object> doc) {
        try {
            JsonNode tree = mapper.valueToTree(doc == null ? Map.of() : doc);
            stripDerivedUrls(tree);
            return mapper.writeValueAsString(tree);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw BusinessException.badRequest("CARD_DOC_INVALID", "名片内容存不下来，检查一下格式");
        }
    }

    /**
     * 落库前扔掉派生出来的 {@code xxxUrl}（前提是同级有 {@code xxxKey}）。
     *
     * <p>为什么必须扔：出 wire 时 {@link #deriveUrls} 会给每个 key 现签一个**带 TTL** 的 URL。
     * 编辑器拿到的就是这份带 URL 的文档，原样 PUT 回来 —— 签名 URL 就进了 payload_json。
     * 那份 URL 一小时后就过期，而且真值本来就是 key（§4.7.4），存它有害无益：
     * 既把一段签名写进了持久化存储，又留下一堆读的时候必然被覆盖的死数据。
     *
     * <p>没有 key 兄弟的 URL 一律保留 —— 那可能是用户自己填的外链（个人主页、社交账号），
     * 不是我们的资产。这类老文档里的自有资产 URL 由 {@link #resignUrls} 在读的时候兜底重签。
     */
    private static void stripDerivedUrls(JsonNode node) {
        if (node == null) return;
        if (node.isObject()) {
            ObjectNode o = (ObjectNode) node;
            List<String> fields = new ArrayList<>();
            o.fieldNames().forEachRemaining(fields::add);
            for (String f : fields) {
                if (f.endsWith("Url") && f.length() > 3) {
                    String keyField = f.substring(0, f.length() - 3) + "Key";
                    JsonNode key = o.get(keyField);
                    if (key != null && key.isTextual() && !key.asText().isBlank()) {
                        o.remove(f);
                        continue;
                    }
                }
                stripDerivedUrls(o.get(f));
            }
        } else if (node.isArray()) {
            for (JsonNode v : node) stripDerivedUrls(v);
        }
    }

    private JsonNode readDoc(CardProfile c) {
        try {
            JsonNode n = mapper.readTree(c.getPayloadJson());
            return n == null ? mapper.createObjectNode() : n;
        } catch (Exception e) {
            return mapper.createObjectNode();
        }
    }

    /**
     * 按短链读公开名片。
     *
     * <p>找不到 / 已软删 / 尚未发布，一律 404 同一个错误码 —— 不区分「不存在」与
     * 「存在但没发布」，否则短链可以被枚举出哪些名片存在。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> publicBySlug(String slug) {
        CardProfile card = repo.findBySlug(slug)
                .filter(CardProfile::isPublished)
                .orElseThrow(() -> BusinessException.notFound("CARD_NOT_FOUND", "这张名片不存在或已取消发布"));
        return toWire(card);
    }

    /** 形象被删 / 授权撤销时反查受影响的名片 —— 调用方据此通知主人，不能只静默回退。 */
    @Transactional(readOnly = true)
    public List<CardProfile> affectedByAvatar(String avatarId) {
        return avatarId == null ? List.of() : repo.findByAvatarIdAndDeletedAtIsNull(avatarId);
    }

    // ── 出 wire ─────────────────────────────────────────────

    private Map<String, Object> toWire(CardProfile card) {
        ObjectNode doc;
        try {
            JsonNode parsed = mapper.readTree(card.getPayloadJson());
            doc = parsed != null && parsed.isObject() ? (ObjectNode) parsed : mapper.createObjectNode();
        } catch (Exception e) {
            throw BusinessException.wrapped(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "CARD_DOC_BROKEN", "名片内容读不出来了", "payloadJson 解析失败 card=" + card.getId());
        }

        // 文档里的 *Key 字段 → 派生签名 URL（真值是 key，URL 是派生值，§4.7.4）。
        deriveUrls(doc);
        // 老文档若直接存了 URL，兜底重签一次：签名过期后 maybeSign 同样有效（§4.7.7）。
        resignUrls(doc);

        // 列上的字段永远盖过文档里的同名值 —— 短链和登记号的真值在列上，不在文档里。
        doc.put("slug", card.getSlug());
        doc.put("regNo", card.getRegNo());
        if (card.getUpdatedAt() != null) {
            doc.put("updatedAt", card.getUpdatedAt().toString().substring(0, 10));
        }
        doc.remove("demo");

        return mapper.convertValue(doc, Map.class);
    }

    /** {@code xxxKey} → {@code xxxUrl}。key 是真值，URL 每次出 wire 现签。 */
    private void deriveUrls(JsonNode node) {
        if (node == null) return;
        if (node.isObject()) {
            ObjectNode o = (ObjectNode) node;
            List<String> keys = new ArrayList<>();
            o.fieldNames().forEachRemaining(keys::add);
            for (String k : keys) {
                JsonNode v = o.get(k);
                if (v != null && v.isTextual() && k.endsWith("Key") && k.length() > 3) {
                    String urlField = k.substring(0, k.length() - 3) + "Url";
                    String signed = signer.signKey(v.asText());
                    if (signed != null) o.put(urlField, signed);
                } else {
                    deriveUrls(v);
                }
            }
        } else if (node.isArray()) {
            for (JsonNode v : node) deriveUrls(v);
        }
    }

    private void resignUrls(JsonNode node) {
        if (node == null) return;
        if (node.isObject()) {
            ObjectNode o = (ObjectNode) node;
            List<String> keys = new ArrayList<>();
            o.fieldNames().forEachRemaining(keys::add);
            for (String k : keys) {
                JsonNode v = o.get(k);
                if (v != null && v.isTextual()) {
                    String signed = signer.maybeSign(v.asText());
                    if (signed != null && !signed.equals(v.asText())) o.put(k, signed);
                } else {
                    resignUrls(v);
                }
            }
        } else if (node.isArray()) {
            ArrayNode a = (ArrayNode) node;
            for (int i = 0; i < a.size(); i++) {
                JsonNode v = a.get(i);
                if (v != null && v.isTextual()) {
                    String signed = signer.maybeSign(v.asText());
                    if (signed != null && !signed.equals(v.asText())) a.set(i, signed);
                } else {
                    resignUrls(v);
                }
            }
        }
    }
}
