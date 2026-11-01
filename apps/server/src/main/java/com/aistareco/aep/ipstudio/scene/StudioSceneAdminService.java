package com.aistareco.aep.ipstudio.scene;

import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog.Catalog;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.MediaBytes;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 后台「Studio 场景模板」：运营增删改 AI 图片 / AI 视频的场景，整份目录一次保存。
 *
 * <p>保存带上读到的版本号，别人先存过就拒绝（不覆盖）；保存前用和随包目录同一套 {@link StudioSceneCatalog#validate}。
 * 封面和参考示例只能是这里上传的文件（{@link StudioSceneCatalog#MEDIA_PREFIX}），目录里只存 key，出 wire 时签名。
 */
@Service
public class StudioSceneAdminService {
    public record View(Catalog catalog, String source, int version, List<String> skills) {}
    public record SaveRequest(Catalog catalog, Integer baseVersion) {}
    public record Uploaded(String key, String url, String mediaType) {}

    private static final long IMAGE_MAX = 10L * 1024 * 1024, VIDEO_MAX = 50L * 1024 * 1024;

    private final StudioSceneCatalog scenes;
    private final PlatformConfigService config;
    private final FileStorageService storage;
    private final ObjectMapper mapper;

    public StudioSceneAdminService(StudioSceneCatalog scenes, PlatformConfigService config, FileStorageService storage, ObjectMapper mapper) {
        this.scenes = scenes; this.config = config; this.storage = storage; this.mapper = mapper;
    }

    /** 场景的创作文字写进提示词库（docs/studio-prompt-architecture.md §5）；单测里没有时只存场景目录。 */
    private com.aistareco.aep.ipstudio.skill.StudioSkillAdminService prompts;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setPrompts(com.aistareco.aep.ipstudio.skill.StudioSkillAdminService prompts) { this.prompts = prompts; }

    public View view() {
        return new View(StudioSceneCatalog.withMedia(scenes.catalog(), storage::signedUrl), scenes.usingBuiltIn() ? "default" : "custom", scenes.savedVersion(),
                StudioSceneCatalog.VIDEO_SKILLS.stream().sorted().toList());
    }

    @Transactional
    public View save(SaveRequest request, String actor) {
        if (request == null || request.catalog() == null) throw BusinessException.badRequest("STUDIO_SCENE_CATALOG_INVALID", "场景目录为空");
        config.lockExisting(StudioSceneCatalog.CONFIG_KEY);
        requireBase(request.baseVersion());
        Catalog clean = strip(request.catalog());
        try { StudioSceneCatalog.validate(clean); }
        catch (IllegalStateException e) { throw BusinessException.badRequest("STUDIO_SCENE_CATALOG_INVALID", e.getMessage()); }
        if (prompts != null) publishCreative(clean, actor);
        config.upsert(StudioSceneCatalog.CONFIG_KEY, mapper.valueToTree(clean), "Studio 场景模板（AI 图片 / AI 视频）", actor);
        return view();
    }

    /**
     * 回到随包那份：配置行不删，写成「用内置」的记录、版本号接着加（见 {@link StudioSceneCatalog#BUILT_IN_FIELD}）。
     * 上传过的文件不删，旧草稿的封面还在用。
     */
    @Transactional
    public View reset(Integer baseVersion, String actor) {
        config.lockExisting(StudioSceneCatalog.CONFIG_KEY);
        requireBase(baseVersion);
        if (!scenes.usingBuiltIn()) config.upsert(StudioSceneCatalog.CONFIG_KEY, StudioSceneCatalog.builtInMarker(), "Studio 场景模板（已恢复内置）", actor);
        return view();
    }

    public Uploaded upload(MultipartFile file) {
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("STUDIO_SCENE_MEDIA_INVALID", "请选择要上传的文件");
        byte[] bytes;
        try { bytes = file.getBytes(); } catch (IOException e) { throw BusinessException.badRequest("STUDIO_SCENE_MEDIA_INVALID", "文件读取失败，请重新上传"); }
        MediaBytes.Format image = MediaBytes.sniff("image", bytes);
        MediaBytes.Format video = image == null ? MediaBytes.sniff("video", bytes) : null;
        // 按字节判，不按文件名（§8.0.1 ⑤）；示例视频只收 MP4，浏览器都能直接放。
        if (image == null && !MediaBytes.MP4.equals(video)) throw BusinessException.badRequest("STUDIO_SCENE_MEDIA_INVALID", "只支持 JPG / PNG / WEBP 图片或 MP4 视频");
        long max = image != null ? IMAGE_MAX : VIDEO_MAX;
        if (bytes.length > max) throw BusinessException.badRequest("STUDIO_SCENE_MEDIA_INVALID", (image != null ? "图片" : "视频") + "超过 " + max / 1024 / 1024 + "MB 上限");
        var format = image != null ? image : video;
        var stored = storage.store(bytes, StudioSceneCatalog.MEDIA_CATEGORY, StudioSceneCatalog.MEDIA_OWNER, format.ext(), format.mime());
        return new Uploaded(stored.key(), storage.signedUrl(stored.key()), StudioSceneCatalog.mediaType(stored.key()));
    }

    /**
     * 拍法、要用到的信息、出图描述改了的场景，在提示词库里出一个新版本（没有条目就新建）；没改的不动，不会凭空多出版本。
     * 比的是现在生效的内容（{@link StudioSceneCatalog#catalog} 已叠上提示词库）。
     */
    private void publishCreative(Catalog clean, String actor) {
        Catalog now = scenes.catalog();
        var library = scenes.library();
        for (var s : clean.video()) {
            var was = now.video().stream().filter(v -> v.id().equals(s.id())).findFirst().orElse(null);
            if (was != null && Objects.equals(trim(s.structure()), trim(was.structure())) && Objects.equals(s.brief(), was.brief())) continue;
            String key = StudioSceneCatalog.sceneKey(s.id());
            Map<String, Object> header = header(library, key, s.id(), s.title(), "video", "视频场景「" + s.title() + "」的拍法与要用到的信息");
            Map<String, Object> scene = new LinkedHashMap<>(header.get("scene") instanceof Map<?, ?> m ? castMap(m) : Map.of());
            scene.remove("goal"); scene.remove("facts"); scene.remove("ending"); scene.remove("fiction");
            if (s.brief() != null) scene.putAll(mapper.convertValue(s.brief(), new com.fasterxml.jackson.core.type.TypeReference<LinkedHashMap<String, Object>>() {}));
            scene.values().removeIf(Objects::isNull);
            header.put("scene", scene);
            prompts.publishEntryContent(key, header, trim(s.structure()), "场景后台保存", actor);
        }
        for (var s : clean.image()) {
            if (StudioSceneCatalog.FREE.equals(s.id())) continue;
            var was = now.image().stream().filter(v -> v.id().equals(s.id())).findFirst().orElse(null);
            if (was != null && Objects.equals(trim(s.prompt()), trim(was.prompt()))) continue;
            String key = StudioSceneCatalog.sceneKey(s.id());
            prompts.publishEntryContent(key, header(library, key, s.id(), s.title(), "image", "图片场景「" + s.title() + "」的出图描述"), trim(s.prompt()), "场景后台保存", actor);
        }
    }

    /** 现有条目的文件头（保留摘要、避免清单等），没有就按场景新写一份。 */
    private static Map<String, Object> header(com.aistareco.aep.ipstudio.prompt.StudioPromptLibrary library, String key, String id, String title, String kind, String summary) {
        var current = library == null ? java.util.Optional.<com.aistareco.aep.ipstudio.prompt.StudioPromptEntry>empty() : library.find(key);
        Map<String, Object> header = new LinkedHashMap<>();
        if (current.isPresent()) header.putAll(current.get().header());
        else {
            header.put("key", key); header.put("version", 1); header.put("status", "active"); header.put("layer", "scene");
            header.put("summary", summary); header.put("sceneId", id); header.put("sceneKind", kind);
        }
        header.put("name", title.length() > 64 ? title.substring(0, 64) : title);
        header.remove("importFrom");
        return header;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Map<?, ?> m) { return (Map<String, Object>) m; }

    private static String trim(String v) { return v == null ? "" : v.strip(); }

    private void requireBase(Integer baseVersion) {
        int current = scenes.savedVersion();
        if (!Objects.equals(baseVersion == null ? 0 : baseVersion, current))
            throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_SCENE_CATALOG_STALE", "场景目录刚被别人改过，请刷新后再改");
    }

    /** 地址是派生出来的（会过期），不进库。 */
    private static Catalog strip(Catalog c) {
        return c.with(c.image() == null ? null : c.image().stream().map(s -> s.withMedia(s.enabled(), s.coverKey(), s.exampleKeys(), null, null)).toList(),
                c.video() == null ? null : c.video().stream().map(s -> s.withMedia(s.enabled(), s.coverKey(), s.exampleKeys(), null, null)).toList(),
                c.homeGoals());
    }
}
