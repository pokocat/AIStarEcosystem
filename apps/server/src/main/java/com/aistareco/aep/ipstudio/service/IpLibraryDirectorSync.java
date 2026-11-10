package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.director.DirectorWorkRepository;
import com.aistareco.aep.ipstudio.model.IpLibraryRecord;
import com.aistareco.aep.ipstudio.repository.IpLibraryRecordRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 导演台 → 资产库（2026-11-07，真源 docs/ip-studio-personal-asset-library-plan.md 末节）。
 *
 * <p>做法和生成结果归集一样是后台对账：比对最近改过的作品和资产库，缺什么补什么。不挂在导演台的保存上，
 * 入库失败不影响创作，存量作品也走同一条路。不调模型、不扣积分、不复制文件，也不写回作品。
 *
 * <ul>
 *   <li>角色、场景、道具第一次有图时建一张卡，同一部作品的同一项始终对应这张卡（binding），名字相同也不合并。</li>
 *   <li>关联过资产库的（libraryObjectId）不新建，关联之后的新图追加到原来那张卡，也不动它的主图。</li>
 *   <li>主图跟着导演台采用的版本走，用户在资产库选过主图后不再跟（mainAssigned）。</li>
 *   <li>名字和描述只带入一次；用户在资产库删掉的不补回来。</li>
 *   <li>分镜图、片段视频、整集成片只是文件，补上能认的名字，不建卡。</li>
 * </ul>
 */
@Service
public class IpLibraryDirectorSync {
    private static final Logger log = LoggerFactory.getLogger(IpLibraryDirectorSync.class);
    static final String MARKER = "ILW-";
    private static final int BATCH = 20;
    private static final int VERSION_PROMPT_MAX = 1000;
    private static final Set<String> KINDS = Set.of("character", "scene", "prop");
    private static final Map<String, String> IMAGE_LABEL = Map.of("character", "角色图", "scene", "场景图", "prop", "道具图");
    private static final Map<String, String> VIEW_LABEL = Map.of("reverse", "反打", "left", "左立面", "right", "右立面");

    public record Pending(String workId, String ownerUserId) {}
    private record Image(JsonNode candidate, String label, String title, String node) {}

    private final DirectorWorkRepository works;
    private final IpLibraryRecordRepository records;
    private final IpLibraryService library;
    private final IpSavedAssetService saved;
    private final IpProjectService projects;
    private final IpRunRepository runs;
    private final AepUserRepository users;
    private final ObjectMapper om;

    public IpLibraryDirectorSync(DirectorWorkRepository works, IpLibraryRecordRepository records, IpLibraryService library, IpSavedAssetService saved,
                                 IpProjectService projects, IpRunRepository runs, AepUserRepository users, ObjectMapper om) {
        this.works = works; this.records = records; this.library = library; this.saved = saved;
        this.projects = projects; this.runs = runs; this.users = users; this.om = om;
    }

    /** 改过、还没对账的作品。读取出错的作品由调用方隔一段时间再试，所以按页往后翻，不会一直卡在前面几部上。 */
    public List<Pending> pending(int page) {
        List<Pending> out = new ArrayList<>();
        for (Object[] row : works.needingLibrarySync(PageRequest.of(page, BATCH))) out.add(new Pending((String) row[0], (String) row[1]));
        return out;
    }

    public int batchSize() { return BATCH; }

