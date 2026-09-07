package com.aistareco.aep.card.service;

import com.aistareco.aep.card.model.CardProfile;
import com.aistareco.aep.card.repository.CardProfileRepository;
import com.aistareco.common.BusinessException;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    /** 前端保留短链：后端未接通时的演示入口，不允许真实名片占用。 */
    public static final Set<String> RESERVED_SLUGS = Set.of("demo", "p", "new", "preview");

    private final CardProfileRepository repo;
    private final CdnUrlSigner signer;
    private final ObjectMapper mapper;

    public CardService(CardProfileRepository repo, CdnUrlSigner signer, ObjectMapper mapper) {
        this.repo = repo;
        this.signer = signer;
        this.mapper = mapper;
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
