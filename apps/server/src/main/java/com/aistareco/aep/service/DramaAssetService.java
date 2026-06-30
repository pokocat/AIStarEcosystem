package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaAsset;
import com.aistareco.aep.repository.DramaAssetRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 短剧素材库 CRUD（用户个人素材）。文件经 DramaAssetUploadController 落 OSS 后，
 * 前端用返回的 cdnKey 调本服务建记录；列表 / 删除 / 改名都按 ownerUserId 隔离。
 * 出 wire 时 cdnKey → signer 派生签名 URL（§4.7）。
 */
@Service
public class DramaAssetService {

    private static final Set<String> CATS = Set.of("人物", "场景", "道具", "其他");

    private final DramaAssetRepository repo;
    private final CdnUrlSigner signer;
    private final ObjectMapper om;

    public DramaAssetService(DramaAssetRepository repo, CdnUrlSigner signer, ObjectMapper om) {
        this.repo = repo;
        this.signer = signer;
        this.om = om;
    }

    public List<JsonNode> list(String userId) {
        return repo.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .stream().map(this::toDto).toList();
    }

    public JsonNode create(JsonNode body, String userId) {
        String cdnKey = text(body, "cdnKey");
        if (cdnKey == null || cdnKey.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ASSET_CDN_KEY_REQUIRED", "缺少素材文件（请先上传）");
        }
        String name = orDefault(text(body, "name"), "未命名素材");
        String cat = normCat(text(body, "cat"));
        String kind = orDefault(text(body, "kind"), "image");
        OffsetDateTime now = OffsetDateTime.now();
        DramaAsset a = DramaAsset.builder()
                .id("da_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .ownerUserId(userId)
                .name(name.trim())
                .cat(cat)
                .kind("video".equals(kind) ? "video" : "image")
                .cdnKey(cdnKey.trim())
                .tags(normTags(body.path("tags")))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toDto(repo.save(a));
    }

    public JsonNode update(String id, JsonNode body, String userId) {
        DramaAsset a = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ASSET_NOT_FOUND", "素材不存在"));
        if (body.has("name")) a.setName(orDefault(text(body, "name"), a.getName()).trim());
        if (body.has("cat")) a.setCat(normCat(text(body, "cat")));
        if (body.has("tags")) a.setTags(normTags(body.path("tags")));
        a.setUpdatedAt(OffsetDateTime.now());
        return toDto(repo.save(a));
    }

    public void delete(String id, String userId) {
        DramaAsset a = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId).orElse(null);
        if (a == null) return;
        a.setDeletedAt(OffsetDateTime.now());
        repo.save(a);
    }

    private JsonNode toDto(DramaAsset a) {
        ObjectNode o = om.createObjectNode();
        o.put("id", a.getId());
        o.put("name", a.getName());
        o.put("cat", a.getCat());
        o.put("kind", a.getKind() != null ? a.getKind() : "image");
        // Material 需要 from/to 渐变兜底（真图加载前 / 失败时占位）。
        o.put("from", "#f97316");
        o.put("to", "#e11d48");
        o.put("cdnKey", a.getCdnKey());
        o.put("url", a.getCdnKey() != null ? signer.signKey(a.getCdnKey()) : null);
        ArrayNode tags = o.putArray("tags");
        if (a.getTags() != null) {
            for (String t : a.getTags().split("[、,，\\s]+")) {
                if (!t.isBlank()) tags.add(t.trim());
            }
        }
        o.put("createdAt", a.getCreatedAt() != null ? a.getCreatedAt().toString() : null);
        return o;
    }

    private String normCat(String cat) {
        String c = cat == null ? "" : cat.trim();
        return CATS.contains(c) ? c : "其他";
    }

    private String normTags(JsonNode tags) {
        if (tags == null || !tags.isArray()) return "";
        StringBuilder sb = new StringBuilder();
        for (JsonNode t : tags) {
            String s = t.asText("").trim();
            if (!s.isEmpty()) sb.append(sb.length() == 0 ? "" : "、").append(s);
        }
        return sb.toString();
    }

    private static String text(JsonNode n, String f) {
        JsonNode v = n == null ? null : n.get(f);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }
}