    /** 先拿用户行锁再读，和 {@link IpLibraryService#collect} 同序：MySQL 可重复读的快照在第一次普通读时才定，先读会覆盖掉用户刚保存的修改。 */
    @Transactional
    public void sync(Pending target) {
        users.findByIdForUpdate(target.ownerUserId()).orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND", "账号不存在"));
        var work = works.findById(target.workId()).orElse(null);
        if (work == null || work.getDeletedAt() != null || !target.ownerUserId().equals(work.getOwnerUserId())) return;
        String user = work.getOwnerUserId();
        JsonNode content = parse(work.getContentJson());

        String markerId = MARKER + work.getId();
        IpLibraryRecord marker = records.findById(markerId).orElse(null);
        ObjectNode state = marker == null ? om.createObjectNode() : (ObjectNode) parse(marker.getPayloadJson());
        ObjectNode seenAssets = state.path("assets").isObject() ? (ObjectNode) state.path("assets") : state.putObject("assets");
        ObjectNode seenMedia = state.path("media").isObject() ? (ObjectNode) state.path("media") : state.putObject("media");

        for (JsonNode asset : content.path("assets")) {
            String kind = asset.path("kind").asText(), assetId = asset.path("id").asText();
            if (!KINDS.contains(kind) || assetId.isBlank()) continue;
            List<Image> images = imagesOf(asset);
            if (images.isEmpty()) continue;
            String fingerprint = fingerprint(asset, images, work.getTitle());
            JsonNode seen = seenAssets.path(assetId);
            if (fingerprint.equals(seen.path("fingerprint").asText())) continue;
            String linkedSince = linkedSince(asset, seen);
            String objectId = syncAsset(user, work.getId(), work.getTitle(), asset, images, linkedSince);
            ObjectNode entry = seenAssets.putObject(assetId).put("fingerprint", fingerprint);
            if (objectId != null) entry.put("objectId", objectId);
            if (linkedSince != null && !asset.path("libraryLinkedAt").isTextual()) entry.put("linkedSince", linkedSince);
            for (Image image : images) saveMedia(user, work.getId(), image, "image", seenMedia, objectId);
        }
        for (Image media : clipMedia(content)) saveMedia(user, work.getId(), media, media.node().startsWith("board:") ? "image" : "video", seenMedia, null);

        if (marker == null) marker = IpLibraryRecord.builder().id(markerId).ownerUserId(user).recordType("receipt").createdAt(Instant.now()).build();
        marker.setPayloadJson(state.toString());
        // 记作品读到的那个时间而不是现在：读完之后又改过的作品，下一轮还会再对一次。
        marker.setUpdatedAt(work.getUpdatedAt());
        records.save(marker);
    }

    /** @return 这一项在资产库对应的卡；用户删掉了就是 null。 */
    private String syncAsset(String user, String workId, String workTitle, JsonNode asset, List<Image> images, String linkedSince) {
        String assetId = asset.path("id").asText();
        String bindingId = "ILB-" + IpLibraryService.hash(user + "\0director\0" + workId + "\0" + assetId).substring(0, 24);
        String linked = asset.path("libraryObjectId").asText("");
        boolean owned = linked.isBlank();
        IpLibraryRecord row;
        if (!owned) {
            row = liveObject(user, linked);
            if (row == null) return null;
        } else {
            IpLibraryRecord binding = records.findById(bindingId).filter(b -> user.equals(b.getOwnerUserId())).orElse(null);
            if (binding != null) {
                row = liveObject(user, parse(binding.getPayloadJson()).path("objectId").asText());
                if (row == null) return null;
            } else {
                row = newObject(user, asset, images);
                records.save(row);
                records.save(record(user, "binding", bindingId, om.createObjectNode().put("objectId", row.getId())));
            }
        }
        ObjectNode data = (ObjectNode) parse(row.getPayloadJson());
        ArrayNode versions = data.path("versions").isArray() ? (ArrayNode) data.path("versions") : data.putArray("versions");
        // 关联之前这项自己的图不是原来那张卡的：只追加关联之后的新图。
        for (Image image : images) if (owned || madeSince(linkedSince, image)) addVersion(user, data, image);
        if (owned && !data.path("mainAssigned").asBoolean()) {
            String adopted = adoptedKey(asset.path("image"));
            for (JsonNode v : versions) if (v.path("storageKey").asText().equals(adopted)) data.put("mainVersionId", v.path("id").asText());
        }
        ArrayNode sources = data.path("sources").isArray() ? (ArrayNode) data.path("sources") : data.putArray("sources");
        ObjectNode source = null;
        for (JsonNode s : sources) if (bindingId.equals(s.path("id").asText())) source = (ObjectNode) s;
        if (source == null) source = sources.addObject().put("id", bindingId).put("projectId", workId).put("nodeId", assetId)
                .put("evidence", "").put("description", "").put("origin", owned ? "director" : "director-link");
        source.put("title", workTitle);
        row.setPayloadJson(data.toString());
        row.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        records.save(row);
        return row.getId();
    }

    /**
     * 从什么时候起的图算关联之后的。2026-11-07 之前关联的没有记时间：第一次对账时记下当时作为起点（存在对账记录里），
     * 之前的图分不清是不是原卡的，不往上加，之后的新图照常追加。没关联的返回 null。
     */
    private static String linkedSince(JsonNode asset, JsonNode seen) {
        if (asset.path("libraryObjectId").asText("").isBlank()) return null;
        if (asset.path("libraryLinkedAt").isTextual()) return asset.path("libraryLinkedAt").asText();
        return seen.path("linkedSince").isTextual() ? seen.path("linkedSince").asText() : Instant.now().toString();
    }

    private static boolean madeSince(String since, Image image) {
        try { return !Instant.parse(image.candidate().path("createdAt").asText()).isBefore(Instant.parse(since)); }
        catch (Exception unknown) { return false; }
    }

    private void addVersion(String user, ObjectNode data, Image image) {
        JsonNode m = image.candidate();
        String key = m.path("key").asText();
        // 作品里的 key 进来时都验过；真碰到不是本人的就跳过这一张，不让整部作品一直重试（抛出去还会把外层事务标成回滚）。
        if (!projects.ownsAssetKey(user, key)) { log.warn("[asset-library] skip foreign key in director work key={}", key); return; }
        String runId = m.path("runId").asText(null);
        String prompt = "";
        if (runId != null) prompt = runs.findById(runId).map(library::runPrompt).orElse("");
        ObjectNode version = IpLibraryService.addVersion(data, key, clip(prompt, VERSION_PROMPT_MAX), runId, m.path("mock").asBoolean(false), false);
        if (image.label() != null && !version.has("label")) version.put("label", image.label());
    }

    /** 文件层：已有的只补来源和默认名，用户改过的名字不动（见 IpSavedAssetService）。来自资产库的图本来就在库里，不再收一次。 */
    private void saveMedia(String user, String workId, Image image, String kind, ObjectNode seen, String objectId) {
        JsonNode m = image.candidate();
        String key = m.path("key").asText(), source = m.path("source").asText();
        if (key.isBlank() || "library".equals(source)) return;
        if (image.title().equals(seen.path(key).asText())) return;
        if (!projects.ownsAssetKey(user, key)) { log.warn("[asset-library] skip foreign key in director work key={}", key); return; }
        ObjectNode media = om.createObjectNode().put("kind", kind).put("title", image.title()).put("source", "upload".equals(source) ? "用户上传" : "AI 生成");
        media.putObject("data").put("storageKey", key);
        ObjectNode meta = media.putObject("metadata").put("projectId", workId).put("nodeId", image.node());
        if (objectId != null) meta.put("objectId", objectId);
        String runId = m.path("runId").asText(null);
        if (runId != null) {
            meta.put("runId", runId);
            runs.findById(runId).ifPresent(run -> meta.put("prompt", library.runPrompt(run)));
        }
        saved.saveAutomatic(user, media);
        seen.put(key, image.title());
    }

    private IpLibraryRecord newObject(String user, JsonNode asset, List<Image> images) {
        String description = clip(asset.path("description").asText(), 2000);
        ObjectNode data = om.createObjectNode().put("kind", asset.path("kind").asText()).put("name", clip(asset.path("name").asText("未命名"), 128))
                .put("description", description).put("prompt", description);
        data.putArray("versions"); data.putArray("sources");
        IpLibraryRecord row = record(user, "object", "ILO-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24), data);
        // 按第一张图的时间排，存量补进来时不会全挤到最前面。
        row.setCreatedAt(earliest(images));
        return row;
    }

    private IpLibraryRecord record(String user, String type, String id, ObjectNode data) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        return IpLibraryRecord.builder().id(id).ownerUserId(user).recordType(type).payloadJson(data.toString()).createdAt(now).updatedAt(now).build();
    }

    private IpLibraryRecord liveObject(String user, String id) {
        return records.findById(id).filter(r -> user.equals(r.getOwnerUserId()) && "object".equals(r.getRecordType()) && r.getDeletedAt() == null).orElse(null);
    }

    /** 主图、角色形态、场景的其他视角都算这张卡的图。 */
    private List<Image> imagesOf(JsonNode asset) {
        List<Image> out = new ArrayList<>();
        String name = asset.path("name").asText();
        String id = asset.path("id").asText();
        addSlot(out, asset.path("image"), null, name + " · " + IMAGE_LABEL.getOrDefault(asset.path("kind").asText(), "图"), "asset:" + id);
        for (JsonNode form : asset.path("forms")) {
            String label = form.path("name").asText();
            addSlot(out, form.path("image"), label, name + " · " + label, "form:" + form.path("id").asText());
        }
        for (var view : VIEW_LABEL.entrySet())
            addSlot(out, asset.path("views").path(view.getKey()), view.getValue(), name + " · " + view.getValue(), "views:" + id);
        return out;
    }

    /** 同一格有几张时后面的带序号（林远 · 角色图 2）。 */
    private void addSlot(List<Image> out, JsonNode slot, String label, String title, String node) {
        int index = 0;
        for (JsonNode m : slot.path("candidates")) {
            if (m.path("key").asText("").isBlank()) continue;
            index++;
            out.add(new Image(m, label, index > 1 ? title + " " + index : title, node));
        }
    }

    /** 分镜图、片段视频、整集成片。 */
    private List<Image> clipMedia(JsonNode content) {
        Map<String, Integer> episodeNo = new HashMap<>();
        for (JsonNode ep : content.path("episodes")) episodeNo.put(ep.path("id").asText(), ep.path("no").asInt());
        List<Image> out = new ArrayList<>();
        for (JsonNode clip : content.path("clips")) {
            Integer no = episodeNo.get(clip.path("episodeId").asText());
            String name = (no == null ? "" : "第 " + no + " 集") + "片段 " + clip.path("order").asInt();
            addSlot(out, clip.path("board"), null, name + " · 分镜图", "board:" + clip.path("id").asText());
            addSlot(out, clip.path("video"), null, name + " · 视频", "video:" + clip.path("id").asText());
        }
        for (JsonNode export : content.path("exports")) {
            if (!"done".equals(export.path("status").asText()) || export.path("key").asText("").isBlank()) continue;
            out.add(new Image(export, null, "第 " + export.path("episodeNo").asInt() + " 集 · 成片", "export:" + export.path("episodeId").asText()));
        }
        return out;
    }

    private static String fingerprint(JsonNode asset, List<Image> images, String workTitle) {
        StringBuilder b = new StringBuilder(workTitle).append('\0').append(asset.path("libraryObjectId").asText()).append('\0')
                .append(adoptedKey(asset.path("image")));
        for (Image image : images) b.append('\0').append(image.candidate().path("key").asText());
        return IpLibraryService.hash(b.toString()).substring(0, 24);
    }

    private static String adoptedKey(JsonNode slot) {
        String id = slot.path("adoptedId").asText("");
        if (id.isBlank()) return "";
        for (JsonNode m : slot.path("candidates")) if (id.equals(m.path("id").asText())) return m.path("key").asText("");
        return "";
    }

    private static Instant earliest(List<Image> images) {
        Instant first = null;
        for (Image image : images) {
            try {
                Instant at = Instant.parse(image.candidate().path("createdAt").asText());
                if (first == null || at.isBefore(first)) first = at;
            } catch (Exception ignored) { /* 没有时间的旧候选按现在算 */ }
        }
        return (first == null ? Instant.now() : first).truncatedTo(ChronoUnit.MICROS);
    }

    private static String clip(String text, int max) {
        if (text == null) return "";
        return text.length() <= max ? text : text.substring(0, max);
    }

    private JsonNode parse(String json) {
        try { return om.readTree(json); }
        catch (Exception e) { throw new IllegalStateException("library sync payload is invalid", e); }
    }
}
